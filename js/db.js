// Almacenamiento local (IndexedDB) sin bibliotecas externas.
// kv: sesión, bootstrap y cachés de listas · cola: operaciones pendientes de subir · archivos: fotos y firmas (Blob).

const NOMBRE = 'aerovantix-ops', VERSION_DB = 1;
let dbp = null;

function abrir() {
  if (dbp) return dbp;
  dbp = new Promise((ok, mal) => {
    const r = indexedDB.open(NOMBRE, VERSION_DB);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
      if (!db.objectStoreNames.contains('cola')) db.createObjectStore('cola', { keyPath: 'n', autoIncrement: true });
      if (!db.objectStoreNames.contains('archivos')) db.createObjectStore('archivos');
    };
    r.onsuccess = () => ok(r.result);
    r.onerror = () => mal(r.error);
  });
  return dbp;
}

async function tx(almacen, modo, fn) {
  const db = await abrir();
  return new Promise((ok, mal) => {
    const t = db.transaction(almacen, modo);
    const s = t.objectStore(almacen);
    let res;
    Promise.resolve(fn(s)).then(v => { res = v; });
    t.oncomplete = () => ok(res instanceof IDBRequest ? res.result : res);
    t.onerror = () => mal(t.error);
    t.onabort = () => mal(t.error);
  });
}

const req = r => new Promise((ok, mal) => { r.onsuccess = () => ok(r.result); r.onerror = () => mal(r.error); });

export const leer = clave => tx('kv', 'readonly', s => req(s.get(clave)));
export const escribir = (clave, valor) => tx('kv', 'readwrite', s => { s.put(valor, clave); });
export const borrar = clave => tx('kv', 'readwrite', s => { s.delete(clave); });

export const colaAgregar = item => tx('cola', 'readwrite', s => req(s.add(item)));
export const colaTodos = () => tx('cola', 'readonly', s => req(s.getAll()));
export const colaActualizar = item => tx('cola', 'readwrite', s => { s.put(item); });
export const colaBorrar = n => tx('cola', 'readwrite', s => { s.delete(n); });

export const archivoGuardar = (id, blob) => tx('archivos', 'readwrite', s => { s.put(blob, id); });
export const archivoLeer = id => tx('archivos', 'readonly', s => req(s.get(id)));
export const archivoBorrar = id => tx('archivos', 'readwrite', s => { s.delete(id); });

/** Borra cachés y sesión, pero conserva la cola y sus archivos (no se pierde trabajo pendiente). */
export async function limpiarCaches() {
  const db = await abrir();
  const claves = await tx('kv', 'readonly', s => req(s.getAllKeys()));
  await tx('kv', 'readwrite', s => { claves.forEach(k => { if (k !== 'dispositivo') s.delete(k); }); });
  return db;
}
