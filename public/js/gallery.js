/**
 * Feed (estilo Instagram) y Tablón (polaroids) de fotos.
 *
 * Para gastar pocas lecturas de Firestore (plan Spark: 50.000/día):
 *  - Solo se escucha en tiempo real el bloque de fotos más recientes.
 *  - Las anteriores se piden una única vez al hacer scroll (cursor startAfter),
 *    sin volver a leer las que ya están cargadas.
 *  - La foto completa (photoFiles) solo se lee al abrirla en el visor.
 */
import { weddingConfig } from "./wedding-config.js";
import { $, $$, escapeHtml, showToast, confirmDialog, downloadPhoto, photoFilename, friendlyError, timeAgo } from "./utils.js";
import { currentUid } from "./auth.js";
import { subscribePhotos, fetchOlderPhotos, getFullImageUrl, deletePhoto, releasePhoto } from "./photos.js";
import { isLiked, toggleLike } from "./likes.js";
import { aliasFor, jitter } from "./identity.js";
import { openViewer, appendToViewer } from "./viewer.js";

const pageSize = weddingConfig.gallery.pageSize;
const DOUBLE_TAP_MS = 280;

let photos = [];          // todas las fotos cargadas, de más reciente a más antigua
let older = new Map();    // id -> foto cargada fuera del bloque en tiempo real
let live = [];            // bloque en tiempo real (las pageSize más recientes)
let hasMore = false;
let loaded = false;
let unsubscribe = null;
let loadingMore = null;
let activeView = "inicio";
const listeners = new Set();
const posts = new Map();   // id -> <article> del feed
const pins = new Map();    // id -> <button> del tablón
const els = {};

export function initGallery() {
    els.feed = $("#feed");
    els.board = $("#board");
    els.feedEmpty = $("#feed-empty");
    els.boardEmpty = $("#board-empty");
    els.sentinel = $("#feed-sentinel");
    els.loading = $("#feed-loading");

    els.feed.addEventListener("click", onFeedClick);
    els.board.addEventListener("click", e => {
        const pin = e.target.closest("[data-id]");
        if (pin) openAt(pin.dataset.id);
    });

    if ("IntersectionObserver" in window) {
        new IntersectionObserver(entries => {
            if (entries.some(e => e.isIntersecting) && isPhotoView()) loadMore();
        }, { rootMargin: "800px" }).observe(els.sentinel);
    }

    window.addEventListener("photo:liked", e => updateLikeUI(e.detail.id));
    window.addEventListener("photo:deleted", e => dropPhoto(e.detail.id));
    setInterval(refreshTimes, 60000);

    subscribe();
}

/** Vista activa ("inicio" = feed, "tablon" = tablón). Solo se pinta la visible. */
export function setGalleryView(view) {
    activeView = view;
    render();
}

/** Fotos del bloque en tiempo real (las más recientes), para la historia "Recientes". */
export function getRecentPhotos() {
    return [...live];
}

export function onPhotosChange(fn) {
    listeners.add(fn);
}

const isPhotoView = () => activeView === "inicio" || activeView === "tablon";

/* ---------------- Datos ---------------- */

const byNewest = (a, b) => (b.createdAt || Infinity) - (a.createdAt || Infinity);

function rebuild() {
    const liveIds = new Set(live.map(p => p.id));
    photos = [...live, ...[...older.values()].filter(p => !liveIds.has(p.id))].sort(byNewest);
}

function forget(id) {
    older.delete(id);
    releasePhoto(id);
    posts.get(id)?.remove();
    posts.delete(id);
    pins.get(id)?.remove();
    pins.delete(id);
}

function subscribe() {
    let first = true;
    unsubscribe?.();
    unsubscribe = subscribePhotos(pageSize, (list, removed) => {
        // Una foto que sale del bloque en tiempo real puede haber sido BORRADA o
        // simplemente desplazada por otra más nueva. Si es más antigua que la última
        // del bloque (y el bloque está lleno), se ha desplazado: se conserva.
        const full = list.length >= pageSize;
        const oldest = list[list.length - 1]?.createdAt || 0;
        for (const p of removed) {
            if (full && p.createdAt && p.createdAt <= oldest) older.set(p.id, p);
            else forget(p.id);
        }
        live = list;
        if (first) { hasMore = full; first = false; }
        loaded = true;
        rebuild();
        render();
        listeners.forEach(fn => fn(photos));
    }, err => {
        console.error(err);
        showToast(friendlyError(err), "error", 6000);
    });
}

function loadMore() {
    if (!hasMore) return Promise.resolve([]);
    if (loadingMore) return loadingMore;
    const last = [...photos].reverse().find(p => p.createdAtTs);
    if (!last) return Promise.resolve([]);
    els.loading.hidden = false;
    loadingMore = fetchOlderPhotos(last.createdAtTs, pageSize)
        .then(list => {
            list.forEach(p => older.set(p.id, p));
            hasMore = list.length >= pageSize;
            rebuild();
            render();
            return list;
        })
        .catch(err => {
            console.error(err);
            showToast(friendlyError(err), "error", 6000);
            return [];
        })
        .finally(() => {
            loadingMore = null;
            els.loading.hidden = true;
        });
    return loadingMore;
}

/** Quita una foto al momento (borrada por mí o ya inexistente). */
function dropPhoto(id) {
    live = live.filter(p => p.id !== id);
    forget(id);
    rebuild();
    render();
    listeners.forEach(fn => fn(photos));
}

/* ---------------- Render ---------------- */

const who = photo => {
    const alias = aliasFor(photo.ownerId);
    return { emoji: alias.emoji, name: photo.ownerId === currentUid() ? "Tú" : alias.handle };
};

const likesText = n => (n ? `${n} me gusta` : "Sé el primero en darle ❤️");

function postHtml(photo) {
    const own = photo.ownerId === currentUid();
    const { emoji, name } = who(photo);
    return `
        <header class="post__head">
            <span class="avatar" aria-hidden="true">${emoji}</span>
            <div class="post__who">
                <span class="post__name">${escapeHtml(name)}</span>
                <span class="post__time" data-time>${escapeHtml(timeAgo(photo.createdAt))}</span>
            </div>
            ${own ? `<span class="tag-own">Tu foto</span>` : ""}
        </header>
        <button type="button" class="post__media" data-open aria-label="Ver foto en grande">
            <img src="${escapeHtml(photo.thumbURL)}" alt="Foto de la boda" decoding="async"
                 width="${Number(photo.width) || 4}" height="${Number(photo.height) || 3}">
            <span class="burst" aria-hidden="true"><svg class="i"><use href="#i-heart"/></svg></span>
        </button>
        <div class="post__actions">
            <button type="button" class="icon-btn icon-btn--lg like-btn" data-like aria-label="Me gusta" aria-pressed="false"><svg class="i"><use href="#i-heart"/></svg></button>
            <button type="button" class="icon-btn icon-btn--lg" data-download aria-label="Descargar"><svg class="i"><use href="#i-download"/></svg></button>
            <span class="spacer"></span>
            ${own ? `<button type="button" class="icon-btn icon-btn--lg" data-delete aria-label="Eliminar"><svg class="i"><use href="#i-trash"/></svg></button>` : ""}
        </div>
        <p class="post__likes" data-likes></p>`;
}

function pinHtml(photo) {
    const { emoji } = who(photo);
    const n = photo.likes || 0;
    return `
        <img src="${escapeHtml(photo.thumbURL)}" alt="Foto de la boda" decoding="async"
             width="${Number(photo.width) || 4}" height="${Number(photo.height) || 3}">
        <span class="polaroid__caption">
            <span>${emoji}${n ? ` ❤ ${n}` : ""}</span>
            <small data-time>${escapeHtml(timeAgo(photo.createdAt))}</small>
        </span>`;
}

function render() {
    if (!els.feed) return;
    const count = photos.length ? `${photos.length}${hasMore ? "+" : ""} ${photos.length === 1 ? "foto" : "fotos"}` : "";
    $$("[data-photo-count]").forEach(el => (el.textContent = count));
    const empty = loaded && photos.length === 0;
    els.feedEmpty.hidden = !empty;
    els.boardEmpty.hidden = !empty;
    $$("[data-feed-end]").forEach(el => (el.hidden = hasMore || photos.length < 4));

    if (activeView === "inicio") renderFeed();
    if (activeView === "tablon") renderBoard();
}

function renderFeed() {
    const uid = currentUid();
    photos.forEach(photo => {
        let el = posts.get(photo.id);
        const key = `${photo.ownerId === uid}`;
        if (!el || el.dataset.key !== key) {
            const fresh = document.createElement("article");
            fresh.className = "post";
            fresh.dataset.id = photo.id;
            fresh.dataset.key = key;
            fresh.innerHTML = postHtml(photo);
            el?.replaceWith(fresh);
            el = fresh;
            posts.set(photo.id, el);
        }
        updatePost(el, photo);
        els.feed.appendChild(el); // appendChild mueve el nodo si ya existe: mantiene el orden
    });
}

function updatePost(el, photo) {
    const liked = isLiked(photo.id);
    const btn = el.querySelector("[data-like]");
    btn.classList.toggle("is-liked", liked);
    btn.setAttribute("aria-pressed", String(liked));
    el.querySelector("[data-likes]").textContent = likesText(photo.likes || 0);
}

function renderBoard() {
    photos.forEach(photo => {
        let el = pins.get(photo.id);
        const key = `${photo.likes || 0}`;
        if (!el) {
            el = document.createElement("button");
            el.type = "button";
            el.className = "polaroid";
            el.dataset.id = photo.id;
            el.setAttribute("aria-label", "Ver foto");
            el.style.setProperty("--r", `${(jitter(photo.id) * 3).toFixed(2)}deg`);
            pins.set(photo.id, el);
        }
        if (el.dataset.key !== key) {
            el.dataset.key = key;
            el.innerHTML = pinHtml(photo);
        }
        els.board.appendChild(el);
    });
}

function updateLikeUI(id) {
    const photo = photos.find(p => p.id === id);
    if (!photo) return;
    const post = posts.get(id);
    if (post) updatePost(post, photo);
    if (activeView === "tablon") renderBoard();
}

function refreshTimes() {
    for (const [id, el] of [...posts, ...pins]) {
        const photo = photos.find(p => p.id === id);
        const t = el.querySelector("[data-time]");
        if (photo && t) t.textContent = timeAgo(photo.createdAt);
    }
}

/* ---------------- Interacción ---------------- */

let lastTap = { id: null, t: 0 };
let tapTimer = null;

function onFeedClick(e) {
    const post = e.target.closest(".post");
    if (!post) return;
    const photo = photos.find(p => p.id === post.dataset.id);
    if (!photo) return;

    if (e.target.closest("[data-open]")) {
        // Doble toque = ❤️ (con corazón gigante); toque simple = ver en grande.
        const now = performance.now();
        if (lastTap.id === photo.id && now - lastTap.t < DOUBLE_TAP_MS) {
            clearTimeout(tapTimer);
            lastTap = { id: null, t: 0 };
            const b = post.querySelector(".burst");
            b.classList.remove("is-on");
            void b.offsetWidth;
            b.classList.add("is-on");
            if (!isLiked(photo.id)) like(photo, post);
            return;
        }
        lastTap = { id: photo.id, t: now };
        tapTimer = setTimeout(() => openAt(photo.id), DOUBLE_TAP_MS);
        return;
    }
    if (e.target.closest("[data-like]")) like(photo, post);
    if (e.target.closest("[data-download]")) download(photo);
    if (e.target.closest("[data-delete]")) remove(photo);
}

async function like(photo, post) {
    const btn = post.querySelector("[data-like]");
    btn.disabled = true;
    try {
        const pending = toggleLike(photo.id);
        updatePost(post, photo); // el corazón cambia al instante
        const liked = await pending;
        if (liked) {
            btn.classList.remove("pop");
            void btn.offsetWidth;
            btn.classList.add("pop");
        }
    } catch (err) {
        console.error(err);
        showToast(friendlyError(err), "error");
    } finally {
        btn.disabled = false;
        updatePost(post, photo);
    }
}

async function download(photo) {
    try {
        await downloadPhoto(await getFullImageUrl(photo.id), photoFilename(photo));
    } catch (err) {
        console.error(err);
        showToast(friendlyError(err), "error");
    }
}

async function remove(photo) {
    const ok = await confirmDialog({
        title: "Eliminar foto",
        message: "¿Seguro que quieres eliminar esta foto? Desaparecerá para todos.",
        confirmText: "Eliminar",
        danger: true
    });
    if (!ok) return;
    try {
        await deletePhoto(photo);
        dropPhoto(photo.id);
        showToast("Foto eliminada", "success");
    } catch (err) {
        console.error(err);
        showToast(friendlyError(err), "error");
    }
}

function openAt(id) {
    const index = photos.findIndex(p => p.id === id);
    if (index < 0) return;
    openViewer({
        mode: "gallery",
        items: photos.map(photo => ({ type: "photo", photo })),
        start: index,
        onNear: () => loadMore().then(list => appendToViewer(list.map(photo => ({ type: "photo", photo }))))
    });
}
