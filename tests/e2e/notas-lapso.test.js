// Notas de Media General por ahora: control de estudio carga la nota final de cada lapso en cada materia (la que
// entrega el profesor), sin plan de evaluación ni evaluaciones (NOTAS_DETALLADAS = false en config.js).
//
// Uso: node --test tests/e2e/notas-lapso.test.js
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const semilla = require("./datos/semilla");
const { abrirNavegador } = require("./entorno");

// La encargada de control de estudio: su cuenta de docente marcada «Control de estudio» (aunque tenga algo asignado,
// carga todas las notas)
const datos = JSON.parse(JSON.stringify(semilla));
datos.usuarios.push({ uid: "uid-control", email: "control@example.com", password: "prueba123" });
datos.colecciones.usuarios["uid-control"] = {
  nombre: "Encargada de Control de Estudio",
  correo: "control@example.com",
  rol: "docente",
  activo: true,
  controlEstudio: true,
  grado: "3er Grado",
  materias: ["1er Año::Inglés"],
};
semilla.ponerFichas(datos);

let nav, s;
const llamar = (c) => s.pagina.evaluate(c);
const campo = (m) => `[id='nota_est2_Lapso 1_${m}_lapso']`;

before(async () => {
  nav = await abrirNavegador({ datos });
  s = await nav.nuevaPagina();
  await s.pagina.goto(nav.base);
  await s.pagina.waitForSelector("#l-email");
  await s.pagina.fill("#l-email", "control@example.com");
  await s.pagina.fill("#l-pwd", "prueba123");
  await s.pagina.click("#login-btn");
  await s.pagina.waitForSelector(".tabs .tab");
});
after(async () => nav && nav.cerrar());

test("control de estudio ve todos los grados y carga la nota de cada lapso, sin plan de evaluación", async () => {
  const grados = await s.pagina.$$eval("select:has(option:text('-- Todos los grados --')) option", (o) =>
    o.map((x) => x.value).filter(Boolean)
  );
  assert.deepEqual(grados, ["Nivel II", "1er Grado", "3er Grado", "1er Año", "5to Año"]);
  await llamar(`filtros.estSelId = "est2"; filtros.lapso = "Lapso 1"; renderTabContent()`);
  // Una casilla por materia, todas habilitadas, y nada de evaluaciones ni plan
  for (const m of ["Matemáticas", "Lengua y Literatura", "Inglés"])
    assert.equal(await s.pagina.isDisabled(campo(m)), false);
  assert.equal(await s.pagina.locator("text=⚙️ Plan").count(), 0);
  assert.equal(await s.pagina.locator(".eval-celda").count(), 0);

  await s.pagina.fill(campo("Matemáticas"), "16.5");
  await s.pagina.dispatchEvent(campo("Matemáticas"), "change");
  await s.pagina.fill(campo("Inglés"), "9");
  await s.pagina.dispatchEvent(campo("Inglés"), "change");
  await llamar(`guardarNotas("est2", "Lapso 1")`);
  const esc = await llamar(`__ESCRITURAS__.filter((e) => e.ruta === "notas/est2_Lapso 1").at(-1)`);
  assert.deepEqual(Object.keys(esc.datos).sort(), ["Inglés_lapso", "Matemáticas_lapso", "estId", "lapso", "updatedAt"]);
  assert.equal(esc.datos.Matemáticas_lapso, "16.5");
  assert.match(s.dialogos.at(-1), /Notas guardadas/);
});

test("la sábana y el boletín usan esas notas; la sábana no tiene el detalle por evaluaciones", async () => {
  await llamar(`filtros.notasVista = "sabana"; filtros.sabGrado = "1er Año"; renderTabContent()`);
  await s.pagina.waitForSelector(".sab-tabla");
  assert.deepEqual(await s.pagina.$$eval("#sab-ver option", (o) => o.map((x) => x.value)), [
    "anio",
    "Lapso 1",
    "Lapso 2",
    "Lapso 3",
  ]);
  const luis = await s.pagina
    .locator(".sabana-wrap .sab-tabla tbody tr", { hasText: "Luis Alberto Gómez" })
    .locator("td")
    .allTextContents();
  assert.deepEqual(luis.slice(3, 8), ["16,5", "-", "-", "16,5", ""]); // Matemáticas (sin cambio del consejo: M vacía)
  assert.deepEqual(luis.slice(13, 18), ["9", "-", "-", "9", ""]); // Inglés (reprobada)
  assert.equal(luis.at(-1), "12,8"); // (16,5 + 9) / 2

  await llamar(`imprimirBoletin("est2")`);
  const p = await s.contexto.newPage();
  await p.setContent(await llamar(`window.__IMPRESIONES__.at(-1).html`));
  const filas = await p.$$eval(".b-notas tbody tr", (t) =>
    t.map((r) => [...r.children].map((c) => c.textContent.trim()))
  );
  assert.deepEqual(filas[0], ["1", "Matemáticas", "16,5", "—", "—", "16,5", "Aprobada"]);
  assert.deepEqual(filas[2], ["3", "Inglés", "9", "—", "—", "9", "Pendiente"]);
  await p.close();
  assert.deepEqual(s.errores, []);
});
