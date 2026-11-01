/* Go SVT Maroc - Integration entre Student Space et systèmes existants */
(function () {
    'use strict';

    // Attendre que StudentSpace soit chargé
    function waitForStudentSpace(callback) {
        if (window.StudentSpace) {
            callback();
        } else {
            setTimeout(() => waitForStudentSpace(callback), 100);
        }
    }

    // ============================================
    // 1. INTEGRATION QUIZ - Sauvegarde automatique
    // ============================================
    function integrateQuizSystem() {
        // Intercepter les clics sur les options de quiz
        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                mutation.addedNodes.forEach(function(node) {
                    if (node.nodeType === 1) {
                        const quizOpts = node.querySelectorAll ? node.querySelectorAll('.quiz-opt') : [];
                        if (quizOpts.length > 0) {
                            attachQuizListeners(node);
                        }
                    }
                });
            });
        });

        observer.observe(document.body, { childList: true, subtree: true });

        // Attacher aux quiz existants déjà chargés
        document.querySelectorAll('.quiz-opt').forEach(function(opt) {
            const quizQ = opt.closest('.quiz-q');
            if (quizQ) attachQuizListeners(quizQ);
        });
    }

    function attachQuizListeners(quizContainer) {
        if (!quizContainer._quizIntegrated) {
            quizContainer._quizIntegrated = true;
            
            quizContainer.addEventListener('click', function(e) {
                const opt = e.target.closest('.quiz-opt');
                if (!opt) return;

                const isCorrect = opt.classList.contains('correct');
                const isWrong = opt.classList.contains('wrong');
                
                if (isCorrect || isWrong) {
                    // Sauvegarder la réponse
                    const questionText = quizContainer.querySelector('h3')?.textContent || '';
                    const wrongAnswer = isWrong ? opt.textContent : null;
                    
                    if (window.StudentSpace) {
                        const progress = window.StudentSpace.getDashboardStats();
                        
                        // Si c'est la dernière question, sauvegarder le résultat complet
                        const quizResult = quizContainer.closest('#quizResult');
                        if (quizResult) {
                            setTimeout(function() {
                                const scoreText = quizResult.querySelector('h3')?.textContent || '0 / 0';
                                const match = scoreText.match(/(\d+)\s*\/\s*(\d+)/);
                                if (match) {
                                    const score = parseInt(match[1]);
                                    const total = parseInt(match[2]);
                                    
                                    // Générer un ID unique pour ce quiz
                                    const quizId = 'quiz_' + Date.now();
                                    
                                    // Sauvegarder les erreurs
                                    const mistakes = [];
                                    quizContainer.querySelectorAll('.quiz-opt.wrong').forEach(function(wrongOpt) {
                                        mistakes.push({
                                            question: questionText,
                                            answer: wrongOpt.textContent,
                                            correct: quizContainer.querySelector('.quiz-opt.correct')?.textContent || ''
                                        });
                                    });
                                    
                                    window.StudentSpace.saveQuizResult(quizId, score, total, mistakes);
                                }
                            }, 100);
                        }
                    }
                }
            });
        }
    }

    // ============================================
    // 2. INTEGRATION DOWNLOAD - Suivi des leçons consultées
    // ============================================
    function integrateDownloadTracking() {
        document.addEventListener('click', function(e) {
            const downloadBtn = e.target.closest('.download-btn, a[target="_blank"]');
            if (!downloadBtn) return;

            const href = downloadBtn.getAttribute('href');
            if (!href) return;

            // Identifier le type de contenu
            let contentType = 'lesson';
            if (href.includes('/exercices/')) contentType = 'exercise';
            if (href.includes('/examens/')) contentType = 'exam';
            if (href.includes('/resumes/')) contentType = 'resume';

            // Mettre à jour la progression
            if (window.StudentSpace) {
                window.StudentSpace.updateProgress(contentType, href);
            }
        });
    }

    // ============================================
    // 3. INTEGRATION FAVORITES - Synchronisation
    // ============================================
    function syncFavorites() {
        // Les favoris sont déjà gérés par favorites.js
        // Student Space lit simplement depuis la même clé
        setInterval(function() {
            if (window.StudentSpace && document.getElementById('panel-favorites')) {
                // Rafraîchir l'affichage des favoris si nécessaire
                const container = document.getElementById('student-space-content');
                if (container && container.querySelector('.space-tab[data-tab="favorites"].active')) {
                    // Re-render favorites panel
                    const favs = JSON.parse(localStorage.getItem('gosvt_favs')) || [];
                    const favsContainer = container.querySelector('.favorites-list');
                    if (favsContainer) {
                        favsContainer.innerHTML = favs.map(fav => `
                            <div class="favorite-item">
                                <a href="${fav.url}" target="_blank">${fav.title}</a>
                                <button class="btn-remove-fav" data-url="${fav.url}">Retirer</button>
                            </div>
                        `).join('');
                    }
                }
            }
        }, 2000);
    }

    // ============================================
    // 4. INTEGRATION NOTES - Marquer leçons comme terminées
    // ============================================
    function integrateNotesSystem() {
        // Si le système de notes existe, permettre de marquer comme terminé
        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.target.id === 'student-space-content') {
                    // Re-attacher les événements après re-render
                    setTimeout(function() {
                        const container = document.getElementById('student-space-content');
                        if (container) {
                            container.querySelectorAll('.btn-complete').forEach(function(btn) {
                                btn.onclick = function() {
                                    const lessonId = this.dataset.lesson;
                                    if (window.StudentSpace) {
                                        window.StudentSpace.markLessonComplete(lessonId);
                                        // Re-render
                                        if (window.StudentSpace.getDashboardStats) {
                                            container.innerHTML = window.renderStudentSpaceContent();
                                        }
                                    }
                                };
                            });
                        }
                    }, 100);
                }
            });
        });

        observer.observe(document.body, { childList: true, subtree: true });
    }

    // ============================================
    // 5. DÉTECTION DE SESSION - Séparation entre élèves
    // ============================================
    function setupSessionDetection() {
        // localStorage est déjà séparé par navigateur
        // Chaque navigateur/utilisateur a son propre localStorage
        // Pas besoin de séparation supplémentaire
        console.log('Session: Using localStorage (per-browser separation)');
    }

    // ============================================
    // 6. INITIALISATION
    // ============================================
    function init() {
        waitForStudentSpace(function() {
            console.log('Student Space Integration: Loaded');
            
            // Intégrer avec quiz
            integrateQuizSystem();
            
            // Intégrer avec téléchargements
            integrateDownloadTracking();
            
            // Synchroniser favoris
            syncFavorites();
            
            // Intégrer notes
            integrateNotesSystem();
            
            // Détection de session
            setupSessionDetection();
        });
    }

    // Initialiser au chargement du DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
