// Corregir la fecha de inicio del año escolar (si se escribió mal al iniciarlo): mueve también el fin del año
// anterior, y los pagos de esos días pasan al año correcto.
//
// Uso: node --test tests/e2e/anio-inicio.test.js
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { abrirNavegador } = require("./entorno");

let nav, s;
const llamar = (codigo) => s.pagina.evaluate(codigo);
const configAnio = () => llamar(`JSON.parse(JSON.stringify(__DATOS_FALSOS__.config.get("anioEscolar")))`);

before(async () => {
  nav = await abrirNavegador();
  s = await nav.nuevaPagina();
  await s.pagina.goto(nav.base);
  await s.pagina.waitForSelector("#l-email");
  await s.pagina.fill("#l-email", "herrerajoicer@gmail.com");
  await s.pagina.fill("#l-pwd", "prueba123");
  await s.pagina.click("#login-btn");
  await s.pagina.waitForSelector(".tabs .tab");
  // Un pago del 5 de septiembre: con el inicio mal puesto (15/09) queda en el año anterior
  await llamar(`__OTRO_EQUIPO__.escribir("pagos", "pagSep", { nombre: "Miguel Ángel Torres", estId: "est6",
    fecha: "2026-09-05", concepto: "Inscripción", total: 61, factura: "FAC-0000009",
    timestamp: { seconds: 1788580800, nanoseconds: 0 } })`);
  await llamar(`setTab("config"); subTab.config = "anio"; renderTabContent()`);
});
after(async () => nav && nav.cerrar());

test("rechaza fechas futuras o anteriores al inicio del año pasado", async () => {
  await s.pagina.click("summary:has-text('Corregir la fecha de inicio')");
  await s.pagina.fill("#ea-fix-inicio", "2025-09-01");
  await llamar(`corregirInicioAnio()`);
  assert.match(await s.pagina.textContent("#ea-fix-msg"), /Debe ser después del inicio de 2025-2026/);
  await s.pagina.fill("#ea-fix-inicio", "2026-12-01");
  await llamar(`corregirInicioAnio()`);
  assert.match(await s.pagina.textContent("#ea-fix-msg"), /no puede ser futura/);
  assert.equal((await configAnio()).actual.inicio, "2026-09-15");
});

test("corrige el inicio, cierra el año anterior el día antes y trae los pagos de esos días", async () => {
  assert.equal(await llamar(`pagos.some((p) => p.factura === "FAC-0000009")`), false); // aún en el año anterior
  await s.pagina.fill("#ea-fix-inicio", "2026-09-01");
  await llamar(`corregirInicioAnio()`);
  await s.pagina.waitForFunction(() => escCfg && escCfg.actual.inicio === "2026-09-01");
  const cfg = await configAnio();
  assert.equal(cfg.actual.inicio, "2026-09-01");
  assert.equal(cfg.actual.nombre, "2026-2027");
  assert.equal(cfg.anteriores.at(-1).fin, "2026-08-31");
  assert.equal(cfg.anteriores.at(-1).inicio, "2025-09-15"); // lo demás no cambia
  assert.match(s.dialogos.join("\n"), /¿Cambiar el inicio de 2026-2027 del 15\/09\/2026 al 01\/09\/2026\?/);
  assert.match(s.dialogos.join("\n"), /2025-2026 terminará el 31\/08\/2026/);
  await s.pagina.waitForFunction(() => pagos.some((p) => p.factura === "FAC-0000009"));
  assert.match(await s.pagina.textContent("#tab-content"), /Inició el\s*01\/09\/2026/);
  assert.deepEqual(s.errores, []);
});
