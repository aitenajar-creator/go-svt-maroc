// =====================================================
// Go SVT Maroc - script.js (الإصدار 2)
// =====================================================

const CONFIG = {
    MANIFEST_URL: 'content.json',
    FORMSPREE_URL: '',   // ضع رابط Formspree هنا، مثال: 'https://formspree.io/f/abcdwxyz'
    CONTACT_EMAIL: 'aitenajar@gmail.com',   // يفتح رسالة جاهزة إذا لم تُفعّل خدمة Formspree
    NEW_DAYS: 7          // عدد أيام ظهور شارة "جديد"
};

const SECTION_NAMES = {
    cours: { ar: 'الدروس', fr: 'Cours' },
    exercices: { ar: 'التمارين', fr: 'Exercices' },
    examens: { ar: 'الامتحانات', fr: 'Examens' },
    fiches: { ar: 'الملخصات', fr: 'Fiches' },
    resumes: { ar: 'الملخصات', fr: 'Résumés' },
    documents: { ar: 'الوثائق', fr: 'Documents' },
    ressources: { ar: 'الموارد', fr: 'Ressources' },
    divers: { ar: 'متنوعات', fr: 'Divers' }
};
const SUBJECT_NAMES = { francais: 'Français', arabe: 'العربية' };
const FILE_ICONS = {
    pdf: '📕', html: '🌐', htm: '🌐', doc: '📘', docx: '📘', ppt: '📙', pptx: '📙', xls: '📗', xlsx: '📗',
    jpg: '🖼️', jpeg: '🖼️', png: '🖼️', gif: '🖼️', webp: '🖼️',
    mp4: '🎬', mp3: '🎧', zip: '🗜️', rar: '🗜️'
};
const PREVIEWABLE = ['pdf', 'html', 'htm', 'jpg', 'jpeg', 'png', 'gif', 'webp'];

let currentLang = 'fr';
let manifestPromise = null;
let requestCounter = 0;
let fileDates = {};
let deferredInstallPrompt = null;
let searchTimer = null;
let searchRequestCounter = 0;

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
const cloudContentUrls = new Map();
function buildFileUrl(path) {
    const cloud = cloudContentUrls.get(path);
    if (cloud) return cloud;
    return path.split('/').map(encodeURIComponent).join('/');
}
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
    // Jekyll static_files paths normally start with "/". Normalize the
    // leading slash so both root-level resources (e.g. /divers/file.pdf)
    // and nested resources use the same section lookup.
    const parts = String(path).replace(/^\/+/, '').split('/');
    return parts.length >= 2 && Boolean(SECTION_NAMES[parts[0]]) &&
        Boolean(parts[parts.length - 1]) && !parts[parts.length - 1].startsWith('.');
}

function loadManifest() {
    if (!manifestPromise) {
        manifestPromise = fetch(CONFIG.MANIFEST_URL, { cache: 'no-cache' })
            .then(response => {
                if (!response.ok) throw new Error(`content.json introuvable (${response.status})`);
                return response.json();
            })
            .then(async paths => {
                const files = paths.filter(isContentFile);
                // Add resources uploaded from the owner dashboard; existing repository files remain untouched.
                if (window.supabaseClient) {
                    // Cloud uploads are an optional addition to the repository library.
                    // A missing table, denied read, or temporary Supabase issue must never
                    // prevent the ordinary GitHub-hosted lessons and exams from appearing.
                    try {
                        const { data, error } = await window.supabaseClient
                            .from('site_content_items')
                            .select('id,category,language,study_level,study_track,file_name,storage_path')
                            .order('created_at', { ascending: false });
                        if (error) throw error;
                        (data || []).forEach(item => {
                            const category = item.category === 'resumes' ? 'fiches' : item.category;
                            const parts = [category];
                            if (['cours','exercices','examens','fiches'].includes(category)) {
                                parts.push(item.language || 'francais', item.study_level || 'TC');
                                if (item.study_track) parts.push(item.study_track);
                            }
                            parts.push('__cloud', item.id, item.file_name);
                            const virtualPath = '/' + parts.join('/');
                            const publicUrl = window.supabaseClient.storage.from('site-content').getPublicUrl(item.storage_path).data.publicUrl;
                            cloudContentUrls.set(virtualPath, publicUrl);
                            files.push(virtualPath);
                        });
                    } catch (cloudError) {
                        console.warn('Cloud library unavailable; continuing with repository content:', cloudError);
                    }
                }
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

// نسخ مطابقة محفوظة داخل مجلدات الفصول؛ نخفيها من القوائم والبحث فقط
// مع الإبقاء على الملفات ومساراتها المباشرة دون أي تغيير.
const HIDDEN_DUPLICATE_COURSE_COPIES = new Set([
    'cours/francais/TC/TCS/Chapitre 1/eleves-TCS  AIT ENAJAR U1C1.pdf',
    'cours/francais/TC/TCS/Chapitre 2/eleves-TCS  AIT ENAJAR U1C2.pdf',
    'cours/francais/TC/TCS/Chapitre 3/eleves-TCS  AIT ENAJAR U1C3.pdf',
    'cours/francais/TC/TCS/Chapitre 4/eleves-TCS  AIT ENAJAR U1C4.pdf',
    'cours/francais/TC/TCS/Chapitre 5/eleves-TCS  AIT ENAJAR U1C5.pdf'
]);

function isHiddenDuplicateCourseCopy(path) {
    return HIDDEN_DUPLICATE_COURSE_COPIES.has(String(path).replace(/^\/+/, ''));
}

function isNew(path) {
    const d = fileDates[path];
    return d && (Date.now() - d) < CONFIG.NEW_DAYS * 86400000;
}

function isCloudInternalSegment(segment) {
    return segment === '__cloud' || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(segment));
}

function describePath(path) {
    const [type, subject, ...rest] = path.split('/').slice(1, -1);
    const labels = [];
    if (SECTION_NAMES[type]) labels.push(SECTION_NAMES[type][currentLang]);
    if (subject) labels.push(SUBJECT_NAMES[subject] || subject);
    return labels.concat(rest.filter(segment => !isCloudInternalSegment(segment))).join(' · ');
}

// Exam metadata is inferred only from explicit filename markers.
function getExamFileMetadata(path) {
    const normalizedPath = String(path).replace(/^\/+/, '');
    if (!/^(examens|exercices)\//.test(normalizedPath)) return null;
    const filename = normalizedPath.split('/').pop().replace(/\.[^.]+$/, '');
    // بعض الموارد تضع السنة أو الدورة أو نوع الوثيقة في اسم المجلد لا الملف.
    const text = normalizeText(normalizedPath.replace(/\.[^/.]+$/, '').replace(/\//g, ' '));
    const yearMatch = /(?:^|\D)((?:19|20)\d{2})(?!\d)/.exec(text);
    const isNormal = /normale|normal|ordinaire|عادي/.test(text);
    const isRattrapage = /rattrapage|استدراك/.test(text);
    const isSubject = /sujet|موضوع/.test(text);
    const isCorrection = /corrige|correction|تصحيح|عناصر الاجابة|اجوبة|اجابات/.test(text);
    if (!yearMatch && !isNormal && !isRattrapage && !isSubject && !isCorrection) return null;
    const labels = [];
    if (yearMatch) labels.push({ ar: yearMatch[1], fr: yearMatch[1], className: 'exam-year' });
    if (isNormal || isRattrapage) labels.push({
        ar: isNormal ? 'الدورة العادية' : 'الدورة الاستدراكية',
        fr: isNormal ? 'Session normale' : 'Session de rattrapage',
        className: 'exam-session'
    });
    if (isSubject || isCorrection) labels.push({
        ar: isSubject ? 'موضوع الامتحان' : 'التصحيح',
        fr: isSubject ? 'Sujet' : 'Corrigé',
        className: isSubject ? 'exam-subject' : 'exam-correction'
    });
    return labels;
}
function addExamLibraryFilters(container, files) {
    const rows = files.map(path => {
        // اقرأ مسار المورد كله لدعم التصنيف الموجود في المجلدات الفرعية أيضاً.
        const normalized = normalizeText(String(path).replace(/\.[^/.]+$/, '').replace(/\//g, ' '));
        const yearMatch = /(?:^|\D)((?:19|20)\d{2})(?!\d)/.exec(normalized);
        const session = /rattrapage|استدراك/.test(normalized) ? 'rattrapage'
            : /normale|normal|ordinaire|عادي/.test(normalized) ? 'normale' : '';
        const kind = /corrige|correction|تصحيح|عناصر الاجابة|اجوبة|اجابات/.test(normalized) ? 'corrige'
            : /sujet|موضوع/.test(normalized) ? 'sujet' : '';
        return { path, year: yearMatch ? yearMatch[1] : '', session, kind };
    });
    const values = key => [...new Set(rows.map(row => row[key]).filter(Boolean))];
    const years = values('year').sort((a, b) => Number(b) - Number(a));
    const sessions = values('session');
    const kinds = values('kind');
    if (!years.length && !sessions.length && !kinds.length) return;
    const select = (key, label, items) => items.length
        ? '<label class="gs-exam-filter"><span>' + label + '</span><select data-filter="' + key + '"><option value="">' + t('الكل', 'Tous') + '</option>' +
          items.map(value => '<option value="' + value + '">' +
              (key === 'session' ? (value === 'normale' ? t('العادية', 'Normale') : t('الاستدراكية', 'Rattrapage'))
                  : key === 'kind' ? (value === 'sujet' ? t('الموضوع', 'Sujet') : t('التصحيح', 'Corrigé')) : value) +
          '</option>').join('') + '</select></label>'
        : '';
    const bar = document.createElement('div');
    bar.className = 'gs-exam-filters';
    bar.innerHTML = '<label class="gs-exam-search"><span>' + t('بحث داخل الامتحانات', 'Rechercher dans les examens') + '</span><input type="search" data-exam-search autocomplete="off" placeholder="' + t('عنوان الملف أو السنة أو كلمة مفتاحية...', 'Titre, année ou mot-clé...') + '" /></label>' +
        select('year', t('السنة', 'Année'), years) +
        select('session', t('الدورة', 'Session'), sessions) +
        select('kind', t('نوع الملف', 'Type'), kinds) +
        '<button type="button" class="gs-exam-reset">' + t('إعادة ضبط', 'Réinitialiser') + '</button>';
    const count = container.querySelector('.files-count');
    if (count) count.after(bar); else container.prepend(bar);
    const cardsByPath = new Map(
        [...container.querySelectorAll('.file-resource-card')]
            .map(card => [card.dataset.resourcePath, card])
    );
    const apply = () => {
        const chosen = {};
        bar.querySelectorAll('select').forEach(item => { chosen[item.dataset.filter] = item.value; });
        const query = normalizeText(bar.querySelector('[data-exam-search]')?.value || '').trim();
        let visible = 0;
        rows.forEach(row => {
            const card = cardsByPath.get(row.path);
            if (!card) return;
            const searchableText = normalizeText(row.path + ' ' + (card.textContent || ''));
            const matchesQuery = !query || query.split(/\\s+/).every(term => searchableText.includes(term));
            const show = matchesQuery &&
                (!chosen.year || row.year === chosen.year) &&
                (!chosen.session || row.session === chosen.session) &&
                (!chosen.kind || row.kind === chosen.kind);
            card.hidden = !show;
            if (show) visible++;
        });

        // إخفاء عناوين السنة والدورة ونوع الوثيقة عندما لا يبقى تحتها أي ملف ظاهر.
        const headingRank = heading => heading.classList.contains('gs-group-title') ? 1
            : heading.classList.contains('gs-exam-session-title') ? 2
            : heading.classList.contains('gs-exam-kind-title') ? 3 : 0;
        const headings = [...container.querySelectorAll(
            '.gs-group-title, .gs-exam-session-title, .gs-exam-kind-title'
        )];
        headings.forEach(heading => {
            const rank = headingRank(heading);
            let hasVisibleCard = false;
            let sibling = heading.nextElementSibling;
            while (sibling) {
                const nextHeadingRank = headingRank(sibling);
                if (nextHeadingRank && nextHeadingRank <= rank) break;
                if (sibling.matches('.file-resource-card') && !sibling.hidden) hasVisibleCard = true;
                if (sibling.querySelector && sibling.querySelector('.file-resource-card:not([hidden])')) {
                    hasVisibleCard = true;
                }
                sibling = sibling.nextElementSibling;
            }
            heading.hidden = !hasVisibleCard;
        });

        container.querySelectorAll('.track-content-group').forEach(group => {
            group.hidden = !group.querySelector('.file-resource-card:not([hidden])');
        });
        if (count) count.textContent = visible + ' ' + t('ملف', 'fichier(s)');
        let empty = container.querySelector('.gs-exam-filter-empty');
        if (!empty) {
            empty = document.createElement('p');
            empty.className = 'gs-exam-filter-empty';
            bar.after(empty);
        }
        empty.hidden = visible > 0;
        empty.textContent = t('لا توجد ملفات مطابقة.', 'Aucun fichier correspondant.');
    };
    bar.querySelectorAll('select').forEach(item => item.addEventListener('change', apply));
    bar.querySelector('[data-exam-search]')?.addEventListener('input', apply);
    bar.querySelector('.gs-exam-reset').addEventListener('click', () => {
        bar.querySelectorAll('select').forEach(item => { item.value = ''; });
        const searchInput = bar.querySelector('[data-exam-search]');
        if (searchInput) searchInput.value = '';
        apply();
    });
}
function renderCard(path, badgeText) {
    const fileName = path.split('/').pop();
    const ext = getExt(fileName);
    const safePath = escapeHtml(path);
    const newBadge = isNew(path) ? `<span class="new-badge">${t('جديد', 'Nouveau')}</span>` : '';
    const examMetadata = getExamFileMetadata(path);
    const examBadges = examMetadata ? `<div class="exam-metadata" aria-label="${t('معلومات الامتحان', 'Informations sur l’examen')}">${examMetadata.map(item => `<span class="exam-meta-badge ${item.className}">${escapeHtml(currentLang === 'ar' ? item.ar : item.fr)}</span>`).join('')}</div>` : '';
    const previewBtn = PREVIEWABLE.includes(ext)
        ? `<button type="button" class="preview-btn" data-path="${safePath}">👁️ ${t('معاينة', 'Aperçu')}</button>`
        : '';
    const thumbnail = ext === 'pdf'
        // Avoid automatic PDF.js canvas rendering in the background; the preview button remains on-demand.
        ? `<div class="content-card-thumbnail file-thumbnail pdf-thumbnail-static" aria-label="${t('ملف PDF', 'Document PDF')}"><span>📕</span><small>PDF</small></div>`
        : ['jpg','jpeg','png','gif','webp'].includes(ext)
            ? `<div class="content-card-thumbnail image-thumbnail" data-preview-path="${safePath}" role="button" tabindex="0" aria-label="${t('فتح معاينة الصورة', 'Ouvrir l’aperçu de l’image')}"><img src="${buildFileUrl(path)}" alt="${t('معاينة الملف المصور', 'Aperçu du fichier image')}" loading="lazy" decoding="async"><span class="image-thumbnail-hint">${t('اضغط لمعاينة الصورة', 'Cliquer pour agrandir')}</span></div>`
            : `<div class="content-card-thumbnail file-thumbnail" aria-label="${t('نوع الملف', 'Type de fichier')}"><span>${getFileIcon(ext)}</span><small>${escapeHtml(ext.toUpperCase() || 'FILE')}</small></div>`;
    return `
        <div class="content-card file-resource-card${ext === 'pdf' ? ' pdf-resource-card' : ''}" data-resource-path="${safePath}">
            <span class="level-badge">${escapeHtml(badgeText)}</span>${newBadge}
            <div class="file-card-layout">
                <div class="file-preview-panel">${thumbnail}</div>
                <div class="file-info-panel">
                    <h3>${escapeHtml(getFileTitle(fileName))}</h3>
                    ${examBadges}
                    <p class="file-name">${escapeHtml(fileName)}</p>
                    <div class="card-actions">
                        ${previewBtn}
                        <a href="${buildFileUrl(path)}" download class="download-btn" data-path="${safePath}">📥 ${t('تحميل', 'Télécharger')}</a>
                    </div>
                    <!--FILE_TOOLS_SLOT-->
                </div>
            </div>
        </div>`;
}

/* Lazy first-page previews for published PDF resources. */
let pdfJsPromise = null;
let pdfThumbnailObserver = null;
function loadPdfJs() {
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    if (!pdfJsPromise) {
        pdfJsPromise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js';
            script.async = true;
            script.onload = () => {
                if (!window.pdfjsLib) { reject(new Error('PDF.js unavailable')); return; }
                window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
                resolve(window.pdfjsLib);
            };
            script.onerror = () => reject(new Error('PDF preview library failed to load'));
            document.head.appendChild(script);
        }).catch(error => { pdfJsPromise = null; throw error; });
    }
    return pdfJsPromise;
}
async function renderFirstPdfPage(container) {
    if (!container || container.dataset.rendered === 'true' || container.dataset.loading === 'true') return;
    container.dataset.loading = 'true';
    let pdf = null;
    try {
        const pdfjs = await loadPdfJs();
        const url = buildFileUrl(container.dataset.path);
        // First use PDF.js' normal streaming/range transport.
        // Some static hosts or PDF files with hybrid cross-reference tables
        // can fail through partial responses, so retry with a complete download.
        try {
            pdf = await pdfjs.getDocument({ url, withCredentials: false }).promise;
        } catch (initialError) {
            console.warn('PDF preview standard loading failed; retrying with full-file loading:', initialError);
            try {
                pdf = await pdfjs.getDocument({
                    url,
                    withCredentials: false,
                    disableRange: true,
                    disableStream: true
                }).promise;
            } catch (fullFileError) {
                console.warn('PDF preview full-file loading failed; retrying without worker:', fullFileError);
                pdf = await pdfjs.getDocument({
                    url,
                    withCredentials: false,
                    disableRange: true,
                    disableStream: true,
                    disableWorker: true
                }).promise;
            }
        }
        const page = await pdf.getPage(1);
        const base = page.getViewport({ scale: 1 });
        // Preserve the PDF page's real proportions so the card height follows
        // the preview image instead of a fixed-height placeholder.
        container.style.aspectRatio = `${base.width} / ${base.height}`;
        const cssWidth = Math.max(container.clientWidth || 0, 260);
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.25);
        const renderScale = Math.min(1.6, Math.max(1, (cssWidth * pixelRatio) / base.width));
        const viewport = page.getViewport({ scale: renderScale });
        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        canvas.style.width = '100%';
        canvas.style.height = 'auto';
        canvas.style.display = 'block';
        const context = canvas.getContext('2d', { alpha: false });
        if (!context) throw new Error('Canvas 2D context unavailable');
        await page.render({ canvasContext: context, viewport }).promise;
        container.replaceChildren(canvas);
        container.dataset.rendered = 'true';
        page.cleanup();
    } catch (error) {
        console.warn('PDF thumbnail unavailable:', container.dataset.path, error);
        container.dataset.previewFailed = 'true';
        container.innerHTML = `<div class="thumbnail-fallback" role="status"><span>${t('تعذرت معاينة هذا الملف حالياً.', 'Aperçu temporairement indisponible.')}</span><button type="button" class="pdf-thumbnail-retry">${t('إعادة المحاولة', 'Réessayer')} ↻</button></div>`;
    } finally {
        if (pdf) {
            try { await pdf.destroy(); } catch (cleanupError) { /* ignore cleanup errors */ }
        }
        delete container.dataset.loading;
    }
}

// Render a small number of PDFs concurrently. This avoids saturating the
// browser with simultaneous downloads while ensuring hidden tabs and cards
// are not left waiting forever for an IntersectionObserver notification.
const pdfThumbnailQueue = [];
let pdfThumbnailActive = 0;
const PDF_THUMBNAIL_CONCURRENCY = 2;
let pdfThumbnailVisibilityObserver = null;

function enqueuePdfThumbnail(container) {
    if (!container || container.dataset.rendered === 'true' || container.dataset.queued === 'true') return;
    // Discard detached nodes before queueing new work. Navigating between
    // sections can otherwise leave stale thumbnail entries in memory.
    for (let i = pdfThumbnailQueue.length - 1; i >= 0; i--) {
        const queued = pdfThumbnailQueue[i].container;
        if (!queued || !queued.isConnected || queued.dataset.rendered === 'true') {
            if (queued && queued.dataset) delete queued.dataset.queued;
            pdfThumbnailQueue.splice(i, 1);
        }
    }
    container.dataset.queued = 'true';
    const rect = container.getBoundingClientRect();
    const distance = rect.top < 0 ? Math.abs(rect.top) : Math.max(0, rect.top - window.innerHeight);
    pdfThumbnailQueue.push({ container, distance });
    pdfThumbnailQueue.sort((a, b) => a.distance - b.distance);
    processPdfThumbnailQueue();
}

function queuePdfThumbnail(container, alreadyVisible = false) {
    if (!container || container.dataset.rendered === 'true' || container.dataset.queued === 'true') return;

    // PDF.js and canvas rendering are expensive. Wait until a preview is near
    // the viewport instead of rendering every PDF in a newly loaded section.
    if (!alreadyVisible && 'IntersectionObserver' in window) {
        if (!pdfThumbnailVisibilityObserver) {
            pdfThumbnailVisibilityObserver = new IntersectionObserver(entries => {
                entries.forEach(entry => {
                    if (!entry.isIntersecting) return;
                    const node = entry.target;
                    pdfThumbnailVisibilityObserver.unobserve(node);
                    delete node.dataset.visibilityObserved;
                    enqueuePdfThumbnail(node);
                });
            }, { rootMargin: '450px 0px', threshold: 0.01 });
        }
        if (container.dataset.visibilityObserved !== 'true') {
            container.dataset.visibilityObserved = 'true';
            pdfThumbnailVisibilityObserver.observe(container);
        }
        return;
    }
    enqueuePdfThumbnail(container);
}
function processPdfThumbnailQueue() {
    // Keep the pending queue clean and skip entries from content already removed.
    while (pdfThumbnailActive < PDF_THUMBNAIL_CONCURRENCY && pdfThumbnailQueue.length) {
        const item = pdfThumbnailQueue.shift();
        const node = item && item.container;
        if (!node) continue;
        delete node.dataset.queued;
        if (!node.isConnected || node.dataset.rendered === 'true') continue;
        pdfThumbnailActive++;
        renderFirstPdfPage(node).finally(() => {
            pdfThumbnailActive--;
            processPdfThumbnailQueue();
        });
    }
}
function observePdfThumbnails(root = document) {
    const nodes = root.querySelectorAll('[data-pdf-thumbnail]');
    if (!nodes.length) return;
    // The PDF.js library is loaded by renderFirstPdfPage only after a card
    // approaches the viewport. Browsers without IntersectionObserver retain
    // the bounded-concurrency fallback queue.
    nodes.forEach(queuePdfThumbnail);
}


let pdfThumbnailDomObserver = null;
function startPdfThumbnailAutoObserver() {
    if (pdfThumbnailDomObserver || !document.querySelector('main')) return;

    // PDF previews exist in the library content grids, not in the whole page.
    // Observing documentElement also woke this callback for unrelated changes
    // in the student workspace, navigation, dialogs and account UI.
    const libraryContainers = document.querySelectorAll(
        'main .content-grid[id$="-content"]'
    );
    if (!libraryContainers.length) return;

    pdfThumbnailDomObserver = new MutationObserver(records => {
        records.forEach(record => {
            // Release visibility-observer references to removed cards and remove
            // queued tasks for content that is no longer in the document.
            record.removedNodes.forEach(removed => {
                if (removed.nodeType !== 1) return;
                const detached = [];
                if (removed.matches && removed.matches('[data-pdf-thumbnail]')) detached.push(removed);
                if (removed.querySelectorAll) detached.push(...removed.querySelectorAll('[data-pdf-thumbnail]'));
                detached.forEach(node => {
                    if (pdfThumbnailVisibilityObserver && node.dataset.visibilityObserved === 'true') {
                        pdfThumbnailVisibilityObserver.unobserve(node);
                        delete node.dataset.visibilityObserved;
                    }
                    if (node.dataset.queued === 'true') {
                        node.dataset.queued = 'false';
                    }
                });
            });
            record.addedNodes.forEach(added => {
                if (added.nodeType !== 1) return;
                if (added.matches && added.matches('[data-pdf-thumbnail]')) {
                    queuePdfThumbnail(added);
                }
                if (added.querySelectorAll) {
                    added.querySelectorAll('[data-pdf-thumbnail]').forEach(queuePdfThumbnail);
                }
            });
        });
        // Remove detached queue records without touching active renders.
        for (let i = pdfThumbnailQueue.length - 1; i >= 0; i--) {
            const node = pdfThumbnailQueue[i].container;
            if (!node || !node.isConnected) {
                if (node && node.dataset) delete node.dataset.queued;
                pdfThumbnailQueue.splice(i, 1);
            }
        }
    });

    libraryContainers.forEach(container => {
        pdfThumbnailDomObserver.observe(container, {
            childList: true,
            subtree: true
        });
        // Pick up previews already present before observation began.
        container.querySelectorAll('[data-pdf-thumbnail]').forEach(queuePdfThumbnail);
    });
}

// تحديد الشعبة من بنية مسار الملف، بما في ذلك مجلدات الامتحانات.
function getTrackInfo(path) {
    const parts = String(path).replace(/^\/+/, '').split('/');
    const trackLabels = {
        TCS: ['الجذع المشترك العلمي', 'Tronc commun scientifique'],
        TCL: ['الجذع المشترك الأدبي', 'Tronc commun littéraire'],
        '1BACSE': ['الأولى باكالوريا: علوم تجريبية', '1ère Bac : Sciences expérimentales'],
        '1BACL': ['الأولى باكالوريا: الآداب', '1ère Bac : Lettres'],
        '1BACSM': ['الأولى باكالوريا: علوم رياضية', '1ère Bac : Sciences mathématiques'],
        '2BACSVT': ['الثانية باكالوريا: علوم الحياة والأرض', '2ème Bac : Sciences de la vie et de la Terre'],
        '2BACSP': ['الثانية باكالوريا: علوم فيزيائية', '2ème Bac : Sciences physiques'],
        '2BACSM': ['الثانية باكالوريا: علوم رياضية', '2ème Bac : Sciences mathématiques'],
        '2BAC SVT': ['الثانية باكالوريا: علوم الحياة والأرض', '2ème Bac : Sciences de la vie et de la Terre'],
        '2BAC SP': ['الثانية باكالوريا: علوم فيزيائية', '2ème Bac : Sciences physiques'],
        '2BAC SM': ['الثانية باكالوريا: علوم رياضية', '2ème Bac : Sciences mathématiques']
    };
    const index = parts.findIndex(part => Object.prototype.hasOwnProperty.call(trackLabels, part));
    if (index < 0) return null;
    return { key: parts[index], label: trackLabels[parts[index]][currentLang === 'fr' ? 1 : 0], index };
}

// ---------- عرض الأقسام ----------
async function loadContentFromManifest(type, subject, level) {
    const container = document.getElementById(`${type}-content`);
    if (!container) return;

    const requestId = String(++requestCounter);
    container.dataset.requestId = requestId;
    const account = window.StudentAccount;
    const academic = account && account.isLoggedIn() && typeof account.getProfile === 'function'
        ? account.getProfile() : null;
    const studentLevel = academic && academic.study_level;
    const studentTrack = academic && academic.study_track;
    // أولوية الاختيار الظاهر في أزرار المستوى والشعبة على مستوى الحساب.
    const pathwayTrack = window.GoSVTPathways && typeof window.GoSVTPathways.trackFor === 'function'
        ? window.GoSVTPathways.trackFor(type, level) : 'all';
    const explicitlyAllTracks = window.GoSVTPathways &&
        typeof window.GoSVTPathways.isExplicitAll === 'function' &&
        window.GoSVTPathways.isExplicitAll(type, level);
    const effectiveStudentTrack = pathwayTrack && pathwayTrack !== 'all'
        ? pathwayTrack : (explicitlyAllTracks ? null : (studentLevel === level ? studentTrack : null));
    const trackPrefix = effectiveStudentTrack && (type === 'cours' || type === 'exercices')
        ? `${effectiveStudentTrack}/` : '';
    const prefix = `/${type}/${subject}/${level}/${trackPrefix}`;

    try {
        const allFiles = await loadManifest();
        if (container.dataset.requestId !== requestId) return;

        const levelPrefix = `/${type}/${subject}/${level}/`;
        let files = allFiles.filter(p => p.startsWith(levelPrefix) && !isHiddenDuplicateCourseCopy(p));

        // Keep level-wide resources visible to every track. Only exclude files
        // explicitly assigned to a different track; this also handles the
        // spaced track-folder names used by national exams (e.g. "2BAC SVT").
        if (effectiveStudentTrack && ['cours', 'exercices', 'examens'].includes(type)) {
            const selectedTrack = String(effectiveStudentTrack).replace(/\s+/g, '').toUpperCase();
            files = files.filter(path => {
                const info = getTrackInfo(path);
                if (!info) return true; // shared resource at the level root
                return info.key.replace(/\s+/g, '').toUpperCase() === selectedTrack;
            });
        }
        if (type === 'examens') {
            // Compute exam labels once per file. Recomputing them inside the
            // sort comparator repeated regex/metadata work O(n log n) times.
            files = files.map((path, index) => {
                const labels = getExamFileMetadata(path) || [];
                const value = name => (labels.find(item => item.className === name) || {}).ar || '';
                return {
                    path,
                    index,
                    year: Number(value('exam-year')) || 0,
                    session: value('exam-session'),
                    kind: value('exam-subject') ? 0 : value('exam-correction') ? 1 : 2
                };
            }).sort((a, b) => {
                if (a.year !== b.year) return b.year - a.year;
                if (a.session !== b.session) {
                    return (a.session === 'الدورة العادية' ? 0 : 1) -
                        (b.session === 'الدورة العادية' ? 0 : 1);
                }
                if (a.kind !== b.kind) return a.kind - b.kind;
                return a.path.localeCompare(b.path, undefined, { numeric: true }) ||
                    a.index - b.index;
            }).map(item => item.path);
        } else {
            files = files.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
        }

        if (files.length === 0) {
            container.innerHTML = `<p class="no-files">${t('لا توجد ملفات حالياً', 'Aucun fichier disponible pour le moment')}</p>`;
            return;
        }

        const count = `<p class="files-count">${files.length} ${t('ملف', 'fichier(s)')}</p>`;
        const grouped = new Map();
        files.forEach(path => {
            const track = getTrackInfo(path);
            const key = track ? track.key : '__shared__';
            if (!grouped.has(key)) grouped.set(key, { track, files: [] });
            grouped.get(key).files.push(path);
        });

        // Build only a small batch of cards per task so large libraries do not
        // monopolize the main thread and freeze navigation or input handling.
        const BATCH_SIZE = 32;
        const appendCardsInBatches = async (target, paths) => {
            for (let offset = 0; offset < paths.length; offset += BATCH_SIZE) {
                if (container.dataset.requestId !== requestId) return false;
                const batch = paths.slice(offset, offset + BATCH_SIZE).map(path => {
                    const track = getTrackInfo(path);
                    const relativeParts = path.slice(prefix.length).split('/').slice(0, -1);
                    if (track && relativeParts.includes(track.key)) {
                        relativeParts.splice(relativeParts.indexOf(track.key), 1);
                    }
                    const sub = relativeParts.filter(part => part && !isCloudInternalSegment(part)).join(' / ');
                    return renderCard(path, sub ? `${level} - ${sub}` : level);
                }).join('');
                target.insertAdjacentHTML('beforeend', batch);
                if (offset + BATCH_SIZE < paths.length) {
                    await new Promise(resolve => setTimeout(resolve, 0));
                }
            }
            return container.dataset.requestId === requestId;
        };

        // عند وجود أكثر من شعبة، نعرض كل شعبة في مجموعة مستقلة بدلاً من خلط الملفات.
        const hasTrackGroups = [...grouped.values()].some(group => group.track);
        if (!hasTrackGroups) {
            container.innerHTML = count;
            const completed = await appendCardsInBatches(container, files);
            if (!completed) return;
        } else {
            const orderedGroups = [...grouped.values()].sort((a, b) => {
                if (!a.track) return 1;
                if (!b.track) return -1;
                return a.track.label.localeCompare(b.track.label, currentLang === 'fr' ? 'fr' : 'ar');
            });
            container.innerHTML = count;
            for (const group of orderedGroups) {
                if (container.dataset.requestId !== requestId) return;
                const heading = group.track
                    ? group.track.label
                    : t('ملفات مشتركة بين الشعب', 'Ressources communes');
                const section = document.createElement('section');
                section.className = 'track-content-group';
                section.innerHTML = `<h3 class="track-content-heading">${escapeHtml(heading)}</h3><div class="content-grid"></div>`;
                container.appendChild(section);
                const grid = section.querySelector('.content-grid');
                const completed = await appendCardsInBatches(grid, group.files);
                if (!completed) return;
            }
        }

        if (container.dataset.requestId !== requestId) return;
        if (type === 'examens') addExamLibraryFilters(container, files);
        observePdfThumbnails(container);
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
    const account = window.StudentAccount;
    const academic = account && account.isLoggedIn() && typeof account.getProfile === 'function'
        ? account.getProfile() : null;
    return {
        type: (subjectBtn && subjectBtn.dataset.type) || section.id,
        subject: subjectBtn ? subjectBtn.dataset.subject : 'francais',
        level: levelBtn ? levelBtn.dataset.level : (academic && academic.study_level ? academic.study_level : 'TC')
    };
}

function loadSection(section) {
    if (!section) return;
    if (!section.querySelector('.tab-btn, .level-tab-btn')) return;
    const { type, subject, level } = getSectionState(section);
    const container = document.getElementById(`${type}-content`);
    if (!container) return;

    // Load a section only when it is visited, and avoid rebuilding it on
    // repeated navigation unless its selected filters or language changed.
    const stateKey = [type, subject, level, currentLang].join('|');
    if (container.dataset.gsLoadedState === stateKey &&
        container.children.length > 0 &&
        !container.querySelector('.error')) return;

    container.dataset.gsLoadedState = stateKey;
    loadContent(type, subject, level);
}

function reloadAllSections() {
    // The previous implementation loaded every hidden section on startup.
    // Only the visible section is needed; the others load on first visit.
    const activeSection = document.querySelector('.section.active') ||
        document.querySelector('.section');
    if (activeSection) loadSection(activeSection);
}

// ---------- البحث ----------
async function runSearch(query) {
    const results = document.getElementById('gs-search-results');
    if (!results) return;
    const requestId = ++searchRequestCounter;
    const words = normalizeText(query).split(/\s+/).filter(Boolean);
    const category = document.getElementById('gs-search-category')?.value || '';
    const level = document.getElementById('gs-search-level')?.value || '';
    const language = document.getElementById('gs-search-language')?.value || '';

    if (words.length === 0 && !category && !level && !language) {
        results.innerHTML = `<p class="gs-search-hint">${t('اكتب اسم درس أو اختر نوع المورد أو المستوى أو اللغة...', 'Saisissez un titre ou choisissez un type, un niveau ou une langue...')}</p>`;
        return;
    }
    try {
        const all = await loadManifest();
        // A slower previous request must never overwrite the newest search/filter selection.
        if (requestId !== searchRequestCounter) return;
        const matches = all.filter(p => {
            if (isHiddenDuplicateCourseCopy(p)) return false;
            const normalizedPath = normalizeText(p);
            if (words.length && !words.every(w => normalizedPath.includes(w))) return false;
            if (category && !p.toLowerCase().includes('/' + category + '/')) return false;
            if (level && !p.toLowerCase().includes('/' + level.toLowerCase() + '/')) return false;
            if (language && !p.toLowerCase().includes('/' + language + '/')) return false;
            return true;
        });
        if (requestId !== searchRequestCounter) return;
        if (matches.length === 0) {
            results.innerHTML = `<p class="gs-search-hint">${t('لا توجد نتائج مطابقة لهذه الاختيارات', 'Aucun résultat pour ces critères')}</p>`;
            return;
        }
        const more = matches.length > 60
            ? `<p class="gs-search-hint">${t('توجد نتائج إضافية؛ دقّق البحث لتضييق النتائج', 'Il existe d’autres résultats ; affinez les critères')}</p>`
            : '';
        results.innerHTML = `<p class="gs-search-count">${t('عدد النتائج:', 'Résultats :')} ${matches.length}</p>` +
            matches.slice(0, 60).map(p => renderCard(p, describePath(p))).join('') + more;
        observePdfThumbnails(results);
    } catch (error) {
        if (requestId !== searchRequestCounter) return;
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
    } else if (['html', 'htm'].includes(getExt(path))) {
        body.innerHTML = `<iframe src="${url}" title="${escapeHtml(getFileTitle(path.split('/').pop()))}" loading="lazy" sandbox="allow-same-origin"></iframe>`;
    } else {
        body.innerHTML = `<img src="${url}" alt="${escapeHtml(getFileTitle(path.split('/').pop()))}" decoding="async">`;
        const previewImage = body.querySelector('img');
        if (previewImage) previewImage.addEventListener('error', function() {
            body.textContent = t('تعذر تحميل الصورة. تحقق من توفر الملف ثم أعد المحاولة.', 'Impossible de charger cette image. Vérifiez que le fichier est disponible puis réessayez.');
        }, { once: true });
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
            <div class="gs-search-filters" role="group" aria-label="Search filters">
                <select id="gs-search-category" aria-label="Type de ressource">
                    <option value="">${t('كل الموارد', 'Tous les types')}</option>
                    <option value="cours">${t('الدروس', 'Cours')}</option>
                    <option value="exercices">${t('التمارين', 'Exercices')}</option>
                    <option value="examens">${t('الامتحانات', 'Examens')}</option>
                    <option value="fiches">${t('الملخصات', 'Fiches')}</option>
                    <option value="resumes">${t('الملخصات', 'Résumés')}</option>
                    <option value="documents">${t('الوثائق', 'Documents')}</option>
                    <option value="ressources">${t('الموارد', 'Ressources')}</option>
                    <option value="divers">${t('متنوعات', 'Divers')}</option>
                </select>
                <select id="gs-search-level" aria-label="Niveau scolaire">
                    <option value="">${t('كل المستويات', 'Tous les niveaux')}</option>
                    <option value="TC">TC</option>
                    <option value="1BAC">1BAC</option>
                    <option value="2BAC">2BAC</option>
                </select>
                <select id="gs-search-language" aria-label="Langue">
                    <option value="">${t('كل اللغات', 'Toutes les langues')}</option>
                    <option value="francais">${t('الفرنسية', 'Français')}</option>
                    <option value="arabe">${t('العربية', 'Arabe')}</option>
                </select>
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
    const isInstalled = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    installBtn.hidden = isInstalled;
    installBtn.addEventListener('click', async () => {
        if (deferredInstallPrompt) {
            const promptEvent = deferredInstallPrompt;
            deferredInstallPrompt = null;
            promptEvent.prompt();
            const choice = await promptEvent.userChoice;
            if (choice && choice.outcome === 'accepted') installBtn.hidden = true;
            return;
        }

        const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
        const isSafari = isIOS && /safari/i.test(navigator.userAgent) && !/crios|fxios|edgios/i.test(navigator.userAgent);
        const message = isIOS
            ? (isSafari
                ? t('لتثبيت Go SVT Maroc على جهازك: اضغط زر المشاركة في Safari، ثم اختر «إضافة إلى الشاشة الرئيسية»، وبعدها اضغط «إضافة».', 'Pour installer Go SVT Maroc : touchez Partager dans Safari, choisissez « Sur l’écran d’accueil », puis touchez « Ajouter ».')
                : t('لتثبيت التطبيق على iPhone أو iPad: افتح الموقع في Safari، اضغط زر المشاركة، ثم اختر «إضافة إلى الشاشة الرئيسية».', 'Pour installer l’application sur iPhone ou iPad : ouvrez le site dans Safari, touchez Partager, puis « Sur l’écran d’accueil ».'))
            : t('لتثبيت التطبيق: افتح قائمة المتصفح (⋮ أو …) وابحث عن «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية». يمكنك أيضاً استخدام رمز التثبيت بجانب شريط العنوان إذا ظهر.', 'Pour installer l’application : ouvrez le menu du navigateur (⋮ ou …) et choisissez « Installer l’application » ou « Ajouter à l’écran d’accueil ». Une icône d’installation peut aussi apparaître près de la barre d’adresse.');
        window.alert(message);
    });

    document.getElementById('gs-search-input').addEventListener('input', function () {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => runSearch(this.value), 150);
    });
    ['gs-search-category', 'gs-search-level', 'gs-search-language'].forEach(id => {
        const control = document.getElementById(id);
        if (control) control.addEventListener('change', () => {
            runSearch(document.getElementById('gs-search-input')?.value || '');
        });
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
function navigateTo(sectionId, options = {}) {
    const target = document.getElementById(sectionId);
    if (!target) return;

    document.querySelectorAll('.section').forEach(section => section.classList.remove('active'));
    target.classList.add('active');

    document.querySelectorAll('.main-nav a').forEach(link => {
        link.classList.toggle('active', link.getAttribute('href') === '#' + sectionId);
    });

    const nav = document.querySelector('.main-nav');
    if (nav) nav.classList.remove('active');

    if (options.updateHistory !== false && location.hash !== '#' + sectionId) {
        history.pushState({ sectionId }, '', '#' + sectionId);
    }
    window.scrollTo(0, 0);

    // Populate only the destination section; hidden sections stay idle.
    loadSection(target);

    // Student-space.js owns its debounced activation observer.
    // Do not call renderStudentSpaceContent() here: that caused a second
    // full workspace render alongside the hash/class observers.
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
    // Delegated navigation also handles links rendered later (for example,
    // the quick-access links inside the dynamically rendered student space).
    if (document.documentElement.dataset.gosvtNavigationBound === 'true') return;
    document.documentElement.dataset.gosvtNavigationBound = 'true';

    document.addEventListener('click', function (e) {
        const anchor = e.target && e.target.closest
            ? e.target.closest('a[href^="#"]')
            : null;
        if (!anchor) return;

        const href = anchor.getAttribute('href') || '';
        const id = href.slice(1);
        if (!id || !document.getElementById(id)) return;

        e.preventDefault();
        navigateTo(id);
    });

    // Keep the visible section synchronized with browser Back/Forward navigation.
    window.addEventListener('popstate', function () {
        const id = location.hash.replace(/^#/, '');
        if (id && document.getElementById(id)?.classList.contains('section')) {
            navigateTo(id, { updateHistory: false });
        } else {
            navigateTo('accueil', { updateHistory: false });
        }
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
document.addEventListener('error', e => {
    const image = e.target;
    if (!image || image.tagName !== 'IMG' || !image.closest('.image-thumbnail[data-preview-path]')) return;
    const thumbnail = image.closest('.image-thumbnail[data-preview-path]');
    const fallback = document.createElement('span');
    fallback.className = 'image-thumbnail-fallback';
    fallback.setAttribute('role', 'status');
    fallback.textContent = t('تعذر تحميل معاينة الصورة', 'Aperçu de l’image indisponible');
    thumbnail.replaceChildren(fallback);
    thumbnail.removeAttribute('data-preview-path');
    thumbnail.removeAttribute('role');
    thumbnail.removeAttribute('tabindex');
    thumbnail.removeAttribute('aria-label');
}, true);

document.addEventListener('click', e => {
    const retryPdf = e.target.closest('.pdf-thumbnail-retry');
    if (retryPdf) {
        const thumbnail = retryPdf.closest('[data-pdf-thumbnail]');
        if (thumbnail) {
            delete thumbnail.dataset.previewFailed;
            delete thumbnail.dataset.rendered;
            thumbnail.innerHTML = `<span class="thumbnail-loading">${t('جاري إعادة إعداد المعاينة...', 'Nouvelle tentative de préparation...')}</span>`;
            queuePdfThumbnail(thumbnail);
        }
        return;
    }

    const imagePreview = e.target.closest('.image-thumbnail[data-preview-path]');
    if (imagePreview) { openPreview(imagePreview.dataset.previewPath); return; }

    const previewBtn = e.target.closest('.preview-btn');
    if (previewBtn) { openPreview(previewBtn.dataset.path); return; }

    const downloadBtn = e.target.closest('.download-btn[data-path]');
    if (downloadBtn) { trackEvent('telechargement', downloadBtn.dataset.path); return; }

    const closeBtn = e.target.closest('.gs-close');
    if (closeBtn) { closeModal(closeBtn.closest('.gs-modal')); return; }

    if (e.target.classList && e.target.classList.contains('gs-modal')) closeModal(e.target);
});

document.addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target && e.target.matches('.image-thumbnail[data-preview-path]')) {
        e.preventDefault();
        openPreview(e.target.dataset.previewPath);
        return;
    }
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
    // Watch dynamically rendered content so PDF previews are queued even when
    // a section is populated after its initial loading pass.
    startPdfThumbnailAutoObserver();

    const initial = location.hash.substring(1);
    const target = initial && document.getElementById(initial);
    if (target && target.classList.contains('section')) navigateTo(initial, { updateHistory: false });

    reloadAllSections();
});
