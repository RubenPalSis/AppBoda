/**
 * Service Worker: permite instalar la app y que abra rápido aunque la red del
 * lugar de la boda sea mala. Las fotos y los datos (Firebase) NO se cachean aquí:
 * siempre se piden a la red para estar actualizados.
 *
 * IMPORTANTE: cambia CACHE_VERSION cada vez que despliegues cambios.
 */
const CACHE_VERSION = "v1.0.0";
const SHELL_CACHE = `boda-shell-${CACHE_VERSION}`;
const RUNTIME_CACHE = `boda-runtime-${CACHE_VERSION}`;

const SHELL = [
    "./",
    "./index.html",
    "./manifest.json",
    "./css/styles.css",
    "./js/app.js",
    "./js/auth.js",
    "./js/firebase-config.js",
    "./js/gallery.js",
    "./js/likes.js",
    "./js/photos.js",
    "./js/upload.js",
    "./js/utils.js",
    "./js/wedding-config.js",
    "./assets/icons/icon-192.png",
    "./assets/icons/icon-512.png",
    "./assets/icons/apple-touch-icon.png",
    "./assets/icons/favicon-32.png",
    "./assets/icons/icon.svg"
];

// Recursos externos que sí conviene guardar (SDK de Firebase y tipografías).
const RUNTIME_HOSTS = ["www.gstatic.com", "fonts.googleapis.com", "fonts.gstatic.com", "cdn.jsdelivr.net"];

self.addEventListener("install", event => {
    event.waitUntil(caches.open(SHELL_CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys.filter(k => k !== SHELL_CACHE && k !== RUNTIME_CACHE).map(k => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

async function networkFirst(request, fallbackUrl) {
    const cache = await caches.open(SHELL_CACHE);
    try {
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
    } catch {
        return (await cache.match(request, { ignoreSearch: true })) || (fallbackUrl && cache.match(fallbackUrl)) || Response.error();
    }
}

async function staleWhileRevalidate(request, cacheName) {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);
    const network = fetch(request)
        .then(response => {
            if (response.ok || response.type === "opaque") cache.put(request, response.clone());
            return response;
        })
        .catch(() => cached);
    return cached || network;
}

self.addEventListener("fetch", event => {
    const { request } = event;
    if (request.method !== "GET") return;
    const url = new URL(request.url);

    if (url.origin === self.location.origin) {
        // El panel de administración nunca se sirve desde caché.
        if (url.pathname.endsWith("/admin.html") || url.pathname.endsWith("/js/admin.js")) return;
        if (request.mode === "navigate") {
            event.respondWith(networkFirst(request, "./index.html"));
        } else {
            event.respondWith(staleWhileRevalidate(request, SHELL_CACHE));
        }
        return;
    }

    if (RUNTIME_HOSTS.includes(url.hostname)) {
        event.respondWith(staleWhileRevalidate(request, RUNTIME_CACHE));
    }
    // Firestore, Storage, Auth: sin intervención (siempre red).
});
