// Fichas para docentes: solo lo necesario para notas y boletín, nunca datos privados.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { cargar, RAIZ } = require("./cargar");

const app = cargar("js/servicios/fichas-docentes.js");
const ficha = (e) => JSON.parse(JSON.stringify(app.fichaDocente(e)));

const completo = {
  nombre: "Ana María Pérez",
  cedula: "V-30111222",
  fechaNac: "2019-03-10",
  grado: "1er Grado",
  seccion: "A",
  anioEscolar: "2026-2027",
  acudiente: "Carmen Pérez",
  estado: "mora",
  graduado: false,
  telefono: "0414",
  telefonoAcudiente: "0414-1234567",
  correoAcudiente: "carmen@example.com",
  cedulaAcudiente: "V-1",
  observacionesMedicas: "Asma",
  mensualidad: 45,
  deuda: 120,
  moraConcepto: "Deuda 2025",
  moraMonto: 120,
  sinRecargo: true,
  cuotaDesde: "2026-09",
  fusionados: ["x"],
};

test("la ficha solo lleva lo necesario para notas y boletín", () => {
  assert.deepEqual(ficha(completo), {
    nombre: "Ana María Pérez",
    cedula: "V-30111222",
    fechaNac: "2019-03-10",
    grado: "1er Grado",
    seccion: "A",
    anioEscolar: "2026-2027",
    acudiente: "Carmen Pérez",
  });
});

test("del estado solo pasa «retirado» (la mora habla de la deuda); «graduado» pasa si es verdad", () => {
  assert.equal(ficha({ nombre: "A", estado: "retirado" }).estado, "retirado");
  assert.equal(ficha({ nombre: "A", estado: "alsaldo" }).estado, undefined);
  assert.equal(ficha({ nombre: "A", graduado: true }).graduado, true);
  assert.deepEqual(ficha({ nombre: "A", cedula: "", grado: null }), { nombre: "A" });
});

test("las reglas de Firestore aceptan en las fichas exactamente los mismos campos que la app", () => {
  const reglas = fs.readFileSync(path.join(RAIZ, "firestore.rules"), "utf8");
  const bloque = reglas.match(/match \/estudiantes_docentes\/\{id\}[\s\S]*?hasOnly\(\s*\[([^\]]*)\]/);
  assert.ok(bloque, "falta la regla de estudiantes_docentes");
  const enReglas = [...bloque[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  assert.deepEqual(enReglas.sort(), [...app.evaluar("CAMPOS_FICHA")].sort());
});

test("en las reglas, los docentes ya no leen la colección completa de estudiantes", () => {
  const reglas = fs.readFileSync(path.join(RAIZ, "firestore.rules"), "utf8");
  const bloque = reglas.match(/match \/estudiantes\/\{id\}\s*\{([\s\S]*?)\}/)[1];
  assert.doesNotMatch(bloque, /isDocente/);
});
