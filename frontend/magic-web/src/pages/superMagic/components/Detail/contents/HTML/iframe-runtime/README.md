# Iframe Runtime

A standalone JavaScript runtime for HTML editing within an iframe. This package is built as a single IIFE (Immediately Invoked Function Expression) that can be injected into any HTML document to provide editing capabilities.

## Features

- **Element Selection**: Interactive element selection with visual highlighting
- **Style Editing**: Modify element styles (colors, fonts, spacing, etc.)
- **Undo/Redo**: Complete command history with undo/redo support
- **Content Management**: Get, clean, and validate HTML content
- **Message Bridge**: Secure communication between iframe and parent window

## Architecture

### Core Modules

- **EditorBridge**: Handles message-based communication with parent window
- **CommandHistory**: Manages undo/redo stack for all editing operations
- **types**: TypeScript type definitions for the message protocol

### Features

- **ElementSelector**: Interactive element selection with hover/click handling

### Utils

- **ContentCleaner**: Removes injected editor elements from HTML
- **EditorLogger**: Simple logging utility
- **ElementSelector**: Utility functions for finding elements by selector
- **css**: CSS utility functions (camelCase ↔ kebab-case conversion)
- **dom**: DOM utility functions (element selectors, injection detection)

## Build

```bash
# Production build
pnpm build

# Development build with watch mode
pnpm build:watch
```

The build output will be in `dist/iframe-runtime.js`.

## Usage

Inject the built script into an iframe:

```typescript
const iframe = document.createElement('iframe')
iframe.srcdoc = htmlContent
iframe.onload = () => {
  // Inject runtime script
  const script = iframe.contentDocument!.createElement('script')
  script.textContent = iframeRuntimeCode
  iframe.contentDocument!.head.appendChild(script)
}
```

## Message Protocol

The runtime uses a versioned message protocol (v1.0.0) with four message categories:

- **REQUEST**: Query messages that expect a response
- **RESPONSE**: Response to a request
- **EVENT**: One-way notification messages
- **COMMAND**: Undoable editing operations

### Supported Messages

#### Requests

- `GET_CONTENT`: Get current HTML content
- `GET_CLEAN_CONTENT`: Get HTML with editor elements removed
- `GET_HISTORY_STATE`: Get undo/redo state
- `UNDO`: Undo last command
- `REDO`: Redo last undone command
- `CLEAR_HISTORY`: Clear command history
- `ENTER_EDIT_MODE`: Enable editing mode
- `EXIT_EDIT_MODE`: Disable editing mode
- `ENTER_SELECTION_MODE`: Enable element selection
- `EXIT_SELECTION_MODE`: Disable element selection
- `GET_COMPUTED_STYLES`: Get computed styles for an element
- `VALIDATE_CONTENT`: Validate HTML content

#### Commands

- `SET_BACKGROUND_COLOR`: Change element background color
- `SET_TEXT_COLOR`: Change element text color
- `SET_FONT_SIZE`: Change element font size
- `BATCH_STYLES`: Apply multiple styles at once

#### Events

- `IFRAME_READY`: Runtime initialized (sent automatically)
- `CONTENT_CHANGED`: Content has been modified
- `HISTORY_STATE_CHANGED`: Undo/redo state changed
- `EDIT_MODE_CHANGED`: Edit mode enabled/disabled
- `SELECTION_MODE_CHANGED`: Selection mode enabled/disabled
- `ELEMENT_SELECTED`: An element was selected

## Development

The package is self-contained with no external dependencies. All TypeScript types are included, and the build is optimized for size and performance.

### Directory Structure

```
src/
├── core/           # Core runtime modules
├── features/       # Feature implementations
├── utils/          # Utility functions
└── index.ts        # Main entry point
```

## Integration

This runtime is designed to work with the HTML Editor V2 system. The parent window uses `EditorBridge` to communicate with the iframe runtime via the message protocol.

See `../bridge/EditorBridge.ts` and `../hooks/useHTMLEditorV2.ts` for integration examples.
