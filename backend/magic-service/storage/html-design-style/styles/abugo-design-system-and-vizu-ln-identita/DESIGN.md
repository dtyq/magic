---
name: ABUGO
colors:
  main: "#2c0842"
  heading: "#0b0011"
  accent: "#7b3aa3"
  text: "#504756"
  action: "#ff9292"
  action-hover: "#eb7777"
  soft: "#f9f1ff"
  white: "#ffffff"
  divider: "#dfe0e3"
  blue-soft: "#e5f0ff"
  cyan: "#00b2ff"
  neutral-200: "#f7f9fc"
  neutral-300: "#eff2f6"
  neutral-400: "#dce2eb"
  neutral-500: "#a0adbd"
  neutral-700: "#39414b"
  neutral-800: "#0e141c"
fonts:
  display: "Termina"
  ui: "Sofia Sans"
  body: "Manrope"
---

# Design System: ABUGO

**Zdroj:** Živý web **https://www.abugo.com/cs** (extrahováno 2026-06-15, Webflow build, computed CSS + CSS custom properties + vizuální audit).

ABUGO Group SE — česká e-commerce/SaaS skupina („Software, který zjednodušuje nakupování").

## 1. Visual Theme & Atmosphere

ABUGO nese vizuální směr **tmavě fialového editorial / tech-luxury**. Hluboká fialová `#2c0842` tvoří kotvu celé identity — dominuje hero sekci i patičce, kde se páruje s bílým textem do sebevědomého, skoro luxusního kontrastu. Místo korporátní modré volí značka temně fialovou, která působí prémiově a vyhraněně. Celkový pocit je plochý, ostrý a záměrný: nulový border-radius, žádné stíny, separace řešená tenkými 1px linkami `#dfe0e3` a velkorysým bílým prostorem.

Atmosféru drží **rytmus střídajících se pozadí** — tmavá fialová, měkká levandulová `#f9f1ff`, čistě bílá — který dává stránce tempo bez dekorací. Korálová `#ff9292` je jediný „hot" akcent: používá se střídmě pro CTA, aktivní stavy a logo, nikdy dekorativně. Velkorysé výšky sekcí a hodně negativního prostoru posouvají dojem k editorial/Swiss disciplíně, kde hierarchii nese velikostní a váhový kontrast typografie, ne barevný šum.

## 2. Color Palette & Roles

### Primary Foundation
| Název | HEX | RGB | Role |
|-------|-----|-----|------|
| **Hluboká brand fialová** | `#2c0842` | 44, 8, 66 | Hlavní brand — hero, footer, tmavé sekce |
| **Měkká levandule** | `#f9f1ff` | — | Pozadí lehkých sekcí (mise, statistiky) |
| **Bílá** | `#ffffff` | 255,255,255 | Pozadí produktových/media sekcí, text na tmavém |

### Accent & Interactive
| Název | HEX | RGB | Role |
|-------|-----|-----|------|
| **Korálová akce** | `#ff9292` | 255, 146, 146 | CTA tlačítka, aktivní stav, logo akcent |
| **Korálová hover** | `#eb7777` | 235, 119, 119 | Hover stav CTA |
| **Fialový akcent** | `#7b3aa3` | 123, 58, 163 | Sekundární fialový akcent |
| **Azurová** | `#00b2ff` | — | Sytý doplňkový akcent |
| **Modrá soft** | `#e5f0ff` | — | Světle modré plochy |

### Typography & Text Hierarchy
| Název | HEX | RGB | Role |
|-------|-----|-----|------|
| **Nadpisová skoro-černá** | `#0b0011` | 11, 0, 17 | Nadpisy na světlém pozadí |
| **Tělová fialovo-šedá** | `#504756` | 80, 71, 86 | Tělový text |
| **Bílá** | `#ffffff` | — | Text na tmavé fialové |

### Neutrals & Functional
| Token | HEX |
|-------|-----|
| `neutral-200` | `#f7f9fc` |
| `neutral-300` | `#eff2f6` |
| `neutral-400` | `#dce2eb` |
| `neutral-500` | `#a0adbd` |
| `neutral-700` | `#39414b` |
| `neutral-800` | `#0e141c` |
| `divider` | `#dfe0e3` |
| `white-72` | `rgba(255,255,255,0.72)` |
| `white-20` | `rgba(255,255,255,0.20)` |

## 3. Typography Rules

### Hierarchy & Weights
Tři rodiny, jasné role — Termina (display, geometrický tech sans), Sofia Sans (UI/nav/tlačítka), Manrope (delší tělový text).

| Prvek | Font | Size / Line-height | Váha | Barva |
|-------|------|--------------------|------|-------|
| Hero H1 | Termina | 72px / 80px | 300 (light) | `#ffffff` |
| H2 | Termina | 40px / 56px | 500 | `#0b0011` |
| H3 | Termina | 24px / 32px | 500 | `#0b0011` / `#fff` |
| Body | Sofia Sans / Manrope | 18px / 32px | 400 | `#504756` |
| Small | — | 16px | 400/500 | `#504756` |
| Nav / Button | Sofia Sans | 18px / 32px | 700 | dle kontextu |

Váhy: Termina 300/500, Sofia Sans 400/700, Manrope 300/400/500.

### Spacing Principles
Hero hraje s váhou v jednom nadpisu — light 300 („Budujeme software, který") + bold mix („zjednodušuje obchod") pro důraz. Velikostní kontrast 72→18px nese hierarchii. Tělový text dýchá na line-height 32px při 18px velikosti (relaxed).

## 4. Component Stylings

### Buttons
```
Primární CTA:
  background: #ff9292   color: #2c0842
  font: Sofia Sans, 18px, 700   padding: 16px 32px
  radius: 0 (ostré rohy)   hover: bg #eb7777

Sekundární / textový odkaz:
  background: transparent
  color: #ffffff (tmavé) / #2c0842 (světlé)
  font: Sofia Sans, 18px, 700   + ikona ↗ (External arrow SVG)
```

### Cards (news / média)
```
background: transparent   border: 1px solid #dfe0e3
padding: 24px   radius: 0
text: #2c0842, Sofia Sans 18px/700
```

### Navigation
Horizontální, položky Sofia Sans 18px/700, bílá na fialovém hero. Aktivní položka: korálové podtržení. Jazykový přepínač EN | CZ vpravo (aktivní = korálová).

### Obrázky s overlay
Foto sekce (zakladatelé, produkty) mají gradient overlay pro čitelnost bílých nadpisů:
```css
background:
  linear-gradient(0deg, rgba(44,8,66,0.72), rgba(44,8,66,0)),
  url();
```
Obrázky: AVIF s JPG fallbackem, Webflow CDN.

### Logo & značka
Wordmark **„ABŪGO"** — verzálky, Termina geometrie. Akcent: písmeno **Ū** má korálový (`#ff9292`) obloukový diakritický prvek. Na tmavém pozadí: bílý wordmark + korálový akcent. SVG logo, favicon 32×32 PNG.

## 5. Layout Principles

### Grid & Structure
Webflow grid, velkorysé výšky sekcí (430–1075px). Plochý design napříč — **radius 0**, **box-shadow: none**.

### Whitespace Strategy
Hodně bílého/negativního prostoru. Padding karet 24px. Dělící linky 1px `#dfe0e3` místo stínů.

### Alignment & Visual Balance
Střídání pozadí sekcí: `#2c0842` (tmavá) → `#f9f1ff` (levandulová) → `#ffffff` (bílá) → opakuje. Hero a footer = tmavá fialová. Editorial/Swiss cítění — separace přes plochy a linky, ne přes dekorace.

### Responsive Behavior
Webflow responzivní breakpointy. CTA touch-targety 16px×32px padding.

## 6. Design System Notes for Stitch Generation

### Language to Use
„Tmavě fialová editorial / tech-luxury. Plochý, ostrý, sebevědomý. Hluboká fialová jako základ, korálová střídmě jako jediný hot akcent. Bez stínů, ostré rohy, velkorysý prostor, Swiss disciplína."

### Color References
- Brand base: **Hluboká fialová** `#2c0842` (hero/footer/tmavé sekce)
- Action: **Korálová** `#ff9292` (CTA, hover `#eb7777`)
- Surfaces: **Levandule** `#f9f1ff`, **bílá** `#ffffff`
- Text: **skoro-černá** `#0b0011` (nadpisy), **fialovo-šedá** `#504756` (tělo)

### Component Prompts
1. „Hero sekce: tmavě fialové pozadí `#2c0842`, bílý Termina nadpis 72px s mixem light/bold váhy, korálové CTA `#ff9292` s fialovým textem, ostré rohy bez stínu."
2. „Karta novinky: transparentní pozadí, 1px `#dfe0e3` border, radius 0, padding 24px, nadpis Sofia Sans 700 ve fialové."
3. „Sekce střídá pozadí — tmavá fialová, levandulová `#f9f1ff`, bílá — bez border-radius, separace tenkými linkami."

### Incremental Iteration
Drž paletu disciplinovanou: fialová + bílá + korálová jen pro akce. Nepřidávej stíny ani zaoblení — to ničí editorial cítění. Tři fonty s pevnými rolemi (Termina display / Sofia Sans UI / Manrope tělo), nemíchej navíc.

## 7. Brand Identity & Voice

### Positioning
ABUGO Group SE — česká skupina budující portfolio SaaS produktů pro e-commerce/nakupování pod jedním přístupem.

- **Tagline:** „Software, který zjednodušuje nakupování"
- **Hero claim:** „Budujeme software, který zjednodušuje obchod"
- **Mise (meta description):** „Spojujeme rostoucí portfolio SaaS produktů zaměřených na nakupování pod jeden společný přístup: stavět se záměrem, škálovat s rozvahou a myslet globálně už od prvního dne."
- **Tematické pilíře:** *Více produktů. Jedna mise.* · *Stavět se záměrem* · *Škálovat s rozvahou* · *Globálně od prvního dne.*

### Tone of Voice
Sebevědomý, vizionářský, věcný. Krátké úderné claimy s váhovým kontrastem (light + bold v jednom řádku). Bilingvální — **CZ + EN** (přepínač v navigaci). Bez marketingového balastu; „tech-luxury" disciplína i v copy.

### Microcopy / CTA
| CTA | Kontext |
|-----|---------|
| „Kontaktujte nás" | Primární CTA (hero, footer) |
| „Naše portfolio" | Sekundární CTA hero |
| „Zobrazit více" | Karty novinek/produktů |
| „Ozvěte se nám" | Kontaktní sekce |

## 8. Information Architecture

Navigace (jednostránkový + odkazy): **O nás · Produkty · Novinky · Kariéra · Kontakt** + jazykový přepínač **EN | CZ**.

Obsahové sekce homepage (7):
1. Hero — claim + CTA (tmavá fialová)
2. Mise / portfolio — „Více produktů. Jedna mise." (levandulová)
3. „Spoznejte Abugo" — představení
4. Exec insights — „Buďte o krok napřed v e-commerce s exec od Abugo"
5. Leadership Abugo — foto sekce s overlay
6. Novinky / média — karty
7. Footer / kontakt (tmavá fialová)

## 9. Social & Externí identita

| Kanál | URL |
|-------|-----|
| LinkedIn (company) | linkedin.com/company/abugo/ |
| X | x.com/abugogroup |
| Facebook | facebook.com/abugogroup/ |
| YouTube | youtube.com/@AbugoGroup |

### SEO / OG
- **Title:** `ABUGO | Software, který zjednodušuje nakupování`
- **Meta description:** viz Mise (sekce 7)
- **og:image:** `…/69403005fa419cad2f3aa4a0_Abugo.avif` (Webflow CDN, AVIF)

## 10. Motion

Minimalistický — v souladu s plochým designem. Jediná znatelná interakce: **`transition: color 0.3s`** na odkazech/CTA (barevný přechod při hoveru, ne transform/shadow). Žádné scroll animace navíc, žádný parallax. Motion = jen barevné stavy, ne dekorace.

## 11. CSS tokeny

```css
:root {
  /* brand */
  --main:        #2c0842;
  --heading:     #0b0011;
  --accent:      #7b3aa3;
  --text:        #504756;
  /* action */
  --action:      #ff9292;
  --action-hover:#eb7777;
  /* surfaces */
  --soft:        #f9f1ff;
  --white:       #ffffff;
  --divider:     #dfe0e3;
  /* secondary */
  --blue-soft:   #e5f0ff;
  --cyan:        #00b2ff;
  /* type */
  --font-display: "Termina", sans-serif;
  --font-ui:      "Sofia Sans", sans-serif;
  --font-body:    "Manrope", sans-serif;
  --radius:       0;
}
```
