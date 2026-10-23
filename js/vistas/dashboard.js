// Pestaña Inicio: resumen del mes, estudiantes en mora, accesos rápidos y nómina (director); lo cobrado hoy y
// por cobrar (administradora).

function renderDashboard() {
  if (rolUsuario === "administradora") return renderDashboardCaja();
  const mesNom = MESES[mesActual()];
  const anio = anioActual();
  const pagosMes = pagos.filter(
    (p) => p.fecha && p.fecha.startsWith(`${anio}-${String(mesActual() + 1).padStart(2, "0")}`)
  );
  const ingresosMes = finanzas.filter(
    (f) => f.tipo === "ingreso" && f.fecha && f.fecha.startsWith(`${anio}-${String(mesActual() + 1).padStart(2, "0")}`)
  );
  const gastosMes = finanzas.filter(
    (f) => f.tipo === "gasto" && f.fecha && f.fecha.startsWith(`${anio}-${String(mesActual() + 1).padStart(2, "0")}`)
  );
  const totalIngresos = pagosMes.reduce((s, p) => s + p.total, 0) + ingresosMes.reduce((s, f) => s + f.monto, 0);
  const totalGastos = gastosMes.reduce((s, f) => s + f.monto, 0);
  const balance = totalIngresos - totalGastos;
  const mora = estudiantes.filter(enMora);
  const totalNomina = r2(trabajadoresActivos().reduce((s, t) => s + devengadoMensual(t), 0)); // al mes

  return `${htmlBarraBuscar()}
  ${htmlAvisoRespaldo()}
  ${htmlAvisoQuincenal()}
  <div style="background:linear-gradient(135deg,#003366,#00509e);border-radius:14px;padding:1.1rem 1.25rem;color:#fff;margin-bottom:0.85rem">
    <div style="font-size:0.65rem;color:#adc8ff;text-transform:uppercase;letter-spacing:1px">Resumen del mes</div>
    <div style="font-size:1.5rem;font-weight:800;font-family:Georgia,serif;color:#ffd700">${mesNom} ${anio}</div>
    <div style="display:flex;gap:1.5rem;margin-top:0.65rem">
      <div><div style="font-size:0.62rem;color:#adc8ff">Ingresos</div><div style="font-weight:800;color:#7fff9f">${fmt(totalIngresos)}</div></div>
      <div><div style="font-size:0.62rem;color:#adc8ff">Gastos</div><div style="font-weight:800;color:#ffaaaa">${fmt(totalGastos)}</div></div>
      <div><div style="font-size:0.62rem;color:#adc8ff">Balance</div><div style="font-weight:800;color:${balance >= 0 ? "#ffd700" : "#ff6b6b"}">${fmt(balance)}</div></div>
    </div>
  </div>

  <div class="stats-grid">
    <div class="stat-card"><div class="stat-val">${estudiantes.filter((e) => !e.graduado).length}</div><div class="stat-label">👨‍🎓 Estudiantes</div></div>
    <div class="stat-card red"><div class="stat-val">${mora.length}</div><div class="stat-label">⚠️ En Mora</div></div>
    <div class="stat-card green"><div class="stat-val">${pagos.filter((p) => p.fecha && p.fecha.startsWith(`${anio}-${String(mesActual() + 1).padStart(2, "0")}`)).length}</div><div class="stat-label">💰 Pagos este mes</div></div>
    <div class="stat-card gold"><div class="stat-val">${trabajadores.length}</div><div class="stat-label">👷 Trabajadores</div></div>
  </div>

  ${avisoCuentasPagar()}
  ${
    mora.length > 0
      ? `
  <div class="card">
    <div class="card-title"><div class="card-bar"></div><h2>⚠️ Estudiantes en Mora (${mora.length})</h2></div>
    ${mora
      .slice(0, 4)
      .map(
        (e) => `
    <div class="alert-item alert-mora" onclick="setTab('estudiantes')" style="cursor:pointer">
      <span>⚠️</span>
      <div style="flex:1"><strong>${escHtml(e.nombre)}</strong> — ${escHtml(conceptoDeE(e)) || "Sin especificar"}</div>
      ${deudaDe(e) > 0 ? `<span style="font-weight:800">${fmt(deudaDe(e))}</span>` : ""}
    </div>`
      )
      .join("")}
    ${mora.length > 4 ? `<div style="font-size:0.75rem;color:#888;text-align:center;margin-top:0.3rem">+${mora.length - 4} más</div>` : ""}
  </div>`
      : ""
  }

  <div class="dash-grid">
  <div class="card">
    <div class="card-title"><div class="card-bar"></div><h2>📋 Accesos Rápidos</h2></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem">
      ${[
        ["💰 Nuevo Pago", "()=>abrirModal({tipo:'nuevo-pago'})"],
        ["👨‍🎓 Nuevo Estudiante", "()=>abrirModal({tipo:'nuevo-estudiante'})"],
        ["📒 Nuevo Ingreso", "()=>abrirModal({tipo:'nuevo-finanza',subtipo:'ingreso'})"],
        ["📒 Nuevo Gasto", "()=>abrirModal({tipo:'nuevo-finanza',subtipo:'gasto'})"],
      ]
        .map(
          ([l, fn]) => `
      <button class="btn btn-gray" onclick="${fn}" style="padding:0.65rem;font-size:0.8rem;border-radius:10px;border:1.5px solid #dde3f0">${l}</button>`
        )
        .join("")}
    </div>
  </div>

  <div class="card">
    <div class="card-title"><div class="card-bar"></div><h2>💰 Últimos Pagos</h2></div>
    ${pagos
      .slice(0, 4)
      .map(
        (p) => `
    <div class="info-row">
      <span style="color:#333">${escHtml(p.nombre)}</span>
      <div style="text-align:right"><div style="font-weight:700;color:#003366;font-size:0.85rem">${fmt(p.total)}</div><div style="font-size:0.68rem;color:#888">${escHtml(p.fecha)}</div></div>
    </div>`
      )
      .join("")}
    ${pagos.length === 0 ? '<p style="color:#aaa;font-size:0.82rem">Sin pagos registrados</p>' : ""}
  </div>

  <div class="card">
    <div class="card-title"><div class="card-bar"></div><h2>👷 Nómina Total del Personal</h2></div>
    <div style="display:flex;justify-content:space-between;align-items:center;padding:0.5rem 0.85rem;background:#f0f4ff;border-radius:10px">
      <span style="font-size:0.85rem;color:#555">${trabajadoresActivos().length} trabajadores · al mes</span>
      <span style="font-size:1.1rem;font-weight:800;color:#003366">${fmt(totalNomina)}</span>
    </div>
  </div>
  </div>
  ${renderRecordatoriosPagos()}`;
}

// Cuentas por pagar vencidas o que vencen en los próximos 7 días
function avisoCuentasPagar() {
  if (rolUsuario === "docente" || !cuentasPagar.length) return "";
  const r = resumenCuentasPagar();
  if (!r.vencidas.length && !r.semana.length) return "";
  return `<div class="alert-item ${r.vencidas.length ? "alert-mora" : "alert-info"} aviso-cuentas" style="cursor:pointer;margin-bottom:0.75rem" onclick="tabActual='finanzas';subTab.finanzas='porpagar';render()"><div>🧾 <strong>Cuentas por pagar:</strong> ${[
    r.vencidas.length
      ? `${r.vencidas.length} vencida${r.vencidas.length > 1 ? "s" : ""} (${fmt(r.totalVencidas)})`
      : "",
    r.semana.length
      ? `${r.semana.length} vence${r.semana.length > 1 ? "n" : ""} esta semana (${fmt(r.totalSemana)})`
      : "",
  ]
    .filter(Boolean)
    .join(" · ")} →</div></div>`;
}

// Inicio de la administradora: solo lo que necesita para cobrar (lo cobrado hoy, a quién cobrarle y accesos a Caja y
// Pagos). No ve gastos, nómina ni el balance del colegio.
function renderDashboardCaja() {
  const hoy = todayStr(),
    deHoy = pagos.filter((p) => p.fecha === hoy),
    recibos = new Set(deHoy.map((p) => p.factura || p.id)).size,
    porMetodo = totalesMetodo(deHoy),
    total = r2(deHoy.reduce((s, p) => s + (p.total || 0), 0)),
    mora = estudiantes.filter(enMora).sort((a, b) => deudaDe(b) - deudaDe(a));
  return `${htmlBarraBuscar()}
  <div style="background:linear-gradient(135deg,#003366,#00509e);border-radius:14px;padding:1.1rem 1.25rem;color:#fff;margin-bottom:0.85rem">
    <div style="font-size:0.65rem;color:#adc8ff;text-transform:uppercase;letter-spacing:1px">Cobrado hoy · ${escHtml(fechaCorta(hoy))}</div>
    <div style="font-size:1.5rem;font-weight:800;font-family:Georgia,serif;color:#ffd700">${fmt(total)}</div>
    <div style="font-size:0.75rem;color:#adc8ff">${recibos} recibo${recibos !== 1 ? "s" : ""}</div>
    <div style="display:flex;gap:0.4rem 1.2rem;margin-top:0.55rem;flex-wrap:wrap;font-size:0.75rem">
      ${METODOS.filter(([m]) => porMetodo[m].usd > 0)
        .map(
          ([m, etq]) =>
            `<div><span style="color:#adc8ff">${etq}:</span> <strong>${txtMetodo(porMetodo[m])}</strong></div>`
        )
        .join("")}
    </div>
  </div>

  <div class="stats-grid">
    <div class="stat-card"><div class="stat-val">${estudiantes.filter((e) => !e.graduado).length}</div><div class="stat-label">👨‍🎓 Estudiantes</div></div>
    <div class="stat-card red"><div class="stat-val">${mora.length}</div><div class="stat-label">⚠️ Con deuda</div></div>
  </div>

  <div class="card">
    <div class="card-title"><div class="card-bar"></div><h2>📋 Accesos Rápidos</h2></div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0.5rem">
      <button class="btn btn-gray" onclick="caja.vista='cobro';setTab('caja')" style="padding:0.65rem;font-size:0.8rem;border-radius:10px;border:1.5px solid #dde3f0">💳 Cobrar</button>
      <button class="btn btn-gray" onclick="setTab('pagos');subTab.pagos='nuevo';renderTabContent()" style="padding:0.65rem;font-size:0.8rem;border-radius:10px;border:1.5px solid #dde3f0">💰 Nuevo Pago</button>
      <button class="btn btn-gray" onclick="setTab('caja');caja.vista='cierre';caja.cierre=todayStr();renderTabContent()" style="padding:0.65rem;font-size:0.8rem;border-radius:10px;border:1.5px solid #dde3f0">🔒 Cierre de caja</button>
    </div>
  </div>

  ${
    mora.length
      ? `<div class="card">
    <div class="card-title"><div class="card-bar"></div><h2>⚠️ Con deuda (${mora.length})</h2></div>
    ${mora
      .slice(0, 6)
      .map(
        (
          e
        ) => `<div class="alert-item alert-mora" onclick="caja.vista='cobro';setTab('caja');cajaElegir('${e.id}')" style="cursor:pointer;justify-content:space-between">
      <div><strong>${escHtml(e.nombre)}</strong> — ${escHtml(e.grado) || "Sin grado"}</div>
      <span style="font-weight:800">${fmt(deudaDe(e))}</span></div>`
      )
      .join("")}
    ${mora.length > 6 ? `<div style="font-size:0.75rem;color:#888;text-align:center;margin-top:0.3rem">+${mora.length - 6} más · búscalos en Caja</div>` : ""}
  </div>`
      : ""
  }

  <div class="card">
    <div class="card-title"><div class="card-bar"></div><h2>💰 Últimos Pagos</h2></div>
    ${pagos
      .slice(0, 5)
      .map(
        (p) => `
    <div class="info-row">
      <span style="color:#333">${escHtml(p.nombre)}</span>
      <div style="text-align:right"><div style="font-weight:700;color:#003366;font-size:0.85rem">${fmt(p.total)}</div><div style="font-size:0.68rem;color:#888">${escHtml(p.fecha)} · ${escHtml(p.factura || "")}</div></div>
    </div>`
      )
      .join("")}
    ${pagos.length === 0 ? '<p style="color:#aaa;font-size:0.82rem">Sin pagos registrados</p>' : ""}
  </div>`;
}
