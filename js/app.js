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
    }
    fbAuth.signOut(); // sin acceso: el aviso vuelve con user = null y se muestra el login
  } else {
    auth = false;
    // Si el login ya está en pantalla no se redibuja, para no borrar un mensaje de error
    if (!document.getElementById("login-btn")) render();
  }
});
