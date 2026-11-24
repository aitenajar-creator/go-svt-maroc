// =====================================================
// Go SVT Maroc - features.js (الدفعة 2)
// يُحمَّل بعد script.js ويضيف: الامتحانات، آخر الإضافات، أقسام الملفات
// =====================================================

SECTION_NAMES.examens = { ar: 'الامتحانات', fr: 'Examens' };

const FOLDER_SECTIONS = ['documents', 'ressources', 'divers'];
const EXAM_KEYWORDS = /examen|national|regional|امتحان|وطني|جهوي/;
const LATEST_COUNT = 8;

// ---------- تواريخ الإضافة (dates.json، اختياري) ----------
let datesPromise = null;
let fileAddedDates = null;

function loadDates() {
    if (!datesPromise) {
        datesPromise = fetch('dates.json', { cache: 'no-cache' })
            .then(r => (r.ok ? r.json() : null))
            .catch(() => null)
            .then(data => {
                fileAddedDates = data && typeof data === 'object' ? data : null;
                return fileAddedDates;
            });
    }
    return datesPromise;
}

const baseLoadManifest = loadManifest;
loadManifest = function () {
    return Promise.all([baseLoadManifest(), loadDates()]).then(([files]) => files);
};

// شارة "جديد" بتواريخ حقيقية إن توفرت
const baseIsNew = isNew;
isNew = function (path) {
    if (fileAddedDates) {
        const ts = fileAddedDates[path];
        return Boolean(ts) && (Date.now() / 1000 - ts) < CONFIG.NEW_DAYS * 86400;
    }
    return baseIsNew(path);
};

// ---------- أدوات العرض ----------
const emptyHtml = () => `<p class="no-files">${t('لا توجد ملفات حالياً', 'Aucun fichier disponible pour le moment')}</p>`;
const sortPaths = list => list.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

async function renderInto(container, buildHtml) {
    const requestId = String(++requestCounter);
    container.dataset.requestId = requestId;
    container.innerHTML = `<p class="loading">${t('جاري التحميل...', 'Chargement...')}</p>`;
    try {
        const files = await loadManifest();
        if (container.dataset.requestId !== requestId) return;
        container.innerHTML = buildHtml(files);
        if (container.id === 'examens-content' && typeof addExamLibraryFilters === 'function') {
            let prefixes = [];
            try { prefixes = JSON.parse(container.dataset.examPathPrefixes || '[]'); } catch (_) {}
            const subjectLevelFiles = files.filter(path => prefixes.some(prefix => path.startsWith(prefix)) &&
                (path.startsWith(prefixes[0]) || EXAM_KEYWORDS.test(normalizeText(path.slice(prefixes[1].length)))));
            addExamLibraryFilters(container, subjectLevelFiles);
        }
    } catch (error) {
        console.error('Error loading content:', error);
        if (container.dataset.requestId === requestId) {
            container.innerHTML = `<p class="error">${t('حدث خطأ أثناء تحميل المحتوى. حاول لاحقاً.', 'Erreur lors du chargement du contenu. Veuillez réessayer plus tard.')}<br><small style="opacity:.6">(${escapeHtml(error.message)})</small></p>`;
        }
    }
}

// ---------- الامتحانات ----------
function examInfo(relPath) {
    const text = normalizeText(relPath);
    const yearMatch = /(?:^|\D)((?:19|20)\d{2})(?!\d)/.exec(text);
    let session = '';
    if (/rattrapage|استدراك/.test(text)) session = t('استدراكية', 'Rattrapage');
    else if (/normale|normal|ordinaire|عادي/.test(text)) session = t('عادية', 'Normale');
        let kind = '';
    if (/corrig|correction|تصحيح|عناصر الاجابة|اجوبة|اجابات/.test(text)) kind = t('التصحيح', 'Corrigé');
    else if (/sujet|موضوع/.test(text)) kind = t('الموضوع', 'Sujet');
    return { year: yearMatch ? yearMatch[1] : '', session, kind };
}

function loadExams(container, subject, level) {
    const inExamens = `/examens/${subject}/${level}/`;
    const inExercices = `/exercices/${subject}/${level}/`;
    container.dataset.examPathPrefixes = JSON.stringify([inExamens, inExercices]);

    renderInto(container, files => {
        const exams = files.filter(p => p.startsWith(inExamens) ||
            (p.startsWith(inExercices) && EXAM_KEYWORDS.test(normalizeText(p.slice(inExercices.length)))));
        if (!exams.length) return emptyHtml();

        const groups = {};
        exams.forEach(p => {
            const rel = p.startsWith(inExamens) ? p.slice(inExamens.length) : p.slice(inExercices.length);
            const { year, session, kind } = examInfo(rel);
            const sessionKey = /rattrapage|استدراكية/i.test(session) ? 'rattrapage'
                : /normale|عادية/i.test(session) ? 'normal' : 'other';
            const kindKey = /corrig|correction|تصحيح|عناصر الاجابة|اجوبة|اجابات/i.test(normalizeText(rel)) ? 'correction'
                : /sujet|موضوع/i.test(normalizeText(rel)) ? 'subject' : 'other';
            const parts = rel.split('/');
            const detectedTrack = window.GoSVTPathways &&
                typeof window.GoSVTPathways.trackOfPath === 'function'
                ? window.GoSVTPathways.trackOfPath(p, level) : null;
            // السنة والدورة ونوع الوثيقة معروضة في عناوين المجموعات؛
            // نُبقي الشارة مختصرة لتمييز المسلك فقط دون تكرار المعلومات.
            const badge = detectedTrack || (parts.length > 1 ? parts[0] : level);
            groups[year] = groups[year] || { normal: [], rattrapage: [], other: [] };
            groups[year][sessionKey].push({ path: p, badge, kindKey });
        });

        const years = Object.keys(groups).sort((a, b) => (b || '0').localeCompare(a || '0'));
        const sessionLabels = {
            normal: t('الدورة العادية', 'Session normale'),
            rattrapage: t('الدورة الاستدراكية', 'Session de rattrapage'),
            other: t('دورة غير محددة', 'Session non précisée')
        };
        const count = `<p class="files-count">${exams.length} ${t('امتحان', 'examen(s)')}</p>`;

        return count + years.map(year => {
            const title = year || t('سنوات أخرى', 'Autres années');
            const sessions = ['normal', 'rattrapage', 'other'].map(key => {
                const items = groups[year][key];
                if (!items.length) return '';

                const kindOf = item => item.kindKey || 'other';
                const kindLabels = {
                    subject: t('مواضيع الامتحان', 'Sujets d’examen'),
                    correction: t('التصحيحات وعناصر الإجابة', 'Corrigés et éléments de réponse'),
                    other: t('موارد امتحانية أخرى', 'Autres ressources d’examen')
                };
                const kinds = { subject: [], correction: [], other: [] };
                items.forEach(item => kinds[kindOf(item)].push(item));
                const populatedKinds = ['subject', 'correction', 'other'].filter(kind => kinds[kind].length);
                const showKindTitles = populatedKinds.length > 1;
                const content = populatedKinds.map(kind => {
                    const cards = kinds[kind]
                        .sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true }))
                        .map(item => renderCard(item.path, item.badge)).join('');
                    return (showKindTitles
                        ? `<h5 class="gs-exam-kind-title">${kindLabels[kind]}</h5>` : '') + cards;
                }).join('');
                return `<h4 class="gs-exam-session-title">${sessionLabels[key]}</h4>${content}`;
            }).join('');
            return `<h3 class="gs-group-title">📅 ${escapeHtml(title)}</h3>${sessions}`;
        }).join('');
    });
}

// ---------- أقسام Documents / Ressources / Divers ----------
function loadFolderSection(container, type) {
    const prefix = `/${type}/`;
    renderInto(container, files => {
        const list = sortPaths(files.filter(p => p.startsWith(prefix)));
        if (!list.length) return emptyHtml();
        return `<p class="files-count">${list.length} ${t('ملف', 'fichier(s)')}</p>` + list.map(p => {
            const sub = p.slice(prefix.length).split('/').slice(0, -1)
                .map(s => SUBJECT_NAMES[s] || s).join(' · ');
            return renderCard(p, sub || SECTION_NAMES[type][currentLang]);
        }).join('');
    });
}

// ---------- آخر الإضافات ----------
function loadLatest(container) {
    const block = document.getElementById('latest');
    renderInto(container, files => {
        if (!fileAddedDates) {
            if (block) block.hidden = true;
            return '';
        }
        const list = files.filter(p => fileAddedDates[p])
            .sort((a, b) => fileAddedDates[b] - fileAddedDates[a])
            .slice(0, LATEST_COUNT);
        if (block) block.hidden = list.length === 0;

        const fmt = new Intl.DateTimeFormat(currentLang === 'ar' ? 'ar-MA' : 'fr-FR',
            { day: 'numeric', month: 'long', year: 'numeric' });
        return list.map(p => renderCard(p, `${describePath(p)} · ${fmt.format(fileAddedDates[p] * 1000)}`)).join('');
    });
}

// ---------- توجيه كل قسم إلى طريقة العرض المناسبة ----------
const baseLoadSection = loadSection;
loadSection = function (section) {
    const id = section.id;
    if (id === 'accueil') {
        const c = document.getElementById('latest-content');
        if (c) loadLatest(c);
    } else if (id === 'examens') {
        const c = document.getElementById('examens-content');
        const { subject, level } = getSectionState(section);
        if (c) loadExams(c, subject, level);
    } else if (FOLDER_SECTIONS.includes(id)) {
        const c = document.getElementById(`${id}-content`);
        if (c) loadFolderSection(c, id);
    } else {
        baseLoadSection(section);
    }
};

// ---------- روابط المستويات في التذييل ----------
document.addEventListener('click', e => {
    const link = e.target.closest('[data-goto-level]');
    if (!link) return;
    const btn = document.querySelector(`#cours .level-tab-btn[data-level="${link.dataset.gotoLevel}"]`);
    if (btn) btn.click();
});

// ---------- سنة حقوق النشر ----------
document.addEventListener('DOMContentLoaded', () => {
    const year = document.getElementById('gs-year');
    if (year) year.textContent = new Date().getFullYear();
});
// ===== الدفعة 3: قائمة الهاتف + الوضع الليلي =====

// إغلاق قائمة الهاتف عند النقر خارجها
document.addEventListener('click', e => {
    const nav = document.querySelector('.main-nav');
    if (!nav || !nav.classList.contains('active')) return;
    if (e.target.closest('.main-nav, .mobile-menu-btn')) return;
    nav.classList.remove('active');
});

// إغلاق قائمة الهاتف بزر Escape
document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    const nav = document.querySelector('.main-nav');
    if (nav) nav.classList.remove('active');
});

// تغيير لون شريط المتصفح على الهاتف حسب الوضع
const baseApplyTheme = applyTheme;
applyTheme = function (dark) {
    baseApplyTheme(dark);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', dark ? '#1a3a1b' : '#2d5a27');
};

// تفعيل الوضع الليلي تلقائياً إذا كان هاتف/حاسوب الزائر في الوضع الليلي
document.addEventListener('DOMContentLoaded', () => {
    if (!storage.get('gosvt-theme') && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        applyTheme(true);
    }
});
// ===== فصل الجذاذات عن الملخصات =====
SECTION_NAMES.fiches = { ar: 'الجذاذات', fr: 'Fiches pédagogiques' };
SECTION_NAMES.resumes = { ar: 'الملخصات', fr: 'Résumés' };

// ===== إخفاء ملفات README =====
const baseIsContentFile = isContentFile;
isContentFile = function (path) {
    const name = path.split('/').pop().toLowerCase();
    if (/^readme(\.|$)/.test(name)) return false;
    return baseIsContentFile(path);
};
// ===== قائمة "المزيد" المنسدلة =====
function closeNavMore(except) {
    document.querySelectorAll('.nav-more.open').forEach(menu => {
        if (menu === except) return;
        menu.classList.remove('open');
        const b = menu.querySelector('.nav-more-btn');
        if (b) b.setAttribute('aria-expanded', 'false');
    });
}

document.addEventListener('click', e => {
    const btn = e.target.closest('.nav-more-btn');
    if (!btn) { closeNavMore(null); return; }   // نقرة خارج الزر أو اختيار قسم: إغلاق
    const menu = btn.closest('.nav-more');
    closeNavMore(menu);
    const open = menu.classList.toggle('open');
    btn.setAttribute('aria-expanded', String(open));
});

document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeNavMore(null);
});
