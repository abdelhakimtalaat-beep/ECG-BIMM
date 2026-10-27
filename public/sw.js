// Minimal service worker: makes the portal installable. It never caches data or pages (everything is private and live);
// it only shows a short message when the phone is offline.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => {
  if (e.request.mode !== 'navigate') return;
  e.respondWith(fetch(e.request).catch(() => new Response(
    '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline</title><body style="font-family:sans-serif;text-align:center;padding:3rem 1rem;color:#0B2545"><h2>You are offline</h2><p>Connect to the internet and reopen the portal.</p>',
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } })));
});
