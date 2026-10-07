// Detección y limpieza de estudiantes duplicados (js/vistas/duplicados.js)
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { cargar } = require("./cargar");

const app = cargar("js/utils/texto.js", "js/utils/grados.js", "js/vistas/duplicados.js");
const f = (codigo) => app.evaluar(codigo);
// Los objetos vienen de otro contexto de Node (vm): se pasan por JSON para compararlos con deepEqual
const igual = (real, esperado) => assert.deepEqual(JSON.parse(JSON.stringify(real)), esperado);

// Estudiante de prueba; los pagos de cada uno se indican en un mapa id → lista de pagos
const est = (id, nombre, extra = {}) => ({ id, nombre, grado: "1er Grado", ...extra });
const sinPagos = () => [];
const conPagos = (mapa) => (e) => mapa[e.id] || [];
const ids = (g) => g.miembros.map((e) => e.id).sort();

test("claveNombreSinOrden: no importa el orden, la coma, las tildes, las mayúsculas ni las partículas", () => {
  const k = (s) => f(`claveNombreSinOrden(${JSON.stringify(s)})`);
  assert.equal(k("José Pérez"), k("PEREZ, JOSE"));
  assert.equal(k("Pérez López, José Luis"), k("jose luis perez lopez"));
  assert.equal(k("María de los Ángeles Rojas"), k("Rojas Maria Angeles"));
  assert.notEqual(k("José Pérez"), k("José Pérez Ruiz"));
  assert.equal(k(""), "");
  assert.equal(k(null), "");
});

test("agruparDuplicados: encuentra nombre/apellido invertidos, con coma, con tilde y en mayúsculas", () => {
  const lista = [
    est("a1", "Ana María Pérez Gómez"),
    est("a2", "Pérez Gómez, Ana María"),
    est("a3", "ANA MARIA PEREZ GOMEZ"),
    est("b1", "Luis Rojas"),
    est("c1", "Pedro Silva"),
    est("c2", "Silva Pedro"),
  ];
  const g = app.evaluar("agruparDuplicados")(lista, sinPagos);
  assert.equal(g.length, 2);
  igual(g.map(ids), [
    ["a1", "a2", "a3"],
    ["c1", "c2"],
  ]);
  assert.ok(g.every((x) => x.motivo === "nombre"));
});

test("agruparDuplicados: sin repetidos devuelve lista vacía (y no falla con datos raros)", () => {
  const agr = app.evaluar("agruparDuplicados");
  igual(agr([], sinPagos), []);
  igual(agr([est("a", "Ana Pérez"), est("b", "Luis Rojas")], sinPagos), []);
  igual(agr([est("a", ""), est("b", null), est("c", undefined)], sinPagos), []);
});

test("agruparDuplicados: dos niños con el mismo nombre y cédulas distintas NO se mezclan", () => {
  const lista = [est("a", "José Pérez", { cedula: "V-30111222" }), est("b", "Pérez José", { cedula: "V-30999888" })];
  igual(app.evaluar("agruparDuplicados")(lista, sinPagos), []);
});

test("agruparDuplicados: una copia sin cédula se une a la que sí la tiene", () => {
  const lista = [est("a", "José Pérez", { cedula: "V-30111222" }), est("b", "Pérez José", { cedula: "" })];
  const g = app.evaluar("agruparDuplicados")(lista, sinPagos);
  assert.equal(g.length, 1);
  igual(ids(g[0]), ["a", "b"]);
});

test("agruparDuplicados: misma cédula con nombre distinto se agrupa, pero como «cedula» (a revisar)", () => {
  const lista = [est("a", "Ana Pérez", { cedula: "V-30111222" }), est("b", "Anna Peres", { cedula: "v 30111222" })];
  const g = app.evaluar("agruparDuplicados")(lista, sinPagos);
  assert.equal(g.length, 1);
  assert.equal(g[0].motivo, "cedula");
  const plan = app.evaluar("planDeGrupo")(g[0], g[0].conservar, sinPagos);
  assert.equal(plan.seguro, false); // nunca se limpia en bloque
  assert.equal(plan.borrar.length, 1);
});

test("agruparDuplicados: cédulas cortas o de relleno (0, N/A) no cuentan como misma cédula", () => {
  const lista = [est("a", "Ana Pérez", { cedula: "0" }), est("b", "Luis Rojas", { cedula: "0" })];
  igual(app.evaluar("agruparDuplicados")(lista, sinPagos), []);
});

test("se conserva la ficha con más pagos; a igualdad, la más completa", () => {
  const lista = [
    est("a", "Ana Pérez"),
    est("b", "Pérez Ana", { cedula: "V-30111222", acudiente: "Carmen", telefono: "0414" }),
    est("c", "Ana Perez", { cedula: "V-30111222" }),
  ];
  const agr = app.evaluar("agruparDuplicados");
  assert.equal(agr(lista, sinPagos)[0].conservar, "b"); // la más completa
  assert.equal(agr(lista, conPagos({ c: [{ id: 1 }, { id: 2 }] }))[0].conservar, "c"); // la que tiene pagos
});

test("planDeGrupo: copia los datos que faltan a la ficha que se conserva", () => {
  const lista = [
    est("a", "Ana Pérez", { cedula: "V-30111222", mensualidad: 45 }),
    est("b", "Pérez Ana", { acudiente: "Carmen", telefonoAcudiente: "04141234567", fechaNac: "2019-03-10" }),
  ];
  const [g] = app.evaluar("agruparDuplicados")(lista, sinPagos);
  const plan = app.evaluar("planDeGrupo")(g, "a", sinPagos);
  assert.equal(plan.conservar.id, "a");
  igual(
    plan.borrar.map((e) => e.id),
    ["b"]
  );
  igual(plan.campos, {
    acudiente: "Carmen",
    telefonoAcudiente: "04141234567",
    fechaNac: "2019-03-10",
  });
  assert.equal(plan.seguro, true);
});

test("planDeGrupo: nunca sobrescribe datos que la ficha conservada ya tiene", () => {
  const lista = [est("a", "Ana Pérez", { acudiente: "Carmen" }), est("b", "Pérez Ana", { acudiente: "Otra persona" })];
  const [g] = app.evaluar("agruparDuplicados")(lista, sinPagos);
  igual(app.evaluar("planDeGrupo")(g, "a", sinPagos).campos, {});
});

test("planDeGrupo: una deuda anotada a mano en la copia pasa a la ficha que se conserva", () => {
  const lista = [
    est("a", "Ana Pérez", { estado: "alsaldo", moraMonto: 0 }),
    est("b", "Pérez Ana", { estado: "mora", moraMonto: 30, moraConcepto: "Deuda 2025" }),
  ];
  const [g] = app.evaluar("agruparDuplicados")(lista, sinPagos);
  const plan = app.evaluar("planDeGrupo")(g, "a", sinPagos);
  assert.equal(plan.campos.estado, "mora");
  assert.equal(plan.campos.moraMonto, 30);
  assert.equal(plan.campos.moraConcepto, "Deuda 2025");
  // pero si la ficha que se conserva ya tiene su propia deuda, no se toca
  const lista2 = [
    est("a", "Ana Pérez", { estado: "mora", moraMonto: 10 }),
    est("b", "Pérez Ana", { estado: "mora", moraMonto: 30 }),
  ];
  const [g2] = app.evaluar("agruparDuplicados")(lista2, sinPagos);
  igual(app.evaluar("planDeGrupo")(g2, "a", sinPagos).campos, {});
});

test("planDeGrupo: una copia con pagos que la otra ficha no vería queda bloqueada (no se borra)", () => {
  const pagoDeB = { id: "p1" };
  const lista = [est("a", "Ana Pérez"), est("b", "Pérez Ana")];
  const pagosDe = conPagos({ b: [pagoDeB] });
  const [g] = app.evaluar("agruparDuplicados")(lista, pagosDe);
  assert.equal(g.conservar, "b"); // se sugiere conservar la que tiene los pagos
  const plan = app.evaluar("planDeGrupo");
  const bueno = plan(g, "b", pagosDe);
  igual(
    bueno.borrar.map((e) => e.id),
    ["a"]
  );
  assert.equal(bueno.seguro, true);
  const malo = plan(g, "a", pagosDe); // si el usuario elige la que no tiene pagos
  igual(malo.borrar, []);
  assert.equal(malo.bloqueados.length, 1);
  assert.equal(malo.bloqueados[0].pagos, 1);
  assert.equal(malo.seguro, false);
});

test("planDeGrupo: pagos compartidos (mismo pago visible desde las dos fichas) no bloquean", () => {
  const compartido = { id: "p1" };
  const lista = [est("a", "Ana Pérez", { cedula: "V-30111222" }), est("b", "Pérez Ana", { cedula: "V-30111222" })];
  const pagosDe = conPagos({ a: [compartido], b: [compartido] });
  const [g] = app.evaluar("agruparDuplicados")(lista, pagosDe);
  const p = app.evaluar("planDeGrupo")(g, "a", pagosDe);
  assert.equal(p.borrar.length, 1);
  assert.equal(p.bloqueados.length, 0);
});

test("planDeGrupo: distinto grado o distinta fecha de nacimiento → no es «seguro» (hay que revisar)", () => {
  const plan = app.evaluar("planDeGrupo");
  const agr = app.evaluar("agruparDuplicados");
  const [g1] = agr([est("a", "Ana Pérez"), est("b", "Pérez Ana", { grado: "5to Grado" })], sinPagos);
  assert.equal(plan(g1, g1.conservar, sinPagos).seguro, false);
  const [g2] = agr(
    [est("a", "Ana Pérez", { fechaNac: "2019-03-10" }), est("b", "Pérez Ana", { fechaNac: "2016-01-01" })],
    sinPagos
  );
  assert.equal(plan(g2, g2.conservar, sinPagos).seguro, false);
  // «Preescolar I» y «Nivel I» son el mismo grado
  const [g3] = agr(
    [est("a", "Ana Pérez", { grado: "Nivel I" }), est("b", "Pérez Ana", { grado: "Preescolar I" })],
    sinPagos
  );
  assert.equal(plan(g3, g3.conservar, sinPagos).seguro, true);
});

test("el orden de la lista no cambia el resultado (determinista)", () => {
  const lista = [est("a", "Ana Pérez"), est("b", "Pérez Ana"), est("c", "Luis Rojas"), est("d", "Rojas Luis")];
  const agr = app.evaluar("agruparDuplicados");
  const normal = agr(lista, sinPagos).map(ids);
  const invertida = agr([...lista].reverse(), sinPagos).map(ids);
  igual(normal, JSON.parse(JSON.stringify(invertida)));
});

test("rendimiento: 3000 estudiantes con 1000 repetidos se agrupan en una fracción de segundo", () => {
  const lista = [];
  for (let i = 0; i < 2000; i++) lista.push(est("e" + i, "Nombre" + i + " Apellido" + i));
  for (let i = 0; i < 1000; i++) lista.push(est("d" + i, "Apellido" + i + ", Nombre" + i));
  const t0 = Date.now();
  const g = app.evaluar("agruparDuplicados")(lista, sinPagos);
  assert.equal(g.length, 1000);
  assert.ok(Date.now() - t0 < 2000);
});
