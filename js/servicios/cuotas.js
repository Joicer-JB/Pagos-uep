// Mora automática: cuotas mensuales, recargos y deuda de cada estudiante según la configuración de cobranza.

// config/cobranza = {primerMes:"YYYY-MM", cuotas:N, diaVence:D}. Cada mes se genera la cuota de cada estudiante (= su mensualidad).
// Una cuota se considera vencida pasado el día D. Los pagos con concepto "Mensualidad" se aplican desde la cuota más antigua.
// La deuda manual anterior (estado "mora" + monto) se mantiene aparte y se suma.
// RECARGO (opcional): config.recargo = monto en $ (0 = no se cobra). Se suma UNA vez por cada cuota que no se pagó a tiempo
// (sigue vencida, o se pagó después del día de vencimiento). No se acumula mes a mes. Se paga con concepto «Recargo».
// config.recargoDesde = fecha; solo cuotas que vencen desde ese día generan recargo (evita cobrar con efecto retroactivo).
// El estudiante marcado «sinRecargo» (exonerado) nunca lo genera.
// ESTRUCTURA DE COSTOS (opcional): config.costos = {plan: {inscripcion, mensualidad}} por plan (inicial a tiempo
// completo o medio tiempo, primaria, media general), más config.carnet y config.papeleria. La INSCRIPCIÓN es un solo
// pago obligatorio por año que incluye la inscripción de su nivel, el carnet QR y la papelería; en la Caja se cobra
// junto con el primer mes (septiembre). La cubren los pagos de «Inscripción» desde config.inscripcionDesde.
// El estudiante marcado «sinInscripcion» (exonerado) solo paga el carnet y la papelería.
let cobCfg = null;
const PLANES_COSTO = [
  ["inicialCompleto", "Inicial · tiempo completo"],
  ["inicialMedio", "Inicial · medio tiempo"],
  ["primaria", "Primaria"],
  ["media", "Media general"],
];
const CONCEPTO_CARNET = "Carnet y papelería"; // lo que paga al inscribirse quien no paga inscripción (exonerado)
// Montos con los que se llena el formulario la primera vez (estructura de costos 2026-2027)
const COSTOS_SUGERIDOS = {
  costos: {
    inicialCompleto: { inscripcion: 45, mensualidad: 45 },
    inicialMedio: { inscripcion: 40, mensualidad: 40 },
    primaria: { inscripcion: 45, mensualidad: 45 },
    media: { inscripcion: 55, mensualidad: 55 },
  },
  carnet: 13,
  papeleria: 3,
};
// Plan de costos de un estudiante: por su nivel y, en inicial, por su horario
function planDe(e) {
  const n = getNivel(e.grado);
  return n === "preescolar" ? (e.horario === "medio" ? "inicialMedio" : "inicialCompleto") : n;
}
const costoDe = (e) => (cobCfg && cobCfg.costos && cobCfg.costos[planDe(e)]) || null;
const montoCfg = (v) => Math.max(0, r2(Number(v) || 0));
// Lee config/cobranza (cuotas, día de vencimiento y recargo). Sin configuración no hay mora automática
async function cargarCobCfg() {
  cobCfg = null;
  try {
    const s = await db.collection("config").doc("cobranza").get();
    if (s.exists) {
      const d = s.data();
      if (/^\d{4}-\d{2}$/.test(d.primerMes || "") && d.cuotas > 0)
        cobCfg = {
          primerMes: d.primerMes,
          cuotas: Math.min(24, Number(d.cuotas)),
          diaVence: Math.min(28, Math.max(1, Number(d.diaVence) || 5)),
          recargo: Math.max(0, r2(Number(d.recargo) || 0)),
          recargoDesde: /^\d{4}-\d{2}-\d{2}$/.test(d.recargoDesde || "") ? d.recargoDesde : "",
          costos: d.costos
            ? Object.fromEntries(
                PLANES_COSTO.map(([k]) => [
                  k,
                  {
                    inscripcion: montoCfg((d.costos[k] || {}).inscripcion),
                    mensualidad: montoCfg((d.costos[k] || {}).mensualidad),
                  },
                ])
              )
            : null,
          carnet: montoCfg(d.carnet),
          papeleria: montoCfg(d.papeleria),
          inscripcionDesde: /^\d{4}-\d{2}-\d{2}$/.test(d.inscripcionDesde || "")
            ? d.inscripcionDesde
            : sumarMeses(d.primerMes, -3) + "-01",
        };
    }
  } catch (e) {
    console.warn("cobranza cfg:", e.message);
  }
}
// La mora automática solo aplica al año actual (en años anteriores se ve el historial tal cual)
const cobCfgActiva = () => !!cobCfg && !soloLectura();
// Índice de pagos por estudiante (id, cédula, nombre) para no recorrer todos los pagos por cada estudiante
let _pagoIdx = { ref: null, n: -1, refEst: null, nEst: -1 };
function idxPagos() {
  const I0 = _pagoIdx;
  if (I0.ref === pagos && I0.n === pagos.length && I0.refEst === estudiantes && I0.nEst === estudiantes.length)
    return I0;
  const I = {
    ref: pagos,
    n: pagos.length,
    refEst: estudiantes,
    nEst: estudiantes.length,
    porId: new Map(),
    porCed: new Map(),
    porNom: new Map(),
  };
  const existe = new Set(estudiantes.map((e) => e.id));
  const put = (m, k, p) => {
    if (!k) return;
    let a = m.get(k);
    if (!a) {
      a = [];
      m.set(k, a);
    }
    a.push(p);
  };
  pagos.forEach((p) => {
    // Un pago con el id de un estudiante que existe es solo de ese estudiante. Los pagos viejos (sin id) o de
    // fichas que ya no existen se reconocen por cédula o nombre, como antes.
    if (p.estId && existe.has(p.estId)) put(I.porId, p.estId, p);
    else {
      put(I.porId, p.estId, p);
      put(I.porCed, p.cedula, p);
      put(I.porNom, (p.nombre || "").toLowerCase(), p);
    }
  });
  return (_pagoIdx = I);
}
// Pagos de un estudiante. Cuentan los que traen su id (o el de una copia que se fusionó en su ficha: «fusionados»)
// y los pagos sin id con su misma cédula o nombre. Así un homónimo o un hermano con la misma cédula no se lleva
// los pagos de otro.
function pagosDeEstudiante(e) {
  const I = idxPagos(),
    set = new Set();
  const agregar = (a) => a && a.forEach((p) => set.add(p));
  [e.id, ...(e.fusionados || [])].forEach((id) => agregar(I.porId.get(id)));
  if (e.cedula) agregar(I.porCed.get(e.cedula));
  agregar(I.porNom.get((e.nombre || "").toLowerCase()));
  return [...set];
}
// Estado de cuenta de un estudiante: cuotas del año, cuánto se pagó de cada una, cuáles vencieron,
// recargos y saldo a favor. Los pagos de «Mensualidad» se aplican primero a los meses que indican (los cobros de
// Caja guardan «cuotas»: {"2026-10": 20}) y lo demás se reparte desde la cuota más antigua.
// Devuelve null si no hay mora automática o el estudiante no está activo.
function calcCuotas(e, hoy) {
  hoy = hoy || todayStr();
  if (!cobCfgActiva() || !activo(e)) return null;
  const m = Number(e.mensualidad) || 0;
  const lista = [];
  for (let k = 0; k < cobCfg.cuotas; k++) {
    const ym = sumarMeses(cobCfg.primerMes, k);
    if (e.cuotaDesde && ym < e.cuotaDesde) continue;
    lista.push({ ym, mes: nombreMesYM(ym), vence: ym + "-" + String(cobCfg.diaVence).padStart(2, "0"), monto: m });
  }
  const desde = cobCfg.primerMes + "-01";
  const delEst = pagosDeEstudiante(e).filter((p) => p.fecha && p.fecha >= desde);
  // Inscripción del año (si hay estructura de costos): inscripción de su nivel + carnet QR + papelería, en un solo
  // pago obligatorio desde el inicio del año. Se paga junto con el primer mes: si un pago de «Inscripción» trae más
  // de lo que vale (p. ej. 106 $ = 61 de inscripción + 45 de septiembre), lo demás paga el primer mes.
  const primera = lista.find((c) => c.monto > 0) || null;
  const costo = costoDe(e);
  let inscripcion = null,
    sobranteIns = null;
  if (costo) {
    const partes = {
      inscripcion: e.sinInscripcion ? 0 : costo.inscripcion,
      carnet: cobCfg.carnet || 0,
      papeleria: cobCfg.papeleria || 0,
    };
    const monto = r2(partes.inscripcion + partes.carnet + partes.papeleria);
    const pagosIns = pagosDeEstudiante(e)
      .filter((p) => p.fecha && p.fecha >= (cobCfg.inscripcionDesde || desde))
      .filter((p) => p.concepto === "Inscripción" || p.concepto === CONCEPTO_CARNET);
    const pagadoIns = r2(pagosIns.reduce((s, p) => s + (p.total || 0), 0));
    const ab = r2(Math.min(monto, Math.max(0, pagadoIns)));
    // Los exonerados de inscripción pagan solo carnet y papelería: así se llama y así se guarda
    const concepto = partes.inscripcion > 0 ? "Inscripción" : CONCEPTO_CARNET;
    if (monto > 0) inscripcion = { concepto, monto, partes, pagado: ab, pendiente: r2(monto - ab) };
    const sobra = r2(pagadoIns - Math.max(monto, 0));
    if (sobra > 0.004 && primera) {
      const ultimo = pagosIns
        .map((p) => p.fecha)
        .sort()
        .pop();
      sobranteIns = { fecha: ultimo, total: sobra, cuotas: { [primera.ym]: sobra }, concepto: "Mensualidad" };
    }
  }
  // Pagos de mensualidad en orden cronológico: sirven para saber CUÁNDO quedó pagada cada cuota (¿a tiempo o tarde?)
  const pagosM = delEst
    .filter((p) => p.concepto === "Mensualidad")
    .concat(sobranteIns ? [sobranteIns] : [])
    .sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));
  const pagado = r2(pagosM.reduce((s, p) => s + (p.total || 0), 0));
  // Cada pago, en orden de fecha: primero a los meses que indica y el resto desde la cuota más antigua que se deba.
  // fechaPago = el día en que la cuota quedó completa (para saber si se pagó a tiempo).
  const porMes = new Map(lista.map((c) => [c.ym, c]));
  lista.forEach((c) => {
    c.pagado = 0;
    c.fechaPago = null;
  });
  const aplicar = (c, monto, fecha) => {
    const ab = r2(Math.min(monto, c.monto - c.pagado));
    if (ab <= 0) return 0;
    c.pagado = r2(c.pagado + ab);
    if (c.pagado >= c.monto - 0.004) c.fechaPago = fecha;
    return ab;
  };
  let resto = 0; // lo que sobra después de cubrir todas las cuotas (saldo a favor)
  pagosM.forEach((p) => {
    let queda = r2(Math.max(0, p.total || 0));
    Object.entries(p.cuotas || {}).forEach(([ym, m]) => {
      const c = porMes.get(ym);
      if (c) queda = r2(queda - aplicar(c, Math.min(Number(m) || 0, queda), p.fecha));
    });
    for (const c of lista) {
      if (queda <= 0.004) break;
      queda = r2(queda - aplicar(c, queda, p.fecha));
    }
    resto = r2(resto + queda);
  });
  lista.forEach((c) => {
    c.pendiente = r2(c.monto - c.pagado);
    c.vencida = c.vence < hoy;
  });
  // Recargo por cuota no pagada a tiempo. El primer mes pagado junto con la inscripción (el mismo día) no lo
  // genera: se paga al inscribirse, aunque sea después del día de vencimiento.
  const rec = cobCfg.recargo > 0 && !e.sinRecargo ? cobCfg.recargo : 0;
  const diasInscripcion = new Set(
    pagosDeEstudiante(e)
      .filter((p) => p.fecha >= (cobCfg.inscripcionDesde || desde))
      .filter((p) => p.concepto === "Inscripción" || p.concepto === CONCEPTO_CARNET)
      .map((p) => p.fecha)
  );
  lista.forEach((c) => {
    const tarde = c.pendiente <= 0.004 ? !!c.fechaPago && c.fechaPago > c.vence : c.vencida;
    const conInscripcion = c === primera && c.pendiente <= 0.004 && diasInscripcion.has(c.fechaPago);
    c.recargo =
      rec > 0 && c.monto > 0 && tarde && !conInscripcion && (!cobCfg.recargoDesde || c.vence >= cobCfg.recargoDesde)
        ? rec
        : 0;
  });
  const conRecargo = lista.filter((c) => c.recargo > 0);
  const recargoTotal = r2(conRecargo.reduce((s, c) => s + c.recargo, 0));
  const recargoPagado = r2(delEst.filter((p) => p.concepto === "Recargo").reduce((s, p) => s + (p.total || 0), 0));
  const recargoPend = r2(Math.max(0, recargoTotal - recargoPagado));
  const vencidas = lista.filter((c) => c.vencida);
  const saldo = r2(vencidas.reduce((s, c) => s + c.pendiente, 0));
  const obligPend = inscripcion ? inscripcion.pendiente : 0;
  return {
    inscripcion,
    obligPend,
    primera, // el primer mes que paga (se cobra con la inscripción)
    lista,
    pagado,
    saldo,
    recargoTotal,
    recargoPagado,
    recargoPend,
    nRecargos: conRecargo.length,
    total: r2(saldo + recargoPend + obligPend),
    pendientes: vencidas.filter((c) => c.pendiente > 0.004),
    aFavor: r2(Math.max(0, resto)),
    proxima: lista.find((c) => !c.vencida && c.pendiente > 0.004) || null,
  };
}
// Cuota del año escolar que corresponde a un mes por su nombre («Diciembre» → "2026-12"); "" si no hay
function ymDeMes(nombreMes) {
  const i = MESES.indexOf(nombreMes) + 1;
  if (!i || !cobCfgActiva()) return "";
  for (let k = 0; k < cobCfg.cuotas; k++) {
    const ym = sumarMeses(cobCfg.primerMes, k);
    if (Number(ym.slice(5, 7)) === i) return ym;
  }
  return "";
}
// «inscripción $ 55 + carnet QR $ 13 + papelería $ 3»
const textoPartesInscripcion = (ins) =>
  [
    ins.partes.inscripcion > 0 ? "inscripción " + fmt(ins.partes.inscripcion) : "",
    ins.partes.carnet > 0 ? "carnet QR " + fmt(ins.partes.carnet) : "",
    ins.partes.papeleria > 0 ? "papelería " + fmt(ins.partes.papeleria) : "",
  ]
    .filter(Boolean)
    .join(" + ");
// Deuda anterior escrita a mano en la ficha (estado «mora» + monto)
const deudaManual = (e) => (e.estado === "mora" ? e.moraMonto || 0 : 0);
// Deuda total de un estudiante: cuotas vencidas + recargos pendientes + deuda anterior
function deudaDe(e) {
  const c = calcCuotas(e);
  return r2((c ? c.total : 0) + deudaManual(e));
}
// ¿El estudiante debe algo? (los retirados no cuentan)
const enMora = (e) => e.estado !== "retirado" && (deudaDe(e) > 0 || e.estado === "mora");
// Texto que explica qué debe un estudiante: «Mensualidad: Septiembre 2026 · Recargo …»
function conceptoDeE(e) {
  const c = calcCuotas(e),
    p = [];
  if (c && c.inscripcion && c.inscripcion.pendiente > 0.004) p.push(c.inscripcion.concepto);
  if (c && c.pendientes.length) p.push("Mensualidad: " + c.pendientes.map((q) => q.mes).join(", "));
  if (c && c.recargoPend > 0)
    p.push("Recargo por mora (" + c.nRecargos + (c.nRecargos === 1 ? " mes" : " meses") + ")");
  if (deudaManual(e) > 0 || (e.estado === "mora" && e.moraConcepto)) p.push(e.moraConcepto || "Deuda anterior");
  return p.join(" · ");
}
// Tabla del estado de cuenta (cuota por cuota) que se muestra en la ficha del estudiante
function htmlEstadoCuenta(e) {
  const c = calcCuotas(e);
  if (!c) return "";
  const tv = tasaHoyValor();
  const bsl = (u) => (tv ? `<div style="font-size:0.65rem;color:#888">${fmtBs(r2(u * tv))}</div>` : "");
  const est = (q) =>
    q.pendiente <= 0.004
      ? `<span class="badge badge-green">✅ Pagada</span>`
      : q.pagado > 0
        ? `<span class="badge badge-gold">🟡 Abonada (falta ${fmt(q.pendiente)})</span>`
        : q.vencida
          ? `<span class="badge badge-red">🔴 Vencida</span>`
          : `<span class="badge badge-gray">⏳ Por vencer</span>`;
  return `<div class="card" style="padding:0.75rem;margin:0.75rem 0">
    <div style="font-size:0.62rem;color:#003366;text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:6px">📅 Estado de cuenta · mensualidades</div>
    ${
      !(e.mensualidad > 0)
        ? `<div style="font-size:0.8rem;color:#888">Sin mensualidad asignada (no se generan cuotas)</div>`
        : c.lista
            .map(
              (q) => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:0.35rem 0;border-bottom:1px dashed #eee;font-size:0.8rem">
      <div><strong>${escHtml(q.mes)}</strong><div style="font-size:0.65rem;color:#888">vence ${fechaCorta(q.vence)}</div></div>
      <div style="text-align:right">${fmt(q.monto)}${bsl(q.monto)}${est(q)}${q.recargo > 0 ? `<div style="font-size:0.65rem;color:#c0392b;font-weight:700">+ recargo ${fmt(q.recargo)}${q.fechaPago ? ` <span style="font-weight:400">(pagada el ${fechaCorta(q.fechaPago)})</span>` : ""}</div>` : ""}</div></div>`
            )
            .join("")
    }
    ${
      c.inscripcion
        ? `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:0.35rem 0;border-bottom:1px dashed #eee;font-size:0.8rem">
      <div><strong>Inscripción</strong><div style="font-size:0.65rem;color:#888">${escHtml(textoPartesInscripcion(c.inscripcion))}</div></div>
      <div style="text-align:right">${fmt(c.inscripcion.monto)}${est({ ...c.inscripcion, vencida: true })}</div></div>`
        : ""
    }
    <div style="display:flex;justify-content:space-between;margin-top:6px;font-size:0.8rem"><span>Pagado en mensualidades</span><strong style="color:#1a9e5c">${fmt(c.pagado)}</strong></div>
    <div style="display:flex;justify-content:space-between;font-size:0.85rem"><span>Saldo vencido</span><strong style="color:${c.saldo > 0 ? "#e53e3e" : "#1a9e5c"}">${fmt(c.saldo)}${tv && c.saldo > 0 ? " · " + fmtBs(r2(c.saldo * tv)) : ""}</strong></div>
    ${
      c.obligPend > 0
        ? `<div style="display:flex;justify-content:space-between;font-size:0.85rem"><span>Inscripción pendiente</span><strong style="color:#e53e3e">${fmt(c.obligPend)}</strong></div>`
        : ""
    }
    ${
      c.recargoTotal > 0 || c.obligPend > 0
        ? `${c.recargoTotal > 0 ? `<div style="display:flex;justify-content:space-between;font-size:0.85rem"><span>Recargos por mora (${fmt(c.recargoTotal)}${c.recargoPagado > 0 ? " · pagado " + fmt(Math.min(c.recargoPagado, c.recargoTotal)) : ""})</span><strong style="color:${c.recargoPend > 0 ? "#e53e3e" : "#1a9e5c"}">${fmt(c.recargoPend)}</strong></div>` : ""}
    <div style="display:flex;justify-content:space-between;font-size:0.9rem;border-top:1px solid #eee;margin-top:3px;padding-top:3px"><span>Total a pagar</span><strong style="color:${c.total > 0 ? "#e53e3e" : "#1a9e5c"}">${fmt(c.total)}${tv && c.total > 0 ? " · " + fmtBs(r2(c.total * tv)) : ""}</strong></div>`
        : ""
    }
    ${c.aFavor > 0 ? `<div style="display:flex;justify-content:space-between;font-size:0.8rem"><span>Saldo a favor</span><strong style="color:#1a9e5c">${fmt(c.aFavor)}</strong></div>` : ""}
  </div>`;
}
// Guarda la configuración de cuotas y recargo (solo el director)
async function guardarCobCfg() {
  if (rolUsuario !== "director") {
    alert("Solo el director puede cambiar las cuotas");
    return;
  }
  const primerMes = document.getElementById("cc-primer").value;
  const n = parseInt(document.getElementById("cc-n").value, 10),
    dia = parseInt(document.getElementById("cc-dia").value, 10);
  if (!/^\d{4}-\d{2}$/.test(primerMes)) {
    alert("Elige el mes de la primera cuota");
    return;
  }
  if (!(n >= 1 && n <= 24)) {
    alert("El número de cuotas debe estar entre 1 y 24");
    return;
  }
  if (!(dia >= 1 && dia <= 28)) {
    alert("El día de vencimiento debe estar entre 1 y 28");
    return;
  }
  // Recargo opcional: casilla apagada o monto 0 = no se cobra
  const activar = !!(document.getElementById("cc-rec-on") || {}).checked;
  const monto = activar ? r2(parseFmt((document.getElementById("cc-rec-monto") || {}).value || "0")) : 0;
  if (activar && !(monto > 0 && monto <= 1000)) {
    alert("Escribe el monto del recargo en $ (ej: 5)");
    return;
  }
  const incluirVencidas = !!(document.getElementById("cc-rec-viejas") || {}).checked;
  // Sin retroactivo: al activarlo por primera vez, solo cuentan las cuotas que venzan desde hoy (salvo que lo marques)
  const recargoDesde =
    monto > 0 ? (incluirVencidas ? "" : (cobCfg && cobCfg.recargo > 0 && cobCfg.recargoDesde) || todayStr()) : "";
  // Estructura de costos: inscripción y mensualidad por plan, carnet y papelería
  const val = (id) => r2(parseFmt((document.getElementById(id) || {}).value || "0"));
  const costos = Object.fromEntries(
    PLANES_COSTO.map(([k]) => [k, { inscripcion: val("cc-ins-" + k), mensualidad: val("cc-men-" + k) }])
  );
  const carnet = val("cc-carnet"),
    papeleria = val("cc-papeleria");
  const inscripcionDesde = (document.getElementById("cc-ins-desde") || {}).value || sumarMeses(primerMes, -3) + "-01";
  if (
    [...Object.values(costos).flatMap((c) => [c.inscripcion, c.mensualidad]), carnet, papeleria].some(
      (v) => !(v >= 0) || v > 10000
    )
  ) {
    alert("Revisa los montos de la estructura de costos");
    return;
  }
  try {
    const nueva = {
      primerMes,
      cuotas: n,
      diaVence: dia,
      recargo: monto,
      recargoDesde,
      costos,
      carnet,
      papeleria,
      inscripcionDesde,
    };
    await db.collection("config").doc("cobranza").set(nueva);
    cobCfg = nueva;
    renderTabContent();
    await ofrecerActualizarMensualidades();
  } catch (e) {
    alert("No se pudo guardar: " + e.message);
  }
}
// Estudiantes activos cuya mensualidad no es la de su plan en la estructura de costos
function mensualidadesDistintas() {
  if (!cobCfg || !cobCfg.costos) return [];
  return estudiantes
    .filter(activo)
    .map((e) => ({ e, nueva: (costoDe(e) || {}).mensualidad || 0 }))
    .filter((x) => x.nueva > 0 && Math.abs((Number(x.e.mensualidad) || 0) - x.nueva) > 0.004);
}
// Después de guardar la estructura: ofrece poner a cada estudiante la mensualidad de su plan
async function ofrecerActualizarMensualidades() {
  const cambios = mensualidadesDistintas();
  if (!cambios.length) return;
  const ejemplos = cambios
    .slice(0, 5)
    .map((x) => `• ${x.e.nombre}: ${fmt(Number(x.e.mensualidad) || 0)} → ${fmt(x.nueva)}`)
    .join("\n");
  if (
    !confirm(
      `${cambios.length} estudiante(s) tienen una mensualidad distinta a la de su nivel:\n${ejemplos}${cambios.length > 5 ? "\n…" : ""}\n\n` +
        "¿Poner a todos la mensualidad de la estructura de costos?\n(Si alguno tiene un monto especial, corrígelo después en su ficha.)"
    )
  )
    return;
  for (let i = 0; i < cambios.length; i += 400) {
    const lote = db.batch();
    cambios
      .slice(i, i + 400)
      .forEach((x) => lote.update(db.collection("estudiantes").doc(x.e.id), { mensualidad: x.nueva }));
    await lote.commit();
  }
  cambios.forEach((x) => (x.e.mensualidad = x.nueva));
  renderTabContent();
  alert(`✅ Se actualizó la mensualidad de ${cambios.length} estudiante(s).`);
}
// Panel de configuración de cuotas (el director lo edita; los demás ven un resumen)
function htmlCfgCuotas() {
  const c = cobCfg;
  if (rolUsuario !== "director")
    return c
      ? `<div class="alert-item alert-info">📅 Mora automática activa · ${c.cuotas} cuotas desde ${nombreMesYM(c.primerMes)} · vencen el día ${c.diaVence}${c.recargo > 0 ? " · recargo " + fmt(c.recargo) + " por cuota atrasada" : ""}</div>`
      : `<div class="alert-item alert-mora">⚠️ La mora automática no está configurada (el director debe activarla)</div>`;
  const mesDef = (escCfg && escCfg.actual.inicio ? escCfg.actual.inicio : todayStr()).slice(0, 7);
  return `<details class="card" ${c ? "" : "open"} style="padding:0.85rem">
    <summary style="cursor:pointer;font-weight:700;color:${c ? "#003366" : "#c0392b"}">${c ? "⚙️ Cuotas del año · mora automática activa" : "⚠️ Activa la mora automática"}</summary>
    <div class="form-row" style="margin-top:0.6rem">
      <div class="field"><label class="field-label">Primera cuota (mes)</label><input class="inp" type="month" id="cc-primer" value="${c ? c.primerMes : mesDef}"/></div>
      <div class="field"><label class="field-label">N° de cuotas del año</label><input class="inp" type="number" id="cc-n" min="1" max="24" value="${c ? c.cuotas : 10}"/></div>
    </div>
    <div class="field" style="margin-top:0.4rem"><label class="field-label">Vence el día (de cada mes)</label><input class="inp" type="number" id="cc-dia" min="1" max="28" value="${c ? c.diaVence : 5}"/></div>
    <div style="font-size:0.72rem;color:#666;margin:0.4rem 0">Cada cuota es la mensualidad de cada estudiante y se considera vencida pasado ese día. Los pagos con concepto «Mensualidad» se aplican a la cuota más antigua.</div>
    <div style="background:#fffbea;border-radius:10px;padding:0.7rem;margin:0.5rem 0">
      <label style="display:flex;gap:0.5rem;align-items:center;font-weight:700;font-size:0.82rem;color:#7a5b00"><input type="checkbox" id="cc-rec-on" ${c && c.recargo > 0 ? "checked" : ""} onchange="document.getElementById('cc-rec-box').style.display=this.checked?'block':'none'"/> Cobrar recargo por mensualidad atrasada</label>
      <div id="cc-rec-box" style="display:${c && c.recargo > 0 ? "block" : "none"};margin-top:0.5rem">
        <div class="field"><label class="field-label">Recargo por cada mensualidad no pagada a tiempo ($)</label><input class="inp" id="cc-rec-monto" inputmode="decimal" placeholder="5,00" value="${c && c.recargo > 0 ? String(c.recargo).replace(".", ",") : "5,00"}" oninput="fmtInput(this)"/></div>
        <label style="display:flex;gap:0.5rem;align-items:center;font-size:0.76rem;margin-top:0.4rem"><input type="checkbox" id="cc-rec-viejas" ${c && c.recargo > 0 && !c.recargoDesde ? "checked" : ""}/> Incluir también las cuotas que ya vencieron (por defecto solo las que venzan desde hoy)</label>
        <div style="font-size:0.7rem;color:#666;margin-top:0.4rem">Se suma una sola vez por cada cuota atrasada (no crece mes a mes). Se cobra con el concepto «Recargo». Puedes exonerar a un estudiante en su ficha.</div>
      </div>
    </div>
    ${htmlCfgCostos()}
    <button class="btn btn-primary btn-sm" onclick="guardarCobCfg()">💾 Guardar</button>
  </details>`;
}
// Formulario de la estructura de costos del año (dentro de la configuración de cuotas)
function htmlCfgCostos() {
  const c = cobCfg && cobCfg.costos ? cobCfg : COSTOS_SUGERIDOS;
  const v = (x) => String(x || 0).replace(".", ",");
  const campo = (id, valor) =>
    `<input class="inp" id="${id}" inputmode="decimal" value="${v(valor)}" oninput="fmtInput(this)" style="padding:0.45rem"/>`;
  const desde = (cobCfg && cobCfg.inscripcionDesde) || "";
  return `<div style="background:#f0f4ff;border-radius:10px;padding:0.7rem;margin:0.5rem 0">
    <div style="font-weight:700;font-size:0.82rem;color:#003366">💲 Estructura de costos del año${cobCfg && cobCfg.costos ? "" : " <span style='color:#c0392b'>(sin guardar)</span>"}</div>
    <div style="font-size:0.7rem;color:#666;margin:0.2rem 0 0.5rem">La inscripción es obligatoria una vez al año e <strong>incluye el carnet QR y la papelería</strong>. En la Caja se cobra junto con el primer mes (septiembre). Si no está pagada, sale como deuda.</div>
    <table style="width:100%;font-size:0.76rem;border-collapse:collapse">
      <thead><tr><th style="text-align:left">Nivel</th><th>Inscripción $</th><th>Mensualidad $</th></tr></thead>
      <tbody>${PLANES_COSTO.map(
        ([k, nombre]) =>
          `<tr><td style="padding:0.2rem 0.3rem 0.2rem 0">${nombre}</td><td style="padding:0.2rem">${campo("cc-ins-" + k, c.costos[k].inscripcion)}</td><td style="padding:0.2rem">${campo("cc-men-" + k, c.costos[k].mensualidad)}</td></tr>`
      ).join("")}</tbody>
    </table>
    <div class="form-row" style="margin-top:0.4rem">
      <div class="field"><label class="field-label">Carnet QR ($)</label>${campo("cc-carnet", c.carnet)}</div>
      <div class="field"><label class="field-label">Papelería ($)</label>${campo("cc-papeleria", c.papeleria)}</div>
    </div>
    <div class="field" style="margin-top:0.4rem"><label class="field-label">Cuentan las inscripciones pagadas desde</label>
      <input class="inp" type="date" id="cc-ins-desde" value="${escHtml(desde)}"/>
      <div style="font-size:0.68rem;color:#888;margin-top:2px">Vacío = 3 meses antes de la primera cuota (para incluir las inscripciones cobradas en vacaciones).</div></div>
  </div>`;
}
const activo = (e) => e.estado !== "retirado" && !e.graduado; // inscrito este año (ni retirado ni graduado)
// Fecha de inicio del año escolar actual ("" si se está viendo un año anterior)
const baseAnio = () => (escCfg && !soloLectura() ? escCfg.actual.inicio : "");
