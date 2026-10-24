# App Check: que Firebase solo atienda a la plataforma

La configuración de Firebase que está en `js/config.js` es pública: cualquiera que abra la página puede verla. Eso
es normal en Firebase, y **los datos ya están protegidos por las reglas de Firestore** (sin una cuenta autorizada no
se lee ni se escribe nada). App Check agrega otra capa: Firebase **solo atiende a la página de la plataforma**. Un
programa que copie la configuración para atacar la base de datos o gastar la cuota del plan gratis queda rechazado,
aunque tenga una contraseña robada.

Usa **Google Cloud Fraud Defense** (antes reCAPTCHA Enterprise). Es invisible: ni la secretaria ni tú tienen que
marcar casillas ni elegir imágenes.

> En octubre de 2026 Firebase ya no dejaba registrar el reCAPTCHA v3 «clásico» (el campo de la clave secreta salía
> bloqueado y decía «reCAPTCHA Classic está obsoleto»). Por eso se usa Fraud Defense. La clave v3 vieja ya no se usa.

## Activarlo

### 1. Crear la clave en Fraud Defense

1. Entra a [console.cloud.google.com/security/recaptcha?project=pagos-jjs](https://console.cloud.google.com/security/recaptcha?project=pagos-jjs)
   con tu cuenta de Gmail. Si pide **Habilitar** la API, púlsalo. (No hace falta tarjeta: el plan gratis cubre
   10.000 verificaciones al mes, de sobra para un colegio).
2. **Crear clave** → nombre `Pagos UEP`, plataforma **Web**, dominio `joicer-jb.github.io` (sin `https://` ni
   `/Pagos-uep`), **sin** «desafío de casilla de verificación».
3. Copia el **ID de clave** (empieza por `6L…`). Es público: se pone en la plataforma. Esta clave **no tiene clave
   secreta**.

### 2. Registrar la app en Firebase

1. [console.firebase.google.com](https://console.firebase.google.com) → proyecto **pagos-jjs** → menú
   **Compilación** (Build) → **App Check** → pestaña **Apps**.
2. En **Pagos-JJS** pulsa **Registrar** → **Fraud Defense (antes conocido como reCAPTCHA Enterprise)**.
3. Pega el **ID de clave** y pulsa **Guardar**. Debe quedar como **Registrada**.

### 3. Poner la clave en la plataforma

La clave va en `APP_CHECK_CLAVE` (en `js/config.js`) con `APP_CHECK_ENTERPRISE = true`. Desde ese momento la
plataforma se identifica ante Firebase en cada operación. ✅ Ya está puesta (octubre 2026, Fraud Defense).

### 4. Revisar y aplicar (después de 1 o 2 días)

1. Usen la plataforma normalmente uno o dos días.
2. En Firebase → **App Check** → pestaña **APIs** → **Cloud Firestore**: debe decir que casi todas las solicitudes
   están **verificadas**.
3. Si es así, pulsa **Aplicar** (Enforce) en Cloud Firestore. Desde ahí, Firestore rechaza todo lo que no venga de
   la plataforma.

> ⚠️ **No pulses «Aplicar» antes de que la plataforma tenga la clave del sitio** (paso 3), o la plataforma dejará de
> funcionar. Si algo falla después de aplicar, en la misma pantalla pulsa **Dejar de aplicar** y todo vuelve a
> funcionar al instante.

## Bueno saber

- El **respaldo automático** de los viernes no pasa por App Check (usa la cuenta de servicio), así que sigue
  funcionando.
- Si algún día la plataforma se publica en otro dominio, hay que agregar ese dominio en la clave de reCAPTCHA
  (paso 1, configuración de la clave).
- El plan gratis de reCAPTCHA cubre de sobra el uso de un colegio.
