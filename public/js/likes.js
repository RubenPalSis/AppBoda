/**
 * Likes: un like por dispositivo y foto.
 *
 * Estructura: photos/{photoId}/likes/{uid}
 * El like y el contador se escriben en un mismo lote atómico. Las reglas de Firestore
 * solo aceptan +1 si se crea el documento del like del propio UID y -1 si se borra,
 * así que el contador no se puede manipular desde el navegador.
 *
 * Para ahorrar lecturas (plan Spark), el dispositivo recuerda en localStorage a qué
 * fotos ha dado like en lugar de preguntarlo a Firestore por cada foto que se muestra.
 * Si esa memoria se pierde, las reglas impiden el like duplicado y se corrige aquí.
 */
import { weddingConfig } from "./wedding-config.js";
import { db, doc, getDoc, writeBatch, serverTimestamp, increment } from "./firebase-config.js";
import { currentUid } from "./auth.js";
import { PHOTOS, adjustLikes } from "./photos.js";

let cache = { uid: null, set: new Set() };

function key(uid) {
    return `wedding:${weddingConfig.weddingId}:liked:${uid}`;
}

function likedSet() {
    const uid = currentUid();
    if (cache.uid !== uid) {
        let ids = [];
        try { ids = JSON.parse(localStorage.getItem(key(uid)) || "[]"); } catch { /* sin almacenamiento */ }
        cache = { uid, set: new Set(ids) };
    }
    return cache.set;
}

function remember(photoId, liked) {
    const set = likedSet();
    liked ? set.add(photoId) : set.delete(photoId);
    try { localStorage.setItem(key(cache.uid), JSON.stringify([...set])); } catch { /* noop */ }
}

export function isLiked(photoId) {
    return likedSet().has(photoId);
}

function commit(photoId, uid, like) {
    const photoRef = doc(db, PHOTOS, photoId);
    const likeRef = doc(db, PHOTOS, photoId, "likes", uid);
    const batch = writeBatch(db);
    if (like) {
        batch.set(likeRef, { createdAt: serverTimestamp() });
        batch.update(photoRef, { likes: increment(1) });
    } else {
        batch.delete(likeRef);
        batch.update(photoRef, { likes: increment(-1) });
    }
    return batch.commit();
}

/** Da o quita el like. Devuelve el nuevo estado (true = me gusta). */
export async function toggleLike(photoId) {
    const uid = currentUid();
    if (!uid) throw new Error("Sin sesión");
    const want = !isLiked(photoId);
    let delta = want ? 1 : -1;
    remember(photoId, want); // optimista: el corazón cambia al instante
    try {
        await commit(photoId, uid, want);
    } catch (err) {
        const exists = String(err.code || "").includes("permission-denied")
            // La memoria local no coincidía con el servidor: se consulta (1 lectura) y se corrige.
            ? (await getDoc(doc(db, PHOTOS, photoId, "likes", uid)).catch(() => null))?.exists()
            : null;
        if (exists !== want) {
            remember(photoId, !want);
            throw err;
        }
        delta = 0; // ya estaba así en el servidor: el contador no cambia
    }
    adjustLikes(photoId, delta);
    // delta: cambio real del contador (0 si el servidor ya estaba así).
    window.dispatchEvent(new CustomEvent("photo:liked", { detail: { id: photoId, liked: want, delta } }));
    return want;
}
