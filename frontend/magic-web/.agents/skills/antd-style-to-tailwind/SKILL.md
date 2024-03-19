---
name: antd-style-to-tailwind
description: Migrate existing antd-style CSS-in-JS (createStyles) components to Tailwind CSS utility classes with full dark mode support, following the project's style system transition strategy. Use when the user asks to migrate, convert, or rewrite antd-style components to Tailwind, or when working on new components in files that already use antd-style.
---

# antd-style → Tailwind CSS Migration

## When to apply

- User asks to migrate / rewrite / convert a component's styles to Tailwind
- A new feature is being built in a file that currently uses `createStyles`
- User references `styles.ts`, `createStyle`, `useXxxStyles`, or `cx()`
- Component contains antd `Button` — replace with shadcn Button during migration

## Prerequisites

Always read these files before starting:

- The target component (`index.tsx` or equivalent)
- Its `styles.ts`
- `tailwind.config.js` and `src/index.css` if token mapping is unclear

## Migration Steps

### 1. Audit the `styles.ts`

Identify:

- Styles used **only** by this component → remove from `styles.ts`
- Styles shared with **other** components → keep `createStyles` for those

Also check if the styles file is imported anywhere else before deleting:

```bash
rg "from.*ComponentName/styles" --type tsx --type ts
```

### 2. Replace `createStyles` wiring

```diff
- import { useXxxStyles } from "./styles"
+ import { cn } from "@/opensource/lib/utils"

  const targetComponent = observer((props) => {
-   const { styles, cx } = useXxxStyles()
```

Use `cn()` everywhere `cx()` was used.

Do **not** build class strings with `+` concatenation. Prefer:

```tsx
const segmentedClassName = cn(
	"rounded-md border border-border p-1",
	"[&_.magic-segmented-group]:gap-0.5",
	"[&_.magic-segmented-item-label]:text-xs",
)
```

### 3. Z-index semantic tokens

Prefer semantic z-index classes over arbitrary `z-[N]` values.

| Value | Tailwind class | CSS variable         |
| ----- | -------------- | -------------------- |
| 1000  | `z-tooltip`    | `--z-index-tooltip`  |
| 1000  | `z-popup`      | `--z-index-popup`    |
| 1000  | `z-dropdown`   | `--z-index-dropdown` |
| 1000  | `z-dialog`     | `--z-index-dialog`   |
| 1000  | `z-drawer`     | `--z-index-drawer`   |

Choose by context: use `z-tooltip` for tooltips, `z-dropdown` for menus, `z-dialog` for modals.

### 4. Translate CSS properties

| CSS                                      | Tailwind                               |
| ---------------------------------------- | -------------------------------------- |
| `width: 100%`                            | `w-full`                               |
| `width: fit-content`                     | `w-fit`                                |
| `height: fit-content`                    | `h-fit`                                |
| `padding: 12px 0`                        | `py-3`                                 |
| `padding: 10px`                          | `p-2.5`                                |
| `padding: 6px`                           | `p-1.5`                                |
| `padding: 4px 8px`                       | `px-2 py-1`                            |
| `padding: 4px 6px`                       | `px-1.5 py-1`                          |
| `padding: 0 4px`                         | `px-1`                                 |
| `padding: 0 6px`                         | `px-1.5 py-0`                          |
| `margin-top: 6px`                        | `mt-1.5`                               |
| `margin-top: 10px`                       | `mt-2.5`                               |
| `margin-left: auto`                      | `ml-auto`                              |
| `display: flex`                          | `flex`                                 |
| `display: inline-flex`                   | `inline-flex`                          |
| `flex-direction: column`                 | `flex-col`                             |
| `align-items: center`                    | `items-center`                         |
| `align-self: flex-end`                   | `self-end`                             |
| `justify-content: flex-end`              | `justify-end`                          |
| `gap: 4px`                               | `gap-1`                                |
| `gap: 6px`                               | `gap-1.5`                              |
| `gap: 10px`                              | `gap-2.5`                              |
| `font-size: 12px; line-height: 16px`     | `text-xs leading-4`                    |
| `font-size: 10px; line-height: 13px`     | `text-[10px] leading-[13px]`           |
| `font-size: 14px; line-height: 1.4`      | `text-sm leading-[1.4]`                |
| `font-weight: 600`                       | `font-semibold`                        |
| `font-weight: 400`                       | `font-normal`                          |
| `cursor: pointer`                        | `cursor-pointer`                       |
| `cursor: default`                        | `cursor-default`                       |
| `cursor: not-allowed`                    | `cursor-not-allowed`                   |
| `position: relative`                     | `relative`                             |
| `position: absolute`                     | `absolute`                             |
| `flex: none`                             | `flex-none`                            |
| `flex-shrink: 1`                         | `shrink` (default, often omit)         |
| `white-space: nowrap`                    | `whitespace-nowrap`                    |
| `white-space: pre-wrap`                  | `whitespace-pre-wrap`                  |
| `overflow: hidden`                       | `overflow-hidden`                      |
| `text-overflow: ellipsis`                | `text-ellipsis`                        |
| `min-width: 0`                           | `min-w-0`                              |
| `border-radius: 8px`                     | `rounded-md` (= 8px via `--radius-md`) |
| `border-radius: 12px`                    | `rounded-[12px]`                       |
| `border-radius: 0 4px 4px 0`             | `rounded-r-[4px]`                      |
| `box-shadow: 0 1px 2px rgba(0,0,0,0.05)` | `shadow-sm`                            |

### 5. Map design tokens

Prefer semantic Tailwind vars — they auto-adapt to dark mode.

| antd-style token                              | Tailwind class                             | Notes                              |
| --------------------------------------------- | ------------------------------------------ | ---------------------------------- |
| `token.magicColorUsages.text[0]`              | `text-foreground`                          | primary text                       |
| `token.magicColorUsages.text[1]`              | `text-foreground/80`                       | slightly dimmed                    |
| `token.magicColorUsages.text[2]`              | `text-muted-foreground`                    | secondary text                     |
| `token.magicColorUsages.text[3]`              | `text-foreground/35`                       | disabled/placeholder               |
| `token.magicColorUsages.fill[0]`              | `bg-fill`                                  | hover fill (subtle)                |
| `token.magicColorUsages.fill[1]`              | `bg-fill-secondary`                        | active fill (stronger)             |
| `token.magicColorUsages.fill[2]`              | `bg-black/[0.13]` + `dark:bg-white/[0.13]` | deep active fill                   |
| `token.magicColorUsages.border`               | `border-border`                            |                                    |
| `token.magicColorUsages.bg[0..4]`             | `bg-background`                            | all white in light                 |
| `token.magicColorUsages.warning.default`      | `text-orange-500`                          | ⚠️ orange, not amber               |
| `token.magicColorUsages.warningLight.default` | `bg-orange-50`                             | ⚠️ orange-0                        |
| `token.magicColorUsages.danger.default`       | `text-destructive`                         | uses Tailwind semantic             |
| `token.magicColorUsages.dangerLight.default`  | `bg-destructive/10`                        | prefer slash opacity               |
| `token.magicColorUsages.primary.default`      | `text-primary`                             | brand blue                         |
| `token.magicColorUsages.primaryLight.default` | `bg-primary-10`                            | ⚠️ Use not `bg-primary/10`         |
| `token.magicColorUsages.success.default`      | `text-green-500`                           |                                    |
| `token.magicColorUsages.successLight.default` | `bg-green-50`                              |                                    |
| `token.magicColorUsages.info.default`         | `text-blue-500`                            |                                    |
| `token.magicColorUsages.infoLight.default`    | `bg-blue-50`                               |                                    |
| `token.magicColorUsages.tertiary.default`     | `text-muted-foreground`                    |                                    |
| `token.magicColorUsages.disabled.bg`          | `bg-gray-200` + `dark:bg-white/10`         |                                    |
| `token.magicColorUsages.disabled.text`        | `text-foreground/35`                       |                                    |
| `token.magicColorScales.grey[0]`              | `bg-muted` / `bg-gray-50`                  |                                    |
| `token.magicColorScales.grey[2]`              | `border-border` (preferred)                |                                    |
| `token.magicColorScales.grey[9]`              | `text-foreground`                          |                                    |
| `token.borderRadiusSM` (4px)                  | `rounded-[4px]`                            | use `[4px]` not `rounded-sm` (2px) |

**Project-specific opacity tokens** (from `src/index.css`):

- Primary light token keeps semantic suffix (`bg-primary-10`) due mixed light/dark opacity mapping
- Destructive opacity should use slash syntax (`bg-destructive/10`, `bg-destructive/20`)

| Avoid                          | Use                                                 | CSS variable                                                |
| ------------------------------ | --------------------------------------------------- | ----------------------------------------------------------- |
| `bg-primary/10`                | `bg-primary-10`                                     | `--custom-primary-10-dark-primary-20` (light 10%, dark 20%) |
| `bg-destructive-10`            | `bg-destructive/10`                                 | `--destructive` + opacity                                   |
| `bg-destructive-20`            | `bg-destructive/20`                                 | `--destructive` + opacity                                   |
| `border-gray-500/10` (outline) | `border-[var(--custom-outline-10-dark-outline-20)]` | `--custom-outline-10-dark-outline-20`                       |

### 6. Map hardcoded hex colors

| Hex                   | Tailwind equivalent                              |
| --------------------- | ------------------------------------------------ |
| `#171717`             | `text-foreground`                                |
| `#e5e5e5` (border)    | `border-border`                                  |
| `#9ca3af`             | `text-gray-400` / `border-gray-400`              |
| `#3b82f6`             | `text-blue-500`                                  |
| `#ebf2fe`             | `bg-[#ebf2fe]` + dark: `dark:bg-blue-500/10`     |
| `#f5f6f7`             | `bg-[#f5f6f7]` + dark: `dark:bg-white/10`        |
| `#f9f9f9`             | `bg-gray-50` + dark: `dark:bg-white/5`           |
| `#ffffff` (surface)   | `bg-white` + dark: `dark:bg-card`                |
| `rgba(46,47,56,0.09)` | `bg-black/[0.09]` + dark: `dark:bg-white/[0.09]` |

### 7. Pseudo-elements

`::after` / `::before` with decorative content:

```tsx
// Before (antd-style)
wrapper: css`
	position: relative;
	&::after {
		content: " ";
		position: absolute;
		left: 11px;
		top: 0;
		width: 1px;
		height: 100%;
		border-left: 1px dashed ${token.magicColorScales.grey[2]};
	}
`

// After (Tailwind)
;("relative after:content-[''] after:absolute after:left-[11px] after:top-0 after:w-px after:h-full after:border-l after:border-dashed after:border-border")
```

### 8. Child selectors

| CSS pattern                            | Tailwind arbitrary variant |
| -------------------------------------- | -------------------------- |
| `& p { margin-bottom: 0 }`             | `[&_p]:mb-0`               |
| `& p { color: X !important }`          | `[&_p]:!text-X`            |
| `& p { font-size: 12px !important }`   | `[&_p]:!text-xs`           |
| `& p { line-height: 16px !important }` | `[&_p]:!leading-4`         |
| `svg { color: X }`                     | `[&_svg]:text-X`           |

### 9. CSS animations

| antd-style keyframe           | Tailwind                                                                      |
| ----------------------------- | ----------------------------------------------------------------------------- |
| Custom `rotate(0 → 360)` spin | `animate-spin` (1s linear infinite)                                           |
| Custom fade-in / slide        | Check `tailwind.config.js` `animation` section for project-defined animations |

### 10. Replace antd layout components

antd layout primitives (`Flex`, `Space`, `Row`, `Col`) must be replaced with plain `<div>` + Tailwind.

#### `Flex` → `div`

| antd Flex prop            | Tailwind equivalent               |
| ------------------------- | --------------------------------- |
| `<Flex>`                  | `<div className="flex">`          |
| `<Flex vertical>`         | `<div className="flex flex-col">` |
| `gap={4}`                 | `gap-1`                           |
| `gap={6}`                 | `gap-1.5`                         |
| `gap={8}`                 | `gap-2`                           |
| `gap={10}`                | `gap-2.5`                         |
| `gap={12}`                | `gap-3`                           |
| `gap={16}`                | `gap-4`                           |
| `gap={20}`                | `gap-5`                           |
| `gap={24}`                | `gap-6`                           |
| `align="center"`          | `items-center`                    |
| `align="start"`           | `items-start`                     |
| `align="end"`             | `items-end`                       |
| `justify="center"`        | `justify-center`                  |
| `justify="space-between"` | `justify-between`                 |
| `justify="flex-end"`      | `justify-end`                     |
| `wrap` / `wrap="wrap"`    | `flex-wrap`                       |
| `flex={1}` (child)        | `flex-1` on the child             |

```diff
- import { Flex } from "antd"

- <Flex vertical gap={10}>
-   <span>…</span>
-   <Flex gap={8}>…</Flex>
- </Flex>

+ <div className="flex flex-col gap-2.5">
+   <span>…</span>
+   <div className="flex gap-2">…</div>
+ </div>
```

#### `Space` → `div`

```diff
- <Space size={8} direction="vertical">
+ <div className="flex flex-col gap-2">
```

### 10.5 Replace `MagicScrollBar` with shadcn `ScrollArea`

When migrating legacy list areas:

```diff
- import MagicScrollBar from "@/opensource/components/base/MagicScrollBar"
+ import { ScrollArea } from "@/opensource/components/shadcn-ui/scroll-area"
```

Map old SimpleBar content padding to `viewportClassName`:

```diff
- <MagicScrollBar className="h-full w-full [&_.simplebar-content]:px-2.5 [&_.simplebar-content]:pb-2.5">
+ <ScrollArea className="min-h-0 h-full w-full" viewportClassName="px-2.5 pb-2.5">
```

**Critical height-chain rule (flex layouts):**

- Every ancestor from panel body to `ScrollArea` must provide a calculable height
- Typical safe chain: `flex-1 min-h-0 overflow-hidden` on parent + `min-h-0 h-full` on `ScrollArea`
- Avoid wrapping `ScrollArea` with components that add an extra auto-height layer (for example spinner wrappers) unless that wrapper and its direct child are both `h-full`

If loading overlay breaks scrolling, prefer rendering loading as a branch:

```tsx
{
	loading ? (
		<div className="flex h-full w-full items-center justify-center">{/* spinner */}</div>
	) : (
		<ScrollArea className="min-h-0 h-full w-full" viewportClassName="px-2.5 pb-2.5">
			{/* list */}
		</ScrollArea>
	)
}
```

Keep existing `data-testid` values on list / loading / empty nodes when replacing containers.

### 11. Replace antd Button with shadcn Button

**When migrating a component that uses antd `Button`, replace it with shadcn Button** from
`@/opensource/components/shadcn-ui`.

#### Import change

```diff
- import { Button } from "antd"
+ import { Button } from "@/opensource/components/shadcn-ui"
```

#### antd → shadcn mapping

| antd Button       | shadcn Button                                                           |
| ----------------- | ----------------------------------------------------------------------- |
| `type="primary"`  | `variant="default"` (or omit, default)                                  |
| `type="default"`  | `variant="outline"` or `variant="secondary"`                            |
| `type="text"`     | `variant="ghost"`                                                       |
| `type="link"`     | `variant="link"`                                                        |
| `danger`          | `variant="destructive"`                                                 |
| `size="large"`    | `size="lg"`                                                             |
| `size="small"`    | `size="sm"`                                                             |
| `icon={<Icon />}` | Put icon as child: `<Button><Icon /> Text</Button>`                     |
| `loading`         | Use `disabled` + loading spinner as child, or a loading state component |

#### Example migration

```diff
- import { Button } from "antd"
- import { IconDownload } from "@tabler/icons-react"
+ import { Button } from "@/opensource/components/shadcn-ui"
+ import { IconDownload } from "@tabler/icons-react"  // or lucide-react

- <Button type="primary" icon={<IconDownload size={20} />} onClick={handleDownload}>
-   {t("detail.downloadFile")}
- </Button>
+ <Button onClick={handleDownload} size="sm">
+   <IconDownload className="size-5" />
+   {t("detail.downloadFile")}
+ </Button>
```

shadcn Button has built-in `[&_svg]:size-4`; use `className="size-5"` on the icon for 20px.
Remove any `className` overrides that were needed for antd — shadcn Button uses Tailwind and
supports `className` for minor tweaks only.

### 11.5 Replace antd Input with shadcn Input

When migrating a component that uses antd `Input`, replace it with shadcn Input from
`@/opensource/components/shadcn-ui/input`.

#### Import change

```diff
- import { Input } from "antd"
+ import { Input } from "@/opensource/components/shadcn-ui/input"
```

#### Prefix icon migration

Antd `prefix` prop is not used in shadcn Input. Wrap Input with a relative container and render
the icon absolutely:

```tsx
<div className="relative w-full">
	<IconSearch
		size={16}
		className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
	/>
	<Input
		value={searchText}
		onChange={(event) => setSearchText(event.target.value)}
		className="pl-9"
		placeholder={t("mcp.panel.searchPlaceholder")}
	/>
</div>
```

#### Notes

- Keep `data-testid` unchanged during migration
- Preserve placeholder and controlled value logic
- Use fixed width wrapper only when desktop layout needs it (for example `w-[240px]`)

### 12. Antd component overrides (non-Button)

When applying Tailwind to **other** antd components (`Dropdown`, `Modal`, etc.), antd's CSS
specificity requires `!important` for most visual properties. Layout utilities like `flex-none`
do NOT need `!` since they're additive.

**Workspace rule (critical):** for internal antd class overrides, use `.magic-*` prefix,
not `.ant-*`.

- ✅ `"[&_.magic-alert]:text-xs"`
- ❌ `"[&_.ant-alert]:text-xs"`

```tsx
// Dropdown overlayClassName targeting internal antd classes
overlayClassName="[&_.magic-dropdown-menu]:!p-[6px] [&_.magic-dropdown-menu]:flex
  [&_.magic-dropdown-menu]:flex-col [&_.magic-dropdown-menu]:gap-1
  [&_.magic-dropdown-menu-item]:!p-0"
```

**Rule of thumb for `!`:** Does antd set this property by default? If yes → `!`. If it's purely
additive (flex-none, mt-2.5, self-end) → no `!` needed.

### 13. Interactive states (hover / active / focus / disabled)

Always add all four states when styling interactive elements. Missing any state causes visible
regressions (e.g., a button that darkens on hover but ignores keyboard focus).

#### State token mapping

| State               | Token equivalent | Tailwind class                                                            | Notes                       |
| ------------------- | ---------------- | ------------------------------------------------------------------------- | --------------------------- |
| hover bg            | `fill[0]`        | `hover:bg-fill`                                                           | semantic, auto dark-mode    |
| hover bg (stronger) | `fill[1]`        | `hover:bg-fill-secondary`                                                 | for already-filled surfaces |
| active bg           | `fill[1]`        | `active:bg-fill-secondary`                                                | slightly darker than hover  |
| hover text          | `text[0]`        | `hover:text-foreground`                                                   | keeps text readable         |
| focus ring          | `ring` CSS var   | `focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring` | keyboard only               |
| disabled            | —                | `disabled:pointer-events-none disabled:opacity-50`                        | always include              |

#### Ghost button (bg-background + border)

```tsx
// Canonical ghost button pattern — always use cn()
const ghostButton = cn(
	"inline-flex items-center cursor-pointer rounded-lg",
	"bg-background text-foreground border border-border",
	"hover:bg-fill hover:text-foreground",
	"active:bg-fill-secondary",
	"focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
	"disabled:pointer-events-none disabled:opacity-50",
)
```

#### Filled button (bg-primary)

```tsx
const primaryButton = cn(
	"bg-primary text-primary-foreground",
	"hover:bg-primary/90",
	"active:bg-primary/80",
	"focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
	"disabled:pointer-events-none disabled:opacity-50",
)
```

#### Filled muted button (bg-muted / bg-fill)

```tsx
const mutedButton = cn(
	"bg-fill text-foreground",
	"hover:bg-fill-secondary hover:text-foreground",
	"active:bg-black/[0.13] dark:active:bg-white/[0.13]",
	"focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
	"disabled:pointer-events-none disabled:opacity-50",
)
```

#### Shared const pattern (for custom div buttons)

When building custom button-like elements (not shadcn Button), extract to a module-level const:

```tsx
// Outside component — for div/span that acts as button
const actionButtonBase = cn(
  "inline-flex h-6 items-center gap-1 px-2.5 py-1",
  "cursor-pointer rounded-lg text-xs leading-4",
  "bg-background text-foreground border border-border",
  "hover:bg-fill hover:text-foreground",
  "active:bg-fill-secondary",
  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
  "disabled:pointer-events-none disabled:opacity-50",
)

// For shadcn Button — use variant/size props, className for minor tweaks only
<Button variant={isActive ? "default" : "outline"} size="sm">
```

## Dark Mode Patterns

Add `dark:` variants for all hardcoded light-specific colors.

| Light                    | Dark                          | Use case                       |
| ------------------------ | ----------------------------- | ------------------------------ |
| `bg-white`               | `dark:bg-card`                | surface / card bg              |
| `bg-orange-50`           | `dark:bg-orange-500/20`       | warning/warningLight bg        |
| `text-orange-500`        | `dark:text-orange-400`        | warning text                   |
| `[&_p]:!text-orange-500` | `dark:[&_p]:!text-orange-400` | warning p override             |
| `bg-green-50`            | `dark:bg-green-500/20`        | success bg                     |
| `text-green-500`         | `dark:text-green-400`         | success text                   |
| `bg-blue-50`             | `dark:bg-blue-500/20`         | info/secondary bg              |
| `text-blue-500`          | `dark:text-blue-400`          | info/secondary text            |
| `bg-[#ebf2fe]`           | `dark:bg-blue-500/10`         | finished badge bg (hardcoded)  |
| `bg-[#f5f6f7]`           | `dark:bg-white/10`            | suspended badge bg (hardcoded) |
| `text-gray-400`          | `dark:text-gray-500`          | muted icon/label               |
| `bg-gray-50`             | `dark:bg-white/5`             | subtle list item bg            |
| `!bg-white`              | `dark:!bg-card`               | antd button/surface bg         |
| `bg-black/[0.09]`        | `dark:bg-white/[0.09]`        | fill[1] dark overlay           |
| `bg-black/[0.13]`        | `dark:bg-white/[0.13]`        | fill[2] darker overlay         |

Semantic Tailwind variables (`bg-background`, `border-border`, `text-foreground`, `bg-muted`,
`bg-fill`, `bg-fill-secondary`) are **already dark-mode aware** — no `dark:` prefix needed.

### Dark Mode Verification Checklist

After migration, **verify dark mode styles are complete**:

1. **Scan for hardcoded light colors without `dark:`**
    - `bg-white`, `bg-gray-50`, `bg-orange-50`, `bg-green-50`, `bg-blue-50`, `bg-amber-50`
    - `text-gray-400`, `text-gray-500`, `text-orange-500`, `text-green-500`, `text-blue-500`
    - `bg-[#...]`, `text-[#...]` (hex values)
    - `border-gray-200`, `border-gray-300`
    - Each of these **must** have a matching `dark:` variant.

2. **Verify semantic tokens**
    - Prefer `bg-background`, `text-foreground`, `border-border`, `bg-muted`, `bg-fill` — these auto-adapt.
    - If using fixed colors (e.g. `bg-white`), always pair with `dark:bg-card` or equivalent.

3. **Interactive elements**
    - `hover:`, `active:` states using light-only colors need `dark:` variants.
    - Example: `hover:bg-gray-100` → add `dark:hover:bg-white/10`.

4. **Manual verification**
    - Toggle dark mode in the app and visually inspect the migrated component.
    - Check: backgrounds, text contrast, borders, shadows, focus rings.
    - Ensure no "invisible" text or low-contrast elements in dark mode.

5. **Search pattern for audit**
    ```bash
    # Find light-only color classes — verify each has a dark: variant in same className
    rg "bg-(white|gray-50|orange-50|green-50|blue-50|amber-50)" --type tsx path/to/component
    rg "text-(gray-[34]00|orange-500|green-500|blue-500)" --type tsx path/to/component
    ```

## React patterns to fix during migration

### Prefer proper types over eslint-disable / `as any`

**When passing props to child components**, fix type errors by using proper interfaces instead of
`as any` or `eslint-disable-next-line @typescript-eslint/no-explicit-any`.

1. **Export the child's props interface** from the child component:

    ```diff
    - interface PlaybackTabContentProps {
    + export interface PlaybackTabContentProps {
    ```

2. **Use that interface as the parent's prop type**:

    ```diff
    - playbackProps?: Record<string, unknown>
    + playbackProps?: PlaybackTabContentProps
    ```

3. **Remove type assertions** — spread directly without `as any`:

    ```diff
    - <PlaybackTabContent {...(playbackProps as any)} />
    + <PlaybackTabContent {...playbackProps} />
    ```

4. **Simplify property access** — no cast needed:
    ```diff
    - (playbackProps as Record<string, unknown>)?.isFullscreen === true
    + playbackProps?.isFullscreen === true
    ```

Reserve `eslint-disable` only for cases where proper typing is impractical (e.g. MobX store data
with loose typing in `.map()` callbacks). Prefer exporting interfaces and typing props correctly.

### Object initializer in deps causes stale closure warnings

The pattern `const x = thing || {}` creates a new object reference every render, causing
ESLint to warn about unstable `useCallback`/`useMemo` deps. Wrap it in `useMemo`:

```diff
- const fileData = tool?.detail?.data || {}
+ const fileData = useMemo(() => tool?.detail?.data || {}, [tool?.detail?.data])
```

### `@ts-ignore` vs `@ts-expect-error`

- `@ts-ignore` — suppresses the error silently; **ESLint bans it**.
- `@ts-expect-error` — requires a real error to exist; **errors if the line is clean**.

Migration rule:

1. Replace `// @ts-ignore` with `// @ts-expect-error` and add a brief reason.
2. Run lint. If you get "Unused '@ts-expect-error' directive" → the line is already clean, just
   **delete** the comment entirely.

```diff
- // @ts-ignore
+ // @ts-expect-error - result type does not expose data.file_id
  const fileId = result?.data?.file_id || result?.currentFileId
```

### `any` on JSX `.map()` callbacks over store data (last resort)

When iterating over data from a MobX/Zustand store with loose typing, **first try** to add proper
types (e.g. define `StoreItem` interface, use `as StoreItem` where the parent builds the data).
Use `eslint-disable` only when proper typing is impractical (e.g. store shape is dynamic or
external).

```tsx
{
	/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
}
{
	items?.map((item: any) => (
		<Child data={item.attrs as ExpectedType} key={getUniqueId(item.attrs as ExpectedType)} />
	))
}
```

> ⚠️ The `eslint-disable-next-line` comment must be on the line **immediately before** the
> `{items?.map(` expression — not before the wrapping `{condition && (` wrapper.

## Shared base class pattern

When multiple elements share the same base styles, extract into a `const` outside the component:

```tsx
// Before (in createStyles)
box: css`border-radius: 12px; display: inline-flex; padding: 4px 8px; ...`

// After (module-level const)
const boxBase = "rounded-[12px] inline-flex px-2 py-1 items-center text-xs gap-1 [&_p]:mb-0"

// Usage
<span className={cn(boxBase, "bg-amber-50 text-amber-500 dark:bg-amber-500/10 dark:text-amber-400")}>
```

## Checklist before finishing

- [ ] All `styles.xxx` references replaced with Tailwind classes
- [ ] `useXxxStyles` import and call removed from component
- [ ] `createStyles` export removed from `styles.ts` (if no other consumers)
- [ ] `keyframes` import removed from `styles.ts` if unused
- [ ] `styles.ts` file deleted after confirming no other imports
- [ ] `cn()` imported from `@/opensource/lib/utils`
- [ ] No className `+` concatenation; use `cn(...)` instead
- [ ] **antd Button** replaced with shadcn `Button` from `@/opensource/components/shadcn-ui`
- [ ] **antd Input** replaced with shadcn `Input` from `@/opensource/components/shadcn-ui/input`
- [ ] If `MagicScrollBar` was replaced, `ScrollArea` uses `viewportClassName` and height-chain (`min-h-0` + `h/full`) is verified
- [ ] **Dark mode verification**: All hardcoded light colors have `dark:` variants; prefer semantic tokens (`bg-background`, `text-foreground`, etc.); manually verify in dark mode
- [ ] antd layout components (`Flex`, `Space`, `Row`, `Col`) replaced with `div` + Tailwind
- [ ] Unused antd imports removed after replacement
- [ ] Interactive elements have **all four states**: `hover:` / `active:` / `focus-visible:` / `disabled:`
- [ ] Repeated button/link classes extracted to a module-level `const` (DRY)
- [ ] `token.borderRadiusSM` translated to `rounded-[4px]`, not `rounded-sm`
- [ ] Object initializers used as hook deps wrapped in `useMemo`
- [ ] `@ts-ignore` replaced with `@ts-expect-error` + reason, or deleted if no error exists
- [ ] **Type safety**: Props passed to children use proper interfaces (export from child, use in parent); avoid `as any` and `eslint-disable` for type errors
- [ ] `any` in JSX map callbacks used only as last resort; prefer proper types when feasible
- [ ] `!` prefix on antd overrides applied correctly (visual props only, not layout utilities)
- [ ] Antd override selectors use `.magic-*` class prefix, not `.ant-*`
- [ ] Lints pass (`pnpm lint`)

## Additional resources

- Color mapping details: [color-mapping.md](color-mapping.md)
