// Carga el código de la plataforma (js/) en Node, con los datos de Firestore ya leídos, para calcular exactamente lo
// mismo que se ve en pantalla (deudas, cuotas, resumen de la quincena…). No dibuja nada: solo las funciones.
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const RAIZ = path.resolve(__dirname, "../..");
const ARCHIVOS = [
  "js/config.js",
  "js/utils/formato.js",
  "js/utils/texto.js",
  "js/utils/grados.js",
  "js/estado.js",
  "js/servicios/tasa-bcv.js",
  "js/servicios/cuotas.js",
  "js/servicios/indicadores.js",
  "js/servicios/nomina-calculo.js",
  "js/servicios/conciliacion.js",
  "js/servicios/contabilidad.js",
  "js/servicios/resumen-quincenal.js",
  "js/vistas/anio-escolar.js",
];

// datos = { config: {id: datos}, estudiantes: [...], pagos: [...], finanzas: [...], trabajadores: [...],
//           cuentas_pagar: [...] } (cada registro con su id)
async function cargarApp(datos) {
  const nada = () => {};
  const docDe = (col, id) => ({
    get: async () => {
      const d = datos[col] && !Array.isArray(datos[col]) ? datos[col][id] : null;
      return { exists: !!d, data: () => d };
    },
  });
  const contexto = vm.createContext({
    console,
    location: { hostname: "servidor" },
    localStorage: { getItem: () => null, setItem: nada, removeItem: nada },
    firebase: {
      initializeApp: nada,
      firestore: Object.assign(
        () => ({ enablePersistence: () => Promise.resolve(), collection: (c) => ({ doc: (id) => docDe(c, id) }) }),
        { FieldValue: {} }
      ),
      auth: () => ({ onAuthStateChanged: nada, currentUser: null }),
    },
  });
  for (const a of ARCHIVOS) vm.runInContext(fs.readFileSync(path.join(RAIZ, a), "utf8"), contexto, { filename: a });
  const evaluar = (codigo) => vm.runInContext(codigo, contexto);
  contexto.__datos = datos;
  await evaluar(`(async () => {
    rolUsuario = "director";
    await cargarAnioEsc();
    anioVista = escCfg ? escCfg.actual.id : null;
    await cargarTasas();
    await cargarCobCfg();
    const desde = (escCfg && escCfg.actual && escCfg.actual.inicio) || "";
    estudiantes = __datos.estudiantes || [];
    pagos = (__datos.pagos || []).filter((p) => !desde || (p.fecha || "") >= desde);
    finanzas = (__datos.finanzas || []).filter((f) => !desde || (f.fecha || "") >= desde);
    trabajadores = __datos.trabajadores || [];
    cuentasPagar = __datos.cuentas_pagar || [];
  })()`);
  return { evaluar, contexto };
}

module.exports = { cargarApp };
