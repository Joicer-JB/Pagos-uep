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
const COLUMNAS_BANCO = {
  fecha: /fecha/,
  referencia:
    /referencia|^ref\b|^ref\.|nro\.? ?(de )?(ref|operacion|documento|comprobante)|^numero|^n[°º]|^documento|^comprobante/,
  descripcion: /descrip|concepto|detalle|transaccion|movimiento|observ/,
  credito: /credito|abono|haber|ingreso|deposito/,
  debito: /debito|cargo|debe|egreso|retiro/,
  monto: /monto|importe|valor/,
};
const normCol = (v) =>
  sinAcento(String(v == null ? "" : v))
    .toLowerCase()
    .trim();
// La fila de títulos (entre las primeras 40) y qué columna es cada cosa
function detectarColumnas(filas) {
  let mejor = null;
  (filas || []).slice(0, 40).forEach((fila, i) => {
    const col = {};
    (fila || []).forEach((celda, j) => {
      const t = normCol(celda);
      if (!t || t.length > 40) return;
      for (const [k, re] of Object.entries(COLUMNAS_BANCO)) if (col[k] == null && re.test(t)) return void (col[k] = j);
    });
    const n = Object.keys(col).length;
    if (col.fecha != null && (col.credito != null || col.monto != null) && (!mejor || n > mejor.n))
      mejor = { fila: i, col, n };
  });
  return mejor ? { fila: mejor.fila, col: mejor.col } : null;
}
// Un monto del banco: número, «1.234,56», «1,234.56», «-500,00», «Bs. 8.302,50»
function numeroBanco(v) {
  if (typeof v === "number") return v;
  const txt = String(v == null ? "" : v);
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
  return /^\s*-|\(.*\)|-\s*$/.test(txt) ? -n : n;
}
// Una fecha del banco: fecha de Excel, número de serie de Excel, «dd/mm/aaaa», «dd-mm-aa» o «aaaa-mm-dd»
function fechaBanco(v) {
  const dos = (n) => String(n).padStart(2, "0");
  if (v instanceof Date && !isNaN(v)) return v.getFullYear() + "-" + dos(v.getMonth() + 1) + "-" + dos(v.getDate());
  if (typeof v === "number" && v > 20000 && v < 80000) {
    const d = new Date(Math.round((v - 25569) * 86400000));
    return d.getUTCFullYear() + "-" + dos(d.getUTCMonth() + 1) + "-" + dos(d.getUTCDate());
  }
  const t = String(v == null ? "" : v).trim();
  let m = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/.exec(t);
  if (m) return m[1] + "-" + dos(m[2]) + "-" + dos(m[3]);
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/.exec(t);
  if (m) return (m[3].length === 2 ? "20" + m[3] : m[3]) + "-" + dos(m[2]) + "-" + dos(m[1]);
  return "";
}
// Lo que entró a la cuenta (créditos), con su fecha, referencia y monto en Bs.
function movimientosBanco(filas, mapa) {
  const { fila, col } = mapa;
  const celda = (f, k) => (col[k] == null ? "" : f[col[k]]);
  const lista = [];
  (filas || []).slice(fila + 1).forEach((f, i) => {
    if (!f || !f.length) return;
    const fecha = fechaBanco(celda(f, "fecha"));
    if (!fecha) return;
    let monto = col.credito != null ? numeroBanco(celda(f, "credito")) : numeroBanco(celda(f, "monto"));
    if (col.credito == null && col.debito != null && numeroBanco(celda(f, "debito")) > 0) monto = 0;
    if (!(monto > 0)) return;
    const descripcion = String(celda(f, "descripcion") || "").trim();
    // Sin columna de referencia: la serie de cifras más larga de la descripción (6 o más)
    let referencia = refDigitos(celda(f, "referencia"));
    if (!referencia) referencia = (descripcion.match(/\d{6,}/g) || []).sort((a, b) => b.length - a.length)[0] || "";
    lista.push({ fila: fila + 2 + i, fecha, referencia, descripcion, monto: r2(monto) });
  });
  return lista;
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
