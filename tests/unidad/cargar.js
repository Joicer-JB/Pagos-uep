// Carga archivos de la app (scripts clásicos del navegador) en un contexto aislado de Node,
// para probar sus funciones sin abrir un navegador ni conectarse a Firebase.
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const RAIZ = path.resolve(__dirname, "../..");

// Firebase de mentira: config.js lo llama al cargarse, pero estas pruebas no usan la base de datos
const firebaseVacio = {
  initializeApp() {},
  firestore: Object.assign(() => ({}), { FieldValue: {} }),
  auth: () => ({ onAuthStateChanged() {} }),
};

function cargar(...archivos) {
  const contexto = vm.createContext({ console, firebase: firebaseVacio, localStorage: { getItem: () => null } });
  for (const a of archivos) {
    vm.runInContext(fs.readFileSync(path.join(RAIZ, a), "utf8"), contexto, { filename: a });
  }
  // Las constantes de primer nivel (const/let) no son propiedades del contexto: se leen con evaluar()
  contexto.evaluar = (codigo) => vm.runInContext(codigo, contexto);
  return contexto;
}

module.exports = { cargar, RAIZ };
