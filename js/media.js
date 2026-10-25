// Fotos (compresión en el cliente), GPS y firma en canvas.
import { FOTO } from './config.js';

/** Comprime una foto: lado mayor 1600 px, JPEG calidad 0.7 (respeta la orientación EXIF). */
export async function comprimirFoto(archivo, lado = FOTO.lado, calidad = FOTO.calidad) {
  let fuente, ancho, alto;
  try {
    fuente = await createImageBitmap(archivo, { imageOrientation: 'from-image' });
    ancho = fuente.width; alto = fuente.height;
  } catch (e) {
    fuente = await new Promise((ok, mal) => {
      const img = new Image(); const url = URL.createObjectURL(archivo);
      img.onload = () => { URL.revokeObjectURL(url); ok(img); };
      img.onerror = () => { URL.revokeObjectURL(url); mal(new Error('No se pudo leer la imagen.')); };
      img.src = url;
    });
    ancho = fuente.naturalWidth; alto = fuente.naturalHeight;
  }
  const escala = Math.min(1, lado / Math.max(ancho, alto));
  const w = Math.max(1, Math.round(ancho * escala)), hh = Math.max(1, Math.round(alto * escala));
  const c = document.createElement('canvas'); c.width = w; c.height = hh;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, w, hh);
  ctx.drawImage(fuente, 0, 0, w, hh);
  if (fuente.close) fuente.close();
  const blob = await new Promise(ok => c.toBlob(ok, 'image/jpeg', calidad));
  if (!blob) throw new Error('No se pudo comprimir la foto.');
  return blob;
}

/** Ubicación actual con navigator.geolocation. */
export function obtenerGPS(timeout = 20000) {
  return new Promise((ok, mal) => {
    if (!('geolocation' in navigator)) return mal(new Error('Este dispositivo no ofrece ubicación.'));
    navigator.geolocation.getCurrentPosition(
      p => ok({ latitud: Math.round(p.coords.latitude * 1e6) / 1e6, longitud: Math.round(p.coords.longitude * 1e6) / 1e6, precision: Math.round(p.coords.accuracy) }),
      e => mal(new Error(e.code === 1 ? 'Permita el acceso a la ubicación en el navegador.' : 'No se obtuvo la ubicación. Intente al aire libre.')),
      { enableHighAccuracy: true, timeout, maximumAge: 60000 });
  });
}

/** Lienzo de firma con el dedo o el mouse. */
export class PadFirma {
  constructor(canvas) {
    this.c = canvas; this.ctx = canvas.getContext('2d'); this.trazos = 0; this.dib = false;
    this.ajustar = this.ajustar.bind(this);
    this.ajustar();
    addEventListener('resize', this.ajustar);
    const pos = e => { const r = this.c.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    canvas.addEventListener('pointerdown', e => { e.preventDefault(); this.dib = true; canvas.setPointerCapture(e.pointerId); this.ctx.beginPath(); this.ctx.moveTo(...pos(e)); });
    canvas.addEventListener('pointermove', e => { if (!this.dib) return; e.preventDefault(); this.ctx.lineTo(...pos(e)); this.ctx.stroke(); this.trazos++; });
    const fin = () => { this.dib = false; };
    canvas.addEventListener('pointerup', fin); canvas.addEventListener('pointercancel', fin);
  }
  ajustar() {
    const r = this.c.getBoundingClientRect(), d = devicePixelRatio || 1;
    if (!r.width) return;
    const previo = this.trazos ? this.c.toDataURL() : null;
    this.c.width = r.width * d; this.c.height = r.height * d;
    this.ctx.setTransform(d, 0, 0, d, 0, 0);
    this.ctx.lineWidth = 2.4; this.ctx.lineCap = 'round'; this.ctx.lineJoin = 'round'; this.ctx.strokeStyle = '#042146';
    if (previo) { const img = new Image(); img.onload = () => this.ctx.drawImage(img, 0, 0, r.width, r.height); img.src = previo; }
  }
  vacia() { return this.trazos < 3; }
  limpiar() { this.ctx.clearRect(0, 0, this.c.width, this.c.height); this.trazos = 0; }
  /** PNG con fondo blanco. */
  async aBlob() {
    const t = document.createElement('canvas'); t.width = this.c.width; t.height = this.c.height;
    const x = t.getContext('2d'); x.fillStyle = '#FFFFFF'; x.fillRect(0, 0, t.width, t.height); x.drawImage(this.c, 0, 0);
    return new Promise(ok => t.toBlob(ok, 'image/png'));
  }
  destruir() { removeEventListener('resize', this.ajustar); }
}
