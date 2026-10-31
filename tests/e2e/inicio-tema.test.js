// 🏠 Inicio: saludo y resumen del día (con cumpleaños), meta de cobranza del mes con confeti; 🌙 tema oscuro;
// pantalla de carga con el escudo; y en el teléfono, deslizar el dedo de lado para pasar de pestaña.
//
// Uso: node --test tests/e2e/inicio-tema.test.js
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { abrirNavegador } = require("./entorno");

let nav;
before(async () => (nav = await abrirNavegador()));
after(async () => nav && nav.cerrar());

async function entrar(correo, { movil = false } = {}) {
  const s = await nav.nuevaPagina({ movil });
  s.llamar = (c) => s.pagina.evaluate(c);
  await s.pagina.goto(nav.base);
  await s.pagina.waitForSelector("#l-email");
  await s.pagina.fill("#l-email", correo);
  await s.pagina.fill("#l-pwd", "prueba123");
  await s.pagina.click("#login-btn");
  await s.pagina.waitForSelector(".tabs .tab");
  return s;
}
const deslizar = (s, x1, x2, y = 500) =>
  s.llamar(`(() => {
    const el = document.elementFromPoint(${x1}, ${y});
    const t = (x) => new Touch({ identifier: 1, target: el, clientX: x, clientY: ${y} });
    el.dispatchEvent(new TouchEvent("touchstart", { bubbles: true, touches: [t(${x1})], changedTouches: [t(${x1})] }));
    el.dispatchEvent(new TouchEvent("touchend", { bubbles: true, touches: [], changedTouches: [t(${x2})] }));
  })()`);

test("saludo según la hora con la fecha, lo de hoy y los cumpleaños (hoy y pronto)", async () => {
  const s = await entrar("herrerajoicer@gmail.com");
  // 7 de octubre de 2026, 10:00 a. m. (hora de Caracas)
  assert.match(await s.pagina.textContent(".saludo-titulo"), /Buenos días/);
  assert.match(await s.pagina.textContent(".saludo-fecha"), /Miércoles, 7 de octubre de 2026/);
  const chips = await s.pagina.textContent(".saludo-chips");
  assert.match(chips, /Cobrado hoy/);
  assert.match(chips, /5 deben/);
  // Cumpleaños: Ana cumple hoy, Luis mañana
  await s.llamar(`(() => {
    estudiantes.find((e) => e.id === "est1").fechaNac = "2019-10-07";
    estudiantes.find((e) => e.id === "est2").fechaNac = "2012-10-08";
    renderTabContent();
  })()`);
  const c2 = await s.pagina.textContent(".saludo-chips");
  assert.match(c2, /Hoy cumple Ana \(7\)/);
  assert.match(c2, /Pronto: Luis mañana/);
  // Los datos llevan a su pestaña
  await s.pagina.click(".saludo-chip.rojo");
  assert.equal(await s.llamar(`tabActual`), "cobranza");
  assert.deepEqual(s.errores, []);
});

test("la secretaria también tiene su saludo (sin los datos del director)", async () => {
  const s = await entrar("josefajsanquez@gmail.com");
  assert.match(await s.pagina.textContent(".saludo-titulo"), /Buenos días/);
  assert.equal(await s.pagina.$(".saludo-chip.rojo"), null);
  assert.equal(await s.pagina.$(".meta-cobranza"), null);
});

test("meta de cobranza del mes: avance, la meta se cambia y al cumplirla sale confeti (una vez al mes)", async () => {
  const s = await entrar("herrerajoicer@gmail.com");
  const m = await s.llamar(`metaCobranzaMes()`);
  assert.equal(m.ym, "2026-10");
  assert.equal(m.meta, 80);
  assert.match(await s.pagina.textContent(".meta-cobranza"), new RegExp("Faltan .* para llegar al 80 %"));
  // Cambiar la meta (el director): 1 % ya está cumplida si se cobró algo de octubre; si no, se simula un cobro
  await s.llamar(`window.prompt = () => "10"`);
  await s.pagina.click(".meta-editar");
  await s.pagina.waitForFunction(() => __DATOS_FALSOS__.config.get("cobranza").meta === 10);
  await s.llamar(`(() => {
    const est = estudiantes.find((e) => e.id === "est1");
    pagos.push({ id: "pmeta", estId: "est1", nombre: est.nombre, cedula: est.cedula, concepto: "Mensualidad", fecha: "2026-10-07", total: 200, cuotas: { "2026-09": 45, "2026-10": 45 } });
    localStorage.removeItem("metaCelebrada-2026-10");
    renderTabContent();
  })()`);
  await s.pagina.waitForSelector(".meta-cobranza.cumplida");
  assert.match(await s.pagina.textContent(".meta-cobranza"), /¡Meta cumplida!/);
  await s.pagina.waitForSelector("#confeti");
  // Otra vez en el mismo mes: sin confeti
  await s.pagina.waitForFunction(() => !document.getElementById("confeti"), null, { timeout: 6000 });
  await s.llamar(`renderTabContent()`);
  await s.pagina.waitForTimeout(900);
  assert.equal(await s.pagina.$("#confeti"), null);
});

test("tema: 🌓 automático → 🌙 oscuro → ☀️ claro, y queda guardado en el equipo", async () => {
  const s = await entrar("herrerajoicer@gmail.com");
  const oscuro = () => s.llamar(`document.documentElement.classList.contains("tema-oscuro")`);
  assert.equal(await s.pagina.textContent("#btn-tema"), "🌓");
  await s.pagina.click("#btn-tema");
  assert.equal(await oscuro(), true);
  assert.equal(await s.pagina.textContent("#btn-tema"), "🌙");
  assert.equal(await s.llamar(`localStorage.getItem("tema")`), "oscuro");
  // Colores oscuros, también en lo que trae color escrito en el HTML
  assert.equal(await s.llamar(`getComputedStyle(document.body).backgroundColor`), "rgb(11, 21, 38)");
  assert.notEqual(
    await s.llamar(`getComputedStyle(document.querySelector(".card")).backgroundColor`),
    "rgb(255, 255, 255)"
  );
  assert.equal(await s.llamar(`document.querySelector('meta[name="theme-color"]').content`), "#0b1526");
  await s.pagina.click("#btn-tema");
  assert.equal(await oscuro(), false);
  assert.equal(await s.pagina.textContent("#btn-tema"), "☀️");
  await s.pagina.click("#btn-tema");
  assert.equal(await s.llamar(`localStorage.getItem("tema")`), null); // automático
  // Automático sigue al equipo
  await s.pagina.emulateMedia({ colorScheme: "dark" });
  await s.pagina.waitForFunction(() => document.documentElement.classList.contains("tema-oscuro"));
  await s.pagina.emulateMedia({ colorScheme: "light" });
  await s.pagina.waitForFunction(() => !document.documentElement.classList.contains("tema-oscuro"));
  assert.deepEqual(s.errores, []);
});

test("pantalla de carga con el escudo (al abrir y al cargar los datos)", async () => {
  const s = await nav.nuevaPagina();
  await s.pagina.goto(nav.base);
  const html = await s.pagina.evaluate(() => pantallaCarga("Cargando los datos del colegio…"));
  assert.match(html, /class="splash"[\s\S]*splash-escudo[\s\S]*Cargando los datos del colegio…[\s\S]*splash-barra/);
  const indice = require("fs").readFileSync(require("path").join(__dirname, "../../index.html"), "utf8");
  assert.match(indice, /<div class="splash" role="status">[\s\S]*Iniciando…/);
});

test("teléfono: deslizar de lado pasa a la pestaña de al lado (no en tablas que se deslizan, ni con una ventana abierta)", async () => {
  const s = await entrar("herrerajoicer@gmail.com", { movil: true });
  assert.equal(await s.llamar(`tabActual`), "dashboard");
  await deslizar(s, 300, 120); // hacia la izquierda: la siguiente
  assert.equal(await s.llamar(`tabActual`), "caja");
  await deslizar(s, 300, 120);
  assert.equal(await s.llamar(`tabActual`), "pagos");
  await deslizar(s, 100, 300); // hacia la derecha: la anterior
  assert.equal(await s.llamar(`tabActual`), "caja");
  // Un movimiento corto no cuenta
  await deslizar(s, 200, 160);
  assert.equal(await s.llamar(`tabActual`), "caja");
  // Dentro de algo que se desliza de lado, no
  await s.llamar(`(() => {
    const d = document.createElement("div");
    d.setAttribute("style", "overflow-x:auto;height:200px");
    d.innerHTML = '<div style="width:1200px;height:200px"></div>';
    document.getElementById("tab-content").prepend(d);
    scrollTo(0, 0);
  })()`);
  const caja = await s.pagina.locator("#tab-content > div").first().boundingBox();
  await deslizar(s, 300, 100, caja.y + 50);
  assert.equal(await s.llamar(`tabActual`), "caja");
  // Con una ventana abierta, no
  await s.llamar(`setTab("dashboard"); abrirModal({ tipo: "tasa" })`);
  await deslizar(s, 300, 100);
  assert.equal(await s.llamar(`tabActual`), "dashboard");
  assert.deepEqual(s.errores, []);
});
