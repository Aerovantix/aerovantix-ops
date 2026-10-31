// Inicio por rol (Dirección: Panel de KPIs con gráficas, cola de aprobaciones y alertas), Aprobaciones y Avisos.
import { h, icono, vaciar, toast, dinero, pct, numero, chip, boton, alerta, esqueleto, errorTexto, fecha, fechaHora, json, vacioV, num, hoyIso, sumarDiasIso, lunesIso, tono } from '../ui.js';
import { pantalla, listado, avisoCache, pestanas } from '../vistas.js';
import { formulario } from '../forms.js';
import * as datos from '../datos.js';
import { est, esDir, puede, cat, rol, usuario, nombreUsuario } from '../estado.js';
import { bus } from '../api.js';
import { ir } from '../router.js';
import { barras, linea, valorVista } from '../graficas.js';
import { nombreCliente } from './comunes.js';
import { abrirVistaPrevia } from './cotizaciones.js';

const saludo = () => { const hh = new Date().getHours(); return hh < 12 ? 'Buenos días' : hh < 19 ? 'Buenas tardes' : 'Buenas noches'; };
const primerNombre = () => String(est.perfil?.nombre || '').split(' ')[0];
const ABIERTAS = ['Programada', 'Pendiente de aprobación', 'Confirmada', 'En ejecución', 'Pausada'];

async function seguro(fn, defecto) { try { return await fn(); } catch (e) { return defecto; } }

// ---------- Panel de KPIs ----------
function claseSemaforo(s) {
  const t = String(s || '').toLowerCase();
  if (t.startsWith('verde')) return 'verde';
  if (t.startsWith('ámbar') || t.startsWith('amarillo') || t.startsWith('ambar')) return 'ambar';
  if (t.startsWith('rojo')) return 'rojo';
  return '';
}
async function renderPanel(zona) {
  zona.append(esqueleto(2));
  let v;
  try { v = await datos.vista('Panel'); } catch (e) { vaciar(zona).append(alerta('error', 'No se pudo cargar el Panel', errorTexto(e))); return null; }
  vaciar(zona);
  const av = avisoCache(v.desdeCache); if (av) zona.append(av);
  const C = v.celdas;
  let grupo = null;
  const grupos = [];
  C.slice(4).forEach(f => {
    if (!f || !f[0]) return;
    if (f.length === 1 || f.slice(1).every(x => x === '')) { grupo = { t: f[0], items: [] }; grupos.push(grupo); return; }
    if (grupo) grupo.items.push(f);
  });
  grupos.forEach(g => {
    zona.append(h('section.pila', { style: { gap: '12px' } }, h('h2.titulo-tarjeta', g.t), h('div.rejilla.rejilla--kpi', g.items.map(([nombre, valor, meta, sem, frec, def]) => {
      const c = claseSemaforo(sem);
      return h('div.kpi' + (c ? '.kpi--' + c : ''), { title: def || '' },
        h('div.kpi__nombre', nombre), h('div.kpi__valor.cifra', { style: { fontSize: String(valor).length > 14 ? 'var(--t-lg)' : 'var(--t-2xl)' } }, valor || '—'),
        h('div.kpi__contexto', h('span.kpi__estado', icono(c === 'verde' ? 'exito' : c === 'rojo' ? 'alerta' : c === 'ambar' ? 'reloj' : 'info', 16), sem || '—'), meta ? 'Meta ' + meta : (frec || '')));
    }))));
  });
  return { semana: C[0] && C[0][1], cierre: C[0] && C[0][3] };
}

async function renderGraficas(zona) {
  let v;
  try { v = await datos.vista('Finanzas'); } catch (e) { return; }
  const C = v.celdas, fila = n => C[n - 4] || [];
  const meses = fila(4).slice(1, 13).map(m => m.replace(/ 20(\d\d)$/, " '$1"));
  zona.append(h('div.rejilla--2',
    h('section.tarjeta.pila', h('h2.titulo-tarjeta', 'Ingresos y gastos por mes'), h('p.texto-sm.texto-suave', 'MXN sin IVA'),
      barras('Ingresos y gastos por mes', meses, [{ nombre: 'Ingresos', valores: fila(13).slice(1, 13).map(valorVista) }, { nombre: 'Costo y gastos', valores: fila(19).slice(1, 13).map((x, i) => valorVista(x) + valorVista(fila(32)[i + 1])), color: '#DB0513' }])),
    h('section.tarjeta.pila', h('h2.titulo-tarjeta', 'Saldo de caja a 13 semanas'), h('p.texto-sm.texto-suave', 'Con IVA; incluye movimientos proyectados. Línea roja: colchón mínimo.'),
      linea('Saldo de caja proyectado', fila(52).slice(1, 14), [{ nombre: 'Saldo final', valores: fila(57).slice(1, 14).map(valorVista) }], { referencia: { nombre: 'Colchón mínimo', valores: fila(58).slice(1, 14).map(valorVista) } }))));
}

// ---------- Alertas operativas (desde catálogos y listas en caché) ----------
async function alertas() {
  const hoy = hoyIso(), en3 = sumarDiasIso(hoy, 3), manana = sumarDiasIso(hoy, 1);
  const out = [];
  if (esDir()) {
    const sol = (await seguro(() => datos.listar('Solicitudes'), { registros: [] })).registros.filter(r => ['Recibida', 'En revisión'].includes(r.estatus));
    if (sol.length) out.push({ ic: 'aviso', t: `${sol.length} solicitud(es) de clientes por atender`, d: sol.slice(0, 3).map(r => `${r.folio} · ${nombreCliente(r.cliente_id)}`).join(', '), href: '#/solicitudes', tono: 'pendiente' });
  }
  if (puede('Tickets')) {
    const tck = (await seguro(() => datos.listar('Tickets'), { registros: [] })).registros.filter(r => r.estatus === 'Por asignar');
    if (tck.length) out.push({ ic: 'soporte', t: `${tck.length} ticket(s) del portal por asignar`, d: tck.slice(0, 3).map(r => `${r.folio} · ${nombreCliente(r.cliente_id)}`).join(', '), href: '#/soporte', tono: 'pendiente' });
  }
  const mant = cat('Equipos').filter(e => e.alerta_mant === true && e.propiedad !== 'Del cliente');
  if (mant.length) out.push({ ic: 'herramienta', t: `${mant.length} equipo(s) con mantenimiento por realizar`, d: mant.slice(0, 3).map(e => e.serie).join(', '), href: '#/flota?vista=equipos', tono: 'rechazado' });
  const rep = cat('Existencias').filter(e => ['Reponer', 'Sin existencia'].includes(e.estatus_stock));
  if (rep.length) out.push({ ic: 'inventario', t: `${rep.length} SKU en mínimo o sin existencia`, d: rep.slice(0, 3).map(e => e.sku).join(', '), href: '#/inventario', tono: 'pendiente' });
  if (puede('Cotizaciones')) {
    const todas = (await seguro(() => datos.listar('Cotizaciones'), { registros: [] })).registros;
    const resp = todas.filter(r => r.estatus === 'Enviada' && r.respuesta_cliente);
    if (resp.length) out.push({ ic: 'cotizacion', t: `${resp.length} cotización(es) con respuesta del cliente`, d: resp.slice(0, 3).map(r => `${r.folio}: ${r.respuesta_cliente}`).join(', '), href: '#/cotizaciones', tono: 'pendiente' });
    const cot = todas.filter(r => ['Aprobada', 'Enviada'].includes(r.estatus) && r.vigente_hasta && r.vigente_hasta <= en3);
    if (cot.length) out.push({ ic: 'cotizacion', t: `${cot.length} cotización(es) por vencer o vencidas`, d: cot.slice(0, 3).map(r => r.folio).join(', '), href: '#/cotizaciones', tono: 'pendiente' });
  }
  if (puede('Rentas')) {
    const ren = (await seguro(() => datos.listar('Rentas'), { registros: [] })).registros.filter(r => r.estatus === 'Entregada' && r.fin && String(r.fin).slice(0, 10) <= manana);
    if (ren.length) out.push({ ic: 'llave', t: `${ren.length} renta(s) por devolver`, d: ren.slice(0, 3).map(r => r.folio).join(', '), href: '#/rentas', tono: 'pendiente' });
  }
  return out;
}
function listaAlertas(items) {
  if (!items.length) return h('div.panel-datos', h('p', { style: { display: 'flex', gap: '8px', alignItems: 'center' } }, icono('exito'), 'Sin alertas operativas.'));
  return h('div.lista-registros', items.map(a => h('a.registro.registro--alerta', { href: a.href }, h('span.registro__titulo', h('span.fila', { style: { gap: '8px' } }, icono(a.ic, 20), a.t)), h('span.registro__estado', chip(a.tono === 'rechazado' ? 'Atención' : 'Revisar', a.tono)), h('span.registro__meta', h('span', a.d)))));
}

async function colaAprobaciones(limite = 5) {
  const r = await seguro(() => datos.listar('Aprobaciones'), { registros: [] });
  return r.registros.filter(a => a.estatus === 'Pendiente').sort((a, b) => String(b.fecha).localeCompare(String(a.fecha))).slice(0, limite);
}
function filaAprobacion(a) {
  return h('a.registro', { href: '#/aprobaciones/' + a.id }, h('span.registro__titulo', a.tipo), h('span.registro__estado', h('span.texto-fuerte.numero', dinero(a.monto))),
    h('span.registro__meta', h('span', 'Solicita ' + nombreUsuario(a.solicitante)), h('span', fechaHora(a.fecha))));
}

// ---------- Inicio ----------
async function inicio(c) {
  const r = rol();
  const cuerpo = pantalla(c, { titulo: `${saludo()}, ${primerNombre()}`, sub: new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) });
  if (r === 'Dirección' || r === 'Socio') return inicioDireccion(cuerpo, r === 'Dirección');
  if (r === 'Agronomía') return inicioAgronomia(cuerpo);
  return inicioTecnico(cuerpo);
}

async function inicioDireccion(cuerpo, dir) {
  if (dir) {
    const fila = h('div.rejilla--2');
    const zA = h('section.pila', h('div.fila.encabezado-seccion', h('h2.titulo-seccion', 'Aprobaciones pendientes'), boton('Ver todas', { tipo: 'fantasma', chico: true, href: '#/aprobaciones' })));
    const zB = h('section.pila', h('h2.titulo-seccion', 'Alertas'));
    fila.append(zA, zB); cuerpo.append(fila);
    const [aps, als] = await Promise.all([colaAprobaciones(), alertas()]);
    zA.append(aps.length ? h('div.lista-registros', aps.map(filaAprobacion)) : h('div.panel-datos', h('p', { style: { display: 'flex', gap: '8px', alignItems: 'center' } }, icono('exito'), 'No hay nada por aprobar.')));
    zB.append(listaAlertas(als));
  }
  const zP = h('div.pila--6'); cuerpo.append(h('section.pila', h('h2.titulo-seccion', 'Panel de indicadores'), zP));
  const info = await renderPanel(zP);
  if (info && info.semana) zP.prepend(h('p.texto-sm.texto-suave', `Semana del ${info.semana} · cierre de la semana: ${info.cierre || 'No'}`));
  const zG = h('div'); cuerpo.append(zG); await renderGraficas(zG);
}

async function inicioAgronomia(cuerpo) {
  cuerpo.append(h('div.acciones-rapidas', boton('Nuevo cliente', { tipo: 'secundario', ic: 'clientes', href: '#/clientes/nuevo' }), boton('Nueva cotización', { ic: 'cotizacion', href: '#/cotizaciones/nueva' }), boton('Nueva orden de servicio', { tipo: 'secundario', ic: 'orden', href: '#/os/nueva' })));
  const [os, op, cot] = await Promise.all([seguro(() => datos.listar('OrdenesServicio'), { registros: [] }), seguro(() => datos.listar('Oportunidades'), { registros: [] }), seguro(() => datos.listar('Cotizaciones'), { registros: [] })]);
  const activas = os.registros.filter(r => ABIERTAS.includes(r.estatus || 'Programada'));
  const abiertas = op.registros.filter(r => ['Prospecto', 'Cotizado', 'Negociación'].includes(r.etapa));
  const borr = cot.registros.filter(r => ['Borrador', 'Pendiente de aprobación'].includes(r.estatus));
  cuerpo.append(h('div.rejilla.rejilla--kpi',
    kpiEnlace('Órdenes activas', activas.length, '#/os', 'orden'), kpiEnlace('Oportunidades abiertas', abiertas.length, '#/crm?vista=oportunidades', 'clientes', dinero(abiertas.reduce((s, x) => s + num(x.monto), 0)) + ' sin IVA'),
    kpiEnlace('Cotizaciones en curso', borr.length, '#/cotizaciones', 'cotizacion', `${borr.filter(x => x.estatus === 'Pendiente de aprobación').length} por aprobar`)));
  cuerpo.append(h('section.pila', h('h2.titulo-seccion', 'Órdenes de servicio activas'), activas.length ? h('div.lista-registros', activas.slice(0, 6).map(filaOS)) : h('p.texto-suave', 'Sin órdenes activas.')));
  await bloquePlan(cuerpo);
}

async function inicioTecnico(cuerpo) {
  const vacio = { registros: [] };
  const [os, ren, com] = await Promise.all([seguro(() => datos.listar('OrdenesServicio'), vacio), puede('Rentas') ? seguro(() => datos.listar('Rentas'), vacio) : vacio, puede('Compras') ? seguro(() => datos.listar('Compras'), vacio) : vacio]);
  const enCampo = os.registros.filter(r => ['En ejecución', 'Pausada', 'Confirmada'].includes(r.estatus));
  cuerpo.append(h('section.pila', h('h2.titulo-seccion', 'Servicios en campo'),
    enCampo.length ? h('div.pila', enCampo.map(r => h('div.tarjeta.pila',
      h('div.tarjeta__encabezado', h('div', h('div.titulo-tarjeta', `${r.folio || 'OS'} · ${nombreCliente(r.cliente_id)}`), h('div.tarjeta__meta', [r.cultivo, `${numero(r.ha_aplicadas || 0)} de ${numero(r.ha_contratadas)} ha`].filter(Boolean).join(' · '))), chip(r.estatus)),
      h('div.barra-progreso', h('span', { style: { width: Math.min(100, num(r.avance_pct) * 100) + '%' } })),
      h('div.fila', r.estatus === 'Confirmada' ? boton('Abrir orden', { tipo: 'secundario', href: '#/os/' + r.id }) : boton('Capturar etapa', { ic: 'mas', href: `#/os/${r.id}/etapa/nueva` }), boton('Ver orden', { tipo: 'fantasma', href: '#/os/' + r.id }))))) :
      h('div.vacio', h('span.vacio__icono', icono('orden', 32)), h('span.vacio__titulo', 'Sin servicios asignados'), h('p', 'Cuando le asignen una orden de servicio, aparecerá aquí.'))));
  const items = [];
  const porEntregar = ren.registros.filter(r => r.estatus === 'Confirmada'), porDevolver = ren.registros.filter(r => r.estatus === 'Entregada');
  if (porEntregar.length) items.push({ ic: 'llave', t: `${porEntregar.length} renta(s) por entregar`, d: porEntregar.map(r => r.folio).join(', '), href: '#/rentas', tono: 'pendiente' });
  if (porDevolver.length) items.push({ ic: 'llave', t: `${porDevolver.length} renta(s) por recibir de vuelta`, d: porDevolver.map(r => r.folio).join(', '), href: '#/rentas', tono: 'pendiente' });
  const oc = com.registros.filter(r => r.estatus === 'OC');
  if (oc.length) items.push({ ic: 'compras', t: `${oc.length} orden(es) de compra por recibir`, d: oc.map(r => r.folio).join(', '), href: '#/compras', tono: 'pendiente' });
  const mant = cat('Equipos').filter(e => e.alerta_mant === true && e.propiedad !== 'Del cliente');
  if (mant.length) items.push({ ic: 'herramienta', t: `${mant.length} equipo(s) con mantenimiento por realizar`, d: mant.map(e => e.serie).join(', '), href: '#/flota', tono: 'rechazado' });
  cuerpo.append(h('section.pila', h('h2.titulo-seccion', 'Pendientes de operación'), listaAlertas(items)));
  cuerpo.append(h('div.acciones-rapidas', puede('Vuelos', 'escribir') ? boton('Registrar vuelo', { tipo: 'secundario', ic: 'dron', href: '#/vuelos/nuevo' }) : null,
    puede('Mantenimientos', 'escribir') ? boton('Registrar mantenimiento', { tipo: 'secundario', ic: 'herramienta', href: '#/mantenimientos/nuevo' }) : null,
    puede('Tickets', 'escribir') ? boton('Nuevo ticket', { tipo: 'secundario', ic: 'soporte', href: '#/tickets/nuevo' }) : null));
  await bloquePlan(cuerpo);
}

const filaOS = r => h('a.registro', { href: '#/os/' + r.id }, h('span.registro__titulo', `${r.folio || 'OS'} · ${nombreCliente(r.cliente_id)}`), h('span.registro__estado', chip(r.estatus || 'Programada')), h('span.registro__meta', h('span', r.cultivo || ''), h('span', `${numero(r.ha_aplicadas || 0)} de ${numero(r.ha_contratadas)} ha`)));
const kpiEnlace = (t, n, href, ic, ctx) => h('a.kpi.tarjeta--interactiva', { href }, h('div.kpi__nombre', h('span.fila', { style: { gap: '6px' } }, icono(ic, 16), t)), h('div.kpi__valor.cifra', String(n)), ctx ? h('div.kpi__contexto', ctx) : null);

async function bloquePlan(cuerpo) {
  if (!puede('PlanSemanal')) return;
  const sem = lunesIso();
  const p = (await seguro(() => datos.listar('PlanSemanal'), { registros: [] })).registros.filter(x => String(x.semana).slice(0, 10) === sem && x.responsable === usuario());
  cuerpo.append(h('section.pila', h('div.fila.encabezado-seccion', h('h2.titulo-seccion', 'Mi plan de la semana'), boton('Abrir plan', { tipo: 'fantasma', chico: true, href: '#/plan' })),
    p.length ? h('div.lista-registros', p.map(x => h('a.registro', { href: '#/planes/' + x.id }, h('span.registro__titulo', x.tarea), h('span.registro__estado', chip(x.estatus || 'Pendiente')), h('span.registro__meta', h('span', x.area), x.fecha_compromiso ? h('span', 'Para el ' + fecha(x.fecha_compromiso)) : null))))
      : h('p.texto-suave', 'Sin compromisos asignados esta semana.')));
}

// ---------- Aprobaciones ----------
async function listaAprobaciones(c, p, q) {
  const tab = q.vista || 'pendientes';
  const cuerpo = pantalla(c, { titulo: 'Aprobaciones', sub: 'Todo lo que mueve dinero o toca clientes pasa por aquí antes de ejecutarse.' });
  const zona = h('div');
  cuerpo.append(pestanas([{ id: 'pendientes', t: 'Pendientes' }, { id: 'resueltas', t: 'Resueltas' }], tab, v => { history.replaceState(null, '', '#/aprobaciones?vista=' + v); listaAprobaciones(c, p, { vista: v }); }), zona);
  zona.append(esqueleto(3));
  let regs, desdeCache;
  try { ({ registros: regs, desdeCache } = await datos.listar('Aprobaciones')); } catch (e) { vaciar(zona).append(alerta('error', 'No se pudieron cargar', errorTexto(e))); return; }
  vaciar(zona); const av = avisoCache(desdeCache); if (av) zona.append(av);
  const lista = regs.filter(a => (tab === 'pendientes' ? a.estatus === 'Pendiente' : a.estatus !== 'Pendiente'));
  zona.append(listado({
    registros: lista,
    columnas: [{ l: 'Tipo', v: a => h('strong', a.tipo) }, { l: 'Monto', v: a => dinero(a.monto), num: true }, { l: 'Solicita', v: a => nombreUsuario(a.solicitante) }, { l: 'Fecha', v: a => fechaHora(a.fecha) }, { l: 'Estatus', v: a => chip(a.estatus === 'Pendiente' ? 'Pendiente de aprobación' : a.estatus) }, tab === 'resueltas' ? { l: 'Comentario', v: a => a.comentario || '—' } : null].filter(Boolean),
    movil: { titulo: a => a.tipo, chip: a => h('span.texto-fuerte.numero', dinero(a.monto)), meta: a => [nombreUsuario(a.solicitante), fechaHora(a.fecha), tab === 'resueltas' ? a.estatus : null] },
    texto: a => [a.tipo, a.referencia, a.solicitante, a.comentario].join(' '),
    orden: (a, b) => String(b.fecha).localeCompare(String(a.fecha)), href: a => 'aprobaciones/' + a.id,
    vacio: { ic: 'aprobar', t: tab === 'pendientes' ? 'No hay nada por aprobar' : 'Sin aprobaciones resueltas', d: tab === 'pendientes' ? 'Las solicitudes del equipo aparecerán aquí con aviso y correo.' : '' }
  }));
}

async function detalleAprobacion(c, { id }) {
  const cu = pantalla(c, { titulo: 'Aprobación', volver: 'aprobaciones' }); cu.append(esqueleto(3));
  let a, reg = null;
  try { a = (await datos.listar('Aprobaciones')).registros.find(x => x.id === id); } catch (e) { vaciar(cu).append(alerta('error', 'No se pudo abrir', errorTexto(e))); return; }
  if (!a) { vaciar(cu).append(alerta('advertencia', 'Aprobación no encontrada')); return; }
  const [tabla, rid] = String(a.referencia).split(':');
  try { reg = await datos.obtener(tabla, rid); } catch (e) { reg = null; }
  const cuerpo = pantalla(c, { titulo: a.tipo + (reg && reg.folio ? ' ' + reg.folio : ''), sub: `Solicita ${nombreUsuario(a.solicitante)} · ${fechaHora(a.fecha)}`, volver: 'aprobaciones', chip: chip(a.estatus === 'Pendiente' ? 'Pendiente de aprobación' : a.estatus) });
  cuerpo.append(h('div.kpi', h('div.kpi__nombre', tabla === 'Movimientos' ? 'Monto con IVA' : 'Monto'), h('div.kpi__valor.cifra', dinero(a.monto))));
  if (reg) cuerpo.append(resumenRegistro(tabla, reg));
  else cuerpo.append(alerta('advertencia', 'No se pudo cargar el registro', 'Revise la conexión.'));
  if (a.estatus !== 'Pendiente') { cuerpo.append(h('div.panel-datos', h('dl.datos', h('dt', 'Resolución'), h('dd', a.estatus), h('dt', 'Comentario'), h('dd', a.comentario || '—'), h('dt', 'Resuelta por'), h('dd', `${nombreUsuario(a.actualizado_por)} · ${fechaHora(a.actualizado_en)}`)))); return; }
  const excede = tabla === 'Cotizaciones' && reg && (reg.detalle || []).some(d => d.excede_descuento_max === true);
  if (excede) cuerpo.append(alerta('advertencia', 'Una o más partidas superan el descuento máximo', 'Escriba un comentario para poder aprobar.'));
  const f = formulario([{ c: 'comentario', l: 'Comentario de Dirección', t: 'area', filas: 3, ph: excede ? 'Motivo del descuento autorizado' : 'Opcional al aprobar; obligatorio al rechazar' }], {});
  const resolver = async aprobar => {
    const com = (f.leer().comentario || '').trim();
    if (!aprobar && !com) { f.campos[0].error('Escriba el motivo del rechazo.'); return; }
    if (aprobar && excede && !com) { f.campos[0].error('Escriba un comentario para aprobar el descuento.'); return; }
    if (!navigator.onLine) return toast('Las aprobaciones se resuelven con conexión.', 'info');
    try {
      const r = await datos.enLinea(aprobar ? 'aprobar' : 'rechazar', { aprobacion_id: id, comentario: com });
      if (r && r.registro) await datos.aplicarLocal(tabla, r.registro);
      toast(`${a.tipo} ${aprobar ? 'aprobada' : 'rechazada'}` + (r && r.registro && r.registro.pdf && r.registro.pdf.url ? ' · PDF generado' : ''));
      bus.emit('aprobaciones-cambio');
      ir('aprobaciones', { reemplazar: true });
    } catch (e) { toast(errorTexto(e), 'error'); }
  };
  cuerpo.append(h('section.tarjeta.pila', f.el), h('div.barra-acciones', boton('Rechazar', { tipo: 'peligro', onclick: () => resolver(false) }), boton('Aprobar', { tipo: 'aprobar', ic: 'check', onclick: () => resolver(true) })));
}

function resumenRegistro(tabla, r) {
  const d = (pares) => h('div.panel-datos', h('dl.datos', pares.filter(Boolean).flatMap(([k, v]) => [h('dt', k), h('dd', vacioV(v) ? '—' : v)])));
  if (tabla === 'Cotizaciones') {
    const det = r.detalle || [];
    return h('div.pila', d([['Cliente', nombreCliente(r.cliente_id)], ['Emisión', fecha(r.fecha_emision)], ['Vigente hasta', fecha(r.vigente_hasta)], ['Forma de pago', r.forma_pago === 'Crédito' ? `Crédito a ${r.credito_dias} días` : r.forma_pago], ['Subtotal', dinero(r.subtotal)], ['IVA 16 %', dinero(r.iva_16)], ['Total', dinero(r.total)]]),
      h('div.tabla-contenedor', h('table.tabla', h('thead', h('tr', h('th', 'Clave'), h('th', 'Descripción'), h('th.num', 'Cant.'), h('th.num', 'P. unitario'), h('th.num', 'Desc.'), h('th.num', 'Importe'))),
        h('tbody', det.map(x => h('tr', h('td.clave', x.sku), h('td', x.descripcion, x.excede_descuento_max ? h('span.sub', { style: { color: 'var(--avx-advertencia)', fontWeight: 700 } }, 'Descuento mayor al máximo') : null), h('td.num', numero(x.cantidad)), h('td.num', dinero(x.precio_unitario)), h('td.num', num(x.descuento_pct) ? pct(x.descuento_pct) : '—'), h('td.num', dinero(x.importe))))))),
      h('div.fila', boton('Vista previa de la cotización', { tipo: 'secundario', ic: 'pdf', onclick: () => abrirVistaPrevia(r) }), boton('Abrir cotización', { tipo: 'fantasma', href: '#/cotizaciones/' + r.id })));
  }
  if (tabla === 'Compras') return h('div.pila', d([['Proveedor', r.proveedor], ['Fecha', fecha(r.fecha)], ['Entrega estimada', fecha(r.fecha_estimada_entrega)], ['Subtotal', dinero(r.subtotal)], ['IVA', dinero(r.iva)], ['Total', dinero(r.total)], ['Notas', r.notas]]),
    h('div.tabla-contenedor', h('table.tabla', h('thead', h('tr', h('th', 'SKU'), h('th', 'Descripción'), h('th.num', 'Cant.'), h('th.num', 'Costo'), h('th.num', 'Total'))), h('tbody', (r.detalle || []).map(x => h('tr', h('td.clave', x.sku), h('td', x.descripcion), h('td.num', numero(x.cantidad)), h('td.num', dinero(x.costo_unitario)), h('td.num', dinero(x.total))))))));
  if (tabla === 'OrdenesServicio') return d([['Cliente', nombreCliente(r.cliente_id)], ['Cultivo', r.cultivo], ['Servicio', r.tipo_servicio], ['Hectáreas', numero(r.ha_contratadas, 'ha')], ['Precio por ha', dinero(r.precio_ha)], ['Plan', `${fecha(r.fecha_inicio_plan)} – ${fecha(r.fecha_fin_plan)}`], ['Técnicos', json(r.tecnicos).map(nombreUsuario).join(', ')], ['Resumen', r.resumen_general]]);
  if (tabla === 'Rentas') return d([['Cliente', nombreCliente(r.cliente_id)], ['Equipos', json(r.equipos).join(', ')], ['Periodo', `${fechaHora(r.inicio)} – ${fechaHora(r.fin)}`], ['Tarifa', dinero(r.tarifa)], ['Depósito', dinero(r.deposito)]]);
  if (tabla === 'Movimientos') return d([['Concepto', r.concepto], ['Tipo', r.tipo], ['Categoría', r.categoria], ['Fecha', fecha(r.fecha)], ['Monto con IVA', dinero(r.monto_con_iva)], ['Forma de pago', r.forma_pago], ['Comprobante', r.comprobante_url ? h('a', { href: r.comprobante_url, target: '_blank', rel: 'noopener' }, 'Abrir') : '—']]);
  return d(Object.entries(r).filter(([k, v]) => typeof v !== 'object' && !k.startsWith('_')).slice(0, 12));
}

// ---------- Avisos ----------
const RUTA_REF = { Cotizaciones: 'cotizaciones', Compras: 'compras', OrdenesServicio: 'os', Rentas: 'rentas', Movimientos: 'movimientos', Tickets: 'tickets', Solicitudes: 'solicitudes', Oportunidades: 'oportunidades' };
async function pantallaAvisos(c) {
  const cuerpo = pantalla(c, { titulo: 'Avisos' });
  const zona = h('div'); cuerpo.append(zona); zona.append(esqueleto(3));
  let regs, desdeCache;
  try { ({ registros: regs, desdeCache } = await datos.listar('Avisos')); } catch (e) { vaciar(zona).append(alerta('error', 'No se pudieron cargar los avisos', errorTexto(e))); return; }
  vaciar(zona); const av = avisoCache(desdeCache); if (av) zona.append(av);
  regs.sort((a, b) => (a.leido === true) - (b.leido === true) || String(b.fecha).localeCompare(String(a.fecha)));
  const noLeidos = regs.filter(a => a.leido !== true);
  if (noLeidos.length) zona.append(h('div.fila', { style: { marginBottom: '12px' } }, boton('Marcar todos como leídos', { tipo: 'secundario', chico: true, ic: 'check', onclick: async () => {
    for (const a of noLeidos) await datos.guardar('Avisos', { id: a.id, leido: true });
    bus.emit('avisos-cambio', 0); pantallaAvisos(c);
  } })));
  if (!regs.length) { zona.append(h('div.vacio', h('span.vacio__icono', icono('aviso', 32)), h('span.vacio__titulo', 'Sin avisos'), h('p', 'Aquí llegan las aprobaciones, rechazos y recordatorios.'))); return; }
  zona.append(h('div.lista-registros', regs.slice(0, 100).map(a => {
    const [tabla, rid] = String(a.referencia || '').split(':');
    const destino = a.tipo === 'Aprobación pendiente' && esDir() ? 'aprobaciones' : (RUTA_REF[tabla] && rid ? RUTA_REF[tabla] + '/' + rid : null);
    const el = h('button.registro.registro--aviso' + (a.leido === true ? '' : '.registro--no-leido'), { type: 'button' },
      h('span.registro__titulo', a.tipo), h('span.registro__estado', a.leido === true ? '' : h('span.badge', 'Nuevo')), h('span.registro__meta', h('span', a.mensaje), h('span', fechaHora(a.fecha))));
    el.addEventListener('click', async () => {
      if (a.leido !== true) { await datos.guardar('Avisos', { id: a.id, leido: true }); bus.emit('avisos-cambio', Math.max(0, (est.avisos || 1) - 1)); }
      if (destino) ir(destino); else pantallaAvisos(c);
    });
    return el;
  })));
}

export const rutas = [
  { p: 'inicio', r: inicio },
  { p: 'aprobaciones', r: listaAprobaciones, ver: () => esDir() },
  { p: 'aprobaciones/:id', r: (c, p) => detalleAprobacion(c, p), ver: () => esDir() },
  { p: 'avisos', r: pantallaAvisos }
];
