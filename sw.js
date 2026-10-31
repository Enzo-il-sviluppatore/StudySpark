const CACHE = "studyspark-v1";
const CDNS = ["www.gstatic.com", "cdnjs.cloudflare.com", "cdn.jsdelivr.net", "ajax.googleapis.com"];
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())
));
self.addEventListener("fetch", e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== "GET") return;
  const same = u.origin === location.origin;
  if (!same && !CDNS.includes(u.hostname)) return; // Firestore, sign-in, the AI Worker and images go straight to the network
  e.respondWith(caches.open(CACHE).then(async c => {
    const hit = await c.match(r);
    if (!same && hit) return hit; // versioned library files: cache first
    try { const res = await fetch(r); if (res.ok) c.put(r, res.clone()); return res; } // own files: network first, so updates show up
    catch (err) { if (hit) return hit; throw err; }
  }));
});
