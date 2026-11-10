// Bibliotecas pesadas que no hacen falta al abrir la página: se cargan la primera vez que se usan.
// Así la plataforma arranca más rápido en las computadoras sencillas.

// Excel (SheetJS, casi 1 MB): solo para importar o exportar. La dirección y la huella (integrity) están en index.html,
// en <script id="lib-xlsx" type="text/x-diferida">, que el navegador no ejecuta. Aquí se crea uno igual pero normal.
let _xlsxCargando = null;
function cargarXLSX() {
  if (typeof XLSX !== "undefined") return Promise.resolve();
  if (_xlsxCargando) return _xlsxCargando;
  const modelo = document.getElementById("lib-xlsx");
  if (!modelo) return Promise.reject(new Error("no se encontró la biblioteca de Excel"));
  _xlsxCargando = new Promise((ok, no) => {
    const s = document.createElement("script");
    s.src = modelo.getAttribute("src");
    s.integrity = modelo.getAttribute("integrity");
    s.crossOrigin = "anonymous";
    s.onload = () => (typeof XLSX !== "undefined" ? ok() : no(new Error("la biblioteca de Excel no cargó")));
    s.onerror = () => no(new Error("no se pudo cargar la biblioteca de Excel (¿sin internet?)"));
    document.head.appendChild(s);
  }).catch((e) => {
    _xlsxCargando = null; // la próxima vez se vuelve a intentar
    throw e;
  });
  return _xlsxCargando;
}
