<p align="center"><img src="assets/logo.png" alt="Logo" width="90"/></p>

# Sistema de Gestión — U.E.P. Josefa Joaquina Sánchez

Aplicación web de la U.E.P. Josefa Joaquina Sánchez (Turumo, Caucagüita). Lleva la administración y la
parte académica del colegio: cobros, mensualidades, mora, finanzas, nómina, notas y boletines.

Funciona en el navegador, en computadora, tablet o teléfono. Los datos se guardan en **Firebase**
(Firestore) y se comparten entre todos los usuarios.

---

## Contenido

1. [Qué hace cada rol](#qué-hace-cada-rol)
2. [Cómo está organizado el código](#cómo-está-organizado-el-código)
3. [Publicar la app](#publicar-la-app)
4. [Reglas de Firestore (seguridad)](#reglas-de-firestore-seguridad)
5. [Configuración](#configuración)
6. [Hacer cambios sin romper nada](#hacer-cambios-sin-romper-nada)
7. [Pruebas automáticas](#pruebas-automáticas)
8. [Respaldos](#respaldos)
9. [Problemas comunes](#problemas-comunes)

Guías de uso por rol: [Director](docs/guia-director.md) · [Administradora](docs/guia-administradora.md) ·
[Docentes](docs/guia-docentes.md). Historial de cambios: [CHANGELOG.md](CHANGELOG.md).

---

## Qué hace cada rol

| Pestaña                                                   | Director | Administradora |     Docente     |
| --------------------------------------------------------- | :------: | :------------: | :-------------: |
| 🏠 Inicio (resumen del mes, mora, últimos pagos)          |    ✅    |       ✅       |                 |
| 💳 Caja (cobro rápido, cierre de caja)                    |    ✅    |       ✅       |                 |
| 💰 Pagos (registro y recibos)                             |    ✅    |       ✅       |                 |
| 🔔 Cobranza (por cobrar, recordatorios WhatsApp y correo) |    ✅    |       ✅       |                 |
| 👨‍🎓 Estudiantes                                            |    ✅    |       ✅       |                 |
| 📒 Finanzas (ingresos, gastos, flujo de caja)             |    ✅    |       ✅       |                 |
| 👷 Nómina                                                 |    ✅    |       ✅       |                 |
| 📊 Reportes y 📈 Gráficas                                 |    ✅    |       ✅       |                 |
| 📝 Notas y boletines                                      |    ✅    |       ✅       | ✅ (solo Notas) |
| 📥 Importar matrícula desde Excel                         |    ✅    |                |                 |
| ⚙️ Configuración (docentes, materias, año escolar…)       |    ✅    |                |                 |
| 🗑️ Borrar pagos, estudiantes, gastos o trabajadores       |    ✅    |                |                 |

**Quién es quién:**

- **Director** y **administradora**: se reconocen por su correo, en la lista `ROLES` de
  [`js/config.js`](js/config.js).
- **Docentes**: el director los crea en ⚙️ Configuración → Docentes. Cada uno queda con un perfil en la
  colección `usuarios` de Firestore. El correo fijo `notasjjs@gmail.com` también entra como docente.

**Moneda:** todos los montos se guardan en **$ de referencia**. Cada pago y cada gasto guarda además la
**tasa BCV** de su día y su valor en bolívares. La tasa del día se carga con el botón 💱 de la cabecera.

---

## Cómo está organizado el código

No hay que instalar ni compilar nada. Son archivos HTML, CSS y JavaScript que el navegador carga tal cual.

```
index.html                 La página: carga los estilos y los scripts en orden
css/estilos.css            Todos los estilos de pantalla
assets/logo.png            Logo (para el README y el ícono de la pestaña)
js/
  logo.js                  Logo en base64 (para recibos y constancias impresas)
  config.js                ⚙️ Datos del colegio, ROLES, Firebase y EmailJS  ← lo que más se edita
  estado.js                Variables globales: sesión, datos cargados, pestaña y filtros
  interfaz.js              Cabecera, pestañas, modales, mensajes de error y avisos
  utils/
    formato.js             Montos ($ y Bs.), números venezolanos (1.234,56) y fechas
    texto.js               escHtml/escJs (seguridad), acentos, correos y teléfonos de Venezuela
    grados.js              Grados (Maternal → 5to Año), niveles y áreas
  servicios/
    auth.js                Inicio y cierre de sesión, roles
    datos.js               Carga de datos desde Firestore
    tasa-bcv.js            Tasa BCV y conversión $ ↔ Bs.
    cuotas.js              Mora automática: cuotas mensuales, recargos y deuda de cada estudiante
    notificaciones.js      Avisos por correo al colegio (EmailJS)
  vistas/                  Una pantalla por archivo
    dashboard.js  caja.js  pagos.js  cobranza.js  estudiantes.js  finanzas.js  nomina.js
    reportes.js  graficas.js  notas.js  boletin.js  configuracion.js  anio-escolar.js
    promocion.js  importar.js  duplicados.js
  app.js                   Arranque: si ya hay una sesión abierta, entra directo
firestore.rules            Reglas de seguridad de la base de datos (ver abajo)
tests/                     Pruebas automáticas (no se publican ni afectan a la app)
```

**El orden de los `<script>` en `index.html` importa.** Primero van la configuración y las utilidades,
después los servicios y las vistas, y `app.js` siempre al final. Todos los archivos comparten las mismas
variables globales: una función definida en `pagos.js` se puede usar desde `caja.js` o desde un
`onclick` del HTML.

**Para encontrar algo:** busca la pestaña en `js/vistas/`. Por ejemplo, el recibo de pago está en
`js/vistas/pagos.js` (`renderModalRecibo` e `imprimirRecibo`).

---

## Publicar la app

La app es un sitio estático. Si está publicada con **GitHub Pages**, basta con subir los cambios a la
rama `main`. Si usas otro hospedaje (Firebase Hosting, Netlify…), sube **todo el contenido** del
repositorio: `index.html`, `css/`, `js/` y `assets/`.

> ⚠️ **Ya no basta con subir solo `index.html`.** Desde la reorganización, el código vive en las carpetas
> `css/` y `js/`. Si borras y vuelves a subir un `index.html` "todo en uno", se pierden todas las
> mejoras. Lee [Hacer cambios sin romper nada](#hacer-cambios-sin-romper-nada).

Para **probar la app en tu computadora** antes de publicar (usa la base de datos real):

```bash
npm install        # solo la primera vez
npm run servir     # abre http://localhost:8080
```

---

## Reglas de Firestore (seguridad)

Los roles de la app (qué pestañas ve cada quien) se deciden en el navegador, y cualquiera con
conocimientos podría saltárselos. **Lo que de verdad protege los datos son las reglas de Firestore**,
que se aplican en los servidores de Google.

Las reglas están en [`firestore.rules`](firestore.rules), con comentarios. Resumen:

- **Sin sesión, o con una cuenta que no tiene rol:** no puede leer ni escribir nada.
- **Director:** acceso total.
- **Administradora:** registra y edita pagos, estudiantes, finanzas y nómina, y carga la tasa BCV. No
  puede borrar, ni cambiar el resto de la configuración.
- **Docente:** lee estudiantes y configuración, y carga notas. No ve pagos, finanzas ni nómina. Si el
  director lo desactiva, pierde el acceso.
- **Un pago ya registrado no se puede modificar**, ni siquiera por el director. Solo el director puede
  borrarlo.

### Cómo publicarlas (cada vez que cambie `firestore.rules`)

1. Entra a [console.firebase.google.com](https://console.firebase.google.com) → proyecto **pagos-jjs**.
2. Menú izquierdo → **Firestore Database** → pestaña **Reglas**.
3. Borra todo el texto, pega el contenido completo de `firestore.rules` y pulsa **Publicar**.

Si cambias un correo en `ROLES` (`js/config.js`), cambia también el mismo correo en `firestore.rules`.
Si no coinciden, esa persona entra a la app pero no puede ver ni guardar nada.

---

## Configuración

Todo está en [`js/config.js`](js/config.js):

| Qué                                   | Dónde                                    |
| ------------------------------------- | ---------------------------------------- |
| Nombre y ubicación del colegio        | `EMPRESA`, `EMPRESA_SUB`                 |
| Correos del director y administradora | `ROLES` (y también en `firestore.rules`) |
| Materias por defecto y lapsos         | `MATERIAS`, `LAPSOS`                     |
| Proyecto de Firebase                  | `firebase.initializeApp({...})`          |
| Avisos por correo (EmailJS)           | `EJS_SERVICE`, `EJS_TEMPLATE`, `EJS_KEY` |
| Buzón del colegio                     | `CORREO_COLEGIO`                         |

Lo demás (materias de cada año, indicadores, datos de la institución, cuotas y recargos, año escolar,
docentes) se configura desde la propia app, en ⚙️ Configuración.

La configuración de Firebase y la clave de EmailJS son **públicas por diseño**: viajan al navegador de
todos los usuarios, así que no son secretas. La seguridad la dan las reglas de Firestore.

---

## Hacer cambios sin romper nada

Ver [docs/como-hacer-cambios.md](docs/como-hacer-cambios.md). En resumen:

1. **Edita el archivo que corresponde.** No reemplaces `index.html` completo. En GitHub: abre el archivo
   → ícono del lápiz ✏️ → edita → **Commit changes**.
2. **Escribe un mensaje que diga qué cambió**, por ejemplo: «Caja: agrega método Zelle». No dejes
   «Add files via upload».
3. **Revisa la ✅ o ❌ de las pruebas automáticas** que aparece junto al commit en GitHub (pestaña
   **Actions**).
4. **Si muestras en pantalla un texto que escribió un usuario** (nombre, descripción, etc.), pásalo por
   `escHtml(...)`. Si va dentro de un `onclick="f('…')"`, usa `escJs(...)`.

---

## Pruebas automáticas

Se ejecutan solas en GitHub en cada cambio (`.github/workflows/pruebas.yml`). Para correrlas en tu
computadora necesitas [Node.js](https://nodejs.org) 20 o más reciente:

```bash
npm install
npm test               # funciones (montos, tasas, cuotas, grados…) + la app completa en el navegador
npm run test:reglas    # reglas de Firestore en el emulador oficial (necesita Java 21)
npm run revisar        # formato (Prettier) y errores comunes (ESLint)
npm run formato        # corrige el formato automáticamente
```

| Prueba                   | Qué comprueba                                                                                                                                              |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/unidad/`          | Cálculos de dinero (tasa BCV, Bs., cuotas, mora, recargos), formatos, grados, escape de HTML y que `index.html` cargue todo en orden.                      |
| `tests/e2e/app.test.js`  | Abre la app en Chromium con una **base de datos falsa**, entra con cada rol y recorre todas las pestañas, cobros, pagos, notas, importación e impresiones. |
| `tests/e2e/seguridad.js` | Llena los datos con HTML malicioso y verifica que nada se ejecute en ninguna pantalla ni impresión.                                                        |
| `tests/reglas/`          | Qué puede leer, crear, editar y borrar cada rol, según `firestore.rules`.                                                                                  |

Las pruebas **nunca tocan los datos reales**: usan una base de datos falsa en memoria o el emulador de
Firebase.

**Para reorganizar código** sin cambiar lo que hace la app, existe una comparación paso a paso:

```bash
npm run recorrido -- antes.json      # con la versión anterior
npm run recorrido -- despues.json    # con tus cambios
npm run comparar -- antes.json despues.json
```

---

## Respaldos

- **⚙️ Configuración → Año escolar → Descargar respaldo** baja un archivo `.json` con estudiantes, pagos,
  finanzas, nómina y notas del año que estás viendo. Hazlo con frecuencia y guárdalo fuera de la
  computadora (Drive, correo, pendrive).
- Al **cerrar el año escolar** se descarga un respaldo automático antes de cambiar nada.
- Firebase también permite exportaciones programadas desde la consola de Google Cloud (plan Blaze).

---

## Problemas comunes

| Síntoma                                                 | Causa probable y solución                                                                                                             |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Pantalla en blanco o «Iniciando sistema…» que no avanza | Falta un archivo de `js/` o `css/` en el sitio publicado. Sube todas las carpetas. En el navegador, F12 → Consola muestra cuál falta. |
| «Missing or insufficient permissions»                   | Las reglas de Firestore no coinciden con el rol o el correo. Revisa `ROLES` y `firestore.rules`, y vuelve a publicar las reglas.      |
| «Usuario no autorizado o desactivado»                   | El correo no está en `ROLES` y no tiene perfil de docente activo. El director debe crearlo o reactivarlo en Configuración → Docentes. |
| Los pagos salen sin bolívares                           | Falta la tasa BCV del día: botón 💱 de la cabecera.                                                                                   |
| Cambié algo y en otra computadora sigue igual           | El navegador guardó la versión anterior. Recarga con Ctrl+Shift+R (o borra la caché).                                                 |
