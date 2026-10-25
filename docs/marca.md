# Aerovantix Ops · Sistema de diseño

La identidad visual de Aerovantix Ops sale de dos fuentes oficiales:

- **El logo:** `Logo.jpg` en el Drive de Aerovantix.
- **La plantilla oficial de cotización:** `PLANTILLA_Cotizacion_Aerovantix.docx`. Se leyó en modo solo lectura y no se modificó.

Los tokens viven en `css/tokens.css` (`:root`). La app no tiene modo oscuro.

## Principio

La app es un documento de campo de Aerovantix:

- **Una sola pieza audaz:** la barra marina con la línea roja de horizonte. La línea viene de las líneas rojas que enmarcan el lema del logo.
- **Todo lo demás es sobrio:**
  - fondo niebla;
  - superficies blancas con borde fino;
  - paneles de datos con la misma forma de la cotización: etiqueta gris, valor oscuro y fondo niebla;
  - tablas con el estilo de la tabla de partidas: encabezado marino, filas alternas en niebla y cifras a la derecha.

## Color

| Token | HEX | Origen | Uso |
|---|---|---|---|
| `--avx-marino` | `#042146` | Plantilla: encabezados, partidas, total. En el logo mide `#012046` | Primario: barra de marca, botones, títulos, encabezados de tabla |
| `--avx-rojo` | `#DB0513` | Logo: ondas de señal, líneas y placa "Sucursal" | Acento: línea de horizonte, pestaña activa, contadores |
| `--avx-rojo-claro` | `#FF3B30` | Derivado del rojo | Acento sobre marino (4.52:1) |
| `--avx-grafito` | `#5B5C5C` | Logo: brazos de la A, X y arco | Secundario: estatus neutro |
| `--avx-grafito-claro` | `#B0B8C2` | Derivado del grafito | Texto secundario sobre marino (7.99:1) |
| `--avx-tinta` | `#2B2B2B` | Plantilla | Texto principal (14.16:1) |
| `--avx-texto-2` | `#6B6B6B` | Plantilla | Etiquetas y texto secundario (5.33:1 sobre blanco; 4.88:1 sobre niebla) |
| `--avx-niebla` | `#F4F5F4` | Plantilla | Fondo de la app, paneles y filas alternas |
| `--avx-linea` | `#DDE1E5` | Neutro derivado | Divisores |
| `--avx-borde-campo` | `#858F9C` | Neutro derivado | Borde de campos (≥ 3:1) |

Colores de estado (texto sobre su fondo):

| Estado | Color | Fondo | Contraste del texto |
|---|---|---|---|
| Éxito | `#1B7A3A` | `#E7F4EC` | 4.77:1 |
| Advertencia | `#8A5300` | `#FDF1D8` | 5.65:1 |
| Error | `#B3141C` | `#FCE9EA` | 5.93:1 |
| Información | `#1E5AA8` | `#E8F0FA` | 5.93:1 |

- El semáforo de los KPI usa el borde izquierdo y repite el estado en texto con ícono. La información nunca depende solo del color.
- Todas las combinaciones de texto cumplen WCAG AA (≥ 4.5:1).
- `theme-color` es `#042146`.

## Tipografía

| Rol | Familia | Origen | Licencia |
|---|---|---|---|
| Títulos y cifras | **Aerovantix Titulos** (400, 700) | TeX Gyre Adventor 2.501: geométrica emparentada con el lema del logo | GUST Font License (`fuentes/LICENCIA-TITULOS-GUST.txt`) |
| Texto y datos | **Aerovantix Texto** (400, 700) | Liberation Sans 2.1.5: mismas medidas que Arial, la fuente de la plantilla | SIL OFL 1.1 (`fuentes/LICENCIA-TEXTO-OFL.txt`) |

Tratamiento de los archivos:

- Ambas fuentes se subconjuntaron al alfabeto latino (español completo, `€`, `$`, `·`, `—`).
- Se renombraron como piden sus licencias para versiones modificadas.
- Se alojan en `fuentes/` como WOFF y funcionan sin conexión.

**Escala** (rem = 16 px):

| Tamaño | Uso |
|---|---|
| 12 | Marcas de tiempo en escritorio |
| 14 | Etiquetas |
| 16 | Texto base, el mínimo en móvil |
| 18 | Tarjeta |
| 21 | Sección |
| 24 | Pantalla en móvil |
| 30 | Pantalla en escritorio |
| 36 | Cifra KPI |
| 48 | Cifra destacada |

**Interlineado:** 1.5 en texto y 1.2 en títulos.

**Reglas:**

- Las cifras usan números tabulares.
- Las etiquetas van en tipo oración, no en mayúsculas.
- La vista previa de la cotización conserva las mayúsculas de la plantilla (CLIENTE, ALCANCE…) por fidelidad.

## Espaciado, radios y elevación

- **Retícula de 4 px:** `--e-1` … `--e-16` (4, 8, 12, 16, 20, 24, 32, 40, 48, 64).
- **Radios según la jerarquía:**

  | Elemento | Radio |
  |---|---|
  | Campos, chips y celdas | 4 px |
  | Botones | 6 px |
  | Tarjetas (como la placa del logo) | 8 px |
  | Modales y hojas | 14 px |
  | Badges | 999 px |

- **Sombras teñidas de marino:**

  | Nivel | Uso |
  |---|---|
  | 1 | Reposo |
  | 2 | Al pasar el puntero |
  | 3 | Modales, toasts y botón de captura |

- **Medidas de toque:**
  - objetivo táctil mínimo de 44 px;
  - campos y botones de 48 px en móvil;
  - texto de campo de 16 px, para que iOS no haga zoom.

## Componentes (`css/componentes.css`)

| Componente | Clases | Notas |
|---|---|---|
| Botones | `.boton--primario`, `--secundario`, `--fantasma`, `--aprobar`, `--peligro`, `--icono`, `--chico`, `--bloque` | Estado deshabilitado y "Guardando…" con giro |
| Campos | `.campo`, `.entrada`, `.selector`, `.area-texto`, `.campo__prefijo`, `.campo__sufijo` | Ayuda, error con ícono, solo lectura y deshabilitado |
| Selectores | `.opcion` (casilla y radio), `.segmentado`, `.filtro` | — |
| Captura de campo | `.captura-campo` (foto, GPS), `.lienzo-firma` | Firma en canvas con línea guía |
| Tarjetas | `.tarjeta`, `.tarjeta--interactiva`, `.panel-datos` con `.datos`, `.kpi--verde`, `--ambar`, `--rojo` | — |
| Tablas | `.tabla` con `.num`, `.clave`, `.sub`, `.tabla__total`, más `.herramientas-tabla` y `.paginacion` | En móvil se reemplazan por `.lista-registros` |
| Pestañas | `.pestanas` con `.pestana[aria-selected]` | La pestaña activa se marca con línea roja |
| Chips de estatus | `.chip--neutro`, `--pendiente`, `--aprobado`, `--proceso`, `--rechazado`, `--marca` | — |
| Badges | `.badge`, `.badge--neutro`, `.badge--prueba` | — |
| Conexión | `.conexion--en-linea`, `--sin-red`, `--sincronizando` | Contador de pendientes |
| Avisos en línea | `.alerta--info`, `--exito`, `--advertencia`, `--error` | — |
| Modales y toasts | `.modal` (`<dialog>`), `.toast` | El modal es hoja inferior en móvil |
| Navegación | `.barra-marca` y `.nav-inferior` en móvil; `.menu-lateral` y `.barra-escritorio` desde 1024 px | — |
| Estados | `.vacio`, `.esqueleto` | — |
| Inicio de sesión | `.acceso` | Fondo marino, logo invertido, línea de horizonte y hoja blanca |

El movimiento es discreto: 120 y 200 ms, y se desactiva con `prefers-reduced-motion`.

## Iconografía

`iconos/iconos.svg` es un sprite de 52 símbolos propios con estas reglas:

- retícula de 24 px;
- trazo de 1.75 definido en CSS;
- extremos redondeados;
- se dibujan con `currentColor`.

Uso: `<svg class="icono"><use href="iconos/iconos.svg#i-dron"/></svg>`.

## Piezas de marca (`img/`)

| Archivo | Uso |
|---|---|
| `lockup-color.png` / `lockup-blanco.png` | Logo con lema, sin la placa de sucursal. Va en inicio de sesión y documentos |
| `marca-color.png` / `marca-blanco.png` | Emblema y palabra para el encabezado (30 px de alto) y el menú lateral |
| `emblema-color.png` / `emblema-blanco.png` | Emblema solo |
| `icono-192.png`, `icono-512.png` | Íconos de la app (*any*) |
| `icono-maskable-192.png`, `icono-maskable-512.png` | Íconos *maskable*, con zona segura del 66 % |
| `apple-touch-icon.png` | Ícono de iPhone (180 px) |
| `favicon.ico`, `favicon-32.png`, `favicon-16.png` | Favicon |

Cómo se generaron:

- Las versiones transparentes se separaron del fondo blanco del `.jpg` proyectando cada píxel sobre los tres colores del logo.
- Las versiones invertidas cambian marino → blanco, grafito → `#B0B8C2` y rojo → `#FF3B30`, que es el rojo con contraste suficiente sobre marino.

**Pie de página:** "Aerovantix · Tecnología y soluciones agrícolas con drones".
