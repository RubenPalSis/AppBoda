/**
 * Capa de datos de fotografías (Firestore + Storage).
 * La usan tanto la galería de invitados como el panel de administración.
 */
import { weddingConfig } from "./wedding-config.js";
import {
    db, storage, collection, doc, setDoc, deleteDoc, getDocs, query, orderBy, limit,
    onSnapshot, serverTimestamp, writeBatch, ref, uploadBytes, uploadBytesResumable,
    getDownloadURL, deleteObject
} from "./firebase-config.js";

export const PHOTOS = "photos";
const basePath = `weddings/${weddingConfig.weddingId}`;

function toPhoto(snapshot) {
    const data = snapshot.data({ serverTimestamps: "estimate" });
    return { id: snapshot.id, ...data, createdAt: data.createdAt?.toDate?.() || null };
}

/**
 * Escucha las fotos en tiempo real (más recientes primero).
 * @param {number|null} max  número máximo de fotos (null = todas)
 */
export function subscribePhotos(max, onData, onError) {
    const constraints = [orderBy("createdAt", "desc")];
    if (max) constraints.push(limit(max));
    const q = query(collection(db, PHOTOS), ...constraints);
    return onSnapshot(q, snap => onData(snap.docs.map(toPhoto), snap), onError);
}

/**
 * Sube una foto ya comprimida (y su miniatura) y crea su documento en Firestore.
 * @param {{blob: Blob, thumbBlob: Blob, width: number, height: number}} processed
 * @param {string} photoId
 * @param {string} uid
 * @param {(fraction:number)=>void} onProgress
 */
export async function uploadPhoto(processed, photoId, uid, onProgress = () => {}) {
    const storagePath = `${basePath}/photos/${photoId}.jpg`;
    const thumbPath = `${basePath}/thumbs/${photoId}.jpg`;
    const metadata = {
        contentType: "image/jpeg",
        cacheControl: "public, max-age=31536000, immutable",
        customMetadata: { ownerId: uid }
    };

    const thumbRef = ref(storage, thumbPath);
    const photoRef = ref(storage, storagePath);

    await uploadBytes(thumbRef, processed.thumbBlob, metadata);
    onProgress(0.1);

    await new Promise((resolve, reject) => {
        const task = uploadBytesResumable(photoRef, processed.blob, metadata);
        task.on("state_changed",
            s => onProgress(0.1 + 0.85 * (s.bytesTransferred / s.totalBytes)),
            reject,
            resolve);
    });

    try {
        const [downloadURL, thumbURL] = await Promise.all([getDownloadURL(photoRef), getDownloadURL(thumbRef)]);
        await setDoc(doc(db, PHOTOS, photoId), {
            storagePath,
            thumbPath,
            downloadURL,
            thumbURL,
            ownerId: uid,
            createdAt: serverTimestamp(),
            likes: 0,
            width: processed.width,
            height: processed.height,
            size: processed.blob.size
        });
        onProgress(1);
    } catch (err) {
        // Si falla el documento, no dejamos archivos huérfanos.
        await Promise.allSettled([deleteObject(photoRef), deleteObject(thumbRef)]);
        throw err;
    }
}

async function deleteFile(path) {
    if (!path) return;
    try {
        await deleteObject(ref(storage, path));
    } catch (err) {
        if (err.code !== "storage/object-not-found") throw err;
    }
}

/**
 * Elimina una foto: 1) documento de Firestore, 2) archivos de Storage.
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
    await deleteDoc(doc(db, PHOTOS, photo.id));
    await Promise.all([deleteFile(photo.storagePath), deleteFile(photo.thumbPath)]);
}
