/**
 * Historias (estilo Instagram / estados de WhatsApp).
 *
 *  ➕ Tu foto        → abre el selector de fotos
 *  💍 La boda        → tarjetas: cuenta atrás, lugar, programa, información…
 *  🆕 Recientes      → las últimas fotos subidas (bloque en tiempo real del feed)
 *  ⛪🥂🍽️💃 Momentos → una historia por cada momento del programa (wedding-config.schedule),
 *                     con las fotos subidas en esa franja horaria del día de la boda
 *  🔥 Las más queridas → las fotos con más likes
 *
 * Coste en lecturas: 1 por portada de momento (como mucho cada pocos minutos) y
 * 1 por foto vista al abrir una historia.
 */
import { weddingConfig } from "./wedding-config.js";
import { $, escapeHtml, formatWeddingDate, getWeddingDate, mapsLink, showToast, friendlyError } from "./utils.js";
import { currentUid } from "./auth.js";
import { fetchPhotosBetween, fetchTopPhotos } from "./photos.js";
import { getRecentPhotos, onPhotosChange } from "./gallery.js";
import { aliasFor } from "./identity.js";
import { openViewer, closeViewer } from "./viewer.js";

const SEEN_KEY = `wedding:${weddingConfig.weddingId}:seen`;
const COVER_TTL = 3 * 60 * 1000;
const MAX_STORY_PHOTOS = 40;

const BGS = [
    "linear-gradient(160deg, #f2c66d, #d6577a 60%, #8e5aa8)",
    "linear-gradient(160deg, #2b5876, #4e4376)",
    "linear-gradient(160deg, #b8975a, #6b4f2a)",
    "linear-gradient(160deg, #d6577a, #8e5aa8)",
    "linear-gradient(160deg, #11998e, #38ef7d)",
    "linear-gradient(160deg, #ee9ca7, #b06ab3)",
    "linear-gradient(160deg, #1f1c18, #4a3f35)"
];

let groups = [];               // grupos visibles en la barra
const covers = new Map();      // momento -> { photo|null, at }
let el;

/* ---------------- Visto / no visto ---------------- */

function seenMap() {
    try { return JSON.parse(localStorage.getItem(SEEN_KEY) || "{}"); } catch { return {}; }
}
function markSeen(id, ts = Date.now()) {
    const map = seenMap();
    map[id] = Math.max(map[id] || 0, ts);
    try { localStorage.setItem(SEEN_KEY, JSON.stringify(map)); } catch { /* noop */ }
}

/* ---------------- Momentos del programa ---------------- */

function momentEmoji(title) {
    const t = title.toLowerCase();
    if (/ceremon|iglesia|boda civil/.test(t)) return "💍";
    if (/c[oó]ctel|aperitivo|brindis/.test(t)) return "🥂";
    if (/comida|cena|banquete|men[uú]/.test(t)) return "🍽️";
    if (/fiest|baile|disco|barra/.test(t)) return "💃";
    if (/autob|bus|salida|llegada/.test(t)) return "🚌";
    if (/fin|despedida|recena/.test(t)) return "🌙";
    if (/tarta|postre/.test(t)) return "🍰";
    return "📸";
}

/** Franjas horarias del día de la boda a partir del programa. */
function moments() {
    const [y, m, d] = weddingConfig.date.split("-").map(Number);
    const list = [];
    let prev = null;
    for (const item of weddingConfig.schedule || []) {
        const [hh, mm] = String(item.time || "").split(":").map(Number);
        if (Number.isNaN(hh)) continue;
        let start = new Date(y, m - 1, d, hh, mm || 0);
        if (prev && start <= prev) start = new Date(start.getTime() + 86400000); // pasada la medianoche
        list.push({ id: `m:${item.time}`, title: item.title || item.time, emoji: momentEmoji(item.title || ""), start });
        prev = start;
    }
    list.forEach((mo, i) => { mo.end = list[i + 1]?.start || new Date(mo.start.getTime() + 6 * 3600000); });
    return list;
}

async function refreshCovers(force = false) {
    const now = Date.now();
    const jobs = moments()
        .filter(mo => mo.start.getTime() <= now)
        .filter(mo => force || !covers.has(mo.id) || now - covers.get(mo.id).at > COVER_TTL)
        .map(async mo => {
            try {
                const [photo] = await fetchPhotosBetween(mo.start, mo.end, 1);
                covers.set(mo.id, { photo: photo || null, at: Date.now() });
            } catch (err) {
                console.warn(err);
            }
        });
    if (!covers.has("top") || now - covers.get("top").at > COVER_TTL || force) {
        jobs.push(fetchTopPhotos(1)
            .then(([photo]) => covers.set("top", { photo: photo || null, at: Date.now() }))
            .catch(console.warn));
    }
    if (jobs.length) { await Promise.all(jobs); render(); }
}

/* ---------------- Tarjetas de "La boda" ---------------- */

const splitEmoji = text => {
    const m = String(text || "").match(/^(\p{Extended_Pictographic}️?)\s*(.*)$/u);
    return m ? [m[1], m[2]] : ["✨", String(text || "")];
};

function countdownText() {
    const diff = getWeddingDate() - new Date();
    if (diff <= 0) return null;
    const s = Math.floor(diff / 1000);
    return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}

function placeCard(emoji, title, place, bg) {
    if (!place?.name && !place?.address) return null;
    const link = mapsLink(place);
    return {
        type: "card", emoji: "💍", bg,
        html: `
            <div class="story-emoji">${emoji}</div>
            <h3>${escapeHtml(title)}</h3>
            ${place.name ? `<p class="big">${escapeHtml(place.name)}</p>` : ""}
            ${place.time ? `<p>🕐 ${escapeHtml(place.time)}</p>` : ""}
            ${place.address ? `<p>${escapeHtml(place.address)}</p>` : ""}
            ${link ? `<a class="btn" href="${escapeHtml(link)}" target="_blank" rel="noopener">📍 Cómo llegar</a>` : ""}`
    };
}

function weddingCards() {
    const { coupleNames, ceremony, reception, schedule = [], extraInfo = [], texts = {} } = weddingConfig;
    const cards = [];
    const pad = n => String(n).padStart(2, "0");

    cards.push({
        type: "card", emoji: "💍", bg: BGS[0], duration: 8000,
        html: `
            <div class="story-emoji">💍</div>
            <h3>${escapeHtml(coupleNames)}</h3>
            <p class="big">${escapeHtml(formatWeddingDate())}</p>
            <div data-cd></div>`,
        onShow(card) {
            const box = card.querySelector("[data-cd]");
            const tick = () => {
                const c = countdownText();
                box.innerHTML = c
                    ? `<p>${escapeHtml(texts.countdownBefore || "")}</p>
                       <div class="countdown"><div><span>${c.d}</span><small>días</small></div><div><span>${pad(c.h)}</span><small>horas</small></div><div><span>${pad(c.m)}</span><small>min</small></div><div><span>${pad(c.s)}</span><small>seg</small></div></div>`
                    : `<p class="big">${escapeHtml(new Date().toDateString() === getWeddingDate().toDateString() ? texts.countdownToday || "" : texts.countdownAfter || "")}</p>`;
            };
            tick();
            const t = setInterval(tick, 1000);
            return () => clearInterval(t);
        }
    });

    const c = placeCard("⛪", "Ceremonia", ceremony, BGS[1]);
    if (c) cards.push(c);
    const sameplace = reception?.name === ceremony?.name && reception?.address === ceremony?.address;
    if (!sameplace) {
        const r = placeCard("🥂", "Banquete", reception, BGS[2]);
        if (r) cards.push(r);
    }

    if (schedule.length) {
        cards.push({
            type: "card", emoji: "💍", bg: BGS[3], duration: 9000,
            html: `
                <div class="story-emoji">🗓️</div>
                <h3>El programa</h3>
                <ol>${schedule.map(s => `<li><b>${escapeHtml(s.time || "")}</b><span>${escapeHtml(s.title || "")}${s.description ? ` · ${escapeHtml(s.description)}` : ""}</span></li>`).join("")}</ol>`
        });
    }

    extraInfo.forEach((info, i) => {
        const [emoji, title] = splitEmoji(info.title);
        cards.push({
            type: "card", emoji: "💍", bg: BGS[(i + 4) % BGS.length],
            html: `<div class="story-emoji">${emoji}</div><h3>${escapeHtml(title)}</h3><p class="big">${escapeHtml(info.text || "")}</p>`
        });
    });

    cards.push({
        type: "card", emoji: "💍", bg: BGS[0],
        html: `
            <div class="story-emoji">📸</div>
            <h3>¡Comparte tus fotos!</h3>
            <p>${escapeHtml(texts.uploadIntro || "")}</p>
            <label for="upload-input" class="btn">➕ Subir fotos</label>`
    });
    return cards;
}

/* ---------------- Grupos ---------------- */

function buildGroups() {
    const recent = getRecentPhotos();
    const seen = seenMap();
    const now = Date.now();
    const list = [];

    list.push({ id: "boda", label: "La boda", emoji: "💍", seen: !!seen.boda });

    if (recent.length) {
        const newest = recent[0].createdAt?.getTime() || now;
        list.push({ id: "recientes", label: "Recientes", cover: recent[0], seen: (seen.recientes || 0) >= newest });
    }

    for (const mo of moments()) {
        if (mo.start.getTime() > now) continue;
        const cover = covers.get(mo.id)?.photo;
        if (!cover) continue;
        const newest = recent.filter(p => p.createdAt >= mo.start && p.createdAt < mo.end)[0]?.createdAt?.getTime() || 0;
        list.push({ id: mo.id, label: mo.title, emoji: mo.emoji, cover, moment: mo, seen: !!seen[mo.id] && seen[mo.id] >= newest });
    }

    const top = covers.get("top")?.photo;
    if (top) list.push({ id: "top", label: "Más queridas", emoji: "🔥", cover: top, seen: false });
    return list;
}

function render() {
    if (!el) return;
    groups = buildGroups();
    const me = aliasFor(currentUid());
    const ring = g => g.cover
        ? `<img src="${escapeHtml(g.cover.thumbURL)}" alt="">`
        : `<span>${g.emoji}</span>`;
    el.innerHTML = `
        <label for="upload-input" class="story story--add" role="listitem">
            <span class="story__ring"><span>${me.emoji}</span><span class="story__plus"><svg class="i"><use href="#i-plus"/></svg></span></span>
            <span class="story__label">Tu foto</span>
        </label>
        ${groups.map((g, i) => `
            <button type="button" class="story ${g.seen ? "is-seen" : ""}" data-i="${i}" role="listitem" style="animation-delay:${i * 40}ms">
                <span class="story__ring">${ring(g)}</span>
                <span class="story__label">${escapeHtml(g.label)}</span>
            </button>`).join("")}`;
}

async function itemsFor(group) {
    const photoItems = list => list.map(photo => ({ type: "photo", photo }));
    switch (group.id) {
        case "boda": return weddingCards();
        case "recientes": return photoItems([...getRecentPhotos()].reverse());
        case "top": return photoItems(await fetchTopPhotos(20));
        default: return photoItems(await fetchPhotosBetween(group.moment.start, group.moment.end, MAX_STORY_PHOTOS));
    }
}

async function openGroup(index) {
    const group = groups[index];
    if (!group) return false;
    let items;
    try {
        items = await itemsFor(group);
    } catch (err) {
        console.error(err);
        showToast(friendlyError(err), "error");
        return false;
    }
    if (!items.length) return openGroup(index + 1);
    const newest = items.filter(i => i.type === "photo").map(i => i.photo.createdAt?.getTime() || 0);
    markSeen(group.id, newest.length ? Math.max(...newest) : Date.now());
    openViewer({
        mode: "story",
        title: group.label,
        items,
        onEnd: () => {
            render();
            if (index + 1 >= groups.length) return false;
            openGroup(index + 1).then(ok => { if (!ok) closeViewer(); });
            return true;
        }
    });
    return true;
}

export function initStories() {
    el = $("#stories");
    el.addEventListener("click", e => {
        const btn = e.target.closest("[data-i]");
        if (btn) openGroup(Number(btn.dataset.i)).then(render);
    });
    render();
    setTimeout(() => el.classList.add("stories--static"), 1500); // la animación de entrada, solo una vez
    refreshCovers();
    onPhotosChange(() => { render(); refreshCovers(); });
}
