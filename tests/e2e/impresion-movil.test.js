// Imprimir en el teléfono: el documento se abre encima de la app (no en una ventana nueva sin salida), con
// «← Volver» e «🖨️ Imprimir»; el botón «atrás» del teléfono también lo cierra.
//
// Uso: node --test tests/e2e/impresion-movil.test.js
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { abrirNavegador } = require("./entorno");

let nav, s;
const llamar = (codigo) => s.pagina.evaluate(codigo);
const textoHoja = () => llamar(`document.querySelector(".impresion-hoja").shadowRoot.textContent`);

before(async () => {
  nav = await abrirNavegador();
  s = await nav.nuevaPagina({ movil: true });
  await s.pagina.goto(nav.base);
  await s.pagina.waitForSelector("#l-email");
  await s.pagina.fill("#l-email", "herrerajoicer@gmail.com");
  await s.pagina.fill("#l-pwd", "prueba123");
  await s.pagina.click("#login-btn");
  await s.pagina.waitForSelector(".tabs .tab");
  // window.print se cuenta en vez de abrir el diálogo de impresión
  await llamar(`window.__IMPRESO__ = 0; window.print = () => window.__IMPRESO__++`);
});
after(async () => nav && nav.cerrar());

test("en el teléfono el recibo se abre dentro de la app, no en una ventana nueva", async () => {
  assert.equal(await llamar(`imprimirEnPagina()`), true);
  await llamar(`abrirModal({ tipo: "recibo", pago: pagos[0] }); imprimirRecibo()`);
  await s.pagina.waitForSelector(".impresion-capa");
  assert.equal(await llamar(`window.__IMPRESIONES__.length`), 0, "no se abrió ninguna ventana");
  const texto = await textoHoja();
  assert.match(texto, /Recibo de Pago/);
  assert.match(texto, new RegExp(await llamar(`pagos[0].factura`)));
  assert.match(texto, /Firma Representante/);
  // los estilos del recibo no cambian los de la app
  assert.equal(await llamar(`getComputedStyle(document.body).maxWidth`), "none");
});

test("«🖨️ Imprimir» imprime solo el documento", async () => {
  await s.pagina.click(".impresion-barra >> text=Imprimir");
  await s.pagina.waitForFunction(() => window.__IMPRESO__ === 1);
  await s.pagina.emulateMedia({ media: "print" });
  assert.equal(await llamar(`getComputedStyle(document.getElementById("app")).display`), "none");
  assert.equal(await llamar(`getComputedStyle(document.querySelector(".impresion-barra")).display`), "none");
  assert.notEqual(await llamar(`getComputedStyle(document.querySelector(".impresion-hoja")).display`), "none");
  await s.pagina.emulateMedia({ media: "screen" });
});

test("«← Volver» regresa a la app tal como estaba", async () => {
  await s.pagina.click(".impresion-barra >> text=Volver");
  assert.equal(await s.pagina.$(".impresion-capa"), null);
  assert.equal(await s.pagina.isVisible(".tabs .tab"), true);
  assert.equal(await llamar(`modalActual && modalActual.tipo`), "recibo"); // el recibo en pantalla sigue abierto
});

test("el botón «atrás» del teléfono también cierra el documento (sin salir de la app)", async () => {
  await llamar(`imprimirRecibo()`);
  await s.pagina.waitForSelector(".impresion-capa");
  await s.pagina.goBack();
  await s.pagina.waitForFunction(() => !document.querySelector(".impresion-capa"));
  assert.equal(await s.pagina.isVisible(".tabs .tab"), true);
  assert.equal(new URL(s.pagina.url()).origin, new URL(nav.base).origin);
});

test("los documentos que se imprimen solos (cierre de caja, flujo de caja) también funcionan", async () => {
  await llamar(`cerrarModal(); window.__IMPRESO__ = 0; imprimirCierreCaja()`);
  await s.pagina.waitForFunction(() => window.__IMPRESO__ === 1);
  assert.match(await textoHoja(), /Cierre de caja/i);
  await s.pagina.click(".impresion-barra >> text=Volver");
  await llamar(`imprimirFlujoCaja(2026)`);
  await s.pagina.waitForFunction(() => window.__IMPRESO__ === 2);
  assert.match(await textoHoja(), /Flujo de Caja/);
  assert.match(await textoHoja(), /Administrador/);
  // la hoja horizontal del flujo de caja se mantiene
  assert.match(
    await llamar(`[...document.head.querySelectorAll("style")].map((x) => x.textContent).join("")`),
    /@page\s*\{\s*size:\s*landscape/
  );
  await s.pagina.click(".impresion-barra >> text=Volver");
  assert.deepEqual(s.errores, []);
});
