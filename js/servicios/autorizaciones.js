// 🔐 Autorización del día: la administradora (secretaria) y control de estudio, al entrar, esperan a que el director
// los autorice. La autorización vale hasta la medianoche; el director la puede quitar cuando quiera.
// autorizaciones/<uid> = {correo, nombre, rol, pide: "AAAA-MM-DD", pideHora, hasta: ms, por, autorizadoHora}
// Las reglas de Firestore no les dejan leer ni escribir nada más mientras «hasta» no esté en el futuro: esto no es
// solo una pantalla, la base de datos misma espera.

const necesitaAutorizacion = (r) =>
  r.rol === "administradora" || (r.rol === "docente" && !!(r.perfil && r.perfil.controlEstudio));
// Medianoche de hoy en este equipo (Venezuela), en milisegundos
const medianoche = () => {
  const d = new Date();
  d.setHours(24, 0, 0, 0);
  return d.getTime();
};
const horaAhora = () => new Date().toLocaleTimeString("es-VE", { hour: "2-digit", minute: "2-digit" });
const vigente = (a) => !!a && Number(a.hasta) > Date.now();

// ---- Quien pide (secretaria o control de estudio) ----
let _espera = null; // {r, dejar, fin} mientras espera o mientras trabaja con la autorización del día
function esperarAutorizacion(r) {
  const user = fbAuth.currentUser;
  if (!user || _espera) return;
  const ref = db.collection("autorizaciones").doc(user.uid);
  _espera = { r, dejar: null, fin: null, pedido: false };
  render();
  _espera.dejar = ref.onSnapshot(
    (snap) => {
      if (!_espera) return;
      const a = snap.exists ? snap.data() : null;
      if (vigente(a)) {
        if (!auth) {
          abrirSesion(_espera.r);
          clearTimeout(_espera.fin);
          // a medianoche se acaba: vuelve a pedir
          // (setTimeout no acepta más de ~24 días: con más, se dispararía al instante)
          const falta = Math.min(a.hasta - Date.now(), 2147483647);
          _espera.fin = setTimeout(() => terminarAutorizacion("La autorización de hoy terminó."), falta);
        }
        return;
      }
      if (auth) return terminarAutorizacion("El director quitó el acceso.");
      if (!_espera.pedido && (!a || a.pide !== todayStr())) {
        _espera.pedido = true;
        ref
          .set(
            {
              correo: correoUsuario(),
              nombre: (r.perfil && r.perfil.nombre) || nombreUsuario(correoUsuario()),
              rol: r.perfil && r.perfil.controlEstudio ? "control" : r.rol,
              pide: todayStr(),
              pideHora: horaAhora(),
            },
            { merge: true }
          )
          .catch((e) => console.warn("No se pudo pedir la autorización:", e.message));
      }
    },
    (e) => console.warn("autorización:", e.message)
  );
}
function detenerEspera() {
  if (!_espera) return;
  if (_espera.dejar) _espera.dejar();
  clearTimeout(_espera.fin);
  _espera = null;
}
async function terminarAutorizacion(motivo) {
  try {
    sessionStorage.setItem("salidaSinAutorizacion", motivo);
  } catch (e) {}
  await logout({ inactividad: true, sinAutorizacion: true });
}
function renderEsperaAutorizacion() {
  const nombre = (_espera && _espera.r.perfil && _espera.r.perfil.nombre) || correoUsuario();
  return `<div class="login-wrap"><div class="login-card espera-autorizacion" style="text-align:center">
    <div class="login-logo" style="justify-content:center"><img src="data:image/png;base64,${LOGO}" alt="Logo"/><div><h1>${EMPRESA}</h1></div></div>
    <div style="font-size:2.4rem;margin:0.6rem 0">⏳</div>
    <h2 style="color:#003366;font-size:1.05rem;margin:0 0 0.4rem">Esperando la autorización del director</h2>
    <p style="font-size:0.85rem;color:#555;margin:0 0 0.6rem">Hola, <strong>${escHtml(nombre)}</strong>. Ya se le avisó al director: cuando te autorice, la plataforma se abre sola. No cierres esta ventana.</p>
    <p style="font-size:0.72rem;color:#888;margin:0 0 0.9rem">La autorización vale para todo el día de hoy.</p>
    <button class="btn btn-gray btn-full" onclick="logout()">Salir</button>
  </div></div>`;
}
// En la pantalla de entrada, por qué se cerró la sesión (la autorización venció o se quitó)
function avisoSalidaAutorizacion() {
  let m = "";
  try {
    m = sessionStorage.getItem("salidaSinAutorizacion") || "";
  } catch (e) {}
  return m
    ? `<div class="alert-item alert-info" style="margin-top:0.6rem;font-size:0.78rem">🔐 ${escHtml(m)} Para seguir, vuelve a entrar y espera la autorización.</div>`
    : "";
}

// ---- El director: pedidos al instante, autorizar hoy y quitar el acceso ----
let autorizaciones = []; // [{id, ...datos}]
let _escuchaAut = null,
  _avisados = new Set();
function escucharAutorizaciones() {
  if (rolUsuario !== "director" || _escuchaAut) return;
  _escuchaAut = db.collection("autorizaciones").onSnapshot(
    (snap) => {
      autorizaciones = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      pintarPedidosAutorizacion();
      // Solo se redibuja la tarjeta (no la pestaña entera: no se pierde lo que el director esté escribiendo)
      const tarjeta = document.getElementById("accesos-hoy");
      if (tarjeta) tarjeta.outerHTML = htmlAccesosHoy();
    },
    (e) => console.warn("autorizaciones:", e.message)
  );
}
function dejarDeEscucharAutorizaciones() {
  if (_escuchaAut) _escuchaAut();
  _escuchaAut = null;
  autorizaciones = [];
  _avisados = new Set();
  const caja = document.getElementById("pedidos-autorizacion");
  if (caja) caja.remove();
}
const pendientesAutorizacion = () => autorizaciones.filter((a) => a.pide === todayStr() && !vigente(a));
const nombreRolAut = (rol) =>
  rol === "control" ? "control de estudio" : rol === "administradora" ? "secretaria" : rol;
// Aviso flotante (en cualquier pestaña) con los que esperan, y una notificación del sistema si está permitida
function pintarPedidosAutorizacion() {
  const pend = pendientesAutorizacion();
  let caja = document.getElementById("pedidos-autorizacion");
  if (!pend.length) {
    if (caja) caja.remove();
    return;
  }
  if (!caja) {
    caja = document.createElement("div");
    caja.id = "pedidos-autorizacion";
    caja.className = "pedidos-autorizacion";
    document.body.appendChild(caja);
  }
  caja.innerHTML = pend
    .map(
      (
        a
      ) => `<div class="pedido-aut">🔔 <strong>${escHtml(a.nombre || a.correo || "")}</strong> (${escHtml(nombreRolAut(a.rol))}) pide entrar · ${escHtml(a.pideHora || "")}
      <button class="btn btn-success btn-sm" onclick="autorizarHoy('${escJs(a.id)}')">✅ Autorizar hoy</button></div>`
    )
    .join("");
  pend
    .filter((a) => !_avisados.has(a.id + a.pide + (a.pideHora || "")))
    .forEach((a) => {
      _avisados.add(a.id + a.pide + (a.pideHora || ""));
      notificarPedido(a);
    });
}
function notificarPedido(a) {
  try {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    const titulo = "🔔 " + (a.nombre || a.correo) + " pide entrar";
    const op = { body: "Toca para abrir la plataforma y autorizarla.", tag: "autorizacion-" + a.id };
    if (navigator.serviceWorker && navigator.serviceWorker.ready)
      navigator.serviceWorker.ready.then((reg) => reg.showNotification(titulo, op)).catch(() => {});
    else new Notification(titulo, op);
  } catch (e) {}
}
async function autorizarHoy(uid, datos) {
  if (rolUsuario !== "director") return;
  try {
    await db
      .collection("autorizaciones")
      .doc(uid)
      .set(
        { ...(datos || {}), hasta: medianoche(), por: correoUsuario(), autorizadoHora: horaAhora() },
        { merge: true }
      );
    mostrarToast("✅ Autorizado hasta la medianoche");
  } catch (e) {
    alert("No se pudo autorizar: " + e.message);
  }
}
// También borra su pedido de hoy: si vuelve a entrar, pide de nuevo (y el aviso no reaparece solo)
async function quitarAcceso(uid) {
  if (rolUsuario !== "director") return;
  if (!confirm("¿Quitarle el acceso ahora? Si está usando la plataforma, se le cierra.")) return;
  try {
    await db
      .collection("autorizaciones")
      .doc(uid)
      .set({ hasta: 0, pide: "", por: correoUsuario(), quitadoHora: horaAhora() }, { merge: true });
    mostrarToast("🔒 Acceso quitado");
  } catch (e) {
    alert("No se pudo quitar el acceso: " + e.message);
  }
}
// ⚙️ Config → Docentes: quién entra con autorización y cómo está hoy
function htmlAccesosHoy() {
  const porId = new Map(autorizaciones.map((a) => [a.id, a]));
  const control = (configDocentes || []).filter((d) => d.controlEstudio && d.activo !== false);
  const filas = [
    ...autorizaciones.filter((a) => a.rol === "administradora"),
    ...control.map((d) => ({
      ...(porId.get(d.id) || {}),
      id: d.id,
      nombre: d.nombre,
      correo: d.correo,
      rol: "control",
    })),
  ];
  const estado = (a) =>
    vigente(a)
      ? `<span class="badge badge-green">✅ Autorizada hoy${a.autorizadoHora ? " · " + escHtml(a.autorizadoHora) : ""}</span>`
      : a.pide === todayStr()
        ? `<span class="badge badge-gold">⏳ Esperando${a.pideHora ? " desde " + escHtml(a.pideHora) : ""}</span>`
        : `<span class="badge badge-gray">Sin autorizar hoy</span>`;
  return `<div class="card accesos-hoy" id="accesos-hoy" style="padding:0.75rem;margin-bottom:0.75rem">
    <div class="section-title" style="margin-top:0">🔐 Accesos de hoy</div>
    <div class="ayuda" style="margin-bottom:0.5rem">La secretaria y control de estudio esperan tu autorización al entrar; vale hasta la medianoche. Puedes autorizarlas antes de que lleguen, o quitarles el acceso en cualquier momento. ${!filas.some((a) => a.rol === "administradora") ? "La secretaria aparecerá aquí la primera vez que pida entrar." : ""}</div>
    ${
      filas
        .map(
          (
            a
          ) => `<div class="info-row" style="flex-wrap:wrap;gap:0.4rem"><span><strong>${escHtml(a.nombre || a.correo || "")}</strong> <span style="color:#888">· ${escHtml(nombreRolAut(a.rol))}</span></span>
      <span style="display:flex;gap:0.4rem;align-items:center;flex-wrap:wrap">${estado(a)}
        ${vigente(a) ? `<button class="btn btn-gray btn-sm" onclick="quitarAcceso('${escJs(a.id)}')">🔒 Quitar acceso</button>` : `<button class="btn btn-success btn-sm" onclick="autorizarHoy('${escJs(a.id)}', ${escHtml(JSON.stringify({ nombre: a.nombre || "", correo: a.correo || "", rol: a.rol }))})">✅ Autorizar hoy</button>`}</span></div>`
        )
        .join("") || '<div style="font-size:0.8rem;color:#888">Todavía nadie ha pedido entrar.</div>'
    }
  </div>`;
}
