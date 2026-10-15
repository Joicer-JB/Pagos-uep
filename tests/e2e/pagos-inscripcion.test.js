// 💰 Pagos → Nuevo pago con concepto «Inscripción»: se marca qué se paga con la inscripción (los meses que se
// deban), el total y la descripción se llenan solos, se ve cómo se reparte el monto y se guarda como en la Caja.
//
// Uso: node --test tests/e2e/pagos-inscripcion.test.js
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { abrirNavegador } = require("./entorno");

let nav, s;
const llamar = (codigo) => s.pagina.evaluate(codigo);
const marcados = () =>
  llamar(
    `[...document.querySelectorAll("#p-ins-box input[type=checkbox]")].filter((x) => x.checked).map((x) => x.dataset.ym)`
  );

before(async () => {
  nav = await abrirNavegador();
  s = await nav.nuevaPagina();
  await s.pagina.goto(nav.base);
  await s.pagina.waitForSelector("#l-email");
  await s.pagina.fill("#l-email", "herrerajoicer@gmail.com");
  await s.pagina.fill("#l-pwd", "prueba123");
  await s.pagina.click("#login-btn");
  await s.pagina.waitForSelector(".tabs .tab");
  await llamar(`cobCfg = { ...cobCfg, costos: COSTOS_SUGERIDOS.costos, carnet: 13, papeleria: 3, inscripcionDesde: "2026-06-01" };
    tasas[todayStr()] = 184.5; setTab("pagos"); subTab.pagos = "nuevo"; renderTabContent(); seleccionarEstudiantePago("est6")`);
  await s.pagina.selectOption("#p-concepto", "Inscripción"); // Miguel Ángel Torres, 3er Grado: no ha pagado nada
});
after(async () => nav && nav.cerrar());

test("al elegir «Inscripción» aparece qué incluye, con septiembre ya marcado", async () => {
  const box = await s.pagina.textContent("#p-ins-box");
  assert.match(box, /¿Qué paga con la inscripción\?/);
  assert.match(box, /✓ Inscripción \$ 61,00/);
  assert.match(box, /Septiembre 2026 \$ 45,00/);
  assert.match(box, /Noviembre 2026 \$ 45,00 · adelanto/);
  assert.deepEqual(await marcados(), ["2026-09"]);
  assert.equal(await s.pagina.inputValue("#p-total"), "106");
  assert.match(
    await s.pagina.textContent("#p-ins-reparto"),
    /Así se aplica: Inscripción \$ 61,00 · Septiembre 2026 \$ 45,00/
  );
});

test("marcar octubre suma el mes al total, a la descripción y a la nota", async () => {
  await s.pagina.check('#p-ins-box input[data-ym="2026-10"]');
  assert.equal(await s.pagina.inputValue("#p-total"), "151");
  assert.match(await s.pagina.inputValue("#p-desc"), /\+ Septiembre \$ 45,00 \+ Octubre \$ 45,00\)$/);
  assert.match(
    await s.pagina.textContent("#p-ins-nota"),
    /= \$ 151,00\. Septiembre 2026, Octubre 2026 quedan pagados\./
  );
  assert.equal(await s.pagina.inputValue("#p-mes"), "Septiembre");
});

test("los meses van en orden: marcar uno marca los anteriores y desmarcarlo quita los siguientes", async () => {
  await s.pagina.check('#p-ins-box input[data-ym="2026-12"]');
  assert.deepEqual(await marcados(), ["2026-09", "2026-10", "2026-11", "2026-12"]);
  await s.pagina.uncheck('#p-ins-box input[data-ym="2026-11"]');
  assert.deepEqual(await marcados(), ["2026-09", "2026-10"]);
});

test("si se escribe otro monto, se ve cómo se reparte (abono al último mes o adelanto)", async () => {
  await s.pagina.fill("#p-total", "130");
  assert.match(
    await s.pagina.textContent("#p-ins-reparto"),
    /Inscripción \$ 61,00 · Septiembre 2026 \$ 45,00 · Abono a Octubre 2026 \$ 24,00/
  );
  await s.pagina.fill("#p-total", "40");
  assert.match(await s.pagina.textContent("#p-ins-reparto"), /Abono a la inscripción \$ 40,00 de \$ 61,00/);
  await s.pagina.fill("#p-total", "160");
  assert.match(await s.pagina.textContent("#p-ins-reparto"), /Octubre 2026 \$ 45,00 · Adelanto \$ 9,00/);
  await s.pagina.fill("#p-total", "151");
});

test("al guardar: inscripción y mensualidades con un solo recibo, y cada mes queda pagado", async () => {
  const antes = await llamar(`window.__ESCRITURAS__.length`);
  await llamar(`guardarPago()`);
  await s.pagina.waitForSelector(".recibo-nums");
  const nuevos = await llamar(
    `JSON.parse(JSON.stringify(window.__ESCRITURAS__.slice(${antes}).filter((e) => e.ruta.startsWith("pagos/")).map((e) => e.datos)))`
  );
  assert.deepEqual(
    nuevos.map((p) => [p.concepto, p.total, p.cuotas || null, p.mes]),
    [
      ["Inscripción", 61, null, ""],
      ["Mensualidad", 90, { "2026-09": 45, "2026-10": 45 }, "Septiembre"],
    ]
  );
  assert.equal(new Set(nuevos.map((p) => p.factura)).size, 1);
  assert.equal(Math.round((nuevos[0].totalBs + nuevos[1].totalBs) * 100), Math.round(151 * 184.5 * 100));
  const recibo = await s.pagina.textContent(".modal");
  assert.match(recibo, /Inscripción \+ Mensualidad/);
  assert.match(recibo, /Total referencia \(USD\)\s*\$ 151,00/);
  const c = await llamar(`JSON.parse(JSON.stringify(calcCuotas(estudiantes.find((e) => e.id === "est6"))))`);
  assert.equal(c.inscripcion.pendiente, 0);
  assert.deepEqual(
    c.lista.slice(0, 3).map((q) => q.pendiente),
    [0, 0, 45]
  );
  assert.deepEqual(s.errores, []);
});
