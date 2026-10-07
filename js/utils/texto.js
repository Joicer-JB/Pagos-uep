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
