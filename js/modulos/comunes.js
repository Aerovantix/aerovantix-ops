// Opciones compartidas por los módulos (catálogos del bootstrap) y piezas de captura de campo.
import { h, icono, toast, vaciar, json, errorTexto } from '../ui.js';
import { cat, nombreUsuario } from '../estado.js';
import { obtenerGPS, comprimirFoto, PadFirma } from '../media.js';
import * as db from '../db.js';

export const ESTADOS = ['Jalisco', 'Colima', 'Michoacán', 'Otro'];

export const opClientes = () => cat('Clientes').slice().sort((a, b) => String(a.nombre).localeCompare(b.nombre, 'es')).map(c => ({ v: c.id, l: c.nombre }));
export const nombreCliente = id => (cat('Clientes').find(c => c.id === id) || {}).nombre || (id ? 'Cliente' : '—');
export const opParcelas = clienteId => cat('Parcelas').filter(p => !clienteId || p.cliente_id === clienteId).map(p => ({ v: p.id, l: p.nombre_predio + (p.hectareas ? ` · ${p.hectareas} ha` : '') }));
export const nombreParcela = id => (cat('Parcelas').find(p => p.id === id) || {}).nombre_predio || '—';
export const opUsuarios = roles => cat('Usuarios').filter(u => !roles || roles.includes(u.rol)).map(u => ({ v: u.usuario, l: u.nombre }));
export const opSkus = filtro => cat('Catalogo').filter(c => c.estatus !== 'Inactivo' && (!filtro || filtro(c))).sort((a, b) => String(a.sku).localeCompare(b.sku)).map(c => ({ v: c.sku, l: `${c.sku} · ${c.descripcion}` }));
export const skuInfo = sku => cat('Catalogo').find(c => c.sku === sku) || null;
export const opEquipos = filtro => cat('Equipos').filter(e => !filtro || filtro(e)).map(e => ({ v: e.serie, l: `${e.serie} · ${e.tipo || ''} ${e.sku ? '(' + e.sku + ')' : ''}`.trim() }));
export const opProveedores = () => cat('Proveedores').filter(p => p.estatus !== 'Inactivo').map(p => ({ v: p.nombre, l: p.nombre }));
export const usuarioNombre = nombreUsuario;
export const ubicaciones = () => [...new Set(cat('Existencias').map(e => e.ubicacion).concat(cat('Equipos').map(e => e.ubicacion)).filter(Boolean))];

/** Botón que llena latitud y longitud con el GPS del teléfono. */
export function botonGPS(alObtener, actual) {
  const txt = h('span.captura-campo__texto', h('strong', 'Registrar ubicación'), h('span', 'Toma la posición del teléfono'));
  const b = h('button.captura-campo', { type: 'button' }, h('span.captura-campo__icono', icono('ubicacion')), txt);
  const pintar = g => {
    vaciar(txt); b.classList.add('captura-campo--listo');
    txt.append(h('strong', 'Ubicación registrada'), h('span.numero', `${g.latitud}, ${g.longitud}${g.precision ? ' · ±' + g.precision + ' m' : ''}`));
  };
  if (actual && actual.latitud) pintar(actual);
  b.addEventListener('click', async () => {
    vaciar(txt); txt.append(h('strong', 'Obteniendo ubicación…'), h('span', 'Espere unos segundos'));
    try { const g = await obtenerGPS(); pintar(g); alObtener(g); }
    catch (e) { vaciar(txt); b.classList.remove('captura-campo--listo'); txt.append(h('strong', 'Registrar ubicación'), h('span', { style: { color: 'var(--avx-error)' } }, e.message)); }
  });
  return b;
}

/** Selector de fotos: comprime al elegir y muestra miniaturas. Devuelve { el, fotos() }. */
export function selectorFotos(titulo, existentes = []) {
  const fotos = [];
  const miniaturas = h('div.miniaturas');
  const inp = h('input', { type: 'file', accept: 'image/*', capture: 'environment', multiple: true, hidden: true });
  const txt = h('span.captura-campo__texto', h('strong', titulo), h('span', 'Se comprimen a 1600 px antes de subir'));
  const b = h('button.captura-campo', { type: 'button', onclick: () => inp.click() }, h('span.captura-campo__icono', icono('camara')), txt);
  const pintarConteo = () => { vaciar(txt); txt.append(h('strong', titulo), h('span', `${fotos.length + existentes.length} foto(s)${fotos.length ? ' · ' + fotos.length + ' por subir' : ''}`)); if (fotos.length + existentes.length) b.classList.add('captura-campo--listo'); };
  existentes.forEach(u => miniaturas.append(h('a.miniatura.miniatura--subida', { href: u, target: '_blank', rel: 'noopener', title: 'Ver en Drive' }, icono('exito'))));
  inp.addEventListener('change', async () => {
    for (const f of [...inp.files]) {
      try {
        const blob = await comprimirFoto(f);
        fotos.push(blob);
        const url = URL.createObjectURL(blob);
        const m = h('span.miniatura', h('img', { src: url, alt: 'Foto ' + fotos.length }),
          h('button.miniatura__quitar', { type: 'button', 'aria-label': 'Quitar foto', onclick: () => { const i = fotos.indexOf(blob); if (i >= 0) fotos.splice(i, 1); m.remove(); URL.revokeObjectURL(url); pintarConteo(); } }, icono('cerrar', 16)));
        miniaturas.append(m);
      } catch (e) { toast(errorTexto(e), 'error'); }
    }
    inp.value = ''; pintarConteo();
  });
  if (existentes.length) pintarConteo();
  const el = h('div.pila', { style: { gap: '8px' } }, b, inp, miniaturas);
  return { el, fotos: () => fotos.slice(), agregar: blob => { fotos.push(blob); miniaturas.append(h('span.miniatura', h('img', { src: URL.createObjectURL(blob), alt: 'Foto' }))); pintarConteo(); } };
}

/** Firma con el dedo. Devuelve { el, pad }. */
export function capturaFirma(titulo, existente) {
  const canvas = h('canvas.lienzo-firma', { 'aria-label': 'Área para firmar con el dedo' });
  const limpiar = h('button.boton.boton--fantasma.boton--chico', { type: 'button' }, 'Borrar firma');
  const el = h('div.campo', h('span.campo__etiqueta', titulo),
    existente ? h('p.texto-sm', h('a', { href: existente, target: '_blank', rel: 'noopener' }, 'Firma registrada en Drive'), '. Puede capturar una nueva si es necesario.') : null,
    canvas, h('div.fila', { style: { justifyContent: 'space-between' } }, h('span.campo__ayuda', 'Firme con el dedo sobre la línea.'), limpiar));
  let pad = null;
  requestAnimationFrame(() => { pad = new PadFirma(canvas); });
  limpiar.addEventListener('click', () => pad && pad.limpiar());
  return { el, pad: () => pad };
}

/** Miniaturas de archivos que siguen en este teléfono (pendientes de subir). */
export async function miniaturasPendientes(r) {
  const cont = h('div.miniaturas');
  for (const a of (r._archivosPendientes || [])) {
    const blob = await db.archivoLeer(a.archivo_id);
    if (blob && blob.type.startsWith('image/')) cont.append(h('span.miniatura', { title: 'Por subir' }, h('img', { src: URL.createObjectURL(blob), alt: a.campo })));
  }
  return cont.childNodes.length ? cont : null;
}

export function enlacesArchivos(lista) {
  const l = json(lista);
  if (!l.length) return '—';
  return h('span', l.map((u, i) => [i ? ' · ' : '', h('a', { href: u, target: '_blank', rel: 'noopener' }, 'Foto ' + (i + 1))]));
}

export const enlace = (u, texto) => (u ? h('a', { href: u, target: '_blank', rel: 'noopener' }, texto || 'Abrir') : '—');

/** Al cambiar el cliente, actualiza las opciones de parcela (y opcionalmente llena datos de ubicación). */
export function vincularParcelas(f, campoCliente = 'cliente_id', campoParcela = 'parcela_id') {
  const cl = f.campo(campoCliente), pa = f.campo(campoParcela);
  if (!cl || !pa || !cl.control || !pa.control) return;
  const llenar = () => {
    const actual = pa.control.value;
    const ops = opParcelas(cl.control.value);
    while (pa.control.options.length > 1) pa.control.remove(1);
    ops.forEach(o => pa.control.append(new Option(o.l, o.v)));
    pa.control.value = ops.some(o => o.v === actual) ? actual : '';
  };
  cl.control.addEventListener('change', llenar);
}
