// Escape de HTML, teléfonos y textos (js/utils/texto.js)
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { cargar } = require("./cargar");

const app = cargar("js/utils/texto.js");
const f = (codigo) => app.evaluar(codigo);

test("escHtml: neutraliza < > \" ' &", () => {
  assert.equal(
    app.evaluar(`escHtml('<img src=x onerror="alert(1)">')`),
    "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;"
  );
  assert.equal(f(`escHtml("D'Angelo & Hijos")`), "D&#39;Angelo &amp; Hijos");
  assert.equal(f("escHtml(null)"), "");
  assert.equal(f("escHtml(undefined)"), "");
  assert.equal(f("escHtml(0)"), "0");
  assert.equal(f('escHtml("Ana María Pérez")'), "Ana María Pérez");
});

test("escJs: un texto dentro de onclick=\"f('…')\" vuelve intacto", () => {
  // Simula lo que hace el navegador: decodifica el HTML del atributo y luego evalúa el JavaScript
  const decodificarHtml = (s) =>
    s
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&");
  for (const original of [
    "D'Angelo",
    'Comillas "dobles"',
    "Barra \\ invertida",
    "Línea\nnueva",
    "<b>negrita</b> & más",
    "');alert(1);('",
  ]) {
    const atributo = app.evaluar("escJs")(original);
    assert.ok(!atributo.includes('"'), "no debe cerrar el atributo HTML");
    const js = "'" + decodificarHtml(atributo) + "'";
    assert.equal(eval(js), original);
  }
});

test("normalizarTelVE: acepta los formatos comunes de Venezuela", () => {
  for (const t of [
    "0412-1234567",
    "+58 412 123 4567",
    "58 0412 1234567",
    "0058 412 1234567",
    "4121234567",
    "(0412) 123.45.67",
  ]) {
    assert.equal(app.normalizarTelVE(t), "584121234567", t);
  }
  assert.equal(app.normalizarTelVE("0212-5551234"), "582125551234"); // fijo de Caracas
  assert.equal(app.normalizarTelVE("12345"), "");
  assert.equal(app.normalizarTelVE(""), "");
  assert.equal(app.normalizarTelVE(null), "");
});

test("fmtTelVE", () => {
  assert.equal(f('fmtTelVE("584121234567")'), "+58 412 123 4567");
  assert.equal(f('fmtTelVE("")'), "");
});

test("correoValido", () => {
  assert.equal(f('correoValido("carmen@example.com")'), true);
  assert.equal(f('correoValido("  carmen@gmail.com ")'), true);
  assert.equal(f('correoValido("carmen@gmail")'), false);
  assert.equal(f('correoValido("carmen gmail.com")'), false);
  assert.equal(f('correoValido("")'), false);
});

test("sinAcento y claveNombre: comparan nombres sin importar tildes ni mayúsculas", () => {
  assert.equal(f('sinAcento("Pérez Núñez")'), "Perez Nunez");
  assert.equal(f('claveNombre("  José   PÉREZ-López ")'), "jose perez lopez");
  assert.equal(f('claveNombre("Ana María") === claveNombre("ana maria")'), true);
});
