// Pruebas de las reglas de Firestore (firestore.rules) contra el emulador oficial de Firebase.
// Comprueban qué puede leer, crear, editar y borrar cada rol.
//
// Uso: npm run test:reglas   (arranca el emulador, corre estas pruebas y lo apaga)
const { test, before, after, beforeEach } = require("node:test");
const fs = require("fs");
const path = require("path");
const { initializeTestEnvironment, assertSucceeds, assertFails } = require("@firebase/rules-unit-testing");
const { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs } = require("firebase/firestore");

let entorno;
const CUENTAS = {
  director: { uid: "uid-director", email: "herrerajoicer@gmail.com" },
  administradora: { uid: "uid-admin", email: "josefajsanquez@gmail.com" },
  docente: { uid: "uid-docente", email: "docente@example.com" },
  docenteFijo: { uid: "uid-notas", email: "notasjjs@gmail.com" },
  docenteInactivo: { uid: "uid-inactivo", email: "inactivo@example.com" },
  desconocido: { uid: "uid-intruso", email: "intruso@example.com" },
};
// Base de datos vista por cada rol (o sin sesión)
const como = (rol) =>
  rol === "anonimo"
    ? entorno.unauthenticatedContext().firestore()
    : entorno.authenticatedContext(CUENTAS[rol].uid, { email: CUENTAS[rol].email }).firestore();

before(async () => {
  entorno = await initializeTestEnvironment({
    projectId: "demo-pagos-uep",
    firestore: { rules: fs.readFileSync(path.join(__dirname, "../../firestore.rules"), "utf8") },
  });
});
after(async () => entorno && entorno.cleanup());

beforeEach(async () => {
  await entorno.clearFirestore();
  await entorno.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "usuarios/uid-docente"), { rol: "docente", activo: true, nombre: "Profe" });
    await setDoc(doc(db, "usuarios/uid-inactivo"), { rol: "docente", activo: false, nombre: "Ex profe" });
    await setDoc(doc(db, "estudiantes/est1"), { nombre: "Ana", grado: "1er Grado" });
    await setDoc(doc(db, "pagos/pag1"), { nombre: "Ana", total: 45 });
    await setDoc(doc(db, "finanzas/fin1"), { tipo: "gasto", monto: 10 });
    await setDoc(doc(db, "trabajadores/trab1"), { nombre: "Docente Uno", salario: 160 });
    await setDoc(doc(db, "notas/est1_Lapso 1"), { estId: "est1", lapso: "Lapso 1" });
    await setDoc(doc(db, "notas_historial/x"), { clave: "est1_Lapso 1" });
    await setDoc(doc(db, "config/institucion"), { nombre: "U.E.P." });
    await setDoc(doc(db, "config/tasasBCV"), { tasas: {} });
    await setDoc(doc(db, "otra_coleccion/x"), { a: 1 });
  });
});

test("sin sesión no se puede leer ni escribir nada", async () => {
  const db = como("anonimo");
  for (const ruta of ["estudiantes/est1", "pagos/pag1", "config/institucion", "usuarios/uid-docente"]) {
    await assertFails(getDoc(doc(db, ruta)));
  }
  await assertFails(setDoc(doc(db, "pagos/nuevo"), { total: 1 }));
});

test("una cuenta sin rol (registrada por su cuenta) no ve nada", async () => {
  const db = como("desconocido");
  await assertFails(getDoc(doc(db, "estudiantes/est1")));
  await assertFails(getDoc(doc(db, "pagos/pag1")));
  await assertFails(getDoc(doc(db, "config/institucion")));
  await assertFails(setDoc(doc(db, "usuarios/uid-intruso"), { rol: "docente", activo: true }));
});

test("director: acceso total, incluido borrar", async () => {
  const db = como("director");
  await assertSucceeds(getDocs(collection(db, "pagos")));
  await assertSucceeds(setDoc(doc(db, "pagos/nuevo"), { total: 10 }));
  await assertSucceeds(deleteDoc(doc(db, "pagos/pag1")));
  await assertSucceeds(deleteDoc(doc(db, "estudiantes/est1")));
  await assertSucceeds(deleteDoc(doc(db, "finanzas/fin1")));
  await assertSucceeds(deleteDoc(doc(db, "trabajadores/trab1")));
  await assertSucceeds(deleteDoc(doc(db, "notas/est1_Lapso 1")));
  await assertSucceeds(setDoc(doc(db, "config/materias"), { "1er Año": ["Matemáticas"] }));
  await assertSucceeds(getDocs(collection(db, "usuarios")));
  await assertSucceeds(setDoc(doc(db, "usuarios/uid-nuevo"), { rol: "docente", activo: true }));
  await assertSucceeds(getDoc(doc(db, "notas_historial/x")));
});

test("nadie puede modificar un pago ya registrado (ni el director)", async () => {
  await assertFails(updateDoc(doc(como("director"), "pagos/pag1"), { total: 1 }));
  await assertFails(updateDoc(doc(como("administradora"), "pagos/pag1"), { total: 1 }));
  await assertFails(setDoc(doc(como("administradora"), "pagos/pag1"), { total: 1 }));
});

test("administradora: registra y edita, pero no borra", async () => {
  const db = como("administradora");
  await assertSucceeds(getDocs(collection(db, "pagos")));
  await assertSucceeds(setDoc(doc(db, "pagos/nuevo"), { total: 10 }));
  await assertSucceeds(setDoc(doc(db, "estudiantes/est2"), { nombre: "Luis" }));
  await assertSucceeds(updateDoc(doc(db, "estudiantes/est1"), { moraMonto: 0 }));
  await assertSucceeds(setDoc(doc(db, "finanzas/nuevo"), { monto: 5 }));
  await assertSucceeds(updateDoc(doc(db, "trabajadores/trab1"), { salario: 170 }));
  await assertFails(deleteDoc(doc(db, "pagos/pag1")));
  await assertFails(deleteDoc(doc(db, "estudiantes/est1")));
  await assertFails(deleteDoc(doc(db, "finanzas/fin1")));
  await assertFails(deleteDoc(doc(db, "trabajadores/trab1")));
});

test("administradora: carga la tasa BCV pero no el resto de la configuración", async () => {
  const db = como("administradora");
  await assertSucceeds(setDoc(doc(db, "config/tasasBCV"), { tasas: { "2026-10-07": 184.5 } }, { merge: true }));
  await assertSucceeds(getDoc(doc(db, "config/institucion")));
  await assertFails(setDoc(doc(db, "config/institucion"), { nombre: "Otro" }));
  await assertFails(setDoc(doc(db, "config/cobranza"), { cuotas: 12 }));
  await assertFails(getDocs(collection(db, "usuarios")));
});

test("docente: lee estudiantes y configuración, carga notas, y nada más", async () => {
  for (const rol of ["docente", "docenteFijo"]) {
    const db = como(rol);
    await assertSucceeds(getDoc(doc(db, "estudiantes/est1")));
    await assertSucceeds(getDoc(doc(db, "config/materias")));
    await assertSucceeds(getDocs(collection(db, "notas")));
    await assertSucceeds(
      setDoc(doc(db, "notas/est1_Lapso 2"), { estId: "est1", lapso: "Lapso 2", Matemáticas_1: "18" })
    );
    await assertSucceeds(updateDoc(doc(db, "notas/est1_Lapso 1"), { Matemáticas_1: "15" }));
    await assertFails(deleteDoc(doc(db, "notas/est1_Lapso 1")));
    await assertFails(getDoc(doc(db, "pagos/pag1")));
    await assertFails(getDoc(doc(db, "finanzas/fin1")));
    await assertFails(getDoc(doc(db, "trabajadores/trab1")));
    await assertFails(updateDoc(doc(db, "estudiantes/est1"), { nombre: "Otro" }));
    await assertFails(getDoc(doc(db, "notas_historial/x")));
  }
});

test("docente: ve su perfil pero no puede cambiarse el rol", async () => {
  const db = como("docente");
  await assertSucceeds(getDoc(doc(db, "usuarios/uid-docente")));
  await assertFails(getDoc(doc(db, "usuarios/uid-inactivo")));
  await assertFails(updateDoc(doc(db, "usuarios/uid-docente"), { rol: "director" }));
  await assertFails(setDoc(doc(db, "config/institucion"), { nombre: "Otro" }));
});

test("docente desactivado: pierde el acceso", async () => {
  const db = como("docenteInactivo");
  await assertFails(getDoc(doc(db, "estudiantes/est1")));
  await assertFails(setDoc(doc(db, "notas/est1_Lapso 2"), { estId: "est1" }));
});

test("colecciones no previstas: cerradas para todos", async () => {
  await assertFails(getDoc(doc(como("director"), "otra_coleccion/x")));
  await assertFails(setDoc(doc(como("director"), "otra_coleccion/y"), { a: 1 }));
});
