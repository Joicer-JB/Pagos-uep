// Arranque: al abrir la página, Firebase avisa si ya hay una sesión iniciada y se muestra el sistema o el login.

fbAuth.onAuthStateChanged(async (user) => {
  if (user) {
    // El inicio de sesión desde el formulario lo resuelve doLogin(); aquí solo se retoma una sesión guardada
    if (entrando || auth) return;
    try {
      const r = await rolDe(user);
      if (r) return iniciarSesion(r);
    } catch (e) {
      console.error("Error verificando usuario:", e);
      if (!navigator.onLine) {
        // Sin internet no se pudo comprobar la cuenta: no se cierra la sesión, se espera a la conexión
        document.getElementById("app").innerHTML =
          `<div class="loading">📴 Sin internet: no se pudo comprobar tu cuenta.<br><br><button onclick="location.reload()" class="btn btn-primary">🔄 Reintentar</button></div>`;
        return;
      }
    }
    fbAuth.signOut(); // sin acceso: el aviso vuelve con user = null y se muestra el login
  } else {
    detenerEspera();
    auth = false;
    // Si el login ya está en pantalla no se redibuja, para no borrar un mensaje de error
    if (!document.getElementById("login-btn")) render();
  }
});
