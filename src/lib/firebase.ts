import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signInAnonymously, User } from "firebase/auth";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";
import appletConfig from "../../firebase-applet-config.json";

const env = typeof import.meta !== 'undefined' && (import.meta as any).env ? (import.meta as any).env : {};

const firebaseConfig = {
  projectId: env.VITE_FIREBASE_PROJECT_ID || appletConfig?.projectId || "",
  appId: env.VITE_FIREBASE_APP_ID || appletConfig?.appId || "",
  apiKey: env.VITE_FIREBASE_API_KEY || appletConfig?.apiKey || "",
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || appletConfig?.authDomain || "",
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || appletConfig?.storageBucket || "",
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || appletConfig?.messagingSenderId || "",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

if (typeof window !== 'undefined') {
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn('Firestore persistence failed-precondition: multiple tabs open');
    } else if (err.code === 'unimplemented') {
      console.warn('Firestore persistence unimplemented in browser');
    }
  });
}
export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('https://www.googleapis.com/auth/calendar');
googleProvider.addScope('https://www.googleapis.com/auth/spreadsheets');
googleProvider.addScope('https://mail.google.com/');
googleProvider.addScope('https://www.googleapis.com/auth/forms.body');
googleProvider.addScope('https://www.googleapis.com/auth/forms.body.readonly');
googleProvider.addScope('https://www.googleapis.com/auth/forms.responses.readonly');
googleProvider.addScope('https://www.googleapis.com/auth/tasks');
googleProvider.addScope('https://www.googleapis.com/auth/tasks.readonly');
googleProvider.addScope('https://www.googleapis.com/auth/drive');
googleProvider.addScope('https://www.googleapis.com/auth/drive.file');
googleProvider.addScope('https://www.googleapis.com/auth/drive.readonly');

let isSigningIn = false;
let cachedAccessToken: string | null = null;

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get access token from Firebase Auth');
    }

    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    if (
      error.code === 'auth/popup-closed-by-user' ||
      error.code === 'auth/cancelled-popup-request' ||
      error.code === 'auth/user-cancelled'
    ) {
      console.warn('Google sign-in popup cancelled or closed by user.');
      return null;
    }
    if (error.code === 'auth/operation-not-allowed') {
      console.warn('Google Sign-In is disabled in Firebase Console.');
      throw new Error('Google Sign-In is not enabled in Firebase Console (Authentication > Sign-in method).');
    }
    if (error.code === 'auth/network-request-failed') {
      console.warn('Firebase Google Auth network request failed.');
      throw new Error('Network error. Please check your internet connection and try again.');
    }
    console.error('Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const logout = async () => {
  await auth.signOut();
  cachedAccessToken = null;
};

export const ensureAuthUser = async (): Promise<User> => {
  if (auth.currentUser) {
    return auth.currentUser;
  }

  if (typeof (auth as any).authStateReady === 'function') {
    try {
      await (auth as any).authStateReady();
      if (auth.currentUser) {
        return auth.currentUser;
      }
    } catch (e) {
      console.warn('authStateReady error:', e);
    }
  }

  try {
    const cred = await signInAnonymously(auth);
    return cred.user;
  } catch (err: any) {
    console.warn('Anonymous sign in failed or disabled:', err?.message || err);
    if (err?.code === 'auth/operation-not-allowed') {
      console.warn('Anonymous authentication is disabled in Firebase Console.');
    }
    throw new Error('Please sign in to proceed with payment.');
  }
};
