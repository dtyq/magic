# Tailwind CSS Variables Reference

English | [中文](./variables.zh.md)

## Overview

This document lists all Tailwind CSS variables used by the User Selector component library.
All variables use the `us-` prefix (user-selector) to avoid collisions with host-app tokens.

## Naming conventions

- All variables use the `us-` prefix.
- Color variables are expressed in HSL format (Tailwind-friendly).
- Dark mode can be switched with `data-theme="dark"` or a `.dark` scope, depending on your app setup.

## Color variables

### Background

| Variable          | Default (Light)   | Default (Dark)    | Usage                 |
| ----------------- | ----------------- | ----------------- | --------------------- |
| `--us-background` | `0 0% 100%`       | `222.2 84% 4.9%`  | Primary background    |
| `--us-foreground` | `222.2 84% 4.9%`  | `210 40% 98%`     | Primary text          |

### Primary utility

| Variable                  | Default (Light)      | Default (Dark)      | Usage             |
| ------------------------- | -------------------- | ------------------- | ----------------- |
| `--us-primary`            | `221.2 83.2% 53.3%`  | `217.2 91.2% 59.8%` | Brand primary     |
| `--us-primary-foreground` | `210 40% 98%`        | `222.2 47.4% 11.2%` | Text on primary   |

### Secondary

| Variable                    | Default (Light)      | Default (Dark)      | Usage               |
| --------------------------- | -------------------- | ------------------- | ------------------- |
| `--us-secondary`            | `210 40% 96.1%`      | `217.2 32.6% 17.5%` | Secondary surfaces  |
| `--us-secondary-foreground` | `222.2 47.4% 11.2%`  | `210 40% 98%`       | Text on secondary   |

### Destructive

| Variable                      | Default (Light)  | Default (Dark)  | Usage                               |
| ----------------------------- | ---------------- | --------------- | ----------------------------------- |
| `--us-destructive`            | `0 84.2% 60.2%`  | `0 62.8% 30.6%` | Destructive actions (delete, alert) |
| `--us-destructive-foreground` | `210 40% 98%`    | `210 40% 98%`   | Text on destructive                 |

### Muted

| Variable                | Default (Light)      | Default (Dark)      | Usage                          |
| ----------------------- | -------------------- | ------------------- | ------------------------------ |
| `--us-muted`            | `210 40% 96.1%`      | `217.2 32.6% 17.5%` | Muted backgrounds              |
| `--us-muted-foreground` | `215.4 16.3% 46.9%`  | `215 20.2% 65.1%`   | Secondary/helper text          |

### Accent

| Variable                 | Default (Light)      | Default (Dark)      | Usage                           |
| ------------------------ | -------------------- | ------------------- | ------------------------------- |
| `--us-accent`            | `210 40% 96.1%`      | `217.2 32.6% 17.5%` | Accent backgrounds (hover, etc.)|
| `--us-accent-foreground` | `222.2 47.4% 11.2%`  | `210 40% 98%`       | Text on accent                  |

### Border and input

| Variable      | Default (Light)      | Default (Dark)      | Usage              |
| ------------- | -------------------- | ------------------- | ------------------ |
| `--us-border` | `214.3 31.8% 91.4%`  | `217.2 32.6% 17.5%` | Border color       |
| `--us-input`  | `214.3 31.8% 91.4%`  | `217.2 32.6% 17.5%` | Input border color |
| `--us-ring`   | `221.2 83.2% 53.3%`  | `224.3 76.3% 48%`   | Focus ring         |

## Size variables

### Radius utility

| Variable      | Default   | Usage               |
| ------------- | --------- | ------------------- |
| `--us-radius` | `0.5rem`  | Base border radius  |

Tailwind variants based on this token:

- `rounded-lg` = `var(--us-radius)`
- `rounded-md` = `calc(var(--us-radius) - 2px)`
- `rounded-sm` = `calc(var(--us-radius) - 4px)`

## Using variables in host projects

### Option 1: Override variables (recommended)

```css
/* globals.css */
:root {
	--us-primary: 220 90% 56%;
	--us-radius: 0.25rem;
	--us-background: 0 0% 100%;
	--us-foreground: 222.2 84% 4.9%;
}

.dark {
	--us-primary: 217.2 91.2% 59.8%;
	--us-background: 222.2 84% 4.9%;
	--us-foreground: 210 40% 98%;
}
```

### Option 2: Extend Tailwind theme

```js
export default {
	theme: {
		extend: {
			colors: {
				background: "hsl(var(--us-background))",
				foreground: "hsl(var(--us-foreground))",
			},
		},
	},
}
```

### Option 3: Use raw CSS variables directly

```css
.custom-button {
	background-color: hsl(var(--us-primary));
	color: hsl(var(--us-primary-foreground));
	border-radius: var(--us-radius);
}
```

## Legacy-to-new variable mapping

For migration compatibility, these mappings are preserved temporarily:

| Legacy variable   | New variable                       | Notes               |
| ----------------- | ---------------------------------- | ------------------- |
| `--bg`            | `--us-background`                  | Background          |
| `--border-color`  | `--us-border`                      | Border              |
| `--text-color-0`  | `--us-foreground`                  | Primary text        |
| `--text-color-1`  | `--us-foreground` (80% opacity)    | Secondary text      |
| `--text-color-2`  | `--us-muted-foreground`            | Helper text         |
| `--text-color-3`  | `--us-muted`                       | Disabled text       |
| `--brand`         | `--us-primary`                     | Brand               |
| `--primary`       | `--us-primary-foreground`          | Primary foreground  |
| `--danger`        | `--us-destructive`                 | Destructive         |
| `--fill`          | `--us-accent`                      | Fill/Accent         |

Legacy variables will be removed after migration is complete. Prefer new variables in all new code.

## Tailwind utility mapping

### Background/text

```tsx
<div className="bg-background text-foreground">Content</div>
```

### Primary

```tsx
<button className="bg-primary text-primary-foreground">Button</button>
```

### Border

```tsx
<div className="border border-border">Content</div>
```

### Radius

```tsx
<div className="rounded-lg">{/* var(--us-radius) */}</div>
<div className="rounded-md">{/* calc(var(--us-radius) - 2px) */}</div>
<div className="rounded-sm">{/* calc(var(--us-radius) - 4px) */}</div>
```

## Full variable set

### Light mode

```css
:root {
	--us-background: 0 0% 100%;
	--us-foreground: 222.2 84% 4.9%;
	--us-primary: 221.2 83.2% 53.3%;
	--us-primary-foreground: 210 40% 98%;
	--us-secondary: 210 40% 96.1%;
	--us-secondary-foreground: 222.2 47.4% 11.2%;
	--us-destructive: 0 84.2% 60.2%;
	--us-destructive-foreground: 210 40% 98%;
	--us-muted: 210 40% 96.1%;
	--us-muted-foreground: 215.4 16.3% 46.9%;
	--us-accent: 210 40% 96.1%;
	--us-accent-foreground: 222.2 47.4% 11.2%;
	--us-border: 214.3 31.8% 91.4%;
	--us-input: 214.3 31.8% 91.4%;
	--us-ring: 221.2 83.2% 53.3%;
	--us-radius: 0.5rem;
}
```

### Dark mode

```css
[data-theme="dark"] {
	--us-background: 222.2 84% 4.9%;
	--us-foreground: 210 40% 98%;
	--us-primary: 217.2 91.2% 59.8%;
	--us-primary-foreground: 222.2 47.4% 11.2%;
	--us-secondary: 217.2 32.6% 17.5%;
	--us-secondary-foreground: 210 40% 98%;
	--us-destructive: 0 62.8% 30.6%;
	--us-destructive-foreground: 210 40% 98%;
	--us-muted: 217.2 32.6% 17.5%;
	--us-muted-foreground: 215 20.2% 65.1%;
	--us-accent: 217.2 32.6% 17.5%;
	--us-accent-foreground: 210 40% 98%;
	--us-border: 217.2 32.6% 17.5%;
	--us-input: 217.2 32.6% 17.5%;
	--us-ring: 224.3 76.3% 48%;
	--us-radius: 0.5rem;
}
```

## References

- [Tailwind CSS custom properties](https://tailwindcss.com/docs/customizing-colors#using-css-variables)
- [shadcn/ui theming](https://ui.shadcn.com/docs/theming)
- [HSL color format](https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/hsl)
