// Año escolar: ver años anteriores (solo consulta), respaldo, cierre de año e inicio del siguiente.

const soloLectura = () => !!(escCfg && anioVista && anioVista !== escCfg.actual.id);
const anioVistaObj = () => {
  if (!escCfg) return null;
  if (!anioVista || anioVista === escCfg.actual.id) return escCfg.actual;
  return escCfg.anteriores.find((a) => a.id === anioVista) || escCfg.actual;
};
const idAnio = (n) =>
  String(n || "")
    .trim()
    .replace(/[^A-Za-z0-9-]/g, "-");
function sugerirSiguiente(n) {
  const m = String(n || "").match(/^(\d{4})\s*-\s*(\d{4})$/);
  return m ? +m[1] + 1 + "-" + (+m[2] + 1) : "";
}
async function cargarAnioEsc() {
  escCfg = null;
  try {
    const s = await db.collection("config").doc("anioEscolar").get();
    if (s.exists && s.data().actual) {
      const d = s.data();
      escCfg = {
        actual: d.actual,
        anteriores: d.anteriores || [],
        pendienteLimpieza: !!d.pendienteLimpieza,
        limpieza: d.limpieza || null,
      };
    }
  } catch (e) {
    console.warn("anioEscolar:", e.message);
  }
  if (!escCfg) anioVista = null;
  else if (!anioVista || (anioVista !== escCfg.actual.id && !escCfg.anteriores.some((a) => a.id === anioVista)))
    anioVista = escCfg.actual.id;
}
function cambiarAnioVista(id) {
  anioVista = id;
  cargarTodo();
}
function descargarRespaldo(etq) {
  const data = { generado: new Date().toISOString(), anioVista, estudiantes, pagos, finanzas, trabajadores, notas };
  const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "respaldo-" + (etq || "pagos-uep") + "-" + hoyLocal() + ".json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
function resumenAnio(pagosA, finA, ests, deudores) {
  const cobrado = pagosA.reduce((s, p) => s + (p.total || 0), 0);
  const ingExtra = finA.filter((f) => f.tipo === "ingreso").reduce((s, f) => s + (f.monto || 0), 0);
  const gastos = finA.filter((f) => f.tipo === "gasto").reduce((s, f) => s + (f.monto || 0), 0);
  return {
    pagos: pagosA.length,
    cobrado,
    ingresosExtra: ingExtra,
    gastos,
    balance: cobrado + ingExtra - gastos,
    estudiantesActivos: ests.filter(activo).length,
    retirados: ests.filter((e) => e.estado === "retirado").length,
    enMora: deudores.length,
    deudaTotal: deudores.reduce((s, d) => s + (d.monto || 0), 0),
  };
}
function eaMsg(t, ok) {
  const b = document.getElementById("ea-err");
  if (b) b.innerHTML = t ? `<div class="${ok ? "alert-item alert-info" : "error-msg"}">${t}</div>` : "";
}
async function iniciarNuevoAnio() {
  if (rolUsuario !== "director") {
    alert("Solo el director puede cerrar el año escolar");
    return;
  }
  if (soloLectura()) {
    alert("Estás viendo un año anterior. Vuelve al año actual para cerrarlo.");
    return;
  }
  const g = (id) => {
    const el = document.getElementById(id);
    return el ? el.value.trim() : "";
  };
  const viejoNombre = escCfg ? escCfg.actual.nombre : g("ea-old-nombre");
  const viejoInicio = escCfg ? escCfg.actual.inicio : g("ea-old-inicio");
  const nuevoNombre = g("ea-new-nombre"),
    nuevoInicio = g("ea-new-inicio");
  const arrastrar = document.getElementById("ea-arrastrar").checked,
    archivarNotas = document.getElementById("ea-notas").checked;
  const hoy = hoyLocal();
  if (!viejoNombre || !nuevoNombre) {
    eaMsg("Escribe el nombre del año que se cierra y del nuevo (ej: 2026-2027)");
    return;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(nuevoInicio)) {
    eaMsg("Elige la fecha de inicio del nuevo año");
    return;
  }
  if (nuevoInicio > hoy) {
    eaMsg("La fecha de inicio no puede ser futura");
    return;
  }
  if (
    idAnio(nuevoNombre) === idAnio(viejoNombre) ||
    (escCfg && escCfg.anteriores.some((a) => a.id === idAnio(nuevoNombre)))
  ) {
    eaMsg("Ya existe un año con ese nombre. Usa otro (ej: 2026-2027)");
    return;
  }
  const nCuotas = parseInt(g("ea-cuotas"), 10) || (cobCfg ? cobCfg.cuotas : 10),
    diaVence = parseInt(g("ea-dia"), 10) || (cobCfg ? cobCfg.diaVence : 5);
  if (!(nCuotas >= 1 && nCuotas <= 24) || !(diaVence >= 1 && diaVence <= 28)) {
    eaMsg("Revisa las cuotas: entre 1 y 24 cuotas y vencimiento entre el día 1 y 28");
    return;
  }
  if (viejoInicio && nuevoInicio <= viejoInicio) {
    eaMsg("El nuevo año debe empezar después del inicio del año que se cierra (" + fechaCorta(viejoInicio) + ")");
    return;
  }

  const enRango = (x) => x.fecha && x.fecha < nuevoInicio && (!viejoInicio || x.fecha >= viejoInicio);
  const deudores = estudiantes
    .filter((e) => e.estado !== "retirado" && (deudaDe(e) > 0 || (e.estado === "mora" && e.moraConcepto)))
    .map((e) => ({
      id: e.id,
      nombre: e.nombre || "",
      grado: e.grado || "",
      acudiente: e.acudiente || "",
      tel: e.telefonoAcudiente || e.telefono || "",
      monto: deudaDe(e),
      concepto: conceptoDeE(e),
    }));
  const resumen = resumenAnio(pagos.filter(enRango), finanzas.filter(enRango), estudiantes, deudores);
  const nNotas = Object.keys(notas).length;
  const msg =
    `Vas a cerrar el año ${viejoNombre} e iniciar ${nuevoNombre} (desde ${fechaCorta(nuevoInicio)}).\n\n` +
    `• Todos los pagos, gastos y nómina del año que cierra se conservan en el historial.\n` +
    `• Los ${resumen.estudiantesActivos} estudiantes activos se mantienen.\n` +
    (arrastrar
      ? `• Las ${deudores.length} deudas pendientes (${fmtUSD(resumen.deudaTotal)}) pasan al año nuevo.\n`
      : `• Las ${deudores.length} deudas pendientes (${fmtUSD(resumen.deudaTotal)}) quedan guardadas en el historial y el saldo de cada estudiante vuelve a cero.\n`) +
    (archivarNotas ? `• Se archivan las notas (${nNotas} registros) y el año empieza sin notas.\n` : "") +
    `\nSe descargará un respaldo antes de empezar. ¿Continuar?`;
  if (!confirm(msg)) return;

  let fase = "respaldo";
  try {
    eaMsg("⏳ 1/4 Descargando respaldo...", true);
    descargarRespaldo("antes-de-cerrar-" + idAnio(viejoNombre));
    fase = "archivo";
    if (archivarNotas && nNotas) {
      eaMsg("⏳ 2/4 Archivando notas...", true);
      const snap = await db.collection("notas").get();
      for (let i = 0; i < snap.docs.length; i += 400) {
        const b = db.batch();
        snap.docs.slice(i, i + 400).forEach((d) =>
          b.set(db.collection("notas_historial").doc(idAnio(viejoNombre) + "__" + d.id), {
            ...d.data(),
            clave: d.id,
            anioArchivo: idAnio(viejoNombre),
          })
        );
        await b.commit();
      }
    }
    fase = "config";
    eaMsg("⏳ 3/4 Creando el año nuevo...", true);
    const cfg = {
      actual: { id: idAnio(nuevoNombre), nombre: nuevoNombre, inicio: nuevoInicio },
      anteriores: [
        ...(escCfg ? escCfg.anteriores : []),
        {
          id: idAnio(viejoNombre),
          nombre: viejoNombre,
          inicio: viejoInicio || "",
          fin: diaAnterior(nuevoInicio),
          cerradoEn: hoy,
          resumen,
          deudas: deudores,
          notasArchivadas: archivarNotas ? nNotas : 0,
        },
      ],
      pendienteLimpieza: true,
      limpieza: {
        arrastrar,
        archivarNotas,
        nombreViejo: viejoNombre,
        nombreNuevo: nuevoNombre,
        corte: Date.now(),
        arrastres: Object.fromEntries(
          deudores
            .filter((d) => d.monto > 0)
            .map((d) => [
              d.id,
              { monto: d.monto, concepto: (d.concepto ? d.concepto + " · " : "") + "Arrastrado de " + viejoNombre },
            ])
        ),
      },
    };
    await db.collection("config").doc("anioEscolar").set(cfg);
    await db.collection("config").doc("institucion").set({ anioEscolar: nuevoNombre }, { merge: true });
    const nuevaCob = {
      primerMes: nuevoInicio.slice(0, 7),
      cuotas: nCuotas,
      diaVence,
      recargo: cobCfg ? cobCfg.recargo || 0 : 0,
      recargoDesde: "",
    };
    await db.collection("config").doc("cobranza").set(nuevaCob);
    cobCfg = nuevaCob;
    escCfg = { actual: cfg.actual, anteriores: cfg.anteriores, pendienteLimpieza: true, limpieza: cfg.limpieza };
    anioVista = cfg.actual.id;
    fase = "limpieza";
    eaMsg("⏳ 4/4 Reiniciando estudiantes y notas...", true);
    await completarLimpieza();
    alert(
      "✅ Listo. Ya estás en el año escolar " +
        nuevoNombre +
        ". El año " +
        viejoNombre +
        " quedó en el historial.\n\nSiguiente paso: en esta misma pantalla, más abajo, pasa a los estudiantes de grado."
    );
    cargarTodo();
  } catch (e) {
    const permiso = /permission|insufficient/i.test(e.message || "");
    eaMsg(
      "❌ Falló en el paso «" +
        fase +
        "»: " +
        escHtml(e.message) +
        (permiso
          ? "<br>Parece un tema de permisos de Firestore (colecciones <b>notas_historial</b> o <b>config</b>). Revisa las reglas de Firestore."
          : fase === "limpieza"
            ? "<br>El año nuevo ya se creó. Recarga la página y pulsa «Completar reinicio» en Config → Año escolar."
            : "<br>No se cambió nada en los datos. Puedes intentarlo de nuevo.")
    );
  }
}
// Reinicio de estudiantes y notas del año cerrado (se puede repetir sin riesgo)
async function completarLimpieza() {
  const L = escCfg && escCfg.limpieza;
  if (!L) return;
  if (L.archivarNotas) {
    const snap = await db.collection("notas").get();
    // solo se borran las notas anteriores al cierre (nunca las que se escriban en el año nuevo)
    const viejas = snap.docs.filter((d) => {
      const u = d.data().updatedAt;
      const ms = u && u.toMillis ? u.toMillis() : 0;
      return ms <= L.corte;
    });
    for (let i = 0; i < viejas.length; i += 400) {
      const b = db.batch();
      viejas.slice(i, i + 400).forEach((d) => b.delete(d.ref));
      await b.commit();
    }
  }
  const snapE = await db.collection("estudiantes").get();
  const activos = snapE.docs.filter((d) => d.data().estado !== "retirado");
  for (let i = 0; i < activos.length; i += 400) {
    const b = db.batch();
    activos.slice(i, i + 400).forEach((d) => {
      const e = d.data();
      const upd = {
        ...(e.graduado ? {} : { anioEscolar: L.nombreNuevo }),
        ultimoRecordatorio: firebase.firestore.FieldValue.delete(),
        totalRecordatorios: firebase.firestore.FieldValue.delete(),
      };
      const ar = (L.arrastres || {})[d.id];
      if (!L.arrastrar) {
        upd.estado = "alsaldo";
        upd.moraMonto = 0;
        upd.moraConcepto = "";
      } else if (ar && ar.monto > 0) {
        upd.estado = "mora";
        upd.moraMonto = ar.monto;
        upd.moraConcepto = ar.concepto;
      } else if (e.estado === "mora" && !/arrastrad/i.test(e.moraConcepto || ""))
        upd.moraConcepto = (e.moraConcepto ? e.moraConcepto + " · " : "") + "Arrastrado de " + L.nombreViejo;
      b.update(d.ref, upd);
    });
    await b.commit();
  }
  await db
    .collection("config")
    .doc("anioEscolar")
    .update({ pendienteLimpieza: false, limpieza: firebase.firestore.FieldValue.delete() });
  escCfg.pendienteLimpieza = false;
  escCfg.limpieza = null;
}
async function reintentarLimpieza() {
  try {
    await completarLimpieza();
    alert("✅ Reinicio completado");
    cargarTodo();
  } catch (e) {
    alert("Error: " + e.message);
  }
}
function renderConfigAnio() {
  const hoy = hoyLocal();
  const nombreAct = escCfg ? escCfg.actual.nombre : configInst.anioEscolar || "";
  const activos = estudiantes.filter(activo).length;
  const hist = escCfg ? escCfg.anteriores.slice().reverse() : [];
  return `
  ${escCfg && escCfg.pendienteLimpieza ? `<div class="mora-box"><strong>⚠️ El cambio de año quedó a medias.</strong><div style="font-size:0.78rem;margin:4px 0 8px">El año nuevo se creó pero no terminó el reinicio de estudiantes y notas.</div><button class="btn btn-danger btn-sm" onclick="reintentarLimpieza()">Completar reinicio</button></div>` : ""}
  <div class="info-row"><span>Año escolar actual</span><strong>${escHtml(nombreAct) || "Sin definir"}</strong></div>
  ${
    escCfg
      ? `<div class="info-row"><span>Inició el</span><strong>${fechaCorta(escCfg.actual.inicio)}</strong></div>`
      : `<div class="info-row"><span>Estado</span><span style="font-size:0.75rem;color:#888;text-align:right">Aún no se separa por años:<br>todo el historial aparece junto</span></div>`
  }
  <div class="info-row"><span>Estudiantes activos</span><strong>${activos}</strong></div>
  <hr class="divider"/>
  <div class="section-title">Iniciar nuevo año escolar</div>
  <div style="font-size:0.78rem;color:#555;margin-bottom:0.75rem;line-height:1.45">
    Los pagos, gastos y nómina del año actual quedan guardados en el historial. Los estudiantes se mantienen, pero el año nuevo arranca en cero: sin pagos, sin deudas y (si lo dejas marcado) sin notas.
  </div>
  <div class="form-grid">
    ${
      escCfg
        ? ""
        : `<div class="form-row">
      <div class="field"><label class="field-label">Año que se cierra</label><input class="inp" id="ea-old-nombre" value="${escHtml(nombreAct) || "2025-2026"}"/></div>
      <div class="field"><label class="field-label">Inició el (opcional)</label><input class="inp" type="date" id="ea-old-inicio"/></div>
    </div>`
    }
    <div class="form-row">
      <div class="field"><label class="field-label">Nuevo año escolar</label><input class="inp" id="ea-new-nombre" value="${sugerirSiguiente(nombreAct)}" placeholder="2026-2027"/></div>
      <div class="field"><label class="field-label">Fecha de inicio</label><input class="inp" type="date" id="ea-new-inicio" value="${hoy.slice(0, 8) + "01"}" max="${hoy}"/></div>
    </div>
    <div style="font-size:0.7rem;color:#888;margin-top:-4px">Los pagos y gastos desde esta fecha cuentan para el año nuevo; los anteriores quedan en el historial.</div>
    <div class="form-row">
      <div class="field"><label class="field-label">N° de cuotas del año nuevo</label><input class="inp" type="number" min="1" max="24" id="ea-cuotas" value="${cobCfg ? cobCfg.cuotas : 10}"/></div>
      <div class="field"><label class="field-label">Vencen el día</label><input class="inp" type="number" min="1" max="28" id="ea-dia" value="${cobCfg ? cobCfg.diaVence : 5}"/></div>
    </div>
    <div style="font-size:0.7rem;color:#888;margin-top:-4px">La primera cuota será la del mes de inicio. Cada cuota es la mensualidad de cada estudiante (mora automática).</div>
    <label style="display:flex;gap:0.5rem;align-items:flex-start;font-size:0.82rem;color:#333"><input type="checkbox" id="ea-notas" checked style="margin-top:3px"/> <span>Archivar las notas del año y empezar sin notas</span></label>
    <label style="display:flex;gap:0.5rem;align-items:flex-start;font-size:0.82rem;color:#333"><input type="checkbox" id="ea-arrastrar" style="margin-top:3px"/> <span>Arrastrar al año nuevo las deudas pendientes <span style="color:#888">(si no, quedan en el historial y el saldo vuelve a cero)</span></span></label>
    <div id="ea-err"></div>
    <button class="btn btn-primary" onclick="iniciarNuevoAnio()">📅 Cerrar año e iniciar el nuevo</button>
    <button class="btn btn-gray btn-sm" onclick="descargarRespaldo()">💾 Descargar respaldo ahora</button>
  </div>
  ${renderPromocion()}
  ${
    hist.length
      ? `<hr class="divider"/><div class="section-title">Historial de años</div>
  ${hist
    .map((a) => {
      const r = a.resumen || {};
      return `<details class="card" style="padding:0.75rem;margin-bottom:0.5rem">
    <summary style="cursor:pointer;font-weight:700;color:#003366">📚 ${escHtml(a.nombre)} <span style="font-weight:400;font-size:0.72rem;color:#888">(${a.inicio ? fechaCorta(a.inicio) : "…"} – ${fechaCorta(a.fin)})</span></summary>
    <div style="margin-top:0.6rem">
      <div class="info-row"><span>Pagos registrados</span><strong>${r.pagos || 0}</strong></div>
      <div class="info-row"><span>Total cobrado</span><strong style="color:#1a9e5c">${fmtUSD(r.cobrado)}</strong></div>
      <div class="info-row"><span>Otros ingresos</span><strong>${fmtUSD(r.ingresosExtra)}</strong></div>
      <div class="info-row"><span>Gastos</span><strong style="color:#e53e3e">${fmtUSD(r.gastos)}</strong></div>
      <div class="info-row"><span>Balance</span><strong>${fmtUSD(r.balance)}</strong></div>
      <div class="info-row"><span>Estudiantes activos al cierre</span><strong>${r.estudiantesActivos || 0}</strong></div>
      <div class="info-row"><span>Deudas pendientes al cierre</span><strong style="color:#e53e3e">${r.enMora || 0} · ${fmtUSD(r.deudaTotal)}</strong></div>
      ${
        (a.deudas || []).length
          ? `<div class="section-title" style="margin-top:0.6rem">Quiénes debían</div>
      ${a.deudas.map((d) => `<div class="info-row"><span>${escHtml(d.nombre)}${d.grado ? " · " + escHtml(d.grado) : ""}<div style="font-size:0.7rem;color:#888">${escHtml(d.concepto) || ""}</div></span><strong>${fmtUSD(d.monto)}</strong></div>`).join("")}`
          : ""
      }
      <button class="btn btn-gray btn-sm" style="margin-top:0.6rem" onclick="cambiarAnioVista('${a.id}')">👁 Ver todos los datos de este año</button>
    </div></details>`;
    })
    .join("")}`
      : ""
  }`;
}
