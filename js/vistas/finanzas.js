// Pestaña Finanzas: ingresos y gastos, flujo de caja anual e impresión.

function renderFinanzas(){
  const st=subTab.finanzas;
  const mesIdx=MESES.indexOf(filtros.mes||MESES[mesActual()]);
  const anio=filtros.anio||String(anioActual());
  const mesPad=String(mesIdx>=0?mesIdx+1:mesActual()+1).padStart(2,"0");
  const pagosMes=pagos.filter(p=>p.fecha&&p.fecha.startsWith(`${anio}-${mesPad}`));
  const ingMes=finanzas.filter(f=>f.tipo==="ingreso"&&f.fecha&&f.fecha.startsWith(`${anio}-${mesPad}`));
  const gasMes=finanzas.filter(f=>f.tipo==="gasto"&&f.fecha&&f.fecha.startsWith(`${anio}-${mesPad}`));
  const totalIng=pagosMes.reduce((s,p)=>s+p.total,0)+ingMes.reduce((s,f)=>s+f.monto,0);
  const totalGas=gasMes.reduce((s,f)=>s+f.monto,0);
  const balance=totalIng-totalGas;

  const dIng=totalesDual([...pagosMes.map(p=>({usd:p.total,rec:p})),...ingMes.map(f=>({usd:f.monto,rec:f}))]);
  const dGas=totalesDual(gasMes.map(f=>({usd:f.monto,rec:f})));

  // Flujo anual (en $ de referencia y en Bs. a la tasa de cada operación)
  const flujoPorMes=MESES.map((m,i)=>{
    const pre=`${anio}-${String(i+1).padStart(2,"0")}`;
    const ingI=[...pagos.filter(p=>p.fecha&&p.fecha.startsWith(pre)).map(p=>({usd:p.total,rec:p})),
      ...finanzas.filter(f=>f.tipo==="ingreso"&&f.fecha&&f.fecha.startsWith(pre)).map(f=>({usd:f.monto,rec:f}))];
    const gasI=finanzas.filter(f=>f.tipo==="gasto"&&f.fecha&&f.fecha.startsWith(pre)).map(f=>({usd:f.monto,rec:f}));
    const di=totalesDual(ingI),dg=totalesDual(gasI);
    return{mes:m,ing:di.usd,gas:dg.usd,bal:r2(di.usd-dg.usd),ingBs:di.bs,gasBs:dg.bs,balBs:r2(di.bs-dg.bs),sinTasa:di.sinTasa+dg.sinTasa};
  });

  return`
  <div class="stabs">
    ${[["resumen","📊 Resumen"],["gastos","📉 Gastos"],["flujo","💹 Flujo de Caja"]].map(([k,l])=>`
    <button class="stab ${st===k?"active":""}" onclick="subTab.finanzas='${k}';renderTabContent()">${l}</button>`).join("")}
  </div>
  <div style="display:flex;gap:0.5rem;margin-bottom:0.85rem;flex-wrap:wrap">
    <select class="inp" style="flex:1;padding:0.6rem 0.85rem;font-size:0.82rem" onchange="filtros.mes=this.value;renderTabContent()">
      ${MESES.map((m,i)=>`<option value="${m}" ${(filtros.mes||MESES[mesActual()])===m?"selected":""}>${m}</option>`).join("")}
    </select>
    <select class="inp" style="padding:0.6rem 0.85rem;font-size:0.82rem;width:auto" onchange="filtros.anio=this.value;renderTabContent()">
      ${Array.from({length:9},(_, i)=>String(anioActual()-5+i)).map(a=>`<option value="${a}" ${anio===a?"selected":""}>${a}</option>`).join("")}
    </select>
  </div>

  ${st==="resumen"?`
  <div style="background:linear-gradient(135deg,#003366,#00509e);border-radius:14px;padding:1.1rem 1.25rem;color:#fff;margin-bottom:0.85rem">
    <div style="font-size:0.62rem;color:#adc8ff;text-transform:uppercase;letter-spacing:1px">${escHtml(filtros.mes)||MESES[mesActual()]} ${anio}</div>
    <div class="stats-grid-3" style="margin-top:0.75rem;margin-bottom:0">
      <div style="text-align:center"><div style="font-size:0.6rem;color:#adc8ff">Ingresos</div><div style="font-weight:800;color:#7fff9f;font-size:0.95rem">${fmt(totalIng)}</div></div>
      <div style="text-align:center"><div style="font-size:0.6rem;color:#adc8ff">Gastos</div><div style="font-weight:800;color:#ffaaaa;font-size:0.95rem">${fmt(totalGas)}</div></div>
      <div style="text-align:center"><div style="font-size:0.6rem;color:#adc8ff">Balance</div><div style="font-weight:800;color:${balance>=0?"#ffd700":"#ff6b6b"};font-size:0.95rem">${fmt(balance)}</div></div>
    </div>
  </div>
  <div class="card" style="padding:0.7rem 0.9rem;margin-bottom:0.85rem">
    <div style="font-size:0.62rem;color:#003366;text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:4px">💱 En bolívares (tasa BCV de cada operación)</div>
    <div style="display:flex;justify-content:space-between;font-size:0.8rem"><span>Ingresos</span><strong style="color:#1a9e5c">${fmtBs(dIng.bs)}</strong></div>
    <div style="display:flex;justify-content:space-between;font-size:0.8rem"><span>Gastos</span><strong style="color:#e53e3e">${fmtBs(dGas.bs)}</strong></div>
    <div style="display:flex;justify-content:space-between;font-size:0.85rem;border-top:1px solid #eee;margin-top:3px;padding-top:3px"><span>Balance</span><strong style="color:${dIng.bs-dGas.bs>=0?"#1a9e5c":"#e53e3e"}">${fmtBs(r2(dIng.bs-dGas.bs))}</strong></div>
    ${(dIng.sinTasa+dGas.sinTasa)>0?`<div style="font-size:0.68rem;color:#b8860b;margin-top:3px">⚠️ ${dIng.sinTasa+dGas.sinTasa} movimiento(s) sin tasa BCV no están incluidos en Bs.</div>`:""}
  </div>
  <div style="display:flex;gap:0.65rem;margin-bottom:0.85rem">
    <button class="btn btn-success" style="flex:1" onclick="abrirModal({tipo:'nuevo-finanza',subtipo:'ingreso'})">📈 + Ingreso</button>
    <button class="btn btn-danger" style="flex:1" onclick="abrirModal({tipo:'nuevo-finanza',subtipo:'gasto'})">📉 + Gasto</button>
  </div>
  <div class="card">
    <div class="card-title"><div class="card-bar"></div><h2>Desglose de Ingresos</h2></div>
    ${[["Mensualidades",pagosMes.filter(p=>p.concepto==="Mensualidad").reduce((s,p)=>s+p.total,0)],
       ["Inscripciones",pagosMes.filter(p=>p.concepto==="Inscripción").reduce((s,p)=>s+p.total,0)],
       ["Uniformes",pagosMes.filter(p=>p.concepto==="Uniformes").reduce((s,p)=>s+p.total,0)],
       ["Otros ingresos",ingMes.reduce((s,f)=>s+f.monto,0)]].filter(([,v])=>v>0).map(([l,v])=>`
    <div class="info-row"><span style="color:#555">📌 ${l}</span><span style="font-weight:700;color:#1a9e5c">${fmt(v)}</span></div>`).join("")||'<p style="font-size:0.82rem;color:#aaa">Sin ingresos</p>'}
  </div>
  <div class="card">
    <div class="card-title"><div class="card-bar"></div><h2>Desglose de Gastos</h2></div>
    ${Object.entries(gasMes.reduce((acc,f)=>{acc[f.categoria||"Otros"]=(acc[f.categoria||"Otros"]||0)+f.monto;return acc;},{})).map(([k,v])=>`
    <div class="info-row"><span style="color:#555">📌 ${escHtml(k)}</span><span style="font-weight:700;color:#e53e3e">${fmt(v)}</span></div>`).join("")||'<p style="font-size:0.82rem;color:#aaa">Sin gastos</p>'}
  </div>`:""}

  ${st==="gastos"?`
  <button class="btn btn-danger btn-full" style="margin-bottom:0.75rem" onclick="abrirModal({tipo:'nuevo-finanza',subtipo:'gasto'})">📉 Registrar Gasto</button>
  <div class="list">
    ${gasMes.map(f=>`<div class="list-item gasto" onclick="abrirModal({tipo:'ver-finanza',id:'${f.id}'})"><div class="item-row"><div style="flex:1"><div class="item-name">${escHtml(f.descripcion)}</div><div class="item-sub">${escHtml(f.categoria)||"Gasto"} · ${escHtml(f.fecha)} ${f.responsable?"· "+escHtml(f.responsable):""}</div></div><div class="item-right"><div class="item-amount" style="color:#e53e3e">${fmt(f.monto)}</div>${(()=>{const b=bsDe(f,f.monto);return b.bs!=null?`<div style="font-size:0.68rem;color:#888">${fmtBs(b.bs)}</div>`:"";})()}</div></div></div>`).join("")}
    ${gasMes.length===0?`<div class="empty"><div class="empty-icon">📉</div><p>Sin gastos este mes</p></div>`:""}
  </div>`:""}

  ${st==="flujo"?`
  <div class="card">
    <div class="card-title"><div class="card-bar"></div><h2>Flujo de Caja ${anio}</h2>
      <div style="display:flex;gap:0.4rem;margin-left:auto">
        <button class="btn btn-print btn-sm" onclick="imprimirFlujoCaja(${anio},null,false)">🖨️ Resumen</button>
        <button class="btn btn-print btn-sm" style="background:#00509e" onclick="imprimirFlujoCaja(${anio},null,true)">🖨️ Detallado</button>
      </div>
    </div>
    ${flujoPorMes.map((m,i)=>`
    <div style="margin-bottom:0.75rem;background:#f8faff;border-radius:10px;padding:0.65rem 0.85rem">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
        <span style="font-weight:700;color:#003366;font-size:0.85rem">${escHtml(m.mes)} ${anio}</span>
        <div style="display:flex;align-items:center;gap:0.5rem">
          <span style="color:${m.balBs>=0?"#1a9e5c":"#e53e3e"};font-weight:700;font-size:0.85rem">${fmtBs(m.balBs)} <span style="font-weight:400;font-size:0.68rem;color:#888">(${fmt(m.bal)})</span></span>
          <div style="display:flex;gap:0.3rem">
            <button class="btn btn-print btn-sm" style="padding:0.2rem 0.4rem;font-size:0.65rem" onclick="imprimirFlujoCaja(${anio},${i},false)" title="Resumen">📄</button>
            <button class="btn btn-print btn-sm" style="padding:0.2rem 0.4rem;font-size:0.65rem;background:#00509e" onclick="imprimirFlujoCaja(${anio},${i},true)" title="Detallado">📋</button>
          </div>
        </div>
      </div>
      <div style="display:flex;gap:0.5rem;font-size:0.72rem">
        <span style="color:#1a9e5c">▲ Ing: ${fmtBs(m.ingBs)} <small style="color:#888">(${fmt(m.ing)})</small></span><span style="color:#ccc">·</span><span style="color:#e53e3e">▼ Gas: ${fmtBs(m.gasBs)} <small style="color:#888">(${fmt(m.gas)})</small></span>${m.sinTasa?`<span title="Movimientos sin tasa BCV" style="color:#b8860b">⚠️${m.sinTasa}</span>`:""}
      </div>
      <div class="progress-bar" style="margin-top:5px"><div class="progress-fill" style="width:${Math.min(100,m.ing>0?100:0)}%"></div></div>
    </div>`).join("")}
  </div>`:""}`;
}
function renderModalFinanza(m){
  const isIng=m.subtipo==="ingreso";
  const categoriasGasto=["Nómina","Servicios","Materiales","Mantenimiento","Transporte","Alimentación","Otros"];
  const categoriasIng=["Donación","Evento","Subsidio","Otros ingresos"];
  return`<div class="modal-bg"><div class="modal">
    <div class="modal-header" style="background:${isIng?"linear-gradient(135deg,#1a9e5c,#27ae60)":"linear-gradient(135deg,#c0392b,#e53e3e)"}">
      <div><h3>${isIng?"📈 Nuevo Ingreso":"📉 Nuevo Gasto"}</h3></div>
      <button class="modal-close-x" onclick="cerrarModal()">✕</button>
    </div>
    <div class="modal-body">
      <div class="form-grid">
        <div class="field"><label class="field-label">Descripción *</label><input class="inp" id="fin-desc" placeholder="${isIng?"Ej: Donación institución":"Ej: Pago de agua"}"/></div>
        <div class="form-row">
          <div class="field"><label class="field-label">Fecha *</label><input class="inp" type="date" id="fin-fecha" value="${todayStr()}" onchange="actualizarTasaCampo('fin',calcFin)"/></div>
          <div class="field"><label class="field-label">Categoría</label>
            <select class="inp" id="fin-cat">
              ${(isIng?categoriasIng:categoriasGasto).map(c=>`<option value="${c}">${c}</option>`).join("")}
            </select>
          </div>
        </div>
        <div class="field"><label class="field-label">Monto * <span style="font-weight:400;color:#888">(¿en qué moneda lo escribes?)</span></label>
          <div class="metodo-row" style="margin-bottom:0.4rem">
            <button type="button" class="metodo-btn ${isIng?"":"selected"}" id="fin-m-ves" onclick="selMonedaFin('VES')">🇻🇪 Bolívares (Bs.)</button>
            <button type="button" class="metodo-btn ${isIng?"selected":""}" id="fin-m-usd" onclick="selMonedaFin('USD')">💵 Dólares (ref.)</button>
          </div>
          <div style="position:relative"><span id="fin-simbolo" style="position:absolute;left:0.9rem;top:50%;transform:translateY(-50%);color:${isIng?"#1a9e5c":"#e53e3e"};font-weight:700">${isIng?"$":"Bs."}</span>
          <input class="inp" id="fin-monto" placeholder="0,00" style="padding-left:3rem" oninput="fmtInput(this);calcFin()"/></div></div>
        ${campoTasaHTML("fin",null,"calcFin()")}
        <div id="fin-equiv" style="display:none;background:#e8f0fe;border-radius:10px;padding:0.65rem 0.85rem;font-size:0.82rem;color:#003366"></div>
        <div class="field"><label class="field-label">Responsable</label><input class="inp" id="fin-resp" placeholder="Quién realizó el gasto/ingreso"/></div>
        <div class="field"><label class="field-label">Observaciones</label><textarea class="inp" id="fin-obs" rows="2" placeholder="Detalles adicionales"></textarea></div>
        <div id="fin-err"></div>
      </div>
    </div>
    <div class="modal-actions">
      <button class="btn ${isIng?"btn-success":"btn-danger"}" style="flex:1" onclick="guardarFinanza('${m.subtipo}')">✓ Guardar ${isIng?"Ingreso":"Gasto"}</button>
      <button class="btn btn-gray" onclick="cerrarModal()">Cancelar</button>
    </div>
  </div></div>`;
}
function renderModalVerFinanza(m){
  const f=finanzas.find(x=>x.id===m.id);if(!f)return"";
  return`<div class="modal-bg" onclick="if(event.target.classList.contains('modal-bg'))cerrarModal()">
    <div class="modal">
      <div class="modal-header" style="background:${f.tipo==="ingreso"?"linear-gradient(135deg,#1a9e5c,#27ae60)":"linear-gradient(135deg,#c0392b,#e53e3e)"}">
        <div><h3>${f.tipo==="ingreso"?"📈":"📉"} ${escHtml(f.descripcion)}</h3><p>${escHtml(f.categoria)||""} · ${escHtml(f.fecha)}</p></div>
        <button class="modal-close-x" onclick="cerrarModal()">✕</button>
      </div>
      <div class="modal-body">
        ${[["Descripción",f.descripcion],["Fecha",f.fecha],["Categoría",f.categoria||"N/A"],["Responsable",f.responsable||"N/A"],["Observaciones",f.observaciones||"N/A"]].map(([l,v])=>`
        <div class="info-row"><span style="color:#888;font-size:0.8rem">${l}</span><span style="font-weight:600;font-size:0.82rem">${escHtml(v)}</span></div>`).join("")}
        <div style="margin-top:0.85rem;padding:0.85rem 1rem;background:${f.tipo==="ingreso"?"#e6f7ef":"#fff5f5"};border-radius:10px;display:flex;justify-content:space-between">
          <span style="font-weight:700;color:${f.tipo==="ingreso"?"#1a9e5c":"#e53e3e"}">Monto</span>
          <span style="font-size:1.2rem;font-weight:800;color:${f.tipo==="ingreso"?"#1a9e5c":"#e53e3e"}">${fmt(f.monto)}</span>
        </div>
        ${(()=>{const b=bsDe(f,f.monto);return b.bs!=null?`<div style="margin-top:0.5rem;padding:0.7rem 1rem;background:#f0f4ff;border-radius:10px;display:flex;justify-content:space-between"><span style="font-weight:700;color:#003366">En bolívares${b.estimada?" (est.)":""}</span><span style="font-weight:800;color:#003366">${fmtBs(b.bs)}</span></div><div style="font-size:0.7rem;color:#888;text-align:right;margin-top:3px">Tasa BCV ${fechaCorta(b.fecha)}: Bs. ${fmtTasa(b.tasa)}</div>`:`<div style="font-size:0.72rem;color:#b8860b;margin-top:0.5rem">Sin tasa BCV registrada para esta fecha</div>`;})()}
      </div>
      <div class="modal-actions">
        ${rolUsuario==="director"?`<button class="btn btn-danger btn-sm" onclick="eliminarFinanza('${f.id}')">🗑️ Eliminar</button>`:""}
        <button class="btn btn-gray" style="flex:1" onclick="cerrarModal()">Cerrar</button>
      </div>
    </div>
  </div>`;
}
function imprimirFlujoCaja(anio, mesIdx, detallado=false){
  const un=mesIdx!==null&&mesIdx!==undefined;
  const meses=Array.from({length:12},(_,i)=>{
    const pre=anio+"-"+String(i+1).padStart(2,"0");
    const ing=[...pagos.filter(p=>p.fecha&&p.fecha.startsWith(pre)).map(p=>({usd:p.total,rec:p,desc:(p.nombre||"")+" - "+(p.concepto||"Pago"),fecha:p.fecha,grupo:p.concepto||"Pagos"})),
      ...finanzas.filter(f=>f.tipo==="ingreso"&&f.fecha&&f.fecha.startsWith(pre)).map(f=>({usd:f.monto,rec:f,desc:f.descripcion,fecha:f.fecha,grupo:f.categoria||f.descripcion||"Ingreso"}))];
    const gas=finanzas.filter(f=>f.tipo==="gasto"&&f.fecha&&f.fecha.startsWith(pre)).map(f=>({usd:f.monto,rec:f,desc:f.descripcion+(f.responsable?" · "+f.responsable:""),fecha:f.fecha,grupo:f.categoria||"Gasto"}));
    return {i,mes:MESES[i],ing,gas,di:totalesDual(ing),dg:totalesDual(gas)};
  });
  const sel=un?[meses[mesIdx]]:meses;
  const titulo=un?MESES[mesIdx]+" "+anio:"Año Completo "+anio;
  const T=sel.reduce((a,m)=>({ib:a.ib+m.di.bs,iu:a.iu+m.di.usd,gb:a.gb+m.dg.bs,gu:a.gu+m.dg.usd,sin:a.sin+m.di.sinTasa+m.dg.sinTasa,est:a.est+m.di.estim+m.dg.estim}),{ib:0,iu:0,gb:0,gu:0,sin:0,est:0});
  const celdas=(d,esIng,bsTxt)=>esIng?`<td class="r">${bsTxt}</td><td class="r">${fmt(d)}</td><td></td><td></td><td></td><td></td>`:`<td></td><td></td><td class="r">${bsTxt}</td><td class="r">${fmt(d)}</td><td></td><td></td>`;
  const filaDet=(d,esIng)=>{const b=bsDe(d.rec,d.usd);const t=b.bs!=null?fmtBs(b.bs)+(b.estimada?" *":""):"—";
    return `<tr class="${esIng?"di":"dg"}"><td class="sub">↳ ${escHtml(d.desc)} <span class="f">${fechaCorta(d.fecha)}${b.tasa?" · tasa "+fmtTasa(b.tasa):""}</span></td>${celdas(d.usd,esIng,t)}</tr>`;};
  const filaGrp=(nombre,items,esIng)=>{const t=totalesDual(items);return `<tr class="${esIng?"di":"dg"}"><td class="sub">↳ ${escHtml(nombre)}</td>${celdas(t.usd,esIng,fmtBs(t.bs))}</tr>`;};
  const grupos=arr=>{const g={};arr.forEach(d=>{(g[d.grupo]=g[d.grupo]||[]).push(d);});return g;};
  const filas=sel.map(m=>{
    let det="";
    if(detallado){det=m.ing.map(d=>filaDet(d,true)).join("")+m.gas.map(d=>filaDet(d,false)).join("");}
    else{const gi=grupos(m.ing),gg=grupos(m.gas);det=Object.entries(gi).map(([k,a])=>filaGrp(k,a,true)).join("")+Object.entries(gg).map(([k,a])=>filaGrp(k,a,false)).join("");}
    return `<tr class="m"><td>${escHtml(m.mes)}</td><td class="r in">${fmtBs(m.di.bs)}</td><td class="r in">${fmt(m.di.usd)}</td><td class="r out">${fmtBs(m.dg.bs)}</td><td class="r out">${fmt(m.dg.usd)}</td><td class="r b">${fmtBs(r2(m.di.bs-m.dg.bs))}</td><td class="r b">${fmt(r2(m.di.usd-m.dg.usd))}</td></tr>${det}`;
  }).join("");
  const w=window.open("","_blank");
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
  <title>Flujo de Caja ${anio}</title>
  <style>
    @page{size:landscape;margin:12mm}
    body{font-family:Arial,sans-serif;margin:0;padding:20px;color:#222}
    .header{background:#003366;color:#fff;padding:16px 22px;border-radius:8px;margin-bottom:16px}
    .header h1{margin:0;font-size:1.25rem;color:#ffd700}.header p{margin:4px 0 0;font-size:0.8rem;color:#adc8ff}
    table{width:100%;border-collapse:collapse;font-size:0.82rem}
    thead th{background:#003366;color:#fff;padding:8px 8px;text-align:right}thead th:first-child{text-align:left}
    thead tr.g th{background:#00509e;text-align:center}
    td{padding:6px 8px;border-bottom:1px solid #eee}.r{text-align:right;white-space:nowrap}
    tr.m td{font-weight:600;color:#003366;background:#f4f7ff}tr.m td.in{color:#1a9e5c}tr.m td.out{color:#e53e3e}tr.m td.b{font-weight:800}
    tr.di td{background:#f0fff4;font-size:0.76rem;color:#555;padding:3px 8px}tr.dg td{background:#fff5f5;font-size:0.76rem;color:#555;padding:3px 8px}
    td.sub{padding-left:20px}.f{color:#aaa;font-size:0.7rem}
    tfoot td{background:#003366;color:#fff;font-weight:700;padding:9px 8px}tfoot td.r{text-align:right}
    .nota{font-size:0.72rem;color:#666;margin-top:10px;line-height:1.5}
    .footer{margin-top:28px;display:flex;justify-content:space-between;padding-top:18px;border-top:2px solid #003366}
    .firma{text-align:center;width:200px}.firma-line{border-top:1px solid #333;margin-top:46px;padding-top:6px;font-size:0.78rem;color:#555}
    @media print{button{display:none}}
  </style></head><body>
  <button onclick="window.print()" style="margin-bottom:14px;padding:8px 18px;background:#003366;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:0.85rem">🖨️ Imprimir</button>
  <div class="header">
    <h1>📊 Flujo de Caja — ${titulo}</h1>
    <p>${EMPRESA} · ${EMPRESA_SUB} · Bolívares (Bs.) con referencia en dólares ($)</p>
    <p>Generado el ${new Date().toLocaleDateString("es-VE",{day:"2-digit",month:"long",year:"numeric"})}</p>
  </div>
  <table>
    <thead><tr class="g"><th></th><th colspan="2">Ingresos</th><th colspan="2">Gastos</th><th colspan="2">Balance</th></tr>
    <tr><th>Mes</th><th>Bs.</th><th>$ ref.</th><th>Bs.</th><th>$ ref.</th><th>Bs.</th><th>$ ref.</th></tr></thead>
    <tbody>${filas}</tbody>
    <tfoot><tr><td>${un?"TOTAL DEL MES":"TOTAL ANUAL"}</td><td class="r">${fmtBs(r2(T.ib))}</td><td class="r">${fmt(r2(T.iu))}</td><td class="r">${fmtBs(r2(T.gb))}</td><td class="r">${fmt(r2(T.gu))}</td><td class="r">${fmtBs(r2(T.ib-T.gb))}</td><td class="r">${fmt(r2(T.iu-T.gu))}</td></tr></tfoot>
  </table>
  <p class="nota">Los montos en bolívares están calculados a la tasa BCV vigente en la fecha de cada operación; la columna «$ ref.» es el valor de referencia en dólares.
  ${T.est?`<br/>* ${T.est} registro(s) anteriores no tenían tasa guardada y se convirtieron con la tasa BCV de su fecha.`:""}
  ${T.sin?`<br/><strong>⚠️ ${T.sin} registro(s) no tienen tasa BCV: están en la columna $ ref. pero no se incluyen en las columnas en Bs.</strong>`:""}</p>
  <div class="footer">
    <div class="firma"><div class="firma-line">Directora<br/>Ligia Herrera</div></div>
    <div class="firma"><div class="firma-line">Administradora<br/>${EMPRESA}</div></div>
    <div class="firma"><div class="firma-line">Contador<br/>Firma y Sello</div></div>
  </div>
  </body></html>`);
  w.document.close();
  setTimeout(()=>w.print(),500);
}
const monedaFin=()=>{const b=document.getElementById("fin-m-usd");return b&&b.classList.contains("selected")?"USD":"VES";};
function selMonedaFin(m){
  const a=document.getElementById("fin-m-ves"),b=document.getElementById("fin-m-usd");
  if(a)a.classList.toggle("selected",m==="VES");if(b)b.classList.toggle("selected",m==="USD");
  const sy=document.getElementById("fin-simbolo");if(sy)sy.textContent=m==="USD"?"$":"Bs.";
  calcFin();
}
// Lo escrito en Bs. se convierte a $ de referencia; lo escrito en $ se convierte a Bs.: siempre se guardan los dos
function calcFinValores(){
  const mon=monedaFin(),v=parseFmt(document.getElementById("fin-monto")?document.getElementById("fin-monto").value:"0"),tasa=parseTasa(document.getElementById("fin-tasa")?document.getElementById("fin-tasa").value:"0");
  if(!v||!(tasa>0)) return {mon,v,tasa,usd:null,bs:null};
  return mon==="USD"?{mon,v,tasa,usd:r2(v),bs:r2(v*tasa)}:{mon,v,tasa,usd:r2(v/tasa),bs:r2(v)};
}
function calcFin(){
  const box=document.getElementById("fin-equiv");if(!box)return;
  const c=calcFinValores();
  if(c.usd!=null){box.style.display="block";box.innerHTML=c.mon==="VES"?`Equivale a <strong>${fmt(c.usd)}</strong> de referencia`:`Equivale a <strong>${fmtBs(c.bs)}</strong> a la tasa indicada`;}
  else box.style.display="none";
}
async function guardarFinanza(tipo){
  const desc=document.getElementById("fin-desc").value.trim();
  const fecha=document.getElementById("fin-fecha").value;
  const c=calcFinValores();
  const err=m=>{document.getElementById("fin-err").innerHTML=`<div class="error-msg">${m}</div>`;};
  if(!desc||!c.v||!fecha){err("Completa descripción, fecha y monto");return;}
  if(!(c.tasa>0)){err("Falta la tasa BCV: cárgala con 💱 (arriba) o escríbela en el formulario");return;}
  if(!(c.usd>0)){err("El monto es muy pequeño para la tasa indicada");return;}
  const datos={tipo,descripcion:desc,fecha,categoria:document.getElementById("fin-cat").value,
    monto:c.usd,montoBs:c.bs,tasa:c.tasa,moneda:c.mon,
    responsable:document.getElementById("fin-resp").value.trim(),
    observaciones:document.getElementById("fin-obs").value.trim(),
    timestamp:firebase.firestore.FieldValue.serverTimestamp()};
  try{
    const ref=await db.collection("finanzas").add(datos);datos.id=ref.id;finanzas.push(datos);
    recordarTasa(fecha,c.tasa);
    alertaFinanza(datos);cerrarModal();
  }catch(e){err(e.message);}
}
async function eliminarFinanza(id){
  if(rolUsuario!=="director"){alert("Sin permiso");return;}
  if(!confirm("¿Eliminar este registro?"))return;
  try{await db.collection("finanzas").doc(id).delete();finanzas=finanzas.filter(f=>f.id!==id);cerrarModal();}
  catch(e){alert("Error: "+e.message);}
}
