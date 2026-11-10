// Boletín informativo de preescolar y primaria, como el modelo del colegio: uno por lapso, con portada (membrete,
// datos del estudiante, coordinadora y directora) y luego el proyecto del lapso y la tabla de áreas e indicadores
// con la escala A-E marcada con ✓. Al final, observaciones y asistencias (se llenan a mano), la leyenda y las
// firmas de docente, coordinadora y directora con el sello.
// Los indicadores de cada lapso y el nombre del proyecto se configuran en Configuración → Indicadores.

const ORDINAL_LAPSO_LARGO = ["Primer", "Segundo", "Tercer"];
const LEYENDA_LITERALES = [
  ["A", "El alumno alcanzó todas las competencias y en algunos casos superó las expectativas previstas para el grado."],
  ["B", "El alumno alcanzó todas las competencias previstas para el grado."],
  ["C", "El alumno alcanzó la mayoría de las competencias previstas para el grado."],
  [
    "D",
    "El alumno alcanzó algunas de las competencias previstas para el grado, pero requiere de un proceso de nivelación al inicio del nuevo año escolar para alcanzar las restantes.",
  ],
  [
    "E",
    "El alumno no logró adquirir las competencias mínimas requeridas para ser promovido al grado superior inmediato.",
  ],
];

function imprimirBoletinPrimaria(est, lapso) {
  abrirBoletinesPrimaria(`Boletín ${est.nombre} · ${lapso}`, [cuerpoBoletinPrimaria(est, lapso)]);
}

const ESTILOS_BOLETIN_PRIM = `
  *{margin:0;padding:0;box-sizing:border-box}
  html{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  body{font-family:Arial,"Segoe UI",sans-serif;color:#1c2333;font-size:11px;background:#fff}
  .bp-hoja{position:relative;padding:14px 18px;min-height:100%}
  .bp-hoja+.bp-hoja{break-before:page;page-break-before:always}
  .bp-marco{border:2px solid #003366;border-radius:14px;padding:16px 18px 32px;min-height:250mm;display:flex;flex-direction:column;position:relative;overflow:hidden}
  .bp-bandera{position:absolute!important;left:0;right:0;bottom:0;height:22px;display:flex}
  .bp-bandera i{flex:1}.bp-bandera i:nth-child(1){background:#f5c400}.bp-bandera i:nth-child(3){background:#c8102e}
  .bp-bandera i:nth-child(2){background:#0b3d91;display:flex;align-items:center;justify-content:center}
  .bp-bandera svg{height:20px}
  .bp-marca{position:absolute;left:50%;top:55%;width:60%;transform:translate(-50%,-50%);opacity:.05;pointer-events:none}
  .bp-marco>*:not(.bp-marca){position:relative}
  .bp-enc{display:grid;grid-template-columns:90px 1fr 150px;align-items:center;gap:10px}
  .bp-escudo{width:86px;height:86px;object-fit:contain}
  .bp-min{max-width:150px;max-height:62px;object-fit:contain;justify-self:end}
  .bp-membrete{text-align:center;font-weight:700;font-size:11.5px;line-height:1.35;text-transform:uppercase}
  .bp-lema{text-align:center;color:#00509e;font-style:italic;font-weight:700;font-size:13px;margin:16px 0 8px}
  .bp-titulo{text-align:center;color:#003366;font-weight:800;font-size:14px;line-height:1.4;border-top:2px solid #ffd700;border-bottom:2px solid #ffd700;padding:8px 0;margin:0 30px}
  .bp-cuerpo{flex:1;display:flex;flex-direction:column;justify-content:center;width:78%;margin:18px auto 0;text-align:center}
  .bp-campo{margin-bottom:20px}
  .bp-campo label{display:block;font-weight:700;font-size:11.5px;color:#003366;letter-spacing:.02em}
  .bp-campo div{border-bottom:1.5px solid #1c2333;min-height:24px;padding:3px 6px 2px;font-size:15px;font-family:Georgia,"Times New Roman",serif}
  .bp-fila{display:flex;gap:28px}.bp-fila .bp-campo{flex:1}
  .bp-ninos{width:170px;max-height:220px;object-fit:contain}
  .bp-autoridades{display:flex;justify-content:space-between;padding-top:24px;font-size:12px;font-style:italic}
  .bp-autoridades b{color:#003366}
  .bp-anio{text-align:center;font-weight:800;font-size:15px;color:#003366;margin:26px 0 8px}
  .bp-lapso{text-align:center;font-weight:800;font-size:15px;color:#003366}
  .bp-proyecto{text-align:center;font-weight:700;font-style:italic;font-size:13px;margin:4px 30px 10px;line-height:1.35}
  .bp-proyecto b{color:#003366;font-style:normal}
  .bp-mini{display:flex;justify-content:space-between;font-size:9px;color:#5b6577;border-bottom:1px solid #d9e2f1;padding-bottom:4px;margin-bottom:8px}
  table.bp-tabla{width:100%;border-collapse:collapse;font-size:11px}
  .bp-tabla th,.bp-tabla td{border:1px solid #1c2333;padding:5px 6px}
  .bp-tabla thead th{background:#003366;color:#fff;font-weight:700}
  .bp-tabla thead .bp-grado{font-size:15px;text-align:center;background:#e8f0fe;color:#003366}
  .bp-tabla thead .bp-escala{font-size:9.5px;background:#e8f0fe;color:#003366}
  .bp-tabla .bp-l{width:30px;text-align:center}
  .bp-tabla tr{break-inside:avoid;page-break-inside:avoid}
  .bp-area{width:62px;background:#f0f4ff;color:#003366;font-weight:800;font-size:10px;text-transform:uppercase;text-align:center;vertical-align:middle}
  .bp-area span{writing-mode:vertical-rl;transform:rotate(180deg);display:inline-block;line-height:1.2}
  .bp-ind{font-family:"Times New Roman",Georgia,serif;font-size:12.5px;line-height:1.3}
  .bp-check{color:#003366;font-size:16px;font-weight:800;line-height:1}
  .bp-vacio td{color:#9aa5b8;font-style:italic}
  .bp-pie{break-inside:avoid;page-break-inside:avoid;margin-top:12px}
  .bp-obs{font-weight:700}
  .bp-obs .ln{border-bottom:1px solid #1c2333;height:20px}
  .bp-asist{display:flex;justify-content:space-between;font-weight:700;margin:14px 0 8px}
  .bp-asist span span{display:inline-block;border-bottom:1px solid #1c2333;min-width:70px}
  .bp-leyenda{font-size:9px;line-height:1.4;font-weight:700;color:#1c2333}
  .bp-leyenda b{color:#003366}
  .bp-leyenda .t{font-size:8.5px;color:#5b6577;margin-bottom:3px}
  .bp-firmas{display:flex;justify-content:space-between;gap:20px;margin-top:46px;text-align:center;font-weight:700;font-size:11.5px}
  .bp-firmas div{flex:1;border-top:1.5px solid #1c2333;padding-top:4px}
  .bp-firmas small{display:block;font-weight:400;font-size:9.5px;color:#5b6577}
  .bp-sello{text-align:center;margin-top:20px;font-size:10px;color:#5b6577}
  .bp-sello span{display:inline-block;width:86px;height:86px;border:1.5px dashed #9aa5b8;border-radius:50%;line-height:86px}
  .no-print{margin:10px 16px 0;padding:7px 16px;background:#003366;color:#fff;border:none;border-radius:8px;font-size:12px;cursor:pointer}
  @page{size:letter portrait;margin:0}
  @media print{.no-print{display:none!important}.bp-hoja{padding:10mm 12mm;-webkit-box-decoration-break:clone;box-decoration-break:clone}}`;

function abrirBoletinesPrimaria(titulo, cuerpos) {
  const w = abrirVentanaImpresion();
  w.document
    .write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${escHtml(titulo)}</title><style>${ESTILOS_BOLETIN_PRIM}</style></head><body>
    <button class="no-print" onclick="window.print()">🖨️ Imprimir${cuerpos.length > 1 ? " los " + cuerpos.length + " boletines" : ""}</button>
    ${cuerpos.join("")}
  </body></html>`);
  w.document.close();
  setTimeout(() => w.print(), 600);
}

// Franja con los colores de la bandera de Venezuela y sus 8 estrellas blancas en arco sobre el azul
const ESTRELLA = (x, y) => {
  const p = [];
  for (let k = 0; k < 10; k++) {
    const r = k % 2 ? 1.1 : 2.6,
      ang = -Math.PI / 2 + (k * Math.PI) / 5;
    p.push((x + r * Math.cos(ang)).toFixed(2) + "," + (y + r * Math.sin(ang)).toFixed(2));
  }
  return `<polygon points="${p.join(" ")}" fill="#fff"/>`;
};
const BANDERA_BOLETIN = `<div class="bp-bandera"><i></i><i><svg viewBox="0 0 64 20" xmlns="http://www.w3.org/2000/svg">${Array.from(
  { length: 8 },
  (_, k) => {
    const ang = Math.PI * (1.1 + (0.8 * k) / 7); // de izquierda a derecha por encima del centro
    return ESTRELLA(32 + 22 * Math.cos(ang), 21 + 14 * Math.sin(ang));
  }
).join("")}</svg></i><i></i></div>`;

function portadaBoletinPrimaria(est, esPreescolar) {
  const inst = configInst || {};
  const campo = (etq, valor) => `<div class="bp-campo"><label>${etq}</label><div>${escHtml(valor || "")}</div></div>`;
  const ministerio = logoSeguro((configLogos || {}).ministerio);
  const subsistema = esPreescolar ? "Educación Inicial" : "Educación Primaria";
  const coord = esPreescolar ? inst.coordinadorInicial : inst.coordinadorPrimaria;
  return `<section class="bp-hoja"><div class="bp-marco">
    <img class="bp-marca" src="data:image/png;base64,${LOGO}" alt=""/>
    <header class="bp-enc">
      <img class="bp-escudo" src="data:image/png;base64,${LOGO}" alt="Escudo"/>
      <div class="bp-membrete">República Bolivariana de Venezuela<br/>Ministerio del Poder Popular para la Educación<br/>
        Unidad Educativa Privada Josefa Joaquina Sánchez<br/>Caucagüita, Estado Miranda<br/>Código plantel ${escHtml(inst.codigo || "PD13831519")}</div>
      ${ministerio ? `<img class="bp-min" src="${ministerio}" alt="Ministerio del Poder Popular para la Educación"/>` : "<span></span>"}
    </header>
    <div class="bp-lema">¡Construyendo saberes, formando futuros!</div>
    <div class="bp-titulo">BOLETÍN INFORMATIVO DEL SUBSISTEMA DE ${subsistema.toUpperCase()}: ${escHtml((est.grado || "").toUpperCase())}<br/>(ART. 25 LOE, 2009)</div>
    <div class="bp-cuerpo">
        ${campo("Nombres y apellidos del (la) estudiante:", est.nombre)}
        ${campo("Cédula de identidad o cédula escolar:", est.cedula)}
        <div class="bp-fila">${campo(esPreescolar ? "Nivel:" : "Grado:", est.grado)}${campo("Sección:", est.seccion || "U")}</div>
        ${campo("Nombres y apellidos del representante:", est.acudiente)}
        ${campo("Nombres y apellidos del (la) docente:", docenteDeGrado(est.grado))}
    </div>
    <div class="bp-autoridades">
      <span><b>Coordinadora:</b> ${escHtml(coord || "______________________")}</span>
      <span><b>Directora:</b> ${escHtml(inst.directora || "Lic. Ligia Herrera")}</span>
    </div>
    <div class="bp-anio">Año escolar ${escHtml(anioBoletin(est))}</div>
    ${BANDERA_BOLETIN}
  </div></section>`;
}

function cuerpoBoletinPrimaria(est, lapso) {
  lapso = LAPSOS.includes(lapso) ? lapso : LAPSOS[0];
  const esPreescolar = getNivel(est.grado) === "preescolar";
  const areas = esPreescolar ? AREAS_MATERNAL : AREAS_PRIMARIA;
  const nl = LAPSOS.indexOf(lapso);
  const notasLapso = notas[`${est.id}_${lapso}`] || {};
  const proyecto = proyectoDe(est.grado, lapso);
  // Las letras se guardan como <área>__<n° del indicador> (ver vistas/notas.js)
  const filas = areas
    .map((area) => {
      const inds = getIndicadores(est.grado, area, lapso);
      const nombre = `<td class="bp-area" rowspan="${inds.length || 1}"><span>${escHtml(nombreArea(est.grado, area))}</span></td>`;
      if (!inds.length)
        return `<tr class="bp-vacio">${nombre}<td>Sin indicadores configurados para este lapso</td>${LETRAS.map(() => "<td></td>").join("")}</tr>`;
      return inds
        .map((ind, i) => {
          const v = notasLapso[area + "__" + i];
          return `<tr>${i === 0 ? nombre : ""}<td class="bp-ind">${escHtml(ind)}</td>${LETRAS.map(
            (l) => `<td class="bp-l">${v === l ? '<span class="bp-check">✓</span>' : ""}</td>`
          ).join("")}</tr>`;
        })
        .join("");
    })
    .join("");
  const inst = configInst || {};
  return `${portadaBoletinPrimaria(est, esPreescolar)}
  <section class="bp-hoja">
    <div class="bp-mini"><span>${escHtml(est.nombre)}</span><span>${escHtml(est.grado || "")} · Sección ${escHtml(est.seccion || "U")} · Año escolar ${escHtml(anioBoletin(est))}</span></div>
    <div class="bp-lapso">${ORDINAL_LAPSO_LARGO[nl]} lapso</div>
    <div class="bp-proyecto"><b>Nombre del Proyecto:</b> ${escHtml(proyecto || "______________________________________")}</div>
    <table class="bp-tabla">
      <thead>
        <tr><th class="bp-grado" colspan="2">${escHtml(est.grado || "")}</th><th class="bp-escala" colspan="5">Escala alfabética para evaluar los indicadores</th></tr>
        <tr><th>Área de formación</th><th>Indicadores</th>${LETRAS.map((l) => `<th class="bp-l">${l}</th>`).join("")}</tr>
      </thead>
      <tbody>${filas}</tbody>
    </table>
    <div class="bp-pie">
      <div class="bp-obs">Observaciones generales:<div class="ln"></div><div class="ln"></div><div class="ln"></div></div>
      <div class="bp-asist"><span>Cantidad de asistencia: <span></span></span><span>Cantidad de inasistencia: <span></span></span></div>
      <div class="bp-leyenda"><div class="t">Leyenda</div>${LEYENDA_LITERALES.map(([l, d]) => `<div><b>${l}:</b> ${escHtml(d)}</div>`).join("")}</div>
      <div class="bp-firmas">
        <div>Docente<small>${escHtml(docenteDeGrado(est.grado))}</small></div>
        <div>Coordinadora<small>${escHtml((esPreescolar ? inst.coordinadorInicial : inst.coordinadorPrimaria) || "")}</small></div>
        <div>Directora<small>${escHtml(inst.directora || "Lic. Ligia Herrera")}</small></div>
      </div>
      <div class="bp-sello"><span>Sello</span></div>
    </div>
  </section>`;
}
