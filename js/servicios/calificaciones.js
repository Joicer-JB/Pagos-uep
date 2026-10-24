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
const unDecimal = (x) => Math.round(x * 10) / 10;
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
