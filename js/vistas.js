// Piezas de pantalla reutilizables: encabezado, pestañas, listados con búsqueda y filtros, avisos de caché.
import { h, icono, vaciar, vacio, alerta, chipPendiente } from './ui.js';
import { ir, atras } from './router.js';

export function pantalla(cont, { titulo, sub, volver, acciones = [], chip, meta } = {}) {
  vaciar(cont);
  document.title = (titulo ? titulo + ' · ' : '') + 'Aerovantix Ops';
  const enc = h('div.encabezado-pantalla',
    h('div.encabezado-pantalla__texto',
      volver ? h('button.boton.boton--fantasma.boton--chico.volver', { type: 'button', onclick: () => (typeof volver === 'function' ? volver() : atras(volver)) }, icono('izquierda', 20), 'Volver') : null,
      h('div.fila', { style: { gap: '12px', alignItems: 'center' } }, h('h1.titulo-pantalla', titulo), chip || null),
      sub ? h('p.encabezado-pantalla__sub', sub) : null,
      meta || null),
    acciones.filter(Boolean).length ? h('div.fila.encabezado-pantalla__acciones', acciones.filter(Boolean)) : null);
  const cuerpo = h('div.pila--6');
  cont.append(enc, cuerpo);
  return cuerpo;
}

export function pestanas(items, activa, alCambiar) {
  const tl = h('div.pestanas', { role: 'tablist' });
  items.filter(Boolean).forEach(it => {
    const b = h('button.pestana', { role: 'tab', type: 'button', 'aria-selected': String(it.id === activa) },
      it.t, it.badge ? h('span.badge.badge--neutro', String(it.badge)) : null);
    b.addEventListener('click', () => {
      tl.querySelectorAll('[role=tab]').forEach(x => x.setAttribute('aria-selected', String(x === b)));
      alCambiar(it.id);
    });
    tl.append(b);
  });
  return tl;
}

export function avisoCache(desdeCache) {
  return desdeCache ? alerta('info', 'Mostrando datos guardados en este teléfono', 'No hay conexión con el servidor. Lo que capture se guarda aquí y se subirá al recuperar la señal.') : null;
}

const POR_PAGINA = 40;

/**
 * Listado responsivo: tabla en escritorio y filas tocables en móvil, con búsqueda y filtros en el cliente.
 * cfg: { registros, columnas:[{l, v(r), num}], movil:{ titulo(r), chip(r), meta(r)[] }, texto(r), filtros:[{t, f(r)}],
 *        href(r), vacio:{ic, t, d, accion}, orden(a,b), buscarPh }
 */
export function listado(cfg) {
  const raiz = h('div.listado');
  const estado = { q: '', filtro: cfg.filtroInicial ?? null, pagina: 1 };
  const total = cfg.registros.length;
  if (!total) { raiz.append(vacio(cfg.vacio?.ic || 'info', cfg.vacio?.t || 'Sin registros', cfg.vacio?.d || '', cfg.vacio?.accion)); return raiz; }

  const buscar = h('input.entrada', { type: 'search', placeholder: cfg.buscarPh || 'Buscar', 'aria-label': cfg.buscarPh || 'Buscar' });
  const herramientas = h('div.herramientas-tabla',
    h('label.campo-buscar', icono('buscar', 20), buscar),
    (cfg.filtros || []).map((f, i) => {
      const b = h('button.filtro', { type: 'button', 'aria-pressed': String(estado.filtro === i) }, f.t);
      b.addEventListener('click', () => {
        estado.filtro = estado.filtro === i ? null : i; estado.pagina = 1;
        herramientas.querySelectorAll('.filtro').forEach((x, j) => x.setAttribute('aria-pressed', String(estado.filtro === j)));
        pintar();
      });
      return b;
    }));
  const zona = h('div');
  raiz.append(herramientas, zona);
  buscar.addEventListener('input', () => { estado.q = buscar.value.trim().toLowerCase(); estado.pagina = 1; pintar(); });

  const textoDe = r => (cfg.texto ? cfg.texto(r) : Object.values(r).filter(v => typeof v !== 'object').join(' ')).toLowerCase();
  const normal = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

  function pintar() {
    vaciar(zona);
    let regs = cfg.registros.slice();
    if (estado.filtro !== null && cfg.filtros[estado.filtro]) regs = regs.filter(cfg.filtros[estado.filtro].f);
    if (estado.q) { const q = normal(estado.q); regs = regs.filter(r => normal(textoDe(r)).includes(q)); }
    if (cfg.orden) regs.sort(cfg.orden);
    const n = regs.length;
    const pag = regs.slice(0, estado.pagina * POR_PAGINA);
    if (!n) { zona.append(h('p.texto-suave', { style: { padding: '16px 4px' } }, 'Ningún registro coincide con la búsqueda.')); return; }

    // Escritorio: tabla
    const tabla = h('table.tabla',
      h('thead', h('tr', cfg.columnas.map(c => h('th', { scope: 'col', class: c.num ? 'num' : null }, c.l)))),
      h('tbody', pag.map(r => {
        const tr = h('tr', { tabindex: cfg.href ? '0' : null, class: cfg.href ? 'fila-enlace' : null },
          cfg.columnas.map((c, i) => h('td', { class: (c.num ? 'num ' : '') + (c.clase || '') },
            c.v(r), i === 0 && r._pendiente ? h('span', { style: { marginLeft: '8px' } }, chipPendiente()) : null)));
        if (cfg.href) {
          tr.addEventListener('click', () => ir(cfg.href(r)));
          tr.addEventListener('keydown', e => { if (e.key === 'Enter') ir(cfg.href(r)); });
        }
        return tr;
      })));
    zona.append(h('div.tabla-contenedor.solo-escritorio', tabla,
      h('div.paginacion', h('span', `${pag.length} de ${n} registros`), pag.length < n ? h('button.boton.boton--secundario.boton--chico', { type: 'button', onclick: () => { estado.pagina++; pintar(); } }, 'Ver más') : null)));

    // Móvil: filas tocables
    const lista = h('div.lista-registros.solo-movil', pag.map(r => {
      const m = cfg.movil;
      const attrs = cfg.href ? { href: '#/' + cfg.href(r) } : {};
      return h(cfg.href ? 'a.registro' : 'div.registro', attrs,
        (t => h(typeof t === 'string' ? 'span.registro__titulo.recorte-3' : 'span.registro__titulo', t))(m.titulo(r)),
        h('span.registro__estado', r._pendiente ? chipPendiente() : (m.chip ? m.chip(r) : '')),
        h('span.registro__meta', (m.meta ? m.meta(r) : []).filter(x => x !== null && x !== undefined && x !== '').map(x => h('span', x))));
    }));
    zona.append(lista);
    if (pag.length < n) zona.append(h('div.solo-movil', { style: { marginTop: '12px' } }, h('button.boton.boton--secundario.boton--bloque', { type: 'button', onclick: () => { estado.pagina++; pintar(); } }, `Ver más (${n - pag.length})`)));
  }
  pintar();
  return raiz;
}

export function seccion(titulo, ...hijos) {
  return h('section.pila', h('h2.titulo-seccion', titulo), ...hijos);
}

export function tarjeta(...hijos) { return h('div.tarjeta.pila', ...hijos); }
