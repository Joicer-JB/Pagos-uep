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
  if (tabActual === "dashboard") contarCifras(tc);
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

// En Inicio, las cifras enteras (estudiantes, en mora, pagos del mes…) cuentan rápido desde 0. Es solo lo que se ve
// (un contador de CSS encima): el número escrito en la página es siempre el real.
function contarCifras(raiz) {
  if (sinMovimiento()) return;
  raiz.querySelectorAll(".stat-val").forEach((el) => {
    const t = el.textContent.trim();
    if (!/^[1-9]\d{0,4}$/.test(t)) return;
    el.style.setProperty("--fin", t);
    el.classList.add("contando");
    setTimeout(() => el.classList.remove("contando"), 1100);
  });
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

// ---- Pantalla de entrada: que se sienta viva desde el primer segundo ----
// · De fondo: manchas de colores del colegio que se deslizan (malla), una red de puntos luminosos que reacciona al
//   ratón, el escudo grande girando muy despacio y destellos dorados que suben.
// · La tarjeta es de vidrio: se inclina un poco hacia el ratón con un reflejo de luz (quieta mientras se escribe).
// · Arriba, el escudo como medalla 3D (dos caras y canto dorado, nunca se ve al revés): baja con un rebote, flota,
//   cada tanto da una vuelta y le pasa un brillo. Debajo, el lema escribiéndose solo.
// · Todo aparece escalonado en menos de un segundo; una insignia dice si hay conexión (de verdad).
// Liviano: casi todo es transform y opacity (la tarjeta de video). La red de puntos se apaga sola en equipos lentos,
// en el modo pantalla táctil y si el equipo pide «reducir movimiento». Los estilos están en css/animaciones.css.
const LEMA = ["Excelente", " y mejorando cada día más"];
const imgEscudo = () => `<img src="data:image/png;base64,${LOGO}" alt="" draggable="false"/>`;
function fondoEntrada() {
  return `<div class="entrada-fondo" aria-hidden="true">
    <div class="ef-malla"><i></i><i></i><i></i><i></i></div>
    <div class="ef-halo"></div>
    <div class="ef-escudo">${imgEscudo()}</div>
    <canvas class="ef-red" id="ef-red"></canvas>
    ${Array.from(
      { length: 16 },
      (_, i) => `<span class="ef-chispa" style="--i:${i};--t:${4 + ((i * 7) % 5)}px;--d:${9 + ((i * 13) % 7)}s"></span>`
    ).join("")}
  </div>
  <div class="ef-estado" id="ef-estado" role="status">${htmlConexion()}</div>`;
}
const htmlConexion = () =>
  navigator.onLine
    ? `<span class="ef-ping" aria-hidden="true"></span>Conectado`
    : `<span class="ef-ping sin" aria-hidden="true"></span>Sin conexión · revisa el internet`;
["online", "offline"].forEach((ev) =>
  window.addEventListener(ev, () => {
    const el = document.getElementById("ef-estado");
    if (el) el.innerHTML = htmlConexion();
  })
);
function escudo3D() {
  const canto = [-3, -2, -1, 0, 1, 2, 3]
    .map((z) => `<div class="e3-capa" style="--z:${z}px">${imgEscudo()}</div>`)
    .join("");
  return `<div class="escudo3d" role="img" aria-label="Escudo del colegio">
    <div class="e3-inclinar"><div class="e3-giro">
      ${canto}
      <div class="e3-cara e3-frente">${imgEscudo()}<span class="e3-brillo" style="-webkit-mask-image:url(data:image/png;base64,${LOGO});mask-image:url(data:image/png;base64,${LOGO})"></span></div>
      <div class="e3-cara e3-atras">${imgEscudo()}</div>
    </div></div>
    <div class="e3-sombra"></div>
  </div>`;
}
// El lema (los lectores de pantalla leen la frase completa)
function lemaEntrada() {
  const frase = LEMA.join("");
  return `<div class="login-lema" aria-label="${frase}"><span id="lema-txt" aria-hidden="true">${sinMovimiento() ? frase : ""}</span><span class="lema-cursor" aria-hidden="true"></span></div>`;
}
// Máquina de escribir: «Excelente» (pausa) « y mejorando cada día más» (pausa), se borra y vuelve a empezar
let _lema = 0;
function escribirLema() {
  clearTimeout(_lema);
  if (sinMovimiento()) return;
  const frase = LEMA.join(""),
    corte = LEMA[0].length;
  let n = 0,
    dir = 1;
  const paso = () => {
    const el = document.getElementById("lema-txt");
    if (!el) return;
    n += dir;
    el.textContent = frase.slice(0, n);
    let espera = dir > 0 ? 65 : 24;
    if (dir > 0 && n === corte) espera = 750;
    if (dir > 0 && n === frase.length) {
      dir = -1;
      espera = 3200;
    } else if (dir < 0 && n === 0) {
      dir = 1;
      espera = 700;
    }
    _lema = setTimeout(paso, espera);
  };
  _lema = setTimeout(paso, 1000);
}
// Red de puntos luminosos (canvas): se mueven solos, se unen con líneas finas cuando están cerca y se apartan del
// ratón, que también se une a los cercanos. Se detiene si la pantalla de entrada ya no está o la pestaña no se ve.
let _red = null;
function iniciarRed() {
  const cv = document.getElementById("ef-red");
  if (!cv) return;
  const lento = (navigator.hardwareConcurrency || 4) <= 2 || (navigator.deviceMemory && navigator.deviceMemory <= 2);
  if (sinMovimiento() || lento || (typeof modoTactil !== "undefined" && modoTactil) || !cv.getContext)
    return cv.remove();
  if (_red && _red.cv === cv) return;
  if (_red) cancelAnimationFrame(_red.raf);
  const ctx = cv.getContext("2d");
  if (!ctx) return cv.remove();
  const r = { cv, ctx, pts: [], raf: 0, raton: null, cuadros: 0, lentos: 0, ultimo: 0 };
  r.medir = () => {
    const dpr = Math.min(1.5, window.devicePixelRatio || 1);
    r.w = cv.clientWidth;
    r.h = cv.clientHeight;
    cv.width = Math.round(r.w * dpr);
    cv.height = Math.round(r.h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.round(Math.min(64, Math.max(18, (r.w * r.h) / 24000)));
    while (r.pts.length < n)
      r.pts.push({
        x: Math.random() * r.w,
        y: Math.random() * r.h,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
      });
    r.pts.length = n;
  };
  r.medir();
  const CERCA = 130,
    RATON = 170;
  const cuadro = (t) => {
    if (!cv.isConnected) return (_red = null);
    r.raf = requestAnimationFrame(cuadro);
    if (document.hidden) return (r.ultimo = 0);
    // Equipo lento: si más de la mitad de los cuadros tardan, se apaga (con un fundido)
    if (r.ultimo) {
      r.cuadros++;
      if (t - r.ultimo > 34) r.lentos++;
      if (r.cuadros >= 90 && r.lentos / r.cuadros > 0.5) {
        cancelAnimationFrame(r.raf);
        cv.classList.add("apagada");
        return (_red = null);
      }
    }
    r.ultimo = t;
    const { pts, raton } = r;
    ctx.clearRect(0, 0, r.w, r.h);
    for (const p of pts) {
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0 || p.x > r.w) p.vx *= -1;
      if (p.y < 0 || p.y > r.h) p.vy *= -1;
      if (raton) {
        const dx = p.x - raton.x,
          dy = p.y - raton.y,
          d2 = dx * dx + dy * dy;
        if (d2 < 90 * 90 && d2 > 1) {
          const f = (1 - Math.sqrt(d2) / 90) * 1.2;
          p.x += (dx / Math.sqrt(d2)) * f;
          p.y += (dy / Math.sqrt(d2)) * f;
        }
      }
    }
    ctx.lineWidth = 0.7;
    for (let i = 0; i < pts.length; i++)
      for (let j = i + 1; j < pts.length; j++) {
        const dx = pts[i].x - pts[j].x,
          dy = pts[i].y - pts[j].y,
          d2 = dx * dx + dy * dy;
        if (d2 < CERCA * CERCA) {
          ctx.strokeStyle = `rgba(173, 205, 255, ${((1 - Math.sqrt(d2) / CERCA) * 0.32).toFixed(3)})`;
          ctx.beginPath();
          ctx.moveTo(pts[i].x, pts[i].y);
          ctx.lineTo(pts[j].x, pts[j].y);
          ctx.stroke();
        }
      }
    if (raton)
      for (const p of pts) {
        const d = Math.hypot(p.x - raton.x, p.y - raton.y);
        if (d < RATON) {
          ctx.strokeStyle = `rgba(255, 215, 0, ${((1 - d / RATON) * 0.55).toFixed(3)})`;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(raton.x, raton.y);
          ctx.stroke();
        }
      }
    ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
    for (const p of pts) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 1.7, 0, Math.PI * 2);
      ctx.fill();
    }
  };
  r.raf = requestAnimationFrame(cuadro);
  _red = r;
}
window.addEventListener("resize", () => _red && _red.medir());
// Se llama cada vez que se dibuja la pantalla de entrada (o la de esperar la autorización)
function iniciarEntradaViva() {
  iniciarRed();
  escribirLema();
}

// Con el ratón: el escudo, el fondo y la tarjeta se inclinan un poco hacia él, y un reflejo de luz sigue al cursor
// sobre la tarjeta. Mientras se escribe en un campo, la tarjeta queda quieta. (No en pantallas táctiles.)
let _inclinar = 0;
const escribiendoEnTarjeta = () => !!(document.activeElement && document.activeElement.closest(".login-card input"));
function enderezarTarjeta(wrap) {
  wrap.style.setProperty("--card-x", "0deg");
  wrap.style.setProperty("--card-y", "0deg");
}
document.addEventListener(
  "pointermove",
  (e) => {
    if (e.pointerType !== "mouse" || _inclinar || sinMovimiento()) return;
    _inclinar = requestAnimationFrame(() => {
      _inclinar = 0;
      const wrap = document.querySelector(".login-wrap");
      if (!wrap) return;
      const x = e.clientX / window.innerWidth - 0.5,
        y = e.clientY / window.innerHeight - 0.5;
      wrap.style.setProperty("--incl-x", (x * 28).toFixed(1) + "deg");
      wrap.style.setProperty("--incl-y", (-y * 22).toFixed(1) + "deg");
      wrap.style.setProperty("--mover-x", (x * -18).toFixed(1) + "px");
      wrap.style.setProperty("--mover-y", (y * -18).toFixed(1) + "px");
      if (_red) {
        const b = _red.cv.getBoundingClientRect();
        _red.raton = { x: e.clientX - b.left, y: e.clientY - b.top };
      }
      const card = wrap.querySelector(".login-card");
      if (!card) return;
      const b = card.getBoundingClientRect();
      const cx = Math.max(-1, Math.min(1, (e.clientX - (b.left + b.width / 2)) / (b.width / 2 + 200))),
        cy = Math.max(-1, Math.min(1, (e.clientY - (b.top + b.height / 2)) / (b.height / 2 + 200)));
      wrap.style.setProperty("--luz-x", (((e.clientX - b.left) / b.width) * 100).toFixed(1) + "%");
      wrap.style.setProperty("--luz-y", (((e.clientY - b.top) / b.height) * 100).toFixed(1) + "%");
      if (escribiendoEnTarjeta()) return enderezarTarjeta(wrap);
      wrap.style.setProperty("--card-x", (cx * 6).toFixed(2) + "deg");
      wrap.style.setProperty("--card-y", (-cy * 5).toFixed(2) + "deg");
    });
  },
  { passive: true }
);
document.addEventListener("pointerleave", () => _red && (_red.raton = null));
document.addEventListener("focusin", (e) => {
  const wrap = e.target.closest && e.target.closest(".login-wrap");
  if (wrap && e.target.closest(".login-card input")) enderezarTarjeta(wrap);
});
