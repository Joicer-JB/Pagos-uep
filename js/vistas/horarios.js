// Nómina → 🗓️ Horarios: el horario de cada grado (por materia), para verlo, corregirlo e imprimirlo, y la carga de
// una vez de los horarios de las fotos (servicios/horarios.js).

let horariosGrado = null; // config/horarios: {grado: {filas}}; null = sin cargar todavía
let horarioVer = "1er Grado"; // grado que se ve
let horarioEditando = false;
let cargaFotosAbierta = false;
const GRADOS_CON_HORARIO = [...GRADOS_PREESCOLAR, ...GRADOS_PRIMARIA_LIST];

async function cargarHorariosGrado() {
  try {
    const snap = await db.collection("config").doc("horarios").get();
    horariosGrado = snap.exists ? snap.data() || {} : {};
  } catch (e) {
    console.error(e);
    horariosGrado = {};
  }
  if (tabActual === "nomina" && subTab.nomina === "horarios") renderTabContent();
}
const horaFila = (f) => horaCorta(f.desde) + " a " + horaCorta(f.hasta);

function renderHorariosNomina() {
  if (horariosGrado === null) {
    cargarHorariosGrado();
    return `<div class="empty"><p>Cargando horarios…</p></div>`;
  }
  const h = horariosGrado[horarioVer];
  return `
  <div class="card horario-fotos" style="padding:0.75rem;margin-bottom:0.6rem">
    <div style="display:flex;gap:0.5rem;align-items:center;flex-wrap:wrap">
      <div style="flex:1;min-width:12rem;font-size:0.78rem;color:#555">Horarios de las fotos de noviembre 2026: el de cada grado de Primaria y las clases de Media general y de los especialistas en la ficha de cada profesor.</div>
      <button class="btn btn-gray btn-sm" id="hf-abrir" onclick="cargaFotosAbierta=!cargaFotosAbierta;renderTabContent()">${cargaFotosAbierta ? "Cerrar" : "📥 Cargar horarios de las fotos"}</button>
    </div>
    ${cargaFotosAbierta ? renderCargaFotos() : ""}
  </div>
  <div class="stabs horario-grados" style="flex-wrap:wrap">
    ${GRADOS_CON_HORARIO.map(
      (g) =>
        `<button class="stab ${g === horarioVer ? "active" : ""}" onclick="horarioVer='${g}';horarioEditando=false;renderTabContent()">${escHtml(g)}${horariosGrado[g] ? "" : " ·"}</button>`
    ).join("")}
  </div>
  <div class="card" style="padding:0.75rem">
    <div class="card-title" style="margin-bottom:0.4rem"><div class="card-bar"></div><h2>Horario de ${escHtml(horarioVer)}</h2></div>
    ${
      horarioEditando
        ? renderEditarHorario(h)
        : `${h && h.filas && h.filas.length ? tablaHorario(h) : `<div class="empty" style="padding:0.8rem"><p>${escHtml(horarioVer)} no tiene horario todavía.</p></div>`}
    <div style="display:flex;gap:0.4rem;margin-top:0.6rem;flex-wrap:wrap">
      <button class="btn btn-primary btn-sm" id="h-editar" onclick="horarioEditando=true;renderTabContent()">✏️ ${h ? "Corregir" : "Escribir horario"}</button>
      ${h ? `<button class="btn btn-print btn-sm" onclick="imprimirHorarios(['${horarioVer}'])">🖨️ Imprimir</button>` : ""}
      ${Object.keys(horariosGrado).length > 1 ? `<button class="btn btn-gray btn-sm" onclick="imprimirHorarios()">🖨️ Imprimir todos</button>` : ""}
    </div>`
    }
  </div>`;
}
// Tabla Lunes–Viernes (también para imprimir)
function tablaHorario(h) {
  return `<div style="overflow-x:auto"><table class="tabla-horario" style="width:100%;border-collapse:collapse;font-size:0.76rem;min-width:34rem">
    <tr><th style="text-align:left;padding:0.3rem;border:1px solid #dde3ee">Hora</th>${["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"].map((d) => `<th style="padding:0.3rem;border:1px solid #dde3ee">${d}</th>`).join("")}</tr>
    ${h.filas
      .map((f) =>
        f.receso
          ? `<tr><td style="padding:0.3rem;border:1px solid #dde3ee;white-space:nowrap;color:#666">${escHtml(horaFila(f))}</td><td colspan="5" style="padding:0.3rem;border:1px solid #dde3ee;text-align:center;background:#f1f4f9;color:#555;letter-spacing:3px">RECESO</td></tr>`
          : `<tr><td style="padding:0.3rem;border:1px solid #dde3ee;white-space:nowrap;color:#666">${escHtml(horaFila(f))}</td>${(f.celdas || []).map((c) => `<td style="padding:0.3rem;border:1px solid #dde3ee">${escHtml(c || "")}</td>`).join("")}</tr>`
      )
      .join("")}
  </table></div>`;
}
const filaHorarioForm = (i, f = { desde: "", hasta: "", celdas: ["", "", "", "", ""] }) =>
  `<div class="h-fila" data-i="${i}" style="border:1px solid #e2e8f0;border-radius:10px;padding:0.45rem;margin-bottom:0.4rem">
    <div style="display:flex;gap:0.35rem;align-items:end;flex-wrap:wrap">
      <div class="field" style="margin:0"><label class="field-label">Desde</label><input class="inp" type="time" id="h-desde-${i}" value="${escHtml(f.desde)}"/></div>
      <div class="field" style="margin:0"><label class="field-label">Hasta</label><input class="inp" type="time" id="h-hasta-${i}" value="${escHtml(f.hasta)}"/></div>
      <label class="chip-op" style="margin-bottom:0.3rem"><input type="checkbox" id="h-receso-${i}" ${f.receso ? "checked" : ""} onchange="this.closest('.h-fila').querySelector('.h-celdas').style.display=this.checked?'none':'grid'"/>Receso</label>
      <button type="button" class="btn btn-gray btn-sm" title="Quitar" style="margin:0 0 0.3rem auto" onclick="this.closest('.h-fila').remove()">✕</button>
    </div>
    <div class="h-celdas" style="display:${f.receso ? "none" : "grid"};grid-template-columns:repeat(auto-fit,minmax(7rem,1fr));gap:0.3rem;margin-top:0.35rem">
      ${HORARIO_DIAS.map((d, k) => `<input class="inp" id="h-c-${i}-${k}" placeholder="${NOMBRE_DIA[d]}" value="${escHtml((f.celdas || [])[k] || "")}"/>`).join("")}
    </div>
  </div>`;
function renderEditarHorario(h) {
  const filas = h && h.filas && h.filas.length ? h.filas : [undefined];
  return `<div id="h-filas">${filas.map((f, i) => filaHorarioForm(i, f)).join("")}</div>
    <button type="button" class="btn btn-gray btn-sm" onclick="agregarFilaHorario()">+ Agregar fila</button>
    <div id="h-err"></div>
    <div style="display:flex;gap:0.4rem;margin-top:0.6rem">
      <button class="btn btn-primary" style="flex:1" id="h-guardar" onclick="guardarHorarioGrado()">💾 Guardar</button>
      <button class="btn btn-gray" onclick="horarioEditando=false;renderTabContent()">Cancelar</button>
    </div>`;
}
function agregarFilaHorario() {
  const cont = document.getElementById("h-filas");
  const i = Math.max(-1, ...[...cont.querySelectorAll(".h-fila")].map((f) => Number(f.dataset.i))) + 1;
  cont.insertAdjacentHTML("beforeend", filaHorarioForm(i));
}
function leerHorarioForm() {
  const filas = [];
  document.querySelectorAll("#h-filas .h-fila").forEach((el) => {
    const i = el.dataset.i;
    const v = (id) => (document.getElementById(id) || {}).value || "";
    const desde = v("h-desde-" + i),
      hasta = v("h-hasta-" + i);
    if (document.getElementById("h-receso-" + i).checked) return filas.push({ desde, hasta, receso: true });
    const celdas = HORARIO_DIAS.map((_, k) => v(`h-c-${i}-${k}`).trim());
    if (!desde && !hasta && celdas.every((c) => !c)) return; // fila vacía
    filas.push({ desde, hasta, celdas });
  });
  filas.sort((a, b) => (minutosHora(a.desde) ?? 0) - (minutosHora(b.desde) ?? 0));
  return { filas };
}
async function guardarHorarioGrado() {
  const h = leerHorarioForm();
  const mal = revisarHorarioGrado(h);
  if (mal) return mostrarError("h-err", mal);
  try {
    await db
      .collection("config")
      .doc("horarios")
      .set({ [horarioVer]: h }, { merge: true });
    horariosGrado[horarioVer] = h;
    horarioEditando = false;
    mostrarToast("Horario de " + horarioVer + " guardado");
    renderTabContent();
  } catch (e) {
    mostrarError("h-err", e.message);
  }
}
function imprimirHorarios(grados) {
  const lista = (grados || GRADOS_CON_HORARIO).filter((g) => horariosGrado[g]);
  const w = abrirVentanaImpresion("width=900,height=900");
  if (!w) return alert("Permite las ventanas emergentes para imprimir");
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>Horarios de clase</title>
  <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Segoe UI',Arial,sans-serif;color:#222;background:#fff}
  @page{size:letter landscape;margin:12mm}.hoja{page-break-after:always;padding:0.5rem}.hoja:last-of-type{page-break-after:auto}
  .hdr{display:flex;align-items:center;gap:0.9rem;padding-bottom:0.5rem;border-bottom:2px solid #003366;margin-bottom:0.7rem}.hdr img{width:46px;height:46px;object-fit:contain}
  table{min-width:0!important}td,th{font-size:0.85rem}@media print{.no-print{display:none}}</style></head><body>
  ${lista
    .map(
      (g) => `<div class="hoja"><div class="hdr"><img src="data:image/png;base64,${LOGO}" alt="Logo"/><div>
      <div style="font-size:0.6rem;letter-spacing:2px;color:#003366;font-weight:700;text-transform:uppercase">Horario de clases</div>
      <div style="font-size:1.05rem;font-family:Georgia,serif;color:#003366">${escHtml(g)}</div>
      <div style="font-size:0.65rem;color:#555">${EMPRESA} · ${EMPRESA_SUB}</div></div></div>${tablaHorario(horariosGrado[g])}</div>`
    )
    .join("")}
  <div class="no-print" style="text-align:center;padding:0.75rem"><button onclick="window.print()" style="background:#003366;color:#fff;border:none;padding:0.65rem 1.5rem;border-radius:8px;font-weight:700">🖨️ Imprimir / Guardar PDF</button></div>
  </body></html>`);
  w.document.close();
}

// ---- Carga de las fotos
const opcionesProfesorHorario = (elegido) =>
  `<option value="">— No cargar todavía —</option>` +
  trabajadoresActivos()
    .slice()
    .sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""))
    .map((t) => `<option value="${t.id}" ${t.id === elegido ? "selected" : ""}>${escHtml(t.nombre)}</option>`)
    .join("");
const lineaClase = (c) => `${escHtml(c.materia)} · ${escHtml(textoGrados(c.grados))} · ${escHtml(textoHorario(c))}`;
function renderCargaFotos() {
  const ya = GRADOS_PRIMARIA_LIST.filter((g) => horariosGrado[g]);
  return `<div class="carga-fotos" style="margin-top:0.6rem;font-size:0.78rem">
    <label class="chip-op" style="margin-bottom:0.3rem"><input type="checkbox" id="hf-primaria" checked/>Guardar el horario de 1er a 6to Grado${ya.length ? ` <span style="color:#b8860b">(reemplaza el que ya tienen: ${ya.map(escHtml).join(", ")})</span>` : ""}</label>
    <div style="font-weight:700;color:#003366;margin:0.6rem 0 0.2rem">Media general</div>
    <div style="color:#666;margin-bottom:0.3rem">Elige el trabajador de cada hoja. Si alguno no está en Nómina, agrégalo primero y vuelve aquí. Las clases que ya tenga se quedan; no se repiten.</div>
    ${HORARIOS_FOTOS_MG.map((p, i) => {
      const m = buscarPorPrimerNombre(p.nombre, trabajadores);
      const clases = clasesFotoMG(p, configMaterias);
      const sinConfig = [
        ...new Set(
          p.clases
            .map(([, , anio, mat]) => ({
              g: GRADOS_MG[anio - 1],
              r: nombreMateriaMG(mat, configMaterias[GRADOS_MG[anio - 1]]),
            }))
            // solo en los años que ya tienen sus materias en Configuración
            .filter((x) => !x.r.enConfig && (configMaterias[x.g] || []).length)
            .sort((a, b) => GRADOS_MG.indexOf(a.g) - GRADOS_MG.indexOf(b.g))
            .map((x) => x.r.nombre + " (" + x.g + ")")
        ),
      ];
      return `<div class="hf-prof" style="border:1px solid #e2e8f0;border-radius:10px;padding:0.45rem;margin-bottom:0.35rem">
        <div style="display:flex;gap:0.4rem;align-items:center;flex-wrap:wrap"><strong style="min-width:5.5rem">Hoja «${escHtml(p.nombre)}»</strong>
          <select class="inp" id="hf-mg-${i}" style="flex:1;min-width:10rem">${opcionesProfesorHorario(m.length === 1 ? m[0].id : "")}</select></div>
        ${m.length > 1 ? `<div style="color:#b8860b">Hay ${m.length} trabajadores con ese nombre: elige cuál.</div>` : ""}
        <div style="color:#555;margin-top:0.2rem">${clases.map(lineaClase).join("<br/>")}</div>
        ${sinConfig.length ? `<div style="color:#b8860b;margin-top:0.2rem">⚠️ No está en ⚙️ Config → Materias: ${sinConfig.map(escHtml).join(", ")}</div>` : ""}
      </div>`;
    }).join("")}
    <div style="font-weight:700;color:#003366;margin:0.6rem 0 0.2rem">Especialistas de Inicial y Primaria</div>
    <div style="color:#666;margin-bottom:0.3rem">La hoja no trae nombres: elige quién da cada una.</div>
    ${ESPECIALIDADES.map(
      (
        [mat, texto],
        i
      ) => `<div class="hf-esp" style="border:1px solid #e2e8f0;border-radius:10px;padding:0.45rem;margin-bottom:0.35rem">
        <div style="display:flex;gap:0.4rem;align-items:center;flex-wrap:wrap"><strong style="min-width:5.5rem">${escHtml(texto)}</strong>
          <select class="inp" id="hf-esp-${i}" style="flex:1;min-width:10rem">${opcionesProfesorHorario("")}</select></div>
        <div style="color:#555;margin-top:0.2rem">${clasesFotoEspecialista(mat).map(lineaClase).join("<br/>")}</div>
      </div>`
    ).join("")}
    <div id="hf-err"></div>
    <button class="btn btn-primary" style="width:100%;margin-top:0.4rem" id="hf-guardar" onclick="guardarCargaFotos()">✅ Guardar todo</button>
  </div>`;
}
async function guardarCargaFotos() {
  // trabajador → clases nuevas (si una hoja y un especialista son el mismo, se juntan)
  const porTrab = new Map();
  const sumar = (id, clases) => id && porTrab.set(id, [...(porTrab.get(id) || []), ...clases]);
  HORARIOS_FOTOS_MG.forEach((p, i) =>
    sumar(document.getElementById("hf-mg-" + i).value, clasesFotoMG(p, configMaterias))
  );
  ESPECIALIDADES.forEach(([mat], i) =>
    sumar(document.getElementById("hf-esp-" + i).value, clasesFotoEspecialista(mat))
  );
  const primaria = document.getElementById("hf-primaria").checked;
  if (!primaria && !porTrab.size)
    return mostrarError("hf-err", "Marca el horario de Primaria o elige al menos un trabajador");
  try {
    const lote = db.batch();
    let total = 0;
    const cambios = [];
    porTrab.forEach((nuevas, id) => {
      const t = trabajadores.find((x) => x.id === id);
      if (!t) return;
      const r = sumarClases(clasesDe(t), nuevas);
      total += r.agregadas;
      if (r.agregadas) {
        lote.update(db.collection("trabajadores").doc(id), { clases: r.lista });
        cambios.push([t, r.lista]);
      }
    });
    const grados = {};
    if (primaria) GRADOS_PRIMARIA_LIST.forEach((g) => (grados[g] = HORARIOS_FOTOS_GRADOS[g]));
    if (primaria) lote.set(db.collection("config").doc("horarios"), grados, { merge: true });
    await lote.commit();
    cambios.forEach(([t, lista]) => (t.clases = lista));
    Object.assign(horariosGrado, grados);
    cargaFotosAbierta = false;
    mostrarToast(
      [primaria ? "Horario de Primaria guardado" : "", total ? total + " clases agregadas en Nómina" : ""]
        .filter(Boolean)
        .join(" · ") || "Nada nuevo: esas clases ya estaban"
    );
    renderTabContent();
  } catch (e) {
    mostrarError("hf-err", e.message);
  }
}
