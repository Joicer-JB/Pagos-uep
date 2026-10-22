// Referencias de pago y conciliación bancaria (js/servicios/conciliacion.js)
const { test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { cargar } = require("./cargar");

const app = cargar(
  "js/config.js",
  "js/utils/formato.js",
  "js/utils/texto.js",
  "js/estado.js",
  "js/servicios/conciliacion.js"
);
const f = (codigo) => {
  const v = app.evaluar(codigo);
  return v && typeof v === "object" ? JSON.parse(JSON.stringify(v)) : v;
};
const poner = (nombre, valor) => {
  app.__valor = valor;
  app.evaluar(`${nombre} = __valor`);
};
const pago = (factura, ref, extra = {}) => ({
  factura,
  nombre: "Ana",
  fecha: "2026-10-02",
  metodo: "Transferencia Bs",
  referencia: ref,
  total: 45,
  totalBs: 8156.25,
  ...extra,
});

beforeEach(() => poner("pagos", []));

test("misma referencia: iguales, o la anotada son las últimas cifras de la del banco", () => {
  assert.equal(f(`mismaReferencia("123456", "123456")`), true);
  assert.equal(f(`mismaReferencia("000123456789", "456789")`), true);
  assert.equal(f(`mismaReferencia("REF-456789", "0004 5678 9")`), true);
  assert.equal(f(`mismaReferencia("000123456789", "6789")`), false); // 4 cifras no bastan para avisar
  assert.equal(f(`mismaReferencia("000123456789", "6789", 4)`), true); // para casar con el banco (con el monto)
  assert.equal(f(`mismaReferencia("123456", "123457")`), false);
  assert.equal(f(`mismaReferencia("", "123456")`), false);
});

test("recibos con esa referencia: uno por recibo, solo transferencias", () => {
  poner("pagos", [
    pago("FAC-1", "123456", { total: 30 }),
    pago("FAC-1", "123456", { total: 15 }), // mismo recibo (inscripción + mensualidad)
    pago("FAC-2", "999999"),
    pago("FAC-3", "123456", { metodo: "Punto" }), // los vouchers del punto se repiten
  ]);
  assert.deepEqual(f(`recibosConReferencia("000123456")`), [
    { factura: "FAC-1", nombre: "Ana", fecha: "2026-10-02", total: 45 },
  ]);
  assert.deepEqual(f(`recibosConReferencia("123456", "FAC-1")`), []);
  assert.deepEqual(f(`recibosConReferencia("555555")`), []);
});

test("referencias repetidas entre recibos distintos", () => {
  poner("pagos", [
    pago("FAC-1", "123456"),
    pago("FAC-1", "123456"),
    pago("FAC-2", "99123456"),
    pago("FAC-3", "777777"),
  ]);
  const r = f(`referenciasRepetidas()`);
  assert.equal(r.length, 1);
  assert.deepEqual(
    r[0].recibos.map((x) => [x.factura, x.total]),
    [
      ["FAC-1", 90],
      ["FAC-2", 45],
    ]
  );
});
