/**
 * Visor a pantalla completa, compartido por las historias y por el feed/tablón.
 *
 *  - mode "story":   barras de progreso, avance automático, tocar izquierda/derecha,
 *                    mantener pulsado para pausar. Al terminar llama a onEnd().
 *  - mode "gallery": sin avance automático; deslizar o tocar para cambiar de foto.
 *  - En los dos: doble toque = ❤️, deslizar hacia abajo = cerrar, Esc / ← →.
 *
 * items: [{ type: "photo", photo }, { type: "card", html, bg, onShow(el) → cleanup }]
 */
import { $, escapeHtml, showToast, confirmDialog, downloadPhoto, photoFilename, friendlyError, timeAgo } from "./utils.js";
import { currentUid } from "./auth.js";
import { getFullImageUrl, deletePhoto } from "./photos.js";
import { isLiked, toggleLike } from "./likes.js";
import { aliasFor } from "./identity.js";

const PHOTO_MS = 5000;
const CARD_MS = 7000;
const DOUBLE_TAP_MS = 280;

const v = {};
let state = null;

function els() {
    if (v.root) return;
    v.root = $("#viewer");
    v.bars = $("#viewer-bars");
    v.who = $("#viewer-who");
    v.counter = $("#viewer-counter");
    v.stage = $("#viewer-stage");
    v.img = $("#viewer-img");
    v.card = $("#viewer-card");
    v.burst = $("#viewer-burst");
    v.like = $("#viewer-like");
    v.likes = $("#viewer-likes");
    v.download = $("#viewer-download");
    v.del = $("#viewer-delete");

    $("#viewer-close").addEventListener("click", () => close());
    $("#viewer-prev").addEventListener("click", () => step(-1));
    $("#viewer-next").addEventListener("click", () => step(1));
    v.like.classList.add("like-btn");
    v.like.addEventListener("click", () => like(false));
    v.download.addEventListener("click", onDownload);
    v.del.addEventListener("click", onDelete);
    initGestures();

    document.addEventListener("keydown", e => {
        if (!state) return;
        if (e.key === "Escape") close();
        if (e.key === "ArrowLeft") step(-1);
        if (e.key === "ArrowRight") step(1);
    });
    window.addEventListener("popstate", () => { if (state) close(true); });
    document.addEventListener("visibilitychange", () => {
        if (!state) return;
        document.hidden ? pause() : resume();
    });
    window.addEventListener("photo:liked", e => {
        const item = current();
        if (item?.type !== "photo" || item.photo.id !== e.detail.id) return;
        renderLike(item.photo);
    });
}

/**
 * @param {{items: object[], start?: number, mode?: "story"|"gallery", title?: string,
 *          onEnd?: () => boolean, onNear?: () => void}} opts
 *   onEnd: al terminar la última historia; devuelve true si abre otra (no se cierra el visor).
 *   onNear: cuando quedan pocas fotos por ver (para cargar más en modo galería).
 */
export function openViewer(opts) {
    els();
    const wasOpen = !!state;
    stopTimer();
    state = { mode: "story", start: 0, ...opts, index: opts.start || 0, paused: false, elapsed: 0 };
    if (!wasOpen) {
        v.root.hidden = false;
        document.body.classList.add("no-scroll");
        requestAnimationFrame(() => v.root.classList.add("is-open"));
        history.pushState({ viewer: true }, "");
    }
    show();
}

/** Añade fotos al final (modo galería, al cargar más). */
export function appendToViewer(items) {
    if (!state || state.mode !== "gallery") return;
    const ids = new Set(state.items.filter(i => i.type === "photo").map(i => i.photo.id));
    state.items.push(...items.filter(i => !ids.has(i.photo.id)));
    renderCounter();
}

export function isViewerOpen() {
    return !!state;
}

export function closeViewer() {
    close();
}

function close(fromPopState = false) {
    if (!state) return;
    stopTimer();
    state.cleanup?.();
    state = null;
    v.root.classList.remove("is-open");
    v.root.hidden = true;
    v.img.removeAttribute("src");
    document.body.classList.remove("no-scroll");
    if (!fromPopState && history.state?.viewer) history.back();
}

const current = () => state?.items[state.index];

function step(delta) {
    if (!state) return;
    const next = state.index + delta;
    if (next < 0) { state.elapsed = 0; return show(); }
    if (next >= state.items.length) {
        if (state.mode === "story" && state.onEnd?.()) return;
        if (state.mode === "story") return close();
        return;
    }
    state.index = next;
    show();
}

/* ---------------- Render ---------------- */

function show() {
    const item = current();
    if (!item) return close();
    stopTimer();
    state.cleanup?.();
    state.cleanup = null;
    state.elapsed = 0;
    state.paused = false;

    renderBars();
    renderCounter();
    v.root.classList.toggle("is-card", item.type === "card");

    if (item.type === "card") {
        v.img.hidden = true;
        v.card.hidden = false;
        v.card.style.setProperty("--card-bg", item.bg || "");
        v.card.innerHTML = item.html;
        state.cleanup = item.onShow?.(v.card) || null;
        v.who.innerHTML = `<span class="avatar">${escapeHtml(item.emoji || "💍")}</span><b>${escapeHtml(state.title || "")}</b>`;
        startTimer(item.duration || CARD_MS);
        return;
    }

    const { photo } = item;
    v.card.hidden = true;
    v.card.innerHTML = "";
    v.img.hidden = false;
    v.img.src = photo.thumbURL;
    const alias = aliasFor(photo.ownerId);
    const name = photo.ownerId === currentUid() ? "Tú" : alias.handle;
    v.who.innerHTML = `<span class="avatar">${alias.emoji}</span><b>${escapeHtml(name)}</b><small>${escapeHtml(timeAgo(photo.createdAt))}</small>`;
    if (state.title && state.mode === "story") v.who.innerHTML += `<small>· ${escapeHtml(state.title)}</small>`;
    renderLike(photo);
    v.del.hidden = photo.ownerId !== currentUid();

    const id = photo.id;
    getFullImageUrl(id)
        .then(url => { if (current()?.photo?.id === id) v.img.src = url; })
        .catch(err => {
            if (err.code === "not-found" && current()?.photo?.id === id) {
                showToast("Esta foto ya no existe", "warning");
                removeCurrent();
            }
        });
    // Precarga la siguiente para que el cambio sea instantáneo.
    const next = state.items[state.index + 1];
    if (next?.type === "photo") getFullImageUrl(next.photo.id).catch(() => {});

    if (state.mode === "story") startTimer(PHOTO_MS);
    if (state.mode === "gallery" && state.index >= state.items.length - 4) state.onNear?.();
}

function renderBars() {
    if (state.mode !== "story") { v.bars.innerHTML = ""; return; }
    v.bars.innerHTML = state.items.map((_, i) =>
        `<span class="${i < state.index ? "is-done" : ""}"><i></i></span>`).join("");
}

function renderCounter() {
    v.counter.textContent = state.mode === "gallery" ? `${state.index + 1} / ${state.items.length}` : "";
}

function renderLike(photo) {
    const liked = isLiked(photo.id);
    v.like.classList.toggle("is-liked", liked);
    v.like.setAttribute("aria-pressed", String(liked));
    const n = photo.likes || 0;
    v.likes.textContent = n ? `${n} ${n === 1 ? "me gusta" : "me gusta"}` : "";
}

/* ---------------- Temporizador (modo historia) ---------------- */

function startTimer(duration) {
    state.duration = duration;
    state.last = performance.now();
    const bar = v.bars.children[state.index]?.firstElementChild;
    const tick = now => {
        if (!state) return;
        if (!state.paused) state.elapsed += now - state.last;
        state.last = now;
        const f = Math.min(1, state.elapsed / state.duration);
        if (bar) bar.style.transform = `scaleX(${f})`;
        if (f >= 1) return step(1);
        state.raf = requestAnimationFrame(tick);
    };
    state.raf = requestAnimationFrame(tick);
}

function stopTimer() {
    if (state?.raf) cancelAnimationFrame(state.raf);
}

function pause() { if (state) state.paused = true; }
function resume() { if (state) { state.paused = false; state.last = performance.now(); } }

/* ---------------- Gestos ---------------- */

function initGestures() {
    let start = null;
    let holdTimer = null;
    let held = false;
    let lastTap = 0;
    let singleTimer = null;

    v.stage.addEventListener("pointerdown", e => {
        if (e.target.closest("a, .btn")) return;
        start = { x: e.clientX, y: e.clientY, t: performance.now() };
        held = false;
        holdTimer = setTimeout(() => { held = true; pause(); }, 220);
    });

    v.stage.addEventListener("pointerup", e => {
        clearTimeout(holdTimer);
        if (!start || e.target.closest("a, .btn")) { start = null; if (held) { held = false; resume(); } return; }
        const dx = e.clientX - start.x;
        const dy = e.clientY - start.y;
        start = null;
        if (held) { held = false; resume(); return; }

        if (dy > 90 && Math.abs(dy) > Math.abs(dx)) return close();
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) return step(dx < 0 ? 1 : -1);
        if (Math.abs(dx) > 10 || Math.abs(dy) > 10) return;

        // Toque: doble = like; simple = anterior (30 % izquierdo) / siguiente.
        const now = performance.now();
        if (now - lastTap < DOUBLE_TAP_MS) {
            clearTimeout(singleTimer);
            lastTap = 0;
            like(true);
            return;
        }
        lastTap = now;
        const rect = v.stage.getBoundingClientRect();
        const dir = e.clientX - rect.left < rect.width * 0.3 ? -1 : 1;
        singleTimer = setTimeout(() => step(dir), DOUBLE_TAP_MS);
    });

    v.stage.addEventListener("pointercancel", () => {
        clearTimeout(holdTimer);
        if (held) resume();
        start = null;
        held = false;
    });
}

/* ---------------- Acciones ---------------- */

function burst() {
    v.burst.classList.remove("is-on");
    void v.burst.offsetWidth;
    v.burst.classList.add("is-on");
}

async function like(fromDoubleTap) {
    const item = current();
    if (item?.type !== "photo") return;
    const { photo } = item;
    if (fromDoubleTap) {
        burst();
        if (isLiked(photo.id)) return; // como en Instagram: el doble toque no quita el like
    }
    v.like.disabled = true;
    try {
        const pending = toggleLike(photo.id);
        renderLike(photo); // el corazón cambia al instante
        const liked = await pending;
        if (liked) {
            v.like.classList.remove("pop");
            void v.like.offsetWidth;
            v.like.classList.add("pop");
        }
    } catch (err) {
        console.error(err);
        showToast(friendlyError(err), "error");
    } finally {
        v.like.disabled = false;
        if (current()?.photo?.id === photo.id) renderLike(photo);
    }
}

async function onDownload() {
    const item = current();
    if (item?.type !== "photo") return;
    pause();
    v.download.disabled = true;
    try {
        await downloadPhoto(await getFullImageUrl(item.photo.id), photoFilename(item.photo));
    } catch (err) {
        console.error(err);
        showToast(friendlyError(err), "error");
    } finally {
        v.download.disabled = false;
        resume();
    }
}

async function onDelete() {
    const item = current();
    if (item?.type !== "photo" || item.photo.ownerId !== currentUid()) return;
    pause();
    const ok = await confirmDialog({
        title: "Eliminar foto",
        message: "¿Seguro que quieres eliminar esta foto? Desaparecerá para todos.",
        confirmText: "Eliminar",
        danger: true
    });
    if (!ok) return resume();
    try {
        await deletePhoto(item.photo);
        window.dispatchEvent(new CustomEvent("photo:deleted", { detail: { id: item.photo.id } }));
        showToast("Foto eliminada", "success");
        removeCurrent();
    } catch (err) {
        console.error(err);
        showToast(friendlyError(err), "error");
        resume();
    }
}

function removeCurrent() {
    if (!state) return;
    state.items.splice(state.index, 1);
    if (!state.items.length) return close();
    state.index = Math.min(state.index, state.items.length - 1);
    show();
}
