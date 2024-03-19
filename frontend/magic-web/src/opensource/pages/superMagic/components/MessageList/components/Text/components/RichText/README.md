# RichText Component

A ProseMirror-based React component for rendering rich text content with support for mentions, based on the reference implementation in `chatNew`.

## Features

- **ProseMirror Rendering**: Uses ProseMirror for robust content rendering
- **JSONContent Support**: Renders TipTap's JSONContent format
- **Mention Support**: Interactive mentions with icons, labels, and click handling  
- **Read-Only Display**: Optimized for message display (non-editable)
- **Error Handling**: Graceful fallback for malformed content
- **Performance**: Memoized rendering with proper comparison
- **Styling**: Uses antd-style matching MessageEditor

## Architecture

Based on the proven architecture from `src/opensource/pages/chatNew/components/ChatMessageList/components/MessageFactory/components/RichText`:

- **ProseMirror Schema**: Custom schema for mentions and rich content
- **Content Transformation**: Utilities for processing JSONContent
- **Read-Only EditorView**: Non-editable ProseMirror view for display
- **Event Handling**: Click handlers for interactive elements

## Usage

```tsx
import RichText from './RichText'
import type { MentionNode } from './RichText'

// Content with mentions
const richContent = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Check out " },
        {
          type: "mention",
          attrs: {
            id: "file-123",
            label: "README.md",
            type: "project_file", 
            icon: "📄",
            description: "Project documentation"
          }
        },
        { type: "text", text: " for more info." }
      ]
    }
  ]
}

// Handle mention clicks
const handleMentionClick = (mention: MentionNode) => {
  console.log('Clicked mention:', mention.attrs)
  // Navigate to file, show details, etc.
}

export default function Example() {
  return (
    <div>
      {/* Basic usage */}
      <RichText content={richContent} />
      
      {/* With mention handling */}
      <RichText 
        content={richContent}
        onMentionClick={handleMentionClick}
      />
      
      {/* String content (JSON) */}
      <RichText content={JSON.stringify(richContent)} />
      
      {/* Plain text fallback */}
      <RichText content="Plain text content" />
    </div>
  )
}
```

## Props

| Property | Type | Description |
|----------|------|-------------|
| `content` | `JSONContent \| string \| Record<string, unknown>` | Content to render |
| `className` | `string` | Additional CSS class |
| `style` | `React.CSSProperties` | Inline styles |
| `onMentionClick` | `(mention: MentionNode) => void` | Mention click handler |

## ProseMirror Schema

### Supported Node Types

- **doc**: Root document container
- **paragraph**: Text paragraph blocks
- **text**: Plain text content
- **mention**: Interactive mention elements
- **hardBreak**: Line breaks (br tags)

### Mention Schema

```typescript
mention: {
  inline: true,
  group: "inline",
  attrs: {
    type: { default: "user" },
    id: { default: "" },
    label: { default: "" },
    description: { default: "" },
    icon: { default: "" },
    metadata: { default: null }
  }
}
```

## Content Processing

The component includes utilities for:

- **JSON Parsing**: Safe parsing of stringified content
- **Content Transformation**: Processing mention attributes
- **Schema Validation**: Ensuring content matches ProseMirror schema
- **Error Recovery**: Fallback for invalid content

## Styling

Uses antd-style with ProseMirror-compatible CSS:

```css
.container {
  /* ProseMirror container */
}

.mention .magic-mention {
  /* Mention styling matching MessageEditor */
  color: var(--primary-color);
  background: var(--primary-bg);
  padding: 1px 4px;
  border-radius: 4px;
}
```

## Performance

- **Memoized Component**: Re-renders only when content changes
- **Efficient Comparison**: Custom comparison function for props
- **Lazy Initialization**: ProseMirror view created only when needed
- **Cleanup**: Proper disposal of ProseMirror instances

## Integration

Designed to integrate with:

- **MessageEditor**: Compatible content format
- **MessageList**: Drop-in replacement for text rendering
- **MentionPanel**: Shared mention data structures
- **SuperMagic Architecture**: Follows project patterns

## Files Structure

```
RichText/
├── index.tsx          # Main ProseMirror-based component
├── types.ts           # TypeScript interfaces
├── styles.ts          # antd-style styling
├── schemaConfig.ts    # ProseMirror schema definition
├── utils.ts           # Content processing utilities
└── README.md          # This documentation
```