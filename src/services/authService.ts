import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from "firebase/auth";
import { createFirebaseServices } from "./firebaseClient";

export interface AuthSession {
  mode: "local" | "firebase";
  userId: string;
  email: string;
}

export interface SignInResult {
  session: AuthSession;
  fallbackReason?: string;
}

const LOCAL_USER_ID = "user-mila";

export function getFirebaseAuthState(callback: (user: User | null) => void): (() => void) | null {
  const firebase = createFirebaseServices();
  if (!firebase) return null;
  return onAuthStateChanged(firebase.auth, callback);
}

export async function signIn(email: string, password: string): Promise<SignInResult> {
  const firebase = createFirebaseServices();
  if (!firebase) {
    return {
      session: {
        mode: "local",
        userId: LOCAL_USER_ID,
        email
      },
      fallbackReason: "Firebase n'est pas configure. Mode local actif."
    };
  }

  const credential = await signInWithEmailAndPassword(firebase.auth, email, password);
  return {
    session: {
      mode: "firebase",
      userId: credential.user.uid,
      email: credential.user.email || email
    }
  };
}

export async function signOutCurrentSession(): Promise<void> {
  const firebase = createFirebaseServices();
  if (firebase) {
    await signOut(firebase.auth);
  }
}
