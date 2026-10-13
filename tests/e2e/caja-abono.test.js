// Abonos en la Caja: se elige a qué mes va el abono (o para qué es el pago), el recibo lo dice y la deuda de ese mes
// baja.
//
// Uso: node --test tests/e2e/caja-abono.test.js
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { abrirNavegador } = require("./entorno");

let nav, s;
const llamar = (codigo) => s.pagina.evaluate(codigo);

before(async () => {
  nav = await abrirNavegador();
  s = await nav.nuevaPagina();
  await s.pagina.goto(nav.base);
  await s.pagina.waitForSelector("#l-email");
  await s.pagina.fill("#l-email", "josefajsanquez@gmail.com");
  await s.pagina.fill("#l-pwd", "prueba123");
  await s.pagina.click("#login-btn");
  await s.pagina.waitForSelector(".tabs .tab");
});
after(async () => nav && nav.cerrar());

// Abre la caja con Carlos Eduardo Díaz (est4: 55 $ al mes; pagó septiembre y debe octubre) sin nada marcado
async function abrirCaja() {
  await llamar(
    `tasas[todayStr()] = 184.5; setTab("caja"); cajaElegir("est4"); caja.sel = {}; cajaRefrescar(); cajaOtro(true)`
  );
}
const ultimoPago = () =>
  llamar(`JSON.parse(JSON.stringify(window.__ESCRITURAS__.filter((e) => e.ruta.startsWith("pagos/")).at(-1).datos))`);

test("al abonar a la mensualidad se elige el mes, y por defecto es el más antiguo que se debe", async () => {
  await abrirCaja();
  const opciones = await s.pagina.$$eval("#caja-otro-mes option", (os) => os.map((o) => o.textContent));
  assert.match(opciones[0], /^Octubre 2026 · debe \$ 55,00 \(vencida\)$/);
  assert.match(opciones[1], /^Noviembre 2026 · debe \$ 55,00$/);
  assert.equal(await s.pagina.inputValue("#caja-otro-mes"), "2026-10");
});

test("el abono a noviembre queda en el recibo y se descuenta de noviembre (octubre sigue debiéndose)", async () => {
  await abrirCaja();
  await s.pagina.selectOption("#caja-otro-mes", "2026-11");
  await llamar(`cajaOtroMonto("20"); cajaMetodo("Dólares Efectivo")`);
  await llamar(`cajaCobrar()`);
  await s.pagina.waitForSelector(".recibo-nums");
  const p = await ultimoPago();
  assert.equal(p.concepto, "Mensualidad");
  assert.equal(p.mes, "Noviembre");
  assert.deepEqual(p.cuotas, { "2026-11": 20 });
  assert.match(p.descripcion, /^Abono a la mensualidad de Noviembre 2026 — \$ 20,00$/);
  assert.match(await s.pagina.textContent(".modal"), /Abono a la mensualidad de Noviembre 2026/);
  const c = await llamar(`JSON.parse(JSON.stringify(calcCuotas(estudiantes.find((e) => e.id === "est4"))))`);
  const mes = (ym) => c.lista.find((q) => q.ym === ym);
  assert.equal(mes("2026-10").pendiente, 55);
  assert.equal(mes("2026-11").pendiente, 35);
});

test("si el abono completa el mes, el recibo dice «Mensualidad» de ese mes", async () => {
  await llamar(`cerrarModal()`);
  await abrirCaja();
  // noviembre ahora debe 35: aparece así en la lista
  assert.match(await s.pagina.textContent("#caja-otro-mes option[value='2026-11']"), /Noviembre 2026 · debe \$ 35,00/);
  await s.pagina.selectOption("#caja-otro-mes", "2026-11");
  await llamar(`cajaOtroMonto("35"); cajaMetodo("Dólares Efectivo"); cajaCobrar()`);
  await s.pagina.waitForSelector(".recibo-nums");
  assert.match((await ultimoPago()).descripcion, /^Mensualidad Noviembre 2026 — \$ 35,00$/);
});

test("se puede abonar a un mes que todavía no vence: 30 $ a diciembre dejan 25 $ pendientes de diciembre", async () => {
  await llamar(`cerrarModal()`);
  await abrirCaja();
  assert.match(
    await s.pagina.textContent("#caja-otro-mes option[value='2026-12']"),
    /^Diciembre 2026 · debe \$ 55,00$/
  );
  await s.pagina.selectOption("#caja-otro-mes", "2026-12");
  await llamar(`cajaOtroMonto("30"); cajaMetodo("Dólares Efectivo"); cajaCobrar()`);
  await s.pagina.waitForSelector(".recibo-nums");
  assert.match((await ultimoPago()).descripcion, /^Abono a la mensualidad de Diciembre 2026 — \$ 30,00$/);
  const c = await llamar(`JSON.parse(JSON.stringify(calcCuotas(estudiantes.find((e) => e.id === "est4"))))`);
  const dic = c.lista.find((q) => q.ym === "2026-12");
  assert.equal(dic.pagado, 30);
  assert.equal(dic.pendiente, 25);
  // y la próxima vez aparece así en la lista
  await llamar(`cerrarModal()`);
  await abrirCaja();
  assert.match(
    await s.pagina.textContent("#caja-otro-mes option[value='2026-12']"),
    /^Diciembre 2026 · debe \$ 25,00$/
  );
});

test("con el concepto «Otro» hay que escribir para qué es, y sale en el recibo", async () => {
  await llamar(`cerrarModal()`);
  await abrirCaja();
  await llamar(`cajaOtroConcepto("Otro"); cajaOtroMonto("10"); cajaMetodo("Dólares Efectivo")`);
  assert.match(await s.pagina.textContent("#caja-total"), /Escribe para qué es el pago/);
  await s.pagina.fill("#caja-otro-detalle", "Excursión al museo");
  await s.pagina.dispatchEvent("#caja-otro-detalle", "input");
  await llamar(`cajaCobrar()`);
  await s.pagina.waitForSelector(".recibo-nums");
  const p = await ultimoPago();
  assert.equal(p.concepto, "Otro");
  assert.match(p.descripcion, /^Excursión al museo — \$ 10,00$/);
  assert.deepEqual(s.errores, []);
});
