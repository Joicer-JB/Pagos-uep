// Navegación adaptable (interfaz.js la dibuja): en la PC y la laptop, el menú fijo a la izquierda; en la tablet
// acostada, el mismo menú angosto (íconos con su nombre debajo); en el teléfono y la tablet parada, el menú se abre
// con ☰ y abajo queda una barra con lo que más se usa (Inicio, Caja, Pagos y Cobranza). Los tamaños están en
// css/navegacion.css. En el iPhone se respeta la ceja y la rayita de abajo, y el menú no se abre deslizando desde
// el borde (ese gesto es «volver» en el iPhone); en Android sí.

// Íconos de línea (SVG, sin bibliotecas): heredan el color del texto. Se usan en el menú, la barra de abajo y la cabecera.
const ICONOS = {
  dashboard: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>',
  caja: '<rect x="3" y="6" width="18" height="12" rx="1.5"/><path d="M3 10h18M7 15h3"/>',
  pagos: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
  cobranza: '<path d="M6 16v-5a6 6 0 0112 0v5l1.5 2h-15z"/><path d="M10 21h4"/>',
  estudiantes:
    '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5"/><path d="M16 4.5a3.5 3.5 0 010 7M18 14.8c1.8.8 3 2.6 3.5 5.2"/>',
  notas: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
  importar: '<path d="M12 3v12M7 10l5 5 5-5"/><path d="M4 19h16"/>',
  finanzas: '<path d="M5 4h11a3 3 0 013 3v13H8a3 3 0 01-3-3z"/><path d="M5 17a3 3 0 013-3h11"/>',
  nomina: '<rect x="3" y="7" width="18" height="13" rx="1.5"/><path d="M9 7V4h6v3M3 12h18"/>',
  reportes: '<path d="M6 3h9l4 4v14H6z"/><path d="M9 13h7M9 17h5"/>',
  graficas: '<path d="M4 20V4M4 20h16"/><path d="M8 16l4-5 3 3 5-6"/>',
  config:
    '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9L7 7M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
  Cobros:
    '<circle cx="12" cy="12" r="9"/><path d="M15 9.5c-.5-1-1.6-1.5-3-1.5-1.7 0-3 .9-3 2.1 0 2.8 6 1.4 6 4.3 0 1.2-1.3 2.1-3 2.1-1.4 0-2.6-.6-3.1-1.6M12 6v2M12 16v2"/>',
  Colegio:
    '<path d="M3 6.5C5.5 5 8.5 5 12 7c3.5-2 6.5-2 9-.5V19c-2.5-1.5-5.5-1.5-9 .5-3.5-2-6.5-2-9-.5z"/><path d="M12 7v12.5"/>',
  Administración: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V4.5h6V7M3 12h18"/>',
  buscar: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  salir: '<path d="M10 4H5v16h5"/><path d="M14 8l4 4-4 4M18 12H9"/>',
  auto: '<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 010 16z" fill="currentColor"/>',
  oscuro: '<path d="M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z"/>',
  claro:
    '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  mas: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
  flecha: '<path d="M6 9l6 6 6-6"/>',
};
const icono = (k, tam = 18) =>
  ICONOS[k]
    ? `<svg class="ico" viewBox="0 0 24 24" width="${tam}" height="${tam}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONOS[k]}</svg>`
    : "";

// Pestañas por grupo: [clave, nombre]. El ícono sale de ICONOS[clave]. Cada rol ve solo las suyas (PESTANAS_ROL en interfaz.js).
const MENU = [
  [
    "Cobros",
    [
      ["dashboard", "Inicio"],
      ["caja", "Caja"],
      ["pagos", "Pagos"],
      ["cobranza", "Cobranza"],
    ],
  ],
  [
    "Colegio",
    [
      ["estudiantes", "Estudiantes"],
      ["notas", "Notas"],
      ["importar", "Importar"],
    ],
  ],
  [
    "Administración",
    [
      ["finanzas", "Finanzas"],
      ["nomina", "Nómina"],
      ["reportes", "Reportes"],
      ["graficas", "Gráficas"],
    ],
  ],
  ["", [["config", "Configuración"]]],
];
const BARRA_INFERIOR = ["dashboard", "caja", "pagos", "cobranza"];
const menuDeRol = () =>
  MENU.flatMap(([grupo, tabs]) => tabs.map(([k, nombre]) => ({ k, ico: icono(k), nombre, grupo }))).filter((t) =>
    pestanaPermitida(t.k)
  );

// Secciones del menú que se pueden recoger (Cobros, Colegio, Administración). Empiezan abiertas; las que se
// recogen quedan así en este equipo. La sección de la pantalla abierta siempre se muestra.
let gruposRecogidos = [];
try {
  gruposRecogidos = JSON.parse(localStorage.getItem("menuRecogido") || "[]");
} catch (e) {}
const grupoRecogido = (g, tabs) => gruposRecogidos.includes(g) && !tabs.some((t) => t.k === tabActual);
function alternarGrupo(g) {
  const i = gruposRecogidos.indexOf(g);
  if (i >= 0) gruposRecogidos.splice(i, 1);
  else gruposRecogidos.push(g);
  try {
    localStorage.setItem("menuRecogido", JSON.stringify(gruposRecogidos));
  } catch (e) {}
  const el = document.querySelector(`.sb-grupo[data-grupo="${g}"]`);
  if (!el) return;
  const recogido = gruposRecogidos.includes(g) && !el.querySelector(".tab.active");
  el.classList.toggle("recogido", recogido);
  const b = el.querySelector(".sb-grupo-titulo");
  if (b) b.setAttribute("aria-expanded", String(!recogido));
}

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
  return t ? fmtTasa(t.valor) : "Tasa";
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
// «Automático» sigue al teléfono o la computadora (oscuro de noche si así lo tiene); se cambia con el botón de tema en la barra de
// arriba y queda guardado en este equipo. Los colores oscuros están en css/oscuro.css.
const TEMAS = { auto: "Automático", oscuro: "Oscuro", claro: "Claro" };
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
  if (meta) meta.setAttribute("content", temaOscuro() ? "#121a26" : "#0f2a4d");
}
aplicarTema();
if (mqOscuro && mqOscuro.addEventListener) mqOscuro.addEventListener("change", aplicarTema);
function botonTema() {
  const nombre = TEMAS[tema];
  return `<button class="logout-btn hb-tema" id="btn-tema" onclick="cambiarTema()" title="Tema: ${nombre} (toca para cambiar)" aria-label="Tema: ${nombre}">${icono(tema)}</button>`;
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
  mostrarToast("Tema " + TEMAS[tema].toLowerCase());
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
