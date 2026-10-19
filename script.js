// Data structure for courses, exercises, and fiches
const siteData = {
    cours: {
        francais: {
            TC: {
                TCS: [
                    { title: "Chapitre 1", description: "Étude de la structure et des fonctions de la cellule animale", file: "cours/francais/TC/TCS/Chapitre 1/eleves-TCS  AIT ENAJAR U1C1.pdf" },
                    { title: "Chapitre 2", description: "Étude de la structure et des fonctions de la cellule végétale", file: "cours/francais/TC/TCS/Chapitre 2/eleves-TCS  AIT ENAJAR U1C2.pdf" },
                    { title: "Chapitre 3", description: "Les différents groupes d'êtres vivants et leurs caractéristiques", file: "cours/francais/TC/TCS/Chapitre 3/eleves-TCS  AIT ENAJAR U1C3.pdf" }
                ],
                TCL: [
                    { title: "La cellule animale", description: "Étude de la structure et des fonctions de la cellule animale", file: "" },
                    { title: "La cellule végétale", description: "Étude de la structure et des fonctions de la cellule végétale", file: "" },
                    { title: "Classification des êtres vivants", description: "Les différents groupes d'êtres vivants et leurs caractéristiques", file: "" }
                ]
            },
            "1BAC": {
                "1BACSE": [
                    { title: "Organisation de la cellule", description: "Structure et fonction des organites cellulaires", file: "" },
                    { title: "Respiration cellulaire", description: "Les mécanismes de la respiration cellulaire", file: "" },
                    { title: "Photosynthèse", description: "Le processus de photosynthèse chez les plantes", file: "" }
                ],
                "1BACSM": [
                    { title: "Organisation de la cellule", description: "Structure et fonction des organites cellulaires", file: "" },
                    { title: "Respiration cellulaire", description: "Les mécanismes de la respiration cellulaire", file: "" },
                    { title: "Photosynthèse", description: "Le processus de photosynthèse chez les plantes", file: "" }
                ],
                "1BACL": [
                    { title: "Organisation de la cellule", description: "Structure et fonction des organites cellulaires", file: "" },
                    { title: "Respiration cellulaire", description: "Les mécanismes de la respiration cellulaire", file: "" },
                    { title: "Photosynthèse", description: "Le processus de photosynthèse chez les plantes", file: "" }
                ]
            },
            "2BAC": {
                "2BACSVT": [
                    { title: "Génétique", description: "Les lois de l'hérédité et la transmission des caractères", file: "" },
                    { title: "Immunologie", description: "Le système immunitaire et ses mécanismes de défense", file: "" },
                    { title: "Hormones", description: "Les hormones et leur rôle dans l'organisme", file: "" }
                ],
                "2BACSP": [
                    { title: "Génétique", description: "Les lois de l'hérédité et la transmission des caractères", file: "" },
                    { title: "Immunologie", description: "Le système immunitaire et ses mécanismes de défense", file: "" },
                    { title: "Hormones", description: "Les hormones et leur rôle dans l'organisme", file: "" }
                ],
                "2BACSM": [
                    { title: "Génétique", description: "Les lois de l'hérédité et la transmission des caractères", file: "" },
                    { title: "Immunologie", description: "Le système immunitaire et ses mécanismes de défense", file: "" },
                    { title: "Hormones", description: "Les hormones et leur rôle dans l'organisme", file: "" }
                ]
            }
        },
        arabe: {
            TC: {
                TCS: [
                    { title: "الخلية الحيوانية", description: "دراسة بنية ووظائف الخلية الحيوانية", file: "" },
                    { title: "الخلية النباتية", description: "دراسة بنية ووظائف الخلية النباتية", file: "" },
                    { title: "تصنيف الكائنات الحية", description: "المجموعات المختلفة للكائنات الحية وخصائصها", file: "" }
                ],
                TCL: [
                    { title: "الخلية الحيوانية", description: "دراسة بنية ووظائف الخلية الحيوانية", file: "" },
                    { title: "الخلية النباتية", description: "دراسة بنية ووظائف الخلية النباتية", file: "" },
                    { title: "تصنيف الكائنات الحية", description: "المجموعات المختلفة للكائنات الحية وخصائصها", file: "" }
                ]
            },
            "1BAC": {
                "1BACSE": [
                    { title: "تنظيم الخلية", description: "بنية ووظيفة العضيات الخلوية", file: "" },
                    { title: "التنفس الخلوي", description: "آليات التنفس الخلوي", file: "" },
                    { title: "التمثيل الضوئي", description: "عملية التمثيل الضوئي عند النباتات", file: "" }
                ],
                "1BACSM": [
                    { title: "تنظيم الخلية", description: "بنية ووظيفة العضيات الخلوية", file: "" },
                    { title: "التنفس الخلوي", description: "آليات التنفس الخلوي", file: "" },
                    { title: "التمثيل الضوئي", description: "عملية التمثيل الضوئي عند النباتات", file: "" }
                ],
                "1BACL": [
                    { title: "تنظيم الخلية", description: "بنية ووظيفة العضيات الخلوية", file: "" },
                    { title: "التنفس الخلوي", description: "آليات التنفس الخلوي", file: "" },
                    { title: "التمثيل الضوئي", description: "عملية التمثيل الضوئي عند النباتات", file: "" }
                ]
            },
            "2BAC": {
                "2BACSVT": [
                    { title: "علم الوراثة", description: "قوانين الوراثة ونقل الصفات الوراثية", file: "" },
                    { title: "علم المناعة", description: "الجهاز المناعي وآليات الدفاع", file: "" },
                    { title: "الهرمونات", description: "الهرمونات ودورها في الكائن الحي", file: "" }
                ],
                "2BACSP": [
                    { title: "علم الوراثة", description: "قوانين الوراثة ونقل الصفات الوراثية", file: "" },
                    { title: "علم المناعة", description: "الجهاز المناعي وآليات الدفاع", file: "" },
                    { title: "الهرمونات", description: "الهرمونات ودورها في الكائن الحي", file: "" }
                ],
                "2BACSM": [
                    { title: "علم الوراثة", description: "قوانين الوراثة ونقل الصفات الوراثية", file: "" },
                    { title: "علم المناعة", description: "الجهاز المناعي وآليات الدفاع", file: "" },
                    { title: "الهرمونات", description: "الهرمونات ودورها في الكائن الحي", file: "" }
                ]
            }
        }
    },
    exercices: {
        francais: {
            TC: {
                TCS: [
                    { title: "Exercice 1: La cellule", description: "Exercices d'application sur la cellule animale", file: "" },
                    { title: "Exercice 2: Classification", description: "Exercices sur la classification des êtres vivants", file: "" },
                    { title: "Exercice 3: Les organites", description: "Identification des organites cellulaires", file: "" }
                ],
                TCL: [
                    { title: "Exercice 1: La cellule", description: "Exercices d'application sur la cellule animale", file: "" },
                    { title: "Exercice 2: Classification", description: "Exercices sur la classification des êtres vivants", file: "" },
                    { title: "Exercice 3: Les organites", description: "Identification des organites cellulaires", file: "" }
                ]
            },
            "1BAC": {
                "1BACSE": [
                    { title: "Exercice 1: Respiration", description: "Exercices sur la respiration cellulaire", file: "" },
                    { title: "Exercice 2: Photosynthèse", description: "Exercices sur la photosynthèse", file: "" },
                    { title: "Exercice 3: Mitose", description: "Exercices sur la division cellulaire", file: "" }
                ],
                "1BACSM": [
                    { title: "Exercice 1: Respiration", description: "Exercices sur la respiration cellulaire", file: "" },
                    { title: "Exercice 2: Photosynthèse", description: "Exercices sur la photosynthèse", file: "" },
                    { title: "Exercice 3: Mitose", description: "Exercices sur la division cellulaire", file: "" }
                ],
                "1BACL": [
                    { title: "Exercice 1: Respiration", description: "Exercices sur la respiration cellulaire", file: "" },
                    { title: "Exercice 2: Photosynthèse", description: "Exercices sur la photosynthèse", file: "" },
                    { title: "Exercice 3: Mitose", description: "Exercices sur la division cellulaire", file: "" }
                ]
            },
            "2BAC": {
                "2BACSVT": [
                    { title: "Exercice 1: Génétique", description: "Exercices sur les lois de Mendel", file: "" },
                    { title: "Exercice 2: Immunologie", description: "Exercices sur le système immunitaire", file: "" },
                    { title: "Exercice 3: Hormones", description: "Exercices sur les hormones végétales", file: "" }
                ],
                "2BACSP": [
                    { title: "Exercice 1: Génétique", description: "Exercices sur les lois de Mendel", file: "" },
                    { title: "Exercice 2: Immunologie", description: "Exercices sur le système immunitaire", file: "" },
                    { title: "Exercice 3: Hormones", description: "Exercices sur les hormones végétales", file: "" }
                ],
                "2BACSM": [
                    { title: "Exercice 1: Génétique", description: "Exercices sur les lois de Mendel", file: "" },
                    { title: "Exercice 2: Immunologie", description: "Exercices sur le système immunitaire", file: "" },
                    { title: "Exercice 3: Hormones", description: "Exercices sur les hormones végétales", file: "" }
                ]
            }
        },
        arabe: {
            TC: {
                TCS: [
                    { title: "تمرين 1: الخلية", description: "تمارين تطبيقية على الخلية الحيوانية", file: "" },
                    { title: "تمرين 2: التصنيف", description: "تمارين على تصنيف الكائنات الحية", file: "" },
                    { title: "تمرين 3: العضيات", description: "تحديد العضيات الخلوية", file: "" }
                ],
                TCL: [
                    { title: "تمرين 1: الخلية", description: "تمارين تطبيقية على الخلية الحيوانية", file: "" },
                    { title: "تمرين 2: التصنيف", description: "تمارين على تصنيف الكائنات الحية", file: "" },
                    { title: "تمرين 3: العضيات", description: "تحديد العضيات الخلوية", file: "" }
                ]
            },
            "1BAC": {
                "1BACSE": [
                    { title: "تمرين 1: التنفس", description: "تمارين على التنفس الخلوي", file: "" },
                    { title: "تمرين 2: التمثيل الضوئي", description: "تمارين على التمثيل الضوئي", file: "" },
                    { title: "تمرين 3: الانقسام", description: "تمارين على الانقسام الخلوي", file: "" }
                ],
                "1BACSM": [
                    { title: "تمرين 1: التنفس", description: "تمارين على التنفس الخلوي", file: "" },
                    { title: "تمرين 2: التمثيل الضوئي", description: "تمارين على التمثيل الضوئي", file: "" },
                    { title: "تمرين 3: الانقسام", description: "تمارين على الانقسام الخلوي", file: "" }
                ],
                "1BACL": [
                    { title: "تمرين 1: التنفس", description: "تمارين على التنفس الخلوي", file: "" },
                    { title: "تمرين 2: التمثيل الضوئي", description: "تمارين على التمثيل الضوئي", file: "" },
                    { title: "تمرين 3: الانقسام", description: "تمارين على الانقسام الخلوي", file: "" }
                ]
            },
            "2BAC": {
                "2BACSVT": [
                    { title: "تمرين 1: الوراثة", description: "تمارين على قوانين مندل", file: "" },
                    { title: "تمرين 2: المناعة", description: "تمارين على الجهاز المناعي", file: "" },
                    { title: "تمرين 3: الهرمونات", description: "تمارين على الهرمونات النباتية", file: "" }
                ],
                "2BACSP": [
                    { title: "تمرين 1: الوراثة", description: "تمارين على قوانين مندل", file: "" },
                    { title: "تمرين 2: المناعة", description: "تمارين على الجهاز المناعي", file: "" },
                    { title: "تمرين 3: الهرمونات", description: "تمارين على الهرمونات النباتية", file: "" }
                ],
                "2BACSM": [
                    { title: "تمرين 1: الوراثة", description: "تمارين على قوانين مندل", file: "" },
                    { title: "تمرين 2: المناعة", description: "تمارين على الجهاز المناعي", file: "" },
                    { title: "تمرين 3: الهرمونات", description: "تمارين على الهرمونات النباتية", file: "" }
                ]
            }
        }
    },
    fiches: {
        francais: {
            TC: {
                TCS: [
                    { title: "Fiche: La cellule", description: "Résumé complet sur la cellule animale et végétale", file: "" },
                    { title: "Fiche: Classification", description: "Tableau récapitulatif de la classification", file: "" },
                    { title: "Fiche: Les organites", description: "Fiche mémo sur les organites cellulaires", file: "" }
                ],
                TCL: [
                    { title: "Fiche: La cellule", description: "Résumé complet sur la cellule animale et végétale", file: "" },
                    { title: "Fiche: Classification", description: "Tableau récapitulatif de la classification", file: "" },
                    { title: "Fiche: Les organites", description: "Fiche mémo sur les organites cellulaires", file: "" }
                ]
            },
            "1BAC": {
                "1BACSE": [
                    { title: "Fiche: Respiration", description: "Résumé sur la respiration cellulaire", file: "" },
                    { title: "Fiche: Photosynthèse", description: "Fiche complète sur la photosynthèse", file: "" },
                    { title: "Fiche: Division cellulaire", description: "Mémo sur la mitose et la méiose", file: "" }
                ],
                "1BACSM": [
                    { title: "Fiche: Respiration", description: "Résumé sur la respiration cellulaire", file: "" },
                    { title: "Fiche: Photosynthèse", description: "Fiche complète sur la photosynthèse", file: "" },
                    { title: "Fiche: Division cellulaire", description: "Mémo sur la mitose et la méiose", file: "" }
                ],
                "1BACL": [
                    { title: "Fiche: Respiration", description: "Résumé sur la respiration cellulaire", file: "" },
                    { title: "Fiche: Photosynthèse", description: "Fiche complète sur la photosynthèse", file: "" },
                    { title: "Fiche: Division cellulaire", description: "Mémo sur la mitose et la méiose", file: "" }
                ]
            },
            "2BAC": {
                "2BACSVT": [
                    { title: "Fiche: Génétique", description: "Résumé complet sur la génétique", file: "" },
                    { title: "Fiche: Immunologie", description: "Fiche mémo sur le système immunitaire", file: "" },
                    { title: "Fiche: Hormones", description: "Tableau récapitulatif des hormones", file: "" }
                ],
                "2BACSP": [
                    { title: "Fiche: Génétique", description: "Résumé complet sur la génétique", file: "" },
                    { title: "Fiche: Immunologie", description: "Fiche mémo sur le système immunitaire", file: "" },
                    { title: "Fiche: Hormones", description: "Tableau récapitulatif des hormones", file: "" }
                ],
                "2BACSM": [
                    { title: "Fiche: Génétique", description: "Résumé complet sur la génétique", file: "" },
                    { title: "Fiche: Immunologie", description: "Fiche mémo sur le système immunitaire", file: "" },
                    { title: "Fiche: Hormones", description: "Tableau récapitulatif des hormones", file: "" }
                ]
            }
        },
        arabe: {
            TC: {
                TCS: [
                    { title: "ملخص: الخلية", description: "ملخص كامل عن الخلية الحيوانية والنباتية", file: "" },
                    { title: "ملخص: التصنيف", description: "جدول تلخيصي للتصنيف", file: "" },
                    { title: "ملخص: العضيات", description: "بطاقة مذكرة عن العضيات الخلوية", file: "" }
                ],
                TCL: [
                    { title: "ملخص: الخلية", description: "ملخص كامل عن الخلية الحيوانية والنباتية", file: "" },
                    { title: "ملخص: التصنيف", description: "جدول تلخيصي للتصنيف", file: "" },
                    { title: "ملخص: العضيات", description: "بطاقة مذكرة عن العضيات الخلوية", file: "" }
                ]
            },
            "1BAC": {
                "1BACSE": [
                    { title: "ملخص: التنفس", description: "ملخص عن التنفس الخلوي", file: "" },
                    { title: "ملخص: التمثيل الضوئي", description: "بطاقة كاملة عن التمثيل الضوئي", file: "" },
                    { title: "ملخص: الانقسام", description: "مذكرة عن الانقسام المتساوي والاختزالي", file: "" }
                ],
                "1BACSM": [
                    { title: "ملخص: التنفس", description: "ملخص عن التنفس الخلوي", file: "" },
                    { title: "ملخص: التمثيل الضوئي", description: "بطاقة كاملة عن التمثيل الضوئي", file: "" },
                    { title: "ملخص: الانقسام", description: "مذكرة عن الانقسام المتساوي والاختزالي", file: "" }
                ],
                "1BACL": [
                    { title: "ملخص: التنفس", description: "ملخص عن التنفس الخلوي", file: "" },
                    { title: "ملخص: التمثيل الضوئي", description: "بطاقة كاملة عن التمثيل الضوئي", file: "" },
                    { title: "ملخص: الانقسام", description: "مذكرة عن الانقسام المتساوي والاختزالي", file: "" }
                ]
            },
            "2BAC": {
                "2BACSVT": [
                    { title: "ملخص: الوراثة", description: "ملخص كامل عن علم الوراثة", file: "" },
                    { title: "ملخص: المناعة", description: "بطاقة مذكرة عن الجهاز المناعي", file: "" },
                    { title: "ملخص: الهرمونات", description: "جدول تلخيصي للهرمونات", file: "" }
                ],
                "2BACSP": [
                    { title: "ملخص: الوراثة", description: "ملخص كامل عن علم الوراثة", file: "" },
                    { title: "ملخص: المناعة", description: "بطاقة مذكرة عن الجهاز المناعي", file: "" },
                    { title: "ملخص: الهرمونات", description: "جدول تلخيصي للهرمونات", file: "" }
                ],
                "2BACSM": [
                    { title: "ملخص: الوراثة", description: "ملخص كامل عن علم الوراثة", file: "" },
                    { title: "ملخص: المناعة", description: "بطاقة مذكرة عن الجهاز المناعي", file: "" },
                    { title: "ملخص: الهرمونات", description: "جدول تلخيصي للهرمونات", file: "" }
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
    const noFileText = currentLang === 'ar' ? 'قريباً' : 'Bientôt disponible';

    subLevels.forEach(subLevel => {
        const items = data[subLevel];
        items.forEach(item => {
            // Check if file path exists
            if (item.file && item.file !== '') {
                html += `
                    <div class="content-card">
                        <span class="level-badge">${level} - ${subLevel}</span>
                        <h3>${item.title}</h3>
                        <p>${item.description}</p>
                        <a href="${item.file}" target="_blank" class="download-btn">${downloadText}</a>
                    </div>
                `;
            } else {
                html += `
                    <div class="content-card">
                        <span class="level-badge">${level} - ${subLevel}</span>
                        <h3>${item.title}</h3>
                        <p>${item.description}</p>
                        <span class="download-btn disabled">${noFileText}</span>
                    </div>
                `;
            }
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
