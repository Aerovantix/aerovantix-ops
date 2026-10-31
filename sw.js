// Aerovantix Ops · Service worker: precaché del app shell (HTML, CSS, JS, fuentes, íconos y logo) para trabajar sin conexión.
// Las llamadas al motor (script.google.com) nunca se guardan en caché: la cola de salida vive en IndexedDB.
const CACHE = 'avx-ops-5987b4857b';
const ARCHIVOS = [
  "./",
  "css/app.css",
  "css/base.css",
  "css/componentes.css",
  "css/tokens.css",
  "fuentes/aerovantix-texto-400.woff",
  "fuentes/aerovantix-texto-700.woff",
  "fuentes/aerovantix-titulos-400.woff",
  "fuentes/aerovantix-titulos-700.woff",
  "iconos/iconos.svg",
  "img/apple-touch-icon.png",
  "img/emblema-blanco.png",
  "img/emblema-color.png",
  "img/favicon-16.png",
  "img/favicon-32.png",
  "img/favicon.ico",
  "img/icono-192.png",
  "img/icono-512.png",
  "img/icono-maskable-192.png",
  "img/icono-maskable-512.png",
  "img/lockup-blanco.png",
  "img/lockup-color.png",
  "img/marca-blanco.png",
  "img/marca-color.png",
  "index.html",
  "js/api.js",
  "js/app.js",
  "js/config.js",
  "js/crud.js",
  "js/datos.js",
  "js/db.js",
  "js/estado.js",
  "js/forms.js",
  "js/graficas.js",
  "js/media.js",
  "js/modulos/administracion.js",
  "js/modulos/comercial.js",
  "js/modulos/comunes.js",
  "js/modulos/cotizaciones.js",
  "js/modulos/inicio.js",
  "js/modulos/operacion.js",
  "js/modulos/portal.js",
  "js/modulos/procesos.js",
  "js/modulos/servicios.js",
  "js/modulos/sistema.js",
  "js/progreso.js",
  "js/router.js",
  "js/sync.js",
  "js/ui.js",
  "js/vistas.js",
  "manifest.webmanifest"
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('avx-ops-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    // App de una sola página: siempre el index precacheado (funciona sin señal).
    e.respondWith(caches.match('index.html').then(r => r || fetch(req)));
    return;
  }
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(r => r || fetch(req).then(res => {
    if (res.ok && res.type === 'basic') { const copia = res.clone(); caches.open(CACHE).then(c => c.put(req, copia)); }
    return res;
  })));
});
