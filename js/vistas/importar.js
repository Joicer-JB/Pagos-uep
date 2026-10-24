// Pestaña Importar: carga de la matrícula desde Excel (detecta encabezados, valida y evita duplicados).

// Se monta por grado: se elige el grado (o año) y se sube el Excel con la lista de ese grado. También sirve un Excel con
// varios grados (columna «Grado» o una hoja por grado). Los encabezados se leen por nombre, así que el orden de las
// columnas no importa. Nada se sube hasta revisar la vista previa.
// Cada fila se compara con los estudiantes que ya están en la plataforma (por nombre, sin importar el orden de las
// palabras, o por cédula escolar): los nuevos se crean; a los que ya están se les reactiva si estaban retirados, se les
// corrige el grado y el sexo, y se les completa lo que les falte. Los inscritos del grado que no están en el Excel se
// listan aparte y solo se marcan como retirados si se pide.
const nivelDeGrado = (g) => {
  const i = ESCALERA.indexOf(g);
  return i < 4 ? "inicial" : i < 10 ? "primaria" : "media";
};
const MENS_DEF = { inicial: 45, primaria: 45, media: 55 };
const PLANTILLA_COLS = [
  "Cédula escolar",
  "Nombres y apellidos",
  "Sexo",
  "Fecha de nacimiento",
  "Representante",
  "Cédula del representante",
  "Teléfono",
  "Observaciones médicas",
];
let importPreview = [],
  importFilas = [],
  importFuera = [],
  importSoloAvisos = false,
  importRaw = null;
// Qué columna es cuál, según el texto del encabezado
function mapaEncabezados(fila) {
  const m = {};
  (fila || []).forEach((h, i) => {
    const s = sinAcento(h).toLowerCase().replace(/\s+/g, " ").trim();
    let k = null;
    if (!s) k = null;
    else if (/revisar/.test(s)) k = "_";
    else if (/ced.*rep|rep.*ced/.test(s)) k = "cedRep";
    else if (/ced/.test(s)) k = "cedula";
    else if (/^(grado|nivel|ano|anio|grupo)\b/.test(s) && !/escolar/.test(s)) k = "grado";
    else if (/^secc/.test(s)) k = "seccion";
    else if (/repres|acudiente/.test(s)) k = "rep";
    else if (/nombre/.test(s)) k = "nombre";
    else if (/apellido/.test(s)) k = "apellidos";
    else if (/^(sexo|genero)/.test(s)) k = "sexo";
    else if (/fecha|^f\.?\s*nac/.test(s)) k = "fechaNac";
    else if (/tel|cel/.test(s)) k = "tel";
    else if (/medic|enferm|padece|salud/.test(s)) k = "enf";
    if (k && !(k in m)) m[k] = i;
  });
  return m;
}
// Sexo escrito de cualquier forma: F/H/Femenino/Hembra/Niña → "F"; M/V/Masculino/Varón/Niño → "M"; si no, ""
function sexoDe(v) {
  const s = sinAcento(v).toUpperCase().trim();
  if (/^(MUJER|F|H|HEMBRA|NINA)/.test(s)) return "F";
  if (/^(M|V|VARON|NINO|HOMBRE)/.test(s)) return "M";
  return "";
}
// Grado de un texto como el nombre de una hoja o un título: «1er Año», «1ER AÑO A», «Sección B 3er Grado»…
function gradoDeTexto(t) {
  const s = String(t == null ? "" : t).trim();
  return (
    gradoCanon(s) ||
    gradoCanon(s.replace(/\s*(secc?i?o?n?\.?\s*)?["'«]?[a-e]["'»]?\s*$/i, "")) ||
    gradoCanon(s.replace(/^.*?(matr[ií]cula|grado:|a[ñn]o:)\s*/i, ""))
  );
}
// Texto de una celda: las fechas reales de Excel pasan a aaaa-mm-dd; los números (cédulas) a texto
function textoCelda(v) {
  if (v == null) return "";
  if (v instanceof Date) {
    if (isNaN(v)) return "";
    const d = new Date(v.getTime() + 12 * 3600 * 1000); // +12 h: evita saltar de día por zona horaria
    return (
      d.getUTCFullYear() +
      "-" +
      String(d.getUTCMonth() + 1).padStart(2, "0") +
      "-" +
      String(d.getUTCDate()).padStart(2, "0")
    );
  }
  return String(v).replace(/\s+/g, " ").trim();
}
// dd/mm/aaaa o aaaa-mm-dd → aaaa-mm-dd. Si es imposible (31/02, año de 2 cifras, etc.) devuelve "" y un aviso.
function fechaNacISO(s) {
  s = String(s || "").trim();
  if (!s) return { iso: "", aviso: "Sin fecha de nacimiento" };
  let d, mo, y, m;
  if ((m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/))) {
    d = +m[1];
    mo = +m[2];
    y = +m[3];
  } else if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})/))) {
    y = +m[1];
    mo = +m[2];
    d = +m[3];
  } else return { iso: "", aviso: "Fecha de nacimiento no válida («" + s + "»)" };
  const dt = new Date(Date.UTC(y, mo - 1, d));
  const ok =
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === mo - 1 &&
    dt.getUTCDate() === d &&
    y >= 1990 &&
    y <= new Date().getFullYear();
  return ok
    ? { iso: y + "-" + String(mo).padStart(2, "0") + "-" + String(d).padStart(2, "0"), aviso: "" }
    : { iso: "", aviso: "Fecha de nacimiento no válida («" + s + "»)" };
}
// Teléfono → 0412XXXXXXX. Un número de 7 a 9 cifras casi seguro es una cédula escrita en la columna equivocada.
function limpiarTelImport(raw) {
  const d = String(raw || "").replace(/\D/g, "");
  if (!d) return { tel: "", ced: "", aviso: "Sin teléfono" };
  if (d.length >= 7 && d.length <= 9)
    return { tel: "", ced: d, aviso: "El «teléfono» parece una cédula; se guardó como cédula del representante" };
  const wa = normalizarTelVE(raw);
  if (!wa) return { tel: "", ced: "", aviso: "Teléfono no válido («" + raw + "»)" };
  return { tel: "0" + wa.slice(2), ced: "", aviso: "" };
}
// El mismo estudiante en la plataforma: por nombre (sin importar el orden de las palabras) o, si no, por cédula escolar
// con al menos dos palabras del nombre en común. Entre varios con el mismo nombre, el inscrito y del mismo grado.
function buscadorExistentes(existentes) {
  const porNombre = new Map(),
    porCed = new Map();
  const agregar = (m, k, e) => m.set(k, [...(m.get(k) || []), e]);
  (existentes || []).forEach((e) => {
    if (e.nombre) agregar(porNombre, claveNombreSinOrden(e.nombre), e);
    if (e.cedula) agregar(porCed, String(e.cedula).trim(), e);
  });
  const mejor = (lista, grado) =>
    [...lista].sort(
      (a, b) => (activo(b) ? 2 : 0) + (b.grado === grado) - ((activo(a) ? 2 : 0) + (a.grado === grado))
    )[0];
  return (nombre, cedula, grado) => {
    const ck = claveNombreSinOrden(nombre);
    const n = porNombre.get(ck);
    if (n) return mejor(n, grado);
    const c = cedula && porCed.get(cedula);
    if (c && c.length === 1) {
      const pal = new Set(ck.split(" "));
      if (
        claveNombreSinOrden(c[0].nombre)
          .split(" ")
          .filter((p) => pal.has(p)).length >= 2
      )
        return c[0];
    }
    return null;
  };
}
// Lo que hay que cambiarle a un estudiante que ya está, según la fila del Excel: {cambios, resumen}
function cambiosMatricula(ex, d, anio) {
  const c = {},
    resumen = [];
  if (ex.estado === "retirado") {
    c.estado = "alsaldo";
    resumen.push("Se reactiva (estaba retirado)");
  }
  if (ex.graduado) {
    c.graduado = false;
    resumen.push("Se reactiva (estaba como graduado)");
  }
  if (ex.grado !== d.grado) {
    c.grado = d.grado;
    resumen.push("Grado: " + (ex.grado || "sin grado") + " → " + d.grado);
  }
  if (d.sexo && ex.sexo !== d.sexo) {
    c.sexo = d.sexo;
    resumen.push("Sexo: " + (ex.sexo || "—") + " → " + d.sexo);
  }
  if (anio && ex.anioEscolar !== anio) {
    c.anioEscolar = anio;
    resumen.push("Año escolar: " + anio);
  }
  const completar = [
    ["cedula", "cédula"],
    ["fechaNac", "fecha de nacimiento"],
    ["seccion", "sección"],
    ["acudiente", "representante"],
    ["cedulaAcudiente", "cédula del representante"],
    ["telefonoAcudiente", "teléfono"],
    ["observacionesMedicas", "observaciones médicas"],
  ].filter(([k]) => d[k] && !ex[k]);
  completar.forEach(([k]) => (c[k] = d[k]));
  if (c.telefonoAcudiente && !ex.telefono) c.telefono = d.telefono;
  if (completar.length) resumen.push("Se completa: " + completar.map(([, t]) => t).join(", "));
  return { cambios: c, resumen };
}
// Función pura (sin pantalla ni Firebase): convierte filas del Excel en lo que se va a hacer con cada una.
// filas: [{n:fila en Excel, r:[celdas], hoja, mapa, gradoHoja}]  op: {anio, jornada, mens, grado}  existentes: estudiantes
// op.grado = el grado que se está montando (las filas de otros grados se ignoran); sin op.grado, el de cada fila.
// Cada fila queda con estado: "nuevo", "actualizar" (ya está, con cambios), "igual" (ya está tal cual), "duplicado"
// (repetida en el archivo), "otro-grado" (se ignora) o "error".
function construirImportacion(filas, mapa, op, existentes) {
  const buscar = buscadorExistentes(existentes);
  const vistoNom = new Map(),
    vistoCed = new Map(),
    vistoId = new Map();
  const out = [];
  filas.forEach((fila) => {
    const { n, r } = fila;
    const mp = fila.mapa || mapa;
    const g = (k) => (mp[k] == null ? "" : textoCelda(r[mp[k]]));
    const nombre = [g("nombre"), g("apellidos")].filter(Boolean).join(" ");
    const gradoRaw = g("grado") || fila.gradoHoja || "",
      cedula = g("cedula");
    if (!nombre && !g("grado") && !cedula) return; // fila vacía o de títulos
    if (!nombre && !cedula) return; // fila de totales o notas al pie
    if (/^(sub)?total(es)?\b|^(hembras|varones|ninas|ninos)\b/i.test(sinAcento(nombre))) return;
    const it = { n, hoja: fila.hoja || "", estado: "nuevo", avisos: [], errores: [], datos: null };
    const gradoFila = gradoDeTexto(gradoRaw);
    if (op.grado && gradoRaw && gradoFila && gradoFila !== op.grado) {
      it.estado = "otro-grado";
      it.avisos.push("Es de " + gradoFila + ": se ignora");
      it.datos = { nombre, grado: gradoFila };
      out.push(it);
      return;
    }
    const grado = op.grado || gradoFila;
    if (!nombre) it.errores.push("Falta el nombre");
    if (!grado) it.errores.push(gradoRaw ? "Grado no reconocido («" + gradoRaw + "»)" : "Falta el grado");
    const f = fechaNacISO(g("fechaNac"));
    const t = limpiarTelImport(g("tel"));
    let cedRep = g("cedRep").replace(/[^0-9A-Za-z]/g, "");
    if (!cedRep && t.ced) cedRep = t.ced;
    const sexo = sexoDe(g("sexo"));
    const enfRaw = g("enf");
    const enf = /^(no|n\/a|ninguna?|-|—)?\.?$/i.test(sinAcento(enfRaw).trim()) ? "" : enfRaw;
    if (it.errores.length) {
      it.estado = "error";
      it.datos = { nombre, grado };
      out.push(it);
      return;
    }
    const ck = claveNombreSinOrden(nombre);
    if (vistoNom.has(ck)) {
      it.estado = "duplicado";
      it.avisos = ["Repetido en el archivo (fila " + vistoNom.get(ck) + ")"];
      it.datos = { nombre, grado };
      out.push(it);
      return;
    }
    vistoNom.set(ck, n);
    const datos = {
      nombre,
      cedula,
      fechaNac: f.iso,
      grado,
      seccion: g("seccion"),
      jornada: op.jornada || "Mañana",
      sexo,
      telefono: t.tel,
      acudiente: g("rep"),
      telefonoAcudiente: t.tel,
      cedulaAcudiente: cedRep,
      observacionesMedicas: enf,
      mensualidad: Number((op.mens || {})[nivelDeGrado(grado)]) || 0,
      anioEscolar: op.anio,
      estado: "alsaldo",
      moraConcepto: "",
      moraMonto: 0,
    };
    const ex = buscar(nombre, cedula, grado);
    if (ex && vistoId.has(ex.id)) {
      it.estado = "duplicado";
      it.avisos = ["Es el mismo estudiante de la fila " + vistoId.get(ex.id)];
      it.datos = { nombre, grado };
      out.push(it);
      return;
    }
    if (ex) {
      vistoId.set(ex.id, n);
      const { cambios, resumen } = cambiosMatricula(ex, datos, op.anio);
      it.id = ex.id;
      it.cambios = cambios;
      it.estado = Object.keys(cambios).length ? "actualizar" : "igual";
      it.avisos = resumen;
      if (!ex.sexo && !sexo) it.avisos.push("Sin sexo");
      it.datos = { ...ex, ...cambios };
    } else {
      if (!cedula) it.avisos.push("Sin cédula escolar");
      if (f.aviso) it.avisos.push(f.aviso);
      if (t.aviso) it.avisos.push(t.aviso);
      if (!datos.acudiente) it.avisos.push("Sin representante");
      if (!sexo) it.avisos.push("Sin sexo");
      const otro = cedula && vistoCed.get(cedula);
      if (otro) it.avisos.push("Misma cédula escolar que «" + otro + "»");
      it.datos = datos;
    }
    if (cedula && !vistoCed.has(cedula)) vistoCed.set(cedula, nombre);
    out.push(it);
  });
  return out;
}
// Inscritos de los grados del archivo que no aparecen en él (se pueden marcar como retirados)
function fueraDeMatricula(filasOut, existentes) {
  const grados = new Set(
    filasOut.filter((x) => ["nuevo", "actualizar", "igual"].includes(x.estado)).map((x) => x.datos.grado)
  );
  const vistos = new Set(filasOut.filter((x) => x.id).map((x) => x.id));
  return (existentes || [])
    .filter((e) => activo(e) && grados.has(e.grado) && !vistos.has(e.id))
    .sort((a, b) => ordenGrados(a.grado, b.grado) || ordenNombre(a, b));
}
// Cuántos inscritos tendrá cada grado del archivo después de subirlo: {grado: {total, F, M}}
function inscritosDespues(filasOut, fuera, retirar) {
  const r = {};
  const contar = (e) => {
    const x = (r[e.grado] = r[e.grado] || { total: 0, F: 0, M: 0 });
    x.total++;
    if (e.sexo === "F" || e.sexo === "M") x[e.sexo]++;
  };
  filasOut.filter((x) => ["nuevo", "actualizar", "igual"].includes(x.estado)).forEach((x) => contar(x.datos));
  if (!retirar) fuera.forEach(contar);
  return r;
}
// Busca en cada hoja la fila de encabezados (no importa si hay títulos arriba). Si la hoja no tiene columna «Grado»,
// el grado sale del nombre de la hoja o de un título encima de los encabezados.
function localizarTabla(wb) {
  const filas = [];
  let mapa = null;
  for (const sn of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, raw: true, defval: "", cellDates: true });
    for (let i = 0; i < Math.min(rows.length, 40); i++) {
      const m = mapaEncabezados(rows[i].map(textoCelda));
      if (!("nombre" in m) && !("apellidos" in m)) continue;
      let gradoHoja = gradoDeTexto(sn);
      for (let j = 0; j < i && !gradoHoja; j++)
        gradoHoja = rows[j].map(textoCelda).map(gradoDeTexto).find(Boolean) || "";
      mapa = mapa || m;
      rows.slice(i + 1).forEach((r, j) => filas.push({ n: i + j + 2, r, hoja: sn, mapa: m, gradoHoja }));
      break;
    }
  }
  return mapa ? { mapa, filas, hojas: new Set(filas.map((f) => f.hoja)).size } : null;
}
let importGrado = "",
  importRetirar = false;
function renderImportar() {
  const anio = escCfg ? escCfg.actual.nombre : "2026-2027";
  return `
  <div class="card">
    <div class="card-title"><div class="card-bar"></div><h2>📥 Montar la matrícula desde Excel</h2></div>
    <div style="background:#e8f0fe;border-radius:10px;padding:0.85rem;margin-bottom:0.85rem;font-size:0.8rem;color:#003366">
      <strong>📋 Cómo funciona:</strong> elige el grado o año y sube el Excel con la lista de ese grado, una fila por estudiante. Se lee por el nombre de las columnas (el orden no importa; los nombres y apellidos pueden venir juntos o en dos columnas):<br/>
      <code style="background:#fff;padding:2px 6px;border-radius:4px;font-size:0.72rem;display:inline-block;margin-top:4px">${PLANTILLA_COLS.join(" · ")}</code><br/>
      <span style="font-size:0.72rem;color:#555;display:block;margin-top:4px">Antes de subir verás qué pasa con cada uno: los nuevos se crean; a los que ya están se les reactiva si estaban retirados, se les corrige el grado y el sexo y se les completa lo que falte. Los del grado que no estén en tu lista se te muestran aparte.</span>
      <button class="btn btn-gray btn-sm" style="margin-top:0.5rem" onclick="descargarPlantillaMatricula()">⬇️ Descargar plantilla</button>
    </div>
    <div class="form-grid">
      <div class="field"><label class="field-label">Grado o año que vas a montar *</label>
        <select class="inp" id="imp-grado" onchange="importGrado=this.value;dibujarImportacion()">
          <option value="">— Elige el grado o año —</option>
          ${ESCALERA.map((g) => `<option value="${escHtml(g)}" ${importGrado === g ? "selected" : ""}>${escHtml(g)}</option>`).join("")}
          <option value="todos" ${importGrado === "todos" ? "selected" : ""}>📚 Varios grados (el Excel trae la columna «Grado» o una hoja por grado)</option>
        </select></div>
      <div class="form-row">
        <div class="field"><label class="field-label">Año escolar *</label><input class="inp" id="imp-anio" value="${escHtml(anio)}" onchange="dibujarImportacion()"/></div>
        <div class="field"><label class="field-label">Jornada (para los nuevos)</label>
          <select class="inp" id="imp-jornada" onchange="dibujarImportacion()"><option value="Mañana">Mañana</option><option value="Tarde">Tarde</option><option value="Completa">Completa</option></select></div>
      </div>
      <div class="form-row">
        <div class="field"><label class="field-label">Mensualidad Inicial ($)</label><input class="inp" id="imp-m-inicial" type="number" min="0" step="0.01" value="${MENS_DEF.inicial}" onchange="dibujarImportacion()"/></div>
        <div class="field"><label class="field-label">Mensualidad Primaria ($)</label><input class="inp" id="imp-m-primaria" type="number" min="0" step="0.01" value="${MENS_DEF.primaria}" onchange="dibujarImportacion()"/></div>
        <div class="field"><label class="field-label">Mensualidad Media General ($)</label><input class="inp" id="imp-m-media" type="number" min="0" step="0.01" value="${MENS_DEF.media}" onchange="dibujarImportacion()"/></div>
      </div>
      <div class="ayuda" style="margin-top:-0.3rem">La mensualidad solo se usa para los estudiantes nuevos; a los que ya están no se les cambia.</div>
      <div class="field">
        <label class="field-label">📂 Archivo Excel (.xlsx)</label>
        <input type="file" accept=".xlsx,.xls" id="imp-file" class="inp" style="padding:0.6rem" onchange="previsualizarExcel(this)"/>
      </div>
    </div>
    <div id="imp-preview"></div>
  </div>`;
}
function descargarPlantillaMatricula() {
  const grado = importGrado && importGrado !== "todos" ? importGrado : "";
  const cols = grado ? PLANTILLA_COLS : ["Grado", ...PLANTILLA_COLS];
  const ejemplo = [
    "12345678901",
    "Nombre Apellido",
    "F",
    "25/03/2019",
    "Nombre del representante",
    "12345678",
    "04121234567",
    "",
  ];
  const ws = XLSX.utils.aoa_to_sheet([cols, grado ? ejemplo : ["1er Grado", ...ejemplo]]);
  ws["!cols"] = (grado ? [] : [11]).concat([16, 36, 6, 16, 28, 18, 14, 34]).map((w) => ({ wch: w }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, grado || "Estudiantes");
  XLSX.writeFile(wb, "matricula_" + (grado || "todos").replace(/\s+/g, "_") + ".xlsx");
}
function previsualizarExcel(input) {
  const file = input.files[0];
  const box = document.getElementById("imp-preview");
  if (!file) return;
  const reader = new FileReader();
  reader.onerror = () => {
    mostrarError(box, "No se pudo leer el archivo");
  };
  reader.onload = (e) => {
    try {
      const wb = XLSX.read(new Uint8Array(e.target.result), { type: "array", cellDates: true });
      const t = localizarTabla(wb);
      if (!t) {
        mostrarError(
          box,
          "No encontré la columna de los nombres («Nombres y apellidos», o «Apellidos» y «Nombres»). Descarga la plantilla y usa esos encabezados."
        );
        importRaw = null;
        importPreview = [];
        return;
      }
      importRaw = t;
      importRetirar = false;
      dibujarImportacion();
    } catch (err) {
      mostrarError(box, `Error leyendo el archivo: ${err.message}`);
    }
  };
  reader.readAsArrayBuffer(file);
}
function leerOpImportacion() {
  const v = (id) => {
    const el = document.getElementById(id);
    return el ? el.value : "";
  };
  const grado = v("imp-grado");
  return {
    anio: v("imp-anio").trim(),
    jornada: v("imp-jornada") || "Mañana",
    grado: grado === "todos" ? "" : grado,
    elegido: !!grado,
    mens: {
      inicial: parseFloat(v("imp-m-inicial")) || 0,
      primaria: parseFloat(v("imp-m-primaria")) || 0,
      media: parseFloat(v("imp-m-media")) || 0,
    },
  };
}
function dibujarImportacion() {
  const box = document.getElementById("imp-preview");
  if (!box || !importRaw) return;
  const op = leerOpImportacion();
  if (!op.elegido) {
    importFilas = [];
    importPreview = [];
    box.innerHTML = `<div class="card" style="margin-top:0.75rem;color:#b7791f;font-size:0.85rem">☝️ Elige arriba el grado o año de esta lista.</div>`;
    return;
  }
  importFilas = construirImportacion(importRaw.filas, importRaw.mapa, op, estudiantes);
  importFuera = fueraDeMatricula(importFilas, estudiantes);
  importPreview = importFilas.filter((x) => x.estado === "nuevo").map((x) => x.datos);
  const cuenta = (e) => importFilas.filter((x) => x.estado === e).length;
  const nNuevo = importPreview.length,
    nAct = cuenta("actualizar"),
    nIgual = cuenta("igual"),
    nDup = cuenta("duplicado"),
    nOtro = cuenta("otro-grado"),
    nErr = cuenta("error"),
    nRet = importRetirar ? importFuera.length : 0;
  const despues = inscritosDespues(importFilas, importFuera, importRetirar);
  const gradosArch = Object.keys(despues).sort(ordenGrados);
  const actuales = (g) => estudiantes.filter((e) => activo(e) && e.grado === g).length;
  const lista = importFilas.filter(
    (x) => !importSoloAvisos || !["nuevo", "igual"].includes(x.estado) || x.avisos.length
  );
  const badge = {
    nuevo: '<span style="color:#1a9e5c;font-weight:700">✅ Nuevo</span>',
    actualizar: '<span style="color:#2b6cb0;font-weight:700">🔄 Se actualiza</span>',
    igual: '<span style="color:#718096;font-weight:700">✔️ Ya está</span>',
    duplicado: '<span style="color:#b7791f;font-weight:700">⏭️ Repetido</span>',
    "otro-grado": '<span style="color:#718096;font-weight:700">⏭️ Otro grado</span>',
    error: '<span style="color:#e53e3e;font-weight:700">❌ Error</span>',
  };
  const chip = (t, c) =>
    `<span style="background:${c}1a;color:${c};font-weight:700;padding:0.3rem 0.7rem;border-radius:20px;font-size:0.78rem">${t}</span>`;
  const anioOk = !!op.anio;
  const hayAlgo = nNuevo + nAct + nRet > 0;
  const fila = (x) => (importRaw.hojas > 1 ? escHtml(x.hoja) + " · " : "") + x.n;
  box.innerHTML = `
  <div class="card" style="margin-top:0.75rem">
    <div style="display:flex;flex-wrap:wrap;gap:0.4rem;margin-bottom:0.6rem">
      ${chip(cuantas(nNuevo, "nuevo", "nuevos"), "#1a9e5c")}${chip(nAct + (nAct === 1 ? " se actualiza" : " se actualizan"), "#2b6cb0")}${chip(nIgual + (nIgual === 1 ? " ya está bien" : " ya están bien"), "#718096")}${nDup ? chip(cuantas(nDup, "repetido", "repetidos") + " en el archivo", "#b7791f") : ""}${nOtro ? chip(cuantas(nOtro, "de otro grado", "de otros grados") + " (se ignoran)", "#718096") : ""}${nErr ? chip(nErr + " con error", "#e53e3e") : ""}
    </div>
    <div class="matricula-despues" style="background:#f0f4ff;border-radius:10px;padding:0.6rem 0.8rem;margin-bottom:0.6rem;font-size:0.8rem;color:#003366">
      <strong>Así quedará:</strong>
      ${gradosArch.map((g) => `<div>${escHtml(g)}: <strong>${cuantas(despues[g].total, "inscrito", "inscritos")}</strong> (${cuantas(despues[g].F, "niña", "niñas")} · ${cuantas(despues[g].M, "niño", "niños")}${despues[g].total - despues[g].F - despues[g].M ? " · " + (despues[g].total - despues[g].F - despues[g].M) + " sin sexo" : ""}) <span style="color:#888">· hoy ${actuales(g)}</span></div>`).join("") || "<div>—</div>"}
    </div>
    ${
      importFuera.length
        ? `<div style="background:#fffbea;border:1px solid #f6e05e;border-radius:10px;padding:0.6rem 0.8rem;margin-bottom:0.6rem;font-size:0.78rem;color:#7a5b00">
      <strong>⚠️ ${importFuera.length === 1 ? "1 inscrito no está" : importFuera.length + " inscritos no están"} en tu lista:</strong> ${importFuera.map((e) => escHtml(e.nombre) + (gradosArch.length > 1 ? " (" + escHtml(e.grado) + ")" : "")).join(" · ")}
      <label style="display:flex;gap:0.4rem;align-items:center;margin-top:0.45rem;font-weight:700"><input type="checkbox" id="imp-retirar" ${importRetirar ? "checked" : ""} onchange="importRetirar=this.checked;dibujarImportacion()"/> Marcarlos como retirados</label>
      <div style="font-size:0.7rem;color:#888">Si no lo marcas, se quedan como están. Sus pagos no se tocan.</div>
    </div>`
        : ""
    }
    <label style="display:flex;gap:0.4rem;align-items:center;font-size:0.78rem;margin-bottom:0.5rem"><input type="checkbox" ${importSoloAvisos ? "checked" : ""} onchange="importSoloAvisos=this.checked;dibujarImportacion()"/> Mostrar solo lo que cambia o tiene avisos</label>
    <div style="overflow:auto;max-height:420px;margin-bottom:0.85rem">
      <table style="width:100%;border-collapse:collapse;font-size:0.72rem">
        <thead><tr style="background:#003366;color:#fff;position:sticky;top:0">
          <th style="padding:0.4rem;text-align:left">Fila</th><th style="padding:0.4rem;text-align:left">Qué pasa</th><th style="padding:0.4rem;text-align:left">Grado</th>
          <th style="padding:0.4rem;text-align:left">Nombre</th><th style="padding:0.4rem;text-align:left">Sexo</th><th style="padding:0.4rem;text-align:left">Detalle</th>
        </tr></thead>
        <tbody>${
          lista
            .map((x, i) => {
              const d = x.datos || {};
              const av = [...x.errores, ...x.avisos];
              return `<tr style="background:${x.estado === "error" ? "#fff5f5" : x.estado === "actualizar" ? "#ebf4ff" : av.length ? "#fffbea" : i % 2 ? "#fff" : "#f8faff"}">
          <td style="padding:0.3rem 0.4rem;color:#888;white-space:nowrap">${fila(x)}</td><td style="padding:0.3rem 0.4rem;white-space:nowrap">${badge[x.estado]}</td>
          <td style="padding:0.3rem 0.4rem;white-space:nowrap">${escHtml(d.grado || "")}</td><td style="padding:0.3rem 0.4rem;font-weight:600;color:#003366">${escHtml(d.nombre || "")}</td>
          <td style="padding:0.3rem 0.4rem">${escHtml(d.sexo || "—")}</td>
          <td style="padding:0.3rem 0.4rem;color:#7a5b00">${escHtml(av.join(" · "))}</td></tr>`;
            })
            .join("") ||
          '<tr><td colspan="6" style="padding:0.8rem;text-align:center;color:#888">Nada que mostrar</td></tr>'
        }</tbody>
      </table>
    </div>
    <div id="imp-progwrap" style="display:none;margin-bottom:0.75rem">
      <div style="background:#eef2f9;border-radius:20px;height:10px;overflow:hidden"><div id="imp-prog" style="height:10px;border-radius:20px;background:linear-gradient(90deg,#003366,#00509e);transition:width 0.3s;width:0%"></div></div>
      <div id="imp-progtext" style="font-size:0.72rem;color:#555;margin-top:4px;text-align:center"></div>
    </div>
    <div id="imp-log" style="display:none;background:#f8faff;border-radius:8px;padding:0.75rem;max-height:200px;overflow-y:auto;font-size:0.72rem;font-family:monospace;margin-bottom:0.75rem"></div>
    ${!anioOk ? '<div class="error-msg">Escribe el año escolar</div>' : ""}
    <button class="btn btn-success btn-full" id="imp-btn" onclick="ejecutarImportacion()" ${hayAlgo && anioOk ? "" : "disabled"}>${hayAlgo ? `✅ Guardar: ${[nNuevo && cuantas(nNuevo, "nuevo", "nuevos"), nAct && cuantas(nAct, "actualizado", "actualizados"), nRet && cuantas(nRet, "retirado", "retirados")].filter(Boolean).join(" · ")}` : "✔️ No hay nada que cambiar"}</button>
  </div>`;
}
// Lo que se va a escribir: crear los nuevos, actualizar los que cambian y (si se pidió) retirar a los que no están
function operacionesImportacion() {
  return [
    ...importFilas.filter((x) => x.estado === "nuevo").map((x) => ({ tipo: "nuevo", datos: x.datos })),
    ...importFilas.filter((x) => x.estado === "actualizar").map((x) => ({ tipo: "act", id: x.id, datos: x.cambios })),
    ...(importRetirar ? importFuera : []).map((e) => ({ tipo: "act", id: e.id, datos: { estado: "retirado" } })),
  ];
}
// Sube en lotes de 400 (una sola escritura por lote: rápido y todo-o-nada por lote)
async function ejecutarImportacion() {
  const ops = operacionesImportacion();
  if (!ops.length) return;
  if (soloLectura()) {
    alert("Estás viendo un año anterior (solo lectura). Cambia al año actual para importar.");
    return;
  }
  const op = leerOpImportacion();
  if (!op.anio) {
    alert("Escribe el año escolar");
    return;
  }
  const n = (t) => ops.filter((o) => o.tipo === t).length;
  const nRet = importRetirar ? importFuera.length : 0;
  const partes = [
    n("nuevo") && `crear ${cuantas(n("nuevo"), "estudiante nuevo", "estudiantes nuevos")}`,
    n("act") - nRet && `actualizar ${n("act") - nRet}`,
    nRet && `marcar ${nRet} como ${nRet === 1 ? "retirado" : "retirados"}`,
  ].filter(Boolean);
  if (!confirm(`Se va a ${partes.join(", ")} (año escolar ${op.anio}).\n¿Continuar?`)) return;
  const btn = document.getElementById("imp-btn"),
    prog = document.getElementById("imp-prog"),
    txt = document.getElementById("imp-progtext"),
    log = document.getElementById("imp-log");
  document.getElementById("imp-progwrap").style.display = "block";
  log.style.display = "block";
  btn.disabled = true;
  btn.textContent = "Guardando...";
  let ok = 0,
    fallo = 0;
  for (let i = 0; i < ops.length; i += 400) {
    const trozo = ops.slice(i, i + 400);
    try {
      const b = db.batch(),
        enMemoria = [];
      trozo.forEach((o) => {
        if (o.tipo === "nuevo") {
          const ref = db.collection("estudiantes").doc();
          b.set(ref, { ...o.datos, importado: true, creadoEn: firebase.firestore.FieldValue.serverTimestamp() });
          enMemoria.push({ ...o.datos, id: ref.id, importado: true });
        } else {
          b.update(db.collection("estudiantes").doc(o.id), o.datos);
          enMemoria.push({ id: o.id, ...o.datos });
        }
      });
      await b.commit();
      enMemoria.forEach((x) => ponerEnLista(estudiantes, x));
      ok += trozo.length;
      log.innerHTML += `<div style="color:#1a9e5c">✅ ${trozo.length} cambios guardados</div>`;
    } catch (ex) {
      fallo += trozo.length;
      log.innerHTML += `<div style="color:#e53e3e">❌ Un lote de ${trozo.length} no se guardó: ${escHtml(ex.message)}</div>`;
    }
    prog.style.width = Math.round((Math.min(i + 400, ops.length) / ops.length) * 100) + "%";
    txt.textContent = `${Math.min(i + 400, ops.length)} de ${ops.length}`;
  }
  importPreview = [];
  importFilas = [];
  importFuera = [];
  importRaw = null;
  importRetirar = false;
  btn.textContent = fallo
    ? `⚠️ ${ok} guardados · ${fallo} con error (puedes reintentar con el mismo archivo: lo ya guardado no se repite)`
    : `✅ Listo: ${ok} cambios guardados`;
  if (!fallo) btn.style.background = "linear-gradient(135deg,#1a9e5c,#16875a)";
  log.innerHTML += `<div style="color:#003366;font-weight:700;margin-top:4px">${fallo ? "Terminó con errores" : "🎉 Matrícula guardada. Revísala en 👨‍🎓 Estudiantes → 📊 Matrícula por grado."}</div>`;
}
