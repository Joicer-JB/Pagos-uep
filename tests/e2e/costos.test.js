// Estructura de costos del año: inscripción y carnet + papelería obligatorios, por nivel; la Caja los marca solos.
//
// Uso: node --test tests/e2e/costos.test.js
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { abrirNavegador } = require("./entorno");

let nav, s;
const llamar = (codigo) => s.pagina.evaluate(codigo);
const escrituras = (prefijo) =>
  llamar(
    `JSON.parse(JSON.stringify(window.__ESCRITURAS__.filter((e) => e.ruta.startsWith(${JSON.stringify(prefijo)}))))`
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
});
after(async () => nav && nav.cerrar());

test("el director ve la estructura de costos ya llena con los montos de 2026-2027 y la guarda", async () => {
  await llamar(`setTab("cobranza")`);
  await s.pagina.click("summary:has-text('Cuotas del año')");
  assert.equal(await s.pagina.inputValue("#cc-ins-inicialCompleto"), "45");
  assert.equal(await s.pagina.inputValue("#cc-ins-inicialMedio"), "40");
  assert.equal(await s.pagina.inputValue("#cc-men-media"), "55");
  assert.equal(await s.pagina.inputValue("#cc-carnet"), "13");
  assert.equal(await s.pagina.inputValue("#cc-papeleria"), "3");
  await llamar(`guardarCobCfg()`);
  await s.pagina.waitForTimeout(200);
  const cfg = (await escrituras("config/cobranza")).at(-1).datos;
  assert.deepEqual(cfg.costos, {
    inicialCompleto: { inscripcion: 45, mensualidad: 45 },
    inicialMedio: { inscripcion: 40, mensualidad: 40 },
    primaria: { inscripcion: 45, mensualidad: 45 },
    media: { inscripcion: 55, mensualidad: 55 },
  });
  assert.equal(cfg.carnet, 13);
  assert.equal(cfg.papeleria, 3);
  assert.equal(cfg.inscripcionDesde, "2026-06-01");
});

test("al guardar, ofrece poner a cada estudiante la mensualidad de su nivel", async () => {
  // Los estudiantes cuya mensualidad no coincide con la de su nivel se actualizan (los diálogos se aceptan solos)
  const dialogo = s.dialogos.find((d) => /mensualidad distinta a la de su nivel/.test(d));
  const cambios = await escrituras("estudiantes/");
  if (dialogo) {
    assert.ok(cambios.length > 0);
    for (const c of cambios) assert.deepEqual(Object.keys(c.datos), ["mensualidad"]);
  }
  // después, todos los activos tienen la mensualidad de su plan
  assert.deepEqual(await llamar(`mensualidadesDistintas().length`), 0);
});

test("en Caja salen marcadas la inscripción del año y el carnet + papelería, junto con lo vencido", async () => {
  await llamar(`tasas[todayStr()] = 184.5; setTab("caja"); cajaElegir("est4")`); // 5to Año: 55 $
  const panel = await s.pagina.textContent("#caja-panel");
  assert.match(panel, /Inscripción 2026-2027/);
  assert.match(panel, /Carnet QR y papelería/);
  assert.match(panel, /Carnet QR \$ 13,00 \+ papelería \$ 3,00/);
  const marcados = await llamar(`Object.keys(caja.sel).sort()`);
  assert.deepEqual(marcados, ["i", "k", "m2026-10"]);
  assert.equal(await llamar(`cajaLineas().total`), 55 + 16 + 55);
});

test("un solo cobro guarda inscripción, carnet y mensualidad con el mismo recibo, y dejan de deberse", async () => {
  const antes = (await escrituras("pagos/")).length;
  await llamar(`cajaMetodo("Dólares Efectivo"); cajaCobrar()`);
  await s.pagina.waitForSelector(".recibo-nums");
  const nuevos = (await escrituras("pagos/")).slice(antes).map((e) => e.datos);
  assert.deepEqual(nuevos.map((p) => p.concepto).sort(), ["Carnet y papelería", "Inscripción", "Mensualidad"]);
  assert.equal(new Set(nuevos.map((p) => p.factura)).size, 1);
  assert.match(await s.pagina.textContent(".modal"), /Inscripción 2026-2027 — \$ 55,00/);
  const c = await llamar(`JSON.parse(JSON.stringify(calcCuotas(estudiantes.find((e) => e.id === "est4"))))`);
  assert.equal(c.inscripcion.pendiente, 0);
  assert.equal(c.carnet.pendiente, 0);
  await llamar(`cerrarModal(); cajaElegir("est4")`);
  assert.doesNotMatch(await s.pagina.textContent("#caja-panel"), /Inscripción 2026-2027/);
});

test("ficha: en inicial se elige el horario y la mensualidad se ajusta a la estructura", async () => {
  await llamar(`setTab("estudiantes"); abrirModal({ tipo: "nuevo-estudiante" })`);
  assert.equal(await s.pagina.isVisible("#e-horario"), false); // sin grado no aplica
  await s.pagina.selectOption("#e-grado", "Nivel I");
  assert.equal(await s.pagina.isVisible("#e-horario"), true);
  assert.equal(await s.pagina.inputValue("#e-mens"), "45");
  await s.pagina.selectOption("#e-horario", "medio");
  assert.equal(await s.pagina.inputValue("#e-mens"), "40");
  assert.match(await s.pagina.textContent("#e-mens-nota"), /mensualidad \$ 40,00 · inscripción \$ 40,00/);
  await s.pagina.selectOption("#e-grado", "3er Grado");
  assert.equal(await s.pagina.isVisible("#e-horario"), false);
  assert.deepEqual(s.errores, []);
});
