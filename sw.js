const CACHE_NAME = "e-klinik-v10";
const ASSETS = [
  "./",
  "./index.html",
  "./css/style.css",
  "./js/app.js",
  "./js/supabase-config.js",
  "./js/supabase-services.js",
  "./manifest.json",
  "https://cdn.jsdelivr.net/npm/chart.js",
  "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.25/jspdf.plugin.autotable.min.js",
  "https://unpkg.com/html5-qrcode",
];

// Install Event
self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("PWA: Caching assets");
      return cache.addAll(ASSETS).catch((err) => {
        console.error("PWA: Cache addAll error:", err);
      });
    }),
  );
});

// Fetch Event - Network First Strategy
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);

  // Skip caching for Supabase and other external APIs
  if (
    url.hostname.includes("supabase.co") ||
    url.hostname.includes("google.com")
  ) {
    return;
  }

  // Network-first for local assets to ensure they stay updated
  e.respondWith(
    fetch(e.request)
      .then((networkResponse) => {
        // If successful, update the cache for next time
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // Fallback to cache if offline
        return caches.match(e.request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;

          // If HTML request failed and nothing in cache, redirect to root
          if (e.request.mode === "navigate") {
            return caches.match("./index.html");
          }
        });
      }),
  );
});

// Activate Event - Clean old caches
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log("PWA: Deleting old cache:", cacheName);
            return caches.delete(cacheName);
          }
        }),
      );
    }),
  );
  self.clients.claim();
});
