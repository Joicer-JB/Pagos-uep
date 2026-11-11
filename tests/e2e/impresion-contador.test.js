// Lo que pidió el contador al imprimir: el recibo del representante solo en bolívares (ni $ ni tasa) y el flujo de
// caja detallado con el nombre y la cédula del representante de cada pago.
//
// Uso: node --test tests/e2e/impresion-contador.test.js
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { abrirNavegador } = require("./entorno");

let nav, s;
const llamar = (codigo) => s.pagina.evaluate(codigo);
const textoHoja = () => llamar(`document.querySelector(".impresion-hoja").shadowRoot.textContent`);
const volver = () => s.pagina.click(".impresion-barra >> text=Volver");

before(async () => {
  nav = await abrirNavegador();
  s = await nav.nuevaPagina({ movil: true });
  await s.pagina.goto(nav.base);
  await s.pagina.waitForSelector("#l-email");
  await s.pagina.fill("#l-email", "herrerajoicer@gmail.com");
  await s.pagina.fill("#l-pwd", "prueba123");
  await s.pagina.click("#login-btn");
  await s.pagina.waitForSelector(".tabs .tab");
  await llamar(`window.print = () => {}`);
});
after(async () => nav && nav.cerrar());

const imprimirPago = async (pago) => {
  await llamar(`abrirModal({ tipo: "recibo", pago: ${pago} }); imprimirRecibo()`);
  await s.pagina.waitForSelector(".impresion-capa");
  return textoHoja();
};

test("el recibo impreso va solo en bolívares: sin $, sin tasa y con el total en Bs.", async () => {
  const t = await imprimirPago(`pagos.find((p) => p.factura === "FAC-0000002")`);
  assert.match(t, /Total pagado\s*Bs\. 8\.156,25/);
  assert.doesNotMatch(t, /\$/);
  assert.doesNotMatch(t, /USD|Tasa BCV|referencia/i);
  await volver();
  // En pantalla el recibo sigue mostrando los dos
  assert.match(await s.pagina.textContent(".modal"), /Total referencia \(USD\)\s*\$ 45,00/);
  await llamar(`cerrarModal()`);
});

test("las líneas en $ del recibo, el pago mixto y el «Dólares Efectivo» se imprimen en Bs.", async () => {
  const t = await imprimirPago(`{ ...pagos.find((p) => p.factura === "FAC-0000002"), metodo: "Mixto",
    descripcion: "Mensualidad Septiembre — $ 40,00\\nRecargo — $ 5,00",
    formasPago: [{ metodo: "Dólares Efectivo", monto: 20 }, { metodo: "Transferencia Bs", monto: 25, montoBs: 4531.25, referencia: "9988" }] }`);
  assert.match(t, /Mensualidad Septiembre — Bs\. 7\.250,00/);
  assert.match(t, /Recargo — Bs\. 906,25/);
  assert.match(t, /Efectivo \(divisas\)\s*Bs\. 3\.625,00/);
  assert.match(t, /Transferencia \/ Pago móvil · Ref\. 9988\s*Bs\. 4\.531,25/);
  assert.doesNotMatch(t, /\$|Dólares/);
  await volver();
  await llamar(`cerrarModal()`);
});

test("el pago en dólares en efectivo también sale solo en Bs.", async () => {
  const t = await imprimirPago(`pagos.find((p) => p.factura === "FAC-0000001")`);
  assert.match(t, /Total pagado\s*Bs\. 10\.692,00/);
  assert.match(t, /Efectivo \(divisas\)/);
  assert.doesNotMatch(t, /\$|Dólares/);
  await volver();
  await llamar(`cerrarModal()`);
});

test("el recibo por WhatsApp también va solo en bolívares", async () => {
  await llamar(
    `window.__APERTURAS__ = []; abrirModal({ tipo: "recibo", pago: pagos.find((p) => p.factura === "FAC-0000002") }); enviarWhatsApp()`
  );
  const msg = decodeURIComponent(await llamar(`window.__APERTURAS__[0]`));
  assert.match(msg, /TOTAL PAGADO: Bs\. 8\.156,25/);
  assert.doesNotMatch(msg, /\$|Tasa BCV|TOTAL REF/);
  await llamar(`cerrarModal()`);
});

test("el flujo de caja trae el representante: en cada renglón del detallado y en una tabla del resumen", async () => {
  await llamar(`imprimirFlujoCaja(2026, 9, true)`);
  await s.pagina.waitForSelector(".impresion-capa");
  let t = await textoHoja();
  assert.match(t, /Representante/);
  assert.match(t, /Ana María Pérez - Mensualidad.*Carmen Pérez · V-12345678/s);
  assert.doesNotMatch(t, /Ingresos por representante/);
  await volver();
  await llamar(`imprimirFlujoCaja(2026, 9, false)`);
  t = await textoHoja();
  assert.match(t, /Ingresos por representante.*Carmen Pérez · V-12345678\s*1\s*Bs\. 8\.156,25\s*\$ 45,00/s);
  await volver();
  assert.deepEqual(s.errores, []);
});
