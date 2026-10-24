# Guía para docentes

Los docentes entran con el correo y la contraseña que les asignó el director, y solo ven la pestaña
**📝 Notas**.

Dirección de la plataforma: **https://joicer-jb.github.io/Pagos-uep/** (en el teléfono se puede instalar como app:
menú del navegador → «Agregar a la pantalla principal»).

**¿Olvidaste la contraseña?** Escribe tu correo en la pantalla de entrada y toca **«¿Olvidaste tu contraseña?»**: te
llega un correo con un enlace para poner una contraseña nueva (revisa también la carpeta de spam).

## Cargar notas

> **Por ahora las notas las carga la encargada de control de estudio**: en Media General, la nota final de cada lapso
> en cada materia, la que entrega el profesor. El plan de evaluación y las evaluaciones de cada profesor están
> apagados hasta que el director les dé acceso a los docentes (`NOTAS_DETALLADAS` en `js/config.js`).

Ves a los estudiantes de **tus grados**, según lo que el director te asignó en tu cuenta:

- **Inicial y Primaria:** tu grado, con todas sus áreas.
- **Media General:** los años donde das clase. Solo puedes cargar las notas y el plan de evaluación de **tus
  materias**; las de otros profesores salen en gris.

1. **Filtrar por grado** (opcional) y **Seleccionar estudiante**.
2. Elige el **lapso** (Lapso 1, 2 o 3).
3. Carga las notas:
   - **Media general (1er a 5to Año):** notas del 1 al 20 en cada evaluación de cada materia. La nota del lapso
     se calcula sola, con los porcentajes de tu plan de evaluación (ver abajo).
   - **Preescolar y primaria:** marca la letra (A, B, C, D o E) en cada indicador de cada área.
4. **💾 Guardar notas.** Aparece «✅ Notas guardadas correctamente».

Las notas quedan guardadas para el director, que puede imprimir el **🖨️ Boletín**.

## Plan de evaluación (media general)

Junto a cada materia está el botón **⚙️ Plan de evaluación**:

1. Escribe cada evaluación del lapso con su nombre y su porcentaje (por ejemplo «Prueba escrita 30%», «Taller
   20%», «Proyecto 50%»). Pueden ser las que hagas: **➕ Agregar evaluación** o 🗑️ para quitar una.
2. Los porcentajes deben sumar **100%**. Si no pones porcentajes, todas valen igual.
3. Marca **Usar este mismo plan en los 3 lapsos** si es igual en todo el año.
4. **💾 Guardar plan.** El plan es del grado: sirve para todos los estudiantes de ese año.

Mientras falten evaluaciones por nota, la nota del lapso se calcula con las que ya tienen nota.

## Sábana de notas (media general)

**📋 Sábana de notas** muestra las notas de todo el año (o sección) en una sola tabla, para el consejo de sección:

- **Todo el año:** por materia, 1er, 2do y 3er lapso y la definitiva; al final, el promedio de cada estudiante.
- **Un lapso:** la nota de ese lapso en cada materia.
- **Detalle por materia:** cada evaluación que puso el profesor, con su porcentaje.
- Toca el nombre de un estudiante para ver todas sus evaluaciones. Se puede **🖨️ Imprimir** y descargar en
  **📥 Excel**.
- En rojo, las notas por debajo de 10. Con **C**, las que cambió el consejo: esas solo las cambia el director.

## Cuadro de honor (media general)

**🏆 Cuadro de honor** muestra qué año tiene el mejor promedio y los mejores promedios de media general (los 10
mejores y los 3 mejores de cada año), por lapso o del año. Se puede imprimir.

## Preguntas frecuentes

- **No aparece una materia o un indicador:** el director los configura en ⚙️ Configuración.
- **No aparece ningún estudiante («La lista de estudiantes todavía no está lista»):** la lista se prepara
  sola cuando entra el director o la administradora. Pídeles que entren una vez y vuelve a entrar.
- **Un estudiante cambió de grado y no lo veo:** sal y vuelve a entrar; la lista se actualiza al entrar.
- **No puedo entrar:** tu cuenta puede estar desactivada. Habla con el director.
- **¿Puedo borrar notas?** No. Si te equivocaste, corrige el valor y guarda de nuevo.
