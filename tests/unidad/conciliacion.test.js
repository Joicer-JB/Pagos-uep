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

test("estado de cuenta: montos y fechas como los exportan los bancos", () => {
  for (const [v, n] of [
    [8302.5, 8302.5],
    ["8.302,50", 8302.5],
    ["8,302.50", 8302.5],
    ["Bs. 1.234.567,89", 1234567.89],
    ["45,5", 45.5],
    ["1.234", 1234],
    ["-500,00", -500],
    ["(500,00)", -500],
    ["", 0],
  ])
    assert.equal(f(`numeroBanco(${JSON.stringify(v)})`), n, String(v));
  assert.equal(f(`fechaBanco("07/10/2026")`), "2026-10-07");
  assert.equal(f(`fechaBanco("7-10-26")`), "2026-10-07");
  assert.equal(f(`fechaBanco("2026-10-07 10:30")`), "2026-10-07");
  assert.equal(f(`fechaBanco(46302)`), "2026-10-07"); // número de serie de Excel
  assert.equal(f(`fechaBanco(new Date(2026, 9, 7))`), "2026-10-07");
  assert.equal(f(`fechaBanco("Saldo inicial")`), "");
});

test("detecta la fila de títulos y las columnas del estado de cuenta", () => {
  const filas = [
    ["BANESCO BANCO UNIVERSAL"],
    ["Cuenta: 0134-0000-00-0000000000"],
    [],
    ["Fecha", "Referencia", "Descripción", "Débito", "Crédito", "Saldo"],
    ["07/10/2026", "000123456", "PAGO MOVIL DE 04141234567", "", "8.302,50", "10.000,00"],
  ];
  assert.deepEqual(f(`detectarColumnas(${JSON.stringify(filas)})`), {
    fila: 3,
    col: { fecha: 0, referencia: 1, descripcion: 2, debito: 3, credito: 4 },
  });
  assert.equal(f(`detectarColumnas([["hola", "chao"]])`), null);
});

test("movimientos: solo lo que entró, con la referencia (o la sacada de la descripción)", () => {
  const filas = [
    ["Fecha", "Concepto", "Monto"],
    ["07/10/2026", "TRANSF. RECIBIDA REF 778899001 DE ANA", "18.634,50"],
    ["07/10/2026", "PAGO DE SERVICIO", "-1.000,00"],
    ["Saldo final", "", "99"],
  ];
  const mapa = f(`detectarColumnas(${JSON.stringify(filas)})`);
  assert.deepEqual(f(`movimientosBanco(${JSON.stringify(filas)}, ${JSON.stringify(mapa)})`), [
    {
      fila: 2,
      fecha: "2026-10-07",
      referencia: "778899001",
      descripcion: "TRANSF. RECIBIDA REF 778899001 DE ANA",
      monto: 18634.5,
    },
  ]);
});

test("conciliar: por referencia y monto, por monto y fecha, monto distinto, sin registrar y no está en el banco", () => {
  poner("pagos", [
    pago("FAC-1", "123456", { fecha: "2026-10-05", totalBs: 8302.5 }), // casa por referencia (el banco la tiene completa)
    pago("FAC-2", "", { fecha: "2026-10-06", totalBs: 4000 }), // sin referencia: casa por monto y fecha
    pago("FAC-3", "555555", { fecha: "2026-10-06", totalBs: 9000 }), // el banco dice otro monto
    pago("FAC-4", "999999", { fecha: "2026-10-07", totalBs: 1500 }), // no está en el banco
    pago("FAC-5", "111111", { fecha: "2026-09-01", totalBs: 1500 }), // fuera del período: no cuenta
    // pago mixto: cada pago del recibo repite las formas; la transferencia se cuenta una sola vez
    pago("FAC-6", "", {
      metodo: "Dólares Efectivo",
      fecha: "2026-10-07",
      formasPago: [
        { metodo: "Dólares Efectivo", monto: 50 },
        { metodo: "Transferencia Bs", monto: 20, montoBs: 3690, referencia: "246810" },
      ],
    }),
    pago("FAC-6", "", {
      metodo: "Transferencia Bs",
      referencia: "246810",
      fecha: "2026-10-07",
      formasPago: [
        { metodo: "Dólares Efectivo", monto: 50 },
        { metodo: "Transferencia Bs", monto: 20, montoBs: 3690, referencia: "246810" },
      ],
    }),
  ]);
  const entradas = [
    { fila: 2, fecha: "2026-10-05", referencia: "000000123456", monto: 8302.5 },
    { fila: 3, fecha: "2026-10-07", referencia: "", monto: 4000 },
    { fila: 4, fecha: "2026-10-06", referencia: "555555", monto: 900 },
    { fila: 5, fecha: "2026-10-07", referencia: "13579246", monto: 2500 },
    { fila: 6, fecha: "2026-10-07", referencia: "0246810", monto: 3690 },
  ];
  const r = f(`conciliarBanco(${JSON.stringify(entradas)}, cobrosPorTransferencia())`);
  assert.deepEqual(
    r.conciliados.map((x) => x.cobro.factura),
    ["FAC-1", "FAC-6"]
  );
  assert.deepEqual(
    r.porMonto.map((x) => x.cobro.factura),
    ["FAC-2"]
  );
  assert.deepEqual(
    r.montoDistinto.map((x) => [x.cobro.factura, x.entrada.monto, x.cobro.bs]),
    [["FAC-3", 900, 9000]]
  );
  assert.deepEqual(
    r.sinRegistrar.map((e) => e.fila),
    [5]
  );
  assert.equal(r.totalSinRegistrar, 2500);
  assert.deepEqual(
    r.noEnBanco.map((c) => c.factura),
    ["FAC-4"]
  );
  assert.deepEqual([r.desde, r.hasta, r.entradas, r.totalBanco], ["2026-10-05", "2026-10-07", 5, 19392.5]);
});
