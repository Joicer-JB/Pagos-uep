// Conexión a Firebase con la cuenta de servicio (secreto FIREBASE_SERVICE_ACCOUNT de GitHub). La usan el respaldo y
// los avisos. La cuenta de servicio no pasa por las reglas de Firestore: puede leer y escribir todo.
// (firebase-admin 14 ya no tiene «admin.firestore()»: se usan las funciones de cada módulo)
const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore, Timestamp, DocumentReference, GeoPoint } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

let conexion = null;
function conectar() {
  if (conexion) return conexion;
  const cuenta = process.env.FIREBASE_SERVICE_ACCOUNT;
  // En las pruebas (emulador de Firestore) no hace falta la cuenta de servicio
  if (!cuenta && process.env.FIRESTORE_EMULATOR_HOST) {
    const app = initializeApp({ projectId: process.env.GCLOUD_PROJECT || "demo-pagos-uep" });
    conexion = { db: getFirestore(app), messaging: getMessaging(app), proyecto: app.options.projectId };
    return conexion;
  }
  if (!cuenta) throw new Error("Falta el secreto FIREBASE_SERVICE_ACCOUNT (ver docs/respaldo-automatico.md)");
  const credencial = JSON.parse(cuenta);
  const app = initializeApp({ credential: cert(credencial) });
  conexion = { db: getFirestore(app), messaging: getMessaging(app), proyecto: credencial.project_id };
  return conexion;
}

module.exports = { conectar, Timestamp, DocumentReference, GeoPoint };
