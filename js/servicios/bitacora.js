// Auditoría: quién hizo cada movimiento de dinero.
// · Cada pago y cada ingreso o gasto guarda quién lo registró (registradoPor: su correo).
// · Al borrar un pago, un ingreso o gasto, o un estudiante, queda una copia en la «bitacora» con quién lo borró y
//   cuándo. Se escribe en el mismo lote que el borrado (o se hacen las dos cosas o ninguna), y las reglas de Firestore
//   no dejan borrar esos documentos sin su anotación. La bitácora solo la lee el director y nadie la puede cambiar.

const COLECCIONES_CON_BITACORA = ["pagos", "finanzas", "estudiantes"];

// Correo de quien está usando la app (en minúsculas, como lo compara Firestore)
const correoUsuario = () => ((fbAuth.currentUser && fbAuth.currentUser.email) || "").toLowerCase();

// Nombre para mostrar de un correo: el rol si es director o administradora; si no, el propio correo
function nombreUsuario(correo) {
  if (!correo) return "";
  const rol = ROLES[correo];
  return rol ? rol.charAt(0).toUpperCase() + rol.slice(1) : correo;
}

// Lo que se ve en la lista de la bitácora para cada tipo de documento
function resumenBorrado(col, d) {
  d = d || {};
  if (col === "pagos")
    return `Recibo ${d.factura || "—"} · ${d.nombre || ""} · ${fmt(d.total || 0)} · ${d.concepto || d.mes || ""}`;
  if (col === "finanzas")
    return `${d.tipo === "ingreso" ? "Ingreso" : "Gasto"} · ${d.descripcion || d.concepto || ""} · ${fmt(d.monto || 0)}`;
  return `Estudiante ${d.nombre || ""}${d.grado ? " (" + d.grado + ")" : ""}`;
}

// Anota en la bitácora el borrado de un documento. `escritor` es el lote (batch) o la transacción que hace el borrado.
function anotarBorrado(escritor, col, id, datos, motivo = "") {
  const { id: _id, ...copia } = datos || {};
  escritor.set(db.collection("bitacora").doc(col + "_" + id), {
    accion: "borrar",
    coleccion: col,
    docId: id,
    resumen: resumenBorrado(col, datos),
    datos: copia,
    motivo,
    fecha: todayStr(),
    por: correoUsuario(),
    cuando: firebase.firestore.FieldValue.serverTimestamp(),
  });
}

// Borra un documento dejando su anotación en la bitácora, en un solo lote
async function borrarConBitacora(col, id, datos, motivo = "") {
  const lote = db.batch();
  anotarBorrado(lote, col, id, datos, motivo);
  lote.delete(db.collection(col).doc(id));
  await lote.commit();
}

// ---- Vista del director: ⚙️ Configuración → 🕵️ Bitácora
let bitacoraLista = null; // se carga al abrir la sección
async function cargarBitacora() {
  try {
    const s = await db.collection("bitacora").orderBy("cuando", "desc").limit(200).get();
    bitacoraLista = s.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (e) {
    bitacoraLista = [];
    console.warn("Bitácora:", e.message);
  }
  if (tabActual === "config" && subTab.config === "bitacora") renderTabContent();
}
function renderConfigBitacora() {
  if (bitacoraLista === null) {
    cargarBitacora();
    return `<div class="loading" style="padding:1rem">Cargando bitácora...</div>`;
  }
  const iconos = { pagos: "🧾", finanzas: "📒", estudiantes: "👨‍🎓" };
  return `<div style="font-size:0.78rem;color:#555;margin:0.5rem 0">Lo que se ha borrado (pagos, ingresos y gastos, estudiantes), quién lo borró y cuándo. Nadie puede cambiar ni borrar esta lista.</div>
    <button class="btn btn-gray btn-sm" onclick="bitacoraLista=null;renderTabContent()">🔄 Actualizar</button>
    ${
      bitacoraLista.length
        ? bitacoraLista
            .map(
              (b) => `<div class="item-row" style="align-items:flex-start">
        <div style="font-size:1.2rem">${iconos[b.coleccion] || "🗑️"}</div>
        <div style="flex:1;min-width:0">
          <div class="item-name">${escHtml(b.resumen)}</div>
          <div class="item-sub">Borrado por <strong>${escHtml(nombreUsuario(b.por))}</strong> · ${escHtml(fechaCorta(b.fecha || ""))}${b.datos && b.datos.registradoPor ? " · lo había registrado " + escHtml(nombreUsuario(b.datos.registradoPor)) : ""}${b.motivo ? " · " + escHtml(b.motivo) : ""}</div>
        </div></div>`
            )
            .join("")
        : `<div style="color:#888;font-size:0.82rem;padding:1rem 0">No se ha borrado nada todavía.</div>`
    }`;
}
