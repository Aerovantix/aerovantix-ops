// Aerovantix Ops · Configuración de la interfaz.
// La URL del motor es pública (aplicación web de Apps Script); la seguridad la aplica el motor con sesión y roles.
// No contiene contraseñas, tokens ni datos reales.

export const MOTOR_URL = 'https://script.google.com/macros/s/AKfycbyHW1dSPy-x6aaKisGWmf9Hod9HQdfReoC5_1WJX0H05ZmJhp5GTScqKTm82wUWPgGD/exec';
export const VERSION = '1.0.0';
export const ZONA = '-06:00'; // America/Mexico_City (sin horario de verano desde 2022)
export const FOTO = { lado: 1600, calidad: 0.7 };
export const SYNC = { intervaloMs: 30000, atrasoHoras: 24, timeoutMs: 60000 };
