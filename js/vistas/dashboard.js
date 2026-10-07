// Pestaña Inicio: resumen del día, estudiantes en mora, accesos rápidos y nómina.

function renderDashboard() {
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
  const totalNomina = trabajadores.reduce(
    (s, t) => s + (t.salario || 0) + (t.bonoAlimentacion || 0) + (t.bonoProductividad || 0),
    0
  );

  return `
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
      <span style="font-size:0.85rem;color:#555">${trabajadores.length} trabajadores</span>
      <span style="font-size:1.1rem;font-weight:800;color:#003366">${fmt(totalNomina)}</span>
    </div>
  </div>
  </div>
  ${renderRecordatoriosPagos()}`;
}
