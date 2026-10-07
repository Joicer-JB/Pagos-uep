// Pestaña Caja: cobro rápido por estudiante (cuotas, deudas y otros conceptos), teclado numérico táctil y cierre de caja.

// Pensada para cobrar en 3 toques: 1) buscar y tocar al estudiante  2) tocar el método de pago  3) COBRAR.
// Ya trae marcado lo que debe (mensualidades vencidas, recargo, deuda anterior), calcula el monto en Bs. a la tasa
// del día y guarda al instante. Al final del día, el «Cierre de caja» cuadra lo cobrado contra el efectivo, el punto y el banco.
let caja = { q: "", estId: "", sel: {}, otro: null, metodo: "", ref: "", guardando: false, vista: "cobro", cierre: "" };
const cajaNorm = (s) =>
  sinAcento(s)
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const ETIQ_METODO = {
  "Dólares Efectivo": "💵 $ Efectivo",
  "Bs Efectivo": "💵 Bs Efectivo",
  Punto: "💳 Punto",
  "Transferencia Bs": "📲 Transferencia / Pago móvil",
};
const metodoEnBs = (m) => !!m && m !== "Dólares Efectivo";
const cajaEst = () => estudiantes.find((e) => e.id === caja.estId) || null;
const cajaReset = () => {
  caja.estId = "";
  caja.sel = {};
  caja.otro = null;
  caja.metodo = "";
  caja.ref = "";
  caja.guardando = false;
  caja.q = "";
};
// ---- Teclado numérico propio (para pantallas táctiles): aparece al tocar la referencia, «otro monto» o el cuadre.
// Los campos son de solo lectura, así que NO sale el teclado de Windows/celular (que es pequeño y tapa media pantalla).
// También se puede escribir con un teclado físico mientras el teclado numérico está abierto.
let pad = { id: "", tipo: "", label: "", unit: "" };
const cajaPadEl = () => {
  let el = document.getElementById("caja-pad");
  if (!el) {
    el = document.createElement("div");
    el.id = "caja-pad";
    document.body.appendChild(el);
  }
  return el;
};
function cajaPadAbrir(el) {
  if (!el || !el.id) return;
  const nuevo = pad.id !== el.id;
  pad = {
    id: el.id,
    tipo: el.dataset.pad || "monto",
    label: el.dataset.padLabel || "",
    unit: el.dataset.padUnit || "",
  };
  if (nuevo) {
    cajaPadPintar();
    setTimeout(() => {
      const x = document.getElementById(pad.id);
      if (x && x.scrollIntoView) x.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 60);
  }
  cajaPadMarcar();
}
function cajaPadPintar() {
  const el = cajaPadEl();
  if (!pad.id) {
    el.style.display = "none";
    el.innerHTML = "";
    document.body.style.paddingBottom = "";
    return;
  }
  const tecla = (k, txt, extra) =>
    `<button type="button" onclick="cajaPadTecla('${k}')" style="height:58px;font-size:1.6rem;font-weight:700;font-family:inherit;border-radius:12px;border:1px solid #cfd8ea;background:${extra || "#fff"};color:#003366;touch-action:manipulation;user-select:none;-webkit-user-select:none;cursor:pointer">${txt}</button>`;
  el.style.cssText =
    "position:fixed;left:50%;transform:translateX(-50%);bottom:0;width:100%;max-width:460px;z-index:2500;background:#fff;border-radius:16px 16px 0 0;box-shadow:0 -6px 24px rgba(0,30,80,0.28);overflow:hidden;display:block";
  el.innerHTML = `<div style="display:flex;align-items:center;gap:0.6rem;padding:0.55rem 0.8rem;background:#003366;color:#fff">
      <div style="flex:1;min-width:0"><div style="font-size:0.68rem;color:#adc8ff">${escHtml(pad.label)}</div>
        <div id="caja-pad-val" style="font-size:1.55rem;font-weight:800;color:#ffd700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"></div></div>
      <button type="button" onclick="cajaPadCerrar()" style="padding:0.7rem 1.1rem;font-size:1rem;font-weight:800;font-family:inherit;border:none;border-radius:10px;background:#1a9e5c;color:#fff;touch-action:manipulation;cursor:pointer">Listo ✓</button></div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:7px;padding:9px;background:#eef2f9">
      ${["7", "8", "9", "4", "5", "6", "1", "2", "3"].map((k) => tecla(k, k)).join("")}
      ${pad.tipo === "monto" ? tecla(",", ",") : tecla("C", "C", "#fff4e5")}${tecla("0", "0")}${tecla("del", "⌫", "#fff4e5")}
    </div>`;
  document.body.style.paddingBottom = (el.offsetHeight || 330) + "px";
  cajaPadValor();
}
function cajaPadValor() {
  const el = document.getElementById(pad.id),
    o = document.getElementById("caja-pad-val");
  if (!o) return;
  const v = el ? el.value : "";
  o.textContent = v ? (pad.unit ? pad.unit + " " : "") + v : pad.unit ? pad.unit + " 0" : "…";
}
// Resalta el campo activo; si el campo ya no existe (se cambió de pantalla o de método) cierra el teclado
function cajaPadMarcar() {
  document.querySelectorAll("[data-pad]").forEach((x) => {
    x.style.outline = "";
  });
  if (!pad.id) return;
  const el = document.getElementById(pad.id);
  if (!el) {
    cajaPadCerrar();
    return;
  }
  el.style.outline = "3px solid #1a9e5c";
  el.style.outlineOffset = "1px";
}
function cajaPadCerrar() {
  document.querySelectorAll("[data-pad]").forEach((x) => {
    x.style.outline = "";
  });
  pad = { id: "", tipo: "", label: "", unit: "" };
  cajaPadPintar();
}
function cajaPadTecla(k) {
  const el = document.getElementById(pad.id);
  if (!el) {
    cajaPadCerrar();
    return;
  }
  let v = el.value || "";
  if (k === "del") v = v.slice(0, -1);
  else if (k === "C") v = "";
  else if (k === ",") {
    if (pad.tipo === "monto" && !v.includes(",") && v.length < 10) v = (v || "0") + ",";
  } else if (/^\d$/.test(k)) {
    if (pad.tipo === "ref") {
      if (v.length < 12) v += k;
    } else if (v.includes(",")) {
      if (v.split(",")[1].length < 2) v += k;
    } else if (v.length < 7) v = (v === "0" ? "" : v) + k; // hasta 7 cifras enteras; el 0 inicial se reemplaza
  }
  if (v !== el.value) {
    el.value = v;
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }
  cajaPadValor();
}
document.addEventListener("keydown", (e) => {
  if (!pad.id || e.ctrlKey || e.metaKey || e.altKey) return;
  const el = document.getElementById(pad.id);
  if (!el) {
    cajaPadCerrar();
    return;
  }
  const a = document.activeElement;
  if (a && a !== el && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && !a.hasAttribute("data-pad")) return; // está escribiendo en otro campo
  if (e.key === "Enter" || e.key === "Escape") {
    e.preventDefault();
    cajaPadCerrar();
    return;
  }
  let k = null;
  if (/^\d$/.test(e.key)) k = e.key;
  else if (e.key === "," || e.key === ".") k = ",";
  else if (e.key === "Backspace") k = "del";
  if (k) {
    e.preventDefault();
    cajaPadTecla(k);
  }
});
// Acepta 45, 45,50, 45.50 y 1.234,50. (En el celular el teclado numérico suele dar punto.)
function parseMontoCaja(s) {
  s = String(s || "")
    .trim()
    .replace(/[^0-9.,]/g, "");
  if (!s) return 0;
  if (s.includes(",")) return parseFmt(s);
  if (/^\d+\.\d{1,2}$/.test(s)) return parseFloat(s);
  return parseFmt(s);
}
// Lo que se le puede cobrar a un estudiante: cuotas vencidas + la próxima, recargo y deuda anterior
function cajaItems(e) {
  const cu = calcCuotas(e),
    it = [];
  if (cu) {
    cu.lista
      .filter((q) => q.pendiente > 0.004 && (q.vencida || q === cu.proxima))
      .forEach((q) =>
        it.push({
          key: "m" + q.ym,
          tipo: "m",
          concepto: "Mensualidad",
          label: "Mensualidad " + q.mes,
          mes: MESES[Number(q.ym.slice(5, 7)) - 1],
          monto: q.pendiente,
          vencida: q.vencida,
          sub: q.vencida
            ? "Venció el " + fechaCorta(q.vence) + (q.pagado > 0 ? " · ya abonó " + fmt(q.pagado) : "")
            : "Vence el " + fechaCorta(q.vence),
        })
      );
    if (cu.recargoPend > 0)
      it.push({
        key: "r",
        tipo: "r",
        concepto: "Recargo",
        label: "Recargo por mora",
        monto: cu.recargoPend,
        vencida: true,
        sub: cu.nRecargos + (cu.nRecargos === 1 ? " mensualidad" : " mensualidades") + " fuera de fecha",
      });
  }
  if (deudaManual(e) > 0)
    it.push({
      key: "d",
      tipo: "d",
      concepto: "Deuda anterior",
      label: e.moraConcepto || "Deuda anterior",
      monto: deudaManual(e),
      vencida: true,
      sub: "Saldo anterior",
    });
  return { items: it, cu };
}
function cajaLineas() {
  const e = cajaEst();
  if (!e) return { lineas: [], total: 0 };
  const L = [];
  cajaItems(e)
    .items.filter((i) => caja.sel[i.key])
    .forEach((i) =>
      L.push({ concepto: i.concepto, monto: i.monto, desc: i.label + " — " + fmt(i.monto), mes: i.mes || "" })
    );
  if (caja.otro) {
    const m = r2(parseMontoCaja(caja.otro.monto));
    if (m > 0)
      L.push({
        concepto: caja.otro.concepto,
        monto: m,
        desc: (caja.otro.concepto === "Mensualidad" ? "Abono de mensualidad" : caja.otro.concepto) + " — " + fmt(m),
        mes: "",
      });
  }
  return { lineas: L, total: r2(L.reduce((s, x) => s + x.monto, 0)) };
}
function renderCaja() {
  cajaPadCerrar(); // si hay un render completo, el campo activo ya no existe
  if (soloLectura())
    return `<div class="card"><div class="alert-item alert-info">📚 La caja solo funciona en el año escolar actual. Cambia al año actual (arriba) para cobrar.</div></div>`;
  return caja.vista === "cierre" ? renderCajaCierre() : renderCajaCobro();
}
function renderCajaCobro() {
  const hoy = todayStr(),
    delDia = pagos.filter((p) => p.fecha === hoy);
  const td = totalesDual(delDia.map((p) => ({ usd: p.total || 0, rec: p })));
  const tv = tasaHoyValor();
  return `
  <div style="display:flex;justify-content:space-between;align-items:center;gap:0.5rem;margin-bottom:0.6rem;flex-wrap:wrap">
    <div class="section-title" style="margin:0">💳 Caja · ${fechaCorta(hoy)}</div>
    <div style="display:flex;gap:0.4rem">
      <button class="btn btn-gray btn-sm" onclick="abrirModal({tipo:'tasa'})" style="${tv ? "" : "background:#c0392b;color:#fff"}">${tv ? "💱 Bs. " + fmtTasa(tv) : "⚠️ Cargar tasa BCV"}</button>
      <button class="btn btn-primary btn-sm" onclick="caja.vista='cierre';caja.cierre=todayStr();renderTabContent()">🔒 Cierre de caja</button>
    </div>
  </div>
  <div class="stats-grid" style="grid-template-columns:1fr 1fr">
    <div class="stat-card green"><div class="stat-val">${fmt(td.usd)}</div><div class="stat-label">Cobrado hoy${tv ? " · " + fmtBs(td.bs) : ""}</div></div>
    <div class="stat-card"><div class="stat-val">${delDia.length}</div><div class="stat-label">Cobros de hoy</div></div>
  </div>
  <div class="search-bar"><input class="inp" id="caja-q" autocomplete="off" placeholder="🔍 Nombre, cédula o representante…" value="${escHtml(caja.q)}" oninput="cajaBuscar(this.value)" style="font-size:1rem;padding:0.85rem"/></div>
  <div id="caja-res">${caja.estId ? "" : htmlCajaResultados()}</div>
  <div id="caja-panel">${htmlCajaPanel()}</div>
  ${
    delDia.length
      ? `<div class="section-title" style="margin-top:1rem">Últimos cobros de hoy</div>
    ${delDia
      .slice(0, 6)
      .map(
        (
          p
        ) => `<div class="list-item"><div class="item-row"><div style="flex:1"><div class="item-name">${escHtml(p.nombre || "")}</div>
      <div class="item-sub">${escHtml(p.concepto || "")} · ${escHtml(ETIQ_METODO[p.metodo] || p.metodo || "")}${p.referencia ? " · ref " + escHtml(p.referencia) : ""}</div></div>
      <div style="font-weight:800;color:#1a9e5c">${fmt(p.total)}</div></div></div>`
      )
      .join("")}`
      : ""
  }`;
}
function cajaBuscar(q) {
  caja.q = q;
  if (caja.estId) {
    caja.estId = "";
    caja.sel = {};
    caja.otro = null;
    caja.metodo = "";
    caja.ref = "";
    const p = document.getElementById("caja-panel");
    if (p) p.innerHTML = "";
  }
  const r = document.getElementById("caja-res");
  if (r) r.innerHTML = htmlCajaResultados();
}
function htmlCajaResultados() {
  const q = cajaNorm(caja.q);
  if (q.length < 2)
    return `<div style="text-align:center;color:#888;font-size:0.82rem;padding:0.8rem">Escribe al menos 2 letras del nombre, la cédula o el representante</div>`;
  const toks = q.split(" ");
  const lista = estudiantes
    .filter(
      (e) =>
        (activo(e) || deudaManual(e) > 0) &&
        (() => {
          const hay = cajaNorm([e.nombre, e.cedula, e.acudiente, e.cedulaAcudiente].join(" "));
          return toks.every((t) => hay.includes(t));
        })()
    )
    .sort((a, b) => String(a.nombre).localeCompare(String(b.nombre)))
    .slice(0, 8);
  if (!lista.length)
    return `<div style="text-align:center;color:#888;font-size:0.85rem;padding:0.8rem">No hay estudiantes con «${escHtml(caja.q)}»</div>`;
  return lista
    .map((e) => {
      const d = deudaDe(e);
      return `<div class="list-item" style="cursor:pointer" onclick="cajaElegir('${e.id}')"><div class="item-row">
      <div style="flex:1"><div class="item-name">${escHtml(e.nombre)}</div><div class="item-sub">${escHtml(e.grado || "Sin grado")}${e.acudiente ? " · 👤 " + escHtml(e.acudiente) : ""}</div></div>
      ${d > 0 ? `<span class="badge badge-red">Debe ${fmt(d)}</span>` : `<span class="badge badge-green">Al día</span>`}</div></div>`;
    })
    .join("");
}
function cajaElegir(id) {
  caja.estId = id;
  caja.sel = {};
  caja.otro = null;
  caja.metodo = "";
  caja.ref = "";
  caja.guardando = false;
  const e = cajaEst();
  if (!e) return;
  const { items } = cajaItems(e);
  const venc = items.filter((i) => i.vencida);
  (venc.length ? venc : items.filter((i) => i.tipo === "m").slice(0, 1)).forEach((i) => {
    caja.sel[i.key] = true;
  });
  const r = document.getElementById("caja-res");
  if (r) r.innerHTML = "";
  const q = document.getElementById("caja-q");
  if (q) {
    caja.q = e.nombre;
    q.value = e.nombre;
  }
  cajaRefrescar();
}
function cajaLimpiar() {
  cajaReset();
  const q = document.getElementById("caja-q");
  if (q) {
    q.value = "";
    q.focus();
  }
  const r = document.getElementById("caja-res");
  if (r) r.innerHTML = htmlCajaResultados();
  cajaRefrescar();
}
function cajaRefrescar() {
  const p = document.getElementById("caja-panel");
  if (p) p.innerHTML = htmlCajaPanel();
  cajaPadMarcar();
}
function cajaActualizarTotal() {
  const t = document.getElementById("caja-total");
  if (t) t.innerHTML = htmlCajaTotal();
}
// Las mensualidades se pagan de la más antigua a la más nueva: marcar una marca también las anteriores
function cajaToggle(key) {
  const e = cajaEst();
  if (!e) return;
  const { items } = cajaItems(e);
  const meses = items.filter((i) => i.tipo === "m"),
    it = items.find((i) => i.key === key);
  if (!it) return;
  const on = !caja.sel[key];
  if (it.tipo === "m") {
    const idx = meses.findIndex((i) => i.key === key);
    meses.forEach((m, k) => {
      if (on && k <= idx) caja.sel[m.key] = true;
      if (!on && k >= idx) delete caja.sel[m.key];
    });
  } else if (on) caja.sel[key] = true;
  else delete caja.sel[key];
  cajaRefrescar();
}
function cajaOtro(on) {
  caja.otro = on ? { concepto: "Mensualidad", monto: "" } : null;
  cajaRefrescar();
}
function cajaOtroConcepto(v) {
  if (caja.otro) {
    caja.otro.concepto = v;
    cajaActualizarTotal();
  }
}
function cajaOtroMonto(v) {
  if (caja.otro) {
    caja.otro.monto = v;
    cajaActualizarTotal();
  }
}
function cajaMetodo(m) {
  caja.metodo = m;
  cajaRefrescar();
}
function cajaRef(v) {
  caja.ref = v.replace(/[^0-9A-Za-z\-]/g, "").slice(0, 30);
  cajaActualizarTotal();
}
function htmlCajaPanel() {
  const e = cajaEst();
  if (!e) return "";
  const { items, cu } = cajaItems(e);
  const hermanos = estudiantes.filter(
    (x) =>
      x.id !== e.id &&
      (activo(x) || deudaManual(x) > 0) &&
      ((e.acudiente && cajaNorm(x.acudiente) === cajaNorm(e.acudiente)) ||
        (e.cedulaAcudiente && x.cedulaAcudiente === e.cedulaAcudiente))
  );
  const fila = (i) => {
    const on = !!caja.sel[i.key];
    return `<div onclick="cajaToggle('${i.key}')" style="display:flex;align-items:center;gap:0.7rem;padding:0.75rem;border:2px solid ${on ? "#1a9e5c" : "#dde3f0"};background:${on ? "#f0fff6" : "#fff"};border-radius:12px;margin-top:0.5rem;cursor:pointer;-webkit-tap-highlight-color:transparent">
      <div style="width:28px;height:28px;flex:none;border-radius:8px;border:2px solid ${on ? "#1a9e5c" : "#b8c2d6"};background:${on ? "#1a9e5c" : "#fff"};color:#fff;font-weight:900;display:flex;align-items:center;justify-content:center">${on ? "✓" : ""}</div>
      <div style="flex:1;min-width:0"><div style="font-weight:700;color:#222">${escHtml(i.label)}</div><div style="font-size:0.72rem;color:${i.vencida ? "#c0392b" : "#888"}">${escHtml(i.sub)}</div></div>
      <div style="font-weight:800;color:#003366;white-space:nowrap">${fmt(i.monto)}</div></div>`;
  };
  const necesitaRef = caja.metodo === "Punto" || caja.metodo === "Transferencia Bs";
  return `<div class="card" style="padding:0.9rem">
    <div style="display:flex;justify-content:space-between;gap:0.5rem;align-items:flex-start">
      <div style="min-width:0"><div style="font-weight:800;font-size:1.05rem;color:#003366">${escHtml(e.nombre)}</div>
        <div style="font-size:0.78rem;color:#666">${escHtml(e.grado || "Sin grado")}${e.acudiente ? " · Rep: " + escHtml(e.acudiente) : ""}</div></div>
      <button class="btn btn-gray btn-sm" onclick="cajaLimpiar()">✕</button></div>
    ${hermanos.length ? `<div style="margin-top:0.5rem;font-size:0.72rem;color:#666">Hermanos: ${hermanos.map((h) => `<button class="btn btn-gray btn-sm" style="margin:2px" onclick="cajaElegir('${h.id}')">${escHtml(String(h.nombre).split(" ").slice(0, 2).join(" "))}${deudaDe(h) > 0 ? " · debe " + fmt(deudaDe(h)) : ""}</button>`).join("")}</div>` : ""}
    ${
      !cu
        ? `<div class="alert-item alert-mora" style="margin-top:0.6rem">⚠️ Las cuotas del año no están configuradas o este estudiante no tiene mensualidad. Usa «Otro monto».</div>`
        : !(e.mensualidad > 0)
          ? `<div class="alert-item alert-mora" style="margin-top:0.6rem">⚠️ Este estudiante no tiene mensualidad asignada (ficha del estudiante).</div>`
          : ""
    }
    ${items.length ? items.map(fila).join("") : cu && e.mensualidad > 0 ? `<div style="text-align:center;color:#1a9e5c;font-weight:700;padding:0.8rem">✅ Está al día. Puedes usar «Otro monto» para un adelanto.</div>` : ""}
    ${
      caja.otro
        ? `<div style="margin-top:0.6rem;background:#f8faff;border-radius:12px;padding:0.7rem">
        <div class="form-row">
          <div class="field"><label class="field-label">Concepto</label><select class="inp" onchange="cajaOtroConcepto(this.value)">${["Mensualidad", "Inscripción", "Uniformes", "Recargo", "Deuda anterior", "Otro"].map((c) => `<option value="${c}" ${caja.otro.concepto === c ? "selected" : ""}>${c === "Mensualidad" ? "Abono / adelanto de mensualidad" : c}</option>`).join("")}</select></div>
          <div class="field"><label class="field-label">Monto ($)</label><input class="inp" id="caja-otro-inp" readonly inputmode="none" data-pad="monto" data-pad-label="Monto a cobrar ($)" data-pad-unit="$" onclick="cajaPadAbrir(this)" onfocus="cajaPadAbrir(this)" autocomplete="off" placeholder="Toca aquí" value="${escHtml(caja.otro.monto)}" oninput="cajaOtroMonto(this.value)" style="cursor:pointer"/></div>
        </div><button class="btn btn-gray btn-sm" onclick="cajaOtro(false)">Quitar</button></div>`
        : `<button class="btn btn-gray btn-sm" style="margin-top:0.6rem" onclick="cajaOtro(true)">➕ Otro monto (abono, inscripción, uniformes…)</button>`
    }
    <div class="field-label" style="margin-top:0.9rem">¿Cómo paga?</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem">
      ${METODOS.map(([m]) => `<button class="metodo-btn ${caja.metodo === m ? "selected" : ""}" style="padding:0.95rem 0.4rem;font-size:0.9rem" onclick="cajaMetodo('${m}')">${ETIQ_METODO[m] || m}</button>`).join("")}
    </div>
    ${
      necesitaRef
        ? `<div class="field" style="margin-top:0.6rem"><label class="field-label">${caja.metodo === "Punto" ? "Referencia del voucher (últimos dígitos) — opcional, ayuda a cuadrar" : "Referencia de la transferencia / pago móvil *"}</label>
      <input class="inp" id="caja-ref-inp" readonly inputmode="none" data-pad="ref" data-pad-label="Referencia" data-pad-unit="" onclick="cajaPadAbrir(this)" onfocus="cajaPadAbrir(this)" autocomplete="off" placeholder="Toca aquí y escribe la referencia" value="${escHtml(caja.ref)}" oninput="cajaRef(this.value)" style="font-size:1.1rem;cursor:pointer"/></div>`
        : ""
    }
    <div id="caja-total">${htmlCajaTotal()}</div>
  </div>`;
}
function htmlCajaTotal() {
  const { total } = cajaLineas(),
    tv = tasaHoyValor(),
    bs = tv ? r2(total * tv) : 0;
  let falta = "";
  if (!tv) falta = "Falta la tasa BCV de hoy";
  else if (!(total > 0)) falta = "Marca lo que paga";
  else if (!caja.metodo) falta = "Toca cómo paga";
  else if (caja.metodo === "Transferencia Bs" && caja.ref.replace(/\D/g, "").length < 4)
    falta = "Escribe la referencia";
  return `<div style="background:linear-gradient(135deg,#003366,#00509e);color:#fff;border-radius:14px;padding:0.9rem;margin-top:0.8rem;text-align:center">
      <div style="font-size:0.68rem;color:#adc8ff;letter-spacing:1.5px">TOTAL A COBRAR</div>
      <div style="font-size:2rem;font-weight:800;color:#ffd700;line-height:1.2">${fmt(total)}</div>
      ${
        tv
          ? `<div style="font-size:1.15rem;font-weight:700">${fmtBs(bs)}</div><div style="font-size:0.68rem;color:#adc8ff">Tasa BCV de hoy: Bs. ${fmtTasa(tv)}</div>`
          : `<div style="font-size:0.78rem;color:#ffd700;margin-top:4px">⚠️ Carga la tasa BCV de hoy con el botón de arriba</div>`
      }
      ${metodoEnBs(caja.metodo) && tv && total > 0 ? `<div style="margin-top:0.5rem;background:rgba(255,255,255,0.16);border-radius:10px;padding:0.45rem;font-size:0.9rem">${caja.metodo === "Punto" ? "Digita en el punto" : caja.metodo === "Bs Efectivo" ? "Recibe en efectivo" : "Debe transferir"}: <strong style="color:#ffd700">${fmtBs(bs)}</strong></div>` : ""}
    </div>
    <button class="btn btn-success btn-full" style="margin-top:0.7rem;padding:1.05rem;font-size:1.1rem" ${falta || caja.guardando ? "disabled" : ""} onclick="cajaCobrar()">${caja.guardando ? "Guardando…" : falta || "✅ COBRAR " + fmt(total)}</button>`;
}
// Guarda un pago por concepto (para que cada uno se descuente de su cuota/recargo/deuda) con el mismo N° de recibo, y muestra UN recibo.
async function cajaCobrar() {
  if (caja.guardando) return;
  const e = cajaEst(),
    tv = tasaHoyValor(),
    { lineas, total } = cajaLineas();
  if (!e || !(total > 0) || !tv || !caja.metodo) return;
  if (soloLectura()) {
    alert("Estás viendo un año anterior (solo lectura).");
    return;
  }
  const ref = caja.ref.trim();
  if (caja.metodo === "Transferencia Bs" && ref.replace(/\D/g, "").length < 4) {
    alert("Escribe la referencia de la transferencia");
    return;
  }
  if (
    ref &&
    metodoEnBs(caja.metodo) &&
    pagos.some(
      (p) => p.metodo === caja.metodo && p.referencia && String(p.referencia) === ref && p.fecha === todayStr()
    )
  ) {
    if (!confirm("⚠️ La referencia " + ref + " ya se registró hoy con este método.\n¿Seguro que es un cobro distinto?"))
      return;
  }
  caja.guardando = true;
  cajaPadCerrar();
  cajaActualizarTotal();
  const fecha = todayStr(),
    factura = genFac(),
    porConcepto = new Map();
  lineas.forEach((l) => {
    const g = porConcepto.get(l.concepto) || { concepto: l.concepto, monto: 0, desc: [], meses: [] };
    g.monto = r2(g.monto + l.monto);
    g.desc.push(l.desc);
    if (l.mes) g.meses.push(l.mes);
    porConcepto.set(l.concepto, g);
  });
  const base = {
    nombre: e.nombre,
    cedula: e.cedula || "",
    estId: e.id,
    telefono: telDe(e).raw || "",
    fecha,
    metodo: caja.metodo,
    tasa: tv,
    factura,
    origen: "caja",
    ...(ref ? { referencia: ref } : {}),
  };
  const docs = [...porConcepto.values()].map((g) => ({
    ...base,
    concepto: g.concepto,
    mes: g.meses[0] || "",
    descripcion: g.desc.join("\n") + (ref ? "\nRef. " + (caja.metodo === "Punto" ? "punto" : "pago") + ": " + ref : ""),
    total: g.monto,
    totalBs: r2(g.monto * tv),
  }));
  try {
    const b = db.batch(),
      guardados = [];
    docs.forEach((d) => {
      const r = db.collection("pagos").doc();
      b.set(r, { ...d, timestamp: firebase.firestore.FieldValue.serverTimestamp() });
      guardados.push({ ...d, id: r.id });
    });
    await b.commit();
    guardados.reverse().forEach((d) => pagos.unshift(d));
    // Deuda anterior (campo manual del estudiante): se descuenta igual que en el formulario de pagos
    const idx = estudiantes.findIndex((x) => x.id === e.id);
    if (idx >= 0) {
      const parte = docs
        .filter((d) => !cobCfgActiva() || d.concepto === "Deuda anterior")
        .reduce((s, d) => s + d.total, 0);
      const cur = estudiantes[idx];
      if (parte > 0 && cur.estado === "mora" && cur.moraMonto > 0) {
        const nueva = Math.max(0, r2(cur.moraMonto - parte));
        const upd = {
          moraMonto: nueva,
          estado: nueva <= 0 ? "alsaldo" : "mora",
          moraConcepto: nueva <= 0 ? "" : cur.moraConcepto,
        };
        await db.collection("estudiantes").doc(e.id).update(upd);
        estudiantes[idx] = { ...cur, ...upd };
      }
    }
    // Un solo recibo con todo lo cobrado
    const virtual = {
      ...docs[0],
      id: undefined,
      concepto: docs.map((d) => d.concepto).join(" + "),
      mes: docs.length === 1 ? docs[0].mes : "",
      descripcion:
        docs.map((d) => d.descripcion.split("\nRef.")[0]).join("\n") +
        (ref ? "\nRef. " + (caja.metodo === "Punto" ? "punto" : "pago") + ": " + ref : ""),
      total,
      totalBs: r2(total * tv),
    };
    cajaReset();
    modalActual = { tipo: "recibo", pago: virtual };
    render();
  } catch (ex) {
    caja.guardando = false;
    cajaActualizarTotal();
    alert(
      "No se pudo guardar el cobro: " + ex.message + "\nRevisa tu conexión y vuelve a intentarlo (no se cobró nada)."
    );
  }
}
// ---- Cierre de caja
function renderCajaCierre() {
  const f = caja.cierre || todayStr(),
    lista = pagos.filter((p) => p.fecha === f);
  const tm = totalesMetodo(lista),
    tot = totalesDual(lista.map((p) => ({ usd: p.total || 0, rec: p })));
  const filas = [
    ["Dólares Efectivo", "Efectivo $ contado", "usd"],
    ["Bs Efectivo", "Efectivo Bs contado", "bs"],
    ["Punto", "Total del punto (cierre de lote, Bs)", "bs"],
    ["Transferencia Bs", "Total en el banco por transf./pago móvil (Bs)", "bs"],
  ];
  return `
  <div style="display:flex;justify-content:space-between;align-items:center;gap:0.5rem;margin-bottom:0.6rem;flex-wrap:wrap">
    <div class="section-title" style="margin:0">🔒 Cierre de caja</div>
    <button class="btn btn-gray btn-sm" onclick="caja.vista='cobro';renderTabContent()">← Volver a cobrar</button></div>
  <div class="card" style="padding:0.9rem">
    <div class="field"><label class="field-label">Fecha</label><input class="inp" type="date" value="${f}" max="${todayStr()}" onchange="caja.cierre=this.value||todayStr();renderTabContent()"/></div>
    <div class="stats-grid" style="grid-template-columns:1fr 1fr;margin-top:0.6rem">
      <div class="stat-card green"><div class="stat-val">${fmt(tot.usd)}</div><div class="stat-label">Total cobrado (ref. $)</div></div>
      <div class="stat-card"><div class="stat-val">${lista.length}</div><div class="stat-label">Cobros${tot.sinTasa ? " · ⚠️ " + tot.sinTasa + " sin tasa" : ""}</div></div></div>
    <div class="field-label" style="margin-top:0.6rem">Cuadre: lo que debería haber vs. lo que cuentas</div>
    ${filas
      .map(([m, txt, tipo], i) => {
        const esp = tipo === "usd" ? tm[m].usd : tm[m].bs || 0;
        return `<div style="padding:0.6rem 0;border-bottom:1px dashed #eee">
        <div style="display:flex;justify-content:space-between;font-size:0.85rem"><strong>${ETIQ_METODO[m]}</strong><span>Debe haber: <strong>${tipo === "usd" ? fmt(esp) : fmtBs(esp)}</strong></span></div>
        <div style="display:flex;gap:0.5rem;align-items:center;margin-top:4px">
          <input class="inp" id="cj-c${i}" readonly inputmode="none" data-pad="monto" data-pad-label="${escHtml(txt)}" data-pad-unit="${tipo === "usd" ? "$" : "Bs."}" onclick="cajaPadAbrir(this)" onfocus="cajaPadAbrir(this)" autocomplete="off" placeholder="Toca para escribir lo contado" oninput="cajaCuadre()" style="flex:1;cursor:pointer"/>
          <div id="cj-d${i}" data-esp="${esp}" data-tipo="${tipo}" style="min-width:110px;text-align:right;font-weight:700;font-size:0.8rem;color:#888">—</div></div></div>`;
      })
      .join("")}
    <div style="display:flex;gap:0.5rem;margin-top:0.8rem"><button class="btn btn-primary" style="flex:1" onclick="imprimirCierreCaja()">🖨️ Imprimir cierre</button></div>
  </div>
  <div class="section-title" style="margin-top:1rem">Detalle del día (${lista.length})</div>
  ${
    lista.length
      ? lista
          .map((p) => {
            const b = bsDe(p, p.total);
            return `<div class="list-item"><div class="item-row"><div style="flex:1;min-width:0">
      <div class="item-name">${escHtml(p.nombre || "")}</div>
      <div class="item-sub">${escHtml(p.concepto || "")} · ${escHtml(ETIQ_METODO[p.metodo] || p.metodo || "")}${p.referencia ? " · ref " + escHtml(p.referencia) : ""}</div></div>
      <div style="text-align:right"><div style="font-weight:800;color:#1a9e5c">${fmt(p.total)}</div>${b.bs != null ? `<div style="font-size:0.68rem;color:#888">${fmtBs(b.bs)}</div>` : ""}</div></div></div>`;
          })
          .join("")
      : `<div style="text-align:center;color:#888;padding:1rem">No hay cobros en esta fecha</div>`
  }`;
}
// Diferencia entre lo que debe haber y lo que se contó
function cajaCuadre() {
  for (let i = 0; i < 4; i++) {
    const inp = document.getElementById("cj-c" + i),
      out = document.getElementById("cj-d" + i);
    if (!inp || !out) continue;
    if (!inp.value.trim()) {
      out.textContent = "—";
      out.style.color = "#888";
      continue;
    }
    const dif = r2(parseMontoCaja(inp.value) - Number(out.dataset.esp)),
      mon = out.dataset.tipo === "usd" ? fmt : fmtBs;
    if (Math.abs(dif) < 0.005) {
      out.textContent = "✅ Cuadra";
      out.style.color = "#1a9e5c";
    } else {
      out.textContent = (dif > 0 ? "Sobra " : "Falta ") + mon(Math.abs(dif));
      out.style.color = "#e53e3e";
    }
  }
}
function imprimirCierreCaja() {
  const f = caja.cierre || todayStr(),
    lista = pagos.filter((p) => p.fecha === f),
    tm = totalesMetodo(lista),
    tot = totalesDual(lista.map((p) => ({ usd: p.total || 0, rec: p })));
  const cont = (i) => {
    const el = document.getElementById("cj-c" + i);
    return el && el.value.trim() ? parseMontoCaja(el.value) : null;
  };
  const filas = [
    ["Dólares Efectivo", "usd"],
    ["Bs Efectivo", "bs"],
    ["Punto", "bs"],
    ["Transferencia Bs", "bs"],
  ]
    .map(([m, t], i) => {
      const esp = t === "usd" ? tm[m].usd : tm[m].bs || 0,
        c = cont(i),
        mon = t === "usd" ? fmt : fmtBs;
      return `<tr><td>${escHtml(ETIQ_METODO[m])}</td><td align="right">${mon(esp)}</td><td align="right">${c == null ? "—" : mon(c)}</td><td align="right">${c == null ? "—" : Math.abs(r2(c - esp)) < 0.005 ? "Cuadra" : (c > esp ? "Sobra " : "Falta ") + mon(Math.abs(r2(c - esp)))}</td></tr>`;
    })
    .join("");
  const w = window.open("", "_blank", "width=700,height=900");
  if (!w) {
    alert("Permite las ventanas emergentes para imprimir");
    return;
  }
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>Cierre de caja ${f}</title><style>
    body{font-family:'Segoe UI',sans-serif;padding:1.5rem;max-width:720px;margin:0 auto;color:#222}h2{color:#003366;margin-bottom:2px}
    table{width:100%;border-collapse:collapse;margin:0.6rem 0;font-size:0.82rem}th{background:#003366;color:#fff;padding:6px;text-align:left}td{padding:5px 6px;border-bottom:1px solid #eee}
    .firmas{display:flex;justify-content:space-between;margin-top:3rem}.firmas div{width:45%;text-align:center;border-top:1px solid #333;padding-top:4px;font-size:0.75rem}</style></head><body>
    <h2>${escHtml(EMPRESA)}</h2><div style="font-size:0.8rem;color:#666">Cierre de caja · ${fechaCorta(f)} · ${lista.length} cobros</div>
    <p style="margin:0.6rem 0"><strong>Total cobrado:</strong> ${fmt(tot.usd)}${tot.bs ? " · " + fmtBs(tot.bs) : ""}</p>
    <table><tr><th>Método</th><th align="right">Debe haber</th><th align="right">Contado</th><th align="right">Diferencia</th></tr>${filas}</table>
    <table><tr><th>Estudiante</th><th>Concepto</th><th>Método</th><th>Ref.</th><th align="right">$</th><th align="right">Bs.</th></tr>
    ${lista
      .map((p) => {
        const b = bsDe(p, p.total);
        return `<tr><td>${escHtml(p.nombre || "")}</td><td>${escHtml(p.concepto || "")}</td><td>${escHtml(ETIQ_METODO[p.metodo] || p.metodo || "")}</td><td>${escHtml(p.referencia || "")}</td><td align="right">${fmt(p.total)}</td><td align="right">${b.bs != null ? fmtBs(b.bs) : ""}</td></tr>`;
      })
      .join("")}</table>
    <div class="firmas"><div>Cajera</div><div>Director(a)</div></div>
    <script>window.onload=function(){window.print();}<\/script></body></html>`);
  w.document.close();
}
