// 🖐️ Modo pantalla táctil: en la PC de la secretaria la pantalla táctil se comporta como un ratón (no sale el teclado
// de Windows y arrastrar no sube ni baja). Se activa en el equipo desde la entrada: al tocar un campo sale un teclado
// propio, y arrastrar desplaza la página sin abrir lo que estaba debajo.
//
// Uso: node --test tests/e2e/pantalla-tactil.test.js
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { abrirNavegador } = require("./entorno");

let nav, s;
const llamar = (c) => s.pagina.evaluate(c);
const tecla = (k) => s.pagina.click(`#teclado-pantalla [data-k="${k}"]`);
async function teclear(texto) {
  for (const ch of texto) await tecla(ch === " " ? "espacio" : ch);
}

before(async () => {
  nav = await abrirNavegador();
  s = await nav.nuevaPagina();
  await s.pagina.goto(nav.base);
  await s.pagina.waitForSelector("#l-email");
});
after(async () => nav && nav.cerrar());

test("sin activarlo no sale el teclado propio", async () => {
  await s.pagina.click("#l-email");
  assert.equal(await s.pagina.$("#teclado-pantalla"), null);
  assert.match(await s.pagina.textContent("#btn-modo-tactil"), /¿Pantalla táctil\? Activar teclado en pantalla/);
});

test("se activa en el equipo y se entra escribiendo solo con el teclado en pantalla", async () => {
  await s.pagina.click("#btn-modo-tactil");
  assert.match(await s.pagina.textContent("#btn-modo-tactil"), /Pantalla táctil activada en este equipo/);
  assert.equal(await llamar(`localStorage.getItem("modoTactil")`), "1");
  await s.pagina.click("#l-email");
  await s.pagina.waitForSelector("#teclado-pantalla");
  assert.equal(await s.pagina.getAttribute("#l-email", "inputmode"), "none"); // no sale además el de Windows
  await teclear("herrerajoicer@gmail");
  await tecla(".com");
  assert.equal(await s.pagina.inputValue("#l-email"), "herrerajoicer@gmail.com");
  // Tocar la contraseña: el teclado sigue y escribe ahí
  await s.pagina.click("#l-pwd");
  await teclear("prueba123");
  assert.equal(await s.pagina.inputValue("#l-pwd"), "prueba123");
  // ↵ hace lo mismo que Enter: entra
  await tecla("enter");
  await s.pagina.waitForSelector(".tabs .tab");
  assert.equal(await s.pagina.$("#teclado-pantalla"), null);
});

test("mayúscula, acento, borrar y ocultar; lo escrito avisa a la pantalla (búsqueda de la Caja)", async () => {
  await llamar(`setTab("caja")`);
  await s.pagina.click("#caja-q");
  await s.pagina.waitForSelector("#teclado-pantalla");
  await tecla("mayus");
  assert.equal(await s.pagina.textContent('#teclado-pantalla [data-k="a"]'), "A");
  await teclear("ana");
  assert.equal(await s.pagina.inputValue("#caja-q"), "Ana");
  assert.equal(await llamar(`caja.q`), "Ana"); // como si lo hubiera tecleado
  await teclear(" mar");
  await tecla("acento");
  await teclear("i");
  assert.equal(await s.pagina.inputValue("#caja-q"), "Ana marí");
  await tecla("borrar");
  await tecla("borrar");
  assert.equal(await s.pagina.inputValue("#caja-q"), "Ana ma");
  await tecla("ocultar");
  assert.equal(await s.pagina.$("#teclado-pantalla"), null);
  // Al volver a tocar el campo aparece otra vez
  await s.pagina.click("#caja-q");
  await s.pagina.waitForSelector("#teclado-pantalla");
  await tecla("ocultar");
});

test("al pasar a otro campo, lo escrito avisa «change» una sola vez (como al teclear)", async () => {
  await llamar(`(() => {
    const d = document.createElement("div");
    d.id = "prueba-campos";
    d.innerHTML = '<input id="c1" onchange="window.__cambios=(window.__cambios||0)+1"/><input id="c2"/>';
    document.getElementById("app").prepend(d);
  })()`);
  await s.pagina.click("#c1");
  await teclear("15");
  assert.equal(await llamar(`window.__cambios || 0`), 0);
  await s.pagina.click("#c2");
  assert.equal(await llamar(`window.__cambios`), 1);
  await tecla("ocultar");
  assert.equal(await llamar(`window.__cambios`), 1);
  await llamar(`document.getElementById("prueba-campos").remove()`);
});

test("arrastrar con el dedo sube y baja la página, sin abrir lo que estaba debajo", async () => {
  await llamar(`setTab("estudiantes")`);
  await s.pagina.waitForSelector(".list-item");
  await llamar(`document.getElementById("app").style.paddingBottom = "2500px"; window.scrollTo(0, 0)`);
  const caja = await s.pagina.locator(".list-item").first().boundingBox();
  const x = caja.x + caja.width / 2,
    y = caja.y + caja.height / 2;
  await s.pagina.mouse.move(x, y);
  await s.pagina.mouse.down();
  await s.pagina.mouse.move(x, y - 150, { steps: 10 });
  await s.pagina.mouse.move(x, y - 300, { steps: 10 });
  await s.pagina.waitForTimeout(150); // sin impulso: se soltó quieto
  await s.pagina.mouse.up();
  // La página se mueve 1,6 veces lo que se arrastró (desde que empezó a moverse, pasados los 10 px de margen)
  const bajo = await llamar(`Math.round(window.scrollY)`);
  assert.ok(bajo >= 420 && bajo <= 490, "bajó 1,6 veces lo que se arrastró: " + bajo);
  assert.equal(await llamar(`modalActual`), null, "no se abrió el estudiante que estaba debajo");
  // Arrastrar hacia abajo vuelve a subir
  await s.pagina.mouse.move(x, 200);
  await s.pagina.mouse.down();
  await s.pagina.mouse.move(x, 450, { steps: 10 });
  await s.pagina.waitForTimeout(150);
  await s.pagina.mouse.up();
  assert.ok((await llamar(`window.scrollY`)) < bajo - 300);
  // Soltar en movimiento: sigue deslizándose después de soltar y frena sola
  await llamar(`window.scrollTo(0, 0)`);
  await s.pagina.mouse.move(x, 500);
  await s.pagina.mouse.down();
  for (let k = 1; k <= 8; k++) {
    await s.pagina.mouse.move(x, 500 - k * 25);
    await s.pagina.waitForTimeout(10);
  }
  await s.pagina.mouse.up();
  const alSoltar = await llamar(`window.scrollY`);
  await s.pagina.waitForTimeout(2500);
  const despues = await llamar(`window.scrollY`);
  assert.ok(despues > alSoltar + 150, `siguió deslizándose: ${alSoltar} → ${despues}`);
  await s.pagina.waitForTimeout(300);
  assert.equal(await llamar(`window.scrollY`), despues, "y se detuvo");
  assert.equal(await llamar(`modalActual`), null);
  // Un toque sin arrastrar sigue funcionando
  await llamar(`window.scrollTo(0, 0)`);
  await s.pagina.locator(".list-item").first().click();
  await s.pagina.waitForFunction(() => modalActual !== null);
  assert.deepEqual(s.errores, []);
});
