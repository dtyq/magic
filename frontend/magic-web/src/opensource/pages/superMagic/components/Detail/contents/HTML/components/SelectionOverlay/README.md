# SelectionOverlay Component

## Overview

This component renders element selection and hover highlights in the **parent window** (not inside the iframe). This approach provides several advantages:

1. **Breakthrough iframe boundaries** - Highlights can extend beyond iframe edges
2. **Unaffected by iframe transforms** - Works correctly with scaled/transformed iframes
3. **Enhanced interactions** - Can add resize handles, tooltips, and other controls
4. **Better performance** - No DOM manipulation inside the iframe

## Architecture

```
┌─────────────────────────────────────────────────┐
│ Parent Window (IsolatedHTMLRenderer)           │
│                                                  │
│  ┌──────────────────────────────────────────┐  │
│  │ SelectionOverlay (Absolute positioned)   │  │
│  │ - Renders blue box for selected element │  │
│  │ - Renders dashed box for hovered element│  │
│  └──────────────────────────────────────────┘  │
│                                                  │
│  ┌──────────────────────────────────────────┐  │
│  │ <iframe> (HTML Content)                  │  │
│  │                                          │  │
│  │  ┌────────────────────────────────────┐ │  │
│  │  │ ElementSelector                    │ │  │
│  │  │ - Listens to mouse events         │ │  │
│  │  │ - Sends rect via postMessage      │ │  │
│  │  └────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

## Message Flow

1. **User hovers over an element in iframe**
   - `ElementSelector` detects the hover
   - Calculates element's `getBoundingClientRect()`
   - Sends `ELEMENT_HOVERED` event via `EditorBridge`

2. **Parent window receives message**
   - `SelectionOverlay` listens to `message` events
   - Extracts rect coordinates from payload
   - Transforms rect based on iframe position and scale
   - Renders a dashed border overlay

3. **User clicks to select an element**
   - `ElementSelector` sends `ELEMENT_SELECTED` event
   - `SelectionOverlay` renders a solid blue border
   - Clears hover highlight

## Coordinate Transformation

The key challenge is transforming coordinates from iframe space to parent window space:

### Normal Mode (no scaling)
```typescript
parentRect = {
  top: (iframeRect.top - containerRect.top) + elementRect.top,
  left: (iframeRect.left - containerRect.left) + elementRect.left,
  width: elementRect.width,
  height: elementRect.height
}
```

### PPT Mode (with scaling)
```typescript
parentRect = {
  top: (iframeRect.top - containerRect.top) + elementRect.top * scale,
  left: (iframeRect.left - containerRect.left) + elementRect.left * scale,
  width: elementRect.width * scale,
  height: elementRect.height * scale
}
```

## Scroll Handling

When the iframe content scrolls, element positions change:

1. **Iframe side**: `ElementSelector` listens to scroll events
2. **On scroll**: Recalculates selected element's rect
3. **Sends updated rect**: Posts `ELEMENT_SELECTED` event with new coordinates
4. **Parent side**: `SelectionOverlay` updates highlight position

## Usage

```tsx
<SelectionOverlay
  containerRef={contentWrapperRef}
  iframeRef={iframeRef}
  scaleRatio={scaleRatio}
  isPptRender={isPptRender}
/>
```

## Files Modified

1. **iframe-runtime/src/features/ElementSelector.ts**
   - Removed CSS style injection
   - Send element rect via EditorBridge
   - Added scroll listener for position updates

2. **components/SelectionOverlay/SelectionOverlay.tsx**
   - New component to render highlights in parent window
   - Listens to EditorBridge events
   - Transforms coordinates based on iframe position

3. **IsolatedHTMLRenderer.tsx**
   - Integrated `SelectionOverlay` component
   - Passes iframe ref and transform parameters

## Benefits

✅ **Visual clarity** - Highlights are crisp and not affected by iframe transforms
✅ **Better UX** - Can add interactive controls like resize handles
✅ **Cross-boundary** - Highlights can extend beyond iframe edges
✅ **Performance** - No DOM manipulation inside sandboxed iframe
✅ **Maintainability** - Separation of concerns between selection logic and rendering

## Future Enhancements

- [ ] Add resize handles for selected elements
- [ ] Show element info tooltip (tag name, dimensions)
- [ ] Support multi-selection
- [ ] Add keyboard shortcuts for fine-tuning position
