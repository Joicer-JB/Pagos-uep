// Configuración general: datos de la institución, catálogos fijos, roles, conexión con Firebase.

const EMPRESA = "U.E.P Josefa Joaquina Sánchez";
const EMPRESA_SUB = "Turumo - Caucagüita";
const MATERIAS = [
  "Matemáticas",
  "Lengua y Literatura",
  "Ciencias Naturales",
  "Ciencias Sociales",
  "Inglés",
  "Educación Física",
  "Arte y Patrimonio",
  "Religión",
  "Química",
  "Física",
  "Turismo y Fotografía",
];
const LAPSOS = ["Lapso 1", "Lapso 2", "Lapso 3"];
// Notas de Media General: por ahora control de estudio carga solo la nota final de cada lapso, la que entrega el
// profesor. true = cada profesor carga sus evaluaciones con su plan de evaluación (para más adelante: ya está hecho).
// (let y no const: las pruebas de las notas detalladas lo activan)
let NOTAS_DETALLADAS = false;
const ROLES = {
  "herrerajoicer@gmail.com": "director",
  "josefajsanquez@gmail.com": "administradora",
  "notasjjs@gmail.com": "docente",
};
const MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];
firebase.initializeApp({
  apiKey: "AIzaSyArhq4fDM4NdeK8Js1KYGoXAGYvab1P07A",
  authDomain: "pagos-jjs.firebaseapp.com",
  projectId: "pagos-jjs",
  storageBucket: "pagos-jjs.firebasestorage.app",
  messagingSenderId: "1007197351478",
  appId: "1:1007197351478:web:3948a2480b9c79a33ab297",
});
// App Check: Firebase solo atiende a esta página (no a programas que copien la configuración de arriba). Usa
// Google Cloud Fraud Defense (antes reCAPTCHA Enterprise), invisible para quien usa la app. Va antes de cualquier uso
// de Firestore. Mientras APP_CHECK_CLAVE esté vacía no se activa (ver docs/app-check.md). En el equipo de desarrollo
// (localhost) tampoco.
const APP_CHECK_CLAVE = "6LehWv4tAAAAAFdCRy2CgFBb91EYRP7DdCEO_Dq5";
const APP_CHECK_ENTERPRISE = true; // la clave es de Fraud Defense (Google Cloud); false = reCAPTCHA v3 clásico
if (APP_CHECK_CLAVE && firebase.appCheck && !/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
  const Proveedor = APP_CHECK_ENTERPRISE
    ? firebase.appCheck.ReCaptchaEnterpriseProvider
    : firebase.appCheck.ReCaptchaV3Provider;
  firebase.appCheck().activate(new Proveedor(APP_CHECK_CLAVE), true);
}
// Avisos al teléfono: clave pública «Web Push» de Firebase (Configuración del proyecto → Cloud Messaging →
// Certificados push web). Mientras esté vacía, los avisos no se pueden activar (ver docs/avisos-telefono.md).
// (let y no const: las pruebas ponen una de mentira)
let VAPID_CLAVE = "BMEbJRVU6fqW55_Y8NnvOQmHIi4_cq-nM5I68h3Dk6rRumQJn1u8jWs1utUHlyFU9kN8NxVzpe5-x3xk6E8aaJc";
const db = firebase.firestore();
// Copia de los datos en el equipo: la app sigue funcionando sin internet (ver servicios/conexion.js).
// Tiene que activarse antes de cualquier lectura o escritura.
db.enablePersistence({ synchronizeTabs: true }).catch((e) =>
  console.warn("Sin copia local de los datos (no se podrá trabajar sin internet):", e.code || e.message)
);
const fbAuth = firebase.auth();
