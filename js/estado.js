// Estado de sesión y catálogos del bootstrap (persistidos para trabajar sin conexión).
import * as db from './db.js';
import { llamar, fijarToken, bus } from './api.js';

export const est = { token: null, perfil: null, permisos: {}, parametros: {}, catalogos: {}, avisos: 0, cargadoEn: null };

export async function cargarSesion() {
  const s = await db.leer('sesion');
  if (s && s.token) { est.token = s.token; est.perfil = s.perfil; fijarToken(s.token); }
  const b = await db.leer('bootstrap');
  if (b) aplicarBootstrap(b);
  return !!est.token;
}

export async function guardarSesion(token, perfil, expira) {
  est.token = token; est.perfil = perfil; fijarToken(token);
  await db.escribir('sesion', { token, perfil, expira });
}

export async function olvidarToken() {
  est.token = null; fijarToken(null);
  const s = await db.leer('sesion');
  if (s) await db.escribir('sesion', { perfil: s.perfil });
}

export async function cerrarSesionLocal() {
  est.token = null; est.perfil = null; est.permisos = {}; est.catalogos = {}; est.parametros = {};
  fijarToken(null);
  await db.limpiarCaches();
}

export function aplicarBootstrap(b) {
  est.perfil = b.perfil || est.perfil;
  est.permisos = b.permisos || {};
  est.parametros = b.parametros || {};
  est.catalogos = b.catalogos || {};
  est.avisos = b.avisos_no_leidos || 0;
  est.cargadoEn = b.servidor || null;
}

export async function refrescarBootstrap() {
  const b = await llamar('bootstrap');
  await db.escribir('bootstrap', b);
  aplicarBootstrap(b);
  const s = await db.leer('sesion');
  if (s) await db.escribir('sesion', Object.assign({}, s, { perfil: b.perfil }));
  bus.emit('bootstrap', b);
  return b;
}

export async function guardarBootstrapLocal() {
  const b = await db.leer('bootstrap');
  if (!b) return;
  b.catalogos = est.catalogos; b.avisos_no_leidos = est.avisos;
  await db.escribir('bootstrap', b);
}

export const rol = () => (est.perfil ? est.perfil.rol : '');
export const esDir = () => rol() === 'Dirección';
export const usuario = () => (est.perfil ? est.perfil.usuario : '');
export const puede = (tabla, modo = 'leer') => !!(est.permisos[tabla] && est.permisos[tabla][modo]);
export const alcance = (tabla, modo = 'escribir') => (est.permisos[tabla] && est.permisos[tabla][modo]) || null;
export const cat = nombre => est.catalogos[nombre] || [];
export const param = (k, d) => (est.parametros[k] !== undefined && est.parametros[k] !== '' ? est.parametros[k] : d);
export const nombreUsuario = u => { const x = cat('Usuarios').find(z => z.usuario === u); return x ? x.nombre : (u || ''); };
