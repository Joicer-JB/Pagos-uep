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
  await p.close();
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
