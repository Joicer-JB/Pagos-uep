// Libro de ingresos y egresos (para el contador) y cuentas por pagar.

// ---- Libro: cada movimiento del período en orden de fecha, con su documento, en $ de referencia y en Bs. (a la tasa
// de cada operación), y el saldo acumulado. Los cobros van uno por recibo (un recibo puede tener varios conceptos).
// Nómina y préstamos llevan el número de su recibo (el mismo que sale impreso)
const numDocGasto = (f) =>
  f.categoria === "Nómina" || f.categoria === CATEGORIA_PRESTAMOS
    ? "NOM-" +
      String(f.id || "")
        .slice(-6)
        .toUpperCase()
    : "";
function libroIngresosEgresos(desde, hasta) {
  const enRango = (fecha) => fecha && fecha >= desde && fecha <= hasta;
  const filas = [];
  const recibos = new Map();
  pagos
    .filter((p) => enRango(p.fecha))
    .forEach((p) => {
      const k = p.factura || p.id;
      let r = recibos.get(k);
      if (!r) {
        r = {
          fecha: p.fecha,
          doc: p.factura || "",
          tipo: "ingreso",
          categoria: "Cobros a representantes",
          conceptos: [],
          metodos: [],
          tercero: p.nombre || "",
          usd: 0,
          bs: 0,
          sinTasa: false,
          tasa: p.tasa || 0,
        };
        recibos.set(k, r);
        filas.push(r);
      }
      const c = p.concepto + (p.mes && p.concepto === "Mensualidad" ? " " + p.mes : "");
      if (!r.conceptos.includes(c)) r.conceptos.push(c);
      if (p.metodo && !r.metodos.includes(p.metodo)) r.metodos.push(p.metodo);
      r.usd = r2(r.usd + (p.total || 0));
      const b = bsDe(p, p.total);
      if (b.bs != null) r.bs = r2(r.bs + b.bs);
      else r.sinTasa = true;
    });
  filas.forEach((r) => (r.concepto = r.conceptos.join(" + ")));
  finanzas
    .filter((f) => enRango(f.fecha) && (f.tipo === "ingreso" || f.tipo === "gasto"))
    .forEach((f) => {
      const b = bsDe(f, f.monto);
      filas.push({
        fecha: f.fecha,
        doc: f.tipo === "gasto" ? numDocGasto(f) : "",
        tipo: f.tipo,
        categoria: f.categoria || (f.tipo === "gasto" ? "Otros" : "Otros ingresos"),
        concepto: f.descripcion || "",
        metodos: f.moneda === "USD" ? ["Dólares"] : f.moneda === "VES" ? ["Bolívares"] : [],
        tercero: f.responsable || "",
        usd: r2(f.monto || 0),
        bs: b.bs != null ? b.bs : 0,
        sinTasa: b.bs == null,
        tasa: f.tasa || 0,
      });
    });
  // En el mismo día, primero lo que entra
  filas.sort((a, b) =>
    a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : a.tipo === b.tipo ? 0 : a.tipo === "ingreso" ? -1 : 1
  );
  let saldo = 0,
    saldoBs = 0;
  filas.forEach((r) => {
    const s = r.tipo === "ingreso" ? 1 : -1;
    saldo = r2(saldo + s * r.usd);
    saldoBs = r2(saldoBs + s * r.bs);
    r.saldo = saldo;
    r.saldoBs = saldoBs;
  });
  const suma = (tipo, k) => r2(filas.filter((r) => r.tipo === tipo).reduce((s, r) => s + r[k], 0));
  const porCategoria = (tipo) => {
    const m = new Map();
    filas
      .filter((r) => r.tipo === tipo)
      .forEach((r) => {
        const x = m.get(r.categoria) || { categoria: r.categoria, usd: 0, bs: 0, n: 0 };
        x.usd = r2(x.usd + r.usd);
        x.bs = r2(x.bs + r.bs);
        x.n++;
        m.set(r.categoria, x);
      });
    return [...m.values()].sort((a, b) => b.usd - a.usd);
  };
  return {
    desde,
    hasta,
    filas,
    ingresos: suma("ingreso", "usd"),
    egresos: suma("gasto", "usd"),
    ingresosBs: suma("ingreso", "bs"),
    egresosBs: suma("gasto", "bs"),
    neto: r2(suma("ingreso", "usd") - suma("gasto", "usd")),
    netoBs: r2(suma("ingreso", "bs") - suma("gasto", "bs")),
    sinTasa: filas.filter((r) => r.sinTasa).length,
    catIngresos: porCategoria("ingreso"),
    catEgresos: porCategoria("gasto"),
  };
}
