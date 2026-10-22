// Estado de cuenta del representante: desde la ficha del estudiante, la hoja con las cuotas del año, los recibos y el
// total a pagar hoy (en $ y Bs.), y el mismo resumen por WhatsApp.
//
// Uso: node --test tests/e2e/estado-cuenta.test.js
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { abrirNavegador } = require("./entorno");

let nav, s;
const llamar = (codigo) => s.pagina.evaluate(codigo);
const texto = (html) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

before(async () => {
  nav = await abrirNavegador();
  s = await nav.nuevaPagina();
  await s.pagina.goto(nav.base);
  await s.pagina.waitForSelector("#l-email");
  await s.pagina.fill("#l-email", "josefajsanquez@gmail.com");
  await s.pagina.fill("#l-pwd", "prueba123");
  await s.pagina.click("#login-btn");
  await s.pagina.waitForSelector(".tabs .tab");
  await llamar(`tasas[todayStr()] = 184.5; abrirModal({ tipo: "ver-estudiante", id: "est1" })`);
});
after(async () => nav && nav.cerrar());

test("se imprime desde la ficha: cuotas del año, recibos y total a pagar hoy", async () => {
  await s.pagina.click("text=🧾 Estado de cuenta");
  const t = texto(await llamar(`window.__IMPRESIONES__.at(-1).html`));
  for (const parte of [
    "Estado de cuenta",
    "Estudiante Ana María Pérez",
    "Representante Carmen Pérez",
    "Septiembre 2026 05/09/2026 $ 45,00 $ 45,00 $ 0,00 ✓ Pagada el 02/10/2026",
    "Octubre 2026 05/10/2026 $ 45,00 $ 0,00 $ 45,00 Vencida",
    "Noviembre 2026 05/11/2026 $ 45,00 $ 0,00 $ 45,00 Por vencer",
    "16/09/2026 FAC-0000001 Inscripción $ 60,00",
    "02/10/2026 FAC-0000002 Mensualidad Septiembre $ 45,00 Bs. 8.156,25",
    "Pagado en el año $ 105,00",
    "Total a pagar hoy $ 45,00 · Bs. 8.302,50",
    "Por vencer en el resto del año $ 360,00",
  ])
    assert.ok(t.includes(parte), "falta: " + parte + "\n" + t);
});

test("por WhatsApp va el resumen al teléfono del representante", async () => {
  await s.pagina.click('button[title="Estado de cuenta por WhatsApp"]');
  const url = await llamar(`window.__APERTURAS__.at(-1)`);
  assert.match(url, /^https:\/\/wa\.me\/58\d{10}\?text=/);
  const msg = decodeURIComponent(url.split("?text=")[1]);
  assert.match(msg, /Estado de cuenta\* al 07\/10\/2026/);
  assert.match(msg, /Ana María Pérez · 1er Grado/);
  assert.match(msg, /Cuotas vencidas: Octubre \$ 45,00/);
  assert.match(msg, /Total a pagar hoy: \$ 45,00\* \(Bs\. 8\.302,50\)/);
  assert.match(msg, /Próxima cuota: Noviembre 2026 \$ 45,00 \(vence el 05\/11\/2026\)/);
  assert.deepEqual(s.errores, []);
});
