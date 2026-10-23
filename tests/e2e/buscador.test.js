// 🔍 Buscador inteligente: estudiantes, recibos, acciones y preguntas; cada rol ve solo lo suyo.
// Hoy en las pruebas es 07/10/2026.
//
// Uso: node --test tests/e2e/buscador.test.js
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { abrirNavegador } = require("./entorno");

let nav, dir, adm;
async function entrar(correo) {
  const s = await nav.nuevaPagina();
  await s.pagina.goto(nav.base);
  await s.pagina.waitForSelector("#l-email");
  await s.pagina.fill("#l-email", correo);
  await s.pagina.fill("#l-pwd", "prueba123");
  await s.pagina.click("#login-btn");
  await s.pagina.waitForSelector(".tabs .tab");
  return s;
}
async function buscar(s, q) {
  if (!(await s.pagina.locator("#busq-q").count())) {
    await s.pagina.keyboard.press("Control+k");
    await s.pagina.waitForSelector("#busq-q");
  }
  await s.pagina.fill("#busq-q", q);
  await s.pagina.waitForTimeout(250);
  return (await s.pagina.textContent("#busq-res")).replace(/\s+/g, " ");
}

before(async () => {
  nav = await abrirNavegador();
  dir = await entrar("herrerajoicer@gmail.com");
  adm = await entrar("josefajsanquez@gmail.com");
});
after(async () => nav && nav.cerrar());

test("se abre con el botón, la barra de Inicio, Ctrl+K o «/», y sugiere qué preguntar", async () => {
  assert.equal(await dir.pagina.locator(".barra-buscar").count(), 1);
  await dir.pagina.click(".barra-buscar");
  await dir.pagina.waitForSelector("#busq-q");
  assert.match(await dir.pagina.textContent("#busq-res"), /cómo vamos este mes/);
  await dir.pagina.keyboard.press("Escape");
  assert.equal(await dir.pagina.locator("#busq-q").count(), 0);
  await dir.pagina.keyboard.press("/");
  await dir.pagina.waitForSelector("#busq-q");
  await dir.pagina.keyboard.press("Escape");
});

test("estudiantes por nombre, cédula o representante, con su deuda; Enter lleva a cobrarle", async () => {
  assert.match(await buscar(dir, "luis gom"), /Luis Alberto Gómez.*Debe \$ 220,00/);
  assert.match(await buscar(dir, "30222333"), /Luis Alberto Gómez/);
  assert.match(await buscar(dir, "jose gomez"), /Luis Alberto Gómez/); // su representante
  await buscar(dir, "luis gom");
  await dir.pagina.keyboard.press("Enter");
  await dir.pagina.waitForTimeout(200);
  assert.equal(await dir.pagina.evaluate("tabActual"), "caja");
  assert.equal(await dir.pagina.evaluate("caja.estId"), "est2");
});

test("recibos por número", async () => {
  const t = await buscar(dir, "0003");
  assert.match(t, /FAC-0000003 · Carlos Eduardo Díaz/);
  await dir.pagina.click(".busq-item >> text=FAC-0000003");
  await dir.pagina.waitForSelector(".recibo-nums");
  await dir.pagina.evaluate("cerrarModal()");
});

test("acciones: «cierre de caja» lleva al cierre, «nuevo gasto» abre el formulario", async () => {
  assert.match(await buscar(dir, "cierre de caja"), /Cierre de caja de hoy/);
  await dir.pagina.keyboard.press("Enter");
  await dir.pagina.waitForTimeout(150);
  assert.equal(await dir.pagina.evaluate("tabActual + '/' + caja.vista"), "caja/cierre");
  await buscar(dir, "nuevo gasto");
  await dir.pagina.keyboard.press("Enter");
  await dir.pagina.waitForTimeout(150);
  assert.equal(await dir.pagina.evaluate("modalActual && modalActual.tipo"), "nuevo-finanza");
  await dir.pagina.evaluate("cerrarModal()");
});

test("preguntas del director: quién debe, cuánto se cobró, cómo vamos, actividad", async () => {
  const deben = await dir.pagina.evaluate("estudiantes.filter(enMora).length");
  assert.match(await buscar(dir, "¿quién debe?"), new RegExp(deben + " deben o tienen mora"));
  assert.match(await buscar(dir, "quien debe en 3er grado"), /1 deben o tienen mora en 3er Grado.*Miguel Ángel Torres/);
  assert.match(await buscar(dir, "cuanto se cobro el 05/10"), /Cobrado el 05\/10\/2026: \$ 55,00.*1 recibo/);
  assert.match(await buscar(dir, "cobrado en octubre"), /Cobrado octubre 2026: \$ 100,00/);
  assert.match(await buscar(dir, "como vamos este mes"), /Resultado este mes/);
  assert.match(await buscar(dir, "que hizo la secretaria hoy"), /Actividad hoy · Administradora/);
  assert.match(await buscar(dir, "tasa del 02/10"), /Tasa BCV del 02\/10\/2026: Bs\. 181,25/);
  assert.deepEqual(dir.errores, []);
});

test("la secretaria: lo cobrado de un día sí; lo demás es del director", async () => {
  assert.match(await buscar(adm, "cobrado hoy"), /Cobrado hoy/);
  assert.match(await buscar(adm, "cobrado en octubre"), /solo lo ve el director/);
  assert.match(await buscar(adm, "como vamos este mes"), /Eso lo ve solo el director/);
  const t = await buscar(adm, "luis");
  assert.match(t, /Cobrar/);
  assert.doesNotMatch(t, /Ficha/);
  assert.doesNotMatch(await buscar(adm, "nuevo gasto"), /Registrar un gasto/);
  assert.match(await buscar(adm, "pagos viejos"), /Pagos viejos/);
  assert.deepEqual(adm.errores, []);
});
