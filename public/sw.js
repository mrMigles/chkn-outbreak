// CHKN OUTBREAK service worker (D61). Installability and a friendly offline page — nothing more.
// It deliberately caches no game files: D56's build ids and cache headers stay the only source of truth,
// so an installed app never runs a stale build. Navigations go to the network; offline gets a notice.
const OFFLINE = 'chkn-offline-v1';
const PAGE = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>CHKN OUTBREAK</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#17191d;color:#e8e2d6;font:16px system-ui,sans-serif;text-align:center}
b{display:block;font-size:28px;color:#ffc84a;margin-bottom:10px}button{margin-top:18px;font:inherit;padding:10px 18px;border-radius:10px;border:0;background:#ffc84a;color:#1b1d21}</style></head>
<body><div><b>CHKN OUTBREAK</b>Нет связи с сервером игры.<br>Петушки подождут — проверьте интернет.<br><button onclick="location.reload()">Ещё раз</button></div></body></html>`;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(OFFLINE).then((c) => c.put('/__offline', new Response(PAGE, { headers: { 'content-type': 'text/html; charset=utf-8' } }))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== OFFLINE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.mode !== 'navigate') return;
  e.respondWith(fetch(e.request).catch(() => caches.match('/__offline')));
});
