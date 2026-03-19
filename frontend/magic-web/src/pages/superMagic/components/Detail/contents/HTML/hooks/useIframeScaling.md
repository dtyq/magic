# useIframeScaling Hook

Hook to manage iframe scaling and positioning for PPT render mode. Calculates scale ratio, offsets, and content dimensions based on container size and actual content height.

## Features

- **Dynamic Height Calculation**: Automatically calculates iframe height based on actual content instead of fixed 1080px
- **Responsive Scaling**: Adjusts scale ratio based on container dimensions
- **Center Alignment**: Automatically centers content both vertically and horizontally

## Usage

For standalone HTML rendering where the hook manages all state internally:

```typescript
import { useIframeScaling } from './hooks/useIframeScaling'

function MyComponent() {
  const containerRef = useRef<HTMLDivElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  
  const {
    scaleRatio,
    verticalOffset,
    horizontalOffset,
    contentWidth,
    contentHeight,
    containerDimensions
  } = useIframeScaling({
    containerRef,
    iframeRef,
    isPptRender: true,
    isFullscreen: false,
    iframeLoaded: true,
    contentInjected: true
  })
  
  return (
    <div ref={containerRef}>
      <iframe
        ref={iframeRef}
        style={{
          transform: `scale(${scaleRatio}) translate(${horizontalOffset}px, ${verticalOffset}px)`,
          transformOrigin: 'top left',
          width: contentWidth,
          height: contentHeight
        }}
      />
    </div>
  )
}
```

## API

### Config Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `containerRef` | `React.RefObject<HTMLDivElement>` | Yes | - | Reference to container element |
| `iframeRef` | `React.RefObject<HTMLIFrameElement>` | Yes | - | Reference to iframe element |
| `isPptRender` | `boolean` | No | `false` | Enable PPT rendering mode |
| `isFullscreen` | `boolean` | No | `false` | Fullscreen state (triggers recalculation) |
| `iframeLoaded` | `boolean` | No | `false` | Whether iframe is loaded |
| `contentInjected` | `boolean` | No | `false` | Whether content is injected |
| `enableHeightCalculation` | `boolean` | No | `true` | Whether to measure iframe content height |
| `isVisible` | `boolean` | No | `true` | Whether iframe is visible (controls scaling readiness) |

### Return Values

| Property | Type | Description |
|----------|------|-------------|
| `scaleRatio` | `number` | Calculated scale ratio |
| `verticalOffset` | `number` | Vertical offset for centering |
| `horizontalOffset` | `number` | Horizontal offset for centering |
| `contentWidth` | `number` | Base content width (1920px) |
| `contentHeight` | `number` | Calculated content height |
| `containerDimensions` | `{ width: number, height: number }` | Container dimensions |
| `isScaleReady` | `boolean` | Whether scaling is ready to display |

### Visibility Notes

- When `isVisible` is `false`, scaling is skipped to avoid stale values.
- When `isVisible` becomes `true`, a sync recalculation runs before paint.

## Implementation Details

### Height Calculation

The hook calculates the actual content height by querying the iframe document:

```typescript
const height = Math.max(
  body.scrollHeight,
  body.offsetHeight,
  html.clientHeight,
  html.scrollHeight,
  html.offsetHeight,
)
```

Falls back to 1080px if calculation fails.
If `enableHeightCalculation` is `false`, the height is fixed to 1080px.

### Pre-render Behavior

In PPT mode, slides may be pre-rendered. Use `isVisible` to
prevent hidden slides from recalculating or playing animations early.

### Scale Calculation

Scale ratio is calculated to fit content within container:

```typescript
const scaleByWidth = containerWidth / CONTENT_BASE_WIDTH  // 1920px
const scaleByHeight = containerHeight / actualHeight
const scaleRatio = Math.min(scaleByWidth, scaleByHeight)
```

### Center Alignment

Offsets are calculated to center the scaled content:

```typescript
const scaledHeight = actualHeight * scaleRatio
const verticalOffset = (containerHeight - scaledHeight) / 2 / scaleRatio

const scaledWidth = CONTENT_BASE_WIDTH * scaleRatio
const horizontalOffset = (containerWidth - scaledWidth) / 2 / scaleRatio
```

## Performance

- Uses debounced calculation (16ms) to avoid excessive recalculations
- Automatically listens to:
  - Window resize events
  - Container size changes (via ResizeObserver)
- Only recalculates when `isPptRender` is true

## Migration Guide

### Before

```typescript
// Manual scale calculation
const [scaleRatio, setScaleRatio] = useState(1)
const [verticalOffset, setVerticalOffset] = useState(0)
// ... manual calculation logic

<iframe
  style={{
    width: 1920,
    height: 1080, // Fixed height
    transform: `scale(${scaleRatio}) translate(...)`
  }}
/>
```

### After

```typescript
// Using hook
const { scaleRatio, verticalOffset, horizontalOffset, contentHeight } = useIframeScaling({
  containerRef,
  iframeRef,
  isPptRender: true
})

<iframe
  style={{
    width: 1920,
    height: contentHeight, // Dynamic height
    transform: `scale(${scaleRatio}) translate(...)`
  }}
/>
```
