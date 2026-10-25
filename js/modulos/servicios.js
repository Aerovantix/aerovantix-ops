// Órdenes de servicio con etapas (captura de campo sin conexión: fotos, GPS y firma) y Rentas con entrega y devolución.
import { h, icono, vaciar, toast, dinero, pct, numero, chip, boton, alerta, esqueleto, errorTexto, fecha, fechaHora, json, vacioV, num, ahoraIso, confirmar, chipPendiente, modal } from '../ui.js';
import { formulario } from '../forms.js';
import { pantalla, listado, avisoCache, pestanas } from '../vistas.js';
import { rutasCrud, mostrar } from '../crud.js';
import * as datos from '../datos.js';
import { esDir, puede, cat, rol, usuario, nombreUsuario, alcance } from '../estado.js';
import { ir } from '../router.js';
import { opClientes, nombreCliente, opParcelas, nombreParcela, opUsuarios, opEquipos, botonGPS, selectorFotos, capturaFirma, miniaturasPendientes, enlace } from './comunes.js';

const ABIERTAS = ['Programada', 'Pendiente de aprobación', 'Confirmada', 'En ejecución', 'Pausada'];
const esTec = () => rol() === 'Técnico';

// ================= Órdenes de servicio =================
function camposOS(r) {
  return [
    { c: 'cliente_id', l: 'Cliente', t: 'opciones', op: opClientes, req: true },
    { c: 'parcelas', l: 'Parcelas del servicio', t: 'multi', op: () => opParcelas(r && r.cliente_id), vacio: 'Guarde primero el cliente o registre sus parcelas en CRM.' },
    { c: 'cultivo', l: 'Cultivo', t: 'texto', ancho: 'medio' },
    { c: 'tipo_servicio', l: 'Tipo de servicio', t: 'texto', ancho: 'medio', ph: 'p. ej. aspersión de fungicida' },
    { c: 'ha_contratadas', l: 'Hectáreas contratadas', t: 'numero', suf: 'ha', req: true, min: 0, ancho: 'medio' },
    { c: 'precio_ha', l: 'Precio por hectárea sin IVA', t: 'dinero', ancho: 'medio' },
    { c: 'fecha_inicio_plan', l: 'Inicio planeado', t: 'fecha', ancho: 'medio' },
    { c: 'fecha_fin_plan', l: 'Fin planeado', t: 'fecha', ancho: 'medio' },
    { c: 'agronomo', l: 'Agrónomo responsable', t: 'opciones', op: () => opUsuarios(['Agronomía', 'Dirección']), ancho: 'medio' },
    { c: 'tecnicos', l: 'Técnicos asignados', t: 'multi', op: () => opUsuarios(['Técnico']), vacio: 'Aún no hay técnicos dados de alta.' },
    { c: 'resumen_general', l: 'Resumen general', t: 'area', ayuda: 'Notas del servicio completo (objetivo, condiciones, acuerdos).' }
  ];
}

async function listaOS(c) {
  const cuerpo = pantalla(c, { titulo: 'Órdenes de servicio', sub: esTec() ? 'Solo ve las órdenes donde está asignado.' : null,
    acciones: [puede('OrdenesServicio', 'escribir') && !esTec() ? boton('Nueva orden', { ic: 'mas', href: '#/os/nueva' }) : null] });
  const zona = h('div'); cuerpo.append(zona); zona.append(esqueleto(3));
  let regs, desdeCache;
  try { ({ registros: regs, desdeCache } = await datos.listar('OrdenesServicio')); } catch (e) { vaciar(zona).append(alerta('error', 'No se pudieron cargar las órdenes', errorTexto(e))); return; }
  vaciar(zona); const av = avisoCache(desdeCache); if (av) zona.append(av);
  zona.append(listado({
    registros: regs, buscarPh: 'Buscar folio, cliente o cultivo',
    columnas: [
      { l: 'Folio', v: r => r.folio || 'Sin folio aún', clase: 'clave' },
      { l: 'Cliente', v: r => h('span', h('strong', nombreCliente(r.cliente_id)), h('span.sub', [r.cultivo, r.tipo_servicio].filter(Boolean).join(' · '))) },
      { l: 'Plan', v: r => r.fecha_inicio_plan ? fecha(r.fecha_inicio_plan) + ' – ' + fecha(r.fecha_fin_plan) : '—' },
      { l: 'Hectáreas', v: r => `${numero(r.ha_aplicadas || 0)} / ${numero(r.ha_contratadas)}`, num: true },
      { l: 'Avance', v: r => pct(r.avance_pct || 0), num: true },
      { l: 'Técnicos', v: r => json(r.tecnicos).map(nombreUsuario).join(', ') || '—' },
      { l: 'Estatus', v: r => chip(r.estatus || 'Programada') }
    ],
    movil: { titulo: r => (r.folio || 'OS') + ' · ' + nombreCliente(r.cliente_id), chip: r => chip(r.estatus || 'Programada'), meta: r => [r.cultivo, `${numero(r.ha_aplicadas || 0)} de ${numero(r.ha_contratadas)} ha`, pct(r.avance_pct || 0)] },
    texto: r => [r.folio, nombreCliente(r.cliente_id), r.cultivo, r.tipo_servicio, r.estatus].join(' '),
    filtros: [{ t: 'Abiertas', f: r => ABIERTAS.includes(r.estatus || 'Programada') }, { t: 'En ejecución', f: r => r.estatus === 'En ejecución' }, { t: 'Terminadas', f: r => r.estatus === 'Terminada' }],
    filtroInicial: 0,
    orden: (a, b) => String(b.fecha_inicio_plan || '').localeCompare(String(a.fecha_inicio_plan || '')),
    href: r => 'os/' + r.id,
    vacio: { ic: 'orden', t: 'Aún no hay órdenes de servicio', d: esTec() ? 'Cuando Dirección o Agronomía le asignen una orden, aparecerá aquí.' : 'Cree la primera desde una cotización aceptada o desde cero.', accion: !esTec() && puede('OrdenesServicio', 'escribir') ? boton('Nueva orden de servicio', { ic: 'mas', href: '#/os/nueva' }) : null }
  }));
}

async function formOS(c, { id }, q, borrador) {
  let r = null;
  if (id) { try { r = await datos.obtener('OrdenesServicio', id); } catch (e) { pantalla(c, { titulo: 'Orden de servicio', volver: 'os' }).append(alerta('error', 'No se pudo abrir', errorTexto(e))); return; } }
  const base = borrador || r || Object.assign({}, q);
  const cuerpo = pantalla(c, { titulo: id ? 'Editar ' + ((r && r.folio) || 'orden') : 'Nueva orden de servicio', volver: id ? 'os/' + id : 'os' });
  cuerpo.classList.add('no-refrescar');
  const f = formulario(camposOS(base), base);
  // Al cambiar de cliente cambian las parcelas disponibles: se vuelve a dibujar el formulario conservando lo capturado.
  const cl = f.campo('cliente_id');
  cl.control.addEventListener('change', () => formOS(c, { id }, q, Object.assign({}, base, f.leer(), { cliente_id: cl.control.value, parcelas: [] })));
  const guardar = boton('Guardar orden', { ic: 'check' });
  cuerpo.append(h('form.tarjeta.pila', { novalidate: true, onsubmit: e => e.preventDefault() }, f.el), h('div.barra-acciones', boton('Cancelar', { tipo: 'fantasma', href: '#/' + (id ? 'os/' + id : 'os') }), guardar));
  guardar.addEventListener('click', async () => {
    if (!f.validar()) return toast('Revise los datos marcados.', 'error');
    const reg = Object.assign({ id: id || undefined }, f.leer());
    guardar.disabled = true;
    try {
      const g = await datos.guardar('OrdenesServicio', reg, { version: r ? r.actualizado_en : undefined, resumen: 'Orden de servicio de ' + nombreCliente(reg.cliente_id) });
      toast('Orden guardada' + (navigator.onLine ? '' : ' en este teléfono · se subirá al haber señal'));
      ir('os/' + g.id, { reemplazar: true });
    } catch (e) { toast(errorTexto(e), 'error'); guardar.disabled = false; }
  });
}

async function detalleOS(c, { id }, q) {
  const cu = pantalla(c, { titulo: 'Orden de servicio', volver: 'os' }); cu.append(esqueleto(3));
  let r;
  try { r = await datos.obtener('OrdenesServicio', id); } catch (e) { vaciar(cu).append(alerta('error', 'No se pudo abrir la orden', errorTexto(e))); return; }
  if (!r) { vaciar(cu).append(alerta('advertencia', 'Orden no disponible', 'No está guardada en este teléfono. Conéctese para consultarla.')); return; }
  const est = r.estatus || 'Programada';
  const etapas = r.etapas || [];
  const acc = [];
  const escribe = puede('OrdenesServicio', 'escribir');
  if (escribe && !esTec() && ['Programada', 'Pendiente de aprobación'].includes(est)) acc.push(boton('Editar', { tipo: 'secundario', ic: 'editar', href: '#/os/' + id + '/editar' }));
  if (esDir() && ['Confirmada', 'En ejecución', 'Pausada'].includes(est)) acc.push(boton('Editar', { tipo: 'secundario', ic: 'editar', href: '#/os/' + id + '/editar' }));
  if (escribe && !esTec() && est === 'Programada') acc.push(boton('Enviar a aprobación', { ic: 'aprobar', onclick: () => cambiarOS(r, 'Pendiente de aprobación') }));
  if (esDir() && ['Programada', 'Pendiente de aprobación'].includes(est)) acc.push(boton('Confirmar', { tipo: 'aprobar', onclick: () => cambiarOS(r, 'Confirmada') }));
  if (escribe && est === 'Confirmada') acc.push(boton('Iniciar servicio', { ic: 'dron', onclick: () => cambiarOS(r, 'En ejecución') }));
  if (escribe && ['En ejecución', 'Pausada'].includes(est)) acc.push(boton('Capturar etapa', { ic: 'mas', href: '#/os/' + id + '/etapa/nueva' }));
  if (escribe && est === 'En ejecución') acc.push(boton('Pausar', { tipo: 'secundario', onclick: () => cambiarOS(r, 'Pausada') }));
  if (escribe && est === 'Pausada') acc.push(boton('Reanudar', { tipo: 'secundario', onclick: () => cambiarOS(r, 'En ejecución') }));
  if (escribe && ['En ejecución', 'Pausada'].includes(est)) acc.push(boton('Terminar servicio', { tipo: 'aprobar', ic: 'check', onclick: () => terminarOS(r) }));
  if (esDir() && ABIERTAS.includes(est)) acc.push(boton('Cancelar orden', { tipo: 'peligro', onclick: () => cambiarOS(r, 'Cancelada') }));

  const cuerpo = pantalla(c, { titulo: r.folio || 'Orden sin folio', sub: [nombreCliente(r.cliente_id), r.cultivo, r.tipo_servicio].filter(Boolean).join(' · '), volver: 'os',
    chip: r._pendiente ? chipPendiente() : chip(est), acciones: acc });
  const av = avisoCache(r._desdeCache); if (av) cuerpo.append(av);
  if (est === 'Pendiente de aprobación') cuerpo.append(alerta('info', 'En espera de aprobación de Dirección', 'Toca clientes: se confirma antes de ejecutarse.'));
  const tab = q.vista || 'resumen';
  const zona = h('div.pila');
  cuerpo.append(pestanas([{ id: 'resumen', t: 'Resumen general' }, { id: 'etapas', t: 'Etapas', badge: etapas.length }, { id: 'evidencias', t: 'Evidencias' }, { id: 'insumos', t: 'Insumos' }], tab,
    v => { history.replaceState(null, '', '#/os/' + id + '?vista=' + v); pintar(v); }), zona);
  function pintar(v) {
    vaciar(zona);
    if (v === 'resumen') {
      const ha = num(r.ha_aplicadas), cont = num(r.ha_contratadas);
      zona.append(h('div.rejilla',
        kpiMini('Avance', pct(r.avance_pct || (cont ? Math.min(1, ha / cont) : 0)), `${numero(ha)} de ${numero(cont)} ha`, num(r.avance_pct)),
        kpiMini('Etapas', String(r.num_etapas ?? etapas.length), `${numero(r.dias_servicio || 0)} días de servicio`),
        kpiMini('Fechas reales', r.fecha_inicio_real ? fechaHora(r.fecha_inicio_real).slice(0, 10) : '—', r.fecha_fin_real ? 'a ' + fechaHora(r.fecha_fin_real) : 'Sin etapas registradas'),
        esDir() || rol() === 'Agronomía' ? kpiMini('Ingreso sin IVA', dinero(r.ingreso), esDir() ? `Costo ${dinero(r.costo)} · margen ${dinero(r.margen)}` : `${dinero(r.precio_ha)} por ha`) : null));
      zona.append(h('div.rejilla--2',
        h('div.panel-datos', h('div.panel-datos__titulo', 'Orden'), h('dl.datos', camposOS(r).filter(d => d.c !== 'resumen_general').flatMap(d => [h('dt', d.l), h('dd', mostrar(d, r[d.c]))]))),
        h('div.panel-datos', h('div.panel-datos__titulo', 'Resumen general'), h('p', { style: { whiteSpace: 'pre-wrap' } }, r.resumen_general || 'Sin resumen capturado.'),
          h('dl.datos', { style: { marginTop: '12px' } }, h('dt', 'Firma de conformidad'), h('dd', r.firma_conformidad_url ? enlace(r.firma_conformidad_url, 'Ver firma') : 'Pendiente')))));
    }
    if (v === 'etapas') {
      if (escribe && ['En ejecución', 'Pausada'].includes(est)) zona.append(h('div.fila', boton('Capturar etapa', { ic: 'mas', href: '#/os/' + id + '/etapa/nueva' })));
      if (!etapas.length) { zona.append(h('div.vacio', h('span.vacio__icono', icono('mapa', 32)), h('span.vacio__titulo', 'Sin etapas registradas'), h('p', est === 'Confirmada' ? 'Inicie el servicio para capturar la primera etapa.' : 'Cada día o lote de trabajo se captura como una etapa.'))); return; }
      etapas.forEach(e => zona.append(tarjetaEtapa(r, e, escribe)));
    }
    if (v === 'evidencias') {
      const items = etapas.flatMap(e => [...json(e.fotos_antes).map(u => ['Antes', e, u]), ...json(e.fotos_despues).map(u => ['Después', e, u]), e.firma_cliente_url ? [['Firma', e, e.firma_cliente_url]] : []].flat().filter(x => Array.isArray(x)));
      const pend = etapas.reduce((s, e) => s + (e._archivosPendientes || []).length, 0);
      if (pend) zona.append(alerta('advertencia', `${pend} archivo(s) por subir`, 'Las fotos y firmas siguen en este teléfono y se subirán al recuperar la señal.'));
      if (!items.length) { zona.append(h('p.texto-suave', 'Aún no hay fotos ni firmas en Drive.')); return; }
      zona.append(h('div.tabla-contenedor', h('table.tabla', h('thead', h('tr', h('th', 'Etapa'), h('th', 'Tipo'), h('th', 'Archivo'))),
        h('tbody', items.map(([t, e, u]) => h('tr', h('td', `${e.numero} · ${e.nombre || ''}`), h('td', t), h('td', enlace(u, 'Abrir en Drive'))))))));
    }
    if (v === 'insumos') {
      const ins = json(r.insumos_consumidos);
      zona.append(ins.length ? h('div.tabla-contenedor', h('table.tabla', h('thead', h('tr', h('th', 'Producto'), h('th.num', 'Cantidad'), h('th', 'Unidad'))),
        h('tbody', ins.map(x => h('tr', h('td', x.producto), h('td.num', numero(x.cantidad)), h('td', x.unidad)))))) : h('p.texto-suave', 'Se calcula con la dosis y las hectáreas de cada etapa.'));
    }
  }
  pintar(tab);
}

function kpiMini(nombre, valor, contexto, avance) {
  return h('div.kpi', h('div.kpi__nombre', nombre), h('div.kpi__valor.cifra', { style: { fontSize: 'var(--t-xl)' } }, valor),
    avance !== undefined && avance !== null && !isNaN(avance) ? h('div.barra-progreso', h('span', { style: { width: Math.min(100, avance * 100) + '%' } })) : null,
    contexto ? h('div.kpi__contexto', contexto) : null);
}

function tarjetaEtapa(os, e, escribe) {
  const t = h('div.tarjeta.pila',
    h('div.tarjeta__encabezado', h('div', h('div.titulo-tarjeta', `Etapa ${e.numero}${e.nombre ? ' · ' + e.nombre : ''}`),
      h('div.tarjeta__meta', [fechaHora(e.inicio), e.fin ? '→ ' + fechaHora(e.fin).slice(-5) : '', nombreParcela(e.parcela_id) !== '—' ? nombreParcela(e.parcela_id) : ''].filter(Boolean).join(' · '))),
      e._pendiente ? chipPendiente() : chip(e.estatus || 'En ejecución')),
    h('dl.datos', h('dt', 'Hectáreas'), h('dd', numero(e.ha_aplicadas, 'ha')), h('dt', 'Producto'), h('dd', e.producto ? `${e.producto} · ${numero(e.dosis)} ${e.unidad_dosis || ''}` : '—'),
      h('dt', 'Dron y piloto'), h('dd', [e.dron_serie, nombreUsuario(e.piloto)].filter(Boolean).join(' · ') || '—'),
      h('dt', 'Clima'), h('dd', [e.viento_ms !== '' && e.viento_ms !== undefined ? `viento ${numero(e.viento_ms)} m/s` : '', e.temperatura !== '' && e.temperatura !== undefined ? `${numero(e.temperatura)} °C` : '', e.humedad !== '' && e.humedad !== undefined ? `${numero(e.humedad)} % HR` : ''].filter(Boolean).join(' · ') || '—'),
      h('dt', 'Evidencias'), h('dd', `${json(e.fotos_antes).length} antes · ${json(e.fotos_despues).length} después · firma ${e.firma_cliente_url ? 'sí' : 'no'}${(e._archivosPendientes || []).length ? ` · ${e._archivosPendientes.length} por subir` : ''}`)),
    escribe && ['En ejecución', 'Pausada'].includes(os.estatus) ? h('div.fila', boton('Editar etapa', { tipo: 'secundario', chico: true, ic: 'editar', href: `#/os/${os.id}/etapa/${e.id}` })) : null);
  miniaturasPendientes(e).then(m => { if (m) t.append(m); });
  return t;
}

async function cambiarOS(r, estatus) {
  const textos = { 'Pendiente de aprobación': 'Se enviará a Dirección para su aprobación.', Confirmada: 'La orden quedará confirmada para ejecutarse.', 'En ejecución': 'El servicio inicia. Capture cada día o lote como una etapa.', Pausada: 'El servicio quedará en pausa.', Cancelada: 'La orden quedará cancelada.' };
  if (!(await confirmar(estatus === 'En ejecución' ? 'Iniciar servicio' : 'Cambiar estatus', textos[estatus] || `La orden pasará a ${estatus}.`, { textoSi: 'Confirmar', tipo: estatus === 'Cancelada' ? 'peligro' : 'primario' }))) return;
  await datos.cambiarEstatus('OrdenesServicio', r.id, estatus, null, { resumen: `${r.folio || 'OS'} → ${estatus}` });
  toast(`Orden ${estatus === 'En ejecución' ? 'iniciada' : 'actualizada'}` + (navigator.onLine ? '' : ' · se subirá al haber señal'));
  setTimeout(() => ir('os/' + r.id, { reemplazar: true }), 250);
}

function terminarOS(r) {
  const firma = capturaFirma('Firma de conformidad del cliente', r.firma_conformidad_url);
  modal({ titulo: 'Terminar servicio', cuerpo: h('div.pila', h('p', 'Pida al cliente que firme la conformidad del servicio completo. Si no está presente, puede terminar sin firma y capturarla después.'), firma.el),
    acciones: [{ texto: 'Cancelar', tipo: 'fantasma' }, { texto: 'Terminar servicio', tipo: 'aprobar', fn: async () => {
      const pad = firma.pad();
      await datos.cambiarEstatus('OrdenesServicio', r.id, 'Terminada', null, { resumen: `${r.folio || 'OS'} → Terminada` });
      if (pad && !pad.vacia()) await datos.adjuntar('OrdenesServicio', r.id, 'firma_conformidad_url', await pad.aBlob(), `Conformidad ${r.folio || ''}.png`, { resumen: 'Firma de conformidad ' + (r.folio || '') });
      toast('Servicio terminado' + (navigator.onLine ? '' : ' · se subirá al haber señal'));
      setTimeout(() => ir('os/' + r.id, { reemplazar: true }), 250);
    } }] });
}

// ---------- Captura de etapa ----------
async function formEtapa(c, { id, eid }) {
  let os;
  try { os = await datos.obtener('OrdenesServicio', id); } catch (e) { pantalla(c, { titulo: 'Etapa', volver: 'os/' + id }).append(alerta('error', 'No se pudo abrir la orden', errorTexto(e))); return; }
  if (!os) { pantalla(c, { titulo: 'Etapa', volver: 'os/' + id }).append(alerta('advertencia', 'Orden no disponible sin conexión', 'Ábrala una vez con señal para poder capturar sin conexión.')); return; }
  const etapas = os.etapas || [];
  const previa = eid ? etapas.find(e => e.id === eid) : null;
  const ultimo = etapas.reduce((m, e) => Math.max(m, num(e.numero)), 0);
  const parcelasOS = json(os.parcelas);
  const base = previa || { numero: ultimo + 1, inicio: ahoraIso(), estatus: 'En ejecución', piloto: esTec() ? usuario() : '', parcela_id: parcelasOS.length === 1 ? parcelasOS[0] : '', unidad_dosis: 'L/ha',
    dron_serie: etapas.length ? etapas[etapas.length - 1].dron_serie : '', producto: etapas.length ? etapas[etapas.length - 1].producto : '', dosis: etapas.length ? etapas[etapas.length - 1].dosis : '' };
  const cuerpo = pantalla(c, { titulo: previa ? `Etapa ${previa.numero}` : 'Capturar etapa', sub: `${os.folio || 'Orden'} · ${nombreCliente(os.cliente_id)}`, volver: 'os/' + id + '?vista=etapas' });
  cuerpo.classList.add('no-refrescar');
  if (!navigator.onLine) cuerpo.append(alerta('info', 'Está sin conexión', 'Todo se guarda en este teléfono, incluidas fotos y firma, y se sube solo al recuperar la señal.'));
  const opParc = parcelasOS.length ? parcelasOS.map(p => ({ v: p, l: nombreParcela(p) })) : opParcelas(os.cliente_id);
  const drones = opEquipos(e => e.tipo === 'Dron' && e.propiedad !== 'Mercancía para venta');
  const baterias = opEquipos(e => e.tipo === 'Batería' && e.propiedad !== 'Mercancía para venta');
  const f1 = formulario([
    { c: 'numero', l: 'Número de etapa', t: 'numero', req: true, ancho: 'medio', min: 1 },
    { c: 'nombre', l: 'Nombre o lote', t: 'texto', ancho: 'medio', ph: 'p. ej. Lote norte' },
    { c: 'parcela_id', l: 'Parcela', t: 'opciones', op: opParc },
    { c: 'inicio', l: 'Inicio', t: 'fechahora', req: true, ancho: 'medio' },
    { c: 'fin', l: 'Fin', t: 'fechahora', ancho: 'medio', validar: (v, o) => (v && o.inicio && v < o.inicio ? 'El fin debe ser posterior al inicio.' : '') },
    { c: 'ha_aplicadas', l: 'Hectáreas aplicadas', t: 'numero', suf: 'ha', req: true, min: 0, ancho: 'medio' },
    { c: 'volumen_caldo', l: 'Volumen de caldo', t: 'numero', suf: 'L', min: 0, ancho: 'medio' },
    { c: 'producto', l: 'Producto', t: 'texto' },
    { c: 'dosis', l: 'Dosis', t: 'numero', min: 0, ancho: 'medio' },
    { c: 'unidad_dosis', l: 'Unidad de dosis', t: 'opciones', op: ['L/ha', 'kg/ha'], ancho: 'medio' },
    { c: 'dron_serie', l: 'Dron', t: 'opciones', op: drones, ancho: 'medio' },
    { c: 'piloto', l: 'Piloto', t: 'opciones', op: () => opUsuarios(['Técnico', 'Agronomía', 'Dirección']), ancho: 'medio' },
    { c: 'baterias', l: 'Baterías usadas', t: 'multi', op: baterias, vacio: 'No hay baterías de flota propia registradas.' },
    { c: 'viento_ms', l: 'Viento', t: 'numero', suf: 'm/s', min: 0, max: 40, ancho: 'medio' },
    { c: 'temperatura', l: 'Temperatura', t: 'numero', suf: '°C', min: -10, max: 55, ancho: 'medio' },
    { c: 'humedad', l: 'Humedad relativa', t: 'numero', suf: '%', min: 0, max: 100, ancho: 'medio' },
    { c: 'estatus', l: 'Estatus de la etapa', t: 'opciones', op: ['En ejecución', 'Terminada'], ancho: 'medio' },
    { c: 'latitud', l: 'Latitud', t: 'oculto' }, { c: 'longitud', l: 'Longitud', t: 'oculto' },
    { c: 'observaciones', l: 'Observaciones', t: 'area', ph: 'Condiciones del cultivo, incidencias o comentarios del cliente' }
  ], base);
  const gps = botonGPS(g => { f1.campo('latitud').fijar(g.latitud); f1.campo('longitud').fijar(g.longitud); }, base.latitud ? base : null);
  const fotosAntes = selectorFotos('Fotos de antes', json(base.fotos_antes));
  const fotosDespues = selectorFotos('Fotos de después', json(base.fotos_despues));
  const firma = capturaFirma('Firma del cliente', base.firma_cliente_url);
  const guardar = boton(previa ? 'Guardar etapa' : 'Guardar etapa', { ic: 'check' });
  cuerpo.append(
    h('form.tarjeta.pila', { novalidate: true, onsubmit: e => e.preventDefault() }, h('h2.titulo-tarjeta', 'Datos de la aplicación'), f1.el),
    h('section.tarjeta.pila', h('h2.titulo-tarjeta', 'Ubicación y evidencias'), gps, fotosAntes.el, fotosDespues.el, firma.el),
    h('div.barra-acciones', boton('Cancelar', { tipo: 'fantasma', href: '#/os/' + id + '?vista=etapas' }), guardar));
  guardar.addEventListener('click', async () => {
    if (!f1.validar()) return toast('Revise los datos marcados.', 'error');
    guardar.disabled = true;
    try {
      const reg = Object.assign({ id: previa ? previa.id : undefined, os_id: id }, f1.leer());
      const g = await datos.guardar('EtapasServicio', reg, { version: previa ? previa.actualizado_en : undefined, resumen: `Etapa ${reg.numero} de ${os.folio || 'OS'}` });
      let n = 0;
      for (const b of fotosAntes.fotos()) await datos.adjuntar('EtapasServicio', g.id, 'fotos_antes', b, `Antes ${++n}.jpg`, { resumen: `Foto de antes · etapa ${reg.numero}` });
      n = 0;
      for (const b of fotosDespues.fotos()) await datos.adjuntar('EtapasServicio', g.id, 'fotos_despues', b, `Después ${++n}.jpg`, { resumen: `Foto de después · etapa ${reg.numero}` });
      const pad = firma.pad();
      if (pad && !pad.vacia()) await datos.adjuntar('EtapasServicio', g.id, 'firma_cliente_url', await pad.aBlob(), `Firma etapa ${reg.numero}.png`, { resumen: `Firma del cliente · etapa ${reg.numero}` });
      toast(`Etapa ${reg.numero} guardada` + (navigator.onLine ? '' : ' en este teléfono · se subirá al recuperar la señal'));
      ir('os/' + id + '?vista=etapas', { reemplazar: true });
    } catch (e) { toast(errorTexto(e), 'error'); guardar.disabled = false; }
  });
}

// ================= Rentas =================
const CHECK_DEFECTO = ['Equipo completo según el contrato', 'Sin daños visibles (documentar con fotos)', 'Baterías con ciclos registrados', 'Control remoto y accesorios incluidos'];
function puntosChecklist() {
  const sop = cat('SOPs').find(s => /renta/i.test(String(s.area || '') + ' ' + String(s.procedimiento || '')) && s.estatus === 'Vigente');
  if (sop) { const pasos = cat('SOPPasos').filter(p => p.sop_id === sop.id).sort((a, b) => num(a.numero) - num(b.numero)).map(p => p.descripcion); if (pasos.length) return pasos; }
  return CHECK_DEFECTO;
}

const cfgRentas = {
  tabla: 'Rentas', ruta: 'rentas', titulo: 'Rentas', singular: 'renta', singularMayus: 'Renta', femenino: true, icono: 'llave',
  campos: r => [
    { c: 'cliente_id', l: 'Cliente', t: 'opciones', op: opClientes, req: true },
    { c: 'equipos', l: 'Equipos a rentar', t: 'multi', op: () => opEquipos(e => e.propiedad !== 'Mercancía para venta' && (e.estatus === 'Disponible' || json(r && r.equipos).includes(e.serie))), req: true, vacio: 'No hay equipos de flota disponibles.' },
    { c: 'inicio', l: 'Inicio', t: 'fechahora', req: true, ancho: 'medio' },
    { c: 'fin', l: 'Fin', t: 'fechahora', req: true, ancho: 'medio', validar: (v, o) => (v && o.inicio && v <= o.inicio ? 'El fin debe ser posterior al inicio.' : '') },
    { c: 'tarifa', l: 'Tarifa sin IVA', t: 'dinero', req: true, ancho: 'medio' },
    { c: 'deposito', l: 'Depósito', t: 'dinero', ancho: 'medio' }
  ],
  columnas: [
    { l: 'Folio', v: r => r.folio || 'Sin folio aún', clase: 'clave' }, { l: 'Cliente', v: r => h('strong', nombreCliente(r.cliente_id)) },
    { l: 'Periodo', v: r => fechaHora(r.inicio) + ' – ' + fechaHora(r.fin) }, { l: 'Equipos', v: r => json(r.equipos).join(', ') || '—' },
    { l: 'Tarifa', v: r => dinero(r.tarifa), num: true }, { l: 'Estatus', v: r => chip(r.estatus || 'Pendiente de aprobación') }
  ],
  movil: { titulo: r => (r.folio || 'Renta') + ' · ' + nombreCliente(r.cliente_id), chip: r => chip(r.estatus || 'Pendiente de aprobación'), meta: r => [fechaHora(r.inicio), json(r.equipos).length + ' equipo(s)'] },
  texto: r => [r.folio, nombreCliente(r.cliente_id), json(r.equipos).join(' '), r.estatus].join(' '),
  filtros: [{ t: 'Por aprobar', f: r => r.estatus === 'Pendiente de aprobación' }, { t: 'Por entregar', f: r => r.estatus === 'Confirmada' }, { t: 'Entregadas', f: r => r.estatus === 'Entregada' }],
  orden: (a, b) => String(b.inicio || '').localeCompare(String(a.inicio || '')),
  tituloDe: r => r.folio || 'Renta', subDe: r => nombreCliente(r.cliente_id),
  puedeEditar: r => puede('Rentas', 'escribir') && (esDir() || r.estatus === 'Pendiente de aprobación'),
  subForm: 'Toda renta queda pendiente de aprobación de Dirección.',
  grupos: (r, defs) => [['Renta', defs.map(d => [d.l, mostrar(d, r[d.c])]).concat([['Contrato', enlace(r.contrato_url, 'Ver contrato')]])],
    ['Entrega', [['Checklist', resumenCheck(r.checklist_entrega)], ['Ciclos de batería', resumenCiclos(r.ciclos_bateria_entrega)], ['Fotos', `${json(r.fotos_entrega).length}`], ['Firma', r.firma_entrega_url ? enlace(r.firma_entrega_url, 'Ver firma') : '—']]],
    ['Devolución', [['Checklist', resumenCheck(r.checklist_devolucion)], ['Ciclos de batería', resumenCiclos(r.ciclos_bateria_devolucion)], ['Fotos', `${json(r.fotos_devolucion).length}`], ['Daños', r.danos || '—'], ['Cargos extra', dinero(r.cargos_extra)], ['Firma', r.firma_devolucion_url ? enlace(r.firma_devolucion_url, 'Ver firma') : '—']]]],
  acciones: r => {
    const est = r.estatus || 'Pendiente de aprobación', a = [];
    if (esDir() && est === 'Pendiente de aprobación') a.push(boton('Confirmar renta', { tipo: 'aprobar', onclick: () => cambiarRenta(r, 'Confirmada') }));
    if (puede('Rentas', 'escribir') && est === 'Confirmada') a.push(boton('Registrar entrega', { ic: 'llave', href: '#/rentas/' + r.id + '/entrega' }));
    if (puede('Rentas', 'escribir') && est === 'Entregada') a.push(boton('Registrar devolución', { ic: 'check', href: '#/rentas/' + r.id + '/devolucion' }));
    if (esDir() && est === 'Devuelta') a.push(boton('Cerrar renta', { tipo: 'aprobar', onclick: () => cambiarRenta(r, 'Cerrada') }));
    if (esDir() && ['Pendiente de aprobación', 'Confirmada'].includes(est)) a.push(boton('Cancelar renta', { tipo: 'peligro', onclick: () => cambiarRenta(r, 'Cancelada') }));
    return a;
  },
  extrasDetalle: async (r, cuerpo) => {
    if (puede('Rentas', 'escribir') && !r.contrato_url) {
      const inp = h('input', { type: 'file', accept: 'application/pdf,image/*', hidden: true });
      inp.addEventListener('change', async () => {
        const f = inp.files[0]; if (!f) return;
        if (f.size > 10 * 1024 * 1024) return toast('El archivo excede 10 MB.', 'error');
        await datos.adjuntar('Rentas', r.id, 'contrato_url', f, f.name, { resumen: 'Contrato de ' + (r.folio || 'renta') });
        toast('Contrato agregado' + (navigator.onLine ? '' : ' · se subirá al haber señal'));
      });
      cuerpo.append(h('div.fila', inp, boton('Adjuntar contrato (PDF o foto)', { tipo: 'secundario', ic: 'subir', onclick: () => inp.click() })));
    }
  }
};
const resumenCheck = v => { const l = json(v); return l.length ? `${l.filter(x => x.ok).length} de ${l.length} puntos en orden` : '—'; };
const resumenCiclos = v => { const l = json(v); return l.length ? l.map(x => `${x.serie}: ${x.ciclos}`).join(' · ') : '—'; };

async function cambiarRenta(r, estatus) {
  if (!(await confirmar('Cambiar estatus', `La renta ${r.folio || ''} pasará a "${estatus}".`, { tipo: estatus === 'Cancelada' ? 'peligro' : 'primario' }))) return;
  await datos.cambiarEstatus('Rentas', r.id, estatus, null, { resumen: `${r.folio || 'Renta'} → ${estatus}` });
  toast('Renta actualizada' + (navigator.onLine ? '' : ' · se subirá al haber señal'));
  setTimeout(() => ir('rentas/' + r.id, { reemplazar: true }), 250);
}

async function entregaDevolucion(c, { id }, modo) {
  let r;
  try { r = await datos.obtener('Rentas', id); } catch (e) { pantalla(c, { titulo: 'Renta', volver: 'rentas/' + id }).append(alerta('error', 'No se pudo abrir la renta', errorTexto(e))); return; }
  if (!r) { pantalla(c, { titulo: 'Renta', volver: 'rentas/' + id }).append(alerta('advertencia', 'Renta no disponible sin conexión')); return; }
  const entrega = modo === 'entrega';
  const cuerpo = pantalla(c, { titulo: entrega ? 'Registrar entrega' : 'Registrar devolución', sub: `${r.folio || 'Renta'} · ${nombreCliente(r.cliente_id)}`, volver: 'rentas/' + id });
  cuerpo.classList.add('no-refrescar');
  const puntos = puntosChecklist();
  const checks = puntos.map(p => { const i = h('input', { type: 'checkbox' }); return { p, i, el: h('label.opcion', i, h('span.opcion__marca', icono('check', 16)), p) }; });
  const baterias = json(r.equipos).filter(s => (cat('Equipos').find(e => e.serie === s) || {}).tipo === 'Batería');
  const ciclos = baterias.map(s => { const eq = cat('Equipos').find(e => e.serie === s) || {}; const i = h('input.entrada.entrada--numero', { inputmode: 'numeric', value: eq.ciclos ?? '', 'aria-label': 'Ciclos de ' + s }); return { s, i, el: h('label.campo', h('span.campo__etiqueta', `Ciclos de la batería ${s}`), i) }; });
  const fotos = selectorFotos(entrega ? 'Fotos de la entrega' : 'Fotos de la devolución');
  const firma = capturaFirma(entrega ? 'Firma de quien recibe' : 'Firma de quien devuelve');
  const fExtra = entrega ? null : formulario([{ c: 'danos', l: 'Daños encontrados', t: 'area', ph: 'Ninguno, o describa los daños' }, { c: 'cargos_extra', l: 'Cargos extra sin IVA', t: 'dinero' }], r);
  const guardar = boton(entrega ? 'Registrar entrega' : 'Registrar devolución', { ic: 'check' });
  cuerpo.append(
    h('section.tarjeta.pila', h('h2.titulo-tarjeta', 'Checklist'), h('div', checks.map(x => x.el))),
    ciclos.length ? h('section.tarjeta.pila', h('h2.titulo-tarjeta', 'Ciclos de batería'), ciclos.map(x => x.el)) : null,
    fExtra ? h('section.tarjeta.pila', h('h2.titulo-tarjeta', 'Daños y cargos'), fExtra.el) : null,
    h('section.tarjeta.pila', h('h2.titulo-tarjeta', 'Evidencias'), fotos.el, firma.el),
    h('div.barra-acciones', boton('Cancelar', { tipo: 'fantasma', href: '#/rentas/' + id }), guardar));
  guardar.addEventListener('click', async () => {
    const pad = firma.pad();
    if (!pad || pad.vacia()) return toast('Falta la firma.', 'error');
    guardar.disabled = true;
    const d = {};
    d[entrega ? 'checklist_entrega' : 'checklist_devolucion'] = checks.map(x => ({ punto: x.p, ok: x.i.checked }));
    d[entrega ? 'ciclos_bateria_entrega' : 'ciclos_bateria_devolucion'] = ciclos.map(x => ({ serie: x.s, ciclos: Number(x.i.value) || 0 }));
    if (fExtra) Object.assign(d, fExtra.leer());
    try {
      await datos.cambiarEstatus('Rentas', id, entrega ? 'Entregada' : 'Devuelta', d, { resumen: `${r.folio || 'Renta'} → ${entrega ? 'Entregada' : 'Devuelta'}` });
      let n = 0;
      for (const b of fotos.fotos()) await datos.adjuntar('Rentas', id, entrega ? 'fotos_entrega' : 'fotos_devolucion', b, `${entrega ? 'Entrega' : 'Devolución'} ${++n}.jpg`, { resumen: 'Foto de ' + modo });
      await datos.adjuntar('Rentas', id, entrega ? 'firma_entrega_url' : 'firma_devolucion_url', await pad.aBlob(), `Firma ${modo}.png`, { resumen: 'Firma de ' + modo });
      toast((entrega ? 'Entrega registrada' : 'Devolución registrada') + (navigator.onLine ? '' : ' · se subirá al haber señal'));
      ir('rentas/' + id, { reemplazar: true });
    } catch (e) { toast(errorTexto(e), 'error'); guardar.disabled = false; }
  });
}

export const rutas = [
  { p: 'os', r: listaOS },
  { p: 'os/nueva', r: (c, p, q) => formOS(c, {}, q) },
  { p: 'os/:id', r: (c, p, q) => detalleOS(c, p, q) },
  { p: 'os/:id/editar', r: (c, p, q) => formOS(c, p, q) },
  { p: 'os/:id/etapa/nueva', r: (c, p) => formEtapa(c, p) },
  { p: 'os/:id/etapa/:eid', r: (c, p) => formEtapa(c, p) },
  ...rutasCrud(cfgRentas).map(x => (x.p === 'rentas' ? Object.assign({}, x) : x)),
  { p: 'rentas/:id/entrega', r: (c, p) => entregaDevolucion(c, p, 'entrega') },
  { p: 'rentas/:id/devolucion', r: (c, p) => entregaDevolucion(c, p, 'devolucion') }
];
