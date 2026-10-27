// Autorización del día: la secretaria y control de estudio, al entrar, esperan a que el director los autorice; vale
// hasta la medianoche y el director la puede quitar (se les cierra la sesión).
//
// Uso: node --test tests/e2e/autorizacion.test.js
process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS = "1";
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { abrirNavegador } = require("./entorno");
const semilla = require("./datos/semilla");

// Hoy nadie está autorizado
const datos = JSON.parse(JSON.stringify(semilla));
datos.colecciones.autorizaciones = {};
datos.usuarios.push({ uid: "uid-control", email: "control@example.com", password: "prueba123" });
datos.colecciones.usuarios["uid-control"] = {
  nombre: "Encargada de Control de Estudio",
  correo: "control@example.com",
  rol: "docente",
  activo: true,
  controlEstudio: true,
};
semilla.ponerFichas(datos);

let nav;
before(async () => (nav = await abrirNavegador({ datos })));
after(async () => nav && nav.cerrar());

async function abrir(correo) {
  const s = await nav.nuevaPagina();
  s.llamar = (codigo) => s.pagina.evaluate(codigo);
  await s.pagina.goto(nav.base);
  await s.pagina.waitForSelector("#l-email");
  await s.pagina.fill("#l-email", correo);
  await s.pagina.fill("#l-pwd", "prueba123");
  await s.pagina.click("#login-btn");
  return s;
}
const autorizacion = (s, uid) =>
  s.llamar(`JSON.parse(JSON.stringify(__DATOS_FALSOS__.autorizaciones.get("${uid}") || null))`);

test("la secretaria espera la autorización; cuando el director autoriza entra sola, y si se la quita sale", async () => {
  const s = await abrir("josefajsanquez@gmail.com");
  await s.pagina.waitForSelector(".espera-autorizacion");
  assert.match(await s.pagina.textContent(".espera-autorizacion"), /Esperando la autorización del director/);
  assert.equal(await s.pagina.$(".tabs .tab"), null);
  // Su pedido queda escrito para el director (solo los campos del pedido)
  await s.pagina.waitForFunction(() => __DATOS_FALSOS__.autorizaciones.has("uid-admin"));
  const p = await autorizacion(s, "uid-admin");
  assert.equal(p.rol, "administradora");
  assert.equal(p.pide, await s.llamar("todayStr()"));
  assert.deepEqual(Object.keys(p).sort(), ["correo", "nombre", "pide", "pideHora", "rol"]);
  assert.equal(await s.llamar("estudiantes.length"), 0);
  // El director la autoriza (desde su equipo): la plataforma se abre sola
  await s.llamar(
    `__OTRO_EQUIPO__.escribir("autorizaciones", "uid-admin", { hasta: medianoche(), por: "herrerajoicer@gmail.com" })`
  );
  await s.pagina.waitForSelector(".tabs .tab");
  assert.equal(await s.llamar("rolUsuario"), "administradora");
  // El director le quita el acceso: se cierra su sesión y la entrada explica por qué
  await Promise.all([
    s.pagina.waitForNavigation(),
    s.llamar(`__OTRO_EQUIPO__.escribir("autorizaciones", "uid-admin", { hasta: 0 })`),
  ]);
  await s.pagina.waitForSelector("#l-email");
  const entrada = await s.pagina.textContent(".login-card");
  assert.match(entrada, /El director quitó el acceso/);
  assert.doesNotMatch(entrada, /sin usarla/);
  assert.deepEqual(s.errores, []);
});

test("control de estudio también espera; una docente normal entra directo", async () => {
  const c = await abrir("control@example.com");
  await c.pagina.waitForSelector(".espera-autorizacion");
  assert.match(await c.pagina.textContent(".espera-autorizacion"), /Encargada de Control de Estudio/);
  await c.pagina.waitForFunction(() => __DATOS_FALSOS__.autorizaciones.has("uid-control"));
  assert.equal((await autorizacion(c, "uid-control")).rol, "control");
  await c.llamar(`__OTRO_EQUIPO__.escribir("autorizaciones", "uid-control", { hasta: medianoche() })`);
  await c.pagina.waitForSelector(".tabs .tab");
  const d = await abrir("docente.prueba@example.com");
  await d.pagina.waitForSelector(".tabs .tab");
  assert.equal(await d.llamar("__DATOS_FALSOS__.autorizaciones.has('uid-docente')"), false);
});

test("salir mientras espera vuelve a la entrada sin abrir nada", async () => {
  const s = await abrir("josefajsanquez@gmail.com");
  await s.pagina.waitForSelector(".espera-autorizacion");
  await s.pagina.click(".espera-autorizacion button");
  await s.pagina.waitForSelector("#l-email");
  assert.equal(await s.llamar("_espera"), null);
  assert.equal(await s.llamar("auth"), false);
});

test("el director ve el pedido al instante, lo autoriza hoy y luego le quita el acceso desde Config", async () => {
  const s = await abrir("herrerajoicer@gmail.com");
  await s.pagina.waitForSelector(".tabs .tab");
  await s.llamar(
    `__OTRO_EQUIPO__.escribir("autorizaciones", "uid-admin", { correo: "josefajsanquez@gmail.com", nombre: "Josefa", rol: "administradora", pide: todayStr(), pideHora: "07:30" })`
  );
  await s.pagina.waitForSelector("#pedidos-autorizacion .pedido-aut");
  assert.match(await s.pagina.textContent("#pedidos-autorizacion"), /Josefa.*\(secretaria\) pide entrar · 07:30/);
  await s.pagina.click("#pedidos-autorizacion button");
  await s.pagina.waitForFunction(() => !document.getElementById("pedidos-autorizacion"));
  const a = await autorizacion(s, "uid-admin");
  assert.equal(a.hasta, await s.llamar("medianoche()"));
  assert.equal(a.por, "herrerajoicer@gmail.com");
  assert.equal(a.nombre, "Josefa"); // se conserva el pedido
  // Config → Docentes: «Accesos de hoy»
  await s.llamar(`subTab.config = "docentes"; setTab("config")`);
  await s.pagina.waitForSelector("#accesos-hoy");
  assert.match(await s.pagina.textContent("#accesos-hoy"), /Josefa · secretaria[\s\S]*Autorizada hoy/);
  assert.match(await s.pagina.textContent("#accesos-hoy"), /Encargada de Control de Estudio · control de estudio/);
  await s.llamar(`window.confirm = () => true`);
  await s.pagina.click("#accesos-hoy button:has-text('Quitar acceso')");
  await s.pagina.waitForFunction(() => __DATOS_FALSOS__.autorizaciones.get("uid-admin").hasta === 0);
  await s.pagina.waitForSelector("#accesos-hoy button:has-text('Autorizar hoy')");
  assert.equal(await s.pagina.$("#pedidos-autorizacion"), null); // no reaparece como pedido
  // Al salir deja de escuchar los pedidos
  assert.equal(await s.llamar(`__OTRO_EQUIPO__.oyentes("autorizaciones")`), 1);
  await s.llamar(`logout()`);
  await s.pagina.waitForSelector("#l-email");
  assert.equal(await s.llamar(`__OTRO_EQUIPO__.oyentes("autorizaciones")`), 0);
  assert.deepEqual(s.errores, []);
});
