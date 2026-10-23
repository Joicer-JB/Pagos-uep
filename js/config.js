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
// reCAPTCHA v3, invisible para quien usa la app. Va antes de cualquier uso de Firestore. Mientras APP_CHECK_CLAVE
// esté vacía no se activa (ver docs/app-check.md). En el equipo de desarrollo (localhost) tampoco.
const APP_CHECK_CLAVE = "";
const APP_CHECK_ENTERPRISE = false; // true si la clave se creó como reCAPTCHA Enterprise (en Google Cloud)
if (APP_CHECK_CLAVE && firebase.appCheck && !/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
  const Proveedor = APP_CHECK_ENTERPRISE
    ? firebase.appCheck.ReCaptchaEnterpriseProvider
    : firebase.appCheck.ReCaptchaV3Provider;
  firebase.appCheck().activate(new Proveedor(APP_CHECK_CLAVE), true);
}
const db = firebase.firestore();
// Copia de los datos en el equipo: la app sigue funcionando sin internet (ver servicios/conexion.js).
// Tiene que activarse antes de cualquier lectura o escritura.
db.enablePersistence({ synchronizeTabs: true }).catch((e) =>
  console.warn("Sin copia local de los datos (no se podrá trabajar sin internet):", e.code || e.message)
);
const fbAuth = firebase.auth();
