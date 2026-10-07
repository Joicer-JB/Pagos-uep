// Arranque: al abrir la página, Firebase avisa si ya hay una sesión iniciada y se muestra el sistema o el login.

// Este código "despierta" el sistema y verifica si alguien ya inició sesión
fbAuth.onAuthStateChanged(async (user) => {
  if (user) {
    // Si hay un usuario logueado, verificamos su rol
    const staticRole = ROLES[user.email];
    if (staticRole) {
      rolUsuario = staticRole;
      auth = true;
      cargarTodo(); // Carga la plataforma
    } else {
      // Verificar si es un docente guardado en la base de datos
      try {
        const userDoc = await db.collection("usuarios").doc(user.uid).get();
        if (userDoc.exists && userDoc.data().rol === "docente" && userDoc.data().activo !== false) {
          rolUsuario = "docente";
          usuarioActual = { ...userDoc.data(), uid: user.uid };
          auth = true;
          cargarTodo(); // Carga la plataforma
        } else {
          fbAuth.signOut();
          auth = false;
          render(); // Muestra el login
        }
      } catch (e) {
        console.error("Error verificando usuario:", e);
        fbAuth.signOut();
        auth = false;
        render(); // Muestra el login
      }
    }
  } else {
    // Si no hay nadie logueado, mostramos la pantalla de Login directamente
    auth = false;
    render(); 
  }
});
