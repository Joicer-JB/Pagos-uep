// Pase de grado: promueve a los estudiantes al grado siguiente al cerrar el año (con opción de deshacer).

let promoMapa={};          // grado tal como está escrito (normalizado) → posición en ESCALERA, o -1 = no cambiar
let promoRepite=new Set(); // estudiantes que repiten el grado
let promoAbiertos=new Set();
const gradoKey=g=>normGrado(g).replace(/[^a-z0-9 ()]/g,"")||"(sin grado)";
const promoIndice=e=>{const k=gradoKey(e.grado);return k in promoMapa?promoMapa[k]:posEscalera(e.grado);};
function destinoDe(idx){
  if(!(idx>=0)) return {tipo:"sin"};
  if(idx===ESCALERA.length-1) return {tipo:"gradua",de:ESCALERA[idx]};
  return {tipo:"pasa",de:ESCALERA[idx],a:ESCALERA[idx+1],
    hito:ESCALERA[idx]==="6to Grado"?"Egresó de Primaria":ESCALERA[idx]==="Nivel III"?"Egresó de Preescolar":""};
}
// Qué le pasaría a cada estudiante (retirados y graduados quedan fuera; los ya promovidos este año se omiten)
function planPromocion(){
  const actualId=escCfg?escCfg.actual.id:"";
  return estudiantes.filter(e=>e.estado!=="retirado"&&!e.graduado).map(e=>{
    if(actualId&&e.ultimaPromocion===actualId) return {e,accion:"hecho"};
    const d=destinoDe(promoIndice(e));
    if(d.tipo==="sin") return {e,accion:"sin"};
    if(promoRepite.has(e.id)) return {e,accion:"repite",de:d.de};
    return {e,accion:d.tipo==="gradua"?"gradua":"pasa",...d};
  });
}
function resumenPromo(plan){
  const c=a=>plan.filter(p=>p.accion===a).length;
  return {pasan:c("pasa"),gradúan:c("gradua"),repiten:c("repite"),sin:c("sin"),hechos:c("hecho")};
}
function htmlResumenPromo(plan){
  const r=resumenPromo(plan);
  const chip=(t,c)=>`<span style="display:inline-block;background:${c}1a;color:${c};border:1px solid ${c}55;border-radius:20px;padding:0.2rem 0.65rem;font-size:0.76rem;font-weight:700;margin:0 0.3rem 0.3rem 0">${t}</span>`;
  return chip("⬆️ Pasan de grado: "+r.pasan,"#1a9e5c")+chip("🎓 Se gradúan: "+r.gradúan,"#b8860b")+chip("🔁 Repiten: "+r.repiten,"#003366")
    +(r.sin?chip("⚠️ Sin interpretar (no se mueven): "+r.sin,"#c0392b"):"")+(r.hechos?chip("✅ Ya promovidos: "+r.hechos,"#888888"):"");
}
async function aplicarPromocion(){
  if(rolUsuario!=="director"){alert("Solo el director puede pasar de grado");return;}
  if(soloLectura()){alert("Estás viendo un año anterior. Vuelve al año actual para pasar de grado.");return;}
  if(!escCfg){alert("Primero inicia el nuevo año escolar (Config → Año escolar).");return;}
  const termina=escCfg.anteriores.length?escCfg.anteriores[escCfg.anteriores.length-1].nombre:"";
  const plan=planPromocion(), r=resumenPromo(plan);
  const mover=plan.filter(p=>p.accion==="pasa"||p.accion==="gradua"||p.accion==="repite");
  if(!mover.length){alert("No hay estudiantes por pasar de grado."+(r.hechos?" ("+r.hechos+" ya fueron promovidos en este año)":""));return;}
  const msg="Pase de grado "+(termina?termina+" → ":"")+escCfg.actual.nombre+"\n\n"
    +"• "+r.pasan+" estudiantes pasan al grado siguiente\n"
    +"• "+r.gradúan+" se gradúan (5to Año → Bachiller)\n"
    +"• "+r.repiten+" repiten el grado\n"
    +(r.sin?"• "+r.sin+" no se pudieron interpretar y NO se moverán\n":"")
    +(r.hechos?"• "+r.hechos+" ya estaban promovidos y se omiten\n":"")
    +"\nSe descargará un respaldo antes de empezar. ¿Continuar?";
  if(!confirm(msg)) return;
  try{
    descargarRespaldo("antes-del-pase-de-grado");
    const actualId=escCfg.actual.id;
    for(let i=0;i<mover.length;i+=400){
      const b=db.batch();
      mover.slice(i,i+400).forEach(p=>{
        const e=p.e,hist=[...(Array.isArray(e.historialGrados)?e.historialGrados:[])];
        let upd;
        if(p.accion==="pasa"){hist.push({anio:termina,grado:e.grado||p.de,resultado:p.hito||"Promovido"});upd={grado:p.a,ultimaPromocion:actualId,historialGrados:hist};}
        else if(p.accion==="gradua"){hist.push({anio:termina,grado:e.grado||p.de,resultado:"Graduado (Bachiller)"});upd={graduado:true,graduadoEn:termina,ultimaPromocion:actualId,historialGrados:hist};}
        else{hist.push({anio:termina,grado:e.grado||p.de,resultado:"Repite"});upd={ultimaPromocion:actualId,historialGrados:hist};}
        p.upd=upd;
        b.update(db.collection("estudiantes").doc(e.id),upd);
      });
      await b.commit();
    }
    mover.forEach(p=>{const i=estudiantes.findIndex(x=>x.id===p.e.id);if(i>=0)estudiantes[i]={...estudiantes[i],...p.upd};});
    promoRepite=new Set();
    alert("✅ Listo: "+r.pasan+" pasaron de grado, "+r.gradúan+" se graduaron y "+r.repiten+" repiten."+(r.sin?"\n\nQuedaron "+r.sin+" sin mover porque no se pudo interpretar su grado: ajústalos abajo o edítalos a mano.":""));
    renderTabContent();
  }catch(err){
    alert("No se pudo completar el pase de grado: "+err.message+"\n\nPuedes volver a pulsar el botón: los que ya se promovieron se omiten.");
    cargarTodo();
  }
}
async function deshacerPromocion(){
  if(rolUsuario!=="director"){alert("Solo el director puede deshacer el pase de grado");return;}
  if(soloLectura()||!escCfg) return;
  const id=escCfg.actual.id,t=estudiantes.filter(e=>e.ultimaPromocion===id);
  if(!t.length){alert("No hay un pase de grado para deshacer");return;}
  if(!confirm("Se devolverá a su grado anterior a los "+t.length+" estudiantes promovidos en este año (los graduados vuelven a estar activos).\n\nSe descargará un respaldo antes. ¿Continuar?")) return;
  try{
    descargarRespaldo("antes-de-deshacer-pase-de-grado");
    const nuevos={};
    for(let i=0;i<t.length;i+=400){
      const b=db.batch();
      t.slice(i,i+400).forEach(e=>{
        const hist=Array.isArray(e.historialGrados)?e.historialGrados:[];
        const prev=hist.length?hist[hist.length-1].grado:e.grado;
        const rest=hist.slice(0,-1);
        nuevos[e.id]={grado:prev,historialGrados:rest};
        b.update(db.collection("estudiantes").doc(e.id),{grado:prev,historialGrados:rest,graduado:firebase.firestore.FieldValue.delete(),graduadoEn:firebase.firestore.FieldValue.delete(),ultimaPromocion:firebase.firestore.FieldValue.delete()});
      });
      await b.commit();
    }
    t.forEach(e=>{const i=estudiantes.findIndex(x=>x.id===e.id);if(i>=0){const {graduado,graduadoEn,ultimaPromocion,...resto}=estudiantes[i];estudiantes[i]={...resto,...nuevos[e.id]};}});
    alert("↩️ Listo: "+t.length+" estudiantes volvieron a su grado anterior.");
    renderTabContent();
  }catch(err){alert("No se pudo deshacer: "+err.message);cargarTodo();}
}
const promoMapear=(k,v)=>{promoMapa[k]=Number(v);refrescarPromo();};
const promoToggle=(k,abierto)=>{abierto?promoAbiertos.add(k):promoAbiertos.delete(k);};
function promoRepetir(id,on){
  on?promoRepite.add(id):promoRepite.delete(id);
  const r=document.getElementById("promo-resumen");if(r)r.innerHTML=htmlResumenPromo(planPromocion());
}
function refrescarPromo(){const box=document.getElementById("promo-box");if(box)box.innerHTML=cuerpoPromo();}
function filaGrupoPromo(k,g){
  const idx=promoIndice(g.items[0].e),d=destinoDe(idx);
  const hecho=g.items.every(p=>p.accion==="hecho");
  const dest=hecho?`<span style="color:#888">✅ ya promovidos</span>`
    :d.tipo==="pasa"?`→ <strong style="color:#1a9e5c">${d.a}</strong>${d.hito?` <small style="color:#888">(${d.hito})</small>`:""}`
    :d.tipo==="gradua"?`→ <strong style="color:#b8860b">🎓 Se gradúa (Bachiller)</strong>`
    :`<span style="color:#c0392b">⚠️ elige a qué grado equivale</span>`;
  const opts=`<option value="-1" ${!(idx>=0)?"selected":""}>— No cambiar / elegir —</option>`+ESCALERA.map((x,i)=>`<option value="${i}" ${idx===i?"selected":""}>${x}</option>`).join("");
  return `<details class="card" ${promoAbiertos.has(k)?"open":""} ontoggle="promoToggle('${k}',this.open)" style="padding:0.7rem 0.85rem;margin-bottom:0.45rem">
    <summary style="cursor:pointer;font-size:0.85rem"><strong style="color:#003366">${g.texto}</strong> · ${g.items.length} estudiante${g.items.length!==1?"s":""} &nbsp;${dest}</summary>
    <div style="margin-top:0.6rem">
      <div style="font-size:0.74rem;color:#666;margin-bottom:0.3rem">Este grado equivale a:</div>
      <select class="inp" style="padding:0.45rem 0.6rem;font-size:0.8rem;margin-bottom:0.5rem" onchange="promoMapear('${k}',this.value)">${opts}</select>
      <div style="font-size:0.74rem;color:#666;margin:0.2rem 0">Marca a los que <strong>repiten</strong> el grado:</div>
      ${g.items.map(p=>`<label style="display:flex;gap:0.5rem;align-items:center;font-size:0.8rem;padding:0.15rem 0"><input type="checkbox" ${promoRepite.has(p.e.id)?"checked":""} ${p.accion==="hecho"?"disabled":""} onchange="promoRepetir('${p.e.id}',this.checked)"/> ${p.e.nombre}${p.accion==="hecho"?` <small style="color:#888">(ya promovido)</small>`:""}</label>`).join("")}
    </div></details>`;
}
function cuerpoPromo(){
  const termina=escCfg.anteriores.length?escCfg.anteriores[escCfg.anteriores.length-1].nombre:"";
  const plan=planPromocion();
  const grupos=new Map();
  plan.forEach(p=>{const k=gradoKey(p.e.grado);if(!grupos.has(k))grupos.set(k,{texto:p.e.grado||"(sin grado)",items:[]});grupos.get(k).items.push(p);});
  const orden=[...grupos.entries()].sort((a,b)=>{const ia=promoIndice(a[1].items[0].e),ib=promoIndice(b[1].items[0].e);return ((ia>=0?ia:99)-(ib>=0?ib:99))||a[1].texto.localeCompare(b[1].texto);});
  const hayHechos=estudiantes.some(e=>e.ultimaPromocion===escCfg.actual.id);
  return `<div class="section-title">🎓 Pase de grado${termina?" · "+termina+" → "+escCfg.actual.nombre:""}</div>
  <div style="font-size:0.78rem;color:#555;margin-bottom:0.7rem;line-height:1.45">
    Pasa a todos los estudiantes al grado siguiente de una sola vez: <strong>6to Grado → 1er Año</strong> (bachillerato) y <strong>5to Año → Graduado</strong>.
    Revisa la lista, marca a quienes repiten y pulsa el botón. Antes de empezar se descarga un respaldo, y se puede deshacer.
  </div>
  <div id="promo-resumen">${htmlResumenPromo(plan)}</div>
  ${plan.length?orden.map(([k,g])=>filaGrupoPromo(k,g)).join(""):`<div class="alert-item alert-info">No hay estudiantes activos para pasar de grado.</div>`}
  <div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-top:0.6rem">
    <button class="btn btn-primary" onclick="aplicarPromocion()">🎓 Pasar de grado a todos</button>
    ${hayHechos?`<button class="btn btn-gray btn-sm" onclick="deshacerPromocion()">↩️ Deshacer el pase de grado</button>`:""}
  </div>`;
}
function renderPromocion(){
  if(rolUsuario!=="director") return "";
  if(!escCfg) return `<hr class="divider"/><div class="section-title">🎓 Pase de grado</div><div class="alert-item alert-info">Primero inicia el nuevo año escolar (arriba). Después aquí podrás pasar a todos los estudiantes de grado de una sola vez.</div>`;
  return `<hr class="divider"/><div id="promo-box">${cuerpoPromo()}</div>`;
}
