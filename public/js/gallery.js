/**
 * Galería de invitados (tiempo real, carga progresiva) y visor/lightbox.
 */
import { weddingConfig } from "./wedding-config.js";
import { $, showToast, confirmDialog, downloadPhoto, photoFilename, friendlyError } from "./utils.js";
import { currentUid } from "./auth.js";
import { subscribePhotos, deletePhoto } from "./photos.js";
import { hasLiked, toggleLike } from "./likes.js";

const pageSize = weddingConfig.gallery.pageSize;

let photos = [];
let maxPhotos = pageSize;
let hasMore = false;
let unsubscribe = null;
let loadingMore = false;
const tiles = new Map(); // id -> elemento
const els = {};

export function initGallery() {
    els.grid = $("#gallery-grid");
    els.empty = $("#gallery-empty");
    els.count = $("#gallery-count");
    els.sentinel = $("#gallery-sentinel");
    els.more = $("#gallery-more");
    els.empty.textContent = weddingConfig.texts.galleryEmpty;

    els.grid.addEventListener("click", e => {
        const tile = e.target.closest("[data-id]");
        if (tile) openLightbox(tile.dataset.id);
    });
    els.more.addEventListener("click", loadMore);

    // Scroll infinito: al acercarse al final se piden más fotos.
    if ("IntersectionObserver" in window) {
        new IntersectionObserver(entries => {
            if (entries.some(e => e.isIntersecting)) loadMore();
        }, { rootMargin: "600px" }).observe(els.sentinel);
    }

    initLightbox();
    subscribe();
}

function subscribe() {
    unsubscribe?.();
    unsubscribe = subscribePhotos(maxPhotos, list => {
        photos = list;
        hasMore = list.length >= maxPhotos;
        loadingMore = false;
        render();
        refreshLightbox();
    }, err => {
        console.error(err);
        loadingMore = false;
        showToast(friendlyError(err), "error", 6000);
    });
}

function loadMore() {
    if (!hasMore || loadingMore) return;
    loadingMore = true;
    maxPhotos += pageSize;
    subscribe();
}

function tileHtml(photo, isOwn) {
    return `
        <img src="${photo.thumbURL || photo.downloadURL}" alt="Foto de la boda" loading="lazy" decoding="async"
             width="${photo.width || 3}" height="${photo.height || 4}">
        ${isOwn ? `<span class="tile__own">Tuya</span>` : ""}
        <span class="tile__likes" aria-label="${photo.likes || 0} me gusta">❤️ ${photo.likes || 0}</span>`;
}

function render() {
    const uid = currentUid();
    const ids = new Set(photos.map(p => p.id));

    for (const [id, el] of tiles) {
        if (!ids.has(id)) { el.remove(); tiles.delete(id); }
    }
    photos.forEach(photo => {
        let el = tiles.get(photo.id);
        const key = `${photo.likes}|${photo.ownerId === uid}`;
        if (!el) {
            el = document.createElement("button");
            el.type = "button";
            el.className = "tile";
            el.dataset.id = photo.id;
            el.setAttribute("aria-label", "Ver foto");
            tiles.set(photo.id, el);
        }
        if (el.dataset.key !== key) {
            el.dataset.key = key;
            el.innerHTML = tileHtml(photo, photo.ownerId === uid);
        }
        els.grid.appendChild(el); // appendChild mueve el nodo si ya existe: mantiene el orden
    });

    els.empty.hidden = photos.length > 0;
    els.count.textContent = photos.length ? `${photos.length}${hasMore ? "+" : ""} ${photos.length === 1 ? "foto" : "fotos"}` : "";
    els.more.hidden = !hasMore;
}

/* ============================================================
 *  LIGHTBOX
 * ============================================================ */

const lb = { index: -1, id: null };

function initLightbox() {
    lb.root = $("#lightbox");
    lb.img = $("#lightbox-img");
    lb.likes = $("#lightbox-likes");
    lb.likeBtn = $("#lightbox-like");
    lb.downloadBtn = $("#lightbox-download");
    lb.deleteBtn = $("#lightbox-delete");
    lb.prev = $("#lightbox-prev");
    lb.next = $("#lightbox-next");
    lb.counter = $("#lightbox-counter");

    $("#lightbox-close").addEventListener("click", closeLightbox);
    lb.prev.addEventListener("click", () => step(-1));
    lb.next.addEventListener("click", () => step(1));
    lb.likeBtn.addEventListener("click", onLike);
    lb.downloadBtn.addEventListener("click", onDownload);
    lb.deleteBtn.addEventListener("click", onDelete);
    lb.root.addEventListener("click", e => { if (e.target.classList.contains("lightbox__stage")) closeLightbox(); });

    document.addEventListener("keydown", e => {
        if (lb.root.hidden) return;
        if (e.key === "Escape") closeLightbox();
        if (e.key === "ArrowLeft") step(-1);
        if (e.key === "ArrowRight") step(1);
    });

    // Gestos: deslizar para cambiar de foto, deslizar hacia abajo para cerrar.
    let startX = 0, startY = 0;
    lb.root.addEventListener("touchstart", e => {
        startX = e.touches[0].clientX; startY = e.touches[0].clientY;
    }, { passive: true });
    lb.root.addEventListener("touchend", e => {
        const dx = e.changedTouches[0].clientX - startX;
        const dy = e.changedTouches[0].clientY - startY;
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) step(dx < 0 ? 1 : -1);
        else if (dy > 90 && Math.abs(dy) > Math.abs(dx)) closeLightbox();
    }, { passive: true });

    // El botón "atrás" de Android cierra el visor en lugar de salir de la app.
    window.addEventListener("popstate", () => { if (!lb.root.hidden) closeLightbox(true); });
}

function openLightbox(id) {
    const index = photos.findIndex(p => p.id === id);
    if (index < 0) return;
    lb.index = index;
    lb.root.hidden = false;
    document.body.classList.add("no-scroll");
    requestAnimationFrame(() => lb.root.classList.add("is-open"));
    history.pushState({ lightbox: true }, "");
    showCurrent();
    $("#lightbox-close").focus();
}

function closeLightbox(fromPopState = false) {
    if (lb.root.hidden) return;
    lb.root.classList.remove("is-open");
    lb.root.hidden = true;
    lb.img.removeAttribute("src");
    document.body.classList.remove("no-scroll");
    const tile = tiles.get(lb.id);
    lb.id = null;
    if (!fromPopState && history.state?.lightbox) history.back();
    tile?.focus({ preventScroll: true });
}

function step(delta) {
    if (lb.root.hidden) return;
    const next = lb.index + delta;
    if (next < 0 || next >= photos.length) return;
    lb.index = next;
    showCurrent();
    if (next >= photos.length - 3) loadMore();
}

async function showCurrent() {
    const photo = photos[lb.index];
    if (!photo) return closeLightbox();
    const changed = lb.id !== photo.id;
    lb.id = photo.id;
    if (changed) {
        // Mientras carga la foto completa, se muestra la miniatura (ya en caché).
        lb.img.style.backgroundImage = `url("${photo.thumbURL}")`;
        lb.img.src = photo.downloadURL;
        lb.likeBtn.classList.remove("is-liked");
    }
    lb.likes.textContent = `❤️ ${photo.likes || 0}`;
    lb.counter.textContent = `${lb.index + 1} / ${photos.length}${hasMore ? "+" : ""}`;
    lb.prev.disabled = lb.index === 0;
    lb.next.disabled = lb.index === photos.length - 1 && !hasMore;
    lb.deleteBtn.hidden = photo.ownerId !== currentUid();

    const id = photo.id;
    try {
        const liked = await hasLiked(id);
        if (lb.id === id) setLikedUI(liked);
    } catch { /* sin conexión: se deja el estado por defecto */ }
}

/** Tras un cambio en tiempo real, mantiene el visor en la misma foto. */
function refreshLightbox() {
    if (lb.root?.hidden !== false || !lb.id) return;
    const index = photos.findIndex(p => p.id === lb.id);
    if (index < 0) { closeLightbox(); return; }
    lb.index = index;
    showCurrent();
}

function setLikedUI(liked) {
    lb.likeBtn.classList.toggle("is-liked", liked);
    lb.likeBtn.setAttribute("aria-pressed", String(liked));
    lb.likeBtn.innerHTML = liked ? "❤️ Te gusta" : "🤍 Me gusta";
}

async function onLike() {
    const photo = photos[lb.index];
    if (!photo || lb.likeBtn.disabled) return;
    lb.likeBtn.disabled = true;
    try {
        const liked = await toggleLike(photo.id);
        setLikedUI(liked);
        if (liked) {
            lb.likeBtn.classList.remove("pop");
            void lb.likeBtn.offsetWidth;
            lb.likeBtn.classList.add("pop");
        }
    } catch (err) {
        console.error(err);
        showToast(friendlyError(err), "error");
    } finally {
        lb.likeBtn.disabled = false;
    }
}

async function onDownload() {
    const photo = photos[lb.index];
    if (!photo) return;
    lb.downloadBtn.disabled = true;
    try {
        await downloadPhoto(photo.downloadURL, photoFilename(photo));
    } finally {
        lb.downloadBtn.disabled = false;
    }
}

async function onDelete() {
    const photo = photos[lb.index];
    if (!photo || photo.ownerId !== currentUid()) return;
    const ok = await confirmDialog({
        title: "Eliminar foto",
        message: "¿Seguro que quieres eliminar esta foto?",
        confirmText: "Eliminar",
        cancelText: "Cancelar",
        danger: true
    });
    if (!ok) return;
    try {
        await deletePhoto(photo);
        // Se quita al momento; el listener en tiempo real lo confirmará.
        photos = photos.filter(p => p.id !== photo.id);
        render();
        if (photos.length === 0) closeLightbox();
        else { lb.index = Math.min(lb.index, photos.length - 1); lb.id = null; showCurrent(); }
        showToast("Foto eliminada", "success");
    } catch (err) {
        console.error(err);
        showToast(friendlyError(err), "error");
    }
}
