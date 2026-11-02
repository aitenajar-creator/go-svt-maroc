// =====================================================
// Go SVT Maroc - pathways.js (المرحلة 2)
// 🧭 المسارات التعليمية: اللغة ← المستوى ← الشعبة
// -----------------------------------------------------
// - يضيف صف أزرار "الشعبة" تحت أزرار المستوى في أقسام:
//   الدروس، الملخصات، التمارين، الامتحانات، الاختبارات.
// - "الكل" (الافتراضي) = السلوك القديم دون أي تغيير.
// - لا يغيّر أي ملف ولا أي بيانات؛ يلتفّ فقط حول دوال script.js / learn.js.
// =====================================================
(function () {
    'use strict';

    const SECTIONS = ['cours', 'resumes', 'exercices', 'examens', 'quiz'];
    const TRACKS = {
        TC: ['TCS', 'TCL'],
        '1BAC': ['1BACSE', '1BACSM', '1BACL'],
        '2BAC': ['2BACSVT', '2BACSP', '2BACSM']
    };
    const ALL_CODES = Object.keys(TRACKS).reduce((a, k) => a.concat(TRACKS[k]), []);
    const STATE_KEY = 'gosvt-tracks';

    // ---------- الحالة (الشعبة المختارة لكل قسم) ----------
    function readState() {
        try { const v = JSON.parse(storage.get(STATE_KEY)); return v && typeof v === 'object' ? v : {}; } catch (e) { return {}; }
    }
    let state = readState();

    function trackFor(sectionId, level) {
        const v = state[sectionId];
        return v && TRACKS[level] && TRACKS[level].includes(v) ? v : 'all';
    }
    function setTrack(sectionId, track) {
        state = readState();               // يحافظ على ما كتبته تبويبات أخرى
        if (track && track !== 'all') state[sectionId] = track; else delete state[sectionId];
        storage.set(STATE_KEY, JSON.stringify(state));
    }

    // ---------- مطابقة مسار ملف مع شعبة ----------
    // يبحث في أسماء المجلدات بعد المستوى عن رمز شعبة (بعد حذف المسافات):
    // "1BACSE" ← 1BACSE ، "2BAC SM" ← 2BACSM (مجلدات الامتحانات)
    function trackOfPath(path, level) {
        const dirs = path.split('/').filter(Boolean).slice(3, -1);
        for (const d of dirs) {
            const code = d.replace(/\s+/g, '').toUpperCase();
            if (ALL_CODES.includes(code) && code.startsWith(level)) return code;
        }
        return null;                       // ملف في جذر المستوى بلا شعبة
    }

    // هل الملف ضمن نطاق (القسم/اللغة/المستوى)؟ قسم الامتحانات يضمّ أيضًا ملفات
    // exercices/ التي تحتوي أسماؤها كلمات الامتحان (نفس منطق features.js:loadExams).
    function inScope(path, type, lang, level) {
        if (path.startsWith(`/${type}/${lang}/${level}/`)) return true;
        if (type === 'examens') {
            const pre = `/exercices/${lang}/${level}/`;
            return path.startsWith(pre) && EXAM_KEYWORDS.test(normalizeText(path.slice(pre.length)));
        }
        return false;
    }

    // الملفات بلا شعبة (جذر المستوى) تظهر في كل شعب المستوى
    function matches(path, type, lang, level, track) {
        if (!inScope(path, type, lang, level)) return false;
        if (!track || track === 'all') return true;
        const own = trackOfPath(path, level);
        return own === null || own === track;
    }

    // ---------- قائمة الملفات (لعدّ الملفات الحقيقية في الأزرار) ----------
    let files = null;
    let rawPromise = null;
    function loadRaw() {
        if (!rawPromise) {
            rawPromise = fetch(`${CONFIG.MANIFEST_URL}?pw=${Date.now()}`, { cache: 'no-store' })
                .then(r => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
                .catch(err => { rawPromise = null; throw err; });
        }
        return rawPromise;
    }
    function isVisible(path, type) {
        if (type === 'quiz') return path.startsWith('/quiz/') && /\.json$/i.test(path);
        return isContentFile(path);        // يستبعد README والملفات المخفية
    }
    function count(type, lang, level, track) {
        return files.filter(p => isVisible(p, type) && matches(p, type, lang, level, track)).length;
    }

    // ---------- واجهة أزرار الشعبة ----------
    function ensureBar(section) {
        let bar = section.querySelector('.gs-track-tabs');
        if (!bar) {
            const anchor = section.querySelector('.level-tabs');
            if (!anchor) return null;
            bar = document.createElement('div');
            bar.className = 'gs-track-tabs';
            bar.setAttribute('role', 'group');
            anchor.after(bar);
            bar.addEventListener('click', e => {
                const btn = e.target.closest('.gs-track-btn');
                if (!btn) return;
                setTrack(section.id, btn.dataset.track);
                render(section);
                loadSection(section);
                writeHash(section);
            });
        }
        return bar;
    }

    function render(section) {
        const bar = ensureBar(section);
        if (!bar) return;
        const { subject, level } = getSectionState(section);
        const codes = TRACKS[level] || [];
        const current = trackFor(section.id, level);
        bar.setAttribute('aria-label', t('الشعبة', 'Filière'));
        bar.innerHTML = `<span class="gs-track-label">${t('الشعبة :', 'Filière :')}</span>` +
            [['all', t('الكل', 'Tout')]].concat(codes.map(c => [c, c])).map(([code, label]) => {
                const n = files ? count(section.id, subject, level, code) : null;
                const cls = ['gs-track-btn'];
                if (code === current) cls.push('active');
                if (n === 0) cls.push('is-empty');
                const title = n === 0 ? ` title="${t('لا توجد ملفات حالياً', 'Aucun fichier pour le moment')}"` : '';
                return `<button type="button" class="${cls.join(' ')}" data-track="${code}" aria-pressed="${code === current}"${title}>` +
                    `<bdi>${label}</bdi>${n === null ? '' : ` <span class="gs-track-n">(${n})</span>`}</button>`;
            }).join('');
    }

    function renderAll() {
        SECTIONS.forEach(id => { const s = document.getElementById(id); if (s) render(s); });
    }

    function writeHash(section) {
        if (!section.classList.contains('active')) return;
        const { subject, level } = getSectionState(section);
        const track = trackFor(section.id, level);
        history.replaceState(null, '', `#${section.id}/${subject}/${level}${track === 'all' ? '' : '/' + track}`);
    }

    // ---------- التصفية: الدروس / الملخصات / التمارين / الامتحانات ----------
    // loadContentFromManifest و loadExams يستدعيان loadManifest() بشكل متزامن في بدايتهما،
    // لذلك نستبدلها لحظةً واحدة بنسخة مصفّاة ثم نعيدها فورًا (البحث لا يتأثر).
    function runFiltered(fn, self, args, type, subject, level) {
        const track = trackFor(type, level);
        if (track === 'all') return fn.apply(self, args);
        const prevLoadManifest = loadManifest;
        loadManifest = () => prevLoadManifest().then(list => list.filter(p => matches(p, type, subject, level, track)));
        try {
            return fn.apply(self, args);
        } finally {
            loadManifest = prevLoadManifest;
        }
    }
    const prevLoadFromManifest = loadContentFromManifest;
    loadContentFromManifest = function (type, subject, level) {
        return SECTIONS.includes(type) && type !== 'quiz'
            ? runFiltered(prevLoadFromManifest, this, arguments, type, subject, level)
            : prevLoadFromManifest.apply(this, arguments);
    };
    const prevLoadExams = loadExams;
    loadExams = function (container, subject, level) {
        return runFiltered(prevLoadExams, this, arguments, 'examens', subject, level);
    };

    // وسم "تصحيح" لملفات مجلدات Correction (الامتحانات)
    const prevRenderCard = renderCard;
    renderCard = function (path, badgeText) {
        const html = prevRenderCard(path, badgeText);
        if (!/\/correction\//i.test(path)) return html;
        return html.replace('<h3>', `<span class="gs-doc-tag">✔ ${t('تصحيح', 'Correction')}</span><h3>`);
    };

    // ---------- التصفية: الاختبارات ----------
    // learn.js يرسم القائمة بنفسه؛ نصفّي البطاقات فور رسمها (قبل أن يراها المستخدم).
    function filterQuiz() {
        const box = document.getElementById('quiz-content');
        const section = document.getElementById('quiz');
        if (!box || !section) return;
        const { subject, level } = getSectionState(section);
        const track = trackFor('quiz', level);
        if (track === 'all') return;
        const cards = Array.from(box.querySelectorAll('.gs-quiz-card'));
        if (!cards.length) return;
        let kept = 0;
        cards.forEach(card => {
            const start = card.querySelector('.gs-quiz-start');
            const path = start ? start.dataset.path : '';
            if (path && matches(path, 'quiz', subject, level, track)) kept++; else card.remove();
        });
        if (kept === 0) {
            box.innerHTML = `<p class="no-files">${t('لا توجد اختبارات حالياً لهذه الشعبة', 'Aucun quiz pour cette filière pour le moment')}</p>`;
        } else {
            const counter = box.querySelector('.files-count');
            const text = `${kept} ${t('اختبار', 'quiz')}`;
            if (counter && counter.textContent !== text) counter.textContent = text;
        }
    }

    // ---------- أحداث ----------
    // مرحلة الالتقاط: نُحدّث الحالة قبل أن تبدأ معالجات التبويبات تحميل المحتوى
    document.addEventListener('click', e => {
        const levelBtn = e.target.closest && e.target.closest('.level-tab-btn');
        if (levelBtn) {
            const section = levelBtn.closest('.section');
            if (section && SECTIONS.includes(section.id)) {
                if (trackFor(section.id, levelBtn.dataset.level) === 'all') setTrack(section.id, 'all');
                setTimeout(() => { render(section); writeHash(section); }, 0);
            }
            return;
        }
        const langBtn = e.target.closest && e.target.closest('.tab-btn');
        if (langBtn) {
            const section = langBtn.closest('.section');
            if (section && SECTIONS.includes(section.id)) setTimeout(() => { render(section); writeHash(section); }, 0);
            return;
        }
        // شريط "نفس المستوى": ننقل الشعبة المختارة إلى القسم الهدف
        const related = e.target.closest && e.target.closest('.gs-related a');
        if (related) {
            const from = related.closest('.section');
            const target = document.getElementById((related.getAttribute('href') || '').slice(1));
            if (from && target && SECTIONS.includes(from.id) && SECTIONS.includes(target.id)) {
                const cur = trackFor(from.id, getSectionState(from).level);
                if (cur !== 'all' && TRACKS[related.dataset.level] && TRACKS[related.dataset.level].includes(cur)) setTrack(target.id, cur);
            }
        }
    }, true);

    // ---------- التهيئة ----------
    (function init() {
        // رابط مباشر: #cours/francais/1BAC/1BACSE
        const m = /^#([\w-]+)\/([\w-]+)\/([\w-]+)\/([\w-]+)$/.exec(location.hash);
        const target = m && document.getElementById(m[1]);
        if (target && SECTIONS.includes(target.id) && target.classList.contains('section')) {
            const pick = (selector, attr, value) => {
                const btn = target.querySelector(`${selector}[${attr}="${CSS.escape(value)}"]`);
                if (!btn) return false;
                target.querySelectorAll(selector).forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                return true;
            };
            pick('.tab-btn', 'data-subject', m[2]);
            if (pick('.level-tab-btn', 'data-level', m[3]) && TRACKS[m[3]] && TRACKS[m[3]].includes(m[4])) setTrack(target.id, m[4]);
            history.replaceState(null, '', '#' + m[1]);
        }

        renderAll();

        loadRaw().then(list => { files = list; renderAll(); }).catch(err => console.warn('pathways:', err));

        // تغيّر اللغة ← إعادة رسم النصوص والأعداد
        new MutationObserver(renderAll).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });

        // عند فتح قسم ← تحديث الأزرار (تغيّر المستوى/اللغة من روابط أخرى)
        SECTIONS.forEach(id => {
            const s = document.getElementById(id);
            if (s) new MutationObserver(() => { if (s.classList.contains('active')) render(s); }).observe(s, { attributes: true, attributeFilter: ['class'] });
        });

        const quizBox = document.getElementById('quiz-content');
        if (quizBox) new MutationObserver(filterQuiz).observe(quizBox, { childList: true });
    })();

    window.GoSVTPathways = { TRACKS, matches, trackFor, trackOfPath };
})();
