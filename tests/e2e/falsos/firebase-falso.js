// Firebase falso (en memoria) para las pruebas en navegador.
// Imita la parte de la API "compat" v10 que usa la app: initializeApp, auth() y firestore().
// Nunca se conecta a internet: los datos salen de window.__SEMILLA__ y cada escritura
// queda anotada en window.__ESCRITURAS__ para que las pruebas puedan revisarla.
(function () {
  const semilla = window.__SEMILLA__ || { usuarios: [], colecciones: {} };
  const escrituras = (window.__ESCRITURAS__ = []);
  const datos = {};
  for (const [col, docs] of Object.entries(semilla.colecciones || {})) {
    datos[col] = new Map(Object.entries(docs).map(([id, d]) => [id, clonar(d)]));
  }
  let contadorIds = 0;
  const nuevoId = () => "id" + String(++contadorIds).padStart(5, "0");

  function clonar(v) {
    return v === undefined ? undefined : JSON.parse(JSON.stringify(v));
  }
  const esObjeto = (v) => v && typeof v === "object" && !Array.isArray(v) && !(v instanceof Centinela);
  const coleccion = (nombre) => datos[nombre] || (datos[nombre] = new Map());

  // ---------- Valores especiales (FieldValue) ----------
  class Centinela {
    constructor(tipo) {
      this.tipo = tipo;
    }
  }
  // Las pruebas congelan el reloj: la fracción de segundo avanza con cada escritura para conservar el orden
  let nanos = 0;
  const marcaDeTiempo = () => {
    const ms = Date.now();
    return { seconds: Math.floor(ms / 1000), nanoseconds: ++nanos };
  };
  function resolver(valor) {
    if (valor instanceof Centinela) return valor.tipo === "serverTimestamp" ? marcaDeTiempo() : valor;
    if (Array.isArray(valor)) return valor.map(resolver);
    if (esObjeto(valor)) {
      const r = {};
      for (const [k, v] of Object.entries(valor)) r[k] = resolver(v);
      return r;
    }
    return valor;
  }
  function aplicar(destino, cambios, fusionar) {
    for (const [k, v] of Object.entries(cambios)) {
      if (v instanceof Centinela && v.tipo === "delete") {
        delete destino[k];
      } else if (fusionar && esObjeto(v) && esObjeto(destino[k])) {
        aplicar(destino[k], v, true);
      } else {
        destino[k] = clonar(resolver(v));
      }
    }
    return destino;
  }
  // Las marcas de tiempo se devuelven con toDate(), igual que Firestore
  function conToDate(v) {
    if (Array.isArray(v)) return v.map(conToDate);
    if (esObjeto(v)) {
      const r = {};
      for (const [k, x] of Object.entries(v)) r[k] = conToDate(x);
      if (typeof r.seconds === "number" && typeof r.nanoseconds === "number" && Object.keys(r).length === 2) {
        r.toDate = () => new Date(r.seconds * 1000);
        r.toMillis = () => r.seconds * 1000;
      }
      return r;
    }
    return v;
  }

  // ---------- Sin conexión ----------
  // Como Firestore con persistencia: sin internet (navigator.onLine === false, p. ej. context.setOffline(true) en
  // Playwright) cada escritura se aplica al instante en el equipo, pero su promesa y la confirmación del servidor
  // esperan a que vuelva la conexión. Las transacciones fallan («unavailable»): necesitan al servidor.
  const conectado = () => navigator.onLine !== false;
  const colaSinConexion = [];
  window.addEventListener("online", () => colaSinConexion.splice(0).forEach((fn) => setTimeout(fn, 0)));
  const alServidor = (fn) => (conectado() ? setTimeout(fn, 0) : colaSinConexion.push(fn));
  const confirmacion = () => new Promise((ok) => alServidor(ok));

  // ---------- Documentos ----------
  class DocumentSnapshot {
    constructor(ref, valor) {
      this.ref = ref;
      this.id = ref.id;
      this.exists = valor !== undefined;
      this.metadata = { hasPendingWrites: false };
      this._valor = valor;
    }
    data() {
      return this.exists ? conToDate(clonar(this._valor)) : undefined;
    }
    get(campo) {
      const d = this.data();
      return d ? d[campo] : undefined;
    }
  }

  class DocumentReference {
    constructor(col, id) {
      this._col = col;
      this.id = id;
      this.path = col + "/" + id;
    }
    async get() {
      return new DocumentSnapshot(this, coleccion(this._col).get(this.id));
    }
    async set(valor, opciones) {
      this._set(valor, opciones);
      return confirmacion();
    }
    async update(cambios) {
      this._update(cambios);
      return confirmacion();
    }
    async delete() {
      this._delete();
      return confirmacion();
    }
    _set(valor, opciones) {
      const fusionar = !!(opciones && opciones.merge);
      const actual = coleccion(this._col).get(this.id);
      const base = fusionar && actual ? actual : {};
      coleccion(this._col).set(this.id, aplicar(base, valor, fusionar));
      escrituras.push({ op: fusionar ? "set-merge" : "set", ruta: this.path, datos: clonar(resolver(valor)) });
      avisarCambio(this._col, true, this.id);
    }
    _update(cambios) {
      const actual = coleccion(this._col).get(this.id);
      if (!actual) throw Object.assign(new Error("No document to update: " + this.path), { code: "not-found" });
      aplicar(actual, cambios, false);
      escrituras.push({ op: "update", ruta: this.path, datos: clonar(resolver(cambios)) });
      avisarCambio(this._col, true, this.id);
    }
    _delete() {
      coleccion(this._col).delete(this.id);
      escrituras.push({ op: "delete", ruta: this.path });
      avisarCambio(this._col, true, this.id);
    }
  }

  // ---------- Consultas ----------
  const comparar = (a, b) => {
    const va = a && typeof a === "object" && "seconds" in a ? a.seconds : a;
    const vb = b && typeof b === "object" && "seconds" in b ? b.seconds : b;
    if (va === vb) return 0;
    if (va === undefined || va === null) return -1;
    if (vb === undefined || vb === null) return 1;
    return va < vb ? -1 : 1;
  };
  const operadores = {
    "==": (a, b) => a === b,
    "!=": (a, b) => a !== b,
    ">=": (a, b) => a !== undefined && comparar(a, b) >= 0,
    "<=": (a, b) => a !== undefined && comparar(a, b) <= 0,
    ">": (a, b) => a !== undefined && comparar(a, b) > 0,
    "<": (a, b) => a !== undefined && comparar(a, b) < 0,
    in: (a, b) => b.includes(a),
    "array-contains": (a, b) => Array.isArray(a) && a.includes(b),
  };

  class Query {
    constructor(col, filtros = [], orden = [], limite = null) {
      this._col = col;
      this._filtros = filtros;
      this._orden = orden;
      this._limite = limite;
    }
    where(campo, op, valor) {
      if (!operadores[op]) throw new Error("Operador no soportado en el Firebase falso: " + op);
      return new Query(this._col, [...this._filtros, [campo, op, valor]], this._orden, this._limite);
    }
    orderBy(campo, dir = "asc") {
      return new Query(this._col, this._filtros, [...this._orden, [campo, dir]], this._limite);
    }
    limit(n) {
      return new Query(this._col, this._filtros, this._orden, n);
    }
    async get() {
      revisarPermiso({ path: this._col }); // una colección entera también se puede negar
      return this._resultado();
    }
    _resultado() {
      let filas = [...coleccion(this._col).entries()];
      for (const [campo, op, valor] of this._filtros) filas = filas.filter(([, d]) => operadores[op](d[campo], valor));
      // Firestore excluye los documentos que no tienen el campo de orden
      for (const [campo] of this._orden) filas = filas.filter(([, d]) => d[campo] !== undefined);
      if (this._orden.length) {
        filas.sort(([, a], [, b]) => {
          for (const [campo, dir] of this._orden) {
            const c = comparar(a[campo], b[campo]);
            if (c) return dir === "desc" ? -c : c;
          }
          return 0;
        });
      }
      if (this._limite != null) filas = filas.slice(0, this._limite);
      const docs = filas.map(([id, d]) => new DocumentSnapshot(new DocumentReference(this._col, id), d));
      return { docs, size: docs.length, empty: docs.length === 0, forEach: (fn) => docs.forEach(fn) };
    }
  }

  // ---------- Escuchas en tiempo real (onSnapshot) ----------
  // Como Firestore: lo que escribe esta app se avisa AL INSTANTE (antes de que termine el await del código),
  // marcado como pendiente (hasPendingWrites); luego llega la confirmación del servidor. Lo que escribe
  // «otro equipo» llega un momento después, sin marca.
  const oyentes = [];
  const acuses = new Map(); // colección → ids escritos por esta app que falta confirmar
  function avisarCambio(col, local, id) {
    const de = () => oyentes.filter((o) => o.query._col === col);
    if (!local) return setTimeout(() => de().forEach((o) => notificar(o)), 0);
    de().forEach((o) => notificar(o, new Set([id])));
    if (!acuses.has(col)) {
      acuses.set(col, new Set());
      alServidor(() => {
        const ids = acuses.get(col);
        acuses.delete(col);
        de().forEach((o) => notificar(o, new Set(), ids));
      });
    }
    acuses.get(col).add(id);
  }
  function notificar(o, pendientes = new Set(), confirmados = new Set()) {
    if (o.ref) {
      // Escucha de un solo documento: avisa la primera vez y cada vez que cambia
      const valor = coleccion(o.ref._col).get(o.ref.id);
      const texto = JSON.stringify(valor === undefined ? null : valor);
      if (o.ultimo === texto) return;
      o.ultimo = texto;
      return o.cb(new DocumentSnapshot(o.ref, valor));
    }
    const snap = o.query._resultado();
    const ahora = new Map(snap.docs.map((d) => [d.id, JSON.stringify(d._valor)]));
    const cambios = [];
    snap.docs.forEach((d) => {
      d.metadata = { hasPendingWrites: pendientes.has(d.id) };
      if (!o.ultimo || !o.ultimo.has(d.id)) cambios.push({ type: "added", doc: d });
      else if (o.ultimo.get(d.id) !== ahora.get(d.id) || confirmados.has(d.id))
        cambios.push({ type: "modified", doc: d });
    });
    if (o.ultimo)
      o.ultimo.forEach((_, id) => {
        if (!ahora.has(id))
          cambios.push({
            type: "removed",
            doc: new DocumentSnapshot(new DocumentReference(o.query._col, id), undefined),
          });
      });
    const primera = !o.ultimo;
    o.ultimo = ahora;
    if (primera || cambios.length) o.cb({ ...snap, docChanges: () => cambios });
  }
  Query.prototype.onSnapshot = function (cb) {
    const o = { query: this, cb, ultimo: null };
    oyentes.push(o);
    setTimeout(() => notificar(o), 0);
    return () => {
      const i = oyentes.indexOf(o);
      if (i >= 0) oyentes.splice(i, 1);
    };
  };
  DocumentReference.prototype.onSnapshot = function (cb) {
    const o = { query: { _col: this._col }, ref: this, cb, ultimo: undefined };
    oyentes.push(o);
    setTimeout(() => notificar(o), 0);
    return () => {
      const i = oyentes.indexOf(o);
      if (i >= 0) oyentes.splice(i, 1);
    };
  };
  // Para las pruebas: cambios hechos «desde otro equipo» (no quedan en __ESCRITURAS__, que es lo que hizo esta app)
  window.__OTRO_EQUIPO__ = {
    escribir(col, id, valor) {
      coleccion(col).set(id, aplicar(coleccion(col).get(id) || {}, valor, true));
      avisarCambio(col, false);
    },
    borrar(col, id) {
      coleccion(col).delete(id);
      avisarCambio(col, false);
    },
    // Escuchas de datos (sin la de la autorización del día); con una colección, solo las de esa colección
    oyentes: (col) => oyentes.filter((o) => (col ? o.query._col === col : o.query._col !== "autorizaciones")).length,
  };

  class CollectionReference extends Query {
    constructor(col) {
      super(col);
      this.id = col;
      this.path = col;
    }
    doc(id) {
      return new DocumentReference(this._col, id || nuevoId());
    }
    async add(valor) {
      const ref = this.doc();
      ref._set(valor);
      await confirmacion();
      return ref;
    }
  }

  class WriteBatch {
    constructor() {
      this._ops = [];
    }
    set(ref, valor, opciones) {
      this._ops.push([ref, () => ref._set(valor, opciones)]);
      return this;
    }
    update(ref, cambios) {
      this._ops.push([ref, () => ref._update(cambios)]);
      return this;
    }
    delete(ref) {
      this._ops.push([ref, () => ref._delete()]);
      return this;
    }
    async commit() {
      this._ops.forEach(([ref]) => revisarPermiso(ref)); // todo o nada, como Firestore
      this._ops.forEach(([, op]) => op());
      return confirmacion();
    }
  }

  // Las pruebas pueden simular reglas de Firestore que niegan una ruta: window.__DENEGAR__ = ["config/contadores"]
  // (o una colección completa al consultarla: ["estudiantes_docentes"])
  const revisarPermiso = (ref) => {
    const negadas = window.__DENEGAR__ || [];
    if (negadas.includes(ref.path) || (ref._col && negadas.includes(ref._col)))
      throw Object.assign(new Error("Missing or insufficient permissions."), { code: "permission-denied" });
  };
  // Transacción: lee el estado actual y aplica todas las escrituras juntas al final (como Firestore)
  async function runTransaction(fn) {
    if (!conectado())
      throw Object.assign(new Error("Failed to get document because the client is offline."), { code: "unavailable" });
    const ops = [];
    const tx = {
      get: async (ref) => {
        revisarPermiso(ref);
        return new DocumentSnapshot(ref, coleccion(ref._col).get(ref.id));
      },
      set(ref, valor, opciones) {
        revisarPermiso(ref);
        ops.push(() => ref._set(valor, opciones));
        return tx;
      },
      update(ref, cambios) {
        ops.push(() => ref._update(cambios));
        return tx;
      },
      delete(ref) {
        ops.push(() => ref._delete());
        return tx;
      },
    };
    const resultado = await fn(tx);
    ops.forEach((op) => op());
    return resultado;
  }

  const firestoreInstancia = {
    collection: (nombre) => new CollectionReference(nombre),
    batch: () => new WriteBatch(),
    runTransaction,
    enablePersistence: async () => {},
    waitForPendingWrites: () => confirmacion(),
    // Al salir en un equipo compartido la app borra la copia local: aquí solo se anota
    // (en sessionStorage, porque después la app vuelve a abrir la página)
    terminate: async () =>
      sessionStorage.setItem("__LIMPIEZA__", (sessionStorage.getItem("__LIMPIEZA__") || "") + "terminate,"),
    clearPersistence: async () =>
      sessionStorage.setItem("__LIMPIEZA__", (sessionStorage.getItem("__LIMPIEZA__") || "") + "clearPersistence,"),
  };

  // ---------- Autenticación ----------
  const cuentas = (semilla.usuarios || []).map((u) => ({ ...u }));
  function crearAuth() {
    let actual = null;
    const oyentes = [];
    const avisar = () => oyentes.forEach((fn) => setTimeout(() => fn(actual), 0));
    const error = (code, msg) => Object.assign(new Error(msg), { code });
    return {
      get currentUser() {
        return actual;
      },
      onAuthStateChanged(fn) {
        oyentes.push(fn);
        setTimeout(() => fn(actual), 0);
        return () => oyentes.splice(oyentes.indexOf(fn), 1);
      },
      async signInWithEmailAndPassword(email, clave) {
        const c = cuentas.find((u) => u.email.toLowerCase() === String(email).toLowerCase());
        if (!c || c.password !== clave) throw error("auth/invalid-credential", "Credenciales inválidas");
        actual = { uid: c.uid, email: c.email };
        avisar();
        return { user: actual };
      },
      async createUserWithEmailAndPassword(email, clave) {
        if (cuentas.some((u) => u.email.toLowerCase() === String(email).toLowerCase()))
          throw error("auth/email-already-in-use", "El correo ya existe");
        const c = { uid: "uid-" + nuevoId(), email, password: clave };
        cuentas.push(c);
        escrituras.push({ op: "auth-crear", ruta: "auth/" + c.uid, datos: { email } });
        actual = { uid: c.uid, email: c.email };
        avisar();
        return { user: actual };
      },
      async signOut() {
        actual = null;
        avisar();
      },
      // «¿Olvidaste tu contraseña?»: se anota a qué correo se habría mandado el enlace
      async sendPasswordResetEmail(email) {
        if (!/@/.test(email)) throw error("auth/invalid-email", "Correo no válido");
        (window.__CLAVE_OLVIDADA__ = window.__CLAVE_OLVIDADA__ || []).push(email);
      },
      async setPersistence(tipo) {
        window.__PERSISTENCIA__ = tipo;
      },
      // «Entrar con Google»: entra con la cuenta que diga window.__CUENTA_GOOGLE__ (o falla con su código)
      async signInWithPopup() {
        const g = window.__CUENTA_GOOGLE__;
        if (!g) throw error("auth/popup-closed-by-user", "Se cerró la ventana");
        if (g.error) throw error(g.error, g.error);
        // Como en Firebase (una cuenta por correo): si ya existe con contraseña, es la misma cuenta (mismo uid)
        const ya = cuentas.find((c) => c.email === g.email);
        actual = { uid: ya ? ya.uid : "uid-google-" + g.email, email: g.email };
        avisar();
        return { user: actual };
      },
      async signInWithRedirect() {},
    };
  }

  // ---------- Apps ----------
  const apps = [];
  function initializeApp(options, nombre = "[DEFAULT]") {
    const app = { name: nombre, options };
    const auth = crearAuth();
    app.auth = () => auth;
    app.firestore = () => firestoreInstancia;
    apps.push(app);
    return app;
  }

  const firestore = () => firestoreInstancia;
  firestore.FieldValue = {
    serverTimestamp: () => new Centinela("serverTimestamp"),
    delete: () => new Centinela("delete"),
  };
  firestore.DocumentReference = DocumentReference;
  firestore.CollectionReference = CollectionReference;
  firestore.Query = Query;
  firestore.WriteBatch = WriteBatch;

  window.__DATOS_FALSOS__ = datos;
  window.firebase = {
    apps,
    initializeApp,
    app: (nombre = "[DEFAULT]") => apps.find((a) => a.name === nombre),
    auth: Object.assign(() => apps[0].auth(), {
      Auth: { Persistence: { LOCAL: "local", SESSION: "session" } },
      GoogleAuthProvider: function () {
        this.setCustomParameters = () => {};
      },
    }),
    firestore,
    // Avisos al teléfono: el navegador «da» un token fijo
    messaging: Object.assign(() => ({ getToken: async () => "token-de-prueba-123" }), {
      isSupported: async () => true,
    }),
    // App Check: en las pruebas no hay reCAPTCHA; se anota con qué clave se activó
    appCheck: Object.assign(
      () => ({
        activate: (proveedor, auto) => (window.__APP_CHECK__ = { clave: proveedor.clave, auto }),
      }),
      {
        ReCaptchaV3Provider: function (clave) {
          this.clave = clave;
        },
        ReCaptchaEnterpriseProvider: function (clave) {
          this.clave = clave;
        },
      }
    ),
  };
})();
