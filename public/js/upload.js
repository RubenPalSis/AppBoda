/**
 * Subida de fotos: selección, compresión en el dispositivo, previsualización y subida.
 *
 * Compresión: la imagen se decodifica con <img> (los navegadores actuales aplican
 * automáticamente la orientación EXIF al dibujarla), se redimensiona en un <canvas>
 * y se exporta como JPEG. Se usa JPEG y no WebP porque Safari en iOS no sabe
 * exportar WebP desde canvas (devolvería PNG, mucho más pesado).
 * Al redibujar la imagen se eliminan también los metadatos EXIF (incluida la ubicación GPS).
 */
import { weddingConfig } from "./wedding-config.js";
import { $, escapeHtml, formatBytes, createPhotoId, showToast, friendlyError } from "./utils.js";
import { ensureGuestSession } from "./auth.js";
import { uploadPhoto } from "./photos.js";

const cfg = weddingConfig.upload;
const ACCEPTED_EXT = /\.(jpe?g|png|webp|heic|heif)$/i;

let items = [];          // { key, file, status, processed, previewUrl, el }
let uploading = false;
let processingQueue = Promise.resolve();
let onUploadedCallback = () => {};

const els = {};

export function initUpload({ onUploaded } = {}) {
    onUploadedCallback = onUploaded || onUploadedCallback;
    els.input = $("#upload-input");
    els.list = $("#upload-list");
    els.summary = $("#upload-summary");
    els.submit = $("#upload-submit");
    els.clear = $("#upload-clear");
    els.actions = $("#upload-actions");
    els.progress = $("#upload-progress");
    els.progressText = $("#upload-progress-text");
    els.progressBar = $("#upload-progress-bar");
    els.limitHint = $("#upload-limit");

    els.limitHint.textContent = `Hasta ${cfg.maxFilesPerUpload} fotos cada vez. Se comprimen automáticamente antes de subirlas.`;

    els.input.addEventListener("change", () => {
        addFiles(Array.from(els.input.files || []));
        els.input.value = ""; // permite volver a elegir las mismas fotos
    });
    els.submit.addEventListener("click", startUpload);
    els.clear.addEventListener("click", clearAll);
    els.list.addEventListener("click", e => {
        const btn = e.target.closest("[data-remove]");
        if (btn && !uploading) removeItem(btn.dataset.remove);
    });
    render();
}

/* ---------------- Selección ---------------- */

function addFiles(files) {
    if (uploading) return;
    const free = cfg.maxFilesPerUpload - items.length;
    if (files.length > free) {
        showToast(`Puedes subir hasta ${cfg.maxFilesPerUpload} fotos cada vez. Se han añadido ${Math.max(free, 0)}.`, "warning", 5000);
    }
    files.slice(0, Math.max(free, 0)).forEach(file => {
        const item = { key: createPhotoId(), file, status: "pending", processed: null, previewUrl: "", error: "" };
        if (!(file.type.startsWith("image/") || ACCEPTED_EXT.test(file.name))) {
            item.status = "error";
            item.error = "No es una imagen";
        } else if (file.size > cfg.maxOriginalSizeMB * 1024 * 1024) {
            item.status = "error";
            item.error = `Supera ${cfg.maxOriginalSizeMB} MB`;
        }
        items.push(item);
        if (item.status === "pending") {
            // Se procesan de una en una para no saturar la memoria del móvil.
            processingQueue = processingQueue.then(() => processItem(item));
        }
    });
    render();
}

function removeItem(key) {
    const item = items.find(i => i.key === key);
    if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
    items = items.filter(i => i.key !== key);
    render();
}

function clearAll() {
    if (uploading) return;
    items.forEach(i => i.previewUrl && URL.revokeObjectURL(i.previewUrl));
    items = [];
    render();
}

/* ---------------- Compresión ---------------- */

function loadImage(file) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => resolve({ img, url });
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("No se puede leer la imagen")); };
        img.src = url;
    });
}

function renderToJpeg(img, maxSide, quality) {
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const width = Math.max(1, Math.round(img.naturalWidth * scale));
    const height = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.fillStyle = "#ffffff"; // fondo para PNG con transparencia
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    return new Promise((resolve, reject) => {
        canvas.toBlob(blob => {
            // Liberar memoria del canvas (importante en iOS).
            canvas.width = canvas.height = 0;
            blob ? resolve({ blob, width, height }) : reject(new Error("No se pudo comprimir"));
        }, "image/jpeg", quality);
    });
}

/** Comprime una imagen y genera su miniatura. */
export async function processImage(file) {
    const { img, url } = await loadImage(file);
    try {
        const main = await renderToJpeg(img, cfg.maxSide, cfg.quality);
        const thumb = await renderToJpeg(img, cfg.thumbMaxSide, cfg.thumbQuality);
        return { blob: main.blob, width: main.width, height: main.height, thumbBlob: thumb.blob };
    } finally {
        URL.revokeObjectURL(url);
    }
}

async function processItem(item) {
    if (!items.includes(item)) return; // eliminada antes de procesarse
    item.status = "processing";
    renderItem(item);
    try {
        item.processed = await processImage(item.file);
        item.previewUrl = URL.createObjectURL(item.processed.thumbBlob);
        item.status = "ready";
    } catch (err) {
        console.warn(err);
        item.status = "error";
        item.error = /heic|heif/i.test(item.file.name) ? "HEIC no compatible en este navegador" : "Formato no compatible";
    }
    // Cede el hilo principal entre fotos para que la interfaz siga fluida.
    await new Promise(r => setTimeout(r, 0));
    render();
}

/* ---------------- Subida ---------------- */

async function startUpload() {
    const ready = items.filter(i => i.status === "ready");
    if (!ready.length || uploading) return;
    uploading = true;
    render();

    let uid;
    try {
        uid = await ensureGuestSession();
    } catch (err) {
        uploading = false;
        showToast(friendlyError(err), "error", 6000);
        render();
        return;
    }

    let done = 0;
    let failed = 0;
    for (let i = 0; i < ready.length; i++) {
        const item = ready[i];
        item.status = "uploading";
        renderItem(item);
        setProgress(`Subiendo ${i + 1} de ${ready.length}...`, i / ready.length);
        try {
            await uploadPhoto(item.processed, createPhotoId(), uid, f => {
                setProgress(`Subiendo ${i + 1} de ${ready.length}...`, (i + f) / ready.length);
            });
            item.status = "done";
            done++;
        } catch (err) {
            console.error(err);
            item.status = "error";
            item.error = friendlyError(err);
            failed++;
        }
        renderItem(item);
    }

    uploading = false;
    if (done) {
        setProgress(failed ? `Se han subido ${done} fotos. ${failed} no se pudieron subir.` : "¡Fotos subidas correctamente! ❤️", 1);
        showToast(failed ? `${done} subidas, ${failed} con error` : "¡Fotos subidas correctamente! ❤️", failed ? "warning" : "success");
        // Quitamos de la lista las que ya se han subido; se mantienen las que fallaron.
        items.filter(i => i.status === "done").forEach(i => URL.revokeObjectURL(i.previewUrl));
        items = items.filter(i => i.status !== "done");
        onUploadedCallback(done);
    } else {
        setProgress("No se ha podido subir ninguna foto. Inténtalo de nuevo.", 0);
    }
    render();
    setTimeout(() => { if (!uploading) els.progress.hidden = true; }, 6000);
}

function setProgress(text, fraction) {
    els.progress.hidden = false;
    els.progressText.textContent = text;
    els.progressBar.style.transform = `scaleX(${Math.max(0, Math.min(1, fraction))})`;
}

/* ---------------- Render ---------------- */

const STATUS_LABEL = {
    pending: "En cola…",
    processing: "Comprimiendo…",
    ready: "Lista",
    uploading: "Subiendo…",
    done: "Subida ✓"
};

function itemHtml(item) {
    const sizes = item.processed
        ? `${formatBytes(item.file.size)} → <strong>${formatBytes(item.processed.blob.size)}</strong>`
        : formatBytes(item.file.size);
    const status = item.status === "error" ? item.error : STATUS_LABEL[item.status];
    return `
        <div class="upload-item__thumb">
            ${item.previewUrl ? `<img src="${item.previewUrl}" alt="">` : `<span class="spinner" aria-hidden="true"></span>`}
        </div>
        <div class="upload-item__info">
            <span class="upload-item__sizes">${sizes}</span>
            <span class="upload-item__status">${escapeHtml(status)}</span>
        </div>
        ${uploading ? "" : `<button type="button" class="upload-item__remove" data-remove="${item.key}" aria-label="Quitar foto">✕</button>`}`;
}

function renderItem(item) {
    if (!item.el) return;
    item.el.className = `upload-item is-${item.status}`;
    item.el.innerHTML = itemHtml(item);
}

function render() {
    els.list.innerHTML = "";
    items.forEach(item => {
        item.el = document.createElement("li");
        els.list.appendChild(item.el);
        renderItem(item);
    });

    const ready = items.filter(i => i.status === "ready");
    const processing = items.some(i => i.status === "pending" || i.status === "processing");
    const originalTotal = ready.reduce((s, i) => s + i.file.size, 0);
    const finalTotal = ready.reduce((s, i) => s + i.processed.blob.size, 0);

    els.actions.hidden = items.length === 0;
    els.summary.textContent = items.length === 0 ? "" :
        processing ? `Preparando fotos… (${ready.length} de ${items.length})` :
        ready.length ? `${ready.length} ${ready.length === 1 ? "foto lista" : "fotos listas"} · ${formatBytes(originalTotal)} → ${formatBytes(finalTotal)}` :
        "Ninguna foto válida";
    els.submit.disabled = uploading || processing || ready.length === 0;
    els.submit.textContent = uploading ? "Subiendo…" : ready.length > 1 ? `Subir ${ready.length} fotos` : "Subir";
    els.clear.disabled = uploading;
}
