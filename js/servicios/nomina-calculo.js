// Cálculos de la nómina: períodos de pago (1ra quincena, 2da quincena o mes completo), lo que corresponde pagar a
// cada trabajador, adelantos por descontar y préstamos con su saldo. Todo sale de los movimientos de nómina que se
// guardan en «finanzas» (son gastos: el dinero que sale):
//   · pago:     nomina = {tipo:"pago", periodo:"2026-10-Q1" | "2026-10-Q2" | "2026-10-M", bruto,
//                         asignaciones:[{concepto, monto}], deducciones:[{concepto, monto, tipo, ref}]}; monto = neto
//   · adelanto: nomina = {tipo:"adelanto", periodo}; monto = lo entregado (categoría «Nómina»)
//   · préstamo: nomina = {tipo:"prestamo", cuota, motivo}; monto = lo prestado (categoría «Préstamos al personal»)
// Una deducción de tipo «adelanto» o «prestamo» lleva ref = el id del adelanto o préstamo que descuenta. Un adelanto
// queda pendiente mientras ningún pago lo descuente, y el saldo de un préstamo es lo prestado menos sus cuotas
// descontadas: si se borra un pago, lo que descontaba vuelve a quedar pendiente solo.
// Así, en «Nómina» la suma de adelantos + pagos netos es lo que costó la nómina, y el préstamo sale aparte (se
// recupera con las cuotas).

const CATEGORIA_PRESTAMOS = "Préstamos al personal";
const TIPOS_PERIODO = { Q1: "1ra quincena", Q2: "2da quincena", M: "Mes completo" };
const periodoDe = (ym, tipo) => ym + "-" + tipo;
function partesPeriodo(p) {
  const m = /^(\d{4}-\d{2})-(Q1|Q2|M)$/.exec(p || "");
  return m ? { ym: m[1], tipo: m[2] } : null;
}
// «1ra quincena de Octubre 2026» / «Octubre 2026 (mes completo)»
function nombrePeriodo(p) {
  const x = partesPeriodo(p);
  if (!x) return "";
  return x.tipo === "M" ? nombreMesYM(x.ym) + " (mes completo)" : TIPOS_PERIODO[x.tipo] + " de " + nombreMesYM(x.ym);
}
// El período que toca pagar en una fecha: a los quincenales, la quincena de ese día; a los mensuales, el mes
function periodoSugerido(t, hoy) {
  hoy = hoy || todayStr();
  const ym = hoy.slice(0, 7);
  if (t && t.frecuencia === "mensual") return periodoDe(ym, "M");
  return periodoDe(ym, Number(hoy.slice(8, 10)) <= 15 ? "Q1" : "Q2");
}
const fraccionPeriodo = (tipo) => (tipo === "M" ? 1 : 0.5);
// Lo que gana un trabajador al mes (salario + bonos), antes de deducciones
const devengadoMensual = (t) => r2((t.salario || 0) + (t.bonoAlimentacion || 0) + (t.bonoProductividad || 0));
const netoMensual = (t) => r2(devengadoMensual(t) - (t.descuento || 0));

// Movimientos de nómina de un trabajador (los pagos viejos, sin «nomina», cuentan como pagos)
const movimientosNomina = (trabId) =>
  finanzas.filter(
    (f) =>
      f.tipo === "gasto" &&
      f.trabajadorId === trabId &&
      (f.categoria === "Nómina" || f.categoria === CATEGORIA_PRESTAMOS)
  );
const tipoMovNomina = (f) => (f.nomina && f.nomina.tipo) || (f.categoria === CATEGORIA_PRESTAMOS ? "prestamo" : "pago");
// Período de un pago viejo: el mes (y la quincena) que dice su descripción, o el mes de su fecha
function periodoDePago(f) {
  if (f.nomina && f.nomina.periodo) return f.nomina.periodo;
  if (!f.fecha) return "";
  const d = sinAcento(String(f.descripcion || "")).toLowerCase();
  let ym = f.fecha.slice(0, 7);
  const i = MESES.findIndex((m) => d.includes(sinAcento(m).toLowerCase()));
  if (i >= 0) {
    const mesFecha = Number(f.fecha.slice(5, 7));
    const anio = Number(f.fecha.slice(0, 4)) - (i + 1 > mesFecha ? 1 : 0); // «Diciembre» pagado en enero
    ym = anio + "-" + String(i + 1).padStart(2, "0");
  }
  const tipo = /(1ra|primera|1era)\s*quincena/.test(d) ? "Q1" : /(2da|segunda)\s*quincena/.test(d) ? "Q2" : "M";
  return periodoDe(ym, tipo);
}
// Lo devengado en un pago: los nuevos lo guardan; en los viejos, la base + los otros conceptos
function brutoDePago(f) {
  if (f.nomina && f.nomina.bruto != null) return f.nomina.bruto;
  const otros = Array.isArray(f.otros) ? f.otros.reduce((s, o) => s + (o.monto || 0), 0) : 0;
  return r2((f.montoBase != null ? f.montoBase : f.monto || 0) + otros);
}
const deduccionesDe = (f) => (f.nomina && Array.isArray(f.nomina.deducciones) ? f.nomina.deducciones : []);
// Cuánto de un adelanto o préstamo ya se descontó en los pagos
const descontadoDe = (movs, ref) =>
  r2(
    movs
      .filter((f) => tipoMovNomina(f) === "pago")
      .reduce((s, f) => s + deduccionesDe(f).reduce((x, d) => x + (d.ref === ref ? d.monto || 0 : 0), 0), 0)
  );

function adelantosPendientes(trabId) {
  const movs = movimientosNomina(trabId);
  return movs
    .filter((f) => tipoMovNomina(f) === "adelanto")
    .map((f) => ({
      id: f.id,
      fecha: f.fecha,
      periodo: (f.nomina && f.nomina.periodo) || "",
      monto: f.monto || 0,
      pendiente: r2((f.monto || 0) - descontadoDe(movs, f.id)),
    }))
    .filter((a) => a.pendiente > 0.004)
    .sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
}
function prestamosDe(trabId) {
  const movs = movimientosNomina(trabId);
  return movs
    .filter((f) => tipoMovNomina(f) === "prestamo")
    .map((f) => {
      const pagado = descontadoDe(movs, f.id);
      return {
        id: f.id,
        fecha: f.fecha,
        monto: f.monto || 0,
        cuota: (f.nomina && f.nomina.cuota) || f.monto || 0,
        motivo: (f.nomina && f.nomina.motivo) || "",
        pagado,
        saldo: r2(Math.max(0, (f.monto || 0) - pagado)),
      };
    })
    .sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
}
const sumaDe = (l, k) => r2(l.reduce((s, x) => s + (x[k] || 0), 0));

// Lo que corresponde en un período: asignaciones (salario y bonos; la mitad si es una quincena) y deducciones (la
// deducción fija, los adelantos por descontar y la cuota de cada préstamo con saldo)
function sugerenciaPago(t, periodo) {
  const x = partesPeriodo(periodo),
    f = fraccionPeriodo(x ? x.tipo : "M");
  const asignaciones = [
    ["Salario base", t.salario],
    ["Bono alimentación", t.bonoAlimentacion],
    ["Bono productividad", t.bonoProductividad],
  ]
    .map(([concepto, v]) => ({ concepto, monto: r2((v || 0) * f) }))
    .filter((a) => a.monto > 0);
  const deducciones = [];
  if (t.descuento > 0)
    deducciones.push({
      concepto: t.descuentoConcepto || "Deducción fija",
      monto: r2(t.descuento * f),
      tipo: "fija",
    });
  if (t.id) {
    adelantosPendientes(t.id).forEach((a) =>
      deducciones.push({
        concepto: "Adelanto del " + fechaCorta(a.fecha),
        monto: a.pendiente,
        tipo: "adelanto",
        ref: a.id,
      })
    );
    prestamosDe(t.id)
      .filter((p) => p.saldo > 0.004)
      .forEach((p) =>
        deducciones.push({
          concepto: "Cuota de préstamo del " + fechaCorta(p.fecha),
          monto: r2(Math.min(p.cuota, p.saldo)),
          tipo: "prestamo",
          ref: p.id,
          saldo: p.saldo,
        })
      );
  }
  return { asignaciones, deducciones };
}
// Pagos que chocan con un período: el mismo período, o el mes completo con cualquiera de sus quincenas (y al revés)
function choquePeriodo(trabId, periodo, sinId) {
  const x = partesPeriodo(periodo);
  if (!x) return [];
  return movimientosNomina(trabId).filter((f) => {
    if (tipoMovNomina(f) !== "pago" || f.id === sinId) return false;
    const y = partesPeriodo(periodoDePago(f));
    return !!y && y.ym === x.ym && (y.tipo === x.tipo || y.tipo === "M" || x.tipo === "M");
  });
}
// El próximo período por pagar de un mes: nada si ya está todo pagado
function siguientePeriodo(t, ym) {
  const opciones = t.frecuencia === "mensual" ? ["M"] : ["Q1", "Q2"];
  const libre = opciones.find((tipo) => !choquePeriodo(t.id, periodoDe(ym, tipo)).length);
  return libre ? periodoDe(ym, libre) : "";
}

// Nómina de un mes, por trabajador activo: lo que gana al mes, lo devengado en los pagos de ese mes, lo entregado
// (adelantos + pagos netos + préstamos con fecha en ese mes), lo que falta por pagar y lo que debe
function resumenNominaMes(ym) {
  const filas = trabajadores
    .filter((t) => t.activo !== false)
    .map((t) => {
      const movs = movimientosNomina(t.id);
      const pagos = movs.filter((f) => tipoMovNomina(f) === "pago" && periodoDePago(f).slice(0, 7) === ym);
      const delMes = movs.filter((f) => (f.fecha || "").slice(0, 7) === ym);
      const devengado = devengadoMensual(t);
      const bruto = r2(pagos.reduce((s, f) => s + brutoDePago(f), 0));
      return {
        t,
        devengado,
        bruto,
        neto: sumaDe(pagos, "monto"),
        adelantos: sumaDe(
          delMes.filter((f) => tipoMovNomina(f) === "adelanto"),
          "monto"
        ),
        prestado: sumaDe(
          delMes.filter((f) => tipoMovNomina(f) === "prestamo"),
          "monto"
        ),
        entregado: sumaDe(delMes, "monto"),
        porPagar: r2(Math.max(0, devengado - bruto)),
        periodos: pagos.map((f) => (partesPeriodo(periodoDePago(f)) || {}).tipo).filter(Boolean),
        siguiente: siguientePeriodo(t, ym),
        adelantosPendientes: sumaDe(adelantosPendientes(t.id), "pendiente"),
        saldoPrestamos: sumaDe(prestamosDe(t.id), "saldo"),
      };
    });
  const total = (k) => sumaDe(filas, k);
  return {
    ym,
    filas,
    devengado: total("devengado"),
    bruto: total("bruto"),
    entregado: total("entregado"),
    porPagar: total("porPagar"),
    adelantosPendientes: total("adelantosPendientes"),
    saldoPrestamos: total("saldoPrestamos"),
  };
}
