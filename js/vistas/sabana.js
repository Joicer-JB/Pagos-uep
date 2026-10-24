// 📋 Sábana de notas (solo media general): todas las notas de una sección en una tabla, para el consejo de sección con
// los docentes (el boletín es para los representantes). Tres formas de verla:
// · Todo el año: por materia, 1er, 2do y 3er lapso y la definitiva; al final, el promedio del estudiante.
// · Un lapso: la nota de ese lapso en cada materia y el promedio del lapso.
// · Una materia: cada evaluación que puso el profesor (con su %), la nota de cada lapso y la definitiva.
// Al tocar el nombre de un estudiante se ve su detalle completo. El director cambia una nota tocándola (ajuste del
// consejo: queda la nota original, el motivo, quién y cuándo). Los cálculos están en servicios/calificaciones.js.

const VISTAS_SABANA = [["anio", "Todo el año"], ...LAPSOS.map((l) => [l, l]), ["materia", "Detalle por materia"]];

function gradosSabana() {
  const g = new Set(
    estudiantes
      .filter(activo)
      .map((e) => e.grado)
      .filter((x) => x && getNivel(x) === "media")
  );
  Object.keys(configMaterias || {}).forEach((x) => getNivel(x) === "media" && g.add(x));
  return [...g].sort(ordenGrados);
}
const seccionesSabana = (grado) =>
  [...new Set(estudiantes.filter((e) => activo(e) && e.grado === grado).map((e) => e.seccion || ""))].sort();
const estudiantesSabana = (grado, seccion) =>
  estudiantes
    .filter((e) => activo(e) && e.grado === grado && (!seccion || (e.seccion || "") === seccion))
    .sort(ordenNombre);
const puedeAjustarConsejo = () => rolUsuario === "director" && !soloLectura();
const promedioDeNotas = (lista) => {
  const v = lista.filter((x) => x !== null && x !== undefined);
  return v.length ? unDecimal(v.reduce((a, b) => a + b, 0) / v.length) : null;
};

// Lo que muestra la sábana, igual para la pantalla, la impresión y el Excel:
// {cabecera: [[{t, cs, rs}]], filas: [{est, celdas: [{v, ajuste, faltan, lapso, materia, tipo}]}], pie: [[...]]}
function datosSabana(grado, seccion, ver, materia) {
  const lista = estudiantesSabana(grado, seccion);
  const areas = getAreas(grado);
  const fijas = [
    { t: "N°", rs: 2 },
    { t: "Estudiante", rs: 2 },
    { t: "Cédula", rs: 2 },
  ];
  const nota = (info, m, lapso, tipo) => ({
    v: info.nota,
    ajuste: info.ajuste,
    calculada: info.calculada,
    faltan: info.faltan || 0,
    materia: m,
    lapso,
    tipo: tipo || "nota",
  });
  let cabecera, filas;
  if (ver === "materia") {
    const m = areas.includes(materia) ? materia : areas[0];
    const planes = LAPSOS.map((l) => planEvaluacion(grado, m, l));
    cabecera = [
      [...fijas, ...LAPSOS.map((l, i) => ({ t: l, cs: planes[i].length + 1 })), { t: "Definitiva", rs: 2 }],
      planes.flatMap((p) => [
        ...p.map((ev) => ({ t: ev.nombre + (Number(ev.peso) > 0 ? " " + ev.peso + "%" : "") })),
        { t: "Nota" },
      ]),
    ];
    filas = lista.map((est) => {
      const d = definitivaDe(est, m);
      return {
        est,
        celdas: [
          ...d.lapsos.flatMap((x, i) => [
            ...x.evaluaciones.map((ev) => ({ v: ev.nota, tipo: "eval" })),
            nota(x, m, LAPSOS[i], "lapso"),
          ]),
          nota(d, m, LAPSO_DEF, "def"),
        ],
      };
    });
  } else if (LAPSOS.includes(ver)) {
    cabecera = [
      [
        ...fijas.map((c) => ({ ...c, rs: 1 })),
        ...areas.map((m) => ({ t: m })),
        { t: "Promedio del lapso", tipo: "prom" },
      ],
    ];
    filas = lista.map((est) => {
      const celdas = areas.map((m) => nota(notaLapsoDe(est, m, ver), m, ver));
      return { est, celdas: [...celdas, { v: promedioDeNotas(celdas.map((c) => c.v)), tipo: "prom" }] };
    });
  } else {
    cabecera = [
      [...fijas, ...areas.map((m) => ({ t: m, cs: LAPSOS.length + 1 })), { t: "Promedio", rs: 2 }],
      areas.flatMap(() => [...LAPSOS.map((l, i) => ({ t: i + 1 + "° L" })), { t: "Def." }]),
    ];
    filas = lista.map((est) => ({
      est,
      celdas: [
        ...areas.flatMap((m) => {
          const d = definitivaDe(est, m);
          return [...d.lapsos.map((x, i) => nota(x, m, LAPSOS[i])), nota(d, m, LAPSO_DEF, "def")];
        }),
        { v: promedioEstudiante(est, areas), tipo: "prom" },
      ],
    }));
  }
  // Pie: promedio de cada columna y cuántos quedaron por debajo de 10
  const columnas = filas.length ? filas[0].celdas.length : 0;
  const col = (i) => filas.map((f) => f.celdas[i].v).filter((v) => v !== null);
  const pie = [
    { t: "Promedio de la sección", celdas: [...Array(columnas).keys()].map((i) => promedioDeNotas(col(i))) },
    {
      t: "Reprobados (menos de 10)",
      celdas: [...Array(columnas).keys()].map((i) => col(i).filter((v) => v < 10).length),
    },
  ];
  return { cabecera, filas, pie, materia: ver === "materia" ? (areas.includes(materia) ? materia : areas[0]) : "" };
}

// Ajustes del consejo de los estudiantes de la sábana (para la lista de abajo y el acta)
function ajustesSabana(grado, seccion) {
  const r = [];
  estudiantesSabana(grado, seccion).forEach((est) =>
    [...LAPSOS, LAPSO_DEF].forEach((l) => {
      const c = (notas[`${est.id}_${l}`] || {}).consejo || {};
      Object.entries(c).forEach(([m, a]) => a && r.push({ est, materia: m, lapso: l, a }));
    })
  );
  return r;
}

const tituloCelda = (c) =>
  c.ajuste
    ? `Cambiada por el consejo (antes ${c.ajuste.original ?? "-"}): ${c.ajuste.motivo || ""}`
    : c.faltan
      ? `Faltan ${c.faltan} evaluación(es) por nota`
      : "";
const textoNota = (v) => (v === null || v === undefined ? "-" : String(v).replace(".", ","));

// HTML de la tabla. enPantalla: con los toques (detalle del estudiante y ajuste del consejo)
function htmlTablaSabana(d, enPantalla) {
  const ajustar = enPantalla && puedeAjustarConsejo();
  const th = (c) =>
    `<th${c.cs > 1 ? ` colspan="${c.cs}"` : ""}${c.rs > 1 ? ` rowspan="${c.rs}"` : ""}>${escHtml(c.t)}</th>`;
  const td = (c) => {
    if (c.tipo === "eval")
      return `<td class="sab-eval${c.v !== null && c.v < 10 ? " sab-rep" : ""}">${textoNota(c.v)}</td>`;
    const clases = [
      "sab-n",
      c.tipo === "def" ? "sab-def" : "",
      c.tipo === "lapso" ? "sab-lapso" : "",
      c.tipo === "prom" ? "sab-prom" : "",
      c.v !== null && c.v < 10 ? "sab-rep" : "",
      c.ajuste ? "sab-aj" : "",
      c.faltan ? "sab-parcial" : "",
      ajustar && c.materia ? "sab-toca" : "",
    ]
      .filter(Boolean)
      .join(" ");
    const t = tituloCelda(c);
    const clic =
      ajustar && c.materia ? ` onclick="abrirAjusteConsejo('${c.estId}','${escJs(c.materia)}','${c.lapso}')"` : "";
    return `<td class="${clases}"${t ? ` title="${escHtml(t)}"` : ""}${clic}>${textoNota(c.v)}${c.ajuste ? "<sup>C</sup>" : ""}</td>`;
  };
  return `<table class="sab-tabla">
    <thead>${d.cabecera.map((fila) => `<tr>${fila.map(th).join("")}</tr>`).join("")}</thead>
    <tbody>${d.filas
      .map(
        (f, i) =>
          `<tr><td class="sab-num">${i + 1}</td><td class="sab-nombre">${
            enPantalla
              ? `<button class="sab-est" onclick="abrirModal({tipo:'sabana-estudiante',id:'${f.est.id}'})">${escHtml(f.est.nombre)}</button>`
              : escHtml(f.est.nombre)
          }</td><td class="sab-ced">${escHtml(f.est.cedula || "")}</td>${f.celdas.map((c) => td({ ...c, estId: f.est.id })).join("")}</tr>`
      )
      .join("")}</tbody>
    <tfoot>${d.pie
      .map(
        (p) =>
          `<tr><td colspan="3" class="sab-pie-t">${escHtml(p.t)}</td>${p.celdas.map((v) => `<td>${typeof v === "number" ? textoNota(v) : "-"}</td>`).join("")}</tr>`
      )
      .join("")}</tfoot>
  </table>`;
}
function htmlAjustesSabana(lista, enPantalla) {
  if (!lista.length) return "";
  return `<div class="section-title" style="margin-top:0.9rem">🏛️ Cambios del consejo (${lista.length})</div>
    <table class="sab-tabla sab-ajustes"><thead><tr><th>Estudiante</th><th>Materia</th><th>Nota</th><th>Antes</th><th>Ahora</th><th>Motivo</th><th>Acta</th><th>Quién y cuándo</th></tr></thead>
    <tbody>${lista
      .map(
        (
          x
        ) => `<tr${enPantalla && puedeAjustarConsejo() ? ` class="sab-toca" onclick="abrirAjusteConsejo('${x.est.id}','${escJs(x.materia)}','${x.lapso}')"` : ""}>
        <td style="text-align:left">${escHtml(x.est.nombre)}</td><td style="text-align:left">${escHtml(x.materia)}</td><td>${escHtml(x.lapso)}</td>
        <td>${textoNota(x.a.original)}</td><td><strong>${textoNota(notaNum(x.a.nota))}</strong></td>
        <td style="text-align:left">${escHtml(x.a.motivo || "")}</td><td>${escHtml(x.a.acta || "")}</td>
        <td>${escHtml(nombreUsuario(x.a.por))} · ${escHtml(fechaCorta(x.a.fecha || ""))}</td></tr>`
      )
      .join("")}</tbody></table>`;
}

function renderSabana() {
  const grados = gradosSabana();
  if (!grados.length)
    return `<div class="card"><div class="empty-state">📋 La sábana es para media general y todavía no hay estudiantes de media general.</div></div>`;
  const grado = grados.includes(filtros.sabGrado) ? filtros.sabGrado : grados[0];
  const secciones = seccionesSabana(grado);
  const seccion = secciones.includes(filtros.sabSeccion) ? filtros.sabSeccion : "";
  const ver = VISTAS_SABANA.some(([k]) => k === filtros.sabVer) ? filtros.sabVer : "anio";
  const d = datosSabana(grado, seccion, ver, filtros.sabMateria);
  const ajustes = ajustesSabana(grado, seccion);
  const opcion = (v, t, sel) => `<option value="${escHtml(v)}" ${v === sel ? "selected" : ""}>${escHtml(t)}</option>`;
  return `<div class="card">
    <div class="card-title"><div class="card-bar"></div><h2>📋 Sábana de notas</h2>
      <div style="margin-left:auto;display:flex;gap:0.4rem;flex-wrap:wrap">
        <button class="btn btn-gray btn-sm" onclick="imprimirSabana()">🖨️ Imprimir</button>
        <button class="btn btn-gray btn-sm" onclick="exportarSabanaExcel()">📥 Excel</button>
      </div>
    </div>
    <div class="form-grid">
      <div class="field"><label class="field-label">Año</label>
        <select class="inp" id="sab-grado" onchange="filtros.sabGrado=this.value;filtros.sabSeccion='';renderTabContent()">${grados.map((g) => opcion(g, g, grado)).join("")}</select></div>
      ${secciones.length > 1 ? `<div class="field"><label class="field-label">Sección</label><select class="inp" id="sab-seccion" onchange="filtros.sabSeccion=this.value;renderTabContent()">${opcion("", "Todas", seccion)}${secciones.map((s) => opcion(s, s || "(sin sección)", seccion)).join("")}</select></div>` : ""}
      <div class="field"><label class="field-label">Ver</label>
        <select class="inp" id="sab-ver" onchange="filtros.sabVer=this.value;renderTabContent()">${VISTAS_SABANA.map(([k, t]) => opcion(k, t, ver)).join("")}</select></div>
      ${
        ver === "materia"
          ? `<div class="field"><label class="field-label">Materia</label><select class="inp" id="sab-materia" onchange="filtros.sabMateria=this.value;renderTabContent()">${getAreas(
              grado
            )
              .map((m) => opcion(m, m, d.materia))
              .join("")}</select></div>`
          : ""
      }
    </div>
    <div class="ayuda" style="margin-top:0.5rem">Toca el nombre de un estudiante para ver todas sus evaluaciones.${puedeAjustarConsejo() ? " Para cambiar una nota por decisión del consejo, tócala." : ""} <span class="sab-rep">Rojo</span>: menos de 10 · <strong>C</strong>: cambiada por el consejo · <em>cursiva</em>: faltan evaluaciones.</div>
  </div>
  <div class="card" style="padding:0.6rem">
    ${d.filas.length ? `<div class="sabana-wrap">${htmlTablaSabana(d, true)}</div>` : `<div class="empty-state">No hay estudiantes activos en ${escHtml(grado)}.</div>`}
    ${htmlAjustesSabana(ajustes, true)}
  </div>`;
}

// ---- Detalle de un estudiante: cada evaluación de cada materia ----
function htmlDetalleEstudiante(est, enPantalla) {
  const ajustar = enPantalla && puedeAjustarConsejo();
  const areas = getAreas(est.grado);
  const toque = (m, l) =>
    ajustar ? ` class="sab-toca" onclick="abrirAjusteConsejo('${est.id}','${escJs(m)}','${l}',true)"` : "";
  const marca = (x) =>
    x.ajuste
      ? ` <span class="sab-aj-nota">C · antes ${textoNota(x.ajuste.original)}${x.ajuste.motivo ? ": " + escHtml(x.ajuste.motivo) : ""}</span>`
      : "";
  return (
    areas
      .map((m) => {
        const d = definitivaDe(est, m);
        return `<div class="sab-detalle">
        <div class="sab-detalle-t"><strong>${escHtml(m)}</strong><span${toque(m, LAPSO_DEF)}>Definitiva: <strong class="${d.nota !== null && d.nota < 10 ? "sab-rep" : ""}">${textoNota(d.nota)}</strong>${d.ajuste ? "<sup>C</sup>" : ""}</span></div>
        ${d.ajuste ? `<div class="item-sub">${marca(d)}</div>` : ""}
        ${d.lapsos
          .map(
            (x, i) => `<div class="sab-detalle-l"><span class="sab-detalle-lapso">${LAPSOS[i]}</span>
            <span class="sab-detalle-evals">${x.evaluaciones
              .map(
                (ev) =>
                  `<span class="sab-chip${ev.nota !== null && ev.nota < 10 ? " sab-rep" : ""}">${escHtml(ev.nombre)}${Number(ev.peso) > 0 ? " " + ev.peso + "%" : ""}: <strong>${textoNota(ev.nota)}</strong></span>`
              )
              .join("")}</span>
            <span${toque(m, LAPSOS[i])}>Nota: <strong class="${x.nota !== null && x.nota < 10 ? "sab-rep" : ""}">${textoNota(x.nota)}</strong>${x.ajuste ? "<sup>C</sup>" : ""}${marca(x)}</span></div>`
          )
          .join("")}
      </div>`;
      })
      .join("") +
    `<div class="sab-detalle-prom">Promedio: <strong>${textoNota(promedioEstudiante(est, areas))}</strong></div>`
  );
}
function renderModalSabanaEstudiante(m) {
  const est = estudiantes.find((e) => e.id === m.id);
  if (!est) return "";
  return `<div class="modal-bg" onclick="if(event.target.classList.contains('modal-bg'))cerrarModal()">
    <div class="modal" style="max-width:640px">
      <div class="modal-header"><div><h3>📋 ${escHtml(est.nombre)}</h3><p>${escHtml(est.grado || "")}${est.seccion ? " · Sección " + escHtml(est.seccion) : ""} · ${escHtml(est.cedula || "")}</p></div>
        <button class="modal-close-x" onclick="cerrarModal()">✕</button></div>
      <div class="modal-body">
        ${htmlDetalleEstudiante(est, true)}
        <div style="display:flex;gap:0.5rem;margin-top:0.8rem">
          <button class="btn btn-gray" style="flex:1" onclick="cerrarModal()">Cerrar</button>
          <button class="btn btn-primary" style="flex:1" onclick="imprimirDetalleEstudiante('${est.id}')">🖨️ Imprimir</button>
        </div>
      </div>
    </div></div>`;
}

// ---- Ajuste del consejo (solo el director) ----
function abrirAjusteConsejo(estId, materia, lapso, desdeDetalle) {
  if (!puedeAjustarConsejo()) return;
  abrirModal({
    tipo: "ajuste-consejo",
    estId,
    materia,
    lapso,
    volver: desdeDetalle ? { tipo: "sabana-estudiante", id: estId } : null,
  });
}
function volverDeAjuste() {
  const v = modalActual && modalActual.volver;
  if (v) abrirModal(v);
  else cerrarModal();
}
function renderModalAjusteConsejo(m) {
  const est = estudiantes.find((e) => e.id === m.estId);
  if (!est) return "";
  const info = m.lapso === LAPSO_DEF ? definitivaDe(est, m.materia) : notaLapsoDe(est, m.materia, m.lapso);
  const a = info.ajuste;
  return `<div class="modal-bg" onclick="if(event.target.classList.contains('modal-bg'))volverDeAjuste()">
    <div class="modal">
      <div class="modal-header"><div><h3>🏛️ Cambio por decisión del consejo</h3><p>${escHtml(est.nombre)} · ${escHtml(m.materia)} · ${m.lapso === LAPSO_DEF ? "Nota definitiva" : escHtml(m.lapso)}</p></div>
        <button class="modal-close-x" onclick="volverDeAjuste()">✕</button></div>
      <div class="modal-body">
        <div class="info-row"><span>Nota que dan las evaluaciones</span><strong>${textoNota(info.calculada)}</strong></div>
        ${
          a
            ? `<div class="info-row"><span>Nota del consejo</span><strong>${textoNota(notaNum(a.nota))}</strong></div>
        <div class="item-sub" style="margin:0.3rem 0">Cambiada por ${escHtml(nombreUsuario(a.por))} el ${escHtml(fechaCorta(a.fecha || ""))}${a.acta ? " · " + escHtml(a.acta) : ""}</div>
        ${a.original !== info.calculada ? `<div class="alert-item alert-info"><div>⚠️ Las notas del profesor cambiaron después del consejo: cuando se cambió era ${textoNota(a.original)} y ahora es ${textoNota(info.calculada)}.</div></div>` : ""}`
            : ""
        }
        <div class="field" style="margin-top:0.6rem"><label class="field-label">Nota nueva (0 a 20)</label>
          <input class="inp" type="number" min="0" max="20" step="0.1" id="aj-nota" value="${a ? escHtml(a.nota) : ""}" placeholder="${textoNota(info.calculada)}"/></div>
        <div class="field"><label class="field-label">Motivo (obligatorio)</label>
          <textarea class="inp" id="aj-motivo" rows="2" placeholder="Ej.: El consejo de sección consideró su desempeño y asistencia">${a ? escHtml(a.motivo || "") : ""}</textarea></div>
        <div class="field"><label class="field-label">Acta o fecha del consejo (opcional)</label>
          <input class="inp" id="aj-acta" value="${a ? escHtml(a.acta || "") : ""}" placeholder="Ej.: Acta N° 3 del 12/12/2026"/></div>
        <div id="aj-res"></div>
        <div style="display:flex;gap:0.5rem;margin-top:0.8rem;flex-wrap:wrap">
          <button class="btn btn-gray" style="flex:1" onclick="volverDeAjuste()">Cancelar</button>
          ${a ? `<button class="btn btn-danger" style="flex:1" onclick="quitarAjusteModal()">Quitar el cambio</button>` : ""}
          <button class="btn btn-primary" style="flex:2" onclick="guardarAjusteModal()">💾 Guardar</button>
        </div>
      </div>
    </div></div>`;
}
async function guardarAjusteModal() {
  const m = modalActual;
  const est = estudiantes.find((e) => e.id === m.estId);
  const txt = document.getElementById("aj-nota").value.trim().replace(",", ".");
  const nota = notaNum(txt);
  const motivo = document.getElementById("aj-motivo").value.trim();
  const acta = document.getElementById("aj-acta").value.trim();
  if (nota === null || nota < 0 || nota > 20) return mostrarError("aj-res", "Escribe una nota de 0 a 20");
  if (motivo.length < 3) return mostrarError("aj-res", "Escribe el motivo del cambio");
  try {
    await guardarAjusteConsejo(est, m.materia, m.lapso, unDecimal(nota), motivo, acta);
    volverDeAjuste();
    mostrarToast("✅ Nota cambiada por el consejo");
  } catch (e) {
    mostrarError("aj-res", "No se pudo guardar: " + e.message);
  }
}
async function quitarAjusteModal() {
  const m = modalActual;
  const est = estudiantes.find((e) => e.id === m.estId);
  if (!confirm("¿Quitar el cambio del consejo? Vuelve a contar la nota que dan las evaluaciones.")) return;
  try {
    await guardarAjusteConsejo(est, m.materia, m.lapso, null);
    volverDeAjuste();
    mostrarToast("Cambio del consejo quitado");
  } catch (e) {
    mostrarError("aj-res", "No se pudo quitar: " + e.message);
  }
}

// ---- Imprimir y Excel ----
function estadoSabana() {
  const grados = gradosSabana();
  const grado = grados.includes(filtros.sabGrado) ? filtros.sabGrado : grados[0];
  const seccion = seccionesSabana(grado).includes(filtros.sabSeccion) ? filtros.sabSeccion : "";
  const ver = VISTAS_SABANA.some(([k]) => k === filtros.sabVer) ? filtros.sabVer : "anio";
  return { grado, seccion, ver };
}
const ESTILOS_SABANA = `*{box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:10px;color:#111;padding:10px}
  .enc{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #003366;padding-bottom:6px;margin-bottom:8px}
  .enc h1{font-size:13px;color:#003366;margin:0}.enc p{margin:2px 0;color:#444}
  table{border-collapse:collapse;width:100%;margin-bottom:8px}th,td{border:1px solid #999;padding:2px 3px;text-align:center}
  th{background:#003366;color:#fff;font-size:9px}td.sab-nombre,td.sab-pie-t{text-align:left;white-space:nowrap}
  .sab-def,.sab-prom{font-weight:700;background:#f0f4ff}.sab-rep{color:#b91c1c;font-weight:700}.sab-parcial{font-style:italic}
  .sab-aj{background:#fff8e1}sup{font-size:7px;color:#7a5c00}tfoot td{font-weight:700;background:#f7f7f7}
  .section-title{font-weight:700;color:#003366;margin:8px 0 4px}
  .sab-detalle{border:1px solid #ccc;border-radius:4px;padding:5px;margin-bottom:5px;break-inside:avoid}
  .sab-detalle-t{display:flex;justify-content:space-between}.sab-detalle-l{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:3px}
  .sab-detalle-lapso{font-weight:700;min-width:50px}.sab-chip{border:1px solid #ddd;border-radius:3px;padding:0 4px}
  .sab-aj-nota{color:#7a5c00}.sab-detalle-prom{text-align:right;font-size:12px;margin-top:6px}
  .firmas{display:flex;justify-content:space-around;margin-top:28px}.firmas div{border-top:1px solid #333;width:160px;text-align:center;padding-top:3px}
  @page{size:letter landscape;margin:8mm}@media print{.no-print{display:none}}`;
function encabezadoSabana(titulo, detalle) {
  const inst = configInst || {};
  return `<div class="enc"><div><h1>${escHtml(inst.nombre || EMPRESA)}</h1><p>${escHtml(titulo)}</p></div>
    <div style="text-align:right"><p>${detalle}</p><p>Año escolar ${escHtml(inst.anioEscolar || "")} · Impresa el ${fechaCorta(todayStr())}</p></div></div>`;
}
function imprimirSabana() {
  const { grado, seccion, ver } = estadoSabana();
  if (!grado) return;
  const d = datosSabana(grado, seccion, ver, filtros.sabMateria);
  const vista = ver === "materia" ? d.materia : (VISTAS_SABANA.find(([k]) => k === ver) || [])[1];
  const w = abrirVentanaImpresion();
  w.document
    .write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Sábana ${escHtml(grado)}</title><style>${ESTILOS_SABANA}</style></head><body>
    <button class="no-print" onclick="window.print()">🖨️ Imprimir</button>
    ${encabezadoSabana("SÁBANA DE NOTAS", `${escHtml(grado)}${seccion ? " · Sección " + escHtml(seccion) : ""} · ${escHtml(vista || "")}`)}
    ${htmlTablaSabana(d, false)}
    <div style="font-size:9px;color:#555">Rojo: menos de 10 · C: cambiada por el consejo · cursiva: faltan evaluaciones.</div>
    ${htmlAjustesSabana(ajustesSabana(grado, seccion), false)}
    <div class="firmas"><div>Docente guía</div><div>Coordinación</div><div>Dirección</div></div>
  </body></html>`);
  w.document.close();
}
function imprimirDetalleEstudiante(estId) {
  const est = estudiantes.find((e) => e.id === estId);
  if (!est) return;
  const w = abrirVentanaImpresion();
  w.document
    .write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Notas ${escHtml(est.nombre)}</title><style>${ESTILOS_SABANA.replace("letter landscape", "letter")}</style></head><body>
    <button class="no-print" onclick="window.print()">🖨️ Imprimir</button>
    ${encabezadoSabana("DETALLE DE EVALUACIONES", `${escHtml(est.nombre)} · ${escHtml(est.cedula || "")} · ${escHtml(est.grado || "")}${est.seccion ? " · Sección " + escHtml(est.seccion) : ""}`)}
    ${htmlDetalleEstudiante(est, false)}
  </body></html>`);
  w.document.close();
}
// Excel: las mismas filas y columnas de la pantalla (los títulos agrupados quedan combinados)
function exportarSabanaExcel() {
  const { grado, seccion, ver } = estadoSabana();
  if (!grado) return;
  const d = datosSabana(grado, seccion, ver, filtros.sabMateria);
  const filas = [],
    merges = [],
    ocupado = new Set();
  d.cabecera.forEach((fila, r) => {
    filas[r] = filas[r] || [];
    let c = 0;
    fila.forEach((x) => {
      while (ocupado.has(r + "," + c)) c++;
      const cs = x.cs || 1,
        rs = x.rs || 1;
      filas[r][c] = x.t;
      for (let i = 0; i < rs; i++) for (let j = 0; j < cs; j++) ocupado.add(r + i + "," + (c + j));
      if (cs > 1 || rs > 1) merges.push({ s: { r, c }, e: { r: r + rs - 1, c: c + cs - 1 } });
      c += cs;
    });
  });
  for (let r = 0; r < filas.length; r++)
    for (let c = 0; c < filas[r].length; c++) if (filas[r][c] === undefined) filas[r][c] = "";
  d.filas.forEach((f, i) => filas.push([i + 1, f.est.nombre, f.est.cedula || "", ...f.celdas.map((x) => x.v)]));
  d.pie.forEach((p) => filas.push([p.t, "", "", ...p.celdas.map((v) => (typeof v === "number" ? v : null))]));
  const hoja = XLSX.utils.aoa_to_sheet(filas);
  hoja["!merges"] = merges;
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, "Sábana");
  const aj = ajustesSabana(grado, seccion);
  if (aj.length)
    XLSX.utils.book_append_sheet(
      libro,
      XLSX.utils.aoa_to_sheet([
        ["Estudiante", "Materia", "Nota", "Antes", "Ahora", "Motivo", "Acta", "Quién", "Fecha"],
        ...aj.map((x) => [
          x.est.nombre,
          x.materia,
          x.lapso,
          x.a.original ?? "",
          notaNum(x.a.nota),
          x.a.motivo || "",
          x.a.acta || "",
          nombreUsuario(x.a.por),
          x.a.fecha || "",
        ]),
      ]),
      "Cambios del consejo"
    );
  const nombre = ("sabana " + grado + (seccion ? " " + seccion : "") + " " + (ver === "materia" ? d.materia : ver))
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\w-]+/g, "_");
  XLSX.writeFile(libro, nombre + ".xlsx");
}
