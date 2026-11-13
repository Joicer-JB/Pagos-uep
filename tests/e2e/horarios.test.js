// Nómina → 🗓️ Horarios: cargar de una vez los horarios de las fotos (Primaria por grado; Media general y
// especialistas en la ficha de cada profesor), corregir un grado e imprimirlo.
//
// Uso: node --test tests/e2e/horarios.test.js
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const semilla = require("./datos/semilla");
const { abrirNavegador } = require("./entorno");

const datos = JSON.parse(JSON.stringify(semilla));
const col = datos.colecciones;
const prof = (nombre, extra = {}) => ({
  nombre,
  cedula: "V-1",
  cargo: "Docente",
  salario: 100,
  activo: true,
  ...extra,
});
Object.assign(col.trabajadores, {
  oliver: prof("Oliver Rodríguez"),
  german: prof("German Pérez", {
    clases: [{ materia: "Química", grados: ["2do Año"], dias: ["Lun"], desde: "", hasta: "" }],
  }),
  jaime1: prof("Jaime Uno"),
  jaime2: prof("Jaime Dos"),
});
col.config.materias = { "1er Año": ["Matemáticas", "Geografía, Historia y Ciudadanía", "Lengua y Literatura"] };

let nav, s;
const llamar = (c) => s.pagina.evaluate(c);
const trab = (id) => llamar(`JSON.parse(JSON.stringify(__DATOS_FALSOS__.trabajadores.get(${JSON.stringify(id)})))`);

before(async () => {
  nav = await abrirNavegador({ datos });
  s = await nav.nuevaPagina();
  await s.pagina.goto(nav.base);
  await s.pagina.waitForSelector("#l-email");
  await s.pagina.fill("#l-email", "herrerajoicer@gmail.com");
  await s.pagina.fill("#l-pwd", "prueba123");
  await s.pagina.click("#login-btn");
  await s.pagina.waitForSelector(".tabs .tab");
  await llamar(`setTab("nomina"); subTab.nomina = "horarios"; renderTabContent()`);
  await s.pagina.waitForSelector("#hf-abrir");
});
after(async () => nav && nav.cerrar());

test("sin horarios todavía: el grado lo dice y se puede escribir", async () => {
  assert.match(await s.pagina.textContent(".card:has(#h-editar)"), /1er Grado no tiene horario todavía/);
});

test("la vista previa elige al profesor por su primer nombre y avisa lo que falta", async () => {
  await s.pagina.click("#hf-abrir");
  const valor = (i) => s.pagina.inputValue("#hf-mg-" + i);
  assert.equal(await valor(0), "oliver"); // Oliver
  assert.equal(await valor(1), "german"); // Germán, sin tilde en Nómina
  assert.equal(await valor(4), ""); // Jaime: hay dos
  assert.equal(await valor(2), ""); // Angel: no está en Nómina
  const texto = await s.pagina.textContent(".carga-fotos");
  assert.match(texto, /Hay 2 trabajadores con ese nombre/);
  // 1er Año ya tiene GHC con su nombre completo en Configuración, pero no Orientación y Convivencia; 2do Año no tiene
  // materias configuradas: ahí no se avisa nada
  assert.match(texto, /Geografía, Historia y Ciudadanía · 1er Año/);
  assert.match(texto, /No está en ⚙️ Config → Materias: Orientación y Convivencia \(1er Año\)/);
  assert.doesNotMatch(texto, /\(2do Año\)/);
  // los especialistas no se eligen solos
  assert.equal(await s.pagina.inputValue("#hf-esp-3"), "");
});

test("guardar todo: Primaria por grado y las clases en la ficha de cada profesor", async () => {
  await s.pagina.selectOption("#hf-mg-4", "jaime2");
  await s.pagina.selectOption("#hf-esp-3", "trab1"); // Educación Física de Inicial y Primaria
  await s.pagina.click("#hf-guardar");
  await s.pagina.waitForFunction(() => !document.querySelector(".carga-fotos"));
  const h = await llamar(`JSON.parse(JSON.stringify(__DATOS_FALSOS__.config.get("horarios")))`);
  assert.deepEqual(Object.keys(h), ["1er Grado", "2do Grado", "3er Grado", "4to Grado", "5to Grado", "6to Grado"]);
  assert.deepEqual(h["5to Grado"].filas[0].celdas, [
    "Caligrafía",
    "Caligrafía",
    "Caligrafía",
    "Caligrafía",
    "Caligrafía",
  ]);

  assert.equal((await trab("oliver")).clases.length, 8);
  const ef = (await trab("trab1")).clases; // Educación Física de Inicial y Primaria
  assert.equal(ef.length, 7);
  assert.ok(ef.some((c) => c.grados.join() === "Maternal,Nivel I" && c.dias.join() === "Jue"));
  const german = await trab("german");
  assert.equal(german.clases[0].materia, "Química"); // la que ya tenía se queda
  assert.equal(german.clases.length, 1 + 4);
  assert.equal((await trab("jaime2")).clases.length, 5);
  assert.equal((await trab("jaime1")).clases, undefined);
  // el horario del grado se ve
  assert.match(await s.pagina.textContent(".tabla-horario"), /Inglés.*Portugués/);
});

test("cargar otra vez no repite nada", async () => {
  await s.pagina.click("#hf-abrir");
  await s.pagina.selectOption("#hf-mg-4", "jaime2");
  await s.pagina.uncheck("#hf-primaria");
  await s.pagina.click("#hf-guardar");
  await s.pagina.waitForSelector("#toast-msg:has-text('Nada nuevo')");
  assert.equal((await trab("jaime2")).clases.length, 5);
});

test("📚 Clases muestra lo cargado y Media general no tiene choques", async () => {
  await llamar(`subTab.nomina = "clases"; renderTabContent()`);
  const anio = await s.pagina.textContent('.clases-grado[data-grado="3er Año"]');
  assert.match(anio, /Física · Jaime Dos/);
  assert.match(anio, /Química · German Pérez/);
  const choques = (await s.pagina.$(".choques-horario")) ? await s.pagina.textContent(".choques-horario") : "";
  assert.doesNotMatch(choques, /Año/);
});

test("corregir un grado y imprimirlo", async () => {
  await llamar(`subTab.nomina = "horarios"; horarioVer = "6to Grado"; renderTabContent()`);
  await s.pagina.click("#h-editar");
  await s.pagina.fill("#h-c-6-4", "Salida 11:00");
  await s.pagina.fill("#h-hasta-0", "07:00"); // mal: antes de la de inicio
  await s.pagina.click("#h-guardar");
  assert.match(await s.pagina.textContent("#h-err"), /Fila 1: la hora de salida/);
  await s.pagina.fill("#h-hasta-0", "08:00");
  await s.pagina.click("#h-guardar");
  await s.pagina.waitForSelector(".tabla-horario");
  const h = await llamar(`JSON.parse(JSON.stringify(__DATOS_FALSOS__.config.get("horarios")["6to Grado"]))`);
  assert.equal(h.filas.at(-1).celdas[4], "Salida 11:00");
  assert.equal(h.filas.length, 7);
  await s.pagina.click("text=🖨️ Imprimir");
  const html = await llamar(`window.__IMPRESIONES__.at(-1).html`);
  assert.match(html, /Horario de clases/);
  assert.match(html, /6to Grado/);
  assert.match(html, /Salida 11:00/);
});
