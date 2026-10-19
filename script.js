// Data structure for courses, exercises, and fiches
const siteData = {
    cours: {
        francais: {
            TC: {
                TCS: [
                    { title: "La cellule animale", description: "Étude de la structure et des fonctions de la cellule animale" },
                    { title: "La cellule végétale", description: "Étude de la structure et des fonctions de la cellule végétale" },
                    { title: "Classification des êtres vivants", description: "Les différents groupes d'êtres vivants et leurs caractéristiques" }
                ],
                TCL: [
                    { title: "La cellule animale", description: "Étude de la structure et des fonctions de la cellule animale" },
                    { title: "La cellule végétale", description: "Étude de la structure et des fonctions de la cellule végétale" },
                    { title: "Classification des êtres vivants", description: "Les différents groupes d'êtres vivants et leurs caractéristiques" }
                ]
            },
            "1BAC": {
                "1BACSE": [
                    { title: "Organisation de la cellule", description: "Structure et fonction des organites cellulaires" },
                    { title: "Respiration cellulaire", description: "Les mécanismes de la respiration cellulaire" },
                    { title: "Photosynthèse", description: "Le processus de photosynthèse chez les plantes" }
                ],
                "1BACSM": [
                    { title: "Organisation de la cellule", description: "Structure et fonction des organites cellulaires" },
                    { title: "Respiration cellulaire", description: "Les mécanismes de la respiration cellulaire" },
                    { title: "Photosynthèse", description: "Le processus de photosynthèse chez les plantes" }
                ],
                "1BACL": [
                    { title: "Organisation de la cellule", description: "Structure et fonction des organites cellulaires" },
                    { title: "Respiration cellulaire", description: "Les mécanismes de la respiration cellulaire" },
                    { title: "Photosynthèse", description: "Le processus de photosynthèse chez les plantes" }
                ]
            },
            "2BAC": {
                "2BACSVT": [
                    { title: "Génétique", description: "Les lois de l'hérédité et la transmission des caractères" },
                    { title: "Immunologie", description: "Le système immunitaire et ses mécanismes de défense" },
                    { title: "Hormones", description: "Les hormones et leur rôle dans l'organisme" }
                ],
                "2BACSP": [
                    { title: "Génétique", description: "Les lois de l'hérédité et la transmission des caractères" },
                    { title: "Immunologie", description: "Le système immunitaire et ses mécanismes de défense" },
                    { title: "Hormones", description: "Les hormones et leur rôle dans l'organisme" }
                ],
                "2BACSM": [
                    { title: "Génétique", description: "Les lois de l'hérédité et la transmission des caractères" },
                    { title: "Immunologie", description: "Le système immunitaire et ses mécanismes de défense" },
                    { title: "Hormones", description: "Les hormones et leur rôle dans l'organisme" }
                ]
            }
        },
        arabe: {
            TC: {
                TCS: [
                    { title: "الخلية الحيوانية", description: "دراسة بنية ووظائف الخلية الحيوانية" },
                    { title: "الخلية النباتية", description: "دراسة بنية ووظائف الخلية النباتية" },
                    { title: "تصنيف الكائنات الحية", description: "المجموعات المختلفة للكائنات الحية وخصائصها" }
                ],
                TCL: [
                    { title: "الخلية الحيوانية", description: "دراسة بنية ووظائف الخلية الحيوانية" },
                    { title: "الخلية النباتية", description: "دراسة بنية ووظائف الخلية النباتية" },
                    { title: "تصنيف الكائنات الحية", description: "المجموعات المختلفة للكائنات الحية وخصائصها" }
                ]
            },
            "1BAC": {
                "1BACSE": [
                    { title: "تنظيم الخلية", description: "بنية ووظيفة العضيات الخلوية" },
                    { title: "التنفس الخلوي", description: "آليات التنفس الخلوي" },
                    { title: "التمثيل الضوئي", description: "عملية التمثيل الضوئي عند النباتات" }
                ],
                "1BACSM": [
                    { title: "تنظيم الخلية", description: "بنية ووظيفة العضيات الخلوية" },
                    { title: "التنفس الخلوي", description: "آليات التنفس الخلوي" },
                    { title: "التمثيل الضوئي", description: "عملية التمثيل الضوئي عند النباتات" }
                ],
                "1BACL": [
                    { title: "تنظيم الخلية", description: "بنية ووظيفة العضيات الخلوية" },
                    { title: "التنفس الخلوي", description: "آليات التنفس الخلوي" },
                    { title: "التمثيل الضوئي", description: "عملية التمثيل الضوئي عند النباتات" }
                ]
            },
            "2BAC": {
                "2BACSVT": [
                    { title: "علم الوراثة", description: "قوانين الوراثة ونقل الصفات الوراثية" },
                    { title: "علم المناعة", description: "الجهاز المناعي وآليات الدفاع" },
                    { title: "الهرمونات", description: "الهرمونات ودورها في الكائن الحي" }
                ],
                "2BACSP": [
                    { title: "علم الوراثة", description: "قوانين الوراثة ونقل الصفات الوراثية" },
                    { title: "علم المناعة", description: "الجهاز المناعي وآليات الدفاع" },
                    { title: "الهرمونات", description: "الهرمونات ودورها في الكائن الحي" }
                ],
                "2BACSM": [
                    { title: "علم الوراثة", description: "قوانين الوراثة ونقل الصفات الوراثية" },
                    { title: "علم المناعة", description: "الجهاز المناعي وآليات الدفاع" },
                    { title: "الهرمونات", description: "الهرمونات ودورها في الكائن الحي" }
                ]
            }
        }
    },
    exercices: {
        francais: {
            TC: {
                TCS: [
                    { title: "Exercice 1: La cellule", description: "Exercices d'application sur la cellule animale" },
                    { title: "Exercice 2: Classification", description: "Exercices sur la classification des êtres vivants" },
                    { title: "Exercice 3: Les organites", description: "Identification des organites cellulaires" }
                ],
                TCL: [
                    { title: "Exercice 1: La cellule", description: "Exercices d'application sur la cellule animale" },
                    { title: "Exercice 2: Classification", description: "Exercices sur la classification des êtres vivants" },
                    { title: "Exercice 3: Les organites", description: "Identification des organites cellulaires" }
                ]
            },
            "1BAC": {
                "1BACSE": [
                    { title: "Exercice 1: Respiration", description: "Exercices sur la respiration cellulaire" },
                    { title: "Exercice 2: Photosynthèse", description: "Exercices sur la photosynthèse" },
                    { title: "Exercice 3: Mitose", description: "Exercices sur la division cellulaire" }
                ],
                "1BACSM": [
                    { title: "Exercice 1: Respiration", description: "Exercices sur la respiration cellulaire" },
                    { title: "Exercice 2: Photosynthèse", description: "Exercices sur la photosynthèse" },
                    { title: "Exercice 3: Mitose", description: "Exercices sur la division cellulaire" }
                ],
                "1BACL": [
                    { title: "Exercice 1: Respiration", description: "Exercices sur la respiration cellulaire" },
                    { title: "Exercice 2: Photosynthèse", description: "Exercices sur la photosynthèse" },
                    { title: "Exercice 3: Mitose", description: "Exercices sur la division cellulaire" }
                ]
            },
            "2BAC": {
                "2BACSVT": [
                    { title: "Exercice 1: Génétique", description: "Exercices sur les lois de Mendel" },
                    { title: "Exercice 2: Immunologie", description: "Exercices sur le système immunitaire" },
                    { title: "Exercice 3: Hormones", description: "Exercices sur les hormones végétales" }
                ],
                "2BACSP": [
                    { title: "Exercice 1: Génétique", description: "Exercices sur les lois de Mendel" },
                    { title: "Exercice 2: Immunologie", description: "Exercices sur le système immunitaire" },
                    { title: "Exercice 3: Hormones", description: "Exercices sur les hormones végétales" }
                ],
                "2BACSM": [
                    { title: "Exercice 1: Génétique", description: "Exercices sur les lois de Mendel" },
                    { title: "Exercice 2: Immunologie", description: "Exercices sur le système immunitaire" },
                    { title: "Exercice 3: Hormones", description: "Exercices sur les hormones végétales" }
                ]
            }
        },
        arabe: {
            TC: {
                TCS: [
                    { title: "تمرين 1: الخلية", description: "تمارين تطبيقية على الخلية الحيوانية" },
                    { title: "تمرين 2: التصنيف", description: "تمارين على تصنيف الكائنات الحية" },
                    { title: "تمرين 3: العضيات", description: "تحديد العضيات الخلوية" }
                ],
                TCL: [
                    { title: "تمرين 1: الخلية", description: "تمارين تطبيقية على الخلية الحيوانية" },
                    { title: "تمرين 2: التصنيف", description: "تمارين على تصنيف الكائنات الحية" },
                    { title: "تمرين 3: العضيات", description: "تحديد العضيات الخلوية" }
                ]
            },
            "1BAC": {
                "1BACSE": [
                    { title: "تمرين 1: التنفس", description: "تمارين على التنفس الخلوي" },
                    { title: "تمرين 2: التمثيل الضوئي", description: "تمارين على التمثيل الضوئي" },
                    { title: "تمرين 3: الانقسام", description: "تمارين على الانقسام الخلوي" }
                ],
                "1BACSM": [
                    { title: "تمرين 1: التنفس", description: "تمارين على التنفس الخلوي" },
                    { title: "تمرين 2: التمثيل الضوئي", description: "تمارين على التمثيل الضوئي" },
                    { title: "تمرين 3: الانقسام", description: "تمارين على الانقسام الخلوي" }
                ],
                "1BACL": [
                    { title: "تمرين 1: التنفس", description: "تمارين على التنفس الخلوي" },
                    { title: "تمرين 2: التمثيل الضوئي", description: "تمارين على التمثيل الضوئي" },
                    { title: "تمرين 3: الانقسام", description: "تمارين على الانقسام الخلوي" }
                ]
            },
            "2BAC": {
                "2BACSVT": [
                    { title: "تمرين 1: الوراثة", description: "تمارين على قوانين مندل" },
                    { title: "تمرين 2: المناعة", description: "تمارين على الجهاز المناعي" },
                    { title: "تمرين 3: الهرمونات", description: "تمارين على الهرمونات النباتية" }
                ],
                "2BACSP": [
                    { title: "تمرين 1: الوراثة", description: "تمارين على قوانين مندل" },
                    { title: "تمرين 2: المناعة", description: "تمارين على الجهاز المناعي" },
                    { title: "تمرين 3: الهرمونات", description: "تمارين على الهرمونات النباتية" }
                ],
                "2BACSM": [
                    { title: "تمرين 1: الوراثة", description: "تمارين على قوانين مندل" },
                    { title: "تمرين 2: المناعة", description: "تمارين على الجهاز المناعي" },
                    { title: "تمرين 3: الهرمونات", description: "تمارين على الهرمونات النباتية" }
                ]
            }
        }
    },
    fiches: {
        francais: {
            TC: {
                TCS: [
                    { title: "Fiche: La cellule", description: "Résumé complet sur la cellule animale et végétale" },
                    { title: "Fiche: Classification", description: "Tableau récapitulatif de la classification" },
                    { title: "Fiche: Les organites", description: "Fiche mémo sur les organites cellulaires" }
                ],
                TCL: [
                    { title: "Fiche: La cellule", description: "Résumé complet sur la cellule animale et végétale" },
                    { title: "Fiche: Classification", description: "Tableau récapitulatif de la classification" },
                    { title: "Fiche: Les organites", description: "Fiche mémo sur les organites cellulaires" }
                ]
            },
            "1BAC": {
                "1BACSE": [
                    { title: "Fiche: Respiration", description: "Résumé sur la respiration cellulaire" },
                    { title: "Fiche: Photosynthèse", description: "Fiche complète sur la photosynthèse" },
                    { title: "Fiche: Division cellulaire", description: "Mémo sur la mitose et la méiose" }
                ],
                "1BACSM": [
                    { title: "Fiche: Respiration", description: "Résumé sur la respiration cellulaire" },
                    { title: "Fiche: Photosynthèse", description: "Fiche complète sur la photosynthèse" },
                    { title: "Fiche: Division cellulaire", description: "Mémo sur la mitose et la méiose" }
                ],
                "1BACL": [
                    { title: "Fiche: Respiration", description: "Résumé sur la respiration cellulaire" },
                    { title: "Fiche: Photosynthèse", description: "Fiche complète sur la photosynthèse" },
                    { title: "Fiche: Division cellulaire", description: "Mémo sur la mitose et la méiose" }
                ]
            },
            "2BAC": {
                "2BACSVT": [
                    { title: "Fiche: Génétique", description: "Résumé complet sur la génétique" },
                    { title: "Fiche: Immunologie", description: "Fiche mémo sur le système immunitaire" },
                    { title: "Fiche: Hormones", description: "Tableau récapitulatif des hormones" }
                ],
                "2BACSP": [
                    { title: "Fiche: Génétique", description: "Résumé complet sur la génétique" },
                    { title: "Fiche: Immunologie", description: "Fiche mémo sur le système immunitaire" },
                    { title: "Fiche: Hormones", description: "Tableau récapitulatif des hormones" }
                ],
                "2BACSM": [
                    { title: "Fiche: Génétique", description: "Résumé complet sur la génétique" },
                    { title: "Fiche: Immunologie", description: "Fiche mémo sur le système immunitaire" },
                    { title: "Fiche: Hormones", description: "Tableau récapitulatif des hormones" }
                ]
            }
        },
        arabe: {
            TC: {
                TCS: [
                    { title: "ملخص: الخلية", description: "ملخص كامل عن الخلية الحيوانية والنباتية" },
                    { title: "ملخص: التصنيف", description: "جدول تلخيصي للتصنيف" },
                    { title: "ملخص: العضيات", description: "بطاقة مذكرة عن العضيات الخلوية" }
                ],
                TCL: [
                    { title: "ملخص: الخلية", description: "ملخص كامل عن الخلية الحيوانية والنباتية" },
                    { title: "ملخص: التصنيف", description: "جدول تلخيصي للتصنيف" },
                    { title: "ملخص: العضيات", description: "بطاقة مذكرة عن العضيات الخلوية" }
                ]
            },
            "1BAC": {
                "1BACSE": [
                    { title: "ملخص: التنفس", description: "ملخص عن التنفس الخلوي" },
                    { title: "ملخص: التمثيل الضوئي", description: "بطاقة كاملة عن التمثيل الضوئي" },
                    { title: "ملخص: الانقسام", description: "مذكرة عن الانقسام المتساوي والاختزالي" }
                ],
                "1BACSM": [
                    { title: "ملخص: التنفس", description: "ملخص عن التنفس الخلوي" },
                    { title: "ملخص: التمثيل الضوئي", description: "بطاقة كاملة عن التمثيل الضوئي" },
                    { title: "ملخص: الانقسام", description: "مذكرة عن الانقسام المتساوي والاختزالي" }
                ],
                "1BACL": [
                    { title: "ملخص: التنفس", description: "ملخص عن التنفس الخلوي" },
                    { title: "ملخص: التمثيل الضوئي", description: "بطاقة كاملة عن التمثيل الضوئي" },
                    { title: "ملخص: الانقسام", description: "مذكرة عن الانقسام المتساوي والاختزالي" }
                ]
            },
            "2BAC": {
                "2BACSVT": [
                    { title: "ملخص: الوراثة", description: "ملخص كامل عن علم الوراثة" },
                    { title: "ملخص: المناعة", description: "بطاقة مذكرة عن الجهاز المناعي" },
                    { title: "ملخص: الهرمونات", description: "جدول تلخيصي للهرمونات" }
                ],
                "2BACSP": [
                    { title: "ملخص: الوراثة", description: "ملخص كامل عن علم الوراثة" },
                    { title: "ملخص: المناعة", description: "بطاقة مذكرة عن الجهاز المناعي" },
                    { title: "ملخص: الهرمونات", description: "جدول تلخيصي للهرمونات" }
                ],
                "2BACSM": [
                    { title: "ملخص: الوراثة", description: "ملخص كامل عن علم الوراثة" },
                    { title: "ملخص: المناعة", description: "بطاقة مذكرة عن الجهاز المناعي" },
                    { title: "ملخص: الهرمونات", description: "جدول تلخيصي للهرمونات" }
                ]
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
function loadContent(type, subject, level) {
    const contentContainer = document.getElementById(`${type}-content`);
    const data = siteData[type][subject][level];
    
    let html = '';
    
    // Get sub-levels based on the main level
    const subLevels = Object.keys(data);
    
    const downloadText = currentLang === 'ar' ? '📥 تحميل' : '📥 Télécharger';
    
    subLevels.forEach(subLevel => {
        const items = data[subLevel];
        items.forEach(item => {
            html += `
                <div class="content-card">
                    <span class="level-badge">${level} - ${subLevel}</span>
                    <h3>${item.title}</h3>
                    <p>${item.description}</p>
                    <a href="#" class="download-btn">${downloadText}</a>
                </div>
            `;
        });
    });
    
    contentContainer.innerHTML = html;
}

// Tab functionality
function setupTabs() {
    // Subject tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const subject = this.dataset.subject;
            const type = this.dataset.type;
            
            // Update active state
            this.parentElement.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            currentSubject = subject;
            currentType = type;
            
            loadContent(type, subject, currentLevel);
        });
    });
    
    // Level tabs
    document.querySelectorAll('.level-tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const level = this.dataset.level;
            
            // Update active state
            this.parentElement.querySelectorAll('.level-tab-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            currentLevel = level;
            
            loadContent(currentType, currentSubject, level);
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
document.addEventListener('DOMContentLoaded', function() {
    setupTabs();
    
    // Load initial content
    loadContent('cours', 'francais', 'TC');
    
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
