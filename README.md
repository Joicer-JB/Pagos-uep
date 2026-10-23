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

| Pestaña                                                                           | Director | Administradora |     Docente     |
| --------------------------------------------------------------------------------- | :------: | :------------: | :-------------: |
| 🏠 Inicio (director: resumen del mes y quincenal; administradora: lo cobrado hoy) |    ✅    |       ✅       |                 |
| 💳 Caja (cobro rápido, cierre de caja)                                            |    ✅    |       ✅       |                 |
| 💰 Pagos (registro y recibos)                                                     |    ✅    |       ✅       |                 |
| 🔔 Cobranza (por cobrar, recordatorios por WhatsApp)                              |    ✅    |                |                 |
| 👨‍🎓 Estudiantes (y exoneraciones)                                                  |    ✅    |                |                 |
| 📒 Finanzas (ingresos, gastos, flujo de caja)                                     |    ✅    |                |                 |
| 👷 Nómina                                                                         |    ✅    |                |                 |
| 📊 Reportes (con el flujo proyectado) y 📈 Gráficas                               |    ✅    |                |                 |
| 📝 Notas y boletines                                                              |    ✅    |                | ✅ (solo Notas) |
| 📥 Importar matrícula desde Excel                                                 |    ✅    |                |                 |
| ⚙️ Configuración (docentes, materias, año escolar…)                               |    ✅    |                |                 |
| 🗑️ Borrar pagos, estudiantes, gastos o trabajadores                               |    ✅    |                |                 |

**Quién es quién:**

- **Director** y **administradora**: se reconocen por su correo, en la lista `ROLES` de
  [`js/config.js`](js/config.js).
- **Docentes**: el director los crea en ⚙️ Configuración → Docentes. Cada uno queda con un perfil en la
  colección `usuarios` de Firestore. El correo fijo `notasjjs@gmail.com` también entra como docente.

**Moneda:** todos los montos se guardan en **$ de referencia**. Cada pago y cada gasto guarda además la
**tasa BCV** de su día y su valor en bolívares. La tasa del día se carga con el botón 💱 de la cabecera.

**Recibos:** se numeran en orden (`FAC-000001`, `FAC-000002`…) con un contador en Firestore, así dos equipos
que cobran al mismo tiempo nunca reciben el mismo número. Los recibos de antes de este cambio conservan su
número anterior (`FAC-` + 7 cifras).

**Varios equipos a la vez:** pagos, estudiantes y finanzas se actualizan solos en todas las pantallas
abiertas. Si alguien cobra en otra computadora, la tuya lo muestra sin recargar; si estabas llenando un
formulario, aparece el aviso «🔄 Hay cambios nuevos» para actualizar cuando termines.

---

## Cómo está organizado el código

No hay que instalar ni compilar nada. Son archivos HTML, CSS y JavaScript que el navegador carga tal cual.

```
index.html                 La página: carga los estilos y los scripts en orden
css/estilos.css            Todos los estilos de pantalla
css/animaciones.css        Animaciones y transiciones (se apagan con «reducir movimiento»)
css/diseno.css             Capa de diseño: sombras, botones, campos, ventanas tipo app en el teléfono (misma paleta)
assets/logo.png            Logo (para el README y el ícono de la pestaña)
js/
  logo.js                  Logo en base64 (para recibos y constancias impresas)
  config.js                ⚙️ Datos del colegio, ROLES, Firebase y App Check  ← lo que más se edita
  estado.js                Variables globales: sesión, datos cargados, pestaña y filtros
  interfaz.js              Cabecera, pestañas, modales, mensajes de error y avisos
  animaciones.js           Animaciones (pestañas, ventanas y «¡Pago realizado con éxito!»)
  utils/
    formato.js             Montos ($ y Bs.), números venezolanos (1.234,56) y fechas
    texto.js               escHtml/escJs (seguridad), acentos, correos y teléfonos de Venezuela
    impresion.js           Ventana para imprimir (en el teléfono, encima de la app con «Volver»)
    grados.js              Grados (Maternal → 5to Año), niveles y áreas
  servicios/
    auth.js                Inicio y cierre de sesión, roles
    datos.js               Carga de datos desde Firestore
    tiempo-real.js         Mantiene pagos, estudiantes y finanzas al día entre varios equipos
    fichas-docentes.js     Fichas de estudiantes sin datos privados para los docentes (se mantienen solas)
    tasa-bcv.js            Tasa BCV, conversión $ ↔ Bs. e importación del Excel de tasas del BCV
    cuotas.js              Mora automática: cuotas mensuales, recargos y deuda de cada estudiante
    indicadores.js         Tablero financiero: cobranza por mes, antigüedad de la deuda, proyección y equilibrio
    nomina-calculo.js      Nómina: quincenas o mes, horas de clase, lo que corresponde, adelantos y préstamos
    documentos-personal.js Documentos del personal (certificado de salud, título…) guardados en Firestore
    conciliacion.js        Referencias de pago repetidas y conciliación con el estado de cuenta del banco
    contabilidad.js        Libro de ingresos y egresos y cuentas por pagar
    proyeccion.js          Flujo de caja proyectado mes a mes hasta el próximo año escolar
    resumen-quincenal.js   Resumen de cada quincena para el director (deudores, al día, entradas y salidas)
    respaldo.js            Abrir (descifrar) los respaldos automáticos semanales
    avisos-telefono.js     Activar los avisos al teléfono en cada equipo (solo el director)
    cobros.js              Guarda cada cobro en una transacción: recibo correlativo y deuda anterior al día;
                           sin internet, recibo provisional que luego recibe su número
    bitacora.js            Quién registró cada pago y bitácora de lo que se borra (la ve el director)
    conexion.js            Trabajo sin internet: escrituras sin esperar al servidor y aviso de conexión
    app-instalable.js      Registra sw.js y muestra el botón «📲 Instalar»
  vistas/                  Una pantalla por archivo
    dashboard.js  caja.js  pagos.js (+ pagos-lote.js: ⚡ pagos viejos)  cobranza.js  estudiantes.js  finanzas.js
    nomina.js (pantalla) + nomina-recibos.js, nomina-trabajador.js, nomina-constancia.js,
      nomina-pagos.js y nomina-asistencia.js
    reportes.js  graficas.js  notas.js  boletin.js  configuracion.js  anio-escolar.js
    promocion.js  importar.js  duplicados.js  buscador.js (🔍 buscador inteligente)
  app.js                   Arranque: si ya hay una sesión abierta, entra directo
sw.js                      Service worker: guarda la app para abrirla sin internet (app instalable)
manifest.webmanifest       Nombre, colores e íconos de la app instalada (íconos en assets/iconos/)
firestore.rules            Reglas de seguridad de la base de datos (ver abajo)
herramientas/nube/         Lo que corre GitHub Actions con la cuenta de servicio: respaldo semanal (respaldo.js) y
                           avisos al teléfono (avisos.js), con el mismo código de js/ (app-en-node.js)
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

La app es un sitio estático publicado con **GitHub Pages**.

**Recomendado — publicar solo si pasan las pruebas.** En GitHub: **Settings → Pages → Build and
deployment → Source: «GitHub Actions»**. Desde entonces, cada cambio en `main` se publica únicamente
cuando todas las pruebas automáticas salen bien, y solo se publican los archivos de la app (`index.html`,
`css/`, `js/`, `assets/`), sin pruebas ni herramientas. Mientras esté en «Deploy from a branch», GitHub
publica cualquier cambio de inmediato, aunque esté roto.

Si usas otro hospedaje (Firebase Hosting, Netlify…), sube `index.html`, `css/`, `js/` y `assets/`.

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
- **Administradora:** solo cobra. Lee estudiantes y pagos, registra pagos (y al cobrar baja la deuda anterior del
  estudiante: solo esos campos, solo hacia abajo y con el recibo de ese cobro) y carga la tasa BCV de un día que no
  la tenga. No registra ni edita estudiantes (ni sus exoneraciones), no lee ni escribe finanzas, nómina, cuentas por
  pagar, asistencia, documentos del personal ni notas, no borra nada ni cambia la configuración.
- **Docente:** lee las **fichas** de los estudiantes (`estudiantes_docentes`: nombre, cédula, fecha de
  nacimiento, grado, sección, año escolar y representante) y la configuración, y carga notas. **No** lee la
  colección `estudiantes` (teléfonos, correo, deuda, mensualidad, observaciones médicas), ni pagos, finanzas o
  nómina. Si el director lo desactiva, pierde el acceso.
- **Fichas de docentes** (`estudiantes_docentes`): las escribe la app del director, sola, al entrar y cada vez que cambia un estudiante. Las reglas solo aceptan los campos de la ficha.
- **Un pago ya registrado no se puede modificar**, ni siquiera por el director. Solo el director puede
  borrarlo. Lo mismo un **ingreso o gasto** de Finanzas.
- **Auditoría:** cada pago e ingreso/gasto nuevo debe llevar la firma de quien lo registra (`registradoPor`, su
  propio correo). Borrar un pago, un ingreso/gasto o un estudiante exige dejar, en la misma escritura, su copia en
  la `bitacora`, que solo lee el director y nadie puede cambiar ni borrar.
- **Recibos cobrados sin internet** (`pendiente: true`, número `PROV-…`): lo único que se les puede cambiar es
  ponerles su número correlativo, en la misma transacción que avanza el contador.
- **Documentos del personal** (`documentos_trabajadores`: certificado de salud, título, cédula…): solo el director
  los adjunta, ve y quita; nadie los modifica. Hasta que publiques las reglas nuevas, al adjuntar
  un documento sale «Missing or insufficient permissions».
- **Cuentas por pagar** (`cuentas_pagar`) y **asistencia del personal** (`asistencia_personal`, un documento por
  día): solo el director. Sin las reglas nuevas, la lista de cuentas por pagar sale vacía y la
  asistencia no se puede guardar.
- **Contador de recibos** (`config/contadores`): director y administradora lo avanzan al cobrar, solo de
  1 en 1. Mientras no publiques las reglas nuevas, la app sigue cobrando con la numeración anterior.

### Cómo publicarlas (cada vez que cambie `firestore.rules`)

1. Entra a [console.firebase.google.com](https://console.firebase.google.com) → proyecto **pagos-jjs**.
2. Menú izquierdo → **Firestore Database** → pestaña **Reglas**.
3. Borra todo el texto, pega el contenido completo de `firestore.rules` y pulsa **Publicar**.

Si cambias un correo en `ROLES` (`js/config.js`), cambia también el mismo correo en `firestore.rules`.
Si no coinciden, esa persona entra a la app pero no puede ver ni guardar nada.

---

## Configuración

Todo está en [`js/config.js`](js/config.js):

| Qué                                   | Dónde                                     |
| ------------------------------------- | ----------------------------------------- |
| Nombre y ubicación del colegio        | `EMPRESA`, `EMPRESA_SUB`                  |
| Correos del director y administradora | `ROLES` (y también en `firestore.rules`)  |
| Materias por defecto y lapsos         | `MATERIAS`, `LAPSOS`                      |
| Proyecto de Firebase                  | `firebase.initializeApp({...})`           |
| App Check (reCAPTCHA)                 | `APP_CHECK_CLAVE` (ver docs/app-check.md) |

Lo demás (materias de cada año, indicadores, datos de la institución, cuotas y recargos, año escolar,
docentes) se configura desde la propia app, en ⚙️ Configuración.

La configuración de Firebase y la clave del sitio de reCAPTCHA son **públicas por diseño**: viajan al navegador
de todos los usuarios, así que no son secretas. La seguridad la dan las reglas de Firestore y App Check.

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

| Prueba                          | Qué comprueba                                                                                                                                              |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/unidad/`                 | Cálculos de dinero (tasa BCV, Bs., cuotas, mora, recargos), formatos, grados, escape de HTML y que `index.html` cargue todo en orden.                      |
| `tests/e2e/app.test.js`         | Abre la app en Chromium con una **base de datos falsa**, entra con cada rol y recorre todas las pestañas, cobros, pagos, notas, importación e impresiones. |
| `tests/e2e/seguridad.js`        | Llena los datos con HTML malicioso y verifica que nada se ejecute en ninguna pantalla ni impresión.                                                        |
| `tests/e2e/cobros.test.js`      | Recibos correlativos, deuda leída al momento de cobrar, devolución de la deuda al borrar un recibo y recordatorio de respaldo.                             |
| `tests/e2e/tiempo-real.test.js` | Lo que registra «otro equipo» aparece solo, sin interrumpir a quien está escribiendo.                                                                      |
| `tests/e2e/duplicados.test.js`  | Limpieza de estudiantes repetidos: no se pierden pagos, notas ni datos.                                                                                    |
| `tests/reglas/`                 | Qué puede leer, crear, editar y borrar cada rol, según `firestore.rules`.                                                                                  |

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
- Si pasan **más de 14 días** sin respaldo, al director le aparece un aviso en 🏠 Inicio con el botón para
  descargarlo.
- Al **cerrar el año escolar** se descarga un respaldo automático antes de cambiar nada.
- **Respaldo automático cada viernes a las 5:00 pm** (GitHub Actions, `.github/workflows/respaldo.yml`): copia
  completa y cifrada de toda la base de datos, guardada 90 días. Se activa una vez con dos secretos de GitHub; ver
  [docs/respaldo-automatico.md](docs/respaldo-automatico.md).

---

## Problemas comunes

| Síntoma                                                       | Causa probable y solución                                                                                                                            |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pantalla en blanco o «Iniciando sistema…» que no avanza       | Falta un archivo de `js/` o `css/` en el sitio publicado. Sube todas las carpetas. En el navegador, F12 → Consola muestra cuál falta.                |
| «Missing or insufficient permissions»                         | Las reglas de Firestore no coinciden con el rol o el correo. Revisa `ROLES` y `firestore.rules`, y vuelve a publicar las reglas.                     |
| «Usuario no autorizado o desactivado»                         | El correo no está en `ROLES` y no tiene perfil de docente activo. El director debe crearlo o reactivarlo en Configuración → Docentes.                |
| Los pagos salen sin bolívares                                 | Falta la tasa BCV del día: botón 💱 de la cabecera.                                                                                                  |
| Cambié algo y en otra computadora sigue igual                 | El navegador guardó la versión anterior. Recarga con Ctrl+Shift+R (o borra la caché).                                                                |
| Al cobrar o borrar sale «Missing or insufficient permissions» | Ese equipo tiene abierta una versión vieja de la app: recárgala (Ctrl+F5). Si sigue, revisa que las reglas publicadas sean las de `firestore.rules`. |
| Un docente ve «La lista de estudiantes todavía no está lista» | Las fichas se preparan cuando entra el director o la administradora: que uno de los dos entre una vez y el docente vuelva a entrar.                  |
| Los recibos siguen saliendo con 7 cifras (FAC-1234567)        | Faltan publicar las reglas nuevas de Firestore (contador de recibos). Ver [Reglas de Firestore](#reglas-de-firestore-seguridad).                     |
