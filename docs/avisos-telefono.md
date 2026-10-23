# 📲 Avisos al teléfono

Avisos que te llegan al teléfono (o a la computadora) **aunque la plataforma esté cerrada**:

| Aviso                     | Cuándo                                    | Qué dice                                                                                         |
| ------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------ |
| 💰 Cierre del día         | Lunes a viernes, alrededor de las 6:00 pm | Lo cobrado hoy, por forma de pago; cuántos deben; cuentas por pagar vencidas o que vencen mañana |
| 🗓️ Resumen de la quincena | El 1 y el 16, alrededor de las 7:00 am    | Cuántos deben (y cuánto), cuántos al día, lo que entró y salió en la quincena                    |
| 💾 Respaldo               | Los viernes, después de las 5:00 pm       | Si el respaldo semanal salió bien o falló                                                        |

Los días sin cobros (feriados, vacaciones) no llega el cierre del día, salvo que venza una cuenta. GitHub a veces los
manda unos minutos tarde. Los avisos son **solo para el director**.

## Activarlos (una sola vez, unos 5 minutos)

### 1. La clave de los avisos (en Firebase)

1. [console.firebase.google.com](https://console.firebase.google.com) → proyecto **pagos-jjs** → ⚙️ **Configuración del
   proyecto** → pestaña **Cloud Messaging**.
2. Si dice que la **API de Firebase Cloud Messaging (V1)** está inhabilitada, actívala con el enlace que aparece.
3. Abajo, en **Configuración web → Certificados push web**, pulsa **Generar par de claves**.
4. Copia la clave que aparece (es larga y empieza con «B…») y **mándamela**. Es pública: se puede compartir. La pongo en
   la plataforma (`VAPID_CLAVE` en `js/config.js`).

Los avisos usan el mismo secreto de GitHub que el respaldo (`FIREBASE_SERVICE_ACCOUNT`, ver
[respaldo-automatico.md](respaldo-automatico.md)). Si ya lo creaste, no hace falta nada más.

### 2. En tu teléfono

- **Android:** abre la plataforma en **Chrome** (mejor instalada: 📲 Instalar), entra, ve a ⚙️ Config → **📲 Avisos** →
  **🔔 Activar los avisos en este equipo** y pulsa **Permitir**. Llega un aviso de prueba al momento.
- **iPhone** (iOS 16.4 o más nuevo): primero instala la app (Safari → Compartir → **Agregar a inicio**) y **ábrela desde
  su ícono**; ahí haz lo mismo: ⚙️ Config → 📲 Avisos → Activar → Permitir. En Safari normal, sin instalar, el iPhone
  no recibe avisos.
- **Computadora:** lo mismo en Chrome o Edge.

En la misma pantalla eliges en cada equipo qué avisos quieres, y lo puedes **Quitar**.

### 3. Probar

GitHub → pestaña **Actions** → **Avisos al teléfono** → **Run workflow** → tipo **prueba** → **Run workflow**. En un
minuto te llega «🔔 Aviso de prueba». También puedes elegir **dia** o **quincena** para ver cómo se ven.

## Si no llegan

- En el teléfono, revisa que las notificaciones de la app (o de Chrome) estén permitidas y que no esté en «No molestar».
- Si borras los datos del navegador o desinstalas la app, vuelve a activarlos. Los equipos que ya no responden se
  quitan solos de la lista.
- En GitHub → Actions → Avisos al teléfono, abre la última corrida: dice a cuántos equipos se mandó.
