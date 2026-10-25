// Constructor de formularios a partir de definiciones de campo. Pensado para el pulgar a 375 px.
// def: { c: 'campo', l: 'Etiqueta', t: tipo, op: opciones | () => opciones, suf, req, ayuda, ph, ancho: 'medio', ro, min, max, paso, def }
// tipos: texto · area · numero · dinero · pct · fecha · fechahora · opciones · bool · multi · tel · correo · oculto · seccion
import { h, icono, vacioV, json } from './ui.js';
import { ZONA } from './config.js';

let contador = 0;
const sid = () => 'f' + (++contador);

function opcionesDe(def) {
  const op = typeof def.op === 'function' ? def.op() : (def.op || []);
  return op.map(o => (typeof o === 'object' ? o : { v: o, l: String(o) }));
}

function aEntrada(def, v) {
  if (vacioV(v)) return '';
  if (Array.isArray(v) || (typeof v === 'object' && v !== null)) return JSON.stringify(v);
  if (def.t === 'pct') return String(Math.round(Number(v) * 10000) / 100);
  if (def.t === 'fecha') return String(v).slice(0, 10);
  if (def.t === 'fechahora') return String(v).slice(0, 16);
  return String(v);
}

function deEntrada(def, s) {
  if (s === '' || s === null || s === undefined) return '';
  if (def.t === 'numero' || def.t === 'dinero') { const n = Number(String(s).replace(/[$,\s]/g, '')); return isNaN(n) ? NaN : n; }
  if (def.t === 'pct') { const n = Number(String(s).replace(/[%\s]/g, '')); return isNaN(n) ? NaN : Math.round(n * 100) / 10000; }
  if (def.t === 'fechahora') return s.length === 16 ? s + ':00' + ZONA : s;
  return typeof s === 'string' ? s.trim() : s;
}

export function campo(def, valor) {
  const id = sid();
  const etiqueta = h('span.campo__etiqueta', def.l, def.req ? h('span.campo__requerido', { 'aria-hidden': 'true' }, '*') : null);
  const ayuda = def.ayuda ? h('span.campo__ayuda', { id: id + 'a' }, def.ayuda) : null;
  const errorEl = h('span.campo__error', { id: id + 'e', hidden: true });
  let control, leer, fijar;
  const comunes = { id, name: def.c, required: def.req || null, disabled: def.ro || null, 'aria-describedby': [ayuda ? id + 'a' : '', id + 'e'].join(' ').trim() };

  if (def.t === 'oculto') {
    const el = h('input', { type: 'hidden', name: def.c, value: aEntrada(def, valor) });
    return { el, def, leer: () => deEntrada(def, el.value), fijar: v => { el.value = aEntrada(def, v); }, error: () => {} };
  }
  if (def.t === 'seccion') {
    return { el: h('h3.titulo-tarjeta', { style: { marginTop: '8px' } }, def.l), def, leer: () => undefined, fijar: () => {}, error: () => {}, seccion: true };
  }
  if (def.t === 'area') {
    control = h('textarea.area-texto', Object.assign({ placeholder: def.ph || null, rows: def.filas || 3 }, comunes));
    control.value = aEntrada(def, valor);
    leer = () => deEntrada(def, control.value); fijar = v => { control.value = aEntrada(def, v); };
  } else if (def.t === 'opciones') {
    control = h('select.selector', comunes, h('option', { value: '' }, def.ph || 'Seleccione…'),
      opcionesDe(def).map(o => h('option', { value: o.v }, o.l)));
    const v = aEntrada(def, valor);
    if (v && !opcionesDe(def).some(o => String(o.v) === v)) control.append(h('option', { value: v }, v));
    control.value = v;
    leer = () => deEntrada(def, control.value); fijar = v2 => { control.value = aEntrada(def, v2); };
  } else if (def.t === 'bool') {
    const inp = h('input', { type: 'checkbox', id, name: def.c, disabled: def.ro || null });
    inp.checked = valor === true || valor === 'TRUE' || valor === 'true';
    const el = h('label.opcion', inp, h('span.opcion__marca', icono('check', 16)), def.l);
    return { el, def, leer: () => inp.checked, fijar: v => { inp.checked = !!v; }, error: () => {} };
  } else if (def.t === 'multi') {
    const sel = new Set(json(valor).map(String));
    const caja = h('div', { role: 'group', 'aria-labelledby': id + 'l' });
    const items = opcionesDe(def);
    if (!items.length) caja.append(h('span.campo__ayuda', def.vacio || 'No hay opciones disponibles.'));
    items.forEach(o => {
      const inp = h('input', { type: 'checkbox', value: o.v, disabled: def.ro || null });
      inp.checked = sel.has(String(o.v));
      caja.append(h('label.opcion', inp, h('span.opcion__marca', icono('check', 16)), o.l));
    });
    const el = h('div.campo', h('span.campo__etiqueta', { id: id + 'l' }, def.l), caja, ayuda, errorEl);
    const leerM = () => [...caja.querySelectorAll('input:checked')].map(i => i.value);
    return { el, def, leer: leerM, fijar: () => {}, error: m => { errorEl.hidden = !m; errorEl.textContent = m || ''; }, multi: true };
  } else {
    const tipos = { texto: 'text', numero: 'text', dinero: 'text', pct: 'text', fecha: 'date', fechahora: 'datetime-local', tel: 'tel', correo: 'email' };
    const im = { numero: 'decimal', dinero: 'decimal', pct: 'decimal', tel: 'tel', correo: 'email' }[def.t];
    control = h('input.entrada' + (['numero', 'dinero', 'pct'].includes(def.t) ? '.entrada--numero' : ''),
      Object.assign({ type: tipos[def.t] || 'text', inputmode: im || null, placeholder: def.ph || null, autocomplete: def.auto || 'off', list: def.lista || null }, comunes));
    control.value = aEntrada(def, valor);
    const entrada = control;
    leer = () => deEntrada(def, entrada.value); fijar = v => { entrada.value = aEntrada(def, v); };
    const pre = def.t === 'dinero' ? h('span.campo__prefijo', '$') : null;
    const suf = def.suf || (def.t === 'pct' ? '%' : null);
    if (pre || suf) control = h('span.campo__control', pre, control, suf ? h('span.campo__sufijo', suf) : null);
  }
  const el = h('label.campo' + (def.ancho === 'medio' ? '.campo--medio' : ''), etiqueta, control, ayuda, errorEl);
  const inp = el.querySelector('input, select, textarea');
  const error = m => { errorEl.hidden = !m; vaciar(errorEl); if (m) errorEl.append(icono('alerta', 20), m); inp.setAttribute('aria-invalid', m ? 'true' : 'false'); };
  return { el, def, leer, fijar, error, control: inp };
}
function vaciar(e) { while (e.firstChild) e.removeChild(e.firstChild); }

/**
 * Formulario completo. Devuelve { el, leer(), validar(), campos }.
 * leer() → objeto con los valores; validar() marca errores y devuelve true/false.
 */
export function formulario(defs, registro = {}, { columnas = true } = {}) {
  const campos = defs.filter(Boolean).map(d => campo(d, registro[d.c] !== undefined ? registro[d.c] : d.def));
  const grid = h('div.formulario' + (columnas ? '.formulario--columnas' : ''));
  campos.forEach(c => grid.append(c.el));
  const leer = () => {
    const o = {};
    campos.forEach(c => { if (!c.seccion && !c.def.ro) { const v = c.leer(); if (v !== undefined) o[c.def.c] = v; } });
    return o;
  };
  const validar = () => {
    let ok = true, primero = null;
    campos.forEach(c => {
      if (c.seccion || c.def.ro) return;
      const v = c.leer();
      let m = '';
      if (c.def.req && (v === '' || (Array.isArray(v) && !v.length))) m = 'Este dato es obligatorio.';
      else if (typeof v === 'number' && isNaN(v)) m = 'Escriba un número válido.';
      else if (typeof v === 'number' && c.def.min !== undefined && v < c.def.min) m = `El valor mínimo es ${c.def.min}.`;
      else if (typeof v === 'number' && c.def.max !== undefined && v > c.def.max) m = `El valor máximo es ${c.def.max}.`;
      else if (c.def.validar) m = c.def.validar(v, leer()) || '';
      c.error(m);
      if (m) { ok = false; if (!primero) primero = c; }
    });
    if (primero && primero.control) primero.control.focus();
    return ok;
  };
  return { el: grid, leer, validar, campos, campo: n => campos.find(c => c.def.c === n) };
}
