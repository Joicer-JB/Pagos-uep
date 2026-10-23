// Service worker: permite instalar la plataforma como app y abrirla sin internet.
// · Al instalarse guarda una copia de todo lo que carga index.html (estilos, scripts, logo y bibliotecas).
// · Archivos de la app (este mismo sitio): primero la red, así siempre llega la versión nueva; si no hay conexión
//   (o tarda más de 5 s), la copia guardada.
// · Bibliotecas externas con versión fija (Firebase, jsDelivr): primero la copia guardada, porque nunca cambian.
// · Lo demás (Firestore, inicio de sesión, tasa del día) no pasa por aquí: Firestore guarda su propia copia.
// Si cambias este archivo, cambia también VERSION: así el navegador instala el nuevo y borra la copia vieja.

const VERSION = "v2"; // v2: archivos nuevos (nómina dividida, respaldo, proyección, App Check)
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
    const r = await conLimite(fetch(pedido), ESPERA_RED_MS);
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
