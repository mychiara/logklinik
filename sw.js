const CACHE_NAME = "e-klinik-v1";
const ASSETS = [
  "/index.html",
  "/css/style.css",
  "/js/app.js",
  "/manifest.json",
  "https://cdn.jsdelivr.net/npm/chart.js",
  "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.25/jspdf.plugin.autotable.min.js",
  "https://unpkg.com/html5-qrcode",
];

// Install Event
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    }),
  );
});

// Fetch Event
self.addEventListener("fetch", (e) => {
  e.respondWith(
    caches
      .match(e.request)
      .then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;
        
        return fetch(e.request).catch(() => {
          // If network fails and it's an HTML request, return index.html
          if (e.request.url.indexOf(".html") > -1 || e.request.mode === 'navigate') {
            return caches.match("/index.html");
          }
          // Otherwise, the browser will handle the fetch error normally
          // We don't return undefined here to avoid the TypeError
        });
      })
  );
});

// Activate Event
self.addEventListener("activate", (e) => {
  const cacheWhiteList = [CACHE_NAME];
  e.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhiteList.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        }),
      );
    }),
  );
});
