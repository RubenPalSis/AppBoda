/**
 * Panel de administración.
 *
 * - Inicio de sesión con Firebase Authentication (email/contraseña). No hay
 *   contraseñas en el código.
 * - Solo se considera administrador a un usuario cuyo UID exista como documento
 *   en la colección "admins" de Firestore (se crea a mano desde la consola, ver README).
 *   Las reglas de Firestore/Storage hacen la misma comprobación, así que entrar en
 *   /admin.html sin serlo no da acceso a nada.
 */
import { weddingConfig } from "./wedding-config.js";
import {
    auth, db, doc, getDoc, onAuthStateChanged, signInWithEmailAndPassword,
    sendPasswordResetEmail, signOut, isFirebaseConfigured
} from "./firebase-config.js";
import { subscribePhotos, deletePhoto } from "./photos.js";
import {
    $, $$, applyTheme, showToast, confirmDialog, formatBytes, formatDateTime,
    downloadPhoto, photoFilename, fetchBlob, saveBlob, escapeHtml
} from "./utils.js";

const JSZIP_URL = "https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js";
const DAY = 24 * 60 * 60 * 1000;

let photos = [];
let unsubscribe = null;
const selected = new Set();

/* ---------------- Sesión ---------------- */

function initLogin() {
    const form = $("#login-form");
    const error = $("#login-error");
    form.addEventListener("submit", async e => {
        e.preventDefault();
        error.textContent = "";
        const email = $("#login-email").value.trim();
        const password = $("#login-password").value;
        if (!email || !password) { error.textContent = "Introduce email y contraseña."; return; }
        const btn = form.querySelector('[type="submit"]');
        btn.disabled = true;
        try {
            await signInWithEmailAndPassword(auth, email, password);
            $("#login-password").value = "";
        } catch (err) {
            console.warn(err);
            error.textContent = ["auth/invalid-credential", "auth/wrong-password", "auth/user-not-found", "auth/invalid-email"].includes(err.code)
                ? "Email o contraseña incorrectos."
                : err.code === "auth/too-many-requests" ? "Demasiados intentos. Espera unos minutos." : "No se ha podido iniciar sesión.";
        } finally {
            btn.disabled = false;
        }
    });

    $("#login-reset").addEventListener("click", async () => {
        const email = $("#login-email").value.trim();
        if (!email) { error.textContent = "Escribe tu email y vuelve a pulsar."; return; }
        try {
            await sendPasswordResetEmail(auth, email);
            showToast("Si el email existe, recibirás un enlace para cambiar la contraseña.", "success", 6000);
        } catch {
            showToast("No se ha podido enviar el email.", "error");
        }
    });

    $("#logout").addEventListener("click", () => signOut(auth));
}

async function isAdmin(user) {
    if (!user || user.isAnonymous) return false;
    try {
        return (await getDoc(doc(db, "admins", user.uid))).exists();
    } catch {
        return false;
    }
}

function showLogin() {
    unsubscribe?.();
    unsubscribe = null;
    photos = [];
    selected.clear();
    $("#dashboard").hidden = true;
    $("#login").hidden = false;
}

async function onUser(user) {
    if (!user || user.isAnonymous) return showLogin();
    if (!(await isAdmin(user))) {
        showLogin();
        $("#login-error").textContent = `Este usuario no es administrador. UID: ${user.uid}`;
        await signOut(auth);
        return;
    }
    $("#login").hidden = true;
    $("#dashboard").hidden = false;
    $("#admin-email").textContent = user.email || "";
    unsubscribe?.();
    unsubscribe = subscribePhotos(null, list => {
        photos = list;
        for (const id of selected) if (!photos.some(p => p.id === id)) selected.delete(id);
        render();
    }, err => {
        console.error(err);
        showToast("Error cargando fotos (revisa las reglas de Firestore).", "error", 6000);
    });
}

/* ---------------- Render ---------------- */

function visiblePhotos() {
    const filter = $("#filter").value;
    const sort = $("#sort").value;
    let list = filter === "recent" ? photos.filter(p => p.createdAt && Date.now() - p.createdAt < DAY) : [...photos];
    if (sort === "oldest") list.reverse();
    if (sort === "likes") list.sort((a, b) => (b.likes || 0) - (a.likes || 0));
    return list;
}

function render() {
    $("#stat-photos").textContent = photos.length;
    $("#stat-likes").textContent = photos.reduce((s, p) => s + (p.likes || 0), 0);
    $("#stat-recent").textContent = photos.filter(p => p.createdAt && Date.now() - p.createdAt < DAY).length;
    $("#stat-size").textContent = formatBytes(photos.reduce((s, p) => s + (p.size || 0), 0));

    const list = visiblePhotos();
    $("#admin-empty").hidden = list.length > 0;
    $("#admin-grid").innerHTML = list.map(p => `
        <article class="admin-card ${selected.has(p.id) ? "is-selected" : ""}" data-id="${p.id}">
            <img class="admin-card__img" src="${escapeHtml(p.thumbURL || p.downloadURL)}" alt="Foto" loading="lazy" data-open>
            <label class="admin-card__check"><input type="checkbox" data-select ${selected.has(p.id) ? "checked" : ""} aria-label="Seleccionar foto"></label>
            <div class="admin-card__meta"><span>❤️ ${p.likes || 0}</span><span>${formatDateTime(p.createdAt)}</span></div>
            <div class="admin-card__actions">
                <button type="button" class="btn btn--outline" data-download>⬇️ Descargar</button>
                <button type="button" class="btn btn--danger" data-delete>🗑️ Eliminar</button>
            </div>
        </article>`).join("");
    updateSelectionUI();
}

function updateSelectionUI() {
    $("#selection-count").textContent = `${selected.size} ${selected.size === 1 ? "seleccionada" : "seleccionadas"}`;
    $("#download-selected").disabled = selected.size === 0;
    $("#delete-selected").disabled = selected.size === 0;
    $("#download-all").disabled = photos.length === 0;
}

function initGrid() {
    const grid = $("#admin-grid");
    grid.addEventListener("change", e => {
        if (!e.target.matches("[data-select]")) return;
        const card = e.target.closest("[data-id]");
        e.target.checked ? selected.add(card.dataset.id) : selected.delete(card.dataset.id);
        card.classList.toggle("is-selected", e.target.checked);
        updateSelectionUI();
    });
    grid.addEventListener("click", async e => {
        const card = e.target.closest("[data-id]");
        if (!card) return;
        const photo = photos.find(p => p.id === card.dataset.id);
        if (!photo) return;
        if (e.target.closest("[data-open]")) window.open(photo.downloadURL, "_blank", "noopener");
        if (e.target.closest("[data-download]")) downloadPhoto(photo.downloadURL, photoFilename(photo));
        if (e.target.closest("[data-delete]")) removePhotos([photo]);
    });

    $("#filter").addEventListener("change", render);
    $("#sort").addEventListener("change", render);
    $("#select-all").addEventListener("click", () => { visiblePhotos().forEach(p => selected.add(p.id)); render(); });
    $("#select-none").addEventListener("click", () => { selected.clear(); render(); });
    $("#delete-selected").addEventListener("click", () => removePhotos(photos.filter(p => selected.has(p.id))));
    $("#download-selected").addEventListener("click", () => downloadZip(photos.filter(p => selected.has(p.id))));
    $("#download-all").addEventListener("click", () => downloadZip(photos));
}

/* ---------------- Eliminar ---------------- */

async function removePhotos(list) {
    if (!list.length) return;
    const ok = await confirmDialog({
        title: list.length === 1 ? "Eliminar foto" : `Eliminar ${list.length} fotos`,
        message: list.length === 1 ? "¿Seguro que quieres eliminar esta foto?" : `¿Seguro que quieres eliminar ${list.length} fotos? Esta acción no se puede deshacer.`,
        confirmText: "Eliminar",
        danger: true
    });
    if (!ok) return;
    let failed = 0;
    for (const photo of list) {
        try {
            await deletePhoto(photo, { purgeLikes: true });
            selected.delete(photo.id);
        } catch (err) {
            console.error(err);
            failed++;
        }
    }
    showToast(failed ? `${failed} fotos no se pudieron eliminar.` : "Fotos eliminadas", failed ? "error" : "success");
}

/* ---------------- ZIP ---------------- */

let jszipPromise;
function loadJSZip() {
    jszipPromise ||= new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = JSZIP_URL;
        s.onload = () => resolve(window.JSZip);
        s.onerror = () => { jszipPromise = null; reject(new Error("No se pudo cargar JSZip")); };
        document.head.appendChild(s);
    });
    return jszipPromise;
}

/**
 * Genera uno o varios ZIP con las fotos (orden cronológico: foto-001 es la más antigua).
 * Si hay más fotos que admin.zipMaxPhotosPerFile se generan varias partes para no
 * agotar la memoria del navegador.
 */
async function downloadZip(list) {
    if (!list.length) return;
    const { zipBaseName, zipMaxPhotosPerFile, downloadConcurrency } = weddingConfig.admin;
    const ordered = [...list].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    const digits = Math.max(3, String(ordered.length).length);
    const chunks = [];
    for (let i = 0; i < ordered.length; i += zipMaxPhotosPerFile) chunks.push(ordered.slice(i, i + zipMaxPhotosPerFile));

    const overlay = $("#zip-overlay");
    const text = $("#zip-text");
    const bar = $("#zip-bar");
    let cancelled = false;
    $("#zip-cancel").onclick = () => { cancelled = true; };
    overlay.hidden = false;
    const setProgress = (msg, f) => { text.textContent = msg; bar.style.transform = `scaleX(${f})`; };

    try {
        setProgress("Cargando…", 0);
        const JSZip = await loadJSZip();
        let processed = 0;
        const failed = [];

        for (let c = 0; c < chunks.length && !cancelled; c++) {
            const zip = new JSZip();
            const folder = zip.folder(zipBaseName);
            const chunk = chunks[c];
            const part = chunks.length > 1 ? ` (parte ${c + 1} de ${chunks.length})` : "";

            // Descargas en paralelo limitado.
            let next = 0;
            const worker = async () => {
                while (next < chunk.length && !cancelled) {
                    const photo = chunk[next++];
                    const number = ordered.indexOf(photo) + 1;
                    try {
                        const blob = await fetchBlob(photo.downloadURL);
                        folder.file(`foto-${String(number).padStart(digits, "0")}.jpg`, blob, { binary: true });
                    } catch (err) {
                        console.warn("No se pudo descargar", photo.id, err);
                        failed.push(photo);
                    }
                    processed++;
                    setProgress(`Descargando ${processed} de ${ordered.length}${part}…`, processed / ordered.length * 0.9);
                }
            };
            await Promise.all(Array.from({ length: downloadConcurrency }, worker));
            if (cancelled) break;

            setProgress(`Generando ZIP${part}…`, 0.9 + 0.1 * (c / chunks.length));
            // STORE: las fotos JPEG ya están comprimidas; recomprimir solo gasta CPU.
            const blob = await zip.generateAsync({ type: "blob", compression: "STORE" });
            const name = chunks.length > 1 ? `${zipBaseName}-parte-${c + 1}.zip` : `${zipBaseName}.zip`;
            saveBlob(blob, name);
        }

        if (cancelled) showToast("Descarga cancelada", "warning");
        else if (failed.length === ordered.length) {
            showToast("No se pudo descargar ninguna foto. ¿Has configurado CORS en Storage? (ver README)", "error", 9000);
        } else if (failed.length) {
            showToast(`ZIP generado. ${failed.length} fotos no se pudieron incluir.`, "warning", 7000);
        } else {
            showToast("ZIP generado correctamente ✓", "success");
        }
    } catch (err) {
        console.error(err);
        showToast("Error generando el ZIP.", "error");
    } finally {
        overlay.hidden = true;
    }
}

/* ---------------- Inicio ---------------- */

function init() {
    applyTheme();
    $$("[data-couple]").forEach(el => (el.textContent = weddingConfig.coupleNames));
    initLogin();
    initGrid();
    if (!isFirebaseConfigured) {
        $("#login").hidden = false;
        $("#login-error").textContent = "Falta configurar Firebase en js/firebase-config.js.";
        return;
    }
    onAuthStateChanged(auth, onUser);
}

init();
