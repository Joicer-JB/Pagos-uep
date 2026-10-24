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
// Un documento de Word como la «Matricula Inicial» de los docentes: títulos, «Docente / Grado / Sección» y la tabla
// (con la columna vacía junto al número, celdas combinadas y los encabezados repetidos en la página 2)
function wordMatricula(nombreArchivo, lineas, filas, entreTablas = "") {
  const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const p = (t) => `<w:p><w:r><w:t xml:space="preserve">${esc(t)}</w:t></w:r></w:p>`;
  const celda = (t, span) =>
    `<w:tc>${span ? `<w:tcPr><w:gridSpan w:val="${span}"/></w:tcPr>` : ""}<w:p><w:r><w:t>${esc(t)}</w:t></w:r></w:p></w:tc>`;
  const fila = (cs) => `<w:tr>${cs.map((c) => (Array.isArray(c) ? celda(c[0], c[1]) : celda(c))).join("")}</w:tr>`;
  const enc = fila([
    ["n nro.", 2],
    "Cedula Escolar",
    "Nombres y Apellidos",
    "Edad",
    "Sexo",
    "F. Nac.",
    "Representante",
    "Fecha Nac. Del Rep.",
    "Teléfono",
    "Padece alguna enfermedad",
  ]);
  const tabla = (fs) => `<w:tbl>${enc}${fs.map(fila).join("")}</w:tbl>`;
  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>
${lineas.map(p).join("")}${tabla(filas.slice(0, 2))}${p(entreTablas)}${tabla(filas.slice(2))}${p("Total Hembras: 2 Varones: 1")}
</w:body></w:document>`;
  const zip = XLSX.CFB.utils.cfb_new();
  XLSX.CFB.utils.cfb_add(zip, "/word/document.xml", Buffer.from(xml, "utf8"));
  return {
    name: nombreArchivo,
    mimeType: "application/octet-stream",
    buffer: XLSX.CFB.write(zip, { type: "buffer", fileType: "zip" }),
  };
}
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

test("la matrícula en Word (.docx) de los docentes: lee la tabla, el grado y la sección del título", async () => {
  const doc = wordMatricula(
    "MATRICULA 5TO AÑO 26-27.docx",
    [
      "REPUBLICA BOLIVARIANA DE VENEZUELA",
      "UNIDAD EDUCATIVA PRIVADA JOSEFA JOAQUINA SÁNCHEZ",
      "Matricula Inicial MEDIA GENERAL Año Escolar 2026-2027",
      "Docente: ILIANA SAN MARTIN\tAño: 5TO AÑO\tSección: “U”",
    ],
    [
      [
        "1",
        "",
        "V-30444555",
        "Carlos Eduardo Díaz",
        "16",
        "M",
        "05/05/10",
        "Rosa Díaz",
        "01/01/80",
        "0412-5550101 / 0414-5550102",
        "No",
      ],
      [["2", 2], "V-32000111", "MARÍA JOSÉ LÓPEZ", "15", "F", "12/08/2011", "Pedro López", "", "04245550103", "Asma"],
      ["3", "", "", "Andrea Silva", "15", "F", "2011-02-01", "", "", "", "ninguna"],
    ]
  );
  await subir("5to Año", doc);
  const t = (await s.pagina.textContent("#imp-preview")).replace(/\s+/g, " ");
  assert.match(t, /2 nuevos/);
  assert.match(t, /5to Año: 3 inscritos \(2 niñas · 1 niño\)/);
  assert.doesNotMatch(t, /Nombres y Apellidos|Total Hembras/); // ni los encabezados repetidos ni el total
  const filas = await llamar(
    `JSON.parse(JSON.stringify(importFilas.map((x) => [x.estado, x.datos.nombre, x.datos.grado, x.datos.seccion])))`
  );
  assert.deepEqual(filas, [
    ["actualizar", "Carlos Eduardo Díaz", "5to Año", "U"],
    ["nuevo", "MARÍA JOSÉ LÓPEZ", "5to Año", "U"],
    ["nuevo", "Andrea Silva", "5to Año", "U"],
  ]);
  const maria = await llamar(`JSON.parse(JSON.stringify(importFilas[1].datos))`);
  assert.equal(maria.cedula, "V-32000111");
  assert.equal(maria.fechaNac, "2011-08-12");
  assert.equal(maria.acudiente, "Pedro López");
  assert.equal(maria.telefonoAcudiente, "04245550103");
  assert.equal(maria.observacionesMedicas, "Asma");
  // Si se elige otro grado, nada del documento se mezcla
  await s.pagina.selectOption("#imp-grado", "4to Año");
  assert.match((await s.pagina.textContent("#imp-preview")).replace(/\s+/g, " "), /3 de otros grados \(se ignoran\)/);
  assert.deepEqual(s.errores, []);
});

test("un Word con dos grupos (Maternal e I Grupo, de una misma maestra): cada uno a su grado", async () => {
  const doc = wordMatricula(
    "MATRICULA MATERNAL Y I GRUPO.docx",
    [
      "Matricula Inicial EDUCACIÓN INICIAL Año Escolar 2026-2027",
      "Docente: MARÍA PÉREZ\tGrupo: MATERNAL\tSección: “U”",
    ],
    [
      ["1", "", "", "Camila Ruiz", "2", "F", "01/02/2024", "Ana Ruiz", "", "", ""],
      ["2", "", "", "Mateo Díaz", "2", "M", "03/04/2024", "Luis Díaz", "", "", ""],
      ["1", "", "", "Sara León", "3", "F", "05/06/2023", "Eva León", "", "", ""],
    ],
    "Docente: MARÍA PÉREZ\tGrupo: I GRUPO\tSección: “U”"
  );
  await subir("todos", doc);
  const t = (await s.pagina.textContent("#imp-preview")).replace(/\s+/g, " ");
  assert.match(t, /Maternal: 2 inscritos \(1 niña · 1 niño\)/);
  assert.match(t, /Nivel I: 1 inscrito \(1 niña · 0 niños\)/);
  // Eligiendo «Maternal», los de I Grupo se ignoran
  await s.pagina.selectOption("#imp-grado", "Maternal");
  const t2 = (await s.pagina.textContent("#imp-preview")).replace(/\s+/g, " ");
  assert.match(t2, /1 de otro grado \(se ignoran\)/);
  assert.doesNotMatch(await s.pagina.textContent(".matricula-despues"), /Nivel I/);
  assert.deepEqual(s.errores, []);
});

test("un Word viejo (.doc) pide guardarlo como .docx", async () => {
  await llamar(`setTab("importar")`);
  await s.pagina.selectOption("#imp-grado", "1er Grado");
  await s.pagina.setInputFiles("#imp-file", {
    name: "MATRICULA.doc",
    mimeType: "application/msword",
    buffer: Buffer.from("x"),
  });
  await s.pagina.waitForSelector("text=guárdalo como");
});
