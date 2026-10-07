// Inicio y cierre de sesión. El rol sale de ROLES (config.js) o del perfil del docente en la colección «usuarios».

function renderLogin() {
  return `<div class="login-wrap"><div class="login-card">
  <div class="login-logo"><img src="data:image/png;base64,${LOGO}" alt="Logo"/><div><h1>${EMPRESA}</h1><p style="font-size:0.7rem;color:#888">${EMPRESA_SUB}</p></div></div>
  <div style="display:flex;flex-direction:column;gap:0.75rem">
    <div><label class="field-label">Correo electrónico</label><input class="inp" type="email" id="l-email" placeholder="tucorreo@gmail.com" onkeydown="if(event.key==='Enter')doLogin()"/></div>
    <div><label class="field-label">Contraseña</label><input class="inp" type="password" id="l-pwd" placeholder="Contraseña" onkeydown="if(event.key==='Enter')doLogin()"/></div>
  </div>
  <div id="login-err" style="margin-top:0.4rem"></div>
  <button class="btn btn-primary btn-full" id="login-btn" style="margin-top:0.85rem" onclick="doLogin()">🔐 Entrar al Sistema</button>
</div></div>`;
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
  rolUsuario = rol;
  if (perfil) usuarioActual = perfil;
  auth = true;
  cargarTodo();
}
async function doLogin() {
  const email = document.getElementById("l-email").value.trim();
  const pwd = document.getElementById("l-pwd").value;
  const btn = document.getElementById("login-btn");
  if (!email || !pwd) {
    document.getElementById("login-err").innerHTML = '<div class="error-msg">Ingresa correo y contraseña</div>';
    return;
  }
  btn.disabled = true;
  btn.textContent = "Verificando...";
  entrando = true;
  try {
    const cred = await fbAuth.signInWithEmailAndPassword(email, pwd);
    const r = await rolDe(cred.user);
    if (r) {
      iniciarSesion(r);
    } else {
      fbAuth.signOut();
      document.getElementById("login-err").innerHTML =
        '<div class="error-msg">Usuario no autorizado o desactivado</div>';
      btn.disabled = false;
      btn.textContent = "🔐 Entrar al Sistema";
    }
  } catch (e) {
    let msg = "Correo o contraseña incorrectos";
    if (e.code === "auth/too-many-requests") msg = "Demasiados intentos. Intenta más tarde.";
    document.getElementById("login-err").innerHTML = `<div class="error-msg">${msg}</div>`;
    btn.disabled = false;
    btn.textContent = "🔐 Entrar al Sistema";
  } finally {
    entrando = false;
  }
}
function logout() {
  fbAuth.signOut();
  auth = false;
  rolUsuario = "";
  escCfg = null;
  anioVista = null;
  pagos = [];
  estudiantes = [];
  trabajadores = [];
  finanzas = [];
  notas = {};
  render();
}
