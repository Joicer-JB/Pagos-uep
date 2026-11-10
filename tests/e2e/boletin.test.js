// 🖨️ Boletín para los representantes: con el escudo del colegio, la ficha del estudiante, el resumen (promedio general,
// materias aprobadas y promedio de cada lapso) y las notas; en primaria, el literal de cada indicador en cada lapso.
// También se imprimen los boletines de todo un grado de una vez.
//
// Uso: node --test tests/e2e/boletin.test.js
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const semilla = require("./datos/semilla");
const { abrirNavegador } = require("./entorno");

const datos = JSON.parse(JSON.stringify(semilla));
const col = datos.colecciones;
const ts = { seconds: 1791000000, nanoseconds: 0 };
// Luis (1er Año: Matemáticas, Lengua y Literatura, Inglés)
col.notas["est2_Lapso 1"] = {
  estId: "est2",
  lapso: "Lapso 1",
  Matemáticas_1: "18",
  "Lengua y Literatura_1": "8",
  Inglés_1: "16",
  updatedAt: ts,
};
col.notas["est2_Lapso 2"] = { estId: "est2", lapso: "Lapso 2", Matemáticas_1: "20", Inglés_1: "18", updatedAt: ts };
// Miguel (3er Grado, Matemáticas: «Suma y resta», «Multiplicación»), como los guarda la pestaña Notas
col.notas["est6_Lapso 1"] = {
  estId: "est6",
  lapso: "Lapso 1",
  Matemáticas__0: "A",
  Matemáticas__1: "C",
  updatedAt: ts,
};
col.notas["est6_Lapso 2"] = {
  estId: "est6",
  lapso: "Lapso 2",
  Matemáticas__0: "A",
  Matemáticas__1: "B",
  updatedAt: ts,
};
col.estudiantes.est7 = { ...col.estudiantes.est2, nombre: "Andrea Blanco", cedula: "V-30777888" };
// Andrea: notas con decimales (como en la sábana) y una definitiva cambiada por el consejo
const lapsoDec = (n, extra) => ({ estId: "est7", lapso: "Lapso " + n, ...extra, updatedAt: ts });
col.notas["est7_Lapso 1"] = lapsoDec(1, {
  Matemáticas_lapso: "9.5",
  "Lengua y Literatura_lapso": "15.6",
  Inglés_lapso: "12.4",
});
col.notas["est7_Lapso 2"] = lapsoDec(2, { Matemáticas_lapso: "9.4" });
col.notas["est7_Lapso 3"] = lapsoDec(3, { Matemáticas_lapso: "9.6" });
col.notas["est7_Definitiva"] = {
  estId: "est7",
  lapso: "Definitiva",
  consejo: {
    "Lengua y Literatura": { nota: 12, original: 15.6, motivo: "Acta del consejo", por: "herrerajoicer@gmail.com" },
  },
  updatedAt: ts,
};
semilla.ponerFichas(datos);

let nav, s;
const llamar = (c) => s.pagina.evaluate(c);
const ultima = () => llamar(`window.__IMPRESIONES__.at(-1).html`);

before(async () => {
  nav = await abrirNavegador({ datos });
  s = await nav.nuevaPagina();
  await s.pagina.goto(nav.base);
  await s.pagina.waitForSelector("#l-email");
  await s.pagina.fill("#l-email", "herrerajoicer@gmail.com");
  await s.pagina.fill("#l-pwd", "prueba123");
  await s.pagina.click("#login-btn");
  await s.pagina.waitForSelector(".tabs .tab");
});
after(async () => nav && nav.cerrar());

// El HTML del boletín, abierto en una página aparte (como lo vería el representante en papel)
async function enPagina(html) {
  const p = await s.contexto.newPage();
  await p.setContent(html);
  return p;
}

test("media general: escudo, ficha, resumen y notas de cada lapso con la definitiva", async () => {
  await llamar(`imprimirBoletin("est2")`);
  const html = await ultima();
  assert.match(html, /class="b-escudo" src="data:image\/png;base64,iVBOR/); // el escudo del colegio
  assert.match(html, /class="b-marca"/); // y de marca de agua
  const p = await enPagina(html);
  assert.equal((await p.textContent(".b-nombre strong")).trim(), "Luis Alberto Gómez");
  assert.match(await p.textContent(".b-est"), /V-30222333[\s\S]*22\/07\/2012[\s\S]*José Gómez/);
  // Matemáticas 18 y 20 → 19 · Lengua 8 (pendiente) · Inglés 16 y 18 → 17. Promedio: (19 + 8 + 17) / 3 = 14,7
  const kpis = await p.$$eval(".b-kpi strong", (k) => k.map((x) => x.textContent.replace(/\s+/g, " ").trim()));
  assert.deepEqual(kpis, ["14,7", "2 / 3", "14", "19", "—"]);
  const filas = await p.$$eval(".b-notas tbody tr", (t) =>
    t.map((r) => [...r.children].map((c) => c.textContent.trim()))
  );
  assert.deepEqual(filas, [
    ["1", "Matemáticas", "18", "", "20", "", "—", "", "19", "Aprobada"],
    ["2", "Lengua y Literatura", "8", "", "—", "", "—", "", "8", "Pendiente"],
    ["3", "Inglés", "16", "", "18", "", "—", "", "17", "Aprobada"],
  ]);
  // Sección: sin sección es la «U»
  assert.match(await p.textContent(".b-nombre span"), /1er Año · Sección U/);
  // Área a revisar: la materia por debajo de 10, sin nota de revisión todavía
  assert.match(
    await p.textContent(".b-caja-info"),
    /Área a revisar\s*Lengua y Literatura\s*Definitiva: 8\s*Nota de revisión: por presentar/
  );
  // Solo firman la directora y la coordinación (sin docente guía ni representante)
  const firmas = await p.textContent(".b-firmas");
  assert.match(firmas, /Directora[\s\S]*Coordinación de Media General/);
  assert.doesNotMatch(firmas, /Docente guía|Representante/);
  await p.close();
});

test("en el boletín las notas van enteras (desde ,5 sube) y el cambio del consejo no se marca; los promedios con decimal", async () => {
  await llamar(`imprimirBoletin("est7")`);
  const html = await ultima();
  const p = await enPagina(html);
  const filas = await p.$$eval(".b-notas tbody tr", (t) =>
    t.map((r) => [...r.children].map((c) => c.textContent.trim()))
  );
  // Matemáticas 9,5 · 9,4 · 9,6 → definitiva 9,5 en la sábana → 10 (aprobada). Lengua: el consejo la dejó en 12.
  assert.deepEqual(filas, [
    ["1", "Matemáticas", "10", "", "9", "", "10", "", "10", "Aprobada"],
    ["2", "Lengua y Literatura", "16", "", "—", "", "—", "", "12", "Aprobada"],
    ["3", "Inglés", "12", "", "—", "", "—", "", "12", "Aprobada"],
  ]);
  assert.doesNotMatch(html, /consejo|Acta del consejo|ajustad|modificad/i);
  // Promedio general de las definitivas de la sábana: (9,5 + 12 + 12,4) / 3 = 11,3; el del 1er lapso, 12,5
  const kpis = await p.$$eval(".b-kpi strong", (k) => k.map((x) => x.textContent.replace(/\s+/g, " ").trim()));
  assert.deepEqual(kpis, ["11,3", "3 / 3", "12,5", "9,4", "9,6"]);
  assert.equal(await llamar(`definitivaDe(estudiantes.find((e) => e.id === "est7"), "Matemáticas").nota`), 9.5); // la sábana sigue con decimal
  await p.close();
});

test("primaria: el literal de cada indicador en los 3 lapsos, con la leyenda", async () => {
  await llamar(`imprimirBoletin("est6")`);
  const p = await enPagina(await ultima());
  const mate = await p.$$eval(".b-notas tbody tr", (t) =>
    t
      .map((r) => [...r.querySelectorAll("td")].map((c) => c.textContent.trim()))
      .filter((c) => /Suma y resta|Multiplicación/.test(c.join(" ")))
  );
  assert.deepEqual(mate, [
    ["Matemáticas", "Suma y resta", "A", "A", "—"],
    ["Multiplicación", "C", "B", "—"],
  ]);
  assert.match(await p.textContent(".b-sello"), /Educación Primaria/);
  assert.equal(await p.locator(".b-leyenda > div").count(), 5);
  assert.match(await p.textContent(".b-firmas"), /Coordinación de Primaria/);
  await p.close();
  // Inicial (Valentina, Nivel II) firma la coordinadora de Educación Inicial
  await llamar(`configInst = { ...configInst, coordinadorInicial: "Lic. María Pérez" }; imprimirBoletin("est3")`);
  const ini = await enPagina(await ultima());
  assert.match(await ini.textContent(".b-sello"), /Educación Inicial/);
  assert.match(await ini.textContent(".b-firmas"), /Lic. María Pérez\s*Coordinación de Educación Inicial/);
  await ini.close();
});

test("los boletines de todo un grado, uno por hoja y en orden alfabético", async () => {
  await llamar(
    `setTab("notas"); filtros.notasVista = "estudiante"; filtros.gradoNotas = "1er Año"; renderTabContent()`
  );
  await s.pagina.click("text=🖨️ Boletines de todo 1er Año");
  const p = await enPagina(await ultima());
  assert.deepEqual(await p.$$eval(".b-hoja .b-nombre strong", (n) => n.map((x) => x.textContent)), [
    "Andrea Blanco",
    "Luis Alberto Gómez",
  ]);
  assert.match(await p.textContent(".no-print"), /Imprimir los 2 boletines/);
  await p.close();
  assert.deepEqual(s.errores, []);
});

test("el boletín lleva el código del plantel, no el RIF (ese va en los recibos)", async () => {
  await llamar(`imprimirBoletin("est2")`);
  const p = await enPagina(await ultima());
  const dir = await p.textContent(".b-dir");
  assert.match(dir, /Código del plantel/);
  assert.doesNotMatch(dir, /RIF/);
  await p.close();
});

test("al imprimir no sale la dirección de la página: la hoja no deja margen al navegador para su encabezado y pie", async () => {
  await llamar(`imprimirBoletin("est2")`);
  const html = await ultima();
  assert.match(html, /@page\{size:letter portrait;margin:0\}/);
  assert.match(html, /@media print\{[^}]*\}\.b-hoja\{padding:9mm/);
});

test("puesto por promedio en el salón y en media general, inasistencias, área a revisar y materia pendiente", async () => {
  // Lapso 1: Luis (18 + 8 + 16) / 3 = 14 y Andrea (9,5 + 15,6 + 12,4) / 3 = 12,5. En los otros lapsos les faltan notas.
  await llamar(`(() => {
    const luis = estudiantes.find((e) => e.id === "est2");
    luis.pendienteAnterior = { aplica: true, materia: "Matemáticas (6to Grado)", nota: 14 };
    notas["est2_Lapso 1"]["Lengua y Literatura_ina"] = "3";
    return guardarNotaRevision(luis, "Lengua y Literatura", 11.5);
  })()`);
  const esc = await llamar(`__ESCRITURAS__.filter((e) => e.ruta === "notas/est2_Revision").at(-1)`);
  assert.equal(esc.datos["Lengua y Literatura_revision"], "11.5");

  await llamar(`imprimirBoletin("est2")`);
  const p = await enPagina(await ultima());
  const puestos = await p.$$eval(".b-puestos tbody tr", (t) =>
    t.map((r) => [...r.children].map((c) => c.textContent.replace(/\s+/g, " ").trim()))
  );
  assert.deepEqual(puestos, [
    ["En su salón (1er Año «U»)", "—", "1° de 2", "—", "—"],
    ["En el colegio (media general)", "—", "1° de 2", "—", "—"],
  ]);
  const lengua = await p.$$eval(".b-notas tbody tr:nth-child(2) td", (t) => t.map((c) => c.textContent.trim()));
  assert.deepEqual(lengua.slice(2, 4), ["8", "3"]); // nota e inasistencias del 1er lapso
  const cajas = await p.$$eval(".b-caja-info", (c) => c.map((x) => x.textContent.replace(/\s+/g, " ").trim()));
  assert.match(cajas[0], /Lengua y Literatura\s*Definitiva: 8\s*Nota de revisión: 12\s*Aprobada en revisión/);
  assert.match(cajas[1], /Materia pendiente del año anterior\s*Aplica · Matemáticas \(6to Grado\) · Nota: 14/);
  await p.close();

  // Andrea no tiene materia pendiente del año anterior registrada: queda en blanco
  await llamar(`imprimirBoletin("est7")`);
  const p2 = await enPagina(await ultima());
  assert.match(await p2.textContent(".b-caja-info"), /Materia pendiente del año anterior\s*_+/);
  assert.match(await p2.textContent(".b-puestos"), /2° de 2/);
  await p2.close();
});

test("desempate: con el mismo promedio, el destacado (por su conducta) queda adelante en ese período", async () => {
  // Andrea queda con el mismo promedio que Luis en el 1er lapso: 14
  await llamar(`Object.assign(notas["est7_Lapso 1"], {
    Matemáticas_lapso: "18", "Lengua y Literatura_lapso": "8", Inglés_lapso: "16" })`);
  const puestos = (id) =>
    llamar(`JSON.stringify(puestosEstudiante(estudiantes.find((e) => e.id === "${id}"), "Lapso 1").colegio)`);
  assert.equal(await puestos("est2"), JSON.stringify({ puesto: 1, total: 2 }));
  assert.equal(await puestos("est7"), JSON.stringify({ puesto: 1, total: 2 }));

  // En la sábana (Lapso 1) sale el empate, con la casilla para destacar
  await llamar(
    `setTab("notas"); filtros.notasVista = "sabana"; filtros.sabGrado = "1er Año"; filtros.sabVer = "Lapso 1"; renderTabContent()`
  );
  const fila = s.pagina.locator(".sab-empates tbody tr", { hasText: "Andrea Blanco" });
  assert.match(await s.pagina.textContent(".sab-empates"), /14[\s\S]*Andrea Blanco[\s\S]*Luis Alberto Gómez/);
  await fila.locator("input[type=checkbox]").check();
  await s.pagina.waitForSelector("text=Destacado en el desempate");
  const esc = await llamar(`__ESCRITURAS__.filter((e) => e.ruta === "notas/est7_Desempate").at(-1)`);
  assert.equal(esc.datos["Lapso 1"], true);

  assert.equal(await puestos("est7"), JSON.stringify({ puesto: 1, total: 2 }));
  assert.equal(await puestos("est2"), JSON.stringify({ puesto: 2, total: 2 }));
  // Solo en ese período: en el cuadro de honor del 1er lapso también va primero
  const honor = await llamar(
    `JSON.stringify(cuadroHonor("Lapso 1", true).general.map((x) => [x.est.nombre, x.puesto]))`
  );
  assert.equal(
    honor,
    JSON.stringify([
      ["Andrea Blanco", 1],
      ["Luis Alberto Gómez", 2],
    ])
  );
  assert.deepEqual(s.errores, []);
});
