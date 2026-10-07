// Duplicados: encuentra estudiantes repetidos (nombre y apellido en otro orden, con coma, con o sin tildes,
// en mayúsculas o minúsculas, o con la misma cédula) y deja eliminar las copias de una sola vez.
// Solo el director puede eliminar (así lo exigen también las reglas de Firestore).

// Datos que se copian a la ficha que se conserva si ahí están vacíos (para no perder nada al borrar la copia)
const DUP_CAMPOS_FUSION = [
  "cedula",
  "fechaNac",
  "sexo",
  "jornada",
  "telefono",
  "acudiente",
  "telefonoAcudiente",
  "correoAcudiente",
  "cedulaAcudiente",
  "direccion",
  "observacionesMedicas",
  "mensualidad",
  "cuotaDesde",
];

// ================= Lógica (sin pantalla ni Firebase: se prueba en tests/unidad/duplicados.test.js) =================

// Cédula comparable: solo letras y números, minúsculas. Las muy cortas (0, N/A, 123…) no sirven para identificar a nadie.
function cedulaClave(c) {
  const k = String(c == null ? "" : c)
    .replace(/[^0-9a-z]/gi, "")
    .toLowerCase();
  return k.length >= 5 ? k : "";
}
const dupVacio = (v) => v == null || v === "" || v === 0;
// Cuántos datos útiles tiene la ficha (para conservar la más completa)
const dupPuntosDatos = (e) => DUP_CAMPOS_FUSION.filter((k) => !dupVacio(e[k])).length;

// Agrupa los estudiantes que parecen la misma persona.
//   lista:  estudiantes
//   pagosDe(e): función que devuelve los pagos de ese estudiante (en la app, pagosDeEstudiante)
// Dos fichas son «la misma» si:
//   · tienen el mismo nombre (sin importar orden, tildes, comas ni mayúsculas) y no tienen cédulas distintas, o
//   · tienen la misma cédula (aunque el nombre esté escrito diferente → motivo «cedula», hay que revisarlo).
// Si hay dos cédulas distintas con el mismo nombre se tratan como homónimos (dos niños con el mismo nombre) y no se mezclan.
// Devuelve [{id, motivo:"nombre"|"cedula", miembros:[estudiante], conservar:idSugerido}] ordenado por nombre.
function agruparDuplicados(lista, pagosDe) {
  const padre = lista.map((_, i) => i);
  const raiz = (i) => {
    while (padre[i] !== i) {
      padre[i] = padre[padre[i]];
      i = padre[i];
    }
    return i;
  };
  const unir = (a, b) => {
    padre[raiz(a)] = raiz(b);
  };
  const porNombre = new Map(),
    porCed = new Map();
  const meter = (m, k, i) => {
    if (!k) return;
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(i);
  };
  lista.forEach((e, i) => {
    meter(porNombre, claveNombreSinOrden(e.nombre), i);
    meter(porCed, cedulaClave(e.cedula), i);
  });
  porNombre.forEach((idx) => {
    if (idx.length < 2) return;
    const cedulas = new Set(idx.map((i) => cedulaClave(lista[i].cedula)).filter(Boolean));
    if (cedulas.size <= 1) idx.slice(1).forEach((i) => unir(idx[0], i));
  });
  porCed.forEach((idx) => idx.slice(1).forEach((i) => unir(idx[0], i)));

  const porRaiz = new Map();
  lista.forEach((e, i) => meter(porRaiz, String(raiz(i)), i));
  const grupos = [];
  porRaiz.forEach((idx) => {
    if (idx.length < 2) return;
    const miembros = idx.map((i) => lista[i]);
    const nombres = new Set(miembros.map((e) => claveNombreSinOrden(e.nombre)));
    grupos.push({
      id: miembros[0].id,
      motivo: nombres.size === 1 ? "nombre" : "cedula",
      miembros,
      conservar: elegirConservar(miembros, pagosDe),
    });
  });
  const nombreGrupo = (g) => (g.miembros.find((e) => e.id === g.conservar) || g.miembros[0]).nombre || "";
  return grupos.sort((a, b) => nombreGrupo(a).localeCompare(nombreGrupo(b), "es"));
}
// La ficha que conviene conservar: la que tiene más pagos y, a igualdad, la más completa (si empatan, la primera)
function elegirConservar(miembros, pagosDe) {
  let mejor = null,
    mejorPuntos = -1;
  miembros.forEach((e) => {
    const puntos = pagosDe(e).length * 1000 + dupPuntosDatos(e);
    if (puntos > mejorPuntos) {
      mejor = e;
      mejorPuntos = puntos;
    }
  });
  return mejor.id;
}
// Qué pasaría si se conserva la ficha `conservarId` del grupo:
//   borrar:     fichas que se pueden eliminar sin perder pagos
//   bloqueados: fichas con pagos que la ficha conservada no vería (no se borran; hay que elegir otra o resolverlo a mano)
//   campos:     datos que se copian a la ficha conservada porque ahí estaban vacíos
//   seguro:     mismo nombre, mismo grado y misma fecha de nacimiento, sin pagos en riesgo → se puede limpiar en bloque
function planDeGrupo(g, conservarId, pagosDe) {
  const conservar = g.miembros.find((e) => e.id === conservarId) || g.miembros.find((e) => e.id === g.conservar);
  const visibles = new Set(pagosDe(conservar));
  const borrar = [],
    bloqueados = [];
  g.miembros.forEach((e) => {
    if (e === conservar) return;
    const perdidos = pagosDe(e).filter((p) => !visibles.has(p));
    if (perdidos.length) bloqueados.push({ e, pagos: perdidos.length });
    else borrar.push(e);
  });
  const campos = {};
  borrar.forEach((e) => {
    DUP_CAMPOS_FUSION.forEach((k) => {
      const actual = k in campos ? campos[k] : conservar[k];
      if (dupVacio(actual) && !dupVacio(e[k])) campos[k] = e[k];
    });
    // Una deuda anotada a mano en la copia no se pierde si la ficha conservada no tiene ninguna
    const sinDeuda = !(conservar.estado === "mora" && conservar.moraMonto > 0) && !("moraMonto" in campos);
    const sinEstadoEspecial = !conservar.estado || conservar.estado === "alsaldo";
    if (sinDeuda && sinEstadoEspecial && e.estado === "mora" && e.moraMonto > 0) {
      campos.estado = "mora";
      campos.moraMonto = e.moraMonto;
      campos.moraConcepto = e.moraConcepto || "";
    }
  });
  const gradoDe = (e) => gradoCanon(e.grado) || e.grado || "";
  const mismoGrado = (e) => !gradoDe(e) || !gradoDe(conservar) || gradoDe(e) === gradoDe(conservar);
  const mismaFecha = (e) => !e.fechaNac || !conservar.fechaNac || e.fechaNac === conservar.fechaNac;
  const seguro =
    g.motivo === "nombre" &&
    borrar.length > 0 &&
    bloqueados.length === 0 &&
    borrar.every((e) => mismoGrado(e) && mismaFecha(e));
  return { conservar, borrar, bloqueados, campos, seguro };
}

// ================= Pantalla =================

// Estado del modal: grupos encontrados, qué ficha se conserva en cada uno y si ya se descargó el respaldo
let dupEstado = { grupos: [], sel: {}, respaldo: false };

// Aviso en la pestaña Estudiantes (solo el director; no consulta pagos, solo cuenta)
function htmlAvisoDuplicados() {
  if (rolUsuario !== "director" || soloLectura()) return "";
  const n = agruparDuplicados(estudiantes, () => []).length;
  if (!n) return "";
  return `<div class="alert-item alert-mora" style="display:block;margin-bottom:0.75rem">
    <div style="font-weight:700">👥 ${n} estudiante${n === 1 ? "" : "s"} repetido${n === 1 ? "" : "s"}</div>
    <div style="font-size:0.76rem;margin:3px 0 6px">Mismo nombre escrito de otra forma (apellido primero, con coma, sin tilde…) o misma cédula.</div>
    <button class="btn btn-primary btn-sm" onclick="abrirDuplicados()">Revisar y limpiar</button></div>`;
}
function abrirDuplicados() {
  if (rolUsuario !== "director") {
    alert("Solo el director puede eliminar estudiantes duplicados.");
    return;
  }
  if (soloLectura()) {
    alert("Estás viendo un año anterior (solo lectura).");
    return;
  }
  dupEstado.grupos = agruparDuplicados(estudiantes, pagosDeEstudiante);
  dupEstado.sel = {};
  if (!dupEstado.grupos.length) {
    alert("No se encontraron estudiantes duplicados 👍");
    return;
  }
  abrirModal({ tipo: "duplicados" });
}
const planDup = (g) => planDeGrupo(g, dupEstado.sel[g.id] || g.conservar, pagosDeEstudiante);

function renderModalDuplicados() {
  return `<div class="modal-bg" onclick="if(event.target.classList.contains('modal-bg'))cerrarModal()">
    <div class="modal">
      <div class="modal-header">
        <div><h3>👥 Estudiantes repetidos</h3><p>Elige cuál ficha conservar; las demás se eliminan</p></div>
        <button class="modal-close-x" onclick="cerrarModal()">✕</button>
      </div>
      <div class="modal-body" id="dup-body">${htmlDuplicados()}</div>
    </div></div>`;
}
function htmlDuplicados() {
  const planes = dupEstado.grupos.map((g) => ({ g, p: planDup(g) }));
  if (!planes.length)
    return `<div class="empty"><div class="empty-icon">✅</div><p>Ya no quedan estudiantes repetidos</p></div>
      <button class="btn btn-primary btn-full" onclick="cerrarModal()">Cerrar</button>`;
  const seguros = planes.filter((x) => x.p.seguro);
  const copias = seguros.reduce((s, x) => s + x.p.borrar.length, 0);
  const cabecera = seguros.length
    ? `<div style="background:#e6f7ef;border-radius:10px;padding:0.75rem;margin-bottom:0.85rem">
        <div style="font-weight:700;color:#1a7a4a;font-size:0.85rem">✅ ${seguros.length} grupo${seguros.length === 1 ? "" : "s"} seguro${seguros.length === 1 ? "" : "s"}</div>
        <div style="font-size:0.76rem;color:#555;margin:3px 0 8px">Mismo nombre, grado y fecha de nacimiento, y las copias no tienen pagos propios. Se conserva la ficha con más pagos y datos.</div>
        <button class="btn btn-danger btn-full" onclick="dupLimpiarSeguros()">🗑️ Eliminar ${copias} copia${copias === 1 ? "" : "s"} de una vez</button>
      </div>`
    : "";
  return (
    cabecera +
    `<div style="font-size:0.78rem;color:#666;margin-bottom:0.5rem">${planes.length} grupo${planes.length === 1 ? "" : "s"} en total. Se descarga un respaldo antes de borrar.</div>` +
    planes.map(({ g, p }) => htmlGrupoDuplicado(g, p)).join("")
  );
}
function htmlGrupoDuplicado(g, p) {
  const gid = escJs(g.id);
  const filas = g.miembros
    .map((e) => {
      const nPagos = pagosDeEstudiante(e).length;
      const esCons = e === p.conservar;
      const bloq = p.bloqueados.find((b) => b.e === e);
      const etiqueta = esCons
        ? `<span class="badge badge-green">✅ Se conserva</span>`
        : bloq
          ? `<span class="badge badge-gold">🔒 Tiene ${bloq.pagos} pago${bloq.pagos === 1 ? "" : "s"} que se perderían: no se borra</span>`
          : `<span class="badge badge-red">🗑️ Se elimina</span>`;
      return `<label style="display:flex;gap:0.5rem;align-items:flex-start;padding:0.5rem 0;border-top:1px solid #eee;cursor:pointer">
        <input type="radio" name="dup-${escHtml(g.id)}" ${esCons ? "checked" : ""} onchange="dupConservar('${gid}','${escJs(e.id)}')" style="margin-top:0.25rem"/>
        <div style="flex:1;min-width:0">
          <div style="font-weight:700;font-size:0.84rem">${escHtml(e.nombre)}</div>
          <div style="font-size:0.74rem;color:#666">${escHtml(e.grado) || "Sin grado"} · CC ${escHtml(e.cedula) || "—"} · ${nPagos} pago${nPagos === 1 ? "" : "s"}${e.acudiente ? " · 👤 " + escHtml(e.acudiente) : ""}</div>
          <div style="margin-top:3px">${etiqueta}</div>
        </div></label>`;
    })
    .join("");
  const aviso =
    g.motivo === "cedula"
      ? `<div style="font-size:0.74rem;color:#b7791f;margin-bottom:4px">⚠️ Misma cédula pero nombres distintos: confirma que es la misma persona.</div>`
      : !p.seguro && p.borrar.length
        ? `<div style="font-size:0.74rem;color:#b7791f;margin-bottom:4px">⚠️ El grado o la fecha de nacimiento no coinciden: revisa antes de borrar.</div>`
        : "";
  const boton = p.borrar.length
    ? `<button class="btn btn-danger btn-sm" style="margin-top:6px" onclick="dupEliminar('${gid}')">🗑️ Eliminar ${p.borrar.length} copia${p.borrar.length === 1 ? "" : "s"}</button>`
    : `<div style="font-size:0.74rem;color:#888;margin-top:6px">No hay copias que se puedan borrar sin perder pagos. Elige otra ficha para conservar.</div>`;
  return `<div style="border:1px solid #dde3ee;border-radius:10px;padding:0.65rem 0.75rem;margin-bottom:0.65rem">${aviso}${filas}${boton}</div>`;
}
function dupRedibujar() {
  const el = document.getElementById("dup-body");
  if (el) el.innerHTML = htmlDuplicados();
}
function dupConservar(gid, estId) {
  dupEstado.sel[gid] = estId;
  dupRedibujar();
}
async function dupEliminar(gid) {
  const g = dupEstado.grupos.find((x) => x.id === gid);
  if (!g) return;
  const p = planDup(g);
  if (!p.borrar.length) return;
  const msg =
    "Se conservará:\n• " +
    p.conservar.nombre +
    "\n\nSe eliminará" +
    (p.borrar.length === 1 ? ":" : "n:") +
    "\n" +
    p.borrar.map((e) => "• " + e.nombre).join("\n") +
    (Object.keys(p.campos).length ? "\n\nLos datos que falten se copiarán a la ficha que se conserva." : "") +
    "\n\nEsto no se puede deshacer. ¿Continuar?";
  if (!confirm(msg)) return;
  await ejecutarFusion([p]);
}
async function dupLimpiarSeguros() {
  const planes = dupEstado.grupos.map(planDup).filter((p) => p.seguro);
  const copias = planes.reduce((s, p) => s + p.borrar.length, 0);
  if (!copias) return;
  const muestra = planes
    .slice(0, 8)
    .map((p) => "• " + p.conservar.nombre + " (" + p.borrar.length + ")")
    .join("\n");
  if (
    !confirm(
      "Se eliminarán " +
        copias +
        " copias de " +
        planes.length +
        " estudiantes, conservando en cada caso la ficha con más pagos y datos:\n\n" +
        muestra +
        (planes.length > 8 ? "\n… y " + (planes.length - 8) + " más" : "") +
        "\n\nEsto no se puede deshacer. ¿Continuar?"
    )
  )
    return;
  await ejecutarFusion(planes);
}
// Aplica los planes en Firestore (en lotes de hasta 400 operaciones: copia datos a la ficha que se conserva y borra las demás).
// Devuelve cuántas fichas se eliminaron. Si algo falla a la mitad, lo ya confirmado queda reflejado en pantalla.
async function ejecutarFusion(planes) {
  if (rolUsuario !== "director") {
    alert("Solo el director puede eliminar estudiantes.");
    return 0;
  }
  if (soloLectura()) {
    alert("Estás viendo un año anterior (solo lectura).");
    return 0;
  }
  planes = planes.filter((p) => p.borrar.length);
  if (!planes.length) return 0;
  if (!dupEstado.respaldo) {
    try {
      descargarRespaldo("antes-de-limpiar-duplicados");
      dupEstado.respaldo = true;
    } catch (e) {
      if (!confirm("No se pudo descargar el respaldo (" + e.message + "). ¿Continuar sin respaldo?")) return 0;
    }
  }
  const col = db.collection("estudiantes");
  const borrados = new Set(),
    cambios = new Map();
  let lote = db.batch(),
    nOps = 0,
    pendientes = [],
    error = null;
  const confirmarLote = async () => {
    if (!nOps) return;
    await lote.commit();
    pendientes.forEach((p) => {
      p.borrar.forEach((e) => borrados.add(e.id));
      if (Object.keys(p.campos).length) cambios.set(p.conservar.id, p.campos);
    });
    lote = db.batch();
    nOps = 0;
    pendientes = [];
  };
  try {
    for (const p of planes) {
      const hayCampos = Object.keys(p.campos).length > 0;
      const ops = (hayCampos ? 1 : 0) + p.borrar.length;
      if (nOps + ops > 400) await confirmarLote();
      if (hayCampos) lote.update(col.doc(p.conservar.id), p.campos);
      p.borrar.forEach((e) => lote.delete(col.doc(e.id)));
      nOps += ops;
      pendientes.push(p);
    }
    await confirmarLote();
  } catch (e) {
    error = e;
  }
  // Lo confirmado en Firestore se refleja en la memoria de la app (también si hubo un error a mitad de camino)
  estudiantes = estudiantes
    .filter((e) => !borrados.has(e.id))
    .map((e) => (cambios.has(e.id) ? { ...e, ...cambios.get(e.id) } : e));
  dupEstado.grupos = agruparDuplicados(estudiantes, pagosDeEstudiante);
  dupEstado.sel = {};
  dupRedibujar();
  if (error) alert("Se eliminaron " + borrados.size + " fichas y luego hubo un error: " + error.message);
  else
    mostrarToast(
      "🗑️ " +
        borrados.size +
        " ficha" +
        (borrados.size === 1 ? "" : "s") +
        " repetida" +
        (borrados.size === 1 ? "" : "s") +
        " eliminada" +
        (borrados.size === 1 ? "" : "s")
    );
  return borrados.size;
}
