// Recibo «2 por hoja»: solo si se marca en el recibo. Sale el original y la copia en una sola hoja carta, con una
// línea para cortar, y cada equipo recuerda la elección.
//
// Uso: node --test tests/e2e/recibo-doble.test.js
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { abrirNavegador } = require("./entorno");

let nav, s;
const llamar = (codigo) => s.pagina.evaluate(codigo);
const imprimir = async () => {
  await s.pagina.click(".modal-actions .btn-print");
  return llamar(`window.__IMPRESIONES__.at(-1).html`);
};
const veces = (html, texto) => html.split(texto).length - 1;
// Cuántas hojas ocupa el documento al imprimirlo (en carta, como lo pide el recibo doble)
async function hojas(html) {
  const p = await s.contexto.newPage();
  await p.setContent(html);
  const pdf = (await p.pdf({ format: "Letter", preferCSSPageSize: true })).toString("latin1");
  await p.close();
  return (pdf.match(/\/Type\s*\/Page(?!s)/g) || []).length;
}

before(async () => {
  nav = await abrirNavegador();
  s = await nav.nuevaPagina();
  await s.pagina.goto(nav.base);
  await s.pagina.waitForSelector("#l-email");
  await s.pagina.fill("#l-email", "herrerajoicer@gmail.com");
  await s.pagina.fill("#l-pwd", "prueba123");
  await s.pagina.click("#login-btn");
  await s.pagina.waitForSelector(".tabs .tab");
  await llamar(`abrirModal({ tipo: "recibo", pago: pagos[0] })`);
  await s.pagina.waitForSelector("#recibo-doble");
});
after(async () => nav && nav.cerrar());

test("sin marcar, el recibo sale solo una vez, como siempre", async () => {
  assert.equal(await s.pagina.isChecked("#recibo-doble"), false);
  const html = await imprimir();
  assert.equal(veces(html, "Recibo de Pago"), 1);
  assert.doesNotMatch(html, /ORIGINAL|COPIA|CORTAR/);
  assert.equal(veces(html, "Firma Representante"), 1);
});

test("marcado: original y copia en una sola hoja carta, con la línea para cortar", async () => {
  await s.pagina.check("#recibo-doble");
  const html = await imprimir();
  const factura = await llamar(`pagos[0].factura`);
  assert.equal(veces(html, "Recibo de Pago"), 2);
  assert.equal(veces(html, factura), 3); // el título de la ventana y los dos recibos
  assert.equal(veces(html, "Firma Representante"), 2);
  assert.match(html, /ORIGINAL[\s\S]*✂ CORTAR AQUÍ[\s\S]*COPIA/);
  assert.match(html, /@page\{size:letter portrait/);
  assert.equal(await hojas(html), 1);
});

test("la elección se recuerda en este equipo, y se puede desmarcar", async () => {
  await llamar(`cerrarModal(); abrirModal({ tipo: "recibo", pago: pagos[1] || pagos[0] })`);
  assert.equal(await s.pagina.isChecked("#recibo-doble"), true);
  await s.pagina.uncheck("#recibo-doble");
  assert.equal(veces(await imprimir(), "Recibo de Pago"), 1);
  await llamar(`cerrarModal(); abrirModal({ tipo: "recibo", pago: pagos[0] })`);
  assert.equal(await s.pagina.isChecked("#recibo-doble"), false);
  assert.deepEqual(s.errores, []);
});
