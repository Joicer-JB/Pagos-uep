// Nómina: formulario del trabajador (datos, sueldo fijo, horas de clase, clases que da y cuentas), su ficha y sus
// documentos. Ver vistas/nomina.js.

function editarTrabajador(id) {
  trabEditId = id;
  cerrarModal();
  subTab.nomina = "nuevo";
  renderTabContent();
}
const campoDolar = (id, valor, ph, color) =>
  `<div style="position:relative"><span style="position:absolute;left:0.9rem;top:50%;transform:translateY(-50%);color:${color || "#003366"};font-weight:700">$</span>
    <input class="inp" id="${id}" placeholder="${ph || "0"}" inputmode="decimal" style="padding-left:1.9rem" value="${valor || ""}"/></div>`;
// «2,5» o «2.5» → 2.5 (en las horas y en lo que vale la hora no hay miles, así que el punto también es decimal)
const numeroCorto = (v) =>
  Number(
    String(v || "")
      .replace(/[\s$]/g, "")
      .replace(",", ".")
  ) || 0;
const seccionForm = (txt) =>
  `<div style="font-size:0.7rem;color:#003366;text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-top:0.5rem;border-bottom:1px solid #e2e8f0;padding-bottom:0.25rem">${txt}</div>`;
// Una fila de horas de clase: nivel, horas al mes y lo que vale la hora
const filaHorasForm = (
  i,
  h = {}
) => `<div class="t-hora" data-i="${i}" style="display:grid;grid-template-columns:1fr 1fr auto;gap:0.4rem;align-items:end;border:1px solid #e2e8f0;border-radius:10px;padding:0.5rem;margin-bottom:0.4rem">
    <div class="field" style="grid-column:1/-1;margin:0"><label class="field-label">Nivel</label><select class="inp" id="t-h-nivel-${i}" onchange="tarifaSugerida(${i})">${NIVELES_HORAS.map(
      (n) => `<option ${h.nivel === n ? "selected" : ""}>${n}</option>`
    ).join("")}</select></div>
    <div class="field" style="margin:0"><label class="field-label">Horas al mes</label><input class="inp" id="t-h-horas-${i}" inputmode="decimal" placeholder="0" value="${h.horas ? String(h.horas).replace(".", ",") : ""}" oninput="resumenSueldoForm()"/></div>
    <div class="field" style="margin:0"><label class="field-label">$ la hora</label>${campoDolar("t-h-tarifa-" + i, h.tarifa ? String(h.tarifa).replace(".", ",") : String(TARIFA_HORA[h.nivel || NIVELES_HORAS[0]] || "").replace(".", ","), "0,00").replace('inputmode="decimal"', 'inputmode="decimal" oninput="resumenSueldoForm()"')}</div>
    <button type="button" class="btn btn-gray btn-sm" title="Quitar" style="margin-bottom:0.2rem" onclick="this.closest('.t-hora').remove();resumenSueldoForm()">✕</button>
  </div>`;
function agregarFilaHoras() {
  const cont = document.getElementById("t-horas");
  if (!cont) return;
  const i = Math.max(-1, ...[...cont.querySelectorAll(".t-hora")].map((f) => Number(f.dataset.i))) + 1;
  cont.insertAdjacentHTML("beforeend", filaHorasForm(i));
  resumenSueldoForm();
}
// Al cambiar el nivel, la tarifa de ese nivel (Media general $ 2,50; Primaria $ 2,00), que se puede cambiar
function tarifaSugerida(i) {
  const nivel = document.getElementById("t-h-nivel-" + i).value,
    tarifa = document.getElementById("t-h-tarifa-" + i);
  if (TARIFA_HORA[nivel]) tarifa.value = String(TARIFA_HORA[nivel]).replace(".", ",");
  resumenSueldoForm();
}
function leerHorasForm() {
  const lista = [];
  let error = "";
  document.querySelectorAll("#t-horas .t-hora").forEach((f) => {
    const i = f.dataset.i;
    const nivel = document.getElementById("t-h-nivel-" + i).value,
      horas = r2(numeroCorto(document.getElementById("t-h-horas-" + i).value)),
      tarifa = r2(numeroCorto(document.getElementById("t-h-tarifa-" + i).value));
    if (!(horas > 0) && !(tarifa > 0)) return;
    if (!(horas > 0) && !error) error = "Escribe cuántas horas al mes da en " + nivel;
    else if (!(tarifa > 0) && !error) error = "Escribe cuánto vale la hora en " + nivel;
    else lista.push({ nivel, horas, tarifa });
  });
  return { lista, error };
}
// Lo que gana al mes según lo escrito: fijo + horas
function resumenSueldoForm() {
  const out = document.getElementById("t-resumen");
  if (!out) return;
  const v = (id) => parseFmt((document.getElementById(id) || {}).value || "0");
  const t = {
    salario: v("t-salario"),
    bonoAlimentacion: v("t-balim"),
    bonoProductividad: v("t-bprod"),
    descuento: v("t-desc"),
    horas: leerHorasForm().lista,
  };
  const fijo = r2(t.salario + t.bonoAlimentacion + t.bonoProductividad),
    horas = montoHorasMes(t);
  out.innerHTML =
    fijo + horas > 0
      ? `<div class="alert-item alert-info"><div>${ETIQ_TIPO_PAGO[tipoPagoTrabajador(t)]} · gana al mes <strong>${fmt(r2(fijo + horas))}</strong>${fijo > 0 && horas > 0 ? ` (fijo ${fmt(fijo)} + horas ${fmt(horas)})` : ""}${t.descuento > 0 ? ` · neto ${fmt(netoMensual(t))}` : ""}</div></div>`
      : "";
}
// Cuenta bancaria i (0 = principal): banco, tipo, número, titular y su cédula
const filaCuentaForm = (
  i,
  c = {}
) => `<div class="t-cuenta" style="border:1px solid #e2e8f0;border-radius:10px;padding:0.6rem;margin-bottom:0.5rem">
    <div style="font-size:0.75rem;font-weight:700;color:#555;margin-bottom:0.3rem">🏦 Cuenta ${i + 1}${i === 0 ? " (principal)" : " (opcional)"}</div>
    <div class="form-row">
      <div class="field"><label class="field-label">Número de cuenta o teléfono</label><input class="inp" id="t-c-num-${i}" inputmode="numeric" placeholder="0134 0000 00 0000000000" value="${escHtml(c.numero) || ""}" oninput="bancoSugerido(${i})"/></div>
      <div class="field"><label class="field-label">Tipo</label><select class="inp" id="t-c-tipo-${i}">${TIPOS_CUENTA.map((x) => `<option ${c.tipo === x ? "selected" : ""}>${x}</option>`).join("")}</select></div>
    </div>
    <div class="field"><label class="field-label">Banco</label><input class="inp" id="t-c-banco-${i}" list="bancos-ve" placeholder="Ej: Banesco" value="${escHtml(c.banco) || ""}"/></div>
    <div class="form-row">
      <div class="field"><label class="field-label">Titular <span style="font-weight:400;color:#888">(si no es el trabajador)</span></label><input class="inp" id="t-c-tit-${i}" value="${escHtml(c.titular) || ""}"/></div>
      <div class="field"><label class="field-label">Cédula del titular</label><input class="inp" id="t-c-ced-${i}" value="${escHtml(c.cedulaTitular) || ""}"/></div>
    </div>
  </div>`;
// Los 4 primeros dígitos de la cuenta dicen el banco
function bancoSugerido(i) {
  const banco = bancoDeCuenta(document.getElementById("t-c-num-" + i).value),
    campo = document.getElementById("t-c-banco-" + i);
  if (banco && campo && !campo.value.trim()) campo.value = banco;
}
function leerCuentasForm() {
  const lista = [];
  let error = "";
  for (let i = 0; i < 2; i++) {
    const val = (id) => ((document.getElementById(id + i) || {}).value || "").trim();
    const c = {
      banco: val("t-c-banco-"),
      tipo: val("t-c-tipo-") || TIPOS_CUENTA[0],
      numero: soloDigitos(val("t-c-num-")),
      titular: val("t-c-tit-"),
      cedulaTitular: val("t-c-ced-"),
    };
    if (!c.numero) continue;
    if (!c.banco) c.banco = bancoDeCuenta(c.numero);
    const mal = revisarCuenta(c);
    if (mal && !error) error = "Cuenta " + (i + 1) + ": " + mal;
    if (!c.banco && !error) error = "Cuenta " + (i + 1) + ": escribe el banco";
    lista.push(c);
  }
  return { lista, error };
}
// ---- Clases que da: materia, grados o años, días y horario
const chipOpcion = (attr, i, valor, marcado, texto) =>
  `<label class="chip-op"><input type="checkbox" ${attr}="${i}" value="${escHtml(valor)}" ${marcado ? "checked" : ""}/>${escHtml(texto || valor)}</label>`;
const filaClaseForm = (i, c = {}) => {
  const grados = c.grados || [],
    dias = c.dias || [];
  return `<div class="t-clase" data-i="${i}" style="border:1px solid #e2e8f0;border-radius:10px;padding:0.55rem;margin-bottom:0.45rem">
    <div style="display:grid;grid-template-columns:1fr auto;gap:0.4rem;align-items:end">
      <div class="field" style="margin:0"><label class="field-label">Materia <span style="font-weight:400;color:#888">(vacía = docente de aula)</span></label><input class="inp" id="t-cl-mat-${i}" list="materias-lista" placeholder="Ej: Matemáticas" value="${escHtml(c.materia) || ""}"/></div>
      <button type="button" class="btn btn-gray btn-sm" title="Quitar" style="margin-bottom:0.2rem" onclick="this.closest('.t-clase').remove()">✕</button>
    </div>
    <div class="field-label" style="margin-top:0.4rem">Grados o años</div>
    <div style="display:flex;gap:0.3rem;flex-wrap:wrap;margin-bottom:0.3rem">
      <button type="button" class="btn btn-gray btn-sm" style="font-size:0.68rem;padding:0.2rem 0.5rem" onclick="marcarGradosClase(${i},'todo')">🏫 Todo el colegio</button>
      ${GRUPOS_GRADOS.map((g) => `<button type="button" class="btn btn-gray btn-sm" style="font-size:0.68rem;padding:0.2rem 0.5rem" onclick="marcarGradosClase(${i},'${g.nombre}')">${g.nombre}</button>`).join("")}
      <button type="button" class="btn btn-gray btn-sm" style="font-size:0.68rem;padding:0.2rem 0.5rem" onclick="marcarGradosClase(${i},'nada')">Ninguno</button>
    </div>
    ${GRUPOS_GRADOS.map(
      (g) =>
        `<div style="display:flex;gap:0.25rem;flex-wrap:wrap;margin-bottom:0.25rem"><span style="font-size:0.64rem;color:#888;width:100%">${g.nombre}</span>${g.grados
          .map((x) => chipOpcion("data-cl-grado", i, x, grados.includes(x)))
          .join("")}</div>`
    ).join("")}
    <div class="field-label" style="margin-top:0.35rem">Días y horario <span style="font-weight:400;color:#888">(opcional)</span></div>
    <div style="display:flex;gap:0.25rem;flex-wrap:wrap;margin-bottom:0.35rem">${DIAS_SEMANA.map((d) => chipOpcion("data-cl-dia", i, d, dias.includes(d))).join("")}</div>
    <div class="form-row">
      <div class="field" style="margin:0"><label class="field-label">Desde</label><input class="inp" type="time" id="t-cl-desde-${i}" value="${escHtml(c.desde) || ""}"/></div>
      <div class="field" style="margin:0"><label class="field-label">Hasta</label><input class="inp" type="time" id="t-cl-hasta-${i}" value="${escHtml(c.hasta) || ""}"/></div>
    </div>
  </div>`;
};
function agregarFilaClase() {
  const cont = document.getElementById("t-clases");
  if (!cont) return;
  const i = Math.max(-1, ...[...cont.querySelectorAll(".t-clase")].map((f) => Number(f.dataset.i))) + 1;
  cont.insertAdjacentHTML("beforeend", filaClaseForm(i));
}
// Atajos: todo el colegio, un nivel completo (si ya estaba todo marcado, lo desmarca) o ninguno
function marcarGradosClase(i, que) {
  const cajas = [...document.querySelectorAll(`input[data-cl-grado="${i}"]`)];
  const grupo = GRUPOS_GRADOS.find((g) => g.nombre === que);
  const del = grupo ? cajas.filter((c) => grupo.grados.includes(c.value)) : cajas;
  const marcar = que === "nada" ? false : grupo ? !del.every((c) => c.checked) : true;
  del.forEach((c) => (c.checked = marcar));
}
function leerClasesForm() {
  const lista = [];
  let error = "";
  document.querySelectorAll("#t-clases .t-clase").forEach((f, n) => {
    const i = f.dataset.i;
    const marcados = (attr) => [...f.querySelectorAll(`input[${attr}="${i}"]:checked`)].map((x) => x.value);
    const c = {
      materia: document.getElementById("t-cl-mat-" + i).value.trim(),
      grados: marcados("data-cl-grado"),
      dias: marcados("data-cl-dia"),
      desde: document.getElementById("t-cl-desde-" + i).value,
      hasta: document.getElementById("t-cl-hasta-" + i).value,
    };
    if (!c.materia && !c.grados.length && !c.dias.length && !c.desde && !c.hasta) return; // fila vacía
    const mal = revisarClase(c);
    if (mal && !error) error = "Clase " + (n + 1) + (c.materia ? " (" + c.materia + ")" : "") + ": " + mal;
    lista.push(c);
  });
  return { lista, error };
}
// Materias que se sugieren: las de Configuración → Materias y las de siempre
const materiasSugeridas = () =>
  [
    ...new Set(
      [
        ...MATERIAS,
        ...Object.values(configMaterias || {}).flat(),
        "Educación Física y Deporte",
        "Inglés",
        "Música",
        "Computación",
      ].filter((m) => typeof m === "string" && m.trim())
    ),
  ].sort((a, b) => a.localeCompare(b));
function renderFormTrabajador(data = {}) {
  const horas = Array.isArray(data.horas) && data.horas.length ? data.horas : [];
  const cuentas = Array.isArray(data.cuentas) ? data.cuentas : [];
  const clases = Array.isArray(data.clases) ? data.clases : [];
  setTimeout(resumenSueldoForm, 0);
  return `<div class="card">
    <div class="card-title"><div class="card-bar"></div><h2>${data.id ? "Editar" : "Nuevo"} Trabajador</h2></div>
    <datalist id="bancos-ve">${Object.values(BANCOS_VE)
      .sort()
      .map((b) => `<option value="${b}"></option>`)
      .join("")}</datalist>
    <datalist id="materias-lista">${materiasSugeridas()
      .map((m) => `<option value="${escHtml(m)}"></option>`)
      .join("")}</datalist>
    <div class="form-grid">
      ${seccionForm("👤 Datos personales")}
      <div class="field"><label class="field-label">Nombre completo *</label><input class="inp" id="t-nombre" value="${escHtml(data.nombre) || ""}"/></div>
      <div class="form-row">
        <div class="field"><label class="field-label">Cédula</label><input class="inp" id="t-cedula" placeholder="V-12345678" value="${escHtml(data.cedula) || ""}"/></div>
        <div class="field"><label class="field-label">RIF</label><input class="inp" id="t-rif" placeholder="V-12345678-9" value="${escHtml(data.rif) || ""}"/></div>
      </div>
      <div class="form-row">
        <div class="field"><label class="field-label">Teléfono</label><input class="inp" id="t-telefono" inputmode="tel" placeholder="0414 1234567" value="${escHtml(data.telefono) || ""}"/></div>
        <div class="field"><label class="field-label">📅 Fecha de ingreso a la escuela</label><input class="inp" type="date" id="t-fingreso" value="${escHtml(data.fechaIngreso) || ""}"/></div>
      </div>
      <div style="font-size:0.72rem;color:#888;margin-top:-0.3rem">Si solo sabes el año, pon el día en que empezó el año escolar (p. ej. 15/09/2015).</div>
      <div class="field"><label class="field-label">Cargo o funciones</label><input class="inp" id="t-cargo" placeholder="Ej: Coordinadora de Primaria y docente de Media general" value="${escHtml(data.cargo) || ""}"/></div>
      <div class="field"><label class="field-label">🎓 Títulos obtenidos <span style="font-weight:400;color:#888">(uno por línea)</span></label><textarea class="inp" id="t-titulos" rows="2" placeholder="Ej: Licenciada en Educación Integral (UPEL, 2012)">${escHtml((data.titulos || []).join("\n"))}</textarea></div>

      ${seccionForm("💼 Sueldo fijo")}
      <div class="form-row">
        <div class="field"><label class="field-label">Salario base mensual ($)</label>${campoDolar("t-salario", data.salario).replace('inputmode="decimal"', 'inputmode="decimal" oninput="resumenSueldoForm()"')}</div>
        <div class="field"><label class="field-label">¿Cómo se le paga?</label>
          <select class="inp" id="t-frec"><option value="quincenal" ${data.frecuencia !== "mensual" ? "selected" : ""}>🔁 Por quincenas (la mitad cada una)</option><option value="mensual" ${data.frecuencia === "mensual" ? "selected" : ""}>📆 Una vez al mes</option></select></div>
      </div>
      <div style="font-size:0.72rem;color:#888;margin-top:-0.3rem">Si solo trabaja por horas, deja el salario vacío.</div>
      <div class="form-row">
        <div class="field"><label class="field-label">🍽️ Bono alimentación (mensual)</label>${campoDolar("t-balim", data.bonoAlimentacion).replace('inputmode="decimal"', 'inputmode="decimal" oninput="resumenSueldoForm()"')}</div>
        <div class="field"><label class="field-label">⭐ Bono productividad (mensual)</label>${campoDolar("t-bprod", data.bonoProductividad).replace('inputmode="decimal"', 'inputmode="decimal" oninput="resumenSueldoForm()"')}</div>
      </div>
      <div class="form-row">
        <div class="field"><label class="field-label">Deducción fija mensual ($)</label>${campoDolar("t-desc", data.descuento, "0", "#e53e3e").replace('inputmode="decimal"', 'inputmode="decimal" oninput="resumenSueldoForm()"')}</div>
        <div class="field"><label class="field-label">¿Qué es la deducción fija?</label><input class="inp" id="t-desc-concepto" placeholder="Ej: Caja de ahorro, IVSS" value="${escHtml(data.descuentoConcepto) || ""}"/></div>
      </div>
      <div style="font-size:0.72rem;color:#888;margin-top:-0.3rem">Los adelantos y los préstamos no van aquí: regístralos con 💸 Adelanto y 🤝 Préstamo y se descuentan solos al pagar.</div>

      ${seccionForm("⏱️ Horas de clase")}
      <div style="font-size:0.72rem;color:#888">Para quien da clases por horas (todos los de Media general, o quien tiene un cargo fijo y además da horas). Cada nivel con lo que vale su hora. Las horas del mes son las que da normalmente; al pagar se escriben las que trabajó en esa quincena.</div>
      <div id="t-horas">${horas.map((h, i) => filaHorasForm(i, h)).join("")}</div>
      <button type="button" class="btn btn-gray btn-sm" onclick="agregarFilaHoras()">+ Agregar horas de clase</button>
      <div id="t-resumen"></div>

      ${seccionForm("📚 Clases que da")}
      <div style="font-size:0.72rem;color:#888">En Inicial y Primaria basta marcar el grado. En Media general, una fila por materia con los años, los días y el horario (si el horario cambia de un año a otro, agrega otra fila). Deporte o Inglés: «Todo el colegio».</div>
      <div id="t-clases">${clases.map((c, i) => filaClaseForm(i, c)).join("")}</div>
      <button type="button" class="btn btn-gray btn-sm" onclick="agregarFilaClase()">+ Agregar clase</button>

      ${seccionForm("🏦 Cuentas para pagarle")}
      ${[0, 1].map((i) => filaCuentaForm(i, cuentas[i])).join("")}

      <div class="field"><label class="field-label">Observación</label><textarea class="inp" id="t-obs" rows="2">${escHtml(data.observacion) || ""}</textarea></div>
      ${data.id ? `<label style="display:flex;gap:0.5rem;align-items:center;font-size:0.82rem"><input type="checkbox" id="t-retirado" ${data.activo === false ? "checked" : ""}/> 🚪 Ya no trabaja aquí (se conserva su historial)</label>` : ""}
      <div style="font-size:0.72rem;color:#888">📎 El certificado de salud y los demás documentos se adjuntan desde la ficha del trabajador, después de guardarlo.</div>
      <div id="t-err"></div>
      <div style="display:flex;gap:0.5rem">
        <button class="btn btn-primary" style="flex:1" onclick="guardarTrabajador('${data.id || ""}')">✓ Guardar</button>
        <button class="btn btn-gray" onclick="trabEditId=null;subTab.nomina='lista';renderTabContent()">Cancelar</button>
      </div>
    </div>
  </div>`;
}
async function guardarTrabajador(editId) {
  const err = (m) => mostrarError("t-err", m);
  const val = (id) => document.getElementById(id).value.trim();
  const nombre = val("t-nombre");
  if (!nombre) return err("El nombre es requerido");
  const cedula = val("t-cedula");
  const otro = cedula && trabajadores.find((t) => t.id !== editId && soloDigitos(t.cedula) === soloDigitos(cedula));
  if (otro) return err("Ya hay un trabajador con esa cédula: " + otro.nombre);
  const rif = normalizarRif(val("t-rif"));
  if (!rifValido(rif)) return err("El RIF debe ser como V-12345678-9");
  const horas = leerHorasForm();
  if (horas.error) return err(horas.error);
  const clases = leerClasesForm();
  if (clases.error) return err(clases.error);
  const cuentas = leerCuentasForm();
  if (cuentas.error) return err(cuentas.error);
  const retirado = document.getElementById("t-retirado");
  const datos = {
    nombre,
    cedula,
    rif,
    telefono: val("t-telefono"),
    cargo: val("t-cargo"),
    titulos: val("t-titulos")
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean),
    salario: parseFmt(val("t-salario")),
    frecuencia: val("t-frec") === "mensual" ? "mensual" : "quincenal",
    bonoAlimentacion: parseFmt(val("t-balim")),
    bonoProductividad: parseFmt(val("t-bprod")),
    descuento: parseFmt(val("t-desc")),
    descuentoConcepto: val("t-desc-concepto"),
    horas: horas.lista,
    clases: clases.lista,
    cuentas: cuentas.lista,
    fechaIngreso: val("t-fingreso"),
    observacion: val("t-obs"),
    activo: !(retirado && retirado.checked),
  };
  if (!(devengadoMensual(datos) > 0) && !confirm("No tiene sueldo fijo ni horas de clase. ¿Guardarlo así?")) return;
  try {
    if (editId) {
      await db.collection("trabajadores").doc(editId).update(datos);
      const i = trabajadores.findIndex((t) => t.id === editId);
      if (i >= 0) trabajadores[i] = { ...trabajadores[i], ...datos };
    } else {
      const ref = await db.collection("trabajadores").add(datos);
      datos.id = ref.id;
      trabajadores.push(datos);
    }
    trabEditId = null;
    subTab.nomina = "lista";
    cerrarModal();
    renderTabContent();
  } catch (e) {
    mostrarError("t-err", e.message);
  }
}
const textoAntiguedad = (t) => {
  const n = antiguedad(t.fechaIngreso);
  return n == null ? "" : fechaCorta(t.fechaIngreso) + " · " + (n === 1 ? "1 año" : n + " años") + " en la escuela";
};
// Documentos adjuntos (certificado de salud, título…): ver/imprimir, quitar y adjuntar otro
function htmlDocumentosTrabajador(t) {
  const adj = Array.isArray(t.adjuntos) ? t.adjuntos : [];
  const cert = estadoCertificado(t);
  const estado = {
    falta: `<div class="alert-item alert-mora" style="margin-bottom:0.4rem">🩺 Falta adjuntar el certificado de salud.</div>`,
    "sin-fecha": "",
    vencido: `<div class="alert-item alert-mora" style="margin-bottom:0.4rem">🩺 El certificado de salud venció el ${cert.adjunto && cert.adjunto.vence ? fechaCorta(cert.adjunto.vence) : ""}: adjunta el nuevo.</div>`,
    "por-vencer": `<div class="alert-item alert-info" style="margin-bottom:0.4rem">🩺 El certificado de salud vence el ${cert.adjunto && cert.adjunto.vence ? fechaCorta(cert.adjunto.vence) : ""}.</div>`,
    vigente: "",
  }[cert.estado];
  return `${estado}
    ${adj
      .map(
        (
          a
        ) => `<div class="doc-trabajador" style="display:flex;align-items:center;gap:0.4rem;padding:0.4rem 0.6rem;background:#f8faff;border-radius:8px;margin-bottom:0.35rem">
        <div style="flex:1;min-width:0;font-size:0.8rem"><strong>${escHtml(CLASES_DOCUMENTO[a.clase] || "📄 Documento")}</strong>
          <div style="font-size:0.7rem;color:#777;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(a.nombre)} · ${Math.max(1, Math.round((a.tam || 0) / 1024))} KB · ${escHtml(fechaCorta(a.fecha))}${a.vence ? " · vence " + escHtml(fechaCorta(a.vence)) : ""}</div></div>
        <button class="btn btn-print btn-sm" onclick="imprimirDocumentoTrabajador('${t.id}','${a.id}')">🖨️ Ver</button>
        <button class="btn btn-gray btn-sm" title="Quitar" onclick="quitarDocumento('${t.id}','${a.id}')">🗑️</button>
      </div>`
      )
      .join("")}
    <div class="form-grid" style="border:1px dashed #c5d8f0;border-radius:10px;padding:0.6rem;margin-top:0.4rem">
      <div class="form-row">
        <div class="field"><label class="field-label">Documento</label><select class="inp" id="doc-clase" onchange="document.getElementById('doc-vence-campo').style.display=this.value==='salud'?'':'none'">${Object.entries(
          CLASES_DOCUMENTO
        )
          .map(
            ([k, l]) =>
              `<option value="${k}" ${k === (cert.estado === "vigente" ? "titulo" : "salud") ? "selected" : ""}>${l}</option>`
          )
          .join("")}</select></div>
        <div class="field" id="doc-vence-campo" ${cert.estado === "vigente" ? 'style="display:none"' : ""}><label class="field-label">Vence el</label><input class="inp" type="date" id="doc-vence"/></div>
      </div>
      <div class="field"><label class="field-label">Archivo (foto o PDF)</label><input class="inp" type="file" id="doc-archivo" accept="image/*,application/pdf"/></div>
      <div id="doc-msg"></div>
      <button class="btn btn-primary btn-sm" onclick="subirDocumento('${t.id}')">📎 Adjuntar</button>
    </div>`;
}
async function subirDocumento(trabId) {
  const msg = (h) => (document.getElementById("doc-msg").innerHTML = h);
  const archivo = (document.getElementById("doc-archivo").files || [])[0];
  const clase = document.getElementById("doc-clase").value;
  const vence = clase === "salud" ? document.getElementById("doc-vence").value : "";
  if (!archivo) return msg(`<div class="error-msg">Elige el archivo</div>`);
  if (clase === "salud" && !vence && !confirm("¿Guardar el certificado de salud sin fecha de vencimiento?")) return;
  msg(`<div style="font-size:0.78rem;color:#555">⏳ Guardando el documento…</div>`);
  try {
    await adjuntarDocumentoTrabajador(trabId, { clase, archivo, vence });
    abrirModal({ tipo: "ver-trabajador", id: trabId });
    mostrarExito("¡Documento adjuntado!", CLASES_DOCUMENTO[clase]);
  } catch (e) {
    msg(`<div class="error-msg">${escHtml(e.message)}</div>`);
  }
}
async function quitarDocumento(trabId, adjId) {
  const t = trabajadores.find((x) => x.id === trabId);
  const a = t && (t.adjuntos || []).find((x) => x.id === adjId);
  if (!a || !confirm("¿Quitar «" + (CLASES_DOCUMENTO[a.clase] || "documento") + "» de " + t.nombre + "?")) return;
  try {
    await quitarDocumentoTrabajador(trabId, adjId);
    abrirModal({ tipo: "ver-trabajador", id: trabId });
  } catch (e) {
    alert("Error: " + e.message);
  }
}
function renderModalVerTrabajador(m) {
  const t = trabajadores.find((x) => x.id === m.id);
  if (!t) return "";
  const prestamos = prestamosDe(t.id),
    adelantos = adelantosPendientes(t.id);
  const pagos = movimientosNomina(t.id)
    .filter((f) => tipoMovNomina(f) === "pago")
    .sort((a, b) => b.fecha.localeCompare(a.fecha))
    .slice(0, 5);
  const fila = (l, v, c) =>
    `<div style="display:flex;justify-content:space-between;gap:0.5rem;padding:0.4rem 0.75rem;background:#f8faff;border-radius:8px;margin-bottom:0.35rem"><span style="font-size:0.82rem;color:#555">${l}</span><span style="font-weight:700;color:${c};text-align:right;font-size:0.88rem;${String(v).length <= 14 ? "white-space:nowrap" : ""}">${v}</span></div>`;
  const titulo = (txt) =>
    `<div style="font-size:0.62rem;color:#003366;text-transform:uppercase;letter-spacing:1px;font-weight:700;margin:0.8rem 0 0.35rem">${txt}</div>`;
  const cuentas = cuentasDe(t);
  return `<div class="modal-bg" onclick="if(event.target.classList.contains('modal-bg'))cerrarModal()">
    <div class="modal">
      <div class="modal-header"><div><h3>👷 ${escHtml(t.nombre)}</h3><p>${escHtml(t.cargo) || "Sin cargo"} · ${ETIQ_TIPO_PAGO[tipoPagoTrabajador(t)]} · ${t.frecuencia === "mensual" ? "pago mensual" : "pago quincenal"}${t.activo === false ? " · retirado" : ""}</p></div><button class="modal-close-x" onclick="cerrarModal()">✕</button></div>
      <div class="modal-body">
        ${titulo("👤 Datos")}
        ${fila("Cédula", escHtml(t.cedula || "N/A"), "#333")}
        ${t.rif ? fila("RIF", escHtml(t.rif), "#333") : ""}
        ${t.telefono ? fila("Teléfono", escHtml(t.telefono), "#333") : ""}
        ${t.fechaIngreso ? fila("Ingreso", escHtml(textoAntiguedad(t)), "#333") : ""}
        ${(t.titulos || []).length ? fila("🎓 Títulos", (t.titulos || []).map(escHtml).join("<br/>"), "#333") : ""}
        ${titulo("💰 Lo que gana al mes")}
        ${t.salario ? fila("Salario base", fmt(t.salario), "#003366") : ""}
        ${t.bonoAlimentacion ? fila("Bono alimentación", fmt(t.bonoAlimentacion), "#1a9e5c") : ""}
        ${t.bonoProductividad ? fila("Bono productividad", fmt(t.bonoProductividad), "#b8860b") : ""}
        ${horasDe(t)
          .map((h) =>
            fila(
              "⏱️ " + escHtml(conceptoHoras(h.nivel)) + " · " + escHtml(detalleHoras(h.horas, h.tarifa)),
              fmt(r2(h.horas * h.tarifa)),
              "#003366"
            )
          )
          .join("")}
        ${t.descuento ? fila(escHtml(t.descuentoConcepto || "Deducción fija"), "- " + fmt(t.descuento), "#e53e3e") : ""}
        <div style="display:flex;justify-content:space-between;padding:0.75rem 1rem;background:linear-gradient(135deg,#003366,#00509e);border-radius:10px;color:#fff;margin-top:0.4rem">
          <span style="color:#ffd700;font-weight:700">NETO MENSUAL${horasDe(t).length ? " (aprox.)" : ""}</span>
          <span style="font-size:1.2rem;font-weight:800;font-family:Georgia,serif">${fmt(netoMensual(t))}</span>
        </div>
        ${t.frecuencia !== "mensual" ? `<div style="font-size:0.72rem;color:#666;margin-top:0.3rem;text-align:center">Por quincena: ${fmt(r2(netoMensual(t) / 2))}${horasDe(t).length ? " · las horas se pagan según lo trabajado" : ""}</div>` : ""}
        ${titulo("📚 Clases que da")}
        ${
          clasesDe(t).length
            ? clasesDe(t)
                .map((c) =>
                  fila(
                    "📚 " + escHtml(materiaDe(c)) + " · " + escHtml(textoGrados(c.grados)),
                    escHtml(textoHorario(c)) || "—",
                    "#333"
                  )
                )
                .join("") +
              (minutosSemana(t)
                ? `<div style="font-size:0.72rem;color:#666;text-align:center">Según el horario: ${textoMinutos(minutosSemana(t))} de clase a la semana</div>`
                : "")
            : `<div style="font-size:0.78rem;color:#888">Sin clases registradas</div>`
        }
        ${titulo("🏦 Cuentas para pagarle")}
        ${cuentas.length ? cuentas.map((c, i) => fila((i === 0 ? "Principal: " : "") + escHtml(c.banco || "Banco") + " · " + escHtml(c.tipo), escHtml(c.tipo === "Pago móvil" ? c.numero : c.numero.replace(/(\d{4})(\d{4})(\d{2})(\d{10})/, "$1-$2-$3-$4")) + (c.titular ? `<br/><span style="font-weight:400;font-size:0.72rem">${escHtml(c.titular)}${c.cedulaTitular ? " · " + escHtml(c.cedulaTitular) : ""}</span>` : ""), "#333")).join("") : `<div style="font-size:0.78rem;color:#888">Sin cuentas registradas</div>`}
        ${titulo("📎 Documentos")}
        ${htmlDocumentosTrabajador(t)}
        ${titulo("💸 Adelantos por descontar")}
        ${adelantos.length ? adelantos.map((a) => fila("Del " + fechaCorta(a.fecha) + (a.periodo ? " · a cuenta de " + nombrePeriodo(a.periodo) : ""), fmt(a.pendiente), "#b8860b")).join("") : `<div style="font-size:0.78rem;color:#888">Ninguno</div>`}
        ${titulo("🤝 Préstamos")}
        ${prestamos.length ? prestamos.map((p) => fila("Del " + fechaCorta(p.fecha) + ": " + fmt(p.monto) + " · cuota " + fmt(p.cuota) + " · pagado " + fmt(p.pagado), p.saldo > 0 ? "Debe " + fmt(p.saldo) : "✓ Pagado", p.saldo > 0 ? "#e53e3e" : "#1a9e5c")).join("") : `<div style="font-size:0.78rem;color:#888">Ninguno</div>`}
        ${titulo("📋 Últimos pagos")}
        ${pagos.length ? pagos.map((f) => fila(escHtml(nombrePeriodo(periodoDePago(f)) || f.descripcion || "") + " · " + fechaCorta(f.fecha), fmt(f.monto), "#003366")).join("") : `<div style="font-size:0.78rem;color:#888">Sin pagos</div>`}
        ${t.observacion ? `<div style="margin-top:0.65rem;padding:0.6rem 0.75rem;background:#f8faff;border-radius:8px;font-size:0.8rem;color:#555">📝 ${escHtml(t.observacion)}</div>` : ""}
      </div>
      <div class="modal-actions" style="flex-wrap:wrap">
        ${
          t.activo !== false
            ? `<button class="btn btn-primary" style="flex:1" onclick="abrirModal({tipo:'pago-nomina',trabId:'${t.id}'})">💳 Pagar</button>
        <button class="btn btn-gray btn-sm" onclick="abrirModal({tipo:'adelanto-nomina',trabId:'${t.id}'})">💸 Adelanto</button>
        <button class="btn btn-gray btn-sm" onclick="abrirModal({tipo:'prestamo-nomina',trabId:'${t.id}'})">🤝 Préstamo</button>`
            : ""
        }
        <button class="btn btn-print btn-sm" title="Recibo de lo que le toca" onclick="imprimirReciboNomina('${t.id}',null)">🖨️</button>
        <button class="btn btn-print btn-sm" onclick="imprimirFichaTrabajador('${t.id}')">📄 Ficha</button>
        <button class="btn btn-print btn-sm" onclick="abrirModal({tipo:'constancia-trabajo',id:'${t.id}'})">📜 Constancia</button>
        <button class="btn btn-primary btn-sm" onclick="editarTrabajador('${t.id}')">✏️</button>
        ${rolUsuario === "director" ? `<button class="btn btn-danger btn-sm" onclick="eliminarTrabajador('${t.id}')">🗑️</button>` : ""}
        <button class="btn btn-gray" onclick="cerrarModal()">Cerrar</button>
      </div>
    </div>
  </div>`;
}
// Ficha del trabajador para imprimir o archivar: datos, títulos, sueldo, cuentas y documentos que tiene
function imprimirFichaTrabajador(trabId) {
  const t = trabajadores.find((x) => x.id === trabId);
  if (!t) return;
  const w = abrirVentanaImpresion("width=680,height=900");
  if (!w) return alert("Permite las ventanas emergentes para imprimir");
  const fila = (l, v) => (v ? `<tr><th>${l}</th><td>${v}</td></tr>` : "");
  const cuentas = cuentasDe(t);
  const adj = Array.isArray(t.adjuntos) ? t.adjuntos : [];
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>Ficha - ${escHtml(t.nombre)}</title>
  <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Segoe UI',Arial,sans-serif;color:#222;background:#fff;max-width:680px;margin:0 auto;padding:1rem 1.4rem}
  .hdr{display:flex;align-items:center;gap:0.9rem;padding-bottom:0.6rem;border-bottom:2px solid #003366;margin-bottom:0.8rem}.hdr img{width:50px;height:50px;object-fit:contain}
  h2{font-size:0.72rem;text-transform:uppercase;letter-spacing:1px;color:#003366;margin:0.9rem 0 0.3rem}
  table{width:100%;border-collapse:collapse;font-size:0.82rem}th,td{text-align:left;padding:0.3rem 0.4rem;border-bottom:1px dashed #ccc;vertical-align:top}th{width:36%;color:#555;font-weight:600}
  .firmas{display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-top:2.2rem}.fbox{text-align:center}.fline{border-top:1px solid #444;margin:2rem 0 5px}.flabel{font-size:0.7rem;color:#555}
  @media print{.no-print{display:none}}</style></head><body>
  <div class="hdr"><img src="data:image/png;base64,${LOGO}" alt="Logo"/><div>
    <div style="font-size:0.58rem;letter-spacing:2px;color:#003366;font-weight:700;text-transform:uppercase">Ficha del trabajador</div>
    <div style="font-size:0.95rem;font-family:Georgia,serif;color:#003366">${EMPRESA}</div><div style="font-size:0.65rem;color:#555">${EMPRESA_SUB}</div></div></div>
  <h2>👤 Datos personales</h2><table>
    ${fila("Nombre completo", `<strong>${escHtml(t.nombre)}</strong>`)}
    ${fila("Cédula", escHtml(t.cedula))}${fila("RIF", escHtml(t.rif))}${fila("Teléfono", escHtml(t.telefono))}
    ${fila("Cargo o funciones", escHtml(t.cargo))}${fila("Ingreso", escHtml(textoAntiguedad(t)))}
    ${fila("Títulos", (t.titulos || []).map(escHtml).join("<br/>"))}
    ${fila("Situación", t.activo === false ? "Retirado" : "Activo")}</table>
  <h2>💰 Sueldo</h2><table>
    ${fila("Forma de pago", ETIQ_TIPO_PAGO[tipoPagoTrabajador(t)] + " · " + (t.frecuencia === "mensual" ? "mensual" : "por quincenas"))}
    ${t.salario ? fila("Salario base mensual", fmt(t.salario)) : ""}
    ${t.bonoAlimentacion ? fila("Bono alimentación", fmt(t.bonoAlimentacion)) : ""}
    ${t.bonoProductividad ? fila("Bono productividad", fmt(t.bonoProductividad)) : ""}
    ${horasDe(t)
      .map((h) =>
        fila(
          escHtml(conceptoHoras(h.nivel)),
          escHtml(detalleHoras(h.horas, h.tarifa)) + " al mes = " + fmt(r2(h.horas * h.tarifa))
        )
      )
      .join("")}
    ${t.descuento ? fila(escHtml(t.descuentoConcepto || "Deducción fija"), "- " + fmt(t.descuento)) : ""}
    ${fila("Neto mensual" + (horasDe(t).length ? " (aprox.)" : ""), `<strong>${fmt(netoMensual(t))}</strong>`)}</table>
  ${
    clasesDe(t).length
      ? `<h2>📚 Clases que da</h2><table>${clasesDe(t)
          .map((c) =>
            fila(
              escHtml(materiaDe(c)),
              escHtml(textoGrados(c.grados)) + (textoHorario(c) ? "<br/>" + escHtml(textoHorario(c)) : "")
            )
          )
          .join("")}</table>`
      : ""
  }
  <h2>🏦 Cuentas para el pago</h2><table>
    ${cuentas.length ? cuentas.map((c, i) => fila("Cuenta " + (i + 1) + (i === 0 ? " (principal)" : ""), escHtml([c.banco, c.tipo, c.numero].filter(Boolean).join(" · ")) + (c.titular ? "<br/>Titular: " + escHtml(c.titular) + (c.cedulaTitular ? " · " + escHtml(c.cedulaTitular) : "") : ""))).join("") : fila("Cuentas", "Sin cuentas registradas")}</table>
  <h2>📎 Documentos en el archivo digital</h2><table>
    ${adj.length ? adj.map((a) => fila(escHtml(CLASES_DOCUMENTO[a.clase] || "Documento"), "Adjuntado el " + escHtml(fechaCorta(a.fecha)) + (a.vence ? " · vence el " + escHtml(fechaCorta(a.vence)) : ""))).join("") : fila("Documentos", "Ninguno")}</table>
  ${t.observacion ? `<h2>📝 Observación</h2><p style="font-size:0.82rem">${escHtml(t.observacion)}</p>` : ""}
  <div class="firmas"><div class="fbox"><div class="fline"></div><div class="flabel">Director(a)</div></div><div class="fbox"><div class="fline"></div><div class="flabel">Trabajador(a)</div></div></div>
  <p style="text-align:center;font-size:0.62rem;color:#999;margin-top:1rem">Impresa el ${escHtml(fechaCorta(todayStr()))}</p>
  <div class="no-print" style="text-align:center;padding:0.75rem"><button onclick="window.print()" style="background:#003366;color:#fff;border:none;padding:0.65rem 1.5rem;border-radius:8px;font-weight:700">🖨️ Imprimir / Guardar PDF</button></div>
  </body></html>`);
  w.document.close();
}
