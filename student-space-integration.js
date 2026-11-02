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
            
            // Generate stable quiz ID based on content
            function getQuizId() {
                const questions = quizContainer.querySelectorAll('.quiz-q');
                let quizHash = '';
                questions.forEach((q, index) => {
                    const questionText = q.querySelector('h3')?.textContent || '';
                    quizHash += questionText.substring(0, 20) + index;
                });
                return 'quiz_' + quizHash.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
            }

            let quizSaved = false;
            
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
                        if (quizResult && !quizSaved) {
                            quizSaved = true; // Prevent duplicate saves
                            
                            setTimeout(function() {
                                const scoreText = quizResult.querySelector('h3')?.textContent || '0 / 0';
                                const match = scoreText.match(/(\d+)\s*\/\s*(\d+)/);
                                if (match) {
                                    const score = parseInt(match[1]);
                                    const total = parseInt(match[2]);
                                    
                                    // Use stable quiz ID
                                    const quizId = getQuizId();
                                    
                                    // Sauvegarder les erreurs avec tous les détails
                                    const mistakes = [];
                                    quizContainer.querySelectorAll('.quiz-q').forEach(function(questionDiv) {
                                        const wrongOpt = questionDiv.querySelector('.quiz-opt.wrong');
                                        const correctOpt = questionDiv.querySelector('.quiz-opt.correct');
                                        const qText = questionDiv.querySelector('h3')?.textContent || '';
                                        
                                        if (wrongOpt) {
                                            mistakes.push({
                                                question: qText,
                                                selected: wrongOpt.textContent,
                                                correct: correctOpt?.textContent || '',
                                                date: Date.now(),
                                                quizId: quizId
                                            });
                                        }
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
        // Dossier du site -> catégorie de suivi. Les fiches, résumés, documents... ne sont
        // pas des "leçons" : ils ne sont pas comptés dans « Leçons consultées ».
        var FOLDER_TO_TYPE = { cours: 'lesson', exercices: 'exercise', examens: 'exam' };

        // Chemin canonique (sans domaine, sans "/" initial, décodé, NFC) à partir
        // d'un data-path ("/cours/francais/TC/x.pdf") ou d'un href encodé/absolu.
        function toPath(raw) {
            if (!raw) return '';
            var p = String(raw);
            if (/^[a-z][a-z0-9+.-]*:/i.test(p) || p.indexOf('%') !== -1) {
                try { p = new URL(p, location.href).pathname; } catch (e) { /* garder tel quel */ }
            }
            try { p = decodeURIComponent(p); } catch (e) { /* déjà décodé */ }
            return p.normalize('NFC').replace(/^\/+/, '');
        }

        function titleFor(path) {
            var name = path.split('/').pop();
            return (typeof window.getFileTitle === 'function')
                ? window.getFileTitle(name)
                : name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
        }

        // Anti double comptage si deux mécanismes signalent la même ouverture
        var lastSeen = {};
        function trackOpen(rawPath) {
            if (!window.StudentSpace) return;
            var path = toPath(rawPath);
            var type = FOLDER_TO_TYPE[path.split('/')[0]];
            if (!type) return;
            var now = Date.now();
            if (lastSeen[path] && now - lastSeen[path] < 1000) return;
            lastSeen[path] = now;
            try {
                window.StudentSpace.updateProgress(type, path, { title: titleFor(path), path: path });
            } catch (err) {
                console.error('Student Space: suivi impossible', err);
            }
        }

        // (a) Aperçu / visionneuse PDF : toutes les ouvertures passent par openPreview()
        //     (bouton « Aperçu », résultats de recherche, ouverture programmatique).
        if (typeof window.openPreview === 'function' && !window.openPreview._gosvtTracked) {
            var originalOpenPreview = window.openPreview;
            var wrapped = function (path) {
                trackOpen(path);
                return originalOpenPreview.apply(this, arguments);
            };
            wrapped._gosvtTracked = true;
            window.openPreview = wrapped;
            try { openPreview = wrapped; } catch (e) { /* variable globale non modifiable */ }
        }

        // (b) Clics : phase de capture pour ne pas dépendre des stopPropagation d'autres scripts.
        document.addEventListener('click', function (e) {
            var el = e.target && e.target.closest ? e.target : null;
            if (!el) return;

            // Bouton « Télécharger » de chaque carte : <a download class="download-btn" data-path>
            // Bouton « Vidéo » d'un cours : <button class="gs-video-btn" data-path>
            var withPath = el.closest('.download-btn[data-path], .gs-video-btn[data-path]');
            if (withPath) { trackOpen(withPath.getAttribute('data-path')); return; }

            // « Mes favoris » : <a class="download-btn" target="_blank" href=...> (sans data-path)
            var link = el.closest('a.download-btn[href], a[target="_blank"][href]');
            if (link && !link.closest('.gs-modal')) trackOpen(link.getAttribute('href'));
        }, true);
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
                                        if (window.StudentSpace.refresh) {
                                            window.StudentSpace.refresh();
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
        // Le système de profils gère maintenant la séparation
        // Chaque profil a ses propres données
        console.log('Session: Using profile system (per-profile separation)');
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
