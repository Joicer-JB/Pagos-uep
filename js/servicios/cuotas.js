// Mora automática: cuotas mensuales, recargos y deuda de cada estudiante según la configuración de cobranza.

// config/cobranza = {primerMes:"YYYY-MM", cuotas:N, diaVence:D}. Cada mes se genera la cuota de cada estudiante (= su mensualidad).
// Una cuota se considera vencida pasado el día D. Los pagos con concepto "Mensualidad" se aplican desde la cuota más antigua.
// La deuda manual anterior (estado "mora" + monto) se mantiene aparte y se suma.
// RECARGO (opcional): config.recargo = monto en $ (0 = no se cobra). Se suma UNA vez por cada cuota que no se pagó a tiempo
// (sigue vencida, o se pagó después del día de vencimiento). No se acumula mes a mes. Se paga con concepto «Recargo».
// config.recargoDesde = fecha; solo cuotas que vencen desde ese día generan recargo (evita cobrar con efecto retroactivo).
// El estudiante marcado «sinRecargo» (exonerado) nunca lo genera.
let cobCfg=null;
async function cargarCobCfg(){
  cobCfg=null;
  try{
    const s=await db.collection("config").doc("cobranza").get();
    if(s.exists){
      const d=s.data();
      if(/^\d{4}-\d{2}$/.test(d.primerMes||"")&&d.cuotas>0) cobCfg={primerMes:d.primerMes,cuotas:Math.min(24,Number(d.cuotas)),diaVence:Math.min(28,Math.max(1,Number(d.diaVence)||5)),
        recargo:Math.max(0,r2(Number(d.recargo)||0)),recargoDesde:/^\d{4}-\d{2}-\d{2}$/.test(d.recargoDesde||"")?d.recargoDesde:""};
    }
  }catch(e){console.warn("cobranza cfg:",e.message);}
}
const cobCfgActiva=()=>!!cobCfg&&!soloLectura();
// Índice de pagos por estudiante (id, cédula, nombre) para no recorrer todos los pagos por cada estudiante
let _pagoIdx={ref:null,n:-1};
function idxPagos(){
  if(_pagoIdx.ref===pagos&&_pagoIdx.n===pagos.length) return _pagoIdx;
  const I={ref:pagos,n:pagos.length,porId:new Map(),porCed:new Map(),porNom:new Map()};
  const put=(m,k,p)=>{if(!k)return;let a=m.get(k);if(!a){a=[];m.set(k,a);}a.push(p);};
  pagos.forEach(p=>{put(I.porId,p.estId,p);put(I.porCed,p.cedula,p);put(I.porNom,(p.nombre||"").toLowerCase(),p);});
  return (_pagoIdx=I);
}
function pagosDeEstudiante(e){
  const I=idxPagos(),set=new Set();
  [I.porId.get(e.id),e.cedula?I.porCed.get(e.cedula):null,I.porNom.get((e.nombre||"").toLowerCase())].forEach(a=>{if(a)a.forEach(p=>set.add(p));});
  return [...set];
}
function calcCuotas(e,hoy){
  hoy=hoy||todayStr();
  if(!cobCfgActiva()||!activo(e)) return null;
  const m=Number(e.mensualidad)||0;
  const lista=[];
  for(let k=0;k<cobCfg.cuotas;k++){
    const ym=sumarMeses(cobCfg.primerMes,k);
    if(e.cuotaDesde&&ym<e.cuotaDesde) continue;
    lista.push({ym,mes:nombreMesYM(ym),vence:ym+"-"+String(cobCfg.diaVence).padStart(2,"0"),monto:m});
  }
  const desde=cobCfg.primerMes+"-01";
  const delEst=pagosDeEstudiante(e).filter(p=>p.fecha&&p.fecha>=desde);
  // Pagos de mensualidad en orden cronológico: sirven para saber CUÁNDO quedó pagada cada cuota (¿a tiempo o tarde?)
  const pagosM=delEst.filter(p=>p.concepto==="Mensualidad").sort((a,b)=>a.fecha<b.fecha?-1:a.fecha>b.fecha?1:0);
  const pagado=r2(pagosM.reduce((s,p)=>s+(p.total||0),0));
  let resto=pagado;
  lista.forEach(c=>{const ab=Math.min(c.monto,Math.max(0,resto));c.pagado=r2(ab);c.pendiente=r2(c.monto-ab);resto=r2(resto-ab);c.vencida=c.vence<hoy;});
  let acum=0,iP=0,meta=0;
  lista.forEach(c=>{
    meta=r2(meta+c.monto);c.fechaPago=null;
    if(c.monto>0){
      while(iP<pagosM.length&&acum<meta-0.004){acum=r2(acum+Math.max(0,pagosM[iP].total||0));iP++;}
      if(acum>=meta-0.004&&iP>0) c.fechaPago=pagosM[iP-1].fecha;
    }
  });
  // Recargo por cuota no pagada a tiempo
  const rec=(cobCfg.recargo>0&&!e.sinRecargo)?cobCfg.recargo:0;
  lista.forEach(c=>{
    const tarde=c.pendiente<=0.004?(!!c.fechaPago&&c.fechaPago>c.vence):c.vencida;
    c.recargo=(rec>0&&c.monto>0&&tarde&&(!cobCfg.recargoDesde||c.vence>=cobCfg.recargoDesde))?rec:0;
  });
  const conRecargo=lista.filter(c=>c.recargo>0);
  const recargoTotal=r2(conRecargo.reduce((s,c)=>s+c.recargo,0));
  const recargoPagado=r2(delEst.filter(p=>p.concepto==="Recargo").reduce((s,p)=>s+(p.total||0),0));
  const recargoPend=r2(Math.max(0,recargoTotal-recargoPagado));
  const vencidas=lista.filter(c=>c.vencida);
  const saldo=r2(vencidas.reduce((s,c)=>s+c.pendiente,0));
  return {lista,pagado,saldo,recargoTotal,recargoPagado,recargoPend,nRecargos:conRecargo.length,total:r2(saldo+recargoPend),
    pendientes:vencidas.filter(c=>c.pendiente>0.004),aFavor:r2(Math.max(0,resto)),
    proxima:lista.find(c=>!c.vencida&&c.pendiente>0.004)||null};
}
const deudaManual=e=>e.estado==="mora"?(e.moraMonto||0):0;
function deudaDe(e){const c=calcCuotas(e);return r2((c?c.total:0)+deudaManual(e));}
const enMora=e=>e.estado!=="retirado"&&(deudaDe(e)>0||e.estado==="mora");
function conceptoDeE(e){
  const c=calcCuotas(e),p=[];
  if(c&&c.pendientes.length) p.push("Mensualidad: "+c.pendientes.map(q=>q.mes).join(", "));
  if(c&&c.recargoPend>0) p.push("Recargo por mora ("+c.nRecargos+(c.nRecargos===1?" mes":" meses")+")");
  if(deudaManual(e)>0||(e.estado==="mora"&&e.moraConcepto)) p.push(e.moraConcepto||"Deuda anterior");
  return p.join(" · ");
}
function htmlEstadoCuenta(e){
  const c=calcCuotas(e); if(!c) return "";
  const tv=tasaHoyValor();
  const bsl=u=>tv?`<div style="font-size:0.65rem;color:#888">${fmtBs(r2(u*tv))}</div>`:"";
  const est=q=>q.pendiente<=0.004?`<span class="badge badge-green">✅ Pagada</span>`:q.pagado>0?`<span class="badge badge-gold">🟡 Abonada (falta ${fmt(q.pendiente)})</span>`:q.vencida?`<span class="badge badge-red">🔴 Vencida</span>`:`<span class="badge badge-gray">⏳ Por vencer</span>`;
  return `<div class="card" style="padding:0.75rem;margin:0.75rem 0">
    <div style="font-size:0.62rem;color:#003366;text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:6px">📅 Estado de cuenta · mensualidades</div>
    ${!(e.mensualidad>0)?`<div style="font-size:0.8rem;color:#888">Sin mensualidad asignada (no se generan cuotas)</div>`:c.lista.map(q=>`
    <div style="display:flex;justify-content:space-between;align-items:center;padding:0.35rem 0;border-bottom:1px dashed #eee;font-size:0.8rem">
      <div><strong>${q.mes}</strong><div style="font-size:0.65rem;color:#888">vence ${fechaCorta(q.vence)}</div></div>
      <div style="text-align:right">${fmt(q.monto)}${bsl(q.monto)}${est(q)}${q.recargo>0?`<div style="font-size:0.65rem;color:#c0392b;font-weight:700">+ recargo ${fmt(q.recargo)}</div>`:""}</div></div>`).join("")}
    <div style="display:flex;justify-content:space-between;margin-top:6px;font-size:0.8rem"><span>Pagado en mensualidades</span><strong style="color:#1a9e5c">${fmt(c.pagado)}</strong></div>
    <div style="display:flex;justify-content:space-between;font-size:0.85rem"><span>Saldo vencido</span><strong style="color:${c.saldo>0?"#e53e3e":"#1a9e5c"}">${fmt(c.saldo)}${tv&&c.saldo>0?" · "+fmtBs(r2(c.saldo*tv)):""}</strong></div>
    ${c.recargoTotal>0?`<div style="display:flex;justify-content:space-between;font-size:0.85rem"><span>Recargos por mora (${fmt(c.recargoTotal)}${c.recargoPagado>0?" · pagado "+fmt(Math.min(c.recargoPagado,c.recargoTotal)):""})</span><strong style="color:${c.recargoPend>0?"#e53e3e":"#1a9e5c"}">${fmt(c.recargoPend)}</strong></div>
    <div style="display:flex;justify-content:space-between;font-size:0.9rem;border-top:1px solid #eee;margin-top:3px;padding-top:3px"><span>Total a pagar</span><strong style="color:${c.total>0?"#e53e3e":"#1a9e5c"}">${fmt(c.total)}${tv&&c.total>0?" · "+fmtBs(r2(c.total*tv)):""}</strong></div>`:""}
    ${c.aFavor>0?`<div style="display:flex;justify-content:space-between;font-size:0.8rem"><span>Saldo a favor</span><strong style="color:#1a9e5c">${fmt(c.aFavor)}</strong></div>`:""}
  </div>`;
}
async function guardarCobCfg(){
  if(rolUsuario!=="director"){alert("Solo el director puede cambiar las cuotas");return;}
  const primerMes=document.getElementById("cc-primer").value;
  const n=parseInt(document.getElementById("cc-n").value,10), dia=parseInt(document.getElementById("cc-dia").value,10);
  if(!/^\d{4}-\d{2}$/.test(primerMes)){alert("Elige el mes de la primera cuota");return;}
  if(!(n>=1&&n<=24)){alert("El número de cuotas debe estar entre 1 y 24");return;}
  if(!(dia>=1&&dia<=28)){alert("El día de vencimiento debe estar entre 1 y 28");return;}
  // Recargo opcional: casilla apagada o monto 0 = no se cobra
  const activar=!!(document.getElementById("cc-rec-on")||{}).checked;
  const monto=activar?r2(parseFmt((document.getElementById("cc-rec-monto")||{}).value||"0")):0;
  if(activar&&!(monto>0&&monto<=1000)){alert("Escribe el monto del recargo en $ (ej: 5)");return;}
  const incluirVencidas=!!(document.getElementById("cc-rec-viejas")||{}).checked;
  // Sin retroactivo: al activarlo por primera vez, solo cuentan las cuotas que venzan desde hoy (salvo que lo marques)
  const recargoDesde=monto>0?(incluirVencidas?"":((cobCfg&&cobCfg.recargo>0&&cobCfg.recargoDesde)||todayStr())):"";
  try{
    const nueva={primerMes,cuotas:n,diaVence:dia,recargo:monto,recargoDesde};
    await db.collection("config").doc("cobranza").set(nueva);
    cobCfg=nueva;
    renderTabContent();
  }catch(e){alert("No se pudo guardar: "+e.message);}
}
function htmlCfgCuotas(){
  const c=cobCfg;
  if(rolUsuario!=="director") return c
    ?`<div class="alert-item alert-info">📅 Mora automática activa · ${c.cuotas} cuotas desde ${nombreMesYM(c.primerMes)} · vencen el día ${c.diaVence}${c.recargo>0?" · recargo "+fmt(c.recargo)+" por cuota atrasada":""}</div>`
    :`<div class="alert-item alert-mora">⚠️ La mora automática no está configurada (el director debe activarla)</div>`;
  const mesDef=(escCfg&&escCfg.actual.inicio?escCfg.actual.inicio:todayStr()).slice(0,7);
  return `<details class="card" ${c?"":"open"} style="padding:0.85rem">
    <summary style="cursor:pointer;font-weight:700;color:${c?"#003366":"#c0392b"}">${c?"⚙️ Cuotas del año · mora automática activa":"⚠️ Activa la mora automática"}</summary>
    <div class="form-row" style="margin-top:0.6rem">
      <div class="field"><label class="field-label">Primera cuota (mes)</label><input class="inp" type="month" id="cc-primer" value="${c?c.primerMes:mesDef}"/></div>
      <div class="field"><label class="field-label">N° de cuotas del año</label><input class="inp" type="number" id="cc-n" min="1" max="24" value="${c?c.cuotas:10}"/></div>
    </div>
    <div class="field" style="margin-top:0.4rem"><label class="field-label">Vence el día (de cada mes)</label><input class="inp" type="number" id="cc-dia" min="1" max="28" value="${c?c.diaVence:5}"/></div>
    <div style="font-size:0.72rem;color:#666;margin:0.4rem 0">Cada cuota es la mensualidad de cada estudiante y se considera vencida pasado ese día. Los pagos con concepto «Mensualidad» se aplican a la cuota más antigua.</div>
    <div style="background:#fffbea;border-radius:10px;padding:0.7rem;margin:0.5rem 0">
      <label style="display:flex;gap:0.5rem;align-items:center;font-weight:700;font-size:0.82rem;color:#7a5b00"><input type="checkbox" id="cc-rec-on" ${c&&c.recargo>0?"checked":""} onchange="document.getElementById('cc-rec-box').style.display=this.checked?'block':'none'"/> Cobrar recargo por mensualidad atrasada</label>
      <div id="cc-rec-box" style="display:${c&&c.recargo>0?"block":"none"};margin-top:0.5rem">
        <div class="field"><label class="field-label">Recargo por cada mensualidad no pagada a tiempo ($)</label><input class="inp" id="cc-rec-monto" inputmode="decimal" placeholder="5,00" value="${c&&c.recargo>0?String(c.recargo).replace(".",","):"5,00"}" oninput="fmtInput(this)"/></div>
        <label style="display:flex;gap:0.5rem;align-items:center;font-size:0.76rem;margin-top:0.4rem"><input type="checkbox" id="cc-rec-viejas" ${c&&c.recargo>0&&!c.recargoDesde?"checked":""}/> Incluir también las cuotas que ya vencieron (por defecto solo las que venzan desde hoy)</label>
        <div style="font-size:0.7rem;color:#666;margin-top:0.4rem">Se suma una sola vez por cada cuota atrasada (no crece mes a mes). Se cobra con el concepto «Recargo». Puedes exonerar a un estudiante en su ficha.</div>
      </div>
    </div>
    <button class="btn btn-primary btn-sm" onclick="guardarCobCfg()">💾 Guardar</button>
  </details>`;
}
const activo=e=>e.estado!=="retirado"&&!e.graduado;   // inscrito este año (ni retirado ni graduado)
const baseAnio=()=>(escCfg&&!soloLectura())?escCfg.actual.inicio:"";
