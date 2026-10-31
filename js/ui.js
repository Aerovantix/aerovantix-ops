// Utilidades de interfaz: construcción de nodos, íconos, formatos, chips, toasts y modales.
import { ZONA } from './config.js';

export const SPRITE = 'iconos/iconos.svg';

/** h('div.clase', {atributos}, ...hijos) — crea nodos sin innerHTML para texto (evita inyección). */
// Nulos, indefinidos y false no se pintan (evita el texto "null" en pantalla) y las listas se aplanan (evita "[object HTMLDivElement]").
for (const proto of [Element.prototype, DocumentFragment.prototype]) {
  for (const m of ['append', 'prepend']) {
    const orig = proto[m];
    proto[m] = function (...nodos) { return orig.apply(this, nodos.flat(Infinity).filter(n => n !== null && n !== undefined && n !== false)); };
  }
}

export function h(sel, attrs, ...hijos) {
  const [tag, ...clases] = sel.split('.');
  const el = document.createElement(tag || 'div');
  if (clases.length) el.className = clases.join(' ');
  if (attrs && (typeof attrs !== 'object' || attrs instanceof Node || Array.isArray(attrs))) { hijos.unshift(attrs); attrs = null; }
  if (attrs) {
    Object.entries(attrs).forEach(([k, v]) => {
      if (v === undefined || v === null || v === false) return;
      if (k === 'class') el.className = (el.className ? el.className + ' ' : '') + v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'html') el.innerHTML = v;
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, v);
    });
  }
  agregar(el, hijos);
  return el;
}
function agregar(el, hijos) {
  hijos.flat(Infinity).forEach(c => {
    if (c === null || c === undefined || c === false || c === '') return;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  });
}

export function icono(nombre, tam) {
  const ns = 'http://www.w3.org/2000/svg';
  const s = document.createElementNS(ns, 'svg');
  s.setAttribute('class', 'icono' + (tam ? ' icono--' + tam : ''));
  s.setAttribute('aria-hidden', 'true');
  const u = document.createElementNS(ns, 'use');
  u.setAttribute('href', SPRITE + '#i-' + nombre);
  s.append(u);
  return s;
}

export function vaciar(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }

// ---------- Formatos (es-MX) ----------
const fDinero = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 });
const fDinero0 = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
const fNum = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 });
export const num = v => (v === '' || v === null || v === undefined || isNaN(Number(v)) ? 0 : Number(v));
export const vacioV = v => v === '' || v === null || v === undefined;
export const dinero = (v, entero) => (vacioV(v) ? '—' : (entero ? fDinero0 : fDinero).format(num(v)));
export const numero = (v, suf) => (vacioV(v) ? '—' : fNum.format(num(v)) + (suf ? ' ' + suf : ''));
export const pct = v => (vacioV(v) ? '—' : fNum.format(Math.round(num(v) * 1000) / 10) + ' %');

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export function fecha(v) {
  if (vacioV(v)) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v));
  if (!m) return String(v);
  return `${m[3]}/${m[2]}/${m[1]}`;
}
export function fechaCorta(v) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v || ''));
  return m ? `${Number(m[3])} ${MESES[Number(m[2]) - 1]}` : '—';
}
export function fechaHora(v) {
  if (vacioV(v)) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(String(v));
  if (!m) return String(v);
  return `${m[3]}/${m[2]}/${m[1]}` + (m[4] ? ` ${m[4]}:${m[5]}` : '');
}
/** Fecha y hora local de México en ISO 8601 con desfase. */
export function ahoraIso() {
  const d = new Date(Date.now() + -6 * 3600000);
  return d.toISOString().slice(0, 19) + ZONA;
}
export function hoyIso() { return ahoraIso().slice(0, 10); }
export function sumarDiasIso(iso, n) {
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number);
  const x = new Date(Date.UTC(a, m - 1, d + n));
  return x.toISOString().slice(0, 10);
}
export function lunesIso(iso) {
  const [a, m, d] = (iso || hoyIso()).slice(0, 10).split('-').map(Number);
  const x = new Date(Date.UTC(a, m - 1, d));
  const dia = x.getUTCDay();
  x.setUTCDate(x.getUTCDate() - (dia === 0 ? 6 : dia - 1));
  return x.toISOString().slice(0, 10);
}
export const json = v => { if (Array.isArray(v)) return v; if (vacioV(v)) return []; try { const x = JSON.parse(v); return Array.isArray(x) ? x : []; } catch (e) { return []; } };

// ---------- Estatus → chip ----------
const TONOS = {
  neutro: ['Borrador', 'Requisición', 'Programada', 'Prospecto', 'Pendiente', 'Inactivo', 'Sin factura', 'Baja', 'Vendido', 'Informativo', 'Sin datos', 'Definir meta', 'Manual'],
  pendiente: ['Pendiente de aprobación', 'Por revisar', 'Por facturar', 'Reponer', 'En mantenimiento', 'Pausada', 'Negociación', 'Bloqueado', 'Abierto', 'Ámbar', 'Atención', 'Por asignar', 'Cambios solicitados'],
  aprobado: ['Aprobada', 'Aprobado', 'Aceptada', 'Confirmada', 'Recibida', 'Terminada', 'Hecho', 'Ganada', 'Activo', 'Vigente', 'Disponible', 'OK', 'Facturada', 'Cerrado', 'Completa', 'Devuelta', 'Cerrada', 'Verde', 'Capturado', 'Sí', 'SmartFarm'],
  proceso: ['En ejecución', 'En proceso', 'Enviada', 'Entregada', 'Rentado', 'En servicio', 'Cotizado', 'En curso', 'OC', 'En revisión'],
  rechazado: ['Rechazada', 'Rechazado', 'Perdida', 'Cancelada', 'Vencida', 'Sin existencia', 'Rojo', 'Error', 'Fuera de rango', 'No']
};
export function tono(estatus) {
  for (const [t, l] of Object.entries(TONOS)) if (l.includes(estatus)) return t;
  return 'neutro';
}
export function chip(estatus, t) { return estatus ? h('span.chip.chip--' + (t || tono(estatus)), estatus) : ''; }
export const chipPendiente = () => h('span.chip.chip--pendiente', { title: 'Guardado en este teléfono; se subirá al haber señal' }, 'Por subir');

// ---------- Toasts ----------
let contToasts = null;
export function toast(texto, tipo = 'exito', ms = 5000) {
  if (!contToasts) { contToasts = h('div.toasts', { 'aria-live': 'polite' }); document.body.append(contToasts); }
  const ic = tipo === 'error' ? 'error' : tipo === 'info' ? 'info' : 'exito';
  const t = h('div.toast.toast--' + tipo, icono(ic), h('span.toast__texto', texto),
    h('button.boton.boton--icono', { type: 'button', 'aria-label': 'Cerrar aviso', onclick: () => t.remove() }, icono('cerrar', 20)));
  contToasts.append(t);
  setTimeout(() => t.remove(), ms);
}

// ---------- Modales ----------
export function modal({ titulo, cuerpo, acciones = [], alCerrar, ancho }) {
  const d = h('dialog.modal', { 'aria-label': titulo, style: ancho ? { width: `min(${ancho}px, calc(100% - 32px))` } : null });
  const cerrar = v => { d.close(); d.remove(); if (alCerrar) alCerrar(v); };
  d.append(
    h('div.modal__encabezado', h('h2.titulo-seccion', titulo),
      h('button.boton.boton--icono', { type: 'button', 'aria-label': 'Cerrar', onclick: () => cerrar(null) }, icono('cerrar'))),
    h('div.modal__cuerpo', cuerpo),
    acciones.length ? h('div.modal__acciones', acciones.map(a => {
      const b = h('button.boton.boton--' + (a.tipo || 'secundario'), { type: 'button' }, a.icono ? icono(a.icono, 20) : null, a.texto);
      b.addEventListener('click', async () => {
        if (!a.fn) return cerrar(a.valor);
        b.disabled = true;
        try { const r = await a.fn(b); if (r !== false) cerrar(r); } finally { b.disabled = false; }
      });
      return b;
    })) : null
  );
  d.addEventListener('cancel', e => { e.preventDefault(); cerrar(null); });
  document.body.append(d);
  d.showModal();
  return { cerrar, el: d };
}

export function confirmar(titulo, texto, { textoSi = 'Confirmar', tipo = 'primario' } = {}) {
  return new Promise(ok => {
    modal({ titulo, cuerpo: h('p', texto), alCerrar: v => ok(v === true),
      acciones: [{ texto: 'Cancelar', tipo: 'fantasma', valor: false }, { texto: textoSi, tipo, valor: true }] });
  });
}

// ---------- Estados ----------
export function vacio(ic, titulo, texto, accion) {
  return h('div.vacio', h('span.vacio__icono', icono(ic, 32)), h('span.vacio__titulo', titulo), texto ? h('p', texto) : null, accion || null);
}
export function esqueleto(n = 3) {
  return h('div.pila', { 'aria-busy': 'true', 'aria-label': 'Cargando' }, Array.from({ length: n }, () =>
    h('div.tarjeta.pila', h('span.esqueleto.esqueleto--titulo'), h('span.esqueleto.esqueleto--linea'), h('span.esqueleto.esqueleto--linea', { style: { width: '70%' } }))));
}
export function alerta(tipo, titulo, texto, acciones) {
  const ic = { info: 'info', exito: 'exito', advertencia: 'alerta', error: 'error' }[tipo] || 'info';
  return h('div.alerta.alerta--' + tipo, { role: tipo === 'error' ? 'alert' : 'status' }, icono(ic),
    h('div.alerta__cuerpo', h('strong', titulo), texto ? h('p', texto) : null, acciones ? h('div.alerta__acciones', acciones) : null));
}
export function boton(texto, { tipo = 'primario', ic, onclick, chico, bloque, href, attrs } = {}) {
  const cls = 'boton.boton--' + tipo + (chico ? '.boton--chico' : '') + (bloque ? '.boton--bloque' : '');
  const a = Object.assign({ type: href ? null : 'button', href, onclick }, attrs || {});
  return h((href ? 'a.' : 'button.') + cls, a, ic ? icono(ic, 20) : null, texto);
}
export function errorTexto(e) {
  if (!e) return 'Error desconocido.';
  if (e.codigo === 'RED') return 'Sin conexión. Intente de nuevo cuando haya señal.';
  return e.message || String(e);
}
export function datos(pares) {
  return h('dl.datos', pares.filter(p => p).flatMap(([k, v]) => [h('dt', k), h('dd', vacioV(v) ? '—' : v)]));
}
export function panelDatos(titulo, pares) { return h('div.panel-datos', titulo ? h('div.panel-datos__titulo', titulo) : null, datos(pares)); }
