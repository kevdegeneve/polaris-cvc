# Polaris CVC

Premiere base React + TypeScript pour une application terrain de depannage CVC mobile-first.

## Architecture proposee

- `src/domain` : types metier stricts et validation.
- `src/services` : stockage local demo, client Firebase, generation de rapport, interface IA abstraite.
- `src/app` : navigation et ecrans principaux.
- `public` : manifeste PWA, icone et service worker.
- `firebase.rules` / `storage.rules` : isolation des donnees par `companyId`.

## Collections prevues

`companies`, `users`, `customers`, `sites`, `equipment`, `interventions`, `measurements`, `media`, `documents`, `documentLinks`, `aiAnalyses`, `activityLogs`.

Chaque document metier contient `companyId` pour eviter l'acces entre entreprises. Les roles prevus sont `technicien`, `referent_technique` et `administrateur`.

## Fonctionnel inclus

- Connexion Firebase Auth si Firebase est configure.
- Fallback local si Firebase n'est pas configure ou si Firestore est indisponible.
- Accueil avec gros acces rapides.
- Creation d'intervention en parcours structure.
- Sauvegarde locale automatique via `localStorage`.
- Recherche dans les interventions.
- Consultation des interventions de l'equipe avec auteur visible.
- Ajout de photos depuis appareil photo ou galerie.
- Placeholder clair pour notes vocales et IA non activee.
- Gestion simple des documents techniques.
- Rapport professionnel imprimable en PDF via le navigateur.
- Base PWA avec cache hors ligne minimal.

## IA

Aucune fausse fonction IA n'est activee. `src/services/aiService.ts` definit une interface abstraite pour brancher plus tard OpenAI ou un autre fournisseur :

- amelioration de rapport ;
- transcription vocale ;
- OCR plaque signaletique ;
- reconnaissance modele ;
- recherche semantique ;
- comparaison avec anciennes interventions.

## Installation

```bash
npm install
npm run dev
```

Puis ouvrir l'URL indiquee par Vite, generalement `http://localhost:5173`.

## Variables d'environnement

Copier `.env.example` vers `.env.local`, puis renseigner les valeurs Firebase :

```bash
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

Ne jamais mettre de cle secrete serveur dans le client.

## Firebase Auth et Firestore

La couche d'acces aux donnees passe par une interface de repository :

- `LocalRepository` : mode local de secours avec `localStorage`.
- `FirestoreRepository` : mode cloud pour `companies`, `users` et `interventions`.

Le choix est automatique :

- si les variables Firebase sont absentes, l'application reste en mode local ;
- si Firebase est configure et qu'un utilisateur est connecte, l'application lit Firestore ;
- si le profil utilisateur ou l'entreprise est introuvable dans Firestore, l'application revient en mode local.

Collections Firestore branchees dans cette etape :

- `companies/{companyId}` ;
- `users/{uid}` avec `companyId`, `displayName`, `email` et `role` ;
- `interventions/{interventionId}` avec `companyId`, `authorId` et les champs metier.

Le premier administrateur et son entreprise doivent etre crees depuis la console Firebase ou un script admin serveur. Les regles client refusent la creation libre d'une entreprise afin d'eviter qu'un utilisateur puisse choisir lui-meme son `companyId`.

Les regles `firebase.rules` imposent :

- lecture/ecriture uniquement si le profil utilisateur existe ;
- acces limite au `companyId` de l'utilisateur connecte ;
- interdiction de modifier le `companyId` d'un document existant ;
- modification des roles reservee aux administrateurs.

## Verification

```bash
npm run build
npm run test
```

Dans cet environnement Codex, Node est disponible mais `npm` ne l'est pas, donc l'installation et la compilation complete doivent etre lancees sur un poste disposant de Node + npm.

## Deploiement Firebase

1. Creer un projet Firebase.
2. Activer Authentication, Firestore et Storage.
3. Publier `firebase.rules` et `storage.rules`.
4. Renseigner `.env.local`.
5. Construire l'application :

```bash
npm run build
```

6. Deployer le dossier `dist` avec Firebase Hosting ou l'hebergeur choisi.

## Prochaine etape recommandee

Brancher le repository Firestore en conservant l'interface actuelle, puis remplacer progressivement le stockage local par une synchronisation offline Firestore.
