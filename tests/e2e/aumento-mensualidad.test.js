// 📈 Aumento de mensualidad desde un mes: desde noviembre todas las mensualidades suben 5 $; septiembre y octubre
// quedan con su precio (lo ya cobrado no cambia). Se configura en 🔔 Cobranza → Cuotas del año.
//
// Uso: node --test tests/e2e/aumento-mensualidad.test.js
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { abrirNavegador } = require("./entorno");

let nav, s;
const llamar = (c) => s.pagina.evaluate(c);
const ana = `estudiantes.find((e) => e.id === "est1")`; // mensualidad 45 en su ficha
const cuotas = () => llamar(`Object.fromEntries(calcCuotas(${ana}).lista.map((c) => [c.ym, c.monto]))`);
const guardado = () => llamar(`JSON.parse(JSON.stringify(__DATOS_FALSOS__.config.get("cobranza")))`);

before(async () => {
  nav = await abrirNavegador();
  s = await nav.nuevaPagina();
  await s.pagina.goto(nav.base);
  await s.pagina.waitForSelector("#l-email");
  await s.pagina.fill("#l-email", "herrerajoicer@gmail.com");
  await s.pagina.fill("#l-pwd", "prueba123");
  await s.pagina.click("#login-btn");
  await s.pagina.waitForSelector(".tabs .tab");
});
after(async () => nav && nav.cerrar());

test("el director agrega +5 $ desde noviembre: de noviembre en adelante sube, septiembre y octubre no", async () => {
  const antes = await cuotas();
  assert.equal(antes["2026-09"], 45);
  assert.equal(antes["2026-11"], 45);
  await llamar(`setTab("cobranza")`);
  await s.pagina.evaluate(() => (document.querySelector("#aumentos-mens").closest("details").open = true));
  // Por defecto propone el mes que viene (hoy es octubre)
  assert.equal(await s.pagina.inputValue("#au-desde"), "2026-11");
  await s.pagina.fill("#au-monto", "5");
  await llamar(`window.confirm = (m) => { window.__PREGUNTA__ = m; return true; }`);
  await s.pagina.click("#aumentos-mens .btn-success");
  await s.pagina.waitForFunction(() => (__DATOS_FALSOS__.config.get("cobranza").aumentos || []).length === 1);
  assert.match(await llamar(`window.__PREGUNTA__`), /Desde Noviembre 2026 la mensualidad de \d+ estudiante\(s\) sube/i);
  const a = (await guardado()).aumentos[0];
  assert.deepEqual([a.desde, a.monto, a.por], ["2026-11", 5, "herrerajoicer@gmail.com"]);
  assert.match(await s.pagina.textContent("#aumentos-mens"), /Desde Noviembre 2026: \+\$\s?5,00/i);
  const c = await cuotas();
  assert.deepEqual([c["2026-09"], c["2026-10"], c["2026-11"], c["2026-12"], c["2027-06"]], [45, 45, 50, 50, 50]);
  // En la ficha la mensualidad sigue siendo la del inicio del año, con el aviso del aumento
  assert.equal(await llamar(`${ana}.mensualidad`), 45);
  assert.match(await llamar(`notaMensualidadEst(${ana})`), /Aumento: \+\$\s?5,00 desde Noviembre 2026/i);
  assert.equal(await llamar(`mensualidadDe(${ana}, "2026-10")`), 45);
  assert.equal(await llamar(`mensualidadDe(${ana}, "2026-11")`), 50);
});

test("con media beca, el aumento también va a la mitad", async () => {
  assert.equal(await llamar(`mensualidadDe({ ...${ana}, beca: 50 }, "2026-11")`), 25);
  assert.equal(await llamar(`mensualidadDe({ ...${ana}, beca: 50 }, "2026-10")`), 22.5);
  assert.equal(await llamar(`mensualidadDe({ ...${ana}, mensualidad: 0 }, "2026-11")`), 0); // sin mensualidad, nada
});

test("guardar las cuotas del año no borra el aumento; quitarlo vuelve al precio de antes", async () => {
  // Al guardar las cuotas no se cambia la mensualidad de las fichas; quitar el aumento sí se confirma
  await llamar(`window.confirm = (m) => /Quitar el aumento/.test(m)`);
  await llamar(`guardarCobCfg()`);
  await s.pagina.waitForTimeout(200);
  assert.equal((await guardado()).aumentos.length, 1);
  await s.pagina.evaluate(() => (document.querySelector("#aumentos-mens").closest("details").open = true));
  await s.pagina.click("#aumentos-mens button:has-text('Quitar')");
  await s.pagina.waitForFunction(() => __DATOS_FALSOS__.config.get("cobranza").aumentos.length === 0);
  assert.equal((await cuotas())["2026-11"], 45);
  assert.deepEqual(s.errores, []);
});
