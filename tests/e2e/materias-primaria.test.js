// 📚 Las áreas de primaria y preescolar se configuran en Configuración → Materias (como las de media general), y el
// logo del Ministerio que sube el director sale también en la boleta de media general, la imprima quien la imprima.
//
// Uso: node --test tests/e2e/materias-primaria.test.js
const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const semilla = require("./datos/semilla");
const { abrirNavegador } = require("./entorno");

// Un PNG de 1×1 basta como «logo» de prueba
const LOGO =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=";

let nav;
after(async () => nav && nav.cerrar());

async function entrar(datos, correo = "herrerajoicer@gmail.com") {
  nav = nav || (await abrirNavegador({ datos }));
  const s = await nav.nuevaPagina();
  await s.pagina.goto(nav.base);
  await s.pagina.waitForSelector("#l-email");
  await s.pagina.fill("#l-email", correo);
  await s.pagina.fill("#l-pwd", "prueba123");
  await s.pagina.click("#login-btn");
  await s.pagina.waitForSelector(".tabs .tab");
  s.llamar = (c) => s.pagina.evaluate(c);
  return s;
}

test("primaria: el director quita y agrega áreas; Notas, Indicadores y la boleta usan la lista nueva", async () => {
  const datos = JSON.parse(JSON.stringify(semilla));
  semilla.ponerFichas(datos);
  nav = await abrirNavegador({ datos });
  const s = await entrar(datos);
  // Sin lista guardada: las de siempre
  assert.deepEqual(await s.llamar(`getAreas("3er Grado")`), await s.llamar(`[...AREAS_PRIMARIA]`));
  await s.llamar(`setTab("config"); subTab.config = "materias"; renderTabContent()`);
  await s.pagina.click("text=Primaria (1er a 6to grado)");
  await s.pagina.waitForSelector("text=Áreas de Primaria (1er a 6to grado)");
  // Quita «Educación Estética» (la 6ta) y agrega «Música»
  await s.pagina.locator(`button[onclick="eliminarMateria('nivel:primaria',5)"]`).click();
  await s.pagina.fill("#nueva-materia", "Música");
  await s.pagina.click("text=+ Agregar");
  await s.pagina.click(`button[onclick="guardarMaterias('nivel:primaria')"]`);
  await s.pagina.waitForFunction(() => (__DATOS_FALSOS__.config.get("areas") || {}).primaria);
  const guardada = await s.llamar(`JSON.parse(JSON.stringify(__DATOS_FALSOS__.config.get("areas")))`);
  const esperada = [
    "Lengua y Literatura",
    "Matemáticas",
    "Ciencias Naturales y Tecnología",
    "Ciencias Sociales",
    "Educación Física",
    "Inglés",
    "Música",
  ];
  assert.deepEqual(guardada, { primaria: esperada });
  assert.deepEqual(await s.llamar(`getAreas("3er Grado")`), esperada);
  // Preescolar y media general no cambian
  assert.deepEqual(await s.llamar(`getAreas("Nivel I")`), await s.llamar(`[...AREAS_MATERNAL]`));
  // La boleta de primaria trae «Música» y ya no «Educación Estética»
  await s.llamar(`imprimirBoletin("est6", "Lapso 1")`);
  const html = await s.llamar(`window.__IMPRESIONES__.at(-1).html`);
  assert.match(html, /Música/);
  assert.doesNotMatch(html, /Educación Estética/);
  // «Volver a la lista original» la deja como venía
  await s.pagina.click(`button[onclick="restaurarAreas('nivel:primaria')"]`);
  assert.deepEqual(await s.llamar(`getAreas("3er Grado")`), await s.llamar(`[...AREAS_PRIMARIA]`));
  await s.contexto.close();
});

test("la lista guardada la ven también los docentes al cargar notas", async () => {
  const datos = JSON.parse(JSON.stringify(semilla));
  datos.colecciones.config.areas = { primaria: ["Matemáticas", "Lengua y Literatura"] };
  semilla.ponerFichas(datos);
  await nav.cerrar();
  nav = null;
  const s = await entrar(datos, "docente.prueba@example.com");
  assert.deepEqual(await s.llamar(`getAreas("3er Grado")`), ["Matemáticas", "Lengua y Literatura"]);
  await s.contexto.close();
});

test("boleta de media general: lleva el logo del Ministerio a la derecha, también si la imprime un docente", async () => {
  const datos = JSON.parse(JSON.stringify(semilla));
  datos.colecciones.config.logos = { ministerio: LOGO };
  semilla.ponerFichas(datos);
  await nav.cerrar();
  nav = null;
  const s = await entrar(datos);
  await s.llamar(`imprimirBoletin("est2")`);
  const html = await s.llamar(`window.__IMPRESIONES__.at(-1).html`);
  assert.ok(html.includes(`class="b-min" src="${LOGO}"`));
  assert.match(html, /República Bolivariana de Venezuela<br\/>Ministerio del Poder Popular/);
  // Un docente también recibe el logo (antes solo se cargaba para el director)
  const d = await entrar(datos, "docente.prueba@example.com");
  assert.equal(await d.llamar(`configLogos.ministerio`), LOGO);
  await s.contexto.close();
  await d.contexto.close();
});

test("boleta de media general sin logo subido: no deja hueco", async () => {
  const datos = JSON.parse(JSON.stringify(semilla));
  semilla.ponerFichas(datos);
  await nav.cerrar();
  nav = null;
  const s = await entrar(datos);
  await s.llamar(`imprimirBoletin("est2")`);
  const html = await s.llamar(`window.__IMPRESIONES__.at(-1).html`);
  assert.doesNotMatch(html, /class="b-min"/);
  assert.match(html, /República Bolivariana de Venezuela · Ministerio/);
  await s.contexto.close();
});
