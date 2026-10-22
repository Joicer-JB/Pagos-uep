// 💰 Finanzas → 📒 Libro de ingresos y egresos: el mes en orden de fecha con el saldo, por categoría, y el Excel
// para el contador.
//
// Uso: node --test tests/e2e/libro.test.js
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const XLSX = require("xlsx");
const { abrirNavegador } = require("./entorno");

let nav, s;
const llamar = (codigo) => s.pagina.evaluate(codigo);

before(async () => {
  nav = await abrirNavegador();
  s = await nav.nuevaPagina();
  await s.pagina.goto(nav.base);
  await s.pagina.waitForSelector("#l-email");
  await s.pagina.fill("#l-email", "herrerajoicer@gmail.com");
  await s.pagina.fill("#l-pwd", "prueba123");
  await s.pagina.click("#login-btn");
  await s.pagina.waitForSelector(".tabs .tab");
  await llamar(
    `filtros.mes = "Octubre"; filtros.anio = "2026"; setTab("finanzas"); subTab.finanzas = "libro"; renderTabContent()`
  );
  await s.pagina.waitForSelector(".libro-tabla");
});
after(async () => nav && nav.cerrar());

test("el libro del mes muestra los totales y cada movimiento con su documento y saldo", async () => {
  const L = await llamar(`JSON.parse(JSON.stringify(libroIngresosEgresos("2026-10-01", "2026-10-31")))`);
  assert.ok(L.filas.length >= 2, "hay movimientos en octubre");
  const totales = await s.pagina.textContent(".libro-totales");
  assert.ok(totales.includes(await llamar(`fmt(${L.ingresos})`)));
  assert.ok(totales.includes(await llamar(`fmt(${L.egresos})`)));
  const tabla = await s.pagina.textContent(".libro-tabla");
  assert.match(tabla, /FAC-0000002/);
  assert.match(tabla, /NOM-/); // el pago de nómina con su número de recibo
  // el saldo del último renglón es el resultado del mes
  assert.equal(L.filas.at(-1).saldo, L.neto);
});

test("se descarga en Excel con el libro y el resumen", async () => {
  const [descarga] = await Promise.all([s.pagina.waitForEvent("download"), s.pagina.click("text=📥 Excel")]);
  assert.equal(descarga.suggestedFilename(), "libro_ingresos_egresos_2026-10.xlsx");
  const wb = XLSX.readFile(await descarga.path());
  assert.deepEqual(wb.SheetNames, ["Libro", "Resumen"]);
  const filas = XLSX.utils.sheet_to_json(wb.Sheets.Libro, { header: 1 });
  assert.match(filas[0][0], /Libro de ingresos y egresos · Octubre 2026/);
  assert.equal(filas[2][0], "Fecha");
  assert.ok(filas.some((f) => f[1] === "FAC-0000002" && f[7] === 45));
  const tot = filas.find((f) => f[4] === "TOTALES");
  const L = await llamar(`libroIngresosEgresos("2026-10-01", "2026-10-31")`);
  assert.deepEqual([tot[7], tot[8], tot[12]], [L.ingresos, L.egresos, L.neto]);
  // y del año completo
  await s.pagina.check("#libro-anual");
  const [d2] = await Promise.all([s.pagina.waitForEvent("download"), s.pagina.click("text=📥 Excel")]);
  assert.equal(d2.suggestedFilename(), "libro_ingresos_egresos_2026.xlsx");
  await s.pagina.click("text=🖨️ Imprimir");
  assert.match(await llamar(`window.__IMPRESIONES__.at(-1).html`), /Libro de ingresos y egresos · Año 2026/);
  assert.deepEqual(s.errores, []);
});
