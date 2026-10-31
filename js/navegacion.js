// Navegación adaptable (interfaz.js la dibuja): en la PC y la laptop, el menú fijo a la izquierda; en la tablet
// acostada, el mismo menú angosto (íconos con su nombre debajo); en el teléfono y la tablet parada, el menú se abre
// con ☰ y abajo queda una barra con lo que más se usa (Inicio, Caja, Pagos y Cobranza). Los tamaños están en
// css/navegacion.css. En el iPhone se respeta la ceja y la rayita de abajo, y el menú no se abre deslizando desde
// el borde (ese gesto es «volver» en el iPhone); en Android sí.

// Pestañas por grupo: [clave, ícono, nombre]. Cada rol ve solo las suyas (PESTANAS_ROL en interfaz.js).
const MENU = [
  [
    "Cobros",
    [
      ["dashboard", "🏠", "Inicio"],
      ["caja", "💳", "Caja"],
      ["pagos", "💰", "Pagos"],
      ["cobranza", "🔔", "Cobranza"],
    ],
  ],
  [
    "Colegio",
    [
      ["estudiantes", "👨‍🎓", "Estudiantes"],
      ["notas", "📝", "Notas"],
      ["importar", "📥", "Importar"],
    ],
  ],
  [
    "Administración",
    [
      ["finanzas", "📒", "Finanzas"],
      ["nomina", "👷", "Nómina"],
      ["reportes", "📊", "Reportes"],
      ["graficas", "📈", "Gráficas"],
    ],
  ],
  ["", [["config", "⚙️", "Configuración"]]],
];
const BARRA_INFERIOR = ["dashboard", "caja", "pagos", "cobranza"];
const menuDeRol = () =>
  MENU.flatMap(([grupo, tabs]) => tabs.map(([k, ico, nombre]) => ({ k, ico, nombre, grupo }))).filter((t) =>
    pestanaPermitida(t.k)
  );

// Equipo: iPhone/iPad (también el iPad que se presenta como Mac), Android o computadora
const ES_IOS =
  typeof navigator !== "undefined" &&
  (/iPad|iPhone|iPod/.test(navigator.userAgent || "") ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
const ES_ANDROID = typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent || "");
if (typeof document !== "undefined" && document.documentElement)
  document.documentElement.classList.add(ES_IOS ? "ios" : ES_ANDROID ? "android" : "escritorio");
const enApp = () =>
  (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;
// «📲 Instalar»: en Android/Chrome lo ofrece el navegador; en el iPhone se explica cómo (no hay botón del sistema)
function botonInstalar() {
  if (eventoInstalar)
    return `<button class="logout-btn hb-instalar" onclick="instalarApp()" title="Instalar la plataforma en este equipo">📲 <span class="hb-txt">Instalar</span></button>`;
  if (ES_IOS && !enApp())
    return `<button class="logout-btn hb-instalar" onclick="guiaInstalarIOS()" title="Instalar en el iPhone">📲 <span class="hb-txt">Instalar</span></button>`;
  return "";
}
function guiaInstalarIOS() {
  alert(
    "Para tener la plataforma como una app en el iPhone o iPad:\n\n" +
      "1. Ábrela en Safari.\n" +
      "2. Toca el botón Compartir (el cuadrado con la flecha hacia arriba ⬆️).\n" +
      "3. Elige «Agregar a pantalla de inicio» y toca «Agregar».\n\n" +
      "Queda un ícono como el de cualquier app, y se abre a pantalla completa."
  );
}

// Selector del año escolar (arriba; en el teléfono del director, dentro del menú)
function selectorAnio(clase) {
  if (!escCfg || rolUsuario === "docente") return "";
  const anios = [escCfg.actual, ...escCfg.anteriores.slice().reverse()];
  return `<select class="${clase}" onchange="cambiarAnioVista(this.value)" title="Año escolar" aria-label="Año escolar">${anios
    .map(
      (a) =>
        `<option value="${a.id}" ${a.id === anioVista ? "selected" : ""}>${escHtml(a.nombre)}${a.id === escCfg.actual.id ? " (actual)" : ""}</option>`
    )
    .join("")}</select>`;
}
// La tasa en el teléfono: solo el número
function chipTasaCorta() {
  const t = tasaDe(todayStr());
  return t ? (t.exacta ? "💱 " : "⚠️ ") + fmtTasa(t.valor) : "⚠️ Tasa";
}

// ---- Menú lateral en el teléfono (se abre encima, con un velo detrás) ----
let menuAbierto = false;
const esMenuFlotante = () => !!window.matchMedia && window.matchMedia("(max-width: 899px)").matches;
// Con el menú cerrado y flotante, sus botones no se alcanzan con Tab (inert)
function sincronizarMenu() {
  const shell = document.getElementById("shell"),
    sb = document.getElementById("sidebar");
  if (!shell || !sb) return;
  shell.classList.toggle("menu-abierto", menuAbierto);
  sb.inert = esMenuFlotante() && !menuAbierto;
}
function abrirMenu() {
  if (!document.querySelector(".shell.con-menu")) return;
  menuAbierto = true;
  sincronizarMenu();
  const activa = document.querySelector("#sidebar .tab.active") || document.querySelector("#sidebar .tab");
  if (activa) {
    activa.scrollIntoView({ block: "nearest" });
    activa.focus({ preventScroll: true });
  }
}
function cerrarMenu() {
  if (!menuAbierto) return;
  menuAbierto = false;
  sincronizarMenu();
}
if (typeof window !== "undefined" && window.matchMedia) {
  const mq = window.matchMedia("(max-width: 899px)");
  const alCambiar = () => {
    if (!mq.matches) menuAbierto = false;
    sincronizarMenu();
  };
  if (mq.addEventListener) mq.addEventListener("change", alCambiar);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && menuAbierto) cerrarMenu();
  });
  // Deslizar el dedo:
  // · desde el borde izquierdo abre el menú (no en el iPhone, donde ese gesto es «volver»); hacia la izquierda lo cierra;
  // · de lado sobre la pantalla, pasa a la pestaña de al lado en la barra de abajo (Inicio ↔ Caja ↔ Pagos ↔ Cobranza).
  let toque = null;
  document.addEventListener(
    "touchstart",
    (e) => {
      const t = e.touches[0];
      toque = null;
      if (!t || e.touches.length > 1 || !esMenuFlotante() || !document.getElementById("shell")) return;
      const base = { x: t.clientX, y: t.clientY, t: e.timeStamp };
      if (menuAbierto) toque = { ...base, tipo: "cerrar" };
      else if (document.querySelector(".shell.con-menu") && !ES_IOS && t.clientX < 24)
        toque = { ...base, tipo: "abrir" };
      else if (puedeDeslizarPestana(e.target, t.clientX)) toque = { ...base, tipo: "pestana" };
    },
    { passive: true }
  );
  document.addEventListener(
    "touchend",
    (e) => {
      const t = e.changedTouches[0];
      if (!toque || !t) return;
      const dx = t.clientX - toque.x,
        dy = Math.abs(t.clientY - toque.y);
      if (toque.tipo === "abrir" && dx > 50 && dy < 60) abrirMenu();
      else if (toque.tipo === "cerrar" && menuAbierto && dx < -60 && dy < 60) cerrarMenu();
      else if (
        toque.tipo === "pestana" &&
        Math.abs(dx) > 70 &&
        dy < 45 &&
        Math.abs(dx) > 2 * dy &&
        e.timeStamp - toque.t < 700
      )
        pasarPestana(dx < 0 ? 1 : -1);
      toque = null;
    },
    { passive: true }
  );
}
// Pestañas de la barra de abajo de cada rol (el director: las 4 que más usa; los demás: todas las suyas)
function barraDeRol() {
  const m = menuDeRol();
  return m.length > 3 ? m.filter((t) => BARRA_INFERIOR.includes(t.k)) : m;
}
// Se puede deslizar de pestaña si el dedo está sobre la pantalla (no en el menú ni en las barras), no en un campo, ni en una tabla o lista que se
// desliza de lado, ni con una ventana abierta. En el iPhone tampoco desde los bordes (son gestos del sistema).
function puedeDeslizarPestana(el, x) {
  if (!auth || modalActual || !el || !el.closest || !el.closest(".shell")) return false;
  if (el.closest(".sidebar, .sb-velo, .header, .barra-inferior")) return false;
  if (ES_IOS && (x < 24 || x > window.innerWidth - 24)) return false;
  if (el.closest("input, textarea, select, canvas, [contenteditable], #caja-pad, #teclado-pantalla")) return false;
  for (let n = el; n && !n.classList.contains("shell"); n = n.parentElement)
    if (n.scrollWidth > n.clientWidth + 1 && /(auto|scroll)/.test(getComputedStyle(n).overflowX)) return false;
  return true;
}
function pasarPestana(dir) {
  const orden = barraDeRol().map((t) => t.k),
    i = orden.indexOf(tabActual),
    k = i < 0 ? null : orden[i + dir];
  if (!k) return;
  setTab(k);
  animar(
    document.getElementById("tab-content"),
    [
      { transform: `translateX(${dir * 48}px)`, opacity: 0 },
      { transform: "none", opacity: 1 },
    ],
    { duration: 280 }
  );
}

// ---- Tema claro u oscuro ----
// «Automático» sigue al teléfono o la computadora (oscuro de noche si así lo tiene); se cambia con 🌓 en la barra de
// arriba y queda guardado en este equipo. Los colores oscuros están en css/oscuro.css.
const TEMAS = { auto: ["🌓", "Automático"], oscuro: ["🌙", "Oscuro"], claro: ["☀️", "Claro"] };
let tema = "auto";
try {
  tema = TEMAS[localStorage.getItem("tema")] ? localStorage.getItem("tema") : "auto";
} catch (e) {}
const mqOscuro =
  typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
const temaOscuro = () => tema === "oscuro" || (tema === "auto" && !!mqOscuro && mqOscuro.matches);
function aplicarTema() {
  if (typeof document === "undefined" || !document.documentElement) return;
  document.documentElement.classList.toggle("tema-oscuro", temaOscuro());
  const meta = document.querySelector && document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", temaOscuro() ? "#0b1526" : "#003366");
}
aplicarTema();
if (mqOscuro && mqOscuro.addEventListener) mqOscuro.addEventListener("change", aplicarTema);
function botonTema() {
  const [ico, nombre] = TEMAS[tema];
  return `<button class="logout-btn hb-tema" id="btn-tema" onclick="cambiarTema()" title="Tema: ${nombre} (toca para cambiar)" aria-label="Tema: ${nombre}">${ico}</button>`;
}
function cambiarTema() {
  const orden = Object.keys(TEMAS);
  tema = orden[(orden.indexOf(tema) + 1) % orden.length];
  try {
    if (tema === "auto") localStorage.removeItem("tema");
    else localStorage.setItem("tema", tema);
  } catch (e) {}
  aplicarTema();
  const b = document.getElementById("btn-tema");
  if (b) b.outerHTML = botonTema();
  mostrarToast(TEMAS[tema][0] + " Tema " + TEMAS[tema][1].toLowerCase());
}

// ---- Insignias (numeritos) del menú ----
// Cobranza: estudiantes en mora (el cálculo se guarda mientras no cambien los pagos ni los estudiantes).
// Configuración: quienes esperan la autorización del día.
let _mora = { pagos: null, nPagos: -1, est: null, nEst: -1, dia: "", n: 0 };
function enMoraHoy() {
  if (rolUsuario !== "director" || soloLectura() || typeof listaCobranza !== "function") return 0;
  const c = _mora,
    dia = todayStr();
  if (
    c.pagos === pagos &&
    c.nPagos === pagos.length &&
    c.est === estudiantes &&
    c.nEst === estudiantes.length &&
    c.dia === dia
  )
    return c.n;
  let n = 0;
  try {
    n = listaCobranza().filter((r) => r.enMora).length;
  } catch (e) {}
  _mora = { pagos, nPagos: pagos.length, est: estudiantes, nEst: estudiantes.length, dia, n };
  return n;
}
function pintarInsignias() {
  const cuentas = {
    cobranza: enMoraHoy(),
    config:
      rolUsuario === "director" && typeof pendientesAutorizacion === "function" ? pendientesAutorizacion().length : 0,
  };
  // «Más» (barra de abajo) avisa si hay algo en las opciones que no están en la barra
  cuentas.mas = Object.entries(cuentas)
    .filter(([k]) => !BARRA_INFERIOR.includes(k))
    .reduce((s, [, n]) => s + n, 0);
  document.querySelectorAll("[data-insignia]").forEach((el) => {
    const n = cuentas[el.dataset.insignia] || 0;
    el.hidden = !n;
    el.textContent = n > 99 ? "99+" : n ? String(n) : "";
  });
}
