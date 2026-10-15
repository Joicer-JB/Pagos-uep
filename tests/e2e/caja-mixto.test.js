// Caja: pago mixto. El representante paga con dos o más formas (p. ej. una parte en $ y el resto por pago móvil):
// un solo recibo, y un pago por concepto y forma de pago para que el cierre de caja cuadre cada método.
//
// Uso: node --test tests/e2e/caja-mixto.test.js
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { abrirNavegador } = require("./entorno");

let nav, s;
const llamar = (codigo) => s.pagina.evaluate(codigo);
const formas = () => llamar(`JSON.parse(JSON.stringify(cajaFormas(cajaLineas().total, tasaHoyValor())))`);
const boton = () => s.pagina.textContent("#caja-total button");

before(async () => {
  nav = await abrirNavegador();
  s = await nav.nuevaPagina();
  await s.pagina.goto(nav.base);
  await s.pagina.waitForSelector("#l-email");
  await s.pagina.fill("#l-email", "josefajsanquez@gmail.com");
  await s.pagina.fill("#l-pwd", "prueba123");
  await s.pagina.click("#login-btn");
  await s.pagina.waitForSelector(".tabs .tab");
  await llamar(`cobCfg = { ...cobCfg, costos: COSTOS_SUGERIDOS.costos, carnet: 13, papeleria: 3, inscripcionDesde: "2026-06-01" };
    tasas[todayStr()] = 184.5; setTab("caja")`);
});
after(async () => nav && nav.cerrar());

test("una parte en $ y el resto por transferencia: el resto se calcula solo en Bs.", async () => {
  await llamar(`cajaElegir("est6")`); // 3er Grado: inscripción + septiembre (106) y octubre (45) = 151
  await s.pagina.click("text=Pago mixto");
  assert.equal(await s.pagina.inputValue("#caja-mx-met0"), "Dólares Efectivo");
  assert.equal(await s.pagina.inputValue("#caja-mx-met1"), "Transferencia Bs");
  assert.match(await boton(), /Escribe cuánto paga con 💵 \$ Efectivo/);
  await llamar(`cajaMixtoMonto(0, "50")`);
  assert.deepEqual(await formas(), [
    { metodo: "Dólares Efectivo", usd: 50, bs: null, ref: "" },
    { metodo: "Transferencia Bs", usd: 101, bs: 18634.5, ref: "" },
  ]);
  assert.match(await s.pagina.textContent(".caja-formas-total"), /el resto\s*Bs\. 18\.634,50 · \$ 101,00/);
  assert.match(await boton(), /Escribe la referencia de la transferencia/);
  await llamar(`cajaMixtoRef(1, "778899")`);
  assert.match(await boton(), /COBRAR \$ 151,00/);
});

test("al cobrar: un recibo, un pago por concepto y forma, y los Bs. de la transferencia exactos", async () => {
  const antes = await llamar(`window.__ESCRITURAS__.length`);
  await llamar(`cajaCobrar()`);
  await s.pagina.waitForSelector(".recibo-nums");
  const nuevos = await llamar(
    `JSON.parse(JSON.stringify(window.__ESCRITURAS__.slice(${antes}).filter((e) => e.ruta.startsWith("pagos/")).map((e) => e.datos)))`
  );
  assert.deepEqual(
    nuevos.map((p) => [p.concepto, p.metodo, p.total, p.totalBs, p.cuotas || null]),
    [
      ["Inscripción", "Dólares Efectivo", 50, 9225, null],
      ["Inscripción", "Transferencia Bs", 11, 2029.5, null],
      ["Mensualidad", "Transferencia Bs", 90, 16605, { "2026-09": 45, "2026-10": 45 }],
    ]
  );
  assert.equal(new Set(nuevos.map((p) => p.factura)).size, 1);
  assert.deepEqual(
    nuevos.map((p) => p.referencia || ""),
    ["", "778899", "778899"]
  );
  for (const p of nuevos)
    assert.deepEqual(p.formasPago, [
      { metodo: "Dólares Efectivo", monto: 50 },
      { metodo: "Transferencia Bs", monto: 101, montoBs: 18634.5, referencia: "778899" },
    ]);
  // El recibo: método «Mixto» y cómo se pagó
  const recibo = await s.pagina.textContent(".modal");
  assert.match(recibo, /MétodoMixto/);
  assert.match(recibo, /Pago mixto/);
  assert.match(recibo, /💵 \$ Efectivo\s*\$ 50,00/);
  assert.match(recibo, /Transferencia \/ Pago móvil\s*Ref\. 778899\s*Bs\. 18\.634,50 \(\$ 101,00\)/);
  assert.match(recibo, /Total referencia \(USD\)\s*\$ 151,00/);
  // y lo que debía quedó pagado
  const c = await llamar(`JSON.parse(JSON.stringify(calcCuotas(estudiantes.find((e) => e.id === "est6"))))`);
  assert.equal(c.inscripcion.pendiente, 0);
  assert.deepEqual(
    c.lista.slice(0, 2).map((q) => q.pendiente),
    [0, 0]
  );
});

test("el cierre de caja cuadra cada método por separado", async () => {
  await llamar(`cerrarModal(); caja.vista = "cierre"; caja.cierre = todayStr(); renderTabContent()`);
  const hoy = await llamar(
    `JSON.parse(JSON.stringify(totalesMetodo(pagos.filter((p) => p.fecha === todayStr() && p.estId === "est6"))))`
  );
  assert.equal(hoy["Dólares Efectivo"].usd, 50);
  assert.equal(hoy["Transferencia Bs"].usd, 101);
  assert.equal(hoy["Transferencia Bs"].bs, 18634.5);
  await llamar(`caja.vista = "cobro"; renderTabContent()`);
});

test("una forma en bolívares se escribe en Bs.; si las formas pasan del total, no deja cobrar", async () => {
  await llamar(
    `cajaElegir("est2"); cajaMixto(true); cajaMixtoMetodo(0, "Punto"); cajaMixtoMetodo(1, "Dólares Efectivo")`
  );
  assert.equal(await s.pagina.getAttribute("#caja-mx-m0", "data-pad-unit"), "Bs.");
  await llamar(`cajaMixtoMonto(0, "1845")`); // Bs. 1.845 = $ 10 a 184,5
  const [punto, resto] = await formas();
  assert.deepEqual(punto, { metodo: "Punto", usd: 10, bs: 1845, ref: "" });
  assert.equal(resto.metodo, "Dólares Efectivo");
  assert.equal(resto.usd, (await llamar(`cajaLineas().total`)) - 10);
  assert.match(await boton(), /COBRAR/); // la referencia del punto es opcional
  await llamar(`cajaMixtoMonto(0, "999999")`);
  assert.match(await boton(), /Las formas de pago pasan del total/);
  assert.equal(await s.pagina.isDisabled("#caja-total button"), true);
});

test("se puede agregar una tercera forma (antes del resto) y volver a un solo método", async () => {
  await llamar(`cajaMixtoMonto(0, "1845"); cajaMixtoAgregar()`);
  assert.deepEqual(await llamar(`caja.mixto.partes.map((p) => p.metodo)`), ["Punto", "Punto", "Dólares Efectivo"]);
  await llamar(`cajaMixtoMetodo(1, "Bs Efectivo"); cajaMixtoMonto(1, "922,50")`); // Bs. 922,50 = $ 5
  const f = await formas();
  assert.deepEqual(
    f.map((x) => x.usd),
    [10, 5, (await llamar(`cajaLineas().total`)) - 15]
  );
  await s.pagina.click("text=Un solo método");
  assert.equal(await llamar(`caja.mixto`), null);
  assert.match(await boton(), /Toca cómo paga/);
  assert.deepEqual(s.errores, []);
});
