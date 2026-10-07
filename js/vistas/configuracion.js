// Pestaña Configuración: docentes, materias, indicadores y datos de la institución.

let configDocentes = [];
let configMaterias = {}; // {grado: [materias]}
let configIndicadores = {}; // {grado_materia: [indicadores]}
let configInst = {};
async function cargarConfig(){
  try {
    const [docsSnap, instSnap] = await Promise.all([
      db.collection("usuarios").where("rol","==","docente").get(),
      db.collection("config").doc("institucion").get()
    ]);
    configDocentes = docsSnap.docs.map(d=>({id:d.id,...d.data()}));
    if(instSnap.exists) configInst = instSnap.data();

    // Cargar materias e indicadores
    const matSnap = await db.collection("config").doc("materias").get();
    if(matSnap.exists) configMaterias = matSnap.data();
    const indSnap = await db.collection("config").doc("indicadores").get();
    if(indSnap.exists) configIndicadores = indSnap.data();
  } catch(e){ console.error(e); }
}
function renderConfig(){
  const st = subTab.config||"docentes";
  const tabs = [["docentes","👨‍🏫 Docentes"],["materias","📚 Materias"],["indicadores","📋 Indicadores"],["institucion","🏫 Institución"],["anio","📅 Año escolar"]];
  return `<div class="card">
    <div class="card-title"><div class="card-bar"></div><h2>⚙️ Configuración</h2></div>
    <div class="stabs">
      ${tabs.map(([k,l])=>`<button class="stab ${st===k?"active":""}" onclick="subTab.config='${k}';renderTabContent()">${l}</button>`).join("")}
    </div>
    ${st==="docentes"?renderConfigDocentes():
      st==="materias"?renderConfigMaterias():
      st==="indicadores"?renderConfigIndicadores():
      st==="anio"?renderConfigAnio():
      renderConfigInstitucion()}
  </div>`;
}
// ── DOCENTES ──

function buscarTrabajadorDoc(val){
  const box = document.getElementById("doc-trab-sugerencias");
  if(!box) return;
  if(!val||val.length<2){box.style.display="none";return;}
  const v = val.toLowerCase();
  const matches = trabajadores.filter(t=>t.nombre&&t.nombre.toLowerCase().includes(v));
  if(matches.length===0){box.style.display="none";return;}
  box.style.display="block";
  box.innerHTML = matches.slice(0,6).map(t=>`
    <div onclick="seleccionarTrabajadorDoc('${t.id}')" style="padding:0.65rem 1rem;cursor:pointer;border-bottom:1px solid #eef2f9;font-size:0.85rem;transition:background .15s" onmouseover="this.style.background='#e8f0fe'" onmouseout="this.style.background='#fff'">
      <div style="font-weight:700;color:#003366">${t.nombre}</div>
      <div style="font-size:0.72rem;color:#888">${t.cargo||"Sin cargo"} ${t.cedula?"· CC "+t.cedula:""}</div>
    </div>`).join("");
}
function seleccionarTrabajadorDoc(trabId){
  const t = trabajadores.find(w=>w.id===trabId);
  if(!t) return;
  const nombre = document.getElementById("doc-nombre");
  const cedula = document.getElementById("doc-cedula");
  const cargo = document.getElementById("doc-cargo");
  const box = document.getElementById("doc-trab-sugerencias");
  if(nombre) nombre.value = t.nombre;
  if(cedula){ cedula.value = t.cedula||""; cedula.style.background="#e8f0fe"; }
  if(cargo){ cargo.value = t.cargo||""; cargo.style.background="#e8f0fe"; }
  if(box) box.style.display="none";
  // Store trabajadorId for linking
  window._docTrabId = trabId;
}
function renderConfigDocentes(){
  const activos = configDocentes.filter(d=>d.activo!==false);
  const inactivos = configDocentes.filter(d=>d.activo===false);
  return `
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
    <div>
      <span style="font-weight:700;color:#003366;font-size:1rem">${activos.length} docentes activos</span>
      ${inactivos.length>0?`<span style="font-size:0.78rem;color:#888;margin-left:0.5rem">(${inactivos.length} inactivos)</span>`:""}
    </div>
    <button class="btn btn-primary btn-sm" onclick="abrirModalNuevoDocente()">+ Nuevo Docente</button>
  </div>
  ${configDocentes.length===0?`<div class="empty-state">No hay docentes registrados</div>`:`
  <div style="display:flex;flex-direction:column;gap:0.6rem">
    ${configDocentes.map(d=>`
    <div style="background:${d.activo===false?"#f5f5f5":"#f8faff"};border-radius:12px;padding:0.85rem 1rem;border-left:4px solid ${d.activo===false?"#ccc":d.jornada==="mañana"?"#f6ad55":d.jornada==="tarde"?"#667eea":"#003366"};opacity:${d.activo===false?"0.6":"1"}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div>
          <div style="font-weight:700;color:#003366;font-size:0.92rem">${d.nombre}</div>
          <div style="font-size:0.75rem;color:#666;margin-top:2px">${d.correo}${d.cedula?" · CC "+d.cedula:""}</div>
          ${d.trabajadorId?`<div style="font-size:0.7rem;color:#1a9e5c;margin-top:1px">🔗 Vinculado a nómina</div>`:""}
          <div style="display:flex;gap:0.4rem;margin-top:5px;flex-wrap:wrap">
            <span style="background:${d.jornada==="mañana"?"#fff3e0":d.jornada==="tarde"?"#ede7f6":"#e3f2fd"};color:${d.jornada==="mañana"?"#e65100":d.jornada==="tarde"?"#4527a0":"#0d47a1"};padding:2px 8px;border-radius:20px;font-size:0.7rem;font-weight:600">${d.jornada==="mañana"?"🌅 Mañana":d.jornada==="tarde"?"🌆 Tarde":"🌓 Ambas"}</span>
            ${d.grado?`<span style="background:#e8f5e9;color:#2e7d32;padding:2px 8px;border-radius:20px;font-size:0.7rem;font-weight:600">📚 ${d.grado}</span>`:""}
            ${(d.materias||[]).map(m=>`<span style="background:#e3f2fd;color:#0d47a1;padding:2px 8px;border-radius:20px;font-size:0.7rem">${m}</span>`).join("")}
          </div>
        </div>
        <div style="display:flex;gap:0.4rem;flex-shrink:0">
          <button class="btn btn-sm" style="background:#e8f0fe;color:#003366;padding:0.3rem 0.6rem;font-size:0.72rem" onclick="abrirModalEditarDocente('${d.id}')">✏️</button>
          <button class="btn btn-sm" style="background:${d.activo===false?"#e8f5e9":"#fff3e0"};color:${d.activo===false?"#2e7d32":"#e65100"};padding:0.3rem 0.6rem;font-size:0.72rem" onclick="toggleActivoDocente('${d.id}',${d.activo===false})">${d.activo===false?"✅ Activar":"⏸️ Desactivar"}</button>
          <button class="btn btn-danger btn-sm" style="padding:0.3rem 0.6rem;font-size:0.72rem" onclick="eliminarDocente('${d.id}')">🗑️</button>
        </div>
      </div>
    </div>`).join("")}
  </div>`}`;
}
function renderConfigMaterias(){
  const grado = filtros.gradoConfig||GRADOS_MG[0];
  const mats = configMaterias[grado]||[];
  return `
  <div style="margin-bottom:1rem">
    <label style="font-size:0.8rem;font-weight:700;color:#003366;display:block;margin-bottom:0.4rem">Selecciona el grado de Media General</label>
    <div style="display:flex;gap:0.4rem;flex-wrap:wrap">
      ${GRADOS_MG.map(g=>`<button onclick="filtros.gradoConfig='${g}';renderTabContent()" style="padding:0.4rem 0.85rem;border-radius:20px;border:2px solid ${grado===g?"#003366":"#dde3f0"};background:${grado===g?"#003366":"#f8faff"};color:${grado===g?"#fff":"#555"};font-size:0.78rem;font-weight:600;cursor:pointer;font-family:inherit">${g}</button>`).join("")}
    </div>
  </div>
  <div style="background:#f8faff;border-radius:12px;padding:1rem;margin-bottom:1rem">
    <div style="font-weight:700;color:#003366;margin-bottom:0.75rem;font-size:0.88rem">📚 Materias de ${grado} <span style="font-weight:400;color:#888">(${mats.length} materias)</span></div>
    ${mats.length===0?`<div style="color:#aaa;font-size:0.82rem;text-align:center;padding:1rem">Sin materias asignadas. Agrega la primera.</div>`:""}
    <div style="display:flex;flex-direction:column;gap:0.4rem;margin-bottom:0.75rem">
      ${mats.map((m,i)=>`
      <div style="display:flex;align-items:center;gap:0.5rem;background:#fff;border-radius:8px;padding:0.5rem 0.75rem;border:1px solid #e0e8f0">
        <span style="font-size:0.82rem;color:#333;flex:1">${m}</span>
        <button onclick="moverMateria('${grado}',${i},-1)" style="padding:0.15rem 0.4rem;border:none;background:#f0f4ff;border-radius:4px;cursor:pointer;font-size:0.75rem" ${i===0?"disabled":""}>▲</button>
        <button onclick="moverMateria('${grado}',${i},1)" style="padding:0.15rem 0.4rem;border:none;background:#f0f4ff;border-radius:4px;cursor:pointer;font-size:0.75rem" ${i===mats.length-1?"disabled":""}>▼</button>
        <button onclick="eliminarMateria('${grado}',${i})" style="padding:0.15rem 0.5rem;border:none;background:#fef0f0;color:#e53e3e;border-radius:4px;cursor:pointer;font-size:0.75rem">✕</button>
      </div>`).join("")}
    </div>
    <div style="display:flex;gap:0.5rem">
      <input class="inp" id="nueva-materia" placeholder="Nombre de la materia..." style="flex:1;padding:0.5rem 0.75rem;font-size:0.82rem" onkeydown="if(event.key==='Enter')agregarMateria('${grado}')"/>
      <button class="btn btn-primary btn-sm" onclick="agregarMateria('${grado}')">+ Agregar</button>
    </div>
  </div>
  <button class="btn btn-primary" onclick="guardarMaterias('${grado}')">💾 Guardar materias de ${grado}</button>`;
}
function renderConfigIndicadores(){
  const grado = filtros.gradoIndConfig||GRADOS_PRIM[0];
  const esMaternal = ["Maternal","Nivel I","Nivel II","Nivel III"].includes(grado);
  const areas = esMaternal ? AREAS_MATERNAL : AREAS_PRIMARIA;
  const area = filtros.areaIndConfig||areas[0];
  const key = grado+"__"+area;
  const inds = configIndicadores[key]||[];

  return `
  <div style="margin-bottom:1rem">
    <label style="font-size:0.8rem;font-weight:700;color:#003366;display:block;margin-bottom:0.4rem">Grado</label>
    <div style="display:flex;gap:0.3rem;flex-wrap:wrap;margin-bottom:0.75rem">
      ${GRADOS_PRIM.map(g=>`<button onclick="filtros.gradoIndConfig='${g}';filtros.areaIndConfig=null;renderTabContent()" style="padding:0.35rem 0.7rem;border-radius:20px;border:2px solid ${grado===g?"#003366":"#dde3f0"};background:${grado===g?"#003366":"#f8faff"};color:${grado===g?"#fff":"#555"};font-size:0.72rem;font-weight:600;cursor:pointer;font-family:inherit">${g}</button>`).join("")}
    </div>
    <label style="font-size:0.8rem;font-weight:700;color:#003366;display:block;margin-bottom:0.4rem">Área / Materia</label>
    <div style="display:flex;gap:0.3rem;flex-wrap:wrap">
      ${areas.map(a=>`<button onclick="filtros.areaIndConfig='${a}';renderTabContent()" style="padding:0.35rem 0.7rem;border-radius:20px;border:2px solid ${area===a?"#1a9e5c":"#dde3f0"};background:${area===a?"#1a9e5c":"#f8faff"};color:${area===a?"#fff":"#555"};font-size:0.72rem;font-weight:600;cursor:pointer;font-family:inherit">${a}</button>`).join("")}
    </div>
  </div>
  <div style="background:#f8faff;border-radius:12px;padding:1rem;margin-bottom:1rem">
    <div style="font-weight:700;color:#003366;margin-bottom:0.75rem;font-size:0.88rem">📋 Indicadores: ${area} — ${grado} <span style="font-weight:400;color:#888">(${inds.length})</span></div>
    ${inds.length===0?`<div style="color:#aaa;font-size:0.82rem;text-align:center;padding:1rem">Sin indicadores. Agrega el primero.</div>`:""}
    <div style="display:flex;flex-direction:column;gap:0.4rem;margin-bottom:0.75rem">
      ${inds.map((ind,i)=>`
      <div style="display:flex;align-items:center;gap:0.5rem;background:#fff;border-radius:8px;padding:0.5rem 0.75rem;border:1px solid #e0e8f0">
        <span style="font-size:0.75rem;font-weight:700;color:#888;min-width:20px">${i+1}.</span>
        <span style="font-size:0.82rem;color:#333;flex:1">${ind}</span>
        <button onclick="eliminarIndicador('${key}',${i})" style="padding:0.15rem 0.5rem;border:none;background:#fef0f0;color:#e53e3e;border-radius:4px;cursor:pointer;font-size:0.75rem">✕</button>
      </div>`).join("")}
    </div>
    <div style="display:flex;gap:0.5rem">
      <input class="inp" id="nuevo-indicador" placeholder="Descripción del indicador..." style="flex:1;padding:0.5rem 0.75rem;font-size:0.82rem" onkeydown="if(event.key==='Enter')agregarIndicador('${key}')"/>
      <button class="btn btn-primary btn-sm" onclick="agregarIndicador('${key}')">+ Agregar</button>
    </div>
  </div>
  <button class="btn btn-primary" onclick="guardarIndicadores('${key}')">💾 Guardar indicadores</button>`;
}
// ── INSTITUCIÓN ──
function renderConfigInstitucion(){
  const inst = configInst;
  return `
  <div class="form-grid">
    <div class="field"><label class="field-label">Código del plantel</label>
      <input class="inp" id="inst-codigo" value="${inst.codigo||'PD13831519'}" placeholder="PD13831519"/></div>
    <div class="field"><label class="field-label">Nombre del plantel</label>
      <input class="inp" id="inst-nombre" value="${inst.nombre||'U.E.P. Josefa Joaquina Sánchez'}" placeholder="Nombre del plantel"/></div>
    <div class="field"><label class="field-label">Dirección</label>
      <input class="inp" id="inst-direccion" value="${inst.direccion||'Turumo - Caucagüita, Estado Miranda'}" placeholder="Dirección"/></div>
    <div class="field"><label class="field-label">Directora</label>
      <input class="inp" id="inst-directora" value="${inst.directora||'Lic. Ligia Herrera'}" placeholder="Nombre y título"/></div>
    <div class="field"><label class="field-label">Coordinador/a de Media General</label>
      <input class="inp" id="inst-coordinador" value="${inst.coordinador||'Lic. Carlos Carrascal'}" placeholder="Nombre y título"/></div>
    <div class="field"><label class="field-label">Coordinador/a de Primaria</label>
      <input class="inp" id="inst-coordinador-prim" value="${inst.coordinadorPrimaria||''}" placeholder="Nombre y título"/></div>
    <div class="field"><label class="field-label">Año escolar actual</label>
      <input class="inp" id="inst-anio" value="${inst.anioEscolar||'2025-2026'}" placeholder="2025-2026"/></div>
  </div>
  <div style="margin-top:1rem">
    <button class="btn btn-primary" onclick="guardarInstitucion()">💾 Guardar datos institucionales</button>
  </div>`;
}
// ══════════════════════════
// FUNCIONES DE ACCIÓN
// ══════════════════════════

function agregarMateria(grado){
  const inp = document.getElementById("nueva-materia");
  if(!inp||!inp.value.trim()) return;
  if(!configMaterias[grado]) configMaterias[grado]=[];
  if(!configMaterias[grado].includes(inp.value.trim())){
    configMaterias[grado].push(inp.value.trim());
    inp.value="";
    renderTabContent();
  }
}
function eliminarMateria(grado,idx){
  if(!confirm("¿Eliminar esta materia?")) return;
  configMaterias[grado].splice(idx,1);
  renderTabContent();
}
function moverMateria(grado,idx,dir){
  const arr = configMaterias[grado];
  const newIdx = idx+dir;
  if(newIdx<0||newIdx>=arr.length) return;
  [arr[idx],arr[newIdx]]=[arr[newIdx],arr[idx]];
  renderTabContent();
}
async function guardarMaterias(grado){
  try{
    await db.collection("config").doc("materias").set(configMaterias,{merge:true});
    mostrarToast("✅ Materias de "+grado+" guardadas");
  }catch(e){alert("Error: "+e.message);}
}
function agregarIndicador(key){
  const inp = document.getElementById("nuevo-indicador");
  if(!inp||!inp.value.trim()) return;
  if(!configIndicadores[key]) configIndicadores[key]=[];
  configIndicadores[key].push(inp.value.trim());
  inp.value="";
  renderTabContent();
}
function eliminarIndicador(key,idx){
  if(!confirm("¿Eliminar este indicador?")) return;
  configIndicadores[key].splice(idx,1);
  renderTabContent();
}
async function guardarIndicadores(key){
  try{
    await db.collection("config").doc("indicadores").set(configIndicadores,{merge:true});
    mostrarToast("✅ Indicadores guardados");
  }catch(e){alert("Error: "+e.message);}
}
async function guardarInstitucion(){
  const datos={
    codigo:document.getElementById("inst-codigo").value.trim(),
    nombre:document.getElementById("inst-nombre").value.trim(),
    direccion:document.getElementById("inst-direccion").value.trim(),
    directora:document.getElementById("inst-directora").value.trim(),
    coordinador:document.getElementById("inst-coordinador").value.trim(),
    coordinadorPrimaria:document.getElementById("inst-coordinador-prim").value.trim(),
    anioEscolar:document.getElementById("inst-anio").value.trim(),
  };
  try{
    await db.collection("config").doc("institucion").set(datos);
    configInst=datos;
    mostrarToast("✅ Datos institucionales guardados");
  }catch(e){alert("Error: "+e.message);}
}
async function toggleActivoDocente(id, activar){
  try{
    await db.collection("usuarios").doc(id).update({activo:activar});
    const d = configDocentes.find(d=>d.id===id);
    if(d) d.activo=activar;
    renderTabContent();
    mostrarToast(activar?"✅ Docente activado":"⏸️ Docente desactivado");
  }catch(e){alert("Error: "+e.message);}
}
async function eliminarDocente(id){
  if(!confirm("¿Eliminar este docente? Esta acción no se puede deshacer.")) return;
  try{
    await db.collection("usuarios").doc(id).delete();
    configDocentes = configDocentes.filter(d=>d.id!==id);
    renderTabContent();
    mostrarToast("🗑️ Docente eliminado");
  }catch(e){alert("Error: "+e.message);}
}
function abrirModalNuevoDocente(){
  abrirModal({tipo:"nuevo-docente"});
}
function abrirModalEditarDocente(id){
  abrirModal({tipo:"editar-docente",id});
}
function renderModalDocente(docenteId){
  const isEdit = !!docenteId;
  const d = isEdit ? configDocentes.find(x=>x.id===docenteId)||{} : {};
  const jornada = d.jornada||"mañana";
  const grados_mg = ["1er Año","2do Año","3er Año","4to Año","5to Año"];
  const grados_prim = ["Maternal","Nivel I","Nivel II","Nivel III","1er Grado","2do Grado","3er Grado","4to Grado","5to Grado","6to Grado"];

  return `<div class="modal-bg"><div class="modal">
    <div class="modal-header">
      <h3>${isEdit?"✏️ Editar Docente":"➕ Nuevo Docente"}</h3>
      <button class="modal-close-x" onclick="cerrarModal()">✕</button>
    </div>
    <div class="modal-body">
      <div class="form-grid">
        <div class="field"><label class="field-label">Nombre completo *</label>
          <div style="position:relative">
            <input class="inp" id="doc-nombre" value="${d.nombre||''}" placeholder="Escribe el nombre o selecciona de nómina..." oninput="buscarTrabajadorDoc(this.value)" autocomplete="off"/>
            <div id="doc-trab-sugerencias" style="position:absolute;top:100%;left:0;right:0;background:#fff;border:1.5px solid #003366;border-radius:0 0 10px 10px;z-index:99;display:none;max-height:180px;overflow-y:auto;box-shadow:0 8px 20px rgba(0,51,102,0.15)"></div>
          </div>
          <div style="font-size:0.72rem;color:#888;margin-top:3px">💡 Escribe el nombre para buscar en el personal de nómina</div>
        </div>
        <div class="field"><label class="field-label">Cédula</label>
          <input class="inp" id="doc-cedula" value="${d.cedula||''}" placeholder="Se rellena automáticamente" readonly style="background:#f0f4ff;color:#003366"/></div>
        <div class="field"><label class="field-label">Cargo</label>
          <input class="inp" id="doc-cargo" value="${d.cargo||''}" placeholder="Se rellena automáticamente" readonly style="background:#f0f4ff;color:#003366"/></div>
        <div class="field"><label class="field-label">Correo electrónico *</label>
          <input class="inp" id="doc-correo" type="email" value="${d.correo||''}" placeholder="correo@ejemplo.com" ${isEdit?"readonly style='background:#f0f4ff'":""}/></div>
        ${!isEdit?`<div class="field"><label class="field-label">Contraseña temporal *</label>
          <input class="inp" id="doc-pass" type="password" placeholder="Mínimo 6 caracteres"/></div>`:""}
        <div class="field" style="grid-column:1/-1"><label class="field-label">Jornada *</label>
          <div style="display:flex;gap:0.5rem">
            ${[["mañana","🌅 Mañana (Primaria)"],["tarde","🌆 Tarde (Media General)"],["ambas","🌓 Ambas"]].map(([v,l])=>`
            <button onclick="selJornadaDoc('${v}')" id="jorn-${v}" style="flex:1;padding:0.5rem;border-radius:8px;border:2px solid ${jornada===v?"#003366":"#dde3f0"};background:${jornada===v?"#003366":"#f8faff"};color:${jornada===v?"#fff":"#555"};font-size:0.78rem;font-weight:600;cursor:pointer;font-family:inherit">${l}</button>`).join("")}
          </div>
        </div>
        <div class="field" style="grid-column:1/-1" id="doc-grado-box">
          <label class="field-label">Grado asignado (Primaria)</label>
          <select class="inp" id="doc-grado">
            <option value="">Sin grado específico</option>
            ${grados_prim.map(g=>`<option value="${g}" ${d.grado===g?"selected":""}>${g}</option>`).join("")}
          </select>
        </div>
        <div class="field" style="grid-column:1/-1" id="doc-mats-box">
          <label class="field-label">Materias asignadas (Media General)</label>
          <div style="display:flex;flex-wrap:wrap;gap:0.4rem;margin-bottom:0.5rem" id="doc-mats-sel">
            ${Object.entries(configMaterias).map(([grado,mats])=>mats.map(m=>{
              const key=grado+"::"+m;
              const sel=(d.materias||[]).some(x=>x===key);
              return `<button onclick="toggleMatDoc('${key}',this)" style="padding:0.3rem 0.65rem;border-radius:20px;border:2px solid ${sel?"#003366":"#dde3f0"};background:${sel?"#003366":"#f8faff"};color:${sel?"#fff":"#555"};font-size:0.72rem;cursor:pointer;font-family:inherit;font-weight:600" data-sel="${sel}">${grado}: ${m}</button>`;
            }).join("")).join("")}
          </div>
          ${Object.keys(configMaterias).length===0?`<div style="font-size:0.78rem;color:#888">Primero configura las materias en la pestaña Materias</div>`:""}
        </div>
      </div>
      <div id="doc-err"></div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-primary" style="flex:1" onclick="${isEdit?`guardarEditarDocente('${docenteId}')`:"guardarNuevoDocente()"}">
        ${isEdit?"💾 Guardar cambios":"➕ Crear docente"}
      </button>
      <button class="btn btn-gray" onclick="cerrarModal()">Cancelar</button>
    </div>
  </div></div>`;
}
function selJornadaDoc(v){
  ["mañana","tarde","ambas"].forEach(j=>{
    const btn=document.getElementById("jorn-"+j);
    if(btn){btn.style.border=j===v?"2px solid #003366":"2px solid #dde3f0";btn.style.background=j===v?"#003366":"#f8faff";btn.style.color=j===v?"#fff":"#555";}
  });
}
function toggleMatDoc(key,btn){
  const sel = btn.dataset.sel==="true";
  btn.dataset.sel = (!sel).toString();
  btn.style.border = !sel?"2px solid #003366":"2px solid #dde3f0";
  btn.style.background = !sel?"#003366":"#f8faff";
  btn.style.color = !sel?"#fff":"#555";
}
async function guardarNuevoDocente(){
  const nombre=document.getElementById("doc-nombre").value.trim();
  const correo=document.getElementById("doc-correo").value.trim();
  const pass=document.getElementById("doc-pass").value.trim();
  const grado=document.getElementById("doc-grado")?.value||"";
  const jornada=document.querySelector("[id^='jorn-'][style*='background: rgb(0']")?.id?.replace("jorn-","")||"mañana";
  const mats=[...document.querySelectorAll("#doc-mats-sel button[data-sel='true']")].map(b=>b.dataset.sel&&b.textContent);
  const materias=[...document.querySelectorAll("#doc-mats-sel button")].filter(b=>b.dataset.sel==="true").map(b=>b.getAttribute("onclick").match(/'([^']+)'/)[1]);

  if(!nombre||!correo||!pass){document.getElementById("doc-err").innerHTML='<div class="error-msg">Completa nombre, correo y contraseña</div>';return;}
  if(pass.length<6){document.getElementById("doc-err").innerHTML='<div class="error-msg">La contraseña debe tener al menos 6 caracteres</div>';return;}

  try{
    // La cuenta se crea con una app secundaria: así NO se cierra la sesión del director y el perfil se guarda con sus permisos
    const appSec=(firebase.apps||[]).find(a=>a.name==="docentes")||firebase.initializeApp(firebase.app().options,"docentes");
    const authSec=appSec.auth();
    const cred = await authSec.createUserWithEmailAndPassword(correo,pass);
    try{await authSec.signOut();}catch(_){}
    const cedula=document.getElementById("doc-cedula")?.value||"";
  const cargo=document.getElementById("doc-cargo")?.value||"";
  const trabajadorId=window._docTrabId||null;
  const datos={nombre,correo,cedula,cargo,rol:"docente",jornada,grado,materias,activo:true,uid:cred.user.uid,trabajadorId};
  window._docTrabId=null;
    try{await db.collection("usuarios").doc(cred.user.uid).set(datos);}
    catch(e2){document.getElementById("doc-err").innerHTML=`<div class="error-msg">La cuenta se creó pero no se pudo guardar su perfil (${e2.message}). Revisa las reglas de Firestore.</div>`;return;}
    configDocentes.push({id:cred.user.uid,...datos});
    cerrarModal();
    renderTabContent();
    mostrarToast("✅ Docente "+nombre+" creado exitosamente");
  }catch(e){
    const yaExiste=e&&e.code==="auth/email-already-in-use";
    document.getElementById("doc-err").innerHTML=`<div class="error-msg">${yaExiste?"Ese correo ya tiene una cuenta. Si el docente no aparece en la lista, elimina esa cuenta en Firebase → Authentication y vuelve a crearlo.":e.message}</div>`;
  }
}
async function guardarEditarDocente(id){
  const nombre=document.getElementById("doc-nombre").value.trim();
  const grado=document.getElementById("doc-grado")?.value||"";
  const jornadaBtns=["mañana","tarde","ambas"];
  let jornada="mañana";
  for(const j of jornadaBtns){const b=document.getElementById("jorn-"+j);if(b&&b.style.background.includes("0, 51, 102")){jornada=j;break;}}
  const materias=[...document.querySelectorAll("#doc-mats-sel button")].filter(b=>b.dataset.sel==="true").map(b=>b.getAttribute("onclick").match(/'([^']+)'/)[1]);

  if(!nombre){document.getElementById("doc-err").innerHTML='<div class="error-msg">El nombre es obligatorio</div>';return;}
  try{
    await db.collection("usuarios").doc(id).update({nombre,jornada,grado,materias});
    const d=configDocentes.find(x=>x.id===id);
    if(d){d.nombre=nombre;d.jornada=jornada;d.grado=grado;d.materias=materias;}
    cerrarModal();
    renderTabContent();
    mostrarToast("✅ Docente actualizado");
  }catch(e){document.getElementById("doc-err").innerHTML=`<div class="error-msg">${e.message}</div>`;}
}
