# RecordingPanel Component

## Overview

RecordingPanel is a voice recording panel component with text editing functionality. It supports two modes:
- **Recording Mode**: Shows audio waveform and recording controls
- **Edit Mode**: Allows editing of transcribed text with send options

## Architecture

This component follows the component code separation principles:

### File Structure

```
RecordingPanel/
├── index.tsx              # Main component (JSX and composition logic only)
├── types.ts              # TypeScript type definitions
├── styles.ts             # Style definitions with antd-style
├── hooks/                # Custom hooks
│   ├── index.ts          # Hooks exports
│   └── useRecordingPanel.ts # Main component logic hook
└── README.md            # This documentation
```

### Separation of Concerns

1. **Component Logic** (`index.tsx`):
   - Only contains JSX rendering and basic composition
   - No business logic or styling
   - Uses hooks for state management

2. **Styling** (`styles.ts`):
   - All CSS-in-JS styles using antd-style
   - Animation definitions
   - Style utility functions
   - Theme token integration

3. **Types** (`types.ts`):
   - TypeScript interface definitions
   - Component props interfaces
   - Internal type definitions

4. **Business Logic** (`hooks/useRecordingPanel.ts`):
   - State management
   - Side effects (useEffect)
   - Event handlers
   - Focus management

## Key Features

- **Dual Mode Interface**: Recording mode and text editing mode
- **Animated Transitions**: Smooth animations between states
- **Touch Gesture Support**: Handles touch events for mobile interaction
- **Text Auto-resize**: Textarea automatically adjusts height
- **Background Scroll Prevention**: Prevents scrolling when active
- **Accessibility**: Proper focus management and keyboard support

## Props

See `types.ts` for detailed prop interface definitions.

## Usage

```tsx
import RecordingPanel from './components/RecordingPanel'

<RecordingPanel
  recordingState={recordingState}
  waveformData={waveformData}
  onClose={handleClose}
  onCancel={handleCancel}
  onSendText={handleSendText}
  onSendVoice={handleSendVoice}
  onEditText={handleEditText}
  touchHandlers={touchHandlers}
/>
```

## Development Notes

- Component uses memo for performance optimization
- Follows React functional component patterns
- Uses modern React hooks for state management
- Implements proper cleanup in useEffect
- All animations use CSS-in-JS with consistent timing functions 