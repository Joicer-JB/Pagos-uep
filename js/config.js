// Configuración general: datos de la institución, catálogos fijos, roles, conexión con Firebase y EmailJS.

const EMPRESA="U.E.P Josefa Joaquina Sánchez";
const EMPRESA_SUB="Turumo - Caucagüita";
const MATERIAS=["Matemáticas","Lengua y Literatura","Ciencias Naturales","Ciencias Sociales","Inglés","Educación Física","Arte y Patrimonio","Religión","Química","Física","Turismo y Fotografía"];
const LAPSOS=["Lapso 1","Lapso 2","Lapso 3"];
const ROLES={"herrerajoicer@gmail.com":"director","josefajsanquez@gmail.com":"administradora","notasjjs@gmail.com":"docente"};
const MESES=["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
firebase.initializeApp({apiKey:"AIzaSyArhq4fDM4NdeK8Js1KYGoXAGYvab1P07A",authDomain:"pagos-jjs.firebaseapp.com",projectId:"pagos-jjs",storageBucket:"pagos-jjs.firebasestorage.app",messagingSenderId:"1007197351478",appId:"1:1007197351478:web:3948a2480b9c79a33ab297"});
const db=firebase.firestore();
const fbAuth=firebase.auth();
const EJS_SERVICE = "service_jwzro4s";
const EJS_TEMPLATE = "template_b5uyqpv";
const EJS_KEY = "BBbsHdEcvrRg79mag";
// ---- Comprobante de cobranza por correo (EmailJS)
const CORREO_COLEGIO="notijosefajoaquina@gmail.com";   // buzón del colegio: a él llegan las respuestas de los representantes
