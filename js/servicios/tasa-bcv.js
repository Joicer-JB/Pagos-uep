// Moneda: todos los montos se guardan en $ de referencia y se muestran también en Bs. a la tasa BCV del día de cada operación.

// Todos los montos del sistema están en $ de referencia. Cada operación guarda además la tasa BCV usada
// y su valor real en bolívares, para que el flujo de caja pueda mostrarse en Bs. con la referencia en $.
let tasas = {}; // {"YYYY-MM-DD": Bs. por $1}  (compartidas: config/tasasBCV)
// La tasa cuenta con 2 decimales, sin redondear: 883,6923 → 883,69 (el redondeo previo a 6 decimales evita que
// 883,69 se lea como 883,6899999…)
const tasa2 = (v) => Math.floor(Math.round((Number(v) || 0) * 1e6) / 1e4) / 100;
// Lee una tasa escrita a mano: acepta "396,36", "396.36" y "1.396,36" (los decimales de más no cuentan)
function parseTasa(s) {
  s = String(s || "")
    .trim()
    .replace(/[^0-9.,]/g, "");
  if (!s) return 0;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  return tasa2(parseFloat(s));
}
// Carga las tasas guardadas (más las que quedaron solo en este equipo si falló la nube)
async function cargarTasas() {
  tasas = {};
  try {
    const s = await db.collection("config").doc("tasasBCV").get();
    if (s.exists) tasas = { ...(s.data().tasas || {}) };
    for (const k in tasas) tasas[k] = tasa2(tasas[k]); // las guardadas antes con 4 decimales cuentan con 2
  } catch (e) {
    console.warn("tasasBCV:", e.message);
  }
  try {
    const l = JSON.parse(localStorage.getItem("tasasBCV_local") || "{}");
    for (const k in l) if (!(k in tasas)) tasas[k] = tasa2(l[k]);
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
// Tasa de HOY (0 si no se ha cargado; no usa la de días anteriores)
const tasaHoyValor = () => {
  const t = tasaDe(todayStr());
  return t && t.exacta ? t.valor : 0;
};
// ¿Ya se cargó la tasa de hoy?
const tasaHoy = () => tasaHoyValor() > 0;
// Convierte $ a Bs. con la tasa de hoy
const aBs = (usd) => r2((usd || 0) * tasaHoyValor());
// Monto en $ y, si hay tasa de hoy, también en Bs.: "$ 45,00 (Bs. 8.253,00)"
const dual = (usd) => (tasaHoy() ? `${fmt(usd)} (${fmtBs(aBs(usd))})` : fmt(usd));
// Una tasa ya guardada solo la corrige el director; la administradora puede cargar la de un día que no la tenga
const puedeCorregirTasa = () => rolUsuario === "director";
const tasaFija = (fecha) => !puedeCorregirTasa() && tasas[fecha] > 0;
// Guarda la tasa de una fecha en Firestore (compartida); si falla, la guarda solo en este equipo
async function guardarTasaDia(fecha, valor) {
  valor = tasa2(valor);
  if (tasaFija(fecha) && Math.abs(tasas[fecha] - valor) > 0.00005) {
    alert("La tasa del " + fechaCorta(fecha) + " ya está guardada. Solo el director puede corregirla.");
    return false;
  }
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
// Totales por método de pago para una lista de pagos
function totalesMetodo(lista) {
  const r = {};
  METODOS.forEach(([m, , enBs]) => {
    const t = totalesDual(lista.filter((p) => p.metodo === m).map((p) => ({ usd: p.total || 0, rec: p })));
    r[m] = { usd: t.usd, bs: enBs ? t.bs : null, sinTasa: enBs ? t.sinTasa : 0, estim: enBs ? t.estim : 0 };
  });
  return r;
}
// Texto de un total por método: Bs. (y $ de referencia) o solo $; ⚠️ si faltan tasas
const txtMetodo = (t) => (t.bs != null ? fmtBs(t.bs) + " (" + fmt(t.usd) + ")" : fmt(t.usd)) + (t.sinTasa ? " ⚠️" : "");
// Campo "tasa BCV" reutilizable en los formularios (pref = p, fin, pn)
const notaTasa = (t) =>
  t
    ? t.exacta
      ? "✅ Tasa BCV guardada del " + fechaCorta(t.fecha) + ". Si no es la correcta, cámbiala aquí."
      : "⚠️ No hay tasa de ese día: se usa la del " +
        fechaCorta(t.fecha) +
        " (último día con tasa). Verifícala en bcv.org.ve."
    : "⚠️ No hay tasa guardada de esa fecha: búscala en bcv.org.ve y escríbela aquí.";
// Campo «Tasa BCV» de los formularios, ya lleno con la tasa de la fecha
// Si se escribe una tasa distinta a la guardada de ese día, aparece la opción de corregir la guardada para todos.
function campoTasaHTML(pref, fecha, onInput) {
  const t = tasaDe(fecha || todayStr());
  return `<div class="field"><label class="field-label">💱 Tasa BCV (Bs. por $1) *</label>
    <input class="inp" id="${pref}-tasa" inputmode="decimal" autocomplete="off" placeholder="Ej: 396,36" value="${t ? String(t.valor).replace(".", ",") : ""}" ${t && t.exacta && tasaFija(t.fecha) ? "readonly" : ""} oninput="${onInput};revisarTasaCampo('${pref}')"/>
    <div id="${pref}-tasa-nota" style="font-size:0.7rem;color:${t && t.exacta ? "#1a9e5c" : "#b8860b"};margin-top:2px">${notaTasa(t)}</div>
    <label id="${pref}-tasa-corr" style="display:none;gap:0.4rem;align-items:center;font-size:0.72rem;color:#7a5c00;margin-top:4px"><input type="checkbox" id="${pref}-tasa-corregir"/> <span></span></label></div>`;
}
// Fecha del formulario (si no tiene campo de fecha, hoy)
const fechaCampo = (pref) => {
  const f = document.getElementById(pref + "-fecha");
  return (f && f.value) || todayStr();
};
// Compara la tasa escrita con la guardada de esa fecha y explica qué se va a usar
function revisarTasaCampo(pref) {
  const fecha = fechaCampo(pref),
    t = tasaDe(fecha);
  const el = document.getElementById(pref + "-tasa"),
    nota = document.getElementById(pref + "-tasa-nota"),
    corr = document.getElementById(pref + "-tasa-corr");
  if (!el || !nota || !corr) return;
  const v = parseTasa(el.value);
  const distinta = t && t.exacta && v > 0 && Math.abs(v - t.valor) > 0.00005;
  corr.style.display = distinta ? "flex" : "none";
  if (!distinta) {
    corr.querySelector("input").checked = false;
    nota.textContent = notaTasa(t);
    nota.style.color = t && t.exacta ? "#1a9e5c" : "#b8860b";
    return;
  }
  nota.textContent = `✏️ Este registro usará ${fmtTasa(v)}. La tasa guardada del ${fechaCorta(fecha)} es ${fmtTasa(t.valor)}.`;
  nota.style.color = "#7a5c00";
  corr.querySelector("span").textContent = `Corregir también la tasa guardada del ${fechaCorta(fecha)} (para todos)`;
}
// Al guardar: si se marcó «corregir», la tasa escrita reemplaza la guardada de ese día; si ese día no tenía tasa,
// queda guardada para los demás (como antes).
function aplicarTasaEditada(pref, fecha, valor) {
  const corregir = document.getElementById(pref + "-tasa-corregir");
  if (corregir && corregir.checked && valor > 0) return guardarTasaDia(fecha, valor);
  recordarTasa(fecha, valor);
}
// Revisa la fecha de un pago o movimiento. No puede ser futura; si es de un año escolar anterior, pide confirmación
// (quedará en el historial de ese año y no en las listas del actual). Devuelve un texto de error, "cancelado" o "".
function revisarFechaMovimiento(fecha) {
  if (fecha > todayStr()) return "La fecha no puede ser futura";
  const inicio = baseAnio();
  if (
    inicio &&
    fecha < inicio &&
    !confirm(
      `La fecha ${fechaCorta(fecha)} es anterior al inicio del año escolar actual (${fechaCorta(inicio)}).\n\n` +
        "Se guardará en el historial del año anterior y no aparecerá en las listas de este año.\n¿Continuar?"
    )
  )
    return "cancelado";
  return "";
}
// Al cambiar la fecha del formulario, pone la tasa de esa fecha
function actualizarTasaCampo(pref, fn) {
  const f = document.getElementById(pref + "-fecha"),
    t = tasaDe(f && f.value);
  const el = document.getElementById(pref + "-tasa");
  if (el) {
    el.value = t ? String(t.valor).replace(".", ",") : "";
    el.readOnly = !!(t && t.exacta && tasaFija(t.fecha));
  }
  const n = document.getElementById(pref + "-tasa-nota");
  if (n) {
    n.textContent = notaTasa(t);
    n.style.color = t && t.exacta ? "#1a9e5c" : "#b8860b";
  }
  revisarTasaCampo(pref);
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
// Aviso amarillo bajo la cabecera cuando falta la tasa de hoy
function bannerTasa() {
  if (rolUsuario === "docente" || soloLectura()) return "";
  const t = tasaDe(todayStr());
  if (t && t.exacta) return "";
  return `<div style="background:#fff3cd;border-bottom:2px solid #b8860b;color:#7a5c00;padding:0.5rem 1rem;font-size:0.8rem;text-align:center">💱 Falta la tasa BCV de hoy. <a href="#" onclick="abrirModal({tipo:'tasa'});return false" style="color:#003366;font-weight:700">Cargarla</a> para que los pagos y recibos salgan con su valor en Bs.</div>`;
}
// Ventana para cargar o corregir la tasa BCV de un día
function renderModalTasa() {
  const hoy = todayStr();
  const lista = Object.keys(tasas).sort().reverse().slice(0, 15);
  if (!puedeCorregirTasa() && tasas[hoy] > 0)
    return `<div class="modal-bg" onclick="if(event.target.classList.contains('modal-bg'))cerrarModal()"><div class="modal">
    <div class="modal-header"><div><h3>💱 Tasa BCV</h3><p>Bolívares por $1 de referencia</p></div><button class="modal-close-x" onclick="cerrarModal()">✕</button></div>
    <div class="modal-body">
      <div class="info-row"><span>Hoy, ${fechaCorta(hoy)}</span><strong>Bs. ${fmtTasa(tasas[hoy])}</strong></div>
      <div style="font-size:0.74rem;color:#555;margin:0.5rem 0">La tasa de hoy ya está cargada. Si no es la correcta, avísale al director: solo él puede corregirla.</div>
      ${lista
        .filter((f) => f !== hoy)
        .slice(0, 6)
        .map(
          (f) => `<div class="info-row"><span>${fechaCorta(f)}</span><strong>Bs. ${fmtTasa(tasas[f])}</strong></div>`
        )
        .join("")}
    </div></div></div>`;
  return `<div class="modal-bg" onclick="if(event.target.classList.contains('modal-bg'))cerrarModal()"><div class="modal">
    <div class="modal-header"><div><h3>💱 Tasa BCV</h3><p>Bolívares por $1 de referencia</p></div><button class="modal-close-x" onclick="cerrarModal()">✕</button></div>
    <div class="modal-body"><div class="form-grid">
      <div class="form-row">
        <div class="field"><label class="field-label">Fecha</label><input class="inp" type="date" id="tz-fecha" value="${hoy}" max="${hoy}"/></div>
        <div class="field"><label class="field-label">Tasa (Bs. por $1)</label><input class="inp" id="tz-valor" inputmode="decimal" placeholder="Ej: 396,36" value="${tasas[hoy] ? String(tasas[hoy]).replace(".", ",") : ""}"/></div>
      </div>
      <div id="tz-msg" style="font-size:0.74rem;color:#555">La tasa se comparte con todos los usuarios y queda guardada por fecha.</div>
      <div style="display:flex;gap:0.5rem"><button class="btn btn-gray btn-sm" onclick="traerTasaAPI()">🔄 Traer del BCV</button><button class="btn btn-primary" style="flex:1" onclick="guardarTasaModal()">💾 Guardar tasa</button></div>
      ${
        puedeCorregirTasa()
          ? `<div style="border-top:1px dashed #ccd5e3;padding-top:0.6rem">
        <div class="field-label">📥 Tasas de días anteriores</div>
        <div style="font-size:0.72rem;color:#555;margin-bottom:0.35rem">Descarga el Excel del BCV (bcv.org.ve → Estadísticas → Tipo de cambio de referencia) y súbelo aquí: se cargan todas las tasas de ese periodo.</div>
        <input class="inp" type="file" id="tz-archivo" accept=".xls,.xlsx,.csv" onchange="leerArchivoTasas(this)"/>
        <div id="tz-import" style="font-size:0.78rem"></div>
      </div>`
          : ""
      }
      ${
        lista.length && puedeCorregirTasa()
          ? `<div class="section-title" style="margin-top:0.5rem">Últimas tasas (toca una para editarla)</div>
      ${lista.map((f) => `<div class="info-row" style="cursor:pointer" onclick="document.getElementById('tz-fecha').value='${f}';document.getElementById('tz-valor').value='${String(tasas[f]).replace(".", ",")}'"><span>${fechaCorta(f)}</span><strong>Bs. ${fmtTasa(tasas[f])}</strong></div>`).join("")}`
          : ""
      }
    </div></div></div></div>`;
}
// Botón «Traer del BCV»: consulta ve.dolarapi.com (hay que verificarla antes de guardar)
async function traerTasaAPI() {
  const msg = document.getElementById("tz-msg");
  if (msg) msg.innerHTML = "⏳ Consultando...";
  try {
    const r = await fetch("https://ve.dolarapi.com/v1/dolares/oficial");
    if (!r.ok) throw new Error("HTTP " + r.status);
    const d = await r.json();
    const v = tasa2(d.promedio || d.venta);
    if (!v || v <= 0) throw new Error("respuesta sin tasa");
    document.getElementById("tz-valor").value = String(v).replace(".", ",");
    if (msg)
      msg.innerHTML = `✔️ Tasa traída${d.fechaActualizacion ? " (actualizada " + new Date(d.fechaActualizacion).toLocaleDateString("es-CO") + ")" : ""}. <strong>Verifícala en bcv.org.ve y pulsa Guardar.</strong>`;
  } catch (e) {
    if (msg) msg.innerHTML = `⚠️ No se pudo traer la tasa automática (${e.message}). Escríbela desde bcv.org.ve.`;
  }
}
// Guarda la tasa de la ventana; pide confirmación si cambió más de 20%
async function guardarTasaModal() {
  const fecha = document.getElementById("tz-fecha").value,
    v = parseTasa(document.getElementById("tz-valor").value);
  const msg = document.getElementById("tz-msg");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || fecha > todayStr()) {
    if (msg) msg.innerHTML = "⚠️ Elige una fecha válida (no futura)";
    return;
  }
  if (!v || v <= 0) {
    if (msg) msg.innerHTML = "⚠️ Escribe una tasa válida, por ejemplo 396,36";
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

// ---- Importar tasas de días anteriores desde el Excel oficial del BCV
// En bcv.org.ve → Estadísticas → «Tipo de cambio de referencia», el BCV publica un Excel por trimestre con una hoja
// por día: cada hoja dice «Fecha Valor: dd/mm/aaaa» y tiene una fila «USD» con los bolívares por dólar
// (compra y venta; se usa la venta). También sirve un Excel o CSV sencillo con dos columnas: fecha y tasa.

const esFechaJS = (v) => Object.prototype.toString.call(v) === "[object Date]" && !isNaN(v);
// "AAAA-MM-DD" si el año, mes y día forman una fecha real; si no, ""
function fechaValida(a, m, d) {
  const f = new Date(Date.UTC(+a, +m - 1, +d));
  return f.getUTCFullYear() === +a && f.getUTCMonth() === +m - 1 && f.getUTCDate() === +d
    ? `${a}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`
    : "";
}
// Fecha de una celda de Excel: un valor de fecha, "02/10/2026", "Fecha Valor: 02/10/2026" o "2026-10-02"
function fechaDeCelda(v) {
  if (esFechaJS(v)) {
    const d = new Date(v.getTime() + 12 * 3600e3); // a mediodía: la zona horaria no cambia el día
    return fechaValida(d.getFullYear(), d.getMonth() + 1, d.getDate());
  }
  const s = String(v == null ? "" : v);
  let m = s.match(/(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/);
  if (m) return fechaValida(m[3], m[2], m[1]);
  m = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  return m ? fechaValida(m[1], m[2], m[3]) : "";
}
// Número de una celda, con 2 decimales (acepta "36,3732" y "1.396,36"); 0 si no es un número
const numeroDeCelda = (v) =>
  typeof v === "number" ? tasa2(v) : /^\s*\d[\d.,]*\s*$/.test(String(v == null ? "" : v)) ? parseTasa(v) : 0;

// Hoja con el formato del BCV: fecha valor y fila USD. null si la hoja no tiene ese formato.
function tasaDeHojaBCV(filas) {
  let fecha = "",
    valor = 0;
  filas.forEach((fila) => {
    fila.forEach((c, i) => {
      if (!fecha && /fecha\s*valor/i.test(String(c)))
        fecha = fechaDeCelda(c) || fechaDeCelda(fila.slice(i + 1).find((x) => x !== "" && x != null));
    });
    if (!valor && fila.some((c) => String(c).trim().toUpperCase() === "USD")) {
      const bs = fila.map(numeroDeCelda).filter((n) => n > 1); // Bs. por dólar (las columnas «por US$» valen 1)
      valor = bs.length >= 2 ? bs[1] : bs[0] || 0;
    }
  });
  return fecha && valor ? { fecha, valor } : null;
}
// Fila de una tabla sencilla: la primera celda con fecha y el primer número después de ella
function tasaDeFila(fila) {
  const i = fila.findIndex((c) => fechaDeCelda(c));
  if (i < 0) return null;
  const valor = fila
    .slice(i + 1)
    .map(numeroDeCelda)
    .find((n) => n > 0);
  return valor ? { fecha: fechaDeCelda(fila[i]), valor } : null;
}
// Todas las tasas de un libro: [{fecha, valor}] ordenadas por fecha, sin fechas futuras (más de 10 días) ni muy viejas
function tasasDeHojas(hojas) {
  const porFecha = {};
  hojas.forEach(({ filas }) => {
    const bcv = tasaDeHojaBCV(filas);
    if (bcv) porFecha[bcv.fecha] = bcv.valor;
    else
      filas.forEach((fila) => {
        const t = tasaDeFila(fila);
        if (t) porFecha[t.fecha] = t.valor;
      });
  });
  const hasta = new Date(Date.parse(todayStr() + "T12:00:00Z") + 10 * 864e5).toISOString().slice(0, 10);
  return Object.keys(porFecha)
    .filter((f) => f >= "2000-01-01" && f <= hasta)
    .sort()
    .map((fecha) => ({ fecha, valor: porFecha[fecha] }));
}
// Compara lo encontrado con lo guardado: nuevas (sin tasa ese día), iguales y distintas
function compararTasas(lista) {
  const r = { nuevas: [], iguales: [], distintas: [] };
  lista.forEach((t) => {
    const g = tasas[t.fecha];
    if (!(g > 0)) r.nuevas.push(t);
    else if (Math.abs(g - t.valor) <= 0.00005) r.iguales.push(t);
    else r.distintas.push({ ...t, guardada: g });
  });
  return r;
}

let _tasasArchivo = []; // lo que se leyó del último archivo, esperando «Guardar»
const cuantas = (n, una, varias) => n + " " + (n === 1 ? una : varias); // «1 tasa», «3 tasas»
// Lee el archivo elegido y muestra lo que encontró, sin guardar todavía
function leerArchivoTasas(input) {
  const archivo = input.files && input.files[0];
  const caja = document.getElementById("tz-import");
  if (!archivo || !caja) return;
  caja.innerHTML = "⏳ Leyendo el archivo...";
  const lector = new FileReader();
  lector.onload = (ev) => {
    try {
      const libro = XLSX.read(new Uint8Array(ev.target.result), { type: "array", cellDates: true });
      const hojas = libro.SheetNames.map((n) => ({
        nombre: n,
        filas: XLSX.utils.sheet_to_json(libro.Sheets[n], { header: 1, raw: true, defval: "" }),
      }));
      _tasasArchivo = tasasDeHojas(hojas);
      mostrarTasasArchivo();
    } catch (e) {
      _tasasArchivo = [];
      caja.innerHTML = `⚠️ No se pudo leer el archivo (${escHtml(e.message)}).`;
    }
  };
  lector.readAsArrayBuffer(archivo);
}
// Resumen y lista de las tasas del archivo, con el botón para guardarlas
function mostrarTasasArchivo() {
  const caja = document.getElementById("tz-import");
  if (!caja) return;
  if (!_tasasArchivo.length) {
    caja.innerHTML = `<div style="color:#b8860b">⚠️ No se encontraron tasas en el archivo. Usa el Excel del BCV (una hoja por día) o una tabla con dos columnas: fecha y tasa.</div>`;
    return;
  }
  const c = compararTasas(_tasasArchivo);
  const primera = _tasasArchivo[0].fecha,
    ultima = _tasasArchivo[_tasasArchivo.length - 1].fecha;
  const fila = (t) => {
    const g = tasas[t.fecha],
      distinta = g > 0 && Math.abs(g - t.valor) > 0.00005;
    return `<tr${distinta ? ' style="background:#fff3cd"' : ""}><td>${fechaCorta(t.fecha)}</td><td style="text-align:right">${fmtTasa(t.valor)}</td><td style="text-align:right;color:#777">${g > 0 ? fmtTasa(g) : "—"}</td></tr>`;
  };
  caja.innerHTML = `<div style="font-size:0.78rem;margin:0.4rem 0">Se encontraron <strong>${cuantas(_tasasArchivo.length, "tasa", "tasas")}</strong> (del ${fechaCorta(primera)} al ${fechaCorta(ultima)}):
      <strong>${cuantas(c.nuevas.length, "nueva", "nuevas")}</strong>, ${cuantas(c.iguales.length, "igual", "iguales")} a las guardadas${c.distintas.length ? `, <strong style="color:#b8860b">${cuantas(c.distintas.length, "distinta", "distintas")}</strong>` : ""}.</div>
    <div style="max-height:200px;overflow:auto;border:1px solid #e3e7ef;border-radius:8px">
      <table style="width:100%;font-size:0.75rem;border-collapse:collapse"><thead><tr style="background:#f4f6fb"><th style="text-align:left">Fecha</th><th style="text-align:right">En el archivo</th><th style="text-align:right">Guardada</th></tr></thead>
      <tbody>${_tasasArchivo.map(fila).join("")}</tbody></table>
    </div>
    ${c.distintas.length ? `<label style="display:flex;gap:0.4rem;align-items:center;font-size:0.74rem;color:#7a5c00;margin-top:0.4rem"><input type="checkbox" id="tz-reemplazar"/> Reemplazar también ${c.distintas.length === 1 ? "la tasa guardada que es distinta" : `las ${c.distintas.length} tasas guardadas que son distintas`}</label>` : ""}
    <div style="font-size:0.72rem;color:#555;margin-top:0.3rem">Antes de guardar, compara uno o dos días con bcv.org.ve.</div>
    <button class="btn btn-primary btn-sm" style="margin-top:0.4rem;width:100%" onclick="guardarTasasArchivo()">💾 Guardar tasas del archivo</button>`;
}
// Guarda las tasas nuevas del archivo (y las distintas, si se marcó «reemplazar») en una sola escritura
async function guardarTasasArchivo() {
  const c = compararTasas(_tasasArchivo);
  const reemplazar = !!(document.getElementById("tz-reemplazar") || {}).checked;
  const aGuardar = [...c.nuevas, ...(reemplazar ? c.distintas : [])];
  const caja = document.getElementById("tz-import");
  if (!aGuardar.length) {
    if (caja) caja.innerHTML = "✔️ No hay tasas nuevas que guardar: las del archivo ya estaban guardadas.";
    return;
  }
  const nuevas = Object.fromEntries(aGuardar.map((t) => [t.fecha, t.valor]));
  try {
    await db.collection("config").doc("tasasBCV").set({ tasas: nuevas, actualizado: todayStr() }, { merge: true });
  } catch (e) {
    if (caja) caja.innerHTML = `⚠️ No se pudieron guardar las tasas (${escHtml(e.message)}).`;
    return;
  }
  Object.assign(tasas, nuevas);
  _tasasArchivo = [];
  render(); // la ventana se vuelve a dibujar con las tasas nuevas
  const msg = document.getElementById("tz-msg");
  if (msg)
    msg.innerHTML = `✅ Se ${aGuardar.length === 1 ? "guardó" : "guardaron"} <strong>${cuantas(aGuardar.length, "tasa", "tasas")}</strong> del archivo. Ya se usan en los pagos con esas fechas.`;
}
