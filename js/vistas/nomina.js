// Pestaña Nómina: personal, pagos de nómina (en $ de referencia, pagados en Bs.) y sus recibos.

function imprimirReciboNomina(trabId, pagoId){
  let t = trabId ? trabajadores.find(x=>x.id===trabId) : null;
  let pago = pagoId ? finanzas.find(x=>x.id===pagoId) : null;
  
  // If from historial, find worker by name
  if(pago && !t){
    const nombreTrab = pago.responsable||"";
    t = trabajadores.find(x=>x.nombre===nombreTrab) || 
        {nombre:nombreTrab, cargo:"", cedula:"", salario:0, bonoAlimentacion:0, bonoProductividad:0, descuento:0};
  }
  if(!t) return;

  const dz = desgloseRecibo(pago, t);   // conceptos del recibo; el total es lo realmente pagado
  const fechaPago = pago ? pago.fecha : todayStr();
  const montoPagado = dz.total;
  const periodo = pago ? pago.descripcion : "Quincena / Mes";
  const numRecibo = "NOM-" + Date.now().toString().slice(-7);

  const w = window.open("","_blank","width=680,height=900");
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"/>
  <title>Recibo Nómina - ${escHtml(t.nombre)}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Segoe UI',sans-serif;background:#fff;color:#222;max-width:680px;margin:0 auto}
    .hdr{background:linear-gradient(135deg,#003366,#00509e);color:#fff;padding:1.2rem 1.5rem}
    .hdr-top{display:flex;align-items:center;gap:1rem;margin-bottom:0.75rem}
    .logo{width:60px;height:60px;object-fit:contain;background:#fff;border-radius:8px;padding:3px;flex-shrink:0}
    .hdr-nums{display:flex;justify-content:space-between;background:rgba(0,0,0,0.2);border-radius:8px;padding:0.55rem 0.9rem}
    .sec{padding:1rem 1.5rem}
    .worker-box{background:#f0f4ff;border-radius:10px;padding:0.9rem 1.1rem;margin-bottom:1rem;border-left:5px solid #003366;display:grid;grid-template-columns:1fr 1fr;gap:0.35rem}
    .wf span{font-size:0.65rem;color:#888;display:block;text-transform:uppercase;letter-spacing:0.5px}
    .wf strong{font-size:0.85rem;color:#003366}
    .concept-row{display:flex;justify-content:space-between;padding:0.5rem 0.85rem;border-radius:7px;margin-bottom:0.3rem;font-size:0.85rem}
    .earn{background:#e6f7ef}.dedu{background:#fff5f5}
    .subtotal{display:flex;justify-content:space-between;padding:0.5rem 0.85rem;font-weight:700;font-size:0.85rem;margin-bottom:0.3rem}
    .total-box{background:linear-gradient(135deg,#003366,#00509e);color:#fff;border-radius:10px;padding:1rem 1.2rem;display:flex;justify-content:space-between;align-items:center;margin:0.75rem 0}
    .firmas{display:grid;grid-template-columns:1fr 1fr 1fr;gap:1rem;margin-top:2rem;padding-top:1rem;border-top:1px dashed #ccc}
    .fbox{text-align:center}
    .fline{border-top:1px solid #444;margin-bottom:5px;margin-top:2.5rem}
    .flabel{font-size:0.68rem;color:#555}
    .badge{display:inline-block;padding:0.2rem 0.6rem;border-radius:20px;font-size:0.68rem;font-weight:700;background:#e8f0fe;color:#003366}
    @media print{body{padding:0}button{display:none!important}.no-print{display:none}}
  </style></head><body>

  <div class="hdr">
    <div class="hdr-top">
      <img src="data:image/png;base64,${LOGO}" class="logo" alt="Logo"/>
      <div style="flex:1">
        <div style="font-size:0.55rem;letter-spacing:2px;color:#ffd700;text-transform:uppercase">Recibo de Pago de Nómina</div>
        <div style="font-size:0.95rem;font-family:Georgia,serif">${EMPRESA}</div>
        <div style="font-size:0.65rem;color:#adc8ff">${EMPRESA_SUB}</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:0.6rem;color:#adc8ff">N° Recibo</div>
        <div style="font-weight:800;color:#ffd700;font-size:1rem">${numRecibo}</div>
      </div>
    </div>
    <div class="hdr-nums">
      <div><div style="font-size:0.55rem;color:#adc8ff">Período</div><div style="font-weight:700;font-size:0.82rem">${escHtml(periodo)}</div></div>
      <div style="text-align:center"><div style="font-size:0.55rem;color:#adc8ff">Fecha de Pago</div><div style="font-weight:700;font-size:0.82rem">${fechaPago}</div></div>
      <div style="text-align:right"><div style="font-size:0.55rem;color:#adc8ff">Año Escolar</div><div style="font-weight:700;font-size:0.82rem">${escHtml((anioVistaObj()||{}).nombre)||anioActual()}</div></div>
    </div>
  </div>

  <div class="sec">
    <div class="worker-box">
      <div class="wf" style="grid-column:1/-1"><span>Nombre completo</span><strong style="font-size:1rem">${escHtml(t.nombre)}</strong></div>
      <div class="wf"><span>Cédula</span><strong>${escHtml(t.cedula)||"N/A"}</strong></div>
      <div class="wf"><span>Cargo</span><strong>${escHtml(t.cargo)||"N/A"}</strong></div>
    </div>

    <div style="font-size:0.7rem;font-weight:700;color:#1a9e5c;text-transform:uppercase;letter-spacing:1px;margin-bottom:0.4rem">➕ Detalle del pago</div>
    ${dz.lineas.map(l=>`<div class="concept-row ${l.ajuste?"":"earn"}"${l.ajuste?' style="background:#f3f3f3"':""}><span>${escHtml(l.etq)}</span><strong style="color:${l.ajuste?"#555":"#1a9e5c"}">${l.monto<0?"- ":""}${fmt(Math.abs(l.monto))}${l.bs!=null?` <small style="color:#555;font-weight:400">· ${l.bs<0?"- ":""}${fmtBs(Math.abs(l.bs))}</small>`:""}</strong></div>`).join("")}

    <div class="total-box">
      <div>
        <div style="font-size:0.62rem;color:#adc8ff;text-transform:uppercase;letter-spacing:1px">Total a Recibir</div>
        <div style="font-size:0.7rem;color:#adc8ff;margin-top:2px">${escHtml(periodo)}</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:1.6rem;font-weight:800;font-family:Georgia,serif;color:#ffd700">${fmt(montoPagado)}</div>${dz.totalBs!=null?`<div style="font-size:1rem;font-weight:700;color:#fff;margin-top:2px">${fmtBs(dz.totalBs)}</div><div style="font-size:0.6rem;color:#adc8ff">Tasa BCV: Bs. ${fmtTasa(dz.tasa)} por $</div>`:""}
        <div class="badge" style="background:rgba(255,255,255,0.2);color:#ffd700;margin-top:3px">PAGADO ✓</div>
      </div>
    </div>

    <div class="firmas" style="grid-template-columns:1fr 1fr">
      <div class="fbox"><div class="fline"></div><div class="flabel">Director(a)</div></div>
      <div class="fbox"><div class="fline"></div><div class="flabel">Trabajador(a)<br/><span style="font-size:0.6rem;color:#888">C.I: ${escHtml(t.cedula)||"___________"}</span></div></div>
    </div>

    <p style="text-align:center;font-size:0.62rem;color:#aaa;margin-top:1rem">
      Este recibo es válido como comprobante de pago de nómina · ${EMPRESA} · Generado el ${new Date().toLocaleDateString("es-CO")}
    </p>
  </div>

  <div class="no-print" style="text-align:center;padding:0.75rem">
    <button onclick="window.print()" style="background:linear-gradient(135deg,#003366,#00509e);color:#ffd700;border:none;padding:0.65rem 1.5rem;border-radius:8px;cursor:pointer;font-weight:700;font-size:0.9rem;font-family:inherit">🖨️ Imprimir / Guardar PDF</button>
  </div>
  </body></html>`);
  w.document.close();
}
function renderNomina(){
  const st=subTab.nomina;
  const totalNomina=trabajadores.reduce((s,t)=>s+(t.salario||0)+(t.bonoAlimentacion||0)+(t.bonoProductividad||0)-(t.descuento||0),0);
  return`
  <div class="stabs">
    ${[["lista","👷 Personal"],["nuevo","➕ Nuevo"],["historial","📋 Historial"]].map(([k,l])=>`<button class="stab ${st===k?"active":""}" onclick="trabEditId=null;subTab.nomina='${k}';renderTabContent()">${l}</button>`).join("")}
  </div>
  ${st==="nuevo"?renderFormTrabajador(trabEditId?(trabajadores.find(x=>x.id===trabEditId)||{}):{}):""}
  ${st==="lista"?`
  <div class="stats-grid">
    <div class="stat-card"><div class="stat-val">${trabajadores.length}</div><div class="stat-label">Personal</div></div>
    <div class="stat-card gold"><div class="stat-val">${fmt(totalNomina)}</div><div class="stat-label">Total Nómina</div></div>
  </div>
  ${trabajadores.length===0?`<div class="empty"><div class="empty-icon">👷</div><p>Sin trabajadores</p></div>`:
  trabajadores.map(t=>{
    const base=t.salario||0,bA=t.bonoAlimentacion||0,bP=t.bonoProductividad||0,desc=t.descuento||0,total=base+bA+bP-desc;
    return`<div class="list-item" style="border-left-color:#00509e;cursor:pointer" onclick="abrirModal({tipo:'ver-trabajador',id:'${t.id}'})">
      <div class="item-row">
        <div><div class="item-name">${escHtml(t.nombre)}</div><div class="item-sub">${escHtml(t.cargo)||"Sin cargo"} ${t.cedula?"· CC "+escHtml(t.cedula):""}</div>
        <div style="display:flex;gap:0.35rem;margin-top:3px;flex-wrap:wrap">
          <span class="badge badge-blue">Base: ${fmt(base)}</span>
          ${bA?`<span class="badge badge-green">🍽️ ${fmt(bA)}</span>`:""}
          ${bP?`<span class="badge badge-gold">⭐ ${fmt(bP)}</span>`:""}
          ${desc?`<span class="badge badge-red">- ${fmt(desc)}</span>`:""}
        </div></div>
        <div class="item-right"><div class="item-amount" style="color:#1a9e5c">${fmt(total)}</div><div class="item-hint">Ver →</div></div>
      </div>
    </div>`;}).join("")}
  `:""}
  ${st==="historial"?renderHistorialNomina():""}`;
}
function editarTrabajador(id){trabEditId=id;cerrarModal();subTab.nomina="nuevo";renderTabContent();}
function renderFormTrabajador(data={}){
  return`<div class="card">
    <div class="card-title"><div class="card-bar"></div><h2>${data.id?"Editar":"Nuevo"} Trabajador</h2></div>
    <div class="form-grid">
      <div class="field"><label class="field-label">Nombre completo *</label><input class="inp" id="t-nombre" value="${escHtml(data.nombre)||""}"/></div>
      <div class="form-row">
        <div class="field"><label class="field-label">Cédula</label><input class="inp" id="t-cedula" value="${escHtml(data.cedula)||""}"/></div>
        <div class="field"><label class="field-label">Cargo</label><input class="inp" id="t-cargo" placeholder="Ej: Docente" value="${escHtml(data.cargo)||""}"/></div>
      </div>
      <div class="field"><label class="field-label">Salario Base ($)</label>
        <div style="position:relative"><span style="position:absolute;left:1rem;top:50%;transform:translateY(-50%);color:#003366;font-weight:700">$</span>
        <input class="inp" id="t-salario" placeholder="0" style="padding-left:2rem" value="${data.salario||""}"/></div></div>
      <div class="form-row">
        <div class="field"><label class="field-label">🍽️ Bono Alim.</label>
          <div style="position:relative"><span style="position:absolute;left:0.75rem;top:50%;transform:translateY(-50%);color:#003366;font-weight:700;font-size:0.85rem">$</span>
          <input class="inp" id="t-balim" placeholder="0" style="padding-left:1.8rem" value="${data.bonoAlimentacion||""}"/></div></div>
        <div class="field"><label class="field-label">⭐ Bono Prod.</label>
          <div style="position:relative"><span style="position:absolute;left:0.75rem;top:50%;transform:translateY(-50%);color:#003366;font-weight:700;font-size:0.85rem">$</span>
          <input class="inp" id="t-bprod" placeholder="0" style="padding-left:1.8rem" value="${data.bonoProductividad||""}"/></div></div>
      </div>
      <div class="field"><label class="field-label">Descuento ($)</label>
        <div style="position:relative"><span style="position:absolute;left:1rem;top:50%;transform:translateY(-50%);color:#e53e3e;font-weight:700">$</span>
        <input class="inp" id="t-desc" placeholder="0" style="padding-left:2rem;border-color:#ffcccc" value="${data.descuento||""}"/></div></div>
      <div class="field"><label class="field-label">📅 Fecha de Ingreso</label><input class="inp" type="date" id="t-fingreso" value="${escHtml(data.fechaIngreso)||""}"/></div>
      <div class="field"><label class="field-label">Observación</label><textarea class="inp" id="t-obs" rows="2" placeholder="Ej: Razón del descuento">${escHtml(data.observacion)||""}</textarea></div>
      <div id="t-err"></div>
      <div style="display:flex;gap:0.5rem">
        <button class="btn btn-primary" style="flex:1" onclick="guardarTrabajador('${data.id||""}')">✓ Guardar</button>
        <button class="btn btn-gray" onclick="trabEditId=null;subTab.nomina='lista';renderTabContent()">Cancelar</button>
      </div>
    </div>
  </div>`;
}
function renderHistorialNomina(){
  const historial=finanzas.filter(f=>f.tipo==="gasto"&&f.categoria==="Nómina").sort((a,b)=>b.fecha.localeCompare(a.fecha));
  return`
  <button class="btn btn-primary btn-full" style="margin-bottom:0.75rem" onclick="abrirModal({tipo:'pago-nomina'})">💳 Registrar Pago de Nómina</button>
  ${historial.length===0?`<div class="empty"><div class="empty-icon">📋</div><p>Sin historial de pagos</p></div>`:
  `<div class="list">${historial.map(h=>`
    <div class="list-item" style="border-left-color:#00509e">
      <div class="item-row">
        <div style="flex:1"><div class="item-name">${escHtml(h.descripcion)}</div><div class="item-sub">${escHtml(h.fecha)} ${h.responsable?"· "+escHtml(h.responsable):""}</div>${Array.isArray(h.otros)&&h.otros.length?`<div class="item-sub">➕ ${h.otros.map(o=>escHtml(o.nombre)+": "+fmt(o.monto)).join(" · ")}</div>`:""}</div>
        <div class="item-right">
          <div class="item-amount" style="color:#e53e3e">${fmt(h.monto)}</div>${(()=>{const b=bsDe(h,h.monto);return b.bs!=null?`<div style="font-size:0.68rem;color:#888">${fmtBs(b.bs)}</div>`:"";})()}
          <button class="btn btn-print btn-sm" style="margin-top:4px;font-size:0.68rem;padding:0.25rem 0.5rem" onclick="event.stopPropagation();imprimirReciboNomina(null,'${h.id}')">🖨️ Recibo</button>
          ${rolUsuario==="director"?`<button class="btn btn-danger btn-sm" style="margin-top:4px;font-size:0.68rem;padding:0.25rem 0.5rem" onclick="event.stopPropagation();eliminarPagoNomina('${h.id}')">🗑️ Eliminar</button>`:""}
        </div>
      </div>
    </div>`).join("")}</div>`}`;
}
async function guardarTrabajador(editId){
  const nombre=document.getElementById("t-nombre").value.trim();
  if(!nombre){document.getElementById("t-err").innerHTML='<div class="error-msg">El nombre es requerido</div>';return;}
  const datos={nombre,cedula:document.getElementById("t-cedula").value.trim(),cargo:document.getElementById("t-cargo").value.trim(),
    salario:parseFmt(document.getElementById("t-salario").value),
    bonoAlimentacion:parseFmt(document.getElementById("t-balim").value),
    bonoProductividad:parseFmt(document.getElementById("t-bprod").value),
    descuento:parseFmt(document.getElementById("t-desc").value),
    fechaIngreso:document.getElementById("t-fingreso").value,
    observacion:document.getElementById("t-obs").value.trim()};
  try{
    if(editId){await db.collection("trabajadores").doc(editId).update(datos);const i=trabajadores.findIndex(t=>t.id===editId);if(i>=0)trabajadores[i]={...trabajadores[i],...datos};alertaNomina(datos,"✏️ Actualizado en");}
    else{const ref=await db.collection("trabajadores").add(datos);datos.id=ref.id;trabajadores.push(datos);alertaNomina(datos,"➕ Registrado en");}
    trabEditId=null;subTab.nomina="lista";cerrarModal();renderTabContent();
  }catch(e){document.getElementById("t-err").innerHTML=`<div class="error-msg">${escHtml(e.message)}</div>`;}
}
function renderModalVerTrabajador(m){
  const t=trabajadores.find(x=>x.id===m.id);if(!t)return"";
  const base=t.salario||0,bA=t.bonoAlimentacion||0,bP=t.bonoProductividad||0,desc=t.descuento||0,total=base+bA+bP-desc;
  return`<div class="modal-bg" onclick="if(event.target.classList.contains('modal-bg'))cerrarModal()">
    <div class="modal">
      <div class="modal-header"><div><h3>👷 ${escHtml(t.nombre)}</h3><p>${escHtml(t.cargo)||"Sin cargo"}</p></div><button class="modal-close-x" onclick="cerrarModal()">✕</button></div>
      <div class="modal-body">
        ${[["CC",t.cedula||"N/A"],["Cargo",t.cargo||"N/A"]].map(([l,v])=>`<div class="info-row"><span style="color:#888;font-size:0.8rem">${l}</span><span style="font-weight:600;font-size:0.82rem">${escHtml(v)}</span></div>`).join("")}
        <hr class="divider"/>
        ${[["Salario Base","#003366",base],["Bono Alimentación","#1a9e5c",bA],["Bono Productividad","#b8860b",bP],["Descuento","#e53e3e",-desc]].filter(([,c,v])=>v!==0).map(([l,c,v])=>`
        <div style="display:flex;justify-content:space-between;padding:0.4rem 0.75rem;background:#f8faff;border-radius:8px;margin-bottom:0.35rem">
          <span style="font-size:0.82rem;color:#555">${l}</span>
          <span style="font-weight:700;color:${c}">${fmt(Math.abs(v))}</span>
        </div>`).join("")}
        <div style="display:flex;justify-content:space-between;padding:0.75rem 1rem;background:linear-gradient(135deg,#003366,#00509e);border-radius:10px;color:#fff;margin-top:0.4rem">
          <span style="color:#ffd700;font-weight:700">TOTAL NÓMINA</span>
          <span style="font-size:1.2rem;font-weight:800;font-family:Georgia,serif">${fmt(total)}</span>
        </div>
        ${t.observacion?`<div style="margin-top:0.65rem;padding:0.6rem 0.75rem;background:#f8faff;border-radius:8px;font-size:0.8rem;color:#555">📝 ${escHtml(t.observacion)}</div>`:""}
      </div>
      <div class="modal-actions">
        <button class="btn btn-print" style="flex:1" onclick="imprimirReciboNomina('${t.id}',null)">🖨️ Recibo Nómina</button>
        <button class="btn btn-primary btn-sm" onclick="editarTrabajador('${t.id}')">✏️</button>
        ${rolUsuario==="director"?`<button class="btn btn-danger btn-sm" onclick="eliminarTrabajador('${t.id}')">🗑️</button>`:""}
        <button class="btn btn-gray" onclick="cerrarModal()">Cerrar</button>
      </div>
    </div>
  </div>`;
}
function imprimirReciboNominaPago(pago, trab){
  const num = "NOM-"+String(Math.floor(Math.random()*900000)+100000);
  const nombreTrab = trab?trab.nombre:(pago.responsable||"Trabajador");
  const cedulaTrab = trab?trab.cedula||"N/A":"N/A";
  const cargoTrab = trab?trab.cargo||"N/A":"N/A";
  const dz = desgloseRecibo(pago, trab);   // conceptos del recibo; el total es lo realmente pagado
  const neto = dz.total;

  const w = window.open("","_blank");
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
  <title>Recibo Nómina ${num}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:Arial,sans-serif;padding:24px;color:#222;font-size:13px}
    .header{background:#003366;color:#fff;padding:16px 20px;border-radius:8px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center}
    .header h1{font-size:1rem;color:#ffd700}
    .header p{font-size:0.72rem;color:#adc8ff;margin-top:3px}
    .num{font-size:0.75rem;color:#adc8ff;text-align:right}
    .section{margin-bottom:12px}
    .section-title{font-size:0.7rem;font-weight:700;color:#003366;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;padding-bottom:4px;border-bottom:1px solid #e0e8f0}
    .row{display:flex;justify-content:space-between;padding:5px 8px;font-size:0.82rem;border-radius:4px}
    .row:nth-child(odd){background:#f8faff}
    .row.ing{color:#1a9e5c}
    .row.desc{color:#e53e3e}
    .total-box{background:#003366;color:#fff;padding:12px 16px;border-radius:8px;display:flex;justify-content:space-between;align-items:center;margin-top:12px}
    .total-box .label{font-size:0.82rem;color:#adc8ff}
    .total-box .amount{font-size:1.3rem;font-weight:800;color:#ffd700}
    .firmas{display:flex;justify-content:space-between;margin-top:32px;padding-top:16px;border-top:2px solid #003366}
    .firma{text-align:center;width:45%}
    .firma-line{border-top:1px solid #333;margin-top:48px;padding-top:6px;font-size:0.75rem;color:#555}
    @media print{button{display:none!important}}
  </style></head><body>
  <button onclick="window.print()" style="margin-bottom:14px;padding:7px 16px;background:#003366;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:0.82rem">🖨️ Imprimir</button>
  <div class="header">
    <div>
      <h1>🏫 U.E.P. Josefa Joaquina Sánchez</h1>
      <p>Turumo - Caucagüita, Estado Miranda, Venezuela</p>
    </div>
    <div class="num">
      <div style="font-size:1rem;font-weight:800;color:#ffd700">${num}</div>
      <div>Recibo de Nómina</div>
      <div>${escHtml(pago.fecha)||""}</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">👤 Datos del Trabajador</div>
    <div class="row"><span>Nombre</span><span style="font-weight:700">${escHtml(nombreTrab)}</span></div>
    <div class="row"><span>Cédula</span><span>${escHtml(cedulaTrab)}</span></div>
    <div class="row"><span>Cargo</span><span>${escHtml(cargoTrab)}</span></div>
    <div class="row"><span>Período</span><span>${escHtml(pago.descripcion)||""}</span></div>
  </div>

  <div class="section">
    <div class="section-title">💰 Detalle del pago</div>
    ${dz.lineas.map(l=>`<div class="row ${l.ajuste?"":"ing"}"><span>${escHtml(l.etq)}</span><span>${l.monto<0?"-":""}${fmt(Math.abs(l.monto))}${l.bs!=null?` <span style="color:#555">· ${l.bs<0?"-":""}${fmtBs(Math.abs(l.bs))}</span>`:""}</span></div>`).join("")}
  </div>

  <div class="total-box">
    <div>
      <div class="label">Total a recibir</div>
      <div style="font-size:0.72rem;color:#adc8ff">${escHtml(pago.fecha)||""}</div>
    </div>
    <div class="amount">${fmt(neto)}${dz.totalBs!=null?`<div style="font-size:0.85rem;color:#fff;font-weight:700">${fmtBs(dz.totalBs)}</div><div style="font-size:0.62rem;color:#adc8ff;font-weight:400">Tasa BCV: Bs. ${fmtTasa(dz.tasa)} por $</div>`:""}</div>
  </div>

  <div class="firmas">
    <div class="firma"><div class="firma-line">Ligia Herrera<br/>Directora</div></div>
    <div class="firma"><div class="firma-line">${escHtml(nombreTrab)}<br/>Trabajador / Firma</div></div>
  </div>
  </body></html>`);
  w.document.close();
  setTimeout(()=>w.print(),500);
}
// Fila en blanco para un concepto adicional (nombre + valor). Varían cada vez, por eso quedan vacías.
// Fila en blanco para un concepto adicional (nombre + valor en $ de referencia). Varían cada vez, por eso quedan vacías.
const filaOtroConcepto=i=>`<div class="form-row pn-otro" style="margin-bottom:0.4rem">
    <div class="field"><input class="inp" id="pn-otro-n-${i}" placeholder="Nombre del concepto" autocomplete="off"/></div>
    <div class="field"><div style="position:relative"><span style="position:absolute;left:0.8rem;top:50%;transform:translateY(-50%);color:#1a9e5c;font-weight:700;font-size:0.8rem">$</span>
      <input class="inp" id="pn-otro-v-${i}" placeholder="0,00" inputmode="decimal" autocomplete="off" style="padding-left:1.8rem" oninput="fmtInput(this);calcNetoNomina()"/></div></div>
  </div>`;
function agregarOtroConcepto(){
  const cont=document.getElementById("pn-otros"); if(!cont) return;
  const n=cont.querySelectorAll(".pn-otro").length;
  if(n>=10){alert("Máximo 10 conceptos adicionales por pago");return;}
  cont.insertAdjacentHTML("beforeend",filaOtroConcepto(n));
  const inp=document.getElementById("pn-otro-n-"+n); if(inp) inp.focus();
}
// Lee los conceptos adicionales. Fila vacía = se ignora; con nombre y sin valor (o al revés) = error.
function leerOtrosConceptos(){
  const lista=[]; let error="";
  for(let i=0;;i++){
    const elN=document.getElementById("pn-otro-n-"+i), elV=document.getElementById("pn-otro-v-"+i);
    if(!elN||!elV) break;
    const nombre=elN.value.trim(), monto=parseFmt(elV.value);
    if(nombre&&monto>0) lista.push({nombre,monto});
    else if(nombre&&!monto&&!error) error="Falta el valor del concepto «"+nombre+"»";
    else if(!nombre&&monto>0&&!error) error="Falta el nombre del concepto de "+fmt(monto);
  }
  return {lista,error};
}
function renderModalPagoNomina(){
  return`<div class="modal-bg"><div class="modal">
    <div class="modal-header"><div><h3>💳 Registrar Pago de Nómina</h3><p>Montos en $ de referencia · se paga en Bs. a la tasa BCV</p></div><button class="modal-close-x" onclick="cerrarModal()">✕</button></div>
    <div class="modal-body">
      <div class="form-grid">
        <div class="field"><label class="field-label">Descripción *</label><input class="inp" id="pn-desc" placeholder="Ej: Pago nómina Enero 2025"/></div>
        <div class="form-row">
          <div class="field"><label class="field-label">Fecha *</label><input class="inp" type="date" id="pn-fecha" value="${todayStr()}" onchange="actualizarTasaCampo('pn',calcNetoNomina)"/></div>
          <div class="field"><label class="field-label">Trabajador</label>
            <select class="inp" id="pn-trab" onchange="autoFillMontoNomina(this.value)">
              <option value="Todos">-- Seleccionar --</option>
              ${trabajadores.map(t=>`<option value="${t.id}">${escHtml(t.nombre)} — ${escHtml(t.cargo)||"Sin cargo"}</option>`).join("")}
            </select>
          </div>
        </div>
        <div class="field"><label class="field-label">Monto a pagar ($ referencia) *</label>
          <div style="position:relative"><span style="position:absolute;left:1rem;top:50%;transform:translateY(-50%);color:#1a9e5c;font-weight:700">$</span>
          <input class="inp" id="pn-monto" placeholder="0,00" style="padding-left:2rem" oninput="fmtInput(this);calcNetoNomina()"/></div>
        </div>
        <div class="field">
          <label class="field-label">➕ Otros conceptos a pagar <span style="font-weight:400;color:#888">(opcional · nombre y valor en $)</span></label>
          <div id="pn-otros">${[0,1,2].map(filaOtroConcepto).join("")}</div>
          <button type="button" class="btn btn-gray btn-sm" onclick="agregarOtroConcepto()">+ Agregar otro concepto</button>
        </div>
        <div class="field"><label class="field-label">Descuento (adelanto/préstamo) en $</label>
          <div style="position:relative"><span style="position:absolute;left:1rem;top:50%;transform:translateY(-50%);color:#e53e3e;font-weight:700">$</span>
          <input class="inp" id="pn-descuento" placeholder="0,00" style="padding-left:2rem" oninput="fmtInput(this);calcNetoNomina()"/></div>
          <div style="font-size:0.72rem;color:#888;margin-top:3px">Por adelanto de quincena, préstamo u otro concepto</div>
        </div>
        ${campoTasaHTML("pn",null,"calcNetoNomina()")}
        <div id="pn-neto-box" style="display:none;background:#e8f0fe;border-radius:10px;padding:0.75rem;margin-top:0.25rem">
          <div style="display:flex;justify-content:space-between;font-size:0.82rem;margin-bottom:4px">
            <span style="color:#555">Monto a pagar</span><span id="pn-neto-monto" style="color:#1a9e5c;font-weight:700"></span>
          </div>
          <div id="pn-neto-otros-row" style="display:none;justify-content:space-between;font-size:0.82rem;margin-bottom:4px">
            <span style="color:#555">Otros conceptos</span><span id="pn-neto-otros" style="color:#1a9e5c;font-weight:700"></span>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:0.82rem;margin-bottom:4px">
            <span style="color:#555">Descuento</span><span id="pn-neto-desc" style="color:#e53e3e;font-weight:700"></span>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:0.88rem;border-top:1px solid #c5d8f0;padding-top:6px;margin-top:4px">
            <span style="font-weight:700;color:#003366">Total a entregar (ref.)</span><span id="pn-neto-total" style="font-weight:800;color:#003366;font-size:1rem"></span>
          </div>
          <div id="pn-neto-bs-row" style="display:none;justify-content:space-between;font-size:0.95rem;margin-top:4px">
            <span style="font-weight:700;color:#003366">Total en bolívares</span><span id="pn-neto-bs" style="font-weight:800;color:#003366"></span>
          </div>
        </div>
        <div id="pn-err"></div>
      </div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-primary" style="flex:1" onclick="guardarPagoNomina()">✓ Registrar y Generar Recibo</button>
      <button class="btn btn-gray" onclick="cerrarModal()">Cancelar</button>
    </div>
  </div></div>`;
}
function autoFillMontoNomina(trabId){
  const t = trabajadores.find(w=>w.id===trabId);
  if(!t) return;
  const neto = (t.salario||0)+(t.bonoAlimentacion||0)+(t.bonoProductividad||0)-(t.descuento||0);
  const el = document.getElementById("pn-monto");
  if(el){ el.value = neto.toFixed(2).replace(".",","); fmtInput(el); }
  calcNetoNomina();
}
function calcNetoNomina(){
  const monto = parseFmt(document.getElementById("pn-monto")?.value||"0");
  const desc = parseFmt(document.getElementById("pn-descuento")?.value||"0");
  const otros = leerOtrosConceptos().lista.reduce((x,o)=>x+o.monto,0);
  const tasa = parseTasa(document.getElementById("pn-tasa")?.value||"0");
  const box = document.getElementById("pn-neto-box");
  if(!box) return;
  if(monto>0||otros>0){
    const neto=Math.max(0,r2(monto+otros-desc));
    box.style.display="block";
    document.getElementById("pn-neto-monto").textContent = fmt(monto);
    document.getElementById("pn-neto-otros-row").style.display = otros>0?"flex":"none";
    document.getElementById("pn-neto-otros").textContent = "+"+fmt(otros);
    document.getElementById("pn-neto-desc").textContent = desc>0?"-"+fmt(desc):fmt(0);
    document.getElementById("pn-neto-total").textContent = fmt(neto);
    const rb=document.getElementById("pn-neto-bs-row");
    rb.style.display = tasa>0?"flex":"none";
    document.getElementById("pn-neto-bs").textContent = tasa>0?fmtBs(r2(neto*tasa)):"";
  } else {
    box.style.display="none";
  }
}
async function guardarPagoNomina(){
  const desc=document.getElementById("pn-desc").value.trim();
  const fecha=document.getElementById("pn-fecha").value;
  const trabId=document.getElementById("pn-trab").value;
  const descuento=parseFmt(document.getElementById("pn-descuento")?.value||"0");
  const monto=parseFmt(document.getElementById("pn-monto").value);
  const tasa=parseTasa(document.getElementById("pn-tasa")?document.getElementById("pn-tasa").value:"0");
  const err=m=>{document.getElementById("pn-err").innerHTML=`<div class="error-msg">${m}</div>`;};
  const {lista,error:errOtros}=leerOtrosConceptos();
  if(errOtros){err(errOtros);return;}
  const totalOtros=lista.reduce((x,o)=>x+o.monto,0);
  if(!desc||(!monto&&!totalOtros)){err("Completa descripción y monto");return;}
  if(!fecha){err("Elige la fecha del pago");return;}
  if(!(tasa>0)){err("Falta la tasa BCV: cárgala con 💱 (arriba) o escríbela en el formulario");return;}
  const neto=Math.max(0,r2(monto+totalOtros-descuento));
  if(neto<=0){err("El total a entregar debe ser mayor que 0");return;}
  const otros=lista.map(o=>({nombre:o.nombre,monto:o.monto,montoBs:r2(o.monto*tasa)}));
  const trab=trabajadores.find(t=>t.id===trabId)||null;
  const datos={tipo:"gasto",descripcion:desc,fecha,categoria:"Nómina",
    monto:neto,montoBs:r2(neto*tasa),tasa,montoBase:monto,descuento,otros,
    responsable:trab?trab.nombre:trabId,trabajadorId:trabId,
    timestamp:firebase.firestore.FieldValue.serverTimestamp()};
  try{
    const ref=await db.collection("finanzas").add(datos);datos.id=ref.id;finanzas.push(datos);
    recordarTasa(fecha,tasa);
    alertaPagoNomina(datos.descripcion,datos.monto,datos.responsable);
    cerrarModal();
    imprimirReciboNominaPago(datos,trab);
  }catch(e){err(e.message);}
}
async function eliminarTrabajador(id){
  if(!confirm("¿Eliminar este trabajador?"))return;
  try{await db.collection("trabajadores").doc(id).delete();trabajadores=trabajadores.filter(t=>t.id!==id);cerrarModal();}
  catch(e){alert("Error: "+e.message);}
}
async function eliminarPagoNomina(id){
  if(rolUsuario!=="director"){alert("Sin permiso");return;}
  if(!confirm("¿Eliminar este pago de nómina?"))return;
  try{
    await db.collection("finanzas").doc(id).delete();
    finanzas=finanzas.filter(f=>f.id!==id);
    renderTabContent();
  }catch(e){alert("Error: "+e.message);}
}
