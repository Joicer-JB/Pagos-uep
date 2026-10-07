// Abre la app en este equipo para probarla: http://localhost:8080
// Usa la base de datos REAL de Firebase (los cambios que hagas quedan guardados).
// Uso: npm run servir   (detener con Ctrl+C)
const http = require("http");
const fs = require("fs");
const path = require("path");

const RAIZ = path.resolve(__dirname, "..");
const PUERTO = Number(process.env.PUERTO) || 8080;
const TIPOS = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

http
  .createServer((req, res) => {
    const ruta = decodeURIComponent(new URL(req.url, "http://x").pathname);
    const archivo = path.join(RAIZ, ruta === "/" ? "index.html" : ruta);
    if (
      !archivo.startsWith(RAIZ) ||
      archivo.includes("node_modules") ||
      !fs.existsSync(archivo) ||
      fs.statSync(archivo).isDirectory()
    ) {
      res.writeHead(404);
      return res.end("No encontrado");
    }
    res.writeHead(200, {
      "Content-Type": TIPOS[path.extname(archivo)] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    fs.createReadStream(archivo).pipe(res);
  })
  .listen(PUERTO, () => console.log(`App en http://localhost:${PUERTO}  (Ctrl+C para detener)`));
