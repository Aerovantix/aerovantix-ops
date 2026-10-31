// Cotizaciones: editor con partidas (paquetes desglosados por componente), envío a aprobación y vista previa fiel a la plantilla oficial.
import { h, icono, vaciar, toast, dinero, pct, numero, chip, boton, alerta, esqueleto, errorTexto, fecha, fechaHora, json, vacioV, num, hoyIso, sumarDiasIso, confirmar, chipPendiente } from '../ui.js';
import { formulario } from '../forms.js';
import { pantalla, listado, avisoCache } from '../vistas.js';
import * as datos from '../datos.js';
import { esDir, puede, cat, param, usuario } from '../estado.js';
import { ir } from '../router.js';
import { opClientes, nombreCliente, opParcelas, skuInfo, opSkus, vincularParcelas } from './comunes.js';

const r2 = n => Math.round((n + Number.EPSILON) * 100) / 100;
const EDITABLE = ['Borrador', 'Pendiente de aprobación'];

// ---------- Cálculo (espejo del motor; el motor recalcula y manda al guardar) ----------
function reparto(comps, precioPaquete) {
  const filas = comps.map(c => { const k = skuInfo(c.sku); return { k, cant: num(c.cant) || 1, peso: num(k && k.precio_lista) * (num(c.cant) || 1) }; });
  const total = filas.reduce((s, f) => s + f.peso, 0);
  return filas.map(f => { const imp = total > 0 ? precioPaquete * f.peso / total : 0; return { k: f.k, cant: f.cant, unitario: f.cant ? imp / f.cant : 0 }; });
}

export function desglosar(partidas) {
  const lineas = [], problemas = [];
  partidas.forEach(p => {
    const k = skuInfo(p.sku);
    if (!k) { if (p.sku) problemas.push(`El SKU ${p.sku} no está en el catálogo.`); return; }
    const cant = num(p.cantidad), desc = num(p.descuento_pct);
    const comps = json(k.componentes);
    if (comps.length) {
      reparto(comps, num(k.precio_lista)).forEach(c => {
        if (!c.k) { problemas.push(`Un componente de ${k.sku} no está en el catálogo.`); return; }
        if (vacioV(c.k.tasa_iva)) problemas.push(`El componente ${c.k.sku} no tiene tasa de IVA capturada por Dirección.`);
        lineas.push({ sku: c.k.sku, k: c.k, cantidad: cant * c.cant, precio: c.unitario, desc, detalle: 'Incluido en ' + k.sku + (p.detalle ? ' · ' + p.detalle : '') });
      });
    } else {
      if (vacioV(k.tasa_iva)) problemas.push(`El SKU ${k.sku} no tiene tasa de IVA capturada por Dirección.`);
      lineas.push({ sku: k.sku, k, cantidad: cant, precio: num(k.precio_lista), desc, detalle: p.detalle || '' });
    }
  });
  let subtotal = 0, iva16 = 0, base0 = 0;
  const salida = lineas.map((l, i) => {
    const tasa = num(l.k.tasa_iva), precio = r2(l.precio), importe = r2(l.cantidad * precio * (1 - l.desc)), iva = r2(importe * tasa);
    subtotal += importe; if (tasa > 0) iva16 += iva; else base0 += importe;
    return { partida: i + 1, sku: l.sku, descripcion: l.k.descripcion, detalle: l.detalle, cantidad: l.cantidad, unidad: l.k.unidad, precio_unitario: precio, descuento_pct: l.desc, tasa_iva: tasa, importe, iva, excede_descuento_max: l.desc > num(param('descuento_maximo', 0)) + 1e-9 };
  });
  const total = r2(subtotal + iva16);
  return { detalle: salida, subtotal: r2(subtotal), iva_16: r2(iva16), iva_0: r2(base0), total, total_letra: numeroALetras(total), problemas };
}

export function numeroALetras(monto) {
  monto = r2(monto);
  const entero = Math.floor(monto), cent = Math.round((monto - entero) * 100);
  const U = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE', 'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE', 'VEINTE', 'VEINTIÚN', 'VEINTIDÓS', 'VEINTITRÉS', 'VEINTICUATRO', 'VEINTICINCO', 'VEINTISÉIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE'];
  const D = ['', '', '', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
  const C = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];
  const cen = x => { if (!x) return ''; if (x === 100) return 'CIEN'; const c = Math.floor(x / 100), r = x % 100; const t = r < 30 ? U[r] : D[Math.floor(r / 10)] + (r % 10 ? ' Y ' + U[r % 10] : ''); return (C[c] + (C[c] && t ? ' ' : '') + t).trim(); };
  const mil = x => { const m = Math.floor(x / 1000), r = x % 1000; const s = !m ? '' : (m === 1 ? 'MIL' : cen(m) + ' MIL'); const t = cen(r); return (s + (s && t ? ' ' : '') + t).trim(); };
  const mill = Math.floor(entero / 1e6), resto = entero % 1e6;
  const sm = !mill ? '' : (mill === 1 ? 'UN MILLÓN' : mil(mill) + ' MILLONES');
  const sr = mil(resto);
  const letras = entero === 0 ? 'CERO' : (sm + (sm && sr ? ' ' : '') + sr).trim();
  let moneda = entero === 1 ? 'PESO' : 'PESOS';
  if (entero >= 1e6 && entero % 1e6 === 0) moneda = 'DE ' + moneda;
  return 'SON: ' + letras + ' ' + moneda + ' ' + String(cent).padStart(2, '0') + '/100 M.N.';
}

// ---------- Listado ----------
async function pantallaLista(c) {
  const cuerpo = pantalla(c, { titulo: 'Cotizaciones', sub: 'Precios sin IVA; el IVA se desglosa por tasa. El PDF oficial se genera al aprobarse.',
    acciones: [puede('Cotizaciones', 'escribir') ? boton('Nueva cotización', { ic: 'mas', href: '#/cotizaciones/nueva' }) : null] });
  const zona = h('div'); cuerpo.append(zona); zona.append(esqueleto(3));
  let regs, desdeCache;
  try { ({ registros: regs, desdeCache } = await datos.listar('Cotizaciones')); } catch (e) { vaciar(zona).append(alerta('error', 'No se pudieron cargar las cotizaciones', errorTexto(e))); return; }
  vaciar(zona);
  const av = avisoCache(desdeCache); if (av) zona.append(av);
  const hoy = hoyIso();
  zona.append(listado({
    registros: regs, buscarPh: 'Buscar folio o cliente',
    columnas: [
      { l: 'Folio', v: r => r.folio || 'Sin folio aún', clase: 'clave' },
      { l: 'Cliente', v: r => h('span', h('strong', nombreCliente(r.cliente_id)), h('span.sub', [r.cultivo, r.superficie_ha ? numero(r.superficie_ha, 'ha') : ''].filter(Boolean).join(' · '))) },
      { l: 'Emisión', v: r => fecha(r.fecha_emision) },
      { l: 'Vigente hasta', v: r => h('span', { style: r.vigente_hasta && r.vigente_hasta < hoy && ['Aprobada', 'Enviada'].includes(r.estatus) ? { color: 'var(--avx-error)', fontWeight: 700 } : null }, fecha(r.vigente_hasta)) },
      { l: 'Total con IVA', v: r => dinero(r.total), num: true },
      { l: 'Estatus', v: r => h('span.fila', { style: { gap: '6px' } }, chip(r.estatus || 'Borrador'), r.estatus === 'Enviada' && r.respuesta_cliente ? chip('Cliente: ' + r.respuesta_cliente.toLowerCase(), 'pendiente') : null) }
    ],
    movil: { titulo: r => (r.folio || 'Borrador') + ' · ' + nombreCliente(r.cliente_id), chip: r => (r.estatus === 'Enviada' && r.respuesta_cliente ? chip('Cliente: ' + r.respuesta_cliente.toLowerCase(), 'pendiente') : chip(r.estatus || 'Borrador')), meta: r => [dinero(r.total), 'Vigencia ' + fecha(r.vigente_hasta)] },
    texto: r => [r.folio, nombreCliente(r.cliente_id), r.cultivo, r.estatus].join(' '),
    filtros: [{ t: 'Borradores', f: r => r.estatus === 'Borrador' }, { t: 'Por aprobar', f: r => r.estatus === 'Pendiente de aprobación' }, { t: 'Aprobadas y enviadas', f: r => ['Aprobada', 'Enviada'].includes(r.estatus) }, { t: 'Aceptadas', f: r => r.estatus === 'Aceptada' }],
    orden: (a, b) => String(b.fecha_emision || '').localeCompare(String(a.fecha_emision || '')) || String(b.folio || '').localeCompare(String(a.folio || '')),
    href: r => 'cotizaciones/' + r.id,
    vacio: { ic: 'cotizacion', t: 'Aún no hay cotizaciones', d: 'Cree la primera desde una oportunidad o desde cero.', accion: puede('Cotizaciones', 'escribir') ? boton('Nueva cotización', { ic: 'mas', href: '#/cotizaciones/nueva' }) : null }
  }));
}

// ---------- Editor ----------
async function editor(c, { id }, q) {
  let r = null;
  const cu = pantalla(c, { titulo: id ? 'Editar cotización' : 'Nueva cotización', volver: id ? 'cotizaciones/' + id : 'cotizaciones' });
  cu.append(esqueleto(2));
  if (id) { try { r = await datos.obtener('Cotizaciones', id); } catch (e) { vaciar(cu).append(alerta('error', 'No se pudo abrir la cotización', errorTexto(e))); return; } }
  if (r && !EDITABLE.includes(r.estatus) && !esDir()) { vaciar(cu).append(alerta('advertencia', 'Esta cotización ya no se puede editar', `Estatus: ${r.estatus}. Solo Dirección modifica cotizaciones aprobadas.`)); return; }
  let oportunidades = [];
  try { oportunidades = (await datos.listar('Oportunidades')).registros; } catch (e) { /* sin acción */ }

  const base = r || Object.assign({ fecha_emision: hoyIso(), forma_pago: 'Contado', estatus: 'Borrador' }, q);
  if (!r && q.parcela_id) llenarDesdeParcela(base, q.parcela_id);
  if (!r && q.cliente_id) { const cl = cat('Clientes').find(x => x.id === q.cliente_id); if (cl && !base.contacto) base.contacto = cl.contacto || ''; }
  const opOport = clienteId => oportunidades.filter(o => (!clienteId || o.cliente_id === clienteId) && !['Ganada', 'Perdida'].includes(o.etapa)).map(o => ({ v: o.id, l: `${o.tipo || 'Oportunidad'} · ${nombreCliente(o.cliente_id)}` }));
  const cuerpo = pantalla(c, { titulo: id ? 'Editar ' + (r.folio || 'cotización') : 'Nueva cotización', volver: id ? 'cotizaciones/' + id : 'cotizaciones',
    sub: 'Los precios vienen del catálogo. El sistema confirma los totales al guardar.' });
  cuerpo.classList.add('no-refrescar');

  const fCliente = formulario([
    { c: 'cliente_id', l: 'Cliente', t: 'opciones', op: opClientes, req: true },
    { c: 'oportunidad_id', l: 'Oportunidad', t: 'opciones', op: () => opOport(base.cliente_id), ph: 'Sin oportunidad ligada', ancho: 'medio' },
    { c: 'contacto', l: 'Contacto', t: 'texto', ancho: 'medio' },
    { c: 'fecha_emision', l: 'Fecha de emisión', t: 'fecha', req: true, ancho: 'medio' },
    { c: 'parcela_id', l: 'Parcela del cliente', t: 'opciones', op: () => opParcelas(base.cliente_id), ph: 'Sin parcela', ancho: 'medio' },
    { c: 'predio', l: 'Predio', t: 'texto', ancho: 'medio' }, { c: 'municipio', l: 'Municipio', t: 'texto', ancho: 'medio' },
    { c: 'estado', l: 'Estado', t: 'texto', ancho: 'medio' }, { c: 'coordenadas', l: 'Coordenadas', t: 'texto', ancho: 'medio' }
  ], base);
  vincularParcelas(fCliente);
  const cl = fCliente.campo('cliente_id'), op = fCliente.campo('oportunidad_id'), pa = fCliente.campo('parcela_id');
  cl.control.addEventListener('change', () => {
    while (op.control.options.length > 1) op.control.remove(1);
    opOport(cl.control.value).forEach(o => op.control.append(new Option(o.l, o.v)));
    const k = cat('Clientes').find(x => x.id === cl.control.value);
    if (k && !fCliente.campo('contacto').control.value) fCliente.campo('contacto').fijar(k.contacto || '');
  });
  pa.control.addEventListener('change', () => {
    const t = {}; llenarDesdeParcela(t, pa.control.value);
    ['predio', 'municipio', 'estado', 'coordenadas'].forEach(k => { if (t[k] !== undefined) fCliente.campo(k).fijar(t[k]); });
    if (t.cultivo !== undefined) fAlcance.campo('cultivo').fijar(t.cultivo);
    if (t.superficie_ha !== undefined) fAlcance.campo('superficie_ha').fijar(t.superficie_ha);
  });

  const fAlcance = formulario([
    { c: 'cultivo', l: 'Cultivo', t: 'texto', ancho: 'medio' }, { c: 'superficie_ha', l: 'Superficie', t: 'numero', suf: 'ha', ancho: 'medio' },
    { c: 'aplicaciones_numero', l: 'Número de aplicaciones', t: 'numero', ancho: 'medio' }, { c: 'aplicaciones_tipo', l: 'Tipo de aplicación', t: 'texto', ancho: 'medio' },
    { c: 'ventana_inicio', l: 'Ventana: desde', t: 'fecha', ancho: 'medio' }, { c: 'ventana_fin', l: 'Ventana: hasta', t: 'fecha', ancho: 'medio' },
    { c: 'equipo', l: 'Equipo a utilizar', t: 'texto' }
  ], base);

  const fCond = formulario([
    { c: 'forma_pago', l: 'Forma de pago', t: 'opciones', op: ['Contado', 'Crédito'], req: true, ancho: 'medio' },
    { c: 'credito_dias', l: 'Días de crédito', t: 'numero', suf: 'días', ancho: 'medio', validar: (v, o) => (o.forma_pago === 'Crédito' && !v ? 'Indique los días de crédito.' : '') },
    { c: 'tiempo_entrega', l: 'Tiempo de entrega', t: 'texto', ph: 'Solo si aplica' },
    { c: 'garantia', l: 'Garantía', t: 'texto', ph: 'Solo si Dirección la indica' },
    { c: 'incluye', l: 'Incluye', t: 'area', filas: 2 }, { c: 'no_incluye', l: 'No incluye', t: 'area', filas: 2 },
    { c: 'nota_1', l: 'Nota 1', t: 'texto' }, { c: 'nota_2', l: 'Nota 2', t: 'texto' }, { c: 'nota_3', l: 'Nota 3', t: 'texto' }
  ], base);

  // Partidas
  const partidas = (r && r.detalle ? agruparPartidas(r.detalle) : []).map(p => Object.assign({ _k: Math.random() }, p));
  if (!partidas.length) partidas.push({ _k: Math.random(), sku: '', cantidad: 1, descuento_pct: 0, detalle: '' });
  const zonaPartidas = h('div.partidas');
  const zonaTotales = h('div.totales-cot', { 'aria-live': 'polite' });
  const opciones = opSkus();
  function pintarPartidas() {
    vaciar(zonaPartidas);
    partidas.forEach((p, i) => {
      const sel = h('select.selector', { 'aria-label': 'SKU de la partida ' + (i + 1) }, h('option', { value: '' }, 'Elija un SKU del catálogo…'), opciones.map(o => h('option', { value: o.v }, o.l)));
      sel.value = p.sku || '';
      const cant = h('input.entrada.entrada--numero', { inputmode: 'decimal', value: p.cantidad, 'aria-label': 'Cantidad' });
      const desc = h('input.entrada.entrada--numero', { inputmode: 'decimal', value: p.descuento_pct ? Math.round(num(p.descuento_pct) * 10000) / 100 : '', placeholder: '0', 'aria-label': 'Descuento en %' });
      const det = h('input.entrada', { value: p.detalle || '', placeholder: 'Detalle opcional', 'aria-label': 'Detalle' });
      const k = skuInfo(p.sku);
      const comps = k ? json(k.componentes) : [];
      const info = h('div.partida__info', k ? [h('span', `Lista ${dinero(k.precio_lista)} / ${k.unidad || 'pieza'}`), comps.length ? h('span', `Paquete: se desglosa en ${comps.length} componentes con su tasa de IVA`) : h('span', vacioV(k.tasa_iva) ? 'Sin tasa de IVA: no se puede cotizar' : 'IVA ' + pct(k.tasa_iva))] : null);
      if (num(p.descuento_pct) > num(param('descuento_maximo', 0)) + 1e-9) info.append(h('span.chip.chip--pendiente', 'Descuento mayor al máximo: Dirección debe comentar al aprobar'));
      const quitar = h('button.boton.boton--icono', { type: 'button', 'aria-label': 'Quitar partida ' + (i + 1), onclick: () => { partidas.splice(i, 1); if (!partidas.length) partidas.push({ _k: Math.random(), sku: '', cantidad: 1 }); pintarPartidas(); } }, icono('cerrar'));
      sel.addEventListener('change', () => { p.sku = sel.value; pintarPartidas(); });
      cant.addEventListener('input', () => { p.cantidad = Number(cant.value.replace(',', '.')) || 0; pintarTotales(); });
      desc.addEventListener('change', () => { p.descuento_pct = Math.min(0.99, Math.max(0, (Number(desc.value.replace(',', '.')) || 0) / 100)); pintarPartidas(); });
      det.addEventListener('input', () => { p.detalle = det.value; });
      zonaPartidas.append(h('div.partida',
        h('span.partida__num', String(i + 1)),
        h('div.partida__campos',
          h('label.campo.partida__sku', h('span.campo__etiqueta', 'SKU'), sel),
          h('label.campo', h('span.campo__etiqueta', 'Cantidad'), cant),
          h('label.campo', h('span.campo__etiqueta', 'Descuento'), h('span.campo__control', desc, h('span.campo__sufijo', '%'))),
          h('label.campo.partida__detalle', h('span.campo__etiqueta', 'Detalle'), det), info),
        quitar));
    });
    pintarTotales();
  }
  function pintarTotales() {
    const t = desglosar(partidas.filter(p => p.sku));
    vaciar(zonaTotales);
    if (t.problemas.length) zonaTotales.append(alerta('advertencia', 'Revise las partidas', t.problemas.join(' ')));
    zonaTotales.append(h('dl.totales',
      h('dt', 'Subtotal'), h('dd', dinero(t.subtotal)), h('dt', 'IVA 16 %'), h('dd', dinero(t.iva_16)),
      t.iva_0 ? [h('dt', 'Base a tasa 0 %'), h('dd', dinero(t.iva_0))] : null,
      h('dt.totales__total', 'Total MXN'), h('dd.totales__total', dinero(t.total))), h('p.texto-sm.texto-suave', t.total_letra + ' · Estimado; el sistema confirma al guardar.'));
  }
  pintarPartidas();

  const leer = () => {
    const reg = Object.assign({ id: id || undefined }, fCliente.leer(), fAlcance.leer(), fCond.leer());
    reg.detalle = partidas.filter(p => p.sku).map(p => ({ id: p.id && !p._derivado ? p.id : undefined, sku: p.sku, cantidad: num(p.cantidad), descuento_pct: num(p.descuento_pct), detalle: p.detalle || '' }));
    return reg;
  };
  const validar = () => {
    const ok = [fCliente, fAlcance, fCond].map(f => f.validar()).every(Boolean);
    if (!ok) { toast('Revise los datos marcados.', 'error'); return false; }
    const lineas = partidas.filter(p => p.sku);
    if (!lineas.length) { toast('Agregue al menos una partida.', 'error'); return false; }
    if (lineas.some(p => !(num(p.cantidad) > 0))) { toast('Cada partida necesita una cantidad mayor que cero.', 'error'); return false; }
    const t = desglosar(lineas);
    if (t.problemas.length) { toast(t.problemas[0], 'error'); return false; }
    return true;
  };
  async function guardar(enviar) {
    if (!validar()) return;
    const reg = leer();
    if (enviar) reg.estatus = 'Pendiente de aprobación';
    else if (!r) reg.estatus = 'Borrador';
    try {
      const g = await datos.guardar('Cotizaciones', reg, { version: r ? r.actualizado_en : undefined, resumen: 'Cotización para ' + nombreCliente(reg.cliente_id) });
      toast(enviar ? 'Cotización enviada a aprobación' : 'Borrador guardado' + (navigator.onLine ? '' : ' en este teléfono · se subirá al haber señal'));
      ir('cotizaciones/' + g.id, { reemplazar: true });
    } catch (e) { toast(errorTexto(e), 'error'); }
  }
  const bVista = boton('Vista previa del documento', { tipo: 'secundario', ic: 'pdf', onclick: () => {
    const reg = leer(); const t = desglosar(partidas.filter(p => p.sku));
    abrirVistaPrevia(Object.assign({}, r || {}, reg, t, { folio: (r && r.folio) || 'COT-AVX-AAAAMM-###', vigente_hasta: sumarDiasIso(reg.fecha_emision || hoyIso(), num(param('vigencia_cotizacion_dias', 15))) }));
  } });
  cuerpo.append(
    h('section.tarjeta.pila', h('h2.titulo-tarjeta', 'Cliente y ubicación del proyecto'), fCliente.el),
    h('section.tarjeta.pila', h('h2.titulo-tarjeta', 'Alcance'), fAlcance.el),
    h('section.tarjeta.pila', h('div.fila.encabezado-seccion', h('h2.titulo-tarjeta', 'Partidas'), boton('Agregar partida', { tipo: 'secundario', ic: 'mas', chico: true, onclick: () => { partidas.push({ _k: Math.random(), sku: '', cantidad: 1, descuento_pct: 0 }); pintarPartidas(); } })),
      h('p.texto-sm.texto-suave', `Descuento máximo autorizado: ${pct(param('descuento_maximo', 0))}. Uno mayor exige un comentario de Dirección al aprobar.`), zonaPartidas, zonaTotales, h('div.fila', bVista)),
    h('section.tarjeta.pila', h('h2.titulo-tarjeta', 'Condiciones comerciales y notas'), fCond.el),
    h('div.barra-acciones', boton('Cancelar', { tipo: 'fantasma', href: '#/' + (id ? 'cotizaciones/' + id : 'cotizaciones') }),
      boton('Guardar borrador', { tipo: 'secundario', onclick: () => guardar(false) }),
      (!r || r.estatus === 'Borrador') && !esDir() ? boton('Enviar a aprobación', { ic: 'aprobar', onclick: () => guardar(true) }) : (esDir() ? boton('Enviar a aprobación', { ic: 'aprobar', onclick: () => guardar(true) }) : null)));
}

function llenarDesdeParcela(o, parcelaId) {
  const p = cat('Parcelas').find(x => x.id === parcelaId);
  if (!p) return;
  o.parcela_id = p.id; o.predio = p.nombre_predio || ''; o.municipio = p.municipio || ''; o.estado = p.estado || '';
  o.coordenadas = p.latitud && p.longitud ? `${p.latitud}, ${p.longitud}` : '';
  if (p.cultivo) o.cultivo = p.cultivo;
  if (p.hectareas) o.superficie_ha = p.hectareas;
}

/** Las partidas guardadas vienen desglosadas; se reagrupan por paquete para editar. */
function agruparPartidas(detalle) {
  const out = [], vistos = {};
  detalle.forEach(d => {
    const m = /^Incluido en ([^·]+?)(?: · (.*))?$/.exec(d.detalle || '');
    if (m) {
      const sku = m[1].trim();
      const k = skuInfo(sku); const comp = k ? json(k.componentes).find(x => x.sku === d.sku) : null;
      const cant = comp ? num(d.cantidad) / (num(comp.cant) || 1) : num(d.cantidad);
      const clave = sku + '|' + cant + '|' + d.descuento_pct + '|' + (m[2] || '');
      if (!vistos[clave]) { vistos[clave] = true; out.push({ sku, cantidad: cant, descuento_pct: num(d.descuento_pct), detalle: m[2] || '', _derivado: true }); }
    } else out.push({ id: d.id, sku: d.sku, cantidad: num(d.cantidad), descuento_pct: num(d.descuento_pct), detalle: d.detalle || '' });
  });
  return out;
}

// ---------- Detalle ----------
async function detalle(c, { id }) {
  const cu = pantalla(c, { titulo: 'Cotización', volver: 'cotizaciones' }); cu.append(esqueleto(3));
  let r;
  try { r = await datos.obtener('Cotizaciones', id); } catch (e) { vaciar(cu).append(alerta('error', 'No se pudo abrir la cotización', errorTexto(e))); return; }
  if (!r) { vaciar(cu).append(alerta('advertencia', 'Cotización no disponible sin conexión')); return; }
  const det = r.detalle && r.detalle.length ? r.detalle : desglosar(r.detalle || []).detalle;
  const totales = r._pendiente && !r.total ? desglosar(agruparPartidas(det)) : r;
  const est = r.estatus || 'Borrador';
  const acc = [];
  if (EDITABLE.includes(est) && puede('Cotizaciones', 'escribir') || (esDir() && est === 'Aprobada')) acc.push(boton('Editar', { tipo: 'secundario', ic: 'editar', href: '#/cotizaciones/' + id + '/editar' }));
  acc.push(boton('Vista previa', { tipo: 'secundario', ic: 'pdf', onclick: () => abrirVistaPrevia(Object.assign({}, r, { detalle: det }, totales.total ? {} : totales)) }));
  if (r.pdf_url) acc.push(boton('Abrir PDF', { ic: 'pdf', href: r.pdf_url, attrs: { target: '_blank', rel: 'noopener' } }));
  if (est === 'Borrador' && puede('Cotizaciones', 'escribir')) acc.push(boton('Enviar a aprobación', { ic: 'aprobar', onclick: () => cambiar(r, 'Pendiente de aprobación', 'Cotización enviada a aprobación') }));
  if (esDir()) {
    if (est === 'Aprobada') acc.push(boton('Marcar como enviada', { onclick: () => cambiar(r, 'Enviada', 'Cotización marcada como enviada') }));
    if (['Aprobada', 'Enviada'].includes(est)) {
      acc.push(boton('Cliente la aceptó', { tipo: 'aprobar', onclick: () => cambiar(r, 'Aceptada', 'Cotización aceptada · la oportunidad queda Ganada') }));
      acc.push(boton('Cliente la rechazó', { tipo: 'peligro', onclick: () => cambiar(r, 'Rechazada', 'Cotización marcada como rechazada') }));
    }
  }
  const cuerpo = pantalla(c, { titulo: r.folio || 'Cotización sin folio', sub: nombreCliente(r.cliente_id) + (r.vigente_hasta ? ' · vigente hasta ' + fecha(r.vigente_hasta) : ''), volver: 'cotizaciones',
    chip: r._pendiente ? chipPendiente() : chip(est), acciones: acc });
  const av = avisoCache(r._desdeCache); if (av) cuerpo.append(av);
  if (est === 'Pendiente de aprobación') cuerpo.append(alerta('info', 'En espera de aprobación de Dirección', 'Al aprobarse se asigna el PDF oficial. No se envía nada al cliente automáticamente.'));
  if (r._pendiente) cuerpo.append(alerta('advertencia', 'Cambios por subir', 'El folio y los totales definitivos los asigna el sistema al sincronizar.'));
  if (r.respuesta_cliente && est === 'Enviada') {
    const acepto = r.respuesta_cliente === 'Aceptada';
    cuerpo.append(alerta(acepto ? 'exito' : 'advertencia', acepto ? 'El cliente la aceptó desde su portal' : 'El cliente pidió cambios desde su portal',
      [r.fecha_respuesta_cliente ? fechaHora(r.fecha_respuesta_cliente) : '', r.comentario_cliente ? '«' + r.comentario_cliente + '»' : ''].filter(Boolean).join(' · ') +
      (acepto ? (esDir() ? ' Confírmelo con «Cliente la aceptó» para ganar la oportunidad.' : ' Dirección lo confirmará.') : ' Prepare una cotización actualizada.')));
  } else if (r.respuesta_cliente === 'Cambios solicitados' && r.comentario_cliente) {
    cuerpo.append(alerta('info', 'Cambios que pidió el cliente', '«' + r.comentario_cliente + '»'));
  }
  cuerpo.append(h('div.rejilla--2',
    h('div.panel-datos', h('div.panel-datos__titulo', 'Cliente'), h('dl.datos', h('dt', 'Nombre'), h('dd', nombreCliente(r.cliente_id)), h('dt', 'Contacto'), h('dd', r.contacto || '—'), h('dt', 'Emisión'), h('dd', fecha(r.fecha_emision)), h('dt', 'Forma de pago'), h('dd', r.forma_pago === 'Crédito' ? `Crédito a ${r.credito_dias} días` : (r.forma_pago || '—')))),
    h('div.panel-datos', h('div.panel-datos__titulo', 'Ubicación y alcance'), h('dl.datos', h('dt', 'Predio'), h('dd', [r.predio, r.municipio, r.estado].filter(Boolean).join(', ') || '—'), h('dt', 'Cultivo'), h('dd', r.cultivo || '—'), h('dt', 'Superficie'), h('dd', numero(r.superficie_ha, 'ha')), h('dt', 'Aplicaciones'), h('dd', [r.aplicaciones_numero, r.aplicaciones_tipo].filter(Boolean).join(' · ') || '—')))));
  cuerpo.append(tablaPartidas(det, totales));
}

function tablaPartidas(det, t) {
  return h('section.pila', h('h2.titulo-seccion', 'Partidas'),
    h('div.tabla-contenedor', h('table.tabla',
      h('thead', h('tr', h('th', '#'), h('th', 'Clave'), h('th', 'Descripción'), h('th.num', 'Cant.'), h('th.num', 'P. unitario'), h('th.num', 'Desc.'), h('th.num', 'IVA'), h('th.num', 'Importe'))),
      h('tbody', det.map((d, i) => h('tr', h('td', String(d.partida || i + 1)), h('td.clave', d.sku), h('td', d.descripcion, d.detalle ? h('span.sub', d.detalle) : null, d.excede_descuento_max ? h('span.sub', { style: { color: 'var(--avx-advertencia)', fontWeight: 700 } }, 'Descuento mayor al máximo') : null),
        h('td.num', numero(d.cantidad)), h('td.num', dinero(d.precio_unitario)), h('td.num', num(d.descuento_pct) ? pct(d.descuento_pct) : '—'), h('td.num', pct(d.tasa_iva)), h('td.num', dinero(d.importe))))),
      h('tfoot',
        h('tr', h('td', { colspan: 7, class: 'num' }, 'Subtotal'), h('td.num', dinero(t.subtotal))),
        h('tr', h('td', { colspan: 7, class: 'num' }, 'IVA 16 %'), h('td.num', dinero(t.iva_16))),
        num(t.iva_0) ? h('tr', h('td', { colspan: 7, class: 'num' }, 'Base a tasa 0 %'), h('td.num', dinero(t.iva_0))) : null,
        h('tr.tabla__total', h('td', { colspan: 7, class: 'num' }, 'TOTAL MXN'), h('td.num', dinero(t.total)))))),
    h('p.texto-sm.texto-suave', { style: { textAlign: 'right' } }, t.total_letra || ''));
}

async function cambiar(r, estatus, mensaje) {
  if (!(await confirmar('Cambiar estatus', `La cotización ${r.folio || ''} pasará a "${estatus}".`, { textoSi: 'Confirmar' }))) return;
  await datos.cambiarEstatus('Cotizaciones', r.id, estatus, null, { resumen: `Cotización ${r.folio || ''} → ${estatus}` });
  toast(mensaje + (navigator.onLine ? '' : ' · se subirá al haber señal'));
  setTimeout(() => ir('cotizaciones/' + r.id, { reemplazar: true }), 300);
}

// ---------- Vista previa fiel a la plantilla oficial ----------
export function documentoCotizacion(r) {
  const P = k => param(k, '');
  const det = r.detalle || [];
  const fila = (k, v) => (vacioV(v) ? null : h('p.doc-cot__dato', h('span.doc-cot__etq', k + ': '), h('span.doc-cot__val', v)));
  const cond = [
    ['Forma de pago', r.forma_pago === 'Crédito' ? `Crédito a ${r.credito_dias || 'N'} días naturales a partir de la fecha de factura.` : 'De contado, al aceptar esta cotización.'],
    r.tiempo_entrega ? ['Tiempo de entrega', r.tiempo_entrega] : null,
    ['Vigencia', `${P('vigencia_cotizacion_dias') || 15} días naturales, hasta el ${fecha(r.vigente_hasta)}. Después de esa fecha, los precios están sujetos a cambio.`],
    ['Moneda', 'Pesos mexicanos (MXN), con IVA desglosado por partida.'],
    r.garantia ? ['Garantía', r.garantia] : null,
    r.incluye ? ['Incluye', r.incluye] : null,
    r.no_incluye ? ['No incluye', r.no_incluye] : null,
    ['Clima', 'Si la lluvia, el viento u otras condiciones del clima no permiten una aplicación segura y eficaz, reprogramamos el servicio sin costo para usted en la fecha disponible más próxima. La decisión la toma nuestro personal en campo.']
  ].filter(Boolean);
  const notas = [r.nota_1, r.nota_2, r.nota_3].filter(x => !vacioV(x));
  const cliente = cat('Clientes').find(x => x.id === r.cliente_id) || {};
  return h('article.doc-cot', { 'aria-label': 'Vista previa de la cotización' },
    h('header.doc-cot__enc',
      h('img.doc-cot__logo', { src: 'img/lockup-color.png', alt: 'Aerovantix' }),
      h('div.doc-cot__folio', h('h1', 'COTIZACIÓN'),
        h('p', h('span.doc-cot__etq', 'Folio  '), h('span.doc-cot__val', r.folio || 'COT-AVX-AAAAMM-###')),
        h('p', h('span.doc-cot__etq', 'Fecha de emisión  '), h('span.doc-cot__val', fecha(r.fecha_emision))),
        h('p', h('span.doc-cot__etq', 'Vigente hasta  '), h('span.doc-cot__val', fecha(r.vigente_hasta))))),
    h('p.doc-cot__empresa', h('span.doc-cot__marca', P('nombre_comercial') || 'Aerovantix'), '  ', [conPais(P('direccion')), P('telefono') ? 'Tel. ' + P('telefono') : '', P('correo')].filter(Boolean).join('  ·  ')),
    h('div.doc-cot__dos',
      h('div.doc-cot__caja', h('p.doc-cot__titulo-caja', 'CLIENTE'), fila('Nombre', cliente.nombre || nombreCliente(r.cliente_id)), fila('Contacto', r.contacto), fila('Teléfono', cliente.telefono), fila('Correo', cliente.correo), fila('RFC', cliente.rfc)),
      h('div.doc-cot__caja', h('p.doc-cot__titulo-caja', 'UBICACIÓN DEL PROYECTO'), fila('Predio', r.predio), fila('Municipio', r.municipio), fila('Estado', r.estado), fila('Coordenadas', r.coordenadas))),
    h('h2.doc-cot__sec', 'ALCANCE'),
    h('div.doc-cot__alcance', fila('Cultivo', r.cultivo), fila('Superficie', r.superficie_ha ? numero(r.superficie_ha, 'ha') : ''),
      fila('Aplicaciones', [r.aplicaciones_numero, r.aplicaciones_tipo, r.ventana_inicio ? `del ${fecha(r.ventana_inicio)} al ${fecha(r.ventana_fin)}` : ''].filter(Boolean).join(', ')), fila('Equipo', r.equipo)),
    h('h2.doc-cot__sec', 'PARTIDAS (MXN)'),
    h('table.doc-cot__partidas',
      h('thead', h('tr', h('th.c', '#'), h('th', 'Clave'), h('th', 'Descripción'), h('th.d', 'Cant.'), h('th', 'Unidad'), h('th.d', 'P. unitario'), h('th.d', 'Desc.'), h('th.d', 'Importe'))),
      h('tbody', det.map((d, i) => h('tr', h('td.c.gris', String(d.partida || i + 1)), h('td.clave', d.sku),
        h('td', h('span.desc', d.descripcion), (d.detalle || num(d.tasa_iva) === 0) ? h('span.det', [d.detalle, num(d.tasa_iva) === 0 ? 'IVA tasa 0%' : ''].filter(Boolean).join(' · ')) : null),
        h('td.c', numero(d.cantidad)), h('td.clave', d.unidad || ''), h('td.d', dinero(d.precio_unitario)), h('td.d.gris', num(d.descuento_pct) ? pct(d.descuento_pct) : '—'), h('td.d', dinero(d.importe)))))),
    h('table.doc-cot__totales', h('tbody',
      h('tr', h('td.e', 'Subtotal'), h('td.v', dinero(r.subtotal))),
      h('tr', h('td.e', 'IVA 16%'), h('td.v', dinero(r.iva_16))),
      num(r.iva_0) ? h('tr', h('td.e', 'IVA 0%'), h('td.v', dinero(0))) : null,
      h('tr.total', h('td.e', 'TOTAL MXN'), h('td.v', dinero(r.total))))),
    h('p.doc-cot__letra', r.total_letra ? r.total_letra.replace(/^SON:/, 'Son:') : ''),
    h('h2.doc-cot__sec', 'CONDICIONES COMERCIALES'),
    h('table.doc-cot__cond', h('tbody', cond.map(([k, v]) => h('tr', h('td.k', k), h('td', v))))),
    notas.length ? [h('h2.doc-cot__sec', 'NOTAS'), notas.map(n => h('p.doc-cot__nota', n))] : null,
    h('p.doc-cot__cierre', 'Gracias por considerar a Aerovantix. Quedamos a sus órdenes para resolver cualquier duda y acompañarle en cada etapa de su proyecto.'),
    h('div.doc-cot__firma', h('p.nombre', P('firmante')), h('p.cargo', P('cargo_firmante')), h('p.cargo', [P('telefono') ? 'Tel. ' + P('telefono') : '', P('correo')].filter(Boolean).join('  ·  '))),
    h('footer.doc-cot__pie', 'Aerovantix · Tecnología y soluciones agrícolas con drones · Ciudad Guzmán, Jalisco', h('span', 'Página 1')));
}

function conPais(d) { return !d ? '' : (/m[eé]xico\s*$/i.test(String(d).trim()) ? d : String(d).trim() + ', México'); }

export function abrirVistaPrevia(r) {
  const doc = documentoCotizacion(r);
  const lienzo = h('div.doc-lienzo', doc);
  const marco = h('div.doc-marco', lienzo);
  const capa = h('div.doc-capa', { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Vista previa de la cotización' },
    h('div.doc-capa__barra', h('strong', 'Vista previa · ' + (r.folio || 'cotización')), h('span.texto-sm.doc-capa__nota', 'El PDF oficial lo genera el sistema al aprobarse.'),
      h('button.boton.boton--icono', { type: 'button', 'aria-label': 'Cerrar vista previa', onclick: () => cerrar() }, icono('cerrar'))),
    marco);
  const ajustar = () => { const w = marco.clientWidth - 32; const e = Math.min(1, w / 816); lienzo.style.transform = `scale(${e})`; lienzo.style.height = doc.offsetHeight * e + 'px'; lienzo.style.width = 816 * e + 'px'; };
  const ro = new ResizeObserver(ajustar);
  function cerrar() { ro.disconnect(); capa.remove(); document.body.style.overflow = ''; removeEventListener('keydown', esc); }
  const esc = e => { if (e.key === 'Escape') cerrar(); };
  addEventListener('keydown', esc);
  document.body.append(capa); document.body.style.overflow = 'hidden';
  ro.observe(marco); requestAnimationFrame(ajustar);
  doc.querySelector('img').addEventListener('load', ajustar);
}

export const rutas = [
  { p: 'cotizaciones', r: pantallaLista },
  { p: 'cotizaciones/nueva', r: (c, p, q) => editor(c, {}, q) },
  { p: 'cotizaciones/:id', r: (c, p) => detalle(c, p) },
  { p: 'cotizaciones/:id/editar', r: (c, p, q) => editor(c, p, q) }
];
