// 🔍 Buscador inteligente (botón «Buscar» de la cabecera, la barra de Inicio, o Ctrl+K / tecla «/»): un solo lugar
// para encontrar cualquier cosa y llegar a cualquier acción, escribiendo como se habla:
//   · un estudiante (nombre, cédula, representante o teléfono) → cobrarle, su estado de cuenta, su ficha;
//   · un recibo (número o referencia de la transferencia) → abrirlo;
//   · un trabajador → su ficha o pagarle (director);
//   · una acción: «cierre de caja», «nuevo gasto», «pagos viejos», «respaldo»…;
//   · una pregunta: «cuánto se cobró hoy», «quién debe en 3er grado», «gastos de septiembre», «cómo vamos este mes»,
//     «qué hizo la secretaria hoy», «tasa», «inscripciones pendientes», «cuentas por pagar».
// Todo se calcula en el equipo con los datos ya cargados: no se envía a ningún lado. Cada rol ve solo lo que le
// corresponde (la administradora: lo de la Caja y Pagos, y lo cobrado de un solo día).

let busq = { q: "", sel: 0 };
let _busqItems = []; // resultados en pantalla, en orden: [{ acciones: [{ etq, fn }] }]
let _busqTimer = null;

const nB = (s) =>
  sinAcento(String(s || "").toLowerCase())
    .replace(/[¿?¡!.,;:()"]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const soloDigitosB = (s) => String(s || "").replace(/\D/g, "");
const esDirector = () => rolUsuario === "director";
const ultimoDiaMes = (ym) => ym + "-" + String(new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0).getDate());

function abrirBuscador(q) {
  if (!auth || rolUsuario === "docente") return;
  busq = { q: q || "", sel: 0 };
  abrirModal({ tipo: "buscar" });
  setTimeout(() => {
    const i = document.getElementById("busq-q");
    if (i) {
      i.focus();
      i.setSelectionRange(i.value.length, i.value.length);
    }
  }, 30);
}
// Ctrl+K (o ⌘K) desde cualquier parte, y «/» cuando no se está escribiendo
document.addEventListener("keydown", (e) => {
  if (!auth || rolUsuario === "docente") return;
  const a = document.activeElement,
    escribiendo = a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName);
  if (e.key === "Escape" && modalActual && modalActual.tipo === "buscar") {
    e.preventDefault();
    cerrarModal();
  } else if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K")) {
    e.preventDefault();
    if (!(modalActual && modalActual.tipo === "buscar")) abrirBuscador();
  } else if (e.key === "/" && !escribiendo && !modalActual && !(typeof pad !== "undefined" && pad.id)) {
    e.preventDefault();
    abrirBuscador();
  }
});

// ---- ¿De qué fechas habla? «hoy», «ayer», «esta semana», «este mes», «mes pasado», «septiembre», «15/10»,
// «esta quincena», «quincena pasada», «este año». Devuelve { desde, hasta, nombre } o null.
function periodoBusq(n) {
  const hoy = todayStr(),
    dia = (f, nombre) => ({ desde: f, hasta: f, nombre });
  if (/\banteayer\b/.test(n)) return dia(sumarDias(hoy, -2), "anteayer");
  if (/\bayer\b/.test(n)) return dia(sumarDias(hoy, -1), "ayer");
  if (/\bhoy\b/.test(n)) return dia(hoy, "hoy");
  const f = n.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/);
  if (f) {
    const y = f[3] ? (f[3].length === 2 ? "20" + f[3] : f[3]) : hoy.slice(0, 4);
    const fecha = y + "-" + f[2].padStart(2, "0") + "-" + f[1].padStart(2, "0");
    if (/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(fecha)) return dia(fecha, "el " + fechaCorta(fecha));
  }
  if (/quincena pasada|ultima quincena/.test(n)) {
    const q = quincenaAnterior(hoy);
    return { desde: q.desde, hasta: q.hasta, nombre: "la " + q.nombre };
  }
  if (/esta quincena|la quincena/.test(n)) {
    const q = quincenaDe(hoy);
    return { desde: q.desde, hasta: hoy, nombre: "esta quincena" };
  }
  if (/semana pasada/.test(n)) {
    const lunes = sumarDias(hoy, -((new Date(hoy + "T12:00").getDay() + 6) % 7) - 7);
    return { desde: lunes, hasta: sumarDias(lunes, 6), nombre: "la semana pasada" };
  }
  if (/esta semana|la semana/.test(n))
    return { desde: sumarDias(hoy, -((new Date(hoy + "T12:00").getDay() + 6) % 7)), hasta: hoy, nombre: "esta semana" };
  if (/mes pasado/.test(n)) {
    const ym = sumarMeses(hoy.slice(0, 7), -1);
    return { desde: ym + "-01", hasta: ultimoDiaMes(ym), nombre: nombreMesYM(ym).toLowerCase() };
  }
  if (/este mes|el mes\b|del mes\b/.test(n)) return { desde: hoy.slice(0, 8) + "01", hasta: hoy, nombre: "este mes" };
  if (/este ano|ano escolar|en el ano|del ano/.test(n)) {
    const ini = baseAnio() || hoy.slice(0, 4) + "-01-01";
    return { desde: ini, hasta: hoy, nombre: "este año escolar" };
  }
  const i = MESES.findIndex((m) => new RegExp("\\b" + nB(m) + "\\b").test(n.replace("setiembre", "septiembre")));
  if (i >= 0) {
    const ini = (escCfg && escCfg.actual && escCfg.actual.inicio) || "";
    let y = Number(hoy.slice(0, 4));
    if (ini) y = i + 1 >= Number(ini.slice(5, 7)) ? Number(ini.slice(0, 4)) : Number(ini.slice(0, 4)) + 1;
    else if (i + 1 > Number(hoy.slice(5, 7))) y--;
    const ym = y + "-" + String(i + 1).padStart(2, "0");
    return { desde: ym + "-01", hasta: ultimoDiaMes(ym), nombre: nombreMesYM(ym).toLowerCase() };
  }
  return null;
}
// Grado mencionado («3er grado», «1er año», «nivel ii»…), entre los que hay en la matrícula
function gradoBusq(n) {
  const grados = [...new Set(estudiantes.map((e) => e.grado).filter(Boolean))].sort((a, b) => b.length - a.length);
  return grados.find((g) => n.includes(nB(g))) || "";
}
// Persona mencionada en «qué hizo la secretaria»
function personaBusq(n) {
  const correo = (rol) => Object.keys(ROLES).find((k) => ROLES[k] === rol) || "";
  if (/secretari|administrador/.test(n)) return correo("administradora");
  if (/\b(yo|mio|mis|director)\b/.test(n)) return correo("director");
  return "";
}

// ---- Acciones: lo que se puede abrir. tab = pestaña donde está (cada rol solo ve las de sus pestañas)
const ir = (tab, sub, despues) => () => {
  if (sub) subTab[tab] = sub;
  setTab(tab);
  if (despues) setTimeout(despues, 60);
};
const irA = (sel) => () => {
  const el = document.querySelector(sel);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
};
const ACCIONES_BUSQ = [
  ["💳", "Cobrar en la Caja", "caja", "cobrar caja cobro cobrarle", () => ((caja.vista = "cobro"), setTab("caja"))],
  [
    "🔒",
    "Cierre de caja de hoy",
    "caja",
    "cierre cerrar caja cuadre arqueo cuadrar",
    () => ((caja.vista = "cierre"), (caja.cierre = todayStr()), setTab("caja")),
  ],
  ["➕", "Nuevo pago", "pagos", "nuevo pago registrar pago otra fecha", ir("pagos", "nuevo")],
  [
    "⚡",
    "Pagos viejos (varios a la vez)",
    "pagos",
    "pagos viejos atrasados inscripciones lote varios",
    ir("pagos", "lote"),
  ],
  ["📋", "Lista de pagos y recibos", "pagos", "recibos lista pagos reimprimir buscar recibo", ir("pagos", "lista")],
  ["💱", "Tasa BCV", "caja", "tasa bcv dolar cambio", () => abrirModal({ tipo: "tasa" }), "tasa"],
  ["🔔", "Cobranza (avisar por WhatsApp)", "cobranza", "cobranza whatsapp recordatorio avisar morosos deudas"],
  [
    "⚙️",
    "Cuotas del año y estructura de costos",
    "cobranza",
    "cuotas costos estructura mensualidad recargo inscripcion precio",
  ],
  ["👨‍🎓", "Estudiantes", "estudiantes", "estudiantes alumnos matricula fichas"],
  [
    "🆕",
    "Nuevo estudiante",
    "estudiantes",
    "nuevo estudiante inscribir alumno registrar estudiante",
    () => (setTab("estudiantes"), abrirModal({ tipo: "nuevo-estudiante" })),
  ],
  [
    "📉",
    "Registrar un gasto",
    "finanzas",
    "gasto nuevo gasto egreso compra factura pagar servicio",
    () => (setTab("finanzas"), abrirModal({ tipo: "nuevo-finanza", subtipo: "gasto" })),
  ],
  [
    "📈",
    "Registrar un ingreso",
    "finanzas",
    "ingreso nuevo ingreso donacion entrada",
    () => (setTab("finanzas"), abrirModal({ tipo: "nuevo-finanza", subtipo: "ingreso" })),
  ],
  [
    "📒",
    "Libro de ingresos y egresos (contador)",
    "finanzas",
    "libro contador ingresos egresos excel",
    ir("finanzas", "libro"),
  ],
  [
    "🧾",
    "Cuentas por pagar",
    "finanzas",
    "cuentas por pagar vencimientos luz agua alquiler proveedores",
    ir("finanzas", "porpagar"),
  ],
  [
    "🏦",
    "Conciliación bancaria",
    "finanzas",
    "conciliacion banco estado de cuenta bancario",
    ir("finanzas", "conciliacion"),
  ],
  ["💹", "Flujo de caja del año", "finanzas", "flujo caja finanzas resumen", ir("finanzas", "flujo")],
  ["👷", "Personal", "nomina", "personal trabajadores empleados profesores docentes nomina", ir("nomina", "lista")],
  ["📅", "Nómina del mes (pagar)", "nomina", "pagar nomina quincena sueldos salarios", ir("nomina", "mes")],
  ["🗓️", "Asistencia del personal", "nomina", "asistencia faltas retardos personal", ir("nomina", "asistencia")],
  ["📚", "Clases y horarios", "nomina", "clases horarios materias profesores choques", ir("nomina", "clases")],
  ["📊", "Tablero financiero", "reportes", "reportes tablero indicadores cobranza morosidad"],
  [
    "🔮",
    "Flujo de caja proyectado",
    "reportes",
    "proyeccion flujo proyectado futuro ganancias perdidas reserva",
    ir("reportes", null, irA(".flujo-proyectado")),
  ],
  [
    "🧮",
    "Simulador de mensualidad",
    "reportes",
    "simulador aumento mensualidad precio",
    ir("reportes", null, irA(".simulador")),
  ],
  [
    "🗓️",
    "Resumen quincenal",
    "reportes",
    "resumen quincenal quincena",
    ir("reportes", null, irA(".resumen-quincenal")),
  ],
  ["📈", "Gráficas", "graficas", "graficas graficos"],
  ["📝", "Notas y boletines", "notas", "notas boletines calificaciones"],
  [
    "📋",
    "Sábana de notas (media general)",
    "notas",
    "sabana sabanas notas consejo seccion evaluaciones definitiva",
    () => ((filtros.notasVista = "sabana"), setTab("notas")),
  ],
  ["📥", "Importar matrícula desde Excel", "importar", "importar excel matricula"],
  ["💾", "Respaldo", "config", "respaldo copia seguridad backup", ir("config", "anio")],
  ["📲", "Avisos al teléfono", "config", "avisos notificaciones telefono celular alertas", ir("config", "avisos")],
  ["🕵️", "Bitácora (quién borró qué)", "config", "bitacora borrados quien borro auditoria", ir("config", "bitacora")],
  ["👨‍🏫", "Cuentas de los docentes", "config", "docentes cuentas usuarios contrasena", ir("config", "docentes")],
  ["🏫", "Datos de la institución", "config", "institucion rif director datos colegio", ir("config", "institucion")],
  [
    "🎓",
    "Año escolar (cierre y pasar de grado)",
    "config",
    "ano escolar cierre de ano nuevo ano pasar de grado promocion",
    ir("config", "anio"),
  ],
].map(([icono, titulo, tab, claves, fn, modal]) => ({
  icono,
  titulo,
  tab,
  claves: nB(titulo + " " + claves),
  fn: fn || (() => setTab(tab)),
  modal,
}));
const accionPermitida = (a) =>
  pestanaPermitida(a.tab) || (a.modal && rolUsuario === "administradora" && MODALES_ADMINISTRADORA.includes(a.modal));

// ---- Respuestas a preguntas
function lineasMetodo(lista) {
  const tm = totalesMetodo(lista);
  return METODOS.filter(([m]) => tm[m].usd > 0)
    .map(([m, etq]) => `<div class="busq-linea"><span>${etq}</span><span>${txtMetodo(tm[m])}</span></div>`)
    .join("");
}
function respuestasBusq(n) {
  const r = [],
    per = periodoBusq(n),
    grado = gradoBusq(n),
    dir = esDirector(),
    hoy = todayStr();
  const quiere = (re) => re.test(n);
  const pDe = (p) => p && p.fecha >= per.desde && p.fecha <= per.hasta;
  const periodo = per || { desde: hoy, hasta: hoy, nombre: "hoy" };
  const unDia = periodo.desde === periodo.hasta;

  // ¿Cuánto se cobró?
  if (
    quiere(/cobr|recaud|ingres|entr[oa]|vendi|cuanto se|cuanto hay|caja de|pagaron/) &&
    !quiere(/debe|deud|mora|no (ha|han) pagado|sin pagar/)
  ) {
    if (!dir && !unDia)
      r.push({
        icono: "🔒",
        titulo: "Lo cobrado de varios días solo lo ve el director",
        sub: "Puedes ver el de un día: «cobrado hoy», «cobrado ayer» o «cobrado el 15/10».",
        acciones: [],
      });
    else {
      const l = pagos.filter((p) => p.fecha >= periodo.desde && p.fecha <= periodo.hasta);
      const recibos = new Set(l.map((p) => p.factura || p.id)).size;
      const otros = dir
        ? finanzas.filter((f) => f.tipo === "ingreso" && f.fecha >= periodo.desde && f.fecha <= periodo.hasta)
        : [];
      const totOtros = r2(otros.reduce((s, f) => s + (f.monto || 0), 0));
      r.push({
        icono: "💰",
        titulo: "Cobrado " + periodo.nombre + ": " + fmt(l.reduce((s, p) => s + (p.total || 0), 0)),
        sub: recibos + " recibo" + (recibos !== 1 ? "s" : "") + (totOtros ? " · otros ingresos " + fmt(totOtros) : ""),
        detalle: lineasMetodo(l),
        acciones: unDia
          ? [
              {
                etq: "Ver el cierre de caja",
                fn: () => ((caja.vista = "cierre"), (caja.cierre = periodo.desde), setTab("caja")),
              },
              {
                etq: "Ver los recibos",
                fn: () => (setTab("pagos"), (filtros.fecha = periodo.desde), renderTabContent()),
              },
            ]
          : [{ etq: "Ver el libro", fn: ir("finanzas", "libro") }],
      });
    }
  }
  // ¿Cuánto se gastó? / ¿Cómo vamos?
  if (dir && quiere(/gast|egres|sali[oa]|pague|pagamos|compr/)) {
    const g = finanzas.filter((f) => f.tipo === "gasto" && f.fecha >= periodo.desde && f.fecha <= periodo.hasta);
    const cat = {};
    g.forEach((f) => (cat[f.categoria || "Otros"] = r2((cat[f.categoria || "Otros"] || 0) + (f.monto || 0))));
    r.push({
      icono: "📉",
      titulo: "Gastos " + periodo.nombre + ": " + fmt(g.reduce((s, f) => s + (f.monto || 0), 0)),
      sub: g.length + " registro" + (g.length !== 1 ? "s" : ""),
      detalle: Object.entries(cat)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([c, m]) => `<div class="busq-linea"><span>${escHtml(c)}</span><span>${fmt(m)}</span></div>`)
        .join(""),
      acciones: [{ etq: "Ver los gastos", fn: ir("finanzas", "gastos") }],
    });
  }
  if (dir && quiere(/balance|ganancia|perdida|utilidad|resultado|como vamos|como va|como estamos|quedo|sobra/)) {
    const pr = per || { desde: hoy.slice(0, 8) + "01", hasta: hoy, nombre: "este mes" };
    const en = (f) => f.fecha >= pr.desde && f.fecha <= pr.hasta;
    const cobrado = r2(pagos.filter(en).reduce((s, p) => s + (p.total || 0), 0));
    const ingresos = r2(finanzas.filter((f) => f.tipo === "ingreso" && en(f)).reduce((s, f) => s + (f.monto || 0), 0));
    const gastos = r2(finanzas.filter((f) => f.tipo === "gasto" && en(f)).reduce((s, f) => s + (f.monto || 0), 0));
    const res = r2(cobrado + ingresos - gastos);
    r.push({
      icono: res >= 0 ? "✅" : "⚠️",
      titulo: "Resultado " + pr.nombre + ": " + (res >= 0 ? "sobran " : "faltan ") + fmt(Math.abs(res)),
      sub:
        "Cobrado " + fmt(cobrado) + (ingresos ? " + otros ingresos " + fmt(ingresos) : "") + " − gastos " + fmt(gastos),
      acciones: [
        { etq: "Flujo proyectado", fn: ir("reportes", null, irA(".flujo-proyectado")) },
        { etq: "Tablero", fn: () => setTab("reportes") },
      ],
    });
  }
  // ¿Quién debe? (y de qué grado); inscripciones pendientes
  if (quiere(/\b(deb|debe|deben|mora|moros|deud|pendient|atrasad|no (ha|han) pagado|sin pagar)/)) {
    if (quiere(/inscrip/) && cobCfgActiva()) {
      const sin = estudiantes
        .filter(activo)
        .filter((e) => !grado || e.grado === grado)
        .map((e) => ({ e, c: calcCuotas(e) }))
        .filter((x) => x.c && x.c.inscripcion && x.c.inscripcion.pendiente > 0.004);
      r.push({
        icono: "🎓",
        titulo: sin.length + " sin la inscripción completa" + (grado ? " en " + grado : ""),
        sub: "Deben " + fmt(sin.reduce((s, x) => s + x.c.inscripcion.pendiente, 0)) + " de inscripción",
        acciones: [{ etq: "Registrarlas en Pagos viejos", fn: ir("pagos", "lote") }],
      });
    } else {
      const deben = estudiantes
        .filter(enMora)
        .filter((e) => !grado || e.grado === grado)
        .map((e) => ({ e, d: deudaDe(e) }))
        .sort((a, b) => b.d - a.d);
      r.push({
        icono: "⚠️",
        titulo: deben.length + " deben o tienen mora" + (grado ? " en " + grado : ""),
        sub:
          "Total adeudado: " +
          fmt(deben.reduce((s, x) => s + x.d, 0)) +
          (deben.length > 8 ? " · los 8 que más deben:" : ""),
        acciones: pestanaPermitida("cobranza") ? [{ etq: "Ir a Cobranza", fn: () => setTab("cobranza") }] : [],
        siguen: deben.slice(0, 8).map(({ e }) => itemEstudiante(e)),
      });
    }
  }
  if (quiere(/al dia|al saldo|solvente|no deben|estan pagados/)) {
    const act = estudiantes.filter(activo).filter((e) => !grado || e.grado === grado);
    const al = act.filter((e) => !enMora(e)).length;
    r.push({
      icono: "✅",
      titulo: al + " de " + act.length + " estudiantes están al día" + (grado ? " en " + grado : ""),
      sub: act.length - al + " deben o tienen mora",
      acciones: [],
    });
  }
  // Tasa BCV
  if (quiere(/\b(tasa|dolar|bcv)\b/)) {
    const t = tasaDe(per && unDia ? periodo.desde : hoy);
    r.push({
      icono: "💱",
      titulo: t
        ? "Tasa BCV" +
          (t.exacta ? " del " : " (la última, del ") +
          fechaCorta(t.fecha) +
          (t.exacta ? "" : ")") +
          ": Bs. " +
          fmtTasa(t.valor)
        : "No hay tasa BCV cargada para ese día",
      sub: t ? "Bs. por $1 de referencia" : "Cárgala con el botón 💱",
      acciones: [{ etq: tasaHoy() ? "Ver las tasas" : "Cargar la tasa", fn: () => abrirModal({ tipo: "tasa" }) }],
    });
  }
  // Nómina
  if (dir && quiere(/nomina|sueldo|salario|personal cuesta|cuanto pago/)) {
    const act = trabajadoresActivos(),
      ym = hoy.slice(0, 7);
    const pagado = r2(
      finanzas
        .filter((f) => f.tipo === "gasto" && f.categoria === "Nómina" && (f.fecha || "").startsWith(ym))
        .reduce((s, f) => s + (f.monto || 0), 0)
    );
    r.push({
      icono: "👷",
      titulo: "Nómina al mes: " + fmt(act.reduce((s, t) => s + devengadoMensual(t), 0)),
      sub: act.length + " trabajadores activos · pagado este mes: " + fmt(pagado),
      acciones: [{ etq: "Nómina del mes", fn: ir("nomina", "mes") }],
    });
  }
  // Cuentas por pagar
  if (dir && quiere(/por pagar|vence|vencid|facturas pendientes/)) {
    const c = resumenCuentasPagar();
    r.push({
      icono: "🧾",
      titulo: c.pendientes.length + " cuentas por pagar: " + fmt(c.total),
      sub:
        (c.vencidas.length ? c.vencidas.length + " vencidas (" + fmt(c.totalVencidas) + ") · " : "") +
        c.semana.length +
        " vencen esta semana",
      acciones: [{ etq: "Ver cuentas por pagar", fn: ir("finanzas", "porpagar") }],
    });
  }
  // ¿Qué pasó? ¿Quién hizo qué?
  if (
    dir &&
    quiere(/actividad|que hizo|que hicieron|hizo|quien (registr|cobr|borr|elimin)|movimientos|que paso|borr|elimin/)
  ) {
    r.push(actividadBusq(periodo, personaBusq(n)));
  }
  if (!dir && !r.length && quiere(/gast|egres|balance|ganancia|como vamos|nomina|sueldo|por pagar|hizo|actividad|borr/))
    r.push({
      icono: "🔒",
      titulo: "Eso lo ve solo el director",
      sub: "Tú puedes buscar estudiantes, recibos, lo cobrado de un día y quién debe.",
      acciones: [],
    });
  return r;
}
// Lo que se hizo en un período: cobros, ingresos y gastos registrados, y lo borrado (bitácora)
function actividadBusq(per, persona) {
  if (bitacoraLista === null) cargarBitacora().then(() => modalActual && modalActual.tipo === "buscar" && pintarBusq());
  const hora = (x) =>
    x && x.timestamp && x.timestamp.seconds
      ? new Date(x.timestamp.seconds * 1000).toLocaleTimeString("es-VE", { hour: "2-digit", minute: "2-digit" })
      : "";
  const en = (f) => f && f >= per.desde && f <= per.hasta;
  const de = (correo) => !persona || correo === persona;
  const ev = [];
  const recibos = new Map();
  pagos
    .filter((p) => en(p.fecha) && de(p.registradoPor))
    .forEach((p) => {
      const k = p.factura || p.id,
        x = recibos.get(k) || { p, total: 0 };
      x.total = r2(x.total + (p.total || 0));
      recibos.set(k, x);
    });
  recibos.forEach(({ p, total }, k) =>
    ev.push({
      orden: (p.timestamp && p.timestamp.seconds) || 0,
      fecha: p.fecha,
      hora: hora(p),
      por: p.registradoPor,
      texto: "Cobró " + k + " a " + p.nombre + " · " + fmt(total),
    })
  );
  finanzas
    .filter((f) => en(f.fecha) && de(f.registradoPor))
    .forEach((f) =>
      ev.push({
        orden: (f.timestamp && f.timestamp.seconds) || 0,
        fecha: f.fecha,
        hora: hora(f),
        por: f.registradoPor,
        texto:
          (f.tipo === "ingreso" ? "Registró un ingreso: " : "Registró un gasto: ") +
          (f.descripcion || f.categoria || "") +
          " · " +
          fmt(f.monto || 0),
      })
    );
  (bitacoraLista || [])
    .filter((b) => en(b.fecha) && de(b.por))
    .forEach((b) =>
      ev.push({
        orden: (b.cuando && b.cuando.seconds) || 0,
        fecha: b.fecha,
        hora: hora({ timestamp: b.cuando }),
        por: b.por,
        texto: "🗑️ Borró: " + (b.resumen || b.docId),
      })
    );
  ev.sort((a, b) => b.orden - a.orden || (b.fecha || "").localeCompare(a.fecha || ""));
  const quien = persona ? nombreUsuario(persona) : "todos";
  return {
    icono: "🕵️",
    titulo:
      "Actividad " +
      per.nombre +
      (persona ? " · " + quien : "") +
      ": " +
      ev.length +
      " movimiento" +
      (ev.length !== 1 ? "s" : ""),
    sub: bitacoraLista === null ? "Cargando lo borrado…" : ev.length > 15 ? "Los 15 más recientes:" : "",
    detalle: ev
      .slice(0, 15)
      .map(
        (x) =>
          `<div class="busq-linea"><span>${escHtml(x.texto)}</span><span>${escHtml(x.hora || fechaCorta(x.fecha))}${persona ? "" : " · " + escHtml(nombreUsuario(x.por) || "—")}</span></div>`
      )
      .join(""),
    acciones: [{ etq: "Ver la bitácora", fn: ir("config", "bitacora") }],
  };
}

// ---- Registros
function itemEstudiante(e) {
  const d = deudaDe(e),
    acciones = [];
  if (pestanaPermitida("caja"))
    acciones.push({ etq: "💳 Cobrar", fn: () => ((caja.vista = "cobro"), setTab("caja"), cajaElegir(e.id)) });
  acciones.push({ etq: "🧾 Estado de cuenta", fn: () => imprimirEstadoCuenta(e.id) });
  if (esDirector())
    acciones.push({
      etq: "👁 Ficha",
      fn: () => (setTab("estudiantes"), abrirModal({ tipo: "ver-estudiante", id: e.id })),
    });
  return {
    icono: "👨‍🎓",
    titulo: escHtml(e.nombre),
    sub: [
      escHtml(e.grado || "Sin grado"),
      e.cedula ? "C.I. " + escHtml(e.cedula) : "",
      e.acudiente ? "👤 " + escHtml(e.acudiente) : "",
    ]
      .filter(Boolean)
      .join(" · "),
    monto:
      e.estado === "retirado"
        ? `<span class="badge badge-gray">Retirado</span>`
        : d > 0
          ? `<span class="badge badge-red">Debe ${fmt(d)}</span>`
          : `<span class="badge badge-green">Al día</span>`,
    acciones,
  };
}
function estudiantesBusq(n, qDig) {
  const palabras = n.split(" ").filter((w) => w.length >= 2);
  if (!palabras.length && qDig.length < 4) return [];
  return estudiantes
    .map((e) => {
      const texto = nB([e.nombre, e.acudiente].filter(Boolean).join(" "));
      const digitos = [e.cedula, e.cedulaAcudiente, e.telefono, e.telefonoAcudiente].map(soloDigitosB).join(" ");
      let puntos = 0;
      if (qDig.length >= 4 && digitos.includes(qDig)) puntos = 3;
      else if (palabras.length && palabras.every((w) => texto.split(" ").some((t) => t.startsWith(w))))
        puntos = texto.startsWith(n) ? 2 : 1;
      return { e, puntos };
    })
    .filter((x) => x.puntos > 0)
    .sort(
      (a, b) =>
        b.puntos - a.puntos ||
        (a.e.estado === "retirado") - (b.e.estado === "retirado") ||
        a.e.nombre.localeCompare(b.e.nombre, "es")
    )
    .slice(0, 6)
    .map((x) => itemEstudiante(x.e));
}
function recibosBusq(n, qDig) {
  if (qDig.length < 3) return [];
  const vistos = new Map();
  pagos.forEach((p) => {
    const k = p.factura || p.id;
    if (vistos.has(k)) return (vistos.get(k).total = r2(vistos.get(k).total + (p.total || 0)));
    const porNumero = soloDigitosB(p.factura).endsWith(qDig) && (qDig.length >= 3 || /fac|recibo/.test(n));
    const porRef = qDig.length >= 4 && refsTransferencia(p).some((r) => mismaReferencia(r, qDig, 4));
    if (porNumero || porRef) vistos.set(k, { p, total: p.total || 0, porRef });
  });
  return [...vistos.values()].slice(0, 5).map(({ p, total, porRef }) => ({
    icono: "🧾",
    titulo: escHtml(p.factura || "Recibo") + " · " + escHtml(p.nombre),
    sub:
      escHtml(fechaCorta(p.fecha)) +
      " · " +
      escHtml(p.metodo || "") +
      (porRef ? " · ref. " + escHtml(p.referencia || "") : ""),
    monto: `<strong>${fmt(total)}</strong>`,
    acciones: [{ etq: "Abrir el recibo", fn: () => abrirModal({ tipo: "recibo", pago: p }) }],
  }));
}
function trabajadoresBusq(n, qDig) {
  if (!esDirector()) return [];
  const palabras = n.split(" ").filter((w) => w.length >= 2);
  return trabajadores
    .filter((t) => {
      if (qDig.length >= 4 && soloDigitosB(t.cedula).includes(qDig)) return true;
      const texto = nB(t.nombre + " " + (t.cargo || ""));
      return palabras.length && palabras.every((w) => texto.split(" ").some((x) => x.startsWith(w)));
    })
    .slice(0, 4)
    .map((t) => ({
      icono: "👷",
      titulo: escHtml(t.nombre),
      sub: escHtml(t.cargo || "") + (t.activo === false ? " · ya no trabaja aquí" : ""),
      acciones: [
        { etq: "👁 Ficha", fn: () => (setTab("nomina"), abrirModal({ tipo: "ver-trabajador", id: t.id })) },
        ...(t.activo === false
          ? []
          : [{ etq: "💵 Pagar", fn: () => (setTab("nomina"), abrirModal({ tipo: "pago-nomina", trabId: t.id })) }]),
      ],
    }));
}
function accionesBusq(n) {
  const palabras = n
    .split(" ")
    .filter((w) => w.length >= 2 && !/^(de|del|la|el|los|las|un|una|en|al|que|como|para)$/.test(w));
  if (!palabras.length) return [];
  return ACCIONES_BUSQ.filter(accionPermitida)
    .map((a) => ({ a, n: palabras.filter((w) => a.claves.split(" ").some((c) => c.startsWith(w))).length }))
    .filter((x) => x.n === palabras.length || (palabras.length > 2 && x.n >= palabras.length - 1))
    .sort((x, y) => y.n - x.n)
    .slice(0, 5)
    .map(({ a }) => ({ icono: a.icono, titulo: escHtml(a.titulo), sub: "", acciones: [{ etq: "Abrir", fn: a.fn }] }));
}

// ---- Pantalla
const SUGERENCIAS_BUSQ = {
  director: [
    "cómo vamos este mes",
    "quién debe en 1er año",
    "cobrado hoy",
    "gastos de septiembre",
    "qué hizo la secretaria hoy",
    "inscripciones pendientes",
    "cuentas por pagar",
    "tasa",
  ],
  administradora: ["cobrado hoy", "quién debe", "cierre de caja", "tasa", "pagos viejos", "nuevo pago"],
};
function seccionesBusq(q) {
  const n = nB(q),
    qDig = soloDigitosB(q);
  if (!n) return [];
  const respuestas = respuestasBusq(n);
  const s = [];
  // «nuevo gasto», «registrar un ingreso», «abrir la bitácora»: primero la acción
  const acc = accionesBusq(n);
  const comando = /^(nuevo|nueva|registrar|abrir|crear|agregar|anotar|ir a|ver|imprimir|hacer)\b/.test(n);
  if (comando && acc.length) s.push({ titulo: "Ir a", items: acc });
  if (respuestas.length) {
    const items = [];
    respuestas.forEach((x) => items.push(x, ...(x.siguen || [])));
    s.push({ titulo: "Respuesta", items });
  }
  const est = estudiantesBusq(n, qDig);
  if (est.length) s.push({ titulo: "Estudiantes", items: est });
  const rec = recibosBusq(n, qDig);
  if (rec.length) s.push({ titulo: "Recibos", items: rec });
  const tra = trabajadoresBusq(n, qDig);
  if (tra.length) s.push({ titulo: "Personal", items: tra });
  if (!comando && acc.length) s.push({ titulo: "Ir a", items: acc });
  return s;
}
function htmlResultadosBusq() {
  _busqItems = [];
  const secciones = seccionesBusq(busq.q);
  if (!busq.q.trim())
    return `<div class="busq-vacio"><div class="busq-ayuda">Escribe el nombre o la cédula de un estudiante, un número de recibo o de referencia, lo que quieres hacer, o pregunta algo. Por ejemplo:</div>
      <div class="busq-chips">${(SUGERENCIAS_BUSQ[rolUsuario] || [])
        .map((t) => `<button class="stab" onclick="busqPoner(${escHtml(JSON.stringify(t))})">${escHtml(t)}</button>`)
        .join("")}</div></div>`;
  if (!secciones.length)
    return `<div class="busq-vacio"><div class="empty-icon">🔍</div><div class="busq-ayuda">No encontré nada con «${escHtml(busq.q)}». Prueba con el nombre de un estudiante, «cobrado hoy» o «quién debe».</div></div>`;
  return secciones
    .map(
      (sec) =>
        `<div class="busq-seccion">${escHtml(sec.titulo)}</div>` +
        sec.items
          .map((it) => {
            const i = _busqItems.push(it) - 1;
            const conAccion = it.acciones.length > 0;
            return `<div class="busq-item ${conAccion ? "" : "info"} ${i === busq.sel ? "activo" : ""}" data-i="${i}" ${conAccion ? `onclick="busqEjecutar(${i},0)"` : ""}>
        <div class="busq-ico">${it.icono}</div>
        <div class="busq-txt"><div class="busq-tit">${it.titulo}</div>${it.sub ? `<div class="busq-sub">${it.sub}</div>` : ""}${it.detalle ? `<div class="busq-detalle">${it.detalle}</div>` : ""}
          ${it.acciones.length > 1 ? `<div class="busq-acc">${it.acciones.map((a, j) => `<button class="btn btn-gray btn-sm" onclick="event.stopPropagation();busqEjecutar(${i},${j})">${escHtml(a.etq)}</button>`).join("")}</div>` : ""}</div>
        ${it.monto ? `<div class="busq-monto">${it.monto}</div>` : ""}
      </div>`;
          })
          .join("")
    )
    .join("");
}
function renderModalBuscar() {
  return `<div class="modal-bg buscador-bg" onclick="if(event.target===this)cerrarModal()"><div class="modal buscador" role="dialog" aria-label="Buscar">
    <div class="buscador-cabeza"><span aria-hidden="true">🔍</span>
      <input id="busq-q" class="buscador-inp" placeholder="Busca o pregunta algo…" autocomplete="off" value="${escHtml(busq.q)}" oninput="busqEscribir(this.value)" onkeydown="busqTecla(event)"/>
      <button class="buscador-cerrar" onclick="cerrarModal()" title="Cerrar (Esc)">✕</button></div>
    <div id="busq-res" class="buscador-res">${htmlResultadosBusq()}</div>
    <div class="buscador-pie">↑ ↓ para moverte · Enter para abrir · Esc para cerrar · Ctrl+K para volver a abrir</div>
  </div></div>`;
}
function pintarBusq() {
  const r = document.getElementById("busq-res");
  if (r) r.innerHTML = htmlResultadosBusq();
}
function busqEscribir(v) {
  busq.q = v;
  busq.sel = 0;
  clearTimeout(_busqTimer);
  _busqTimer = setTimeout(pintarBusq, 120);
}
function busqPoner(t) {
  busq.q = t;
  busq.sel = 0;
  const i = document.getElementById("busq-q");
  if (i) {
    i.value = t;
    i.focus();
  }
  pintarBusq();
}
function busqTecla(e) {
  const conAccion = _busqItems.map((it, i) => (it.acciones.length ? i : -1)).filter((i) => i >= 0);
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault();
    if (!conAccion.length) return;
    const pos = conAccion.indexOf(busq.sel);
    const sig = e.key === "ArrowDown" ? Math.min(conAccion.length - 1, pos + 1) : Math.max(0, pos - 1);
    busq.sel = conAccion[pos < 0 ? 0 : sig];
    document
      .querySelectorAll(".busq-item")
      .forEach((el) => el.classList.toggle("activo", Number(el.dataset.i) === busq.sel));
    const el = document.querySelector(`.busq-item[data-i="${busq.sel}"]`);
    if (el) el.scrollIntoView({ block: "nearest" });
  } else if (e.key === "Enter") {
    e.preventDefault();
    clearTimeout(_busqTimer);
    pintarBusq();
    const i = _busqItems[busq.sel] && _busqItems[busq.sel].acciones.length ? busq.sel : conAccion[0];
    if (i != null) busqEjecutar(i, 0);
  }
}
function busqEjecutar(i, j) {
  const it = _busqItems[i],
    a = it && it.acciones[j];
  if (!a) return;
  modalActual = null;
  a.fn();
  if (modalActual && modalActual.tipo === "buscar") return;
  if (!modalActual) render();
}

// Barra de Inicio: abre el buscador
const htmlBarraBuscar = () =>
  `<button class="barra-buscar" onclick="abrirBuscador()"><span>🔍</span><span class="barra-buscar-txt">¿Qué necesitas? Busca un estudiante, un recibo o pregunta algo…</span><kbd>Ctrl K</kbd></button>`;
