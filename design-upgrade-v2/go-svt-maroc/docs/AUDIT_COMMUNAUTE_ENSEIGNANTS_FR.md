# Audit initial — Communauté des enseignants GO SVT Maroc

**Date de l’audit :** 27 novembre 2026
**Dépôt :** `aitenajar-creator/go-svt-maroc`
**Branche / commit examiné :** `main` — `f6e1d65d3a534e647c189e07c088ce4fa3482e47`
**Périmètre :** inspection statique du dépôt, de la page et du code de la communauté, des migrations associées et des contrôles automatisés locaux. Aucun déploiement ni accès aux données de production n’a été effectué.

## 1. Synthèse exécutive

GO SVT Maroc est aujourd’hui un site statique HTML/CSS/JavaScript, déjà enrichi de fonctions Supabase dans plusieurs espaces. La « Communauté des enseignants » existe sous la forme d’un portail fonctionnel de comptes membres et de partage de fichiers pédagogiques. Elle n’est donc pas un forum vierge à remplacer : il faut conserver son flux actuel de connexion, d’approbation, de bibliothèque et de modération.

Le portail communauté utilise **un projet Supabase distinct** du projet principal (authentification, tables et Storage séparés). Cette séparation est explicitement documentée et protège l’isolation entre comptes de la communauté, comptes élèves et espace enseignant principal. L’évolution doit continuer dans ce projet dédié, sans créer un troisième backend ni déplacer les comptes existants.

L’écart majeur avec la vision cible concerne les fonctions collaboratives : le portail ne comporte pas encore de profils professionnels complets, favoris/notations/commentaires, publications/discussions, messagerie, groupes, notifications, formations suivies, outils de création pédagogique ou assistant IA. L’administration existante est principalement centrée sur l’approbation des membres et la gestion des ressources.

**Conclusion :** fondation réelle et plusieurs mesures de sécurité déjà présentes ; produit encore essentiellement une bibliothèque de fichiers privée avec un panneau d’administration, pas encore l’écosystème collaboratif décrit dans le cahier des charges.

## 2. Architecture constatée

- Site construit principalement avec des pages HTML autonomes, feuilles CSS et scripts JavaScript ; pas de framework applicatif unique ni de backend applicatif propre au portail communauté.
- Page principale du module : `teacher-community.html` ; logique : `teacher-community.js` ; styles : `teacher-community.css` ; paramètres de connexion : `teacher-community-config.js`.
- Le SDK Supabase JS est chargé dans la page et le client communauté utilise une clé **Publishable** côté navigateur. Aucun secret `service_role` ne doit être placé dans ces fichiers. La sécurité dépend des politiques RLS et Storage, et non du masquage des boutons.
- Le client communauté possède sa propre clé de stockage de session (`gosvt_teacher_community_auth_v1`) et pointe vers le projet indépendant documenté dans `TEACHER_COMMUNITY_SETUP_AR.md`.
- Le projet principal et l’espace élève comportent de nombreux modules et migrations Supabase. Ils ne doivent pas être modifiés pour livrer les fonctions de communauté, sauf nécessité démontrée et revue séparément.
- Aucune fonction serveur/Edge dédiée à l’assistant IA ou aux messages communautaires n’a été trouvée dans le périmètre examiné. L’IA sécurisée et les communications réellement persistées nécessiteront une conception serveur/backend appropriée.

## 3. Fonctionnalités déjà opérationnelles dans le code communauté

### Membres et accès
- Inscription et connexion par e-mail/mot de passe dans Supabase Auth.
- Création d’une adhésion `pending`, approbation ou suspension par un administrateur.
- Accès à la bibliothèque et téléversement conditionnés à l’approbation ; rôle administrateur vérifié par fonction Supabase.
- Gestion des sessions obsolètes dans le navigateur afin d’éviter que des réponses tardives d’un compte précédent ne repeuplent l’interface d’un nouveau compte.

### Bibliothèque pédagogique
- Dépôt de fichiers avec métadonnées : titre, description, catégorie, nom, type MIME, taille, partage, statut et propriétaire.
- Catégories existantes : programmes/orientations, leçons, présentations, évaluations, examens, corrections, planification, documents professionnels, formation et autres.
- Recherche, filtres par catégorie/type, tri, pagination, bibliothèque commune et espace « mes fichiers ».
- Prévisualisation de certains types de fichiers, téléchargement via URL signée de courte durée, modification, suppression et bascule privé/partagé.
- Validation côté navigateur et limites de taille/extensions, complétées par la configuration du bucket Storage et des contraintes SQL. Un contrôle de type MIME côté navigateur ne remplace pas une analyse antivirus ou une validation serveur plus robuste.

### Administration et traçabilité
- Approbation/suspension des membres ; masquage/restauration et suppression des ressources.
- Recherche et filtres des ressources et membres, pagination et exports CSV.
- Journal d’activité des changements de ressources, alimenté par un trigger SQL et lisible par l’administration.

## 4. Données et sécurité observées

Le schéma documenté du projet communauté comprend quatre tables applicatives :

- `teacher_community_admins` — attribution des administrateurs ; table verrouillée aux accès directs clients.
- `teacher_community_members` — profil réduit, statut et dates.
- `teacher_community_resources` — métadonnées des documents partagés ou privés.
- `teacher_community_resource_activity` — journal d’audit administrateur.

Le bucket `teacher-community` est privé. Le code crée des liens signés temporaires. Les migrations définissent RLS pour les membres, ressources et activité, ainsi que des règles Storage d’accès selon propriétaire, statut de publication, partage, approbation et administration. Les migrations ultérieures renforcent les privilèges de colonnes/tables, la suspension et les politiques Storage.

Points de vigilance :

1. Le code communauté a actuellement une structure frontend monolithique (notamment `teacher-community.js`, environ 87 Ko) ; ajouter de nombreuses fonctions dans ce fichier augmenterait le risque de régression. Décomposer en modules incrémentaux, en préservant ses APIs et ses identifiants HTML.
2. Le dépôt contient des migrations pour deux projets Supabase. Les migrations ne doivent pas être appliquées en bloc : respecter `supabase/project-manifest.json`, `scripts/migration-plan.py` et `docs/DATABASE_DEPLOYMENT_AR.md`.
3. Les documents d’audit du dépôt signalent qu’une comparaison complète entre tout l’historique SQL et certaines structures de production n’est pas encore démontrée. Toute migration future doit être validée contre le bon projet, en staging, puis appliquée selon le processus de sauvegarde/revue.
4. Le code visible et les tests locaux ne prouvent pas à eux seuls la configuration Auth, les politiques en production, les paramètres CORS, ni les comportements de comptes réels. Il faut un test d’acceptation sur un projet staging et des comptes dédiés (pending, approuvé, suspendu, admin).
5. L’IA ne doit pas recevoir de clé API dans le navigateur ; la future intégration nécessitera une fonction serveur/Edge, quotas, contrôles d’accès, règles de conservation et avertissement sur la vérification scientifique.

## 5. Écarts par rapport à la vision cible

| Domaine | État constaté | Écart / décision d’architecture |
|---|---|---|
| Dashboard enseignant | Résumé personnel de ses fichiers et état d’adhésion | Pas d’activité sociale, statistiques de contribution globales, recommandations ou préférences de widgets |
| Ressources | Recherche, catégorie/type, pagination, téléchargement, prévisualisation limitée, gestion propriétaire/admin | Manquent niveau, filière, langue, chapitre, année scolaire, favoris, notes, commentaires, signalement, mises à jour suivies et classement par qualité |
| Profil | Nom, titre professionnel, établissement facultatif dans l’enregistrement | Manquent profil éditable complet, région, niveaux/filières, compétences et suivi public ; confidentialité à définir |
| Publications / discussions | Absentes | À ajouter avec sujets, réponses, réactions, mentions, recherche et solution acceptée |
| Messagerie / groupes | Absents | Besoin de conversations/membres, règles de confidentialité, notifications et protection contre abus |
| Création pédagogique | Absente du portail communauté | Générateurs et export Word/PDF à concevoir ; ne pas présenter un générateur déterministe comme une IA |
| Formations | Catégorie de fichiers seulement | Aucun catalogue de cours ni progression/validation d’attestation |
| Outils SVT | Pas d’atelier intégré repéré au portail | Ajouter progressivement des outils autonomes, réutilisables et adaptés au programme marocain |
| IA | Aucune intégration dédiée constatée | API externe sécurisée côté serveur, garde-fous scientifiques et gestion des fichiers nécessaires |
| Administration | Approbation des membres, modération des ressources, activité de ressources | Pas encore rôles granulaires, signalements, modération sociale, gestion formation/groupes et annonces |
| Langues / RTL | Interface communauté majoritairement en arabe ; quelques libellés en français | Pas de commutateur FR/AR complet ni modèle centralisé de traduction ; tests RTL à préserver |

## 6. Vérifications exécutées

- `python3 scripts/check-teacher-community-security.py` — **réussi**.
- `python3 scripts/check-migration-rls.py` — **réussi** : couverture vérifiée pour 29 tables publiques dans le périmètre du script.
- `python3 scripts/check-site.py` — **réussi** : JSON, JavaScript/inline scripts, chemins d’actifs et ordre de chargement.
- `npm test` après installation propre (`npm ci --ignore-scripts`) — **111 tests réussis, 0 échec**.
- L’environnement local fournit Node.js 20.20.2 alors que `package.json` déclare `node >=22` ; les tests passent, mais l’avertissement `EBADENGINE` signifie que la validation dans l’environnement cible Node 22 reste à faire.
- `npm ci` n’a signalé aucune vulnérabilité dans l’audit des 5 paquets installés à cet instant. Ce résultat ne constitue pas un audit complet de dépendances transitives ou de production.
- Aucun test E2E communauté avec comptes réels, audit de sécurité externe, test visuel multi-appareils ou test de base de production n’a été effectué dans cette passe.

## 7. Plan d’intervention recommandé

### Phase 1 — Audit et stabilisation (cette passe)
- Conserver la page communauté existante comme base et documenter ses limites.
- Figer les contrôles de non-régression (tests JS, contrôles RLS, site, parcours auth et bibliothèque).
- Vérifier en staging les migrations réellement appliquées au projet communauté avant toute nouvelle migration.

### Phase 2 — Fondations de la plateforme
- Découper progressivement la logique frontend communauté en modules sans réécriture générale.
- Introduire une navigation professionnelle et un dashboard qui consomme uniquement des données réelles déjà disponibles.
- Enrichir le profil et les métadonnées des ressources, avec migrations additives, index et RLS ; préserver les anciens documents par valeurs par défaut.
- Ajouter une préférence de langue FR/AR avec RTL vérifié ; les libellés existants restent fonctionnels pendant la transition.

### Phase 3 — Bibliothèque et collaboration légère
- Ajouter favoris, notes/commentaires, évaluations et signalements ; définir modération, limites, pagination et anti-abus avant activation.
- Lancer publications/discussions et réponses acceptées, après tests de visibilité, propriété et modération.
- Mettre en place notifications in-app liées aux événements réellement persistés.

### Phase 4 — Outils de création
- Commencer par un générateur de fiche pédagogique structuré et éditable, puis export Word/PDF.
- Ajouter ensuite exercices/évaluations et atelier TP, avec critères de validation et tests de sortie documentaire.
- Définir les limites d’import (PDF/DOCX/PPTX), extraction et conservation des fichiers.

### Phase 5 — Messagerie, groupes, formation et outils SVT
- Ajouter conversations/groupes après modèle d’autorisation, confidentialité, signalement et notifications.
- Créer un catalogue de formations avant tout suivi ou attestation ; ne délivrer une attestation que si les conditions de validation existent réellement.
- Introduire les outils scientifiques par composants isolés, un par un.

### Phase 6 — IA et administration avancée
- Ajouter une Edge Function/API serveur avec secrets hors navigateur, quotas, journalisation minimale et contrôles de données importées.
- Distinguer clairement production assistée par IA et contenus vérifiés ; afficher incertitudes et limites scientifiques.
- Déployer rôles granulaires et interfaces de modération après tests de permissions par rôle.

### Phase 7 — Acceptation et déploiement progressif
- Tests unitaires, migration sur base isolée, tests d’intégration RLS/Storage avec plusieurs comptes, parcours navigateur, accessibilité, responsive, performance et reprise après panne.
- Déploiement progressif et retour arrière documenté ; aucune modification de l’Espace Élève ou des sections hors périmètre sans nécessité validée.

## 8. Limites et décision

Cet audit est une analyse du dépôt accessible sur `main`, complétée par des contrôles statiques et tests automatisés locaux. Il ne constitue pas une certification de sécurité, ni une vérification de l’état actuel du Supabase hébergé. Aucune migration n’a été appliquée et aucune donnée de production n’a été lue ou modifiée.

La priorité recommandée est un **MVP non destructif** : profil professionnel + métadonnées riches et indexées de bibliothèque + favoris + dashboard alimenté par données authentiques, avant de construire le fil social et la messagerie. Cela livre d’abord les fondations, garde l’espace élève intact et permet de tester les permissions avant les fonctions à risque plus élevé.
