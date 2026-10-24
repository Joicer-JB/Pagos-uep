# Guía del director

El director tiene acceso a todo. Esta guía cubre lo que **solo el director** puede hacer y las tareas de
inicio y cierre de año. El trabajo diario de cobros y pagos está en la
[guía de la administradora](guia-administradora.md), que el director también puede usar.

**La administradora solo cobra:** entra a 🏠 Inicio, 💳 Caja y 💰 Pagos. Cobra, imprime y reenvía recibos, y puede
cargar la tasa BCV de un día que no la tenga. **Todo lo demás lo haces tú:** registrar y editar estudiantes,
mensualidades y exoneraciones, cobranza, ingresos y gastos, nómina, reportes, notas y configuración. Las reglas de
Firestore lo exigen también: aunque alguien intentara saltarse la pantalla, la base de datos no lo permite.

## 🔍 Buscador inteligente

Botón **🔍 Buscar** de la cabecera, la barra de Inicio, **Ctrl+K** o la tecla **/**. Se escribe como se habla, y
responde con los datos de la plataforma (sin internet de por medio):

- **Encontrar:**
  - un estudiante (nombre, cédula, teléfono o representante): cobrarle, su estado de cuenta, su ficha;
  - un recibo (número o referencia de la transferencia);
  - un trabajador: su ficha o pagarle.
- **Ir a cualquier parte:** «cierre de caja», «nuevo gasto», «cuentas por pagar», «conciliación», «flujo proyectado»,
  «respaldo», «bitácora», «pasar de grado»…
- **Preguntar:**
  - «cobrado hoy», «cobrado el 15/10», «cobrado en septiembre»;
  - «gastos de este mes», «cómo vamos este mes», «balance del año»;
  - «quién debe en 1er año», «cuántos están al día», «inscripciones pendientes»;
  - «nómina», «cuentas por pagar», «tasa del 02/10»;
  - **«qué hizo la secretaria hoy»** o «actividad de esta semana»: cada cobro, ingreso o gasto registrado, y lo
    borrado, con la hora y quién lo hizo.

Las fechas se entienden así: hoy, ayer, esta semana, la semana pasada, esta quincena, la quincena pasada, este mes, el
mes pasado, el nombre de un mes, una fecha (15/10) o este año escolar.

La secretaria también tiene el buscador, pero solo ve lo suyo: estudiantes, recibos, lo cobrado de un día, quién
debe y las acciones de la Caja y Pagos.

## Entrar con Google y avisos al teléfono

- **Entrar con Google:** botón en la pantalla de entrada. Hay que activarlo una vez en Firebase; ver
  [Entrar con Google](entrar-con-google.md). Con la verificación en 2 pasos de tu Gmail, nadie entra sin tu teléfono.
- **📲 Avisos al teléfono:** ⚙️ Configuración → 📲 Avisos. Te llegan el cierre del día (lunes a viernes, 6:00 pm), el
  resumen de cada quincena (el 1 y el 16) y si el respaldo del viernes salió bien o falló, aunque la plataforma esté
  cerrada. Ver [Avisos al teléfono](avisos-telefono.md).

## Al empezar el año escolar

1. **⚙️ Configuración → 📅 Año escolar.** Revisa el nombre del año (ej. 2026-2027) y su fecha de inicio.
2. **Cuotas y mora automática** (pestaña 🔔 Cobranza, panel «⚙️ Cuotas del año»):
   - Mes de la primera cuota, número de cuotas y día de vencimiento (del 1 al 28).
   - Recargo por mensualidad atrasada (opcional). Se suma **una sola vez** por cada cuota pagada tarde
     o vencida, y solo para las cuotas que vencen desde que lo activas, salvo que marques lo contrario.
3. **📥 Importar:** monta la matrícula desde Excel, **un grado o año a la vez** (ver «Montar la matrícula por grado»).
4. **⚙️ Configuración → 📚 Materias:** materias de cada año de media general (1er a 5to Año).
5. **⚙️ Configuración → 📋 Indicadores:** indicadores de cada área en preescolar y primaria.
6. **⚙️ Configuración → 🏫 Institución:** nombre, código, dirección, director y coordinadores. Salen en
   los boletines y las constancias. Ahí también se sube una vez el **logo del Ministerio del Poder Popular para la
   Educación**, que sale arriba a la derecha en las constancias de estudio (puedes sacarlo del Word de la matrícula:
   clic derecho sobre el logo → «Guardar como imagen»).

## Montar la matrícula por grado (Word o Excel)

Sirve para cargar la matrícula sin agregar estudiante por estudiante, y para que la plataforma cuadre con la
matrícula oficial.

1. Pestaña **📥 Importar** → elige el **grado o año** (por ejemplo «1er Año»).
2. Sube la matrícula de ese grado: **el mismo Word (.docx) que hacen los docentes** («Matricula Inicial», con la
   tabla de Cédula Escolar, Nombres y Apellidos, Sexo, F. Nac., Representante, Teléfono…), o un Excel con una fila
   por estudiante. No hay que cambiarle nada: los títulos de arriba, el total de abajo y los encabezados repetidos
   en cada página se saltan solos, y la sección («Sección: "U"») se toma del título. Si el Word es viejo (.doc),
   ábrelo y guárdalo como .docx. En un Excel los nombres y apellidos pueden venir juntos o en dos columnas, y el sexo
   como F/M, H/V o Hembra/Varón.
3. Revisa la vista previa antes de guardar:
   - **✅ Nuevo:** no está en la plataforma; se crea con la mensualidad de su nivel.
   - **🔄 Se actualiza:** ya está. Si estaba retirado se reactiva, si estaba en otro grado se pasa a este, y se le
     corrige el sexo y se le completa lo que le falte. Su mensualidad, sus pagos y su deuda no se tocan.
   - **✔️ Ya está:** no hay nada que cambiar.
   - **⏭️ Repetido u otro grado:** se salta.
   - **«Así quedará»:** cuántos inscritos tendrá el grado, con niñas y niños. Compáralo con la matrícula oficial.
   - Si alguien del grado **no está en tu lista**, sale en amarillo. Solo se marca como retirado si marcas la casilla.
4. Pulsa **✅ Guardar**. Repite con el siguiente grado.

Un Excel con varios grados también sirve: elige «📚 Varios grados» y pon la columna «Grado» o una hoja por grado
(el nombre de la hoja es el grado: «1er Año», «II Grupo»…).

## Control de estudio

Por ahora las notas las carga **la encargada de control de estudio**. Créale su cuenta en ⚙️ Config → 👨‍🏫 Docentes y
marca **🗂️ Control de estudio**: ve todos los grados y carga todas las notas. En Media General carga **la nota final
de cada lapso** en cada materia (la que entrega el profesor); en Inicial y Primaria, el literal de cada indicador.

Cuando quieras que cada profesor cargue su plan de evaluación y sus evaluaciones, se activa `NOTAS_DETALLADAS` en
`js/config.js` (ya está hecho y probado).

## Sábana de notas y consejo de sección (media general)

En **📝 Notas → 📋 Sábana de notas** están todas las notas de un año (y sección, si hay varias), para discutirlas
con los docentes. El boletín sigue siendo para los representantes.

- **Ver:** todo el año (1er, 2do y 3er lapso, definitiva y promedio), un lapso, o el **detalle por materia** con
  cada evaluación que puso el profesor y su porcentaje. Abajo salen el promedio de la sección y cuántos quedaron
  por debajo de 10.
- Toca el **nombre** de un estudiante para ver todas sus evaluaciones (y imprimirlas).
- **Cambiar una nota por decisión del consejo (solo tú):** toca la nota (de un lapso o la definitiva), escribe
  la nota nueva, el **motivo** y, si quieres, el acta. Queda la nota original, quién la cambió y cuándo; en la
  sábana sale con una **C** y en la lista **🏛️ Cambios del consejo**. La definitiva y el boletín ya usan la nota
  nueva. Para deshacerlo: toca la nota → **Quitar el cambio**.
- Si después el profesor corrige sus notas, el cambio del consejo se mantiene y te avisa que la nota del
  profesor cambió.
- **🖨️ Imprimir** (hoja horizontal, con la lista de cambios y espacio para firmas) o **📥 Excel**.
- Los docentes arman el **plan de evaluación** de cada materia (nombre y porcentaje de cada evaluación) en la
  pestaña Notas, con **⚙️ Plan de evaluación**. Tú también puedes.

## Boletines

En **📝 Notas**, elige un estudiante y pulsa **🖨️ Boletín**. Para entregar los de todo un grado, filtra por ese
grado y pulsa **🖨️ Boletines de todo …**: sale uno por hoja, en orden alfabético. El boletín lleva el escudo, los
datos de ⚙️ Configuración → 🏫 Institución (nombre, dirección, código del plantel, directora y coordinadores) y las notas ya
con los cambios del consejo.

## Cuadro de honor (media general)

En **📝 Notas → 🏆 Cuadro de honor**, por lapso o del año completo:

- **Años con mejor promedio:** el promedio de cada año (1er a 5to), del mejor al más bajo, con cuántos estudiantes
  ya tienen notas y cuántos tienen alguna materia reprobada.
- **Mejores promedios:** los 10 mejores de toda media general y los 3 mejores de cada año. Solo entra quien ya tiene
  nota en todas sus materias; por defecto, tampoco quien tiene una materia reprobada (se puede incluir). Los
  empatados comparten el puesto.
- **🖨️ Imprimir** para la cartelera o el acto. En el buscador 🔍 también sale con «mejores promedios».

## Estudiantes repetidos

Si un estudiante quedó dos o más veces (por ejemplo «Pérez, Ana» y «Ana Pérez», con o sin tilde), en la
pestaña 👨‍🎓 Estudiantes aparece el aviso **👥 estudiantes repetidos** (solo lo ve el director):

1. Pulsa **Revisar y limpiar**. Cada grupo muestra las fichas encontradas y cuál se conserva (la que tiene
   más pagos y datos). Puedes elegir otra con el círculo de la izquierda.
2. **Eliminar copias de una vez** borra todos los grupos «seguros» (mismo nombre, grado y fecha de
   nacimiento, sin pagos en las copias). También puedes limpiar un grupo a la vez.
3. Los datos que falten en la ficha que se conserva (representante, teléfono, dirección…) se copian desde
   las copias antes de borrarlas. Antes de borrar se descarga un respaldo.
4. Nunca se borra una ficha con pagos que la ficha conservada no pueda ver: aparece como 🔒 y hay que elegir
   otra ficha para conservar. Dos niños con el mismo nombre y cédulas distintas no se consideran repetidos.

## Docentes

**⚙️ Configuración → 👨‍🏫 Docentes → Nuevo docente**:

- Escribe nombre, correo y una contraseña de al menos 6 caracteres. Elige jornada, grado y materias.
- El docente entra con ese correo y esa contraseña en https://joicer-jb.github.io/Pagos-uep/, y solo ve la pestaña
  📝 Notas. Si olvida la contraseña, toca **«¿Olvidaste tu contraseña?»** en la pantalla de entrada y le llega un
  correo para ponerse una nueva.
- **Control de estudio:** marca **🗂️ Control de estudio** (y, si también da clase, su grado): ve todos los grados y
  carga todas las notas. No hay cuentas fijas de notas: cada quien tiene la suya.
- **Qué le toca:** en Inicial y Primaria, su **grado** (ve ese grado y carga todas las áreas). En Media General, sus
  **materias por año** (ve esos años y carga solo esas materias). Sin grado ni materias asignadas, ve todo.
- La sábana dice quién da cada materia (de los perfiles de los docentes o de las clases de la nómina), y el boletín
  lleva el nombre del docente del grado (Primaria e Inicial) o del **profesor guía** (Media General: ⚙️ Config →
  🏫 Institución).
- **Desactivar** quita el acceso sin borrar el perfil. Las reglas de Firestore también le cierran la base
  de datos.
- **Privacidad:** los docentes no ven los datos privados de los estudiantes (teléfonos y correo del
  representante, deuda, mensualidad, observaciones médicas). Trabajan con una **ficha** que solo tiene nombre,
  cédula, fecha de nacimiento, grado, sección, año escolar y representante (lo que sale en el boletín). La app
  prepara y actualiza esas fichas sola cuando entras tú.

## Tasas de días pasados: el Excel del BCV

Para que los pagos viejos salgan en bolívares hacen falta las tasas de esos días. El BCV las publica en Excel:

1. En la computadora entra a **bcv.org.ve** → menú **Estadísticas** → **Tipo de cambio de referencia** (o
   «Tipo de Cambio de Referencia SMC»).
2. Baja el archivo del trimestre que necesitas (por ejemplo **julio – septiembre** y **octubre – diciembre**). Es un
   Excel con una hoja por día.
3. En la plataforma, botón **💱** de la cabecera → abajo, en **📥 Tasas de días anteriores**, toca el campo del
   archivo y elige el Excel tal como se bajó (sin abrirlo ni cambiarlo).
4. Revisa la lista (compara uno o dos días con la página del BCV) y pulsa **💾 Guardar tasas del archivo**.

Las tasas cuentan con **2 decimales**, sin redondear: 883,6923 se guarda como **883,69**. Las que ya estaban guardadas
con más decimales también cuentan con 2.

## Lo que solo puede hacer el director

- **Borrar** recibos, estudiantes, gastos, pagos de nómina y trabajadores (botón 🗑️). Un recibo nunca se
  puede _editar_, y un ingreso o gasto tampoco: si está mal, se borra (queda en la bitácora) y se registra de nuevo.
- Registrar y editar estudiantes, sus mensualidades y **exoneraciones** (no paga recargo, no paga inscripción,
  perdonar el recargo de un mes, deuda anterior).
- **Corregir una tasa BCV** ya guardada e importar las tasas del Excel del BCV.
- **Cambiar notas por decisión del consejo** (📋 Sábana de notas).
- Ingresos y gastos, cuentas por pagar, conciliación, nómina, asistencia y documentos del personal.
- Cambiar la configuración: cuotas, materias, indicadores e institución.
- Montar la matrícula desde Excel por grado, unificar grados escritos de formas distintas y pasar de grado.

## Estructura de costos del año

En **🔔 Cobranza → ⚙️ Cuotas del año** está **💲 Estructura de costos del año**: inscripción y mensualidad de cada
nivel (Inicial tiempo completo, Inicial medio tiempo, Primaria, Media general), carnet QR y papelería. Revisa los
montos y pulsa **Guardar**.

- La plataforma ofrece poner a cada estudiante la mensualidad de su nivel. Si alguno tiene un monto especial
  (descuento, beca), corrígelo luego en su ficha.
- La inscripción se cobra una vez al año e **incluye el carnet QR y la papelería**; en la Caja va junto con
  septiembre en un solo renglón. Si un estudiante no la ha pagado, sale como deuda y aparece ya marcada en la Caja.
- En la ficha de los niños de inicial elige el **horario** (tiempo completo o medio tiempo), que define sus montos.
  Para becados o hijos del personal marca **«No paga inscripción»**.
- Al empezar un año nuevo, actualiza aquí los montos.

## Tablero financiero

En **📊 Reportes**, arriba, está el **🧮 Tablero financiero** del año. Cuenta solo las inscripciones y mensualidades de
los estudiantes activos:

- **Índice de cobranza**: de lo que ya venció, cuánto se cobró. En verde desde 90 %; en rojo por debajo de 70 %.
- **Cobranza por mes**: lo cobrado de lo esperado en la inscripción y en cada mes, hasta el mes en curso.
- **Antigüedad de la deuda**: lo vencido sin cobrar, por días de atraso (1–30, 31–60, 61–90 y más de 90), más los
  recargos y la deuda de años anteriores. **Cobrar primero** lista a los 5 más atrasados.
- **Proyección del año**: cuánto entra si todos pagan y cuánto se estima al cierre si la cobranza sigue al ritmo de
  hoy. Lo vencido que se recupere se suma.
- **Punto de equilibrio**: costos del mes (nómina del personal registrado y el promedio mensual de los demás gastos de
  📒 Finanzas) contra las mensualidades del mes. Dice cuántos estudiantes deben pagar para cubrirlos y si, con la
  cobranza actual, alcanza.

### 🔮 Flujo de caja proyectado

Debajo del tablero: **mes a mes, hasta que empiece el próximo año escolar**, cuánto entraría y saldría, y con cuánto
quedaría el colegio. Toca un mes para ver el detalle.

- **Entra:** las mensualidades que faltan por cobrar (por el % de cobranza del escenario), la parte de la deuda
  atrasada que esperas recuperar (repartida en los próximos 3 meses) y el promedio de otros ingresos del año.
- **Sale:** la nómina del personal activo, el promedio de los demás gastos del año, las cuentas por pagar de una sola
  vez (en su mes) y las **utilidades** (diciembre) y el **bono vacacional** (julio), estimados con los días de sueldo
  que elijas. Puedes cambiar los días y el mes, o poner 0 para no incluirlos.
- **Escenarios:** «si todos pagan» (100 %), «al ritmo de cobranza actual» y «si la cobranza baja 15 puntos».
- **Dinero con el que se empieza:** si lo dejas vacío, usa el resultado del año hasta hoy (lo cobrado más otros
  ingresos, menos los gastos). Mejor escribe lo que realmente hay hoy en el banco y en caja.
- Si algún mes no alcanza, lo dice arriba en rojo. Ojo con **julio y agosto**: ya no entran mensualidades, pero la
  nómina se sigue pagando. Para eso sirve la reserva.

Se imprime con **🖨️ Imprimir**. Es una estimación: no incluye uniformes ni otros cobros, ni aumentos de sueldo que
aún no estén en la nómina.

### 🗓️ Resumen quincenal

El **1 y el 16 de cada mes** aparece en 🏠 Inicio (solo para ti) el resumen de la quincena que terminó:

- cuántos estudiantes **deben o tienen mora** y cuánto deben en total, y cuántos están **al día**;
- el índice de cobranza del año;
- lo que **entró** (cobros a representantes y otros ingresos) y lo que **salió** (gastos por categoría, nómina
  incluida) en esa quincena, y el resultado.

Se queda en Inicio hasta que pulses **✅ Visto**. Puedes imprimirlo o mandártelo por WhatsApp. En 📊 Reportes →
**🗓️ Resumen quincenal** está el de cualquiera de las últimas quincenas, con la antigüedad de la deuda y las deudas
más grandes.

### 🧮 Simulador de mensualidad

Debajo del tablero: escribe el **aumento de la mensualidad**, cuántos pagan (sale con la cobranza actual), cuántos
estudiantes se irían por el aumento y si también sube la **nómina**. Ves la nueva mensualidad promedio, lo que
entraría al mes, los costos, el resultado del mes y del año, y **la mensualidad con la que se cubren los costos**
(y el aumento que haría falta).

## Perdonar el recargo de un mes

Si a un estudiante se le debe perdonar el recargo por mora de un mes (por enfermedad, un acuerdo con el representante
u otro motivo):

1. Abre su ficha (👨‍🎓 Estudiantes → toca al estudiante).
2. En el **estado de cuenta**, junto al «+ recargo» de ese mes, toca **🤝 Perdonar** y escribe el motivo.
3. El recargo de ese mes deja de cobrarse y queda anotado: «🤝 Recargo perdonado: motivo (quién, fecha)».
   Con **Deshacer** se vuelve a cobrar.

Solo el director ve el botón. Para no cobrarle recargos nunca, marca en su ficha «🤝 Exonerado de recargos por mora».

## Bitácora: quién registró y quién borró

- Cada pago y cada ingreso o gasto guarda **quién lo registró**. Se ve en la lista de pagos (👤) y en el recibo
  en pantalla (no en el impreso).
- Todo lo que se borra (recibos, ingresos y gastos, estudiantes) queda en **⚙️ Configuración → 🕵️ Bitácora**:
  qué era, quién lo borró, cuándo y quién lo había registrado. Nadie puede cambiar ni borrar la bitácora, ni
  siquiera tú.

## Respaldos

- **Automático cada viernes a las 5:00 pm:** GitHub hace una copia completa y cifrada de la base de datos y la
  guarda 90 días. Hay que activarlo una vez: ver [Respaldo automático semanal](respaldo-automatico.md). En
  ⚙️ Configuración → 📅 Año escolar → **🔐 Respaldo automático** ves la fecha del último y puedes abrir uno con su
  clave.
- **A mano:** si pasan más de 14 días sin ningún respaldo, en 🏠 Inicio aparece un aviso con el botón **Descargar
  respaldo**. Guarda el archivo fuera de la computadora (Drive, correo o pendrive).

## Borrar un recibo

Si el pago había descontado una «deuda anterior» anotada a mano, al borrar el recibo esa deuda vuelve a la
ficha del estudiante (el mensaje de confirmación lo indica). Los recibos registrados antes de octubre de 2026
no guardaban ese dato: si borras uno de esos, revisa la deuda del estudiante a mano.

## Si pusiste mal la fecha de inicio del año

En **⚙️ Configuración → 📅 Año escolar → ✏️ Corregir la fecha de inicio**, escribe la fecha real y pulsa
**Guardar**. El año anterior termina automáticamente el día antes, y los pagos y gastos de esos días pasan al año
correcto. (El resumen guardado del año anterior al cerrarlo no se recalcula.)

## Al terminar el año escolar

1. **💾 Descargar respaldo ahora** (Configuración → Año escolar). Guarda el archivo fuera de la
   computadora.
2. **🎓 Pasar de grado a todos:** revisa a qué grado pasa cada grupo y marca a quienes repiten. Los de
   5to Año quedan como graduados. Se puede deshacer.
3. **📅 Cerrar año e iniciar el nuevo:**
   - Los pagos, gastos y nómina del año que cierra **no se borran**: quedan en el historial.
   - Puedes arrastrar las deudas pendientes al año nuevo o dejarlas en el historial.
   - Las notas se archivan y el año nuevo empieza sin notas.
   - Antes de empezar se descarga un respaldo automático.
4. Para **consultar un año anterior**, usa el selector de año de la cabecera. En ese modo todo es de solo
   consulta.

## Seguridad

- **La computadora de la administradora** (a veces la usa otra persona): su sesión se cierra al cerrar el
  navegador o después de 30 minutos sin usarla, y al pulsar «Salir» se borra de esa computadora la copia de los
  datos. En tu computadora, que es personal, la sesión y la copia se quedan (para trabajar sin internet).
- **App Check:** para que Firebase solo atienda a la plataforma. Ver [App Check](app-check.md); necesito de ti la
  clave del sitio de reCAPTCHA.
- Si cambias el correo del director o de la administradora, cámbialo en `js/config.js` **y** en
  `firestore.rules`, y publica las reglas. Ver el [README](../README.md#reglas-de-firestore-seguridad).
- No compartas tu contraseña. Cada persona debe tener su propia cuenta.
