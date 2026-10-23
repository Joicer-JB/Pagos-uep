// Cobros: guarda los pagos de un cobro y descuenta la «deuda anterior» del estudiante en UNA transacción de Firestore.
//
// Por qué una transacción:
//   · El número de recibo es correlativo (config/contadores.recibo): dos equipos cobrando a la vez nunca reciben
//     el mismo número.
//   · La deuda anterior se lee de la base de datos en ese momento, no de la pantalla: si otro equipo ya cobró,
//     no se sobrescribe con un valor viejo.
//   · Todo se guarda junto o nada: no puede quedar un pago guardado sin descontar la deuda.
// Cada pago guarda cuánto descontó de la deuda (deudaAplicada y el concepto que tenía la deuda), para
// devolverlo si el director borra el recibo, y quién lo registró (registradoPor).
//
// Sin internet la transacción no es posible (necesita al servidor): el cobro se guarda en el equipo con un número
// provisional (PROV-…) y la deuda que muestra la pantalla; al volver la conexión recibe su número correlativo
// (numerarRecibosPendientes). Ver servicios/conexion.js.

// Mientras las reglas de Firestore no permitan usar el contador (reglas viejas), se usa el número anterior (FAC-
// + hora). Se intenta de nuevo al recargar la página.
let contadorRecibosDisponible = true;
const formatoRecibo = (n) => "FAC-" + String(n).padStart(6, "0");
// Número provisional de un cobro hecho sin conexión: único por equipo y momento
const facturaProvisional = () =>
  "PROV-" + Date.now().toString(36).toUpperCase().slice(-6) + Math.random().toString(36).slice(2, 4).toUpperCase();
const esSinConexion = (err) =>
  !navigator.onLine || (err && (err.code === "unavailable" || err.code === "deadline-exceeded"));

// Descuenta la deuda anterior del estudiante `e` (sus datos) de los pagos `listos` que la aplican (ids: los id que
// tendrán esos pagos). Anota en cada pago cuánto descontó y devuelve los cambios para el estudiante (o null).
// El estudiante queda apuntando al primer pago que descontó (ultimoCobro), y ese pago dice cuánto bajó la deuda en
// total (deudaCobro): así las reglas de Firestore comprueban que la administradora solo baja una deuda cobrándola.
function descontarDeudaAnterior(e, listos, aplicaDeuda, ids) {
  if (!(e && e.estado === "mora" && e.moraMonto > 0)) return null;
  let resto = r2(e.moraMonto),
    primero = -1;
  listos.forEach((d, i) => {
    if (resto <= 0 || !aplicaDeuda(d)) return;
    const aplicada = r2(Math.min(resto, d.total));
    if (aplicada <= 0) return;
    d.deudaAplicada = aplicada;
    d.deudaConcepto = e.moraConcepto || "";
    resto = r2(resto - aplicada);
    if (primero < 0) primero = i;
  });
  if (primero < 0) return null;
  listos[primero].deudaCobro = r2(e.moraMonto - resto);
  return {
    moraMonto: resto,
    estado: resto <= 0 ? "alsaldo" : "mora",
    moraConcepto: resto <= 0 ? "" : e.moraConcepto || "",
    ultimoCobro: ids[primero],
  };
}

// docs: pagos a guardar (sin factura ni timestamp). estId: estudiante al que se le descuenta la deuda anterior ("" = ninguno).
// aplicaDeuda(doc): si ese pago descuenta deuda anterior.
// Devuelve { factura, guardados: [pagos con id], estudiante: cambios hechos al estudiante o null, provisional }.
async function registrarCobro(docs, opciones) {
  if (!navigator.onLine) return registrarCobroSinConexion(docs, opciones);
  try {
    return await registrarCobroEnLinea(docs, opciones);
  } catch (err) {
    if (esSinConexion(err)) return registrarCobroSinConexion(docs, opciones); // la transacción no llegó a guardarse
    throw err;
  }
}
async function registrarCobroEnLinea(docs, { estId, aplicaDeuda }) {
  const intentar = (usarContador) =>
    db.runTransaction(async (tx) => {
      const contadorRef = db.collection("config").doc("contadores");
      const estRef = estId ? db.collection("estudiantes").doc(estId) : null;
      // En una transacción todas las lecturas van antes que las escrituras
      const contador = usarContador ? await tx.get(contadorRef) : null;
      const est = estRef ? await tx.get(estRef) : null;

      let factura = genFac();
      if (usarContador) {
        const n = ((contador.exists && Number(contador.data().recibo)) || 0) + 1;
        tx.set(contadorRef, { recibo: n }, { merge: true });
        factura = formatoRecibo(n);
      }

      const listos = docs.map((d) => ({ ...d, factura, registradoPor: correoUsuario() }));
      const refs = listos.map(() => db.collection("pagos").doc());
      const cambiosEst = descontarDeudaAnterior(
        est && est.exists ? est.data() : null,
        listos,
        aplicaDeuda,
        refs.map((r) => r.id)
      );
      const guardados = listos.map((d, i) => {
        tx.set(refs[i], { ...d, timestamp: firebase.firestore.FieldValue.serverTimestamp() });
        return { ...d, id: refs[i].id };
      });
      if (cambiosEst) tx.update(estRef, cambiosEst);
      return { factura, guardados, estudiante: cambiosEst, provisional: false };
    });

  if (contadorRecibosDisponible) {
    try {
      return await intentar(true);
    } catch (err) {
      if (err && err.code !== "permission-denied") throw err;
      // Reglas de Firestore viejas: todavía no dejan usar el contador. Se sigue cobrando con el número anterior.
      contadorRecibosDisponible = false;
      console.warn("Contador de recibos no disponible (publica las reglas nuevas de Firestore):", err.message);
    }
  }
  return intentar(false);
}

// Cobro sin conexión: se guarda en el equipo (Firestore lo sube al volver internet) con número provisional.
// La deuda anterior se descuenta con los datos que tiene la pantalla.
async function registrarCobroSinConexion(docs, { estId, aplicaDeuda }) {
  const factura = facturaProvisional();
  const listos = docs.map((d) => ({ ...d, factura, pendiente: true, registradoPor: correoUsuario() }));
  const refs = listos.map(() => db.collection("pagos").doc());
  const cambiosEst = descontarDeudaAnterior(
    estudiantes.find((x) => x.id === estId),
    listos,
    aplicaDeuda,
    refs.map((r) => r.id)
  );
  const lote = db.batch();
  const guardados = listos.map((d, i) => {
    lote.set(refs[i], { ...d, timestamp: firebase.firestore.FieldValue.serverTimestamp() });
    return { ...d, id: refs[i].id };
  });
  if (cambiosEst) lote.update(db.collection("estudiantes").doc(estId), cambiosEst);
  await lote.commit(); // sin conexión no espera al servidor (ver conexion.js)
  return { factura, guardados, estudiante: cambiosEst, provisional: true };
}

// Al volver la conexión: cada cobro hecho sin internet recibe su número correlativo (todos los pagos de un mismo
// cobro comparten el número). Si otro equipo ya lo numeró, se salta.
let _numerandoRecibos = false;
async function numerarRecibosPendientes() {
  if (_numerandoRecibos || !navigator.onLine || !contadorRecibosDisponible) return;
  if (!rolUsuario || rolUsuario === "docente" || soloLectura()) return;
  const provisionales = [...new Set(pagos.filter((p) => p.pendiente === true).map((p) => p.factura))];
  if (!provisionales.length) return;
  _numerandoRecibos = true;
  try {
    for (const prov of provisionales) {
      const ids = pagos.filter((p) => p.pendiente === true && p.factura === prov).map((p) => p.id);
      const resultado = await db.runTransaction(async (tx) => {
        const contadorRef = db.collection("config").doc("contadores");
        const contador = await tx.get(contadorRef);
        const docsPago = await Promise.all(ids.map((id) => tx.get(db.collection("pagos").doc(id))));
        const siguen = docsPago.filter((d) => d.exists && d.data().pendiente === true);
        if (!siguen.length) return null;
        const n = ((contador.exists && Number(contador.data().recibo)) || 0) + 1;
        const cambios = {
          factura: formatoRecibo(n),
          pendiente: false,
          recibo: n,
          facturaProvisional: prov,
          numeradoPor: correoUsuario(),
        };
        tx.set(contadorRef, { recibo: n }, { merge: true });
        siguen.forEach((d) => tx.update(d.ref, cambios));
        return { ids: siguen.map((d) => d.id), cambios };
      });
      if (resultado)
        pagos.forEach((p, i) => resultado.ids.includes(p.id) && (pagos[i] = { ...p, ...resultado.cambios }));
    }
  } catch (e) {
    console.warn("No se pudieron numerar los recibos sin conexión (se intentará de nuevo):", e.message);
  } finally {
    _numerandoRecibos = false;
  }
}

// Texto del recibo para la animación de éxito
const textoRecibo = (r) => (r.provisional ? "Sin internet: recibo provisional " + r.factura : "Recibo " + r.factura);

// Aplica en la memoria de la app lo que guardó registrarCobro
function reflejarCobro(estId, resultado) {
  [...resultado.guardados].reverse().forEach((d) => ponerEnLista(pagos, d, true));
  if (estId && resultado.estudiante) {
    const i = estudiantes.findIndex((x) => x.id === estId);
    if (i >= 0) estudiantes[i] = { ...estudiantes[i], ...resultado.estudiante };
  }
}

// Borra un pago (con su anotación en la bitácora). Si había descontado deuda anterior, se la devuelve al estudiante
// en la misma transacción. Devuelve los cambios hechos al estudiante (o null).
async function borrarPago(p) {
  const pagoRef = db.collection("pagos").doc(p.id);
  if (p.estId && p.deudaAplicada > 0 && !navigator.onLine)
    throw new Error(
      "Para borrar un recibo que descontó deuda anterior se necesita internet. Inténtalo al volver la conexión."
    );
  if (!(p.estId && p.deudaAplicada > 0)) {
    await borrarConBitacora("pagos", p.id, p);
    return null;
  }
  return db.runTransaction(async (tx) => {
    const estRef = db.collection("estudiantes").doc(p.estId);
    const est = await tx.get(estRef);
    let cambios = null;
    if (est.exists) {
      const e = est.data();
      const debia = e.estado === "mora" ? e.moraMonto || 0 : 0;
      const enCurso = !e.estado || e.estado === "mora" || e.estado === "alsaldo";
      cambios = {
        moraMonto: r2(debia + p.deudaAplicada),
        moraConcepto: e.estado === "mora" && e.moraConcepto ? e.moraConcepto : p.deudaConcepto || "Deuda anterior",
        ...(enCurso ? { estado: "mora" } : {}),
      };
      tx.update(estRef, cambios);
    }
    anotarBorrado(tx, "pagos", p.id, p, "Se devolvió la deuda anterior: " + fmt(p.deudaAplicada));
    tx.delete(pagoRef);
    return cambios;
  });
}
