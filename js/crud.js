// Motor genérico de pantallas por tabla: listado, detalle y formulario (alta/edición), con trabajo sin conexión.
import { h, icono, vaciar, toast, errorTexto, dinero, numero, pct, fecha, fechaHora, json, chip, chipPendiente, esqueleto, alerta, vacioV, boton } from './ui.js';
import { formulario } from './forms.js';
import * as datos from './datos.js';
import { puede, nombreUsuario } from './estado.js';
import { pantalla, listado, avisoCache } from './vistas.js';
import { ir } from './router.js';

/** Texto legible de un valor según la definición del campo. */
export function mostrar(def, v) {
  if (vacioV(v) || (Array.isArray(v) && !v.length)) return '—';
  switch (def.t) {
    case 'dinero': return dinero(v);
    case 'pct': return pct(v);
    case 'numero': return numero(v, def.suf);
    case 'fecha': return fecha(v);
    case 'fechahora': return fechaHora(v);
    case 'bool': return v === true || v === 'true' ? 'Sí' : 'No';
    case 'multi': {
      const ops = typeof def.op === 'function' ? def.op() : (def.op || []);
      return json(v).map(x => { const o = ops.find(z => String(typeof z === 'object' ? z.v : z) === String(x)); return o ? (typeof o === 'object' ? o.l : o) : x; }).join(', ');
    }
    case 'opciones': {
      const ops = typeof def.op === 'function' ? def.op() : (def.op || []);
      const o = ops.find(z => String(typeof z === 'object' ? z.v : z) === String(v));
      return o ? (typeof o === 'object' ? o.l : o) : String(v);
    }
    case 'usuario': return nombreUsuario(v);
    default: return String(v);
  }
}

export function paresDetalle(defs, r) {
  return defs.filter(d => d && d.t !== 'oculto' && d.t !== 'seccion' && !d.ocultarEnDetalle).map(d => [d.l, mostrar(d, r[d.c])]);
}

export function rutasCrud(cfg) {
  return [
    { p: cfg.ruta, r: (c, p, q) => pantallaLista(c, cfg, q) },
    { p: cfg.ruta + '/nuevo', r: (c, p, q) => pantallaForm(c, cfg, null, q) },
    { p: cfg.ruta + '/:id', r: (c, p) => pantallaDetalle(c, cfg, p.id) },
    { p: cfg.ruta + '/:id/editar', r: (c, p) => pantallaForm(c, cfg, p.id) }
  ];
}

export const puedeCrear = cfg => (cfg.puedeCrear ? cfg.puedeCrear() : puede(cfg.tabla, 'escribir'));
export const puedeEditar = (cfg, r) => (cfg.puedeEditar ? cfg.puedeEditar(r) : puede(cfg.tabla, 'escribir'));

export function botonNuevo(cfg, q) {
  if (!puedeCrear(cfg)) return null;
  const extra = q ? '?' + new URLSearchParams(q).toString() : '';
  return boton(cfg.textoNuevo || (cfg.femenino ? 'Nueva ' : 'Nuevo ') + cfg.singular, { ic: 'mas', href: '#/' + cfg.ruta + '/nuevo' + extra });
}

/** Lista dentro de un contenedor (sirve para pestañas). */
export async function renderLista(cont, cfg, { filtro, sinBoton, q } = {}) {
  vaciar(cont); cont.append(esqueleto(3));
  try {
    const { registros, desdeCache } = await datos.listar(cfg.tabla);
    const regs = filtro ? registros.filter(filtro) : registros;
    vaciar(cont);
    const av = avisoCache(desdeCache); if (av) cont.append(av);
    if (!sinBoton && cfg.botonEnLista) { const b = botonNuevo(cfg, q); if (b) cont.append(h('div.fila', b)); }
    cont.append(listado({
      registros: regs, columnas: cfg.columnas, movil: cfg.movil, texto: cfg.texto, filtros: cfg.filtros, filtroInicial: cfg.filtroInicial,
      orden: cfg.orden, buscarPh: cfg.buscarPh, href: r => cfg.ruta + '/' + r.id,
      vacio: { ic: cfg.icono, t: cfg.vacio?.t || `Aún no hay ${cfg.titulo.toLowerCase()}`, d: cfg.vacio?.d || '', accion: botonNuevo(cfg, q) }
    }));
  } catch (e) { vaciar(cont); cont.append(alerta('error', 'No se pudo cargar la información', errorTexto(e))); }
}

async function pantallaLista(c, cfg, q) {
  const cuerpo = pantalla(c, { titulo: cfg.titulo, sub: cfg.sub, acciones: [botonNuevo(cfg, q)] });
  const zona = h('div'); cuerpo.append(zona);
  await renderLista(zona, cfg, { sinBoton: true, q });
}

async function pantallaDetalle(c, cfg, id) {
  const cuerpo = pantalla(c, { titulo: cfg.singularMayus || cfg.titulo, volver: cfg.ruta });
  cuerpo.append(esqueleto(2));
  let r;
  try { r = await datos.obtener(cfg.tabla, id); } catch (e) { vaciar(cuerpo); cuerpo.append(alerta('error', 'No se pudo abrir el registro', errorTexto(e))); return; }
  if (!r) { vaciar(cuerpo); cuerpo.append(alerta('advertencia', 'Registro no disponible', 'No está en este teléfono. Conéctese para consultarlo.')); return; }
  const acciones = [];
  if (puedeEditar(cfg, r)) acciones.push(boton('Editar', { tipo: 'secundario', ic: 'editar', href: '#/' + cfg.ruta + '/' + id + '/editar' }));
  if (cfg.acciones) acciones.push(...cfg.acciones(r).filter(Boolean));
  const est = cfg.estatusDe ? cfg.estatusDe(r) : r.estatus;
  const cuerpo2 = pantalla(c, {
    titulo: cfg.tituloDe ? cfg.tituloDe(r) : (cfg.singularMayus || cfg.titulo), volver: cfg.ruta, acciones,
    chip: r._pendiente ? chipPendiente() : (est ? chip(est) : null), sub: cfg.subDe ? cfg.subDe(r) : null
  });
  const av = avisoCache(r._desdeCache); if (av) cuerpo2.append(av);
  const defs = cfg.campos(r).filter(Boolean);
  const grupos = cfg.grupos ? cfg.grupos(r, defs) : [[null, paresDetalle(defs, r)]];
  const cont = h('div.rejilla--2');
  grupos.forEach(([t, pares]) => cont.append(h('div.panel-datos', t ? h('div.panel-datos__titulo', t) : null, h('dl.datos', pares.flatMap(([k, v]) => [h('dt', k), h('dd', v)])))));
  if (cfg.calculados) cont.append(h('div.panel-datos', h('div.panel-datos__titulo', 'Calculado por el sistema'), h('dl.datos', cfg.calculados.filter(d => r[d.c] !== undefined).flatMap(d => [h('dt', d.l), h('dd', mostrar(d, r[d.c]))]))));
  cuerpo2.append(cont);
  if (cfg.extrasDetalle) await cfg.extrasDetalle(r, cuerpo2);
  cuerpo2.append(h('p.texto-sm.texto-suave', `Creado por ${nombreUsuario(r.creado_por) || '—'} el ${fechaHora(r.creado_en)} · última edición de ${nombreUsuario(r.actualizado_por) || '—'} el ${fechaHora(r.actualizado_en)}${r.origen ? ' (' + r.origen + ')' : ''}`));
}

async function pantallaForm(c, cfg, id, q = {}) {
  let previo = null;
  if (id) {
    const cu = pantalla(c, { titulo: 'Editar ' + cfg.singular, volver: cfg.ruta + '/' + id }); cu.append(esqueleto(2));
    try { previo = await datos.obtener(cfg.tabla, id); } catch (e) { vaciar(cu); cu.append(alerta('error', 'No se pudo abrir el registro', errorTexto(e))); return; }
  }
  const base = previo || Object.assign({}, cfg.nuevo ? cfg.nuevo(q) : {}, q || {});
  const cuerpo = pantalla(c, { titulo: (id ? 'Editar ' : (cfg.textoNuevoTitulo || (cfg.femenino ? 'Nueva ' : 'Nuevo '))) + cfg.singular, volver: id ? cfg.ruta + '/' + id : cfg.ruta, sub: cfg.subForm || null });
  const f = formulario(cfg.campos(base).filter(Boolean), base);
  const textoGuardar = 'Guardar ' + cfg.singular;
  const guardar = boton(textoGuardar, { ic: 'check' });
  const barra = h('div.barra-acciones', boton('Cancelar', { tipo: 'fantasma', href: '#/' + (id ? cfg.ruta + '/' + id : cfg.ruta) }), guardar);
  cuerpo.append(h('form.tarjeta.pila', { novalidate: true, onsubmit: e => e.preventDefault() }, f.el), barra);
  if (cfg.extrasForm) cfg.extrasForm(f, cuerpo, base);
  guardar.addEventListener('click', async () => {
    if (!f.validar()) { toast('Revise los datos marcados.', 'error'); return; }
    let reg = Object.assign({ id: id || undefined }, f.leer());
    if (cfg.antesDeGuardar) { const m = cfg.antesDeGuardar(reg, previo); if (typeof m === 'string') { toast(m, 'error'); return; } if (m) reg = m; }
    guardar.disabled = true;
    try {
      const g = await datos.guardar(cfg.tabla, reg, { version: previo ? previo.actualizado_en : undefined, resumen: (id ? 'Edición de ' : 'Alta de ') + cfg.singular + ': ' + (cfg.tituloDe ? cfg.tituloDe(Object.assign({}, previo || {}, reg)) : '') });
      toast(cfg.singularMayus + (cfg.femenino ? ' guardada' : ' guardado') + (navigator.onLine ? '' : ' en este teléfono · se subirá al haber señal'));
      if (cfg.despuesDeGuardar) await cfg.despuesDeGuardar(g, previo);
      else ir(cfg.ruta + '/' + g.id, { reemplazar: true });
    } catch (e) { toast(errorTexto(e), 'error'); guardar.disabled = false; }
  });
}
