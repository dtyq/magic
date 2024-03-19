# Tool Component

A React component for displaying different types of tools with appropriate visual treatments.

## Architecture

```
Tool/
├── index.tsx                 # Main component
├── types.ts                  # Type definitions
├── styles.ts                 # Legacy styles (to be removed)
├── components/
│   ├── ToolIcon/            # Icon component
│   ├── ToolCard/            # Shared base card component
│   │   ├── index.tsx
│   │   └── styles.ts
│   ├── ToolContainer/       # Shared container component
│   │   ├── index.tsx
│   │   └── styles.ts
│   ├── ToolDetail/          # Tool detail components
│   │   ├── TextEditor/      # Text editor for file operations
│   │   │   ├── index.tsx
│   │   │   └── styles.ts
│   │   └── index.ts         # Exports
│   └── Tools/               # Tool-specific renderers
│       ├── StandardTool/    # Standard tools (only ToolCard)
│       ├── ThinkingTool/    # Thinking tools (ToolContainer + ToolCard + content)
│       ├── FileOperationTool/ # File operations (ToolContainer + ToolCard + TextEditor)
│       ├── WebSearchTool/   # Web search (ToolContainer + ToolCard + content)
│       └── index.ts         # Exports
```

## Design Principles

### Standard Tools
- Display only a basic ToolCard
- Used for regular tools like `finish_task`, `read_file`, etc.
- Simple, consistent visual treatment

### Special Tools
- Display ToolCard + additional content area
- Used for tools that need to show extra information:
  - `thinking`: Shows thought process
  - `write_to_file`: Shows file operation details
  - `web_search`/`bing_search`: Shows search results

## Components

### ToolCard
The shared base card component used by all tools. Provides:
- Tool icon with loading state
- Action text and remark text
- Optional URL link with external icon
- Responsive tooltip behavior
- Consistent styling using design tokens

### ToolContainer
The shared container component used by special tools that need additional content areas. Provides:
- Consistent flex layout with column direction
- Standard gap spacing between card and content
- Eliminates code duplication across tool components

### ToolDetail Components

#### TextEditor
A comprehensive text editor component for file operations. Features:
- **File Display**: Shows file name in header with proper styling
- **Content Viewing**: Syntax-highlighted code display with proper formatting
- **Edit Mode**: In-place editing with textarea and save/cancel actions
- **Copy Function**: One-click copy to clipboard functionality
- **Language Support**: Syntax highlighting based on file type
- **Responsive Design**: Adapts to different screen sizes
- **Save Handling**: Customizable save callback for file operations

### Tool Renderers
- **StandardTool**: Simple wrapper around ToolCard only
- **ThinkingTool**: ToolContainer wrapping ToolCard + thinking content area
- **FileOperationTool**: ToolContainer wrapping ToolCard + TextEditor for file content display and editing
- **WebSearchTool**: ToolContainer wrapping ToolCard + search results area

## Usage

The main Tool component automatically selects the appropriate renderer based on the tool type:

```tsx
<Tool data={{
  name: 'thinking',
  action: 'Analyzing the problem...',
  remark: 'Processing user request',
  status: 'running'
}} />
```

## Features

- **Responsive Design**: Mobile-first approach with desktop tooltips
- **Loading States**: Visual feedback for running tools
- **URL Handling**: External links open in new tabs
- **Type Safety**: Full TypeScript support
- **Design System**: Uses antd-style with design tokens
- **Accessibility**: Proper ARIA labels and keyboard navigation

## Technical Details

- Built with React functional components and hooks
- Uses `antd-style` for styling with design tokens
- Responsive behavior with `useResponsive` hook
- Memoized components for performance
- Clean separation of concerns between card display and content rendering 