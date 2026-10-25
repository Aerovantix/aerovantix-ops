// Acceso a datos con caché local y cola de salida. Toda escritura pasa por la cola: funciona igual con o sin señal.
import * as db from './db.js';
import { llamar, ErrorRed, bus } from './api.js';
import { est, guardarBootstrapLocal } from './estado.js';

export const CATALOGOS = ['Catalogo', 'Clientes', 'Parcelas', 'Equipos', 'Existencias', 'Proveedores', 'SOPs', 'SOPPasos', 'MapeoSmartFarm'];

export function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

const claveLista = (tabla, filtros) => 'l:' + tabla + (filtros && Object.keys(filtros).length ? ':' + JSON.stringify(filtros) : '');
const claveObj = (tabla, id) => 'o:' + tabla + ':' + id;

function cumple(r, filtros) {
  if (!filtros) return true;
  return Object.keys(filtros).every(k => {
    const v = filtros[k];
    return Array.isArray(v) ? v.map(String).includes(String(r[k])) : String(r[k]) === String(v);
  });
}

/** Cambios aún no subidos (cola) aplicados sobre los registros del servidor. */
async function pendientesDe(tabla) {
  const cola = await db.colaTodos();
  const porId = {};
  cola.forEach(it => {
    if (it.tabla !== tabla) return;
    if (it.tipo === 'guardar') porId[it.registro_id] = Object.assign(porId[it.registro_id] || {}, it.datos.registro, { _pendiente: true });
    else if (it.tipo === 'cambiarEstatus') {
      const campo = it.campoEstatus || 'estatus';
      porId[it.registro_id] = Object.assign(porId[it.registro_id] || { id: it.registro_id }, it.datos.datos || {}, { [campo]: it.datos.estatus, _pendiente: true });
    } else if (it.tipo === 'archivo') {
      const p = porId[it.registro_id] = porId[it.registro_id] || { id: it.registro_id };
      p._archivosPendientes = (p._archivosPendientes || []).concat([{ campo: it.datos.campo, archivo_id: it.datos.archivo_id }]);
      p._pendiente = true;
    }
  });
  return porId;
}

function fusionar(base, cambio) {
  if (!cambio) return base;
  const o = Object.assign({}, base);
  Object.keys(cambio).forEach(k => { if (k !== '_archivosPendientes') o[k] = cambio[k]; });
  if (cambio._archivosPendientes) o._archivosPendientes = cambio._archivosPendientes;
  return o;
}

async function superponer(tabla, regs, filtros) {
  const p = await pendientesDe(tabla);
  const out = regs.map(r => (p[r.id] ? fusionar(r, p[r.id]) : r));
  const vistos = new Set(regs.map(r => r.id));
  Object.keys(p).forEach(id => { if (!vistos.has(id) && cumple(p[id], filtros)) out.push(p[id]); });
  return out;
}

export async function listar(tabla, filtros) {
  const clave = claveLista(tabla, filtros);
  let regs, desdeCache = false;
  try {
    const r = await llamar('listar', { tabla, filtros });
    regs = r.registros;
    await db.escribir(clave, { regs, en: Date.now() });
    if (CATALOGOS.includes(tabla) && !filtros && est.catalogos[tabla]) { est.catalogos[tabla] = regs; guardarBootstrapLocal(); }
  } catch (e) {
    if (!(e instanceof ErrorRed)) throw e;
    const c = await db.leer(clave);
    regs = c ? c.regs : (CATALOGOS.includes(tabla) ? (est.catalogos[tabla] || []).filter(r => cumple(r, filtros)) : []);
    desdeCache = true;
  }
  return { registros: await superponer(tabla, regs, filtros), desdeCache };
}

export async function obtener(tabla, id) {
  let reg = null, desdeCache = false;
  try {
    reg = await llamar('obtener', { tabla, id });
    await db.escribir(claveObj(tabla, id), reg);
  } catch (e) {
    if (!(e instanceof ErrorRed) && !(e.codigo === 'NO_EXISTE')) throw e;
    desdeCache = true;
    reg = await db.leer(claveObj(tabla, id));
    if (!reg) {
      const l = await db.leer(claveLista(tabla));
      reg = (l && l.regs.find(r => r.id === id)) || (est.catalogos[tabla] || []).find(r => r.id === id) || null;
    }
  }
  const p = await pendientesDe(tabla);
  if (p[id]) reg = fusionar(reg || {}, p[id]);
  if (reg && tabla === 'OrdenesServicio') {
    const pe = await pendientesDe('EtapasServicio');
    const etapas = (reg.etapas || []).map(e => (pe[e.id] ? fusionar(e, pe[e.id]) : e));
    const ids = new Set(etapas.map(e => e.id));
    Object.values(pe).forEach(e => { if (!ids.has(e.id) && e.os_id === id) etapas.push(e); });
    reg.etapas = etapas.sort((a, b) => (Number(a.numero) || 0) - (Number(b.numero) || 0));
  }
  if (reg) reg._desdeCache = desdeCache;
  return reg;
}

export async function vista(nombre) {
  try {
    const r = await llamar('listar', { tabla: nombre });
    await db.escribir('v:' + nombre, r);
    return Object.assign({ desdeCache: false }, r);
  } catch (e) {
    if (!(e instanceof ErrorRed)) throw e;
    const c = await db.leer('v:' + nombre);
    if (!c) throw e;
    return Object.assign({ desdeCache: true }, c);
  }
}

/** Actualiza cachés locales con un registro (propio o devuelto por el servidor). */
export async function aplicarLocal(tabla, reg, { pendiente = false } = {}) {
  if (!reg || !reg.id) return;
  const l = await db.leer(claveLista(tabla));
  if (l) {
    const i = l.regs.findIndex(r => r.id === reg.id);
    if (!pendiente) { if (i >= 0) l.regs[i] = reg; else l.regs.push(reg); await db.escribir(claveLista(tabla), l); }
  }
  if (!pendiente) await db.escribir(claveObj(tabla, reg.id), reg);
  if (est.catalogos[tabla]) {
    const c = est.catalogos[tabla];
    const i = c.findIndex(r => r.id === reg.id);
    const nuevo = i >= 0 ? Object.assign({}, c[i], reg) : reg;
    if (i >= 0) c[i] = nuevo; else c.push(nuevo);
    await guardarBootstrapLocal();
  }
}

function itemBase(tipo, tabla, registro_id, datos, resumen) {
  return { tipo, tabla, registro_id, datos, resumen: resumen || '', origen: navigator.onLine ? 'online' : 'offline', creado: Date.now(), intentos: 0, estado: 'pendiente', error: '' };
}

export async function guardar(tabla, registro, opc = {}) {
  if (!registro.id) registro.id = uuid();
  const limpio = {};
  Object.keys(registro).forEach(k => { if (k[0] !== '_') limpio[k] = registro[k]; });
  await db.colaAgregar(itemBase('guardar', tabla, limpio.id, { tabla, registro: limpio, version_cliente: opc.version || undefined }, opc.resumen));
  await aplicarLocal(tabla, Object.assign({}, limpio, { _pendiente: true }), { pendiente: true });
  bus.emit('cola');
  return limpio;
}

export async function cambiarEstatus(tabla, id, estatus, datos, opc = {}) {
  const it = itemBase('cambiarEstatus', tabla, id, { tabla, id, estatus, datos: datos || undefined }, opc.resumen);
  it.campoEstatus = opc.campo || 'estatus';
  await db.colaAgregar(it);
  bus.emit('cola');
}

export async function adjuntar(tabla, registro_id, campo, blob, nombre, opc = {}) {
  const archivo_id = uuid();
  await db.archivoGuardar(archivo_id, blob);
  await db.colaAgregar(itemBase('archivo', tabla, registro_id, { tabla, registro_id, campo, archivo_id, nombre, mime: blob.type, tam: blob.size }, opc.resumen));
  bus.emit('cola');
  return archivo_id;
}

/** Acciones que requieren conexión (aprobaciones, usuarios, importación). */
export async function enLinea(accion, datos) { return llamar(accion, datos); }
