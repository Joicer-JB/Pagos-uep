// Fichas para docentes: los docentes no leen la colección «estudiantes», que tiene datos privados (teléfonos y correo
// del representante, deuda, mensualidad, observaciones médicas...). Leen «estudiantes_docentes»: una copia de cada
// estudiante con solo lo que necesitan para cargar notas e imprimir el boletín.
//
// Nadie tiene que mantener esa copia a mano: cuando el director o la administradora usan la plataforma, la app compara
// cada estudiante con su ficha y escribe solo las que cambiaron (al entrar y cada vez que cambia un estudiante).
// Las reglas de Firestore solo aceptan en las fichas los campos de CAMPOS_FICHA.

const COL_FICHAS = "estudiantes_docentes";
const CAMPOS_FICHA = [
  "nombre",
  "cedula",
  "fechaNac",
  "grado",
  "seccion",
  "anioEscolar",
  "acudiente",
  "estado",
  "graduado",
];

// Ficha de un estudiante: solo los campos permitidos y con valor. Del estado solo se copia «retirado»
// (los demás, como «mora», hablan de su deuda y el docente no los necesita).
function fichaDocente(e) {
  const f = {};
  CAMPOS_FICHA.forEach((k) => {
    const v = e[k];
    if (v === undefined || v === null || v === "" || v === false) return;
    if (k === "estado" && v !== "retirado") return;
    f[k] = v;
  });
  return f;
}
// Texto comparable de una ficha (claves en orden)
const textoFicha = (f) =>
  JSON.stringify(
    Object.keys(f)
      .sort()
      .map((k) => [k, f[k]])
  );

// Las dos copias que mantiene el director: la de los docentes y la de control de estudio
const COPIAS_ESTUDIANTES = [
  { col: COL_FICHAS, ficha: (e) => fichaDocente(e), guardadas: null },
  { col: "estudiantes_control", ficha: (e) => fichaControl(e), guardadas: null },
];
let _sincronizando = null;
let _repetirSincronizacion = false;
let _esperaFichas = null;

// Pone al día las fichas de los docentes y las de control de estudio con la lista de estudiantes en memoria. Solo el
// director (es quien edita estudiantes), y solo en el año actual. Si falla (sin internet, reglas viejas), lo
// intentará en el próximo cambio.
async function sincronizarFichasDocentes() {
  if (rolUsuario !== "director" || soloLectura()) return;
  if (_sincronizando) {
    _repetirSincronizacion = true; // llegó otro cambio mientras escribía: se repite al terminar
    return _sincronizando;
  }
  _sincronizando = Promise.all(COPIAS_ESTUDIANTES.map(sincronizarCopia));
  try {
    await _sincronizando;
  } finally {
    _sincronizando = null;
    if (_repetirSincronizacion) {
      _repetirSincronizacion = false;
      sincronizarFichasDocentes();
    }
  }
}
async function sincronizarCopia(copia) {
  try {
    if (!copia.guardadas) {
      const s = await db.collection(copia.col).get();
      copia.guardadas = new Map(s.docs.map((d) => [d.id, textoFicha(d.data())]));
    }
    const cambios = [];
    const ids = new Set();
    estudiantes.forEach((e) => {
      ids.add(e.id);
      const ficha = copia.ficha(e),
        texto = textoFicha(ficha);
      if (copia.guardadas.get(e.id) !== texto) cambios.push({ id: e.id, ficha, texto });
    });
    copia.guardadas.forEach((_, id) => ids.has(id) || cambios.push({ id, borrar: true }));
    // De 400 en 400 (Firestore acepta hasta 500 escrituras por lote)
    for (let i = 0; i < cambios.length; i += 400) {
      const parte = cambios.slice(i, i + 400),
        lote = db.batch();
      parte.forEach((c) => {
        const ref = db.collection(copia.col).doc(c.id);
        if (c.borrar) lote.delete(ref);
        else lote.set(ref, c.ficha);
      });
      await lote.commit();
      parte.forEach((c) => (c.borrar ? copia.guardadas.delete(c.id) : copia.guardadas.set(c.id, c.texto)));
    }
  } catch (e) {
    console.warn(`No se pudo actualizar «${copia.col}»:`, e.message);
  }
}
// Después de un cambio en estudiantes: espera un momento (un lote de cambios genera varios avisos seguidos)
function programarFichasDocentes() {
  clearTimeout(_esperaFichas);
  _esperaFichas = setTimeout(sincronizarFichasDocentes, 800);
}
// Al cerrar sesión: la próxima persona vuelve a leer las fichas
function olvidarFichasDocentes() {
  clearTimeout(_esperaFichas);
  COPIAS_ESTUDIANTES.forEach((c) => (c.guardadas = null));
}

// Lista de estudiantes del docente (sus fichas). Mientras sigan publicadas las reglas anteriores, que no dejan
// leer las fichas, usa la colección completa como antes.
async function leerFichasDocente() {
  try {
    return await db.collection(COL_FICHAS).orderBy("nombre").get();
  } catch (e) {
    if (e.code !== "permission-denied") throw e;
    console.warn("Las fichas de docentes aún no se pueden leer (¿reglas sin publicar?); se usa la lista completa.");
    return db.collection("estudiantes").orderBy("nombre").get();
  }
}

// ---- Control de estudio ----
// Control de estudio (perfil de docente con controlEstudio) inscribe estudiantes y edita sus datos personales y los
// del representante, sin ver nada financiero: no lee «estudiantes» (que tiene mensualidad, beca, deuda...), sino
// «estudiantes_control», una copia con solo los campos de CAMPOS_CONTROL que el director mantiene al día (arriba).
// Al guardar, escribe a la vez en «estudiantes» (solo los campos de CAMPOS_EDITA_CONTROL) y en su copia.
// Las reglas de Firestore aceptan exactamente estos campos.
const esControlEstudio = () => rolUsuario === "docente" && !!(usuarioActual && usuarioActual.controlEstudio);
const CAMPOS_EDITA_CONTROL = [
  "nombre",
  "cedula",
  "fechaNac",
  "grado",
  "seccion",
  "jornada",
  "sexo",
  "telefono",
  "acudiente",
  "cedulaAcudiente",
  "telefonoAcudiente",
  "correoAcudiente",
  "observacionesMedicas",
  "pendienteAnterior",
  "anioEscolar",
];
// La copia lleva además el horario (inicial), si está retirado o graduado (sin la mora) y cuándo se inscribió
const CAMPOS_CONTROL = [...CAMPOS_EDITA_CONTROL, "horario", "estado", "graduado", "graduadoEn"];
function fichaControl(e) {
  const f = {};
  CAMPOS_CONTROL.forEach((k) => {
    const v = e[k];
    if (v === undefined || v === null || v === "" || v === false) return;
    if (k === "estado" && v !== "retirado") return;
    f[k] = v;
  });
  return f;
}
// Lista de estudiantes de control de estudio. Mientras no estén publicadas las reglas nuevas, o la copia esté vacía,
// usa las fichas de los docentes (como antes: solo para notas y boletín).
async function leerEstudiantesControl() {
  try {
    const s = await db.collection("estudiantes_control").orderBy("nombre").get();
    if (s.docs.length) return s;
    // Vacía: el director todavía no entró desde que se publicó este cambio (él la llena al entrar)
    return leerFichasDocente();
  } catch (e) {
    if (e.code !== "permission-denied") throw e;
    console.warn("Control de estudio aún no puede leer «estudiantes_control» (¿reglas sin publicar?).");
    return leerFichasDocente();
  }
}
