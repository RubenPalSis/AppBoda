/**
 * Arranque de la app de invitados: pantalla de acceso, navegación, portada,
 * cuenta atrás, información de la boda e instalación como PWA.
 */
import { weddingConfig } from "./wedding-config.js";
import { isFirebaseConfigured } from "./firebase-config.js";
import { $, $$, escapeHtml, formatWeddingDate, getWeddingDate, mapsLink, applyTheme, isIOS, isStandalone, showToast, friendlyError } from "./utils.js";
import { checkAccessCode, isDeviceAuthorized, authorizeDevice, logoutGuest, ensureGuestSession } from "./auth.js";
import { initGallery } from "./gallery.js";
import { initUpload } from "./upload.js";

const VIEWS = ["inicio", "galeria", "subir", "boda", "mas"];
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
        $$(".hero").forEach(el => {
            el.style.setProperty("--hero-image", `url("${weddingConfig.heroImage}")`);
            el.classList.add("hero--image");
        });
    }
}

/* ---------------- Pantalla de acceso ---------------- */

function initGate() {
    const form = $("#gate-form");
    const input = $("#gate-code");
    const error = $("#gate-error");
    form.addEventListener("submit", async e => {
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
    document.body.classList.remove("is-app");
}

function showApp() {
    $("#gate").hidden = true;
    $("#app").hidden = false;
    document.body.classList.add("is-app");
    route();
    if (appStarted) return;
    appStarted = true;
    if (!isFirebaseConfigured) {
        showToast("Falta configurar Firebase (js/firebase-config.js).", "error", 10000);
        return;
    }
    ensureGuestSession()
        .then(() => {
            initGallery();
            initUpload({ onUploaded: () => { location.hash = "#galeria"; } });
        })
        .catch(err => {
            console.error(err);
            showToast(friendlyError(err), "error", 10000);
        });
}

/* ---------------- Navegación ---------------- */

function route() {
    const name = location.hash.replace("#", "");
    const view = VIEWS.includes(name) ? name : "inicio";
    VIEWS.forEach(v => {
        const section = $(`#view-${v}`);
        const active = v === view;
        section.hidden = !active;
        section.classList.toggle("is-active", active);
    });
    $$(".tabbar__item").forEach(a => {
        const active = a.getAttribute("href") === `#${view}`;
        a.classList.toggle("is-active", active);
        if (active) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
    window.scrollTo(0, 0);
}

/* ---------------- Cuenta atrás ---------------- */

function initCountdown() {
    const target = getWeddingDate();
    const box = $("#countdown");
    const message = $("#countdown-message");
    const parts = { days: $("#cd-days"), hours: $("#cd-hours"), minutes: $("#cd-minutes"), seconds: $("#cd-seconds") };
    const pad = n => String(n).padStart(2, "0");

    const tick = () => {
        const now = new Date();
        const diff = target - now;
        if (diff > 0) {
            const s = Math.floor(diff / 1000);
            parts.days.textContent = Math.floor(s / 86400);
            parts.hours.textContent = pad(Math.floor((s % 86400) / 3600));
            parts.minutes.textContent = pad(Math.floor((s % 3600) / 60));
            parts.seconds.textContent = pad(s % 60);
            message.textContent = weddingConfig.texts.countdownBefore;
            box.hidden = false;
            return true;
        }
        box.hidden = true;
        const sameDay = now.toDateString() === target.toDateString();
        message.textContent = sameDay ? weddingConfig.texts.countdownToday : weddingConfig.texts.countdownAfter;
        return sameDay; // seguimos comprobando hasta que pase el día
    };
    tick();
    const timer = setInterval(() => { if (!tick() && new Date() > target) clearInterval(timer); }, 1000);
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
                ? `<a class="btn btn--outline" href="${escapeHtml(link)}" target="_blank" rel="noopener">📍 Cómo llegar</a>`
                : `<button class="btn btn--outline" type="button" disabled>📍 Cómo llegar</button>`}
        </article>`;
}

function renderWeddingInfo() {
    const { ceremony, reception, schedule, extraInfo } = weddingConfig;
    $("#wedding-places").innerHTML = placeCard("⛪", "Ceremonia", ceremony) + placeCard("🥂", "Banquete", reception);

    $("#wedding-schedule").innerHTML = schedule.length
        ? schedule.map(s => `
            <li class="timeline__item">
                <span class="timeline__time">${s.time ? escapeHtml(s.time) : "--:--"}</span>
                <div><strong>${escapeHtml(s.title || "")}</strong>${s.description ? `<p>${escapeHtml(s.description)}</p>` : ""}</div>
            </li>`).join("")
        : `<li class="timeline__empty">Los horarios se publicarán muy pronto.</li>`;

    $("#wedding-extra").innerHTML = extraInfo.length
        ? extraInfo.map(i => `<article class="card"><h3 class="card__title">${escapeHtml(i.title || "")}</h3><p>${escapeHtml(i.text || "")}</p></article>`).join("")
        : `<article class="card"><p class="muted">Pronto añadiremos más información.</p></article>`;
}

/* ---------------- PWA ---------------- */

let deferredPrompt = null;

function initPwa() {
    if ("serviceWorker" in navigator) {
        window.addEventListener("load", () => navigator.serviceWorker.register("service-worker.js").catch(console.warn));
    }
    const installBtn = $("#install-btn");
    const installHelp = $("#install-help");

    if (isStandalone()) {
        installHelp.textContent = "La app ya está instalada en este dispositivo. ✨";
    } else if (isIOS()) {
        installHelp.innerHTML = "En iPhone/iPad abre esta página en <strong>Safari</strong>, pulsa <strong>Compartir</strong> (el cuadrado con la flecha) y elige <strong>«Añadir a pantalla de inicio»</strong>.";
    } else {
        installHelp.innerHTML = "En Android abre el menú <strong>⋮</strong> de Chrome y elige <strong>«Instalar aplicación»</strong> o <strong>«Añadir a pantalla de inicio»</strong>.";
    }

    window.addEventListener("beforeinstallprompt", e => {
        e.preventDefault();
        deferredPrompt = e;
        installBtn.hidden = false;
    });
    installBtn.addEventListener("click", async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        await deferredPrompt.userChoice;
        deferredPrompt = null;
        installBtn.hidden = true;
    });
    window.addEventListener("appinstalled", () => { installBtn.hidden = true; });
}

/* ---------------- Inicio ---------------- */

function init() {
    applyTheme();
    fillStaticTexts();
    initGate();
    initCountdown();
    renderWeddingInfo();
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
