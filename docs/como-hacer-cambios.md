# Cómo hacer cambios sin romper nada

Antes, todo el sistema era un solo `index.html` que se borraba y se volvía a subir completo. Ahora el
código está repartido en archivos pequeños. Así cada cambio es fácil de revisar y de deshacer, y las
pruebas automáticas avisan si algo se rompió.

## 1. Encuentra el archivo

| Quiero cambiar…                                     | Archivo                                             |
| --------------------------------------------------- | --------------------------------------------------- |
| Correos de director/administradora, nombre, EmailJS | `js/config.js` (y los correos en `firestore.rules`) |
| Colores, tamaños, estilos                           | `css/estilos.css`                                   |
| Una pestaña (Caja, Pagos, Cobranza, Notas…)         | `js/vistas/<pestaña>.js`                            |
| El recibo de pago                                   | `js/vistas/pagos.js`                                |
| El boletín                                          | `js/vistas/boletin.js`                              |
| Cómo se calculan cuotas, mora y recargos            | `js/servicios/cuotas.js`                            |
| Tasa BCV y conversión a Bs.                         | `js/servicios/tasa-bcv.js`                          |
| Formato de montos y fechas                          | `js/utils/formato.js`                               |
| Grados y áreas                                      | `js/utils/grados.js`                                |
| Quién puede leer o escribir en la base de datos     | `firestore.rules` (y publicarlas en Firebase)       |

Si no sabes dónde está algo, en GitHub pulsa la tecla `t` y escribe el nombre de la función, o busca un
texto que se vea en pantalla con la lupa del repositorio.

## 2. Edita en GitHub (desde el navegador o el teléfono)

1. Abre el archivo y pulsa el ícono del lápiz ✏️ (**Edit this file**).
2. Haz el cambio.
3. Pulsa **Commit changes…** y escribe un mensaje que diga **qué** cambió y **por qué**. Por ejemplo:
   - ✅ «Caja: agrega el método de pago Zelle»
   - ✅ «Boletín: muestra el nombre de la coordinadora de primaria»
   - ❌ «Add files via upload»
4. Si el cambio es grande, elige **Create a new branch** y abre un _pull request_. Así puedes revisarlo
   antes de que llegue a la app publicada.

**No borres ni vuelvas a subir `index.html` completo.** Si una herramienta te entrega un `index.html`
"todo en uno", no lo subas: perderías la separación por archivos, las correcciones de seguridad y las
pruebas. Pídele, en cambio, que modifique el archivo concreto (por ejemplo, «cambia `js/vistas/caja.js`
para…»).

## 3. Mira el resultado de las pruebas

Después de cada commit, GitHub corre las pruebas solo (pestaña **Actions**, o el círculo junto al
commit):

- 🟢 **verde:** todo bien.
- 🔴 **rojo:** algo se rompió. Abre el detalle: el nombre de la prueba que falló dice qué pantalla o
  cálculo revisar. Corrígelo, o deshaz el commit (**Revert**) hasta encontrar el problema.

## 4. Reglas que evitan problemas

- **Texto escrito por usuarios → `escHtml()`.** Cualquier nombre, descripción, cédula, etc. que se
  muestre dentro de HTML va así: `${escHtml(e.nombre)}`. Dentro de un
  `onclick="funcion('…')"` usa `escJs()`. Si no, un nombre como `D'Angelo` o un Excel malicioso puede
  romper la página o ejecutar código.
- **Montos siempre en $ de referencia**, redondeados con `r2()`. Los bolívares se calculan con la tasa
  de la fecha de la operación (`bsDe`, `totalesDual`).
- **Fechas como texto `"YYYY-MM-DD"` en hora local** (`todayStr()`), nunca con `toISOString()`, que usa
  la hora UTC y de noche ya es el día siguiente.
- **Un archivo nuevo en `js/`** se agrega como `<script src="…">` en `index.html`, antes de `js/app.js`.
  La prueba de estructura avisa si falta.
- **No declares dos veces el mismo nombre** (función o constante) en archivos distintos. Todos comparten
  el mismo espacio y el segundo archivo dejaría de cargar. La prueba de estructura también lo detecta.
- **Errores de formularios → `mostrarError("id-del-contenedor", "mensaje")`.**

## 5. En tu computadora (opcional)

Con [Node.js](https://nodejs.org) instalado:

```bash
npm install          # primera vez
npm run servir       # la app en http://localhost:8080 (con los datos reales)
npm test             # todas las pruebas
npm run formato      # ordena el formato del código
```

Con [Git](https://git-scm.com) o [GitHub Desktop](https://desktop.github.com) puedes trabajar en tu
computadora y subir los cambios. Las mismas reglas aplican.
