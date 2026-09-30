/**
 * ============================================================
 *  CONFIGURACIÓN DE FIREBASE
 * ============================================================
 *  Sustituye los valores "TU_..." por los de tu proyecto:
 *  Firebase Console → ⚙️ Configuración del proyecto → General →
 *  "Tus apps" → (tu app web) → "Configuración del SDK" → Config.
 *
 *  Estos valores NO son secretos (son públicos en cualquier app web
 *  de Firebase). La seguridad está en firestore.rules y storage.rules.
 * ============================================================
 */
const firebaseConfig = {
    apiKey: "TU_API_KEY",
    authDomain: "TU_AUTH_DOMAIN",
    projectId: "TU_PROJECT_ID",
    storageBucket: "TU_STORAGE_BUCKET",
    messagingSenderId: "TU_MESSAGING_SENDER_ID",
    appId: "TU_APP_ID"
};

// Pon true para usar los emuladores locales (firebase emulators:start).
const USE_EMULATORS = false;

// ------------------------------------------------------------
// A partir de aquí no hace falta tocar nada.
// Versión única del SDK para toda la app (se carga desde el CDN oficial).
// ------------------------------------------------------------
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
    getAuth, connectAuthEmulator, onAuthStateChanged, signInAnonymously,
    signInWithEmailAndPassword, sendPasswordResetEmail, signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
    getFirestore, connectFirestoreEmulator, collection, doc, getDoc, setDoc, deleteDoc,
    getDocs, query, orderBy, limit, onSnapshot, serverTimestamp, increment, writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
    getStorage, connectStorageEmulator, ref, uploadBytes, uploadBytesResumable,
    getDownloadURL, deleteObject
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

export const isFirebaseConfigured = !Object.values(firebaseConfig).some(v => String(v).startsWith("TU_"));

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

if (USE_EMULATORS) {
    connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
    connectFirestoreEmulator(db, "127.0.0.1", 8080);
    connectStorageEmulator(storage, "127.0.0.1", 9199);
}

export {
    onAuthStateChanged, signInAnonymously, signInWithEmailAndPassword, sendPasswordResetEmail, signOut,
    collection, doc, getDoc, setDoc, deleteDoc, getDocs, query, orderBy, limit, onSnapshot,
    serverTimestamp, increment, writeBatch,
    ref, uploadBytes, uploadBytesResumable, getDownloadURL, deleteObject
};

/** Resuelve con el usuario actual cuando Firebase Auth ha terminado de inicializarse. */
export function authReady() {
    return new Promise(resolve => {
        const unsub = onAuthStateChanged(auth, user => { unsub(); resolve(user); });
    });
}
