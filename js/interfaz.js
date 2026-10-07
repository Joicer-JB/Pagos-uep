// Estructura de la pantalla: cabecera, pestañas, enrutador de modales, búsqueda en vivo y avisos (toast).

// Dibuja toda la pantalla: el login si no hay sesión, o cabecera + pestañas + contenido + modal abierto
function render() {
  const app = document.getElementById("app");
  if (!auth) {
    app.innerHTML = renderLogin();
    return;
  }
  app.innerHTML = `
  <div class="header">
    <div class="header-inner">
    <div class="header-top">
      <img src="data:image/png;base64,${LOGO}" class="header-logo" alt="Logo"/>
      <div style="flex:1;min-width:0">
        <div class="header-label">Sistema de Gestión · <span style="color:#ffd700" id="rol-lbl"></span></div>
        <div class="header-name">${EMPRESA}</div>
      </div>
      ${rolUsuario !== "docente" ? `<button class="logout-btn" style="margin-left:auto;${tasaHoy() ? "" : "background:#c0392b;color:#fff"}" onclick="abrirModal({tipo:'tasa'})" title="Tasa BCV del día">${chipTasaTxt()}</button>` : ""}
      ${escCfg && rolUsuario !== "docente" ? `<select onchange="cambiarAnioVista(this.value)" style="margin-left:0.4rem;background:rgba(255,255,255,0.15);color:#fff;border:none;border-radius:8px;padding:0.28rem 0.4rem;font-size:0.7rem;max-width:130px">${[escCfg.actual, ...escCfg.anteriores.slice().reverse()].map((a) => `<option value="${a.id}" style="color:#000" ${a.id === anioVista ? "selected" : ""}>${escHtml(a.nombre)}${a.id === escCfg.actual.id ? " (actual)" : ""}</option>`).join("")}</select>` : ""}
<button class="logout-btn" style="${rolUsuario !== "docente" ? "margin-left:0.4rem" : ""}" onclick="logout()">Salir</button>
    </div>
    <div class="tabs">
      ${(rolUsuario === "docente"
        ? [["notas", "📝 Notas"]]
        : rolUsuario === "administradora"
          ? [
              ["dashboard", "🏠 Inicio"],
              ["caja", "💳 Caja"],
              ["pagos", "💰 Pagos"],
              ["cobranza", "🔔 Cobranza"],
              ["estudiantes", "👨‍🎓 Estudiantes"],
              ["finanzas", "📒 Finanzas"],
              ["nomina", "👷 Nómina"],
              ["reportes", "📊 Reportes"],
              ["graficas", "📈 Gráficas"],
              ["notas", "📝 Notas"],
            ]
          : [
              ["dashboard", "🏠 Inicio"],
              ["caja", "💳 Caja"],
              ["pagos", "💰 Pagos"],
              ["cobranza", "🔔 Cobranza"],
              ["estudiantes", "👨‍🎓 Estudiantes"],
              ["finanzas", "📒 Finanzas"],
              ["nomina", "👷 Nómina"],
              ["reportes", "📊 Reportes"],
              ["graficas", "📈 Gráficas"],
              ["notas", "📝 Notas"],
              ["importar", "📥 Importar"],
              ["config", "⚙️ Config"],
            ]
      )
        .map(
          ([k, l]) => `<button class="tab ${tabActual === k ? "active" : ""}" onclick="setTab('${k}')">${l}</button>`
        )
        .join("")}
    </div>
    </div>
  </div>
  ${soloLectura() ? `<div style="background:#fff8e1;border-bottom:2px solid #b8860b;color:#7a5c00;padding:0.55rem 1rem;font-size:0.8rem;text-align:center">📚 Estás viendo el año escolar <strong>${escHtml(anioVistaObj().nombre)}</strong> (solo consulta). <a href="#" onclick="cambiarAnioVista('${escCfg.actual.id}');return false" style="color:#003366;font-weight:700">Volver al año actual</a></div>` : ""}
${bannerTasa()}
<div class="content" id="tab-content">${renderTab()}</div>
  ${modalActual ? renderModal() : ""}`;
  const rl = document.getElementById("rol-lbl");
  if (rl)
    rl.textContent =
      rolUsuario === "director" ? "👑 Director" : rolUsuario === "docente" ? "📝 Docente" : "✏️ Administradora";
}
// Cambia de pestaña (los docentes solo pueden estar en Notas) y limpia los filtros
function setTab(t) {
  if (rolUsuario === "docente" && t !== "notas") return;
  tabActual = t;
  filtros = { busq: "", fecha: "", metodo: "", estado: "", lapso: LAPSOS[0], anio: String(anioActual()) };
  modalActual = null;
  render();
}
// HTML de la pestaña actual
function renderTab() {
  if (rolUsuario === "docente" && tabActual !== "notas") tabActual = "notas"; // los docentes solo ven Notas
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
  if (m.tipo === "recibo") return renderModalRecibo(m);
  if (m.tipo === "nuevo-pago") return renderModalNuevoPago();
  if (m.tipo === "nuevo-estudiante") return renderModalEstudiante({});
  if (m.tipo === "ver-estudiante") return renderModalVerEstudiante(m);
  if (m.tipo === "editar-estudiante") return renderModalEstudiante(estudiantes.find((e) => e.id === m.id) || {});
  if (m.tipo === "duplicados") return renderModalDuplicados();
  if (m.tipo === "nuevo-finanza") return renderModalFinanza(m);
  if (m.tipo === "ver-finanza") return renderModalVerFinanza(m);
  if (m.tipo === "ver-trabajador") return renderModalVerTrabajador(m);
  if (m.tipo === "pago-nomina") return renderModalPagoNomina();
  if (m.tipo === "nuevo-docente") return renderModalDocente(null);
  if (m.tipo === "editar-docente") return renderModalDocente(m.id);
  return "";
}
// Abre un modal. En un año escolar anterior no deja abrir los de registrar o editar
function abrirModal(m) {
  if (soloLectura() && m && /^(nuevo|editar)/.test(m.tipo || "")) {
    alert("Estás viendo un año escolar anterior (solo consulta). Vuelve al año actual para registrar o editar.");
    return;
  }
  modalActual = m;
  render();
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
      "position:fixed;bottom:1.5rem;left:50%;transform:translateX(-50%);background:#003366;color:#fff;padding:0.65rem 1.2rem;border-radius:24px;font-size:0.85rem;font-weight:600;z-index:9999;box-shadow:0 4px 16px rgba(0,51,102,0.3);transition:opacity 0.3s";
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.opacity = "1";
  setTimeout(() => {
    t.style.opacity = "0";
  }, 2800);
}
