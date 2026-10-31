// Estructura de la pantalla: cabecera, pestañas, enrutador de modales, búsqueda en vivo y avisos (toast).

// Dibuja toda la pantalla: el login si no hay sesión, o cabecera + pestañas + contenido + modal abierto
function render() {
  const app = document.getElementById("app");
  if (!auth) {
    app.innerHTML = _espera ? renderEsperaAutorizacion() : renderLogin();
    return;
  }
  const menu = menuDeRol(),
    actual = menu.find((t) => t.k === tabActual) || menu[0],
    conMenu = menu.length > 3, // el director: menú lateral (en el teléfono, con ☰); los demás no lo necesitan
    rapidos = conMenu ? menu.filter((t) => BARRA_INFERIOR.includes(t.k)) : menu;
  const boton = (t, clase) =>
    `<button class="${clase} ${tabActual === t.k ? "active" : ""}" onclick="setTab('${t.k}')" title="${t.nombre}"${tabActual === t.k ? ' aria-current="page"' : ""}><span class="tab-ico" aria-hidden="true">${t.ico}<span class="insignia" data-insignia="${t.k}" hidden></span></span><span class="tab-txt">${t.nombre}</span></button>`;
  const grupos = [...new Set(menu.map((t) => t.grupo))];
  app.innerHTML = `
  <div class="shell ${conMenu ? "con-menu" : "sin-menu"}${rapidos.length > 1 ? " con-barra" : ""}" id="shell">
  <aside class="sidebar" id="sidebar" aria-label="Menú principal">
    <div class="sb-marca">
      <img src="data:image/png;base64,${LOGO}" class="sb-logo" alt="Logo"/>
      <div class="sb-marca-txt"><strong>${EMPRESA}</strong><small>Sistema de Gestión</small></div>
      <button class="sb-cerrar" onclick="cerrarMenu()" aria-label="Cerrar menú">✕</button>
    </div>
    <nav class="tabs sb-nav">
      ${grupos
        .map(
          (g) =>
            `<div class="sb-grupo">${conMenu && g ? `<div class="sb-grupo-titulo">${g}</div>` : ""}${menu
              .filter((t) => t.grupo === g)
              .map((t) => boton(t, "tab"))
              .join("")}</div>`
        )
        .join("")}
    </nav>
    <div class="sb-pie">
      ${conMenu ? selectorAnio("hb-anio sb-anio") : ""}
      <div class="sb-usuario"><span class="sb-avatar" aria-hidden="true">${escHtml((correoUsuario() || "?")[0].toUpperCase())}</span><div class="sb-usuario-txt"><strong id="rol-lbl"></strong><small>${escHtml(correoUsuario() || "")}</small></div></div>
      <button class="sb-salir" onclick="logout()" title="Cerrar sesión (${escHtml(correoUsuario() || "")})"><span aria-hidden="true">⏻</span><span class="sb-salir-txt">Cerrar sesión</span></button>
    </div>
  </aside>
  <div class="sb-velo" onclick="cerrarMenu()"></div>
  <div class="principal">
  <div class="header">
    <div class="header-top">
      ${conMenu ? `<button class="hb-menu" onclick="abrirMenu()" aria-label="Abrir el menú" title="Menú">☰</button>` : ""}
      <img src="data:image/png;base64,${LOGO}" class="header-logo" alt="Logo"/>
      <div class="hb-titulo">
        <div class="header-label">${conMenu ? actual.grupo || "Sistema de Gestión" : "Sistema de Gestión"}</div>
        <div class="header-name"><span aria-hidden="true">${actual.ico}</span> ${actual.nombre}</div>
      </div>
      <div class="hb-acciones">
      ${rolUsuario !== "docente" ? `<button class="logout-btn busq-btn" onclick="abrirBuscador()" title="Buscar o preguntar (Ctrl+K)">🔍 <span class="busq-btn-txt">Buscar</span></button><button class="logout-btn hb-tasa${tasaHoy() ? "" : " sin-tasa"}" onclick="abrirModal({tipo:'tasa'})" title="Tasa BCV del día"><span class="hb-tasa-larga">${chipTasaTxt()}</span><span class="hb-tasa-corta">${chipTasaCorta()}</span></button>` : ""}
      ${selectorAnio("hb-anio")}
      ${botonInstalar()}<button class="logout-btn hb-salir" onclick="logout()" title="Cerrar sesión">Salir</button>
      </div>
    </div>
  </div>
  ${soloLectura() ? `<div style="background:#fff8e1;border-bottom:2px solid #b8860b;color:#7a5c00;padding:0.55rem 1rem;font-size:0.8rem;text-align:center">📚 Estás viendo el año escolar <strong>${escHtml(anioVistaObj().nombre)}</strong> (solo consulta). <a href="#" onclick="cambiarAnioVista('${escCfg.actual.id}');return false" style="color:#003366;font-weight:700">Volver al año actual</a></div>` : ""}
${bannerTasa()}
<div class="content" id="tab-content">${renderTab()}</div>
  </div>
  ${
    rapidos.length > 1
      ? `<nav class="barra-inferior" aria-label="Accesos rápidos">${rapidos.map((t) => boton(t, "bi-tab")).join("")}${
          conMenu
            ? `<button class="bi-tab bi-mas${rapidos.some((t) => t.k === tabActual) ? "" : " active"}" onclick="abrirMenu()" aria-label="Más opciones"><span class="tab-ico" aria-hidden="true">☰<span class="insignia" data-insignia="mas" hidden></span></span><span class="tab-txt">Más</span></button>`
            : ""
        }</nav>`
      : ""
  }
  </div>
  ${modalActual ? renderModal() : ""}`;
  const rl = document.getElementById("rol-lbl");
  if (rl)
    rl.textContent =
      rolUsuario === "director" ? "👑 Director" : rolUsuario === "docente" ? "📝 Docente" : "✏️ Administradora";
  menuAbierto = false;
  sincronizarMenu();
  pintarInsignias();
  animarModalSiEsNuevo();
}
// Pestañas y ventanas de cada rol que no es el director: los docentes solo Notas; la administradora cobra (Inicio,
// Caja y Pagos) y no modifica nada más. Las reglas de Firestore lo exigen también (firestore.rules).
const PESTANAS_ROL = { docente: ["notas"], administradora: ["dashboard", "caja", "pagos"] };
const MODALES_ADMINISTRADORA = ["tasa", "recibo", "nuevo-pago", "buscar"];
const pestanaPermitida = (t) => !PESTANAS_ROL[rolUsuario] || PESTANAS_ROL[rolUsuario].includes(t);
// Cambia de pestaña (cada rol solo entra a las suyas) y limpia los filtros
function setTab(t) {
  if (!pestanaPermitida(t)) return;
  tabActual = t;
  pagoPrefill = null;
  filtros = { busq: "", fecha: "", metodo: "", estado: "", lapso: LAPSOS[0], anio: String(anioActual()) };
  modalActual = null;
  render();
  animarEntradaPestana();
}
// HTML de la pestaña actual
function renderTab() {
  if (!pestanaPermitida(tabActual)) tabActual = PESTANAS_ROL[rolUsuario][0];
  if (tabActual === "dashboard") return renderDashboard();
  if (tabActual === "caja") return renderCaja();
  if (tabActual === "pagos") return renderPagos();
  if (tabActual === "cobranza") return renderCobranza();
  if (tabActual === "estudiantes") return renderEstudiantes();
  if (tabActual === "finanzas") return renderFinanzas();
  if (tabActual === "nomina") return renderNomina();
  if (tabActual === "reportes") return renderReportes();
  if (tabActual === "graficas") return renderGraficas();
  if (tabActual === "notas") return renderNotas();
  if (tabActual === "importar") return renderImportar();
  if (tabActual === "config") return renderConfig();
  return "";
}
// Redibuja solo el contenido de la pestaña (más rápido que render())
function renderTabContent() {
  const tc = document.getElementById("tab-content");
  if (tc) tc.innerHTML = renderTab();
}
let _searchTimer = null;
// Búsqueda en vivo: espera 200 ms después de la última tecla antes de redibujar la lista
function onBusqInput(val) {
  filtros.busq = val;
  clearTimeout(_searchTimer);
  _searchTimer = setTimeout(() => {
    renderListOnly();
  }, 200);
}
// Redibuja la lista sin perder el foco ni la posición del cursor en el buscador
function renderListOnly() {
  const tc = document.getElementById("tab-content");
  if (tc) {
    tc.innerHTML = renderTab();
    // Devuelve el foco al buscador con el cursor al final
    const inp = document.getElementById("search-input");
    if (inp) {
      inp.focus();
      const len = inp.value.length;
      inp.setSelectionRange(len, len);
    }
  }
}
// HTML del modal abierto (según modalActual.tipo)
function renderModal() {
  const m = modalActual;
  if (!m) return "";
  if (m.tipo === "tasa") return renderModalTasa();
  if (m.tipo === "buscar") return renderModalBuscar();
  if (m.tipo === "recibo") return renderModalRecibo(m);
  if (m.tipo === "nuevo-pago") return renderModalNuevoPago();
  if (m.tipo === "nuevo-estudiante") return renderModalEstudiante({});
  if (m.tipo === "ver-estudiante") return renderModalVerEstudiante(m);
  if (m.tipo === "editar-estudiante") return renderModalEstudiante(estudiantes.find((e) => e.id === m.id) || {});
  if (m.tipo === "duplicados") return renderModalDuplicados();
  if (m.tipo === "nuevo-finanza") return renderModalFinanza(m);
  if (m.tipo === "ver-finanza") return renderModalVerFinanza(m);
  if (m.tipo === "nuevo-cuenta-pagar" || m.tipo === "editar-cuenta-pagar") return renderModalCuentaPagar(m);
  if (m.tipo === "ver-trabajador") return renderModalVerTrabajador(m);
  if (m.tipo === "constancia-trabajo") return renderModalConstanciaTrabajo(m);
  if (m.tipo === "pago-nomina") return renderModalPagoNomina(m);
  if (m.tipo === "adelanto-nomina") return renderModalAdelantoNomina(m);
  if (m.tipo === "prestamo-nomina") return renderModalPrestamoNomina(m);
  if (m.tipo === "nuevo-docente") return renderModalDocente(null);
  if (m.tipo === "editar-docente") return renderModalDocente(m.id);
  if (m.tipo === "plan-eval") return renderModalPlanEval(m);
  if (m.tipo === "sabana-estudiante") return renderModalSabanaEstudiante(m);
  if (m.tipo === "ajuste-consejo") return renderModalAjusteConsejo(m);
  return "";
}
// Abre un modal. En un año escolar anterior no deja abrir los de registrar o editar
function abrirModal(m) {
  if (soloLectura() && m && /^(nuevo|editar)/.test(m.tipo || "")) {
    alert("Estás viendo un año escolar anterior (solo consulta). Vuelve al año actual para registrar o editar.");
    return;
  }
  if (m && rolUsuario === "administradora" && !MODALES_ADMINISTRADORA.includes(m.tipo)) return;
  modalActual = m;
  render();
  if (m && /-nomina$/.test(m.tipo || "")) prepararModalNomina(m); // llena lo que corresponde al trabajador elegido
}
// Cierra el modal; en la Caja devuelve el foco al buscador
function cerrarModal() {
  modalActual = null;
  render();
  if (tabActual === "caja" && !caja.estId) {
    const q = document.getElementById("caja-q");
    if (q) q.focus();
  }
}
// Muestra un mensaje de error dentro de un contenedor (su id o el elemento). El texto se escapa.
function mostrarError(donde, texto) {
  const el = typeof donde === "string" ? document.getElementById(donde) : donde;
  if (el) el.innerHTML = texto ? `<div class="error-msg">${escHtml(texto)}</div>` : "";
}
// Aviso breve en la parte inferior de la pantalla (desaparece solo a los 3 segundos)
function mostrarToast(msg) {
  let t = document.getElementById("toast-msg");
  if (!t) {
    t = document.createElement("div");
    t.id = "toast-msg";
    t.style.cssText =
      "position:fixed;bottom:calc(var(--alto-barra, 0px) + 1.5rem);left:50%;transform:translateX(-50%);background:#003366;color:#fff;padding:0.65rem 1.2rem;border-radius:24px;font-size:0.85rem;font-weight:600;z-index:9999;box-shadow:0 4px 16px rgba(0,51,102,0.3);transition:opacity 0.3s";
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.opacity = "1";
  setTimeout(() => {
    t.style.opacity = "0";
  }, 2800);
}
