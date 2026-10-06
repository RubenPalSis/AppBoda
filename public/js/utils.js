/**
 * Utilidades compartidas por la app de invitados y el panel de administración.
 */
import { weddingConfig } from "./wedding-config.js";

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function escapeHtml(str = "") {
    return String(str).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export function formatBytes(bytes) {
    if (!bytes && bytes !== 0) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

export function randomId(length = 6) {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    const values = crypto.getRandomValues(new Uint8Array(length));
    return Array.from(values, v => chars[v % chars.length]).join("");
}

/** Nombre único de foto, p. ej. photo_1728394829123_abc123 */
export function createPhotoId() {
    return `photo_${Date.now()}_${randomId(6)}`;
}

/** Fecha de la boda como Date local (evita diferencias de parseo en Safari). */
export function getWeddingDate() {
    const [y, m, d] = weddingConfig.date.split("-").map(Number);
    const [hh, mm] = (weddingConfig.countdownTime || "00:00").split(":").map(Number);
    return new Date(y, m - 1, d, hh || 0, mm || 0, 0);
}

export function formatWeddingDate() {
    return new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long", year: "numeric" })
        .format(getWeddingDate());
}

export function formatDateTime(date) {
    if (!date) return "";
    return new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(date);
}

const rtf = new Intl.RelativeTimeFormat("es", { numeric: "auto" });

/** "ahora", "hace 5 min", "hace 2 h", "ayer"… (como en las redes sociales). */
export function timeAgo(date) {
    if (!date) return "";
    const s = Math.round((date - Date.now()) / 1000);
    const abs = Math.abs(s);
    if (abs < 45) return "ahora";
    if (abs < 3600) return rtf.format(Math.round(s / 60), "minute");
    if (abs < 86400) return rtf.format(Math.round(s / 3600), "hour");
    if (abs < 7 * 86400) return rtf.format(Math.round(s / 86400), "day");
    return new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short" }).format(date);
}

/** Enlace de Google Maps para un lugar de la configuración ("" si no hay datos). */
export function mapsLink(place) {
    if (!place) return "";
    if (place.mapsUrl) return place.mapsUrl;
    if (place.address) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.address)}`;
    return "";
}

/** Aplica los colores de la configuración como variables CSS. */
export function applyTheme() {
    const t = weddingConfig.theme || {};
    const root = document.documentElement.style;
    if (t.cream) root.setProperty("--cream", t.cream);
    if (t.ink) root.setProperty("--ink", t.ink);
    if (t.gold) root.setProperty("--gold", t.gold);
    if (t.beige) root.setProperty("--beige", t.beige);
}

export const isIOS = () =>
    /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

export const isStandalone = () =>
    window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;

const isTouchDevice = () => window.matchMedia("(pointer: coarse)").matches;

/* ---------------- Toast ---------------- */
let toastTimer;
export function showToast(message, type = "info", duration = 3500) {
    let el = document.getElementById("toast");
    if (!el) {
        el = document.createElement("div");
        el.id = "toast";
        el.className = "toast";
        el.setAttribute("role", "status");
        el.setAttribute("aria-live", "polite");
        document.body.appendChild(el);
    }
    el.textContent = message;
    el.dataset.type = type;
    el.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("is-visible"), duration);
}

/* ---------------- Diálogo de confirmación ---------------- */
export function confirmDialog({ title = "", message = "", confirmText = "Aceptar", cancelText = "Cancelar", danger = false } = {}) {
    return new Promise(resolve => {
        const overlay = document.createElement("div");
        overlay.className = "modal";
        overlay.innerHTML = `
            <div class="modal__card" role="alertdialog" aria-modal="true" aria-labelledby="modal-title">
                ${title ? `<h3 class="modal__title" id="modal-title">${escapeHtml(title)}</h3>` : ""}
                ${message ? `<p class="modal__text">${escapeHtml(message)}</p>` : ""}
                <div class="modal__actions">
                    <button type="button" class="btn btn--ghost" data-action="cancel">${escapeHtml(cancelText)}</button>
                    <button type="button" class="btn ${danger ? "btn--danger" : "btn--primary"}" data-action="confirm">${escapeHtml(confirmText)}</button>
                </div>
            </div>`;
        const previousFocus = document.activeElement;
        const close = result => {
            overlay.classList.remove("is-visible");
            document.removeEventListener("keydown", onKey);
            setTimeout(() => overlay.remove(), 200);
            previousFocus?.focus?.();
            resolve(result);
        };
        const onKey = e => { if (e.key === "Escape") close(false); };
        overlay.addEventListener("click", e => {
            if (e.target === overlay) close(false);
            const action = e.target.closest("[data-action]")?.dataset.action;
            if (action) close(action === "confirm");
        });
        document.addEventListener("keydown", onKey);
        document.body.appendChild(overlay);
        requestAnimationFrame(() => overlay.classList.add("is-visible"));
        overlay.querySelector('[data-action="cancel"]').focus();
    });
}

/* ---------------- Descargas ---------------- */

/** Descarga un blob como archivo. */
export function saveBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 5000);
}

/** Obtiene un archivo como Blob (las fotos llegan como URLs blob: locales, ver photos.js). */
export async function fetchBlob(url) {
    const res = await fetch(url, { mode: "cors", cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.blob();
}

/**
 * Descarga una foto.
 * - En móvil, si el navegador lo permite, abre el menú "Compartir" (permite "Guardar imagen" en iPhone).
 * - Si no, descarga el archivo.
 * - Si falla, abre la foto en una pestaña nueva.
 */
export async function downloadPhoto(url, filename) {
    let blob;
    try {
        blob = await fetchBlob(url);
    } catch (err) {
        console.warn("Descarga directa no disponible, abriendo la foto:", err);
        window.open(url, "_blank", "noopener");
        return;
    }
    const file = new File([blob], filename, { type: blob.type || "image/jpeg" });
    if (isTouchDevice() && navigator.canShare?.({ files: [file] })) {
        try {
            await navigator.share({ files: [file] });
            return;
        } catch (err) {
            if (err.name === "AbortError") return;
            // NotAllowedError u otros: continuamos con la descarga normal.
        }
    }
    saveBlob(blob, filename);
}

export function photoFilename(photo) {
    return `${weddingConfig.admin.zipBaseName}-${photo.id}.jpg`;
}

/** Mensajes de error de Firebase comprensibles para el usuario. */
export function friendlyError(err) {
    const code = err?.code || "";
    if (code.includes("permission-denied") || code.includes("unauthorized")) return "No tienes permiso para realizar esta acción.";
    if (code.includes("unavailable") || code.includes("network")) return "Sin conexión. Revisa tu red e inténtalo de nuevo.";
    if (code.includes("quota") || code.includes("resource-exhausted")) return "Se ha alcanzado el límite gratuito de hoy. Inténtalo de nuevo más tarde.";
    if (code === "not-found") return "Esta foto ya no existe.";
    if (code.includes("operation-not-allowed") || code.includes("admin-restricted")) return "El acceso de invitados no está activado en Firebase (Authentication → Anónimo).";
    return "Ha ocurrido un error. Inténtalo de nuevo.";
}
