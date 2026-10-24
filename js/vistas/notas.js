// Pestaña Notas: carga de notas por lapso (literales en preescolar/primaria, numéricas en media) y nota final.

// Áreas o materias que se evalúan en un grado. En media general salen de Configuración → Materias.
function getAreas(grado) {
  const nivel = getNivel(grado);
  if (nivel === "preescolar") return [...AREAS_MATERNAL];
  if (nivel === "primaria") return [...AREAS_PRIMARIA];
  return configMaterias[grado] || MATERIAS;
}
function getIndicadores(grado, area) {
  const key = grado + "__" + area;
  return configIndicadores[key] || [];
}
function renderNotas() {
  const estSelId = filtros.estSelId || "";
  const estSel = estudiantes.find((e) => e.id === estSelId);
  const lapso = filtros.lapso || LAPSOS[0];
  // Las fichas de los docentes las prepara la app cuando entra el director o la administradora
  const sinFichas =
    rolUsuario === "docente" && !estudiantes.length
      ? `<div class="card" style="background:#fff8e1;color:#7a5c00;font-size:0.82rem">⏳ La lista de estudiantes todavía no está lista. Pide al director o a la administradora que entre a la plataforma (se prepara sola) y luego vuelve a entrar.</div>`
      : "";
  const vistas = `<div class="stabs">
    <button class="stab ${!["sabana", "honor"].includes(filtros.notasVista) ? "active" : ""}" onclick="filtros.notasVista='estudiante';renderTabContent()">📝 Por estudiante</button>
    <button class="stab ${filtros.notasVista === "sabana" ? "active" : ""}" onclick="filtros.notasVista='sabana';renderTabContent()">📋 Sábana de notas</button>
    <button class="stab ${filtros.notasVista === "honor" ? "active" : ""}" onclick="filtros.notasVista='honor';renderTabContent()">🏆 Cuadro de honor</button>
  </div>`;
  if (filtros.notasVista === "sabana") return sinFichas + vistas + renderSabana();
  if (filtros.notasVista === "honor") return sinFichas + vistas + renderCuadroHonor();
  return `${sinFichas}${vistas}
  <div class="card">
    <div class="card-title"><div class="card-bar"></div><h2>📝 Consultar Notas</h2></div>
    <div class="form-grid">
      <div class="field"><label class="field-label">Filtrar por Grado</label>
        <select class="inp" onchange="filtros.gradoNotas=this.value;filtros.estSelId='';renderTabContent()">
          <option value="">-- Todos los grados --</option>
          ${[
            ...new Set(
              estudiantes
                .filter(activo)
                .map((e) => e.grado)
                .filter(Boolean)
            ),
          ]
            .sort(ordenGrados)
            .map(
              (g) =>
                `<option value="${escHtml(g)}" ${filtros.gradoNotas === g ? "selected" : ""}>${escHtml(g)}</option>`
            )
            .join("")}
        </select>
      </div>
      <div class="field"><label class="field-label">Seleccionar Estudiante</label>
        <select class="inp" onchange="filtros.estSelId=this.value;renderTabContent()">
          <option value="">-- Seleccionar estudiante --</option>
          ${estudiantes
            .filter((e) => activo(e) && (!filtros.gradoNotas || e.grado === filtros.gradoNotas))
            .sort(ordenNombre)
            .map(
              (e) =>
                `<option value="${e.id}" ${estSelId === e.id ? "selected" : ""}>${escHtml(e.nombre)} ${e.grado ? "(" + escHtml(e.grado) + ")" : ""}</option>`
            )
            .join("")}
        </select>
      </div>
    </div>
    ${filtros.gradoNotas && rolUsuario !== "administradora" ? `<button class="btn btn-gray btn-sm" style="margin-top:0.6rem" onclick="imprimirBoletinesGrado('${escJs(filtros.gradoNotas)}')">🖨️ Boletines de todo ${escHtml(filtros.gradoNotas)}</button>` : ""}
  </div>
  ${
    estSel
      ? `
  <div class="card" style="padding:0.85rem 1rem">
    <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:0.5rem">
      <div style="width:40px;height:40px;background:linear-gradient(135deg,#003366,#00509e);border-radius:50%;display:flex;align-items:center;justify-content:center;color:#ffd700;font-weight:800;font-size:1rem;flex-shrink:0">${estSel.nombre[0]}</div>
      <div><div style="font-weight:700;color:#003366">${escHtml(estSel.nombre)}</div>
      <div style="font-size:0.72rem;color:#888">${escHtml(estSel.grado) || ""} · ${getNivel(estSel.grado) === "media" ? "Media General" : getNivel(estSel.grado) === "primaria" ? "Primaria" : "Preescolar"}</div></div>
      <button class="btn btn-gray btn-sm" style="margin-left:auto" onclick="imprimirBoletin('${estSel.id}')">🖨️ Boletín</button>
    </div>
  </div>
  <div class="stabs">
    ${LAPSOS.map((l) => `<button class="stab ${lapso === l ? "active" : ""}" onclick="filtros.lapso='${l}';renderTabContent()">${l}</button>`).join("")}
  </div>
  ${getNivel(estSel.grado) === "media" ? renderTablaNotasMedia(estSel, lapso) : renderTablaNotasPrimaria(estSel, lapso)}
  ${renderNotaFinal(estSel)}`
      : ""
  }`;
}
// ── Media General ──
// Cada materia con las evaluaciones de su plan (nombre y %), y la nota del lapso (con el ajuste del consejo, si hubo)
function renderTablaNotasMedia(est, lapso) {
  const notasEst = notas[`${est.id}_${lapso}`] || {};
  const areas = getAreas(est.grado);
  const puedePlan = !soloLectura() && (rolUsuario === "director" || rolUsuario === "docente");

  return `
  <div class="card">
    <div class="card-title"><div class="card-bar"></div><h2>Notas — ${lapso}</h2>
      <button class="btn btn-primary btn-sm" style="margin-left:auto" onclick="guardarNotas('${est.id}','${lapso}')">💾 Guardar</button>
    </div>
    <div style="overflow-x:auto">
      <table style="width:100%;border-collapse:collapse;font-size:0.78rem">
        <thead><tr style="background:#f0f4ff">
          <th style="text-align:left;padding:0.5rem 0.6rem;color:#003366">Materia</th>
          <th style="text-align:left;padding:0.5rem 0.4rem;color:#003366">Evaluaciones</th>
          <th style="padding:0.5rem 0.4rem;color:#003366;text-align:center">Nota del lapso</th>
        </tr></thead>
        <tbody>
          ${areas
            .map((m) => {
              const evals = planEvaluacion(est.grado, m, lapso);
              const info = notaLapsoDe(est, m, lapso);
              const prom = info.nota;
              return `<tr style="border-bottom:1px dashed #eef2f9">
              <td style="padding:0.45rem 0.6rem;font-weight:600;color:#333;vertical-align:top">${escHtml(m)}${puedePlan ? `<div><button class="btn btn-gray btn-sm" style="margin-top:0.3rem;font-size:0.68rem;padding:0.15rem 0.45rem" onclick="abrirPlanEvaluacion('${escJs(est.grado)}','${escJs(m)}','${lapso}')">⚙️ Plan${tienePorcentajes(evals) ? "" : " de evaluación"}</button></div>` : ""}</td>
              <td style="padding:0.3rem"><div class="evals-fila">${evals
                .map((ev) => {
                  const k = m + "_" + ev.n;
                  return `<label class="eval-celda"><span>${escHtml(ev.nombre)}${Number(ev.peso) > 0 ? " · " + ev.peso + "%" : ""}</span><input class="nota-input" type="number" min="0" max="20" step="0.1" id="nota_${est.id}_${lapso}_${escHtml(k)}" value="${escHtml(notasEst[k] || "")}" placeholder="-" onchange="updateNotaLocal('${est.id}','${lapso}','${escJs(k)}',this.value)"/></label>`;
                })
                .join("")}</div></td>
              <td style="padding:0.3rem;text-align:center;vertical-align:top"><span class="promedio-badge" style="background:${prom === null ? "#f1f3f5" : prom >= 18 ? "#e6f7ef" : prom >= 14 ? "#fff8e1" : "#fef0f0"};color:${prom === null ? "#888" : colorNota(prom)}">${prom !== null ? prom : "-"}${info.ajuste ? "<sup>C</sup>" : ""}</span>${info.ajuste ? `<div style="font-size:0.62rem;color:#7a5c00;margin-top:2px">Consejo (antes ${info.ajuste.original ?? "-"})</div>` : ""}</td>
            </tr>`;
            })
            .join("")}
        </tbody>
      </table>
    </div>
  </div>`;
}
// ── Plan de evaluación (director y docentes): evaluaciones de una materia en un lapso, con su porcentaje ──
function abrirPlanEvaluacion(grado, materia, lapso) {
  if (soloLectura()) return alert("Estás viendo un año anterior (solo consulta).");
  abrirModal({
    tipo: "plan-eval",
    grado,
    materia,
    lapso,
    filas: planEvaluacion(grado, materia, lapso).map((e) => ({ ...e })),
    ultimoN: ultimoNPlan(grado, materia, lapso),
  });
}
const sumaPlan = (filas) => Math.round(filas.reduce((a, f) => a + (Number(f.peso) || 0), 0) * 100) / 100;
function textoSumaPlan(filas) {
  const s = sumaPlan(filas);
  if (!s) return "Sin porcentajes: la nota del lapso es el promedio de las evaluaciones.";
  return s === 100 ? "✅ Los porcentajes suman 100%." : `⚠️ Los porcentajes suman ${s}%: deben sumar 100%.`;
}
function renderModalPlanEval(m) {
  return `<div class="modal-bg" onclick="if(event.target.classList.contains('modal-bg'))cerrarModal()">
    <div class="modal">
      <div class="modal-header"><div><h3>⚙️ Plan de evaluación</h3><p>${escHtml(m.materia)} · ${escHtml(m.grado)} · ${escHtml(m.lapso)}</p></div>
        <button class="modal-close-x" onclick="cerrarModal()">✕</button></div>
      <div class="modal-body">
        <div class="ayuda" style="margin-bottom:0.6rem">Cada evaluación con su nombre y su porcentaje (deben sumar 100%). Si no pones porcentajes, todas valen igual.</div>
        ${m.filas
          .map(
            (f, i) => `<div class="form-row plan-fila" style="align-items:flex-end;margin-bottom:0.4rem">
          <div class="field" style="flex:3"><label class="field-label">Evaluación ${i + 1}</label><input class="inp" id="plan-nombre-${i}" value="${escHtml(f.nombre)}" placeholder="Ej.: Prueba escrita" onchange="modalActual.filas[${i}].nombre=this.value"/></div>
          <div class="field" style="flex:1"><label class="field-label">%</label><input class="inp" type="number" min="0" max="100" step="1" id="plan-peso-${i}" value="${Number(f.peso) || ""}" placeholder="-" oninput="modalActual.filas[${i}].peso=this.value;document.getElementById('plan-suma').textContent=textoSumaPlan(modalActual.filas)"/></div>
          <button class="btn btn-gray btn-sm" title="Quitar" onclick="quitarFilaPlan(${i})">🗑️</button>
        </div>`
          )
          .join("")}
        <button class="btn btn-gray btn-sm" onclick="agregarFilaPlan()">➕ Agregar evaluación</button>
        <div id="plan-suma" style="font-size:0.78rem;margin-top:0.6rem;color:#555">${textoSumaPlan(m.filas)}</div>
        <label style="display:flex;gap:0.5rem;align-items:center;font-size:0.8rem;margin-top:0.6rem;cursor:pointer"><input type="checkbox" id="plan-todos"/> Usar este mismo plan en los ${LAPSOS.length} lapsos</label>
        <div id="plan-res"></div>
        <div class="modal-actions" style="display:flex;gap:0.5rem;margin-top:0.8rem">
          <button class="btn btn-gray" style="flex:1" onclick="cerrarModal()">Cancelar</button>
          <button class="btn btn-primary" style="flex:2" onclick="guardarPlanModal()">💾 Guardar plan</button>
        </div>
      </div>
    </div></div>`;
}
function agregarFilaPlan() {
  const m = modalActual;
  m.ultimoN += 1;
  m.filas.push({ n: m.ultimoN, nombre: "", peso: 0 });
  render();
}
function quitarFilaPlan(i) {
  const m = modalActual,
    f = m.filas[i];
  const conNota = estudiantes.filter(
    (e) => e.grado === m.grado && notaNum((notas[`${e.id}_${m.lapso}`] || {})[m.materia + "_" + f.n]) !== null
  ).length;
  if (
    conNota &&
    !confirm(
      `«${f.nombre || "Esta evaluación"}» ya tiene nota de ${conNota} estudiante(s). Si la quitas, esas notas dejan de contar. ¿Quitarla?`
    )
  )
    return;
  m.filas.splice(i, 1);
  render();
}
async function guardarPlanModal() {
  const m = modalActual;
  const filas = m.filas.map((f, i) => ({ ...f, nombre: String(f.nombre || "").trim() || "Eval " + (i + 1) }));
  const suma = sumaPlan(filas);
  if (!filas.length) return mostrarError("plan-res", "Agrega al menos una evaluación");
  if (filas.some((f) => Number(f.peso) < 0)) return mostrarError("plan-res", "Un porcentaje no puede ser negativo");
  if (suma && suma !== 100) return mostrarError("plan-res", `Los porcentajes suman ${suma}%: deben sumar 100%`);
  const lapsos = document.getElementById("plan-todos").checked ? LAPSOS : [m.lapso];
  try {
    await guardarPlanEvaluacion(m.grado, m.materia, lapsos, filas);
    cerrarModal();
    mostrarToast("✅ Plan de evaluación guardado");
  } catch (e) {
    mostrarError("plan-res", "No se pudo guardar: " + e.message);
  }
}
// ── Primaria y Preescolar ──
function renderTablaNotasPrimaria(est, lapso) {
  const key = `${est.id}_${lapso}`;
  const notasEst = notas[key] || {};
  const areas = getAreas(est.grado);

  if (areas.length === 0)
    return `<div class="card"><div class="empty-state">⚙️ No hay áreas configuradas para ${escHtml(est.grado)}. Ve a Configuración → Indicadores para agregarlas.</div></div>`;

  return `
  <div class="card">
    <div class="card-title"><div class="card-bar"></div><h2>Notas — ${lapso}</h2>
      <button class="btn btn-primary btn-sm" style="margin-left:auto" onclick="guardarNotas('${est.id}','${lapso}')">💾 Guardar</button>
    </div>
    <div style="overflow-x:auto">
      <table style="width:100%;border-collapse:collapse;font-size:0.78rem;border:1.5px solid #ccc">
        <thead>
          <tr style="background:#003366;color:#fff">
            <th style="padding:0.5rem 0.6rem;text-align:left;border:1px solid #ccc;width:130px">Área de Formación</th>
            <th style="padding:0.5rem;text-align:left;border:1px solid #ccc">Indicadores</th>
            <th style="padding:0.5rem;text-align:center;border:1px solid #ccc;width:32px">A</th>
            <th style="padding:0.5rem;text-align:center;border:1px solid #ccc;width:32px">B</th>
            <th style="padding:0.5rem;text-align:center;border:1px solid #ccc;width:32px">C</th>
            <th style="padding:0.5rem;text-align:center;border:1px solid #ccc;width:32px">D</th>
            <th style="padding:0.5rem;text-align:center;border:1px solid #ccc;width:32px">E</th>
          </tr>
        </thead>
        <tbody>
          ${areas
            .map((area) => {
              const inds = getIndicadores(est.grado, area);
              if (inds.length === 0) {
                return `<tr><td style="padding:0.4rem 0.6rem;font-weight:700;color:#003366;border:1px solid #ddd;vertical-align:top;font-size:0.72rem;writing-mode:vertical-rl;text-orientation:mixed;text-align:center" rowspan="1">${escHtml(area)}</td>
                <td style="padding:0.4rem;color:#aaa;font-size:0.75rem;border:1px solid #ddd" colspan="6">Sin indicadores. Agrégalos en Configuración → Indicadores.</td></tr>`;
              }
              return inds
                .map((ind, i) => {
                  const fieldKey = area + "__" + i;
                  const valActual = notasEst[fieldKey] || "";
                  const firstRow = i === 0;
                  return `<tr style="border-bottom:1px solid #eee">
                ${firstRow ? `<td style="padding:0.4rem 0.3rem;font-weight:700;color:#003366;border:1px solid #ddd;vertical-align:middle;font-size:0.68rem;writing-mode:vertical-rl;text-orientation:mixed;text-align:center;background:#f0f4ff" rowspan="${inds.length}">${escHtml(area)}</td>` : ""}
                <td style="padding:0.35rem 0.5rem;font-size:0.76rem;color:#333;border:1px solid #ddd">${escHtml(ind)}</td>
                ${LETRAS.map(
                  (letra) => `<td style="padding:0.2rem;text-align:center;border:1px solid #ddd">
                  <input type="radio" name="nota_${est.id}_${lapso}_${escHtml(fieldKey)}" value="${letra}" ${valActual === letra ? "checked" : ""} onchange="updateNotaLocal('${est.id}','${lapso}','${escJs(fieldKey)}','${letra}')"/>
                </td>`
                ).join("")}
              </tr>`;
                })
                .join("");
            })
            .join("")}
        </tbody>
      </table>
    </div>
  </div>`;
}
function renderNotaFinal(est) {
  const nivel = getNivel(est.grado);
  const areas = getAreas(est.grado);
  if (nivel === "media") {
    const defs = areas.map((m) => ({ m, d: definitivaDe(est, m) }));
    const notaFinalGen = promedioEstudiante(est, areas);
    if (notaFinalGen === null) return "";
    const marca = (x) => (x.ajuste ? "<sup title='Ajustada por el consejo'>C</sup>" : "");
    return `
    <div class="card" style="margin-top:0.85rem">
      <div class="card-title"><div class="card-bar"></div><h2>🏆 Nota Final</h2></div>
      <table style="width:100%;border-collapse:collapse;font-size:0.8rem">
        <thead><tr style="background:#f0f4ff">
          <th style="text-align:left;padding:0.45rem 0.6rem;color:#003366">Materia</th>
          <th style="padding:0.45rem;color:#003366;text-align:center">L1</th>
          <th style="padding:0.45rem;color:#003366;text-align:center">L2</th>
          <th style="padding:0.45rem;color:#003366;text-align:center">L3</th>
          <th style="padding:0.45rem;color:#003366;text-align:center">🏆 Final</th>
        </tr></thead>
        <tbody>
          ${defs
            .map(({ m, d }) => {
              const notaFinal = d.nota;
              return `<tr style="border-bottom:1px dashed #eef2f9">
              <td style="padding:0.4rem 0.6rem;font-weight:600;color:#333;font-size:0.78rem">${escHtml(m)}</td>
              ${d.lapsos.map((x) => `<td style="padding:0.3rem;text-align:center;font-size:0.78rem;color:${x.nota === null ? "#ccc" : colorNota(x.nota)}">${x.nota !== null ? x.nota : "-"}${marca(x)}</td>`).join("")}
              <td style="padding:0.3rem;text-align:center"><span style="padding:0.25rem 0.5rem;border-radius:8px;font-weight:800;font-size:0.8rem;background:${notaFinal === null ? "#f1f3f5" : notaFinal >= 18 ? "#e6f7ef" : notaFinal >= 14 ? "#fff8e1" : "#fef0f0"};color:${notaFinal === null ? "#888" : colorNota(notaFinal)}">${notaFinal !== null ? notaFinal : "-"}${marca(d)}</span></td>
            </tr>`;
            })
            .join("")}
        </tbody>
      </table>
      ${defs.some(({ d }) => d.ajuste || d.lapsos.some((x) => x.ajuste)) ? `<div style="font-size:0.7rem;color:#7a5c00;margin-top:0.4rem">C = nota cambiada por decisión del consejo (ver la sábana de notas).</div>` : ""}
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:0.85rem;padding:0.85rem 1rem;background:linear-gradient(135deg,#003366,#00509e);border-radius:10px;color:#fff">
        <span style="color:#ffd700;font-weight:700">🏆 NOTA FINAL GENERAL</span>
        <span style="font-size:1.4rem;font-weight:800;font-family:Georgia,serif;color:${notaFinalGen >= 18 ? "#7fff9f" : notaFinalGen >= 14 ? "#ffd700" : "#ff6b6b"}">${notaFinalGen}</span>
      </div>
    </div>`;
  } else {
    // Preescolar y primaria: resumen de letras por área
    const resumen = areas.map((area) => {
      const inds = getIndicadores(est.grado, area);
      const letrasCount = { A: 0, B: 0, C: 0, D: 0, E: 0, total: 0 };
      LAPSOS.forEach((lapso) => {
        const k = `${est.id}_${lapso}`;
        const notasEst = notas[k] || {};
        inds.forEach((_, i) => {
          const v = notasEst[area + "__" + i];
          if (v && LETRAS.includes(v)) {
            letrasCount[v]++;
            letrasCount.total++;
          }
        });
      });
      return { area, letrasCount };
    });
    const hayNotas = resumen.some((r) => r.letrasCount.total > 0);
    if (!hayNotas) return "";
    return `
    <div class="card" style="margin-top:0.85rem">
      <div class="card-title"><div class="card-bar"></div><h2>📊 Resumen de Evaluación</h2></div>
      <table style="width:100%;border-collapse:collapse;font-size:0.8rem">
        <thead><tr style="background:#f0f4ff">
          <th style="text-align:left;padding:0.45rem 0.6rem;color:#003366">Área</th>
          ${LETRAS.map((l) => `<th style="padding:0.45rem;color:#003366;text-align:center">${l}</th>`).join("")}
        </tr></thead>
        <tbody>
          ${resumen
            .map(
              (r) => `<tr style="border-bottom:1px dashed #eef2f9">
            <td style="padding:0.4rem 0.6rem;font-weight:600;color:#333;font-size:0.75rem">${escHtml(r.area)}</td>
            ${LETRAS.map(
              (l) => `<td style="padding:0.3rem;text-align:center">
              ${r.letrasCount[l] > 0 ? `<span style="padding:0.2rem 0.45rem;border-radius:8px;font-weight:700;font-size:0.78rem;background:${l === "A" ? "#e6f7ef" : l === "B" ? "#e8f0fe" : l === "C" ? "#fff8e1" : l === "D" ? "#fff3e0" : "#fef0f0"};color:${l === "A" ? "#1a9e5c" : l === "B" ? "#003366" : l === "C" ? "#b8860b" : l === "D" ? "#e65100" : "#e53e3e"}">${r.letrasCount[l]}</span>` : "<span style='color:#ccc'>-</span>"}
            </td>`
            ).join("")}
          </tr>`
            )
            .join("")}
        </tbody>
      </table>
    </div>`;
  }
}
function updateNotaLocal(estId, lapso, key, val) {
  const k = `${estId}_${lapso}`;
  if (!notas[k]) notas[k] = {};
  notas[k][key] = val;
}
async function guardarNotas(estId, lapso) {
  const key = `${estId}_${lapso}`;
  // Los ajustes del consejo («consejo») no se tocan aquí: son del director (ver servicios/calificaciones.js)
  const { consejo, ...datos } = notas[key] || {};
  try {
    await db
      .collection("notas")
      .doc(key)
      .set({ estId, lapso, ...datos, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
    alert("✅ Notas guardadas correctamente");
  } catch (e) {
    alert("Error: " + e.message);
  }
}
