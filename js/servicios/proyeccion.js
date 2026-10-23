// Flujo de caja proyectado (📊 Reportes): mes a mes, desde el mes en curso hasta que empieza el año escolar siguiente
// (12 meses desde la primera cuota), cuánto dinero entraría y saldría, y con cuánto quedaría el colegio. Sirve para
// ver con tiempo los meses en rojo y prepararse: diciembre con las utilidades, y julio y agosto, cuando ya no entran
// mensualidades pero la nómina se sigue pagando.
//
// ENTRADAS de cada mes:
//   · Mensualidades: las cuotas de ese mes que aún no se han pagado (de cada estudiante activo, con su mensualidad),
//     por el % de cobranza del escenario. Lo que ya se adelantó no se cuenta otra vez.
//   · Deuda atrasada: lo vencido (cuotas, inscripción, recargos y deuda anterior), por el % que se espera recuperar,
//     repartido en los próximos 3 meses.
//   · Otros ingresos: el promedio mensual de los ingresos registrados en Finanzas este año.
// SALIDAS de cada mes:
//   · Nómina: la del personal activo (sueldos y horas de clase).
//   · Otros gastos: el promedio mensual de los gastos de este año que no son nómina ni préstamos.
//   · Cuentas por pagar de una sola vez, en el mes en que vencen (las mensuales ya están en el promedio).
//   · Utilidades y bono vacacional (estimado: nómina de un mes ÷ 30 × los días), en el mes que se elija.
// Escenarios: «esperado» usa el % de cobranza real del año (lo vencido que ya se cobró); «optimista», 100 %;
// «pesimista», 15 puntos menos que el real.

const MESES_RECUPERAR_DEUDA = 3;
const ESCENARIOS_FLUJO = {
  optimista: "Si todos pagan",
  esperado: "Al ritmo de cobranza actual",
  pesimista: "Si la cobranza baja 15 puntos",
};
const OPCIONES_FLUJO = {
  escenario: "esperado",
  saldoInicial: null, // null = el resultado del año hasta hoy
  recuperarDeuda: 50, // % de la deuda atrasada que se espera cobrar
  utilidadesDias: 30,
  utilidadesMes: 12,
  bonoDias: 15,
  bonoMes: 7,
};

// % de cobranza (0 a 1) de un escenario a partir del índice real del año
function tasaCobranzaEscenario(escenario, indice) {
  const real = indice == null ? 0.85 : indice; // sin historia todavía: 85 %
  if (escenario === "optimista") return 1;
  if (escenario === "pesimista") return Math.max(0, r2(real - 0.15));
  return Math.min(1, Math.max(0, real));
}

// null si no hay cuotas configuradas (o es un año anterior)
function proyectarFlujo(hoy, op) {
  hoy = hoy || todayStr();
  op = { ...OPCIONES_FLUJO, ...(op || {}) };
  const ind = indicadoresFinancieros(hoy);
  if (!ind) return null;
  const ymHoy = hoy.slice(0, 7),
    finCiclo = sumarMeses(cobCfg.primerMes, Math.max(11, cobCfg.cuotas - 1)),
    hasta = finCiclo > ymHoy ? finCiclo : ymHoy;
  const meses = [];
  for (let ym = ymHoy; ym <= hasta && meses.length < 24; ym = sumarMeses(ym, 1))
    meses.push({
      ym,
      mes: nombreMesYM(ym),
      mensualidades: 0,
      deuda: 0,
      otrosIngresos: 0,
      nomina: 0,
      gastos: 0,
      cuentas: 0,
      extras: [],
    });
  const delMes = new Map(meses.map((m) => [m.ym, m]));
  const cobranza = tasaCobranzaEscenario(op.escenario, ind.indice);

  // Lo que falta por cobrar de cada mes (cuotas e inscripción que aún no vencen)
  estudiantes.filter(activo).forEach((e) => {
    const c = calcCuotas(e, hoy);
    if (!c) return;
    c.lista.forEach((q) => {
      const m = delMes.get(q.ym);
      if (m && !q.vencida && q.pendiente > 0.004) m.mensualidades = r2(m.mensualidades + q.pendiente);
    });
    if (c.inscripcion && c.inscripcion.pendiente > 0.004) {
      const vence = c.primera ? c.primera.vence : cobCfg.primerMes + "-01";
      const m = vence >= hoy && delMes.get(vence.slice(0, 7)); // si ya venció, está en la deuda atrasada
      if (m) m.mensualidades = r2(m.mensualidades + c.inscripcion.pendiente);
    }
  });
  meses.forEach((m) => (m.mensualidades = r2(m.mensualidades * cobranza)));

  // Deuda atrasada: lo vencido + recargos + deuda anterior, en partes iguales los primeros meses
  const atrasada = r2(ind.vencido + ind.recargos + ind.deudaAnterior);
  const recuperable = r2((atrasada * Math.min(100, Math.max(0, Number(op.recuperarDeuda) || 0))) / 100);
  const nRec = Math.min(MESES_RECUPERAR_DEUDA, meses.length);
  meses.slice(0, nRec).forEach((m) => (m.deuda = r2(recuperable / nRec)));

  // Promedios del año: otros ingresos y gastos que no son nómina
  const eq = ind.equilibrio;
  const inicio = (escCfg && escCfg.actual && escCfg.actual.inicio) || cobCfg.primerMes + "-01";
  const ingresosAnio = finanzas.filter((f) => f.tipo === "ingreso" && f.fecha >= inicio && f.fecha <= hoy);
  const otrosIngresos = r2(ingresosAnio.reduce((s, f) => s + (f.monto || 0), 0) / eq.meses);
  const diario = eq.nomina / 30;
  meses.forEach((m) => {
    m.otrosIngresos = otrosIngresos;
    m.nomina = eq.nomina;
    m.gastos = eq.otrosGastos;
    const nMes = Number(m.ym.slice(5, 7));
    if (Number(op.utilidadesDias) > 0 && nMes === Number(op.utilidadesMes))
      m.extras.push({ concepto: "Utilidades (" + op.utilidadesDias + " días)", monto: r2(diario * op.utilidadesDias) });
    if (Number(op.bonoDias) > 0 && nMes === Number(op.bonoMes))
      m.extras.push({ concepto: "Bono vacacional (" + op.bonoDias + " días)", monto: r2(diario * op.bonoDias) });
  });

  // Cuentas por pagar de una sola vez: en su mes (las vencidas, en el mes en curso)
  (cuentasPagar || [])
    .filter((c) => c.estado !== "pagada" && c.recurrente !== "mensual")
    .forEach((c) => {
      const usd = usdCuenta(c);
      const m = delMes.get(!c.vence || c.vence < hoy ? ymHoy : c.vence.slice(0, 7));
      if (m && usd > 0) m.cuentas = r2(m.cuentas + usd);
    });

  // Con cuánto se empieza: lo indicado, o el resultado del año hasta hoy (cobrado + ingresos − gastos)
  const resultadoAnio = r2(
    pagos.filter((p) => p.fecha >= inicio && p.fecha <= hoy).reduce((s, p) => s + (p.total || 0), 0) +
      ingresosAnio.reduce((s, f) => s + (f.monto || 0), 0) -
      finanzas
        .filter((f) => f.tipo === "gasto" && f.fecha >= inicio && f.fecha <= hoy)
        .reduce((s, f) => s + (f.monto || 0), 0)
  );
  const saldoInicial =
    op.saldoInicial == null || op.saldoInicial === "" ? resultadoAnio : r2(Number(op.saldoInicial) || 0);
  let saldo = saldoInicial;
  meses.forEach((m) => {
    m.extrasTotal = r2(m.extras.reduce((s, x) => s + x.monto, 0));
    m.entradas = r2(m.mensualidades + m.deuda + m.otrosIngresos);
    m.salidas = r2(m.nomina + m.gastos + m.cuentas + m.extrasTotal);
    m.resultado = r2(m.entradas - m.salidas);
    saldo = r2(saldo + m.resultado);
    m.saldo = saldo;
  });
  const enRojo = meses.filter((m) => m.saldo < 0);
  const peor = meses.reduce((a, m) => (!a || m.saldo < a.saldo ? m : a), null);
  return {
    hoy,
    escenario: op.escenario,
    cobranza,
    indice: ind.indice,
    atrasada,
    recuperable,
    saldoInicial,
    resultadoAnio,
    meses,
    entradas: r2(meses.reduce((s, m) => s + m.entradas, 0)),
    salidas: r2(meses.reduce((s, m) => s + m.salidas, 0)),
    saldoFinal: saldo,
    mesesNegativos: meses.filter((m) => m.resultado < 0).map((m) => m.mes),
    primerRojo: enRojo.length ? enRojo[0] : null,
    peor,
    nominaMes: eq.nomina,
  };
}
