// Gráficas ligeras en SVG propio (sin bibliotecas): barras agrupadas y línea. Texto alternativo para lectores.
const NS = 'http://www.w3.org/2000/svg';
const el = (t, a = {}, txt) => { const e = document.createElementNS(NS, t); Object.entries(a).forEach(([k, v]) => e.setAttribute(k, v)); if (txt !== undefined) e.textContent = txt; return e; };

export const COLORES = ['#042146', '#DB0513', '#5B5C5C', '#1E5AA8'];

/** Convierte un valor mostrado por la Ficha ("$1,234.50", "-", "12.5%") a número. */
export function valorVista(s) {
  if (s === null || s === undefined) return 0;
  const t = String(s).trim();
  if (!t || t === '-' || t === '—') return 0;
  const neg = /^\(.*\)$/.test(t) || /^-/.test(t);
  const n = Number(t.replace(/[()$,%\s]/g, '').replace(/^-/, ''));
  if (isNaN(n)) return 0;
  const v = /%$/.test(t) ? n / 100 : n;
  return neg ? -v : v;
}

function escala(max, min) {
  const rango = max - min || 1;
  const paso = Math.pow(10, Math.floor(Math.log10(rango / 4)));
  const k = [1, 2, 2.5, 5, 10].find(x => rango / (x * paso) <= 5) * paso;
  return { min: Math.floor(min / k) * k, max: Math.ceil(max / k) * k || k, paso: k };
}
const corto = v => {
  const a = Math.abs(v);
  if (a >= 1e6) return '$' + (v / 1e6).toLocaleString('es-MX', { maximumFractionDigits: 1 }) + ' M';
  if (a >= 1e3) return '$' + (v / 1e3).toLocaleString('es-MX', { maximumFractionDigits: 0 }) + ' mil';
  return '$' + v.toLocaleString('es-MX', { maximumFractionDigits: 0 });
};

function marco(titulo, ancho, alto) {
  const s = el('svg', { viewBox: `0 0 ${ancho} ${alto}`, role: 'img', 'aria-label': titulo, class: 'grafica', preserveAspectRatio: 'xMidYMid meet' });
  s.append(el('title', {}, titulo));
  return s;
}

/** Barras agrupadas. series: [{nombre, valores:[...] }], etiquetas: [...] */
export function barras(titulo, etiquetas, series, { alto = 240, formato = corto } = {}) {
  const W = 640, H = alto, ml = 64, mr = 12, mt = 16, mb = 40;
  const todos = series.flatMap(s => s.valores);
  const e = escala(Math.max(0, ...todos), Math.min(0, ...todos));
  const s = marco(titulo, W, H);
  const y = v => mt + (H - mt - mb) * (1 - (v - e.min) / (e.max - e.min));
  for (let v = e.min; v <= e.max + 1e-9; v += e.paso) {
    s.append(el('line', { x1: ml, x2: W - mr, y1: y(v), y2: y(v), stroke: v === 0 ? '#858F9C' : '#DDE1E5', 'stroke-width': 1 }));
    s.append(el('text', { x: ml - 8, y: y(v) + 4, 'text-anchor': 'end', class: 'grafica__eje' }, formato(v)));
  }
  const banda = (W - ml - mr) / etiquetas.length;
  const bw = Math.min(28, (banda * 0.7) / series.length);
  etiquetas.forEach((et, i) => {
    const x0 = ml + banda * i + (banda - bw * series.length) / 2;
    series.forEach((se, j) => {
      const v = se.valores[i] || 0;
      const y1 = y(Math.max(0, v)), y2 = y(Math.min(0, v));
      const r = el('rect', { x: x0 + j * bw, y: y1, width: bw - 2, height: Math.max(0, y2 - y1), fill: se.color || COLORES[j], rx: 2 });
      r.append(el('title', {}, `${se.nombre} · ${et}: ${formato(v)}`));
      s.append(r);
    });
    s.append(el('text', { x: ml + banda * i + banda / 2, y: H - mb + 18, 'text-anchor': 'middle', class: 'grafica__eje' }, et));
  });
  return envolver(s, series);
}

/** Línea con área suave. */
export function linea(titulo, etiquetas, series, { alto = 240, formato = corto, referencia } = {}) {
  const W = 640, H = alto, ml = 64, mr = 12, mt = 16, mb = 40;
  const todos = series.flatMap(s => s.valores).concat(referencia ? referencia.valores : []);
  const e = escala(Math.max(0, ...todos), Math.min(0, ...todos));
  const s = marco(titulo, W, H);
  const y = v => mt + (H - mt - mb) * (1 - (v - e.min) / (e.max - e.min));
  const x = i => ml + ((W - ml - mr) * i) / Math.max(1, etiquetas.length - 1);
  for (let v = e.min; v <= e.max + 1e-9; v += e.paso) {
    s.append(el('line', { x1: ml, x2: W - mr, y1: y(v), y2: y(v), stroke: v === 0 ? '#858F9C' : '#DDE1E5', 'stroke-width': 1 }));
    s.append(el('text', { x: ml - 8, y: y(v) + 4, 'text-anchor': 'end', class: 'grafica__eje' }, formato(v)));
  }
  const cada = Math.ceil(etiquetas.length / 7);
  etiquetas.forEach((et, i) => { if (i % cada === 0) s.append(el('text', { x: x(i), y: H - mb + 18, 'text-anchor': 'middle', class: 'grafica__eje' }, et)); });
  if (referencia) s.append(el('polyline', { points: referencia.valores.map((v, i) => `${x(i)},${y(v)}`).join(' '), fill: 'none', stroke: '#DB0513', 'stroke-width': 2, 'stroke-dasharray': '6 5' }));
  series.forEach((se, j) => {
    const pts = se.valores.map((v, i) => `${x(i)},${y(v)}`).join(' ');
    if (j === 0) s.append(el('polygon', { points: `${x(0)},${y(Math.max(0, e.min))} ${pts} ${x(se.valores.length - 1)},${y(Math.max(0, e.min))}`, fill: 'rgba(4,33,70,0.08)' }));
    s.append(el('polyline', { points: pts, fill: 'none', stroke: se.color || COLORES[j], 'stroke-width': 2.5, 'stroke-linejoin': 'round' }));
    se.valores.forEach((v, i) => { const c = el('circle', { cx: x(i), cy: y(v), r: 3.5, fill: '#FFFFFF', stroke: se.color || COLORES[j], 'stroke-width': 2 }); c.append(el('title', {}, `${etiquetas[i]}: ${formato(v)}`)); s.append(c); });
  });
  return envolver(s, referencia ? series.concat([{ nombre: referencia.nombre, color: '#DB0513', punteada: true }]) : series);
}

function envolver(svg, series) {
  const f = document.createElement('figure'); f.className = 'grafica-marco';
  f.append(svg);
  if (series.length > 1) {
    const l = document.createElement('figcaption'); l.className = 'grafica__leyenda';
    series.forEach((se, j) => {
      const i = document.createElement('span');
      const m = document.createElement('span'); m.className = 'grafica__marca' + (se.punteada ? ' grafica__marca--punteada' : ''); m.style.background = se.color || COLORES[j];
      i.append(m, document.createTextNode(se.nombre)); l.append(i);
    });
    f.append(l);
  }
  return f;
}
