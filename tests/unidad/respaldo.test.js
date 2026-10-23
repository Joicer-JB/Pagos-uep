// Respaldo automático: lo que cifra el flujo de GitHub (herramientas/nube/cifrado.js) se abre en la plataforma
// con la misma clave (js/servicios/respaldo.js), y con otra clave no.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { cargar } = require("./cargar");
const { cifrar } = require("../../herramientas/nube/cifrado");

const app = cargar("js/servicios/respaldo.js");
// lo que el navegador trae de fábrica
Object.assign(app, { crypto: globalThis.crypto, atob, TextEncoder, Response, Blob, DecompressionStream });
const abrir = (archivo, clave) => {
  app.__args = [archivo, clave];
  return app.evaluar("descifrarRespaldo(...__args)");
};

const contenido = {
  generado: "2026-10-23T21:00:05.000Z",
  proyecto: "pagos-jjs",
  totales: { pagos: 2, estudiantes: 1 },
  colecciones: {
    pagos: [
      { id: "p1", datos: { nombre: "Ana Pérez", total: 45.5, fecha: "2026-10-02" } },
      {
        id: "p2",
        datos: { nombre: "Ñandú Güiro", total: 10, timestamp: { __tipo: "fecha", valor: "2026-10-02T14:00:00Z" } },
      },
    ],
    estudiantes: [{ id: "e1", datos: { nombre: "Ana Pérez", moraMonto: 0 } }],
  },
};

test("se abre con la misma clave y trae todo igual (acentos incluidos)", async () => {
  const archivo = JSON.parse(JSON.stringify(cifrar(JSON.stringify(contenido), "clave-del-colegio-2026")));
  assert.equal(archivo.formato, "pagos-uep-respaldo");
  assert.doesNotMatch(JSON.stringify(archivo), /Ana|Ñandú|pagos-jjs/); // nada legible sin la clave
  const r = JSON.parse(JSON.stringify(await abrir(archivo, "clave-del-colegio-2026")));
  assert.deepEqual(r, contenido);
});

test("con otra clave, o un archivo que no es respaldo, da un aviso claro", async () => {
  const archivo = cifrar(JSON.stringify(contenido), "clave-del-colegio-2026");
  await assert.rejects(abrir(archivo, "otra-clave-cualquiera"), /La clave no es correcta/);
  await assert.rejects(
    abrir({ ...archivo, datos: archivo.datos.slice(0, -8) + "AAAAAAA=" }, "clave-del-colegio-2026"),
    /clave no es correcta|dañado/
  );
  await assert.rejects(abrir({ estudiantes: [] }, "x"), /no es un respaldo/);
  await assert.rejects(abrir(archivo, ""), /Escribe la clave/);
});

test("la clave del respaldo tiene que ser larga", () => {
  assert.throws(() => cifrar("{}", "corta"), /al menos 12/);
});
