// Horarios: el horario de cada grado de Primaria (por materia, para ver e imprimir) y la carga de una vez de los
// horarios de las fotos de noviembre de 2026 (Media general y especialistas, en la ficha de cada profesor).
//
// · El horario de un grado está en config/horarios: { "1er Grado": { filas: [{desde, hasta, celdas: [lun…vie]} |
//   {desde, hasta, receso: true}] } }. Lo edita el director en Nómina → 🗓️ Horarios.
// · Las clases de Media general y de los especialistas van en la ficha de cada trabajador (clases: materia, grados,
//   días, desde, hasta), como si se escribieran a mano; así salen en 📚 Clases, en la sábana y en el boletín.

const HORARIO_DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie"];
const fila = (desde, hasta, celdas) => ({ desde, hasta, celdas });
const receso = (desde, hasta) => ({ desde, hasta, receso: true });

// ---- Primaria: lo que dicen las fotos de cada grado. Donde la foto no se leía, va la lectura más probable (Joicer
// pidió cargarlo así y corregirlo él si algo cambia).
const HORARIOS_FOTOS_GRADOS = {
  "1er Grado": {
    filas: [
      fila("07:40", "08:20", ["Inglés", "Portugués", "Matemática", "Lengua", "Educación Artística"]),
      fila("08:20", "09:00", ["Caligrafía", "Educación Física", "Matemática", "Lengua", "Educación Artística"]),
      receso("09:00", "09:30"),
      fila("09:30", "10:10", [
        "Matemática",
        "Computación",
        "Ciencia de la Naturaleza",
        "Ciencias Sociales",
        "Lecto-escritura",
      ]),
      fila("10:10", "10:50", [
        "Matemática",
        "Lengua",
        "Ciencia de la Naturaleza",
        "Ciencias Sociales",
        "Lecto-escritura",
      ]),
      fila("10:50", "11:30", ["Lectura", "Lengua", "Caligrafía", "Lectura", "Lecto-escritura"]),
    ],
  },
  "2do Grado": {
    filas: [
      fila("07:30", "07:50", ["Caligrafía", "Caligrafía", "Caligrafía", "Caligrafía y Lectura", "Estética"]),
      fila("07:50", "08:30", ["Lenguaje", "Lengua", "Matemáticas", "Ciencias Naturales", "Estética"]),
      fila("08:30", "09:00", [
        "Inglés",
        "Educación Física",
        "Matemáticas",
        "Ciencias Naturales",
        "Actividades Culturales y Recreativas",
      ]),
      receso("09:00", "09:30"),
      fila("09:30", "10:00", [
        "Lenguaje",
        "Lengua",
        "Ciencias Sociales",
        "Lenguaje",
        "Actividades Recreativas y Culturales",
      ]),
      fila("10:00", "10:40", [
        "Matemáticas",
        "Portugués",
        "Ciencias Sociales",
        "Lenguaje",
        "Actividades Recreativas y Culturales",
      ]),
      fila("10:40", "11:20", ["", "Computación", "Lectura", "Lectura", "Actividades Recreativas y Culturales"]),
    ],
  },
  "3er Grado": {
    filas: [
      fila("07:00", "07:50", ["Acto cívico", "Acto cívico", "Acto cívico", "Acto cívico", "Acto cívico"]),
      fila("07:50", "08:30", ["Lectura", "Computación", "Lectura", "Ciencias Naturales", "Lengua"]),
      fila("08:30", "09:00", ["Lengua", "Portugués", "Lengua", "Ciencias Naturales", "Matemáticas"]),
      receso("09:00", "09:30"),
      fila("10:00", "10:40", ["Inglés", "Lectura", "Matemáticas", "Ciencias Sociales", "Educación Estética"]),
      fila("10:40", "11:20", ["Lengua", "Educación Física", "Matemáticas", "Ciencias Sociales", "Educación Estética"]),
    ],
  },
  "4to Grado": {
    filas: [
      fila("07:30", "07:50", ["Caligrafía", "Atención", "Lectura", "Lectura", "Caligrafía"]),
      fila("07:50", "08:30", ["Lenguaje", "Lectura comprensiva", "Matemática", "Lenguaje", "Educación Estética"]),
      fila("08:30", "09:00", ["Lenguaje", "Computación", "Matemática", "Lenguaje", "Educación Estética"]),
      fila("09:00", "09:30", [
        "Ciencias Naturales",
        "Dictado",
        "Ciencias Sociales",
        "Matemática",
        "Actividades Culturales y Recreativas",
      ]),
      receso("09:30", "10:00"),
      fila("10:00", "10:40", [
        "Ciencias Naturales",
        "Educación Física",
        "Ciencias Sociales",
        "Matemática",
        "Actividades Culturales y Recreativas",
      ]),
      fila("10:40", "11:20", ["Inglés", "Portugués", "Caligrafía", "Dictado", "Salida: 11:00 a. m."]),
    ],
  },
  "5to Grado": {
    filas: [
      fila("07:30", "08:00", ["Caligrafía", "Caligrafía", "Caligrafía", "Caligrafía", "Caligrafía"]),
      fila("08:00", "08:30", [
        "Lenguaje",
        "Matemática",
        "Portugués",
        "Educación Física",
        "Educación Estética (Tejido)",
      ]),
      fila("08:30", "09:00", [
        "Lenguaje",
        "Matemática",
        "Computación",
        "Ciencias Sociales",
        "Educación Estética (Manualidades)",
      ]),
      receso("09:00", "10:00"),
      fila("10:00", "10:40", [
        "Ciencias Naturales",
        "Conversación socializada (diversos temas)",
        "Inglés",
        "Matemática",
        "Educación Estética (Repostería)",
      ]),
      fila("10:40", "11:20", ["Lectura", "Lectura", "Lectura", "Lectura", "Lectura"]),
    ],
  },
  "6to Grado": {
    filas: [
      fila("07:30", "08:00", [
        "Caligrafía",
        "Ejercicio de atención",
        "Caligrafía",
        "Ejercicio de atención",
        "Caligrafía",
      ]),
      fila("08:00", "08:30", ["Lenguaje", "Matemática", "Computación", "Matemática", "Matemática"]),
      fila("08:30", "09:00", ["Lenguaje", "Matemática", "Portugués", "Educación Física", "Matemática"]),
      fila("09:00", "09:30", [
        "Ciencias Naturales",
        "Ciencias Sociales",
        "Lenguaje",
        "Matemática",
        "Educación Estética",
      ]),
      receso("09:30", "10:00"),
      fila("10:00", "10:40", ["Ciencias Naturales", "Lenguaje", "Lenguaje", "Matemática", "Educación Estética"]),
      fila("10:40", "11:20", ["Lectura comprensiva", "Lectura comprensiva", "Inglés", "Lectura comprensiva", ""]),
    ],
  },
};

// ---- Media general: la hoja de cada profesor (solo dice el primer nombre). Bloques de la tarde.
const BLOQUES_MG = {
  A: ["11:00", "12:20"],
  B: ["12:20", "13:40"],
  C: ["13:40", "15:00"],
  D: ["15:20", "16:40"],
  E: ["16:40", "18:00"],
};
// [día, bloque, año (1 a 5), materia]
const HORARIOS_FOTOS_MG = [
  {
    nombre: "Oliver",
    clases: [
      ["Lun", "A", 1, "Educación Física"],
      ["Lun", "B", 4, "Educación Física"],
      ["Mar", "A", 2, "Educación Física"],
      ["Mar", "B", 3, "Educación Física"],
      ["Mié", "A", 3, "Educación Física"],
      ["Mié", "B", 2, "Educación Física"],
      ["Jue", "A", 5, "Educación Física"],
      ["Jue", "B", 4, "Educación Física"],
      ["Vie", "A", 5, "Educación Física"],
      ["Vie", "B", 1, "Educación Física"],
    ],
  },
  {
    nombre: "Germán",
    clases: [
      ["Mar", "C", 4, "Química"],
      ["Jue", "C", 3, "Química"],
      ["Vie", "C", 4, "Química"],
      ["Mar", "D", 5, "Química"],
      ["Jue", "D", 5, "Química"],
      ["Mar", "E", 3, "Química"],
    ],
  },
  {
    nombre: "Angel",
    clases: [
      ["Lun", "C", 1, "Inglés"],
      ["Mar", "C", 2, "Inglés"],
      ["Lun", "D", 5, "Inglés"],
      ["Mar", "D", 4, "Inglés"],
      ["Lun", "E", 3, "Inglés"],
    ],
  },
  {
    nombre: "Frank",
    clases: [
      ["Mar", "B", 4, "Física"],
      ["Vie", "B", 4, "Física"],
      ["Lun", "C", 5, "Física"],
      ["Mar", "C", 5, "Física"],
      ["Vie", "C", 5, "Matemáticas"],
      ["Vie", "D", 1, "Matemáticas"],
      ["Lun", "E", 1, "Matemáticas"],
      ["Mar", "E", 5, "Matemáticas"],
    ],
  },
  {
    nombre: "Jaime",
    clases: [
      ["Lun", "B", 3, "Matemáticas"],
      ["Vie", "B", 3, "Matemáticas"],
      ["Lun", "C", 2, "Matemáticas"],
      ["Mié", "C", 4, "Matemáticas"],
      ["Vie", "C", 2, "Matemáticas"],
      ["Lun", "D", 3, "Física"],
      ["Mié", "D", 3, "Física"],
      ["Vie", "D", 4, "Matemáticas"],
    ],
  },
  {
    nombre: "Rossana",
    clases: [
      ["Lun", "B", 1, "GHC"],
      ["Mié", "B", 1, "Orientación y Convivencia"],
      ["Jue", "B", 2, "GHC"],
      ["Lun", "C", 4, "GHC"],
      ["Mié", "C", 5, "GHC"],
      ["Jue", "C", 1, "GHC"],
      ["Lun", "D", 2, "GHC"],
      ["Mié", "D", 5, "Ciencias de la Tierra"],
      ["Jue", "D", 3, "GHC"],
      ["Lun", "E", 5, "FSN"],
      ["Mié", "E", 3, "GHC"],
      ["Jue", "E", 4, "FSN"],
    ],
  },
  {
    nombre: "Migledis",
    clases: [
      ["Lun", "B", 2, "Ciencias Naturales"],
      ["Jue", "B", 5, "Metodología"],
      ["Vie", "B", 5, "Biología"],
      ["Jue", "C", 4, "Biología"],
      ["Vie", "C", 1, "Ciencias Naturales"],
      ["Lun", "D", 4, "Biología"],
      ["Mar", "D", 2, "Ciencias Naturales"],
      ["Jue", "D", 1, "Ciencias Naturales"], // la hoja no dice el año: 1er año es el único libre a esa hora
      ["Vie", "D", 3, "Biología"],
      ["Lun", "E", 4, "Orientación y Convivencia"],
      ["Jue", "E", 3, "Biología"],
    ],
  },
  {
    nombre: "Yetselin",
    clases: [
      ["Mié", "B", 3, "CRP"],
      ["Jue", "B", 1, "CRP"],
      ["Vie", "B", 2, "Orientación y Convivencia"],
      ["Mié", "C", 1, "CRP"],
      ["Jue", "C", 5, "CRP"],
      ["Vie", "C", 3, "CRP"],
      ["Mié", "D", 2, "CRP"],
      ["Jue", "D", 2, "CRP"],
      ["Mié", "E", 4, "CRP"],
    ],
  },
  {
    nombre: "Kenny",
    clases: [
      ["Mar", "B", 5, "Orientación y Convivencia"],
      ["Mié", "B", 5, "Castellano"],
      ["Jue", "B", 3, "Castellano"],
      ["Mar", "C", 1, "Castellano"],
      ["Mié", "C", 2, "Castellano"],
      ["Jue", "C", 2, "Castellano"],
      ["Mar", "D", 3, "Castellano"],
      ["Mié", "D", 1, "Castellano"],
      ["Jue", "D", 4, "Castellano"],
      ["Mar", "E", 4, "Castellano"],
      ["Jue", "E", 5, "Castellano"],
    ],
  },
  {
    nombre: "Nelson",
    clases: [
      ["Mié", "B", 4, "Turismo"],
      ["Mié", "C", 3, "Turismo"],
      ["Mié", "E", 5, "Turismo"],
    ],
  },
];

// ---- Especialistas de Inicial y Primaria (la hoja no trae nombres: el director elige quién es cada uno).
// [día, desde, hasta, grados]. El miércoles 8:30 la hoja decía «Portugués 5to» por segunda vez: es 6to (así está en la
// hoja de 6to). El martes 10:40 decía «Computación 5to»: es 2do (5to tiene Lectura y 2do no tenía Computación).
const HORARIOS_FOTOS_ESPECIALISTAS = {
  Inglés: [
    ["Lun", "07:30", "08:00", ["Maternal", "Nivel I"]],
    ["Mar", "07:30", "08:00", ["Nivel II"]],
    ["Mié", "07:30", "08:00", ["Nivel III"]],
    ["Lun", "07:50", "08:30", ["1er Grado"]],
    ["Lun", "08:30", "09:10", ["2do Grado"]],
    ["Lun", "10:00", "10:40", ["3er Grado"]],
    ["Lun", "10:40", "11:20", ["4to Grado"]],
    ["Mié", "10:00", "10:40", ["5to Grado"]],
    ["Mié", "10:40", "11:20", ["6to Grado"]],
  ],
  Computación: [
    ["Mar", "07:50", "08:30", ["3er Grado"]],
    ["Mié", "07:50", "08:30", ["6to Grado"]],
    ["Mar", "08:30", "09:10", ["4to Grado"]],
    ["Mié", "08:30", "09:10", ["5to Grado"]],
    ["Mar", "10:00", "10:40", ["1er Grado"]],
    ["Mar", "10:40", "11:20", ["2do Grado"]],
  ],
  Portugués: [
    ["Mar", "07:50", "08:30", ["1er Grado"]],
    ["Mié", "07:50", "08:30", ["5to Grado"]],
    ["Mar", "08:30", "09:10", ["3er Grado"]],
    ["Mié", "08:30", "09:10", ["6to Grado"]],
    ["Mar", "10:00", "10:40", ["2do Grado"]],
    ["Mar", "10:40", "11:20", ["4to Grado"]],
  ],
  "Educación Física": [
    ["Jue", "07:50", "08:30", ["5to Grado"]],
    ["Mar", "08:30", "09:10", ["1er Grado", "2do Grado"]],
    ["Jue", "08:30", "09:10", ["6to Grado"]],
    ["Mar", "10:00", "10:40", ["4to Grado"]],
    ["Jue", "10:00", "10:40", ["Maternal", "Nivel I"]],
    ["Mar", "10:40", "11:20", ["3er Grado"]],
    ["Jue", "10:40", "11:20", ["Nivel II", "Nivel III"]],
  ],
};
const ESPECIALIDADES = [
  ["Inglés", "Inglés (el de la mañana)"],
  ["Computación", "Computación"],
  ["Portugués", "Portugués"],
  ["Educación Física", "Educación Física de Inicial y Primaria"],
];

// ---- Nombres de las materias de Media general: las hojas usan siglas; se usa el nombre que ya tiene el año en
// Configuración → Materias (así las notas y el boletín encuentran al profesor). Si no está, el nombre completo.
const NOMBRES_MATERIA = {
  GHC: ["Geografía, Historia y Ciudadanía", "GHC"],
  FSN: ["Formación para la Soberanía Nacional", "FSN"],
  CRP: [
    "Participación en Grupos de Creación, Recreación y Producción",
    "Grupos de Creación, Recreación y Producción",
    "Creación, Recreación y Producción",
    "CRP",
  ],
  "Orientación y Convivencia": ["Orientación y Convivencia", "Orient. y C.", "Orientación"],
  Castellano: ["Castellano", "Castellano y Literatura", "Lengua y Literatura"],
  "Educación Física": ["Educación Física", "Educación Física y Deporte", "Educ. Física"],
  Matemáticas: ["Matemáticas", "Matemática"],
  Turismo: ["Turismo", "Turismo y Fotografía"],
  "Ciencias Naturales": ["Ciencias Naturales", "Ciencias de la Naturaleza"],
};
const normHorario = (s) =>
  sinAcento(s)
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
// «Geografía, Historia y Ciudadanía» → «GHC» (sin y, de, la, para…)
const siglas = (s) =>
  normHorario(s)
    .split(" ")
    .filter((p) => p && !["y", "de", "la", "el", "los", "las", "para", "en", "del"].includes(p))
    .map((p) => p[0])
    .join("")
    .toUpperCase();
// → { nombre, enConfig }
function nombreMateriaMG(clave, materiasDelAnio) {
  const lista = Array.isArray(materiasDelAnio) ? materiasDelAnio : [];
  const alias = (NOMBRES_MATERIA[clave] || [clave]).map(normHorario);
  const hallada =
    lista.find((m) => alias.includes(normHorario(m))) ||
    (/^[A-Z]{2,5}$/.test(clave) ? lista.find((m) => siglas(m) === clave || siglas(m).endsWith(clave)) : undefined);
  return hallada
    ? { nombre: hallada, enConfig: true }
    : { nombre: (NOMBRES_MATERIA[clave] || [clave])[0], enConfig: false };
}

// Junta los bloques de una misma materia, grado(s) y hora en una sola clase con varios días
function agruparClases(bloques) {
  const mapa = new Map();
  for (const b of bloques) {
    const k = [b.materia, b.grados.join("|"), b.desde, b.hasta].join("§");
    if (!mapa.has(k))
      mapa.set(k, { materia: b.materia, grados: [...b.grados], dias: [], desde: b.desde, hasta: b.hasta });
    const c = mapa.get(k);
    if (!c.dias.includes(b.dia)) c.dias.push(b.dia);
  }
  const ordenDia = (d) => DIAS_SEMANA.indexOf(d);
  return [...mapa.values()]
    .map((c) => ({ ...c, dias: c.dias.sort((a, b) => ordenDia(a) - ordenDia(b)) }))
    .sort(
      (a, b) =>
        ESCALERA.indexOf(a.grados[0]) - ESCALERA.indexOf(b.grados[0]) ||
        a.materia.localeCompare(b.materia) ||
        a.desde.localeCompare(b.desde)
    );
}
// Clases de un profesor de Media general según su hoja (con los nombres de materia de Configuración)
function clasesFotoMG(prof, materias) {
  return agruparClases(
    prof.clases.map(([dia, bloque, anio, materia]) => {
      const grado = GRADOS_MG[anio - 1];
      return {
        dia,
        materia: nombreMateriaMG(materia, (materias || {})[grado]).nombre,
        grados: [grado],
        desde: BLOQUES_MG[bloque][0],
        hasta: BLOQUES_MG[bloque][1],
      };
    })
  );
}
function clasesFotoEspecialista(materia) {
  return agruparClases(
    (HORARIOS_FOTOS_ESPECIALISTAS[materia] || []).map(([dia, desde, hasta, grados]) => ({
      dia,
      materia,
      grados,
      desde,
      hasta,
    }))
  );
}
// Trabajadores activos cuyo nombre empieza o contiene ese primer nombre (sin tildes)
function buscarPorPrimerNombre(nombre, lista) {
  const n = normHorario(nombre);
  return (lista || []).filter((t) => t.activo !== false && normHorario(t.nombre).split(" ").includes(n));
}
// Una clase ya está si coincide en todo (así cargar dos veces no duplica)
const claveClase = (c) =>
  [
    normHorario(c.materia),
    [...(c.grados || [])].sort().join("|"),
    [...(c.dias || [])].sort().join("|"),
    c.desde || "",
    c.hasta || "",
  ].join("§");
function sumarClases(existentes, nuevas) {
  const ya = new Set((existentes || []).map(claveClase));
  const agregar = nuevas.filter((c) => !ya.has(claveClase(c)));
  return { lista: [...(existentes || []), ...agregar], agregadas: agregar.length };
}
// Revisa un horario de grado antes de guardarlo: "" si está bien
function revisarHorarioGrado(h) {
  const filas = (h && h.filas) || [];
  for (let i = 0; i < filas.length; i++) {
    const f = filas[i];
    const a = minutosHora(f.desde),
      b = minutosHora(f.hasta);
    if (a == null || b == null) return "Fila " + (i + 1) + ": escribe la hora de inicio y la de salida";
    if (b <= a) return "Fila " + (i + 1) + ": la hora de salida debe ser después de la de inicio";
  }
  return "";
}
