# Guía del director

El director tiene acceso a todo. Esta guía cubre lo que **solo el director** puede hacer y las tareas de
inicio y cierre de año. El trabajo diario de cobros y pagos está en la
[guía de la administradora](guia-administradora.md), que el director también puede usar.

## Al empezar el año escolar

1. **⚙️ Configuración → 📅 Año escolar.** Revisa el nombre del año (ej. 2026-2027) y su fecha de inicio.
2. **Cuotas y mora automática** (pestaña 🔔 Cobranza, panel «⚙️ Cuotas del año»):
   - Mes de la primera cuota, número de cuotas y día de vencimiento (del 1 al 28).
   - Recargo por mensualidad atrasada (opcional). Se suma **una sola vez** por cada cuota pagada tarde
     o vencida, y solo para las cuotas que vencen desde que lo activas, salvo que marques lo contrario.
3. **📥 Importar** la matrícula desde Excel:
   - Descarga la plantilla, llénala (una fila por estudiante, todos los grados en la misma hoja) y súbela.
   - Revisa la vista previa: marca los duplicados, los datos que faltan y los grados que no se entienden.
     Hasta que pulses **Importar** no se guarda nada.
4. **⚙️ Configuración → 📚 Materias:** materias de cada año de media general (1er a 5to Año).
5. **⚙️ Configuración → 📋 Indicadores:** indicadores de cada área en preescolar y primaria.
6. **⚙️ Configuración → 🏫 Institución:** nombre, código, dirección, director y coordinadores. Salen en
   los boletines y las constancias.

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
- El docente entra con ese correo y esa contraseña, y solo ve la pestaña 📝 Notas.
- **Desactivar** quita el acceso sin borrar el perfil. Las reglas de Firestore también le cierran la base
  de datos.

## Lo que solo puede hacer el director

- **Borrar** recibos, estudiantes, gastos, pagos de nómina y trabajadores (botón 🗑️). Un recibo nunca se
  puede _editar_: si está mal, se borra y se registra de nuevo.
- Cambiar la configuración: cuotas, correo, materias, indicadores e institución.
- Importar matrícula, unificar grados escritos de formas distintas y pasar de grado.

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

- Si cambias el correo del director o de la administradora, cámbialo en `js/config.js` **y** en
  `firestore.rules`, y publica las reglas. Ver el [README](../README.md#reglas-de-firestore-seguridad).
- No compartas tu contraseña. Cada persona debe tener su propia cuenta.
