/**
 * Likes: un like por dispositivo y foto.
 *
 * Estructura: photos/{photoId}/likes/{uid}
 * El like y el contador se escriben en un mismo lote atómico. Las reglas de Firestore
 * solo aceptan +1 si se crea el documento del like del propio UID y -1 si se borra,
 * así que el contador no se puede manipular desde el navegador.
 */
import { db, doc, getDoc, writeBatch, serverTimestamp, increment } from "./firebase-config.js";
import { currentUid } from "./auth.js";
import { PHOTOS } from "./photos.js";

const likedCache = new Map(); // photoId -> boolean

export async function hasLiked(photoId) {
    if (likedCache.has(photoId)) return likedCache.get(photoId);
    const uid = currentUid();
    if (!uid) return false;
    const snap = await getDoc(doc(db, PHOTOS, photoId, "likes", uid));
    likedCache.set(photoId, snap.exists());
    return snap.exists();
}

/** Da o quita el like. Devuelve el nuevo estado (true = me gusta). */
export async function toggleLike(photoId) {
    const uid = currentUid();
    if (!uid) throw new Error("Sin sesión");
    const liked = await hasLiked(photoId);
    const photoRef = doc(db, PHOTOS, photoId);
    const likeRef = doc(db, PHOTOS, photoId, "likes", uid);
    const batch = writeBatch(db);
    if (liked) {
        batch.delete(likeRef);
        batch.update(photoRef, { likes: increment(-1) });
    } else {
        batch.set(likeRef, { createdAt: serverTimestamp() });
        batch.update(photoRef, { likes: increment(1) });
    }
    await batch.commit();
    likedCache.set(photoId, !liked);
    return !liked;
}
