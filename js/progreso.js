// Barra de progreso con pasos. El motor calcula el progreso (hitos_ en 08_Portal.gs) y lo entrega idéntico
// a la app interna y al portal de clientes: { pasos:[{nombre, estado:'hecho'|'actual'|'pendiente', fecha, detalle}], pct, estado, detalle, cancelado }.
import { h, icono, fecha } from './ui.js';

const pctTexto = p => Math.round((Number(p) || 0) * 100) + ' %';

/** Versión completa: encabezado con estatus y porcentaje, barra y lista de pasos. */
export function barraProgreso(p, { titulo = 'Progreso' } = {}) {
  if (!p || !Array.isArray(p.pasos) || !p.pasos.length) return null;
  const hechos = p.pasos.filter(x => x.estado === 'hecho').length;
  const total = p.pasos.length;
  const cls = 'section.progreso' + (p.cancelado ? '.progreso--cancelado' : '') + (p.pct >= 1 && !p.cancelado ? '.progreso--concluido' : '');
  return h(cls, { 'aria-label': titulo },
    h('div.progreso__encabezado',
      h('div', h('h2.progreso__titulo', titulo), h('p.progreso__estado', p.estado || '')),
      h('span.progreso__pct', { 'aria-hidden': 'true' }, p.cancelado ? '—' : pctTexto(p.pct))),
    h('div.progreso__barra', { role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(Math.round((p.pct || 0) * 100)),
      'aria-valuetext': `${p.estado || ''}: ${hechos} de ${total} pasos` }, h('span', { style: { width: Math.round((p.pct || 0) * 100) + '%' } })),
    p.detalle ? h('p.progreso__detalle', p.detalle) : null,
    h('ol.progreso__pasos', p.pasos.map((x, i) => {
      const ultimoCancelado = p.cancelado && x.estado !== 'pendiente' && (i === total - 1 || p.pasos[i + 1].estado === 'pendiente');
      const est = ultimoCancelado ? 'cancelado' : x.estado;
      const marca = est === 'hecho' ? icono('check', 16) : est === 'cancelado' ? icono('cerrar', 16) : null;
      const texto = { hecho: 'completado', actual: 'en curso', pendiente: 'pendiente', cancelado: 'detenido' }[est];
      return h('li.progreso__paso.progreso__paso--' + est, { 'aria-current': est === 'actual' ? 'step' : null },
        h('span.progreso__marca', { 'aria-hidden': 'true' }, marca),
        h('span.progreso__texto',
          h('span.progreso__nombre', x.nombre, h('span.solo-lector', ' · ' + texto)),
          (x.fecha || x.detalle) ? h('span.progreso__meta', [x.fecha ? fecha(x.fecha) : '', x.detalle || ''].filter(Boolean).join(' · ')) : null));
    })));
}

/** Versión compacta para listas: estatus legible y barra delgada. */
export function progresoMini(p) {
  if (!p || !Array.isArray(p.pasos)) return null;
  return h('span.progreso-mini' + (p.cancelado ? '.progreso-mini--cancelado' : ''),
    h('span.progreso-mini__barra', { 'aria-hidden': 'true' }, h('span', { style: { width: Math.round((p.pct || 0) * 100) + '%' } })),
    h('span.progreso-mini__texto', p.estado || ''));
}
