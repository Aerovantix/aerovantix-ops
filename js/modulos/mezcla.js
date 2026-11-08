// Calculadora de mezcla: producto por carga, concentración del caldo, orden de carga, alertas, prueba de jarra
// y comparativo entre equipos. Todo se calcula en el teléfono: funciona sin conexión y no escribe en el motor.
// Regla de fondo: la dosis por hectárea de la etiqueta no cambia entre equipos; lo que cambia es el volumen de agua.
import { h, icono, vaciar, toast, boton, alerta } from '../ui.js';
import { pantalla } from '../vistas.js';
import { cat, rol } from '../estado.js';
import * as db from '../db.js';
import { skuInfo } from './comunes.js';

// ---------- Modelos ----------
// Capacidad del tanque de aspersión. EAVision J150 (versión internacional): 70 L según la ficha del fabricante.
// DJI: T100 100 L, T70P 70 L (50 L con batería DB1580), T50 40 L, T25/T25P 20 L.
// maxFlujo: gasto total máximo en L/min (J150: 10.5 gal/min con 4 boquillas ≈ 39.7 L/min).
const MODELOS = [
  { id: 'j150', n: 'EAVision J150', tanque: 70, vol: 19, maxFlujo: 39.7, re: /J\s*-?150/i },
  { id: 't100', n: 'DJI Agras T100', tanque: 100, vol: 15, re: /T\s*-?100/i },
  { id: 't70p', n: 'DJI Agras T70P', tanque: 70, vol: 15, re: /T\s*-?70\s*P?/i },
  { id: 't50', n: 'DJI Agras T50', tanque: 40, vol: 15, re: /T\s*-?50/i },
  { id: 't25', n: 'DJI Agras T25 / T25P', tanque: 20, vol: 15, re: /T\s*-?25/i },
  { id: 'moch20', n: 'Mochila manual 20 L', tanque: 20, vol: 300 },
  { id: 'moch16', n: 'Mochila manual 16 L', tanque: 16, vol: 300 },
  { id: 'tractor', n: 'Aspersora de tractor 400 L', tanque: 400, vol: 200 },
  { id: 'otro', n: 'Otro equipo (capturar tanque)', tanque: null, vol: null }
];
const modelo = id => MODELOS.find(m => m.id === id) || MODELOS[MODELOS.length - 1];
const TIPOS = [['insecticida', 'Insecticida'], ['fungicida', 'Fungicida'], ['herbicida', 'Herbicida'], ['foliar', 'Fertilizante foliar'], ['bioestimulante', 'Bioestimulante'],
  ['acondicionador', 'Acondicionador de agua / pH'], ['adyuvante', 'Adyuvante'], ['otro', 'Otro / sin clasificar']];
const FORMS = [['WP', 'WP · polvo mojable'], ['WG', 'WG/DF · gránulo dispersable'], ['SC', 'SC/CS · suspensión'], ['OD', 'OD · dispersión en aceite'],
  ['EC', 'EC/EW · emulsionable'], ['SL', 'SL · líquido soluble'], ['SP', 'SP/SG · polvo soluble'], ['OTRO', 'Otra / no sé']];
const UNIDADES = [['L/ha', 'L/ha'], ['mL/ha', 'mL/ha'], ['kg/ha', 'kg/ha'], ['g/ha', 'g/ha'], ['pct', '% del caldo']];
const NOTA_ORDEN = { 1: 'Primero: corrige pH y dureza del agua', 2: 'Sólido dispersable: premezcle en cubeta y agregue con agitación', 3: 'Suspensión: agite el envase antes de medir',
  4: 'Emulsionable u oleoso', 5: 'Soluble', 6: 'Nutrición foliar después de los fitosanitarios', 7: 'Al final: adyuvantes' };

const EJEMPLO = () => ({
  equipo: 'm:j150', tanque: 70, vol: 19, ha: 8, maxFoliar: 5, cmp: 'm:moch20', cmpTanque: 20, cmpVol: 300,
  productos: [
    { n: 'Insecticida (ejemplo)', tipo: 'insecticida', form: 'SC', dosis: '0.5', u: 'L/ha' },
    { n: 'Foliar 20-20-20 (ejemplo)', tipo: 'foliar', form: 'SP', dosis: '2', u: 'kg/ha' },
    { n: 'Antievaporante (ejemplo)', tipo: 'adyuvante', form: 'SL', dosis: '0.5', u: 'pct' }
  ]
});

// ---------- Equipos: modelos y flota propia ----------
function dronesFlota() {
  return cat('Equipos').filter(e => e.tipo === 'Dron' && !['Mercancía para venta', 'Del cliente'].includes(e.propiedad) && e.estatus !== 'Baja').map(e => {
    const desc = [(skuInfo(e.sku) || {}).descripcion, e.sku, e.modelo].filter(Boolean).join(' ');
    const m = MODELOS.find(x => x.re && x.re.test(desc));
    return { v: 'e:' + e.serie, n: `${e.serie} · ${m ? m.n : ((skuInfo(e.sku) || {}).descripcion || e.sku || 'Dron')}`, m };
  });
}
function equipoDe(v) {
  if (!v) return { n: 'Equipo', m: null };
  if (v.startsWith('m:')) { const m = modelo(v.slice(2)); return { n: m.n, m: m.tanque ? m : null }; }
  const d = dronesFlota().find(x => x.v === v);
  return d ? { n: d.n, m: d.m } : { n: v.slice(2), m: null };
}
function opcionesEquipo(sel, actual) {
  vaciar(sel);
  const flota = dronesFlota();
  if (flota.length) sel.append(h('optgroup', { label: 'Flota Aerovantix' }, flota.map(d => h('option', { value: d.v }, d.n))));
  sel.append(h('optgroup', { label: 'Modelos' }, MODELOS.map(m => h('option', { value: 'm:' + m.id }, m.n))));
  if (actual && ![...sel.options].some(o => o.value === actual)) sel.append(h('option', { value: actual }, equipoDe(actual).n));
  sel.value = actual || 'm:j150';
}

// ---------- Formatos ----------
const nr = v => { const n = parseFloat(String(v ?? '').replace(',', '.')); return isFinite(n) ? n : NaN; };
const fx = (v, d) => v.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: d });
const fn = v => { const a = Math.abs(v); return fx(v, a < 10 ? 2 : a < 100 ? 1 : 0); };
function cant(v, solido) {
  if (!isFinite(v) || v <= 0) return '0';
  if (v < 1) { const s = v * 1000; return fx(s, s < 10 ? 1 : 0) + (solido ? ' g' : ' mL'); }
  return fn(v) + (solido ? ' kg' : ' L');
}
const conc = (c, solido) => (isFinite(c) ? fx(c, c < 1 ? 2 : c < 10 ? 1 : 0) + (solido ? ' g/L' : ' mL/L') : '—');
const pctT = p => (isFinite(p) ? fx(p, p < 0.1 ? 3 : p < 1 ? 2 : 1) + ' %' : '—');
const etq = (lista, k) => (lista.find(x => x[0] === k) || [k, k])[1];

// ---------- Cálculo ----------
function rango(p) {
  if (p.tipo === 'acondicionador') return 1;
  if (p.tipo === 'adyuvante') return 7;
  if (p.tipo === 'foliar' || p.tipo === 'bioestimulante') return 6;
  return { WP: 2, WG: 2, SC: 3, OD: 4, EC: 4, SL: 5, SP: 5 }[p.form] || 5;
}
function calcular(s) {
  const tanque = nr(s.tanque), vol = nr(s.vol), ha = nr(s.ha), maxF = nr(s.maxFoliar), cT = nr(s.cmpTanque), cV = nr(s.cmpVol);
  const ok = tanque > 0 && vol > 0 && ha > 0;
  const total = vol * ha;
  const completas = ok ? Math.floor(total / tanque + 1e-9) : 0;
  let resto = ok ? total - completas * tanque : 0;
  if (resto < 0.05) resto = 0;
  const filas = s.productos.map(p => {
    const d = nr(p.dosis), solido = p.u === 'kg/ha' || p.u === 'g/ha';
    let qHa = NaN;
    if (d > 0) qHa = p.u === 'L/ha' || p.u === 'kg/ha' ? d : p.u === 'pct' ? d / 100 * vol : d / 1000;
    const qCmp = p.u === 'pct' && d > 0 ? d / 100 * cV : qHa;
    const c = qHa / vol * 1000;
    return { p, solido, qHa, valido: isFinite(qHa), porCarga: qHa * tanque / vol, conc: c, pct: c / 10, total: qHa * ha, parcial: qHa * resto / vol,
      cmpCarga: qCmp * cT / cV, cmpConc: qCmp / cV * 1000, rango: rango(p) };
  });
  const validas = filas.filter(r => r.valido);
  const carga = validas.reduce((t, r) => t + r.porCarga, 0);
  const liquidos = validas.filter(r => !r.solido).reduce((t, r) => t + r.porCarga, 0);
  return { ok, tanque, vol, ha, maxF, cT, cV, haCarga: tanque / vol, total, completas, resto, filas, validas, carga, agua: tanque - liquidos,
    orden: filas.slice().sort((a, b) => a.rango - b.rango) };
}

function alertasDe(c, s) {
  const A = [];
  if (!c.ok) return [['error', 'Faltan datos', 'Capture capacidad del tanque, volumen de aplicación y superficie, todos mayores a cero.']];
  const bajoVol = c.vol <= 60, frac = c.carga / c.tanque;
  if (frac > 1) A.push(['error', 'La mezcla no cabe en el tanque', `Los productos suman ${fn(c.carga)} por carga y el tanque es de ${fn(c.tanque)} L. Suba el volumen de aplicación o fraccione la dosis en dos aplicaciones.`]);
  else if (frac > 0.30) A.push(['error', 'Mezcla saturada', `El ${fx(frac * 100, 0)} % de la carga es producto y queda poca agua: viscosidad alta, taponamiento de boquillas e incompatibilidad. Suba el volumen o fraccione la dosis.`]);
  else if (frac > 0.15) A.push(['advertencia', 'Mezcla muy concentrada', `El ${fx(frac * 100, 0)} % de la carga es producto. Haga la prueba de jarra antes de cargar el tanque.`]);
  c.validas.forEach(r => {
    if ((r.p.tipo === 'foliar' || r.p.tipo === 'bioestimulante') && c.maxF > 0 && r.pct > c.maxF) {
      A.push([r.pct > 2 * c.maxF ? 'error' : 'advertencia', 'Riesgo de quemadura del follaje',
        `${r.p.n || 'El foliar'} queda al ${pctT(r.pct)} en el caldo, arriba del máximo de ${pctT(c.maxF)}. Para quedar en el tope necesita ${fn(r.qHa * 1000 / (c.maxF * 10))} L/ha; también puede fraccionar la dosis o usar una formulación para bajo volumen. Aplique en horas frescas.`]);
    }
    if (bajoVol && r.p.form === 'WP') A.push(['advertencia', 'Polvo mojable en bajo volumen', `${r.p.n || 'El producto WP'} tiende a tapar filtros y boquillas. Haga una pre-dilución en cubeta, cuele y mantenga la agitación.`]);
  });
  if (bajoVol && c.vol < 8) A.push(['advertencia', 'Volumen muy bajo', 'Con menos de 8 L/ha la cobertura queda comprometida en la mayoría de los cultivos. Valídelo con papel hidrosensible (gotas/cm²).']);
  const eq = equipoDe(s.equipo);
  if (eq.m && eq.m.id === 'j150') A.push(['info', 'EAVision J150', `Tanque de 70 L (versión internacional). Ajuste el tamaño de gota (10–300 µm) según el producto: más fina en insecticidas de contacto y fungicidas, más gruesa en herbicidas para reducir deriva.`]);
  if (s.equipo && s.equipo.startsWith('e:') && !eq.m) A.push(['info', 'Modelo no reconocido', 'No identifiqué el modelo de este dron en el catálogo. Verifique que la capacidad del tanque sea la correcta.']);
  s.productos.forEach((p, i) => { if (!(nr(p.dosis) > 0)) A.push(['info', 'Falta la dosis', `Capture la dosis de etiqueta de ${p.n || 'producto ' + (i + 1)}.`]); });
  if (!A.some(a => a[0] === 'error' || a[0] === 'advertencia')) A.unshift(['exito', 'Sin alertas', 'Con los datos capturados la mezcla está dentro de rangos de trabajo. Respete la dosis por hectárea de la etiqueta.']);
  return A;
}

function fichaTexto(c, s, A) {
  const L = ['AEROVANTIX · FICHA DE MEZCLA'];
  if (!c.ok) return L.concat('Capture equipo, volumen y superficie.').join('\n');
  L.push(`Equipo: ${equipoDe(s.equipo).n} · tanque ${fn(c.tanque)} L · ${fn(c.vol)} L/ha`);
  if (s.ref) L.push(`Referencia: ${s.ref}`);
  L.push(`Superficie: ${fn(c.ha)} ha · caldo total ${fn(c.total)} L`);
  L.push(`Cada carga cubre ${fn(c.haCarga)} ha · ${c.completas} carga(s) completa(s)${c.resto > 0 ? ` + 1 parcial de ${fn(c.resto)} L` : ''}`, '', `ORDEN DE CARGA (por carga completa de ${fn(c.tanque)} L)`);
  let n = 1;
  L.push(`${n++}. Agua al 50–70 % del tanque, con agitación`);
  c.orden.forEach(r => L.push(`${n++}. ${r.p.n || 'Producto'} [${r.p.form}]: ${r.valido ? `${cant(r.porCarga, r.solido)}  (dosis ${cant(r.qHa, r.solido)}/ha · ${conc(r.conc, r.solido)})` : 'FALTA DOSIS'}`));
  L.push(`${n++}. Completar con agua hasta ${fn(c.tanque)} L`);
  const v = c.orden.filter(r => r.valido);
  if (c.resto > 0 && v.length) { L.push('', `ÚLTIMA CARGA PARCIAL (${fn(c.resto)} L)`); v.forEach(r => L.push(`- ${r.p.n || 'Producto'}: ${cant(r.parcial, r.solido)}`)); }
  if (v.length) { L.push('', 'TOTAL A SURTIR PARA EL TRABAJO'); v.forEach(r => L.push(`- ${r.p.n || 'Producto'}: ${cant(r.total, r.solido)}`)); }
  const al = A.filter(a => a[0] === 'error' || a[0] === 'advertencia');
  if (al.length) { L.push('', 'ALERTAS'); al.forEach(a => L.push(`- ${a[1].toUpperCase()}: ${a[2]}`)); }
  L.push('', 'Respete la dosis por hectárea, el intervalo de seguridad y el equipo de protección que indica la etiqueta.');
  return L.join('\n');
}

// ---------- Piezas de captura ----------
function numCampo(etiqueta, valor, suf, alCambiar, ayuda) {
  const inp = h('input.entrada.entrada--numero', { type: 'text', inputmode: 'decimal', autocomplete: 'off', value: valor ?? '' });
  inp.addEventListener('input', () => alCambiar(inp.value));
  return { el: h('label.campo', h('span.campo__etiqueta', etiqueta), h('span.campo__control', inp, suf ? h('span.campo__sufijo', suf) : null), ayuda ? h('span.campo__ayuda', ayuda) : null), inp };
}
function selCampo(etiqueta, lista, valor, alCambiar) {
  const sel = h('select.selector', lista.map(([v, l]) => h('option', { value: v }, l)));
  sel.value = valor; sel.addEventListener('change', () => alCambiar(sel.value));
  return { el: h('label.campo', h('span.campo__etiqueta', etiqueta), sel), sel };
}

// ---------- Pantalla ----------
async function pantallaMezcla(c, params, q) {
  let s = null;
  const desdeOS = q && (q.os || q.ha || q.prod);
  if (!desdeOS) { try { s = await db.leer('mezcla'); } catch (e) { /* sin acción */ } }
  if (!s || !Array.isArray(s.productos)) s = EJEMPLO();
  if (desdeOS) {
    s = EJEMPLO();
    s.productos = [];
    if (q.dron) {
      const d = dronesFlota().find(x => x.v === 'e:' + q.dron);
      s.equipo = 'e:' + q.dron;
      if (d && d.m) { s.tanque = d.m.tanque; s.vol = d.m.vol; }
    }
    if (nr(q.ha) > 0) s.ha = nr(q.ha);
    if (q.prod || q.dosis) s.productos.push({ n: q.prod || '', tipo: 'otro', form: 'OTRO', dosis: q.dosis || '', u: q.u === 'kg/ha' ? 'kg/ha' : 'L/ha' });
    s.ref = q.ref || '';
  }
  const volver = q && q.os ? 'os/' + q.os + '?vista=etapas' : null;
  const cuerpo = pantalla(c, { titulo: 'Calculadora de mezcla', sub: 'Producto por carga, concentración del caldo y orden de carga. Funciona sin conexión.', volver,
    acciones: [boton('Restablecer ejemplo', { tipo: 'fantasma', chico: true, onclick: () => { s = EJEMPLO(); montar(); recalcular(); } })] });
  cuerpo.classList.add('no-refrescar');

  let guardarT = null;
  const persistir = () => { clearTimeout(guardarT); guardarT = setTimeout(() => { db.escribir('mezcla', JSON.parse(JSON.stringify(s))).catch(() => {}); }, 400); };

  const colCaptura = h('div.pila'), colResultado = h('div.pila');
  cuerpo.append(h('p.texto-suave', 'Capture la dosis por hectárea de la etiqueta. La dosis no cambia entre dron y mochila; lo que cambia es el agua, y por eso la concentración del caldo.'),
    h('div.rejilla--2.mezcla', colCaptura, colResultado));

  // Zonas de resultado
  const zKpi = h('div.rejilla.mezcla__kpis'), zAlertas = h('div.pila'), zOrden = h('div.pila'), zParcial = h('div'), zCmp = h('div.pila'), zFicha = h('textarea.area-texto.mezcla__ficha', { readonly: true, rows: 12, 'aria-label': 'Ficha de mezcla en texto' });
  const zCalib = h('p.campo__ayuda');

  function montar() {
    vaciar(colCaptura); vaciar(colResultado);
    // Equipo
    const selEq = h('select.selector', { 'aria-label': 'Equipo' });
    opcionesEquipo(selEq, s.equipo);
    const fTanque = numCampo('Capacidad del tanque', s.tanque, 'L', v => { s.tanque = v; recalcular(); });
    const fVol = numCampo('Volumen de aplicación', s.vol, 'L/ha', v => { s.vol = v; recalcular(); });
    const fHa = numCampo('Superficie a aplicar', s.ha, 'ha', v => { s.ha = v; recalcular(); });
    const fMax = numCampo('Máximo foliar en el caldo', s.maxFoliar, '%', v => { s.maxFoliar = v; recalcular(); }, 'Tope contra quemadura; ajústelo a la etiqueta del fertilizante.');
    selEq.addEventListener('change', () => {
      s.equipo = selEq.value; const eq = equipoDe(s.equipo);
      if (eq.m) { s.tanque = eq.m.tanque; s.vol = eq.m.vol; fTanque.inp.value = s.tanque; fVol.inp.value = s.vol; }
      else if (s.equipo === 'm:otro') { fTanque.inp.focus(); }
      const bajo = nr(s.vol) <= 60, cm = modelo(bajo ? 'moch20' : 'j150');
      s.cmp = 'm:' + cm.id; s.cmpTanque = cm.tanque; s.cmpVol = cm.vol; montarCmp();
      recalcular();
    });
    // Calibración
    const cal = { q: '', a: '15', v: '6', vu: 'ms' };
    const fQ = numCampo('Gasto total de boquillas', cal.q, 'L/min', v => { cal.q = v; pintarCalib(); });
    const fA = numCampo('Ancho de franja', cal.a, 'm', v => { cal.a = v; pintarCalib(); });
    const fV = numCampo('Velocidad', cal.v, null, v => { cal.v = v; pintarCalib(); });
    const selVu = h('select.selector.mezcla__unidad', { 'aria-label': 'Unidad de velocidad' }, h('option', { value: 'ms' }, 'm/s'), h('option', { value: 'kmh' }, 'km/h'));
    selVu.value = cal.vu; selVu.addEventListener('change', () => { cal.vu = selVu.value; pintarCalib(); });
    fV.inp.after(selVu);
    const resCal = h('strong.cifra');
    const usarCal = boton('Usar este volumen', { tipo: 'secundario', chico: true, onclick: () => { const r = volCalib(); if (!isFinite(r)) return toast('Capture gasto, ancho y velocidad.', 'info'); s.vol = Math.round(r * 10) / 10; fVol.inp.value = s.vol; recalcular(); } });
    function kmh() { const v = nr(cal.v); return cal.vu === 'ms' ? v * 3.6 : v; }
    function volCalib() { const qq = nr(cal.q), a = nr(cal.a), v = kmh(); return qq > 0 && a > 0 && v > 0 ? qq * 600 / (a * v) : NaN; }
    function pintarCalib() {
      const r = volCalib(); resCal.textContent = isFinite(r) ? fn(r) + ' L/ha' : '—';
      const a = nr(cal.a), v = kmh(), vol = nr(s.vol), eq = equipoDe(s.equipo);
      vaciar(zCalib); zCalib.style.color = '';
      if (a > 0 && v > 0 && vol > 0) {
        const req = vol * a * v / 600;
        zCalib.append(`Para ${fn(vol)} L/ha con este ancho y velocidad se necesitan ${fn(req)} L/min de gasto total.`);
        if (eq.m && eq.m.maxFlujo) {
          if (req > eq.m.maxFlujo) { zCalib.style.color = 'var(--avx-error)'; zCalib.append(` Supera el máximo del ${eq.m.n} (${fn(eq.m.maxFlujo)} L/min con 4 boquillas): baje la velocidad o el ancho.`); }
          else zCalib.append(` Dentro del máximo del ${eq.m.n} (${fn(eq.m.maxFlujo)} L/min con 4 boquillas; con 2 boquillas es la mitad).`);
        }
      }
    }
    montar.pintarCalib = pintarCalib;
    colCaptura.append(
      h('section.tarjeta.pila', h('h2.titulo-tarjeta', 'Equipo y superficie'),
        h('label.campo', h('span.campo__etiqueta', 'Equipo'), selEq),
        h('div.formulario.formulario--columnas', ...[fTanque, fVol, fHa, fMax].map(f => { f.el.classList.add('campo--medio'); return f.el; })),
        h('details.mezcla__calib', h('summary', 'Calibrar o verificar el volumen'),
          h('div.pila', h('p.texto-suave', 'Dron: gasto total de todas las boquillas, ancho efectivo y velocidad de vuelo. Mochila o tractor: gasto de la boquilla y ancho de franja.'),
            h('div.formulario.formulario--columnas', ...[fQ, fA, fV].map(f => { f.el.classList.add('campo--medio'); return f.el; })),
            h('div.fila', h('span', 'Volumen = gasto × 600 ÷ (ancho × velocidad) = ', resCal), usarCal), zCalib))),
      h('section.tarjeta.pila', h('div.fila.encabezado-seccion', h('h2.titulo-tarjeta', 'Productos de la mezcla'),
        boton('Vaciar', { tipo: 'fantasma', chico: true, onclick: () => { s.productos = []; pintarProductos(); recalcular(); } })),
        h('p.campo__ayuda', 'Use «% del caldo» solo para adyuvantes que se dosifican por volumen de mezcla.'), zProductos,
        boton('Agregar producto', { tipo: 'secundario', ic: 'mas', bloque: true, onclick: () => { s.productos.push({ n: '', tipo: 'insecticida', form: 'SC', dosis: '', u: 'L/ha' }); pintarProductos(); recalcular(); const ult = zProductos.querySelector('.mezcla__producto:last-child input'); if (ult) ult.focus(); } })));
    pintarProductos();
    // Resultados
    const copiar = boton('Copiar ficha', { tipo: 'secundario', chico: true, onclick: async () => {
      try { await navigator.clipboard.writeText(zFicha.value); toast('Ficha copiada'); } catch (e) { zFicha.focus(); zFicha.select(); toast('Seleccione el texto y cópielo.', 'info'); }
    } });
    const compartir = navigator.share ? boton('Compartir', { tipo: 'primario', chico: true, onclick: async () => { try { await navigator.share({ title: 'Ficha de mezcla', text: zFicha.value }); } catch (e) { /* cancelado */ } } }) : null;
    colResultado.append(
      h('section.tarjeta.pila', h('h2.titulo-tarjeta', 'Resultado por carga'), zKpi, zAlertas),
      h('section.tarjeta.pila', h('h2.titulo-tarjeta', 'Orden de carga del tanque'), zOrden, zParcial),
      zCmpTarjeta,
      h('section.tarjeta.pila', h('div.fila.encabezado-seccion', h('h2.titulo-tarjeta', 'Ficha de mezcla'), h('div.fila', copiar, compartir)),
        h('p.campo__ayuda', 'Para la orden de trabajo o para enviar por WhatsApp al técnico.'), zFicha));
    montarCmp();
  }

  // Productos
  const zProductos = h('div.pila');
  function pintarProductos() {
    vaciar(zProductos);
    if (!s.productos.length) { zProductos.append(h('p.texto-suave', 'No hay productos. Agregue el primero.')); return; }
    s.productos.forEach((p, i) => {
      const nombre = h('input.entrada', { type: 'text', value: p.n || '', placeholder: 'Nombre comercial o ingrediente activo', 'aria-label': 'Producto ' + (i + 1) });
      nombre.addEventListener('input', () => { p.n = nombre.value; recalcular(); });
      const tarjeta = h('div.mezcla__producto', { 'data-tipo': p.tipo });
      const fT = selCampo('Tipo', TIPOS, p.tipo, v => { p.tipo = v; tarjeta.dataset.tipo = v; recalcular(); });
      const fF = selCampo('Formulación', FORMS, p.form, v => { p.form = v; recalcular(); });
      const fD = numCampo('Dosis de etiqueta', p.dosis, null, v => { p.dosis = v; recalcular(); });
      const fU = selCampo('Unidad', UNIDADES, p.u, v => { p.u = v; recalcular(); });
      tarjeta.append(
        h('div.fila.mezcla__producto-enc', h('label.campo', { style: { flex: '1 1 200px' } }, h('span.campo__etiqueta', 'Producto ' + (i + 1)), nombre),
          h('button.boton.boton--icono', { type: 'button', 'aria-label': 'Quitar producto ' + (i + 1), onclick: () => { s.productos.splice(i, 1); pintarProductos(); recalcular(); } }, icono('cerrar'))),
        h('div.formulario.formulario--columnas', ...[fT, fF, fD, fU].map(f => { f.el.classList.add('campo--medio'); return f.el; })));
      zProductos.append(tarjeta);
    });
  }

  // Comparativo
  const zCmpTarjeta = h('section.tarjeta.pila');
  function montarCmp() {
    vaciar(zCmpTarjeta);
    const sel = h('select.selector', { 'aria-label': 'Comparar con' }, MODELOS.map(m => h('option', { value: 'm:' + m.id }, m.n)));
    sel.value = s.cmp || 'm:moch20';
    const fT = numCampo('Tanque', s.cmpTanque, 'L', v => { s.cmpTanque = v; recalcular(); });
    const fV = numCampo('Volumen', s.cmpVol, 'L/ha', v => { s.cmpVol = v; recalcular(); });
    sel.addEventListener('change', () => { s.cmp = sel.value; const m = modelo(sel.value.slice(2)); if (m.tanque) { s.cmpTanque = m.tanque; s.cmpVol = m.vol; fT.inp.value = m.tanque; fV.inp.value = m.vol; } recalcular(); });
    zCmpTarjeta.append(h('h2.titulo-tarjeta', 'Comparativo con otro equipo'), h('label.campo', h('span.campo__etiqueta', 'Comparar con'), sel),
      h('div.formulario.formulario--columnas', ...[fT, fV].map(f => { f.el.classList.add('campo--medio'); return f.el; })), zCmp);
  }

  function recalcular() {
    const c = calcular(s), A = alertasDe(c, s);
    // KPIs
    vaciar(zKpi).append(
      kpi('Cubre por carga', c.ok ? fn(c.haCarga) + ' ha' : '—', c.ok ? fx(c.haCarga * 10000, 0) + ' m²' : ''),
      kpi('Cargas', c.ok ? `${c.completas} ${c.completas === 1 ? 'completa' : 'completas'}` : '—', c.ok ? (c.resto > 0 ? `+ 1 parcial de ${fn(c.resto)} L` : 'Sin carga parcial') : ''),
      kpi('Caldo total', c.ok ? fn(c.total) + ' L' : '—', c.ok ? `para ${fn(c.ha)} ha` : ''),
      kpi('Agua por carga', c.ok ? fn(Math.max(c.agua, 0)) + ' L' : '—', 'Aprox., descontando productos líquidos'));
    vaciar(zAlertas).append(A.map(a => alerta(a[0], a[1], a[2])));
    if (c.validas.length >= 2) {
      zAlertas.append(h('div.panel-datos', h('div.panel-datos__titulo', 'Prueba de jarra · 1 L de agua'),
        h('p.texto-suave', 'Agregue en este orden en un frasco transparente y observe 15 min. Grumos, natas o separación indican incompatibilidad.'),
        h('dl.datos', c.orden.filter(r => r.valido).flatMap(r => [h('dt', r.p.n || 'Producto'), h('dd.numero', conc(r.conc, r.solido).replace('/L', ''))]))));
    }
    // Orden de carga
    vaciar(zOrden).append(h('ol.pasos-sop.mezcla__pasos', { role: 'list' },
      paso('Agua limpia al 50–70 % del tanque', c.ok ? '≈ ' + fn(c.tanque * 0.6) + ' L' : '—', ['Encienda la agitación antes de agregar productos']),
      c.orden.map(r => paso(r.p.n || 'Producto sin nombre', r.valido && c.ok ? cant(r.porCarga, r.solido) : '—', [
        `${etq(TIPOS, r.p.tipo)} · ${r.p.form}`,
        `Dosis ${r.valido ? cant(r.qHa, r.solido) + '/ha' : '—'}`,
        `Concentración ${r.valido && c.ok ? conc(r.conc, r.solido) + ' · ' + pctT(r.pct) : '—'}`,
        `Total del trabajo ${r.valido && c.ok ? cant(r.total, r.solido) : '—'}`,
        NOTA_ORDEN[r.rango]])),
      paso(`Complete con agua hasta ${c.ok ? fn(c.tanque) + ' L' : 'el volumen'}`, '', ['Mantenga la agitación hasta terminar de aplicar la carga'])));
    vaciar(zParcial);
    if (c.ok && c.resto > 0 && c.validas.length) {
      zParcial.append(h('div.pila', h('h3.titulo-tarjeta', `Última carga parcial: ${fn(c.resto)} L (${fn(c.resto / c.vol)} ha)`),
        h('div.tabla-contenedor', h('table.tabla', h('thead', h('tr', h('th', 'Producto'), h('th.num', 'Cantidad'))),
          h('tbody', c.orden.filter(r => r.valido).map(r => h('tr', h('td', r.p.n || 'Producto'), h('td.num', cant(r.parcial, r.solido)))))))));
    }
    // Comparativo
    vaciar(zCmp);
    const nombreCmp = modelo((s.cmp || 'm:otro').slice(2)).n;
    if (c.ok && c.cT > 0 && c.cV > 0) {
      const f = c.cV / c.vol;
      zCmp.append(alerta('info', f >= 1 ? `Su caldo va ${fn(f)}× más concentrado que en ${nombreCmp}` : `Su caldo va ${fn(1 / f)}× más diluido que en ${nombreCmp}`,
        'La cantidad de producto por hectárea es la misma. No traslade «mL por litro» ni «tapitas por bomba» de un equipo a otro.'));
      if (c.validas.length) zCmp.append(h('div.tabla-contenedor', h('table.tabla', h('thead', h('tr', h('th', 'Producto'), h('th.num', 'Su equipo'), h('th.num', 'Comparativo'))),
        h('tbody', c.orden.filter(r => r.valido).map(r => h('tr', h('td', r.p.n || 'Producto'),
          h('td.num', cant(r.porCarga, r.solido), h('br'), h('span.texto-suave', conc(r.conc, r.solido))),
          h('td.num', cant(r.cmpCarga, r.solido), h('br'), h('span.texto-suave', conc(r.cmpConc, r.solido)))))))));
    } else zCmp.append(h('p.texto-suave', 'Capture tanque y volumen del equipo a comparar.'));
    zFicha.value = fichaTexto(c, s, A);
    if (montar.pintarCalib) montar.pintarCalib();
    persistir();
  }

  montar();
  recalcular();
}

function kpi(nombre, valor, contexto) {
  return h('div.kpi', h('div.kpi__nombre', nombre), h('div.kpi__valor.cifra', { style: { fontSize: 'var(--t-xl)' } }, valor), contexto ? h('div.kpi__contexto', contexto) : null);
}
function paso(titulo, cantidad, meta) {
  return h('li.paso-sop.mezcla__paso', h('span.paso-sop__num'),
    h('div.mezcla__paso-cuerpo', h('div.mezcla__paso-titulo', h('strong', titulo), cantidad ? h('span.cifra.mezcla__cantidad', cantidad) : null),
      h('div.mezcla__meta', meta.filter(Boolean).map(m => h('span', m)))));
}

/** Enlace a la calculadora con los datos de una orden de servicio (hectáreas pendientes, último dron y producto). */
export function hrefMezclaOS(os, etapas) {
  const ult = (etapas || []).slice().sort((a, b) => Number(a.numero) - Number(b.numero)).pop() || {};
  const cont = Number(os.ha_contratadas) || 0, apl = Number(os.ha_aplicadas) || 0;
  const ha = cont > apl ? cont - apl : cont;
  const p = new URLSearchParams();
  p.set('os', os.id);
  if (ha) p.set('ha', String(Math.round(ha * 100) / 100));
  if (ult.dron_serie) p.set('dron', ult.dron_serie);
  if (ult.producto) p.set('prod', ult.producto);
  if (ult.dosis !== undefined && ult.dosis !== '') p.set('dosis', String(ult.dosis));
  if (ult.unidad_dosis) p.set('u', ult.unidad_dosis);
  if (os.folio) p.set('ref', os.folio);
  return '#/mezcla?' + p.toString();
}

export const rutas = [{ p: 'mezcla', r: (c, p, q) => pantallaMezcla(c, p, q), ver: () => rol() !== 'Socio' }];
