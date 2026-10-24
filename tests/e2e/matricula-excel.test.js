// Montar la matrícula por grado desde Excel (📥 Importar): se elige el grado, se sube su lista y la plataforma cuadra
// ese grado. Los nuevos se crean; a los que ya están se les reactiva, corrige el grado y el sexo y completa lo que
// falte; los inscritos del grado que no están en la lista solo se retiran si se marca.
//
// Uso: node --test tests/e2e/matricula-excel.test.js
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const XLSX = require("xlsx");
const { abrirNavegador } = require("./entorno");

let nav, s;
const llamar = (c) => s.pagina.evaluate(c);
const excel = (hojas) => {
  const libro = XLSX.utils.book_new();
  hojas.forEach(([nombre, filas]) => XLSX.utils.book_append_sheet(libro, XLSX.utils.aoa_to_sheet(filas), nombre));
  return {
    name: "matricula.xlsx",
    mimeType: "application/octet-stream",
    buffer: XLSX.write(libro, { type: "buffer", bookType: "xlsx" }),
  };
};
async function subir(grado, archivo) {
  await llamar(`setTab("importar")`);
  await s.pagina.selectOption("#imp-grado", grado);
  await s.pagina.setInputFiles("#imp-file", archivo);
  await s.pagina.waitForSelector(".matricula-despues");
}
async function guardar() {
  const antes = await llamar(`__ESCRITURAS__.length`);
  await s.pagina.click("#imp-btn");
  await s.pagina.waitForSelector("#imp-btn:has-text('Listo')");
  return (await llamar(`__ESCRITURAS__.slice(${antes})`)).filter((e) => e.ruta.startsWith("estudiantes/"));
}

before(async () => {
  nav = await abrirNavegador();
  s = await nav.nuevaPagina();
  await s.pagina.goto(nav.base);
  await s.pagina.waitForSelector("#l-email");
  await s.pagina.fill("#l-email", "herrerajoicer@gmail.com");
  await s.pagina.fill("#l-pwd", "prueba123");
  await s.pagina.click("#login-btn");
  await s.pagina.waitForSelector(".tabs .tab");
});
after(async () => nav && nav.cerrar());

test("3er Grado: reactiva a la retirada, trae a la de otro grado, crea al nuevo y salta los repetidos", async () => {
  await subir(
    "3er Grado",
    excel([
      [
        "3er Grado",
        [
          ["U.E.P. Josefa Joaquina Sánchez"],
          ["Matrícula 3er Grado"],
          ["N°", "Apellidos", "Nombres", "Sexo", "Cédula escolar"],
          [1, "Hernández", "Sofía", "H", "V-30555666"], // retirada en la plataforma
          [2, "Torres", "Miguel Ángel", "V", ""], // ya está, igual
          [3, "Pérez", "Ana María", "H", ""], // está en 1er Grado
          [4, "Rivas", "José Gregorio", "V", "V-31999000"], // nuevo
          [5, "Rivas", "José Gregorio", "V", ""], // repetido
          ["", "Total", "", "", ""],
        ],
      ],
    ])
  );
  const resumen = (await s.pagina.textContent("#imp-preview")).replace(/\s+/g, " ");
  assert.match(resumen, /1 nuevo/);
  assert.match(resumen, /3 se actualizan/); // las tres que ya estaban (a Miguel solo se le pone el año escolar)
  assert.match(resumen, /1 repetido en el archivo/);
  assert.match(resumen, /3er Grado: 4 inscritos \(2 niñas · 2 niños\) · hoy 1/);
  assert.match(resumen, /Se reactiva \(estaba retirado\)/);
  assert.match(resumen, /Grado: 1er Grado → 3er Grado/);
  assert.equal(await s.pagina.locator("#imp-retirar").count(), 0); // nadie del grado falta en la lista

  s.dialogos.length = 0;
  const esc = await guardar();
  assert.match(s.dialogos[0], /crear 1 estudiante nuevo, actualizar 3/);
  const por = (id) => esc.find((e) => e.ruta === "estudiantes/" + id);
  assert.deepEqual(por("est5").datos, { estado: "alsaldo", anioEscolar: "2026-2027" });
  assert.deepEqual(por("est1").datos, { grado: "3er Grado", anioEscolar: "2026-2027" });
  assert.deepEqual(por("est6").datos, { anioEscolar: "2026-2027" });
  const nuevo = esc.find((e) => e.op === "set");
  assert.equal(nuevo.datos.nombre, "José Gregorio Rivas");
  assert.equal(nuevo.datos.grado, "3er Grado");
  assert.equal(nuevo.datos.sexo, "M");
  assert.equal(nuevo.datos.cedula, "V-31999000");
  assert.equal(esc.length, 4);
  assert.equal(await llamar(`estudiantes.filter((e) => activo(e) && e.grado === "3er Grado").length`), 4);
});

test("los inscritos del grado que no están en la lista se retiran solo si se marca", async () => {
  await subir(
    "Nivel II",
    excel([
      [
        "II Grupo",
        [
          ["Nombres y apellidos", "Sexo"],
          ["Pedro Lara", "Varón"],
        ],
      ],
    ])
  );
  let t = (await s.pagina.textContent("#imp-preview")).replace(/\s+/g, " ");
  assert.match(t, /1 inscrito no está en tu lista: Valentina Rojas/);
  assert.match(t, /Nivel II: 2 inscritos/);
  await s.pagina.check("#imp-retirar");
  t = (await s.pagina.textContent("#imp-preview")).replace(/\s+/g, " ");
  assert.match(t, /Nivel II: 1 inscrito \(0 niñas · 1 niño\)/);
  assert.match(t, /1 nuevo · 1 retirado/);
  const esc = await guardar();
  assert.deepEqual(esc.find((e) => e.ruta === "estudiantes/est3").datos, { estado: "retirado" });
  assert.equal(esc.find((e) => e.op === "set").datos.grado, "Nivel II");
});

test("con «Varios grados» el grado sale de la columna o del nombre de la hoja; al montar un grado se ignoran los otros", async () => {
  const archivo = excel([
    [
      "1er Año",
      [
        ["Apellidos y nombres", "Sexo"],
        ["Gómez Luis Alberto", "M"],
      ],
    ],
    [
      "Lista",
      [
        ["Grado", "Nombres y apellidos", "Sexo"],
        ["5to año", "Carlos Eduardo Díaz", "M"],
        ["I Grupo", "Rosa Mía", "F"],
      ],
    ],
  ]);
  await subir("todos", archivo);
  let t = (await s.pagina.textContent("#imp-preview")).replace(/\s+/g, " ");
  assert.match(t, /Nivel I: 1 inscrito/);
  assert.match(t, /1er Año: 1 inscrito/);
  assert.match(t, /5to Año: 1 inscrito/);
  await s.pagina.selectOption("#imp-grado", "1er Año");
  t = (await s.pagina.textContent("#imp-preview")).replace(/\s+/g, " ");
  assert.match(t, /2 de otros grados \(se ignoran\)/);
  assert.match(t, /Así quedará: 1er Año: 1 inscrito \(0 niñas · 1 niño\) · hoy 1 Mostrar/);
  assert.deepEqual(s.errores, []);
});

test("sin elegir el grado no se puede guardar", async () => {
  await llamar(`importGrado = ""; setTab("importar")`);
  await s.pagina.setInputFiles("#imp-file", excel([["Hoja1", [["Nombres y apellidos"], ["Alguien Nuevo"]]]]));
  await s.pagina.waitForSelector("text=Elige arriba el grado");
  assert.equal(await s.pagina.locator("#imp-btn").count(), 0);
});
