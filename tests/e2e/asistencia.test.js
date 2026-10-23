// 👷 Nómina → 🗓️ Asistencia: cada día se marca quién vino (presente, retardo, falta, justificada o permiso) y las
// horas de quien trabaja por horas; resumen del mes, impresión y, al pagar la quincena, su asistencia.
//
// Uso: node --test tests/e2e/asistencia.test.js
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { abrirNavegador } = require("./entorno");

let nav, s;
const llamar = (codigo) => s.pagina.evaluate(codigo);
const dia = (f) =>
  llamar(`JSON.parse(JSON.stringify(__DATOS_FALSOS__.asistencia_personal.get(${JSON.stringify(f)}) || null))`);
const fila = (id) => `.asist-fila[data-trab="${id}"]`;

before(async () => {
  nav = await abrirNavegador();
  s = await nav.nuevaPagina();
  await s.pagina.goto(nav.base);
  await s.pagina.waitForSelector("#l-email");
  await s.pagina.fill("#l-email", "herrerajoicer@gmail.com");
  await s.pagina.fill("#l-pwd", "prueba123");
  await s.pagina.click("#login-btn");
  await s.pagina.waitForSelector(".tabs .tab");
  await llamar(`const t = { id: "trabH", nombre: "Profe Horas", cargo: "Docente de Media general", frecuencia: "quincenal", activo: true,
      horas: [{ nivel: "Media general", horas: 40, tarifa: 2.5 }] };
    trabajadores.push(t); __DATOS_FALSOS__.trabajadores.set("trabH", { ...t });
    tasas[todayStr()] = 184.5; setTab("nomina"); subTab.nomina = "asistencia"; renderTabContent()`);
  await s.pagina.waitForSelector(".asist-fila");
});
after(async () => nav && nav.cerrar());

test("se marca el día y se guarda: estado de cada uno, horas y motivo", async () => {
  assert.equal(await s.pagina.inputValue("#asist-fecha"), "2026-10-07");
  await s.pagina.click(`${fila("trab1")} .asist-presente`);
  await s.pagina.click(`${fila("trab2")} .asist-falta`);
  await s.pagina.fill("#asist-n-trab2", "No avisó");
  await s.pagina.click(`${fila("trabH")} .asist-presente`);
  await s.pagina.fill("#asist-h-trabH", "4");
  assert.match(await s.pagina.textContent("#asist-guardado"), /Sin guardar/);
  await s.pagina.click("text=💾 Guardar el día");
  await s.pagina.waitForFunction(() => /Guardado/.test(document.getElementById("asist-guardado").textContent));
  const d = await dia("2026-10-07");
  assert.deepEqual(d.registros, {
    trab1: { estado: "presente" },
    trab2: { estado: "falta", nota: "No avisó" },
    trabH: { estado: "presente", horas: 4 },
  });
  assert.equal(d.actualizadoPor, "herrerajoicer@gmail.com");
});

test("otro día: «los demás, presentes», las horas y el resumen del mes", async () => {
  await s.pagina.click('button[title="Día anterior"]');
  assert.equal(await s.pagina.inputValue("#asist-fecha"), "2026-10-06");
  await s.pagina.click(`${fila("trab2")} .asist-retardo`);
  await s.pagina.click("text=✓ Los demás, presentes");
  await s.pagina.fill("#asist-h-trabH", "3");
  await s.pagina.click("text=💾 Guardar el día");
  await s.pagina.waitForFunction(() => /Guardado/.test(document.getElementById("asist-guardado").textContent));
  assert.equal((await dia("2026-10-06")).registros.trab2.estado, "retardo");
  assert.match(await s.pagina.textContent('.asist-res[data-trab="trab2"]'), /0 P · 1 R · 1 F · 0 J · 0 Pm/);
  assert.match(await s.pagina.textContent('.asist-res[data-trab="trabH"]'), /2 P .*⏱️ 7 h/);
  await s.pagina.click("text=🖨️ Imprimir el mes");
  assert.match(
    await llamar(`window.__IMPRESIONES__.at(-1).html`),
    /Asistencia del personal · Octubre 2026[\s\S]*Profe Horas/
  );
});

test("si cambias de día sin guardar, pregunta", async () => {
  await s.pagina.click(`${fila("trab1")} .asist-permiso`);
  await llamar(`window.confirm = (m) => { window.__PREGUNTA__ = m; return false; }`);
  await s.pagina.click('button[title="Día anterior"]');
  assert.match(await llamar(`window.__PREGUNTA__`), /No guardaste la asistencia del 06\/10\/2026/);
  assert.equal(await s.pagina.inputValue("#asist-fecha"), "2026-10-06");
});

test("al pagar la quincena se ve su asistencia y se pueden usar las horas registradas", async () => {
  await llamar(`asistBorrador = null; abrirModal({ tipo: "pago-nomina", trabId: "trabH", periodo: "2026-10-Q1" })`);
  await s.pagina.waitForSelector(".pn-asist-info");
  assert.match(
    await s.pagina.textContent(".pn-asist-info"),
    /Asistencia en 1ra quincena de Octubre 2026: 2 presente · 7 h registradas/
  );
  assert.equal(await s.pagina.inputValue("#pn-h-0"), "20"); // lo de siempre (40 al mes ÷ 2)…
  await s.pagina.click(".pn-asist-info >> text=Usar 7 h");
  assert.equal(await s.pagina.inputValue("#pn-h-0"), "7"); // …o lo registrado
  assert.equal(await s.pagina.textContent("#pn-h-m-0"), "$ 17,50");
  await llamar(`cerrarModal(); abrirModal({ tipo: "pago-nomina", trabId: "trab2", periodo: "2026-10-Q1" })`);
  await s.pagina.waitForSelector(".pn-asist-info");
  assert.match(await s.pagina.textContent(".pn-asist-info"), /1 retardo · 1 falta \(7\)/);
  assert.match(await s.pagina.textContent(".pn-asist-info"), /descuéntalo en «Otro descuento»/);
  await llamar(`cerrarModal()`);
  assert.deepEqual(s.errores, []);
});
