# TRÍADA / AppGym — auditoría visual para Stitch

Fecha: 22 de octubre de 2026. Extraído del código local, sin rediseñar la UI.
Fuentes principales: `src/styles.scss`, `tailwind.config.js`, `src/index.html`,
`angular.json`, `src/app/shared/` y plantillas de funcionalidades. La carpeta
`src/app/core/components/` no existe; los componentes comunes están en `shared`.

## Dirección visual

Aplicación fitness de tema oscuro, paneles densos, acentos lima, cifras grandes y
etiquetas pequeñas en mayúsculas. Combina Angular Material con Tailwind 3. Las
pantallas recientes usan fondos azul negro; los componentes base usan zinc.
Conservar estos matices al generar propuestas; no interpretar todos los fondos
como el mismo negro ni todos los verdes como un único token ya consolidado.

## Paleta principal exacta

| Uso / token | HEX | RGB | Fuente |
|---|---|---|---|
| Fondo global `background`; card/popover | #09090B | 9, 9, 11 | tailwind.config.js |
| Superficie `surface`; diálogo Material | #18181B | 24, 24, 27 | Tailwind / styles.scss |
| Primario de componentes `primary` | #CCFC7E | 204, 252, 126 | tailwind.config.js |
| Neón de funcionalidades, scroll, Coach AI | #CCFF00 | 204, 255, 0 | styles.scss / plantillas |
| `secondary`, `muted`, `accent`; borde diálogo | #27272A | 39, 39, 42 | Tailwind / styles.scss |
| `text-main`, card/popover foreground | #FAFAFA | 250, 250, 250 | tailwind.config.js |
| `text-muted`, muted foreground | #A1A1AA | 161, 161, 170 | tailwind.config.js |
| Fondo principal de funcionalidades / drawer | #0B0E14 | 11, 14, 20 | ai-coach-drawer / funcionalidades |
| Tarjetas de funcionalidades / toasts / resumen | #151921 | 21, 25, 33 | shared / funcionalidades |
| Cabecera y pie de tabla | #0F1219 | 15, 18, 25 | ui-table |
| Blanco explícito | #FFFFFF | 255, 255, 255 | styles.scss / text-white |
| Negro explícito | #000000 | 0, 0, 0 | overlays / text-black |
| Zinc 700, bordes secundarios | #3F3F46 | 63, 63, 70 | drag / border-zinc-700 |
| Zinc 500, etiquetas discretas | #71717A | 113, 113, 122 | text-zinc-500 |
| Zinc 300, contenido secundario | #D4D4D8 | 212, 212, 216 | text-zinc-300 |
| Error, red-500 | #EF4444 | 239, 68, 68 | toast / controles |
| Error secundario, red-400 | #F87171 | 248, 113, 113 | ui-input / toast |
| Aviso, yellow-500 | #EAB308 | 234, 179, 8 | toast |
| Aviso, yellow-400 | #FACC15 | 250, 204, 21 | navbar / toast |
| Foco input, green-400 | #4ADE80 | 74, 222, 128 | ui-input |

La opacidad forma parte del estilo: `bg-[#CCFF00]/10` = rgba(204,255,0,0.10),
`border-[#CCFF00]/30` = rgba(204,255,0,0.30), `bg-[#151921]/90` =
rgba(21,25,33,0.90), `border-white/10` = rgba(255,255,255,0.10).
El anexo contiene los demás literales HEX encontrados, incluidos colores de
gráficas, niveles y visualizaciones corporales; no todos son tokens de marca.

## Tipografía y tamaños

- `body`: `Roboto, "Helvetica Neue", sans-serif` (`src/styles.scss`).
- Google Fonts carga Roboto **300, 400, 500**, con `display=swap` (`src/index.html`).
  Tailwind solicita también 600, 700 y 900; esos pesos no tienen descarga explícita
  y el navegador puede sintetizarlos. No afirmar que existe una fuente de marca adicional.
- Utilidades `font-sans`: pila sans predeterminada de Tailwind; pueden sobrescribir
  Roboto por herencia. `font-mono`: pila mono predeterminada, usada en métricas y badges.
- Material Icons y Material Icons Round son fuentes de iconos, no de texto.
- Escala Tailwind, con raíz de referencia 16px: `text-xs` 12px/16px,
  `text-sm` 14px/20px, `text-base` 16px/24px, `text-lg` 18px/28px,
  `text-xl` 20px/28px, `text-2xl` 24px/32px, `text-3xl` 30px/36px,
  `text-4xl` 36px/40px, `text-5xl` 48px/1, `text-6xl` 60px/1.
- Etiquetas y badges usan también tamaños arbitrarios pequeños, especialmente
  `text-[10px]`. El anexo enumera los tamaños arbitrarios encontrados en el código.
- Títulos: `font-black`/`font-bold`, `uppercase`, `tracking-wider` (0.05em) o
  `tracking-widest` (0.1em). Cuerpo: `text-sm`, `leading-relaxed` (1.625).
  Los nombres de clase son especificaciones de Tailwind, no estilos nuevos.

## Efectos, espaciado y movimiento

| Patrón | Implementación existente |
|---|---|
| Glassmorphism | Tarjetas `bg-black/40 backdrop-blur-md` (12px); outline `bg-background/50 backdrop-blur-sm` (4px); overlays `bg-black/50` o `/90` |
| Glow de botón base | `0 0 15px rgba(204,252,126,0.3)` |
| Glow de Coach / resumen | `0 0 15px rgba(204,255,0,0.15)` y `0 0 20px rgba(204,255,0,0.2)` |
| Luz ambiental | Mancha lima al 20%, `blur-[80px]`, detrás del resumen semanal |
| Drag preview | Fondo rgba(21,25,33,.95), borde rgba(204,255,0,.3), blur 8px; sombras `0 20px 25px -5px rgba(0,0,0,.5), 0 8px 10px -6px rgba(0,0,0,.5)` |
| Sombras Tailwind | `shadow-sm`, `shadow-md`, `shadow-xl`, `shadow-2xl`; esta última `0 25px 50px -12px rgb(0 0 0 / .25)` |
| Curvas | `rounded-xl` 12px, `rounded-2xl` 16px, `rounded-3xl` 24px, `rounded-full` 9999px; diálogo CSS explícito 1rem (16px) |
| Bordes | Habitualmente 1px zinc-700/800 o blanco 5–10%; borde discontinuo de drag 2px |
| Espaciado | Escala Tailwind de 4px: p-3 12px, p-4 16px, p-5 20px, p-6 24px, p-8 32px; gap-2/3/4 = 8/12/16px |
| Contenedor | Centrado, padding 2rem; límite 1400px en 2xl; drawer ancho completo, `sm:w-96` = 384px |
| Breakpoints | Predeterminados: sm 640px, md 768px, lg 1024px, xl 1280px, 2xl 1536px; ancho de container 2xl sobrescrito a 1400px |
| Movimiento | fadeIn 0.5s; slideUp 0.5s desde 30px; bounceIn 0.6s de .9 a 1.05 a 1; slideDown 0.5s hasta 500px; toast slideInRight .3s; drag transform 250ms |
| Scroll | `.no-scrollbar` oculta barra; `.custom-scroll` / `.custom-scrollbar` barra 4px, thumb #CCFF00, radio 10px |

## Inventario reutilizable

Rutas relativas a `src/app/shared/`. Son componentes standalone con inputs o
servicios; las clases que siguen son las existentes, no una nueva API de diseño.

| Componente / ubicación | Uso y clases principales |
|---|---|
| `app-ui-button` — ui/ui-button | Variantes primary/secondary/ghost/outline/danger; `inline-flex rounded-md text-sm font-medium`, ring de foco, disabled al 50%; tamaños sm h-8, md h-9, lg h-10 e icon 36×36px |
| `app-ui-card` — ui/ui-card | Contenido y footer proyectados, título y descripción; `rounded-xl border-white/10 bg-black/40 backdrop-blur-md shadow-sm`; customClass por defecto añade bg-surface/border-secondary; padding 24px |
| `app-ui-input` — ui/ui-input | Input con model signal, etiqueta/error, h-9, max-w-sm, `bg-black/20 text-white`, borde, foco green-400, error red-400/500 |
| `app-ui-icon` — ui/ui-icon | Wrapper Lucide, name requerido, tamaño por defecto 24px, customClass |
| `app-ui-table` — ui/ui-table | TanStack, ordenación/paginación y estado vacío; fondo #151921, `rounded-2xl shadow-2xl`, cabecera 10px uppercase en #0F1219 |
| `app-progress-chart` — ui/progress-chart | Barras SVG con inputs data/labels/title; h-48, `bg-black/20 rounded-lg`, fill-primary/80 |
| `app-progress-chart` — components/progress-chart | Gráfico Chart.js de historial y selector; `bg-[#151921] rounded-2xl shadow-xl`, altura 256/320px; comparte selector con la versión SVG, imports distintos |
| `app-muscle-fatigue-map` — ui/muscle-fatigue-map | Mapa SVG con tooltips y colores por recuperación; aspect 1/2, `bg-zinc-900/50 rounded-xl`, transición 500ms |
| components/biometric-model | Modelo corporal 3D de recuperación; render Three.js, controles y colores musculares; no confundir el color del dato con el primario de marca |
| components/human-body | Vista corporal SVG, selección/estado muscular |
| components/professional-body-map | Vista corporal SVG detallada y leyenda de estados |
| components/strength-tier-widget | Nivel y progreso de fuerza; colores específicos de rango definidos en user-profile.model.ts |
| components/weekly-summary-modal | Resumen y generación semanal; overlay negro 90%, blur-sm, `rounded-3xl bg-[#151921] p-8 max-w-md shadow-2xl`, luz ambiental lima |
| components/ai-coach-drawer | Chat lateral, z-110, overlay móvil z-100, `bg-[#0B0E14]`, cabecera #151921, burbuja usuario lima y texto negro; transición 300ms |
| `app-toast` — components/toast | Avisos success/error/warning/info; top/right 16px, z-9999, `rounded-xl shadow-2xl backdrop-blur-md`, franja lateral y cierre |
| layout/navbar | Toolbar Material, gradiente gray-800→gray-900, navegación responsive e iconos Material; conserva texto antiguo FitMaster |
| `.gravl-dialog-panel` — styles.scss | Skin compartido de modales Material: fondo #18181B, borde #27272A y radio explícito 16px |

## Diferencias a tener en cuenta en Stitch

1. Hay **dos primarios**: #CCFC7E en componentes base y #CCFF00 en funcionalidades.
   Para reproducir la app actual, conservar ambos; consolidarlos requiere otra decisión de diseño.
2. Tailwind referencia `--border`, `--input`, `--ring`, `--destructive`,
   `--destructive-foreground` y `--radius`, pero no hay definiciones de esos tokens
   propios en `src`. `rounded-sm/md/lg` están sobrescritos con `--radius`; no
   asignarles un radio efectivo inventado. `text-foreground` y
   `text-secondary-foreground` tampoco tienen token personalizado declarado.
3. Hay `animate-in`, `fade-in`, `zoom-in-95`, etc. en plantillas, pero no se configura
   un plugin Tailwind de animaciones. Distinguirlas de las animaciones explícitas
   en tailwind.config.js y del toast; no asumir que todas generan CSS.
4. `angular.json` añade `@angular/material/prebuilt-themes/cyan-orange.css` antes de
   styles.scss: controles Material pueden usar cyan/naranja propios del tema.
5. Persisten variantes visuales y dos componentes con selector de gráfica igual.
   Esta auditoría documenta ese estado; no afirma una unificación que no existe.

## Brief listo para Stitch

Diseñar TRÍADA como una app fitness oscura, con fondo #0B0E14, paneles #151921,
texto #FAFAFA y acentos #CCFF00 para las pantallas de funcionalidades. Mantener
#CCFC7E en los controles base si se busca fidelidad literal. Usar Roboto, títulos
bold/black compactos en mayúsculas, métricas destacadas y etiquetas secundarias
de 10–12px. Tarjetas de 16–24px de radio, bordes zinc discretos, glass moderado y
glow lima reservado a acciones y estados. Incluir estados vacío/cargando/error,
foco visible y disabled, y layouts móvil/escritorio. No usar el acento de marca
para sustituir colores semánticos de fatiga, error o rango.


## Anexo: inventario de colores literales y utilidades usadas

Extracción estática de archivos HTML/TS/SCSS de src (sin specs) y tailwind.config.js.
Incluye colores de gráficas/modelos y comentarios; la presencia no demuestra que
un componente esté montado en cada ruta. Material y fotografías tienen colores adicionales.

| HEX normalizado | RGB (alpha si existe) | Primera fuente / utilidad |
|---|---|---|
| #00D2FF | 0, 210, 255 | `src/app/features/dashboard/components/recovery-monitor/recovery-monitor.component.html` |
| #00F3FF | 0, 243, 255 | `src/app/features/dashboard/components/recovery-monitor/recovery-monitor.component.html` |
| #059669 | 5, 150, 105 | `Tailwind emerald-600` |
| #09090B | 9, 9, 11 | `tailwind.config.js` |
| #0B0E14 | 11, 14, 20 | `src/app/app.component.html` |
| #0D1017 | 13, 16, 23 | `src/app/features/workouts/workout-detail/workout-detail.component.html` |
| #0D1117 | 13, 17, 23 | `src/app/features/dashboard/components/recovery-monitor/recovery-monitor.component.html` |
| #0F1117 | 15, 17, 23 | `src/app/features/profile/profile.component.html` |
| #0F1219 | 15, 18, 25 | `src/app/features/admin-users/admin-users.component.html` |
| #0F172A | 15, 23, 42 | `Tailwind slate-900` |
| #10B981 | 16, 185, 129 | `Tailwind emerald-500` |
| #111827 | 17, 24, 39 | `Tailwind gray-900` |
| #14532D | 20, 83, 45 | `Tailwind green-900` |
| #14B8A6 | 20, 184, 166 | `Tailwind teal-500` |
| #151921 | 21, 25, 33 | `src/app/app.component.html` |
| #15803D | 21, 128, 61 | `Tailwind green-700` |
| #16A34A | 22, 163, 74 | `Tailwind green-600` |
| #18181B | 24, 24, 27 | `Tailwind zinc-900` |
| #1A1508 | 26, 21, 8 | `src/app/features/nutrition/nutrition.component.html` |
| #1A1E26 | 26, 30, 38 | `src/app/features/dashboard/dashboard.component.html` |
| #1A1F29 | 26, 31, 41 | `src/app/features/dashboard/dashboard.component.html` |
| #1C1815 | 28, 24, 21 | `src/app/features/workouts/workout-detail/components/set-tracker/set-tracker.component.html` |
| #1C212A | 28, 33, 42 | `src/app/features/workouts/workout-detail/components/set-tracker/set-tracker.component.html` |
| #1D4ED8 | 29, 78, 216 | `Tailwind blue-700` |
| #1E293B | 30, 41, 59 | `Tailwind slate-800` |
| #1E3A8A | 30, 58, 138 | `Tailwind blue-900` |
| #1F2937 | 31, 41, 55 | `Tailwind gray-800` |
| #22C55E | 34, 197, 94 | `Tailwind green-500` |
| #2563EB | 37, 99, 235 | `Tailwind blue-600` |
| #27272A | 39, 39, 42 | `Tailwind zinc-800` |
| #2C2C2E | 44, 44, 46 | `src/app/features/workouts/workout-detail/components/set-tracker/set-tracker.component.html` |
| #2DD4BF | 45, 212, 191 | `Tailwind teal-400` |
| #334155 | 51, 65, 85 | `Tailwind slate-700` |
| #34A853 | 52, 168, 83 | `src/app/features/login/login.component.ts` |
| #34D399 | 52, 211, 153 | `Tailwind emerald-400` |
| #374151 | 55, 65, 81 | `Tailwind gray-700` |
| #3B82F6 | 59, 130, 246 | `Tailwind blue-500` |
| #3F3F46 | 63, 63, 70 | `Tailwind zinc-700` |
| #422006 | 66, 32, 6 | `Tailwind yellow-950` |
| #4285F4 | 66, 133, 244 | `src/app/features/login/login.component.ts` |
| #450A0A | 69, 10, 10 | `Tailwind red-950` |
| #4ADE80 | 74, 222, 128 | `Tailwind green-400` |
| #4B5563 | 75, 85, 99 | `Tailwind gray-600` |
| #52525B | 82, 82, 91 | `Tailwind zinc-600` |
| #581C87 | 88, 28, 135 | `Tailwind purple-900` |
| #5EEAD4 | 94, 234, 212 | `Tailwind teal-300` |
| #60A5FA | 96, 165, 250 | `Tailwind blue-400` |
| #64748B | 100, 116, 139 | `Tailwind slate-500` |
| #6B7280 | 107, 114, 128 | `Tailwind gray-500` |
| #6EE7B7 | 110, 231, 183 | `Tailwind emerald-300` |
| #71717A | 113, 113, 122 | `Tailwind zinc-500` |
| #7C2D12 | 124, 45, 18 | `Tailwind orange-900` |
| #7F1D1D | 127, 29, 29 | `Tailwind red-900` |
| #818CF8 | 129, 140, 248 | `Tailwind indigo-400` |
| #84CC16 | 132, 204, 22 | `Tailwind lime-500` |
| #8B5A2B | 139, 90, 43 | `src/app/core/models/user-profile.model.ts` |
| #92400E | 146, 64, 14 | `Tailwind amber-800` |
| #94A3B8 | 148, 163, 184 | `Tailwind slate-400` |
| #9CA3AF | 156, 163, 175 | `Tailwind gray-400` |
| #A1A1AA | 161, 161, 170 | `Tailwind zinc-400` |
| #A3E635 | 163, 230, 53 | `Tailwind lime-400` |
| #A5B4FC | 165, 180, 252 | `Tailwind indigo-300` |
| #A855F7 | 168, 85, 247 | `Tailwind purple-500` |
| #B8E600 | 184, 230, 0 | `src/app/features/workouts/weekly-plan/weekly-plan.component.html` |
| #B91C1C | 185, 28, 28 | `Tailwind red-700` |
| #BBE600 | 187, 230, 0 | `src/app/features/dashboard/dashboard.component.html` |
| #BBF7D0 | 187, 247, 208 | `Tailwind green-200` |
| #BCE600 | 188, 230, 0 | `src/app/features/cardio/cardio-boxing.component.ts` |
| #C084FC | 192, 132, 252 | `Tailwind purple-400` |
| #C0C0C0 | 192, 192, 192 | `src/app/core/models/user-profile.model.ts` |
| #CA8A04 | 202, 138, 4 | `Tailwind yellow-600` |
| #CBD5E1 | 203, 213, 225 | `Tailwind slate-300` |
| #CCFC7E | 204, 252, 126 | `src/app/features/timer/timer.component.ts` |
| #CCFF00 | 204, 255, 0 | `src/app/app.component.html` |
| #CD7F32 | 205, 127, 50 | `src/app/core/models/user-profile.model.ts` |
| #D1D5DB | 209, 213, 219 | `Tailwind gray-300` |
| #D4D4D8 | 212, 212, 216 | `Tailwind zinc-300` |
| #D8B4FE | 216, 180, 254 | `Tailwind purple-300` |
| #DBEAFE | 219, 234, 254 | `Tailwind blue-100` |
| #DC2626 | 220, 38, 38 | `Tailwind red-600` |
| #E2E8F0 | 226, 232, 240 | `Tailwind slate-200` |
| #E4E4E7 | 228, 228, 231 | `Tailwind zinc-200` |
| #E5E4E2 | 229, 228, 226 | `src/app/core/models/user-profile.model.ts` |
| #EA4335 | 234, 67, 53 | `src/app/features/login/login.component.ts` |
| #EAB308 | 234, 179, 8 | `Tailwind yellow-500` |
| #EC4899 | 236, 72, 153 | `Tailwind pink-500` |
| #EF4444 | 239, 68, 68 | `Tailwind red-500` |
| #F472B6 | 244, 114, 182 | `Tailwind pink-400` |
| #F59E0B | 245, 158, 11 | `Tailwind amber-500` |
| #F87171 | 248, 113, 113 | `Tailwind red-400` |
| #F97316 | 249, 115, 22 | `Tailwind orange-500` |
| #FACC15 | 250, 204, 21 | `Tailwind yellow-400` |
| #FAFAFA | 250, 250, 250 | `tailwind.config.js` |
| #FB923C | 251, 146, 60 | `Tailwind orange-400` |
| #FBBC05 | 251, 188, 5 | `src/app/features/login/login.component.ts` |
| #FBBF24 | 251, 191, 36 | `Tailwind amber-400` |
| #FCA5A5 | 252, 165, 165 | `Tailwind red-300` |
| #FCD34D | 252, 211, 77 | `Tailwind amber-300` |
| #FDBA74 | 253, 186, 116 | `Tailwind orange-300` |
| #FEF08A | 254, 240, 138 | `Tailwind yellow-200` |
| #FEF2F2 | 254, 242, 242 | `Tailwind red-50` |
| #FEF9C3 | 254, 249, 195 | `Tailwind yellow-100` |
| #FEFCE8 | 254, 252, 232 | `Tailwind yellow-50` |
| #FF0000 | 255, 0, 0 | `src/app/shared/components/professional-body-map/professional-body-map.component.ts` |
| #FF0033 | 255, 0, 51 | `src/app/features/dashboard/components/recovery-monitor/recovery-monitor.component.html` |
| #FF6600 | 255, 102, 0 | `src/app/features/dashboard/dashboard.component.html` |
| #FFB300 | 255, 179, 0 | `src/app/features/dashboard/components/recovery-monitor/recovery-monitor.component.html` |
| #FFD700 | 255, 215, 0 | `src/app/core/models/user-profile.model.ts` |
| #FFFFFF | 255, 255, 255 | `src/app/features/stats/stats-detail/stats-detail.component.ts` |

Tamaños arbitrarios `text-[…]` encontrados: `8px`, `9px`, `10px`, `11px`, `12px`, `14px`, `16px`, `18px`, `20px`, `24px`, `120px`, `150px`.
