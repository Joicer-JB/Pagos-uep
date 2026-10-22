// Tablero financiero (js/servicios/indicadores.js): cobranza por mes, antigüedad de la deuda, proyección y
// punto de equilibrio, con un caso calculado a mano.
const { test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { cargar } = require("./cargar");

const app = cargar(
  "js/config.js",
  "js/utils/formato.js",
  "js/utils/grados.js",
  "js/estado.js",
  "js/vistas/anio-escolar.js",
  "js/servicios/tasa-bcv.js",
  "js/servicios/cuotas.js",
  "js/servicios/indicadores.js",
  "js/utils/texto.js",
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
const HOY = "2026-11-20";

beforeEach(() => {
  poner("escCfg", null);
  poner("anioVista", null);
  poner("cobCfg", {
    primerMes: "2026-09",
    cuotas: 10,
    diaVence: 5,
    recargo: 0,
    recargoDesde: "",
    costos: { primaria: { inscripcion: 45, mensualidad: 45 }, media: { inscripcion: 55, mensualidad: 55 } },
    carnet: 13,
    papeleria: 3,
    inscripcionDesde: "2026-06-01",
  });
  poner("estudiantes", [
    // Ana pagó la inscripción con septiembre y octubre; debe noviembre
    { id: "a", nombre: "Ana", grado: "3er Grado", mensualidad: 45, estado: "alsaldo" },
    // Beto no ha pagado nada
    { id: "b", nombre: "Beto", grado: "1er Año", mensualidad: 55, estado: "alsaldo" },
    // Los retirados no cuentan
    { id: "c", nombre: "Caro", grado: "1er Año", mensualidad: 55, estado: "retirado" },
  ]);
  poner("pagos", [
    { id: "p1", estId: "a", nombre: "Ana", fecha: "2026-09-02", concepto: "Inscripción", total: 61 },
    {
      id: "p2",
      estId: "a",
      nombre: "Ana",
      fecha: "2026-09-02",
      concepto: "Mensualidad",
      total: 45,
      cuotas: { "2026-09": 45 },
    },
    { id: "p3", estId: "a", nombre: "Ana", fecha: "2026-10-03", concepto: "Mensualidad", total: 45 },
  ]);
  poner("trabajadores", [{ salario: 60, bonoAlimentacion: 10 }]);
  poner("finanzas", [
    { tipo: "gasto", categoria: "Nómina", fecha: "2026-10-30", monto: 70 },
    { tipo: "gasto", categoria: "Servicios", fecha: "2026-10-10", monto: 30 },
    { tipo: "gasto", categoria: "Servicios", fecha: "2026-11-10", monto: 30 },
    { tipo: "gasto", categoria: "Servicios", fecha: "2026-08-10", monto: 500 }, // del año anterior: no cuenta
    { tipo: "ingreso", categoria: "Otro", fecha: "2026-10-10", monto: 99 },
  ]);
});

test("esperado, cobrado, vencido y por vencer del año", () => {
  const t = f(`indicadoresFinancieros("${HOY}")`);
  assert.equal(t.esperado, 511 + 621); // Ana: 61 + 10×45 · Beto: 71 + 10×55
  assert.equal(t.cobrado, 151);
  assert.equal(t.vencido, 45 + 71 + 55 * 3);
  assert.equal(t.porVencer, 7 * 45 + 7 * 55);
  assert.deepEqual(t.inscripcion, { esperado: 132, cobrado: 61, pendiente: 71, pct: 61 / 132 });
});

test("cobranza por mes (hasta el mes en curso) e índice de cobranza de lo vencido", () => {
  const t = f(`indicadoresFinancieros("${HOY}")`);
  assert.deepEqual(
    t.porMes.map((m) => [m.ym, m.esperado, m.cobrado, m.vencido]),
    [
      ["2026-09", 100, 45, true],
      ["2026-10", 100, 45, true],
      ["2026-11", 100, 0, true],
    ]
  );
  assert.equal(t.indice, (90 + 61) / (300 + 132));
  // a principios de mes, noviembre todavía está «en curso»
  const antes = f(`indicadoresFinancieros("2026-11-03")`);
  assert.equal(antes.porMes.at(-1).vencido, false);
  assert.equal(antes.indice, (90 + 61) / (200 + 132));
});

test("antigüedad de la deuda por tramos y a quién cobrar primero", () => {
  const t = f(`indicadoresFinancieros("${HOY}")`);
  assert.deepEqual(
    t.tramos.map((x) => [x.clave, x.monto, x.estudiantes]),
    [
      ["1-30", 45 + 55, 2], // noviembre (15 días)
      ["31-60", 55, 1], // octubre de Beto (46 días)
      ["61-90", 71 + 55, 1], // inscripción y septiembre de Beto (76 días)
      ["90+", 0, 0],
    ]
  );
  assert.deepEqual(
    t.prioridad.map((d) => [d.nombre, d.monto, d.dias]),
    [
      ["Beto", 236, 76],
      ["Ana", 45, 15],
    ]
  );
});

test("proyección: lo cobrado más lo que falta por vencer al ritmo de cobranza actual", () => {
  const t = f(`indicadoresFinancieros("${HOY}")`);
  assert.equal(t.proyeccion.siTodosPagan, 1132);
  assert.equal(t.proyeccion.estimado, Math.round((151 + 700 * (151 / 432)) * 100) / 100);
});

test("punto de equilibrio: nómina del personal + otros gastos promedio contra las mensualidades", () => {
  const eq = f(`indicadoresFinancieros("${HOY}")`).equilibrio;
  assert.equal(eq.meses, 3); // septiembre a noviembre
  assert.equal(eq.nomina, 70);
  assert.equal(eq.nominaDe, "personal");
  assert.equal(eq.otrosGastos, 20); // 60 en 3 meses (lo del año anterior y los ingresos no cuentan)
  assert.equal(eq.costoMes, 90);
  assert.equal(eq.ingresoMes, 100);
  assert.equal(eq.promedio, 50);
  assert.equal(eq.necesarios, 2);
  // sin personal registrado, la nómina es el promedio de lo pagado
  poner("trabajadores", []);
  const sin = f(`indicadoresFinancieros("${HOY}")`).equilibrio;
  assert.equal(sin.nominaDe, "pagada");
  assert.equal(sin.nomina, Math.round((70 / 3) * 100) / 100);
});

test("sin cuotas configuradas, o viendo un año anterior, no hay tablero", () => {
  poner("cobCfg", null);
  assert.equal(f(`indicadoresFinancieros("${HOY}")`), null);
});
