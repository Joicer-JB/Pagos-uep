// Estructura de la app: index.html carga todos los archivos, en un orden que funciona,
// y ningún nombre global se declara dos veces (todos los <script> comparten el mismo espacio de nombres).
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { RAIZ } = require("./cargar");

const html = fs.readFileSync(path.join(RAIZ, "index.html"), "utf8");
const scriptsEnHtml = [...html.matchAll(/<script src="(js\/[^"]+)"><\/script>/g)].map((m) => m[1]);
const archivosJs = (function listar(dir) {
  return fs
    .readdirSync(path.join(RAIZ, dir), { withFileTypes: true })
    .flatMap((d) =>
      d.isDirectory()
        ? listar(path.join(dir, d.name))
        : d.name.endsWith(".js")
          ? [path.join(dir, d.name).split(path.sep).join("/")]
          : []
    );
})("js");

test("index.html carga todos los archivos de js/ (y ninguno que no exista)", () => {
  assert.deepEqual([...scriptsEnHtml].sort(), [...archivosJs].sort());
});

test("logo y config van primero; app.js (el arranque) va al final", () => {
  assert.equal(scriptsEnHtml[0], "js/logo.js");
  assert.equal(scriptsEnHtml[1], "js/config.js");
  assert.equal(scriptsEnHtml.at(-1), "js/app.js");
});

test("ningún nombre global se declara en dos archivos", () => {
  const donde = new Map();
  const repetidos = [];
  for (const archivo of archivosJs) {
    const codigo = fs.readFileSync(path.join(RAIZ, archivo), "utf8");
    for (const m of codigo.matchAll(/^(?:async\s+)?function\s+([\w$]+)|^(?:const|let|var)\s+([\w$]+)/gm)) {
      const nombre = m[1] || m[2];
      if (donde.has(nombre)) repetidos.push(`${nombre}: ${donde.get(nombre)} y ${archivo}`);
      else donde.set(nombre, archivo);
    }
  }
  assert.deepEqual(repetidos, []);
});

test("todos los archivos se cargan sin errores en el orden de index.html", () => {
  const nada = () => {};
  const elemento = { addEventListener: nada, appendChild: nada, style: {}, innerHTML: "" };
  const contexto = vm.createContext({
    console,
    document: { addEventListener: nada, getElementById: () => null, createElement: () => elemento, body: elemento },
    window: {},
    localStorage: { getItem: () => null, setItem: nada },
    firebase: {
      initializeApp: nada,
      firestore: Object.assign(() => ({}), {
        FieldValue: {},
        DocumentReference: function () {},
        CollectionReference: function () {},
        WriteBatch: function () {},
      }),
      auth: () => ({ onAuthStateChanged: nada }),
    },
  });
  for (const archivo of scriptsEnHtml) {
    assert.doesNotThrow(
      () => vm.runInContext(fs.readFileSync(path.join(RAIZ, archivo), "utf8"), contexto, { filename: archivo }),
      archivo
    );
  }
});
