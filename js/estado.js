// Estado global de la aplicación: sesión, datos cargados de Firestore, pestaña y filtros actuales.

// STATE
let auth=false,rolUsuario="",tabActual="dashboard";
let pagos=[],estudiantes=[],trabajadores=[],finanzas=[],notas={};
let modalActual=null;
let subTab={pagos:"lista",finanzas:"resumen",nomina:"lista",config:"docentes"};
let trabEditId=null; // trabajador que se está editando (null = formulario de trabajador nuevo)
let usuarioActual=null;
let filtros={busq:"",fecha:"",metodo:"",estado:"",lapso:LAPSOS[0],anio:String(anioActual())};
// config/anioEscolar = { actual:{id,nombre,inicio}, anteriores:[{id,nombre,inicio,fin,cerradoEn,resumen,deudas}], pendienteLimpieza, limpieza }
// Pagos y finanzas se asignan al año por su fecha (no se borra nada). Las notas del año cerrado se copian a
// "notas_historial" y se limpian de "notas". Los estudiantes se conservan y su saldo vuelve a cero.
let escCfg=null;      // null = aún no se separó por años (modo anterior: todo junto)
let anioVista=null;   // id del año que se está viendo
