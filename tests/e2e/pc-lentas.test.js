// PC sencillas: listas largas por partes («Ver más»), Excel que se carga al usarlo y el modo liviano.
//
// Uso: node --test tests/e2e/pc-lentas.test.js
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const semilla = require("./datos/semilla");
const { abrirNavegador } = require("./entorno");

// 150 pagos más de Ana María: la lista de Pagos pasa de 150
const datos = JSON.parse(JSON.stringify(semilla));
for (let i = 1; i <= 150; i++)
  datos.colecciones.pagos["extra" + i] = {
    ...datos.colecciones.pagos.pag2,
    factura: "FAC-9" + String(i).padStart(6, "0"),
    timestamp: { seconds: 1790000000 + i, nanoseconds: 0 },
  };

let nav;
before(async () => (nav = await abrirNavegador({ datos })));
after(async () => nav && nav.cerrar());

async function entrar(s, correo) {
  await s.pagina.goto(nav.base);
  await s.pagina.waitForSelector("#l-email");
  await s.pagina.fill("#l-email", correo);
  await s.pagina.fill("#l-pwd", "prueba123");
  await s.pagina.click("#login-btn");
  await s.pagina.waitForSelector(".tabs .tab");
}
const filas = (s) => s.pagina.locator("#tab-content .list .list-item").count();

test("Pagos muestra los primeros 50; «Ver más» agrega de a 100 y el buscador busca en todos", async () => {
  const s = await nav.nuevaPagina();
  await entrar(s, "herrerajoicer@gmail.com");
  await s.pagina.evaluate(() => setTab("pagos"));
  const TOTAL = await s.pagina.evaluate(() => pagos.length); // los del año escolar que se ve
  assert.ok(TOTAL > 150);
  assert.equal(await filas(s), 50);
  assert.match(await s.pagina.locator(".ver-mas").textContent(), new RegExp(`Mostrando 50 de ${TOTAL}`));
  // el recaudo suma todos los pagos, no solo los que se ven
  const total = await s.pagina.evaluate(() => pagos.reduce((a, p) => a + p.total, 0));
  assert.match(await s.pagina.locator("#tab-content").textContent(), new RegExp(fmtRegex(total)));
  await s.pagina.click(".ver-mas button");
  assert.equal(await filas(s), 150);
  await s.pagina.click(".ver-mas button");
  assert.equal(await filas(s), TOTAL);
  assert.equal(await s.pagina.locator(".ver-mas").count(), 0);
  // un pago que al principio no se veía (de los más viejos) aparece al buscarlo
  await s.pagina.evaluate(() => setTab("pagos"));
  assert.equal(await filas(s), 50, "al volver a la pestaña se ven otra vez 50");
  await s.pagina.fill("#search-input", "FAC-0000003");
  await s.pagina.waitForFunction(() => document.querySelectorAll("#tab-content .list .list-item").length === 1);
  assert.match(await s.pagina.locator("#tab-content .list").textContent(), /Carlos Eduardo Díaz/);
  assert.deepEqual(s.errores, []);
  await s.contexto.close();
});
// $ 6.075,00 → texto buscable
function fmtRegex(n) {
  return n.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/\./g, "\\.");
}

test("Excel no se ejecuta al abrir la página: se carga la primera vez que se usa", async () => {
  const s = await nav.nuevaPagina();
  await entrar(s, "herrerajoicer@gmail.com");
  assert.equal(await s.pagina.evaluate(() => typeof XLSX), "undefined");
  assert.equal(await s.pagina.evaluate(() => typeof Chart), "undefined");
  await s.pagina.evaluate(() => Promise.all([cargarXLSX(), cargarXLSX()]));
  assert.equal(await s.pagina.evaluate(() => typeof XLSX.utils.book_new), "function");
  assert.deepEqual(s.errores, []);
  await s.contexto.close();
});

test("modo liviano: se activa en la entrada, quita el desenfoque y las animaciones, y se recuerda", async () => {
  const s = await nav.nuevaPagina();
  await s.pagina.goto(nav.base);
  await s.pagina.waitForSelector("#btn-modo-liviano");
  const clase = () => s.pagina.evaluate(() => document.documentElement.classList.contains("modo-liviano"));
  assert.equal(await clase(), false); // el equipo de pruebas no es «sencillo»
  await s.pagina.click("#btn-modo-liviano");
  assert.equal(await clase(), true);
  assert.equal(await s.pagina.locator("#ef-red").count(), 0, "sin el fondo animado");
  assert.equal(
    await s.pagina.evaluate(() => getComputedStyle(document.querySelector(".login-card")).backdropFilter),
    "none"
  );
  assert.equal(await s.pagina.evaluate(() => sinMovimiento()), true);
  await s.pagina.reload();
  await s.pagina.waitForSelector("#btn-modo-liviano");
  assert.equal(await clase(), true, "se recuerda en este equipo");
  await s.pagina.click("#btn-modo-liviano");
  assert.equal(await clase(), false);
  assert.deepEqual(s.errores, []);
  await s.contexto.close();
});

test("modo liviano automático en un equipo con poca memoria", async () => {
  const s = await nav.nuevaPagina();
  await s.pagina.addInitScript(() => Object.defineProperty(navigator, "deviceMemory", { get: () => 2 }));
  await s.pagina.goto(nav.base);
  await s.pagina.waitForSelector("#btn-modo-liviano");
  assert.equal(await s.pagina.evaluate(() => document.documentElement.classList.contains("modo-liviano")), true);
  await s.contexto.close();
});
