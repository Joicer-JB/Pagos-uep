// Pestaña Gráficas: estadísticas con Chart.js.

function renderGraficas(){
  const pagosDelMes = pagos.filter(p=>{
    const f = new Date(p.fecha||p.timestamp?.seconds*1000);
    const hoy = new Date();
    return f.getMonth()===hoy.getMonth() && f.getFullYear()===hoy.getFullYear();
  });

  // Recaudo últimos 6 meses
  const recaudoPorMes = [];
  for(let i=5;i>=0;i--){
    const d = new Date(); d.setMonth(d.getMonth()-i);
    const mes = d.toLocaleString("es-VE",{month:"short",year:"2-digit"});
    const total = pagos.filter(p=>{
      const f = new Date(p.fecha);
      return f.getMonth()===d.getMonth()&&f.getFullYear()===d.getFullYear();
    }).reduce((s,p)=>s+p.total,0);
    recaudoPorMes.push({mes,total});
  }
  const maxRec = Math.max(...recaudoPorMes.map(x=>x.total),1);

  // Estudiantes por grado
  const porGrado = {};
  estudiantes.forEach(e=>{
    const g = e.grado||"Sin grado";
    porGrado[g]=(porGrado[g]||0)+1;
  });
  const gradosOrden = ["Maternal","Nivel I","Nivel II","Nivel III","1er Grado","2do Grado","3er Grado","4to Grado","5to Grado","6to Grado","1er Año","2do Año","3er Año","4to Año","5to Año"];
  const gradosData = gradosOrden.filter(g=>porGrado[g]).map(g=>({grado:g,cant:porGrado[g]}));
  const maxGrado = Math.max(...gradosData.map(x=>x.cant),1);

  // Estado estudiantes
  const alSaldo = estudiantes.filter(e=>activo(e)&&!enMora(e)).length;
  const graduados = estudiantes.filter(e=>e.graduado).length;
  const nMoraG = estudiantes.filter(enMora).length;
  const retirado = estudiantes.filter(e=>e.estado==="retirado").length;
  const totalEst = estudiantes.length||1;

  // Recaudo por concepto
  const porConcepto = {};
  pagos.forEach(p=>{const c=p.concepto||"Otro";porConcepto[c]=(porConcepto[c]||0)+p.total;});
  const totalConc = Object.values(porConcepto).reduce((a,b)=>a+b,1);

  // Efectivo vs Punto
  const tmG = totalesMetodo(pagos);
  const totalMetodo = METODOS.reduce((x,[m])=>x+tmG[m].usd,0)||1;
  const colorMetodo = {"Dólares Efectivo":"#003366","Transferencia Bs":"#00509e","Bs Efectivo":"#f6a623","Punto":"#1a9e5c"};

  const COLORS = ["#003366","#00509e","#1a9e5c","#f6a623","#e53e3e","#9b59b6","#16a085","#e67e22"];

  return`
  <div class="card">
    <div class="card-title"><div class="card-bar"></div><h2>📊 Estadísticas y Gráficas</h2></div>

    <!-- Recaudo últimos 6 meses -->
    <div style="margin-bottom:1.5rem">
      <div style="font-size:0.72rem;font-weight:700;color:#003366;text-transform:uppercase;letter-spacing:1px;margin-bottom:0.75rem">📈 Recaudo Últimos 6 Meses</div>
      <div style="display:flex;align-items:flex-end;gap:0.4rem;height:120px;padding:0 0.25rem">
        ${recaudoPorMes.map(m=>`
        <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px">
          <div style="font-size:0.6rem;color:#003366;font-weight:700;writing-mode:horizontal-tb">${m.total>0?fmt(m.total).replace("$ ",""):"—"}</div>
          <div style="width:100%;background:linear-gradient(180deg,#00509e,#003366);border-radius:4px 4px 0 0;height:${Math.max(4,Math.round(m.total/maxRec*90))}px;min-height:4px;transition:height 0.5s"></div>
          <div style="font-size:0.62rem;color:#888;text-align:center">${escHtml(m.mes)}</div>
        </div>`).join("")}
      </div>
    </div>

    <!-- Estado estudiantes donut-style -->
    <div style="margin-bottom:1.5rem">
      <div style="font-size:0.72rem;font-weight:700;color:#003366;text-transform:uppercase;letter-spacing:1px;margin-bottom:0.75rem">👨‍🎓 Estado de Estudiantes</div>
      <div style="display:flex;gap:0.5rem;flex-wrap:wrap">
        ${[["✅ Al Saldo",alSaldo,"#1a9e5c"],["⚠️ En Mora",nMoraG,"#e53e3e"],["🚪 Retirados",retirado,"#888"],["🎓 Graduados",graduados,"#b8860b"]].map(([l,v,c])=>`
        <div style="flex:1;min-width:80px;background:#f8faff;border-radius:10px;padding:0.75rem;text-align:center;border-top:3px solid ${c}">
          <div style="font-size:1.3rem;font-weight:800;color:${c}">${v}</div>
          <div style="font-size:0.65rem;color:#555;margin-top:2px">${l}</div>
          <div style="margin-top:4px;background:#eee;border-radius:10px;height:5px;overflow:hidden">
            <div style="background:${c};height:5px;width:${Math.round(v/totalEst*100)}%;border-radius:10px"></div>
          </div>
          <div style="font-size:0.62rem;color:#aaa;margin-top:2px">${Math.round(v/totalEst*100)}%</div>
        </div>`).join("")}
      </div>
    </div>

    <!-- Estudiantes por grado -->
    <div style="margin-bottom:1.5rem">
      <div style="font-size:0.72rem;font-weight:700;color:#003366;text-transform:uppercase;letter-spacing:1px;margin-bottom:0.75rem">🏫 Estudiantes por Grado</div>
      ${gradosData.map((g,i)=>`
      <div style="margin-bottom:0.45rem">
        <div style="display:flex;justify-content:space-between;font-size:0.75rem;margin-bottom:2px">
          <span style="color:#444">${escHtml(g.grado)}</span>
          <span style="font-weight:700;color:#003366">${g.cant}</span>
        </div>
        <div style="background:#eef2f9;border-radius:10px;height:8px;overflow:hidden">
          <div style="background:${COLORS[i%COLORS.length]};height:8px;border-radius:10px;width:${Math.round(g.cant/maxGrado*100)}%;transition:width 0.5s"></div>
        </div>
      </div>`).join("")}
    </div>

    <!-- Método de pago -->
    <div style="margin-bottom:1.5rem">
      <div style="font-size:0.72rem;font-weight:700;color:#003366;text-transform:uppercase;letter-spacing:1px;margin-bottom:0.75rem">💳 Recaudo por método de pago</div>
      ${METODOS.map(([m,etq])=>{const pct=Math.round(tmG[m].usd/totalMetodo*100);return `<div style="margin-bottom:0.55rem">
        <div style="display:flex;justify-content:space-between;font-size:0.75rem;gap:0.5rem"><span>${etq} · ${pct}%</span><strong style="color:${colorMetodo[m]}">${txtMetodo(tmG[m])}</strong></div>
        <div style="background:#e8ecf4;border-radius:10px;height:6px;margin-top:3px"><div style="background:${colorMetodo[m]};height:6px;width:${pct}%;border-radius:10px"></div></div></div>`;}).join("")}
    </div>

    <!-- Recaudo por concepto -->
    <div>
      <div style="font-size:0.72rem;font-weight:700;color:#003366;text-transform:uppercase;letter-spacing:1px;margin-bottom:0.75rem">📂 Recaudo por Concepto</div>
      ${Object.entries(porConcepto).sort((a,b)=>b[1]-a[1]).map(([c,v],i)=>`
      <div style="margin-bottom:0.45rem">
        <div style="display:flex;justify-content:space-between;font-size:0.75rem;margin-bottom:2px">
          <span style="color:#444">${escHtml(c)}</span>
          <span style="font-weight:700;color:${COLORS[i%COLORS.length]}">${fmt(v)}</span>
        </div>
        <div style="background:#eef2f9;border-radius:10px;height:8px;overflow:hidden">
          <div style="background:${COLORS[i%COLORS.length]};height:8px;border-radius:10px;width:${Math.round(v/totalConc*100)}%"></div>
        </div>
      </div>`).join("")}
    </div>
  </div>`;
}
