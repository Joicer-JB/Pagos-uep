// Utilidades de texto: escapar HTML, quitar acentos, validar correos y normalizar teléfonos de Venezuela.

// Quita tildes y diéresis: "Pérez" → "Perez"
const sinAcento = (s) =>
  String(s == null ? "" : s)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
// Nombre normalizado para comparar (sin tildes, minúsculas, sin signos): sirve para detectar duplicados
const claveNombre = (s) =>
  sinAcento(s)
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
// Igual que claveNombre, pero no importa el orden de las palabras ni las partículas (de, del, la, y…):
// «Pérez López, José» y «Jose Perez Lopez» dan la misma clave. Sirve para detectar al mismo estudiante escrito de otra forma.
const PARTICULAS_NOMBRE = ["de", "del", "la", "las", "los", "y", "e"];
const claveNombreSinOrden = (s) =>
  claveNombre(s)
    .split(" ")
    .filter((t) => t && !PARTICULAS_NOMBRE.includes(t))
    .sort()
    .join(" ");
// ---- Teléfonos de Venezuela para WhatsApp
// Acepta 0412-1234567, +58 412 123 4567, 58 0412 1234567, 0058 412..., 4121234567. Devuelve 58 + 10 dígitos, o "" si no es válido.
function normalizarTelVE(t) {
  let d = String(t || "").replace(/\D/g, "");
  if (!d) return "";
  d = d.replace(/^00/, "");
  d = d.startsWith("58") ? "58" + d.slice(2).replace(/^0+/, "") : "58" + d.replace(/^0+/, "");
  return /^58[24]\d{9}$/.test(d) ? d : "";
}
// "584121234567" → "+58 412 123 4567"
const fmtTelVE = (wa) => (wa ? "+58 " + wa.slice(2, 5) + " " + wa.slice(5, 8) + " " + wa.slice(8) : "");
// ¿Tiene forma de correo electrónico? (algo@dominio.ext)
const correoValido = (c) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(c || "").trim());
// Escapa un texto para mostrarlo dentro de HTML (evita que un nombre con < > " ' & rompa la página o ejecute código).
const escHtml = (t) =>
  String(t == null ? "" : t)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
// Para meter un texto dentro de un string de JavaScript que va en un atributo onclick="...('…')".
// Primero se escapan \ ' y saltos de línea para JavaScript, y luego todo para HTML.
const escJs = (t) =>
  escHtml(
    String(t == null ? "" : t)
      .replace(/\\/g, "\\\\")
      .replace(/'/g, "\\'")
      .replace(/\r?\n/g, "\\n")
  );

// Orden alfabético de estudiantes (o cualquier lista con «nombre»), como en un diccionario: sin importar
// mayúsculas ni tildes (Ángel va con la A)
const ordenNombre = (a, b) =>
  String((a && a.nombre) || "").localeCompare(String((b && b.nombre) || ""), "es", { sensitivity: "base" });

// ---- Números en letras, para documentos formales: 12345,5 → «doce mil trescientos cuarenta y cinco con 50/100»
const LETRAS_UNIDAD = ["", "un", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve"];
const LETRAS_10_29 = [
  "diez",
  "once",
  "doce",
  "trece",
  "catorce",
  "quince",
  "dieciséis",
  "diecisiete",
  "dieciocho",
  "diecinueve",
  "veinte",
  "veintiún",
  "veintidós",
  "veintitrés",
  "veinticuatro",
  "veinticinco",
  "veintiséis",
  "veintisiete",
  "veintiocho",
  "veintinueve",
];
const LETRAS_DECENA = ["", "", "", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"];
const LETRAS_CENTENA = [
  "",
  "ciento",
  "doscientos",
  "trescientos",
  "cuatrocientos",
  "quinientos",
  "seiscientos",
  "setecientos",
  "ochocientos",
  "novecientos",
];
function letrasMenorMil(n) {
  if (n === 100) return "cien";
  const c = Math.floor(n / 100),
    r = n % 100,
    d = Math.floor(r / 10),
    u = r % 10;
  const resto =
    r < 10 ? LETRAS_UNIDAD[r] : r < 30 ? LETRAS_10_29[r - 10] : LETRAS_DECENA[d] + (u ? " y " + LETRAS_UNIDAD[u] : "");
  return [LETRAS_CENTENA[c], resto].filter(Boolean).join(" ");
}
// La parte entera en letras (hasta 999.999.999); «un» y «veintiún» como se dice delante de un sustantivo
function numeroEnLetras(n) {
  n = Math.floor(Math.abs(Number(n) || 0));
  if (n === 0) return "cero";
  const millones = Math.floor(n / 1e6),
    miles = Math.floor((n % 1e6) / 1000),
    resto = n % 1000;
  return [
    millones ? (millones === 1 ? "un millón" : letrasMenorMil(millones) + " millones") : "",
    miles ? (miles === 1 ? "mil" : letrasMenorMil(miles) + " mil") : "",
    resto ? letrasMenorMil(resto) : "",
  ]
    .filter(Boolean)
    .join(" ");
}
// «setenta y tres mil ochocientos bolívares con 50/100» («un millón de bolívares» lleva «de»)
function montoEnLetras(n, moneda) {
  const entero = Math.floor(Math.abs(Number(n) || 0) + 1e-9);
  const cent = Math.round((Math.abs(Number(n) || 0) - entero) * 100);
  const letras = numeroEnLetras(entero);
  const de = entero >= 1e6 && entero % 1e6 === 0 ? " de" : "";
  return letras + de + " " + moneda + " con " + String(cent).padStart(2, "0") + "/100";
}
