# Polaris CVC

Premiere base React + TypeScript pour une application terrain de depannage CVC mobile-first.

## Architecture proposee

- `src/domain` : types metier stricts et validation.
- `src/services` : stockage local vide, client Firebase, generation de rapport, interface IA abstraite.
- `src/app` : navigation et ecrans principaux.
- `public` : manifeste PWA, icone et service worker.
- `firebase.rules` / `storage.rules` : isolation des donnees par `companyId`.

## Collections prevues

`companies`, `users`, `customers`, `sites`, `equipment`, `interventions`, `measurements`, `media`, `documents`, `documentLinks`, `aiAnalyses`, `activityLogs`.

Chaque document metier contient `companyId` pour eviter l'acces entre entreprises. Les roles prevus sont `technicien`, `referent_technique` et `administrateur`.

## Fonctionnel inclus

- Connexion Firebase Auth reelle avec Google.
- Protection des ecrans metier sans utilisateur connecte.
- Tableau de bord professionnel apres connexion.
- Navigation responsive : barre laterale ordinateur, menu mobile compact, barre superieure avec profil.
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

## Tableau de bord et navigation

Apres connexion autorisee, Polaris affiche une interface applicative composee de :

- une barre laterale desktop avec logo, modules et etat actif ;
- un menu mobile compact avec bouton d'ouverture ;
- une barre superieure affichant page active, entreprise, utilisateur, photo Google, role et deconnexion ;
- un tableau de bord avec cartes d'action, indicateurs et activite recente ;
- un bouton rapide `Nouvelle intervention`.

Modules de navigation :

- Tableau de bord
- Nouvelle intervention
- Mes interventions
- Identifier un equipement
- Bibliotheque technique
- Utilisateurs
- Parametres

Le module `Utilisateurs` est visible uniquement pour les roles `admin` et `administrateur`. Les techniciens conservent l'acces aux modules terrain sans voir l'administration.

Les indicateurs utilisent uniquement les donnees disponibles dans le repository : interventions ouvertes/terminees, equipements identifies, documents techniques, favoris et activite recente. Aucune fausse donnee n'est ajoutee.

## IA

Aucune fausse fonction IA n'est activee. `src/services/aiService.ts` definit une interface abstraite pour brancher plus tard OpenAI ou un autre fournisseur :

- amelioration de rapport ;
- transcription vocale ;
- OCR plaque signaletique ;
- reconnaissance modele ;
- recherche semantique ;
- comparaison avec anciennes interventions.

`src/services/diagnosticAIService.ts` prepare en plus le futur assistant de diagnostic multimodal :

- analyse initiale des photos plaque signaletique et defaut ;
- analyse de photos ajoutees pendant le depannage ;
- conversation de diagnostic ;
- generation du diagnostic final ;
- recherche et synthese de sources documentaires.

Tant qu'aucun backend securise ou Cloud Function n'est branche, ce service retourne uniquement un statut `not_connected` et n'invente aucun resultat technique.

## Diagnostic photo-first

Le module `Diagnostic` est pense pour le chantier :

- le technicien ouvre `Diagnostic` depuis la navigation ;
- deux photos sont obligatoires avant toute analyse : plaque signaletique et defaut/code erreur ;
- les photos supplementaires peuvent etre ajoutees avec une categorie ;
- l'analyse reste bloquee tant que les deux photos minimales ne sont pas presentes ;
- les photos sont modelisees comme fichiers avec `storagePath`, jamais comme base64 Firestore ;
- apres preparation, Polaris affiche une conversation de diagnostic ;
- l'archive est creee uniquement quand le technicien clique sur `Terminer le diagnostic`.

Les types centraux sont dans `src/domain/types.ts` : `Diagnostic`, `DiagnosticPhoto`, `DiagnosticMessage`, `DiagnosticDocumentLink`, `SourceReference`, `AIAnalysisRequest` et `AIAnalysisResponse`.

## Langue technicien

Au premier demarrage connecte, un utilisateur autorise sans langue configuree voit un ecran de choix de langue. Polaris enregistre dans `users/{uid}` :

- `preferredLanguage`
- `preferredLanguageLabel`
- `languageConfiguredAt`
- `updatedAt`

Cette base servira a l'interface, aux futures reponses IA, aux documents techniques affiches, aux traductions et aux archives de diagnostic.

## Documents et sources de diagnostic

La bibliotheque technique devient le stockage central des sources utilisees par l'IA. Les documents peuvent porter des champs de recherche et de tracabilite supplementaires : constructeur, references modeles, codes erreur, langue originale, langue localisee, hash, URL canonique, reference documentaire, version, statut, statut de traduction, resume, mots-cles extraits, diagnostics lies et compteur d'utilisation.

La deduplication future utilise une cle stable composee de :

- hash du fichier ;
- URL canonique ;
- constructeur ;
- reference document ;
- langue ;
- version ;
- date de publication.

Les traductions conservent toujours le lien avec le document original via `originalDocumentId`. Une traduction automatique doit rester marquee avec `isMachineTranslated` et ne doit jamais etre presentee comme une traduction officielle constructeur.

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

- si les variables Firebase sont absentes, l'ecran de connexion indique que Firebase doit etre configure ;
- si Firebase est configure et qu'un utilisateur est connecte, l'application lit Firestore ;
- si les donnees cloud metier sont indisponibles, l'application peut conserver un mode local de secours pour la session connectee.

### Connexion Google

Dans la console Firebase :

1. Ouvrir Authentication.
2. Aller dans Sign-in method.
3. Activer le fournisseur Google.
4. Renseigner l'adresse email de support demandee par Firebase.
5. Dans Authentication > Settings > Authorized domains, ajouter `polaris-cvc.web.app`.
6. Verifier aussi la presence de `localhost` pour les tests locaux.

Avant toute premiere connexion Google, l'utilisateur doit etre autorise dans Firestore via `authorizedUsers/{emailNormalise}`. Polaris refuse tout compte Google absent de cette collection.

Lors de la premiere connexion Google autorisee, Polaris cree ou complete automatiquement `users/{uid}` avec :

- `uid`
- `email`
- `displayName`
- `photoURL`
- `companyId` provenant de `authorizedUsers`
- `role` provenant de `authorizedUsers`
- `createdAt`
- `lastLoginAt`
- `isActive`

Dans Firestore, verifier apres connexion que la collection `users` contient bien un document dont l'identifiant est l'UID Firebase Authentication de l'utilisateur. `createdAt` ne doit pas changer lors des connexions suivantes, tandis que `lastLoginAt` doit etre mis a jour.

### Autoriser le premier administrateur

Dans Firebase Console > Firestore Database, creer manuellement :

- Collection : `authorizedUsers`
- Identifiant du document : `mr.travers.kevin@gmail.com`

Champs du document :

```json
{
  "email": "mr.travers.kevin@gmail.com",
  "emailNormalized": "mr.travers.kevin@gmail.com",
  "companyId": "optima",
  "role": "admin",
  "isActive": true,
  "invitedAt": "2026-07-17T00:00:00.000Z",
  "invitedBy": "manual-bootstrap"
}
```

Types attendus :

- `email` : string
- `emailNormalized` : string, en minuscules, sans espaces
- `companyId` : string
- `role` : string (`admin`, `technician`, `technicien`, `referent_technique`, `administrateur`)
- `isActive` : boolean
- `invitedAt` : string ISO ou timestamp selon la saisie console
- `invitedBy` : string

Pour ajouter ensuite un technicien, creer dans `authorizedUsers` un document dont l'identifiant est son email normalise, par exemple `technicien@example.com`, avec :

```json
{
  "email": "technicien@example.com",
  "emailNormalized": "technicien@example.com",
  "companyId": "optima",
  "role": "technician",
  "isActive": true,
  "invitedAt": "2026-07-17T00:00:00.000Z",
  "invitedBy": "uid-admin"
}
```

Pour desactiver un compte, passer `isActive` a `false` dans `authorizedUsers/{emailNormalise}`. Si necessaire, passer aussi `users/{uid}.isActive` a `false`.

Collections Firestore branchees dans cette etape :

- `companies/{companyId}` ;
- `users/{uid}` avec `uid`, `companyId`, `displayName`, `email`, `photoURL`, `role`, `createdAt`, `lastLoginAt` et `isActive` ;
- `interventions/{interventionId}` avec `companyId`, `authorId` et les champs metier.
- `diagnostics/{diagnosticId}` prepare les diagnostics photo-first ;
- `diagnosticPhotos/{photoId}` prepare les metadonnees de photos stockees dans Firebase Storage ;
- `diagnosticMessages/{messageId}` prepare la conversation ;
- `diagnosticDocumentLinks/{linkId}` prepare la tracabilite entre diagnostics et sources.

Le premier administrateur et son entreprise doivent etre crees depuis la console Firebase ou un script admin serveur. Les regles client refusent la creation libre d'une entreprise afin d'eviter qu'un utilisateur puisse choisir lui-meme son `companyId`.

Les regles `firebase.rules` imposent :

- lecture/ecriture metier uniquement si le profil utilisateur existe ;
- creation autorisee de son propre profil `users/{uid}` uniquement si `authorizedUsers/{emailNormalise}` existe et est actif ;
- acces limite au `companyId` de l'utilisateur connecte ;
- interdiction de modifier le `companyId` d'un document existant ;
- modification des roles reservee aux administrateurs.

## Verification

```bash
npm run build
npm run test
```

Procedure locale recommandee :

```bash
npm install
npm run dev
npm run build
npm run test
```

Tester l'interface aux largeurs 375 px, 768 px, 1024 px et 1440 px. Sur mobile, verifier le menu, l'absence de debordement horizontal et l'acces au bouton `Nouvelle intervention`.

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

Commande Firebase Hosting :

```bash
npm run build
npx firebase-tools deploy --only firestore:rules,hosting
```

Pour publier aussi les regles Storage preparees pour les diagnostics et documents :

```bash
npx firebase-tools deploy --only firestore:rules,storage,hosting
```

## Activation de l'IA Polaris

L'analyse IA reelle passe par Firebase Cloud Functions et n'expose jamais la cle OpenAI dans React.

Prerequis :

1. Utiliser un projet Firebase avec l'offre permettant Cloud Functions, Secret Manager, Firestore et Storage.
2. Activer Firebase Authentication, Firestore Database, Firebase Storage et Cloud Functions.
3. Verifier que les variables `VITE_FIREBASE_*` pointent vers le projet Firebase.

Commandes d'installation et de validation :

```bash
npm install
cd functions
npm install
npm run build
npm run test
npm run lint
cd ..
npm run build
npm run test
```

Enregistrer la cle OpenAI dans Google Cloud Secret Manager, sans l'ecrire dans le depot :

```bash
npx firebase-tools functions:secrets:set OPENAI_API_KEY
```

Deployer les regles et la fonction callable securisee :

```bash
npx firebase-tools deploy --only firestore:rules,storage
npx firebase-tools deploy --only functions:analyzeDiagnostic
npx firebase-tools deploy --only hosting
```

La fonction callable s'appelle `analyzeDiagnostic` et est publiee en region `europe-west1`. Elle recoit uniquement `diagnosticId`, relit le profil utilisateur, le diagnostic et les photos dans Firestore/Storage, puis appelle OpenAI cote serveur avec le prompt versionne `DIAGNOSTIC_PROMPT_VERSION = "1.0.0"` dans `functions/src/prompt.ts`.

Apres deploiement :

1. Connecter un utilisateur autorise.
2. Creer un diagnostic avec une photo de plaque et une photo de defaut/code erreur.
3. Verifier que les fichiers sont crees dans `diagnostics/{diagnosticId}/photos/{photoId}.{extension}`.
4. Lancer l'analyse.
5. Verifier le resultat structure dans Firestore `diagnostics/{diagnosticId}`.
6. Verifier les logs Functions sans y afficher de cle, image complete ni URL signee.

Si le secret `OPENAI_API_KEY` est absent ou si la Function n'est pas deployee, l'analyse echoue clairement sans generer de faux diagnostic.

## Prochaine etape recommandee

Brancher le repository Firestore en conservant l'interface actuelle, puis remplacer progressivement le stockage local par une synchronisation offline Firestore.
