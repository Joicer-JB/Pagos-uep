// Documentos del personal (certificado de salud, título, cédula, RIF…), para verlos o imprimirlos cuando hagan falta.
// El archivo se guarda en Firestore, en la colección «documentos_trabajadores», partido en trozos de ~700 KB (un
// documento de Firestore no puede pasar de 1 MB): <adjunto>_0, <adjunto>_1… La ficha del trabajador solo lleva la
// lista: adjuntos = [{id, clase, nombre, tipo, tam, partes, fecha, vence?, por}]. Las fotos se achican antes de
// guardarse (quedan como una hoja escaneada, se leen bien y pesan poco).

const CLASES_DOCUMENTO = {
  salud: "🩺 Certificado de salud",
  titulo: "🎓 Título",
  cedula: "🪪 Cédula",
  rif: "🧾 RIF",
  otro: "📄 Otro documento",
};
const COL_DOCUMENTOS = "documentos_trabajadores";
const TAM_TROZO = 700000; // caracteres de base64 por documento de Firestore
const MAX_DOCUMENTO = 4 * 1024 * 1024; // 4 MB después de achicar
const LADO_MAX_FOTO = 1800; // píxeles del lado más largo

const leerComoDataURL = (archivo) =>
  new Promise((ok, no) => {
    const r = new FileReader();
    r.onload = () => ok(r.result);
    r.onerror = () => no(new Error("no se pudo leer el archivo"));
    r.readAsDataURL(archivo);
  });
// Una foto grande del teléfono (3-5 MB) queda en unos 300 KB
async function achicarFoto(archivo) {
  const url = URL.createObjectURL(archivo);
  try {
    const img = await new Promise((ok, no) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => no(new Error("la foto no se pudo abrir"));
      i.src = url;
    });
    const escala = Math.min(1, LADO_MAX_FOTO / Math.max(img.naturalWidth, img.naturalHeight));
    const lienzo = document.createElement("canvas");
    lienzo.width = Math.max(1, Math.round(img.naturalWidth * escala));
    lienzo.height = Math.max(1, Math.round(img.naturalHeight * escala));
    const ctx = lienzo.getContext("2d");
    ctx.fillStyle = "#fff"; // las PNG transparentes quedan sobre blanco
    ctx.fillRect(0, 0, lienzo.width, lienzo.height);
    ctx.drawImage(img, 0, 0, lienzo.width, lienzo.height);
    return lienzo.toDataURL("image/jpeg", 0.82);
  } finally {
    URL.revokeObjectURL(url);
  }
}
// {tipo, datos (base64 sin el encabezado)} listo para guardar, o un error que se le puede mostrar a la persona
async function prepararDocumento(archivo) {
  if (!archivo) throw new Error("Elige el archivo");
  const esPdf = archivo.type === "application/pdf" || /\.pdf$/i.test(archivo.name || "");
  const esFoto =
    /^image\/(jpeg|png|webp|heic|heif)$/.test(archivo.type) || /\.(jpe?g|png|webp)$/i.test(archivo.name || "");
  if (!esPdf && !esFoto) throw new Error("Solo se pueden adjuntar fotos (JPG o PNG) o archivos PDF");
  const dataUrl = esPdf ? await leerComoDataURL(archivo) : await achicarFoto(archivo);
  const datos = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const tam = Math.round((datos.length * 3) / 4);
  if (tam > MAX_DOCUMENTO)
    throw new Error(
      "El archivo pesa " +
        (tam / 1048576).toFixed(1).replace(".", ",") +
        " MB y el máximo es 4 MB. Escanéalo en menor calidad o tómale una foto."
    );
  return { tipo: esPdf ? "application/pdf" : "image/jpeg", datos, tam };
}

async function adjuntarDocumentoTrabajador(trabId, { clase, archivo, vence }) {
  const t = trabajadores.find((x) => x.id === trabId);
  if (!t) throw new Error("No se encontró el trabajador");
  if (!CLASES_DOCUMENTO[clase]) throw new Error("Elige qué documento es");
  const doc = await prepararDocumento(archivo);
  const id = db.collection(COL_DOCUMENTOS).doc().id;
  const trozos = [];
  for (let i = 0; i < doc.datos.length; i += TAM_TROZO) trozos.push(doc.datos.slice(i, i + TAM_TROZO));
  const adjunto = {
    id,
    clase,
    nombre: String(archivo.name || CLASES_DOCUMENTO[clase]).slice(0, 120),
    tipo: doc.tipo,
    tam: doc.tam,
    partes: trozos.length,
    fecha: todayStr(),
    por: correoUsuario(),
  };
  if (vence) adjunto.vence = vence;
  const adjuntos = [...(Array.isArray(t.adjuntos) ? t.adjuntos : []), adjunto];
  const lote = db.batch();
  trozos.forEach((datos, parte) =>
    lote.set(db.collection(COL_DOCUMENTOS).doc(id + "_" + parte), {
      trabajadorId: trabId,
      adjuntoId: id,
      parte,
      partes: trozos.length,
      tipo: doc.tipo,
      datos,
    })
  );
  lote.update(db.collection("trabajadores").doc(trabId), { adjuntos });
  await lote.commit();
  t.adjuntos = adjuntos;
  return adjunto;
}
async function leerDocumentoTrabajador(adj) {
  const trozos = await Promise.all(
    Array.from({ length: adj.partes || 1 }, (_, i) =>
      db
        .collection(COL_DOCUMENTOS)
        .doc(adj.id + "_" + i)
        .get()
    )
  );
  if (trozos.some((d) => !d.exists)) throw new Error("El archivo no está completo en la base de datos");
  return "data:" + adj.tipo + ";base64," + trozos.map((d) => d.data().datos).join("");
}
async function quitarDocumentoTrabajador(trabId, adjId) {
  const t = trabajadores.find((x) => x.id === trabId);
  const adj = t && (t.adjuntos || []).find((a) => a.id === adjId);
  if (!adj) return;
  const adjuntos = t.adjuntos.filter((a) => a.id !== adjId);
  const lote = db.batch();
  for (let i = 0; i < (adj.partes || 1); i++) lote.delete(db.collection(COL_DOCUMENTOS).doc(adjId + "_" + i));
  lote.update(db.collection("trabajadores").doc(trabId), { adjuntos });
  await lote.commit();
  t.adjuntos = adjuntos;
}
// Ver o imprimir: la foto sale en una hoja con el nombre del trabajador; el PDF se abre en el visor del navegador
// (en el teléfono se descarga, para abrirlo e imprimirlo desde ahí)
async function imprimirDocumentoTrabajador(trabId, adjId) {
  const t = trabajadores.find((x) => x.id === trabId);
  const adj = t && (t.adjuntos || []).find((a) => a.id === adjId);
  if (!adj) return;
  let dataUrl;
  try {
    dataUrl = await leerDocumentoTrabajador(adj);
  } catch (e) {
    return alert("No se pudo abrir el documento: " + e.message);
  }
  if (adj.tipo === "application/pdf") {
    const bin = atob(dataUrl.slice(dataUrl.indexOf(",") + 1));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    if (!imprimirEnPagina() && window.open(url, "_blank")) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = adj.nombre && /\.pdf$/i.test(adj.nombre) ? adj.nombre : "documento.pdf";
    document.body.appendChild(a);
    a.click();
    a.remove();
    return;
  }
  const w = abrirVentanaImpresion("width=800,height=1000");
  if (!w) return alert("Permite las ventanas emergentes para imprimir");
  w.document
    .write(`<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>${escHtml(CLASES_DOCUMENTO[adj.clase].replace(/^\S+\s/, ""))} - ${escHtml(t.nombre)}</title>
  <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Segoe UI',Arial,sans-serif;color:#222;background:#fff;padding:0.6rem}
  .pie{font-size:0.7rem;color:#555;margin-bottom:0.4rem}img{display:block;max-width:100%;max-height:250mm;margin:0 auto}
  @page{margin:8mm}</style></head><body>
  <div class="pie">${escHtml(CLASES_DOCUMENTO[adj.clase])} · ${escHtml(t.nombre)}${t.cedula ? " · C.I. " + escHtml(t.cedula) : ""}${adj.vence ? " · vence el " + escHtml(fechaCorta(adj.vence)) : ""}</div>
  <img src="${dataUrl}" alt="Documento"/>
  </body></html>`);
  w.document.close();
}
