// =====================================================
// Go SVT Maroc - student-account.js
// 🔐 حسابات التلاميذ: التسجيل ← الدخول ← مساحتي
// -----------------------------------------------------
// - حسابات محلية على الجهاز (الموقع ثابت على GitHub Pages ولا يملك خادمًا).
// - كلمة المرور لا تُخزَّن أبدًا: فقط بصمة PBKDF2-SHA256 (150000 دورة) مع ملح عشوائي.
// - رمز استرجاع يظهر مرة واحدة عند التسجيل لإعادة تعيين كلمة المرور.
// - الحساب = ملف شخصي (profile) موجود في student-space.js؛ يمكن ربط ملف قديم
//   بحساب جديد دون نقل أو حذف أي بيانات.
// - إذا لم يُحمَّل هذا الملف يعود student-space.js إلى سلوكه القديم.
// =====================================================
(function () {
    'use strict';

    const ACC_KEY = 'gosvt_accounts';
    const SES_KEY = 'gosvt_session';
    const LOCK_KEY = 'gosvt_auth_lock';
    const PROFILES_KEY = 'gosvt_profiles';
    const ITER = 150000;
    const MAX_FAILS = 5;
    const LOCK_MS = 30000;
    const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 32 رمزًا (بلا أحرف ملتبسة)

    const L = (ar, fr) => (typeof t === 'function' ? t(ar, fr) : fr);
    const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

    // ---------- تخزين ----------
    const ls = {
        get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
        set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { console.error('Account storage error:', e); } }
    };
    const getAccounts = () => { const a = ls.get(ACC_KEY); return a && typeof a === 'object' ? a : {}; };
    const saveAccounts = a => ls.set(ACC_KEY, a);

    // ---------- الجلسة ----------
    // "تذكّرني" = localStorage ؛ بدونها = sessionStorage (تنتهي بإغلاق التبويب)
    function readSession() {
        let id = null;
        try { id = sessionStorage.getItem(SES_KEY); } catch (e) { /* ممنوع */ }
        if (!id) { try { id = localStorage.getItem(SES_KEY); } catch (e) { /* ممنوع */ } }
        return id || null;
    }
    function setSession(id, remember) {
        clearSession();
        try { (remember ? localStorage : sessionStorage).setItem(SES_KEY, id); } catch (e) { console.error(e); }
    }
    function clearSession() {
        try { sessionStorage.removeItem(SES_KEY); } catch (e) { /* ممنوع */ }
        try { localStorage.removeItem(SES_KEY); } catch (e) { /* ممنوع */ }
    }
    function activeProfileId() {
        const id = readSession();
        return id && getAccounts()[id] ? id : null;
    }
    const isLoggedIn = () => !!activeProfileId();

    // ---------- التشفير ----------
    const cryptoOk = () => !!(window.crypto && crypto.subtle && crypto.getRandomValues);
    const enc = new TextEncoder();
    function b64(bytes) { let s = ''; bytes.forEach(b => { s += String.fromCharCode(b); }); return btoa(s); }
    function unb64(str) { const s = atob(str); const a = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return a; }
    const newSalt = () => b64(crypto.getRandomValues(new Uint8Array(16)));
    async function derive(secret, saltB64, iter) {
        const key = await crypto.subtle.importKey('raw', enc.encode(String(secret).normalize('NFKC')), 'PBKDF2', false, ['deriveBits']);
        const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: unb64(saltB64), iterations: iter || ITER }, key, 256);
        return b64(new Uint8Array(bits));
    }
    function same(a, b) {
        if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
        let r = 0;
        for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
        return r === 0;
    }
    function newRecoveryCode() {
        const bytes = crypto.getRandomValues(new Uint8Array(16));
        let out = '';
        bytes.forEach((b, i) => { out += CODE_ALPHABET[b % 32]; if (i % 4 === 3 && i < 15) out += '-'; });
        return out;
    }
    const normCode = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

    // ---------- الأسماء ----------
    const normName = s => String(s || '').normalize('NFC').trim().replace(/\s+/g, ' ');
    const nameKey = s => normName(s).toLowerCase();
    const NAME_RE = /^[\p{L}\p{N}][\p{L}\p{N} ._-]{1,29}$/u;
    function findAccountId(key) {
        const accounts = getAccounts();
        return Object.keys(accounts).find(id => accounts[id].key === key) || null;
    }

    // ---------- تحديد المحاولات الفاشلة ----------
    function lockLeft(key) {
        const e = (ls.get(LOCK_KEY) || {})[key];
        return e && e.until > Date.now() ? Math.ceil((e.until - Date.now()) / 1000) : 0;
    }
    function registerFail(key) {
        const all = ls.get(LOCK_KEY) || {};
        const e = all[key] || { n: 0, until: 0 };
        e.n += 1;
        if (e.n >= MAX_FAILS) { e.n = 0; e.until = Date.now() + LOCK_MS; }
        all[key] = e; ls.set(LOCK_KEY, all);
    }
    function clearFails(key) {
        const all = ls.get(LOCK_KEY) || {};
        if (all[key]) { delete all[key]; ls.set(LOCK_KEY, all); }
    }

    // ---------- الملفات الشخصية (من student-space.js) ----------
    const SS = () => window.StudentSpace;
    function ensureProfile(id, name) {
        const profiles = SS().getProfiles();
        if (!profiles[id]) {
            profiles[id] = { id: id, name: name, createdAt: Date.now(), lastActive: Date.now() };
            ls.set(PROFILES_KEY, profiles);
        }
    }
    function renameProfile(id, name) {
        const profiles = SS().getProfiles();
        if (profiles[id]) { profiles[id].name = name; ls.set(PROFILES_KEY, profiles); }
    }
    // ملفات قديمة (بلا حساب) تحتوي بيانات فعلية: يمكن ربطها بحساب جديد
    function legacyCandidates() {
        const accounts = getAccounts();
        const profiles = SS().getProfiles();
        return Object.keys(profiles).filter(id => !accounts[id]).map(id => {
            const d = SS().getProfileData(id);
            const n = Object.keys(d.progress.lessons).length + Object.keys(d.progress.exercises).length +
                Object.keys(d.progress.tests).length + (d.quizResults || []).length;
            return { id: id, name: profiles[id].name, n: n };
        }).filter(c => c.n > 0);
    }

    function afterLogin(id) {
        SS().switchProfile(id);
        try { SS().updateStreak(); } catch (e) { /* غير حرج */ }
        SS().renderStudentSpace();
        document.dispatchEvent(new CustomEvent('gosvt:auth-changed', { detail: { loggedIn: true, profileId: id } }));
    }
    function logout() {
        clearSession();
        SS().renderStudentSpace();
        document.dispatchEvent(new CustomEvent('gosvt:auth-changed', { detail: { loggedIn: false } }));
    }

    // ---------- الرسائل ----------
    const MSG = {
        name: () => L('الاسم من حرفين إلى 30 حرفًا (حروف وأرقام ومسافة و . _ - فقط).', 'Le nom doit faire 2 à 30 caractères (lettres, chiffres, espace, . _ -).'),
        pwdShort: () => L('كلمة المرور 6 أحرف على الأقل.', 'Le mot de passe doit contenir au moins 6 caractères.'),
        mismatch: () => L('كلمتا المرور غير متطابقتين.', 'Les mots de passe ne correspondent pas.'),
        exists: () => L('هذا الاسم مستعمل. اختر اسمًا آخر أو سجّل الدخول.', 'Ce nom est déjà utilisé. Choisissez-en un autre ou connectez-vous.'),
        bad: () => L('الاسم أو كلمة المرور غير صحيحة.', 'Nom ou mot de passe incorrect.'),
        badCode: () => L('الاسم أو رمز الاسترجاع غير صحيح.', 'Nom ou code de récupération incorrect.'),
        locked: s => L(`محاولات كثيرة. حاول بعد ${s} ثانية.`, `Trop de tentatives. Réessayez dans ${s} secondes.`),
        noCrypto: () => L('هذه الميزة تتطلب اتصالًا آمنًا (HTTPS).', 'Cette fonction nécessite une connexion sécurisée (HTTPS).'),
        unexpected: () => L('حدث خطأ غير متوقع. حاول مجددًا.', 'Une erreur inattendue est survenue. Réessayez.'),
        pwdChanged: () => L('تم تغيير كلمة المرور.', 'Mot de passe modifié.')
    };

    // ---------- واجهة الدخول ----------
    let view = null; // login | register | forgot

    function field(id, label, type, extra) {
        return `<label class="gs-auth-field" for="${id}"><span>${label}</span>` +
            `<input id="${id}" name="${id}" type="${type}" dir="auto" ${extra || ''}></label>`;
    }

    function renderGate(container) {
        const hasAccounts = Object.keys(getAccounts()).length > 0;
        if (!view) view = hasAccounts ? 'login' : 'register';
        const tab = (v, label) => `<button type="button" class="gs-auth-tab${view === v || (view === 'forgot' && v === 'login') ? ' active' : ''}" data-view="${v}">${label}</button>`;

        let form = '';
        if (view === 'register') {
            const legacy = legacyCandidates();
            const adopt = legacy.length
                ? `<label class="gs-auth-field" for="gs-r-adopt"><span>${L('ربط تقدمي السابق بهذا الحساب', 'Reprendre ma progression existante')}</span>` +
                  `<select id="gs-r-adopt"><option value="">${L('لا، ابدأ بحساب فارغ', 'Non, commencer avec un compte vide')}</option>` +
                  legacy.map(c => `<option value="${esc(c.id)}">${esc(c.name)} — ${c.n} ${L('عنصر', 'élément(s)')}</option>`).join('') +
                  '</select></label>'
                : '';
            form = `<form class="gs-auth-form" data-form="register" novalidate>
                ${field('gs-r-name', L('الاسم', 'Nom'), 'text', 'autocomplete="username" maxlength="30" required')}
                ${field('gs-r-pwd', L('كلمة المرور (6 أحرف على الأقل)', 'Mot de passe (6 caractères min.)'), 'password', 'autocomplete="new-password" required')}
                ${field('gs-r-pwd2', L('تأكيد كلمة المرور', 'Confirmer le mot de passe'), 'password', 'autocomplete="new-password" required')}
                ${adopt}
                <label class="gs-auth-check"><input id="gs-r-remember" type="checkbox" checked> <span>${L('تذكّرني على هذا الجهاز', 'Se souvenir de moi sur cet appareil')}</span></label>
                <p class="gs-auth-msg" role="alert" aria-live="polite"></p>
                <button type="submit" class="gs-auth-submit">${L('إنشاء الحساب', 'Créer mon compte')}</button>
            </form>`;
        } else if (view === 'forgot') {
            form = `<form class="gs-auth-form" data-form="forgot" novalidate>
                <p class="gs-auth-hint">${L('أدخل اسمك ورمز الاسترجاع الذي ظهر عند التسجيل.', 'Saisissez votre nom et le code de récupération affiché à l’inscription.')}</p>
                ${field('gs-f-name', L('الاسم', 'Nom'), 'text', 'autocomplete="username" required')}
                ${field('gs-f-code', L('رمز الاسترجاع', 'Code de récupération'), 'text', 'autocomplete="off" required style="direction:ltr;text-transform:uppercase"')}
                ${field('gs-f-pwd', L('كلمة المرور الجديدة', 'Nouveau mot de passe'), 'password', 'autocomplete="new-password" required')}
                ${field('gs-f-pwd2', L('تأكيد كلمة المرور', 'Confirmer le mot de passe'), 'password', 'autocomplete="new-password" required')}
                <p class="gs-auth-msg" role="alert" aria-live="polite"></p>
                <button type="submit" class="gs-auth-submit">${L('تعيين كلمة المرور', 'Réinitialiser')}</button>
                <button type="button" class="gs-auth-link" data-view="login">${L('رجوع', 'Retour')}</button>
            </form>`;
        } else {
            form = `<form class="gs-auth-form" data-form="login" novalidate>
                ${field('gs-l-name', L('الاسم', 'Nom'), 'text', 'autocomplete="username" required')}
                ${field('gs-l-pwd', L('كلمة المرور', 'Mot de passe'), 'password', 'autocomplete="current-password" required')}
                <label class="gs-auth-check"><input id="gs-l-remember" type="checkbox" checked> <span>${L('تذكّرني على هذا الجهاز', 'Se souvenir de moi sur cet appareil')}</span></label>
                <p class="gs-auth-msg" role="alert" aria-live="polite"></p>
                <button type="submit" class="gs-auth-submit">${L('دخول', 'Se connecter')}</button>
                <button type="button" class="gs-auth-link" data-view="forgot">${L('نسيت كلمة المرور؟', 'Mot de passe oublié ?')}</button>
            </form>`;
        }

        container.innerHTML = `<div class="student-space"><div class="gs-auth">
            <div class="gs-auth-icon" aria-hidden="true">🎓</div>
            <h3>${L('مساحتي', 'Mon espace')}</h3>
            <p class="gs-auth-lead">${L('أنشئ حسابًا أو سجّل الدخول لتتبّع دروسك وتمارينك ونتائج اختباراتك.', 'Créez un compte ou connectez-vous pour suivre vos leçons, exercices et résultats de quiz.')}</p>
            <div class="gs-auth-tabs" role="tablist">${tab('login', L('دخول', 'Connexion'))}${tab('register', L('حساب جديد', 'Nouveau compte'))}</div>
            ${form}
            <p class="gs-auth-note">${L('الحساب محفوظ على هذا الجهاز فقط.', 'Le compte est enregistré uniquement sur cet appareil.')}</p>
        </div></div>`;
        bindGate(container);
    }

    function setMsg(form, text) {
        const el = form.querySelector('.gs-auth-msg');
        if (el) el.textContent = text || '';
    }

    function bindGate(container) {
        container.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => {
            view = b.dataset.view; renderGate(container);
        }));
        const handlers = { register: doRegister, login: doLogin, forgot: doForgot };
        container.querySelectorAll('form[data-form]').forEach(form => {
            form.addEventListener('submit', async e => {
                e.preventDefault();
                const btn = form.querySelector('.gs-auth-submit');
                if (btn) btn.disabled = true;
                try { await handlers[form.dataset.form](form); }
                catch (err) { console.error('Account error:', err); setMsg(form, MSG.unexpected()); }
                finally { if (btn && btn.isConnected) btn.disabled = false; }
            });
        });
        const first = container.querySelector('.gs-auth-form input');
        if (first) { try { first.focus({ preventScroll: true }); } catch (e) { /* ممنوع */ } }
    }

    // ---------- العمليات ----------
    async function doRegister(form) {
        const name = normName(form.querySelector('#gs-r-name').value);
        const pwd = form.querySelector('#gs-r-pwd').value;
        const pwd2 = form.querySelector('#gs-r-pwd2').value;
        const remember = form.querySelector('#gs-r-remember').checked;
        const adoptEl = form.querySelector('#gs-r-adopt');
        if (!NAME_RE.test(name)) return setMsg(form, MSG.name());
        if (pwd.length < 6) return setMsg(form, MSG.pwdShort());
        if (pwd !== pwd2) return setMsg(form, MSG.mismatch());
        if (findAccountId(nameKey(name))) return setMsg(form, MSG.exists());
        if (!cryptoOk()) return setMsg(form, MSG.noCrypto());

        const salt = newSalt(), recSalt = newSalt(), code = newRecoveryCode();
        const [hash, recHash] = await Promise.all([derive(pwd, salt, ITER), derive(normCode(code), recSalt, ITER)]);
        if (findAccountId(nameKey(name))) return setMsg(form, MSG.exists()); // سباق بين تبويبين

        // ربط ملف قديم: يجب أن يكون ضمن القائمة المسموحة (ملف بلا حساب وله بيانات)
        const wanted = adoptEl ? adoptEl.value : '';
        const adopt = wanted && legacyCandidates().some(c => c.id === wanted) ? wanted : '';
        const id = adopt || SS().createProfile(name);
        renameProfile(id, name);

        const accounts = getAccounts();
        accounts[id] = { id: id, name: name, key: nameKey(name), salt: salt, hash: hash, iter: ITER, recSalt: recSalt, recHash: recHash, createdAt: Date.now() };
        saveAccounts(accounts);
        view = null;
        setSession(id, remember);
        afterLogin(id);
        showRecoveryModal(code, false);
    }

    async function doLogin(form) {
        const name = normName(form.querySelector('#gs-l-name').value);
        const pwd = form.querySelector('#gs-l-pwd').value;
        const remember = form.querySelector('#gs-l-remember').checked;
        const key = nameKey(name);
        if (!name || !pwd) return setMsg(form, MSG.bad());
        const wait = lockLeft(key);
        if (wait) return setMsg(form, MSG.locked(wait));
        if (!cryptoOk()) return setMsg(form, MSG.noCrypto());

        const id = findAccountId(key);
        const acc = id ? getAccounts()[id] : null;
        // مشتقّة وهمية للحساب غير الموجود حتى لا يتغير زمن الاستجابة
        const hash = await derive(pwd, acc ? acc.salt : newSalt(), acc ? acc.iter : ITER);
        if (!acc || !same(hash, acc.hash)) {
            registerFail(key);
            const w = lockLeft(key);
            return setMsg(form, w ? MSG.locked(w) : MSG.bad());
        }
        clearFails(key);
        ensureProfile(id, acc.name);
        view = null;
        setSession(id, remember);
        afterLogin(id);
    }

    async function doForgot(form) {
        const name = normName(form.querySelector('#gs-f-name').value);
        const code = normCode(form.querySelector('#gs-f-code').value);
        const pwd = form.querySelector('#gs-f-pwd').value;
        const pwd2 = form.querySelector('#gs-f-pwd2').value;
        const key = nameKey(name);
        if (pwd.length < 6) return setMsg(form, MSG.pwdShort());
        if (pwd !== pwd2) return setMsg(form, MSG.mismatch());
        const wait = lockLeft(key);
        if (wait) return setMsg(form, MSG.locked(wait));
        if (!cryptoOk()) return setMsg(form, MSG.noCrypto());

        const id = findAccountId(key);
        const acc = id ? getAccounts()[id] : null;
        const recHash = await derive(code, acc ? acc.recSalt : newSalt(), acc ? acc.iter : ITER);
        if (!acc || !same(recHash, acc.recHash)) {
            registerFail(key);
            const w = lockLeft(key);
            return setMsg(form, w ? MSG.locked(w) : MSG.badCode());
        }
        clearFails(key);
        // كلمة مرور جديدة + رمز استرجاع جديد (القديم يُلغى)
        const salt = newSalt(), recSalt = newSalt(), newCode = newRecoveryCode();
        const [hash, newRecHash] = await Promise.all([derive(pwd, salt, ITER), derive(normCode(newCode), recSalt, ITER)]);
        const accounts = getAccounts();
        Object.assign(accounts[id], { salt: salt, hash: hash, iter: ITER, recSalt: recSalt, recHash: newRecHash });
        saveAccounts(accounts);
        ensureProfile(id, acc.name);
        view = null;
        setSession(id, true);
        afterLogin(id);
        showRecoveryModal(newCode, true);
    }

    async function doChangePassword(form) {
        const id = activeProfileId();
        const acc = id ? getAccounts()[id] : null;
        if (!acc) return;
        const cur = form.querySelector('[name="gs-c-cur"]').value;
        const pwd = form.querySelector('[name="gs-c-new"]').value;
        const pwd2 = form.querySelector('[name="gs-c-new2"]').value;
        if (pwd.length < 6) return setMsg(form, MSG.pwdShort());
        if (pwd !== pwd2) return setMsg(form, MSG.mismatch());
        const wait = lockLeft(acc.key);
        if (wait) return setMsg(form, MSG.locked(wait));
        if (!cryptoOk()) return setMsg(form, MSG.noCrypto());
        if (!same(await derive(cur, acc.salt, acc.iter), acc.hash)) {
            registerFail(acc.key);
            const w = lockLeft(acc.key);
            return setMsg(form, w ? MSG.locked(w) : MSG.bad());
        }
        clearFails(acc.key);
        const salt = newSalt();
        const hash = await derive(pwd, salt, ITER);
        const accounts = getAccounts();
        Object.assign(accounts[id], { salt: salt, hash: hash, iter: ITER });
        saveAccounts(accounts);
        form.reset();
        setMsg(form, MSG.pwdChanged());
    }

    // ---------- نافذة رمز الاسترجاع (تظهر مرة واحدة) ----------
    function showRecoveryModal(code, isReset) {
        const old = document.getElementById('gs-recovery-modal');
        if (old) old.remove();
        const modal = document.createElement('div');
        modal.id = 'gs-recovery-modal';
        modal.className = 'gs-auth-modal';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.innerHTML = `<div class="gs-auth-modal-box">
            <h3>🔑 ${isReset ? L('رمز استرجاع جديد', 'Nouveau code de récupération') : L('احفظ رمز الاسترجاع', 'Conservez votre code de récupération')}</h3>
            <p>${L('هذا الرمز هو الوسيلة الوحيدة لاستعادة حسابك إذا نسيت كلمة المرور. يظهر مرة واحدة فقط، فاكتبه أو صوّره الآن.', 'Ce code est le seul moyen de récupérer votre compte si vous oubliez votre mot de passe. Il n’est affiché qu’une seule fois : notez-le ou prenez-le en photo maintenant.')}</p>
            <div class="gs-auth-code" dir="ltr" id="gs-recovery-code">${esc(code)}</div>
            <button type="button" class="gs-auth-link" id="gs-recovery-copy">📋 ${L('نسخ', 'Copier')}</button>
            <label class="gs-auth-check"><input type="checkbox" id="gs-recovery-ok"> <span>${L('حفظت الرمز في مكان آمن', 'J’ai conservé le code en lieu sûr')}</span></label>
            <button type="button" class="gs-auth-submit" id="gs-recovery-continue" disabled>${L('متابعة', 'Continuer')}</button>
        </div>`;
        document.body.appendChild(modal);
        const ok = modal.querySelector('#gs-recovery-ok');
        const go = modal.querySelector('#gs-recovery-continue');
        ok.addEventListener('change', () => { go.disabled = !ok.checked; });
        go.addEventListener('click', () => modal.remove());
        modal.querySelector('#gs-recovery-copy').addEventListener('click', e => {
            try { navigator.clipboard.writeText(code); e.target.textContent = '✔ ' + L('تم النسخ', 'Copié'); } catch (err) { /* ممنوع */ }
        });
        ok.focus();
    }

    // ---------- شريط الحساب (يستبدل محوّل الملفات الشخصية داخل لوحة القيادة) ----------
    function renderBar() {
        const id = activeProfileId();
        const acc = id ? getAccounts()[id] : null;
        if (!acc) return '';
        return `<div class="gs-acc-wrap">
            <div class="gs-acc-bar">
                <div class="gs-acc-who">👤 <strong>${esc(acc.name)}</strong></div>
                <div class="gs-acc-actions">
                    <button type="button" class="gs-acc-btn gs-acc-chpw">🔑 ${L('تغيير كلمة المرور', 'Changer le mot de passe')}</button>
                    <button type="button" class="gs-acc-btn gs-acc-logout">🚪 ${L('تسجيل الخروج', 'Se déconnecter')}</button>
                </div>
            </div>
            <form class="gs-acc-panel" id="gs-chpw-form" hidden novalidate>
                ${field('gs-c-cur', L('كلمة المرور الحالية', 'Mot de passe actuel'), 'password', 'autocomplete="current-password"')}
                ${field('gs-c-new', L('كلمة المرور الجديدة', 'Nouveau mot de passe'), 'password', 'autocomplete="new-password"')}
                ${field('gs-c-new2', L('تأكيد كلمة المرور', 'Confirmer'), 'password', 'autocomplete="new-password"')}
                <p class="gs-auth-msg" role="alert" aria-live="polite"></p>
                <button type="submit" class="gs-auth-submit">${L('حفظ', 'Enregistrer')}</button>
            </form>
        </div>`;
    }

    document.addEventListener('click', e => {
        if (e.target.closest && e.target.closest('.gs-acc-logout')) { logout(); return; }
        const chpw = e.target.closest && e.target.closest('.gs-acc-chpw');
        if (chpw) {
            const panel = document.getElementById('gs-chpw-form');
            if (panel) panel.hidden = !panel.hidden;
        }
    });
    document.addEventListener('submit', async e => {
        if (e.target.id !== 'gs-chpw-form') return;
        e.preventDefault();
        const btn = e.target.querySelector('.gs-auth-submit');
        if (btn) btn.disabled = true;
        try { await doChangePassword(e.target); }
        catch (err) { console.error('Account error:', err); setMsg(e.target, MSG.unexpected()); }
        finally { if (btn) btn.disabled = false; }
    });

    // ---------- تهيئة ----------
    (function init() {
        const id = activeProfileId();
        if (id && SS()) {
            ensureProfile(id, getAccounts()[id].name);
            SS().switchProfile(id);
        }
        // دخول/خروج من تبويب آخر ← تحديث هذا التبويب
        window.addEventListener('storage', e => {
            if (e.key === SES_KEY || e.key === ACC_KEY) {
                const current = activeProfileId();
                if (current && SS()) SS().switchProfile(current);
                if (SS()) SS().renderStudentSpace();
            }
        });
    })();

    window.StudentAccount = { isLoggedIn, activeProfileId, renderGate, renderBar, logout };
})();
