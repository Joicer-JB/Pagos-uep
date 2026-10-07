// Interpretación de grados escritos a mano y niveles (js/utils/grados.js)
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { cargar } = require("./cargar");

const app = cargar("js/utils/grados.js");
// JSON ida y vuelta: los arreglos del contexto aislado tienen otro prototipo y deepEqual los vería distintos
const f = (codigo) => JSON.parse(JSON.stringify(app.evaluar(codigo)));

test("gradoCanon: entiende las formas comunes de escribir un grado", () => {
  const casos = {
    Maternal: "Maternal",
    "Nivel I": "Nivel I",
    "Preescolar I": "Nivel I",
    "Inicial II": "Nivel II",
    "3er nivel": "Nivel III",
    "primer nivel de preescolar": "Nivel I",
    "1er Grado": "1er Grado",
    "1° grado": "1er Grado",
    "primer grado": "1er Grado",
    "6to grado": "6to Grado",
    "7mo grado": "1er Año",
    "9no grado": "3er Año",
    "1er año": "1er Año",
    "5to Año": "5to Año",
    "quinto año": "5to Año",
  };
  for (const [escrito, oficial] of Object.entries(casos)) {
    assert.equal(app.evaluar(`gradoCanon(${JSON.stringify(escrito)})`), oficial, escrito);
  }
});

test("gradoCanon: lo ambiguo o inválido queda vacío", () => {
  for (const g of ["5to", "", null, "10mo grado", "6to año", "Nivel IV"]) {
    assert.equal(app.evaluar(`gradoCanon(${JSON.stringify(g)})`), "", String(g));
  }
});

test("getNivel", () => {
  assert.equal(f('getNivel("Maternal")'), "preescolar");
  assert.equal(f('getNivel("Preescolar II")'), "preescolar");
  assert.equal(f('getNivel("3er Grado")'), "primaria");
  assert.equal(f('getNivel("1er Año")'), "media");
  assert.equal(f('getNivel("")'), "media");
});

test("ordenGrados: de menor a mayor, lo desconocido al final", () => {
  const lista = ["5to Año", "zzz", "1er Grado", "Maternal", "7mo grado", "Nivel I"];
  assert.deepEqual([...lista].sort(app.evaluar("ordenGrados")), [
    "Maternal",
    "Nivel I",
    "1er Grado",
    "7mo grado",
    "5to Año",
    "zzz",
  ]);
});

test("listas por nivel salen de ESCALERA sin perder grados", () => {
  const todos = f("[...GRADOS_PREESCOLAR, ...GRADOS_PRIMARIA_LIST, ...GRADOS_MG]");
  assert.deepEqual(todos, f("ESCALERA"));
  assert.deepEqual(f("GRADOS_PRIM"), f("[...GRADOS_PREESCOLAR, ...GRADOS_PRIMARIA_LIST]"));
  assert.equal(f("GRADOS_MG.length"), 5);
});
