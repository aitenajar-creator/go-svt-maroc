/* Go SVT Maroc - Espace Élève - ملف مستقل للبود */
(function () {
    'use strict';

    // Escape all values inserted into HTML. Stored data and imported JSON are untrusted.
    const escapeHtml = value => String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
    const safeLink = value => {
        const raw = String(value == null ? '' : value).trim();
        try {
            const url = new URL(raw, window.location.href);
            return ['http:', 'https:'].includes(url.protocol) ? url.href : '#';
        } catch (e) { return '#'; }
    };
    const makeId = () => {
        if (window.crypto && typeof window.crypto.randomUUID === 'function') return 'profile_' + window.crypto.randomUUID();
        return 'profile_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 12);
    };

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
        NOTES: 'gosvt_notes',
        STUDY_PLAN: 'gosvt_study_plan',
        LAST_VISIT: 'gosvt_last_visit',
        DAILY_CHALLENGES: 'gosvt_daily_challenges'
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

    // Relit le profil actif depuis le localStorage (changement fait dans un autre onglet)
    function syncCurrentProfile() {
        // Comptes (student-account.js) : le profil de la session fait foi, même si un autre
        // onglet a changé le profil "courant" stocké.
        const acc = window.StudentAccount ? window.StudentAccount.activeProfileId() : null;
        if (acc) {
            if (acc !== currentProfileId && getProfiles()[acc]) currentProfileId = acc;
            return currentProfileId;
        }
        const stored = storage.get(STORAGE_KEYS.CURRENT_PROFILE);
        if (stored && stored !== currentProfileId && getProfiles()[stored]) {
            currentProfileId = stored;
        }
        return currentProfileId;
    }

    function getProfiles() {
        const stored = storage.get(STORAGE_KEYS.PROFILES);
        if (stored && typeof stored === 'object' && !Array.isArray(stored)) {
            if (!stored.default) stored.default = {
                id: 'default',
                name: 'Élève par défaut',
                createdAt: Date.now(),
                lastActive: Date.now()
            };
            return stored;
        }
        return {
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
        const cleanName = String(name == null ? '' : name).normalize('NFC').trim().replace(/\s+/g, ' ');
        if (cleanName.length < 2 || cleanName.length > 40) {
            throw new Error('Le nom du profil doit contenir entre 2 et 40 caractères.');
        }
        const profiles = getProfiles();
        let newId;
        do { newId = makeId(); } while (profiles[newId]);

        profiles[newId] = {
            id: newId,
            name: cleanName,
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
            const prefix = profileId + '_';
            Object.values(STORAGE_KEYS).forEach(key => {
                if (key !== STORAGE_KEYS.PROFILES && key !== STORAGE_KEYS.CURRENT_PROFILE) {
                    try { localStorage.removeItem(prefix + key); } catch (e) { /* storage unavailable */ }
                }
            });
            
            // Switch to default if current profile was deleted
            if (currentProfileId === profileId) {
                switchProfile('default');
            }
            return true;
        }
        return false;
    }

    function getProfileData(profileId) {
        if (typeof profileId !== 'string' || !getProfiles()[profileId]) {
            throw new Error('Profil introuvable.');
        }
        const prefix = profileId + '_';
        const rawProgress = storage.get(prefix + STORAGE_KEYS.PROGRESS);
        const progress = rawProgress && typeof rawProgress === 'object' && !Array.isArray(rawProgress) ? rawProgress : {};
        ['lessons', 'exercises', 'tests'].forEach(function (k) {
            if (!progress[k] || typeof progress[k] !== 'object' || Array.isArray(progress[k])) progress[k] = {};
        });
        const results = storage.get(prefix + STORAGE_KEYS.QUIZ_RESULTS);
        const mistakes = storage.get(prefix + STORAGE_KEYS.MISTAKES);
        const streak = storage.get(prefix + STORAGE_KEYS.STREAK);
        const goals = storage.get(prefix + STORAGE_KEYS.GOALS);
        const notes = storage.get(prefix + STORAGE_KEYS.NOTES);
        const studyPlan = storage.get(prefix + STORAGE_KEYS.STUDY_PLAN);
        const dailyChallenges = storage.get(prefix + STORAGE_KEYS.DAILY_CHALLENGES);
        return {
            progress: progress,
            quizResults: Array.isArray(results) ? results : [],
            mistakes: Array.isArray(mistakes) ? mistakes : [],
            streak: streak && typeof streak === 'object' ? streak : { current: 0, best: 0, lastVisit: null },
            goals: Array.isArray(goals) ? goals : [],
            notes: Array.isArray(notes) ? notes.filter(n => n && typeof n === 'object') : [],
            studyPlan: Array.isArray(studyPlan) ? studyPlan.filter(item => item && typeof item === 'object') : [],
            dailyChallenges: dailyChallenges && typeof dailyChallenges === 'object' && !Array.isArray(dailyChallenges) ? dailyChallenges : {}
        };
    }

    function mergeCloudProgress(profileId, cloudProgress) {
        if (!cloudProgress || typeof cloudProgress !== 'object' || !getProfiles()[profileId]) return;
        const data = getProfileData(profileId);
        ['lessons', 'exercises', 'tests'].forEach(function (bucket) {
            const incoming = cloudProgress[bucket] && typeof cloudProgress[bucket] === 'object' ? cloudProgress[bucket] : {};
            Object.keys(incoming).forEach(function (key) {
                const remote = incoming[key] || {};
                const local = data.progress[bucket][key] || { id: key };
                if (remote.completed === true) local.completed = true;
                if (remote.cloudUpdatedAt) local.cloudUpdatedAt = remote.cloudUpdatedAt;
                data.progress[bucket][key] = local;
            });
        });
        saveProfileData(profileId, data);
    }

    function mergeCloudCollections(profileId, cloudNotes, cloudPlan) {
        if (!getProfiles()[profileId]) return;
        const prefix = profileId + '_';
        const data = getProfileData(profileId);
        function mergeById(localItems, remoteItems) {
            const merged = new Map();
            (Array.isArray(localItems) ? localItems : []).forEach(function (item) {
                if (item && item.id) merged.set(String(item.id), item);
            });
            (Array.isArray(remoteItems) ? remoteItems : []).forEach(function (remote) {
                if (!remote || !remote.id) return;
                const key = String(remote.id);
                const local = merged.get(key);
                const localTime = Number(local && (local.updatedAt || local.createdAt)) || 0;
                const remoteTime = Number(remote.updatedAt || remote.createdAt) || 0;
                if (!local || remoteTime > localTime) merged.set(key, remote);
            });
            return Array.from(merged.values());
        }
        if (Array.isArray(cloudNotes)) data.notes = mergeById(data.notes, cloudNotes);
        if (Array.isArray(cloudPlan)) data.studyPlan = mergeById(data.studyPlan, cloudPlan);
        storage.set(prefix + STORAGE_KEYS.NOTES, data.notes);
        storage.set(prefix + STORAGE_KEYS.STUDY_PLAN, data.studyPlan);
        saveProfileData(profileId, data);
    }

    function mergeCloudQuizAttempts(profileId, cloudAttempts) {
        if (!Array.isArray(cloudAttempts) || !getProfiles()[profileId]) return;
        const data = getProfileData(profileId);
        const byAttempt = new Map();
        data.quizResults.forEach(function (attempt) {
            if (attempt && attempt.attemptId) byAttempt.set(String(attempt.attemptId), attempt);
        });
        cloudAttempts.forEach(function (remote) {
            if (!remote || !remote.attemptId || !remote.quizId) return;
            const key = String(remote.attemptId);
            if (!byAttempt.has(key)) {
                const attempt = {
                    attemptId: key,
                    quizId: String(remote.quizId),
                    score: Number(remote.score) || 0,
                    total: Number(remote.total) || 0,
                    percentage: Number(remote.percentage) || 0,
                    date: Number(remote.date) || Date.now(),
                    mistakes: Array.isArray(remote.mistakes) ? remote.mistakes : []
                };
                byAttempt.set(key, attempt);
            }
        });
        data.quizResults = Array.from(byAttempt.values()).sort((a, b) => (Number(a.date) || 0) - (Number(b.date) || 0));
        const mistakeKeys = new Set(data.mistakes.map(m =>
            [m && m.quizId, m && m.question, m && m.selected, m && m.correct, m && m.date].join('|')
        ));
        data.quizResults.forEach(function (attempt) {
            (Array.isArray(attempt.mistakes) ? attempt.mistakes : []).forEach(function (mistake) {
                const normalized = {
                    question: String(mistake && mistake.question || '').slice(0, 2000),
                    selected: String(mistake && mistake.selected || '').slice(0, 1000),
                    correct: String(mistake && mistake.correct || '').slice(0, 1000),
                    quizId: String(attempt.quizId),
                    date: Number(mistake && mistake.date) || Number(attempt.date) || Date.now()
                };
                const key = [normalized.quizId, normalized.question, normalized.selected, normalized.correct, normalized.date].join('|');
                if (!mistakeKeys.has(key)) {
                    mistakeKeys.add(key);
                    data.mistakes.push(normalized);
                }
            });
        });
        saveProfileData(profileId, data);
    }

    function saveProfileData(profileId, data) {
        const prefix = profileId + '_';
        storage.set(prefix + STORAGE_KEYS.PROGRESS, data.progress);
        storage.set(prefix + STORAGE_KEYS.QUIZ_RESULTS, data.quizResults);
        storage.set(prefix + STORAGE_KEYS.MISTAKES, data.mistakes);
        storage.set(prefix + STORAGE_KEYS.STREAK, data.streak);
        storage.set(prefix + STORAGE_KEYS.GOALS, data.goals);
        storage.set(prefix + STORAGE_KEYS.NOTES, Array.isArray(data.notes) ? data.notes : []);
        storage.set(prefix + STORAGE_KEYS.STUDY_PLAN, Array.isArray(data.studyPlan) ? data.studyPlan : []);
        storage.set(prefix + STORAGE_KEYS.DAILY_CHALLENGES, data.dailyChallenges && typeof data.dailyChallenges === 'object' ? data.dailyChallenges : {});
        // Keep the offline cache, but sync only when this profile still belongs to
        // the currently authenticated account. Pass its UID so delayed requests
        // cannot be redirected to a different account after an account switch.
        const account = window.StudentAccount;
        const cloudUid = account && account.isLoggedIn() &&
            account.activeProfileId() === profileId &&
            account.getUser() && account.getUser().id;
        if (window.GoSVTCloud && cloudUid) {
            const jobs = [
                ['progress', 'syncProgress', data.progress],
                ['notes', 'syncNotes', data.notes],
                ['study plan', 'syncStudyPlan', data.studyPlan],
                ['quiz attempts', 'syncQuizAttempts', data.quizResults]
            ];
            jobs.forEach(function (job) {
                if (typeof window.GoSVTCloud[job[1]] !== 'function') return;
                Promise.resolve().then(function () {
                    return window.GoSVTCloud[job[1]](job[2], cloudUid);
                }).catch(function (err) {
                    console.warn('[GoSVT] Cloud ' + job[0] + ' sync deferred:', err && err.message);
                });
            });
        }
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
            planner: 'برنامج المراجعة',
            notesTab: 'ملاحظاتي',
            libraryTab: 'مواردي',
            welcome: 'مرحباً بك في فضائك الدراسي',
            continueLearning: 'تابع التعلم',
            quickAccess: 'وصول سريع',
            addTask: 'إضافة موعد مراجعة',
            taskTitle: 'عنوان المراجعة',
            taskDate: 'تاريخ المراجعة',
            duration: 'المدة بالدقائق',
            addNote: 'إضافة ملاحظة',
            noteTitle: 'عنوان الملاحظة',
            noteBody: 'اكتب ملاحظتك هنا...',
            save: 'حفظ',
            delete: 'حذف',
            done: 'منجز',
            pending: 'قيد الإنجاز',
            noTasks: 'لا توجد مواعيد مراجعة بعد',
            noNotes: 'لا توجد ملاحظات بعد',
            resources: 'الدروس والموارد',
            exercises: 'التمارين',
            exams: 'الامتحانات',
            interactiveQuiz: 'اختبارات تفاعلية',
            summaries: 'الملخصات',
            profiles: 'الملفات الشخصية',
            settings: 'الإعدادات',
            lessonsViewed: 'الدروس المشاهدة',
            exercisesDone: 'التمارين التي تمت مشاهدتها',
            testsTaken: 'الاختبارات المجراة',
            averageScore: 'المعدل',
            globalProgress: 'التقدم العام',
            completedLessons: 'الدروس المكتملة',
            byTrack: 'حسب المستوى والشعبة',
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
            planner: 'Mon planning',
            notesTab: 'Mes notes',
            libraryTab: 'Mes ressources',
            welcome: 'Bienvenue dans votre espace d’apprentissage',
            continueLearning: 'Continuer à apprendre',
            quickAccess: 'Accès rapide',
            addTask: 'Ajouter une séance',
            taskTitle: 'Titre de la révision',
            taskDate: 'Date de révision',
            duration: 'Durée en minutes',
            addNote: 'Ajouter une note',
            noteTitle: 'Titre de la note',
            noteBody: 'Écrivez votre note ici...',
            save: 'Enregistrer',
            delete: 'Supprimer',
            done: 'Terminée',
            pending: 'À faire',
            noTasks: 'Aucune séance de révision pour le moment',
            noNotes: 'Aucune note pour le moment',
            resources: 'Cours et ressources',
            exercises: 'Exercices',
            exams: 'Examens',
            interactiveQuiz: 'Quiz interactifs',
            summaries: 'Résumés',
            profiles: 'Profils',
            settings: 'Paramètres',
            lessonsViewed: 'Leçons consultées',
            exercisesDone: 'Exercices consultés',
            testsTaken: 'Tests effectués',
            averageScore: 'Score moyen',
            globalProgress: 'Progression globale',
            completedLessons: 'Leçons terminées',
            byTrack: 'Par niveau et filière',
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
    // Les anciens appelants utilisaient le singulier ('lesson'...) alors que le
    // stockage utilise 'lessons' / 'exercises' / 'tests'.
    const PROGRESS_TYPE_ALIASES = {
        lesson: 'lessons', lessons: 'lessons',
        exercise: 'exercises', exercises: 'exercises',
        exam: 'tests', exams: 'tests', test: 'tests', tests: 'tests'
    };

    // Clé stable d'un document : chemin décodé, NFC, sans "/" initial
    function normalizeItemKey(item) {
        let key = String(item == null ? '' : item);
        key = key.replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]+/i, '').replace(/^([^?#]*)[?#].*$/, function (m, path) {
            return /%/.test(path) ? path : m; // ?/# ignorés seulement pour une URL encodée
        });
        try { key = decodeURIComponent(key); } catch (e) { /* déjà décodé */ }
        return key.normalize('NFC').replace(/^\/+/, '');
    }

    // Sans compte connecté (quand student-account.js est présent) rien n'est enregistré.
    function canTrack() {
        if (window.StudentAccount && !window.StudentAccount.isLoggedIn()) return false;
        syncCurrentProfile();
        return true;
    }

    // Déduit catégorie / langue / niveau / filière d'un chemin "cours/francais/1BAC/1BACSE/x.pdf"
    // (les dossiers d'examens "2BAC SM" sont reconnus après suppression des espaces)
    const TRACK_CODE = /^(TC[SL]|1BAC(SE|SM|L)|2BAC(SVT|SP|SM))$/;
    function parseContentPath(key) {
        const segs = String(key || '').split('/').filter(Boolean);
        const info = { category: segs[0] || '', lang: segs[1] || '', level: segs[2] || '', track: '' };
        segs.slice(3, -1).some(function (d) {
            const code = d.replace(/\s+/g, '').toUpperCase();
            if (TRACK_CODE.test(code) && code.indexOf(info.level) === 0) { info.track = code; return true; }
            return false;
        });
        return info;
    }

    // Enregistre la CONSULTATION (viewed) d'un contenu. Ne marque jamais "terminé".
    // meta (optionnel) : { title, path }
    function updateProgress(type, item, meta) {
        if (!canTrack()) return null;
        const category = PROGRESS_TYPE_ALIASES[type];
        const key = normalizeItemKey(item);
        if (!category || !key) return null;

        syncCurrentProfile();
        const profileData = getProfileData(currentProfileId);
        const bucket = profileData.progress[category];
        const now = Date.now();
        meta = meta || {};

        let entry = bucket[key];
        const isNew = !entry;
        if (isNew) {
            entry = bucket[key] = {
                id: key,
                completed: false,
                firstViewed: now,
                attempts: 0,
                viewCount: 0
            };
        }
        // Une entrée existante garde son état "terminé" ; on complète les métadonnées
        entry.id = entry.id || key;
        entry.title = meta.title || entry.title || key.split('/').pop().replace(/\.[^/.]+$/, '');
        entry.path = meta.path ? normalizeItemKey(meta.path) : (entry.path || key);
        entry.viewed = true;
        const where = parseContentPath(entry.path);
        entry.category = where.category; entry.lang = where.lang;
        entry.level = where.level; entry.track = where.track;
        entry.firstViewed = entry.firstViewed || entry.lastViewed || now;
        entry.lastViewed = now;
        entry.viewCount = (entry.viewCount || 0) + 1;
        entry.attempts = (entry.attempts || 0) + 1;

        saveProfileData(currentProfileId, profileData);
        updateStreak();

        try {
            document.dispatchEvent(new CustomEvent('gosvt:progress-updated', {
                detail: { profileId: currentProfileId, type: category, key: key, isNew: isNew }
            }));
        } catch (e) { /* ancien navigateur */ }
        refreshStudentSpaceView();
        return profileData.progress;
    }

    function markLessonComplete(lessonId) {
        if (!canTrack()) return;
        const profileData = getProfileData(currentProfileId);
        if (profileData.progress.lessons[lessonId]) {
            profileData.progress.lessons[lessonId].completed = true;
            profileData.progress.lessons[lessonId].completedAt = Date.now();
            saveProfileData(currentProfileId, profileData);
            updateStreak();
        }
    }

    // Réaffiche l'espace élève (sans recharger la page) en conservant l'onglet interne actif
    function refreshStudentSpaceView() {
        const container = document.getElementById('student-space-content');
        if (!container || !container.children.length) return; // sera rendu à l'ouverture de la section
        // Preserve typed login fields while signed out, but switch to the dashboard immediately after a successful sign-in.
        if (container.querySelector('.gs-auth') &&
            !(window.StudentAccount && window.StudentAccount.isLoggedIn())) return;
        const active = container.querySelector('.space-tab.active');
        const tabName = active ? active.dataset.tab : 'dashboard';
        renderStudentSpace();
        if (tabName && tabName !== 'dashboard') {
            container.querySelectorAll('.space-tab').forEach(function (b) {
                b.classList.toggle('active', b.dataset.tab === tabName);
            });
            container.querySelectorAll('.space-panel').forEach(function (p) {
                p.classList.toggle('active', p.id === 'panel-' + tabName);
            });
        }
    }

    // ============================================
    // 4. QUIZ RESULTS (نتائج الاختبارات)
    // ============================================
    function saveQuizResult(quizId, score, totalQuestions, mistakes, attemptId, silentRefresh) {
        if (!canTrack()) return null;
        const id = String(quizId == null ? '' : quizId).trim();
        const total = Number(totalQuestions);
        const points = Number(score);
        if (!id || id.length > 200 || !Number.isInteger(total) || total <= 0 ||
            !Number.isInteger(points) || points < 0 || points > total) {
            throw new Error('Résultat de quiz invalide.');
        }
        const profileData = getProfileData(currentProfileId);
        const token = String(attemptId || makeId());
        if (profileData.quizResults.some(r => r && r.attemptId === token)) {
            return profileData.quizResults;
        }
        const safeMistakes = Array.isArray(mistakes) ? mistakes.slice(0, total).map(m => ({
            question: String(m && m.question || '').slice(0, 2000),
            selected: String(m && m.selected || '').slice(0, 1000),
            correct: String(m && m.correct || '').slice(0, 1000),
            quizId: id,
            date: Date.now()
        })) : [];
        profileData.quizResults.push({
            quizId: id,
            attemptId: token,
            score: points,
            total: total,
            percentage: Math.round((points / total) * 100),
            date: Date.now(),
            mistakes: safeMistakes
        });
        safeMistakes.forEach(mistake => profileData.mistakes.push(mistake));
        saveProfileData(currentProfileId, profileData);
        updateStreak();
        if (!silentRefresh) refreshStudentSpaceView();
        return profileData.quizResults;
    }

    // ============================================
    // 5. STREAK TRACKING (تتبع الأيام المتتالية)
    // ============================================
    function updateStreak() {
        if (!canTrack()) return;
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


    // Daily SVT challenge: one deterministic question per UTC date.
    const DAILY_CHALLENGES = [
        { ar: { q: 'ما العضية المسؤولة أساساً عن إنتاج الطاقة القابلة للاستعمال في الخلية؟', options: ['النواة', 'الميتوكندري', 'جهاز غولجي', 'الريبوسوم'], explanation: 'الميتوكندري يساهم في إنتاج ATP خلال التنفس الخلوي.' }, fr: { q: 'Quel organite joue un rôle majeur dans la production d’énergie utilisable par la cellule ?', options: ['Le noyau', 'La mitochondrie', 'L’appareil de Golgi', 'Le ribosome'], explanation: 'La mitochondrie participe à la production d’ATP lors de la respiration cellulaire.' }, answer: 1 },
        { ar: { q: 'ما الغاز الذي تمتصه النباتات الخضراء خلال عملية التركيب الضوئي؟', options: ['الأكسجين', 'الآزوت', 'ثنائي أكسيد الكربون', 'الهيدروجين'], explanation: 'تمتص النباتات ثنائي أكسيد الكربون وتستعمله مع الماء والضوء لتركيب المادة العضوية.' }, fr: { q: 'Quel gaz les plantes vertes absorbent-elles pendant la photosynthèse ?', options: ['Le dioxygène', 'Le diazote', 'Le dioxyde de carbone', 'Le dihydrogène'], explanation: 'Les plantes utilisent le dioxyde de carbone, l’eau et la lumière pour fabriquer de la matière organique.' }, answer: 2 },
        { ar: { q: 'أين يتم تبادل الغازات التنفسية بين الهواء والدم في الرئتين؟', options: ['القصبة الهوائية', 'الحويصلات الرئوية', 'الحنجرة', 'الشعب الرئيسية'], explanation: 'تسمح جدران الحويصلات الرئوية الرقيقة بانتشار الأكسجين وثنائي أكسيد الكربون بين الهواء والدم.' }, fr: { q: 'Où ont lieu les échanges gazeux entre l’air et le sang dans les poumons ?', options: ['La trachée', 'Les alvéoles pulmonaires', 'Le larynx', 'Les bronches principales'], explanation: 'Les parois fines des alvéoles permettent la diffusion du dioxygène et du dioxyde de carbone.' }, answer: 1 },
        { ar: { q: 'ما الوحدة البنيوية والوظيفية الأساسية للكائنات الحية؟', options: ['النسيج', 'العضو', 'الخلية', 'الجهاز'], explanation: 'الخلية هي أصغر وحدة بنيوية ووظيفية للكائن الحي.' }, fr: { q: 'Quelle est l’unité structurale et fonctionnelle de base des êtres vivants ?', options: ['Le tissu', 'L’organe', 'La cellule', 'L’appareil'], explanation: 'La cellule est la plus petite unité structurale et fonctionnelle du vivant.' }, answer: 2 },
        { ar: { q: 'ما اسم انتقال الماء عبر غشاء شبه منفذ من وسط أقل تركيزاً بالمواد المذابة إلى وسط أكثر تركيزاً؟', options: ['الانتشار', 'الأسموز', 'النقل النشيط', 'البلعمة'], explanation: 'الأسموز هو انتقال الماء عبر غشاء شبه منفذ وفق فرق تركيز المواد المذابة.' }, fr: { q: 'Comment appelle-t-on le passage de l’eau à travers une membrane semi-perméable vers le milieu le plus concentré en solutés ?', options: ['La diffusion', 'L’osmose', 'Le transport actif', 'La phagocytose'], explanation: 'L’osmose correspond au déplacement de l’eau à travers une membrane semi-perméable selon le gradient de concentration.' }, answer: 1 },
        { ar: { q: 'ما الجزيئة التي تحمل المعلومة الوراثية عند معظم الكائنات الحية؟', options: ['ATP', 'DNA', 'الغلوكوز', 'الهيموغلوبين'], explanation: 'يحمل الحمض النووي DNA المعلومة الوراثية عند معظم الكائنات الحية.' }, fr: { q: 'Quelle molécule porte l’information génétique chez la plupart des êtres vivants ?', options: ['ATP', 'ADN', 'Glucose', 'Hémoglobine'], explanation: 'L’ADN porte l’information génétique chez la plupart des êtres vivants.' }, answer: 1 },
        { ar: { q: 'أي مكوّن من الدم يساهم أساساً في نقل الأكسجين؟', options: ['الكريات الحمراء', 'الصفائح الدموية', 'الكريات البيضاء', 'البلازما فقط'], explanation: 'تحتوي الكريات الحمراء على الهيموغلوبين الذي يرتبط بالأكسجين ويساهم في نقله.' }, fr: { q: 'Quel élément du sang assure principalement le transport du dioxygène ?', options: ['Les globules rouges', 'Les plaquettes', 'Les globules blancs', 'Le plasma seul'], explanation: 'Les globules rouges contiennent l’hémoglobine qui fixe et transporte le dioxygène.' }, answer: 0 }
    ];

    function getDailyChallengeInfo() {
        const dateParts = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Africa/Casablanca', year: 'numeric', month: '2-digit', day: '2-digit'
        }).formatToParts(new Date());
        const dateValues = Object.fromEntries(dateParts.map(part => [part.type, part.value]));
        const date = dateValues.year + '-' + dateValues.month + '-' + dateValues.day;
        const dayNumber = Math.floor(Date.parse(date + 'T00:00:00Z') / 86400000);
        const index = ((dayNumber % DAILY_CHALLENGES.length) + DAILY_CHALLENGES.length) % DAILY_CHALLENGES.length;
        return { date: date, id: 'svt-daily-' + date, question: DAILY_CHALLENGES[index] };
    }

    function renderDailyChallenge() {
        const info = getDailyChallengeInfo();
        const record = getProfileData(currentProfileId).dailyChallenges[info.date];
        const fr = lang() === 'fr';
        const q = fr ? info.question.fr : info.question.ar;
        const title = fr ? 'Le défi SVT du jour' : 'التحدي العلمي اليومي';
        const intro = fr ? 'Une question courte pour entretenir votre curiosité scientifique.' : 'سؤال يومي قصير لتنمية فضولك العلمي وترسيخ مكتسباتك.';
        const points = fr ? '10 points' : '10 نقاط';
        let body = '';
        if (record) {
            const chosen = Number(record.selected_option);
            const correct = record.is_correct === true;
            body = `<div class="gs-daily-result ${correct ? 'is-correct' : 'is-wrong'}">
                <strong>${correct ? (fr ? 'Bonne réponse ! +10 points' : 'إجابة صحيحة! +10 نقاط') : (fr ? 'Ce n’est pas la bonne réponse.' : 'ليست الإجابة الصحيحة.')}</strong>
                <p>${fr ? 'Votre réponse' : 'إجابتك'} : ${escapeHtml(q.options[chosen] || '')}</p>
                <p>${fr ? 'Réponse correcte' : 'الإجابة الصحيحة'} : ${escapeHtml(q.options[info.question.answer])}</p>
                <small>${escapeHtml(q.explanation)}</small>
                <span>${fr ? 'Défi déjà validé aujourd’hui' : 'لقد أجبت عن تحدي اليوم بالفعل'}</span>
            </div>`;
        } else {
            body = `<div class="gs-daily-options">${q.options.map((option, index) => `<button type="button" class="gs-daily-option" data-daily-option="${index}"><span>${String.fromCharCode(65 + index)}</span>${escapeHtml(option)}</button>`).join('')}</div>
                <p class="gs-daily-hint">${fr ? 'Choisissez une seule réponse. Vous ne pourrez répondre qu’une fois aujourd’hui.' : 'اختر إجابة واحدة فقط. يمكنك المشاركة مرة واحدة اليوم.'}</p>`;
        }
        return `<section class="gs-daily-challenge" id="gs-daily-challenge" data-challenge-date="${info.date}">
            <div class="gs-daily-head"><div><span class="gs-eyebrow">${fr ? 'UN RENDEZ-VOUS SCIENTIFIQUE' : 'موعدك اليومي مع العلم'}</span><h3>🧠 ${title}</h3><p>${intro}</p></div><strong class="gs-daily-points">⭐ ${points}</strong></div>
            <div class="gs-daily-question"><span>${fr ? 'QUESTION DU JOUR' : 'سؤال اليوم'}</span><h4>${escapeHtml(q.q)}</h4></div>
            ${body}<p class="gs-daily-message" aria-live="polite"></p>
        </section>`;
    }

    async function hydrateDailyChallenge() {
        if (!window.GoSVTCloud || typeof window.GoSVTCloud.loadDailyChallenge !== 'function' ||
            !(window.StudentAccount && window.StudentAccount.isLoggedIn())) return;
        const account = window.StudentAccount;
        const profileId = currentProfileId;
        const user = account && account.getUser && account.getUser();
        const studentId = user && user.id;
        if (!studentId || !account.isLoggedIn()) return;
        const info = getDailyChallengeInfo();
        const cardBeforeSync = document.getElementById('gs-daily-challenge');
        if (cardBeforeSync && cardBeforeSync.dataset.challengeDate === info.date) {
            cardBeforeSync.dataset.challengeSync = 'pending';
            cardBeforeSync.querySelectorAll('.gs-daily-option').forEach(option => { option.disabled = true; });
            const message = cardBeforeSync.querySelector('.gs-daily-message');
            if (message) message.textContent = lang() === 'fr'
                ? 'Vérification de votre participation…'
                : 'جارٍ التحقق من مشاركتك السابقة اليوم…';
        }
        const stillOwner = () => currentProfileId === profileId &&
            window.StudentAccount && window.StudentAccount.isLoggedIn() &&
            window.StudentAccount.getUser() && window.StudentAccount.getUser().id === studentId;
        try {
            const remote = await window.GoSVTCloud.loadDailyChallenge(info.date, studentId);
            if (!stillOwner()) return;
            if (!remote) {
                const currentCard = document.getElementById('gs-daily-challenge');
                if (currentCard && currentCard.dataset.challengeDate === info.date) {
                    currentCard.dataset.challengeSync = 'ready';
                    currentCard.querySelectorAll('.gs-daily-option').forEach(option => { option.disabled = false; });
                    const message = currentCard.querySelector('.gs-daily-message');
                    if (message) message.textContent = '';
                }
                return;
            }
            const data = getProfileData(profileId);
            data.dailyChallenges[info.date] = remote;
            storage.set(profileId + '_' + STORAGE_KEYS.DAILY_CHALLENGES, data.dailyChallenges);
            const card = document.getElementById('gs-daily-challenge');
            if (card && card.dataset.challengeDate === info.date) {
                // Update only the challenge card; rebuilding the whole student space causes visible flicker.
                card.outerHTML = renderDailyChallenge();
            }
        } catch (err) {
            console.warn('[GoSVT] Daily challenge restore deferred:', err && err.message);
            const currentCard = document.getElementById('gs-daily-challenge');
            if (stillOwner() && currentCard && currentCard.dataset.challengeDate === info.date) {
                currentCard.dataset.challengeSync = 'ready';
                currentCard.querySelectorAll('.gs-daily-option').forEach(option => { option.disabled = false; });
                const message = currentCard.querySelector('.gs-daily-message');
                if (message) message.textContent = lang() === 'fr'
                    ? 'Vérification indisponible. Votre réponse sera vérifiée lors de son enregistrement.'
                    : 'تعذر التحقق المسبق. سيتم التحقق من إجابتك عند تسجيلها.';
            }
        }
    }

    async function answerDailyChallenge(selectedOption, button) {
        const account = window.StudentAccount;
        if (!account || !account.isLoggedIn() || !account.getUser || !account.getUser()) return;
        const profileId = currentProfileId;
        const studentId = account.getUser().id;
        const stillOwner = () => currentProfileId === profileId &&
            window.StudentAccount && window.StudentAccount.isLoggedIn() &&
            window.StudentAccount.getUser() && window.StudentAccount.getUser().id === studentId;
        const info = getDailyChallengeInfo();
        const data = getProfileData(profileId);
        if (data.dailyChallenges[info.date]) return;
        const option = Number(selectedOption);
        if (!Number.isInteger(option) || option < 0 || option > 3) return;
        const card = document.getElementById('gs-daily-challenge');
        if (!card || card.dataset.challengeDate !== info.date || card.dataset.challengeSync === 'pending') return;
        const message = card.querySelector('.gs-daily-message');
        const buttons = Array.from(card.querySelectorAll('.gs-daily-option'));
        buttons.forEach(item => { item.disabled = true; });
        if (message) message.textContent = lang() === 'fr' ? 'Enregistrement de votre réponse...' : 'جارٍ تسجيل إجابتك...';
        const correct = option === info.question.answer;
        const payload = {
            challenge_date: info.date,
            challenge_id: info.id,
            selected_option: option,
            is_correct: correct,
            points: correct ? 10 : 0,
            answered_at: new Date().toISOString()
        };
        try {
            if (!window.GoSVTCloud || typeof window.GoSVTCloud.submitDailyChallenge !== 'function') {
                throw new Error('Cloud challenge service unavailable');
            }
            const saved = await window.GoSVTCloud.submitDailyChallenge(payload, studentId);
            if (!stillOwner()) return;
            data.dailyChallenges[info.date] = saved || payload;
            storage.set(profileId + '_' + STORAGE_KEYS.DAILY_CHALLENGES, data.dailyChallenges);
            refreshStudentSpaceView();
        } catch (err) {
            if (!stillOwner()) return;
            console.error('[GoSVT] Daily challenge submission failed:', err);
            if (message) message.textContent = lang() === 'fr'
                ? 'Impossible d’enregistrer votre réponse. Vérifiez la connexion puis réessayez.'
                : 'تعذر تسجيل إجابتك. تحقق من الاتصال ثم أعد المحاولة.';
            buttons.forEach(item => { item.disabled = false; });
            try {
                const existing = await window.GoSVTCloud.loadDailyChallenge(info.date, studentId);
                if (existing && stillOwner()) {
                    data.dailyChallenges[info.date] = existing;
                    storage.set(profileId + '_' + STORAGE_KEYS.DAILY_CHALLENGES, data.dailyChallenges);
                    refreshStudentSpaceView();
                }
            } catch (_) {}
        }
    }

    // ============================================
    // 6. DASHBOARD (لوحة القيادة)
    // ============================================
    function getDashboardStats() {
        syncCurrentProfile();
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
        if (!profile) throw new Error('Profil introuvable.');
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
        const safeFileName = String(profile.name).replace(/[^\p{L}\p{N}_-]+/gu, '_').slice(0, 40);
        a.download = `gosvt_profile_${safeFileName}_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function importProfileData(jsonString) {
        try {
            if (typeof jsonString !== 'string' || jsonString.length > 5 * 1024 * 1024) {
                throw new Error('Fichier trop volumineux ou invalide.');
            }
            const payload = JSON.parse(jsonString);
            const p = payload && payload.profile;
            const d = payload && payload.data;
            if (!p || typeof p !== 'object' || typeof p.id !== 'string' ||
                !/^profile_[a-zA-Z0-9_-]{1,100}$/.test(p.id) ||
                typeof p.name !== 'string' || p.name.trim().length < 2 || p.name.length > 40 ||
                !d || typeof d !== 'object' || !d.progress || typeof d.progress !== 'object' ||
                !Array.isArray(d.quizResults) || !Array.isArray(d.mistakes) ||
                !d.streak || typeof d.streak !== 'object' || !Array.isArray(d.goals)) {
                throw new Error('Structure de sauvegarde invalide.');
            }
            if (payload.version !== '1.0') {
                throw new Error('Version de sauvegarde non prise en charge.');
            }
            const normalized = {
                progress: {
                    lessons: d.progress.lessons && typeof d.progress.lessons === 'object' && !Array.isArray(d.progress.lessons) ? d.progress.lessons : {},
                    exercises: d.progress.exercises && typeof d.progress.exercises === 'object' && !Array.isArray(d.progress.exercises) ? d.progress.exercises : {},
                    tests: d.progress.tests && typeof d.progress.tests === 'object' && !Array.isArray(d.progress.tests) ? d.progress.tests : {}
                },
                quizResults: d.quizResults,
                mistakes: d.mistakes,
                streak: {
                    current: Number.isInteger(d.streak.current) && d.streak.current >= 0 ? d.streak.current : 0,
                    best: Number.isInteger(d.streak.best) && d.streak.best >= 0 ? d.streak.best : 0,
                    lastVisit: Number.isFinite(d.streak.lastVisit) ? d.streak.lastVisit : null
                },
                goals: d.goals,
                notes: Array.isArray(d.notes) ? d.notes.filter(n => n && typeof n === 'object').slice(0, 500) : [],
                studyPlan: Array.isArray(d.studyPlan) ? d.studyPlan.filter(item => item && typeof item === 'object').slice(0, 500) : []
            };
            const profiles = getProfiles();
            const existing = profiles[p.id];
            if (existing && !confirm('Ce profil existe déjà. Voulez-vous remplacer ses données ?')) return false;
            const safeProfile = {
                id: p.id,
                name: p.name.normalize('NFC').trim(),
                createdAt: Number.isFinite(p.createdAt) ? p.createdAt : Date.now(),
                lastActive: Date.now()
            };
            profiles[p.id] = safeProfile;
            saveProfiles(profiles);
            saveProfileData(p.id, normalized);
            return true;
        } catch (e) {
            console.error('Import error:', e);
            alert(t('invalidFile'));
            return false;
        }
    }

    // Badges are derived from real progress records. Those records are already synced to Supabase.
    function renderAchievements() {
        const data = getProfileData(currentProfileId);
        const lessonsViewed = Object.keys(data.progress.lessons || {}).length;
        const exercisesViewed = Object.keys(data.progress.exercises || {}).length;
        const completedLessons = Object.values(data.progress.lessons || {}).filter(item => item && item.completed === true).length;
        const badges = lang() === 'ar' ? [
            { icon: '🌱', title: 'مستكشف صغير', detail: 'شاهدت أول درس في علوم الحياة والأرض', value: lessonsViewed, target: 1 },
            { icon: '📚', title: 'محب المعرفة', detail: 'شاهدت خمسة دروس مختلفة', value: lessonsViewed, target: 5 },
            { icon: '✏️', title: 'متدرب نشيط', detail: 'اطلعت على أول تمرين', value: exercisesViewed, target: 1 },
            { icon: '✅', title: 'خطوة نحو الإتقان', detail: 'أكملت أول درس', value: completedLessons, target: 1 },
            { icon: '🏅', title: 'باني المعرفة', detail: 'أكملت ثلاثة دروس', value: completedLessons, target: 3 }
        ] : [
            { icon: '🌱', title: 'Petit explorateur', detail: 'Vous avez consulté votre premier cours', value: lessonsViewed, target: 1 },
            { icon: '📚', title: 'Curieux', detail: 'Vous avez consulté cinq cours différents', value: lessonsViewed, target: 5 },
            { icon: '✏️', title: 'Entraînement actif', detail: 'Vous avez consulté votre premier exercice', value: exercisesViewed, target: 1 },
            { icon: '✅', title: 'Vers la maîtrise', detail: 'Vous avez terminé votre premier cours', value: completedLessons, target: 1 },
            { icon: '🏅', title: 'Bâtisseur du savoir', detail: 'Vous avez terminé trois cours', value: completedLessons, target: 3 }
        ];
        const earned = badges.filter(badge => badge.value >= badge.target).length;
        const heading = lang() === 'ar' ? 'إنجازاتي وشاراتي' : 'Mes réussites et badges';
        const subtitle = lang() === 'ar'
            ? 'كل شارة تعكس خطوة حقيقية في مسارك الدراسي.'
            : 'Chaque badge récompense une étape réelle de votre parcours.';
        const status = lang() === 'ar' ? 'مكتسبة' : 'Obtenu';
        const locked = lang() === 'ar' ? 'قيد الإنجاز' : 'À débloquer';
        return `<section class="gs-achievements">
            <div class="gs-achievements-heading">
                <div><span class="gs-eyebrow">${lang() === 'ar' ? 'تقدمك يستحق التقدير' : 'VOS EFFORTS COMPTENT'}</span><h3>${heading}</h3><p>${subtitle}</p></div>
                <div class="gs-achievements-count"><strong>${earned}/${badges.length}</strong><small>${lang() === 'ar' ? 'شارات مكتسبة' : 'badges obtenus'}</small></div>
            </div>
            <div class="gs-badges-grid">${badges.map(badge => {
                const unlocked = badge.value >= badge.target;
                const percent = Math.min(100, Math.round((badge.value / badge.target) * 100));
                return `<article class="gs-badge-card ${unlocked ? 'is-earned' : 'is-locked'}">
                    <span class="gs-badge-icon">${badge.icon}</span>
                    <div class="gs-badge-copy"><strong>${badge.title}</strong><small>${badge.detail}</small>
                    ${unlocked ? `<span class="gs-badge-status">${status} ✓</span>` : `<span class="gs-badge-status">${locked} · ${Math.min(badge.value, badge.target)}/${badge.target}</span><span class="gs-badge-track"><i style="width:${percent}%"></i></span>`}</div>
                </article>`;
            }).join('')}</div>
        </section>`;
    }

    function renderStudyRecommendations() {
        const data = getProfileData(currentProfileId);
        const latestByQuiz = Object.create(null);
        (data.quizResults || []).forEach(result => {
            if (!result || typeof result.quizId !== 'string' ||
                !Number.isFinite(result.percentage) || !Number.isFinite(result.date)) return;
            if (!latestByQuiz[result.quizId] || result.date > latestByQuiz[result.quizId].date) {
                latestByQuiz[result.quizId] = result;
            }
        });
        const needsReview = Object.values(latestByQuiz)
            .filter(result => result.percentage < 70)
            .sort((a, b) => a.percentage - b.percentage)
            .slice(0, 3);
        if (!needsReview.length) return '';

        return `
            <section class="gs-review-recommendations">
                <div class="gs-review-recommendations-head">
                    <span>🎯</span>
                    <div>
                        <strong>${lang() === 'ar' ? 'مراجعة مقترحة' : 'Révisions conseillées'}</strong>
                        <p>${lang() === 'ar' ? 'راجع هذه المحاور لتعزيز مكتسباتك.' : 'Consolidez vos acquis sur ces thèmes.'}</p>
                    </div>
                </div>
                <div class="gs-review-recommendations-list">
                    ${needsReview.map(result => {
                        const internalTargets = {
                            'human-systems-atlas': 'gs-anatomy-title',
                            'cell-photosynthesis-revision': 'gs-svt-revision-title'
                        };
                        const target = internalTargets[result.quizId];
                        if (target) return '<button type="button" class="gs-review-recommendation gs-review-jump" data-study-anchor="' + target + '">' +
                            '<span>' + getQuizDisplayName(result.quizId) + '</span><strong>' + result.percentage + '%</strong>' +
                            '<small>' + (lang() === 'ar' ? 'انتقل إلى المراجعة' : 'Ouvrir la révision') + ' ←</small></button>';
                        const path = result.quizId.charAt(0) === '/' ? result.quizId.slice(1) : result.quizId;
                        if (!path.startsWith('quiz/') || !path.toLowerCase().endsWith('.json') ||
                            path.split('/').includes('..') || path.includes('?') || path.includes('#')) return '';
                        const href = '/?quiz=' + encodeURIComponent(path) + '#quiz';
                        const label = path.split('/').pop().slice(0, -5).replace(/[_-]/g, ' ');
                        return '<a class="gs-review-recommendation" href="' + escapeHtml(href) + '">' +
                            '<span>' + escapeHtml(label) + '</span><strong>' + result.percentage + '%</strong>' +
                            '<small>' + (lang() === 'ar' ? 'أعد المراجعة' : 'Revoir') + ' ←</small></a>';
                    }).join('')}
                </div>
            </section>`;
    }

    function renderPlantCellExplorer() {
        const fr = lang() === 'fr';
        const names = fr
          ? {nucleus:'Noyau',chloroplast:'Chloroplaste',vacuole:'Vacuole',membrane:'Membrane plasmique',wall:'Paroi cellulaire'}
          : {nucleus:'النواة',chloroplast:'البلاستيدة الخضراء',vacuole:'الفجوة العصارية',membrane:'الغشاء البلازمي',wall:'الجدار الخلوي'};
        const intro = fr ? 'Sélectionnez un organite pour découvrir son rôle.' : 'اختر عضية من الرسم لاكتشاف دورها.';
        const facts = fr
          ? {nucleus:'Le noyau contient l’information génétique (ADN) et participe au contrôle des activités cellulaires.',chloroplast:'Les chloroplastes contiennent la chlorophylle et réalisent la photosynthèse grâce à l’énergie lumineuse.',vacuole:'La grande vacuole stocke notamment l’eau et contribue au maintien de la turgescence.',membrane:'La membrane plasmique délimite la cellule et régule les échanges avec le milieu.',wall:'La paroi cellulosique protège la cellule et lui donne soutien et forme.'}
          : {nucleus:'تحتوي النواة على المعلومة الوراثية (ADN)، وتساهم في تنظيم أنشطة الخلية.',chloroplast:'تحتوي البلاستيدات الخضراء على اليخضور، وتنجز عملية التركيب الضوئي باستعمال الطاقة الضوئية.',vacuole:'تخزن الفجوة العصارية الماء ومواد مختلفة، وتساهم في الحفاظ على ضغط الامتلاء.',membrane:'يحيط الغشاء البلازمي بالخلية وينظم التبادلات بينها وبين الوسط الخارجي.',wall:'يوفر الجدار الخلوي دعامة وحماية للخلية ويساهم في الحفاظ على شكلها.'};
        return `<section class="gs-cell-lab" aria-labelledby="gs-cell-lab-title">
          <div class="gs-cell-lab-heading"><div><span class="gs-eyebrow">GO SVT MAROC · MINI LAB</span><h3 id="gs-cell-lab-title">${fr?'Explorez une cellule végétale':'استكشف الخلية النباتية'}</h3><p>${intro}</p></div><span class="gs-cell-lab-symbol" aria-hidden="true">🧫</span></div>
          <div class="gs-cell-lab-layout">
            <div class="gs-cell-illustration" role="img" aria-label="${fr?'Schéma simplifié d’une cellule végétale':'رسم مبسط لخلية نباتية'}">
              <svg viewBox="0 0 520 330" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <defs><linearGradient id="gsCellFill" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#e9f8d9"/><stop offset="1" stop-color="#b8e2a5"/></linearGradient><linearGradient id="gsVacuole" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#d8f1ff"/><stop offset="1" stop-color="#8bc9e8"/></linearGradient></defs>
                <rect x="28" y="35" width="464" height="260" rx="78" fill="#a8d18f" stroke="#39794b" stroke-width="12"/><rect x="43" y="50" width="434" height="230" rx="66" fill="url(#gsCellFill)" stroke="#f8fff2" stroke-width="5"/>
                <path d="M178 90 Q260 55 346 100 Q390 130 375 220 Q330 264 215 245 Q158 213 178 90Z" fill="url(#gsVacuole)" stroke="#68a9cb" stroke-width="3"/>
                <ellipse cx="128" cy="155" rx="43" ry="35" fill="#9c83d8" stroke="#604c9c" stroke-width="4"/><circle cx="140" cy="146" r="11" fill="#e8ddff"/>
                <g fill="#4d9c60" stroke="#27683c" stroke-width="3"><ellipse cx="397" cy="94" rx="32" ry="16"/><ellipse cx="110" cy="235" rx="30" ry="14"/></g>
                <g fill="none" stroke="#548d59" stroke-width="2" stroke-dasharray="5 5"><path d="M130 117L108 76H60"/><path d="M397 78L424 56H470"/><path d="M275 238L295 270H380"/><path d="M45 178L12 198"/></g>
              </svg>
            </div>
            <div class="gs-cell-controls">
              ${Object.entries(names).map(([key,name],i)=>`<button type="button" class="gs-cell-part ${i===0?'is-active':''}" data-cell-part="${key}" aria-pressed="${i===0?'true':'false'}"><span>0${i+1}</span>${name}</button>`).join('')}
            </div>
          </div>
          <div class="gs-cell-fact" aria-live="polite"><strong class="gs-cell-fact-title">${names.nucleus}</strong><p class="gs-cell-fact-text">${facts.nucleus}</p></div>
          <p class="gs-cell-note">${fr?'Schéma pédagogique simplifié, non à l’échelle.':'رسم تعليمي مبسط، وليس وفق مقياس حقيقي.'}</p>
        </section>`;
    }

    // Interactive photosynthesis lab: stage selector with bilingual explanations.
    function renderPhotosynthesisLab() {
        const fr = lang() === 'fr';
        const stages = fr
          ? [
              ['light','L’énergie lumineuse','La chlorophylle des chloroplastes capte l’énergie lumineuse nécessaire à la photosynthèse.'],
              ['water','L’eau et les sels minéraux','L’eau absorbée par les racines rejoint les feuilles grâce aux vaisseaux conducteurs.'],
              ['co2','Le dioxyde de carbone','Le CO₂ de l’air entre principalement dans la feuille par les stomates.'],
              ['sugar','La matière organique','Dans les chloroplastes, l’énergie lumineuse permet de fabriquer des sucres à partir de CO₂ et d’eau.'],
              ['oxygen','Le dioxygène','Du dioxygène est libéré dans l’atmosphère au cours de la photosynthèse.']
            ]
          : [
              ['light','الطاقة الضوئية','يلتقط اليخضور الموجود في البلاستيدات الخضراء الطاقة الضوئية اللازمة للتركيب الضوئي.'],
              ['water','الماء والأملاح المعدنية','تمتص الجذور الماء والأملاح المعدنية، ثم تنتقل نحو الأوراق عبر الأوعية الناقلة.'],
              ['co2','ثاني أكسيد الكربون','يدخل غاز CO₂ من الهواء إلى الورقة أساساً عبر الثغور.'],
              ['sugar','المادة العضوية','تستعمل البلاستيدات الخضراء الطاقة الضوئية لتصنيع السكريات انطلاقاً من الماء وCO₂.'],
              ['oxygen','غاز الأكسجين','ينطلق غاز الأكسجين إلى الوسط الخارجي خلال عملية التركيب الضوئي.']
            ];
        return `<section class="gs-photo-lab" aria-labelledby="gs-photo-lab-title">
          <div class="gs-photo-heading">
            <div><span class="gs-eyebrow">GO SVT MAROC · INTERACTIVE LAB</span>
              <h3 id="gs-photo-lab-title">${fr?'Le laboratoire de la photosynthèse':'مختبر التركيب الضوئي'}</h3>
              <p>${fr?'Explorez les éléments nécessaires et les produits de la photosynthèse.':'اكتشف العناصر الضرورية للتركيب الضوئي والنواتج المتكونة.'}</p></div>
            <span class="gs-photo-badge" aria-hidden="true">☀️</span>
          </div>
          <div class="gs-photo-scene">
            <div class="gs-photo-sun" aria-hidden="true">☀</div>
            <div class="gs-photo-leaf" aria-hidden="true">
              <svg viewBox="0 0 340 220" role="img" aria-label="${fr?'Feuille verte, lieu principal de la photosynthèse':'ورقة خضراء، مقر أساسي للتركيب الضوئي'}">
                <defs><linearGradient id="gsLeafGrad" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#a8dc77"/><stop offset="1" stop-color="#267b48"/></linearGradient></defs>
                <path d="M28 178C42 50 186 5 310 28C291 147 172 231 28 178Z" fill="url(#gsLeafGrad)" stroke="#246b40" stroke-width="5"/>
                <path d="M31 179Q157 110 303 31M111 137L93 75M155 116L164 48M198 94L244 55M117 137L173 181M173 108L225 149M224 81L270 112" fill="none" stroke="#e3f5c8" stroke-width="4" stroke-linecap="round"/>
                <g fill="#e9f8d8" opacity=".8"><circle cx="88" cy="139" r="5"/><circle cx="145" cy="83" r="4"/><circle cx="220" cy="66" r="5"/></g>
              </svg>
            </div>
            <div class="gs-photo-flow gs-flow-water"><span>💧</span><b>H₂O</b><small>${fr?'Depuis les racines':'من الجذور'}</small></div>
            <div class="gs-photo-flow gs-flow-co2"><span>🌫️</span><b>CO₂</b><small>${fr?'Depuis l’air':'من الهواء'}</small></div>
            <div class="gs-photo-flow gs-flow-light"><span>☀️</span><b>${fr?'Lumière':'ضوء'}</b></div>
            <div class="gs-photo-flow gs-flow-sugar"><span>🍃</span><b>${fr?'Sucres':'سكريات'}</b><small>${fr?'Matière organique':'مادة عضوية'}</small></div>
            <div class="gs-photo-flow gs-flow-o2"><span>🫧</span><b>O₂</b><small>${fr?'Vers l’air':'نحو الهواء'}</small></div>
          </div>
          <div class="gs-photo-stage-list" role="group" aria-label="${fr?'Étapes de la photosynthèse':'مراحل التركيب الضوئي'}">
            ${stages.map((stage,i)=>`<button type="button" class="gs-photo-stage ${i===0?'is-active':''}" data-photo-stage="${stage[0]}" aria-pressed="${i===0?'true':'false'}"><span>0${i+1}</span>${stage[1]}</button>`).join('')}
          </div>
          <div class="gs-photo-explanation" aria-live="polite"><strong class="gs-photo-fact-title">${stages[0][1]}</strong><p class="gs-photo-fact-text">${stages[0][2]}</p></div>
          <div class="gs-photo-equation"><span>${fr?'Équation simplifiée':'المعادلة الإجمالية المبسطة'}</span><strong>6 CO₂ + 6 H₂O + lumière → C₆H₁₂O₆ + 6 O₂</strong></div>
          <p class="gs-photo-note">${fr?'Schéma de synthèse : la photosynthèse se déroule dans les chloroplastes des cellules chlorophylliennes.':'رسم تركيبي: تتم عملية التركيب الضوئي داخل البلاستيدات الخضراء للخلايا اليخضورية.'}</p>
        </section>`;
    }

    function renderLevelLearningPaths() {
        const fr = lang() === 'fr';
        const account = window.StudentAccount;
        const academic = account && account.isLoggedIn && account.isLoggedIn() &&
            typeof account.getProfile === 'function' ? account.getProfile() : null;
        const level = String(academic && academic.study_level || '').toUpperCase();
        const track = String(academic && academic.study_track || '').toUpperCase();
        const current = level.startsWith('2BAC') ? '2BAC' : level.startsWith('1BAC') ? '1BAC' : level === 'TC' ? 'TC' : '';
        const paths = fr ? [
            {id:'TC',title:'Tronc commun',desc:'Découvrir la cellule végétale, les observations microscopiques et la photosynthèse.',steps:[['gs-cell-lab-title','Cellule végétale'],['gs-microscope-title','Observer au microscope'],['gs-photo-lab-title','Photosynthèse']]},
            {id:'1BAC',title:'1ère année Bac',desc:'Relier les cellules, les échanges et les grandes fonctions des systèmes du corps.',steps:[['gs-anatomy-title','Atlas du corps humain'],['gs-microscope-title','Préparations microscopiques'],['gs-svt-revision-title','Défi de révision']]},
            {id:'2BAC',title:'2ème année Bac',desc:'Approfondir les facteurs de la photosynthèse et consolider les notions scientifiques.',steps:[['gs-experiment-title','Expérience virtuelle'],['gs-svt-revision-title','Défi cellule et photosynthèse'],['gs-svt-glossary-title','Glossaire scientifique']]}
        ] : [
            {id:'TC',title:'الجذع المشترك',desc:'اكتشاف الخلية النباتية والملاحظة المجهرية وعملية التركيب الضوئي.',steps:[['gs-cell-lab-title','استكشاف الخلية النباتية'],['gs-microscope-title','الملاحظة بالمجهر'],['gs-photo-lab-title','مراحل التركيب الضوئي']]},
            {id:'1BAC',title:'الأولى بكالوريا',desc:'الربط بين الخلايا والتبادلات والوظائف الكبرى لأجهزة جسم الإنسان.',steps:[['gs-anatomy-title','أطلس جسم الإنسان'],['gs-microscope-title','التحضيرات المجهرية'],['gs-svt-revision-title','تحدي المراجعة']]},
            {id:'2BAC',title:'الثانية بكالوريا',desc:'تعميق فهم عوامل التركيب الضوئي وترسيخ المفاهيم العلمية الأساسية.',steps:[['gs-experiment-title','التجربة الافتراضية'],['gs-svt-revision-title','تحدي الخلية والتركيب الضوئي'],['gs-svt-glossary-title','المعجم العلمي']]}
        ];
        return `<section class="gs-level-paths" aria-labelledby="gs-level-paths-title">
          <div class="gs-level-paths-heading"><div><span class="gs-eyebrow">LEARNING PATH · PARCOURS SVT</span>
            <h3 id="gs-level-paths-title">${fr?'Votre parcours de découverte':'مسارات الاستكشاف حسب المستوى'}</h3>
            <p>${fr?'Choisissez un niveau pour accéder directement aux activités de découverte.':'اختر مستواك للوصول مباشرة إلى أنشطة الاستكشاف المناسبة.'}</p></div><span aria-hidden="true">🧭</span></div>
          <div class="gs-level-paths-grid">${paths.map(path=>`<article class="gs-level-path-card ${current===path.id?'is-current':''}" data-path-level="${path.id}">
            <div class="gs-level-path-top"><span>${path.id}</span>${current===path.id?`<small>${fr?'Votre niveau':'مستواك الدراسي'}</small>`:''}</div>
            <h4>${path.title}</h4><p>${path.desc}</p>
            <div class="gs-level-path-links">${path.steps.map(step=>`<button type="button" data-study-anchor="${step[0]}"><span>↗</span>${step[1]}</button>`).join('')}</div>
          </article>`).join('')}</div>
          <p class="gs-level-paths-note">${fr?'Parcours de découverte complémentaires : consultez aussi les cours, exercices et examens officiels de votre niveau.':'هذه مسارات استكشاف مساعدة؛ احرص أيضاً على مراجعة الدروس والتمارين والامتحانات الخاصة بمستواك.'} <a href="#cours">${fr?'Ouvrir la bibliothèque de cours':'فتح مكتبة الدروس'} ↗</a></p>
          ${track?`<span class="gs-level-path-track">${fr?'Filière de votre profil : ':'مسلك ملفك الدراسي: '}${escapeHtml(track)}</span>`:''}
        </section>`;
    }

    function renderHumanSystemsAtlas() {
        const fr = lang() === 'fr';
        const data = fr ? {
          digestive:['Système digestif','Transforme les aliments en nutriments absorbables.','Bouche → œsophage → estomac → intestin grêle → gros intestin.','Les nutriments traversent la paroi de l’intestin grêle et rejoignent le sang.'],
          respiratory:['Système respiratoire','Assure les échanges gazeux entre l’air et le sang.','Fosses nasales → trachée → bronches → bronchioles → alvéoles.','Au niveau des alvéoles, le dioxygène diffuse vers le sang et le CO₂ en sort.'],
          circulatory:['Système circulatoire','Transporte les gaz, nutriments et autres substances dans l’organisme.','Cœur + artères + capillaires + veines.','Le cœur propulse le sang dans deux circuits complémentaires : pulmonaire et général.'],
          nervous:['Système nerveux','Reçoit, traite et transmet les messages nerveux.','Encéphale + moelle épinière + nerfs.','Les organes sensoriels détectent les stimuli ; les centres nerveux élaborent des réponses.']
        } : {
          digestive:['الجهاز الهضمي','يحول الأغذية إلى مغذيات قابلة للامتصاص.','الفم ← المريء ← المعدة ← الأمعاء الدقيقة ← الأمعاء الغليظة.','تعبر المغذيات جدار الأمعاء الدقيقة لتصل إلى الدم.'],
          respiratory:['الجهاز التنفسي','يضمن التبادلات الغازية بين الهواء والدم.','التجاويف الأنفية ← القصبة الهوائية ← الشعب ← القصيبات ← الأسناخ الرئوية.','على مستوى الأسناخ ينتشر الأكسجين نحو الدم ويغادره ثاني أكسيد الكربون.'],
          circulatory:['الجهاز الدوري','ينقل الغازات والمغذيات ومواد أخرى داخل الجسم.','القلب + الشرايين + الشعيرات الدموية + الأوردة.','يدفع القلب الدم عبر دورتين متكاملتين: الدورة الرئوية والدورة العامة.'],
          nervous:['الجهاز العصبي','يستقبل الرسائل العصبية ويعالجها وينقلها.','الدماغ + النخاع الشوكي + الأعصاب.','تلتقط الأعضاء الحسية المنبهات، وتعالج المراكز العصبية المعلومات وتعد الاستجابات.']
        };
        const names = fr ? ['Digestif','Respiratoire','Circulatoire','Nerveux','Urinaire','Squelettique'] : ['الهضمي','التنفسي','الدوري','العصبي','البولي','الهيكلي'];
        const icons = ['🥗','🫁','❤️','🧠','🫘','🦴'];
        const keys = ['digestive','respiratory','circulatory','nervous','urinary','skeletal'];
        const initial = data.digestive;
        const photoTopics = fr ? [
          ['digestive','Système digestif','Organes digestifs humains · photographie anatomique','human digestive system anatomy specimen','🥗'],
          ['respiratory','Système respiratoire','Poumons et voies respiratoires · photographie anatomique','human lungs respiratory system anatomy specimen','🫁'],
          ['circulatory','Système circulatoire','Cœur et vaisseaux sanguins · photographie anatomique','human heart cardiovascular anatomy specimen','❤️'],
          ['nervous','Système nerveux','Encéphale et moelle épinière · photographie anatomique','human brain spinal cord anatomy specimen','🧠'],
          ['urinary','Système urinaire','Reins et voies urinaires · photographie anatomique','human kidneys urinary system anatomy specimen','🫘'],
          ['skeletal','Système squelettique','Os et articulations · photographie anatomique','human skeleton bones anatomy specimen','🦴']
        ] : [
          ['digestive','الجهاز الهضمي','أعضاء الجهاز الهضمي البشري · صورة تشريحية حقيقية','human digestive system anatomy specimen','🥗'],
          ['respiratory','الجهاز التنفسي','الرئتان والمسالك التنفسية · صورة تشريحية حقيقية','human lungs respiratory system anatomy specimen','🫁'],
          ['circulatory','الجهاز الدوري','القلب والأوعية الدموية · صورة تشريحية حقيقية','human heart cardiovascular anatomy specimen','❤️'],
          ['nervous','الجهاز العصبي','الدماغ والنخاع الشوكي · صورة تشريحية حقيقية','human brain spinal cord anatomy specimen','🧠'],
          ['urinary','الجهاز البولي','الكليتان والمسالك البولية · صورة تشريحية حقيقية','human kidneys urinary system anatomy specimen','🫘'],
          ['skeletal','الجهاز الهيكلي','العظام والمفاصل · صورة تشريحية حقيقية','human skeleton bones anatomy specimen','🦴']
        ];
        return `<section class="gs-anatomy-atlas" aria-labelledby="gs-anatomy-title">
          <div class="gs-anatomy-heading"><div><span class="gs-eyebrow">GO SVT MAROC · SCIENCE ATLAS</span>
            <h3 id="gs-anatomy-title">${fr?'Atlas interactif du corps humain':'الأطلس التفاعلي لجسم الإنسان'}</h3>
            <p>${fr?'Choisissez un système : explorez des photographies anatomiques réelles, avec leurs sources et licences.':'اختر جهازاً لاستكشاف صور تشريحية حقيقية موثقة المصدر والترخيص.'}</p></div><span class="gs-anatomy-mark" aria-hidden="true">📷</span></div>
          <div class="gs-anatomy-photo-gallery" aria-label="${fr?'Photographies anatomiques réelles':'صور تشريحية حقيقية'}">
            ${photoTopics.map((topic,i)=>`<a class="gs-anatomy-photo-card ${i===0?'is-active':''}" data-anatomy-photo="${topic[0]}" data-science-search="${topic[3]}" href="https://commons.wikimedia.org/wiki/Special:MediaSearch?type=image&search=${encodeURIComponent(topic[3])}" target="_blank" rel="noopener noreferrer"
              <span class="gs-science-media-photo"><span>${topic[4]}</span><small>${fr?'Chargement de la photo…':'جارٍ تحميل الصورة الحقيقية…'}</small></span>
              <span class="gs-anatomy-photo-copy"><strong>${topic[1]}</strong><small>${topic[2]}</small><small class="gs-science-media-credit">${fr?'Source et licence en cours de chargement':'جارٍ تحميل المصدر والترخيص'}</small></span>
            </a>`).join('')}
          </div>
          <div class="gs-anatomy-tabs" role="group" aria-label="${fr?'Systèmes du corps':'أجهزة الجسم'}">
            ${keys.map((key,i)=>`<button type="button" class="gs-anatomy-tab ${i===0?'is-active':''}" data-anatomy-system="${key}" aria-pressed="${i===0?'true':'false'}"><span>${icons[i]}</span><b>${names[i]}</b></button>`).join('')}
          </div>
          <div class="gs-anatomy-detail" aria-live="polite">
            <h4 class="gs-anatomy-name">${initial[0]}</h4><p class="gs-anatomy-function">${initial[1]}</p>
            <div class="gs-anatomy-info"><span>🔎 ${fr?'Principaux organes':'أهم المكونات'}</span><p class="gs-anatomy-organs">${initial[2]}</p></div>
            <div class="gs-anatomy-info"><span>💡 ${fr?'À retenir':'معلومة أساسية'}</span><p class="gs-anatomy-fact">${initial[3]}</p></div>
          </div>
          <p class="gs-anatomy-note">${fr?'Photographies pédagogiques, non destinées au diagnostic médical.':'صور تعليمية حقيقية، وليست مرجعاً للتشخيص الطبي.'}</p>
        
          <section class="gs-atlas-quiz" aria-labelledby="gs-atlas-quiz-title">
            <div class="gs-atlas-quiz-heading"><div><span class="gs-eyebrow">QUICK CHECK · AUTOÉVALUATION</span>
              <h4 id="gs-atlas-quiz-title">${fr?'Testez vos connaissances':'اختبر معلوماتك'}</h4>
              <p>${fr?'Six questions courtes pour vérifier votre compréhension.':'ستة أسئلة قصيرة للتحقق من فهمك.'}</p></div><span aria-hidden="true">🎯</span></div>
            <div class="gs-atlas-quiz-content" aria-live="polite"></div>
          </section>
</section>`;
    }

    function renderCellPhotosynthesisQuiz() {
        const fr=lang()==='fr';
        return `<section class="gs-svt-revision" aria-labelledby="gs-svt-revision-title">
          <div class="gs-svt-revision-heading"><div><span class="gs-eyebrow">GO SVT MAROC · SMART REVISION</span>
            <h3 id="gs-svt-revision-title">${fr?'Défi : cellule et photosynthèse':'تحدي الخلية والتركيب الضوئي'}</h3>
            <p>${fr?'Cinq questions pour consolider les notions essentielles.':'خمسة أسئلة لترسيخ المفاهيم الأساسية.'}</p></div><span aria-hidden="true">🧠</span></div>
          <div class="gs-svt-revision-content" aria-live="polite"></div>
        </section>`;
    }

    function renderPhotosynthesisExperiment() {
        const fr = lang() === 'fr';
        return `<section class="gs-photosynthesis-experiment" aria-labelledby="gs-experiment-title">
          <div class="gs-experiment-heading"><div><span class="gs-eyebrow">GO SVT MAROC · VIRTUAL EXPERIMENT</span>
            <h3 id="gs-experiment-title">${fr?'Expérience virtuelle : facteurs de la photosynthèse':'تجربة افتراضية: عوامل التركيب الضوئي'}</h3>
            <p>${fr?'Modifiez les conditions et observez quel facteur limite la vitesse relative de photosynthèse.':'غيّر الظروف ولاحظ العامل الذي يحد من الوتيرة النسبية للتركيب الضوئي.'}</p></div><span aria-hidden="true">🧪</span></div>
          <div class="gs-experiment-grid">
            <div class="gs-experiment-controls">
              <label class="gs-experiment-control"><span><b>${fr?'Intensité lumineuse':'شدة الإضاءة'}</b><output data-experiment-value="light">70%</output></span><input type="range" min="0" max="100" step="5" value="70" data-experiment-input="light"><small>${fr?'Énergie lumineuse disponible':'الطاقة الضوئية المتاحة'}</small></label>
              <label class="gs-experiment-control"><span><b>${fr?'CO₂ disponible':'تركيز CO₂ المتاح'}</b><output data-experiment-value="co2">65%</output></span><input type="range" min="0" max="100" step="5" value="65" data-experiment-input="co2"><small>${fr?'Disponibilité du dioxyde de carbone':'مدى توفر ثاني أكسيد الكربون'}</small></label>
              <label class="gs-experiment-control"><span><b>${fr?'Température':'درجة الحرارة'}</b><output data-experiment-value="temperature">25°C</output></span><input type="range" min="5" max="45" step="1" value="25" data-experiment-input="temperature"><small>${fr?'Température du milieu':'درجة حرارة الوسط'}</small></label>
              <button type="button" class="gs-experiment-reset">${fr?'Réinitialiser les conditions':'إعادة ضبط الظروف'}</button>
            </div>
            <div class="gs-experiment-result" aria-live="polite">
              <div class="gs-experiment-result-top"><span>${fr?'Vitesse relative simulée':'الوتيرة النسبية المحاكاة'}</span><strong data-experiment-rate>65%</strong></div>
              <div class="gs-experiment-meter"><span data-experiment-meter style="width:65%"></span></div>
              <div class="gs-experiment-gauges"><div><span>${fr?'Lumière':'الضوء'}</span><b data-experiment-gauge="light">70%</b></div><div><span>CO₂</span><b data-experiment-gauge="co2">65%</b></div><div><span>${fr?'Capacité thermique':'ملاءمة الحرارة'}</span><b data-experiment-gauge="temperature">100%</b></div></div>
              <div class="gs-experiment-limiter"><strong>${fr?'Facteur limitant':'العامل المحدِّد'}</strong><p data-experiment-limiter>${fr?'CO₂ disponible':'توفر CO₂'}</p></div>
              <p class="gs-experiment-explain" data-experiment-explain>${fr?'Dans ce modèle, le CO₂ est le facteur le moins disponible et limite la vitesse relative.':'في هذا النموذج، يعد توفر CO₂ العامل الأقل، ولذلك يحد من الوتيرة النسبية.'}</p>
            </div>
          </div>
          <p class="gs-experiment-note">${fr?'Modèle pédagogique simplifié : les valeurs sont relatives et illustratives, pas des mesures expérimentales. Les autres facteurs sont supposés constants.':'نموذج تعليمي مبسط: القيم نسبية وتوضيحية وليست قياسات تجريبية. نفترض ثبات العوامل الأخرى.'}</p>
        </section>`;
    }

    function renderMicroscopeLab() {
        const fr = lang() === 'fr';
        const slides = fr ? [
            {id:'onion',name:'Épiderme d’oignon',kind:'Cellules végétales',detail:'Observez des cellules jointives, de forme polygonale, limitées par une paroi cellulaire. La préparation peut être colorée pour mieux distinguer les structures.',observe:'Paroi cellulaire · organisation en mosaïque',svg:'<svg viewBox="0 0 520 300" role="img" aria-label="Schéma de cellules épidermiques végétales"><g fill="#f3d9ee" stroke="#9a6d9a" stroke-width="4"><path d="M20 18L145 12 152 95 18 103Z"/><path d="M155 12L280 20 276 104 152 95Z"/><path d="M290 18L500 12 502 105 276 104Z"/><path d="M18 112L152 105 160 205 18 211Z"/><path d="M160 105L276 112 280 210 160 205Z"/><path d="M285 112L502 112 500 210 280 210Z"/><path d="M18 220L160 215 155 290 18 288Z"/><path d="M165 215L280 220 278 290 155 290Z"/><path d="M285 220L500 218 502 290 278 290Z"/></g><g fill="#9165a0"><ellipse cx="85" cy="59" rx="12" ry="8"/><ellipse cx="216" cy="58" rx="12" ry="8"/><ellipse cx="395" cy="58" rx="12" ry="8"/><ellipse cx="85" cy="160" rx="12" ry="8"/><ellipse cx="218" cy="160" rx="12" ry="8"/><ellipse cx="394" cy="160" rx="12" ry="8"/><ellipse cx="85" cy="255" rx="12" ry="8"/><ellipse cx="215" cy="255" rx="12" ry="8"/><ellipse cx="394" cy="255" rx="12" ry="8"/></g></svg>'},
            {id:'stomata',name:'Stomates foliaires',kind:'Épiderme de feuille',detail:'Deux cellules de garde entourent un ostiole. Cette ouverture participe aux échanges gazeux et à la transpiration de la plante.',observe:'Cellules de garde · ostiole · échanges gazeux',svg:'<svg viewBox="0 0 520 300" role="img" aria-label="Schéma de stomates"><g fill="#b6d99b" stroke="#568b50" stroke-width="5"><path d="M125 55C40 80 65 220 175 245Q235 150 175 65Z"/><path d="M395 55C480 80 455 220 345 245Q285 150 345 65Z"/></g><ellipse cx="260" cy="150" rx="35" ry="85" fill="#eaf6df" stroke="#578c53" stroke-width="4"/><g fill="#548c54"><circle cx="145" cy="110" r="8"/><circle cx="155" cy="180" r="8"/><circle cx="375" cy="110" r="8"/><circle cx="365" cy="180" r="8"/></g><path d="M260 40V10M260 260V290" stroke="#398cbd" stroke-width="5" stroke-dasharray="8 7"/></svg>'},
            {id:'blood',name:'Frottis sanguin',kind:'Cellules sanguines',detail:'Un frottis permet de distinguer de nombreux globules rouges et, plus rarement, des globules blancs. Les plaquettes sont de petits fragments cellulaires.',observe:'Globules rouges · globules blancs · plaquettes',svg:'<svg viewBox="0 0 520 300" role="img" aria-label="Schéma de cellules sanguines"><g fill="#d96868" stroke="#a83f48" stroke-width="3"><ellipse cx="65" cy="70" rx="34" ry="22"/><ellipse cx="165" cy="55" rx="34" ry="22"/><ellipse cx="285" cy="72" rx="34" ry="22"/><ellipse cx="425" cy="60" rx="34" ry="22"/><ellipse cx="110" cy="170" rx="34" ry="22"/><ellipse cx="365" cy="180" rx="34" ry="22"/><ellipse cx="470" cy="245" rx="34" ry="22"/></g><g fill="#f4b0a7"><ellipse cx="65" cy="70" rx="14" ry="8"/><ellipse cx="165" cy="55" rx="14" ry="8"/><ellipse cx="285" cy="72" rx="14" ry="8"/><ellipse cx="425" cy="60" rx="14" ry="8"/><ellipse cx="110" cy="170" rx="14" ry="8"/><ellipse cx="365" cy="180" rx="14" ry="8"/><ellipse cx="470" cy="245" rx="14" ry="8"/></g><circle cx="245" cy="190" r="48" fill="#eee5f8" stroke="#76569b" stroke-width="5"/><path d="M222 185Q230 150 250 168Q280 190 258 215Q230 230 222 185Z" fill="#76569b"/><g fill="#8d79bd"><circle cx="300" cy="245" r="7"/><circle cx="40" cy="245" r="6"/><circle cx="205" cy="270" r="6"/></g></svg>'},
            {id:'leaf',name:'Cellules chlorophylliennes',kind:'Tissu végétal',detail:'Les cellules chlorophylliennes contiennent des chloroplastes. Ceux-ci captent l’énergie lumineuse utilisée lors de la photosynthèse.',observe:'Cellules végétales · chloroplastes · parois',svg:'<svg viewBox="0 0 520 300" role="img" aria-label="Schéma de cellules végétales chlorophylliennes"><g fill="#e8f1d6" stroke="#779c61" stroke-width="5"><rect x="15" y="18" width="155" height="120" rx="22"/><rect x="180" y="18" width="155" height="120" rx="22"/><rect x="345" y="18" width="160" height="120" rx="22"/><rect x="15" y="158" width="155" height="125" rx="22"/><rect x="180" y="158" width="155" height="125" rx="22"/><rect x="345" y="158" width="160" height="125" rx="22"/></g><g fill="#4e9c56" stroke="#2e7140" stroke-width="2"><ellipse cx="45" cy="48" rx="13" ry="7"/><ellipse cx="130" cy="105" rx="13" ry="7"/><ellipse cx="210" cy="50" rx="13" ry="7"/><ellipse cx="300" cy="105" rx="13" ry="7"/><ellipse cx="375" cy="48" rx="13" ry="7"/><ellipse cx="470" cy="105" rx="13" ry="7"/><ellipse cx="45" cy="190" rx="13" ry="7"/><ellipse cx="130" cy="250" rx="13" ry="7"/><ellipse cx="210" cy="190" rx="13" ry="7"/><ellipse cx="300" cy="250" rx="13" ry="7"/><ellipse cx="375" cy="190" rx="13" ry="7"/><ellipse cx="470" cy="250" rx="13" ry="7"/></g><g fill="#a68ad0"><circle cx="90" cy="78" r="9"/><circle cx="255" cy="78" r="9"/><circle cx="430" cy="78" r="9"/><circle cx="90" cy="220" r="9"/><circle cx="255" cy="220" r="9"/><circle cx="430" cy="220" r="9"/></g></svg>'}
        ] : [
            {id:'onion',name:'بشرة البصل',kind:'خلايا نباتية',detail:'لاحظ خلايا متراصة ذات أشكال متعددة الأضلاع، تحدها جدران خلوية واضحة. يمكن تلوين التحضير لتسهيل رؤية بعض البنيات.',observe:'الجدار الخلوي · تنظيم الخلايا كفسيفساء',svg:'<svg viewBox="0 0 520 300" role="img" aria-label="رسم خلايا بشرة البصل"><g fill="#f3d9ee" stroke="#9a6d9a" stroke-width="4"><path d="M20 18L145 12 152 95 18 103Z"/><path d="M155 12L280 20 276 104 152 95Z"/><path d="M290 18L500 12 502 105 276 104Z"/><path d="M18 112L152 105 160 205 18 211Z"/><path d="M160 105L276 112 280 210 160 205Z"/><path d="M285 112L502 112 500 210 280 210Z"/><path d="M18 220L160 215 155 290 18 288Z"/><path d="M165 215L280 220 278 290 155 290Z"/><path d="M285 220L500 218 502 290 278 290Z"/></g><g fill="#9165a0"><ellipse cx="85" cy="59" rx="12" ry="8"/><ellipse cx="216" cy="58" rx="12" ry="8"/><ellipse cx="395" cy="58" rx="12" ry="8"/><ellipse cx="85" cy="160" rx="12" ry="8"/><ellipse cx="218" cy="160" rx="12" ry="8"/><ellipse cx="394" cy="160" rx="12" ry="8"/><ellipse cx="85" cy="255" rx="12" ry="8"/><ellipse cx="215" cy="255" rx="12" ry="8"/><ellipse cx="394" cy="255" rx="12" ry="8"/></g></svg>'},
            {id:'stomata',name:'ثغور الورقة',kind:'بشرة ورقية',detail:'تحيط خليتان حارستان بفتحة ثغرية. تساهم هذه الفتحة في التبادلات الغازية وفي ظاهرة النتح لدى النبات.',observe:'الخلايا الحارسة · الفتحة الثغرية · التبادلات الغازية',svg:'<svg viewBox="0 0 520 300" role="img" aria-label="رسم الثغور الورقية"><g fill="#b6d99b" stroke="#568b50" stroke-width="5"><path d="M125 55C40 80 65 220 175 245Q235 150 175 65Z"/><path d="M395 55C480 80 455 220 345 245Q285 150 345 65Z"/></g><ellipse cx="260" cy="150" rx="35" ry="85" fill="#eaf6df" stroke="#578c53" stroke-width="4"/><g fill="#548c54"><circle cx="145" cy="110" r="8"/><circle cx="155" cy="180" r="8"/><circle cx="375" cy="110" r="8"/><circle cx="365" cy="180" r="8"/></g><path d="M260 40V10M260 260V290" stroke="#398cbd" stroke-width="5" stroke-dasharray="8 7"/></svg>'},
            {id:'blood',name:'لطاخة دموية',kind:'خلايا الدم',detail:'تسمح اللطاخة بتمييز عدد كبير من الكريات الحمراء، وعدد أقل من الكريات البيضاء. كما تظهر الصفائح الدموية على شكل أجزاء خلوية صغيرة.',observe:'كريات حمراء · كريات بيضاء · صفائح دموية',svg:'<svg viewBox="0 0 520 300" role="img" aria-label="رسم خلايا الدم"><g fill="#d96868" stroke="#a83f48" stroke-width="3"><ellipse cx="65" cy="70" rx="34" ry="22"/><ellipse cx="165" cy="55" rx="34" ry="22"/><ellipse cx="285" cy="72" rx="34" ry="22"/><ellipse cx="425" cy="60" rx="34" ry="22"/><ellipse cx="110" cy="170" rx="34" ry="22"/><ellipse cx="365" cy="180" rx="34" ry="22"/><ellipse cx="470" cy="245" rx="34" ry="22"/></g><g fill="#f4b0a7"><ellipse cx="65" cy="70" rx="14" ry="8"/><ellipse cx="165" cy="55" rx="14" ry="8"/><ellipse cx="285" cy="72" rx="14" ry="8"/><ellipse cx="425" cy="60" rx="14" ry="8"/><ellipse cx="110" cy="170" rx="14" ry="8"/><ellipse cx="365" cy="180" rx="14" ry="8"/><ellipse cx="470" cy="245" rx="14" ry="8"/></g><circle cx="245" cy="190" r="48" fill="#eee5f8" stroke="#76569b" stroke-width="5"/><path d="M222 185Q230 150 250 168Q280 190 258 215Q230 230 222 185Z" fill="#76569b"/><g fill="#8d79bd"><circle cx="300" cy="245" r="7"/><circle cx="40" cy="245" r="6"/><circle cx="205" cy="270" r="6"/></g></svg>'},
            {id:'leaf',name:'خلايا يخضورية',kind:'نسيج نباتي',detail:'تحتوي الخلايا اليخضورية على بلاستيدات خضراء تلتقط الطاقة الضوئية المستعملة في عملية التركيب الضوئي.',observe:'خلايا نباتية · بلاستيدات خضراء · جدران خلوية',svg:'<svg viewBox="0 0 520 300" role="img" aria-label="رسم خلايا يخضورية"><g fill="#e8f1d6" stroke="#779c61" stroke-width="5"><rect x="15" y="18" width="155" height="120" rx="22"/><rect x="180" y="18" width="155" height="120" rx="22"/><rect x="345" y="18" width="160" height="120" rx="22"/><rect x="15" y="158" width="155" height="125" rx="22"/><rect x="180" y="158" width="155" height="125" rx="22"/><rect x="345" y="158" width="160" height="125" rx="22"/></g><g fill="#4e9c56" stroke="#2e7140" stroke-width="2"><ellipse cx="45" cy="48" rx="13" ry="7"/><ellipse cx="130" cy="105" rx="13" ry="7"/><ellipse cx="210" cy="50" rx="13" ry="7"/><ellipse cx="300" cy="105" rx="13" ry="7"/><ellipse cx="375" cy="48" rx="13" ry="7"/><ellipse cx="470" cy="105" rx="13" ry="7"/><ellipse cx="45" cy="190" rx="13" ry="7"/><ellipse cx="130" cy="250" rx="13" ry="7"/><ellipse cx="210" cy="190" rx="13" ry="7"/><ellipse cx="300" cy="250" rx="13" ry="7"/><ellipse cx="375" cy="190" rx="13" ry="7"/><ellipse cx="470" cy="250" rx="13" ry="7"/></g><g fill="#a68ad0"><circle cx="90" cy="78" r="9"/><circle cx="255" cy="78" r="9"/><circle cx="430" cy="78" r="9"/><circle cx="90" cy="220" r="9"/><circle cx="255" cy="220" r="9"/><circle cx="430" cy="220" r="9"/></g></svg>'}
        ];
        const first = slides[0];
        return `<section class="gs-microscope-lab" data-active-slide="onion" aria-labelledby="gs-microscope-title">
          <div class="gs-micro-heading"><div><span class="gs-eyebrow">GO SVT MAROC · VIRTUAL MICROSCOPE</span>
            <h3 id="gs-microscope-title">${fr?'Laboratoire du microscope':'مختبر المجهر الافتراضي'}</h3>
            <p>${fr?'Choisissez une préparation : la microphotographie réelle est affichée en priorité, avec un schéma pédagogique de secours.':'اختر تحضيراً مجهرياً: ستظهر الصورة المجهرية الحقيقية أولاً، مع الاحتفاظ بالرسم التوضيحي كبديل تعليمي.'}</p></div><span aria-hidden="true">🔬</span></div>
          <div class="gs-micro-layout">
            <div class="gs-micro-view"><div class="gs-micro-viewbar"><strong class="gs-micro-view-title">${first.name}</strong><div><button type="button" data-micro-zoom="out" aria-label="${fr?'Diminuer le zoom':'تصغير'}">−</button><span class="gs-micro-zoom-value">100%</span><button type="button" data-micro-zoom="in" aria-label="${fr?'Augmenter le zoom':'تكبير'}">+</button></div></div>
              <div class="gs-micro-canvas"><div class="gs-micro-art">${first.svg}</div><span class="gs-micro-overlay">${fr?'Chargement de la microphotographie réelle…':'جارٍ تحميل الصورة المجهرية الحقيقية…'}</span></div>
              <div class="gs-micro-viewfoot"><span class="gs-micro-kind">${first.kind}</span><button type="button" class="gs-micro-label-toggle" aria-pressed="false">${fr?'Afficher les repères':'إظهار البيانات'}</button></div>
              <div class="gs-micro-real-sources" aria-label="${fr?'Microphotographies réelles':'صور مجهرية حقيقية'}">
                <a class="gs-micro-source-card" data-micro-source="onion" data-science-search="onion epidermis cells light microscopy" href="https://commons.wikimedia.org/wiki/Special:MediaSearch?type=image&search=onion%20epidermis%20cells%20light%20microscopy" target="_blank" rel="noopener noreferrer"><span class="gs-science-media-photo"><span>🧅</span><small>${fr?'Chargement…':'جارٍ التحميل…'}</small></span><span><strong>${fr?'Microphotographie réelle':'صورة مجهرية حقيقية'}</strong><small class="gs-science-media-credit">${fr?'Source et licence en cours de chargement':'جارٍ تحميل المصدر والترخيص'}</small></span></a>
                <a class="gs-micro-source-card" data-micro-source="stomata" data-science-search="leaf stomata light microscope" href="https://commons.wikimedia.org/wiki/Special:MediaSearch?type=image&search=leaf%20stomata%20light%20microscope" target="_blank" rel="noopener noreferrer"><span class="gs-science-media-photo"><span>🍃</span><small>${fr?'Chargement…':'جارٍ التحميل…'}</small></span><span><strong>${fr?'Microphotographie réelle':'صورة مجهرية حقيقية'}</strong><small class="gs-science-media-credit">${fr?'Source et licence en cours de chargement':'جارٍ تحميل المصدر والترخيص'}</small></span></a>
                <a class="gs-micro-source-card" data-micro-source="blood" data-science-search="human blood smear microscope red white blood cells" href="https://commons.wikimedia.org/wiki/Special:MediaSearch?type=image&search=human%20blood%20smear%20microscope" target="_blank" rel="noopener noreferrer"><span class="gs-science-media-photo"><span>🩸</span><small>${fr?'Chargement…':'جارٍ التحميل…'}</small></span><span><strong>${fr?'Microphotographie réelle':'صورة مجهرية حقيقية'}</strong><small class="gs-science-media-credit">${fr?'Source et licence en cours de chargement':'جارٍ تحميل المصدر والترخيص'}</small></span></a>
                <a class="gs-micro-source-card" data-micro-source="leaf" data-science-search="leaf mesophyll chloroplast microscope" href="https://commons.wikimedia.org/wiki/Special:MediaSearch?type=image&search=leaf%20mesophyll%20chloroplast%20microscope" target="_blank" rel="noopener noreferrer"><span class="gs-science-media-photo"><span>🌿</span><small>${fr?'Chargement…':'جارٍ التحميل…'}</small></span><span><strong>${fr?'Microphotographie réelle':'صورة مجهرية حقيقية'}</strong><small class="gs-science-media-credit">${fr?'Source et licence en cours de chargement':'جارٍ تحميل المصدر والترخيص'}</small></span></a>
              </div>
            </div>
            <div class="gs-micro-side"><h4>${fr?'Préparations':'التحضيرات'}</h4>
              <div class="gs-micro-slides">${slides.map((slide,i)=>`<button type="button" class="gs-micro-slide ${i===0?'is-active':''}" data-micro-slide="${slide.id}" aria-pressed="${i===0?'true':'false'}"><span>0${i+1}</span><b>${slide.name}</b><small>${slide.kind}</small></button>`).join('')}</div>
              <div class="gs-micro-observation"><strong>${fr?'À observer':'ماذا تلاحظ؟'}</strong><p class="gs-micro-observe-text">${first.observe}</p><p class="gs-micro-detail-text">${first.detail}</p></div>
            </div>
          </div>
          <p class="gs-micro-disclaimer">${fr?'Les microphotographies réelles sont prioritaires. Le schéma pédagogique reste disponible si une image ne peut pas être chargée ; les crédits et licences sont affichés sous chaque source.':'تعرض الصور المجهرية الحقيقية بشكل أساسي. ويظل الرسم التوضيحي متاحاً إذا تعذر تحميل صورة؛ كما تظهر بيانات المصدر والترخيص أسفل كل صورة.'}</p>
        </section>`;
    }

    function renderScientificMediaLibrary() {
        const fr=lang()==='fr';
        const topics=fr?[
          ['Microscopie végétale','Cellules végétales, chloroplastes et tissus observés au microscope','plant cell microscopy chloroplast'],
          ['Stomates et feuilles','Photographies et micrographies des stomates et de l’épiderme foliaire','leaf stomata scanning electron microscopy'],
          ['Sang et cellules','Globules rouges, globules blancs et frottis sanguins','human blood cells microscopy'],
          ['Cœur et circulation','Photographies anatomiques et ressources visuelles sur le cœur','human heart anatomy specimen'],
          ['Poumons et alvéoles','Images histologiques et micrographies des alvéoles pulmonaires','lung alveoli histology microscopy'],
          ['Fossiles et biodiversité','Fossiles, organismes et traces de l’histoire de la vie','fossils biodiversity paleontology']
        ]:[
          ['مجهر الخلية النباتية','صور مجهرية للخلايا النباتية والبلاستيدات والأنسجة','plant cell microscopy chloroplast'],
          ['الثغور والأوراق','صور ومجاهر إلكترونية للثغور وبشرة الورقة','leaf stomata scanning electron microscopy'],
          ['الدم والخلايا','صور كريات الدم الحمراء والبيضاء واللطاخات الدموية','human blood cells microscopy'],
          ['القلب والدورة الدموية','صور تشريحية وموارد بصرية حول القلب','human heart anatomy specimen'],
          ['الرئتان والأسناخ','صور نسيجية ومجهرية للأسناخ الرئوية','lung alveoli histology microscopy'],
          ['المستحاثات والتنوع الحيوي','مستحاثات وكائنات وآثار تاريخ الحياة','fossils biodiversity paleontology']
        ];
        const icons=['🔬','🍃','🩸','❤️','🫁','🦴'];
        return `<section class="gs-science-media" aria-labelledby="gs-science-media-title">
          <div class="gs-science-media-heading"><div><span class="gs-eyebrow">OPEN SCIENCE · MEDIA COLLECTION</span>
            <h3 id="gs-science-media-title">${fr?'Photographies scientifiques avec crédits':'صور علمية حقيقية مع توثيق مصادرها'}</h3>
            <p>${fr?'Images chargées depuis Wikimedia Commons avec auteur, licence et lien vers la fiche originale.':'صور تُحمّل مباشرة من ويكيميديا كومنز مع إظهار صاحب الصورة وترخيصها ورابط الملف الأصلي.'}</p></div><span class="gs-science-media-mark" aria-hidden="true">📷</span></div>
          <div class="gs-science-media-grid">${topics.map((topic,i)=>`<a class="gs-science-media-card" data-science-search="${escapeHtml(topic[2])}" href="https://commons.wikimedia.org/wiki/Special:MediaSearch?type=image&search=${encodeURIComponent(topic[2])}" target="_blank" rel="noopener noreferrer"><span class="gs-science-media-photo" aria-hidden="true"><span>${icons[i]}</span><small>${fr?'Chargement…':'جارٍ تحميل الصورة…'}</small></span><span class="gs-science-media-copy"><strong>${topic[0]}</strong><small>${topic[1]}</small><em>${fr?'Explorer la collection':'استكشاف المجموعة'} <span aria-hidden="true">↗</span></em><small class="gs-science-media-credit">${fr?'Source et licence affichées après chargement':'سيظهر المصدر والترخيص بعد التحميل'}</small></span></a>`).join('')}</div>
          <p class="gs-science-media-license">${fr?'Les métadonnées de licence proviennent de la fiche Wikimedia Commons de chaque fichier. Respectez les conditions indiquées avant toute réutilisation.':'تُستخرج بيانات الترخيص من صفحة كل ملف على ويكيميديا كومنز. يجب احترام شروط الترخيص قبل إعادة استخدام أي صورة.'}</p>
        </section>`;
    }

    async function loadScientificMediaImages(root) {
        const cards = root.querySelectorAll('.gs-science-media-card[data-science-search], .gs-micro-source-card[data-science-search], .gs-anatomy-photo-card[data-science-search]');
        const fr = lang() === 'fr';
        await Promise.all(Array.from(cards).map(async function(card) {
            const query = card.getAttribute('data-science-search') || '';
            const photo = card.querySelector('.gs-science-media-photo');
            const credit = card.querySelector('.gs-science-media-credit');
            if (!photo || !query) return;
            try {
                const params = new URLSearchParams({
                    action: 'query', format: 'json', origin: '*',
                    generator: 'search', gsrnamespace: '6',
                    gsrsearch: query + ' filetype:bitmap', gsrlimit: '1',
                    prop: 'imageinfo', iiprop: 'url|extmetadata', iiurlwidth: '640'
                });
                const response = await fetch('https://commons.wikimedia.org/w/api.php?' + params.toString(), {
                    headers: { Accept: 'application/json' }
                });
                if (!response.ok) throw new Error('Wikimedia request failed');
                const payload = await response.json();
                const page = payload && payload.query && payload.query.pages
                    ? Object.values(payload.query.pages)[0] : null;
                const info = page && Array.isArray(page.imageinfo) ? page.imageinfo[0] : null;
                if (!info || !info.thumburl || !info.descriptionurl) throw new Error('No image result');
                const imageUrl = new URL(info.thumburl);
                const pageUrl = new URL(info.descriptionurl);
                if (imageUrl.hostname !== 'upload.wikimedia.org' || pageUrl.hostname !== 'commons.wikimedia.org') {
                    throw new Error('Unexpected Wikimedia URL');
                }
                const meta = info.extmetadata || {};
                const plain = function(value) {
                    const raw = value && (value.value || value);
                    return String(raw || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ')
                        .replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;/gi, "'")
                        .replace(/\s+/g, ' ').trim();
                };
                const license = plain(meta.LicenseShortName) || (fr ? 'Licence à vérifier' : 'يجب التحقق من الترخيص');
                const author = plain(meta.Artist) || plain(meta.Credit) || (fr ? 'Auteur non indiqué' : 'المؤلف غير محدد');
                const img = document.createElement('img');
                img.src = imageUrl.href;
                img.alt = page.title || (fr ? 'Photographie scientifique' : 'صورة علمية');
                img.loading = 'lazy';
                img.decoding = 'async';
                img.referrerPolicy = 'no-referrer';
                photo.replaceChildren(img);
                card.dataset.realImageUrl = imageUrl.href;
                card.dataset.sourcePageUrl = pageUrl.href;
                const microscope = card.closest('.gs-microscope-lab');
                if (microscope && microscope.dataset.activeSlide === card.dataset.microSource) {
                    const art = microscope.querySelector('.gs-micro-art');
                    const overlay = microscope.querySelector('.gs-micro-overlay');
                    if (art) {
                        const preview = img.cloneNode();
                        preview.style.width = '100%';
                        preview.style.height = '100%';
                        preview.style.objectFit = 'contain';
                        preview.style.display = 'block';
                        art.replaceChildren(preview);
                        art.classList.add('is-real-photo');
                    }
                    if (overlay) overlay.textContent = fr ? 'Microphotographie réelle' : 'صورة مجهرية حقيقية';
                }
                card.href = pageUrl.href;
                card.setAttribute('aria-label', (page.title || '') + ' — ' + license);
                if (credit) credit.textContent = (fr ? '© ' : '© ') + author + ' · ' + license;
            } catch (error) {
                if (credit) credit.textContent = fr
                    ? 'Aperçu indisponible · ouvrir la recherche Wikimedia'
                    : 'تعذر تحميل المعاينة · افتح بحث ويكيميديا';
                const note = photo.querySelector('small');
                if (note) note.textContent = fr ? 'Aperçu indisponible' : 'المعاينة غير متاحة حالياً';
            }
        }));
    }

    function renderScienceMemoryCards() {
        const fr=lang()==='fr';
        return `<section class="gs-memory-deck" aria-labelledby="gs-memory-title">
          <div class="gs-memory-heading"><div><span class="gs-eyebrow">SMART STUDY · FLASHCARDS</span>
            <h3 id="gs-memory-title">${fr?'Cartes mémoire SVT':'بطاقات الذاكرة في علوم الحياة والأرض'}</h3>
            <p>${fr?'Révisez les notions essentielles : réfléchissez, révélez, puis passez à la carte suivante.':'راجع المفاهيم الأساسية: فكر في الإجابة، اكشفها، ثم انتقل إلى البطاقة التالية.'}</p></div><span aria-hidden="true">🗂️</span></div>
          <div class="gs-memory-card" aria-live="polite">
            <div class="gs-memory-card-top"><span class="gs-memory-category"></span><span class="gs-memory-counter"></span></div>
            <div class="gs-memory-art" aria-hidden="true"><span class="gs-memory-art-icon"></span></div>
            <h4 class="gs-memory-question"></h4>
            <div class="gs-memory-answer" hidden></div>
            <div class="gs-memory-actions"><button type="button" class="gs-memory-reveal">${fr?'Révéler la réponse':'اكشف الإجابة'}</button><div><button type="button" class="gs-memory-prev" aria-label="${fr?'Carte précédente':'البطاقة السابقة'}">←</button><button type="button" class="gs-memory-next">${fr?'Suivante':'التالية'} →</button></div></div>
            <div class="gs-memory-progress" role="progressbar" aria-label="${fr?'Progression des cartes':'تقدم البطاقات'}" aria-valuemin="0" aria-valuemax="8" aria-valuenow="1"><span></span></div>
          </div>
          <p class="gs-memory-tip">${fr?'Astuce : essayez de répondre avant de révéler le verso.':'نصيحة: حاول الإجابة من ذاكرتك قبل كشف الوجه الآخر للبطاقة.'}</p>
        </section>`;
    }

    function renderSvtGlossary() {
        const fr=lang()==='fr';
        return `<section class="gs-svt-glossary" aria-labelledby="gs-svt-glossary-title">
          <div class="gs-svt-glossary-heading"><div><span class="gs-eyebrow">SVT · MINI DICTIONNAIRE</span>
            <h3 id="gs-svt-glossary-title">${fr?'Dictionnaire scientifique interactif':'المعجم العلمي التفاعلي'}</h3>
            <p>${fr?'Recherchez rapidement les termes scientifiques et leurs définitions.':'ابحث بسرعة عن المصطلحات العلمية ومعانيها.'}</p></div><span aria-hidden="true">📚</span></div>
          <label class="gs-svt-glossary-search"><span aria-hidden="true">⌕</span><input type="search" class="gs-svt-glossary-input" placeholder="${fr?'Rechercher un terme…':'ابحث عن مصطلح علمي…'}" autocomplete="off"><kbd>⌕</kbd></label>
          <div class="gs-svt-glossary-meta" aria-live="polite"></div>
          <div class="gs-svt-glossary-results"></div>
        </section>`;
    }

    function renderDashboard() {
        const stats = getDashboardStats();
        const profiles = getProfiles();
        const currentProfile = getCurrentProfile();
        
        let profilesOptions = '';
        Object.entries(profiles).forEach(([id, profile]) => {
            const isActive = id === currentProfileId;
            profilesOptions += `<option value="${escapeHtml(id)}" ${isActive ? 'selected' : ''}>${escapeHtml(profile.name)}</option>`;
        });

        const accountBar = window.StudentAccount && window.StudentAccount.isLoggedIn() ? window.StudentAccount.renderBar() : '';
        const academic = window.StudentAccount && window.StudentAccount.getProfile ? window.StudentAccount.getProfile() : null;
        const academicNames = {
            TCS: ['الجذع المشترك العلمي', 'Tronc commun scientifique'],
            TCL: ['الجذع المشترك الأدبي', 'Tronc commun lettres'],
            '1BACSE': ['الأولى باكالوريا - علوم تجريبية', '1ère Bac - Sciences expérimentales'],
            '1BACSM': ['الأولى باكالوريا - علوم رياضية', '1ère Bac - Sciences mathématiques'],
            '1BACL': ['الأولى باكالوريا - آداب', '1ère Bac - Lettres'],
            '2BACSVT': ['الثانية باكالوريا - علوم الحياة والأرض', '2ème Bac - SVT'],
            '2BACSP': ['الثانية باكالوريا - علوم فيزيائية', '2ème Bac - Sciences physiques'],
            '2BACSM': ['الثانية باكالوريا - علوم رياضية', '2ème Bac - Sciences mathématiques']
        };
        const academicName = academic && academicNames[academic.study_track]
            ? (lang() === 'ar' ? academicNames[academic.study_track][0] : academicNames[academic.study_track][1]) : '';
        const academicBanner = academicName
            ? `<div class="gs-student-level">🎓 <span>${lang() === 'ar' ? 'مستواك الدراسي:' : 'Votre niveau :'}</span> <strong>${escapeHtml(academicName)}</strong></div>` : '';
        const html = `
            <div class="dashboard-header">
                ${accountBar || `<div class="profile-selector">
                    <label>${t('currentProfile')}:</label>
                    <select id="profile-select">${profilesOptions}</select>
                    <button class="btn-create-profile" onclick="promptCreateProfile()">+ ${t('createProfile')}</button>
                </div>`}
                <div class="data-actions">
                    <button class="btn-export" onclick="handleExport()">${t('exportData')}</button>
                    <button class="btn-import" onclick="handleImport()">${t('importData')}</button>
                    <input type="file" id="import-file" accept=".json" style="display:none" onchange="handleImportFile(this)">
                </div>
            </div>
            <section class="gs-student-welcome">
                <div class="gs-welcome-copy"><span class="gs-eyebrow">GO SVT MAROC · ESPACE ÉLÈVE</span>
                <h2>${lang() === 'ar' ? 'مرحباً ' + escapeHtml(currentProfile.name) + '، مستعد لاكتشاف جديد؟' : 'Bonjour ' + escapeHtml(currentProfile.name) + ', prêt à découvrir ?'}</h2>
                <p>${lang() === 'ar' ? 'رحلتك في علوم الحياة والأرض تبدأ بخطوة صغيرة اليوم: افهم درساً، أنجز تمريناً، واكتشف مدى تقدمك.' : 'Un petit pas aujourd’hui : comprendre une leçon, faire un exercice et mesurer vos progrès.'}</p>
                <div class="gs-welcome-tags"><span>🧬 ${lang() === 'ar' ? 'افهم' : 'Comprendre'}</span><span>🔬 ${lang() === 'ar' ? 'استكشف' : 'Explorer'}</span><span>🎯 ${lang() === 'ar' ? 'أتقن' : 'Maîtriser'}</span></div></div>
                <a class="gs-primary-link" href="#cours">${lang() === 'ar' ? 'ابدأ التعلم الآن' : 'Commencer'} <span aria-hidden="true">←</span></a>
            </section>
            ${academicBanner}
            ${renderPlantCellExplorer()}
            ${renderPhotosynthesisLab()}
            ${renderCellPhotosynthesisQuiz()}
            ${renderHumanSystemsAtlas()}
            ${renderLevelLearningPaths()}
            ${renderMicroscopeLab()}
            ${renderPhotosynthesisExperiment()}
            ${renderScientificMediaLibrary()}
            ${renderScienceMemoryCards()}
            ${renderSvtGlossary()}
            <div class="gs-learning-path">
                <div class="gs-path-heading"><div><span class="gs-eyebrow">${lang() === 'ar' ? 'مسارك الدراسي' : 'VOTRE PARCOURS'}</span><h3>${lang() === 'ar' ? 'كل خطوة تقربك من الإتقان' : 'Chaque étape vous rapproche de la maîtrise'}</h3></div><span class="gs-path-mark">🌱</span></div>
                <div class="gs-path-steps">
                    <a href="#cours"><span class="gs-path-icon">📖</span><strong>${lang() === 'ar' ? 'أفهم الدرس' : 'Comprendre'}</strong><small>${lang() === 'ar' ? 'دروس وملخصات' : 'Cours et résumés'}</small></a>
                    <a href="#exercices"><span class="gs-path-icon">🧩</span><strong>${lang() === 'ar' ? 'أطبق ما تعلمت' : 'Appliquer'}</strong><small>${lang() === 'ar' ? 'تمارين متدرجة' : 'Exercices progressifs'}</small></a>
                    <a href="#quiz"><span class="gs-path-icon">⚡</span><strong>${lang() === 'ar' ? 'أختبر نفسي' : 'Me tester'}</strong><small>${lang() === 'ar' ? 'اختبارات تفاعلية' : 'Quiz interactifs'}</small></a>
                    <a href="#examens"><span class="gs-path-icon">🏆</span><strong>${lang() === 'ar' ? 'أستعد للامتحان' : 'Me préparer'}</strong><small>${lang() === 'ar' ? 'فروض وامتحانات' : 'Devoirs et examens'}</small></a>
                </div>
            </div>
            ${renderDailyChallenge()}
            ${renderStudyRecommendations()}
            <h3 class="gs-section-title">${t('quickAccess')}</h3>
            <div class="gs-quick-links">
                <a href="#cours"><span>📚</span>${t('resources')}</a>
                <a href="#exercices"><span>✏️</span>${t('exercises')}</a>
                <a href="#examens"><span>📝</span>${t('exams')}</a>
                <a href="#quiz"><span>❓</span>${t('interactiveQuiz')}</a>
                <a href="#resumes"><span>📋</span>${t('summaries')}</a>
            </div>
            <h3 class="gs-section-title">${lang() === 'ar' ? 'ملخص نشاطك الدراسي' : 'Votre activité scolaire'}</h3>
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
            ${renderAchievements()}
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

        const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
        const completed = lessons.filter(([id, data]) => data.completed);
        const pending = lessons.filter(([id, data]) => !data.completed);

        let html = '<div class="progress-section">';
        
        html += '<h3>✅ ' + t('completedLessons') + '</h3>';
        html += '<div class="lesson-list">';
        completed.forEach(([id, data]) => {
            html += `
                <div class="lesson-item completed">
                    <span title="${esc(id)}">${esc(data.title || id)}</span>
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
                    <span title="${esc(id)}">${esc(data.title || id)}</span>
                    <button class="btn-complete" data-lesson="${esc(id)}">${t('markAsComplete')}</button>
                </div>
            `;
        });
        html += '</div>';

        // Répartition des leçons consultées par niveau / filière / langue (affichage seulement)
        const groups = {};
        lessons.forEach(([id, data]) => {
            const w = parseContentPath(data.path || id);
            if (!w.level) return;
            const langName = w.lang === 'arabe' ? 'العربية' : (w.lang === 'francais' ? 'Français' : w.lang);
            const label = [w.level, w.track, langName].filter(Boolean).join(' · ');
            groups[label] = (groups[label] || 0) + 1;
        });
        const labels = Object.keys(groups).sort();
        if (labels.length) {
            html += '<h3>🧭 ' + t('byTrack') + '</h3><div class="lesson-list">';
            labels.forEach(label => {
                html += `<div class="lesson-item"><span dir="auto">${esc(label)}</span><span class="lesson-date">${groups[label]}</span></div>`;
            });
            html += '</div>';
        }

        html += '</div>';
        return html;
    }

    // ============================================
    // 8. QUIZ HISTORY (سجل التقييمات)
    // ============================================
    function getQuizDisplayName(quizId) {
        const labels = {
            'human-systems-atlas': {ar:'أطلس أجهزة جسم الإنسان',fr:'Atlas des systèmes du corps humain'},
            'cell-photosynthesis-revision': {ar:'تحدي الخلية والتركيب الضوئي',fr:'Défi cellule et photosynthèse'}
        };
        const entry = labels[String(quizId || '')];
        return entry ? entry[lang()] : escapeHtml(quizId || '');
    }

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
                        <span class="history-quiz">${getQuizDisplayName(r.quizId)}</span>
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
        const mistakesByQuiz = Object.create(null);
        mistakes.forEach(mistake => {
            if (!mistakesByQuiz[mistake.quizId]) {
                mistakesByQuiz[mistake.quizId] = [];
            }
            mistakesByQuiz[mistake.quizId].push(mistake);
        });

        let html = '<div class="mistakes-list">';
        Object.entries(mistakesByQuiz).forEach(([quizId, quizMistakes]) => {
            const attempts = (profileData.quizResults || [])
                .filter(result => result && result.quizId === quizId && Number.isFinite(result.percentage))
                .sort((a, b) => a.date - b.date);
            const latest = attempts.length ? attempts[attempts.length - 1] : null;
            const previous = attempts.length > 1 ? attempts[attempts.length - 2] : null;
            const best = attempts.reduce((value, result) => Math.max(value, result.percentage), 0);
            const change = latest && previous ? latest.percentage - previous.percentage : null;
            const trend = change === null
                ? t('لا تتوفر مقارنة بعد', 'Pas encore de comparaison')
                : change > 0
                    ? (lang() === 'ar' ? 'تحسن +' + change + ' نقطة' : 'Progression +' + change + ' pts')
                    : change < 0
                        ? (lang() === 'ar' ? 'تراجع ' + change + ' نقطة' : 'Baisse ' + change + ' pts')
                        : t('نتيجة مستقرة', 'Résultat stable');
            html += `
                <div class="mistake-quiz-group">
                    <div class="mistake-quiz-header">
                        <span>${getQuizDisplayName(quizId)}</span>
                        <button class="btn-retry-mistakes" data-quiz-id="${escapeHtml(quizId)}">${t('retryMistakes')}</button>
                    </div>
                    <div class="gs-mistake-progress">
                        <span>${lang() === 'ar' ? 'المحاولات:' : 'Tentatives :'} <strong>${attempts.length}</strong></span>
                        <span>${lang() === 'ar' ? 'آخر نتيجة:' : 'Dernier score :'} <strong>${latest ? latest.percentage + '%' : '—'}</strong></span>
                        <span>${lang() === 'ar' ? 'أفضل نتيجة:' : 'Meilleur score :'} <strong>${attempts.length ? best + '%' : '—'}</strong></span>
                        <span>${trend}</span>
                    </div>
                    ${quizMistakes.map(mistake => `
                        <div class="mistake-item">
                            <div class="mistake-question">${escapeHtml(mistake.question || 'Question')}</div>
                            <div class="mistake-details">
                                <span class="mistake-quiz">${getQuizDisplayName(mistake.quizId)}</span>
                                <span class="mistake-date">${new Date(mistake.date).toLocaleDateString()}</span>
                            </div>
                            <div class="mistake-answers">
                                <div class="mistake-wrong">❌ ${t('Réponse choisie:')} ${escapeHtml(mistake.selected)}</div>
                                <div class="mistake-correct">✅ ${t('Bonne réponse:')} ${escapeHtml(mistake.correct)}</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        });
        html += '</div>';

        return html;
    }

    function retryMistakes(quizId) {
        const profileId = currentProfileId;
        const profileData = getProfileData(profileId);
        const quizMistakes = profileData.mistakes.filter(m => m && m.quizId === quizId);
        if (quizMistakes.length === 0) return;

        // Launch a focused interactive review directly from the saved mistakes.
        // No sessionStorage hand-off is needed, so another account cannot inherit it.
        if (!window.GoSVTQuiz || typeof window.GoSVTQuiz.reviewMistakes !== 'function') {
            alert(t('تعذر فتح مراجعة الأخطاء الآن.', 'La révision des erreurs est indisponible pour le moment.'));
            return;
        }
        if (currentProfileId !== profileId) return;
        window.location.hash = 'quiz';
        window.GoSVTQuiz.reviewMistakes(quizMistakes);
    }

    // ============================================
    // 10. FAVORITES INTEGRATION (تكامل المفضلة)
    // ============================================
    function renderFavorites() {
        // study.js stores favorites as file paths in the "gosvt-favs" key.
        const storedFavorites = storage.get('gosvt-favs');
        const favs = Array.isArray(storedFavorites)
            ? storedFavorites.filter(path => typeof path === 'string' && path.trim())
            : [];

        if (favs.length === 0) {
            return `<p class="no-data">${t('noData')}</p>`;
        }

        let html = '<div class="favorites-list">';
        favs.forEach(path => {
            const filename = path.split('/').pop();
            const title = typeof getFileTitle === 'function'
                ? getFileTitle(filename)
                : filename.replace(/\\.[^/.]+$/, '').replace(/[_-]/g, ' ');
            html += `
                <div class="favorite-item">
                    <a href="${escapeHtml(safeLink(path))}" target="_blank" rel="noopener noreferrer">${escapeHtml(title)}</a>
                    <button type="button" class="btn-remove-fav" data-path="${escapeHtml(path)}">${t('removeFromFavorites')}</button>
                </div>
            `;
        });
        html += '</div>';
        return html;
    }

    // Keep the student-space list aligned with the favorites format used by study.js.
    function bindFavoritesPanel(panel) {
        if (!panel) return;
        panel.querySelectorAll('.btn-remove-fav').forEach(button => {
            button.addEventListener('click', function () {
                const path = this.dataset.path;
                const storedFavorites = storage.get('gosvt-favs');
                const favs = Array.isArray(storedFavorites) ? storedFavorites : [];
                const nextFavorites = favs.filter(item => item !== path);
                if (window.GoSVTStudyFavorites && typeof window.GoSVTStudyFavorites.set === 'function') {
                    window.GoSVTStudyFavorites.set(nextFavorites);
                } else {
                    storage.set('gosvt-favs', nextFavorites);
                }
                panel.innerHTML = renderFavorites();
                bindFavoritesPanel(panel);
            });
        });
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


    // ============================================
    // 11.1 STUDY PLANNER + PERSONAL NOTES
    // ============================================
    function renderPlanner() {
        const data = getProfileData(currentProfileId);
        const today = new Date();
        const todayKey = [today.getFullYear(), String(today.getMonth() + 1).padStart(2, '0'), String(today.getDate()).padStart(2, '0')].join('-');
        const items = [...data.studyPlan].sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
        const rows = items.map(item => {
            const date = String(item.date || '');
            const overdue = !item.completed && /^\d{4}-\d{2}-\d{2}$/.test(date) && date < todayKey;
            const dueToday = !item.completed && date === todayKey;
            const status = item.completed
                ? (lang() === 'ar' ? 'مكتملة' : 'Terminée')
                : overdue
                    ? (lang() === 'ar' ? 'متأخرة' : 'En retard')
                    : dueToday
                        ? (lang() === 'ar' ? 'موعدها اليوم' : "Aujourd’hui")
                        : (lang() === 'ar' ? 'قادمة' : 'À venir');
            return `
            <article class="gs-plan-item ${item.completed ? 'is-done' : ''} ${overdue ? 'is-overdue' : ''} ${dueToday ? 'is-due-today' : ''}">
                <div class="gs-plan-date">${escapeHtml(date)}</div>
                <div class="gs-plan-main"><strong>${escapeHtml(item.title || '')}</strong>
                    <small>${Number(item.duration) || 30} ${lang() === 'ar' ? 'دقيقة' : 'min'} · ${status}</small></div>
                <div class="gs-plan-actions">
                    <button type="button" class="gs-task-toggle" data-task-id="${escapeHtml(item.id)}">${item.completed ? '↩' : '✓'}</button>
                    <button type="button" class="gs-task-delete" data-task-id="${escapeHtml(item.id)}" aria-label="${t('delete')}">×</button>
                </div>
            </article>`;
        }).join('');
        return `<div class="gs-module">
            <h2>${t('planner')}</h2>
            <form id="gs-plan-form" class="gs-entry-form">
                <label>${t('taskTitle')}<input name="title" maxlength="120" required></label>
                <label>${t('taskDate')}<input name="date" type="date" required></label>
                <label>${t('duration')}<input name="duration" type="number" min="5" max="600" value="30"></label>
                <button type="submit">${t('addTask')}</button>
            </form>
            <div class="gs-plan-list">${rows || `<p class="no-data">${t('noTasks')}</p>`}</div>
        </div>`;
    }

    function renderNotes() {
        const data = getProfileData(currentProfileId);
        const rows = [...data.notes].sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0))
            .map(note => `<article class="gs-note-card">
                <div class="gs-note-heading"><strong>${escapeHtml(note.title || '')}</strong>
                <button type="button" class="gs-note-delete" data-note-id="${escapeHtml(note.id)}" aria-label="${t('delete')}">×</button></div>
                <p>${escapeHtml(note.body || '').replace(/\n/g, '<br>')}</p>
                <small>${note.updatedAt ? new Date(note.updatedAt).toLocaleDateString() : ''}</small>
            </article>`).join('');
        return `<div class="gs-module">
            <h2>${t('notesTab')}</h2>
            <form id="gs-note-form" class="gs-note-form">
                <label>${t('noteTitle')}<input name="title" maxlength="120" required></label>
                <label>${t('noteBody')}<textarea name="body" rows="4" maxlength="5000" required placeholder="${t('noteBody')}"></textarea></label>
                <button type="submit">${t('save')}</button>
            </form>
            <div class="gs-notes-grid">${rows || `<p class="no-data">${t('noNotes')}</p>`}</div>
        </div>`;
    }

    function bindPlannerAndNotes(container) {
        const planForm = container.querySelector('#gs-plan-form');
        if (planForm) planForm.addEventListener('submit', function (event) {
            event.preventDefault();
            const form = new FormData(planForm);
            const title = String(form.get('title') || '').trim();
            const date = String(form.get('date') || '');
            if (!title || !date) return;
            const data = getProfileData(currentProfileId);
            const now = Date.now();
            data.studyPlan.push({ id: makeId(), title: title.slice(0, 120), date, duration: Math.min(600, Math.max(5, Number(form.get('duration')) || 30)), completed: false, createdAt: now, updatedAt: now });
            saveProfileData(currentProfileId, data);
            refreshStudentSpaceView();
        });
        const noteForm = container.querySelector('#gs-note-form');
        if (noteForm) noteForm.addEventListener('submit', function (event) {
            event.preventDefault();
            const form = new FormData(noteForm);
            const title = String(form.get('title') || '').trim();
            const body = String(form.get('body') || '').trim();
            if (!title || !body) return;
            const data = getProfileData(currentProfileId);
            data.notes.unshift({ id: makeId(), title: title.slice(0, 120), body: body.slice(0, 5000), createdAt: Date.now(), updatedAt: Date.now() });
            saveProfileData(currentProfileId, data);
            refreshStudentSpaceView();
        });
        container.querySelectorAll('.gs-task-toggle').forEach(button => button.addEventListener('click', function () {
            const data = getProfileData(currentProfileId);
            const item = data.studyPlan.find(x => x.id === this.dataset.taskId);
            if (item) { item.completed = !item.completed; item.updatedAt = Date.now(); }
            saveProfileData(currentProfileId, data); refreshStudentSpaceView();
        }));
        container.querySelectorAll('.gs-task-delete').forEach(button => button.addEventListener('click', function () {
            const data = getProfileData(currentProfileId);
            const deletedId = this.dataset.taskId;
            data.studyPlan = data.studyPlan.filter(x => x.id !== deletedId);
            saveProfileData(currentProfileId, data);
            if (window.GoSVTCloud && typeof window.GoSVTCloud.deleteStudyPlanItem === 'function') {
                window.GoSVTCloud.deleteStudyPlanItem(deletedId, window.StudentAccount && window.StudentAccount.getUser() && window.StudentAccount.getUser().id).catch(err => console.warn('[GoSVT] Cloud planner delete deferred:', err && err.message));
            }
            refreshStudentSpaceView();
        }));
        container.querySelectorAll('.gs-note-delete').forEach(button => button.addEventListener('click', function () {
            const data = getProfileData(currentProfileId);
            const deletedId = this.dataset.noteId;
            data.notes = data.notes.filter(x => x.id !== deletedId);
            saveProfileData(currentProfileId, data);
            if (window.GoSVTCloud && typeof window.GoSVTCloud.deleteNote === 'function') {
                window.GoSVTCloud.deleteNote(deletedId, window.StudentAccount && window.StudentAccount.getUser() && window.StudentAccount.getUser().id).catch(err => console.warn('[GoSVT] Cloud note delete deferred:', err && err.message));
            }
            refreshStudentSpaceView();
        }));
    }


    async function renderManagerStudentRegistry(container) {
        const fr = document.documentElement.lang === 'fr';
        const tr = (ar, french) => fr ? french : ar;
        container.innerHTML = `
          <div class="student-space gs-manager-space">
            <section class="gs-manager-hero">
              <div><span class="gs-manager-kicker">GO SVT MAROC · ADMIN</span>
                <h3>${tr('فضاء مدير مساحتي','Espace gestionnaire de Mon espace')}</h3>
                <p>${tr('متابعة حسابات التلاميذ المسجلين ومستوياتهم ومسالكهم الدراسية.','Suivi des comptes élèves inscrits, de leurs niveaux et filières.')}</p>
              </div>
              <div class="gs-manager-account-actions" style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
                <span class="gs-manager-icon" aria-hidden="true">🎓</span>
                <button type="button" class="gs-manager-logout" id="gs-manager-logout" style="display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:11px 16px;border:1px solid #d97757;border-radius:12px;background:#fff7f3;color:#9b341d;font:700 14px inherit;cursor:pointer;white-space:nowrap">🚪 ${tr('تسجيل الخروج','Se déconnecter')}</button>
              </div>
            </section>
            <section class="gs-manager-card">
              <div class="gs-manager-heading"><div><h4>${tr('التلاميذ المسجلون','Élèves inscrits')}</h4>
                <p>${tr('هذه البيانات خاصة بحساب المدير فقط.','Ces informations sont réservées au compte gestionnaire.')}</p></div>
                <button type="button" class="gs-manager-refresh" id="gs-manager-refresh">↻ ${tr('تحديث','Actualiser')}</button>
              </div>
              <div class="gs-manager-stats"><div><strong id="gs-manager-count">—</strong><span>${tr('إجمالي التلاميذ','Total élèves')}</span></div><div><strong id="gs-manager-shown">—</strong><span>${tr('نتائج معروضة','Résultats affichés')}</span></div></div>
              <div class="gs-manager-tools"><input id="gs-manager-search" type="search" placeholder="${tr('ابحث بالاسم أو البريد الإلكتروني','Rechercher par nom ou e-mail')}" aria-label="${tr('البحث عن تلميذ','Rechercher un élève')}">
                <select id="gs-manager-level" aria-label="${tr('تصفية حسب المستوى','Filtrer par niveau')}">
                  <option value="">${tr('جميع المستويات','Tous les niveaux')}</option><option value="TC">TC — ${tr('الجذع المشترك','Tronc commun')}</option><option value="1BAC">1BAC — ${tr('الأولى باكالوريا','1ère Bac')}</option><option value="2BAC">2BAC — ${tr('الثانية باكالوريا','2ème Bac')}</option>
                </select></div>
              <p class="gs-manager-status" id="gs-manager-status" aria-live="polite">${tr('جارٍ تحميل القائمة…','Chargement de la liste…')}</p>
              <div class="gs-manager-list" id="gs-manager-list"></div>
            </section>
          </div>`;
        const logoutButton = container.querySelector('#gs-manager-logout');
        if (logoutButton) logoutButton.addEventListener('click', async () => {
          logoutButton.disabled = true;
          logoutButton.textContent = tr('جارٍ تسجيل الخروج…','Déconnexion…');
          try {
            const account = window.StudentAccount;
            if (account && typeof account.logout === 'function') {
              await account.logout();
            } else if (window.supabaseClient) {
              const { error } = await window.supabaseClient.auth.signOut();
              if (error) throw error;
            }
          } catch (error) {
            console.error('[GoSVT] Manager sign out failed:', error);
            logoutButton.disabled = false;
            logoutButton.textContent = '🚪 ' + tr('إعادة المحاولة','Réessayer');
          }
        });
        const list=container.querySelector('#gs-manager-list'), status=container.querySelector('#gs-manager-status');
        const search=container.querySelector('#gs-manager-search'), levelFilter=container.querySelector('#gs-manager-level');
        let students=[];
        const levelNames={TC:tr('الجذع المشترك','Tronc commun'),'1BAC':tr('الأولى باكالوريا','1ère Bac'),'2BAC':tr('الثانية باكالوريا','2ème Bac')};
        const trackNames={TCS:tr('الجذع المشترك العلمي','Tronc commun scientifique'),TCL:tr('الجذع المشترك الأدبي','Tronc commun lettres'), '1BACSE':tr('العلوم التجريبية','Sciences expérimentales'),'1BACSM':tr('العلوم الرياضية','Sciences mathématiques'),'1BACL':tr('الآداب','Lettres'),'2BACSVT':tr('علوم الحياة والأرض','Sciences de la vie et de la Terre'),'2BACSP':tr('العلوم الفيزيائية','Sciences physiques'),'2BACSM':tr('العلوم الرياضية','Sciences mathématiques')};
        function render(){
          const q=search.value.trim().toLocaleLowerCase(), lv=levelFilter.value;
          const rows=students.filter(s=>(!lv||s.study_level===lv)&&(!q||[s.display_name,s.email].some(v=>String(v||'').toLocaleLowerCase().includes(q))));
          container.querySelector('#gs-manager-count').textContent=String(students.length);
          container.querySelector('#gs-manager-shown').textContent=String(rows.length);
          list.replaceChildren();
          if(!rows.length){const p=document.createElement('p');p.className='gs-manager-empty';p.textContent=students.length?tr('لا توجد نتائج مطابقة.','Aucun résultat correspondant.'):tr('لا يوجد تلاميذ مسجلون بعد.','Aucun élève inscrit pour le moment.');list.append(p);return;}
          rows.forEach(s=>{
            const card=document.createElement('article');card.className='gs-manager-student';
            const identity=document.createElement('div');identity.className='gs-manager-identity';
            const name=document.createElement('strong');name.textContent=s.display_name||tr('دون اسم','Sans nom');
            const email=document.createElement('a');email.href='mailto:'+encodeURIComponent(s.email||'');email.textContent=s.email||'—';
            const date=document.createElement('small');const d=s.registered_at?new Date(s.registered_at):null;date.textContent=tr('تاريخ التسجيل: ','Inscription : ')+(d&&!Number.isNaN(d.getTime())?d.toLocaleString(fr?'fr-FR':'ar-MA'):'—');
            identity.append(name,email,date);
            const academic=document.createElement('div');academic.className='gs-manager-academic';
            const lv=document.createElement('span');lv.textContent=levelNames[s.study_level]||s.study_level||tr('مستوى غير محدد','Niveau non renseigné');
            const track=document.createElement('span');track.textContent=trackNames[s.study_track]||s.study_track||tr('مسلك غير محدد','Filière non renseignée');
            const verified=document.createElement('small');verified.className=s.email_confirmed?'is-confirmed':'is-pending';verified.textContent=s.email_confirmed?tr('البريد مؤكد','E-mail confirmé'):tr('بانتظار تأكيد البريد','E-mail à confirmer');
            academic.append(lv,track,verified);card.append(identity,academic);list.append(card);
          });
        }
        async function load(){
          status.textContent=tr('جارٍ تحميل القائمة…','Chargement de la liste…');
          const {data,error}=await window.supabaseClient.rpc('gosvt_admin_student_registry');
          if(error){status.textContent=tr('تعذر تحميل القائمة: ','Impossible de charger la liste : ')+error.message;return;}
          students=Array.isArray(data)?data:[];status.textContent='';render();
        }
        search.addEventListener('input',render);levelFilter.addEventListener('change',render);
        container.querySelector('#gs-manager-refresh').addEventListener('click',load);
        await load();
    }

    function renderStudentSpace() {
        const container = document.getElementById('student-space-content');
        if (!container) return;
        if (window.StudentAccount && !window.StudentAccount.isLoggedIn()) {
            window.StudentAccount.renderGate(container);
            return;
        }

        // Teacher and administrator accounts must not render the student dashboard.
        // Keep all existing student data intact; this is a presentation/role separation only.
        const activeProfile = window.StudentAccount && window.StudentAccount.getProfile
            ? window.StudentAccount.getProfile()
            : null;
        if (activeProfile && activeProfile.role === 'admin') {
            renderManagerStudentRegistry(container);
            return;
        }
        if (activeProfile && activeProfile.role === 'teacher') {
            const isArabic = document.documentElement.dir === 'rtl';
            container.innerHTML = '<div class="student-space" role="status"><p>' +
                (isArabic ? 'فضاء الأستاذ — أدوات التدبير التربوي متاحة من مساحة الأستاذ.' : 'Espace enseignant — les outils pédagogiques sont disponibles dans votre espace enseignant.') +
                '</p></div>';
            return;
        }

        syncCurrentProfile();

        let html = `
            <div class="student-space">
                <div class="space-nav">
                    <button class="space-tab active" data-tab="dashboard">${t('dashboard')}</button>
                    <button class="space-tab" data-tab="progress">${t('progress')}</button>
                    <button class="space-tab" data-tab="history">${t('history')}</button>
                    <button class="space-tab" data-tab="mistakes">${t('mistakes')}</button>
                    <button class="space-tab" data-tab="favorites">${t('favorites')}</button>
                    <button class="space-tab" data-tab="motivation">${t('motivation')}</button>
                    <button class="space-tab" data-tab="planner">🗓 ${t('planner')}</button>
                    <button class="space-tab" data-tab="notes">🗒 ${t('notesTab')}</button>
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
                    <div class="space-panel" id="panel-planner">
                        ${renderPlanner()}
                    </div>
                    <div class="space-panel" id="panel-notes">
                        ${renderNotes()}
                    </div>
                </div>
            </div>
        `;

        container.innerHTML = html;
        loadScientificMediaImages(container);
        if (container.dataset.gsStudyJumpsBound !== 'true') {
            container.dataset.gsStudyJumpsBound = 'true';
            container.addEventListener('click', function(event) {
                const jump = event.target.closest('[data-study-anchor]');
                if (!jump || !container.contains(jump)) return;
                const target = container.querySelector('#' + jump.dataset.studyAnchor);
                if (target) {
                    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
                    target.scrollIntoView({behavior:reduced?'auto':'smooth',block:'center'});
                    target.setAttribute('tabindex','-1');
                    target.focus({preventScroll:true});
                }
            });
        }
        const experimentRoot = container.querySelector('.gs-photosynthesis-experiment');
        if (experimentRoot) {
            const inputs = Array.from(experimentRoot.querySelectorAll('[data-experiment-input]'));
            const updateExperiment = function() {
                const values = {};
                inputs.forEach(input => { values[input.dataset.experimentInput] = Number(input.value); });
                const temperature = values.temperature;
                const thermalCapacity = temperature <= 10 ? temperature * 5 :
                    temperature <= 25 ? 50 + (temperature - 10) * (50 / 15) :
                    temperature <= 35 ? 100 - (temperature - 25) * 3 :
                    Math.max(10, 70 - (temperature - 35) * 5);
                const factors = [
                    {key:'light',value:values.light,label:lang()==='fr'?'la lumière':'الضوء'},
                    {key:'co2',value:values.co2,label:'CO₂'},
                    {key:'temperature',value:Math.round(thermalCapacity),label:lang()==='fr'?'la température':'درجة الحرارة'}
                ];
                const limiting = factors.reduce((lowest,item)=>item.value<lowest.value?item:lowest,factors[0]);
                const rate = Math.max(0,Math.min(100,Math.round(Math.min(...factors.map(item=>item.value)))));
                inputs.forEach(input => {
                    const key=input.dataset.experimentInput;
                    const output=experimentRoot.querySelector('[data-experiment-value="'+key+'"]');
                    if(output) output.textContent=key==='temperature'?values[key]+'°C':values[key]+'%';
                    const gauge=experimentRoot.querySelector('[data-experiment-gauge="'+key+'"]');
                    if(gauge) gauge.textContent=(key==='temperature'?Math.round(thermalCapacity):values[key])+'%';
                });
                const rateNode=experimentRoot.querySelector('[data-experiment-rate]');
                const meter=experimentRoot.querySelector('[data-experiment-meter]');
                const limiter=experimentRoot.querySelector('[data-experiment-limiter]');
                const explanation=experimentRoot.querySelector('[data-experiment-explain]');
                if(rateNode) rateNode.textContent=rate+'%';
                if(meter) meter.style.width=rate+'%';
                if(limiter) limiter.textContent=limiting.label;
                if(explanation) explanation.textContent=lang()==='fr'
                    ? 'Dans ce modèle, '+limiting.label+' constitue le facteur le moins favorable et limite la vitesse relative.'
                    : 'في هذا النموذج، تمثل '+limiting.label+' العامل الأقل ملاءمة، ولذلك يحد من الوتيرة النسبية.';
            };
            experimentRoot.addEventListener('input',updateExperiment);
            const reset=experimentRoot.querySelector('.gs-experiment-reset');
            if(reset) reset.addEventListener('click',function(){
                inputs.forEach(input=>{input.value=input.dataset.experimentInput==='light'?'70':input.dataset.experimentInput==='co2'?'65':'25';});
                updateExperiment();
            });
            updateExperiment();
        }
        const microscopeData = {
            onion: {name: lang()==='fr'?'Épiderme d’oignon':'بشرة البصل',kind: lang()==='fr'?'Cellules végétales':'خلايا نباتية',observe: lang()==='fr'?'Paroi cellulaire · organisation en mosaïque':'الجدار الخلوي · تنظيم الخلايا كفسيفساء',detail: lang()==='fr'?'Cellules jointives, de forme polygonale, limitées par une paroi visible.':'خلايا متراصة متعددة الأضلاع تحدها جدران خلوية واضحة.',art: '<svg viewBox="0 0 520 300" role="img" aria-label="Cellules épidermiques"><g fill="#f3d9ee" stroke="#9a6d9a" stroke-width="4"><path d="M20 18L145 12 152 95 18 103Z"/><path d="M155 12L280 20 276 104 152 95Z"/><path d="M290 18L500 12 502 105 276 104Z"/><path d="M18 112L152 105 160 205 18 211Z"/><path d="M160 105L276 112 280 210 160 205Z"/><path d="M285 112L502 112 500 210 280 210Z"/><path d="M18 220L160 215 155 290 18 288Z"/><path d="M165 215L280 220 278 290 155 290Z"/><path d="M285 220L500 218 502 290 278 290Z"/></g><g fill="#9165a0"><circle cx="85" cy="59" r="9"/><circle cx="216" cy="58" r="9"/><circle cx="395" cy="58" r="9"/><circle cx="85" cy="160" r="9"/><circle cx="218" cy="160" r="9"/><circle cx="394" cy="160" r="9"/></g></svg>'},
            stomata: {name: lang()==='fr'?'Stomates foliaires':'ثغور الورقة',kind: lang()==='fr'?'Épiderme de feuille':'بشرة ورقية',observe: lang()==='fr'?'Cellules de garde · ostiole · échanges gazeux':'الخلايا الحارسة · الفتحة الثغرية · التبادلات الغازية',detail: lang()==='fr'?'Deux cellules de garde entourent une ouverture qui participe aux échanges gazeux.':'تحيط خليتان حارستان بفتحة تساهم في التبادلات الغازية والنتح.',art: '<svg viewBox="0 0 520 300" role="img" aria-label="Stomate"><path d="M125 55C40 80 65 220 175 245Q235 150 175 65Z M395 55C480 80 455 220 345 245Q285 150 345 65Z" fill="#b6d99b" stroke="#568b50" stroke-width="5"/><ellipse cx="260" cy="150" rx="35" ry="85" fill="#eaf6df" stroke="#578c53" stroke-width="4"/></svg>'},
            blood: {name: lang()==='fr'?'Frottis sanguin':'لطاخة دموية',kind: lang()==='fr'?'Cellules sanguines':'خلايا الدم',observe: lang()==='fr'?'Globules rouges · globules blancs · plaquettes':'كريات حمراء · كريات بيضاء · صفائح دموية',detail: lang()==='fr'?'Le frottis distingue les globules rouges, quelques globules blancs et les plaquettes.':'تظهر في اللطاخة الكريات الحمراء وبعض الكريات البيضاء والصفائح الدموية.',art: '<svg viewBox="0 0 520 300" role="img" aria-label="Cellules sanguines"><g fill="#d96868" stroke="#a83f48" stroke-width="3"><ellipse cx="65" cy="70" rx="34" ry="22"/><ellipse cx="165" cy="55" rx="34" ry="22"/><ellipse cx="285" cy="72" rx="34" ry="22"/><ellipse cx="425" cy="60" rx="34" ry="22"/><ellipse cx="110" cy="170" rx="34" ry="22"/><ellipse cx="365" cy="180" rx="34" ry="22"/></g><circle cx="245" cy="190" r="48" fill="#eee5f8" stroke="#76569b" stroke-width="5"/></svg>'},
            leaf: {name: lang()==='fr'?'Cellules chlorophylliennes':'خلايا يخضورية',kind: lang()==='fr'?'Tissu végétal':'نسيج نباتي',observe: lang()==='fr'?'Cellules végétales · chloroplastes · parois':'خلايا نباتية · بلاستيدات خضراء · جدران',detail: lang()==='fr'?'Les chloroplastes captent l’énergie lumineuse utilisée pour la photosynthèse.':'تلتقط البلاستيدات الخضراء الطاقة الضوئية اللازمة للتركيب الضوئي.',art: '<svg viewBox="0 0 520 300" role="img" aria-label="Cellules chlorophylliennes"><g fill="#e8f1d6" stroke="#779c61" stroke-width="5"><rect x="15" y="18" width="155" height="120" rx="22"/><rect x="180" y="18" width="155" height="120" rx="22"/><rect x="345" y="18" width="160" height="120" rx="22"/><rect x="15" y="158" width="155" height="125" rx="22"/><rect x="180" y="158" width="155" height="125" rx="22"/><rect x="345" y="158" width="160" height="125" rx="22"/></g><g fill="#4e9c56"><ellipse cx="45" cy="48" rx="13" ry="7"/><ellipse cx="130" cy="105" rx="13" ry="7"/><ellipse cx="210" cy="50" rx="13" ry="7"/><ellipse cx="300" cy="105" rx="13" ry="7"/><ellipse cx="375" cy="48" rx="13" ry="7"/><ellipse cx="470" cy="105" rx="13" ry="7"/></g></svg>'}
        };
        let microscopeZoom = 100;
        let microscopeCurrent = microscopeData.onion;
        const microscopeRoot = container.querySelector('.gs-microscope-lab');
        if (microscopeRoot) {
            microscopeRoot.addEventListener('click', function(event) {
                const slideButton = event.target.closest('[data-micro-slide]');
                if (slideButton) {
                    const slide = microscopeData[slideButton.dataset.microSlide];
                    if (!slide) return;
                    microscopeCurrent = slide;
                    microscopeRoot.dataset.activeSlide = slideButton.dataset.microSlide;
                    microscopeRoot.querySelectorAll('[data-micro-slide]').forEach(function(button) {
                        const active = button === slideButton;
                        button.classList.toggle('is-active', active);
                        button.setAttribute('aria-pressed', active ? 'true' : 'false');
                    });
                    microscopeRoot.querySelector('.gs-micro-view-title').textContent = slide.name;
                    microscopeRoot.querySelector('.gs-micro-kind').textContent = slide.kind;
                    microscopeRoot.querySelector('.gs-micro-observe-text').textContent = slide.observe;
                    microscopeRoot.querySelector('.gs-micro-detail-text').textContent = slide.detail;
                    const art = microscopeRoot.querySelector('.gs-micro-art');
                    const overlay = microscopeRoot.querySelector('.gs-micro-overlay');
                    const sourceCard = Array.from(microscopeRoot.querySelectorAll('[data-micro-source]')).find(card => card.dataset.microSource === slideButton.dataset.microSlide);
                    const sourceImage = sourceCard && sourceCard.querySelector('.gs-science-media-photo img');
                    if (sourceImage && art) {
                        const preview = sourceImage.cloneNode();
                        preview.style.width = '100%';
                        preview.style.height = '100%';
                        preview.style.objectFit = 'contain';
                        preview.style.display = 'block';
                        art.replaceChildren(preview);
                        art.classList.add('is-real-photo');
                        if (overlay) overlay.textContent = lang()==='fr'?'Microphotographie réelle':'صورة مجهرية حقيقية';
                    } else if (art) {
                        art.innerHTML = slide.art;
                        art.classList.remove('is-real-photo');
                        if (overlay) overlay.textContent = lang()==='fr'?'Schéma pédagogique — aperçu de secours':'رسم توضيحي — معاينة بديلة';
                    }
                }
                const zoomButton = event.target.closest('[data-micro-zoom]');
                if (zoomButton) {
                    microscopeZoom = Math.max(80, Math.min(160, microscopeZoom + (zoomButton.dataset.microZoom === 'in' ? 20 : -20)));
                    const art = microscopeRoot.querySelector('.gs-micro-art');
                    if (art) art.style.transform = 'scale(' + microscopeZoom / 100 + ')';
                    microscopeRoot.querySelector('.gs-micro-zoom-value').textContent = microscopeZoom + '%';
                }
                const labelButton = event.target.closest('.gs-micro-label-toggle');
                if (labelButton) {
                    const active = labelButton.getAttribute('aria-pressed') !== 'true';
                    labelButton.setAttribute('aria-pressed', active ? 'true' : 'false');
                    microscopeRoot.classList.toggle('show-micro-labels', active);
                    const overlay = microscopeRoot.querySelector('.gs-micro-overlay');
                    if (overlay) overlay.textContent = active ? microscopeCurrent.observe : (microscopeRoot.querySelector('.gs-micro-art') && microscopeRoot.querySelector('.gs-micro-art').classList.contains('is-real-photo') ? (lang()==='fr'?'Microphotographie réelle':'صورة مجهرية حقيقية') : (lang()==='fr'?'Schéma pédagogique':'رسم تعليمي'));
                    labelButton.textContent = lang()==='fr' ? (active?'Masquer les repères':'Afficher les repères') : (active?'إخفاء البيانات':'إظهار البيانات');
                }
            });
        }

        const cellFacts = {
            nucleus: [lang()==='fr'?'Noyau':'النواة', lang()==='fr'?'Le noyau contient l’information génétique (ADN) et participe au contrôle des activités cellulaires.':'تحتوي النواة على المعلومة الوراثية (ADN)، وتساهم في تنظيم أنشطة الخلية.'],
            chloroplast: [lang()==='fr'?'Chloroplaste':'البلاستيدة الخضراء', lang()==='fr'?'Les chloroplastes contiennent la chlorophylle et réalisent la photosynthèse grâce à l’énergie lumineuse.':'تحتوي البلاستيدات الخضراء على اليخضور، وتنجز عملية التركيب الضوئي باستعمال الطاقة الضوئية.'],
            vacuole: [lang()==='fr'?'Vacuole':'الفجوة العصارية', lang()==='fr'?'La grande vacuole stocke notamment l’eau et contribue au maintien de la turgescence.':'تخزن الفجوة العصارية الماء ومواد مختلفة، وتساهم في الحفاظ على ضغط الامتلاء.'],
            membrane: [lang()==='fr'?'Membrane plasmique':'الغشاء البلازمي', lang()==='fr'?'La membrane plasmique délimite la cellule et régule les échanges avec le milieu.':'يحيط الغشاء البلازمي بالخلية وينظم التبادلات بينها وبين الوسط الخارجي.'],
            wall: [lang()==='fr'?'Paroi cellulaire':'الجدار الخلوي', lang()==='fr'?'La paroi cellulosique protège la cellule et lui donne soutien et forme.':'يوفر الجدار الخلوي دعامة وحماية للخلية ويساهم في الحفاظ على شكلها.']
        };
        container.querySelectorAll('.gs-cell-part').forEach(button => button.addEventListener('click', function () {
            const fact = cellFacts[this.dataset.cellPart];
            if (!fact) return;
            container.querySelectorAll('.gs-cell-part').forEach(item => {
                const active = item === this;
                item.classList.toggle('is-active', active);
                item.setAttribute('aria-pressed', active ? 'true' : 'false');
            });
            const title = container.querySelector('.gs-cell-fact-title');
            const body = container.querySelector('.gs-cell-fact-text');
            if (title) title.textContent = fact[0];
            if (body) body.textContent = fact[1];
        }));
        const photoFacts = {
            light: [lang()==='fr'?'L’énergie lumineuse':'الطاقة الضوئية', lang()==='fr'?'La chlorophylle des chloroplastes capte l’énergie lumineuse nécessaire à la photosynthèse.':'يلتقط اليخضور الموجود في البلاستيدات الخضراء الطاقة الضوئية اللازمة للتركيب الضوئي.'],
            water: [lang()==='fr'?'L’eau et les sels minéraux':'الماء والأملاح المعدنية', lang()==='fr'?'L’eau absorbée par les racines rejoint les feuilles grâce aux vaisseaux conducteurs.':'تمتص الجذور الماء والأملاح المعدنية، ثم تنتقل نحو الأوراق عبر الأوعية الناقلة.'],
            co2: [lang()==='fr'?'Le dioxyde de carbone':'ثاني أكسيد الكربون', lang()==='fr'?'Le CO₂ de l’air entre principalement dans la feuille par les stomates.':'يدخل غاز CO₂ من الهواء إلى الورقة أساساً عبر الثغور.'],
            sugar: [lang()==='fr'?'La matière organique':'المادة العضوية', lang()==='fr'?'Dans les chloroplastes, l’énergie lumineuse permet de fabriquer des sucres à partir de CO₂ et d’eau.':'تستعمل البلاستيدات الخضراء الطاقة الضوئية لتصنيع السكريات انطلاقاً من الماء وCO₂.'],
            oxygen: [lang()==='fr'?'Le dioxygène':'غاز الأكسجين', lang()==='fr'?'Du dioxygène est libéré dans l’atmosphère au cours de la photosynthèse.':'ينطلق غاز الأكسجين إلى الوسط الخارجي خلال عملية التركيب الضوئي.']
        };
        container.querySelectorAll('.gs-photo-stage').forEach(button => button.addEventListener('click', function () {
            const fact = photoFacts[this.dataset.photoStage];
            if (!fact) return;
            container.querySelectorAll('.gs-photo-stage').forEach(item => {
                const active = item === this;
                item.classList.toggle('is-active', active);
                item.setAttribute('aria-pressed', active ? 'true' : 'false');
            });
            const title = container.querySelector('.gs-photo-fact-title');
            const body = container.querySelector('.gs-photo-fact-text');
            if (title) title.textContent = fact[0];
            if (body) body.textContent = fact[1];
            const scene = container.querySelector('.gs-photo-scene');
            if (scene) {
                scene.dataset.activeStage = this.dataset.photoStage;
                scene.classList.remove('gs-photo-pulse');
                void scene.offsetWidth;
                scene.classList.add('gs-photo-pulse');
            }
        }));
        const cellPhotoQuestions = lang()==='fr' ? [
          {q:'Quel organite contient la chlorophylle ?',a:['Le noyau','Le chloroplaste','La vacuole'],c:1,e:'Les chloroplastes contiennent les pigments chlorophylliens.'},
          {q:'Quel est le rôle principal de la paroi cellulosique ?',a:['Protéger et soutenir la cellule','Produire les protéines','Stocker l’ADN'],c:0,e:'La paroi donne une forme et une résistance à la cellule végétale.'},
          {q:'Quel gaz est utilisé pendant la photosynthèse ?',a:['Le dioxygène','Le dioxyde de carbone','L’azote'],c:1,e:'Le CO₂ est utilisé avec l’eau pour fabriquer de la matière organique.'},
          {q:'Quelle énergie alimente la photosynthèse ?',a:['L’énergie lumineuse','L’énergie sonore','La chaleur seule'],c:0,e:'La chlorophylle capte l’énergie lumineuse.'},
          {q:'Quel gaz est libéré pendant la photosynthèse ?',a:['Le dioxyde de carbone','Le méthane','Le dioxygène'],c:2,e:'Le dioxygène est libéré dans le milieu extérieur.'}
        ] : [
          {q:'ما العضية التي تحتوي على اليخضور؟',a:['النواة','البلاستيدة الخضراء','الفجوة العصارية'],c:1,e:'تحتوي البلاستيدات الخضراء على الأصباغ اليخضورية.'},
          {q:'ما الدور الأساسي للجدار السيليلوزي؟',a:['حماية الخلية ودعامتها','إنتاج البروتينات','تخزين ADN'],c:0,e:'يساهم الجدار في إعطاء الخلية النباتية شكلها ومقاومتها.'},
          {q:'ما الغاز المستعمل خلال التركيب الضوئي؟',a:['الأكسجين','ثاني أكسيد الكربون','الآزوت'],c:1,e:'يستعمل CO₂ مع الماء لإنتاج المادة العضوية.'},
          {q:'ما مصدر الطاقة الضروري للتركيب الضوئي؟',a:['الطاقة الضوئية','الطاقة الصوتية','الحرارة وحدها'],c:0,e:'يلتقط اليخضور الطاقة الضوئية.'},
          {q:'ما الغاز الذي ينطلق خلال التركيب الضوئي؟',a:['ثاني أكسيد الكربون','الميثان','الأكسجين'],c:2,e:'ينطلق غاز الأكسجين إلى الوسط الخارجي.'}
        ];
        const revisionRoot=container.querySelector('.gs-svt-revision-content');
        if(revisionRoot){
            let index=0,score=0,answered=false,mistakes=[],saved=false;
            const draw=()=>{
                if(index>=cellPhotoQuestions.length){
                    if(!saved){
                        saved=true;
                        try { saveQuizResult('cell-photosynthesis-revision',score,cellPhotoQuestions.length,mistakes,null,true); }
                        catch(error){ console.warn('[GoSVT] Revision result not saved:',error&&error.message); }
                    }
                    revisionRoot.innerHTML=`<div class="gs-svt-revision-result"><span>🌟</span><strong>${lang()==='fr'?'Résultat':'النتيجة'} : ${score}/5</strong><p>${score===5?(lang()==='fr'?'Bravo, sans faute !':'أحسنت! إجابات صحيحة بالكامل.'):lang()==='fr'?'Continuez à réviser pour renforcer vos acquis.':'واصل المراجعة لترسيخ مكتسباتك.'}</p><button type="button" data-svt-restart>${lang()==='fr'?'Rejouer':'إعادة التحدي'}</button></div>`;
                    return;
                }
                answered=false;
                const q=cellPhotoQuestions[index];
                revisionRoot.innerHTML=`<div class="gs-svt-revision-meta"><span>${lang()==='fr'?'Question':'السؤال'} ${index+1}/5</span><span>${lang()==='fr'?'Score':'النقاط'} : ${score}</span></div><div class="gs-svt-revision-track"><span style="width:${index/5*100}%"></span></div><h4>${q.q}</h4><div class="gs-svt-revision-options">${q.a.map((a,i)=>`<button type="button" data-svt-answer="${i}">${a}</button>`).join('')}</div><p class="gs-svt-revision-feedback" aria-live="polite"></p><button type="button" data-svt-next hidden>${index===4?(lang()==='fr'?'Voir le résultat':'عرض النتيجة'):(lang()==='fr'?'Continuer':'متابعة')}</button>`;
            };
            revisionRoot.addEventListener('click',event=>{
                const answer=event.target.closest('[data-svt-answer]');
                if(answer&&!answered){
                    answered=true;
                    const q=cellPhotoQuestions[index],choice=Number(answer.dataset.svtAnswer);
                    if(choice===q.c)score++;
                    else mistakes.push({question:q.q,selected:q.a[choice],correct:q.a[q.c]});
                    revisionRoot.querySelectorAll('[data-svt-answer]').forEach((button,i)=>{
                        button.disabled=true;
                        if(i===q.c)button.classList.add('is-correct');
                        else if(i===choice)button.classList.add('is-incorrect');
                    });
                    const feedback=revisionRoot.querySelector('.gs-svt-revision-feedback');
                    if(feedback)feedback.textContent=(choice===q.c?(lang()==='fr'?'Bonne réponse ! ':'إجابة صحيحة! '):(lang()==='fr'?'À revoir. ':'راجع هذه الإجابة. '))+q.e;
                    const next=revisionRoot.querySelector('[data-svt-next]');
                    if(next)next.hidden=false;
                }
                if(event.target.closest('[data-svt-next]')&&answered){index++;draw();}
                if(event.target.closest('[data-svt-restart]')){index=0;score=0;mistakes=[];saved=false;draw();}
            });
            draw();
        }
        const glossaryTerms = lang()==='fr' ? [
          ['Absorption intestinale','Passage des nutriments de l’intestin grêle vers le milieu intérieur.','Digestion'],
          ['Alvéole pulmonaire','Petite structure du poumon où se réalisent les échanges gazeux.','Respiration'],
          ['Biodiversité','Diversité des êtres vivants, des gènes et des écosystèmes.','Écologie'],
          ['Capillaire sanguin','Très petit vaisseau où se déroulent de nombreux échanges avec les tissus.','Circulation'],
          ['Chlorophylle','Pigment qui absorbe une partie de l’énergie lumineuse utilisée en photosynthèse.','Végétaux'],
          ['Chloroplaste','Organite des cellules végétales où se déroule la photosynthèse.','Cellule'],
          ['Enzyme','Molécule, généralement protéique, qui accélère une réaction biologique.','Digestion'],
          ['Écosystème','Ensemble formé par un milieu et les êtres vivants qui y interagissent.','Écologie'],
          ['Gène','Portion d’ADN portant une information héréditaire.','Génétique'],
          ['Hématie','Globule rouge spécialisé dans le transport des gaz respiratoires.','Sang'],
          ['Membrane plasmique','Enveloppe qui délimite la cellule et contrôle les échanges.','Cellule'],
          ['Métabolisme','Ensemble des réactions chimiques qui se déroulent dans une cellule ou un organisme.','Cellule'],
          ['Nutriment','Substance simple utilisable par l’organisme après la digestion ou directement absorbée.','Digestion'],
          ['Photosynthèse','Processus par lequel les organismes chlorophylliens produisent de la matière organique grâce à la lumière.','Végétaux'],
          ['Stomate','Pore de l’épiderme végétal participant aux échanges gazeux et à la transpiration.','Végétaux'],
          ['Synapse','Zone de communication fonctionnelle entre deux neurones ou entre un neurone et une cellule cible.','Nerfs']
        ] : [
          ['الامتصاص المعوي','انتقال المغذيات من الأمعاء الدقيقة إلى الوسط الداخلي.','الهضم'],
          ['السنخ الرئوي','بنية صغيرة في الرئة تتم على مستواها التبادلات الغازية.','التنفس'],
          ['التنوع الحيوي','تنوع الكائنات الحية والمورثات والأنظمة البيئية.','البيئة'],
          ['الشعيرة الدموية','وعاء دموي دقيق تتم عبر جداره مبادلات عديدة مع الأنسجة.','الدورة الدموية'],
          ['اليخضور','صبغة تمتص جزءاً من الطاقة الضوئية المستعملة في التركيب الضوئي.','النباتات'],
          ['البلاستيدة الخضراء','عضية في الخلايا النباتية تتم داخلها عملية التركيب الضوئي.','الخلية'],
          ['الإنزيم','جزيئة غالباً ما تكون بروتينية تسرّع تفاعلاً بيولوجياً.','الهضم'],
          ['النظام البيئي','مجموعة تضم وسطاً طبيعياً والكائنات الحية التي تتفاعل داخله.','البيئة'],
          ['المورثة','جزء من ADN يحمل معلومة وراثية.','الوراثة'],
          ['كرية الدم الحمراء','خلية دموية متخصصة في نقل الغازات التنفسية.','الدم'],
          ['الغشاء الهيولي','غلاف يحدد الخلية وينظم المبادلات بينها وبين الوسط.','الخلية'],
          ['الأيض','مجموع التفاعلات الكيميائية التي تحدث داخل الخلية أو الكائن الحي.','الخلية'],
          ['المغذي','مادة بسيطة يستعملها الجسم بعد الهضم أو يمتصها مباشرة.','الهضم'],
          ['التركيب الضوئي','عملية تنتج بها الكائنات اليخضورية مادة عضوية باستعمال الطاقة الضوئية.','النباتات'],
          ['الثغر','فتحة في بشرة الورقة تساهم في التبادلات الغازية والنتح.','النباتات'],
          ['المشبك العصبي','منطقة اتصال وظيفي بين عصبونين أو بين عصبون وخلية مستهدفة.','الجهاز العصبي']
        ];
        const glossaryRoot=container.querySelector('.gs-svt-glossary');
        if(glossaryRoot){
            const search=glossaryRoot.querySelector('.gs-svt-glossary-input');
            const results=glossaryRoot.querySelector('.gs-svt-glossary-results');
            const meta=glossaryRoot.querySelector('.gs-svt-glossary-meta');
            const renderGlossary=()=>{
                const query=search.value.trim().toLocaleLowerCase();
                const filtered=glossaryTerms.filter(term=>term.join(' ').toLocaleLowerCase().includes(query));
                meta.textContent=(lang()==='fr'?'Résultats : ':'النتائج: ')+filtered.length+' / '+glossaryTerms.length;
                results.innerHTML=filtered.length?filtered.map((term,index)=>`<article class="gs-svt-glossary-term"><div class="gs-svt-glossary-term-top"><h4>${term[0]}</h4><span>${term[2]}</span></div><p>${term[1]}</p></article>`).join(''):`<p class="gs-svt-glossary-empty">${lang()==='fr'?'Aucun terme trouvé. Essayez un autre mot.':'لم يتم العثور على مصطلح. جرب كلمة أخرى.'}</p>`;
            };
            search.addEventListener('input',renderGlossary);
            renderGlossary();
        }
        const memoryDeckData = lang()==='fr' ? [
          ['Cellule végétale','Quelle structure entoure la membrane et soutient la cellule ?','La paroi cellulosique, qui protège et soutient la cellule végétale.','🧫'],
          ['Chloroplaste','Quel pigment capte principalement l’énergie lumineuse ?','La chlorophylle, présente dans les membranes des thylakoïdes.','🍃'],
          ['Photosynthèse','Quels sont les deux réactifs minéraux de la photosynthèse ?','L’eau (H₂O) et le dioxyde de carbone (CO₂), en présence de lumière.','☀️'],
          ['Échanges gazeux','Où se déroulent les échanges gazeux dans les poumons ?','Au niveau des alvéoles pulmonaires, en contact avec les capillaires.','🫁'],
          ['Digestion','Où la majorité des nutriments sont-ils absorbés ?','Dans l’intestin grêle, à travers sa paroi riche en villosités.','🥗'],
          ['Circulation','Quel est le rôle principal du cœur ?','Propulser le sang dans les circuits pulmonaire et général.','❤️'],
          ['Système nerveux','Quel est le rôle de la moelle épinière ?','Transmettre les messages nerveux entre l’encéphale et les nerfs, et participer aux réflexes.','🧠'],
          ['Biodiversité','Que révèle l’étude des fossiles ?','Elle renseigne sur les êtres vivants du passé et l’évolution de la biodiversité.','🦴']
        ] : [
          ['الخلية النباتية','ما البنية التي تحيط بالغشاء وتدعم الخلية؟','الجدار السيليلوزي، الذي يحمي الخلية النباتية ويساهم في دعمها.','🧫'],
          ['البلاستيدة الخضراء','ما الصبغة التي تلتقط الطاقة الضوئية أساساً؟','اليخضور الموجود في أغشية التيلاكويدات.','🍃'],
          ['التركيب الضوئي','ما المادتان المعدنيتان الأوليتان في التركيب الضوئي؟','الماء H₂O وثاني أكسيد الكربون CO₂ بوجود الضوء.','☀️'],
          ['التبادلات الغازية','أين تتم التبادلات الغازية في الرئتين؟','على مستوى الأسناخ الرئوية المحاطة بالشعيرات الدموية.','🫁'],
          ['الهضم','أين يتم امتصاص معظم المغذيات؟','في الأمعاء الدقيقة عبر جدارها الغني بالزغابات المعوية.','🥗'],
          ['الدورة الدموية','ما الدور الأساسي للقلب؟','دفع الدم عبر الدورة الرئوية والدورة العامة.','❤️'],
          ['الجهاز العصبي','ما دور النخاع الشوكي؟','نقل الرسائل العصبية بين الدماغ وأعصاب الجسم والمساهمة في المنعكسات.','🧠'],
          ['التنوع الحيوي','ماذا تكشف دراسة المستحاثات؟','تقدم معلومات عن الكائنات الحية في الماضي وتطور التنوع الحيوي.','🦴']
        ];
        const memoryRoot=container.querySelector('.gs-memory-deck');
        if(memoryRoot){
            let memoryIndex=0,revealed=false;
            const updateMemoryCard=()=>{
                const card=memoryDeckData[memoryIndex];
                memoryRoot.querySelector('.gs-memory-category').textContent=card[0];
                memoryRoot.querySelector('.gs-memory-counter').textContent=(lang()==='fr'?'Carte':'بطاقة')+' '+(memoryIndex+1)+' / '+memoryDeckData.length;
                memoryRoot.querySelector('.gs-memory-art-icon').textContent=card[3];
                memoryRoot.querySelector('.gs-memory-question').textContent=card[1];
                const answer=memoryRoot.querySelector('.gs-memory-answer');
                answer.textContent=card[2];
                answer.hidden=!revealed;
                memoryRoot.querySelector('.gs-memory-reveal').textContent=revealed?(lang()==='fr'?'Masquer la réponse':'إخفاء الإجابة'):(lang()==='fr'?'Révéler la réponse':'اكشف الإجابة');
                const progress=memoryRoot.querySelector('.gs-memory-progress');
                progress.setAttribute('aria-valuenow',String(memoryIndex+1));
                progress.querySelector('span').style.width=((memoryIndex+1)/memoryDeckData.length*100)+'%';
                memoryRoot.querySelector('.gs-memory-prev').disabled=memoryIndex===0;
                memoryRoot.querySelector('.gs-memory-next').textContent=memoryIndex===memoryDeckData.length-1?(lang()==='fr'?'Recommencer':'من البداية')+' ↻':(lang()==='fr'?'Suivante':'التالية')+' →';
            };
            memoryRoot.addEventListener('click',event=>{
                if(event.target.closest('.gs-memory-reveal')){revealed=!revealed;updateMemoryCard();}
                if(event.target.closest('.gs-memory-prev')&&memoryIndex>0){memoryIndex--;revealed=false;updateMemoryCard();}
                if(event.target.closest('.gs-memory-next')){memoryIndex=memoryIndex===memoryDeckData.length-1?0:memoryIndex+1;revealed=false;updateMemoryCard();}
            });
            updateMemoryCard();
        }
        const anatomyFacts = {
          digestive: lang()==='fr'?['Système digestif','Transforme les aliments en nutriments absorbables.','Bouche → œsophage → estomac → intestin grêle → gros intestin.','Les nutriments traversent la paroi de l’intestin grêle et rejoignent le sang.']:['الجهاز الهضمي','يحول الأغذية إلى مغذيات قابلة للامتصاص.','الفم ← المريء ← المعدة ← الأمعاء الدقيقة ← الأمعاء الغليظة.','تعبر المغذيات جدار الأمعاء الدقيقة لتصل إلى الدم.'],
          respiratory: lang()==='fr'?['Système respiratoire','Assure les échanges gazeux entre l’air et le sang.','Fosses nasales → trachée → bronches → bronchioles → alvéoles.','Au niveau des alvéoles, le dioxygène diffuse vers le sang et le CO₂ en sort.']:['الجهاز التنفسي','يضمن التبادلات الغازية بين الهواء والدم.','التجاويف الأنفية ← القصبة الهوائية ← الشعب ← القصيبات ← الأسناخ الرئوية.','على مستوى الأسناخ ينتشر الأكسجين نحو الدم ويغادره ثاني أكسيد الكربون.'],
          circulatory: lang()==='fr'?['Système circulatoire','Transporte les gaz, nutriments et autres substances dans l’organisme.','Cœur + artères + capillaires + veines.','Le cœur propulse le sang dans deux circuits complémentaires : pulmonaire et général.']:['الجهاز الدوري','ينقل الغازات والمغذيات ومواد أخرى داخل الجسم.','القلب + الشرايين + الشعيرات الدموية + الأوردة.','يدفع القلب الدم عبر دورتين متكاملتين: الدورة الرئوية والدورة العامة.'],
          nervous: lang()==='fr'?['Système nerveux','Reçoit, traite et transmet les messages nerveux.','Encéphale + moelle épinière + nerfs.','Les organes sensoriels détectent les stimuli ; les centres nerveux élaborent des réponses.']:['الجهاز العصبي','يستقبل الرسائل العصبية ويعالجها وينقلها.','الدماغ + النخاع الشوكي + الأعصاب.','تلتقط الأعضاء الحسية المنبهات، وتعالج المراكز العصبية المعلومات وتعد الاستجابات.'],
          urinary: lang()==='fr'?['Système urinaire','Filtre le sang et participe à l’équilibre hydrique et minéral.','Reins + uretères + vessie + urètre.','Les reins produisent l’urine ; les uretères la conduisent vers la vessie.']:['الجهاز البولي','يرشح الدم ويساهم في توازن الماء والأملاح المعدنية.','الكليتان + الحالبان + المثانة + الإحليل.','تنتج الكليتان البول الذي ينتقل عبر الحالبين إلى المثانة.'],
          skeletal: lang()==='fr'?['Système squelettique','Soutient le corps, protège certains organes et participe aux mouvements.','Os + articulations + cartilages.','Les muscles agissent sur les os au niveau des articulations pour produire les mouvements.']:['الجهاز الهيكلي','يدعم الجسم ويحمي بعض الأعضاء ويساهم في الحركة.','العظام + المفاصل + الغضاريف.','تؤثر العضلات في العظام عند المفاصل لإحداث الحركة.']
        };
        container.querySelectorAll('.gs-anatomy-tab').forEach(button => button.addEventListener('click', function () {
            const fact = anatomyFacts[this.dataset.anatomySystem];
            if (!fact) return;
            container.querySelectorAll('.gs-anatomy-photo-card').forEach(card => {
                const activePhoto = card.dataset.anatomyPhoto === this.dataset.anatomySystem;
                card.classList.toggle('is-active', activePhoto);
                card.setAttribute('aria-pressed', activePhoto ? 'true' : 'false');
            });
            container.querySelectorAll('.gs-anatomy-tab').forEach(item => {
                const active = item === this;
                item.classList.toggle('is-active', active);
                item.setAttribute('aria-pressed', active ? 'true' : 'false');
            });
            const fields = ['.gs-anatomy-name','.gs-anatomy-function','.gs-anatomy-organs','.gs-anatomy-fact'];
            fields.forEach((selector,index) => {
                const element = container.querySelector(selector);
                if (element) element.textContent = fact[index];
            });
        }));
        const atlasQuiz = lang()==='fr' ? [
          {q:'Quel organe absorbe la majorité des nutriments ?',a:['L’estomac','L’intestin grêle','Le gros intestin'],c:1,e:'La paroi de l’intestin grêle assure l’essentiel de l’absorption des nutriments.'},
          {q:'Où se déroulent les échanges gazeux pulmonaires ?',a:['Dans les alvéoles','Dans la trachée','Dans le diaphragme'],c:0,e:'Les alvéoles offrent une grande surface d’échange avec les capillaires sanguins.'},
          {q:'Quel organe propulse le sang ?',a:['Le foie','Le poumon','Le cœur'],c:2,e:'Le cœur est une pompe musculaire qui propulse le sang dans les vaisseaux.'},
          {q:'Quelle structure relie l’encéphale aux nerfs du corps ?',a:['La moelle épinière','L’œsophage','La trachée'],c:0,e:'La moelle épinière appartient au système nerveux central et communique avec les nerfs.'},
          {q:'Quel organe produit l’urine ?',a:['La vessie','Les reins','Les uretères'],c:1,e:'Les reins filtrent le sang et produisent l’urine.'},
          {q:'Quel ensemble protège notamment le cerveau ?',a:['La cage thoracique','Le bassin','Le crâne'],c:2,e:'Le crâne entoure et protège l’encéphale.'}
        ] : [
          {q:'ما العضو الذي يمتص معظم المغذيات؟',a:['المعدة','الأمعاء الدقيقة','الأمعاء الغليظة'],c:1,e:'يتم معظم امتصاص المغذيات عبر جدار الأمعاء الدقيقة.'},
          {q:'أين تتم التبادلات الغازية الرئوية؟',a:['في الأسناخ الرئوية','في القصبة الهوائية','في الحجاب الحاجز'],c:0,e:'توفر الأسناخ الرئوية سطحاً واسعاً للتبادل مع الشعيرات الدموية.'},
          {q:'ما العضو الذي يدفع الدم داخل الأوعية؟',a:['الكبد','الرئة','القلب'],c:2,e:'القلب مضخة عضلية تدفع الدم عبر الأوعية الدموية.'},
          {q:'ما البنية التي تصل الدماغ بأعصاب الجسم؟',a:['النخاع الشوكي','المريء','القصبة الهوائية'],c:0,e:'ينتمي النخاع الشوكي إلى الجهاز العصبي المركزي ويتواصل مع الأعصاب.'},
          {q:'ما العضو الذي ينتج البول؟',a:['المثانة','الكليتان','الحالبان'],c:1,e:'ترشح الكليتان الدم وتنتجان البول.'},
          {q:'ما الجزء الذي يحمي الدماغ؟',a:['القفص الصدري','الحوض','الجمجمة'],c:2,e:'تحيط الجمجمة بالدماغ وتوفر له الحماية.'}
        ];
        const quizRoot = container.querySelector('.gs-atlas-quiz-content');
        if (quizRoot) {
            let quizIndex = 0, quizScore = 0, quizAnswered = false, quizMistakes = [], quizSaved = false;
            const renderQuizStep = () => {
                if (quizIndex >= atlasQuiz.length) {
                    if (!quizSaved) {
                        quizSaved = true;
                        try { saveQuizResult('human-systems-atlas', quizScore, atlasQuiz.length, quizMistakes, null, true); }
                        catch (error) { console.warn('[GoSVT] Atlas result not saved:', error && error.message); }
                    }
                    quizRoot.innerHTML = `<div class="gs-atlas-quiz-result"><span aria-hidden="true">🏅</span><strong>${lang()==='fr'?'Votre résultat':'نتيجتك'} : ${quizScore}/${atlasQuiz.length}</strong><p>${quizScore===atlasQuiz.length?(lang()==='fr'?'Excellent ! Toutes les réponses sont correctes.':'ممتاز! جميع إجاباتك صحيحة.'):lang()==='fr'?'Relisez les explications et réessayez pour progresser.':'راجع الشروحات وحاول مجدداً لتحسين نتيجتك.'}</p><button type="button" class="gs-atlas-quiz-restart">${lang()==='fr'?'Recommencer':'إعادة المحاولة'}</button></div>`;
                    return;
                }
                const question = atlasQuiz[quizIndex];
                quizAnswered = false;
                quizRoot.innerHTML = `<div class="gs-atlas-quiz-progress"><span>${lang()==='fr'?'Question':'السؤال'} ${quizIndex+1}/${atlasQuiz.length}</span><span>${lang()==='fr'?'Score':'النقاط'} : ${quizScore}</span></div><div class="gs-atlas-quiz-track"><span style="width:${(quizIndex/atlasQuiz.length)*100}%"></span></div><h5 class="gs-atlas-question">${question.q}</h5><div class="gs-atlas-options">${question.a.map((answer,i)=>`<button type="button" class="gs-atlas-option" data-atlas-answer="${i}">${answer}</button>`).join('')}</div><div class="gs-atlas-feedback" aria-live="polite"></div><button type="button" class="gs-atlas-next" hidden>${quizIndex===atlasQuiz.length-1?(lang()==='fr'?'Voir le résultat':'عرض النتيجة'):(lang()==='fr'?'Question suivante':'السؤال التالي')}</button>`;
            };
            quizRoot.addEventListener('click',event=>{
                const answerButton=event.target.closest('[data-atlas-answer]');
                if(answerButton && !quizAnswered){
                    quizAnswered=true;
                    const selected=Number(answerButton.dataset.atlasAnswer),question=atlasQuiz[quizIndex],correct=selected===question.c;
                    if(correct) quizScore++;
                    else quizMistakes.push({question:question.q,selected:question.a[selected],correct:question.a[question.c]});
                    quizRoot.querySelectorAll('.gs-atlas-option').forEach((option,i)=>{
                        option.disabled=true;
                        if(i===question.c) option.classList.add('is-correct');
                        else if(i===selected) option.classList.add('is-incorrect');
                    });
                    const feedback=quizRoot.querySelector('.gs-atlas-feedback');
                    if(feedback) feedback.textContent=(correct?(lang()==='fr'?'Bonne réponse ! ':'إجابة صحيحة! '):(lang()==='fr'?'Pas tout à fait. ':'ليست الإجابة الصحيحة. '))+question.e;
                    const next=quizRoot.querySelector('.gs-atlas-next');
                    if(next) next.hidden=false;
                }
                if(event.target.closest('.gs-atlas-next') && quizAnswered){quizIndex++;renderQuizStep();}
                if(event.target.closest('.gs-atlas-quiz-restart')){quizIndex=0;quizScore=0;quizMistakes=[];quizSaved=false;renderQuizStep();}
            });
            renderQuizStep();
        }
        bindPlannerAndNotes(container);
        bindFavoritesPanel(container.querySelector('#panel-favorites'));
        hydrateDailyChallenge();
        container.querySelectorAll('.gs-daily-option').forEach(button => {
            button.addEventListener('click', function () { answerDailyChallenge(this.dataset.dailyOption, this); });
        });

        // Add event listeners
        container.querySelectorAll('.space-tab').forEach(tab => {
            tab.addEventListener('click', function() {
                const tabName = this.dataset.tab;

                // Favorites may have changed since the student space was rendered.
                if (tabName === 'favorites') {
                    const favoritesPanel = container.querySelector('#panel-favorites');
                    if (favoritesPanel) {
                        favoritesPanel.innerHTML = renderFavorites();
                        bindFavoritesPanel(favoritesPanel);
                    }
                }

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

        // Retry mistakes
        container.querySelectorAll('.btn-retry-mistakes').forEach(btn => {
            btn.addEventListener('click', function() {
                const quizId = this.dataset.quizId;
                retryMistakes(quizId);
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

        .gs-student-level{display:flex;align-items:center;gap:.45rem;flex-wrap:wrap;padding:.75rem 1rem;margin:.8rem 0 1rem;border:1px solid #dcebd5;border-radius:10px;background:#f5faf1;color:#315b31}
        .gs-student-level strong{font-weight:800}
        .gs-student-welcome{display:flex;align-items:center;justify-content:space-between;gap:1.5rem;padding:1.6rem 1.8rem;margin-bottom:1.5rem;border-radius:18px;background:linear-gradient(120deg,#edf6e9,#f4f8ef);border:1px solid #dcebd5}
        .gs-student-welcome h2{margin:.4rem 0;color:#244d27;font-size:1.5rem}.gs-student-welcome p{margin:.3rem 0;color:#526451}
        .gs-eyebrow{font-size:.72rem;letter-spacing:.08em;font-weight:700;color:#54834c}
        .gs-primary-link{display:inline-block;background:#2d5a27;color:#fff!important;text-decoration:none;padding:.8rem 1.1rem;border-radius:10px;white-space:nowrap;font-weight:700}
        .gs-section-title{margin:1.4rem 0 .8rem;color:#294d2b}
        .gs-quick-links{display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:.8rem;margin-bottom:1.4rem}
        .gs-quick-links a{display:flex;align-items:center;gap:.65rem;padding:1rem;background:#fff;border:1px solid #e5ebdf;border-radius:12px;text-decoration:none;color:#294d2b;font-weight:600;box-shadow:0 2px 8px rgba(0,0,0,.04)}
        .gs-quick-links a span{font-size:1.35rem}
        .gs-module{background:#fff;border:1px solid #e6e9e2;border-radius:16px;padding:1.3rem;box-shadow:0 3px 12px rgba(0,0,0,.04)}
        .gs-entry-form,.gs-note-form{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:.8rem;align-items:end;padding:1rem;background:#f7faf5;border-radius:12px;margin:1rem 0}
        .gs-entry-form label,.gs-note-form label{display:flex;flex-direction:column;gap:.35rem;font-weight:600;color:#425442}
        .gs-entry-form input,.gs-note-form input,.gs-note-form textarea{width:100%;box-sizing:border-box;padding:.7rem;border:1px solid #d8dfd3;border-radius:8px;font:inherit;background:#fff}
        .gs-entry-form button,.gs-note-form button{padding:.75rem 1rem;border:0;border-radius:8px;background:#2d5a27;color:#fff;font:inherit;font-weight:700;cursor:pointer}
        .gs-plan-item{display:flex;align-items:center;gap:1rem;padding:.85rem;border-bottom:1px solid #edf0ea}
        .gs-plan-item.is-done{opacity:.65}.gs-plan-item.is-done .gs-plan-main strong{text-decoration:line-through}
        .gs-plan-date{min-width:112px;color:#477344;font-weight:700}.gs-plan-main{display:flex;flex:1;flex-direction:column;gap:.2rem}.gs-plan-main small,.gs-note-card small{color:#788274}
        .gs-plan-actions{display:flex;gap:.4rem}.gs-plan-actions button,.gs-note-heading button{border:0;border-radius:7px;padding:.45rem .7rem;cursor:pointer;background:#eaf2e7;color:#285329;font-weight:700}
        .gs-plan-actions .gs-task-delete,.gs-note-heading button{background:#fff0ee;color:#a33}
        .gs-notes-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:.8rem}
        .gs-note-card{padding:1rem;border:1px solid #e5eadf;border-radius:12px;background:#fff;min-width:0}
        .gs-note-heading{display:flex;align-items:center;justify-content:space-between;gap:.5rem}.gs-note-card p{white-space:normal;overflow-wrap:anywhere;line-height:1.7}
        /* Modern learning dashboard refresh */
        .student-space{max-width:1280px;padding:clamp(1rem,2.5vw,2rem);color:#20352c}
        .space-nav{position:relative;gap:.55rem;padding:.55rem;margin:0 0 1.35rem;background:#f4f7f2;border:1px solid #e5ece3;border-radius:16px;overflow-x:auto;flex-wrap:nowrap;scrollbar-width:thin}
        .space-tab{flex:0 0 auto;padding:.72rem 1.05rem;border:1px solid transparent;border-radius:11px;background:transparent;color:#52665a;white-space:nowrap}
        .space-tab:hover{background:#e8f0e5;transform:translateY(-1px)}
        .space-tab.active{background:linear-gradient(135deg,#236b43,#174c35);color:#fff;box-shadow:0 5px 14px rgba(28,91,57,.2)}
        .gs-student-welcome{position:relative;overflow:hidden;min-height:180px;padding:clamp(1.4rem,3vw,2.2rem);border:0;border-radius:22px;background:radial-gradient(circle at 12% 15%,rgba(255,255,255,.22),transparent 27%),linear-gradient(115deg,#123f35 0%,#236b4b 58%,#6b9c56 100%);box-shadow:0 12px 30px rgba(27,82,57,.15);color:#fff}
        .gs-student-welcome:after{content:"🧬";position:absolute;right:8%;bottom:-30px;font-size:9rem;opacity:.10;transform:rotate(-18deg);pointer-events:none}
        [dir="rtl"] .gs-student-welcome:after{right:auto;left:8%}
        .gs-student-welcome h2{position:relative;z-index:1;margin:.5rem 0;color:#fff;font-size:clamp(1.3rem,2.6vw,1.9rem);line-height:1.5}
        .gs-student-welcome p{position:relative;z-index:1;max-width:680px;color:rgba(255,255,255,.86);line-height:1.9}
        .gs-eyebrow{color:#c8e8b7;letter-spacing:.07em}
        .gs-primary-link{position:relative;z-index:2;background:#fff;color:#19553a!important;border-radius:12px;padding:.85rem 1.2rem;box-shadow:0 5px 14px rgba(0,0,0,.12);transition:transform .2s,box-shadow .2s}
        .gs-primary-link:hover{transform:translateY(-2px);box-shadow:0 8px 18px rgba(0,0,0,.18)}
        .gs-welcome-tags{display:flex;flex-wrap:wrap;gap:.5rem;margin-top:1rem}
        .gs-welcome-tags span{padding:.35rem .75rem;border:1px solid rgba(255,255,255,.25);border-radius:99px;background:rgba(255,255,255,.12);font-size:.83rem;color:#fff}
        .gs-learning-path{margin:1.2rem 0 1.5rem;padding:1.2rem;border:1px solid #e4ece1;border-radius:19px;background:linear-gradient(145deg,#fff,#f7faf5)}
        .gs-path-heading{display:flex;justify-content:space-between;align-items:center;gap:1rem;margin-bottom:1rem}
        .gs-path-heading h3{margin:.25rem 0;color:#244d37;font-size:1.12rem}
        .gs-path-mark{font-size:2rem}
        .gs-path-steps{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:.75rem}
        .gs-path-steps a{display:flex;min-width:0;flex-direction:column;gap:.35rem;padding:1rem;border:1px solid #e7eee4;border-radius:14px;background:#fff;color:#294b37;text-decoration:none;transition:transform .2s,border-color .2s,box-shadow .2s}
        .gs-path-steps a:hover{transform:translateY(-3px);border-color:#a8c9a2;box-shadow:0 8px 18px rgba(37,83,49,.09)}
        .gs-path-icon{display:grid;place-items:center;width:40px;height:40px;border-radius:12px;background:#edf6e9;font-size:1.35rem}
        .gs-path-steps strong{font-size:.96rem}.gs-path-steps small{color:#718074;line-height:1.5}
        .gs-section-title{margin:1.6rem 0 .85rem;color:#244d37;font-size:1.12rem}
        .gs-quick-links a{border-radius:14px;transition:transform .2s,border-color .2s,box-shadow .2s}
        .gs-quick-links a:hover{transform:translateY(-3px);border-color:#b7d1b0;box-shadow:0 8px 18px rgba(37,83,49,.09)}
        .dashboard-grid{gap:.85rem}
        .stat-card{position:relative;overflow:hidden;border:1px solid #e8eee5;border-radius:16px;box-shadow:0 4px 14px rgba(24,57,37,.055);transition:transform .2s,box-shadow .2s}
        .stat-card:hover{transform:translateY(-3px);box-shadow:0 9px 20px rgba(24,57,37,.10)}
        .stat-icon{display:inline-grid;place-items:center;width:48px;height:48px;border-radius:14px;background:#eff6ec}
        .stat-value{color:#236b43}
        .space-content{animation:gsSpaceIn .28s ease both}
        .space-panel.active{animation:gsSpaceIn .25s ease both}
        .gs-module,.progress-section,.history-list,.mistakes-list,.favorites-list{border:1px solid #e8eee5;border-radius:16px;box-shadow:0 4px 14px rgba(24,57,37,.045)}
        .gs-daily-challenge{margin:1.35rem 0;padding:1.25rem;border:1px solid #dce9d8;border-radius:18px;background:linear-gradient(145deg,#f7fbf5,#fff);box-shadow:0 5px 18px rgba(24,57,37,.045)}
        .gs-daily-head{display:flex;align-items:flex-start;justify-content:space-between;gap:1rem}.gs-daily-head h3{margin:.3rem 0;color:#244d37;font-size:1.15rem}.gs-daily-head p{margin:.25rem 0;color:#718074;font-size:.88rem;line-height:1.6}
        .gs-daily-points{flex:0 0 auto;padding:.55rem .8rem;border-radius:12px;background:#edf5e9;color:#32633b;font-size:.85rem;white-space:nowrap}
        .gs-daily-question{margin:1rem 0 .8rem;padding:1rem;border-radius:13px;background:#fff;border:1px solid #e7eee4}.gs-daily-question>span{font-size:.7rem;font-weight:700;color:#71906d}.gs-daily-question h4{margin:.4rem 0 0;color:#294d36;line-height:1.8;font-size:1rem}
        .gs-daily-options{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.65rem}.gs-daily-option{display:flex;align-items:center;gap:.7rem;padding:.8rem;border:1px solid #e1e9dd;border-radius:11px;background:#fff;color:#304b38;text-align:start;font:inherit;cursor:pointer;transition:border-color .2s,transform .2s}.gs-daily-option:hover:not(:disabled){border-color:#78a875;transform:translateY(-2px)}.gs-daily-option:disabled{opacity:.65;cursor:default}.gs-daily-option span{display:grid;place-items:center;flex:0 0 29px;width:29px;height:29px;border-radius:9px;background:#edf5e9;color:#32633b;font-weight:700}
        .gs-daily-hint,.gs-daily-message{margin:.7rem 0 0;color:#788274;font-size:.8rem}.gs-daily-result{padding:1rem;border-radius:12px;background:#f5f8f3;border:1px solid #dce9d8}.gs-daily-result.is-correct{background:#f0f8ed;border-color:#cce3c5}.gs-daily-result.is-wrong{background:#fff8ed;border-color:#f0dfc4}.gs-daily-result strong{color:#285c36}.gs-daily-result p{margin:.4rem 0;color:#425442}.gs-daily-result small{display:block;line-height:1.7;color:#596b59}.gs-daily-result span{display:block;margin-top:.6rem;font-size:.78rem;color:#718074}
        @media(max-width:560px){.gs-daily-head{flex-direction:column}.gs-daily-options{grid-template-columns:1fr}.gs-daily-points{align-self:flex-start}}
        .gs-achievements{margin-top:1.5rem;padding:1.25rem;background:linear-gradient(135deg,#f7fbf5,#fff);border:1px solid #e2ecdf;border-radius:18px}
        .gs-achievements-heading{display:flex;align-items:center;justify-content:space-between;gap:1rem;margin-bottom:1rem}
        .gs-achievements-heading h3{margin:.25rem 0;color:#244d37;font-size:1.15rem}
        .gs-achievements-heading p{margin:0;color:#718074;font-size:.88rem}
        .gs-achievements-count{flex:0 0 auto;display:flex;flex-direction:column;align-items:center;padding:.55rem .9rem;background:#eaf4e7;border-radius:13px;color:#28623e}
        .gs-achievements-count strong{font-size:1.25rem}.gs-achievements-count small{font-size:.72rem}
        .gs-badges-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:.75rem}
        .gs-badge-card{display:flex;align-items:center;gap:.8rem;min-width:0;padding:.85rem;background:#fff;border:1px solid #e5ece2;border-radius:14px}
        .gs-badge-card.is-earned{border-color:#c9dfc4;background:#fbfef9}
        .gs-badge-card.is-locked{opacity:.78}
        .gs-badge-icon{display:grid;place-items:center;flex:0 0 46px;width:46px;height:46px;border-radius:13px;background:#eef5eb;font-size:1.55rem;filter:grayscale(.75)}
        .gs-badge-card.is-earned .gs-badge-icon{background:#e3f2dd;filter:none}
        .gs-badge-copy{display:flex;flex:1;min-width:0;flex-direction:column;gap:.2rem}
        .gs-badge-copy strong{color:#294d36;font-size:.9rem}
        .gs-badge-copy small{color:#718074;font-size:.76rem;line-height:1.45}
        .gs-badge-status{color:#56805b;font-size:.72rem;font-weight:700}
        .gs-badge-card.is-locked .gs-badge-status{color:#8b9188}
        .gs-badge-track{height:5px;overflow:hidden;background:#edf0eb;border-radius:8px}
        .gs-badge-track i{display:block;height:100%;background:#78ad70;border-radius:8px}
        @media(max-width:520px){.gs-achievements{padding:.9rem}.gs-achievements-heading{align-items:flex-start}.gs-badges-grid{grid-template-columns:1fr}}
        @keyframes gsSpaceIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        @media(max-width:800px){.gs-path-steps{grid-template-columns:repeat(2,minmax(0,1fr))}}
        @media(max-width:520px){.gs-path-steps{grid-template-columns:1fr 1fr}.gs-path-steps a{padding:.8rem}.gs-student-welcome:after{font-size:6rem;right:2%}[dir="rtl"] .gs-student-welcome:after{right:auto;left:2%}}
        @media (max-width: 768px) {
            .gs-student-welcome{align-items:flex-start;flex-direction:column}
            .gs-plan-item{align-items:flex-start;flex-wrap:wrap}
            .gs-plan-date{min-width:100%}
            .gs-entry-form,.gs-note-form{grid-template-columns:1fr}

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
        // Profil / progression modifiés depuis un autre onglet -> resynchroniser et réafficher
        window.addEventListener('storage', function (e) {
            if (!e.key || e.key === STORAGE_KEYS.CURRENT_PROFILE || e.key.endsWith('_' + STORAGE_KEYS.PROGRESS)) {
                syncCurrentProfile();
                refreshStudentSpaceView();
            }
        });

        // Listen for hash changes to render student space when navigated to
        window.addEventListener('hashchange', function() {
            const hash = window.location.hash.substring(1);
            if (hash === 'student-space') {
                setTimeout(function() {
                    renderStudentSpace();
                }, 100);
            }
        });

        // Check hash on initial load
        const initialHash = window.location.hash.substring(1);
        if (initialHash === 'student-space') {
            setTimeout(function() {
                renderStudentSpace();
            }, 100);
        }

        // Observe the student-space section for class changes (when it becomes active)
        const sectionObserver = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.target.id === 'student-space' && 
                    mutation.target.classList.contains('active')) {
                    setTimeout(function() {
                        renderStudentSpace();
                    }, 50);
                }
            });
        });

        const studentSpaceSection = document.getElementById('student-space');
        if (studentSpaceSection) {
            sectionObserver.observe(studentSpaceSection, { attributes: true, attributeFilter: ['class'] });
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
        renderStudentSpace,
        refresh: refreshStudentSpaceView,
        createProfile,
        deleteProfile,
        switchProfile,
        getCurrentProfile,
        getProfiles,
        getProfileData,
        mergeCloudProgress,
        mergeCloudCollections,
        mergeCloudQuizAttempts,
        exportProfileData,
        importProfileData,
        retryMistakes
    };

})();
