// Calificaciones de media general: plan de evaluación con porcentajes, nota del lapso, definitiva, ajustes del consejo
// y promedio (js/servicios/calificaciones.js). La sábana, la pestaña Notas y el boletín usan estas funciones.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { cargar } = require("./cargar");

const app = cargar("js/config.js", "js/servicios/calificaciones.js");
app.evaluar("var notas = {}");
const est = { id: "e1", grado: "1er Año" };
const conNotas = (n) => {
  app.evaluar(`notas = ${JSON.stringify(n)}`);
};
const lapso = (m, l) => JSON.parse(JSON.stringify(app.evaluar("notaLapsoDe")(est, m, l)));
const definitiva = (m) => JSON.parse(JSON.stringify(app.evaluar("definitivaDe")(est, m)));

test("sin plan: 3 evaluaciones que valen igual, como siempre (un decimal)", () => {
  conNotas({ "e1_Lapso 1": { Matemáticas_1: "15", Matemáticas_2: "16", Matemáticas_3: "18" } });
  const x = lapso("Matemáticas", "Lapso 1");
  assert.equal(x.evaluaciones.length, 3);
  assert.equal(x.nota, 16.3);
  assert.equal(x.faltan, 0);
});

test("con plan y porcentajes: promedio ponderado; con evaluaciones sin nota, sobre lo ya evaluado", () => {
  const plan = {
    tipo: "plan",
    grado: "1er Año",
    materias: {
      Matemáticas: {
        "Lapso 1": {
          ultimoN: 4,
          evals: [
            { n: 1, nombre: "Prueba", peso: 30 },
            { n: 2, nombre: "Taller", peso: 20 },
            { n: 4, nombre: "Proyecto", peso: 50 },
          ],
        },
      },
    },
  };
  conNotas({ "plan__1er Año": plan, "e1_Lapso 1": { Matemáticas_1: "20", Matemáticas_2: "10", Matemáticas_3: "1" } });
  let x = lapso("Matemáticas", "Lapso 1");
  // La evaluación 3 se quitó del plan: su nota no cuenta. Falta el proyecto: (20×30 + 10×20) / 50 = 16
  assert.deepEqual(
    x.evaluaciones.map((e) => [e.nombre, e.nota]),
    [
      ["Prueba", 20],
      ["Taller", 10],
      ["Proyecto", null],
    ]
  );
  assert.equal(x.nota, 16);
  assert.equal(x.faltan, 1);
  conNotas({ "plan__1er Año": plan, "e1_Lapso 1": { Matemáticas_1: "20", Matemáticas_2: "10", Matemáticas_4: "13" } });
  x = lapso("Matemáticas", "Lapso 1");
  assert.equal(x.nota, 14.5); // 6 + 2 + 6,5
  assert.equal(x.faltan, 0);
  // Las otras materias y lapsos siguen con las 3 evaluaciones de siempre
  assert.equal(lapso("Matemáticas", "Lapso 2").evaluaciones.length, 3);
  assert.equal(lapso("Inglés", "Lapso 1").evaluaciones.length, 3);
});

test("definitiva: promedio de los lapsos con nota; el consejo puede cambiar un lapso o la definitiva", () => {
  const base = {
    "e1_Lapso 1": { Matemáticas_1: "9", Matemáticas_2: "9", Matemáticas_3: "9" },
    "e1_Lapso 2": { Matemáticas_1: "10" },
    "e1_Lapso 3": { Matemáticas_1: "9.5" },
  };
  conNotas(base);
  let d = definitiva("Matemáticas");
  assert.deepEqual(
    d.lapsos.map((x) => x.nota),
    [9, 10, 9.5]
  );
  assert.equal(d.nota, 9.5);
  assert.equal(d.completa, true);

  // El consejo sube el 1er lapso a 10: la definitiva se recalcula con esa nota
  const aj = { nota: 10, original: 9, motivo: "Consejo", por: "director@x", fecha: "2026-12-12" };
  conNotas({ ...base, "e1_Lapso 1": { ...base["e1_Lapso 1"], consejo: { Matemáticas: aj } } });
  d = definitiva("Matemáticas");
  assert.equal(d.lapsos[0].nota, 10);
  assert.equal(d.lapsos[0].calculada, 9);
  assert.equal(d.nota, 9.8);
  assert.equal(d.ajuste, null);

  // Y si el consejo fija la definitiva, esa manda
  conNotas({ ...base, e1_Definitiva: { consejo: { Matemáticas: { ...aj, nota: 10, original: 9.5 } } } });
  d = definitiva("Matemáticas");
  assert.equal(d.calculada, 9.5);
  assert.equal(d.nota, 10);
  assert.equal(d.ajuste.motivo, "Consejo");
});

test("promedio del estudiante: de las definitivas que ya tiene", () => {
  conNotas({
    "e1_Lapso 1": { Matemáticas_1: "18", Inglés_1: "15" },
    e1_Definitiva: { consejo: { Inglés: { nota: 16, original: 15, motivo: "x" } } },
  });
  assert.equal(app.evaluar("promedioEstudiante")(est, ["Matemáticas", "Inglés", "Química"]), 17);
  assert.equal(app.evaluar("promedioEstudiante")(est, ["Química"]), null);
});

test("la nota del lapso que carga control de estudio (<materia>_lapso) manda sobre las evaluaciones", () => {
  conNotas({ "e1_Lapso 1": { Matemáticas_lapso: "17.5", Matemáticas_1: "10", Inglés_1: "14" } });
  const m = lapso("Matemáticas", "Lapso 1");
  assert.equal(m.nota, 17.5);
  assert.equal(m.directa, true);
  assert.equal(m.faltan, 0);
  // Sin nota del lapso, se calcula con las evaluaciones como siempre
  const i = lapso("Inglés", "Lapso 1");
  assert.equal(i.nota, 14);
  assert.equal(i.directa, false);
  // Y la definitiva promedia las notas de los lapsos
  conNotas({ "e1_Lapso 1": { Matemáticas_lapso: "16" }, "e1_Lapso 2": { Matemáticas_lapso: "19" } });
  assert.equal(definitiva("Matemáticas").nota, 17.5);
});

test("el id del plan no lleva caracteres que Firestore no acepta en un id", () => {
  assert.equal(app.evaluar("idPlanEval")("1er Año"), "plan__1er Año");
  assert.equal(app.evaluar("idPlanEval")("4to/5to A.B"), "plan__4to_5to A_B");
});
