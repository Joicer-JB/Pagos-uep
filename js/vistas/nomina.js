// Pestaña Nómina: personal, nómina del mes (quincenas o mes completo), pagos, adelantos y préstamos, con sus recibos.
// Los montos van en $ de referencia; se paga en Bs. a la tasa BCV del día (o en $ efectivo). Los cálculos están en
// servicios/nomina-calculo.js.

let nominaMes = todayStr().slice(0, 7); // mes que se ve en «Nómina del mes»
const trabajadoresActivos = () => trabajadores.filter((t) => t.activo !== false);
const nombreTipoMov = { pago: "Pago", adelanto: "Adelanto", prestamo: "Préstamo" };
const ETIQ_MONEDA_NOMINA = { VES: "Bolívares (transferencia, pago móvil o efectivo)", USD: "Dólares en efectivo" };
// N° de recibo: sale del registro, así es siempre el mismo al reimprimir
const numReciboNomina = (mov) => (mov && mov.id ? "NOM-" + String(mov.id).slice(-6).toUpperCase() : "BORRADOR");
const lineaMonto = (monto, tasa) =>
  fmt(monto) + (tasa > 0 ? ` <small style="color:#555;font-weight:400">· ${fmtBs(r2(monto * tasa))}</small>` : "");

// ---- Recibos (pago, adelanto y préstamo). Sin registro (desde la ficha) muestra lo que le toca en el período actual.
function datosReciboNomina(trabId, movId) {
  const mov = movId ? finanzas.find((x) => x.id === movId) : null;
  let t = trabId ? trabajadores.find((x) => x.id === trabId) : null;
  if (mov && !t)
    t = trabajadores.find((x) => x.id === mov.trabajadorId) ||
      trabajadores.find((x) => x.nombre === mov.responsable) || {
        nombre: mov.responsable || "",
        cargo: "",
        cedula: "",
      };
  if (!t) return null;
  const tipo = mov ? tipoMovNomina(mov) : "pago";
  let asignaciones = [],
    deducciones = [],
    periodo = "";
  if (mov && mov.nomina && tipo === "pago") {
    asignaciones = mov.nomina.asignaciones || [];
    deducciones = mov.nomina.deducciones || [];
    periodo = nombrePeriodo(mov.nomina.periodo);
  } else if (mov && tipo === "adelanto") {
    const p = (mov.nomina || {}).periodo;
    asignaciones = [{ concepto: "Adelanto a cuenta de " + (nombrePeriodo(p) || "su próximo pago"), monto: mov.monto }];
    periodo = nombrePeriodo(p);
  } else if (mov && tipo === "prestamo") {
    const motivo = (mov.nomina || {}).motivo;
    asignaciones = [{ concepto: "Préstamo" + (motivo ? ": " + motivo : ""), monto: mov.monto }];
  } else if (mov) {
    // Pago viejo (antes de los períodos): base y otros conceptos; lo que no cuadra, como descuento
    const dz = desgloseRecibo(mov, t);
    asignaciones = dz.lineas.filter((l) => !l.ajuste).map((l) => ({ concepto: l.etq, monto: l.monto }));
    deducciones = dz.lineas.filter((l) => l.ajuste).map((l) => ({ concepto: l.etq, monto: Math.abs(l.monto) }));
    periodo = nombrePeriodo(periodoDePago(mov)) || mov.descripcion || "";
  } else {
    const p = periodoSugerido(t);
    const s = sugerenciaPago(t, p);
    asignaciones = s.asignaciones;
    deducciones = s.deducciones;
    periodo = nombrePeriodo(p);
  }
  const totalAsig = sumaDe(asignaciones, "monto"),
    totalDed = sumaDe(deducciones, "monto");
  const tasa = mov && mov.tasa > 0 ? mov.tasa : (tasaDe(mov ? mov.fecha : todayStr()) || {}).valor || 0;
  const neto = mov ? mov.monto || 0 : r2(totalAsig - totalDed);
  return {
    mov,
    t,
    tipo,
    asignaciones,
    deducciones,
    totalAsig,
    totalDed,
    neto,
    tasa,
    netoBs: mov && mov.montoBs != null ? mov.montoBs : tasa ? r2(neto * tasa) : null,
    periodo,
  };
}
function imprimirReciboNomina(trabId, movId) {
  const r = datosReciboNomina(trabId, movId);
  if (!r) return;
  const { t, tipo } = r;
  const titulo =
    tipo === "adelanto"
      ? "Recibo de adelanto"
      : tipo === "prestamo"
        ? "Comprobante de préstamo"
        : "Recibo de pago de nómina";
  const doble = dosPorHoja("nomina");
  const w = abrirVentanaImpresion("width=680,height=900");
  if (!w) return alert("Permite las ventanas emergentes para imprimir");
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"/>
  <title>${titulo} - ${escHtml(t.nombre)}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Segoe UI',Arial,sans-serif;background:#fff;color:#222;max-width:${doble ? 760 : 680}px;margin:0 auto}
    .hdr{padding:1rem 1.5rem 0}
    .hdr-top{display:flex;align-items:center;gap:1rem;padding-bottom:0.6rem;border-bottom:2px solid #003366;margin-bottom:0.7rem}
    .logo{width:50px;height:50px;object-fit:contain;flex-shrink:0}
    .copia{align-self:flex-start;border:1px solid #003366;border-radius:4px;padding:0.1rem 0.45rem;font-size:0.6rem;font-weight:800;letter-spacing:1.5px;color:#003366}
    .hdr-nums{display:grid;grid-template-columns:repeat(3,1fr);gap:0.75rem;border:1px solid #bbb;border-radius:6px;padding:0.5rem 0.9rem}
    .hl{font-size:0.55rem;color:#666;text-transform:uppercase;letter-spacing:1px}
    .sec{padding:0.8rem 1.5rem}
    .worker-box{border-left:3px solid #003366;padding:0.2rem 0 0.2rem 0.8rem;margin-bottom:0.8rem;display:grid;grid-template-columns:1fr 1fr;gap:0.35rem}
    .wf span{font-size:0.65rem;color:#666;display:block;text-transform:uppercase;letter-spacing:0.5px}
    .wf strong{font-size:0.85rem;color:#003366}
    .tit{font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin:0.6rem 0 0.2rem}
    .concept-row{display:flex;justify-content:space-between;gap:0.5rem;padding:0.38rem 0.2rem;border-bottom:1px dashed #ccc;font-size:0.85rem}
    .concept-row strong{color:#222;white-space:nowrap}
    .concept-row small{color:#666}
    .subtotal{display:flex;justify-content:space-between;padding:0.35rem 0.2rem;font-weight:700;font-size:0.82rem;color:#444}
    .total-box{border:1.5px solid #003366;border-radius:6px;padding:0.7rem 1rem;display:flex;justify-content:space-between;align-items:center;margin:0.75rem 0}
    .nota{border:1px solid #ddd;border-radius:6px;padding:0.5rem 0.8rem;font-size:0.78rem;color:#444;margin-top:0.5rem}
    .firmas{display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-top:1.6rem;padding-top:0.8rem}
    .fbox{text-align:center}.fline{border-top:1px solid #444;margin-bottom:5px;margin-top:2.3rem}.flabel{font-size:0.68rem;color:#555}
    @media (max-width:420px){.sec,.hdr{padding-left:0.8rem;padding-right:0.8rem}.hdr-nums{gap:0.4rem;padding:0.5rem}}
    ${doble ? CSS_DOS_POR_HOJA + ".mitad .hdr,.mitad .sec{padding:0}.mitad .der .sec>.tit:first-child{margin-top:0}.mitad .total-box{margin:0.5rem 0}.mitad .firmas{margin-top:0.8rem}.mitad .fline{margin-top:1.8rem}" : ""}
    @media print{button{display:none!important}.no-print{display:none}}
  </style></head><body>
  ${doble ? htmlDosPorHoja((etiqueta) => cuerpoReciboNomina(r, titulo, etiqueta)) : cuerpoReciboNomina(r, titulo)}
  <div class="no-print" style="text-align:center;padding:0.75rem">
    <button onclick="window.print()" style="background:#003366;color:#fff;border:none;padding:0.65rem 1.5rem;border-radius:8px;cursor:pointer;font-weight:700;font-size:0.9rem;font-family:inherit">🖨️ Imprimir / Guardar PDF</button>
  </div>
  </body></html>`);
  w.document.close();
}
// Un recibo de nómina: a la izquierda (en «2 por hoja») los datos y las asignaciones; a la derecha deducciones,
// neto y firmas
function cuerpoReciboNomina(r, titulo, copia) {
  const { mov, t, tipo } = r;
  const fecha = mov ? mov.fecha : todayStr();
  const filas = (l, clase) =>
    l
      .map(
        (x) =>
          `<div class="concept-row ${clase}"><span>${escHtml(x.concepto)}${x.horas ? ` <small>(${escHtml(detalleHoras(x.horas, x.tarifa))})</small>` : ""}</span><strong>${clase === "dedu" ? "- " : ""}${lineaMonto(x.monto, r.tasa)}</strong></div>`
      )
      .join("");
  // En el préstamo: cuánto se descuenta en cada pago y cuánto queda
  const prestamo = tipo === "prestamo" && mov ? prestamosDe(mov.trabajadorId).find((p) => p.id === mov.id) : null;
  const cuenta = mov && mov.cuentaPago ? cuentaCorta(mov.cuentaPago) : "";
  return `<div class="izq">
  <div class="hdr">
    <div class="hdr-top">
      <img src="data:image/png;base64,${LOGO}" class="logo" alt="Logo"/>
      <div style="flex:1">
        <div style="font-size:0.58rem;letter-spacing:2px;color:#003366;font-weight:700;text-transform:uppercase">${titulo}</div>
        <div style="font-size:0.95rem;font-family:Georgia,serif;color:#003366">${EMPRESA}</div>
        <div style="font-size:0.65rem;color:#555">${EMPRESA_SUB}</div>
      </div>
      ${copia ? `<div class="copia">${copia}</div>` : ""}
    </div>
    <div class="hdr-nums">
      <div><div class="hl">N° Recibo</div><div style="font-weight:800;font-size:0.85rem">${numReciboNomina(mov)}</div></div>
      <div style="text-align:center"><div class="hl">${tipo === "prestamo" ? "Cuota por pago" : "Período"}</div><div style="font-weight:700;font-size:0.78rem">${escHtml(tipo === "prestamo" ? (prestamo ? fmt(prestamo.cuota) : "—") : r.periodo || "—")}</div></div>
      <div style="text-align:right"><div class="hl">Fecha de pago</div><div style="font-weight:700;font-size:0.78rem">${escHtml(fechaCorta(fecha))}</div></div>
    </div>
  </div>
  <div class="sec">
    <div class="worker-box">
      <div class="wf" style="grid-column:1/-1"><span>Nombre completo</span><strong style="font-size:1rem">${escHtml(t.nombre)}</strong></div>
      <div class="wf"><span>Cédula</span><strong>${escHtml(t.cedula) || "N/A"}</strong></div>
      <div class="wf"><span>Cargo</span><strong>${escHtml(t.cargo) || "N/A"}</strong></div>
    </div>
    <div class="tit" style="color:#1a9e5c">${tipo === "pago" ? "➕ Asignaciones" : "➕ Monto entregado"}</div>
    ${filas(r.asignaciones, "earn")}
    ${r.deducciones.length ? `<div class="subtotal"><span>Total asignaciones</span><span>${fmt(r.totalAsig)}</span></div>` : ""}
  </div>
  </div><div class="der"><div class="sec">
    ${
      r.deducciones.length
        ? `<div class="tit" style="color:#c0392b">➖ Deducciones</div>
    ${filas(r.deducciones, "dedu")}
    <div class="subtotal"><span>Total deducciones</span><span>- ${fmt(r.totalDed)}</span></div>`
        : ""
    }
    <div class="total-box">
      <div><div style="font-size:0.62rem;color:#003366;font-weight:700;text-transform:uppercase;letter-spacing:1px">${tipo === "pago" ? "Neto a recibir" : "Total entregado"}</div>
        <div style="font-size:0.7rem;color:#555;margin-top:2px">${mov && mov.moneda === "USD" ? "Pagado en dólares en efectivo" : "Pagado en bolívares"}</div>
        ${cuenta ? `<div class="cuenta-pago" style="font-size:0.68rem;color:#555;margin-top:2px">🏦 ${escHtml(cuenta)}</div>` : ""}</div>
      <div style="text-align:right">
        <div style="font-size:1.4rem;font-weight:800;font-family:Georgia,serif;color:#000">${fmt(r.neto)}</div>
        ${r.netoBs != null ? `<div style="font-size:0.95rem;font-weight:700;color:#222;margin-top:2px">${fmtBs(r.netoBs)}</div><div style="font-size:0.6rem;color:#666">Tasa BCV: Bs. ${fmtTasa(r.tasa)} por $</div>` : ""}
      </div>
    </div>
    ${tipo === "adelanto" ? `<div class="nota">Este adelanto se descontará en el pago de ${escHtml(r.periodo || "su próxima quincena")}.</div>` : ""}
    ${prestamo ? `<div class="nota">Se descontará <strong>${fmt(prestamo.cuota)}</strong> en cada pago de nómina hasta completar ${fmt(prestamo.monto)} (${Math.ceil(prestamo.monto / (prestamo.cuota || prestamo.monto))} ${Math.ceil(prestamo.monto / (prestamo.cuota || prestamo.monto)) === 1 ? "pago" : "pagos"}). Pagado: ${fmt(prestamo.pagado)} · Saldo: <strong>${fmt(prestamo.saldo)}</strong>.</div>` : ""}
    ${!mov ? `<div class="nota">Borrador: lo que le corresponde en ${escHtml(r.periodo)}. Registra el pago para que quede en el historial.</div>` : ""}
    <div class="firmas">
      <div class="fbox"><div class="fline"></div><div class="flabel">Director(a)</div></div>
      <div class="fbox"><div class="fline"></div><div class="flabel">Trabajador(a)<br/><span style="font-size:0.6rem;color:#888">C.I: ${escHtml(t.cedula) || "___________"}</span></div></div>
    </div>
    <p style="text-align:center;font-size:0.62rem;color:#aaa;margin-top:1rem">${EMPRESA} · ${titulo}</p>
  </div></div>`;
}

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
function editarTrabajador(id) {
  trabEditId = id;
  cerrarModal();
  subTab.nomina = "nuevo";
  renderTabContent();
}
const campoDolar = (id, valor, ph, color) =>
  `<div style="position:relative"><span style="position:absolute;left:0.9rem;top:50%;transform:translateY(-50%);color:${color || "#003366"};font-weight:700">$</span>
    <input class="inp" id="${id}" placeholder="${ph || "0"}" inputmode="decimal" style="padding-left:1.9rem" value="${valor || ""}"/></div>`;
// «2,5» o «2.5» → 2.5 (en las horas y en lo que vale la hora no hay miles, así que el punto también es decimal)
const numeroCorto = (v) =>
  Number(
    String(v || "")
      .replace(/[\s$]/g, "")
      .replace(",", ".")
  ) || 0;
const seccionForm = (txt) =>
  `<div style="font-size:0.7rem;color:#003366;text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-top:0.5rem;border-bottom:1px solid #e2e8f0;padding-bottom:0.25rem">${txt}</div>`;
// Una fila de horas de clase: nivel, horas al mes y lo que vale la hora
const filaHorasForm = (
  i,
  h = {}
) => `<div class="t-hora" data-i="${i}" style="display:grid;grid-template-columns:1fr 1fr auto;gap:0.4rem;align-items:end;border:1px solid #e2e8f0;border-radius:10px;padding:0.5rem;margin-bottom:0.4rem">
    <div class="field" style="grid-column:1/-1;margin:0"><label class="field-label">Nivel</label><select class="inp" id="t-h-nivel-${i}" onchange="tarifaSugerida(${i})">${NIVELES_HORAS.map(
      (n) => `<option ${h.nivel === n ? "selected" : ""}>${n}</option>`
    ).join("")}</select></div>
    <div class="field" style="margin:0"><label class="field-label">Horas al mes</label><input class="inp" id="t-h-horas-${i}" inputmode="decimal" placeholder="0" value="${h.horas ? String(h.horas).replace(".", ",") : ""}" oninput="resumenSueldoForm()"/></div>
    <div class="field" style="margin:0"><label class="field-label">$ la hora</label>${campoDolar("t-h-tarifa-" + i, h.tarifa ? String(h.tarifa).replace(".", ",") : String(TARIFA_HORA[h.nivel || NIVELES_HORAS[0]] || "").replace(".", ","), "0,00").replace('inputmode="decimal"', 'inputmode="decimal" oninput="resumenSueldoForm()"')}</div>
    <button type="button" class="btn btn-gray btn-sm" title="Quitar" style="margin-bottom:0.2rem" onclick="this.closest('.t-hora').remove();resumenSueldoForm()">✕</button>
  </div>`;
function agregarFilaHoras() {
  const cont = document.getElementById("t-horas");
  if (!cont) return;
  const i = Math.max(-1, ...[...cont.querySelectorAll(".t-hora")].map((f) => Number(f.dataset.i))) + 1;
  cont.insertAdjacentHTML("beforeend", filaHorasForm(i));
  resumenSueldoForm();
}
// Al cambiar el nivel, la tarifa de ese nivel (Media general $ 2,50; Primaria $ 2,00), que se puede cambiar
function tarifaSugerida(i) {
  const nivel = document.getElementById("t-h-nivel-" + i).value,
    tarifa = document.getElementById("t-h-tarifa-" + i);
  if (TARIFA_HORA[nivel]) tarifa.value = String(TARIFA_HORA[nivel]).replace(".", ",");
  resumenSueldoForm();
}
function leerHorasForm() {
  const lista = [];
  let error = "";
  document.querySelectorAll("#t-horas .t-hora").forEach((f) => {
    const i = f.dataset.i;
    const nivel = document.getElementById("t-h-nivel-" + i).value,
      horas = r2(numeroCorto(document.getElementById("t-h-horas-" + i).value)),
      tarifa = r2(numeroCorto(document.getElementById("t-h-tarifa-" + i).value));
    if (!(horas > 0) && !(tarifa > 0)) return;
    if (!(horas > 0) && !error) error = "Escribe cuántas horas al mes da en " + nivel;
    else if (!(tarifa > 0) && !error) error = "Escribe cuánto vale la hora en " + nivel;
    else lista.push({ nivel, horas, tarifa });
  });
  return { lista, error };
}
// Lo que gana al mes según lo escrito: fijo + horas
function resumenSueldoForm() {
  const out = document.getElementById("t-resumen");
  if (!out) return;
  const v = (id) => parseFmt((document.getElementById(id) || {}).value || "0");
  const t = {
    salario: v("t-salario"),
    bonoAlimentacion: v("t-balim"),
    bonoProductividad: v("t-bprod"),
    descuento: v("t-desc"),
    horas: leerHorasForm().lista,
  };
  const fijo = r2(t.salario + t.bonoAlimentacion + t.bonoProductividad),
    horas = montoHorasMes(t);
  out.innerHTML =
    fijo + horas > 0
      ? `<div class="alert-item alert-info"><div>${ETIQ_TIPO_PAGO[tipoPagoTrabajador(t)]} · gana al mes <strong>${fmt(r2(fijo + horas))}</strong>${fijo > 0 && horas > 0 ? ` (fijo ${fmt(fijo)} + horas ${fmt(horas)})` : ""}${t.descuento > 0 ? ` · neto ${fmt(netoMensual(t))}` : ""}</div></div>`
      : "";
}
// Cuenta bancaria i (0 = principal): banco, tipo, número, titular y su cédula
const filaCuentaForm = (
  i,
  c = {}
) => `<div class="t-cuenta" style="border:1px solid #e2e8f0;border-radius:10px;padding:0.6rem;margin-bottom:0.5rem">
    <div style="font-size:0.75rem;font-weight:700;color:#555;margin-bottom:0.3rem">🏦 Cuenta ${i + 1}${i === 0 ? " (principal)" : " (opcional)"}</div>
    <div class="form-row">
      <div class="field"><label class="field-label">Número de cuenta o teléfono</label><input class="inp" id="t-c-num-${i}" inputmode="numeric" placeholder="0134 0000 00 0000000000" value="${escHtml(c.numero) || ""}" oninput="bancoSugerido(${i})"/></div>
      <div class="field"><label class="field-label">Tipo</label><select class="inp" id="t-c-tipo-${i}">${TIPOS_CUENTA.map((x) => `<option ${c.tipo === x ? "selected" : ""}>${x}</option>`).join("")}</select></div>
    </div>
    <div class="field"><label class="field-label">Banco</label><input class="inp" id="t-c-banco-${i}" list="bancos-ve" placeholder="Ej: Banesco" value="${escHtml(c.banco) || ""}"/></div>
    <div class="form-row">
      <div class="field"><label class="field-label">Titular <span style="font-weight:400;color:#888">(si no es el trabajador)</span></label><input class="inp" id="t-c-tit-${i}" value="${escHtml(c.titular) || ""}"/></div>
      <div class="field"><label class="field-label">Cédula del titular</label><input class="inp" id="t-c-ced-${i}" value="${escHtml(c.cedulaTitular) || ""}"/></div>
    </div>
  </div>`;
// Los 4 primeros dígitos de la cuenta dicen el banco
function bancoSugerido(i) {
  const banco = bancoDeCuenta(document.getElementById("t-c-num-" + i).value),
    campo = document.getElementById("t-c-banco-" + i);
  if (banco && campo && !campo.value.trim()) campo.value = banco;
}
function leerCuentasForm() {
  const lista = [];
  let error = "";
  for (let i = 0; i < 2; i++) {
    const val = (id) => ((document.getElementById(id + i) || {}).value || "").trim();
    const c = {
      banco: val("t-c-banco-"),
      tipo: val("t-c-tipo-") || TIPOS_CUENTA[0],
      numero: soloDigitos(val("t-c-num-")),
      titular: val("t-c-tit-"),
      cedulaTitular: val("t-c-ced-"),
    };
    if (!c.numero) continue;
    if (!c.banco) c.banco = bancoDeCuenta(c.numero);
    const mal = revisarCuenta(c);
    if (mal && !error) error = "Cuenta " + (i + 1) + ": " + mal;
    if (!c.banco && !error) error = "Cuenta " + (i + 1) + ": escribe el banco";
    lista.push(c);
  }
  return { lista, error };
}
// ---- Clases que da: materia, grados o años, días y horario
const chipOpcion = (attr, i, valor, marcado, texto) =>
  `<label class="chip-op"><input type="checkbox" ${attr}="${i}" value="${escHtml(valor)}" ${marcado ? "checked" : ""}/>${escHtml(texto || valor)}</label>`;
const filaClaseForm = (i, c = {}) => {
  const grados = c.grados || [],
    dias = c.dias || [];
  return `<div class="t-clase" data-i="${i}" style="border:1px solid #e2e8f0;border-radius:10px;padding:0.55rem;margin-bottom:0.45rem">
    <div style="display:grid;grid-template-columns:1fr auto;gap:0.4rem;align-items:end">
      <div class="field" style="margin:0"><label class="field-label">Materia <span style="font-weight:400;color:#888">(vacía = docente de aula)</span></label><input class="inp" id="t-cl-mat-${i}" list="materias-lista" placeholder="Ej: Matemáticas" value="${escHtml(c.materia) || ""}"/></div>
      <button type="button" class="btn btn-gray btn-sm" title="Quitar" style="margin-bottom:0.2rem" onclick="this.closest('.t-clase').remove()">✕</button>
    </div>
    <div class="field-label" style="margin-top:0.4rem">Grados o años</div>
    <div style="display:flex;gap:0.3rem;flex-wrap:wrap;margin-bottom:0.3rem">
      <button type="button" class="btn btn-gray btn-sm" style="font-size:0.68rem;padding:0.2rem 0.5rem" onclick="marcarGradosClase(${i},'todo')">🏫 Todo el colegio</button>
      ${GRUPOS_GRADOS.map((g) => `<button type="button" class="btn btn-gray btn-sm" style="font-size:0.68rem;padding:0.2rem 0.5rem" onclick="marcarGradosClase(${i},'${g.nombre}')">${g.nombre}</button>`).join("")}
      <button type="button" class="btn btn-gray btn-sm" style="font-size:0.68rem;padding:0.2rem 0.5rem" onclick="marcarGradosClase(${i},'nada')">Ninguno</button>
    </div>
    ${GRUPOS_GRADOS.map(
      (g) =>
        `<div style="display:flex;gap:0.25rem;flex-wrap:wrap;margin-bottom:0.25rem"><span style="font-size:0.64rem;color:#888;width:100%">${g.nombre}</span>${g.grados
          .map((x) => chipOpcion("data-cl-grado", i, x, grados.includes(x)))
          .join("")}</div>`
    ).join("")}
    <div class="field-label" style="margin-top:0.35rem">Días y horario <span style="font-weight:400;color:#888">(opcional)</span></div>
    <div style="display:flex;gap:0.25rem;flex-wrap:wrap;margin-bottom:0.35rem">${DIAS_SEMANA.map((d) => chipOpcion("data-cl-dia", i, d, dias.includes(d))).join("")}</div>
    <div class="form-row">
      <div class="field" style="margin:0"><label class="field-label">Desde</label><input class="inp" type="time" id="t-cl-desde-${i}" value="${escHtml(c.desde) || ""}"/></div>
      <div class="field" style="margin:0"><label class="field-label">Hasta</label><input class="inp" type="time" id="t-cl-hasta-${i}" value="${escHtml(c.hasta) || ""}"/></div>
    </div>
  </div>`;
};
function agregarFilaClase() {
  const cont = document.getElementById("t-clases");
  if (!cont) return;
  const i = Math.max(-1, ...[...cont.querySelectorAll(".t-clase")].map((f) => Number(f.dataset.i))) + 1;
  cont.insertAdjacentHTML("beforeend", filaClaseForm(i));
}
// Atajos: todo el colegio, un nivel completo (si ya estaba todo marcado, lo desmarca) o ninguno
function marcarGradosClase(i, que) {
  const cajas = [...document.querySelectorAll(`input[data-cl-grado="${i}"]`)];
  const grupo = GRUPOS_GRADOS.find((g) => g.nombre === que);
  const del = grupo ? cajas.filter((c) => grupo.grados.includes(c.value)) : cajas;
  const marcar = que === "nada" ? false : grupo ? !del.every((c) => c.checked) : true;
  del.forEach((c) => (c.checked = marcar));
}
function leerClasesForm() {
  const lista = [];
  let error = "";
  document.querySelectorAll("#t-clases .t-clase").forEach((f, n) => {
    const i = f.dataset.i;
    const marcados = (attr) => [...f.querySelectorAll(`input[${attr}="${i}"]:checked`)].map((x) => x.value);
    const c = {
      materia: document.getElementById("t-cl-mat-" + i).value.trim(),
      grados: marcados("data-cl-grado"),
      dias: marcados("data-cl-dia"),
      desde: document.getElementById("t-cl-desde-" + i).value,
      hasta: document.getElementById("t-cl-hasta-" + i).value,
    };
    if (!c.materia && !c.grados.length && !c.dias.length && !c.desde && !c.hasta) return; // fila vacía
    const mal = revisarClase(c);
    if (mal && !error) error = "Clase " + (n + 1) + (c.materia ? " (" + c.materia + ")" : "") + ": " + mal;
    lista.push(c);
  });
  return { lista, error };
}
// Materias que se sugieren: las de Configuración → Materias y las de siempre
const materiasSugeridas = () =>
  [
    ...new Set(
      [
        ...MATERIAS,
        ...Object.values(configMaterias || {}).flat(),
        "Educación Física y Deporte",
        "Inglés",
        "Música",
        "Computación",
      ].filter((m) => typeof m === "string" && m.trim())
    ),
  ].sort((a, b) => a.localeCompare(b));
function renderFormTrabajador(data = {}) {
  const horas = Array.isArray(data.horas) && data.horas.length ? data.horas : [];
  const cuentas = Array.isArray(data.cuentas) ? data.cuentas : [];
  const clases = Array.isArray(data.clases) ? data.clases : [];
  setTimeout(resumenSueldoForm, 0);
  return `<div class="card">
    <div class="card-title"><div class="card-bar"></div><h2>${data.id ? "Editar" : "Nuevo"} Trabajador</h2></div>
    <datalist id="bancos-ve">${Object.values(BANCOS_VE)
      .sort()
      .map((b) => `<option value="${b}"></option>`)
      .join("")}</datalist>
    <datalist id="materias-lista">${materiasSugeridas()
      .map((m) => `<option value="${escHtml(m)}"></option>`)
      .join("")}</datalist>
    <div class="form-grid">
      ${seccionForm("👤 Datos personales")}
      <div class="field"><label class="field-label">Nombre completo *</label><input class="inp" id="t-nombre" value="${escHtml(data.nombre) || ""}"/></div>
      <div class="form-row">
        <div class="field"><label class="field-label">Cédula</label><input class="inp" id="t-cedula" placeholder="V-12345678" value="${escHtml(data.cedula) || ""}"/></div>
        <div class="field"><label class="field-label">RIF</label><input class="inp" id="t-rif" placeholder="V-12345678-9" value="${escHtml(data.rif) || ""}"/></div>
      </div>
      <div class="form-row">
        <div class="field"><label class="field-label">Teléfono</label><input class="inp" id="t-telefono" inputmode="tel" placeholder="0414 1234567" value="${escHtml(data.telefono) || ""}"/></div>
        <div class="field"><label class="field-label">📅 Fecha de ingreso a la escuela</label><input class="inp" type="date" id="t-fingreso" value="${escHtml(data.fechaIngreso) || ""}"/></div>
      </div>
      <div style="font-size:0.72rem;color:#888;margin-top:-0.3rem">Si solo sabes el año, pon el día en que empezó el año escolar (p. ej. 15/09/2015).</div>
      <div class="field"><label class="field-label">Cargo o funciones</label><input class="inp" id="t-cargo" placeholder="Ej: Coordinadora de Primaria y docente de Media general" value="${escHtml(data.cargo) || ""}"/></div>
      <div class="field"><label class="field-label">🎓 Títulos obtenidos <span style="font-weight:400;color:#888">(uno por línea)</span></label><textarea class="inp" id="t-titulos" rows="2" placeholder="Ej: Licenciada en Educación Integral (UPEL, 2012)">${escHtml((data.titulos || []).join("\n"))}</textarea></div>

      ${seccionForm("💼 Sueldo fijo")}
      <div class="form-row">
        <div class="field"><label class="field-label">Salario base mensual ($)</label>${campoDolar("t-salario", data.salario).replace('inputmode="decimal"', 'inputmode="decimal" oninput="resumenSueldoForm()"')}</div>
        <div class="field"><label class="field-label">¿Cómo se le paga?</label>
          <select class="inp" id="t-frec"><option value="quincenal" ${data.frecuencia !== "mensual" ? "selected" : ""}>🔁 Por quincenas (la mitad cada una)</option><option value="mensual" ${data.frecuencia === "mensual" ? "selected" : ""}>📆 Una vez al mes</option></select></div>
      </div>
      <div style="font-size:0.72rem;color:#888;margin-top:-0.3rem">Si solo trabaja por horas, deja el salario vacío.</div>
      <div class="form-row">
        <div class="field"><label class="field-label">🍽️ Bono alimentación (mensual)</label>${campoDolar("t-balim", data.bonoAlimentacion).replace('inputmode="decimal"', 'inputmode="decimal" oninput="resumenSueldoForm()"')}</div>
        <div class="field"><label class="field-label">⭐ Bono productividad (mensual)</label>${campoDolar("t-bprod", data.bonoProductividad).replace('inputmode="decimal"', 'inputmode="decimal" oninput="resumenSueldoForm()"')}</div>
      </div>
      <div class="form-row">
        <div class="field"><label class="field-label">Deducción fija mensual ($)</label>${campoDolar("t-desc", data.descuento, "0", "#e53e3e").replace('inputmode="decimal"', 'inputmode="decimal" oninput="resumenSueldoForm()"')}</div>
        <div class="field"><label class="field-label">¿Qué es la deducción fija?</label><input class="inp" id="t-desc-concepto" placeholder="Ej: Caja de ahorro, IVSS" value="${escHtml(data.descuentoConcepto) || ""}"/></div>
      </div>
      <div style="font-size:0.72rem;color:#888;margin-top:-0.3rem">Los adelantos y los préstamos no van aquí: regístralos con 💸 Adelanto y 🤝 Préstamo y se descuentan solos al pagar.</div>

      ${seccionForm("⏱️ Horas de clase")}
      <div style="font-size:0.72rem;color:#888">Para quien da clases por horas (todos los de Media general, o quien tiene un cargo fijo y además da horas). Cada nivel con lo que vale su hora. Las horas del mes son las que da normalmente; al pagar se escriben las que trabajó en esa quincena.</div>
      <div id="t-horas">${horas.map((h, i) => filaHorasForm(i, h)).join("")}</div>
      <button type="button" class="btn btn-gray btn-sm" onclick="agregarFilaHoras()">+ Agregar horas de clase</button>
      <div id="t-resumen"></div>

      ${seccionForm("📚 Clases que da")}
      <div style="font-size:0.72rem;color:#888">En Inicial y Primaria basta marcar el grado. En Media general, una fila por materia con los años, los días y el horario (si el horario cambia de un año a otro, agrega otra fila). Deporte o Inglés: «Todo el colegio».</div>
      <div id="t-clases">${clases.map((c, i) => filaClaseForm(i, c)).join("")}</div>
      <button type="button" class="btn btn-gray btn-sm" onclick="agregarFilaClase()">+ Agregar clase</button>

      ${seccionForm("🏦 Cuentas para pagarle")}
      ${[0, 1].map((i) => filaCuentaForm(i, cuentas[i])).join("")}

      <div class="field"><label class="field-label">Observación</label><textarea class="inp" id="t-obs" rows="2">${escHtml(data.observacion) || ""}</textarea></div>
      ${data.id ? `<label style="display:flex;gap:0.5rem;align-items:center;font-size:0.82rem"><input type="checkbox" id="t-retirado" ${data.activo === false ? "checked" : ""}/> 🚪 Ya no trabaja aquí (se conserva su historial)</label>` : ""}
      <div style="font-size:0.72rem;color:#888">📎 El certificado de salud y los demás documentos se adjuntan desde la ficha del trabajador, después de guardarlo.</div>
      <div id="t-err"></div>
      <div style="display:flex;gap:0.5rem">
        <button class="btn btn-primary" style="flex:1" onclick="guardarTrabajador('${data.id || ""}')">✓ Guardar</button>
        <button class="btn btn-gray" onclick="trabEditId=null;subTab.nomina='lista';renderTabContent()">Cancelar</button>
      </div>
    </div>
  </div>`;
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
async function guardarTrabajador(editId) {
  const err = (m) => mostrarError("t-err", m);
  const val = (id) => document.getElementById(id).value.trim();
  const nombre = val("t-nombre");
  if (!nombre) return err("El nombre es requerido");
  const cedula = val("t-cedula");
  const otro = cedula && trabajadores.find((t) => t.id !== editId && soloDigitos(t.cedula) === soloDigitos(cedula));
  if (otro) return err("Ya hay un trabajador con esa cédula: " + otro.nombre);
  const rif = normalizarRif(val("t-rif"));
  if (!rifValido(rif)) return err("El RIF debe ser como V-12345678-9");
  const horas = leerHorasForm();
  if (horas.error) return err(horas.error);
  const clases = leerClasesForm();
  if (clases.error) return err(clases.error);
  const cuentas = leerCuentasForm();
  if (cuentas.error) return err(cuentas.error);
  const retirado = document.getElementById("t-retirado");
  const datos = {
    nombre,
    cedula,
    rif,
    telefono: val("t-telefono"),
    cargo: val("t-cargo"),
    titulos: val("t-titulos")
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean),
    salario: parseFmt(val("t-salario")),
    frecuencia: val("t-frec") === "mensual" ? "mensual" : "quincenal",
    bonoAlimentacion: parseFmt(val("t-balim")),
    bonoProductividad: parseFmt(val("t-bprod")),
    descuento: parseFmt(val("t-desc")),
    descuentoConcepto: val("t-desc-concepto"),
    horas: horas.lista,
    clases: clases.lista,
    cuentas: cuentas.lista,
    fechaIngreso: val("t-fingreso"),
    observacion: val("t-obs"),
    activo: !(retirado && retirado.checked),
  };
  if (!(devengadoMensual(datos) > 0) && !confirm("No tiene sueldo fijo ni horas de clase. ¿Guardarlo así?")) return;
  try {
    if (editId) {
      await db.collection("trabajadores").doc(editId).update(datos);
      const i = trabajadores.findIndex((t) => t.id === editId);
      if (i >= 0) trabajadores[i] = { ...trabajadores[i], ...datos };
      alertaNomina(datos, "✏️ Actualizado en");
    } else {
      const ref = await db.collection("trabajadores").add(datos);
      datos.id = ref.id;
      trabajadores.push(datos);
      alertaNomina(datos, "➕ Registrado en");
    }
    trabEditId = null;
    subTab.nomina = "lista";
    cerrarModal();
    renderTabContent();
  } catch (e) {
    mostrarError("t-err", e.message);
  }
}
const textoAntiguedad = (t) => {
  const n = antiguedad(t.fechaIngreso);
  return n == null ? "" : fechaCorta(t.fechaIngreso) + " · " + (n === 1 ? "1 año" : n + " años") + " en la escuela";
};
// Documentos adjuntos (certificado de salud, título…): ver/imprimir, quitar y adjuntar otro
function htmlDocumentosTrabajador(t) {
  const adj = Array.isArray(t.adjuntos) ? t.adjuntos : [];
  const cert = estadoCertificado(t);
  const estado = {
    falta: `<div class="alert-item alert-mora" style="margin-bottom:0.4rem">🩺 Falta adjuntar el certificado de salud.</div>`,
    "sin-fecha": "",
    vencido: `<div class="alert-item alert-mora" style="margin-bottom:0.4rem">🩺 El certificado de salud venció el ${cert.adjunto && cert.adjunto.vence ? fechaCorta(cert.adjunto.vence) : ""}: adjunta el nuevo.</div>`,
    "por-vencer": `<div class="alert-item alert-info" style="margin-bottom:0.4rem">🩺 El certificado de salud vence el ${cert.adjunto && cert.adjunto.vence ? fechaCorta(cert.adjunto.vence) : ""}.</div>`,
    vigente: "",
  }[cert.estado];
  return `${estado}
    ${adj
      .map(
        (
          a
        ) => `<div class="doc-trabajador" style="display:flex;align-items:center;gap:0.4rem;padding:0.4rem 0.6rem;background:#f8faff;border-radius:8px;margin-bottom:0.35rem">
        <div style="flex:1;min-width:0;font-size:0.8rem"><strong>${escHtml(CLASES_DOCUMENTO[a.clase] || "📄 Documento")}</strong>
          <div style="font-size:0.7rem;color:#777;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(a.nombre)} · ${Math.max(1, Math.round((a.tam || 0) / 1024))} KB · ${escHtml(fechaCorta(a.fecha))}${a.vence ? " · vence " + escHtml(fechaCorta(a.vence)) : ""}</div></div>
        <button class="btn btn-print btn-sm" onclick="imprimirDocumentoTrabajador('${t.id}','${a.id}')">🖨️ Ver</button>
        <button class="btn btn-gray btn-sm" title="Quitar" onclick="quitarDocumento('${t.id}','${a.id}')">🗑️</button>
      </div>`
      )
      .join("")}
    <div class="form-grid" style="border:1px dashed #c5d8f0;border-radius:10px;padding:0.6rem;margin-top:0.4rem">
      <div class="form-row">
        <div class="field"><label class="field-label">Documento</label><select class="inp" id="doc-clase" onchange="document.getElementById('doc-vence-campo').style.display=this.value==='salud'?'':'none'">${Object.entries(
          CLASES_DOCUMENTO
        )
          .map(
            ([k, l]) =>
              `<option value="${k}" ${k === (cert.estado === "vigente" ? "titulo" : "salud") ? "selected" : ""}>${l}</option>`
          )
          .join("")}</select></div>
        <div class="field" id="doc-vence-campo" ${cert.estado === "vigente" ? 'style="display:none"' : ""}><label class="field-label">Vence el</label><input class="inp" type="date" id="doc-vence"/></div>
      </div>
      <div class="field"><label class="field-label">Archivo (foto o PDF)</label><input class="inp" type="file" id="doc-archivo" accept="image/*,application/pdf"/></div>
      <div id="doc-msg"></div>
      <button class="btn btn-primary btn-sm" onclick="subirDocumento('${t.id}')">📎 Adjuntar</button>
    </div>`;
}
async function subirDocumento(trabId) {
  const msg = (h) => (document.getElementById("doc-msg").innerHTML = h);
  const archivo = (document.getElementById("doc-archivo").files || [])[0];
  const clase = document.getElementById("doc-clase").value;
  const vence = clase === "salud" ? document.getElementById("doc-vence").value : "";
  if (!archivo) return msg(`<div class="error-msg">Elige el archivo</div>`);
  if (clase === "salud" && !vence && !confirm("¿Guardar el certificado de salud sin fecha de vencimiento?")) return;
  msg(`<div style="font-size:0.78rem;color:#555">⏳ Guardando el documento…</div>`);
  try {
    await adjuntarDocumentoTrabajador(trabId, { clase, archivo, vence });
    abrirModal({ tipo: "ver-trabajador", id: trabId });
    mostrarExito("¡Documento adjuntado!", CLASES_DOCUMENTO[clase]);
  } catch (e) {
    msg(`<div class="error-msg">${escHtml(e.message)}</div>`);
  }
}
async function quitarDocumento(trabId, adjId) {
  const t = trabajadores.find((x) => x.id === trabId);
  const a = t && (t.adjuntos || []).find((x) => x.id === adjId);
  if (!a || !confirm("¿Quitar «" + (CLASES_DOCUMENTO[a.clase] || "documento") + "» de " + t.nombre + "?")) return;
  try {
    await quitarDocumentoTrabajador(trabId, adjId);
    abrirModal({ tipo: "ver-trabajador", id: trabId });
  } catch (e) {
    alert("Error: " + e.message);
  }
}
function renderModalVerTrabajador(m) {
  const t = trabajadores.find((x) => x.id === m.id);
  if (!t) return "";
  const prestamos = prestamosDe(t.id),
    adelantos = adelantosPendientes(t.id);
  const pagos = movimientosNomina(t.id)
    .filter((f) => tipoMovNomina(f) === "pago")
    .sort((a, b) => b.fecha.localeCompare(a.fecha))
    .slice(0, 5);
  const fila = (l, v, c) =>
    `<div style="display:flex;justify-content:space-between;gap:0.5rem;padding:0.4rem 0.75rem;background:#f8faff;border-radius:8px;margin-bottom:0.35rem"><span style="font-size:0.82rem;color:#555">${l}</span><span style="font-weight:700;color:${c};text-align:right;font-size:0.88rem;${String(v).length <= 14 ? "white-space:nowrap" : ""}">${v}</span></div>`;
  const titulo = (txt) =>
    `<div style="font-size:0.62rem;color:#003366;text-transform:uppercase;letter-spacing:1px;font-weight:700;margin:0.8rem 0 0.35rem">${txt}</div>`;
  const cuentas = cuentasDe(t);
  return `<div class="modal-bg" onclick="if(event.target.classList.contains('modal-bg'))cerrarModal()">
    <div class="modal">
      <div class="modal-header"><div><h3>👷 ${escHtml(t.nombre)}</h3><p>${escHtml(t.cargo) || "Sin cargo"} · ${ETIQ_TIPO_PAGO[tipoPagoTrabajador(t)]} · ${t.frecuencia === "mensual" ? "pago mensual" : "pago quincenal"}${t.activo === false ? " · retirado" : ""}</p></div><button class="modal-close-x" onclick="cerrarModal()">✕</button></div>
      <div class="modal-body">
        ${titulo("👤 Datos")}
        ${fila("Cédula", escHtml(t.cedula || "N/A"), "#333")}
        ${t.rif ? fila("RIF", escHtml(t.rif), "#333") : ""}
        ${t.telefono ? fila("Teléfono", escHtml(t.telefono), "#333") : ""}
        ${t.fechaIngreso ? fila("Ingreso", escHtml(textoAntiguedad(t)), "#333") : ""}
        ${(t.titulos || []).length ? fila("🎓 Títulos", (t.titulos || []).map(escHtml).join("<br/>"), "#333") : ""}
        ${titulo("💰 Lo que gana al mes")}
        ${t.salario ? fila("Salario base", fmt(t.salario), "#003366") : ""}
        ${t.bonoAlimentacion ? fila("Bono alimentación", fmt(t.bonoAlimentacion), "#1a9e5c") : ""}
        ${t.bonoProductividad ? fila("Bono productividad", fmt(t.bonoProductividad), "#b8860b") : ""}
        ${horasDe(t)
          .map((h) =>
            fila(
              "⏱️ " + escHtml(conceptoHoras(h.nivel)) + " · " + escHtml(detalleHoras(h.horas, h.tarifa)),
              fmt(r2(h.horas * h.tarifa)),
              "#003366"
            )
          )
          .join("")}
        ${t.descuento ? fila(escHtml(t.descuentoConcepto || "Deducción fija"), "- " + fmt(t.descuento), "#e53e3e") : ""}
        <div style="display:flex;justify-content:space-between;padding:0.75rem 1rem;background:linear-gradient(135deg,#003366,#00509e);border-radius:10px;color:#fff;margin-top:0.4rem">
          <span style="color:#ffd700;font-weight:700">NETO MENSUAL${horasDe(t).length ? " (aprox.)" : ""}</span>
          <span style="font-size:1.2rem;font-weight:800;font-family:Georgia,serif">${fmt(netoMensual(t))}</span>
        </div>
        ${t.frecuencia !== "mensual" ? `<div style="font-size:0.72rem;color:#666;margin-top:0.3rem;text-align:center">Por quincena: ${fmt(r2(netoMensual(t) / 2))}${horasDe(t).length ? " · las horas se pagan según lo trabajado" : ""}</div>` : ""}
        ${titulo("📚 Clases que da")}
        ${
          clasesDe(t).length
            ? clasesDe(t)
                .map((c) =>
                  fila(
                    "📚 " + escHtml(materiaDe(c)) + " · " + escHtml(textoGrados(c.grados)),
                    escHtml(textoHorario(c)) || "—",
                    "#333"
                  )
                )
                .join("") +
              (minutosSemana(t)
                ? `<div style="font-size:0.72rem;color:#666;text-align:center">Según el horario: ${textoMinutos(minutosSemana(t))} de clase a la semana</div>`
                : "")
            : `<div style="font-size:0.78rem;color:#888">Sin clases registradas</div>`
        }
        ${titulo("🏦 Cuentas para pagarle")}
        ${cuentas.length ? cuentas.map((c, i) => fila((i === 0 ? "Principal: " : "") + escHtml(c.banco || "Banco") + " · " + escHtml(c.tipo), escHtml(c.tipo === "Pago móvil" ? c.numero : c.numero.replace(/(\d{4})(\d{4})(\d{2})(\d{10})/, "$1-$2-$3-$4")) + (c.titular ? `<br/><span style="font-weight:400;font-size:0.72rem">${escHtml(c.titular)}${c.cedulaTitular ? " · " + escHtml(c.cedulaTitular) : ""}</span>` : ""), "#333")).join("") : `<div style="font-size:0.78rem;color:#888">Sin cuentas registradas</div>`}
        ${titulo("📎 Documentos")}
        ${htmlDocumentosTrabajador(t)}
        ${titulo("💸 Adelantos por descontar")}
        ${adelantos.length ? adelantos.map((a) => fila("Del " + fechaCorta(a.fecha) + (a.periodo ? " · a cuenta de " + nombrePeriodo(a.periodo) : ""), fmt(a.pendiente), "#b8860b")).join("") : `<div style="font-size:0.78rem;color:#888">Ninguno</div>`}
        ${titulo("🤝 Préstamos")}
        ${prestamos.length ? prestamos.map((p) => fila("Del " + fechaCorta(p.fecha) + ": " + fmt(p.monto) + " · cuota " + fmt(p.cuota) + " · pagado " + fmt(p.pagado), p.saldo > 0 ? "Debe " + fmt(p.saldo) : "✓ Pagado", p.saldo > 0 ? "#e53e3e" : "#1a9e5c")).join("") : `<div style="font-size:0.78rem;color:#888">Ninguno</div>`}
        ${titulo("📋 Últimos pagos")}
        ${pagos.length ? pagos.map((f) => fila(escHtml(nombrePeriodo(periodoDePago(f)) || f.descripcion || "") + " · " + fechaCorta(f.fecha), fmt(f.monto), "#003366")).join("") : `<div style="font-size:0.78rem;color:#888">Sin pagos</div>`}
        ${t.observacion ? `<div style="margin-top:0.65rem;padding:0.6rem 0.75rem;background:#f8faff;border-radius:8px;font-size:0.8rem;color:#555">📝 ${escHtml(t.observacion)}</div>` : ""}
      </div>
      <div class="modal-actions" style="flex-wrap:wrap">
        ${
          t.activo !== false
            ? `<button class="btn btn-primary" style="flex:1" onclick="abrirModal({tipo:'pago-nomina',trabId:'${t.id}'})">💳 Pagar</button>
        <button class="btn btn-gray btn-sm" onclick="abrirModal({tipo:'adelanto-nomina',trabId:'${t.id}'})">💸 Adelanto</button>
        <button class="btn btn-gray btn-sm" onclick="abrirModal({tipo:'prestamo-nomina',trabId:'${t.id}'})">🤝 Préstamo</button>`
            : ""
        }
        <button class="btn btn-print btn-sm" title="Recibo de lo que le toca" onclick="imprimirReciboNomina('${t.id}',null)">🖨️</button>
        <button class="btn btn-print btn-sm" onclick="imprimirFichaTrabajador('${t.id}')">📄 Ficha</button>
        <button class="btn btn-primary btn-sm" onclick="editarTrabajador('${t.id}')">✏️</button>
        ${rolUsuario === "director" ? `<button class="btn btn-danger btn-sm" onclick="eliminarTrabajador('${t.id}')">🗑️</button>` : ""}
        <button class="btn btn-gray" onclick="cerrarModal()">Cerrar</button>
      </div>
    </div>
  </div>`;
}
// Ficha del trabajador para imprimir o archivar: datos, títulos, sueldo, cuentas y documentos que tiene
function imprimirFichaTrabajador(trabId) {
  const t = trabajadores.find((x) => x.id === trabId);
  if (!t) return;
  const w = abrirVentanaImpresion("width=680,height=900");
  if (!w) return alert("Permite las ventanas emergentes para imprimir");
  const fila = (l, v) => (v ? `<tr><th>${l}</th><td>${v}</td></tr>` : "");
  const cuentas = cuentasDe(t);
  const adj = Array.isArray(t.adjuntos) ? t.adjuntos : [];
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>Ficha - ${escHtml(t.nombre)}</title>
  <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Segoe UI',Arial,sans-serif;color:#222;background:#fff;max-width:680px;margin:0 auto;padding:1rem 1.4rem}
  .hdr{display:flex;align-items:center;gap:0.9rem;padding-bottom:0.6rem;border-bottom:2px solid #003366;margin-bottom:0.8rem}.hdr img{width:50px;height:50px;object-fit:contain}
  h2{font-size:0.72rem;text-transform:uppercase;letter-spacing:1px;color:#003366;margin:0.9rem 0 0.3rem}
  table{width:100%;border-collapse:collapse;font-size:0.82rem}th,td{text-align:left;padding:0.3rem 0.4rem;border-bottom:1px dashed #ccc;vertical-align:top}th{width:36%;color:#555;font-weight:600}
  .firmas{display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-top:2.2rem}.fbox{text-align:center}.fline{border-top:1px solid #444;margin:2rem 0 5px}.flabel{font-size:0.7rem;color:#555}
  @media print{.no-print{display:none}}</style></head><body>
  <div class="hdr"><img src="data:image/png;base64,${LOGO}" alt="Logo"/><div>
    <div style="font-size:0.58rem;letter-spacing:2px;color:#003366;font-weight:700;text-transform:uppercase">Ficha del trabajador</div>
    <div style="font-size:0.95rem;font-family:Georgia,serif;color:#003366">${EMPRESA}</div><div style="font-size:0.65rem;color:#555">${EMPRESA_SUB}</div></div></div>
  <h2>👤 Datos personales</h2><table>
    ${fila("Nombre completo", `<strong>${escHtml(t.nombre)}</strong>`)}
    ${fila("Cédula", escHtml(t.cedula))}${fila("RIF", escHtml(t.rif))}${fila("Teléfono", escHtml(t.telefono))}
    ${fila("Cargo o funciones", escHtml(t.cargo))}${fila("Ingreso", escHtml(textoAntiguedad(t)))}
    ${fila("Títulos", (t.titulos || []).map(escHtml).join("<br/>"))}
    ${fila("Situación", t.activo === false ? "Retirado" : "Activo")}</table>
  <h2>💰 Sueldo</h2><table>
    ${fila("Forma de pago", ETIQ_TIPO_PAGO[tipoPagoTrabajador(t)] + " · " + (t.frecuencia === "mensual" ? "mensual" : "por quincenas"))}
    ${t.salario ? fila("Salario base mensual", fmt(t.salario)) : ""}
    ${t.bonoAlimentacion ? fila("Bono alimentación", fmt(t.bonoAlimentacion)) : ""}
    ${t.bonoProductividad ? fila("Bono productividad", fmt(t.bonoProductividad)) : ""}
    ${horasDe(t)
      .map((h) =>
        fila(
          escHtml(conceptoHoras(h.nivel)),
          escHtml(detalleHoras(h.horas, h.tarifa)) + " al mes = " + fmt(r2(h.horas * h.tarifa))
        )
      )
      .join("")}
    ${t.descuento ? fila(escHtml(t.descuentoConcepto || "Deducción fija"), "- " + fmt(t.descuento)) : ""}
    ${fila("Neto mensual" + (horasDe(t).length ? " (aprox.)" : ""), `<strong>${fmt(netoMensual(t))}</strong>`)}</table>
  ${
    clasesDe(t).length
      ? `<h2>📚 Clases que da</h2><table>${clasesDe(t)
          .map((c) =>
            fila(
              escHtml(materiaDe(c)),
              escHtml(textoGrados(c.grados)) + (textoHorario(c) ? "<br/>" + escHtml(textoHorario(c)) : "")
            )
          )
          .join("")}</table>`
      : ""
  }
  <h2>🏦 Cuentas para el pago</h2><table>
    ${cuentas.length ? cuentas.map((c, i) => fila("Cuenta " + (i + 1) + (i === 0 ? " (principal)" : ""), escHtml([c.banco, c.tipo, c.numero].filter(Boolean).join(" · ")) + (c.titular ? "<br/>Titular: " + escHtml(c.titular) + (c.cedulaTitular ? " · " + escHtml(c.cedulaTitular) : "") : ""))).join("") : fila("Cuentas", "Sin cuentas registradas")}</table>
  <h2>📎 Documentos en el archivo digital</h2><table>
    ${adj.length ? adj.map((a) => fila(escHtml(CLASES_DOCUMENTO[a.clase] || "Documento"), "Adjuntado el " + escHtml(fechaCorta(a.fecha)) + (a.vence ? " · vence el " + escHtml(fechaCorta(a.vence)) : ""))).join("") : fila("Documentos", "Ninguno")}</table>
  ${t.observacion ? `<h2>📝 Observación</h2><p style="font-size:0.82rem">${escHtml(t.observacion)}</p>` : ""}
  <div class="firmas"><div class="fbox"><div class="fline"></div><div class="flabel">Director(a)</div></div><div class="fbox"><div class="fline"></div><div class="flabel">Trabajador(a)</div></div></div>
  <p style="text-align:center;font-size:0.62rem;color:#999;margin-top:1rem">Impresa el ${escHtml(fechaCorta(todayStr()))}</p>
  <div class="no-print" style="text-align:center;padding:0.75rem"><button onclick="window.print()" style="background:#003366;color:#fff;border:none;padding:0.65rem 1.5rem;border-radius:8px;font-weight:700">🖨️ Imprimir / Guardar PDF</button></div>
  </body></html>`);
  w.document.close();
}

// ---- Formularios: elegir trabajador y período
const opcionesTrabajador = (sel) =>
  `<option value="">-- Seleccionar --</option>` +
  trabajadoresActivos()
    .map(
      (t) =>
        `<option value="${t.id}" ${t.id === sel ? "selected" : ""}>${escHtml(t.nombre)} — ${escHtml(t.cargo) || "Sin cargo"}</option>`
    )
    .join("");
const campoPeriodo = (pref, periodo, onchange) => {
  const x = partesPeriodo(periodo) || partesPeriodo(periodoSugerido(null));
  return `<div class="form-row">
    <div class="field"><label class="field-label">${pref === "ad" ? "A cuenta de" : "Período *"}</label>
      <select class="inp" id="${pref}-tipo" onchange="${onchange}">${Object.entries(TIPOS_PERIODO)
        .map(([k, l]) => `<option value="${k}" ${x.tipo === k ? "selected" : ""}>${l}</option>`)
        .join("")}</select></div>
    <div class="field"><label class="field-label">Mes</label><input class="inp" type="month" id="${pref}-mes" value="${x.ym}" onchange="${onchange}"/></div>
  </div>`;
};
const leerPeriodo = (pref) => {
  const tipo = (document.getElementById(pref + "-tipo") || {}).value,
    ym = (document.getElementById(pref + "-mes") || {}).value;
  return /^\d{4}-\d{2}$/.test(ym || "") && TIPOS_PERIODO[tipo] ? periodoDe(ym, tipo) : "";
};
const campoMoneda = (pref) =>
  `<div class="field"><label class="field-label">¿Cómo se paga?</label><select class="inp" id="${pref}-moneda">${Object.entries(
    ETIQ_MONEDA_NOMINA
  )
    .map(([k, l]) => `<option value="${k}">${l}</option>`)
    .join("")}</select></div>`;

// ---- Pagar nómina: asignaciones del período y deducciones (fija, adelantos, cuota de préstamos, otras)
const filaOtroConcepto = (i) => `<div class="form-row pn-otro" style="margin-bottom:0.4rem">
    <div class="field"><input class="inp" id="pn-otro-n-${i}" placeholder="Concepto (ej: horas extra)" autocomplete="off"/></div>
    <div class="field"><div style="position:relative"><span style="position:absolute;left:0.8rem;top:50%;transform:translateY(-50%);color:#1a9e5c;font-weight:700;font-size:0.8rem">$</span>
      <input class="inp" id="pn-otro-v-${i}" placeholder="0,00" inputmode="decimal" autocomplete="off" style="padding-left:1.8rem" oninput="fmtInput(this);calcNetoNomina()"/></div></div>
  </div>`;
function agregarOtroConcepto() {
  const cont = document.getElementById("pn-otros");
  if (!cont) return;
  const n = cont.querySelectorAll(".pn-otro").length;
  if (n >= 10) {
    alert("Máximo 10 conceptos adicionales por pago");
    return;
  }
  cont.insertAdjacentHTML("beforeend", filaOtroConcepto(n));
  const inp = document.getElementById("pn-otro-n-" + n);
  if (inp) inp.focus();
}
// Lee los conceptos adicionales. Fila vacía = se ignora; con nombre y sin valor (o al revés) = error.
function leerOtrosConceptos() {
  const lista = [];
  let error = "";
  for (let i = 0; ; i++) {
    const elN = document.getElementById("pn-otro-n-" + i),
      elV = document.getElementById("pn-otro-v-" + i);
    if (!elN || !elV) break;
    const nombre = elN.value.trim(),
      monto = parseFmt(elV.value);
    if (nombre && monto > 0) lista.push({ nombre, monto });
    else if (nombre && !monto && !error) error = "Falta el valor del concepto «" + nombre + "»";
    else if (!nombre && monto > 0 && !error) error = "Falta el nombre del concepto de " + fmt(monto);
  }
  return { lista, error };
}
let pnDeducciones = []; // deducciones sugeridas del trabajador (adelantos, préstamos, fija) del formulario abierto
let pnHoras = []; // horas de clase del trabajador: [{concepto, tarifa, horas (sugeridas)}]
let pnDescAuto = "";
function renderModalPagoNomina(m) {
  pnDeducciones = [];
  pnHoras = [];
  pnDescAuto = "";
  const t = trabajadores.find((x) => x.id === (m && m.trabId)) || null;
  const periodo = (m && m.periodo) || periodoSugerido(t);
  return `<div class="modal-bg"><div class="modal">
    <div class="modal-header"><div><h3>💳 Pagar nómina</h3><p>Montos en $ de referencia · se paga en Bs. a la tasa BCV o en $</p></div><button class="modal-close-x" onclick="cerrarModal()">✕</button></div>
    <div class="modal-body">
      <div class="form-grid">
        <div class="field"><label class="field-label">Trabajador *</label>
          <select class="inp" id="pn-trab" onchange="autoFillMontoNomina(this.value)">${opcionesTrabajador(t && t.id)}</select></div>
        ${campoPeriodo("pn", periodo, "autoFillMontoNomina(document.getElementById('pn-trab').value)")}
        <div id="pn-aviso"></div>
        <div class="field"><label class="field-label">Descripción *</label><input class="inp" id="pn-desc" placeholder="Ej: 1ra quincena de Octubre 2026"/></div>
        <div class="form-row">
          <div class="field"><label class="field-label">Fecha de pago *</label><input class="inp" type="date" id="pn-fecha" max="${todayStr()}" value="${todayStr()}" onchange="actualizarTasaCampo('pn',calcNetoNomina)"/></div>
          ${campoMoneda("pn")}
        </div>
        <div class="field-label" style="color:#1a9e5c;margin-top:0.3rem">➕ Asignaciones del período</div>
        <div class="form-row">
          <div class="field"><label class="field-label">Salario base</label>
            <div style="position:relative"><span style="position:absolute;left:1rem;top:50%;transform:translateY(-50%);color:#1a9e5c;font-weight:700">$</span>
            <input class="inp" id="pn-monto" placeholder="0,00" inputmode="decimal" style="padding-left:2rem" oninput="fmtInput(this);calcNetoNomina()"/></div></div>
          <div class="field"><label class="field-label">🍽️ Bono alimentación</label>
            <div style="position:relative"><span style="position:absolute;left:1rem;top:50%;transform:translateY(-50%);color:#1a9e5c;font-weight:700">$</span>
            <input class="inp" id="pn-balim" placeholder="0,00" inputmode="decimal" style="padding-left:2rem" oninput="fmtInput(this);calcNetoNomina()"/></div></div>
        </div>
        <div class="field"><label class="field-label">⭐ Bono productividad</label>
          <div style="position:relative"><span style="position:absolute;left:1rem;top:50%;transform:translateY(-50%);color:#1a9e5c;font-weight:700">$</span>
          <input class="inp" id="pn-bprod" placeholder="0,00" inputmode="decimal" style="padding-left:2rem" oninput="fmtInput(this);calcNetoNomina()"/></div></div>
        <div id="pn-horas"></div>
        <div class="field">
          <label class="field-label">Otros conceptos <span style="font-weight:400;color:#888">(opcional: horas extra, guardias…)</span></label>
          <div id="pn-otros">${[0, 1].map(filaOtroConcepto).join("")}</div>
          <button type="button" class="btn btn-gray btn-sm" onclick="agregarOtroConcepto()">+ Agregar otro concepto</button>
        </div>
        <div class="field-label" style="color:#c0392b;margin-top:0.3rem">➖ Deducciones</div>
        <div id="pn-deds"><div style="font-size:0.78rem;color:#888">Elige el trabajador</div></div>
        <div class="form-row">
          <div class="field"><label class="field-label">Otro descuento ($)</label>
            <div style="position:relative"><span style="position:absolute;left:1rem;top:50%;transform:translateY(-50%);color:#e53e3e;font-weight:700">$</span>
            <input class="inp" id="pn-descuento" placeholder="0,00" inputmode="decimal" style="padding-left:2rem" oninput="fmtInput(this);calcNetoNomina()"/></div></div>
          <div class="field"><label class="field-label">¿Por qué?</label><input class="inp" id="pn-descuento-motivo" placeholder="Ej: inasistencia"/></div>
        </div>
        ${campoTasaHTML("pn", null, "calcNetoNomina()")}
        <div id="pn-neto-box" style="display:none;background:#e8f0fe;border-radius:10px;padding:0.75rem;margin-top:0.25rem">
          <div style="display:flex;justify-content:space-between;font-size:0.82rem;margin-bottom:4px">
            <span style="color:#555">Asignaciones</span><span id="pn-neto-monto" style="color:#1a9e5c;font-weight:700"></span>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:0.82rem;margin-bottom:4px">
            <span style="color:#555">Deducciones</span><span id="pn-neto-desc" style="color:#e53e3e;font-weight:700"></span>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:0.88rem;border-top:1px solid #c5d8f0;padding-top:6px;margin-top:4px">
            <span style="font-weight:700;color:#003366">Neto a entregar (ref.)</span><span id="pn-neto-total" style="font-weight:800;color:#003366;font-size:1rem"></span>
          </div>
          <div id="pn-neto-bs-row" style="display:none;justify-content:space-between;font-size:0.95rem;margin-top:4px">
            <span style="font-weight:700;color:#003366">Total en bolívares</span><span id="pn-neto-bs" style="font-weight:800;color:#003366"></span>
          </div>
        </div>
        <div id="pn-cuenta-campo"></div>
        <div id="pn-err"></div>
        ${casillaDosPorHoja("nomina", "pn-doble")}
      </div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-primary" style="flex:1" onclick="guardarPagoNomina()">✓ Registrar y generar recibo</button>
      <button class="btn btn-gray" onclick="cerrarModal()">Cancelar</button>
    </div>
  </div></div>`;
}
const setValor = (id, v) => {
  const el = document.getElementById(id);
  if (el) el.value = v > 0 ? String(r2(v)).replace(".", ",") : "";
};
// Al elegir trabajador o período: llena lo que le corresponde, sus deducciones y avisa si ese período ya se pagó
function autoFillMontoNomina(trabId) {
  const t = trabajadores.find((w) => w.id === trabId);
  const periodo = leerPeriodo("pn");
  const deds = document.getElementById("pn-deds"),
    aviso = document.getElementById("pn-aviso");
  pnDeducciones = [];
  pnHoras = [];
  if (aviso) aviso.innerHTML = "";
  const horasBox = document.getElementById("pn-horas"),
    cuentaBox = document.getElementById("pn-cuenta-campo");
  if (horasBox) horasBox.innerHTML = "";
  if (cuentaBox) cuentaBox.innerHTML = "";
  if (!t) {
    if (deds) deds.innerHTML = `<div style="font-size:0.78rem;color:#888">Elige el trabajador</div>`;
    return calcNetoNomina();
  }
  const s = sugerenciaPago(t, periodo);
  const de = (c) => (s.asignaciones.find((a) => a.concepto === c) || {}).monto || 0;
  setValor("pn-monto", de("Salario base"));
  setValor("pn-balim", de("Bono alimentación"));
  setValor("pn-bprod", de("Bono productividad"));
  // Horas de clase: las que da normalmente en el período; se cambian por las que trabajó
  pnHoras = s.asignaciones.filter((a) => a.horas);
  if (horasBox && pnHoras.length)
    horasBox.innerHTML = `<label class="field-label">⏱️ Horas trabajadas en el período</label>${pnHoras
      .map(
        (h, i) => `<div class="pn-hora" style="display:flex;gap:0.5rem;align-items:center;margin-bottom:0.35rem">
        <label for="pn-h-${i}" style="flex:1;font-size:0.8rem">${escHtml(h.concepto)} <span style="color:#888">· ${fmt(h.tarifa)} la hora</span></label>
        <div style="position:relative;width:90px"><input class="inp" id="pn-h-${i}" inputmode="decimal" style="padding-right:1.6rem" value="${String(h.horas).replace(".", ",")}" oninput="calcNetoNomina()"/><span style="position:absolute;right:0.6rem;top:50%;transform:translateY(-50%);color:#888;font-size:0.8rem">h</span></div>
        <strong id="pn-h-m-${i}" style="width:72px;text-align:right;font-size:0.82rem;color:#1a9e5c">${fmt(h.monto)}</strong></div>`
      )
      .join("")}`;
  // A qué cuenta se le paga (sale en el recibo)
  const cuentas = cuentasDe(t);
  if (cuentaBox && cuentas.length)
    cuentaBox.innerHTML = `<div class="field"><label class="field-label">🏦 ¿A qué cuenta se le paga?</label><select class="inp" id="pn-cuenta">${cuentas
      .map(
        (c, i) =>
          `<option value="${i}">${escHtml(cuentaCorta(c))}${c.titular ? " · " + escHtml(c.titular) : ""}</option>`
      )
      .join("")}<option value="">Ninguna (efectivo u otra)</option></select></div>`;
  pnDeducciones = s.deducciones;
  if (deds)
    deds.innerHTML = pnDeducciones.length
      ? pnDeducciones
          .map(
            (d, i) => `<div class="pn-ded" style="display:flex;gap:0.5rem;align-items:center;margin-bottom:0.35rem">
        <input type="checkbox" id="pn-ded-on-${i}" checked onchange="calcNetoNomina()"/>
        <label for="pn-ded-on-${i}" style="flex:1;font-size:0.8rem">${d.tipo === "adelanto" ? "💸 " : d.tipo === "prestamo" ? "🤝 " : ""}${escHtml(d.concepto)}${d.saldo ? " (saldo " + fmt(d.saldo) + ")" : ""}</label>
        <div style="position:relative;width:110px"><span style="position:absolute;left:0.6rem;top:50%;transform:translateY(-50%);color:#e53e3e;font-weight:700;font-size:0.8rem">$</span>
          <input class="inp" id="pn-ded-v-${i}" inputmode="decimal" style="padding-left:1.5rem" value="${String(d.monto).replace(".", ",")}" oninput="fmtInput(this);calcNetoNomina()"/></div></div>`
          )
          .join("")
      : `<div style="font-size:0.78rem;color:#888">No tiene adelantos ni préstamos por descontar</div>`;
  const choque = choquePeriodo(t.id, periodo);
  if (aviso && choque.length)
    aviso.innerHTML = `<div class="alert-item alert-mora">⚠️ Ya se le pagó ${choque.map((f) => escHtml(nombrePeriodo(periodoDePago(f)))).join(" y ")}. Revisa el período antes de registrar.</div>`;
  const desc = document.getElementById("pn-desc"),
    auto = nombrePeriodo(periodo) + " — " + t.nombre;
  if (desc && (!desc.value.trim() || desc.value === pnDescAuto)) desc.value = auto;
  pnDescAuto = auto;
  const mon = document.getElementById("pn-moneda");
  if (mon && t.moneda) mon.value = t.moneda;
  calcNetoNomina();
}
// Lo que dice el formulario: asignaciones, deducciones marcadas (con su monto) y el neto
function leerFormNomina() {
  const asignaciones = [
    ["Salario base", "pn-monto"],
    ["Bono alimentación", "pn-balim"],
    ["Bono productividad", "pn-bprod"],
  ]
    .map(([concepto, id]) => ({ concepto, monto: r2(parseFmt((document.getElementById(id) || {}).value || "0")) }))
    .filter((a) => a.monto > 0);
  pnHoras.forEach((h, i) => {
    const horas = r2(numeroCorto((document.getElementById("pn-h-" + i) || {}).value));
    const monto = r2(horas * h.tarifa);
    const el = document.getElementById("pn-h-m-" + i);
    if (el) el.textContent = fmt(monto);
    if (horas > 0) asignaciones.push({ concepto: h.concepto, monto, horas, tarifa: h.tarifa });
  });
  const otros = leerOtrosConceptos();
  otros.lista.forEach((o) => asignaciones.push({ concepto: o.nombre, monto: r2(o.monto) }));
  const deducciones = [];
  pnDeducciones.forEach((d, i) => {
    const on = document.getElementById("pn-ded-on-" + i),
      v = document.getElementById("pn-ded-v-" + i);
    const monto = r2(parseFmt(v ? v.value : "0"));
    if (on && on.checked && monto > 0) {
      const x = { concepto: d.concepto, monto, tipo: d.tipo };
      if (d.ref) x.ref = d.ref;
      deducciones.push(x);
    }
  });
  const otro = r2(parseFmt((document.getElementById("pn-descuento") || {}).value || "0"));
  if (otro > 0)
    deducciones.push({
      concepto: ((document.getElementById("pn-descuento-motivo") || {}).value || "").trim() || "Otro descuento",
      monto: otro,
      tipo: "otra",
    });
  const bruto = sumaDe(asignaciones, "monto"),
    totalDed = sumaDe(deducciones, "monto");
  return { asignaciones, deducciones, bruto, totalDed, neto: r2(bruto - totalDed), errorOtros: otros.error };
}
function calcNetoNomina() {
  const f = leerFormNomina();
  const tasa = parseTasa(document.getElementById("pn-tasa")?.value || "0");
  const box = document.getElementById("pn-neto-box");
  if (!box) return;
  if (!(f.bruto > 0)) {
    box.style.display = "none";
    return;
  }
  box.style.display = "block";
  document.getElementById("pn-neto-monto").textContent = fmt(f.bruto);
  document.getElementById("pn-neto-desc").textContent = f.totalDed > 0 ? "- " + fmt(f.totalDed) : fmt(0);
  document.getElementById("pn-neto-total").textContent = fmt(f.neto);
  const rb = document.getElementById("pn-neto-bs-row");
  rb.style.display = tasa > 0 ? "flex" : "none";
  document.getElementById("pn-neto-bs").textContent = tasa > 0 ? fmtBs(r2(f.neto * tasa)) : "";
}
// Validación común de fecha y tasa de los movimientos de nómina
function revisarFechaTasa(pref, fecha, tasa, err) {
  if (!fecha) return (err("Elige la fecha"), false);
  if (!(tasa > 0)) return (err("Falta la tasa BCV: cárgala con 💱 (arriba) o escríbela en el formulario"), false);
  const errFecha = revisarFechaMovimiento(fecha);
  if (errFecha === "cancelado") return false;
  if (errFecha) return (err(errFecha), false);
  return true;
}
async function guardarMovNomina(datos, pref, fecha, tasa) {
  const ref = await db.collection("finanzas").add(datos);
  datos.id = ref.id;
  ponerEnLista(finanzas, datos);
  aplicarTasaEditada(pref, fecha, tasa);
  return datos;
}
async function guardarPagoNomina() {
  const err = (m) => mostrarError("pn-err", m);
  const trab = trabajadores.find((t) => t.id === document.getElementById("pn-trab").value);
  const periodo = leerPeriodo("pn");
  const desc = document.getElementById("pn-desc").value.trim();
  const fecha = document.getElementById("pn-fecha").value;
  const tasa = parseTasa(document.getElementById("pn-tasa") ? document.getElementById("pn-tasa").value : "0");
  if (!trab) return err("Elige el trabajador");
  if (!periodo) return err("Elige el período (quincena o mes)");
  const f = leerFormNomina();
  if (f.errorOtros) return err(f.errorOtros);
  if (!desc || !(f.bruto > 0)) return err("Completa la descripción y lo que se le paga");
  if (f.neto < -0.004)
    return err("Las deducciones (" + fmt(f.totalDed) + ") pasan de lo que se le paga (" + fmt(f.bruto) + ")");
  // Una cuota no puede pasar del saldo del préstamo
  const pres = f.deducciones.find(
    (d) =>
      d.tipo === "prestamo" && d.monto > ((pnDeducciones.find((x) => x.ref === d.ref) || {}).saldo || Infinity) + 0.004
  );
  if (pres) return err("La cuota de préstamo pasa de lo que debe");
  if (!revisarFechaTasa("pn", fecha, tasa, err)) return;
  const choque = choquePeriodo(trab.id, periodo);
  if (
    choque.length &&
    !confirm(
      "⚠️ A " +
        trab.nombre +
        " ya se le pagó " +
        choque.map((x) => nombrePeriodo(periodoDePago(x))).join(" y ") +
        ".\n¿Registrar este pago de todos modos?"
    )
  )
    return;
  const neto = Math.max(0, f.neto);
  const datos = {
    tipo: "gasto",
    descripcion: desc,
    fecha,
    categoria: "Nómina",
    monto: neto,
    montoBs: r2(neto * tasa),
    tasa,
    moneda: document.getElementById("pn-moneda").value === "USD" ? "USD" : "VES",
    responsable: trab.nombre,
    trabajadorId: trab.id,
    nomina: { tipo: "pago", periodo, asignaciones: f.asignaciones, deducciones: f.deducciones, bruto: f.bruto },
    registradoPor: correoUsuario(),
    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
  };
  const cuenta = cuentasDe(trab)[Number((document.getElementById("pn-cuenta") || {}).value)];
  if (cuenta && (document.getElementById("pn-cuenta") || {}).value !== "")
    datos.cuentaPago = { banco: cuenta.banco, tipo: cuenta.tipo, numero: cuenta.numero };
  try {
    await guardarMovNomina(datos, "pn", fecha, tasa);
    alertaPagoNomina(datos.descripcion, datos.monto, datos.responsable);
    cerrarModal();
    mostrarExito("¡Pago de nómina registrado!", fmt(datos.monto) + " · " + datos.responsable);
    imprimirReciboNomina(null, datos.id);
  } catch (e) {
    err(e.message);
  }
}

// ---- Adelanto de quincena: dinero que se entrega antes; se descuenta solo en el pago de ese período
function renderModalAdelantoNomina(m) {
  const t = trabajadores.find((x) => x.id === (m && m.trabId)) || null;
  return `<div class="modal-bg"><div class="modal">
    <div class="modal-header"><div><h3>💸 Adelanto de quincena</h3><p>Se descuenta solo cuando le pagues ese período</p></div><button class="modal-close-x" onclick="cerrarModal()">✕</button></div>
    <div class="modal-body"><div class="form-grid">
      <div class="field"><label class="field-label">Trabajador *</label><select class="inp" id="ad-trab" onchange="infoAdelanto()">${opcionesTrabajador(t && t.id)}</select></div>
      ${campoPeriodo("ad", periodoSugerido(t), "infoAdelanto()")}
      <div class="form-row">
        <div class="field"><label class="field-label">Monto ($) *</label>${campoDolar("ad-monto", "", "0,00", "#b8860b")}</div>
        ${campoMoneda("ad")}
      </div>
      <div class="field"><label class="field-label">Fecha *</label><input class="inp" type="date" id="ad-fecha" max="${todayStr()}" value="${todayStr()}" onchange="actualizarTasaCampo('ad')"/></div>
      ${campoTasaHTML("ad", null, "")}
      <div id="ad-info"></div>
      <div id="ad-err"></div>
    </div></div>
    <div class="modal-actions">
      <button class="btn btn-primary" style="flex:1" onclick="guardarAdelantoNomina()">✓ Registrar adelanto</button>
      <button class="btn btn-gray" onclick="cerrarModal()">Cancelar</button>
    </div>
  </div></div>`;
}
// Cuánto le toca en ese período y cuánto ya se le adelantó
function infoAdelanto() {
  const t = trabajadores.find((x) => x.id === (document.getElementById("ad-trab") || {}).value);
  const out = document.getElementById("ad-info");
  if (!out) return;
  if (!t) return (out.innerHTML = "");
  const p = leerPeriodo("ad"),
    x = partesPeriodo(p);
  const toca = r2(netoMensual(t) * fraccionPeriodo(x ? x.tipo : "M"));
  const ya = sumaDe(
    adelantosPendientes(t.id).filter((a) => a.periodo === p),
    "pendiente"
  );
  out.innerHTML = `<div class="alert-item alert-info">En ${escHtml(nombrePeriodo(p))} le corresponden <strong>${fmt(toca)}</strong> netos${ya > 0 ? ` · ya se le adelantaron <strong>${fmt(ya)}</strong>` : ""} · puede adelantarse hasta <strong>${fmt(Math.max(0, r2(toca - ya)))}</strong>.</div>`;
}
async function guardarAdelantoNomina() {
  const err = (m) => mostrarError("ad-err", m);
  const t = trabajadores.find((x) => x.id === document.getElementById("ad-trab").value);
  const periodo = leerPeriodo("ad");
  const monto = r2(parseFmt(document.getElementById("ad-monto").value));
  const fecha = document.getElementById("ad-fecha").value;
  const tasa = parseTasa(document.getElementById("ad-tasa").value || "0");
  if (!t) return err("Elige el trabajador");
  if (!periodo) return err("Elige a cuenta de qué período es");
  if (!(monto > 0)) return err("Escribe el monto del adelanto");
  if (!revisarFechaTasa("ad", fecha, tasa, err)) return;
  const x = partesPeriodo(periodo),
    toca = r2(netoMensual(t) * fraccionPeriodo(x.tipo));
  const ya = sumaDe(
    adelantosPendientes(t.id).filter((a) => a.periodo === periodo),
    "pendiente"
  );
  if (
    monto > toca - ya + 0.004 &&
    !confirm(
      "⚠️ El adelanto pasa de lo que le corresponde en " +
        nombrePeriodo(periodo) +
        " (" +
        fmt(Math.max(0, r2(toca - ya))) +
        "). ¿Registrarlo de todos modos?"
    )
  )
    return;
  const datos = {
    tipo: "gasto",
    descripcion: "Adelanto de " + nombrePeriodo(periodo) + " — " + t.nombre,
    fecha,
    categoria: "Nómina",
    monto,
    montoBs: r2(monto * tasa),
    tasa,
    moneda: document.getElementById("ad-moneda").value === "USD" ? "USD" : "VES",
    responsable: t.nombre,
    trabajadorId: t.id,
    nomina: { tipo: "adelanto", periodo },
    registradoPor: correoUsuario(),
    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
  };
  try {
    await guardarMovNomina(datos, "ad", fecha, tasa);
    cerrarModal();
    mostrarExito("¡Adelanto registrado!", fmt(monto) + " · " + t.nombre);
    imprimirReciboNomina(null, datos.id);
  } catch (e) {
    err(e.message);
  }
}

// ---- Préstamo al personal: sale aparte de la nómina y se cobra por cuotas en cada pago
function renderModalPrestamoNomina(m) {
  const t = trabajadores.find((x) => x.id === (m && m.trabId)) || null;
  return `<div class="modal-bg"><div class="modal">
    <div class="modal-header"><div><h3>🤝 Préstamo al trabajador</h3><p>Se descuenta una cuota en cada pago de nómina hasta saldarlo</p></div><button class="modal-close-x" onclick="cerrarModal()">✕</button></div>
    <div class="modal-body"><div class="form-grid">
      <div class="field"><label class="field-label">Trabajador *</label><select class="inp" id="pr-trab" onchange="infoPrestamo()">${opcionesTrabajador(t && t.id)}</select></div>
      <div class="form-row">
        <div class="field"><label class="field-label">Monto prestado ($) *</label>${campoDolar("pr-monto", "", "0,00", "#c0392b").replace('inputmode="decimal"', 'inputmode="decimal" oninput="infoPrestamo()"')}</div>
        <div class="field"><label class="field-label">Cuota por pago ($) *</label>${campoDolar("pr-cuota", "", "0,00", "#c0392b").replace('inputmode="decimal"', 'inputmode="decimal" oninput="infoPrestamo()"')}</div>
      </div>
      <div class="field"><label class="field-label">Motivo</label><input class="inp" id="pr-motivo" placeholder="Ej: gastos médicos"/></div>
      <div class="form-row">
        <div class="field"><label class="field-label">Fecha *</label><input class="inp" type="date" id="pr-fecha" max="${todayStr()}" value="${todayStr()}" onchange="actualizarTasaCampo('pr')"/></div>
        ${campoMoneda("pr")}
      </div>
      ${campoTasaHTML("pr", null, "")}
      <div id="pr-info"></div>
      <div id="pr-err"></div>
    </div></div>
    <div class="modal-actions">
      <button class="btn btn-primary" style="flex:1" onclick="guardarPrestamoNomina()">✓ Registrar préstamo</button>
      <button class="btn btn-gray" onclick="cerrarModal()">Cancelar</button>
    </div>
  </div></div>`;
}
function infoPrestamo() {
  const out = document.getElementById("pr-info");
  if (!out) return;
  const t = trabajadores.find((x) => x.id === (document.getElementById("pr-trab") || {}).value);
  const monto = r2(parseFmt((document.getElementById("pr-monto") || {}).value || "0")),
    cuota = r2(parseFmt((document.getElementById("pr-cuota") || {}).value || "0"));
  const partes = [];
  if (monto > 0 && cuota > 0) {
    const n = Math.ceil(monto / cuota - 1e-9);
    partes.push(
      `Se descontarán <strong>${fmt(cuota)}</strong> en cada pago: <strong>${n} ${n === 1 ? "pago" : "pagos"}</strong>${t ? " (" + (t.frecuencia === "mensual" ? "unos " + n + " meses" : "unos " + Math.ceil(n / 2) + " meses") + ")" : ""}.`
    );
    if (t && cuota > r2(netoMensual(t) * fraccionPeriodo(t.frecuencia === "mensual" ? "M" : "Q1")))
      partes.push("⚠️ La cuota pasa de lo que cobra en cada pago.");
  }
  if (t) {
    const debe = sumaDe(prestamosDe(t.id), "saldo");
    if (debe > 0) partes.push("Ya debe " + fmt(debe) + " de otro préstamo.");
  }
  out.innerHTML = partes.length ? `<div class="alert-item alert-info">${partes.join(" ")}</div>` : "";
}
async function guardarPrestamoNomina() {
  const err = (m) => mostrarError("pr-err", m);
  const t = trabajadores.find((x) => x.id === document.getElementById("pr-trab").value);
  const monto = r2(parseFmt(document.getElementById("pr-monto").value)),
    cuota = r2(parseFmt(document.getElementById("pr-cuota").value));
  const motivo = document.getElementById("pr-motivo").value.trim();
  const fecha = document.getElementById("pr-fecha").value;
  const tasa = parseTasa(document.getElementById("pr-tasa").value || "0");
  if (!t) return err("Elige el trabajador");
  if (!(monto > 0)) return err("Escribe el monto prestado");
  if (!(cuota > 0)) return err("Escribe la cuota que se le descontará en cada pago");
  if (cuota > monto) return err("La cuota no puede pasar del monto prestado");
  if (!revisarFechaTasa("pr", fecha, tasa, err)) return;
  const datos = {
    tipo: "gasto",
    descripcion: "Préstamo" + (motivo ? " (" + motivo + ")" : "") + " — " + t.nombre,
    fecha,
    categoria: CATEGORIA_PRESTAMOS,
    monto,
    montoBs: r2(monto * tasa),
    tasa,
    moneda: document.getElementById("pr-moneda").value === "USD" ? "USD" : "VES",
    responsable: t.nombre,
    trabajadorId: t.id,
    nomina: { tipo: "prestamo", cuota, motivo },
    registradoPor: correoUsuario(),
    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
  };
  try {
    await guardarMovNomina(datos, "pr", fecha, tasa);
    cerrarModal();
    mostrarExito("¡Préstamo registrado!", fmt(monto) + " · " + t.nombre);
    imprimirReciboNomina(null, datos.id);
  } catch (e) {
    err(e.message);
  }
}

// Al abrir un formulario de nómina con el trabajador ya elegido (desde su ficha o la nómina del mes)
function prepararModalNomina(m) {
  if (m.tipo === "pago-nomina" && m.trabId) autoFillMontoNomina(m.trabId);
  if (m.tipo === "adelanto-nomina") infoAdelanto();
  if (m.tipo === "prestamo-nomina") infoPrestamo();
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
