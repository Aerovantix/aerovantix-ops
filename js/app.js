// Aerovantix Ops · Arranque de la app, acceso, estructura (menú lateral / barra inferior) y enrutamiento.
import { h, icono, vaciar, toast, modal, confirmar, alerta, errorTexto, boton } from './ui.js';
import { llamar, bus, ErrorRed } from './api.js';
import { est, cargarSesion, guardarSesion, refrescarBootstrap, cerrarSesionLocal, olvidarToken, puede, esDir, rol, usuario } from './estado.js';
import * as sync from './sync.js';
import * as db from './db.js';
import { registrar, resolver, ir } from './router.js';
import { VERSION } from './config.js';
import { uuid } from './datos.js';

import { rutas as rInicio } from './modulos/inicio.js';
import { rutas as rComercial } from './modulos/comercial.js';
import { rutas as rCotizaciones } from './modulos/cotizaciones.js';
import { rutas as rOperacion } from './modulos/operacion.js';
import { rutas as rServicios } from './modulos/servicios.js';
import { rutas as rAdmin } from './modulos/administracion.js';
import { rutas as rProcesos } from './modulos/procesos.js';
import { rutas as rSistema, ayudaInstalacion } from './modulos/sistema.js';

registrar([...rInicio, ...rComercial, ...rCotizaciones, ...rOperacion, ...rServicios, ...rAdmin, ...rProcesos, ...rSistema]);

// ---------- Menú ----------
const MENU = [
  { g: null, items: [
    { r: 'inicio', t: 'Inicio', i: 'inicio' },
    { r: 'aprobaciones', t: 'Aprobaciones', i: 'aprobar', ver: () => esDir(), badge: 'aprob' },
    { r: 'avisos', t: 'Avisos', i: 'aviso', ver: () => puede('Avisos'), badge: 'avisos' }] },
  { g: 'Comercial', items: [
    { r: 'crm', t: 'Clientes y oportunidades', i: 'clientes', ver: () => puede('Clientes') },
    { r: 'cotizaciones', t: 'Cotizaciones', i: 'cotizacion', ver: () => puede('Cotizaciones') },
    { r: 'catalogo', t: 'Catálogo', i: 'catalogo', ver: () => puede('Catalogo') }] },
  { g: 'Operación', items: [
    { r: 'os', t: 'Órdenes de servicio', i: 'orden', ver: () => puede('OrdenesServicio') },
    { r: 'rentas', t: 'Rentas', i: 'llave', ver: () => puede('Rentas') },
    { r: 'flota', t: 'Flota y mantenimiento', i: 'dron', ver: () => puede('Equipos') && (puede('Mantenimientos') || puede('Vuelos')) },
    { r: 'inventario', t: 'Inventario', i: 'inventario', ver: () => puede('Existencias') },
    { r: 'compras', t: 'Compras', i: 'compras', ver: () => puede('Compras') }] },
  { g: 'Administración', items: [
    { r: 'caja', t: 'Caja y finanzas', i: 'caja', ver: () => puede('Movimientos') },
    { r: 'finanzas', t: 'Finanzas', i: 'caja', ver: () => !puede('Movimientos') && puede('Finanzas') },
    { r: 'nomina', t: 'Nómina', i: 'nomina', ver: () => puede('NominaCaptura') },
    { r: 'plan', t: 'Plan semanal y cierre', i: 'plan', ver: () => puede('PlanSemanal') },
    { r: 'decisiones', t: 'Decisiones', i: 'decision', ver: () => puede('Decisiones') }] },
  { g: 'Procesos', items: [
    { r: 'sops', t: 'SOPs', i: 'sop', ver: () => puede('SOPs') },
    { r: 'soporte', t: 'Soporte y capacitación', i: 'soporte', ver: () => puede('Tickets') || puede('Capacitaciones') }] },
  { g: 'Sistema', items: [
    { r: 'usuarios', t: 'Usuarios', i: 'usuarios', ver: () => esDir() },
    { r: 'arranque', t: 'Arranque', i: 'arranque', ver: () => esDir() },
    { r: 'pendientes', t: 'Pendientes de subir', i: 'subir', ver: () => rol() !== 'Socio', badge: 'cola' },
    { r: 'ayuda', t: 'Ayuda', i: 'ayuda' }] }
];

const INFERIOR = {
  'Dirección': ['inicio', 'aprobaciones', 'os', 'pendientes', 'mas'],
  'Agronomía': ['inicio', 'crm', 'os', 'pendientes', 'mas'],
  'Técnico': ['inicio', 'os', 'flota', 'pendientes', 'mas'],
  'Piloto': ['inicio', 'os', 'flota', 'pendientes', 'mas'],
  'Socio': ['inicio', 'finanzas', 'avisos', 'mas']
};
const CORTO = { inicio: 'Inicio', aprobaciones: 'Aprobar', os: 'Servicios', pendientes: 'Pendientes', crm: 'Clientes', flota: 'Flota', finanzas: 'Finanzas', avisos: 'Avisos', mas: 'Más' };

const visibles = () => MENU.map(g => ({ g: g.g, items: g.items.filter(i => !i.ver || i.ver()) })).filter(g => g.items.length);
const badges = { aprob: 0, avisos: 0, cola: 0 };

// ---------- Estructura ----------
let shell = null;

function montarShell() {
  vaciar(document.body);
  const menu = h('nav.menu-lateral.sobre-marino', { 'aria-label': 'Menú principal' });
  const indicadorMovil = h('button.conexion', { type: 'button', onclick: () => ir('pendientes') });
  const indicadorEsc = h('button.conexion', { type: 'button', onclick: () => ir('pendientes') });
  const avisosMovil = h('a.boton.boton--icono.con-badge', { href: '#/avisos', 'aria-label': 'Avisos' }, icono('aviso'));
  const barra = h('header.barra-marca.sobre-marino',
    h('a.barra-marca__inicio', { href: '#/inicio', 'aria-label': 'Inicio' }, h('img.barra-marca__logo', { src: 'img/marca-blanco.png', alt: 'Aerovantix', width: 94, height: 30 })),
    h('span.barra-marca__espacio'), indicadorMovil, puede('Avisos') ? avisosMovil : null);
  const sincBtn = boton('Sincronizar ahora', { tipo: 'secundario', ic: 'sincronizar', chico: true, onclick: () => sincronizarAhora() });
  const usuarioBtn = h('button.usuario-mini', { type: 'button', onclick: menuUsuario, 'aria-label': 'Opciones de la cuenta' },
    h('span.avatar', { 'aria-hidden': 'true' }, iniciales(est.perfil?.nombre)),
    h('span', h('span.usuario-mini__nombre', est.perfil?.nombre || ''), h('span.usuario-mini__rol', rol())));
  const barraEsc = h('header.barra-escritorio', h('span.barra-escritorio__titulo', ''), h('span.barra-escritorio__espacio'), indicadorEsc, rol() !== 'Socio' ? sincBtn : null, usuarioBtn);
  const avisosGlobal = h('div.avisos-globales');
  const contenido = h('main.contenido', { id: 'principal', tabindex: '-1' });
  const pie = h('footer.pie-marca', 'Aerovantix · Tecnología y soluciones agrícolas con drones');
  const inferior = h('nav.nav-inferior', { 'aria-label': 'Navegación principal' });
  const app = h('div.app', menu, barra, h('div.app__principal', barraEsc, avisosGlobal, contenido, pie), inferior);
  document.body.append(h('a.saltar', { href: '#principal', onclick: e => { e.preventDefault(); contenido.focus(); } }, 'Ir al contenido'), app);
  shell = { menu, indicadorMovil, indicadorEsc, avisosMovil, avisosGlobal, contenido, inferior, barraEsc };
  pintarMenu();
  sync.suscribir(pintarConexion);
}

const iniciales = n => String(n || '').split(/\s+/).filter(Boolean).slice(0, 2).map(x => x[0]).join('').toUpperCase() || 'AX';

function pintarMenu() {
  const { menu, inferior } = shell;
  vaciar(menu);
  menu.append(h('div.menu-lateral__marca', h('img', { src: 'img/marca-blanco.png', alt: 'Aerovantix', width: 196, height: 62 })));
  visibles().forEach(g => {
    menu.append(h('div.menu-lateral__grupo', g.g ? h('p.menu-lateral__titulo', g.g) : null,
      g.items.map(i => h('a.menu-lateral__item', { href: '#/' + i.r, 'data-ruta': i.r }, icono(i.i), i.t, i.badge && badges[i.badge] ? h('span.badge', String(badges[i.badge])) : null))));
  });
  menu.append(h('div.menu-lateral__pie', 'Aerovantix · Tecnología y soluciones agrícolas con drones', h('br'), 'Versión ' + VERSION));
  vaciar(inferior);
  const lista = (INFERIOR[rol()] || ['inicio', 'mas']).filter(r => r === 'mas' || visibles().some(g => g.items.some(i => i.r === r)));
  inferior.style.setProperty('--n', lista.length);
  lista.forEach(r => {
    const def = MENU.flatMap(g => g.items).find(i => i.r === r);
    const ic = r === 'mas' ? 'menu' : def.i;
    const b = def && def.badge && badges[def.badge] ? h('span.badge', String(badges[def.badge])) : null;
    inferior.append(r === 'mas'
      ? h('button.nav-inferior__item', { type: 'button', onclick: hojaMas }, icono(ic), CORTO[r])
      : h('a.nav-inferior__item', { href: '#/' + r, 'data-ruta': r }, icono(ic), CORTO[r] || def.t, b));
  });
  if (shell.avisosMovil) {
    shell.avisosMovil.querySelector('.badge')?.remove();
    if (badges.avisos) shell.avisosMovil.append(h('span.badge', String(badges.avisos)));
    shell.avisosMovil.setAttribute('aria-label', `Avisos${badges.avisos ? ', ' + badges.avisos + ' sin leer' : ''}`);
  }
  marcarActivo();
}

function marcarActivo() {
  if (!shell) return;
  const actual = resolver(location.hash).camino.split('/')[0];
  const raiz = { clientes: 'crm', oportunidades: 'crm', parcelas: 'crm', proveedores: 'compras', equipos: 'flota', mantenimientos: 'flota', vuelos: 'flota', movimientos: 'caja', tickets: 'soporte', capacitaciones: 'soporte', movinv: 'inventario', existencias: 'inventario', cierre: 'plan' }[actual] || actual;
  document.querySelectorAll('[data-ruta]').forEach(a => { if (a.dataset.ruta === raiz) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
}

function hojaMas() {
  const m = modal({ titulo: 'Menú', cuerpo: h('nav.menu-hoja', visibles().map(g => h('div.menu-hoja__grupo', g.g ? h('p.menu-hoja__titulo', g.g) : null,
    g.items.map(i => h('a.menu-hoja__item', { href: '#/' + i.r, onclick: () => m.cerrar() }, icono(i.i), i.t, i.badge && badges[i.badge] ? h('span.badge', String(badges[i.badge])) : null)))),
  h('div.menu-hoja__grupo', h('button.menu-hoja__item', { type: 'button', onclick: () => { m.cerrar(); menuUsuario(); } }, icono('usuarios'), 'Mi cuenta: ' + (est.perfil?.nombre || ''))))
  });
}

function menuUsuario() {
  const m = modal({ titulo: est.perfil?.nombre || 'Mi cuenta', cuerpo: h('div.pila',
    h('p.texto-suave', `${rol()}${est.perfil?.puesto ? ' · ' + est.perfil.puesto : ''} · usuario ${usuario()}`),
    boton('Cambiar contraseña', { tipo: 'secundario', bloque: true, onclick: () => { m.cerrar(); pantallaAcceso('cambio', { voluntario: true }); } }),
    boton('Ayuda e instalación', { tipo: 'secundario', bloque: true, onclick: () => { m.cerrar(); ir('ayuda'); } }),
    boton('Cerrar sesión', { tipo: 'peligro', ic: 'salir', bloque: true, onclick: () => { m.cerrar(); cerrarSesion(); } }))
  });
}

function pintarConexion(e) {
  if (!shell) return;
  const set = btn => {
    vaciar(btn);
    if (e.sincronizando) { btn.className = 'conexion conexion--sincronizando'; btn.append(icono('sincronizar', 16), e.progreso ? `Subiendo ${e.progreso.hecho + 1 > e.progreso.total ? e.progreso.total : e.progreso.hecho + 1} de ${e.progreso.total}` : 'Sincronizando'); }
    else if (!e.enLinea) { btn.className = 'conexion conexion--sin-red'; btn.append(h('span.conexion__punto'), 'Sin conexión'); if (e.pendientes) btn.append(h('span.conexion__pendientes', h('span', String(e.pendientes)))); }
    else { btn.className = 'conexion conexion--en-linea'; btn.append(h('span.conexion__punto'), e.pendientes ? 'Por subir' : 'En línea'); if (e.pendientes) btn.append(h('span.conexion__pendientes', h('span', String(e.pendientes)))); }
    btn.setAttribute('aria-label', `${e.enLinea ? 'En línea' : 'Sin conexión'}; ${e.pendientes} pendientes de subir. Abrir pendientes.`);
  };
  set(shell.indicadorMovil); set(shell.indicadorEsc);
  if (shell.indicadorMovil.parentNode && shell.indicadorMovil.parentNode.classList.contains('sobre-marino')) shell.indicadorMovil.classList.add('conexion--marino');
  const nuevaCola = e.pendientes + e.errores;
  if (badges.cola !== nuevaCola) { badges.cola = nuevaCola; pintarMenu(); }
  vaciar(shell.avisosGlobal);
  if (e.atrasados) shell.avisosGlobal.append(alerta('advertencia', `${e.atrasados} ${e.atrasados === 1 ? 'registro lleva' : 'registros llevan'} más de 24 h sin subir`,
    'Conéctese a una red y toque Sincronizar ahora. Los datos siguen guardados en este teléfono.', [boton('Sincronizar ahora', { tipo: 'secundario', chico: true, onclick: sincronizarAhora })]));
  if (e.errores) shell.avisosGlobal.append(alerta('error', `${e.errores} ${e.errores === 1 ? 'registro no se pudo subir' : 'registros no se pudieron subir'}`,
    'Revise el detalle en Pendientes de subir para corregirlo o descartarlo.', [boton('Ver pendientes', { tipo: 'secundario', chico: true, href: '#/pendientes' })]));
}

async function sincronizarAhora() {
  if (!navigator.onLine) { toast('Sin conexión. Los registros siguen guardados en este teléfono.', 'info'); return; }
  const r = await sync.sincronizar();
  const e = sync.estado;
  if (e.errores) toast(`Sincronización con ${e.errores} error(es). Revise Pendientes de subir.`, 'error');
  else if (r && r.subidos) toast(`Sincronización completa: ${r.subidos} ${r.subidos === 1 ? 'registro subido' : 'registros subidos'}`);
  else toast('Todo está al día.', 'info');
}

export async function actualizarBadges() {
  badges.avisos = est.avisos || 0;
  if (esDir() && navigator.onLine) {
    try { const r = await llamar('listar', { tabla: 'Aprobaciones', filtros: { estatus: 'Pendiente' } }); badges.aprob = r.registros.length; } catch (e) { /* sin acción */ }
  }
  if (shell) pintarMenu();
}
bus.on('avisos-cambio', n => { est.avisos = n; actualizarBadges(); });
bus.on('aprobaciones-cambio', () => actualizarBadges());

// ---------- Enrutamiento ----------
let renderId = 0;
async function pintarRuta() {
  if (!shell) return;
  const { def, params, q } = resolver(location.hash);
  const id = ++renderId;
  marcarActivo();
  document.querySelectorAll('dialog.modal[open]').forEach(d => { d.close(); d.remove(); });
  const c = shell.contenido;
  if (!def) { vaciar(c).append(alerta('advertencia', 'Pantalla no encontrada', 'Use el menú para continuar.')); return; }
  if (def.ver && !def.ver()) { vaciar(c).append(alerta('advertencia', 'Sin acceso', 'Su rol no tiene acceso a esta pantalla.')); return; }
  scrollTo(0, 0);
  try { await def.r(c, params, q, () => id === renderId); }
  catch (e) { console.error(e); if (id === renderId) { vaciar(c).append(alerta('error', 'No se pudo mostrar la pantalla', errorTexto(e))); } }
}
addEventListener('hashchange', pintarRuta);
bus.on('sincronizado', () => {
  // Refresca la pantalla actual si no hay un formulario abierto.
  if (shell && !shell.contenido.querySelector('form, .no-refrescar')) pintarRuta();
  actualizarBadges();
});

// ---------- Acceso ----------
function pantallaAcceso(modo, opc = {}) {
  shell = null;
  vaciar(document.body);
  const hoja = h('div.acceso__hoja');
  document.body.append(h('div.acceso',
    h('div.acceso__marca.sobre-marino', h('img', { src: 'img/lockup-blanco.png', alt: 'Aerovantix', width: 440, height: 158 }),
      h('span.acceso__horizonte', { 'aria-hidden': 'true' }), h('span.acceso__lema', 'Operación de campo y oficina')),
    hoja));
  const form = h('form.acceso__form.pila', { novalidate: true });
  hoja.append(form);
  const errorEl = h('div');
  const campoT = (l, nombre, tipo, auto, extra = {}) => {
    const inp = h('input.entrada', Object.assign({ name: nombre, type: tipo, autocomplete: auto, required: true, id: 'a-' + nombre, autocapitalize: 'none', spellcheck: 'false' }, extra));
    return [h('label.campo', { for: 'a-' + nombre }, h('span.campo__etiqueta', l), inp), inp];
  };
  const enviar = h('button.boton.boton--primario.boton--bloque', { type: 'submit' });
  const ocupado = (s, texto) => { enviar.disabled = s; vaciar(enviar); if (s) enviar.append(h('span.boton__giro', { 'aria-hidden': 'true' })); enviar.append(texto); };
  const mostrarError = m => { vaciar(errorEl); if (m) errorEl.append(alerta('error', m)); };

  if (modo === 'login') {
    const [cu, iu] = campoT('Usuario', 'usuario', 'text', 'username', { value: opc.usuario || (est.perfil && est.perfil.usuario) || '' });
    const [cc, ic] = campoT('Contraseña', 'contrasena', 'password', 'current-password');
    ocupado(false, 'Entrar');
    form.append(h('h1.titulo-seccion', opc.vencida ? 'Su sesión venció' : 'Iniciar sesión'),
      opc.vencida ? h('p.texto-suave', 'Inicie sesión de nuevo para continuar. Lo que tenga pendiente de subir se conserva en este teléfono.') : null,
      errorEl, cu, cc, enviar,
      h('button.boton.boton--fantasma.boton--bloque', { type: 'button', onclick: () => ayudaInstalacion() }, icono('ayuda', 20), 'Cómo instalar la app'));
    form.addEventListener('submit', async e => {
      e.preventDefault(); mostrarError('');
      const u = iu.value.trim().toLowerCase(), p = ic.value;
      if (!u || !p) return mostrarError('Escriba su usuario y contraseña.');
      if (!navigator.onLine) return mostrarError('Necesita señal para iniciar sesión. Lo capturado sigue guardado en este teléfono.');
      const cola = (await db.colaTodos()).length;
      const previo = await db.leer('sesion');
      if (cola && previo && previo.perfil && previo.perfil.usuario && previo.perfil.usuario !== u) {
        return mostrarError(`Hay ${cola} registros pendientes de ${previo.perfil.nombre}. Inicie sesión con el usuario ${previo.perfil.usuario} para subirlos primero.`);
      }
      ocupado(true, 'Entrando…');
      try {
        const r = await llamar('login', { usuario: u, contrasena: p, dispositivo: navigator.userAgent.slice(0, 180) });
        ic.value = '';
        await guardarSesion(r.token, r.perfil, r.expira);
        if (r.perfil.debe_cambiar_contrasena) return pantallaAcceso('cambio', { temporal: true, actual: p });
        await despuesDeEntrar();
      } catch (x) { ocupado(false, 'Entrar'); mostrarError(errorTexto(x)); }
    });
    (iu.value ? ic : iu).focus();
  }

  if (modo === 'primer') {
    const [cn, inom] = campoT('Nombre completo', 'nombre', 'text', 'name', { autocapitalize: 'words', spellcheck: 'true' });
    const [cu, iu] = campoT('Usuario', 'usuario', 'text', 'username');
    const [cco, ico] = campoT('Correo interno', 'correo', 'email', 'email', { required: false });
    const [cp, ip] = campoT('Contraseña', 'nueva', 'password', 'new-password', { minlength: 8 });
    const [cp2, ip2] = campoT('Confirme la contraseña', 'nueva2', 'password', 'new-password', { minlength: 8 });
    ocupado(false, 'Crear usuario Dirección');
    form.append(h('h1.titulo-seccion', 'Primer arranque'),
      h('p.texto-suave', 'Esta pantalla aparece una sola vez. Cree el usuario de Dirección, que aprueba todo y da de alta al equipo.'),
      errorEl, cn, cu, h('span.campo__ayuda', { style: { marginTop: '-8px' } }, '3 a 30 caracteres: letras minúsculas, números, punto o guion.'), cco, cp, cp2, enviar);
    form.addEventListener('submit', async e => {
      e.preventDefault(); mostrarError('');
      if (!inom.value.trim() || !iu.value.trim()) return mostrarError('Capture su nombre y usuario.');
      if (ip.value.length < 8) return mostrarError('La contraseña debe tener al menos 8 caracteres.');
      if (ip.value !== ip2.value) return mostrarError('Las contraseñas no coinciden.');
      ocupado(true, 'Creando…');
      try {
        const r = await llamar('primerArranque', { nombre: inom.value.trim(), usuario: iu.value.trim().toLowerCase(), correo: ico.value.trim(), contrasena: ip.value, dispositivo: navigator.userAgent.slice(0, 180) });
        ip.value = ''; ip2.value = '';
        await guardarSesion(r.token, r.perfil, r.expira);
        await despuesDeEntrar();
        toast('Usuario Dirección creado. Siguiente paso: capture el módulo Arranque.');
        ir('arranque');
      } catch (x) { ocupado(false, 'Crear usuario Dirección'); mostrarError(errorTexto(x)); }
    });
    inom.focus();
  }

  if (modo === 'cambio') {
    const [ca, ia] = campoT(opc.temporal ? 'Contraseña temporal' : 'Contraseña actual', 'actual', 'password', 'current-password');
    if (opc.actual) { ia.value = opc.actual; }
    const [cp, ip] = campoT('Nueva contraseña', 'nueva', 'password', 'new-password', { minlength: 8 });
    const [cp2, ip2] = campoT('Confirme la nueva contraseña', 'nueva2', 'password', 'new-password', { minlength: 8 });
    ocupado(false, 'Guardar contraseña');
    form.append(h('h1.titulo-seccion', 'Cambie su contraseña'),
      h('p.texto-suave', opc.temporal ? 'Su contraseña es temporal. Elija una propia de al menos 8 caracteres para continuar.' : 'Elija una contraseña de al menos 8 caracteres. Se cerrarán sus sesiones en otros dispositivos.'),
      errorEl, opc.actual ? null : ca, cp, cp2, enviar,
      opc.voluntario ? h('button.boton.boton--fantasma.boton--bloque', { type: 'button', onclick: () => entrar() }, 'Cancelar') : null);
    form.addEventListener('submit', async e => {
      e.preventDefault(); mostrarError('');
      if (ip.value.length < 8) return mostrarError('La nueva contraseña debe tener al menos 8 caracteres.');
      if (ip.value !== ip2.value) return mostrarError('Las contraseñas no coinciden.');
      ocupado(true, 'Guardando…');
      try {
        await llamar('cambiarContrasena', { actual: ia.value, nueva: ip.value });
        ia.value = ''; ip.value = ''; ip2.value = '';
        toast('Contraseña guardada.');
        await despuesDeEntrar();
      } catch (x) { ocupado(false, 'Guardar contraseña'); mostrarError(errorTexto(x)); }
    });
    (opc.actual ? ip : ia).focus();
  }
}

async function despuesDeEntrar() {
  await refrescarBootstrap();
  bus.emit('sesion-iniciada');
  sync.pedirPersistencia();
  entrar();
}

let syncIniciado = false;
function entrar() {
  montarShell();
  if (!syncIniciado) { sync.iniciar(); syncIniciado = true; } else sync.sincronizar();
  if (!location.hash || location.hash === '#' || location.hash === '#/') history.replaceState(null, '', '#/inicio');
  pintarRuta();
  actualizarBadges();
}

async function cerrarSesion() {
  const cola = (await db.colaTodos()).length;
  const ok = await confirmar('Cerrar sesión', cola
    ? `Hay ${cola} registros sin subir. Se conservarán en este teléfono y se subirán cuando ${est.perfil?.nombre || 'usted'} vuelva a entrar.`
    : '¿Desea cerrar la sesión en este dispositivo?', { textoSi: 'Cerrar sesión', tipo: 'peligro' });
  if (!ok) return;
  if (navigator.onLine) { try { await llamar('logout'); } catch (e) { /* sin acción */ } }
  const perfil = est.perfil;
  await cerrarSesionLocal();
  if (cola && perfil) await db.escribir('sesion', { perfil });
  pantallaAcceso('login');
}

bus.on('sesion-vencida', async () => {
  if (!shell) return;
  await olvidarToken();
  pantallaAcceso('login', { vencida: true });
});
bus.on('cambio-requerido', () => { if (shell) pantallaAcceso('cambio', { temporal: true }); });

// ---------- Service worker ----------
function registrarSW() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('sw.js').then(reg => {
    reg.addEventListener('updatefound', () => {
      const nw = reg.installing;
      nw && nw.addEventListener('statechange', () => {
        if (nw.state === 'installed' && navigator.serviceWorker.controller) toast('Hay una versión nueva de la app. Se aplicará al volver a abrirla.', 'info', 8000);
      });
    });
  }).catch(e => console.warn('Service worker no registrado', e));
}

// ---------- Inicio ----------
async function arrancar() {
  registrarSW();
  const conToken = await cargarSesion();
  if (conToken) {
    if (navigator.onLine) {
      try { await refrescarBootstrap(); }
      catch (e) {
        if (e.codigo === 'SESION') { await olvidarToken(); return pantallaAcceso('login', { vencida: true }); }
        if (e.codigo === 'CAMBIO_REQUERIDO') return pantallaAcceso('cambio', { temporal: true });
        if (!(e instanceof ErrorRed) || !Object.keys(est.permisos).length) return pantallaAcceso('login');
      }
    } else if (!Object.keys(est.permisos).length) return pantallaAcceso('login');
    return entrar();
  }
  if (navigator.onLine) {
    try { const e = await llamar('estado'); if (!e.inicializado) return pantallaAcceso('primer'); } catch (e) { /* sin acción */ }
  }
  pantallaAcceso('login', { vencida: !!(est.perfil && (await db.colaTodos()).length) });
}

export const _interno = { uuid };
arrancar();
