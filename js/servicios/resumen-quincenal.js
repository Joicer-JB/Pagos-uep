// Resumen quincenal (solo el director): el 1 y el 16 de cada mes aparece en Inicio el resumen de la quincena que
// terminó: cuántos estudiantes deben (y cuánto), cuántos están al día, y lo que entró y salió en esa quincena.
// Queda en Inicio hasta que el director lo marca como visto (config/resumenQuincenal.visto = id de la quincena);
// en 📊 Reportes se puede ver el de cualquier quincena. Se imprime o se manda por WhatsApp.

let configResumenQ = null; // {visto: "2026-10-Q1"}

// Quincena de una fecha: del 1 al 15 (Q1) y del 16 al fin de mes (Q2)
function quincenaDe(fecha) {
  const ym = fecha.slice(0, 7),
    d = Number(fecha.slice(8, 10)),
    fin = new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0).getDate();
  const q1 = d <= 15;
  return {
    id: ym + (q1 ? "-Q1" : "-Q2"),
    desde: ym + (q1 ? "-01" : "-16"),
    hasta: ym + "-" + (q1 ? "15" : String(fin)),
    nombre: (q1 ? "1ª" : "2ª") + " quincena de " + nombreMesYM(ym).toLowerCase(),
  };
}
// La quincena que terminó antes de la de hoy
function quincenaAnterior(hoy) {
  const q = quincenaDe(hoy || todayStr());
  return quincenaDe(sumarDias(q.desde, -1));
}

function resumenQuincenal(q, hoy) {
  hoy = hoy || todayStr();
  const enRango = (f) => f && f.fecha >= q.desde && f.fecha <= q.hasta;
  const activos = estudiantes.filter(activo);
  const conDeuda = activos.filter(enMora).map((e) => ({ e, deuda: deudaDe(e) }));
  const cobros = pagos.filter(enRango),
    ingresos = finanzas.filter((f) => f.tipo === "ingreso" && enRango(f)),
    gastos = finanzas.filter((f) => f.tipo === "gasto" && enRango(f));
  const suma = (l, k) => r2(l.reduce((s, x) => s + (x[k] || 0), 0));
  const porCategoria = {};
  gastos.forEach((g) => {
    const c = g.categoria || "Otros";
    porCategoria[c] = r2((porCategoria[c] || 0) + (g.monto || 0));
  });
  const totCobros = totalesDual(cobros.map((p) => ({ usd: p.total || 0, rec: p }))),
    totIngresos = suma(ingresos, "monto"),
    totGastos = totalesDual(gastos.map((f) => ({ usd: f.monto || 0, rec: f })));
  const ind = indicadoresFinancieros(hoy);
  return {
    q,
    activos: activos.length,
    conDeuda: conDeuda.length,
    alDia: activos.length - conDeuda.length,
    deudaTotal: r2(conDeuda.reduce((s, x) => s + x.deuda, 0)),
    mayores: conDeuda.sort((a, b) => b.deuda - a.deuda).slice(0, 5),
    tramos: ind ? ind.tramos.filter((t) => t.monto > 0) : [],
    indice: ind ? ind.indice : null,
    cobros: { usd: totCobros.usd, bs: totCobros.bs, recibos: new Set(cobros.map((p) => p.factura || p.id)).size },
    otrosIngresos: totIngresos,
    entradas: r2(totCobros.usd + totIngresos),
    gastos: { usd: totGastos.usd, bs: totGastos.bs, porCategoria },
    resultado: r2(totCobros.usd + totIngresos - totGastos.usd),
  };
}

// corto: sin la antigüedad de la deuda ni las deudas más grandes (para Inicio)
function htmlResumenQuincenal(r, corto) {
  const fila = (izq, der, color) =>
    `<div class="info-row"><span>${izq}</span><strong${color ? ` style="color:${color}"` : ""}>${der}</strong></div>`;
  return `
    <div class="stats-grid">
      <div class="stat-card red"><div class="stat-val">${r.conDeuda}</div><div class="stat-label">⚠️ Deben o tienen mora</div></div>
      <div class="stat-card green"><div class="stat-val">${r.alDia}</div><div class="stat-label">✅ Al día</div></div>
      <div class="stat-card gold"><div class="stat-val">${fmt(r.deudaTotal)}</div><div class="stat-label">Total adeudado</div></div>
      <div class="stat-card"><div class="stat-val">${r.indice == null ? "—" : Math.round(r.indice * 100) + " %"}</div><div class="stat-label">Cobranza del año</div></div>
    </div>
    ${!corto && r.tramos.length ? `<div class="section-title">Antigüedad de la deuda</div>${r.tramos.map((t) => fila(escHtml(t.etiqueta) + ` · ${t.estudiantes} est.`, fmt(t.monto))).join("")}` : ""}
    <div class="section-title">Entró y salió en la quincena (${escHtml(fechaCorta(r.q.desde))} al ${escHtml(fechaCorta(r.q.hasta))})</div>
    ${fila(`💰 Cobros a representantes · ${r.cobros.recibos} recibo${r.cobros.recibos !== 1 ? "s" : ""}`, fmt(r.cobros.usd) + (r.cobros.bs ? ` <span style="font-weight:400;color:#888">(${fmtBs(r.cobros.bs)})</span>` : ""), "#1a9e5c")}
    ${r.otrosIngresos ? fila("📒 Otros ingresos", fmt(r.otrosIngresos), "#1a9e5c") : ""}
    ${Object.entries(r.gastos.porCategoria)
      .sort((a, b) => b[1] - a[1])
      .map(([c, m]) => fila("📤 " + escHtml(c), fmt(m), "#c0392b"))
      .join("")}
    ${fila("Total que entró", fmt(r.entradas))}
    ${fila("Total que salió", fmt(r.gastos.usd))}
    ${fila("Resultado de la quincena", fmt(r.resultado), r.resultado >= 0 ? "#1a9e5c" : "#c0392b")}
    ${!corto && r.mayores.length ? `<div class="section-title">Deudas más grandes</div>${r.mayores.map((x) => fila(escHtml(x.e.nombre) + (x.e.grado ? " · " + escHtml(x.e.grado) : ""), fmt(x.deuda))).join("")}` : ""}`;
}

function textoResumenQuincenal(r) {
  const l = [
    "🏫 " + EMPRESA,
    "🗓️ RESUMEN DE LA " + r.q.nombre.toUpperCase(),
    "",
    "👨‍🎓 Estudiantes activos: " + r.activos,
    "⚠️ Deben o tienen mora: " + r.conDeuda + " (" + fmt(r.deudaTotal) + ")",
    "✅ Al día: " + r.alDia,
  ];
  if (r.indice != null) l.push("📈 Cobranza del año: " + Math.round(r.indice * 100) + " %");
  l.push("", "💰 Cobros: " + fmt(r.cobros.usd) + " (" + r.cobros.recibos + " recibos)");
  if (r.otrosIngresos) l.push("📒 Otros ingresos: " + fmt(r.otrosIngresos));
  Object.entries(r.gastos.porCategoria).forEach(([c, m]) => l.push("📤 " + c + ": " + fmt(m)));
  l.push("➡️ Entró " + fmt(r.entradas) + " · Salió " + fmt(r.gastos.usd) + " · Resultado " + fmt(r.resultado));
  return l.join("\n");
}

// Tarjeta de Inicio: el resumen de la quincena que terminó, hasta que el director la marca como vista
function htmlAvisoQuincenal() {
  if (rolUsuario !== "director" || soloLectura() || !configResumenQ) return "";
  const q = quincenaAnterior();
  if (configResumenQ.visto >= q.id) return "";
  const r = resumenQuincenal(q);
  return `<div class="card aviso-quincenal" style="border-left:4px solid #b8860b">
    <div class="card-title"><div class="card-bar"></div><h2>🗓️ Resumen de la ${escHtml(q.nombre)}</h2></div>
    ${htmlResumenQuincenal(r, true)}
    <div style="display:flex;gap:0.4rem;margin-top:0.6rem;flex-wrap:wrap">
      <button class="btn btn-gray btn-sm" onclick="rqDesde='${q.desde}';setTab('reportes')">📊 Ver completo</button>
      <button class="btn btn-print btn-sm" onclick="imprimirResumenQuincenal('${q.desde}')">🖨️ Imprimir</button>
      <button class="btn btn-whatsapp btn-sm" onclick="whatsappResumenQuincenal('${q.desde}')">💬 Enviármelo por WhatsApp</button>
      <button class="btn btn-primary btn-sm" style="margin-left:auto" onclick="marcarResumenVisto('${q.id}')">✅ Visto</button>
    </div>
  </div>`;
}
async function marcarResumenVisto(id) {
  configResumenQ = { ...(configResumenQ || {}), visto: id };
  renderTabContent();
  try {
    await db.collection("config").doc("resumenQuincenal").set({ visto: id }, { merge: true });
  } catch (e) {
    console.warn("No se pudo guardar el resumen como visto:", e.message);
  }
}
function imprimirResumenQuincenal(desde) {
  const r = resumenQuincenal(quincenaDe(desde));
  const w = abrirVentanaImpresion();
  if (!w) return alert("Permite las ventanas emergentes para imprimir");
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>Resumen ${escHtml(r.q.nombre)}</title>
  <style>body{font-family:'Segoe UI',Arial,sans-serif;color:#222;padding:1.2rem;max-width:760px;margin:0 auto}h2{color:#003366;font-family:Georgia,serif;margin:0}
  .sub{color:#555;font-size:0.85rem;margin-bottom:0.8rem}.stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:0.5rem;margin:0.6rem 0}
  .stat-card{border:1px solid #dde3f0;border-radius:8px;padding:0.5rem;text-align:center}.stat-val{font-size:1.2rem;font-weight:800;color:#003366}
  .stat-label{font-size:0.7rem;color:#555}.section-title{font-weight:700;color:#003366;margin:0.8rem 0 0.3rem;font-size:0.85rem;border-bottom:1px solid #003366}
  .info-row{display:flex;justify-content:space-between;padding:0.25rem 0;border-bottom:1px dotted #ccc;font-size:0.82rem}</style></head><body>
  <h2>${escHtml(EMPRESA)}</h2><div class="sub">Resumen de la ${escHtml(r.q.nombre)} · impreso el ${escHtml(fechaCorta(todayStr()))}</div>
  ${htmlResumenQuincenal(r)}
  </body></html>`);
  w.document.close();
  setTimeout(() => w.print(), 400);
}
function whatsappResumenQuincenal(desde) {
  const r = resumenQuincenal(quincenaDe(desde));
  window.open("https://wa.me/?text=" + encodeURIComponent(textoResumenQuincenal(r)), "_blank");
}
