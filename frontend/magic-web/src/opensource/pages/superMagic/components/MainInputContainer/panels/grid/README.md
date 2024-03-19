# Grid Panel Components

This directory contains components for the template grid panel in SuperMagic.

## Components

### TemplateGroupSelector

A horizontal scrollable selector for template groups with the following features:

- **Horizontal scrolling**: Smooth scroll navigation with mouse/touch
- **Navigation arrows**: Left/right arrows appear when content overflows
- **Gradient masks**: Visual fade effect on scroll boundaries
- **Active state**: Highlights the currently selected group
- **Icon support**: Displays group-specific icons using Lucide React

**Usage:**

```tsx
<TemplateGroupSelector
	groups={config.template_groups}
	selectedGroupKey={currentGroupKey}
	onGroupChange={setCurrentGroupKey}
/>
```

### GroupIcon

Dynamically renders Lucide React icons by component name. Simply pass the PascalCase icon name from lucide-react.

**Supported icons (examples):**

- `LayoutTemplate` - Landing pages
- `LayoutDashboard` - Dashboards
- `Image` - Portfolio sites
- `Hotel` - Corporate sites
- `SquareUserRound` - Personal sites
- `FileType` - Blog sites
- `Gamepad2` - Gaming
- `PencilRuler` - Productivity tools

Any valid lucide-react icon name can be used. Fallback to `LayoutTemplate` if icon not found.

### GridPanel

Main container component that combines:

- FilterBar for template filtering
- TemplateGroupSelector for group navigation
- TemplateGrid for displaying templates

## Styling

All components use:

- **shadcn/ui** components (Button, Collapsible)
- **Tailwind CSS** utility classes
- **Lucide React** icons (16px size)
- Design tokens from Figma specs

## Implementation Details

- Scroll position detection for showing/hiding navigation arrows
- Auto-hiding scrollbar with `.no-scrollbar` utility class
- Smooth scroll animation (200px per click)
- Responsive gradient masks (60px width)
- Selected state with outline variant and white background
