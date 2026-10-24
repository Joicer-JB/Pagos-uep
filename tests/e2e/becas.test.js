// Becas (todo el año o media beca) y exonerar la mensualidad de un mes (solo el director, con su motivo).
//
// Uso: node --test tests/e2e/becas.test.js
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { abrirNavegador } = require("./entorno");

let nav, s;
const llamar = (c) => s.pagina.evaluate(c);
const est = (id) => `estudiantes.find((e) => e.id === "${id}")`;
const guardado = (id) => llamar(`JSON.parse(JSON.stringify(__DATOS_FALSOS__.estudiantes.get("${id}")))`);

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

test("becado todo el año: en su ficha, beca 100%; no debe mensualidades", async () => {
  // Miguel Ángel (3er Grado) debe septiembre y octubre
  assert.ok((await llamar(`calcCuotas(${est("est6")}).saldo`)) > 0);
  await llamar(`abrirModal({ tipo: "editar-estudiante", id: "est6" })`);
  await s.pagina.fill("#e-beca", "100");
  await s.pagina.fill("#e-beca-motivo", "Hijo del personal");
  await llamar(`guardarEstudiante("est6")`);
  await s.pagina.waitForFunction(() => !document.querySelector("#e-beca"));
  const g = await guardado("est6");
  assert.equal(g.beca, 100);
  assert.equal(g.becaMotivo, "Hijo del personal");
  assert.equal(await llamar(`calcCuotas(${est("est6")}).saldo`), 0);
  await llamar(`abrirModal({ tipo: "ver-estudiante", id: "est6" })`);
  const t = await s.pagina.textContent(".modal");
  assert.match(t, /Becado todo el año: no paga mensualidades · Hijo del personal/);
  assert.match(t, /🎓 Becado/);
  await llamar(`cerrarModal()`);
  // En la lista de estudiantes
  await llamar(`setTab("estudiantes")`);
  assert.match(await s.pagina.textContent(".list"), /\$ 0,00\/mes · 🎓 Becado/);
});

test("media beca: paga la mitad de cada mes", async () => {
  await llamar(`abrirModal({ tipo: "editar-estudiante", id: "est6" })`);
  await s.pagina.fill("#e-beca", "50");
  await llamar(`guardarEstudiante("est6")`);
  await s.pagina.waitForFunction(() => !document.querySelector("#e-beca"));
  const c = await llamar(`JSON.parse(JSON.stringify(calcCuotas(${est("est6")})))`);
  const base = await llamar(`${est("est6")}.mensualidad`);
  assert.equal(c.lista[0].monto, base / 2);
  await llamar(`abrirModal({ tipo: "ver-estudiante", id: "est6" })`);
  assert.match(await s.pagina.textContent(".modal"), /Beca del 50%: paga/);
  await llamar(`cerrarModal()`);
});

test("exonerar un mes: el director pone el motivo; ese mes no se cobra, y se puede deshacer", async () => {
  // Carlos Eduardo (5to Año), sin beca
  await llamar(`abrirModal({ tipo: "ver-estudiante", id: "est4" })`);
  const antes = await llamar(`calcCuotas(${est("est4")}).saldo`);
  assert.ok((await s.pagina.locator(".modal .recargo-accion:has-text('Exonerar este mes')").count()) > 0);
  await llamar(`exonerarMes("est4", "2026-10", "Ayuda por situación familiar")`);
  await s.pagina.waitForSelector(".mes-exonerado");
  assert.match(await s.pagina.textContent(".mes-exonerado"), /Ayuda por situación familiar/);
  const g = await guardado("est4");
  assert.equal(g.mesesExonerados["2026-10"].motivo, "Ayuda por situación familiar");
  assert.equal(g.mesesExonerados["2026-10"].por, "herrerajoicer@gmail.com");
  const mes = await llamar(
    `JSON.parse(JSON.stringify(calcCuotas(${est("est4")}).lista.find((q) => q.ym === "2026-10")))`
  );
  assert.equal(mes.monto, 0);
  assert.ok((await llamar(`calcCuotas(${est("est4")}).saldo`)) < antes);
  // Sin motivo no se exonera
  s.dialogos.length = 0;
  await llamar(`exonerarMes("est4", "2026-11", "  ")`);
  assert.match(s.dialogos[0], /Escribe el motivo/);
  // Deshacer
  await llamar(`quitarExoneracionMes("est4", "2026-10")`);
  await s.pagina.waitForFunction(() => !document.querySelector(".mes-exonerado"));
  assert.equal((await guardado("est4")).mesesExonerados["2026-10"], undefined);
  assert.equal(await llamar(`calcCuotas(${est("est4")}).saldo`), antes);
  assert.deepEqual(s.errores, []);
});

test("la secretaria no exonera ni ve el botón", async () => {
  const otra = await nav.nuevaPagina();
  await otra.pagina.goto(nav.base);
  await otra.pagina.waitForSelector("#l-email");
  await otra.pagina.fill("#l-email", "josefajsanquez@gmail.com");
  await otra.pagina.fill("#l-pwd", "prueba123");
  await otra.pagina.click("#login-btn");
  await otra.pagina.waitForSelector(".tabs .tab");
  assert.equal(await otra.pagina.evaluate(`htmlEstadoCuenta(${est("est4")}).includes("Exonerar")`), false);
  await otra.pagina.evaluate(`exonerarMes("est4", "2026-10", "x")`);
  assert.match(otra.dialogos.at(-1), /Solo el director/);
});
