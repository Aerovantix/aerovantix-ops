// Caja y finanzas, Nómina, Plan semanal y cierre, Decisiones.
import { h, icono, vaciar, toast, dinero, pct, numero, chip, boton, alerta, esqueleto, errorTexto, fecha, json, vacioV, num, hoyIso, lunesIso, sumarDiasIso, chipPendiente } from '../ui.js';
import { formulario } from '../forms.js';
import { pantalla, listado, avisoCache, pestanas } from '../vistas.js';
import { rutasCrud, renderLista, botonNuevo, mostrar } from '../crud.js';
import * as datos from '../datos.js';
import { esDir, puede, cat, rol, usuario, nombreUsuario, param } from '../estado.js';
import { ir } from '../router.js';
import { barras, linea, valorVista } from '../graficas.js';
import { opUsuarios, enlace, selectorFotos } from './comunes.js';

// ---------- Caja (Movimientos) ----------
let fotoComprobante = null;
export const cfgMovimientos = {
  tabla: 'Movimientos', ruta: 'movimientos', titulo: 'Movimientos de caja', singular: 'movimiento', singularMayus: 'Movimiento', icono: 'caja',
  nuevo: () => ({ fecha: hoyIso(), tipo: 'Egreso', real_proyectado: 'Real', estatus_factura: 'Sin factura' }),
  campos: () => [
    { c: 'tipo', l: 'Tipo', t: 'opciones', op: ['Ingreso', 'Egreso'], req: true, ancho: 'medio' },
    { c: 'fecha', l: 'Fecha', t: 'fecha', req: true, ancho: 'medio' },
    { c: 'categoria', l: 'Categoría', t: 'opciones', op: () => (param('categorias_movimientos', []) || []).map(x => (typeof x === 'object' ? { v: x.categoria, l: x.categoria + (x.grupo ? ' · ' + x.grupo : '') } : x)), req: true },
    { c: 'concepto', l: 'Concepto', t: 'texto', req: true },
    { c: 'monto_con_iva', l: 'Monto con IVA', t: 'dinero', req: true, min: 0, ancho: 'medio' },
    { c: 'iva', l: 'IVA incluido', t: 'dinero', min: 0, ancho: 'medio', ayuda: 'Vacío si no causa IVA.' },
    { c: 'forma_pago', l: 'Forma de pago', t: 'opciones', op: ['Transferencia', 'Efectivo', 'Tarjeta', 'Cheque'], ancho: 'medio' },
    { c: 'referencia', l: 'Referencia', t: 'texto', ancho: 'medio', ph: 'Folio de cotización, OC, factura…' },
    { c: 'real_proyectado', l: 'Real o proyectado', t: 'opciones', op: ['Real', 'Proyectado'], ancho: 'medio', ayuda: 'Proyectado alimenta el flujo de 13 semanas.' },
    { c: 'estatus_factura', l: 'Factura', t: 'opciones', op: ['Sin factura', 'Por facturar', 'Facturada', 'Cancelada'], ancho: 'medio' },
    { c: 'uuid_cfdi', l: 'Folio fiscal (UUID del CFDI)', t: 'texto', ph: '8-4-4-4-12', validar: v => (v && !/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(v) ? 'El UUID tiene 36 caracteres con guiones.' : '') }
  ],
  calculados: [{ c: 'monto_sin_iva', l: 'Monto sin IVA', t: 'dinero' }, { c: 'semana', l: 'Semana', t: 'fecha' }, { c: 'mes', l: 'Mes', t: 'fecha' }, { c: 'estatus_aprobacion', l: 'Aprobación', t: 'texto' }],
  extrasForm: (f, cuerpo) => { fotoComprobante = selectorFotos('Foto del comprobante'); cuerpo.querySelector('form').append(fotoComprobante.el); },
  despuesDeGuardar: async g => {
    const fotos = fotoComprobante ? fotoComprobante.fotos() : [];
    if (fotos.length) await datos.adjuntar('Movimientos', g.id, 'comprobante_url', fotos[0], 'Comprobante.jpg', { resumen: 'Comprobante de ' + (g.concepto || 'movimiento') });
    ir('movimientos/' + g.id, { reemplazar: true });
  },
  columnas: [
    { l: 'Fecha', v: r => fecha(r.fecha) }, { l: 'Concepto', v: r => h('span', h('strong', r.concepto), h('span.sub', r.categoria || '')) },
    { l: 'Monto con IVA', v: r => h('span', { style: { color: r.tipo === 'Ingreso' ? 'var(--avx-exito)' : 'var(--texto)' } }, (r.tipo === 'Egreso' ? '−' : '+') + dinero(r.monto_con_iva)), num: true },
    { l: 'Real / proyectado', v: r => r.real_proyectado }, { l: 'Factura', v: r => chip(r.estatus_factura || 'Sin factura') }, { l: 'Aprobación', v: r => chip(r.estatus_aprobacion || 'Aprobado') }
  ],
  movil: { titulo: r => r.concepto, chip: r => h('span.texto-fuerte.numero', { style: { color: r.tipo === 'Ingreso' ? 'var(--avx-exito)' : 'var(--texto)' } }, (r.tipo === 'Egreso' ? '−' : '+') + dinero(r.monto_con_iva)), meta: r => [fecha(r.fecha), r.categoria, r.real_proyectado === 'Proyectado' ? 'Proyectado' : null] },
  texto: r => [r.concepto, r.categoria, r.referencia, r.uuid_cfdi].join(' '),
  filtros: [{ t: 'Ingresos', f: r => r.tipo === 'Ingreso' }, { t: 'Egresos', f: r => r.tipo === 'Egreso' }, { t: 'Proyectados', f: r => r.real_proyectado === 'Proyectado' }, { t: 'Por facturar', f: r => r.estatus_factura === 'Por facturar' }],
  orden: (a, b) => String(b.fecha).localeCompare(String(a.fecha)),
  tituloDe: r => r.concepto || 'Movimiento', subDe: r => `${r.tipo} · ${fecha(r.fecha)} · ${dinero(r.monto_con_iva)}`, estatusDe: r => r.estatus_aprobacion,
  extrasDetalle: async (r, cuerpo) => { cuerpo.append(h('p', 'Comprobante: ', r.comprobante_url ? enlace(r.comprobante_url, 'Abrir en Drive') : ((r._archivosPendientes || []).length ? 'por subir' : 'sin comprobante'))); }
};

// ---------- Inversión inicial (control demostrativo: no entra a caja, P&L ni flujo) ----------
const CATEGORIAS_INVERSION = ['Equipo y drones', 'Local y mobiliario', 'Trámites y legales', 'Marca y lanzamiento', 'Agroquímicos y equipo de mezcla'];
const opPagadoPor = () => [{ v: 'Empresa', l: 'Empresa (caja de Aerovantix)' }].concat(opUsuarios(['Dirección', 'Socio']).map(u => ({ v: 'Aportación de ' + u.l, l: 'Aportación de ' + u.l })));
let fotoComprobanteInv = null;
export const cfgInversion = {
  tabla: 'InversionInicial', ruta: 'inversion', titulo: 'Inversión inicial', singular: 'partida de inversión', singularMayus: 'Partida de inversión', femenino: true, icono: 'caja',
  textoNuevo: 'Nueva inversión',
  nuevo: () => ({ fecha: hoyIso(), estatus: 'Realizada', pagado_por: 'Empresa' }),
  campos: () => [
    { c: 'estatus', l: 'Estatus', t: 'opciones', op: ['Realizada', 'Por realizar', 'Cancelada'], req: true, ancho: 'medio', ayuda: 'Cancelada se conserva pero no suma.' },
    { c: 'fecha', l: 'Fecha (real o estimada)', t: 'fecha', ancho: 'medio', validar: (v, o) => (o.estatus === 'Realizada' && !v ? 'Capture la fecha en que se realizó.' : '') },
    { c: 'categoria', l: 'Categoría', t: 'opciones', op: CATEGORIAS_INVERSION, req: true, ancho: 'medio' },
    { c: 'concepto', l: 'Concepto', t: 'texto', req: true, ancho: 'medio', ph: 'Ej. mezclador de 200 L y mangueras' },
    { c: 'monto_con_iva', l: 'Monto con IVA', t: 'dinero', req: true, min: 0, ancho: 'medio', validar: v => (v !== '' && !(Number(v) > 0) ? 'El monto debe ser mayor que cero.' : '') },
    { c: 'iva', l: 'IVA incluido', t: 'dinero', min: 0, ancho: 'medio', ayuda: 'Vacío si no causa IVA.', validar: (v, o) => (Number(v) > Number(o.monto_con_iva) ? 'El IVA no puede ser mayor que el monto.' : '') },
    { c: 'proveedor', l: 'Proveedor', t: 'texto', ancho: 'medio', lista: 'proveedores-inversion' },
    { c: 'pagado_por', l: 'Pagado por', t: 'opciones', op: opPagadoPor, ancho: 'medio', ayuda: 'Empresa o aportación directa de un socio.' },
    { c: 'notas', l: 'Notas', t: 'area', filas: 2 }
  ],
  calculados: [{ c: 'monto_sin_iva', l: 'Monto sin IVA', t: 'dinero' }],
  extrasForm: (f, cuerpo) => {
    const dl = h('datalist', { id: 'proveedores-inversion' }, cat('Proveedores').map(x => h('option', { value: x.nombre })));
    fotoComprobanteInv = selectorFotos('Foto del comprobante');
    cuerpo.querySelector('form').append(dl, fotoComprobanteInv.el);
  },
  despuesDeGuardar: async g => {
    const fotos = fotoComprobanteInv ? fotoComprobanteInv.fotos() : [];
    if (fotos.length) await datos.adjuntar('InversionInicial', g.id, 'comprobante_url', fotos[0], 'Comprobante.jpg', { resumen: 'Comprobante de ' + (g.concepto || 'inversión') });
    ir('inversion/' + g.id, { reemplazar: true });
  },
  columnas: [
    { l: 'Fecha', v: r => fecha(r.fecha) }, { l: 'Concepto', v: r => h('span', h('strong', r.concepto), h('span.sub', r.categoria || '')) },
    { l: 'Monto con IVA', v: r => h('span', { style: r.estatus === 'Cancelada' ? { textDecoration: 'line-through', color: 'var(--texto-suave)' } : null }, dinero(r.monto_con_iva)), num: true },
    { l: 'Pagado por', v: r => r.pagado_por || '—' }, { l: 'Estatus', v: r => chip(r.estatus) }
  ],
  movil: { titulo: r => r.concepto, chip: r => chip(r.estatus), meta: r => [dinero(r.monto_con_iva), r.categoria, r.fecha ? fecha(r.fecha) : null] },
  texto: r => [r.concepto, r.categoria, r.proveedor, r.pagado_por, r.notas].join(' '),
  filtros: [{ t: 'Realizadas', f: r => r.estatus === 'Realizada' }, { t: 'Por realizar', f: r => r.estatus === 'Por realizar' }, { t: 'Canceladas', f: r => r.estatus === 'Cancelada' }],
  orden: (a, b) => (a.estatus === 'Cancelada') - (b.estatus === 'Cancelada') || String(b.fecha || '').localeCompare(String(a.fecha || '')),
  vacio: { t: 'Aún no hay inversión registrada', d: 'Registre lo que ya se invirtió y lo que falta por invertir para arrancar la operación.' },
  tituloDe: r => r.concepto || 'Inversión', subDe: r => `${r.categoria || ''} · ${dinero(r.monto_con_iva)}`, estatusDe: r => r.estatus,
  extrasDetalle: async (r, cuerpo) => { cuerpo.append(h('p', 'Comprobante: ', r.comprobante_url ? enlace(r.comprobante_url, 'Abrir en Drive') : ((r._archivosPendientes || []).length ? 'por subir' : 'sin comprobante'))); }
};

/** Resumen + lista. Los totales se calculan aquí con los registros; nada se envía a caja ni a Finanzas. */
export async function renderInversion(zona) {
  vaciar(zona).append(esqueleto(3));
  let regs, desdeCache;
  try { ({ registros: regs, desdeCache } = await datos.listar('InversionInicial')); } catch (e) { vaciar(zona).append(alerta('error', 'No se pudo cargar la inversión inicial', errorTexto(e))); return; }
  vaciar(zona);
  const av = avisoCache(desdeCache); if (av) zona.append(av);
  zona.append(alerta('info', 'Solo control de la inversión inicial', 'Estas partidas no se suman a la caja, al estado de resultados ni al flujo de efectivo.'));
  const vivos = regs.filter(r => r.estatus !== 'Cancelada');
  const suma = (lista, campo = 'monto_con_iva') => lista.reduce((t, r) => t + (Number(r[campo]) || 0), 0);
  const real = vivos.filter(r => r.estatus === 'Realizada'), pend = vivos.filter(r => r.estatus === 'Por realizar');
  const total = suma(vivos);
  zona.append(h('div.rejilla.rejilla--kpi',
    kpi('Invertido', dinero(suma(real)), `${real.length} partida(s) · ${dinero(suma(real, 'monto_sin_iva'))} sin IVA`),
    kpi('Por invertir', dinero(suma(pend)), `${pend.length} partida(s) · ${dinero(suma(pend, 'monto_sin_iva'))} sin IVA`),
    kpi('Inversión total', dinero(total), total ? `${Math.round(suma(real) / total * 100)} % ya realizado` : 'Montos con IVA')));
  if (vivos.length) {
    const fila = (nombre, lista) => { const r = suma(lista.filter(x => x.estatus === 'Realizada')), p = suma(lista.filter(x => x.estatus === 'Por realizar')); return [nombre, r, p, r + p]; };
    const tabla = (titulo, encabezado, filas) => h('section.pila', h('h2.titulo-seccion', titulo),
      h('div.tabla-contenedor', h('table.tabla.tabla--compacta',
        h('thead', h('tr', [encabezado, 'Invertido', 'Por invertir', 'Total', '% del total'].map((x, i) => h('th', { class: i ? 'num' : null, scope: 'col' }, x)))),
        h('tbody', filas.map(f => h('tr', h('td', f[0]), [f[1], f[2], f[3]].map(x => h('td.num', dinero(x))), h('td.num', pct(total ? f[3] / total : 0)))),
          h('tr.fila-total', h('td', 'Total'), h('td.num', dinero(suma(real))), h('td.num', dinero(suma(pend))), h('td.num', dinero(total)), h('td.num', pct(1)))))));
    const cats = CATEGORIAS_INVERSION.map(c => fila(c, vivos.filter(r => r.categoria === c))).filter(f => f[3]);
    const quienes = [...new Set(vivos.map(r => r.pagado_por || 'Sin especificar'))].map(q => fila(q, vivos.filter(r => (r.pagado_por || 'Sin especificar') === q))).sort((a, b) => b[3] - a[3]);
    zona.append(tabla('Por categoría', 'Categoría', cats), tabla('Quién la pagó', 'Origen del dinero', quienes));
  }
  const lista = h('div'); zona.append(h('section.pila', h('h2.titulo-seccion', 'Partidas'), lista));
  await renderLista(lista, cfgInversion, { sinBoton: true });
}

// ---------- Finanzas (vista de la Ficha) ----------
export async function renderFinanzas(zona) {
  vaciar(zona).append(esqueleto(3));
  let v;
  try { v = await datos.vista('Finanzas'); } catch (e) { vaciar(zona).append(alerta('error', 'No se pudo cargar Finanzas', errorTexto(e))); return; }
  const C = v.celdas; // A4:N59 → fila 4 = índice 0
  const fila = n => C[n - 4] || [];
  const meses = fila(4).slice(1, 13);
  const serie = n => fila(n).slice(1, 13).map(valorVista);
  vaciar(zona);
  const av = avisoCache(v.desdeCache); if (av) zona.append(av);
  const ingresos = serie(13), costo = serie(19), gastos = serie(32), util = serie(33);
  zona.append(h('div.rejilla--2',
    h('section.tarjeta.pila', h('h2.titulo-tarjeta', 'Ingresos, costo y gastos por mes'), h('p.texto-sm.texto-suave', 'MXN sin IVA, según la base del P&L de Parámetros.'),
      barras('Ingresos, costo de ventas y gastos operativos por mes', meses.map(m => m.replace(/ 20(\d\d)$/, " '$1")), [{ nombre: 'Ingresos', valores: ingresos }, { nombre: 'Costo de ventas', valores: costo, color: '#5B5C5C' }, { nombre: 'Gastos operativos', valores: gastos, color: '#DB0513' }])),
    h('section.tarjeta.pila', h('h2.titulo-tarjeta', 'Flujo de caja a 13 semanas'), h('p.texto-sm.texto-suave', 'Saldo final por semana con movimientos reales y proyectados (con IVA). La línea roja es el colchón mínimo.'),
      linea('Saldo final de caja por semana', fila(52).slice(1, 14), [{ nombre: 'Saldo final', valores: fila(57).slice(1, 14).map(valorVista) }], { referencia: { nombre: 'Colchón mínimo', valores: fila(58).slice(1, 14).map(valorVista) } }))));
  // Punto de equilibrio
  const pe = n => (fila(n)[1] || '—');
  zona.append(h('div.rejilla',
    kpi('Ingresos del mes', pe(42), fila(41)[1] || ''), kpi('Costos fijos del mes', pe(44), 'Gastos operativos'),
    kpi('Ingresos de equilibrio', pe(46), 'Margen de contribución ' + pe(45)), kpi('Avance contra el equilibrio', pe(47), 'Faltan ' + pe(48))));
  // Estado de resultados
  const filasPL = [];
  for (let n = 5; n <= 38; n++) { const f = fila(n); if (f.length) filasPL.push(f); }
  zona.append(h('section.pila', h('h2.titulo-seccion', 'Estado de resultados'),
    h('div.tabla-contenedor', h('table.tabla.tabla--compacta', h('thead', h('tr', fila(4).map((x, i) => h('th', { class: i ? 'num' : null, scope: 'col' }, i ? x : 'Concepto')))),
      h('tbody', filasPL.map(f => {
        const encabezado = f.length === 1 || f.slice(1).every(x => x === '');
        const total = /^(Total|Utilidad|Margen)/.test(f[0]);
        return h('tr', { class: encabezado ? 'fila-grupo' : (total ? 'fila-total' : null) }, encabezado ? h('td', { colspan: 14 }, f[0]) : f.map((x, i) => h('td', { class: i ? 'num' : null }, x)));
      }))))));
  zona.append(h('section.pila', h('h2.titulo-seccion', 'Flujo semanal'),
    h('div.tabla-contenedor', h('table.tabla.tabla--compacta', h('thead', h('tr', fila(52).map((x, i) => h('th', { class: i ? 'num' : null }, x)))),
      h('tbody', [53, 54, 55, 56, 57, 58, 59].map(n => h('tr', { class: n === 57 ? 'fila-total' : null }, fila(n).map((x, i) => h('td', { class: i ? 'num' : null }, n === 59 && i ? chip(x === 'OK' ? 'OK' : 'Atención') : x)))))))));
}
function kpi(nombre, valor, contexto) { return h('div.kpi', h('div.kpi__nombre', nombre), h('div.kpi__valor.cifra', { style: { fontSize: 'var(--t-xl)' } }, valor), contexto ? h('div.kpi__contexto', contexto) : null); }

async function pantallaCaja(c, p, q) {
  const tab = q.vista || 'movimientos';
  const cuerpo = pantalla(c, { titulo: 'Caja y finanzas', acciones: [tab === 'movimientos' ? botonNuevo(cfgMovimientos) : (tab === 'inversion' ? botonNuevo(cfgInversion) : null)] });
  const zona = h('div.pila--6');
  cuerpo.append(pestanas([{ id: 'movimientos', t: 'Movimientos' }, puede('Finanzas') && { id: 'finanzas', t: 'Finanzas' }, puede('InversionInicial') && { id: 'inversion', t: 'Inversión' }], tab,
    v => { history.replaceState(null, '', '#/caja?vista=' + v); pantallaCaja(c, p, { vista: v }); }), zona);
  if (tab === 'finanzas') return renderFinanzas(zona);
  if (tab === 'inversion') return renderInversion(zona);
  await renderLista(zona, cfgMovimientos, { sinBoton: true });
}

async function pantallaFinanzas(c, p, q = {}) {
  const tab = q.vista === 'inversion' && puede('InversionInicial') ? 'inversion' : 'finanzas';
  const cuerpo = pantalla(c, { titulo: 'Finanzas', sub: 'Estado de resultados, punto de equilibrio, flujo de caja e inversión inicial (solo lectura).' });
  const z = h('div.pila--6');
  if (puede('InversionInicial')) cuerpo.append(pestanas([{ id: 'finanzas', t: 'Finanzas' }, { id: 'inversion', t: 'Inversión inicial' }], tab,
    v => { history.replaceState(null, '', '#/finanzas?vista=' + v); pantallaFinanzas(c, p, { vista: v }); }));
  cuerpo.append(z);
  if (tab === 'inversion') return renderInversion(z);
  await renderFinanzas(z);
}

// ---------- Nómina ----------
const cfgNomina = {
  tabla: 'NominaCaptura', ruta: 'nominacaptura', titulo: 'Captura de nómina', singular: 'captura', singularMayus: 'Captura', femenino: true, icono: 'nomina',
  nuevo: () => ({ periodo: hoyIso().slice(0, 7) }),
  campos: () => [
    { c: 'periodo', l: 'Periodo', t: 'texto', req: true, ancho: 'medio', ph: 'AAAA-MM o quincena', ayuda: 'p. ej. 2026-10 o 2026-10 Q2' },
    { c: 'empleado', l: 'Empleado', t: 'opciones', op: () => opUsuarios(['Dirección', 'Agronomía', 'Técnico', 'Piloto', 'Personal']), req: true, ancho: 'medio' },
    { c: 'dias_trabajados', l: 'Días trabajados', t: 'numero', min: 0, max: 31, ancho: 'medio' }, { c: 'faltas', l: 'Faltas', t: 'numero', min: 0, ancho: 'medio' },
    { c: 'horas_extra', l: 'Horas extra', t: 'numero', suf: 'h', min: 0, ancho: 'medio' }, { c: 'percepciones_adicionales', l: 'Percepciones adicionales', t: 'dinero', ancho: 'medio' },
    { c: 'incidencias', l: 'Incidencias', t: 'area', filas: 2 }
  ],
  columnas: [{ l: 'Periodo', v: r => r.periodo }, { l: 'Empleado', v: r => h('strong', nombreUsuario(r.empleado)) }, { l: 'Días', v: r => numero(r.dias_trabajados), num: true }, { l: 'Faltas', v: r => numero(r.faltas), num: true }, { l: 'Horas extra', v: r => numero(r.horas_extra), num: true }, { l: 'Adicionales', v: r => dinero(r.percepciones_adicionales), num: true }],
  movil: { titulo: r => nombreUsuario(r.empleado), chip: r => h('span.texto-sm', r.periodo), meta: r => [`${numero(r.dias_trabajados)} días`, r.faltas ? `${numero(r.faltas)} faltas` : null] },
  texto: r => [r.periodo, nombreUsuario(r.empleado), r.incidencias].join(' '),
  orden: (a, b) => String(b.periodo).localeCompare(String(a.periodo)), tituloDe: r => nombreUsuario(r.empleado), subDe: r => 'Periodo ' + r.periodo
};

async function pantallaNomina(c, p, q) {
  const tab = q.vista || 'captura';
  const cuerpo = pantalla(c, { titulo: 'Nómina', sub: 'Estimación mensual con las tarifas de Parámetros. No sustituye la prenómina del contador.', acciones: [tab === 'captura' ? botonNuevo(cfgNomina) : null] });
  const zona = h('div.pila');
  cuerpo.append(pestanas([{ id: 'captura', t: 'Captura' }, puede('Nomina') && { id: 'calculo', t: 'Cálculo mensual' }], tab,
    v => { history.replaceState(null, '', '#/nomina?vista=' + v); pantallaNomina(c, p, { vista: v }); }), zona);
  if (tab === 'captura') return renderLista(zona, cfgNomina, { sinBoton: true });
  zona.append(esqueleto(3));
  try {
    const v = await datos.vista('Nomina');
    vaciar(zona); const av = avisoCache(v.desdeCache); if (av) zona.append(av);
    zona.append(h('p.texto-sm.texto-suave', 'Los sueldos y fechas de ingreso se capturan en Usuarios. ISR, cuotas IMSS, Infonavit y subsidio al empleo se calculan en la pestaña Nómina de la Ficha.'));
    // Solo las columnas de persona con nombre (la Ficha tiene 10), más concepto y total.
    const nombres = v.celdas.find(f => String(f[0]) === 'Nombre') || [];
    const ancho = v.celdas[0].length;
    const cols = v.celdas[0].map((_, i) => i).filter(i => i === 0 || i === ancho - 1 || String(nombres[i] || '') !== '');
    const tomar = f => cols.map(i => f[i] === undefined ? '' : f[i]);
    zona.append(h('div.tabla-contenedor', h('table.tabla.tabla--compacta', h('thead', h('tr', tomar(v.celdas[0]).map((x, i) => h('th', { class: i ? 'num' : null }, x)))),
      h('tbody', v.celdas.slice(1).map(f0 => { const f = tomar(f0); const g = f.slice(1).every(x => x === ''); return h('tr', { class: g ? 'fila-grupo' : (/^(Total|Neto|Costo total)/.test(f[0]) ? 'fila-total' : null) }, g ? h('td', { colspan: cols.length }, f[0]) : f.map((x, i) => h('td', { class: i ? 'num' : null }, x))); })))));
  } catch (e) { vaciar(zona).append(alerta('error', 'No se pudo cargar el cálculo', errorTexto(e))); }
}

// ---------- Plan semanal y cierre ----------
const AREAS = ['Ventas', 'Operación', 'Compras', 'Finanzas', 'Marketing', 'Equipo', 'Procesos'];
const cfgPlan = {
  tabla: 'PlanSemanal', ruta: 'planes', titulo: 'Plan semanal', singular: 'compromiso', singularMayus: 'Compromiso', icono: 'plan',
  nuevo: () => ({ semana: lunesIso(), responsable: usuario(), estatus: 'Pendiente' }),
  campos: () => [
    { c: 'semana', l: 'Semana (lunes)', t: 'fecha', req: true, ancho: 'medio', ayuda: 'Se ajusta al lunes de esa semana.' },
    { c: 'area', l: 'Área', t: 'opciones', op: AREAS, req: true, ancho: 'medio' },
    { c: 'tarea', l: 'Compromiso', t: 'area', req: true, filas: 2 },
    esDir() ? { c: 'responsable', l: 'Responsable', t: 'opciones', op: () => opUsuarios(), req: true, ancho: 'medio' } : null,
    { c: 'fecha_compromiso', l: 'Fecha compromiso', t: 'fecha', ancho: 'medio' },
    { c: 'estatus', l: 'Estatus', t: 'opciones', op: ['Pendiente', 'En proceso', 'Hecho', 'Bloqueado'], ancho: 'medio' }
  ],
  antesDeGuardar: reg => { if (reg.semana) reg.semana = lunesIso(reg.semana); return reg; },
  despuesDeGuardar: async g => ir('plan', { reemplazar: true }),
  columnas: [], movil: {}, tituloDe: r => r.tarea, subDe: r => `${r.area} · semana del ${fecha(r.semana)}`
};

async function pantallaPlan(c, p, q) {
  const tab = q.vista || 'plan';
  const sem = q.semana || lunesIso();
  const cuerpo = pantalla(c, { titulo: 'Plan semanal y cierre', sub: 'Lunes: plan de la semana. Viernes: cierre, decisiones y KPIs.',
    acciones: [tab === 'plan' && puede('PlanSemanal', 'escribir') ? boton('Nuevo compromiso', { ic: 'mas', href: '#/planes/nuevo?semana=' + sem }) : null] });
  const zona = h('div.pila');
  cuerpo.append(pestanas([{ id: 'plan', t: 'Plan de la semana' }, puede('CierreSemanal') && { id: 'cierre', t: 'Cierre semanal' }], tab,
    v => { history.replaceState(null, '', '#/plan?vista=' + v); pantallaPlan(c, p, { vista: v }); }), zona);
  if (tab === 'cierre') return renderCierre(zona);
  const nav = h('div.fila.navegador-semana',
    boton('Semana anterior', { tipo: 'fantasma', ic: 'izquierda', chico: true, href: `#/plan?semana=${sumarDiasIso(sem, -7)}` }),
    h('strong', `Semana del ${fecha(sem)} al ${fecha(sumarDiasIso(sem, 6))}`),
    boton('Semana siguiente', { tipo: 'fantasma', chico: true, href: `#/plan?semana=${sumarDiasIso(sem, 7)}` }));
  zona.append(nav, esqueleto(2));
  let regs, desdeCache;
  try { ({ registros: regs, desdeCache } = await datos.listar('PlanSemanal')); } catch (e) { zona.lastChild.remove(); zona.append(alerta('error', 'No se pudo cargar el plan', errorTexto(e))); return; }
  zona.lastChild.remove();
  const av = avisoCache(desdeCache); if (av) zona.append(av);
  const deSemana = regs.filter(r => String(r.semana).slice(0, 10) === sem);
  const hechos = deSemana.filter(r => r.estatus === 'Hecho').length;
  zona.append(h('div.kpi', h('div.kpi__nombre', 'Cumplimiento de la semana'), h('div.kpi__valor.cifra', { style: { fontSize: 'var(--t-xl)' } }, deSemana.length ? pct(hechos / deSemana.length) : '—'),
    h('div.barra-progreso', h('span', { style: { width: (deSemana.length ? hechos / deSemana.length * 100 : 0) + '%' } })), h('div.kpi__contexto', `${hechos} de ${deSemana.length} compromisos hechos`)));
  if (!deSemana.length) { zona.append(h('div.vacio', h('span.vacio__icono', icono('plan', 32)), h('span.vacio__titulo', 'Sin compromisos para esta semana'), h('p', 'Capture el plan del lunes: prioridades de ventas, contenido y compras.'), puede('PlanSemanal', 'escribir') ? boton('Nuevo compromiso', { ic: 'mas', href: '#/planes/nuevo?semana=' + sem }) : null)); return; }
  AREAS.concat(['Otro']).forEach(a => {
    const items = deSemana.filter(r => (AREAS.includes(r.area) ? r.area : 'Otro') === a);
    if (!items.length) return;
    zona.append(h('section.pila', { style: { gap: '8px' } }, h('h2.titulo-tarjeta', a), items.map(r => {
      const sel = h('select.selector.selector--compacto', { 'aria-label': 'Estatus de ' + r.tarea, disabled: !puede('PlanSemanal', 'escribir') || null }, ['Pendiente', 'En proceso', 'Hecho', 'Bloqueado'].map(x => h('option', { value: x }, x)));
      sel.value = r.estatus || 'Pendiente';
      sel.addEventListener('change', async () => { await datos.cambiarEstatus('PlanSemanal', r.id, sel.value, null, { resumen: 'Plan: ' + r.tarea }); toast('Estatus actualizado' + (navigator.onLine ? '' : ' · se subirá al haber señal')); });
      return h('div.registro.registro--plan', h('a.registro__titulo', { href: '#/planes/' + r.id }, r.tarea), h('span.registro__estado', r._pendiente ? chipPendiente() : chip(r.estatus || 'Pendiente')),
        h('span.registro__meta', h('span', nombreUsuario(r.responsable)), r.fecha_compromiso ? h('span', 'Para el ' + fecha(r.fecha_compromiso)) : null), h('span.registro__accion', sel));
    })));
  });
}

async function renderCierre(zona) {
  zona.append(esqueleto(3));
  let v;
  try { v = await datos.vista('CierreSemanal'); } catch (e) { vaciar(zona).append(alerta('error', 'No se pudo cargar el cierre', errorTexto(e))); return; }
  vaciar(zona);
  const av = avisoCache(v.desdeCache); if (av) zona.append(av);
  const enc = v.celdas[0], filas = v.celdas.slice(1).filter(f => f[0]);
  const lunes = lunesIso();
  const aIso = s => { const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s || ''); return m ? `${m[3]}-${m[2]}-${m[1]}` : ''; };
  const actual = filas.find(f => aIso(f[0]) === lunes) || filas[filas.length - 1];
  if (actual && esDir()) {
    const f = formulario([
      { c: 'meta', l: 'Meta de ventas de la semana (sin IVA)', t: 'dinero', ancho: 'medio' },
      { c: 'realizado', l: 'Cierre realizado', t: 'bool' },
      { c: 'riesgos', l: 'Riesgos y bloqueos', t: 'area', filas: 3 }
    ], { meta: valorVista2(actual[2]), riesgos: actual[15], realizado: actual[16] === 'Sí' });
    const guardar = boton('Guardar cierre', { ic: 'check' });
    guardar.addEventListener('click', async () => {
      if (!navigator.onLine) return toast('El cierre se guarda con conexión.', 'info');
      guardar.disabled = true;
      try { await datos.enLinea('guardar', { tabla: 'CierreSemanal', registro: Object.assign({ semana: aIso(actual[0]) }, f.leer()) }); toast('Cierre guardado'); renderCierre(vaciar(zona)); }
      catch (e) { toast(errorTexto(e), 'error'); guardar.disabled = false; }
    });
    zona.append(h('section.tarjeta.pila', h('h2.titulo-tarjeta', `Cierre de la semana del ${actual[0]} al ${actual[1]}`),
      h('div.rejilla', [[3, 'Ventas ganadas'], [4, '% de la meta'], [7, 'Ingresos cobrados'], [8, 'Egresos pagados'], [9, 'Saldo de caja'], [13, 'Cumplimiento del plan']].map(([i, t]) => h('div.panel-datos', h('div.kpi__nombre', t), h('div.titulo-tarjeta', actual[i] || '—')))),
      f.el, h('div.fila', guardar)));
  }
  zona.append(h('section.pila', h('h2.titulo-seccion', 'Historial de cierres'), h('div.tabla-contenedor', h('table.tabla.tabla--compacta', h('thead', h('tr', enc.map((x, i) => h('th', { class: i > 1 && i < 15 ? 'num' : null }, x)))),
    h('tbody', filas.map(f => h('tr', { 'aria-selected': f === actual ? 'true' : null }, f.map((x, i) => h('td', { class: i > 1 && i < 15 ? 'num' : null }, i === 16 ? chip(x || 'No') : x)))))))));
}
const valorVista2 = s => { const t = String(s || '').replace(/[$,\s]/g, ''); return t && !isNaN(Number(t)) ? Number(t) : ''; };

// ---------- Decisiones ----------
const cfgDecisiones = {
  tabla: 'Decisiones', ruta: 'decisiones', titulo: 'Decisiones', singular: 'decisión', singularMayus: 'Decisión', femenino: true, icono: 'decision', botonEnLista: true,
  nuevo: () => ({ fecha: hoyIso(), responsable: usuario() }),
  campos: () => [
    { c: 'fecha', l: 'Fecha', t: 'fecha', req: true, ancho: 'medio' }, { c: 'responsable', l: 'Responsable', t: 'opciones', op: () => opUsuarios(), ancho: 'medio' },
    { c: 'decision', l: 'Decisión', t: 'area', req: true, filas: 2 }, { c: 'contexto', l: 'Contexto', t: 'area', filas: 3 },
    { c: 'opciones', l: 'Opciones consideradas', t: 'area', filas: 3 }, { c: 'fecha_revision', l: 'Fecha de revisión', t: 'fecha', ancho: 'medio' }
  ],
  columnas: [{ l: 'Fecha', v: r => fecha(r.fecha) }, { l: 'Decisión', v: r => h('strong', r.decision) }, { l: 'Responsable', v: r => nombreUsuario(r.responsable) || r.responsable || '—' }, { l: 'Revisión', v: r => fecha(r.fecha_revision) }],
  movil: { titulo: r => r.decision, chip: r => h('span.texto-sm', fecha(r.fecha)), meta: r => [nombreUsuario(r.responsable) || r.responsable, r.fecha_revision ? 'Revisar ' + fecha(r.fecha_revision) : null] },
  texto: r => [r.decision, r.contexto, r.opciones].join(' '), orden: (a, b) => String(b.fecha).localeCompare(String(a.fecha)),
  tituloDe: r => r.decision, subDe: r => fecha(r.fecha)
};

export const rutas = [
  { p: 'caja', r: pantallaCaja }, ...rutasCrud(cfgMovimientos), ...rutasCrud(cfgInversion).filter(x => x.p !== 'inversion'),
  { p: 'inversion', r: (c, p, q) => (puede('Movimientos') ? pantallaCaja : pantallaFinanzas)(c, p, Object.assign({}, q, { vista: 'inversion' })) },
  { p: 'finanzas', r: pantallaFinanzas },
  { p: 'nomina', r: pantallaNomina }, ...rutasCrud(cfgNomina),
  { p: 'plan', r: pantallaPlan }, ...rutasCrud(cfgPlan).filter(x => x.p !== 'planes'),
  ...rutasCrud(cfgDecisiones)
];
