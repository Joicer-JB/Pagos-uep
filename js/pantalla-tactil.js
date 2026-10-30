// 🖐️ Modo pantalla táctil (se activa en cada equipo, desde la pantalla de entrada). Es para las pantallas táctiles en
// las que no sale el teclado de Windows al tocar un campo, y en las que arrastrar el dedo selecciona texto en vez de
// subir y bajar (muchas pantallas táctiles se comportan como un ratón):
// · Teclado en pantalla propio: al tocar un campo de texto aparece abajo (el de Windows no sale: inputmode="none").
// · Arrastrar con el dedo sube y baja la página, la ventana o la tabla que esté debajo, con algo de impulso.
// Los campos de montos de la 💳 Caja siguen con su teclado numérico.

const CLAVE_TACTIL = "modoTactil";
let modoTactil = false;
try {
  modoTactil = localStorage.getItem(CLAVE_TACTIL) === "1";
} catch (e) {}
const aplicarModoTactil = () =>
  document.documentElement && document.documentElement.classList.toggle("modo-tactil", modoTactil);
aplicarModoTactil();

function botonModoTactil() {
  return `<button type="button" id="btn-modo-tactil" onclick="cambiarModoTactil()" class="btn-modo-tactil">${
    modoTactil
      ? "🖐️ Pantalla táctil activada en este equipo · <u>quitar</u>"
      : "🖐️ ¿Pantalla táctil? Activar teclado en pantalla"
  }</button>`;
}
function cambiarModoTactil() {
  modoTactil = !modoTactil;
  try {
    if (modoTactil) localStorage.setItem(CLAVE_TACTIL, "1");
    else localStorage.removeItem(CLAVE_TACTIL);
  } catch (e) {}
  aplicarModoTactil();
  if (!modoTactil) tecladoOcultar();
  const b = document.getElementById("btn-modo-tactil");
  if (b) b.outerHTML = botonModoTactil();
}

// ---- Teclado en pantalla ----
const TIPOS_TEXTO = ["text", "search", "email", "password", "tel", "url", "number"];
const campoDeTexto = (el) =>
  !!el &&
  !el.readOnly &&
  !el.disabled &&
  (el.tagName === "TEXTAREA" || (el.tagName === "INPUT" && TIPOS_TEXTO.includes(el.type)));
const FILAS_TECLADO = [
  ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "borrar"],
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p", "acento"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l", "ñ", "enter"],
  ["mayus", "z", "x", "c", "v", "b", "n", "m", ",", ".", "-"],
  ["@", ".com", "espacio", "/", "ocultar"],
];
const ACENTOS = { a: "á", e: "é", i: "í", o: "ó", u: "ú", A: "Á", E: "É", I: "Í", O: "Ó", U: "Ú" };
// el: el campo; id: para encontrarlo si la pantalla se redibuja; valor: el que tenía al abrir (para avisar «change»)
let teclado = { el: null, id: "", valor: "", mayus: false, acento: false, abierto: false };
const tecladoCaja = () => document.getElementById("teclado-pantalla");
function campoActual() {
  if (teclado.el && teclado.el.isConnected) return teclado.el;
  const otro = teclado.id && document.getElementById(teclado.id);
  return campoDeTexto(otro) ? otro : null;
}
function tecladoAbrir(el) {
  if (teclado.el && teclado.el !== el) avisarCambio();
  if (teclado.el !== el) teclado = { ...teclado, el, id: el.id || "", valor: el.value, acento: false };
  el.setAttribute("inputmode", "none"); // que no salga además el teclado de Windows o del celular
  if (typeof cajaPadCerrar === "function" && typeof pad !== "undefined" && pad.id) cajaPadCerrar();
  if (!teclado.abierto) {
    teclado.abierto = true;
    tecladoPintar();
  }
  setTimeout(() => el.scrollIntoView && el.scrollIntoView({ block: "center", behavior: "smooth" }), 60);
}
function tecladoOcultar() {
  avisarCambio();
  teclado = { el: null, id: "", valor: "", mayus: false, acento: false, abierto: false };
  const c = tecladoCaja();
  if (c) c.remove();
  document.body.style.paddingBottom = "";
}
// Lo escrito con este teclado no dispara «change» al salir del campo (el navegador solo lo hace con lo tecleado)
function avisarCambio() {
  const el = campoActual();
  if (el && el.value !== teclado.valor) {
    teclado.valor = el.value;
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }
}
function etiquetaTecla(k) {
  const t = {
    borrar: "⌫",
    acento: "´",
    enter: "↵",
    mayus: "⇧",
    espacio: "espacio",
    ocultar: "⌨️ Ocultar",
  }[k];
  if (t) return t;
  return teclado.mayus && k.length === 1 ? k.toUpperCase() : k;
}
function tecladoPintar() {
  let c = tecladoCaja();
  if (!c) {
    c = document.createElement("div");
    c.id = "teclado-pantalla";
    c.className = "teclado-pantalla";
    // Que tocar una tecla no le quite el foco al campo
    c.addEventListener("mousedown", (e) => e.preventDefault());
    c.addEventListener("click", (e) => {
      const b = e.target.closest("[data-k]");
      if (b) tecladoTecla(b.dataset.k);
    });
    document.body.appendChild(c);
  }
  c.innerHTML = FILAS_TECLADO.map(
    (fila) =>
      `<div class="tp-fila">${fila
        .map(
          (k) =>
            `<button type="button" class="tp-tecla tp-${k.length > 1 && !k.startsWith(".") ? k : "letra"}${(k === "mayus" && teclado.mayus) || (k === "acento" && teclado.acento) ? " tp-activa" : ""}" data-k="${k}">${etiquetaTecla(k)}</button>`
        )
        .join("")}</div>`
  ).join("");
  document.body.style.paddingBottom = (c.offsetHeight || 300) + "px";
}
function tecladoTecla(k) {
  const el = campoActual();
  if (!el) return tecladoOcultar();
  if (document.activeElement !== el) el.focus();
  if (k === "ocultar") return tecladoOcultar();
  if (k === "mayus" || k === "acento") {
    teclado[k] = !teclado[k];
    return tecladoPintar();
  }
  if (k === "borrar") return borrarAtras(el);
  if (k === "enter") {
    if (el.tagName === "TEXTAREA") return escribir(el, "\n");
    avisarCambio();
    const ev = new KeyboardEvent("keydown", {
      key: "Enter",
      code: "Enter",
      keyCode: 13,
      bubbles: true,
      cancelable: true,
    });
    el.dispatchEvent(ev);
    if (!ev.defaultPrevented && document.activeElement === el) tecladoOcultar();
    return;
  }
  let txt = k === "espacio" ? " " : k;
  if (teclado.mayus && txt.length === 1) txt = txt.toUpperCase();
  if (teclado.acento && ACENTOS[txt]) txt = ACENTOS[txt];
  const repintar = teclado.mayus || teclado.acento;
  teclado.mayus = false;
  teclado.acento = false;
  escribir(el, txt);
  if (repintar) tecladoPintar();
}
// Inserta donde está el cursor (los campos de correo y número no dicen dónde está: se agrega al final)
function posicion(el) {
  try {
    if (el.selectionStart !== null && el.selectionStart !== undefined) return [el.selectionStart, el.selectionEnd];
  } catch (e) {}
  return null;
}
function escribir(el, txt) {
  const v = el.value,
    p = posicion(el);
  const max = el.maxLength > 0 ? el.maxLength : Infinity;
  if (v.length + txt.length > max && !(p && p[1] > p[0])) return;
  if (!p) el.value = v + txt;
  else {
    el.value = v.slice(0, p[0]) + txt + v.slice(p[1]);
    try {
      el.setSelectionRange(p[0] + txt.length, p[0] + txt.length);
    } catch (e) {}
  }
  el.dispatchEvent(new Event("input", { bubbles: true }));
}
function borrarAtras(el) {
  const v = el.value,
    p = posicion(el);
  if (!v) return;
  if (!p) el.value = v.slice(0, -1);
  else if (p[1] > p[0]) {
    el.value = v.slice(0, p[0]) + v.slice(p[1]);
    try {
      el.setSelectionRange(p[0], p[0]);
    } catch (e) {}
  } else if (p[0] > 0) {
    el.value = v.slice(0, p[0] - 1) + v.slice(p[0]);
    try {
      el.setSelectionRange(p[0] - 1, p[0] - 1);
    } catch (e) {}
  } else return;
  el.dispatchEvent(new Event("input", { bubbles: true }));
}
document.addEventListener("focusin", (e) => {
  if (!modoTactil) return;
  if (campoDeTexto(e.target)) tecladoAbrir(e.target);
  else if (teclado.abierto && !e.target.closest("#teclado-pantalla")) tecladoOcultar();
});
// Lo tecleado con un teclado físico ya avisó «change» al salir del campo: no se repite
document.addEventListener(
  "change",
  (e) => {
    if (e.target === teclado.el) teclado.valor = e.target.value;
  },
  true
);
// Si se ocultó, al volver a tocar el mismo campo aparece otra vez
document.addEventListener("click", (e) => {
  if (modoTactil && !teclado.abierto && campoDeTexto(e.target)) tecladoAbrir(e.target);
});
document.addEventListener("focusout", () => {
  if (!modoTactil || !teclado.abierto) return;
  setTimeout(() => {
    if (!teclado.abierto || campoDeTexto(document.activeElement)) return;
    // Si la pantalla se redibujó, el campo es otro con el mismo id: se sigue escribiendo ahí
    const el = campoActual();
    if (el && el !== teclado.el) {
      teclado.el = el;
      el.focus();
      return;
    }
    tecladoOcultar();
  }, 0);
});

// ---- Desplazar arrastrando ----
// Con una pantalla táctil de verdad el navegador ya lo hace (pointerType «touch»): esto es para las que se comportan
// como un ratón. Arrastrar más de 10 px desplaza y no cuenta como toque (no se abre lo que estaba debajo).
let arrastre = null,
  _sinClick = 0,
  _impulso = 0;
function contenedorDesplazable(el, vertical) {
  for (let n = el; n && n !== document.body && n !== document.documentElement; n = n.parentElement) {
    const st = getComputedStyle(n);
    const ov = vertical ? st.overflowY : st.overflowX;
    if (
      /(auto|scroll)/.test(ov) &&
      (vertical ? n.scrollHeight > n.clientHeight + 1 : n.scrollWidth > n.clientWidth + 1)
    )
      return n;
  }
  return document.scrollingElement || document.documentElement;
}
function desplazar(cont, dx, dy) {
  cont.scrollLeft += dx;
  cont.scrollTop += dy;
}
document.addEventListener(
  "pointerdown",
  (e) => {
    cancelAnimationFrame(_impulso);
    if (!modoTactil || e.pointerType === "touch" || e.button !== 0) return;
    if (e.target.closest("input, textarea, select, [contenteditable], #teclado-pantalla, #caja-pad, canvas")) return;
    arrastre = { id: e.pointerId, x: e.clientX, y: e.clientY, t: e.timeStamp, v: 0, cont: null, moviendo: false };
  },
  true
);
document.addEventListener(
  "pointermove",
  (e) => {
    if (!arrastre || e.pointerId !== arrastre.id) return;
    const dx = e.clientX - arrastre.x,
      dy = e.clientY - arrastre.y;
    if (!arrastre.moviendo) {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      arrastre.moviendo = true;
      arrastre.vertical = Math.abs(dy) >= Math.abs(dx);
      arrastre.cont = contenedorDesplazable(e.target, arrastre.vertical);
    }
    const d = arrastre.vertical ? dy : dx,
      dt = Math.max(1, e.timeStamp - arrastre.t);
    if (arrastre.vertical) desplazar(arrastre.cont, 0, -dy);
    else desplazar(arrastre.cont, -dx, 0);
    arrastre.v = -d / dt; // px por ms, para el impulso al soltar
    arrastre.x = e.clientX;
    arrastre.y = e.clientY;
    arrastre.t = e.timeStamp;
    e.preventDefault();
  },
  true
);
function soltar(e) {
  if (!arrastre || e.pointerId !== arrastre.id) return;
  const a = arrastre;
  arrastre = null;
  if (!a.moviendo) return;
  _sinClick = Date.now();
  let v = Math.max(-4, Math.min(4, a.v)) * 16; // px por cuadro
  const paso = () => {
    if (Math.abs(v) < 0.5) return;
    if (a.vertical) desplazar(a.cont, 0, v);
    else desplazar(a.cont, v, 0);
    v *= 0.93;
    _impulso = requestAnimationFrame(paso);
  };
  if (e.timeStamp - a.t < 80) _impulso = requestAnimationFrame(paso);
}
document.addEventListener("pointerup", soltar, true);
document.addEventListener("pointercancel", soltar, true);
// El clic que llega al soltar después de arrastrar no cuenta
document.addEventListener(
  "click",
  (e) => {
    if (_sinClick && Date.now() - _sinClick < 400) {
      _sinClick = 0;
      e.stopPropagation();
      e.preventDefault();
    }
  },
  true
);
