// Cobros: guarda los pagos de un cobro y descuenta la «deuda anterior» del estudiante en UNA transacción de Firestore.
//
// Por qué una transacción:
//   · El número de recibo es correlativo (config/contadores.recibo): dos equipos cobrando a la vez nunca reciben
//     el mismo número.
//   · La deuda anterior se lee de la base de datos en ese momento, no de la pantalla: si otro equipo ya cobró,
//     no se sobrescribe con un valor viejo.
//   · Todo se guarda junto o nada: no puede quedar un pago guardado sin descontar la deuda.
// Cada pago guarda cuánto descontó de la deuda (deudaAplicada y el concepto que tenía la deuda), para
// devolverlo si el director borra el recibo.

// Mientras las reglas de Firestore no permitan usar el contador (reglas viejas), se usa el número anterior (FAC-
// + hora). Se intenta de nuevo al recargar la página.
let contadorRecibosDisponible = true;
const formatoRecibo = (n) => "FAC-" + String(n).padStart(6, "0");

// docs: pagos a guardar (sin factura ni timestamp). estId: estudiante al que se le descuenta la deuda anterior ("" = ninguno).
// aplicaDeuda(doc): si ese pago descuenta deuda anterior.
// Devuelve { factura, guardados: [pagos con id], estudiante: cambios hechos al estudiante o null }.
async function registrarCobro(docs, { estId, aplicaDeuda }) {
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

      const listos = docs.map((d) => ({ ...d, factura }));
      let cambiosEst = null;
      const e = est && est.exists ? est.data() : null;
      if (e && e.estado === "mora" && e.moraMonto > 0) {
        let resto = r2(e.moraMonto);
        listos.forEach((d) => {
          if (resto <= 0 || !aplicaDeuda(d)) return;
          const aplicada = r2(Math.min(resto, d.total));
          if (aplicada <= 0) return;
          d.deudaAplicada = aplicada;
          d.deudaConcepto = e.moraConcepto || "";
          resto = r2(resto - aplicada);
        });
        if (resto !== r2(e.moraMonto)) {
          cambiosEst = {
            moraMonto: resto,
            estado: resto <= 0 ? "alsaldo" : "mora",
            moraConcepto: resto <= 0 ? "" : e.moraConcepto || "",
          };
          tx.update(estRef, cambiosEst);
        }
      }
      const guardados = listos.map((d) => {
        const ref = db.collection("pagos").doc();
        tx.set(ref, { ...d, timestamp: firebase.firestore.FieldValue.serverTimestamp() });
        return { ...d, id: ref.id };
      });
      return { factura, guardados, estudiante: cambiosEst };
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

// Aplica en la memoria de la app lo que guardó registrarCobro
function reflejarCobro(estId, resultado) {
  [...resultado.guardados].reverse().forEach((d) => ponerEnLista(pagos, d, true));
  if (estId && resultado.estudiante) {
    const i = estudiantes.findIndex((x) => x.id === estId);
    if (i >= 0) estudiantes[i] = { ...estudiantes[i], ...resultado.estudiante };
  }
}

// Borra un pago. Si había descontado deuda anterior, se la devuelve al estudiante en la misma transacción.
// Devuelve los cambios hechos al estudiante (o null).
async function borrarPago(p) {
  const pagoRef = db.collection("pagos").doc(p.id);
  if (!(p.estId && p.deudaAplicada > 0)) {
    await pagoRef.delete();
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
    tx.delete(pagoRef);
    return cambios;
  });
}
