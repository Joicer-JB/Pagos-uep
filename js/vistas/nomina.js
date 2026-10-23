// Pestaña Nómina: personal, nómina del mes (quincenas o mes completo), pagos, adelantos y préstamos, con sus recibos.
// Los montos van en $ de referencia; se paga en Bs. a la tasa BCV del día (o en $ efectivo). Los cálculos están en
// servicios/nomina-calculo.js.
// Aquí están la pantalla (lista, nómina del mes, clases, historial) y los borrados. Las demás partes, cada una en su
// archivo: nomina-recibos.js, nomina-trabajador.js (formulario, ficha y documentos), nomina-constancia.js,
// nomina-pagos.js (pago, adelanto y préstamo) y nomina-asistencia.js.

let nominaMes = todayStr().slice(0, 7); // mes que se ve en «Nómina del mes»
const trabajadoresActivos = () => trabajadores.filter((t) => t.activo !== false);
const nombreTipoMov = { pago: "Pago", adelanto: "Adelanto", prestamo: "Préstamo" };
const ETIQ_MONEDA_NOMINA = { VES: "Bolívares (transferencia, pago móvil o efectivo)", USD: "Dólares en efectivo" };
// N° de recibo: sale del registro, así es siempre el mismo al reimprimir
const numReciboNomina = (mov) => (mov && mov.id ? "NOM-" + String(mov.id).slice(-6).toUpperCase() : "BORRADOR");
const lineaMonto = (monto, tasa) =>
  fmt(monto) + (tasa > 0 ? ` <small style="color:#555;font-weight:400">· ${fmtBs(r2(monto * tasa))}</small>` : "");

// ---- Pantalla
function renderNomina() {
  const st = subTab.nomina;
  const activos = trabajadoresActivos();
  const totalNomina = r2(activos.reduce((s, t) => s + netoMensual(t), 0));
  const botones = `<div style="display:flex;gap:0.4rem;flex-wrap:wrap;margin-bottom:0.75rem">
    <button class="btn btn-primary" style="flex:1" onclick="abrirModal({tipo:'pago-nomina'})">💳 Pagar nómina</button>
    <button class="btn btn-gray" onclick="abrirModal({tipo:'adelanto-nomina'})">💸 Adelanto</button>
    <button class="btn btn-gray" onclick="abrirModal({tipo:'prestamo-nomina'})">🤝 Préstamo</button></div>
    <div style="margin:-0.35rem 0 0.7rem">${casillaDosPorHoja("nomina", "nomina-doble")}</div>`;
  return `
  <div class="stabs">
    ${[
      ["lista", "👷 Personal"],
      ["mes", "📅 Nómina del mes"],
      ["clases", "📚 Clases"],
      ["asistencia", "🗓️ Asistencia"],
      ["nuevo", "➕ Nuevo"],
      ["historial", "📋 Historial"],
    ]
      .map(
        ([k, l]) =>
          `<button class="stab ${st === k ? "active" : ""}" onclick="trabEditId=null;subTab.nomina='${k}';renderTabContent()">${l}</button>`
      )
      .join("")}
  </div>
  ${st === "nuevo" ? renderFormTrabajador(trabEditId ? trabajadores.find((x) => x.id === trabEditId) || {} : {}) : ""}
  ${
    st === "lista"
      ? `
  <div class="stats-grid">
    <div class="stat-card"><div class="stat-val">${activos.length}</div><div class="stat-label">Personal activo</div></div>
    <div class="stat-card gold"><div class="stat-val">${fmt(totalNomina)}</div><div class="stat-label">Nómina mensual (neta)</div></div>
  </div>
  ${botones}
  ${avisoCertificados(activos)}
  ${
    trabajadores.length === 0
      ? `<div class="empty"><div class="empty-icon">👷</div><p>Sin trabajadores</p></div>`
      : [...activos, ...trabajadores.filter((t) => t.activo === false)].map(filaTrabajador).join("")
  }`
      : ""
  }
  ${st === "mes" ? botones + renderNominaMes() : ""}
  ${st === "clases" ? renderClasesNomina() : ""}
  ${st === "asistencia" ? renderAsistenciaNomina() : ""}
  ${st === "historial" ? botones + renderHistorialNomina() : ""}`;
}
// Certificados de salud vencidos o por vencer (los que no tienen, se ven en cada fila)
function avisoCertificados(activos) {
  const lista = activos
    .map((t) => ({ t, c: estadoCertificado(t) }))
    .filter((x) => x.c.estado === "vencido" || x.c.estado === "por-vencer");
  if (!lista.length) return "";
  return `<div class="alert-item alert-mora aviso-certificados" style="margin-bottom:0.6rem"><div>🩺 <strong>Certificados de salud:</strong> ${lista
    .map(
      (x) =>
        escHtml(x.t.nombre) +
        (x.c.estado === "vencido"
          ? " (venció el " + fechaCorta(x.c.adjunto.vence) + ")"
          : " (vence el " + fechaCorta(x.c.adjunto.vence) + ")")
    )
    .join(" · ")}</div></div>`;
}
const BADGE_CERTIFICADO = {
  falta: `<span class="badge badge-gray">🩺 Sin certificado</span>`,
  "sin-fecha": `<span class="badge badge-gray">🩺 Certificado sin fecha</span>`,
  vencido: `<span class="badge badge-red">🩺 Certificado vencido</span>`,
  "por-vencer": `<span class="badge badge-gold">🩺 Certificado por vencer</span>`,
  vigente: `<span class="badge badge-green">🩺 Certificado al día</span>`,
};
// «Media general 40 h · $ 2,50»
const badgesHoras = (t) =>
  horasDe(t)
    .map(
      (h) =>
        `<span class="badge badge-blue">⏱️ ${escHtml(h.nivel)}: ${String(h.horas).replace(".", ",")} h/mes · ${fmt(h.tarifa)}/h</span>`
    )
    .join("");
// «📚 Matemáticas · 1er Año a 3er Año», «📚 3er Grado» (docente de aula)
function badgesClases(t) {
  const l = clasesDe(t);
  return (
    l
      .slice(0, 3)
      .map(
        (c) =>
          `<span class="badge badge-blue">📚 ${(c.materia || "").trim() ? escHtml(c.materia.trim()) + " · " : ""}${escHtml(textoGrados(c.grados))}</span>`
      )
      .join("") + (l.length > 3 ? `<span class="badge badge-gray">+${l.length - 3} clases</span>` : "")
  );
}
function filaTrabajador(t) {
  const deudaP = sumaDe(prestamosDe(t.id), "saldo"),
    adel = sumaDe(adelantosPendientes(t.id), "pendiente");
  const tipoPago = tipoPagoTrabajador(t);
  return `<div class="list-item fila-trabajador" style="border-left-color:${t.activo === false ? "#bbb" : "#00509e"};cursor:pointer;${t.activo === false ? "opacity:0.6" : ""}" onclick="abrirModal({tipo:'ver-trabajador',id:'${t.id}'})">
      <div class="item-row">
        <div><div class="item-name">${escHtml(t.nombre)}${t.activo === false ? " · retirado" : ""}</div><div class="item-sub">${escHtml(t.cargo) || "Sin cargo"} ${t.cedula ? "· CC " + escHtml(t.cedula) : ""}</div>
        <div style="display:flex;gap:0.35rem;margin-top:3px;flex-wrap:wrap">
          <span class="badge badge-gray">${ETIQ_TIPO_PAGO[tipoPago]}</span>
          ${tipoPago !== "horas" ? `<span class="badge badge-blue">Base: ${fmt(t.salario || 0)}</span>` : ""}
          ${badgesHoras(t)}
          ${badgesClases(t)}
          <span class="badge badge-gray">${t.frecuencia === "mensual" ? "📆 Mensual" : "🔁 Quincenal"}</span>
          ${t.bonoAlimentacion ? `<span class="badge badge-green">🍽️ ${fmt(t.bonoAlimentacion)}</span>` : ""}
          ${t.bonoProductividad ? `<span class="badge badge-gold">⭐ ${fmt(t.bonoProductividad)}</span>` : ""}
          ${t.descuento ? `<span class="badge badge-red">- ${fmt(t.descuento)}</span>` : ""}
          ${adel > 0 ? `<span class="badge badge-gold">💸 Adelanto por descontar ${fmt(adel)}</span>` : ""}
          ${deudaP > 0 ? `<span class="badge badge-red">🤝 Debe ${fmt(deudaP)}</span>` : ""}
          ${t.activo !== false ? BADGE_CERTIFICADO[estadoCertificado(t).estado] : ""}
        </div></div>
        <div class="item-right"><div class="item-amount" style="color:#1a9e5c">${fmt(netoMensual(t))}</div><div style="font-size:0.62rem;color:#888">al mes${tipoPago !== "fijo" ? " (aprox.)" : ""}</div><div class="item-hint">Ver →</div></div>
      </div>
    </div>`;
}
// Nómina del mes: cuánto gana cada uno, qué se le pagó (por quincena o mes), qué falta y qué debe
function renderNominaMes() {
  const r = resumenNominaMes(nominaMes);
  const chip = (fila, tipo) =>
    fila.periodos.includes(tipo) || (tipo !== "M" && fila.periodos.includes("M"))
      ? `<span class="badge badge-green">✓ ${tipo === "Q1" ? "1ra" : "2da"}</span>`
      : `<span class="badge badge-gray">${tipo === "Q1" ? "1ra" : "2da"} pendiente</span>`;
  return `
  <div class="card" style="padding:0.75rem">
    <div class="field" style="margin:0"><label class="field-label">Mes</label><input class="inp" type="month" id="nm-mes" value="${nominaMes}" onchange="nominaMes=this.value||todayStr().slice(0,7);renderTabContent()"/></div>
  </div>
  <div class="stats-grid">
    <div class="stat-card"><div class="stat-val">${fmt(r.devengado)}</div><div class="stat-label">Nómina del mes (salarios + bonos)</div></div>
    <div class="stat-card green"><div class="stat-val">${fmt(r.bruto)}</div><div class="stat-label">Ya pagado (antes de deducciones)</div></div>
    <div class="stat-card red"><div class="stat-val">${fmt(r.porPagar)}</div><div class="stat-label">Por pagar</div></div>
    <div class="stat-card blue"><div class="stat-val">${fmt(r.entregado)}</div><div class="stat-label">Dinero entregado en el mes</div></div>
  </div>
  ${
    r.adelantosPendientes > 0 || r.saldoPrestamos > 0
      ? `<div class="alert-item alert-info" style="margin-bottom:0.6rem"><div>${[
          r.adelantosPendientes > 0 ? `💸 Adelantos por descontar: <strong>${fmt(r.adelantosPendientes)}</strong>` : "",
          r.saldoPrestamos > 0 ? `🤝 Préstamos por cobrar: <strong>${fmt(r.saldoPrestamos)}</strong>` : "",
        ]
          .filter(Boolean)
          .join(" · ")}</div></div>`
      : ""
  }
  ${
    r.filas.length
      ? r.filas
          .map(
            (
              f
            ) => `<div class="list-item nomina-fila" style="border-left-color:${f.porPagar > 0.004 ? "#e53e3e" : "#1a9e5c"}">
      <div class="item-row">
        <div style="flex:1;min-width:0"><div class="item-name">${escHtml(f.t.nombre)}</div>
          <div class="item-sub">Gana ${fmt(f.devengado)} al mes · pagado ${fmt(f.bruto)}${f.adelantos ? " · adelantos " + fmt(f.adelantos) : ""}</div>
          <div style="display:flex;gap:0.3rem;flex-wrap:wrap;margin-top:3px">${f.t.frecuencia === "mensual" ? (f.periodos.includes("M") ? `<span class="badge badge-green">✓ Mes pagado</span>` : `<span class="badge badge-gray">Mes pendiente</span>`) : chip(f, "Q1") + chip(f, "Q2")}
            ${f.adelantosPendientes > 0 ? `<span class="badge badge-gold">💸 ${fmt(f.adelantosPendientes)} por descontar</span>` : ""}
            ${f.saldoPrestamos > 0 ? `<span class="badge badge-red">🤝 Debe ${fmt(f.saldoPrestamos)}</span>` : ""}</div></div>
        <div class="item-right">${f.porPagar > 0.004 ? `<div class="item-amount" style="color:#e53e3e">${fmt(f.porPagar)}</div><div style="font-size:0.62rem;color:#888">por pagar</div>` : `<div class="item-amount" style="color:#1a9e5c">✓</div>`}
          ${f.siguiente ? `<button class="btn btn-primary btn-sm" style="margin-top:4px;font-size:0.7rem" onclick="abrirModal({tipo:'pago-nomina',trabId:'${f.t.id}',periodo:'${f.siguiente}'})">💳 Pagar ${escHtml(partesPeriodo(f.siguiente).tipo === "M" ? "mes" : TIPOS_PERIODO[partesPeriodo(f.siguiente).tipo])}</button>` : ""}</div>
      </div></div>`
          )
          .join("")
      : `<div class="empty"><div class="empty-icon">👷</div><p>Sin personal activo</p></div>`
  }`;
}
// 📚 Clases: cada grado y año con sus docentes, materias y horario; choques de horario y lo que falta
function renderClasesNomina() {
  const porGrado = clasesPorGrado();
  const choques = choquesHorario();
  const sinDocente = ESCALERA.filter((g) => !porGrado.get(g).length);
  const norm = (m) =>
    sinAcento(String(m || ""))
      .toLowerCase()
      .trim();
  // En Media general: las materias del año (Configuración → Materias) que nadie da
  const faltan = (g) =>
    getNivel(g) === "media" && Array.isArray(configMaterias[g])
      ? configMaterias[g].filter((m) => !porGrado.get(g).some((x) => norm(x.c.materia) === norm(m)))
      : [];
  return `
  <div style="display:flex;gap:0.5rem;align-items:center;margin-bottom:0.6rem">
    <div style="flex:1;font-size:0.78rem;color:#555">Quién da clase en cada grado y año, y a qué hora. Se carga en la ficha de cada trabajador (✏️ → 📚 Clases que da).</div>
    <button class="btn btn-print btn-sm" onclick="imprimirClases()">🖨️ Imprimir</button>
  </div>
  ${choques.length ? `<div class="alert-item alert-mora choques-horario" style="margin-bottom:0.6rem"><div><strong>⚠️ Choques de horario:</strong><br/>${choques.map(escHtml).join("<br/>")}</div></div>` : ""}
  ${sinDocente.length ? `<div class="alert-item alert-info" style="margin-bottom:0.6rem"><div>Sin docente asignado: ${sinDocente.map(escHtml).join(", ")}</div></div>` : ""}
  ${GRUPOS_GRADOS.map(
    (grupo) => `<div class="card clases-nivel" style="padding:0.75rem">
      <div class="card-title" style="margin-bottom:0.4rem"><div class="card-bar"></div><h2>${grupo.nombre}</h2></div>
      ${grupo.grados
        .map((g) => {
          const l = porGrado.get(g),
            f = faltan(g);
          return `<div class="clases-grado" data-grado="${escHtml(g)}" style="border-bottom:1px solid #eef2f9;padding:0.45rem 0">
          <div style="font-weight:700;color:#003366;font-size:0.85rem">${escHtml(g)}</div>
          ${
            l.length
              ? l
                  .map(
                    ({
                      t,
                      c,
                    }) => `<div style="font-size:0.78rem;padding:2px 0;cursor:pointer" onclick="abrirModal({tipo:'ver-trabajador',id:'${t.id}'})">
              <strong>${escHtml(materiaDe(c))}</strong> · ${escHtml(t.nombre)}${textoHorario(c) ? `<div style="color:#666;font-size:0.72rem">🕐 ${escHtml(textoHorario(c))}</div>` : ""}</div>`
                  )
                  .join("")
              : `<div style="font-size:0.75rem;color:#aaa">Sin docente asignado</div>`
          }
          ${f.length ? `<div style="font-size:0.72rem;color:#b8860b">Sin profesor: ${f.map(escHtml).join(", ")}</div>` : ""}
        </div>`;
        })
        .join("")}
    </div>`
  ).join("")}`;
}
function imprimirClases() {
  const porGrado = clasesPorGrado();
  const w = abrirVentanaImpresion("width=800,height=900");
  if (!w) return alert("Permite las ventanas emergentes para imprimir");
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>Clases por grado y año</title>
  <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Segoe UI',Arial,sans-serif;color:#222;background:#fff;max-width:800px;margin:0 auto;padding:1rem 1.2rem}
  .hdr{display:flex;align-items:center;gap:0.9rem;padding-bottom:0.6rem;border-bottom:2px solid #003366;margin-bottom:0.6rem}.hdr img{width:46px;height:46px;object-fit:contain}
  h2{font-size:0.75rem;text-transform:uppercase;letter-spacing:1px;color:#003366;margin:0.8rem 0 0.3rem}
  table{width:100%;border-collapse:collapse;font-size:0.78rem}th,td{text-align:left;padding:0.28rem 0.4rem;border-bottom:1px solid #ddd;vertical-align:top}
  th{font-size:0.65rem;text-transform:uppercase;color:#555;border-bottom:1.5px solid #003366}td.g{font-weight:700;color:#003366;white-space:nowrap}
  tr{break-inside:avoid}@media print{.no-print{display:none}}</style></head><body>
  <div class="hdr"><img src="data:image/png;base64,${LOGO}" alt="Logo"/><div>
    <div style="font-size:0.58rem;letter-spacing:2px;color:#003366;font-weight:700;text-transform:uppercase">Clases por grado y año</div>
    <div style="font-size:0.95rem;font-family:Georgia,serif;color:#003366">${EMPRESA}</div><div style="font-size:0.65rem;color:#555">${EMPRESA_SUB} · ${escHtml(fechaCorta(todayStr()))}</div></div></div>
  ${GRUPOS_GRADOS.map(
    (
      grupo
    ) => `<h2>${grupo.nombre}</h2><table><tr><th>Grado / año</th><th>Materia</th><th>Docente</th><th>Días y horario</th></tr>
    ${grupo.grados
      .map((g) => {
        const l = porGrado.get(g);
        return l.length
          ? l
              .map(
                ({ t, c }, k) =>
                  `<tr>${k === 0 ? `<td class="g" rowspan="${l.length}">${escHtml(g)}</td>` : ""}<td>${escHtml(materiaDe(c))}</td><td>${escHtml(t.nombre)}</td><td>${escHtml(textoHorario(c))}</td></tr>`
              )
              .join("")
          : `<tr><td class="g">${escHtml(g)}</td><td colspan="3" style="color:#999">Sin docente asignado</td></tr>`;
      })
      .join("")}</table>`
  ).join("")}
  <div class="no-print" style="text-align:center;padding:0.75rem"><button onclick="window.print()" style="background:#003366;color:#fff;border:none;padding:0.65rem 1.5rem;border-radius:8px;font-weight:700">🖨️ Imprimir / Guardar PDF</button></div>
  </body></html>`);
  w.document.close();
}
const movimientosTodos = () =>
  finanzas
    .filter(
      (f) => f.tipo === "gasto" && (f.categoria === "Nómina" || (f.categoria === CATEGORIA_PRESTAMOS && f.trabajadorId))
    )
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
function renderHistorialNomina() {
  const historial = movimientosTodos();
  const color = { pago: "#00509e", adelanto: "#b8860b", prestamo: "#c0392b" };
  return historial.length === 0
    ? `<div class="empty"><div class="empty-icon">📋</div><p>Sin historial de pagos</p></div>`
    : `<div class="list">${historial
        .map((h) => {
          const tipo = tipoMovNomina(h),
            b = bsDe(h, h.monto);
          return `<div class="list-item nomina-mov" style="border-left-color:${color[tipo]}">
      <div class="item-row">
        <div style="flex:1;min-width:0"><div class="item-name"><span class="badge ${tipo === "pago" ? "badge-blue" : tipo === "adelanto" ? "badge-gold" : "badge-red"}">${nombreTipoMov[tipo]}</span> ${escHtml(h.responsable || "")}</div>
          <div class="item-sub">${escHtml(fechaCorta(h.fecha))} · ${escHtml(tipo === "prestamo" ? h.descripcion || "" : nombrePeriodo(tipo === "pago" ? periodoDePago(h) : (h.nomina || {}).periodo) || h.descripcion || "")}</div>
          ${
            deduccionesDe(h).length
              ? `<div class="item-sub">➖ ${deduccionesDe(h)
                  .map((d) => escHtml(d.concepto) + ": " + fmt(d.monto))
                  .join(" · ")}</div>`
              : ""
          }</div>
        <div class="item-right">
          <div class="item-amount" style="color:#e53e3e">${fmt(h.monto)}</div>${b.bs != null ? `<div style="font-size:0.68rem;color:#888">${fmtBs(b.bs)}</div>` : ""}
          <button class="btn btn-print btn-sm" style="margin-top:4px;font-size:0.68rem;padding:0.25rem 0.5rem" onclick="event.stopPropagation();imprimirReciboNomina(null,'${h.id}')">🖨️ Recibo</button>
          ${rolUsuario === "director" ? `<button class="btn btn-danger btn-sm" style="margin-top:4px;font-size:0.68rem;padding:0.25rem 0.5rem" onclick="event.stopPropagation();eliminarPagoNomina('${h.id}')">🗑️ Eliminar</button>` : ""}
        </div>
      </div>
    </div>`;
        })
        .join("")}</div>`;
}
// ---- Borrar
async function eliminarTrabajador(id) {
  const t = trabajadores.find((x) => x.id === id);
  if (t && movimientosNomina(id).length) {
    alert(
      "Este trabajador tiene pagos registrados. Para conservar su historial, edítalo y marca «Ya no trabaja aquí»."
    );
    return;
  }
  if (!confirm("¿Eliminar este trabajador?")) return;
  try {
    await db.collection("trabajadores").doc(id).delete();
    trabajadores = trabajadores.filter((t) => t.id !== id);
    cerrarModal();
  } catch (e) {
    alert("Error: " + e.message);
  }
}
async function eliminarPagoNomina(id) {
  if (rolUsuario !== "director") {
    alert("Sin permiso");
    return;
  }
  const mov = finanzas.find((f) => f.id === id);
  if (!mov) return;
  const tipo = tipoMovNomina(mov);
  const movs = mov.trabajadorId ? movimientosNomina(mov.trabajadorId) : [];
  const usado = (tipo === "adelanto" || tipo === "prestamo") && descontadoDe(movs, id) > 0;
  const extra =
    tipo === "pago" && deduccionesDe(mov).some((d) => d.ref)
      ? "\n\nLos adelantos y cuotas de préstamo que descontaba vuelven a quedar pendientes."
      : usado
        ? "\n\n⚠️ Ya se descontó en algún pago: el descuento quedará en ese pago."
        : "";
  if (!confirm("¿Eliminar este " + nombreTipoMov[tipo].toLowerCase() + " de nómina?" + extra)) return;
  try {
    await borrarConBitacora("finanzas", id, mov);
    finanzas = finanzas.filter((f) => f.id !== id);
    renderTabContent();
  } catch (e) {
    alert("Error: " + e.message);
  }
}
