// Auditoría: cada pago e ingreso/gasto guarda quién lo registró, y lo que se borra queda en la bitácora.
//
// Uso: node --test tests/e2e/auditoria.test.js
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { abrirNavegador } = require("./entorno");

const DIRECTOR = "herrerajoicer@gmail.com";
const ADMIN = "josefajsanquez@gmail.com";
let nav;
before(async () => (nav = await abrirNavegador()));
after(async () => nav && nav.cerrar());

async function entrar(correo) {
  const s = await nav.nuevaPagina();
  await s.pagina.goto(nav.base);
  await s.pagina.waitForSelector("#l-email");
  await s.pagina.fill("#l-email", correo);
  await s.pagina.fill("#l-pwd", "prueba123");
  await s.pagina.click("#login-btn");
  await s.pagina.waitForSelector(".tabs .tab");
  s.llamar = (codigo) => s.pagina.evaluate(codigo);
  s.escrituras = (prefijo) =>
    s.llamar(`window.__ESCRITURAS__.filter((e) => e.ruta.startsWith(${JSON.stringify(prefijo)}))`);
  return s;
}
// Cobro de 10 $ a Carlos Eduardo Díaz (est4), como lo hacen Caja y Pagos
const cobrar = (s) =>
  s.llamar(`(async () => {
    const r = await registrarCobro(
      [{ nombre: "Carlos Eduardo Díaz", estId: "est4", fecha: todayStr(), concepto: "Mensualidad", mes: "Octubre",
         metodo: "Dólares Efectivo", total: 10, tasa: 184.5, totalBs: 1845 }],
      { estId: "est4", aplicaDeuda: () => false });
    reflejarCobro("est4", r);
    return JSON.parse(JSON.stringify(r));
  })()`);

test("cada cobro guarda quién lo registró, y se ve en la lista de pagos y en el recibo", async () => {
  const s = await entrar(ADMIN);
  const r = await cobrar(s);
  const w = await s.escrituras("pagos/");
  assert.equal(w.length, 1);
  assert.equal(w[0].datos.registradoPor, ADMIN);
  await s.llamar(`setTab("pagos"); subTab.pagos = "historial"; renderTabContent()`);
  assert.match(await s.pagina.textContent("#tab-content"), new RegExp(r.factura + " · .* · 👤 Administradora"));
  await s.llamar(`abrirModal({ tipo: "recibo", pago: pagos.find((p) => p.factura === ${JSON.stringify(r.factura)}) })`);
  assert.match(await s.pagina.textContent(".recibo-quien"), /Registrado por Administradora/);
  assert.deepEqual(s.errores, []);
});

test("los ingresos y gastos también guardan quién los registró", async () => {
  const s = await entrar(DIRECTOR);
  await s.llamar(`setTab("finanzas"); abrirModal({ tipo: "nuevo-finanza", subtipo: "gasto" })`);
  await s.pagina.fill("#fin-desc", "Papel para la impresora");
  await s.pagina.fill("#fin-monto", "12");
  await s.llamar(`guardarFinanza("gasto")`);
  await s.pagina.waitForTimeout(150);
  const w = await s.escrituras("finanzas/");
  assert.equal(w.length, 1, JSON.stringify(s.dialogos));
  assert.equal(w[0].datos.registradoPor, DIRECTOR);
  const id = w[0].ruta.split("/")[1];
  await s.llamar(`abrirModal({ tipo: "ver-finanza", id: ${JSON.stringify(id)} })`);
  assert.match(await s.pagina.textContent(".modal"), /Registrado por\s*Director/);
});

test("borrar un recibo deja una copia en la bitácora, en el mismo lote que el borrado", async () => {
  const s = await entrar(DIRECTOR);
  const r = await cobrar(s);
  const pago = r.guardados[0];
  const antes = await s.llamar(`window.__ESCRITURAS__.length`);
  await s.llamar(`eliminarRecibo(${JSON.stringify(pago.id)})`);
  await s.pagina.waitForTimeout(150);
  const w = await s.llamar(`window.__ESCRITURAS__.slice(${antes})`);
  assert.deepEqual(
    w.map((e) => e.op + " " + e.ruta),
    ["set bitacora/pagos_" + pago.id, "delete pagos/" + pago.id]
  );
  const b = w[0].datos;
  assert.equal(b.por, DIRECTOR);
  assert.equal(b.coleccion, "pagos");
  assert.equal(b.docId, pago.id);
  assert.equal(b.datos.factura, r.factura);
  assert.equal(b.datos.registradoPor, DIRECTOR);
  assert.match(b.resumen, new RegExp("Recibo " + r.factura + " · Carlos Eduardo Díaz · \\$ 10,00"));
});

test("borrar un recibo que descontó deuda anterior también queda en la bitácora (dentro de la transacción)", async () => {
  const s = await entrar(DIRECTOR);
  const r = await s.llamar(`(async () => {
    const r = await registrarCobro(
      [{ nombre: "Luis Alberto Gómez", estId: "est2", fecha: todayStr(), concepto: "Deuda anterior",
         metodo: "Dólares Efectivo", total: 20, tasa: 184.5, totalBs: 3690 }],
      { estId: "est2", aplicaDeuda: () => true });
    reflejarCobro("est2", r);
    return JSON.parse(JSON.stringify(r));
  })()`);
  const id = r.guardados[0].id;
  await s.llamar(`eliminarRecibo(${JSON.stringify(id)})`);
  await s.pagina.waitForTimeout(150);
  const b = await s.llamar(
    `JSON.parse(JSON.stringify(__DATOS_FALSOS__.bitacora.get("pagos_" + ${JSON.stringify(id)})))`
  );
  assert.equal(b.datos.deudaAplicada, 20);
  assert.match(b.motivo, /Se devolvió la deuda anterior: \$ 20,00/);
});

test("borrar un ingreso/gasto o un estudiante también queda en la bitácora", async () => {
  const s = await entrar(DIRECTOR);
  const fin = await s.llamar(`finanzas[0].id`);
  await s.llamar(`eliminarFinanza(${JSON.stringify(fin)})`);
  await s.llamar(`eliminarEstudiante("est5")`);
  await s.pagina.waitForTimeout(150);
  const w = (await s.escrituras("bitacora/")).map((e) => e.ruta);
  assert.deepEqual(w, ["bitacora/finanzas_" + fin, "bitacora/estudiantes_est5"]);
  assert.equal(await s.llamar(`__DATOS_FALSOS__.finanzas.has(${JSON.stringify(fin)})`), false);
  assert.equal(await s.llamar(`__DATOS_FALSOS__.estudiantes.has("est5")`), false);
});

test("el director ve la bitácora en Configuración: qué se borró, quién y cuándo", async () => {
  const s = await entrar(DIRECTOR);
  const r = await cobrar(s);
  await s.llamar(`eliminarRecibo(${JSON.stringify(r.guardados[0].id)})`);
  await s.llamar(`setTab("config"); subTab.config = "bitacora"; renderTabContent()`);
  await s.pagina.waitForSelector("text=Borrado por");
  const texto = await s.pagina.textContent("#tab-content");
  assert.match(texto, new RegExp("Recibo " + r.factura));
  assert.match(texto, /Borrado por Director · 07\/10\/2026 · lo había registrado Director/);
  assert.deepEqual(s.errores, []);
});

test("si nada se ha borrado, la bitácora lo dice", async () => {
  const s = await entrar(DIRECTOR);
  await s.llamar(`setTab("config"); subTab.config = "bitacora"; renderTabContent()`);
  await s.pagina.waitForSelector("text=No se ha borrado nada todavía");
});
