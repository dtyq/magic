# iFraldas Design System

Diretrizes de design dos projetos da iFraldas.com.br

## Design Tokens

### Cores

#### Iris Blue (Primary)
- iris-50: #e6f8f9
- iris-100: #ccf0f2
- iris-200: #b3e9eb
- iris-300: #99e2e4
- iris-400: #80dbdd
- iris-600: #019296
- iris-700: #016d71
- iris-800: #01474a
- iris-900: #002425
- iris-default: #01b6bc

#### Blue Marguerite (Accent)
- marguerite-50: #f0eef9
- marguerite-100: #e2e1f6
- marguerite-200: #d4d1f0
- marguerite-300: #c6c3ea
- marguerite-400: #b8b5e8
- marguerite-600: #5953a8
- marguerite-700: #3f3d7e
- marguerite-800: #2c2a54
- marguerite-900: #161428
- marguerite-default: #6f69d2

#### Slate (Neutral Text/Borders)
- slate-50: #ebebee
- slate-100: #d7d7dd
- slate-200: #c3c3ca
- slate-300: #afafba
- slate-400: #9a9ba9
- slate-600: #2b2d42
- slate-700: #201f31
- slate-800: #161621
- slate-900: #0b0b10
- slate-default: #363853

#### Neutral (Backgrounds)
- neutral-50: #fafbfc
- neutral-100: #f7f8f9
- neutral-200: #eff1f3
- neutral-300: #eff1f3
- neutral-400: #ebedf0
- neutral-600: #adadb4
- neutral-700: #828387
- neutral-800: #565859
- neutral-900: #2b2b2d
- neutral-black: #000000
- neutral-white: #ffffff
- neutral-default: #d8dbe1

#### Error
- error-50: #ffe9f0
- error-100: #ffd7de
- error-200: #ffc4cf
- error-300: #ffb0bd
- error-400: #ff9dac
- error-600: #cc2e48
- error-700: #992237
- error-800: #661726
- error-900: #330b13
- error-default: #ff395b

#### Salmon Pink (Secondary)
- salmon-50: #ffe8f6
- salmon-100: #ffe8f6
- salmon-200: #ffddee
- salmon-300: #ffd1e6
- salmon-400: #ffc6dd
- salmon-600: #cc7081
- salmon-700: #995561
- salmon-800: #663a40
- salmon-900: #331d20
- salmon-default: #ff8da1

#### Yellow (Warnings)
- yellow-50: #fffbf0
- yellow-100: #fff6e1
- yellow-200: #fff0ca
- yellow-300: #ffeab3
- yellow-400: #ffe49c
- yellow-500: #efb100
- yellow-600: #b88600
- yellow-700: #805c00
- yellow-800: #483700
- yellow-900: #241b00

### Tipografia

#### Font Families
- **Poppins**: Body text, labels, UI elements
- **Nunito**: Headings, titles
- **Menlo**: Code, technical content

#### Headings (com responsividade fluida - clamp)

- **h1**: clamp(1.75rem, 5vw, 3rem) | Nunito Bold | Line-height: 1.1
- **h2**: clamp(1.5rem, 4vw, 2.25rem) | Nunito Bold | Line-height: 1.1
- **h3**: clamp(1.25rem, 3.5vw, 1.875rem) | Nunito Bold | Line-height: 1.1
- **h4**: clamp(1rem, 2.5vw, 1.5rem) | Nunito Bold | Line-height: 1.1
- **h5**: clamp(1rem, 2vw, 1.25rem) | Nunito Bold | Line-height: 1.1
- **h6**: 1rem | Nunito Bold | Line-height: 1.1

#### Body Text

- **base**: 1rem | Poppins Regular | Line-height: 1.5
- **sm**: 0.875rem | Poppins Regular | Line-height: 1.5
- **xs**: 0.75rem | Poppins Regular | Line-height: 1.5

### Espaçamento

- **0**: 0px
- **0.5**: 2px
- **1**: 4px
- **2**: 8px
- **3**: 12px
- **4**: 16px (padrão)
- **6**: 24px
- **8**: 32px
- **12**: 48px

### Border Radius

- **xsm**: 4px
- **sm**: 8px
- **md**: 12px
- **lg**: 16px
- **xl**: 24px
- **full**: 9999px (círculo/pill)

### Border Width

- **xm**: 1px (padrão)

### Sombras

- **sm**: 0 1px 2px rgba(0, 0, 0, 0.05)
- **md**: 0 4px 6px rgba(0, 0, 0, 0.1)
- **lg**: 0 10px 15px rgba(0, 0, 0, 0.15)
- **xl**: 0 20px 25px rgba(0, 0, 0, 0.2)

### Estados

#### Default
- Cor base sem alterações
- Sem sombra ou shadow-sm

#### Hover
- Cor escurecida (usar tons /600 ou /700)
- shadow-md
- Cursor pointer
- Transição: 200ms ease

#### Focus
- Outline: 2px solid iris
- Outline offset: 2px
- Shadow: shadow-md
- Para acessibilidade

#### Active
- Cor ainda mais escura (/700, /800)
- Shadow: shadow-sm
- Sem transição (feedback imediato)

#### Disabled
- Cor: slate-50 (fundo) + slate-400 (texto)
- Opacity: 0.6
- Cursor: not-allowed
- Sem hover/focus effects

---

## Componentes

### Button (UButton)

**Variantes:**
- 6 tipos × 2 tamanhos × 3 estados = 36 variantes

**Tipos:**
- Default (sólido iris-blue)
- Outline (borda iris-blue)
- Transparent (sem borda)
- IconSolid (apenas ícone com fundo)
- IconOutline (apenas ícone com borda)
- IconTransparent (apenas ícone)

**Tamanhos:**
- MD: 16px Poppins Bold | Padding: 16px 12px
- SM: 14px Poppins Bold | Padding: 8px 12px

**Estados:**
- Default, Hover, Disable

### Input / Text Field

**Tamanhos:**
- SM: 32px height | 14px font | 8px 12px padding
- MD: 40px height | 16px font | 12px 16px padding

**Estados:**
- Default: border slate-300 | bg white
- Hover: border slate-400 | shadow-sm
- Focus: border iris | outline iris | shadow-md
- Filled: border slate-300 | bg white | texto escuro
- Disabled: border slate-100 | bg slate-50 | cursor not-allowed
- Error: border error | bg error-50 | helper text error

**Propriedades:**
- Font: Poppins Regular
- Border Radius: 9999px (full)
- Transition: 200ms ease

### Checkbox

**Tamanho:** 20×20px

**Estados:**
- Unchecked default: border slate-300 | bg white
- Unchecked hover: border slate-400 | shadow-sm
- Checked: bg iris | border iris
- Checked hover: bg iris-600 | shadow-sm
- Disabled: opacity 0.6 | cursor not-allowed
- Focus: outline iris | outline-offset 2px

**Propriedades:**
- Border Radius: 4px (xsm)
- Transition: 200ms ease
- Icon: checkmark white

### Select / Dropdown

**Tamanhos:**
- SM: 32px height | 14px font
- MD: 40px height | 16px font

**Estados:**
- Default (closed): border slate-300 | placeholder slate-400
- Hover: border slate-400 | shadow-sm
- Focus: border iris | outline iris | shadow-md
- Open: border iris | menu shadow-lg
- Disabled: cursor not-allowed | opacity 0.6

**Menu Options:**
- Default: bg white | padding 12px 16px
- Hover: bg iris-50 | border-left 3px iris
- Selected: bg iris-100 | border-left iris
- Disabled: bg slate-50 | cursor not-allowed

**Propriedades:**
- Font: Poppins Regular
- Border Radius: 9999px (full)
- Menu border-radius: 8px (sm)

### Toggle / Switch

**Dimensões:**
- Width: 48px | Height: 24px
- Toggle circle: 20px

**Estados:**
- OFF: bg slate-300 | circle white (left)
- OFF hover: bg slate-400 | shadow-sm
- ON: bg iris | circle white (right)
- ON hover: bg iris-600 | shadow-sm
- Disabled: opacity 0.6 | cursor not-allowed

**Propriedades:**
- Border Radius: 9999px (full)
- Transition: 200ms ease
- Animation: circle desliza suavemente

### Badge

**Tamanhos:**
- SM: 20px height | 12px font | 4px 8px padding
- MD: 24px height | 14px font | 6px 12px padding

**Variantes (por cor/contexto):**
- Primary: bg iris | text white
- Success: bg #22c55e | text white
- Warning: bg yellow-500 | text slate-default
- Error: bg error-default | text white
- Neutral: bg slate-300 | text white
- Outline: border + transparent bg

**Propriedades:**
- Font: Poppins Bold
- Border Radius: 4px (xsm)
- Display: inline-block

### Alert / Toast

**Tipos:**
- Alert: fixo na página
- Toast: flutuante (bottom-right, top-right, etc)

**Variantes:**
- Success: bg #f0fdf4 | border-left #22c55e
- Error: bg error-50 | border-left error-default
- Warning: bg #fffbef | border-left yellow-500
- Info: bg iris-50 | border-left iris

**Estrutura:**
- Icon (24×24px) | Title (14px Bold) | Close button
- Description: 14px Regular

**Propriedades:**
- Border Radius: 8px (sm)
- Auto-dismiss: 4-6 segundos (Toast)
- Z-index: 50 (Alert) | 100 (Toast)

### Progress Bar

**Tamanhos:**
- SM: 4px height
- MD: 8px height
- LG: 12px height

**Estrutura:**
- Background container: slate-200
- Progress bar: iris (dinâmico 0-100%)

**Variantes:**
- Default: bg container slate-200 | progress iris
- Success: progress #22c55e
- Warning: progress yellow-500
- Error: bg error-100 | progress error-default

**Propriedades:**
- Border Radius: 9999px (full)
- Transition: 300ms ease
- Label: 12px Poppins Regular

### Spinner / Loading

**Tamanhos:**
- SM: 24×24px
- MD: 40×40px
- LG: 56×56px

**Estilos:**
- Circular rotating spinner
- Border background: slate-200
- Progress arc: iris

**Variantes:**
- Primary: iris
- White: white
- Secondary: salmon
- Success: #22c55e

**Propriedades:**
- Border Radius: 50% (círculo)
- Animation: 1.4s linear infinite
- Direction: clockwise

### Card - How It Works

**Dimensões:**
- Width: responsivo (grid auto-fit, min 280px)
- Padding: 16px
- Border Radius: 16px (lg)
- Border: 1px solid iris-100
- Shadow: shadow-md

**Estrutura:**
- Card Header: Imagem (48×86px) + Título (h3)
- Card Body: Descrição (text-base)
- Card CTA: UButton transparent (opcional)

**Propriedades:**
- Background: white
- Gap entre sections: 16px
- Layout: responsivo com CSS Grid
  ```css
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr))
  gap: 16px
  ```

### Card - Testimonials

**Dimensões:**
- Width: responsivo (grid auto-fit, min 280px)
- Padding: 16px
- Border Radius: 16px (lg)
- Border: 1px solid iris-100
- Shadow: shadow-md

**Estrutura:**
- Card Header: 5 stars + quote icon
- Card Body: Testimonial text (text-base)
- Divider: 1px slate-200
- Profile: Avatar (56×56px) + name (h5) + role (text-xm salmon)

**Propriedades:**
- Background: white
- Gap: 16px entre sections
- Layout: responsivo (grid auto-fit)

### Accordion / FAQ Items

**Dimensões:**
- Width: 473px (responsivo 100%)
- Padding: 16px
- Border Radius: 12px (xl)
- Border: 1px solid iris-200
- Shadow: shadow-sm

**Estados:**
- Closed default: bg white | border iris-200 | height 56px
- Closed hover: bg iris-50 | border iris-300 | shadow-sm
- Open: bg white | border iris-300 | height auto

**Estrutura:**
- Header: Title (text-base) + Icon chevron
- Body (quando aberto): Content (text-base slate-600)

**Animação:**
- Icon rotation: 0° → 180°
- Expand: 300ms ease-out
- Slide-down: 200ms ease-out

**Propriedades:**
- Font: Poppins Regular
- Transition: 300ms ease
- Icon size: 16×16px

---

## Grid & Breakpoints

### Tailwind CSS Standard Breakpoints
- sm: 640px
- md: 768px
- lg: 1024px
- xl: 1280px
- 2xl: 1536px

### Mobile-First Approach
- Default styles: mobile (375px)
- Responsive adjustments via Tailwind breakpoints

---

## Implementação

Este design system foi desenvolvido para ser implementado com **Tailwind CSS v4** seguindo a configuração em `tailwind.config.js`.

Todos os componentes utilizam os design tokens definidos acima e seguem o padrão de estados (default, hover, focus, active, disabled).

Para componentes responsivos (Cards, etc), utilize a abordagem CSS Grid com `repeat(auto-fit, minmax(...))` para garantir fluidez em todos os tamanhos de tela.
