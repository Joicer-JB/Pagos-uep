// Entrar con Google (las mismas cuentas, por su correo) y activar los avisos al teléfono (solo el director).
//
// Uso: node --test tests/e2e/google-avisos.test.js
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { abrirNavegador } = require("./entorno");

let nav;
before(async () => (nav = await abrirNavegador()));
after(async () => nav && nav.cerrar());

async function conGoogle(cuenta) {
  const s = await nav.nuevaPagina();
  await s.pagina.goto(nav.base);
  await s.pagina.waitForSelector("#login-google");
  await s.pagina.evaluate((c) => (window.__CUENTA_GOOGLE__ = c), cuenta);
  await s.pagina.click("#login-google");
  return s;
}

test("el director entra con su cuenta de Google y la sesión se recuerda en su equipo", async () => {
  const s = await conGoogle({ email: "herrerajoicer@gmail.com" });
  await s.pagina.waitForSelector(".tabs .tab");
  assert.match(await s.pagina.textContent("#rol-lbl"), /Director/);
  assert.equal(await s.pagina.evaluate("window.__PERSISTENCIA__"), "local");
});

test("la secretaria con Google: sesión solo mientras el navegador esté abierto (PC compartida)", async () => {
  const s = await conGoogle({ email: "josefajsanquez@gmail.com" });
  await s.pagina.waitForSelector(".tabs .tab");
  assert.equal(await s.pagina.evaluate("window.__PERSISTENCIA__"), "session");
  assert.equal(await s.pagina.evaluate("rolUsuario"), "administradora");
});

test("una cuenta de Google sin acceso no entra, y se explica", async () => {
  const s = await conGoogle({ email: "otra.persona@gmail.com" });
  await s.pagina.waitForSelector("#login-err .error-msg");
  assert.match(await s.pagina.textContent("#login-err"), /otra\.persona@gmail\.com no tiene acceso/);
  assert.equal(await s.pagina.evaluate("fbAuth.currentUser"), null);
});

test("si falta activar Google en Firebase, lo dice", async () => {
  const s = await conGoogle({ error: "auth/operation-not-allowed" });
  await s.pagina.waitForSelector("#login-err .error-msg");
  assert.match(await s.pagina.textContent("#login-err"), /Falta activar Google en Firebase/);
});

test("avisos al teléfono: se activan en el equipo, se elige qué avisos y se quitan", async () => {
  const s = await conGoogle({ email: "herrerajoicer@gmail.com" });
  await s.pagina.waitForSelector(".tabs .tab");
  const p = s.pagina;
  await p.evaluate(`setTab("config"); subTab.config = "avisos"; renderTabContent()`);
  await p.waitForSelector("text=Activar los avisos en este equipo");
  assert.doesNotMatch(await p.textContent("#tab-content"), /falta un paso en Firebase/); // la clave ya está puesta
  // sin la clave, lo explica
  await p.evaluate(`window.__CLAVE__ = VAPID_CLAVE; VAPID_CLAVE = ""; renderTabContent()`);
  assert.match(await p.textContent("#tab-content"), /falta un paso en Firebase/);
  // con la clave puesta y el permiso del navegador
  await p.evaluate(`VAPID_CLAVE = "clave-publica-de-prueba";
    window.__NOTIFICACIONES__ = [];
    Notification.requestPermission = async () => "granted";
    Object.defineProperty(navigator.serviceWorker, "ready", { configurable: true,
      value: Promise.resolve({ showNotification: (t, o) => window.__NOTIFICACIONES__.push(t) }) });
    renderTabContent()`);
  await p.click("text=Activar los avisos en este equipo");
  await p.waitForSelector(".aviso-equipo");
  const equipos = await p.evaluate(
    `[...(__DATOS_FALSOS__.avisos_dispositivos || new Map()).values()].map((d) => JSON.parse(JSON.stringify(d)))`
  );
  assert.equal(equipos.length, 1);
  assert.equal(equipos[0].token, "token-de-prueba-123");
  assert.equal(equipos[0].por, "herrerajoicer@gmail.com");
  assert.deepEqual(equipos[0].avisos, { dia: true, quincena: true, respaldo: true });
  assert.deepEqual(await p.evaluate("window.__NOTIFICACIONES__"), ["🔔 Avisos activados"]);
  assert.match(await p.textContent(".aviso-equipo"), /este equipo/);
  // sin el cierre del día
  await p.uncheck(".aviso-equipo input[type=checkbox] >> nth=0");
  await p.waitForTimeout(100);
  const d = await p.evaluate(
    `JSON.parse(JSON.stringify([...__DATOS_FALSOS__.avisos_dispositivos.values()][0].avisos))`
  );
  assert.equal(d.dia, false);
  await p.click(".aviso-equipo >> text=Quitar");
  await p.waitForTimeout(100);
  assert.equal(await p.evaluate(`__DATOS_FALSOS__.avisos_dispositivos.size`), 0);
  assert.deepEqual(s.errores, []);
});

test("¿Olvidaste tu contraseña?: pide el correo y manda el enlace, sin revelar si la cuenta existe", async () => {
  const s = await nav.nuevaPagina();
  await s.pagina.goto(nav.base);
  await s.pagina.waitForSelector("#login-olvide");
  await s.pagina.click("#login-olvide");
  assert.match(await s.pagina.textContent("#login-err"), /Escribe tu correo arriba/);
  for (const correo of ["docente.prueba@example.com", "nadie@example.com"]) {
    await s.pagina.fill("#l-email", correo);
    await s.pagina.click("#login-olvide");
    await s.pagina.waitForSelector("#login-err .alert-info");
    assert.match(
      await s.pagina.textContent("#login-err"),
      new RegExp("Si " + correo.replace(/\./g, "\\.") + " tiene una cuenta")
    );
  }
  assert.deepEqual(await s.pagina.evaluate("window.__CLAVE_OLVIDADA__"), [
    "docente.prueba@example.com",
    "nadie@example.com",
  ]);
  assert.equal(await s.pagina.evaluate("fbAuth.languageCode"), "es");
  assert.deepEqual(s.errores, []);
});
