# KS Tools France — Design System

KSFranceStorno is a professional intranet tool for the French inside-sales team at KS Tools. The UI should feel like an internal extension of the KS Tools brand: industrial, precise, and trustworthy — never flashy. French is the default language; German and English are also supported.

---

## Colors

### Brand

- **KS Red** (`#e52232`): Primary brand color. Used for buttons, focus rings, accent lines, and the footer stripe. Hover state: `#df1520`. Active/dark: `#c41b2b`.
- **KS Grey** (`#343a40`): Navbar background. Deep charcoal — conveys professionalism.
- **White** (`#ffffff`): Page background and card surfaces.

### Neutral

- **Text Primary** (`#212529`): Body text, headings.
- **Text Muted** (`#6c757d`): Secondary labels, hints, subtitles.
- **Border** (`#dee2e6`): Card borders, dividers.
- **Surface** (`#f8f9fa`): Page background tint, footer.
- **Light Grey** (`#f4f4f4`): Alternate surface for subtle backgrounds.

### Status (Cancellation Result)

These five colors communicate the cancellation outcome at a glance. Always pair with an icon and text — never rely on color alone.

- **FullyCancellable — Green** (`#198754` / Bootstrap `success`): Entire order can be cancelled. Border, badge, and progress bar in green.
- **PartiallyCancellable — Yellow** (`#ffc107` / Bootstrap `warning`): Partial cancellation possible. Use `text-dark` on yellow badges for contrast.
- **NotCancellable — Red** (`#dc3545` / Bootstrap `danger`): Nothing can be cancelled.
- **NotInJeeves — Blue** (`#0dcaf0` / Bootstrap `info`): Order not yet in Jeeves (EDI delay). Use `text-dark` on info badges.
- **NoJeevesDependency — Grey** (`#6c757d` / Bootstrap `secondary`): Article from French stock, no Jeeves link.

---

## Typography

### Fonts

The KS Tools website (`kstools.fr`) uses:

- **Montserrat** (weights 500, 600, 700): Headings, navbar brand, buttons, labels — modern geometric sans-serif.
- **Raleway** (weights 300, 700, 800): Display / hero text — expressive, elegant.

The intranet app uses Bootstrap's native system font stack as a practical fallback (no external font dependency on the intranet). If a redesign targets the public brand, add the Google Fonts import:

```css
@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@500;600;700&family=Raleway:wght@300;700;800&display=swap');
```

### Scale

| Role | Size | Weight | Usage |
|---|---|---|---|
| Page title (h1) | 1.75rem | 700 | Main page heading |
| Section heading (h2–h3) | 1.25–1.5rem | 600 | Card headings, section labels |
| Body | 1rem (16px desktop, 14px mobile) | 400 | Form labels, result text |
| Small / muted | 0.875rem | 400 | Hints, metadata, validation messages |
| Badge | 0.875rem | 600 | Status badges in result card |

- Base: `14px` on mobile, `16px` on screens ≥ 768px (set on `html`).
- Line height: Bootstrap default (`1.5`).
- Letter-spacing on navbar: `0.03em` (subtle refinement for all-caps feel).

---

## Spacing

Bootstrap 5 spacing system — base unit `0.25rem` (4px).

| Token | Value | Usage |
|---|---|---|
| `xs` | 4px (`1`) | Icon gaps, tight inline spacing |
| `sm` | 8px (`2`) | Between form elements, badge padding |
| `md` | 16px (`4`) | Card padding, section spacing |
| `lg` | 24px (`6`) | Between major sections |
| `xl` | 32px (`8`) | Page-level top/bottom breathing room |

Cards use `p-4` (16px) inner padding. Form groups use `mb-3` (12px) between fields.

---

## Components

### Navbar

Dark charcoal bar (`#343a40`) spanning full width. Contains the KS Tools logo (144×36px) on the left, navigation links, and the language switcher (SVG flag images) on the right. Text is white with `font-weight: 600`. On hover: `rgba(255,255,255,0.80)`.

```
[🔴 KS Tools logo]  [Vérification]                [🇫🇷] [🇩🇪] [🇬🇧]
```

- Navbar height: Bootstrap default with `shadow-sm`.
- Mobile: collapses to hamburger (icon inverted white via `filter: invert(1)`).
- Language flags: 28×19px SVG images with `border: 1px solid #ccc; border-radius: 2px`. Active language at full opacity; others at `opacity: 0.5`.

### Cards

All cards use class `.card-ks`:

```css
border: 1px solid #dee2e6;
box-shadow: 0 2px 8px rgba(0,0,0,0.10);
border-radius: 0.5rem;  /* 8px */
```

**Form card**: Single `.card-ks` wrapping the input form. White background, `p-4` body padding.

**Result card**: Same `.card-ks` base, but `border-width: 2px` and border/header color driven by status. The card header shows customer info; the body shows the status badge, quantity progress bar, and reason text.

```
┌─────────────────────────────────────────┐  ← 2px colored border
│ 👤 C-10042 — DUPONT S.A.S.              │  ← tinted header bg
│    Commande : 100042-FR                 │
├─────────────────────────────────────────┤
│ ✅ Annulation totale possible           │  ← status badge
│                                         │
│ Commandé: 100 pcs    Annulable: 100 pcs │  ← qty labels
│ ████████████████████ 100%               │  ← progress bar
│                                         │
│ La totalité peut être annulée…          │  ← PO-localised reason
└─────────────────────────────────────────┘
```

### Buttons

**Primary button** (`.btn-primary` / `.btn-ks`):

- Background: `#e52232` | Hover: `#df1520` | Active border: `#c41b2b`
- Text: white, `font-weight: 600`
- Focus ring: `0 0 0 0.25rem rgba(229,34,50,0.35)`
- Padding: Bootstrap default (`px-4` for the submit button)

No secondary or outline button variants in this app.

### Form Inputs

Bootstrap `.form-control` with KS red focus:

```css
border-color: #e52232;
box-shadow: 0 0 0 0.25rem rgba(229,34,50,0.25);
```

Labels: `fw-semibold`. Required fields marked with `*` after the label text.

Validation messages: `.text-danger small` below each field. Summary alert: `.alert.alert-danger.py-2` above the form.

### Status Badges

Bootstrap badges inside the result card. Font size `fs-6`, padding `px-3 py-2`.

| Status | Classes |
|---|---|
| FullyCancellable | `badge bg-success` |
| PartiallyCancellable | `badge bg-warning text-dark` |
| NotCancellable | `badge bg-danger` |
| NotInJeeves | `badge bg-info text-dark` |
| NoJeevesDependency | `badge bg-secondary` |

### Progress Bar

Shown only when `Status` is `FullyCancellable`, `PartiallyCancellable`, or `NotCancellable`. Represents `CancellableQuantity / OrderedQuantity` as a percentage.

- Height: `12px`, border-radius `6px`
- Bar color matches status (`bg-success` / `bg-warning` / `bg-danger`)
- Quantity labels above bar: left = ordered, right = cancellable
- Percentage label below bar, right-aligned, small muted text

### Page Header

Red 3px horizontal stripe (`.page-header-stripe`) for branded page sections. Used as the footer top border.

---

## Elevation & Shadows

- **Cards**: `0 2px 8px rgba(0,0,0,0.10)` — subtle lift
- **Navbar**: Bootstrap `shadow-sm` — minimal separation from page
- No heavy drop shadows; the app is data-dense and professional

---

## Layout

- Max content width: Bootstrap container (`1320px` on xl). Form column centered: `col-12 col-md-8 col-lg-6`.
- Single-column, vertically stacked: form card → result card.
- Mobile-first; all breakpoints via Bootstrap 5 grid.
- `body` has `margin-bottom: 60px` to account for the footer.

---

## Tone & Language

- **Default language**: French. All UI strings should be French-first.
- **Tone**: Professional and direct. This is an operational tool, not a marketing page.
- **Labels**: Short, imperative (e.g. *Vérifier*, not *Vérification de la commande*).
- **Error messages**: Specific and actionable (e.g. *Ce champ est requis*).
- **Status reasons**: One or two sentences, factual, localised via PO files. Not shown in database — resolved from `status.reason.{Status}` translation keys.
- **No exclamation marks**, no marketing copy.

---

## Don'ts

- ❌ Don't use emoji flags (🇫🇷🇩🇪🇬🇧) — Windows Server lacks emoji font support. Use SVG images.
- ❌ Don't hardcode French strings in C# or Razor — use PO localisation keys.
- ❌ Don't use colors alone to communicate status — always pair with badge text and icon.
- ❌ Don't add decorative illustrations or stock photos — this is an intranet data tool.
- ❌ Don't use more than two card levels of nesting on a single page.
