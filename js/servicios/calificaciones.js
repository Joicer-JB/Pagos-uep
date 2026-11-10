// Calificaciones de media general: plan de evaluación, nota de cada lapso, definitiva, ajustes del consejo y
// promedio del estudiante. Lo usan la pestaña Notas, la sábana y el boletín, para que todos muestren lo mismo.
//
// Todo se guarda en la colección «notas»: así se archiva con el año escolar y pasa a la ficha que se conserva al
// fusionar estudiantes duplicados.
// · notas/<estId>_<Lapso N>: la nota del lapso que carga control de estudio, en <materia>_lapso; o las evaluaciones
//   del profesor, en <materia>_<n> (n = número de la evaluación en el plan). Si están las dos, manda la del lapso.
//   Los ajustes del consejo de ese lapso van en «consejo»: {<materia>: {nota, original, motivo, acta, por, fecha}}.
// · notas/<estId>_Definitiva: solo «consejo», con los ajustes de la nota definitiva.
// · notas/plan__<grado>: el plan de evaluación del grado: materias: {<materia>: {<Lapso N>: {evals, ultimoN}}},
//   con evals = [{n, nombre, peso}] (peso en %, 0 = sin porcentaje). ultimoN es el último número usado: una
//   evaluación nueva nunca toma el número de una quitada (no hereda sus notas).
// Sin plan, cada lapso tiene 3 evaluaciones que valen igual (como siempre).
// Las notas llevan un decimal. Solo el director pone o quita ajustes del consejo (las reglas de Firestore no dejan a
// los docentes tocar «consejo»).

const LAPSO_DEF = "Definitiva";
const EVALS_BASE = [1, 2, 3].map((n) => ({ n, nombre: "Eval " + n, peso: 0 }));
// Un decimal, redondeando el 5 hacia arriba (9,65 → 9,7). El 1e-9 corrige los errores de la máquina con decimales:
// (5,6 + 13,7) / 2 da 9,6499999… y sin él saldría 9,6.
const unDecimal = (x) => Math.round(x * 10 + (x >= 0 ? 1e-9 : -1e-9)) / 10;
const idPlanEval = (grado) => "plan__" + String(grado || "").replace(/[/.#[\]]/g, "_");
const notaNum = (v) => {
  if (v === undefined || v === null || v === "") return null;
  const x = parseFloat(v);
  return isFinite(x) ? x : null;
};

// Evaluaciones del plan de una materia en un lapso ([{n, nombre, peso}])
function planEvaluacion(grado, materia, lapso) {
  const p = notas[idPlanEval(grado)];
  const l = p && p.materias && p.materias[materia] && p.materias[materia][lapso];
  return l && Array.isArray(l.evals) && l.evals.length ? l.evals : EVALS_BASE;
}
const ultimoNPlan = (grado, materia, lapso) => {
  const p = notas[idPlanEval(grado)];
  const l = p && p.materias && p.materias[materia] && p.materias[materia][lapso];
  return Math.max(3, (l && Number(l.ultimoN)) || 0, ...planEvaluacion(grado, materia, lapso).map((e) => e.n));
};
const tienePorcentajes = (evals) => evals.some((e) => Number(e.peso) > 0);

// Evaluaciones de un estudiante en una materia y lapso, con la nota que le puso el profesor (null = sin nota)
function evaluacionesDe(estId, grado, materia, lapso) {
  const n = notas[`${estId}_${lapso}`] || {};
  return planEvaluacion(grado, materia, lapso).map((ev) => ({ ...ev, nota: notaNum(n[materia + "_" + ev.n]) }));
}
// Nota del lapso: con porcentajes, el promedio ponderado de las evaluaciones que ya tienen nota (al completarlas es
// la suma de nota × % / 100); sin porcentajes, el promedio simple
function calcularNotaLapso(evals) {
  const con = evals.filter((e) => e.nota !== null);
  if (!con.length) return null;
  const pesos = con.reduce((a, e) => a + (Number(e.peso) || 0), 0);
  if (tienePorcentajes(evals))
    return pesos > 0 ? unDecimal(con.reduce((a, e) => a + e.nota * (Number(e.peso) || 0), 0) / pesos) : null;
  return unDecimal(con.reduce((a, e) => a + e.nota, 0) / con.length);
}
const ajusteConsejo = (estId, materia, lapso) => {
  const c = (notas[`${estId}_${lapso}`] || {}).consejo;
  return (c && c[materia]) || null;
};

// Nota de un lapso: {nota, calculada (la del profesor), ajuste (del consejo o null), evaluaciones, faltan}
function notaLapsoDe(est, materia, lapso) {
  const evaluaciones = evaluacionesDe(est.id, est.grado, materia, lapso);
  const directa = notaNum((notas[`${est.id}_${lapso}`] || {})[materia + "_lapso"]);
  const calculada = directa !== null ? directa : calcularNotaLapso(evaluaciones);
  const ajuste = ajusteConsejo(est.id, materia, lapso);
  return {
    nota: ajuste ? notaNum(ajuste.nota) : calculada,
    calculada,
    ajuste,
    evaluaciones,
    directa: directa !== null,
    faltan: directa !== null || calculada === null ? 0 : evaluaciones.filter((e) => e.nota === null).length,
  };
}
// Definitiva de una materia: promedio de los lapsos con nota (ya con los ajustes del consejo), o la que fijó el consejo
function definitivaDe(est, materia) {
  const lapsos = LAPSOS.map((l) => notaLapsoDe(est, materia, l));
  const validas = lapsos.map((x) => x.nota).filter((x) => x !== null);
  const calculada = validas.length ? unDecimal(validas.reduce((a, b) => a + b, 0) / validas.length) : null;
  const ajuste = ajusteConsejo(est.id, materia, LAPSO_DEF);
  return {
    nota: ajuste ? notaNum(ajuste.nota) : calculada,
    calculada,
    ajuste,
    lapsos,
    completa: validas.length === LAPSOS.length,
  };
}
// Promedio del estudiante: de las definitivas que ya tiene
function promedioEstudiante(est, materias) {
  const defs = materias.map((m) => definitivaDe(est, m).nota).filter((x) => x !== null);
  return defs.length ? unDecimal(defs.reduce((a, b) => a + b, 0) / defs.length) : null;
}

// ---- Guardar (la pantalla vuelve a dibujarse después) ----

// Plan de evaluación de una materia en uno o varios lapsos (lo pueden armar el director y los docentes)
async function guardarPlanEvaluacion(grado, materia, lapsos, evals) {
  const id = idPlanEval(grado);
  const porLapso = {};
  lapsos.forEach((l) => {
    const ultimoN = Math.max(ultimoNPlan(grado, materia, l), ...evals.map((e) => e.n));
    porLapso[l] = { evals: evals.map((e) => ({ n: e.n, nombre: e.nombre, peso: Number(e.peso) || 0 })), ultimoN };
  });
  const cambios = {
    tipo: "plan",
    grado,
    materias: { [materia]: porLapso },
    actualizadoPor: correoUsuario(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  };
  await db.collection("notas").doc(id).set(cambios, { merge: true });
  const p = notas[id] || (notas[id] = { tipo: "plan", grado, materias: {} });
  p.materias = p.materias || {};
  p.materias[materia] = { ...(p.materias[materia] || {}), ...porLapso };
}
// Ajuste del consejo (solo el director): lapso = «Lapso N» o LAPSO_DEF. nota = null lo quita.
async function guardarAjusteConsejo(est, materia, lapso, nota, motivo, acta) {
  if (rolUsuario !== "director") throw new Error("Solo el director puede cambiar notas por decisión del consejo");
  const id = `${est.id}_${lapso}`;
  const calculada =
    lapso === LAPSO_DEF ? definitivaDe(est, materia).calculada : notaLapsoDe(est, materia, lapso).calculada;
  const ajuste =
    nota === null
      ? null
      : { nota, original: calculada, motivo, acta: acta || "", por: correoUsuario(), fecha: todayStr() };
  await db
    .collection("notas")
    .doc(id)
    .set(
      {
        estId: est.id,
        lapso,
        consejo: { [materia]: ajuste || firebase.firestore.FieldValue.delete() },
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  const n = notas[id] || (notas[id] = { estId: est.id, lapso });
  n.consejo = { ...(n.consejo || {}) };
  if (ajuste) n.consejo[materia] = ajuste;
  else delete n.consejo[materia];
}

// ---- Revisión (área a revisar) ----
// La materia que quedó con definitiva por debajo de 10 va a revisión. La nota que saca la cargan el director o
// control de estudio en la sábana; se guarda en notas/<estId>_Revision, en <materia>_revision. No cambia la
// definitiva ni el promedio: el boletín muestra las dos.
const LAPSO_REVISION = "Revision";
const puedeCargarRevision = () =>
  !soloLectura() &&
  (rolUsuario === "director" || (rolUsuario === "docente" && !!(usuarioActual && usuarioActual.controlEstudio)));
const notaRevisionDe = (est, materia) => notaNum((notas[`${est.id}_${LAPSO_REVISION}`] || {})[materia + "_revision"]);
async function guardarNotaRevision(est, materia, nota) {
  const id = `${est.id}_${LAPSO_REVISION}`;
  const k = materia + "_revision";
  await db
    .collection("notas")
    .doc(id)
    .set(
      {
        estId: est.id,
        lapso: LAPSO_REVISION,
        [k]: nota === null ? "" : String(nota),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  const n = notas[id] || (notas[id] = { estId: est.id, lapso: LAPSO_REVISION });
  n[k] = nota === null ? "" : String(nota);
}

// ---- Puesto del estudiante por su promedio ----
// periodo: "anio" (con las definitivas de los 3 lapsos) o «Lapso N». Entran los estudiantes de media general con nota en todas sus
// materias en ese período (también los que tienen materias reprobadas). Se compara el promedio con un decimal, el
// mismo de la sábana; los empatados comparten el puesto (dos con 15,2 son 1° y 1°, y el siguiente es 3°).
// Salón: el mismo año y sección (sin sección cuenta como «U»). Devuelve {salon: {puesto, total}, colegio: {...}};
// cada uno es null si el estudiante no tiene todas sus notas en el período.
const seccionDe = (est) => est.seccion || "U";
function promedioCompletoPeriodo(est, periodo) {
  // En el año, la definitiva cuenta cuando tiene los 3 lapsos (o la fijó el consejo)
  const n = getAreas(est.grado).map((m) => {
    if (periodo !== "anio") return notaLapsoDe(est, m, periodo).nota;
    const d = definitivaDe(est, m);
    return d.completa || d.ajuste ? d.nota : null;
  });
  if (!n.length || n.some((x) => x === null)) return null;
  return unDecimal(n.reduce((a, b) => a + b, 0) / n.length);
}
function puestosEstudiante(est, periodo) {
  const todos = estudiantes
    .filter((e) => activo(e) && e.grado && getNivel(e.grado) === "media")
    .map((e) => ({ e, p: promedioCompletoPeriodo(e, periodo), d: estaDestacado(e, periodo) }))
    .filter((x) => x.p !== null);
  const propio = todos.find((x) => x.e.id === est.id);
  const puesto = (lista) =>
    propio ? { puesto: lista.filter((x) => vaAntes(x, propio)).length + 1, total: lista.length } : null;
  return {
    colegio: puesto(todos),
    salon: puesto(todos.filter((x) => x.e.grado === est.grado && seccionDe(x.e) === seccionDe(est))),
  };
}

// ---- Desempate ----
// Con el mismo promedio, el director o control de estudio pueden destacar a un estudiante (por su conducta, por
// ejemplo) para que quede adelante. Se decide aparte para el año y cada lapso, y se guarda en
// notas/<estId>_Desempate: {anio: true, "Lapso 1": true, ...}. Dos destacados del mismo empate siguen empatados.
const LAPSO_DESEMPATE = "Desempate";
const estaDestacado = (est, periodo) => !!(notas[`${est.id}_${LAPSO_DESEMPATE}`] || {})[periodo];
// a va antes que b: mejor promedio, o el mismo y a destacado sin que b lo esté
const vaAntes = (a, b) => a.p > b.p || (a.p === b.p && a.d && !b.d);
const puedeDesempatar = puedeCargarRevision; // el director o control de estudio
async function guardarDesempate(est, periodo, destacado) {
  const id = `${est.id}_${LAPSO_DESEMPATE}`;
  await db
    .collection("notas")
    .doc(id)
    .set(
      {
        estId: est.id,
        lapso: LAPSO_DESEMPATE,
        [periodo]: !!destacado,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  const n = notas[id] || (notas[id] = { estId: est.id, lapso: LAPSO_DESEMPATE });
  n[periodo] = !!destacado;
}
// Empates en un período: grupos de estudiantes de media general con el mismo promedio (todas sus notas del período)
// en los que está al menos uno de «lista». Cada grupo: {promedio, ests: [{est, destacado}]}
function empatesPeriodo(periodo, lista) {
  const ids = new Set(lista.map((e) => e.id));
  const grupos = new Map();
  estudiantes
    .filter((e) => activo(e) && e.grado && getNivel(e.grado) === "media")
    .forEach((e) => {
      const p = promedioCompletoPeriodo(e, periodo);
      if (p === null) return;
      if (!grupos.has(p)) grupos.set(p, []);
      grupos.get(p).push(e);
    });
  return [...grupos.entries()]
    .filter(([, ests]) => ests.length > 1 && ests.some((e) => ids.has(e.id)))
    .sort((a, b) => b[0] - a[0])
    .map(([promedio, ests]) => ({
      promedio,
      ests: ests.sort(ordenNombre).map((est) => ({ est, destacado: estaDestacado(est, periodo) })),
    }));
}
