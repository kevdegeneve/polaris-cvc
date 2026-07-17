# Decisions techniques

## D001 - React + TypeScript strict

Decision : utiliser React avec TypeScript strict.

Raison : l'application manipule des donnees metier sensibles et structurees. Les types reduisent les erreurs dans les relations entreprise, utilisateur, intervention, site et equipement.

Impact : toute nouvelle entite doit etre ajoutee dans `src/domain/types.ts` ou dans un module domaine dedie avant d'etre exposee dans l'UI.

## D002 - Mobile-first

Decision : priorite absolue au smartphone.

Raison : les techniciens utiliseront l'application sur le terrain, souvent d'une seule main, en conditions de luminosite et connexion variables.

Impact : gros boutons, navigation basse, ecrans peu charges, actions principales accessibles rapidement.

## D003 - Repository abstrait

Decision : isoler l'acces aux donnees derriere `AppRepository`.

Raison : permettre a l'application de fonctionner en local, puis avec Firestore, sans disperser la logique de persistance dans les composants React.

Impact : les composants doivent appeler le repository actif au lieu d'utiliser directement Firestore ou `localStorage`.

## D004 - Mode local conserve

Decision : garder `LocalRepository` comme solution de secours.

Raison : le terrain CVC implique des connexions faibles ou absentes. Le mode local permet aussi de developper sans projet Firebase configure.

Impact : toute evolution cloud doit verifier que le fallback local reste utilisable.

## D005 - Firebase Auth + Firestore

Decision : utiliser Firebase pour l'authentification et la persistance cloud.

Raison : Firebase donne rapidement Auth, Firestore, Storage et des regles de securite adaptees a une PWA terrain.

Impact : aucune cle secrete serveur ne doit etre ajoutee au client. Seules les variables publiques Vite Firebase sont autorisees.

## D006 - Isolation stricte par companyId

Decision : toutes les donnees metier doivent porter ou respecter un `companyId`.

Raison : eviter qu'un technicien d'une entreprise accede aux informations d'une autre entreprise.

Impact : les requetes Firestore doivent filtrer par `companyId`, les regles Firebase doivent refuser les lectures/ecritures hors entreprise, et le `companyId` ne doit pas etre modifiable apres creation.

## D007 - Pas de dependance IA forte maintenant

Decision : creer une interface `AiService`, mais ne brancher aucun fournisseur pour l'instant.

Raison : l'application doit rester utilisable sans IA. Les fonctions IA sont futures, optionnelles et ne doivent pas bloquer le coeur metier.

Impact : ne pas simuler de fausses analyses IA. Afficher clairement qu'une fonction est prevue mais non activee.

## D008 - Rapport PDF provisoire par impression navigateur

Decision : produire un rapport imprimable via `window.print()` pour le noyau initial.

Raison : livrer rapidement un flux de rapport sans introduire tout de suite une dependance PDF complexe.

Impact : une vraie generation PDF devra remplacer ou completer ce mecanisme avant la version 1.0.

## D009 - Premiere entreprise non creee par le client

Decision : les regles Firebase refusent la creation libre de `companies` depuis le client.

Raison : laisser un utilisateur choisir son propre `companyId` serait dangereux.

Impact : le bootstrap de la premiere entreprise et du premier administrateur doit passer par la console Firebase ou un script admin serveur.

## D010 - Bibliotheque Technique sans telechargement massif initial

Decision : construire d'abord l'architecture documentaire, la recherche, l'import de dossier et l'interface, sans remplir la base avec des documents constructeurs.

Raison : Polaris doit pouvoir gerer des dizaines de milliers de documents a terme. Charger des fichiers avant d'avoir les modeles, les tags, les liens equipement et les statuts d'indexation rendrait la migration plus couteuse.

Impact : les documents portent des metadonnees riches (`brand`, `productFamily`, `model`, `manufacturerReference`, `keywords`, `tags`, `language`, `version`, `year`) et un `searchIndex`. Les fichiers importes passent par des candidats validables avant d'entrer dans la bibliotheque.

## D011 - Preparation RAG sans activer l'IA

Decision : ajouter uniquement les champs d'etat necessaires a une future indexation IA/RAG, sans extraire le contenu ni appeler de fournisseur IA.

Raison : l'assistant technique devra plus tard repondre depuis les notices, mais l'application doit rester fiable et explicite tant que l'indexation n'est pas implementee.

Impact : chaque document possede un `indexStatus` et pourra recevoir des chunks/embeddings plus tard. Aucune reponse IA documentaire ne doit etre affichee avant une vraie chaine d'indexation et de validation.

## D012 - Identification equipement par service remplacable

Decision : construire l'ecran d'identification et le contrat `IdentificationService` avec un fournisseur mock uniquement.

Raison : l'experience terrain peut etre validee avant de choisir la technologie OCR/Vision. Le mock evite de presenter une fausse IA tout en permettant de developper la capture, le recadrage, la rotation, la fiche resultat et les futures actions.

Impact : toute future IA devra remplacer le service sans imposer de changement majeur a l'ecran. Les resultats doivent toujours conserver le niveau de confiance et les zones detectees pour permettre la verification humaine.
