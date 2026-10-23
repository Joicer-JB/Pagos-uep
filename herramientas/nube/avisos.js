// 📲 Avisos al teléfono del director (Firebase Cloud Messaging). Lo corre GitHub Actions (.github/workflows/avisos.yml):
//   node avisos.js dia            cierre del día: lo cobrado hoy y las cuentas por pagar vencidas o que vencen mañana
//   node avisos.js quincena       resumen de la quincena que terminó (el 1 y el 16)
//   node avisos.js prueba         un aviso de prueba
//   node avisos.js respaldo-fallo el respaldo del viernes falló (el que salió bien lo manda respaldo.js)
// Los equipos que reciben avisos están en Firestore, en «avisos_dispositivos» (se activan en la plataforma:
// ⚙️ Configuración → 📲 Avisos). Cada uno elige qué avisos quiere. Ver docs/avisos-telefono.md.
const { conectar } = require("./firebase");
const { cargarApp } = require("./app-en-node");

const COL = "avisos_dispositivos";
const BASE = { dia: "dia", quincena: "quincena", "respaldo-ok": "respaldo", "respaldo-fallo": "respaldo", prueba: "" };
const TOKEN_MUERTO = ["messaging/registration-token-not-registered", "messaging/invalid-registration-token"];

// Manda el aviso a los equipos que lo quieren. Borra los equipos cuya dirección ya no sirve (desinstalaron la app,
// borraron los datos del navegador…). Devuelve { enviados, fallidos, borrados }.
async function enviarAvisos(db, messaging, tipo, titulo, cuerpo) {
  const base = BASE[tipo];
  const equipos = (await db.collection(COL).get()).docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((e) => e.token && (!base || !e.avisos || e.avisos[base] !== false));
  if (!equipos.length) return { enviados: 0, fallidos: 0, borrados: 0 };
  const r = await messaging.sendEach(
    equipos.map((e) => ({
      token: e.token,
      data: { titulo, cuerpo, url: "./", tipo },
      webpush: { headers: { Urgency: "high", TTL: "86400" } },
    }))
  );
  let borrados = 0;
  await Promise.all(
    r.responses.map(async (x, i) => {
      if (!x.success && x.error && TOKEN_MUERTO.includes(x.error.code)) {
        await db.collection(COL).doc(equipos[i].id).delete();
        borrados++;
      }
    })
  );
  return { enviados: r.successCount, fallidos: r.failureCount, borrados };
}

// ---- El texto de cada aviso (con el código de la plataforma ya cargado: app.evaluar)
function mensajeDia(app) {
  return app.evaluar(`(() => {
    const hoy = todayStr(),
      deHoy = pagos.filter((p) => p.fecha === hoy),
      recibos = new Set(deHoy.map((p) => p.factura || p.id)).size,
      total = r2(deHoy.reduce((s, p) => s + (p.total || 0), 0)),
      tm = totalesMetodo(deHoy);
    const metodos = METODOS.filter(([m]) => tm[m].usd > 0).map(([m, etq]) => etq + " " + txtMetodo(tm[m]));
    const c = resumenCuentasPagar(cuentasPagar, hoy),
      manana = c.pendientes.filter((x) => x.vence === sumarDias(hoy, 1));
    const cuentas = [
      c.vencidas.length ? "⚠️ " + c.vencidas.length + " cuenta" + (c.vencidas.length > 1 ? "s" : "") + " por pagar vencida" + (c.vencidas.length > 1 ? "s" : "") + " (" + fmt(c.totalVencidas) + ")" : "",
      manana.length ? "🧾 Mañana vence" + (manana.length > 1 ? "n " + manana.length + " cuentas" : ": " + (manana[0].descripcion || "una cuenta")) : "",
    ].filter(Boolean);
    if (!deHoy.length && !cuentas.length) return null; // día sin cobros (feriado) y nada que vence: no se avisa
    const deben = estudiantes.filter(enMora).length;
    return {
      titulo: deHoy.length ? "💰 Hoy se cobraron " + fmt(total) + " (" + recibos + " recibo" + (recibos !== 1 ? "s" : "") + ")" : "🧾 Cuentas por pagar",
      cuerpo: [metodos.join(" · "), ...cuentas, deHoy.length ? "Deben o tienen mora: " + deben : ""].filter(Boolean).join("\\n"),
    };
  })()`);
}
function mensajeQuincena(app) {
  return app.evaluar(`(() => {
    const r = resumenQuincenal(quincenaAnterior(todayStr()));
    return {
      titulo: "🗓️ Resumen de la " + r.q.nombre,
      cuerpo: "⚠️ " + r.conDeuda + " deben o tienen mora (" + fmt(r.deudaTotal) + ") · ✅ " + r.alDia + " al día\\n" +
        "Entró " + fmt(r.entradas) + " · Salió " + fmt(r.gastos.usd) + " · Resultado " + fmt(r.resultado),
    };
  })()`);
}

// Lee de Firestore lo que necesita el código de la plataforma
async function leerDatos(db) {
  const lista = async (col) => (await db.collection(col).get()).docs.map((d) => ({ id: d.id, ...d.data() }));
  const config = {};
  (await db.collection("config").get()).docs.forEach((d) => (config[d.id] = d.data()));
  const [estudiantes, pagos, finanzas, trabajadores, cuentas_pagar] = await Promise.all(
    ["estudiantes", "pagos", "finanzas", "trabajadores", "cuentas_pagar"].map(lista)
  );
  return { config, estudiantes, pagos, finanzas, trabajadores, cuentas_pagar };
}

async function main(tipo) {
  if (!(tipo in BASE))
    throw new Error("Tipo de aviso desconocido: " + tipo + " (dia, quincena, prueba o respaldo-fallo)");
  const { db, messaging } = conectar();
  let m;
  if (tipo === "prueba") m = { titulo: "🔔 Aviso de prueba", cuerpo: "Los avisos del colegio llegan a este equipo." };
  else if (tipo === "respaldo-fallo")
    m = { titulo: "⚠️ No se pudo hacer el respaldo", cuerpo: "Revisa GitHub → Actions → Respaldo semanal." };
  else {
    const p = await cargarApp(await leerDatos(db));
    m = tipo === "dia" ? mensajeDia(p) : mensajeQuincena(p);
  }
  if (!m) return console.log("Nada que avisar hoy.");
  const r = await enviarAvisos(db, messaging, tipo, m.titulo, m.cuerpo);
  console.log(
    `${m.titulo}\n${m.cuerpo}\n→ enviados: ${r.enviados}, fallidos: ${r.fallidos}, equipos quitados: ${r.borrados}`
  );
}

if (require.main === module)
  main(process.argv[2] || process.env.TIPO || "prueba").catch((e) => {
    console.error("❌ No se pudieron mandar los avisos:", e.message);
    process.exit(1);
  });

module.exports = { enviarAvisos, mensajeDia, mensajeQuincena, leerDatos, main };
