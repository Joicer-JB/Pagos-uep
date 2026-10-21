// Indicadores financieros del año (📊 Reportes → Tablero financiero): cobranza por mes, antigüedad de la deuda,
// proyección del año y punto de equilibrio.
// Todo sale del estado de cuenta de cada estudiante activo (calcCuotas): lo ESPERADO es lo que cada uno debe pagar
// en el año (inscripción y mensualidades según la estructura de costos); lo COBRADO, lo que ya se aplicó a eso.
// Los uniformes, recargos y otros cobros no entran en lo esperado.

const TRAMOS_DEUDA = [
  { clave: "1-30", etiqueta: "1 a 30 días", hasta: 30 },
  { clave: "31-60", etiqueta: "31 a 60 días", hasta: 60 },
  { clave: "61-90", etiqueta: "61 a 90 días", hasta: 90 },
  { clave: "90+", etiqueta: "Más de 90 días", hasta: Infinity },
];
// Meses de «desde» a «hasta» (YYYY-MM), contando los dos: 2026-09 → 2026-10 = 2
function mesesEntre(desde, hasta) {
  let n = 1;
  for (let ym = desde; ym < hasta && n < 60; ym = sumarMeses(ym, 1)) n++;
  return n;
}
const pct = (parte, todo) => (todo > 0 ? parte / todo : null);

// null si no hay mora automática (cuotas sin configurar o año anterior)
function indicadoresFinancieros(hoy) {
  hoy = hoy || todayStr();
  if (!cobCfgActiva()) return null;
  const ymHoy = hoy.slice(0, 7);
  const meses = new Map(),
    tramos = TRAMOS_DEUDA.map((t) => ({ ...t, monto: 0, ids: new Set() })),
    deudores = [],
    ins = { esperado: 0, cobrado: 0, pendiente: 0, espVencido: 0, cobVencido: 0 };
  let esperado = 0,
    cobrado = 0,
    vencido = 0,
    porVencer = 0,
    recargos = 0,
    mensualidades = 0,
    conMensualidad = 0;

  estudiantes.filter(activo).forEach((e) => {
    const c = calcCuotas(e, hoy);
    if (!c) return;
    let debe = 0,
      dias = 0;
    // Lo que se debe y ya venció va a su tramo según los días de atraso
    const atrasado = (monto, vence) => {
      const d = Math.max(1, diasEntre(vence, hoy)),
        t = tramos.find((x) => d <= x.hasta);
      t.monto = r2(t.monto + monto);
      t.ids.add(e.id);
      vencido = r2(vencido + monto);
      debe = r2(debe + monto);
      dias = Math.max(dias, d);
    };
    c.lista.forEach((q) => {
      if (!(q.monto > 0)) return;
      const m = meses.get(q.ym) || { ym: q.ym, mes: q.mes, vence: q.vence, esperado: 0, cobrado: 0 };
      m.esperado = r2(m.esperado + q.monto);
      m.cobrado = r2(m.cobrado + q.pagado);
      meses.set(q.ym, m);
      esperado = r2(esperado + q.monto);
      cobrado = r2(cobrado + q.pagado);
      if (q.pendiente > 0.004) {
        if (q.vencida) atrasado(q.pendiente, q.vence);
        else porVencer = r2(porVencer + q.pendiente);
      }
    });
    if (c.inscripcion) {
      // La inscripción vence con el primer mes que paga
      const i = c.inscripcion,
        vence = c.primera ? c.primera.vence : cobCfg.primerMes + "-01";
      ins.esperado = r2(ins.esperado + i.monto);
      ins.cobrado = r2(ins.cobrado + i.pagado);
      if (vence < hoy) {
        ins.espVencido = r2(ins.espVencido + i.monto);
        ins.cobVencido = r2(ins.cobVencido + i.pagado);
      }
      esperado = r2(esperado + i.monto);
      cobrado = r2(cobrado + i.pagado);
      if (i.pendiente > 0.004) {
        ins.pendiente = r2(ins.pendiente + i.pendiente);
        if (vence < hoy) atrasado(i.pendiente, vence);
        else porVencer = r2(porVencer + i.pendiente);
      }
    }
    recargos = r2(recargos + c.recargoPend);
    if (Number(e.mensualidad) > 0) {
      mensualidades = r2(mensualidades + Number(e.mensualidad));
      conMensualidad++;
    }
    if (debe > 0.004) deudores.push({ id: e.id, nombre: e.nombre, grado: e.grado || "", monto: debe, dias });
  });

  // Cobranza por mes (hasta el mes en curso) e índice de cobranza: cuánto de lo vencido ya se cobró
  const porMes = [...meses.values()]
    .filter((m) => m.ym <= ymHoy)
    .sort((a, b) => a.ym.localeCompare(b.ym))
    .map((m) => ({ ...m, vencido: m.vence < hoy, pct: pct(m.cobrado, m.esperado) }));
  const vencidos = porMes.filter((m) => m.vencido);
  const espVencido = r2(vencidos.reduce((s, m) => s + m.esperado, 0) + ins.espVencido);
  const cobVencido = r2(vencidos.reduce((s, m) => s + m.cobrado, 0) + ins.cobVencido);
  const indice = pct(cobVencido, espVencido);

  // Punto de equilibrio: costos de un mes contra las mensualidades de un mes
  const inicio = (escCfg && escCfg.actual && escCfg.actual.inicio) || cobCfg.primerMes + "-01";
  const nMeses = mesesEntre(inicio.slice(0, 7), ymHoy);
  const gastosAnio = finanzas.filter((f) => f.tipo === "gasto" && f.fecha >= inicio && f.fecha <= hoy);
  const sumar = (l) => r2(l.reduce((s, f) => s + (f.monto || 0), 0));
  const nominaPersonal = r2(
    trabajadores
      .filter((t) => t.activo !== false)
      .reduce(
        (s, t) => s + (t.salario || 0) + (t.bonoAlimentacion || 0) + (t.bonoProductividad || 0) - (t.descuento || 0),
        0
      )
  );
  const nominaPagada = r2(sumar(gastosAnio.filter((f) => f.categoria === "Nómina")) / nMeses);
  const nomina = nominaPersonal > 0 ? nominaPersonal : nominaPagada;
  // Los préstamos al personal no son un gasto: se recuperan con las cuotas que se descuentan de la nómina
  const otrosGastos = r2(
    sumar(gastosAnio.filter((f) => f.categoria !== "Nómina" && f.categoria !== "Préstamos al personal")) / nMeses
  );
  const costoMes = r2(nomina + otrosGastos);
  const promedio = conMensualidad ? r2(mensualidades / conMensualidad) : 0;
  const necesarios = promedio > 0 ? Math.ceil(costoMes / promedio - 1e-9) : null;

  return {
    hoy,
    esperado,
    cobrado,
    vencido,
    porVencer,
    recargos,
    deudaAnterior: r2(estudiantes.reduce((s, e) => s + deudaManual(e), 0)),
    inscripcion: {
      esperado: ins.esperado,
      cobrado: ins.cobrado,
      pendiente: ins.pendiente,
      pct: pct(ins.cobrado, ins.esperado),
    },
    porMes,
    indice,
    tramos: tramos.map((t) => ({ clave: t.clave, etiqueta: t.etiqueta, monto: t.monto, estudiantes: t.ids.size })),
    // A quién cobrar primero: lo más atrasado y, entre iguales, lo que más se debe
    prioridad: deudores.sort((a, b) => b.dias - a.dias || b.monto - a.monto).slice(0, 5),
    proyeccion: {
      siTodosPagan: esperado,
      // Lo cobrado + lo que falta por vencer al ritmo de cobranza actual (lo vencido aparte: hay que recuperarlo)
      estimado: indice == null ? null : r2(cobrado + porVencer * indice),
    },
    equilibrio: {
      meses: nMeses,
      nomina,
      nominaDe: nominaPersonal > 0 ? "personal" : "pagada",
      otrosGastos,
      costoMes,
      ingresoMes: mensualidades,
      ingresoReal: indice == null ? null : r2(mensualidades * indice),
      estudiantes: conMensualidad,
      promedio,
      necesarios,
    },
  };
}
