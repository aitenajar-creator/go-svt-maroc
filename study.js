// =====================================================
// Go SVT Maroc - study.js (الدفعة 4: أدوات المراجعة)
// المفضلة، الملاحظات، الحفظ بدون إنترنت، المشاركة، فلاتر البحث،
// تذكّر المستوى، روابط بين الأقسام، العد التنازلي
// =====================================================
(function () {
    'use strict';

    const STUDY = {
        EXAM_DATE: '',   // تاريخ الامتحان الوطني بصيغة 'YYYY-MM-DD'، اتركه فارغاً لإخفاء العد التنازلي
        OFFLINE_CACHE: 'gosvt-offline'
    };
    const canOffline = 'caches' in window && 'serviceWorker' in navigator;

    // ---------- التخزين في الجهاز ----------
    function readList(key) {
        try { const v = JSON.parse(storage.get(key)); return Array.isArray(v) ? v : []; } catch (e) { return []; }
    }
    function readObject(key) {
        try { const v = JSON.parse(storage.get(key)); return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; } catch (e) { return {}; }
    }
    const save = (key, value) => storage.set(key, JSON.stringify(value));
    const getFavs = () => readList('gosvt-favs');
    const getOffline = () => readList('gosvt-offline');
    const getNotes = () => readObject('gosvt-notes');

    const byPath = (selector, path) => document.querySelectorAll(`${selector}[data-path="${CSS.escape(path)}"]`);
    const fileUrl = path => new URL(buildFileUrl(path), location.origin).href;
    const fileTitle = path => getFileTitle(path.split('/').pop());

    // ---------- رسالة قصيرة ----------
    let toastTimer = null;
    function toast(message) {
        let el = document.getElementById('gs-toast');
        if (!el) {
            el = document.createElement('div');
            el.id = 'gs-toast';
            el.setAttribute('role', 'status');
            document.body.appendChild(el);
        }
        el.textContent = message;
        el.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
    }

    // ---------- أزرار البطاقات ----------
    function toolsHtml(path) {
        const safe = escapeHtml(path);
        const fav = getFavs().includes(path);
        const note = Boolean(getNotes()[path]);
        const off = getOffline().includes(path);
        const offlineBtn = canOffline && getExt(path) === 'pdf'
            ? `<button type="button" class="gs-tool gs-offline${off ? ' on' : ''}" data-path="${safe}" title="${t('حفظ للقراءة بدون إنترنت', 'Garder hors ligne')}">${off ? '✅' : '📴'}</button>`
            : '';
        return `
            <div class="gs-tools">
                <button type="button" class="gs-tool gs-fav${fav ? ' on' : ''}" data-path="${safe}" title="${t('المفضلة', 'Favoris')}">${fav ? '★' : '☆'}</button>
                <button type="button" class="gs-tool gs-note${note ? ' on' : ''}" data-path="${safe}" title="${t('ملاحظاتي', 'Mes notes')}">📝</button>
                ${offlineBtn}
                <button type="button" class="gs-tool gs-share" data-path="${safe}" title="${t('مشاركة', 'Partager')}">🔗</button>
            </div>`;
    }

    const prevRenderCard = renderCard;
    renderCard = function (path, badgeText) {
        const html = prevRenderCard(path, badgeText);
        const i = html.lastIndexOf('</div>');
        return i === -1 ? html : html.slice(0, i) + toolsHtml(path) + html.slice(i);
    };

    // ---------- المفضلة ----------
    function toggleFav(path) {
        const favs = getFavs();
        const index = favs.indexOf(path);
        const on = index === -1;
        if (on) favs.unshift(path); else favs.splice(index, 1);
        save('gosvt-favs', favs);
        byPath('.gs-fav', path).forEach(b => { b.classList.toggle('on', on); b.textContent = on ? '★' : '☆'; });
        toast(on ? t('⭐ أُضيف إلى مراجعتي', '⭐ Ajouté à Ma révision') : t('حُذف من المفضلة', 'Retiré des favoris'));
        renderRevision();
    }

    // ---------- الحفظ بدون إنترنت ----------
    async function toggleOffline(path, btn) {
        const list = getOffline();
        const saved = list.includes(path);
        const url = fileUrl(path);
        btn.disabled = true;
        try {
            const cache = await caches.open(STUDY.OFFLINE_CACHE);
            if (saved) {
                await cache.delete(url);
                list.splice(list.indexOf(path), 1);
                toast(t('حُذف من الملفات المحفوظة', 'Retiré des fichiers hors ligne'));
            } else {
                btn.textContent = '⏳';
                const response = await fetch(url, { cache: 'reload' });
                if (!response.ok) throw new Error(String(response.status));
                await cache.put(url, response);
                list.unshift(path);
                toast(t('✅ محفوظ: يمكنك فتحه بدون إنترنت', '✅ Enregistré : disponible hors ligne'));
            }
            save('gosvt-offline', list);
            byPath('.gs-offline', path).forEach(b => { b.classList.toggle('on', !saved); b.textContent = saved ? '📴' : '✅'; });
            renderRevision();
        } catch (e) {
            btn.textContent = saved ? '✅' : '📴';
            toast(t('تعذر الحفظ، تحقق من الاتصال أو من مساحة الهاتف', "Échec de l'enregistrement (connexion ou espace insuffisant)"));
        } finally {
            btn.disabled = false;
        }
    }

    // بدون إنترنت: فتح ملف PDF مباشرة بدل المعاينة عبر Google
    const prevOpenPreview = openPreview;
    openPreview = function (path) {
        if (!navigator.onLine && getExt(path) === 'pdf') { window.open(fileUrl(path), '_blank'); return; }
        prevOpenPreview(path);
    };

    // ---------- الملاحظات ----------
    function buildNoteModal() {
        if (document.getElementById('gs-note-modal')) return;
        const modal = document.createElement('div');
        modal.className = 'gs-modal';
        modal.id = 'gs-note-modal';
        modal.hidden = true;
        modal.innerHTML = `
            <div class="gs-modal-box">
                <div class="gs-modal-head">
                    <h3 class="gs-modal-title"></h3>
                    <button type="button" class="gs-close" aria-label="Fermer">✕</button>
                </div>
                <div class="gs-note-body">
                    <textarea id="gs-note-text" rows="8"></textarea>
                    <div class="gs-note-actions">
                        <button type="button" class="gs-btn gs-btn-main" id="gs-note-save"></button>
                        <button type="button" class="gs-btn gs-btn-ghost" id="gs-note-delete"></button>
                    </div>
                    <p class="gs-note-hint"></p>
                </div>
            </div>`;
        document.body.appendChild(modal);
    }

    function openNote(path) {
        const modal = document.getElementById('gs-note-modal');
        if (!modal) return;
        modal.dataset.path = path;
        modal.querySelector('.gs-modal-title').textContent = `📝 ${fileTitle(path)}`;
        const area = document.getElementById('gs-note-text');
        area.value = getNotes()[path] || '';
        openModal('gs-note-modal');
        area.focus();
    }

    function saveNote(text) {
        const modal = document.getElementById('gs-note-modal');
        const path = modal && modal.dataset.path;
        if (!path) return;
        const notes = getNotes();
        const value = text.trim();
        if (value) notes[path] = value; else delete notes[path];
        save('gosvt-notes', notes);
        byPath('.gs-note', path).forEach(b => b.classList.toggle('on', Boolean(value)));
        closeModal(modal);
        toast(value ? t('✅ تم حفظ الملاحظة', '✅ Note enregistrée') : t('حُذفت الملاحظة', 'Note supprimée'));
        renderRevision();
    }

    // ---------- المشاركة ----------
    async function shareLink(title, url) {
        if (navigator.share) {
            try { await navigator.share({ title, text: title, url }); } catch (e) { /* أُلغيت المشاركة */ }
            return;
        }
        window.open(`https://wa.me/?text=${encodeURIComponent(title + '\n' + url)}`, '_blank', 'noopener');
    }

    function shareSite() {
        shareLink(t('Go SVT Maroc: دروس وتمارين وامتحانات علوم الحياة والأرض', 'Go SVT Maroc : cours, exercices et examens de SVT'), 'https://gosvtmaroc.com/');
    }

    // ---------- البحث مع الفلاتر ----------
    const FILTERS = { section: '', subject: '', level: '' };
    const hayCache = new Map();

    function haystack(path) {
        let h = hayCache.get(path);
        if (!h) {
            const names = SECTION_NAMES[path.split('/')[1]] || {};
            h = normalizeText(`${path} ${names.ar || ''} ${names.fr || ''}`);
            hayCache.set(path, h);
        }
        return h;
    }

    function matchesFilters(path) {
        const parts = path.split('/');
        if (FILTERS.section === 'examens') {
            const isExam = parts[1] === 'examens' || (parts[1] === 'exercices' && EXAM_KEYWORDS.test(normalizeText(path)));
            if (!isExam) return false;
        } else if (FILTERS.section && parts[1] !== FILTERS.section) return false;
        if (FILTERS.subject && parts[2] !== FILTERS.subject) return false;
        if (FILTERS.level && parts[3] !== FILTERS.level) return false;
        return true;
    }

    runSearch = async function (query) {
        const results = document.getElementById('gs-search-results');
        if (!results) return;
        const words = normalizeText(query).split(/\s+/).filter(Boolean);
        const hasFilter = FILTERS.section || FILTERS.subject || FILTERS.level;

        if (!words.length && !hasFilter) {
            results.innerHTML = `<p class="gs-search-hint">${t('اكتب كلمة أو اختر قسماً ومستوى...', 'Tapez un mot ou choisissez une rubrique et un niveau...')}</p>`;
            return;
        }
        try {
            const all = await loadManifest();
            const matches = all
                .filter(p => matchesFilters(p) && words.every(w => haystack(p).includes(w)))
                .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
            if (!matches.length) {
                results.innerHTML = `<p class="gs-search-hint">${t('لا توجد نتائج', 'Aucun résultat')}</p>`;
                return;
            }
            const count = `<p class="gs-search-hint">${matches.length} ${t('نتيجة', 'résultat(s)')}</p>`;
            const more = matches.length > 60
                ? `<p class="gs-search-hint">${t('دقّق البحث لعرض نتائج أخرى', 'Précisez la recherche pour voir plus de résultats')}</p>`
                : '';
            results.innerHTML = count + matches.slice(0, 60).map(p => renderCard(p, describePath(p))).join('') + more;
        } catch (e) {
            results.innerHTML = `<p class="gs-search-hint">${t('تعذر البحث حالياً', 'Recherche indisponible')}</p>`;
        }
    };

    function buildSearchFilters() {
        const head = document.querySelector('#gs-search .gs-modal-head');
        if (!head || document.getElementById('gs-search-filters')) return;
        const box = document.createElement('div');
        box.id = 'gs-search-filters';
        box.className = 'gs-search-filters';
        box.innerHTML = '<select data-filter="section"></select><select data-filter="subject"></select><select data-filter="level"></select>';
        head.after(box);
        box.addEventListener('change', e => {
            const key = e.target.dataset.filter;
            if (!key) return;
            FILTERS[key] = e.target.value;
            runSearch(document.getElementById('gs-search-input').value);
        });
        fillFilters();
    }

    function fillFilters() {
        const box = document.getElementById('gs-search-filters');
        if (!box) return;
        const options = {
            section: [['', t('كل الأقسام', 'Toutes les rubriques')]]
                .concat(Object.keys(SECTION_NAMES).map(k => [k, SECTION_NAMES[k][currentLang]])),
            subject: [['', t('كل اللغات', 'Toutes les langues')], ['francais', 'Français'], ['arabe', 'العربية']],
            level: [['', t('كل المستويات', 'Tous les niveaux')], ['TC', 'TC'], ['1BAC', '1BAC'], ['2BAC', '2BAC']]
        };
        box.querySelectorAll('select').forEach(sel => {
            const key = sel.dataset.filter;
            sel.innerHTML = options[key].map(([value, label]) =>
                `<option value="${escapeHtml(value)}"${FILTERS[key] === value ? ' selected' : ''}>${escapeHtml(label)}</option>`).join('');
        });
    }

    // ---------- تذكّر اللغة والمستوى لكل قسم ----------
    function sectionsWithTabs() {
        return Array.from(document.querySelectorAll('.section')).filter(s => s.querySelector('.level-tab-btn'));
    }

    function activate(section, selector, attr, value) {
        const btn = value && section.querySelector(`${selector}[${attr}="${CSS.escape(value)}"]`);
        if (!btn) return;
        section.querySelectorAll(selector).forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    }

    function setSectionState(section, subject, level) {
        activate(section, '.tab-btn', 'data-subject', subject);
        activate(section, '.level-tab-btn', 'data-level', level);
    }

    function saveSectionState(section) {
        const { subject, level } = getSectionState(section);
        const all = readObject('gosvt-state');
        all[section.id] = { subject, level };
        save('gosvt-state', all);
        if (section.classList.contains('active')) history.replaceState(null, '', `#${section.id}/${subject}/${level}`);
    }

    document.addEventListener('click', e => {
        const tab = e.target.closest('.tab-btn, .level-tab-btn');
        if (!tab) return;
        const section = tab.closest('.section');
        if (section) saveSectionState(section);
    });

    // ---------- شريط "نفس المستوى" ----------
    function renderRelated(section) {
        const grid = section.querySelector('.content-grid');
        if (!grid) return;
        let bar = section.querySelector('.gs-related');
        if (!bar) {
            bar = document.createElement('div');
            bar.className = 'gs-related';
            grid.before(bar);
        }
        const { subject, level } = getSectionState(section);
        const others = sectionsWithTabs()
            .filter(s => s !== section && s.querySelector(`.level-tab-btn[data-level="${CSS.escape(level)}"]`));
        if (!others.length) { bar.innerHTML = ''; return; }
        bar.innerHTML = `<span>${t('نفس المستوى:', 'Même niveau :')}</span>` + others.map(s => {
            const name = (SECTION_NAMES[s.id] || {})[currentLang] || s.id;
            return `<a href="#${s.id}" data-subject="${escapeHtml(subject)}" data-level="${escapeHtml(level)}">${escapeHtml(name)} ${escapeHtml(level)}</a>`;
        }).join('');
    }

    document.addEventListener('click', e => {
        const link = e.target.closest('.gs-related a');
        if (!link) return;
        e.preventDefault();
        const target = document.getElementById(link.getAttribute('href').slice(1));
        if (!target) return;
        setSectionState(target, link.dataset.subject, link.dataset.level);
        loadSection(target);
        navigateTo(target.id);
        saveSectionState(target);
    });

    // ---------- قسم "مراجعتي" ----------
    function renderRevision() {
        const box = document.getElementById('revision-content');
        if (!box) return;
        const notes = getNotes();
        const group = (title, list, empty, withNote) => {
            const head = `<h3 class="gs-group-title">${title} (${list.length})</h3>`;
            if (!list.length) return head + `<p class="no-files">${empty}</p>`;
            return head + list.map(p => {
                const card = renderCard(p, describePath(p));
                if (!withNote || !notes[p]) return card;
                const i = card.lastIndexOf('</div>');
                return card.slice(0, i) + `<p class="gs-note-preview">${escapeHtml(notes[p])}</p>` + card.slice(i);
            }).join('');
        };

        let html = group(`⭐ ${t('المفضلة', 'Favoris')}`, getFavs(),
            t('اضغط ☆ على أي ملف لإضافته هنا.', 'Cliquez sur ☆ sur un fichier pour l’ajouter ici.'));
        if (canOffline) {
            html += group(`📴 ${t('محفوظة بدون إنترنت', 'Disponibles hors ligne')}`, getOffline(),
                t('اضغط 📴 على ملف PDF لحفظه وفتحه بدون إنترنت.', 'Cliquez sur 📴 sur un PDF pour le garder hors ligne.'));
        }
        html += group(`📝 ${t('ملاحظاتي', 'Mes notes')}`, Object.keys(notes),
            t('اضغط 📝 على أي ملف لكتابة ملاحظة.', 'Cliquez sur 📝 sur un fichier pour écrire une note.'), true);
        box.innerHTML = html;
    }

    const prevLoadSection = loadSection;
    loadSection = function (section) {
        if (section.id === 'revision') { renderRevision(); return; }
        prevLoadSection(section);
        if (section.querySelector('.level-tab-btn')) renderRelated(section);
    };

    // ---------- العد التنازلي ----------
    function renderCountdown() {
        const el = document.getElementById('gs-countdown');
        if (!el) return;
        const date = STUDY.EXAM_DATE ? new Date(`${STUDY.EXAM_DATE}T08:00:00`) : null;
        const days = date && !isNaN(date) ? Math.ceil((date - Date.now()) / 86400000) : -1;
        if (days < 0) { el.hidden = true; return; }
        el.hidden = false;
        el.innerHTML = days === 0
            ? t('🍀 اليوم هو يوم الامتحان الوطني، بالتوفيق!', '🍀 C’est aujourd’hui ! Bonne chance pour l’examen national !')
            : `⏳ ${t('باقي', 'Plus que')} <strong>${days}</strong> ${t('يوماً على الامتحان الوطني', 'jours avant l’examen national')}`;
    }

    // ---------- زر "مراجعتي" العائم ----------
    function addRevisionButton() {
        const group = document.querySelector('.gs-fab-group');
        if (!group || document.getElementById('gs-revision-btn')) return;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'gs-fab';
        btn.id = 'gs-revision-btn';
        btn.textContent = '⭐';
        group.prepend(btn);
        btn.addEventListener('click', () => {
            if (!document.getElementById('revision')) return;
            renderRevision();
            navigateTo('revision');
        });
    }

    // ---------- النصوص حسب اللغة ----------
    function refreshStudyTexts() {
        const fab = document.getElementById('gs-revision-btn');
        if (fab) { const label = t('مراجعتي', 'Ma révision'); fab.title = label; fab.setAttribute('aria-label', label); }
        const saveBtn = document.getElementById('gs-note-save');
        if (saveBtn) saveBtn.textContent = t('💾 حفظ', '💾 Enregistrer');
        const delBtn = document.getElementById('gs-note-delete');
        if (delBtn) delBtn.textContent = t('🗑️ حذف', '🗑️ Supprimer');
        const hint = document.querySelector('#gs-note-modal .gs-note-hint');
        if (hint) hint.textContent = t('تُحفظ ملاحظاتك في هذا الجهاز فقط.', 'Vos notes sont enregistrées uniquement sur cet appareil.');
        const area = document.getElementById('gs-note-text');
        if (area) area.placeholder = t('اكتب ملاحظتك هنا...', 'Écrivez votre note ici...');
        renderCountdown();
    }

    const prevRefreshUiTexts = refreshUiTexts;
    refreshUiTexts = function () {
        prevRefreshUiTexts();
        fillFilters();
        refreshStudyTexts();
    };

    // ---------- الأحداث ----------
    document.addEventListener('click', e => {
        const tool = e.target.closest('.gs-tool');
        if (tool) {
            const path = tool.dataset.path;
            if (tool.classList.contains('gs-fav')) toggleFav(path);
            else if (tool.classList.contains('gs-note')) openNote(path);
            else if (tool.classList.contains('gs-offline')) toggleOffline(path, tool);
            else if (tool.classList.contains('gs-share')) {
                shareLink(`${fileTitle(path)} - Go SVT Maroc`, fileUrl(path));
                trackEvent('partage', path);
            }
            return;
        }
        if (e.target.closest('.gs-share-site')) { shareSite(); return; }
        if (e.target.closest('#gs-note-save')) { saveNote(document.getElementById('gs-note-text').value); return; }
        if (e.target.closest('#gs-note-delete')) saveNote('');
    });

    window.addEventListener('offline', () => toast(t('📴 أنت غير متصل: افتح "مراجعتي" لملفاتك المحفوظة', '📴 Hors ligne : ouvrez « Ma révision » pour vos fichiers enregistrés')));
    window.addEventListener('online', () => toast(t('✅ عاد الاتصال بالإنترنت', '✅ Connexion rétablie')));

    // ---------- استرجاع آخر مستوى + الروابط المباشرة (#cours/francais/2BAC) ----------
    (function restoreState() {
        const saved = readObject('gosvt-state');
        sectionsWithTabs().forEach(s => {
            const st = saved[s.id];
            if (st) setSectionState(s, st.subject, st.level);
        });
        const m = /^#([\w-]+)\/([\w-]+)\/([\w-]+)$/.exec(location.hash);
        const target = m && document.getElementById(m[1]);
        if (target && target.classList.contains('section')) {
            setSectionState(target, m[2], m[3]);
            history.replaceState(null, '', '#' + m[1]);
        }
    })();

    document.addEventListener('DOMContentLoaded', () => {
        buildNoteModal();
        buildSearchFilters();
        addRevisionButton();
        refreshStudyTexts();
    });
})();
