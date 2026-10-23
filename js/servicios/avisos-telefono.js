// 📲 Avisos al teléfono (solo el director): notificaciones que llegan aunque la plataforma esté cerrada.
// Las manda GitHub Actions (herramientas/nube/avisos.js, ver .github/workflows/avisos.yml) con Firebase Cloud
// Messaging: el cierre del día, el resumen de cada quincena y si el respaldo del viernes salió bien o falló.
// Aquí se activan en cada equipo: el navegador da un «token» (la dirección de ese equipo para los avisos) y se guarda
// en la colección «avisos_dispositivos», con qué avisos quiere recibir ese equipo.
// iPhone: solo con la app instalada (Compartir → Agregar a inicio) y abierta desde el ícono (iOS 16.4 o más nuevo).

const COL_AVISOS = "avisos_dispositivos";
const TIPOS_AVISO = {
  dia: "💰 Cierre del día (lunes a viernes, 6:00 pm): lo cobrado y las cuentas que vencen",
  quincena: "🗓️ Resumen de la quincena (el 1 y el 16, 7:00 am)",
  respaldo: "💾 Respaldo del viernes: si salió bien o falló",
};
let avisosEquipos = null; // equipos con avisos activados (se cargan al abrir la sección)
const idAvisosEsteEquipo = () => {
  try {
    return localStorage.getItem("avisosId") || "";
  } catch (e) {
    return "";
  }
};

// ¿Este navegador puede recibir avisos? Devuelve "" si sí, o el motivo
async function motivoSinAvisos() {
  if (!VAPID_CLAVE) return "falta-clave";
  if (!("Notification" in window) || !("serviceWorker" in navigator) || !window.PushManager || !firebase.messaging)
    return "navegador";
  try {
    if (firebase.messaging.isSupported && !(await firebase.messaging.isSupported())) return "navegador";
  } catch (e) {
    return "navegador";
  }
  return "";
}
async function huella(texto) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
const nombreEsteEquipo = () => {
  const ua = navigator.userAgent || "";
  const so = /iPhone|iPad/.test(ua)
    ? "iPhone"
    : /Android/.test(ua)
      ? "Android"
      : /Windows/.test(ua)
        ? "Windows"
        : /Mac/.test(ua)
          ? "Mac"
          : "Equipo";
  const nav = /Edg\//.test(ua)
    ? "Edge"
    : /Chrome\//.test(ua)
      ? "Chrome"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Safari\//.test(ua)
          ? "Safari"
          : "";
  return so + (nav ? " · " + nav : "");
};

async function activarAvisos() {
  const res = document.getElementById("avisos-res");
  const decir = (t) => res && (res.innerHTML = t);
  const motivo = await motivoSinAvisos();
  if (motivo === "falta-clave")
    return decir(
      `<div class="alert-item alert-info"><div>Falta un paso en Firebase: la clave de los avisos (ver docs/avisos-telefono.md).</div></div>`
    );
  if (motivo === "navegador")
    return decir(
      `<div class="alert-item alert-mora"><div>Este navegador no recibe avisos. En <strong>iPhone</strong>: instala la app (Compartir → Agregar a inicio) y ábrela desde su ícono. En Android o la computadora, usa Chrome o Edge.</div></div>`
    );
  decir(`<div style="font-size:0.78rem;color:#555">⏳ Activando… si el navegador pregunta, pulsa «Permitir».</div>`);
  try {
    const permiso = await Notification.requestPermission();
    if (permiso !== "granted")
      return decir(
        `<div class="alert-item alert-mora"><div>No se dio permiso para los avisos. Actívalo en la configuración del navegador (🔒 junto a la dirección → Notificaciones → Permitir) y vuelve a intentarlo.</div></div>`
      );
    const reg = await navigator.serviceWorker.ready;
    const token = await firebase.messaging().getToken({ vapidKey: VAPID_CLAVE, serviceWorkerRegistration: reg });
    if (!token) throw new Error("el navegador no dio la dirección para los avisos");
    const id = (await huella(token)).slice(0, 40);
    const equipo = {
      token,
      por: correoUsuario(),
      equipo: nombreEsteEquipo(),
      creado: todayStr(),
      avisos: { dia: true, quincena: true, respaldo: true },
    };
    await db.collection(COL_AVISOS).doc(id).set(equipo);
    try {
      localStorage.setItem("avisosId", id);
    } catch (e) {}
    avisosEquipos = [...(avisosEquipos || []).filter((x) => x.id !== id), { id, ...equipo }];
    reg.showNotification("🔔 Avisos activados", {
      body: "Así te llegarán los avisos del colegio a este equipo.",
      icon: "assets/iconos/icono-192.png",
      badge: "assets/iconos/icono-192.png",
    });
    renderTabContent();
    mostrarToast("✅ Avisos activados en este equipo");
  } catch (e) {
    decir(`<div class="alert-item alert-mora"><div>No se pudieron activar: ${escHtml(e.message)}</div></div>`);
  }
}
async function cargarAvisosEquipos() {
  try {
    const s = await db.collection(COL_AVISOS).get();
    avisosEquipos = s.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (e) {
    avisosEquipos = [];
    console.warn("Avisos:", e.message);
  }
  if (tabActual === "config" && subTab.config === "avisos") renderTabContent();
}
async function cambiarAviso(id, tipo, si) {
  const x = (avisosEquipos || []).find((d) => d.id === id);
  if (!x) return;
  x.avisos = { ...(x.avisos || {}), [tipo]: si };
  try {
    await db.collection(COL_AVISOS).doc(id).update({ avisos: x.avisos });
  } catch (e) {
    alert("No se pudo guardar: " + e.message);
  }
}
async function quitarAvisosEquipo(id) {
  if (!confirm("¿Dejar de mandar avisos a ese equipo?")) return;
  try {
    await db.collection(COL_AVISOS).doc(id).delete();
    avisosEquipos = (avisosEquipos || []).filter((x) => x.id !== id);
    if (id === idAvisosEsteEquipo()) localStorage.removeItem("avisosId");
    renderTabContent();
  } catch (e) {
    alert("No se pudo quitar: " + e.message);
  }
}

// ⚙️ Configuración → 📲 Avisos
function renderConfigAvisos() {
  if (avisosEquipos === null) {
    cargarAvisosEquipos();
    return `<div class="loading" style="padding:1rem">Cargando…</div>`;
  }
  const este = idAvisosEsteEquipo();
  const activoAqui = avisosEquipos.some((x) => x.id === este);
  return `<div class="ayuda" style="margin-bottom:0.7rem">Avisos que te llegan al teléfono (o a la computadora) aunque la plataforma esté cerrada. Actívalos en cada equipo donde los quieras.</div>
    ${!VAPID_CLAVE ? `<div class="alert-item alert-info"><div>Para que funcionen falta un paso en Firebase (2 minutos): ver <strong>docs/avisos-telefono.md</strong>.</div></div>` : ""}
    <button class="btn ${activoAqui ? "btn-gray" : "btn-primary"}" onclick="activarAvisos()">${activoAqui ? "🔄 Volver a activar en este equipo" : "🔔 Activar los avisos en este equipo"}</button>
    <div id="avisos-res" style="margin-top:0.6rem"></div>
    <div class="section-title" style="margin-top:1rem">Equipos que reciben avisos (${avisosEquipos.length})</div>
    ${
      avisosEquipos.length
        ? avisosEquipos
            .map(
              (x) => `<div class="card aviso-equipo" style="padding:0.8rem;margin-bottom:0.5rem">
      <div style="display:flex;justify-content:space-between;gap:0.5rem;align-items:center">
        <div><strong style="color:#003366">📱 ${escHtml(x.equipo || "Equipo")}</strong>${x.id === este ? ` <span class="badge badge-green">este equipo</span>` : ""}<div class="item-sub">Activado el ${escHtml(fechaCorta(x.creado || ""))}</div></div>
        <button class="btn btn-gray btn-sm" onclick="quitarAvisosEquipo('${x.id}')">Quitar</button>
      </div>
      ${Object.entries(TIPOS_AVISO)
        .map(
          ([k, l]) =>
            `<label style="display:flex;gap:0.5rem;align-items:flex-start;font-size:0.8rem;margin-top:0.45rem;cursor:pointer"><input type="checkbox" ${!x.avisos || x.avisos[k] !== false ? "checked" : ""} onchange="cambiarAviso('${x.id}','${k}',this.checked)" style="margin-top:2px"/> ${escHtml(l)}</label>`
        )
        .join("")}
    </div>`
            )
            .join("")
        : `<div class="empty" style="padding:1rem"><p>Todavía ningún equipo recibe avisos.</p></div>`
    }`;
}
