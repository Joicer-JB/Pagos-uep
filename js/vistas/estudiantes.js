// Pestaña Estudiantes: lista, ficha, registro y edición, unificación de grados y constancia de estudio.

// Datos que conviene completar (los estudiantes importados pueden llegar con alguno vacío)
function datosFaltantes(e){
  const f=[];
  if(!e.cedula) f.push("cédula");
  if(!e.fechaNac) f.push("fecha de nacimiento");
  if(!e.acudiente) f.push("representante");
  if(!normalizarTelVE(e.telefonoAcudiente)&&!normalizarTelVE(e.telefono)) f.push("teléfono");
  return f;
}
// Estudiantes cuyo grado está escrito de otra forma (ej: «Preescolar I» en vez de «Nivel I»): se pueden unificar con un clic
function gradosPorCorregir(){
  return estudiantes.filter(e=>e.grado&&gradoCanon(e.grado)&&gradoCanon(e.grado)!==e.grado).map(e=>({id:e.id,de:e.grado,a:gradoCanon(e.grado)}));
}
function htmlAvisoGrados(){
  if(rolUsuario==="docente"||soloLectura()) return "";
  const c=gradosPorCorregir(); if(!c.length) return "";
  const g=new Map(); c.forEach(x=>{const k=x.de+" → "+x.a;g.set(k,(g.get(k)||0)+1);});
  return `<div class="alert-item alert-mora" style="display:block;margin-bottom:0.75rem">
    <div style="font-weight:700">🧹 ${c.length} estudiante${c.length===1?"":"s"} con el grado escrito de otra forma</div>
    <div style="font-size:0.76rem;margin:3px 0 6px">${[...g].map(([k,n])=>escHtml(k)+" ("+n+")").join(" · ")}</div>
    <button class="btn btn-primary btn-sm" onclick="unificarGrados()">Unificar grados</button></div>`;
}
async function unificarGrados(){
  if(soloLectura()){alert("Estás viendo un año anterior (solo lectura).");return;}
  const c=gradosPorCorregir(); if(!c.length){alert("Todos los grados ya están unificados");return;}
  const g=new Map(); c.forEach(x=>{const k=x.de+" → "+x.a;g.set(k,(g.get(k)||0)+1);});
  if(!confirm("Se corregirá el nombre del grado de "+c.length+" estudiantes:\n\n"+[...g].map(([k,n])=>"• "+k+" ("+n+")").join("\n")+"\n\n¿Continuar?")) return;
  try{
    for(let i=0;i<c.length;i+=400){
      const b=db.batch(),t=c.slice(i,i+400);
      t.forEach(x=>b.update(db.collection("estudiantes").doc(x.id),{grado:x.a}));
      await b.commit();
      t.forEach(x=>{const k=estudiantes.findIndex(e=>e.id===x.id);if(k>=0)estudiantes[k]={...estudiantes[k],grado:x.a};});
    }
    filtros.gradoEst="";renderTabContent();
  }catch(e){alert("No se pudo unificar: "+e.message);renderTabContent();}
}
function renderEstudiantes(){
  const mora=estudiantes.filter(enMora);
  const activos=estudiantes.filter(activo);
  let filtrados=estudiantes.filter(e=>{
    const mB=!filtros.busq||e.nombre.toLowerCase().includes(filtros.busq.toLowerCase())||(e.cedula||"").includes(filtros.busq);
    const mE=filtros.estado==="graduado"?!!e.graduado
      :filtros.estado==="retirado"?e.estado==="retirado"
      :filtros.estado==="mora"?enMora(e)
      :filtros.estado==="alsaldo"?(activo(e)&&!enMora(e))
      :(!e.graduado||enMora(e));   // sin filtro: los graduados sin deuda no aparecen
    const mA=!filtros.anioEst||e.anioEscolar===filtros.anioEst;
    const mG=!filtros.gradoEst||e.grado===filtros.gradoEst;
    return mB&&mE&&mA&&mG;
  });
  return`
  <div class="stats-grid">
    <div class="stat-card"><div class="stat-val">${estudiantes.filter(e=>!e.graduado).length}</div><div class="stat-label">Total</div></div>
    <div class="stat-card green"><div class="stat-val">${activos.length-mora.length}</div><div class="stat-label">✅ Al Saldo</div></div>
    <div class="stat-card red"><div class="stat-val">${mora.length}</div><div class="stat-label">⚠️ En Mora</div></div>
    <div class="stat-card gold"><div class="stat-val">${fmt(mora.reduce((s,e)=>s+deudaDe(e),0))}</div><div class="stat-label">Total Mora</div></div>
  </div>
  ${htmlAvisoGrados()}
  <button class="btn btn-primary btn-full" style="margin-bottom:0.75rem" onclick="abrirModal({tipo:'nuevo-estudiante'})">➕ Agregar Estudiante</button>
  <div class="search-bar">
    <input class="inp" id="search-input" placeholder="🔍 Buscar estudiante..." value="${filtros.busq}" oninput="onBusqInput(this.value)"/>
  </div>
  <div style="display:flex;gap:0.5rem;margin-bottom:0.85rem;flex-wrap:wrap">
    <select class="inp" style="flex:1;padding:0.6rem 0.85rem;font-size:0.82rem" onchange="filtros.estado=this.value;renderTabContent()">
      <option value="">Todos los estados</option>
      <option value="alsaldo" ${filtros.estado==="alsaldo"?"selected":""}>✅ Al Saldo</option>
      <option value="mora" ${filtros.estado==="mora"?"selected":""}>⚠️ En Mora</option>
      <option value="retirado" ${filtros.estado==="retirado"?"selected":""}>🚪 Retirado</option>
      <option value="graduado" ${filtros.estado==="graduado"?"selected":""}>🎓 Graduado</option>
    </select>
    <select class="inp" style="flex:1;padding:0.6rem 0.85rem;font-size:0.82rem" onchange="filtros.anioEst=this.value;renderTabContent()">
      <option value="">Todos los años</option>
      ${[...new Set([...estudiantes.map(e=>e.anioEscolar),escCfg&&escCfg.actual.nombre].filter(Boolean))].sort().map(a=>`<option value="${escHtml(a)}" ${filtros.anioEst===a?"selected":""}>${escHtml(a)}</option>`).join("")}
    </select>
    <select class="inp" style="flex:1;padding:0.6rem 0.85rem;font-size:0.82rem" onchange="filtros.gradoEst=this.value;renderTabContent()">
      <option value="">Todos los grados</option>
      ${[...new Set(estudiantes.map(e=>e.grado).filter(Boolean))].sort(ordenGrados).map(g=>`<option value="${escHtml(g)}" ${filtros.gradoEst===g?"selected":""}>${escHtml(g)}</option>`).join("")}
    </select>
  </div>
  <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem;padding:0.5rem 0.75rem;background:#e8f0fe;border-radius:8px">
    <span style="font-size:1.2rem;font-weight:800;color:#003366;min-width:32px;text-align:center">${filtrados.length}</span>
    <span style="font-size:0.78rem;color:#555">${filtrados.length===1?"estudiante":"estudiantes"}${filtros.gradoEst?" en "+escHtml(filtros.gradoEst):filtros.estado?" con estado "+escHtml(filtros.estado):filtros.busq?" encontrados":""}</span>
  </div>
  ${filtrados.length===0?`<div class="empty"><div class="empty-icon">👨‍🎓</div><p>No hay estudiantes</p></div>`:
  `<div class="list">${filtrados.map(e=>`
    <div class="list-item ${enMora(e)?"mora":e.estado==="retirado"?"":"alsaldo"}" onclick="abrirModal({tipo:'ver-estudiante',id:'${e.id}'})">
      <div class="item-row">
        <div style="flex:1;min-width:0">
          <div class="item-name">${escHtml(e.nombre)}</div>
          <div class="item-sub">${escHtml(e.grado)||""} ${e.cedula?"· CC "+escHtml(e.cedula):""}</div>
          <div class="item-sub">📞 ${escHtml(e.telefono)||"Sin teléfono"} ${e.acudiente?"· 👤 "+escHtml(e.acudiente):""}</div>
          ${datosFaltantes(e).length&&activo(e)?`<div class="item-sub" style="color:#b7791f">⚠️ Falta: ${datosFaltantes(e).join(", ")}</div>`:""}
          ${deudaDe(e)>0?`<div style="font-size:0.72rem;color:#e53e3e;font-weight:700;margin-top:2px">Debe: ${fmt(deudaDe(e))}${tasaHoy()?" · "+fmtBs(aBs(deudaDe(e))):""}</div>`:""}
        </div>
        <div class="item-right">
          <span class="badge ${enMora(e)?"badge-red":e.estado==="retirado"?"badge-gray":e.graduado?"badge-gold":"badge-green"}">${enMora(e)?"⚠️ Mora":e.estado==="retirado"?"🚪 Retirado":e.graduado?"🎓 Graduado":"✅ Al Saldo"}</span>
          <div style="font-size:0.7rem;color:#888;margin-top:3px">${fmt(e.mensualidad||0)}/mes</div>
        </div>
      </div>
    </div>`).join("")}</div>`}`;
}
function renderModalEstudiante(e){
  const isEdit=!!e.id;
  return`<div class="modal-bg"><div class="modal">
    <div class="modal-header"><div><h3>👨‍🎓 ${isEdit?"Editar":"Nuevo"} Estudiante</h3></div><button class="modal-close-x" onclick="cerrarModal()">✕</button></div>
    <div class="modal-body">
      <div class="form-grid">
        <div class="field"><label class="field-label">Nombre completo *</label><input class="inp" id="e-nombre" value="${escHtml(e.nombre)||""}"/></div>
        <div class="form-row">
          <div class="field"><label class="field-label">Cédula</label><input class="inp" id="e-cedula" value="${escHtml(e.cedula)||""}"/></div>
          <div class="field"><label class="field-label">Fecha Nacimiento</label><input class="inp" type="date" id="e-fn" value="${escHtml(e.fechaNac)||""}"/></div>
        </div>
        <div class="form-row">
          <div class="field"><label class="field-label">Grado *</label>
            <select class="inp" id="e-grado"><option value="">Seleccionar...</option>
              ${ESCALERA.map(g=>`<option value="${g}" ${(gradoCanon(e.grado)||e.grado)===g?"selected":""}>${g}</option>`).join("")}
              ${e.grado&&!gradoCanon(e.grado)?`<option value="${escHtml(e.grado)}" selected>${escHtml(e.grado)} (revisar)</option>`:""}
            </select></div>
          <div class="field"><label class="field-label">Jornada</label>
            <select class="inp" id="e-jornada"><option value="Mañana" ${e.jornada==="Mañana"?"selected":""}>Mañana</option><option value="Tarde" ${e.jornada==="Tarde"?"selected":""}>Tarde</option></select>
          </div>
        </div>
        <div class="form-row">
          <div class="field"><label class="field-label">Teléfono</label><input class="inp" id="e-tel" value="${escHtml(e.telefono)||""}"/></div>
          </div>
        <div class="form-row">
          <div class="field"><label class="field-label">Acudiente</label><input class="inp" id="e-acud" placeholder="Nombre del acudiente" value="${escHtml(e.acudiente||"")}"/></div>
          <div class="field"><label class="field-label">Tel. Acudiente</label><input class="inp" id="e-telacud" value="${escHtml(e.telefonoAcudiente||"")}"/></div>
        </div>
        <div class="form-row">
          <div class="field"><label class="field-label">Cédula del acudiente</label><input class="inp" id="e-cedacud" value="${escHtml(e.cedulaAcudiente||"")}"/></div>
          <div class="field"><label class="field-label">Sexo</label>
            <select class="inp" id="e-sexo"><option value="">—</option><option value="M" ${e.sexo==="M"?"selected":""}>Masculino</option><option value="F" ${e.sexo==="F"?"selected":""}>Femenino</option></select></div>
        </div>
        <div class="field"><label class="field-label">Observaciones médicas (alergias, condiciones)</label>
          <textarea class="inp" id="e-med" rows="2" placeholder="Vacío = no padece">${escHtml(e.observacionesMedicas||"")}</textarea></div>
            <div class="field"><label class="field-label">Correo del acudiente (opcional)</label><input class="inp" id="e-correo-acud" type="email" placeholder="nombre@gmail.com" value="${escHtml(e.correoAcudiente)||""}"/></div>
        <div class="field"><label class="field-label">Mensualidad ($)</label>
          <div style="position:relative"><span style="position:absolute;left:1rem;top:50%;transform:translateY(-50%);color:#003366;font-weight:700">$</span>
          <input class="inp" id="e-mens" placeholder="0,00" style="padding-left:2rem" value="${e.mensualidad?String(e.mensualidad).replace('.',','):''}" oninput="fmtInput(this)"/></div></div>
        <div class="field"><label class="field-label">Paga cuotas desde (opcional)</label>
          <input class="inp" type="month" id="e-cuota-desde" value="${escHtml(e.cuotaDesde)||""}"/>
          <div style="font-size:0.68rem;color:#888;margin-top:2px">Déjalo vacío si paga desde la primera cuota. Úsalo para quien entró después de que empezó el año.</div></div>
        <div class="form-row">
          <div class="field"><label class="field-label">Estado</label>
            <select class="inp" id="e-estado" onchange="toggleMoraFields()">
              <option value="alsaldo" ${(e.estado||"alsaldo")==="alsaldo"?"selected":""}>✅ Al Saldo</option>
              <option value="mora" ${e.estado==="mora"?"selected":""}>⚠️ En Mora</option>
              <option value="retirado" ${e.estado==="retirado"?"selected":""}>🚪 Retirado</option>
            </select>
          </div>
          <div class="field"><label class="field-label">Año Escolar</label><input class="inp" id="e-anio" value="${escHtml(e.anioEscolar)||(escCfg?escHtml(escCfg.actual.nombre):String(anioActual()))}"/></div>
        </div>
        <label style="display:flex;gap:0.5rem;align-items:center;font-size:0.82rem;margin:0.4rem 0"><input type="checkbox" id="e-graduado" ${e.graduado?"checked":""}/> 🎓 Graduado (egresado)</label>
        <label style="display:flex;gap:0.5rem;align-items:center;font-size:0.82rem;margin:0.4rem 0"><input type="checkbox" id="e-sinrec" ${e.sinRecargo?"checked":""}/> 🤝 Exonerado de recargos por mora</label>
        <div id="mora-fields" style="display:${e.estado==="mora"?"flex":"none"};flex-direction:column;gap:0.75rem;background:#fff5f5;border-radius:10px;padding:0.85rem;border-left:4px solid #e53e3e">
          <div class="field"><label class="field-label" style="color:#e53e3e">⚠️ Concepto de Mora</label>
            <textarea class="inp" id="e-mora-concepto" rows="2" placeholder="Ej: Mensualidad Enero y Febrero sin cancelar">${escHtml(e.moraConcepto)||""}</textarea></div>
          <div class="field"><label class="field-label" style="color:#e53e3e">💰 Monto que debe</label>
            <div style="position:relative"><span style="position:absolute;left:1rem;top:50%;transform:translateY(-50%);color:#e53e3e;font-weight:700">$</span>
            <input class="inp" id="e-mora-monto" placeholder="0,00" style="padding-left:2rem;border-color:#ffcccc" value="${e.moraMonto?String(e.moraMonto).replace('.',','):''}" oninput="fmtInput(this)"/></div></div>
        </div>
        <div id="modal-err"></div>
      </div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-primary" style="flex:1" onclick="guardarEstudiante('${e.id||""}')">✓ Guardar</button>
      ${isEdit&&rolUsuario==="director"?`<button class="btn btn-danger btn-sm" onclick="eliminarEstudiante('${e.id}')">🗑️</button>`:""}
      <button class="btn btn-gray" onclick="cerrarModal()">Cancelar</button>
    </div>
  </div></div>`;
}
function toggleMoraFields(){
  const sel=document.getElementById("e-estado");
  const f=document.getElementById("mora-fields");
  if(sel&&f)f.style.display=sel.value==="mora"?"flex":"none";
}
function renderModalVerEstudiante(m){
  const e=estudiantes.find(x=>x.id===m.id);if(!e)return"";
  const pagosEst=pagos.filter(p=>p.nombre.toLowerCase()===e.nombre.toLowerCase());
  const totalPag=pagosEst.reduce((s,p)=>s+p.total,0);
  const edad=calcEdad(e.fechaNac);
  return`<div class="modal-bg" onclick="if(event.target.classList.contains('modal-bg'))cerrarModal()">
    <div class="modal">
      <div class="modal-header">
        <div><h3>👨‍🎓 ${escHtml(e.nombre)}</h3><p>${escHtml(e.grado)||""} ${e.jornada?"· "+escHtml(e.jornada):""}</p></div>
        <button class="modal-close-x" onclick="cerrarModal()">✕</button>
      </div>
      <div class="modal-body">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem">
          <span class="badge ${enMora(e)?"badge-red":e.estado==="retirado"?"badge-gray":e.graduado?"badge-gold":"badge-green"} " style="font-size:0.8rem;padding:0.3rem 0.75rem">${enMora(e)?"⚠️ En Mora":e.estado==="retirado"?"🚪 Retirado":e.graduado?"🎓 Graduado"+(e.graduadoEn?" · "+escHtml(e.graduadoEn):""):"✅ Al Saldo"}</span>
          <span style="font-size:0.75rem;color:#888">Año: ${escHtml(e.anioEscolar)||anioActual()}</span>
        </div>
        ${[["📛 Cédula",e.cedula||"N/A"],["🎂 Edad",edad?edad+" años":"N/A"],["📞 Teléfono",e.telefono||"N/A"],["🏠 Dirección",e.direccion||"N/A"],["👤 Acudiente",e.acudiente||"N/A"],["📞 Tel. Acudiente",e.telefonoAcudiente||"N/A"]].map(([l,v])=>`
        <div class="info-row"><span style="color:#888;font-size:0.8rem">${l}</span><span style="font-weight:600;font-size:0.82rem;color:#333">${escHtml(v)}</span></div>`).join("")}
        <hr class="divider"/>
        <div style="display:flex;gap:0.5rem;margin-bottom:0.75rem">
          <div style="flex:1;background:#f0f4ff;border-radius:10px;padding:0.75rem;text-align:center">
            <div style="font-size:0.62rem;color:#888">Mensualidad</div>
            <div style="font-weight:800;color:#003366">${fmt(e.mensualidad||0)}</div>
          </div>
          <div style="flex:1;background:#e6f7ef;border-radius:10px;padding:0.75rem;text-align:center">
            <div style="font-size:0.62rem;color:#888">Total Pagado</div>
            <div style="font-weight:800;color:#1a9e5c">${fmt(totalPag)}</div>
          </div>
        </div>
        ${htmlEstadoCuenta(e)}
        ${e.estado==="mora"&&(e.moraConcepto||e.moraMonto)?`
        <div class="mora-box">
          <div style="font-size:0.62rem;color:#e53e3e;text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:5px">⚠️ Detalle de Mora</div>
          ${e.moraConcepto?`<div style="font-size:0.85rem;color:#333;margin-bottom:4px">📋 ${escHtml(e.moraConcepto)}</div>`:""}
          ${e.moraMonto?`<div style="display:flex;justify-content:space-between;background:#ffe0e0;border-radius:8px;padding:0.5rem 0.75rem;margin-top:3px"><span style="font-size:0.8rem;color:#c0392b;font-weight:600">Adeuda</span><span style="font-weight:800;color:#e53e3e">${fmt(e.moraMonto)}</span></div>`:""}
        </div>`:""}
        <div style="font-size:0.72rem;color:#888;margin-bottom:0.4rem">Últimos pagos (${pagosEst.length})</div>
        ${pagosEst.slice(0,4).map(p=>`<div class="info-row"><span style="color:#555;font-size:0.8rem">${escHtml(p.fecha)} · ${escHtml(p.concepto)||"Pago"} ${p.mes?"("+escHtml(p.mes)+")":""}</span><span style="font-weight:700;color:#003366;font-size:0.82rem">${fmt(p.total)}</span></div>`).join("")}
        ${pagosEst.length===0?'<p style="font-size:0.78rem;color:#aaa">Sin pagos registrados</p>':""}
      </div>
      <div class="modal-actions">
        <button class="btn btn-primary" style="flex:1" onclick="cerrarModal();subTab.pagos='nuevo';tabActual='pagos';_metodoPago='Dólares Efectivo';window._pagoEstId='${e.id}';window._pagoCedula='${escJs(e.cedula)||''}';render();setTimeout(()=>{const n=document.getElementById('p-nombre');if(n)n.value='${escJs(e.nombre)}';const c=document.getElementById('p-cedula');if(c)c.value='${escJs(e.cedula)||''}';const t=document.getElementById('p-tel');if(t)t.value='${escJs(e.telefono)||''}';},150)">💰 Registrar Pago</button>
        <button class="btn btn-print btn-sm" onclick="imprimirConstancia('${e.id}')">📄 Constancia</button>
        <button class="btn btn-gray btn-sm" onclick="abrirModal({tipo:'editar-estudiante',id:'${e.id}'})">✏️</button>
        <button class="btn btn-gray" onclick="cerrarModal()">Cerrar</button>
      </div>
    </div>
  </div>`;
}
function imprimirConstancia(estId){
  const e = estudiantes.find(x=>x.id===estId);
  if(!e) return;
  const edad = calcEdad(e.fechaNac);
  const hoy = new Date();
  const meses = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
  const fechaLarga = `${hoy.getDate()} de ${meses[hoy.getMonth()]} de ${hoy.getFullYear()}`;
  const numConst = "CONST-" + Date.now().toString().slice(-6);

  const w = window.open("","_blank","width=720,height:1000");
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"/>
  <title>Constancia - ${escHtml(e.nombre)}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Times New Roman',serif;background:#fff;color:#222;padding:2.5rem;max-width:720px;margin:0 auto;font-size:12pt;line-height:1.6}
    .membrete{display:flex;align-items:center;gap:1rem;margin-bottom:1.5rem;padding-bottom:1rem;border-bottom:3px double #003366}
    .logo{width:75px;height:75px;object-fit:contain;flex-shrink:0}
    .org-info{text-align:center;flex:1}
    .org-name{font-size:11pt;font-weight:bold;color:#003366;text-transform:uppercase;line-height:1.3}
    .org-sub{font-size:9pt;color:#555;margin-top:3px}
    .titulo{text-align:center;margin:1.5rem 0;font-size:14pt;font-weight:bold;color:#003366;text-transform:uppercase;letter-spacing:2px}
    .titulo-line{height:2px;background:linear-gradient(90deg,transparent,#003366,transparent);margin:0.5rem auto;width:80%}
    .num-const{text-align:right;font-size:9pt;color:#888;margin-bottom:1rem}
    .cuerpo{font-size:12pt;text-align:justify;line-height:2;margin:1.5rem 0}
    .nombre-est{font-weight:bold;text-transform:uppercase;color:#003366;border-bottom:1px solid #003366;padding:0 4px}
    .datos-box{background:#f8faff;border:1px solid #dde3f0;border-radius:8px;padding:1rem 1.5rem;margin:1rem 0;display:grid;grid-template-columns:1fr 1fr;gap:0.4rem}
    .dato{font-size:10pt}.dato span{color:#888;font-size:9pt;display:block}
    .firma-sec{margin-top:3rem;display:flex;justify-content:space-around}
    .firma-box{text-align:center;width:40%}
    .firma-line{border-top:1px solid #333;margin-bottom:5px;margin-top:2.5rem}
    .firma-label{font-size:9pt;color:#333;font-weight:bold}
    .firma-cargo{font-size:8pt;color:#666}
    .pie{text-align:center;font-size:8pt;color:#aaa;margin-top:2rem;padding-top:1rem;border-top:1px solid #eee}
    .sello{width:80px;height:80px;border:3px solid #003366;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 0.5rem;font-size:7pt;text-align:center;color:#003366;font-weight:bold;padding:8px}
    @media print{body{padding:1.5rem}button{display:none!important}}
  </style></head><body>

  <div class="membrete">
    <img src="data:image/png;base64,${LOGO}" class="logo" alt="Logo"/>
    <div class="org-info">
      <div style="font-size:8pt;color:#555">REPÚBLICA BOLIVARIANA DE VENEZUELA</div>
      <div style="font-size:8pt;color:#555">MINISTERIO DEL PODER POPULAR PARA LA EDUCACIÓN</div>
      <div class="org-name">${EMPRESA}</div>
      <div class="org-sub">${EMPRESA_SUB} · R.I.F.: J-XXXXXXXXX-X</div>
    </div>
    <img src="data:image/png;base64,${LOGO}" class="logo" alt="Logo"/>
  </div>

  <div class="num-const">N° ${numConst} &nbsp;·&nbsp; Turumo, ${fechaLarga}</div>

  <div class="titulo">
    <div class="titulo-line"></div>
    Constancia de Estudio
    <div class="titulo-line"></div>
  </div>

  <div class="cuerpo">
    &nbsp;&nbsp;&nbsp;&nbsp;Quien suscribe, Director(a) de la <strong>${EMPRESA}</strong>, ubicada en ${EMPRESA_SUB}, hace constar por medio de la presente que el/la estudiante <span class="nombre-est">${escHtml(e.nombre)}</span>${edad?`, de <strong>${edad} años</strong> de edad,`:","} titular de la cédula escolar N° <strong>${escHtml(e.cedula)||"_____________"}</strong>, se encuentra debidamente inscrito(a) y cursando estudios regulares en esta institución en el <strong>${escHtml(e.grado)||"_____________"}</strong>, jornada <strong>${escHtml(e.jornada)||"_____________"}</strong>, correspondiente al año escolar <strong>${escHtml(e.anioEscolar)||anioActual()}</strong>.
  </div>

  <div class="datos-box">
    <div class="dato"><span>Estudiante</span>${escHtml(e.nombre)}</div>
    <div class="dato"><span>Cédula Escolar</span>${escHtml(e.cedula)||"N/A"}</div>
    <div class="dato"><span>Grado / Sección</span>${escHtml(e.grado)||"N/A"}</div>
    <div class="dato"><span>Jornada</span>${escHtml(e.jornada)||"N/A"}</div>
    <div class="dato"><span>Año Escolar</span>${escHtml(e.anioEscolar)||anioActual()}</div>
    <div class="dato"><span>Representante</span>${escHtml(e.acudiente)||"N/A"}</div>
  </div>

  <div class="cuerpo">
    &nbsp;&nbsp;&nbsp;&nbsp;Constancia que se expide a petición de la parte interesada, a los <strong>${hoy.getDate()} días</strong> del mes de <strong>${meses[hoy.getMonth()]}</strong> del año <strong>${hoy.getFullYear()}</strong>, en Turumo, Estado Miranda.
  </div>

  <div class="firma-sec">
    <div class="firma-box">
      <div class="sello">SELLO<br/>INSTITUCIÓN</div>
      <div class="firma-line"></div>
      <div class="firma-label">Director(a)</div>
      <div class="firma-cargo">${EMPRESA}</div>
    </div>
    <div class="firma-box">
      <div style="margin-top:2.5rem"></div>
      <div class="firma-line"></div>
      <div class="firma-label">Representante</div>
      <div class="firma-cargo">C.I.: _______________</div>
    </div>
  </div>

  <div class="pie">
    ${EMPRESA} · ${EMPRESA_SUB}<br/>
    Documento generado el ${new Date().toLocaleDateString("es-VE")} · N° ${numConst}
  </div>

  <div style="text-align:center;margin-top:1rem" class="no-print">
    <button onclick="window.print()" style="background:linear-gradient(135deg,#003366,#00509e);color:#ffd700;border:none;padding:0.65rem 1.5rem;border-radius:8px;cursor:pointer;font-weight:700;font-size:0.9rem;font-family:inherit">🖨️ Imprimir / Guardar PDF</button>
  </div>
  </body></html>`);
  w.document.close();
}
async function guardarEstudiante(editId){
  const nombre=document.getElementById("e-nombre").value.trim();
  const cedula=document.getElementById("e-cedula").value.trim();
  const fechaNac=document.getElementById("e-fn").value;
  const gradoTxt=document.getElementById("e-grado").value.trim();
  const grado=gradoCanon(gradoTxt)||gradoTxt;   // siempre el nombre oficial
  const telefono=document.getElementById("e-tel").value.trim();
  const acudiente=document.getElementById("e-acud").value.trim();
  const telAcud=document.getElementById("e-telacud").value.trim();
  const correoAcud=((document.getElementById("e-correo-acud")||{}).value||"").trim().toLowerCase();
  const mensualidadRaw=document.getElementById("e-mens").value;
  const anioEscolar=document.getElementById("e-anio").value.trim();
  // Obligatorios: lo mínimo para identificarlo y cobrarle. Cédula, fecha, teléfonos y acudiente pueden completarse después
  // (los estudiantes importados llegan con algunos vacíos y se marcan como «datos incompletos»).
  if(!nombre||!grado||!anioEscolar){
    document.getElementById("modal-err").innerHTML='<div class="error-msg">⚠️ Nombre, grado y año escolar son obligatorios</div>';return;}
  if(correoAcud&&!correoValido(correoAcud)){
    document.getElementById("modal-err").innerHTML='<div class="error-msg">⚠️ El correo del acudiente no es válido (ejemplo: nombre@gmail.com)</div>';return;}
  const estado=document.getElementById("e-estado").value;
  const datos={nombre,cedula,fechaNac,grado,jornada:document.getElementById("e-jornada").value,
    telefono,acudiente,telefonoAcudiente:telAcud,correoAcudiente:correoAcud,
    cedulaAcudiente:((document.getElementById("e-cedacud")||{}).value||"").trim(),
    sexo:((document.getElementById("e-sexo")||{}).value)||"",
    observacionesMedicas:((document.getElementById("e-med")||{}).value||"").trim(),
    mensualidad:parseFloat(mensualidadRaw||0),
    cuotaDesde:(document.getElementById("e-cuota-desde")||{}).value||"",
    graduado:!!(document.getElementById("e-graduado")||{}).checked,
    sinRecargo:!!(document.getElementById("e-sinrec")||{}).checked,
    anioEscolar,estado,
    moraConcepto:estado==="mora"?(document.getElementById("e-mora-concepto").value.trim()):"",
    moraMonto:estado==="mora"?parseFmt(document.getElementById("e-mora-monto").value):0};
  try{
    if(editId){await db.collection("estudiantes").doc(editId).update(datos);const i=estudiantes.findIndex(e=>e.id===editId);if(i>=0)estudiantes[i]={...estudiantes[i],...datos};alertaEstudiante(datos,"✏️ Actualizado");}
    else{const ref=await db.collection("estudiantes").add(datos);datos.id=ref.id;estudiantes.push(datos);alertaEstudiante(datos,"➕ Registrado");}
    cerrarModal();
  }catch(e){document.getElementById("modal-err").innerHTML=`<div class="error-msg">${escHtml(e.message)}</div>`;}
}
async function eliminarEstudiante(id){
  if(!confirm("¿Eliminar este estudiante?"))return;
  try{await db.collection("estudiantes").doc(id).delete();estudiantes=estudiantes.filter(e=>e.id!==id);cerrarModal();}
  catch(e){alert("Error: "+e.message);}
}
