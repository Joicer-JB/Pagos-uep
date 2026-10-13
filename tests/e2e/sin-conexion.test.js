// Sin conexión y app instalable: se puede seguir cobrando sin internet (recibo provisional que luego recibe su número
// correlativo), las escrituras no se quedan esperando, y la app abre sin internet gracias al service worker.
//
// Uso: node --test tests/e2e/sin-conexion.test.js

// Para que las bibliotecas que pide el service worker también se sirvan sin internet (Chromium)
process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS = "1";
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { abrirNavegador, RAIZ } = require("./entorno");

const ADMIN = "josefajsanquez@gmail.com";
let nav;
before(async () => (nav = await abrirNavegador()));
after(async () => nav && nav.cerrar());

async function entrar(correo = ADMIN) {
  const s = await nav.nuevaPagina();
  await s.pagina.goto(nav.base);
  await s.pagina.waitForSelector("#l-email");
  await s.pagina.fill("#l-email", correo);
  await s.pagina.fill("#l-pwd", "prueba123");
  await s.pagina.click("#login-btn");
  await s.pagina.waitForSelector(".tabs .tab");
  s.llamar = (codigo) => s.pagina.evaluate(codigo);
  s.enBase = (col, id) =>
    s.llamar(`JSON.parse(JSON.stringify(__DATOS_FALSOS__[${JSON.stringify(col)}].get(${JSON.stringify(id)}) || null))`);
  return s;
}
// Cobro de Luis Alberto Gómez (est2 debe 110 $ de deuda anterior en la semilla)
const cobrar = (s, total, concepto = "Deuda anterior") =>
  s.llamar(`(async () => {
    const r = await registrarCobro(
      [{ nombre: "Luis Alberto Gómez", estId: "est2", fecha: todayStr(), concepto: ${JSON.stringify(concepto)},
         metodo: "Dólares Efectivo", total: ${total}, tasa: 184.5, totalBs: r2(${total} * 184.5) }],
      { estId: "est2", aplicaDeuda: (d) => d.concepto === "Deuda anterior" });
    reflejarCobro("est2", r);
    return JSON.parse(JSON.stringify(r));
  })()`);

test("sin internet se puede cobrar: recibo provisional, deuda descontada y aviso en pantalla", async () => {
  const s = await entrar();
  await s.contexto.setOffline(true);
  await s.pagina.waitForSelector("#aviso-conexion.sin-conexion");
  assert.match(await s.pagina.textContent("#aviso-conexion"), /Sin internet\. Puedes seguir cobrando/);

  const inicio = Date.now();
  const r = await cobrar(s, 30);
  assert.ok(Date.now() - inicio < 2500, "no se queda esperando al servidor");
  assert.equal(r.provisional, true);
  assert.match(r.factura, /^PROV-[0-9A-Z]{6,8}$/);
  const pago = await s.enBase("pagos", r.guardados[0].id); // ya guardado en el equipo
  assert.equal(pago.pendiente, true);
  assert.equal(pago.registradoPor, ADMIN);
  assert.equal(pago.deudaAplicada, 30);
  assert.equal((await s.enBase("estudiantes", "est2")).moraMonto, 80);
  // En la lista se ve como pendiente de número
  await s.llamar(`setTab("pagos"); subTab.pagos = "historial"; renderTabContent()`);
  assert.match(await s.pagina.textContent("#tab-content"), /Cobrado sin internet: recibirá su número/);

  // Vuelve la conexión: recibe su número correlativo y el aviso dice que todo está al día
  await s.contexto.setOffline(false);
  await s.pagina.waitForSelector("#aviso-conexion.al-dia");
  const numerado = await s.enBase("pagos", r.guardados[0].id);
  assert.equal(numerado.factura, "FAC-000001");
  assert.equal(numerado.pendiente, false);
  assert.equal(numerado.recibo, 1);
  assert.equal(numerado.facturaProvisional, r.factura);
  assert.equal(numerado.numeradoPor, ADMIN);
  assert.equal((await s.enBase("config", "contadores")).recibo, 1);
  assert.equal(
    await s.llamar(`pagos.find((p) => p.id === ${JSON.stringify(r.guardados[0].id)}).factura`),
    "FAC-000001"
  );
  assert.deepEqual(s.errores, []);
});

test("varios cobros sin internet reciben números seguidos, en orden, y un cobro en línea sigue la cuenta", async () => {
  const s = await entrar();
  await s.contexto.setOffline(true);
  const a = await cobrar(s, 10, "Mensualidad");
  const b = await cobrar(s, 15, "Mensualidad");
  await s.contexto.setOffline(false);
  await s.pagina.waitForSelector("#aviso-conexion.al-dia");
  const fa = (await s.enBase("pagos", a.guardados[0].id)).factura;
  const fb = (await s.enBase("pagos", b.guardados[0].id)).factura;
  assert.deepEqual([fa, fb].sort(), ["FAC-000001", "FAC-000002"]);
  const c = await cobrar(s, 5, "Mensualidad");
  assert.equal(c.factura, "FAC-000003");
  assert.equal(c.provisional, false);
});

test("al registrar un pago sin internet, la animación avisa que el recibo es provisional", async () => {
  const s = await entrar();
  await s.contexto.setOffline(true);
  await s.llamar(`setTab("pagos"); subTab.pagos = "nuevo"; renderTabContent(); seleccionarEstudiantePago("est4")`);
  await s.pagina.fill("#p-total", "45");
  await s.llamar(`guardarPago()`);
  await s.pagina.waitForSelector(".exito-overlay");
  assert.match(await s.pagina.textContent(".exito-overlay"), /Sin internet: recibo provisional PROV-/);
  // el recibo en pantalla dice que el número es provisional
  assert.match(await s.pagina.textContent(".recibo-nums"), /N° Recibo \(provisional\)/);
});

test("sin internet, guardar un gasto no se queda «guardando»", async () => {
  const s = await entrar();
  await s.contexto.setOffline(true);
  await s.llamar(`setTab("finanzas"); abrirModal({ tipo: "nuevo-finanza", subtipo: "gasto" })`);
  await s.pagina.fill("#fin-desc", "Agua potable");
  await s.pagina.fill("#fin-monto", "8");
  const inicio = Date.now();
  await s.llamar(`guardarFinanza("gasto")`);
  assert.ok(Date.now() - inicio < 2500);
  assert.equal(await s.llamar(`modalActual`), null, "la ventana se cerró");
  assert.ok(await s.llamar(`finanzas.some((f) => f.descripcion === "Agua potable")`));
});

test("sin internet no se puede borrar un recibo que descontó deuda (necesita al servidor), y se explica", async () => {
  const s = await entrar("herrerajoicer@gmail.com");
  const r = await cobrar(s, 20);
  await s.contexto.setOffline(true);
  await s.llamar(`eliminarRecibo(${JSON.stringify(r.guardados[0].id)})`);
  await s.pagina.waitForTimeout(100);
  assert.match(s.dialogos.at(-1), /se necesita internet/);
  assert.ok(await s.enBase("pagos", r.guardados[0].id), "el recibo sigue ahí");
});

test("app instalable: manifiesto con nombre, colores e íconos que existen", async () => {
  const html = fs.readFileSync(path.join(RAIZ, "index.html"), "utf8");
  assert.match(html, /<link rel="manifest" href="manifest.webmanifest"/);
  const m = JSON.parse(fs.readFileSync(path.join(RAIZ, "manifest.webmanifest"), "utf8"));
  assert.equal(m.display, "standalone");
  assert.equal(m.start_url, "./");
  assert.ok(m.icons.some((i) => i.sizes === "192x192") && m.icons.some((i) => i.sizes === "512x512"));
  assert.ok(m.icons.some((i) => i.purpose === "maskable"));
  for (const i of m.icons) assert.ok(fs.existsSync(path.join(RAIZ, i.src)), i.src);
  // y se publican en GitHub Pages
  const flujo = fs.readFileSync(path.join(RAIZ, ".github/workflows/pruebas.yml"), "utf8");
  assert.match(flujo, /cp -r index\.html manifest\.webmanifest sw\.js css js assets _sitio\//);
});

test("app instalable: el service worker guarda la app y la abre sin internet", async () => {
  const s = await nav.nuevaPagina();
  await s.pagina.goto(nav.base);
  await s.pagina.waitForSelector("#l-email");
  // espera a que el service worker esté activo y guarde la copia
  await s.pagina.evaluate(() => navigator.serviceWorker.ready);
  await s.pagina.waitForFunction(async () => {
    const c = await caches.open("jjs-app-v1");
    return !!(await c.match(new URL("js/app.js", location.href).href));
  });
  await s.contexto.setOffline(true);
  await s.pagina.reload();
  await s.pagina.waitForSelector("#l-email"); // la pantalla de entrada carga desde la copia
  assert.equal(await s.pagina.evaluate(() => typeof render), "function");
  assert.equal(await s.pagina.evaluate(() => typeof XLSX), "object", "las bibliotecas también están guardadas");
});
