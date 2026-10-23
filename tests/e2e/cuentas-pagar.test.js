// 💰 Finanzas → 🧾 Por pagar: se anota lo que hay que pagar con su vencimiento; al pagarlo se registra el gasto con
// sus datos y, si es de cada mes, queda anotada la del mes siguiente. En Inicio avisa lo vencido y lo de la semana.
//
// Uso: node --test tests/e2e/cuentas-pagar.test.js
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { abrirNavegador } = require("./entorno");

let nav, s;
const llamar = (codigo) => s.pagina.evaluate(codigo);
const cuentas = () => llamar(`JSON.parse(JSON.stringify(cuentasPagar))`);

before(async () => {
  nav = await abrirNavegador();
  s = await nav.nuevaPagina();
  await s.pagina.goto(nav.base);
  await s.pagina.waitForSelector("#l-email");
  await s.pagina.fill("#l-email", "herrerajoicer@gmail.com");
  await s.pagina.fill("#l-pwd", "prueba123");
  await s.pagina.click("#login-btn");
  await s.pagina.waitForSelector(".tabs .tab");
  await llamar(`tasas[todayStr()] = 184.5; setTab("finanzas"); subTab.finanzas = "porpagar"; renderTabContent()`);
});
after(async () => nav && nav.cerrar());

async function nueva(desc, monto, moneda, vence, rec) {
  await s.pagina.click("text=➕ Nueva cuenta por pagar");
  await s.pagina.fill("#cp-desc", desc);
  await s.pagina.fill("#cp-prov", "Proveedor " + desc);
  await s.pagina.fill("#cp-monto", monto);
  await s.pagina.selectOption("#cp-moneda", moneda);
  await s.pagina.fill("#cp-vence", vence);
  if (rec) await s.pagina.selectOption("#cp-rec", "mensual");
  await llamar(`guardarCuentaPagar("")`);
}

test("se anotan con su vencimiento y se ven por fecha, con lo vencido y lo de la semana", async () => {
  await nueva("Alquiler", "300", "USD", "2026-10-31", true);
  await nueva("Luz", "18450", "VES", "2026-10-10");
  await nueva("Impuesto municipal", "25", "USD", "2026-10-01");
  const lista = await s.pagina.textContent(".list");
  assert.ok(
    lista.indexOf("Impuesto municipal") < lista.indexOf("Luz") && lista.indexOf("Luz") < lista.indexOf("Alquiler")
  );
  assert.match(await s.pagina.textContent(".cuenta-pagar:has-text('Impuesto')"), /⚠️ Vencida/);
  assert.match(
    await s.pagina.textContent(".cuenta-pagar:has-text('Luz')"),
    /⏰ Vence pronto[\s\S]*Bs\. 18\.450,00[\s\S]*≈ \$ 100,00/
  );
  assert.match(await s.pagina.textContent(".cuenta-pagar:has-text('Alquiler')"), /🔁 cada mes/);
  assert.match(
    await s.pagina.textContent(".stats-grid"),
    /\$ 25,00\s*Vencidas \(1\)[\s\S]*\$ 100,00\s*Vencen en 7 días \(1\)/
  );
  // y en Inicio
  await llamar(`setTab("dashboard")`);
  assert.match(
    await s.pagina.textContent(".aviso-cuentas"),
    /1 vencida \(\$ 25,00\) · 1 vence esta semana \(\$ 100,00\)/
  );
  await s.pagina.click(".aviso-cuentas");
  await s.pagina.waitForSelector(".cuenta-pagar");
});

test("al pagarla, el gasto viene lleno; la cuenta queda pagada y la de cada mes se anota para el mes siguiente", async () => {
  await s.pagina.click(".cuenta-pagar:has-text('Alquiler') >> text=✓ Pagar");
  assert.equal(await s.pagina.inputValue("#fin-desc"), "Alquiler");
  assert.equal(await s.pagina.inputValue("#fin-monto"), "300");
  assert.equal(await s.pagina.inputValue("#fin-resp"), "Proveedor Alquiler");
  assert.equal(await llamar(`monedaFin()`), "USD");
  await llamar(`guardarFinanza("gasto")`);
  await s.pagina.waitForFunction(() => cuentasPagar.some((c) => c.descripcion === "Alquiler" && c.estado === "pagada"));
  const gasto = await llamar(`JSON.parse(JSON.stringify(finanzas.find((f) => f.descripcion === "Alquiler")))`);
  assert.equal(gasto.monto, 300);
  assert.equal(gasto.tipo, "gasto");
  const alquiler = (await cuentas()).filter((c) => c.descripcion === "Alquiler");
  assert.deepEqual(alquiler.map((c) => [c.estado, c.vence]).sort(), [
    ["pagada", "2026-10-31"],
    ["pendiente", "2026-11-30"],
  ]);
  assert.equal(alquiler.find((c) => c.estado === "pagada").gastoId, gasto.id);
  await llamar(`renderTabContent()`);
  assert.match(await s.pagina.textContent(".card:has-text('Pagadas hace poco')"), /✓ Alquiler/);
  // la de Bs. se paga en Bs.
  await s.pagina.click(".cuenta-pagar:has-text('Luz') >> text=✓ Pagar");
  assert.equal(await llamar(`monedaFin()`), "VES");
  assert.equal(await s.pagina.inputValue("#fin-monto"), "18450");
  await llamar(`cerrarModal()`);
});

test("se edita y se borra", async () => {
  await s.pagina.click(".cuenta-pagar:has-text('Impuesto') >> button[title='Editar']");
  await s.pagina.fill("#cp-monto", "30");
  const id = await llamar(`cuentasPagar.find((c) => c.descripcion === "Impuesto municipal").id`);
  await llamar(`guardarCuentaPagar(${JSON.stringify(id)})`);
  assert.equal(await llamar(`cuentasPagar.find((c) => c.id === ${JSON.stringify(id)}).monto`), 30);
  await llamar(`abrirModal({ tipo: "editar-cuenta-pagar", id: ${JSON.stringify(id)} })`);
  await llamar(`eliminarCuentaPagar(${JSON.stringify(id)})`);
  assert.equal(await llamar(`cuentasPagar.some((c) => c.id === ${JSON.stringify(id)})`), false);
  assert.equal(await llamar(`__DATOS_FALSOS__.cuentas_pagar.has(${JSON.stringify(id)})`), false);
  assert.deepEqual(s.errores, []);
});
