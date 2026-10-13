// Ventana para imprimir (recibos, cierres, boletines, reportes).
// En la computadora se abre una ventana nueva, como siempre. En el teléfono, y sobre todo en la app instalada, una
// ventana nueva no tiene cómo volver: ahí el documento se muestra encima de la app, con «← Volver» e «🖨️ Imprimir».
// Ambas devuelven lo mismo (document.write/close, print, close), así que las pantallas no cambian.
// El botón «atrás» del teléfono también cierra el documento.

const imprimirEnPagina = () =>
  !!(
    window.matchMedia &&
    (window.matchMedia("(display-mode: standalone)").matches || window.matchMedia("(pointer: coarse)").matches)
  ) || navigator.standalone === true;

function abrirVentanaImpresion(opciones) {
  if (!imprimirEnPagina()) return window.open("", "_blank", opciones || "");
  return ventanaEnPagina();
}

// El documento va dentro de un «shadow root»: sus estilos (body, tablas…) no tocan los de la app.
// Al imprimir, la hoja de estilos de la app oculta todo lo demás (css/estilos.css → .impresion-capa).
function ventanaEnPagina() {
  document.querySelectorAll(".impresion-capa").forEach((c) => c.remove());
  const capa = document.createElement("div");
  capa.className = "impresion-capa";
  capa.innerHTML = `<div class="impresion-barra">
      <button class="btn btn-gray" data-accion="volver">← Volver</button>
      <button class="btn btn-primary" data-accion="imprimir">🖨️ Imprimir / PDF</button>
    </div><div class="impresion-hoja"></div>`;
  const hoja = capa.querySelector(".impresion-hoja").attachShadow({ mode: "open" });
  const pagina = document.createElement("style"); // reglas @page del documento (p. ej. hoja horizontal)
  let html = "",
    abierta = true;

  const imprimir = () => setTimeout(() => window.print(), 50);
  const cerrar = () => {
    if (!abierta) return;
    abierta = false;
    capa.remove();
    pagina.remove();
    document.body.classList.remove("con-impresion");
    window.removeEventListener("popstate", alVolverAtras);
    if (history.state && history.state.impresion) history.back();
  };
  const alVolverAtras = () => {
    if (history.state && history.state.impresion) return;
    abierta && cerrar();
  };
  capa.querySelector('[data-accion="volver"]').onclick = cerrar;
  capa.querySelector('[data-accion="imprimir"]').onclick = imprimir;

  document.body.appendChild(capa);
  document.body.classList.add("con-impresion");
  history.pushState({ impresion: true }, "");
  window.addEventListener("popstate", alVolverAtras);

  return {
    document: {
      open() {},
      write: (t) => (html += t),
      close() {
        const doc = new DOMParser().parseFromString(html, "text/html");
        let css = [...doc.querySelectorAll("style")].map((s) => s.textContent).join("\n");
        pagina.textContent = (css.match(/@page\s*\{[^}]*\}/g) || []).join("\n");
        document.head.appendChild(pagina);
        css = css.replace(/@page\s*\{[^}]*\}/g, "").replace(/(^|[\s,}])body(?=[\s,{.:#[])/g, "$1.cuerpo");
        doc.querySelectorAll("script").forEach((s) => s.remove());
        hoja.innerHTML = `<style>.cuerpo{background:#fff;color:#222}${css}</style><div class="cuerpo">${doc.body.innerHTML}</div>`;
        // Los documentos que se imprimían solos al abrirse (window.onload → print) lo siguen haciendo
        if (/window\.onload\s*=\s*function\s*\(\)\s*\{\s*window\.print\(\)/.test(html)) imprimir();
      },
    },
    print: imprimir,
    close: cerrar,
    focus() {},
  };
}
