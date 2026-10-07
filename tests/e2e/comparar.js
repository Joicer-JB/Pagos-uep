// Compara dos recorridos (antes y después de un cambio) y muestra la primera diferencia de cada paso.
// Uso: node tests/e2e/comparar.js antes.json despues.json
const fs = require("fs");

const [a, b] = process.argv.slice(2).map((f) => JSON.parse(fs.readFileSync(f, "utf8")));
let diferencias = 0;

function primeraDiferencia(x, y) {
  let i = 0;
  while (i < x.length && x[i] === y[i]) i++;
  return `\n    antes:   …${x.slice(Math.max(0, i - 80), i + 120)}\n    después: …${y.slice(Math.max(0, i - 80), i + 120)}`;
}

// Los pasos se emparejan por nombre: un paso nuevo o quitado se informa sin desordenar la comparación
const porNombre = (fotos) => new Map(fotos.map((f) => [f.paso, f]));
const pa = porNombre(a.fotos),
  pb = porNombre(b.fotos);
const n = new Set([...pa.keys(), ...pb.keys()]).size;
for (const nombre of pa.keys()) if (!pb.has(nombre)) (diferencias++, console.log(`✗ Paso quitado: ${nombre}`));
for (const nombre of pb.keys()) if (!pa.has(nombre)) (diferencias++, console.log(`✗ Paso nuevo: ${nombre}`));
for (const [nombre, fa] of pa) {
  const fb = pb.get(nombre);
  if (!fb) continue;
  for (const campo of Object.keys(fa)) {
    const va = JSON.stringify(fa[campo]),
      vb = JSON.stringify(fb[campo]);
    if (va !== vb) {
      diferencias++;
      console.log(`✗ ${nombre} — cambia "${campo}":${primeraDiferencia(va, vb)}`);
    }
  }
}
if (JSON.stringify(a.errores) !== JSON.stringify(b.errores)) {
  diferencias++;
  console.log(
    "✗ Errores distintos:\n  antes:   " +
      a.errores.join("\n           ") +
      "\n  después: " +
      b.errores.join("\n           ")
  );
}
console.log(diferencias ? `\n${diferencias} diferencia(s) en ${n} pasos` : `✓ Idénticos: ${n} pasos sin diferencias`);
process.exit(diferencias ? 1 : 0);
