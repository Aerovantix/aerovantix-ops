// CRM (clientes, oportunidades, parcelas) y Catálogo con su sección "Precios y costos".
import { h, icono, vaciar, toast, dinero, pct, numero, chip, boton, alerta, esqueleto, errorTexto, fecha, json, vacioV, num } from '../ui.js';
import { rutasCrud, renderLista, mostrar, botonNuevo } from '../crud.js';
import { pantalla, pestanas, listado, avisoCache } from '../vistas.js';
import * as datos from '../datos.js';
import { esDir, puede, cat, param, usuario, rol } from '../estado.js';
import { formulario } from '../forms.js';
import { ir } from '../router.js';
import { ESTADOS, opClientes, nombreCliente, opParcelas, nombreParcela, opUsuarios, botonGPS, opProveedores, usuarioNombre, vincularParcelas } from './comunes.js';

export const TIPOS_OPORTUNIDAD = ['Venta de dron', 'Servicio de aplicación', 'Renta', 'Refacciones', 'Monitoreo y mapeo', 'Capacitación y soporte'];
const ETAPAS = ['Prospecto', 'Cotizado', 'Negociación', 'Ganada', 'Perdida'];

// ---------- Clientes ----------
export const cfgClientes = {
  tabla: 'Clientes', ruta: 'clientes', titulo: 'Clientes', singular: 'cliente', singularMayus: 'Cliente', icono: 'clientes', botonEnLista: true,
  campos: () => [
    { c: 'nombre', l: 'Nombre o razón social', t: 'texto', req: true },
    { c: 'rfc', l: 'RFC', t: 'texto', ph: 'Solo si requiere factura', ancho: 'medio' },
    { c: 'estatus', l: 'Estatus', t: 'opciones', op: ['Prospecto', 'Activo', 'Inactivo'], def: 'Prospecto', ancho: 'medio' },
    { c: 'contacto', l: 'Persona de contacto', t: 'texto', ancho: 'medio' },
    { c: 'quien_decide', l: 'Quién decide la compra', t: 'texto', ancho: 'medio' },
    { c: 'telefono', l: 'Teléfono', t: 'tel', ancho: 'medio' },
    { c: 'correo', l: 'Correo', t: 'correo', ancho: 'medio' },
    { c: 'estado', l: 'Estado', t: 'opciones', op: ESTADOS, ancho: 'medio' },
    { c: 'municipio', l: 'Municipio', t: 'texto', ancho: 'medio' },
    { c: 'origen_cliente', l: '¿Cómo nos conoció?', t: 'texto', ancho: 'medio' },
    { c: 'responsable', l: 'Responsable', t: 'opciones', op: () => opUsuarios(['Dirección', 'Agronomía']), def: usuario(), ancho: 'medio' },
    { c: 'notas', l: 'Notas', t: 'area' }
  ],
  columnas: [
    { l: 'Cliente', v: r => h('span', h('strong', r.nombre), h('span.sub', r.contacto || '')) },
    { l: 'Ubicación', v: r => [r.municipio, r.estado].filter(Boolean).join(', ') || '—' },
    { l: 'Teléfono', v: r => r.telefono || '—' },
    { l: 'Responsable', v: r => usuarioNombre(r.responsable) || '—' },
    { l: 'Estatus', v: r => chip(r.estatus) }
  ],
  movil: { titulo: r => r.nombre, chip: r => chip(r.estatus), meta: r => [r.municipio, r.telefono] },
  texto: r => [r.nombre, r.contacto, r.municipio, r.estado, r.rfc, r.telefono].join(' '),
  filtros: [{ t: 'Prospectos', f: r => r.estatus === 'Prospecto' }, { t: 'Activos', f: r => r.estatus === 'Activo' }],
  orden: (a, b) => String(a.nombre).localeCompare(b.nombre, 'es'),
  tituloDe: r => r.nombre, subDe: r => [r.municipio, r.estado].filter(Boolean).join(', '),
  extrasDetalle: async (r, cuerpo) => {
    const parcelas = cat('Parcelas').filter(p => p.cliente_id === r.id);
    cuerpo.append(h('section.pila', h('div.fila.encabezado-seccion', h('h2.titulo-seccion', 'Parcelas'),
      puede('Parcelas', 'escribir') ? boton('Agregar parcela', { tipo: 'secundario', ic: 'mas', chico: true, href: '#/parcelas/nuevo?cliente_id=' + r.id }) : null),
      parcelas.length ? h('div.lista-registros', parcelas.map(p => h('a.registro', { href: '#/parcelas/' + p.id }, h('span.registro__titulo', p.nombre_predio), h('span.registro__estado', p.hectareas ? numero(p.hectareas, 'ha') : ''), h('span.registro__meta', h('span', p.cultivo || ''), h('span', p.municipio || '')))))
        : h('p.texto-suave', 'Sin parcelas registradas.')));
    if (puede('Oportunidades')) {
      const z = h('div');
      cuerpo.append(h('section.pila', h('div.fila.encabezado-seccion', h('h2.titulo-seccion', 'Oportunidades'),
        puede('Oportunidades', 'escribir') ? boton('Nueva oportunidad', { tipo: 'secundario', ic: 'mas', chico: true, href: '#/oportunidades/nuevo?cliente_id=' + r.id }) : null), z));
      await renderLista(z, cfgOportunidades, { filtro: o => o.cliente_id === r.id, sinBoton: true });
    }
  }
};

// ---------- Parcelas ----------
export const cfgParcelas = {
  tabla: 'Parcelas', ruta: 'parcelas', titulo: 'Parcelas', singular: 'parcela', singularMayus: 'Parcela', femenino: true, icono: 'mapa', botonEnLista: true,
  campos: () => [
    { c: 'cliente_id', l: 'Cliente', t: 'opciones', op: opClientes, req: true },
    { c: 'nombre_predio', l: 'Predio o rancho', t: 'texto', req: true },
    { c: 'cultivo', l: 'Cultivo', t: 'texto', ancho: 'medio' },
    { c: 'hectareas', l: 'Superficie', t: 'numero', suf: 'ha', min: 0, ancho: 'medio' },
    { c: 'estado', l: 'Estado', t: 'opciones', op: ESTADOS, ancho: 'medio' },
    { c: 'municipio', l: 'Municipio', t: 'texto', ancho: 'medio' },
    { c: 'latitud', l: 'Latitud', t: 'numero', ancho: 'medio', min: -90, max: 90 },
    { c: 'longitud', l: 'Longitud', t: 'numero', ancho: 'medio', min: -180, max: 180 },
    { c: 'notas', l: 'Notas', t: 'area' }
  ],
  extrasForm: (f, cuerpo, base) => {
    const lat = f.campo('latitud'), lon = f.campo('longitud');
    cuerpo.querySelector('form').append(botonGPS(g => { lat.fijar(g.latitud); lon.fijar(g.longitud); }, base.latitud ? base : null));
  },
  columnas: [
    { l: 'Predio', v: r => h('strong', r.nombre_predio) }, { l: 'Cliente', v: r => nombreCliente(r.cliente_id) },
    { l: 'Cultivo', v: r => r.cultivo || '—' }, { l: 'Hectáreas', v: r => numero(r.hectareas), num: true }, { l: 'Municipio', v: r => r.municipio || '—' }
  ],
  movil: { titulo: r => r.nombre_predio, chip: r => (r.hectareas ? h('span.texto-sm.texto-fuerte', numero(r.hectareas, 'ha')) : ''), meta: r => [nombreCliente(r.cliente_id), r.cultivo, r.municipio] },
  texto: r => [r.nombre_predio, nombreCliente(r.cliente_id), r.cultivo, r.municipio].join(' '),
  tituloDe: r => r.nombre_predio, subDe: r => nombreCliente(r.cliente_id),
  extrasDetalle: async (r, cuerpo) => {
    if (r.latitud && r.longitud) cuerpo.append(h('p', h('a.boton.boton--secundario.boton--chico', { href: `https://www.google.com/maps?q=${r.latitud},${r.longitud}`, target: '_blank', rel: 'noopener' }, icono('mapa', 20), 'Abrir en el mapa')));
  }
};

// ---------- Oportunidades ----------
export const cfgOportunidades = {
  tabla: 'Oportunidades', ruta: 'oportunidades', titulo: 'Oportunidades', singular: 'oportunidad', singularMayus: 'Oportunidad', femenino: true, icono: 'panel', botonEnLista: true,
  campos: r => [
    { c: 'cliente_id', l: 'Cliente', t: 'opciones', op: opClientes, req: true },
    { c: 'tipo', l: 'Tipo', t: 'opciones', op: TIPOS_OPORTUNIDAD, req: true, ancho: 'medio' },
    { c: 'etapa', l: 'Etapa', t: 'opciones', op: ETAPAS, def: 'Prospecto', ancho: 'medio' },
    { c: 'parcela_id', l: 'Parcela', t: 'opciones', op: () => opParcelas(r && r.cliente_id), ayuda: 'Para servicios de aplicación.' },
    { c: 'monto', l: 'Monto estimado sin IVA', t: 'dinero', ancho: 'medio' },
    { c: 'fecha_estimada_cierre', l: 'Cierre estimado', t: 'fecha', ancho: 'medio' },
    { c: 'responsable', l: 'Responsable', t: 'opciones', op: () => opUsuarios(['Dirección', 'Agronomía']), def: usuario(), ancho: 'medio' },
    { c: 'fecha_cierre', l: 'Fecha de cierre', t: 'fecha', ancho: 'medio' },
    { c: 'motivo_perdida', l: 'Motivo de pérdida', t: 'texto', ayuda: 'Solo si la etapa es Perdida.', validar: (v, o) => (o.etapa === 'Perdida' && !v ? 'Escriba el motivo de pérdida.' : '') }
  ],
  extrasForm: f => vincularParcelas(f),
  calculados: [
    { c: 'hectareas', l: 'Hectáreas', t: 'numero', suf: 'ha' }, { c: 'costo_directo', l: 'Costo directo', t: 'dinero' }, { c: 'margen_bruto', l: 'Margen bruto', t: 'dinero' },
    { c: 'cobrado', l: 'Cobrado con IVA', t: 'dinero' }, { c: 'saldo_por_cobrar', l: 'Saldo por cobrar con IVA', t: 'dinero' }
  ],
  columnas: [
    { l: 'Cliente', v: r => h('span', h('strong', nombreCliente(r.cliente_id)), h('span.sub', r.tipo || '')) },
    { l: 'Monto sin IVA', v: r => dinero(r.monto), num: true }, { l: 'Cierre estimado', v: r => fecha(r.fecha_estimada_cierre) },
    { l: 'Responsable', v: r => usuarioNombre(r.responsable) || '—' }, { l: 'Etapa', v: r => chip(r.etapa) }
  ],
  movil: { titulo: r => nombreCliente(r.cliente_id), chip: r => chip(r.etapa), meta: r => [r.tipo, dinero(r.monto)] },
  texto: r => [nombreCliente(r.cliente_id), r.tipo, r.etapa].join(' '),
  filtros: [{ t: 'Abiertas', f: r => ['Prospecto', 'Cotizado', 'Negociación'].includes(r.etapa) }, { t: 'Ganadas', f: r => r.etapa === 'Ganada' }, { t: 'Perdidas', f: r => r.etapa === 'Perdida' }],
  filtroInicial: 0,
  orden: (a, b) => String(b.fecha_alta || '').localeCompare(String(a.fecha_alta || '')),
  estatusDe: r => r.etapa, tituloDe: r => nombreCliente(r.cliente_id), subDe: r => r.tipo,
  extrasDetalle: async (r, cuerpo) => {
    if (puede('Cotizaciones', 'escribir') && ['Prospecto', 'Cotizado', 'Negociación'].includes(r.etapa)) {
      cuerpo.append(h('div.fila', boton('Nueva cotización', { ic: 'cotizacion', href: `#/cotizaciones/nueva?cliente_id=${r.cliente_id}&oportunidad_id=${r.id}${r.parcela_id ? '&parcela_id=' + r.parcela_id : ''}` })));
    }
  }
};

// ---------- Pantalla CRM con pestañas ----------
async function pantallaCRM(c, p, q) {
  const tab = q.vista || 'clientes';
  const cfgs = { clientes: cfgClientes, oportunidades: cfgOportunidades, parcelas: cfgParcelas };
  const cuerpo = pantalla(c, { titulo: 'Clientes y oportunidades', acciones: [botonNuevo(cfgs[tab])] });
  const zona = h('div');
  cuerpo.append(pestanas([{ id: 'clientes', t: 'Clientes' }, puede('Oportunidades') && { id: 'oportunidades', t: 'Oportunidades' }, { id: 'parcelas', t: 'Parcelas' }], tab,
    id => { history.replaceState(null, '', '#/crm?vista=' + id); pantallaCRM(c, p, { vista: id }); }), zona);
  await renderLista(zona, cfgs[tab], { sinBoton: true });
}

// ---------- Catálogo ----------
const TIPOS_CATALOGO = () => [...new Set(cat('Catalogo').map(x => x.tipo).filter(Boolean))].sort();

async function pantallaCatalogo(c, p, q) {
  const cuerpo = pantalla(c, { titulo: 'Catálogo', sub: esDir() ? 'Precios sin IVA. La sección Precios y costos solo la edita Dirección.' : 'Precios de lista sin IVA y con IVA.',
    acciones: [esDir() ? boton('Nuevo SKU', { ic: 'mas', href: '#/catalogo/nuevo' }) : null] });
  const zona = h('div'); cuerpo.append(zona);
  zona.append(esqueleto(3));
  let regs, desdeCache;
  try { ({ registros: regs, desdeCache } = await datos.listar('Catalogo')); } catch (e) { vaciar(zona).append(alerta('error', 'No se pudo cargar el catálogo', errorTexto(e))); return; }
  vaciar(zona);
  const av = avisoCache(desdeCache); if (av) zona.append(av);
  const sinTasa = regs.filter(r => vacioV(r.tasa_iva) && !json(r.componentes).length).length;
  if (esDir() && sinTasa) zona.append(alerta('advertencia', `${sinTasa} SKU sin tasa de IVA`, 'No se pueden cotizar hasta que Dirección capture su tasa (0 % o 16 %).'));
  const tipos = TIPOS_CATALOGO();
  zona.append(listado({
    registros: regs, buscarPh: 'Buscar SKU, descripción o modelo',
    columnas: [
      { l: 'SKU', v: r => r.sku, clase: 'clave' },
      { l: 'Descripción', v: r => h('span', h('strong', r.descripcion), h('span.sub', [r.tipo, r.marca_modelo].filter(Boolean).join(' · '))) },
      esDir() ? { l: 'Costo', v: r => dinero(r.costo_unitario), num: true } : null,
      { l: 'Lista sin IVA', v: r => dinero(r.precio_lista), num: true },
      { l: 'IVA', v: r => (json(r.componentes).length ? 'Mixto' : (vacioV(r.tasa_iva) ? 'Sin tasa' : pct(r.tasa_iva))), num: true },
      { l: 'Con IVA', v: r => dinero(r.precio_con_iva), num: true },
      esDir() ? { l: 'Margen', v: r => pct(r.margen_pct), num: true } : null,
      { l: 'Estatus', v: r => chip(r.estatus || 'Activo') }
    ].filter(Boolean),
    movil: { titulo: r => r.descripcion, chip: r => h('span.texto-fuerte.numero', dinero(r.precio_con_iva)), meta: r => [r.sku, r.tipo, json(r.componentes).length ? 'Paquete' : null] },
    texto: r => [r.sku, r.descripcion, r.detalle, r.marca_modelo, r.tipo].join(' '),
    filtros: tipos.slice(0, 6).map(t => ({ t, f: r => r.tipo === t })),
    orden: (a, b) => String(a.sku).localeCompare(b.sku),
    href: r => 'catalogo/' + encodeURIComponent(r.id),
    vacio: { ic: 'catalogo', t: 'El catálogo está vacío', d: 'Dirección da de alta los SKU desde aquí o desde el módulo Arranque.' }
  }));
}

function camposCatalogoGenerales() {
  return [
    { c: 'sku', l: 'SKU', t: 'texto', req: true, ancho: 'medio' },
    { c: 'tipo', l: 'Tipo', t: 'texto', req: true, ancho: 'medio', lista: 'tipos-catalogo' },
    { c: 'descripcion', l: 'Descripción', t: 'texto', req: true },
    { c: 'detalle', l: 'Detalle', t: 'area', filas: 2 },
    { c: 'marca_modelo', l: 'Marca y modelo', t: 'texto', ancho: 'medio' },
    { c: 'proveedor', l: 'Proveedor', t: 'opciones', op: opProveedores, ancho: 'medio' },
    { c: 'unidad', l: 'Unidad', t: 'texto', ancho: 'medio', ph: 'pieza, servicio, ha…' },
    { c: 'estatus', l: 'Estatus', t: 'opciones', op: ['Activo', 'Inactivo'], def: 'Activo', ancho: 'medio' },
    { c: 'umbral_mant_vuelos', l: 'Mantenimiento cada', t: 'numero', suf: 'vuelos', ancho: 'medio', ayuda: 'Solo drones. Si queda vacío: ' + param('umbral_mant_vuelos', 100) + ' vuelos.' },
    { c: 'umbral_mant_horas', l: 'o cada', t: 'numero', suf: 'h', ancho: 'medio', ayuda: 'Si queda vacío: ' + param('umbral_mant_horas', 20) + ' h.' }
  ];
}
function camposPrecios() {
  return [
    { c: 'costo_unitario', l: 'Costo unitario sin IVA', t: 'dinero', ancho: 'medio', min: 0 },
    { c: 'tasa_iva', l: 'Tasa de IVA', t: 'opciones', op: [{ v: '0', l: '0 %' }, { v: '0.16', l: '16 %' }], ancho: 'medio', ayuda: 'La captura Dirección. Los paquetes no llevan tasa: se calcula por componente.' },
    { c: 'margen_objetivo', l: 'Margen objetivo', t: 'pct', ancho: 'medio', ayuda: 'Vacío: margen por defecto de Parámetros (' + pct(param('margen_defecto', '')) + ').' },
    { c: 'precio_manual', l: 'Precio manual sin IVA', t: 'dinero', ancho: 'medio', ayuda: 'Si lo captura, sustituye el cálculo por margen.' },
    { c: 'notas_internas', l: 'Notas internas', t: 'area', filas: 2 }
  ];
}

async function detalleCatalogo(c, { id }) {
  const cuerpo = pantalla(c, { titulo: 'Catálogo', volver: 'catalogo' }); cuerpo.append(esqueleto(2));
  let r;
  try { r = await datos.obtener('Catalogo', id); } catch (e) { vaciar(cuerpo).append(alerta('error', 'No se pudo abrir el SKU', errorTexto(e))); return; }
  if (!r) { vaciar(cuerpo).append(alerta('advertencia', 'SKU no disponible sin conexión')); return; }
  const comps = json(r.componentes);
  const c2 = pantalla(c, { titulo: tituloCorto(r.descripcion), sub: r.sku + (r.tipo ? ' · ' + r.tipo : ''), volver: 'catalogo', chip: chip(r.estatus || 'Activo'),
    acciones: esDir() ? [boton('Editar datos', { tipo: 'secundario', ic: 'editar', href: '#/catalogo/' + encodeURIComponent(id) + '/editar' }), boton('Editar precios y costos', { ic: 'caja', href: '#/catalogo/' + encodeURIComponent(id) + '/precios' })] : [] });
  const av = avisoCache(r._desdeCache); if (av) c2.append(av);
  const grid = h('div.rejilla--2');
  grid.append(h('div.panel-datos', h('div.panel-datos__titulo', 'Datos del SKU'), h('dl.datos', camposCatalogoGenerales().flatMap(d => [h('dt', d.l), h('dd', mostrar(d, r[d.c]))]))));
  const precios = [['Precio de lista sin IVA', dinero(r.precio_lista)], ['Tasa de IVA', comps.length ? 'Por componente' : (vacioV(r.tasa_iva) ? 'Sin capturar' : pct(r.tasa_iva))], ['Precio con IVA', dinero(r.precio_con_iva)]];
  if (esDir()) precios.unshift(['Costo unitario', dinero(r.costo_unitario)], ['Margen objetivo', pct(r.margen_objetivo)], ['Precio manual', dinero(r.precio_manual)]);
  if (esDir()) precios.push(['Precio piso', dinero(r.precio_piso)], ['Margen', `${dinero(r.margen_monto)} · ${pct(r.margen_pct)}`], ['Última actualización', `${fecha(r.precio_actualizado_en)} · ${usuarioNombre(r.precio_actualizado_por) || '—'}`], ['Notas internas', r.notas_internas || '—']);
  grid.append(h('div.panel-datos', h('div.panel-datos__titulo', esDir() ? 'Precios y costos' : 'Precios'), h('dl.datos', precios.flatMap(([k, v]) => [h('dt', k), h('dd', v)]))));
  c2.append(grid);
  if (comps.length) {
    c2.append(h('section.pila', h('h2.titulo-seccion', 'Componentes del paquete'),
      h('p.texto-suave', 'Al cotizar, el paquete se desglosa en estos componentes, cada uno con su tasa de IVA, y el precio del paquete se reparte en proporción a su precio de lista.'),
      h('div.tabla-contenedor', h('table.tabla', h('thead', h('tr', h('th', 'SKU'), h('th', 'Descripción'), h('th.num', 'Cantidad'), h('th.num', 'IVA'))),
        h('tbody', comps.map(x => { const k = cat('Catalogo').find(z => z.sku === x.sku) || {}; return h('tr', h('td.clave', x.sku), h('td', k.descripcion || '—'), h('td.num', numero(x.cant || 1)), h('td.num', vacioV(k.tasa_iva) ? '—' : pct(k.tasa_iva))); }))))));
  }
  if (esDir()) {
    const z = h('div');
    c2.append(h('section.pila', h('h2.titulo-seccion', 'Historial de precios y costos'), z));
    try {
      const { registros } = await datos.listar('CatalogoHistorial');
      const hist = registros.filter(x => x.sku === r.sku).sort((a, b) => String(b.fecha).localeCompare(a.fecha)).slice(0, 20);
      z.append(hist.length ? h('div.tabla-contenedor', h('table.tabla', h('thead', h('tr', h('th', 'Fecha'), h('th', 'Campo'), h('th.num', 'Antes'), h('th.num', 'Después'), h('th', 'Usuario'))),
        h('tbody', hist.map(x => h('tr', h('td', fecha(x.fecha)), h('td', x.campo), h('td.num', x.valor_anterior || '—'), h('td.num', x.valor_nuevo || '—'), h('td', usuarioNombre(x.usuario))))))) : h('p.texto-suave', 'Sin cambios registrados.'));
    } catch (e) { z.append(h('p.texto-suave', 'Historial disponible con conexión.')); }
  }
}

async function formCatalogo(c, { id }, q, modo) {
  if (!esDir()) { pantalla(c, { titulo: 'Catálogo', volver: 'catalogo' }).append(alerta('advertencia', 'Solo Dirección edita el catálogo')); return; }
  let r = {};
  if (id) { try { r = (await datos.obtener('Catalogo', id)) || {}; } catch (e) { r = {}; } }
  const precios = modo === 'precios';
  const cuerpo = pantalla(c, { titulo: precios ? 'Precios y costos' : (id ? 'Editar SKU' : 'Nuevo SKU'), sub: r.sku ? r.sku + ' · ' + (r.descripcion || '') : null, volver: id ? 'catalogo/' + encodeURIComponent(id) : 'catalogo' });
  const defs = precios ? camposPrecios() : (id ? camposCatalogoGenerales() : camposCatalogoGenerales().concat([{ c: 'sep', l: 'Precios y costos', t: 'seccion' }], camposPrecios()));
  const base = Object.assign({}, r, { tasa_iva: vacioV(r.tasa_iva) ? '' : String(r.tasa_iva) });
  const f = formulario(defs, base);
  const dl = h('datalist', { id: 'tipos-catalogo' }, TIPOS_CATALOGO().map(t => h('option', { value: t })));
  const vistaPrevia = h('div.panel-datos', { 'aria-live': 'polite' });
  const recalcular = () => {
    const v = f.leer();
    const costo = num(v.costo_unitario ?? r.costo_unitario), margen = vacioV(v.margen_objetivo ?? r.margen_objetivo) ? num(param('margen_defecto', 0)) : num(v.margen_objetivo ?? r.margen_objetivo);
    const manual = v.precio_manual ?? r.precio_manual;
    const lista = !vacioV(manual) ? num(manual) : (margen < 1 ? costo / (1 - margen) : 0);
    const tasa = vacioV(v.tasa_iva ?? r.tasa_iva) ? null : num(v.tasa_iva ?? r.tasa_iva);
    const desc = num(param('descuento_maximo', 0));
    vaciar(vistaPrevia).append(h('div.panel-datos__titulo', 'Así quedará (cálculo del sistema)'), h('dl.datos',
      h('dt', 'Lista sin IVA'), h('dd', dinero(Math.round(lista * 100) / 100)),
      h('dt', 'Con IVA'), h('dd', tasa === null ? (json(r.componentes).length ? 'Por componente' : 'Falta la tasa') : dinero(Math.round(lista * (1 + tasa) * 100) / 100)),
      h('dt', 'Precio piso'), h('dd', dinero(Math.round(lista * (1 - desc) * 100) / 100)),
      h('dt', 'Margen'), h('dd', lista ? `${dinero(lista - costo)} · ${pct((lista - costo) / lista)}` : '—')));
  };
  f.el.addEventListener('input', recalcular); f.el.addEventListener('change', recalcular);
  const guardar = boton(precios ? 'Guardar precios' : 'Guardar SKU', { ic: 'check' });
  cuerpo.append(dl, h('form.tarjeta.pila', { novalidate: true, onsubmit: e => e.preventDefault() }, f.el), precios || !id ? vistaPrevia : null,
    h('div.barra-acciones', boton('Cancelar', { tipo: 'fantasma', href: '#/' + (id ? 'catalogo/' + encodeURIComponent(id) : 'catalogo') }), guardar));
  if (precios || !id) recalcular();
  guardar.addEventListener('click', async () => {
    if (!f.validar()) return toast('Revise los datos marcados.', 'error');
    const v = f.leer();
    if (v.tasa_iva !== undefined && v.tasa_iva !== '') v.tasa_iva = Number(v.tasa_iva);
    const reg = Object.assign({ id: id || undefined }, v);
    if (!id && cat('Catalogo').some(x => x.sku === reg.sku)) return toast('Ya existe un SKU con esa clave.', 'error');
    guardar.disabled = true;
    try {
      const g = await datos.guardar('Catalogo', reg, { version: r.actualizado_en, resumen: (precios ? 'Precios de ' : 'SKU ') + (reg.sku || r.sku) });
      toast((precios ? 'Precios guardados' : 'SKU guardado') + (navigator.onLine ? '' : ' en este teléfono · se subirá al haber señal'));
      ir('catalogo/' + encodeURIComponent(g.id), { reemplazar: true });
    } catch (e) { toast(errorTexto(e), 'error'); guardar.disabled = false; }
  });
}

export const rutas = [
  { p: 'crm', r: pantallaCRM },
  ...rutasCrud(cfgClientes), ...rutasCrud(cfgParcelas), ...rutasCrud(cfgOportunidades),
  { p: 'catalogo', r: pantallaCatalogo },
  { p: 'catalogo/nuevo', r: (c, p, q) => formCatalogo(c, {}, q, 'nuevo') },
  { p: 'catalogo/:id', r: (c, p) => detalleCatalogo(c, p) },
  { p: 'catalogo/:id/editar', r: (c, p, q) => formCatalogo(c, p, q, 'editar') },
  { p: 'catalogo/:id/precios', r: (c, p, q) => formCatalogo(c, p, q, 'precios') }
];

// Título breve para el encabezado del SKU; la descripción completa queda en "Datos del SKU".
function tituloCorto(t) {
  t = String(t || '').trim();
  if (t.length <= 80) return t;
  const dp = t.indexOf(':');
  if (dp >= 10 && dp <= 80) return t.slice(0, dp);
  const pt = t.indexOf('. ');
  if (pt >= 10 && pt <= 80) return t.slice(0, pt);
  return t.slice(0, t.lastIndexOf(' ', 78)) + '…';
}
