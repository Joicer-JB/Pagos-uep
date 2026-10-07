// Prueba de seguridad: rellena los campos de texto con HTML malicioso (como si viniera de un Excel
// importado o de un docente malintencionado) y recorre todas las pantallas, modales e impresiones.
// Si algún <img onerror> llega a ejecutarse, o aparece sin escapar en un recibo impreso, la prueba falla.
//
// Uso: node tests/e2e/seguridad.js
const semilla = require("./datos/semilla");
const { abrirNavegador } = require("./entorno");

const CAMPOS_TEXTO = new Set(
  `nombre cedula acudiente telefono telefonoAcudiente cedulaAcudiente correoAcudiente observacionesMedicas
  moraConcepto descripcion responsable observaciones referencia cargo direccion rif director anioEscolar`
    .split(/\s+/)
    .filter(Boolean)
);

const ataque = (donde) => `Ana D'Angelo "<img src=x onerror="window.__XSS__.push('${donde}')">`;

function semillaMaliciosa() {
  const s = JSON.parse(JSON.stringify(semilla));
  for (const [col, docs] of Object.entries(s.colecciones)) {
    for (const [id, doc] of Object.entries(docs)) {
      for (const k of Object.keys(doc)) {
        if (CAMPOS_TEXTO.has(k) && typeof doc[k] === "string") doc[k] = ataque(`${col}/${id}.${k}`);
      }
    }
  }
  // grado de un estudiante escrito a mano, materias e indicadores configurados por el director
  s.colecciones.estudiantes.est4.grado = ataque("grado");
  s.colecciones.config.materias["1er Año"].push(ataque("materia"));
  s.colecciones.config.indicadores["3er Grado__Matemáticas"].push(ataque("indicador"));
  s.colecciones.usuarios["uid-docente"].materias.push(ataque("materia-docente"));
  return s;
}

async function revisar() {
  const nav = await abrirNavegador({ datos: semillaMaliciosa() });
  const fallas = [];
  try {
    for (const correo of ["herrerajoicer@gmail.com", "docente.prueba@example.com"]) {
      const { pagina, contexto, errores } = await nav.nuevaPagina();
      pagina.setDefaultTimeout(10000);
      await pagina.addInitScript(() => (window.__XSS__ = []));
      await pagina.goto(nav.base);
      await pagina.waitForSelector("#l-email");
      await pagina.fill("#l-email", correo);
      await pagina.fill("#l-pwd", "prueba123");
      await pagina.click("#login-btn");
      await pagina.waitForSelector(".tabs .tab");
      const esperar = () => pagina.waitForTimeout(80);
      const visitado = [];

      const pestanas = await pagina.$$eval(".tabs .tab", (bs) =>
        bs.map((b) => b.getAttribute("onclick").match(/setTab\('(.+)'\)/)[1])
      );
      for (const t of pestanas) {
        await pagina.evaluate((t) => setTab(t), t);
        await esperar();
        visitado.push(t);
        if (process.env.DEPURAR) console.log("  pestaña", t);
        const subs = await pagina.locator("#tab-content .stab").count();
        for (let i = 0; i < subs; i++) {
          await pagina.locator("#tab-content .stab").nth(i).click();
          await esperar();
        }
        await pagina.evaluate((t) => setTab(t), t);
        // elegir opciones de los <select> (grado en notas, etc.)
        const nSel = await pagina.locator("#tab-content select").count();
        for (let i = 0; i < nSel; i++) {
          const sel = pagina.locator("#tab-content select").nth(i);
          if (!(await sel.count())) break;
          if (!(await sel.isVisible())) continue;
          const ops = await sel.locator("option").evaluateAll((os) => os.map((o) => o.value).filter(Boolean));
          for (const op of ops.slice(0, 6)) {
            await sel.selectOption(op).catch(() => {});
            await esperar();
          }
        }
        await pagina.evaluate((t) => setTab(t), t);
        await esperar();
      }

      if (correo.startsWith("herrera")) {
        // fichas, recibos e impresiones de cada estudiante, finanza y trabajador
        const acciones = await pagina.evaluate(() => [
          ...estudiantes.flatMap((e) => [
            `abrirModal({tipo:"ver-estudiante",id:"${e.id}"})`,
            `abrirModal({tipo:"editar-estudiante",id:"${e.id}"})`,
            `imprimirConstancia("${e.id}")`,
            `imprimirBoletin("${e.id}")`,
          ]),
          ...pagos.flatMap((p, i) => [`abrirModal({tipo:"recibo",pago:pagos[${i}]})`, "imprimirRecibo()"]),
          ...finanzas.map((f) => `abrirModal({tipo:"ver-finanza",id:"${f.id}"})`),
          ...trabajadores.flatMap((t) => [
            `abrirModal({tipo:"ver-trabajador",id:"${t.id}"})`,
            `imprimirReciboNomina("${t.id}",null)`,
          ]),
          ...finanzas.filter((f) => f.categoria === "Nómina").map((f) => `imprimirReciboNomina(null,"${f.id}")`),
          "cerrarModal()",
          'setTab("caja")',
          'cajaBuscar("Ana")',
          'cajaElegir("est1")',
          'setTab("cobranza")',
          "imprimirCobranza()",
          'setTab("finanzas")',
          "imprimirFlujoCaja(new Date().getFullYear(),null,true)",
          'setTab("config")',
          'abrirModalEditarDocente("uid-docente")',
          "cerrarModal()",
        ]);
        for (const codigo of acciones) {
          if (process.env.DEPURAR) console.log("   ", codigo);
          await pagina.evaluate(codigo);
          await esperar();
        }
        await esperar();

        // el botón «Registrar pago» de la ficha debe funcionar aunque el nombre tenga comillas
        await pagina.evaluate(() => abrirModal({ tipo: "ver-estudiante", id: "est1" }));
        await esperar();
        const boton = pagina.locator(`[onclick*="window._pagoEstId='est1'"]`);
        if (await boton.count()) {
          await boton.first().click();
          await pagina.waitForTimeout(300);
          const nombre = await pagina.$eval("#p-nombre", (el) => el.value).catch(() => null);
          if (nombre !== ataque("estudiantes/est1.nombre"))
            fallas.push(`«Registrar pago» no copió el nombre con comillas (quedó: ${JSON.stringify(nombre)})`);
        } else {
          fallas.push("no se encontró el botón «Registrar pago» en la ficha del estudiante");
        }
      }

      const ejecutados = await pagina.evaluate(() => window.__XSS__);
      for (const x of new Set(ejecutados)) fallas.push(`[${correo}] se ejecutó código inyectado en el campo ${x}`);
      const impresiones = await pagina.evaluate(() => window.__IMPRESIONES__.map((d) => d.html));
      impresiones.forEach((html, i) => {
        const m = html.match(/<img src=x onerror="window.__XSS__.push\('([^']+)'\)">/);
        if (m) fallas.push(`[${correo}] impresión #${i}: HTML sin escapar del campo ${m[1]}`);
      });
      for (const e of errores) fallas.push(`[${correo}] error en la página: ${e}`);
      console.log(`  ${correo}: ${visitado.length} pestañas, ${impresiones.length} impresiones revisadas`);
      await contexto.close();
    }
  } finally {
    await nav.cerrar();
  }
  return fallas;
}

if (require.main === module) {
  revisar().then((fallas) => {
    if (fallas.length) {
      console.log("✗ Problemas de seguridad:\n  " + [...new Set(fallas)].join("\n  "));
      process.exit(1);
    }
    console.log("✓ Ningún dato malicioso se ejecutó ni salió sin escapar");
  });
}

module.exports = { revisar };
