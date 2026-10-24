# Historial de cambios

## Octubre 2026 — Las notas las carga control de estudio

- **Media General:** por ahora control de estudio carga **la nota final de cada lapso** en cada materia (la que entrega
  el profesor), una casilla por materia (se guarda en `<materia>_lapso`). El plan de evaluación, las evaluaciones y el
  «detalle por materia» de la sábana quedan apagados (`NOTAS_DETALLADAS = false` en `js/config.js`) hasta que los
  profesores carguen sus notas detalladas.
- **⚙️ Config → 👨‍🏫 Docentes:** casilla **🗂️ Control de estudio**: esa cuenta ve todos los grados y carga todas las
  notas.

## Octubre 2026 — Cada profesor con lo suyo

- **Notas:** cada docente ve a los estudiantes de sus grados. En Inicial y Primaria (un docente por grado) carga todas
  las áreas de su grado; en Media General (un profesor por materia) carga solo sus materias y su plan de evaluación, y
  las de otros profesores salen en gris. El director ve y hace todo.
- Al guardar notas solo viaja lo que se cambió: dos profesores que cargan al mismo estudiante ya no se pisan las notas.
- **Sábana:** debajo de cada materia, el profesor que la da.
- **Boletín:** firma el docente del grado (Inicial y Primaria) o el **profesor guía** del año (Media General), que se
  anota en ⚙️ Configuración → 🏫 Institución.
- **Cuadro de honor:** los mejores de **cada salón** (año y sección): el mejor, o los 3, 5 o 10 mejores.

## Octubre 2026 — Coordinadora de Educación Inicial

- ⚙️ Configuración → 🏫 Institución: campo para la **coordinadora de Educación Inicial**. Cada boletín firma la
  coordinadora de su nivel (Media General, Primaria o Inicial).

## Octubre 2026 — 🏆 Cuadro de honor y matrícula por grado

- **Boletín nuevo para los representantes:** con el escudo del colegio (arriba y de marca de agua), la ficha del
  estudiante, un resumen (promedio general, materias aprobadas y promedio de cada lapso) y las notas con una barra en
  la definitiva. En una sola hoja carta. En primaria, una sola tabla con el literal de cada indicador en los 3 lapsos
  (antes los literales no salían en el boletín). **🖨️ Boletines de todo un grado** de una vez (📝 Notas → filtrar por
  grado).
- **📝 Notas → 🏆 Cuadro de honor** (media general), por lapso o del año: el **año con mejor promedio**, los 10 mejores
  promedios de toda media general y los 3 mejores de cada año. Solo entra quien tiene nota en todas sus materias y,
  por defecto, sin materias reprobadas. Los empatados comparten el puesto. Se imprime.
- **👨‍🎓 Estudiantes:** el recuadro «Total» (que contaba a los retirados) ahora es **🎒 Inscritos**, y la tabla
  **📊 Matrícula por grado** muestra inscritos (niñas y niños), retirados y graduados de cada grado.
- **Orden alfabético** en Estudiantes, Notas, la sábana y la Caja (sin importar tildes ni mayúsculas).

## Octubre 2026 — 📋 Sábana de notas (media general)

- **📝 Notas → 📋 Sábana de notas:** todas las notas de un año (o sección) en una tabla, para el consejo de sección
  con los docentes: por materia 1er, 2do y 3er lapso y definitiva, y el promedio del estudiante; o un lapso; o el
  **detalle por materia** con cada evaluación que puso el profesor. Promedio de la sección y reprobados por columna.
  Se imprime en hoja horizontal y se descarga en Excel. Al tocar un estudiante, todas sus evaluaciones.
- **Plan de evaluación** por materia y lapso (⚙️ junto a cada materia): las evaluaciones que haga cada profesor, con
  nombre y porcentaje (deben sumar 100%). Sin plan, siguen siendo 3 evaluaciones que valen igual. Las notas siguen
  con un decimal.
- **Cambios por decisión del consejo (solo el director):** se toca la nota de un lapso o la definitiva, con el
  motivo y el acta. Queda la nota original, quién y cuándo; la definitiva, la nota final y el boletín usan la nota
  nueva. Los cálculos de Notas, la sábana y el boletín están ahora en un solo lugar (`js/servicios/calificaciones.js`).
- **Reglas de Firestore:** los docentes ya no pueden poner ni tocar los cambios del consejo (campo `consejo` de
  `notas`). **Hay que publicar las reglas.**

## Octubre 2026 — App Check y avisos listos

- **App Check encendido:** la plataforma se identifica ante Firebase con reCAPTCHA v3 (invisible). Falta que el
  director pulse **Aplicar** en Firebase → App Check → Cloud Firestore después de 1 o 2 días de uso
  (`docs/app-check.md`, paso 4).
- **Avisos al teléfono:** ya tiene la clave «Web Push»; se activan en ⚙️ Configuración → 📲 Avisos.

## Octubre 2026 — Entrar con Google y avisos al teléfono

- **Entrar con Google** en la pantalla de entrada, con las mismas cuentas (se reconocen por el correo). Con la
  verificación en 2 pasos de Gmail, nadie entra sin el teléfono. La sesión de la administradora con Google tampoco se
  recuerda en la PC compartida. Hay que activarlo en Firebase: `docs/entrar-con-google.md`.
- **📲 Avisos al teléfono** (solo el director, ⚙️ Configuración → 📲 Avisos): cierre del día (lunes a viernes, 6 pm),
  resumen de la quincena (el 1 y el 16, 7 am) y si el respaldo del viernes salió bien o falló, aunque la plataforma
  esté cerrada. Los manda GitHub Actions (`.github/workflows/avisos.yml`) con Firebase Cloud Messaging, calculados con
  el mismo código de la plataforma. Nueva colección `avisos_dispositivos`: **hay que publicar las reglas de Firestore**.
  Falta la clave «Web Push» de Firebase: `docs/avisos-telefono.md`.
- **Arreglo del respaldo automático:** firebase-admin 14 ya no trae `admin.firestore()`; el respaldo se habría caído en
  su primer viernes. Ahora usa las funciones nuevas (`firebase-admin/app`, `/firestore`, `/messaging`), y el respaldo y
  los avisos se prueban de verdad contra el emulador de Firestore (`tests/reglas/nube.test.js`).
- `herramientas/respaldo/` pasó a llamarse `herramientas/nube/` (respaldo y avisos).

## Octubre 2026 — 🔍 Buscador inteligente

- Botón **🔍 Buscar** en la cabecera, barra en Inicio, **Ctrl+K** o **/**. Encuentra estudiantes (nombre, cédula,
  teléfono o representante, con su deuda y botones para cobrar, ver su estado de cuenta o su ficha), recibos (número o
  referencia) y trabajadores. Lleva a cualquier acción («cierre de caja», «nuevo gasto», «pagos viejos»…), y
  responde preguntas: lo cobrado y gastado en un período, cómo vamos, quién debe (por grado), cuántos están al día,
  inscripciones pendientes, nómina, cuentas por pagar, tasa de un día y **qué hizo cada quien** (cobros, ingresos,
  gastos y borrados, con la hora). Cada rol ve solo lo suyo: la secretaria, lo de un día y sus pestañas.

## Octubre 2026 — Pagos viejos en lote, recaudo del día y diseño

- **⚡ Pagos viejos** (💰 Pagos): para ponerse al día con lo cobrado y no registrado (como las inscripciones de
  septiembre). Sale quién debe la inscripción (o la mensualidad de un mes); se marca a quienes pagaron, con su fecha,
  forma de pago y referencia (se repiten de uno al siguiente), y se registran todos: cada uno con su recibo y la tasa
  BCV de su fecha. Revisa tasas faltantes, montos de más y referencias repetidas; guarda lo marcado en el equipo
  hasta registrarlo y deja imprimir la lista de recibos.
- **Pagos:** el **recaudo total** solo lo ve el director; la administradora ve el **recaudo total de hoy** (monto,
  recibos y cada forma de pago).
- **Diseño** (los mismos colores): tarjetas y sombras más suaves, cifras alineadas, botones y campos más cómodos de
  tocar, subpestaña elegida resaltada, las ventanas suben desde abajo en el teléfono, la pestaña elegida queda a la
  vista, entrada con el escudo más grande y anillo de foco para usar con teclado (`css/diseno.css`).

## Octubre 2026 — Seguridad por roles, respaldo automático, flujo proyectado y resumen quincenal

- **La administradora solo cobra:** entra a 🏠 Inicio, 💳 Caja y 💰 Pagos. Su Inicio muestra lo cobrado hoy por
  método, quién debe (tocándolo se le cobra en la Caja) y los últimos pagos; no ve gastos, nómina ni el balance. No
  registra ni edita estudiantes, ni exoneraciones, ni corrige tasas ya guardadas (sí carga la de un día que no la
  tenga). Las **reglas de Firestore** lo exigen también: al cobrar, la deuda del estudiante solo puede bajar y con
  el recibo de ese cobro (`ultimoCobro`, `deudaCobro`); finanzas, nómina, cuentas por pagar, asistencia, documentos
  y notas son solo del director. **Un ingreso o gasto ya registrado no se modifica** (como los recibos). **Hay que
  publicar las reglas de Firestore.**
- **Computadora compartida (la de la administradora):** su sesión se cierra al cerrar el navegador y tras 30 minutos
  sin usarla, y al salir se borra la copia local de los datos. Sin internet no deja salir si hay cobros sin subir.
- **App Check** listo para activarse con la clave de reCAPTCHA (ver `docs/app-check.md`).
- **Se quitó EmailJS:** ya no se envían avisos ni recibos por correo (los recordatorios siguen por WhatsApp).
- **🔐 Respaldo automático cada viernes a las 5:00 pm** (GitHub Actions): copia completa y cifrada de la base de
  datos, guardada 90 días; se abre en Configuración → Año escolar con su clave. Ver `docs/respaldo-automatico.md`.
- **🔮 Flujo de caja proyectado** (Reportes): mes a mes hasta el próximo año escolar, con escenarios de cobranza,
  deuda atrasada que se recupera, nómina, gastos, cuentas por pagar, utilidades y bono vacacional; avisa el primer
  mes en que no alcanzaría. Se imprime.
- **🗓️ Resumen quincenal** (solo el director): el 1 y el 16 de cada mes aparece en Inicio cuántos deben o tienen
  mora, cuántos están al día, y lo que entró y salió en la quincena. Se imprime o se manda por WhatsApp; en Reportes
  está el de cualquier quincena.
- La pantalla de Nómina se dividió en seis archivos (`js/vistas/nomina*.js`), sin cambios en lo que hace.

## Octubre 2026 — Conciliación bancaria, cuentas por pagar, libro, asistencia y más

- **🏦 Conciliación bancaria** (Finanzas): se sube el estado de cuenta del banco (Excel o CSV) y se compara con los
  cobros por transferencia o pago móvil: conciliados, lo que entró y nadie registró (se registra desde ahí), montos
  distintos, lo registrado que no está en el banco y referencias repetidas. Se imprime. Acepta los formatos de los
  distintos bancos: Excel (también .xls en HTML), CSV y TXT; débito y crédito separados, monto con signo o con
  columna de tipo; fechas con el nombre del mes; referencia dentro de la descripción. Si se corrigen las columnas, la
  app recuerda el formato de ese banco.
- **Aviso de referencia repetida** al cobrar (Caja y Nuevo pago) si la referencia ya está en otro recibo del año.
  «Nuevo pago» pide y guarda la referencia.
- **🧾 Estado de cuenta del representante** (ficha del estudiante): cuotas, recibos y total a pagar hoy; impreso,
  como imagen o por WhatsApp.
- **🧾 Cuentas por pagar** (Finanzas): vencimientos, repetición mensual, «✓ Pagar» registra el gasto y aviso en
  Inicio. Nueva colección `cuentas_pagar`.
- **📒 Libro de ingresos y egresos** (Finanzas): mes o año, en $ y Bs., con saldo y resumen por categoría; Excel e
  impresión para el contador.
- **🧮 Simulador de mensualidad** (Reportes): aumento, cobranza, retiro y aumento de nómina → resultado del mes y
  mensualidad de equilibrio.
- **🗓️ Asistencia del personal** (Nómina): presente, retardo, falta, justificada o permiso, y horas de quien trabaja
  por horas; resumen e impresión del mes; al pagar la quincena se ve su asistencia. Nueva colección
  `asistencia_personal`. **Hay que publicar las reglas de Firestore.**

## Octubre 2026 — Constancia de trabajo

- En la ficha del trabajador, **📜 Constancia**: constancia de trabajo con membrete, firmada por la directora, con la
  fecha de ingreso, el cargo (y las clases que da, si se quiere) y el salario en bolívares a la tasa BCV del día y su
  equivalente en $, con el monto en letras. Se elige a quién va dirigida, el tratamiento, qué salario mostrar (o
  ninguno) y la moneda. Para quien ya no trabaja: «prestó sus servicios desde… hasta…».
- ⚙️ Configuración → Institución: **RIF del plantel** y **cédula de la directora**. La constancia de estudio ya no
  dice «R.I.F.: J-XXXXXXXXX-X»: pone el RIF guardado (o nada, si no está).

## Octubre 2026 — Nómina: horas de clase, datos del personal y documentos

- **Horas de clase:** cada trabajador puede tener sueldo fijo, horas de clase o las dos cosas (por ejemplo, la
  coordinadora de Primaria que también da clases en Media general). Cada nivel va con lo que vale su hora (Media
  general $ 2,50 y Primaria $ 2,00 por defecto, y se pueden cambiar por trabajador). Al pagar la quincena se
  escriben las horas que trabajó y el recibo muestra «Horas de Media general (18 h × $ 2,50)».
- **Datos del personal:** RIF, teléfono, títulos obtenidos, fecha de ingreso (con los años en la escuela) y hasta dos
  cuentas bancarias o pago móvil (el banco sale de los 4 primeros dígitos y se revisa el número). Al pagar se elige
  la cuenta y sale en el recibo. No se puede repetir la cédula de otro trabajador.
- **Documentos:** se adjuntan el certificado de salud (con su vencimiento), título, cédula, RIF u otro (foto o PDF
  de hasta 4 MB) para verlos o imprimirlos. Aviso de certificados vencidos o por vencer. **📄 Ficha** del
  trabajador para imprimir. Nueva colección `documentos_trabajadores`: **hay que publicar las reglas de Firestore**.
- **Clases que da cada docente:** grado (Inicial y Primaria), o materia, años, días y horario (Media general);
  Deporte o Inglés a todo el colegio. Nueva pestaña **📚 Clases** con cada grado y año, sus docentes y horarios, los
  choques de horario, los grados sin docente y las materias sin profesor; se puede imprimir.
- **Recibos de nómina «2 por hoja»** (original y copia), solo si se marca la casilla.
- La nómina del mes calcula lo que falta por los períodos que aún no se pagan (antes, una quincena con menos horas
  quedaba como deuda). El tablero financiero y los avisos por correo cuentan las horas de clase.

## Octubre 2026 — Recibo «2 por hoja» (original y copia)

- En el recibo de pago hay una casilla **🖨️ Imprimir 2 por hoja (original y copia)**. Solo si se marca, sale una
  hoja carta con el original arriba y la copia abajo, y una línea para cortar. Sin marcar, todo sigue igual. Cada
  equipo recuerda la elección.

## Octubre 2026 — Recibos impresos que gastan menos tinta

- El **recibo de pago** y los **recibos de nómina** (pago, adelanto y préstamo) se imprimen en «ahorro de tinta»:
  fondo blanco, letras oscuras y líneas finas, sin el encabezado ni el cuadro del total en azul oscuro (antes se
  obligaba a imprimir esos fondos). En pantalla el recibo sigue a color.

## Octubre 2026 — Nómina por quincenas, adelantos y préstamos

- **Pagar nómina** por **1ra quincena, 2da quincena o mes completo**: se llenan solos el salario y los bonos del
  período (la mitad en una quincena) y las **deducciones**: la deducción fija, los **adelantos** por descontar y la
  **cuota de cada préstamo** (se pueden cambiar o desmarcar). Avisa si ese período ya se pagó.
- **💸 Adelanto** a cuenta de una quincena (dice cuánto le corresponde y cuánto ya se le adelantó) y **🤝 Préstamo**
  con su cuota por pago: se descuentan solos al pagar, y la ficha del trabajador muestra lo que debe.
- **📅 Nómina del mes**: por trabajador, lo que gana, lo pagado, la quincena que falta y lo que debe, con el botón para
  pagar lo que sigue; arriba, la nómina del mes, lo pagado, lo que falta y el dinero entregado.
- Recibo único con **asignaciones, deducciones y neto**, y un **número fijo** (antes cambiaba en cada impresión); el
  recibo ya no tenía un nombre de directora escrito fijo. Recibos de adelanto y comprobante de préstamo.
- Ficha: salario y bonos **mensuales**, cómo se le paga (quincenal o mensual), nombre de la deducción fija y «Ya no
  trabaja aquí» (un trabajador con pagos ya no se puede borrar, para no perder su historial).
- Correcciones: en 📊 Reportes, «Total Gastos» sumaba la nómina dos veces (los pagos de nómina ya están en los gastos);
  el total de nómina del Inicio contaba al personal retirado; el tablero financiero ya no cuenta los préstamos al
  personal como gasto del colegio.

## Octubre 2026 — Perdonar el recargo de un mes

- En el estado de cuenta del estudiante, el director puede **🤝 Perdonar** el recargo por mora de un mes escribiendo el
  motivo. Queda anotado quién lo perdonó, cuándo y por qué, y se puede deshacer. Los demás meses se siguen cobrando.

## Octubre 2026 — Carnet y papelería para quienes no pagan inscripción

- Los estudiantes marcados «No paga inscripción» pagan solo **carnet y papelería** (con septiembre). Ahora la Caja,
  Nuevo pago, el recibo y la deuda lo llaman **«Carnet y papelería»** (antes decía «Inscripción») y el pago se guarda
  con ese concepto; el desglose de ingresos de 📒 Finanzas lo muestra aparte.
- En Nuevo pago el concepto se llama **«Inscripción / Carnet y papelería»**. Con «Mensualidad», si el estudiante aún
  debe la inscripción o el carnet y la papelería, avisa que el pago que los incluya debe ir con ese concepto.

## Octubre 2026 — Sin recargo en el primer mes pagado con la inscripción

- El primer mes (septiembre) pagado **el mismo día que la inscripción** ya no genera recargo por mora, aunque la
  inscripción sea después del día de vencimiento. Se corrige solo en los pagos ya registrados.
- En el estado de cuenta, junto a cada recargo dice cuándo se pagó ese mes.

## Octubre 2026 — Inscripción con septiembre aunque falte la estructura de costos

- En 💰 Pagos → Nuevo pago, la lista **«¿Qué paga con la inscripción?»** aparece también cuando la estructura de
  costos del año no está guardada (con un aviso): se escribe el total, los meses marcados (septiembre por defecto) se
  descuentan de su mes y lo demás queda como inscripción. Antes, sin la estructura, septiembre no se descontaba.
- Si el estudiante no tiene mensualidad en su ficha, la lista lo avisa.

## Octubre 2026 — Inscripción con meses desde 💰 Pagos

- En **💰 Pagos → Nuevo pago**, el concepto **«Inscripción»** muestra **«¿Qué paga con la inscripción?»**: la
  inscripción (con carnet y papelería) y los meses que se deben, para marcar los que se pagaron juntos (septiembre
  viene marcado). El total, la descripción y el mes se llenan solos, y **«Así se aplica»** muestra cómo se reparte
  cualquier monto (inscripción → meses marcados → adelanto). Sirve también para registrar pagos viejos.
- Se guarda como en la Caja: un pago de «Inscripción» y otro de «Mensualidad» (con el mes de cada parte) con el
  mismo recibo.

## Octubre 2026 — Pago mixto y tablero financiero

- **Pago mixto** en la 💳 Caja (**➗ Pago mixto**): un mismo cobro con dos o más formas de pago, por ejemplo 20 $ en
  efectivo y el resto por pago móvil. Cada forma lleva su monto (en $ o en Bs., según el método) y la última es el
  resto, que se calcula sola. Sale un solo recibo con el método «Mixto» y el detalle de cada forma (en pantalla,
  impreso y por WhatsApp). Se guarda un pago por concepto y forma con el mismo N° de recibo, así el cierre de caja
  cuadra cada método; las transferencias guardan los Bs. exactos que se recibieron.
- **🧮 Tablero financiero** en 📊 Reportes: índice de cobranza de lo vencido, cobranza por mes (inscripción y cada
  mes), antigüedad de la deuda por tramos de días con los 5 a cobrar primero, proyección del año y punto de
  equilibrio (costos del mes contra mensualidades, y cuántos estudiantes deben pagar para cubrirlos).

## Octubre 2026 — Caja: «¿Cuánto trae?» reparte el monto solo

- En la 💳 Caja, al escribir **cuánto trae** el representante, el monto se reparte solo en este orden:
  1. inscripción (con carnet, papelería y su primer mes), 2. deuda anterior, 3. mensualidades vencidas (de la más
     antigua a la más nueva), 4. recargos, 5. la mensualidad en curso. Si no alcanza para un concepto completo, queda
     como **abono** («abono $ 24 de $ 45») y el recibo lo dice; si sobra, va como **adelanto** del mes siguiente.
- Marcar o desmarcar a mano deja de repartir el monto.

## Octubre 2026 — Inscripción con septiembre desde 💰 Pagos

- Si un pago con concepto **«Inscripción»** trae más de lo que vale la inscripción (por ejemplo 106 $ = 61 de
  inscripción + 45 de septiembre), lo demás **paga el primer mes** (septiembre). Corrige también los pagos ya
  registrados así.
- En 💰 Pagos → Nuevo pago, al elegir «Inscripción» se llenan solos el monto del paquete, el mes y el desglose.

## Octubre 2026 — Corregir la fecha de inicio del año escolar

- En ⚙️ Configuración → 📅 Año escolar, **«✏️ Corregir la fecha de inicio»** (director): cambia el inicio del año
  actual y pone el fin del año anterior el día antes, para que los pagos y gastos de esos días cuenten en el año
  correcto. No acepta fechas futuras ni anteriores al inicio del año pasado.

## Octubre 2026 — La inscripción es un solo paquete

- La **inscripción** incluye el **carnet QR y la papelería** (ya no son cobros aparte) y en la Caja sale en un solo
  renglón junto con el **primer mes (septiembre)**: «Inscripción 2026-2027 (inscripción $ 55 + carnet QR $ 13 +
  papelería $ 3 + Septiembre $ 55) — $ 126». Al cobrarla, septiembre queda pagado.
- Si septiembre ya estaba pagado, la inscripción va sola. Si el estudiante entró después, va con su primer mes.
- Exonerados de inscripción: pagan solo carnet y papelería (con su primer mes).

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
