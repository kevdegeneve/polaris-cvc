# Etat des fonctionnalites

## Termine

- Base React + TypeScript + Vite.
- Design mobile-first initial.
- Connexion avec fallback local.
- Firebase Auth branche quand la configuration existe.
- Interface de repository abstraite.
- Repository local `localStorage`.
- Repository Firestore initial pour `companies`, `users`, `interventions`.
- Modeles metier principaux.
- Creation d'intervention structuree.
- Liste des interventions.
- Recherche simple dans les interventions.
- Detail intervention.
- Attribution d'une intervention a son auteur.
- Ajout photo local.
- Placeholder notes vocales non activees.
- Bibliotheque Technique mobile-first : modeles documentaires riches, recherche locale rapide, favoris, recents, import de dossier avec propositions de classement, rattachement automatique aux equipements.
- Identification Automatique d'Equipement : ecran mobile-first, photo plaque signaletique, import galerie, apercu, recadrage, rotation, analyse mock et fiche equipement complete.
- Rapport imprimable via navigateur.
- Regles Firebase initiales par `companyId`.
- Regles Firebase preparees pour les collections documentaires et Storage PDF/images.
- PWA minimale.
- Tests unitaires de validation, garde-fous `companyId` et moteur documentaire.

## En cours

- Stabilisation Firebase Auth + Firestore.
- Definition du bootstrap administrateur/entreprise.
- Passage progressif de toutes les entites metier vers Firestore.
- Branchement production de la Bibliotheque Technique vers Firestore et Storage.
- Remplacement du mock `IdentificationService` par une vraie chaine OCR/Vision.
- Durcissement des regles Firebase.
- Conservation propre du mode local en secours.
- Verification build/test sur environnement avec npm.

## Prevu

- CRUD clients.
- CRUD sites.
- CRUD equipements.
- Firestore pour clients, sites, equipements, medias et mesures.
- Validation en masse des candidats d'import documentaire.
- Firebase Storage pour photos et documents.
- Synchronisation offline robuste.
- File d'attente des operations hors ligne.
- Rapport PDF professionnel controle.
- Gestion avancee des roles.
- Validation technique par referent.
- Indexation texte/RAG des documents techniques.
- Robot de recherche documentaire constructeur avec validation humaine obligatoire.
- Historique d'interventions par equipement.
- Tests d'emulateur Firebase.
- CI GitHub Actions.
- IA optionnelle via `AiService` : amelioration rapport, transcription vocale, OCR, reconnaissance modele, recherche semantique.

## Non demarre

- OCR plaque signaletique.
- Lecture d'afficheurs.
- Annotation automatique de photos.
- Comparaison intelligente avec anciennes interventions.
- Proposition automatique de tests.
- Analyse de coherence des mesures.
