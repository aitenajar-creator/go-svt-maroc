/* Go SVT Maroc - Espace Élève - ملف مستقل للبود */
(function () {
    'use strict';

    // ============================================
    // 1. STORAGE SYSTEM (نظام التخزين)
    // ============================================
    const STORAGE_KEYS = {
        PROGRESS: 'gosvt_progress',
        QUIZ_RESULTS: 'gosvt_quiz_results',
        MISTAKES: 'gosvt_mistakes',
        STREAK: 'gosvt_streak',
        GOALS: 'gosvt_goals',
        LAST_VISIT: 'gosvt_last_visit'
    };

    const storage = {
        get(key) {
            try {
                return JSON.parse(localStorage.getItem(key));
            } catch (e) {
                return null;
            }
        },
        set(key, value) {
            try {
                localStorage.setItem(key, JSON.stringify(value));
            } catch (e) {
                console.error('Storage error:', e);
            }
        }
    };

    // ============================================
    // 2. LANGUAGE SYSTEM (نظام اللغة)
    // ============================================
    function lang() {
        return document.documentElement.getAttribute('lang') === 'fr' ? 'fr' : 'ar';
    }

    const TEXTS = {
        ar: {
            title: 'مساحتي',
            dashboard: 'لوحة القيادة',
            progress: 'المتابعة التربوية',
            history: 'سجل التقييمات',
            mistakes: 'أخطائي',
            favorites: 'مفضلتي',
            motivation: 'التحفيز',
            lessonsViewed: 'الدروس المشاهدة',
            exercisesDone: 'التمارين المنجزة',
            testsTaken: 'الاختبارات المجراة',
            averageScore: 'المعدل',
            globalProgress: 'التقدم العام',
            completedLessons: 'الدروس المكتملة',
            pendingLessons: 'الدروس المتبقية',
            markAsComplete: 'تحديد كمكتمل',
            noData: 'لا توجد بيانات بعد',
            streak: 'أيام متتالية',
            goals: 'الأهداف التربوية',
            encouragement: 'استمر في العمل الممتاز!',
            date: 'التاريخ',
            score: 'النتيجة',
            best: 'الأفضل',
            review: 'مراجعة',
            retry: 'إعادة المحاولة',
            addToFavorites: 'إضافة للمفضلة',
            removeFromFavorites: 'حذف من المفضلة'
        },
        fr: {
            title: 'Mon espace',
            dashboard: 'Tableau de bord',
            progress: 'Suivi pédagogique',
            history: 'Historique des évaluations',
            mistakes: 'Mes erreurs',
            favorites: 'Mes favoris',
            motivation: 'Motivation',
            lessonsViewed: 'Leçons consultées',
            exercisesDone: 'Exercices terminés',
            testsTaken: 'Tests effectués',
            averageScore: 'Score moyen',
            globalProgress: 'Progression globale',
            completedLessons: 'Leçons terminées',
            pendingLessons: 'Leçons en attente',
            markAsComplete: 'Marquer comme terminé',
            noData: 'Aucune donnée disponible',
            streak: 'Jours consécutifs',
            goals: 'Objectifs pédagogiques',
            encouragement: 'Continuez votre excellent travail!',
            date: 'Date',
            score: 'Score',
            best: 'Meilleur',
            review: 'Revoir',
            retry: 'Réessayer',
            addToFavorites: 'Ajouter aux favoris',
            removeFromFavorites: 'Retirer des favoris'
        }
    };

    const t = (key) => TEXTS[lang()][key] || key;

    // ============================================
    // 3. PROGRESS TRACKING (تتبع التقدم)
    // ============================================
    function updateProgress(type, item) {
        const progress = storage.get(STORAGE_KEYS.PROGRESS) || {
            lessons: {},
            exercises: {},
            tests: {}
        };

        if (!progress[type][item]) {
            progress[type][item] = {
                completed: false,
                viewed: false,
                attempts: 0,
                lastViewed: Date.now()
            };
        }

        progress[type][item].lastViewed = Date.now();
        progress[type][item].attempts++;

        storage.set(STORAGE_KEYS.PROGRESS, progress);
        return progress;
    }

    function markLessonComplete(lessonId) {
        const progress = storage.get(STORAGE_KEYS.PROGRESS) || { lessons: {} };
        if (progress.lessons[lessonId]) {
            progress.lessons[lessonId].completed = true;
            progress.lessons[lessonId].completedAt = Date.now();
        }
        storage.set(STORAGE_KEYS.PROGRESS, progress);
    }

    // ============================================
    // 4. QUIZ RESULTS (نتائج الاختبارات)
    // ============================================
    function saveQuizResult(quizId, score, totalQuestions, mistakes) {
        const results = storage.get(STORAGE_KEYS.QUIZ_RESULTS) || [];
        
        results.push({
            quizId: quizId,
            score: score,
            total: totalQuestions,
            percentage: Math.round((score / totalQuestions) * 100),
            date: Date.now(),
            mistakes: mistakes || []
        });

        storage.set(STORAGE_KEYS.QUIZ_RESULTS, results);

        // Save mistakes separately
        if (mistakes && mistakes.length > 0) {
            const allMistakes = storage.get(STORAGE_KEYS.MISTAKES) || [];
            mistakes.forEach(mistake => {
                allMistakes.push({
                    ...mistake,
                    quizId: quizId,
                    date: Date.now()
                });
            });
            storage.set(STORAGE_KEYS.MISTAKES, allMistakes);
        }

        return results;
    }

    // ============================================
    // 5. STREAK TRACKING (تتبع الأيام المتتالية)
    // ============================================
    function updateStreak() {
        const streakData = storage.get(STORAGE_KEYS.STREAK) || {
            current: 0,
            best: 0,
            lastVisit: null
        };

        const today = new Date().toDateString();
        const lastVisit = streakData.lastVisit ? new Date(streakData.lastVisit).toDateString() : null;

        if (lastVisit === today) {
            // Already visited today
            return streakData;
        }

        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toDateString();

        if (lastVisit === yesterdayStr) {
            // Consecutive day
            streakData.current++;
        } else if (lastVisit !== today) {
            // Streak broken
            streakData.current = 1;
        }

        if (streakData.current > streakData.best) {
            streakData.best = streakData.current;
        }

        streakData.lastVisit = Date.now();
        storage.set(STORAGE_KEYS.STREAK, streakData);

        return streakData;
    }

    // ============================================
    // 6. DASHBOARD (لوحة القيادة)
    // ============================================
    function getDashboardStats() {
        const progress = storage.get(STORAGE_KEYS.PROGRESS) || { lessons: {}, exercises: {}, tests: {} };
        const quizResults = storage.get(STORAGE_KEYS.QUIZ_RESULTS) || [];
        const streak = storage.get(STORAGE_KEYS.STREAK) || { current: 0, best: 0 };

        const lessonsViewed = Object.keys(progress.lessons).length;
        const completedLessons = Object.values(progress.lessons).filter(l => l.completed).length;
        const exercisesDone = Object.keys(progress.exercises).length;
        const testsTaken = quizResults.length;
        
        const totalScore = quizResults.reduce((sum, r) => sum + r.percentage, 0);
        const averageScore = testsTaken > 0 ? Math.round(totalScore / testsTaken) : 0;
        
        const globalProgress = lessonsViewed > 0 ? Math.round((completedLessons / lessonsViewed) * 100) : 0;

        return {
            lessonsViewed,
            completedLessons,
            exercisesDone,
            testsTaken,
            averageScore,
            globalProgress,
            streak: streak.current,
            bestStreak: streak.best
        };
    }

    function renderDashboard() {
        const stats = getDashboardStats();
        const html = `
            <div class="dashboard-grid">
                <div class="stat-card">
                    <div class="stat-icon">📚</div>
                    <div class="stat-value">${stats.lessonsViewed}</div>
                    <div class="stat-label">${t('lessonsViewed')}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">✅</div>
                    <div class="stat-value">${stats.completedLessons}</div>
                    <div class="stat-label">${t('completedLessons')}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">✏️</div>
                    <div class="stat-value">${stats.exercisesDone}</div>
                    <div class="stat-label">${t('exercisesDone')}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">📝</div>
                    <div class="stat-value">${stats.testsTaken}</div>
                    <div class="stat-label">${t('testsTaken')}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">📊</div>
                    <div class="stat-value">${stats.averageScore}%</div>
                    <div class="stat-label">${t('averageScore')}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">🎯</div>
                    <div class="stat-value">${stats.globalProgress}%</div>
                    <div class="stat-label">${t('globalProgress')}</div>
                </div>
            </div>
        `;
        return html;
    }

    // ============================================
    // 7. PEDAGOGICAL FOLLOW-UP (المتابعة التربوية)
    // ============================================
    function renderProgress() {
        const progress = storage.get(STORAGE_KEYS.PROGRESS) || { lessons: {} };
        const lessons = Object.entries(progress.lessons);

        if (lessons.length === 0) {
            return `<p class="no-data">${t('noData')}</p>`;
        }

        const completed = lessons.filter(([id, data]) => data.completed);
        const pending = lessons.filter(([id, data]) => !data.completed);

        let html = '<div class="progress-section">';
        
        html += '<h3>✅ ' + t('completedLessons') + '</h3>';
        html += '<div class="lesson-list">';
        completed.forEach(([id, data]) => {
            html += `
                <div class="lesson-item completed">
                    <span>${id}</span>
                    <span class="lesson-date">${new Date(data.completedAt).toLocaleDateString()}</span>
                </div>
            `;
        });
        html += '</div>';

        html += '<h3>⏳ ' + t('pendingLessons') + '</h3>';
        html += '<div class="lesson-list">';
        pending.forEach(([id, data]) => {
            html += `
                <div class="lesson-item pending">
                    <span>${id}</span>
                    <button class="btn-complete" data-lesson="${id}">${t('markAsComplete')}</button>
                </div>
            `;
        });
        html += '</div>';

        html += '</div>';
        return html;
    }

    // ============================================
    // 8. QUIZ HISTORY (سجل التقييمات)
    // ============================================
    function renderHistory() {
        const results = storage.get(STORAGE_KEYS.QUIZ_RESULTS) || [];

        if (results.length === 0) {
            return `<p class="no-data">${t('noData')}</p>`;
        }

        const sorted = [...results].sort((a, b) => b.date - a.date);
        const bestScores = {};

        sorted.forEach(r => {
            if (!bestScores[r.quizId] || r.percentage > bestScores[r.quizId].percentage) {
                bestScores[r.quizId] = r;
            }
        });

        let html = '<div class="history-list">';
        sorted.slice(0, 10).forEach(r => {
            const isBest = bestScores[r.quizId] === r;
            html += `
                <div class="history-item ${isBest ? 'best' : ''}">
                    <div class="history-info">
                        <span class="history-quiz">${r.quizId}</span>
                        <span class="history-date">${new Date(r.date).toLocaleDateString()}</span>
                    </div>
                    <div class="history-score">
                        <span class="score-value">${r.percentage}%</span>
                        ${isBest ? '<span class="best-badge">🏆 ' + t('best') + '</span>' : ''}
                    </div>
                </div>
            `;
        });
        html += '</div>';

        return html;
    }

    // ============================================
    // 9. MISTAKES (أخطائي)
    // ============================================
    function renderMistakes() {
        const mistakes = storage.get(STORAGE_KEYS.MISTAKES) || [];

        if (mistakes.length === 0) {
            return `<p class="no-data">${t('noData')}</p>`;
        }

        let html = '<div class="mistakes-list">';
        mistakes.slice(0, 10).forEach(m => {
            html += `
                <div class="mistake-item">
                    <div class="mistake-question">${m.question || 'Question'}</div>
                    <div class="mistake-details">
                        <span class="mistake-quiz">${m.quizId}</span>
                        <span class="mistake-date">${new Date(m.date).toLocaleDateString()}</span>
                    </div>
                    <div class="mistake-actions">
                        <button class="btn-review" data-id="${m.id}">${t('review')}</button>
                        <button class="btn-retry" data-id="${m.id}">${t('retry')}</button>
                    </div>
                </div>
            `;
        });
        html += '</div>';

        return html;
    }

    // ============================================
    // 10. FAVORITES INTEGRATION (تكامل المفضلة)
    // ============================================
    function renderFavorites() {
        // Integrate with existing favorites.js
        const favs = storage.get('gosvt_favs') || [];

        if (favs.length === 0) {
            return `<p class="no-data">${t('noData')}</p>`;
        }

        let html = '<div class="favorites-list">';
        favs.forEach(fav => {
            html += `
                <div class="favorite-item">
                    <a href="${fav.url}" target="_blank">${fav.title}</a>
                    <button class="btn-remove-fav" data-url="${fav.url}">${t('removeFromFavorites')}</button>
                </div>
            `;
        });
        html += '</div>';

        return html;
    }

    // ============================================
    // 11. MOTIVATION (التحفيز)
    // ============================================
    function renderMotivation() {
        const streak = storage.get(STORAGE_KEYS.STREAK) || { current: 0, best: 0 };
        const goals = storage.get(STORAGE_KEYS.GOALS) || [];

        const messages = {
            ar: [
                'أداء رائع! استمر!',
                'أنت تقدم بشكل ممتاز!',
                'لا تتوقف، النجاح قريب!',
                'أنت بطل حقيقي!',
                'عمل جيد جداً!'
            ],
            fr: [
                'Excellent travail! Continue!',
                'Tu progresses magnifiquement!',
                'Ne t\'arrête pas, le succès est proche!',
                'Tu es un vrai champion!',
                'Très bon travail!'
            ]
        };

        const randomMessage = messages[lang()][Math.floor(Math.random() * messages[lang()].length)];

        let html = `
            <div class="motivation-section">
                <div class="streak-display">
                    <div class="streak-icon">🔥</div>
                    <div class="streak-value">${streak.current}</div>
                    <div class="streak-label">${t('streak')}</div>
                    <div class="streak-best">Meilleur: ${streak.best}</div>
                </div>
                <div class="encouragement-message">
                    <p>💪 ${randomMessage}</p>
                </div>
            </div>
        `;

        return html;
    }

    // ============================================
    // 12. MAIN RENDER (العرض الرئيسي)
    // ============================================
    window.renderStudentSpaceContent = function() {
        return renderStudentSpace();
    };

    function renderStudentSpace() {
        const container = document.getElementById('student-space-content');
        if (!container) return;

        let html = `
            <div class="student-space">
                <div class="space-nav">
                    <button class="space-tab active" data-tab="dashboard">${t('dashboard')}</button>
                    <button class="space-tab" data-tab="progress">${t('progress')}</button>
                    <button class="space-tab" data-tab="history">${t('history')}</button>
                    <button class="space-tab" data-tab="mistakes">${t('mistakes')}</button>
                    <button class="space-tab" data-tab="favorites">${t('favorites')}</button>
                    <button class="space-tab" data-tab="motivation">${t('motivation')}</button>
                </div>
                <div class="space-content">
                    <div class="space-panel active" id="panel-dashboard">
                        ${renderDashboard()}
                    </div>
                    <div class="space-panel" id="panel-progress">
                        ${renderProgress()}
                    </div>
                    <div class="space-panel" id="panel-history">
                        ${renderHistory()}
                    </div>
                    <div class="space-panel" id="panel-mistakes">
                        ${renderMistakes()}
                    </div>
                    <div class="space-panel" id="panel-favorites">
                        ${renderFavorites()}
                    </div>
                    <div class="space-panel" id="panel-motivation">
                        ${renderMotivation()}
                    </div>
                </div>
            </div>
        `;

        container.innerHTML = html;

        // Add event listeners
        container.querySelectorAll('.space-tab').forEach(tab => {
            tab.addEventListener('click', function() {
                const tabName = this.dataset.tab;
                
                // Update tabs
                container.querySelectorAll('.space-tab').forEach(t => t.classList.remove('active'));
                this.classList.add('active');
                
                // Update panels
                container.querySelectorAll('.space-panel').forEach(p => p.classList.remove('active'));
                document.getElementById(`panel-${tabName}`).classList.add('active');
            });
        });

        // Mark lesson as complete
        container.querySelectorAll('.btn-complete').forEach(btn => {
            btn.addEventListener('click', function() {
                const lessonId = this.dataset.lesson;
                markLessonComplete(lessonId);
                renderStudentSpace(); // Re-render
            });
        });
    }

    // ============================================
    // 13. CSS STYLES (التنسيقات)
    // ============================================
    const styles = document.createElement('style');
    styles.textContent = `
        .student-space {
            max-width: 1200px;
            margin: 0 auto;
            padding: 2rem;
        }
        .space-nav {
            display: flex;
            gap: 0.5rem;
            margin-bottom: 2rem;
            flex-wrap: wrap;
        }
        .space-tab {
            padding: 0.75rem 1.5rem;
            background: #f5f5f5;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-family: 'Cairo', sans-serif;
            font-weight: 600;
            transition: all 0.3s;
        }
        .space-tab:hover {
            background: #e0e0e0;
        }
        .space-tab.active {
            background: #2d5a27;
            color: white;
        }
        .space-panel {
            display: none;
        }
        .space-panel.active {
            display: block;
        }
        .dashboard-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 1.5rem;
        }
        .stat-card {
            background: white;
            padding: 1.5rem;
            border-radius: 12px;
            text-align: center;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .stat-icon {
            font-size: 2rem;
            margin-bottom: 0.5rem;
        }
        .stat-value {
            font-size: 2rem;
            font-weight: 700;
            color: #2d5a27;
        }
        .stat-label {
            color: #666;
            font-size: 0.9rem;
        }
        .progress-section {
            background: white;
            padding: 1.5rem;
            border-radius: 12px;
        }
        .lesson-list {
            margin-top: 1rem;
        }
        .lesson-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 0.75rem;
            margin-bottom: 0.5rem;
            border-radius: 8px;
        }
        .lesson-item.completed {
            background: #e8f5e9;
        }
        .lesson-item.pending {
            background: #fff3e0;
        }
        .btn-complete {
            padding: 0.5rem 1rem;
            background: #2d5a27;
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
        }
        .history-list {
            background: white;
            padding: 1.5rem;
            border-radius: 12px;
        }
        .history-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 1rem;
            margin-bottom: 0.5rem;
            background: #f5f5f5;
            border-radius: 8px;
        }
        .history-item.best {
            background: #fff9c4;
            border: 2px solid #ffc107;
        }
        .history-score {
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
        .score-value {
            font-weight: 700;
            color: #2d5a27;
        }
        .best-badge {
            font-size: 0.8rem;
        }
        .mistakes-list {
            background: white;
            padding: 1.5rem;
            border-radius: 12px;
        }
        .mistake-item {
            padding: 1rem;
            margin-bottom: 0.5rem;
            background: #ffebee;
            border-radius: 8px;
        }
        .mistake-actions {
            display: flex;
            gap: 0.5rem;
            margin-top: 0.5rem;
        }
        .btn-review, .btn-retry {
            padding: 0.5rem 1rem;
            border: none;
            border-radius: 6px;
            cursor: pointer;
        }
        .btn-review {
            background: #2196f3;
            color: white;
        }
        .btn-retry {
            background: #ff9800;
            color: white;
        }
        .favorites-list {
            background: white;
            padding: 1.5rem;
            border-radius: 12px;
        }
        .favorite-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 1rem;
            margin-bottom: 0.5rem;
            background: #f5f5f5;
            border-radius: 8px;
        }
        .favorite-item a {
            color: #2d5a27;
            text-decoration: none;
        }
        .btn-remove-fav {
            padding: 0.5rem 1rem;
            background: #f44336;
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
        }
        .motivation-section {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 2rem;
            border-radius: 12px;
            color: white;
            text-align: center;
        }
        .streak-display {
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 1rem;
            margin-bottom: 1rem;
        }
        .streak-icon {
            font-size: 3rem;
        }
        .streak-value {
            font-size: 3rem;
            font-weight: 700;
        }
        .streak-label {
            font-size: 1.2rem;
        }
        .streak-best {
            font-size: 0.9rem;
            opacity: 0.8;
        }
        .encouragement-message {
            font-size: 1.5rem;
            font-weight: 600;
        }
        .no-data {
            text-align: center;
            padding: 2rem;
            color: #999;
            font-style: italic;
        }
        @media (max-width: 768px) {
            .student-space {
                padding: 1rem;
            }
            .dashboard-grid {
                grid-template-columns: repeat(2, 1fr);
            }
            .space-nav {
                gap: 0.25rem;
            }
            .space-tab {
                padding: 0.5rem 1rem;
                font-size: 0.9rem;
            }
        }
    `;
    document.head.appendChild(styles);

    // ============================================
    // 14. INITIALIZATION (التهيئة)
    // ============================================
    function init() {
        // Update streak on page load
        updateStreak();

        // Render when student space section is visible
        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.target.id === 'student-space-content' && 
                    mutation.target.children.length === 0) {
                    renderStudentSpace();
                }
            });
        });

        // Listen for language changes via lang button click
        const langBtn = document.querySelector('.lang-switcher');
        if (langBtn) {
            langBtn.addEventListener('click', function() {
                setTimeout(function() {
                    const container = document.getElementById('student-space-content');
                    if (container && container.children.length > 0) {
                        renderStudentSpace();
                    }
                }, 100);
            });
        }

        // Also observe document for lang attribute changes
        const langObserver = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.type === 'attributes' && mutation.attributeName === 'lang') {
                    const container = document.getElementById('student-space-content');
                    if (container && container.children.length > 0) {
                        renderStudentSpace();
                    }
                }
            });
        });

        langObserver.observe(document.documentElement, { attributes: true });

        // Render immediately if section exists
        const container = document.getElementById('student-space-content');
        if (container) {
            renderStudentSpace();
        }
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Expose functions globally for integration with other systems
    window.StudentSpace = {
        updateProgress,
        markLessonComplete,
        saveQuizResult,
        updateStreak,
        getDashboardStats,
        renderStudentSpace // Expose render function for re-rendering
    };

})();
