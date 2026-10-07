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
  const marcaDeTiempo = () => {
    const ms = Date.now();
    return { seconds: Math.floor(ms / 1000), nanoseconds: 0 };
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

  // ---------- Documentos ----------
  class DocumentSnapshot {
    constructor(ref, valor) {
      this.ref = ref;
      this.id = ref.id;
      this.exists = valor !== undefined;
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
    }
    async update(cambios) {
      this._update(cambios);
    }
    async delete() {
      this._delete();
    }
    _set(valor, opciones) {
      const fusionar = !!(opciones && opciones.merge);
      const actual = coleccion(this._col).get(this.id);
      const base = fusionar && actual ? actual : {};
      coleccion(this._col).set(this.id, aplicar(base, valor, fusionar));
      escrituras.push({ op: fusionar ? "set-merge" : "set", ruta: this.path, datos: clonar(resolver(valor)) });
    }
    _update(cambios) {
      const actual = coleccion(this._col).get(this.id);
      if (!actual) throw Object.assign(new Error("No document to update: " + this.path), { code: "not-found" });
      aplicar(actual, cambios, false);
      escrituras.push({ op: "update", ruta: this.path, datos: clonar(resolver(cambios)) });
    }
    _delete() {
      coleccion(this._col).delete(this.id);
      escrituras.push({ op: "delete", ruta: this.path });
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
      return ref;
    }
  }

  class WriteBatch {
    constructor() {
      this._ops = [];
    }
    set(ref, valor, opciones) {
      this._ops.push(() => ref._set(valor, opciones));
      return this;
    }
    update(ref, cambios) {
      this._ops.push(() => ref._update(cambios));
      return this;
    }
    delete(ref) {
      this._ops.push(() => ref._delete());
      return this;
    }
    async commit() {
      this._ops.forEach((op) => op());
    }
  }

  const firestoreInstancia = {
    collection: (nombre) => new CollectionReference(nombre),
    batch: () => new WriteBatch(),
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
    auth: () => apps[0].auth(),
    firestore,
  };
})();
