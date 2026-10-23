// Nómina: recibos de pago, adelanto y préstamo (uno o dos por hoja). Ver vistas/nomina.js.

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
