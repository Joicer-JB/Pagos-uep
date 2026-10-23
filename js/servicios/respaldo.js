// Abrir un respaldo automático (lo hace GitHub Actions cada viernes, ver herramientas/respaldo/respaldo.js).
// El archivo viene cifrado: JSON comprimido (gzip) y cifrado con AES-256-GCM, con la llave sacada de la clave del
// respaldo con PBKDF2-SHA256. Aquí se descifra en el propio navegador: la clave no sale del equipo.

const FORMATO_RESPALDO = "pagos-uep-respaldo";
const bytesDeBase64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

// Devuelve el contenido del respaldo: {generado, proyecto, totales: {colección: n}, colecciones: {colección: [{id, datos}]}}
async function descifrarRespaldo(archivo, clave) {
  if (!archivo || archivo.formato !== FORMATO_RESPALDO || archivo.version !== 1)
    throw new Error("Ese archivo no es un respaldo automático de la plataforma");
  if (!clave) throw new Error("Escribe la clave del respaldo");
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(clave), "PBKDF2", false, ["deriveKey"]);
  const llave = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: bytesDeBase64(archivo.sal), iterations: archivo.iteraciones, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );
  let comprimido;
  try {
    comprimido = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: bytesDeBase64(archivo.iv) },
      llave,
      bytesDeBase64(archivo.datos)
    );
  } catch (e) {
    throw new Error("La clave no es correcta (o el archivo está dañado)");
  }
  const texto = await new Response(new Blob([comprimido]).stream().pipeThrough(new DecompressionStream("gzip"))).text();
  return JSON.parse(texto);
}

// ---- Configuración → Año escolar: estado del respaldo automático y abrir un respaldo descargado de GitHub
const URL_RESPALDOS = "https://github.com/Joicer-JB/Pagos-uep/actions/workflows/respaldo.yml";
let respaldoAbierto = null; // {nombre, contenido} del último respaldo abierto en esta sesión

function htmlRespaldoAutomatico() {
  const a = configRespaldo && configRespaldo.automatico;
  const dias = a && a.fecha ? diasEntre(a.fecha, hoyLocal()) : null;
  const atrasado = dias === null || dias > 8;
  return `<div class="card" style="padding:0.85rem">
    <div class="section-title">🔐 Respaldo automático (cada viernes, 5:00 pm)</div>
    <div class="alert-item ${atrasado ? "alert-mora" : "alert-ok"}" style="margin:0.4rem 0"><div>${
      a && a.fecha
        ? `Último respaldo automático: <strong>${escHtml(fechaCorta(a.fecha))}${a.hora ? " a las " + escHtml(a.hora) : ""}</strong> · ${Number(a.documentos) || 0} registros${atrasado ? ` · ⚠️ hace ${dias} días: revisa la pestaña Actions de GitHub` : ""}`
        : "⚠️ Todavía no se ha hecho ningún respaldo automático. Mira docs/respaldo-automatico.md para activarlo."
    }</div></div>
    <div style="font-size:0.74rem;color:#555;line-height:1.5">Los respaldos quedan guardados 90 días en <a href="${URL_RESPALDOS}" target="_blank" rel="noopener">GitHub → Actions → Respaldo semanal</a> (abre la corrida y descarga el archivo de «Artifacts»). Vienen cifrados: solo se abren aquí, con la clave del respaldo.</div>
    <div class="form-row" style="margin-top:0.6rem">
      <div class="field"><label class="field-label">Archivo del respaldo (.cifrado.json)</label><input class="inp" type="file" id="resp-archivo" accept=".json,application/json"/></div>
      <div class="field"><label class="field-label">Clave del respaldo</label><input class="inp" type="password" id="resp-clave" autocomplete="off"/></div>
    </div>
    <button class="btn btn-primary btn-sm" style="margin-top:0.5rem" onclick="abrirRespaldo()">🔓 Abrir respaldo</button>
    <div id="resp-res" style="margin-top:0.5rem">${respaldoAbierto ? htmlRespaldoAbierto() : ""}</div>
  </div>`;
}
function htmlRespaldoAbierto() {
  const r = respaldoAbierto,
    t = r.contenido.totales || {};
  return `<div class="alert-item alert-ok"><div>✅ <strong>${escHtml(r.nombre)}</strong> · hecho el ${escHtml(new Date(r.contenido.generado).toLocaleString("es-VE"))}</div></div>
    ${Object.keys(t)
      .sort()
      .map((c) => `<div class="info-row"><span>${escHtml(c)}</span><strong>${t[c]}</strong></div>`)
      .join("")}
    <button class="btn btn-gray btn-sm" style="margin-top:0.4rem" onclick="descargarRespaldoAbierto()">💾 Descargar sin cifrar (JSON)</button>`;
}
async function abrirRespaldo() {
  const inp = document.getElementById("resp-archivo"),
    clave = (document.getElementById("resp-clave") || {}).value || "",
    res = document.getElementById("resp-res");
  const f = inp && inp.files && inp.files[0];
  if (!f) return mostrarError(res, "Elige el archivo del respaldo");
  res.innerHTML = '<div style="font-size:0.78rem;color:#555">⏳ Abriendo…</div>';
  try {
    let archivo;
    try {
      archivo = JSON.parse(await f.text());
    } catch (e) {
      throw new Error("Ese archivo no es un respaldo automático de la plataforma");
    }
    respaldoAbierto = { nombre: f.name, contenido: await descifrarRespaldo(archivo, clave) };
    res.innerHTML = htmlRespaldoAbierto();
  } catch (e) {
    respaldoAbierto = null;
    mostrarError(res, e.message);
  }
}
function descargarRespaldoAbierto() {
  if (!respaldoAbierto) return;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(respaldoAbierto.contenido)], { type: "application/json" }));
  a.download = respaldoAbierto.nombre.replace(/\.cifrado\.json$/i, "") + ".json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
