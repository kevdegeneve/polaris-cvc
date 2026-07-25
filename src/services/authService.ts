import { collection, doc, getDoc, getDocs, setDoc, updateDoc } from "firebase/firestore";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type AuthError,
  type User
} from "firebase/auth";
import type { AuthorizedUser, UserRole } from "../domain/types";
import { removeUndefinedFields } from "./firestoreData";
import { createFirebaseServices } from "./firebaseClient";
import { hasConfiguredLanguage } from "./languageService";

export const ACCESS_NOT_AUTHORIZED_MESSAGE =
  "Votre compte Google est valide, mais vous n'avez pas encore ete autorise a acceder a Polaris CVC. Contactez un administrateur.";
export const ACCESS_DISABLED_MESSAGE = "Votre acces a Polaris CVC a ete desactive.";

export interface AuthSession {
  mode: "firebase";
  userId: string;
  email: string;
  emailNormalized: string;
  displayName: string;
  photoURL?: string;
  role: string;
  companyId: string;
  preferredLanguage?: string;
  preferredLanguageLabel?: string;
}

export interface UserProfileData {
  uid: string;
  email: string;
  emailNormalized: string;
  displayName: string;
  photoURL?: string;
  companyId: string;
  role: string;
  createdAt: string;
  lastLoginAt: string;
  isActive: boolean;
  preferredLanguage?: string;
  preferredLanguageLabel?: string;
  languageConfiguredAt?: string;
  updatedAt?: string;
}

export class AuthAccessDeniedError extends Error {
  constructor(
    message: string,
    public readonly email: string
  ) {
    super(message);
    this.name = "AuthAccessDeniedError";
  }
}

export function normalizeAuthorizedEmail(email: string): string {
  return email.trim().toLowerCase().replace(/\//g, "%2f");
}

export function getFirebaseAuthState(callback: (user: User | null) => void): (() => void) | null {
  const firebase = createFirebaseServices();
  if (!firebase) return null;
  return onAuthStateChanged(firebase.auth, callback);
}

export async function signInWithGoogle(): Promise<AuthSession> {
  const firebase = createFirebaseServices();
  if (!firebase) {
    throw new Error("Firebase n'est pas configure. Renseignez les variables d'environnement avant de vous connecter.");
  }

  try {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    const credential = await signInWithPopup(firebase.auth, provider);
    return await ensureUserProfile(credential.user);
  } catch (error) {
    if (error instanceof AuthAccessDeniedError) {
      await signOut(firebase.auth);
      throw error;
    }
    throw new Error(getAuthErrorMessage(error));
  }
}

export async function ensureUserProfile(user: User): Promise<AuthSession> {
  const firebase = createFirebaseServices();
  if (!firebase) {
    throw new Error("Firebase n'est pas configure.");
  }

  const email = user.email || "";
  const emailNormalized = normalizeAuthorizedEmail(email);
  if (!emailNormalized) {
    throw new AuthAccessDeniedError(ACCESS_NOT_AUTHORIZED_MESSAGE, email);
  }

  const authorization = await getAuthorizedUser(emailNormalized);
  if (!authorization || authorization.isActive !== true) {
    throw new AuthAccessDeniedError(authorization ? ACCESS_DISABLED_MESSAGE : ACCESS_NOT_AUTHORIZED_MESSAGE, email);
  }

  const timestamp = new Date().toISOString();
  const userRef = doc(firebase.db, "users", user.uid);
  const snapshot = await getDoc(userRef);
  const existing = snapshot.exists() ? (snapshot.data() as Partial<UserProfileData>) : null;
  if (existing?.isActive === false) {
    throw new AuthAccessDeniedError(ACCESS_DISABLED_MESSAGE, email);
  }

  const profile = createUserProfileData(user, authorization, existing, timestamp);
  await setDoc(userRef, removeUndefinedFields(profile), { merge: true });

  return {
    mode: "firebase",
    userId: user.uid,
    email: profile.email,
    emailNormalized: profile.emailNormalized,
    displayName: profile.displayName,
    photoURL: profile.photoURL,
    role: profile.role,
    companyId: profile.companyId,
    preferredLanguage: profile.preferredLanguage,
    preferredLanguageLabel: profile.preferredLanguageLabel
  };
}

export async function getAuthorizedUser(emailNormalized: string): Promise<AuthorizedUser | null> {
  const firebase = createFirebaseServices();
  if (!firebase) throw new Error("Firebase n'est pas configure.");
  const snapshot = await getDoc(doc(firebase.db, "authorizedUsers", emailNormalized));
  return snapshot.exists() ? (snapshot.data() as AuthorizedUser) : null;
}

export function createUserProfileData(
  user: Pick<User, "uid" | "email" | "displayName" | "photoURL">,
  authorization: AuthorizedUser,
  existing: Partial<UserProfileData> | null,
  timestamp: string
): UserProfileData {
  const profile: UserProfileData = {
    uid: user.uid,
    email: user.email || authorization.email,
    emailNormalized: authorization.emailNormalized,
    displayName: user.displayName || user.email || "Utilisateur Polaris",
    companyId: authorization.companyId,
    role: authorization.role,
    createdAt: typeof existing?.createdAt === "string" ? existing.createdAt : timestamp,
    lastLoginAt: timestamp,
    isActive: authorization.isActive,
    updatedAt: timestamp
  };

  if (typeof user.photoURL === "string" && user.photoURL) {
    profile.photoURL = user.photoURL;
  }
  if (hasConfiguredLanguage(existing?.preferredLanguage)) {
    profile.preferredLanguage = existing.preferredLanguage;
    if (typeof existing?.preferredLanguageLabel === "string" && existing.preferredLanguageLabel) {
      profile.preferredLanguageLabel = existing.preferredLanguageLabel;
    }
    if (typeof existing?.languageConfiguredAt === "string" && existing.languageConfiguredAt) {
      profile.languageConfiguredAt = existing.languageConfiguredAt;
    }
  }

  return profile;
}

export function canAccessBusinessScreens(session: AuthSession | null): boolean {
  return Boolean(session?.userId && session.companyId && session.role);
}

export function canManageAuthorizedUsers(session: Pick<AuthSession, "role"> | null): boolean {
  return session?.role === "admin" || session?.role === "administrateur";
}

export async function listAuthorizedUsers(session: AuthSession): Promise<AuthorizedUser[]> {
  assertCanManageAuthorizedUsers(session);
  const firebase = createFirebaseServices();
  if (!firebase) throw new Error("Firebase n'est pas configure.");
  const snapshot = await getDocs(collection(firebase.db, "authorizedUsers"));
  return snapshot.docs.map((item) => item.data() as AuthorizedUser);
}

export async function inviteAuthorizedUser(session: AuthSession, user: Omit<AuthorizedUser, "emailNormalized" | "invitedAt" | "invitedBy">): Promise<void> {
  assertCanManageAuthorizedUsers(session);
  const firebase = createFirebaseServices();
  if (!firebase) throw new Error("Firebase n'est pas configure.");
  const emailNormalized = normalizeAuthorizedEmail(user.email);
  await setDoc(doc(firebase.db, "authorizedUsers", emailNormalized), removeUndefinedFields({
    ...user,
    emailNormalized,
    invitedAt: new Date().toISOString(),
    invitedBy: session.userId
  }));
}

export async function updateAuthorizedUser(session: AuthSession, email: string, update: Partial<Pick<AuthorizedUser, "companyId" | "role" | "isActive">>): Promise<void> {
  assertCanManageAuthorizedUsers(session);
  const firebase = createFirebaseServices();
  if (!firebase) throw new Error("Firebase n'est pas configure.");
  await updateDoc(doc(firebase.db, "authorizedUsers", normalizeAuthorizedEmail(email)), removeUndefinedFields({
    ...update,
    updatedAt: new Date().toISOString()
  }));
}

export async function disableAuthorizedUser(session: AuthSession, email: string): Promise<void> {
  await updateAuthorizedUser(session, email, { isActive: false });
}

export async function signOutCurrentSession(): Promise<void> {
  const firebase = createFirebaseServices();
  if (firebase) {
    await signOut(firebase.auth);
  }
}

export function getAuthErrorMessage(error: unknown): string {
  if (error instanceof AuthAccessDeniedError) return error.message;
  const code = typeof (error as AuthError | undefined)?.code === "string" ? (error as AuthError).code : "";

  switch (code) {
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "Connexion annulee. La fenetre Google a ete fermee avant la fin.";
    case "auth/popup-blocked":
      return "La fenetre de connexion a ete bloquee par le navigateur. Autorisez les popups pour Polaris.";
    case "auth/network-request-failed":
      return "Connexion impossible. Verifiez votre connexion Internet puis reessayez.";
    case "auth/unauthorized-domain":
      return "Ce domaine n'est pas autorise dans Firebase Authentication.";
    case "auth/user-disabled":
      return ACCESS_DISABLED_MESSAGE;
    case "auth/operation-not-allowed":
      return "La connexion Google n'est pas activee dans Firebase Authentication.";
    case "auth/account-exists-with-different-credential":
      return "Un compte existe deja avec cette adresse email via une autre methode de connexion.";
    default:
      if (error instanceof Error && error.message) return error.message;
      return "Connexion impossible pour le moment. Reessayez dans quelques instants.";
  }
}

function assertCanManageAuthorizedUsers(session: AuthSession): void {
  if (!canManageAuthorizedUsers(session)) {
    throw new Error("Seul un administrateur actif peut gerer les autorisations.");
  }
}

export function buildAuthorizedUser(email: string, companyId: string, role: UserRole, isActive = true): AuthorizedUser {
  return {
    email: email.trim().toLowerCase(),
    emailNormalized: normalizeAuthorizedEmail(email),
    companyId,
    role,
    isActive
  };
}
