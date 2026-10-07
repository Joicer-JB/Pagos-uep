// Tasa BCV, montos en Bs. y mora automática por cuotas (js/servicios/tasa-bcv.js y cuotas.js)
const { test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { cargar } = require("./cargar");

const app = cargar(
  "js/config.js",
  "js/utils/formato.js",
  "js/estado.js",
  "js/vistas/anio-escolar.js",
  "js/servicios/tasa-bcv.js",
  "js/servicios/cuotas.js"
);
// JSON ida y vuelta: los objetos del contexto aislado tienen otro prototipo y deepEqual los vería distintos
const f = (codigo) => {
  const v = app.evaluar(codigo);
  return v && typeof v === "object" ? JSON.parse(JSON.stringify(v)) : v;
};
const poner = (nombre, valor) => {
  app.__valor = valor;
  app.evaluar(`${nombre} = __valor`);
};

beforeEach(() => {
  poner("tasas", { "2026-10-01": 180.5, "2026-10-02": 181.25, "2026-10-05": 182.1 });
  poner("pagos", []);
  poner("escCfg", null);
  poner("anioVista", null);
  poner("cobCfg", { primerMes: "2026-09", cuotas: 10, diaVence: 5, recargo: 0, recargoDesde: "" });
});

test("parseTasa: acepta coma o punto decimal", () => {
  assert.equal(f('parseTasa("396,3674")'), 396.3674);
  assert.equal(f('parseTasa("396.3674")'), 396.3674);
  assert.equal(f('parseTasa("1.396,36")'), 1396.36);
  assert.equal(f('parseTasa("Bs. 184,5")'), 184.5);
  assert.equal(f('parseTasa("")'), 0);
});

test("tasaDe: la del día, o la última anterior hasta 10 días", () => {
  assert.deepEqual(f('tasaDe("2026-10-02")'), { valor: 181.25, fecha: "2026-10-02", exacta: true });
  // sábado sin tasa: usa la del viernes y avisa que no es exacta
  assert.deepEqual(f('tasaDe("2026-10-03")'), { valor: 181.25, fecha: "2026-10-02", exacta: false });
  assert.equal(f('tasaDe("2026-10-15")').valor, 182.1); // justo 10 días después de la última tasa
  assert.equal(f('tasaDe("2026-10-15")').exacta, false);
  assert.equal(f('tasaDe("2026-10-16")'), null); // 11 días: ya no sirve
  assert.equal(f('tasaDe("2026-10-20")'), null); // más de 10 días
  assert.equal(f('tasaDe("2026-09-30")'), null); // no hay anteriores
  assert.equal(f('tasaDe("")'), null);
});

test("bsDe: usa los Bs. guardados; si es un registro viejo, los estima con la tasa de su fecha", () => {
  const guardado = f('bsDe({total:45, totalBs:8156.25, tasa:181.25, fecha:"2026-10-02"})');
  assert.deepEqual(guardado, { bs: 8156.25, tasa: 181.25, fecha: "2026-10-02", estimada: false });
  const viejo = f('bsDe({total:10, fecha:"2026-10-05"})');
  assert.deepEqual(viejo, { bs: 1821, tasa: 182.1, fecha: "2026-10-05", estimada: true });
  const sinTasa = f('bsDe({total:10, fecha:"2026-01-05"})');
  assert.equal(sinTasa.bs, null);
});

test("totalesDual: suma $ y Bs. y cuenta los registros sin tasa", () => {
  const t = f(`totalesDual([
    {usd:45, rec:{total:45, totalBs:8156.25, tasa:181.25, fecha:"2026-10-02"}},
    {usd:10, rec:{total:10, fecha:"2026-10-05"}},
    {usd:5,  rec:{total:5,  fecha:"2025-01-01"}},
  ])`);
  assert.deepEqual(t, { usd: 60, bs: 9977.25, sinTasa: 1, estim: 1 });
});

// ---------- Mora automática ----------
const estudiante = { id: "e1", nombre: "Ana", cedula: "V-1", mensualidad: 45, estado: "alsaldo" };
const pago = (fecha, total, concepto = "Mensualidad") => ({
  estId: "e1",
  nombre: "Ana",
  cedula: "V-1",
  fecha,
  total,
  concepto,
});
const cuotas = (hoy) => {
  app.__e = estudiante;
  return f(`calcCuotas(__e, ${JSON.stringify(hoy)})`);
};

test("calcCuotas: sin pagos, deben las cuotas ya vencidas", () => {
  const c = cuotas("2026-10-07"); // septiembre y octubre (vence el 5) vencidas
  assert.equal(c.lista.length, 10);
  assert.deepEqual(
    c.pendientes.map((q) => q.mes),
    ["Septiembre 2026", "Octubre 2026"]
  );
  assert.equal(c.saldo, 90);
  assert.equal(c.total, 90);
  assert.equal(c.proxima.mes, "Noviembre 2026");
});

test("calcCuotas: el día de vencimiento todavía no está vencida", () => {
  assert.equal(cuotas("2026-10-05").saldo, 45); // solo septiembre
  assert.equal(cuotas("2026-10-06").saldo, 90);
});

test("calcCuotas: los pagos se aplican desde la cuota más antigua, con abonos", () => {
  poner("pagos", [pago("2026-09-03", 45), pago("2026-10-10", 20)]);
  const c = cuotas("2026-10-12");
  assert.equal(c.lista[0].pendiente, 0);
  assert.equal(c.lista[1].pagado, 20);
  assert.equal(c.lista[1].pendiente, 25);
  assert.equal(c.saldo, 25);
});

test("calcCuotas: lo pagado de más queda como saldo a favor", () => {
  poner("pagos", [pago("2026-09-03", 500)]);
  const c = cuotas("2026-10-07");
  assert.equal(c.saldo, 0);
  assert.equal(c.aFavor, 50); // 10 cuotas de 45 = 450
});

test("calcCuotas: los pagos de otros conceptos no pagan mensualidades", () => {
  poner("pagos", [pago("2026-09-03", 60, "Inscripción")]);
  assert.equal(cuotas("2026-10-07").saldo, 90);
});

test("calcCuotas: recargo una sola vez por cada cuota pagada tarde o vencida", () => {
  poner("cobCfg", { primerMes: "2026-09", cuotas: 10, diaVence: 5, recargo: 5, recargoDesde: "" });
  poner("pagos", [pago("2026-09-20", 45)]); // septiembre pagada tarde; octubre vencida
  const c = cuotas("2026-10-07");
  assert.equal(c.nRecargos, 2);
  assert.equal(c.recargoTotal, 10);
  assert.equal(c.total, 45 + 10);
  // pagar el recargo lo descuenta
  poner("pagos", [pago("2026-09-20", 45), pago("2026-10-07", 10, "Recargo")]);
  assert.equal(cuotas("2026-10-07").recargoPend, 0);
});

test("calcCuotas: el recargo no es retroactivo (recargoDesde) y no aplica a exonerados", () => {
  poner("cobCfg", { primerMes: "2026-09", cuotas: 10, diaVence: 5, recargo: 5, recargoDesde: "2026-10-01" });
  assert.equal(cuotas("2026-10-07").nRecargos, 1); // solo octubre
  app.__e = { ...estudiante, sinRecargo: true };
  assert.equal(f('calcCuotas(__e, "2026-10-07")').recargoTotal, 0);
});

test("calcCuotas: cuotaDesde (inscrito a mitad de año), retirados y sin configuración", () => {
  app.__e = { ...estudiante, cuotaDesde: "2026-10" };
  assert.equal(f('calcCuotas(__e, "2026-10-07")').saldo, 45);
  app.__e = { ...estudiante, estado: "retirado" };
  assert.equal(f('calcCuotas(__e, "2026-10-07")'), null);
  poner("cobCfg", null);
  assert.equal(cuotas("2026-10-07"), null);
});

test("calcCuotas: en un año escolar anterior no se calcula mora", () => {
  poner("escCfg", { actual: { id: "2026-2027" }, anteriores: [{ id: "2025-2026" }] });
  poner("anioVista", "2025-2026");
  assert.equal(cuotas("2026-10-07"), null);
});

test("pagosDeEstudiante: encuentra pagos por id, cédula o nombre sin repetirlos", () => {
  poner("pagos", [
    { estId: "e1", nombre: "Ana", cedula: "V-1", fecha: "2026-09-01", total: 1 },
    { nombre: "ana", cedula: "", fecha: "2026-09-02", total: 2 }, // pago viejo, solo con nombre
    { cedula: "V-1", nombre: "Otra", fecha: "2026-09-03", total: 3 },
    { estId: "e2", nombre: "Luis", cedula: "V-2", fecha: "2026-09-04", total: 4 },
  ]);
  app.__e = estudiante;
  assert.deepEqual(
    f("pagosDeEstudiante(__e)")
      .map((p) => p.total)
      .sort(),
    [1, 2, 3]
  );
});

test("deudaManual y conceptoDeE", () => {
  app.__e = { ...estudiante, estado: "mora", moraMonto: 110, moraConcepto: "Julio y agosto" };
  assert.equal(f("deudaManual(__e)"), 110);
  assert.equal(f("deudaManual({estado:'alsaldo', moraMonto:50})"), 0);
  const texto = f("conceptoDeE(__e)");
  assert.match(texto, /Julio y agosto/);
});
