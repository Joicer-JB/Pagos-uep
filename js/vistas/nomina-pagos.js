// Nómina: pagar la quincena o el mes, adelantos y préstamos al personal. Ver vistas/nomina.js.

// ---- Formularios: elegir trabajador y período
const opcionesTrabajador = (sel) =>
  `<option value="">-- Seleccionar --</option>` +
  trabajadoresActivos()
    .map(
      (t) =>
        `<option value="${t.id}" ${t.id === sel ? "selected" : ""}>${escHtml(t.nombre)} — ${escHtml(t.cargo) || "Sin cargo"}</option>`
    )
    .join("");
const campoPeriodo = (pref, periodo, onchange) => {
  const x = partesPeriodo(periodo) || partesPeriodo(periodoSugerido(null));
  return `<div class="form-row">
    <div class="field"><label class="field-label">${pref === "ad" ? "A cuenta de" : "Período *"}</label>
      <select class="inp" id="${pref}-tipo" onchange="${onchange}">${Object.entries(TIPOS_PERIODO)
        .map(([k, l]) => `<option value="${k}" ${x.tipo === k ? "selected" : ""}>${l}</option>`)
        .join("")}</select></div>
    <div class="field"><label class="field-label">Mes</label><input class="inp" type="month" id="${pref}-mes" value="${x.ym}" onchange="${onchange}"/></div>
  </div>`;
};
const leerPeriodo = (pref) => {
  const tipo = (document.getElementById(pref + "-tipo") || {}).value,
    ym = (document.getElementById(pref + "-mes") || {}).value;
  return /^\d{4}-\d{2}$/.test(ym || "") && TIPOS_PERIODO[tipo] ? periodoDe(ym, tipo) : "";
};
const campoMoneda = (pref) =>
  `<div class="field"><label class="field-label">¿Cómo se paga?</label><select class="inp" id="${pref}-moneda">${Object.entries(
    ETIQ_MONEDA_NOMINA
  )
    .map(([k, l]) => `<option value="${k}">${l}</option>`)
    .join("")}</select></div>`;

// ---- Pagar nómina: asignaciones del período y deducciones (fija, adelantos, cuota de préstamos, otras)
const filaOtroConcepto = (i) => `<div class="form-row pn-otro" style="margin-bottom:0.4rem">
    <div class="field"><input class="inp" id="pn-otro-n-${i}" placeholder="Concepto (ej: horas extra)" autocomplete="off"/></div>
    <div class="field"><div style="position:relative"><span style="position:absolute;left:0.8rem;top:50%;transform:translateY(-50%);color:#1a9e5c;font-weight:700;font-size:0.8rem">$</span>
      <input class="inp" id="pn-otro-v-${i}" placeholder="0,00" inputmode="decimal" autocomplete="off" style="padding-left:1.8rem" oninput="fmtInput(this);calcNetoNomina()"/></div></div>
  </div>`;
function agregarOtroConcepto() {
  const cont = document.getElementById("pn-otros");
  if (!cont) return;
  const n = cont.querySelectorAll(".pn-otro").length;
  if (n >= 10) {
    alert("Máximo 10 conceptos adicionales por pago");
    return;
  }
  cont.insertAdjacentHTML("beforeend", filaOtroConcepto(n));
  const inp = document.getElementById("pn-otro-n-" + n);
  if (inp) inp.focus();
}
// Lee los conceptos adicionales. Fila vacía = se ignora; con nombre y sin valor (o al revés) = error.
function leerOtrosConceptos() {
  const lista = [];
  let error = "";
  for (let i = 0; ; i++) {
    const elN = document.getElementById("pn-otro-n-" + i),
      elV = document.getElementById("pn-otro-v-" + i);
    if (!elN || !elV) break;
    const nombre = elN.value.trim(),
      monto = parseFmt(elV.value);
    if (nombre && monto > 0) lista.push({ nombre, monto });
    else if (nombre && !monto && !error) error = "Falta el valor del concepto «" + nombre + "»";
    else if (!nombre && monto > 0 && !error) error = "Falta el nombre del concepto de " + fmt(monto);
  }
  return { lista, error };
}
let pnDeducciones = []; // deducciones sugeridas del trabajador (adelantos, préstamos, fija) del formulario abierto
let pnHoras = []; // horas de clase del trabajador: [{concepto, tarifa, horas (sugeridas)}]
let pnDescAuto = "";
function renderModalPagoNomina(m) {
  pnDeducciones = [];
  pnHoras = [];
  pnDescAuto = "";
  const t = trabajadores.find((x) => x.id === (m && m.trabId)) || null;
  const periodo = (m && m.periodo) || periodoSugerido(t);
  return `<div class="modal-bg"><div class="modal">
    <div class="modal-header"><div><h3>💳 Pagar nómina</h3><p>Montos en $ de referencia · se paga en Bs. a la tasa BCV o en $</p></div><button class="modal-close-x" onclick="cerrarModal()">✕</button></div>
    <div class="modal-body">
      <div class="form-grid">
        <div class="field"><label class="field-label">Trabajador *</label>
          <select class="inp" id="pn-trab" onchange="autoFillMontoNomina(this.value)">${opcionesTrabajador(t && t.id)}</select></div>
        ${campoPeriodo("pn", periodo, "autoFillMontoNomina(document.getElementById('pn-trab').value)")}
        <div id="pn-aviso"></div>
        <div id="pn-asist"></div>
        <div class="field"><label class="field-label">Descripción *</label><input class="inp" id="pn-desc" placeholder="Ej: 1ra quincena de Octubre 2026"/></div>
        <div class="form-row">
          <div class="field"><label class="field-label">Fecha de pago *</label><input class="inp" type="date" id="pn-fecha" max="${todayStr()}" value="${todayStr()}" onchange="actualizarTasaCampo('pn',calcNetoNomina)"/></div>
          ${campoMoneda("pn")}
        </div>
        <div class="field-label" style="color:#1a9e5c;margin-top:0.3rem">➕ Asignaciones del período</div>
        <div class="form-row">
          <div class="field"><label class="field-label">Salario base</label>
            <div style="position:relative"><span style="position:absolute;left:1rem;top:50%;transform:translateY(-50%);color:#1a9e5c;font-weight:700">$</span>
            <input class="inp" id="pn-monto" placeholder="0,00" inputmode="decimal" style="padding-left:2rem" oninput="fmtInput(this);calcNetoNomina()"/></div></div>
          <div class="field"><label class="field-label">🍽️ Bono alimentación</label>
            <div style="position:relative"><span style="position:absolute;left:1rem;top:50%;transform:translateY(-50%);color:#1a9e5c;font-weight:700">$</span>
            <input class="inp" id="pn-balim" placeholder="0,00" inputmode="decimal" style="padding-left:2rem" oninput="fmtInput(this);calcNetoNomina()"/></div></div>
        </div>
        <div class="field"><label class="field-label">⭐ Bono productividad</label>
          <div style="position:relative"><span style="position:absolute;left:1rem;top:50%;transform:translateY(-50%);color:#1a9e5c;font-weight:700">$</span>
          <input class="inp" id="pn-bprod" placeholder="0,00" inputmode="decimal" style="padding-left:2rem" oninput="fmtInput(this);calcNetoNomina()"/></div></div>
        <div id="pn-horas"></div>
        <div class="field">
          <label class="field-label">Otros conceptos <span style="font-weight:400;color:#888">(opcional: horas extra, guardias…)</span></label>
          <div id="pn-otros">${[0, 1].map(filaOtroConcepto).join("")}</div>
          <button type="button" class="btn btn-gray btn-sm" onclick="agregarOtroConcepto()">+ Agregar otro concepto</button>
        </div>
        <div class="field-label" style="color:#c0392b;margin-top:0.3rem">➖ Deducciones</div>
        <div id="pn-deds"><div style="font-size:0.78rem;color:#888">Elige el trabajador</div></div>
        <div class="form-row">
          <div class="field"><label class="field-label">Otro descuento ($)</label>
            <div style="position:relative"><span style="position:absolute;left:1rem;top:50%;transform:translateY(-50%);color:#e53e3e;font-weight:700">$</span>
            <input class="inp" id="pn-descuento" placeholder="0,00" inputmode="decimal" style="padding-left:2rem" oninput="fmtInput(this);calcNetoNomina()"/></div></div>
          <div class="field"><label class="field-label">¿Por qué?</label><input class="inp" id="pn-descuento-motivo" placeholder="Ej: inasistencia"/></div>
        </div>
        ${campoTasaHTML("pn", null, "calcNetoNomina()")}
        <div id="pn-neto-box" style="display:none;background:#e8f0fe;border-radius:10px;padding:0.75rem;margin-top:0.25rem">
          <div style="display:flex;justify-content:space-between;font-size:0.82rem;margin-bottom:4px">
            <span style="color:#555">Asignaciones</span><span id="pn-neto-monto" style="color:#1a9e5c;font-weight:700"></span>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:0.82rem;margin-bottom:4px">
            <span style="color:#555">Deducciones</span><span id="pn-neto-desc" style="color:#e53e3e;font-weight:700"></span>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:0.88rem;border-top:1px solid #c5d8f0;padding-top:6px;margin-top:4px">
            <span style="font-weight:700;color:#003366">Neto a entregar (ref.)</span><span id="pn-neto-total" style="font-weight:800;color:#003366;font-size:1rem"></span>
          </div>
          <div id="pn-neto-bs-row" style="display:none;justify-content:space-between;font-size:0.95rem;margin-top:4px">
            <span style="font-weight:700;color:#003366">Total en bolívares</span><span id="pn-neto-bs" style="font-weight:800;color:#003366"></span>
          </div>
        </div>
        <div id="pn-cuenta-campo"></div>
        <div id="pn-err"></div>
        ${casillaDosPorHoja("nomina", "pn-doble")}
      </div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-primary" style="flex:1" onclick="guardarPagoNomina()">✓ Registrar y generar recibo</button>
      <button class="btn btn-gray" onclick="cerrarModal()">Cancelar</button>
    </div>
  </div></div>`;
}
const setValor = (id, v) => {
  const el = document.getElementById(id);
  if (el) el.value = v > 0 ? String(r2(v)).replace(".", ",") : "";
};
// Al elegir trabajador o período: llena lo que le corresponde, sus deducciones y avisa si ese período ya se pagó
function autoFillMontoNomina(trabId) {
  const t = trabajadores.find((w) => w.id === trabId);
  const periodo = leerPeriodo("pn");
  const deds = document.getElementById("pn-deds"),
    aviso = document.getElementById("pn-aviso");
  pnDeducciones = [];
  pnHoras = [];
  if (aviso) aviso.innerHTML = "";
  const horasBox = document.getElementById("pn-horas"),
    cuentaBox = document.getElementById("pn-cuenta-campo");
  if (horasBox) horasBox.innerHTML = "";
  if (cuentaBox) cuentaBox.innerHTML = "";
  if (!t) {
    if (deds) deds.innerHTML = `<div style="font-size:0.78rem;color:#888">Elige el trabajador</div>`;
    return calcNetoNomina();
  }
  const s = sugerenciaPago(t, periodo);
  const de = (c) => (s.asignaciones.find((a) => a.concepto === c) || {}).monto || 0;
  setValor("pn-monto", de("Salario base"));
  setValor("pn-balim", de("Bono alimentación"));
  setValor("pn-bprod", de("Bono productividad"));
  // Horas de clase: las que da normalmente en el período; se cambian por las que trabajó
  pnHoras = s.asignaciones.filter((a) => a.horas);
  if (horasBox && pnHoras.length)
    horasBox.innerHTML = `<label class="field-label">⏱️ Horas trabajadas en el período</label>${pnHoras
      .map(
        (h, i) => `<div class="pn-hora" style="display:flex;gap:0.5rem;align-items:center;margin-bottom:0.35rem">
        <label for="pn-h-${i}" style="flex:1;font-size:0.8rem">${escHtml(h.concepto)} <span style="color:#888">· ${fmt(h.tarifa)} la hora</span></label>
        <div style="position:relative;width:90px"><input class="inp" id="pn-h-${i}" inputmode="decimal" style="padding-right:1.6rem" value="${String(h.horas).replace(".", ",")}" oninput="calcNetoNomina()"/><span style="position:absolute;right:0.6rem;top:50%;transform:translateY(-50%);color:#888;font-size:0.8rem">h</span></div>
        <strong id="pn-h-m-${i}" style="width:72px;text-align:right;font-size:0.82rem;color:#1a9e5c">${fmt(h.monto)}</strong></div>`
      )
      .join("")}`;
  // A qué cuenta se le paga (sale en el recibo)
  const cuentas = cuentasDe(t);
  if (cuentaBox && cuentas.length)
    cuentaBox.innerHTML = `<div class="field"><label class="field-label">🏦 ¿A qué cuenta se le paga?</label><select class="inp" id="pn-cuenta">${cuentas
      .map(
        (c, i) =>
          `<option value="${i}">${escHtml(cuentaCorta(c))}${c.titular ? " · " + escHtml(c.titular) : ""}</option>`
      )
      .join("")}<option value="">Ninguna (efectivo u otra)</option></select></div>`;
  pnDeducciones = s.deducciones;
  infoAsistenciaPago(t, periodo);
  if (deds)
    deds.innerHTML = pnDeducciones.length
      ? pnDeducciones
          .map(
            (d, i) => `<div class="pn-ded" style="display:flex;gap:0.5rem;align-items:center;margin-bottom:0.35rem">
        <input type="checkbox" id="pn-ded-on-${i}" checked onchange="calcNetoNomina()"/>
        <label for="pn-ded-on-${i}" style="flex:1;font-size:0.8rem">${d.tipo === "adelanto" ? "💸 " : d.tipo === "prestamo" ? "🤝 " : ""}${escHtml(d.concepto)}${d.saldo ? " (saldo " + fmt(d.saldo) + ")" : ""}</label>
        <div style="position:relative;width:110px"><span style="position:absolute;left:0.6rem;top:50%;transform:translateY(-50%);color:#e53e3e;font-weight:700;font-size:0.8rem">$</span>
          <input class="inp" id="pn-ded-v-${i}" inputmode="decimal" style="padding-left:1.5rem" value="${String(d.monto).replace(".", ",")}" oninput="fmtInput(this);calcNetoNomina()"/></div></div>`
          )
          .join("")
      : `<div style="font-size:0.78rem;color:#888">No tiene adelantos ni préstamos por descontar</div>`;
  const choque = choquePeriodo(t.id, periodo);
  if (aviso && choque.length)
    aviso.innerHTML = `<div class="alert-item alert-mora">⚠️ Ya se le pagó ${choque.map((f) => escHtml(nombrePeriodo(periodoDePago(f)))).join(" y ")}. Revisa el período antes de registrar.</div>`;
  const desc = document.getElementById("pn-desc"),
    auto = nombrePeriodo(periodo) + " — " + t.nombre;
  if (desc && (!desc.value.trim() || desc.value === pnDescAuto)) desc.value = auto;
  pnDescAuto = auto;
  const mon = document.getElementById("pn-moneda");
  if (mon && t.moneda) mon.value = t.moneda;
  calcNetoNomina();
}
// Lo que dice el formulario: asignaciones, deducciones marcadas (con su monto) y el neto
function leerFormNomina() {
  const asignaciones = [
    ["Salario base", "pn-monto"],
    ["Bono alimentación", "pn-balim"],
    ["Bono productividad", "pn-bprod"],
  ]
    .map(([concepto, id]) => ({ concepto, monto: r2(parseFmt((document.getElementById(id) || {}).value || "0")) }))
    .filter((a) => a.monto > 0);
  pnHoras.forEach((h, i) => {
    const horas = r2(numeroCorto((document.getElementById("pn-h-" + i) || {}).value));
    const monto = r2(horas * h.tarifa);
    const el = document.getElementById("pn-h-m-" + i);
    if (el) el.textContent = fmt(monto);
    if (horas > 0) asignaciones.push({ concepto: h.concepto, monto, horas, tarifa: h.tarifa });
  });
  const otros = leerOtrosConceptos();
  otros.lista.forEach((o) => asignaciones.push({ concepto: o.nombre, monto: r2(o.monto) }));
  const deducciones = [];
  pnDeducciones.forEach((d, i) => {
    const on = document.getElementById("pn-ded-on-" + i),
      v = document.getElementById("pn-ded-v-" + i);
    const monto = r2(parseFmt(v ? v.value : "0"));
    if (on && on.checked && monto > 0) {
      const x = { concepto: d.concepto, monto, tipo: d.tipo };
      if (d.ref) x.ref = d.ref;
      deducciones.push(x);
    }
  });
  const otro = r2(parseFmt((document.getElementById("pn-descuento") || {}).value || "0"));
  if (otro > 0)
    deducciones.push({
      concepto: ((document.getElementById("pn-descuento-motivo") || {}).value || "").trim() || "Otro descuento",
      monto: otro,
      tipo: "otra",
    });
  const bruto = sumaDe(asignaciones, "monto"),
    totalDed = sumaDe(deducciones, "monto");
  return { asignaciones, deducciones, bruto, totalDed, neto: r2(bruto - totalDed), errorOtros: otros.error };
}
function calcNetoNomina() {
  const f = leerFormNomina();
  const tasa = parseTasa(document.getElementById("pn-tasa")?.value || "0");
  const box = document.getElementById("pn-neto-box");
  if (!box) return;
  if (!(f.bruto > 0)) {
    box.style.display = "none";
    return;
  }
  box.style.display = "block";
  document.getElementById("pn-neto-monto").textContent = fmt(f.bruto);
  document.getElementById("pn-neto-desc").textContent = f.totalDed > 0 ? "- " + fmt(f.totalDed) : fmt(0);
  document.getElementById("pn-neto-total").textContent = fmt(f.neto);
  const rb = document.getElementById("pn-neto-bs-row");
  rb.style.display = tasa > 0 ? "flex" : "none";
  document.getElementById("pn-neto-bs").textContent = tasa > 0 ? fmtBs(r2(f.neto * tasa)) : "";
}
// Validación común de fecha y tasa de los movimientos de nómina
function revisarFechaTasa(pref, fecha, tasa, err) {
  if (!fecha) return (err("Elige la fecha"), false);
  if (!(tasa > 0)) return (err("Falta la tasa BCV: cárgala con 💱 (arriba) o escríbela en el formulario"), false);
  const errFecha = revisarFechaMovimiento(fecha);
  if (errFecha === "cancelado") return false;
  if (errFecha) return (err(errFecha), false);
  return true;
}
async function guardarMovNomina(datos, pref, fecha, tasa) {
  const ref = await db.collection("finanzas").add(datos);
  datos.id = ref.id;
  ponerEnLista(finanzas, datos);
  aplicarTasaEditada(pref, fecha, tasa);
  return datos;
}
async function guardarPagoNomina() {
  const err = (m) => mostrarError("pn-err", m);
  const trab = trabajadores.find((t) => t.id === document.getElementById("pn-trab").value);
  const periodo = leerPeriodo("pn");
  const desc = document.getElementById("pn-desc").value.trim();
  const fecha = document.getElementById("pn-fecha").value;
  const tasa = parseTasa(document.getElementById("pn-tasa") ? document.getElementById("pn-tasa").value : "0");
  if (!trab) return err("Elige el trabajador");
  if (!periodo) return err("Elige el período (quincena o mes)");
  const f = leerFormNomina();
  if (f.errorOtros) return err(f.errorOtros);
  if (!desc || !(f.bruto > 0)) return err("Completa la descripción y lo que se le paga");
  if (f.neto < -0.004)
    return err("Las deducciones (" + fmt(f.totalDed) + ") pasan de lo que se le paga (" + fmt(f.bruto) + ")");
  // Una cuota no puede pasar del saldo del préstamo
  const pres = f.deducciones.find(
    (d) =>
      d.tipo === "prestamo" && d.monto > ((pnDeducciones.find((x) => x.ref === d.ref) || {}).saldo || Infinity) + 0.004
  );
  if (pres) return err("La cuota de préstamo pasa de lo que debe");
  if (!revisarFechaTasa("pn", fecha, tasa, err)) return;
  const choque = choquePeriodo(trab.id, periodo);
  if (
    choque.length &&
    !confirm(
      "⚠️ A " +
        trab.nombre +
        " ya se le pagó " +
        choque.map((x) => nombrePeriodo(periodoDePago(x))).join(" y ") +
        ".\n¿Registrar este pago de todos modos?"
    )
  )
    return;
  const neto = Math.max(0, f.neto);
  const datos = {
    tipo: "gasto",
    descripcion: desc,
    fecha,
    categoria: "Nómina",
    monto: neto,
    montoBs: r2(neto * tasa),
    tasa,
    moneda: document.getElementById("pn-moneda").value === "USD" ? "USD" : "VES",
    responsable: trab.nombre,
    trabajadorId: trab.id,
    nomina: { tipo: "pago", periodo, asignaciones: f.asignaciones, deducciones: f.deducciones, bruto: f.bruto },
    registradoPor: correoUsuario(),
    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
  };
  const cuenta = cuentasDe(trab)[Number((document.getElementById("pn-cuenta") || {}).value)];
  if (cuenta && (document.getElementById("pn-cuenta") || {}).value !== "")
    datos.cuentaPago = { banco: cuenta.banco, tipo: cuenta.tipo, numero: cuenta.numero };
  try {
    await guardarMovNomina(datos, "pn", fecha, tasa);
    cerrarModal();
    mostrarExito("¡Pago de nómina registrado!", fmt(datos.monto) + " · " + datos.responsable);
    imprimirReciboNomina(null, datos.id);
  } catch (e) {
    err(e.message);
  }
}

// ---- Adelanto de quincena: dinero que se entrega antes; se descuenta solo en el pago de ese período
function renderModalAdelantoNomina(m) {
  const t = trabajadores.find((x) => x.id === (m && m.trabId)) || null;
  return `<div class="modal-bg"><div class="modal">
    <div class="modal-header"><div><h3>💸 Adelanto de quincena</h3><p>Se descuenta solo cuando le pagues ese período</p></div><button class="modal-close-x" onclick="cerrarModal()">✕</button></div>
    <div class="modal-body"><div class="form-grid">
      <div class="field"><label class="field-label">Trabajador *</label><select class="inp" id="ad-trab" onchange="infoAdelanto()">${opcionesTrabajador(t && t.id)}</select></div>
      ${campoPeriodo("ad", periodoSugerido(t), "infoAdelanto()")}
      <div class="form-row">
        <div class="field"><label class="field-label">Monto ($) *</label>${campoDolar("ad-monto", "", "0,00", "#b8860b")}</div>
        ${campoMoneda("ad")}
      </div>
      <div class="field"><label class="field-label">Fecha *</label><input class="inp" type="date" id="ad-fecha" max="${todayStr()}" value="${todayStr()}" onchange="actualizarTasaCampo('ad')"/></div>
      ${campoTasaHTML("ad", null, "")}
      <div id="ad-info"></div>
      <div id="ad-err"></div>
    </div></div>
    <div class="modal-actions">
      <button class="btn btn-primary" style="flex:1" onclick="guardarAdelantoNomina()">✓ Registrar adelanto</button>
      <button class="btn btn-gray" onclick="cerrarModal()">Cancelar</button>
    </div>
  </div></div>`;
}
// Cuánto le toca en ese período y cuánto ya se le adelantó
function infoAdelanto() {
  const t = trabajadores.find((x) => x.id === (document.getElementById("ad-trab") || {}).value);
  const out = document.getElementById("ad-info");
  if (!out) return;
  if (!t) return (out.innerHTML = "");
  const p = leerPeriodo("ad"),
    x = partesPeriodo(p);
  const toca = r2(netoMensual(t) * fraccionPeriodo(x ? x.tipo : "M"));
  const ya = sumaDe(
    adelantosPendientes(t.id).filter((a) => a.periodo === p),
    "pendiente"
  );
  out.innerHTML = `<div class="alert-item alert-info">En ${escHtml(nombrePeriodo(p))} le corresponden <strong>${fmt(toca)}</strong> netos${ya > 0 ? ` · ya se le adelantaron <strong>${fmt(ya)}</strong>` : ""} · puede adelantarse hasta <strong>${fmt(Math.max(0, r2(toca - ya)))}</strong>.</div>`;
}
async function guardarAdelantoNomina() {
  const err = (m) => mostrarError("ad-err", m);
  const t = trabajadores.find((x) => x.id === document.getElementById("ad-trab").value);
  const periodo = leerPeriodo("ad");
  const monto = r2(parseFmt(document.getElementById("ad-monto").value));
  const fecha = document.getElementById("ad-fecha").value;
  const tasa = parseTasa(document.getElementById("ad-tasa").value || "0");
  if (!t) return err("Elige el trabajador");
  if (!periodo) return err("Elige a cuenta de qué período es");
  if (!(monto > 0)) return err("Escribe el monto del adelanto");
  if (!revisarFechaTasa("ad", fecha, tasa, err)) return;
  const x = partesPeriodo(periodo),
    toca = r2(netoMensual(t) * fraccionPeriodo(x.tipo));
  const ya = sumaDe(
    adelantosPendientes(t.id).filter((a) => a.periodo === periodo),
    "pendiente"
  );
  if (
    monto > toca - ya + 0.004 &&
    !confirm(
      "⚠️ El adelanto pasa de lo que le corresponde en " +
        nombrePeriodo(periodo) +
        " (" +
        fmt(Math.max(0, r2(toca - ya))) +
        "). ¿Registrarlo de todos modos?"
    )
  )
    return;
  const datos = {
    tipo: "gasto",
    descripcion: "Adelanto de " + nombrePeriodo(periodo) + " — " + t.nombre,
    fecha,
    categoria: "Nómina",
    monto,
    montoBs: r2(monto * tasa),
    tasa,
    moneda: document.getElementById("ad-moneda").value === "USD" ? "USD" : "VES",
    responsable: t.nombre,
    trabajadorId: t.id,
    nomina: { tipo: "adelanto", periodo },
    registradoPor: correoUsuario(),
    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
  };
  try {
    await guardarMovNomina(datos, "ad", fecha, tasa);
    cerrarModal();
    mostrarExito("¡Adelanto registrado!", fmt(monto) + " · " + t.nombre);
    imprimirReciboNomina(null, datos.id);
  } catch (e) {
    err(e.message);
  }
}

// ---- Préstamo al personal: sale aparte de la nómina y se cobra por cuotas en cada pago
function renderModalPrestamoNomina(m) {
  const t = trabajadores.find((x) => x.id === (m && m.trabId)) || null;
  return `<div class="modal-bg"><div class="modal">
    <div class="modal-header"><div><h3>🤝 Préstamo al trabajador</h3><p>Se descuenta una cuota en cada pago de nómina hasta saldarlo</p></div><button class="modal-close-x" onclick="cerrarModal()">✕</button></div>
    <div class="modal-body"><div class="form-grid">
      <div class="field"><label class="field-label">Trabajador *</label><select class="inp" id="pr-trab" onchange="infoPrestamo()">${opcionesTrabajador(t && t.id)}</select></div>
      <div class="form-row">
        <div class="field"><label class="field-label">Monto prestado ($) *</label>${campoDolar("pr-monto", "", "0,00", "#c0392b").replace('inputmode="decimal"', 'inputmode="decimal" oninput="infoPrestamo()"')}</div>
        <div class="field"><label class="field-label">Cuota por pago ($) *</label>${campoDolar("pr-cuota", "", "0,00", "#c0392b").replace('inputmode="decimal"', 'inputmode="decimal" oninput="infoPrestamo()"')}</div>
      </div>
      <div class="field"><label class="field-label">Motivo</label><input class="inp" id="pr-motivo" placeholder="Ej: gastos médicos"/></div>
      <div class="form-row">
        <div class="field"><label class="field-label">Fecha *</label><input class="inp" type="date" id="pr-fecha" max="${todayStr()}" value="${todayStr()}" onchange="actualizarTasaCampo('pr')"/></div>
        ${campoMoneda("pr")}
      </div>
      ${campoTasaHTML("pr", null, "")}
      <div id="pr-info"></div>
      <div id="pr-err"></div>
    </div></div>
    <div class="modal-actions">
      <button class="btn btn-primary" style="flex:1" onclick="guardarPrestamoNomina()">✓ Registrar préstamo</button>
      <button class="btn btn-gray" onclick="cerrarModal()">Cancelar</button>
    </div>
  </div></div>`;
}
function infoPrestamo() {
  const out = document.getElementById("pr-info");
  if (!out) return;
  const t = trabajadores.find((x) => x.id === (document.getElementById("pr-trab") || {}).value);
  const monto = r2(parseFmt((document.getElementById("pr-monto") || {}).value || "0")),
    cuota = r2(parseFmt((document.getElementById("pr-cuota") || {}).value || "0"));
  const partes = [];
  if (monto > 0 && cuota > 0) {
    const n = Math.ceil(monto / cuota - 1e-9);
    partes.push(
      `Se descontarán <strong>${fmt(cuota)}</strong> en cada pago: <strong>${n} ${n === 1 ? "pago" : "pagos"}</strong>${t ? " (" + (t.frecuencia === "mensual" ? "unos " + n + " meses" : "unos " + Math.ceil(n / 2) + " meses") + ")" : ""}.`
    );
    if (t && cuota > r2(netoMensual(t) * fraccionPeriodo(t.frecuencia === "mensual" ? "M" : "Q1")))
      partes.push("⚠️ La cuota pasa de lo que cobra en cada pago.");
  }
  if (t) {
    const debe = sumaDe(prestamosDe(t.id), "saldo");
    if (debe > 0) partes.push("Ya debe " + fmt(debe) + " de otro préstamo.");
  }
  out.innerHTML = partes.length ? `<div class="alert-item alert-info">${partes.join(" ")}</div>` : "";
}
async function guardarPrestamoNomina() {
  const err = (m) => mostrarError("pr-err", m);
  const t = trabajadores.find((x) => x.id === document.getElementById("pr-trab").value);
  const monto = r2(parseFmt(document.getElementById("pr-monto").value)),
    cuota = r2(parseFmt(document.getElementById("pr-cuota").value));
  const motivo = document.getElementById("pr-motivo").value.trim();
  const fecha = document.getElementById("pr-fecha").value;
  const tasa = parseTasa(document.getElementById("pr-tasa").value || "0");
  if (!t) return err("Elige el trabajador");
  if (!(monto > 0)) return err("Escribe el monto prestado");
  if (!(cuota > 0)) return err("Escribe la cuota que se le descontará en cada pago");
  if (cuota > monto) return err("La cuota no puede pasar del monto prestado");
  if (!revisarFechaTasa("pr", fecha, tasa, err)) return;
  const datos = {
    tipo: "gasto",
    descripcion: "Préstamo" + (motivo ? " (" + motivo + ")" : "") + " — " + t.nombre,
    fecha,
    categoria: CATEGORIA_PRESTAMOS,
    monto,
    montoBs: r2(monto * tasa),
    tasa,
    moneda: document.getElementById("pr-moneda").value === "USD" ? "USD" : "VES",
    responsable: t.nombre,
    trabajadorId: t.id,
    nomina: { tipo: "prestamo", cuota, motivo },
    registradoPor: correoUsuario(),
    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
  };
  try {
    await guardarMovNomina(datos, "pr", fecha, tasa);
    cerrarModal();
    mostrarExito("¡Préstamo registrado!", fmt(monto) + " · " + t.nombre);
    imprimirReciboNomina(null, datos.id);
  } catch (e) {
    err(e.message);
  }
}

// Al abrir un formulario de nómina con el trabajador ya elegido (desde su ficha o la nómina del mes)
function prepararModalNomina(m) {
  if (m.tipo === "pago-nomina" && m.trabId) autoFillMontoNomina(m.trabId);
  if (m.tipo === "adelanto-nomina") infoAdelanto();
  if (m.tipo === "prestamo-nomina") infoPrestamo();
}
