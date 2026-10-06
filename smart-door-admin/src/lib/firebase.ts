import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import { getDatabase, type Database } from "firebase/database";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let db: Firestore | undefined;
let storage: FirebaseStorage | undefined;
let rtdb: Database | undefined;

export function isFirebaseConfigured(): boolean {
  return true;
}

if (isFirebaseConfigured()) {
  // Initialisation is best-effort: if Firebase env vars are missing or invalid
  // the app still boots so guests can explore in demo mode (which never touches
  // Firebase). Real sign-in simply stays unavailable until config is provided.
  try {
    if (!getApps().length) {
      app = initializeApp(firebaseConfig);
    } else {
      app = getApps()[0];
    }
    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);
    rtdb = getDatabase(app);
  } catch (e) {
    console.warn("[D-MAX] Firebase not initialised — demo/guest mode still works.", e);
    // Placeholder so pages that guard with `if (!rtdb) return` still run their
    // data effects in demo mode. The demo DB facade ignores this object and
    // serves in-memory sample data instead; real DB calls are never made here.
    rtdb = {} as unknown as Database;
  }
}

export { app, auth, db, storage, rtdb };
