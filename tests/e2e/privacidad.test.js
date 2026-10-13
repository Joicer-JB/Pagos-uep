// Privacidad: los docentes leen las fichas de «estudiantes_docentes» (sin teléfonos, correo, deuda...),
// y la app del director y de la administradora las mantiene al día sola.
//
// Uso: node --test tests/e2e/privacidad.test.js
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { abrirNavegador } = require("./entorno");

const DIRECTOR = "herrerajoicer@gmail.com";
const DOCENTE = "docente.prueba@example.com";
const PRIVADOS = ["telefonoAcudiente", "correoAcudiente", "cedulaAcudiente", "telefono", "deuda", "mensualidad"];
const PRIVADOS_MAS = [...PRIVADOS, "observacionesMedicas", "moraMonto", "moraConcepto", "sinRecargo", "cuotaDesde"];

let nav;
before(async () => (nav = await abrirNavegador()));
after(async () => nav && nav.cerrar());

// Abre una página nueva (base de datos recién sembrada), prepara lo que haga falta y entra con esa cuenta
async function entrar(correo, preparar = "") {
  const s = await nav.nuevaPagina();
  await s.pagina.goto(nav.base);
  await s.pagina.waitForSelector("#l-email");
  if (preparar) await s.pagina.evaluate(preparar);
  await s.pagina.fill("#l-email", correo);
  await s.pagina.fill("#l-pwd", "prueba123");
  await s.pagina.click("#login-btn");
  await s.pagina.waitForSelector(".tabs .tab");
  s.llamar = (codigo) => s.pagina.evaluate(codigo);
  s.fichas = () => s.llamar(`Object.fromEntries(__DATOS_FALSOS__.estudiantes_docentes || new Map())`);
  s.escriturasFichas = () =>
    s.llamar(`window.__ESCRITURAS__.filter((e) => e.ruta.startsWith("estudiantes_docentes/"))`);
  return s;
}
const esperar = (s, ms = 1200) => s.pagina.waitForTimeout(ms); // las fichas se escriben 0,8 s después del cambio

test("el docente no lee la colección «estudiantes» y no tiene en memoria ningún dato privado", async () => {
  const s = await entrar(DOCENTE, `window.__DENEGAR__ = ["estudiantes"]`); // como las reglas nuevas
  const enMemoria = await s.llamar(`estudiantes`);
  assert.ok(enMemoria.length >= 5, "debe ver la lista de estudiantes");
  for (const e of enMemoria) for (const k of PRIVADOS_MAS) assert.equal(e[k], undefined, `${e.nombre}: ${k}`);
  // «mora» habla de la deuda: no llega; «retirado» sí (para no listarlo)
  assert.ok(enMemoria.every((e) => e.estado === undefined || e.estado === "retirado"));
  // Puede cargar notas e imprimir el boletín con cédula, fecha de nacimiento y representante
  const id = enMemoria.find((e) => e.cedula).id;
  await s.llamar(
    `filtros.estSelId = ${JSON.stringify(id)}; renderTabContent(); imprimirBoletin(${JSON.stringify(id)})`
  );
  const boletin = await s.llamar(`window.__IMPRESIONES__.at(-1).html`);
  const est = enMemoria.find((e) => e.id === id);
  assert.ok(boletin.includes(est.cedula) && boletin.includes(est.nombre));
  assert.deepEqual(s.errores, []);
});

test("con las reglas anteriores (fichas aún no permitidas), el docente sigue trabajando con la lista completa", async () => {
  const s = await entrar(DOCENTE, `window.__DENEGAR__ = ["estudiantes_docentes"]`);
  assert.ok((await s.llamar(`estudiantes.length`)) >= 5);
  assert.ok(await s.pagina.isVisible("text=Consultar Notas"));
});

test("si las fichas aún no existen, el docente ve un aviso claro", async () => {
  const s = await entrar(
    DOCENTE,
    `[...__DATOS_FALSOS__.estudiantes_docentes.keys()].forEach((id) => __OTRO_EQUIPO__.borrar("estudiantes_docentes", id))`
  );
  assert.equal(await s.llamar(`estudiantes.length`), 0);
  assert.match(await s.pagina.textContent("#tab-content"), /La lista de estudiantes todavía no está lista/);
});

test("al entrar el director, se crean las fichas que faltan (sin datos privados)", async () => {
  const s = await entrar(
    DIRECTOR,
    `[...__DATOS_FALSOS__.estudiantes_docentes.keys()].forEach((id) => __OTRO_EQUIPO__.borrar("estudiantes_docentes", id))`
  );
  await esperar(s);
  const fichas = await s.fichas();
  const ids = await s.llamar(`estudiantes.map((e) => e.id).sort()`);
  assert.deepEqual(Object.keys(fichas).sort(), ids);
  for (const f of Object.values(fichas)) for (const k of PRIVADOS_MAS) assert.equal(f[k], undefined);
  assert.ok((await s.escriturasFichas()).every((e) => e.op === "set"));
});

test("si las fichas ya están al día, entrar no escribe nada", async () => {
  const s = await entrar(DIRECTOR);
  await esperar(s);
  assert.deepEqual(await s.escriturasFichas(), []);
});

test("editar, agregar y borrar estudiantes actualiza solo las fichas que cambian", async () => {
  const s = await entrar(DIRECTOR);
  await esperar(s);
  const est = await s.llamar(`estudiantes.find((e) => e.cedula && e.estado !== "retirado")`);

  // Un dato privado (teléfono del representante) no toca la ficha
  await s.llamar(
    `db.collection("estudiantes").doc(${JSON.stringify(est.id)}).update({ telefonoAcudiente: "04140000000", deuda: 99 })`
  );
  await esperar(s);
  assert.deepEqual(await s.escriturasFichas(), []);

  // Cambiar el grado sí
  await s.llamar(`db.collection("estudiantes").doc(${JSON.stringify(est.id)}).update({ grado: "6to Grado" })`);
  await esperar(s);
  let w = await s.escriturasFichas();
  assert.equal(w.length, 1);
  assert.equal(w[0].ruta, "estudiantes_docentes/" + est.id);
  assert.equal(w[0].datos.grado, "6to Grado");
  assert.equal(w[0].datos.telefonoAcudiente, undefined);

  // Nuevo estudiante → ficha nueva; borrado → ficha borrada
  await s.llamar(
    `db.collection("estudiantes").doc("nuevo1").set({ nombre: "Zoe Nueva", grado: "1er Grado", deuda: 5 })`
  );
  await esperar(s);
  assert.deepEqual((await s.fichas()).nuevo1, { nombre: "Zoe Nueva", grado: "1er Grado" });
  await s.llamar(`db.collection("estudiantes").doc("nuevo1").delete()`);
  await esperar(s);
  assert.equal((await s.fichas()).nuevo1, undefined);
  w = await s.escriturasFichas();
  assert.deepEqual(
    w.map((e) => e.op + " " + e.ruta),
    ["set estudiantes_docentes/" + est.id, "set estudiantes_docentes/nuevo1", "delete estudiantes_docentes/nuevo1"]
  );
  assert.deepEqual(s.errores, []);
});

test("un cambio hecho en otro equipo también llega a las fichas", async () => {
  const s = await entrar(DIRECTOR);
  await esperar(s);
  await s.llamar(`__OTRO_EQUIPO__.escribir("estudiantes", "est1", { nombre: "Ana María Pérez Gil" })`);
  await esperar(s);
  assert.equal((await s.fichas()).est1.nombre, "Ana María Pérez Gil");
});

test("con las reglas anteriores (fichas aún no permitidas), el director trabaja normal y sin errores", async () => {
  const s = await entrar(DIRECTOR, `window.__DENEGAR__ = ["estudiantes_docentes"]`);
  await esperar(s);
  await s.llamar(`db.collection("estudiantes").doc("est1").update({ grado: "2do Grado" })`);
  await esperar(s);
  assert.deepEqual(await s.escriturasFichas(), []);
  assert.deepEqual(s.errores, []);
  assert.deepEqual(s.dialogos, []);
});
