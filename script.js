// GitHub API Configuration
const GITHUB_OWNER = 'aitenajar-creator';
const GITHUB_REPO = 'go-svt-maroc';
const GITHUB_API_BASE = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents`;

// Cache for GitHub API responses
const githubCache = {};

// Fetch files from GitHub API
async function fetchGitHubFiles(path) {
    if (githubCache[path]) {
        return githubCache[path];
    }

    try {
        const response = await fetch(`${GITHUB_API_BASE}/${path}`);
        if (!response.ok) {
            console.error(`Failed to fetch ${path}:`, response.statusText);
            return [];
        }

        const data = await response.json();
        const files = data.filter(item => item.type === 'file');
        githubCache[path] = files;
        return files;
    } catch (error) {
        console.error(`Error fetching ${path}:`, error);
        return [];
    }
}

// Get file title from filename
function getFileTitle(filename) {
    // Remove extension
    const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
    // Replace underscores and hyphens with spaces
    return nameWithoutExt.replace(/[_-]/g, ' ');
}

// Load content dynamically from GitHub
async function loadContentFromGitHub(type, subject, level) {
    const contentContainer = document.getElementById(`${type}-content`);
    const basePath = `${type}/${subject}/${level}`;
    
    let html = '';
    const downloadText = currentLang === 'ar' ? '📥 تحميل' : '📥 Télécharger';
    const noFilesText = currentLang === 'ar' ? 'لا توجد ملفات حالياً' : 'Aucun fichier disponible pour le moment';

    try {
        // Fetch all sub-level folders
        const response = await fetch(`${GITHUB_API_BASE}/${basePath}`);
        if (!response.ok) {
            throw new Error('Failed to fetch directory');
        }

        const data = await response.json();
        const folders = data.filter(item => item.type === 'dir');

        if (folders.length === 0) {
            // No sub-level folders, look for files directly
            const files = await fetchGitHubFiles(basePath);
            if (files.length === 0) {
                html = `<p class="no-files">${noFilesText}</p>`;
            } else {
                files.forEach(file => {
                    const title = getFileTitle(file.name);
                    html += `
                        <div class="content-card">
                            <span class="level-badge">${level}</span>
                            <h3>${title}</h3>
                            <p>${file.name}</p>
                            <a href="${file.download_url}" target="_blank" class="download-btn">${downloadText}</a>
                        </div>
                    `;
                });
            }
        } else {
            // Files are in sub-level folders
            for (const folder of folders) {
                const subLevelPath = `${basePath}/${folder.name}`;
                const files = await fetchGitHubFiles(subLevelPath);
                
                files.forEach(file => {
                    const title = getFileTitle(file.name);
                    html += `
                        <div class="content-card">
                            <span class="level-badge">${level} - ${folder.name}</span>
                            <h3>${title}</h3>
                            <p>${file.name}</p>
                            <a href="${file.download_url}" target="_blank" class="download-btn">${downloadText}</a>
                        </div>
                    `;
                });
            }
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

// Data structure for courses, exercises, and fiches (kept for reference but not used)
const siteData = {
    cours: {
        francais: {
            TC: {
                TCS: [],
                TCL: []
            },
            "1BAC": {
                "1BACSE": [],
                "1BACSM": [],
                "1BACL": []
            },
            "2BAC": {
                "2BACSVT": [],
                "2BACSP": [],
                "2BACSM": []
            }
        },
        arabe: {
            TC: {
                TCS: [],
                TCL: []
            },
            "1BAC": {
                "1BACSE": [],
                "1BACSM": [],
                "1BACL": []
            },
            "2BAC": {
                "2BACSVT": [],
                "2BACSP": [],
                "2BACSM": []
            }
        }
    },
    exercices: {
        francais: {
            TC: {
                TCS: [],
                TCL: []
            },
            "1BAC": {
                "1BACSE": [],
                "1BACSM": [],
                "1BACL": []
            },
            "2BAC": {
                "2BACSVT": [],
                "2BACSP": [],
                "2BACSM": []
            }
        },
        arabe: {
            TC: {
                TCS: [],
                TCL: []
            },
            "1BAC": {
                "1BACSE": [],
                "1BACSM": [],
                "1BACL": []
            },
            "2BAC": {
                "2BACSVT": [],
                "2BACSP": [],
                "2BACSM": []
            }
        }
    },
    fiches: {
        francais: {
            TC: {
                TCS: [],
                TCL: []
            },
            "1BAC": {
                "1BACSE": [],
                "1BACSM": [],
                "1BACL": []
            },
            "2BAC": {
                "2BACSVT": [],
                "2BACSP": [],
                "2BACSM": []
            }
        },
        arabe: {
            TC: {
                TCS: [],
                TCL: []
            },
            "1BAC": {
                "1BACSE": [],
                "1BACSM": [],
                "1BACL": []
            },
            "2BAC": {
                "2BACSVT": [],
                "2BACSP": [],
                "2BACSM": []
            }
        }
    }
};

// Current state
let currentSubject = 'francais';
let currentLevel = 'TC';
let currentType = 'cours';
let currentLang = 'ar'; // 'ar' for Arabic, 'fr' for French

// Language switching function
function switchLanguage() {
    currentLang = currentLang === 'ar' ? 'fr' : 'ar';
    
    // Update HTML direction and lang attribute
    document.documentElement.setAttribute('dir', currentLang === 'ar' ? 'rtl' : 'ltr');
    document.documentElement.setAttribute('lang', currentLang);
    
    // Update language button text
    const langBtn = document.getElementById('lang-btn-text');
    langBtn.textContent = currentLang === 'ar' ? 'Français' : 'العربية';
    
    // Update all elements with data-lang attributes
    document.querySelectorAll('[data-lang-ar]').forEach(element => {
        const arText = element.getAttribute('data-lang-ar');
        const frText = element.getAttribute('data-lang-fr');
        
        if (currentLang === 'ar' && arText) {
            element.textContent = arText;
        } else if (currentLang === 'fr' && frText) {
            element.textContent = frText;
        }
    });
    
    // Update title
    document.title = currentLang === 'ar'
        ? 'Go SVT Maroc - مختبر علوم الحياة والأرض'
        : 'Go SVT Maroc - Laboratoire des Sciences de la Vie et de la Terre';
}

// Navigation functionality
function navigateTo(sectionId) {
    // Hide all sections
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });
    
    // Show target section
    document.getElementById(sectionId).classList.add('active');
    
    // Update nav links
    document.querySelectorAll('.main-nav a').forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === '#' + sectionId) {
            link.classList.add('active');
        }
    });
    
    // Close mobile menu
    document.querySelector('.main-nav').classList.remove('active');
    
    // Scroll to top
    window.scrollTo(0, 0);
}

// Mobile menu toggle
function toggleMobileMenu() {
    document.querySelector('.main-nav').classList.toggle('active');
}

// Load content based on subject, level, and type
async function loadContent(type, subject, level) {
    const contentContainer = document.getElementById(`${type}-content`);
    
    // Show loading indicator
    contentContainer.innerHTML = '<p class="loading">جاري التحميل... / Chargement...</p>';
    
    // Load content from GitHub API
    await loadContentFromGitHub(type, subject, level);
}

// Tab functionality
function setupTabs() {
    // Subject tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', async function() {
            const subject = this.dataset.subject;
            const type = this.dataset.type;
            
            // Update active state
            this.parentElement.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            currentSubject = subject;
            currentType = type;
            
            await loadContent(type, subject, currentLevel);
        });
    });
    
    // Level tabs
    document.querySelectorAll('.level-tab-btn').forEach(btn => {
        btn.addEventListener('click', async function() {
            const level = this.dataset.level;
            
            // Update active state
            this.parentElement.querySelectorAll('.level-tab-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            currentLevel = level;
            
            await loadContent(currentType, currentSubject, level);
        });
    });
}

// Navigation link handlers
document.querySelectorAll('.main-nav a').forEach(link => {
    link.addEventListener('click', function(e) {
        e.preventDefault();
        const sectionId = this.getAttribute('href').substring(1);
        navigateTo(sectionId);
    });
});

// Contact form handling
document.getElementById('contactForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const name = document.getElementById('name').value;
    const email = document.getElementById('email').value;
    const subject = document.getElementById('subject').value;
    const message = document.getElementById('message').value;
    
    // Here you would typically send the data to a server
    const successMessage = currentLang === 'ar'
        ? 'شكراً لك! تم إرسال رسالتك بنجاح.\nMerci! Votre message a été envoyé avec succès.'
        : 'Merci! Votre message a été envoyé avec succès.\nشكراً لك! تم إرسال رسالتك بنجاح.';
    
    alert(successMessage);
    
    // Reset form
    this.reset();
});

// Initialize
document.addEventListener('DOMContentLoaded', async function() {
    setupTabs();
    
    // Load initial content
    await loadContent('cours', 'francais', 'TC');
    
    // Setup section navigation
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            if (href.startsWith('#') && document.getElementById(href.substring(1))) {
                e.preventDefault();
                navigateTo(href.substring(1));
            }
        });
    });
});
