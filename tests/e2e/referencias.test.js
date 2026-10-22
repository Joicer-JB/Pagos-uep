// Referencias de transferencia repetidas: antes de cobrar con una referencia que ya está en otro recibo (cualquier
// día), la app pregunta; también en «Nuevo pago», que ahora guarda la referencia.
//
// Uso: node --test tests/e2e/referencias.test.js
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { abrirNavegador } = require("./entorno");

let nav, s;
const llamar = (codigo) => s.pagina.evaluate(codigo);
const cuantos = () => llamar(`pagos.length`);

before(async () => {
  nav = await abrirNavegador();
  s = await nav.nuevaPagina();
  await s.pagina.goto(nav.base);
  await s.pagina.waitForSelector("#l-email");
  await s.pagina.fill("#l-email", "josefajsanquez@gmail.com");
  await s.pagina.fill("#l-pwd", "prueba123");
  await s.pagina.click("#login-btn");
  await s.pagina.waitForSelector(".tabs .tab");
  await llamar(`tasas[todayStr()] = 184.5`);
});
after(async () => nav && nav.cerrar());

test("Caja: una referencia ya usada otro día (aunque se escriba completa) pide confirmar; si no, no cobra", async () => {
  await llamar(`setTab("caja"); cajaElegir("est4"); cajaMetodo("Transferencia Bs"); cajaRef("0000123456")`);
  const antes = await cuantos();
  await llamar(`window.confirm = (m) => { window.__PREGUNTA__ = m; return false; }`);
  await llamar(`cajaCobrar()`);
  const pregunta = await llamar(`window.__PREGUNTA__`);
  assert.match(pregunta, /La referencia 0000123456 ya se registró en:/);
  assert.match(pregunta, /FAC-0000002 · Ana María Pérez · 02\/10\/2026 · \$ 45,00/);
  assert.equal(await cuantos(), antes, "no se cobró");
});

test("Nuevo pago: guarda la referencia y también avisa si se repite", async () => {
  await llamar(
    `window.__PREGUNTA__ = ""; setTab("pagos"); subTab.pagos = "nuevo"; renderTabContent(); seleccionarEstudiantePago("est4")`
  );
  await s.pagina.selectOption("#p-concepto", "Otro");
  assert.equal(await s.pagina.isVisible("#p-ref"), false); // en efectivo no se pide
  await s.pagina.click("#m-tbs");
  await s.pagina.fill("#p-ref", "123456");
  await s.pagina.fill("#p-total", "10");
  const antes = await cuantos();
  await llamar(`guardarPago()`);
  assert.match(await llamar(`window.__PREGUNTA__`), /FAC-0000002/);
  assert.equal(await cuantos(), antes);
  // con una referencia nueva sí se guarda, con su referencia
  await s.pagina.fill("#p-ref", "987654321");
  await llamar(`window.__PREGUNTA__ = ""; guardarPago()`);
  await s.pagina.waitForFunction((n) => pagos.length > n, antes);
  const p = await llamar(`JSON.parse(JSON.stringify(pagos.find((x) => x.referencia === "987654321")))`);
  assert.equal(p.metodo, "Transferencia Bs");
  assert.match(p.descripcion, /Ref\. pago: 987654321/);
  assert.equal(await llamar(`window.__PREGUNTA__`), "");
  assert.deepEqual(s.errores, []);
});
