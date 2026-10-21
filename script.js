// ============================================================
// Go SVT Maroc - Version 2.0
// Plus d'appels à l'API GitHub (fini les erreurs 403).
// Le contenu est lu depuis manifest.json (généré automatiquement
// par GitHub Actions) et les fichiers sont servis directement
// par GitHub Pages.
// ============================================================

const GITHUB_OWNER = 'aitenajar-creator';
const GITHUB_REPO = 'go-svt-maroc';

// Base du site : vide sur gosvtmaroc.com,
// '/go-svt-maroc' si vu via aitenajar-creator.github.io
const SITE_BASE = location.hostname === `${GITHUB_OWNER}.github.io` ? `/${GITHUB_REPO}` : '';

// ---------- Manifest ----------
let manifest = null;
let manifestPromise = null;

function loadManifest() {
    if (!manifestPromise) {
        manifestPromise = fetch(`${SITE_BASE}/manifest.json?t=${Date.now()}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`manifest.json introuvable (${response.status})`);
                }
                return response.json();
            })
            .then(data => {
                manifest = data;
                return manifest;
            })
            .catch(error => {
                console.error('Erreur chargement manifest.json :', error);
                manifest = { tree: {} };
                return manifest;
            });
    }
    return manifestPromise;
}

function getNode(segments) {
    let node = manifest && manifest.tree ? manifest.tree : null;
    for (const segment of segments) {
        if (!node || typeof node !== 'object' || !(segment in node)) {
            return null;
        }
        node = node[segment];
    }
    return node;
}

// Cherche le contenu dans type/sujet/niveau, puis type/sujet, puis type
function collectContent(type, subject, level) {
    const candidates = [
        [type, subject, level],
        [type, subject],
        [type]
    ];
    for (const segments of candidates) {
        const node = getNode(segments);
        if (node && typeof node === 'object') {
            const dirNames = Object.keys(node).filter(key => key !== '__files');
            const directFiles = Array.isArray(node.__files) ? node.__files : [];
            if (directFiles.length > 0 || dirNames.length > 0) {
                return { node, segments };
            }
        }
    }
    return { node: null, segments: [] };
}

// ---------- Utilitaires ----------
function escapeHtml(text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function getFileTitle(filename) {
    const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
    return nameWithoutExt.replace(/[_-]/g, ' ');
}

function buildFileUrl(segments, filename) {
    const parts = [...segments, filename].map(encodeURIComponent);
    return `${SITE_BASE}/${parts.join('/')}`;
}

// ---------- Rendu ----------
function renderTree(node, segments, trail, level, downloadText) {
    let html = '';
    const badge = trail.length > 0 ? `${level} - ${trail.join(' / ')}` : level;

    (node.__files || []).forEach(filename => {
        const title = escapeHtml(getFileTitle(filename));
        const safeName = escapeHtml(filename);
        const url = buildFileUrl(segments, filename);
        html += `
            <div class="content-card">
                <span class="level-badge">${escapeHtml(badge)}</span>
                <h3>${title}</h3>
                <p>${safeName}</p>
                <a href="${url}" target="_blank" class="download-btn">${downloadText}</a>
            </div>
        `;
    });

    Object.keys(node)
        .filter(key => key !== '__files')
        .sort()
        .forEach(folder => {
            html += renderTree(
                node[folder],
                [...segments, folder],
                [...trail, folder],
                level,
                downloadText
            );
        });

    return html;
}

async function loadContentFromManifest(type, subject, level) {
    const contentContainer = document.getElementById(`${type}-content`);
    if (!contentContainer) return;

    const downloadText = currentLang === 'ar' ? '📥 تحميل' : '📥 Télécharger';
    const noFilesText = currentLang === 'ar' ? 'لا توجد ملفات حالياً' : 'Aucun fichier disponible pour le moment';

    try {
        await loadManifest();

        const { node, segments } = collectContent(type, subject, level);

        let html = '';
        if (node) {
            html = renderTree(node, segments, [], level, downloadText);
        }

        if (html === '') {
            html = `<p class="no-files">${noFilesText}</p>`;
        }

        contentContainer.innerHTML = html;
    } catch (error) {
        console.error('Error loading content:', error);
        contentContainer.innerHTML = `<p class="error">Error loading content. Please try again later.</p>`;
    }
}

// ---------- État courant ----------
let currentSubject = 'francais';
let currentLevel = 'TC';
let currentType = 'cours';
let currentLang = 'ar'; // 'ar' pour l'arabe, 'fr' pour le français

// ---------- Langue ----------
function switchLanguage() {
    currentLang = currentLang === 'ar' ? 'fr' : 'ar';

    document.documentElement.setAttribute('dir', currentLang === 'ar' ? 'rtl' : 'ltr');
    document.documentElement.setAttribute('lang', currentLang);

    const langBtn = document.getElementById('lang-btn-text');
    if (langBtn) {
        langBtn.textContent = currentLang === 'ar' ? 'Français' : 'العربية';
    }

    document.querySelectorAll('[data-lang-ar]').forEach(element => {
        const arText = element.getAttribute('data-lang-ar');
        const frText = element.getAttribute('data-lang-fr');

        if (currentLang === 'ar' && arText) {
            element.textContent = arText;
        } else if (currentLang === 'fr' && frText) {
            element.textContent = frText;
        }
    });

    document.title = currentLang === 'ar'
        ? 'Go SVT Maroc - مختبر علوم الحياة والأرض'
        : 'Go SVT Maroc - Laboratoire des Sciences de la Vie et de la Terre';

    // Recharger le contenu pour traduire les boutons
    if (document.getElementById(`${currentType}-content`)) {
        loadContent(currentType, currentSubject, currentLevel);
    }
}

// ---------- Navigation ----------
async function navigateTo(sectionId) {
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });

    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.classList.add('active');
    }

    document.querySelectorAll('.main-nav a').forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === '#' + sectionId) {
            link.classList.add('active');
        }
    });

    const mainNav = document.querySelector('.main-nav');
    if (mainNav) mainNav.classList.remove('active');

    window.scrollTo(0, 0);

    // Charger automatiquement le contenu de la section ouverte
    if (document.getElementById(`${sectionId}-content`)) {
        await loadContent(sectionId, currentSubject, currentLevel);
    }
}

function toggleMobileMenu() {
    document.querySelector('.main-nav').classList.toggle('active');
}

// ---------- Chargement ----------
async function loadContent(type, subject, level) {
    const contentContainer = document.getElementById(`${type}-content`);
    if (!contentContainer) return;

    contentContainer.innerHTML = '<p class="loading">جاري التحميل... / Chargement...</p>';
    currentType = type;
    await loadContentFromManifest(type, subject, level);
}

// ---------- Onglets ----------
function setupTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', async function() {
            const subject = this.dataset.subject;
            const type = this.dataset.type;

            this.parentElement.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');

            currentSubject = subject;
            currentType = type;

            await loadContent(type, subject, currentLevel);
        });
    });

    document.querySelectorAll('.level-tab-btn').forEach(btn => {
        btn.addEventListener('click', async function() {
            const level = this.dataset.level;

            this.parentElement.querySelectorAll('.level-tab-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');

            currentLevel = level;

            await loadContent(currentType, currentSubject, level);
        });
    });
}

// ---------- Formulaire de contact ----------
document.getElementById('contactForm').addEventListener('submit', function(e) {
    e.preventDefault();

    const successMessage = currentLang === 'ar'
        ? 'شكراً لك! تم إرسال رسالتك بنجاح.\nMerci! Votre message a été envoyé avec succès.'
        : 'Merci! Votre message a été envoyé avec succès.\nشكراً لك! تم إرسال رسالتك بنجاح.';

    alert(successMessage);
    this.reset();
});

// ---------- Initialisation ----------
document.addEventListener('DOMContentLoaded', async function() {
    setupTabs();

    await loadManifest();
    await loadContent('cours', 'francais', 'TC');

    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            if (href.length > 1 && document.getElementById(href.substring(1))) {
                e.preventDefault();
                navigateTo(href.substring(1));
            }
        });
    });
});
