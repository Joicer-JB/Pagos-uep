// Nómina: adelanto de quincena, préstamo con cuotas, pago de la quincena (que los descuenta solo), nómina del mes y
// recibos con asignaciones y deducciones.
//
// Uso: node --test tests/e2e/nomina.test.js
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { abrirNavegador } = require("./entorno");

let nav, s;
const llamar = (codigo) => s.pagina.evaluate(codigo);
const ultimaImpresion = () => llamar(`window.__IMPRESIONES__.at(-1).html`);
const movs = (tipo) =>
  llamar(
    `JSON.parse(JSON.stringify(finanzas.filter((f) => f.trabajadorId === "trab1" && f.nomina && f.nomina.tipo === "${tipo}")))`
  );

before(async () => {
  nav = await abrirNavegador();
  s = await nav.nuevaPagina();
  await s.pagina.goto(nav.base);
  await s.pagina.waitForSelector("#l-email");
  await s.pagina.fill("#l-email", "herrerajoicer@gmail.com");
  await s.pagina.fill("#l-pwd", "prueba123");
  await s.pagina.click("#login-btn");
  await s.pagina.waitForSelector(".tabs .tab");
  await llamar(`tasas[todayStr()] = 184.5; setTab("nomina")`); // hoy: 07/10/2026 → 1ra quincena
});
after(async () => nav && nav.cerrar());

test("adelanto de quincena: dice cuánto le corresponde y se registra a cuenta de la 1ra quincena", async () => {
  await llamar(`abrirModal({ tipo: "adelanto-nomina", trabId: "trab1" })`);
  // Docente Uno: 160 + 20 + 10 − 10 de deducción fija = 180 al mes → 90 por quincena
  assert.match(await s.pagina.textContent("#ad-info"), /1ra quincena de Octubre 2026 le corresponden \$ 90,00 netos/);
  await s.pagina.fill("#ad-monto", "30");
  await llamar(`guardarAdelantoNomina()`);
  await s.pagina.waitForSelector(".exito-overlay");
  const [a] = await movs("adelanto");
  assert.equal(a.monto, 30);
  assert.equal(a.nomina.periodo, "2026-10-Q1");
  assert.equal(a.categoria, "Nómina");
  assert.match(
    await ultimaImpresion(),
    /Recibo de adelanto[\s\S]*se descontará en el pago de 1ra quincena de Octubre 2026/
  );
});

test("préstamo: se registra aparte de la nómina, con su cuota por pago", async () => {
  await s.pagina.waitForSelector(".exito-overlay", { state: "detached", timeout: 4000 });
  await llamar(`abrirModal({ tipo: "prestamo-nomina", trabId: "trab1" })`);
  await s.pagina.fill("#pr-monto", "100");
  await s.pagina.fill("#pr-cuota", "25");
  assert.match(await s.pagina.textContent("#pr-info"), /Se descontarán \$ 25,00 en cada pago: 4 pagos/);
  await s.pagina.fill("#pr-motivo", "Gastos médicos");
  await llamar(`guardarPrestamoNomina()`);
  await s.pagina.waitForSelector(".exito-overlay");
  const [p] = await movs("prestamo");
  assert.equal(p.categoria, "Préstamos al personal");
  assert.equal(p.nomina.cuota, 25);
  assert.match(
    await ultimaImpresion(),
    /Comprobante de préstamo[\s\S]*Se descontará <strong>\$ 25,00<\/strong> en cada pago/
  );
});

test("pagar la quincena: trae la mitad del sueldo y descuenta solo el adelanto, la cuota y la deducción fija", async () => {
  await s.pagina.waitForSelector(".exito-overlay", { state: "detached", timeout: 4000 });
  await llamar(`abrirModal({ tipo: "pago-nomina", trabId: "trab1" })`);
  assert.equal(await s.pagina.inputValue("#pn-tipo"), "Q1");
  assert.equal(await s.pagina.inputValue("#pn-monto"), "80");
  assert.equal(await s.pagina.inputValue("#pn-balim"), "10");
  assert.equal(await s.pagina.inputValue("#pn-bprod"), "5");
  assert.equal(await s.pagina.inputValue("#pn-desc"), "1ra quincena de Octubre 2026 — Docente Uno");
  const deds = await s.pagina.textContent("#pn-deds");
  assert.match(deds, /Deducción fija/);
  assert.match(deds, /Adelanto del 07\/10\/2026/);
  assert.match(deds, /Cuota de préstamo del 07\/10\/2026 \(saldo \$ 100,00\)/);
  assert.equal(await s.pagina.textContent("#pn-neto-monto"), "$ 95,00");
  assert.equal(await s.pagina.textContent("#pn-neto-desc"), "- $ 60,00");
  assert.equal(await s.pagina.textContent("#pn-neto-total"), "$ 35,00");
  // se puede no descontar la cuota esta vez
  await s.pagina.uncheck("#pn-ded-on-2");
  assert.equal(await s.pagina.textContent("#pn-neto-total"), "$ 60,00");
  await s.pagina.check("#pn-ded-on-2");
  await llamar(`guardarPagoNomina()`);
  await s.pagina.waitForSelector(".exito-overlay");
  const [p] = await movs("pago");
  assert.equal(p.monto, 35);
  assert.equal(p.nomina.bruto, 95);
  assert.equal(p.nomina.periodo, "2026-10-Q1");
  assert.deepEqual(
    p.nomina.deducciones.map((d) => [d.tipo, d.monto, !!d.ref]),
    [
      ["fija", 5, false],
      ["adelanto", 30, true],
      ["prestamo", 25, true],
    ]
  );
  // ya no queda adelanto por descontar y el préstamo baja a 75
  assert.equal(await llamar(`adelantosPendientes("trab1").length`), 0);
  assert.equal(await llamar(`prestamosDe("trab1")[0].saldo`), 75);
  // el recibo: asignaciones, deducciones y neto, con un número que no cambia al reimprimir
  const recibo = await ultimaImpresion();
  assert.match(
    recibo,
    /➕ Asignaciones[\s\S]*Salario base[\s\S]*➖ Deducciones[\s\S]*Cuota de préstamo[\s\S]*Neto a recibir/
  );
  const num = /NOM-[0-9A-Z]{4,}/.exec(recibo)[0];
  await llamar(`imprimirReciboNomina(null, ${JSON.stringify(p.id)})`);
  assert.equal(/NOM-[0-9A-Z]{4,}/.exec(await ultimaImpresion())[0], num);
});

test("si ese período ya se pagó, avisa antes de pagarlo otra vez", async () => {
  await s.pagina.waitForSelector(".exito-overlay", { state: "detached", timeout: 4000 });
  await llamar(`abrirModal({ tipo: "pago-nomina", trabId: "trab1", periodo: "2026-10-Q1" })`);
  assert.match(await s.pagina.textContent("#pn-aviso"), /Ya se le pagó 1ra quincena de Octubre 2026/);
  await s.pagina.selectOption("#pn-tipo", "Q2");
  assert.equal(await s.pagina.textContent("#pn-aviso"), "");
  assert.match(await s.pagina.textContent("#pn-deds"), /Cuota de préstamo .*saldo \$ 75,00/);
  await llamar(`cerrarModal()`);
});

test("nómina del mes: lo pagado, lo que falta, la 2da quincena por pagar y lo que debe", async () => {
  await llamar(`subTab.nomina = "mes"; renderTabContent()`);
  const fila = await s.pagina.textContent(".nomina-fila:has-text('Docente Uno')");
  assert.match(fila, /Docente Uno/);
  assert.match(fila, /Gana \$ 190,00 al mes · pagado \$ 95,00 · adelantos \$ 30,00/);
  assert.match(fila, /✓ 1ra/);
  assert.match(fila, /2da pendiente/);
  assert.match(fila, /Debe \$ 75,00/);
  assert.match(fila, /\$ 95,00\s*por pagar/);
  assert.match(fila, /Pagar 2da quincena/);
  // en el historial cada movimiento con su tipo
  await llamar(`subTab.nomina = "historial"; renderTabContent()`);
  const hist = await s.pagina.textContent(".list");
  for (const t of ["Pago", "Adelanto", "Préstamo"]) assert.match(hist, new RegExp(t));
});

test("un trabajador con pagos no se borra: se marca como retirado y conserva su historial", async () => {
  await llamar(`eliminarTrabajador("trab1")`);
  assert.match(s.dialogos.join("\n"), /tiene pagos registrados/);
  assert.equal(await llamar(`trabajadores.some((t) => t.id === "trab1")`), true);
  assert.deepEqual(s.errores, []);
});
