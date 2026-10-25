// Flota y mantenimiento (equipos, mantenimientos, vuelos, SmartFarm), Inventario (existencias y movimientos) y Compras.
import { h, icono, vaciar, toast, dinero, pct, numero, chip, boton, alerta, esqueleto, errorTexto, fecha, fechaHora, json, vacioV, num, ahoraIso, hoyIso, confirmar, chipPendiente, modal } from '../ui.js';
import { formulario } from '../forms.js';
import { pantalla, listado, avisoCache, pestanas } from '../vistas.js';
import { rutasCrud, renderLista, botonNuevo, mostrar } from '../crud.js';
import * as datos from '../datos.js';
import { esDir, puede, cat, rol, usuario, nombreUsuario, param } from '../estado.js';
import { ir } from '../router.js';
import { opSkus, skuInfo, opEquipos, opUsuarios, opProveedores, ubicaciones } from './comunes.js';

const TIPOS_EQUIPO = ['Dron', 'Batería', 'Cargador', 'Generador', 'Sistema de esparcido', 'Control'];
const ESTATUS_EQUIPO = ['Disponible', 'En servicio', 'Rentado', 'En mantenimiento', 'Vendido', 'Baja'];
const UBIC_DEFECTO = 'Bodega Ciudad Guzmán';

// ---------- Equipos ----------
export const cfgEquipos = {
  tabla: 'Equipos', ruta: 'equipos', titulo: 'Equipos', singular: 'equipo', singularMayus: 'Equipo', icono: 'dron', botonEnLista: true,
  campos: () => [
    { c: 'serie', l: 'Número de serie', t: 'texto', req: true, ancho: 'medio' },
    { c: 'sku', l: 'SKU', t: 'opciones', op: () => opSkus(), ancho: 'medio' },
    { c: 'tipo', l: 'Tipo', t: 'opciones', op: TIPOS_EQUIPO, req: true, ancho: 'medio' },
    { c: 'propiedad', l: 'Propiedad', t: 'opciones', op: ['Flota propia', 'Mercancía para venta'], req: true, ancho: 'medio' },
    { c: 'estatus', l: 'Estatus', t: 'opciones', op: ESTATUS_EQUIPO, def: 'Disponible', ancho: 'medio' },
    { c: 'ubicacion', l: 'Ubicación', t: 'texto', def: UBIC_DEFECTO, ancho: 'medio' },
    { c: 'fecha_alta', l: 'Fecha de alta', t: 'fecha', ancho: 'medio' },
    esDir() ? { c: 'costo', l: 'Costo sin IVA', t: 'dinero', ancho: 'medio' } : null,
    { c: 'ciclos', l: 'Ciclos (baterías)', t: 'numero', min: 0, ancho: 'medio' },
    { c: 'vuelos_acumulados', l: 'Vuelos acumulados', t: 'numero', min: 0, ancho: 'medio' },
    { c: 'horas_acumuladas', l: 'Horas acumuladas', t: 'numero', suf: 'h', min: 0, ancho: 'medio' },
    { c: 'ultimo_mantenimiento', l: 'Último mantenimiento', t: 'fecha', ancho: 'medio' }
  ],
  calculados: [{ c: 'vuelos_desde_mant', l: 'Vuelos desde el mantenimiento', t: 'numero' }, { c: 'horas_desde_mant', l: 'Horas desde el mantenimiento', t: 'numero', suf: 'h' }, { c: 'alerta_mant', l: 'Alerta de mantenimiento', t: 'bool' }],
  columnas: [
    { l: 'Serie', v: r => r.serie, clase: 'clave' }, { l: 'Equipo', v: r => h('span', h('strong', r.tipo || '—'), h('span.sub', (skuInfo(r.sku) || {}).descripcion || r.sku || '')) },
    { l: 'Propiedad', v: r => r.propiedad || '—' }, { l: 'Ubicación', v: r => r.ubicacion || '—' },
    { l: 'Uso desde mant.', v: r => (r.tipo === 'Dron' ? `${numero(r.vuelos_desde_mant || 0)} vuelos · ${numero(r.horas_desde_mant || 0)} h` : r.tipo === 'Batería' ? `${numero(r.ciclos || 0)} ciclos` : '—'), num: true },
    { l: 'Estatus', v: r => h('span.fila', { style: { gap: '6px' } }, chip(r.estatus), r.alerta_mant === true ? chip('Mantenimiento', 'rechazado') : null) }
  ],
  movil: { titulo: r => `${r.tipo || 'Equipo'} · ${r.serie}`, chip: r => (r.alerta_mant === true ? chip('Mantenimiento', 'rechazado') : chip(r.estatus)), meta: r => [r.propiedad, r.tipo === 'Dron' ? `${numero(r.vuelos_desde_mant || 0)} vuelos desde mant.` : null, r.ubicacion] },
  texto: r => [r.serie, r.sku, r.tipo, r.ubicacion, r.estatus, (skuInfo(r.sku) || {}).descripcion].join(' '),
  filtros: [{ t: 'Flota propia', f: r => r.propiedad === 'Flota propia' }, { t: 'Para venta', f: r => r.propiedad === 'Mercancía para venta' }, { t: 'Con alerta de mantenimiento', f: r => r.alerta_mant === true }],
  orden: (a, b) => (b.alerta_mant === true) - (a.alerta_mant === true) || String(a.tipo).localeCompare(b.tipo) || String(a.serie).localeCompare(b.serie),
  tituloDe: r => `${r.tipo || 'Equipo'} ${r.serie}`, subDe: r => (skuInfo(r.sku) || {}).descripcion || r.sku,
  acciones: r => [puede('Mantenimientos', 'escribir') ? boton('Registrar mantenimiento', { ic: 'herramienta', href: '#/mantenimientos/nuevo?equipo_serie=' + encodeURIComponent(r.serie) }) : null],
  extrasDetalle: async (r, cuerpo) => {
    if (r.alerta_mant === true) cuerpo.prepend(alerta('error', 'Mantenimiento por realizar', `Llegó al umbral de ${num((skuInfo(r.sku) || {}).umbral_mant_vuelos) || param('umbral_mant_vuelos', 100)} vuelos o ${num((skuInfo(r.sku) || {}).umbral_mant_horas) || param('umbral_mant_horas', 20)} h desde el último mantenimiento.`));
    if (!puede('Mantenimientos')) return;
    const z = h('div'); cuerpo.append(h('section.pila', h('h2.titulo-seccion', 'Mantenimientos'), z));
    await renderLista(z, cfgMantenimientos, { filtro: m => m.equipo_serie === r.serie, sinBoton: true });
  }
};

// ---------- Mantenimientos (con refacciones que descuentan inventario) ----------
let editorRefacciones = null;
function widgetRefacciones(inicial) {
  const filas = json(inicial).map(x => Object.assign({}, x));
  const zona = h('div.pila');
  const pintar = () => {
    vaciar(zona);
    filas.forEach((f, i) => {
      const sel = h('select.selector', { 'aria-label': 'Refacción ' + (i + 1) }, h('option', { value: '' }, 'Elija la refacción…'), opSkus(c => !json(c.componentes).length).map(o => h('option', { value: o.v }, o.l)));
      sel.value = f.sku || '';
      const cant = h('input.entrada.entrada--numero', { inputmode: 'decimal', value: f.cantidad || 1, 'aria-label': 'Cantidad' });
      const ub = h('input.entrada', { value: f.ubicacion || UBIC_DEFECTO, 'aria-label': 'Ubicación de salida' });
      sel.addEventListener('change', () => { f.sku = sel.value; });
      cant.addEventListener('input', () => { f.cantidad = Number(cant.value) || 0; });
      ub.addEventListener('input', () => { f.ubicacion = ub.value; });
      zona.append(h('div.linea-simple', h('label.campo', h('span.campo__etiqueta', 'Refacción'), sel), h('label.campo', h('span.campo__etiqueta', 'Cantidad'), cant), h('label.campo', h('span.campo__etiqueta', 'Sale de'), ub),
        h('button.boton.boton--icono', { type: 'button', 'aria-label': 'Quitar refacción', onclick: () => { filas.splice(i, 1); pintar(); } }, icono('cerrar'))));
    });
    zona.append(boton('Agregar refacción', { tipo: 'secundario', ic: 'mas', chico: true, onclick: () => { filas.push({ sku: '', cantidad: 1, ubicacion: UBIC_DEFECTO }); pintar(); } }));
  };
  pintar();
  return { el: h('div.campo', h('span.campo__etiqueta', 'Refacciones usadas'), h('span.campo__ayuda', 'Generan la salida del inventario automáticamente.'), zona), leer: () => filas.filter(f => f.sku && f.cantidad > 0) };
}

export const cfgMantenimientos = {
  tabla: 'Mantenimientos', ruta: 'mantenimientos', titulo: 'Mantenimientos', singular: 'mantenimiento', singularMayus: 'Mantenimiento', icono: 'herramienta', botonEnLista: true,
  nuevo: () => ({ fecha: hoyIso(), tecnico: usuario(), tipo: 'Preventivo' }),
  campos: () => [
    { c: 'equipo_serie', l: 'Equipo', t: 'opciones', op: () => opEquipos(), req: true },
    { c: 'tipo', l: 'Tipo', t: 'opciones', op: ['Preventivo', 'Correctivo', 'Revisión'], req: true, ancho: 'medio' },
    { c: 'fecha', l: 'Fecha', t: 'fecha', req: true, ancho: 'medio' },
    { c: 'tecnico', l: 'Técnico', t: 'opciones', op: () => opUsuarios(['Técnico', 'Dirección']), ancho: 'medio' },
    esDir() ? { c: 'costo', l: 'Costo sin IVA', t: 'dinero', ancho: 'medio' } : null,
    { c: 'vuelos_al_momento', l: 'Vuelos al momento', t: 'numero', ancho: 'medio', ayuda: 'Se toma del equipo si queda vacío.' },
    { c: 'horas_al_momento', l: 'Horas al momento', t: 'numero', suf: 'h', ancho: 'medio' },
    { c: 'refacciones', l: 'Refacciones', t: 'oculto', ocultarEnDetalle: true }
  ],
  extrasForm: (f, cuerpo, base) => {
    editorRefacciones = widgetRefacciones(base.refacciones);
    cuerpo.querySelector('form').append(editorRefacciones.el);
    const eq = f.campo('equipo_serie');
    const llenar = () => { const e = cat('Equipos').find(x => x.serie === eq.control.value); if (e) { if (!f.campo('vuelos_al_momento').control.value) f.campo('vuelos_al_momento').fijar(e.vuelos_acumulados); if (!f.campo('horas_al_momento').control.value) f.campo('horas_al_momento').fijar(e.horas_acumuladas); } };
    eq.control.addEventListener('change', llenar); llenar();
  },
  antesDeGuardar: reg => { reg.refacciones = editorRefacciones ? editorRefacciones.leer() : []; return reg; },
  grupos: (r, defs) => [[null, defs.filter(d => d.c !== 'refacciones').map(d => [d.l, mostrar(d, r[d.c])])], ['Refacciones', json(r.refacciones).length ? json(r.refacciones).map(x => [x.sku, `${numero(x.cantidad)} · ${x.ubicacion || ''}`]) : [['Refacciones', 'Ninguna']]]],
  columnas: [
    { l: 'Fecha', v: r => fecha(r.fecha) }, { l: 'Equipo', v: r => h('strong', r.equipo_serie) }, { l: 'Tipo', v: r => r.tipo },
    { l: 'Técnico', v: r => nombreUsuario(r.tecnico) || '—' }, { l: 'Refacciones', v: r => String(json(r.refacciones).length), num: true }
  ],
  movil: { titulo: r => `${r.tipo} · ${r.equipo_serie}`, chip: r => h('span.texto-sm', fecha(r.fecha)), meta: r => [nombreUsuario(r.tecnico), json(r.refacciones).length ? json(r.refacciones).length + ' refacción(es)' : null] },
  texto: r => [r.equipo_serie, r.tipo, nombreUsuario(r.tecnico)].join(' '),
  orden: (a, b) => String(b.fecha).localeCompare(String(a.fecha)),
  tituloDe: r => `${r.tipo || 'Mantenimiento'} · ${r.equipo_serie}`, subDe: r => fecha(r.fecha)
};

// ---------- Vuelos ----------
export const cfgVuelos = {
  tabla: 'Vuelos', ruta: 'vuelos', titulo: 'Vuelos', singular: 'vuelo', singularMayus: 'Vuelo', icono: 'dron', botonEnLista: true, textoNuevo: 'Registrar vuelo manual',
  nuevo: () => ({ tarea_id_smartfarm: 'MANUAL-' + datos.uuid(), fecha_hora: ahoraIso(), piloto: usuario(), estatus: 'OK', origen_dato: 'Manual' }),
  campos: r => [
    { c: 'tarea_id_smartfarm', l: 'Id de tarea', t: r && r.origen_dato === 'SmartFarm' ? 'texto' : 'oculto', ro: !!(r && r.origen_dato === 'SmartFarm') },
    { c: 'fecha_hora', l: 'Fecha y hora', t: 'fechahora', req: true, ancho: 'medio' },
    { c: 'dron_serie', l: 'Dron', t: 'opciones', op: () => opEquipos(e => e.tipo === 'Dron'), req: true, ancho: 'medio' },
    { c: 'piloto', l: 'Piloto', t: 'opciones', op: () => opUsuarios(['Técnico', 'Agronomía', 'Dirección']), ancho: 'medio' },
    { c: 'duracion_min', l: 'Duración', t: 'numero', suf: 'min', min: 0, ancho: 'medio' },
    { c: 'area_ha', l: 'Área', t: 'numero', suf: 'ha', min: 0, ancho: 'medio' },
    { c: 'volumen_l', l: 'Volumen', t: 'numero', suf: 'L', min: 0, ancho: 'medio' },
    { c: 'baterias', l: 'Baterías', t: 'multi', op: () => opEquipos(e => e.tipo === 'Batería') },
    { c: 'estatus', l: 'Estatus', t: 'opciones', op: ['OK', 'Por revisar'], ancho: 'medio' },
    { c: 'origen_dato', l: 'Origen', t: 'oculto' }
  ],
  columnas: [
    { l: 'Fecha', v: r => fechaHora(r.fecha_hora) }, { l: 'Dron', v: r => h('strong', r.dron_serie || '—') }, { l: 'Piloto', v: r => nombreUsuario(r.piloto) || '—' },
    { l: 'Duración', v: r => numero(r.duracion_min, 'min'), num: true }, { l: 'Área', v: r => numero(r.area_ha, 'ha'), num: true },
    { l: 'Origen', v: r => r.origen_dato || '—' }, { l: 'Estatus', v: r => chip(r.estatus) }
  ],
  movil: { titulo: r => `${r.dron_serie || 'Vuelo'} · ${fechaHora(r.fecha_hora)}`, chip: r => chip(r.estatus), meta: r => [numero(r.area_ha, 'ha'), numero(r.duracion_min, 'min'), r.origen_dato] },
  texto: r => [r.dron_serie, r.piloto, r.tarea_id_smartfarm, r.origen_dato, r.estatus].join(' '),
  filtros: [{ t: 'Por revisar', f: r => r.estatus === 'Por revisar' }, { t: 'SmartFarm', f: r => r.origen_dato === 'SmartFarm' }, { t: 'Manuales', f: r => r.origen_dato === 'Manual' }],
  orden: (a, b) => String(b.fecha_hora).localeCompare(String(a.fecha_hora)),
  tituloDe: r => `Vuelo de ${r.dron_serie || 'dron'}`, subDe: r => fechaHora(r.fecha_hora)
};

async function importarSmartFarm(boton_) {
  if (!navigator.onLine) return toast('La importación necesita conexión.', 'info');
  boton_.disabled = true;
  try {
    const r = await datos.enLinea('importarSmartFarm', {});
    const l = Array.isArray(r) ? r : (r.archivos || r.resumen || []);
    toast(l.length ? `Importación terminada: ${l.length} archivo(s) procesado(s).` : 'No hay archivos nuevos en SmartFarm/Importar.', l.length ? 'exito' : 'info', 7000);
  } catch (e) {
    if (e.codigo === 'MAPEO') modal({ titulo: 'Falta confirmar el mapeo de SmartFarm', cuerpo: h('div.pila', h('p', e.message), h('p.texto-suave', 'Con la primera exportación real de SmartFarm, Dirección captura en la tabla MapeoSmartFarm el nombre de cada columna. Mientras tanto, registre los vuelos de forma manual.')), acciones: [{ texto: 'Entendido', tipo: 'primario' }] });
    else toast(errorTexto(e), 'error');
  } finally { boton_.disabled = false; }
}

async function pantallaFlota(c, p, q) {
  const tab = q.vista || 'equipos';
  const cfgs = { equipos: cfgEquipos, mantenimientos: cfgMantenimientos, vuelos: cfgVuelos };
  const imp = (rol() === 'Dirección' || rol() === 'Técnico') && tab === 'vuelos' ? boton('Importar SmartFarm ahora', { tipo: 'secundario', ic: 'subir' }) : null;
  if (imp) imp.addEventListener('click', () => importarSmartFarm(imp));
  const cuerpo = pantalla(c, { titulo: 'Flota y mantenimiento', acciones: [imp, cfgs[tab] ? botonNuevo(cfgs[tab]) : null] });
  const zona = h('div');
  cuerpo.append(pestanas([{ id: 'equipos', t: 'Equipos' }, puede('Mantenimientos') && { id: 'mantenimientos', t: 'Mantenimientos' }, puede('Vuelos') && { id: 'vuelos', t: 'Vuelos' }, puede('BitacoraImportacion') && { id: 'importaciones', t: 'Importaciones' }], tab,
    v => { history.replaceState(null, '', '#/flota?vista=' + v); pantallaFlota(c, p, { vista: v }); }), zona);
  if (tab === 'importaciones') {
    zona.append(esqueleto(2));
    try {
      const { registros } = await datos.listar('BitacoraImportacion');
      vaciar(zona).append(listado({ registros, columnas: [{ l: 'Fecha', v: r => fechaHora(r.fecha) }, { l: 'Archivo', v: r => r.archivo }, { l: 'Leídas', v: r => numero(r.filas_leidas), num: true }, { l: 'Nuevas', v: r => numero(r.nuevas), num: true }, { l: 'Duplicadas', v: r => numero(r.duplicadas), num: true }, { l: 'Por revisar', v: r => numero(r.por_revisar), num: true }, { l: 'Resultado', v: r => chip(r.resultado === 'Con observaciones' ? 'Por revisar' : r.resultado) }],
        movil: { titulo: r => r.archivo, chip: r => chip(r.resultado === 'Con observaciones' ? 'Por revisar' : r.resultado), meta: r => [fechaHora(r.fecha), `${numero(r.nuevas)} nuevas`] }, orden: (a, b) => String(b.fecha).localeCompare(String(a.fecha)),
        vacio: { ic: 'subir', t: 'Sin importaciones', d: 'Cada importación de SmartFarm queda registrada aquí.' } }));
    } catch (e) { vaciar(zona).append(alerta('error', 'No se pudo cargar', errorTexto(e))); }
    return;
  }
  await renderLista(zona, cfgs[tab], { sinBoton: true });
}

// ---------- Inventario ----------
export const cfgExistencias = {
  tabla: 'Existencias', ruta: 'existencias', titulo: 'Existencias', singular: 'existencia', singularMayus: 'Existencia', femenino: true, icono: 'inventario',
  textoNuevo: 'Nuevo SKU en inventario',
  campos: () => [
    { c: 'sku', l: 'SKU', t: 'opciones', op: () => opSkus(c => !json(c.componentes).length), req: true },
    { c: 'ubicacion', l: 'Ubicación', t: 'texto', def: UBIC_DEFECTO, req: true, lista: 'ubicaciones' },
    { c: 'minimo', l: 'Mínimo', t: 'numero', min: 0, ancho: 'medio' }, { c: 'maximo', l: 'Máximo', t: 'numero', min: 0, ancho: 'medio' }
  ],
  calculados: [{ c: 'existencia', l: 'Existencia', t: 'numero' }, { c: 'valor', l: 'Valor sin IVA', t: 'dinero' }, { c: 'compra_sugerida', l: 'Compra sugerida', t: 'numero' }, { c: 'estatus_stock', l: 'Estatus', t: 'texto' }],
  columnas: [
    { l: 'SKU', v: r => r.sku, clase: 'clave' }, { l: 'Descripción', v: r => (skuInfo(r.sku) || {}).descripcion || '—' }, { l: 'Ubicación', v: r => r.ubicacion },
    { l: 'Existencia', v: r => numero(r.existencia || 0), num: true }, { l: 'Mín. / máx.', v: r => `${numero(r.minimo || 0)} / ${numero(r.maximo || 0)}`, num: true },
    esDir() ? { l: 'Valor', v: r => dinero(r.valor), num: true } : null,
    { l: 'Compra sugerida', v: r => numero(r.compra_sugerida || 0), num: true }, { l: 'Estatus', v: r => chip(r.estatus_stock || 'OK') }
  ].filter(Boolean),
  movil: { titulo: r => (skuInfo(r.sku) || {}).descripcion || r.sku, chip: r => chip(r.estatus_stock || 'OK'), meta: r => [r.sku, `Existencia ${numero(r.existencia || 0)}`, r.ubicacion] },
  texto: r => [r.sku, (skuInfo(r.sku) || {}).descripcion, r.ubicacion].join(' '),
  filtros: [{ t: 'Por reponer', f: r => ['Reponer', 'Sin existencia'].includes(r.estatus_stock) }],
  orden: (a, b) => String(a.sku).localeCompare(b.sku),
  tituloDe: r => (skuInfo(r.sku) || {}).descripcion || r.sku, subDe: r => `${r.sku} · ${r.ubicacion}`, estatusDe: r => r.estatus_stock,
  acciones: r => [puede('MovimientosInventario', 'escribir') ? boton('Registrar movimiento', { ic: 'inventario', href: `#/movinv/nuevo?sku=${encodeURIComponent(r.sku)}&ubicacion=${encodeURIComponent(r.ubicacion)}` }) : null],
  extrasForm: (f, cuerpo) => cuerpo.append(h('datalist', { id: 'ubicaciones' }, [UBIC_DEFECTO, ...ubicaciones()].filter((x, i, a) => a.indexOf(x) === i).map(u => h('option', { value: u }))))
};

export const cfgMovInv = {
  tabla: 'MovimientosInventario', ruta: 'movinv', titulo: 'Movimientos de inventario', singular: 'movimiento', singularMayus: 'Movimiento', icono: 'inventario',
  nuevo: () => ({ fecha: ahoraIso(), tipo: 'Ajuste', ubicacion: UBIC_DEFECTO }),
  subForm: 'Las entradas por compra y las salidas por servicio o renta se registran solas. Aquí se capturan ajustes, ventas y cargas iniciales.',
  campos: () => [
    { c: 'tipo', l: 'Tipo', t: 'opciones', op: ['Ajuste', 'Salida venta', 'Entrada compra', 'Salida servicio', 'Salida renta', 'Devolución renta'], req: true, ancho: 'medio' },
    { c: 'fecha', l: 'Fecha', t: 'fechahora', req: true, ancho: 'medio' },
    { c: 'sku', l: 'SKU', t: 'opciones', op: () => opSkus(c => !json(c.componentes).length), req: true },
    { c: 'cantidad', l: 'Cantidad', t: 'numero', req: true, min: 0, ancho: 'medio', ayuda: 'Siempre positiva: el tipo define si suma o resta. Un ajuste suma.' },
    { c: 'ubicacion', l: 'Ubicación', t: 'texto', ancho: 'medio' },
    { c: 'serie', l: 'Número de serie', t: 'texto', ancho: 'medio', ayuda: 'Solo si el artículo tiene serie.' },
    { c: 'referencia', l: 'Referencia', t: 'texto', ancho: 'medio', ph: 'Folio, factura o motivo' }
  ],
  columnas: [
    { l: 'Fecha', v: r => fechaHora(r.fecha) }, { l: 'Tipo', v: r => r.tipo }, { l: 'SKU', v: r => r.sku, clase: 'clave' }, { l: 'Serie', v: r => r.serie || '—' },
    { l: 'Cantidad', v: r => numero(r.cantidad), num: true }, { l: 'Ubicación', v: r => r.ubicacion || '—' }, { l: 'Referencia', v: r => r.referencia || '—' }, { l: 'Usuario', v: r => nombreUsuario(r.usuario) }
  ],
  movil: { titulo: r => `${r.tipo} · ${r.sku}`, chip: r => h('span.texto-fuerte.numero', (/Salida/.test(r.tipo) ? '−' : '+') + numero(r.cantidad)), meta: r => [fechaHora(r.fecha), r.referencia] },
  texto: r => [r.sku, r.serie, r.tipo, r.referencia, r.ubicacion].join(' '),
  filtros: [{ t: 'Entradas', f: r => /Entrada|Devolución|Ajuste/.test(r.tipo) }, { t: 'Salidas', f: r => /Salida/.test(r.tipo) }],
  orden: (a, b) => String(b.fecha).localeCompare(String(a.fecha)),
  tituloDe: r => `${r.tipo} · ${r.sku}`, subDe: r => fechaHora(r.fecha)
};

async function pantallaInventario(c, p, q) {
  const tab = q.vista || 'existencias';
  const cfgs = { existencias: cfgExistencias, movimientos: cfgMovInv };
  const cuerpo = pantalla(c, { titulo: 'Inventario', sub: 'Refacciones e insumos sin serie. Los equipos con serie están en Flota.', acciones: [botonNuevo(cfgs[tab])] });
  const zona = h('div');
  cuerpo.append(pestanas([{ id: 'existencias', t: 'Existencias' }, puede('MovimientosInventario') && { id: 'movimientos', t: 'Movimientos' }], tab,
    v => { history.replaceState(null, '', '#/inventario?vista=' + v); pantallaInventario(c, p, { vista: v }); }), zona);
  await renderLista(zona, cfgs[tab], { sinBoton: true });
}

// ---------- Compras ----------
const cfgProveedores = {
  tabla: 'Proveedores', ruta: 'proveedores', titulo: 'Proveedores', singular: 'proveedor', singularMayus: 'Proveedor', icono: 'compras',
  campos: () => [
    { c: 'nombre', l: 'Nombre', t: 'texto', req: true }, { c: 'tipo', l: 'Tipo', t: 'texto', ancho: 'medio' }, { c: 'estatus', l: 'Estatus', t: 'opciones', op: ['Activo', 'Inactivo'], def: 'Activo', ancho: 'medio' },
    { c: 'contacto', l: 'Contacto', t: 'texto', ancho: 'medio' }, { c: 'telefono_correo', l: 'Teléfono o correo', t: 'texto', ancho: 'medio' },
    { c: 'productos', l: 'Productos', t: 'area', filas: 2 }, { c: 'condiciones_pago', l: 'Condiciones de pago', t: 'texto', ancho: 'medio' },
    { c: 'tiempo_entrega_dias', l: 'Tiempo de entrega', t: 'numero', suf: 'días', ancho: 'medio' }, { c: 'moneda', l: 'Moneda', t: 'opciones', op: ['MXN', 'USD'], ancho: 'medio' },
    { c: 'credito_autorizado', l: 'Crédito autorizado', t: 'dinero', ancho: 'medio' }, { c: 'notas', l: 'Notas', t: 'area', filas: 2 }
  ],
  columnas: [{ l: 'Proveedor', v: r => h('strong', r.nombre) }, { l: 'Tipo', v: r => r.tipo || '—' }, { l: 'Contacto', v: r => [r.contacto, r.telefono_correo].filter(Boolean).join(' · ') || '—' }, { l: 'Condiciones', v: r => r.condiciones_pago || '—' }, { l: 'Estatus', v: r => chip(r.estatus || 'Activo') }],
  movil: { titulo: r => r.nombre, chip: r => chip(r.estatus || 'Activo'), meta: r => [r.tipo, r.contacto] },
  texto: r => [r.nombre, r.tipo, r.contacto, r.productos].join(' '),
  orden: (a, b) => String(a.nombre).localeCompare(b.nombre, 'es'), tituloDe: r => r.nombre
};

async function listaCompras(c, p, q) {
  const tab = q.vista || 'ordenes';
  const cuerpo = pantalla(c, { titulo: 'Compras', sub: rol() === 'Técnico' ? 'Órdenes de compra autorizadas para registrar su recepción.' : 'Requisición → aprobación de Dirección → orden de compra → recepción.',
    acciones: [tab === 'ordenes' && esDir() ? boton('Nueva requisición', { ic: 'mas', href: '#/compras/nueva' }) : null, tab === 'proveedores' ? botonNuevo(cfgProveedores) : null] });
  const zona = h('div');
  cuerpo.append(pestanas([{ id: 'ordenes', t: 'Órdenes de compra' }, puede('Proveedores') && { id: 'proveedores', t: 'Proveedores' }], tab,
    v => { history.replaceState(null, '', '#/compras?vista=' + v); listaCompras(c, p, { vista: v }); }), zona);
  if (tab === 'proveedores') return renderLista(zona, cfgProveedores, { sinBoton: true });
  zona.append(esqueleto(3));
  let regs, desdeCache;
  try { ({ registros: regs, desdeCache } = await datos.listar('Compras')); } catch (e) { vaciar(zona).append(alerta('error', 'No se pudieron cargar las compras', errorTexto(e))); return; }
  vaciar(zona); const av = avisoCache(desdeCache); if (av) zona.append(av);
  zona.append(listado({
    registros: regs, buscarPh: 'Buscar folio o proveedor',
    columnas: [
      { l: 'Folio', v: r => r.folio || 'Sin folio aún', clase: 'clave' }, { l: 'Proveedor', v: r => h('strong', r.proveedor || '—') }, { l: 'Fecha', v: r => fecha(r.fecha) },
      { l: 'Entrega estimada', v: r => fecha(r.fecha_estimada_entrega) }, esDir() ? { l: 'Total con IVA', v: r => dinero(r.total), num: true } : null, { l: 'Estatus', v: r => chip(r.estatus || 'Requisición') }
    ].filter(Boolean),
    movil: { titulo: r => (r.folio || 'Requisición') + ' · ' + (r.proveedor || ''), chip: r => chip(r.estatus || 'Requisición'), meta: r => [fecha(r.fecha), esDir() ? dinero(r.total) : null] },
    texto: r => [r.folio, r.proveedor, r.estatus, r.factura_referencia].join(' '),
    filtros: [{ t: 'Por aprobar', f: r => r.estatus === 'Pendiente de aprobación' }, { t: 'Por recibir', f: r => r.estatus === 'OC' }, { t: 'Recibidas', f: r => r.estatus === 'Recibida' }],
    orden: (a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')),
    href: r => 'compras/' + r.id,
    vacio: { ic: 'compras', t: rol() === 'Técnico' ? 'No hay órdenes por recibir' : 'Aún no hay compras', d: '', accion: esDir() ? boton('Nueva requisición', { ic: 'mas', href: '#/compras/nueva' }) : null }
  }));
}

async function formCompra(c, { id }) {
  let r = null;
  if (id) { try { r = await datos.obtener('Compras', id); } catch (e) { pantalla(c, { titulo: 'Compra', volver: 'compras' }).append(alerta('error', 'No se pudo abrir', errorTexto(e))); return; } }
  const base = r || { fecha: hoyIso() };
  const cuerpo = pantalla(c, { titulo: id ? 'Editar ' + (r.folio || 'requisición') : 'Nueva requisición', volver: id ? 'compras/' + id : 'compras' });
  cuerpo.classList.add('no-refrescar');
  const f = formulario([
    { c: 'proveedor', l: 'Proveedor', t: 'opciones', op: opProveedores, req: true },
    { c: 'fecha', l: 'Fecha', t: 'fecha', req: true, ancho: 'medio' }, { c: 'fecha_estimada_entrega', l: 'Entrega estimada', t: 'fecha', ancho: 'medio' },
    { c: 'notas', l: 'Notas', t: 'area', filas: 2 }
  ], base);
  const lineas = (r && r.detalle ? r.detalle : [{ sku: '', cantidad: 1 }]).map(x => Object.assign({}, x));
  const zona = h('div.pila'), tot = h('div.totales-cot');
  const pintar = () => {
    vaciar(zona);
    lineas.forEach((l, i) => {
      const sel = h('select.selector', { 'aria-label': 'SKU ' + (i + 1) }, h('option', { value: '' }, 'Elija un SKU…'), opSkus(k => !json(k.componentes).length).map(o => h('option', { value: o.v }, o.l)));
      sel.value = l.sku || '';
      const cant = h('input.entrada.entrada--numero', { inputmode: 'decimal', value: l.cantidad || 1, 'aria-label': 'Cantidad' });
      const costo = h('input.entrada.entrada--numero', { inputmode: 'decimal', value: l.costo_unitario ?? '', 'aria-label': 'Costo unitario', placeholder: '0.00' });
      sel.addEventListener('change', () => { l.sku = sel.value; const k = skuInfo(l.sku); if (k) { l.descripcion = k.descripcion; l.tasa_iva = k.tasa_iva; if (vacioV(l.costo_unitario)) l.costo_unitario = k.costo_unitario; } pintar(); });
      cant.addEventListener('input', () => { l.cantidad = Number(cant.value) || 0; total(); });
      costo.addEventListener('input', () => { l.costo_unitario = Number(costo.value) || 0; total(); });
      zona.append(h('div.linea-simple', h('label.campo', h('span.campo__etiqueta', 'SKU'), sel), h('label.campo', h('span.campo__etiqueta', 'Cantidad'), cant),
        h('label.campo', h('span.campo__etiqueta', 'Costo unitario sin IVA'), h('span.campo__control', h('span.campo__prefijo', '$'), costo)),
        h('button.boton.boton--icono', { type: 'button', 'aria-label': 'Quitar partida', onclick: () => { lineas.splice(i, 1); if (!lineas.length) lineas.push({ sku: '', cantidad: 1 }); pintar(); } }, icono('cerrar'))));
    });
    total();
  };
  const total = () => {
    let st = 0, iva = 0;
    lineas.filter(l => l.sku).forEach(l => { const k = skuInfo(l.sku) || {}; const s = num(l.cantidad) * num(l.costo_unitario); st += s; iva += s * num(l.tasa_iva ?? k.tasa_iva); });
    vaciar(tot).append(h('dl.totales', h('dt', 'Subtotal'), h('dd', dinero(st)), h('dt', 'IVA'), h('dd', dinero(iva)), h('dt.totales__total', 'Total'), h('dd.totales__total', dinero(st + iva))));
  };
  pintar();
  const guardar = async enviar => {
    if (!f.validar()) return toast('Revise los datos marcados.', 'error');
    const det = lineas.filter(l => l.sku && num(l.cantidad) > 0).map((l, i) => { const k = skuInfo(l.sku) || {}; return { id: l.id || datos.uuid(), partida: i + 1, sku: l.sku, descripcion: k.descripcion || l.descripcion || '', cantidad: num(l.cantidad), costo_unitario: num(l.costo_unitario), tasa_iva: vacioV(k.tasa_iva) ? 0.16 : num(k.tasa_iva) }; });
    if (!det.length) return toast('Agregue al menos una partida.', 'error');
    const reg = Object.assign({ id: id || undefined }, f.leer(), { detalle: det });
    if (enviar) reg.estatus = 'Pendiente de aprobación';
    try {
      const g = await datos.guardar('Compras', reg, { version: r ? r.actualizado_en : undefined, resumen: 'Compra a ' + reg.proveedor });
      toast((enviar ? 'Requisición enviada a aprobación' : 'Requisición guardada') + (navigator.onLine ? '' : ' · se subirá al haber señal'));
      ir('compras/' + g.id, { reemplazar: true });
    } catch (e) { toast(errorTexto(e), 'error'); }
  };
  cuerpo.append(h('form.tarjeta.pila', { novalidate: true, onsubmit: e => e.preventDefault() }, f.el),
    h('section.tarjeta.pila', h('div.fila.encabezado-seccion', h('h2.titulo-tarjeta', 'Partidas'), boton('Agregar partida', { tipo: 'secundario', ic: 'mas', chico: true, onclick: () => { lineas.push({ sku: '', cantidad: 1 }); pintar(); } })), zona, tot),
    h('div.barra-acciones', boton('Cancelar', { tipo: 'fantasma', href: '#/' + (id ? 'compras/' + id : 'compras') }), boton('Guardar requisición', { tipo: 'secundario', onclick: () => guardar(false) }), boton('Enviar a aprobación', { ic: 'aprobar', onclick: () => guardar(true) })));
}

async function detalleCompra(c, { id }) {
  const cu = pantalla(c, { titulo: 'Compra', volver: 'compras' }); cu.append(esqueleto(2));
  let r;
  try { r = await datos.obtener('Compras', id); } catch (e) { vaciar(cu).append(alerta('error', 'No se pudo abrir la compra', errorTexto(e))); return; }
  if (!r) { vaciar(cu).append(alerta('advertencia', 'Compra no disponible sin conexión')); return; }
  const est = r.estatus || 'Requisición';
  const acc = [];
  if (esDir() && ['Requisición', 'Pendiente de aprobación'].includes(est)) acc.push(boton('Editar', { tipo: 'secundario', ic: 'editar', href: '#/compras/' + id + '/editar' }));
  if (esDir() && est === 'Requisición') acc.push(boton('Enviar a aprobación', { ic: 'aprobar', onclick: async () => { await datos.cambiarEstatus('Compras', id, 'Pendiente de aprobación', null, { resumen: (r.folio || 'Compra') + ' → aprobación' }); toast('Requisición enviada a aprobación'); setTimeout(() => ir('compras/' + id, { reemplazar: true }), 250); } }));
  if (puede('Compras', 'escribir') && est === 'OC') acc.push(boton('Registrar recepción', { ic: 'inventario', href: '#/compras/' + id + '/recepcion' }));
  const cuerpo = pantalla(c, { titulo: r.folio || 'Requisición', sub: r.proveedor, volver: 'compras', chip: r._pendiente ? chipPendiente() : chip(est), acciones: acc });
  const av = avisoCache(r._desdeCache); if (av) cuerpo.append(av);
  cuerpo.append(h('div.panel-datos', h('dl.datos', h('dt', 'Proveedor'), h('dd', r.proveedor || '—'), h('dt', 'Fecha'), h('dd', fecha(r.fecha)), h('dt', 'Entrega estimada'), h('dd', fecha(r.fecha_estimada_entrega)),
    h('dt', 'Recepción'), h('dd', fecha(r.fecha_recepcion)), h('dt', 'Factura'), h('dd', r.factura_referencia || '—'), h('dt', 'Notas'), h('dd', r.notas || '—'))));
  const det = r.detalle || [];
  cuerpo.append(h('div.tabla-contenedor', h('table.tabla', h('thead', h('tr', h('th', 'SKU'), h('th', 'Descripción'), h('th.num', 'Cantidad'), h('th.num', 'Recibida'), esDir() ? h('th.num', 'Costo') : null, esDir() ? h('th.num', 'Total') : null)),
    h('tbody', det.map(d => h('tr', h('td.clave', d.sku), h('td', d.descripcion), h('td.num', numero(d.cantidad)), h('td.num', vacioV(d.cantidad_recibida) ? '—' : numero(d.cantidad_recibida)), esDir() ? h('td.num', dinero(d.costo_unitario)) : null, esDir() ? h('td.num', dinero(d.total)) : null))),
    esDir() ? h('tfoot', h('tr', h('td', { colspan: 5, class: 'num' }, 'Subtotal'), h('td.num', dinero(r.subtotal))), h('tr', h('td', { colspan: 5, class: 'num' }, 'IVA'), h('td.num', dinero(r.iva))), h('tr.tabla__total', h('td', { colspan: 5, class: 'num' }, 'Total'), h('td.num', dinero(r.total)))) : null)));
}

async function recepcion(c, { id }) {
  let r;
  try { r = await datos.obtener('Compras', id); } catch (e) { pantalla(c, { titulo: 'Recepción', volver: 'compras/' + id }).append(alerta('error', 'No se pudo abrir', errorTexto(e))); return; }
  if (!r) { pantalla(c, { titulo: 'Recepción', volver: 'compras/' + id }).append(alerta('advertencia', 'Compra no disponible sin conexión')); return; }
  const cuerpo = pantalla(c, { titulo: 'Registrar recepción', sub: `${r.folio || ''} · ${r.proveedor || ''}`, volver: 'compras/' + id });
  cuerpo.classList.add('no-refrescar');
  const f = formulario([{ c: 'ubicacion', l: 'Ubicación de entrada', t: 'texto', def: UBIC_DEFECTO, req: true, ancho: 'medio' }, { c: 'factura_referencia', l: 'Factura o remisión', t: 'texto', ancho: 'medio' }, { c: 'notas', l: 'Notas de recepción', t: 'area', filas: 2 }], { ubicacion: UBIC_DEFECTO, notas: r.notas });
  const filas = (r.detalle || []).map(d => {
    const k = skuInfo(d.sku) || {};
    const conSerie = ['Dron', 'Batería', 'Cargador', 'Generador', 'Control', 'Sistema de esparcido'].some(t => String(k.tipo || '').toLowerCase().includes(t.toLowerCase().split(' ')[0]));
    const cant = h('input.entrada.entrada--numero', { inputmode: 'decimal', value: d.cantidad, 'aria-label': 'Cantidad recibida de ' + d.sku });
    const series = h('textarea.area-texto', { rows: 2, placeholder: 'Una serie por línea', 'aria-label': 'Números de serie de ' + d.sku });
    return { d, cant, series, el: h('div.tarjeta.pila', h('div.titulo-tarjeta', `${d.sku} · ${d.descripcion || ''}`), h('p.texto-sm.texto-suave', `Pedido: ${numero(d.cantidad)}`),
      h('label.campo', h('span.campo__etiqueta', 'Cantidad recibida'), cant), conSerie ? h('label.campo', h('span.campo__etiqueta', 'Números de serie'), series, h('span.campo__ayuda', 'Cada serie da de alta el equipo en Flota como mercancía para venta.')) : null) };
  });
  const guardar = boton('Registrar recepción', { ic: 'check' });
  cuerpo.append(h('form.tarjeta.pila', { novalidate: true, onsubmit: e => e.preventDefault() }, f.el), ...filas.map(x => x.el), h('div.barra-acciones', boton('Cancelar', { tipo: 'fantasma', href: '#/compras/' + id }), guardar));
  guardar.addEventListener('click', async () => {
    if (!f.validar()) return;
    const v = f.leer();
    const rec = filas.map(x => ({ id: x.d.id, cantidad_recibida: Number(x.cant.value) || 0, series: x.series.value.split(/\n|,/).map(s => s.trim()).filter(Boolean) }));
    const errorSerie = rec.find(x => x.series.length > x.cantidad_recibida);
    if (errorSerie) return toast('Hay más números de serie que piezas recibidas.', 'error');
    if (!(await confirmar('Registrar recepción', 'Se dará entrada al inventario con estas cantidades.'))) return;
    guardar.disabled = true;
    await datos.cambiarEstatus('Compras', id, 'Recibida', { ubicacion: v.ubicacion, factura_referencia: v.factura_referencia, notas: v.notas, recepcion: rec }, { resumen: `${r.folio || 'OC'} → Recibida` });
    toast('Recepción registrada' + (navigator.onLine ? '' : ' · se subirá al haber señal'));
    ir('compras/' + id, { reemplazar: true });
  });
}

export const rutas = [
  { p: 'flota', r: pantallaFlota },
  ...rutasCrud(cfgEquipos), ...rutasCrud(cfgMantenimientos), ...rutasCrud(cfgVuelos),
  { p: 'inventario', r: pantallaInventario },
  ...rutasCrud(cfgExistencias), ...rutasCrud(cfgMovInv),
  { p: 'compras', r: listaCompras },
  { p: 'compras/nueva', r: (c, p) => formCompra(c, {}) },
  { p: 'compras/:id', r: (c, p) => detalleCompra(c, p) },
  { p: 'compras/:id/editar', r: (c, p) => formCompra(c, p) },
  { p: 'compras/:id/recepcion', r: (c, p) => recepcion(c, p) },
  ...rutasCrud(cfgProveedores)
];
