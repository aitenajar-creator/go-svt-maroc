# Go SVT Maroc — Rapport de correction Version 7

Date : 04 novembre 2026

## 1. Périmètre réellement reçu

L'archive fournie contient un site statique HTML/CSS/JavaScript destiné à GitHub Pages. Le système Espace Élève utilise `localStorage` et `sessionStorage`.

Aucun des éléments suivants n'est présent dans l'archive :
- dossier `supabase/` ;
- migrations SQL ou schéma PostgreSQL ;
- politiques RLS ;
- fonctions RPC PostgreSQL ;
- Edge Functions ;
- configuration `supabase/config.toml`.

Par conséquent, cette livraison corrige le code réellement présent. Elle ne prétend pas corriger une base Supabase absente de l'archive.

## 2. Corrections apportées

### 2.1 Résultats des quiz
- Validation des paramètres : identifiant, score entier, total strictement positif et score compris entre 0 et le total.
- Remplacement de la déduplication temporelle de 60 secondes par une clé d'essai (`attemptId`) idempotente.
- Une deuxième tentative du même quiz est désormais conservée, même si elle a lieu immédiatement après la première.
- Normalisation et limitation des champs des erreurs enregistrées.

### 2.2 Intégration des quiz
- L'ancien code attachait des écouteurs à des questions individuelles, ce qui ne permettait pas toujours de détecter la fin du quiz complet.
- L'intégration s'attache maintenant au conteneur du quiz (`#quizBox` ou `[data-quiz-root]`).
- Elle vérifie que toutes les questions sont terminées, lit le résultat final et associe un identifiant distinct à chaque tentative.
- Le redémarrage du quiz réinitialise le suivi de tentative.

### 2.3 Données des profils
- Identifiants de profil non basés uniquement sur `Date.now()`.
- Validation des noms de profils.
- Vérification et normalisation de la structure des données lues.
- Suppression des clés de données locales lors de la suppression d'un profil.
- Import JSON limité en taille, validation de structure/version et validation de l'identifiant du profil.
- Export avec nom de fichier assaini.

### 2.4 Affichage et données non fiables
- Échappement HTML des noms de profils, identifiants de quiz, questions, réponses et libellés provenant du stockage.
- Validation des URL de favoris : seuls les protocoles HTTP et HTTPS sont autorisés.
- Ajout de `rel="noopener noreferrer"` aux liens externes.
- Suppression du rafraîchissement périodique des favoris toutes les deux secondes ; remplacement par une écoute d'événements de stockage et d'événements applicatifs.

### 2.5 Série d'activité (streak)
- La série n'est plus incrémentée simplement parce que la page est chargée ou qu'un utilisateur se connecte.
- Elle est mise à jour lors d'une activité pédagogique enregistrée.

### 2.6 Libellés et transparence
- Le libellé « Exercices terminés » est remplacé par « Exercices consultés », car le suivi actuel mesure l'ouverture/consultation et non la réussite effective d'un exercice.
- L'écran de compte précise que le compte est local au navigateur et ne constitue pas une authentification serveur.

### 2.7 Tests
- Mise à jour des tests de résultats pour vérifier l'idempotence d'un même essai.
- Ajout de la vérification qu'une nouvelle tentative est conservée.
- Ajout du rejet des scores invalides.
- Ajout d'un conteneur de test dans `test-runner.html` pour permettre le rendu de l'espace élève pendant les tests.

## 3. Vérifications exécutées dans cet environnement

- `node --check` sur les fichiers JavaScript principaux et la suite de tests : réussi.
- Test automatisé isolé avec environnement simulé : création de profil, validation de nom, sauvegarde d'un résultat, idempotence, conservation d'une nouvelle tentative, rejet d'un score supérieur au total et import JSON valide : réussi.

## 4. Vérifications qui restent nécessaires

Les tests suivants nécessitent un navigateur réel et doivent être exécutés avant publication :
- exécution complète de `test-runner.html` ;
- réalisation d'un quiz complet, puis redémarrage et nouvelle tentative ;
- export puis import d'un fichier JSON téléchargé ;
- test sur mobile ;
- vérification des données existantes avant et après déploiement.

Aucun résultat navigateur réel ou test de production n'est revendiqué dans ce rapport.

## 5. Limite de sécurité fondamentale

Le site est statique et conserve les comptes et les données dans le navigateur. Un utilisateur ayant accès au navigateur peut modifier `localStorage`, remplacer les données, supprimer les verrous locaux ou examiner les empreintes de mots de passe. Le hachage PBKDF2 améliore le stockage du secret, mais ne transforme pas une application côté client en système d'authentification sécurisé.

Pour obtenir une authentification réelle, une séparation fiable des élèves, une synchronisation entre appareils et des autorisations administrateur/enseignant/élève, il faut ajouter un backend et une base de données. Si Supabase est la cible, il faut fournir ou créer les migrations, les politiques RLS, les fonctions RPC et les Edge Functions, puis les tester dans un projet Supabase de test. Ces composants ne figuraient pas dans l'archive reçue et ne sont donc pas inclus dans cette Version 7.

## 6. Conclusion

Cette Version 7 corrige plusieurs défauts concrets de l'Espace Élève et de son intégration quiz, sans prétendre transformer le stockage local en système sécurisé côté serveur. Elle doit encore passer les tests navigateur et, si l'objectif reste l'architecture Supabase décrite précédemment, recevoir les fichiers/backend correspondants avant de pouvoir être déclarée prête pour la production.
