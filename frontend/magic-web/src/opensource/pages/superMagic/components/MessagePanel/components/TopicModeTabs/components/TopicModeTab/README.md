# TopicModeTab Component

Multi-platform topic mode tab component with desktop and mobile variants.

## Structure

```
TopicModeTab/
├── index.tsx                 # Entry point - platform detection and routing
├── TopicModeTab.desktop.tsx  # Desktop version (vertical layout)
├── TopicModeTab.mobile.tsx   # Mobile version (horizontal pill layout)
└── README.md                 # This file
```

## Usage

```tsx
import TopicModeTab from "./components/TopicModeTab"
;<TopicModeTab
	tab={modeItem}
	isActive={activeMode === tab.mode.identifier}
	onModeChange={handleModeChange}
/>
```

## Platform Detection

The component automatically detects the platform using `isMobile` from `@/opensource/utils/devices`:

- **Desktop**: Renders vertical layout with icon, title, and active indicator
- **Mobile**: Renders horizontal pill-shaped button based on Figma design

## Desktop Version (`TopicModeTab.desktop.tsx`)

### Features

- Vertical layout (icon stacked above title)
- 28px icon size with 50x50px container
- Icon background with dynamic color
- Title with tooltip (max 90px width, 2 lines)
- Bottom active indicator (6px wide, 4px tall)

### Layout

```
┌──────────┐
│   Icon   │  50x50px container
│   + BG   │
├──────────┤
│  Title   │  Text with tooltip
├──────────┤
│    ━━    │  Active indicator
└──────────┘
```

## Mobile Version (`TopicModeTab.mobile.tsx`)

### Features

- Horizontal pill-shaped layout
- 20px icon size with 24x24px container
- Rounded-full border with conditional styling
- Active state: blue border + blue background
- Inactive state: default border + transparent background

### Layout

```
┌──────────────────────┐
│ [Icon] Title Text    │  Pill-shaped button
└──────────────────────┘
```

### States

- **Active**: `border-blue-500 bg-blue-500/10` (light mode)
- **Inactive**: `border-border bg-transparent`

## Props

```ts
interface TopicModeTabProps {
	tab: ModeItem // Mode configuration object
	isActive: boolean // Whether this tab is currently active
	onModeChange: (topicMode: TopicMode) => void // Callback when tab is clicked
}
```

## Design Reference

Mobile design based on Figma:
https://www.figma.com/design/6Y4cUmZyEJnas4qKtbcJ5Y/Magic---SuperMagic-Shadcn?node-id=969-34028

## Styling

- **Desktop**: Tailwind CSS with custom spacing and layout utilities
- **Mobile**: Follows Figma design with blue-500 accent colors
- Both versions support dark mode through Tailwind's dark: prefix

## Performance

- Both components are wrapped with `React.memo` at the entry point
- Icon rendering is optimized based on icon type (image vs. SVG)
- Background color calculation is memoized within render functions
