// Nómina (js/servicios/nomina-calculo.js): períodos, lo que corresponde en cada quincena o mes, adelantos por
// descontar, préstamos con saldo, pagos que chocan y el resumen del mes.
const { test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { cargar } = require("./cargar");

const app = cargar(
  "js/config.js",
  "js/utils/formato.js",
  "js/utils/texto.js",
  "js/estado.js",
  "js/servicios/nomina-calculo.js"
);
const f = (codigo) => {
  const v = app.evaluar(codigo);
  return v && typeof v === "object" ? JSON.parse(JSON.stringify(v)) : v;
};
const poner = (nombre, valor) => {
  app.__valor = valor;
  app.evaluar(`${nombre} = __valor`);
};
const T1 = {
  id: "t1",
  nombre: "Ana",
  salario: 200,
  bonoAlimentacion: 40,
  bonoProductividad: 20,
  descuento: 10,
  descuentoConcepto: "Caja de ahorro",
  frecuencia: "quincenal",
};
const adelanto = {
  id: "a1",
  tipo: "gasto",
  categoria: "Nómina",
  trabajadorId: "t1",
  fecha: "2026-10-05",
  monto: 30,
  nomina: { tipo: "adelanto", periodo: "2026-10-Q1" },
};
const prestamo = {
  id: "p1",
  tipo: "gasto",
  categoria: "Préstamos al personal",
  trabajadorId: "t1",
  fecha: "2026-09-20",
  monto: 100,
  nomina: { tipo: "prestamo", cuota: 25, motivo: "Médico" },
};
const viejo = {
  id: "v1",
  tipo: "gasto",
  categoria: "Nómina",
  trabajadorId: "t1",
  fecha: "2026-10-01",
  descripcion: "Nómina Septiembre - Ana",
  monto: 250,
  montoBase: 260,
  descuento: 10,
  otros: [],
};
const pagoQ1 = (deducciones) => ({
  id: "q1",
  tipo: "gasto",
  categoria: "Nómina",
  trabajadorId: "t1",
  fecha: "2026-10-15",
  monto: 130 - deducciones.reduce((s, d) => s + d.monto, 0),
  nomina: {
    tipo: "pago",
    periodo: "2026-10-Q1",
    bruto: 130,
    asignaciones: [{ concepto: "Salario base", monto: 100 }],
    deducciones,
  },
});

beforeEach(() => {
  poner("trabajadores", [T1, { id: "t2", nombre: "Beto", salario: 300, frecuencia: "mensual", activo: false }]);
  poner("finanzas", [adelanto, prestamo, viejo]);
});

test("períodos: nombre, el que toca según el día y la frecuencia, y los pagos viejos por su descripción", () => {
  assert.equal(f(`nombrePeriodo("2026-10-Q1")`), "1ra quincena de Octubre 2026");
  assert.equal(f(`nombrePeriodo("2026-10-M")`), "Octubre 2026 (mes completo)");
  assert.equal(f(`periodoSugerido({ frecuencia: "quincenal" }, "2026-10-15")`), "2026-10-Q1");
  assert.equal(f(`periodoSugerido({ frecuencia: "quincenal" }, "2026-10-16")`), "2026-10-Q2");
  assert.equal(f(`periodoSugerido({ frecuencia: "mensual" }, "2026-10-16")`), "2026-10-M");
  assert.equal(f(`periodoDePago(finanzas[2])`), "2026-09-M"); // «Nómina Septiembre» pagada el 1° de octubre
  assert.equal(f(`periodoDePago({ fecha: "2027-01-03", descripcion: "2da quincena diciembre" })`), "2026-12-Q2");
  assert.equal(f(`brutoDePago(finanzas[2])`), 260);
});

test("lo que corresponde en una quincena: la mitad de salario y bonos, y sus deducciones", () => {
  const s = f(`sugerenciaPago(trabajadores[0], "2026-10-Q1")`);
  assert.deepEqual(
    s.asignaciones.map((a) => [a.concepto, a.monto]),
    [
      ["Salario base", 100],
      ["Bono alimentación", 20],
      ["Bono productividad", 10],
    ]
  );
  assert.deepEqual(
    s.deducciones.map((d) => [d.tipo, d.monto, d.ref || null]),
    [
      ["fija", 5, null],
      ["adelanto", 30, "a1"],
      ["prestamo", 25, "p1"],
    ]
  );
  assert.equal(s.deducciones[0].concepto, "Caja de ahorro");
  // el mes completo: todo
  assert.equal(f(`sugerenciaPago(trabajadores[0], "2026-10-M")`).asignaciones[0].monto, 200);
});

test("al pagar, el adelanto y la cuota quedan descontados; si se borra el pago, vuelven a quedar pendientes", () => {
  poner("finanzas", [
    adelanto,
    prestamo,
    viejo,
    pagoQ1([
      { concepto: "Caja", monto: 5, tipo: "fija" },
      { concepto: "Adelanto", monto: 30, tipo: "adelanto", ref: "a1" },
      { concepto: "Cuota", monto: 25, tipo: "prestamo", ref: "p1" },
    ]),
  ]);
  assert.deepEqual(f(`adelantosPendientes("t1")`), []);
  const p = f(`prestamosDe("t1")`)[0];
  assert.deepEqual([p.monto, p.pagado, p.saldo, p.cuota], [100, 25, 75, 25]);
  // la próxima quincena sugiere la cuota otra vez, y ya no el adelanto
  assert.deepEqual(
    f(`sugerenciaPago(trabajadores[0], "2026-10-Q2")`).deducciones.map((d) => d.tipo),
    ["fija", "prestamo"]
  );
  // la última cuota es solo lo que queda
  poner("finanzas", [prestamo, pagoQ1([{ concepto: "Cuota", monto: 90, tipo: "prestamo", ref: "p1" }])]);
  assert.equal(f(`sugerenciaPago(trabajadores[0], "2026-10-Q2")`).deducciones.at(-1).monto, 10);
  // sin el pago, todo vuelve a estar pendiente
  poner("finanzas", [adelanto, prestamo]);
  assert.equal(f(`adelantosPendientes("t1")`)[0].pendiente, 30);
  assert.equal(f(`prestamosDe("t1")`)[0].saldo, 100);
});

test("un adelanto descontado en parte deja pendiente el resto", () => {
  poner("finanzas", [adelanto, pagoQ1([{ concepto: "Adelanto", monto: 20, tipo: "adelanto", ref: "a1" }])]);
  assert.equal(f(`adelantosPendientes("t1")`)[0].pendiente, 10);
});

test("pagos que chocan: la misma quincena, o el mes completo con cualquiera de sus quincenas", () => {
  poner("finanzas", [pagoQ1([])]);
  assert.equal(f(`choquePeriodo("t1", "2026-10-Q1")`).length, 1);
  assert.equal(f(`choquePeriodo("t1", "2026-10-M")`).length, 1);
  assert.equal(f(`choquePeriodo("t1", "2026-10-Q2")`).length, 0);
  assert.equal(f(`choquePeriodo("t1", "2026-11-Q1")`).length, 0);
  assert.equal(f(`siguientePeriodo(trabajadores[0], "2026-10")`), "2026-10-Q2");
});

test("resumen del mes: lo que gana, lo pagado, lo entregado, lo que falta y lo que debe (sin los retirados)", () => {
  poner("finanzas", [
    adelanto,
    prestamo,
    viejo,
    pagoQ1([
      { concepto: "Adelanto", monto: 30, tipo: "adelanto", ref: "a1" },
      { concepto: "Cuota", monto: 25, tipo: "prestamo", ref: "p1" },
    ]),
  ]);
  const r = f(`resumenNominaMes("2026-10")`);
  assert.equal(r.filas.length, 1); // Beto está retirado
  const a = r.filas[0];
  assert.equal(a.devengado, 260);
  assert.equal(a.bruto, 130);
  assert.equal(a.neto, 75);
  assert.equal(a.porPagar, 130);
  assert.equal(a.adelantos, 30);
  assert.equal(a.entregado, 30 + 75 + 250); // en octubre se entregó el adelanto, la 1ra quincena y la nómina de septiembre
  assert.deepEqual(a.periodos, ["Q1"]);
  assert.equal(a.siguiente, "2026-10-Q2");
  assert.equal(a.saldoPrestamos, 75);
  assert.equal(r.porPagar, 130);
});
