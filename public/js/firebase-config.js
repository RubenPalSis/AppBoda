/**
 * ============================================================
 *  CONFIGURACIÓN DE FIREBASE
 * ============================================================
 *  Proyecto: appboda-ivan-angela
 *  Sustituye los valores "TU_..." por los de tu proyecto (README →
 *  "Configuración de Firebase paso a paso", pasos 3 y 11):
 *  Firebase Console → ⚙️ Configuración del proyecto → General →
 *  "Tus apps" → (tu app web) → "Configuración del SDK" → Config.
 *  Mientras quede algún "TU_..." la app muestra "Falta configurar Firebase".
 *
 *  Estos valores NO son secretos (son públicos en cualquier app web
 *  de Firebase). La seguridad está en firestore.rules.
 *
 *  Plan Spark (gratuito): la app NO usa Cloud Storage. Las fotos se guardan
 *  dentro de Firestore, así que "storageBucket" no hace falta.
 * ============================================================
 */
const firebaseConfig = {
    apiKey: "AIzaSyAm8AxYoO1UuYz9HB_AKznEKZX2hJBgF2w",
    authDomain: "appboda-ivan-angela.firebaseapp.com",
    projectId: "appboda-ivan-angela",
    messagingSenderId: "439284115319",
    appId: "1:439284115319:web:55e79a3bd30fdd2abca372"
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
    initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
    connectFirestoreEmulator, collection, doc, getDoc, setDoc, deleteDoc,
    getDocs, query, orderBy, limit, startAfter, onSnapshot, serverTimestamp, increment,
    writeBatch, Bytes
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export const isFirebaseConfigured = !Object.values(firebaseConfig).some(v => String(v).startsWith("TU_"));

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
// Caché persistente en el dispositivo (IndexedDB): al volver a abrir la app, Firestore
// solo cobra como lecturas los cambios, no todo el bloque de fotos (plan Spark:
// 50.000 lecturas/día). Si el navegador no lo admite, el SDK usa la memoria.
export const db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});

if (USE_EMULATORS) {
    connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
    connectFirestoreEmulator(db, "127.0.0.1", 8080);
}

export {
    onAuthStateChanged, signInAnonymously, signInWithEmailAndPassword, sendPasswordResetEmail, signOut,
    collection, doc, getDoc, setDoc, deleteDoc, getDocs, query, orderBy, limit, startAfter,
    onSnapshot, serverTimestamp, increment, writeBatch, Bytes
};

/** Resuelve con el usuario actual cuando Firebase Auth ha terminado de inicializarse. */
export function authReady() {
    return new Promise(resolve => {
        const unsub = onAuthStateChanged(auth, user => { unsub(); resolve(user); });
    });
}
