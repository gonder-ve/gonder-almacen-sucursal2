/* ============================================================
   Service Worker — GONDER Sucursal 2 Almacén
   Estrategia: Network-first para la app (index.html),
               Cache-first para el resto del shell (iconos, manifest),
               Network-only para el Worker (API de Odoo/Telegram)
   ============================================================ */

const CACHE = 'gonder-almacen-sucursal2-v6';
const ASSETS = [
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
];

self.addEventListener('install', evt => {
  evt.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', evt => {
  evt.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', evt => {
  const url = new URL(evt.request.url);

  /* Cualquier llamada al Worker (Odoo/Telegram) → siempre red, nunca cache */
  if (url.origin !== location.origin) return;

  /* ── La app se pide SIEMPRE a la red primero ──
     Antes se servía desde la copia guardada, y por eso un teléfono podía
     seguir abriendo una versión vieja durante días sin que nadie se
     enterara: la app arrancaba de la copia local antes de preguntarle
     nada al servidor. Ahora la copia queda solo como respaldo para
     cuando no hay internet, que es para lo que estaba pensada. */
  const esLaApp = evt.request.mode === 'navigate'
    || url.pathname.endsWith('/index.html')
    || url.pathname.endsWith('/');

  if (esLaApp) {
    evt.respondWith(
      fetch(evt.request)
        .then(res => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE).then(c => c.put('./index.html', clone));
          }
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  /* El resto del shell (iconos, manifest) casi nunca cambia: desde la copia */
  evt.respondWith(
    caches.match(evt.request).then(cached => {
      if (cached) return cached;
      return fetch(evt.request).then(res => {
        if (res && res.status === 200 && res.type === 'basic') {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(evt.request, clone));
        }
        return res;
      });
    }).catch(() => caches.match('./index.html'))
  );
});
