// Formato de montos, números venezolanos y fechas (js/utils/formato.js)
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { cargar } = require("./cargar");

const app = cargar("js/config.js", "js/utils/formato.js");
const f = (codigo) => app.evaluar(codigo);

test("fmt: $ con separador de miles y 2 decimales", () => {
  assert.equal(f("fmt(1234.5)"), "$ 1.234,50");
  assert.equal(f("fmt(0)"), "$ 0,00");
  assert.equal(f("fmt(null)"), "$ 0,00");
  assert.equal(f("fmt(undefined)"), "$ 0,00");
  assert.equal(f("fmt(-80)"), "$ -80,00");
});

test("fmtBs y fmtTasa", () => {
  assert.equal(f("fmtBs(8156.25)"), "Bs. 8.156,25");
  assert.equal(f("fmtBs(null)"), "Bs. 0,00");
  assert.equal(f("fmtTasa(396.3674)"), "396,3674");
  assert.equal(f("fmtTasa(184.5)"), "184,50");
});

test("parseFmt: lee números escritos en formato venezolano", () => {
  assert.equal(f('parseFmt("21.303,02")'), 21303.02);
  assert.equal(f('parseFmt("Bs. 1.000")'), 1000);
  assert.equal(f('parseFmt("$ 45,5")'), 45.5);
  assert.equal(f('parseFmt("")'), 0);
  assert.equal(f('parseFmt("abc")'), 0);
});

test("r2: redondea a céntimos sin errores de coma flotante", () => {
  assert.equal(f("r2(0.1 + 0.2)"), 0.3);
  assert.equal(f("r2(1.005)"), 1.01);
  assert.equal(f("r2(-1.005)"), -1.01);
  assert.equal(f("r2(45 * 181.25)"), 8156.25);
  assert.equal(f("r2(null)"), 0);
});

test("fmtInput: da formato mientras se escribe", () => {
  const campo = (valor) => {
    const el = { value: valor, selectionStart: 0 };
    app.fmtInput(el);
    return el.value;
  };
  assert.equal(campo("1234567"), "1.234.567");
  assert.equal(campo("1234,567"), "1.234,56");
  assert.equal(campo("12,345"), "12,34");
  assert.equal(campo("abc45"), "45");
});

test("fechas: fechaCorta, diasEntre, diaAnterior", () => {
  assert.equal(f('fechaCorta("2026-10-07")'), "07/10/2026");
  assert.equal(f('fechaCorta("")'), "");
  assert.equal(f('diasEntre("2026-09-28","2026-10-07")'), 9);
  assert.equal(f('diasEntre("2026-10-07","2026-10-07")'), 0);
  assert.equal(f('diaAnterior("2026-03-01")'), "2026-02-28");
  assert.equal(f('diaAnterior("2028-03-01")'), "2028-02-29");
  assert.equal(f('diaAnterior("2027-01-01")'), "2026-12-31");
});

test("meses: sumarMeses cruza el año y nombreMesYM da el nombre", () => {
  assert.equal(f('sumarMeses("2026-09", 3)'), "2026-12");
  assert.equal(f('sumarMeses("2026-09", 4)'), "2027-01");
  assert.equal(f('sumarMeses("2026-09", 0)'), "2026-09");
  assert.equal(f('nombreMesYM("2026-10")'), "Octubre 2026");
  assert.equal(f('nombreMesYM("2027-01")'), "Enero 2027");
});

test("todayStr: fecha local en formato YYYY-MM-DD", () => {
  const hoy = new Date();
  const esperado = [hoy.getFullYear(), hoy.getMonth() + 1, hoy.getDate()]
    .map((n) => String(n).padStart(2, "0"))
    .join("-");
  assert.equal(f("todayStr()"), esperado);
});

test("promedio y colorNota", () => {
  assert.equal(f('promedio(["15","18",""])'), 16.5);
  assert.equal(f("promedio([])"), null);
  assert.equal(f('promedio(["10","11","11"])'), 10.7);
  assert.equal(f("colorNota(18)"), "#1a9e5c");
  assert.equal(f("colorNota(14)"), "#b8860b");
  assert.equal(f("colorNota(9)"), "#e53e3e");
  assert.equal(f("colorNota(null)"), "#888");
});
