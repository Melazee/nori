// Keeps Nori's home working without signal. (The AI model itself is cached separately by the AI library.)
const CACHE = 'nori-shell-v6';
const SHELL = ['./', './index.html', './worker.js', './tts-worker.js', './manifest.webmanifest', './icon-192.png', './icon-512.png', './frames/frames.json'];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(SHELL);
    try {
      const man = await (await fetch('./frames/frames.json')).json();
      await c.addAll(Object.values(man).flat().map((f) => './frames/' + f));
    } catch (_) { /* frames get cached as they load */ }
    self.skipWaiting();
  })());
});
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  const mine = url.origin === location.origin;
  const lib = url.hostname === 'cdn.jsdelivr.net' || url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (e.request.method !== 'GET' || (!mine && !lib)) return; // model downloads are handled by the AI library itself
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    try {
      const r = await fetch(e.request);
      if (r.ok) c.put(e.request, r.clone());
      return r;
    } catch (_) {
      const hit = await c.match(e.request, { ignoreSearch: mine });
      if (hit) return hit;
      throw _;
    }
  })());
});
