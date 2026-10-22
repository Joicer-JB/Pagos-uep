// Nómina: personal con sueldo fijo + horas de clase (cada nivel a su tarifa), sus datos (RIF, títulos, cuentas),
// documentos adjuntos (certificado de salud con su vencimiento) y recibos de nómina «2 por hoja».
//
// Uso: node --test tests/e2e/nomina-personal.test.js
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { abrirNavegador } = require("./entorno");

let nav, s;
const llamar = (codigo) => s.pagina.evaluate(codigo);
const ultimaImpresion = () => llamar(`window.__IMPRESIONES__.at(-1).html`);
const trabajador = (nombre) =>
  llamar(`JSON.parse(JSON.stringify(trabajadores.find((t) => t.nombre === ${JSON.stringify(nombre)}) || null))`);
const PNG_1x1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);
const pdfDe = (bytes) => Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(bytes, 65)]);
async function hojas(html) {
  const p = await s.contexto.newPage();
  await p.setContent(html);
  const pdf = (await p.pdf({ format: "Letter", preferCSSPageSize: true })).toString("latin1");
  await p.close();
  return (pdf.match(/\/Type\s*\/Page(?!s)/g) || []).length;
}
const sinOverlay = () => s.pagina.waitForSelector(".exito-overlay", { state: "detached", timeout: 4000 });

before(async () => {
  nav = await abrirNavegador();
  s = await nav.nuevaPagina();
  await s.pagina.goto(nav.base);
  await s.pagina.waitForSelector("#l-email");
  await s.pagina.fill("#l-email", "herrerajoicer@gmail.com");
  await s.pagina.fill("#l-pwd", "prueba123");
  await s.pagina.click("#login-btn");
  await s.pagina.waitForSelector(".tabs .tab");
  await llamar(`tasas[todayStr()] = 184.5; setTab("nomina"); subTab.nomina = "nuevo"; renderTabContent()`);
});
after(async () => nav && nav.cerrar());

test("coordinadora con sueldo fijo y horas en Media general: sus datos y cuentas", async () => {
  await s.pagina.fill("#t-nombre", "Coordinadora Tres");
  await s.pagina.fill("#t-cedula", "V-14000333");
  await s.pagina.fill("#t-rif", "v140003339");
  await s.pagina.fill("#t-telefono", "04141234567");
  await s.pagina.fill("#t-fingreso", "2015-09-15");
  await s.pagina.fill("#t-cargo", "Coordinadora de Primaria y docente de Media general");
  await s.pagina.fill("#t-titulos", "Licenciada en Educación Integral\nEspecialista en Gerencia Educativa");
  await s.pagina.fill("#t-salario", "300");
  await s.pagina.click("text=+ Agregar horas de clase");
  assert.equal(await s.pagina.inputValue("#t-h-tarifa-0"), "2,5"); // Media general: $ 2,50 la hora
  await s.pagina.fill("#t-h-horas-0", "40");
  assert.match(
    await s.pagina.textContent("#t-resumen"),
    /Fijo \+ ⏱️ horas · gana al mes \$ 400,00 \(fijo \$ 300,00 \+ horas \$ 100,00\)/
  );
  // la cuenta dice el banco; una cuenta mal escrita no se guarda
  await s.pagina.fill("#t-c-num-0", "0134-0001-12-1234567890");
  assert.equal(await s.pagina.inputValue("#t-c-banco-0"), "Banesco");
  await s.pagina.fill("#t-c-num-1", "0105000112123456789");
  await llamar(`guardarTrabajador("")`);
  assert.match(await s.pagina.textContent("#t-err"), /Cuenta 2: la cuenta debe tener 20 dígitos \(tiene 19\)/);
  await s.pagina.fill("#t-c-num-1", "04141234567");
  await s.pagina.selectOption("#t-c-tipo-1", "Pago móvil");
  await s.pagina.fill("#t-c-banco-1", "Mercantil");
  await llamar(`guardarTrabajador("")`);
  await s.pagina.waitForSelector(".fila-trabajador:has-text('Coordinadora Tres')");
  const t = await trabajador("Coordinadora Tres");
  assert.equal(t.rif, "V-14000333-9");
  assert.deepEqual(t.titulos, ["Licenciada en Educación Integral", "Especialista en Gerencia Educativa"]);
  assert.deepEqual(t.horas, [{ nivel: "Media general", horas: 40, tarifa: 2.5 }]);
  assert.deepEqual(
    t.cuentas.map((c) => [c.banco, c.tipo, c.numero]),
    [
      ["Banesco", "Corriente", "01340001121234567890"],
      ["Mercantil", "Pago móvil", "04141234567"],
    ]
  );
  const fila = await s.pagina.textContent(".fila-trabajador:has-text('Coordinadora Tres')");
  assert.match(fila, /Fijo \+ ⏱️ horas/);
  assert.match(fila, /Media general: 40 h\/mes · \$ 2,50\/h/);
  assert.match(fila, /🩺 Sin certificado/);
  // no se repite la cédula
  await llamar(`subTab.nomina = "nuevo"; trabEditId = null; renderTabContent()`);
  await s.pagina.fill("#t-nombre", "Otra");
  await s.pagina.fill("#t-cedula", "14000333");
  await s.pagina.fill("#t-salario", "100");
  await llamar(`guardarTrabajador("")`);
  assert.match(await s.pagina.textContent("#t-err"), /Ya hay un trabajador con esa cédula: Coordinadora Tres/);
});

test("profesor de deporte: horas de Primaria a $ 2,00 y de Media general a $ 2,50", async () => {
  await s.pagina.fill("#t-nombre", "Profesor Deporte");
  await s.pagina.fill("#t-cedula", "V-18000444");
  await s.pagina.fill("#t-salario", "");
  await s.pagina.click("text=+ Agregar horas de clase");
  await s.pagina.selectOption("#t-h-nivel-0", "Primaria");
  assert.equal(await s.pagina.inputValue("#t-h-tarifa-0"), "2");
  await s.pagina.fill("#t-h-horas-0", "20");
  await s.pagina.click("text=+ Agregar horas de clase");
  await s.pagina.fill("#t-h-horas-1", "16");
  await s.pagina.fill("#t-h-tarifa-1", "2.5"); // con punto también vale
  assert.match(await s.pagina.textContent("#t-resumen"), /Por horas · gana al mes \$ 80,00/);
  await llamar(`guardarTrabajador("")`);
  await s.pagina.waitForSelector(".fila-trabajador:has-text('Profesor Deporte')");
  const t = await trabajador("Profesor Deporte");
  assert.deepEqual(t.horas, [
    { nivel: "Primaria", horas: 20, tarifa: 2 },
    { nivel: "Media general", horas: 16, tarifa: 2.5 },
  ]);
  const fila = await s.pagina.textContent(".fila-trabajador:has-text('Profesor Deporte')");
  assert.match(fila, /Por horas/);
  assert.doesNotMatch(fila, /Base:/);
  assert.match(fila, /Primaria: 20 h\/mes · \$ 2,00\/h/);
});

test("pagar la quincena: el sueldo fijo y las horas que trabajó, a la cuenta elegida", async () => {
  const t = await trabajador("Coordinadora Tres");
  await llamar(`abrirModal({ tipo: "pago-nomina", trabId: ${JSON.stringify(t.id)} })`);
  assert.equal(await s.pagina.inputValue("#pn-monto"), "150");
  assert.match(await s.pagina.textContent("#pn-horas"), /Horas de Media general · \$ 2,50 la hora/);
  assert.equal(await s.pagina.inputValue("#pn-h-0"), "20");
  assert.equal(await s.pagina.textContent("#pn-neto-total"), "$ 200,00");
  await s.pagina.fill("#pn-h-0", "18"); // faltó a 2 horas
  assert.equal(await s.pagina.textContent("#pn-h-m-0"), "$ 45,00");
  assert.equal(await s.pagina.textContent("#pn-neto-total"), "$ 195,00");
  assert.match(await s.pagina.textContent("#pn-cuenta"), /Banesco · Corriente · \*\*\*\*7890/);
  await llamar(`guardarPagoNomina()`);
  await s.pagina.waitForSelector(".exito-overlay");
  const [p] = await llamar(
    `JSON.parse(JSON.stringify(finanzas.filter((f) => f.trabajadorId === ${JSON.stringify(t.id)})))`
  );
  assert.equal(p.monto, 195);
  assert.deepEqual(
    p.nomina.asignaciones.map((a) => [a.concepto, a.monto, a.horas || null]),
    [
      ["Salario base", 150, null],
      ["Horas de Media general", 45, 18],
    ]
  );
  assert.deepEqual(p.cuentaPago, { banco: "Banesco", tipo: "Corriente", numero: "01340001121234567890" });
  const recibo = await ultimaImpresion();
  assert.match(recibo, /Horas de Media general <small>\(18 h × \$ 2,50\)<\/small>/);
  assert.match(recibo, /🏦 Banesco · Corriente · \*\*\*\*7890/);
  assert.doesNotMatch(recibo, /ORIGINAL/);
  // en la nómina del mes falta la 2da quincena: la mitad de lo que gana (aunque la 1ra llevó menos horas)
  await sinOverlay();
  await llamar(`subTab.nomina = "mes"; renderTabContent()`);
  const fila = await s.pagina.textContent(".nomina-fila:has-text('Coordinadora Tres')");
  assert.match(fila, /Gana \$ 400,00 al mes · pagado \$ 195,00/);
  assert.match(fila, /\$ 200,00\s*por pagar/);
});

test("certificado de salud: se adjunta con su vencimiento, avisa si venció y se imprime", async () => {
  const t = await trabajador("Coordinadora Tres");
  await llamar(`abrirModal({ tipo: "ver-trabajador", id: ${JSON.stringify(t.id)} })`);
  const ficha = await s.pagina.textContent(".modal");
  assert.match(ficha, /V-14000333-9/);
  assert.match(ficha, /Ingreso15\/09\/2015 · 11 años en la escuela/);
  assert.match(ficha, /Especialista en Gerencia Educativa/);
  assert.match(ficha, /Principal: Banesco · Corriente/);
  assert.match(ficha, /Falta adjuntar el certificado de salud/);
  assert.equal(await s.pagina.inputValue("#doc-clase"), "salud");
  await s.pagina.fill("#doc-vence", "2026-10-01"); // ya venció (hoy es 07/10/2026)
  await s.pagina.setInputFiles("#doc-archivo", { name: "certificado.png", mimeType: "image/png", buffer: PNG_1x1 });
  await s.pagina.click("text=📎 Adjuntar");
  await s.pagina.waitForSelector(".doc-trabajador");
  assert.match(await s.pagina.textContent(".modal"), /El certificado de salud venció el 01\/10\/2026/);
  const adj = (await trabajador("Coordinadora Tres")).adjuntos;
  assert.equal(adj.length, 1);
  assert.deepEqual([adj[0].clase, adj[0].tipo, adj[0].vence, adj[0].partes], ["salud", "image/jpeg", "2026-10-01", 1]);
  assert.equal(await llamar(`__DATOS_FALSOS__.documentos_trabajadores.has(${JSON.stringify(adj[0].id + "_0")})`), true);
  // se imprime la foto con el nombre del trabajador
  await s.pagina.click(".doc-trabajador >> text=Ver");
  await s.pagina.waitForFunction(() => /data:image\/jpeg;base64,/.test(window.__IMPRESIONES__.at(-1).html));
  assert.match(
    await ultimaImpresion(),
    /Certificado de salud · Coordinadora Tres · C\.I\. V-14000333 · vence el 01\/10\/2026/
  );
  // en la lista del personal: el aviso y la etiqueta
  await sinOverlay();
  await llamar(`cerrarModal(); subTab.nomina = "lista"; renderTabContent()`);
  assert.match(await s.pagina.textContent(".aviso-certificados"), /Coordinadora Tres \(venció el 01\/10\/2026\)/);
  assert.match(await s.pagina.textContent(".fila-trabajador:has-text('Coordinadora Tres')"), /🩺 Certificado vencido/);
});

test("un PDF grande se guarda en partes y se abre completo; uno de más de 4 MB no se acepta", async () => {
  const t = await trabajador("Coordinadora Tres");
  await llamar(`abrirModal({ tipo: "ver-trabajador", id: ${JSON.stringify(t.id)} })`);
  await s.pagina.selectOption("#doc-clase", "titulo");
  await s.pagina.setInputFiles("#doc-archivo", {
    name: "titulo.pdf",
    mimeType: "application/pdf",
    buffer: pdfDe(5 * 1024 * 1024),
  });
  await s.pagina.click("text=📎 Adjuntar");
  await s.pagina.waitForSelector("#doc-msg .error-msg");
  assert.match(await s.pagina.textContent("#doc-msg"), /pesa 5,0 MB y el máximo es 4 MB/);
  await s.pagina.setInputFiles("#doc-archivo", {
    name: "titulo.pdf",
    mimeType: "application/pdf",
    buffer: pdfDe(1200000),
  });
  await s.pagina.click("text=📎 Adjuntar");
  await s.pagina.waitForFunction(() => document.querySelectorAll(".doc-trabajador").length === 2);
  const titulo = (await trabajador("Coordinadora Tres")).adjuntos.find((a) => a.clase === "titulo");
  assert.equal(titulo.partes, 3); // 1,2 MB → 1,6 millones de caracteres en base64 → 3 partes de 700 mil
  const tam = await llamar(`(async () => (await leerDocumentoTrabajador(${JSON.stringify(titulo)})).length)()`);
  assert.equal(tam, "data:application/pdf;base64,".length + 4 * Math.ceil(1200009 / 3));
  // en la computadora se abre en el visor de PDF del navegador
  await llamar(`imprimirDocumentoTrabajador(${JSON.stringify(t.id)}, ${JSON.stringify(titulo.id)})`);
  await s.pagina.waitForFunction(() => window.__APERTURAS__.some((u) => u.startsWith("blob:")));
  // quitarlo borra sus partes
  await s.pagina.click(`.doc-trabajador:has-text('Título') >> button[title="Quitar"]`);
  await s.pagina.waitForFunction(() => document.querySelectorAll(".doc-trabajador").length === 1);
  for (let i = 0; i < 3; i++)
    assert.equal(
      await llamar(`__DATOS_FALSOS__.documentos_trabajadores.has(${JSON.stringify(titulo.id + "_" + i)})`),
      false
    );
  await llamar(`cerrarModal()`);
});

test("recibos de nómina «2 por hoja»: solo si se marca, original y copia en una hoja", async () => {
  await llamar(`subTab.nomina = "historial"; renderTabContent()`);
  assert.equal(await s.pagina.isChecked("#nomina-doble"), false);
  await s.pagina.click(".nomina-mov:has-text('Coordinadora Tres') >> text=Recibo");
  assert.doesNotMatch(await ultimaImpresion(), /COPIA/);
  await s.pagina.check("#nomina-doble");
  await s.pagina.click(".nomina-mov:has-text('Coordinadora Tres') >> text=Recibo");
  const html = await ultimaImpresion();
  assert.match(html, /ORIGINAL[\s\S]*✂ CORTAR AQUÍ[\s\S]*COPIA/);
  assert.equal(html.split("Neto a recibir").length - 1, 2);
  assert.equal(await hojas(html), 1);
  // el de pago no cambia: cada uno recuerda lo suyo
  assert.equal(await llamar(`dosPorHoja("recibo")`), false);
  // y en el formulario de pago la casilla ya sale marcada
  await llamar(`abrirModal({ tipo: "pago-nomina" })`);
  assert.equal(await s.pagina.isChecked("#pn-doble"), true);
  await llamar(`cerrarModal()`);
});

test("la ficha del trabajador se imprime con sus datos, sueldo, cuentas y documentos", async () => {
  const t = await trabajador("Coordinadora Tres");
  await llamar(`imprimirFichaTrabajador(${JSON.stringify(t.id)})`);
  const html = await ultimaImpresion();
  for (const txt of [
    "Ficha del trabajador",
    "V-14000333-9",
    "Licenciada en Educación Integral",
    "Horas de Media general",
    "40 h × $ 2,50 al mes = $ 100,00",
    "Banesco · Corriente · 01340001121234567890",
    "Mercantil · Pago móvil · 04141234567",
    "Certificado de salud",
  ])
    assert.ok(html.includes(txt), "falta en la ficha: " + txt);
  assert.deepEqual(s.errores, []);
});

test("clases que da: grados, materia, días y horario; la vista por grado avisa choques y grados sin docente", async () => {
  // la coordinadora: Primaria en la mañana (docente de aula de 3er Grado) y Matemáticas en Media general en la tarde
  const t = await trabajador("Coordinadora Tres");
  await llamar(`editarTrabajador(${JSON.stringify(t.id)})`);
  await s.pagina.click("text=+ Agregar clase");
  await s.pagina.check(`input[data-cl-grado="0"][value="3er Grado"]`);
  await s.pagina.click("text=+ Agregar clase");
  await s.pagina.fill("#t-cl-mat-1", "Matemáticas");
  await s.pagina.check(`input[data-cl-grado="1"][value="1er Año"]`);
  await s.pagina.check(`input[data-cl-grado="1"][value="2do Año"]`);
  await s.pagina.check(`input[data-cl-dia="1"][value="Lun"]`);
  await s.pagina.check(`input[data-cl-dia="1"][value="Mié"]`);
  await s.pagina.fill("#t-cl-desde-1", "13:00");
  await s.pagina.fill("#t-cl-hasta-1", "14:30");
  // en Media general la materia es obligatoria
  await s.pagina.click("text=+ Agregar clase");
  await s.pagina.check(`input[data-cl-grado="2"][value="5to Año"]`);
  await llamar(`guardarTrabajador(${JSON.stringify(t.id)})`);
  assert.match(await s.pagina.textContent("#t-err"), /Clase 3: escribe la materia/);
  await s.pagina.click(".t-clase[data-i='2'] >> button[title='Quitar']");
  await llamar(`guardarTrabajador(${JSON.stringify(t.id)})`);
  await s.pagina.waitForSelector(".fila-trabajador:has-text('Coordinadora Tres')");
  assert.deepEqual((await trabajador("Coordinadora Tres")).clases, [
    { materia: "", grados: ["3er Grado"], dias: [], desde: "", hasta: "" },
    { materia: "Matemáticas", grados: ["1er Año", "2do Año"], dias: ["Lun", "Mié"], desde: "13:00", hasta: "14:30" },
  ]);
  const fila = await s.pagina.textContent(".fila-trabajador:has-text('Coordinadora Tres')");
  assert.match(fila, /📚 3er Grado/);
  assert.match(fila, /📚 Matemáticas · 1er Año, 2do Año/);
  // el profesor de deporte: a todo el colegio, los lunes en la tarde (choca con la clase de Matemáticas)
  const d = await trabajador("Profesor Deporte");
  await llamar(`editarTrabajador(${JSON.stringify(d.id)})`);
  await s.pagina.click("text=+ Agregar clase");
  await s.pagina.fill("#t-cl-mat-0", "Educación Física");
  await s.pagina.click(".t-clase[data-i='0'] >> text=Todo el colegio");
  await s.pagina.click(".t-clase[data-i='0'] >> button:text-is('Inicial')"); // quita Inicial
  await s.pagina.check(`input[data-cl-dia="0"][value="Lun"]`);
  await s.pagina.fill("#t-cl-desde-0", "14:00");
  await s.pagina.fill("#t-cl-hasta-0", "15:00");
  await llamar(`guardarTrabajador(${JSON.stringify(d.id)})`);
  await s.pagina.waitForSelector(".fila-trabajador:has-text('Profesor Deporte')");
  assert.match(
    await s.pagina.textContent(".fila-trabajador:has-text('Profesor Deporte')"),
    /📚 Educación Física · Toda la Primaria, Toda la Media general/
  );
  // la vista por grado
  await llamar(`subTab.nomina = "clases"; renderTabContent()`);
  const g = (grado) => s.pagina.textContent(`.clases-grado[data-grado="${grado}"]`);
  assert.match(await g("3er Grado"), /Docente de aula · Coordinadora Tres/);
  assert.match(await g("3er Grado"), /Educación Física · Profesor Deporte/);
  assert.match(await g("1er Año"), /Matemáticas · Coordinadora Tres🕐 Lun, Mié · 1:00 p\. m\. a 2:30 p\. m\./);
  assert.match(await g("Maternal"), /Sin docente asignado/);
  const choques = await s.pagina.textContent(".choques-horario");
  assert.match(choques, /1er Año tiene dos clases a la vez el lunes: Matemáticas con Coordinadora Tres/);
  assert.match(choques, /2do Año tiene dos clases a la vez el lunes/);
  // se imprime
  await s.pagina.click("text=🖨️ Imprimir");
  const html = await ultimaImpresion();
  assert.match(html, /Clases por grado y año/);
  assert.match(html, /Matemáticas<\/td><td>Coordinadora Tres<\/td><td>Lun, Mié · 1:00 p\. m\. a 2:30 p\. m\./);
  // y en la ficha del trabajador
  await llamar(`abrirModal({ tipo: "ver-trabajador", id: ${JSON.stringify(t.id)} })`);
  assert.match(await s.pagina.textContent(".modal"), /Según el horario: 3 h de clase a la semana/);
  await llamar(`cerrarModal()`);
  assert.deepEqual(s.errores, []);
});

test("constancia de trabajo: la firma la directora, con el cargo, la fecha de ingreso y el salario en letras", async () => {
  const t = await trabajador("Coordinadora Tres");
  await llamar(`configInst = {}; abrirModal({ tipo: "ver-trabajador", id: ${JSON.stringify(t.id)} })`);
  await s.pagina.click("text=📜 Constancia");
  assert.match(
    await s.pagina.textContent(".modal"),
    /Falta el nombre de la directora, la cédula de la directora, el RIF del plantel/
  );
  await llamar(`configInst = { nombre: "U.E.P. Josefa Joaquina Sánchez", directora: "Lic. Directora Prueba",
    cedulaDirectora: "V-9000111", rif: "J-12345678-9", direccion: "Turumo - Caucagüita, Estado Miranda", codigo: "PD13831519" };
    abrirModal({ tipo: "constancia-trabajo", id: ${JSON.stringify(t.id)} })`);
  assert.doesNotMatch(await s.pagina.textContent(".modal"), /Falta/);
  await s.pagina.selectOption("#ct-trato", "la");
  await s.pagina.click("text=🖨️ Imprimir constancia");
  const texto = (await ultimaImpresion()).replace(/<[^>]+>/g, "").replace(/\s+/g, " ");
  for (const parte of [
    "Constancia de trabajo",
    "R.I.F.: J-12345678-9",
    "A quien pueda interesar",
    "Quien suscribe, Lic. Directora Prueba, titular de la cédula de identidad N° V-9000111",
    "que la ciudadana Coordinadora Tres, titular de la cédula de identidad N° V-14000333 y R.I.F. N° V-14000333-9",
    "presta sus servicios en esta institución desde el 15 de septiembre de 2015 hasta la presente fecha",
    "desempeñando el cargo de Coordinadora de Primaria y docente de Media general",
    "(docente de aula en 3er Grado; Matemáticas en 1er Año, 2do Año)",
    // 300 de sueldo + 40 h × 2,50 = 400 al mes; a Bs. 184,50 = 73.800
    "devengando un ingreso mensual promedio de Bs. 73.800,00 (SETENTA Y TRES MIL OCHOCIENTOS BOLÍVARES CON 00/100)",
    "equivalente a $ 400,00 a la tasa oficial del Banco Central de Venezuela del 7 de octubre de 2026",
    "en Turumo - Caucagüita, a los siete (7) días del mes de octubre de 2026",
  ])
    assert.ok(texto.includes(parte), "falta en la constancia: " + parte + "\n\n" + texto);
  // sin salario
  await llamar(`abrirModal({ tipo: "constancia-trabajo", id: ${JSON.stringify(t.id)} })`);
  await s.pagina.selectOption("#ct-sueldo", "no");
  await s.pagina.click("text=🖨️ Imprimir constancia");
  assert.doesNotMatch(await ultimaImpresion(), /devengando/);
  await llamar(`cerrarModal()`);
  assert.deepEqual(s.errores, []);
});
