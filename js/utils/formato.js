// Formato de montos ($ y Bs.), números en formato venezolano y fechas.

// Todos los montos del sistema son $ de referencia. Los bolívares se muestran con fmtBs() (tasa BCV de cada operación).
const fmt = (v) => {
  if (v === null || v === undefined || isNaN(v)) return "$ 0,00";
  return "$ " + Number(v).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
// Parse Venezuelan format number string to float: "21.303,02" -> 21303.02
const parseFmt = (s) => {
  if (!s) return 0;
  const clean = String(s)
    .replace(/(Bs\.?|\$)\s*/g, "")
    .trim()
    .replace(/\./g, "")
    .replace(",", ".");
  return parseFloat(clean) || 0;
};
// Format input field as user types: Venezuelan format
function fmtInput(el) {
  let raw = el.value.replace(/[^0-9,]/g, "");
  // Allow only one comma
  const parts = raw.split(",");
  if (parts.length > 2) raw = parts[0] + "," + parts.slice(1).join("");
  // Limit decimals to 2
  if (parts[1] !== undefined) raw = parts[0] + "," + (parts[1] || "").slice(0, 2);
  // Format thousands
  const intPart = (raw.split(",")[0] || "").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const decPart = raw.includes(",") ? "," + (raw.split(",")[1] || "") : "";
  const pos = el.selectionStart;
  el.value = intPart + decPart;
}
const todayStr = () => {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}; // fecha LOCAL (no UTC)
const genFac = () => "FAC-" + Date.now().toString().slice(-7);
const mesActual = () => new Date().getMonth();
const anioActual = () => new Date().getFullYear();
const calcEdad = (fn) => {
  if (!fn) return "";
  const hoy = new Date(),
    nac = new Date(fn);
  let e = hoy.getFullYear() - nac.getFullYear();
  if (hoy < new Date(hoy.getFullYear(), nac.getMonth(), nac.getDate())) e--;
  return e;
};
const promedio = (notas) => {
  const v = notas.filter((n) => n !== null && n !== "");
  return v.length ? Math.round((v.reduce((a, b) => a + parseFloat(b), 0) / v.length) * 10) / 10 : null;
};
const colorNota = (n) => {
  if (n === null) return "#888";
  if (n >= 18) return "#1a9e5c";
  if (n >= 14) return "#b8860b";
  return "#e53e3e";
};
function diaAnterior(f) {
  const d = new Date(f + "T00:00:00");
  d.setDate(d.getDate() - 1);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
const r2 = (n) => Math.round((Number(n) || 0) * 100 + (Number(n) >= 0 ? 1e-9 : -1e-9)) / 100;
const fmtBs = (v) =>
  "Bs. " + Number(v || 0).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtTasa = (v) => Number(v).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
const fmtUSD = fmt;
const fechaCorta = (s) => {
  if (!s) return "";
  const [y, m, d] = s.split("-");
  return d + "/" + m + "/" + y;
};
const hoyLocal = () => todayStr();
const diasEntre = (a, b) => Math.round((new Date(b + "T00:00:00") - new Date(a + "T00:00:00")) / 86400000);
function sumarMeses(ym, k) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + k, 1);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
}
const nombreMesYM = (ym) => MESES[Number(ym.split("-")[1]) - 1] + " " + ym.split("-")[0];
