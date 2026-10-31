// 🏠 Inicio: saludo y resumen del día, y la meta de cobranza del mes (con confeti al cumplirla).
// · Saludo según la hora («Buenos días», «Buenas tardes», «Buenas noches») con la fecha, y debajo lo importante de hoy:
//   lo cobrado, cuántos deben, quién espera la autorización para entrar y los cumpleaños de los estudiantes (hoy y
//   en los próximos 7 días). Cada dato lleva a su pestaña.
// · Meta de cobranza (director): qué parte de las mensualidades de este mes ya se cobró, con una marca en la meta
//   (80 % si no se cambia; config/cobranza.meta). Al cumplirla, confeti dorado una vez al mes en cada equipo.

function saludoDeHora(h) {
  if (h >= 5 && h < 12) return ["Buenos días", "☀️"];
  if (h >= 12 && h < 19) return ["Buenas tardes", "🌤️"];
  return ["Buenas noches", "🌙"];
}
// Cumpleaños de estudiantes inscritos: [{e, dias, edad}] de hoy (dias = 0) a dentro de «hasta» días
function cumpleanosProximos(hoy, hasta = 7) {
  const base = new Date(hoy + "T12:00:00");
  return estudiantes
    .filter((e) => activo(e) && /^\d{4}-\d{2}-\d{2}$/.test(e.fechaNac || ""))
    .map((e) => {
      for (let d = 0; d <= hasta; d++) {
        const f = new Date(base.getTime() + d * 864e5);
        const md = String(f.getMonth() + 1).padStart(2, "0") + "-" + String(f.getDate()).padStart(2, "0");
        if (e.fechaNac.slice(5) === md) return { e, dias: d, edad: f.getFullYear() - Number(e.fechaNac.slice(0, 4)) };
      }
      return null;
    })
    .filter(Boolean)
    .sort((a, b) => a.dias - b.dias || ordenNombre(a.e, b.e));
}
const primerNombre = (n) => String(n || "").split(/\s+/)[0];
function htmlSaludo() {
  const hoy = todayStr();
  const [saludo, ico] = saludoDeHora(new Date().getHours());
  const dia = new Date(hoy + "T12:00:00").toLocaleDateString("es-VE", { weekday: "long" });
  const chips = [];
  if (rolUsuario === "director") {
    const deHoy = pagos.filter((p) => p.fecha === hoy);
    const recibos = new Set(deHoy.map((p) => p.factura || p.id)).size;
    const deben = estudiantes.filter(enMora).length;
    const esperan = typeof pendientesAutorizacion === "function" ? pendientesAutorizacion().length : 0;
    chips.push(
      `<button class="saludo-chip" onclick="setTab('pagos')">💵 <span>Cobrado hoy <strong>${fmt(r2(deHoy.reduce((s, p) => s + (p.total || 0), 0)))}</strong> · ${recibos} recibo${recibos !== 1 ? "s" : ""}</span></button>`
    );
    if (deben)
      chips.push(
        `<button class="saludo-chip rojo" onclick="setTab('cobranza')">⚠️ <span><strong>${deben}</strong> deben</span></button>`
      );
    if (esperan)
      chips.push(
        `<button class="saludo-chip dorado" onclick="subTab.config='docentes';setTab('config')">🔐 <span><strong>${esperan}</strong> espera${esperan > 1 ? "n" : ""} tu autorización</span></button>`
      );
  }
  const cumple = cumpleanosProximos(hoy);
  const deHoy = cumple.filter((c) => c.dias === 0),
    pronto = cumple.filter((c) => c.dias > 0).slice(0, 4);
  if (deHoy.length)
    chips.push(
      `<span class="saludo-chip cumple">🎂 <span>Hoy cumple${deHoy.length > 1 ? "n" : ""} <strong>${deHoy.map((c) => `${escHtml(primerNombre(c.e.nombre))} (${c.edad})`).join(", ")}</strong></span></span>`
    );
  if (pronto.length)
    chips.push(
      `<span class="saludo-chip suave">🎈 <span>Pronto: ${pronto.map((c) => `${escHtml(primerNombre(c.e.nombre))} ${c.dias === 1 ? "mañana" : "en " + c.dias + " días"}`).join(" · ")}</span></span>`
    );
  return `<section class="saludo">
    <div class="saludo-cab"><span class="saludo-ico" aria-hidden="true">${ico}</span><div>
      <h2 class="saludo-titulo">${saludo}</h2>
      <div class="saludo-fecha">${escHtml(dia.charAt(0).toUpperCase() + dia.slice(1))}, ${escHtml(fechaLarga(hoy))}</div>
    </div></div>
    ${chips.length ? `<div class="saludo-chips">${chips.join("")}</div>` : ""}
  </section>`;
}

// ---- Meta de cobranza del mes ----
const META_COBRANZA = 80;
function metaCobranzaMes() {
  if (rolUsuario !== "director" || !cobCfgActiva()) return null;
  const ym = todayStr().slice(0, 7);
  let esperado = 0,
    cobrado = 0;
  estudiantes.filter(activo).forEach((e) => {
    const c = calcCuotas(e);
    const q = c && c.lista.find((x) => x.ym === ym);
    if (!q || !(q.monto > 0)) return;
    esperado = r2(esperado + q.monto);
    cobrado = r2(cobrado + Math.min(q.pagado, q.monto));
  });
  if (!(esperado > 0)) return null;
  const meta = Number(cobCfg.meta) > 0 ? Number(cobCfg.meta) : META_COBRANZA;
  return { ym, esperado, cobrado, pct: Math.floor((cobrado / esperado) * 100), meta };
}
function htmlMetaCobranza() {
  const m = metaCobranzaMes();
  if (!m) return "";
  const cumplida = m.pct >= m.meta,
    falta = r2(Math.max(0, (m.esperado * m.meta) / 100 - m.cobrado));
  if (cumplida) celebrarMeta(m.ym);
  return `<section class="card meta-cobranza${cumplida ? " cumplida" : ""}">
    <div class="meta-cab">
      <div><div class="meta-titulo">🎯 Meta de cobranza · ${escHtml(nombreMesYM(m.ym))}</div>
      <div class="meta-sub">Cobrado <strong>${fmt(m.cobrado)}</strong> de ${fmt(m.esperado)} en mensualidades de este mes</div></div>
      <div class="meta-pct">${m.pct}<small>%</small></div>
    </div>
    <div class="meta-barra" style="--pct:${Math.min(100, m.pct)}%;--meta:${m.meta}%"><i></i><span class="meta-marca" title="Meta: ${m.meta} %"></span></div>
    <div class="meta-pie"><span>${cumplida ? "🎉 ¡Meta cumplida! Excelente trabajo." : `Faltan ${fmt(falta)} para llegar al ${m.meta} %`}</span>
      <button class="meta-editar" onclick="cambiarMetaCobranza()" title="Cambiar la meta">Meta: ${m.meta} % ✏️</button></div>
  </section>`;
}
async function cambiarMetaCobranza() {
  if (rolUsuario !== "director" || !cobCfg) return;
  const actual = Number(cobCfg.meta) > 0 ? Number(cobCfg.meta) : META_COBRANZA;
  const v = prompt("¿Qué parte de las mensualidades del mes es la meta? (en %, de 10 a 100)", String(actual));
  if (v === null) return;
  const meta = Math.round(Number(String(v).replace(",", ".").replace("%", "")));
  if (!(meta >= 10 && meta <= 100)) return alert("Escribe un número de 10 a 100");
  try {
    await db.collection("config").doc("cobranza").update({ meta });
    cobCfg.meta = meta;
    renderTabContent();
  } catch (e) {
    alert("No se pudo guardar: " + e.message);
  }
}
// Confeti al cumplir la meta: una vez por mes en cada equipo
function celebrarMeta(ym) {
  const clave = "metaCelebrada-" + ym;
  try {
    if (localStorage.getItem(clave)) return;
    localStorage.setItem(clave, "1");
  } catch (e) {
    return;
  }
  setTimeout(lanzarConfeti, 700);
}
function lanzarConfeti() {
  if (sinMovimiento() || document.getElementById("confeti")) return;
  const colores = ["#ffd700", "#ffe866", "#00509e", "#ffffff", "#1a9e5c", "#e53e3e"];
  const caja = document.createElement("div");
  caja.id = "confeti";
  caja.className = "confeti";
  caja.setAttribute("aria-hidden", "true");
  caja.innerHTML = Array.from({ length: 70 }, (_, i) => {
    const x = (i * 37) % 100,
      ret = ((i * 53) % 900) / 1000,
      dur = 2.2 + ((i * 29) % 140) / 100,
      giro = ((i * 71) % 720) - 360,
      deriva = ((i * 43) % 160) - 80;
    return `<i style="left:${x}%;background:${colores[i % colores.length]};animation-delay:${ret}s;animation-duration:${dur}s;--giro:${giro}deg;--deriva:${deriva}px"></i>`;
  }).join("");
  document.body.appendChild(caja);
  setTimeout(() => caja.remove(), 4500);
}
