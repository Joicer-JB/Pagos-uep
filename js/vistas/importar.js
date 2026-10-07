// Pestaña Importar: carga de la matrícula desde Excel (detecta encabezados, valida y evita duplicados).

// Una sola hoja con TODOS los grados, una fila por estudiante. Los encabezados se leen por nombre,
// así que el orden de las columnas no importa. Nunca se suben datos hasta que se revisa la vista previa.
const GRADOS_IMP=["Maternal","Nivel I","Nivel II","Nivel III","1er Grado","2do Grado","3er Grado","4to Grado","5to Grado","6to Grado","1er Año","2do Año","3er Año","4to Año","5to Año"];
const nivelDeGrado=g=>{const i=GRADOS_IMP.indexOf(g);return i<4?"inicial":i<10?"primaria":"media";};
const MENS_DEF={inicial:45,primaria:45,media:55};
const PLANTILLA_COLS=["Grado","Cédula escolar","Nombres y apellidos","Sexo","Fecha de nacimiento","Representante","Cédula del representante","Teléfono","Observaciones médicas"];
let importPreview=[],importFilas=[],importSoloAvisos=false,importRaw=null;
// Qué columna es cuál, según el texto del encabezado
function mapaEncabezados(fila){
  const m={};
  (fila||[]).forEach((h,i)=>{
    const s=sinAcento(h).toLowerCase().replace(/\s+/g," ").trim();
    let k=null;
    if(!s) k=null;
    else if(/revisar/.test(s)) k="_";
    else if(/ced.*rep|rep.*ced/.test(s)) k="cedRep";
    else if(/ced/.test(s)) k="cedula";
    else if(/^(grado|nivel)/.test(s)) k="grado";
    else if(/nombre/.test(s)) k="nombre";
    else if(/^(sexo|genero)/.test(s)) k="sexo";
    else if(/fecha|nac/.test(s)) k="fechaNac";
    else if(/^(repres|acudiente)/.test(s)) k="rep";
    else if(/tel|cel/.test(s)) k="tel";
    else if(/medic|enferm|padece|salud/.test(s)) k="enf";
    if(k&&!(k in m)) m[k]=i;
  });
  return m;
}
// Texto de una celda: las fechas reales de Excel pasan a aaaa-mm-dd; los números (cédulas) a texto
function textoCelda(v){
  if(v==null) return "";
  if(v instanceof Date){
    if(isNaN(v)) return "";
    const d=new Date(v.getTime()+12*3600*1000); // +12 h: evita saltar de día por zona horaria
    return d.getUTCFullYear()+"-"+String(d.getUTCMonth()+1).padStart(2,"0")+"-"+String(d.getUTCDate()).padStart(2,"0");
  }
  return String(v).replace(/\s+/g," ").trim();
}
// dd/mm/aaaa o aaaa-mm-dd → aaaa-mm-dd. Si es imposible (31/02, año de 2 cifras, etc.) devuelve "" y un aviso.
function fechaNacISO(s){
  s=String(s||"").trim();
  if(!s) return {iso:"",aviso:"Sin fecha de nacimiento"};
  let d,mo,y,m;
  if((m=s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/))){d=+m[1];mo=+m[2];y=+m[3];}
  else if((m=s.match(/^(\d{4})-(\d{2})-(\d{2})/))){y=+m[1];mo=+m[2];d=+m[3];}
  else return {iso:"",aviso:"Fecha de nacimiento no válida («"+s+"»)"};
  const dt=new Date(Date.UTC(y,mo-1,d));
  const ok=dt.getUTCFullYear()===y&&dt.getUTCMonth()===mo-1&&dt.getUTCDate()===d&&y>=1990&&y<=new Date().getFullYear();
  return ok?{iso:y+"-"+String(mo).padStart(2,"0")+"-"+String(d).padStart(2,"0"),aviso:""}:{iso:"",aviso:"Fecha de nacimiento no válida («"+s+"»)"};
}
// Teléfono → 0412XXXXXXX. Un número de 7 a 9 cifras casi seguro es una cédula escrita en la columna equivocada.
function limpiarTelImport(raw){
  const d=String(raw||"").replace(/\D/g,"");
  if(!d) return {tel:"",ced:"",aviso:"Sin teléfono"};
  if(d.length>=7&&d.length<=9) return {tel:"",ced:d,aviso:"El «teléfono» parece una cédula; se guardó como cédula del representante"};
  const wa=normalizarTelVE(raw);
  if(!wa) return {tel:"",ced:"",aviso:"Teléfono no válido («"+raw+"»)"};
  return {tel:"0"+wa.slice(2),ced:"",aviso:""};
}
// Función pura (sin pantalla ni Firebase): convierte filas del Excel en estudiantes listos + avisos.
// filas: [{n:númeroDeFilaEnExcel, r:[celdas]}]  op: {anio,jornada,mens:{inicial,primaria,media}}  existentes: estudiantes ya cargados
function construirImportacion(filas,mapa,op,existentes){
  const porNombre=new Map(),porCed=new Map();
  (existentes||[]).forEach(e=>{if(e.nombre)porNombre.set(claveNombre(e.nombre),e);if(e.cedula)porCed.set(String(e.cedula).trim(),e);});
  const vistoNom=new Map(),vistoCed=new Map();
  const out=[];
  filas.forEach(({n,r})=>{
    const g=k=>mapa[k]==null?"":textoCelda(r[mapa[k]]);
    const nombre=g("nombre"),gradoRaw=g("grado"),cedula=g("cedula");
    if(!nombre&&!gradoRaw&&!cedula) return; // fila vacía
    const it={n,estado:"nuevo",avisos:[],errores:[],datos:null};
    const grado=gradoCanon(gradoRaw);
    if(!nombre) it.errores.push("Falta el nombre");
    if(!grado) it.errores.push(gradoRaw?"Grado no reconocido («"+gradoRaw+"»)":"Falta el grado");
    const f=fechaNacISO(g("fechaNac"));
    const t=limpiarTelImport(g("tel"));
    let cedRep=g("cedRep").replace(/[^0-9A-Za-z]/g,"");
    if(!cedRep&&t.ced) cedRep=t.ced;
    const sexo=g("sexo").toUpperCase().slice(0,1);
    const enfRaw=g("enf");
    const enf=/^(no|n\/a|ninguna?|-|—)?\.?$/i.test(sinAcento(enfRaw).trim())?"":enfRaw;
    if(!cedula) it.avisos.push("Sin cédula escolar");
    if(f.aviso) it.avisos.push(f.aviso);
    if(t.aviso) it.avisos.push(t.aviso);
    if(!g("rep")) it.avisos.push("Sin representante");
    if(sexo!=="M"&&sexo!=="F") it.avisos.push("Sin sexo");
    if(!it.errores.length){
      const ck=claveNombre(nombre);
      const ex=porNombre.get(ck);
      if(ex) {it.estado="duplicado";it.avisos=["Ya existe en la plataforma ("+(ex.grado||"sin grado")+")"];}
      else if(vistoNom.has(ck)) {it.estado="duplicado";it.avisos=["Repetido en el archivo (fila "+vistoNom.get(ck)+")"];}
      else {
        vistoNom.set(ck,n);
        const otro=cedula&&(porCed.get(cedula)||vistoCed.get(cedula));
        if(otro) it.avisos.push("Misma cédula escolar que «"+otro.nombre+"»");
        if(cedula&&!vistoCed.has(cedula)) vistoCed.set(cedula,{nombre});
        it.datos={nombre,cedula,fechaNac:f.iso,grado,jornada:op.jornada||"Mañana",sexo:(sexo==="M"||sexo==="F")?sexo:"",
          telefono:t.tel,acudiente:g("rep"),telefonoAcudiente:t.tel,cedulaAcudiente:cedRep,
          observacionesMedicas:enf,mensualidad:Number(op.mens[nivelDeGrado(grado)])||0,
          anioEscolar:op.anio,estado:"alsaldo",moraConcepto:"",moraMonto:0};
      }
    } else it.estado="error";
    out.push(it);
  });
  return out;
}
// Busca la hoja y la fila de encabezados (no importa si hay títulos arriba)
function localizarTabla(wb){
  const nombres=[...wb.SheetNames].sort((a,b)=>(/estudiantes/i.test(b)?1:0)-(/estudiantes/i.test(a)?1:0));
  for(const sn of nombres){
    const rows=XLSX.utils.sheet_to_json(wb.Sheets[sn],{header:1,raw:true,defval:"",cellDates:true});
    for(let i=0;i<Math.min(rows.length,40);i++){
      const m=mapaEncabezados(rows[i].map(textoCelda));
      if("nombre" in m&&"grado" in m) return {mapa:m,filas:rows.slice(i+1).map((r,j)=>({n:i+j+2,r}))};
    }
  }
  return null;
}
function renderImportar(){
  const anio=escCfg?escCfg.actual.nombre:"2026-2027";
  return`
  <div class="card">
    <div class="card-title"><div class="card-bar"></div><h2>📥 Importar matrícula desde Excel</h2></div>
    <div style="background:#e8f0fe;border-radius:10px;padding:0.85rem;margin-bottom:0.85rem;font-size:0.8rem;color:#003366">
      <strong>📋 Cómo funciona:</strong> un solo Excel con todos los grados, una fila por estudiante. Se lee por el nombre de las columnas, así que el orden no importa.<br/>
      <code style="background:#fff;padding:2px 6px;border-radius:4px;font-size:0.72rem;display:inline-block;margin-top:4px">${PLANTILLA_COLS.join(" · ")}</code><br/>
      <span style="font-size:0.72rem;color:#555;display:block;margin-top:4px">Antes de subir verás una vista previa: los duplicados se saltan y lo que falte se marca con un aviso (se puede completar después).</span>
      <button class="btn btn-gray btn-sm" style="margin-top:0.5rem" onclick="descargarPlantillaMatricula()">⬇️ Descargar plantilla</button>
    </div>
    <div class="form-grid">
      <div class="form-row">
        <div class="field"><label class="field-label">Año escolar *</label><input class="inp" id="imp-anio" value="${escHtml(anio)}" onchange="dibujarImportacion()"/></div>
        <div class="field"><label class="field-label">Jornada</label>
          <select class="inp" id="imp-jornada" onchange="dibujarImportacion()"><option value="Mañana">Mañana</option><option value="Tarde">Tarde</option><option value="Completa">Completa</option></select></div>
      </div>
      <div class="form-row">
        <div class="field"><label class="field-label">Mensualidad Inicial ($)</label><input class="inp" id="imp-m-inicial" type="number" min="0" step="0.01" value="${MENS_DEF.inicial}" onchange="dibujarImportacion()"/></div>
        <div class="field"><label class="field-label">Mensualidad Primaria ($)</label><input class="inp" id="imp-m-primaria" type="number" min="0" step="0.01" value="${MENS_DEF.primaria}" onchange="dibujarImportacion()"/></div>
        <div class="field"><label class="field-label">Mensualidad Media General ($)</label><input class="inp" id="imp-m-media" type="number" min="0" step="0.01" value="${MENS_DEF.media}" onchange="dibujarImportacion()"/></div>
      </div>
      <div class="field">
        <label class="field-label">📂 Archivo Excel (.xlsx)</label>
        <input type="file" accept=".xlsx,.xls" id="imp-file" class="inp" style="padding:0.6rem" onchange="previsualizarExcel(this)"/>
      </div>
    </div>
    <div id="imp-preview"></div>
  </div>`;
}
function descargarPlantillaMatricula(){
  const ws=XLSX.utils.aoa_to_sheet([PLANTILLA_COLS,["1er Grado","12345678901","Nombre Apellido","M","25/03/2019","Nombre del representante","12345678","04121234567",""]]);
  ws["!cols"]=[11,16,36,6,16,28,18,14,34].map(w=>({wch:w}));
  const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,"Estudiantes");
  XLSX.writeFile(wb,"plantilla_matricula.xlsx");
}
function previsualizarExcel(input){
  const file=input.files[0];
  const box=document.getElementById("imp-preview");
  if(!file) return;
  const reader=new FileReader();
  reader.onerror=()=>{box.innerHTML='<div class="error-msg">No se pudo leer el archivo</div>';};
  reader.onload=e=>{
    try{
      const wb=XLSX.read(new Uint8Array(e.target.result),{type:"array",cellDates:true});
      const t=localizarTabla(wb);
      if(!t){box.innerHTML='<div class="error-msg">No encontré las columnas «Nombres y apellidos» y «Grado». Descarga la plantilla y usa esos encabezados.</div>';importRaw=null;importPreview=[];return;}
      importRaw=t;
      dibujarImportacion();
    }catch(err){box.innerHTML=`<div class="error-msg">Error leyendo el archivo: ${escHtml(err.message)}</div>`;}
  };
  reader.readAsArrayBuffer(file);
}
function leerOpImportacion(){
  const v=id=>{const el=document.getElementById(id);return el?el.value:"";};
  return {anio:v("imp-anio").trim(),jornada:v("imp-jornada")||"Mañana",
    mens:{inicial:parseFloat(v("imp-m-inicial"))||0,primaria:parseFloat(v("imp-m-primaria"))||0,media:parseFloat(v("imp-m-media"))||0}};
}
function dibujarImportacion(){
  const box=document.getElementById("imp-preview");
  if(!box||!importRaw) return;
  const op=leerOpImportacion();
  importFilas=construirImportacion(importRaw.filas,importRaw.mapa,op,estudiantes);
  importPreview=importFilas.filter(x=>x.estado==="nuevo").map(x=>x.datos);
  const nNuevo=importPreview.length,nDup=importFilas.filter(x=>x.estado==="duplicado").length,nErr=importFilas.filter(x=>x.estado==="error").length;
  const nAviso=importFilas.filter(x=>x.estado==="nuevo"&&x.avisos.length).length;
  const porGrado=GRADOS_IMP.map(g=>[g,importPreview.filter(d=>d.grado===g).length]).filter(x=>x[1]);
  const lista=importFilas.filter(x=>!importSoloAvisos||x.estado!=="nuevo"||x.avisos.length);
  const badge={nuevo:'<span style="color:#1a9e5c;font-weight:700">✅ Nuevo</span>',duplicado:'<span style="color:#b7791f;font-weight:700">⏭️ Se salta</span>',error:'<span style="color:#e53e3e;font-weight:700">❌ Error</span>'};
  const chip=(t,c)=>`<span style="background:${c}1a;color:${c};font-weight:700;padding:0.3rem 0.7rem;border-radius:20px;font-size:0.78rem">${t}</span>`;
  const anioOk=!!op.anio;
  box.innerHTML=`
  <div class="card" style="margin-top:0.75rem">
    <div style="display:flex;flex-wrap:wrap;gap:0.4rem;margin-bottom:0.6rem">
      ${chip(nNuevo+" a importar","#1a9e5c")}${chip(nAviso+" con avisos","#b7791f")}${chip(nDup+" duplicados (se saltan)","#718096")}${nErr?chip(nErr+" con error","#e53e3e"):""}
    </div>
    <div style="font-size:0.72rem;color:#666;margin-bottom:0.6rem">${porGrado.map(([g,n])=>escHtml(g)+": "+n).join(" · ")}</div>
    <label style="display:flex;gap:0.4rem;align-items:center;font-size:0.78rem;margin-bottom:0.5rem"><input type="checkbox" ${importSoloAvisos?"checked":""} onchange="importSoloAvisos=this.checked;dibujarImportacion()"/> Mostrar solo filas con avisos o problemas</label>
    <div style="overflow:auto;max-height:420px;margin-bottom:0.85rem">
      <table style="width:100%;border-collapse:collapse;font-size:0.72rem">
        <thead><tr style="background:#003366;color:#fff;position:sticky;top:0">
          <th style="padding:0.4rem;text-align:left">Fila</th><th style="padding:0.4rem;text-align:left">Estado</th><th style="padding:0.4rem;text-align:left">Grado</th>
          <th style="padding:0.4rem;text-align:left">Nombre</th><th style="padding:0.4rem;text-align:left">Representante</th><th style="padding:0.4rem;text-align:left">Teléfono</th><th style="padding:0.4rem;text-align:left">Avisos</th>
        </tr></thead>
        <tbody>${lista.map((x,i)=>{const d=x.datos||{};const av=[...x.errores,...x.avisos];return`<tr style="background:${x.estado==="error"?"#fff5f5":av.length?"#fffbea":i%2?"#fff":"#f8faff"}">
          <td style="padding:0.3rem 0.4rem;color:#888">${x.n}</td><td style="padding:0.3rem 0.4rem;white-space:nowrap">${badge[x.estado]}</td>
          <td style="padding:0.3rem 0.4rem;white-space:nowrap">${escHtml(d.grado||"")}</td><td style="padding:0.3rem 0.4rem;font-weight:600;color:#003366">${escHtml(d.nombre||"")}</td>
          <td style="padding:0.3rem 0.4rem">${escHtml(d.acudiente||"—")}</td><td style="padding:0.3rem 0.4rem;white-space:nowrap">${escHtml(d.telefono||"—")}</td>
          <td style="padding:0.3rem 0.4rem;color:#7a5b00">${escHtml(av.join(" · "))}</td></tr>`;}).join("")||'<tr><td colspan="7" style="padding:0.8rem;text-align:center;color:#888">Nada que mostrar</td></tr>'}</tbody>
      </table>
    </div>
    <div id="imp-progwrap" style="display:none;margin-bottom:0.75rem">
      <div style="background:#eef2f9;border-radius:20px;height:10px;overflow:hidden"><div id="imp-prog" style="height:10px;border-radius:20px;background:linear-gradient(90deg,#003366,#00509e);transition:width 0.3s;width:0%"></div></div>
      <div id="imp-progtext" style="font-size:0.72rem;color:#555;margin-top:4px;text-align:center"></div>
    </div>
    <div id="imp-log" style="display:none;background:#f8faff;border-radius:8px;padding:0.75rem;max-height:200px;overflow-y:auto;font-size:0.72rem;font-family:monospace;margin-bottom:0.75rem"></div>
    ${!anioOk?'<div class="error-msg">Escribe el año escolar</div>':""}
    <button class="btn btn-success btn-full" id="imp-btn" onclick="ejecutarImportacion()" ${nNuevo&&anioOk?"":"disabled"}>✅ Subir ${nNuevo} estudiantes a ${escHtml(op.anio||"—")}</button>
  </div>`;
}
// Sube en lotes de 400 (una sola escritura por lote: rápido y todo-o-nada por lote)
async function ejecutarImportacion(){
  if(!importPreview.length) return;
  if(soloLectura()){alert("Estás viendo un año anterior (solo lectura). Cambia al año actual para importar.");return;}
  const op=leerOpImportacion();
  if(!op.anio){alert("Escribe el año escolar");return;}
  if(!confirm(`Se van a crear ${importPreview.length} estudiantes en el año escolar ${op.anio}.\n¿Continuar?`)) return;
  const btn=document.getElementById("imp-btn"),prog=document.getElementById("imp-prog"),txt=document.getElementById("imp-progtext"),log=document.getElementById("imp-log");
  document.getElementById("imp-progwrap").style.display="block";log.style.display="block";
  btn.disabled=true;btn.textContent="Subiendo...";
  const lista=importPreview.slice();let ok=0,fallo=0;
  for(let i=0;i<lista.length;i+=400){
    const trozo=lista.slice(i,i+400);
    try{
      const b=db.batch(),nuevos=[];
      trozo.forEach(d=>{const ref=db.collection("estudiantes").doc();b.set(ref,{...d,importado:true,creadoEn:firebase.firestore.FieldValue.serverTimestamp()});nuevos.push({...d,id:ref.id,importado:true});});
      await b.commit();
      nuevos.forEach(n=>estudiantes.push(n));ok+=trozo.length;
      log.innerHTML+=`<div style="color:#1a9e5c">✅ ${trozo.length} estudiantes subidos</div>`;
    }catch(ex){
      fallo+=trozo.length;
      log.innerHTML+=`<div style="color:#e53e3e">❌ Un lote de ${trozo.length} no se subió: ${escHtml(ex.message)}</div>`;
    }
    prog.style.width=Math.round(Math.min(i+400,lista.length)/lista.length*100)+"%";
    txt.textContent=`${Math.min(i+400,lista.length)} de ${lista.length}`;
  }
  importPreview=[];importRaw=null;
  btn.textContent=fallo?`⚠️ ${ok} subidos · ${fallo} con error (puedes reintentar con el mismo archivo: se saltan los ya subidos)`:`✅ Listo: ${ok} estudiantes importados`;
  if(!fallo) btn.style.background="linear-gradient(135deg,#1a9e5c,#16875a)";
  log.innerHTML+=`<div style="color:#003366;font-weight:700;margin-top:4px">${fallo?"Importación terminada con errores":"🎉 Importación completada"}</div>`;
}
