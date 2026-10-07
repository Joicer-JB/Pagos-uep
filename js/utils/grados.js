// Grados y niveles: la escalera oficial (Maternal → 5to Año), cómo se interpreta un grado escrito a mano y las áreas por nivel.

// Escalera de la institución. Al empezar el año nuevo: cada estudiante pasa al siguiente escalón;
// 6to Grado egresa de Primaria y pasa a 1er Año (7mo grado); Nivel III egresa de Preescolar; 5to Año se gradúa (Bachiller).
const ESCALERA = [
  "Maternal",
  "Nivel I",
  "Nivel II",
  "Nivel III",
  "1er Grado",
  "2do Grado",
  "3er Grado",
  "4to Grado",
  "5to Grado",
  "6to Grado",
  "1er Año",
  "2do Año",
  "3er Año",
  "4to Año",
  "5to Año",
];
const normGrado = (g) =>
  String(g == null ? "" : g)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[°º.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const ESC_NORM = ESCALERA.map(normGrado);
const ORD_PALABRA = { primer: 1, primero: 1, segundo: 2, tercer: 3, tercero: 3, cuarto: 4, quinto: 5, sexto: 6 };
// Índice en ESCALERA, o -1 si no se puede interpretar (p. ej. "5to" sin decir si es grado o año)
function posEscalera(g) {
  const n = normGrado(g);
  if (!n) return -1;
  const ex = ESC_NORM.indexOf(n);
  if (ex >= 0) return ex;
  // Preescolar I/II/III = Nivel I/II/III = Inicial I/II/III (es lo mismo). También «I nivel», «1er nivel», «primer nivel»
  const NIV = { i: 1, ii: 2, iii: 3, 1: 1, 2: 2, 3: 3, primer: 1, primero: 1, segundo: 2, tercer: 3, tercero: 3 };
  let m =
    n.match(/^(?:nivel|preescolar|inicial|educacion inicial)\s*(iii|ii|i|1|2|3)$/) ||
    n.match(
      /^(iii|ii|i|1|2|3|primer|primero|segundo|tercer|tercero)\s*(?:er|ro|do|to|ero)?\s*nivel(?:\s+(?:de\s+)?(?:preescolar|inicial))?$/
    );
  if (m) return NIV[m[1]];
  let num = null,
    tipo = null;
  m = n.match(/^(\d)\s*(?:ro|er|ero|do|to|vo|mo|no)?\s*(grado|ano|anio)$/);
  if (m) {
    num = +m[1];
    tipo = m[2];
  } else {
    m = n.match(/^(primer|primero|segundo|tercer|tercero|cuarto|quinto|sexto)\s+(grado|ano|anio)$/);
    if (m) {
      num = ORD_PALABRA[m[1]];
      tipo = m[2];
    }
  }
  if (num == null) return -1;
  if (tipo === "grado") {
    if (num >= 1 && num <= 6) return 3 + num; // 1er Grado = posición 4
    if (num >= 7 && num <= 9) return 10 + (num - 7); // 7mo, 8vo y 9no grado = 1er, 2do y 3er Año
    return -1;
  }
  return num >= 1 && num <= 5 ? 9 + num : -1; // 1er Año = posición 10
}
// Nombre oficial del grado tal como se guarda (ej: «Preescolar I» → «Nivel I», «7mo grado» → «1er Año»); "" si no se entiende
const gradoCanon = (g) => {
  const i = posEscalera(g);
  return i >= 0 ? ESCALERA[i] : "";
};
// Para ordenar listas de grados de menor a mayor (lo desconocido al final, por orden alfabético)
const ordenGrados = (a, b) => {
  const x = posEscalera(a),
    y = posEscalera(b);
  return (x < 0 ? 99 : x) - (y < 0 ? 99 : y) || String(a).localeCompare(String(b));
};
// ══════════════════════════════════════════════════════════
// HELPERS DE NIVEL
// ══════════════════════════════════════════════════════════
const GRADOS_PREESCOLAR = ["Maternal", "Nivel I", "Nivel II", "Nivel III"];
const GRADOS_PRIMARIA_LIST = ["1er Grado", "2do Grado", "3er Grado", "4to Grado", "5to Grado", "6to Grado"];
const GRADOS_MEDIA_LIST = ["1er Año", "2do Año", "3er Año", "4to Año", "5to Año"];
const LETRAS = ["A", "B", "C", "D", "E"];
function getNivel(grado) {
  if (!grado) return "media";
  grado = gradoCanon(grado) || grado; // «Preescolar I» y «Nivel I» son el mismo grado
  if (GRADOS_PREESCOLAR.includes(grado)) return "preescolar";
  if (GRADOS_PRIMARIA_LIST.includes(grado)) return "primaria";
  return "media";
}
// ── MATERIAS ──
const GRADOS_MG = ["1er Año", "2do Año", "3er Año", "4to Año", "5to Año"];
// ── INDICADORES ──
const GRADOS_PRIM = [
  "Maternal",
  "Nivel I",
  "Nivel II",
  "Nivel III",
  "1er Grado",
  "2do Grado",
  "3er Grado",
  "4to Grado",
  "5to Grado",
  "6to Grado",
];
const AREAS_MATERNAL = [
  "Lengua y Comunicación",
  "Pensamiento Matemático",
  "Exploración y Conocimiento del Mundo",
  "Desarrollo Personal y Social",
  "Educación Física",
  "Inglés",
  "Educación Estética",
];
const AREAS_PRIMARIA = [
  "Lengua y Literatura",
  "Matemáticas",
  "Ciencias Naturales y Tecnología",
  "Ciencias Sociales",
  "Educación Física",
  "Educación Estética",
  "Inglés",
];
