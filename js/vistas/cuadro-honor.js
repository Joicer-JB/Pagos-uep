// 🏆 Cuadro de honor (media general): los mejores promedios de un lapso o del año, en toda media general y en cada
// año, y qué año tiene el mejor promedio. Lo usan el director y los docentes (📝 Notas → 🏆 Cuadro de honor), y se imprime para la cartelera o el acto.
// Para que sea justo, solo entra quien ya tiene nota en todas sus materias en ese período; por defecto tampoco quien
// tiene una materia reprobada (se puede incluir). Los empatados comparten el puesto. Cálculos: calificaciones.js.

const PERIODOS_HONOR = [["anio", "Todo el año"], ...LAPSOS.map((l) => [l, l])];
const MEDALLAS = ["🥇", "🥈", "🥉"];
const periodoHonor = () => (PERIODOS_HONOR.some(([k]) => k === filtros.honorPeriodo) ? filtros.honorPeriodo : "anio");
const conReprobadasHonor = () => filtros.honorReprobadas === true;
const nombrePeriodoHonor = (p) => (p === "anio" ? "año escolar completo" : p);

// Nota de cada materia del estudiante en el período: la definitiva, o la del lapso (null = sin nota)
const notasPeriodoHonor = (est, periodo) =>
  getAreas(est.grado).map((m) => (periodo === "anio" ? definitivaDe(est, m).nota : notaLapsoDe(est, m, periodo).nota));

// Los primeros n puestos (los empatados comparten el puesto, así que pueden ser más de n estudiantes)
function puestosHonor(lista, n) {
  const orden = [...lista].sort((a, b) => b.promedio - a.promedio || ordenNombre(a.est, b.est));
  const r = [];
  for (let i = 0; i < orden.length; i++) {
    const puesto = i > 0 && orden[i].promedio === orden[i - 1].promedio ? r[i - 1].puesto : i + 1;
    if (puesto > n) break;
    r.push({ ...orden[i], puesto });
  }
  return r;
}

// Promedio de cada año de media general en el período, del mejor al más bajo: el promedio de sus estudiantes (cada uno
// con las notas que ya tiene). Aquí cuentan todos, también los que tienen materias reprobadas.
// [{grado, promedio, conNotas, inscritos, reprobados}] (reprobados: estudiantes con alguna materia por debajo de 10)
function promediosPorAnio(periodo) {
  const porGrado = new Map();
  estudiantes
    .filter((e) => activo(e) && e.grado && getNivel(e.grado) === "media")
    .forEach((est) => {
      const g = porGrado.get(est.grado) || { grado: est.grado, proms: [], inscritos: 0, reprobados: 0 };
      g.inscritos++;
      const n = notasPeriodoHonor(est, periodo).filter((x) => x !== null);
      if (n.length) {
        g.proms.push(n.reduce((a, b) => a + b, 0) / n.length);
        if (n.some((x) => x < 10)) g.reprobados++;
      }
      porGrado.set(est.grado, g);
    });
  return [...porGrado.values()]
    .filter((g) => g.proms.length)
    .map((g) => ({
      grado: g.grado,
      promedio: unDecimal(g.proms.reduce((a, b) => a + b, 0) / g.proms.length),
      conNotas: g.proms.length,
      inscritos: g.inscritos,
      reprobados: g.reprobados,
    }))
    .sort((a, b) => b.promedio - a.promedio || ordenGrados(a.grado, b.grado));
}

// {general: top 10, porAnio: [{grado, lista: top 3}], anios: promediosPorAnio, incompletos, conReprobada}
function cuadroHonor(periodo, incluirReprobadas) {
  const candidatos = [];
  let incompletos = 0,
    conReprobada = 0;
  estudiantes
    .filter((e) => activo(e) && e.grado && getNivel(e.grado) === "media")
    .forEach((est) => {
      const n = notasPeriodoHonor(est, periodo);
      if (!n.length || n.some((x) => x === null)) {
        if (n.some((x) => x !== null)) incompletos++;
        return;
      }
      const reprobadas = n.filter((x) => x < 10).length;
      if (reprobadas && !incluirReprobadas) {
        conReprobada++;
        return;
      }
      candidatos.push({ est, promedio: unDecimal(n.reduce((a, b) => a + b, 0) / n.length), reprobadas });
    });
  const grados = [...new Set(candidatos.map((c) => c.est.grado))].sort(ordenGrados);
  return {
    general: puestosHonor(candidatos, 10),
    porAnio: grados.map((g) => ({
      grado: g,
      lista: puestosHonor(
        candidatos.filter((c) => c.est.grado === g),
        3
      ),
    })),
    anios: promediosPorAnio(periodo),
    incompletos,
    conReprobada,
  };
}

const medallaHonor = (p) => MEDALLAS[p - 1] || p + "°";
function filaHonor(x, conAnio) {
  return `<tr><td class="honor-puesto">${medallaHonor(x.puesto)}</td><td style="text-align:left"><strong>${escHtml(x.est.nombre)}</strong>${
    x.reprobadas ? ` <span class="badge badge-red">${x.reprobadas} reprobada${x.reprobadas > 1 ? "s" : ""}</span>` : ""
  }</td>${conAnio ? `<td>${escHtml(x.est.grado)}${x.est.seccion ? " " + escHtml(x.est.seccion) : ""}</td>` : ""}<td class="honor-prom">${textoNota(x.promedio)}</td></tr>`;
}
function htmlAniosHonor(anios) {
  if (!anios.length) return "";
  let puesto = 0;
  return `<div class="section-title">Años con mejor promedio</div>
    <table class="sab-tabla honor-tabla honor-anios-tabla"><thead><tr><th>Puesto</th><th style="text-align:left">Año</th><th>Promedio</th><th>Con notas</th><th>Con materias reprobadas</th></tr></thead>
    <tbody>${anios
      .map((a, i) => {
        puesto = i > 0 && a.promedio === anios[i - 1].promedio ? puesto : i + 1;
        return `<tr><td class="honor-puesto">${medallaHonor(puesto)}</td><td style="text-align:left"><strong>${escHtml(a.grado)}</strong></td><td class="honor-prom">${textoNota(a.promedio)}</td><td>${a.conNotas} de ${a.inscritos}</td><td>${a.reprobados || "-"}</td></tr>`;
      })
      .join("")}</tbody></table>`;
}
function htmlCuadroHonor(c) {
  if (!c.general.length)
    return `${htmlAniosHonor(c.anios)}<div class="empty-state" style="padding:0.8rem">Los mejores promedios aparecen cuando haya estudiantes con nota en todas sus materias.</div>`;
  return `${htmlAniosHonor(c.anios)}<div class="section-title">Mejores promedios de media general</div>
    <table class="sab-tabla honor-tabla"><thead><tr><th>Puesto</th><th style="text-align:left">Estudiante</th><th>Año</th><th>Promedio</th></tr></thead>
    <tbody>${c.general.map((x) => filaHonor(x, true)).join("")}</tbody></table>
    <div class="honor-anios">${c.porAnio
      .map(
        (a) => `<div class="honor-anio"><div class="section-title">${escHtml(a.grado)}</div>
      <table class="sab-tabla honor-tabla"><tbody>${a.lista.map((x) => filaHonor(x, false)).join("")}</tbody></table></div>`
      )
      .join("")}</div>`;
}
function notaExcluidosHonor(c) {
  return [
    c.incompletos
      ? `${c.incompletos} estudiante${c.incompletos > 1 ? "s" : ""} todavía sin nota en todas sus materias`
      : "",
    c.conReprobada ? `${c.conReprobada} con alguna materia reprobada` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

function renderCuadroHonor() {
  const periodo = periodoHonor();
  const c = cuadroHonor(periodo, conReprobadasHonor());
  const fuera = notaExcluidosHonor(c);
  return `<div class="card">
    <div class="card-title"><div class="card-bar"></div><h2>🏆 Cuadro de honor</h2>
      ${c.general.length || c.anios.length ? `<button class="btn btn-gray btn-sm" style="margin-left:auto" onclick="imprimirCuadroHonor()">🖨️ Imprimir</button>` : ""}
    </div>
    <div class="form-grid">
      <div class="field"><label class="field-label">Período</label>
        <select class="inp" id="honor-periodo" onchange="filtros.honorPeriodo=this.value;renderTabContent()">${PERIODOS_HONOR.map(
          ([k, t]) => `<option value="${k}" ${k === periodo ? "selected" : ""}>${t}</option>`
        ).join("")}</select></div>
    </div>
    <label style="display:flex;gap:0.5rem;align-items:center;font-size:0.8rem;margin-top:0.5rem;cursor:pointer"><input type="checkbox" id="honor-reprobadas" ${conReprobadasHonor() ? "checked" : ""} onchange="filtros.honorReprobadas=this.checked;renderTabContent()"/> Incluir a quienes tienen alguna materia reprobada</label>
    <div class="ayuda" style="margin-top:0.4rem">El promedio de cada año es el de todos sus estudiantes con notas. En los mejores promedios solo entra quien ya tiene nota en todas sus materias en el ${escHtml(nombrePeriodoHonor(periodo))}. Los empatados comparten el puesto.${fuera ? " No entran: " + escHtml(fuera) + "." : ""}</div>
  </div>
  <div class="card cuadro-honor">${
    c.general.length || c.anios.length
      ? htmlCuadroHonor(c)
      : `<div class="empty-state">🏆 Todavía no hay estudiantes de media general con nota en todas sus materias en el ${escHtml(nombrePeriodoHonor(periodo))}.</div>`
  }</div>`;
}

function imprimirCuadroHonor() {
  const periodo = periodoHonor();
  const c = cuadroHonor(periodo, conReprobadasHonor());
  const w = abrirVentanaImpresion();
  w.document
    .write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Cuadro de honor</title><style>${ESTILOS_SABANA.replace("letter landscape", "letter")}
    .honor-tabla{margin-bottom:10px}.honor-puesto{font-size:15px;width:60px}.honor-prom{font-weight:800;font-size:13px;color:#003366;width:80px}
    .honor-anios{display:grid;grid-template-columns:1fr 1fr;gap:10px}.honor-anio{break-inside:avoid}
    h2.titulo{text-align:center;color:#003366;font-size:20px;margin:10px 0 2px}p.sub{text-align:center;margin:0 0 12px;color:#555}</style></head><body>
    <button class="no-print" onclick="window.print()">🖨️ Imprimir</button>
    ${encabezadoSabana("Media general", escHtml(nombrePeriodoHonor(periodo)))}
    <h2 class="titulo">🏆 CUADRO DE HONOR</h2><p class="sub">${periodo === "anio" ? "Año escolar" : escHtml(periodo)} · Media general</p>
    ${htmlCuadroHonor(c)}
    <div class="firmas"><div>Coordinación</div><div>Dirección</div></div>
  </body></html>`);
  w.document.close();
}
