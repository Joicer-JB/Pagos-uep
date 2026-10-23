# Respaldo automático semanal

Cada **viernes a las 5:00 pm** (hora de Venezuela), GitHub hace una copia completa de la base de datos:
estudiantes, pagos, finanzas, nómina, documentos del personal, notas, configuración y bitácora.

- El archivo queda **cifrado**: sin la clave del respaldo nadie puede leerlo, aunque lo descargue.
- Se guarda **90 días** (unos 13 respaldos) en GitHub → pestaña **Actions** → **Respaldo semanal**.
- La plataforma anota la fecha del último respaldo. El director la ve en ⚙️ Config → 📅 Año escolar, y en
  Inicio aparece un aviso si pasan más de 14 días sin respaldo.
- GitHub a veces lo arranca unos minutos tarde (es normal).
- Si activaste los [avisos al teléfono](avisos-telefono.md), te llega «💾 Respaldo semanal hecho» o, si falló, «⚠️ No
  se pudo hacer el respaldo».

## Activarlo (una sola vez, unos 10 minutos)

Hacen falta dos "secretos" en GitHub. Los secretos son datos guardados con llave: ni siquiera quien vea el
repositorio puede leerlos.

### 1. La cuenta de servicio de Firebase

Es la "llave" con la que el respaldo lee la base de datos.

1. Entra a [console.firebase.google.com](https://console.firebase.google.com), proyecto **pagos-jjs**.
2. ⚙️ (junto a "Descripción general del proyecto") → **Configuración del proyecto** → pestaña **Cuentas de servicio**.
3. Pulsa **Generar nueva clave privada** → **Generar clave**. Se descarga un archivo `.json`.
4. Ábrelo con el Bloc de notas y **copia todo su contenido**.
5. En GitHub, en el repositorio **Pagos-uep**: **Settings** → **Secrets and variables** → **Actions** →
   **New repository secret**.
   - Name: `FIREBASE_SERVICE_ACCOUNT`
   - Secret: pega todo el contenido del archivo
   - **Add secret**
6. **Borra el archivo `.json` de tu computadora** (y de la papelera). Esa llave abre toda la base de datos: no la
   compartas ni la mandes por WhatsApp o correo.

### 2. La clave del respaldo

Es la contraseña con la que se cifra cada respaldo. Invéntala larga (mínimo 12 caracteres), por ejemplo una frase:
`ColegioJosefa-Turumo-2026!`

1. En GitHub: **Settings** → **Secrets and variables** → **Actions** → **New repository secret**.
   - Name: `RESPALDO_CLAVE`
   - Secret: tu clave
2. **Anótala en un lugar seguro fuera de la computadora** (por ejemplo, en un papel guardado en la caja fuerte).
   **Si la pierdes, los respaldos no se pueden abrir.** Nadie, ni GitHub ni Firebase, puede recuperarla.

### 3. Probarlo

1. En GitHub: pestaña **Actions** → **Respaldo semanal** (a la izquierda) → **Run workflow** → **Run workflow**.
2. En uno o dos minutos aparece con ✅. Si sale ❌, ábrelo: el mensaje dice qué falta.
3. En la plataforma, ⚙️ Config → 📅 Año escolar: debe decir "Último respaldo automático: hoy".

## Abrir un respaldo

1. GitHub → **Actions** → **Respaldo semanal** → abre la corrida de la fecha que quieres.
2. Abajo, en **Artifacts**, descarga `respaldo-…` (baja un `.zip`; descomprímelo).
3. En la plataforma: ⚙️ Config → 📅 Año escolar → **Respaldo automático**: elige el archivo
   `respaldo-AAAA-MM-DD.cifrado.json`, escribe la clave y pulsa **🔓 Abrir respaldo**.
4. Verás cuántos registros tiene cada parte, y puedes descargarlo sin cifrar (JSON) para entregárselo a quien vaya a
   restaurar los datos.

El respaldo se descifra en tu propio navegador: la clave no se envía a ningún lado.

## Bueno saber

- **GitHub apaga los flujos programados** de un repositorio público si pasan **60 días sin cambios** en el código.
  Antes de hacerlo manda un correo al dueño. Si pasa, entra a Actions → Respaldo semanal → **Enable workflow**.
- Si algún día cambias la clave del respaldo, los respaldos viejos se siguen abriendo con la clave vieja.
- Si generas otra clave privada, actualiza el secreto `FIREBASE_SERVICE_ACCOUNT` y borra la clave vieja en
  [console.cloud.google.com](https://console.cloud.google.com) → IAM y administración → Cuentas de servicio →
  la cuenta `firebase-adminsdk` → Claves.
