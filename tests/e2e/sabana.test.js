// 📝 Notas → 📋 Sábana de notas (media general): todas las notas de la sección por materia (1er, 2do y 3er lapso,
// definitiva y promedio), el detalle de cada evaluación que puso el profesor, los cambios del consejo (solo el
// director) y el plan de evaluación con porcentajes.
//
// Uso: node --test tests/e2e/sabana.test.js
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const XLSX = require("xlsx");
const semilla = require("./datos/semilla");
const { abrirNavegador } = require("./entorno");

// 1er Año: Matemáticas, Lengua y Literatura e Inglés. Luis (est2) y dos estudiantes más.
const datos = JSON.parse(JSON.stringify(semilla));
const col = datos.colecciones;
const nuevo = (nombre, cedula) => ({ ...col.estudiantes.est2, nombre, cedula, estado: "alsaldo", seccion: "A" });
col.estudiantes.est2.seccion = "A";
col.estudiantes.est7 = nuevo("Andrea Blanco", "V-30777888");
col.estudiantes.est8 = nuevo("Pedro Zambrano", "V-30888999");
const ts = { seconds: 1791000000, nanoseconds: 0 };
col.notas["plan__1er Año"] = {
  tipo: "plan",
  grado: "1er Año",
  materias: {
    Matemáticas: {
      "Lapso 1": {
        ultimoN: 3,
        evals: [
          { n: 1, nombre: "Prueba escrita", peso: 40 },
          { n: 2, nombre: "Taller", peso: 30 },
          { n: 3, nombre: "Exposición", peso: 30 },
        ],
      },
    },
  },
  updatedAt: ts,
};
const lapso = (estId, l, notas) => ({ estId, lapso: l, ...notas, updatedAt: ts });
Object.assign(col.notas, {
  // Luis: Matemáticas 1er lapso = 18×40% + 15×30% + 12×30% = 15,3
  "est2_Lapso 1": lapso("est2", "Lapso 1", {
    Matemáticas_1: "18",
    Matemáticas_2: "15",
    Matemáticas_3: "12",
    Inglés_1: "16",
    Inglés_2: "17",
    Inglés_3: "18",
  }),
  "est2_Lapso 2": lapso("est2", "Lapso 2", { Matemáticas_1: "14", Matemáticas_2: "16", Inglés_1: "15" }),
  // Andrea: reprobó Matemáticas en el 1er lapso (9 × 100% de lo evaluado = 9) y le falta una evaluación
  "est7_Lapso 1": lapso("est7", "Lapso 1", { Matemáticas_1: "9", Matemáticas_2: "9", Inglés_1: "20" }),
  "est8_Lapso 1": lapso("est8", "Lapso 1", { Matemáticas_1: "20", Matemáticas_2: "20", Matemáticas_3: "20" }),
  // Pedro: el consejo ya le fijó la definitiva de Inglés
  est8_Definitiva: {
    estId: "est8",
    lapso: "Definitiva",
    consejo: {
      Inglés: {
        nota: 19,
        original: null,
        motivo: "Constancia",
        acta: "",
        por: "herrerajoicer@gmail.com",
        fecha: "2026-10-05",
      },
    },
    updatedAt: ts,
  },
});
semilla.ponerFichas(datos);

let nav, s;
const llamar = (c) => s.pagina.evaluate(c);
const notaDoc = (id) => llamar(`JSON.parse(JSON.stringify(__DATOS_FALSOS__.notas.get(${JSON.stringify(id)}) || null))`);
const fila = (nombre) => s.pagina.locator(".sabana-wrap .sab-tabla tbody tr", { hasText: nombre });

async function entrar(correo) {
  s = await nav.nuevaPagina();
  await s.pagina.goto(nav.base);
  await s.pagina.waitForSelector("#l-email");
  await s.pagina.fill("#l-email", correo);
  await s.pagina.fill("#l-pwd", "prueba123");
  await s.pagina.click("#login-btn");
  await s.pagina.waitForSelector(".tabs .tab");
}
async function abrirSabana() {
  await llamar(`setTab("notas")`);
  await s.pagina.click("text=📋 Sábana de notas");
  await s.pagina.waitForSelector(".sab-tabla");
}

before(async () => {
  nav = await abrirNavegador({ datos });
  await entrar("herrerajoicer@gmail.com");
});
after(async () => nav && nav.cerrar());

test("todo el año: por materia 1er, 2do y 3er lapso y definitiva, y el promedio del estudiante", async () => {
  await abrirSabana();
  // Solo años de media general: 1er Año primero
  assert.deepEqual(await s.pagina.$$eval("#sab-grado option", (o) => o.map((x) => x.value)), ["1er Año", "5to Año"]);
  const cab = await s.pagina.textContent(".sab-tabla thead");
  for (const m of ["Matemáticas", "Lengua y Literatura", "Inglés", "Promedio", "1° L", "Def."])
    assert.match(cab, new RegExp(m));
  // En orden alfabético, con su número y cédula
  const nombres = await s.pagina.$$eval(".sab-tabla tbody .sab-nombre", (t) => t.map((x) => x.textContent.trim()));
  assert.deepEqual(nombres, ["Andrea Blanco", "Luis Alberto Gómez", "Pedro Zambrano"]);
  // Luis, Matemáticas: 1er lapso 15,3 (con porcentajes) · 2do 15 (sin plan: promedio) · definitiva 15,2
  const luis = await fila("Luis Alberto Gómez").locator("td").allTextContents();
  assert.deepEqual(luis.slice(3, 7), ["15,3", "15", "-", "15,2"]);
  // Inglés: 17 y 15 → 16. Lengua sin notas. Promedio: (15,2 + 16) / 2 = 15,6
  assert.deepEqual(luis.slice(11, 15), ["17", "15", "-", "16"]);
  assert.equal(luis.at(-1), "15,6");
  // Andrea reprobó Matemáticas en el 1er lapso (rojo) y le falta la exposición (cursiva)
  const celda = fila("Andrea Blanco").locator("td").nth(3);
  assert.equal(await celda.textContent(), "9");
  assert.match(await celda.getAttribute("class"), /sab-rep/);
  assert.match(await celda.getAttribute("class"), /sab-parcial/);
  assert.match(await celda.getAttribute("title"), /Faltan 1 evaluación/);
  // Pie: promedio de la sección en cada columna y reprobados
  const pie = await s.pagina.$$eval(".sab-tabla tfoot tr", (t) =>
    t.map((r) => [...r.children].map((c) => c.textContent))
  );
  assert.equal(pie[0][0], "Promedio de la sección");
  assert.equal(pie[0][1], "14,8"); // (9 + 15,3 + 20) / 3
  assert.equal(pie[1][1], "1");
  assert.deepEqual(s.errores, []);
});

test("un lapso y el detalle por materia, con cada evaluación y su porcentaje", async () => {
  await s.pagina.selectOption("#sab-ver", "Lapso 1");
  await s.pagina.waitForSelector(".sab-tabla >> text=Promedio del lapso");
  const luis = await fila("Luis Alberto Gómez").locator("td").allTextContents();
  assert.deepEqual(luis.slice(3), ["15,3", "-", "17", "16,2"]);

  await s.pagina.selectOption("#sab-ver", "materia");
  await s.pagina.waitForSelector("#sab-materia");
  const cab = await s.pagina.textContent(".sab-tabla thead");
  assert.match(cab, /Prueba escrita 40%.*Taller 30%.*Exposición 30%/);
  const t = await fila("Luis Alberto Gómez").locator("td").allTextContents();
  // 1er lapso: 18, 15, 12 → 15,3 · 2do lapso (3 evaluaciones sin plan): 14, 16, - → 15
  assert.deepEqual(t.slice(3, 11), ["18", "15", "12", "15,3", "14", "16", "-", "15"]);
  assert.equal(t.at(-1), "15,2");
  await s.pagina.selectOption("#sab-materia", "Inglés");
  assert.match(await s.pagina.textContent(".sab-tabla thead"), /Eval 1.*Eval 2.*Eval 3/);

  // Al tocar el nombre: todas sus evaluaciones
  await s.pagina.click(".sab-est >> text=Luis Alberto Gómez");
  await s.pagina.waitForSelector(".sab-detalle");
  const det = await s.pagina.textContent(".modal-body");
  assert.match(det, /Prueba escrita 40%: 18/);
  assert.match(det, /Promedio: 15,6/);
  await s.pagina.click(".modal >> text=🖨️ Imprimir");
  assert.match(await llamar(`window.__IMPRESIONES__.at(-1).html`), /DETALLE DE EVALUACIONES[\s\S]*Taller 30%/);
  await llamar(`cerrarModal()`);
  assert.deepEqual(s.errores, []);
});

test("el director cambia una nota por decisión del consejo: queda la original, el motivo y la marca C", async () => {
  await s.pagina.selectOption("#sab-ver", "anio");
  await s.pagina.waitForSelector(".sab-tabla >> text=Def.");
  // Andrea, Matemáticas 1er lapso: de 9 a 10
  await fila("Andrea Blanco").locator("td").nth(3).click();
  await s.pagina.waitForSelector("#aj-nota");
  assert.match(await s.pagina.textContent(".modal-body"), /Nota que dan las evaluaciones\s*9/);
  await s.pagina.fill("#aj-nota", "10");
  await s.pagina.click("text=💾 Guardar");
  assert.match(await s.pagina.textContent("#aj-res"), /motivo/); // sin motivo no se guarda
  await s.pagina.fill("#aj-motivo", "Consejo de sección: buen desempeño en el lapso");
  await s.pagina.fill("#aj-acta", "Acta N° 1");
  await s.pagina.click("text=💾 Guardar");
  await s.pagina.waitForSelector(".sab-ajustes >> text=Andrea Blanco");

  const doc = await notaDoc("est7_Lapso 1");
  assert.equal(doc.consejo.Matemáticas.nota, 10);
  assert.equal(doc.consejo.Matemáticas.original, 9);
  assert.equal(doc.consejo.Matemáticas.por, "herrerajoicer@gmail.com");
  assert.equal(doc.consejo.Matemáticas.acta, "Acta N° 1");
  assert.equal(doc.Matemáticas_1, "9"); // lo que puso el profesor no se toca

  const celda = fila("Andrea Blanco").locator("td").nth(3);
  assert.equal(await celda.textContent(), "10C");
  assert.match(await celda.getAttribute("class"), /sab-aj/);
  assert.doesNotMatch(await celda.getAttribute("class"), /sab-rep/);
  const aj = await s.pagina.textContent(".sab-ajustes");
  assert.match(aj, /Andrea Blanco\s*Matemáticas\s*Lapso 1\s*9\s*10\s*Consejo de sección/);

  // La definitiva también: Luis, Matemáticas de 15,2 a 16
  await fila("Luis Alberto Gómez").locator("td").nth(6).click();
  await s.pagina.fill("#aj-nota", "16");
  await s.pagina.fill("#aj-motivo", "Revisión del consejo final");
  await s.pagina.click("text=💾 Guardar");
  await s.pagina.waitForSelector(".sab-ajustes >> text=Revisión del consejo final");
  assert.equal((await notaDoc("est2_Definitiva")).consejo.Matemáticas.original, 15.2);
  assert.equal(await fila("Luis Alberto Gómez").locator("td").last().textContent(), "16"); // (16 + 16) / 2

  // El boletín del representante ya sale con la nota del consejo
  await llamar(`imprimirBoletin("est2")`);
  const bol = await llamar(`window.__IMPRESIONES__.at(-1).html`);
  assert.match(bol, /<div class="b-def"><strong class="">16<\/strong>/);

  // Guardar notas del profesor después no borra el cambio del consejo
  await llamar(`guardarNotas("est7", "Lapso 1")`);
  const esc = await llamar(`__ESCRITURAS__.filter((e) => e.ruta === "notas/est7_Lapso 1").at(-1)`);
  assert.equal(esc.op, "set-merge");
  assert.equal("consejo" in esc.datos, false);
  assert.equal((await notaDoc("est7_Lapso 1")).consejo.Matemáticas.nota, 10);

  // Y se puede quitar
  await fila("Andrea Blanco").locator("td").nth(3).click();
  await s.pagina.click("text=Quitar el cambio");
  await s.pagina.waitForFunction(() => !document.querySelector(".modal"));
  assert.equal((await notaDoc("est7_Lapso 1")).consejo.Matemáticas, undefined);
  assert.equal(await fila("Andrea Blanco").locator("td").nth(3).textContent(), "9");
  assert.deepEqual(s.errores, []);
});

test("se imprime en hoja horizontal y se descarga en Excel, con los cambios del consejo", async () => {
  await s.pagina.click("text=🖨️ Imprimir");
  const html = await llamar(`window.__IMPRESIONES__.at(-1).html`);
  assert.match(html, /SÁBANA DE NOTAS/);
  assert.match(html, /landscape/);
  assert.match(html, /Pedro Zambrano/);
  assert.match(html, /Cambios del consejo[\s\S]*Revisión del consejo final/);
  assert.doesNotMatch(html, /onclick="abrirAjusteConsejo/); // en papel no hay toques

  const [descarga] = await Promise.all([s.pagina.waitForEvent("download"), s.pagina.click("text=📥 Excel")]);
  assert.equal(descarga.suggestedFilename(), "sabana_1er_Ano_anio.xlsx");
  const wb = XLSX.readFile(await descarga.path());
  assert.deepEqual(wb.SheetNames, ["Sábana", "Cambios del consejo"]);
  const filas = XLSX.utils.sheet_to_json(wb.Sheets["Sábana"], { header: 1 });
  assert.deepEqual(filas[0].slice(0, 4), ["N°", "Estudiante", "Cédula", "Matemáticas"]);
  assert.deepEqual(filas[1].slice(3, 7), ["1° L", "2° L", "3° L", "Def."]);
  const luis = filas.find((f) => f[1] === "Luis Alberto Gómez");
  assert.deepEqual([luis[3], luis[4], luis[5], luis[6]], [15.3, 15, undefined, 16]); // el 3er lapso, vacío
  assert.ok(wb.Sheets["Sábana"]["!merges"].some((m) => m.s.c === 3 && m.e.c === 6)); // «Matemáticas» sobre sus 4 columnas
});

test("plan de evaluación: nombres y porcentajes que deben sumar 100%, en uno o en los 3 lapsos", async () => {
  await llamar(
    `filtros.notasVista = "estudiante"; filtros.estSelId = "est2"; filtros.lapso = "Lapso 1"; renderTabContent()`
  );
  await s.pagina.waitForSelector("text=Prueba escrita · 40%");
  await llamar(`abrirPlanEvaluacion("1er Año", "Inglés", "Lapso 1")`);
  await s.pagina.waitForSelector("#plan-nombre-0");
  await s.pagina.fill("#plan-nombre-0", "Quiz");
  await s.pagina.dispatchEvent("#plan-nombre-0", "change");
  await s.pagina.fill("#plan-peso-0", "50");
  await s.pagina.fill("#plan-peso-1", "30");
  await s.pagina.click("text=💾 Guardar plan");
  assert.match(await s.pagina.textContent("#plan-res"), /suman 80%/);
  await s.pagina.fill("#plan-peso-2", "20");
  assert.match(await s.pagina.textContent("#plan-suma"), /suman 100%/);
  await s.pagina.check("#plan-todos");
  await s.pagina.click("text=💾 Guardar plan");
  await s.pagina.waitForFunction(() => !document.querySelector(".modal"));
  const plan = await notaDoc("plan__1er Año");
  for (const l of ["Lapso 1", "Lapso 2", "Lapso 3"])
    assert.deepEqual(
      plan.materias.Inglés[l].evals.map((e) => [e.nombre, e.peso]),
      [
        ["Quiz", 50],
        ["Eval 2", 30],
        ["Eval 3", 20],
      ]
    );
  assert.equal(plan.materias.Matemáticas["Lapso 1"].evals.length, 3); // lo demás del plan se conserva
  // Inglés de Luis en el 1er lapso: 16×50% + 17×30% + 18×20% = 16,7
  assert.equal(await llamar(`notaLapsoDe(estudiantes.find((e) => e.id === "est2"), "Inglés", "Lapso 1").nota`), 16.7);
  assert.ok(await s.pagina.isVisible("text=Quiz · 50%"));
  assert.deepEqual(s.errores, []);
});

test("los docentes ven la sábana pero no pueden cambiar notas por consejo", async () => {
  await entrar("docente.prueba@example.com");
  await abrirSabana();
  assert.equal(await s.pagina.locator(".sab-toca").count(), 0);
  assert.doesNotMatch(await s.pagina.textContent(".ayuda"), /consejo, tócala/);
  // Las notas del consejo sí las ven (Pedro, definitiva de Inglés)
  assert.equal(await fila("Pedro Zambrano").locator("td").nth(14).textContent(), "19C");
  await llamar(`abrirAjusteConsejo("est2", "Matemáticas", "Lapso 1")`);
  assert.equal(await s.pagina.locator("#aj-nota").count(), 0);
  await assert.rejects(
    llamar(`guardarAjusteConsejo(estudiantes.find((e) => e.id === "est2"), "Matemáticas", "Lapso 1", 20, "x")`),
    /Solo el director/
  );
  // El plan de evaluación sí lo pueden armar
  await llamar(`filtros.notasVista = "estudiante"; filtros.estSelId = "est2"; renderTabContent()`);
  assert.ok((await s.pagina.locator("text=⚙️ Plan").count()) > 0);
  assert.deepEqual(s.errores, []);
});
