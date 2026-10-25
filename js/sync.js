// Sincronización de la cola de salida: automática al recuperar la señal y manual con "Sincronizar ahora".
// Si la sesión vence, se detiene y la cola se conserva intacta hasta el nuevo inicio de sesión.
import * as db from './db.js';
import { llamar, ErrorApi, ErrorRed, bus } from './api.js';
import { aplicarLocal, uuid } from './datos.js';
import { est, usuario } from './estado.js';
import { SYNC } from './config.js';

export const estado = { enLinea: navigator.onLine, sincronizando: false, pendientes: 0, errores: 0, atrasados: 0, progreso: null, ultimo: null };
const subs = new Set();
export function suscribir(fn) { subs.add(fn); fn(estado); return () => subs.delete(fn); }
const avisar = () => subs.forEach(fn => { try { fn(estado); } catch (e) { console.error(e); } });

export async function contar() {
  const cola = await db.colaTodos();
  const limite = Date.now() - SYNC.atrasoHoras * 3600000;
  estado.pendientes = cola.filter(i => i.estado !== 'error').length;
  estado.errores = cola.filter(i => i.estado === 'error').length;
  estado.atrasados = cola.filter(i => i.creado < limite).length;
  estado.enLinea = navigator.onLine;
  avisar();
  return cola;
}

function aBase64(blob) {
  return new Promise((ok, mal) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result).split(',')[1] || '');
    r.onerror = () => mal(r.error);
    r.readAsDataURL(blob);
  });
}

async function ejecutar(it) {
  const opc = { origen: it.origen };
  if (it.tipo === 'guardar') {
    const r = await llamar('guardar', it.datos, opc);
    await aplicarLocal(it.tabla, r);
    return r;
  }
  if (it.tipo === 'cambiarEstatus') {
    const r = await llamar('cambiarEstatus', it.datos, opc);
    await aplicarLocal(it.tabla, r);
    return r;
  }
  if (it.tipo === 'archivo') {
    const blob = await db.archivoLeer(it.datos.archivo_id);
    if (!blob) throw new ErrorApi('VALIDACION', 'El archivo ya no está en el teléfono.');
    const datos = Object.assign({}, it.datos, { base64: await aBase64(blob) });
    delete datos.tam;
    const r = await llamar('subirArchivo', datos, opc);
    await aplicarLocal(it.tabla, r.registro);
    await db.archivoBorrar(it.datos.archivo_id);
    return r;
  }
  throw new ErrorApi('VALIDACION', 'Operación desconocida en la cola.');
}

async function registrarError(it, err) {
  // Bitácora de errores de sincronización en el motor (mejor esfuerzo; si falla no se insiste).
  try {
    await llamar('guardar', { tabla: 'BitacoraSync', registro: {
      id: uuid(), usuario: usuario(), dispositivo: navigator.userAgent.slice(0, 180), accion: it.tipo, tabla: it.tabla,
      registro_id: it.registro_id, tipo_evento: 'Error', detalle: (err.codigo || '') + ': ' + err.message
    } });
  } catch (e) { /* sin acción */ }
}

let corriendo = null;
export function sincronizar() {
  if (corriendo) return corriendo;
  corriendo = (async () => {
    const cola = (await contar()).filter(i => i.estado !== 'error');
    if (!cola.length || !navigator.onLine || !est.token) return { subidos: 0 };
    estado.sincronizando = true; estado.progreso = { hecho: 0, total: cola.length }; avisar();
    let subidos = 0;
    const fallidos = new Set();
    for (const it of cola) {
      if (fallidos.has(it.registro_id) && it.tipo !== 'guardar') {
        it.estado = 'error'; it.error = 'No se subió porque el registro principal tuvo un error.'; await db.colaActualizar(it); continue;
      }
      try {
        await ejecutar(it);
        await db.colaBorrar(it.n);
        subidos++;
      } catch (e) {
        if (e instanceof ErrorRed) break;
        if (e instanceof ErrorApi && (e.codigo === 'SESION' || e.codigo === 'CAMBIO_REQUERIDO' || e.codigo === 'OCUPADO' || e.codigo === 'INTERNO')) {
          it.intentos++; it.error = e.message; await db.colaActualizar(it); break;
        }
        it.intentos++; it.estado = 'error'; it.error = e.message; it.codigo = e.codigo;
        await db.colaActualizar(it);
        fallidos.add(it.registro_id);
        registrarError(it, e);
      }
      estado.progreso.hecho++; avisar();
    }
    estado.sincronizando = false; estado.progreso = null; estado.ultimo = Date.now();
    await contar();
    if (subidos) bus.emit('sincronizado', { subidos });
    return { subidos };
  })().finally(() => { corriendo = null; estado.sincronizando = false; avisar(); });
  return corriendo;
}

export async function reintentar(n) {
  const it = (await db.colaTodos()).find(x => x.n === n);
  if (!it) return;
  it.estado = 'pendiente'; it.error = '';
  await db.colaActualizar(it);
  await contar();
  return sincronizar();
}

export async function descartar(n) {
  const it = (await db.colaTodos()).find(x => x.n === n);
  if (!it) return;
  if (it.tipo === 'archivo') await db.archivoBorrar(it.datos.archivo_id);
  await db.colaBorrar(n);
  await contar();
  bus.emit('cola');
}

export function iniciar() {
  addEventListener('online', () => { estado.enLinea = true; avisar(); sincronizar(); });
  addEventListener('offline', () => { estado.enLinea = false; avisar(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') sincronizar(); });
  bus.on('cola', () => { contar().then(() => sincronizar()); });
  bus.on('sesion-iniciada', () => sincronizar());
  setInterval(() => { if (estado.pendientes > 0) sincronizar(); else contar(); }, SYNC.intervaloMs);
  contar().then(() => sincronizar());
}

/** Pide al navegador que no borre los datos locales (cola, fotos y catálogos). */
export async function pedirPersistencia() {
  try { if (navigator.storage && navigator.storage.persist && !(await navigator.storage.persisted())) return await navigator.storage.persist(); return true; }
  catch (e) { return false; }
}
