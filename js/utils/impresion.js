// Ventana para imprimir (recibos, cierres, boletines, reportes).
// En la computadora se abre una ventana nueva, como siempre. En el teléfono, y sobre todo en la app instalada, una
// ventana nueva no tiene cómo volver: ahí el documento se muestra encima de la app, con «← Volver», «🖨️ Imprimir» y
// «📤 Compartir» (el documento como imagen, para WhatsApp o para imprimirlo desde la galería: algunos teléfonos, como
// el iPhone con la app instalada, no dejan imprimir desde una app).
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
      <button class="btn btn-primary" data-accion="imprimir">🖨️ Imprimir</button>
      <button class="btn btn-primary" data-accion="compartir">📤 Compartir</button>
    </div><div class="impresion-aviso" role="status"></div><div class="impresion-hoja"></div>`;
  const hoja = capa.querySelector(".impresion-hoja").attachShadow({ mode: "open" });
  const pagina = document.createElement("style"); // reglas @page del documento (p. ej. hoja horizontal)
  let html = "",
    titulo = "documento",
    estilos = "",
    cuerpo = "",
    abierta = true;
  const aviso = (t) => (capa.querySelector(".impresion-aviso").innerHTML = t);

  // Se llama directo desde el toque (algunos teléfonos solo imprimen si viene de un toque). Si el navegador no abre
  // la impresión (no llega «beforeprint»), se sugiere compartir el documento como imagen.
  const imprimir = () => {
    let abrio = false;
    const marcar = () => (abrio = true);
    window.addEventListener("beforeprint", marcar, { once: true });
    try {
      window.print();
    } catch (e) {
      console.warn("Imprimir:", e.message);
    }
    setTimeout(() => {
      window.removeEventListener("beforeprint", marcar);
      if (!abrio && abierta)
        aviso(
          "⚠️ Este teléfono no abrió la impresión. Toca <strong>📤 Compartir</strong> para enviar el documento como imagen (por WhatsApp, o para imprimirlo desde la galería)."
        );
    }, 1500);
  };
  const compartir = async () => {
    aviso("⏳ Preparando la imagen…");
    try {
      const blob = await imagenDeDocumento(capa.querySelector(".impresion-hoja"), estilos, cuerpo);
      const nombre = titulo.replace(/[^\wÁÉÍÓÚáéíóúÑñ-]+/g, "_").replace(/^_+|_+$/g, "") + ".png";
      const archivo = new File([blob], nombre, { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [archivo] })) {
        aviso("");
        await navigator.share({ files: [archivo], title: titulo });
        return;
      }
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = nombre;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 30000);
      aviso("✅ Imagen guardada en Descargas: puedes imprimirla o enviarla.");
    } catch (e) {
      if (e && e.name === "AbortError") return aviso(""); // canceló el menú de compartir
      aviso("⚠️ No se pudo crear la imagen (" + escHtml(e.message) + "). Puedes hacer una captura de pantalla.");
    }
  };
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
  capa.querySelector('[data-accion="compartir"]').onclick = compartir;

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
        css = css.replace(/@page\s*\{[^}]*\}/g, "").replace(/(^|[\s,{}])body(?=[\s,{.:#[])/g, "$1.cuerpo");
        doc.querySelectorAll("script").forEach((s) => s.remove());
        titulo = (doc.title || "documento").trim();
        estilos = `.cuerpo{background:#fff;color:#222}${css}`;
        cuerpo = doc.body.innerHTML;
        hoja.innerHTML = `<style>${estilos}</style><div class="cuerpo">${cuerpo}</div>`;
        // Los documentos que se imprimían solos al abrirse (window.onload → print) lo siguen haciendo
        if (/window\.onload\s*=\s*function\s*\(\)\s*\{\s*window\.print\(\)/.test(html)) imprimir();
      },
    },
    print: imprimir,
    close: cerrar,
    focus() {},
  };
}

// Dibuja el documento (tal como se ve) en una imagen PNG, sin bibliotecas: el HTML va dentro de un SVG
// («foreignObject») que se pinta en un canvas al doble de resolución para que se lea bien al imprimir.
async function imagenDeDocumento(host, estilos, cuerpo) {
  const visible = host.shadowRoot.querySelector(".cuerpo");
  const ancho = Math.ceil(host.getBoundingClientRect().width) || 600;
  const alto = Math.ceil(visible.getBoundingClientRect().height) + 8;
  const caja = document.createElement("div");
  caja.innerHTML = `<style>${estilos}</style><div class="cuerpo" style="width:${ancho}px">${cuerpo}</div>`;
  caja.querySelectorAll("button").forEach((b) => b.remove()); // «Imprimir» del documento no va en la imagen
  const xhtml = new XMLSerializer().serializeToString(caja);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${ancho}" height="${alto}"><foreignObject width="100%" height="100%">${xhtml}</foreignObject></svg>`;
  const img = new Image();
  await new Promise((ok, no) => {
    img.onload = ok;
    img.onerror = () => no(new Error("no se pudo dibujar el documento"));
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  });
  const escala = 2,
    lienzo = document.createElement("canvas");
  lienzo.width = ancho * escala;
  lienzo.height = alto * escala;
  const ctx = lienzo.getContext("2d");
  ctx.scale(escala, escala);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, ancho, alto);
  ctx.drawImage(img, 0, 0);
  return new Promise((ok, no) => lienzo.toBlob((b) => (b ? ok(b) : no(new Error("sin imagen"))), "image/png"));
}
