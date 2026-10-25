// Cliente del motor: POST con Content-Type text/plain (sin preflight de CORS) y campo "accion".
import { MOTOR_URL, SYNC } from './config.js';

export class ErrorApi extends Error {
  constructor(codigo, mensaje) { super(mensaje); this.codigo = codigo; }
}
export class ErrorRed extends Error {
  constructor(mensaje) { super(mensaje || 'Sin conexión con el servidor.'); this.codigo = 'RED'; }
}

// Bus de eventos de la app (sesión vencida, cambios de datos, sincronización).
const oyentes = {};
export const bus = {
  on(evento, fn) { (oyentes[evento] = oyentes[evento] || new Set()).add(fn); return () => oyentes[evento].delete(fn); },
  emit(evento, dato) { (oyentes[evento] || []).forEach(fn => { try { fn(dato); } catch (e) { console.error(e); } }); }
};

let token = null;
export const fijarToken = t => { token = t || null; };
export const hayToken = () => !!token;

export async function llamar(accion, datos = {}, opc = {}) {
  if (!navigator.onLine) throw new ErrorRed('Sin conexión.');
  const cuerpo = JSON.stringify({ accion, datos, token, origen: opc.origen || 'online' });
  let res;
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), opc.timeout || SYNC.timeoutMs);
  try {
    res = await fetch(MOTOR_URL, {
      method: 'POST', body: cuerpo, redirect: 'follow', credentials: 'omit', cache: 'no-store',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }, signal: ctl.signal
    });
  } catch (e) {
    throw new ErrorRed(e.name === 'AbortError' ? 'El servidor tardó demasiado en responder.' : 'Sin conexión con el servidor.');
  } finally { clearTimeout(t); }
  if (!res.ok) throw new ErrorRed('El servidor respondió con un error (' + res.status + ').');
  let j;
  try { j = await res.json(); } catch (e) { throw new ErrorRed('Respuesta no válida del servidor.'); }
  if (!j.ok) {
    const err = new ErrorApi(j.error && j.error.codigo, (j.error && j.error.mensaje) || 'Error del servidor.');
    if (err.codigo === 'SESION') bus.emit('sesion-vencida', err);
    if (err.codigo === 'CAMBIO_REQUERIDO') bus.emit('cambio-requerido', err);
    throw err;
  }
  if (j.renovado) bus.emit('sesion-renovada', j.renovado);
  return j.data;
}
