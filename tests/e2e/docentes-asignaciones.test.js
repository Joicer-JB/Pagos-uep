// Cada profesor ve a sus estudiantes y carga solo lo suyo: en Inicial y Primaria, un docente por grado (todas las
// áreas); en Media General, un profesor por materia y año. La sábana dice quién da cada materia, y el boletín lleva el
// nombre del docente del grado (Primaria) o del profesor guía (Media General).
//
// Uso: node --test tests/e2e/docentes-asignaciones.test.js
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const semilla = require("./datos/semilla");
const { abrirNavegador } = require("./entorno");

// La profesora de prueba: docente de aula de 3er Grado y profesora de Inglés de 1er Año
const datos = JSON.parse(JSON.stringify(semilla));
const col = datos.colecciones;
Object.assign(col.usuarios["uid-docente"], { grado: "3er Grado", materias: ["1er Año::Inglés"] });
col.notas["est2_Lapso 1"] = {
  estId: "est2",
  lapso: "Lapso 1",
  Matemáticas_1: "15",
  Inglés_1: "12",
  updatedAt: { seconds: 1791000000, nanoseconds: 0 },
};
semilla.ponerFichas(datos);

let nav;
async function entrar(correo) {
  const s = await nav.nuevaPagina();
  await s.pagina.goto(nav.base);
  await s.pagina.waitForSelector("#l-email");
  await s.pagina.fill("#l-email", correo);
  await s.pagina.fill("#l-pwd", "prueba123");
  await s.pagina.click("#login-btn");
  await s.pagina.waitForSelector(".tabs .tab");
  s.llamar = (c) => s.pagina.evaluate(c);
  return s;
}
const opciones = (s, sel) => s.pagina.$$eval(sel + " option", (o) => o.map((x) => x.value).filter(Boolean));

before(async () => {
  nav = await abrirNavegador({ datos });
});
after(async () => nav && nav.cerrar());

test("la profesora ve solo sus grados y carga solo sus materias", async () => {
  const s = await entrar("docente.prueba@example.com");
  await s.llamar(`setTab("notas")`);
  await s.pagina.waitForSelector("text=Consultar Notas");
  // Su grado de Primaria y el año donde da Inglés; nadie más
  assert.deepEqual(await opciones(s, "select:has(option:text('-- Todos los grados --'))"), ["3er Grado", "1er Año"]);
  assert.deepEqual(await opciones(s, "select:has(option:text('-- Seleccionar estudiante --'))"), ["est2", "est6"]);
  assert.match(await s.pagina.textContent(".ayuda"), /cargas las notas de tus materias/);

  // 1er Año: Inglés se puede cargar; Matemáticas y Lengua, no (son de otros profesores)
  await s.llamar(`filtros.estSelId = "est2"; filtros.lapso = "Lapso 1"; renderTabContent()`);
  assert.equal(await s.pagina.isDisabled("[id='nota_est2_Lapso 1_Inglés_1']"), false);
  assert.equal(await s.pagina.isDisabled("[id='nota_est2_Lapso 1_Matemáticas_1']"), true);
  assert.equal(await s.pagina.isDisabled("[id='nota_est2_Lapso 1_Lengua y Literatura_1']"), true);
  assert.equal(await s.pagina.locator("text=⚙️ Plan").count(), 1);
  await s.llamar(`abrirPlanEvaluacion("1er Año", "Matemáticas", "Lapso 1")`);
  assert.equal(await s.pagina.locator("#plan-nombre-0").count(), 0);
  assert.match(s.dialogos.at(-1), /lo arma su profesor/);

  // Al guardar solo viaja lo que ella cambió: no pisa las notas de otros profesores
  await s.pagina.fill("[id='nota_est2_Lapso 1_Inglés_1']", "17");
  await s.pagina.dispatchEvent("[id='nota_est2_Lapso 1_Inglés_1']", "change");
  await s.llamar(`guardarNotas("est2", "Lapso 1")`);
  const esc = await s.llamar(`__ESCRITURAS__.filter((e) => e.ruta === "notas/est2_Lapso 1").at(-1)`);
  assert.deepEqual(Object.keys(esc.datos).sort(), ["Inglés_1", "estId", "lapso", "updatedAt"]);
  assert.equal(esc.datos.Inglés_1, "17");

  // 3er Grado: es su grado, carga todas las áreas
  await s.llamar(`filtros.estSelId = "est6"; renderTabContent()`);
  assert.equal(await s.pagina.locator("input[type=radio]:disabled").count(), 0);

  // La sábana: solo los años donde da clase, y su nombre en su materia
  await s.llamar(`filtros.notasVista = "sabana"; renderTabContent()`);
  assert.deepEqual(await opciones(s, "#sab-grado"), ["1er Año"]);
  assert.match(await s.pagina.textContent(".sab-tabla thead"), /InglésProfesora Prueba/);
  assert.deepEqual(s.errores, []);
});

test("el director ve todo, con quién da cada materia, y el boletín lleva el docente y el profesor guía", async () => {
  const s = await entrar("herrerajoicer@gmail.com");
  await s.llamar(`setTab("notas"); filtros.notasVista = "sabana"; renderTabContent()`);
  await s.pagina.waitForSelector(".sab-tabla");
  assert.deepEqual(await opciones(s, "#sab-grado"), ["1er Año", "5to Año"]);
  assert.match(await s.pagina.textContent(".sab-tabla thead"), /InglésProfesora Prueba/);

  // ⚙️ Config → 🏫 Institución: el profesor guía de 1er Año
  await s.llamar(`setTab("config"); subTab.config = "institucion"; renderTabContent()`);
  await s.pagina.fill(".inst-guia[data-grado='1er Año']", "Prof. Ramón Díaz");
  await s.pagina.click("text=💾 Guardar datos institucionales");
  await s.pagina.waitForFunction(() => configInst.guias && configInst.guias["1er Año"]);
  const inst = await s.llamar(`JSON.parse(JSON.stringify(__DATOS_FALSOS__.config.get("institucion")))`);
  assert.deepEqual(inst.guias, { "1er Año": "Prof. Ramón Díaz" });

  await s.llamar(`imprimirBoletin("est2")`);
  assert.match(await s.llamar(`window.__IMPRESIONES__.at(-1).html`), /Prof\. Ramón Díaz<\/div>Docente guía/);
  await s.llamar(`imprimirBoletin("est6")`);
  assert.match(await s.llamar(`window.__IMPRESIONES__.at(-1).html`), /Profesora Prueba<\/div>Docente</);
  assert.deepEqual(s.errores, []);
});
