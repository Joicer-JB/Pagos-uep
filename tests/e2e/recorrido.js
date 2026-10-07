// Recorrido completo de la app con el Firebase falso.
// Entra con cada rol, abre todas las pestañas, sub-pestañas y modales, registra cobros, pagos,
// estudiantes, gastos y notas, imprime recibos e importa un Excel. Después de cada paso guarda
// una "foto" de la pantalla (HTML), los diálogos, las impresiones y las escrituras a la base de datos.
//
// Uso:  node tests/e2e/recorrido.js salida.json
// Comparar dos recorridos:  node tests/e2e/comparar.js antes.json despues.json
const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");
const { abrirNavegador } = require("./entorno");

const CLAVE = "prueba123";
const CUENTAS = {
  director: "herrerajoicer@gmail.com",
  administradora: "josefajsanquez@gmail.com",
  docente: "docente.prueba@example.com",
  intruso: "intruso@example.com",
};

async function recorrer() {
  const nav = await abrirNavegador();
  const fotos = [];
  const errores = [];
  try {
    for (const rol of Object.keys(CUENTAS)) {
      const sesion = await nav.nuevaPagina();
      const r = crearRecorrido(rol, sesion, fotos);
      await r.entrar(nav.base);
      if (rol !== "intruso") {
        await r.recorrerPestanas();
        await PASOS[rol](r);
      }
      errores.push(...sesion.errores.map((e) => `[${rol}] ${e}`));
      await sesion.contexto.close();
    }
  } finally {
    await nav.cerrar();
  }
  return { fotos, errores };
}

function crearRecorrido(rol, { pagina, dialogos }, fotos) {
  let nImpresiones = 0,
    nAperturas = 0,
    nEscrituras = 0,
    nCorreos = 0,
    nDialogos = 0;
  const r = {
    rol,
    pagina,
    async esperar() {
      // deja terminar las promesas del Firebase falso y los setTimeout cortos de la app
      for (let i = 0; i < 4; i++) await pagina.evaluate(() => new Promise((ok) => setTimeout(ok, 30)));
    },
    async foto(nombre) {
      await r.esperar();
      const estado = await pagina.evaluate(() => ({
        app: document.getElementById("app").innerHTML,
        impresiones: window.__IMPRESIONES__.map((d) => d.html),
        aperturas: window.__APERTURAS__.slice(),
        escrituras: (window.__ESCRITURAS__ || []).slice(),
        correos: (window.__CORREOS__ || []).slice(),
        foco: document.activeElement ? document.activeElement.id || document.activeElement.tagName : "",
      }));
      fotos.push({
        paso: `${rol} › ${nombre}`,
        app: estado.app,
        foco: estado.foco,
        dialogos: dialogos.slice(nDialogos),
        impresiones: estado.impresiones.slice(nImpresiones),
        aperturas: estado.aperturas.slice(nAperturas),
        escrituras: estado.escrituras.slice(nEscrituras),
        correos: estado.correos.slice(nCorreos),
      });
      nDialogos = dialogos.length;
      nImpresiones = estado.impresiones.length;
      nAperturas = estado.aperturas.length;
      nEscrituras = estado.escrituras.length;
      nCorreos = estado.correos.length;
    },
    // Hace clic en el elemento cuyo onclick empieza con `prefijo` (el n-ésimo si hay varios)
    async clic(prefijo, n = 0) {
      const el = pagina.locator(`[onclick^="${prefijo}"]`).nth(n);
      if (!(await el.count())) throw new Error(`[${rol}] no se encontró un botón con onclick="${prefijo}…"`);
      await el.click();
      await r.esperar();
    },
    async hay(prefijo) {
      return (await pagina.locator(`[onclick^="${prefijo}"]`).count()) > 0;
    },
    async llamar(codigo) {
      await pagina.evaluate(codigo);
      await r.esperar();
    },
    async escribir(selector, texto) {
      await pagina.fill(selector, "");
      await pagina.type(selector, texto);
      await r.esperar();
    },
    async entrar(base) {
      await pagina.goto(base);
      await pagina.waitForSelector("#l-email");
      await r.foto("pantalla de inicio");
      await pagina.fill("#l-email", CUENTAS[rol]);
      await pagina.fill("#l-pwd", CLAVE);
      await pagina.click("#login-btn");
      if (rol === "intruso") {
        await pagina.waitForSelector(".error-msg");
      } else {
        await pagina.waitForSelector(".tabs .tab");
      }
      await r.foto("después de entrar");
    },
    async pestana(clave) {
      await r.llamar(`setTab(${JSON.stringify(clave)})`);
    },
    async recorrerPestanas() {
      const claves = await pagina.$$eval(".tabs .tab", (bs) =>
        bs.map((b) => b.getAttribute("onclick").match(/setTab\('(.+)'\)/)[1])
      );
      for (const clave of claves) {
        await r.pestana(clave);
        await r.foto(`pestaña ${clave}`);
        const subs = await pagina.$$eval("#tab-content .stab", (bs) => bs.map((b) => b.getAttribute("onclick")));
        for (let i = 0; i < subs.length; i++) {
          await pagina.locator("#tab-content .stab").nth(i).click();
          await r.foto(`pestaña ${clave} › sub ${i}: ${subs[i].slice(0, 60)}`);
        }
        await r.pestana(clave);
      }
    },
    // Elige una opción en cada <select> de la pestaña (vuelve a buscarlos porque la pantalla se redibuja)
    async elegirEnSelects(nombre, cual) {
      const total = await pagina.locator("#tab-content select").count();
      for (let i = 0; i < total; i++) {
        const sel = pagina.locator("#tab-content select").nth(i);
        if (!(await sel.count())) break;
        const opciones = await sel.locator("option").evaluateAll((os) => os.map((o) => o.value).filter(Boolean));
        if (!opciones.length) continue;
        await sel.selectOption(cual === "primera" ? opciones[0] : opciones[opciones.length - 1]);
        await r.esperar();
        await r.foto(`${nombre} select ${i}`);
      }
    },
    // Notas de estudiantes concretos: media general (materias configuradas) y primaria (indicadores)
    async verNotasDe(ids) {
      await r.pestana("notas");
      for (const id of ids) {
        await r.llamar(`filtros.gradoNotas="";filtros.estSelId=${JSON.stringify(id)};renderTabContent()`);
        await r.foto(`notas de ${id}`);
      }
      await r.llamar(`filtros.estSelId="";renderTabContent()`);
    },
    // Abre cada elemento que coincide con el prefijo, toma foto y cierra el modal
    async abrirCada(prefijo, max = 3) {
      const n = Math.min(max, await pagina.locator(`[onclick^="${prefijo}"]`).count());
      for (let i = 0; i < n; i++) {
        await r.clic(prefijo, i);
        await r.foto(`${prefijo}… #${i}`);
        await r.llamar("modalActual && cerrarModal()");
      }
    },
  };
  return r;
}

function excelDePrueba() {
  const filas = [
    [
      "Grado",
      "Cédula escolar",
      "Nombres y apellidos",
      "Sexo",
      "Fecha de nacimiento",
      "Representante",
      "Cédula representante",
      "Teléfono",
      "Correo",
    ],
    [
      "2do Grado",
      "V-31000111",
      "Pedro Pablo Ruiz",
      "M",
      "15/04/2018",
      "Ana Ruiz",
      "V-14000111",
      "0414-5550001",
      "ana.ruiz@example.com",
    ],
    ["2do Grado", "V-31000222", "Lucía Fernanda Mora", "F", "2018-08-20", "Luis Mora", "V-14000222", "04245550002", ""],
    ["2do Grado", "V-30111222", "Ana María Pérez", "F", "10/03/2019", "Carmen Pérez", "V-12345678", "04141234567", ""],
  ];
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, XLSX.utils.aoa_to_sheet(filas), "Matrícula");
  const archivo = path.join(require("os").tmpdir(), "matricula-prueba.xlsx");
  XLSX.writeFile(libro, archivo);
  return archivo;
}

const PASOS = {
  async director(r) {
    const { pagina } = r;

    // Tasa BCV del día
    await r.clic("abrirModal({tipo:'tasa'})");
    await r.foto("modal tasa");
    await r.clic("traerTasaAPI()");
    await r.foto("tasa traída de la API");
    await pagina.fill("#tz-fecha", "2026-10-07");
    await pagina.fill("#tz-valor", "184,5");
    await r.clic("guardarTasaModal()");
    await r.foto("tasa guardada");
    await r.llamar("modalActual && cerrarModal()");

    // Caja: buscar, elegir estudiante, marcar cuotas, cobrar e imprimir
    await r.pestana("caja");
    await r.escribir("#caja-q", "Luis");
    await r.foto("caja buscar Luis");
    await r.clic("cajaElegir(");
    await r.foto("caja estudiante elegido");
    if (await r.hay("cajaToggle(")) {
      await r.clic("cajaToggle(");
      await r.foto("caja concepto marcado");
    }
    await r.clic("cajaMetodo(");
    await r.foto("caja método elegido");
    await r.clic("cajaCobrar()");
    await r.foto("caja cobrado (recibo)");
    if (await r.hay("imprimirRecibo()")) {
      await r.clic("imprimirRecibo()");
      await r.foto("recibo impreso");
    }
    if (await r.hay("enviarWhatsApp()")) {
      await r.clic("enviarWhatsApp()");
      await r.foto("recibo por WhatsApp");
    }
    await r.llamar("modalActual && cerrarModal()");
    await r.escribir("#caja-q", "Ana");
    await r.clic("cajaElegir(");
    await r.clic("cajaOtro(true)");
    await r.foto("caja otro concepto");
    await r.llamar("caja.vista='cierre';caja.cierre=todayStr();renderTabContent()");
    await r.foto("caja cierre del día");
    if (await r.hay("imprimirCierreCaja()")) {
      await r.clic("imprimirCierreCaja()");
      await r.foto("cierre de caja impreso");
    }

    // Pagos: formulario de nuevo pago
    await r.pestana("pagos");
    await r.llamar("subTab.pagos='nuevo';renderTabContent()");
    await r.foto("pagos nuevo");
    const cedula = await pagina.$("[oninput^='buscarEstudiantePorCedula(']");
    if (cedula) {
      await cedula.type("30444");
      await r.esperar();
      await r.foto("pagos buscar cédula");
      await r.clic("seleccionarEstudiantePago(");
      await r.foto("pagos estudiante elegido");
      await r.clic("selMetodoPago('Punto')");
      const total = await pagina.$("#p-total");
      if (total) await total.type("55");
      await r.esperar();
      await r.foto("pagos formulario lleno");
      await r.clic("guardarPago()");
      await r.foto("pagos guardado");
      await r.llamar("modalActual && cerrarModal()");
    }
    await r.llamar("subTab.pagos='lista';renderTabContent()");
    await r.abrirCada("abrirModal({tipo:'recibo'", 2);

    // Estudiantes: ver, editar, nuevo, constancia y boletín
    await r.pestana("estudiantes");
    await r.abrirCada("abrirModal({tipo:'ver-estudiante'", 3);
    await r.clic("abrirModal({tipo:'ver-estudiante'");
    for (const p of ["imprimirConstancia(", "imprimirBoletin("]) {
      if (await r.hay(p)) {
        await r.clic(p);
        await r.foto(`impresión ${p}`);
      }
    }
    await r.llamar("modalActual && cerrarModal()");
    await r.llamar("abrirModal({tipo:'editar-estudiante',id:'est2'})");
    await r.foto("modal editar estudiante");
    await r.llamar("cerrarModal()");
    await r.llamar("abrirModal({tipo:'nuevo-estudiante'})");
    await r.foto("modal nuevo estudiante");
    await r.clic("guardarEstudiante(");
    await r.foto("nuevo estudiante sin datos (error)");
    await r.llamar("cerrarModal()");

    // Finanzas: nuevo gasto y nuevo ingreso
    await r.pestana("finanzas");
    await r.llamar("abrirModal({tipo:'nuevo-finanza',subtipo:'gasto'})");
    await r.foto("modal nuevo gasto");
    await pagina.fill("#fin-desc", "Compra de pintura");
    await pagina.type("#fin-monto", "40");
    await r.esperar();
    await r.foto("gasto lleno");
    await r.clic("guardarFinanza(");
    await r.foto("gasto guardado");
    await r.llamar("modalActual && cerrarModal()");
    await r.abrirCada("abrirModal({tipo:'ver-finanza'", 2);
    for (let i = 0; i < 4; i++) {
      if ((await pagina.locator(`[onclick^="imprimirFlujoCaja("]`).count()) > i) {
        await r.clic("imprimirFlujoCaja(", i);
        await r.foto(`flujo de caja impreso #${i}`);
      }
    }

    // Nómina: ver trabajador, editar, pago de nómina, historial
    await r.pestana("nomina");
    await r.abrirCada("abrirModal({tipo:'ver-trabajador'", 2);
    await r.llamar("abrirModal({tipo:'pago-nomina'})");
    await r.foto("modal pago de nómina");
    await r.llamar("cerrarModal()");
    await r.llamar("editarTrabajador('trab1')");
    await r.foto("editar trabajador");
    await r.llamar("subTab.nomina='historial';renderTabContent()");
    await r.foto("historial nómina");
    if (await r.hay("event.stopPropagation();imprimirReciboNomina(")) {
      await r.clic("event.stopPropagation();imprimirReciboNomina(");
      await r.foto("recibo de nómina impreso");
    }

    // Cobranza: vistas e impresión
    await r.pestana("cobranza");
    const vistas = await pagina.$$eval(`[onclick^="cobSet('vista'"]`, (bs) => bs.map((b) => b.getAttribute("onclick")));
    for (const v of vistas) {
      await r.llamar(v);
      await r.foto(`cobranza ${v}`);
    }
    if (await r.hay("imprimirCobranza()")) {
      await r.clic("imprimirCobranza()");
      await r.foto("cobranza impresa");
    }

    // Notas: elegir estudiante de media y de primaria, cambiar lapso
    await r.pestana("notas");
    await r.elegirEnSelects("notas", "ultima");
    await r.abrirCada("filtros.lapso=", 3);

    // Configuración: docentes, materias, indicadores, institución, año escolar
    await r.pestana("config");
    await r.llamar("abrirModalNuevoDocente()");
    await r.foto("modal nuevo docente");
    await r.llamar("modalActual && cerrarModal()");
    if (typeof (await pagina.evaluate(() => typeof abrirModalEditarDocente)) === "string") {
      await r.llamar("abrirModalEditarDocente('uid-docente')");
      await r.foto("modal editar docente");
      await r.llamar("modalActual && cerrarModal()");
    }
    await r.abrirCada("filtros.gradoConfig=", 2);
    await r.abrirCada("filtros.gradoIndConfig=", 2);

    // Importar desde Excel
    await r.pestana("importar");
    const archivo = await pagina.$("#tab-content input[type=file]");
    if (archivo) {
      const gradoSel = await pagina.$("#tab-content select");
      if (gradoSel) {
        const ops = await gradoSel.$$eval("option", (os) => os.map((o) => o.value).filter(Boolean));
        if (ops.length) await gradoSel.selectOption(ops[0]);
      }
      await archivo.setInputFiles(excelDePrueba());
      await pagina.waitForTimeout(300);
      await r.foto("importar vista previa");
      if (await r.hay("ejecutarImportacion()")) {
        await r.clic("ejecutarImportacion()");
        await pagina.waitForTimeout(300);
        await r.foto("importación ejecutada");
      }
    }

    // Año escolar anterior (solo consulta)
    await r.llamar("cambiarAnioVista('2025-2026')");
    await pagina.waitForSelector(".tabs .tab");
    await r.foto("año anterior");
    await r.pestana("pagos");
    await r.foto("año anterior › pagos");
    await r.llamar("abrirModal({tipo:'nuevo-estudiante'})");
    await r.foto("año anterior › intento de registrar");

    // Salir
    await r.llamar("cambiarAnioVista('2026-2027')");
    await pagina.waitForSelector(".tabs .tab");
    await r.clic("logout()");
    await pagina.waitForSelector("#l-email");
    await r.foto("después de salir");

    // En el mismo equipo entra un docente: debe empezar en Notas, no en la pestaña que dejó el director
    await pagina.fill("#l-email", CUENTAS.docente);
    await pagina.fill("#l-pwd", CLAVE);
    await pagina.click("#login-btn");
    await pagina.waitForSelector(".tabs .tab");
    await r.foto("docente entra en el mismo equipo");
  },

  async administradora(r) {
    await r.verNotasDe(["est2", "est6"]);
    await r.pestana("estudiantes");
    await r.abrirCada("abrirModal({tipo:'ver-estudiante'", 1);
    await r.pestana("pagos");
    await r.abrirCada("abrirModal({tipo:'recibo'", 1);
    await r.pestana("notas");
    const sel = await r.pagina.$("#tab-content select");
    if (sel) {
      await sel.selectOption({ index: 1 }).catch(() => {});
      await r.foto("notas con estudiante");
    }
  },

  async docente(r) {
    await r.verNotasDe(["est2", "est6"]);
    await r.elegirEnSelects("docente notas", "primera");
    const nota = await r.pagina.$(
      "#tab-content input[oninput*='updateNotaLocal'], #tab-content input[onchange*='updateNotaLocal']"
    );
    if (nota) {
      await nota.fill("17");
      await nota.dispatchEvent("change");
      await nota.dispatchEvent("input");
    }
    if (await r.hay("guardarNotas(")) {
      await r.clic("guardarNotas(");
      await r.foto("docente guardó notas");
    }
  },
};

if (require.main === module) {
  const salida = process.argv[2] || "recorrido.json";
  recorrer()
    .then(({ fotos, errores }) => {
      fs.writeFileSync(salida, JSON.stringify({ fotos, errores }, null, 1));
      console.log(`${fotos.length} fotos guardadas en ${salida}`);
      if (errores.length) console.log("Errores en la página:\n  " + errores.join("\n  "));
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}

module.exports = { recorrer };
