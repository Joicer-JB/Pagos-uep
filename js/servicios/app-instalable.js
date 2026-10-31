// App instalable: con sw.js y manifest.webmanifest la plataforma se puede instalar en el teléfono o la computadora
// (ícono propio, pantalla completa) y abrir sin internet.
// En Chrome/Android aparece el botón «📲 Instalar» en la cabecera; en el iPhone ese botón explica cómo hacerlo
// (Compartir → «Agregar a pantalla de inicio»): ver botonInstalar() en navegacion.js.

let eventoInstalar = null; // lo da el navegador cuando la app se puede instalar

if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
  window.addEventListener("load", () =>
    navigator.serviceWorker.register("sw.js").catch((e) => console.warn("No se pudo activar el modo app:", e.message))
  );
}
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault(); // en vez del aviso del navegador, el botón de la cabecera
  eventoInstalar = e;
  if (auth) render();
});
window.addEventListener("appinstalled", () => {
  eventoInstalar = null;
  if (auth) render();
});
async function instalarApp() {
  if (!eventoInstalar) return;
  eventoInstalar.prompt();
  await eventoInstalar.userChoice.catch(() => null);
  eventoInstalar = null;
  render();
}
