# Historial de cambios

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
