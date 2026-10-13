// Sin conexión: la plataforma sigue funcionando si se va el internet.
// · Firestore guarda una copia de los datos en el equipo (se activa en config.js) y los cambios hechos sin conexión
//   se suben solos al volver.
// · Las escrituras no esperan la respuesta del servidor si no hay conexión (o si tarda más de unos segundos): el
//   cambio ya quedó guardado en el equipo. Si luego el servidor lo rechaza, se avisa.
// · Los cobros sin conexión llevan un número de recibo provisional (PROV-…); al volver la conexión reciben su número
//   correlativo (FAC-…) solos (ver servicios/cobros.js).
// · Un aviso abajo de la pantalla dice cuándo no hay conexión y cuándo se están subiendo los cambios.
// Para entrar por primera vez en un equipo sí hace falta internet.

const ESPERA_SERVIDOR_MS = 4000;

// Devuelve una promesa que termina cuando el servidor confirma, o antes si no hay conexión o tarda demasiado
function sinEsperarServidor(promesa) {
  let siguio = false; // la app ya siguió adelante sin la confirmación
  promesa.catch((e) => siguio && avisarErrorTardio(e));
  const espera = navigator.onLine ? ESPERA_SERVIDOR_MS : 300;
  return Promise.race([
    promesa,
    new Promise((ok) =>
      setTimeout(() => {
        siguio = true;
        ok();
      }, espera)
    ),
  ]);
}
function avisarErrorTardio(e) {
  console.error("Un cambio no se pudo subir:", e);
  alert(
    "⚠️ Un cambio hecho sin conexión no se pudo guardar en la nube (" + e.message + "). Revisa y vuelve a hacerlo."
  );
}

// Todas las escrituras de la app pasan por aquí (envuelve los métodos de Firestore)
(function () {
  try {
    const fs = firebase.firestore;
    ["set", "update", "delete"].forEach((m) => {
      const original = fs.DocumentReference.prototype[m];
      fs.DocumentReference.prototype[m] = function (...a) {
        return sinEsperarServidor(original.apply(this, a));
      };
    });
    const commit = fs.WriteBatch.prototype.commit;
    fs.WriteBatch.prototype.commit = function (...a) {
      return sinEsperarServidor(commit.apply(this, a));
    };
    // add() espera al servidor para devolver el documento: se hace con doc() + set(), que ya tiene el id
    fs.CollectionReference.prototype.add = function (datos) {
      const ref = this.doc();
      return ref.set(datos).then(() => ref);
    };
  } catch (e) {
    console.warn("No se pudo preparar el trabajo sin conexión:", e.message);
  }
})();

// ---- Aviso de conexión
function avisoConexion(html, clase) {
  let a = document.getElementById("aviso-conexion");
  if (!html) return a && a.remove();
  if (!a) {
    a = document.createElement("div");
    a.id = "aviso-conexion";
    a.setAttribute("role", "status");
    document.body.appendChild(a);
  }
  a.className = "aviso-conexion " + (clase || "");
  a.innerHTML = html;
}
function alPerderConexion() {
  avisoConexion(
    "📴 <strong>Sin internet.</strong> Puedes seguir cobrando: los recibos quedan con número provisional y se suben solos al volver la conexión.",
    "sin-conexion"
  );
}
async function alRecuperarConexion() {
  if (!auth) return avisoConexion("");
  avisoConexion("🔄 Conexión recuperada: subiendo los cambios…", "subiendo");
  try {
    await db.waitForPendingWrites();
    await numerarRecibosPendientes();
  } catch (e) {
    console.warn(e.message);
  }
  if (!navigator.onLine) return alPerderConexion();
  avisoConexion("✅ Todo está al día.", "al-dia");
  setTimeout(() => navigator.onLine && avisoConexion(""), 3000);
  if (typeof render === "function" && esSeguroRedibujar()) render();
}
window.addEventListener("offline", alPerderConexion);
window.addEventListener("online", alRecuperarConexion);
// Al abrir la app sin conexión
if (!navigator.onLine) document.addEventListener("DOMContentLoaded", alPerderConexion);
