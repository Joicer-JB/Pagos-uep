// Boletín de calificaciones para los representantes de media general, con el escudo del colegio (el de preescolar y
// primaria está en boletin-primaria.js).
// Hoja carta vertical: encabezado con el escudo, ficha del estudiante, resumen (promedio general, materias aprobadas y
// promedio de cada lapso), las notas y, al pie, observaciones, firmas y sello. Las notas de media general salen de
// servicios/calificaciones.js (ya con los cambios del consejo, sin marcarlos: eso solo se ve en la sábana). En el
// boletín las notas van en números enteros (9,5 → 10) y los promedios con un decimal, como en la sábana. También se
// imprimen los de todo un grado de una vez.

// En preescolar y primaria el boletín es de un lapso (el que está elegido en la pestaña Notas): ver boletin-primaria.js
function imprimirBoletin(estId, lapso) {
  const est = estudiantes.find((e) => e.id === estId);
  if (!est) {
    alert("Estudiante no encontrado");
    return;
  }
  const nivel = getNivel(est.grado);
  if (nivel === "primaria" || nivel === "preescolar") {
    imprimirBoletinPrimaria(est, lapso);
  } else {
    imprimirBoletinMedia(est);
  }
}
function imprimirBoletinMedia(est) {
  abrirBoletines("Boletín " + est.nombre, [cuerpoBoletinMedia(est)]);
}
// Los boletines de todos los estudiantes inscritos de un grado, uno por hoja y en orden alfabético
function imprimirBoletinesGrado(grado, lapso) {
  const lista = estudiantes.filter((e) => activo(e) && e.grado === grado).sort(ordenNombre);
  if (!lista.length) return alert("No hay estudiantes inscritos en " + grado);
  if (getNivel(grado) !== "media")
    return abrirBoletinesPrimaria(
      `Boletines ${grado} · ${lapso || LAPSOS[0]}`,
      lista.map((e) => cuerpoBoletinPrimaria(e, lapso))
    );
  abrirBoletines("Boletines " + grado, lista.map(cuerpoBoletinMedia));
}

const ESTILOS_BOLETIN = `
  *{margin:0;padding:0;box-sizing:border-box}
  html{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  body{font-family:"Segoe UI",Arial,sans-serif;color:#1c2333;font-size:11px;background:#fff}
  .b-hoja{position:relative;padding:14px 16px 12px;overflow:hidden;min-height:100%}
  .b-hoja+.b-hoja{break-before:page;page-break-before:always}
  .b-marca{position:absolute;left:50%;top:118px;width:58%;transform:translateX(-50%);opacity:.14;pointer-events:none;z-index:0}
  .b-hoja>*:not(.b-marca){position:relative;z-index:1}
  .b-enc{display:flex;align-items:center;gap:14px}
  .b-escudo{width:78px;height:78px;object-fit:contain;flex-shrink:0}
  .b-inst{flex:1;text-align:center}
  .b-rep{font-size:8.5px;letter-spacing:.12em;text-transform:uppercase;color:#5b6577}
  .b-inst h1{font-family:Georgia,"Times New Roman",serif;font-size:21px;color:#003366;margin:3px 0 2px;letter-spacing:.01em}
  .b-dir{font-size:9px;color:#5b6577}
  .b-sello{width:112px;flex-shrink:0;text-align:center;border:2px solid #003366;border-radius:10px;padding:6px 4px;background:linear-gradient(180deg,#003366,#00509e);color:#fff}
  .b-sello span{display:block;font-size:8px;letter-spacing:.14em;text-transform:uppercase;opacity:.85}
  .b-sello strong{display:block;font-family:Georgia,serif;font-size:13px;color:#ffd700;margin:1px 0 3px}
  .b-sello em{display:block;font-style:normal;font-size:10px;font-weight:700;background:#ffd700;color:#003366;border-radius:5px;padding:1px 0}
  .b-franja{height:5px;margin:9px 0 10px;border-radius:3px;background:linear-gradient(90deg,#f5c400 0 33.3%,#0b3d91 33.3% 66.6%,#c8102e 66.6%)}
  .b-est{display:grid;grid-template-columns:1.1fr 1fr .9fr 1.4fr 1fr;gap:6px 12px;border:1px solid #d9e2f1;border-radius:10px;padding:9px 12px;background:rgba(240,244,255,.55)}
  .b-est .b-nombre{grid-column:1/-1;display:flex;justify-content:space-between;align-items:baseline;border-bottom:1px dashed #c8d3e8;padding-bottom:5px;margin-bottom:2px}
  .b-nombre strong{font-family:Georgia,serif;font-size:16px;color:#003366}
  .b-nombre span{font-size:10px;color:#5b6577}
  .b-dato label{display:block;font-size:7.5px;letter-spacing:.1em;text-transform:uppercase;color:#7a8599}
  .b-dato div{font-weight:700;font-size:10.5px}
  .b-kpis{display:grid;grid-template-columns:1.3fr 1fr repeat(3,.8fr);gap:7px;margin:10px 0}
  .b-kpi{border:1px solid #d9e2f1;border-radius:10px;padding:7px 8px;text-align:center;background:rgba(255,255,255,.6)}
  .b-kpi label{display:block;font-size:7.5px;letter-spacing:.1em;text-transform:uppercase;color:#7a8599}
  .b-kpi strong{display:block;font-family:Georgia,serif;font-size:19px;color:#003366;line-height:1.15}
  .b-kpi small{font-size:8.5px;color:#7a8599}
  .b-kpi.prom{background:linear-gradient(135deg,#003366,#00509e);border-color:#003366}
  .b-kpi.prom label,.b-kpi.prom small{color:#cfe0ff}.b-kpi.prom strong{color:#ffd700;font-size:24px}
  table.b-notas{width:100%;border-collapse:separate;border-spacing:0;border:1px solid #c8d3e8;border-radius:10px;overflow:hidden;background:rgba(255,255,255,.6)}
  .b-notas th{background:#003366;color:#fff;font-size:8.5px;letter-spacing:.06em;text-transform:uppercase;padding:6px 4px;font-weight:700;white-space:nowrap}
  .b-notas th.izq,.b-notas td.izq{text-align:left;padding-left:9px}
  .b-notas td{padding:5px 4px;text-align:center;border-top:1px solid #e3e9f4;font-size:10.5px}
  .b-notas tbody tr:nth-child(even) td{background:rgba(240,244,255,.6)}
  .b-notas td.mat{font-weight:600}
  .b-num{color:#9aa5b8;font-size:9px;width:18px}
  .b-n{font-weight:700}.b-n.rep{color:#c0392b}.b-n.vacia{color:#b6bfcd;font-weight:400}
  .b-ina{color:#7a8599;font-size:9px}
  .b-def{display:flex;align-items:center;gap:6px;justify-content:center}
  .b-def strong{min-width:26px;font-size:12px;color:#003366}.b-def strong.rep{color:#c0392b}
  .b-barra{width:58px;height:6px;border-radius:3px;background:#e3e9f4;overflow:hidden}
  .b-barra i{display:block;height:100%;border-radius:3px;background:linear-gradient(90deg,#00509e,#1a9e5c)}
  .b-barra i.rep{background:#e57373}
  .b-sit{font-size:8.5px;font-weight:700;border-radius:20px;padding:2px 7px;white-space:nowrap}
  .b-sit.ok{background:#e6f7ef;color:#1a7a4a}.b-sit.pend{background:#fdecea;color:#c0392b}
  .b-puestos{width:100%;border-collapse:separate;border-spacing:0;border:1px solid #d9e2f1;border-radius:10px;overflow:hidden;margin:0 0 10px;background:rgba(255,255,255,.6)}
  .b-puestos th{background:#f0f4ff;color:#003366;font-size:8px;letter-spacing:.08em;text-transform:uppercase;padding:4px;font-weight:700}
  .b-puestos td{text-align:center;padding:4px;border-top:1px solid #e3e9f4;font-size:10.5px}
  .b-puestos td.izq,.b-puestos th.izq{text-align:left;padding-left:9px}
  .b-puestos strong{font-family:Georgia,serif;font-size:13px;color:#003366}.b-puestos small{color:#7a8599;font-size:8.5px}
  .b-caja-info{margin-top:8px;border:1px solid #d9e2f1;border-radius:10px;padding:6px 10px;font-size:10px;background:rgba(255,255,255,.6)}
  .b-caja-info label{display:block;font-size:7.5px;letter-spacing:.1em;text-transform:uppercase;color:#7a8599;margin-bottom:2px}
  .b-caja-info table{width:100%;border-collapse:collapse}.b-caja-info td{padding:2px 4px;border-top:1px solid #eef2f9}
  .b-aviso{margin-top:8px;padding:6px 10px;border-radius:8px;background:#fff4e5;border-left:4px solid #e67e22;font-size:10px}
  .b-escala{margin-top:6px;font-size:8.5px;color:#7a8599;text-align:right}
  .b-obs{margin-top:10px;border:1px solid #d9e2f1;border-radius:10px;padding:7px 10px}
  .b-obs label{font-size:8px;letter-spacing:.1em;text-transform:uppercase;color:#7a8599}
  .b-obs .linea{border-bottom:1px solid #c8d3e8;height:17px}
  .b-firmas{display:flex;justify-content:space-between;align-items:flex-end;gap:10px;margin-top:26px}
  .b-firma{flex:1;text-align:center;font-size:9px;color:#5b6577}
  .b-firma .l{border-top:1px solid #1c2333;padding-top:3px;font-weight:700;color:#1c2333;font-size:9.5px;min-height:17px}
  .b-sello-plantel{width:78px;height:78px;border:1.5px dashed #9aa5b8;border-radius:50%;display:flex;align-items:center;justify-content:center;text-align:center;font-size:8px;color:#9aa5b8;flex-shrink:0}
  .b-pie{margin-top:10px;display:flex;justify-content:space-between;font-size:8px;color:#9aa5b8;border-top:1px solid #e3e9f4;padding-top:4px}
  .b-lit{display:inline-block;min-width:20px;border-radius:5px;font-weight:800;font-size:10px;padding:1px 0}
  .b-lit.A{background:#e6f7ef;color:#1a7a4a}.b-lit.B{background:#e8f0fe;color:#003366}.b-lit.C{background:#fff8e1;color:#8a6d00}
  .b-lit.D{background:#fff0e0;color:#c25e00}.b-lit.E{background:#fdecea;color:#c0392b}
  .b-area{background:#f0f4ff!important;color:#003366;font-weight:800;font-size:9px;text-align:left;padding-left:9px;width:118px;vertical-align:middle}
  .b-leyenda{margin-top:8px;display:grid;grid-template-columns:repeat(5,1fr);gap:5px}
  .b-leyenda div{border:1px solid #e3e9f4;border-radius:8px;padding:4px 6px;font-size:8px;color:#5b6577;line-height:1.3}
  .b-prom{margin-top:8px;display:flex;gap:16px;align-items:center;border:1px solid #d9e2f1;border-radius:10px;padding:7px 10px;font-size:10px}
  .b-caja{display:inline-block;width:11px;height:11px;border:1.5px solid #003366;border-radius:2px;vertical-align:-2px;margin-right:4px}
  .no-print{margin:10px 16px 0;padding:7px 16px;background:#003366;color:#fff;border:none;border-radius:8px;font-size:12px;cursor:pointer}
  /* Sin márgenes de página: así el navegador no imprime su encabezado y pie (fecha, título y la dirección de la
     página). El margen lo da cada hoja. */
  @page{size:letter portrait;margin:0}
  @media print{.no-print{display:none!important}.b-hoja{padding:9mm 10mm 8mm}}`;

function abrirBoletines(titulo, cuerpos) {
  const w = abrirVentanaImpresion();
  w.document
    .write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${escHtml(titulo)}</title><style>${ESTILOS_BOLETIN}</style></head><body>
    <button class="no-print" onclick="window.print()">🖨️ Imprimir${cuerpos.length > 1 ? " los " + cuerpos.length + " boletines" : ""}</button>
    ${cuerpos.join("")}
  </body></html>`);
  w.document.close();
  setTimeout(() => w.print(), 600);
}

const ORDINAL_LAPSO = ["1er", "2do", "3er"];
const anioBoletin = (est) =>
  est.anioEscolar || (configInst || {}).anioEscolar || (escCfg && escCfg.actual.nombre) || "";
function encabezadoBoletin(est, nivelTexto) {
  const inst = configInst || {};
  const extra = [
    inst.direccion || "Turumo - Caucagüita, Estado Miranda",
    "Código del plantel " + (inst.codigo || "PD13831519"),
  ].filter(Boolean); // el RIF va en los recibos, no en el boletín
  return `<img class="b-marca" src="data:image/png;base64,${LOGO}" alt=""/>
  <header class="b-enc">
    <img class="b-escudo" src="data:image/png;base64,${LOGO}" alt="Escudo"/>
    <div class="b-inst">
      <div class="b-rep">República Bolivariana de Venezuela · Ministerio del Poder Popular para la Educación</div>
      <h1>${escHtml(inst.nombre || "U.E.P. Josefa Joaquina Sánchez")}</h1>
      <div class="b-dir">${extra.map(escHtml).join(" · ")}</div>
    </div>
    <div class="b-sello"><span>Boletín de</span><strong>Calificaciones</strong><span>${escHtml(nivelTexto)}</span><em>${escHtml(anioBoletin(est))}</em></div>
  </header>
  <div class="b-franja"></div>
  <section class="b-est">
    <div class="b-nombre"><strong>${escHtml(est.nombre)}</strong><span>${escHtml(est.grado || "")} · Sección ${escHtml(est.seccion || "U")}</span></div>
    <div class="b-dato"><label>Cédula</label><div>${escHtml(est.cedula || "—")}</div></div>
    <div class="b-dato"><label>Fecha de nacimiento</label><div>${escHtml(est.fechaNac ? fechaCorta(est.fechaNac) : "—")}</div></div>
    <div class="b-dato"><label>Año escolar</label><div>${escHtml(anioBoletin(est) || "—")}</div></div>
    <div class="b-dato"><label>Representante</label><div>${escHtml(est.acudiente || "—")}</div></div>
    <div class="b-dato"><label>C.I. del representante</label><div>${escHtml(est.cedulaAcudiente || "—")}</div></div>
  </section>`;
}
function pieBoletin(firmas) {
  return `<div class="b-obs"><label>Observaciones</label><div class="linea"></div><div class="linea"></div></div>
  <div class="b-firmas">
    ${firmas.map(([nombre, cargo]) => `<div class="b-firma"><div class="l">${escHtml(nombre || " ")}</div>${escHtml(cargo)}</div>`).join("")}
    <div class="b-sello-plantel">Sello del<br/>plantel</div>
  </div>
  <div class="b-pie"><span>Emitido el ${fechaLarga(todayStr())}</span><span>${escHtml((configInst || {}).nombre || EMPRESA)}</span></div>`;
}

// ---- Media general ----
// Nota entera del boletín: la de la sábana (un decimal) redondeada; desde ,5 sube (9,5 → 10)
const notaEntera = (v) => (v === null || v === undefined ? null : Math.round(v + 1e-9));
function cuerpoBoletinMedia(est) {
  const inst = configInst || {};
  const areas = getAreas(est.grado);
  const defs = areas.map((m) => {
    const d = definitivaDe(est, m);
    return { m, d, nota: notaEntera(d.nota), lapsos: d.lapsos.map((x) => notaEntera(x.nota)) };
  });
  // Inasistencias de cada materia en cada lapso (se cargan en Notas); la columna sale siempre, en blanco si no hay
  const ina = (l, m) => Number((notas[`${est.id}_${l}`] || {})[m + "_ina"]) || 0;
  const conNota = defs.filter(({ nota }) => nota !== null);
  const aprobadas = conNota.filter(({ nota }) => nota >= 10);
  const pendientes = conNota.filter(({ nota }) => nota < 10);
  const prom = promedioEstudiante(est, areas);
  const promLapso = LAPSOS.map((l, i) => promedioDeNotas(defs.map(({ d }) => d.lapsos[i].nota)));
  const n = (v) =>
    `<span class="b-n ${v === null ? "vacia" : v < 10 ? "rep" : ""}">${v === null ? "—" : textoNota(v)}</span>`;
  const filas = defs
    .map(({ m, nota: nf, lapsos }, i) => {
      return `<tr><td class="b-num">${i + 1}</td><td class="izq mat">${escHtml(m)}</td>
      ${lapsos.map((x, li) => `<td>${n(x)}</td><td class="b-ina">${ina(LAPSOS[li], m) || ""}</td>`).join("")}
      <td><div class="b-def"><strong class="${nf !== null && nf < 10 ? "rep" : ""}">${nf === null ? "—" : textoNota(nf)}</strong><span class="b-barra"><i class="${nf !== null && nf < 10 ? "rep" : ""}" style="width:${nf === null ? 0 : Math.max(0, Math.min(100, (nf / 20) * 100))}%"></i></span></div></td>
      <td>${nf === null ? "" : nf >= 10 ? '<span class="b-sit ok">Aprobada</span>' : '<span class="b-sit pend">Pendiente</span>'}</td></tr>`;
    })
    .join("");
  // Puesto por promedio en su salón (año y sección) y en toda media general, en el año y en cada lapso
  const periodos = [["anio", "Año completo"], ...LAPSOS.map((l, i) => [l, (ORDINAL_LAPSO[i] || l) + " lapso"])];
  const puestos = periodos.map(([p]) => puestosEstudiante(est, p));
  const celdaPuesto = (x) => (x ? `<strong>${x.puesto}°</strong> <small>de ${x.total}</small>` : "—");
  const salon = `${est.grado || ""} «${seccionDe(est)}»`;
  // Área a revisar: las materias con definitiva por debajo de 10, con la nota de la revisión si ya la presentó
  const revision = pendientes.length
    ? `<div class="b-caja-info"><label>Área a revisar</label><table>${pendientes
        .map(({ m, nota }) => {
          const r = notaRevisionDe(est, m);
          const rv = notaEntera(r);
          return `<tr><td class="izq"><strong>${escHtml(m)}</strong></td><td>Definitiva: <span class="b-n rep">${textoNota(nota)}</span></td><td>Nota de revisión: ${rv === null ? "<em>por presentar</em>" : `<span class="b-n ${rv < 10 ? "rep" : ""}">${textoNota(rv)}</span>`}</td><td>${rv === null ? "" : rv >= 10 ? '<span class="b-sit ok">Aprobada en revisión</span>' : '<span class="b-sit pend">No aprobada</span>'}</td></tr>`;
        })
        .join("")}</table></div>`
    : "";
  // Materia pendiente del año anterior (ficha del estudiante). Los docentes no tienen ese dato: queda en blanco.
  const pa = est.pendienteAnterior;
  const pendAnterior = !pa
    ? "_______________"
    : pa.aplica
      ? `<strong>Aplica</strong> · ${escHtml(pa.materia || "—")} · Nota: ${pa.nota === null || pa.nota === undefined || pa.nota === "" ? "<em>por presentar</em>" : `<span class="b-n ${pa.nota < 10 ? "rep" : ""}">${textoNota(notaEntera(Number(pa.nota)))}</span>`}`
      : "<strong>No aplica</strong>";
  return `<section class="b-hoja">
  ${encabezadoBoletin(est, "Media General")}
  <div class="b-kpis">
    <div class="b-kpi prom"><label>Promedio general</label><strong>${prom === null ? "—" : textoNota(prom)}</strong><small>sobre 20 puntos</small></div>
    <div class="b-kpi"><label>Materias aprobadas</label><strong>${aprobadas.length}<small> / ${conNota.length || areas.length}</small></strong><small>${pendientes.length ? pendientes.length + " pendiente" + (pendientes.length > 1 ? "s" : "") : "ninguna pendiente"}</small></div>
    ${LAPSOS.map((l, i) => `<div class="b-kpi"><label>${escHtml(l)}</label><strong>${promLapso[i] === null ? "—" : textoNota(promLapso[i])}</strong><small>promedio</small></div>`).join("")}
  </div>
  <table class="b-puestos">
    <thead><tr><th class="izq">Puesto por promedio</th>${periodos.map(([, t]) => `<th>${escHtml(t)}</th>`).join("")}</tr></thead>
    <tbody>
      <tr><td class="izq">En su salón (${escHtml(salon)})</td>${puestos.map((x) => `<td>${celdaPuesto(x.salon)}</td>`).join("")}</tr>
      <tr><td class="izq">En el colegio (media general)</td>${puestos.map((x) => `<td>${celdaPuesto(x.colegio)}</td>`).join("")}</tr>
    </tbody>
  </table>
  <table class="b-notas">
    <thead><tr><th>#</th><th class="izq">Área de formación</th>${LAPSOS.map((l, i) => `<th>${ORDINAL_LAPSO[i] || l} lapso</th><th>Inas.</th>`).join("")}<th>Definitiva</th><th>Situación</th></tr></thead>
    <tbody>${filas}</tbody>
  </table>
  ${revision}
  <div class="b-caja-info"><label>Materia pendiente del año anterior</label>${pendAnterior}</div>
  <div class="b-escala">Escala de 01 a 20 puntos · Mínima aprobatoria: 10 puntos · Notas en enteros · Promedios con un decimal</div>
  ${pieBoletin([
    [inst.directora || "Lic. Ligia Herrera", "Directora"],
    [inst.coordinador || "Lic. Carlos Carrascal", "Coordinación de Media General"],
  ])}
  </section>`;
}
