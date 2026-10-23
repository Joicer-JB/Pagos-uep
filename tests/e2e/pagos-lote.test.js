// 💰 Pagos → ⚡ Pagos viejos: registrar de una vez las inscripciones (o mensualidades) cobradas y no registradas.
// Cada estudiante marcado queda con su recibo correlativo, la fecha y la tasa BCV de ese día.
// Tasas de la semilla: 01/10 = 180,50 · 02/10 = 181,25 · 05/10 = 182,10 · 06/10 = 183,40.
//
// Uso: node --test tests/e2e/pagos-lote.test.js
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { abrirNavegador } = require("./entorno");

let nav, s;
const llamar = (c) => s.pagina.evaluate(c);
const fila = (id) => `.lote-fila[data-est="${id}"]`;
const pagosDe = (id) =>
  llamar(`[...__DATOS_FALSOS__.pagos.values()].filter((p) => p.estId === ${JSON.stringify(id)} && p.origen === "lote")
    .map((p) => JSON.parse(JSON.stringify(p)))`);

async function abrir() {
  await llamar(`setTab("pagos"); subTab.pagos = "lote"; renderTabContent()`);
  await s.pagina.waitForSelector(".lote-cabecera");
}
async function ponerFecha(f) {
  await s.pagina.fill("#lote-fecha", f);
  await s.pagina.dispatchEvent("#lote-fecha", "change");
}

before(async () => {
  nav = await abrirNavegador();
  s = await nav.nuevaPagina();
  await s.pagina.goto(nav.base);
  await s.pagina.waitForSelector("#l-email");
  await s.pagina.fill("#l-email", "josefajsanquez@gmail.com"); // la secretaria es quien suele ponerse al día
  await s.pagina.fill("#l-pwd", "prueba123");
  await s.pagina.click("#login-btn");
  await s.pagina.waitForSelector(".tabs .tab");
  await llamar(`cobCfg = { ...cobCfg, ...COSTOS_SUGERIDOS }`); // estructura de costos 2026-2027
  await abrir();
});
after(async () => nav && nav.cerrar());

test("en la lista de pagos la secretaria ve solo el recaudo de hoy; el director, el total", async () => {
  await llamar(`setTab("pagos"); subTab.pagos = "lista"; renderTabContent()`);
  const t = await s.pagina.textContent(".recaudo-box");
  assert.match(t, /Recaudo total de hoy · 07\/10\/2026/);
  assert.match(t, /\$ 0,00\s*0 recibos/); // en la semilla nadie pagó hoy
  const d = await nav.nuevaPagina();
  await d.pagina.goto(nav.base);
  await d.pagina.waitForSelector("#l-email");
  await d.pagina.fill("#l-email", "herrerajoicer@gmail.com");
  await d.pagina.fill("#l-pwd", "prueba123");
  await d.pagina.click("#login-btn");
  await d.pagina.waitForSelector(".tabs .tab");
  await d.pagina.evaluate(`setTab("pagos")`);
  assert.match(await d.pagina.textContent(".recaudo-box"), /Recaudo Total/);
  await abrir();
});

test("sale quién debe la inscripción, con lo que debe (inscripción + carnet + papelería + septiembre)", async () => {
  const t = await s.pagina.textContent(fila("est6")); // Miguel Ángel Torres, 3er Grado
  assert.match(t, /inscripción \$ 45,00 \+ carnet QR \$ 13,00 \+ papelería \$ 3,00 \+ Septiembre \$ 45,00/);
  assert.match(t, /\$ 106,00/);
  assert.equal(await s.pagina.locator(fila("est5")).count(), 0, "los retirados no salen");
});

test("se marcan varios; la fecha y la forma de pago pasan al siguiente; un abono menor se acepta", async () => {
  await ponerFecha("2026-10-02");
  assert.match(await s.pagina.textContent(".lote-cabecera"), /Tasa Bs\. 181,25/);
  await s.pagina.check(fila("est6") + " input[type=checkbox]");
  await s.pagina.check(fila("est2") + " input[type=checkbox]"); // Luis Alberto Gómez, 1er Año: 126 $
  // Luis pagó 70 por transferencia
  await s.pagina.selectOption(fila("est2") + " select", "Transferencia Bs");
  await s.pagina.fill(fila("est2") + " input[inputmode=decimal]", "70");
  await s.pagina.dispatchEvent(fila("est2") + " input[inputmode=decimal]", "change");
  await s.pagina.fill(fila("est2") + " input[inputmode=numeric]", "00123456");
  await s.pagina.dispatchEvent(fila("est2") + " input[inputmode=numeric]", "change");
  assert.match(await s.pagina.textContent("#lote-barra"), /2 marcados · \$ 176,00/);
  assert.equal(await s.pagina.inputValue("#lote-metodo"), "Transferencia Bs", "el siguiente sale con transferencia");
  // lo marcado queda guardado en el equipo por si se cierra la página
  const b = JSON.parse(await llamar(`localStorage.getItem("lotePagosBorrador")`));
  assert.deepEqual(Object.keys(b.marcados).sort(), ["est2", "est6"]);
});

test("al registrar, cada uno queda con su recibo, la fecha y la tasa de ese día", async () => {
  const antes = await llamar(`pagos.length`);
  await llamar(`registrarLote()`);
  await s.pagina.waitForSelector(".lote-resultado");
  assert.match(await s.pagina.textContent(".lote-resultado"), /2 pagos registrados/);
  const m = await pagosDe("est6");
  assert.deepEqual(m.map((p) => [p.concepto, p.total, p.mes || ""]).sort(), [
    ["Inscripción", 61, ""],
    ["Mensualidad", 45, "Septiembre"],
  ]);
  assert.equal(new Set(m.map((p) => p.factura)).size, 1, "un solo recibo");
  assert.ok(m.every((p) => p.fecha === "2026-10-02" && p.tasa === 181.25 && p.metodo === "Dólares Efectivo"));
  assert.equal(m.find((p) => p.concepto === "Mensualidad").cuotas["2026-09"], 45);
  assert.ok(m.every((p) => p.registradoPor === "josefajsanquez@gmail.com"));
  // Luis abonó 70: todo va a la inscripción (71), con su referencia
  const l = await pagosDe("est2");
  assert.equal(l.length, 1);
  assert.equal(l[0].concepto, "Inscripción");
  assert.equal(l[0].total, 70);
  assert.equal(l[0].referencia, "00123456");
  assert.equal(l[0].totalBs, Math.round(70 * 181.25 * 100) / 100);
  assert.notEqual(l[0].factura, m[0].factura);
  assert.equal(await llamar(`pagos.length`), antes + 3);
  // Miguel ya no debe la inscripción: sale de la lista; Luis sigue (le falta 1 $ y septiembre)
  assert.equal(await s.pagina.locator(fila("est6")).count(), 0);
  assert.match(await s.pagina.textContent(fila("est2")), /\$ 56,00/);
  assert.equal(await llamar(`localStorage.getItem("lotePagosBorrador")`), null);
  await llamar(`imprimirResultadoLote()`);
  assert.match(await llamar(`window.__IMPRESIONES__.at(-1).html`), /Pagos registrados/);
});

test("sin tasa de ese día, o con más de lo que debe, avisa y no registra nada", async () => {
  await s.pagina.check(fila("est2") + " input[type=checkbox]");
  await s.pagina.fill(fila("est2") + ' input[type="date"]', "2026-09-20");
  await s.pagina.dispatchEvent(fila("est2") + ' input[type="date"]', "change");
  const antes = await llamar(`window.__ESCRITURAS__.length`);
  await llamar(`registrarLote()`);
  assert.match(s.dialogos.at(-1), /Falta la tasa BCV de: 20\/09\/2026/);
  await s.pagina.fill(fila("est2") + ' input[type="date"]', "2026-10-05");
  await s.pagina.dispatchEvent(fila("est2") + ' input[type="date"]', "change");
  await s.pagina.fill(fila("est2") + " input[inputmode=decimal]", "500");
  await s.pagina.dispatchEvent(fila("est2") + " input[inputmode=decimal]", "change");
  await llamar(`registrarLote()`);
  assert.match(s.dialogos.at(-1), /más de lo que debe/);
  assert.equal(await llamar(`window.__ESCRITURAS__.length`), antes);
  await s.pagina.uncheck(fila("est2") + " input[type=checkbox]");
});

test("mensualidades: quién debe la de un mes, y se registra a ese mes", async () => {
  await s.pagina.click(".lote-cabecera >> text=📅 Mensualidad");
  await s.pagina.selectOption("#lote-ym", "2026-10");
  const t = await s.pagina.textContent("#lote-lista");
  assert.match(t, /Mensualidad Octubre 2026/);
  await s.pagina.check(fila("est6") + " input[type=checkbox]");
  await ponerFecha("2026-10-05");
  await s.pagina.fill(fila("est6") + ' input[type="date"]', "2026-10-05");
  await s.pagina.dispatchEvent(fila("est6") + ' input[type="date"]', "change");
  await llamar(`registrarLote()`);
  await s.pagina.waitForSelector(".lote-resultado");
  const oct = (await pagosDe("est6")).filter((p) => p.cuotas && p.cuotas["2026-10"]);
  assert.equal(oct.length, 1);
  assert.equal(oct[0].mes, "Octubre");
  assert.equal(await s.pagina.locator(fila("est6")).count(), 0);
  assert.deepEqual(s.errores, []);
});
