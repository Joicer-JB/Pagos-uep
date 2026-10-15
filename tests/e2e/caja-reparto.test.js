// Caja «¿Cuánto trae?»: el monto se reparte solo, en orden (inscripción → deuda anterior → vencidas → recargos →
// mes en curso); lo que no alcanza queda como abono y lo que sobra, como adelanto.
//
// Uso: node --test tests/e2e/caja-reparto.test.js
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { abrirNavegador } = require("./entorno");

let nav, s;
const llamar = (codigo) => s.pagina.evaluate(codigo);
const estado = () =>
  llamar(`JSON.parse(JSON.stringify({ sel: Object.keys(caja.sel).sort(), parcial: caja.parcial,
    otro: caja.otro && { concepto: caja.otro.concepto, monto: caja.otro.monto, ym: caja.otro.ym }, total: cajaLineas().total }))`);
const trae = async (monto) => {
  await s.pagina.click("#caja-trae-inp");
  await llamar(`cajaTrae(${JSON.stringify(monto)})`);
};

before(async () => {
  nav = await abrirNavegador();
  s = await nav.nuevaPagina();
  await s.pagina.goto(nav.base);
  await s.pagina.waitForSelector("#l-email");
  await s.pagina.fill("#l-email", "josefajsanquez@gmail.com");
  await s.pagina.fill("#l-pwd", "prueba123");
  await s.pagina.click("#login-btn");
  await s.pagina.waitForSelector(".tabs .tab");
  // Estructura de costos 2026-2027 guardada
  await llamar(`cobCfg = { ...cobCfg, costos: COSTOS_SUGERIDOS.costos, carnet: 13, papeleria: 3, inscripcionDesde: "2026-06-01" };
    tasas[todayStr()] = 184.5; setTab("caja")`);
});
after(async () => nav && nav.cerrar());

test("trae justo inscripción + septiembre + octubre: se marca todo, sin abonos", async () => {
  await llamar(`cajaElegir("est6")`); // 3er Grado (45 $), no ha pagado nada; septiembre y octubre vencidos
  await trae("151");
  assert.deepEqual(await estado(), { sel: ["i", "m2026-10"], parcial: null, otro: null, total: 151 });
});

test("trae menos: lo que no alcanza queda como abono a la inscripción (primero inscripción, luego septiembre)", async () => {
  await trae("80");
  const e = await estado();
  assert.deepEqual(e.sel, ["i"]);
  assert.deepEqual(e.parcial, { key: "i", monto: 80 });
  assert.equal(e.total, 80);
  const lineas = await llamar(`JSON.parse(JSON.stringify(cajaLineas().lineas))`);
  assert.deepEqual(
    lineas.map((l) => [l.concepto, l.monto, l.ym]),
    [
      ["Inscripción", 61, ""],
      ["Mensualidad", 19, "2026-09"],
    ]
  );
  assert.match(await s.pagina.textContent("#caja-items"), /abono \$ 80,00\s*de \$ 106,00/);
});

test("trae de más: cubre también el mes en curso y lo que sobra va como adelanto al siguiente", async () => {
  await trae("200"); // 106 + octubre 45 + noviembre 45 = 196; sobran 4 para diciembre
  const e = await estado();
  assert.deepEqual(e.sel, ["i", "m2026-10", "m2026-11"]);
  assert.deepEqual(e.otro, { concepto: "Mensualidad", monto: "4", ym: "2026-12" });
  assert.equal(e.total, 200);
});

test("la deuda anterior va justo después de la inscripción y antes que los meses", async () => {
  await llamar(`cajaElegir("est2")`); // 1er Año (55 $): debe 110 $ de deuda anterior y no ha pagado la inscripción
  await trae("176"); // 126 de inscripción + septiembre, y 50 para la deuda anterior
  const e = await estado();
  assert.deepEqual(e.sel, ["d", "i"]);
  assert.deepEqual(e.parcial, { key: "d", monto: 50 });
  const lineas = await llamar(`JSON.parse(JSON.stringify(cajaLineas().lineas))`);
  assert.match(lineas.find((l) => l.concepto === "Deuda anterior").desc, /^Abono a .* — \$ 50,00$/);
});

test("al cobrar un abono a la inscripción, el recibo lo dice y queda lo pendiente", async () => {
  await llamar(`cajaElegir("est6")`);
  await trae("80");
  await llamar(`cajaMetodo("Dólares Efectivo"); cajaCobrar()`);
  await s.pagina.waitForSelector(".recibo-nums");
  assert.match(await s.pagina.textContent(".modal"), /Abono a la inscripción 2026-2027 \(.*\) — \$ 80,00 de \$ 106,00/);
  const c = await llamar(`JSON.parse(JSON.stringify(calcCuotas(estudiantes.find((e) => e.id === "est6"))))`);
  assert.equal(c.inscripcion.pendiente, 0);
  assert.equal(c.lista[0].pendiente, 26); // a septiembre le faltan 26
});

test("marcar a mano deja de repartir el monto", async () => {
  await llamar(`cerrarModal(); cajaElegir("est6")`);
  await trae("30");
  await llamar(`cajaToggle("m2026-10")`);
  const e = await estado();
  assert.equal(await llamar(`caja.trae`), "");
  assert.equal(e.parcial, null);
  assert.deepEqual(s.errores, []);
});
