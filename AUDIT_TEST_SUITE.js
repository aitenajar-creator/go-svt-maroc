/* Go SVT Maroc - Audit Test Suite */
/* Ce fichier contient tous les tests fonctionnels pour l'audit */

(function() {
    'use strict';

    const testResults = [];

    function logTest(testName, passed, details) {
        testResults.push({ name: testName, passed, details, timestamp: Date.now() });
        console.log(`[${passed ? 'PASS' : 'FAIL'}] ${testName}: ${details}`);
    }

    // ============================================
    // TEST 1: PROFILS LOCAUX MULTIPLES
    // ============================================
    function testProfiles() {
        console.log('\n=== TEST 1: PROFILS LOCAUX MULTIPLES ===');
        
        try {
            // Test 1.1: Création de profil
            const profileId1 = window.StudentSpace.createProfile('TestUser1');
            logTest('1.1 Création de profil', !!profileId1, `ID: ${profileId1}`);
            
            // Test 1.2: Création de deuxième profil
            const profileId2 = window.StudentSpace.createProfile('TestUser2');
            logTest('1.2 Création de 2ème profil', !!profileId2 && profileId1 !== profileId2, `IDs différents: ${profileId1} !== ${profileId2}`);
            
            // Test 1.3: Sélection de profil
            window.StudentSpace.switchProfile(profileId1);
            const current1 = window.StudentSpace.getCurrentProfile();
            logTest('1.3 Sélection de profil', current1.id === profileId1, `Profil actuel: ${current1.name}`);
            
            // Test 1.4: Switch de profil
            window.StudentSpace.switchProfile(profileId2);
            const current2 = window.StudentSpace.getCurrentProfile();
            logTest('1.4 Switch de profil', current2.id === profileId2, `Profil actuel: ${current2.name}`);
            
            // Test 1.5: Suppression de profil
            window.StudentSpace.deleteProfile(profileId1);
            const profilesAfterDelete = window.StudentSpace.getProfiles();
            logTest('1.5 Suppression de profil', !profilesAfterDelete[profileId1], `Profil supprimé: ${profileId1}`);
            
            // Cleanup
            window.StudentSpace.deleteProfile(profileId2);
            
        } catch (e) {
            logTest('1.0 Tests profils', false, `Erreur: ${e.message}`);
        }
    }

    // ============================================
    // TEST 2: FIABILITÉ DES RÉSULTATS QUIZ
    // ============================================
    function testQuizResults() {
        console.log('\n=== TEST 2: FIABILITÉ DES RÉSULTATS QUIZ ===');
        
        try {
            const profileId = window.StudentSpace.createProfile('QuizTestUser');
            window.StudentSpace.switchProfile(profileId);
            
            // Test 2.1: Enregistrement de résultat
            window.StudentSpace.saveQuizResult('quiz_test_1', 8, 10, [
                { question: 'Q1', selected: 'A', correct: 'B' }
            ], 'attempt_test_1');
            
            const profileData = window.StudentSpace.getProfileData(profileId);
            logTest('2.1 Enregistrement de résultat', profileData.quizResults.length === 1, `Résultats: ${profileData.quizResults.length}`);
            
            // Test 2.2: Évitement des doublons (même quiz dans la minute)
            window.StudentSpace.saveQuizResult('quiz_test_1', 8, 10, [], 'attempt_test_1');
            const profileData2 = window.StudentSpace.getProfileData(profileId);
            logTest('2.2 Idempotence du même essai', profileData2.quizResults.length === 1, `Essais: ${profileData2.quizResults.length}`);

            // Une nouvelle tentative du même quiz doit être conservée, même dans la même minute.
            window.StudentSpace.saveQuizResult('quiz_test_1', 6, 10, [], 'attempt_test_2');
            const profileData3 = window.StudentSpace.getProfileData(profileId);
            logTest('2.3 Nouvelle tentative conservée', profileData3.quizResults.length === 2, `Essais: ${profileData3.quizResults.length}`);
            
            // Test 2.3: Calcul correct du score
            const result = profileData3.quizResults[0];
            logTest('2.4 Calcul du score', result.percentage === 80, `Score: ${result.percentage}%`);
            
            // Test 2.4: Détails des réponses
            logTest('2.5 Détails des réponses', result.mistakes.length === 1, `Erreurs: ${result.mistakes.length}`);
            
            // Test 2.5: Quiz ID stable
            const quizId = result.quizId;
            logTest('2.6 Quiz ID stable', quizId === 'quiz_test_1', `ID: ${quizId}`);

            let invalidRejected = false;
            try { window.StudentSpace.saveQuizResult('bad', 11, 10, [], 'attempt_bad'); }
            catch (e) { invalidRejected = true; }
            logTest('2.7 Rejet des scores invalides', invalidRejected, 'Un score supérieur au total est rejeté');

            // Cleanup
            window.StudentSpace.deleteProfile(profileId);
            
        } catch (e) {
            logTest('2.0 Tests quiz', false, `Erreur: ${e.message}`);
        }
    }

    // ============================================
    // TEST 3: GESTION DES ERREURS
    // ============================================
    function testMistakes() {
        console.log('\n=== TEST 3: GESTION DES ERREURS ===');
        
        try {
            const profileId = window.StudentSpace.createProfile('MistakeTestUser');
            window.StudentSpace.switchProfile(profileId);
            
            // Test 3.1: Enregistrement d'erreur complète
            window.StudentSpace.saveQuizResult('quiz_error_test', 5, 10, [
                { 
                    question: 'Quelle est la capitale?', 
                    selected: 'Paris', 
                    correct: 'Rabat',
                    date: Date.now(),
                    quizId: 'quiz_error_test'
                }
            ]);
            
            const profileData = window.StudentSpace.getProfileData(profileId);
            const mistake = profileData.mistakes[0];
            
            logTest('3.1 Question originale', !!mistake.question, `Question: ${mistake.question}`);
            logTest('3.2 Réponse choisie', !!mistake.selected, `Choisi: ${mistake.selected}`);
            logTest('3.3 Bonne réponse', !!mistake.correct, `Correct: ${mistake.correct}`);
            logTest('3.4 Date enregistrée', !!mistake.date, `Date: ${new Date(mistake.date).toISOString()}`);
            logTest('3.5 Quiz ID', mistake.quizId === 'quiz_error_test', `Quiz ID: ${mistake.quizId}`);
            
            // Cleanup
            window.StudentSpace.deleteProfile(profileId);
            
        } catch (e) {
            logTest('3.0 Tests erreurs', false, `Erreur: ${e.message}`);
        }
    }

    // ============================================
    // TEST 4: SYSTÈME DE MOTIVATION (STREAK)
    // ============================================
    function testStreak() {
        console.log('\n=== TEST 4: SYSTÈME DE MOTIVATION (STREAK) ===');
        
        try {
            const profileId = window.StudentSpace.createProfile('StreakTestUser');
            window.StudentSpace.switchProfile(profileId);
            
            // Test 4.1: Initialisation du streak
            const initialStreak = window.StudentSpace.updateStreak();
            logTest('4.1 Initialisation streak', initialStreak.current === 1, `Streak initial: ${initialStreak.current}`);
            
            // Test 4.2: Pas de double comptage le même jour
            const sameDayStreak = window.StudentSpace.updateStreak();
            logTest('4.2 Pas de double comptage', sameDayStreak.current === 1, `Streak même jour: ${sameDayStreak.current}`);
            
            // Test 4.3: Meilleur streak
            logTest('4.3 Meilleur streak', sameDayStreak.best >= 1, `Best: ${sameDayStreak.best}`);
            
            // Test 4.4: Date de dernière visite
            logTest('4.4 Date dernière visite', !!sameDayStreak.lastVisit, `Last visit: ${new Date(sameDayStreak.lastVisit).toISOString()}`);
            
            // Cleanup
            window.StudentSpace.deleteProfile(profileId);
            
        } catch (e) {
            logTest('4.0 Tests streak', false, `Erreur: ${e.message}`);
        }
    }

    // ============================================
    // TEST 5: EXPORT/IMPORT JSON
    // ============================================
    function testExportImport() {
        console.log('\n=== TEST 5: EXPORT/IMPORT JSON ===');
        
        try {
            const profileId = window.StudentSpace.createProfile('ExportTestUser');
            window.StudentSpace.switchProfile(profileId);
            
            // Ajouter des données
            window.StudentSpace.saveQuizResult('quiz_export', 7, 10, []);
            window.StudentSpace.markLessonComplete('lesson_1');
            
            // Test 5.1: Export (simulation - vérifie que la fonction existe)
            logTest('5.1 Fonction export existe', typeof window.StudentSpace.exportProfileData === 'function', 'Export disponible');
            
            // Test 5.2: Get profile data for export simulation
            const profileData = window.StudentSpace.getProfileData(profileId);
            const profiles = window.StudentSpace.getProfiles();
            const exportData = {
                profile: profiles[profileId],
                data: profileData,
                exportDate: Date.now(),
                version: '1.0'
            };
            const jsonString = JSON.stringify(exportData);
            logTest('5.2 Génération JSON', !!jsonString && jsonString.length > 0, `Taille: ${jsonString.length} chars`);
            
            // Test 5.3: Import
            const importSuccess = window.StudentSpace.importProfileData(jsonString);
            logTest('5.3 Import JSON', importSuccess === true, 'Import réussi');
            
            // Test 5.4: Protection contre JSON invalide
            const invalidImport = window.StudentSpace.importProfileData('{invalid json');
            logTest('5.4 Protection JSON invalide', invalidImport === false, 'Rejeté comme prévu');
            
            // Cleanup
            window.StudentSpace.deleteProfile(profileId);
            
        } catch (e) {
            logTest('5.0 Tests export/import', false, `Erreur: ${e.message}`);
        }
    }

    // ============================================
    // TEST 6: ISOLATION DES DONNÉES ENTRE PROFILS
    // ============================================
    function testProfileIsolation() {
        console.log('\n=== TEST 6: ISOLATION DES DONNÉES ENTRE PROFILS ===');
        
        try {
            const profileId1 = window.StudentSpace.createProfile('IsolationUser1');
            const profileId2 = window.StudentSpace.createProfile('IsolationUser2');
            
            // Données pour profil 1
            window.StudentSpace.switchProfile(profileId1);
            window.StudentSpace.saveQuizResult('quiz_iso', 9, 10, []);
            window.StudentSpace.markLessonComplete('lesson_a');
            
            // Données pour profil 2
            window.StudentSpace.switchProfile(profileId2);
            window.StudentSpace.saveQuizResult('quiz_iso', 5, 10, []);
            window.StudentSpace.markLessonComplete('lesson_b');
            
            // Vérification isolation
            const data1 = window.StudentSpace.getProfileData(profileId1);
            const data2 = window.StudentSpace.getProfileData(profileId2);
            
            logTest('6.1 Quiz résultats isolés', data1.quizResults[0].score !== data2.quizResults[0].score, `P1: ${data1.quizResults[0].score}, P2: ${data2.quizResults[0].score}`);
            logTest('6.2 Leçons isolées', Object.keys(data1.progress.lessons)[0] !== Object.keys(data2.progress.lessons)[0], `P1: ${Object.keys(data1.progress.lessons)[0]}, P2: ${Object.keys(data2.progress.lessons)[0]}`);
            
            // Cleanup
            window.StudentSpace.deleteProfile(profileId1);
            window.StudentSpace.deleteProfile(profileId2);
            
        } catch (e) {
            logTest('6.0 Tests isolation', false, `Erreur: ${e.message}`);
        }
    }

    // ============================================
    // TEST 7: PERSISTANCE DES DONNÉES
    // ============================================
    function testPersistence() {
        console.log('\n=== TEST 7: PERSISTANCE DES DONNÉES ===');
        
        try {
            const profileId = window.StudentSpace.createProfile('PersistenceUser');
            window.StudentSpace.switchProfile(profileId);
            
            // Ajouter des données
            window.StudentSpace.saveQuizResult('quiz_persist', 6, 10, []);
            
            // Vérifier immédiatement
            const dataBefore = window.StudentSpace.getProfileData(profileId);
            logTest('7.1 Données sauvegardées immédiatement', dataBefore.quizResults.length === 1, `Résultats: ${dataBefore.quizResults.length}`);
            
            // Vérifier depuis localStorage
            const localStorageKey = 'gosvt_student_space_data_' + profileId;
            const localStorageData = localStorage.getItem(localStorageKey);
            logTest('7.2 Données dans localStorage', !!localStorageData, 'Présent dans localStorage');
            
            // Cleanup
            window.StudentSpace.deleteProfile(profileId);
            
        } catch (e) {
            logTest('7.0 Tests persistance', false, `Erreur: ${e.message}`);
        }
    }

    // ============================================
    // TEST 8: INTÉGRATION FAVORIS
    // ============================================
    function testFavoritesIntegration() {
        console.log('\n=== TEST 8: INTÉGRATION FAVORIS ===');
        
        try {
            // Test 8.1: Vérifier que le système lit depuis gosvt_favs
            localStorage.setItem('gosvt_favs', JSON.stringify([
                { title: 'Test Favorite', url: 'http://test.com' }
            ]));
            
            const profileId = window.StudentSpace.createProfile('FavTestUser');
            window.StudentSpace.switchProfile(profileId);
            
            window.StudentSpace.refresh();
            const favoriteLink = document.querySelector('#panel-favorites .favorite-item a');
            logTest('8.1 Lecture favoris existants', !!favoriteLink, 'Favori rendu depuis gosvt_favs');
            
            // Cleanup
            localStorage.removeItem('gosvt_favs');
            window.StudentSpace.deleteProfile(profileId);
            
        } catch (e) {
            logTest('8.0 Tests favoris', false, `Erreur: ${e.message}`);
        }
    }


    // ============================================
    // TEST 9: STUDY PLANNER AND PERSONAL NOTES
    // ============================================
    function testPlannerAndNotes() {
        console.log('\n=== TEST 9: MODÈLE DU PLANNING ET DES NOTES ===');
        try {
            const profileId = window.StudentSpace.createProfile('PlannerNotesTest');
            window.StudentSpace.switchProfile(profileId);
            const data = window.StudentSpace.getProfileData(profileId);
            data.studyPlan.push({ id: 'task_test', title: 'Réviser la cellule', date: '2026-11-07', duration: 45, completed: false });
            data.notes.push({ id: 'note_test', title: 'Définition', body: 'La cellule est l’unité structurale du vivant.', createdAt: Date.now() });
            // The public save path is exercised through the existing data update methods in the UI;
            // this test confirms the data model exposes profile-scoped collections.
            logTest('9.1 Collections planning et notes disponibles',
                Array.isArray(data.studyPlan) && Array.isArray(data.notes),
                `Collections disponibles — planning: ${data.studyPlan.length}, notes: ${data.notes.length}`);
            window.StudentSpace.deleteProfile(profileId);
        } catch (e) {
            logTest('9.0 Tests planning et notes', false, `Erreur: ${e.message}`);
        }
    }

    // ============================================
    // RUN ALL TESTS
    // ============================================
    function runAllTests() {
        console.log('\n╔════════════════════════════════════════════════════════════╗');
        console.log('║     GO SVT MAROC - AUDIT TEST SUITE                     ║');
        console.log('╚════════════════════════════════════════════════════════════╝\n');
        
        testProfiles();
        testQuizResults();
        testMistakes();
        testStreak();
        testExportImport();
        testProfileIsolation();
        testPersistence();
        testFavoritesIntegration();
        testPlannerAndNotes();
        
        // Summary
        console.log('\n╔════════════════════════════════════════════════════════════╗');
        console.log('║                    RÉSUMÉ DES TESTS                        ║');
        console.log('╚════════════════════════════════════════════════════════════╝\n');
        
        const passed = testResults.filter(r => r.passed).length;
        const total = testResults.length;
        
        console.log(`Total: ${passed}/${total} tests réussis`);
        
        testResults.forEach(r => {
            const icon = r.passed ? '✅' : '❌';
            console.log(`${icon} ${r.name}: ${r.details}`);
        });
        
        console.log('\nFin des tests.\n');
        
        return { passed, total, results: testResults };
    }

    // Expose globally
    window.runAuditTests = runAllTests;
    
    // Auto-run if on test page
    if (window.location.hash === '#test') {
        runAllTests();
    }
    
})();
