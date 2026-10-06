/**
 * Capa de datos de fotografías (solo Firestore: la app funciona en el plan
 * gratuito Spark, que no incluye Cloud Storage).
 * La usan tanto la galería de invitados como el panel de administración.
 *
 * Cada foto son dos documentos, que se crean y se borran juntos en un lote atómico:
 *  - photos/{id}      → datos + miniatura (~20 KB). Es lo que lee la galería.
 *  - photoFiles/{id}  → la foto comprimida (máx. ~450 KB). Solo se lee al abrirla,
 *                       descargarla o generar el ZIP.
 * Las imágenes se guardan como bytes (tipo Bytes de Firestore), no como URLs.
 */
import { weddingConfig } from "./wedding-config.js";
import {
    db, collection, doc, getDoc, getDocs, query, where, orderBy, limit, startAfter,
    onSnapshot, serverTimestamp, writeBatch, Bytes, Timestamp
} from "./firebase-config.js";

export const PHOTOS = "photos";
export const PHOTO_FILES = "photoFiles";

const JPEG = "image/jpeg";
const store = new Map();       // id -> objeto foto compartido por todas las vistas
const thumbUrls = new Map();   // id -> blob: URL de la miniatura
const fullUrls = new Map();    // id -> blob: URL de la foto completa (caché limitada)
const MAX_FULL_CACHED = 25;

function bytesToUrl(bytes) {
    return URL.createObjectURL(new Blob([bytes.toUint8Array()], { type: JPEG }));
}

function thumbUrl(id, bytes) {
    // Solo bytes reales: un documento mal formado (que las reglas rechazarán) se ignora.
    if (!thumbUrls.has(id) && typeof bytes?.toUint8Array === "function") thumbUrls.set(id, bytesToUrl(bytes));
    return thumbUrls.get(id) || "";
}

/** Libera la memoria de una foto que ya no se muestra (borrada). */
export function releasePhoto(id) {
    store.delete(id);
    for (const map of [thumbUrls, fullUrls]) {
        if (map.has(id)) { URL.revokeObjectURL(map.get(id)); map.delete(id); }
    }
}

/**
 * Convierte un documento en el objeto foto. Siempre devuelve el MISMO objeto para el
 * mismo id (actualizando sus campos), así el feed, el tablón, las historias y el visor
 * comparten likes y estado.
 */
function toPhoto(snapshot) {
    const { thumb, createdAt, ...data } = snapshot.data({ serverTimestamps: "estimate" });
    const fresh = {
        id: snapshot.id,
        ...data,
        createdAtTs: createdAt || null,                 // Timestamp, para paginar
        createdAt: createdAt?.toDate?.() || null,
        thumbURL: thumbUrl(snapshot.id, thumb)
    };
    const existing = store.get(snapshot.id);
    if (existing) return Object.assign(existing, fresh);
    store.set(snapshot.id, fresh);
    return fresh;
}

/**
 * Aplica un cambio de likes hecho desde este dispositivo a una foto que NO está en una
 * escucha en tiempo real (en las que sí lo están, Firestore ya lo aplica solo).
 */
export function adjustLikes(id, delta) {
    const photo = store.get(id);
    if (photo && !photo.live) photo.likes = Math.max(0, (photo.likes || 0) + delta);
}

const newestFirst = orderBy("createdAt", "desc");

/**
 * Escucha en tiempo real las fotos más recientes.
 * @param {number|null} max  número máximo de fotos (null = todas, para el panel de admin)
 * @param {(photos: object[], removedIds: string[], snap) => void} onData
 *        removedIds: fotos que han salido del resultado (borradas o desplazadas por otras más nuevas)
 */
export function subscribePhotos(max, onData, onError) {
    const constraints = [newestFirst];
    if (max) constraints.push(limit(max));
    const q = query(collection(db, PHOTOS), ...constraints);
    return onSnapshot(q, snap => {
        const removed = snap.docChanges().filter(c => c.type === "removed").map(c => toPhoto(c.doc));
        removed.forEach(p => { p.live = false; });
        const list = snap.docs.map(toPhoto);
        list.forEach(p => { p.live = true; });
        onData(list, removed, snap);
    }, onError);
}

/**
 * Carga (una sola vez, sin tiempo real) las fotos anteriores a una dada.
 * Así el scroll infinito solo lee las fotos nuevas que se muestran, sin volver a
 * leer las que ya estaban cargadas (importante para la cuota diaria de Spark).
 */
export async function fetchOlderPhotos(beforeTs, max) {
    const q = query(collection(db, PHOTOS), newestFirst, startAfter(beforeTs), limit(max));
    const snap = await getDocs(q);
    return snap.docs.map(toPhoto);
}

/**
 * Fotos subidas entre dos fechas, de más antigua a más reciente (historias por momento).
 * Solo usa el índice automático de createdAt.
 */
export async function fetchPhotosBetween(start, end, max) {
    const q = query(collection(db, PHOTOS),
        where("createdAt", ">=", Timestamp.fromDate(start)),
        where("createdAt", "<", Timestamp.fromDate(end)),
        orderBy("createdAt", "asc"),
        limit(max));
    return (await getDocs(q)).docs.map(toPhoto);
}

/** Las fotos con más likes (historia "Las más queridas"). */
export async function fetchTopPhotos(max) {
    const q = query(collection(db, PHOTOS), orderBy("likes", "desc"), limit(max));
    return (await getDocs(q)).docs.map(toPhoto).filter(p => p.likes > 0);
}

/** Devuelve la foto completa como Blob (sin caché; lo usa el ZIP del administrador). */
export async function getFullImageBlob(id) {
    const snap = await getDoc(doc(db, PHOTO_FILES, id));
    if (!snap.exists() || typeof snap.data().data?.toUint8Array !== "function") {
        const err = new Error("La foto ya no existe");
        err.code = "not-found";
        throw err;
    }
    return new Blob([snap.data().data.toUint8Array()], { type: JPEG });
}

/** Devuelve una URL (blob:) de la foto completa. Se guardan en memoria las últimas abiertas. */
export async function getFullImageUrl(id) {
    if (fullUrls.has(id)) {
        const url = fullUrls.get(id);
        fullUrls.delete(id);
        fullUrls.set(id, url); // la marca como usada recientemente
        return url;
    }
    const url = URL.createObjectURL(await getFullImageBlob(id));
    fullUrls.set(id, url);
    if (fullUrls.size > MAX_FULL_CACHED) {
        const [oldId, oldUrl] = fullUrls.entries().next().value;
        URL.revokeObjectURL(oldUrl);
        fullUrls.delete(oldId);
    }
    return url;
}

async function blobToBytes(blob) {
    return Bytes.fromUint8Array(new Uint8Array(await blob.arrayBuffer()));
}

/**
 * Guarda una foto ya comprimida (y su miniatura): los dos documentos en un único lote atómico.
 * @param {{blob: Blob, thumbBlob: Blob, width: number, height: number}} processed
 * @param {string} photoId
 * @param {string} uid
 * @param {(fraction:number)=>void} onProgress
 */
export async function uploadPhoto(processed, photoId, uid, onProgress = () => {}) {
    const [data, thumb] = await Promise.all([blobToBytes(processed.blob), blobToBytes(processed.thumbBlob)]);
    onProgress(0.15);
    const batch = writeBatch(db);
    batch.set(doc(db, PHOTO_FILES, photoId), { ownerId: uid, data });
    batch.set(doc(db, PHOTOS, photoId), {
        ownerId: uid,
        createdAt: serverTimestamp(),
        likes: 0,
        width: processed.width,
        height: processed.height,
        size: processed.blob.size,
        thumb
    });
    await batch.commit();
    onProgress(1);
}

/**
 * Elimina una foto (datos + archivo) en un lote atómico.
 * @param {object} photo
 * @param {{purgeLikes?: boolean}} opts  purgeLikes solo lo puede hacer el administrador
 */
export async function deletePhoto(photo, { purgeLikes = false } = {}) {
    if (purgeLikes) {
        const likes = await getDocs(collection(db, PHOTOS, photo.id, "likes"));
        for (let i = 0; i < likes.docs.length; i += 450) {
            const batch = writeBatch(db);
            likes.docs.slice(i, i + 450).forEach(d => batch.delete(d.ref));
            await batch.commit();
        }
    }
    const batch = writeBatch(db);
    batch.delete(doc(db, PHOTOS, photo.id));
    batch.delete(doc(db, PHOTO_FILES, photo.id));
    await batch.commit();
    releasePhoto(photo.id);
}
