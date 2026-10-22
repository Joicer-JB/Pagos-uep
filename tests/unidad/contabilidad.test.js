// Libro de ingresos y egresos y cuentas por pagar (js/servicios/contabilidad.js)
const { test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { cargar } = require("./cargar");

const app = cargar(
  "js/config.js",
  "js/utils/formato.js",
  "js/utils/texto.js",
  "js/utils/grados.js",
  "js/estado.js",
  "js/servicios/tasa-bcv.js",
  "js/servicios/nomina-calculo.js",
  "js/servicios/contabilidad.js"
);
const f = (codigo) => {
  const v = app.evaluar(codigo);
  return v && typeof v === "object" ? JSON.parse(JSON.stringify(v)) : v;
};
const poner = (nombre, valor) => {
  app.__valor = valor;
  app.evaluar(`${nombre} = __valor`);
};

beforeEach(() => {
  poner("pagos", [
    // un recibo con dos conceptos (inscripción + septiembre)
    {
      id: "p1",
      factura: "FAC-1",
      nombre: "Ana",
      fecha: "2026-10-03",
      concepto: "Inscripción",
      metodo: "Dólares Efectivo",
      total: 61,
      tasa: 180,
      totalBs: 10980,
    },
    {
      id: "p2",
      factura: "FAC-1",
      nombre: "Ana",
      fecha: "2026-10-03",
      concepto: "Mensualidad",
      mes: "Septiembre",
      metodo: "Dólares Efectivo",
      total: 45,
      tasa: 180,
      totalBs: 8100,
    },
    {
      id: "p3",
      factura: "FAC-2",
      nombre: "Luis",
      fecha: "2026-10-10",
      concepto: "Mensualidad",
      mes: "Octubre",
      metodo: "Transferencia Bs",
      total: 45,
      tasa: 185,
      totalBs: 8325,
    },
    {
      id: "p4",
      factura: "FAC-0",
      nombre: "Otro mes",
      fecha: "2026-09-28",
      concepto: "Mensualidad",
      total: 45,
      tasa: 180,
      totalBs: 8100,
    },
  ]);
  poner("finanzas", [
    {
      id: "g1abcdef",
      tipo: "gasto",
      categoria: "Nómina",
      descripcion: "1ra quincena",
      responsable: "Docente",
      fecha: "2026-10-03",
      monto: 90,
      tasa: 180,
      montoBs: 16200,
    },
    {
      id: "g2",
      tipo: "gasto",
      categoria: "Servicios",
      descripcion: "Luz",
      fecha: "2026-10-12",
      monto: 20,
      tasa: 185,
      montoBs: 3700,
    },
    {
      id: "i1",
      tipo: "ingreso",
      categoria: "Donación",
      descripcion: "Donación",
      fecha: "2026-10-05",
      monto: 10,
      tasa: 182,
      montoBs: 1820,
    },
  ]);
});

test("libro del mes: un renglón por recibo, en orden de fecha (lo que entra primero) y con el saldo", () => {
  const L = f(`libroIngresosEgresos("2026-10-01", "2026-10-31")`);
  assert.deepEqual(
    L.filas.map((r) => [r.fecha, r.doc, r.tipo, r.concepto, r.usd, r.saldo]),
    [
      ["2026-10-03", "FAC-1", "ingreso", "Inscripción + Mensualidad Septiembre", 106, 106],
      ["2026-10-03", "NOM-ABCDEF", "gasto", "1ra quincena", 90, 16],
      ["2026-10-05", "", "ingreso", "Donación", 10, 26],
      ["2026-10-10", "FAC-2", "ingreso", "Mensualidad Octubre", 45, 71],
      ["2026-10-12", "", "gasto", "Luz", 20, 51],
    ]
  );
  assert.deepEqual([L.ingresos, L.egresos, L.neto], [161, 110, 51]);
  assert.deepEqual([L.ingresosBs, L.egresosBs, L.netoBs], [19080 + 1820 + 8325, 16200 + 3700, 29225 - 19900]);
  assert.deepEqual(
    L.catIngresos.map((c) => [c.categoria, c.usd, c.n]),
    [
      ["Cobros a representantes", 151, 2],
      ["Donación", 10, 1],
    ]
  );
  assert.deepEqual(
    L.catEgresos.map((c) => c.categoria),
    ["Nómina", "Servicios"]
  );
});

test("cuentas por pagar: vencida, vence pronto (7 días), pendiente o pagada", () => {
  const e = (c) => f(`estadoCuentaPagar(${JSON.stringify(c)}, "2026-10-07")`);
  assert.equal(e({ vence: "2026-10-06" }), "vencida");
  assert.equal(e({ vence: "2026-10-07" }), "por-vencer");
  assert.equal(e({ vence: "2026-10-14" }), "por-vencer");
  assert.equal(e({ vence: "2026-10-15" }), "proxima");
  assert.equal(e({ vence: "2026-10-01", estado: "pagada" }), "pagada");
  assert.equal(e({}), "sin-fecha");
});

test("la cuenta de cada mes vence el mismo día del mes siguiente (o el último, si no lo tiene)", () => {
  assert.equal(f(`venceSiguiente("2026-10-15")`), "2026-11-15");
  assert.equal(f(`venceSiguiente("2027-01-31")`), "2027-02-28");
  assert.equal(f(`venceSiguiente("2026-12-05")`), "2027-01-05");
});

test("resumen: pendientes por vencimiento y totales en $ (las de Bs. a la tasa de hoy)", () => {
  app.evaluar(`tasas = {}; tasas[todayStr()] = 200`);
  const r = f(`resumenCuentasPagar([
    { id: "a", descripcion: "Alquiler", monto: 300, moneda: "USD", vence: "2000-01-01" },
    { id: "b", descripcion: "Luz", monto: 20000, moneda: "VES", vence: todayStr() },
    { id: "c", descripcion: "Agua", monto: 10, moneda: "USD", vence: "2999-01-01" },
    { id: "d", descripcion: "Pagada", monto: 99, moneda: "USD", vence: "2000-01-01", estado: "pagada" },
  ])`);
  assert.deepEqual(
    r.pendientes.map((c) => c.id),
    ["a", "b", "c"]
  );
  assert.deepEqual([r.totalVencidas, r.totalSemana, r.total], [300, 100, 410]);
});
