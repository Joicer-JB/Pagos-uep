# Entrar con Google

En la pantalla de entrada está el botón **Entrar con Google**: eliges tu cuenta de Gmail y entras, sin escribir la
contraseña de la plataforma. Funciona con las **mismas cuentas** de siempre: la plataforma te reconoce por tu correo
(director, administradora o docente) y te da los mismos permisos.

**La ventaja:** si tu Gmail tiene la **verificación en 2 pasos** (un código o aviso en tu teléfono), la plataforma queda
protegida igual: aunque alguien sepa tu contraseña, no entra sin tu teléfono.
Actívala en [myaccount.google.com/security](https://myaccount.google.com/security) → «Verificación en 2 pasos».

## Activarlo (una sola vez, 2 minutos)

1. [console.firebase.google.com](https://console.firebase.google.com) → proyecto **pagos-jjs** → **Authentication** →
   pestaña **Método de acceso** (Sign-in method).
2. **Agregar proveedor nuevo** → **Google** → actívalo, elige tu correo como «correo de asistencia» y **Guardar**.
3. En **Authentication → Configuración → Dominios autorizados**, revisa que esté `joicer-jb.github.io`. Si no está,
   **Agregar dominio** y escríbelo.

Hasta que lo actives, el botón dice «Falta activar Google en Firebase».

## Bueno saber

- **La primera vez que entres con Google, tu contraseña de la plataforma puede dejar de servir**: Firebase deja la
  cuenta solo con Google (pasa cuando el correo no estaba verificado). Desde entonces entras con el botón de Google.
- **La computadora de la secretaria** (a veces compartida): recomiendo que **ella siga entrando con su contraseña**. Si
  usara Google, su Gmail quedaría abierto en ese navegador para la siguiente persona. Si aun así lo usa, que cierre su
  sesión de Gmail al terminar. La sesión de la plataforma igual se cierra al cerrar el navegador o tras 30 minutos.
- Una cuenta de Google que no esté entre las autorizadas no entra («no tiene acceso a la plataforma»).
