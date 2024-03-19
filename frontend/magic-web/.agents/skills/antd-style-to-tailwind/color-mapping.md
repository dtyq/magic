# Complete Color Mapping Reference

Source of truth:
- Tailwind variables: `src/index.css` + `tailwind.config.js`
- Magic tokens: `src/opensource/providers/ThemeProvider/colorSchema.json`
- Token types: `src/utils/palettes.ts` (`ColorUsages`, `ColorScales`)

---

## Part 1 — Tailwind Semantic Variables (CSS-var based)

These are defined in `src/index.css` and mapped in `tailwind.config.js`.
They **auto-adapt to dark mode** — never add `dark:` when using these.

| Tailwind class | CSS variable | Light value | Dark value |
|---------------|-------------|-------------|------------|
| `bg-background` | `--background` | white | near-black |
| `text-foreground` | `--foreground` | #1c1d23 (near-black) | near-white |
| `bg-card` | `--card` | white | dark surface (#343435) |
| `text-card-foreground` | `--card-foreground` | near-black | near-white |
| `bg-popover` | `--popover` | white | dark surface |
| `border-border` | `--border` | rgba(28,29,35,0.08) | rgba(255,255,255,0.10) |
| `bg-muted` | `--muted` | #f7f7f7 | dark muted |
| `text-muted-foreground` | `--muted-foreground` | #737373 | #b3b3b3 |
| `bg-fill` | `--fill` | #f7f7f7 | dark fill |
| `bg-fill-secondary` | `--fill-secondary` | #e8e8e8 | rgba(white,0.10) |
| `bg-accent` | `--accent` | #f7f7f7 | dark accent |
| `bg-primary` | `--primary` | near-black | near-white |
| `text-primary-foreground` | `--primary-foreground` | near-white | near-black |
| `bg-secondary` | `--secondary` | #f7f7f7 | dark secondary |
| `text-destructive` | `--destructive` | red-ish | lighter red |
| `bg-destructive/10` | `--destructive` | 10% destructive | 10% destructive |
| `bg-destructive/20` | `--destructive` | 20% destructive | 20% destructive |
| `ring` | `--ring` | gray | gray |

> **Rule**: Always prefer semantic Tailwind vars over color scales. Only use color scales when there is no fitting semantic var.

---

## Part 2 — `magicColorUsages` → Tailwind

### Text colors

| Token | Light hex (approx) | Tailwind (light) | Dark mode |
|-------|--------------------|-----------------|-----------|
| `text[0]` | rgba(28,29,35,1) | `text-foreground` | auto |
| `text[1]` | rgba(28,29,35,0.8) | `text-foreground/80` | auto |
| `text[2]` | rgba(28,29,35,0.6) | `text-muted-foreground` | auto |
| `text[3]` | rgba(28,29,35,0.35) | `text-foreground/35` | auto |
| `white` | #ffffff | `text-white` | `text-white` |
| `black` | #000000 | `text-black` | `text-black` |

### Fill / Background

| Token | Light | Tailwind (light) | Dark |
|-------|-------|-----------------|------|
| `fill[0]` | rgba(46,47,56,0.05) | `bg-fill` ¹ | auto |
| `fill[1]` | rgba(46,47,56,0.09) | `bg-black/[0.09]` | `dark:bg-white/[0.09]` |
| `fill[2]` | rgba(46,47,56,0.13) | `bg-black/[0.13]` | `dark:bg-white/[0.13]` |
| `bg[0–4]` | white | `bg-background` | auto |
| `nav.bg` | white | `bg-background` | auto |
| `overlay.bg` | rgba(22,22,26,0.6) | `bg-black/60` | `bg-black/60` |
| `shadow` | rgba(0,0,0,0.04) | `shadow-sm` | `shadow-sm` |

¹ `--fill` in tailwind.config.js is `var(--fill)` which equals `fill[0]` semantically

### Border

| Token | Light | Tailwind |
|-------|-------|----------|
| `border` | rgba(28,29,35,0.08) | `border-border` (auto dark) |
| `focus.border` | brand-5 | `border-primary` / `ring` |
| `disabled.border` | grey-1 ≈ #e6e7ea | `border-gray-200` + `dark:border-white/10` |

### Status colors (⚠️ warning = orange, not amber)

| Token | Light value | Tailwind light | Tailwind dark |
|-------|------------|---------------|---------------|
| `warning.default` | orange-5 = #ff7d00 | `text-orange-500` | `dark:text-orange-400` |
| `warning.hover` | orange-6 = #db6100 | `text-orange-600` | `dark:text-orange-500` |
| `warning.active` | orange-7 = #b84800 | `text-orange-700` | `dark:text-orange-600` |
| `warningLight.default` | orange-0 = #fff8eb | `bg-orange-50` | `dark:bg-orange-500/20` |
| `warningLight.hover` | orange-1 = #ffeccc | `bg-orange-100` | `dark:bg-orange-500/30` |
| `warningLight.active` | orange-2 = #ffd599 | `bg-orange-200` | `dark:bg-orange-500/40` |
| `danger.default` | red-4 = #ff4d3a | `text-destructive` | auto |
| `danger.hover` | red-6 = #db0701 | `text-red-700` | `dark:text-red-500` |
| `dangerLight.default` | red-0 = #fff0eb | `bg-destructive/10` | auto |
| `dangerLight.hover` | red-1 = #ffd7ce | `bg-destructive/20` | auto |
| `primary.default` | brand-5 = #315cec | `text-primary` ² | auto |
| `primary.hover` | brand-6 = #2447c8 | `text-primary/80` | auto |
| `primaryLight.default` | brand-0 = #eef3fd | `bg-primary-10` | auto (project token, use not `bg-primary/10`) |
| `success.default` | green-5 = #32c436 | `text-green-500` | `dark:text-green-400` |
| `success.hover` | green-6 = #28a32d | `text-green-600` | `dark:text-green-500` |
| `successLight.default` | green-0 = #ecf9ec | `bg-green-50` | `dark:bg-green-500/20` |
| `successLight.hover` | green-1 = #d0f3cf | `bg-green-100` | `dark:bg-green-500/30` |
| `info.default` | blue-5 = #007eff | `text-blue-500` | `dark:text-blue-400` |
| `infoLight.default` | blue-0 = #ebf6ff | `bg-blue-50` | `dark:bg-blue-500/20` |
| `secondary.default` | blue-5 = #007eff | `text-blue-500` | `dark:text-blue-400` |
| `secondaryLight.default` | blue-0 = #ebf6ff | `bg-blue-50` | `dark:bg-blue-500/20` |
| `tertiary.default` | grey-5 = #6b6d75 | `text-muted-foreground` | auto |
| `tertiaryLight.default` | grey-0 = #f9f9f9 | `bg-gray-50` | `dark:bg-white/5` |
| `default.default` | grey-0 = #f9f9f9 | `bg-muted` | auto |
| `default.hover` | grey-1 = #e6e7ea | `bg-fill-secondary` | auto |

² In dark mode, `--primary` flips to near-white, so `text-primary` auto-handles dark mode.

### Disabled states

| Token | Light value | Tailwind light | Tailwind dark |
|-------|------------|---------------|---------------|
| `disabled.bg` | grey-1 = #e6e7ea | `bg-gray-200` | `dark:bg-white/10` |
| `disabled.fill` | rgba(grey-8, 0.04) | `bg-black/[0.04]` | `dark:bg-white/[0.04]` |
| `disabled.text` | rgba(grey-9, 0.35) | `text-foreground/35` | auto |
| `disabled.border` | grey-1 = #e6e7ea | `border-gray-200` | `dark:border-white/10` |

### Highlight

| Token | Light | Dark | Tailwind |
|-------|-------|------|---------|
| `highlight.default` | black | white | `text-foreground` |
| `highlight.bg` | yellow-4 = #ffc900 | yellow-2 = #ffe999 | `bg-yellow-300` / `dark:bg-yellow-200` |

### Project-specific opacity tokens (index.css)

Use semantic token for primary light, and slash opacity for destructive:

| Avoid | Use | Variable |
|-------|-----|----------|
| `bg-primary/10` | `bg-primary-10` | `--custom-primary-10-dark-primary-20` |
| `bg-destructive-10` | `bg-destructive/10` | `--destructive` |
| `bg-destructive-20` | `bg-destructive/20` | `--destructive` |
| outline border | `border-[var(--custom-outline-10-dark-outline-20)]` | `--custom-outline-10-dark-outline-20` |

---

## Part 3 — `magicColorScales` → Tailwind

All scales run index 0–9. **Light mode: 0=lightest, 9=darkest. Dark mode: reversed.**

### Grey scale

| Index | Light hex | Dark hex | Tailwind approx |
|-------|-----------|----------|----------------|
| [0] | #F9F9F9 | #1C1D23 | `bg-gray-50` / dark: `bg-gray-900` |
| [1] | #E6E7EA | #2E2F38 | `bg-gray-200` / dark: `bg-gray-800` |
| [2] | #C6C8CD | #41434C | `border-gray-300` / dark: `border-gray-700` |
| [3] | #A7A9B0 | #555761 | `text-gray-400` / dark: `text-gray-600` |
| [4] | #888892 | #6B6D75 | `text-gray-400` / dark: `text-gray-500` |
| [5] | #6B6D75 | #888892 | `text-gray-500` / dark: `text-gray-400` |
| [6] | #555761 | #A7A9B0 | `text-gray-600` / dark: `text-gray-400` |
| [7] | #41434C | #C6C8CD | `text-gray-700` / dark: `text-gray-300` |
| [8] | #2E2F38 | #E6E7EA | `text-gray-800` / dark: `text-gray-200` |
| [9] | #1C1D23 | #F9F9F9 | `text-gray-900` / dark: `text-gray-50` |

**Common usage:**
- `grey[0]` (very light bg) → `bg-muted` or `bg-gray-50`
- `grey[2]` (light border) → `border-border` or `border-gray-300`
- `grey[8]` (dark text fill, 5-13% opacity) → `bg-black/[0.09]` (light), `bg-white/[0.09]` (dark)
- `grey[9]` (near-black for text) → `text-foreground`

### Brand / Blue / Status scales (commonly used indices)

| Scale | Index | Light hex | Tailwind |
|-------|-------|-----------|---------|
| `brand` | [0] | #EEF3FD | `bg-blue-50` |
| `brand` | [5] | #315CEC | `text-blue-600` |
| `blue` | [0] | #EBF6FF | `bg-blue-50` |
| `blue` | [5] | #007EFF | `text-blue-500` |
| `green` | [0] | #ECF9EC | `bg-green-50` |
| `green` | [5] | #32C436 | `text-green-500` |
| `red` | [0] | #FFF0EB | `bg-red-50` |
| `red` | [4] | #FF4D3A | `text-red-500` |
| `orange` | [0] | #FFF8EB | `bg-orange-50` |
| `orange` | [5] | #FF7D00 | `text-orange-500` |
| `amber` | [0] | #FFFBEB | `bg-amber-50` |
| `amber` | [5] | #FFA400 | `text-amber-500` |
| `yellow` | [0] | #FFFCEB | `bg-yellow-50` |
| `yellow` | [5] | #FFC900 | `text-yellow-400` |

---

## Part 4 — Hardcoded Hex → Tailwind

Exact matches with Tailwind v3 default scale:

| Hex | Context | Tailwind class | Dark variant |
|-----|---------|---------------|-------------|
| `#9ca3af` | suspended text | `text-gray-400` | `dark:text-gray-500` |
| `#3b82f6` | success/finished text | `text-blue-500` | `dark:text-blue-400` |
| `#ebf2fe` | finished badge bg | `bg-[#ebf2fe]` | `dark:bg-blue-500/10` |
| `#f5f6f7` | suspended badge bg | `bg-[#f5f6f7]` | `dark:bg-white/10` |
| `#f9f9f9` | menu item bg | `bg-gray-50` | `dark:bg-white/5` |
| `#ffffff` | button/surface | `bg-white` | `dark:bg-card` |
| `#e5e5e5` | light border | `border-border` | auto |
| `rgba(46,47,56,0.09)` | loading overlay | `bg-black/[0.09]` | `dark:bg-white/[0.09]` |
| `rgba(0,0,0,0.05)` | shadow | `shadow-sm` | — |

---

## Part 5 — Border Radius Reference

The project extends Tailwind's `borderRadius` in `tailwind.config.js`. Note that `rounded-xl` is overridden.

| px | Tailwind class | Value |
|----|---------------|-------|
| 2px | `rounded-xs` | `var(--radius-xs)` |
| 6px | `rounded-sm` | `calc(var(--radius) - 4px)` |
| 8px | `rounded-md` | `calc(var(--radius) - 2px)` |
| 10px | `rounded-lg` | `var(--radius)` = 0.625rem |
| 12px | `rounded-[12px]` | arbitrary (no built-in) |
| 14px | `rounded-xl` | `calc(var(--radius) + 4px)` ⚠️ overridden |
| 9999px | `rounded-full` | standard |

---

## Part 6 — Quick Decision Guide

```
token.magicColorUsages.text[0]          → text-foreground
token.magicColorUsages.text[1]          → text-foreground/80
token.magicColorUsages.text[2]          → text-muted-foreground
token.magicColorUsages.text[3]          → text-foreground/35
token.magicColorUsages.fill[0]          → bg-fill (or bg-black/5 + dark:bg-white/5)
token.magicColorUsages.fill[1]          → bg-black/[0.09] + dark:bg-white/[0.09]
token.magicColorUsages.fill[2]          → bg-black/[0.13] + dark:bg-white/[0.13]
token.magicColorUsages.border           → border-border
token.magicColorUsages.bg[0..4]         → bg-background
token.magicColorUsages.warning.default  → text-orange-500 + dark:text-orange-400
token.magicColorUsages.warningLight.*   → bg-orange-50/100/200 + dark:bg-orange-500/20-40
token.magicColorUsages.danger.default   → text-destructive
token.magicColorUsages.dangerLight.*    → bg-destructive/10 and bg-destructive/20
token.magicColorUsages.primary.default  → text-primary
token.magicColorUsages.primaryLight.*   → bg-primary-10 (not bg-primary/10)
token.magicColorUsages.success.default  → text-green-500 + dark:text-green-400
token.magicColorUsages.successLight.*   → bg-green-50/100 + dark:bg-green-500/20-30
token.magicColorUsages.info.default     → text-blue-500 + dark:text-blue-400
token.magicColorUsages.infoLight.*      → bg-blue-50/100 + dark:bg-blue-500/20-30
token.magicColorUsages.tertiary.default → text-muted-foreground
token.magicColorUsages.disabled.bg      → bg-gray-200 + dark:bg-white/10
token.magicColorUsages.disabled.text    → text-foreground/35
token.magicColorScales.grey[0]          → bg-gray-50 / bg-muted
token.magicColorScales.grey[2]          → border-border (preferred) or border-gray-300
token.magicColorScales.grey[8]          → (used as fill base) see fill[0..2]
token.magicColorScales.grey[9]          → text-foreground
```
