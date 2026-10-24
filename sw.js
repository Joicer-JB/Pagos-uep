// Service worker: permite instalar la plataforma como app y abrirla sin internet.
// · Al instalarse guarda una copia de todo lo que carga index.html (estilos, scripts, logo y bibliotecas).
// · Archivos de la app (este mismo sitio): primero la red, así siempre llega la versión nueva; si no hay conexión
//   (o tarda más de 5 s), la copia guardada.
// · Bibliotecas externas con versión fija (Firebase, jsDelivr): primero la copia guardada, porque nunca cambian.
// · Lo demás (Firestore, inicio de sesión, tasa del día) no pasa por aquí: Firestore guarda su propia copia.
// Si cambias este archivo, cambia también VERSION: así el navegador instala el nuevo y borra la copia vieja.

const VERSION = "v4"; // v4: los archivos de la app se revisan siempre con el servidor (sin la copia del navegador)
const CACHE = "jjs-app-" + VERSION;
const BIBLIOTECAS_FIJAS = [
  /^https:\/\/www\.gstatic\.com\/firebasejs\/\d+\.\d+\.\d+\//,
  /^https:\/\/cdn\.jsdelivr\.net\/npm\/(@[^/]+\/)?[^/@]+@\d+\.\d+\.\d+\//,
];
const ESPERA_RED_MS = 5000;
const esLocal = (url) => new URL(url, self.location.href).origin === self.location.origin;

// Todo lo que carga index.html (src="…" y href="…"), más la propia página y el manifiesto
async function archivosDeLaApp() {
  const html = await (await fetch("index.html", { cache: "no-store" })).text();
  const refs = [...html.matchAll(/\s(?:src|href)="([^"#]+)"/g)].map((m) => m[1]).filter((u) => !u.startsWith("data:"));
  return ["./", "index.html", "manifest.webmanifest", ...refs].map((u) => new URL(u, self.location.href).href);
}
async function guardarCopia(cache, url) {
  // Las bibliotecas externas se piden como CORS (las de jsDelivr llevan integrity); si no se puede, sin CORS
  const pedir = (modo) => fetch(new Request(url, { mode: modo, cache: "no-cache" }));
  let r = await pedir(esLocal(url) ? "same-origin" : "cors").catch(() => null);
  if (!r && !esLocal(url)) r = await pedir("no-cors").catch(() => null);
  if (r && (r.ok || r.type === "opaque")) await cache.put(url, r);
}

self.addEventListener("install", (evento) => {
  self.skipWaiting();
  evento.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      const urls = await archivosDeLaApp().catch(() => ["./", "index.html"]);
      await Promise.allSettled(urls.map((u) => guardarCopia(cache, u)));
    })()
  );
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    (async () => {
      const nombres = await caches.keys();
      await Promise.all(nombres.filter((n) => n.startsWith("jjs-app-") && n !== CACHE).map((n) => caches.delete(n)));
      await self.clients.claim();
    })()
  );
});

const conLimite = (promesa, ms) =>
  Promise.race([promesa, new Promise((_, no) => setTimeout(() => no(new Error("la red tarda demasiado")), ms))]);

async function primeroLaRed(pedido) {
  const cache = await caches.open(CACHE);
  try {
    // «no-cache»: pregunta siempre al servidor, así una versión publicada llega al momento y no 10 minutos después
    const r = await conLimite(
      pedido.mode === "navigate" ? fetch(pedido) : fetch(pedido, { cache: "no-cache" }),
      ESPERA_RED_MS
    );
    if (r.ok) cache.put(pedido, r.clone());
    return r;
  } catch (err) {
    const copia =
      (await cache.match(pedido, { ignoreSearch: true })) ||
      (pedido.mode === "navigate" ? await cache.match(new URL("index.html", self.location.href).href) : null);
    if (copia) return copia;
    throw err;
  }
}
async function primeroLaCopia(pedido) {
  const cache = await caches.open(CACHE);
  const copia = await cache.match(pedido);
  if (copia) return copia;
  const r = await fetch(pedido);
  if (r.ok || r.type === "opaque") cache.put(pedido, r.clone());
  return r;
}

self.addEventListener("fetch", (evento) => {
  const pedido = evento.request;
  if (pedido.method !== "GET") return;
  if (BIBLIOTECAS_FIJAS.some((re) => re.test(pedido.url))) return evento.respondWith(primeroLaCopia(pedido));
  if (esLocal(pedido.url)) return evento.respondWith(primeroLaRed(pedido));
});

// ---- 📲 Avisos al teléfono (los manda herramientas/nube/avisos.js con Firebase Cloud Messaging).
// Llegan como datos: { titulo, cuerpo, url }. Se muestran aunque la plataforma esté cerrada; al tocarlos, se abre.
self.addEventListener("push", (evento) => {
  let d = {};
  try {
    d = evento.data ? evento.data.json() : {};
  } catch (e) {
    d = { data: { cuerpo: evento.data ? evento.data.text() : "" } };
  }
  const datos = d.data || {},
    n = d.notification || {};
  evento.waitUntil(
    self.registration.showNotification(datos.titulo || n.title || "JJS Gestión", {
      body: datos.cuerpo || n.body || "",
      icon: "assets/iconos/icono-192.png",
      badge: "assets/iconos/icono-192.png",
      tag: datos.tipo || undefined, // uno nuevo del mismo tipo reemplaza al anterior
      data: { url: datos.url || "./" },
    })
  );
});
self.addEventListener("notificationclick", (evento) => {
  evento.notification.close();
  const url = new URL((evento.notification.data && evento.notification.data.url) || "./", self.location.href).href;
  evento.waitUntil(
    (async () => {
      const abiertas = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const app = abiertas.find((c) => c.url.startsWith(new URL("./", self.location.href).href));
      if (app) return app.focus();
      return self.clients.openWindow(url);
    })()
  );
});
