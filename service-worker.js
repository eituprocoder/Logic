const CACHE = "logic-ai-3-2-pwa-v1";
const APP_SHELL = ["./", "./index.html", "./manifest.json"];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

function isLiveApi(url) {
  return /wikipedia\.org|wikimedia\.org|open-meteo\.com/i.test(url.hostname);
}

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);

  // Los datos actuales/conocimiento online se buscan en red. Si falla,
  // Logic decide localmente si tiene memoria aprendida suficiente.
  if (isLiveApi(url)) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Navegación: red primero para actualizar la app; index en caché como respaldo.
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put("./index.html", copy));
          return response;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  // App shell y librerías CDN: caché primero, luego red y cacheo de la respuesta.
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
      if (response && (response.ok || response.type === "opaque")) {
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put(event.request, copy));
      }
      return response;
    }))
  );
});
