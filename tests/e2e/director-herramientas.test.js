// Herramientas del director: resumen quincenal en Inicio, flujo de caja proyectado (📊 Reportes) y abrir un respaldo
// automático (⚙️ Config → Año escolar). Hoy en las pruebas es 07/10/2026: la quincena que terminó es la 2ª de septiembre.
//
// Uso: node --test tests/e2e/director-herramientas.test.js
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { abrirNavegador } = require("./entorno");
const { cifrar } = require("../../herramientas/nube/cifrado");

let nav, s;
const llamar = (c) => s.pagina.evaluate(c);
const texto = (sel) => s.pagina.textContent(sel);

before(async () => {
  nav = await abrirNavegador();
  s = await nav.nuevaPagina();
  await s.pagina.goto(nav.base);
  await s.pagina.waitForSelector("#l-email");
  await s.pagina.fill("#l-email", "herrerajoicer@gmail.com");
  await s.pagina.fill("#l-pwd", "prueba123");
  await s.pagina.click("#login-btn");
  await s.pagina.waitForSelector(".tabs .tab");
});
after(async () => nav && nav.cerrar());

test("quincenas: del 1 al 15 y del 16 a fin de mes; la anterior a hoy", async () => {
  assert.deepEqual(await llamar(`quincenaDe("2026-10-07")`), {
    id: "2026-10-Q1",
    desde: "2026-10-01",
    hasta: "2026-10-15",
    nombre: "1ª quincena de octubre 2026",
  });
  assert.equal(await llamar(`quincenaDe("2027-02-20").hasta`), "2027-02-28");
  assert.equal(await llamar(`quincenaAnterior("2026-10-07").id`), "2026-09-Q2");
  assert.equal(await llamar(`quincenaAnterior("2026-10-16").id`), "2026-10-Q1");
});

test("Inicio: el resumen de la quincena que terminó, hasta marcarlo como visto", async () => {
  await s.pagina.waitForSelector(".aviso-quincenal");
  const t = await texto(".aviso-quincenal");
  assert.match(t, /Resumen de la 2ª quincena de septiembre 2026/);
  const r = await llamar(`JSON.parse(JSON.stringify(resumenQuincenal(quincenaAnterior())))`);
  assert.equal(r.conDeuda + r.alDia, r.activos);
  assert.equal(r.q.desde, "2026-09-16");
  assert.ok(r.entradas >= r.cobros.usd);
  assert.match(t, new RegExp(String(r.conDeuda) + "\\s*⚠️ Deben o tienen mora"));
  // por WhatsApp va el texto (a quien él elija: él mismo)
  await llamar(`whatsappResumenQuincenal("2026-09-16")`);
  assert.match(
    decodeURIComponent(await llamar(`window.__APERTURAS__.at(-1)`)),
    /RESUMEN DE LA 2ª QUINCENA DE SEPTIEMBRE/
  );
  await s.pagina.click(".aviso-quincenal >> text=✅ Visto");
  assert.equal(await s.pagina.locator(".aviso-quincenal").count(), 0);
  assert.equal(await llamar(`__DATOS_FALSOS__.config.get("resumenQuincenal").visto`), "2026-09-Q2");
});

test("Reportes: flujo proyectado mes a mes hasta agosto, con las utilidades en diciembre", async () => {
  await llamar(`setTab("reportes")`);
  await s.pagina.waitForSelector(".flujo-proyectado");
  const f = await llamar(`JSON.parse(JSON.stringify(proyectarFlujo(todayStr(), flujoOp)))`);
  assert.equal(f.meses[0].ym, "2026-10");
  assert.equal(f.meses.at(-1).ym, "2027-08"); // hasta que empieza el año siguiente
  const dic = f.meses.find((m) => m.ym === "2026-12");
  assert.equal(dic.extras[0].monto, f.nominaMes); // 30 días de sueldo
  const jul = f.meses.find((m) => m.ym === "2027-07");
  assert.match(jul.extras[0].concepto, /Bono vacacional \(15 días\)/);
  // el saldo de cada mes es el del anterior más su resultado
  f.meses.reduce((saldo, m) => {
    assert.ok(Math.abs(saldo + m.resultado - m.saldo) < 0.02, m.ym);
    return m.saldo;
  }, f.saldoInicial);
  assert.equal(await s.pagina.locator(".flujo-mes").count(), f.meses.length);
  // si todos pagan entra más que al ritmo actual
  await s.pagina.click(".flujo-proyectado >> text=Si todos pagan");
  const opt = await llamar(`proyectarFlujo(todayStr(), flujoOp).entradas`);
  assert.ok(opt >= f.entradas);
  // con más dinero al empezar, el final mejora en lo mismo
  await s.pagina.fill("#flujo-saldoInicial", "1000");
  const conMil = await llamar(`proyectarFlujo(todayStr(), flujoOp)`);
  assert.equal(conMil.saldoInicial, 1000);
  assert.match(await texto("#flujo-res"), /se empieza con \$ 1\.000,00/);
  await llamar(`imprimirFlujo()`);
  assert.match(await llamar(`window.__IMPRESIONES__.at(-1).html`), /Flujo de caja proyectado/);
  assert.deepEqual(s.errores, []);
});

test("Reportes: el resumen de cualquier quincena, para imprimir", async () => {
  await s.pagina.waitForSelector(".resumen-quincenal");
  await s.pagina.selectOption(".resumen-quincenal select", "2026-10-01");
  assert.match(await texto(".resumen-quincenal"), /01\/10\/2026 al 15\/10\/2026/);
  await llamar(`imprimirResumenQuincenal("2026-10-01")`);
  assert.match(await llamar(`window.__IMPRESIONES__.at(-1).html`), /1ª quincena de octubre 2026/);
});

test("Config → Año escolar: estado del respaldo automático y abrir uno con su clave", async () => {
  await llamar(`setTab("config"); subTab.config = "anio"; renderTabContent()`);
  await s.pagina.waitForSelector("#resp-archivo");
  assert.match(await texto("#tab-content"), /Todavía no se ha hecho ningún respaldo automático/);
  const contenido = {
    generado: "2026-10-02T21:00:05.000Z",
    totales: { pagos: 3, estudiantes: 6 },
    colecciones: { pagos: [], estudiantes: [] },
  };
  const archivo = { name: "respaldo-2026-10-02.cifrado.json", mimeType: "application/json" };
  const buffer = Buffer.from(JSON.stringify(cifrar(JSON.stringify(contenido), "clave-del-colegio-2026")));
  await s.pagina.setInputFiles("#resp-archivo", { ...archivo, buffer });
  await s.pagina.fill("#resp-clave", "otra clave");
  await llamar(`abrirRespaldo()`);
  await s.pagina.waitForSelector("#resp-res :text('La clave no es correcta')");
  await s.pagina.fill("#resp-clave", "clave-del-colegio-2026");
  await llamar(`abrirRespaldo()`);
  await s.pagina.waitForSelector("#resp-res :text('respaldo-2026-10-02.cifrado.json')");
  assert.match(await texto("#resp-res"), /estudiantes\s*6/);
  assert.match(await texto("#resp-res"), /pagos\s*3/);
  // con un respaldo automático anotado, lo dice
  await llamar(
    `configRespaldo = { ultimo: "2026-10-02", automatico: { fecha: "2026-10-02", hora: "17:01", documentos: 120 } }; renderTabContent()`
  );
  assert.match(await texto("#tab-content"), /Último respaldo automático: 02\/10\/2026 a las 17:01 · 120 registros/);
  assert.deepEqual(s.errores, []);
});
