// Navegación adaptable: en la PC el menú fijo a la izquierda (con grupos y numeritos); en el teléfono, ☰ abre el
// menú encima de la pantalla y abajo queda la barra con Inicio, Caja, Pagos y Cobranza. La secretaria (3 pestañas)
// solo tiene la barra de abajo. En el iPhone el menú no se abre deslizando desde el borde (es «volver») y «Instalar»
// explica cómo agregarla a la pantalla de inicio.
//
// Uso: node --test tests/e2e/navegacion.test.js
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { abrirNavegador } = require("./entorno");

const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const ANDROID =
  "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36";
let nav;
before(async () => (nav = await abrirNavegador()));
after(async () => nav && nav.cerrar());

async function entrar(correo, { movil = false, ua = "" } = {}) {
  const s = await nav.nuevaPagina({ movil });
  s.llamar = (c) => s.pagina.evaluate(c);
  if (!movil) await s.pagina.setViewportSize({ width: 1440, height: 900 });
  if (ua) await s.pagina.addInitScript((ua) => Object.defineProperty(navigator, "userAgent", { get: () => ua }), ua);
  await s.pagina.goto(nav.base);
  await s.pagina.waitForSelector("#l-email");
  await s.pagina.fill("#l-email", correo);
  await s.pagina.fill("#l-pwd", "prueba123");
  await s.pagina.click("#login-btn");
  await s.pagina.waitForSelector(".tabs .tab");
  return s;
}
const textos = (s, sel) => s.pagina.$$eval(sel, (n) => n.map((x) => x.textContent.replace(/\s+/g, " ").trim()));
const visible = (s, sel) => s.pagina.isVisible(sel);

test("PC: menú fijo con grupos, el numerito de Cobranza y el título de la pestaña arriba", async () => {
  const s = await entrar("herrerajoicer@gmail.com");
  assert.deepEqual(await textos(s, ".sb-grupo-titulo"), ["Cobros", "Colegio", "Administración"]);
  assert.equal(await s.pagina.locator(".sidebar .tab").count(), 12);
  assert.equal(await visible(s, ".barra-inferior"), false);
  assert.equal(await visible(s, ".hb-menu"), false);
  assert.equal(await s.llamar(`document.getElementById("sidebar").inert`), false);
  // Numerito: estudiantes en mora (los mismos que cuenta Cobranza)
  const enMora = await s.llamar(`listaCobranza().filter((r) => r.enMora).length`);
  assert.ok(enMora > 0);
  assert.equal(await s.pagina.textContent('.sidebar [data-insignia="cobranza"]'), String(enMora));
  await s.pagina.click(".sidebar .tab:has-text('Finanzas')");
  assert.equal(await s.llamar(`tabActual`), "finanzas");
  assert.match(await s.pagina.textContent(".header-name"), /Finanzas/);
  assert.match(await s.pagina.textContent(".header-label"), /Administración/);
  assert.match(await s.pagina.textContent("#rol-lbl"), /Director/);
  assert.equal(await visible(s, ".sb-salir"), true);
  assert.deepEqual(s.errores, []);
});

test("PC: un pedido de autorización pone el numerito en Configuración", async () => {
  const s = await entrar("herrerajoicer@gmail.com");
  await s.llamar(
    `__OTRO_EQUIPO__.escribir("autorizaciones", "uid-admin", { correo: "josefajsanquez@gmail.com", nombre: "Josefa", rol: "administradora", pide: todayStr(), pideHora: "07:30", hasta: 0 })`
  );
  await s.pagina.waitForFunction(() => document.querySelector('.sidebar [data-insignia="config"]').textContent === "1");
});

test("teléfono: ☰ abre el menú encima, tocar fuera lo cierra; la barra de abajo lleva a las pestañas", async () => {
  const s = await entrar("herrerajoicer@gmail.com", { movil: true });
  assert.deepEqual(await textos(s, ".barra-inferior .tab-txt"), ["Inicio", "Caja", "Pagos", "Cobranza", "Más"]);
  assert.equal(await visible(s, ".hb-menu"), true);
  assert.equal(await s.llamar(`document.getElementById("sidebar").inert`), true); // cerrado: fuera de alcance
  // La tasa, solo el número; el año escolar está dentro del menú
  assert.match(await s.pagina.textContent(".hb-tasa .hb-tasa-corta"), /^⚠️ 183,40$/);
  assert.equal(await visible(s, ".header .hb-anio"), false);
  await s.pagina.click(".hb-menu");
  await s.pagina.waitForFunction(() => document.querySelector(".shell").classList.contains("menu-abierto"));
  assert.equal(await s.llamar(`document.getElementById("sidebar").inert`), false);
  assert.equal(await visible(s, ".sb-anio"), true);
  await s.pagina.mouse.click(370, 400); // en el velo, fuera del menú
  await s.pagina.waitForFunction(() => !document.querySelector(".shell").classList.contains("menu-abierto"));
  // Barra de abajo
  await s.pagina.click(".barra-inferior .bi-tab:has-text('Caja')");
  assert.equal(await s.llamar(`tabActual`), "caja");
  assert.equal(await s.pagina.getAttribute(".barra-inferior .bi-tab.active", "aria-current"), "page");
  // «Más» abre el menú; elegir Nómina cierra el menú y «Más» queda marcada
  await s.pagina.click(".barra-inferior .bi-mas");
  await s.pagina.waitForFunction(() => document.querySelector(".shell").classList.contains("menu-abierto"));
  await s.pagina.waitForTimeout(350); // termina de entrar
  await s.pagina.click(".sidebar .tab:has-text('Nómina')");
  assert.equal(await s.llamar(`tabActual`), "nomina");
  assert.equal(await s.llamar(`document.querySelector(".shell").classList.contains("menu-abierto")`), false);
  assert.match(await s.pagina.getAttribute(".bi-mas", "class"), /active/);
  // Escape también lo cierra
  await s.llamar(`abrirMenu()`);
  await s.pagina.keyboard.press("Escape");
  assert.equal(await s.llamar(`menuAbierto`), false);
  assert.deepEqual(s.errores, []);
});

test("teléfono de la secretaria: solo la barra de abajo con sus 3 pestañas y «Salir» arriba", async () => {
  const s = await entrar("josefajsanquez@gmail.com", { movil: true });
  assert.deepEqual(await textos(s, ".barra-inferior .tab-txt"), ["Inicio", "Caja", "Pagos"]);
  assert.equal(await s.pagina.$(".hb-menu"), null);
  assert.equal(await visible(s, ".header .hb-salir"), true);
  assert.equal(await s.pagina.$(".sb-grupo-titulo"), null);
});

test("Android: deslizar desde el borde izquierdo abre el menú y hacia la izquierda lo cierra", async () => {
  const s = await entrar("herrerajoicer@gmail.com", { movil: true, ua: ANDROID });
  assert.equal(await s.llamar(`document.documentElement.classList.contains("android")`), true);
  const deslizar = (x1, x2) =>
    s.llamar(`(() => {
      const t = (x) => new Touch({ identifier: 1, target: document.body, clientX: x, clientY: 400 });
      document.dispatchEvent(new TouchEvent("touchstart", { touches: [t(${x1})], changedTouches: [t(${x1})] }));
      document.dispatchEvent(new TouchEvent("touchend", { touches: [], changedTouches: [t(${x2})] }));
    })()`);
  await deslizar(8, 140);
  assert.equal(await s.llamar(`menuAbierto`), true);
  await deslizar(250, 60);
  assert.equal(await s.llamar(`menuAbierto`), false);
});

test("iPhone: el borde no abre el menú (es «volver»), no hay zoom en los campos y «Instalar» explica cómo", async () => {
  const s = await entrar("herrerajoicer@gmail.com", { movil: true, ua: IPHONE });
  assert.equal(await s.llamar(`document.documentElement.classList.contains("ios")`), true);
  await s.llamar(`(() => {
    const t = (x) => new Touch({ identifier: 1, target: document.body, clientX: x, clientY: 400 });
    document.dispatchEvent(new TouchEvent("touchstart", { touches: [t(8)], changedTouches: [t(8)] }));
    document.dispatchEvent(new TouchEvent("touchend", { touches: [], changedTouches: [t(140)] }));
  })()`);
  assert.equal(await s.llamar(`menuAbierto`), false);
  // Los campos con letra de 16 px o más (si no, el iPhone hace zoom al tocarlos)
  await s.llamar(`setTab("estudiantes")`);
  const tam = await s.llamar(`parseFloat(getComputedStyle(document.querySelector("#tab-content input")).fontSize)`);
  assert.ok(tam >= 16, "letra de " + tam + " px");
  // «📲 Instalar» con la guía de Compartir → Agregar a pantalla de inicio
  await s.pagina.waitForSelector(".hb-instalar");
  await s.llamar(`window.alert = (m) => (window.__ALERTA__ = m)`);
  await s.pagina.click(".hb-instalar");
  assert.match(await s.llamar(`window.__ALERTA__`), /Compartir[\s\S]*Agregar a pantalla de inicio/);
});

test("teléfono: en una tabla ancha el nombre queda fijo al deslizar de lado", async () => {
  const s = await entrar("herrerajoicer@gmail.com", { movil: true });
  await s.llamar(`(() => {
    const d = document.createElement("div");
    d.style.overflowX = "auto";
    d.setAttribute("style", "overflow-x:auto");
    d.innerHTML = '<table style="min-width:900px"><thead><tr style="background:#003366"><th>Nombre</th><th>A</th></tr></thead><tbody><tr><td id="celda-nombre">Ana</td><td>1</td></tr></tbody></table>';
    document.getElementById("tab-content").prepend(d);
  })()`);
  assert.equal(await s.llamar(`getComputedStyle(document.getElementById("celda-nombre")).position`), "sticky");
});

test("la entrada lleva el escudo de fondo girando y el escudo 3D (con sus dos caras, nunca al revés)", async () => {
  const s = await nav.nuevaPagina();
  await s.pagina.goto(nav.base);
  await s.pagina.waitForSelector("#l-email");
  assert.equal(await s.pagina.locator(".login-wrap .entrada-fondo .ef-escudo img").count(), 1);
  assert.equal(await s.pagina.locator(".login-card .escudo3d .e3-frente img").count(), 1);
  assert.equal(await s.pagina.locator(".login-card .escudo3d .e3-atras img").count(), 1);
  assert.equal(
    await s.pagina.evaluate(() => getComputedStyle(document.querySelector(".e3-giro")).animationName),
    "e3-girar"
  );
  assert.equal(
    await s.pagina.evaluate(() => getComputedStyle(document.querySelector(".e3-atras")).backfaceVisibility),
    "hidden"
  );
  // Los destellos tienen tamaño (no quedan en 0)
  assert.ok(
    await s.pagina.evaluate(() => parseFloat(getComputedStyle(document.querySelector(".ef-chispa")).width) >= 4)
  );
  // Con el ratón, el escudo se inclina hacia él
  await s.pagina.mouse.move(1200, 100);
  await s.pagina.waitForFunction(() => document.querySelector(".login-wrap").style.getPropertyValue("--incl-x") !== "");
  assert.deepEqual(s.errores, []);
});

test("entrada viva: lema que se escribe, conexión real, red de puntos y tarjeta que se inclina (quieta al escribir)", async () => {
  const s = await nav.nuevaPagina();
  await s.pagina.setViewportSize({ width: 1440, height: 900 });
  await s.pagina.goto(nav.base);
  await s.pagina.waitForSelector("#l-email");
  // El lema se escribe solo; los lectores de pantalla leen la frase completa
  assert.equal(await s.pagina.getAttribute(".login-lema", "aria-label"), "Excelente y mejorando cada día más");
  await s.pagina.waitForFunction(() => document.getElementById("lema-txt").textContent.startsWith("Excelente"));
  // Conexión de verdad
  assert.match(await s.pagina.textContent("#ef-estado"), /Conectado/);
  await s.contexto.setOffline(true);
  await s.pagina.waitForFunction(() => /Sin conexión/.test(document.getElementById("ef-estado").textContent));
  await s.contexto.setOffline(false);
  await s.pagina.waitForFunction(() => /Conectado/.test(document.getElementById("ef-estado").textContent));
  // La red de puntos está andando
  assert.equal(await s.pagina.evaluate(() => !!_red && _red.pts.length >= 18), true);
  // La tarjeta se inclina hacia el ratón…
  await s.pagina.mouse.move(1300, 120, { steps: 4 });
  await s.pagina.waitForFunction(
    () =>
      document.querySelector(".login-wrap").style.getPropertyValue("--card-x") !== "0deg" &&
      document.querySelector(".login-wrap").style.getPropertyValue("--card-x") !== ""
  );
  // …y queda quieta mientras se escribe
  await s.pagina.click("#l-email");
  await s.pagina.mouse.move(100, 800, { steps: 4 });
  await s.pagina.waitForTimeout(100);
  assert.equal(
    await s.pagina.evaluate(() => document.querySelector(".login-wrap").style.getPropertyValue("--card-x")),
    "0deg"
  );
  assert.deepEqual(s.errores, []);
});

test("en el modo pantalla táctil (PC sencilla) no hay red de puntos ni desenfoque real", async () => {
  const s = await nav.nuevaPagina();
  await s.pagina.addInitScript(() => localStorage.setItem("modoTactil", "1"));
  await s.pagina.goto(nav.base);
  await s.pagina.waitForSelector("#l-email");
  assert.equal(await s.pagina.$("#ef-red"), null);
  assert.equal(
    await s.pagina.evaluate(() => getComputedStyle(document.querySelector(".login-card")).backdropFilter),
    "none"
  );
});

test("en Inicio las cifras cuentan desde 0, pero el número escrito es siempre el real", async () => {
  const s = await entrar("herrerajoicer@gmail.com");
  const cifras = await s.pagina.$$eval(".stat-val.contando", (n) =>
    n.map((x) => [x.textContent, x.style.getPropertyValue("--fin")])
  );
  assert.ok(cifras.length >= 3);
  cifras.forEach(([texto, fin]) => assert.equal(texto, fin));
  await s.pagina.waitForFunction(() => !document.querySelector(".stat-val.contando"), null, { timeout: 3000 });
});
