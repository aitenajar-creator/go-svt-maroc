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
        return {
            progress: progress,
            quizResults: Array.isArray(results) ? results : [],
            mistakes: Array.isArray(mistakes) ? mistakes : [],
            streak: streak && typeof streak === 'object' ? streak : { current: 0, best: 0, lastVisit: null },
            goals: Array.isArray(goals) ? goals : [],
            notes: Array.isArray(notes) ? notes.filter(n => n && typeof n === 'object') : [],
            studyPlan: Array.isArray(studyPlan) ? studyPlan.filter(item => item && typeof item === 'object') : []
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

    function saveProfileData(profileId, data) {
        const prefix = profileId + '_';
        storage.set(prefix + STORAGE_KEYS.PROGRESS, data.progress);
        storage.set(prefix + STORAGE_KEYS.QUIZ_RESULTS, data.quizResults);
        storage.set(prefix + STORAGE_KEYS.MISTAKES, data.mistakes);
        storage.set(prefix + STORAGE_KEYS.STREAK, data.streak);
        storage.set(prefix + STORAGE_KEYS.GOALS, data.goals);
        storage.set(prefix + STORAGE_KEYS.NOTES, Array.isArray(data.notes) ? data.notes : []);
        storage.set(prefix + STORAGE_KEYS.STUDY_PLAN, Array.isArray(data.studyPlan) ? data.studyPlan : []);
        // Keep a local offline cache and synchronize the signed-in student's data.
        if (window.GoSVTCloud) {
            const jobs = [
                ['progress', 'syncProgress', data.progress],
                ['notes', 'syncNotes', data.notes],
                ['study plan', 'syncStudyPlan', data.studyPlan]
            ];
            jobs.forEach(function (job) {
                if (typeof window.GoSVTCloud[job[1]] !== 'function') return;
                Promise.resolve().then(function () {
                    return window.GoSVTCloud[job[1]](job[2]);
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
        if (container.querySelector('.gs-auth')) return;      // écran de connexion : ne pas effacer la saisie
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
    function saveQuizResult(quizId, score, totalQuestions, mistakes, attemptId) {
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
        refreshStudentSpaceView();
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
                <div><span class="gs-eyebrow">GO SVT MAROC · ESPACE ÉLÈVE</span><h2>${t('welcome')}</h2>
                <p>${lang() === 'ar' ? 'تعلم، تدرب، نظم وقتك، وتابع تطورك خطوة بخطوة.' : 'Apprenez, entraînez-vous et suivez vos progrès à votre rythme.'}</p></div>
                <a class="gs-primary-link" href="#cours">${t('continueLearning')} ←</a>
            </section>
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
                        <span class="history-quiz">${escapeHtml(r.quizId)}</span>
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
            html += `
                <div class="mistake-quiz-group">
                    <div class="mistake-quiz-header">
                        <span>Quiz: ${escapeHtml(quizId)}</span>
                        <button class="btn-retry-mistakes" data-quiz-id="${escapeHtml(quizId)}">${t('retryMistakes')}</button>
                    </div>
                    ${quizMistakes.map(mistake => `
                        <div class="mistake-item">
                            <div class="mistake-question">${escapeHtml(mistake.question || 'Question')}</div>
                            <div class="mistake-details">
                                <span class="mistake-quiz">${escapeHtml(mistake.quizId)}</span>
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
        const profileData = getProfileData(currentProfileId);
        const quizMistakes = profileData.mistakes.filter(m => m.quizId === quizId);
        
        if (quizMistakes.length === 0) return;

        // Store mistakes for retry in sessionStorage
        try {
            sessionStorage.setItem('gosvt_retry_mistakes', JSON.stringify(quizMistakes));
        } catch (e) {
            console.error('Impossible de préparer la reprise des erreurs:', e);
            alert(t('invalidFile'));
            return;
        }
        
        // Navigate to quiz section (this assumes quiz is accessible via hash)
        window.location.hash = 'quiz';
        
        // Show alert to user
        alert(t('mistakesLoaded'));
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
                storage.set('gosvt-favs', favs.filter(item => item !== path));
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
        const items = [...data.studyPlan].sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
        const rows = items.map(item => `
            <article class="gs-plan-item ${item.completed ? 'is-done' : ''}">
                <div class="gs-plan-date">${escapeHtml(item.date || '')}</div>
                <div class="gs-plan-main"><strong>${escapeHtml(item.title || '')}</strong>
                    <small>${Number(item.duration) || 30} ${lang() === 'ar' ? 'دقيقة' : 'min'} · ${item.completed ? t('done') : t('pending')}</small></div>
                <div class="gs-plan-actions">
                    <button type="button" class="gs-task-toggle" data-task-id="${escapeHtml(item.id)}">${item.completed ? '↩' : '✓'}</button>
                    <button type="button" class="gs-task-delete" data-task-id="${escapeHtml(item.id)}" aria-label="${t('delete')}">×</button>
                </div>
            </article>`).join('');
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
                window.GoSVTCloud.deleteStudyPlanItem(deletedId).catch(err => console.warn('[GoSVT] Cloud planner delete deferred:', err && err.message));
            }
            refreshStudentSpaceView();
        }));
        container.querySelectorAll('.gs-note-delete').forEach(button => button.addEventListener('click', function () {
            const data = getProfileData(currentProfileId);
            const deletedId = this.dataset.noteId;
            data.notes = data.notes.filter(x => x.id !== deletedId);
            saveProfileData(currentProfileId, data);
            if (window.GoSVTCloud && typeof window.GoSVTCloud.deleteNote === 'function') {
                window.GoSVTCloud.deleteNote(deletedId).catch(err => console.warn('[GoSVT] Cloud note delete deferred:', err && err.message));
            }
            refreshStudentSpaceView();
        }));
    }

    function renderStudentSpace() {
        const container = document.getElementById('student-space-content');
        if (!container) return;
        if (window.StudentAccount && !window.StudentAccount.isLoggedIn()) {
            window.StudentAccount.renderGate(container);
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
        bindPlannerAndNotes(container);
        bindFavoritesPanel(container.querySelector('#panel-favorites'));

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
        exportProfileData,
        importProfileData,
        retryMistakes
    };

})();
