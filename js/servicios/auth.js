// Inicio y cierre de sesión. El rol sale de ROLES (config.js) o del perfil del docente en la colección «usuarios».

// Pantalla de inicio de sesión
function renderLogin() {
  return `<div class="login-wrap"><div class="login-card">
  <div class="login-logo"><img src="data:image/png;base64,${LOGO}" alt="Logo"/><div><h1>${EMPRESA}</h1><p style="font-size:0.7rem;color:#888">${EMPRESA_SUB}</p></div></div>
  <div class="login-bienvenida">Sistema de Gestión · entra con tu correo y tu contraseña</div>
  <div style="display:flex;flex-direction:column;gap:0.75rem">
    <div><label class="field-label">Correo electrónico</label><input class="inp" type="email" id="l-email" placeholder="tucorreo@gmail.com" onkeydown="if(event.key==='Enter')doLogin()"/></div>
    <div><label class="field-label">Contraseña</label><input class="inp" type="password" id="l-pwd" placeholder="Contraseña" onkeydown="if(event.key==='Enter')doLogin()"/></div>
  </div>
  ${avisoSalidaInactividad()}
  <div id="login-err" style="margin-top:0.4rem"></div>
  <button class="btn btn-primary btn-full" id="login-btn" style="margin-top:0.85rem" onclick="doLogin()">🔐 Entrar al Sistema</button>
</div></div>`;
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
let entrando = false; // true mientras doLogin() está iniciando sesión (el aviso de Firebase en app.js espera)

// Rol de un usuario de Firebase: director y administradora por su correo (ROLES), docentes por su perfil
// activo en la colección "usuarios". Devuelve null si no tiene acceso.
async function rolDe(user) {
  const rolFijo = ROLES[user.email];
  if (rolFijo) return { rol: rolFijo, perfil: null };
  const userDoc = await db.collection("usuarios").doc(user.uid).get();
  if (userDoc.exists && userDoc.data().rol === "docente" && userDoc.data().activo !== false)
    return { rol: "docente", perfil: { ...userDoc.data(), uid: user.uid } };
  return null;
}
// Abre el sistema con el rol indicado. Solo carga los datos una vez aunque la llamen doLogin y el aviso de Firebase.
function iniciarSesion({ rol, perfil }) {
  if (auth) return;
  try {
    sessionStorage.removeItem("salidaPorInactividad");
  } catch (e) {}
  rolUsuario = rol;
  if (perfil) usuarioActual = perfil;
  // Cada sesión empieza en su pantalla inicial (si no, heredaría la pestaña del usuario anterior en este equipo)
  tabActual = rol === "docente" ? "notas" : "dashboard";
  auth = true;
  cargarTodo();
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
      if (automatico) sessionStorage.setItem("salidaPorInactividad", "1");
    } catch (e) {}
    await saliendo;
    return borrarCopiaDelEquipo();
  }
  render();
}
