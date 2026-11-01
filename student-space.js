/* Go SVT Maroc - Espace Élève - ملف مستقل للبود */
(function () {
    'use strict';

    // ============================================
    // 1. STORAGE SYSTEM (نظام التخزين)
    // ============================================
    const STORAGE_KEYS = {
        PROFILES: 'gosvt_profiles',
        CURRENT_PROFILE: 'gosvt_current_profile',
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
    // 1.1 PROFILE MANAGEMENT (إدارة الملفات الشخصية)
    // ============================================
    let currentProfileId = storage.get(STORAGE_KEYS.CURRENT_PROFILE) || 'default';

    function getProfiles() {
        return storage.get(STORAGE_KEYS.PROFILES) || {
            default: {
                id: 'default',
                name: 'Élève par défaut',
                createdAt: Date.now(),
                lastActive: Date.now()
            }
        };
    }

    function saveProfiles(profiles) {
        storage.set(STORAGE_KEYS.PROFILES, profiles);
    }

    function getCurrentProfile() {
        const profiles = getProfiles();
        if (!profiles[currentProfileId]) {
            currentProfileId = 'default';
            storage.set(STORAGE_KEYS.CURRENT_PROFILE, currentProfileId);
        }
        return profiles[currentProfileId];
    }

    function createProfile(name) {
        const profiles = getProfiles();
        const newId = 'profile_' + Date.now();
        
        profiles[newId] = {
            id: newId,
            name: name,
            createdAt: Date.now(),
            lastActive: Date.now()
        };
        
        saveProfiles(profiles);
        return newId;
    }

    function switchProfile(profileId) {
        const profiles = getProfiles();
        if (profiles[profileId]) {
            currentProfileId = profileId;
            profiles[profileId].lastActive = Date.now();
            saveProfiles(profiles);
            storage.set(STORAGE_KEYS.CURRENT_PROFILE, currentProfileId);
            return true;
        }
        return false;
    }

    function deleteProfile(profileId) {
        if (profileId === 'default') {
            return false; // Cannot delete default profile
        }
        
        const profiles = getProfiles();
        if (profiles[profileId]) {
            delete profiles[profileId];
            saveProfiles(profiles);
            
            // Switch to default if current profile was deleted
            if (currentProfileId === profileId) {
                switchProfile('default');
            }
            return true;
        }
        return false;
    }

    function getProfileData(profileId) {
        const prefix = profileId + '_';
        return {
            progress: storage.get(prefix + STORAGE_KEYS.PROGRESS) || { lessons: {}, exercises: {}, tests: {} },
            quizResults: storage.get(prefix + STORAGE_KEYS.QUIZ_RESULTS) || [],
            mistakes: storage.get(prefix + STORAGE_KEYS.MISTAKES) || [],
            streak: storage.get(prefix + STORAGE_KEYS.STREAK) || { current: 0, best: 0, lastVisit: null },
            goals: storage.get(prefix + STORAGE_KEYS.GOALS) || []
        };
    }

    function saveProfileData(profileId, data) {
        const prefix = profileId + '_';
        storage.set(prefix + STORAGE_KEYS.PROGRESS, data.progress);
        storage.set(prefix + STORAGE_KEYS.QUIZ_RESULTS, data.quizResults);
        storage.set(prefix + STORAGE_KEYS.MISTAKES, data.mistakes);
        storage.set(prefix + STORAGE_KEYS.STREAK, data.streak);
        storage.set(prefix + STORAGE_KEYS.GOALS, data.goals);
    }

    // ============================================
    // 2. LANGUAGE SYSTEM (نظام اللغة)
    // ============================================
    function lang() {
        return document.documentElement.getAttribute('lang') === 'fr' ? 'fr' : 'ar';
    }

    function t(key) {
        const currentLang = lang();
        const texts = TEXTS[currentLang];
        if (texts && texts[key]) {
            return texts[key];
        }
        return key;
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
            profiles: 'الملفات الشخصية',
            settings: 'الإعدادات',
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
            removeFromFavorites: 'حذف من المفضلة',
            createProfile: 'إنشاء ملف شخصي',
            switchProfile: 'تغيير الملف',
            deleteProfile: 'حذف الملف',
            profileName: 'اسم الملف',
            currentProfile: 'الملف الحالي',
            exportData: 'تصدير البيانات',
            importData: 'استيراد البيانات',
            confirmDelete: 'هل أنت متأكد من حذف هذا الملف؟',
            profileCreated: 'تم إنشاء الملف بنجاح',
            profileDeleted: 'تم حذف الملف',
            profileSwitched: 'تم التبديل إلى الملف',
            invalidFile: 'ملف JSON غير صالح',
            confirmReplace: 'هذا الملف موجود بالفعل. هل تريد استبداله؟',
            retryMistakes: 'إعادة الأسئلة الخاطئة فقط',
            enterProfileName: 'أدخل اسم الملف الشخصي الجديد:',
            mistakesLoaded: 'تم تحميل الأسئلة الخاطئة. أجب فقط على الأسئلة التي أخطأت فيها.'
        },
        fr: {
            title: 'Mon espace',
            dashboard: 'Tableau de bord',
            progress: 'Suivi pédagogique',
            history: 'Historique des évaluations',
            mistakes: 'Mes erreurs',
            favorites: 'Mes favoris',
            motivation: 'Motivation',
            profiles: 'Profils',
            settings: 'Paramètres',
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
            removeFromFavorites: 'Retirer des favoris',
            createProfile: 'Créer un profil',
            switchProfile: 'Changer de profil',
            deleteProfile: 'Supprimer le profil',
            profileName: 'Nom du profil',
            currentProfile: 'Profil actuel',
            exportData: 'Exporter les données',
            importData: 'Importer les données',
            confirmDelete: 'Êtes-vous sûr de vouloir supprimer ce profil ?',
            profileCreated: 'Profil créé avec succès',
            profileDeleted: 'Profil supprimé',
            profileSwitched: 'Changement de profil effectué',
            invalidFile: 'Fichier JSON invalide',
            confirmReplace: 'Ce profil existe déjà. Voulez-vous le remplacer ?',
            retryMistakes: 'Réessayer uniquement les erreurs',
            enterProfileName: 'Entrez le nom du nouveau profil:',
            mistakesLoaded: 'Questions incorrectes chargées. Répondez uniquement aux questions que vous aviez mal.'
        }
    };

    // ============================================
    // 3. PROGRESS TRACKING (تتبع التقدم)
    // ============================================
    function updateProgress(type, item) {
        const profileData = getProfileData(currentProfileId);
        
        if (!profileData.progress[type][item]) {
            profileData.progress[type][item] = {
                completed: false,
                viewed: false,
                attempts: 0,
                lastViewed: Date.now()
            };
        }

        profileData.progress[type][item].lastViewed = Date.now();
        profileData.progress[type][item].attempts++;

        saveProfileData(currentProfileId, profileData);
        return profileData.progress;
    }

    function markLessonComplete(lessonId) {
        const profileData = getProfileData(currentProfileId);
        if (profileData.progress.lessons[lessonId]) {
            profileData.progress.lessons[lessonId].completed = true;
            profileData.progress.lessons[lessonId].completedAt = Date.now();
        }
        saveProfileData(currentProfileId, profileData);
    }

    // ============================================
    // 4. QUIZ RESULTS (نتائج الاختبارات)
    // ============================================
    function saveQuizResult(quizId, score, totalQuestions, mistakes) {
        const profileData = getProfileData(currentProfileId);
        
        // Check if this quiz result already exists for this session
        const existingIndex = profileData.quizResults.findIndex(r => r.quizId === quizId && r.date && (Date.now() - r.date) < 60000);
        
        if (existingIndex === -1) {
            // Only save if not saved in the last minute (avoid duplicates)
            profileData.quizResults.push({
                quizId: quizId,
                score: score,
                total: totalQuestions,
                percentage: Math.round((score / totalQuestions) * 100),
                date: Date.now(),
                mistakes: mistakes || []
            });

            // Save mistakes separately
            if (mistakes && mistakes.length > 0) {
                mistakes.forEach(mistake => {
                    profileData.mistakes.push({
                        ...mistake,
                        quizId: quizId,
                        date: Date.now()
                    });
                });
            }

            saveProfileData(currentProfileId, profileData);
        }

        return profileData.quizResults;
    }

    // ============================================
    // 5. STREAK TRACKING (تتبع الأيام المتتالية)
    // ============================================
    function updateStreak() {
        const profileData = getProfileData(currentProfileId);
        
        const today = new Date().toDateString();
        const lastVisit = profileData.streak.lastVisit ? new Date(profileData.streak.lastVisit).toDateString() : null;

        if (lastVisit === today) {
            // Already visited today - count only once
            return profileData.streak;
        }

        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toDateString();

        if (lastVisit === yesterdayStr) {
            // Consecutive day
            profileData.streak.current++;
        } else if (lastVisit !== today) {
            // Streak broken
            profileData.streak.current = 1;
        }

        if (profileData.streak.current > profileData.streak.best) {
            profileData.streak.best = profileData.streak.current;
        }

        profileData.streak.lastVisit = Date.now();
        saveProfileData(currentProfileId, profileData);

        return profileData.streak;
    }

    // ============================================
    // 6. DASHBOARD (لوحة القيادة)
    // ============================================
    function getDashboardStats() {
        const profileData = getProfileData(currentProfileId);
        
        const lessonsViewed = Object.keys(profileData.progress.lessons).length;
        const completedLessons = Object.values(profileData.progress.lessons).filter(l => l.completed).length;
        const exercisesDone = Object.keys(profileData.progress.exercises).length;
        const testsTaken = profileData.quizResults.length;
        
        const totalScore = profileData.quizResults.reduce((sum, r) => sum + r.percentage, 0);
        const averageScore = testsTaken > 0 ? Math.round(totalScore / testsTaken) : 0;
        
        const globalProgress = lessonsViewed > 0 ? Math.round((completedLessons / lessonsViewed) * 100) : 0;

        return {
            lessonsViewed,
            completedLessons,
            exercisesDone,
            testsTaken,
            averageScore,
            globalProgress,
            streak: profileData.streak.current,
            bestStreak: profileData.streak.best
        };
    }

    // ============================================
    // 7. EXPORT/IMPORT (تصدير واستيراد)
    // ============================================
    function exportProfileData(profileId) {
        const profile = getProfiles()[profileId];
        const profileData = getProfileData(profileId);
        
        const exportData = {
            profile: profile,
            data: profileData,
            exportDate: Date.now(),
            version: '1.0'
        };
        
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `gosvt_profile_${profile.name}_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function importProfileData(jsonString) {
        try {
            const importData = JSON.parse(jsonString);
            
            // Validate structure
            if (!importData.profile || !importData.data) {
                throw new Error('Format de fichier invalide');
            }
            
            // Check for version compatibility
            if (importData.version && importData.version !== '1.0') {
                if (!confirm('Attention: Ce fichier provient d\'une version différente. Continuer quand même?')) {
                    return false;
                }
            }
            
            // Confirm replacement if profile exists
            const profiles = getProfiles();
            if (profiles[importData.profile.id]) {
                if (!confirm(`Le profil "${importData.profile.name}" existe déjà. Voulez-vous le remplacer?`)) {
                    return false;
                }
            }
            
            // Import data
            profiles[importData.profile.id] = importData.profile;
            saveProfileData(importData.profile.id, importData.data);
            
            return true;
        } catch (e) {
            console.error('Import error:', e);
            alert(t('invalidFile'));
            return false;
        }
    }

    function renderDashboard() {
        const stats = getDashboardStats();
        const profiles = getProfiles();
        const currentProfile = getCurrentProfile();
        
        let profilesOptions = '';
        Object.entries(profiles).forEach(([id, profile]) => {
            const isActive = id === currentProfileId;
            profilesOptions += `<option value="${id}" ${isActive ? 'selected' : ''}>${profile.name}</option>`;
        });

        const html = `
            <div class="dashboard-header">
                <div class="profile-selector">
                    <label>${t('currentProfile')}:</label>
                    <select id="profile-select">${profilesOptions}</select>
                    <button class="btn-create-profile" onclick="promptCreateProfile()">+ ${t('createProfile')}</button>
                </div>
                <div class="data-actions">
                    <button class="btn-export" onclick="handleExport()">${t('exportData')}</button>
                    <button class="btn-import" onclick="handleImport()">${t('importData')}</button>
                    <input type="file" id="import-file" accept=".json" style="display:none" onchange="handleImportFile(this)">
                </div>
            </div>
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

    // Profile management functions exposed globally
    window.promptCreateProfile = function() {
        const name = prompt(t('enterProfileName'));
        if (name && name.trim()) {
            const newId = createProfile(name.trim());
            switchProfile(newId);
            renderStudentSpace();
            alert(t('profileCreated'));
        }
    };

    window.handleExport = function() {
        exportProfileData(currentProfileId);
    };

    window.handleImport = function() {
        document.getElementById('import-file').click();
    };

    window.handleImportFile = function(input) {
        const file = input.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(e) {
            if (importProfileData(e.target.result)) {
                alert(t('Données importées avec succès'));
                renderStudentSpace();
            }
        };
        reader.readAsText(file);
    };

    // Profile selector change handler
    document.addEventListener('change', function(e) {
        if (e.target.id === 'profile-select') {
            switchProfile(e.target.value);
            renderStudentSpace();
        }
    });

    // ============================================
    // 7. PEDAGOGICAL FOLLOW-UP (المتابعة التربوية)
    // ============================================
    function renderProgress() {
        const profileData = getProfileData(currentProfileId);
        const lessons = Object.entries(profileData.progress.lessons || {});

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
        const profileData = getProfileData(currentProfileId);
        const results = profileData.quizResults || [];

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
        const profileData = getProfileData(currentProfileId);
        const mistakes = profileData.mistakes || [];

        if (mistakes.length === 0) {
            return `<p class="no-data">${t('noData')}</p>`;
        }

        // Group mistakes by quiz ID
        const mistakesByQuiz = {};
        mistakes.forEach(mistake => {
            if (!mistakesByQuiz[mistake.quizId]) {
                mistakesByQuiz[mistake.quizId] = [];
            }
            mistakesByQuiz[mistake.quizId].push(mistake);
        });

        let html = '<div class="mistakes-list">';
        Object.entries(mistakesByQuiz).forEach(([quizId, quizMistakes]) => {
            html += `
                <div class="mistake-quiz-group">
                    <div class="mistake-quiz-header">
                        <span>Quiz: ${quizId}</span>
                        <button class="btn-retry-mistakes" onclick="window.StudentSpace.retryMistakes('${quizId}')">${t('retryMistakes')}</button>
                    </div>
                    ${quizMistakes.map(mistake => `
                        <div class="mistake-item">
                            <div class="mistake-question">${mistake.question || 'Question'}</div>
                            <div class="mistake-details">
                                <span class="mistake-quiz">${mistake.quizId}</span>
                                <span class="mistake-date">${new Date(mistake.date).toLocaleDateString()}</span>
                            </div>
                            <div class="mistake-answers">
                                <div class="mistake-wrong">❌ ${t('Réponse choisie:')} ${mistake.selected}</div>
                                <div class="mistake-correct">✅ ${t('Bonne réponse:')} ${mistake.correct}</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        });
        html += '</div>';

        return html;
    }

    window.StudentSpace.retryMistakes = function(quizId) {
        const profileData = getProfileData(currentProfileId);
        const quizMistakes = profileData.mistakes.filter(m => m.quizId === quizId);
        
        if (quizMistakes.length === 0) return;

        // Store mistakes for retry in sessionStorage
        sessionStorage.setItem('gosvt_retry_mistakes', JSON.stringify(quizMistakes));
        
        // Navigate to quiz section (this assumes quiz is accessible via hash)
        window.location.hash = 'quiz';
        
        // Show alert to user
        alert(t('mistakesLoaded'));
    };

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
        const profileData = getProfileData(currentProfileId);
        const streak = profileData.streak || { current: 0, best: 0 };
        const goals = profileData.goals || [];

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
        renderStudentSpace();
    };

    function renderStudentSpace() {
        console.log('[StudentSpace] renderStudentSpace called');
        const container = document.getElementById('student-space-content');
        if (!container) {
            console.error('[StudentSpace] Container not found!');
            return;
        }
        console.log('[StudentSpace] Container found:', container);

        try {
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
            console.log('[StudentSpace] HTML set successfully');

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

            console.log('[StudentSpace] Render completed successfully');
        } catch (e) {
            console.error('[StudentSpace] Error during render:', e);
            container.innerHTML = `<p style="color: red;">Erreur: ${e.message}</p>`;
        }
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
        console.log('[StudentSpace] init() called');
        
        // Update streak on page load
        updateStreak();

        // Listen for hash changes to render student space when navigated to
        window.addEventListener('hashchange', function() {
            const hash = window.location.hash.substring(1);
            console.log('[StudentSpace] Hash changed to:', hash);
            if (hash === 'student-space') {
                console.log('[StudentSpace] Triggering render due to hash change');
                setTimeout(function() {
                    renderStudentSpace();
                }, 100);
            }
        });

        // Check hash on initial load
        const initialHash = window.location.hash.substring(1);
        console.log('[StudentSpace] Initial hash:', initialHash);
        if (initialHash === 'student-space') {
            console.log('[StudentSpace] Triggering render due to initial hash');
            setTimeout(function() {
                renderStudentSpace();
            }, 100);
        }

        // Observe the student-space section for class changes (when it becomes active)
        const sectionObserver = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.target.id === 'student-space' && 
                    mutation.target.classList.contains('active')) {
                    console.log('[StudentSpace] Section became active, triggering render');
                    setTimeout(function() {
                        renderStudentSpace();
                    }, 50);
                }
            });
        });

        const studentSpaceSection = document.getElementById('student-space');
        if (studentSpaceSection) {
            sectionObserver.observe(studentSpaceSection, { attributes: true, attributeFilter: ['class'] });
            console.log('[StudentSpace] Section observer attached');
        } else {
            console.error('[StudentSpace] Section not found!');
        }

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
            console.log('[StudentSpace] Container found on init, rendering...');
            renderStudentSpace();
        } else {
            console.error('[StudentSpace] Container not found on init!');
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
        renderStudentSpace,
        createProfile,
        deleteProfile,
        switchProfile,
        getCurrentProfile,
        getProfiles,
        getProfileData,
        exportProfileData,
        importProfileData,
        retryMistakes
    };

})();
