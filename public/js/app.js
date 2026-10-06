/**
 * Arranque de la app de invitados: pantalla de acceso, navegación (Inicio, Tablón,
 * ＋, Boda, Tú), cuenta atrás, información de la boda, perfil e instalación como PWA.
 */
import { weddingConfig } from "./wedding-config.js";
import { isFirebaseConfigured } from "./firebase-config.js";
import { $, $$, escapeHtml, formatWeddingDate, getWeddingDate, mapsLink, applyTheme, showToast, friendlyError } from "./utils.js";
import { checkAccessCode, isDeviceAuthorized, authorizeDevice, logoutGuest, ensureGuestSession, currentUid } from "./auth.js";
import { initGallery, setGalleryView } from "./gallery.js";
import { initStories } from "./stories.js";
import { initUpload } from "./upload.js";
import { isViewerOpen, closeViewer } from "./viewer.js";
import { aliasFor } from "./identity.js";

const VIEWS = ["inicio", "tablon", "subir", "boda", "mas"];
const ALIASES = { galeria: "inicio" };   // enlaces antiguos
let appStarted = false;

/* ---------------- Textos de la configuración ---------------- */

function fillStaticTexts() {
    const dateText = formatWeddingDate();
    $$("[data-couple]").forEach(el => (el.textContent = weddingConfig.coupleNames));
    $$("[data-date]").forEach(el => (el.textContent = dateText));
    $$("[data-monogram]").forEach(el => (el.textContent = weddingConfig.monogram));
    $$("[data-text]").forEach(el => {
        const value = weddingConfig.texts[el.dataset.text];
        if (value) el.textContent = value;
    });
    document.title = weddingConfig.coupleNames;
    if (weddingConfig.heroImage) {
        const gate = $("#gate");
        gate.style.setProperty("--hero-image", `url(${JSON.stringify(weddingConfig.heroImage)})`);
        gate.classList.add("has-image");
    }
}

/* ---------------- Pantalla de acceso ---------------- */

function initGate() {
    const form = $("#gate-form");
    const input = $("#gate-code");
    const error = $("#gate-error");
    form.addEventListener("submit", e => {
        e.preventDefault();
        error.textContent = "";
        if (!checkAccessCode(input.value)) {
            error.textContent = "El código introducido no es correcto.";
            input.setAttribute("aria-invalid", "true");
            form.classList.remove("shake");
            void form.offsetWidth;
            form.classList.add("shake");
            return;
        }
        input.removeAttribute("aria-invalid");
        input.value = "";
        authorizeDevice();
        showApp();
    });
}

function showGate() {
    $("#app").hidden = true;
    $("#gate").hidden = false;
}

function showApp() {
    $("#gate").hidden = true;
    $("#app").hidden = false;
    route();
    if (appStarted) return;
    appStarted = true;
    if (!isFirebaseConfigured) {
        showToast("Falta configurar Firebase (js/firebase-config.js).", "error", 10000);
        return;
    }
    ensureGuestSession()
        .then(() => {
            renderProfile();
            initGallery();
            setGalleryView(currentView());
            initStories();
            initUpload({
                onUploaded: n => {
                    location.hash = "#inicio";
                    showToast(n === 1 ? "¡Foto publicada! 🎉" : `¡${n} fotos publicadas! 🎉`, "success", 4000);
                }
            });
        })
        .catch(err => {
            console.error(err);
            showToast(friendlyError(err), "error", 10000);
        });
}

/* ---------------- Navegación ---------------- */

function currentView() {
    const name = location.hash.replace("#", "");
    const view = ALIASES[name] || name;
    return VIEWS.includes(view) ? view : "inicio";
}

function route() {
    if (isViewerOpen() && !history.state?.viewer) closeViewer();
    const view = currentView();
    VIEWS.forEach(v => { $(`#view-${v}`).hidden = v !== view; });
    $$(".tabbar__item").forEach(a => {
        const active = a.getAttribute("href") === `#${view}`;
        a.classList.toggle("is-active", active);
        if (active) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
    if (appStarted) setGalleryView(view);
    window.scrollTo(0, 0);
}

/* ---------------- Cuenta atrás: chip, banner y tarjeta ---------------- */

function initCountdown() {
    const target = getWeddingDate();
    const { texts } = weddingConfig;
    const chip = $("#countdown-chip");
    const banner = $("#banner");
    const box = $("#countdown");
    const message = $("#countdown-message");
    const parts = { days: $("#cd-days"), hours: $("#cd-hours"), minutes: $("#cd-minutes"), seconds: $("#cd-seconds") };
    const pad = n => String(n).padStart(2, "0");
    let lastBanner = "";

    const setBanner = (emoji, title, text) => {
        const html = `<span class="banner__emoji" aria-hidden="true">${emoji}</span>
            <div><p class="banner__title">${escapeHtml(title)}</p><p class="banner__text">${escapeHtml(text)}</p></div>`;
        if (html !== lastBanner) { banner.innerHTML = html; lastBanner = html; }
    };

    const tick = () => {
        const now = new Date();
        const diff = target - now;
        const sameDay = now.toDateString() === target.toDateString();
        if (diff > 0) {
            const s = Math.floor(diff / 1000);
            const days = Math.floor(s / 86400);
            parts.days.textContent = days;
            parts.hours.textContent = pad(Math.floor((s % 86400) / 3600));
            parts.minutes.textContent = pad(Math.floor((s % 3600) / 60));
            parts.seconds.textContent = pad(s % 60);
            message.textContent = texts.countdownBefore;
            box.hidden = false;
            chip.textContent = days > 0 ? `⏳ ${days} ${days === 1 ? "día" : "días"}` : `⏳ ${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}`;
            setBanner("⏳", days > 0 ? `¡Faltan ${days} ${days === 1 ? "día" : "días"}!` : "¡Ya casi está!", texts.countdownBefore);
        } else {
            box.hidden = true;
            message.textContent = sameDay ? texts.countdownToday : texts.countdownAfter;
            chip.textContent = sameDay ? "🎉 Hoy" : "💍";
            if (sameDay) setBanner("🎉", texts.countdownToday, "Sube tus fotos y mira las historias de cada momento");
            else setBanner("❤️", texts.countdownAfter, "Revive el día en las historias y en el tablón");
        }
        markCurrentMoment(now);
    };
    tick();
    setInterval(tick, 1000);
}

/* ---------------- Información de la boda ---------------- */

const pending = `<span class="muted">Por confirmar</span>`;

function placeCard(icon, title, place) {
    const link = mapsLink(place);
    return `
        <article class="card place">
            <span class="card__icon" aria-hidden="true">${icon}</span>
            <h3 class="card__title">${title}</h3>
            <p class="place__name">${place.name ? escapeHtml(place.name) : pending}</p>
            <p class="place__meta">🕐 ${place.time ? escapeHtml(place.time) : pending}</p>
            <p class="place__meta">${place.address ? escapeHtml(place.address) : `Dirección: ${pending}`}</p>
            ${link
                ? `<a class="btn btn--grad" href="${escapeHtml(link)}" target="_blank" rel="noopener"><svg class="i"><use href="#i-pin"/></svg>Cómo llegar</a>`
                : `<button class="btn btn--ghost" type="button" disabled>📍 Cómo llegar</button>`}
        </article>`;
}

function renderWeddingInfo() {
    const { ceremony, reception, schedule, extraInfo } = weddingConfig;
    const samePlace = reception?.name === ceremony?.name && reception?.address === ceremony?.address;
    $("#wedding-places").innerHTML = samePlace
        ? placeCard("⛪🥂", "Ceremonia y banquete", { ...ceremony, time: [ceremony.time, reception.time].filter(Boolean).join(" · ") })
        : placeCard("⛪", "Ceremonia", ceremony) + placeCard("🥂", "Banquete", reception);

    $("#wedding-schedule").innerHTML = schedule.length
        ? schedule.map((s, i) => `
            <li class="timeline__item" data-i="${i}">
                <span class="timeline__time">${s.time ? escapeHtml(s.time) : "--:--"}</span>
                <div><strong>${escapeHtml(s.title || "")}</strong>${s.description ? `<p>${escapeHtml(s.description)}</p>` : ""}</div>
            </li>`).join("")
        : `<li class="timeline__empty">Los horarios se publicarán muy pronto.</li>`;

    $("#wedding-extra").innerHTML = extraInfo.length
        ? extraInfo.map(i => `<article class="card"><h3 class="card__title">${escapeHtml(i.title || "")}</h3><p>${escapeHtml(i.text || "")}</p></article>`).join("")
        : `<article class="card"><p class="muted">Pronto añadiremos más información.</p></article>`;
}

/** Resalta en el programa el momento que se está viviendo (solo el día de la boda). */
function markCurrentMoment(now) {
    const target = getWeddingDate();
    const items = $$("#wedding-schedule .timeline__item");
    let current = -1;
    if (now.toDateString() === target.toDateString()) {
        weddingConfig.schedule.forEach((s, i) => {
            const [hh, mm] = String(s.time || "").split(":").map(Number);
            const t = new Date(target);
            t.setHours(hh || 0, mm || 0, 0, 0);
            if (t <= now) current = i;
        });
    }
    items.forEach((li, i) => li.classList.toggle("is-now", i === current));
}

/* ---------------- Perfil ("Tú") ---------------- */

function renderProfile() {
    const me = aliasFor(currentUid());
    $("#me-avatar").textContent = me.emoji;
    $("#me-title").textContent = `@${me.handle}`;
}

/* ---------------- Subida desde el botón ＋ ---------------- */

function initPicker() {
    // El ＋, "Tu foto" y los botones "Subir" son <label for="upload-input">: abren el selector
    // de fotos directamente. Al elegir, se muestra la pantalla de publicación.
    $("#upload-input").addEventListener("change", () => {
        if ($("#upload-input").files?.length) {
            if (isViewerOpen()) closeViewer();
            location.hash = "#subir";
        }
    });
}

/* ---------------- PWA ---------------- */

function initPwa() {
    if ("serviceWorker" in navigator) {
        window.addEventListener("load", () => navigator.serviceWorker.register("service-worker.js").catch(console.warn));
    }
}

/* ---------------- Inicio ---------------- */

function init() {
    applyTheme();
    fillStaticTexts();
    initGate();
    renderWeddingInfo();
    initCountdown();
    initPicker();
    initPwa();
    window.addEventListener("hashchange", route);

    $("#logout-btn").addEventListener("click", () => {
        logoutGuest();
        location.hash = "";
        showGate();
    });

    if (isDeviceAuthorized()) showApp(); else showGate();
    document.documentElement.classList.add("is-ready");
}

init();
