// Go SVT Maroc — Supabase Auth integration (replaces device-only local accounts).
(function () {
  'use strict';
  const L = (ar, fr) => (typeof t === 'function' ? t(ar, fr) : ar);
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const client = window.supabaseClient;
  let ready = false, user = null, profile = null, localProfileId = null, view = 'login', recoveryMode = false;
  let sessionGeneration = 0;
  let sessionApply = null;
  const MAP_KEY = 'gosvt_supabase_profile_map';
  const STUDY_TRACKS = {
    TC: [
      { value: 'TCS', ar: 'الجذع المشترك العلمي', fr: 'Tronc commun scientifique' },
      { value: 'TCL', ar: 'الجذع المشترك الأدبي', fr: 'Tronc commun lettres' }
    ],
    '1BAC': [
      { value: '1BACSE', ar: 'العلوم التجريبية', fr: 'Sciences expérimentales' },
      { value: '1BACSM', ar: 'العلوم الرياضية', fr: 'Sciences mathématiques' },
      { value: '1BACL', ar: 'الآداب', fr: 'Lettres' }
    ],
    '2BAC': [
      { value: '2BACSVT', ar: 'علوم الحياة والأرض', fr: 'Sciences de la vie et de la Terre' },
      { value: '2BACSP', ar: 'العلوم الفيزيائية', fr: 'Sciences physiques' },
      { value: '2BACSM', ar: 'العلوم الرياضية', fr: 'Sciences mathématiques' }
    ]
  };
  const msg = (form, value) => { const el = form.querySelector('.gs-auth-msg'); if (el) el.textContent = value || ''; };
  const errorText = err => {
    const m = String(err && (err.message || err.error_description) || '');
    if (/already registered|already exists/i.test(m)) return L('هذا البريد الإلكتروني مسجل من قبل.', 'Cette adresse e-mail est déjà utilisée.');
    if (/invalid login credentials/i.test(m)) return L('البريد الإلكتروني أو كلمة المرور غير صحيحة.', 'E-mail ou mot de passe incorrect.');
    if (/email not confirmed/i.test(m)) return L('يرجى تأكيد بريدك الإلكتروني أولاً.', 'Veuillez d’abord confirmer votre adresse e-mail.');
    if (/password should be at least|weak password/i.test(m)) return L('كلمة المرور ضعيفة. استخدم 8 أحرف على الأقل.', 'Mot de passe trop faible : 8 caractères minimum.');
    return m || L('حدث خطأ. تحقق من الاتصال وحاول مجدداً.', 'Une erreur est survenue. Vérifiez la connexion et réessayez.');
  };
  function setAccountSwitching(active) {
    const switching = !!active;
    document.body.classList.toggle('gs-account-switching', switching);
    const root = document.getElementById('student-space-content');
    if (root) {
      if (switching) root.setAttribute('aria-busy', 'true');
      else root.removeAttribute('aria-busy');
    }
  }

  function emit() {
    document.dispatchEvent(new CustomEvent('gosvt:auth-changed', { detail: { loggedIn: !!user, userId: user && user.id, profile } }));
    if (window.StudentSpace) window.StudentSpace.refresh();
  }
  function getMap() {
    try {
      const value = JSON.parse(localStorage.getItem(MAP_KEY) || '{}');
      return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    } catch (_) { return {}; }
  }
  function setMap(v) { try { localStorage.setItem(MAP_KEY, JSON.stringify(v)); } catch (_) {} }

  async function applySession(session) {
    const uid = session && session.user ? session.user.id : null;
    // Supabase may fire SIGNED_IN while the form handler also applies the same session.
    // Share the in-flight work so the same account cannot create two local profiles.
    if (sessionApply && sessionApply.uid === uid) return sessionApply.promise;
    const generation = ++sessionGeneration;
    const promise = applySessionInternal(session, generation);
    sessionApply = { uid, promise };
    try {
      return await promise;
    } finally {
      // A stale request must never uncover the workspace while a newer account is loading.
      if (generation === sessionGeneration) setAccountSwitching(false);
      if (sessionApply && sessionApply.promise === promise) sessionApply = null;
    }
  }

  async function applySessionInternal(session, generation) {
    const sessionUser = session && session.user ? session.user : null;
    const uid = sessionUser && sessionUser.id;
    const previousUid = user && user.id;
    // Hide the previous student's workspace while the new account profile is being loaded.
    if (uid !== previousUid) setAccountSwitching(true);
    user = sessionUser;
    profile = null;
    localProfileId = null;

    if (sessionUser) {
      let data = null, error = null;
      try {
        ({ data, error } = await client
          .from('profiles')
          .select('id,display_name,role')
          .eq('id', uid)
          .maybeSingle());
      } catch (err) {
        if (generation !== sessionGeneration) return;
        console.warn('[GoSVT] Profile read deferred:', err && err.message);
      }

      // Ignore a late profile response after another account signed in or out.
      if (generation !== sessionGeneration) return;
      if (error) console.warn('[GoSVT] Profile read:', error.message);

      const metadata = sessionUser.user_metadata || {};
      profile = {
        ...(data || {
          id: uid,
          display_name: metadata.display_name || sessionUser.email,
          role: 'student'
        }),
        study_level: metadata.study_level || (data && data.study_level) || null,
        study_track: metadata.study_track || (data && data.study_track) || null
      };

      if (window.StudentSpace) {
        const map = getMap();
        localProfileId = map[uid];

        if (!localProfileId || !window.StudentSpace.getProfiles()[localProfileId]) {
          // StudentSpace profile names are limited to 40 characters.
          const requestedName = String(profile.display_name || 'Student').trim();
          const localName = requestedName.slice(0, 40) || 'Student';
          localProfileId = window.StudentSpace.createProfile(localName);
          map[uid] = localProfileId;
          setMap(map);
        }

        window.StudentSpace.switchProfile(localProfileId);
        const profileIdForSession = localProfileId;

        // Open the student space immediately from local data. Cloud restoration
        // runs in the background so a slow network cannot block the login screen.
        ready = true;
        emit();

        if (window.GoSVTCloud && window.GoSVTStudyFavorites &&
            typeof window.GoSVTCloud.loadFavorites === 'function') {
          window.GoSVTCloud.loadFavorites()
            .then(paths => {
              if (generation !== sessionGeneration || !user || user.id !== uid) return;
              window.GoSVTStudyFavorites.activate(uid, paths);
            })
            .catch(err => {
              console.warn('[GoSVT] Favorites cloud restore deferred:', err && err.message);
              if (generation === sessionGeneration && user && user.id === uid) {
                window.GoSVTStudyFavorites.activate(uid, null);
              }
            });
        }

        if (window.GoSVTCloud && window.StudentSpace) {
          Promise.all([
            typeof window.GoSVTCloud.loadProgress === 'function' ? window.GoSVTCloud.loadProgress() : Promise.resolve(null),
            typeof window.GoSVTCloud.loadNotes === 'function' ? window.GoSVTCloud.loadNotes() : Promise.resolve(null),
            typeof window.GoSVTCloud.loadStudyPlan === 'function' ? window.GoSVTCloud.loadStudyPlan() : Promise.resolve(null)
          ]).then(results => {
            if (generation !== sessionGeneration || !user || user.id !== uid) return;
            const [cloudProgress, cloudNotes, cloudPlan] = results;
            if (cloudProgress && typeof window.StudentSpace.mergeCloudProgress === 'function') {
              window.StudentSpace.mergeCloudProgress(profileIdForSession, cloudProgress);
            }
            if ((Array.isArray(cloudNotes) || Array.isArray(cloudPlan)) &&
                typeof window.StudentSpace.mergeCloudCollections === 'function') {
              window.StudentSpace.mergeCloudCollections(profileIdForSession, cloudNotes, cloudPlan);
            }
            if (generation !== sessionGeneration || !user || user.id !== uid) return;
            const cached = window.StudentSpace.getProfileData(profileIdForSession);
            const syncJobs = [
              ['progress', 'syncProgress', cached.progress],
              ['notes', 'syncNotes', cached.notes],
              ['study plan', 'syncStudyPlan', cached.studyPlan]
            ];
            syncJobs.forEach(job => {
              if (typeof window.GoSVTCloud[job[1]] !== 'function') return;
              Promise.resolve().then(() => window.GoSVTCloud[job[1]](job[2]))
                .catch(err => console.warn('[GoSVT] Background ' + job[0] + ' sync deferred:', err && err.message));
            });
            emit();
            console.log('[GoSVT] Cloud student data restored in background.');
          }).catch(err => console.warn('[GoSVT] Background cloud restore failed:', err && err.message));
        }
        return;
      }
    }

    ready = true;
    emit();
  }
  function field(id, label, type, attrs='') {
    return `<label class="gs-auth-field" for="${id}"><span>${label}</span><input id="${id}" name="${id}" type="${type}" ${attrs}></label>`;
  }
  function renderGate(container) {
    if (!ready) { container.innerHTML = `<div class="student-space"><div class="gs-auth"><p>${L('جارٍ التحقق من الجلسة...', 'Vérification de la session...')}</p></div></div>`; return; }
    if (!client) { container.innerHTML = `<div class="student-space"><div class="gs-auth"><p class="gs-auth-msg">${L('تعذر الاتصال بخدمة المصادقة. تحقق من تحميل مكتبة Supabase.', 'Impossible de charger le service Supabase. Vérifiez la bibliothèque.')}</p></div></div>`; return; }
    let form = '';
    if (view === 'register') {
      form = `<form class="gs-auth-form" data-form="register" novalidate>
        ${field('gs-r-name', L('الاسم الكامل', 'Nom complet'), 'text', 'autocomplete="name" maxlength="80" required')}
        ${field('gs-r-email', L('البريد الإلكتروني', 'Adresse e-mail'), 'email', 'autocomplete="email" required')}
        <label class="gs-auth-field" for="gs-r-level"><span>${L('المستوى الدراسي', 'Niveau scolaire')}</span>
          <select id="gs-r-level" name="study_level" required>
            <option value="">${L('اختر المستوى', 'Choisir le niveau')}</option>
            <option value="TC">TC — ${L('الجذع المشترك', 'Tronc commun')}</option>
            <option value="1BAC">1BAC — ${L('الأولى باكالوريا', '1ère année Bac')}</option>
            <option value="2BAC">2BAC — ${L('الثانية باكالوريا', '2ème année Bac')}</option>
          </select>
        </label>
        <label class="gs-auth-field" for="gs-r-track"><span>${L('المسلك الدراسي', 'Filière')}</span>
          <select id="gs-r-track" name="study_track" required disabled>
            <option value="">${L('اختر المستوى أولاً', 'Choisissez d’abord le niveau')}</option>
          </select>
        </label>
        ${field('gs-r-pwd', L('كلمة المرور (8 أحرف على الأقل)', 'Mot de passe (8 caractères min.)'), 'password', 'autocomplete="new-password" minlength="8" required')}
        ${field('gs-r-pwd2', L('تأكيد كلمة المرور', 'Confirmer le mot de passe'), 'password', 'autocomplete="new-password" required')}
        <p class="gs-auth-msg" role="alert" aria-live="polite"></p><button class="gs-auth-submit" type="submit">${L('إنشاء الحساب', 'Créer mon compte')}</button></form>`;
    } else if (view === 'forgot') {
      form = `<form class="gs-auth-form" data-form="forgot" novalidate>
        ${field('gs-f-email', L('البريد الإلكتروني', 'Adresse e-mail'), 'email', 'autocomplete="email" required')}
        <p class="gs-auth-hint">${L('سنرسل إليك رابطاً آمناً لإعادة تعيين كلمة المرور.', 'Nous vous enverrons un lien sécurisé pour réinitialiser votre mot de passe.')}</p>
        <p class="gs-auth-msg" role="alert" aria-live="polite"></p><button class="gs-auth-submit" type="submit">${L('إرسال رابط الاسترجاع', 'Envoyer le lien')}</button>
        <button class="gs-auth-link" type="button" data-view="login">${L('رجوع', 'Retour')}</button></form>`;
    } else if (view === 'reset' || recoveryMode) {
      form = `<form class="gs-auth-form" data-form="reset" novalidate>
        ${field('gs-reset-pwd', L('كلمة المرور الجديدة', 'Nouveau mot de passe'), 'password', 'autocomplete="new-password" minlength="8" required')}
        ${field('gs-reset-pwd2', L('تأكيد كلمة المرور', 'Confirmer le mot de passe'), 'password', 'autocomplete="new-password" required')}
        <p class="gs-auth-msg" role="alert" aria-live="polite"></p><button class="gs-auth-submit" type="submit">${L('حفظ كلمة المرور', 'Enregistrer le mot de passe')}</button></form>`;
    } else {
      form = `<form class="gs-auth-form" data-form="login" novalidate>
        ${field('gs-l-email', L('البريد الإلكتروني', 'Adresse e-mail'), 'email', 'autocomplete="email" required')}
        ${field('gs-l-pwd', L('كلمة المرور', 'Mot de passe'), 'password', 'autocomplete="current-password" required')}
        <p class="gs-auth-msg" role="alert" aria-live="polite"></p><button class="gs-auth-submit" type="submit">${L('دخول', 'Se connecter')}</button>
        <button class="gs-auth-link" type="button" data-view="forgot">${L('نسيت كلمة المرور؟', 'Mot de passe oublié ?')}</button></form>`;
    }
    const tabs = view === 'reset' || view === 'forgot' ? '' : `<div class="gs-auth-tabs" role="tablist"><button type="button" class="gs-auth-tab${view==='login'?' active':''}" data-view="login">${L('دخول','Connexion')}</button><button type="button" class="gs-auth-tab${view==='register'?' active':''}" data-view="register">${L('حساب جديد','Créer un compte')}</button></div>`;
    container.innerHTML = `<div class="student-space"><div class="gs-auth"><div class="gs-auth-icon" aria-hidden="true">🎓</div><h3>${L('مساحتي','Mon espace')}</h3><p class="gs-auth-lead">${L('سجّل الدخول أو أنشئ حساباً لحفظ تقدمك.', 'Connectez-vous ou créez un compte pour sauvegarder votre progression.')}</p>${tabs}${form}<p class="gs-auth-note">${L('تتم إدارة الحسابات بشكل آمن عبر Supabase. لا تشارك كلمة المرور مع أي شخص.', 'Les comptes sont gérés de manière sécurisée par Supabase. Ne partagez votre mot de passe avec personne.')}</p></div></div>`;
    container.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => { view = b.dataset.view; renderGate(container); }));
    const f = container.querySelector('form[data-form]');
    if (f && f.dataset.form === 'register') {
      const levelSelect = f.querySelector('#gs-r-level');
      const trackSelect = f.querySelector('#gs-r-track');
      levelSelect.addEventListener('change', () => {
        const tracks = STUDY_TRACKS[levelSelect.value] || [];
        trackSelect.innerHTML = `<option value="">${L('اختر المسلك', 'Choisir la filière')}</option>` +
          tracks.map(item => `<option value="${item.value}">${L(item.ar, item.fr)}</option>`).join('');
        trackSelect.disabled = tracks.length === 0;
      });
    }
    if (f) f.addEventListener('submit', async e => {
      e.preventDefault();
      if (!f.checkValidity()) {
        const invalid = f.querySelector(':invalid');
        if (invalid) invalid.focus();
        msg(f, L('يرجى التحقق من الحقول المطلوبة وصيغة البريد الإلكتروني.', 'Vérifiez les champs obligatoires et le format de l’adresse e-mail.'));
        return;
      }
      const btn = f.querySelector('button[type="submit"]'); if (btn) btn.disabled = true;
      try {
        const type = f.dataset.form;
        if (type === 'register') {
          const name = f.querySelector('#gs-r-name').value.trim(), email = f.querySelector('#gs-r-email').value.trim().toLowerCase();
          const password = f.querySelector('#gs-r-pwd').value, confirm = f.querySelector('#gs-r-pwd2').value;
          const studyLevel = f.querySelector('#gs-r-level').value;
          const studyTrack = f.querySelector('#gs-r-track').value;
          if (!STUDY_TRACKS[studyLevel] || !STUDY_TRACKS[studyLevel].some(item => item.value === studyTrack)) {
            throw new Error(L('يرجى اختيار المستوى والمسلك الدراسي الصحيحين.', 'Veuillez choisir un niveau et une filière valides.'));
          }
          if (name.length < 2 || name.length > 80) throw new Error(L('الاسم يجب أن يتكون من حرفين إلى 80 حرفاً.', 'Le nom doit contenir entre 2 et 80 caractères.'));
          if (password.length < 8) throw new Error(L('كلمة المرور يجب أن تتكون من 8 أحرف على الأقل.', 'Le mot de passe doit contenir au moins 8 caractères.'));
          if (password !== confirm) throw new Error(L('كلمتا المرور غير متطابقتين.', 'Les mots de passe ne correspondent pas.'));
          const { data, error } = await client.auth.signUp({ email, password, options: { data: { display_name: name, study_level: studyLevel, study_track: studyTrack }, emailRedirectTo: window.location.origin + window.location.pathname } });
          if (error) throw error;
          if (data.session) { await applySession(data.session); }
          else { msg(f, L('تم إنشاء الحساب. تحقق من بريدك الإلكتروني واضغط رابط التأكيد، ثم سجّل الدخول.', 'Compte créé. Vérifiez votre e-mail et cliquez sur le lien de confirmation, puis connectez-vous.')); }
        } else if (type === 'login') {
          const email = f.querySelector('#gs-l-email').value.trim().toLowerCase(), password = f.querySelector('#gs-l-pwd').value;
          const { data, error } = await client.auth.signInWithPassword({ email, password }); if (error) throw error;
          view = 'login'; await applySession(data.session);
        } else if (type === 'forgot') {
          const email = f.querySelector('#gs-f-email').value.trim().toLowerCase();
          const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + window.location.pathname }); if (error) throw error;
          msg(f, L('إذا كان البريد مسجلاً، فستصلك رسالة تحتوي على رابط إعادة التعيين.', 'Si cette adresse est enregistrée, vous recevrez un lien de réinitialisation.'));
        } else if (type === 'reset') {
          const password = f.querySelector('#gs-reset-pwd').value, confirm = f.querySelector('#gs-reset-pwd2').value;
          if (password.length < 8) throw new Error(L('كلمة المرور يجب أن تتكون من 8 أحرف على الأقل.', 'Le mot de passe doit contenir au moins 8 caractères.'));
          if (password !== confirm) throw new Error(L('كلمتا المرور غير متطابقتين.', 'Les mots de passe ne correspondent pas.'));
          const { error } = await client.auth.updateUser({ password }); if (error) throw error;
          recoveryMode = false; view = 'login'; msg(f, L('تم تحديث كلمة المرور بنجاح. يمكنك الآن الدخول.', 'Mot de passe mis à jour. Vous pouvez vous connecter.'));
        }
      } catch (err) { console.error('[GoSVT Auth]', err); msg(f, errorText(err)); }
      finally { if (btn && btn.isConnected) btn.disabled = false; }
    });
  }
  function logout() { if (client) client.auth.signOut().catch(e => console.error('[GoSVT] Sign out:', e)); }
  function renderBar() {
    if (!user) return '';
    return `<div class="gs-acc-wrap"><div class="gs-acc-bar"><div class="gs-acc-who">👤 <strong>${esc(profile && profile.display_name || user.email)}</strong><small>${esc(user.email)}</small></div><div class="gs-acc-actions"><button type="button" class="gs-acc-btn gs-acc-chpw">🔑 ${L('تغيير كلمة المرور','Changer le mot de passe')}</button><button type="button" class="gs-acc-btn gs-acc-logout">🚪 ${L('تسجيل الخروج','Se déconnecter')}</button></div></div><form class="gs-acc-panel" id="gs-chpw-form" hidden novalidate>${field('gs-c-new',L('كلمة المرور الجديدة','Nouveau mot de passe'),'password','minlength="8" required')}${field('gs-c-new2',L('تأكيد كلمة المرور','Confirmer'),'password','required')}<p class="gs-auth-msg" role="alert"></p><button type="submit" class="gs-auth-submit">${L('حفظ','Enregistrer')}</button></form></div>`;
  }
  document.addEventListener('click', e => { if (e.target.closest && e.target.closest('.gs-acc-logout')) logout(); const b=e.target.closest&&e.target.closest('.gs-acc-chpw'); if(b){const p=document.getElementById('gs-chpw-form');if(p)p.hidden=!p.hidden;} });
  document.addEventListener('submit', async e => { if(e.target.id!=='gs-chpw-form')return; e.preventDefault(); const f=e.target, p=f.querySelector('#gs-c-new').value, p2=f.querySelector('#gs-c-new2').value; if(p.length<8)return msg(f,L('كلمة المرور يجب أن تتكون من 8 أحرف على الأقل.','8 caractères minimum.')); if(p!==p2)return msg(f,L('كلمتا المرور غير متطابقتين.','Les mots de passe ne correspondent pas.')); const b=f.querySelector('button'); b.disabled=true; try{const {error}=await client.auth.updateUser({password:p});if(error)throw error;f.reset();msg(f,L('تم تغيير كلمة المرور.','Mot de passe modifié.'));}catch(err){msg(f,errorText(err));}finally{b.disabled=false;} });
  function initAuth() {
    if (!client) { ready = true; emit(); return; }
    client.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        recoveryMode = true;
        view = 'reset';
      }
      if (event === 'SIGNED_OUT') {
        if (window.GoSVTStudyFavorites && typeof window.GoSVTStudyFavorites.deactivate === 'function') {
          window.GoSVTStudyFavorites.deactivate();
        }
        // Invalidate any pending profile lookup or cloud restore from the old session.
        sessionGeneration++;
        sessionApply = null;
        setAccountSwitching(false);
        recoveryMode = false;
        view = 'login';
        user = null;
        profile = null;
        localProfileId = null;
        ready = true;
        emit();
        return;
      }
      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') && session) {
        setTimeout(() => applySession(session).catch(e => console.error('[GoSVT Auth]', e)), 0);
        return;
      }
      emit();
    });
    client.auth.getSession()
      .then(({ data, error }) => {
        if (error) console.error(error);
        return applySession(data && data.session);
      })
      .catch(e => {
        console.error(e);
        ready = true;
        emit();
      });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initAuth); else initAuth();
  window.StudentAccount = {
    isLoggedIn: () => !!user,
    isReady: () => ready,
    isPasswordRecovery: () => recoveryMode,
    activeProfileId: () => localProfileId,
    renderGate,
    renderBar,
    logout,
    getUser: () => user,
    getProfile: () => profile
  };
})();
