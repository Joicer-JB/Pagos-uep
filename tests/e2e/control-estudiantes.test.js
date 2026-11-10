// Control de estudio en Estudiantes: inscribe estudiantes y edita sus datos y los del representante, sin ver nada
// financiero. Lee «estudiantes_control» (la copia sin mensualidad, beca ni deuda) y al guardar escribe en
// «estudiantes» solo sus campos, junto con la copia. Al inscribir, la mensualidad es la de su grado.
//
// Uso: node --test tests/e2e/control-estudiantes.test.js
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const semilla = require("./datos/semilla");
const { cargar } = require("../unidad/cargar");
const { abrirNavegador } = require("./entorno");

const fichaControl = cargar("js/servicios/fichas-docentes.js").evaluar("fichaControl");
const datos = JSON.parse(JSON.stringify(semilla));
const col = datos.colecciones;
datos.usuarios.push({ uid: "uid-control", email: "control@example.com", password: "prueba123" });
col.usuarios["uid-control"] = {
  nombre: "Encargada de Control de Estudio",
  correo: "control@example.com",
  rol: "docente",
  activo: true,
  controlEstudio: true,
};
col.autorizaciones["uid-control"] = { rol: "control", hasta: 4102444800000 };
col.config.cobranza = {
  ...col.config.cobranza,
  costos: { media: { inscripcion: 126, mensualidad: 45 }, primaria: { inscripcion: 61, mensualidad: 45 } },
};
Object.assign(col.estudiantes.est2, { cedulaAcudiente: "V-11222333", correoAcudiente: "jose@example.com" });
semilla.ponerFichas(datos);
// La copia de control de estudio, como la deja el director al entrar
col.estudiantes_control = Object.fromEntries(Object.entries(col.estudiantes).map(([id, e]) => [id, fichaControl(e)]));

let nav, s;
const llamar = (c) => s.pagina.evaluate(c);
const escrituras = (ruta) => llamar(`__ESCRITURAS__.filter((e) => e.ruta === ${JSON.stringify(ruta)})`);

before(async () => {
  nav = await abrirNavegador({ datos });
  s = await nav.nuevaPagina();
  await s.pagina.goto(nav.base);
  await s.pagina.waitForSelector("#l-email");
  await s.pagina.fill("#l-email", "control@example.com");
  await s.pagina.fill("#l-pwd", "prueba123");
  await s.pagina.click("#login-btn");
  await s.pagina.waitForSelector(".tabs .tab");
});
after(async () => nav && nav.cerrar());

test("la copia de control de estudio no lleva nada financiero", () => {
  const f = JSON.parse(JSON.stringify(fichaControl(semilla.colecciones.estudiantes.est2)));
  for (const k of ["mensualidad", "beca", "moraMonto", "moraConcepto", "sinRecargo", "deuda", "cuotaDesde"])
    assert.equal(k in f, false, k);
  assert.equal(f.estado, undefined); // «mora» no pasa; solo «retirado»
  assert.equal(f.nombre, "Luis Alberto Gómez");
});

test("ve Notas y Estudiantes; en Estudiantes no hay mora, deuda ni mensualidad", async () => {
  assert.equal(await llamar(`pestanaPermitida("estudiantes")`), true);
  assert.equal(await llamar(`pestanaPermitida("pagos")`), false);
  await llamar(`setTab("estudiantes")`);
  await s.pagina.waitForSelector(".list-item");
  const texto = await s.pagina.textContent("#app");
  assert.match(texto, /Luis Alberto Gómez/);
  assert.doesNotMatch(texto, /Mora|Al Saldo|Debe:|\/mes|\$/);
  assert.equal(await llamar(`estudiantes.some((e) => "mensualidad" in e || "moraMonto" in e)`), false);

  // Su ficha: datos del representante, sin pagos ni estado de cuenta
  await llamar(`abrirModal({ tipo: "ver-estudiante", id: "est2" })`);
  const ficha = await s.pagina.textContent(".modal");
  assert.match(ficha, /V-11222333[\s\S]*jose@example\.com/);
  assert.doesNotMatch(ficha, /Mensualidad|Pagado|Registrar Pago|Estado de cuenta/);
  assert.deepEqual(s.errores, []);
});

test("edita los datos del representante: guarda solo sus campos, en la ficha y en la copia", async () => {
  await llamar(`abrirModal({ tipo: "editar-estudiante", id: "est2" })`);
  assert.equal(await s.pagina.locator("#e-mens, #e-beca, #e-estado, #e-sinrec").count(), 0);
  await s.pagina.fill("#e-telacud", "0412-9998877");
  await s.pagina.fill("#e-seccion", "a");
  await s.pagina.click("text=✓ Guardar");
  await s.pagina.waitForSelector("text=Datos guardados");
  const [upd] = await escrituras("estudiantes/est2");
  assert.equal(upd.op, "update");
  assert.equal(upd.datos.telefonoAcudiente, "0412-9998877");
  assert.equal(upd.datos.seccion, "A");
  const permitidos = await llamar(`CAMPOS_EDITA_CONTROL`);
  for (const k of Object.keys(upd.datos)) assert.ok(permitidos.includes(k), "campo no permitido: " + k);
  const [copia] = await escrituras("estudiantes_control/est2");
  assert.equal(copia.datos.telefonoAcudiente, "0412-9998877");
  assert.equal("mensualidad" in copia.datos, false);
});

test("inscribe un estudiante nuevo con la mensualidad de su grado, sin verla", async () => {
  await llamar(`abrirModal({ tipo: "nuevo-estudiante" })`);
  assert.match(await s.pagina.textContent(".modal"), /La mensualidad se pone sola/);
  await s.pagina.fill("#e-nombre", "María Fernanda Ruiz");
  await s.pagina.selectOption("#e-grado", "1er Año");
  await s.pagina.fill("#e-acud", "Rosa Ruiz");
  await s.pagina.click("text=✓ Guardar");
  await s.pagina.waitForSelector("text=Estudiante inscrito");
  const nueva = (await llamar(`__ESCRITURAS__`)).filter(
    (e) => /^estudiantes\//.test(e.ruta) && e.datos && e.datos.nombre === "María Fernanda Ruiz"
  );
  assert.equal(nueva.length, 1);
  assert.equal(nueva[0].datos.mensualidad, 45); // la de media general en la estructura de costos
  assert.equal(nueva[0].datos.estado, "alsaldo");
  assert.equal(nueva[0].datos.inscritoPor, "control@example.com");
  assert.equal("beca" in nueva[0].datos, false);
  const id = nueva[0].ruta.split("/")[1];
  const [copia] = await escrituras("estudiantes_control/" + id);
  assert.equal("mensualidad" in copia.datos, false);
  // En su lista aparece, sin la mensualidad
  assert.equal(await llamar(`"mensualidad" in estudiantes.find((e) => e.nombre === "María Fernanda Ruiz")`), false);
  assert.deepEqual(s.errores, []);
});
