// 💰 Pagos → «⚡ Pagos viejos»: para ponerse al día con pagos que se cobraron y no se registraron (por ejemplo, las
// inscripciones de septiembre). Sale la lista de quienes deben la inscripción (o la mensualidad de un mes); se marca a
// quienes pagaron, con su fecha, forma de pago y referencia, y se registran todos de una vez. Cada uno queda con su
// recibo correlativo, igual que en la Caja (cajaDocsCobro + registrarCobro), y con la tasa BCV de su fecha.
// La fecha y la forma de pago se repiten de un estudiante al siguiente. Lo marcado se guarda en el equipo hasta
// registrarlo, por si se cierra la página.

const LOTE_BORRADOR = "lotePagosBorrador";
const loteNuevo = () => ({
  modo: "ins", // "ins": inscripción · "mes": mensualidad de un mes
  ym: "",
  conPrimerMes: true, // la inscripción con el primer mes (septiembre), como en la Caja
  fecha: "",
  metodo: "Dólares Efectivo",
  busq: "",
  grado: "",
  marcados: {}, // estId → { monto, fecha, metodo, ref }
});
let lote = null,
  loteResultado = null,
  loteGuardando = "";
function loteEstado() {
  if (!lote) {
    lote = loteNuevo();
    try {
      const b = JSON.parse(localStorage.getItem(LOTE_BORRADOR) || "null");
      if (b && typeof b === "object" && b.marcados) lote = { ...lote, ...b };
    } catch (e) {}
  }
  return lote;
}
function guardarBorradorLote() {
  try {
    if (Object.keys(lote.marcados).length) localStorage.setItem(LOTE_BORRADOR, JSON.stringify(lote));
    else localStorage.removeItem(LOTE_BORRADOR);
  } catch (e) {}
}
// Meses de cuota del año hasta el mes en curso
function mesesLote() {
  if (!cobCfg) return [];
  const hoy = todayStr().slice(0, 7),
    l = [];
  for (let k = 0; k < cobCfg.cuotas; k++) {
    const ym = sumarMeses(cobCfg.primerMes, k);
    if (ym <= hoy) l.push(ym);
  }
  return l;
}

// Lo que debe un estudiante de lo que se está registrando: { total, lineas (como las de la Caja), texto } o null
function loteDeuda(e) {
  const c = calcCuotas(e);
  if (!c) return null;
  const L = loteEstado();
  if (L.modo === "mes") {
    const q = c.lista.find((x) => x.ym === L.ym && x.pendiente > 0.004);
    if (!q) return null;
    return {
      total: q.pendiente,
      texto: "Mensualidad " + q.mes + (q.pagado > 0 ? " · ya abonó " + fmt(q.pagado) : ""),
      lineas: [
        {
          concepto: "Mensualidad",
          monto: q.pendiente,
          desc: "Mensualidad " + q.mes,
          mes: MESES[Number(q.ym.slice(5, 7)) - 1],
          ym: q.ym,
        },
      ],
    };
  }
  const ins = c.inscripcion && c.inscripcion.pendiente > 0.004 ? c.inscripcion : null;
  if (!ins) return null;
  const pm = L.conPrimerMes && c.primera && c.primera.pendiente > 0.004 ? c.primera : null;
  const anio = escCfg && escCfg.actual ? " " + escCfg.actual.nombre : "";
  const lineas = [
    {
      concepto: ins.concepto,
      monto: ins.pendiente,
      desc: ins.concepto + anio + " (" + textoPartesInscripcion(ins) + ")",
      mes: "",
      ym: "",
    },
  ];
  if (pm)
    lineas.push({
      concepto: "Mensualidad",
      monto: pm.pendiente,
      desc: "Mensualidad " + pm.mes,
      mes: MESES[Number(pm.ym.slice(5, 7)) - 1],
      ym: pm.ym,
    });
  return {
    total: r2(lineas.reduce((s, l) => s + l.monto, 0)),
    texto: textoPartesInscripcion(ins) + (pm ? " + " + pm.mes.split(" ")[0] + " " + fmt(pm.pendiente) : ""),
    lineas,
  };
}
// Si pagó menos de lo que debe: primero la inscripción y después el mes (lo que no alcanza queda como abono)
function lineasLote(deuda, monto) {
  let queda = r2(monto);
  const out = [];
  for (const l of deuda.lineas) {
    if (queda <= 0.004) break;
    const toma = r2(Math.min(queda, l.monto));
    out.push(toma < l.monto - 0.004 ? { ...l, monto: toma, desc: "Abono a " + l.desc } : l);
    queda = r2(queda - toma);
  }
  return out.map((l) => ({ ...l, desc: l.desc + " — " + fmt(l.monto) }));
}

function filasLote() {
  const L = loteEstado(),
    q = sinAcento((L.busq || "").toLowerCase());
  return estudiantes
    .filter(activo)
    .map((e) => ({ e, deuda: loteDeuda(e) }))
    .filter((x) => x.deuda)
    .filter((x) => !L.grado || x.e.grado === L.grado)
    .filter(
      (x) =>
        !q ||
        sinAcento(
          [x.e.nombre, x.e.cedula, x.e.acudiente, x.e.cedulaAcudiente].filter(Boolean).join(" ").toLowerCase()
        ).includes(q)
    )
    .sort((a, b) => ordenGrados(a.e.grado || "", b.e.grado || "") || a.e.nombre.localeCompare(b.e.nombre, "es"));
}

function renderLotePagos() {
  const L = loteEstado();
  if (!cobCfgActiva())
    return `<div class="card"><div class="alert-item alert-info"><div>Para registrar pagos viejos en lote hace falta que el director guarde las cuotas del año (🔔 Cobranza → ⚙️ Cuotas del año). Mientras tanto usa <strong>➕ Nuevo Pago</strong>.</div></div></div>`;
  const meses = mesesLote();
  if (L.modo === "mes" && !meses.includes(L.ym)) L.ym = meses[0] || "";
  const grados = [
    ...new Set(
      estudiantes
        .filter(activo)
        .map((e) => e.grado)
        .filter(Boolean)
    ),
  ].sort(ordenGrados);
  const hoy = todayStr();
  return `
  ${loteResultado ? htmlResultadoLote() : ""}
  <div class="card lote-cabecera">
    <div class="card-title"><div class="card-bar"></div><h2>⚡ Pagos viejos</h2></div>
    <div class="ayuda">Para ponerte al día con pagos que ya se cobraron y no se registraron. Marca a quienes pagaron, revisa la fecha y la forma de pago, y pulsa <strong>Registrar</strong>: cada uno queda con su recibo y con la tasa BCV de su fecha. La fecha y la forma de pago se repiten en el siguiente que marques.</div>
    <div class="stabs" style="margin:0.6rem 0 0.4rem">
      <button class="stab ${L.modo === "ins" ? "active" : ""}" onclick="loteSet('modo','ins')">🎓 Inscripciones</button>
      <button class="stab ${L.modo === "mes" ? "active" : ""}" onclick="loteSet('modo','mes')">📅 Mensualidad</button>
    </div>
    <div class="form-row">
      ${
        L.modo === "mes"
          ? `<div class="field"><label class="field-label">Mes</label><select class="inp" id="lote-ym" onchange="loteSet('ym',this.value)">${meses.map((ym) => `<option value="${ym}" ${ym === L.ym ? "selected" : ""}>${escHtml(nombreMesYM(ym))}</option>`).join("")}</select></div>`
          : `<div class="field"><label class="field-label">¿Con el primer mes?</label><label class="lote-opcion"><input type="checkbox" ${L.conPrimerMes ? "checked" : ""} onchange="loteSet('conPrimerMes',this.checked)"/> Inscripción + ${escHtml(nombreMesYM(cobCfg.primerMes).split(" ")[0].toLowerCase())}, como en la Caja</label></div>`
      }
      <div class="field"><label class="field-label">Fecha del pago</label><input class="inp" type="date" id="lote-fecha" max="${hoy}" value="${escHtml(L.fecha)}" onchange="loteSet('fecha',this.value)"/>${htmlTasaLote(L.fecha)}</div>
      <div class="field"><label class="field-label">Forma de pago</label><select class="inp" id="lote-metodo" onchange="loteSet('metodo',this.value)">${METODOS.map(([m]) => `<option value="${m}" ${L.metodo === m ? "selected" : ""}>${escHtml(ETIQ_METODO[m] || m)}</option>`).join("")}</select></div>
    </div>
    <div style="display:flex;gap:0.4rem;flex-wrap:wrap;margin-top:0.2rem">
      <input class="inp" id="lote-busq" style="flex:2;min-width:160px" placeholder="🔍 Estudiante, cédula o representante..." value="${escHtml(L.busq)}" oninput="loteBuscar(this.value)"/>
      <select class="inp" style="flex:1;min-width:120px" onchange="loteSet('grado',this.value)"><option value="">Todos los grados</option>${grados.map((g) => `<option value="${escHtml(g)}" ${L.grado === g ? "selected" : ""}>${escHtml(g)}</option>`).join("")}</select>
    </div>
  </div>
  ${
    L.modo === "ins" && !(cobCfg && cobCfg.costos)
      ? `<div class="alert-item alert-info"><div>Falta la <strong>estructura de costos</strong> del año (la guarda el director en 🔔 Cobranza → ⚙️ Cuotas del año): sin ella no se sabe cuánto es la inscripción de cada nivel. Mientras tanto, registra las mensualidades.</div></div>`
      : `<div id="lote-lista">${htmlListaLote()}</div>`
  }
  <div id="lote-barra">${htmlBarraLote()}</div>`;
}
function htmlTasaLote(fecha) {
  if (!fecha) return `<div class="nota-campo">Elige el día en que pagó</div>`;
  const t = tasaDe(fecha);
  return t
    ? `<div class="nota-campo" style="color:${t.exacta ? "#1a9e5c" : "#b8860b"}">💱 Tasa ${t.exacta ? "" : "del " + fechaCorta(t.fecha) + " "}Bs. ${fmtTasa(t.valor)}</div>`
    : `<div class="nota-campo" style="color:#c0392b">⚠️ No hay tasa BCV de ese día. <a href="#" onclick="abrirModal({tipo:'tasa'});return false">Cargarla</a></div>`;
}
function htmlListaLote() {
  const L = loteEstado(),
    filas = filasLote();
  if (!filas.length)
    return `<div class="empty"><div class="empty-icon">✅</div><p>${L.busq || L.grado ? "Nadie en esta búsqueda debe esto" : L.modo === "ins" ? "Todos tienen su inscripción registrada" : "Nadie debe la mensualidad de " + escHtml(nombreMesYM(L.ym))}</p></div>`;
  return `<div class="list lote">${filas.map(({ e, deuda }) => htmlFilaLote(e, deuda)).join("")}</div>`;
}
function htmlFilaLote(e, deuda) {
  const m = loteEstado().marcados[e.id],
    pideRefM = (x) => x === "Transferencia Bs" || x === "Punto";
  return `<div class="list-item lote-fila ${m ? "marcada" : ""}" data-est="${e.id}">
    <label class="lote-marca">
      <input type="checkbox" ${m ? "checked" : ""} onchange="loteMarcar('${e.id}',this.checked)"/>
      <div style="flex:1;min-width:0">
        <div class="item-name">${escHtml(e.nombre)}</div>
        <div class="item-sub">${escHtml(e.grado) || "Sin grado"}${e.acudiente ? " · 👤 " + escHtml(e.acudiente) : ""}</div>
        <div class="item-sub">${escHtml(deuda.texto)}</div>
      </div>
      <div class="item-amount">${fmt(deuda.total)}</div>
    </label>
    ${
      m
        ? `<div class="lote-detalle">
      <div class="field"><label class="field-label">Pagó ($)</label><input class="inp" inputmode="decimal" value="${escHtml(String(m.monto).replace(".", ","))}" onchange="loteCampo('${e.id}','monto',this.value)"/></div>
      <div class="field"><label class="field-label">Fecha</label><input class="inp" type="date" max="${todayStr()}" value="${escHtml(m.fecha)}" onchange="loteCampo('${e.id}','fecha',this.value)"/></div>
      <div class="field"><label class="field-label">Forma de pago</label><select class="inp" onchange="loteCampo('${e.id}','metodo',this.value)">${METODOS.map(([x]) => `<option value="${x}" ${m.metodo === x ? "selected" : ""}>${escHtml(ETIQ_METODO[x] || x)}</option>`).join("")}</select></div>
      ${pideRefM(m.metodo) ? `<div class="field"><label class="field-label">Referencia</label><input class="inp" inputmode="numeric" value="${escHtml(m.ref || "")}" placeholder="Opcional" onchange="loteCampo('${e.id}','ref',this.value)"/></div>` : ""}
    </div>`
        : ""
    }
  </div>`;
}
function htmlBarraLote() {
  const L = loteEstado(),
    ids = Object.keys(L.marcados),
    total = r2(ids.reduce((s, id) => s + (Number(L.marcados[id].monto) || 0), 0));
  if (!ids.length && !loteGuardando) return "";
  return `<div class="lote-barra">
    <div><strong>${ids.length}</strong> marcado${ids.length !== 1 ? "s" : ""} · ${fmt(total)}${loteGuardando ? `<div style="font-size:0.72rem">${escHtml(loteGuardando)}</div>` : ""}</div>
    <div style="display:flex;gap:0.4rem">
      ${loteGuardando ? "" : `<button class="btn btn-gray btn-sm" onclick="loteLimpiar()">Desmarcar todo</button>`}
      <button class="btn btn-success" ${loteGuardando ? "disabled" : ""} onclick="registrarLote()">${loteGuardando ? "Registrando…" : "💾 Registrar " + ids.length + " pago" + (ids.length !== 1 ? "s" : "")}</button>
    </div>
  </div>`;
}
const pintarBarraLote = () => {
  const b = document.getElementById("lote-barra");
  if (b) b.innerHTML = htmlBarraLote();
};

// ---- Acciones
function loteSet(campo, valor) {
  const L = loteEstado();
  if ((campo === "modo" || campo === "ym" || campo === "conPrimerMes") && Object.keys(L.marcados).length) {
    if (
      !confirm("Hay estudiantes marcados sin registrar. Si cambias lo que se está registrando, se desmarcan. ¿Seguir?")
    )
      return renderTabContent();
    L.marcados = {};
  }
  L[campo] = valor;
  guardarBorradorLote();
  renderTabContent();
}
let _loteTimer = null;
function loteBuscar(v) {
  loteEstado().busq = v;
  clearTimeout(_loteTimer);
  _loteTimer = setTimeout(() => {
    const l = document.getElementById("lote-lista");
    if (l) l.innerHTML = htmlListaLote();
  }, 200);
}
function loteMarcar(estId, si) {
  const L = loteEstado();
  if (si) {
    const e = estudiantes.find((x) => x.id === estId),
      d = e && loteDeuda(e);
    if (!d) return;
    L.marcados[estId] = { monto: d.total, fecha: L.fecha, metodo: L.metodo, ref: "" };
  } else delete L.marcados[estId];
  guardarBorradorLote();
  repintarFilaLote(estId);
  pintarBarraLote();
}
function repintarFilaLote(estId) {
  const el = document.querySelector(`.lote-fila[data-est="${estId}"]`),
    e = estudiantes.find((x) => x.id === estId),
    d = e && loteDeuda(e);
  if (el && d) el.outerHTML = htmlFilaLote(e, d);
}
function loteCampo(estId, campo, valor) {
  const L = loteEstado(),
    m = L.marcados[estId];
  if (!m) return;
  if (campo === "monto") m.monto = r2(parseFmt(valor));
  else if (campo === "ref")
    m.ref = String(valor || "")
      .replace(/[^0-9A-Za-z-]/g, "")
      .slice(0, 30);
  else m[campo] = valor;
  // la fecha y la forma de pago de este se usan en el siguiente que se marque
  if (campo === "fecha" || campo === "metodo") L[campo] = valor;
  guardarBorradorLote();
  if (campo === "metodo") repintarFilaLote(estId);
  if (campo === "fecha" || campo === "metodo") {
    const f = document.getElementById("lote-" + campo);
    if (f) f.value = valor;
  }
  pintarBarraLote();
}
function loteLimpiar() {
  if (!confirm("¿Desmarcar a todos?")) return;
  loteEstado().marcados = {};
  guardarBorradorLote();
  renderTabContent();
}

// Revisa todo antes de registrar: devuelve { listos: [...], errores: [texto] }
function revisarLote() {
  const L = loteEstado(),
    hoy = todayStr(),
    inicio = baseAnio(),
    listos = [],
    errores = [],
    sinTasa = new Set(),
    refs = new Map();
  Object.entries(L.marcados).forEach(([id, m]) => {
    const e = estudiantes.find((x) => x.id === id),
      d = e && loteDeuda(e);
    const quien = e ? e.nombre : "Un estudiante";
    if (!d) return errores.push(quien + ": ya no debe esto (¿ya se registró?). Desmárcalo.");
    if (!(m.monto > 0)) return errores.push(quien + ": escribe cuánto pagó.");
    if (m.monto > d.total + 0.004)
      return errores.push(
        quien +
          ": pagó " +
          fmt(m.monto) +
          ", más de lo que debe (" +
          fmt(d.total) +
          "). El resto regístralo aparte en ➕ Nuevo Pago."
      );
    if (!/^\d{4}-\d{2}-\d{2}$/.test(m.fecha || "")) return errores.push(quien + ": falta la fecha del pago.");
    if (m.fecha > hoy) return errores.push(quien + ": la fecha no puede ser futura.");
    if (inicio && m.fecha < inicio) return errores.push(quien + ": la fecha es de un año escolar anterior.");
    const t = tasaDe(m.fecha);
    if (!t) return sinTasa.add(m.fecha);
    if (m.ref) refs.set(m.ref, [...(refs.get(m.ref) || []), quien]);
    listos.push({ e, d, m, tasa: t.valor });
  });
  if (sinTasa.size)
    errores.push(
      "Falta la tasa BCV de: " + [...sinTasa].sort().map(fechaCorta).join(", ") + ". Cárgala con el botón 💱 de arriba."
    );
  const avisos = [];
  refs.forEach((quienes, ref) => {
    if (quienes.length > 1) avisos.push("La referencia " + ref + " está en " + quienes.join(" y "));
    recibosConReferencia(ref).forEach((r) =>
      avisos.push("La referencia " + ref + " ya está en el recibo " + r.factura + " (" + r.nombre + ")")
    );
  });
  return { listos, errores, avisos };
}

async function registrarLote() {
  if (loteGuardando) return;
  if (soloLectura()) return alert("Estás viendo un año anterior (solo consulta).");
  const { listos, errores, avisos } = revisarLote();
  if (errores.length) return alert("Revisa antes de registrar:\n\n• " + errores.join("\n• "));
  if (!listos.length) return;
  const total = r2(listos.reduce((s, x) => s + x.m.monto, 0));
  if (
    avisos.length &&
    !confirm("⚠️ Referencias repetidas:\n\n• " + avisos.join("\n• ") + "\n\n¿Registrar de todos modos?")
  )
    return;
  if (
    !confirm(
      "Se registrarán " +
        listos.length +
        " pago" +
        (listos.length !== 1 ? "s" : "") +
        " por " +
        fmt(total) +
        ", cada uno con su recibo.\n\nUn pago registrado no se puede modificar. ¿Registrar?"
    )
  )
    return;
  const ok = [],
    fallos = [];
  for (let i = 0; i < listos.length; i++) {
    const { e, d, m, tasa } = listos[i];
    loteGuardando = "Registrando " + (i + 1) + " de " + listos.length + "…";
    pintarBarraLote();
    try {
      const base = {
        nombre: e.nombre,
        cedula: e.cedula || "",
        estId: e.id,
        telefono: telDe(e).raw || "",
        fecha: m.fecha,
        tasa,
        origen: "lote",
      };
      const docs = cajaDocsCobro(
        lineasLote(d, m.monto),
        [{ metodo: m.metodo, usd: m.monto, ref: m.ref || "" }],
        base,
        tasa
      );
      const r = await registrarCobro(docs, {
        estId: e.id,
        aplicaDeuda: (x) => !cobCfgActiva() || x.concepto === "Deuda anterior",
      });
      reflejarCobro(e.id, r);
      ok.push({
        nombre: e.nombre,
        grado: e.grado || "",
        factura: r.factura,
        fecha: m.fecha,
        metodo: m.metodo,
        total: m.monto,
      });
      delete lote.marcados[e.id];
    } catch (err) {
      fallos.push(e.nombre + ": " + err.message);
    }
  }
  loteGuardando = "";
  loteResultado = { ok, fallos };
  guardarBorradorLote();
  renderTabContent();
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function htmlResultadoLote() {
  const { ok, fallos } = loteResultado;
  return `<div class="card lote-resultado" style="border-left:4px solid ${fallos.length ? "#e53e3e" : "#1a9e5c"}">
    <div class="card-title"><div class="card-bar"></div><h2>${ok.length ? "✅ " + ok.length + " pago" + (ok.length !== 1 ? "s" : "") + " registrado" + (ok.length !== 1 ? "s" : "") : "⚠️ No se registró nada"}</h2>
      <button class="btn btn-gray btn-sm" style="margin-left:auto" onclick="loteResultado=null;renderTabContent()">✕</button></div>
    ${ok.map((x) => `<div class="info-row"><span>${escHtml(x.factura)} · ${escHtml(x.nombre)} <span style="color:#888">· ${escHtml(fechaCorta(x.fecha))}</span></span><strong>${fmt(x.total)}</strong></div>`).join("")}
    ${fallos.length ? `<div class="alert-item alert-mora" style="margin-top:0.5rem"><div>No se pudieron registrar (siguen marcados):<br/>${fallos.map(escHtml).join("<br/>")}</div></div>` : ""}
    ${ok.length ? `<button class="btn btn-print btn-sm" style="margin-top:0.6rem" onclick="imprimirResultadoLote()">🖨️ Imprimir la lista</button>` : ""}
  </div>`;
}
function imprimirResultadoLote() {
  if (!loteResultado || !loteResultado.ok.length) return;
  const ok = loteResultado.ok,
    w = abrirVentanaImpresion();
  if (!w) return alert("Permite las ventanas emergentes para imprimir");
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>Pagos registrados</title>
  <style>body{font-family:'Segoe UI',Arial,sans-serif;color:#222;padding:1.2rem}h2{color:#003366;font-family:Georgia,serif;margin:0}
  .sub{color:#555;font-size:0.82rem;margin:0.2rem 0 0.8rem}table{width:100%;border-collapse:collapse;font-size:0.78rem}
  th{background:#003366;color:#fff;padding:0.35rem;text-align:left}td{padding:0.35rem;border-bottom:1px solid #ddd}.r{text-align:right}
  tfoot td{font-weight:800;border-top:2px solid #003366}</style></head><body>
  <h2>${escHtml(EMPRESA)}</h2><div class="sub">Pagos registrados el ${escHtml(fechaCorta(todayStr()))} (${ok.length})</div>
  <table><thead><tr><th>Recibo</th><th>Estudiante</th><th>Grado</th><th>Fecha del pago</th><th>Forma de pago</th><th class="r">Monto</th></tr></thead><tbody>
  ${ok.map((x) => `<tr><td>${escHtml(x.factura)}</td><td>${escHtml(x.nombre)}</td><td>${escHtml(x.grado)}</td><td>${escHtml(fechaCorta(x.fecha))}</td><td>${escHtml(ETIQ_METODO[x.metodo] || x.metodo)}</td><td class="r">${fmt(x.total)}</td></tr>`).join("")}
  </tbody><tfoot><tr><td colspan="5">TOTAL</td><td class="r">${fmt(ok.reduce((s, x) => s + x.total, 0))}</td></tr></tfoot></table>
  </body></html>`);
  w.document.close();
  setTimeout(() => w.print(), 400);
}
