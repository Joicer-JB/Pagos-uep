// Qué grados y materias le tocan a cada docente, y quién da cada clase.
// · Inicial y Primaria: un docente por grado, que da todas las áreas. En su perfil (⚙️ Config → 👨‍🏫 Docentes) está su
//   «grado»; en la nómina, una clase sin materia en ese grado.
// · Media General: un docente por materia y año. En su perfil, «materias» = ["1er Año::Matemáticas", …] (los perfiles
//   viejos guardaban solo la materia: vale para todos los años); en la nómina, una clase con la materia y los años.
// El director ve y hace todo. Un docente sin grado ni materias asignadas, o la cuenta fija de notas, ve todo como antes.
// Los profesores guía de Media General están en ⚙️ Config → 🏫 Institución (configInst.guias = {año: nombre}).

const normMateria = (m) =>
  String(m || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

// Lo que le toca al docente que entró: {grado, porAnio: Map(año → Set de materias)}, o null = sin límite
function asignacionActual() {
  if (rolUsuario !== "docente" || !usuarioActual) return null;
  const grado = usuarioActual.grado || "";
  const materias = Array.isArray(usuarioActual.materias) ? usuarioActual.materias.filter(Boolean) : [];
  if (!grado && !materias.length) return null;
  const porAnio = new Map();
  const agregar = (g, m) => {
    if (!porAnio.has(g)) porAnio.set(g, new Set());
    porAnio.get(g).add(normMateria(m));
  };
  materias.forEach((k) => {
    const i = String(k).indexOf("::");
    if (i < 0) GRADOS_MG.forEach((g) => agregar(g, k));
    else agregar(k.slice(0, i), k.slice(i + 2));
  });
  return { grado, porAnio };
}
// ¿Ve a los estudiantes de ese grado? (el suyo de Inicial o Primaria, o un año donde da alguna materia)
function veGrado(grado) {
  if (rolUsuario === "administradora") return false;
  const a = asignacionActual();
  return !a || (!!a.grado && grado === a.grado) || a.porAnio.has(grado);
}
const veEstudiante = (est) => veGrado(est.grado);
// ¿Puede cargar notas (y el plan de evaluación) de esa materia o área en ese grado?
function puedeEditarMateria(grado, materia) {
  if (rolUsuario === "director") return true;
  if (rolUsuario !== "docente") return false;
  const a = asignacionActual();
  if (!a || (a.grado && grado === a.grado)) return true;
  const s = a.porAnio.get(grado);
  return !!s && s.has(normMateria(materia));
}
const docenteLimitado = () => !!asignacionActual();

// ---- Quién da cada clase (para la sábana y el boletín). Los perfiles y la nómina solo los carga el director; un docente
// se ve a sí mismo.
const activoDoc = (x) => x && x.activo !== false;
function profesorDe(grado, materia) {
  const k = normMateria(materia);
  const d = (configDocentes || []).find(
    (x) =>
      activoDoc(x) &&
      (x.materias || []).some((m) => {
        const i = String(m).indexOf("::");
        return i < 0
          ? normMateria(m) === k && GRADOS_MG.includes(grado)
          : m.slice(0, i) === grado && normMateria(m.slice(i + 2)) === k;
      })
  );
  if (d) return d.nombre || "";
  const t = (trabajadores || []).find(
    (x) => activoDoc(x) && clasesDe(x).some((c) => normMateria(c.materia) === k && c.grados.includes(grado))
  );
  if (t) return t.nombre || "";
  if (
    rolUsuario === "docente" &&
    docenteLimitado() &&
    puedeEditarMateria(grado, materia) &&
    getNivel(grado) === "media"
  )
    return (usuarioActual && usuarioActual.nombre) || "";
  return "";
}
// Docente de aula de un grado de Inicial o Primaria
function docenteDeGrado(grado) {
  const d = (configDocentes || []).find((x) => activoDoc(x) && x.grado === grado);
  if (d) return d.nombre || "";
  const t = (trabajadores || []).find(
    (x) => activoDoc(x) && clasesDe(x).some((c) => !(c.materia || "").trim() && c.grados.includes(grado))
  );
  if (t) return t.nombre || "";
  if (rolUsuario === "docente" && usuarioActual && usuarioActual.grado === grado) return usuarioActual.nombre || "";
  return "";
}
const profesorGuia = (grado) => ((configInst && configInst.guias) || {})[grado] || "";
