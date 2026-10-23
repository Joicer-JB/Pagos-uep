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

let _fichasGuardadas = null; // Map id → textoFicha de lo que hay en Firestore (se lee una vez por sesión)
let _sincronizando = null;
let _repetirSincronizacion = false;
let _esperaFichas = null;

// Pone al día las fichas de los docentes con la lista de estudiantes en memoria. Solo el director (es quien
// edita estudiantes), y solo en el año actual. Si falla (sin internet, reglas viejas), lo intentará en el próximo cambio.
async function sincronizarFichasDocentes() {
  if (rolUsuario !== "director" || soloLectura()) return;
  if (_sincronizando) {
    _repetirSincronizacion = true; // llegó otro cambio mientras escribía: se repite al terminar
    return _sincronizando;
  }
  _sincronizando = (async () => {
    try {
      if (!_fichasGuardadas) {
        const s = await db.collection(COL_FICHAS).get();
        _fichasGuardadas = new Map(s.docs.map((d) => [d.id, textoFicha(d.data())]));
      }
      const cambios = [];
      const ids = new Set();
      estudiantes.forEach((e) => {
        ids.add(e.id);
        const ficha = fichaDocente(e),
          texto = textoFicha(ficha);
        if (_fichasGuardadas.get(e.id) !== texto) cambios.push({ id: e.id, ficha, texto });
      });
      _fichasGuardadas.forEach((_, id) => ids.has(id) || cambios.push({ id, borrar: true }));
      // De 400 en 400 (Firestore acepta hasta 500 escrituras por lote)
      for (let i = 0; i < cambios.length; i += 400) {
        const parte = cambios.slice(i, i + 400),
          lote = db.batch();
        parte.forEach((c) => {
          const ref = db.collection(COL_FICHAS).doc(c.id);
          if (c.borrar) lote.delete(ref);
          else lote.set(ref, c.ficha);
        });
        await lote.commit();
        parte.forEach((c) => (c.borrar ? _fichasGuardadas.delete(c.id) : _fichasGuardadas.set(c.id, c.texto)));
      }
    } catch (e) {
      console.warn("No se pudieron actualizar las fichas de los docentes:", e.message);
    }
  })();
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
// Después de un cambio en estudiantes: espera un momento (un lote de cambios genera varios avisos seguidos)
function programarFichasDocentes() {
  clearTimeout(_esperaFichas);
  _esperaFichas = setTimeout(sincronizarFichasDocentes, 800);
}
// Al cerrar sesión: la próxima persona vuelve a leer las fichas
function olvidarFichasDocentes() {
  clearTimeout(_esperaFichas);
  _fichasGuardadas = null;
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
