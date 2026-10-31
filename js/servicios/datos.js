// Carga de datos desde Firestore y protección de solo lectura para años escolares anteriores.

// Carga de Firestore todo lo que necesita el rol actual y dibuja la pantalla.
// Los docentes solo cargan las fichas de los estudiantes (sin datos privados, ver servicios/fichas-docentes.js)
// y las notas; la administradora, estudiantes y pagos (lo que necesita para cobrar); el director además finanzas,
// nómina y notas del año escolar que está viendo. En el año actual, pagos, estudiantes y finanzas
// quedan en tiempo real (ver servicios/tiempo-real.js).
async function cargarTodo() {
  document.getElementById("app").innerHTML = pantallaCarga("Cargando los datos del colegio…");
  detenerTiempoReal();
  try {
    let sp, se, st, sf, sn;
    if (rolUsuario === "docente") {
      [se, sn] = await Promise.all([leerFichasDocente(), db.collection("notas").get()]);
      pagos = [];
      trabajadores = [];
      finanzas = [];
    } else {
      await Promise.all([cargarAnioEsc(), cargarTasas(), cargarCobCfg()]);
      const av = anioVistaObj();
      const director = rolUsuario === "director";
      const notasQ = soloLectura()
        ? db.collection("notas_historial").where("anioArchivo", "==", anioVista).get()
        : db.collection("notas").get();
      const vivo = !soloLectura(); // los años anteriores no cambian: se leen una sola vez
      const leer = (q, aplicar) => (vivo ? escucharEnVivo(q, aplicar) : q.get());
      // La administradora solo cobra: no lee finanzas, nómina ni notas (las reglas de Firestore tampoco la dejan)
      const vacio = Promise.resolve({ docs: [] });
      [sp, se, st, sf, sn] = await Promise.all([
        leer(qRango("pagos", av), aplicarPagos),
        leer(db.collection("estudiantes").orderBy("nombre"), aplicarEstudiantes),
        director ? db.collection("trabajadores").orderBy("nombre").get() : vacio,
        director ? leer(qRango("finanzas", av), aplicarFinanzas) : vacio,
        director ? notasQ : vacio,
      ]);
      pagos = sp.docs.map((d) => ({ id: d.id, ...d.data() })).sort(porTimestampDesc);
      if (director)
        cargarCuentasPagar(); // no detiene la carga: los avisos aparecen al llegar
      else cuentasPagar = [];
      trabajadores = st.docs.map((d) => ({ id: d.id, ...d.data() }));
      finanzas = sf.docs.map((d) => ({ id: d.id, ...d.data() }));
    }
    estudiantes = se.docs.map((d) => ({ id: d.id, ...d.data() }));
    notas = {};
    sn.docs.forEach((d) => {
      const x = d.data();
      const k = soloLectura() && x.clave ? x.clave : d.id;
      notas[k] = { ...x };
    });
    await cargarConfig();
    render();
    animarEntradaPestana();
    try {
      sessionStorage.removeItem("recargaVersion"); // abrió bien: una próxima actualización a medias se puede arreglar
    } catch (e) {}
    sincronizarFichasDocentes(); // director y administradora: pone al día las fichas de los docentes
    numerarRecibosPendientes(); // recibos cobrados sin conexión que aún no tienen su número
  } catch (e) {
    if (recargarSiVersionMezclada(e)) return;
    document.getElementById("app").innerHTML =
      `<div class="loading">❌ Error: ${escHtml(e.message)}<br><br><button onclick="cargarTodo()" class="btn btn-primary">🔄 Reintentar</button></div>`;
  }
}
// Si en este equipo la página quedó de una versión y los scripts de otra (una actualización a medias, por la copia
// que guarda el navegador), falta alguna función («… is not defined»): se vuelve a abrir la página pidiéndola de
// nuevo al servidor. Una sola vez por sesión, para no quedar recargando si el error es otro.
function recargarSiVersionMezclada(e) {
  if (!(e instanceof ReferenceError)) return false;
  try {
    if (sessionStorage.getItem("recargaVersion")) return false;
    sessionStorage.setItem("recargaVersion", "1");
  } catch (x) {
    return false;
  }
  location.replace(location.pathname + "?v=" + Date.now());
  return true;
}
// Para ordenar del más reciente al más antiguo según la marca de tiempo de Firestore
// (con la fracción de segundo: dos pagos guardados en el mismo segundo quedan en el orden en que se hicieron)
const porTimestampDesc = (a, b) => {
  const t = (x) => x.timestamp || {};
  return (t(b).seconds || 0) - (t(a).seconds || 0) || (t(b).nanoseconds || 0) - (t(a).nanoseconds || 0);
};
// Consulta pagos/finanzas del año que se está viendo (filtra por fecha; sin config = todo, como antes)
function qRango(col, a) {
  const base = db.collection(col);
  if (!a) return col === "pagos" ? base.orderBy("timestamp", "desc") : base.orderBy("fecha", "desc");
  let q = base;
  const desde = a.inicio || "",
    hasta = a === escCfg.actual ? "" : a.fin || "";
  if (desde) q = q.where("fecha", ">=", desde);
  if (hasta) q = q.where("fecha", "<=", hasta);
  return q.orderBy("fecha", "desc");
}
// Protección: en un año anterior no se puede registrar ni editar nada (solo consulta)
(function () {
  try {
    const msg = "Estás viendo un año escolar anterior (solo consulta). Vuelve al año actual para registrar o editar.";
    const envolver = (proto, name) => {
      const o = proto[name];
      if (typeof o !== "function") return;
      proto[name] = function (...a) {
        if (soloLectura()) return Promise.reject(new Error(msg));
        return o.apply(this, a);
      };
    };
    envolver(firebase.firestore.DocumentReference.prototype, "set");
    envolver(firebase.firestore.DocumentReference.prototype, "update");
    envolver(firebase.firestore.DocumentReference.prototype, "delete");
    envolver(firebase.firestore.CollectionReference.prototype, "add");
    envolver(firebase.firestore.WriteBatch.prototype, "commit");
  } catch (e) {
    console.warn("No se pudo activar la protección de solo lectura:", e.message);
  }
})();

// Cuentas por pagar: todas (son pocas); si las reglas de Firestore aún no la permiten, la lista queda vacía
async function cargarCuentasPagar() {
  try {
    const s = await db.collection("cuentas_pagar").get();
    cuentasPagar = s.docs.map((d) => ({ id: d.id, ...d.data() }));
    if (tabActual === "dashboard" || tabActual === "finanzas") renderTabContent();
  } catch (e) {
    cuentasPagar = [];
    console.warn("Cuentas por pagar:", e.message);
  }
}
