// La PC de la administradora a veces la usa otra persona: su sesión dura hasta cerrar el navegador, se cierra sola
// después de 30 minutos sin usarla y, al salir, se borra la copia de los datos que guarda el equipo. Sin internet no
// deja salir si hay cobros que aún no se subieron. En la PC del director (personal) todo queda como antes.
//
// Uso: node --test tests/e2e/equipo-compartido.test.js
// Al salir, la página se vuelve a abrir y el service worker pide las bibliotecas: que también se sirvan sin internet
process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS = "1";
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { abrirNavegador } = require("./entorno");

const ADMIN = "josefajsanquez@gmail.com",
  DIRECTOR = "herrerajoicer@gmail.com";
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
  return s;
}
const limpieza = (s) => s.llamar(`sessionStorage.getItem("__LIMPIEZA__") || ""`);

test("la sesión de la administradora dura hasta cerrar el navegador; la del director se recuerda", async () => {
  const a = await entrar(ADMIN);
  assert.equal(await a.llamar("window.__PERSISTENCIA__"), "session");
  const d = await entrar(DIRECTOR);
  assert.equal(await d.llamar("window.__PERSISTENCIA__"), "local");
});

test("al salir, la administradora borra la copia local de los datos y vuelve a la entrada", async () => {
  const s = await entrar(ADMIN);
  await Promise.all([s.pagina.waitForNavigation(), s.llamar(`logout()`)]);
  await s.pagina.waitForSelector("#l-email");
  assert.equal(await limpieza(s), "terminate,clearPersistence,");
  assert.equal(await s.llamar(`fbAuth.currentUser`), null);
  assert.deepEqual(s.errores, []);
});

test("el director, en su PC personal, sale sin borrar la copia (sigue sirviendo sin internet)", async () => {
  const s = await entrar(DIRECTOR);
  await s.llamar(`logout()`);
  await s.pagina.waitForSelector("#l-email");
  assert.equal(await limpieza(s), "");
});

test("sin internet y con cobros sin subir, no deja salir (se perderían) y lo explica", async () => {
  const s = await entrar(ADMIN);
  await s.contexto.setOffline(true);
  await s.llamar(
    `pagos.unshift({ id: "prov1", nombre: "Ana", total: 10, fecha: todayStr(), pendiente: true, factura: "PROV-X" })`
  );
  await s.llamar(`logout()`);
  assert.match(s.dialogos.at(-1), /cobros hechos sin conexión que todavía no se han subido/);
  assert.equal(await s.llamar(`auth`), true, "sigue adentro");
  assert.equal(await limpieza(s), "");
  await s.contexto.setOffline(false);
});

test("después de 30 minutos sin usarla se cierra sola, y la entrada explica por qué", async () => {
  const s = await entrar(ADMIN);
  await s.llamar(`revisarInactividad()`);
  assert.equal(await s.llamar(`auth`), true, "recién usada: sigue abierta");
  await Promise.all([
    s.pagina.waitForNavigation(),
    s.llamar(`_ultimaActividad = Date.now() - 31 * 60000; revisarInactividad()`),
  ]);
  await s.pagina.waitForSelector("#l-email");
  assert.match(await s.pagina.textContent(".login-card"), /se cerró sola después de 30 minutos/);
  assert.equal(await limpieza(s), "terminate,clearPersistence,");
});

test("al director no se le cierra por inactividad", async () => {
  const s = await entrar(DIRECTOR);
  await s.llamar(`_ultimaActividad = Date.now() - 120 * 60000; revisarInactividad()`);
  assert.equal(await s.llamar(`auth`), true);
});
