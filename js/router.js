// Enrutador por hash: #/modulo/sub/:id
const rutas = [];

export function registrar(lista) {
  lista.forEach(r => {
    const nombres = [];
    const re = new RegExp('^' + r.p.split('/').map(seg => {
      if (seg.startsWith(':')) { nombres.push(seg.slice(1)); return '([^/]+)'; }
      return seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }).join('/') + '$');
    rutas.push(Object.assign({}, r, { re, nombres }));
  });
}

export function resolver(hash) {
  const limpio = (hash || '').replace(/^#\/?/, '');
  const [camino, consulta] = limpio.split('?');
  const q = Object.fromEntries(new URLSearchParams(consulta || ''));
  const c = camino || 'inicio';
  for (const r of rutas) {
    const m = r.re.exec(c);
    if (m) { const params = {}; r.nombres.forEach((n, i) => { params[n] = decodeURIComponent(m[i + 1]); }); return { def: r, params, q, camino: c }; }
  }
  return { def: null, params: {}, q, camino: c };
}

export function ir(camino, { reemplazar = false } = {}) {
  const h = '#/' + camino;
  if (reemplazar) { history.replaceState(null, '', h); dispatchEvent(new HashChangeEvent('hashchange')); }
  else if (location.hash === h) dispatchEvent(new HashChangeEvent('hashchange'));
  else location.hash = h;
}
export const recargar = () => dispatchEvent(new HashChangeEvent('hashchange'));
export const atras = (defecto) => { if (history.length > 1) history.back(); else ir(defecto || 'inicio'); };
