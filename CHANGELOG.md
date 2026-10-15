# Historial de cambios

## Octubre 2026 — Estructura de costos: inscripción y carnet obligatorios

- En 🔔 Cobranza → ⚙️ Cuotas del año, el director guarda la **estructura de costos del año**: inscripción y
  mensualidad de Inicial (tiempo completo y medio tiempo), Primaria y Media general, más **carnet QR** y
  **papelería**. Viene llena con los montos de 2026-2027 (45/45, 40/40, 45/45, 55/55, carnet 13 y papelería 3).
- Al guardarla, ofrece poner a cada estudiante la mensualidad de su nivel.
- La **inscripción** y el **carnet + papelería** son obligatorios una vez por año: si faltan, son deuda (Caja,
  Cobranza, ficha) y en la **💳 Caja aparecen ya marcados** junto con las mensualidades vencidas (o la primera, al
  empezar el año), en un solo recibo. Cuentan los pagos desde 3 meses antes de la primera cuota (vacaciones).
- Ficha del estudiante: **horario** para inicial (tiempo completo / medio tiempo), casilla **«No paga
  inscripción»** y la mensualidad sugerida según la estructura.
- Sin estructura guardada todo funciona como antes.

## Octubre 2026 — Imprimir y compartir en el teléfono

- «🖨️ Imprimir» se lanza directo desde el toque. Si el teléfono no abre la impresión (por ejemplo, el iPhone con la
  app instalada), aparece un aviso que sugiere **«📤 Compartir»**: convierte el documento en una imagen para
  enviarla por WhatsApp o imprimirla desde la galería (en la computadora, se descarga).
- En el teléfono la cabecera ya no se sale de la pantalla (el nombre arriba; tasa, año y «Salir» debajo), y el
  recibo se ajusta a pantallas angostas.

## Octubre 2026 — Imprimir en el teléfono

- En el teléfono (y en la app instalada), recibos, cierres, boletines y reportes ya no se abren en una ventana nueva
  sin salida: se muestran encima de la app con **«← Volver»** y **«🖨️ Imprimir / PDF»**. El botón «atrás» del
  teléfono también los cierra. En la computadora se siguen abriendo en una ventana aparte.

## Octubre 2026 — Abonos a un mes

- En la 💳 Caja, al abonar a la mensualidad se elige **«¿A qué mes abona?»** (con lo que se debe de cada mes). El
  abono se resta de ese mes y le queda el saldo pendiente; el recibo dice «Abono a la mensualidad de Diciembre 2026»
  (o «Mensualidad …» si lo completa). Antes siempre se descontaba del mes más antiguo y el recibo no decía de cuál.
- Con los demás conceptos se puede escribir **«¿Para qué es?»** (obligatorio con «Otro»).
- En 💰 Pagos, «Mes que cancela» también descuenta de ese mes. Los pagos viejos no cambian.
- Cada pago de mensualidad guarda a qué meses fue (`cuotas`); lo que pase de lo que se debe de ese mes va al más
  antiguo.
- El recibo impreso dice «Firma Representante».

## Octubre 2026 — Recibo impreso

- En el recibo impreso, **Recibo, Método y Fecha** quedan en tres columnas separadas (antes salían pegados) y la
  fecha sale como dd/mm/aaaa. Los colores también se imprimen.
- «Cliente» pasa a **«Estudiante»** (recibo en pantalla, impreso y por WhatsApp) y la firma dice **«Firma
  Administrador»**. En el flujo de caja impreso, «Administradora» pasa a **«Administrador»**.

## Octubre 2026 — Auditoría, app instalable y trabajo sin internet

### Auditoría

- Cada pago y cada ingreso o gasto guarda **quién lo registró** (su correo). Se ve en la lista de pagos (👤), en el
  recibo en pantalla y en el detalle de ingresos y gastos.
- **Bitácora de borrados** (⚙️ Configuración → 🕵️ Bitácora, solo el director): al borrar un recibo, un ingreso o
  gasto, o un estudiante (también al unir fichas repetidas), queda una copia con quién lo borró y cuándo. Se
  escribe junto con el borrado y las reglas no permiten borrar sin ella; nadie puede cambiarla.

### App instalable

- La plataforma se puede **instalar** en el teléfono o la computadora (botón **📲 Instalar**, o «Agregar a inicio»
  en iPhone): ícono con el escudo del colegio y pantalla completa.
- Un service worker (`sw.js`) guarda la app y sus bibliotecas para abrirla sin internet. Siempre pide primero la
  versión nueva, así las actualizaciones llegan solas.

### Sin internet

- Firestore guarda una copia de los datos en el equipo; lo que se hace sin conexión se sube solo al volver.
- **Se puede cobrar sin internet:** el recibo sale con número provisional (`PROV-…`) y, al volver la conexión,
  recibe solo su número correlativo (`FAC-…`), en orden. Aviso abajo: «📴 Sin internet» → «🔄 Subiendo…» →
  «✅ Todo está al día».
- Los formularios ya no se quedan «guardando» sin conexión.
- **Requiere publicar las reglas nuevas** (firma de quien registra, bitácora y numeración de recibos pendientes).

## Octubre 2026 — SheetJS 0.20.3

- La biblioteca de Excel (importar estudiantes y tasas, plantilla de matrícula) pasa de la 0.18.5 a la **0.20.3**,
  que corrige dos fallas de seguridad al leer archivos (CVE-2023-30533 y CVE-2024-22363). SheetJS ya no publica
  en npm; se usa la copia `@e965/xlsx@0.20.3`, servida por jsDelivr con versión exacta y huella (SRI).

## Octubre 2026 — Privacidad de los estudiantes y tasas del BCV desde Excel

### Privacidad

- **Los docentes ya no leen los datos privados de los estudiantes.** Antes podían leer la ficha completa
  (teléfonos y correo del representante, deuda, mensualidad, observaciones médicas). Ahora leen
  `estudiantes_docentes`, una ficha con solo nombre, cédula, fecha de nacimiento, grado, sección, año escolar y
  representante (lo que necesitan para cargar notas e imprimir el boletín).
- Las fichas las mantiene la app del director y de la administradora, sola: al entrar crea las que faltan, y
  cada vez que cambia un estudiante (aquí o en otro equipo) actualiza solo la suya. Un cambio de teléfono o de
  deuda no escribe nada en las fichas.
- **Requiere publicar las reglas nuevas.** Mientras tanto todo sigue funcionando como antes: el docente usa la
  lista completa y la app del director no muestra errores.

### Tasas BCV de días anteriores

- En la ventana 💱 **Tasa BCV** hay una sección nueva, **📥 Tasas de días anteriores**: se sube el Excel del BCV
  («Tipo de cambio de referencia», una hoja por día) y se cargan de una vez todas las tasas de ese periodo.
  Antes de guardar muestra cuáles son nuevas, iguales o distintas a las guardadas; las distintas solo se
  reemplazan si se pide. También acepta una tabla sencilla de fecha y tasa.

## Octubre 2026 — Correcciones de la auditoría

### Dinero

- **Los pagos ya no se mezclan entre estudiantes.** Antes, si dos estudiantes se llamaban igual (o eran hermanos
  registrados con la misma cédula), el pago de uno contaba como pagado para el otro y al segundo nunca se le
  cobraba. Ahora un pago con el id del estudiante cuenta solo para él; el nombre o la cédula solo se usan para
  los pagos viejos que no tienen id. La ficha del estudiante también muestra solo sus pagos.
- **Recibos correlativos** (`FAC-000001`, `FAC-000002`…): antes salían de la hora (`FAC-` + 7 cifras) y podían
  repetirse (≈36 % de probabilidad con 3.000 recibos al año). Requiere publicar las reglas nuevas; mientras
  tanto se sigue usando la numeración anterior.
- **Cada cobro se guarda en una sola transacción**: el pago, el número de recibo y el descuento de la «deuda
  anterior» van juntos o no va nada, y la deuda se lee de la base de datos en ese momento (si otro equipo ya
  cobró, no se sobrescribe con un valor viejo).
- **Borrar un recibo devuelve la deuda anterior** que ese pago había descontado (para los recibos nuevos).

### Animaciones

- Al registrar un pago (Caja, Pagos o Nómina) aparece un chulito (✓) animado: **«¡Pago realizado con éxito!»** con
  el monto y el número de recibo. No bloquea la pantalla y se quita solo a los 2 segundos.
- Las pestañas aparecen con sus tarjetas escalonadas, las ventanas suben suavemente, los botones responden al
  tocarlos, las tarjetas del Inicio se elevan al pasar el mouse y el «Cargando…» tiene un indicador que gira.
- Si el teléfono o la computadora tiene activado «reducir movimiento» (accesibilidad), todo se muestra sin
  animación. Archivos: `js/animaciones.js` y `css/animaciones.css`.

### Pagos con fecha pasada y tasa BCV

- Al elegir la fecha en Pagos, Finanzas o Nómina se carga la tasa guardada de ese día (o la del último día con
  tasa, con aviso). Si se escribe otra, el registro usa la escrita y aparece la opción **«Corregir también la
  tasa guardada de ese día (para todos)»**.
- Una fecha de un año escolar anterior pide confirmación (no aparecerá en las listas del año actual) y no se
  aceptan fechas futuras.

### Varios equipos a la vez

- **Tiempo real**: pagos, estudiantes y finanzas del año actual se actualizan solos en todas las pantallas
  abiertas. Si alguien está llenando un formulario, en vez de redibujar aparece «🔄 Hay cambios nuevos».

### Duplicados

- Al eliminar una copia ya **no se pierden sus notas** (pasan a la ficha que se conserva), ni la
  **exoneración del recargo**, ni el **historial de grados**. Los pagos registrados con el id de la copia
  siguen contando para la ficha conservada (campo `fusionados`).
- Si las dos fichas tienen una deuda anotada a mano, el grupo deja de ser «seguro» y se avisa: el director
  decide si es la misma deuda o hay que sumarla.

### Seguridad y operación

- EmailJS, SheetJS y Chart.js se cargan desde jsDelivr con **versión exacta y huella de integridad** (SRI): si
  el archivo del CDN fuera alterado, el navegador no lo ejecuta. Antes EmailJS usaba `@4` (cambiaba solo).
- Aviso en Inicio para el director si pasan más de 14 días sin descargar un respaldo.
- **GitHub Actions**: límite de tiempo en cada trabajo (las pruebas se colgaron 6 horas descargando
  paquetes de Ubuntu), pruebas del navegador dentro de la imagen oficial de Playwright y publicación en
  GitHub Pages **solo si todas las pruebas pasan** (hay que activarlo en Settings → Pages).
- Reglas de Firestore: contador de recibos `config/contadores` (solo avanza de 1 en 1).
- Pruebas nuevas: 9 de funciones, 15 en el navegador y 2 de reglas.

## Octubre 2026 — Limpieza de estudiantes repetidos

- Nuevo aviso en Estudiantes (solo director) que detecta fichas repetidas aunque el nombre esté con el apellido
  primero, con coma, sin tildes o en mayúsculas, o con la misma cédula, y permite eliminar las copias en bloque
  (`js/vistas/duplicados.js`). Copia a la ficha conservada los datos que le faltaban, descarga un respaldo antes
  y no borra fichas con pagos que se perderían.
- El importador de Excel ahora también reconoce como repetido a un estudiante cuyo nombre viene con el
  apellido primero o con coma (antes solo comparaba tildes y mayúsculas).
- Pruebas nuevas: 16 de funciones y 6 en el navegador.

## Octubre 2026 — Reorganización, seguridad y pruebas

### Organización del código

- El `index.html` de 5.200 líneas se separó en `css/estilos.css` y 28 archivos en `js/`, uno por
  pantalla o tema. La app funciona exactamente igual: se verificó pantalla por pantalla.
- Formato uniforme (Prettier), comentarios en español en las funciones clave y listas de grados y
  áreas en un solo lugar.

### Seguridad

- **Los datos escritos por usuarios ya no pueden ejecutar código.** Antes, un nombre o una descripción
  con HTML (por ejemplo, de un Excel importado o de una nota cargada por un docente) se ejecutaba en la
  sesión de quien lo viera, incluidas las impresiones. Ahora todo se escapa con `escHtml`/`escJs`.
- `firestore.rules` en el repositorio, con dos mejoras sobre las reglas anteriores:
  - Solo el director puede borrar estudiantes, pagos, finanzas y trabajadores.
  - Un pago registrado no se puede modificar.

  **Hay que publicarlas en la consola de Firebase** (ver README).

### Correcciones

- La administradora y los docentes veían la lista de materias por defecto y ningún indicador: la
  configuración solo se cargaba para el director.
- Al iniciar sesión todos los datos se descargaban dos veces.
- El mensaje «Usuario no autorizado» desaparecía al instante.
- Un nombre con apóstrofo (`D'Angelo`) rompía el botón «Registrar pago» de la ficha del estudiante.
- Los docentes entraban a la pantalla de Inicio (con datos de mora) en vez de Notas. Además, cualquier
  usuario podía heredar la pestaña del anterior en el mismo equipo.

### Nuevo

- Pruebas automáticas: 39 de funciones, 15 de la app completa en el navegador y 10 de las reglas de
  Firestore. Corren solas en GitHub en cada cambio.
- `npm run servir` para probar la app en la computadora.
- Ícono del colegio en la pestaña del navegador.
- Documentación: README, guías por rol y guía para hacer cambios.
