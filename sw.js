"use strict";
const CACHE_NAME = "ihyaa-app-shell-v18";
const BASE = new URL("./", self.registration.scope);
const SHELL = [
  BASE.href,
  new URL("index.html", BASE).href,
  new URL("game.html", BASE).href,
  new URL("ihyaa-premium.css", BASE).href,
  new URL("Arabic%20Calligraphy%20Emblem%20with%20Gold%20Accents.png", BASE).href
];
self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;
  if (request.mode === "navigate") {
    event.respondWith(fetch(request.url, {cache:"no-store", credentials:"same-origin", headers:request.headers}).then(response => {
      if (response && response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
      }
      return response;
    }).catch(async () => {
      const cache = await caches.open(CACHE_NAME);
      const exact = await cache.match(request);
      return exact || await cache.match(new URL("game.html", BASE).href) || await cache.match(new URL("index.html", BASE).href);
    }));
    return;
  }
  event.respondWith(caches.match(request, {ignoreSearch: true}).then(cached => cached || fetch(request).then(response => {
    if (response && response.ok) {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
    }
    return response;
  })));
});
