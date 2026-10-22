// Referencias de pago (transferencias y pago móvil) y conciliación con el estado de cuenta del banco.
//
// Una referencia se compara por sus cifras: el banco muestra la completa (p. ej. 000123456789) y en caja a veces se
// anotan solo las últimas; son la misma si una termina en la otra (con al menos 6 cifras para avisar de un pago
// repetido, y 4 para casar con el banco, donde además debe coincidir el monto).

const refDigitos = (r) => String(r == null ? "" : r).replace(/\D/g, "");
function mismaReferencia(a, b, min) {
  const x = refDigitos(a),
    y = refDigitos(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const [corta, larga] = x.length <= y.length ? [x, y] : [y, x];
  return corta.length >= (min || 6) && larga.endsWith(corta);
}
// Las transferencias de un pago: la suya o, en un pago mixto, la de esa forma de pago
const refsTransferencia = (p) => (p.metodo === "Transferencia Bs" && p.referencia ? [String(p.referencia)] : []);
// Recibos ya registrados con esa referencia de transferencia (uno por recibo; sin contar `sinFactura`)
function recibosConReferencia(ref, sinFactura) {
  const porRecibo = new Map();
  pagos.forEach((p) => {
    if (!p.factura || p.factura === sinFactura) return;
    if (!refsTransferencia(p).some((r) => mismaReferencia(r, ref))) return;
    const x = porRecibo.get(p.factura) || { factura: p.factura, nombre: p.nombre, fecha: p.fecha, total: 0 };
    x.total = r2(x.total + (p.total || 0));
    porRecibo.set(p.factura, x);
  });
  return [...porRecibo.values()];
}
// Pregunta antes de registrar una referencia que ya se usó (false = no registrar)
function confirmarReferencia(ref) {
  const usados = recibosConReferencia(ref);
  if (!usados.length) return true;
  return confirm(
    "⚠️ La referencia " +
      ref +
      " ya se registró en:\n" +
      usados
        .map((u) => "• " + u.factura + " · " + (u.nombre || "") + " · " + fechaCorta(u.fecha) + " · " + fmt(u.total))
        .join("\n") +
      "\n\n¿Seguro que es un pago distinto?"
  );
}
// Referencias usadas en más de un recibo (entre los pagos cargados)
function referenciasRepetidas() {
  const grupos = [];
  pagos.forEach((p) =>
    refsTransferencia(p).forEach((ref) => {
      let g = grupos.find((x) => mismaReferencia(x.ref, ref));
      if (!g) grupos.push((g = { ref, recibos: [] }));
      let r = g.recibos.find((x) => x.factura === p.factura);
      if (!r) g.recibos.push((r = { factura: p.factura, nombre: p.nombre, fecha: p.fecha, total: 0 }));
      r.total = r2(r.total + (p.total || 0));
    })
  );
  return grupos.filter((g) => g.recibos.length > 1);
}

// ---- Conciliación: el estado de cuenta del banco (Excel o CSV) contra los cobros registrados por transferencia o
// pago móvil. Lo que entró al banco se casa con un recibo por la referencia (y el monto), o por el monto y la fecha.
// Quedan a la vista: lo que entró y nadie registró, lo registrado que no está en el banco y las referencias repetidas.
// Los cobros por punto de venta no se concilian uno por uno: el banco los abona juntos al cierre del lote.
// Títulos de columna que usan los bancos (sin tildes, en minúscula), en este orden: «Monto crédito» es crédito y no
// monto. Las columnas de saldo nunca se toman.
const COLUMNAS_BANCO = [
  ["fecha", /fecha|^f\.? ?(de )?(operacion|valor|transaccion|movimiento|mov|contable)\b|^dia$/],
  ["credito", /credito|abono|haber|ingreso|deposito|\(\+\)|^entradas?$/],
  ["debito", /debito|cargo|^debe$|egreso|retiro|\(-\)|^salidas?$/],
  ["tipo", /^tipo|naturaleza|^(d|c|db|cr) ?\/ ?(c|d|cr|db)$|^signo$|^(cr|db)$/],
  [
    "referencia",
    /referencia|^ref\b|^ref\.|^nro|^no\.? ?(de )?(ref|doc|operacion|comprobante)|^n[°º]|^num(ero)?\.?( de)? ?(ref|doc|documento|operacion|comprobante|transaccion)?$|^documento|^comprobante|^serial|^codigo$|^confirmacion/,
  ],
  ["descripcion", /descrip|concepto|detalle|transaccion|movimiento|observ|^glosa|^operacion$|^beneficiario|^ordenante/],
  ["monto", /monto|importe|valor|^bolivares|^bs\.?$|^cantidad/],
];
const NO_ES_COLUMNA = /saldo|disponible|diferido|bloqueado/;
const normCol = (v) =>
  sinAcento(String(v == null ? "" : v))
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
const esNumeroBanco = (v) => typeof v === "number" || (/\d/.test(String(v || "")) && !/[a-z]{3,}/i.test(String(v)));

// ---- Formatos recordados: si se corrigen las columnas de un archivo, la próxima vez que llegue uno con los mismos
// títulos (del mismo banco) se usan esas columnas. Se guarda en este equipo.
const CLAVE_FORMATOS_BANCO = "formatosBanco";
const firmaTitulos = (fila) => (fila || []).map(normCol).filter(Boolean).join("|");
function formatosBanco() {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_FORMATOS_BANCO) || "{}") || {};
  } catch (e) {
    return {};
  }
}
function recordarFormatoBanco(fila, col) {
  const firma = firmaTitulos(fila);
  if (!firma) return;
  try {
    const f = formatosBanco();
    f[firma] = col;
    localStorage.setItem(CLAVE_FORMATOS_BANCO, JSON.stringify(f));
  } catch (e) {
    /* sin almacenamiento: no se recuerda */
  }
}

// La fila de títulos (entre las primeras 40) y qué columna es cada cosa
function detectarColumnas(filas) {
  filas = filas || [];
  const recordados = formatosBanco();
  for (let i = 0; i < Math.min(40, filas.length); i++) {
    const col = recordados[firmaTitulos(filas[i])];
    if (col && col.fecha != null) return { fila: i, col: { ...col }, recordado: true };
  }
  let mejor = null;
  filas.slice(0, 40).forEach((fila, i) => {
    const col = columnasDeFila(filas, i);
    const n = Object.keys(col).length;
    if (col.fecha != null && (col.credito != null || col.monto != null) && (!mejor || n > mejor.n))
      mejor = { fila: i, col, n };
  });
  return mejor ? { fila: mejor.fila, col: mejor.col } : null;
}
// Qué columna es cada cosa, si la fila i fuera la de los títulos
function columnasDeFila(filas, i) {
  const col = {};
  (filas[i] || []).forEach((celda, j) => {
    const t = normCol(celda);
    if (!t || t.length > 50 || NO_ES_COLUMNA.test(t)) return;
    // «Débito/Crédito» o «C/D» en una sola columna: si debajo hay montos, es el monto con su signo; si no, el tipo
    if (/(debito|cargo).*(credito|abono)|(credito|abono).*(debito|cargo)/.test(t)) {
      const debajo = filas
        .slice(i + 1, i + 11)
        .map((f) => (f || [])[j])
        .filter((v) => v !== "" && v != null);
      const k = debajo.length && debajo.filter(esNumeroBanco).length > debajo.length / 2 ? "monto" : "tipo";
      if (col[k] == null) col[k] = j;
      return;
    }
    for (const [k, re] of COLUMNAS_BANCO) if (col[k] == null && re.test(t)) return void (col[k] = j);
  });
  return col;
}
// Un monto del banco: número, «1.234,56», «1,234.56», «Bs. 8.302,50», «-500,00», «500,00-», «(500,00)»,
// «1.234,56 D» o «1.234,56 Db» (débito: negativo)
function numeroBanco(v) {
  if (typeof v === "number") return isFinite(v) ? v : 0;
  const txt = String(v == null ? "" : v).trim();
  let x = txt.replace(/[^\d,.]/g, "");
  if (!x) return 0;
  const coma = x.lastIndexOf(","),
    punto = x.lastIndexOf(".");
  if (coma >= 0 && punto >= 0) {
    // el último separador es el decimal
    const dec = coma > punto ? "," : ".";
    x = x
      .split(dec === "," ? "." : ",")
      .join("")
      .replace(dec, ".");
  } else if (coma >= 0) x = /^\d+,\d{1,2}$/.test(x) ? x.replace(",", ".") : x.replace(/,/g, "");
  else if (/^\d{1,3}(\.\d{3})+$/.test(x)) x = x.replace(/\./g, ""); // 1.234 = mil doscientos treinta y cuatro
  const n = Number(x) || 0;
  const sinEspacios = txt.replace(/\s/g, "");
  const negativo = /^\(.*\)$/.test(sinEspacios) || /^-|-$/.test(sinEspacios) || /(^|[\d\s])(d|db|deb)\.?$/i.test(txt);
  return negativo ? -n : n;
}
// La columna «Tipo»: true = crédito (entró), false = débito (salió), null = no se sabe
function tipoCredito(v) {
  const t = normCol(v);
  if (!t) return null;
  if (/^(nc\b|n\/c|nota de credito|credito|cred|cr\b|abono|ingreso|deposito|entrada|haber|h$|c$|\+)/.test(t))
    return true;
  if (/^(nd\b|n\/d|nota de debito|debito|deb|db\b|cargo|egreso|retiro|salida|debe|d$|-)/.test(t)) return false;
  if (/credito|abono|deposito/.test(t)) return true;
  if (/debito|cargo|retiro|pago a/.test(t)) return false;
  return null;
}
// Una fecha del banco: fecha de Excel, número de serie de Excel, «07/10/2026», «07-10-26», «07.10.2026»,
// «2026-10-07», «07-OCT-2026», «7 de octubre de 2026», «07102026» (con o sin la hora)
const MESES_CORTOS = {
  ene: 1,
  jan: 1,
  feb: 2,
  mar: 3,
  abr: 4,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  ago: 8,
  aug: 8,
  sep: 9,
  set: 9,
  oct: 10,
  nov: 11,
  dic: 12,
  dec: 12,
};
function fechaBanco(v) {
  const dos = (n) => String(n).padStart(2, "0");
  const armar = (a, m, d) => {
    a = Number(a);
    m = Number(m);
    d = Number(d);
    if (a < 100) a += 2000;
    if (m > 12 && d <= 12) [m, d] = [d, m]; // vino al revés (mes/día)
    return a >= 1990 && a <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31 ? a + "-" + dos(m) + "-" + dos(d) : "";
  };
  if (v instanceof Date) return isNaN(v) ? "" : v.getFullYear() + "-" + dos(v.getMonth() + 1) + "-" + dos(v.getDate());
  if (typeof v === "number") {
    if (v > 20000 && v < 80000) {
      const d = new Date(Math.round((v - 25569) * 86400000));
      return d.getUTCFullYear() + "-" + dos(d.getUTCMonth() + 1) + "-" + dos(d.getUTCDate());
    }
    v = String(v);
  }
  const t = normCol(v);
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(t);
  if (m) return armar(m[1], m[2], m[3]);
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/.exec(t);
  if (m) return armar(m[3], m[2], m[1]);
  m = /^(\d{1,2})[-/. ]+(?:de )?([a-z]{3})[a-z]*\.?[-/. ]+(?:de |del )?(\d{2,4})\b/.exec(t);
  if (m && MESES_CORTOS[m[2]]) return armar(m[3], MESES_CORTOS[m[2]], m[1]);
  m = /^(\d{8})$/.exec(t);
  if (m) {
    const x = m[1];
    return Number(x.slice(0, 4)) >= 1990 && Number(x.slice(0, 4)) <= 2100
      ? armar(x.slice(0, 4), x.slice(4, 6), x.slice(6))
      : armar(x.slice(4), x.slice(2, 4), x.slice(0, 2));
  }
  return "";
}
// Referencia escrita en la descripción: después de «Ref», «Nro», «#»…; si no, la serie de cifras más larga (6 o más)
// que no sea un teléfono
function refDeDescripcion(d) {
  const t = String(d || "");
  const m =
    /(?:\bref(?:erencia)?|\bnro|\bn[°º]|#|operaci[oó]n|confirmaci[oó]n|\bdoc(?:umento)?)\.?\s*:?\s*(\d{4,})/i.exec(t);
  if (m) return m[1];
  return (
    (t.match(/\d{6,}/g) || [])
      .filter((x) => !/^0?4\d{9}$/.test(x) && !/^584\d{9}$/.test(x))
      .sort((a, b) => b.length - a.length)[0] || ""
  );
}
const FILA_NO_MOVIMIENTO = /saldo (inicial|anterior|final|actual|disponible|al)|^total|^totales/;
// Lo que entró a la cuenta (créditos), con su fecha, referencia y monto en Bs.
function movimientosBanco(filas, mapa) {
  const { fila, col } = mapa;
  const celda = (f, k) => (col[k] == null ? "" : f[col[k]]);
  const lista = [];
  (filas || []).slice(fila + 1).forEach((f, i) => {
    if (!f || !f.length) return;
    const fecha = fechaBanco(celda(f, "fecha"));
    if (!fecha) return;
    const descripcion = String(celda(f, "descripcion") == null ? "" : celda(f, "descripcion")).trim();
    if (FILA_NO_MOVIMIENTO.test(normCol(descripcion))) return;
    let monto;
    if (col.credito != null) monto = numeroBanco(celda(f, "credito"));
    else {
      const m = numeroBanco(celda(f, "monto"));
      const tipo = col.tipo != null ? tipoCredito(celda(f, "tipo")) : null;
      if (tipo === false) return;
      if (tipo == null && col.debito != null && numeroBanco(celda(f, "debito")) !== 0) return;
      monto = tipo === true ? Math.abs(m) : m;
    }
    if (!(monto > 0)) return;
    const refCelda = celda(f, "referencia");
    let referencia = refDigitos(typeof refCelda === "number" ? Math.round(refCelda) : refCelda);
    if (!referencia) referencia = refDeDescripcion(descripcion);
    lista.push({ fila: fila + 2 + i, fecha, referencia, descripcion, monto: r2(monto) });
  });
  return lista;
}
// Un archivo de texto (CSV o TXT): separado por «;», tabulador, «|» o «,» (con comillas), o en columnas fijas
function filasDeTexto(texto) {
  const lineas = String(texto || "")
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((l) => l.trim());
  const muestra = lineas.slice(0, 40);
  const fuera = (l, sep) => {
    let n = 0,
      comillas = false;
    for (const c of l) {
      if (c === '"') comillas = !comillas;
      else if (c === sep && !comillas) n++;
    }
    return n;
  };
  let sep = "",
    mejor = 0;
  for (const s of [";", "\t", "|", ","]) {
    const n = muestra.filter((l) => fuera(l, s) >= 2).length;
    if (n > mejor) [sep, mejor] = [s, n];
  }
  if (!sep || mejor < Math.min(2, muestra.length)) return lineas.map((l) => l.trim().split(/\s{2,}|\t/));
  return lineas.map((l) => {
    const celdas = [];
    let actual = "",
      comillas = false;
    for (let i = 0; i < l.length; i++) {
      const c = l[i];
      if (c === '"') {
        if (comillas && l[i + 1] === '"') {
          actual += '"';
          i++;
        } else comillas = !comillas;
      } else if (c === sep && !comillas) {
        celdas.push(actual.trim());
        actual = "";
      } else actual += c;
    }
    celdas.push(actual.trim());
    return celdas;
  });
}
// Los cobros por transferencia que deberían estar en el banco: uno por recibo y referencia, con sus Bs.
function cobrosPorTransferencia(lista) {
  const porClave = new Map();
  (lista || pagos).forEach((p) => {
    if (!p.factura) return;
    const formas = Array.isArray(p.formasPago) && p.formasPago.length ? p.formasPago : null;
    const partes = formas
      ? formas
          .filter((x) => x.metodo === "Transferencia Bs")
          .map((x) => ({ ref: x.referencia || "", bs: x.montoBs, unica: true }))
      : p.metodo === "Transferencia Bs"
        ? [{ ref: p.referencia || "", bs: p.totalBs != null ? p.totalBs : r2((p.total || 0) * (p.tasa || 0)) }]
        : [];
    partes.forEach((x) => {
      const k = p.factura + "|" + refDigitos(x.ref);
      const c = porClave.get(k) || {
        factura: p.factura,
        nombre: p.nombre,
        fecha: p.fecha,
        referencia: x.ref,
        bs: 0,
        usd: 0,
      };
      // en el pago mixto cada pago del recibo repite las formas: se cuentan una sola vez
      if (x.unica) c.bs = r2(x.bs || 0);
      else c.bs = r2(c.bs + (x.bs || 0));
      c.usd = r2(c.usd + (p.total || 0));
      porClave.set(k, c);
    });
  });
  return [...porClave.values()];
}
function conciliarBanco(entradas, cobros) {
  const montoIgual = (a, b) => Math.abs(a - b) <= Math.max(1, Math.abs(b) * 0.005);
  if (!entradas.length) return null;
  const fechas = entradas.map((e) => e.fecha).sort();
  const desde = fechas[0],
    hasta = fechas[fechas.length - 1];
  // los cobros del período del estado de cuenta (con 3 días de margen: una transferencia de otro banco llega después)
  const delPeriodo = cobros.filter((c) => c.fecha >= sumarDias(desde, -3) && c.fecha <= hasta);
  const usados = new Set(),
    casadas = new Map();
  const casar = (e, c, como) => {
    usados.add(c);
    casadas.set(e, { entrada: e, cobro: c, como });
  };
  // 1) por la referencia
  entradas.forEach((e) => {
    if (!e.referencia) return;
    const c = delPeriodo.find((x) => !usados.has(x) && x.referencia && mismaReferencia(x.referencia, e.referencia, 4));
    if (c) casar(e, c, montoIgual(e.monto, c.bs) ? "referencia" : "monto-distinto");
  });
  // 2) por el monto y la fecha (3 días), si hay un solo cobro que coincida
  entradas.forEach((e) => {
    if (casadas.has(e)) return;
    const candidatos = delPeriodo.filter(
      (c) => !usados.has(c) && Math.abs(c.bs - e.monto) <= 0.5 && Math.abs(diasEntre(c.fecha, e.fecha)) <= 3
    );
    if (candidatos.length === 1) casar(e, candidatos[0], "monto");
  });
  const de = (como) => [...casadas.values()].filter((x) => x.como === como);
  const sinRegistrar = entradas.filter((e) => !casadas.has(e));
  const suma = (l, f) => r2(l.reduce((s, x) => s + f(x), 0));
  return {
    desde,
    hasta,
    entradas: entradas.length,
    totalBanco: suma(entradas, (e) => e.monto),
    conciliados: de("referencia"),
    porMonto: de("monto"),
    montoDistinto: de("monto-distinto"),
    sinRegistrar,
    totalSinRegistrar: suma(sinRegistrar, (e) => e.monto),
    noEnBanco: delPeriodo.filter((c) => !usados.has(c) && c.fecha >= desde),
  };
}
const sumarDias = (f, n) => {
  const d = new Date(f + "T12:00:00");
  d.setDate(d.getDate() + n);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
};
