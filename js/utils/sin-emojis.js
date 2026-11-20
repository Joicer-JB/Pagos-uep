// Pantallas sin emojis decorativos: los textos de la app traen un emoji delante («📋 Lista», «💾 Guardar»). En vez de
// tocar cientos de textos, aquí se quita el emoji del comienzo de cada texto que aparece en la pantalla (#app).
// Solo el del comienzo y solo si queda texto: un botón que es solo un emoji (✕, 🗑️) se deja igual, y los emojis en
// medio o al final de un texto (estados, estrellas) no se tocan. Lo que se imprime, los mensajes de WhatsApp y los
// recibos no pasan por aquí: salen exactamente igual que antes.
const EMOJI_INICIAL =
  /^(\s*)(?:(?![✓✔✕✖★☆⭐▲▼▶◀•·])(?:\p{Extended_Pictographic}|\p{Regional_Indicator})(?:️|‍\p{Extended_Pictographic}️?|[\u{1F3FB}-\u{1F3FF}])*\s*)+/u;
function sinEmojiInicial(txt) {
  if (!txt) return txt;
  const m = EMOJI_INICIAL.exec(txt);
  if (!m) return txt;
  const resto = txt.slice(m[0].length);
  return resto.trim() ? m[1] + resto : txt;
}
const soloEmoji = (txt) => {
  const m = EMOJI_INICIAL.exec(txt || "");
  return !!m && m[0].length === txt.length && !!txt.trim();
};
const NO_LIMPIAR = "textarea, script, style, svg, select, [contenteditable], .sin-limpiar";
const CONTROLES = new Set(["BUTTON", "A", "LABEL", "OPTION", "SUMMARY", "TD", "TH", "LI"]);
// Un emoji que va solo en su propia etiqueta (<span>☀️</span> Buenos días) también es decorativo si es lo primero
// que se lee de un rótulo que sigue con texto. No se sube más allá de un botón ni de una celda.
function quitarEmojiSuelto(n) {
  let el = n.parentElement;
  for (let i = 0; el && i < 3; i++) {
    const txt = el.textContent || "";
    if (txt.trim() !== n.nodeValue.trim()) {
      const recorrido = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      while (recorrido.nextNode()) {
        const t = recorrido.currentNode;
        if (!t.nodeValue.trim()) continue;
        if (t !== n) return;
        break;
      }
      const dueno = n.parentElement;
      n.nodeValue = "";
      if (dueno !== el && !dueno.textContent.trim() && !dueno.children.length) dueno.style.display = "none";
      return;
    }
    if (CONTROLES.has(el.tagName) || el.id === "app") return;
    el = el.parentElement;
  }
}
function limpiarTexto(n) {
  const v = n.nodeValue;
  if (!v || !v.trim() || !n.parentElement || n.parentElement.closest(NO_LIMPIAR)) return;
  if (soloEmoji(v)) return quitarEmojiSuelto(n);
  const t = sinEmojiInicial(v);
  if (t !== v) n.nodeValue = t;
}
function limpiarEmojis(raiz) {
  if (!raiz) return;
  if (raiz.nodeType === 3) return limpiarTexto(raiz);
  if (raiz.nodeType !== 1 || raiz.closest(NO_LIMPIAR)) return;
  const recorrido = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT);
  const textos = [];
  while (recorrido.nextNode()) textos.push(recorrido.currentNode);
  textos.forEach(limpiarTexto);
  const conAyuda = raiz.matches("[placeholder]") ? [raiz] : [];
  for (const el of conAyuda.concat([...raiz.querySelectorAll("[placeholder]")])) {
    const t = sinEmojiInicial(el.getAttribute("placeholder"));
    if (t !== el.getAttribute("placeholder")) el.setAttribute("placeholder", t);
  }
}
if (typeof document !== "undefined" && typeof MutationObserver !== "undefined" && document.getElementById) {
  const app = document.getElementById("app");
  if (app) {
    new MutationObserver((cambios) => {
      for (const c of cambios) for (const n of c.addedNodes) limpiarEmojis(n);
    }).observe(app, { childList: true, subtree: true });
  }
}
