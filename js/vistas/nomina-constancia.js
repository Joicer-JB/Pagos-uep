// Nómina: constancia de trabajo. Ver vistas/nomina.js.

// ---- Constancia de trabajo: la firma la directora (Configuración → Institución). Se elige qué sueldo mostrar y en
// qué moneda; el monto va también en letras, como se acostumbra.
const SUELDO_CONSTANCIA = {
  completo: "Salario mensual completo (sueldo, bonos y horas)",
  base: "Solo sueldo y horas (sin bonos)",
  no: "No mostrar el salario",
};
const MONEDA_CONSTANCIA = { ambas: "En bolívares y su equivalente en $", bs: "Solo en bolívares", usd: "Solo en $" };
const TRATO_CONSTANCIA = { neutro: "el(la) ciudadano(a)", la: "la ciudadana", el: "el ciudadano" };
function renderModalConstanciaTrabajo(m) {
  const t = trabajadores.find((x) => x.id === m.id);
  if (!t) return "";
  const sel = (id, opciones, valor) =>
    `<select class="inp" id="${id}">${Object.entries(opciones)
      .map(([k, l]) => `<option value="${k}" ${k === valor ? "selected" : ""}>${escHtml(l)}</option>`)
      .join("")}</select>`;
  const faltan = [
    !configInst.directora && "el nombre de la directora",
    !configInst.cedulaDirectora && "la cédula de la directora",
    !configInst.rif && "el RIF del plantel",
  ].filter(Boolean);
  const tasa = tasaDe(todayStr());
  return `<div class="modal-bg" onclick="if(event.target.classList.contains('modal-bg'))cerrarModal()"><div class="modal">
    <div class="modal-header"><div><h3>📜 Constancia de trabajo</h3><p>${escHtml(t.nombre)}</p></div><button class="modal-close-x" onclick="cerrarModal()">✕</button></div>
    <div class="modal-body"><div class="form-grid">
      ${faltan.length ? `<div class="alert-item alert-info"><div>Falta ${faltan.join(", ")}: ponlo en ⚙️ Configuración → 🏫 Institución (mientras tanto sale una línea para escribirlo a mano).</div></div>` : ""}
      ${!t.fechaIngreso ? `<div class="alert-item alert-mora"><div>No tiene fecha de ingreso: edítalo (✏️) y ponla, o saldrá una línea en blanco.</div></div>` : ""}
      <div class="field"><label class="field-label">Dirigida a</label><input class="inp" id="ct-dirigida" value="A quien pueda interesar"/></div>
      <div class="form-row">
        <div class="field"><label class="field-label">Tratamiento</label>${sel("ct-trato", TRATO_CONSTANCIA, t.trato || "neutro")}</div>
        <div class="field"><label class="field-label">Cargo que dice</label><input class="inp" id="ct-cargo" value="${escHtml(t.cargo) || ""}" placeholder="Ej: Docente de aula"/></div>
      </div>
      <div class="field"><label class="field-label">Salario</label>${sel("ct-sueldo", SUELDO_CONSTANCIA, "completo")}</div>
      <div class="field"><label class="field-label">Moneda</label>${sel("ct-moneda", MONEDA_CONSTANCIA, tasa ? "ambas" : "usd")}</div>
      ${tasa ? `<div style="font-size:0.72rem;color:#888;margin-top:-0.3rem">Los bolívares salen a la tasa BCV del ${escHtml(fechaCorta(tasa.fecha))}: Bs. ${fmtTasa(tasa.valor)} por $.</div>` : `<div style="font-size:0.72rem;color:#b8860b;margin-top:-0.3rem">No hay tasa BCV de hoy: carga la tasa (💱) para poner el salario en bolívares.</div>`}
      ${
        clasesDe(t).length
          ? `<label style="display:flex;gap:0.5rem;align-items:center;font-size:0.82rem"><input type="checkbox" id="ct-clases" checked/> Decir qué clases da (${escHtml(
              clasesDe(t)
                .map((c) => materiaDe(c))
                .join(", ")
            )})</label>`
          : ""
      }
      ${t.activo === false ? `<div class="field"><label class="field-label">Fecha de egreso</label><input class="inp" type="date" id="ct-egreso" value="${escHtml(t.fechaEgreso) || ""}"/></div>` : ""}
    </div></div>
    <div class="modal-actions">
      <button class="btn btn-primary" style="flex:1" onclick="imprimirConstanciaTrabajo('${t.id}')">🖨️ Imprimir constancia</button>
      <button class="btn btn-gray" onclick="abrirModal({tipo:'ver-trabajador',id:'${t.id}'})">← Volver</button>
    </div>
  </div></div>`;
}
// «Docente de aula de 3er Grado; Matemáticas en 1er Año a 3er Año»
const textoClasesConstancia = (t) =>
  clasesDe(t)
    .map((c) => ((c.materia || "").trim() ? c.materia.trim() + " en " : "docente de aula en ") + textoGrados(c.grados))
    .join("; ");
function imprimirConstanciaTrabajo(trabId, opciones) {
  const t = trabajadores.find((x) => x.id === trabId);
  if (!t) return;
  const val = (id, def) => (document.getElementById(id) ? document.getElementById(id).value : def);
  const o = opciones || {
    dirigida: val("ct-dirigida", "A quien pueda interesar").trim(),
    trato: val("ct-trato", "neutro"),
    cargo: val("ct-cargo", t.cargo || "").trim(),
    sueldo: val("ct-sueldo", "completo"),
    moneda: val("ct-moneda", "ambas"),
    clases: !!(document.getElementById("ct-clases") || {}).checked,
    egreso: val("ct-egreso", ""),
  };
  const tasa = tasaDe(todayStr());
  const usd =
    o.sueldo === "no" ? 0 : r2(o.sueldo === "base" ? (t.salario || 0) + montoHorasMes(t) : devengadoMensual(t));
  const bs = tasa ? r2(usd * tasa.valor) : null;
  const moneda = o.moneda !== "usd" && bs == null ? "usd" : o.moneda;
  const linea = (txt) => (txt ? `<strong>${escHtml(txt)}</strong>` : "<span class='blanco'></span>");
  const conHoras = horasDe(t).length > 0;
  const montoUsd = `${fmt(usd)} (${escHtml(montoEnLetras(usd, "dólares").toUpperCase())})`;
  const montoBs = bs != null ? `${fmtBs(bs)} (${escHtml(montoEnLetras(bs, "bolívares").toUpperCase())})` : "";
  const salario =
    o.sueldo === "no" || !(usd > 0)
      ? ""
      : `, devengando ${conHoras ? "un ingreso mensual promedio" : "un salario mensual"} de <strong>${
          moneda === "usd" ? montoUsd : montoBs
        }</strong>${moneda === "ambas" ? `, equivalente a <strong>${fmt(usd)}</strong> a la tasa oficial del Banco Central de Venezuela del ${escHtml(fechaLarga(tasa.fecha))} (Bs. ${fmtTasa(tasa.valor)} por dólar)` : ""}`;
  const activo = t.activo !== false;
  const trato = TRATO_CONSTANCIA[o.trato] || TRATO_CONSTANCIA.neutro;
  const inst = configInst || {};
  const hoy = todayStr();
  const numero = "CT-" + hoy.replace(/-/g, "").slice(2) + "-" + String(t.id).slice(-4).toUpperCase();
  const dia = Number(hoy.slice(8, 10));
  const w = abrirVentanaImpresion("width=720,height=1000");
  if (!w) return alert("Permite las ventanas emergentes para imprimir");
  w.document
    .write(`<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>Constancia de trabajo - ${escHtml(t.nombre)}</title>
  <style>*{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Times New Roman',serif;background:#fff;color:#222;padding:2.2rem 2.5rem;max-width:720px;margin:0 auto;font-size:12pt;line-height:1.6}
  .membrete{display:flex;align-items:center;gap:1rem;margin-bottom:1.2rem;padding-bottom:0.9rem;border-bottom:3px double #003366}
  .logo{width:72px;height:72px;object-fit:contain;flex-shrink:0}.org{text-align:center;flex:1}
  .org-name{font-size:11pt;font-weight:bold;color:#003366;text-transform:uppercase;line-height:1.3}.org-sub{font-size:9pt;color:#555;margin-top:3px}
  .num{text-align:right;font-size:9pt;color:#777;margin-bottom:0.8rem}
  .titulo{text-align:center;margin:1.4rem 0 1.6rem;font-size:15pt;font-weight:bold;color:#003366;text-transform:uppercase;letter-spacing:3px;text-decoration:underline;text-underline-offset:6px}
  .dirigida{font-weight:bold;margin-bottom:1rem}
  .cuerpo{text-align:justify;line-height:2;margin:1rem 0;text-indent:2.5rem}
  .nombre{font-weight:bold;text-transform:uppercase}
  .blanco{display:inline-block;min-width:9rem;border-bottom:1px solid #333}
  .firma{margin:3.5rem auto 0;width:60%;text-align:center}.fline{border-top:1px solid #333;margin-bottom:5px}
  .fnom{font-weight:bold;font-size:11pt}.fcar{font-size:10pt;color:#333}
  .pie{text-align:center;font-size:8pt;color:#888;margin-top:2.5rem;padding-top:0.6rem;border-top:1px solid #ddd}
  @page{margin:18mm}@media print{body{padding:0}.no-print{display:none}}
  </style></head><body>
  <div class="membrete">
    <img src="data:image/png;base64,${LOGO}" class="logo" alt="Logo"/>
    <div class="org">
      <div style="font-size:8pt;color:#555">REPÚBLICA BOLIVARIANA DE VENEZUELA</div>
      <div style="font-size:8pt;color:#555">MINISTERIO DEL PODER POPULAR PARA LA EDUCACIÓN</div>
      <div class="org-name">${escHtml(inst.nombre || EMPRESA)}</div>
      <div class="org-sub">${escHtml(inst.direccion || EMPRESA_SUB)}${inst.rif ? " · R.I.F.: " + escHtml(inst.rif) : ""}${inst.codigo ? " · Código: " + escHtml(inst.codigo) : ""}</div>
    </div>
    <img src="data:image/png;base64,${LOGO}" class="logo" alt="Logo"/>
  </div>
  <div class="num">N° ${numero}</div>
  <div class="titulo">Constancia de trabajo</div>
  <div class="dirigida">${escHtml(o.dirigida || "A quien pueda interesar")}</div>
  <p class="cuerpo">Quien suscribe, ${linea(inst.directora)}, titular de la cédula de identidad N° ${linea(inst.cedulaDirectora)}, en su carácter de Director(a) de la <strong>${escHtml(inst.nombre || EMPRESA)}</strong>, hace constar por medio de la presente que ${trato} <span class="nombre">${escHtml(t.nombre)}</span>, titular de la cédula de identidad N° ${linea(t.cedula)}${t.rif ? ` y R.I.F. N° <strong>${escHtml(t.rif)}</strong>` : ""}, ${activo ? "presta sus servicios" : "prestó sus servicios"} en esta institución desde el ${linea(fechaLarga(t.fechaIngreso))}${activo ? " hasta la presente fecha" : " hasta el " + linea(fechaLarga(o.egreso))}, ${activo ? "desempeñando" : "desempeñándose en"} el cargo de ${linea(o.cargo)}${o.clases && clasesDe(t).length ? ` (${escHtml(textoClasesConstancia(t))})` : ""}${activo ? salario : ""}.</p>
  <p class="cuerpo">Constancia que se expide a petición de la parte interesada, en ${escHtml((inst.direccion || "Turumo, Estado Miranda").split(",")[0])}, ${dia === 1 ? "al primer (1) día" : "a los " + escHtml(numeroEnLetras(dia)) + " (" + dia + ") días"} del mes de ${escHtml(MESES[Number(hoy.slice(5, 7)) - 1].toLowerCase())} de ${hoy.slice(0, 4)}.</p>
  <div class="firma"><div class="fline"></div>
    <div class="fnom">${escHtml(inst.directora || "")}</div>
    <div class="fcar">Director(a)${inst.cedulaDirectora ? " · C.I. " + escHtml(inst.cedulaDirectora) : ""}</div>
    <div class="fcar">${escHtml(inst.nombre || EMPRESA)}</div></div>
  <div class="pie">Sello de la institución · ${escHtml(inst.nombre || EMPRESA)} · ${escHtml(inst.direccion || EMPRESA_SUB)}</div>
  <div class="no-print" style="text-align:center;padding:1rem"><button onclick="window.print()" style="background:#003366;color:#fff;border:none;padding:0.65rem 1.5rem;border-radius:8px;font-weight:700;font-family:sans-serif">🖨️ Imprimir / Guardar PDF</button></div>
  </body></html>`);
  w.document.close();
}
