# AgentInputContainer

A comprehensive input container component for SuperMagic agent interactions, featuring promotional banners, welcome messages, chat input, plugin integration, and quick action buttons.

## Features

- **Promotional Banner**: Eye-catching banner for upgrade prompts
- **Welcome Message**: Personalized greeting for users
- **Chat Input**: Full-featured input area with:
    - @ mention support
    - Model selector with visual indicators
    - Internet search toggle
    - Plugin management
    - File upload
    - Voice input
    - Send button
- **Plugin Tips**: Quick access to tool integrations
- **Quick Actions**: Pre-configured shortcuts for common tasks

## Usage

```tsx
import AgentInputContainer from "@/opensource/pages/superMagic/components/AgentInputContainer"

function YourComponent() {
	return (
		<AgentInputContainer
			mode="default"
			username="John Doe"
			onQuickAction={(label) => console.log("Quick action:", label)}
		/>
	)
}
```

## Props

### AgentInputContainerProps

| Prop            | Type                      | Default      | Description                           |
| --------------- | ------------------------- | ------------ | ------------------------------------- |
| `mode`          | `"default"`               | `"default"`  | Display mode of the container         |
| `className`     | `string`                  | -            | Additional CSS classes                |
| `username`      | `string`                  | `"username"` | User's name for welcome message       |
| `onQuickAction` | `(label: string) => void` | -            | Callback when quick action is clicked |

## Component Structure

```
AgentInputContainer/
├── index.tsx                 # Main container component
├── types.ts                  # TypeScript type definitions
├── constants.ts              # Configuration constants
├── README.md                 # This file
└── modes/
    └── Default/
        ├── index.tsx         # Default mode implementation
        └── components/
            ├── PromotionalBanner.tsx  # Upgrade banner
            ├── WelcomeMessage.tsx     # Greeting section
            ├── ChatInput.tsx          # Main input area
            ├── PluginTips.tsx         # Tool connection prompt
            └── QuickActions.tsx       # Action shortcuts
```

## Styling

This component uses:

- **Tailwind CSS** for utility-first styling
- **shadcn/ui** components (Button, Separator)
- **lucide-react** icons (16px size for consistency)

All colors use CSS variables from the design system for theme compatibility.

## Customization

### Adding New Quick Actions

Edit `constants.ts`:

```ts
export const QUICK_ACTIONS = [
	{ icon: YourIcon, label: "Your Action" },
	// ... more actions
]
```

### Adding New Modes

1. Create a new mode directory: `modes/YourMode/`
2. Implement the mode component
3. Add the mode to the switch statement in `index.tsx`

## Design System Compliance

- Uses 16px icons (`size-4` = 1rem) for visual consistency
- Follows shadcn/ui button variants (default, outline, secondary)
- Respects spacing tokens (gap-2, gap-3, p-2, etc.)
- Uses semantic color tokens (foreground, background, border, etc.)

## Accessibility

- Buttons have proper labels
- Icon-only buttons include appropriate `title` attributes
- Keyboard navigation supported
- ARIA attributes where applicable

## Related Components

- `MessageEditor`: Full-featured message editor with TipTap
- `MentionPanel`: @ mention functionality
- `ModelSwitch`: Model selection component
