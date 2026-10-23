// Nómina: asistencia del personal. Ver vistas/nomina.js.

// ---- 🗓️ Asistencia del personal: se marca cada día (presente, retardo, falta, falta justificada o permiso) y, a
// quien trabaja por horas, las horas que dio. Al pagar la quincena se ve su asistencia.
let asistencia = {}; // fecha → { fecha, registros }
const asistMeses = new Set(); // meses ya leídos de Firestore
let asistFecha = todayStr();
let asistBorrador = null; // el día que se está marcando: { fecha, registros, cambiado }
async function cargarAsistenciaMes(ym) {
  if (asistMeses.has(ym)) return;
  const s = await db
    .collection("asistencia_personal")
    .where("fecha", ">=", ym + "-01")
    .where("fecha", "<=", ym + "-31")
    .get();
  s.docs.forEach((d) => (asistencia[d.id] = { ...d.data(), fecha: d.data().fecha || d.id }));
  asistMeses.add(ym);
}
function borradorDe(fecha) {
  if (!asistBorrador || asistBorrador.fecha !== fecha) {
    const d = asistencia[fecha];
    asistBorrador = { fecha, registros: JSON.parse(JSON.stringify((d && d.registros) || {})), cambiado: false };
  }
  return asistBorrador;
}
function cambiarDiaAsistencia(fecha) {
  if (!fecha) return;
  if (
    asistBorrador &&
    asistBorrador.cambiado &&
    asistBorrador.fecha !== fecha &&
    !confirm("No guardaste la asistencia del " + fechaCorta(asistBorrador.fecha) + ". ¿Cambiar de día sin guardar?")
  )
    return renderTabContent();
  asistBorrador = null;
  asistFecha = fecha;
  renderTabContent();
}
function marcarAsistencia(trabId, campo, valor) {
  const b = borradorDe(asistFecha);
  const r = b.registros[trabId] || {};
  if (campo === "estado" && r.estado === valor) delete b.registros[trabId];
  else {
    if (campo === "horas") valor = r2(numeroCorto(valor));
    b.registros[trabId] = { ...r, [campo]: valor };
    if (!b.registros[trabId].estado) b.registros[trabId].estado = "presente";
  }
  b.cambiado = true;
  if (campo === "estado") renderTabContent();
  else pintarEstadoGuardado();
}
function todosPresentes() {
  const b = borradorDe(asistFecha);
  trabajadoresActivos().forEach((t) => {
    if (!b.registros[t.id]) b.registros[t.id] = { estado: "presente" };
  });
  b.cambiado = true;
  renderTabContent();
}
function pintarEstadoGuardado() {
  const el = document.getElementById("asist-guardado");
  if (el && asistBorrador) el.innerHTML = asistBorrador.cambiado ? "⚠️ Sin guardar" : "✓ Guardado";
}
async function guardarAsistenciaDia() {
  const b = borradorDe(asistFecha);
  const registros = {};
  Object.entries(b.registros).forEach(([id, r]) => {
    if (!r || !ESTADOS_ASISTENCIA[r.estado]) return;
    const x = { estado: r.estado };
    if (r.horas > 0) x.horas = r2(r.horas);
    if (r.nota && String(r.nota).trim()) x.nota = String(r.nota).trim().slice(0, 200);
    registros[id] = x;
  });
  const datos = { fecha: b.fecha, registros, actualizadoPor: correoUsuario() };
  try {
    await db.collection("asistencia_personal").doc(b.fecha).set(datos);
    asistencia[b.fecha] = datos;
    b.cambiado = false;
    mostrarToast("✅ Asistencia del " + fechaCorta(b.fecha) + " guardada");
    renderTabContent();
  } catch (e) {
    alert("No se pudo guardar la asistencia: " + e.message);
  }
}
function renderAsistenciaNomina() {
  const ym = asistFecha.slice(0, 7);
  if (!asistMeses.has(ym)) {
    cargarAsistenciaMes(ym)
      .then(() => tabActual === "nomina" && subTab.nomina === "asistencia" && renderTabContent())
      .catch((e) => {
        asistMeses.add(ym);
        alert("No se pudo leer la asistencia: " + e.message);
      });
    return `<div class="loading" style="padding:1rem">Cargando asistencia…</div>`;
  }
  const b = borradorDe(asistFecha);
  const activos = trabajadoresActivos();
  const dia = new Date(asistFecha + "T12:00:00");
  const nombreDia = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"][dia.getDay()];
  const otroDia = (n) => {
    const d = new Date(asistFecha + "T12:00:00");
    d.setDate(d.getDate() + n);
    return (
      d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0")
    );
  };
  const marcados = activos.filter((t) => b.registros[t.id]).length;
  const fila = (t) => {
    const r = b.registros[t.id] || {};
    return `<div class="list-item asist-fila" data-trab="${t.id}" style="border-left-color:${r.estado ? ESTADOS_ASISTENCIA[r.estado].color : "#ccc"};padding:0.6rem 0.75rem">
      <div style="display:flex;justify-content:space-between;gap:0.5rem;align-items:center;flex-wrap:wrap">
        <div style="min-width:0"><div class="item-name" style="font-size:0.88rem">${escHtml(t.nombre)}</div><div class="item-sub">${escHtml(t.cargo) || ""}</div></div>
        <div style="display:flex;gap:0.25rem;flex-wrap:wrap">${Object.entries(ESTADOS_ASISTENCIA)
          .map(
            ([k, e]) =>
              `<button type="button" class="btn btn-sm asist-${k}" title="${e.nombre}" style="min-width:34px;padding:0.3rem 0.45rem;font-size:0.75rem;${r.estado === k ? `background:${e.color};color:#fff;border-color:${e.color}` : "background:#fff;color:#555;border:1px solid #d0d7e2"}" onclick="marcarAsistencia('${t.id}','estado','${k}')">${e.corto}</button>`
          )
          .join("")}</div>
      </div>
      ${
        horasDe(t).length || (r.estado && r.estado !== "presente")
          ? `<div style="display:flex;gap:0.4rem;margin-top:0.4rem">
        ${horasDe(t).length ? `<input class="inp" id="asist-h-${t.id}" inputmode="decimal" placeholder="Horas dadas" style="width:110px;padding:0.35rem 0.6rem;font-size:0.8rem" value="${r.horas ? String(r.horas).replace(".", ",") : ""}" oninput="marcarAsistencia('${t.id}','horas',this.value)"/>` : ""}
        ${r.estado && r.estado !== "presente" ? `<input class="inp" id="asist-n-${t.id}" placeholder="Motivo (opcional)" style="flex:1;padding:0.35rem 0.6rem;font-size:0.8rem" value="${escHtml(r.nota) || ""}" oninput="marcarAsistencia('${t.id}','nota',this.value)"/>` : ""}
      </div>`
          : ""
      }
    </div>`;
  };
  // Resumen del mes por trabajador
  const fin = ym + "-31";
  const resumen = activos.map((t) => ({ t, r: resumenAsistencia(asistencia, t.id, ym + "-01", fin) }));
  return `
  <div class="card" style="padding:0.75rem">
    <div style="display:flex;gap:0.4rem;align-items:center">
      <button class="btn btn-gray btn-sm" title="Día anterior" onclick="cambiarDiaAsistencia('${otroDia(-1)}')">◀</button>
      <input class="inp" type="date" id="asist-fecha" value="${asistFecha}" max="${todayStr()}" onchange="cambiarDiaAsistencia(this.value)" style="flex:1"/>
      <button class="btn btn-gray btn-sm" title="Día siguiente" onclick="cambiarDiaAsistencia('${otroDia(1)}')" ${asistFecha >= todayStr() ? "disabled" : ""}>▶</button>
    </div>
    <div style="font-size:0.78rem;color:#555;margin-top:0.35rem"><span style="text-transform:capitalize">${nombreDia}</span> · ${marcados} de ${activos.length} marcados · <span id="asist-guardado">${b.cambiado ? "⚠️ Sin guardar" : asistencia[asistFecha] ? "✓ Guardado" : "Sin registrar"}</span></div>
    <div style="font-size:0.7rem;color:#888;margin-top:0.2rem">${Object.values(ESTADOS_ASISTENCIA)
      .map((e) => `<strong>${e.corto}</strong> ${e.nombre}`)
      .join(" · ")}</div>
  </div>
  <div style="display:flex;gap:0.5rem;margin-bottom:0.6rem">
    <button class="btn btn-gray" style="flex:1" onclick="todosPresentes()">✓ Los demás, presentes</button>
    <button class="btn btn-primary" style="flex:1" onclick="guardarAsistenciaDia()">💾 Guardar el día</button>
  </div>
  <div class="list">${activos.map(fila).join("") || `<div class="empty"><p>Sin personal activo</p></div>`}</div>
  <div class="card asist-resumen" style="margin-top:0.75rem">
    <div class="card-title"><div class="card-bar"></div><h2>Resumen de ${escHtml(nombreMesYM(ym))}</h2></div>
    ${resumen
      .map(
        ({ t, r }) =>
          `<div class="info-row asist-res" data-trab="${t.id}"><span style="color:#333">${escHtml(t.nombre)}</span><span style="font-size:0.78rem;text-align:right">${r.dias ? `${r.presente} P · ${r.retardo} R · <strong style="color:${r.falta ? "#e53e3e" : "inherit"}">${r.falta} F</strong> · ${r.justificada} J · ${r.permiso} Pm${r.horas ? ` · ⏱️ ${String(r.horas).replace(".", ",")} h` : ""}` : `<span style="color:#aaa">sin registros</span>`}</span></div>`
      )
      .join("")}
    <button class="btn btn-print btn-sm" style="margin-top:0.5rem" onclick="imprimirAsistenciaMes('${ym}')">🖨️ Imprimir el mes</button>
  </div>`;
}
function imprimirAsistenciaMes(ym) {
  const activos = trabajadoresActivos();
  const fin = new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0).getDate();
  const dias = Array.from({ length: fin }, (_, i) => ym + "-" + String(i + 1).padStart(2, "0")).filter(
    (f) => asistencia[f]
  );
  const w = abrirVentanaImpresion("width=1000,height=800");
  if (!w) return alert("Permite las ventanas emergentes para imprimir");
  w.document
    .write(`<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>Asistencia ${escHtml(nombreMesYM(ym))}</title>
  <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Segoe UI',Arial,sans-serif;color:#222;background:#fff;padding:0.8rem}
  h1{font-size:0.9rem;color:#003366;margin-bottom:0.4rem}table{border-collapse:collapse;font-size:0.66rem;width:100%}
  th,td{border:1px solid #ccc;padding:0.15rem 0.2rem;text-align:center}td.n{text-align:left;white-space:nowrap}
  .F{color:#c00;font-weight:700}@page{size:letter landscape;margin:8mm}@media print{.no-print{display:none}}</style></head><body>
  <h1>${EMPRESA} · Asistencia del personal · ${escHtml(nombreMesYM(ym))}</h1>
  <table><tr><th>Trabajador</th>${dias.map((f) => `<th>${Number(f.slice(8))}</th>`).join("")}<th>P</th><th>R</th><th>F</th><th>J</th><th>Pm</th><th>Horas</th></tr>
  ${activos
    .map((t) => {
      const r = resumenAsistencia(asistencia, t.id, ym + "-01", ym + "-31");
      return `<tr><td class="n">${escHtml(t.nombre)}</td>${dias
        .map((f) => {
          const x = (asistencia[f].registros || {})[t.id];
          const e = x && ESTADOS_ASISTENCIA[x.estado];
          return `<td class="${e ? e.corto : ""}">${e ? e.corto + (x.horas ? `<br/>${String(x.horas).replace(".", ",")}h` : "") : ""}</td>`;
        })
        .join(
          ""
        )}<td>${r.presente}</td><td>${r.retardo}</td><td>${r.falta}</td><td>${r.justificada}</td><td>${r.permiso}</td><td>${r.horas ? String(r.horas).replace(".", ",") : ""}</td></tr>`;
    })
    .join("")}</table>
  <p style="font-size:0.62rem;color:#666;margin-top:0.4rem">P presente · R retardo · F falta · J falta justificada · Pm permiso o reposo · solo los días con asistencia registrada</p>
  <div class="no-print" style="text-align:center;padding:0.75rem"><button onclick="window.print()" style="background:#003366;color:#fff;border:none;padding:0.6rem 1.4rem;border-radius:8px;font-weight:700">🖨️ Imprimir / Guardar PDF</button></div>
  </body></html>`);
  w.document.close();
}
// En el pago: la asistencia del trabajador en ese período (y, si da horas de un solo nivel, usar las registradas)
async function infoAsistenciaPago(t, periodo) {
  const out = document.getElementById("pn-asist");
  const rango = rangoPeriodo(periodo);
  if (!out || !rango) return;
  out.innerHTML = "";
  try {
    await cargarAsistenciaMes(rango[0].slice(0, 7));
  } catch (e) {
    return;
  }
  const r = resumenAsistencia(asistencia, t.id, rango[0], rango[1]);
  if (!r.dias || document.getElementById("pn-trab").value !== t.id) return;
  const partes = [
    r.presente + " presente",
    r.retardo ? r.retardo + " retardo" + (r.retardo > 1 ? "s" : "") : "",
    r.falta
      ? r.falta + " falta" + (r.falta > 1 ? "s" : "") + " (" + r.faltas.map((f) => Number(f.slice(8))).join(", ") + ")"
      : "",
    r.justificada ? r.justificada + " justificada" + (r.justificada > 1 ? "s" : "") : "",
    r.permiso ? r.permiso + " permiso" + (r.permiso > 1 ? "s" : "") : "",
  ].filter(Boolean);
  out.innerHTML = `<div class="alert-item ${r.falta ? "alert-mora" : "alert-info"} pn-asist-info"><div>🗓️ Asistencia en ${escHtml(nombrePeriodo(periodo))}: ${partes.join(" · ")}${r.horas ? ` · <strong>${String(r.horas).replace(".", ",")} h</strong> registradas` : ""}${
    r.horas && pnHoras.length === 1
      ? ` <button type="button" class="btn btn-gray btn-sm" style="font-size:0.7rem;margin-left:0.3rem" onclick="document.getElementById('pn-h-0').value='${String(r.horas).replace(".", ",")}';calcNetoNomina()">Usar ${String(r.horas).replace(".", ",")} h</button>`
      : ""
  }${r.falta ? " · Si corresponde, descuéntalo en «Otro descuento»." : ""}</div></div>`;
}
