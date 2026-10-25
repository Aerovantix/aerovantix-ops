// Usuarios (Dirección), Arranque, Pendientes de subir y Ayuda (instalación en iPhone y Android).
import { h, icono, vaciar, toast, dinero, numero, chip, boton, alerta, esqueleto, errorTexto, fecha, fechaHora, json, vacioV, num, hoyIso, confirmar, modal } from '../ui.js';
import { formulario } from '../forms.js';
import { pantalla, listado, avisoCache } from '../vistas.js';
import * as datos from '../datos.js';
import * as db from '../db.js';
import * as sync from '../sync.js';
import { esDir, puede, cat, rol, usuario, nombreUsuario, refrescarBootstrap } from '../estado.js';
import { ir } from '../router.js';
import { VERSION } from '../config.js';

const ROLES = ['Dirección', 'Agronomía', 'Técnico', 'Socio'];

// ---------- Usuarios ----------
function camposUsuario(nuevo) {
  return [
    nuevo ? { c: 'usuario', l: 'Usuario', t: 'texto', req: true, ancho: 'medio', ayuda: '3 a 30 caracteres: minúsculas, números, punto o guion.', validar: v => (v && !/^[a-z0-9._-]{3,30}$/.test(v) ? 'Use de 3 a 30 caracteres: minúsculas, números, punto o guion.' : '') } : null,
    { c: 'nombre', l: 'Nombre completo', t: 'texto', req: true, ancho: nuevo ? 'medio' : null },
    { c: 'rol', l: 'Rol', t: 'opciones', op: ROLES, req: true, ancho: 'medio' },
    { c: 'puesto', l: 'Puesto', t: 'texto', ancho: 'medio' },
    { c: 'correo', l: 'Correo interno', t: 'correo', ancho: 'medio', ayuda: 'Recibe los avisos de Aerovantix Ops.' },
    { c: 'fecha_ingreso', l: 'Fecha de ingreso', t: 'fecha', ancho: 'medio' },
    { c: 'sueldo_diario', l: 'Sueldo diario', t: 'dinero', ancho: 'medio', ayuda: 'Solo lo ve Dirección. Alimenta la pestaña Nómina.' },
    { c: 'activo', l: 'Usuario activo', t: 'bool', def: true },
    nuevo ? { c: 'contrasena_temporal', l: 'Contraseña temporal', t: 'texto', req: true, auto: 'new-password', ayuda: 'Al menos 8 caracteres. La persona la cambia en su primer inicio de sesión.', validar: v => (v && v.length < 8 ? 'Use al menos 8 caracteres.' : '') } : null
  ].filter(Boolean);
}

async function pantallaUsuarios(c) {
  const cuerpo = pantalla(c, { titulo: 'Usuarios', sub: 'Altas, roles y contraseñas temporales del equipo. Requiere conexión.', acciones: [boton('Nuevo usuario', { ic: 'mas', href: '#/usuarios/nuevo' })] });
  const zona = h('div'); cuerpo.append(zona); zona.append(esqueleto(2));
  let regs, desdeCache;
  try { ({ registros: regs, desdeCache } = await datos.listar('Usuarios')); } catch (e) { vaciar(zona).append(alerta('error', 'No se pudieron cargar los usuarios', errorTexto(e))); return; }
  vaciar(zona); const av = avisoCache(desdeCache); if (av) zona.append(av);
  zona.append(listado({
    registros: regs, buscarPh: 'Buscar nombre o usuario',
    columnas: [{ l: 'Nombre', v: r => h('span', h('strong', r.nombre), h('span.sub', r.usuario)) }, { l: 'Rol', v: r => chip(r.rol, r.rol === 'Dirección' ? 'marca' : 'neutro') }, { l: 'Puesto', v: r => r.puesto || '—' },
      { l: 'Ingreso', v: r => fecha(r.fecha_ingreso) }, { l: 'Sueldo diario', v: r => dinero(r.sueldo_diario), num: true }, { l: 'Estatus', v: r => chip(r.activo === false ? 'Inactivo' : 'Activo') }],
    movil: { titulo: r => r.nombre, chip: r => chip(r.activo === false ? 'Inactivo' : 'Activo'), meta: r => [r.rol, r.usuario] },
    texto: r => [r.nombre, r.usuario, r.rol, r.puesto].join(' '), orden: (a, b) => ROLES.indexOf(a.rol) - ROLES.indexOf(b.rol) || String(a.nombre).localeCompare(b.nombre, 'es'),
    href: r => 'usuarios/' + encodeURIComponent(r.usuario)
  }));
}

async function formUsuario(c, { u }) {
  const nuevo = !u;
  let r = { activo: true };
  if (!nuevo) { try { const { registros } = await datos.listar('Usuarios'); r = registros.find(x => x.usuario === u) || null; } catch (e) { r = null; } }
  if (!r) { pantalla(c, { titulo: 'Usuario', volver: 'usuarios' }).append(alerta('advertencia', 'Usuario no disponible', 'Conéctese para consultarlo.')); return; }
  const cuerpo = pantalla(c, { titulo: nuevo ? 'Nuevo usuario' : r.nombre, sub: nuevo ? null : `${r.usuario} · ${r.rol}`, volver: 'usuarios',
    acciones: nuevo ? [] : [boton('Restablecer contraseña', { tipo: 'secundario', onclick: () => restablecer(r) })] });
  const f = formulario(camposUsuario(nuevo), r);
  const guardar = boton(nuevo ? 'Crear usuario' : 'Guardar usuario', { ic: 'check' });
  cuerpo.append(h('form.tarjeta.pila', { novalidate: true, onsubmit: e => e.preventDefault(), autocomplete: 'off' }, f.el), h('div.barra-acciones', boton('Cancelar', { tipo: 'fantasma', href: '#/usuarios' }), guardar));
  guardar.addEventListener('click', async () => {
    if (!f.validar()) return toast('Revise los datos marcados.', 'error');
    if (!navigator.onLine) return toast('La administración de usuarios necesita conexión.', 'info');
    const v = f.leer();
    guardar.disabled = true;
    try {
      if (nuevo) { v.id = datos.uuid(); v.usuario = String(v.usuario).toLowerCase(); await datos.enLinea('crearUsuario', v); }
      else { v.usuario = r.usuario; await datos.enLinea('actualizarUsuario', v); }
      f.campos.forEach(x => { if (x.def.c === 'contrasena_temporal') x.fijar(''); });
      await refrescarBootstrap();
      toast(nuevo ? `Usuario ${v.usuario} creado. Entréguele su contraseña temporal en persona.` : 'Usuario guardado', 'exito', 8000);
      ir('usuarios', { reemplazar: true });
    } catch (e) { toast(errorTexto(e), 'error'); guardar.disabled = false; }
  });
}

function restablecer(r) {
  const f = formulario([{ c: 'contrasena_temporal', l: 'Contraseña temporal nueva', t: 'texto', req: true, auto: 'new-password', ayuda: 'Al menos 8 caracteres. Se cierran sus sesiones abiertas.', validar: v => (v && v.length < 8 ? 'Use al menos 8 caracteres.' : '') }], {});
  modal({ titulo: 'Restablecer contraseña de ' + r.nombre, cuerpo: f.el, acciones: [{ texto: 'Cancelar', tipo: 'fantasma' }, { texto: 'Restablecer', tipo: 'primario', fn: async () => {
    if (!f.validar()) return false;
    try { await datos.enLinea('restablecerContrasena', { usuario: r.usuario, contrasena_temporal: f.leer().contrasena_temporal }); toast('Contraseña restablecida. La persona deberá cambiarla al entrar.'); }
    catch (e) { toast(errorTexto(e), 'error'); return false; }
  } }] });
}

// ---------- Arranque ----------
async function pantallaArranque(c) {
  const cuerpo = pantalla(c, { titulo: 'Arranque', sub: 'Datos iniciales de la empresa. Todo lo que se captura aquí alimenta Parámetros, Panel y Finanzas.' });
  cuerpo.append(esqueleto(2));
  let r = null, usuarios = [];
  try { r = (await datos.listar('Arranque')).registros[0] || null; } catch (e) { /* sin acción */ }
  try { usuarios = (await datos.listar('Usuarios')).registros; } catch (e) { usuarios = cat('Usuarios'); }
  const skus = cat('Catalogo'), equipos = cat('Equipos'), exist = cat('Existencias');
  const sinTasa = skus.filter(k => vacioV(k.tasa_iva) && !json(k.componentes).length).length;
  const pasos = [
    ['Datos de arranque', !!(r && r.estatus === 'Capturado'), 'Saldo inicial, forma jurídica, régimen y meta de ventas.'],
    ['Equipo, sueldos y fechas de ingreso', usuarios.filter(u => u.rol !== 'Socio').length > 1 && usuarios.filter(u => u.rol !== 'Socio').every(u => !vacioV(u.sueldo_diario) && !vacioV(u.fecha_ingreso)), 'Dé de alta al equipo en Usuarios con su sueldo diario y fecha de ingreso.'],
    ['Catálogo con tasa de IVA', skus.length > 0 && sinTasa === 0, sinTasa ? `${sinTasa} SKU sin tasa de IVA (capturarla con su contador).` : `${skus.length} SKU registrados.`],
    ['Flota con números de serie', equipos.length > 0, `${equipos.length} equipos registrados.`],
    ['Existencias iniciales', exist.length > 0, `${exist.length} SKU con existencia registrada.`]
  ];
  vaciar(cuerpo);
  cuerpo.append(h('ol.lista-pasos', { role: 'list' }, pasos.map(([t, ok, d], i) => h('li.lista-pasos__item' + (ok ? '.lista-pasos__item--listo' : ''),
    h('span.lista-pasos__marca', ok ? icono('check', 20) : String(i + 1)), h('span', h('strong', t), h('span.texto-sm.texto-suave', { style: { display: 'block' } }, d))))));
  const base = r || { estatus: 'Pendiente', fecha_saldo: hoyIso() };
  const f = formulario([
    { c: 'saldo_inicial_caja', l: 'Saldo inicial de caja (con IVA)', t: 'dinero', req: true, ancho: 'medio' },
    { c: 'fecha_saldo', l: 'Fecha del saldo', t: 'fecha', req: true, ancho: 'medio' },
    { c: 'forma_juridica', l: 'Forma jurídica', t: 'texto', ancho: 'medio', lista: 'formas-juridicas' },
    { c: 'regimen_fiscal', l: 'Régimen fiscal', t: 'texto', ancho: 'medio', ayuda: 'Confírmelo con su contador.' },
    { c: 'meta_ventas_mensual', l: 'Meta de ventas mensual (sin IVA)', t: 'dinero', ancho: 'medio' },
    { c: 'estatus', l: 'Estatus', t: 'opciones', op: ['Pendiente', 'Capturado'], ancho: 'medio' }
  ], base);
  const guardar = boton('Guardar arranque', { ic: 'check' });
  guardar.addEventListener('click', async () => {
    if (!f.validar()) return toast('Revise los datos marcados.', 'error');
    await datos.guardar('Arranque', Object.assign({ id: r ? r.id : undefined }, f.leer()), { version: r ? r.actualizado_en : undefined, resumen: 'Datos de arranque' });
    toast('Arranque guardado' + (navigator.onLine ? '' : ' · se subirá al haber señal'));
    setTimeout(() => ir('arranque', { reemplazar: true }), 400);
  });
  cuerpo.append(h('datalist', { id: 'formas-juridicas' }, ['Persona física con actividad empresarial', 'Sociedad Anónima de Capital Variable', 'Sociedad de Responsabilidad Limitada', 'Sociedad por Acciones Simplificada'].map(x => h('option', { value: x }))),
    h('section.tarjeta.pila', h('h2.titulo-tarjeta', 'Datos de arranque'), f.el, h('div.fila', guardar)),
    h('section.pila', h('h2.titulo-seccion', 'Carga inicial'), h('div.rejilla',
      tarjetaEnlace('usuarios', 'Equipo y sueldos', `${usuarios.length} usuarios`, '#/usuarios'),
      tarjetaEnlace('catalogo', 'Catálogo', `${skus.length} SKU · ${sinTasa} sin tasa de IVA`, '#/catalogo'),
      tarjetaEnlace('dron', 'Flota con series', `${equipos.length} equipos`, '#/equipos/nuevo'),
      tarjetaEnlace('inventario', 'Existencias iniciales', `${exist.length} SKU con ubicación`, '#/existencias/nuevo'),
      tarjetaEnlace('inventario', 'Cantidad inicial (ajuste)', 'Registre la existencia de arranque', '#/movinv/nuevo?tipo=Ajuste&referencia=Carga%20inicial'))));
}
const tarjetaEnlace = (ic, t, d, href) => h('a.tarjeta.tarjeta--interactiva', { href }, h('div.fila', { style: { gap: '12px' } }, h('span.captura-campo__icono', icono(ic)), h('div', h('div.titulo-tarjeta', t), h('div.tarjeta__meta', d))));

// ---------- Pendientes de subir ----------
const TIPO_TXT = { guardar: 'Registro', cambiarEstatus: 'Cambio de estatus', archivo: 'Archivo' };
async function pantallaPendientes(c) {
  const cuerpo = pantalla(c, { titulo: 'Pendientes de subir', sub: 'Lo capturado sin señal espera aquí y se sube solo al recuperar la conexión.',
    acciones: [boton('Sincronizar ahora', { ic: 'sincronizar', onclick: async () => { if (!navigator.onLine) return toast('Sin conexión. Los registros siguen guardados en este teléfono.', 'info'); await sync.sincronizar(); pantallaPendientes(c); } })] });
  cuerpo.classList.add('no-refrescar');
  const cola = await db.colaTodos();
  const e = sync.estado;
  cuerpo.append(h('div.rejilla',
    h('div.kpi', h('div.kpi__nombre', 'Conexión'), h('div.kpi__valor.titulo-tarjeta', navigator.onLine ? 'En línea' : 'Sin conexión'), h('div.kpi__contexto', e.ultimo ? 'Última sincronización: ' + new Date(e.ultimo).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : 'Aún no se sincroniza en esta sesión')),
    h('div.kpi', h('div.kpi__nombre', 'Por subir'), h('div.kpi__valor.cifra', { style: { fontSize: 'var(--t-xl)' } }, String(cola.filter(i => i.estado !== 'error').length))),
    h('div.kpi' + (cola.some(i => i.estado === 'error') ? '.kpi--rojo' : ''), h('div.kpi__nombre', 'Con error'), h('div.kpi__valor.cifra', { style: { fontSize: 'var(--t-xl)' } }, String(cola.filter(i => i.estado === 'error').length)))));
  if (!cola.length) { cuerpo.append(h('div.vacio', h('span.vacio__icono', icono('nube', 32)), h('span.vacio__titulo', 'Todo está al día'), h('p', 'No hay nada pendiente de subir en este teléfono.'))); return; }
  const lista = h('div.lista-registros');
  for (const it of cola) {
    const blob = it.tipo === 'archivo' ? await db.archivoLeer(it.datos.archivo_id) : null;
    lista.append(h('div.registro.registro--cola',
      h('span.registro__titulo', it.resumen || `${TIPO_TXT[it.tipo]} en ${it.tabla}`),
      h('span.registro__estado', it.estado === 'error' ? chip('Error', 'rechazado') : chip('Por subir', 'pendiente')),
      h('span.registro__meta', h('span', TIPO_TXT[it.tipo] + ' · ' + it.tabla), h('span', 'Capturado ' + new Date(it.creado).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })), it.origen === 'offline' ? h('span', 'sin conexión') : null, blob ? h('span', Math.round(blob.size / 1024) + ' KB') : null),
      it.error ? h('span.registro__error', icono('alerta', 16), it.error) : null,
      it.estado === 'error' ? h('span.registro__acciones', boton('Reintentar', { tipo: 'secundario', chico: true, onclick: async () => { await sync.reintentar(it.n); pantallaPendientes(c); } }),
        boton('Descartar', { tipo: 'fantasma', chico: true, onclick: async () => { if (await confirmar('Descartar registro', 'Se borrará de este teléfono y no se subirá. Esta acción no se puede deshacer.', { textoSi: 'Descartar', tipo: 'peligro' })) { await sync.descartar(it.n); pantallaPendientes(c); } } })) : null));
  }
  cuerpo.append(lista);
  let persistente = false;
  try { persistente = navigator.storage && navigator.storage.persisted ? await navigator.storage.persisted() : false; } catch (x) { /* sin acción */ }
  cuerpo.append(h('p.texto-sm.texto-suave', persistente ? 'El navegador tiene permiso para conservar estos datos.' : 'Consejo: instale la app en la pantalla de inicio para que el teléfono conserve los datos sin conexión.'));
}

// ---------- Ayuda ----------
let eventoInstalar = null;
addEventListener('beforeinstallprompt', e => { e.preventDefault(); eventoInstalar = e; });

function contenidoInstalacion() {
  return h('div.pila',
    eventoInstalar ? boton('Instalar Aerovantix Ops', { ic: 'subir', bloque: true, onclick: async () => { eventoInstalar.prompt(); await eventoInstalar.userChoice; eventoInstalar = null; } }) : null,
    h('section.pila', { style: { gap: '8px' } }, h('h3.titulo-tarjeta', 'iPhone (Safari)'), h('ol.pasos-ayuda',
      h('li', 'Abra la dirección de la app en ', h('strong', 'Safari'), '.'),
      h('li', 'Toque el botón ', h('strong', 'Compartir'), ' (cuadro con flecha hacia arriba).'),
      h('li', 'Deslice y elija ', h('strong', 'Agregar a pantalla de inicio'), '.'),
      h('li', 'Toque ', h('strong', 'Agregar'), '. El ícono de Aerovantix aparece con sus apps.'))),
    h('section.pila', { style: { gap: '8px' } }, h('h3.titulo-tarjeta', 'Android (Chrome)'), h('ol.pasos-ayuda',
      h('li', 'Abra la dirección de la app en ', h('strong', 'Chrome'), '.'),
      h('li', 'Toque el menú ', h('strong', '⋮'), ' (arriba a la derecha).'),
      h('li', 'Elija ', h('strong', 'Instalar app'), ' o ', h('strong', 'Agregar a pantalla principal'), '.'),
      h('li', 'Confirme con ', h('strong', 'Instalar'), '.'))),
    h('p.texto-sm.texto-suave', 'Abra la app una vez con señal después de instalarla: así queda lista para trabajar sin conexión en campo.'));
}
export function ayudaInstalacion() { modal({ titulo: 'Cómo instalar la app', cuerpo: contenidoInstalacion(), acciones: [{ texto: 'Entendido', tipo: 'primario' }] }); }

function pantallaAyuda(c) {
  const cuerpo = pantalla(c, { titulo: 'Ayuda', sub: 'Instalación y trabajo sin conexión.' });
  cuerpo.append(h('div.rejilla--2',
    h('section.tarjeta.pila', h('h2.titulo-tarjeta', 'Agregar a la pantalla de inicio'), contenidoInstalacion()),
    h('section.tarjeta.pila', h('h2.titulo-tarjeta', 'Trabajo sin conexión'),
      h('ul.pasos-ayuda',
        h('li', 'Todo lo que captura se guarda primero en el teléfono, con o sin señal.'),
        h('li', 'El indicador de arriba muestra la conexión y cuántos registros faltan por subir.'),
        h('li', 'Al recuperar la señal se sube solo. También puede tocar ', h('strong', 'Sincronizar ahora'), '.'),
        h('li', 'Si la sesión vence, inicie sesión de nuevo: lo pendiente no se pierde.'),
        h('li', 'Si algo lleva más de 24 h sin subir, verá un aviso. Busque una red y sincronice.'),
        h('li', 'Las fotos se comprimen antes de guardarse para ahorrar datos y espacio.')),
      h('p.texto-sm.texto-suave', `Aerovantix Ops · versión ${VERSION} · ${rol()} · ${usuario()}`))));
}

export const rutas = [
  { p: 'usuarios', r: pantallaUsuarios, ver: () => esDir() },
  { p: 'usuarios/nuevo', r: c => formUsuario(c, {}), ver: () => esDir() },
  { p: 'usuarios/:u', r: (c, p) => formUsuario(c, p), ver: () => esDir() },
  { p: 'arranque', r: pantallaArranque, ver: () => esDir() },
  { p: 'pendientes', r: pantallaPendientes },
  { p: 'ayuda', r: pantallaAyuda }
];
