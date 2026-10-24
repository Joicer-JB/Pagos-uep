// Pestaña Cobranza: estudiantes por cobrar, recordatorios por WhatsApp, recibo de cobranza en imagen.

let cobF = { busq: "", grado: "", orden: "monto", dias: 30, vista: "mora" };
let _cobTimer = null;
// Días desde una fecha "YYYY-MM-DD" (hora local, sin desfase por UTC)
function diasDesde(fechaStr) {
  if (!fechaStr) return null;
  const f = new Date(fechaStr + "T00:00:00");
  if (isNaN(f)) return null;
  const h = new Date();
  h.setHours(0, 0, 0, 0);
  return Math.round((h - f) / 86400000);
}
// Teléfono del representante: el primero válido entre el del acudiente y el del estudiante
function telDe(e) {
  const c = [e.telefonoAcudiente, e.telefono];
  for (const x of c) {
    const wa = normalizarTelVE(x);
    if (wa) return { raw: x, wa, fijo: wa[2] === "2" };
  }
  return { raw: c.find(Boolean) || "", wa: "", fijo: false };
}
function filaCobranza(e) {
  const pagosEst = pagosDeEstudiante(e);
  const ultimo = pagosEst.length ? pagosEst.reduce((a, b) => ((a.fecha || "") > (b.fecha || "") ? a : b)) : null;
  const cu = calcCuotas(e);
  const auto = cu ? cu.total : 0,
    manual = deudaManual(e);
  const deuda = r2(auto + manual);
  return {
    e,
    enMora: e.estado !== "retirado" && (deuda > 0 || e.estado === "mora"),
    deuda,
    auto,
    manual,
    meses: cu ? cu.pendientes.map((q) => q.mes) : [],
    ultimo,
    diasSin: ultimo ? diasDesde(ultimo.fecha) : baseAnio() ? diasDesde(baseAnio()) : null,
    diasRec: e.ultimoRecordatorio ? diasDesde(e.ultimoRecordatorio) : null,
    nRec: e.totalRecordatorios || 0,
    tel: telDe(e).raw,
    telWa: telDe(e).wa,
    telFijo: telDe(e).fijo,
  };
}
// Con deuda (cuotas vencidas o deuda manual) + quienes llevan N días sin pagar
function listaCobranza() {
  const lim = Number(cobF.dias) || 30;
  return estudiantes
    .filter((e) => e.estado !== "retirado")
    .map(filaCobranza)
    .filter((r) => r.enMora || (activo(r.e) && (r.diasSin !== null ? r.diasSin >= lim : true)));
}
function cobFiltradas(todos) {
  const q = (cobF.busq || "").toLowerCase();
  const big = 1e9;
  const orden =
    {
      monto: (a, b) => b.deuda - a.deuda,
      dias: (a, b) => (b.diasSin ?? big) - (a.diasSin ?? big),
      norec: (a, b) => (b.diasRec ?? big) - (a.diasRec ?? big),
      nombre: (a, b) => (a.e.nombre || "").localeCompare(b.e.nombre || ""),
    }[cobF.orden] || ((a, b) => b.deuda - a.deuda);
  return todos
    .filter((r) => {
      if (cobF.vista === "mora" && !r.enMora) return false;
      if (cobF.vista === "sinpago" && r.enMora) return false;
      if (cobF.grado && r.e.grado !== cobF.grado) return false;
      if (
        q &&
        !(
          (r.e.nombre || "").toLowerCase().includes(q) ||
          (r.e.cedula || "").includes(q) ||
          (r.e.acudiente || "").toLowerCase().includes(q)
        )
      )
        return false;
      return true;
    })
    .sort(orden);
}
function mensajeCobro(r) {
  const e = r.e,
    tv = tasaDe(todayStr()),
    conTasa = !!(tv && tv.exacta);
  const saludo = e.acudiente ? `Estimado(a) representante *${e.acudiente}*` : "Estimado(a) representante";
  const eq = (usd) => (conTasa ? ` (equivalente a *${fmtBs(r2(usd * tv.valor))}*)` : "");
  let detalle;
  if (r.enMora && r.deuda > 0) {
    const c = conceptoDeE(e);
    detalle = `presenta un saldo pendiente de *${fmt(r.deuda)}*${eq(r.deuda)}${c ? ", por concepto de: " + c : ""}`;
  } else if (r.enMora) detalle = `presenta pagos pendientes${e.moraConcepto ? " (" + e.moraConcepto + ")" : ""}`;
  else {
    detalle =
      r.ultimo && r.diasSin !== null
        ? `no registra pagos desde hace ${r.diasSin} días`
        : baseAnio()
          ? "no registra pagos en el año escolar en curso"
          : "no registra pagos en nuestro sistema";
    if (mensualidadDe(e) > 0) detalle += `. Mensualidad: *${fmt(mensualidadDe(e))}*${eq(mensualidadDe(e))}`;
  }
  const pie = conTasa
    ? `💱 Tasa BCV del ${fechaCorta(tv.fecha)}: Bs. ${fmtTasa(tv.valor)} por $. El pago se recibe en bolívares a la tasa oficial BCV del día del pago.`
    : `💱 El pago se recibe en bolívares a la tasa oficial BCV del día del pago.`;
  return `🏫 *${EMPRESA}*\n${saludo}, le saludamos cordialmente.\n\nLe recordamos que el estudiante *${e.nombre}*${e.grado ? " (" + e.grado + ")" : ""} ${detalle}.\n\n${pie}\n\nAgradecemos regularizar su situación a la brevedad posible. Si ya realizó el pago, por favor envíenos el comprobante.\n\n¡Gracias por su atención!`;
}
async function marcarRecordado(estId) {
  const i = estudiantes.findIndex((x) => x.id === estId);
  if (i < 0) return;
  const upd = { ultimoRecordatorio: hoyLocal(), totalRecordatorios: (estudiantes[i].totalRecordatorios || 0) + 1 };
  try {
    await db.collection("estudiantes").doc(estId).update(upd);
  } catch (err) {
    alert("No se pudo guardar el registro del aviso: " + err.message);
    return;
  }
  ponerEnLista(estudiantes, { id: estId, ...upd }); // por id: la lista pudo cambiar mientras se guardaba
  renderTabContent();
}
// ---- Recibo de cobranza (imagen) y envío por WhatsApp
function modeloReciboCobranza(r) {
  const e = r.e,
    tv = tasaDe(todayStr()),
    conTasa = !!(tv && tv.exacta);
  const filas = [];
  const cu = calcCuotas(e);
  if (cu)
    cu.pendientes.forEach((q) =>
      filas.push({
        desc: "Mensualidad " + q.mes,
        sub: "Venció el " + fechaCorta(q.vence) + (q.pagado > 0 ? " · abonado " + fmt(q.pagado) : ""),
        usd: q.pendiente,
      })
    );
  if (cu && cu.recargoPend > 0)
    filas.push({
      desc: "Recargo por mora",
      sub:
        cu.nRecargos +
        (cu.nRecargos === 1 ? " mensualidad" : " mensualidades") +
        " fuera de fecha · " +
        fmt(cobCfg.recargo) +
        " c/u",
      usd: cu.recargoPend,
    });
  if (deudaManual(e) > 0)
    filas.push({ desc: e.moraConcepto || "Deuda anterior", sub: "Saldo anterior", usd: deudaManual(e) });
  if (!filas.length && r.enMora) filas.push({ desc: e.moraConcepto || "Pagos pendientes", sub: "", usd: 0 });
  if (!filas.length)
    filas.push({
      desc: "Mensualidad",
      sub: r.ultimo ? "Último pago: " + fechaCorta(r.ultimo.fecha) : "Sin pagos registrados",
      usd: mensualidadDe(e),
    });
  const totalUsd = r2(filas.reduce((s, f) => s + f.usd, 0));
  filas.forEach((f) => {
    f.bs = conTasa ? r2(f.usd * tv.valor) : null;
  });
  return {
    empresa: EMPRESA,
    sub: EMPRESA_SUB,
    numero: "COB-" + todayStr().replace(/-/g, "").slice(2) + "-" + String(e.cedula || e.id).slice(-4),
    fecha: fechaCorta(todayStr()),
    estudiante: e.nombre || "",
    grado: e.grado || "",
    representante: e.acudiente || "",
    cedula: e.cedula || "",
    filas,
    totalUsd,
    tasa: conTasa ? tv : null,
    totalBs: conTasa ? r2(totalUsd * tv.valor) : null,
  };
}
function lineasTexto(ctx, txt, maxW) {
  const pal = String(txt || "")
      .split(/\s+/)
      .filter(Boolean),
    out = [];
  let cur = "";
  pal.forEach((p) => {
    const t = cur ? cur + " " + p : p;
    if (ctx.measureText(t).width > maxW && cur) {
      out.push(cur);
      cur = p;
    } else cur = t;
  });
  if (cur) out.push(cur);
  return out.length ? out : [""];
}
// Dibuja el recibo. Con dibujar=false solo mide y devuelve el alto necesario.
function pintarRecibo(ctx, m, W, dibujar) {
  const P = 40,
    AZUL = "#003366",
    ORO = "#ffd700";
  const F = (f) => {
    ctx.font = f;
  };
  const T = (txt, x, y, f, c, al) => {
    F(f);
    if (!dibujar) return;
    ctx.fillStyle = c;
    ctx.textAlign = al || "left";
    ctx.fillText(txt, x, y);
  };
  const R = (x, y, w, h, c) => {
    if (!dibujar) return;
    ctx.fillStyle = c;
    ctx.fillRect(x, y, w, h);
  };
  R(0, 0, W, W * 12, "#ffffff");
  R(0, 0, W, 135, AZUL);
  T(m.empresa, W / 2, 56, "bold 30px Georgia", ORO, "center");
  T(m.sub, W / 2, 86, "17px Arial", "#adc8ff", "center");
  T("RECIBO DE COBRANZA", W / 2, 118, "bold 19px Arial", "#ffffff", "center");
  let y = 169;
  T("N° " + m.numero, P, y, "bold 16px Arial", AZUL);
  T("Fecha: " + m.fecha, W - P, y, "16px Arial", "#555", "right");
  y += 14;
  R(P, y, W - 2 * P, 2, "#e1e8f5");
  y += 30;
  const dato = (et, val) => {
    T(et, P, y, "bold 15px Arial", "#888");
    F("17px Arial");
    const L = lineasTexto(ctx, val, W - 2 * P - 170);
    L.forEach((l, i) => T(l, P + 170, y + i * 22, "17px Arial", "#222"));
    y += L.length * 22 + 8;
  };
  dato("Estudiante", m.estudiante);
  if (m.grado) dato("Grado", m.grado);
  if (m.representante) dato("Representante", m.representante);
  if (m.cedula) dato("Cédula", m.cedula);
  y += 10;
  const xUsd = m.tasa ? W - P - 200 : W - P - 14,
    xBs = W - P - 14;
  R(P, y, W - 2 * P, 40, "#eef3fb");
  T("DETALLE", P + 14, y + 26, "bold 15px Arial", AZUL);
  T("REFERENCIA ($)", xUsd, y + 26, "bold 15px Arial", AZUL, "right");
  if (m.tasa) T("BOLÍVARES (Bs.)", xBs, y + 26, "bold 15px Arial", AZUL, "right");
  y += 40;
  m.filas.forEach((f) => {
    const maxW = xUsd - 130 - (P + 14);
    F("bold 18px Arial");
    const d = lineasTexto(ctx, f.desc, maxW);
    F("14px Arial");
    const s = f.sub ? lineasTexto(ctx, f.sub, maxW) : [];
    const h = Math.max(58, 16 + d.length * 24 + s.length * 20 + 14);
    d.forEach((l, i) => T(l, P + 14, y + 30 + i * 24, "bold 18px Arial", "#222"));
    s.forEach((l, i) => T(l, P + 14, y + 30 + d.length * 24 + i * 20 - 2, "14px Arial", "#888"));
    T(fmt(f.usd), xUsd, y + 32, "bold 18px Arial", "#222", "right");
    if (m.tasa && f.bs != null) T(fmtBs(f.bs), xBs, y + 32, "18px Arial", "#222", "right");
    R(P, y + h - 1, W - 2 * P, 1, "#e8ecf4");
    y += h;
  });
  y += 22;
  const alto = m.tasa ? 150 : 96;
  R(P, y, W - 2 * P, alto, AZUL);
  T("TOTAL REFERENCIA (USD)", P + 20, y + 38, "bold 15px Arial", ORO);
  T(fmt(m.totalUsd), W - P - 20, y + 40, "bold 26px Georgia", ORO, "right");
  if (m.tasa) {
    T("Tasa BCV del " + fechaCorta(m.tasa.fecha), P + 20, y + 72, "15px Arial", "#adc8ff");
    T("Bs. " + fmtTasa(m.tasa.valor) + " por $1", W - P - 20, y + 72, "15px Arial", "#ffffff", "right");
    T("TOTAL EN BOLÍVARES", P + 20, y + 116, "bold 15px Arial", ORO);
    T(fmtBs(m.totalBs), W - P - 20, y + 120, "bold 30px Georgia", "#ffffff", "right");
  } else T("Pagadero en bolívares a la tasa BCV del día del pago", P + 20, y + 74, "14px Arial", "#adc8ff");
  y += alto + 26;
  F("14px Arial");
  lineasTexto(
    ctx,
    "El pago se recibe en bolívares a la tasa oficial BCV del día del pago. Si ya realizó el pago, por favor envíe el comprobante por este medio.",
    W - 2 * P
  ).forEach((l) => {
    T(l, P, y, "14px Arial", "#666");
    y += 20;
  });
  T("¡Gracias por su atención!", W / 2, y + 22, "bold 16px Arial", AZUL, "center");
  return y + 60;
}
async function reciboCobranzaBlob(r) {
  const m = modeloReciboCobranza(r),
    W = 900,
    S = 1.5;
  const medir = document.createElement("canvas").getContext("2d");
  if (!medir) throw new Error("este navegador no puede dibujar el recibo");
  const H = Math.ceil(pintarRecibo(medir, m, W, false));
  const cv = document.createElement("canvas");
  cv.width = Math.round(W * S);
  cv.height = Math.round(H * S);
  const ctx = cv.getContext("2d");
  ctx.scale(S, S);
  pintarRecibo(ctx, m, W, true);
  const blob = await new Promise((res) => cv.toBlob(res, "image/png"));
  if (!blob) throw new Error("no se pudo crear la imagen");
  return blob;
}
function captionCobro(r) {
  const tv = tasaDe(todayStr()),
    con = !!(tv && tv.exacta);
  const tot = r.enMora ? r.deuda : mensualidadDe(r.e);
  return `🏫 *${EMPRESA}*\nRecibo de cobranza — *${r.e.nombre}*\n${r.enMora ? "Saldo pendiente" : "Mensualidad"}: *${fmt(tot)}*${con ? " (*" + fmtBs(r2(tot * tv.valor)) + "* a tasa BCV del " + fechaCorta(tv.fecha) + ")" : ""}\nSi ya realizó el pago, envíenos el comprobante. ¡Gracias!`;
}
function descargarBlob(blob, nombre) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
// Un toque: genera el recibo como imagen y lo manda a WhatsApp.
// Celular: abre la hoja de compartir con la imagen lista (se elige el chat). Computadora: copia la imagen y abre el chat (Ctrl+V).
async function enviarReciboCobranza(estId) {
  const e = estudiantes.find((x) => x.id === estId);
  if (!e) return;
  const r = filaCobranza(e);
  let blob;
  try {
    blob = await reciboCobranzaBlob(r);
  } catch (err) {
    alert("No se pudo generar el recibo (" + err.message + "). Usa «Solo texto».");
    return;
  }
  const nombre =
    "recibo-cobranza-" +
    (e.nombre || "estudiante")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Za-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase() +
    ".png";
  const file = new File([blob], nombre, { type: "image/png" });
  const caption = captionCobro(r);
  if (
    !tasaHoy() &&
    !confirm(
      "No has cargado la tasa BCV de hoy: el recibo saldrá solo con el monto en $ (pagadero en Bs. a la tasa del día).\n\n¿Continuar?"
    )
  )
    return;
  if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text: caption });
      await marcarRecordado(estId);
      return;
    } catch (err) {
      if (err && err.name === "AbortError") return;
    } // si falla por otra razón, sigue con el plan B
  }
  let copiado = false;
  try {
    if (navigator.clipboard && window.ClipboardItem) {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      copiado = true;
    }
  } catch (_) {}
  if (!copiado) descargarBlob(blob, nombre);
  if (!r.telWa) {
    alert(
      (copiado ? "El recibo quedó copiado." : "El recibo se descargó.") +
        "\n\n" +
        (r.tel ? "El número «" + r.tel + "» no es válido para WhatsApp." : "Este estudiante no tiene teléfono.") +
        " Corrígelo con ✏️ o pega el recibo manualmente en el chat."
    );
    return;
  }
  window.open("https://wa.me/" + r.telWa + "?text=" + encodeURIComponent(caption), "_blank");
  alert(
    copiado
      ? "✅ El recibo quedó copiado. En el chat de WhatsApp pega la imagen (Ctrl+V) y envía."
      : "El recibo se descargó. En el chat de WhatsApp adjúntalo con el clip 📎 y envía."
  );
  await marcarRecordado(estId);
}
// Versión solo texto (por si la imagen no se puede usar)
function cobrarWhatsApp(estId) {
  const e = estudiantes.find((x) => x.id === estId);
  if (!e) return;
  const r = filaCobranza(e);
  if (!r.telWa) {
    alert(
      r.tel
        ? "El número «" + r.tel + "» no es válido para WhatsApp. Corrígelo con ✏️."
        : "Este estudiante no tiene teléfono registrado"
    );
    return;
  }
  if (
    !tasaHoy() &&
    !confirm(
      "No has cargado la tasa BCV de hoy. El mensaje saldrá solo con el monto en $ (pagadero en Bs. a la tasa BCV del día).\n\n¿Continuar?"
    )
  )
    return;
  window.open("https://wa.me/" + r.telWa + "?text=" + encodeURIComponent(mensajeCobro(r)), "_blank");
  marcarRecordado(estId);
}
async function corregirTelefono(estId) {
  const e = estudiantes.find((x) => x.id === estId);
  if (!e) return;
  const v = prompt(
    "Teléfono (WhatsApp) del representante de " + e.nombre + ".\nEjemplo: 0412-1234567",
    e.telefonoAcudiente || e.telefono || ""
  );
  if (v === null) return;
  const wa = normalizarTelVE(v);
  if (!wa) {
    alert("Número inválido. Debe llevar el código de operadora y 7 dígitos, por ejemplo 0412-1234567");
    return;
  }
  if (
    wa[2] === "2" &&
    !confirm("Ese parece un teléfono FIJO: WhatsApp normalmente no lo encuentra.\n\n¿Guardarlo de todos modos?")
  )
    return;
  const nuevo = "0" + wa.slice(2, 5) + "-" + wa.slice(5);
  try {
    await db.collection("estudiantes").doc(estId).update({ telefonoAcudiente: nuevo });
  } catch (err) {
    alert("No se pudo guardar: " + err.message);
    return;
  }
  const i = estudiantes.findIndex((x) => x.id === estId);
  estudiantes[i] = { ...estudiantes[i], telefonoAcudiente: nuevo };
  renderTabContent();
}
function onCobBusq(v) {
  cobF.busq = v;
  clearTimeout(_cobTimer);
  _cobTimer = setTimeout(() => {
    renderTabContent();
    const i = document.getElementById("cob-search");
    if (i) {
      i.focus();
      i.setSelectionRange(v.length, v.length);
    }
  }, 200);
}
function cobSet(k, v) {
  cobF[k] = v;
  renderTabContent();
}
function renderCobranza() {
  const lim = Number(cobF.dias) || 30;
  const todos = listaCobranza();
  const nMora = todos.filter((r) => r.enMora).length;
  const nSin = todos.length - nMora;
  const totalDeuda = todos.reduce((s, r) => s + r.deuda, 0);
  const sinAvisar = todos.filter((r) => r.enMora && (r.diasRec === null || r.diasRec >= 7)).length;
  const grados = [...new Set(todos.map((r) => r.e.grado).filter(Boolean))].sort();
  const filas = cobFiltradas(todos);
  const totalVista = filas.reduce((s, r) => s + r.deuda, 0);
  const hoyT = tasaHoy();
  const tv = tasaDe(todayStr());
  return `
  ${htmlCfgCuotas()}
  <div class="card" style="padding:0.7rem 0.85rem;border-left:4px solid ${hoyT ? "#1a9e5c" : "#e53e3e"};display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap">
    <div style="flex:1;min-width:160px;font-size:0.8rem">${hoyT ? `✅ Tasa BCV de hoy: <strong>Bs. ${fmtTasa(tv.valor)}</strong>` : `⚠️ Falta la tasa BCV de hoy: los avisos saldrán solo en $`}</div>
    <button class="btn btn-gray btn-sm" onclick="abrirModal({tipo:'tasa'})">💱 ${hoyT ? "Cambiar" : "Cargar"} tasa</button>
  </div>
  <div class="stats-grid">
    <div class="stat-card red"><div class="stat-val">${nMora}</div><div class="stat-label">⚠️ Con deuda</div></div>
    <div class="stat-card gold"><div class="stat-val">${fmt(totalDeuda)}</div><div class="stat-label">Total adeudado${hoyT ? " · " + fmtBs(aBs(totalDeuda)) : ""}</div></div>
    <div class="stat-card blue"><div class="stat-val">${nSin}</div><div class="stat-label">⏳ Sin pago +${lim} días</div></div>
    <div class="stat-card"><div class="stat-val">${sinAvisar}</div><div class="stat-label">📵 Sin avisar (7+ días)</div></div>
  </div>
  <div class="stabs">
    ${[
      ["mora", "⚠️ Con deuda (" + nMora + ")"],
      ["sinpago", "⏳ Sin pago reciente (" + nSin + ")"],
      ["todos", "Todos (" + todos.length + ")"],
    ]
      .map(
        ([k, l]) =>
          `<button class="stab ${cobF.vista === k ? "active" : ""}" onclick="cobSet('vista','${k}')">${l}</button>`
      )
      .join("")}
  </div>
  <div class="card" style="padding:0.85rem">
    <div style="display:flex;gap:0.4rem;flex-wrap:wrap">
      <input class="inp" id="cob-search" style="flex:2;min-width:150px;padding:0.55rem 0.75rem;font-size:0.82rem" placeholder="🔍 Estudiante, cédula o representante..." value="${cobF.busq}" oninput="onCobBusq(this.value)"/>
      <select class="inp" style="flex:1;min-width:110px;padding:0.55rem 0.75rem;font-size:0.82rem" onchange="cobSet('grado',this.value)">
        <option value="">Todos los grados</option>
        ${grados.map((g) => `<option value="${escHtml(g)}" ${cobF.grado === g ? "selected" : ""}>${escHtml(g)}</option>`).join("")}
      </select>
      <select class="inp" style="flex:1;min-width:110px;padding:0.55rem 0.75rem;font-size:0.82rem" onchange="cobSet('orden',this.value)">
        ${[
          ["monto", "Mayor deuda"],
          ["dias", "Más días sin pagar"],
          ["norec", "Sin avisar primero"],
          ["nombre", "Nombre A-Z"],
        ]
          .map(([k, l]) => `<option value="${k}" ${cobF.orden === k ? "selected" : ""}>${l}</option>`)
          .join("")}
      </select>
      <select class="inp" style="flex:1;min-width:110px;padding:0.55rem 0.75rem;font-size:0.82rem" onchange="cobSet('dias',this.value)" title="Días sin pagar para considerar atraso">
        ${[15, 30, 45, 60].map((d) => `<option value="${d}" ${lim === d ? "selected" : ""}>Sin pago +${d} días</option>`).join("")}
      </select>
    </div>
    <div style="display:flex;gap:0.4rem;margin-top:0.5rem;flex-wrap:wrap">
      <button class="btn btn-print btn-sm" onclick="imprimirCobranza()">🖨️ Imprimir listado</button>
    </div>
  </div>
  ${filas.length ? `<div class="recaudo-box"><div><div style="font-size:0.65rem;color:#adc8ff">${filas.length} estudiante${filas.length !== 1 ? "s" : ""} en esta lista</div><div style="font-size:1.2rem;font-weight:800;font-family:Georgia,serif;color:#ffd700">${fmt(totalVista)}</div>${hoyT ? `<div style="font-size:0.75rem;color:#adc8ff">${fmtBs(aBs(totalVista))}</div>` : ""}</div><div style="font-size:0.7rem;color:#adc8ff;text-align:right">adeudado en la vista</div></div>` : ""}
  ${
    filas.length === 0
      ? `<div class="empty"><div class="empty-icon">✅</div><p>No hay estudiantes en esta lista</p></div>`
      : `<div class="list">${filas
          .map((r) => {
            const e = r.e;
            const ult = r.ultimo
              ? `Último pago: ${escHtml(r.ultimo.fecha)}${r.diasSin !== null ? " (hace " + r.diasSin + " días)" : ""}`
              : baseAnio()
                ? "Sin pagos este año escolar (desde " + fechaCorta(baseAnio()) + ")"
                : "Nunca ha pagado";
            const bRec =
              r.diasRec === null
                ? `<span class="badge badge-red">Sin avisar</span>`
                : `<span class="badge ${r.diasRec < 7 ? "badge-green" : "badge-gold"}">Avisado ${r.diasRec === 0 ? "hoy" : "hace " + r.diasRec + " d"} · ${r.nRec}×</span>`;
            return `<div class="list-item ${r.enMora ? "mora" : ""}" style="cursor:default">
      <div class="item-row">
        <div style="flex:1;min-width:0">
          <div class="item-name">${escHtml(e.nombre)}</div>
          <div class="item-sub">${escHtml(e.grado) || "Sin grado"}${e.acudiente ? " · 👤 " + escHtml(e.acudiente) : ""}</div>
          <div class="item-sub">📞 ${r.telWa ? fmtTelVE(r.telWa) + (r.telFijo ? ` <span style="color:#b8860b">⚠️ fijo (WhatsApp suele no encontrarlo)</span>` : "") : r.tel ? `<span style="color:#c0392b">⚠️ Número inválido: ${escHtml(r.tel)}</span>` : "Sin teléfono"} <a href="#" onclick="corregirTelefono('${e.id}');return false" style="text-decoration:none" title="Corregir teléfono">✏️</a></div>
          ${r.meses.length ? `<div class="item-sub" style="color:#c0392b">📅 Mensualidad: ${r.meses.join(", ")}</div>` : ""}
          ${r.manual > 0 || (e.estado === "mora" && e.moraConcepto) ? `<div class="item-sub" style="color:#c0392b">📋 ${escHtml(e.moraConcepto) || "Deuda anterior"}${r.manual > 0 ? " · " + fmt(r.manual) : ""}</div>` : ""}
          <div class="item-sub">${ult}</div>
          <div style="margin-top:4px">${bRec}</div>
        </div>
        <div class="item-right">
          ${r.enMora ? `<div class="item-amount" style="color:#e53e3e">${fmt(r.deuda)}</div>${hoyT ? `<div style="font-size:0.7rem;color:#888">${fmtBs(aBs(r.deuda))}</div>` : ""}` : `<span class="badge badge-gold">Sin pago reciente</span>`}
          <div style="font-size:0.68rem;color:#888;margin-top:3px">${fmt(mensualidadDe(e))}/mes${becaDe(e) ? " · 🎓" : ""}</div>
        </div>
      </div>
      <div style="display:flex;gap:0.4rem;margin-top:0.6rem;flex-wrap:wrap">
        <button class="btn btn-whatsapp btn-sm" onclick="enviarReciboCobranza('${e.id}')">📲 Enviar recibo</button>
        <button class="btn btn-gray btn-sm" onclick="cobrarWhatsApp('${e.id}')">💬 Solo texto</button>
        <button class="btn btn-gray btn-sm" onclick="marcarRecordado('${e.id}')">✅ Ya avisé</button>
        <button class="btn btn-gray btn-sm" onclick="abrirModal({tipo:'ver-estudiante',id:'${e.id}'})">👁 Ficha</button>
      </div>
    </div>`;
          })
          .join("")}</div>`
  }`;
}
// Tarjeta resumen del Inicio
function renderRecordatoriosPagos() {
  const filas = listaCobranza()
    .filter((r) => r.enMora)
    .sort((a, b) => b.deuda - a.deuda);
  if (filas.length === 0)
    return `
  <div class="card">
    <div class="card-title"><div class="card-bar"></div><h2>⏰ Cobranza</h2></div>
    <div class="alert-item alert-ok">✅ No hay estudiantes con deuda registrada</div>
  </div>`;
  const total = filas.reduce((s, r) => s + r.deuda, 0);
  return `
  <div class="card">
    <div class="card-title"><div class="card-bar"></div><h2>⏰ Por cobrar (${filas.length})</h2>
      <button class="btn btn-primary btn-sm" style="margin-left:auto;font-size:0.7rem" onclick="setTab('cobranza')">Ver cobranza →</button>
    </div>
    <div class="alert-item alert-info" style="justify-content:space-between"><span>Total adeudado</span><strong>${dual(total)}</strong></div>
    ${filas
      .slice(0, 5)
      .map(
        (r) => `<div class="alert-item alert-mora" style="justify-content:space-between">
      <div><strong>${escHtml(r.e.nombre)}</strong> — ${escHtml(r.e.grado) || "Sin grado"}
      <div style="font-size:0.7rem;margin-top:1px">${r.meses.length ? r.meses.length + " cuota" + (r.meses.length > 1 ? "s" : "") + " · " : ""}${r.diasRec === null ? "Sin avisar" : "Avisado hace " + r.diasRec + " días"}</div></div>
      <span style="font-weight:800;font-size:0.82rem">${fmt(r.deuda)}</span></div>`
      )
      .join("")}
    ${filas.length > 5 ? `<div style="font-size:0.75rem;color:#888;text-align:center;margin-top:0.3rem">+${filas.length - 5} más</div>` : ""}
  </div>`;
}
function imprimirCobranza() {
  const filas = cobFiltradas(listaCobranza());
  if (!filas.length) {
    alert("No hay registros para imprimir");
    return;
  }
  const total = filas.reduce((s, r) => s + r.deuda, 0);
  const t = tasaHoy(),
    tv = tasaDe(todayStr());
  const w = abrirVentanaImpresion();
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>Listado de cobranza</title>
  <style>body{font-family:'Segoe UI',sans-serif;padding:1.2rem;color:#222}h2{color:#003366;font-family:Georgia,serif}
  table{width:100%;border-collapse:collapse;font-size:0.78rem;margin-top:0.8rem}th{background:#003366;color:#fff;text-align:left;padding:0.4rem}
  td{padding:0.4rem;border-bottom:1px solid #ddd}.r{text-align:right}tfoot td{font-weight:800;border-top:2px solid #003366}</style></head><body>
  <h2>${EMPRESA}</h2><div>Listado de cobranza · ${new Date().toLocaleDateString("es-CO")} · ${filas.length} estudiante(s)${t ? " · Tasa BCV " + fechaCorta(tv.fecha) + ": Bs. " + fmtTasa(tv.valor) + " por $" : ""}</div>
  <table><thead><tr><th>#</th><th>Estudiante</th><th>Grado</th><th>Representante</th><th>Teléfono</th><th>Concepto</th><th>Último pago</th><th class="r">Adeuda ($)</th>${t ? '<th class="r">Adeuda (Bs.)</th>' : ""}</tr></thead><tbody>
  ${filas.map((r, i) => `<tr><td>${i + 1}</td><td>${escHtml(r.e.nombre)}</td><td>${escHtml(r.e.grado) || ""}</td><td>${escHtml(r.e.acudiente) || ""}</td><td>${escHtml(r.tel)}</td><td>${escHtml(conceptoDeE(r.e)) || (r.enMora ? "" : "Sin pago reciente")}</td><td>${r.ultimo ? escHtml(r.ultimo.fecha) : baseAnio() ? "Sin pagos este año" : "Nunca"}</td><td class="r">${r.enMora ? fmt(r.deuda) : "—"}</td>${t ? `<td class="r">${r.enMora ? fmtBs(aBs(r.deuda)) : "—"}</td>` : ""}</tr>`).join("")}
  </tbody><tfoot><tr><td colspan="7">TOTAL ADEUDADO</td><td class="r">${fmt(total)}</td>${t ? `<td class="r">${fmtBs(aBs(total))}</td>` : ""}</tr></tfoot></table></body></html>`);
  w.document.close();
  setTimeout(() => w.print(), 500);
}
// ---- Estado de cuenta del representante: cuotas del año (pagadas, vencidas y por vencer), inscripción, recargos,
// deuda anterior y los recibos del año. Se imprime (o se comparte como imagen desde el teléfono) o va por WhatsApp.
function estadoCuenta(e, hoy) {
  hoy = hoy || todayStr();
  const c = calcCuotas(e, hoy);
  const desde = cobCfgActiva() ? cobCfg.primerMes + "-01" : (anioVistaObj() || {}).inicio || "";
  const porRecibo = new Map();
  pagosDeEstudiante(e)
    .filter((p) => p.fecha && (!desde || p.fecha >= desde))
    .forEach((p) => {
      const k = p.factura || p.id;
      const r = porRecibo.get(k) || {
        factura: p.factura || "",
        fecha: p.fecha,
        conceptos: [],
        metodos: [],
        total: 0,
        bs: 0,
      };
      const concepto = p.concepto + (p.mes && p.concepto === "Mensualidad" ? " " + p.mes : "");
      if (!r.conceptos.includes(concepto)) r.conceptos.push(concepto);
      if (p.metodo && !r.metodos.includes(p.metodo)) r.metodos.push(p.metodo);
      r.total = r2(r.total + (p.total || 0));
      const b = bsDe(p, p.total);
      if (b.bs != null) r.bs = r2(r.bs + b.bs);
      porRecibo.set(k, r);
    });
  const recibos = [...porRecibo.values()].sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
  const deudaAnt = deudaManual(e);
  const porVencer = c ? r2(c.lista.filter((q) => !q.vencida).reduce((s, q) => s + Math.max(0, q.pendiente), 0)) : 0;
  const tasa = tasaDe(hoy);
  const totalHoy = r2((c ? c.total : 0) + deudaAnt);
  return {
    e,
    hoy,
    c,
    recibos,
    pagado: r2(recibos.reduce((s, r) => s + r.total, 0)),
    deudaAnt,
    porVencer,
    totalHoy,
    tasa,
    totalHoyBs: tasa ? r2(totalHoy * tasa.valor) : null,
  };
}
const estadoCuota = (q) =>
  q.monto <= 0
    ? "Exonerado"
    : q.pendiente <= 0.004
      ? "✓ Pagada" + (q.fechaPago ? " el " + fechaCorta(q.fechaPago) : "")
      : q.vencida
        ? q.pagado > 0
          ? "Abonado " + fmt(q.pagado) + " · vencida"
          : "Vencida"
        : q.pagado > 0
          ? "Abonado " + fmt(q.pagado)
          : "Por vencer";
function imprimirEstadoCuenta(estId) {
  const e = estudiantes.find((x) => x.id === estId);
  if (!e) return;
  const x = estadoCuenta(e);
  const c = x.c;
  const w = abrirVentanaImpresion("width=720,height=1000");
  if (!w) return alert("Permite las ventanas emergentes para imprimir");
  const fila = (cols, clase) =>
    `<tr${clase ? ` class="${clase}"` : ""}>${cols.map((v) => `<td>${v}</td>`).join("")}</tr>`;
  w.document
    .write(`<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>Estado de cuenta - ${escHtml(e.nombre)}</title>
  <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Segoe UI',Arial,sans-serif;color:#222;background:#fff;max-width:720px;margin:0 auto;padding:1rem 1.3rem}
  .hdr{display:flex;align-items:center;gap:0.9rem;padding-bottom:0.6rem;border-bottom:2px solid #003366;margin-bottom:0.7rem}.hdr img{width:48px;height:48px;object-fit:contain}
  .datos{display:grid;grid-template-columns:1fr 1fr;gap:0.2rem 1rem;font-size:0.8rem;border-left:3px solid #003366;padding-left:0.7rem;margin-bottom:0.7rem}
  .datos span{color:#666;font-size:0.68rem;text-transform:uppercase;letter-spacing:0.5px;display:block}
  h2{font-size:0.72rem;text-transform:uppercase;letter-spacing:1px;color:#003366;margin:0.8rem 0 0.3rem}
  table{width:100%;border-collapse:collapse;font-size:0.78rem}td,th{padding:0.28rem 0.35rem;border-bottom:1px dashed #ccc;text-align:left}th{font-size:0.65rem;color:#555;text-transform:uppercase;border-bottom:1.5px solid #003366}
  td:nth-child(n+3){text-align:right}tr.venc td{color:#b00020;font-weight:600}tr.ok td{color:#1a7a4a}
  .tot{border:1.5px solid #003366;border-radius:6px;padding:0.6rem 0.9rem;margin-top:0.8rem}
  .tot div{display:flex;justify-content:space-between;font-size:0.82rem;padding:2px 0}.tot .g{font-size:1rem;font-weight:800;border-top:1px solid #ccc;margin-top:3px;padding-top:5px}
  .nota{font-size:0.68rem;color:#777;margin-top:0.6rem;text-align:center}@media print{.no-print{display:none}}</style></head><body>
  <div class="hdr"><img src="data:image/png;base64,${LOGO}" alt="Logo"/><div>
    <div style="font-size:0.58rem;letter-spacing:2px;color:#003366;font-weight:700;text-transform:uppercase">Estado de cuenta</div>
    <div style="font-size:0.95rem;font-family:Georgia,serif;color:#003366">${EMPRESA}</div><div style="font-size:0.65rem;color:#555">${EMPRESA_SUB} · al ${escHtml(fechaCorta(x.hoy))}</div></div></div>
  <div class="datos">
    <div><span>Estudiante</span><strong>${escHtml(e.nombre)}</strong></div><div><span>Cédula</span>${escHtml(e.cedula) || "N/A"}</div>
    <div><span>Grado</span>${escHtml(e.grado) || "N/A"}${e.seccion ? " «" + escHtml(e.seccion) + "»" : ""}</div><div><span>Representante</span>${escHtml(e.acudiente) || "N/A"}</div>
  </div>
  ${
    c
      ? `<h2>📅 Mensualidades del año escolar</h2><table><tr><th>Mes</th><th>Vence</th><th>Cuota</th><th>Pagado</th><th>Debe</th><th>Estado</th></tr>
    ${c.inscripcion ? fila([escHtml(c.inscripcion.concepto || "Inscripción"), "—", fmt(c.inscripcion.monto), fmt(c.inscripcion.pagado), fmt(c.inscripcion.pendiente), c.inscripcion.pendiente > 0.004 ? "Pendiente" : "✓ Pagada"], c.inscripcion.pendiente > 0.004 ? "venc" : "ok") : ""}
    ${c.lista.map((q) => fila([escHtml(q.mes), escHtml(fechaCorta(q.vence)), fmt(q.monto), fmt(q.pagado), fmt(Math.max(0, q.pendiente)), escHtml(estadoCuota(q)) + (q.recargo ? " · recargo " + fmt(q.recargo) : "")], q.monto > 0 && q.pendiente > 0.004 && q.vencida ? "venc" : q.pendiente <= 0.004 ? "ok" : "")).join("")}
    </table>`
      : ""
  }
  <h2>🧾 Pagos del año</h2>
  ${
    x.recibos.length
      ? `<table><tr><th>Fecha</th><th>Recibo</th><th>Concepto</th><th>$</th><th>Bs.</th></tr>${x.recibos
          .map((r) =>
            fila([
              escHtml(fechaCorta(r.fecha)),
              escHtml(r.factura),
              escHtml(r.conceptos.join(" + ")),
              fmt(r.total),
              r.bs ? fmtBs(r.bs) : "—",
            ])
          )
          .join("")}</table>`
      : `<p style="font-size:0.8rem;color:#888">Sin pagos en el año</p>`
  }
  <div class="tot">
    <div><span>Pagado en el año</span><strong>${fmt(x.pagado)}</strong></div>
    ${c ? `<div><span>Cuotas vencidas por pagar</span><strong>${fmt(c.saldo)}</strong></div>` : ""}
    ${c && c.obligPend > 0.004 ? `<div><span>Inscripción por pagar</span><strong>${fmt(c.obligPend)}</strong></div>` : ""}
    ${c && c.recargoPend > 0.004 ? `<div><span>Recargos por pagar</span><strong>${fmt(c.recargoPend)}</strong></div>` : ""}
    ${x.deudaAnt > 0 ? `<div><span>Deuda anterior</span><strong>${fmt(x.deudaAnt)}</strong></div>` : ""}
    <div class="g"><span>Total a pagar hoy</span><span>${fmt(x.totalHoy)}${x.totalHoyBs != null ? ` · ${fmtBs(x.totalHoyBs)}` : ""}</span></div>
    ${x.porVencer > 0.004 ? `<div><span>Por vencer en el resto del año</span><span>${fmt(x.porVencer)}</span></div>` : ""}
    ${c && c.aFavor > 0.004 ? `<div><span>Saldo a favor</span><strong style="color:#1a7a4a">${fmt(c.aFavor)}</strong></div>` : ""}
  </div>
  <p class="nota">Montos en dólares de referencia${x.tasa ? `; en bolívares a la tasa BCV del ${escHtml(fechaCorta(x.tasa.fecha))} (Bs. ${fmtTasa(x.tasa.valor)})` : ""}. Si ya pagó y no aparece, envíenos el comprobante.</p>
  <div class="no-print" style="text-align:center;padding:0.75rem"><button onclick="window.print()" style="background:#003366;color:#fff;border:none;padding:0.65rem 1.5rem;border-radius:8px;font-weight:700">🖨️ Imprimir / Guardar PDF</button></div>
  </body></html>`);
  w.document.close();
}
// El mismo estado de cuenta, resumido para WhatsApp
function textoEstadoCuenta(x) {
  const { e, c } = x;
  const vencidas = c ? c.pendientes.map((q) => q.mes.split(" ")[0] + " " + fmt(q.pendiente)) : [];
  const l = [
    `🏫 *${EMPRESA}*`,
    `📄 *Estado de cuenta* al ${fechaCorta(x.hoy)}`,
    `👤 ${e.nombre}${e.grado ? " · " + e.grado : ""}`,
    "━━━━━━━━━━━━━━━━━━",
    `✅ Pagado en el año: *${fmt(x.pagado)}*`,
  ];
  if (vencidas.length) l.push(`⚠️ Cuotas vencidas: ${vencidas.join(", ")}`);
  if (c && c.obligPend > 0.004) l.push(`🎟️ ${c.inscripcion.concepto || "Inscripción"} por pagar: ${fmt(c.obligPend)}`);
  if (c && c.recargoPend > 0.004) l.push(`⏰ Recargos: ${fmt(c.recargoPend)}`);
  if (x.deudaAnt > 0) l.push(`📌 Deuda anterior: ${fmt(x.deudaAnt)}`);
  l.push(
    x.totalHoy > 0.004
      ? `💰 *Total a pagar hoy: ${fmt(x.totalHoy)}*${x.totalHoyBs != null ? ` (${fmtBs(x.totalHoyBs)})` : ""}`
      : "🎉 *Está al día.* ¡Gracias!"
  );
  if (c && c.proxima)
    l.push(`📅 Próxima cuota: ${c.proxima.mes} ${fmt(c.proxima.pendiente)} (vence el ${fechaCorta(c.proxima.vence)})`);
  if (c && c.aFavor > 0.004) l.push(`💚 Saldo a favor: ${fmt(c.aFavor)}`);
  l.push("━━━━━━━━━━━━━━━━━━", "Si ya pagó y no aparece, envíenos el comprobante.");
  return l.join("\n");
}
function whatsappEstadoCuenta(estId) {
  const e = estudiantes.find((x) => x.id === estId);
  if (!e) return;
  const tel = telDe(e);
  if (!tel.wa) return alert("Este estudiante no tiene un teléfono válido para WhatsApp");
  window.open("https://wa.me/" + tel.wa + "?text=" + encodeURIComponent(textoEstadoCuenta(estadoCuenta(e))), "_blank");
}
