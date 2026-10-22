// Cálculos de la nómina: períodos de pago (1ra quincena, 2da quincena o mes completo), lo que corresponde pagar a
// cada trabajador, adelantos por descontar y préstamos con su saldo. Todo sale de los movimientos de nómina que se
// guardan en «finanzas» (son gastos: el dinero que sale):
//   · pago:     nomina = {tipo:"pago", periodo:"2026-10-Q1" | "2026-10-Q2" | "2026-10-M", bruto,
//                         asignaciones:[{concepto, monto}], deducciones:[{concepto, monto, tipo, ref}]}; monto = neto
//   · adelanto: nomina = {tipo:"adelanto", periodo}; monto = lo entregado (categoría «Nómina»)
//   · préstamo: nomina = {tipo:"prestamo", cuota, motivo}; monto = lo prestado (categoría «Préstamos al personal»)
// Una deducción de tipo «adelanto» o «prestamo» lleva ref = el id del adelanto o préstamo que descuenta. Un adelanto
// queda pendiente mientras ningún pago lo descuente, y el saldo de un préstamo es lo prestado menos sus cuotas
// descontadas: si se borra un pago, lo que descontaba vuelve a quedar pendiente solo.
// Así, en «Nómina» la suma de adelantos + pagos netos es lo que costó la nómina, y el préstamo sale aparte (se
// recupera con las cuotas).

const CATEGORIA_PRESTAMOS = "Préstamos al personal";
const TIPOS_PERIODO = { Q1: "1ra quincena", Q2: "2da quincena", M: "Mes completo" };
const periodoDe = (ym, tipo) => ym + "-" + tipo;
function partesPeriodo(p) {
  const m = /^(\d{4}-\d{2})-(Q1|Q2|M)$/.exec(p || "");
  return m ? { ym: m[1], tipo: m[2] } : null;
}
// «1ra quincena de Octubre 2026» / «Octubre 2026 (mes completo)»
function nombrePeriodo(p) {
  const x = partesPeriodo(p);
  if (!x) return "";
  return x.tipo === "M" ? nombreMesYM(x.ym) + " (mes completo)" : TIPOS_PERIODO[x.tipo] + " de " + nombreMesYM(x.ym);
}
// El período que toca pagar en una fecha: a los quincenales, la quincena de ese día; a los mensuales, el mes
function periodoSugerido(t, hoy) {
  hoy = hoy || todayStr();
  const ym = hoy.slice(0, 7);
  if (t && t.frecuencia === "mensual") return periodoDe(ym, "M");
  return periodoDe(ym, Number(hoy.slice(8, 10)) <= 15 ? "Q1" : "Q2");
}
const fraccionPeriodo = (tipo) => (tipo === "M" ? 1 : 0.5);
// Horas de clase: quien trabaja por horas (o tiene sueldo fijo y además da horas) lleva en su ficha
// horas = [{nivel, horas (al mes), tarifa ($ la hora)}]. Cada nivel puede ir a su tarifa (p. ej. Primaria a $ 2,00 y
// Media general a $ 2,50). En cada pago se escriben las horas que trabajó en ese período.
const NIVELES_HORAS = ["Media general", "Primaria", "Inicial", "Otro"];
const TARIFA_HORA = { "Media general": 2.5, Primaria: 2, Inicial: 2 }; // lo que se sugiere al agregar horas
const horasDe = (t) => (t && Array.isArray(t.horas) ? t.horas.filter((h) => h && h.horas > 0 && h.tarifa > 0) : []);
const montoHorasMes = (t) => r2(horasDe(t).reduce((s, h) => s + h.horas * h.tarifa, 0));
const conceptoHoras = (nivel) => "Horas de " + (nivel || "clase");
function tipoPagoTrabajador(t) {
  const fijo = (t.salario || 0) > 0,
    horas = horasDe(t).length > 0;
  return fijo && horas ? "mixto" : horas ? "horas" : "fijo";
}
const ETIQ_TIPO_PAGO = { fijo: "💼 Sueldo fijo", horas: "⏱️ Por horas", mixto: "💼 Fijo + ⏱️ horas" };
// «20 h × $ 2,50»
const detalleHoras = (horas, tarifa) => String(r2(horas)).replace(".", ",") + " h × " + fmt(tarifa);
// Lo que gana un trabajador al mes (salario + bonos + horas), antes de deducciones
const devengadoMensual = (t) =>
  r2((t.salario || 0) + (t.bonoAlimentacion || 0) + (t.bonoProductividad || 0) + montoHorasMes(t));
const netoMensual = (t) => r2(devengadoMensual(t) - (t.descuento || 0));

// Movimientos de nómina de un trabajador (los pagos viejos, sin «nomina», cuentan como pagos)
const movimientosNomina = (trabId) =>
  finanzas.filter(
    (f) =>
      f.tipo === "gasto" &&
      f.trabajadorId === trabId &&
      (f.categoria === "Nómina" || f.categoria === CATEGORIA_PRESTAMOS)
  );
const tipoMovNomina = (f) => (f.nomina && f.nomina.tipo) || (f.categoria === CATEGORIA_PRESTAMOS ? "prestamo" : "pago");
// Período de un pago viejo: el mes (y la quincena) que dice su descripción, o el mes de su fecha
function periodoDePago(f) {
  if (f.nomina && f.nomina.periodo) return f.nomina.periodo;
  if (!f.fecha) return "";
  const d = sinAcento(String(f.descripcion || "")).toLowerCase();
  let ym = f.fecha.slice(0, 7);
  const i = MESES.findIndex((m) => d.includes(sinAcento(m).toLowerCase()));
  if (i >= 0) {
    const mesFecha = Number(f.fecha.slice(5, 7));
    const anio = Number(f.fecha.slice(0, 4)) - (i + 1 > mesFecha ? 1 : 0); // «Diciembre» pagado en enero
    ym = anio + "-" + String(i + 1).padStart(2, "0");
  }
  const tipo = /(1ra|primera|1era)\s*quincena/.test(d) ? "Q1" : /(2da|segunda)\s*quincena/.test(d) ? "Q2" : "M";
  return periodoDe(ym, tipo);
}
// Lo devengado en un pago: los nuevos lo guardan; en los viejos, la base + los otros conceptos
function brutoDePago(f) {
  if (f.nomina && f.nomina.bruto != null) return f.nomina.bruto;
  const otros = Array.isArray(f.otros) ? f.otros.reduce((s, o) => s + (o.monto || 0), 0) : 0;
  return r2((f.montoBase != null ? f.montoBase : f.monto || 0) + otros);
}
const deduccionesDe = (f) => (f.nomina && Array.isArray(f.nomina.deducciones) ? f.nomina.deducciones : []);
// Cuánto de un adelanto o préstamo ya se descontó en los pagos
const descontadoDe = (movs, ref) =>
  r2(
    movs
      .filter((f) => tipoMovNomina(f) === "pago")
      .reduce((s, f) => s + deduccionesDe(f).reduce((x, d) => x + (d.ref === ref ? d.monto || 0 : 0), 0), 0)
  );

function adelantosPendientes(trabId) {
  const movs = movimientosNomina(trabId);
  return movs
    .filter((f) => tipoMovNomina(f) === "adelanto")
    .map((f) => ({
      id: f.id,
      fecha: f.fecha,
      periodo: (f.nomina && f.nomina.periodo) || "",
      monto: f.monto || 0,
      pendiente: r2((f.monto || 0) - descontadoDe(movs, f.id)),
    }))
    .filter((a) => a.pendiente > 0.004)
    .sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
}
function prestamosDe(trabId) {
  const movs = movimientosNomina(trabId);
  return movs
    .filter((f) => tipoMovNomina(f) === "prestamo")
    .map((f) => {
      const pagado = descontadoDe(movs, f.id);
      return {
        id: f.id,
        fecha: f.fecha,
        monto: f.monto || 0,
        cuota: (f.nomina && f.nomina.cuota) || f.monto || 0,
        motivo: (f.nomina && f.nomina.motivo) || "",
        pagado,
        saldo: r2(Math.max(0, (f.monto || 0) - pagado)),
      };
    })
    .sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
}
const sumaDe = (l, k) => r2(l.reduce((s, x) => s + (x[k] || 0), 0));

// Lo que corresponde en un período: asignaciones (salario, bonos y horas; la mitad si es una quincena) y deducciones
// (la deducción fija, los adelantos por descontar y la cuota de cada préstamo con saldo)
function sugerenciaPago(t, periodo) {
  const x = partesPeriodo(periodo),
    f = fraccionPeriodo(x ? x.tipo : "M");
  const asignaciones = [
    ["Salario base", t.salario],
    ["Bono alimentación", t.bonoAlimentacion],
    ["Bono productividad", t.bonoProductividad],
  ]
    .map(([concepto, v]) => ({ concepto, monto: r2((v || 0) * f) }))
    .filter((a) => a.monto > 0);
  horasDe(t).forEach((h) => {
    const horas = r2(h.horas * f);
    asignaciones.push({ concepto: conceptoHoras(h.nivel), monto: r2(horas * h.tarifa), horas, tarifa: h.tarifa });
  });
  const deducciones = [];
  if (t.descuento > 0)
    deducciones.push({
      concepto: t.descuentoConcepto || "Deducción fija",
      monto: r2(t.descuento * f),
      tipo: "fija",
    });
  if (t.id) {
    adelantosPendientes(t.id).forEach((a) =>
      deducciones.push({
        concepto: "Adelanto del " + fechaCorta(a.fecha),
        monto: a.pendiente,
        tipo: "adelanto",
        ref: a.id,
      })
    );
    prestamosDe(t.id)
      .filter((p) => p.saldo > 0.004)
      .forEach((p) =>
        deducciones.push({
          concepto: "Cuota de préstamo del " + fechaCorta(p.fecha),
          monto: r2(Math.min(p.cuota, p.saldo)),
          tipo: "prestamo",
          ref: p.id,
          saldo: p.saldo,
        })
      );
  }
  return { asignaciones, deducciones };
}
// Pagos que chocan con un período: el mismo período, o el mes completo con cualquiera de sus quincenas (y al revés)
function choquePeriodo(trabId, periodo, sinId) {
  const x = partesPeriodo(periodo);
  if (!x) return [];
  return movimientosNomina(trabId).filter((f) => {
    if (tipoMovNomina(f) !== "pago" || f.id === sinId) return false;
    const y = partesPeriodo(periodoDePago(f));
    return !!y && y.ym === x.ym && (y.tipo === x.tipo || y.tipo === "M" || x.tipo === "M");
  });
}
// Los períodos de un mes que aún no se le pagan (por quincenas: 1ra y 2da; mensual: el mes)
const periodosPendientes = (t, ym) =>
  (t.frecuencia === "mensual" ? ["M"] : ["Q1", "Q2"]).filter(
    (tipo) => !choquePeriodo(t.id, periodoDe(ym, tipo)).length
  );
// El próximo período por pagar de un mes: nada si ya está todo pagado
function siguientePeriodo(t, ym) {
  const libre = periodosPendientes(t, ym)[0];
  return libre ? periodoDe(ym, libre) : "";
}

// Nómina de un mes, por trabajador activo: lo que gana al mes, lo devengado en los pagos de ese mes, lo entregado
// (adelantos + pagos netos + préstamos con fecha en ese mes), lo que falta por pagar y lo que debe
function resumenNominaMes(ym) {
  const filas = trabajadores
    .filter((t) => t.activo !== false)
    .map((t) => {
      const movs = movimientosNomina(t.id);
      const pagos = movs.filter((f) => tipoMovNomina(f) === "pago" && periodoDePago(f).slice(0, 7) === ym);
      const delMes = movs.filter((f) => (f.fecha || "").slice(0, 7) === ym);
      const devengado = devengadoMensual(t);
      const bruto = r2(pagos.reduce((s, f) => s + brutoDePago(f), 0));
      return {
        t,
        devengado,
        bruto,
        neto: sumaDe(pagos, "monto"),
        adelantos: sumaDe(
          delMes.filter((f) => tipoMovNomina(f) === "adelanto"),
          "monto"
        ),
        prestado: sumaDe(
          delMes.filter((f) => tipoMovNomina(f) === "prestamo"),
          "monto"
        ),
        entregado: sumaDe(delMes, "monto"),
        // Lo que falta: lo que gana en los períodos que aún no se pagan (si un pago llevó menos horas, no queda «debiendo»)
        porPagar: r2(devengado * periodosPendientes(t, ym).reduce((s, tipo) => s + fraccionPeriodo(tipo), 0)),
        periodos: pagos.map((f) => (partesPeriodo(periodoDePago(f)) || {}).tipo).filter(Boolean),
        siguiente: siguientePeriodo(t, ym),
        adelantosPendientes: sumaDe(adelantosPendientes(t.id), "pendiente"),
        saldoPrestamos: sumaDe(prestamosDe(t.id), "saldo"),
      };
    });
  const total = (k) => sumaDe(filas, k);
  return {
    ym,
    filas,
    devengado: total("devengado"),
    bruto: total("bruto"),
    entregado: total("entregado"),
    porPagar: total("porPagar"),
    adelantosPendientes: total("adelantosPendientes"),
    saldoPrestamos: total("saldoPrestamos"),
  };
}

// ---- Datos del trabajador: cuentas bancarias, antigüedad y certificado de salud
// Código de banco = los 4 primeros dígitos de la cuenta (20 dígitos)
const BANCOS_VE = {
  "0102": "Banco de Venezuela",
  "0104": "Venezolano de Crédito",
  "0105": "Mercantil",
  "0108": "Provincial",
  "0114": "Bancaribe",
  "0115": "Exterior",
  "0128": "Caroní",
  "0134": "Banesco",
  "0137": "Sofitasa",
  "0138": "Plaza",
  "0151": "BFC Fondo Común",
  "0156": "100% Banco",
  "0157": "DelSur",
  "0163": "Banco del Tesoro",
  "0166": "Banco Agrícola",
  "0168": "Bancrecer",
  "0171": "Banco Activo",
  "0172": "Bancamiga",
  "0174": "Banplus",
  "0175": "Banco Digital de los Trabajadores",
  "0177": "Banfanb",
  "0191": "BNC Nacional de Crédito",
};
const TIPOS_CUENTA = ["Corriente", "Ahorro", "Pago móvil"];
const soloDigitos = (v) => String(v || "").replace(/\D/g, "");
const bancoDeCuenta = (numero) => BANCOS_VE[soloDigitos(numero).slice(0, 4)] || "";
const cuentasDe = (t) => (t && Array.isArray(t.cuentas) ? t.cuentas.filter((c) => c && soloDigitos(c.numero)) : []);
// «Banesco · Corriente · ****1234» (en el recibo no va el número completo)
const cuentaCorta = (c) =>
  [c.banco, c.tipo, (c.tipo === "Pago móvil" ? "" : "****") + soloDigitos(c.numero).slice(-4)]
    .filter(Boolean)
    .join(" · ");
// Qué está mal en una cuenta (vacío si está bien)
function revisarCuenta(c) {
  const n = soloDigitos(c.numero);
  if (!n) return "";
  if (c.tipo === "Pago móvil")
    return /^04\d{9}$/.test(n) ? "" : "el teléfono del pago móvil debe tener 11 dígitos (04xx…)";
  if (n.length !== 20) return "la cuenta debe tener 20 dígitos (tiene " + n.length + ")";
  const banco = bancoDeCuenta(n);
  if (banco && c.banco && sinAcento(banco).toLowerCase() !== sinAcento(c.banco).toLowerCase())
    return "los primeros 4 dígitos (" + n.slice(0, 4) + ") son de " + banco + ", no de " + c.banco;
  return "";
}
// RIF: V-12345678-9 (también E, J, P o G)
const normalizarRif = (v) => {
  const x = String(v || "")
    .toUpperCase()
    .replace(/[^VEJPG0-9]/g, "");
  const m = /^([VEJPG])(\d{8})(\d)$/.exec(x);
  return m
    ? m[1] + "-" + m[2] + "-" + m[3]
    : String(v || "")
        .trim()
        .toUpperCase();
};
const rifValido = (v) => !v || /^[VEJPG]-\d{8}-\d$/.test(v);
// Años completos en la escuela
function antiguedad(fechaIngreso, hoy) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaIngreso || "")) return null;
  hoy = hoy || todayStr();
  let n = Number(hoy.slice(0, 4)) - Number(fechaIngreso.slice(0, 4));
  if (hoy.slice(5) < fechaIngreso.slice(5)) n--;
  return Math.max(0, n);
}
// Certificado de salud: el último que se adjuntó y si está vigente, por vencer (30 días) o vencido
const DIAS_AVISO_CERTIFICADO = 30;
function estadoCertificado(t, hoy) {
  hoy = hoy || todayStr();
  const c = (Array.isArray(t.adjuntos) ? t.adjuntos : [])
    .filter((a) => a.clase === "salud")
    .sort((a, b) => ((a.vence || a.fecha || "") < (b.vence || b.fecha || "") ? 1 : -1))[0];
  if (!c) return { estado: "falta", adjunto: null };
  if (!c.vence) return { estado: "sin-fecha", adjunto: c };
  const dias = diasEntre(hoy, c.vence);
  return {
    estado: c.vence < hoy ? "vencido" : dias <= DIAS_AVISO_CERTIFICADO ? "por-vencer" : "vigente",
    adjunto: c,
    dias,
  };
}

// ---- Clases que da cada docente: clases = [{materia, grados: [...], dias: [...], desde: "07:00", hasta: "08:30"}]
// En Inicial y Primaria basta el grado (la materia vacía es «Docente de aula»); en Media general cada profesor da una
// materia a uno o varios años. Deporte o Inglés pueden ir a todo el colegio.
const DIAS_SEMANA = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const NOMBRE_DIA = { Lun: "lunes", Mar: "martes", Mié: "miércoles", Jue: "jueves", Vie: "viernes", Sáb: "sábado" };
const GRUPOS_GRADOS = [
  { nombre: "Inicial", grados: GRADOS_PREESCOLAR },
  { nombre: "Primaria", grados: GRADOS_PRIMARIA_LIST },
  { nombre: "Media general", grados: GRADOS_MG },
];
const clasesDe = (t) =>
  t && Array.isArray(t.clases) ? t.clases.filter((c) => c && Array.isArray(c.grados) && c.grados.length) : [];
const materiaDe = (c) => (c.materia || "").trim() || "Docente de aula";
const minutosHora = (h) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(h || "");
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};
// «07:30» → «7:30 a. m.»
function horaCorta(h) {
  const min = minutosHora(h);
  if (min == null) return "";
  const hh = Math.floor(min / 60),
    mm = String(min % 60).padStart(2, "0");
  return (hh % 12 || 12) + ":" + mm + (hh < 12 ? " a. m." : " p. m.");
}
// «Lun, Mié · 7:00 a. m. a 8:30 a. m.» (lo que tenga)
function textoHorario(c) {
  const dias = DIAS_SEMANA.filter((d) => (c.dias || []).includes(d));
  const horas = c.desde && c.hasta ? horaCorta(c.desde) + " a " + horaCorta(c.hasta) : "";
  return [dias.join(", "), horas].filter(Boolean).join(" · ");
}
// «Todo el colegio», «Toda la Primaria», «1er Año a 3er Año», «3er Grado, 5to Grado»
function textoGrados(grados) {
  const lista = ESCALERA.filter((g) => (grados || []).includes(g));
  if (!lista.length) return "";
  if (lista.length === ESCALERA.length) return "Todo el colegio";
  const nombres = [];
  for (const grupo of GRUPOS_GRADOS) {
    const del = grupo.grados.filter((g) => lista.includes(g));
    if (!del.length) continue;
    if (del.length === grupo.grados.length) {
      nombres.push((grupo.nombre === "Inicial" ? "Todo " : "Toda la ") + grupo.nombre);
      continue;
    }
    // tramos seguidos: 1er Año a 3er Año
    let i = 0;
    while (i < del.length) {
      let j = i;
      while (j + 1 < del.length && grupo.grados.indexOf(del[j + 1]) === grupo.grados.indexOf(del[j]) + 1) j++;
      nombres.push(j - i >= 2 ? del[i] + " a " + del[j] : del.slice(i, j + 1).join(", "));
      i = j + 1;
    }
  }
  return nombres.join(", ");
}
// Tiempo de clase a la semana según el horario (minutos de reloj)
const minutosSemana = (t) =>
  clasesDe(t).reduce((s, c) => {
    const a = minutosHora(c.desde),
      b = minutosHora(c.hasta);
    return s + (a != null && b > a ? (b - a) * (c.dias || []).length : 0);
  }, 0);
const textoMinutos = (min) => {
  const h = Math.floor(min / 60),
    m = min % 60;
  return (h ? h + " h" : "") + (h && m ? " " : "") + (m ? m + " min" : "") || "0 h";
};
// Qué está mal en una clase (vacío si está bien)
function revisarClase(c) {
  if (!c.grados.length) return "elige a qué grado o año le da clase";
  if (!(c.materia || "").trim() && c.grados.some((g) => getNivel(g) === "media"))
    return "escribe la materia (en Media general cada profesor da una materia)";
  const a = minutosHora(c.desde),
    b = minutosHora(c.hasta);
  if ((c.desde || c.hasta) && (a == null || b == null)) return "escribe la hora de inicio y la de salida";
  if (a != null && b != null && b <= a) return "la hora de salida debe ser después de la de inicio";
  if (a != null && !(c.dias || []).length) return "marca los días de esa clase";
  return "";
}
// Las clases de todo el personal activo, por grado (en el orden del colegio)
function clasesPorGrado(lista) {
  const porGrado = new Map(ESCALERA.map((g) => [g, []]));
  (lista || trabajadores)
    .filter((t) => t.activo !== false)
    .forEach((t) =>
      clasesDe(t).forEach((c) => c.grados.forEach((g) => porGrado.has(g) && porGrado.get(g).push({ t, c })))
    );
  // primero el docente de aula, luego por la hora de inicio
  const orden = (x) => ((x.c.materia || "").trim() ? (minutosHora(x.c.desde) ?? 9999) : -1);
  porGrado.forEach((l) => l.sort((x, y) => orden(x) - orden(y) || materiaDe(x.c).localeCompare(materiaDe(y.c))));
  return porGrado;
}
// Choques de horario: un profesor en dos clases a la vez, o un año con dos materias a la vez (el docente de aula de
// Inicial o Primaria con Deporte o Inglés no es choque: el especialista da su clase con el docente en el aula)
function choquesHorario(lista) {
  const activos = (lista || trabajadores).filter((t) => t.activo !== false);
  const bloques = [];
  activos.forEach((t) =>
    clasesDe(t).forEach((c, i) => {
      const a = minutosHora(c.desde),
        b = minutosHora(c.hasta);
      if (a == null || b == null || b <= a) return;
      (c.dias || []).forEach((dia) => bloques.push({ t, c, i, dia, a, b }));
    })
  );
  const choques = [];
  const visto = new Set();
  for (let x = 0; x < bloques.length; x++)
    for (let y = x + 1; y < bloques.length; y++) {
      const p = bloques[x],
        q = bloques[y];
      if (p.dia !== q.dia || !(p.a < q.b && q.a < p.b)) continue;
      const hora = (z) => horaCorta(z.c.desde) + " a " + horaCorta(z.c.hasta);
      if (p.t === q.t && p.i !== q.i) {
        const k = "p|" + p.t.id + "|" + p.dia + "|" + [p.i, q.i].sort().join();
        if (visto.has(k)) continue;
        visto.add(k);
        choques.push(
          `${p.t.nombre} tiene dos clases a la vez el ${NOMBRE_DIA[p.dia]}: ${materiaDe(p.c)} (${textoGrados(p.c.grados)}, ${hora(p)}) y ${materiaDe(q.c)} (${textoGrados(q.c.grados)}, ${hora(q)})`
        );
      } else if (p.t !== q.t && (p.c.materia || "").trim() && (q.c.materia || "").trim()) {
        p.c.grados
          .filter((g) => q.c.grados.includes(g) && getNivel(g) === "media")
          .forEach((g) => {
            const k = "g|" + g + "|" + p.dia + "|" + [p.t.id + p.i, q.t.id + q.i].sort().join();
            if (visto.has(k)) return;
            visto.add(k);
            choques.push(
              `${g} tiene dos clases a la vez el ${NOMBRE_DIA[p.dia]}: ${materiaDe(p.c)} con ${p.t.nombre} (${hora(p)}) y ${materiaDe(q.c)} con ${q.t.nombre} (${hora(q)})`
            );
          });
      }
    }
  return choques;
}

// ---- Asistencia del personal: un documento por día en «asistencia_personal» (id = fecha), con lo de cada uno:
// registros = { trabId: { estado, horas?, nota? } }. Las horas son las que dio ese día quien trabaja por horas.
const ESTADOS_ASISTENCIA = {
  presente: { corto: "P", nombre: "Presente", color: "#1a9e5c" },
  retardo: { corto: "R", nombre: "Retardo", color: "#b8860b" },
  falta: { corto: "F", nombre: "Falta", color: "#e53e3e" },
  justificada: { corto: "J", nombre: "Falta justificada", color: "#00509e" },
  permiso: { corto: "Pm", nombre: "Permiso o reposo", color: "#6b46c1" },
};
// Fechas de un período de pago: 1ra quincena 1–15, 2da quincena 16–fin de mes, mes completo
function rangoPeriodo(periodo) {
  const x = partesPeriodo(periodo);
  if (!x) return null;
  const fin = new Date(Number(x.ym.slice(0, 4)), Number(x.ym.slice(5, 7)), 0).getDate();
  return x.tipo === "Q1"
    ? [x.ym + "-01", x.ym + "-15"]
    : x.tipo === "Q2"
      ? [x.ym + "-16", x.ym + "-" + fin]
      : [x.ym + "-01", x.ym + "-" + fin];
}
// Lo de un trabajador entre dos fechas: días por estado y horas
function resumenAsistencia(dias, trabId, desde, hasta) {
  const r = { dias: 0, horas: 0, presente: 0, retardo: 0, falta: 0, justificada: 0, permiso: 0, faltas: [] };
  Object.values(dias || {}).forEach((d) => {
    if (!d || !d.fecha || d.fecha < desde || d.fecha > hasta) return;
    const x = (d.registros || {})[trabId];
    if (!x || !ESTADOS_ASISTENCIA[x.estado]) return;
    r.dias++;
    r[x.estado]++;
    r.horas = r2(r.horas + (Number(x.horas) || 0));
    if (x.estado === "falta") r.faltas.push(d.fecha);
  });
  r.faltas.sort();
  return r;
}
