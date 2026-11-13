// Horarios (js/servicios/horarios.js): los horarios de las fotos de noviembre 2026, los nombres de materia según
// Configuración, cómo se agrupan las clases y que cargar dos veces no repite nada.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { cargar } = require("./cargar");

const app = cargar(
  "js/config.js",
  "js/utils/formato.js",
  "js/utils/texto.js",
  "js/utils/grados.js",
  "js/estado.js",
  "js/servicios/nomina-calculo.js",
  "js/servicios/horarios.js"
);
const f = (codigo) => {
  const v = app.evaluar(codigo);
  return v && typeof v === "object" ? JSON.parse(JSON.stringify(v)) : v;
};

test("las siglas de las hojas toman el nombre que ya tiene el año en Configuración", () => {
  const lista = JSON.stringify([
    "Geografía, Historia y Ciudadanía",
    "Participación en Grupos de Creación, Recreación y Producción",
    "Lengua y Literatura",
    "Educación Física y Deporte",
    "Turismo y Fotografía",
  ]);
  assert.deepEqual(f(`nombreMateriaMG("GHC", ${lista})`), {
    nombre: "Geografía, Historia y Ciudadanía",
    enConfig: true,
  });
  assert.equal(
    f(`nombreMateriaMG("CRP", ${lista}).nombre`),
    "Participación en Grupos de Creación, Recreación y Producción"
  );
  assert.equal(f(`nombreMateriaMG("Castellano", ${lista}).nombre`), "Lengua y Literatura");
  assert.equal(f(`nombreMateriaMG("Educación Física", ${lista}).nombre`), "Educación Física y Deporte");
  assert.equal(f(`nombreMateriaMG("Turismo", ${lista}).nombre`), "Turismo y Fotografía");
  // sin Configuración: el nombre completo
  assert.deepEqual(f(`nombreMateriaMG("FSN", [])`), {
    nombre: "Formación para la Soberanía Nacional",
    enConfig: false,
  });
});

test("las clases de un profesor se juntan por materia, año y hora", () => {
  const oliver = f(`clasesFotoMG(HORARIOS_FOTOS_MG.find((p) => p.nombre === "Oliver"), {})`);
  assert.equal(oliver.length, 8); // 4to y 5to Año van a la misma hora dos días: una clase con dos días
  assert.deepEqual(oliver[0], {
    materia: "Educación Física",
    grados: ["1er Año"],
    dias: ["Lun"],
    desde: "11:00",
    hasta: "12:20",
  });
  const germán = f(`clasesFotoMG(HORARIOS_FOTOS_MG.find((p) => p.nombre === "Germán"), {})`);
  const cuarto = germán.filter((c) => c.grados[0] === "4to Año");
  assert.deepEqual(cuarto, [
    { materia: "Química", grados: ["4to Año"], dias: ["Mar", "Vie"], desde: "13:40", hasta: "15:00" },
  ]);
});

test("las horas académicas de cada hoja cuadran (cada bloque son 2 horas)", () => {
  const horas = f(`Object.fromEntries(HORARIOS_FOTOS_MG.map((p) => [p.nombre, p.clases.length * 2]))`);
  assert.deepEqual(horas, {
    Oliver: 20,
    Germán: 12,
    Angel: 10,
    Frank: 16,
    Jaime: 16,
    Rossana: 24,
    Migledis: 22,
    Yetselin: 18,
    Kenny: 22,
    Nelson: 6,
  });
});

test("en Media general ningún año tiene dos materias a la vez ni un profesor dos clases a la vez", () => {
  const choques = f(
    `choquesHorario(HORARIOS_FOTOS_MG.map((p) => ({ nombre: p.nombre, clases: clasesFotoMG(p, {}) })))`
  );
  assert.deepEqual(choques, []);
});

test("los horarios de Primaria tienen 5 días por fila y las horas en orden", () => {
  const grados = f(`Object.keys(HORARIOS_FOTOS_GRADOS)`);
  assert.deepEqual(grados, ["1er Grado", "2do Grado", "3er Grado", "4to Grado", "5to Grado", "6to Grado"]);
  for (const g of grados) {
    const h = f(`HORARIOS_FOTOS_GRADOS[${JSON.stringify(g)}]`);
    assert.equal(f(`revisarHorarioGrado(HORARIOS_FOTOS_GRADOS[${JSON.stringify(g)}])`), "", g);
    h.filas.forEach((fila, i) => {
      if (!fila.receso) assert.equal(fila.celdas.length, 5, g + " fila " + i);
      if (i)
        assert.ok(fila.desde >= h.filas[i - 1].hasta, g + " fila " + i + " empieza antes de que termine la anterior");
    });
  }
});

test("especialistas: Educación Física de 1er y 2do grado es una sola clase", () => {
  const ef = f(`clasesFotoEspecialista("Educación Física")`);
  assert.ok(ef.some((c) => c.grados.join() === "1er Grado,2do Grado" && c.dias.join() === "Mar"));
  assert.equal(f(`clasesFotoEspecialista("Portugués").length`), 6);
});

test("cargar dos veces no repite clases y deja las que ya tenía", () => {
  const nuevas = f(`clasesFotoMG(HORARIOS_FOTOS_MG.find((p) => p.nombre === "Nelson"), {})`);
  app.__nuevas = nuevas;
  const primera = f(`sumarClases([{ materia: "", grados: ["3er Grado"], dias: [] }], __nuevas)`);
  assert.equal(primera.agregadas, 3);
  assert.equal(primera.lista.length, 4);
  app.__lista = primera.lista;
  assert.equal(f(`sumarClases(__lista, __nuevas).agregadas`), 0);
});

test("buscar al trabajador por su primer nombre, sin tildes", () => {
  app.__lista = [
    { id: "a", nombre: "German Pérez" },
    { id: "b", nombre: "Ana Germán" },
    { id: "c", nombre: "Germania Rojas" },
    { id: "d", nombre: "Germán Viejo", activo: false },
  ];
  assert.deepEqual(f(`buscarPorPrimerNombre("Germán", __lista).map((t) => t.id)`), ["a", "b"]);
});

test("un horario con una hora mal escrita no se guarda", () => {
  assert.match(f(`revisarHorarioGrado({ filas: [{ desde: "08:00", hasta: "07:00", celdas: [] }] })`), /Fila 1/);
  assert.match(f(`revisarHorarioGrado({ filas: [{ desde: "", hasta: "", celdas: ["x"] }] })`), /hora de inicio/);
});
