// Animaciones en el navegador con el Firebase falso: aviso «¡Pago realizado con éxito!» al pagar (Pagos, Caja y
// Nómina), que se quita solo y no bloquea la pantalla, y modo «reducir movimiento».
//
// Uso: node --test tests/e2e/animaciones.test.js
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { abrirNavegador } = require("./entorno");

let nav, sesion;
const pagina = () => sesion.pagina;
const llamar = (codigo) => pagina().evaluate(codigo);
const aviso = () =>
  llamar(
    `(() => { const o = document.querySelector(".exito-overlay"); return o ? { texto: o.innerText, clases: o.className } : null; })()`
  );

before(async () => {
  nav = await abrirNavegador();
  sesion = await nav.nuevaPagina();
  await pagina().goto(nav.base);
  await pagina().waitForSelector("#l-email");
  await pagina().fill("#l-email", "herrerajoicer@gmail.com");
  await pagina().fill("#l-pwd", "prueba123");
  await pagina().click("#login-btn");
  await pagina().waitForSelector(".tabs .tab");
  await llamar(`tasas[todayStr()] = 184.5`);
});
after(async () => nav && nav.cerrar());

test("Pagos: al registrar un pago aparece «¡Pago realizado con éxito!» con el monto y el recibo", async () => {
  await llamar(`setTab("pagos"); subTab.pagos = "nuevo"; renderTabContent(); seleccionarEstudiantePago("est4")`);
  await pagina().fill("#p-total", "55");
  await llamar(`guardarPago()`);
  await pagina().waitForSelector(".exito-overlay");
  const a = await aviso();
  assert.match(a.texto, /¡Pago realizado con éxito!/);
  assert.match(a.texto, /\$ 55,00 · Recibo FAC-000001/);
  assert.equal(await llamar(`modalActual && modalActual.tipo`), "recibo", "el recibo queda abierto debajo");
});

test("el aviso no bloquea la pantalla y se quita solo", async () => {
  assert.equal(await llamar(`getComputedStyle(document.querySelector(".exito-overlay")).pointerEvents`), "none");
  // se puede cerrar el recibo (botón «Cerrar») mientras se ve el aviso
  await pagina().locator('.modal button[onclick="cerrarModal()"]').last().click();
  assert.equal(await llamar(`modalActual`), null);
  await pagina().waitForSelector(".exito-overlay", { state: "detached", timeout: 4000 });
});

test("Caja: también celebra el cobro", async () => {
  await llamar(`setTab("caja")`);
  await pagina().fill("#caja-q", "Luis");
  await pagina().dispatchEvent("#caja-q", "input");
  await pagina().waitForTimeout(100);
  await pagina().click('[onclick^="cajaElegir("]');
  await pagina().click('[onclick^="cajaMetodo("]');
  if (await pagina().isDisabled('[onclick="cajaCobrar()"]')) await pagina().click('[onclick^="cajaToggle("]');
  await pagina().click('[onclick="cajaCobrar()"]');
  await pagina().waitForSelector(".exito-overlay");
  assert.match((await aviso()).texto, /¡Pago realizado con éxito![\s\S]*Recibo FAC-000002/);
});

test("Nómina: «¡Pago de nómina registrado!»", async () => {
  await pagina().waitForSelector(".exito-overlay", { state: "detached", timeout: 4000 });
  await llamar(`cerrarModal(); setTab("nomina"); abrirModal({ tipo: "pago-nomina" })`);
  await pagina().selectOption("#pn-trab", "trab1");
  await pagina().dispatchEvent("#pn-trab", "change");
  await pagina().fill("#pn-desc", "Quincena de prueba");
  await pagina().fill("#pn-monto", "100");
  await llamar(`guardarPagoNomina()`);
  await pagina().waitForSelector(".exito-overlay");
  assert.match((await aviso()).texto, /¡Pago de nómina registrado!/);
});

test("con «reducir movimiento» el chulito aparece ya dibujado, sin animación", async () => {
  await pagina().emulateMedia({ reducedMotion: "reduce" });
  await llamar(`mostrarExito("Prueba", "sin movimiento")`);
  assert.match((await aviso()).clases, /quieto/);
  assert.equal(await llamar(`getComputedStyle(document.querySelector(".exito-chulito")).strokeDashoffset`), "0px");
  assert.equal(await llamar(`animar(document.body, [{ opacity: 0 }, { opacity: 1 }])`), null);
  assert.deepEqual(sesion.errores, []);
});
