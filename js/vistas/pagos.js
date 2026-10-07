// Pestaña Pagos: lista de pagos, formulario de nuevo pago, recibo (ver, imprimir, WhatsApp) y eliminación.

function renderPagos() {
  const st = subTab.pagos;
  let filtrados = pagos
    .filter((p) => {
      const mB =
        !filtros.busq ||
        p.nombre.toLowerCase().includes(filtros.busq.toLowerCase()) ||
        (p.cedula || "").includes(filtros.busq) ||
        (p.factura || "").includes(filtros.busq);
      const mF = !filtros.fecha || p.fecha === filtros.fecha;
      const mM = !filtros.metodo || p.metodo === filtros.metodo;
      return mB && mF && mM;
    })
    .sort((a, b) => {
      if (filtros.fecha) {
        return (a.factura || "").localeCompare(b.factura || "");
      }
      const tA = a.timestamp?.seconds || 0;
      const tB = b.timestamp?.seconds || 0;
      if (tA !== tB) return tB - tA;
      return (b.fecha || "").localeCompare(a.fecha || "");
    });
  const totalFiltrado = filtrados.reduce((s, p) => s + p.total, 0);
  return `
  <div class="stabs">
    ${[
      ["lista", "📋 Lista"],
      ["nuevo", "➕ Nuevo Pago"],
    ]
      .map(
        ([k, l]) =>
          `<button class="stab ${st === k ? "active" : ""}" onclick="subTab.pagos='${k}';renderTabContent()">${l}</button>`
      )
      .join("")}
  </div>
  ${
    st === "nuevo"
      ? renderFormPago()
      : `
  <div class="card" style="padding:0.85rem">
    <div style="display:flex;gap:0.4rem;margin-bottom:0.5rem;flex-wrap:wrap">
      <input class="inp" id="search-input" style="flex:1;min-width:130px;padding:0.55rem 0.75rem;font-size:0.82rem" placeholder="🔍 Nombre, cédula, recibo..." value="${filtros.busq}" oninput="onBusqInput(this.value)"/>
      <input class="inp" type="date" style="padding:0.55rem 0.75rem;font-size:0.82rem" value="${escHtml(filtros.fecha)}" onchange="filtros.fecha=this.value;renderTabContent()"/>
    </div>
    <div style="display:flex;gap:0.4rem">
      ${["", "Dólares Efectivo", "Transferencia Bs", "Bs Efectivo", "Punto"].map((m) => `<button onclick="filtros.metodo='${m}';renderTabContent()" style="flex:1;padding:0.4rem;border-radius:8px;border:1.5px solid ${filtros.metodo === m ? "#003366" : "#dde3f0"};background:${filtros.metodo === m ? "#e8f0fe" : "#f8faff"};color:${filtros.metodo === m ? "#003366" : "#888"};cursor:pointer;font-size:0.75rem;font-weight:600;font-family:inherit">${m || "Todos"}</button>`).join("")}
      ${filtros.busq || filtros.fecha || filtros.metodo ? `<button onclick="filtros.busq='';filtros.fecha='';filtros.metodo='';renderTabContent()" style="padding:0.4rem 0.75rem;border-radius:8px;border:none;background:#fef0f0;color:#e53e3e;cursor:pointer;font-size:0.75rem;font-weight:600;font-family:inherit">✕</button>` : ""}
    </div>
  </div>
  ${
    filtrados.length > 0 && rolUsuario === "director"
      ? `
  <div class="recaudo-box">
    <div>
      <div style="font-size:0.65rem;color:#adc8ff">${filtros.fecha ? "Recaudo del " + escHtml(filtros.fecha) : filtros.metodo ? "Recaudo - " + escHtml(filtros.metodo) : "Recaudo Total"}</div>
      <div style="font-size:1.3rem;font-weight:800;font-family:Georgia,serif;color:#ffd700">${fmt(totalFiltrado)}</div>
      <div style="font-size:0.68rem;color:#adc8ff">${filtrados.length} recibo${filtrados.length !== 1 ? "s" : ""}</div>
    </div>
    <div style="text-align:right;font-size:0.72rem;color:#adc8ff">
      ${(() => {
        const tm = totalesMetodo(filtrados);
        const sin = METODOS.reduce((x, [m]) => x + tm[m].sinTasa, 0);
        return (
          METODOS.map(([m, etq], i) => `<div style="margin-top:${i ? 2 : 0}px">${etq}: ${txtMetodo(tm[m])}</div>`).join(
            ""
          ) +
          (sin
            ? `<div style="margin-top:4px;color:#ffd700;font-size:0.62rem">⚠️ ${sin} pago(s) sin tasa BCV no suman en Bs.</div>`
            : "")
        );
      })()}
    </div>
  </div>`
      : ""
  }
  ${
    filtrados.length === 0
      ? `<div class="empty"><div class="empty-icon">📭</div><p>No hay pagos</p></div>`
      : `<div class="list">${filtrados
          .map(
            (p) => `
    <div class="list-item" onclick="abrirModal({tipo:'recibo',pago:pagos.find(x=>x.id==='${p.id}')})">
      <div class="item-row">
        <div style="flex:1;min-width:0">
          <div class="item-name">${escHtml(p.nombre)}</div>
          <div class="item-sub">${escHtml(p.factura) || ""} · ${escHtml(p.fecha)}</div>
          <div style="margin-top:3px;display:flex;gap:0.35rem;flex-wrap:wrap">
            <span class="badge ${p.metodo === "Dólares Efectivo" ? "badge-gold" : p.metodo === "Transferencia Bs" ? "badge-blue" : p.metodo === "Bs Efectivo" ? "badge-green" : "badge-blue"}">${escHtml(p.metodo) || "Dólares Efectivo"}</span>
            ${p.concepto ? `<span class="badge badge-gray">${escHtml(p.concepto)}</span>` : ""}
          </div>
        </div>
        <div class="item-right"><div class="item-amount">${fmt(p.total)}</div>${(() => {
          const b = bsDe(p, p.total);
          return b.bs != null ? `<div style="font-size:0.68rem;color:#888">${fmtBs(b.bs)}</div>` : "";
        })()}<div class="item-hint">Ver →</div></div>
      </div>
    </div>`
          )
          .join("")}</div>`
  }
  `
  }`;
}
function renderFormPago(data = {}) {
  return `<div class="card">
    <div class="card-title"><div class="card-bar"></div><h2>Registrar Nuevo Pago</h2></div>
    <div class="form-grid">
      <div class="field" style="grid-column:1/-1"><label class="field-label">🔍 Buscar Estudiante *</label>
        <div style="position:relative">
          <input class="inp" id="p-buscar" placeholder="Escribe el nombre o la cédula del estudiante..." oninput="buscarEstudiantePorCedula(this.value)" autocomplete="off" value="${escHtml(data.nombre) || escHtml(data.cedula) || ""}"/>
          <div id="p-sugerencias" style="position:absolute;top:100%;left:0;right:0;background:#fff;border:1.5px solid #003366;border-radius:0 0 10px 10px;z-index:99;display:none;max-height:200px;overflow-y:auto;box-shadow:0 8px 20px rgba(0,51,102,0.15)"></div>
        </div>
        <div id="p-est-badge" style="display:${data.nombre ? "flex" : "none"};align-items:center;gap:0.6rem;margin-top:0.4rem;background:#e8f0fe;border-radius:8px;padding:0.5rem 0.85rem;border-left:3px solid #003366">
          <span style="font-size:1rem">👤</span>
          <span style="font-weight:700;color:#003366;font-size:0.9rem" id="p-badge-nombre">${escHtml(data.nombre) || ""}</span>
          <span style="font-size:0.78rem;color:#666;background:#fff;padding:2px 8px;border-radius:20px" id="p-badge-cedula">${data.cedula ? "CC " + escHtml(data.cedula) : ""}</span>
          <span onclick="limpiarSeleccionPago()" style="margin-left:auto;cursor:pointer;color:#e53e3e;font-weight:700;font-size:1.1rem;line-height:1" title="Cambiar estudiante">✕</span>
        </div>
        <input type="hidden" id="p-cedula" value="${escHtml(data.cedula) || ""}"/>
        <input type="hidden" id="p-nombre" value="${escHtml(data.nombre) || ""}"/>
      </div>
      <div class="form-row">
        <div class="field" style="display:none"><label class="field-label">Cédula</label><input class="inp" id="p-cedula-hidden" value="${escHtml(data.cedula) || ""}"/></div>
        <div class="field"><label class="field-label">Teléfono</label><input class="inp" id="p-tel" placeholder="Teléfono" value="${escHtml(data.telefono) || ""}"/></div>
      </div>
      <div class="form-row">
        <div class="field"><label class="field-label">Fecha *</label><input class="inp" type="date" id="p-fecha" value="${escHtml(data.fecha) || todayStr()}" onchange="actualizarTasaCampo('p',calcBsPago)"/></div>
        <div class="field"><label class="field-label">Concepto *</label>
          <select class="inp" id="p-concepto">
            <option value="">Seleccionar...</option>
            ${["Mensualidad", "Inscripción", "Uniformes", "Recargo", "Deuda anterior", "Otro"].map((c) => `<option value="${c}" ${data.concepto === c ? "selected" : ""}>${c}</option>`).join("")}
          </select>
        </div>
      </div>
      <div class="field"><label class="field-label">Mes que cancela</label>
        <select class="inp" id="p-mes">
          <option value="">-- Seleccionar mes --</option>
          ${MESES.map((m, i) => `<option value="${m}" ${data.mes === m ? "selected" : ""}>${m}</option>`).join("")}
        </select>
      </div>
      <div class="field"><label class="field-label">Descripción</label><textarea class="inp" id="p-desc" rows="2" placeholder="Detalles adicionales">${escHtml(data.desc) || ""}</textarea></div>
      <div class="field"><label class="field-label">Método de Pago *</label>
        <div class="metodo-row" style="flex-wrap:wrap;gap:0.4rem">
          <button class="metodo-btn ${!data.metodo || data.metodo === "Dólares Efectivo" ? "selected" : ""}" id="m-def" onclick="selMetodoPago('Dólares Efectivo')">💵 Dólares Efectivo</button>
          <button class="metodo-btn ${data.metodo === "Transferencia Bs" ? "selected" : ""}" id="m-tbs" onclick="selMetodoPago('Transferencia Bs')">📲 Transferencia Bs</button>
          <button class="metodo-btn ${data.metodo === "Bs Efectivo" ? "selected" : ""}" id="m-bef" onclick="selMetodoPago('Bs Efectivo')">💵 Bs Efectivo</button>
          <button class="metodo-btn ${data.metodo === "Punto" ? "selected" : ""}" id="m-pt" onclick="selMetodoPago('Punto')">💳 Punto</button>
        </div>
      </div>
      <div class="field"><label class="field-label">Total *</label>
        <div style="position:relative"><span style="position:absolute;left:1rem;top:50%;transform:translateY(-50%);color:#003366;font-weight:700">$</span>
        <input class="inp" id="p-total" placeholder="0,00" style="padding-left:2rem" value="${data.total ? String(data.total).replace(".", ",") : ""}" oninput="fmtInput(this);calcBsPago()"/></div>
      </div>
      ${campoTasaHTML("p", data.fecha, "calcBsPago()")}
      <div id="p-bs-box" style="display:none;justify-content:space-between;align-items:center;background:#e8f0fe;border-radius:10px;padding:0.7rem 0.9rem"><span style="color:#003366;font-weight:700;font-size:0.82rem">Total en bolívares</span><strong id="p-bs-val" style="color:#003366;font-size:1.05rem"></strong></div>
      <div id="p-err"></div>
      <div style="display:flex;gap:0.5rem">
        <button class="btn btn-primary" style="flex:1" onclick="guardarPago()">✓ Registrar Pago</button>
        <button class="btn btn-gray" onclick="subTab.pagos='lista';renderTabContent()">Cancelar</button>
      </div>
    </div>
  </div>`;
}
function buscarEstudiantePorCedula(val) {
  const box = document.getElementById("p-sugerencias");
  if (!box) return;
  if (!val || val.length < 2) {
    box.style.display = "none";
    return;
  }
  const v = val.toLowerCase();
  const matches = estudiantes.filter(
    (e) =>
      e.estado !== "retirado" &&
      ((e.cedula && e.cedula.includes(val)) || (e.nombre && e.nombre.toLowerCase().includes(v)))
  );
  if (matches.length === 0) {
    box.style.display = "none";
    return;
  }
  box.style.display = "block";
  box.innerHTML = matches
    .slice(0, 6)
    .map(
      (e) => `
    <div onclick="seleccionarEstudiantePago('${e.id}')" style="padding:0.65rem 1rem;cursor:pointer;border-bottom:1px solid #eef2f9;font-size:0.85rem;transition:background .15s"
      onmouseover="this.style.background='#e8f0fe'" onmouseout="this.style.background='#fff'">
      <div style="font-weight:700;color:#003366">${escHtml(e.nombre)}</div>
      <div style="font-size:0.7rem;color:#888">CC ${escHtml(e.cedula)} · ${escHtml(e.grado) || "Sin grado"}</div>
    </div>`
    )
    .join("");
}
function seleccionarEstudiantePago(estId) {
  const est = estudiantes.find((e) => e.id === estId);
  if (!est) return;
  // Actualiza los campos ocultos
  const cedInput = document.getElementById("p-cedula");
  const nomInput = document.getElementById("p-nombre");
  const telInput = document.getElementById("p-tel");
  const box = document.getElementById("p-sugerencias");
  const buscar = document.getElementById("p-buscar");
  const badge = document.getElementById("p-est-badge");
  const badgeNom = document.getElementById("p-badge-nombre");
  const badgeCed = document.getElementById("p-badge-cedula");
  if (cedInput) cedInput.value = est.cedula || "";
  if (nomInput) nomInput.value = est.nombre;
  if (telInput && !telInput.value) telInput.value = est.telefono || "";
  if (box) box.style.display = "none";
  if (buscar) buscar.value = "";
  if (badge) {
    badge.style.display = "flex";
  }
  if (badgeNom) badgeNom.textContent = est.nombre;
  if (badgeCed) badgeCed.textContent = est.cedula ? "CC " + est.cedula : "";
  window._pagoEstId = estId;
  window._pagoCedula = est.cedula;
}
function limpiarSeleccionPago() {
  const cedInput = document.getElementById("p-cedula");
  const nomInput = document.getElementById("p-nombre");
  const buscar = document.getElementById("p-buscar");
  const badge = document.getElementById("p-est-badge");
  if (cedInput) cedInput.value = "";
  if (nomInput) nomInput.value = "";
  if (buscar) {
    buscar.value = "";
    buscar.focus();
  }
  if (badge) badge.style.display = "none";
  window._pagoEstId = null;
  window._pagoCedula = "";
}
let _metodoPago = "Dólares Efectivo";
function calcBsPago() {
  const usd = parseFmt(document.getElementById("p-total")?.value || "0"),
    tasa = parseTasa(document.getElementById("p-tasa")?.value || "0");
  const box = document.getElementById("p-bs-box");
  if (!box) return;
  if (usd > 0 && tasa > 0) {
    box.style.display = "flex";
    document.getElementById("p-bs-val").textContent = fmtBs(r2(usd * tasa));
  } else box.style.display = "none";
}
function selMetodoPago(m) {
  _metodoPago = m;
  const map = { "Dólares Efectivo": "m-def", "Transferencia Bs": "m-tbs", "Bs Efectivo": "m-bef", Punto: "m-pt" };
  document.querySelectorAll(".metodo-btn").forEach((b) => {
    b.classList.toggle("selected", b.id === map[m]);
  });
}
// Desglose común de los recibos de nómina (sin sección de deducciones).
// El total SIEMPRE es lo realmente pagado. Si lo pagado no coincide con la suma de los conceptos
// (adelanto, descuento fijo, monto editado) se agrega UNA línea de ajuste para que el recibo cuadre.
function desgloseRecibo(pago, t) {
  const lineas = [];
  const sal = (t && t.salario) || 0,
    bA = (t && t.bonoAlimentacion) || 0,
    bP = (t && t.bonoProductividad) || 0;
  const otros = (pago && Array.isArray(pago.otros) ? pago.otros : []).filter((o) => o && o.nombre && o.monto > 0);
  const sumaOtros = otros.reduce((x, o) => x + o.monto, 0);
  if (sal + bA + bP > 0) {
    if (sal > 0) lineas.push({ etq: "Salario base", monto: sal });
    if (bA > 0) lineas.push({ etq: "Bono alimentación", monto: bA });
    if (bP > 0) lineas.push({ etq: "Bono productividad", monto: bP });
  } else if (pago) {
    const mb = pago.montoBase != null ? pago.montoBase : Math.max(0, (pago.monto || 0) - sumaOtros);
    if (mb > 0) lineas.push({ etq: "Pago base", monto: mb });
  }
  otros.forEach((o) => lineas.push({ etq: o.nombre, monto: o.monto, bs: o.montoBs }));
  const suma = lineas.reduce((x, l) => x + l.monto, 0);
  const total = pago ? pago.monto || 0 : Math.max(0, suma - ((t && t.descuento) || 0));
  const dif = Math.round((total - suma) * 100) / 100;
  if (Math.abs(dif) >= 0.01) {
    if (lineas.length === 0) lineas.push({ etq: "Pago de nómina", monto: total });
    else lineas.push({ etq: dif < 0 ? "Ajuste (descuentos / adelantos)" : "Ajuste", monto: dif, ajuste: true });
  }
  const tasa = pago && pago.tasa > 0 ? pago.tasa : (tasaDe(pago ? pago.fecha : todayStr()) || {}).valor || null;
  lineas.forEach((l) => {
    if (l.bs == null) l.bs = tasa ? r2(l.monto * tasa) : null;
  });
  const totalBs = pago && pago.montoBs != null ? pago.montoBs : tasa ? r2(total * tasa) : null;
  return { lineas, total, tasa, totalBs };
}
async function guardarPago() {
  const nombre = document.getElementById("p-nombre").value.trim();
  const cedula = document.getElementById("p-cedula").value.trim();
  const fecha = document.getElementById("p-fecha").value;
  const total = parseFmt(document.getElementById("p-total").value);
  const tasa = parseTasa(document.getElementById("p-tasa") ? document.getElementById("p-tasa").value : "0");
  const errBox = document.getElementById("p-err");
  if (!nombre || !cedula || !total || !fecha) {
    mostrarError(errBox, "Selecciona un estudiante por cédula, completa fecha y total");
    return;
  }
  if (!(tasa > 0)) {
    mostrarError(errBox, "Falta la tasa BCV del día: cárgala con 💱 (arriba) o escríbela en el formulario");
    return;
  }
  const btn = document.querySelector('button[onclick="guardarPago()"]');
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Guardando...";
  }
  const pago = {
    nombre,
    cedula: cedula,
    estId: window._pagoEstId || "",
    telefono: document.getElementById("p-tel").value.trim(),
    fecha,
    concepto: document.getElementById("p-concepto").value,
    mes: document.getElementById("p-mes").value,
    descripcion: document.getElementById("p-desc").value.trim(),
    metodo: _metodoPago,
    total,
    tasa,
    totalBs: r2(total * tasa),
    factura: genFac(),
    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
  };
  try {
    const ref = await db.collection("pagos").add(pago);
    pago.id = ref.id;
    pagos.unshift(pago);
    recordarTasa(fecha, tasa);
    // Deuda manual anterior: con mora automática activa solo la reduce un pago de "Deuda anterior"
    // (las mensualidades se descuentan solas de las cuotas). Sin mora automática se mantiene el comportamiento de siempre.
    if (window._pagoEstId && (!cobCfgActiva() || pago.concepto === "Deuda anterior")) {
      const estIdx = estudiantes.findIndex((e) => e.id === window._pagoEstId);
      if (estIdx >= 0 && estudiantes[estIdx].estado === "mora" && estudiantes[estIdx].moraMonto > 0) {
        const deuda = estudiantes[estIdx].moraMonto;
        const nuevaDeuda = Math.max(0, Math.round((deuda - pago.total) * 100) / 100);
        const nuevoEstado = nuevaDeuda <= 0 ? "alsaldo" : "mora";
        const update = {
          moraMonto: nuevaDeuda,
          estado: nuevoEstado,
          moraConcepto: nuevaDeuda <= 0 ? "" : estudiantes[estIdx].moraConcepto,
        };
        await db.collection("estudiantes").doc(window._pagoEstId).update(update);
        estudiantes[estIdx] = { ...estudiantes[estIdx], ...update };
      }
    }
    window._pagoEstId = null;
    window._pagoCedula = null;
    subTab.pagos = "lista";
    modalActual = { tipo: "recibo", pago };
    render();
  } catch (e) {
    mostrarError(errBox, e.message);
    if (btn) {
      btn.disabled = false;
      btn.textContent = "✓ Registrar Pago";
    }
  }
}
function renderModalNuevoPago() {
  return `<div class="modal-bg"><div class="modal">
    <div class="modal-header"><div><h3>➕ Nuevo Pago</h3></div><button class="modal-close-x" onclick="cerrarModal()">✕</button></div>
    <div class="modal-body">${renderFormPago()}</div>
  </div></div>`;
}
// Totales del recibo estilo factura: referencia en $ + tasa BCV + total en bolívares
function totalesRecibo(p) {
  const b = bsDe(p, p.total);
  const fila = (l, v, big) =>
    `<div style="display:flex;justify-content:space-between;align-items:center;${big ? "" : "font-size:0.8rem;color:#adc8ff;margin-top:5px"}"><span style="${big ? "color:#ffd700;font-size:0.78rem;letter-spacing:1px;text-transform:uppercase" : ""}">${l}</span><span style="${big ? "font-size:1.25rem;font-weight:800;font-family:Georgia,serif" : "font-weight:700;color:#fff"}">${v}</span></div>`;
  return (
    `<div style="background:linear-gradient(135deg,#003366,#00509e);color:#fff;border-radius:10px;padding:0.8rem 0.95rem;margin-top:0.85rem">` +
    fila("Total referencia (USD)", fmt(p.total), true) +
    (b.bs != null
      ? fila(
          "Tasa BCV" + (b.fecha ? " " + fechaCorta(b.fecha) : "") + (b.estimada ? " (est.)" : ""),
          "Bs. " + fmtTasa(b.tasa)
        ) + fila("Total en bolívares", fmtBs(b.bs), true)
      : `<div style="font-size:0.7rem;color:#adc8ff;margin-top:5px">Sin tasa BCV registrada para esta fecha</div>`) +
    `</div>`
  );
}
function renderModalRecibo(m) {
  const p = m.pago;
  if (!p) return "";
  const lines = (p.descripcion || "").split("\n").filter(Boolean);
  return `<div class="modal-bg" onclick="if(event.target.classList.contains('modal-bg'))cerrarModal()">
    <div class="modal">
      <div class="recibo-header">
        <div style="display:flex;align-items:center;gap:0.85rem">
          <img src="data:image/png;base64,${LOGO}" class="recibo-logo" alt="Logo"/>
          <div><small style="font-size:0.55rem;letter-spacing:2px;color:#ffd700;text-transform:uppercase">Recibo de Pago</small>
            <div style="font-size:0.9rem;font-family:Georgia,serif">${EMPRESA}</div>
            <div style="font-size:0.67rem;color:#adc8ff">${EMPRESA_SUB}</div></div>
        </div>
        <div class="recibo-nums">
          <div><div style="font-size:0.58rem;color:#adc8ff">N° Recibo</div><div style="font-weight:800;color:#ffd700;font-size:0.9rem">${escHtml(p.factura) || ""}</div></div>
          <div style="text-align:center"><div style="font-size:0.58rem;color:#adc8ff">Método</div><div style="font-weight:700;font-size:0.82rem">${escHtml(p.metodo) || "Efectivo"}</div></div>
          <div style="text-align:right"><div style="font-size:0.58rem;color:#adc8ff">Fecha</div><div style="font-weight:700;font-size:0.82rem">${escHtml(p.fecha)}</div></div>
        </div>
      </div>
      <div style="padding:1.1rem">
        <div style="background:#f0f4ff;border-radius:10px;padding:0.85rem;margin-bottom:0.85rem;border-left:4px solid #003366">
          <div style="font-size:0.6rem;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:3px">Cliente</div>
          <div style="font-weight:700;font-size:1rem;color:#003366">${escHtml(p.nombre)}</div>
          <div style="color:#555;font-size:0.8rem;margin-top:2px">CC ${escHtml(p.cedula) || "N/A"} · 📞 ${escHtml(p.telefono) || "N/A"}</div>
          ${p.mes ? `<div style="font-size:0.78rem;color:#555;margin-top:2px">📅 Mes: <strong>${escHtml(p.mes)}</strong></div>` : ""}
        </div>
        ${p.concepto ? `<div style="margin-bottom:6px"><span class="badge badge-blue">${escHtml(p.concepto)}</span></div>` : ""}
        ${lines.map((l) => `<div style="display:flex;gap:0.4rem;padding:0.4rem 0;border-bottom:1px dashed #eee;font-size:0.85rem"><span style="color:#003366">✦</span>${escHtml(l)}</div>`).join("")}
        ${totalesRecibo(p)}
        <p style="text-align:center;font-size:0.65rem;color:#aaa;margin-top:0.55rem">Este recibo es válido como comprobante de pago</p>
      </div>
      <div class="modal-actions">
        <button class="btn btn-whatsapp" style="flex:1;display:flex;align-items:center;justify-content:center;gap:0.4rem" onclick="enviarWhatsApp()">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          WhatsApp
        </button>
        <button class="btn btn-print" onclick="imprimirRecibo()">🖨️</button>
        ${rolUsuario === "director" && p.id ? `<button class="btn btn-danger btn-sm" onclick="eliminarRecibo('${p.id}')">🗑️</button>` : ""}
        <button class="btn btn-gray" onclick="cerrarModal()">Cerrar</button>
      </div>
    </div>
  </div>`;
}
async function eliminarRecibo(id) {
  if (rolUsuario !== "director") {
    alert("Sin permiso");
    return;
  }
  if (!confirm("¿Eliminar este recibo?")) return;
  try {
    await db.collection("pagos").doc(id).delete();
    pagos = pagos.filter((p) => p.id !== id);
    cerrarModal();
  } catch (e) {
    alert("Error: " + e.message);
  }
}
function enviarWhatsApp() {
  const p = modalActual.pago;
  if (!p) return;
  const lines = (p.descripcion || "").split("\n").filter(Boolean);
  const bb = bsDe(p, p.total);
  const bsTxt =
    bb.bs != null
      ? `\n💱 Tasa BCV ${fechaCorta(bb.fecha)}: Bs. ${fmtTasa(bb.tasa)}\n🇻🇪 *TOTAL EN Bs: ${fmtBs(bb.bs)}*`
      : "";
  const msg = `🏫 *${EMPRESA}*\n📍 ${EMPRESA_SUB}\n━━━━━━━━━━━━━━━━━━\n🧾 *RECIBO: ${p.factura}*\n📅 *Fecha:* ${p.fecha}\n💳 *Método:* ${p.metodo || "Efectivo"}\n${p.mes ? "📅 *Mes:* " + p.mes + "\n" : ""}\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n👤 *Cliente:* ${p.nombre}\n🪪 *Cédula:* ${p.cedula || "N/A"}\n📞 *Teléfono:* ${p.telefono || "N/A"}\n━━━━━━━━━━━━━━━━━━\n${lines.map((l) => "• " + l).join("\n")}\n━━━━━━━━━━━━━━━━━━\n💰 *TOTAL REF: ${fmt(p.total)}*${bsTxt}\n━━━━━━━━━━━━━━━━━━\n✅ Pago registrado. ¡Gracias!`;
  const telWa = normalizarTelVE(p.telefono);
  if (!telWa) {
    alert("Este pago no tiene teléfono registrado");
    return;
  }
  window.open("https://wa.me/" + telWa + "?text=" + encodeURIComponent(msg), "_blank");
}
function imprimirRecibo() {
  const p = modalActual.pago;
  if (!p) return;
  const lines = (p.descripcion || "").split("\n").filter(Boolean);
  const w = window.open("", "_blank", "width=600,height=800");
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>Recibo ${escHtml(p.factura)}</title>
  <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Segoe UI',sans-serif;padding:1.5rem;max-width:480px;margin:0 auto}
  .hdr{background:linear-gradient(135deg,#003366,#00509e);color:#fff;padding:1.1rem;border-radius:10px 10px 0 0;display:flex;align-items:center;gap:1rem}
  .bdy{border:1px solid #dde3f0;border-top:none;border-radius:0 0 10px 10px;padding:1.1rem}
  .cbox{background:#f0f4ff;border-radius:8px;padding:0.75rem;margin-bottom:0.85rem;border-left:4px solid #003366}
  .tbox{background:linear-gradient(135deg,#003366,#00509e);color:#fff;border-radius:8px;padding:0.75rem 0.9rem;display:flex;justify-content:space-between;margin-top:0.85rem}
  .nums{display:flex;justify-content:space-between;background:rgba(0,0,0,0.2);padding:0.45rem 0.75rem;border-radius:6px;margin-top:0.65rem}
  .firma{display:flex;justify-content:space-between;margin-top:1.5rem;padding-top:0.85rem;border-top:1px dashed #ccc}
  .fbox{text-align:center;width:45%}.fline{border-top:1px solid #333;margin-bottom:4px;margin-top:1.5rem}.flabel{font-size:0.7rem;color:#555}
  </style></head><body>
  <div class="hdr"><img src="data:image/png;base64,${LOGO}" style="width:55px;height:55px;object-fit:contain;border-radius:7px;background:#fff;padding:2px" alt="Logo"/>
    <div><small style="font-size:0.55rem;letter-spacing:2px;color:#ffd700;text-transform:uppercase">Recibo de Pago</small>
    <div style="font-size:0.85rem;font-family:Georgia,serif">${EMPRESA}</div><div style="font-size:0.65rem;color:#adc8ff">${EMPRESA_SUB}</div>
    <div class="nums">
      <div><div style="font-size:0.55rem;color:#adc8ff">Recibo</div><div style="font-weight:800;color:#ffd700;font-size:0.85rem">${escHtml(p.factura)}</div></div>
      <div style="text-align:center"><div style="font-size:0.55rem;color:#adc8ff">Método</div><div style="font-weight:700;font-size:0.78rem">${escHtml(p.metodo) || "Efectivo"}</div></div>
      <div style="text-align:right"><div style="font-size:0.55rem;color:#adc8ff">Fecha</div><div style="font-weight:700;font-size:0.78rem">${escHtml(p.fecha)}</div></div>
    </div></div></div>
  <div class="bdy">
    <div class="cbox"><div style="font-size:0.58rem;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:2px">Cliente</div>
      <div style="font-weight:700;font-size:0.95rem;color:#003366">${escHtml(p.nombre)}</div>
      <div style="font-size:0.78rem;color:#555;margin-top:2px">CC ${escHtml(p.cedula) || "N/A"} · Tel: ${escHtml(p.telefono) || "N/A"}</div>
      ${p.mes ? `<div style="font-size:0.75rem;color:#555;margin-top:2px">Mes: ${escHtml(p.mes)}</div>` : ""}</div>
    ${p.concepto ? `<div style="display:inline-block;padding:0.2rem 0.55rem;border-radius:20px;font-size:0.65rem;font-weight:700;background:#e8f0fe;color:#003366;margin-bottom:6px">${escHtml(p.concepto)}</div>` : ""}
    ${lines.map((l) => `<div style="display:flex;gap:0.4rem;padding:0.38rem 0;border-bottom:1px dashed #eee;font-size:0.82rem"><span style="color:#003366">✦</span>${escHtml(l)}</div>`).join("")}
    ${totalesRecibo(p)}
    <p style="text-align:center;font-size:0.63rem;color:#aaa;margin-top:0.5rem">Este recibo es válido como comprobante de pago</p>
    <div class="firma">
      <div class="fbox"><div class="fline"></div><div class="flabel">Firma Administradora</div></div>
      <div class="fbox"><div class="fline"></div><div class="flabel">Firma Cliente</div></div>
    </div>
  </div>
  </body></html>`);
  w.document.close();
}
