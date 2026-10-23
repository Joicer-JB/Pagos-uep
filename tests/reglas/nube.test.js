// Respaldo automático y avisos al teléfono (herramientas/nube), contra el emulador de Firestore: lo mismo que corre
// GitHub Actions, con datos de prueba. Firebase Cloud Messaging no tiene emulador: el envío se prueba con uno falso.
//
// Uso: npm run test:reglas   (arranca el emulador y corre las pruebas de tests/reglas/)
process.env.GCLOUD_PROJECT = "demo-pagos-nube"; // otro proyecto: no choca con las pruebas de reglas que corren a la vez
delete process.env.FIREBASE_SERVICE_ACCOUNT;
const { test, before } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const zlib = require("zlib");
const { conectar } = require("../../herramientas/nube/firebase");
const { enviarAvisos, mensajeDia, mensajeQuincena, leerDatos } = require("../../herramientas/nube/avisos");
const { cargarApp } = require("../../herramientas/nube/app-en-node");
const respaldo = require("../../herramientas/nube/respaldo");

const hoyLocal = () => {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
};
const HOY = hoyLocal();
const AYER = (() => {
  const d = new Date(HOY + "T12:00:00");
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
})();
let db;

before(async () => {
  ({ db } = conectar());
  const lote = db.batch();
  const poner = (ruta, datos) => lote.set(db.doc(ruta), datos);
  const anio = Number(HOY.slice(0, 4)) - (Number(HOY.slice(5, 7)) < 9 ? 1 : 0);
  poner("config/anioEscolar", {
    actual: { id: anio + "-" + (anio + 1), nombre: anio + "-" + (anio + 1), inicio: anio + "-09-01" },
    anteriores: [],
  });
  poner("config/cobranza", { primerMes: anio + "-09", cuotas: 10, diaVence: 5 });
  poner("config/tasasBCV", { tasas: { [HOY]: 200, [AYER]: 199 } });
  poner("estudiantes/e1", { nombre: "Ana Pérez", grado: "1er Grado", mensualidad: 45, estado: "mora", moraMonto: 30 });
  poner("estudiantes/e2", { nombre: "Luis Gómez", grado: "2do Grado", mensualidad: 0 });
  poner("pagos/p1", {
    nombre: "Ana Pérez",
    estId: "e1",
    fecha: HOY,
    total: 60,
    metodo: "Dólares Efectivo",
    factura: "FAC-000001",
    concepto: "Otro",
  });
  poner("pagos/p2", {
    nombre: "Luis Gómez",
    estId: "e2",
    fecha: HOY,
    total: 40,
    metodo: "Transferencia Bs",
    factura: "FAC-000002",
    tasa: 200,
    totalBs: 8000,
    concepto: "Otro",
  });
  poner("finanzas/f1", { tipo: "gasto", fecha: HOY, monto: 15, categoria: "Servicios", descripcion: "Agua" });
  poner("cuentas_pagar/c1", { descripcion: "Luz", monto: 20, moneda: "USD", vence: AYER, estado: "pendiente" });
  poner("avisos_dispositivos/a", { token: "t-sirve", avisos: { dia: true, quincena: true, respaldo: true } });
  poner("avisos_dispositivos/b", { token: "t-no-quiere", avisos: { dia: false, quincena: true, respaldo: true } });
  poner("avisos_dispositivos/c", { token: "t-muerto", avisos: { dia: true } });
  await lote.commit();
});

test("cierre del día: lo cobrado hoy por método, las cuentas vencidas y cuántos deben (con el código de la app)", async () => {
  const app = await cargarApp(await leerDatos(db));
  const m = mensajeDia(app);
  assert.equal(m.titulo, "💰 Hoy se cobraron $ 100,00 (2 recibos)");
  assert.match(m.cuerpo, /\$ Efectivo \$ 60,00/);
  assert.match(m.cuerpo, /Transf Bs: Bs\. 8\.000,00 \(\$ 40,00\)|Transf Bs Bs\. 8\.000,00/);
  assert.match(m.cuerpo, /1 cuenta por pagar vencida \(\$ 20,00\)/);
  assert.match(m.cuerpo, /Deben o tienen mora: 1/);
});

test("resumen de la quincena que terminó", async () => {
  const app = await cargarApp(await leerDatos(db));
  const m = mensajeQuincena(app);
  assert.match(m.titulo, /^🗓️ Resumen de la (1ª|2ª) quincena de /);
  assert.match(m.cuerpo, /deben o tienen mora .* al día\nEntró \$ .* · Salió \$ .* · Resultado/);
});

test("se manda solo a los equipos que quieren ese aviso, y se quitan los que ya no sirven", async () => {
  const enviados = [];
  const messaging = {
    sendEach: async (msgs) => {
      enviados.push(...msgs);
      const responses = msgs.map((m) =>
        m.token === "t-muerto"
          ? { success: false, error: { code: "messaging/registration-token-not-registered" } }
          : { success: true }
      );
      return { responses, successCount: responses.filter((r) => r.success).length, failureCount: 1 };
    },
  };
  const r = await enviarAvisos(db, messaging, "dia", "Título", "Cuerpo");
  assert.deepEqual(enviados.map((m) => m.token).sort(), ["t-muerto", "t-sirve"]);
  assert.deepEqual(enviados[0].data, { titulo: "Título", cuerpo: "Cuerpo", url: "./", tipo: "dia" });
  assert.deepEqual(r, { enviados: 1, fallidos: 1, borrados: 1 });
  assert.equal((await db.doc("avisos_dispositivos/c").get()).exists, false);
  assert.equal((await db.doc("avisos_dispositivos/b").get()).exists, true);
});

test("respaldo: guarda todo cifrado, se abre con la clave y anota la fecha en config/respaldo", async () => {
  const carpeta = fs.mkdtempSync(path.join(os.tmpdir(), "respaldo-"));
  process.env.SALIDA = carpeta;
  process.env.RESPALDO_CLAVE = "clave-de-prueba-larga";
  await respaldo.main();
  const [archivo] = fs.readdirSync(carpeta);
  assert.match(archivo, /^respaldo-\d{4}-\d{2}-\d{2}\.cifrado\.json$/);
  const a = JSON.parse(fs.readFileSync(path.join(carpeta, archivo), "utf8"));
  const datos = Buffer.from(a.datos, "base64");
  const llave = crypto.pbkdf2Sync("clave-de-prueba-larga", Buffer.from(a.sal, "base64"), a.iteraciones, 32, "sha256");
  const d = crypto.createDecipheriv("aes-256-gcm", llave, Buffer.from(a.iv, "base64"));
  d.setAuthTag(datos.subarray(-16));
  const c = JSON.parse(zlib.gunzipSync(Buffer.concat([d.update(datos.subarray(0, -16)), d.final()])).toString("utf8"));
  assert.equal(c.totales.estudiantes, 2);
  assert.equal(c.totales.pagos, 2);
  assert.deepEqual(c.colecciones.estudiantes.find((x) => x.id === "e1").datos.nombre, "Ana Pérez");
  const r = (await db.doc("config/respaldo").get()).data();
  assert.equal(r.ultimo, r.automatico.fecha);
  assert.ok(r.automatico.documentos >= 10);
});
