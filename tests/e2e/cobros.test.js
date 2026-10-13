// Cobros en el navegador con el Firebase falso: recibo correlativo, deuda anterior leída al momento de cobrar
// (aunque otro equipo la haya cambiado) y devolución de la deuda al borrar un recibo.
//
// Uso: node --test tests/e2e/cobros.test.js
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { abrirNavegador } = require("./entorno");

let nav, sesion;
const llamar = (codigo) => sesion.pagina.evaluate(codigo);
const enBase = (id) => llamar(`JSON.parse(JSON.stringify(__DATOS_FALSOS__.estudiantes.get(${JSON.stringify(id)})))`);
// Un pago de «Deuda anterior» para Luis Alberto Gómez (est2 tiene 110 $ de deuda anterior en la semilla)
const cobrar = (total) =>
  llamar(`(async () => {
    const r = await registrarCobro(
      [{ nombre: "Luis Alberto Gómez", cedula: "V-30222333", estId: "est2", fecha: todayStr(), concepto: "Deuda anterior",
         metodo: "Dólares Efectivo", total: ${total}, tasa: 184.5, totalBs: r2(${total} * 184.5) }],
      { estId: "est2", aplicaDeuda: () => true });
    reflejarCobro("est2", r);
    return JSON.parse(JSON.stringify(r));
  })()`);

before(async () => {
  nav = await abrirNavegador();
  sesion = await nav.nuevaPagina();
  await sesion.pagina.goto(nav.base);
  await sesion.pagina.waitForSelector("#l-email");
  await sesion.pagina.fill("#l-email", "herrerajoicer@gmail.com");
  await sesion.pagina.fill("#l-pwd", "prueba123");
  await sesion.pagina.click("#login-btn");
  await sesion.pagina.waitForSelector(".tabs .tab");
});
after(async () => nav && nav.cerrar());

test("los recibos salen con número correlativo", async () => {
  const a = await cobrar(10);
  const b = await cobrar(10);
  assert.equal(a.factura, "FAC-000001");
  assert.equal(b.factura, "FAC-000002");
  assert.equal((await llamar("JSON.parse(JSON.stringify(__DATOS_FALSOS__.config.get('contadores')))")).recibo, 2);
});

test("la deuda se lee al cobrar: si otro equipo ya cobró parte, no se sobrescribe con el valor viejo", async () => {
  // En la base la deuda quedó en 90 tras los dos cobros; otro equipo cobra 40 más (esta pantalla no se entera)
  const actual = await enBase("est2");
  assert.equal(actual.moraMonto, 90);
  await llamar(`__DATOS_FALSOS__.estudiantes.get("est2").moraMonto = 50`);
  const r = await cobrar(80); // se cobra más de lo que realmente se debe
  assert.equal(r.guardados[0].deudaAplicada, 50, "solo descuenta lo que de verdad se debía");
  const despues = await enBase("est2");
  assert.equal(despues.moraMonto, 0);
  assert.equal(despues.estado, "alsaldo");
});

test("borrar un recibo devuelve a la deuda anterior lo que ese pago había descontado", async () => {
  const id = await llamar(`pagos.find((p) => p.deudaAplicada === 50).id`);
  await llamar(`eliminarRecibo(${JSON.stringify(id)})`);
  await sesion.pagina.waitForTimeout(100);
  assert.match(sesion.dialogos.at(-1), /Se devolverán \$ 50,00/);
  const est = await enBase("est2");
  assert.equal(est.moraMonto, 50);
  assert.equal(est.estado, "mora");
  assert.equal(est.moraConcepto, "Mensualidades julio y agosto"); // el concepto que tenía la deuda
  assert.equal(await llamar(`pagos.some((p) => p.id === ${JSON.stringify(id)})`), false);
  assert.equal(await llamar(`__DATOS_FALSOS__.pagos.has(${JSON.stringify(id)})`), false);
});

test("con las reglas viejas (sin permiso para el contador) se sigue cobrando con el número anterior", async () => {
  await llamar(`window.__DENEGAR__ = ["config/contadores"]`);
  const r = await cobrar(5);
  assert.match(r.factura, /^FAC-\d{7}$/);
  assert.equal(r.guardados.length, 1);
  assert.deepEqual(
    sesion.errores.filter((e) => !/Contador de recibos no disponible/.test(e)),
    []
  );
});

test("recordatorio de respaldo: aparece en Inicio si no hay uno reciente y se quita al descargarlo", async () => {
  await llamar(`window.__DENEGAR__ = []; setTab("dashboard")`);
  assert.match(await llamar(`document.getElementById("app").innerHTML`), /Todavía no hay ningún respaldo registrado/);
  await llamar(`descargarRespaldo(); renderTabContent()`);
  await sesion.pagina.waitForTimeout(100);
  assert.doesNotMatch(
    await llamar(`document.getElementById("app").innerHTML`),
    /respaldo registrado|último respaldo fue/
  );
  const anotado = await llamar(`JSON.parse(JSON.stringify(__DATOS_FALSOS__.config.get("respaldo")))`);
  assert.equal(anotado.ultimo, "2026-10-07");
  // 20 días después vuelve a avisar
  await llamar(`configRespaldo = { ultimo: "2026-09-17" }; renderTabContent()`);
  assert.match(await llamar(`document.getElementById("app").innerHTML`), /El último respaldo fue hace 20 días/);
});
