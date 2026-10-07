// Limpieza de estudiantes duplicados en el navegador, con el Firebase falso (sin internet ni datos reales).
//
// Uso: node --test tests/e2e/duplicados.test.js
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { abrirNavegador } = require("./entorno");
const semilla = require("./datos/semilla");

const CLAVE = "prueba123";
const datos = JSON.parse(JSON.stringify(semilla));
const est = datos.colecciones.estudiantes;
// Se agregan copias de «Ana María Pérez» (est1, que tiene pagos) y de «Luis Alberto Gómez» (est2), más dos homónimos
const base = { jornada: "Mañana", mensualidad: 45, estado: "alsaldo", moraMonto: 0, anioEscolar: "2026-2027" };
est.dupA1 = { ...base, nombre: "Pérez, Ana María", grado: "1er Grado" };
est.dupA2 = { ...base, nombre: "PEREZ ANA MARIA", grado: "1er Grado", acudiente: "Carmen Pérez" };
est.dupL1 = { ...base, nombre: "Gómez Luis Alberto", grado: est.est2.grado, direccion: "Av. Principal, Turumo" };
est.homo1 = { ...base, nombre: "José Rojas", grado: "2do Grado", cedula: "V-31000001" };
est.homo2 = { ...base, nombre: "Rojas José", grado: "2do Grado", cedula: "V-31000002" };

let nav, sesion;
const pagina = () => sesion.pagina;
const llamar = (codigo) => pagina().evaluate(codigo);
const espera = () => pagina().evaluate(() => new Promise((ok) => setTimeout(ok, 80)));
const escrituras = () => pagina().evaluate(() => window.__ESCRITURAS__.slice());

async function entrar(correo) {
  await pagina().goto(nav.base);
  await pagina().waitForSelector("#l-email");
  await pagina().fill("#l-email", correo);
  await pagina().fill("#l-pwd", CLAVE);
  await pagina().click("#login-btn");
  await pagina().waitForSelector(".tabs .tab");
  await llamar("setTab('estudiantes')");
  await espera();
}

before(async () => {
  nav = await abrirNavegador({ datos });
  sesion = await nav.nuevaPagina();
  // el respaldo descarga un archivo: se deja pasar sin abrir nada
  await entrar("herrerajoicer@gmail.com");
});
after(async () => {
  await nav.cerrar();
});

test("el director ve el aviso de repetidos en Estudiantes", async () => {
  const html = await llamar("document.getElementById('tab-content').innerHTML");
  assert.match(html, /estudiantes? repetidos?/);
  assert.match(html, /Revisar y limpiar/);
});

test("el modal agrupa las copias, conserva la ficha con pagos y no mezcla homónimos con cédulas distintas", async () => {
  await llamar("abrirDuplicados()");
  await espera();
  const html = await llamar("document.getElementById('dup-body').innerHTML");
  assert.match(html, /Pérez, Ana María/);
  assert.match(html, /Gómez Luis Alberto/);
  assert.doesNotMatch(html, /José Rojas|Rojas José/); // cédulas distintas: son dos niños
  // la ficha original (con pagos) es la que se conserva: marcada con el radio
  const conservada = await llamar(`dupEstado.grupos.map(g => g.conservar)`);
  assert.ok(conservada.includes("est1") && conservada.includes("est2"));
  assert.deepEqual(await escrituras(), []); // mirar no escribe nada
});

test("«Eliminar copias de una vez» borra solo las copias, copia los datos que faltaban y no toca lo demás", async () => {
  sesion.dialogos.length = 0;
  await llamar("dupLimpiarSeguros()");
  await espera();
  const esc = await escrituras();
  const borradas = esc.filter((e) => e.op === "delete").map((e) => e.ruta);
  assert.deepEqual(borradas.sort(), ["estudiantes/dupA1", "estudiantes/dupA2", "estudiantes/dupL1"]);
  const act = esc.filter((e) => e.op === "update");
  // Ana ya tenía representante: no se pisa (ni siquiera se actualiza su ficha)
  assert.ok(!act.some((e) => e.ruta === "estudiantes/est1"));
  // Luis no tenía dirección: se copia desde la copia que se borra
  const deLuis = act.find((e) => e.ruta === "estudiantes/est2");
  assert.deepEqual(JSON.parse(JSON.stringify(deLuis.datos)), { direccion: "Av. Principal, Turumo" });
  assert.ok(
    esc.every((e) => !/pagos|finanzas/.test(e.ruta)),
    "no se toca ningún pago"
  );
  // los homónimos y los demás estudiantes siguen ahí
  const quedan = await llamar("estudiantes.map(e => e.id).sort()");
  for (const id of ["est1", "est2", "est3", "homo1", "homo2"]) assert.ok(quedan.includes(id), id);
  for (const id of ["dupA1", "dupA2", "dupL1"]) assert.ok(!quedan.includes(id), id);
  // se pidió confirmación (y se descargó un respaldo antes)
  assert.ok(
    sesion.dialogos.some((d) => /^confirm: Se eliminarán 3 copias/.test(d)),
    sesion.dialogos.join("\n")
  );
  // el modal ya no tiene grupos
  const html = await llamar("document.getElementById('dup-body').innerHTML");
  assert.match(html, /Ya no quedan estudiantes repetidos/);
});

test("el pagos de Ana María Pérez siguen apareciendo en su ficha después de limpiar", async () => {
  const n = await llamar("pagosDeEstudiante(estudiantes.find(e => e.id === 'est1')).length");
  assert.ok(n >= 1);
});

test("al cerrar, el aviso desaparece de la lista de Estudiantes", async () => {
  await llamar("cerrarModal()");
  await espera();
  const html = await llamar("document.getElementById('tab-content').innerHTML");
  assert.doesNotMatch(html, /estudiantes? repetidos?/);
  assert.deepEqual(sesion.errores, []);
});

test("la administradora no ve el aviso ni puede borrar (solo el director)", async () => {
  const otra = await nav.nuevaPagina();
  sesion = otra;
  await entrar("josefajsanquez@gmail.com");
  const html = await llamar("document.getElementById('tab-content').innerHTML");
  assert.doesNotMatch(html, /Revisar y limpiar/);
  const borrados = await llamar(
    "ejecutarFusion([{ borrar: [{ id: 'dupA1' }], campos: {}, conservar: { id: 'est1' } }])"
  );
  assert.equal(borrados, 0);
  assert.deepEqual(await escrituras(), []);
});
