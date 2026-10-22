// Pestaña Finanzas: ingresos y gastos, flujo de caja anual e impresión.

function renderFinanzas() {
  const st = subTab.finanzas;
  const mesIdx = MESES.indexOf(filtros.mes || MESES[mesActual()]);
  const anio = filtros.anio || String(anioActual());
  const mesPad = String(mesIdx >= 0 ? mesIdx + 1 : mesActual() + 1).padStart(2, "0");
  const pagosMes = pagos.filter((p) => p.fecha && p.fecha.startsWith(`${anio}-${mesPad}`));
  const ingMes = finanzas.filter((f) => f.tipo === "ingreso" && f.fecha && f.fecha.startsWith(`${anio}-${mesPad}`));
  const gasMes = finanzas.filter((f) => f.tipo === "gasto" && f.fecha && f.fecha.startsWith(`${anio}-${mesPad}`));
  const totalIng = pagosMes.reduce((s, p) => s + p.total, 0) + ingMes.reduce((s, f) => s + f.monto, 0);
  const totalGas = gasMes.reduce((s, f) => s + f.monto, 0);
  const balance = totalIng - totalGas;

  const dIng = totalesDual([
    ...pagosMes.map((p) => ({ usd: p.total, rec: p })),
    ...ingMes.map((f) => ({ usd: f.monto, rec: f })),
  ]);
  const dGas = totalesDual(gasMes.map((f) => ({ usd: f.monto, rec: f })));

  // Flujo anual (en $ de referencia y en Bs. a la tasa de cada operación)
  const flujoPorMes = MESES.map((m, i) => {
    const pre = `${anio}-${String(i + 1).padStart(2, "0")}`;
    const ingI = [
      ...pagos.filter((p) => p.fecha && p.fecha.startsWith(pre)).map((p) => ({ usd: p.total, rec: p })),
      ...finanzas
        .filter((f) => f.tipo === "ingreso" && f.fecha && f.fecha.startsWith(pre))
        .map((f) => ({ usd: f.monto, rec: f })),
    ];
    const gasI = finanzas
      .filter((f) => f.tipo === "gasto" && f.fecha && f.fecha.startsWith(pre))
      .map((f) => ({ usd: f.monto, rec: f }));
    const di = totalesDual(ingI),
      dg = totalesDual(gasI);
    return {
      mes: m,
      ing: di.usd,
      gas: dg.usd,
      bal: r2(di.usd - dg.usd),
      ingBs: di.bs,
      gasBs: dg.bs,
      balBs: r2(di.bs - dg.bs),
      sinTasa: di.sinTasa + dg.sinTasa,
    };
  });

  return `
  <div class="stabs">
    ${[
      ["resumen", "📊 Resumen"],
      ["gastos", "📉 Gastos"],
      ["flujo", "💹 Flujo de Caja"],
      ["libro", "📒 Libro"],
      ["porpagar", "🧾 Por pagar"],
      ["conciliacion", "🏦 Conciliación"],
    ]
      .map(
        ([k, l]) => `
    <button class="stab ${st === k ? "active" : ""}" onclick="subTab.finanzas='${k}';renderTabContent()">${l}</button>`
      )
      .join("")}
  </div>
  <div style="display:flex;gap:0.5rem;margin-bottom:0.85rem;flex-wrap:wrap">
    <select class="inp" style="flex:1;padding:0.6rem 0.85rem;font-size:0.82rem" onchange="filtros.mes=this.value;renderTabContent()">
      ${MESES.map((m, i) => `<option value="${m}" ${(filtros.mes || MESES[mesActual()]) === m ? "selected" : ""}>${m}</option>`).join("")}
    </select>
    <select class="inp" style="padding:0.6rem 0.85rem;font-size:0.82rem;width:auto" onchange="filtros.anio=this.value;renderTabContent()">
      ${Array.from({ length: 9 }, (_, i) => String(anioActual() - 5 + i))
        .map((a) => `<option value="${a}" ${anio === a ? "selected" : ""}>${a}</option>`)
        .join("")}
    </select>
  </div>

  ${
    st === "resumen"
      ? `
  <div style="background:linear-gradient(135deg,#003366,#00509e);border-radius:14px;padding:1.1rem 1.25rem;color:#fff;margin-bottom:0.85rem">
    <div style="font-size:0.62rem;color:#adc8ff;text-transform:uppercase;letter-spacing:1px">${escHtml(filtros.mes) || MESES[mesActual()]} ${anio}</div>
    <div class="stats-grid-3" style="margin-top:0.75rem;margin-bottom:0">
      <div style="text-align:center"><div style="font-size:0.6rem;color:#adc8ff">Ingresos</div><div style="font-weight:800;color:#7fff9f;font-size:0.95rem">${fmt(totalIng)}</div></div>
      <div style="text-align:center"><div style="font-size:0.6rem;color:#adc8ff">Gastos</div><div style="font-weight:800;color:#ffaaaa;font-size:0.95rem">${fmt(totalGas)}</div></div>
      <div style="text-align:center"><div style="font-size:0.6rem;color:#adc8ff">Balance</div><div style="font-weight:800;color:${balance >= 0 ? "#ffd700" : "#ff6b6b"};font-size:0.95rem">${fmt(balance)}</div></div>
    </div>
  </div>
  <div class="card" style="padding:0.7rem 0.9rem;margin-bottom:0.85rem">
    <div style="font-size:0.62rem;color:#003366;text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:4px">💱 En bolívares (tasa BCV de cada operación)</div>
    <div style="display:flex;justify-content:space-between;font-size:0.8rem"><span>Ingresos</span><strong style="color:#1a9e5c">${fmtBs(dIng.bs)}</strong></div>
    <div style="display:flex;justify-content:space-between;font-size:0.8rem"><span>Gastos</span><strong style="color:#e53e3e">${fmtBs(dGas.bs)}</strong></div>
    <div style="display:flex;justify-content:space-between;font-size:0.85rem;border-top:1px solid #eee;margin-top:3px;padding-top:3px"><span>Balance</span><strong style="color:${dIng.bs - dGas.bs >= 0 ? "#1a9e5c" : "#e53e3e"}">${fmtBs(r2(dIng.bs - dGas.bs))}</strong></div>
    ${dIng.sinTasa + dGas.sinTasa > 0 ? `<div style="font-size:0.68rem;color:#b8860b;margin-top:3px">⚠️ ${dIng.sinTasa + dGas.sinTasa} movimiento(s) sin tasa BCV no están incluidos en Bs.</div>` : ""}
  </div>
  <div style="display:flex;gap:0.65rem;margin-bottom:0.85rem">
    <button class="btn btn-success" style="flex:1" onclick="abrirModal({tipo:'nuevo-finanza',subtipo:'ingreso'})">📈 + Ingreso</button>
    <button class="btn btn-danger" style="flex:1" onclick="abrirModal({tipo:'nuevo-finanza',subtipo:'gasto'})">📉 + Gasto</button>
  </div>
  <div class="card">
    <div class="card-title"><div class="card-bar"></div><h2>Desglose de Ingresos</h2></div>
    ${
      [
        ["Mensualidades", pagosMes.filter((p) => p.concepto === "Mensualidad").reduce((s, p) => s + p.total, 0)],
        ["Inscripciones", pagosMes.filter((p) => p.concepto === "Inscripción").reduce((s, p) => s + p.total, 0)],
        ["Carnet y papelería", pagosMes.filter((p) => p.concepto === CONCEPTO_CARNET).reduce((s, p) => s + p.total, 0)],
        ["Uniformes", pagosMes.filter((p) => p.concepto === "Uniformes").reduce((s, p) => s + p.total, 0)],
        ["Otros ingresos", ingMes.reduce((s, f) => s + f.monto, 0)],
      ]
        .filter(([, v]) => v > 0)
        .map(
          ([l, v]) => `
    <div class="info-row"><span style="color:#555">📌 ${l}</span><span style="font-weight:700;color:#1a9e5c">${fmt(v)}</span></div>`
        )
        .join("") || '<p style="font-size:0.82rem;color:#aaa">Sin ingresos</p>'
    }
  </div>
  <div class="card">
    <div class="card-title"><div class="card-bar"></div><h2>Desglose de Gastos</h2></div>
    ${
      Object.entries(
        gasMes.reduce((acc, f) => {
          acc[f.categoria || "Otros"] = (acc[f.categoria || "Otros"] || 0) + f.monto;
          return acc;
        }, {})
      )
        .map(
          ([k, v]) => `
    <div class="info-row"><span style="color:#555">📌 ${escHtml(k)}</span><span style="font-weight:700;color:#e53e3e">${fmt(v)}</span></div>`
        )
        .join("") || '<p style="font-size:0.82rem;color:#aaa">Sin gastos</p>'
    }
  </div>`
      : ""
  }

  ${st === "libro" ? renderLibroFinanzas(anio, mesPad) : ""}
  ${st === "porpagar" ? renderCuentasPagar() : ""}
  ${st === "conciliacion" ? renderConciliacion() : ""}
  ${
    st === "gastos"
      ? `
  <button class="btn btn-danger btn-full" style="margin-bottom:0.75rem" onclick="abrirModal({tipo:'nuevo-finanza',subtipo:'gasto'})">📉 Registrar Gasto</button>
  <div class="list">
    ${gasMes
      .map(
        (f) =>
          `<div class="list-item gasto" onclick="abrirModal({tipo:'ver-finanza',id:'${f.id}'})"><div class="item-row"><div style="flex:1"><div class="item-name">${escHtml(f.descripcion)}</div><div class="item-sub">${escHtml(f.categoria) || "Gasto"} · ${escHtml(f.fecha)} ${f.responsable ? "· " + escHtml(f.responsable) : ""}</div></div><div class="item-right"><div class="item-amount" style="color:#e53e3e">${fmt(f.monto)}</div>${(() => {
            const b = bsDe(f, f.monto);
            return b.bs != null ? `<div style="font-size:0.68rem;color:#888">${fmtBs(b.bs)}</div>` : "";
          })()}</div></div></div>`
      )
      .join("")}
    ${gasMes.length === 0 ? `<div class="empty"><div class="empty-icon">📉</div><p>Sin gastos este mes</p></div>` : ""}
  </div>`
      : ""
  }

  ${
    st === "flujo"
      ? `
  <div class="card">
    <div class="card-title"><div class="card-bar"></div><h2>Flujo de Caja ${anio}</h2>
      <div style="display:flex;gap:0.4rem;margin-left:auto">
        <button class="btn btn-print btn-sm" onclick="imprimirFlujoCaja(${anio},null,false)">🖨️ Resumen</button>
        <button class="btn btn-print btn-sm" style="background:#00509e" onclick="imprimirFlujoCaja(${anio},null,true)">🖨️ Detallado</button>
      </div>
    </div>
    ${flujoPorMes
      .map(
        (m, i) => `
    <div style="margin-bottom:0.75rem;background:#f8faff;border-radius:10px;padding:0.65rem 0.85rem">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
        <span style="font-weight:700;color:#003366;font-size:0.85rem">${escHtml(m.mes)} ${anio}</span>
        <div style="display:flex;align-items:center;gap:0.5rem">
          <span style="color:${m.balBs >= 0 ? "#1a9e5c" : "#e53e3e"};font-weight:700;font-size:0.85rem">${fmtBs(m.balBs)} <span style="font-weight:400;font-size:0.68rem;color:#888">(${fmt(m.bal)})</span></span>
          <div style="display:flex;gap:0.3rem">
            <button class="btn btn-print btn-sm" style="padding:0.2rem 0.4rem;font-size:0.65rem" onclick="imprimirFlujoCaja(${anio},${i},false)" title="Resumen">📄</button>
            <button class="btn btn-print btn-sm" style="padding:0.2rem 0.4rem;font-size:0.65rem;background:#00509e" onclick="imprimirFlujoCaja(${anio},${i},true)" title="Detallado">📋</button>
          </div>
        </div>
      </div>
      <div style="display:flex;gap:0.5rem;font-size:0.72rem">
        <span style="color:#1a9e5c">▲ Ing: ${fmtBs(m.ingBs)} <small style="color:#888">(${fmt(m.ing)})</small></span><span style="color:#ccc">·</span><span style="color:#e53e3e">▼ Gas: ${fmtBs(m.gasBs)} <small style="color:#888">(${fmt(m.gas)})</small></span>${m.sinTasa ? `<span title="Movimientos sin tasa BCV" style="color:#b8860b">⚠️${m.sinTasa}</span>` : ""}
      </div>
      <div class="progress-bar" style="margin-top:5px"><div class="progress-fill" style="width:${Math.min(100, m.ing > 0 ? 100 : 0)}%"></div></div>
    </div>`
      )
      .join("")}
  </div>`
      : ""
  }`;
}
function renderModalFinanza(m) {
  const isIng = m.subtipo === "ingreso";
  // Al pagar una cuenta por pagar, el gasto ya viene lleno con sus datos
  const pre = m.cuentaId ? cuentasPagar.find((c) => c.id === m.cuentaId) || null : null;
  const enUsd = pre ? pre.moneda === "USD" : isIng;
  if (pre) setTimeout(calcFin, 0);
  const categoriasGasto = ["Nómina", "Servicios", "Materiales", "Mantenimiento", "Transporte", "Alimentación", "Otros"];
  const categoriasIng = ["Donación", "Evento", "Subsidio", "Otros ingresos"];
  return `<div class="modal-bg"><div class="modal">
    <div class="modal-header" style="background:${isIng ? "linear-gradient(135deg,#1a9e5c,#27ae60)" : "linear-gradient(135deg,#c0392b,#e53e3e)"}">
      <div><h3>${isIng ? "📈 Nuevo Ingreso" : "📉 Nuevo Gasto"}</h3></div>
      <button class="modal-close-x" onclick="cerrarModal()">✕</button>
    </div>
    <div class="modal-body">
      <div class="form-grid">
        <div class="field"><label class="field-label">Descripción *</label><input class="inp" id="fin-desc" placeholder="${isIng ? "Ej: Donación institución" : "Ej: Pago de agua"}" value="${pre ? escHtml(pre.descripcion) : ""}"/></div>
        <div class="form-row">
          <div class="field"><label class="field-label">Fecha *</label><input class="inp" type="date" id="fin-fecha" max="${todayStr()}" value="${todayStr()}" onchange="actualizarTasaCampo('fin',calcFin)"/></div>
          <div class="field"><label class="field-label">Categoría</label>
            <select class="inp" id="fin-cat">
              ${(isIng ? categoriasIng : categoriasGasto).map((c) => `<option value="${c}" ${pre && pre.categoria === c ? "selected" : ""}>${c}</option>`).join("")}
            </select>
          </div>
        </div>
        <div class="field"><label class="field-label">Monto * <span style="font-weight:400;color:#888">(¿en qué moneda lo escribes?)</span></label>
          <div class="metodo-row" style="margin-bottom:0.4rem">
            <button type="button" class="metodo-btn ${enUsd ? "" : "selected"}" id="fin-m-ves" onclick="selMonedaFin('VES')">🇻🇪 Bolívares (Bs.)</button>
            <button type="button" class="metodo-btn ${enUsd ? "selected" : ""}" id="fin-m-usd" onclick="selMonedaFin('USD')">💵 Dólares (ref.)</button>
          </div>
          <div style="position:relative"><span id="fin-simbolo" style="position:absolute;left:0.9rem;top:50%;transform:translateY(-50%);color:${isIng ? "#1a9e5c" : "#e53e3e"};font-weight:700">${enUsd ? "$" : "Bs."}</span>
          <input class="inp" id="fin-monto" placeholder="0,00" style="padding-left:3rem" oninput="fmtInput(this);calcFin()" value="${pre ? String(pre.monto).replace(".", ",") : ""}"/></div></div>
        ${campoTasaHTML("fin", null, "calcFin()")}
        <div id="fin-equiv" style="display:none;background:#e8f0fe;border-radius:10px;padding:0.65rem 0.85rem;font-size:0.82rem;color:#003366"></div>
        <div class="field"><label class="field-label">Responsable</label><input class="inp" id="fin-resp" placeholder="Quién realizó el gasto/ingreso" value="${pre ? escHtml(pre.proveedor) : ""}"/></div>
        <div class="field"><label class="field-label">Observaciones</label><textarea class="inp" id="fin-obs" rows="2" placeholder="Detalles adicionales"></textarea></div>
        <div id="fin-err"></div>
      </div>
    </div>
    <div class="modal-actions">
      <button class="btn ${isIng ? "btn-success" : "btn-danger"}" style="flex:1" onclick="guardarFinanza('${m.subtipo}')">✓ Guardar ${isIng ? "Ingreso" : "Gasto"}</button>
      <button class="btn btn-gray" onclick="cerrarModal()">Cancelar</button>
    </div>
  </div></div>`;
}
function renderModalVerFinanza(m) {
  const f = finanzas.find((x) => x.id === m.id);
  if (!f) return "";
  return `<div class="modal-bg" onclick="if(event.target.classList.contains('modal-bg'))cerrarModal()">
    <div class="modal">
      <div class="modal-header" style="background:${f.tipo === "ingreso" ? "linear-gradient(135deg,#1a9e5c,#27ae60)" : "linear-gradient(135deg,#c0392b,#e53e3e)"}">
        <div><h3>${f.tipo === "ingreso" ? "📈" : "📉"} ${escHtml(f.descripcion)}</h3><p>${escHtml(f.categoria) || ""} · ${escHtml(f.fecha)}</p></div>
        <button class="modal-close-x" onclick="cerrarModal()">✕</button>
      </div>
      <div class="modal-body">
        ${[
          ["Descripción", f.descripcion],
          ["Fecha", f.fecha],
          ["Categoría", f.categoria || "N/A"],
          ["Responsable", f.responsable || "N/A"],
          ["Observaciones", f.observaciones || "N/A"],
          ...(f.registradoPor ? [["Registrado por", nombreUsuario(f.registradoPor)]] : []),
        ]
          .map(
            ([l, v]) => `
        <div class="info-row"><span style="color:#888;font-size:0.8rem">${l}</span><span style="font-weight:600;font-size:0.82rem">${escHtml(v)}</span></div>`
          )
          .join("")}
        <div style="margin-top:0.85rem;padding:0.85rem 1rem;background:${f.tipo === "ingreso" ? "#e6f7ef" : "#fff5f5"};border-radius:10px;display:flex;justify-content:space-between">
          <span style="font-weight:700;color:${f.tipo === "ingreso" ? "#1a9e5c" : "#e53e3e"}">Monto</span>
          <span style="font-size:1.2rem;font-weight:800;color:${f.tipo === "ingreso" ? "#1a9e5c" : "#e53e3e"}">${fmt(f.monto)}</span>
        </div>
        ${(() => {
          const b = bsDe(f, f.monto);
          return b.bs != null
            ? `<div style="margin-top:0.5rem;padding:0.7rem 1rem;background:#f0f4ff;border-radius:10px;display:flex;justify-content:space-between"><span style="font-weight:700;color:#003366">En bolívares${b.estimada ? " (est.)" : ""}</span><span style="font-weight:800;color:#003366">${fmtBs(b.bs)}</span></div><div style="font-size:0.7rem;color:#888;text-align:right;margin-top:3px">Tasa BCV ${fechaCorta(b.fecha)}: Bs. ${fmtTasa(b.tasa)}</div>`
            : `<div style="font-size:0.72rem;color:#b8860b;margin-top:0.5rem">Sin tasa BCV registrada para esta fecha</div>`;
        })()}
      </div>
      <div class="modal-actions">
        ${rolUsuario === "director" ? `<button class="btn btn-danger btn-sm" onclick="eliminarFinanza('${f.id}')">🗑️ Eliminar</button>` : ""}
        <button class="btn btn-gray" style="flex:1" onclick="cerrarModal()">Cerrar</button>
      </div>
    </div>
  </div>`;
}
function imprimirFlujoCaja(anio, mesIdx, detallado = false) {
  const un = mesIdx !== null && mesIdx !== undefined;
  const meses = Array.from({ length: 12 }, (_, i) => {
    const pre = anio + "-" + String(i + 1).padStart(2, "0");
    const ing = [
      ...pagos
        .filter((p) => p.fecha && p.fecha.startsWith(pre))
        .map((p) => ({
          usd: p.total,
          rec: p,
          desc: (p.nombre || "") + " - " + (p.concepto || "Pago"),
          fecha: p.fecha,
          grupo: p.concepto || "Pagos",
        })),
      ...finanzas
        .filter((f) => f.tipo === "ingreso" && f.fecha && f.fecha.startsWith(pre))
        .map((f) => ({
          usd: f.monto,
          rec: f,
          desc: f.descripcion,
          fecha: f.fecha,
          grupo: f.categoria || f.descripcion || "Ingreso",
        })),
    ];
    const gas = finanzas
      .filter((f) => f.tipo === "gasto" && f.fecha && f.fecha.startsWith(pre))
      .map((f) => ({
        usd: f.monto,
        rec: f,
        desc: f.descripcion + (f.responsable ? " · " + f.responsable : ""),
        fecha: f.fecha,
        grupo: f.categoria || "Gasto",
      }));
    return { i, mes: MESES[i], ing, gas, di: totalesDual(ing), dg: totalesDual(gas) };
  });
  const sel = un ? [meses[mesIdx]] : meses;
  const titulo = un ? MESES[mesIdx] + " " + anio : "Año Completo " + anio;
  const T = sel.reduce(
    (a, m) => ({
      ib: a.ib + m.di.bs,
      iu: a.iu + m.di.usd,
      gb: a.gb + m.dg.bs,
      gu: a.gu + m.dg.usd,
      sin: a.sin + m.di.sinTasa + m.dg.sinTasa,
      est: a.est + m.di.estim + m.dg.estim,
    }),
    { ib: 0, iu: 0, gb: 0, gu: 0, sin: 0, est: 0 }
  );
  const celdas = (d, esIng, bsTxt) =>
    esIng
      ? `<td class="r">${bsTxt}</td><td class="r">${fmt(d)}</td><td></td><td></td><td></td><td></td>`
      : `<td></td><td></td><td class="r">${bsTxt}</td><td class="r">${fmt(d)}</td><td></td><td></td>`;
  const filaDet = (d, esIng) => {
    const b = bsDe(d.rec, d.usd);
    const t = b.bs != null ? fmtBs(b.bs) + (b.estimada ? " *" : "") : "—";
    return `<tr class="${esIng ? "di" : "dg"}"><td class="sub">↳ ${escHtml(d.desc)} <span class="f">${fechaCorta(d.fecha)}${b.tasa ? " · tasa " + fmtTasa(b.tasa) : ""}</span></td>${celdas(d.usd, esIng, t)}</tr>`;
  };
  const filaGrp = (nombre, items, esIng) => {
    const t = totalesDual(items);
    return `<tr class="${esIng ? "di" : "dg"}"><td class="sub">↳ ${escHtml(nombre)}</td>${celdas(t.usd, esIng, fmtBs(t.bs))}</tr>`;
  };
  const grupos = (arr) => {
    const g = {};
    arr.forEach((d) => {
      (g[d.grupo] = g[d.grupo] || []).push(d);
    });
    return g;
  };
  const filas = sel
    .map((m) => {
      let det = "";
      if (detallado) {
        det = m.ing.map((d) => filaDet(d, true)).join("") + m.gas.map((d) => filaDet(d, false)).join("");
      } else {
        const gi = grupos(m.ing),
          gg = grupos(m.gas);
        det =
          Object.entries(gi)
            .map(([k, a]) => filaGrp(k, a, true))
            .join("") +
          Object.entries(gg)
            .map(([k, a]) => filaGrp(k, a, false))
            .join("");
      }
      return `<tr class="m"><td>${escHtml(m.mes)}</td><td class="r in">${fmtBs(m.di.bs)}</td><td class="r in">${fmt(m.di.usd)}</td><td class="r out">${fmtBs(m.dg.bs)}</td><td class="r out">${fmt(m.dg.usd)}</td><td class="r b">${fmtBs(r2(m.di.bs - m.dg.bs))}</td><td class="r b">${fmt(r2(m.di.usd - m.dg.usd))}</td></tr>${det}`;
    })
    .join("");
  const w = abrirVentanaImpresion();
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
  <title>Flujo de Caja ${anio}</title>
  <style>
    @page{size:landscape;margin:12mm}
    body{font-family:Arial,sans-serif;margin:0;padding:20px;color:#222}
    .header{background:#003366;color:#fff;padding:16px 22px;border-radius:8px;margin-bottom:16px}
    .header h1{margin:0;font-size:1.25rem;color:#ffd700}.header p{margin:4px 0 0;font-size:0.8rem;color:#adc8ff}
    table{width:100%;border-collapse:collapse;font-size:0.82rem}
    thead th{background:#003366;color:#fff;padding:8px 8px;text-align:right}thead th:first-child{text-align:left}
    thead tr.g th{background:#00509e;text-align:center}
    td{padding:6px 8px;border-bottom:1px solid #eee}.r{text-align:right;white-space:nowrap}
    tr.m td{font-weight:600;color:#003366;background:#f4f7ff}tr.m td.in{color:#1a9e5c}tr.m td.out{color:#e53e3e}tr.m td.b{font-weight:800}
    tr.di td{background:#f0fff4;font-size:0.76rem;color:#555;padding:3px 8px}tr.dg td{background:#fff5f5;font-size:0.76rem;color:#555;padding:3px 8px}
    td.sub{padding-left:20px}.f{color:#aaa;font-size:0.7rem}
    tfoot td{background:#003366;color:#fff;font-weight:700;padding:9px 8px}tfoot td.r{text-align:right}
    .nota{font-size:0.72rem;color:#666;margin-top:10px;line-height:1.5}
    .footer{margin-top:28px;display:flex;justify-content:space-between;padding-top:18px;border-top:2px solid #003366}
    .firma{text-align:center;width:200px}.firma-line{border-top:1px solid #333;margin-top:46px;padding-top:6px;font-size:0.78rem;color:#555}
    @media print{button{display:none}}
  </style></head><body>
  <button onclick="window.print()" style="margin-bottom:14px;padding:8px 18px;background:#003366;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:0.85rem">🖨️ Imprimir</button>
  <div class="header">
    <h1>📊 Flujo de Caja — ${titulo}</h1>
    <p>${EMPRESA} · ${EMPRESA_SUB} · Bolívares (Bs.) con referencia en dólares ($)</p>
    <p>Generado el ${new Date().toLocaleDateString("es-VE", { day: "2-digit", month: "long", year: "numeric" })}</p>
  </div>
  <table>
    <thead><tr class="g"><th></th><th colspan="2">Ingresos</th><th colspan="2">Gastos</th><th colspan="2">Balance</th></tr>
    <tr><th>Mes</th><th>Bs.</th><th>$ ref.</th><th>Bs.</th><th>$ ref.</th><th>Bs.</th><th>$ ref.</th></tr></thead>
    <tbody>${filas}</tbody>
    <tfoot><tr><td>${un ? "TOTAL DEL MES" : "TOTAL ANUAL"}</td><td class="r">${fmtBs(r2(T.ib))}</td><td class="r">${fmt(r2(T.iu))}</td><td class="r">${fmtBs(r2(T.gb))}</td><td class="r">${fmt(r2(T.gu))}</td><td class="r">${fmtBs(r2(T.ib - T.gb))}</td><td class="r">${fmt(r2(T.iu - T.gu))}</td></tr></tfoot>
  </table>
  <p class="nota">Los montos en bolívares están calculados a la tasa BCV vigente en la fecha de cada operación; la columna «$ ref.» es el valor de referencia en dólares.
  ${T.est ? `<br/>* ${T.est} registro(s) anteriores no tenían tasa guardada y se convirtieron con la tasa BCV de su fecha.` : ""}
  ${T.sin ? `<br/><strong>⚠️ ${T.sin} registro(s) no tienen tasa BCV: están en la columna $ ref. pero no se incluyen en las columnas en Bs.</strong>` : ""}</p>
  <div class="footer">
    <div class="firma"><div class="firma-line">Directora<br/>Ligia Herrera</div></div>
    <div class="firma"><div class="firma-line">Administrador<br/>${EMPRESA}</div></div>
    <div class="firma"><div class="firma-line">Contador<br/>Firma y Sello</div></div>
  </div>
  </body></html>`);
  w.document.close();
  setTimeout(() => w.print(), 500);
}
const monedaFin = () => {
  const b = document.getElementById("fin-m-usd");
  return b && b.classList.contains("selected") ? "USD" : "VES";
};
function selMonedaFin(m) {
  const a = document.getElementById("fin-m-ves"),
    b = document.getElementById("fin-m-usd");
  if (a) a.classList.toggle("selected", m === "VES");
  if (b) b.classList.toggle("selected", m === "USD");
  const sy = document.getElementById("fin-simbolo");
  if (sy) sy.textContent = m === "USD" ? "$" : "Bs.";
  calcFin();
}
// Lo escrito en Bs. se convierte a $ de referencia; lo escrito en $ se convierte a Bs.: siempre se guardan los dos
function calcFinValores() {
  const mon = monedaFin(),
    v = parseFmt(document.getElementById("fin-monto") ? document.getElementById("fin-monto").value : "0"),
    tasa = parseTasa(document.getElementById("fin-tasa") ? document.getElementById("fin-tasa").value : "0");
  if (!v || !(tasa > 0)) return { mon, v, tasa, usd: null, bs: null };
  return mon === "USD"
    ? { mon, v, tasa, usd: r2(v), bs: r2(v * tasa) }
    : { mon, v, tasa, usd: r2(v / tasa), bs: r2(v) };
}
function calcFin() {
  const box = document.getElementById("fin-equiv");
  if (!box) return;
  const c = calcFinValores();
  if (c.usd != null) {
    box.style.display = "block";
    box.innerHTML =
      c.mon === "VES"
        ? `Equivale a <strong>${fmt(c.usd)}</strong> de referencia`
        : `Equivale a <strong>${fmtBs(c.bs)}</strong> a la tasa indicada`;
  } else box.style.display = "none";
}
async function guardarFinanza(tipo) {
  const desc = document.getElementById("fin-desc").value.trim();
  const fecha = document.getElementById("fin-fecha").value;
  const c = calcFinValores();
  const err = (m) => {
    mostrarError("fin-err", m);
  };
  if (!desc || !c.v || !fecha) {
    err("Completa descripción, fecha y monto");
    return;
  }
  if (!(c.tasa > 0)) {
    err("Falta la tasa BCV: cárgala con 💱 (arriba) o escríbela en el formulario");
    return;
  }
  if (!(c.usd > 0)) {
    err("El monto es muy pequeño para la tasa indicada");
    return;
  }
  const errFecha = revisarFechaMovimiento(fecha);
  if (errFecha === "cancelado") return;
  if (errFecha) return err(errFecha);
  const datos = {
    tipo,
    descripcion: desc,
    fecha,
    categoria: document.getElementById("fin-cat").value,
    monto: c.usd,
    montoBs: c.bs,
    tasa: c.tasa,
    moneda: c.mon,
    responsable: document.getElementById("fin-resp").value.trim(),
    observaciones: document.getElementById("fin-obs").value.trim(),
    registradoPor: correoUsuario(),
    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
  };
  try {
    const ref = await db.collection("finanzas").add(datos);
    datos.id = ref.id;
    ponerEnLista(finanzas, datos);
    aplicarTasaEditada("fin", fecha, c.tasa);
    alertaFinanza(datos);
    if (modalActual && modalActual.cuentaId) await marcarCuentaPagada(modalActual.cuentaId, datos);
    cerrarModal();
  } catch (e) {
    err(e.message);
  }
}
async function eliminarFinanza(id) {
  if (rolUsuario !== "director") {
    alert("Sin permiso");
    return;
  }
  if (!confirm("¿Eliminar este registro?")) return;
  try {
    await borrarConBitacora(
      "finanzas",
      id,
      finanzas.find((f) => f.id === id)
    );
    finanzas = finanzas.filter((f) => f.id !== id);
    cerrarModal();
  } catch (e) {
    alert("Error: " + e.message);
  }
}

// ---- 📒 Libro de ingresos y egresos (del mes elegido arriba, o del año completo)
let libroAnual = false;
const rangoLibro = (anio, mesPad) =>
  libroAnual
    ? [anio + "-01-01", anio + "-12-31", "Año " + anio]
    : [anio + "-" + mesPad + "-01", anio + "-" + mesPad + "-31", MESES[Number(mesPad) - 1] + " " + anio];
const metodosLibro = (r) => r.metodos.map((m) => ETIQ_METODO[m] || m).join(" + ");
function renderLibroFinanzas(anio, mesPad) {
  const [desde, hasta, nombre] = rangoLibro(anio, mesPad);
  const L = libroIngresosEgresos(desde, hasta);
  const cat = (l, color) =>
    l
      .map(
        (c) =>
          `<div class="info-row"><span style="color:#555">${escHtml(c.categoria)} <span style="color:#999">(${c.n})</span></span><span style="font-weight:700;color:${color}">${fmt(c.usd)} <small style="color:#888;font-weight:400">· ${fmtBs(c.bs)}</small></span></div>`
      )
      .join("") || `<p style="font-size:0.8rem;color:#aaa">Nada</p>`;
  return `
  <div class="card" style="padding:0.7rem 0.9rem">
    <div style="display:flex;gap:0.5rem;align-items:center;flex-wrap:wrap">
      <label style="display:flex;gap:0.4rem;align-items:center;font-size:0.8rem;flex:1"><input type="checkbox" id="libro-anual" ${libroAnual ? "checked" : ""} onchange="libroAnual=this.checked;renderTabContent()"/> Todo el año ${escHtml(anio)}</label>
      <button class="btn btn-success btn-sm" onclick="exportarLibro('${anio}','${mesPad}')">📥 Excel</button>
      <button class="btn btn-print btn-sm" onclick="imprimirLibro('${anio}','${mesPad}')">🖨️ Imprimir</button>
    </div>
    <div style="font-size:0.72rem;color:#888;margin-top:0.3rem">Cada cobro (un renglón por recibo), ingreso y gasto de ${escHtml(nombre)} en orden de fecha, con el saldo. En bolívares a la tasa de cada operación.</div>
  </div>
  <div class="stats-grid libro-totales">
    <div class="stat-card green"><div class="stat-val">${fmt(L.ingresos)}</div><div class="stat-label">Ingresos · ${fmtBs(L.ingresosBs)}</div></div>
    <div class="stat-card red"><div class="stat-val">${fmt(L.egresos)}</div><div class="stat-label">Egresos · ${fmtBs(L.egresosBs)}</div></div>
    <div class="stat-card ${L.neto >= 0 ? "blue" : "red"}"><div class="stat-val">${fmt(L.neto)}</div><div class="stat-label">Resultado · ${fmtBs(L.netoBs)}</div></div>
    <div class="stat-card"><div class="stat-val">${L.filas.length}</div><div class="stat-label">Movimientos${L.sinTasa ? ` · ⚠️ ${L.sinTasa} sin tasa` : ""}</div></div>
  </div>
  <div class="card"><div class="card-title"><div class="card-bar"></div><h2>Ingresos por categoría</h2></div>${cat(L.catIngresos, "#1a9e5c")}</div>
  <div class="card"><div class="card-title"><div class="card-bar"></div><h2>Egresos por categoría</h2></div>${cat(L.catEgresos, "#e53e3e")}</div>
  <div class="card" style="padding:0.5rem"><div style="overflow-x:auto">
    <table class="libro-tabla" style="width:100%;border-collapse:collapse;font-size:0.72rem;min-width:640px">
      <tr style="text-align:left;color:#555;border-bottom:1.5px solid #003366"><th>Fecha</th><th>Doc.</th><th>Concepto</th><th>Tercero</th><th style="text-align:right">Ingreso</th><th style="text-align:right">Egreso</th><th style="text-align:right">Saldo</th></tr>
      ${
        L.filas
          .map(
            (
              r
            ) => `<tr style="border-bottom:1px dashed #e2e8f0"><td style="white-space:nowrap">${escHtml(fechaCorta(r.fecha))}</td><td style="white-space:nowrap">${escHtml(r.doc)}</td><td>${escHtml(r.concepto)}<div style="color:#999">${escHtml(r.categoria)}${r.metodos.length ? " · " + escHtml(metodosLibro(r)) : ""}</div></td><td>${escHtml(r.tercero)}</td>
        <td style="text-align:right;color:#1a9e5c;white-space:nowrap">${r.tipo === "ingreso" ? fmt(r.usd) + `<div style="color:#999">${fmtBs(r.bs)}</div>` : ""}</td>
        <td style="text-align:right;color:#e53e3e;white-space:nowrap">${r.tipo === "gasto" ? fmt(r.usd) + `<div style="color:#999">${fmtBs(r.bs)}</div>` : ""}</td>
        <td style="text-align:right;font-weight:700;white-space:nowrap">${fmt(r.saldo)}</td></tr>`
          )
          .join("") || `<tr><td colspan="7" style="text-align:center;color:#aaa;padding:1rem">Sin movimientos</td></tr>`
      }
    </table></div></div>`;
}
function exportarLibro(anio, mesPad) {
  const [desde, hasta, nombre] = rangoLibro(anio, mesPad);
  const L = libroIngresosEgresos(desde, hasta);
  const filas = [
    [EMPRESA + " · Libro de ingresos y egresos · " + nombre],
    [],
    [
      "Fecha",
      "Documento",
      "Tipo",
      "Categoría",
      "Concepto",
      "Tercero",
      "Método",
      "Ingreso $",
      "Egreso $",
      "Tasa BCV",
      "Ingreso Bs.",
      "Egreso Bs.",
      "Saldo $",
      "Saldo Bs.",
    ],
    ...L.filas.map((r) => [
      fechaCorta(r.fecha),
      r.doc,
      r.tipo === "ingreso" ? "Ingreso" : "Egreso",
      r.categoria,
      r.concepto,
      r.tercero,
      metodosLibro(r),
      r.tipo === "ingreso" ? r.usd : "",
      r.tipo === "gasto" ? r.usd : "",
      r.tasa || "",
      r.tipo === "ingreso" ? r.bs : "",
      r.tipo === "gasto" ? r.bs : "",
      r.saldo,
      r.saldoBs,
    ]),
    [],
    ["", "", "", "", "TOTALES", "", "", L.ingresos, L.egresos, "", L.ingresosBs, L.egresosBs, L.neto, L.netoBs],
  ];
  const resumen = [
    ["Resumen · " + nombre],
    [],
    ["Tipo", "Categoría", "Movimientos", "$", "Bs."],
    ...L.catIngresos.map((c) => ["Ingreso", c.categoria, c.n, c.usd, c.bs]),
    ...L.catEgresos.map((c) => ["Egreso", c.categoria, c.n, c.usd, c.bs]),
    [],
    ["", "Total ingresos", "", L.ingresos, L.ingresosBs],
    ["", "Total egresos", "", L.egresos, L.egresosBs],
    ["", "Resultado", "", L.neto, L.netoBs],
  ];
  const wb = XLSX.utils.book_new();
  const hoja = XLSX.utils.aoa_to_sheet(filas);
  hoja["!cols"] = [10, 12, 8, 22, 40, 26, 18, 11, 11, 10, 14, 14, 12, 14].map((wch) => ({ wch }));
  XLSX.utils.book_append_sheet(wb, hoja, "Libro");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(resumen), "Resumen");
  XLSX.writeFile(wb, "libro_ingresos_egresos_" + (libroAnual ? anio : anio + "-" + mesPad) + ".xlsx");
}
function imprimirLibro(anio, mesPad) {
  const [desde, hasta, nombre] = rangoLibro(anio, mesPad);
  const L = libroIngresosEgresos(desde, hasta);
  const w = abrirVentanaImpresion("width=1000,height=800");
  if (!w) return alert("Permite las ventanas emergentes para imprimir");
  w.document
    .write(`<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>Libro de ingresos y egresos ${escHtml(nombre)}</title>
  <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Segoe UI',Arial,sans-serif;color:#222;background:#fff;padding:0.8rem}
  .hdr{display:flex;align-items:center;gap:0.8rem;border-bottom:2px solid #003366;padding-bottom:0.5rem;margin-bottom:0.6rem}.hdr img{width:42px;height:42px;object-fit:contain}
  table{width:100%;border-collapse:collapse;font-size:0.7rem}th,td{padding:0.22rem 0.3rem;border-bottom:1px solid #ddd;text-align:left;vertical-align:top}
  th{font-size:0.6rem;text-transform:uppercase;color:#555;border-bottom:1.5px solid #003366}.n{text-align:right;white-space:nowrap}
  tfoot td{font-weight:800;border-top:1.5px solid #003366}tr{break-inside:avoid}@page{size:letter landscape;margin:10mm}@media print{.no-print{display:none}}</style></head><body>
  <div class="hdr"><img src="data:image/png;base64,${LOGO}" alt="Logo"/><div>
    <div style="font-size:0.58rem;letter-spacing:2px;color:#003366;font-weight:700;text-transform:uppercase">Libro de ingresos y egresos · ${escHtml(nombre)}</div>
    <div style="font-size:0.9rem;font-family:Georgia,serif;color:#003366">${EMPRESA}</div><div style="font-size:0.62rem;color:#555">${EMPRESA_SUB} · impreso el ${escHtml(fechaCorta(todayStr()))}</div></div></div>
  <table><thead><tr><th>Fecha</th><th>Doc.</th><th>Categoría</th><th>Concepto</th><th>Tercero</th><th class="n">Ingreso $</th><th class="n">Egreso $</th><th class="n">Ingreso Bs.</th><th class="n">Egreso Bs.</th><th class="n">Saldo $</th></tr></thead>
  <tbody>${L.filas
    .map(
      (r) =>
        `<tr><td>${escHtml(fechaCorta(r.fecha))}</td><td>${escHtml(r.doc)}</td><td>${escHtml(r.categoria)}</td><td>${escHtml(r.concepto)}</td><td>${escHtml(r.tercero)}</td><td class="n">${r.tipo === "ingreso" ? fmt(r.usd) : ""}</td><td class="n">${r.tipo === "gasto" ? fmt(r.usd) : ""}</td><td class="n">${r.tipo === "ingreso" ? fmtBs(r.bs) : ""}</td><td class="n">${r.tipo === "gasto" ? fmtBs(r.bs) : ""}</td><td class="n">${fmt(r.saldo)}</td></tr>`
    )
    .join("")}</tbody>
  <tfoot><tr><td colspan="5">Totales · resultado ${fmt(L.neto)} (${fmtBs(L.netoBs)})</td><td class="n">${fmt(L.ingresos)}</td><td class="n">${fmt(L.egresos)}</td><td class="n">${fmtBs(L.ingresosBs)}</td><td class="n">${fmtBs(L.egresosBs)}</td><td class="n">${fmt(L.neto)}</td></tr></tfoot></table>
  <div class="no-print" style="text-align:center;padding:0.75rem"><button onclick="window.print()" style="background:#003366;color:#fff;border:none;padding:0.6rem 1.4rem;border-radius:8px;font-weight:700">🖨️ Imprimir / Guardar PDF</button></div>
  </body></html>`);
  w.document.close();
}

// ---- 🧾 Cuentas por pagar
const ETIQ_EST_CUENTA = {
  vencida: ["badge-red", "⚠️ Vencida"],
  "por-vencer": ["badge-gold", "⏰ Vence pronto"],
  proxima: ["badge-blue", "📅 Pendiente"],
  "sin-fecha": ["badge-gray", "Sin fecha"],
};
const montoCuenta = (c) => (c.moneda === "VES" ? fmtBs(c.monto) : fmt(c.monto));
function renderCuentasPagar() {
  const r = resumenCuentasPagar();
  const pagadas = cuentasPagar
    .filter((c) => c.estado === "pagada")
    .sort((a, b) => ((a.pagadaEl || "") < (b.pagadaEl || "") ? 1 : -1))
    .slice(0, 8);
  return `
  <div class="stats-grid">
    <div class="stat-card red"><div class="stat-val">${fmt(r.totalVencidas)}</div><div class="stat-label">Vencidas (${r.vencidas.length})</div></div>
    <div class="stat-card gold"><div class="stat-val">${fmt(r.totalSemana)}</div><div class="stat-label">Vencen en 7 días (${r.semana.length})</div></div>
    <div class="stat-card"><div class="stat-val">${fmt(r.total)}</div><div class="stat-label">Total por pagar (${r.pendientes.length})</div></div>
  </div>
  <button class="btn btn-primary btn-full" style="margin-bottom:0.75rem" onclick="abrirModal({tipo:'nuevo-cuenta-pagar'})">➕ Nueva cuenta por pagar</button>
  <div class="list">${
    r.pendientes
      .map((c) => {
        const [badge, etiqueta] = ETIQ_EST_CUENTA[c.est];
        return `<div class="list-item cuenta-pagar" style="border-left-color:${c.est === "vencida" ? "#e53e3e" : c.est === "por-vencer" ? "#b8860b" : "#00509e"}">
      <div class="item-row">
        <div style="flex:1;min-width:0"><div class="item-name">${escHtml(c.descripcion)}</div>
          <div class="item-sub">${[escHtml(c.proveedor || c.categoria || ""), c.vence ? "vence el " + escHtml(fechaCorta(c.vence)) : "", c.recurrente === "mensual" ? "🔁 cada mes" : ""].filter(Boolean).join(" · ")}</div>
          <div style="margin-top:3px"><span class="badge ${badge}">${etiqueta}</span></div></div>
        <div class="item-right"><div class="item-amount" style="color:#e53e3e">${montoCuenta(c)}</div>${c.moneda === "VES" && c.usd != null ? `<div style="font-size:0.68rem;color:#888">≈ ${fmt(c.usd)}</div>` : ""}
          <div style="display:flex;gap:0.25rem;margin-top:4px;justify-content:flex-end">
            <button class="btn btn-success btn-sm" style="font-size:0.7rem" onclick="abrirModal({tipo:'nuevo-finanza',subtipo:'gasto',cuentaId:'${c.id}'})">✓ Pagar</button>
            <button class="btn btn-gray btn-sm" style="font-size:0.7rem" title="Editar" onclick="abrirModal({tipo:'editar-cuenta-pagar',id:'${c.id}'})">✏️</button>
          </div></div>
      </div></div>`;
      })
      .join("") || `<div class="empty"><div class="empty-icon">🧾</div><p>No hay cuentas por pagar</p></div>`
  }</div>
  ${
    pagadas.length
      ? `<div class="card" style="margin-top:0.75rem"><div class="card-title"><div class="card-bar"></div><h2>Pagadas hace poco</h2></div>${pagadas
          .map(
            (c) =>
              `<div class="info-row"><span style="color:#555">✓ ${escHtml(c.descripcion)} <span style="color:#999">· ${escHtml(fechaCorta(c.pagadaEl || ""))}</span></span><span style="font-weight:700">${montoCuenta(c)}</span></div>`
          )
          .join("")}</div>`
      : ""
  }`;
}
function renderModalCuentaPagar(m) {
  const c = m.id ? cuentasPagar.find((x) => x.id === m.id) || {} : {};
  const cats = [
    "Servicios",
    "Alquiler",
    "Impuestos",
    "Materiales",
    "Mantenimiento",
    "Transporte",
    "Alimentación",
    "Otros",
  ];
  return `<div class="modal-bg"><div class="modal">
    <div class="modal-header"><div><h3>🧾 ${c.id ? "Editar" : "Nueva"} cuenta por pagar</h3><p>Lo que hay que pagar y cuándo vence</p></div><button class="modal-close-x" onclick="cerrarModal()">✕</button></div>
    <div class="modal-body"><div class="form-grid">
      <div class="field"><label class="field-label">¿Qué es? *</label><input class="inp" id="cp-desc" placeholder="Ej: Luz (Corpoelec), alquiler, impuesto municipal" value="${escHtml(c.descripcion) || ""}"/></div>
      <div class="form-row">
        <div class="field"><label class="field-label">A quién se le paga</label><input class="inp" id="cp-prov" placeholder="Ej: Corpoelec" value="${escHtml(c.proveedor) || ""}"/></div>
        <div class="field"><label class="field-label">Categoría</label><select class="inp" id="cp-cat">${cats.map((x) => `<option ${c.categoria === x ? "selected" : ""}>${x}</option>`).join("")}</select></div>
      </div>
      <div class="form-row">
        <div class="field"><label class="field-label">Monto *</label><input class="inp" id="cp-monto" inputmode="decimal" placeholder="0,00" value="${c.monto ? String(c.monto).replace(".", ",") : ""}" oninput="fmtInput(this)"/></div>
        <div class="field"><label class="field-label">Moneda</label><select class="inp" id="cp-moneda"><option value="USD" ${c.moneda !== "VES" ? "selected" : ""}>$ (dólares)</option><option value="VES" ${c.moneda === "VES" ? "selected" : ""}>Bs. (bolívares)</option></select></div>
      </div>
      <div class="form-row">
        <div class="field"><label class="field-label">Vence el *</label><input class="inp" type="date" id="cp-vence" value="${escHtml(c.vence) || ""}"/></div>
        <div class="field"><label class="field-label">¿Se repite?</label><select class="inp" id="cp-rec"><option value="no">No, es una sola vez</option><option value="mensual" ${c.recurrente === "mensual" ? "selected" : ""}>🔁 Cada mes</option></select></div>
      </div>
      <div class="field"><label class="field-label">Nota</label><input class="inp" id="cp-nota" placeholder="Ej: número de contrato o de cliente" value="${escHtml(c.nota) || ""}"/></div>
      <div id="cp-err"></div>
    </div></div>
    <div class="modal-actions">
      <button class="btn btn-primary" style="flex:1" onclick="guardarCuentaPagar('${c.id || ""}')">✓ Guardar</button>
      ${c.id ? `<button class="btn btn-danger btn-sm" onclick="eliminarCuentaPagar('${c.id}')">🗑️</button>` : ""}
      <button class="btn btn-gray" onclick="cerrarModal()">Cancelar</button>
    </div>
  </div></div>`;
}
async function guardarCuentaPagar(id) {
  const val = (x) => document.getElementById(x).value.trim();
  const datos = {
    descripcion: val("cp-desc"),
    proveedor: val("cp-prov"),
    categoria: val("cp-cat"),
    monto: r2(parseFmt(val("cp-monto"))),
    moneda: val("cp-moneda") === "VES" ? "VES" : "USD",
    vence: val("cp-vence"),
    recurrente: val("cp-rec") === "mensual" ? "mensual" : "no",
    nota: val("cp-nota"),
  };
  if (!datos.descripcion || !(datos.monto > 0) || !datos.vence)
    return mostrarError("cp-err", "Completa qué es, el monto y cuándo vence");
  try {
    if (id) {
      await db.collection("cuentas_pagar").doc(id).update(datos);
      ponerEnLista(cuentasPagar, { id, ...datos });
    } else {
      const nueva = { ...datos, estado: "pendiente", registradoPor: correoUsuario() };
      const ref = await db.collection("cuentas_pagar").add(nueva);
      cuentasPagar.push({ id: ref.id, ...nueva });
    }
    cerrarModal();
    renderTabContent();
  } catch (e) {
    mostrarError("cp-err", e.message);
  }
}
async function eliminarCuentaPagar(id) {
  if (!confirm("¿Borrar esta cuenta por pagar? (No borra ningún gasto ya registrado)")) return;
  try {
    await db.collection("cuentas_pagar").doc(id).delete();
    cuentasPagar = cuentasPagar.filter((c) => c.id !== id);
    cerrarModal();
    renderTabContent();
  } catch (e) {
    alert("Error: " + e.message);
  }
}
// Al registrar el gasto de una cuenta: queda pagada y, si es de cada mes, se anota la del mes que viene
async function marcarCuentaPagada(id, gasto) {
  const c = cuentasPagar.find((x) => x.id === id);
  if (!c) return;
  const pago = { estado: "pagada", pagadaEl: gasto.fecha, gastoId: gasto.id || "" };
  const lote = db.batch();
  lote.update(db.collection("cuentas_pagar").doc(id), pago);
  let siguiente = null;
  if (c.recurrente === "mensual" && c.vence) {
    const ref = db.collection("cuentas_pagar").doc();
    siguiente = {
      descripcion: c.descripcion,
      proveedor: c.proveedor || "",
      categoria: c.categoria || "",
      monto: c.monto,
      moneda: c.moneda,
      vence: venceSiguiente(c.vence),
      recurrente: "mensual",
      nota: c.nota || "",
      estado: "pendiente",
      registradoPor: correoUsuario(),
    };
    lote.set(ref, siguiente);
    siguiente.id = ref.id;
  }
  try {
    await lote.commit();
    Object.assign(c, pago);
    if (siguiente) cuentasPagar.push(siguiente);
  } catch (e) {
    alert("El gasto se registró, pero no se pudo marcar la cuenta como pagada: " + e.message);
  }
}

// ---- 🏦 Conciliación bancaria (ver servicios/conciliacion.js). No se guarda nada: se sube el estado de cuenta, se
// revisa y, si hace falta, se registra lo que falta.
let conc = null; // { nombre, hojas: [{ nombre, filas }], hoja, filas, mapa, resultado, error }
const ETIQ_COL_BANCO = {
  fecha: "Fecha *",
  referencia: "Referencia",
  descripcion: "Descripción",
  credito: "Crédito / abono",
  debito: "Débito / cargo",
  monto: "Monto (si va todo en una columna)",
  tipo: "Tipo (C/D, crédito/débito)",
};
// Los archivos de texto se leen como texto (UTF-8 o, si trae caracteres raros, como los guarda Windows); los de
// Excel con la biblioteca de hojas de cálculo (también lee .xls que en realidad son páginas HTML)
const esTextoBanco = (archivo) =>
  /\.(csv|txt|tsv|prn)$/i.test(archivo.name || "") || /^text\//.test(archivo.type || "");
function leerComoTexto(archivo, codificacion) {
  return new Promise((ok, no) => {
    const r = new FileReader();
    r.onload = () => ok(r.result);
    r.onerror = () => no(new Error("no se pudo leer el archivo"));
    r.readAsText(archivo, codificacion);
  });
}
async function hojasDeArchivo(archivo) {
  if (esTextoBanco(archivo)) {
    let texto = await leerComoTexto(archivo, "utf-8");
    if (texto.includes("�")) texto = await leerComoTexto(archivo, "windows-1252");
    return [{ nombre: archivo.name, filas: filasDeTexto(texto) }];
  }
  const datos = new Uint8Array(await archivo.arrayBuffer());
  // raw: los textos de un CSV o HTML no se convierten en fechas a la manera de EE. UU. (mes/día)
  const libro = XLSX.read(datos, { type: "array", cellDates: true, raw: true });
  const hojas = libro.SheetNames.map((n) => ({
    nombre: n,
    filas: XLSX.utils.sheet_to_json(libro.Sheets[n], { header: 1, raw: true, defval: "" }),
  }));
  if (hojas.some((h) => detectarColumnas(h.filas))) return hojas;
  // un «.xls» que en realidad es texto separado por tabuladores
  const texto = new TextDecoder("utf-8").decode(datos);
  const comoTexto = filasDeTexto(texto.includes("�") ? new TextDecoder("windows-1252").decode(datos) : texto);
  return detectarColumnas(comoTexto) ? [{ nombre: archivo.name, filas: comoTexto }] : hojas;
}
async function leerEstadoCuenta(archivo) {
  if (!archivo) return;
  try {
    const hojas = await hojasDeArchivo(archivo);
    const i = Math.max(
      0,
      hojas.findIndex((h) => detectarColumnas(h.filas))
    );
    conc = { nombre: archivo.name, hojas, hoja: i };
    elegirHojaBanco(i);
  } catch (e) {
    conc = { nombre: archivo.name, error: "No se pudo leer el archivo: " + e.message };
    renderTabContent();
  }
}
function elegirHojaBanco(i) {
  conc.hoja = Number(i) || 0;
  conc.filas = (conc.hojas[conc.hoja] || {}).filas || [];
  conc.mapa = detectarColumnas(conc.filas) || { fila: 0, col: {} };
  conciliarActual();
  renderTabContent();
}
function conciliarActual() {
  if (!conc || !conc.filas) return;
  const { col } = conc.mapa;
  conc.resultado = null;
  conc.error = "";
  if (col.fecha == null || (col.credito == null && col.monto == null))
    return void (conc.error = "Elige qué columna es la fecha y cuál trae los abonos (crédito o monto).");
  const entradas = movimientosBanco(conc.filas, conc.mapa);
  if (!entradas.length) return void (conc.error = "No se encontraron abonos (dinero que entró) en el archivo.");
  conc.resultado = conciliarBanco(entradas, cobrosPorTransferencia());
}
function cambiarColumnaBanco(k, v) {
  if (v === "") delete conc.mapa.col[k];
  else conc.mapa.col[k] = Number(v);
  recordarFormatoBanco(conc.filas[conc.mapa.fila], conc.mapa.col); // la próxima vez, este formato sale solo
  conc.mapa.recordado = true;
  conciliarActual();
  renderTabContent();
}
function cambiarFilaTitulos(v) {
  conc.mapa = { fila: Number(v), col: columnasDeFila(conc.filas, Number(v)) };
  conciliarActual();
  renderTabContent();
}
// Abre «Nuevo pago» con lo que dice el banco (fecha, referencia y el monto pasado a $ con la tasa de ese día)
function registrarDesdeBanco(i) {
  const e = conc && conc.resultado && conc.resultado.sinRegistrar[i];
  if (!e) return;
  const t = tasaDe(e.fecha);
  pagoPrefill = {
    fecha: e.fecha,
    metodo: "Transferencia Bs",
    referencia: e.referencia,
    total: t ? r2(e.monto / t.valor) : "",
    desc:
      "Recibido en el banco el " +
      fechaCorta(e.fecha) +
      ": " +
      fmtBs(e.monto) +
      (e.descripcion ? " (" + e.descripcion + ")" : ""),
  };
  _metodoPago = "Transferencia Bs";
  tabActual = "pagos";
  subTab.pagos = "nuevo";
  render();
}
function renderConciliacion() {
  const repetidas = referenciasRepetidas();
  const htmlRepetidas = repetidas.length
    ? `<div class="card conc-repetidas"><div class="card-title"><div class="card-bar"></div><h2>⚠️ Referencias repetidas en los recibos (${repetidas.length})</h2></div>
      <div style="font-size:0.75rem;color:#666;margin-bottom:0.4rem">La misma transferencia registrada en más de un recibo: puede ser un error o un comprobante usado dos veces.</div>
      ${repetidas
        .map(
          (g) =>
            `<div class="info-row"><span><strong>Ref. ${escHtml(g.ref)}</strong></span><span style="text-align:right;font-size:0.78rem">${g.recibos.map((r) => `${escHtml(r.factura)} · ${escHtml(r.nombre)} · ${escHtml(fechaCorta(r.fecha))} · ${fmt(r.total)}`).join("<br/>")}</span></div>`
        )
        .join("")}</div>`
    : "";
  const cabecera = `<div class="card">
    <div class="card-title"><div class="card-bar"></div><h2>🏦 Conciliación bancaria</h2></div>
    <div style="font-size:0.78rem;color:#555;margin-bottom:0.5rem">Descarga el estado de cuenta de tu banco en <strong>Excel o CSV</strong> y súbelo aquí. La app compara cada abono con los cobros registrados por <strong>transferencia o pago móvil</strong> (por la referencia y el monto, o por el monto y la fecha). Los cobros por punto de venta no se comparan uno por uno: el banco los abona juntos al cerrar el lote.</div>
    <input class="inp" type="file" id="conc-archivo" accept=".xlsx,.xls,.csv,.txt" onchange="leerEstadoCuenta(this.files[0])"/>
    ${conc ? `<div style="font-size:0.75rem;color:#888;margin-top:0.3rem">📄 ${escHtml(conc.nombre)}</div>` : ""}
  </div>`;
  if (!conc) return cabecera + htmlRepetidas;
  if (!conc.filas)
    return cabecera + `<div class="alert-item alert-mora"><div>${escHtml(conc.error)}</div></div>` + htmlRepetidas;
  const titulos = conc.filas[conc.mapa.fila] || [];
  const opciones = (k) =>
    `<option value="">— ninguna —</option>` +
    titulos
      .map(
        (t, j) =>
          `<option value="${j}" ${conc.mapa.col[k] === j ? "selected" : ""}>${escHtml(String(t || "Columna " + (j + 1)))}</option>`
      )
      .join("");
  const columnas = `<details class="card conc-columnas" ${conc.resultado ? "" : "open"}><summary style="cursor:pointer;font-weight:700;color:#003366;font-size:0.85rem">⚙️ Columnas del archivo ${conc.mapa.recordado ? "(formato recordado de este banco)" : conc.resultado ? "(detectadas)" : ""}</summary>
    <div style="font-size:0.72rem;color:#888;margin-top:0.3rem">Si alguna columna no es la correcta, elígela: la app recuerda el formato de cada banco para la próxima vez.</div>
    <div class="form-grid" style="margin-top:0.5rem">
      ${
        conc.hojas && conc.hojas.length > 1
          ? `<div class="field"><label class="field-label">Hoja</label><select class="inp" id="conc-hoja" onchange="elegirHojaBanco(this.value)">${conc.hojas
              .map((h, i) => `<option value="${i}" ${i === conc.hoja ? "selected" : ""}>${escHtml(h.nombre)}</option>`)
              .join("")}</select></div>`
          : ""
      }
      <div class="field"><label class="field-label">Fila de los títulos</label><select class="inp" id="conc-fila" onchange="cambiarFilaTitulos(this.value)">${conc.filas
        .slice(0, 40)
        .map(
          (f, i) =>
            `<option value="${i}" ${i === conc.mapa.fila ? "selected" : ""}>Fila ${i + 1}: ${escHtml((f || []).filter(Boolean).slice(0, 4).join(" · ").slice(0, 60))}</option>`
        )
        .join("")}</select></div>
      <div class="form-row" style="flex-wrap:wrap">${Object.entries(ETIQ_COL_BANCO)
        .map(
          ([k, l]) =>
            `<div class="field"><label class="field-label">${l}</label><select class="inp" id="conc-col-${k}" onchange="cambiarColumnaBanco('${k}',this.value)">${opciones(k)}</select></div>`
        )
        .join("")}</div>
    </div></details>`;
  const r = conc.resultado;
  if (!r)
    return (
      cabecera + columnas + `<div class="alert-item alert-info"><div>${escHtml(conc.error)}</div></div>` + htmlRepetidas
    );
  const linea = (izq, der, extra) =>
    `<div class="list-item" style="padding:0.55rem 0.75rem"><div class="item-row"><div style="flex:1;min-width:0;font-size:0.8rem">${izq}</div><div class="item-right" style="font-size:0.8rem">${der}${extra || ""}</div></div></div>`;
  const cobroTxt = (c) =>
    `${escHtml(c.factura)} · ${escHtml(c.nombre)} · ${escHtml(fechaCorta(c.fecha))}${c.referencia ? " · ref " + escHtml(c.referencia) : ""}`;
  const banco = (e) =>
    `🏦 ${escHtml(fechaCorta(e.fecha))}${e.referencia ? " · ref " + escHtml(e.referencia) : ""}${e.descripcion ? `<div style="color:#888;font-size:0.72rem">${escHtml(e.descripcion)}</div>` : ""}`;
  const seccion = (clase, titulo, ayuda, items) =>
    items.length
      ? `<div class="card ${clase}"><div class="card-title"><div class="card-bar"></div><h2>${titulo}</h2></div><div style="font-size:0.75rem;color:#666;margin-bottom:0.4rem">${ayuda}</div><div class="list">${items.join("")}</div></div>`
      : "";
  return (
    cabecera +
    columnas +
    `<div class="stats-grid conc-resumen">
      <div class="stat-card"><div class="stat-val">${r.entradas}</div><div class="stat-label">Abonos del ${escHtml(fechaCorta(r.desde))} al ${escHtml(fechaCorta(r.hasta))} · ${fmtBs(r.totalBanco)}</div></div>
      <div class="stat-card green"><div class="stat-val">${r.conciliados.length + r.porMonto.length}</div><div class="stat-label">✅ Coinciden con un recibo</div></div>
      <div class="stat-card red"><div class="stat-val">${r.sinRegistrar.length}</div><div class="stat-label">❓ Sin registrar · ${fmtBs(r.totalSinRegistrar)}</div></div>
      <div class="stat-card gold"><div class="stat-val">${r.noEnBanco.length + r.montoDistinto.length}</div><div class="stat-label">⚠️ Por revisar</div></div>
    </div>
    <div style="display:flex;gap:0.5rem;margin-bottom:0.6rem"><button class="btn btn-gray btn-sm" onclick="conciliarActual();renderTabContent()">🔄 Volver a comparar</button><button class="btn btn-print btn-sm" onclick="imprimirConciliacion()">🖨️ Imprimir</button></div>` +
    seccion(
      "conc-sin-registrar",
      "❓ Entró al banco y no está registrado (" + r.sinRegistrar.length + ")",
      "Dinero que llegó a la cuenta y no aparece en ningún recibo. Averigua de quién es y regístralo.",
      r.sinRegistrar.map((e, i) =>
        linea(
          banco(e),
          `<strong>${fmtBs(e.monto)}</strong>`,
          `<div><button class="btn btn-primary btn-sm" style="margin-top:4px;font-size:0.7rem" onclick="registrarDesdeBanco(${i})">➕ Registrar</button></div>`
        )
      )
    ) +
    seccion(
      "conc-monto-distinto",
      "⚠️ La referencia coincide pero el monto no (" + r.montoDistinto.length + ")",
      "El banco recibió otro monto: revisa si pagó de menos o si se registró mal.",
      r.montoDistinto.map((x) =>
        linea(
          banco(x.entrada) + `<div>🧾 ${cobroTxt(x.cobro)}</div>`,
          `Banco <strong>${fmtBs(x.entrada.monto)}</strong><div>Recibo ${fmtBs(x.cobro.bs)}</div>`
        )
      )
    ) +
    seccion(
      "conc-no-banco",
      "⚠️ Registrado y no aparece en el banco (" + r.noEnBanco.length + ")",
      "Cobros por transferencia del período que no están en el estado de cuenta: puede que la referencia esté mal escrita o que el pago no haya llegado.",
      r.noEnBanco.map((c) => linea(`🧾 ${cobroTxt(c)}`, `<strong>${fmtBs(c.bs)}</strong>`))
    ) +
    seccion(
      "conc-por-monto",
      "🟡 Coinciden por monto y fecha (" + r.porMonto.length + ")",
      "No tienen la misma referencia, pero el monto y la fecha cuadran con un solo recibo. Confírmalos.",
      r.porMonto.map((x) =>
        linea(banco(x.entrada) + `<div>🧾 ${cobroTxt(x.cobro)}</div>`, `<strong>${fmtBs(x.entrada.monto)}</strong>`)
      )
    ) +
    seccion(
      "conc-ok",
      "✅ Conciliados (" + r.conciliados.length + ")",
      "La referencia y el monto coinciden con un recibo.",
      r.conciliados.map((x) =>
        linea(banco(x.entrada) + `<div>🧾 ${cobroTxt(x.cobro)}</div>`, `<strong>${fmtBs(x.entrada.monto)}</strong>`)
      )
    ) +
    htmlRepetidas
  );
}
function imprimirConciliacion() {
  const r = conc && conc.resultado;
  if (!r) return;
  const w = abrirVentanaImpresion("width=900,height=900");
  if (!w) return alert("Permite las ventanas emergentes para imprimir");
  const tabla = (titulo, filas) =>
    filas.length
      ? `<h2>${titulo}</h2><table>${filas.map((f) => `<tr>${f.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</table>`
      : "";
  const cobroTxt = (c) => `${escHtml(c.factura)} · ${escHtml(c.nombre)} · ${escHtml(fechaCorta(c.fecha))}`;
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>Conciliación bancaria</title>
  <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Segoe UI',Arial,sans-serif;color:#222;background:#fff;padding:1rem;max-width:900px;margin:0 auto}
  h1{font-size:0.95rem;color:#003366}h2{font-size:0.75rem;text-transform:uppercase;letter-spacing:1px;color:#003366;margin:0.8rem 0 0.3rem}
  table{width:100%;border-collapse:collapse;font-size:0.75rem}td{padding:0.25rem 0.35rem;border-bottom:1px solid #ddd}td:last-child{text-align:right;white-space:nowrap}
  @media print{.no-print{display:none}}</style></head><body>
  <h1>${EMPRESA} · Conciliación bancaria del ${escHtml(fechaCorta(r.desde))} al ${escHtml(fechaCorta(r.hasta))}</h1>
  <p style="font-size:0.75rem;color:#555">Archivo: ${escHtml(conc.nombre)} · ${r.entradas} abonos por ${fmtBs(r.totalBanco)} · impreso el ${escHtml(fechaCorta(todayStr()))}</p>
  ${tabla(
    "Entró al banco y no está registrado",
    r.sinRegistrar.map((e) => [
      escHtml(fechaCorta(e.fecha)),
      escHtml(e.referencia),
      escHtml(e.descripcion),
      fmtBs(e.monto),
    ])
  )}
  ${tabla(
    "La referencia coincide pero el monto no",
    r.montoDistinto.map((x) => [
      escHtml(fechaCorta(x.entrada.fecha)),
      escHtml(x.entrada.referencia),
      cobroTxt(x.cobro),
      "Banco " + fmtBs(x.entrada.monto) + " · recibo " + fmtBs(x.cobro.bs),
    ])
  )}
  ${tabla(
    "Registrado y no aparece en el banco",
    r.noEnBanco.map((c) => [cobroTxt(c), "ref " + escHtml(c.referencia || "—"), fmtBs(c.bs)])
  )}
  ${tabla(
    "Coinciden por monto y fecha",
    r.porMonto.map((x) => [
      escHtml(fechaCorta(x.entrada.fecha)),
      escHtml(x.entrada.referencia),
      cobroTxt(x.cobro),
      fmtBs(x.entrada.monto),
    ])
  )}
  ${tabla(
    "Conciliados",
    r.conciliados.map((x) => [
      escHtml(fechaCorta(x.entrada.fecha)),
      escHtml(x.entrada.referencia),
      cobroTxt(x.cobro),
      fmtBs(x.entrada.monto),
    ])
  )}
  <div class="no-print" style="text-align:center;padding:0.75rem"><button onclick="window.print()" style="background:#003366;color:#fff;border:none;padding:0.6rem 1.4rem;border-radius:8px;font-weight:700">🖨️ Imprimir / Guardar PDF</button></div>
  </body></html>`);
  w.document.close();
}
