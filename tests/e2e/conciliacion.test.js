// 💰 Finanzas → 🏦 Conciliación: se sube el estado de cuenta del banco (Excel) y se compara con los cobros por
// transferencia: conciliados, lo que entró y nadie registró (se registra desde ahí), lo registrado que no está en el
// banco y las referencias repetidas.
//
// Uso: node --test tests/e2e/conciliacion.test.js
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const XLSX = require("xlsx");
const { abrirNavegador } = require("./entorno");

let nav, s;
const llamar = (codigo) => s.pagina.evaluate(codigo);
const texto = (sel) => s.pagina.textContent(sel);

// Como lo exporta el banco: unas filas de encabezado, luego los títulos y los movimientos (los cargos no cuentan)
function estadoDeCuenta() {
  const filas = [
    ["BANCO EJEMPLO, C.A."],
    ["Estado de cuenta corriente 0134-0000-00-0000000000"],
    [],
    ["Fecha", "Nro. Referencia", "Concepto", "Cargo", "Abono", "Saldo"],
    ["02/10/2026", "000000123456", "PAGO MOVIL RECIBIDO 04141234567", "", "8.156,25", "8.156,25"],
    ["03/10/2026", "445566", "TRANSFERENCIA DE TERCEROS", "", "3.690,00", "11.846,25"],
    ["05/10/2026", "990011", "PAGO A PROVEEDOR", "1.000,00", "", "10.846,25"],
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(filas), "Movimientos");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}

before(async () => {
  nav = await abrirNavegador();
  s = await nav.nuevaPagina();
  await s.pagina.goto(nav.base);
  await s.pagina.waitForSelector("#l-email");
  await s.pagina.fill("#l-email", "herrerajoicer@gmail.com");
  await s.pagina.fill("#l-pwd", "prueba123");
  await s.pagina.click("#login-btn");
  await s.pagina.waitForSelector(".tabs .tab");
  // un cobro por transferencia que no llegó al banco, y la misma referencia en otro recibo
  await llamar(`pagos.push(
    { id: "px1", factura: "FAC-0000090", nombre: "Luis Alberto Gómez", fecha: "2026-10-03", concepto: "Mensualidad", metodo: "Transferencia Bs", referencia: "777777", total: 27.4, tasa: 182.1, totalBs: 5000 },
    { id: "px2", factura: "FAC-0000091", nombre: "Valentina Rojas", fecha: "2026-10-03", concepto: "Mensualidad", metodo: "Transferencia Bs", referencia: "00777777", total: 27.4, tasa: 182.1, totalBs: 4990 }
  ); setTab("finanzas"); subTab.finanzas = "conciliacion"; renderTabContent()`);
});
after(async () => nav && nav.cerrar());

test("antes de subir nada ya avisa las referencias repetidas en los recibos", async () => {
  const rep = await texto(".conc-repetidas");
  assert.match(rep, /Ref\. 777777/);
  assert.match(rep, /FAC-0000090 · Luis Alberto Gómez[\s\S]*FAC-0000091 · Valentina Rojas/);
});

test("al subir el estado de cuenta detecta las columnas y compara con los cobros", async () => {
  await s.pagina.setInputFiles("#conc-archivo", {
    name: "estado_cuenta.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: estadoDeCuenta(),
  });
  await s.pagina.waitForSelector(".conc-resumen");
  assert.equal(await s.pagina.inputValue("#conc-fila"), "3");
  assert.equal(await s.pagina.inputValue("#conc-col-referencia"), "1");
  assert.equal(await s.pagina.inputValue("#conc-col-credito"), "4");
  const resumen = await texto(".conc-resumen");
  assert.match(resumen, /2\s*Abonos del 02\/10\/2026 al 03\/10\/2026 · Bs\. 11\.846,25/);
  assert.match(await texto(".conc-ok"), /FAC-0000002 · Ana María Pérez/);
  assert.match(await texto(".conc-sin-registrar"), /03\/10\/2026 · ref 445566[\s\S]*Bs\. 3\.690,00/);
  const noBanco = await texto(".conc-no-banco");
  assert.match(noBanco, /FAC-0000090 · Luis Alberto Gómez/);
  assert.match(noBanco, /FAC-0000091 · Valentina Rojas/);
  assert.equal(await s.pagina.$(".conc-monto-distinto"), null);
  await s.pagina.click("text=🖨️ Imprimir");
  assert.match(await llamar(`window.__IMPRESIONES__.at(-1).html`), /Entró al banco y no está registrado[\s\S]*445566/);
});

test("lo que entró y nadie registró se registra desde ahí, con la fecha, la referencia y el monto en $", async () => {
  await s.pagina.click(".conc-sin-registrar >> text=➕ Registrar");
  await s.pagina.waitForSelector("#p-ref");
  assert.equal(await llamar(`tabActual + "/" + subTab.pagos`), "pagos/nuevo");
  assert.equal(await s.pagina.inputValue("#p-fecha"), "2026-10-03");
  assert.equal(await s.pagina.inputValue("#p-ref"), "445566");
  assert.equal(await s.pagina.inputValue("#p-total"), "20,36"); // 3.690 / 181,25 (la tasa del 02/10)
  assert.match(await s.pagina.inputValue("#p-desc"), /Recibido en el banco el 03\/10\/2026: Bs\. 3\.690,00/);
  assert.equal(await llamar(`_metodoPago`), "Transferencia Bs");
  // al salir de la pestaña ya no queda lleno
  await llamar(`setTab("dashboard"); setTab("pagos"); subTab.pagos = "nuevo"; renderTabContent()`);
  assert.equal(await s.pagina.inputValue("#p-desc"), "");
  assert.deepEqual(s.errores, []);
});

test("otros formatos: CSV con punto y coma (guardado por Windows) y un «.xls» que en realidad es una página HTML", async () => {
  await llamar(`setTab("finanzas"); subTab.finanzas = "conciliacion"; renderTabContent()`);
  const csv =
    "Fecha;Referencia;Descripción;Débito;Crédito\r\n02/10/2026;000000123456;PAGO MÓVIL RECIBIDO;;8.156,25\r\n03/10/2026;445566;TRANSFERENCIA;;3.690,00\r\n";
  await s.pagina.setInputFiles("#conc-archivo", {
    name: "movimientos.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv, "latin1"),
  });
  await s.pagina.waitForSelector(".conc-resumen");
  assert.match(await texto(".conc-resumen"), /2\s*Abonos del 02\/10\/2026 al 03\/10\/2026/);
  assert.match(await texto(".conc-sin-registrar"), /PAGO MÓVIL|TRANSFERENCIA/);
  const html = `<html><body><table><tr><td>Fecha</td><td>Nro. Referencia</td><td>Concepto</td><td>Tipo</td><td>Monto</td></tr>
    <tr><td>02-10-2026</td><td>000000123456</td><td>PAGO MOVIL</td><td>C</td><td>8.156,25</td></tr>
    <tr><td>02-10-2026</td><td>1</td><td>COMISION</td><td>D</td><td>12,00</td></tr></table></body></html>`;
  await s.pagina.setInputFiles("#conc-archivo", {
    name: "estado.xls",
    mimeType: "application/vnd.ms-excel",
    buffer: Buffer.from(html),
  });
  await s.pagina.waitForFunction(
    () => /estado\.xls/.test(document.body.textContent) && document.querySelector(".conc-ok")
  );
  assert.match(await texto(".conc-resumen"), /1\s*Abonos del 02\/10\/2026 al 02\/10\/2026/);
  assert.match(await texto(".conc-ok"), /FAC-0000002/);
});

test("un banco con títulos que la app no conoce: se eligen las columnas una vez y la próxima vez las recuerda", async () => {
  const raro = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        ["Col1", "Col2", "Col3", "Col4"],
        ["02/10/2026", "000000123456", "PAGO", 8156.25],
      ]),
      "Hoja1"
    );
    return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  };
  await s.pagina.setInputFiles("#conc-archivo", {
    name: "raro.xlsx",
    mimeType: "application/octet-stream",
    buffer: raro(),
  });
  await s.pagina.waitForFunction(() => /raro\.xlsx/.test(document.body.textContent));
  assert.match(await texto("#tab-content"), /Elige qué columna es la fecha/);
  await s.pagina.selectOption("#conc-col-fecha", "0");
  await s.pagina.selectOption("#conc-col-referencia", "1");
  await s.pagina.selectOption("#conc-col-credito", "3");
  await s.pagina.waitForSelector(".conc-ok");
  // otro archivo del mismo banco
  await s.pagina.setInputFiles("#conc-archivo", {
    name: "raro2.xlsx",
    mimeType: "application/octet-stream",
    buffer: raro(),
  });
  await s.pagina.waitForFunction(
    () => /raro2\.xlsx/.test(document.body.textContent) && document.querySelector(".conc-ok")
  );
  assert.match(await texto(".conc-columnas summary"), /formato recordado de este banco/);
  assert.deepEqual(s.errores, []);
});
