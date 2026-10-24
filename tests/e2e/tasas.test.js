// Pagos con fecha pasada y tasa BCV, en el navegador con el Firebase falso.
// Tasas de la semilla: 01/10 = 180,50 · 02/10 = 181,25 · 05/10 = 182,10 · 06/10 = 183,40. Año escolar desde el 15/09/2026.
//
// Uso: node --test tests/e2e/tasas.test.js
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { abrirNavegador } = require("./entorno");

let nav, sesion;
const pagina = () => sesion.pagina;
const llamar = (codigo) => pagina().evaluate(codigo);
const valor = (id) => pagina().inputValue("#" + id);
const nota = () => pagina().textContent("#p-tasa-nota");
const tasaGuardada = (fecha) =>
  llamar(`(__DATOS_FALSOS__.config.get("tasasBCV").tasas || {})[${JSON.stringify(fecha)}] || null`);

// Abre «Nuevo pago» con Carlos Eduardo Díaz (est4) elegido
async function nuevoPago() {
  await llamar(`setTab("pagos"); subTab.pagos = "nuevo"; renderTabContent(); seleccionarEstudiantePago("est4")`);
}
async function ponerFecha(fecha) {
  await pagina().fill("#p-fecha", fecha);
  await pagina().dispatchEvent("#p-fecha", "change");
}
async function escribirTasa(t) {
  await pagina().fill("#p-tasa", "");
  await pagina().type("#p-tasa", t);
}
// Guarda el pago y devuelve la escritura en «pagos» (o null si no guardó)
async function guardar(total = "45") {
  await pagina().fill("#p-total", total);
  const antes = await llamar(`window.__ESCRITURAS__.length`);
  await llamar(`guardarPago()`);
  await pagina().waitForTimeout(150);
  const nuevas = await llamar(`window.__ESCRITURAS__.slice(${antes})`);
  const p = nuevas.find((e) => e.ruta.startsWith("pagos/"));
  return p ? p.datos : null;
}

before(async () => {
  nav = await abrirNavegador();
  sesion = await nav.nuevaPagina();
  await pagina().goto(nav.base);
  await pagina().waitForSelector("#l-email");
  await pagina().fill("#l-email", "herrerajoicer@gmail.com"); // el director: el único que corrige tasas guardadas
  await pagina().fill("#l-pwd", "prueba123");
  await pagina().click("#login-btn");
  await pagina().waitForSelector(".tabs .tab");
});
after(async () => nav && nav.cerrar());

test("al elegir una fecha pasada se carga la tasa guardada de ese día", async () => {
  await nuevoPago();
  await ponerFecha("2026-10-02");
  assert.equal(await valor("p-tasa"), "181,25");
  assert.match(await nota(), /Tasa BCV guardada del 02\/10\/2026/);
});

test("un día sin tasa (fin de semana) usa la del último día con tasa y avisa", async () => {
  await ponerFecha("2026-10-04"); // domingo
  assert.equal(await valor("p-tasa"), "181,25");
  assert.match(await nota(), /No hay tasa de ese día: se usa la del 02\/10\/2026/);
});

test("una fecha sin ninguna tasa cercana deja el campo vacío para escribirla", async () => {
  await ponerFecha("2026-07-15");
  assert.equal(await valor("p-tasa"), "");
  assert.match(await nota(), /No hay tasa guardada de esa fecha/);
});

test("si se escribe otra tasa, el pago la usa y la guardada del día no cambia (si no se marca corregir)", async () => {
  await nuevoPago();
  await ponerFecha("2026-10-02");
  await escribirTasa("190");
  assert.match(await nota(), /Este registro usará 190,00\. La tasa guardada del 02\/10\/2026 es 181,25/);
  assert.equal(await pagina().isVisible("#p-tasa-corr"), true);
  const pago = await guardar();
  assert.equal(pago.tasa, 190);
  assert.equal(pago.totalBs, 8550);
  assert.equal(pago.fecha, "2026-10-02");
  assert.equal(await tasaGuardada("2026-10-02"), 181.25);
});

test("marcando «Corregir también la tasa guardada», se corrige para todos", async () => {
  await llamar(`cerrarModal()`);
  await nuevoPago();
  await ponerFecha("2026-10-02");
  await escribirTasa("181,3");
  await pagina().check("#p-tasa-corregir");
  const pago = await guardar();
  assert.equal(pago.tasa, 181.3);
  assert.equal(await tasaGuardada("2026-10-02"), 181.3);
  assert.equal(await llamar(`tasas["2026-10-02"]`), 181.3);
});

test("una fecha del año escolar anterior pide confirmación; la tasa escrita queda guardada para ese día", async () => {
  await llamar(`cerrarModal()`);
  await nuevoPago();
  await ponerFecha("2026-07-15");
  await escribirTasa("120,5");
  sesion.dialogos.length = 0;
  const pago = await guardar();
  assert.match(sesion.dialogos[0], /anterior al inicio del año escolar actual \(15\/09\/2026\)/);
  assert.equal(pago.fecha, "2026-07-15");
  assert.equal(await tasaGuardada("2026-07-15"), 120.5);
});

test("no se aceptan fechas futuras", async () => {
  await llamar(`cerrarModal()`);
  await nuevoPago();
  assert.equal(await pagina().getAttribute("#p-fecha", "max"), "2026-10-07");
  await ponerFecha("2026-12-01");
  await escribirTasa("200");
  assert.equal(await guardar(), null);
  assert.match(await pagina().textContent("#p-err"), /La fecha no puede ser futura/);
  assert.deepEqual(sesion.errores, []);
});

test("la tasa cuenta solo con 2 decimales: 883,6923 se guarda y se usa como 883,69", async () => {
  await llamar(`cerrarModal()`);
  await nuevoPago();
  await ponerFecha("2026-08-20");
  await escribirTasa("883,6923");
  const pago = await guardar("10");
  assert.equal(pago.tasa, 883.69);
  assert.equal(pago.totalBs, 8836.9);
  assert.equal(await tasaGuardada("2026-08-20"), 883.69);
  // En la ventana de la tasa BCV, igual
  await llamar(`cerrarModal(); abrirModal({ tipo: "tasa" })`);
  await pagina().fill("#tz-fecha", "2026-08-21");
  await pagina().fill("#tz-valor", "884,1299");
  await llamar(`guardarTasaModal()`);
  assert.equal(await tasaGuardada("2026-08-21"), 884.12);
  assert.deepEqual(sesion.errores, []);
});

// ---- Importar el Excel del BCV (una hoja por día), hecho aquí mismo con SheetJS
function excelBCV(dias) {
  const XLSX = require("xlsx");
  const libro = XLSX.utils.book_new();
  dias.forEach(([fechaValor, compra, venta]) => {
    const hoja = XLSX.utils.aoa_to_sheet([
      ["", "BANCO CENTRAL DE VENEZUELA"],
      ["", "Fecha Operación: 29/09/2026"],
      ["", `Fecha Valor: ${fechaValor}`],
      ["Moneda", "País", "Compra (Bs./M.E.)", "Venta (Bs./M.E.)", "Compra (M.E./US$)", "Venta (M.E./US$)"],
      ["EUR", "Unión Europea", 210.11, 210.55, 1.17, 1.17],
      ["USD", "E.U.A.", compra, venta, 1, 1],
    ]);
    XLSX.utils.book_append_sheet(libro, hoja, fechaValor.replace(/\//g, ""));
  });
  return {
    name: "2_1_2c26_smc.xls",
    mimeType: "application/vnd.ms-excel",
    buffer: XLSX.write(libro, { type: "buffer", bookType: "xls" }),
  };
}
async function subirExcel(archivo) {
  await llamar(`cerrarModal(); abrirModal({ tipo: "tasa" })`);
  await pagina().setInputFiles("#tz-archivo", archivo);
  await pagina().waitForSelector("#tz-import :text('Se encontraron')");
}

test("importar el Excel del BCV: muestra lo encontrado y guarda solo las tasas que faltan", async () => {
  const antes = await llamar(`window.__ESCRITURAS__.length`);
  await subirExcel(
    excelBCV([
      ["30/09/2026", 179.9, 180.1], // nueva
      ["01/10/2026", 180.3, 180.5], // igual a la guardada
      ["02/10/2026", 181.2, 181.4], // distinta a la guardada (181,3)
    ])
  );
  const resumen = (await pagina().textContent("#tz-import")).replace(/\s+/g, " ");
  assert.match(
    resumen,
    /Se encontraron 3 tasas \(del 30\/09\/2026 al 02\/10\/2026\): 1 nueva, 1 igual a las guardadas, 1 distinta/
  );
  assert.equal(await pagina().isVisible("#tz-reemplazar"), true);
  await pagina().click("text=Guardar tasas del archivo");
  await pagina().waitForSelector("#tz-msg:has-text('Se guardó 1 tasa')");
  assert.equal(await tasaGuardada("2026-09-30"), 180.1);
  assert.equal(await tasaGuardada("2026-10-02"), 181.3); // la distinta no se tocó
  const nuevas = await llamar(`window.__ESCRITURAS__.slice(${antes})`);
  assert.deepEqual(nuevas, [
    { op: "set-merge", ruta: "config/tasasBCV", datos: { tasas: { "2026-09-30": 180.1 }, actualizado: "2026-10-07" } },
  ]);
  // La tasa ya se usa en un pago con esa fecha
  await llamar(`cerrarModal()`);
  await nuevoPago();
  await ponerFecha("2026-09-30");
  assert.equal(await valor("p-tasa"), "180,1");
});

test("importar el Excel del BCV marcando «reemplazar» corrige también las distintas", async () => {
  await subirExcel(excelBCV([["02/10/2026", 181.2, 181.4]]));
  await pagina().check("#tz-reemplazar");
  await pagina().click("text=Guardar tasas del archivo");
  await pagina().waitForSelector("#tz-msg:has-text('Se guardó 1 tasa')");
  assert.equal(await tasaGuardada("2026-10-02"), 181.4);
  assert.equal(await llamar(`tasas["2026-10-02"]`), 181.4);
});

test("un archivo sin tasas avisa y no guarda nada", async () => {
  const XLSX = require("xlsx");
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    libro,
    XLSX.utils.aoa_to_sheet([
      ["Nombre", "Grado"],
      ["Ana", "1er Grado"],
    ]),
    "Lista"
  );
  const antes = await llamar(`window.__ESCRITURAS__.length`);
  await llamar(`cerrarModal(); abrirModal({ tipo: "tasa" })`);
  await pagina().setInputFiles("#tz-archivo", {
    name: "lista.xlsx",
    mimeType: "application/octet-stream",
    buffer: XLSX.write(libro, { type: "buffer", bookType: "xlsx" }),
  });
  await pagina().waitForSelector("#tz-import :text('No se encontraron tasas')");
  assert.equal(await llamar(`window.__ESCRITURAS__.length`), antes);
  assert.deepEqual(sesion.errores, []);
});

test("la administradora carga la tasa de un día que no la tiene, pero no corrige las ya guardadas", async () => {
  const otra = await nav.nuevaPagina();
  const p = otra.pagina,
    ev = (c) => p.evaluate(c);
  await p.goto(nav.base);
  await p.waitForSelector("#l-email");
  await p.fill("#l-email", "josefajsanquez@gmail.com");
  await p.fill("#l-pwd", "prueba123");
  await p.click("#login-btn");
  await p.waitForSelector(".tabs .tab");
  await ev(`setTab("pagos"); subTab.pagos = "nuevo"; renderTabContent(); seleccionarEstudiantePago("est4")`);
  await p.fill("#p-fecha", "2026-10-05");
  await p.dispatchEvent("#p-fecha", "change");
  assert.equal(await p.inputValue("#p-tasa"), "182,1");
  assert.equal(await p.locator("#p-tasa").getAttribute("readonly"), ""); // la guardada no se cambia
  await p.fill("#p-fecha", "2026-07-15");
  await p.dispatchEvent("#p-fecha", "change");
  assert.equal(await p.locator("#p-tasa").getAttribute("readonly"), null); // sin tasa: la escribe ella
  // en la ventana de la tasa: sin importar el Excel del BCV ni editar las de días anteriores
  await ev(`abrirModal({ tipo: "tasa" })`);
  assert.equal(await p.locator("#tz-archivo").count(), 0);
  await p.fill("#tz-valor", "185,5");
  await ev(`guardarTasaModal()`);
  await p.waitForTimeout(100);
  assert.equal(await ev(`(__DATOS_FALSOS__.config.get("tasasBCV").tasas || {})["2026-10-07"]`), 185.5);
  // ya cargada la de hoy: solo la ve
  await ev(`abrirModal({ tipo: "tasa" })`);
  assert.match(await p.textContent(".modal"), /solo él puede corregirla/);
  assert.equal(await p.locator("#tz-valor").count(), 0);
  // y aunque lo intente, no cambia una guardada
  assert.equal(await ev(`guardarTasaDia("2026-10-05", 150)`), false);
  assert.match(otra.dialogos.at(-1), /Solo el director puede corregirla/);
  assert.equal(await ev(`tasas["2026-10-05"]`), 182.1);
  assert.deepEqual(otra.errores, []);
});
