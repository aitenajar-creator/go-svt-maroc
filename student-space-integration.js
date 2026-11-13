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
        // Attach to the quiz root, not to each question. The previous implementation
        // attached listeners to individual .quiz-q nodes and could never see the final result.
        const roots = document.querySelectorAll('#quizBox, [data-quiz-root]');
        roots.forEach(attachQuizListeners);

        const observer = new MutationObserver(function () {
            document.querySelectorAll('#quizBox, [data-quiz-root]').forEach(attachQuizListeners);
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    function attachQuizListeners(quizRoot) {
        if (!quizRoot || quizRoot._gosvtQuizIntegrated) return;
        quizRoot._gosvtQuizIntegrated = true;

        let quizSaved = false;
        let attemptId = createAttemptId();

        function createAttemptId() {
            return (window.crypto && crypto.randomUUID)
                ? crypto.randomUUID()
                : 'attempt_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2);
        }

        function getQuizId() {
            const questions = Array.from(quizRoot.querySelectorAll('.quiz-q[data-i]'))
                .map(q => (q.querySelector('h3')?.textContent || '').trim());
            const source = questions.join('|');
            let hash = 2166136261;
            for (let i = 0; i < source.length; i++) {
                hash ^= source.charCodeAt(i);
                hash = Math.imul(hash, 16777619);
            }
            return 'quiz_' + (hash >>> 0).toString(16);
        }

        quizRoot.addEventListener('click', function (event) {
            const target = event.target;
            if (target && target.id === 'quizRestart') {
                quizSaved = false;
                attemptId = createAttemptId();
                return;
            }
            const opt = target && target.closest ? target.closest('.quiz-opt') : null;
            if (!opt || !quizRoot.contains(opt)) return;

            // Wait until the quiz engine has updated the answer state and result panel.
            window.setTimeout(function () {
                if (quizSaved) return;
                const questions = Array.from(quizRoot.querySelectorAll('.quiz-q[data-i]'));
                if (!questions.length || !questions.every(q => q.classList.contains('quiz-done'))) return;

                const resultNode = quizRoot.querySelector('#quizResult');
                const scoreText = resultNode?.querySelector('h3')?.textContent || '';
                const match = scoreText.match(/(\d+)\s*\/\s*(\d+)/);
                if (!match) return;

                const score = Number(match[1]);
                const total = Number(match[2]);
                if (!Number.isInteger(score) || !Number.isInteger(total) || total <= 0 || score > total) return;

                const quizId = getQuizId();
                const mistakes = [];
                questions.forEach(function (questionDiv) {
                    const wrongOpt = questionDiv.querySelector('.quiz-opt.wrong');
                    const correctOpt = questionDiv.querySelector('.quiz-opt.correct');
                    if (wrongOpt) {
                        mistakes.push({
                            question: questionDiv.querySelector('h3')?.textContent || '',
                            selected: wrongOpt.textContent || '',
                            correct: correctOpt?.textContent || ''
                        });
                    }
                });

                quizSaved = true;
                if (window.StudentSpace) {
                    try {
                        window.StudentSpace.saveQuizResult(quizId, score, total, mistakes, attemptId);
                    } catch (error) {
                        quizSaved = false;
                        console.error('Student Space: impossible d’enregistrer le résultat du quiz', error);
                    }
                }
            }, 0);
        });
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
        // StudentSpace lit la clé commune au moment du rendu. Écoute aussi les
        // changements provenant d'un autre onglet, sans polling permanent.
        window.addEventListener('storage', function (event) {
            if (event.key === 'gosvt-favs' && window.StudentSpace) {
                window.StudentSpace.refresh();
            }
        });
        document.addEventListener('gosvt:favorites-updated', function () {
            if (window.StudentSpace) window.StudentSpace.refresh();
        });
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
