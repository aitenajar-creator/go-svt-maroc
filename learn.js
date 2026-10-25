// =====================================================
// Go SVT Maroc - learn.js (الدفعة 5)
// ❓ الاختبارات التفاعلية + 🎥 فيديوهات الشرح
// =====================================================
(function () {
    'use strict';

    SECTION_NAMES.quiz = { ar: 'الاختبارات', fr: 'Quiz' };

    // ملفات الاختبارات لا تظهر كبطاقات تحميل
    const prevIsContentFile = isContentFile;
    isContentFile = function (path) {
        return path.startsWith('/quiz/') ? false : prevIsContentFile(path);
    };

    function readObject(key) {
        try { const v = JSON.parse(storage.get(key)); return v && typeof v === 'object' ? v : {}; } catch (e) { return {}; }
    }
    const fileTitle = path => getFileTitle(path.split('/').pop());
    const nfc = s => String(s).normalize('NFC').trim();

    // =============== 🎥 الفيديوهات ===============
    let videoMap = {};
    let videosPromise = null;

    function youtubeId(value) {
        const s = String(value || '').trim();
        if (/^[\w-]{11}$/.test(s)) return s;
        const m = /(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/|\/live\/)([\w-]{11})/.exec(s);
        return m ? m[1] : '';
    }

    function loadVideos() {
        if (!videosPromise) {
            videosPromise = fetch(`videos.json?v=${Date.now()}`, { cache: 'no-store' })
                .then(r => (r.ok ? r.json() : {}))
                .catch(err => { console.warn('videos.json :', err); return {}; })
                .then(data => {
                    videoMap = {};
                    if (data && typeof data === 'object') {
                        Object.keys(data).forEach(key => {
                            const ids = [].concat(data[key]).map(youtubeId).filter(Boolean);
                            if (ids.length) videoMap[nfc(key)] = ids;
                        });
                    }
                    return videoMap;
                });
        }
        return videosPromise;
    }

    function videosFor(path) {
        const p = nfc(path);
        const name = p.split('/').pop();
        return videoMap[p] || videoMap[name] || videoMap[name.replace(/\.[^.]+$/, '')] || [];
    }

    const prevLoadManifest = loadManifest;
    loadManifest = function () {
        return Promise.all([prevLoadManifest(), loadVideos()]).then(([files]) => files);
    };

    const prevRenderCard = renderCard;
    renderCard = function (path, badgeText) {
        const html = prevRenderCard(path, badgeText);
        if (!videosFor(path).length) return html;
        const btn = `<button type="button" class="gs-video-btn" data-path="${escapeHtml(path)}">🎥 ${t('فيديو الشرح', 'Vidéo')}</button>`;
        return html.replace('<div class="card-actions">', '<div class="card-actions">' + btn);
    };

    function openVideo(path, index) {
        const modal = document.getElementById('gs-preview');
        const ids = videosFor(path);
        if (!modal || !ids.length) return;
        const i = Math.min(Math.max(index || 0, 0), ids.length - 1);
        modal.querySelector('.gs-modal-title').textContent = `🎥 ${fileTitle(path)}`;
        modal.querySelector('.gs-open-tab').href = `https://www.youtube.com/watch?v=${ids[i]}`;
        const parts = ids.length > 1
            ? `<div class="gs-video-parts">${ids.map((id, n) =>
                `<button type="button" class="gs-video-part${n === i ? ' active' : ''}" data-path="${escapeHtml(path)}" data-index="${n}">${t('الجزء', 'Partie')} ${n + 1}</button>`).join('')}</div>`
            : '';
        modal.querySelector('.gs-modal-body').innerHTML = parts +
            `<div class="gs-video-wrap"><iframe src="https://www.youtube-nocookie.com/embed/${ids[i]}?rel=0&autoplay=1" title="YouTube" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe></div>`;
        openModal('gs-preview');
        trackEvent('video', path);
    }

    // =============== ❓ الاختبارات ===============
    let quizListPromise = null;
    const quizCache = {};
    let quizState = null;

    function loadQuizList() {
        if (!quizListPromise) {
            quizListPromise = fetch(`${CONFIG.MANIFEST_URL}?q=${Date.now()}`, { cache: 'no-store' })
                .then(r => { if (!r.ok) throw new Error(`content.json (${r.status})`); return r.json(); })
                .then(paths => paths.filter(p => p.startsWith('/quiz/') && /\.json$/i.test(p)))
                .catch(err => { quizListPromise = null; throw err; });
        }
        return quizListPromise;
    }

    function validateQuiz(data) {
        const questions = (data && Array.isArray(data.questions) ? data.questions : [])
            .filter(q => q && q.question && Array.isArray(q.choix) && q.choix.length >= 2 &&
                Number.isInteger(q.reponse) && q.reponse >= 1 && q.reponse <= q.choix.length)
            .map(q => ({
                question: String(q.question),
                choix: q.choix.map(String),
                reponse: q.reponse - 1,
                explication: q.explication ? String(q.explication) : '',
                image: q.image ? String(q.image) : ''
            }));
        if (!questions.length) throw new Error('quiz vide ou mal formé');
        return { titre: String(data.titre || ''), description: String(data.description || ''), questions };
    }

    function loadQuiz(path) {
        if (!quizCache[path]) {
            quizCache[path] = fetch(buildFileUrl(path), { cache: 'no-cache' })
                .then(r => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
                .then(validateQuiz)
                .catch(err => { delete quizCache[path]; throw err; });
        }
        return quizCache[path];
    }

    function shuffle(list) {
        const a = list.slice();
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    async function renderQuizList(section) {
        const container = document.getElementById('quiz-content');
        if (!container) return;
        const { subject, level } = getSectionState(section);
        const prefix = `/quiz/${subject}/${level}/`;
        const requestId = String(++requestCounter);
        container.dataset.requestId = requestId;
        container.innerHTML = `<p class="loading">${t('جاري التحميل...', 'Chargement...')}</p>`;
        const empty = `<p class="no-files">${t('لا توجد اختبارات حالياً لهذا المستوى', 'Aucun quiz pour ce niveau pour le moment')}</p>`;

        try {
            const paths = (await loadQuizList())
                .filter(p => p.startsWith(prefix))
                .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
            const items = (await Promise.all(paths.map(p =>
                loadQuiz(p).then(quiz => ({ path: p, quiz })).catch(err => { console.warn(p, err); return null; })
            ))).filter(Boolean);
            if (container.dataset.requestId !== requestId) return;
            if (!items.length) { container.innerHTML = empty; return; }

            const scores = readObject('gosvt-quiz');
            container.innerHTML = `<p class="files-count">${items.length} ${t('اختبار', 'quiz')}</p>` + items.map(({ path, quiz }) => {
                const sub = path.slice(prefix.length).split('/').slice(0, -1).join(' / ');
                const sc = scores[path];
                const best = sc ? `<span class="gs-quiz-badge${sc.best >= 80 ? ' good' : ''}">🏅 ${sc.best}%</span>` : '';
                const desc = quiz.description ? `${escapeHtml(quiz.description)} · ` : '';
                return `
                    <div class="content-card gs-quiz-card">
                        <span class="level-badge">${escapeHtml(sub ? `${level} - ${sub}` : level)}</span>${best}
                        <div class="file-icon">❓</div>
                        <h3 dir="auto">${escapeHtml(quiz.titre || fileTitle(path))}</h3>
                        <p class="file-name" dir="auto">${desc}${quiz.questions.length} ${t('سؤال', 'questions')}</p>
                        <div class="card-actions">
                            <button type="button" class="gs-btn gs-btn-main gs-quiz-start" data-path="${escapeHtml(path)}">▶️ ${sc ? t('إعادة', 'Refaire') : t('ابدأ', 'Commencer')}</button>
                        </div>
                    </div>`;
            }).join('');
        } catch (error) {
            if (container.dataset.requestId === requestId) {
                container.innerHTML = `<p class="error">${t('تعذر تحميل الاختبارات.', 'Impossible de charger les quiz.')}<br><small style="opacity:.6">(${escapeHtml(error.message)})</small></p>`;
            }
        }
    }

    function buildQuizModal() {
        if (document.getElementById('gs-quiz-modal')) return;
        const modal = document.createElement('div');
        modal.className = 'gs-modal';
        modal.id = 'gs-quiz-modal';
        modal.hidden = true;
        modal.innerHTML = `
            <div class="gs-modal-box">
                <div class="gs-modal-head">
                    <h3 class="gs-modal-title"></h3>
                    <button type="button" class="gs-close" aria-label="Fermer">✕</button>
                </div>
                <div class="gs-quiz-body"></div>
            </div>`;
        document.body.appendChild(modal);
    }

    const quizModal = () => document.getElementById('gs-quiz-modal');
    const quizBody = () => document.querySelector('#gs-quiz-modal .gs-quiz-body');

    async function openQuiz(path) {
        const modal = quizModal();
        if (!modal) return;
        const title = modal.querySelector('.gs-modal-title');
        title.textContent = `❓ ${fileTitle(path)}`;
        quizBody().innerHTML = `<p class="loading">${t('جاري التحميل...', 'Chargement...')}</p>`;
        openModal('gs-quiz-modal');
        try {
            const quiz = await loadQuiz(path);
            if (quiz.titre) title.textContent = `❓ ${quiz.titre}`;
            quizState = { path, quiz, order: shuffle(quiz.questions.map((_, i) => i)), index: 0, score: 0, wrong: [], answered: false };
            renderQuestion();
        } catch (e) {
            quizBody().innerHTML = `<p class="error">${t('تعذر تحميل الاختبار.', 'Impossible de charger ce quiz.')} <small>(${escapeHtml(e.message)})</small></p>`;
        }
    }

    function renderQuestion() {
        const s = quizState;
        const total = s.order.length;
        const q = s.quiz.questions[s.order[s.index]];
        const image = q.image ? `<img class="gs-quiz-img" src="${escapeHtml(encodeURI(q.image))}" alt="">` : '';
        quizBody().innerHTML = `
            <div class="gs-quiz-progress"><span style="width:${Math.round(s.index / total * 100)}%"></span></div>
            <p class="gs-quiz-count">${t('السؤال', 'Question')} ${s.index + 1} / ${total}</p>
            <h4 class="gs-quiz-question" dir="auto">${escapeHtml(q.question)}</h4>
            ${image}
            <div class="gs-quiz-choices">
                ${q.choix.map((c, i) => `<button type="button" class="gs-quiz-choice" data-choice="${i}" dir="auto">${escapeHtml(c)}</button>`).join('')}
            </div>
            <div class="gs-quiz-feedback" dir="auto" hidden></div>
            <div class="gs-quiz-nav"><button type="button" class="gs-btn gs-btn-main gs-quiz-next" hidden></button></div>`;
    }

    function answer(choice) {
        const s = quizState;
        if (!s || s.answered) return;
        s.answered = true;
        const q = s.quiz.questions[s.order[s.index]];
        const ok = choice === q.reponse;
        if (ok) s.score++; else s.wrong.push({ q, choice });

        const body = quizBody();
        body.querySelectorAll('.gs-quiz-choice').forEach(b => {
            const i = Number(b.dataset.choice);
            b.disabled = true;
            if (i === q.reponse) b.classList.add('correct');
            else if (i === choice) b.classList.add('wrong');
        });
        const fb = body.querySelector('.gs-quiz-feedback');
        fb.hidden = false;
        fb.classList.add(ok ? 'ok' : 'ko');
        fb.innerHTML = `<strong>${ok ? t('✅ إجابة صحيحة!', '✅ Bonne réponse !') : t('❌ إجابة خاطئة', '❌ Mauvaise réponse')}</strong>` +
            (q.explication ? `<p>${escapeHtml(q.explication)}</p>` : '');
        const next = body.querySelector('.gs-quiz-next');
        next.hidden = false;
        next.textContent = s.index + 1 < s.order.length
            ? t('السؤال التالي ←', 'Question suivante →')
            : t('عرض النتيجة 🏁', 'Voir le résultat 🏁');
        next.focus();
    }

    function nextQuestion() {
        const s = quizState;
        if (!s) return;
        s.answered = false;
        s.index++;
        if (s.index < s.order.length) renderQuestion(); else renderResult();
    }

    function renderResult() {
        const s = quizState;
        const total = s.order.length;
        const pct = Math.round(s.score / total * 100);
        const scores = readObject('gosvt-quiz');
        const best = Math.max(pct, scores[s.path] ? scores[s.path].best : 0);
        scores[s.path] = { best, last: pct, date: Date.now() };
        storage.set('gosvt-quiz', JSON.stringify(scores));
        trackEvent('quiz', s.path);

        const msg = pct >= 80 ? t('🏆 ممتاز! أنت متمكن من هذا الدرس.', '🏆 Excellent ! Vous maîtrisez ce chapitre.')
            : pct >= 50 ? t('👍 جيد، راجع الأخطاء أسفله.', '👍 Bien ! Revoyez les erreurs ci-dessous.')
            : t('📚 راجع الدرس ثم أعد المحاولة.', '📚 Révisez le cours puis réessayez.');

        const review = s.wrong.length
            ? `<h4 class="gs-quiz-review-title">${t('تصحيح الأخطاء', 'Correction des erreurs')}</h4>` + s.wrong.map(({ q, choice }) => `
                <div class="gs-quiz-review" dir="auto">
                    <p><strong>${escapeHtml(q.question)}</strong></p>
                    <p class="ko">❌ ${escapeHtml(q.choix[choice])}</p>
                    <p class="ok">✅ ${escapeHtml(q.choix[q.reponse])}</p>
                    ${q.explication ? `<p class="gs-quiz-expl">${escapeHtml(q.explication)}</p>` : ''}
                </div>`).join('')
            : '';

        quizBody().innerHTML = `
            <div class="gs-quiz-result">
                <div class="gs-quiz-score">${s.score} / ${total}</div>
                <p class="gs-quiz-pct">${pct}%</p>
                <p>${msg}</p>
                <p class="gs-quiz-best">${t('أفضل نتيجة:', 'Meilleur score :')} ${best}%</p>
                <div class="gs-note-actions gs-quiz-end">
                    <button type="button" class="gs-btn gs-btn-main gs-quiz-restart">🔄 ${t('إعادة الاختبار', 'Recommencer')}</button>
                    <button type="button" class="gs-btn gs-btn-ghost gs-quiz-close">${t('إغلاق', 'Fermer')}</button>
                </div>
            </div>${review}`;

        const section = document.getElementById('quiz');
        if (section) renderQuizList(section);
    }

    // =============== توجيه قسم Quiz ===============
    const prevLoadSection = loadSection;
    loadSection = function (section) {
        if (section.id === 'quiz') { renderQuizList(section); return; }
        prevLoadSection(section);
    };

    // إخفاء "Quiz" من فلاتر البحث (الاختبارات لا تظهر في البحث)
    function hideQuizFilter() {
        document.querySelectorAll('#gs-search-filters option[value="quiz"]').forEach(o => o.remove());
    }
    const prevRefreshUiTexts = refreshUiTexts;
    refreshUiTexts = function () { prevRefreshUiTexts(); hideQuizFilter(); };

    // =============== الأحداث ===============
    document.addEventListener('click', e => {
        const start = e.target.closest('.gs-quiz-start');
        if (start) { openQuiz(start.dataset.path); return; }
        const choice = e.target.closest('.gs-quiz-choice');
        if (choice) { answer(Number(choice.dataset.choice)); return; }
        if (e.target.closest('.gs-quiz-next')) { nextQuestion(); return; }
        if (e.target.closest('.gs-quiz-restart')) { if (quizState) openQuiz(quizState.path); return; }
        if (e.target.closest('.gs-quiz-close')) { closeModal(quizModal()); return; }
        const video = e.target.closest('.gs-video-btn, .gs-video-part');
        if (video) openVideo(video.dataset.path, Number(video.dataset.index || 0));
    });

    // الإجابة بالأرقام 1، 2، 3، 4 من لوحة المفاتيح
    document.addEventListener('keydown', e => {
        const modal = quizModal();
        if (!modal || modal.hidden || !quizState || !/^[1-9]$/.test(e.key)) return;
        const btn = modal.querySelector(`.gs-quiz-choice[data-choice="${Number(e.key) - 1}"]`);
        if (btn && !btn.disabled) btn.click();
    });

    document.addEventListener('DOMContentLoaded', () => {
        buildQuizModal();
        hideQuizFilter();
    });
})();
