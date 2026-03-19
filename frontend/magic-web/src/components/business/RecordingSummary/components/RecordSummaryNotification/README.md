# RecordSummaryNotification Component

A beautiful notification component for recording summary completion, based on Antd's notification API with custom styling that matches the Figma design. This component follows Ant Design's recommended hooks pattern with Context Provider.

## Features

- 🎨 Perfect match with Figma design specifications
- 🔗 Uses Ant Design's recommended hooks pattern
- 📦 Context-based API for proper ConfigProvider support
- 🎯 Stack notifications with configurable threshold
- 🎭 Subtle, natural animations (no flashy effects)
- 🎯 Customizable content and callbacks
- 🔧 Built with antd-style for consistent theming
- ♿ Accessible with proper focus handling

## Architecture

This component is modular and follows best practices:

- **RecordSummaryNotificationProvider**: Context provider using `notification.useNotification`
- **useRecordSummaryNotification**: Custom hook to access notification API
- **RecordSummaryNotificationContent**: Styled notification content component
- **Types**: Complete TypeScript type definitions
- **Styles**: Separate antd-style definitions

## Usage

### 1. Setup Provider (Required)

First, wrap your app or component tree with the provider:

```tsx
import { RecordSummaryNotificationProvider } from '@/opensource/components/business/RecordingSummary/components/RecordSummaryNotification'

function App() {
  return (
    <RecordSummaryNotificationProvider>
      {/* Your app components */}
      <YourMainComponent />
    </RecordSummaryNotificationProvider>
  )
}
```

### 2. Use the Hook

Then use the hook in any child component:

```tsx
import { useRecordSummaryNotification } from '@/opensource/components/business/RecordingSummary/components/RecordSummaryNotification'

function YourComponent() {
  const { showRecordSummaryNotification } = useRecordSummaryNotification()

  const handleShowNotification = () => {
    showRecordSummaryNotification({
      title: "录音总结完成",
      description: "您的会议录音已成功转录并生成总结",
      onViewClick: () => {
        console.log("View clicked!")
        // Navigate to summary page
      },
    })
  }

  return <button onClick={handleShowNotification}>Show Notification</button>
}
```

### Advanced Usage

```tsx
import { useRecordSummaryNotification } from '@/opensource/components/business/RecordingSummary/components/RecordSummaryNotification'

function RecordingComponent() {
  const { showRecordSummaryNotification } = useRecordSummaryNotification()

  const handleSummaryComplete = (summaryId: string) => {
    showRecordSummaryNotification({
      title: "录音总结已完成",
      description: "点击查看详细的会议总结和关键要点",
      onViewClick: () => {
        // Navigate to specific summary
        window.open(`/summary/${summaryId}`, '_blank')
      },
      duration: 10000, // Auto-close after 10 seconds
      key: `summary-${summaryId}`, // Unique key
    })
  }

  return (
    // Your recording UI
    <div>Recording in progress...</div>
  )
}
```

## API Reference

### RecordSummaryNotificationProvider

Provider component that must wrap your component tree.

| Prop | Type | Description |
|------|------|-------------|
| children | ReactNode | Child components |

### useRecordSummaryNotification

Hook that returns the notification API.

**Returns:** `{ showRecordSummaryNotification }`

### showRecordSummaryNotification(options)

Function to show the notification.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| title | string | Yes | - | Notification title |
| description | string | Yes | - | Notification description |
| onViewClick | () => void | No | - | Callback when "查看录音总结" button is clicked |
| duration | number \| null | No | 0 | Auto-close duration in milliseconds. Set to 0 or null to disable |
| key | string | No | "record-summary-finish" | Unique key for notification management |

## Styling

The component uses:

- **antd-style** for CSS-in-JS styling
- **Design tokens** from antd theme
- **Consistent spacing** and typography
- **Hover/focus states** with smooth transitions
- **Stack support** with threshold management

## Integration Examples

### With React Router

```tsx
import { useNavigate } from 'react-router-dom'
import { useRecordSummaryNotification } from '@/opensource/components/business/RecordingSummary/components/RecordSummaryNotification'

function useRecordingCompletion() {
  const navigate = useNavigate()
  const { showRecordSummaryNotification } = useRecordSummaryNotification()
  
  const handleSummaryComplete = (summaryId: string) => {
    showRecordSummaryNotification({
      title: "录音总结完成",
      description: "AI已完成分析，快来查看精彩内容！",
      onViewClick: () => navigate(`/recording-summary/${summaryId}`)
    })
  }
  
  return { handleSummaryComplete }
}
```

### With Service Integration

```tsx
import { useEffect } from 'react'
import { useRecordSummaryNotification } from '@/opensource/components/business/RecordingSummary/components/RecordSummaryNotification'
import { recordSummaryStore } from '@/opensource/stores/recordingSummary'

function RecordingPage() {
  const { showRecordSummaryNotification } = useRecordSummaryNotification()
  
  useEffect(() => {
    const handleComplete = (summary: any) => {
      showRecordSummaryNotification({
        title: "录音总结完成",
        description: `共识别 ${summary.wordCount} 字，生成 ${summary.keyPoints.length} 个要点`,
        onViewClick: () => {
          // Open summary in new tab or navigate
          window.open(summary.shareUrl, '_blank')
        }
      })
    }
    
    recordSummaryStore.on('summaryComplete', handleComplete)
    return () => recordSummaryStore.off('summaryComplete', handleComplete)
  }, [showRecordSummaryNotification])
  
  return <div>Your recording UI</div>
}
```

## Backward Compatibility

For easier migration, the component also exports aliases with the old names:

```tsx
// These are equivalent to the new names
import {
  FinishNotificationProvider,        // alias for RecordSummaryNotificationProvider
  useFinishNotification,             // alias for useRecordSummaryNotification
  FinishNotificationContent,         // alias for RecordSummaryNotificationContent
} from '@/opensource/components/business/RecordingSummary/components/RecordSummaryNotification'
```

## Migration Guide

If you're migrating from the old static function approach:

### Before (Static Function - Deprecated)
```tsx
import { showFinishNotification } from './legacy'

// This will show a deprecation warning
showFinishNotification({
  title: "完成",
  description: "录音总结完成"
})
```

### After (Context-based - Recommended)
```tsx
// 1. Add provider to your app root
<RecordSummaryNotificationProvider>
  <App />
</RecordSummaryNotificationProvider>

// 2. Use hook in components
const { showRecordSummaryNotification } = useRecordSummaryNotification()
showRecordSummaryNotification({
  title: "完成",
  description: "录音总结完成"
})
```

## Design System Compliance

This component follows the project's design system:

- ✅ Uses antd-style for styling
- ✅ Follows design tokens
- ✅ Implements natural animations (no flashy effects)
- ✅ Supports theme switching
- ✅ Mobile responsive design
- ✅ Accessibility compliant
- ✅ Stack notifications support
