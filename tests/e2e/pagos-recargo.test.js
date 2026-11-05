// 💰 Pagos → Nuevo pago de una mensualidad que se paga tarde con el recargo incluido (45 $ + 5 $ = 50 $).
// Antes, los 5 $ se iban como abono a noviembre y el recargo seguía pendiente. Ahora, si ya pasó la fecha límite, el
// total sugerido es 45 + 5 = 50 y al guardar va «Mensualidad» 45 + «Recargo» 5 con un solo recibo.
//
// Uso: node --test tests/e2e/pagos-recargo.test.js
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { abrirNavegador } = require("./entorno");

let nav, s;
const llamar = (codigo) => s.pagina.evaluate(codigo);
// Miguel Ángel Torres (est6) no ha pagado nada; la fecha de las pruebas es el 07/10/2026 (octubre venció el 05/10)
const pagarOctubre = async (monto) => {
  await llamar(
    `cerrarModal(); setTab("pagos"); subTab.pagos = "nuevo"; renderTabContent(); seleccionarEstudiantePago("est6")`
  );
  await s.pagina.selectOption("#p-concepto", "Mensualidad");
  await s.pagina.selectOption("#p-mes", "Octubre");
  if (monto != null) await s.pagina.fill("#p-total", monto);
  const antes = await llamar(`window.__ESCRITURAS__.length`);
  await llamar(`guardarPago()`);
  await s.pagina.waitForSelector(".recibo-nums");
  return llamar(
    `JSON.parse(JSON.stringify(window.__ESCRITURAS__.slice(${antes}).filter((e) => e.ruta.startsWith("pagos/")).map((e) => e.datos)))`
  );
};
const cuenta = () => llamar(`JSON.parse(JSON.stringify(calcCuotas(estudiantes.find((e) => e.id === "est6"))))`);

before(async () => {
  nav = await abrirNavegador();
  s = await nav.nuevaPagina();
  await s.pagina.goto(nav.base);
  await s.pagina.waitForSelector("#l-email");
  await s.pagina.fill("#l-email", "herrerajoicer@gmail.com");
  await s.pagina.fill("#l-pwd", "prueba123");
  await s.pagina.click("#login-btn");
  await s.pagina.waitForSelector(".tabs .tab");
  await llamar(`cobCfg = { ...cobCfg, recargo: 5, recargoDesde: "" }; tasas[todayStr()] = 184.5`);
});
after(async () => nav && nav.cerrar());

test("recargoEnMensualidad: 50 $ para octubre pagado tarde = 45 de mensualidad + 5 de recargo", async () => {
  const r = await llamar(`recargoEnMensualidad(estudiantes.find((e) => e.id === "est6"), "2026-10", "2026-10-07", 50)`);
  assert.deepEqual(r, { mes: "Octubre 2026", mensualidad: 45, recargo: 5 });
  // justo lo de la mensualidad, o a tiempo, o sin recargo configurado: no hay nada que preguntar
  assert.equal(
    await llamar(`recargoEnMensualidad(estudiantes.find((e) => e.id === "est6"), "2026-10", "2026-10-07", 45)`),
    null
  );
  assert.equal(
    await llamar(`recargoEnMensualidad(estudiantes.find((e) => e.id === "est6"), "2026-10", "2026-10-04", 50)`),
    null
  );
  assert.equal(
    await llamar(`recargoEnMensualidad(estudiantes.find((e) => e.id === "est6"), "2026-12", "2026-10-07", 50)`),
    null
  );
  // con más de 5 $ de sobra, solo 5 son recargo (el recargo de ese mes)
  assert.deepEqual(
    await llamar(`recargoEnMensualidad(estudiantes.find((e) => e.id === "est6"), "2026-10", "2026-10-07", 60)`),
    { mes: "Octubre 2026", mensualidad: 45, recargo: 5 }
  );
});

test("al elegir un mes vencido, el total se llena solo con la mensualidad + el recargo", async () => {
  await llamar(`setTab("pagos"); subTab.pagos = "nuevo"; renderTabContent(); seleccionarEstudiantePago("est6")`);
  await s.pagina.selectOption("#p-concepto", "Mensualidad");
  await s.pagina.selectOption("#p-mes", "Octubre");
  assert.equal(await s.pagina.inputValue("#p-total"), "50");
  assert.match(
    await s.pagina.textContent("#p-mes-nota"),
    /Octubre 2026 venció el 05\/10\/2026: \$ 45,00 \+ recargo \$ 5,00 = \$ 50,00/
  );
  // un mes que todavía no vence: solo la mensualidad
  await s.pagina.selectOption("#p-mes", "Diciembre");
  assert.equal(await s.pagina.inputValue("#p-total"), "45");
  // con la fecha del pago antes del vencimiento, octubre no lleva recargo
  await s.pagina.selectOption("#p-mes", "Octubre");
  await s.pagina.fill("#p-fecha", "2026-10-04");
  await s.pagina.dispatchEvent("#p-fecha", "change");
  assert.equal(await s.pagina.inputValue("#p-total"), "45");
  // si se escribe otro monto a mano, no se cambia
  await s.pagina.fill("#p-total", "30");
  await s.pagina.selectOption("#p-mes", "Septiembre");
  assert.equal(await s.pagina.inputValue("#p-total"), "30");
  assert.deepEqual(s.errores, []);
});

test("al guardar 50 $ de octubre (tarde): Mensualidad 45 + Recargo 5 con un solo recibo, y noviembre queda en 0", async () => {
  const nuevos = await pagarOctubre(null);
  assert.equal(nuevos.length, 2);
  assert.deepEqual(
    nuevos.map((p) => [p.concepto, p.total, p.cuotas || null, p.mes]),
    [
      ["Mensualidad", 45, { "2026-10": 45 }, "Octubre"],
      ["Recargo", 5, null, "Octubre"],
    ]
  );
  assert.equal(new Set(nuevos.map((p) => p.factura)).size, 1);
  assert.equal(Math.round((nuevos[0].totalBs + nuevos[1].totalBs) * 100), Math.round(50 * 184.5 * 100));
  assert.match(await s.pagina.textContent(".modal"), /Mensualidad \+ Recargo/);
  const c = await cuenta();
  const oct = c.lista.find((q) => q.ym === "2026-10"),
    nov = c.lista.find((q) => q.ym === "2026-11");
  assert.equal(oct.pagado, 45);
  assert.equal(oct.recargo, 5);
  assert.equal(nov.pagado, 0, "noviembre no recibe ningún abono");
  assert.equal(c.recargoPagado, 5);
  assert.equal(c.aFavor, 0);
  assert.deepEqual(s.errores, []);
});

test("si trae más que mensualidad + recargo, solo lo que sobra abona al mes siguiente", async () => {
  // septiembre (venció el 05/09): 95 $ = 45 de septiembre + 5 de recargo + 45 que van a noviembre (octubre ya está pago)
  await llamar(
    `cerrarModal(); setTab("pagos"); subTab.pagos = "nuevo"; renderTabContent(); seleccionarEstudiantePago("est6")`
  );
  await s.pagina.selectOption("#p-concepto", "Mensualidad");
  await s.pagina.selectOption("#p-mes", "Septiembre");
  await s.pagina.fill("#p-total", "95");
  const antes = await llamar(`window.__ESCRITURAS__.length`);
  await llamar(`guardarPago()`);
  await s.pagina.waitForSelector(".recibo-nums");
  const nuevos = await llamar(
    `JSON.parse(JSON.stringify(window.__ESCRITURAS__.slice(${antes}).filter((e) => e.ruta.startsWith("pagos/")).map((e) => e.datos)))`
  );
  assert.deepEqual(
    nuevos.map((p) => [p.concepto, p.total, p.cuotas || null]),
    [
      ["Mensualidad", 90, { "2026-09": 90 }],
      ["Recargo", 5, null],
    ]
  );
  const c = await cuenta();
  assert.deepEqual(
    c.lista.slice(0, 3).map((q) => q.pagado),
    [45, 45, 45]
  );
  assert.equal(c.recargoTotal, 10);
  assert.equal(c.recargoPend, 0);
  assert.deepEqual(s.errores, []);
});
