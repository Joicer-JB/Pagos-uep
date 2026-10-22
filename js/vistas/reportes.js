// Pestaña Reportes: tablero financiero, recaudo por concepto y por fecha, mora y estado general.

function renderReportes() {
  const anio = anioActual();
  const totalPagos = pagos.reduce((s, p) => s + p.total, 0);
  const tm = totalesMetodo(pagos);
  // Los gastos ya incluyen lo pagado en nómina (cada pago de nómina es un gasto en Finanzas)
  const totalGastos = finanzas.filter((f) => f.tipo === "gasto").reduce((s, f) => s + f.monto, 0);
  const mora = estudiantes.filter(enMora);

  const porConcepto = pagos.reduce((acc, p) => {
    const k = p.concepto || "Otro";
    acc[k] = (acc[k] || 0) + p.total;
    return acc;
  }, {});
  const porFecha = pagos.reduce((acc, p) => {
    if (!acc[p.fecha]) acc[p.fecha] = [];
    acc[p.fecha].push(p);
    return acc;
  }, {});
  const ultFechas = Object.keys(porFecha)
    .sort((a, b) => b.localeCompare(a))
    .slice(0, 6);

  return `
  ${htmlTableroFinanciero()}
  ${htmlSimulador()}
  <div class="stats-grid">
    <div class="stat-card green"><div class="stat-val">${fmt(totalPagos)}</div><div class="stat-label">💰 Total Recaudado</div></div>
    <div class="stat-card red"><div class="stat-val">${fmt(totalGastos)}</div><div class="stat-label">📉 Total Gastos (con la nómina pagada)</div></div>
    <div class="stat-card"><div class="stat-val">${fmt(tm["Dólares Efectivo"].usd)}</div><div class="stat-label">💵 $ Efectivo</div></div>
    <div class="stat-card blue"><div class="stat-val" style="font-size:0.95rem">${fmtBs(tm["Transferencia Bs"].bs)}</div><div class="stat-label">📲 Transf Bs · ${fmt(tm["Transferencia Bs"].usd)}${tm["Transferencia Bs"].sinTasa ? " ⚠️" : ""}</div></div>
    <div class="stat-card green"><div class="stat-val" style="font-size:0.95rem">${fmtBs(tm["Bs Efectivo"].bs)}</div><div class="stat-label">💵 Bs Efectivo · ${fmt(tm["Bs Efectivo"].usd)}${tm["Bs Efectivo"].sinTasa ? " ⚠️" : ""}</div></div>
    <div class="stat-card blue"><div class="stat-val" style="font-size:0.95rem">${fmtBs(tm["Punto"].bs)}</div><div class="stat-label">💳 Punto · ${fmt(tm["Punto"].usd)}${tm["Punto"].sinTasa ? " ⚠️" : ""}</div></div>
  </div>
  <div class="card">
    <div class="card-title"><div class="card-bar"></div><h2>⚠️ Estudiantes en Mora (${mora.length})</h2></div>
    ${
      mora.length === 0
        ? '<p style="font-size:0.82rem;color:#aaa">Sin estudiantes en mora ✅</p>'
        : mora
            .map(
              (e) =>
                `<div class="info-row"><div><span style="font-weight:700;color:#e53e3e">${escHtml(e.nombre)}</span><div style="font-size:0.72rem;color:#888">${escHtml(e.moraConcepto) || "Sin detalle"}</div></div><span style="font-weight:800;color:#e53e3e">${fmt(deudaDe(e))}</span></div>`
            )
            .join("")
    }
    ${mora.length > 0 ? `<div style="margin-top:0.5rem;padding:0.6rem 0.85rem;background:#fff5f5;border-radius:8px;display:flex;justify-content:space-between"><span style="font-size:0.82rem;color:#e53e3e;font-weight:700">Total en mora:</span><span style="font-weight:800;color:#e53e3e">${fmt(mora.reduce((s, e) => s + deudaDe(e), 0))}</span></div>` : ""}
  </div>
  <div class="card">
    <div class="card-title"><div class="card-bar"></div><h2>Recaudo por Concepto</h2></div>
    ${
      Object.entries(porConcepto)
        .sort((a, b) => b[1] - a[1])
        .map(
          ([k, v]) => `
    <div style="margin-bottom:0.6rem">
      <div style="display:flex;justify-content:space-between;font-size:0.82rem;margin-bottom:3px">
        <span style="color:#333">📌 ${escHtml(k)}</span><span style="font-weight:700;color:#003366">${fmt(v)}</span>
      </div>
      <div class="progress-bar"><div class="progress-fill" style="width:${totalPagos > 0 ? Math.round((v / totalPagos) * 100) : 0}%"></div></div>
    </div>`
        )
        .join("") || '<p style="font-size:0.82rem;color:#aaa">Sin datos</p>'
    }
  </div>
  <div class="card">
    <div class="card-title"><div class="card-bar"></div><h2>Recaudo por Fecha (últimas)</h2></div>
    ${
      ultFechas
        .map((f) => {
          const tot = porFecha[f].reduce((s, p) => s + p.total, 0);
          return `<div class="info-row"><span style="color:#003366;font-weight:600">${f}</span><div style="text-align:right"><span style="font-weight:700">${fmt(tot)}</span><div style="font-size:0.68rem;color:#888">${porFecha[f].length} recibos</div></div></div>`;
        })
        .join("") || '<p style="font-size:0.82rem;color:#aaa">Sin datos</p>'
    }
  </div>
  <div class="card">
    <div class="card-title"><div class="card-bar"></div><h2>Estado General Estudiantes</h2></div>
    ${[
      ["Al Saldo", "#1a9e5c", estudiantes.filter((e) => !enMora(e) && activo(e)).length],
      ["En Mora", "#e53e3e", mora.length],
      ["Retirados", "#888", estudiantes.filter((e) => e.estado === "retirado").length],
      ["Graduados", "#b8860b", estudiantes.filter((e) => e.graduado).length],
    ]
      .map(
        ([l, c, n]) => `
    <div class="info-row"><span style="color:${c};font-weight:600">● ${l}</span><span style="font-weight:700">${n} estudiantes</span></div>`
      )
      .join("")}
  </div>
`;
}

// ---- Tablero financiero (ver servicios/indicadores.js)
const pctTxt = (p) => (p == null ? "—" : Math.round(p * 100) + " %");
const colorPct = (p) => (p == null ? "#888" : p >= 0.9 ? "#1a9e5c" : p >= 0.7 ? "#b8860b" : "#e53e3e");
const barra = (p, color) =>
  `<div class="progress-bar"><div class="progress-fill" style="width:${Math.round(Math.min(1, p || 0) * 100)}%;background:${color}"></div></div>`;
const filaTab = (izq, der, sub) =>
  `<div class="info-row"><div><span style="color:#333">${izq}</span>${sub ? `<div style="font-size:0.7rem;color:#888">${sub}</div>` : ""}</div><span style="font-weight:700;color:#003366;text-align:right;white-space:nowrap;margin-left:0.5rem">${der}</span></div>`;
function htmlTableroFinanciero() {
  const t = indicadoresFinancieros();
  const titulo = (txt) => `<div class="card-title"><div class="card-bar"></div><h2>${txt}</h2></div>`;
  if (!t)
    return soloLectura()
      ? ""
      : `<div class="card tablero-financiero">${titulo("🧮 Tablero financiero")}<div class="alert-item alert-info">Configura las cuotas del año en 🔔 Cobranza → ⚙️ Cuotas del año para ver la cobranza, la deuda por antigüedad, la proyección y el punto de equilibrio.</div></div>`;
  const anio = escCfg && escCfg.actual ? " · " + escHtml(escCfg.actual.nombre) : "";
  const deudaTotal = r2(t.tramos.reduce((s, x) => s + x.monto, 0));
  const eq = t.equilibrio,
    margen = (v) =>
      `<strong style="color:${v >= 0 ? "#1a9e5c" : "#e53e3e"}">${v >= 0 ? "sobran " + fmt(v) : "faltan " + fmt(-v)}</strong>`;
  const pagaran = t.indice == null ? null : Math.floor(eq.estudiantes * t.indice + 1e-9);
  return `
  <div class="card tablero-financiero">
    ${titulo("🧮 Tablero financiero" + anio)}
    <div class="stats-grid" style="margin-bottom:0.4rem">
      <div class="stat-card ${t.indice == null ? "" : t.indice >= 0.9 ? "green" : t.indice >= 0.7 ? "" : "red"}"><div class="stat-val">${pctTxt(t.indice)}</div><div class="stat-label">📈 Índice de cobranza (de lo vencido)</div></div>
      <div class="stat-card green"><div class="stat-val">${fmt(t.cobrado)}</div><div class="stat-label">💰 Cobrado de ${fmt(t.esperado)}</div></div>
      <div class="stat-card red"><div class="stat-val">${fmt(t.vencido)}</div><div class="stat-label">⏳ Vencido sin cobrar</div></div>
      <div class="stat-card blue"><div class="stat-val">${fmt(t.porVencer)}</div><div class="stat-label">📅 Por vencer</div></div>
    </div>
    <div style="font-size:0.7rem;color:#888">Solo inscripciones y mensualidades de los estudiantes activos (los uniformes, recargos y otros cobros no cuentan).</div>
  </div>
  <div class="card tablero-mes">
    ${titulo("📅 Cobranza por mes")}
    ${[
      ...(t.inscripcion.esperado > 0
        ? [
            {
              etq: "Inscripción",
              esperado: t.inscripcion.esperado,
              cobrado: t.inscripcion.cobrado,
              pct: t.inscripcion.pct,
              sub: "",
            },
          ]
        : []),
      ...t.porMes.map((m) => ({
        etq: m.mes,
        esperado: m.esperado,
        cobrado: m.cobrado,
        pct: m.pct,
        sub: m.vencido ? "" : "en curso · vence " + fechaCorta(m.vence),
      })),
    ]
      .map(
        (m) => `<div style="margin-bottom:0.6rem">
      <div style="display:flex;justify-content:space-between;gap:0.5rem;font-size:0.82rem;margin-bottom:3px">
        <span style="color:#333">${escHtml(m.etq)}${m.sub ? ` <span style="font-size:0.7rem;color:#888">(${m.sub})</span>` : ""}</span>
        <span><strong style="color:#003366">${fmt(m.cobrado)}</strong> <span style="color:#888">de ${fmt(m.esperado)}</span> · <strong style="color:${colorPct(m.pct)}">${pctTxt(m.pct)}</strong></span></div>
      ${barra(m.pct, colorPct(m.pct))}</div>`
      )
      .join("")}
  </div>
  <div class="card tablero-deuda">
    ${titulo("⏳ Antigüedad de la deuda")}
    ${t.tramos
      .map(
        (x) => `<div style="margin-bottom:0.55rem">
      <div style="display:flex;justify-content:space-between;font-size:0.82rem;margin-bottom:3px"><span style="color:#333">${x.etiqueta} <span style="font-size:0.7rem;color:#888">· ${x.estudiantes} ${x.estudiantes === 1 ? "estudiante" : "estudiantes"}</span></span><strong style="color:${x.monto > 0 ? "#e53e3e" : "#1a9e5c"}">${fmt(x.monto)}</strong></div>
      ${barra(deudaTotal > 0 ? x.monto / deudaTotal : 0, x.clave === "1-30" ? "#b8860b" : "#e53e3e")}</div>`
      )
      .join("")}
    ${t.recargos > 0 ? filaTab("Recargos por mora pendientes", fmt(t.recargos)) : ""}
    ${t.deudaAnterior > 0 ? filaTab("Deuda de años anteriores", fmt(t.deudaAnterior)) : ""}
    ${
      t.prioridad.length
        ? `<div class="field-label" style="margin-top:0.7rem">📞 Cobrar primero (lo más atrasado)</div>
      ${t.prioridad.map((d) => filaTab(`<strong>${escHtml(d.nombre)}</strong>`, fmt(d.monto), escHtml(d.grado) + " · " + d.dias + (d.dias === 1 ? " día" : " días") + " de atraso")).join("")}`
        : `<div style="font-size:0.82rem;color:#1a9e5c;margin-top:0.4rem">✅ Nadie tiene cuotas vencidas sin pagar</div>`
    }
  </div>
  <div class="card tablero-proyeccion">
    ${titulo("📈 Proyección del año")}
    ${filaTab("Si todos pagan todo el año", fmt(t.proyeccion.siTodosPagan))}
    ${filaTab("Cobrado hasta hoy", fmt(t.cobrado) + " · " + pctTxt(t.esperado > 0 ? t.cobrado / t.esperado : null))}
    ${t.proyeccion.estimado != null ? filaTab("Al cierre, con la cobranza actual (" + pctTxt(t.indice) + ")", "≈ " + fmt(t.proyeccion.estimado), "lo cobrado + lo que falta por vencer al ritmo de hoy") : ""}
    ${filaTab("Vencido por recuperar", fmt(t.vencido), "cada dólar que se recupere se suma a la proyección")}
  </div>
  <div class="card tablero-equilibrio">
    ${titulo("⚖️ Punto de equilibrio (por mes)")}
    ${filaTab("Nómina", fmt(eq.nomina), eq.nominaDe === "personal" ? "según el personal registrado (Nómina)" : "promedio pagado por mes este año")}
    ${filaTab("Otros gastos", fmt(eq.otrosGastos), "promedio por mes este año (" + eq.meses + (eq.meses === 1 ? " mes" : " meses") + ")")}
    ${filaTab("<strong>Costos del mes</strong>", fmt(eq.costoMes))}
    ${filaTab("Mensualidades si todos pagan", fmt(eq.ingresoMes), eq.estudiantes + " estudiantes · " + margen(r2(eq.ingresoMes - eq.costoMes)))}
    ${eq.ingresoReal != null ? filaTab("Con la cobranza actual (" + pctTxt(t.indice) + ")", fmt(eq.ingresoReal), margen(r2(eq.ingresoReal - eq.costoMes))) : ""}
    ${
      eq.necesarios != null && eq.costoMes > 0
        ? `<div class="alert-item ${pagaran == null || pagaran >= eq.necesarios ? "alert-info" : "alert-mora"}" style="margin-top:0.6rem"><div>${
            eq.necesarios > eq.estudiantes
              ? `⚠️ Aunque todos paguen, las mensualidades no cubren los costos del mes: harían falta <strong>${eq.necesarios}</strong> estudiantes pagando (mensualidad promedio ${fmt(eq.promedio)}) y hay ${eq.estudiantes}.`
              : `Para cubrir los costos del mes deben pagar al menos <strong>${eq.necesarios} de ${eq.estudiantes}</strong> estudiantes (mensualidad promedio ${fmt(eq.promedio)}).${pagaran != null ? ` Con la cobranza actual pagan unos <strong>${pagaran}</strong>: ${pagaran >= eq.necesarios ? "✅ se cubren." : "⚠️ no alcanza."}` : ""}`
          }</div></div>`
        : eq.costoMes > 0
          ? ""
          : `<div style="font-size:0.75rem;color:#888;margin-top:0.4rem">Registra la nómina del personal o los gastos en 📒 Finanzas para calcular el punto de equilibrio.</div>`
    }
  </div>`;
}

// ---- 🧮 Simulador de mensualidad (con los costos y la cobranza del tablero financiero)
const simulador = { aumento: 10, cobranza: null, retiro: 0, aumentoNomina: 0 };
function htmlSimulador() {
  const t = indicadoresFinancieros();
  if (!t || !(t.equilibrio.estudiantes > 0)) return "";
  if (simulador.cobranza == null) simulador.cobranza = t.indice == null ? 100 : Math.round(t.indice * 100);
  const campo = (k, etiqueta, ayuda) =>
    `<div class="field"><label class="field-label">${etiqueta}</label><div style="position:relative"><input class="inp" id="sim-${k}" inputmode="decimal" value="${simulador[k]}" oninput="simulador.${k}=numeroSim(this.value);pintarSimulador()" style="padding-right:2rem"/><span style="position:absolute;right:0.8rem;top:50%;transform:translateY(-50%);color:#888">%</span></div><div style="font-size:0.68rem;color:#888;margin-top:2px">${ayuda}</div></div>`;
  return `<div class="card simulador">
    <div class="card-title"><div class="card-bar"></div><h2>🧮 Simulador de mensualidad</h2></div>
    <div style="font-size:0.75rem;color:#666;margin-bottom:0.5rem">¿Qué pasa con el mes si sube la mensualidad? Parte de los costos y la cobranza de este año (tablero de arriba).</div>
    <div class="form-row">
      ${campo("aumento", "Aumento de la mensualidad", "Mensualidad promedio hoy: " + fmt(t.equilibrio.promedio))}
      ${campo("cobranza", "¿Cuántos pagan?", "Hoy pagan el " + (t.indice == null ? "—" : Math.round(t.indice * 100) + " %"))}
    </div>
    <div class="form-row">
      ${campo("retiro", "Estudiantes que se irían", "Por el aumento (estimado)")}
      ${campo("aumentoNomina", "Aumento de la nómina", "Si también sube el sueldo del personal")}
    </div>
    <div id="sim-res">${htmlResultadoSimulador(t)}</div>
  </div>`;
}
const numeroSim = (v) =>
  Number(
    String(v || "")
      .replace(",", ".")
      .replace(/[^\d.-]/g, "")
  ) || 0;
function pintarSimulador() {
  const t = indicadoresFinancieros(),
    out = document.getElementById("sim-res");
  if (t && out) out.innerHTML = htmlResultadoSimulador(t);
}
function htmlResultadoSimulador(t) {
  const eq = t.equilibrio,
    r = simularMensualidad(eq, simulador);
  const fila = (l, v, nota) =>
    `<div class="info-row"><span style="color:#555">${l}${nota ? `<div style="font-size:0.68rem;color:#999">${nota}</div>` : ""}</span><span style="font-weight:700;text-align:right">${v}</span></div>`;
  const color = (v) =>
    `<span style="color:${v >= 0 ? "#1a9e5c" : "#e53e3e"}">${v >= 0 ? "sobran " + fmt(v) : "faltan " + fmt(-v)}</span>`;
  const meses = (cobCfg && cobCfg.cuotas) || 10;
  return `
    ${fila("Nueva mensualidad promedio", fmt(r.promedio), "antes " + fmt(r.actual.promedio))}
    ${fila("Estudiantes que pagarían", r.estudiantes + " de " + eq.estudiantes + " · el " + simulador.cobranza + " % al día")}
    ${fila("Entraría al mes", fmt(r.cobrado), (r.diferencia >= 0 ? "+" : "−") + fmt(Math.abs(r.diferencia)) + " que hoy")}
    ${fila("Costos del mes", fmt(r.costo), "nómina " + fmt(r.nomina) + " + otros gastos " + fmt(eq.otrosGastos))}
    ${fila("<strong>Resultado del mes</strong>", color(r.margen), "hoy: " + (r.actual.margen >= 0 ? "sobran " : "faltan ") + fmt(Math.abs(r.actual.margen)))}
    ${fila("En el año escolar (" + meses + " cuotas)", color(r2(r.margen * meses)))}
    <div class="alert-item ${r.margen >= 0 ? "alert-info" : "alert-mora"} sim-conclusion" style="margin-top:0.5rem"><div>${
      r.margen >= 0
        ? `✅ Con este aumento se cubren los costos del mes${r.cubreNomina ? " y la nómina" : ""}.`
        : `⚠️ Con este aumento no alcanza${r.cubreNomina ? " para todos los costos (la nómina sí se cubre)" : ", ni siquiera para la nómina"}.`
    }${r.equilibrio != null ? ` Para cubrir los costos, la mensualidad promedio debería ser <strong>${fmt(r.equilibrio)}</strong>${r.aumentoNecesario != null ? ` (${r.aumentoNecesario > 0 ? "un aumento del " + String(r.aumentoNecesario).replace(".", ",") + " %" : "no hace falta aumentar"})` : ""}.` : ""}</div></div>`;
}
