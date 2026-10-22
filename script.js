// =====================================================
// Go SVT Maroc - script.js (الإصدار 2)
// =====================================================

const CONFIG = {
    MANIFEST_URL: 'content.json',
    FORMSPREE_URL: '',   // ضع رابط Formspree هنا، مثال: 'https://formspree.io/f/abcdwxyz'
    CONTACT_EMAIL: '',   // بريد احتياطي (اختياري)
    NEW_DAYS: 7          // عدد أيام ظهور شارة "جديد"
};

const SECTION_NAMES = {
    cours: { ar: 'الدروس', fr: 'Cours' },
    exercices: { ar: 'التمارين', fr: 'Exercices' },
    fiches: { ar: 'الملخصات', fr: 'Fiches' },
    documents: { ar: 'الوثائق', fr: 'Documents' },
    ressources: { ar: 'الموارد', fr: 'Ressources' },
    divers: { ar: 'متنوعات', fr: 'Divers' }
};
const SUBJECT_NAMES = { francais: 'Français', arabe: 'العربية' };
const FILE_ICONS = {
    pdf: '📕', doc: '📘', docx: '📘', ppt: '📙', pptx: '📙', xls: '📗', xlsx: '📗',
    jpg: '🖼️', jpeg: '🖼️', png: '🖼️', gif: '🖼️', webp: '🖼️',
    mp4: '🎬', mp3: '🎧', zip: '🗜️', rar: '🗜️'
};
const PREVIEWABLE = ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'webp'];

let currentLang = 'fr';
let manifestPromise = null;
let requestCounter = 0;
let fileDates = {};
let deferredInstallPrompt = null;
let searchTimer = null;

const t = (ar, fr) => (currentLang === 'ar' ? ar : fr);

// ---------- تخزين آمن ----------
const storage = {
    get(key) { try { return localStorage.getItem(key); } catch (e) { return null; } },
    set(key, value) { try { localStorage.setItem(key, value); } catch (e) { /* تجاهل */ } }
};

// ---------- أدوات ----------
function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, ch => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
}
function getExt(name) { const m = /\.([^./]+)$/.exec(name); return m ? m[1].toLowerCase() : ''; }
function getFileTitle(filename) { return filename.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' '); }
function getFileIcon(ext) { return FILE_ICONS[ext] || '📄'; }
function buildFileUrl(path) { return path.split('/').map(encodeURIComponent).join('/'); }
function isMobile() { return window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 768; }

function normalizeText(s) {
    return String(s).toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')   // é → e
        .replace(/[\u064B-\u065F\u0670]/g, '')              // حذف التشكيل
        .replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي')
        .replace(/[_\-./]+/g, ' ');
}

function trackEvent(kind, path) {
    if (window.goatcounter && typeof window.goatcounter.count === 'function') {
        window.goatcounter.count({ path: `${kind}${path}`, title: path.split('/').pop(), event: true });
    }
}

// ---------- قائمة الملفات ----------
function isContentFile(path) {
    const parts = path.split('/');
    return parts.length >= 3 && SECTION_NAMES[parts[1]] && !parts[parts.length - 1].startsWith('.');
}

function loadManifest() {
    if (!manifestPromise) {
        manifestPromise = fetch(`${CONFIG.MANIFEST_URL}?v=${Date.now()}`, { cache: 'no-store' })
            .then(response => {
                if (!response.ok) throw new Error(`content.json introuvable (${response.status})`);
                return response.json();
            })
            .then(paths => {
                const files = paths.filter(isContentFile);
                trackNewFiles(files);
                return files;
            })
            .catch(error => { manifestPromise = null; throw error; });
    }
    return manifestPromise;
}

// شارة "جديد": الملفات التي ظهرت منذ آخر زيارة
function trackNewFiles(files) {
    let seen = null;
    try { seen = JSON.parse(storage.get('gosvt-seen')); } catch (e) { seen = null; }
    const firstVisit = !seen || typeof seen !== 'object';
    const now = Date.now();
    const next = {};
    files.forEach(p => {
        next[p] = (!firstVisit && p in seen) ? seen[p] : (firstVisit ? 0 : now);
    });
    storage.set('gosvt-seen', JSON.stringify(next));
    fileDates = next;
}

function isNew(path) {
    const d = fileDates[path];
    return d && (Date.now() - d) < CONFIG.NEW_DAYS * 86400000;
}

function describePath(path) {
    const [type, subject, ...rest] = path.split('/').slice(1, -1);
    const labels = [];
    if (SECTION_NAMES[type]) labels.push(SECTION_NAMES[type][currentLang]);
    if (subject) labels.push(SUBJECT_NAMES[subject] || subject);
    return labels.concat(rest).join(' · ');
}

function renderCard(path, badgeText) {
    const fileName = path.split('/').pop();
    const ext = getExt(fileName);
    const safePath = escapeHtml(path);
    const newBadge = isNew(path) ? `<span class="new-badge">${t('جديد', 'Nouveau')}</span>` : '';
    const previewBtn = PREVIEWABLE.includes(ext)
        ? `<button type="button" class="preview-btn" data-path="${safePath}">👁️ ${t('معاينة', 'Aperçu')}</button>`
        : '';
    return `
        <div class="content-card">
            <span class="level-badge">${escapeHtml(badgeText)}</span>${newBadge}
            <div class="file-icon">${getFileIcon(ext)}</div>
            <h3>${escapeHtml(getFileTitle(fileName))}</h3>
            <p class="file-name">${escapeHtml(fileName)}</p>
            <div class="card-actions">
                ${previewBtn}
                <a href="${buildFileUrl(path)}" download class="download-btn" data-path="${safePath}">📥 ${t('تحميل', 'Télécharger')}</a>
            </div>
        </div>`;
}

// ---------- عرض الأقسام ----------
async function loadContentFromManifest(type, subject, level) {
    const container = document.getElementById(`${type}-content`);
    if (!container) return;

    const requestId = String(++requestCounter);
    container.dataset.requestId = requestId;
    const prefix = `/${type}/${subject}/${level}/`;

    try {
        const allFiles = await loadManifest();
        if (container.dataset.requestId !== requestId) return;

        const files = allFiles
            .filter(p => p.startsWith(prefix))
            .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

        if (files.length === 0) {
            container.innerHTML = `<p class="no-files">${t('لا توجد ملفات حالياً', 'Aucun fichier disponible pour le moment')}</p>`;
            return;
        }

        const count = `<p class="files-count">${files.length} ${t('ملف', 'fichier(s)')}</p>`;
        container.innerHTML = count + files.map(p => {
            const sub = p.slice(prefix.length).split('/').slice(0, -1).join(' / ');
            return renderCard(p, sub ? `${level} - ${sub}` : level);
        }).join('');
    } catch (error) {
        console.error('Error loading content:', error);
        if (container.dataset.requestId === requestId) {
            container.innerHTML = `<p class="error">${t('حدث خطأ أثناء تحميل المحتوى. حاول لاحقاً.', 'Erreur lors du chargement du contenu. Veuillez réessayer plus tard.')}<br><small style="opacity:.6">(${escapeHtml(error.message)})</small></p>`;
        }
    }
}

async function loadContent(type, subject, level) {
    const container = document.getElementById(`${type}-content`);
    if (!container) return;
    container.innerHTML = `<p class="loading">${t('جاري التحميل...', 'Chargement...')}</p>`;
    await loadContentFromManifest(type, subject, level);
}

function getSectionState(section) {
    const subjectBtn = section.querySelector('.tab-btn.active') || section.querySelector('.tab-btn');
    const levelBtn = section.querySelector('.level-tab-btn.active') || section.querySelector('.level-tab-btn');
    return {
        type: (subjectBtn && subjectBtn.dataset.type) || section.id,
        subject: subjectBtn ? subjectBtn.dataset.subject : 'francais',
        level: levelBtn ? levelBtn.dataset.level : 'TC'
    };
}

function loadSection(section) {
    if (!section.querySelector('.tab-btn, .level-tab-btn')) return;
    const { type, subject, level } = getSectionState(section);
    loadContent(type, subject, level);
}

function reloadAllSections() {
    document.querySelectorAll('.section').forEach(loadSection);
}

// ---------- البحث ----------
async function runSearch(query) {
    const results = document.getElementById('gs-search-results');
    if (!results) return;
    const words = normalizeText(query).split(/\s+/).filter(Boolean);

    if (words.length === 0) {
        results.innerHTML = `<p class="gs-search-hint">${t('اكتب اسم درس أو تمرين أو امتحان...', 'Tapez le nom d’un cours, d’un exercice ou d’un examen...')}</p>`;
        return;
    }
    try {
        const all = await loadManifest();
        const matches = all.filter(p => {
            const hay = normalizeText(p);
            return words.every(w => hay.includes(w));
        });
        if (matches.length === 0) {
            results.innerHTML = `<p class="gs-search-hint">${t('لا توجد نتائج', 'Aucun résultat')}</p>`;
            return;
        }
        const more = matches.length > 60
            ? `<p class="gs-search-hint">${t('دقّق البحث لعرض نتائج أخرى', 'Précisez la recherche pour voir plus de résultats')}</p>`
            : '';
        results.innerHTML = matches.slice(0, 60).map(p => renderCard(p, describePath(p))).join('') + more;
    } catch (error) {
        results.innerHTML = `<p class="gs-search-hint">${t('تعذر البحث حالياً', 'Recherche indisponible')}</p>`;
    }
}

function openSearch() {
    openModal('gs-search');
    const input = document.getElementById('gs-search-input');
    if (input) { input.focus(); runSearch(input.value); }
}

// ---------- المعاينة ----------
function openPreview(path) {
    const modal = document.getElementById('gs-preview');
    if (!modal) return;
    const url = buildFileUrl(path);
    const body = modal.querySelector('.gs-modal-body');
    modal.querySelector('.gs-modal-title').textContent = getFileTitle(path.split('/').pop());
    modal.querySelector('.gs-open-tab').href = url;

    if (getExt(path) === 'pdf') {
        const src = isMobile()
            ? `https://docs.google.com/viewer?embedded=true&url=${encodeURIComponent(location.origin + url)}`
            : url;
        body.innerHTML = `<iframe src="${src}" title="PDF"></iframe>`;
    } else {
        body.innerHTML = `<img src="${url}" alt="">`;
    }
    openModal('gs-preview');
    trackEvent('apercu', path);
}

// ---------- النوافذ ----------
function openModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.hidden = false;
    document.body.classList.add('gs-no-scroll');
}

function closeModal(modal) {
    if (!modal) return;
    modal.hidden = true;
    if (modal.id === 'gs-preview') modal.querySelector('.gs-modal-body').innerHTML = '';
    if (!document.querySelector('.gs-modal:not([hidden])')) document.body.classList.remove('gs-no-scroll');
}

// ---------- الواجهة الإضافية ----------
function buildUI() {
    const fab = document.createElement('div');
    fab.className = 'gs-fab-group';
    fab.innerHTML = `
        <button type="button" class="gs-fab" id="gs-install-btn" hidden>📲</button>
        <button type="button" class="gs-fab" id="gs-theme-btn">🌙</button>
        <button type="button" class="gs-fab" id="gs-search-btn">🔎</button>`;
    document.body.appendChild(fab);

    const search = document.createElement('div');
    search.className = 'gs-modal';
    search.id = 'gs-search';
    search.hidden = true;
    search.innerHTML = `
        <div class="gs-modal-box">
            <div class="gs-modal-head">
                <input type="search" id="gs-search-input" autocomplete="off">
                <button type="button" class="gs-close" aria-label="Fermer">✕</button>
            </div>
            <div id="gs-search-results"></div>
        </div>`;
    document.body.appendChild(search);

    const preview = document.createElement('div');
    preview.className = 'gs-modal';
    preview.id = 'gs-preview';
    preview.hidden = true;
    preview.innerHTML = `
        <div class="gs-modal-box">
            <div class="gs-modal-head">
                <h3 class="gs-modal-title"></h3>
                <a class="gs-open-tab" target="_blank" rel="noopener"></a>
                <button type="button" class="gs-close" aria-label="Fermer">✕</button>
            </div>
            <div class="gs-modal-body"></div>
        </div>`;
    document.body.appendChild(preview);

    document.getElementById('gs-search-btn').addEventListener('click', openSearch);
    document.getElementById('gs-theme-btn').addEventListener('click', () => {
        const dark = !document.documentElement.classList.contains('gs-dark');
        applyTheme(dark);
        storage.set('gosvt-theme', dark ? 'dark' : 'light');
    });

    const installBtn = document.getElementById('gs-install-btn');
    installBtn.hidden = !deferredInstallPrompt;
    installBtn.addEventListener('click', async () => {
        if (!deferredInstallPrompt) return;
        deferredInstallPrompt.prompt();
        await deferredInstallPrompt.userChoice;
        deferredInstallPrompt = null;
        installBtn.hidden = true;
    });

    document.getElementById('gs-search-input').addEventListener('input', function () {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => runSearch(this.value), 150);
    });

    refreshUiTexts();
}

function refreshUiTexts() {
    const label = (id, text) => {
        const el = document.getElementById(id);
        if (el) { el.title = text; el.setAttribute('aria-label', text); }
    };
    label('gs-search-btn', t('بحث', 'Rechercher'));
    label('gs-theme-btn', t('الوضع الليلي', 'Mode sombre'));
    label('gs-install-btn', t('تثبيت التطبيق', 'Installer l’application'));

    const input = document.getElementById('gs-search-input');
    if (input) input.placeholder = t('ابحث عن درس، تمرين، امتحان...', 'Rechercher un cours, exercice, examen...');

    const openTab = document.querySelector('#gs-preview .gs-open-tab');
    if (openTab) openTab.textContent = t('فتح في نافذة جديدة ↗', 'Ouvrir dans un nouvel onglet ↗');
}

function applyTheme(dark) {
    document.documentElement.classList.toggle('gs-dark', dark);
    const btn = document.getElementById('gs-theme-btn');
    if (btn) btn.textContent = dark ? '☀️' : '🌙';
}

// ---------- اللغة ----------
function detectInitialLang() {
    const btn = document.getElementById('lang-btn-text');
    if (btn) return btn.textContent.trim() === 'Français' ? 'ar' : 'fr';
    return document.documentElement.getAttribute('dir') === 'rtl' ? 'ar' : 'fr';
}

function applyLanguage(lang) {
    currentLang = lang;
    document.documentElement.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
    document.documentElement.setAttribute('lang', lang);

    const langBtn = document.getElementById('lang-btn-text');
    if (langBtn) langBtn.textContent = lang === 'ar' ? 'Français' : 'العربية';

    document.querySelectorAll('[data-lang-ar]').forEach(element => {
        const text = element.getAttribute(lang === 'ar' ? 'data-lang-ar' : 'data-lang-fr');
        if (text) element.textContent = text;
    });

    document.title = lang === 'ar'
        ? 'Go SVT Maroc - مختبر علوم الحياة والأرض'
        : 'Go SVT Maroc - Laboratoire des Sciences de la Vie et de la Terre';

    refreshUiTexts();
}

function switchLanguage() {
    applyLanguage(currentLang === 'ar' ? 'fr' : 'ar');
    storage.set('gosvt-lang', currentLang);
    reloadAllSections();
    const search = document.getElementById('gs-search');
    if (search && !search.hidden) runSearch(document.getElementById('gs-search-input').value);
}

// ---------- التنقل ----------
function navigateTo(sectionId) {
    const target = document.getElementById(sectionId);
    if (!target) return;

    document.querySelectorAll('.section').forEach(section => section.classList.remove('active'));
    target.classList.add('active');

    document.querySelectorAll('.main-nav a').forEach(link => {
        link.classList.toggle('active', link.getAttribute('href') === '#' + sectionId);
    });

    const nav = document.querySelector('.main-nav');
    if (nav) nav.classList.remove('active');

    history.replaceState(null, '', '#' + sectionId);
    window.scrollTo(0, 0);
}

function toggleMobileMenu() {
    const nav = document.querySelector('.main-nav');
    if (nav) nav.classList.toggle('active');
}

function setupTabs() {
    document.querySelectorAll('.tab-btn, .level-tab-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            const group = this.classList.contains('tab-btn') ? '.tab-btn' : '.level-tab-btn';
            this.parentElement.querySelectorAll(group).forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            const section = this.closest('.section');
            if (section) loadSection(section);
        });
    });
}

function setupNavigation() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const id = this.getAttribute('href').substring(1);
            if (id && document.getElementById(id)) {
                e.preventDefault();
                navigateTo(id);
            }
        });
    });
}

// ---------- نموذج الاتصال ----------
function setupContactForm() {
    const form = document.getElementById('contactForm');
    if (!form) return;

    form.addEventListener('submit', async function (e) {
        e.preventDefault();
        const val = id => ((document.getElementById(id) || {}).value || '').trim();
        const data = { name: val('name'), email: val('email'), subject: val('subject'), message: val('message') };

        if (!CONFIG.FORMSPREE_URL) {
            if (CONFIG.CONTACT_EMAIL) {
                const body = `${data.message}\n\n${data.name} - ${data.email}`;
                window.location.href = `mailto:${CONFIG.CONTACT_EMAIL}?subject=${encodeURIComponent(data.subject || 'Go SVT Maroc')}&body=${encodeURIComponent(body)}`;
            } else {
                alert(t('خدمة المراسلة غير مفعّلة حالياً.', "Le formulaire de contact n'est pas encore activé."));
            }
            return;
        }

        const submitBtn = this.querySelector('[type="submit"]');
        if (submitBtn) submitBtn.disabled = true;
        try {
            const response = await fetch(CONFIG.FORMSPREE_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!response.ok) throw new Error('Formspree error');
            alert(t('شكراً لك! تم إرسال رسالتك بنجاح.', 'Merci ! Votre message a été envoyé avec succès.'));
            this.reset();
        } catch (error) {
            alert(t('تعذر إرسال الرسالة، حاول مرة أخرى.', "Impossible d'envoyer le message, veuillez réessayer."));
        } finally {
            if (submitBtn) submitBtn.disabled = false;
        }
    });
}

// ---------- أحداث عامة ----------
document.addEventListener('click', e => {
    const previewBtn = e.target.closest('.preview-btn');
    if (previewBtn) { openPreview(previewBtn.dataset.path); return; }

    const downloadBtn = e.target.closest('.download-btn[data-path]');
    if (downloadBtn) { trackEvent('telechargement', downloadBtn.dataset.path); return; }

    const closeBtn = e.target.closest('.gs-close');
    if (closeBtn) { closeModal(closeBtn.closest('.gs-modal')); return; }

    if (e.target.classList && e.target.classList.contains('gs-modal')) closeModal(e.target);
});

document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
        const open = document.querySelectorAll('.gs-modal:not([hidden])');
        if (open.length) closeModal(open[open.length - 1]);
        return;
    }
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement || {}).tagName);
    if ((e.key === '/' && !typing) || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k')) {
        e.preventDefault();
        openSearch();
    }
});

// ---------- التطبيق (PWA) ----------
window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredInstallPrompt = e;
    const btn = document.getElementById('gs-install-btn');
    if (btn) btn.hidden = false;
});
window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    const btn = document.getElementById('gs-install-btn');
    if (btn) btn.hidden = true;
});
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(err => console.warn('SW:', err));
    });
}

// ---------- التشغيل ----------
document.addEventListener('DOMContentLoaded', function () {
    currentLang = detectInitialLang();
    const savedLang = storage.get('gosvt-lang');
    if ((savedLang === 'ar' || savedLang === 'fr') && savedLang !== currentLang) applyLanguage(savedLang);

    buildUI();
    applyTheme(storage.get('gosvt-theme') === 'dark');
    setupTabs();
    setupNavigation();
    setupContactForm();

    const initial = location.hash.substring(1);
    const target = initial && document.getElementById(initial);
    if (target && target.classList.contains('section')) navigateTo(initial);

    reloadAllSections();
});
