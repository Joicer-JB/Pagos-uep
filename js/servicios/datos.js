// Carga de datos desde Firestore y protección de solo lectura para años escolares anteriores.

async function cargarTodo(){
  document.getElementById("app").innerHTML='<div class="loading">⏳ Cargando datos del sistema...</div>';
  try{
    let sp,se,st,sf,sn;
    if(rolUsuario==="docente"){
      [se,sn]=await Promise.all([
        db.collection("estudiantes").orderBy("nombre").get(),
        db.collection("notas").get()
      ]);
      pagos=[];trabajadores=[];finanzas=[];
    } else {
      await Promise.all([cargarAnioEsc(),cargarTasas(),cargarCobCfg(),cargarCorreoCfg()]);
      const av=anioVistaObj();
      const notasQ=soloLectura()?db.collection("notas_historial").where("anioArchivo","==",anioVista).get():db.collection("notas").get();
      [sp,se,st,sf,sn]=await Promise.all([
        qRango("pagos",av).get(),
        db.collection("estudiantes").orderBy("nombre").get(),
        db.collection("trabajadores").orderBy("nombre").get(),
        qRango("finanzas",av).get(),
        notasQ
      ]);
      pagos=sp.docs.map(d=>({id:d.id,...d.data()})).sort(porTimestampDesc);
      trabajadores=st.docs.map(d=>({id:d.id,...d.data()}));
      finanzas=sf.docs.map(d=>({id:d.id,...d.data()}));
    }
    estudiantes=se.docs.map(d=>({id:d.id,...d.data()}));
    notas={};
    sn.docs.forEach(d=>{const x=d.data();const k=(soloLectura()&&x.clave)?x.clave:d.id;notas[k]={...x};});
    if(rolUsuario==="director") await cargarConfig();
    render();
  }catch(e){
    document.getElementById("app").innerHTML=`<div class="loading">❌ Error: ${e.message}<br><br><button onclick="cargarTodo()" class="btn btn-primary">🔄 Reintentar</button></div>`;
  }
}
const porTimestampDesc=(a,b)=>((b.timestamp&&b.timestamp.seconds)||0)-((a.timestamp&&a.timestamp.seconds)||0);
// Consulta pagos/finanzas del año que se está viendo (filtra por fecha; sin config = todo, como antes)
function qRango(col,a){
  const base=db.collection(col);
  if(!a) return col==="pagos"?base.orderBy("timestamp","desc"):base.orderBy("fecha","desc");
  let q=base;
  const desde=a.inicio||"", hasta=(a===escCfg.actual)?"":(a.fin||"");
  if(desde) q=q.where("fecha",">=",desde);
  if(hasta) q=q.where("fecha","<=",hasta);
  return q.orderBy("fecha","desc");
}
// Protección: en un año anterior no se puede registrar ni editar nada (solo consulta)
(function(){
  try{
    const msg="Estás viendo un año escolar anterior (solo consulta). Vuelve al año actual para registrar o editar.";
    const envolver=(proto,name)=>{const o=proto[name];if(typeof o!=="function")return;proto[name]=function(...a){if(soloLectura())return Promise.reject(new Error(msg));return o.apply(this,a);};};
    envolver(firebase.firestore.DocumentReference.prototype,"set");
    envolver(firebase.firestore.DocumentReference.prototype,"update");
    envolver(firebase.firestore.DocumentReference.prototype,"delete");
    envolver(firebase.firestore.CollectionReference.prototype,"add");
    envolver(firebase.firestore.WriteBatch.prototype,"commit");
  }catch(e){console.warn("No se pudo activar la protección de solo lectura:",e.message);}
})();
