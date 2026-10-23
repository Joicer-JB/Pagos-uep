// Respaldo automático de toda la base de datos. Lo corre GitHub Actions cada viernes a las 5 de la tarde
// (.github/workflows/respaldo.yml); también se puede correr a mano desde la pestaña Actions de GitHub.
//
// Lee todas las colecciones de Firestore con la cuenta de servicio del proyecto (secreto FIREBASE_SERVICE_ACCOUNT),
// las guarda en un archivo cifrado con la clave del respaldo (secreto RESPALDO_CLAVE) y anota la fecha en
// config/respaldo, que el director ve en Inicio y en Configuración → Año escolar.
// El archivo solo se abre en la plataforma: Configuración → Año escolar → «Abrir un respaldo», con la misma clave.
const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");
const { cifrar } = require("./cifrado");

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
  if (v instanceof admin.firestore.Timestamp) return { __tipo: "fecha", valor: v.toDate().toISOString() };
  if (v instanceof admin.firestore.DocumentReference) return { __tipo: "referencia", ruta: v.path };
  if (v instanceof admin.firestore.GeoPoint) return { __tipo: "punto", lat: v.latitude, lng: v.longitude };
  if (Buffer.isBuffer(v) || v instanceof Uint8Array)
    return { __tipo: "bytes", base64: Buffer.from(v).toString("base64") };
  if (Array.isArray(v)) return v.map(aJSON);
  return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, aJSON(x)]));
}

async function main() {
  const cuenta = process.env.FIREBASE_SERVICE_ACCOUNT,
    clave = process.env.RESPALDO_CLAVE;
  if (!cuenta) throw new Error("Falta el secreto FIREBASE_SERVICE_ACCOUNT (ver docs/respaldo-automatico.md)");
  if (!clave) throw new Error("Falta el secreto RESPALDO_CLAVE (ver docs/respaldo-automatico.md)");
  const credencial = JSON.parse(cuenta);
  admin.initializeApp({ credential: admin.credential.cert(credencial) });
  const db = admin.firestore();

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
    proyecto: credencial.project_id,
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
}

main().catch((e) => {
  console.error("❌ No se pudo hacer el respaldo:", e.message);
  process.exit(1);
});
