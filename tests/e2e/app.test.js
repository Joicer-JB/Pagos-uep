// Pruebas de la app completa en Chromium, con el Firebase falso (sin internet ni datos reales).
// Usa el recorrido de recorrido.js (4 roles, todas las pestañas, cobros, pagos, notas, impresiones…)
// y comprueba lo importante de cada paso.
//
// Uso: npm run test:e2e
const { test, before } = require("node:test");
const assert = require("node:assert/strict");
const { recorrer } = require("./recorrido");
const { revisar } = require("./seguridad");

let fotos, errores;
const paso = (nombre) => {
  const f = fotos.find((x) => x.paso === nombre);
  assert.ok(f, `no se encontró el paso «${nombre}»`);
  return f;
};
const rutas = (f) => f.escrituras.map((e) => `${e.op} ${e.ruta}`);

before(async () => {
  ({ fotos, errores } = await recorrer());
});

test("ningún error de JavaScript en todo el recorrido", () => {
  assert.deepEqual(errores, []);
});

test("cada rol ve sus pestañas", () => {
  const pestanas = (rol) =>
    [...paso(`${rol} › después de entrar`).app.matchAll(/<button class="tab[^"]*" onclick="setTab\('(\w+)'\)"/g)].map(
      (m) => m[1]
    );
  assert.deepEqual(pestanas("docente"), ["notas"]);
  assert.deepEqual(pestanas("administradora"), ["dashboard", "caja", "pagos"]);
  assert.ok(pestanas("director").includes("config"));
  assert.ok(pestanas("director").includes("importar"));
});

test("el docente siempre empieza en Notas (aunque antes se usara otra pestaña en ese equipo)", () => {
  for (const nombre of ["docente › después de entrar", "director › docente entra en el mismo equipo"]) {
    const f = paso(nombre);
    assert.match(f.app, /Consultar Notas/, nombre);
    assert.doesNotMatch(f.app, /Últimos Pagos|Nómina Total|Resumen del mes/i, nombre);
  }
});

test("un usuario sin rol no entra y ve el aviso", () => {
  const f = paso("intruso › después de entrar");
  assert.match(f.app, /Usuario no autorizado o desactivado/);
  assert.doesNotMatch(f.app, /class="tabs"/);
});

test("caja: cobrar guarda el pago, descuenta la deuda anterior y muestra el recibo", () => {
  const f = paso("director › caja cobrado (recibo)");
  // En una sola transacción: número de recibo correlativo, deuda anterior del estudiante y el pago
  assert.deepEqual(rutas(f), ["set-merge config/contadores", "set pagos/id00001", "update estudiantes/est2"]);
  const pago = f.escrituras.find((e) => e.ruta.startsWith("pagos/")).datos;
  assert.equal(pago.factura, "FAC-000001");
  assert.ok(pago.deudaAplicada > 0, "guarda cuánto descontó de la deuda anterior");
  // el estudiante apunta al recibo con que se cobró, y el recibo dice cuánto bajó la deuda (lo exigen las reglas)
  const est = f.escrituras.find((e) => e.ruta === "estudiantes/est2").datos;
  assert.equal(est.ultimoCobro, "id00001");
  assert.equal(pago.deudaCobro, pago.deudaAplicada);
  assert.equal(pago.origen, "caja");
  assert.equal(pago.tasa, 184.5); // la tasa del día que se cargó antes
  assert.equal(pago.totalBs, Math.round(pago.total * 184.5 * 100) / 100);
  assert.match(f.app, /Luis Alberto Gómez/);
  assert.equal(paso("director › recibo impreso").impresiones.length, 1);
  assert.match(paso("director › recibo por WhatsApp").aperturas[0], /^https:\/\/wa\.me\/58424/);
});

test("pagos: el formulario registra un pago con su tasa", () => {
  const f = paso("director › pagos guardado");
  assert.deepEqual(rutas(f), ["set-merge config/contadores", "set pagos/id00002"]);
  const pago = f.escrituras[1].datos;
  assert.equal(pago.factura, "FAC-000002"); // correlativo: sigue al de la caja
  assert.equal(pago.cedula, "V-30444555");
  assert.equal(pago.metodo, "Punto");
});

test("tasa BCV: se guarda en la configuración compartida", () => {
  const f = paso("director › tasa guardada");
  assert.deepEqual(f.escrituras, [
    { op: "set-merge", ruta: "config/tasasBCV", datos: { tasas: { "2026-10-07": 184.5 }, actualizado: "2026-10-07" } },
  ]);
});

test("finanzas: registrar un gasto", () => {
  const f = paso("director › gasto guardado");
  assert.deepEqual(rutas(f), ["set finanzas/id00003"]);
  assert.equal(f.escrituras[0].datos.descripcion, "Compra de pintura");
  assert.equal(f.escrituras[0].datos.tipo, "gasto");
});

test("estudiante nuevo sin datos: muestra el error y no guarda", () => {
  const f = paso("director › nuevo estudiante sin datos (error)");
  assert.deepEqual(f.escrituras, []);
  assert.match(f.app, /class="error-msg"/);
});

test("importar Excel: crea los nuevos y no duplica a los que ya existen", () => {
  const f = paso("director › importación ejecutada");
  // Las fichas de los docentes se escriben un momento después (privacidad.test.js las prueba): no cuentan aquí
  const propias = f.escrituras.filter((e) => !e.ruta.startsWith("estudiantes_docentes/"));
  assert.deepEqual(rutas({ escrituras: propias }), ["set estudiantes/id00004", "set estudiantes/id00005"]);
  assert.deepEqual(
    propias.map((e) => e.datos.nombre),
    ["Pedro Pablo Ruiz", "Lucía Fernanda Mora"]
  );
});

test("año anterior: solo consulta", () => {
  const f = paso("director › año anterior › intento de registrar");
  assert.match(f.dialogos[0], /solo consulta/);
  assert.deepEqual(f.escrituras, []);
});

test("impresiones: constancia, flujo de caja, nómina, cobranza y cierre de caja", () => {
  for (const nombre of [
    "director › impresión imprimirConstancia(",
    "director › flujo de caja impreso #0",
    "director › recibo de nómina impreso",
    "director › cobranza impresa",
    "director › cierre de caja impreso",
  ]) {
    const f = paso(nombre);
    assert.equal(f.impresiones.length, 1, nombre);
    assert.match(f.impresiones[0], /<html/i, nombre);
  }
});

test("administradora: su Inicio es para cobrar (sin gastos, nómina ni balance) y no abre nada más", () => {
  const inicio = paso("administradora › después de entrar").app;
  assert.match(inicio, /Cobrado hoy/);
  assert.doesNotMatch(inicio, /Nómina Total|Resumen del mes|Balance|Gastos/);
  for (const intento of [
    "intento de abrir finanzas",
    "intento de abrir la ficha de un estudiante",
    "intento de registrar un gasto",
  ]) {
    const f = paso("administradora › " + intento);
    assert.doesNotMatch(f.app, /modal-bg|Libro de ingresos|Nuevo Gasto|Nuevo Ingreso/, intento);
    assert.equal(f.escrituras.length, 0, intento);
  }
  assert.match(paso("administradora › intento de abrir finanzas").app, /Cierre de caja/); // se queda en Caja
});

test("notas: los docentes ven las materias configuradas por el director", () => {
  for (const rol of ["docente"]) {
    const f = paso(`${rol} › notas de est2`); // 1er Año: Matemáticas, Lengua y Literatura, Inglés
    assert.match(f.app, />Inglés</);
    assert.doesNotMatch(f.app, />Ciencias Naturales</, `${rol}: no debe usar la lista por defecto`);
  }
});

test("notas: el docente guarda", () => {
  const f = paso("docente › docente guardó notas");
  assert.equal(f.escrituras.length, 1);
  assert.match(f.escrituras[0].ruta, /^notas\//);
  assert.match(f.dialogos[0], /Notas guardadas/);
});

test("seguridad: ningún dato malicioso se ejecuta ni sale sin escapar", async () => {
  assert.deepEqual(await revisar(), []);
});
