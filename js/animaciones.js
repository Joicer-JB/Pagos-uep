// Animaciones: pequeños movimientos que hacen la plataforma más agradable de usar.
// · Al cambiar de pestaña, las tarjetas aparecen una tras otra.
// · Las ventanas (modales) aparecen subiendo suavemente.
// · Al registrar un pago, un chulito (✓) animado: «¡Pago realizado con éxito!».
// Usan element.animate() (no cambian el HTML) y se apagan solas si el dispositivo pide «reducir movimiento»
// (Ajustes de accesibilidad). Los estilos están en css/animaciones.css.

const sinMovimiento = () => !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

// Anima un elemento si se puede; si no, no hace nada
function animar(el, cuadros, opciones) {
  if (!el || !el.animate || sinMovimiento()) return null;
  return el.animate(cuadros, { duration: 260, easing: "cubic-bezier(.2,.8,.2,1)", fill: "backwards", ...opciones });
}

// Entrada de una pestaña: sus primeras tarjetas aparecen escalonadas
function animarEntradaPestana() {
  const tc = document.getElementById("tab-content");
  if (!tc) return;
  [...tc.children].slice(0, 8).forEach((el, i) =>
    animar(
      el,
      [
        { opacity: 0, transform: "translateY(10px)" },
        { opacity: 1, transform: "none" },
      ],
      { delay: i * 45 }
    )
  );
}

// Una ventana nueva: el fondo se oscurece y la caja sube. Solo la primera vez que se dibuja cada ventana
// (render() se llama muchas veces con la misma ventana abierta).
let _modalAnimado = null;
function animarModalSiEsNuevo() {
  if (!modalActual) {
    _modalAnimado = null;
    return;
  }
  if (modalActual === _modalAnimado) return;
  _modalAnimado = modalActual;
  animar(document.querySelector(".modal-bg"), [{ opacity: 0 }, { opacity: 1 }], { duration: 200 });
  animar(
    document.querySelector(".modal"),
    [
      { opacity: 0, transform: "translateY(24px) scale(.97)" },
      { opacity: 1, transform: "none" },
    ],
    { duration: 300 }
  );
}

// Animación de éxito: círculo verde que se dibuja, chulito (✓), destellos y el mensaje.
// No bloquea la pantalla (se puede seguir usando el recibo que queda debajo) y se quita sola.
const DURACION_EXITO = 2200; // ms que se ve antes de desvanecerse
function mostrarExito(titulo, detalle = "") {
  document.querySelectorAll(".exito-overlay").forEach((e) => e.remove());
  const o = document.createElement("div");
  o.className = "exito-overlay" + (sinMovimiento() ? " quieto" : "");
  o.setAttribute("role", "status");
  o.setAttribute("aria-live", "polite");
  const chispas = Array.from({ length: 8 }, (_, i) => `<span class="exito-chispa" style="--giro:${i * 45}deg"></span>`);
  o.innerHTML = `<div class="exito-caja">
      <div class="exito-icono">
        <svg viewBox="0 0 52 52" aria-hidden="true">
          <circle class="exito-circulo" cx="26" cy="26" r="24"/>
          <path class="exito-chulito" d="M15 27.5l7.5 7.5L38 19"/>
        </svg>
        ${chispas.join("")}
      </div>
      <div class="exito-titulo">${escHtml(titulo)}</div>
      ${detalle ? `<div class="exito-detalle">${escHtml(detalle)}</div>` : ""}
    </div>`;
  document.body.appendChild(o);
  setTimeout(() => o.classList.add("saliendo"), DURACION_EXITO);
  setTimeout(() => o.remove(), DURACION_EXITO + 400);
  return o;
}
