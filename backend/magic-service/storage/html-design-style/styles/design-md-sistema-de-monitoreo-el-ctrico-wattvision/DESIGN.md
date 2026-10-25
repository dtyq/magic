# DESIGN.md - Sistema de Monitoreo Eléctrico "WattVision"

## 1. Visual Theme & Atmosphere
El diseño debe transmitir **confiabilidad técnica** y **control**. No debe sentirse como una red social o una app de juegos. La interfaz está pensada para ser vista en una laptop o tablet en un entorno doméstico o de pequeño negocio en Bolivia. El ambiente es "Power BI Dashboard" pero simplificado para el usuario final.

## 2. Color Palette
- **Background Primario:** `#121212` (Dark Mode para eficiencia visual y resalte de datos).
- **Superficie de Tarjetas:** `#1E1E1E`.
- **Acento Primario (Datos):** `#00E5FF` (Cian/Neón) para gráficas, KPIs principales y botones de acción.
- **Acento de Alerta:** `#FF453A` (Rojo) para picos de consumo o alertas de "vampiro".
- **Acento Secundario:** `#32D74B` (Verde Lima) para estado "En vivo" o valores normales.
- **Texto Principal:** `#FFFFFF` (Alto contraste).
- **Texto Secundario:** `#98989D` (Gris para etiquetas).

## 3. Component Stylings
- **Tarjetas (Cards):** `border-radius: 16px`. Fondo `#1E1E1E`. Padding interno de `20px`. Borde sutil: `1px solid #2C2C2E`.
- **Gráficos (Charts):** Líneas de grid en `#2C2C2E`. Datos en `#00E5FF` con `#30D158` para gradientes de área. Sin líneas de borde gruesas.
- **Tablas:** Filas con `border-bottom: 1px solid #2C2C2E`. Hover sobre fila cambia fondo a `#252525`.
- **Alertas:** Caja con fondo `#3A1C1C`, texto rojo `#FF453A` y borde izquierdo de `4px solid #FF453A`.

## 4. Typography
- **Títulos:** Inter, Semi Bold, 24px.
- **Métricas KPIs (Watts, kWh, Bs):** JetBrains Mono o Fira Code (Fuente monoespaciada para números), Bold, 32px.
- **Cuerpo:** Inter Regular, 14px.

## 5. Layout Principles
- **Grid:** 12 columnas.
- **Espaciado:** Múltiplos de 8px (8px, 16px, 24px, 32px).
- **Dashboard:** Vista de 3 columnas (KPI, KPI, KPI) en la parte superior, Gráfico principal ocupando 8 columnas, Panel de Alertas ocupando 4 columnas en el lateral derecho.

## 6. Do's and Don'ts
- ✅ **Do:** Usar gráficos de área para suavizar picos de consumo.
- ✅ **Do:** Incluir la equivalencia en Bolivianos (`Bs.`) siempre junto al kWh.
- ❌ **Don't:** Usar colores pastel o fondos blancos (dificultan la lectura prolongada de datos).
- ❌ **Don't:** Usar iconos genéricos de "foco". Preferir iconos de "rayo", "enchufe" o "medidor".
