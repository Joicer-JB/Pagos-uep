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

test("en Caja la inscripción es un solo renglón: inscripción + carnet + papelería + septiembre", async () => {
  await llamar(`tasas[todayStr()] = 184.5; setTab("caja"); cajaElegir("est6")`); // 3er Grado: 45 $, no ha pagado nada
  const panel = await s.pagina.textContent("#caja-panel");
  assert.match(panel, /Inscripción 2026-2027/);
  assert.match(panel, /inscripción \$ 45,00 \+ carnet QR \$ 13,00 \+ papelería \$ 3,00 \+ Septiembre \$ 45,00/);
  assert.doesNotMatch(panel, /Mensualidad Septiembre/); // septiembre va dentro de la inscripción
  assert.doesNotMatch(panel, /Carnet QR y papelería/); // no es un cobro aparte
  assert.deepEqual(await llamar(`Object.keys(caja.sel).sort()`), ["i", "m2026-10"]); // y octubre, que ya venció
  assert.equal(await llamar(`cajaLineas().total`), 106 + 45);
});

test("al cobrarla, la inscripción y septiembre quedan pagados, con un solo recibo y un solo renglón", async () => {
  const antes = (await escrituras("pagos/")).length;
  await llamar(`caja.sel = { i: true }; cajaRefrescar(); cajaMetodo("Dólares Efectivo"); cajaCobrar()`);
  await s.pagina.waitForSelector(".recibo-nums");
  const nuevos = (await escrituras("pagos/")).slice(antes).map((e) => e.datos);
  const por = Object.fromEntries(nuevos.map((p) => [p.concepto, p]));
  assert.deepEqual(Object.keys(por).sort(), ["Inscripción", "Mensualidad"]);
  assert.equal(por["Inscripción"].total, 61);
  assert.equal(por["Mensualidad"].total, 45);
  assert.deepEqual(por["Mensualidad"].cuotas, { "2026-09": 45 });
  assert.equal(new Set(nuevos.map((p) => p.factura)).size, 1);
  const recibo = await s.pagina.textContent(".modal");
  assert.match(
    recibo,
    /Inscripción 2026-2027 \(inscripción \$ 45,00 \+ carnet QR \$ 13,00 \+ papelería \$ 3,00 \+ Septiembre \$ 45,00\) — \$ 106,00/
  );
  assert.doesNotMatch(recibo, /Mensualidad Septiembre/);
  const c = await llamar(`JSON.parse(JSON.stringify(calcCuotas(estudiantes.find((e) => e.id === "est6"))))`);
  assert.equal(c.inscripcion.pendiente, 0);
  assert.equal(c.lista[0].pendiente, 0); // septiembre pagado
  await llamar(`cerrarModal(); cajaElegir("est6")`);
  const panel = await s.pagina.textContent("#caja-panel");
  assert.doesNotMatch(panel, /Inscripción 2026-2027/);
  assert.match(panel, /Mensualidad Octubre 2026/);
});

test("si septiembre ya estaba pagado, la inscripción va sola", async () => {
  await llamar(`cerrarModal(); cajaElegir("est4")`); // 5to Año: pagó septiembre, no la inscripción
  const panel = await s.pagina.textContent("#caja-panel");
  assert.match(panel, /inscripción \$ 55,00 \+ carnet QR \$ 13,00 \+ papelería \$ 3,00(?! \+)/);
  assert.equal(await llamar(`cajaItems(cajaEst()).items.find((i) => i.key === "i").monto`), 71);
});

test("en Pagos, el concepto «Inscripción» llena el paquete y septiembre queda pagado", async () => {
  await llamar(
    `cerrarModal(); setTab("pagos"); subTab.pagos = "nuevo"; renderTabContent(); seleccionarEstudiantePago("est3")`
  );
  await s.pagina.selectOption("#p-concepto", "Inscripción"); // Valentina Rojas, inicial tiempo completo
  assert.equal(await s.pagina.inputValue("#p-total"), "106");
  assert.equal(await s.pagina.inputValue("#p-mes"), "Septiembre");
  assert.match(await s.pagina.inputValue("#p-desc"), /^Inscripción 2026-2027 \(inscripción \$ 45,00 \+ carnet QR/);
  assert.match(await s.pagina.textContent("#p-ins-nota"), /= \$ 106,00\. Septiembre 2026 queda pagado/);
  await llamar(`guardarPago()`);
  await s.pagina.waitForSelector(".recibo-nums");
  const c = await llamar(`JSON.parse(JSON.stringify(calcCuotas(estudiantes.find((e) => e.id === "est3"))))`);
  assert.equal(c.inscripcion.pendiente, 0);
  assert.equal(c.lista[0].pendiente, 0); // septiembre pagado con lo que pasó de la inscripción
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
