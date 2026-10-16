// Perdonar el recargo por mora de un mes (solo el director), con su motivo; se puede deshacer.
//
// Uso: node --test tests/e2e/recargo-perdon.test.js
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { abrirNavegador } = require("./entorno");

let nav;
const entrar = async (correo) => {
  const s = await nav.nuevaPagina();
  await s.pagina.goto(nav.base);
  await s.pagina.waitForSelector("#l-email");
  await s.pagina.fill("#l-email", correo);
  await s.pagina.fill("#l-pwd", "prueba123");
  await s.pagina.click("#login-btn");
  await s.pagina.waitForSelector(".tabs .tab");
  await s.pagina.evaluate(`cobCfg = { ...cobCfg, recargo: 5, recargoDesde: "" };
    abrirModal({ tipo: "ver-estudiante", id: "est6" })`); // septiembre y octubre vencidas: 2 recargos
  return s;
};
const recargo = (s) => s.pagina.evaluate(`calcCuotas(estudiantes.find((e) => e.id === "est6")).recargoPend`);

before(async () => {
  nav = await abrirNavegador();
});
after(async () => nav && nav.cerrar());

test("el director perdona el recargo de un mes con su motivo, y queda anotado", async () => {
  const s = await entrar("herrerajoicer@gmail.com");
  assert.equal(await recargo(s), 10);
  assert.equal(await s.pagina.locator(".modal .recargo-accion:has-text('Perdonar')").count(), 2);
  await s.pagina.evaluate(`perdonarRecargo("est6", "2026-09", "Hospitalizado en septiembre")`);
  await s.pagina.waitForSelector(".recargo-perdonado");
  assert.equal(await recargo(s), 5);
  assert.match(await s.pagina.textContent(".recargo-perdonado"), /Recargo perdonado: Hospitalizado en septiembre/);
  const guardado = await s.pagina.evaluate(
    `JSON.parse(JSON.stringify(__DATOS_FALSOS__.estudiantes.get("est6").recargosPerdonados))`
  );
  assert.equal(guardado["2026-09"].motivo, "Hospitalizado en septiembre");
  assert.equal(guardado["2026-09"].por, "herrerajoicer@gmail.com");
  // sin motivo no se perdona
  await s.pagina.evaluate(`perdonarRecargo("est6", "2026-10", "  ")`);
  assert.equal(await recargo(s), 5);
  // y se puede deshacer
  await s.pagina.evaluate(`quitarPerdonRecargo("est6", "2026-09")`);
  await s.pagina.waitForFunction(() => !document.querySelector(".recargo-perdonado"));
  assert.equal(await recargo(s), 10);
  assert.deepEqual(s.errores, []);
});

test("la administradora ve el recargo pero no puede perdonarlo", async () => {
  const s = await entrar("josefajsanquez@gmail.com");
  assert.match(await s.pagina.textContent(".modal"), /\+ recargo \$ 5,00/);
  assert.equal(await s.pagina.locator(".modal .recargo-accion").count(), 0);
  await s.pagina.evaluate(`perdonarRecargo("est6", "2026-09", "x")`);
  assert.equal(await recargo(s), 10);
  assert.match(s.dialogos.join("\n"), /Solo el director puede perdonar recargos/);
});
