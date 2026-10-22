// Pruebas de las reglas de Firestore (firestore.rules) contra el emulador oficial de Firebase.
// Comprueban qué puede leer, crear, editar y borrar cada rol.
//
// Uso: npm run test:reglas   (arranca el emulador, corre estas pruebas y lo apaga)
const { test, before, after, beforeEach } = require("node:test");
const fs = require("fs");
const path = require("path");
const { initializeTestEnvironment, assertSucceeds, assertFails } = require("@firebase/rules-unit-testing");
const {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
  runTransaction,
  writeBatch,
} = require("firebase/firestore");

let entorno;
const CUENTAS = {
  director: { uid: "uid-director", email: "herrerajoicer@gmail.com" },
  administradora: { uid: "uid-admin", email: "josefajsanquez@gmail.com" },
  docente: { uid: "uid-docente", email: "docente@example.com" },
  docenteFijo: { uid: "uid-notas", email: "notasjjs@gmail.com" },
  docenteInactivo: { uid: "uid-inactivo", email: "inactivo@example.com" },
  desconocido: { uid: "uid-intruso", email: "intruso@example.com" },
};
const firma = (rol) => ({ registradoPor: CUENTAS[rol].email });
// Borra un documento como lo hace la app: en el mismo lote que su anotación en la bitácora
function borrarConBitacora(db, rol, col, id, { anotar = true, por = CUENTAS[rol].email } = {}) {
  const b = writeBatch(db);
  if (anotar)
    b.set(doc(db, "bitacora/" + col + "_" + id), { accion: "borrar", coleccion: col, docId: id, por, resumen: "x" });
  b.delete(doc(db, col + "/" + id));
  return b.commit();
}
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
    await setDoc(doc(db, "estudiantes/est1"), { nombre: "Ana", grado: "1er Grado", telefonoAcudiente: "0414" });
    await setDoc(doc(db, "estudiantes_docentes/est1"), { nombre: "Ana", grado: "1er Grado" });
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
  await assertSucceeds(setDoc(doc(db, "pagos/nuevo"), { total: 10, ...firma("director") }));
  await assertSucceeds(borrarConBitacora(db, "director", "pagos", "pag1"));
  await assertSucceeds(borrarConBitacora(db, "director", "estudiantes", "est1"));
  await assertSucceeds(borrarConBitacora(db, "director", "finanzas", "fin1"));
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
  await assertSucceeds(setDoc(doc(db, "pagos/nuevo"), { total: 10, ...firma("administradora") }));
  await assertSucceeds(setDoc(doc(db, "estudiantes/est2"), { nombre: "Luis" }));
  await assertSucceeds(updateDoc(doc(db, "estudiantes/est1"), { moraMonto: 0 }));
  await assertSucceeds(setDoc(doc(db, "finanzas/nuevo"), { monto: 5, ...firma("administradora") }));
  await assertSucceeds(updateDoc(doc(db, "trabajadores/trab1"), { salario: 170 }));
  await assertFails(borrarConBitacora(db, "administradora", "pagos", "pag1"));
  await assertFails(borrarConBitacora(db, "administradora", "estudiantes", "est1"));
  await assertFails(borrarConBitacora(db, "administradora", "finanzas", "fin1"));
  await assertFails(deleteDoc(doc(db, "trabajadores/trab1")));
});

test("documentos del personal: director y administradora los adjuntan, ven y quitan; nadie los modifica", async () => {
  const trozo = (parte = 0, extra = {}) => ({
    trabajadorId: "trab1",
    adjuntoId: "adj1",
    parte,
    partes: 1,
    tipo: "image/jpeg",
    datos: "QUJD",
    ...extra,
  });
  for (const rol of ["director", "administradora"]) {
    const db = como(rol);
    await assertSucceeds(setDoc(doc(db, "documentos_trabajadores/adj1_0"), trozo()));
    await assertSucceeds(getDoc(doc(db, "documentos_trabajadores/adj1_0")));
    await assertFails(updateDoc(doc(db, "documentos_trabajadores/adj1_0"), { datos: "WFla" }));
    await assertFails(setDoc(doc(db, "documentos_trabajadores/adj1_1"), trozo(0))); // el id no es <adjunto>_<parte>
    await assertFails(setDoc(doc(db, "documentos_trabajadores/adj1_2"), trozo(2, { otro: "campo" })));
    await assertSucceeds(deleteDoc(doc(db, "documentos_trabajadores/adj1_0")));
  }
  await assertSucceeds(setDoc(doc(como("director"), "documentos_trabajadores/adj1_0"), trozo()));
  for (const rol of ["docente", "docenteFijo", "desconocido"]) {
    await assertFails(getDoc(doc(como(rol), "documentos_trabajadores/adj1_0")));
    await assertFails(setDoc(doc(como(rol), "documentos_trabajadores/adj2_0"), trozo(0, { adjuntoId: "adj2" })));
    await assertFails(deleteDoc(doc(como(rol), "documentos_trabajadores/adj1_0")));
  }
});

test("cuentas por pagar: solo director y administradora", async () => {
  const cuenta = { descripcion: "Luz", monto: 20, moneda: "USD", vence: "2026-10-31", estado: "pendiente" };
  for (const rol of ["director", "administradora"]) {
    const db = como(rol);
    await assertSucceeds(setDoc(doc(db, "cuentas_pagar/c-" + rol), cuenta));
    await assertSucceeds(updateDoc(doc(db, "cuentas_pagar/c-" + rol), { estado: "pagada" }));
    await assertSucceeds(getDocs(collection(db, "cuentas_pagar")));
    await assertSucceeds(deleteDoc(doc(db, "cuentas_pagar/c-" + rol)));
  }
  for (const rol of ["docente", "desconocido"]) {
    await assertFails(getDocs(collection(como(rol), "cuentas_pagar")));
    await assertFails(setDoc(doc(como(rol), "cuentas_pagar/x"), cuenta));
  }
});

test("administradora: carga la tasa BCV pero no el resto de la configuración", async () => {
  const db = como("administradora");
  await assertSucceeds(setDoc(doc(db, "config/tasasBCV"), { tasas: { "2026-10-07": 184.5 } }, { merge: true }));
  await assertSucceeds(getDoc(doc(db, "config/institucion")));
  await assertFails(setDoc(doc(db, "config/institucion"), { nombre: "Otro" }));
  await assertFails(setDoc(doc(db, "config/cobranza"), { cuotas: 12 }));
  await assertFails(getDocs(collection(db, "usuarios")));
});

test("docente: lee las fichas de estudiantes y la configuración, carga notas, y nada más", async () => {
  for (const rol of ["docente", "docenteFijo"]) {
    const db = como(rol);
    await assertSucceeds(getDoc(doc(db, "estudiantes_docentes/est1")));
    await assertSucceeds(getDocs(collection(db, "estudiantes_docentes")));
    await assertFails(getDoc(doc(db, "estudiantes/est1"))); // datos privados: teléfonos, deuda...
    await assertFails(getDocs(collection(db, "estudiantes")));
    await assertFails(setDoc(doc(db, "estudiantes_docentes/est1"), { nombre: "Otro" }));
    await assertFails(deleteDoc(doc(db, "estudiantes_docentes/est1")));
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
  await assertFails(getDoc(doc(db, "estudiantes_docentes/est1")));
  await assertFails(setDoc(doc(db, "notas/est1_Lapso 2"), { estId: "est1" }));
});

test("fichas de docentes: director y administradora las mantienen, solo con los campos permitidos", async () => {
  for (const rol of ["director", "administradora"]) {
    const db = como(rol);
    const ficha = {
      nombre: "Luis",
      cedula: "V-1",
      fechaNac: "2015-01-01",
      grado: "2do Grado",
      seccion: "A",
      anioEscolar: "2026-2027",
      acudiente: "María",
      estado: "retirado",
      graduado: true,
    };
    await assertSucceeds(setDoc(doc(db, "estudiantes_docentes/est2"), ficha));
    await assertSucceeds(getDoc(doc(db, "estudiantes_docentes/est2")));
    await assertSucceeds(deleteDoc(doc(db, "estudiantes_docentes/est2")));
    // Un dato privado no puede llegar a las fichas, ni por error de la app
    for (const privado of ["telefonoAcudiente", "correoAcudiente", "deuda", "mensualidad", "observacionesMedicas"]) {
      await assertFails(setDoc(doc(db, "estudiantes_docentes/est3"), { nombre: "Luis", [privado]: "x" }));
      await assertFails(updateDoc(doc(db, "estudiantes_docentes/est1"), { [privado]: "x" }));
    }
  }
  await assertFails(getDoc(doc(como("desconocido"), "estudiantes_docentes/est1")));
});

test("colecciones no previstas: cerradas para todos", async () => {
  await assertFails(getDoc(doc(como("director"), "otra_coleccion/x")));
  await assertFails(setDoc(doc(como("director"), "otra_coleccion/y"), { a: 1 }));
});

test("contador de recibos: director y administradora lo avanzan de 1 en 1; nadie lo retrocede", async () => {
  const admin = como("administradora");
  await assertSucceeds(setDoc(doc(admin, "config/contadores"), { recibo: 1 }));
  await assertSucceeds(setDoc(doc(admin, "config/contadores"), { recibo: 2 }, { merge: true }));
  await assertFails(setDoc(doc(admin, "config/contadores"), { recibo: 10 }, { merge: true })); // salto
  await assertFails(setDoc(doc(admin, "config/contadores"), { recibo: 1 }, { merge: true })); // retroceso
  await assertFails(setDoc(doc(admin, "config/contadores"), { recibo: 3, otro: true }, { merge: true }));
  await assertFails(setDoc(doc(como("docente"), "config/contadores"), { recibo: 3 }, { merge: true }));
  await assertSucceeds(setDoc(doc(como("director"), "config/contadores"), { recibo: 100 })); // el director puede corregirlo
});

test("cobro completo en una transacción (como lo hace la app): contador + pago + deuda del estudiante", async () => {
  const db = como("administradora");
  await entorno.withSecurityRulesDisabled((ctx) =>
    setDoc(doc(ctx.firestore(), "estudiantes/est1"), { nombre: "Ana", estado: "mora", moraMonto: 30 })
  );
  await assertSucceeds(
    runTransaction(db, async (tx) => {
      const c = await tx.get(doc(db, "config/contadores"));
      const e = await tx.get(doc(db, "estudiantes/est1"));
      const n = ((c.exists() && c.data().recibo) || 0) + 1;
      tx.set(doc(db, "config/contadores"), { recibo: n }, { merge: true });
      tx.set(doc(db, "pagos/nuevo"), { total: 30, factura: "FAC-" + n, deudaAplicada: 30, ...firma("administradora") });
      tx.update(doc(db, "estudiantes/est1"), { moraMonto: e.data().moraMonto - 30, estado: "alsaldo" });
    })
  );
  // y el docente no puede hacerlo
  const dbDocente = como("docente");
  await assertFails(
    runTransaction(dbDocente, async (tx) => {
      tx.set(doc(dbDocente, "pagos/otro"), { total: 1 });
    })
  );
});

test("auditoría: cada pago e ingreso/gasto nuevo lleva la firma de quien lo registra (la suya, no la de otro)", async () => {
  const admin = como("administradora");
  await assertFails(setDoc(doc(admin, "pagos/sinfirma"), { total: 10 }));
  await assertFails(setDoc(doc(admin, "pagos/ajena"), { total: 10, ...firma("director") }));
  await assertSucceeds(setDoc(doc(admin, "pagos/propia"), { total: 10, ...firma("administradora") }));
  await assertFails(setDoc(doc(admin, "finanzas/sinfirma"), { monto: 5 }));
  await assertSucceeds(setDoc(doc(admin, "finanzas/propia"), { monto: 5, ...firma("administradora") }));
  // al editar un ingreso/gasto no se puede cambiar quién lo registró
  await assertFails(updateDoc(doc(como("director"), "finanzas/propia"), { registradoPor: "herrerajoicer@gmail.com" }));
  await assertSucceeds(updateDoc(doc(como("director"), "finanzas/propia"), { observaciones: "ok" }));
});

test("auditoría: no se puede borrar sin dejar la anotación en la bitácora, ni anotar a nombre de otro", async () => {
  const db = como("director");
  await assertFails(deleteDoc(doc(db, "pagos/pag1")));
  await assertFails(borrarConBitacora(db, "director", "pagos", "pag1", { anotar: false }));
  await assertFails(borrarConBitacora(db, "director", "pagos", "pag1", { por: "josefajsanquez@gmail.com" }));
  await assertSucceeds(borrarConBitacora(db, "director", "pagos", "pag1"));
});

test("bitácora: solo el director la lee; nadie la cambia ni la borra", async () => {
  await borrarConBitacora(como("director"), "director", "finanzas", "fin1");
  await assertSucceeds(getDoc(doc(como("director"), "bitacora/finanzas_fin1")));
  await assertFails(getDoc(doc(como("administradora"), "bitacora/finanzas_fin1")));
  await assertFails(getDoc(doc(como("docente"), "bitacora/finanzas_fin1")));
  await assertFails(updateDoc(doc(como("director"), "bitacora/finanzas_fin1"), { por: "otro" }));
  await assertFails(deleteDoc(doc(como("director"), "bitacora/finanzas_fin1")));
  // una anotación tiene que corresponder a su documento (id = colección_id)
  await assertFails(
    setDoc(doc(como("administradora"), "bitacora/pagos_x"), {
      coleccion: "pagos",
      docId: "y",
      por: "josefajsanquez@gmail.com",
    })
  );
});

test("sin conexión: un recibo pendiente recibe su número correlativo, y nada más se puede cambiar", async () => {
  const admin = como("administradora");
  await entorno.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "config/contadores"), { recibo: 7 });
    await setDoc(doc(ctx.firestore(), "pagos/prov1"), {
      total: 45,
      factura: "PROV-ABC",
      pendiente: true,
      ...firma("administradora"),
    });
  });
  const numerar = (db, cambios, n = 8) =>
    runTransaction(db, async (tx) => {
      await tx.get(doc(db, "config/contadores"));
      tx.set(doc(db, "config/contadores"), { recibo: n }, { merge: true });
      tx.update(doc(db, "pagos/prov1"), cambios);
    });
  const bien = {
    factura: "FAC-000008",
    pendiente: false,
    recibo: 8,
    facturaProvisional: "PROV-ABC",
    numeradoPor: "josefajsanquez@gmail.com",
  };
  await assertFails(numerar(admin, { ...bien, total: 1 })); // no se puede tocar el monto
  await assertFails(numerar(admin, { ...bien, recibo: 9 })); // el número debe ser el del contador
  await assertFails(numerar(admin, { ...bien, numeradoPor: "herrerajoicer@gmail.com" }));
  await assertSucceeds(numerar(admin, bien));
  // ya numerado: no se puede volver a cambiar
  await assertFails(numerar(admin, { ...bien, factura: "FAC-000009", recibo: 9 }, 9));
  await assertFails(updateDoc(doc(admin, "pagos/pag1"), { total: 1 }));
});
