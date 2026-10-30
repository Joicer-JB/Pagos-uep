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
    ["1", "Matemáticas", "18", "20", "—", "19", "Aprobada"],
    ["2", "Lengua y Literatura", "8", "—", "—", "8", "Pendiente"],
    ["3", "Inglés", "16", "18", "—", "17", "Aprobada"],
  ]);
  assert.match(await p.textContent(".b-aviso"), /Materias pendientes: Lengua y Literatura/);
  assert.match(
    await p.textContent(".b-firmas"),
    /Directora[\s\S]*Coordinación de Media General[\s\S]*Docente guía[\s\S]*Representante/
  );
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
    ["1", "Matemáticas", "10", "9", "10", "10", "Aprobada"],
    ["2", "Lengua y Literatura", "16", "—", "—", "12", "Aprobada"],
    ["3", "Inglés", "12", "—", "—", "12", "Aprobada"],
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
