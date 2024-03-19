# HTML Editor Constants

This directory contains constant values and configurations for the HTML Editor component.

## Z-Index Management

### File: `z-index.ts`

Centralized z-index management for all HTML editor related components to maintain a clear visual hierarchy and prevent layering issues.

### Layer Structure

| Layer                | Z-Index Range | Purpose                          | Components                                                          |
| -------------------- | ------------- | -------------------------------- | ------------------------------------------------------------------- |
| **Base Layer**       | 1-99          | Basic UI elements behind content | SelectionOverlay root (9000), PPT Sidebar (10)                      |
| **Toolbar Layer**    | 100-999       | Edit toolbars and control panels | StylePanel (100)                                                    |
| **Iframe Internal**  | 1000-1999     | Elements inside iframe (V2)      | Resize handles container (1000), handles (1010), drag handle (1020) |
| **Overlay Layer**    | 9000-9999     | Selection and hover highlights   | Hover highlight (9000), Selection highlight (9100)                  |
| **Fullscreen Layer** | 10000+        | Fullscreen mode containers       | PPT fullscreen container (10000)                                    |

### Usage

```typescript
import { HTML_EDITOR_Z_INDEX, TAILWIND_Z_INDEX_CLASSES } from './constants/z-index'

// Recommended: Using pre-defined Tailwind classes (ensures JIT compatibility)
<div className={TAILWIND_Z_INDEX_CLASSES.OVERLAY.SELECTION_HIGHLIGHT} />

// Alternative: Using inline styles (for dynamic z-index values)
<div style={{ zIndex: HTML_EDITOR_Z_INDEX.OVERLAY.SELECTION_HIGHLIGHT }} />
```

**Why use `TAILWIND_Z_INDEX_CLASSES`?**

Tailwind's JIT (Just-In-Time) compiler scans source code for class names. Pre-defined string constants ensure all classes are detected during build time, avoiding runtime issues with dynamically generated class names.

### Important Notes

1. **V1 Editing Script (Deprecated)**: The old editing script in `utils/editing-script.ts` uses hardcoded z-index values (999, 1001, 1002) and is not managed by this system. It's kept for backward compatibility only.

2. **Stacking Context**: The SelectionOverlay root creates a new stacking context with z-index 9000, ensuring all child elements (highlights, handles) are properly layered above other UI elements like the PPT Sidebar.

3. **Why 9000 for SelectionOverlay Root?**
    - Must be higher than PPT Sidebar (10) to ensure overlay elements appear on top
    - Creates a stacking context for child elements
    - Child elements (9000-9100) work within this context
    - Keeps sufficient gap for future additions

### Files Using This System

- `components/SelectionOverlay/SelectionOverlay.tsx` - Selection and hover highlights
- `IsolatedHTMLRenderer.tsx` - Main renderer with overlay integration
- `components/PPTRender/PPTSlide.tsx` - Slide toolbar z-index
- `components/PPTRender/PPTSidebar/index.tsx` - Sidebar collapse button
- `components/PPTRender/index.tsx` - Fullscreen container

### API Reference

#### Constants

- **`HTML_EDITOR_Z_INDEX`**: Numeric z-index values for use with inline styles
- **`TAILWIND_Z_INDEX_CLASSES`**: Pre-generated Tailwind class strings (recommended)

#### Helper Functions

- **`getInlineZIndex(value: number)`**: Returns `{ zIndex: value }` for inline styles
- **`getIframeZIndex(value: number)`**: Returns string value for iframe internal elements
- **`getTailwindZIndex(value: number)`**: ⚠️ **Deprecated** - Use `TAILWIND_Z_INDEX_CLASSES` instead for better JIT compatibility

### Maintenance

When adding new UI elements to the HTML editor:

1. Determine which layer the element belongs to
2. Add a new constant to both `HTML_EDITOR_Z_INDEX` (numeric) and `TAILWIND_Z_INDEX_CLASSES` (string) sections in `z-index.ts`
3. Use `TAILWIND_Z_INDEX_CLASSES` for Tailwind classes, or `HTML_EDITOR_Z_INDEX` with inline styles
4. Update this README if adding a new layer or significant component
