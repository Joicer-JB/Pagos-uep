// Moneda: todos los montos se guardan en $ de referencia y se muestran también en Bs. a la tasa BCV del día de cada operación.

// Todos los montos del sistema están en $ de referencia. Cada operación guarda además la tasa BCV usada
// y su valor real en bolívares, para que el flujo de caja pueda mostrarse en Bs. con la referencia en $.
let tasas = {}; // {"YYYY-MM-DD": Bs. por $1}  (compartidas: config/tasasBCV)
function parseTasa(s) {
  s = String(s || "")
    .trim()
    .replace(/[^0-9.,]/g, "");
  if (!s) return 0;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  return parseFloat(s) || 0;
}
async function cargarTasas() {
  tasas = {};
  try {
    const s = await db.collection("config").doc("tasasBCV").get();
    if (s.exists) tasas = { ...(s.data().tasas || {}) };
  } catch (e) {
    console.warn("tasasBCV:", e.message);
  }
  try {
    const l = JSON.parse(localStorage.getItem("tasasBCV_local") || "{}");
    for (const k in l) if (!(k in tasas)) tasas[k] = l[k];
  } catch (e) {}
}
// Tasa vigente en una fecha: la de ese día o, si no hay (fin de semana/feriado), la última anterior (máx. 10 días)
function tasaDe(fecha) {
  if (!fecha) return null;
  if (tasas[fecha] > 0) return { valor: tasas[fecha], fecha, exacta: true };
  let mejor = null;
  for (const k in tasas) {
    if (k < fecha && tasas[k] > 0 && (!mejor || k > mejor)) mejor = k;
  }
  if (mejor && diasEntre(mejor, fecha) <= 10) return { valor: tasas[mejor], fecha: mejor, exacta: false };
  return null;
}
const tasaHoyValor = () => {
  const t = tasaDe(todayStr());
  return t && t.exacta ? t.valor : 0;
};
const tasaHoy = () => tasaHoyValor() > 0;
const aBs = (usd) => r2((usd || 0) * tasaHoyValor());
const dual = (usd) => (tasaHoy() ? `${fmt(usd)} (${fmtBs(aBs(usd))})` : fmt(usd));
async function guardarTasaDia(fecha, valor) {
  tasas[fecha] = valor;
  try {
    await db
      .collection("config")
      .doc("tasasBCV")
      .set({ tasas: { [fecha]: valor }, actualizado: todayStr() }, { merge: true });
    return true;
  } catch (e) {
    try {
      const l = JSON.parse(localStorage.getItem("tasasBCV_local") || "{}");
      l[fecha] = valor;
      localStorage.setItem("tasasBCV_local", JSON.stringify(l));
    } catch (_) {}
    alert("No se pudo guardar la tasa en la nube (" + e.message + "). Quedó guardada solo en este equipo.");
    return false;
  }
}
// Bs. reales de un registro: lo guardado; si es un registro antiguo, con la tasa de su fecha (marcado como estimado)
function bsDe(rec, usd) {
  const u = usd != null ? usd : (rec.total != null ? rec.total : rec.monto) || 0;
  const g = rec.montoBs != null ? rec.montoBs : rec.totalBs;
  if (g != null && rec.tasa > 0) return { bs: g, tasa: rec.tasa, fecha: rec.fecha, estimada: false };
  const t = tasaDe(rec.fecha);
  if (t) return { bs: r2(u * t.valor), tasa: t.valor, fecha: t.fecha, estimada: true };
  return { bs: null, tasa: null, fecha: null, estimada: true };
}
// Suma un conjunto [{usd,rec}] en $ y en Bs.; cuenta los que no tienen tasa ni de su fecha
function totalesDual(items) {
  let usd = 0,
    bs = 0,
    sinTasa = 0,
    estim = 0;
  items.forEach(({ usd: u, rec }) => {
    usd += u;
    const b = bsDe(rec, u);
    if (b.bs == null) sinTasa++;
    else {
      bs += b.bs;
      if (b.estimada) estim++;
    }
  });
  return { usd: r2(usd), bs: r2(bs), sinTasa, estim };
}
// Totales por método de pago: $ de referencia y, en los métodos en bolívares, los Bs. reales (a la tasa de cada pago)
const METODOS = [
  ["Dólares Efectivo", "💵 $ Efectivo", false],
  ["Transferencia Bs", "📲 Transf Bs", true],
  ["Bs Efectivo", "💵 Bs Efectivo", true],
  ["Punto", "💳 Punto", true],
];
function totalesMetodo(lista) {
  const r = {};
  METODOS.forEach(([m, , enBs]) => {
    const t = totalesDual(lista.filter((p) => p.metodo === m).map((p) => ({ usd: p.total || 0, rec: p })));
    r[m] = { usd: t.usd, bs: enBs ? t.bs : null, sinTasa: enBs ? t.sinTasa : 0, estim: enBs ? t.estim : 0 };
  });
  return r;
}
const txtMetodo = (t) => (t.bs != null ? fmtBs(t.bs) + " (" + fmt(t.usd) + ")" : fmt(t.usd)) + (t.sinTasa ? " ⚠️" : "");
// Campo "tasa BCV" reutilizable en los formularios (pref = p, fin, pn)
const notaTasa = (t) =>
  t
    ? t.exacta
      ? "Tasa BCV del " + fechaCorta(t.fecha)
      : "⚠️ Última tasa registrada: " + fechaCorta(t.fecha) + " (no hay de ese día; verifícala)"
    : "⚠️ No hay tasa registrada: escríbela (bcv.org.ve) o usa 💱 arriba";
function campoTasaHTML(pref, fecha, onInput) {
  const t = tasaDe(fecha || todayStr());
  return `<div class="field"><label class="field-label">💱 Tasa BCV (Bs. por $1) *</label>
    <input class="inp" id="${pref}-tasa" inputmode="decimal" autocomplete="off" placeholder="Ej: 396,3674" value="${t ? String(t.valor).replace(".", ",") : ""}" oninput="${onInput}"/>
    <div id="${pref}-tasa-nota" style="font-size:0.7rem;color:${t && t.exacta ? "#1a9e5c" : "#b8860b"};margin-top:2px">${notaTasa(t)}</div></div>`;
}
function actualizarTasaCampo(pref, fn) {
  const f = document.getElementById(pref + "-fecha"),
    t = tasaDe(f && f.value);
  const el = document.getElementById(pref + "-tasa");
  if (el) el.value = t ? String(t.valor).replace(".", ",") : "";
  const n = document.getElementById(pref + "-tasa-nota");
  if (n) {
    n.textContent = notaTasa(t);
    n.style.color = t && t.exacta ? "#1a9e5c" : "#b8860b";
  }
  if (fn) fn();
}
// Si la fecha del movimiento no tenía tasa guardada, la que se escribió queda disponible para los demás
function recordarTasa(fecha, valor) {
  if (fecha && valor > 0 && !tasas[fecha]) guardarTasaDia(fecha, valor);
}
// ---- Chip de la cabecera, aviso y ventana de tasa
function chipTasaTxt() {
  const t = tasaDe(todayStr());
  return t && t.exacta
    ? "💱 Bs " + fmtTasa(t.valor)
    : t
      ? "⚠️ Bs " + fmtTasa(t.valor) + " (" + fechaCorta(t.fecha).slice(0, 5) + ")"
      : "⚠️ Sin tasa hoy";
}
function bannerTasa() {
  if (rolUsuario === "docente" || soloLectura()) return "";
  const t = tasaDe(todayStr());
  if (t && t.exacta) return "";
  return `<div style="background:#fff3cd;border-bottom:2px solid #b8860b;color:#7a5c00;padding:0.5rem 1rem;font-size:0.8rem;text-align:center">💱 Falta la tasa BCV de hoy. <a href="#" onclick="abrirModal({tipo:'tasa'});return false" style="color:#003366;font-weight:700">Cargarla</a> para que los pagos y recibos salgan con su valor en Bs.</div>`;
}
function renderModalTasa() {
  const hoy = todayStr();
  const lista = Object.keys(tasas).sort().reverse().slice(0, 15);
  return `<div class="modal-bg" onclick="if(event.target.classList.contains('modal-bg'))cerrarModal()"><div class="modal">
    <div class="modal-header"><div><h3>💱 Tasa BCV</h3><p>Bolívares por $1 de referencia</p></div><button class="modal-close-x" onclick="cerrarModal()">✕</button></div>
    <div class="modal-body"><div class="form-grid">
      <div class="form-row">
        <div class="field"><label class="field-label">Fecha</label><input class="inp" type="date" id="tz-fecha" value="${hoy}" max="${hoy}"/></div>
        <div class="field"><label class="field-label">Tasa (Bs. por $1)</label><input class="inp" id="tz-valor" inputmode="decimal" placeholder="Ej: 396,3674" value="${tasas[hoy] ? String(tasas[hoy]).replace(".", ",") : ""}"/></div>
      </div>
      <div id="tz-msg" style="font-size:0.74rem;color:#555">La tasa se comparte con todos los usuarios y queda guardada por fecha.</div>
      <div style="display:flex;gap:0.5rem"><button class="btn btn-gray btn-sm" onclick="traerTasaAPI()">🔄 Traer del BCV</button><button class="btn btn-primary" style="flex:1" onclick="guardarTasaModal()">💾 Guardar tasa</button></div>
      ${
        lista.length
          ? `<div class="section-title" style="margin-top:0.5rem">Últimas tasas (toca una para editarla)</div>
      ${lista.map((f) => `<div class="info-row" style="cursor:pointer" onclick="document.getElementById('tz-fecha').value='${f}';document.getElementById('tz-valor').value='${String(tasas[f]).replace(".", ",")}'"><span>${fechaCorta(f)}</span><strong>Bs. ${fmtTasa(tasas[f])}</strong></div>`).join("")}`
          : ""
      }
    </div></div></div></div>`;
}
async function traerTasaAPI() {
  const msg = document.getElementById("tz-msg");
  if (msg) msg.innerHTML = "⏳ Consultando...";
  try {
    const r = await fetch("https://ve.dolarapi.com/v1/dolares/oficial");
    if (!r.ok) throw new Error("HTTP " + r.status);
    const d = await r.json();
    const v = Number(d.promedio || d.venta);
    if (!v || v <= 0) throw new Error("respuesta sin tasa");
    document.getElementById("tz-valor").value = String(v).replace(".", ",");
    if (msg)
      msg.innerHTML = `✔️ Tasa traída${d.fechaActualizacion ? " (actualizada " + new Date(d.fechaActualizacion).toLocaleDateString("es-CO") + ")" : ""}. <strong>Verifícala en bcv.org.ve y pulsa Guardar.</strong>`;
  } catch (e) {
    if (msg) msg.innerHTML = `⚠️ No se pudo traer la tasa automática (${e.message}). Escríbela desde bcv.org.ve.`;
  }
}
async function guardarTasaModal() {
  const fecha = document.getElementById("tz-fecha").value,
    v = parseTasa(document.getElementById("tz-valor").value);
  const msg = document.getElementById("tz-msg");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || fecha > todayStr()) {
    if (msg) msg.innerHTML = "⚠️ Elige una fecha válida (no futura)";
    return;
  }
  if (!v || v <= 0) {
    if (msg) msg.innerHTML = "⚠️ Escribe una tasa válida, por ejemplo 396,3674";
    return;
  }
  const prev = tasaDe(fecha);
  if (
    prev &&
    Math.abs(v / prev.valor - 1) > 0.2 &&
    !confirm("La tasa cambió más de 20% respecto a la anterior (" + fmtTasa(prev.valor) + "). ¿Es correcta?")
  )
    return;
  await guardarTasaDia(fecha, v);
  cerrarModal();
}
