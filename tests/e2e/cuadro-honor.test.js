// 📝 Notas → 🏆 Cuadro de honor (media general): qué año tiene el mejor promedio, los 10 mejores promedios de toda
// media general y los 3 mejores de cada año, por lapso o del año completo.
//
// Uso: node --test tests/e2e/cuadro-honor.test.js
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const semilla = require("./datos/semilla");
const { abrirNavegador } = require("./entorno");

// 1er Año: Matemáticas, Lengua y Literatura e Inglés (Configuración). 5to Año: las materias de siempre (11).
const datos = JSON.parse(JSON.stringify(semilla));
const col = datos.colecciones;
const MATERIAS_5TO = [
  "Matemáticas",
  "Lengua y Literatura",
  "Ciencias Naturales",
  "Ciencias Sociales",
  "Inglés",
  "Educación Física",
  "Arte y Patrimonio",
  "Religión",
  "Química",
  "Física",
  "Turismo y Fotografía",
];
const nuevo = (id, nombre, grado) =>
  (col.estudiantes[id] = { ...col.estudiantes.est2, nombre, cedula: "V-" + id, grado, estado: "alsaldo" });
nuevo("a1", "Andrea Blanco", "1er Año");
nuevo("a2", "Pedro Zambrano", "1er Año");
nuevo("a3", "Rosa Mejías", "1er Año");
nuevo("a4", "Tomás Ruiz", "1er Año");
nuevo("b1", "Daniela Mora", "5to Año");
const ts = { seconds: 1791000000, nanoseconds: 0 };
// Una evaluación por materia en el 1er lapso: la nota del lapso es esa misma
const lapso1 = (estId, notas) => {
  col.notas[estId + "_Lapso 1"] = {
    estId,
    lapso: "Lapso 1",
    ...Object.fromEntries(Object.entries(notas).map(([m, v]) => [m + "_1", String(v)])),
    updatedAt: ts,
  };
};
const primero = (m, l, i) => ({ Matemáticas: m, "Lengua y Literatura": l, Inglés: i });
lapso1("est2", primero(18, 18, 18)); // Luis: 18
lapso1("a1", primero(19, 20, 19)); // Andrea: 19,3
lapso1("a2", primero(18, 18, 18)); // Pedro: 18 (empata con Luis)
lapso1("a3", primero(20, 9, 20)); // Rosa: 16,3, con Lengua reprobada
lapso1("a4", { Matemáticas: 15 }); // Tomás: le faltan materias
lapso1("est4", Object.fromEntries(MATERIAS_5TO.map((m) => [m, 20]))); // Carlos: 20
lapso1("b1", Object.fromEntries(MATERIAS_5TO.map((m) => [m, 12]))); // Daniela: 12
semilla.ponerFichas(datos);

let nav, s;
const llamar = (c) => s.pagina.evaluate(c);
const filas = (sel) =>
  s.pagina.$$eval(sel + " tbody tr", (t) => t.map((r) => [...r.children].map((c) => c.textContent.trim())));

before(async () => {
  nav = await abrirNavegador({ datos });
  s = await nav.nuevaPagina();
  await s.pagina.goto(nav.base);
  await s.pagina.waitForSelector("#l-email");
  await s.pagina.fill("#l-email", "herrerajoicer@gmail.com");
  await s.pagina.fill("#l-pwd", "prueba123");
  await s.pagina.click("#login-btn");
  await s.pagina.waitForSelector(".tabs .tab");
  await llamar(`setTab("notas")`);
  await s.pagina.click("text=🏆 Cuadro de honor");
  await s.pagina.waitForSelector(".cuadro-honor");
});
after(async () => nav && nav.cerrar());

test("el año con mejor promedio: el de todos sus estudiantes con notas", async () => {
  // 1er Año: (18 + 19,33 + 18 + 16,33 + 15) / 5 = 17,3 · 5to Año: (20 + 12) / 2 = 16
  assert.deepEqual(await filas(".honor-anios-tabla"), [
    ["🥇", "1er Año", "17,3", "5 de 5", "1"],
    ["🥈", "5to Año", "16", "2 de 2", "-"],
  ]);
});

test("mejores promedios: solo con nota en todas las materias y sin reprobadas; los empatados comparten el puesto", async () => {
  const general = await filas(".cuadro-honor > .honor-tabla:not(.honor-anios-tabla)");
  assert.deepEqual(general, [
    ["🥇", "Carlos Eduardo Díaz", "5to Año", "20"],
    ["🥈", "Andrea Blanco", "1er Año", "19,3"],
    ["🥉", "Luis Alberto Gómez", "1er Año", "18"],
    ["🥉", "Pedro Zambrano", "1er Año", "18"],
    ["5°", "Daniela Mora", "5to Año", "12"],
  ]);
  const anios = await s.pagina.$$eval(".honor-anio", (d) =>
    d.map((x) => [
      x.querySelector(".section-title").textContent,
      [...x.querySelectorAll("tr")].map((r) => r.children[1].textContent.trim()),
    ])
  );
  assert.deepEqual(anios, [
    ["1er Año", ["Andrea Blanco", "Luis Alberto Gómez", "Pedro Zambrano"]],
    ["5to Año", ["Carlos Eduardo Díaz", "Daniela Mora"]],
  ]);
  assert.match(
    await s.pagina.textContent(".ayuda"),
    /No entran: 1 estudiante todavía sin nota en todas sus materias · 1 con alguna materia reprobada/
  );

  // Con las reprobadas: Rosa entra en el 5° puesto, marcada
  await s.pagina.check("#honor-reprobadas");
  const con = await filas(".cuadro-honor > .honor-tabla:not(.honor-anios-tabla)");
  assert.deepEqual(con[4], ["5°", "Rosa Mejías 1 reprobada", "1er Año", "16,3"]);
  await s.pagina.uncheck("#honor-reprobadas");
  assert.deepEqual(s.errores, []);
});

test("por lapso, e impreso para la cartelera", async () => {
  await s.pagina.selectOption("#honor-periodo", "Lapso 2");
  assert.match(await s.pagina.textContent(".cuadro-honor"), /Todavía no hay estudiantes .* en el Lapso 2/);
  await s.pagina.selectOption("#honor-periodo", "Lapso 1");
  await s.pagina.waitForSelector(".honor-anios-tabla");
  await s.pagina.click("text=🖨️ Imprimir");
  const html = await llamar(`window.__IMPRESIONES__.at(-1).html`);
  assert.match(html, /CUADRO DE HONOR/);
  assert.match(html, /Años con mejor promedio[\s\S]*1er Año[\s\S]*17,3/);
  assert.match(html, /Carlos Eduardo Díaz/);
  // El buscador lleva aquí
  assert.ok(await llamar(`accionesBusq(nB("mejores promedios")).some((a) => /Cuadro de honor/.test(a.titulo))`));
  assert.deepEqual(s.errores, []);
});
