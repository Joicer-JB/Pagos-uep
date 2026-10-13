// Tiempo real: pagos, estudiantes y finanzas del año actual se mantienen al día mientras la app está abierta.
// Si alguien cobra en otro equipo, esta pantalla lo ve (y la deuda que muestra Cobranza o la Caja está al día).
//
// Cómo funciona: en vez de leer una sola vez, cargarTodo() se queda «escuchando» esas colecciones en Firestore.
// La primera respuesta es la carga normal (no cuesta lecturas extra); después Firestore solo envía lo que cambió.
// Si el cambio vino de otro equipo, la pantalla se redibuja sola cuando es seguro (no hay una ventana abierta ni
// alguien escribiendo); si no, aparece un aviso para actualizar con un toque.

let escuchas = []; // funciones para dejar de escuchar
let _refrescoPendiente = null;

function detenerTiempoReal() {
  escuchas.forEach((dejar) => dejar());
  escuchas = [];
  clearTimeout(_refrescoPendiente);
  quitarAvisoCambios();
}

// Igual que query.get(), pero se queda escuchando. `aplicar(snapshot)` actualiza la variable en memoria.
// Devuelve una promesa con la primera respuesta.
function escucharEnVivo(query, aplicar) {
  return new Promise((resolver, rechazar) => {
    let primera = true;
    const dejar = query.onSnapshot(
      (snap) => {
        if (primera) {
          primera = false;
          return resolver(snap);
        }
        if (aplicar(snap)) programarRefresco();
      },
      (err) => {
        if (primera) {
          primera = false;
          rechazar(err);
        } else console.warn("Tiempo real interrumpido:", err.message);
      }
    );
    escuchas.push(dejar);
  });
}

// Documentos de un snapshot como objetos {id, ...datos}. Las marcas de tiempo que aún no confirma el servidor
// se estiman (si no, un pago recién guardado quedaría sin fecha y al final de la lista).
const docsDe = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data({ serverTimestamps: "estimate" }) }));

// ¿El snapshot trae cambios hechos en OTRO equipo? Lo que guarda este mismo equipo llega marcado como pendiente
// (hasPendingWrites) o, al confirmarlo el servidor, igual a lo que ya hay en memoria salvo las marcas de tiempo.
function hayNovedades(snap, actuales) {
  const porId = new Map(actuales.map((x) => [x.id, x]));
  // Texto comparable de un documento: sin marcas de tiempo y con las claves en orden (a cualquier profundidad)
  const ordenado = (_, x) =>
    x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort()) : x;
  const esMarcaDeTiempo = (x) =>
    x && typeof x === "object" && (typeof x.toDate === "function" || ("seconds" in x && "nanoseconds" in x));
  const sinTiempo = (o) => {
    const { id, ...resto } = o || {};
    Object.keys(resto).forEach((k) => esMarcaDeTiempo(resto[k]) && delete resto[k]);
    return JSON.stringify(resto, ordenado);
  };
  return snap.docChanges().some((c) => {
    if (c.doc.metadata && c.doc.metadata.hasPendingWrites) return false; // lo acaba de guardar este equipo
    const antes = porId.get(c.doc.id);
    if (c.type === "removed") return !!antes;
    if (!antes) return true;
    return sinTiempo(antes) !== sinTiempo({ id: c.doc.id, ...c.doc.data({ serverTimestamps: "estimate" }) });
  });
}

// Funciones que cada escucha usa para actualizar la memoria. Devuelven true si hubo novedades de otro equipo.
const aplicarPagos = (snap) => {
  const nuevo = hayNovedades(snap, pagos);
  pagos = docsDe(snap).sort(porTimestampDesc);
  return nuevo;
};
const aplicarEstudiantes = (snap) => {
  const nuevo = hayNovedades(snap, estudiantes);
  estudiantes = docsDe(snap);
  programarFichasDocentes(); // las fichas de los docentes siguen a los estudiantes
  return nuevo;
};
const aplicarFinanzas = (snap) => {
  const nuevo = hayNovedades(snap, finanzas);
  finanzas = docsDe(snap);
  return nuevo;
};

// Redibuja cuando no interrumpe a nadie; si no, deja un aviso para hacerlo a mano
function programarRefresco() {
  clearTimeout(_refrescoPendiente);
  _refrescoPendiente = setTimeout(() => {
    if (!auth) return;
    if (esSeguroRedibujar()) {
      quitarAvisoCambios();
      render();
    } else mostrarAvisoCambios();
  }, 300);
}
function esSeguroRedibujar() {
  const activo = document.activeElement;
  const escribiendo = activo && /^(INPUT|TEXTAREA|SELECT)$/.test(activo.tagName);
  const enCaja = tabActual === "caja" && (caja.guardando || caja.estId);
  return !modalActual && !escribiendo && !enCaja;
}
function mostrarAvisoCambios() {
  if (document.getElementById("aviso-cambios")) return;
  const a = document.createElement("div");
  a.id = "aviso-cambios";
  a.className = "aviso-cambios";
  a.innerHTML = `🔄 Hay cambios nuevos de otro equipo <button class="btn btn-primary btn-sm" onclick="actualizarPantalla()">Actualizar</button>`;
  document.body.appendChild(a);
}
function quitarAvisoCambios() {
  const a = document.getElementById("aviso-cambios");
  if (a) a.remove();
}
function actualizarPantalla() {
  quitarAvisoCambios();
  render();
}
