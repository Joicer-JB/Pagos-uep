// Respaldo automático de toda la base de datos. Lo corre GitHub Actions cada viernes a las 5 de la tarde
// (.github/workflows/respaldo.yml); también se puede correr a mano desde la pestaña Actions de GitHub.
//
// Lee todas las colecciones de Firestore con la cuenta de servicio del proyecto (secreto FIREBASE_SERVICE_ACCOUNT),
// las guarda en un archivo cifrado con la clave del respaldo (secreto RESPALDO_CLAVE) y anota la fecha en
// config/respaldo, que el director ve en Inicio y en Configuración → Año escolar.
// El archivo solo se abre en la plataforma: Configuración → Año escolar → «Abrir un respaldo», con la misma clave.
const fs = require("fs");
const path = require("path");
const { conectar, Timestamp, DocumentReference, GeoPoint } = require("./firebase");
const { cifrar } = require("./cifrado");
const { enviarAvisos } = require("./avisos");

// Fecha y hora de Venezuela (el servidor de GitHub está en UTC)
function ahoraCaracas() {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Caracas",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date())
      .map((x) => [x.type, x.value])
  );
  return { fecha: `${p.year}-${p.month}-${p.day}`, hora: `${p.hour}:${p.minute}` };
}

// Los valores propios de Firestore (fechas, referencias, bytes) pasan a JSON sin perder qué eran
function aJSON(v) {
  if (v === null || typeof v !== "object") return v;
  if (v instanceof Timestamp) return { __tipo: "fecha", valor: v.toDate().toISOString() };
  if (v instanceof DocumentReference) return { __tipo: "referencia", ruta: v.path };
  if (v instanceof GeoPoint) return { __tipo: "punto", lat: v.latitude, lng: v.longitude };
  if (Buffer.isBuffer(v) || v instanceof Uint8Array)
    return { __tipo: "bytes", base64: Buffer.from(v).toString("base64") };
  if (Array.isArray(v)) return v.map(aJSON);
  return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, aJSON(x)]));
}

async function main() {
  const clave = process.env.RESPALDO_CLAVE;
  if (!clave) throw new Error("Falta el secreto RESPALDO_CLAVE (ver docs/respaldo-automatico.md)");
  const { db, messaging, proyecto } = conectar();

  const { fecha, hora } = ahoraCaracas();
  const colecciones = {},
    totales = {};
  for (const col of await db.listCollections()) {
    const s = await col.get();
    colecciones[col.id] = s.docs.map((d) => ({ id: d.id, datos: aJSON(d.data()) }));
    totales[col.id] = s.size;
  }
  const documentos = Object.values(totales).reduce((a, b) => a + b, 0);
  const contenido = JSON.stringify({
    generado: new Date().toISOString(),
    proyecto,
    totales,
    colecciones,
  });
  const archivo = JSON.stringify({
    ...cifrar(contenido, clave),
    generado: new Date().toISOString(),
    fecha,
    documentos,
  });

  const carpeta = process.env.SALIDA || "respaldos";
  fs.mkdirSync(carpeta, { recursive: true });
  const nombre = path.join(carpeta, `respaldo-${fecha}.cifrado.json`);
  fs.writeFileSync(nombre, archivo);

  await db
    .collection("config")
    .doc("respaldo")
    .set(
      { ultimo: fecha, automatico: { fecha, hora, documentos, colecciones: totales, bytes: archivo.length } },
      { merge: true }
    );

  console.log(`Respaldo ${nombre}: ${documentos} documentos en ${Object.keys(totales).length} colecciones`);
  for (const [c, n] of Object.entries(totales)) console.log(`  ${c}: ${n}`);
  // Aviso al teléfono del director (si lo activó). Si falla el aviso, el respaldo igual quedó hecho.
  try {
    const r = await enviarAvisos(
      db,
      messaging,
      "respaldo-ok",
      "💾 Respaldo semanal hecho",
      documentos + " registros guardados (" + fecha + ")"
    );
    console.log("Avisos enviados:", r.enviados);
  } catch (e) {
    console.warn("No se pudo mandar el aviso del respaldo:", e.message);
  }
}

if (require.main === module)
  main().catch((e) => {
    console.error("❌ No se pudo hacer el respaldo:", e.message);
    process.exit(1);
  });

module.exports = { main };
