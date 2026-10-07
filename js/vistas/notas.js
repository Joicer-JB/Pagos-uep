// Pestaña Notas: carga de notas por lapso (literales en preescolar/primaria, numéricas en media) y nota final.

function getAreas(grado){
  const nivel = getNivel(grado);
  if(nivel==="preescolar") return ["Lengua y Comunicación","Pensamiento Matemático","Exploración y Conocimiento del Mundo","Desarrollo Personal y Social","Educación Física","Inglés","Educación Estética"];
  if(nivel==="primaria") return ["Lengua y Literatura","Matemáticas","Ciencias Naturales y Tecnología","Ciencias Sociales","Educación Física","Educación Estética","Inglés"];
  // Media General: from configMaterias
  return configMaterias[grado]||MATERIAS;
}
function getIndicadores(grado, area){
  const key = grado+"__"+area;
  return configIndicadores[key]||[];
}
// ══════════════════════════════════════════════════════════
// RENDER NOTAS
// ══════════════════════════════════════════════════════════
function renderNotas(){
  const estSelId=filtros.estSelId||"";
  const estSel=estudiantes.find(e=>e.id===estSelId);
  const lapso=filtros.lapso||LAPSOS[0];
  return`
  <div class="card">
    <div class="card-title"><div class="card-bar"></div><h2>📝 Consultar Notas</h2></div>
    <div class="form-grid">
      <div class="field"><label class="field-label">Filtrar por Grado</label>
        <select class="inp" onchange="filtros.gradoNotas=this.value;filtros.estSelId='';renderTabContent()">
          <option value="">-- Todos los grados --</option>
          ${[...new Set(estudiantes.filter(activo).map(e=>e.grado).filter(Boolean))].sort(ordenGrados).map(g=>`<option value="${g}" ${filtros.gradoNotas===g?"selected":""}>${g}</option>`).join("")}
        </select>
      </div>
      <div class="field"><label class="field-label">Seleccionar Estudiante</label>
        <select class="inp" onchange="filtros.estSelId=this.value;renderTabContent()">
          <option value="">-- Seleccionar estudiante --</option>
          ${estudiantes.filter(e=>activo(e)&&(!filtros.gradoNotas||e.grado===filtros.gradoNotas)).map(e=>`<option value="${e.id}" ${estSelId===e.id?"selected":""}>${e.nombre} ${e.grado?"("+e.grado+")":""}</option>`).join("")}
        </select>
      </div>
    </div>
  </div>
  ${estSel?`
  <div class="card" style="padding:0.85rem 1rem">
    <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:0.5rem">
      <div style="width:40px;height:40px;background:linear-gradient(135deg,#003366,#00509e);border-radius:50%;display:flex;align-items:center;justify-content:center;color:#ffd700;font-weight:800;font-size:1rem;flex-shrink:0">${estSel.nombre[0]}</div>
      <div><div style="font-weight:700;color:#003366">${estSel.nombre}</div>
      <div style="font-size:0.72rem;color:#888">${estSel.grado||""} · ${getNivel(estSel.grado)==="media"?"Media General":getNivel(estSel.grado)==="primaria"?"Primaria":"Preescolar"}</div></div>
      <button class="btn btn-gray btn-sm" style="margin-left:auto" onclick="imprimirBoletin('${estSel.id}')">🖨️ Boletín</button>
    </div>
  </div>
  <div class="stabs">
    ${LAPSOS.map(l=>`<button class="stab ${lapso===l?"active":""}" onclick="filtros.lapso='${l}';renderTabContent()">${l}</button>`).join("")}
  </div>
  ${getNivel(estSel.grado)==="media"?renderTablaNotasMedia(estSel,lapso):renderTablaNotasPrimaria(estSel,lapso)}
  ${renderNotaFinal(estSel)}`:""}`;
}
// ── Media General ──
function renderTablaNotasMedia(est,lapso){
  const key=`${est.id}_${lapso}`;
  const notasEst=notas[key]||{};
  const areas=getAreas(est.grado);

  return`
  <div class="card">
    <div class="card-title"><div class="card-bar"></div><h2>Notas — ${lapso}</h2>
      <button class="btn btn-primary btn-sm" style="margin-left:auto" onclick="guardarNotas('${est.id}','${lapso}')">💾 Guardar</button>
    </div>
    <div style="overflow-x:auto">
      <table style="width:100%;border-collapse:collapse;font-size:0.78rem">
        <thead><tr style="background:#f0f4ff">
          <th style="text-align:left;padding:0.5rem 0.6rem;color:#003366">Materia</th>
          <th style="padding:0.5rem 0.4rem;color:#003366;text-align:center">Eval 1</th>
          <th style="padding:0.5rem 0.4rem;color:#003366;text-align:center">Eval 2</th>
          <th style="padding:0.5rem 0.4rem;color:#003366;text-align:center">Eval 3</th>
          <th style="padding:0.5rem 0.4rem;color:#003366;text-align:center">Prom</th>
        </tr></thead>
        <tbody>
          ${areas.map(m=>{
            const v1=notasEst[m+"_1"]||"",v2=notasEst[m+"_2"]||"",v3=notasEst[m+"_3"]||"";
            const vals=[v1,v2,v3].filter(v=>v!=="");
            const prom=vals.length?Math.round(vals.reduce((a,b)=>a+parseFloat(b),0)/vals.length*10)/10:null;
            return`<tr style="border-bottom:1px dashed #eef2f9">
              <td style="padding:0.45rem 0.6rem;font-weight:600;color:#333">${m}</td>
              ${[m+"_1",m+"_2",m+"_3"].map(k=>`<td style="padding:0.3rem"><input class="nota-input" type="number" min="0" max="20" step="0.1" id="nota_${est.id}_${lapso}_${k}" value="${notasEst[k]||""}" placeholder="-" onchange="updateNotaLocal('${est.id}','${lapso}','${k}',this.value)"/></td>`).join("")}
              <td style="padding:0.3rem;text-align:center"><span class="promedio-badge" style="background:${prom===null?"#f1f3f5":prom>=18?"#e6f7ef":prom>=14?"#fff8e1":"#fef0f0"};color:${prom===null?"#888":colorNota(prom)}">${prom!==null?prom:"-"}</span></td>
            </tr>`;}).join("")}
        </tbody>
      </table>
    </div>
  </div>`;
}
// ── Primaria y Preescolar ──
function renderTablaNotasPrimaria(est,lapso){
  const key=`${est.id}_${lapso}`;
  const notasEst=notas[key]||{};
  const areas=getAreas(est.grado);

  if(areas.length===0) return`<div class="card"><div class="empty-state">⚙️ No hay áreas configuradas para ${est.grado}. Ve a Configuración → Indicadores para agregarlas.</div></div>`;

  return`
  <div class="card">
    <div class="card-title"><div class="card-bar"></div><h2>Notas — ${lapso}</h2>
      <button class="btn btn-primary btn-sm" style="margin-left:auto" onclick="guardarNotas('${est.id}','${lapso}')">💾 Guardar</button>
    </div>
    <div style="overflow-x:auto">
      <table style="width:100%;border-collapse:collapse;font-size:0.78rem;border:1.5px solid #ccc">
        <thead>
          <tr style="background:#003366;color:#fff">
            <th style="padding:0.5rem 0.6rem;text-align:left;border:1px solid #ccc;width:130px">Área de Formación</th>
            <th style="padding:0.5rem;text-align:left;border:1px solid #ccc">Indicadores</th>
            <th style="padding:0.5rem;text-align:center;border:1px solid #ccc;width:32px">A</th>
            <th style="padding:0.5rem;text-align:center;border:1px solid #ccc;width:32px">B</th>
            <th style="padding:0.5rem;text-align:center;border:1px solid #ccc;width:32px">C</th>
            <th style="padding:0.5rem;text-align:center;border:1px solid #ccc;width:32px">D</th>
            <th style="padding:0.5rem;text-align:center;border:1px solid #ccc;width:32px">E</th>
          </tr>
        </thead>
        <tbody>
          ${areas.map(area=>{
            const inds = getIndicadores(est.grado, area);
            if(inds.length===0){
              return`<tr><td style="padding:0.4rem 0.6rem;font-weight:700;color:#003366;border:1px solid #ddd;vertical-align:top;font-size:0.72rem;writing-mode:vertical-rl;text-orientation:mixed;text-align:center" rowspan="1">${area}</td>
                <td style="padding:0.4rem;color:#aaa;font-size:0.75rem;border:1px solid #ddd" colspan="6">Sin indicadores. Agrégalos en Configuración → Indicadores.</td></tr>`;
            }
            return inds.map((ind,i)=>{
              const fieldKey = area+"__"+i;
              const valActual = notasEst[fieldKey]||"";
              const firstRow = i===0;
              return`<tr style="border-bottom:1px solid #eee">
                ${firstRow?`<td style="padding:0.4rem 0.3rem;font-weight:700;color:#003366;border:1px solid #ddd;vertical-align:middle;font-size:0.68rem;writing-mode:vertical-rl;text-orientation:mixed;text-align:center;background:#f0f4ff" rowspan="${inds.length}">${area}</td>`:""}
                <td style="padding:0.35rem 0.5rem;font-size:0.76rem;color:#333;border:1px solid #ddd">${ind}</td>
                ${LETRAS.map(letra=>`<td style="padding:0.2rem;text-align:center;border:1px solid #ddd">
                  <input type="radio" name="nota_${est.id}_${lapso}_${fieldKey}" value="${letra}" ${valActual===letra?"checked":""} onchange="updateNotaLocal('${est.id}','${lapso}','${fieldKey}','${letra}')"/>
                </td>`).join("")}
              </tr>`;
            }).join("");
          }).join("")}
        </tbody>
      </table>
    </div>
  </div>`;
}
function renderNotaFinal(est){
  const nivel = getNivel(est.grado);
  const areas = getAreas(est.grado);
  if(nivel==="media"){
    const promediosPorMateria = areas.map(m=>{
      let vals=[];
      LAPSOS.forEach(lapso=>{
        const k=`${est.id}_${lapso}`;
        const notasEst=notas[k]||{};
        [1,2,3].forEach(n=>{
          const v=notasEst[m+"_"+n];
          if(v!==undefined&&v!=="")vals.push(parseFloat(v));
        });
      });
      const prom=vals.length?Math.round(vals.reduce((a,b)=>a+b,0)/vals.length*10)/10:null;
      return{materia:m,prom};
    });
    const conNota=promediosPorMateria.filter(p=>p.prom!==null);
    if(conNota.length===0)return"";
    const notaFinalGen=Math.round(conNota.reduce((a,p)=>a+p.prom,0)/conNota.length*10)/10;
    return`
    <div class="card" style="margin-top:0.85rem">
      <div class="card-title"><div class="card-bar"></div><h2>🏆 Nota Final</h2></div>
      <table style="width:100%;border-collapse:collapse;font-size:0.8rem">
        <thead><tr style="background:#f0f4ff">
          <th style="text-align:left;padding:0.45rem 0.6rem;color:#003366">Materia</th>
          <th style="padding:0.45rem;color:#003366;text-align:center">L1</th>
          <th style="padding:0.45rem;color:#003366;text-align:center">L2</th>
          <th style="padding:0.45rem;color:#003366;text-align:center">L3</th>
          <th style="padding:0.45rem;color:#003366;text-align:center">🏆 Final</th>
        </tr></thead>
        <tbody>
          ${areas.map(m=>{
            const promLapsos=LAPSOS.map(lapso=>{
              const k=`${est.id}_${lapso}`;
              const notasEst=notas[k]||{};
              const vals=[notasEst[m+"_1"],notasEst[m+"_2"],notasEst[m+"_3"]].filter(v=>v!==undefined&&v!=="");
              return vals.length?Math.round(vals.reduce((a,b)=>a+parseFloat(b),0)/vals.length*10)/10:null;
            });
            const validos=promLapsos.filter(v=>v!==null);
            const notaFinal=validos.length?Math.round(validos.reduce((a,b)=>a+b,0)/validos.length*10)/10:null;
            return`<tr style="border-bottom:1px dashed #eef2f9">
              <td style="padding:0.4rem 0.6rem;font-weight:600;color:#333;font-size:0.78rem">${m}</td>
              ${promLapsos.map(p=>`<td style="padding:0.3rem;text-align:center;font-size:0.78rem;color:${p===null?"#ccc":colorNota(p)}">${p!==null?p:"-"}</td>`).join("")}
              <td style="padding:0.3rem;text-align:center"><span style="padding:0.25rem 0.5rem;border-radius:8px;font-weight:800;font-size:0.8rem;background:${notaFinal===null?"#f1f3f5":notaFinal>=18?"#e6f7ef":notaFinal>=14?"#fff8e1":"#fef0f0"};color:${notaFinal===null?"#888":colorNota(notaFinal)}">${notaFinal!==null?notaFinal:"-"}</span></td>
            </tr>`;}).join("")}
        </tbody>
      </table>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:0.85rem;padding:0.85rem 1rem;background:linear-gradient(135deg,#003366,#00509e);border-radius:10px;color:#fff">
        <span style="color:#ffd700;font-weight:700">🏆 NOTA FINAL GENERAL</span>
        <span style="font-size:1.4rem;font-weight:800;font-family:Georgia,serif;color:${notaFinalGen>=18?"#7fff9f":notaFinalGen>=14?"#ffd700":"#ff6b6b"}">${notaFinalGen}</span>
      </div>
    </div>`;
  } else {
    // Primaria/Preescolar: show letter summary
    const resumen = areas.map(area=>{
      const inds = getIndicadores(est.grado, area);
      const letrasCount = {A:0,B:0,C:0,D:0,E:0,total:0};
      LAPSOS.forEach(lapso=>{
        const k=`${est.id}_${lapso}`;
        const notasEst=notas[k]||{};
        inds.forEach((_,i)=>{
          const v=notasEst[area+"__"+i];
          if(v&&LETRAS.includes(v)){letrasCount[v]++;letrasCount.total++;}
        });
      });
      return{area,letrasCount};
    });
    const hayNotas = resumen.some(r=>r.letrasCount.total>0);
    if(!hayNotas)return"";
    return`
    <div class="card" style="margin-top:0.85rem">
      <div class="card-title"><div class="card-bar"></div><h2>📊 Resumen de Evaluación</h2></div>
      <table style="width:100%;border-collapse:collapse;font-size:0.8rem">
        <thead><tr style="background:#f0f4ff">
          <th style="text-align:left;padding:0.45rem 0.6rem;color:#003366">Área</th>
          ${LETRAS.map(l=>`<th style="padding:0.45rem;color:#003366;text-align:center">${l}</th>`).join("")}
        </tr></thead>
        <tbody>
          ${resumen.map(r=>`<tr style="border-bottom:1px dashed #eef2f9">
            <td style="padding:0.4rem 0.6rem;font-weight:600;color:#333;font-size:0.75rem">${r.area}</td>
            ${LETRAS.map(l=>`<td style="padding:0.3rem;text-align:center">
              ${r.letrasCount[l]>0?`<span style="padding:0.2rem 0.45rem;border-radius:8px;font-weight:700;font-size:0.78rem;background:${l==="A"?"#e6f7ef":l==="B"?"#e8f0fe":l==="C"?"#fff8e1":l==="D"?"#fff3e0":"#fef0f0"};color:${l==="A"?"#1a9e5c":l==="B"?"#003366":l==="C"?"#b8860b":l==="D"?"#e65100":"#e53e3e"}">${r.letrasCount[l]}</span>`:"<span style='color:#ccc'>-</span>"}
            </td>`).join("")}
          </tr>`).join("")}
        </tbody>
      </table>
    </div>`;
  }
}
function updateNotaLocal(estId,lapso,key,val){
  const k=`${estId}_${lapso}`;
  if(!notas[k])notas[k]={};
  notas[k][key]=val;
}
async function guardarNotas(estId,lapso){
  const key=`${estId}_${lapso}`;
  const datos=notas[key]||{};
  try{
    await db.collection("notas").doc(key).set({estId,lapso,...datos,updatedAt:firebase.firestore.FieldValue.serverTimestamp()});
    const estObj=estudiantes.find(e=>e.id===estId);
    if(estObj)alertaNotas(estObj,lapso);
    alert("✅ Notas guardadas correctamente");
  }catch(e){alert("Error: "+e.message);}
}
