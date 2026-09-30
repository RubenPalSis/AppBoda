/**
 * Acceso de invitados.
 *
 * 1. El código de la boda es una barrera de la INTERFAZ (se guarda en localStorage).
 * 2. La identidad real del dispositivo es un usuario ANÓNIMO de Firebase Authentication:
 *    no pide ni guarda ningún dato personal, pero da un UID único que las reglas de
 *    seguridad pueden comprobar (request.auth.uid). Así nadie puede borrar fotos ajenas
 *    ni duplicar likes aunque modifique el JavaScript.
 */
import { weddingConfig } from "./wedding-config.js";
import { auth, authReady, signInAnonymously } from "./firebase-config.js";

const KEY_AUTHORIZED = `wedding:${weddingConfig.weddingId}:authorized`;
const KEY_GUEST_ID = `wedding:${weddingConfig.weddingId}:guestId`;

const normalize = str => String(str || "").trim().toLowerCase();

/** Comprueba el código (sin distinguir mayúsculas/minúsculas ni espacios). */
export function checkAccessCode(code) {
    return normalize(code) === normalize(weddingConfig.accessCode);
}

export function isDeviceAuthorized() {
    try { return localStorage.getItem(KEY_AUTHORIZED) === "1"; } catch { return false; }
}

export function authorizeDevice() {
    try { localStorage.setItem(KEY_AUTHORIZED, "1"); } catch { /* modo privado */ }
}

/**
 * "Cerrar sesión": vuelve a pedir el código. No se borra la identidad anónima para
 * que el dispositivo pueda seguir eliminando sus propias fotos si vuelve a entrar.
 */
export function logoutGuest() {
    try { localStorage.removeItem(KEY_AUTHORIZED); } catch { /* noop */ }
}

/** Garantiza que hay una sesión (anónima) de Firebase y devuelve el UID. */
export async function ensureGuestSession() {
    let user = await authReady();
    if (!user) {
        const cred = await signInAnonymously(auth);
        user = cred.user;
    }
    try { localStorage.setItem(KEY_GUEST_ID, `guest_${user.uid}`); } catch { /* noop */ }
    return user.uid;
}

/** UID del dispositivo actual (null si aún no hay sesión). */
export function currentUid() {
    return auth.currentUser?.uid || null;
}

/** Identificador anónimo legible del dispositivo: guest_xxxxxxxx */
export function getGuestId() {
    try { return localStorage.getItem(KEY_GUEST_ID); } catch { return null; }
}
