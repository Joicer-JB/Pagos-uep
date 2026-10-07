// Pestaña Reportes: recaudo por concepto y por fecha, mora y estado general.

function renderReportes(){
  const anio=anioActual();
  const totalPagos=pagos.reduce((s,p)=>s+p.total,0);
  const tm=totalesMetodo(pagos);
  const totalNomina=trabajadores.reduce((s,t)=>s+(t.salario||0)+(t.bonoAlimentacion||0)+(t.bonoProductividad||0)-(t.descuento||0),0);
  const totalGastos=finanzas.filter(f=>f.tipo==="gasto").reduce((s,f)=>s+f.monto,0);
  const mora=estudiantes.filter(enMora);

  const porConcepto=pagos.reduce((acc,p)=>{const k=p.concepto||"Otro";acc[k]=(acc[k]||0)+p.total;return acc;},{});
  const porFecha=pagos.reduce((acc,p)=>{if(!acc[p.fecha])acc[p.fecha]=[];acc[p.fecha].push(p);return acc;},{});
  const ultFechas=Object.keys(porFecha).sort((a,b)=>b.localeCompare(a)).slice(0,6);

  return`
  <div class="stats-grid">
    <div class="stat-card green"><div class="stat-val">${fmt(totalPagos)}</div><div class="stat-label">💰 Total Recaudado</div></div>
    <div class="stat-card red"><div class="stat-val">${fmt(totalGastos+totalNomina)}</div><div class="stat-label">📉 Total Gastos</div></div>
    <div class="stat-card"><div class="stat-val">${fmt(tm["Dólares Efectivo"].usd)}</div><div class="stat-label">💵 $ Efectivo</div></div>
    <div class="stat-card blue"><div class="stat-val" style="font-size:0.95rem">${fmtBs(tm["Transferencia Bs"].bs)}</div><div class="stat-label">📲 Transf Bs · ${fmt(tm["Transferencia Bs"].usd)}${tm["Transferencia Bs"].sinTasa?" ⚠️":""}</div></div>
    <div class="stat-card green"><div class="stat-val" style="font-size:0.95rem">${fmtBs(tm["Bs Efectivo"].bs)}</div><div class="stat-label">💵 Bs Efectivo · ${fmt(tm["Bs Efectivo"].usd)}${tm["Bs Efectivo"].sinTasa?" ⚠️":""}</div></div>
    <div class="stat-card blue"><div class="stat-val" style="font-size:0.95rem">${fmtBs(tm["Punto"].bs)}</div><div class="stat-label">💳 Punto · ${fmt(tm["Punto"].usd)}${tm["Punto"].sinTasa?" ⚠️":""}</div></div>
  </div>
  <div class="card">
    <div class="card-title"><div class="card-bar"></div><h2>⚠️ Estudiantes en Mora (${mora.length})</h2></div>
    ${mora.length===0?'<p style="font-size:0.82rem;color:#aaa">Sin estudiantes en mora ✅</p>':
    mora.map(e=>`<div class="info-row"><div><span style="font-weight:700;color:#e53e3e">${e.nombre}</span><div style="font-size:0.72rem;color:#888">${e.moraConcepto||"Sin detalle"}</div></div><span style="font-weight:800;color:#e53e3e">${fmt(deudaDe(e))}</span></div>`).join("")}
    ${mora.length>0?`<div style="margin-top:0.5rem;padding:0.6rem 0.85rem;background:#fff5f5;border-radius:8px;display:flex;justify-content:space-between"><span style="font-size:0.82rem;color:#e53e3e;font-weight:700">Total en mora:</span><span style="font-weight:800;color:#e53e3e">${fmt(mora.reduce((s,e)=>s+deudaDe(e),0))}</span></div>`:""}
  </div>
  <div class="card">
    <div class="card-title"><div class="card-bar"></div><h2>Recaudo por Concepto</h2></div>
    ${Object.entries(porConcepto).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`
    <div style="margin-bottom:0.6rem">
      <div style="display:flex;justify-content:space-between;font-size:0.82rem;margin-bottom:3px">
        <span style="color:#333">📌 ${k}</span><span style="font-weight:700;color:#003366">${fmt(v)}</span>
      </div>
      <div class="progress-bar"><div class="progress-fill" style="width:${totalPagos>0?Math.round(v/totalPagos*100):0}%"></div></div>
    </div>`).join("")||'<p style="font-size:0.82rem;color:#aaa">Sin datos</p>'}
  </div>
  <div class="card">
    <div class="card-title"><div class="card-bar"></div><h2>Recaudo por Fecha (últimas)</h2></div>
    ${ultFechas.map(f=>{
      const tot=porFecha[f].reduce((s,p)=>s+p.total,0);
      return`<div class="info-row"><span style="color:#003366;font-weight:600">${f}</span><div style="text-align:right"><span style="font-weight:700">${fmt(tot)}</span><div style="font-size:0.68rem;color:#888">${porFecha[f].length} recibos</div></div></div>`;}).join("")||'<p style="font-size:0.82rem;color:#aaa">Sin datos</p>'}
  </div>
  <div class="card">
    <div class="card-title"><div class="card-bar"></div><h2>Estado General Estudiantes</h2></div>
    ${[["Al Saldo","#1a9e5c",estudiantes.filter(e=>!enMora(e)&&activo(e)).length],
       ["En Mora","#e53e3e",mora.length],
       ["Retirados","#888",estudiantes.filter(e=>e.estado==="retirado").length],
       ["Graduados","#b8860b",estudiantes.filter(e=>e.graduado).length]].map(([l,c,n])=>`
    <div class="info-row"><span style="color:${c};font-weight:600">● ${l}</span><span style="font-weight:700">${n} estudiantes</span></div>`).join("")}
  </div>
`;
}
