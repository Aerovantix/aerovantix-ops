// SOPs con checklists ejecutables, Soporte (tickets) y Capacitaciones (constancia en PDF).
import { h, icono, vaciar, toast, numero, chip, boton, alerta, esqueleto, errorTexto, fecha, fechaHora, json, num, hoyIso, ahoraIso, chipPendiente, modal } from '../ui.js';
import { formulario } from '../forms.js';
import { pantalla, listado, avisoCache, pestanas } from '../vistas.js';
import { rutasCrud, renderLista, botonNuevo } from '../crud.js';
import * as datos from '../datos.js';
import { esDir, puede, cat, usuario, nombreUsuario } from '../estado.js';
import { ir, recargar } from '../router.js';
import { opClientes, nombreCliente, opUsuarios, opEquipos, enlace } from './comunes.js';
import { barraProgreso } from '../progreso.js';

// ---------- SOPs ----------
const cfgSOPs = {
  tabla: 'SOPs', ruta: 'sops', titulo: 'SOPs', singular: 'SOP', singularMayus: 'SOP', icono: 'sop',
  campos: () => [
    { c: 'codigo', l: 'Código', t: 'texto', req: true, ancho: 'medio' }, { c: 'version', l: 'Versión', t: 'texto', ancho: 'medio' },
    { c: 'procedimiento', l: 'Procedimiento', t: 'texto', req: true }, { c: 'area', l: 'Área', t: 'texto', ancho: 'medio' },
    { c: 'responsable', l: 'Responsable', t: 'texto', ancho: 'medio' }, { c: 'frecuencia', l: 'Frecuencia', t: 'texto', ancho: 'medio' },
    { c: 'estatus', l: 'Estatus', t: 'opciones', op: ['Pendiente', 'Borrador', 'Vigente'], ancho: 'medio' },
    { c: 'ultima_revision', l: 'Última revisión', t: 'fecha', ancho: 'medio' }, { c: 'enlace', l: 'Enlace al documento', t: 'texto', ancho: 'medio' },
    { c: 'alcance', l: 'Alcance', t: 'area', filas: 2 }
  ],
  tituloDe: r => r.procedimiento, subDe: r => `${r.codigo}${r.version ? ' · v' + r.version : ''} · ${r.area || ''}`
};

async function listaSOPs(c) {
  const cuerpo = pantalla(c, { titulo: 'SOPs', sub: 'Procedimientos estándar y checklists que se ejecutan desde el teléfono.', acciones: [esDir() ? boton('Nuevo SOP', { ic: 'mas', href: '#/sops/nuevo' }) : null] });
  const zona = h('div'); cuerpo.append(zona); zona.append(esqueleto(3));
  let regs, desdeCache;
  try { ({ registros: regs, desdeCache } = await datos.listar('SOPs')); } catch (e) { vaciar(zona).append(alerta('error', 'No se pudieron cargar los SOPs', errorTexto(e))); return; }
  vaciar(zona); const av = avisoCache(desdeCache); if (av) zona.append(av);
  const pasos = cat('SOPPasos');
  zona.append(listado({
    registros: regs, buscarPh: 'Buscar código o procedimiento',
    columnas: [{ l: 'Código', v: r => r.codigo, clase: 'clave' }, { l: 'Procedimiento', v: r => h('strong', r.procedimiento) }, { l: 'Área', v: r => r.area || '—' }, { l: 'Pasos', v: r => String(pasos.filter(p => p.sop_id === r.id).length), num: true }, { l: 'Versión', v: r => r.version || '—' }, { l: 'Estatus', v: r => chip(r.estatus || 'Pendiente') }],
    movil: { titulo: r => r.procedimiento, chip: r => chip(r.estatus || 'Pendiente'), meta: r => [r.codigo, r.area, `${pasos.filter(p => p.sop_id === r.id).length} pasos`] },
    texto: r => [r.codigo, r.procedimiento, r.area, r.responsable].join(' '),
    filtros: [{ t: 'Vigentes', f: r => r.estatus === 'Vigente' }, { t: 'Por documentar', f: r => r.estatus !== 'Vigente' }],
    orden: (a, b) => String(a.codigo).localeCompare(b.codigo), href: r => 'sops/' + r.id,
    vacio: { ic: 'sop', t: 'Sin SOPs', d: 'Dirección registra los procedimientos y sus pasos.' }
  }));
}

async function detalleSOP(c, { id }) {
  const cu = pantalla(c, { titulo: 'SOP', volver: 'sops' }); cu.append(esqueleto(2));
  let r;
  try { r = await datos.obtener('SOPs', id); } catch (e) { vaciar(cu).append(alerta('error', 'No se pudo abrir el SOP', errorTexto(e))); return; }
  if (!r) { vaciar(cu).append(alerta('advertencia', 'SOP no disponible sin conexión')); return; }
  const pasos = cat('SOPPasos').filter(p => p.sop_id === id).sort((a, b) => num(a.numero) - num(b.numero));
  const cuerpo = pantalla(c, { titulo: r.procedimiento, sub: `${r.codigo}${r.version ? ' · versión ' + r.version : ''}`, volver: 'sops', chip: chip(r.estatus || 'Pendiente'),
    acciones: [esDir() ? boton('Editar', { tipo: 'secundario', ic: 'editar', href: '#/sops/' + id + '/editar' }) : null, pasos.length && puede('EjecucionesSOP', 'escribir') ? boton('Ejecutar checklist', { ic: 'check', href: '#/sops/' + id + '/ejecutar' }) : null] });
  cuerpo.append(h('div.panel-datos', h('dl.datos', h('dt', 'Área'), h('dd', r.area || '—'), h('dt', 'Responsable'), h('dd', r.responsable || '—'), h('dt', 'Frecuencia'), h('dd', r.frecuencia || '—'),
    h('dt', 'Última revisión'), h('dd', fecha(r.ultima_revision)), h('dt', 'Documento'), h('dd', r.enlace ? enlace(r.enlace, 'Abrir') : '—'), h('dt', 'Alcance'), h('dd', r.alcance || '—'))));
  const zona = h('ol.pasos-sop', { role: 'list' });
  pasos.forEach(p => zona.append(h('li.paso-sop', h('span.paso-sop__num', String(p.numero)), h('span', p.descripcion, p.requiere_evidencia === true ? h('span.chip.chip--neutro', { style: { marginLeft: '8px' } }, 'Requiere evidencia') : null),
    esDir() ? h('button.boton.boton--icono', { type: 'button', 'aria-label': 'Editar paso ' + p.numero, onclick: () => editarPaso(r, p) }, icono('editar')) : null)));
  cuerpo.append(h('section.pila', h('div.fila.encabezado-seccion', h('h2.titulo-seccion', 'Pasos'), esDir() ? boton('Agregar paso', { tipo: 'secundario', ic: 'mas', chico: true, onclick: () => editarPaso(r, null, pasos.length + 1) }) : null),
    pasos.length ? zona : h('p.texto-suave', 'Este SOP aún no tiene pasos. ' + (esDir() ? 'Agréguelos para poder ejecutarlo como checklist.' : ''))));
  if (puede('EjecucionesSOP')) {
    try {
      const { registros } = await datos.listar('EjecucionesSOP');
      const ej = registros.filter(x => x.sop_id === id).sort((a, b) => String(b.fecha).localeCompare(String(a.fecha))).slice(0, 15);
      if (ej.length) cuerpo.append(h('section.pila', h('h2.titulo-seccion', 'Ejecuciones recientes'), h('div.tabla-contenedor', h('table.tabla', h('thead', h('tr', h('th', 'Fecha'), h('th', 'Usuario'), h('th', 'Referencia'), h('th.num', 'Cumplidos'), h('th', 'Estatus'))),
        h('tbody', ej.map(x => { const rs = json(x.respuestas); return h('tr', h('td', fechaHora(x.fecha)), h('td', nombreUsuario(x.usuario)), h('td', x.referencia || '—'), h('td.num', `${rs.filter(z => z.ok).length} / ${rs.length}`), h('td', x._pendiente ? chipPendiente() : chip(x.estatus))); }))))));
    } catch (e) { /* sin acción */ }
  }
}

function editarPaso(sop, paso, siguiente) {
  const f = formulario([{ c: 'numero', l: 'Número', t: 'numero', req: true, min: 1 }, { c: 'descripcion', l: 'Descripción', t: 'area', req: true, filas: 3 }, { c: 'requiere_evidencia', l: 'Requiere evidencia (foto o comentario)', t: 'bool' }], paso || { numero: siguiente });
  modal({ titulo: paso ? 'Editar paso' : 'Nuevo paso', cuerpo: f.el, acciones: [{ texto: 'Cancelar', tipo: 'fantasma' }, { texto: 'Guardar paso', tipo: 'primario', fn: async () => {
    if (!f.validar()) return false;
    await datos.guardar('SOPPasos', Object.assign({ id: paso ? paso.id : undefined, sop_id: sop.id }, f.leer()), { resumen: 'Paso de ' + sop.codigo });
    toast('Paso guardado'); ir('sops/' + sop.id, { reemplazar: true });
  } }] });
}

async function ejecutarSOP(c, { id }, q) {
  const r = cat('SOPs').find(x => x.id === id);
  if (!r) { pantalla(c, { titulo: 'Checklist', volver: 'sops' }).append(alerta('advertencia', 'SOP no disponible')); return; }
  const pasos = cat('SOPPasos').filter(p => p.sop_id === id).sort((a, b) => num(a.numero) - num(b.numero));
  const cuerpo = pantalla(c, { titulo: r.procedimiento, sub: 'Checklist · ' + r.codigo, volver: 'sops/' + id });
  cuerpo.classList.add('no-refrescar');
  const ref = h('input.entrada', { value: q.referencia || '', placeholder: 'p. ej. folio de OS, serie del equipo', 'aria-label': 'Referencia' });
  const filas = pasos.map(p => {
    const ok = h('input', { type: 'checkbox' });
    const nota = h('input.entrada', { placeholder: p.requiere_evidencia === true ? 'Evidencia o comentario (obligatorio)' : 'Comentario opcional', 'aria-label': 'Comentario del paso ' + p.numero });
    return { p, ok, nota, el: h('div.tarjeta.pila', { style: { gap: '8px' } }, h('label.opcion', ok, h('span.opcion__marca', icono('check', 16)), h('span', h('strong', p.numero + '. '), p.descripcion)), nota) };
  });
  const guardar = boton('Guardar checklist', { ic: 'check' });
  cuerpo.append(h('label.campo', h('span.campo__etiqueta', 'Referencia'), ref), ...filas.map(x => x.el), h('div.barra-acciones', boton('Cancelar', { tipo: 'fantasma', href: '#/sops/' + id }), guardar));
  guardar.addEventListener('click', async () => {
    const falta = filas.find(x => x.p.requiere_evidencia === true && x.ok.checked && !x.nota.value.trim());
    if (falta) { toast(`El paso ${falta.p.numero} requiere evidencia o comentario.`, 'error'); falta.nota.focus(); return; }
    const respuestas = filas.map(x => ({ paso: x.p.numero, descripcion: x.p.descripcion, ok: x.ok.checked, nota: x.nota.value.trim() }));
    await datos.guardar('EjecucionesSOP', { sop_id: id, referencia: ref.value.trim(), fecha: ahoraIso(), respuestas, estatus: respuestas.every(x => x.ok) ? 'Completa' : 'En curso' }, { resumen: 'Checklist ' + r.codigo });
    toast('Checklist guardado' + (navigator.onLine ? '' : ' en este teléfono · se subirá al haber señal'));
    ir('sops/' + id, { reemplazar: true });
  });
}

// ---------- Tickets ----------
const cfgTickets = {
  tabla: 'Tickets', ruta: 'tickets', titulo: 'Tickets de soporte', singular: 'ticket', singularMayus: 'Ticket', icono: 'soporte',
  nuevo: () => ({ fecha_apertura: hoyIso(), estatus: 'Abierto', tipo: 'Soporte', responsable: usuario() }),
  campos: r => [
    { c: 'cliente_id', l: 'Cliente', t: 'opciones', op: opClientes, req: true, ro: r && r.estatus === 'Por asignar' },
    { c: 'tipo', l: 'Tipo', t: 'opciones', op: ['Soporte', 'Garantía'], req: true, ancho: 'medio' },
    { c: 'equipo_serie', l: 'Equipo (serie)', t: 'opciones', op: () => opEquipos(), ancho: 'medio' },
    { c: 'descripcion', l: 'Descripción del problema', t: 'area', req: true, filas: 3 },
    { c: 'responsable', l: 'Responsable', t: 'opciones', op: () => opUsuarios(['Técnico', 'Dirección']), ancho: 'medio' },
    { c: 'estatus', l: 'Estatus', t: 'opciones', op: r && r.estatus === 'Por asignar' ? ['Por asignar', 'Abierto', 'En proceso', 'Cerrado'] : ['Abierto', 'En proceso', 'Cerrado'], ancho: 'medio',
      ro: !!(r && r.estatus === 'Por asignar' && !esDir()), ayuda: r && r.estatus === 'Por asignar' ? 'Llegó del portal: Dirección lo asigna.' : null },
    { c: 'fecha_apertura', l: 'Apertura', t: 'fecha', ancho: 'medio' }, { c: 'fecha_cierre', l: 'Cierre', t: 'fecha', ancho: 'medio' },
    { c: 'solucion', l: 'Solución', t: 'area', filas: 3, validar: (v, o) => (o.estatus === 'Cerrado' && !v ? 'Describa la solución para cerrar el ticket.' : '') }
  ],
  antesDeGuardar: (reg, previo) => {
    if (previo && previo.estatus === 'Por asignar' && reg.estatus && reg.estatus !== 'Por asignar' && !reg.responsable) return 'Elija el responsable para asignar el ticket.';
    if (reg.estatus === 'Cerrado' && !reg.fecha_cierre) reg.fecha_cierre = hoyIso(); return reg;
  },
  acciones: r => [esDir() && r.estatus === 'Por asignar' ? boton('Asignar', { tipo: 'aprobar', ic: 'usuarios', onclick: () => asignarTicket(r) }) : null],
  extrasDetalle: async (r, cuerpo) => {
    const prog = barraProgreso(r.progreso, { titulo: 'Progreso del ticket (el cliente ve lo mismo)' }); if (prog) cuerpo.prepend(prog);
    if (r.estatus === 'Por asignar') cuerpo.prepend(alerta('advertencia', 'Ticket abierto por el cliente desde su portal', esDir() ? 'Asígnelo a un responsable; el cliente verá a quién se asignó.' : 'Dirección lo asignará a un responsable.'));
    const fotos = json(r.fotos);
    if (fotos.length) cuerpo.append(h('section.pila', h('h2.titulo-seccion', 'Fotos del cliente'), h('div.fila', fotos.map((u, i) => enlace(u, 'Foto ' + (i + 1))))));
  },
  columnas: [{ l: 'Folio', v: r => r.folio || 'Sin folio aún', clase: 'clave' }, { l: 'Cliente', v: r => h('span', h('strong', nombreCliente(r.cliente_id)), h('span.sub', r.descripcion || '')) }, { l: 'Tipo', v: r => r.tipo }, { l: 'Equipo', v: r => r.equipo_serie || '—' }, { l: 'Apertura', v: r => fecha(r.fecha_apertura) }, { l: 'Estatus', v: r => chip(r.estatus) }],
  movil: { titulo: r => (r.folio || 'Ticket') + ' · ' + nombreCliente(r.cliente_id), chip: r => chip(r.estatus), meta: r => [r.tipo, r.equipo_serie, fecha(r.fecha_apertura)] },
  texto: r => [r.folio, nombreCliente(r.cliente_id), r.descripcion, r.equipo_serie].join(' '),
  filtros: [{ t: 'Abiertos', f: r => r.estatus !== 'Cerrado' }, { t: 'Por asignar', f: r => r.estatus === 'Por asignar' }, { t: 'Garantías', f: r => r.tipo === 'Garantía' }], filtroInicial: 0,
  orden: (a, b) => String(b.fecha_apertura).localeCompare(String(a.fecha_apertura)), tituloDe: r => r.folio || 'Ticket', subDe: r => nombreCliente(r.cliente_id)
};

function asignarTicket(t) {
  const f = formulario([{ c: 'responsable', l: 'Responsable', t: 'opciones', op: () => opUsuarios(['Técnico', 'Piloto', 'Agronomía', 'Dirección']), req: true }],
    { responsable: (cat('Usuarios').find(u => u.rol === 'Técnico') || {}).usuario || '' }, { columnas: false });
  modal({ titulo: 'Asignar ' + (t.folio || 'ticket'), cuerpo: h('div.pila', h('p', 'El ticket pasa a Abierto con el responsable que elija. El cliente lo verá en su portal.'), f.el),
    acciones: [{ texto: 'Cancelar', tipo: 'fantasma', valor: null }, { texto: 'Asignar', tipo: 'aprobar', icono: 'check', fn: async () => {
      if (!f.validar()) return false;
      try { await datos.guardar('Tickets', { id: t.id, responsable: f.leer().responsable, estatus: 'Abierto' }, { version: t.actualizado_en, resumen: 'Asignación de ' + (t.folio || 'ticket') }); }
      catch (e) { toast(errorTexto(e), 'error'); return false; }
      toast('Ticket asignado' + (navigator.onLine ? '' : ' en este teléfono · se subirá al haber señal')); recargar(); return true;
    } }] });
}

// ---------- Capacitaciones ----------
let archivoConstancia = null;
const cfgCapacitaciones = {
  tabla: 'Capacitaciones', ruta: 'capacitaciones', titulo: 'Capacitaciones', singular: 'capacitación', singularMayus: 'Capacitación', femenino: true, icono: 'capacitacion',
  nuevo: () => ({ fecha: hoyIso(), instructor: usuario() }),
  campos: () => [
    { c: 'cliente_id', l: 'Cliente', t: 'opciones', op: opClientes, req: true },
    { c: 'fecha', l: 'Fecha', t: 'fecha', req: true, ancho: 'medio' }, { c: 'horas', l: 'Duración', t: 'numero', suf: 'h', ancho: 'medio' },
    { c: 'instructor', l: 'Instructor', t: 'opciones', op: () => opUsuarios(['Agronomía', 'Técnico', 'Dirección']), ancho: 'medio' },
    { c: 'participantes', l: 'Participantes', t: 'oculto' },
    { c: 'temas', l: 'Temas', t: 'area', filas: 3 }
  ],
  extrasForm: (f, cuerpo, base) => {
    const lista = h('textarea.area-texto', { rows: 3, placeholder: 'Un participante por línea' });
    lista.value = json(base.participantes).join('\n');
    lista.addEventListener('input', () => f.campo('participantes').fijar(JSON.stringify(lista.value.split('\n').map(x => x.trim()).filter(Boolean))));
    archivoConstancia = h('input', { type: 'file', accept: 'application/pdf' });
    cuerpo.querySelector('form').append(h('label.campo', h('span.campo__etiqueta', 'Participantes'), lista),
      h('label.campo', h('span.campo__etiqueta', 'Constancia en PDF'), archivoConstancia, h('span.campo__ayuda', 'Documento para el cliente con trato de usted y voz de Aerovantix.')));
  },
  antesDeGuardar: reg => { reg.participantes = json(reg.participantes); return reg; },
  despuesDeGuardar: async g => {
    const f = archivoConstancia && archivoConstancia.files[0];
    if (f) { if (f.size > 10 * 1024 * 1024) toast('La constancia excede 10 MB y no se adjuntó.', 'error'); else await datos.adjuntar('Capacitaciones', g.id, 'constancia_pdf_url', f, f.name, { resumen: 'Constancia de capacitación' }); }
    ir('capacitaciones/' + g.id, { reemplazar: true });
  },
  grupos: (r, defs) => [[null, [['Cliente', nombreCliente(r.cliente_id)], ['Fecha', fecha(r.fecha)], ['Duración', numero(r.horas, 'h')], ['Instructor', nombreUsuario(r.instructor)], ['Participantes', json(r.participantes).join(', ') || '—'], ['Temas', r.temas || '—'], ['Constancia', r.constancia_pdf_url ? enlace(r.constancia_pdf_url, 'Abrir PDF') : '—']]]],
  columnas: [{ l: 'Fecha', v: r => fecha(r.fecha) }, { l: 'Cliente', v: r => h('strong', nombreCliente(r.cliente_id)) }, { l: 'Instructor', v: r => nombreUsuario(r.instructor) }, { l: 'Participantes', v: r => String(json(r.participantes).length), num: true }, { l: 'Constancia', v: r => (r.constancia_pdf_url ? enlace(r.constancia_pdf_url, 'PDF') : '—') }],
  movil: { titulo: r => nombreCliente(r.cliente_id), chip: r => h('span.texto-sm', fecha(r.fecha)), meta: r => [`${json(r.participantes).length} participantes`, numero(r.horas, 'h')] },
  texto: r => [nombreCliente(r.cliente_id), r.temas, json(r.participantes).join(' ')].join(' '),
  orden: (a, b) => String(b.fecha).localeCompare(String(a.fecha)), tituloDe: r => 'Capacitación · ' + nombreCliente(r.cliente_id), subDe: r => fecha(r.fecha)
};

async function pantallaSoporte(c, p, q) {
  const tab = q.vista || (puede('Tickets') ? 'tickets' : 'capacitaciones');
  const cfgs = { tickets: cfgTickets, capacitaciones: cfgCapacitaciones };
  const cuerpo = pantalla(c, { titulo: 'Soporte y capacitación', acciones: [botonNuevo(cfgs[tab])] });
  const zona = h('div');
  cuerpo.append(pestanas([puede('Tickets') && { id: 'tickets', t: 'Soporte y garantía' }, puede('Capacitaciones') && { id: 'capacitaciones', t: 'Capacitaciones' }], tab,
    v => { history.replaceState(null, '', '#/soporte?vista=' + v); pantallaSoporte(c, p, { vista: v }); }), zona);
  await renderLista(zona, cfgs[tab], { sinBoton: true });
}

export const rutas = [
  { p: 'sops', r: listaSOPs },
  ...rutasCrud(cfgSOPs).filter(x => x.p !== 'sops' && x.p !== 'sops/:id'),
  { p: 'sops/:id', r: (c, p) => detalleSOP(c, p) },
  { p: 'sops/:id/ejecutar', r: (c, p, q) => ejecutarSOP(c, p, q) },
  { p: 'soporte', r: pantallaSoporte },
  ...rutasCrud(cfgTickets), ...rutasCrud(cfgCapacitaciones)
];
