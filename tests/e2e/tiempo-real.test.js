// Tiempo real en el navegador con el Firebase falso: lo que otro equipo registra aparece en esta pantalla
// sin recargar, sin interrumpir a quien está escribiendo o tiene una ventana abierta.
//
// Uso: node --test tests/e2e/tiempo-real.test.js
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { abrirNavegador } = require("./entorno");

let nav, sesion;
const llamar = (codigo) => sesion.pagina.evaluate(codigo);
const espera = (ms = 600) => sesion.pagina.waitForTimeout(ms);
const hayAviso = () => llamar(`!!document.getElementById("aviso-cambios")`);
// Un pago registrado en OTRO equipo (directo en la base, sin pasar por esta pantalla)
const pagoDeOtroEquipo = (id, nombre, estId, total) =>
  llamar(`__OTRO_EQUIPO__.escribir("pagos", ${JSON.stringify(id)}, {
    nombre: ${JSON.stringify(nombre)}, estId: ${JSON.stringify(estId)}, fecha: todayStr(), concepto: "Inscripción",
    metodo: "Dólares Efectivo", total: ${total}, tasa: 184.5, totalBs: ${total * 184.5}, factura: "FAC-000900",
    timestamp: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 } })`);

before(async () => {
  nav = await abrirNavegador();
  sesion = await nav.nuevaPagina();
  await sesion.pagina.goto(nav.base);
  await sesion.pagina.waitForSelector("#l-email");
  await sesion.pagina.fill("#l-email", "josefajsanquez@gmail.com");
  await sesion.pagina.fill("#l-pwd", "prueba123");
  await sesion.pagina.click("#login-btn");
  await sesion.pagina.waitForSelector(".tabs .tab");
  await espera(200);
});
after(async () => nav && nav.cerrar());

test("al entrar quedan escuchando pagos, estudiantes y finanzas", async () => {
  assert.equal(await llamar("__OTRO_EQUIPO__.oyentes()"), 3);
});

test("un pago registrado en otro equipo aparece solo en la pantalla de Inicio", async () => {
  await pagoDeOtroEquipo("remoto1", "Valentina Rojas", "est3", 60);
  await espera();
  assert.equal(await llamar(`pagos.some((p) => p.id === "remoto1")`), true);
  assert.match(await llamar(`document.getElementById("app").innerHTML`), /Valentina Rojas/);
  assert.equal(await hayAviso(), false, "sin nada abierto se redibuja solo, sin aviso");
});

test("si hay una ventana abierta no se interrumpe: aparece un aviso para actualizar", async () => {
  await llamar(`abrirModal({ tipo: "ver-estudiante", id: "est2" })`);
  await llamar(`__OTRO_EQUIPO__.escribir("estudiantes", "est2", { moraMonto: 20 })`);
  await espera();
  assert.equal(await llamar(`modalActual && modalActual.tipo`), "ver-estudiante", "la ventana sigue abierta");
  assert.equal(await hayAviso(), true);
  assert.equal(await llamar(`estudiantes.find((e) => e.id === "est2").moraMonto`), 20, "los datos ya están al día");
  await llamar(`cerrarModal()`);
  await sesion.pagina.click("#aviso-cambios button");
  assert.equal(await hayAviso(), false);
});

test("lo que guarda este mismo equipo no se toma como un cambio de otro", async () => {
  await llamar(`abrirModal({ tipo: "tasa" })`); // con una ventana abierta, un cambio ajeno mostraría el aviso
  await llamar(`(async () => {
    const r = await registrarCobro([{ nombre: "Sofía", estId: "est6", fecha: todayStr(), concepto: "Inscripción",
      metodo: "Punto", total: 10, tasa: 184.5, totalBs: 1845 }], { estId: "est6", aplicaDeuda: () => false });
    reflejarCobro("est6", r);
  })()`);
  await espera();
  assert.equal(await hayAviso(), false);
  await llamar(`cerrarModal()`);
});

test("Cobranza refleja la deuda que cambió otro equipo", async () => {
  await llamar(`setTab("cobranza")`);
  await llamar(
    `__OTRO_EQUIPO__.escribir("estudiantes", "est4", { estado: "mora", moraMonto: 77, moraConcepto: "Deuda de prueba" })`
  );
  await espera();
  assert.match(await llamar(`document.getElementById("app").innerHTML`), /Deuda de prueba/);
});

test("en un año anterior (solo consulta) no se escucha nada, y al salir se deja de escuchar", async () => {
  await llamar(`cambiarAnioVista("2025-2026")`);
  await sesion.pagina.waitForSelector(".tabs .tab");
  await espera(200);
  assert.equal(await llamar("__OTRO_EQUIPO__.oyentes()"), 0);
  await llamar(`cambiarAnioVista("2026-2027")`);
  await sesion.pagina.waitForSelector(".tabs .tab");
  await espera(200);
  assert.equal(await llamar("__OTRO_EQUIPO__.oyentes()"), 3);
  await llamar(`logout()`);
  assert.equal(await llamar("__OTRO_EQUIPO__.oyentes()"), 0);
  assert.deepEqual(sesion.errores, []);
});
