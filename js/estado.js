// Estado global de la aplicación: sesión, datos cargados de Firestore, pestaña y filtros actuales.

// STATE
let auth = false,
  rolUsuario = "",
  tabActual = "dashboard";
let pagos = [],
  estudiantes = [],
  trabajadores = [],
  finanzas = [],
  cuentasPagar = [], // cuentas por pagar (ver servicios/contabilidad.js)
  notas = {};
let modalActual = null;
let subTab = { pagos: "lista", finanzas: "resumen", nomina: "lista", config: "docentes" };
let trabEditId = null; // trabajador que se está editando (null = formulario de trabajador nuevo)
let usuarioActual = null;
let filtros = { busq: "", fecha: "", metodo: "", estado: "", lapso: LAPSOS[0], anio: String(anioActual()) };
// config/anioEscolar = { actual:{id,nombre,inicio}, anteriores:[{id,nombre,inicio,fin,cerradoEn,resumen,deudas}], pendienteLimpieza, limpieza }
// Pagos y finanzas se asignan al año por su fecha (no se borra nada). Las notas del año cerrado se copian a
// "notas_historial" y se limpian de "notas". Los estudiantes se conservan y su saldo vuelve a cero.
let escCfg = null; // null = aún no se separó por años (modo anterior: todo junto)
let anioVista = null; // id del año que se está viendo

// Agrega un registro a una lista en memoria (pagos, estudiantes, finanzas…), o lo actualiza si ya está.
// Con el tiempo real, Firestore puede traer el registro recién guardado antes de que el código lo agregue.
function ponerEnLista(lista, obj, alInicio = false) {
  const i = lista.findIndex((x) => x.id === obj.id);
  if (i >= 0) lista[i] = { ...lista[i], ...obj };
  else if (alInicio) lista.unshift(obj);
  else lista.push(obj);
}
