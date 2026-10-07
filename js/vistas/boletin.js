// Boletín de calificaciones para imprimir (media general y preescolar/primaria).

function imprimirBoletin(estId){
  const est = estudiantes.find(e=>e.id===estId);
  if(!est){alert("Estudiante no encontrado");return;}
  const nivel = getNivel(est.grado);
  if(nivel==="primaria"||nivel==="preescolar"){
    imprimirBoletinPrimaria(est);
  } else {
    imprimirBoletinMedia(est);
  }
}
function imprimirBoletinMedia(est){
  const estId = est.id;
  const inst = configInst||{};
  const buildRows = () => getAreas(est.grado).map(m=>{
    const promLapsos = LAPSOS.map(lapso=>{
      const k=`${estId}_${lapso}`;
      const n=notas[k]||{};
      const vals=[n[m+"_1"],n[m+"_2"],n[m+"_3"]].filter(v=>v!==undefined&&v!=="");
      return vals.length?Math.round(vals.reduce((a,b)=>a+parseFloat(b),0)/vals.length*10)/10:null;
    });
    const validos=promLapsos.filter(v=>v!==null);
    const nf=validos.length?Math.round(validos.reduce((a,b)=>a+b,0)/validos.length*10)/10:null;
    const inaLapsos = LAPSOS.map(lapso=>{
      const k=`${estId}_${lapso}`;
      return (notas[k]||{})[m+"_ina"]||0;
    });
    const color=n=>n===null?"#999":n>=18?"#1a6e3c":n>=14?"#7a6000":"#b91c1c";
    const aprobada = nf!==null&&nf>=10;
    return `<tr>
      <td style="padding:5px 8px;font-weight:600;border:1px solid #ccc;font-size:0.8rem">${escHtml(m)}</td>
      `+promLapsos.map((p,i)=>'<td style="text-align:center;padding:4px;border:1px solid #ccc;color:'+color(p)+';font-weight:700;font-size:0.8rem">'+( p!==null?p:"-")+'</td><td style="text-align:center;padding:4px;border:1px solid #ccc;color:#888;font-size:0.75rem">'+( inaLapsos[i]||"-")+'</td>').join("")+`
      <td style="text-align:center;padding:4px;border:1px solid #ccc">
        <span style="background:${nf===null?"#f1f3f5":nf>=10?"#dcfce7":"#fee2e2"};color:${color(nf)};padding:1px 6px;border-radius:4px;font-weight:800;font-size:0.8rem">${nf!==null?nf:"-"}</span>
      </td>
      <td style="text-align:center;padding:4px;border:1px solid #ccc;font-size:0.75rem;color:#888"></td>
      <td style="text-align:center;padding:4px;border:1px solid #ccc;font-size:0.75rem;color:${aprobada?"#1a6e3c":"#b91c1c"}">${nf!==null?(aprobada?"✓":"✗"):""}</td>
      <td style="padding:4px;border:1px solid #ccc"></td>
    </tr>`;
  }).join("");

  const materiasPendientes = getAreas(est.grado).filter(m=>{
    const validos = LAPSOS.map(lapso=>{
      const k=`${estId}_${lapso}`;
      const n=notas[k]||{};
      const vals=[n[m+"_1"],n[m+"_2"],n[m+"_3"]].filter(v=>v!==undefined&&v!=="");
      return vals.length?vals.reduce((a,b)=>a+parseFloat(b),0)/vals.length:null;
    }).filter(v=>v!==null);
    const nf = validos.length?validos.reduce((a,b)=>a+b,0)/validos.length:null;
    return nf!==null&&nf<10;
  });

  const w = window.open("","_blank");
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
  <title>Boletín ${escHtml(est.nombre)}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:Arial,sans-serif;padding:16px;font-size:12px;color:#111}
    .header{display:flex;align-items:center;gap:12px;border-bottom:2px solid #003366;padding-bottom:10px;margin-bottom:10px}
    .header-text{flex:1;text-align:center}
    .header-text h2{font-size:0.85rem;color:#003366;font-weight:800}
    .header-text p{font-size:0.7rem;color:#555}
    .datos-grid{display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-bottom:10px;background:#f8faff;padding:8px;border-radius:6px;border:1px solid #e0e8f0}
    .dato{display:flex;gap:4px;font-size:0.75rem}
    .dato label{font-weight:700;color:#003366;min-width:80px}
    table{width:100%;border-collapse:collapse;font-size:0.75rem;margin-bottom:10px}
    thead th{background:#003366;color:#fff;padding:5px 4px;text-align:center;border:1px solid #002244;font-size:0.72rem}
    .area-col{width:130px;font-weight:700}
    .firma-row{display:flex;justify-content:space-around;margin-top:24px}
    .firma{text-align:center;width:140px}
    .firma-line{border-top:1px solid #333;margin-top:40px;padding-top:4px;font-size:0.7rem;color:#555}
    @media print{button{display:none!important}}
  </style></head><body>
  <button onclick="window.print()" style="margin-bottom:12px;padding:6px 14px;background:#003366;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:0.8rem">🖨️ Imprimir</button>

  <div class="header">
    <div style="text-align:center;min-width:60px"><div style="font-size:1.5rem">🏫</div></div>
    <div class="header-text">
      <p style="font-size:0.68rem;color:#666">REPÚBLICA BOLIVARIANA DE VENEZUELA · MINISTERIO DEL PODER POPULAR PARA LA EDUCACIÓN</p>
      <h2>${escHtml(inst.nombre)||"U.E.P. Josefa Joaquina Sánchez"}</h2>
      <p>${escHtml(inst.direccion)||"Turumo - Caucagüita, Estado Miranda"}</p>
      <p style="font-weight:700;font-size:0.8rem;color:#003366;margin-top:3px">BOLETÍN DE CALIFICACIONES</p>
    </div>
    <div style="text-align:center;min-width:60px"><div style="font-size:1.5rem">🏫</div></div>
  </div>

  <div class="datos-grid">
    <div class="dato"><label>Estudiante:</label><span style="font-weight:700">${escHtml(est.nombre)}</span></div>
    <div class="dato"><label>Código:</label><span>${escHtml(inst.codigo)||"PD13831519"}</span></div>
    <div class="dato"><label>Cédula:</label><span>${escHtml(est.cedula)||"N/A"}</span></div>
    <div class="dato"><label>Curso:</label><span>${escHtml(est.grado)}</span></div>
    <div class="dato"><label>Sección:</label><span>${escHtml(est.seccion)||"U"}</span></div>
    <div class="dato"><label>Año escolar:</label><span>${escHtml(est.anioEscolar)||escHtml(inst.anioEscolar)||"2025-2026"}</span></div>
    <div class="dato"><label>F. Nacimiento:</label><span>${escHtml(est.fechaNac)||"N/A"}</span></div>
    <div class="dato"><label>Representante:</label><span>${escHtml(est.acudiente)||"N/A"}</span></div>
  </div>

  <table>
    <thead>
      <tr>
        <th class="area-col" rowspan="2">ÁREA DE FORMACIÓN</th>
        `+LAPSOS.map(l=>"<th colspan='2'>"+l+"</th>").join("")+`
        <th rowspan="2">DEFINITIVA</th>
        <th rowspan="2">ÁREA A REVISAR</th>
        <th rowspan="2">CALIFICACIÓN</th>
        <th rowspan="2">PROCESO DE REVISIÓN</th>
      </tr>
      <tr>`+LAPSOS.map(()=>"<th>Nota</th><th>INA</th>").join("")+`</tr>
    </thead>
    <tbody>${buildRows()}</tbody>
  </table>

  `+(materiasPendientes.length>0?'<div style="margin-bottom:8px;padding:6px 10px;background:#fff3e0;border-radius:6px;border-left:3px solid #e65100;font-size:0.78rem"><strong style="color:#e65100">⚠️ Materias pendientes:</strong> '+materiasPendientes.map(escHtml).join(", ")+'</div>':"")+`

  <div style="font-size:0.72rem;color:#555;margin-bottom:10px;padding:8px;background:#f8faff;border-radius:6px">
    <strong>Observaciones:</strong> _______________________________________________________________________________________________________________
  </div>

  <div class="firma-row">
    <div class="firma"><div class="firma-line">${escHtml(inst.directora)||"Lic. Ligia Herrera"}<br/>Directora</div></div>
    <div class="firma"><div class="firma-line">${escHtml(inst.coordinador)||"Lic. Carlos Carrascal"}<br/>Coordinador(a) Media General</div></div>
    <div class="firma"><div class="firma-line">___________________<br/>Docente</div></div>
  </div>
  <div style="text-align:center;margin-top:16px;font-size:0.7rem;color:#aaa">Sello del Plantel</div>
  </body></html>`);
  w.document.close();
  setTimeout(()=>w.print(),500);
}
function imprimirBoletinPrimaria(est){
  const estId = est.id;
  const inst = configInst||{};
  const esPreescolar = getNivel(est.grado)==="preescolar";
  const areas = esPreescolar ? AREAS_MATERNAL : AREAS_PRIMARIA;

  const LETRAS_LEGEND = [
    ["A","El alumno alcanzó todas las competencias y en algunos casos superó las expectativas previstas para el grado."],
    ["B","El alumno alcanzó todas las competencias previstas para el grado."],
    ["C","El alumno alcanzó la mayoría de las competencias previstas para el grado."],
    ["D","El alumno alcanzó algunas de las competencias previstas para el grado, pero requiere de un proceso de nivelación."],
    ["E","El alumno no logró adquirir las competencias mínimas requeridas para ser promovido al grado superior inmediato."],
  ];

  // Count total asistencia e inasistencia
  let totalAsist = 0, totalInasist = 0;
  LAPSOS.forEach(lapso=>{
    const k=`${estId}_${lapso}`;
    const nd = notas[k]||{};
    totalAsist += parseInt(nd._asistencia||0);
    totalInasist += parseInt(nd._inasistencia||0);
  });

  // Build rows for each lapso
  const buildRowsPrimaria = (lapso) => {
    const k=`${estId}_${lapso}`;
    const nd=notas[k]||{};
    return areas.map(area=>{
      const inds = getIndicadores(est.grado, area);
      if(!inds||inds.length===0){
        return `<tr>
          <td style="writing-mode:vertical-rl;transform:rotate(180deg);text-align:center;font-weight:700;font-size:0.7rem;padding:4px;border:1px solid #ccc;background:#f0f4ff;color:#003366" rowspan="1">${escHtml(area)}</td>
          <td style="padding:5px 8px;border:1px solid #ccc;font-size:0.75rem;color:#aaa" colspan="6">Sin indicadores configurados</td>
        </tr>`;
      }
      return inds.map((ind,i)=>{
        const fieldKey = area+"_ind_"+i;
        const val = nd[fieldKey]||"";
        return `<tr>
          `+(i===0?'<td style="writing-mode:vertical-rl;transform:rotate(180deg);text-align:center;font-weight:700;font-size:0.7rem;padding:4px;border:1px solid #ccc;background:#f0f4ff;color:#003366" rowspan="'+inds.length+'">'+escHtml(area)+'</td>':"")+`
          <td style="padding:4px 8px;border:1px solid #ccc;font-size:0.75rem">${escHtml(ind)}</td>
          ${["A","B","C","D","E"].map(l=>`<td style="text-align:center;border:1px solid #ccc;padding:3px;font-weight:700;color:${val===l?"#003366":"#ccc"}">${val===l?"✓":""}</td>`).join("")}
        </tr>`;
      }).join("");
    }).join("");
  };

  // Determine if promovido
  const tieneE = areas.some(area=>{
    const inds = getIndicadores(est.grado,area)||[];
    return inds.some((_,i)=>{
      const fieldKey=area+"_ind_"+i;
      return LAPSOS.some(lapso=>(notas[`${estId}_${lapso}`]||{})[fieldKey]==="E");
    });
  });

  const w = window.open("","_blank");
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
  <title>Boletín Primaria ${escHtml(est.nombre)}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:Arial,sans-serif;padding:14px;font-size:11px;color:#111}
    .header{display:flex;align-items:center;gap:10px;border-bottom:2px solid #003366;padding-bottom:8px;margin-bottom:8px}
    .header-text{flex:1;text-align:center}
    .header-text h2{font-size:0.82rem;color:#003366;font-weight:800}
    .datos-grid{display:grid;grid-template-columns:1fr 1fr;gap:3px;margin-bottom:8px;background:#f8faff;padding:6px;border-radius:6px;border:1px solid #e0e8f0}
    .dato{display:flex;gap:4px;font-size:0.72rem}
    .dato label{font-weight:700;color:#003366;min-width:90px}
    .lapso-title{background:#003366;color:#fff;padding:5px 10px;font-size:0.78rem;font-weight:700;border-radius:4px;margin:8px 0 4px}
    table{width:100%;border-collapse:collapse;margin-bottom:6px}
    thead th{background:#003366;color:#fff;padding:4px;text-align:center;border:1px solid #002244;font-size:0.7rem}
    .leyenda{background:#f8faff;border:1px solid #e0e8f0;border-radius:6px;padding:8px;margin-top:8px;font-size:0.7rem}
    .firma-row{display:flex;justify-content:space-around;margin-top:20px}
    .firma{text-align:center;width:130px}
    .firma-line{border-top:1px solid #333;margin-top:36px;padding-top:4px;font-size:0.68rem;color:#555}
    @media print{button{display:none!important}.page-break{page-break-before:always}}
  </style></head><body>
  <button onclick="window.print()" style="margin-bottom:10px;padding:6px 14px;background:#003366;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:0.8rem">🖨️ Imprimir</button>

  <div class="header">
    <div style="font-size:1.4rem">🏫</div>
    <div class="header-text">
      <p style="font-size:0.65rem;color:#666">REPÚBLICA BOLIVARIANA DE VENEZUELA · MINISTERIO DEL PODER POPULAR PARA LA EDUCACIÓN</p>
      <h2>${escHtml(inst.nombre)||"U.E.P. Josefa Joaquina Sánchez"}</h2>
      <p style="font-size:0.7rem">${escHtml(inst.direccion)||"Turumo - Caucagüita, Estado Miranda"}</p>
      <p style="font-weight:700;font-size:0.78rem;color:#003366;margin-top:2px">BOLETÍN DE CALIFICACIONES — ${esPreescolar?"EDUCACIÓN INICIAL":"EDUCACIÓN PRIMARIA"}</p>
    </div>
    <div style="font-size:1.4rem">🏫</div>
  </div>

  <div class="datos-grid">
    <div class="dato"><label>Estudiante:</label><span style="font-weight:700">${escHtml(est.nombre)}</span></div>
    <div class="dato"><label>Código plantel:</label><span>${escHtml(inst.codigo)||"PD13831519"}</span></div>
    <div class="dato"><label>Cédula:</label><span>${escHtml(est.cedula)||"N/A"}</span></div>
    <div class="dato"><label>Grado:</label><span>${escHtml(est.grado)}</span></div>
    <div class="dato"><label>Sección:</label><span>${escHtml(est.seccion)||"U"}</span></div>
    <div class="dato"><label>Año escolar:</label><span>${escHtml(est.anioEscolar)||escHtml(inst.anioEscolar)||"2025-2026"}</span></div>
    <div class="dato"><label>F. Nacimiento:</label><span>${escHtml(est.fechaNac)||"N/A"}</span></div>
    <div class="dato"><label>Representante:</label><span>${escHtml(est.acudiente)||"N/A"}</span></div>
  </div>

  ${LAPSOS.map((lapso,li)=>`
    ${li>0?'<div class="page-break"></div>':""}
    <div class="lapso-title">📋 ${lapso} — Escala alfabética para evaluar los indicadores</div>
    <table>
      <thead><tr>
        <th style="width:110px">ÁREA DE FORMACIÓN</th>
        <th>INDICADORES</th>
        <th style="width:24px">A</th>
        <th style="width:24px">B</th>
        <th style="width:24px">C</th>
        <th style="width:24px">D</th>
        <th style="width:24px">E</th>
      </tr></thead>
      <tbody>${buildRowsPrimaria(lapso)}</tbody>
    </table>
  `).join("")}

  <div style="margin-top:10px">
    <p style="font-weight:700;font-size:0.75rem">OBSERVACIONES GENERALES:</p>
    <div style="border-bottom:1px solid #333;margin:6px 0;height:16px"></div>
    <div style="border-bottom:1px solid #333;margin:6px 0;height:16px"></div>
    <div style="border-bottom:1px solid #333;margin:6px 0;height:16px"></div>
  </div>

  <div style="display:flex;justify-content:space-between;margin-top:8px;font-size:0.75rem">
    <span><strong>Cantidad de asistencia:</strong> ${totalAsist||"___"}</span>
    <span><strong>Cantidad de inasistencia:</strong> ${totalInasist||"___"}</span>
  </div>

  <div class="leyenda">
    <strong>Leyenda:</strong>
    ${LETRAS_LEGEND.map(([l,d])=>`<div style="margin-top:3px"><strong>${l}:</strong> ${d}</div>`).join("")}
  </div>

  <div style="margin-top:10px;padding:8px;border:1px solid #ccc;border-radius:6px;font-size:0.75rem">
    <p>( ) <strong>Promovido(a)</strong> al ________________ grado con el literal: _______</p>
    <p style="margin-top:4px">( ) <strong>No Promovido</strong> al ________________ grado.</p>
    <p style="margin-top:4px"><strong>Fecha de Entrega:</strong> _______________</p>
  </div>

  <div class="firma-row">
    <div class="firma"><div class="firma-line">___________________<br/>Docente</div></div>
    <div class="firma"><div class="firma-line">${escHtml(inst.coordinadorPrimaria)||"___________________"}<br/>Coordinadora</div></div>
    <div class="firma"><div class="firma-line">${escHtml(inst.directora)||"Lic. Ligia Herrera"}<br/>Directora</div></div>
  </div>
  <div style="text-align:center;margin-top:16px;font-size:0.7rem;color:#aaa">Sello del Plantel</div>
  </body></html>`);
  w.document.close();
  setTimeout(()=>w.print(),600);
}
