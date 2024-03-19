# Host Project Migration Guide

English | [中文](./migration-guide.zh.md)

## Overview

This guide explains how to migrate a host project to the updated `@dtyq/user-selector` component library.

## Prerequisites

### 1. Install dependencies

Install the required styling toolchain in your host app:

```bash
pnpm add tailwindcss postcss autoprefixer
```

### 2. Configure Tailwind CSS

Create or update `tailwind.config.js`:

```js
/** @type {import('tailwindcss').Config} */
export default {
	content: [
		"./index.html",
		"./src/**/*.{js,ts,jsx,tsx}",
		"./node_modules/@dtyq/user-selector/**/*.{js,ts,jsx,tsx}",
	],
	theme: {
		extend: {
			colors: {
				background: "hsl(var(--us-background))",
				foreground: "hsl(var(--us-foreground))",
				primary: {
					DEFAULT: "hsl(var(--us-primary))",
					foreground: "hsl(var(--us-primary-foreground))",
				},
			},
		},
	},
	plugins: [],
}
```

### 3. Configure PostCSS

Create or update `postcss.config.js`:

```js
export default {
	plugins: {
		tailwindcss: {},
		autoprefixer: {},
	},
}
```

### 4. Import package styles

Import package styles in your app entry file:

```tsx
// main.tsx or App.tsx
import "@dtyq/user-selector"
import "@dtyq/user-selector/style.css"
```

## Theme variable integration

### Option 1: Use default variables (recommended)

The library ships with sensible defaults, so no extra CSS variable setup is required for basic usage.

### Option 2: Override variables

Override variables in your global stylesheet:

```css
/* globals.css or main.css */
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

### Option 3: Map variables in Tailwind theme

Extend your Tailwind theme so classes and library variables stay aligned:

```js
export default {
	theme: {
		extend: {
			colors: {
				background: "hsl(var(--us-background))",
				foreground: "hsl(var(--us-foreground))",
				primary: {
					DEFAULT: "hsl(var(--us-primary))",
					foreground: "hsl(var(--us-primary-foreground))",
				},
			},
			borderRadius: {
				lg: "var(--us-radius)",
				md: "calc(var(--us-radius) - 2px)",
				sm: "calc(var(--us-radius) - 4px)",
			},
		},
	},
}
```

## Toast setup

If you use toast APIs such as `message.success()`, render `<Toaster />` in your root component:

```tsx
import { Toaster } from "@dtyq/user-selector"

function App() {
	return (
		<>
			{/* App content */}
			<Toaster />
		</>
	)
}
```

## API changes

### Fully compatible APIs

The following parts remain backward compatible:

- Component props
- Ref interfaces
- Type definitions
- Event callbacks

### Important migration notes

#### 1. Modal -> Dialog

`UserSelector` is now implemented with shadcn/ui `Dialog` instead of antd `Modal`, while keeping API compatibility.

```tsx
// Legacy usage (still supported)
<UserSelector open={open} onCancel={onClose} />

// Recommended usage
<UserSelector open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()} />
```

#### 2. message API

The `message` API is unchanged, but `<Toaster />` must be mounted:

```tsx
import { message } from "@dtyq/user-selector"

message.success("Success")
message.error("Failed")
```

#### 3. Style selector updates

If you customized selectors for old internal DOM/class names, update them to the new Radix structure:

```css
/* Old */
.user-selector .ant-checkbox {
	/* ... */
}

/* New */
.user-selector [data-radix-checkbox] {
	/* ... */
}
```

## End-to-end example

### 1. Basic usage

```tsx
import { AppearanceProvider, Toaster, UserSelector } from "@dtyq/user-selector"
import { useState } from "react"

function App() {
	const [open, setOpen] = useState(false)
	const [selectedValues, setSelectedValues] = useState<string[]>([])

	return (
		<AppearanceProvider language="en_US" theme="light">
			<Toaster />
			<UserSelector
				open={open}
				onCancel={() => setOpen(false)}
				data={data}
				selectedValues={selectedValues}
				onSelectChange={setSelectedValues}
			/>
		</AppearanceProvider>
	)
}
```

### 2. Custom style overrides

```css
/* globals.css */
:root {
	--us-primary: 220 90% 56%;
	--us-radius: 0.5rem;
}
```

### 3. Dark mode

```tsx
<AppearanceProvider theme="dark">
	<UserSelector />
</AppearanceProvider>
```

Dark mode variables are applied automatically.

## Troubleshooting

### Styles are not applied

1. Confirm `@dtyq/user-selector/style.css` is imported.
2. Confirm Tailwind `content` config includes the package path.
3. Confirm CSS variables are loaded and not overridden unexpectedly.

### Toast is not visible

1. Confirm `<Toaster />` is mounted.
2. Confirm it is mounted close to app root.

### Type errors

1. Confirm TypeScript version is `>= 5.0`.
2. Confirm your package manager installed all dependencies correctly.

## References

- [Tailwind CSS documentation](https://tailwindcss.com/docs)
- [shadcn/ui documentation](https://ui.shadcn.com/)
- [User Selector variables reference](./variables.md)
