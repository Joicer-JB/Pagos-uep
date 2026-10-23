# App Check: que Firebase solo atienda a la plataforma

La configuración de Firebase que está en `js/config.js` es pública: cualquiera que abra la página puede verla. Eso
es normal en Firebase, y **los datos ya están protegidos por las reglas de Firestore** (sin una cuenta autorizada no
se lee ni se escribe nada). App Check agrega otra capa: Firebase **solo atiende a la página de la plataforma**. Un
programa que copie la configuración para atacar la base de datos o gastar la cuota del plan gratis queda rechazado,
aunque tenga una contraseña robada.

Usa reCAPTCHA v3 de Google. Es invisible: ni la secretaria ni tú tienen que marcar casillas ni elegir imágenes.

## Activarlo (unos 15 minutos)

### 1. Crear la clave de reCAPTCHA

1. Entra a [google.com/recaptcha/admin/create](https://www.google.com/recaptcha/admin/create) con tu cuenta de Gmail.
2. **Etiqueta**: `Pagos UEP`.
3. **Tipo de reCAPTCHA**: **Basado en puntuaciones (v3)**.
4. **Dominios**: `joicer-jb.github.io` (el de la página de la plataforma, sin `https://` ni `/Pagos-uep`).
5. Acepta las condiciones y pulsa **Enviar**.
   - Si Google te manda a la consola de **Google Cloud** (reCAPTCHA ahora vive ahí), crea la clave allí: tipo
     **Sitio web**, dominio `joicer-jb.github.io`, y **sin** «desafío de casilla». En ese caso es una clave
     **reCAPTCHA Enterprise**: en el paso 2 elige **reCAPTCHA Enterprise** en vez de v3 y avísame cuál usaste.
6. Te muestra dos claves:
   - **Clave del sitio**: es pública. **Mándamela** y la pongo en la plataforma.
   - **Clave secreta**: no la compartas. Se pega en Firebase (paso 2).

### 2. Registrar la app en Firebase

1. [console.firebase.google.com](https://console.firebase.google.com) → proyecto **pagos-jjs** → menú
   **Compilación** (Build) → **App Check**.
2. Pestaña **Apps** → tu app web → **reCAPTCHA v3**.
3. Pega la **clave secreta** y pulsa **Guardar**.

### 3. Poner la clave del sitio en la plataforma

Me pasas la clave del sitio y la pongo en `APP_CHECK_CLAVE` (en `js/config.js`). Desde ese momento la plataforma se
identifica ante Firebase en cada operación. ✅ Ya está puesta (octubre 2026, reCAPTCHA v3).

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
