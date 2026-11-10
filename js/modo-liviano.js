// 🐢 Modo liviano: para computadoras sencillas. Quita lo que más trabajo le da a la tarjeta de video y al
// procesador sin cambiar nada de lo que se ve o se calcula: el vidrio esmerilado (desenfoque), las animaciones y
// las transiciones, y el fondo animado de la pantalla de entrada.
// · Se activa solo si el equipo tiene poca memoria (4 GB o menos) o pocos núcleos (2 o menos). El navegador solo
//   informa la memoria en Chrome y Edge.
// · En cada equipo se puede activar o quitar a mano desde la pantalla de entrada; esa elección manda.
// Los estilos están al final de css/animaciones.css (.modo-liviano).

const CLAVE_LIVIANO = "modoLiviano"; // "1" = activado a mano, "0" = quitado a mano, sin guardar = automático
function equipoSencillo() {
  const nucleos = navigator.hardwareConcurrency || 4;
  const memoria = navigator.deviceMemory; // en GB (aproximado); undefined si el navegador no lo dice
  return nucleos <= 2 || (memoria !== undefined && memoria <= 4);
}
function eleccionLiviano() {
  try {
    return localStorage.getItem(CLAVE_LIVIANO);
  } catch (e) {
    return null;
  }
}
let modoLiviano = eleccionLiviano() === "1" || (eleccionLiviano() !== "0" && equipoSencillo());
const aplicarModoLiviano = () =>
  document.documentElement && document.documentElement.classList.toggle("modo-liviano", modoLiviano);
aplicarModoLiviano();

function botonModoLiviano() {
  return `<button type="button" id="btn-modo-liviano" onclick="cambiarModoLiviano()" class="btn-modo-tactil">${
    modoLiviano
      ? "🐢 Modo liviano activado en este equipo · <u>quitar</u>"
      : "🐢 ¿Este equipo va lento? Activar modo liviano"
  }</button>`;
}
function cambiarModoLiviano() {
  modoLiviano = !modoLiviano;
  try {
    localStorage.setItem(CLAVE_LIVIANO, modoLiviano ? "1" : "0");
  } catch (e) {}
  aplicarModoLiviano();
  // La pantalla de entrada se vuelve a dibujar para encender o apagar su fondo animado
  if (!auth && typeof render === "function") render();
}
