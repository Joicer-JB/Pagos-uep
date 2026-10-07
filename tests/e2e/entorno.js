// Entorno de pruebas en navegador: servidor local, Firebase falso y bibliotecas sin internet.
const http = require("http");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const semilla = require("./datos/semilla");

const RAIZ = path.resolve(__dirname, "../..");
// Carpeta de la app a probar (por defecto este repositorio); útil para comparar con otra versión
const RAIZ_APP = process.env.RAIZ_APP ? path.resolve(process.env.RAIZ_APP) : RAIZ;
const FECHA_PRUEBA = new Date("2026-10-07T10:00:00-04:00");
const TIPOS = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".json": "application/json",
};

// Bibliotecas que la app carga desde CDN: en las pruebas se sirven desde node_modules o con versiones falsas
const leer = (rel) => fs.readFileSync(path.join(RAIZ, rel), "utf8");
const BIBLIOTECAS = [
  [/firebase-app-compat\.js$/, () => leer("tests/e2e/falsos/firebase-falso.js")],
  [/firebase-(firestore|auth)-compat\.js$/, () => "/* incluido en firebase-falso.js */"],
  [/@emailjs\/browser/, () => leer("tests/e2e/falsos/emailjs-falso.js")],
  [/xlsx\.full\.min\.js$/, () => leer("node_modules/xlsx/dist/xlsx.full.min.js")],
  [/chart\.umd\.min\.js$/, () => leer("node_modules/chart.js/dist/chart.umd.js")],
];

function iniciarServidor(raiz = RAIZ) {
  const servidor = http.createServer((req, res) => {
    const ruta = decodeURIComponent(new URL(req.url, "http://x").pathname);
    const archivo = path.join(raiz, ruta === "/" ? "index.html" : ruta);
    if (!archivo.startsWith(raiz) || !fs.existsSync(archivo) || fs.statSync(archivo).isDirectory()) {
      res.writeHead(404);
      return res.end("no encontrado");
    }
    res.writeHead(200, { "Content-Type": TIPOS[path.extname(archivo)] || "application/octet-stream" });
    fs.createReadStream(archivo).pipe(res);
  });
  return new Promise((ok) => servidor.listen(0, "127.0.0.1", () => ok(servidor)));
}

// Se ejecuta en la página antes que la app: datos de prueba y captura de ventanas de impresión/WhatsApp
function preparar(datosSemilla) {
  window.__SEMILLA__ = datosSemilla;
  window.__IMPRESIONES__ = [];
  window.__APERTURAS__ = [];
  window.open = function (url) {
    if (url) {
      window.__APERTURAS__.push(String(url));
      return null;
    }
    const doc = { html: "" };
    window.__IMPRESIONES__.push(doc);
    return {
      document: { write: (t) => (doc.html += t), close() {}, open() {} },
      print() {},
      close() {},
      focus() {},
    };
  };
}

async function abrirNavegador({ datos = semilla } = {}) {
  const servidor = await iniciarServidor(RAIZ_APP);
  const navegador = await chromium.launch();
  const base = `http://127.0.0.1:${servidor.address().port}/`;
  return {
    base,
    async nuevaPagina() {
      const contexto = await navegador.newContext({
        timezoneId: "America/Caracas",
        locale: "es-VE",
        acceptDownloads: true,
      });
      await contexto.route("**/*", (ruta) => {
        const url = ruta.request().url();
        if (url.startsWith(base)) return ruta.continue();
        const lib = BIBLIOTECAS.find(([re]) => re.test(url));
        if (lib) return ruta.fulfill({ status: 200, contentType: "text/javascript", body: lib[1]() });
        if (url.includes("dolarapi.com"))
          return ruta.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ promedio: 184.5, fechaActualizacion: "2026-10-07T08:00:00-04:00" }),
          });
        return ruta.abort(); // nada sale a internet durante las pruebas
      });
      const pagina = await contexto.newPage();
      await pagina.clock.setFixedTime(FECHA_PRUEBA);
      await pagina.addInitScript(preparar, datos);
      const errores = [];
      const dialogos = [];
      pagina.on("pageerror", (e) => errores.push("pageerror: " + e.message));
      pagina.on("console", (m) => m.type() === "error" && errores.push("console: " + m.text()));
      pagina.on("dialog", async (d) => {
        dialogos.push(d.type() + ": " + d.message());
        await d.accept(d.type() === "prompt" ? d.defaultValue() : undefined);
      });
      return { pagina, contexto, errores, dialogos };
    },
    async cerrar() {
      await navegador.close();
      servidor.close();
    },
  };
}

module.exports = { abrirNavegador, FECHA_PRUEBA, RAIZ };
