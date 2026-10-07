// Pestaña Cobranza: estudiantes por cobrar, recordatorios por WhatsApp y correo, recibo de cobranza en imagen.

let cobF={busq:"",grado:"",orden:"monto",dias:30,vista:"mora"};
let _cobTimer=null;
// Días desde una fecha "YYYY-MM-DD" (hora local, sin desfase por UTC)
function diasDesde(fechaStr){
  if(!fechaStr) return null;
  const f=new Date(fechaStr+"T00:00:00"); if(isNaN(f)) return null;
  const h=new Date(); h.setHours(0,0,0,0);
  return Math.round((h-f)/86400000);
}
// Teléfono del representante: el primero válido entre el del acudiente y el del estudiante
function telDe(e){
  const c=[e.telefonoAcudiente,e.telefono];
  for(const x of c){const wa=normalizarTelVE(x);if(wa)return {raw:x,wa,fijo:wa[2]==="2"};}
  return {raw:c.find(Boolean)||"",wa:"",fijo:false};
}
function filaCobranza(e){
  const pagosEst=pagosDeEstudiante(e);
  const ultimo=pagosEst.length?pagosEst.reduce((a,b)=>(a.fecha||"")>(b.fecha||"")?a:b):null;
  const cu=calcCuotas(e);
  const auto=cu?cu.total:0, manual=deudaManual(e);
  const deuda=r2(auto+manual);
  return {e,enMora:e.estado!=="retirado"&&(deuda>0||e.estado==="mora"),deuda,auto,manual,
    meses:cu?cu.pendientes.map(q=>q.mes):[],ultimo,
    diasSin:ultimo?diasDesde(ultimo.fecha):(baseAnio()?diasDesde(baseAnio()):null),
    diasRec:e.ultimoRecordatorio?diasDesde(e.ultimoRecordatorio):null,
    nRec:e.totalRecordatorios||0,
    tel:telDe(e).raw,telWa:telDe(e).wa,telFijo:telDe(e).fijo};
}
// Con deuda (cuotas vencidas o deuda manual) + quienes llevan N días sin pagar
function listaCobranza(){
  const lim=Number(cobF.dias)||30;
  return estudiantes.filter(e=>e.estado!=="retirado").map(filaCobranza)
    .filter(r=>r.enMora||(activo(r.e)&&(r.diasSin!==null?r.diasSin>=lim:true)));
}
function cobFiltradas(todos){
  const q=(cobF.busq||"").toLowerCase();
  const big=1e9;
  const orden={
    monto:(a,b)=>b.deuda-a.deuda,
    dias:(a,b)=>(b.diasSin??big)-(a.diasSin??big),
    norec:(a,b)=>(b.diasRec??big)-(a.diasRec??big),
    nombre:(a,b)=>(a.e.nombre||"").localeCompare(b.e.nombre||"")
  }[cobF.orden]||((a,b)=>b.deuda-a.deuda);
  return todos.filter(r=>{
    if(cobF.vista==="mora"&&!r.enMora) return false;
    if(cobF.vista==="sinpago"&&r.enMora) return false;
    if(cobF.grado&&r.e.grado!==cobF.grado) return false;
    if(q&&!((r.e.nombre||"").toLowerCase().includes(q)||(r.e.cedula||"").includes(q)||(r.e.acudiente||"").toLowerCase().includes(q))) return false;
    return true;
  }).sort(orden);
}
function mensajeCobro(r){
  const e=r.e, tv=tasaDe(todayStr()), conTasa=!!(tv&&tv.exacta);
  const saludo=e.acudiente?`Estimado(a) representante *${e.acudiente}*`:"Estimado(a) representante";
  const eq=usd=>conTasa?` (equivalente a *${fmtBs(r2(usd*tv.valor))}*)`:"";
  let detalle;
  if(r.enMora&&r.deuda>0){const c=conceptoDeE(e);detalle=`presenta un saldo pendiente de *${fmt(r.deuda)}*${eq(r.deuda)}${c?", por concepto de: "+c:""}`;}
  else if(r.enMora) detalle=`presenta pagos pendientes${e.moraConcepto?" ("+e.moraConcepto+")":""}`;
  else{
    detalle=(r.ultimo&&r.diasSin!==null?`no registra pagos desde hace ${r.diasSin} días`:(baseAnio()?"no registra pagos en el año escolar en curso":"no registra pagos en nuestro sistema"));
    if(e.mensualidad>0) detalle+=`. Mensualidad: *${fmt(e.mensualidad)}*${eq(e.mensualidad)}`;
  }
  const pie=conTasa
    ?`💱 Tasa BCV del ${fechaCorta(tv.fecha)}: Bs. ${fmtTasa(tv.valor)} por $. El pago se recibe en bolívares a la tasa oficial BCV del día del pago.`
    :`💱 El pago se recibe en bolívares a la tasa oficial BCV del día del pago.`;
  return `🏫 *${EMPRESA}*\n${saludo}, le saludamos cordialmente.\n\nLe recordamos que el estudiante *${e.nombre}*${e.grado?" ("+e.grado+")":""} ${detalle}.\n\n${pie}\n\nAgradecemos regularizar su situación a la brevedad posible. Si ya realizó el pago, por favor envíenos el comprobante.\n\n¡Gracias por su atención!`;
}
async function marcarRecordado(estId){
  const i=estudiantes.findIndex(x=>x.id===estId); if(i<0) return;
  const upd={ultimoRecordatorio:hoyLocal(),totalRecordatorios:(estudiantes[i].totalRecordatorios||0)+1};
  try{ await db.collection("estudiantes").doc(estId).update(upd); }
  catch(err){ alert("No se pudo guardar el registro del aviso: "+err.message); return; }
  estudiantes[i]={...estudiantes[i],...upd};
  renderTabContent();
}
// ---- Recibo de cobranza (imagen) y envío por WhatsApp
function modeloReciboCobranza(r){
  const e=r.e, tv=tasaDe(todayStr()), conTasa=!!(tv&&tv.exacta);
  const filas=[];
  const cu=calcCuotas(e);
  if(cu) cu.pendientes.forEach(q=>filas.push({desc:"Mensualidad "+q.mes,sub:"Venció el "+fechaCorta(q.vence)+(q.pagado>0?" · abonado "+fmt(q.pagado):""),usd:q.pendiente}));
  if(cu&&cu.recargoPend>0) filas.push({desc:"Recargo por mora",sub:cu.nRecargos+(cu.nRecargos===1?" mensualidad":" mensualidades")+" fuera de fecha · "+fmt(cobCfg.recargo)+" c/u",usd:cu.recargoPend});
  if(deudaManual(e)>0) filas.push({desc:e.moraConcepto||"Deuda anterior",sub:"Saldo anterior",usd:deudaManual(e)});
  if(!filas.length&&r.enMora) filas.push({desc:e.moraConcepto||"Pagos pendientes",sub:"",usd:0});
  if(!filas.length) filas.push({desc:"Mensualidad",sub:r.ultimo?"Último pago: "+fechaCorta(r.ultimo.fecha):"Sin pagos registrados",usd:e.mensualidad||0});
  const totalUsd=r2(filas.reduce((s,f)=>s+f.usd,0));
  filas.forEach(f=>{f.bs=conTasa?r2(f.usd*tv.valor):null;});
  return {empresa:EMPRESA,sub:EMPRESA_SUB,numero:"COB-"+todayStr().replace(/-/g,"").slice(2)+"-"+String(e.cedula||e.id).slice(-4),
    fecha:fechaCorta(todayStr()),estudiante:e.nombre||"",grado:e.grado||"",representante:e.acudiente||"",cedula:e.cedula||"",
    filas,totalUsd,tasa:conTasa?tv:null,totalBs:conTasa?r2(totalUsd*tv.valor):null};
}
function lineasTexto(ctx,txt,maxW){
  const pal=String(txt||"").split(/\s+/).filter(Boolean),out=[];let cur="";
  pal.forEach(p=>{const t=cur?cur+" "+p:p;if(ctx.measureText(t).width>maxW&&cur){out.push(cur);cur=p;}else cur=t;});
  if(cur) out.push(cur);
  return out.length?out:[""];
}
// Dibuja el recibo. Con dibujar=false solo mide y devuelve el alto necesario.
function pintarRecibo(ctx,m,W,dibujar){
  const P=40,AZUL="#003366",ORO="#ffd700";
  const F=f=>{ctx.font=f;};
  const T=(txt,x,y,f,c,al)=>{F(f);if(!dibujar)return;ctx.fillStyle=c;ctx.textAlign=al||"left";ctx.fillText(txt,x,y);};
  const R=(x,y,w,h,c)=>{if(!dibujar)return;ctx.fillStyle=c;ctx.fillRect(x,y,w,h);};
  R(0,0,W,W*12,"#ffffff");
  R(0,0,W,135,AZUL);
  T(m.empresa,W/2,56,"bold 30px Georgia",ORO,"center");
  T(m.sub,W/2,86,"17px Arial","#adc8ff","center");
  T("RECIBO DE COBRANZA",W/2,118,"bold 19px Arial","#ffffff","center");
  let y=169;
  T("N° "+m.numero,P,y,"bold 16px Arial",AZUL);T("Fecha: "+m.fecha,W-P,y,"16px Arial","#555","right");
  y+=14;R(P,y,W-2*P,2,"#e1e8f5");y+=30;
  const dato=(et,val)=>{
    T(et,P,y,"bold 15px Arial","#888");
    F("17px Arial");const L=lineasTexto(ctx,val,W-2*P-170);
    L.forEach((l,i)=>T(l,P+170,y+i*22,"17px Arial","#222"));
    y+=L.length*22+8;
  };
  dato("Estudiante",m.estudiante);
  if(m.grado) dato("Grado",m.grado);
  if(m.representante) dato("Representante",m.representante);
  if(m.cedula) dato("Cédula",m.cedula);
  y+=10;
  const xUsd=m.tasa?W-P-200:W-P-14, xBs=W-P-14;
  R(P,y,W-2*P,40,"#eef3fb");
  T("DETALLE",P+14,y+26,"bold 15px Arial",AZUL);
  T("REFERENCIA ($)",xUsd,y+26,"bold 15px Arial",AZUL,"right");
  if(m.tasa) T("BOLÍVARES (Bs.)",xBs,y+26,"bold 15px Arial",AZUL,"right");
  y+=40;
  m.filas.forEach(f=>{
    const maxW=xUsd-130-(P+14);
    F("bold 18px Arial");const d=lineasTexto(ctx,f.desc,maxW);
    F("14px Arial");const s=f.sub?lineasTexto(ctx,f.sub,maxW):[];
    const h=Math.max(58,16+d.length*24+s.length*20+14);
    d.forEach((l,i)=>T(l,P+14,y+30+i*24,"bold 18px Arial","#222"));
    s.forEach((l,i)=>T(l,P+14,y+30+d.length*24+i*20-2,"14px Arial","#888"));
    T(fmt(f.usd),xUsd,y+32,"bold 18px Arial","#222","right");
    if(m.tasa&&f.bs!=null) T(fmtBs(f.bs),xBs,y+32,"18px Arial","#222","right");
    R(P,y+h-1,W-2*P,1,"#e8ecf4");y+=h;
  });
  y+=22;
  const alto=m.tasa?150:96;
  R(P,y,W-2*P,alto,AZUL);
  T("TOTAL REFERENCIA (USD)",P+20,y+38,"bold 15px Arial",ORO);T(fmt(m.totalUsd),W-P-20,y+40,"bold 26px Georgia",ORO,"right");
  if(m.tasa){
    T("Tasa BCV del "+fechaCorta(m.tasa.fecha),P+20,y+72,"15px Arial","#adc8ff");T("Bs. "+fmtTasa(m.tasa.valor)+" por $1",W-P-20,y+72,"15px Arial","#ffffff","right");
    T("TOTAL EN BOLÍVARES",P+20,y+116,"bold 15px Arial",ORO);T(fmtBs(m.totalBs),W-P-20,y+120,"bold 30px Georgia","#ffffff","right");
  } else T("Pagadero en bolívares a la tasa BCV del día del pago",P+20,y+74,"14px Arial","#adc8ff");
  y+=alto+26;
  F("14px Arial");
  lineasTexto(ctx,"El pago se recibe en bolívares a la tasa oficial BCV del día del pago. Si ya realizó el pago, por favor envíe el comprobante por este medio.",W-2*P).forEach(l=>{T(l,P,y,"14px Arial","#666");y+=20;});
  T("¡Gracias por su atención!",W/2,y+22,"bold 16px Arial",AZUL,"center");
  return y+60;
}
async function reciboCobranzaBlob(r){
  const m=modeloReciboCobranza(r),W=900,S=1.5;
  const medir=document.createElement("canvas").getContext("2d");
  if(!medir) throw new Error("este navegador no puede dibujar el recibo");
  const H=Math.ceil(pintarRecibo(medir,m,W,false));
  const cv=document.createElement("canvas");cv.width=Math.round(W*S);cv.height=Math.round(H*S);
  const ctx=cv.getContext("2d");ctx.scale(S,S);
  pintarRecibo(ctx,m,W,true);
  const blob=await new Promise(res=>cv.toBlob(res,"image/png"));
  if(!blob) throw new Error("no se pudo crear la imagen");
  return blob;
}
function captionCobro(r){
  const tv=tasaDe(todayStr()),con=!!(tv&&tv.exacta);
  const tot=r.enMora?r.deuda:(r.e.mensualidad||0);
  return `🏫 *${EMPRESA}*\nRecibo de cobranza — *${r.e.nombre}*\n${r.enMora?"Saldo pendiente":"Mensualidad"}: *${fmt(tot)}*${con?" (*"+fmtBs(r2(tot*tv.valor))+"* a tasa BCV del "+fechaCorta(tv.fecha)+")":""}\nSi ya realizó el pago, envíenos el comprobante. ¡Gracias!`;
}
function descargarBlob(blob,nombre){
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=nombre;
  document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href),5000);
}
// Un toque: genera el recibo como imagen y lo manda a WhatsApp.
// Celular: abre la hoja de compartir con la imagen lista (se elige el chat). Computadora: copia la imagen y abre el chat (Ctrl+V).
async function enviarReciboCobranza(estId){
  const e=estudiantes.find(x=>x.id===estId); if(!e) return;
  const r=filaCobranza(e);
  let blob;
  try{blob=await reciboCobranzaBlob(r);}
  catch(err){alert("No se pudo generar el recibo ("+err.message+"). Usa «Solo texto».");return;}
  const nombre="recibo-cobranza-"+(e.nombre||"estudiante").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^A-Za-z0-9]+/g,"-").replace(/^-|-$/g,"").toLowerCase()+".png";
  const file=new File([blob],nombre,{type:"image/png"});
  const caption=captionCobro(r);
  if(!tasaHoy()&&!confirm("No has cargado la tasa BCV de hoy: el recibo saldrá solo con el monto en $ (pagadero en Bs. a la tasa del día).\n\n¿Continuar?")) return;
  if(navigator.share&&navigator.canShare&&navigator.canShare({files:[file]})){
    try{await navigator.share({files:[file],text:caption});await marcarRecordado(estId);return;}
    catch(err){if(err&&err.name==="AbortError")return;}   // si falla por otra razón, sigue con el plan B
  }
  let copiado=false;
  try{if(navigator.clipboard&&window.ClipboardItem){await navigator.clipboard.write([new ClipboardItem({"image/png":blob})]);copiado=true;}}catch(_){}
  if(!copiado) descargarBlob(blob,nombre);
  if(!r.telWa){
    alert((copiado?"El recibo quedó copiado.":"El recibo se descargó.")+"\n\n"+(r.tel?"El número «"+r.tel+"» no es válido para WhatsApp.":"Este estudiante no tiene teléfono.")+" Corrígelo con ✏️ o pega el recibo manualmente en el chat.");
    return;
  }
  window.open("https://wa.me/"+r.telWa+"?text="+encodeURIComponent(caption),"_blank");
  alert(copiado?"✅ El recibo quedó copiado. En el chat de WhatsApp pega la imagen (Ctrl+V) y envía.":"El recibo se descargó. En el chat de WhatsApp adjúntalo con el clip 📎 y envía.");
  await marcarRecordado(estId);
}
let correoCfg=null;   // {templateRep}: plantilla de EmailJS para escribirle a los representantes
async function cargarCorreoCfg(){
  correoCfg=null;
  try{
    const s=await db.collection("config").doc("correo").get();
    const t=s.exists?String(s.data().templateRep||"").trim():"";
    if(/^template_[A-Za-z0-9]+$/.test(t)) correoCfg={templateRep:t};
  }catch(e){console.warn("correo cfg:",e.message);}
}
async function guardarCorreoCfg(){
  if(rolUsuario!=="director"){alert("Solo el director puede configurar el correo");return;}
  const t=document.getElementById("cr-template").value.trim();
  if(!/^template_[A-Za-z0-9]+$/.test(t)){alert("El ID de la plantilla debe verse así: template_abc123x (cópialo de EmailJS → Email Templates)");return;}
  try{await db.collection("config").doc("correo").set({templateRep:t});correoCfg={templateRep:t};renderTabContent();mostrarToast("✅ Plantilla de correo guardada");}
  catch(e){alert("No se pudo guardar: "+e.message);}
}
function htmlCfgCorreo(){
  if(rolUsuario!=="director") return "";
  const c=correoCfg;
  return `<details class="card" ${c?"":"open"} style="padding:0.85rem">
    <summary style="cursor:pointer;font-weight:700;color:${c?"#003366":"#c0392b"}">${c?"✉️ Correo a representantes · plantilla configurada":"⚠️ Configura el correo a representantes"}</summary>
    <div style="font-size:0.76rem;color:#555;line-height:1.55;margin:0.5rem 0">En EmailJS crea una plantilla nueva (Email Templates → Create New Template) y llena: <b>To Email</b>: <code>{{to_email}}</code> · <b>Subject</b>: <code>{{subject}}</code> · <b>From Name</b>: <code>{{from_name}}</code> · <b>Reply To</b>: <code>{{reply_to}}</code> · en el contenido (modo código/HTML) escribe <code>{{{message_html}}}</code> con tres llaves. Guárdala y pega aquí su ID.</div>
    <div class="field"><label class="field-label">ID de la plantilla</label><input class="inp" id="cr-template" placeholder="template_abc123x" value="${c?c.templateRep:""}"/></div>
    <button class="btn btn-primary btn-sm" style="margin-top:0.5rem" onclick="guardarCorreoCfg()">💾 Guardar</button>
  </details>`;
}
// Recibo para el cuerpo del correo (tablas con estilos en línea: lo leen bien Gmail, Outlook y el celular)
function htmlReciboCobranza(m){
  const celda="padding:10px 12px;border-bottom:1px solid #e8ecf4";
  const fila=f=>`<tr><td style="${celda}"><div style="font-weight:700;color:#222;font-size:15px">${escHtml(f.desc)}</div>${f.sub?`<div style="color:#888;font-size:12px;margin-top:2px">${escHtml(f.sub)}</div>`:""}</td><td align="right" style="${celda};font-weight:700;color:#222;white-space:nowrap">${escHtml(fmt(f.usd))}</td>${m.tasa?`<td align="right" style="${celda};color:#222;white-space:nowrap">${escHtml(fmtBs(f.bs))}</td>`:""}</tr>`;
  const dato=(et,v)=>v?`<tr><td style="padding:3px 0;color:#888;font-size:13px;width:130px">${et}</td><td style="padding:3px 0;color:#222;font-size:14px">${escHtml(v)}</td></tr>`:"";
  const th="padding:9px 12px;color:#003366;font-weight:700;font-size:12px";
  return `<div style="background:#f4f7ff;padding:16px;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:10px">
<tr><td style="background:#003366;padding:22px 16px;text-align:center"><div style="color:#ffd700;font-size:22px;font-weight:700;font-family:Georgia,serif">${escHtml(m.empresa)}</div><div style="color:#adc8ff;font-size:13px;margin-top:4px">${escHtml(m.sub)}</div><div style="color:#ffffff;font-size:15px;font-weight:700;margin-top:10px">RECIBO DE COBRANZA</div></td></tr>
<tr><td style="padding:18px 20px 6px"><table role="presentation" width="100%"><tr><td style="color:#003366;font-weight:700;font-size:13px">N° ${escHtml(m.numero)}</td><td align="right" style="color:#555;font-size:13px">Fecha: ${escHtml(m.fecha)}</td></tr></table></td></tr>
<tr><td style="padding:0 20px 10px"><table role="presentation" width="100%">${dato("Estudiante",m.estudiante)}${dato("Grado",m.grado)}${dato("Representante",m.representante)}${dato("Cédula",m.cedula)}</table></td></tr>
<tr><td style="padding:0 20px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse"><tr style="background:#eef3fb"><td style="${th}">DETALLE</td><td align="right" style="${th}">REF. ($)</td>${m.tasa?`<td align="right" style="${th}">BOLÍVARES</td>`:""}</tr>${m.filas.map(fila).join("")}</table></td></tr>
<tr><td style="padding:18px 20px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#003366;border-radius:8px"><tr><td style="padding:14px 16px;color:#ffd700;font-weight:700;font-size:13px">TOTAL REFERENCIA (USD)</td><td align="right" style="padding:14px 16px;color:#ffd700;font-weight:700;font-size:20px;font-family:Georgia,serif">${escHtml(fmt(m.totalUsd))}</td></tr>${m.tasa?`<tr><td style="padding:0 16px 6px;color:#adc8ff;font-size:13px">Tasa BCV del ${escHtml(fechaCorta(m.tasa.fecha))}</td><td align="right" style="padding:0 16px 6px;color:#ffffff;font-size:13px">Bs. ${escHtml(fmtTasa(m.tasa.valor))} por $1</td></tr><tr><td style="padding:6px 16px 14px;color:#ffd700;font-weight:700;font-size:13px">TOTAL EN BOLÍVARES</td><td align="right" style="padding:6px 16px 14px;color:#ffffff;font-weight:700;font-size:22px;font-family:Georgia,serif">${escHtml(fmtBs(m.totalBs))}</td></tr>`:`<tr><td colspan="2" style="padding:0 16px 14px;color:#adc8ff;font-size:13px">Pagadero en bolívares a la tasa BCV del día del pago</td></tr>`}</table></td></tr>
<tr><td style="padding:0 20px 20px;color:#666;font-size:12px;line-height:1.5">El pago se recibe en bolívares a la tasa oficial BCV del día del pago. Si ya realizó el pago, por favor responda a este correo con el comprobante.<div style="text-align:center;color:#003366;font-weight:700;font-size:14px;margin-top:12px">¡Gracias por su atención!</div></td></tr>
</table></div>`;
}
function textoReciboCobranza(m){
  const l=[m.empresa+" — "+m.sub,"RECIBO DE COBRANZA N° "+m.numero+"  ·  "+m.fecha,"","Estudiante: "+m.estudiante];
  if(m.grado) l.push("Grado: "+m.grado);
  if(m.representante) l.push("Representante: "+m.representante);
  l.push("");
  m.filas.forEach(f=>l.push("• "+f.desc+(f.sub?" ("+f.sub+")":"")+": "+fmt(f.usd)+(f.bs!=null?" — "+fmtBs(f.bs):"")));
  l.push("","TOTAL REFERENCIA (USD): "+fmt(m.totalUsd));
  if(m.tasa) l.push("Tasa BCV del "+fechaCorta(m.tasa.fecha)+": Bs. "+fmtTasa(m.tasa.valor)+" por $1","TOTAL EN BOLÍVARES: "+fmtBs(m.totalBs));
  else l.push("Pagadero en bolívares a la tasa BCV del día del pago.");
  l.push("","Si ya realizó el pago, por favor responda con el comprobante. ¡Gracias!");
  return l.join("\n");
}
// Envío sin pantallas (lo reutiliza el envío en lote): devuelve {ok,to} o {ok:false,error}
async function enviarCorreoCobranzaCore(r){
  const e=r.e,to=String(e.correoAcudiente||"").trim().toLowerCase();
  if(!correoValido(to)) return {ok:false,error:"El estudiante no tiene un correo válido"};
  if(!correoCfg) return {ok:false,error:"Falta configurar la plantilla de correo"};
  const m=modeloReciboCobranza(r);
  try{
    emailjs.init(EJS_KEY);
    await emailjs.send(EJS_SERVICE,correoCfg.templateRep,{to_email:to,to_name:e.acudiente||"Representante",from_name:EMPRESA,reply_to:CORREO_COLEGIO,
      subject:"Recibo de cobranza — "+e.nombre+" — "+EMPRESA,message_html:htmlReciboCobranza(m),message:textoReciboCobranza(m)});
    return {ok:true,to};
  }catch(err){return {ok:false,error:(err&&(err.text||err.message))||String(err)};}
}
async function corregirCorreo(estId){
  const e=estudiantes.find(x=>x.id===estId); if(!e) return false;
  const v=prompt("Correo del representante de "+e.nombre+".\nEjemplo: nombre@gmail.com",e.correoAcudiente||"");
  if(v===null) return false;
  const c=v.trim().toLowerCase();
  if(!correoValido(c)){alert("Correo inválido. Debe verse así: nombre@gmail.com");return false;}
  try{await db.collection("estudiantes").doc(estId).update({correoAcudiente:c});}
  catch(err){alert("No se pudo guardar: "+err.message);return false;}
  const i=estudiantes.findIndex(x=>x.id===estId);
  estudiantes[i]={...estudiantes[i],correoAcudiente:c};
  renderTabContent();
  return true;
}
async function enviarCorreoCobranza(estId){
  let e=estudiantes.find(x=>x.id===estId); if(!e) return;
  if(!correoValido(e.correoAcudiente)){
    if(!await corregirCorreo(estId)) return;
    e=estudiantes.find(x=>x.id===estId);
  }
  const r=filaCobranza(e),to=e.correoAcudiente.trim().toLowerCase();
  if(!tasaHoy()&&!confirm("No has cargado la tasa BCV de hoy: el recibo saldrá solo con el monto en $ (pagadero en Bs. a la tasa del día).\n\n¿Continuar?")) return;
  if(!correoCfg){
    if(!confirm("Aún no está configurada la plantilla de correo (el director lo hace en Cobranza → ✉️ Correo).\n\nMientras tanto puedo abrir tu programa de correo con el mensaje listo para "+to+". ¿Abrirlo?")) return;
    window.open("mailto:"+to+"?subject="+encodeURIComponent("Recibo de cobranza — "+e.nombre+" — "+EMPRESA)+"&body="+encodeURIComponent(textoReciboCobranza(modeloReciboCobranza(r))),"_self");
    await marcarRecordado(estId);
    return;
  }
  if(!confirm("Se enviará el recibo de cobranza de "+e.nombre+" a:\n"+to+"\n\n¿Continuar?")) return;
  const res=await enviarCorreoCobranzaCore(r);
  if(res.ok){await marcarRecordado(estId);mostrarToast("✅ Recibo enviado a "+res.to);}
  else alert("No se pudo enviar el correo: "+res.error);
}
// Versión solo texto (por si la imagen no se puede usar)
function cobrarWhatsApp(estId){
  const e=estudiantes.find(x=>x.id===estId); if(!e) return;
  const r=filaCobranza(e);
  if(!r.telWa){alert(r.tel?"El número «"+r.tel+"» no es válido para WhatsApp. Corrígelo con ✏️.":"Este estudiante no tiene teléfono registrado");return;}
  if(!tasaHoy()&&!confirm("No has cargado la tasa BCV de hoy. El mensaje saldrá solo con el monto en $ (pagadero en Bs. a la tasa BCV del día).\n\n¿Continuar?")) return;
  window.open("https://wa.me/"+r.telWa+"?text="+encodeURIComponent(mensajeCobro(r)),"_blank");
  marcarRecordado(estId);
}
async function corregirTelefono(estId){
  const e=estudiantes.find(x=>x.id===estId); if(!e) return;
  const v=prompt("Teléfono (WhatsApp) del representante de "+e.nombre+".\nEjemplo: 0412-1234567",e.telefonoAcudiente||e.telefono||"");
  if(v===null) return;
  const wa=normalizarTelVE(v);
  if(!wa){alert("Número inválido. Debe llevar el código de operadora y 7 dígitos, por ejemplo 0412-1234567");return;}
  if(wa[2]==="2"&&!confirm("Ese parece un teléfono FIJO: WhatsApp normalmente no lo encuentra.\n\n¿Guardarlo de todos modos?")) return;
  const nuevo="0"+wa.slice(2,5)+"-"+wa.slice(5);
  try{await db.collection("estudiantes").doc(estId).update({telefonoAcudiente:nuevo});}
  catch(err){alert("No se pudo guardar: "+err.message);return;}
  const i=estudiantes.findIndex(x=>x.id===estId);
  estudiantes[i]={...estudiantes[i],telefonoAcudiente:nuevo};
  renderTabContent();
}
function onCobBusq(v){
  cobF.busq=v; clearTimeout(_cobTimer);
  _cobTimer=setTimeout(()=>{renderTabContent();const i=document.getElementById("cob-search");if(i){i.focus();i.setSelectionRange(v.length,v.length);}},200);
}
function cobSet(k,v){cobF[k]=v;renderTabContent();}
function renderCobranza(){
  const lim=Number(cobF.dias)||30;
  const todos=listaCobranza();
  const nMora=todos.filter(r=>r.enMora).length;
  const nSin=todos.length-nMora;
  const totalDeuda=todos.reduce((s,r)=>s+r.deuda,0);
  const sinAvisar=todos.filter(r=>r.enMora&&(r.diasRec===null||r.diasRec>=7)).length;
  const grados=[...new Set(todos.map(r=>r.e.grado).filter(Boolean))].sort();
  const filas=cobFiltradas(todos);
  const totalVista=filas.reduce((s,r)=>s+r.deuda,0);
  const hoyT=tasaHoy();
  const tv=tasaDe(todayStr());
  return `
  ${htmlCfgCuotas()}
  ${htmlCfgCorreo()}
  <div class="card" style="padding:0.7rem 0.85rem;border-left:4px solid ${hoyT?"#1a9e5c":"#e53e3e"};display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap">
    <div style="flex:1;min-width:160px;font-size:0.8rem">${hoyT?`✅ Tasa BCV de hoy: <strong>Bs. ${fmtTasa(tv.valor)}</strong>`:`⚠️ Falta la tasa BCV de hoy: los avisos saldrán solo en $`}</div>
    <button class="btn btn-gray btn-sm" onclick="abrirModal({tipo:'tasa'})">💱 ${hoyT?"Cambiar":"Cargar"} tasa</button>
  </div>
  <div class="stats-grid">
    <div class="stat-card red"><div class="stat-val">${nMora}</div><div class="stat-label">⚠️ Con deuda</div></div>
    <div class="stat-card gold"><div class="stat-val">${fmt(totalDeuda)}</div><div class="stat-label">Total adeudado${hoyT?" · "+fmtBs(aBs(totalDeuda)):""}</div></div>
    <div class="stat-card blue"><div class="stat-val">${nSin}</div><div class="stat-label">⏳ Sin pago +${lim} días</div></div>
    <div class="stat-card"><div class="stat-val">${sinAvisar}</div><div class="stat-label">📵 Sin avisar (7+ días)</div></div>
  </div>
  <div class="stabs">
    ${[["mora","⚠️ Con deuda ("+nMora+")"],["sinpago","⏳ Sin pago reciente ("+nSin+")"],["todos","Todos ("+todos.length+")"]].map(([k,l])=>`<button class="stab ${cobF.vista===k?"active":""}" onclick="cobSet('vista','${k}')">${l}</button>`).join("")}
  </div>
  <div class="card" style="padding:0.85rem">
    <div style="display:flex;gap:0.4rem;flex-wrap:wrap">
      <input class="inp" id="cob-search" style="flex:2;min-width:150px;padding:0.55rem 0.75rem;font-size:0.82rem" placeholder="🔍 Estudiante, cédula o representante..." value="${cobF.busq}" oninput="onCobBusq(this.value)"/>
      <select class="inp" style="flex:1;min-width:110px;padding:0.55rem 0.75rem;font-size:0.82rem" onchange="cobSet('grado',this.value)">
        <option value="">Todos los grados</option>
        ${grados.map(g=>`<option value="${escHtml(g)}" ${cobF.grado===g?"selected":""}>${escHtml(g)}</option>`).join("")}
      </select>
      <select class="inp" style="flex:1;min-width:110px;padding:0.55rem 0.75rem;font-size:0.82rem" onchange="cobSet('orden',this.value)">
        ${[["monto","Mayor deuda"],["dias","Más días sin pagar"],["norec","Sin avisar primero"],["nombre","Nombre A-Z"]].map(([k,l])=>`<option value="${k}" ${cobF.orden===k?"selected":""}>${l}</option>`).join("")}
      </select>
      <select class="inp" style="flex:1;min-width:110px;padding:0.55rem 0.75rem;font-size:0.82rem" onchange="cobSet('dias',this.value)" title="Días sin pagar para considerar atraso">
        ${[15,30,45,60].map(d=>`<option value="${d}" ${lim===d?"selected":""}>Sin pago +${d} días</option>`).join("")}
      </select>
    </div>
    <div style="display:flex;gap:0.4rem;margin-top:0.5rem;flex-wrap:wrap">
      <button class="btn btn-print btn-sm" onclick="imprimirCobranza()">🖨️ Imprimir listado</button>
      <button class="btn btn-danger btn-sm" onclick="enviarRecordatorios()">📧 Enviar resumen por correo</button>
    </div>
  </div>
  ${filas.length?`<div class="recaudo-box"><div><div style="font-size:0.65rem;color:#adc8ff">${filas.length} estudiante${filas.length!==1?"s":""} en esta lista</div><div style="font-size:1.2rem;font-weight:800;font-family:Georgia,serif;color:#ffd700">${fmt(totalVista)}</div>${hoyT?`<div style="font-size:0.75rem;color:#adc8ff">${fmtBs(aBs(totalVista))}</div>`:""}</div><div style="font-size:0.7rem;color:#adc8ff;text-align:right">adeudado en la vista</div></div>`:""}
  ${filas.length===0?`<div class="empty"><div class="empty-icon">✅</div><p>No hay estudiantes en esta lista</p></div>`:
  `<div class="list">${filas.map(r=>{
    const e=r.e;
    const ult=r.ultimo?`Último pago: ${escHtml(r.ultimo.fecha)}${r.diasSin!==null?" (hace "+r.diasSin+" días)":""}`:(baseAnio()?"Sin pagos este año escolar (desde "+fechaCorta(baseAnio())+")":"Nunca ha pagado");
    const bRec=r.diasRec===null?`<span class="badge badge-red">Sin avisar</span>`
      :`<span class="badge ${r.diasRec<7?"badge-green":"badge-gold"}">Avisado ${r.diasRec===0?"hoy":"hace "+r.diasRec+" d"} · ${r.nRec}×</span>`;
    return `<div class="list-item ${r.enMora?"mora":""}" style="cursor:default">
      <div class="item-row">
        <div style="flex:1;min-width:0">
          <div class="item-name">${escHtml(e.nombre)}</div>
          <div class="item-sub">${escHtml(e.grado)||"Sin grado"}${e.acudiente?" · 👤 "+escHtml(e.acudiente):""}</div>
          <div class="item-sub">📞 ${r.telWa?fmtTelVE(r.telWa)+(r.telFijo?` <span style="color:#b8860b">⚠️ fijo (WhatsApp suele no encontrarlo)</span>`:""):r.tel?`<span style="color:#c0392b">⚠️ Número inválido: ${escHtml(r.tel)}</span>`:"Sin teléfono"} <a href="#" onclick="corregirTelefono('${e.id}');return false" style="text-decoration:none" title="Corregir teléfono">✏️</a></div>
          <div class="item-sub">✉️ ${e.correoAcudiente?escHtml(e.correoAcudiente):"Sin correo"} <a href="#" onclick="corregirCorreo('${e.id}');return false" style="text-decoration:none" title="Corregir correo">✏️</a></div>
          ${r.meses.length?`<div class="item-sub" style="color:#c0392b">📅 Mensualidad: ${r.meses.join(", ")}</div>`:""}
          ${r.manual>0||(e.estado==="mora"&&e.moraConcepto)?`<div class="item-sub" style="color:#c0392b">📋 ${escHtml(e.moraConcepto)||"Deuda anterior"}${r.manual>0?" · "+fmt(r.manual):""}</div>`:""}
          <div class="item-sub">${ult}</div>
          <div style="margin-top:4px">${bRec}</div>
        </div>
        <div class="item-right">
          ${r.enMora?`<div class="item-amount" style="color:#e53e3e">${fmt(r.deuda)}</div>${hoyT?`<div style="font-size:0.7rem;color:#888">${fmtBs(aBs(r.deuda))}</div>`:""}`:`<span class="badge badge-gold">Sin pago reciente</span>`}
          <div style="font-size:0.68rem;color:#888;margin-top:3px">${fmt(e.mensualidad||0)}/mes</div>
        </div>
      </div>
      <div style="display:flex;gap:0.4rem;margin-top:0.6rem;flex-wrap:wrap">
        <button class="btn btn-whatsapp btn-sm" onclick="enviarReciboCobranza('${e.id}')">📲 Enviar recibo</button>
        <button class="btn btn-gray btn-sm" onclick="cobrarWhatsApp('${e.id}')">💬 Solo texto</button>
        <button class="btn btn-gray btn-sm" onclick="enviarCorreoCobranza('${e.id}')">📧 Correo</button>
        <button class="btn btn-gray btn-sm" onclick="marcarRecordado('${e.id}')">✅ Ya avisé</button>
        <button class="btn btn-gray btn-sm" onclick="abrirModal({tipo:'ver-estudiante',id:'${e.id}'})">👁 Ficha</button>
      </div>
    </div>`;}).join("")}</div>`}`;
}
// Tarjeta resumen del Inicio
function renderRecordatoriosPagos(){
  const filas=listaCobranza().filter(r=>r.enMora).sort((a,b)=>b.deuda-a.deuda);
  if(filas.length===0) return `
  <div class="card">
    <div class="card-title"><div class="card-bar"></div><h2>⏰ Cobranza</h2></div>
    <div class="alert-item alert-ok">✅ No hay estudiantes con deuda registrada</div>
  </div>`;
  const total=filas.reduce((s,r)=>s+r.deuda,0);
  return `
  <div class="card">
    <div class="card-title"><div class="card-bar"></div><h2>⏰ Por cobrar (${filas.length})</h2>
      <button class="btn btn-primary btn-sm" style="margin-left:auto;font-size:0.7rem" onclick="setTab('cobranza')">Ver cobranza →</button>
    </div>
    <div class="alert-item alert-info" style="justify-content:space-between"><span>Total adeudado</span><strong>${dual(total)}</strong></div>
    ${filas.slice(0,5).map(r=>`<div class="alert-item alert-mora" style="justify-content:space-between">
      <div><strong>${escHtml(r.e.nombre)}</strong> — ${escHtml(r.e.grado)||"Sin grado"}
      <div style="font-size:0.7rem;margin-top:1px">${r.meses.length?r.meses.length+" cuota"+(r.meses.length>1?"s":"")+" · ":""}${r.diasRec===null?"Sin avisar":"Avisado hace "+r.diasRec+" días"}</div></div>
      <span style="font-weight:800;font-size:0.82rem">${fmt(r.deuda)}</span></div>`).join("")}
    ${filas.length>5?`<div style="font-size:0.75rem;color:#888;text-align:center;margin-top:0.3rem">+${filas.length-5} más</div>`:""}
  </div>`;
}
function imprimirCobranza(){
  const filas=cobFiltradas(listaCobranza());
  if(!filas.length){alert("No hay registros para imprimir");return;}
  const total=filas.reduce((s,r)=>s+r.deuda,0);
  const t=tasaHoy(), tv=tasaDe(todayStr());
  const w=window.open("","_blank");
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>Listado de cobranza</title>
  <style>body{font-family:'Segoe UI',sans-serif;padding:1.2rem;color:#222}h2{color:#003366;font-family:Georgia,serif}
  table{width:100%;border-collapse:collapse;font-size:0.78rem;margin-top:0.8rem}th{background:#003366;color:#fff;text-align:left;padding:0.4rem}
  td{padding:0.4rem;border-bottom:1px solid #ddd}.r{text-align:right}tfoot td{font-weight:800;border-top:2px solid #003366}</style></head><body>
  <h2>${EMPRESA}</h2><div>Listado de cobranza · ${new Date().toLocaleDateString("es-CO")} · ${filas.length} estudiante(s)${t?" · Tasa BCV "+fechaCorta(tv.fecha)+": Bs. "+fmtTasa(tv.valor)+" por $":""}</div>
  <table><thead><tr><th>#</th><th>Estudiante</th><th>Grado</th><th>Representante</th><th>Teléfono</th><th>Concepto</th><th>Último pago</th><th class="r">Adeuda ($)</th>${t?'<th class="r">Adeuda (Bs.)</th>':""}</tr></thead><tbody>
  ${filas.map((r,i)=>`<tr><td>${i+1}</td><td>${escHtml(r.e.nombre)}</td><td>${escHtml(r.e.grado)||""}</td><td>${escHtml(r.e.acudiente)||""}</td><td>${escHtml(r.tel)}</td><td>${escHtml(conceptoDeE(r.e))||(r.enMora?"":"Sin pago reciente")}</td><td>${r.ultimo?escHtml(r.ultimo.fecha):(baseAnio()?"Sin pagos este año":"Nunca")}</td><td class="r">${r.enMora?fmt(r.deuda):"—"}</td>${t?`<td class="r">${r.enMora?fmtBs(aBs(r.deuda)):"—"}</td>`:""}</tr>`).join("")}
  </tbody><tfoot><tr><td colspan="7">TOTAL ADEUDADO</td><td class="r">${fmt(total)}</td>${t?`<td class="r">${fmtBs(aBs(total))}</td>`:""}</tr></tfoot></table></body></html>`);
  w.document.close();
  setTimeout(()=>w.print(),500);
}
// Resumen por correo al buzón de la institución (EmailJS)
function enviarRecordatorios(){
  const filas=cobFiltradas(listaCobranza());
  if(filas.length===0){alert("No hay estudiantes en la lista actual");return;}
  const lista=filas.map((r,i)=>`${i+1}. ${r.e.nombre} (${r.e.grado||"N/A"}) - `
    +(r.enMora?"Debe "+dual(r.deuda)+(conceptoDeE(r.e)?" ("+conceptoDeE(r.e)+")":""):(r.ultimo?"Sin pago hace "+r.diasSin+" días":(baseAnio()?"Sin pagos este año escolar":"Nunca ha pagado")))).join("\n");
  const total=filas.reduce((s,r)=>s+r.deuda,0), tv=tasaDe(todayStr());
  enviarNotificacion("⏰ Cobranza: "+filas.length+" estudiantes pendientes",
    "🏫 "+EMPRESA+"\n⏰ RESUMEN DE COBRANZA\n\n"+lista+"\n\n💰 Total adeudado: "+dual(total)
    +(tasaHoy()?"\n💱 Tasa BCV "+fechaCorta(tv.fecha)+": Bs. "+fmtTasa(tv.valor):"")
    +"\n📅 Fecha del reporte: "+new Date().toLocaleDateString("es-CO"));
  alert("✅ Resumen enviado a notijosefajoaquina@gmail.com");
}
