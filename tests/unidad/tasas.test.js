// Lectura de tasas BCV desde Excel (el archivo oficial del BCV o una tabla sencilla de fecha y tasa).
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { cargar } = require("./cargar");

const app = cargar("js/config.js", "js/utils/formato.js", "js/servicios/tasa-bcv.js");
const tasasDeHojas = (hojas) => JSON.parse(JSON.stringify(app.tasasDeHojas(hojas)));

// Una hoja como las del Excel del BCV («Tipo de cambio de referencia»): una por día
const hojaBCV = (fechaValor, compra, venta, { fechaAparte = false } = {}) => ({
  nombre: fechaValor.replace(/\//g, ""),
  filas: [
    ["", "BANCO CENTRAL DE VENEZUELA", "", "", "", ""],
    ["", "Tipo de Cambio de Referencia", "", "", "", ""],
    ["", "Fecha Operación: 29/09/2025", "", "", "", ""],
    fechaAparte ? ["", "Fecha Valor:", fechaValor, "", "", ""] : ["", `Fecha Valor: ${fechaValor}`, "", "", "", ""],
    ["Moneda", "País", "Compra (Bs./M.E.)", "Venta (Bs./M.E.)", "Compra (M.E./US$)", "Venta (M.E./US$)"],
    ["EUR", "Unión Europea", 210.11, 210.55, 1.17, 1.17],
    ["USD", "E.U.A.", compra, venta, 1, 1],
    ["CNY", "China", 25.12, 25.2, 7.1, 7.1],
  ],
});

test("Excel del BCV: una tasa por hoja, con la fecha valor y la venta del dólar", () => {
  const r = tasasDeHojas([hojaBCV("30/09/2025", 178.9, 179.25), hojaBCV("01/10/2025", 180.1, 180.5)]);
  assert.deepEqual(r, [
    { fecha: "2025-09-30", valor: 179.25 },
    { fecha: "2025-10-01", valor: 180.5 },
  ]);
});

test("Excel del BCV: la fecha valor puede venir en la celda de al lado, y los números como texto con coma", () => {
  const r = tasasDeHojas([hojaBCV("02/10/2025", "181,10", "181,2500", { fechaAparte: true })]);
  assert.deepEqual(r, [{ fecha: "2025-10-02", valor: 181.25 }]);
});

test("tabla sencilla: fecha y tasa (fecha como texto o como fecha de Excel)", () => {
  const r = tasasDeHojas([
    {
      nombre: "Hoja1",
      filas: [
        ["Fecha", "Tasa"],
        ["03/10/2025", "182,10"],
        [new Date(2025, 9, 6), 183.4], // 06/10/2025 en la zona horaria del equipo
        ["2025-10-07", 184.5],
        ["Total", ""],
        ["", ""],
      ],
    },
  ]);
  assert.deepEqual(r, [
    { fecha: "2025-10-03", valor: 182.1 },
    { fecha: "2025-10-06", valor: 183.4 },
    { fecha: "2025-10-07", valor: 184.5 },
  ]);
});

test("se ignoran fechas imposibles, futuras o sin tasa", () => {
  const r = tasasDeHojas([
    {
      nombre: "Hoja1",
      filas: [
        ["31/02/2025", 100], // no existe
        ["01/01/2099", 100], // futura
        ["10/10/2025", "sin dato"],
        ["11/10/2025", 0],
      ],
    },
  ]);
  assert.deepEqual(r, []);
});

test("una hoja sin nada que parezca una tasa no da resultados", () => {
  assert.deepEqual(tasasDeHojas([{ nombre: "Notas", filas: [["Hola"], ["", 5]] }]), []);
});

test("compararTasas separa nuevas, iguales y distintas respecto a las guardadas", () => {
  app.evaluar(`tasas = { "2025-10-01": 180.5, "2025-10-02": 181 }`);
  const c = JSON.parse(
    JSON.stringify(
      app.compararTasas([
        { fecha: "2025-10-01", valor: 180.5 },
        { fecha: "2025-10-02", valor: 181.25 },
        { fecha: "2025-10-03", valor: 182.1 },
      ])
    )
  );
  assert.deepEqual(c.iguales, [{ fecha: "2025-10-01", valor: 180.5 }]);
  assert.deepEqual(c.distintas, [{ fecha: "2025-10-02", valor: 181.25, guardada: 181 }]);
  assert.deepEqual(c.nuevas, [{ fecha: "2025-10-03", valor: 182.1 }]);
});
