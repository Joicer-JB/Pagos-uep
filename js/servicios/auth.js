// Inicio y cierre de sesión. El rol sale de ROLES (config.js) o del perfil del docente en la colección «usuarios».

// Pantalla de inicio de sesión
function renderLogin() {
  return `<div class="login-wrap">${fondoEntrada()}<div class="login-card">
  <div class="login-logo">${escudo3D()}<div><h1>${EMPRESA}</h1><p style="font-size:0.7rem;color:#888">${EMPRESA_SUB}</p>${lemaEntrada()}</div></div>
  <div class="login-bienvenida">Sistema de Gestión · entra con tu cuenta de Google o con tu correo y contraseña</div>
  <button class="btn btn-full btn-google" id="login-google" onclick="doLoginGoogle()">${LOGO_GOOGLE} Entrar con Google</button>
  <div class="login-o"><span>o con tu contraseña</span></div>
  <div style="display:flex;flex-direction:column;gap:0.75rem">
    <div><label class="field-label">Correo electrónico</label><input class="inp" type="email" id="l-email" placeholder="tucorreo@gmail.com" onkeydown="if(event.key==='Enter')doLogin()"/></div>
    <div><label class="field-label">Contraseña</label><input class="inp" type="password" id="l-pwd" placeholder="Contraseña" onkeydown="if(event.key==='Enter')doLogin()"/></div>
  </div>
  ${avisoSalidaInactividad()}${avisoSalidaAutorizacion()}
  <div id="login-err" style="margin-top:0.4rem"></div>
  <button class="btn btn-primary btn-full" id="login-btn" style="margin-top:0.85rem" onclick="doLogin()">🔐 Entrar al Sistema</button>
  <div style="text-align:center;margin-top:0.6rem"><button type="button" id="login-olvide" onclick="olvideClave()" style="background:none;border:none;color:#00509e;font-size:0.8rem;text-decoration:underline;cursor:pointer;font-family:inherit">¿Olvidaste tu contraseña?</button></div>
  <div style="text-align:center;margin-top:0.5rem">${botonModoTactil()}</div>
</div></div>`;
}
// «¿Olvidaste tu contraseña?»: Firebase manda al correo un enlace para poner una contraseña nueva. Siempre dice lo
// mismo, exista o no la cuenta, para no revelar qué correos tienen acceso.
async function olvideClave() {
  const email = (document.getElementById("l-email").value || "").trim();
  const caja = document.getElementById("login-err");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    mostrarError("login-err", "Escribe tu correo arriba y vuelve a tocar «¿Olvidaste tu contraseña?».");
    return;
  }
  const btn = document.getElementById("login-olvide");
  if (btn) btn.disabled = true;
  try {
    fbAuth.languageCode = "es";
    await fbAuth.sendPasswordResetEmail(email);
  } catch (e) {
    if (e.code !== "auth/user-not-found") {
      if (btn) btn.disabled = false;
      mostrarError(
        "login-err",
        e.code === "auth/invalid-email"
          ? "Ese correo no es válido."
          : e.code === "auth/too-many-requests"
            ? "Demasiados intentos. Espera unos minutos y vuelve a intentar."
            : e.code === "auth/network-request-failed"
              ? "Sin conexión a internet. Intenta de nuevo cuando tengas conexión."
              : "No se pudo enviar el correo (" + e.message + ")."
      );
      return;
    }
  }
  if (btn) btn.disabled = false;
  if (caja)
    caja.innerHTML = `<div class="alert-item alert-info" style="font-size:0.8rem">📧 Si <strong>${escHtml(email)}</strong> tiene una cuenta, le llegó un correo para poner una contraseña nueva. Revisa también la carpeta de spam o «no deseado». Después entra aquí con la contraseña nueva.</div>`;
}
// Después de cerrarse sola la sesión por inactividad, la pantalla de entrada lo explica (hasta que se vuelve a entrar)
function avisoSalidaInactividad() {
  try {
    if (!sessionStorage.getItem("salidaPorInactividad")) return "";
  } catch (e) {
    return "";
  }
  return `<div class="alert-item alert-info" style="margin-top:0.6rem;font-size:0.78rem">🔒 La sesión se cerró sola después de ${MINUTOS_INACTIVIDAD} minutos sin usarla.</div>`;
}
// La «G» de Google para el botón de entrada
const LOGO_GOOGLE = `<svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.9z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 38.2 44 33 44 24c0-1.3-.1-2.6-.4-3.9z"/></svg>`;
let entrando = false; // true mientras doLogin() está iniciando sesión (el aviso de Firebase en app.js espera)

// Rol de un usuario de Firebase: director y administradora por su correo (ROLES), docentes por su perfil
// activo en la colección "usuarios". Devuelve null si no tiene acceso.
async function rolDe(user) {
  const rolFijo = ROLES[String(user.email || "").toLowerCase()];
  if (rolFijo) return { rol: rolFijo, perfil: null };
  const userDoc = await db.collection("usuarios").doc(user.uid).get();
  if (userDoc.exists && userDoc.data().rol === "docente" && userDoc.data().activo !== false)
    return { rol: "docente", perfil: { ...userDoc.data(), uid: user.uid } };
  return null;
}
// Abre el sistema con el rol indicado. Solo carga los datos una vez aunque la llamen doLogin y el aviso de Firebase.
// La secretaria y control de estudio esperan antes la autorización del director (autorizaciones.js).
function iniciarSesion(r) {
  if (auth || _espera) return;
  if (necesitaAutorizacion(r)) return esperarAutorizacion(r);
  abrirSesion(r);
}
function abrirSesion({ rol, perfil }) {
  if (auth) return;
  try {
    sessionStorage.removeItem("salidaPorInactividad");
    sessionStorage.removeItem("salidaSinAutorizacion");
  } catch (e) {}
  rolUsuario = rol;
  if (perfil) usuarioActual = perfil;
  // Cada sesión empieza en su pantalla inicial (si no, heredaría la pestaña del usuario anterior en este equipo)
  tabActual = rol === "docente" ? "notas" : "dashboard";
  auth = true;
  cargarTodo();
  escucharAutorizaciones();
}
// Botón «Entrar»: inicia sesión en Firebase y comprueba que el usuario tenga un rol
async function doLogin() {
  const email = document.getElementById("l-email").value.trim();
  const pwd = document.getElementById("l-pwd").value;
  const btn = document.getElementById("login-btn");
  if (!email || !pwd) {
    mostrarError("login-err", "Ingresa correo y contraseña");
    return;
  }
  btn.disabled = true;
  btn.textContent = "Verificando...";
  entrando = true;
  try {
    // En la PC de la administradora (a veces compartida) la sesión se cierra al cerrar el navegador
    const P = firebase.auth.Auth.Persistence;
    await fbAuth.setPersistence(equipoCompartido(ROLES[email.toLowerCase()]) ? P.SESSION : P.LOCAL).catch(() => {});
    const cred = await fbAuth.signInWithEmailAndPassword(email, pwd);
    const r = await rolDe(cred.user);
    if (r) {
      iniciarSesion(r);
    } else {
      fbAuth.signOut();
      mostrarError("login-err", "Usuario no autorizado o desactivado");
      btn.disabled = false;
      btn.textContent = "🔐 Entrar al Sistema";
    }
  } catch (e) {
    let msg = "Correo o contraseña incorrectos";
    if (e.code === "auth/too-many-requests") msg = "Demasiados intentos. Intenta más tarde.";
    mostrarError("login-err", msg);
    btn.disabled = false;
    btn.textContent = "🔐 Entrar al Sistema";
  } finally {
    entrando = false;
  }
}
// Botón «Entrar con Google»: elige la cuenta de Google; entra si ese correo tiene un rol (los mismos de siempre).
// La sesión empieza solo para esta ventana; si no es la administradora (PC compartida), se recuerda en el equipo.
const ERRORES_GOOGLE = {
  "auth/operation-not-allowed": "Falta activar Google en Firebase (Authentication → Método de acceso → Google).",
  "auth/unauthorized-domain":
    "Falta autorizar esta página en Firebase (Authentication → Configuración → Dominios autorizados).",
  "auth/account-exists-with-different-credential": "Esa cuenta entra con contraseña: usa tu correo y tu contraseña.",
  "auth/network-request-failed": "Sin internet: no se pudo abrir Google.",
};
async function doLoginGoogle() {
  const btn = document.getElementById("login-google");
  if (btn) btn.disabled = true;
  entrando = true;
  const P = firebase.auth.Auth.Persistence;
  try {
    const proveedor = new firebase.auth.GoogleAuthProvider();
    proveedor.setCustomParameters({ prompt: "select_account" }); // que siempre pregunte qué cuenta usar
    await fbAuth.setPersistence(P.SESSION).catch(() => {});
    let cred;
    try {
      cred = await fbAuth.signInWithPopup(proveedor);
    } catch (e) {
      // Si el navegador no deja abrir la ventana de Google, se va a Google y vuelve
      if (e.code === "auth/popup-blocked" || e.code === "auth/operation-not-supported-in-this-environment")
        return fbAuth.signInWithRedirect(proveedor);
      throw e;
    }
    const r = await rolDe(cred.user);
    if (!r) {
      await fbAuth.signOut();
      mostrarError("login-err", "La cuenta " + (cred.user.email || "") + " no tiene acceso a la plataforma.");
      return;
    }
    if (!equipoCompartido(r.rol)) await fbAuth.setPersistence(P.LOCAL).catch(() => {});
    iniciarSesion(r);
  } catch (e) {
    if (e.code !== "auth/popup-closed-by-user" && e.code !== "auth/cancelled-popup-request")
      mostrarError("login-err", ERRORES_GOOGLE[e.code] || "No se pudo entrar con Google: " + (e.message || e.code));
  } finally {
    entrando = false;
    if (btn) btn.disabled = false;
  }
}
// ---- Equipo compartido: la PC de la administradora a veces la usa otra persona. Su sesión se cierra al cerrar el
// navegador y después de MINUTOS_INACTIVIDAD sin usarla, y al salir se borra la copia de los datos que guarda el
// equipo para trabajar sin internet (en la del director, que es personal, la copia se queda).
const equipoCompartido = (rol) => rol === "administradora";
const MINUTOS_INACTIVIDAD = 30;
let _ultimaActividad = Date.now();
["pointerdown", "keydown", "touchstart"].forEach((ev) =>
  document.addEventListener(ev, () => (_ultimaActividad = Date.now()), { capture: true, passive: true })
);
function revisarInactividad() {
  if (!auth || !equipoCompartido(rolUsuario)) return;
  if (Date.now() - _ultimaActividad < MINUTOS_INACTIVIDAD * 60000) return;
  if (!navigator.onLine || (typeof caja !== "undefined" && caja.guardando)) return; // nunca a mitad de un cobro
  return logout({ inactividad: true });
}
setInterval(revisarInactividad, 60000);
// ¿Se puede salir sin perder cobros? Lo hecho sin internet tiene que subirse antes de borrar la copia del equipo
async function listoParaSalir(automatico) {
  if (!navigator.onLine) {
    if (!pagos.some((p) => p.pendiente === true)) return true;
    if (!automatico)
      alert(
        "No hay internet y hay cobros hechos sin conexión que todavía no se han subido.\n\nEspera a que vuelva la conexión antes de salir: si sales ahora, se perderían."
      );
    return false;
  }
  try {
    await Promise.race([
      db.waitForPendingWrites(),
      new Promise((_, no) => setTimeout(() => no(new Error("tarda")), 15000)),
    ]);
    return true;
  } catch (e) {
    return !automatico && confirm("Todavía se están subiendo cambios a la nube. ¿Salir de todos modos?");
  }
}
// Borra la copia local de Firestore y vuelve a abrir la página (Firestore no se puede usar después de borrarla)
async function borrarCopiaDelEquipo() {
  try {
    await db.terminate();
    await db.clearPersistence();
  } catch (e) {
    console.warn("No se pudo borrar la copia local de los datos:", e.message);
  }
  try {
    localStorage.removeItem("tasasBCV_local");
    localStorage.removeItem(LOTE_BORRADOR);
  } catch (e) {}
  location.reload();
}

// Cierra la sesión y borra de la memoria los datos cargados (y, en el equipo compartido, también del equipo)
async function logout(op) {
  const automatico = !!(op && op.inactividad);
  const compartido = equipoCompartido(rolUsuario);
  if (compartido && !(await listoParaSalir(automatico))) return;
  detenerTiempoReal();
  detenerEspera();
  dejarDeEscucharAutorizaciones();
  olvidarFichasDocentes();
  const saliendo = Promise.resolve(fbAuth.signOut()).catch(() => {});
  auth = false;
  rolUsuario = "";
  escCfg = null;
  anioVista = null;
  pagos = [];
  estudiantes = [];
  trabajadores = [];
  finanzas = [];
  cuentasPagar = [];
  notas = {};
  if (compartido) {
    try {
      if (automatico && !op.sinAutorizacion) sessionStorage.setItem("salidaPorInactividad", "1");
    } catch (e) {}
    await saliendo;
    return borrarCopiaDelEquipo();
  }
  render();
}
