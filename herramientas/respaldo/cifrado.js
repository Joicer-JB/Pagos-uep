// Cifrado del respaldo automático. El archivo se abre en la plataforma (js/servicios/respaldo.js) con la misma clave:
// JSON comprimido (gzip) y cifrado con AES-256-GCM; la llave sale de la clave con PBKDF2-SHA256.
// Así, aunque alguien descargue el archivo de GitHub, sin la clave no puede leer nada.
const crypto = require("crypto");
const zlib = require("zlib");

const FORMATO = "pagos-uep-respaldo";
const ITERACIONES = 310000;

function cifrar(texto, clave) {
  if (!clave || String(clave).length < 12) throw new Error("La clave del respaldo debe tener al menos 12 caracteres");
  const sal = crypto.randomBytes(16),
    iv = crypto.randomBytes(12);
  const llave = crypto.pbkdf2Sync(String(clave), sal, ITERACIONES, 32, "sha256");
  const c = crypto.createCipheriv("aes-256-gcm", llave, iv);
  const datos = Buffer.concat([c.update(zlib.gzipSync(Buffer.from(texto, "utf8"))), c.final(), c.getAuthTag()]);
  return {
    formato: FORMATO,
    version: 1,
    cifrado: "AES-256-GCM",
    kdf: "PBKDF2-SHA256",
    iteraciones: ITERACIONES,
    sal: sal.toString("base64"),
    iv: iv.toString("base64"),
    datos: datos.toString("base64"),
  };
}

module.exports = { cifrar, FORMATO };
