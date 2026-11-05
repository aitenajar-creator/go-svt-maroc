// Go SVT Maroc — Supabase Auth integration (replaces device-only local accounts).
(function () {
  'use strict';
  const L = (ar, fr) => (typeof t === 'function' ? t(ar, fr) : ar);
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const client = window.supabaseClient;
  let ready = false, user = null, profile = null, localProfileId = null, view = 'login', recoveryMode = false;
  const MAP_KEY = 'gosvt_supabase_profile_map';
  const msg = (form, value) => { const el = form.querySelector('.gs-auth-msg'); if (el) el.textContent = value || ''; };
  const errorText = err => {
    const m = String(err && (err.message || err.error_description) || '');
    if (/already registered|already exists/i.test(m)) return L('هذا البريد الإلكتروني مسجل من قبل.', 'Cette adresse e-mail est déjà utilisée.');
    if (/invalid login credentials/i.test(m)) return L('البريد الإلكتروني أو كلمة المرور غير صحيحة.', 'E-mail ou mot de passe incorrect.');
    if (/email not confirmed/i.test(m)) return L('يرجى تأكيد بريدك الإلكتروني أولاً.', 'Veuillez d’abord confirmer votre adresse e-mail.');
    if (/password should be at least|weak password/i.test(m)) return L('كلمة المرور ضعيفة. استخدم 8 أحرف على الأقل.', 'Mot de passe trop faible : 8 caractères minimum.');
    return m || L('حدث خطأ. تحقق من الاتصال وحاول مجدداً.', 'Une erreur est survenue. Vérifiez la connexion et réessayez.');
  };
  function emit() {
    document.dispatchEvent(new CustomEvent('gosvt:auth-changed', { detail: { loggedIn: !!user, userId: user && user.id, profile } }));
    if (window.StudentSpace) window.StudentSpace.refresh();
  }
  function getMap() { try { return JSON.parse(localStorage.getItem(MAP_KEY) || '{}'); } catch (_) { return {}; } }
  function setMap(v) { try { localStorage.setItem(MAP_KEY, JSON.stringify(v)); } catch (_) {} }
  async function applySession(session) {
    user = session && session.user ? session.user : null;
    profile = null; localProfileId = null;
    if (user) {
      const { data, error } = await client.from('profiles').select('id,display_name,role').eq('id', user.id).maybeSingle();
      if (error) console.warn('[GoSVT] Profile read:', error.message);
      profile = data || { id: user.id, display_name: user.user_metadata && user.user_metadata.display_name || user.email, role: 'student' };
      if (window.StudentSpace) {
        const map = getMap();
        localProfileId = map[user.id];
        if (!localProfileId || !window.StudentSpace.getProfiles()[localProfileId]) {
          localProfileId = window.StudentSpace.createProfile(profile.display_name || 'Student');
          map[user.id] = localProfileId; setMap(map);
        }
        window.StudentSpace.switchProfile(localProfileId);
        // Migrate the locally cached learning progress into this authenticated account.
        if (window.GoSVTCloud && typeof window.GoSVTCloud.syncProgress === 'function') {
          const cached = window.StudentSpace.getProfileData(localProfileId);
          window.GoSVTCloud.syncProgress(cached.progress).catch(err => console.warn('[GoSVT] Initial progress sync:', err));
        }
      }
    }
    ready = true; emit();
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
    if (f) f.addEventListener('submit', async e => {
      e.preventDefault(); const btn = f.querySelector('button[type="submit"]'); if (btn) btn.disabled = true;
      try {
        const type = f.dataset.form;
        if (type === 'register') {
          const name = f.querySelector('#gs-r-name').value.trim(), email = f.querySelector('#gs-r-email').value.trim().toLowerCase();
          const password = f.querySelector('#gs-r-pwd').value, confirm = f.querySelector('#gs-r-pwd2').value;
          if (name.length < 2 || name.length > 80) throw new Error(L('الاسم يجب أن يتكون من حرفين إلى 80 حرفاً.', 'Le nom doit contenir entre 2 et 80 caractères.'));
          if (password.length < 8) throw new Error(L('كلمة المرور يجب أن تتكون من 8 أحرف على الأقل.', 'Le mot de passe doit contenir au moins 8 caractères.'));
          if (password !== confirm) throw new Error(L('كلمتا المرور غير متطابقتين.', 'Les mots de passe ne correspondent pas.'));
          const { data, error } = await client.auth.signUp({ email, password, options: { data: { display_name: name }, emailRedirectTo: window.location.origin + window.location.pathname } });
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
  document.addEventListener('DOMContentLoaded', () => { if (!client) { ready=true; return; } client.auth.getSession().then(({data,error})=>{if(error)console.error(error);return applySession(data&&data.session);}).catch(e=>{console.error(e);ready=true;emit();}); client.auth.onAuthStateChange((event, session)=>{ if(event==='PASSWORD_RECOVERY'){recoveryMode=true;view='reset';} if(event==='SIGNED_OUT'){user=null;profile=null;localProfileId=null;ready=true;} if(event==='SIGNED_IN'||event==='TOKEN_REFRESHED'||event==='USER_UPDATED'){ if(session) { setTimeout(()=>applySession(session),0); return; } } emit(); }); });
  window.StudentAccount = { isLoggedIn: () => !!user, isReady: () => ready, activeProfileId: () => localProfileId, renderGate, renderBar, logout, getUser: () => user, getProfile: () => profile };
})();
