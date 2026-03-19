# PPTRootRender Component

## Overview

`PPTRootRender` is a specialized component responsible for rendering PowerPoint-like slide presentations from HTML content. It acts as a bridge between the generic content renderer and the `PPTRender` component.

## Purpose

This component was extracted from the `HTML` component to provide a cleaner separation of concerns and better maintainability. It handles:

1. **Content Processing**: Parses HTML content to extract slide paths
2. **File Management**: Manages file path mappings and message handlers for inter-frame communication
3. **PPT Rendering**: Delegates actual slide rendering to the `PPTRender` component

## Architecture

```
ContentRenderer
    └── PPTRootRender (when metadata.type === "slide")
        ├── processHtmlContent() - Extract slide paths
        ├── MessageHandler - Inter-frame communication
        └── PPTRender - Actual slide rendering
```

## Key Features

- **Lazy Loading**: Loaded only when needed via React.lazy()
- **Content Processing**: Automatically extracts slide paths from HTML content
- **File Path Resolution**: Maintains file path mappings for resource loading
- **Message Handling**: Sets up inter-frame communication for fetching resources

## Props

See [types.ts](./types.ts) for the complete `PPTRootRenderProps` interface.

Key props:

- `data`: HTML data containing slide information
- `attachmentList`: List of all attachments in the current workspace
- `metadata`: File metadata (must have `type: "slide"`)
- `allowEdit`: Whether editing is allowed
- `saveEditContent`: Callback for saving edited content
- `isPlaybackMode`: Whether in playback mode

## Usage

This component is automatically used by `ContentRenderer` when rendering HTML files with `metadata.type === "slide"`:

```typescript
if (data?.metadata?.type === "slide") {
    return <PPTRootRender data={data} {...commonProps} />
}
```

## Related Components

- **ContentRenderer**: Parent component that routes to appropriate renderers
- **PPTRender**: Child component that handles the actual slide rendering
- **HTML**: Sibling component for rendering regular HTML content

## State Management

The component maintains several pieces of local state:

- `filePathMapping`: Map of original paths to resolved URLs
- `originalSlidesPaths`: Array of slide file paths in order
- `entryFileData`: The entry HTML file data
- `currentAttachmentList`: Current list of attachments

## Message Handling

The component sets up a message handler for inter-frame communication, allowing the iframe to:

1. Request file contents via `fetch` interception
2. Resolve relative file paths
3. Load resources from the attachment list

## Error Handling

- Gracefully handles missing or invalid HTML content
- Falls back to empty slide paths if processing fails
- Logs errors to console for debugging

## Performance Considerations

- Uses `useMemoizedFn` for stable function references
- Uses `useDeepCompareEffect` to avoid unnecessary re-renders
- Lazy loads the component to reduce initial bundle size
