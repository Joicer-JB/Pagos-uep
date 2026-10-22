// 📊 Reportes → Tablero financiero: índice de cobranza, cobranza por mes, antigüedad de la deuda, proyección y
// punto de equilibrio (los cálculos se prueban en tests/unidad/indicadores.test.js).
//
// Uso: node --test tests/e2e/tablero.test.js
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { abrirNavegador } = require("./entorno");

let nav, s;
const llamar = (codigo) => s.pagina.evaluate(codigo);
const texto = (sel) => s.pagina.textContent(sel);

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
    setTab("reportes")`);
});
after(async () => nav && nav.cerrar());

test("el tablero muestra los indicadores del año arriba de los reportes", async () => {
  const t = await llamar(`JSON.parse(JSON.stringify(indicadoresFinancieros()))`);
  const tab = await texto(".tablero-financiero");
  assert.match(tab, /Tablero financiero · 2026-2027/);
  assert.match(tab, new RegExp(Math.round(t.indice * 100) + " %\\s*📈 Índice de cobranza"));
  assert.match(tab, /Vencido sin cobrar/);
  // cada mes con lo cobrado de lo esperado
  const meses = await texto(".tablero-mes");
  assert.match(meses, /Inscripción/);
  assert.match(meses, /Septiembre 2026/);
  assert.match(meses, /Octubre 2026/);
  // la deuda por antigüedad suma lo vencido
  const deuda = await texto(".tablero-deuda");
  for (const x of ["1 a 30 días", "31 a 60 días", "61 a 90 días", "Más de 90 días"]) assert.match(deuda, new RegExp(x));
  assert.equal(Math.round(t.tramos.reduce((a, x) => a + x.monto, 0) * 100), Math.round(t.vencido * 100));
  assert.match(deuda, /Cobrar primero/);
  assert.match(await texto(".tablero-proyeccion"), /Si todos pagan todo el año/);
  const eq = await texto(".tablero-equilibrio");
  assert.match(eq, /Costos del mes/);
  assert.match(eq, /Mensualidades si todos pagan/);
  assert.deepEqual(s.errores, []);
});

test("sin cuotas configuradas, el tablero explica dónde configurarlas", async () => {
  await llamar(`window.__cobCfg = cobCfg; cobCfg = null; renderTabContent()`);
  assert.match(await texto(".tablero-financiero"), /Cuotas del año/);
  await llamar(`cobCfg = window.__cobCfg; renderTabContent()`);
});

test("simulador de mensualidad: al cambiar el aumento se recalcula lo que entraría y la mensualidad de equilibrio", async () => {
  await llamar(`renderTabContent()`);
  const eq = await llamar(`JSON.parse(JSON.stringify(indicadoresFinancieros().equilibrio))`);
  await s.pagina.fill("#sim-cobranza", "100");
  await s.pagina.fill("#sim-aumento", "20");
  const r = await llamar(
    `JSON.parse(JSON.stringify(simularMensualidad(indicadoresFinancieros().equilibrio, simulador)))`
  );
  assert.equal(r.promedio, Math.round(eq.promedio * 1.2 * 100) / 100);
  const res = await texto("#sim-res");
  assert.ok(
    res.includes(
      "Nueva mensualidad promedioantes " + (await llamar(`fmt(${eq.promedio})`)) + (await llamar(`fmt(${r.promedio})`))
    ),
    res
  );
  assert.ok(res.includes(await llamar(`fmt(${r.cobrado})`)));
  assert.match(await texto(".sim-conclusion"), /(se cubren|no alcanza)/);
  await s.pagina.fill("#sim-retiro", "100"); // si se fueran todos
  assert.match(await texto("#sim-res"), /Estudiantes que pagarían0 de/);
  assert.deepEqual(s.errores, []);
});
