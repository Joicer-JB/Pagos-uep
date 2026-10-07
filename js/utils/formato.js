// Formato de montos ($ y Bs.), números en formato venezolano y fechas.

// Todos los montos del sistema son $ de referencia. Los bolívares se muestran con fmtBs() (tasa BCV de cada operación).
const fmt = (v) => {
  if (v === null || v === undefined || isNaN(v)) return "$ 0,00";
  return "$ " + Number(v).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
// Convierte un número en formato venezolano a número: "21.303,02" → 21303.02
const parseFmt = (s) => {
  if (!s) return 0;
  const clean = String(s)
    .replace(/(Bs\.?|\$)\s*/g, "")
    .trim()
    .replace(/\./g, "")
    .replace(",", ".");
  return parseFloat(clean) || 0;
};
// Da formato venezolano (1.234,56) a un campo mientras el usuario escribe
function fmtInput(el) {
  let raw = el.value.replace(/[^0-9,]/g, "");
  // Solo una coma decimal
  const parts = raw.split(",");
  if (parts.length > 2) raw = parts[0] + "," + parts.slice(1).join("");
  // Máximo 2 decimales
  if (parts[1] !== undefined) raw = parts[0] + "," + (parts[1] || "").slice(0, 2);
  // Separador de miles
  const intPart = (raw.split(",")[0] || "").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const decPart = raw.includes(",") ? "," + (raw.split(",")[1] || "") : "";
  el.value = intPart + decPart;
}
// Fecha de hoy como "YYYY-MM-DD" en hora LOCAL (no UTC: de noche en Venezuela UTC ya es el día siguiente)
const todayStr = () => {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
};
// Número de recibo: "FAC-" + los últimos 7 dígitos de la hora actual en milisegundos
const genFac = () => "FAC-" + Date.now().toString().slice(-7);
// Mes actual (0 = enero … 11 = diciembre)
const mesActual = () => new Date().getMonth();
const anioActual = () => new Date().getFullYear();
// Edad en años cumplidos a partir de la fecha de nacimiento ("" si no hay fecha)
const calcEdad = (fn) => {
  if (!fn) return "";
  const hoy = new Date(),
    nac = new Date(fn);
  let e = hoy.getFullYear() - nac.getFullYear();
  if (hoy < new Date(hoy.getFullYear(), nac.getMonth(), nac.getDate())) e--;
  return e;
};
// Promedio de notas con un decimal, ignorando las vacías (null si no hay ninguna)
const promedio = (notas) => {
  const v = notas.filter((n) => n !== null && n !== "");
  return v.length ? Math.round((v.reduce((a, b) => a + parseFloat(b), 0) / v.length) * 10) / 10 : null;
};
// Color de una nota sobre 20: verde desde 18, dorado desde 14, rojo por debajo
const colorNota = (n) => {
  if (n === null) return "#888";
  if (n >= 18) return "#1a9e5c";
  if (n >= 14) return "#b8860b";
  return "#e53e3e";
};
// Día anterior a una fecha "YYYY-MM-DD"
function diaAnterior(f) {
  const d = new Date(f + "T00:00:00");
  d.setDate(d.getDate() - 1);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
// Redondea a 2 decimales (céntimos) evitando errores como 0,1 + 0,2 = 0,30000000000000004
const r2 = (n) => Math.round((Number(n) || 0) * 100 + (Number(n) >= 0 ? 1e-9 : -1e-9)) / 100;
// Formato en bolívares: "Bs. 1.234,56"
const fmtBs = (v) =>
  "Bs. " + Number(v || 0).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// Formato de la tasa BCV con hasta 4 decimales: "396,3674"
const fmtTasa = (v) => Number(v).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
const fmtUSD = fmt;
// "2026-10-07" → "07/10/2026"
const fechaCorta = (s) => {
  if (!s) return "";
  const [y, m, d] = s.split("-");
  return d + "/" + m + "/" + y;
};
const hoyLocal = () => todayStr();
// Días entre dos fechas "YYYY-MM-DD" (b - a)
const diasEntre = (a, b) => Math.round((new Date(b + "T00:00:00") - new Date(a + "T00:00:00")) / 86400000);
// Suma k meses a un mes "YYYY-MM"
function sumarMeses(ym, k) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + k, 1);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
}
// "2026-10" → "Octubre 2026"
const nombreMesYM = (ym) => MESES[Number(ym.split("-")[1]) - 1] + " " + ym.split("-")[0];
