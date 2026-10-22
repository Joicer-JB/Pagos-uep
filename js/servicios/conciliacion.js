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
