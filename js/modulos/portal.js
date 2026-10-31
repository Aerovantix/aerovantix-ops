// Portal de clientes desde la app interna (solo Dirección): bandeja de Solicitudes (revisar, aprobar y asignar, rechazar),
// accesos de clientes (crear, restablecer contraseña temporal, activar/desactivar) y «Ver como cliente» (solo lectura, 1 h).
// Las contraseñas nunca se guardan ni se muestran después: la temporal se ve una sola vez para entregarla al cliente.
import { h, icono, vaciar, toast, chip, boton, alerta, esqueleto, errorTexto, fecha, fechaHora, numero, modal } from '../ui.js';
import { pantalla, listado, avisoCache } from '../vistas.js';
import { formulario } from '../forms.js';
import * as datos from '../datos.js';
import { esDir, nombreUsuario, cat } from '../estado.js';
import { bus } from '../api.js';
import { ir } from '../router.js';
import { PORTAL_URL } from '../config.js';
import { nombreCliente, nombreParcela, opUsuarios } from './comunes.js';
import { barraProgreso, progresoMini } from '../progreso.js';

export const PENDIENTES_SOL = ['Recibida', 'En revisión'];
const chipSol = e => chip(e, { 'Recibida': 'pendiente', 'En revisión': 'proceso', 'Aprobada': 'aprobado', 'Rechazada': 'rechazado' }[e]);
const RUTA_DESTINO = { Oportunidades: 'oportunidades', Tickets: 'tickets' };

// ================= Solicitudes =================
async function listaSolicitudes(c) {
  const cuerpo = pantalla(c, { titulo: 'Solicitudes de clientes', sub: 'Llegan desde el portal. Revise, apruebe y asigne responsable, o rechace con un motivo que el cliente verá.' });
  const zona = h('div'); cuerpo.append(zona); zona.append(esqueleto(3));
  let regs, desdeCache;
  try { ({ registros: regs, desdeCache } = await datos.listar('Solicitudes')); } catch (e) { vaciar(zona).append(alerta('error', 'No se pudieron cargar las solicitudes', errorTexto(e))); return; }
  vaciar(zona); const av = avisoCache(desdeCache); if (av) zona.append(av);
  zona.append(listado({
    registros: regs, buscarPh: 'Buscar folio, cliente o tipo',
    columnas: [
      { l: 'Folio', v: r => r.folio || '—', clase: 'clave' },
      { l: 'Cliente', v: r => h('span', h('strong', nombreCliente(r.cliente_id)), h('span.sub', r.descripcion || '')) },
      { l: 'Tipo', v: r => r.tipo },
      { l: 'Recibida', v: r => fecha(r.creado_en) },
      { l: 'Progreso', v: r => progresoMini(r.progreso) || '—' },
      { l: 'Estatus', v: r => chipSol(r.estatus) }
    ],
    movil: { titulo: r => (r.folio || 'Solicitud') + ' · ' + nombreCliente(r.cliente_id), chip: r => chipSol(r.estatus), meta: r => [r.tipo, fecha(r.creado_en)] },
    texto: r => [r.folio, nombreCliente(r.cliente_id), r.tipo, r.descripcion, r.estatus].join(' '),
    filtros: [{ t: 'Por atender', f: r => PENDIENTES_SOL.includes(r.estatus) }, { t: 'Aprobadas', f: r => r.estatus === 'Aprobada' }, { t: 'Rechazadas', f: r => r.estatus === 'Rechazada' }],
    filtroInicial: 0,
    orden: (a, b) => (PENDIENTES_SOL.includes(b.estatus) - PENDIENTES_SOL.includes(a.estatus)) || String(b.creado_en || '').localeCompare(String(a.creado_en || '')),
    href: r => 'solicitudes/' + r.id,
    vacio: { ic: 'aviso', t: 'Aún no hay solicitudes', d: 'Cuando un cliente pida un servicio desde su portal, aparecerá aquí para que la apruebe y la asigne.' }
  }));
}

async function detalleSolicitud(c, { id }) {
  const cuerpo0 = pantalla(c, { titulo: 'Solicitud', volver: 'solicitudes' }); cuerpo0.append(esqueleto(2));
  let s;
  try { s = await datos.obtener('Solicitudes', id); } catch (e) { vaciar(cuerpo0).append(alerta('error', 'No se pudo abrir la solicitud', errorTexto(e))); return; }
  if (!s) { vaciar(cuerpo0).append(alerta('advertencia', 'Solicitud no disponible', 'Conéctese para consultarla.')); return; }
  const pendiente = PENDIENTES_SOL.includes(s.estatus);
  const acciones = pendiente && esDir() ? [
    s.estatus === 'Recibida' ? boton('Tomar en revisión', { tipo: 'secundario', ic: 'reloj', onclick: () => accion('revisarSolicitud', { id }, 'Solicitud en revisión. El cliente ya lo ve en su portal.') }) : null,
    boton('Rechazar', { tipo: 'peligro', ic: 'cerrar', onclick: () => rechazar(s) }),
    boton('Aprobar y asignar', { tipo: 'aprobar', ic: 'aprobar', onclick: () => aprobar(s) })
  ] : [];
  const cuerpo = pantalla(c, { titulo: s.folio || 'Solicitud', volver: 'solicitudes', chip: chipSol(s.estatus), sub: nombreCliente(s.cliente_id) + ' · ' + s.tipo, acciones });
  const av = avisoCache(s._desdeCache); if (av) cuerpo.append(av);
  const prog = barraProgreso(s.progreso, { titulo: 'Progreso que ve el cliente' }); if (prog) cuerpo.append(prog);
  const [tabla, rid] = String(s.referencia || '').split(':');
  const pares = [
    ['Cliente', h('a', { href: '#/clientes/' + s.cliente_id }, nombreCliente(s.cliente_id))], ['Tipo', s.tipo], ['Recibida', fechaHora(s.creado_en)],
    s.parcela_id ? ['Parcela', nombreParcela(s.parcela_id)] : null, s.cultivo ? ['Cultivo', s.cultivo] : null,
    s.hectareas ? ['Superficie', numero(s.hectareas, 'ha')] : null, s.fecha_deseada ? ['Fecha deseada', fecha(s.fecha_deseada)] : null,
    s.equipo_serie ? ['Equipo', s.equipo_serie] : null, ['Lo que necesita', s.descripcion || '—']
  ].filter(Boolean);
  const resol = s.estatus === 'Aprobada' ? [['Responsable', nombreUsuario(s.responsable)], ['Aprobada el', fechaHora(s.fecha_respuesta)],
    ['Se creó', RUTA_DESTINO[tabla] && rid ? h('a', { href: '#/' + RUTA_DESTINO[tabla] + '/' + rid }, tabla === 'Tickets' ? 'Ticket de soporte' : 'Oportunidad') : '—']]
    : s.estatus === 'Rechazada' ? [['Rechazada el', fechaHora(s.fecha_respuesta)], ['Motivo (lo ve el cliente)', s.motivo_rechazo || '—']] : null;
  const panel = (t, ps) => h('div.panel-datos', h('div.panel-datos__titulo', t), h('dl.datos', ps.flatMap(([k, v]) => [h('dt', k), h('dd', v)])));
  cuerpo.append(h('div.rejilla--2', panel('Solicitud del cliente', pares), resol ? panel('Resolución', resol) : null));
  if (pendiente && !navigator.onLine) cuerpo.append(alerta('info', 'Sin conexión', 'Aprobar, asignar o rechazar requiere señal, porque el cliente lo ve al instante en su portal.'));

  async function accion(nombre, d, msj) {
    try { await datos.enLinea(nombre, d); toast(msj); bus.emit('solicitudes-cambio'); detalleSolicitud(c, { id }); return true; }
    catch (e) { toast(errorTexto(e), 'error'); return false; }
  }
  function aprobar(sol) {
    const esMant = sol.tipo === 'Mantenimiento de dron';
    const f = formulario([
      { c: 'responsable', l: 'Responsable', t: 'opciones', op: () => opUsuarios(['Dirección', 'Agronomía', 'Técnico', 'Piloto']), req: true,
        ayuda: esMant ? 'Se abrirá un ticket de soporte a su nombre.' : 'Se creará una oportunidad en Prospecto a su nombre para cotizar.' },
      { c: 'comentario', l: 'Nota para el responsable', t: 'area', filas: 2, ayuda: 'Opcional. Solo la ve el equipo interno.' }
    ], { responsable: (cat('Usuarios').find(u => u.rol === (esMant ? 'Técnico' : 'Agronomía')) || {}).usuario || '' }, { columnas: false });
    modal({ titulo: 'Aprobar ' + (sol.folio || 'solicitud'), cuerpo: h('div.pila', h('p', 'El cliente verá su solicitud como aprobada y el nombre de quien le dará seguimiento.'), f.el),
      acciones: [{ texto: 'Cancelar', tipo: 'fantasma', valor: null }, { texto: 'Aprobar y asignar', tipo: 'aprobar', icono: 'aprobar', fn: async () => {
        if (!f.validar()) return false;
        return accion('aprobarSolicitud', Object.assign({ id: sol.id }, f.leer()), 'Solicitud aprobada y asignada. Avisamos al responsable y al cliente.');
      } }] });
  }
  function rechazar(sol) {
    const f = formulario([{ c: 'motivo', l: 'Motivo', t: 'area', filas: 3, req: true, ayuda: 'El cliente lo verá en su portal. Escriba con trato de usted.',
      validar: v => (String(v || '').length < 3 ? 'Escriba el motivo.' : '') }], {}, { columnas: false });
    modal({ titulo: 'Rechazar ' + (sol.folio || 'solicitud'), cuerpo: f.el,
      acciones: [{ texto: 'Cancelar', tipo: 'fantasma', valor: null }, { texto: 'Rechazar solicitud', tipo: 'peligro', fn: async () => {
        if (!f.validar()) return false;
        return accion('rechazarSolicitud', { id: sol.id, motivo: f.leer().motivo }, 'Solicitud rechazada. El cliente verá el motivo.');
      } }] });
  }
}

// ================= Accesos al portal (sección en el detalle del cliente) =================
const ALFABETO = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
/** Contraseña temporal aleatoria (12 caracteres sin letras confusas). Se muestra una sola vez y el cliente debe cambiarla al entrar. */
export function contrasenaTemporal() {
  const b = crypto.getRandomValues(new Uint32Array(12));
  const s = [...b].map(x => ALFABETO[x % ALFABETO.length]).join('');
  return s.slice(0, 4) + '-' + s.slice(4, 8) + '-' + s.slice(8);
}
const sugerirUsuario = nombre => String(nombre || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/\b(s\.?\s?a\.?|de|c\.?\s?v\.?|s\.?\s?p\.?\s?r\.?|r\.?\s?l\.?|del|la|los|las|y)\b/g, ' ').trim().split(/[^a-z0-9]+/).filter(Boolean).slice(0, 2).join('.').slice(0, 30);

function copiar(texto) {
  const ok = () => toast('Copiado.', 'info', 2500);
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(texto).then(ok, () => toast('No se pudo copiar. Selecciónelo y cópielo a mano.', 'error'));
  else toast('Su navegador no permite copiar. Selecciónelo y cópielo a mano.', 'error');
}

function mostrarCredenciales(cliente, usuario, temporal, nuevo) {
  const mensaje = `Estimado(a) ${cliente.contacto || cliente.nombre}:\n\n${nuevo ? 'Le damos la bienvenida al Portal de clientes de Aerovantix' : 'Restablecimos su acceso al Portal de clientes de Aerovantix'}. Ahí puede consultar sus cotizaciones, el avance de sus servicios, su estado de cuenta y enviarnos solicitudes.\n\nDirección: ${PORTAL_URL}\nUsuario: ${usuario}\nContraseña temporal: ${temporal}\n\nAl entrar le pediremos que elija una contraseña propia.\n\nAerovantix · Tecnología y soluciones agrícolas con drones`;
  modal({ titulo: nuevo ? 'Acceso creado' : 'Contraseña restablecida', cuerpo: h('div.pila',
    alerta('advertencia', 'Esta contraseña temporal se muestra una sola vez', 'Cópiela ahora y entréguela al cliente por un medio de confianza. No se guarda en ningún lado; si la pierde, restablézcala de nuevo.'),
    h('dl.datos', h('dt', 'Usuario'), h('dd', h('strong', usuario)), h('dt', 'Portal'), h('dd', PORTAL_URL)),
    h('div.clave-temporal', h('span', { 'aria-label': 'Contraseña temporal' }, temporal), boton('Copiar', { tipo: 'secundario', chico: true, onclick: () => copiar(temporal) })),
    boton('Copiar mensaje para el cliente', { tipo: 'secundario', ic: 'aviso', bloque: true, onclick: () => copiar(mensaje) }),
    h('p.texto-sm.texto-suave', 'El mensaje va con trato de usted e incluye la dirección del portal, el usuario y la contraseña temporal. Usted decide por dónde enviarlo; la app no lo manda.')),
  acciones: [{ texto: 'Listo', tipo: 'primario', valor: true }] });
}

/** Abre el portal con una sesión de solo lectura (1 h). La ventana se abre antes de esperar al motor para que el navegador no la bloquee. */
async function verComoCliente(cliente) {
  if (!navigator.onLine) return toast('Necesita señal para ver el portal del cliente.', 'error');
  const w = window.open('about:blank', '_blank');
  try {
    const r = await datos.enLinea('verComoCliente', { cliente_id: cliente.id });
    const url = PORTAL_URL + '#vercomo=' + encodeURIComponent(r.token);
    if (w) { try { w.opener = null; } catch (e) { /* sin acción */ } w.location.replace(url); toast(`Abrimos el portal de ${cliente.nombre} en solo lectura por 1 h. Queda registrado.`, 'info', 6000); }
    else modal({ titulo: 'Ver como cliente', cuerpo: h('div.pila', h('p', `Sesión de solo lectura lista para ${cliente.nombre} (1 h). Queda registrada en la bitácora del portal.`),
      h('a.boton.boton--primario.boton--bloque', { href: url, target: '_blank', rel: 'noopener' }, icono('derecha', 20), 'Abrir el portal')), acciones: [] });
  } catch (e) { if (w) w.close(); toast(errorTexto(e), 'error'); }
}

export async function seccionAcceso(cliente, cuerpo) {
  if (!esDir()) return;
  const zona = h('div.pila');
  cuerpo.append(h('section.pila', h('div.fila.encabezado-seccion', h('h2.titulo-seccion', 'Portal de clientes')), zona));
  const pintar = async () => {
    vaciar(zona).append(esqueleto(1));
    let acc = null;
    try { const r = await datos.listar('AccesosClientes', { cliente_id: cliente.id }); acc = r.registros[0] || null; }
    catch (e) { vaciar(zona).append(alerta('error', 'No se pudo consultar el acceso', errorTexto(e))); return; }
    vaciar(zona);
    if (!acc) {
      zona.append(h('div.tarjeta.pila', h('p', 'Este cliente aún no tiene acceso a su portal. Con él consulta cotizaciones, el avance de sus servicios con fotos y firma, su estado de cuenta, y le envía solicitudes.'),
        h('div.fila', boton('Crear acceso', { ic: 'mas', onclick: crear }), boton('Ver como cliente', { tipo: 'secundario', ic: 'buscar', onclick: () => verComoCliente(cliente) }))));
      return;
    }
    const activo = acc.activo === true || acc.activo === 'TRUE';
    const estado = !activo ? chip('Inactivo') : acc.bloqueado ? chip('Bloqueado') : acc.debe_cambiar_contrasena === true ? chip('Contraseña temporal', 'pendiente') : chip('Activo');
    zona.append(h('div.panel-datos', h('div.panel-datos__titulo', 'Acceso'), h('dl.datos',
      h('dt', 'Usuario'), h('dd', h('strong', acc.usuario)), h('dt', 'Contacto'), h('dd', acc.nombre_contacto || '—'),
      h('dt', 'Estado'), h('dd', estado), h('dt', 'Último acceso'), h('dd', acc.ultimo_acceso ? fechaHora(acc.ultimo_acceso) : 'Aún no entra'))),
    h('div.fila',
      boton('Ver como cliente', { ic: 'buscar', onclick: () => verComoCliente(cliente) }),
      boton('Restablecer contraseña', { tipo: 'secundario', ic: 'llave', onclick: () => restablecer(acc) }),
      boton(activo ? 'Desactivar acceso' : 'Activar acceso', { tipo: activo ? 'fantasma' : 'secundario', onclick: () => activar(acc, !activo) })),
    h('p.texto-sm.texto-suave', '«Ver como cliente» abre el portal exactamente como lo ve el cliente, en solo lectura durante 1 h, y queda registrado. Las contraseñas nunca se guardan ni se pueden consultar.'));
  };
  async function crear() {
    const f = formulario([
      { c: 'usuario', l: 'Usuario', t: 'texto', req: true, ayuda: '3 a 30 caracteres: minúsculas, números, punto o guion. No puede repetir el de otro usuario.',
        validar: v => (/^[a-z0-9._-]{3,30}$/.test(String(v || '').toLowerCase()) ? '' : 'Use 3 a 30 caracteres: minúsculas, números, punto o guion.') },
      { c: 'nombre_contacto', l: 'Nombre del contacto', t: 'texto', ayuda: 'Quien usará el portal (un usuario por cliente).' }
    ], { usuario: sugerirUsuario(cliente.nombre), nombre_contacto: cliente.contacto || '' }, { columnas: false });
    modal({ titulo: 'Crear acceso al portal', cuerpo: h('div.pila', h('p', `Generaremos una contraseña temporal para ${cliente.nombre}. Al entrar por primera vez, el portal le pedirá elegir una propia.`), f.el),
      acciones: [{ texto: 'Cancelar', tipo: 'fantasma', valor: null }, { texto: 'Crear acceso', tipo: 'primario', icono: 'check', fn: async () => {
        if (!f.validar()) return false;
        const d = f.leer(), temporal = contrasenaTemporal();
        try { await datos.enLinea('crearAccesoCliente', { cliente_id: cliente.id, usuario: d.usuario.toLowerCase(), nombre_contacto: d.nombre_contacto, contrasena_temporal: temporal }); }
        catch (e) { toast(errorTexto(e), 'error'); return false; }
        mostrarCredenciales(cliente, d.usuario.toLowerCase(), temporal, true); pintar(); return true;
      } }] });
  }
  async function restablecer(acc) {
    modal({ titulo: 'Restablecer contraseña', cuerpo: h('p', `Se generará una contraseña temporal nueva para ${acc.usuario} y se cerrarán sus sesiones abiertas. El cliente deberá cambiarla al entrar.`),
      acciones: [{ texto: 'Cancelar', tipo: 'fantasma', valor: null }, { texto: 'Restablecer', tipo: 'primario', fn: async () => {
        const temporal = contrasenaTemporal();
        try { await datos.enLinea('restablecerAccesoCliente', { usuario: acc.usuario, contrasena_temporal: temporal }); }
        catch (e) { toast(errorTexto(e), 'error'); return false; }
        mostrarCredenciales(cliente, acc.usuario, temporal, false); pintar(); return true;
      } }] });
  }
  async function activar(acc, valor) {
    try { await datos.enLinea('actualizarAccesoCliente', { usuario: acc.usuario, activo: valor }); toast(valor ? 'Acceso activado.' : 'Acceso desactivado. Se cerraron sus sesiones.'); pintar(); }
    catch (e) { toast(errorTexto(e), 'error'); }
  }
  await pintar();
}

export const rutas = [
  { p: 'solicitudes', r: listaSolicitudes, ver: () => esDir() },
  { p: 'solicitudes/:id', r: (c, p) => detalleSolicitud(c, p), ver: () => esDir() }
];
