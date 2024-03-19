# MagicDocxRender

A React component for previewing Microsoft Word (.docx) documents using the `docx-preview` library with rich interactive features.

## Features

- 📄 **Docx Preview**: Render .docx files directly in the browser
- 🎨 **Customizable Styling**: Supports dark mode and custom styling
- 🔄 **Error Handling**: Comprehensive error handling with retry functionality
- 📱 **Responsive Design**: Works on desktop and mobile devices
- 🚀 **Performance**: Optimized rendering with loading states
- 🛡️ **Type Safety**: Full TypeScript support
- 🎛️ **Interactive Toolbar**: Complete toolbar with navigation, zoom, rotation controls
- ⌨️ **Keyboard Shortcuts**: Full keyboard navigation support
- 👆 **Touch Gestures**: Mobile-friendly pinch-to-zoom and touch interactions
- 🔍 **Advanced Zoom**: Precise zoom controls with auto-scaling
- 🔄 **Document Rotation**: 90-degree rotation support
- 📂 **Section Navigation**: Navigate through document sections
- 🔽 **Download Support**: Direct file download functionality
- 🖥️ **Fullscreen Mode**: Fullscreen viewing experience

## Installation

The component uses `docx-preview` which is already installed in the project:

```bash
pnpm add docx-preview
```

## Basic Usage

```tsx
import MagicDocxRender from "@/components/base/MagicDocxRender"

function App() {
  const [file, setFile] = useState<File | null>(null)
  
  const handleFileChange = (file: File) => {
    setFile(file)
  }

  return (
    <div>
      <input 
        type="file" 
        accept=".docx" 
        onChange={(e) => handleFileChange(e.target.files?.[0])} 
      />
      
      {file && (
        <MagicDocxRender
          file={file}
          height="600px"
          width="100%"
          showToolbar={true}
          enableKeyboard={true}
          enableTouchGestures={true}
          onReady={() => console.log("Document loaded")}
          onError={(error) => console.error("Error:", error)}
        />
      )}
    </div>
  )
}
```

## Advanced Usage

```tsx
import MagicDocxRender from "@/components/base/MagicDocxRender"

function AdvancedDocxViewer() {
  const [file, setFile] = useState<File | null>(null)
  const [scale, setScale] = useState(1.0)
  const [rotation, setRotation] = useState(0)

  return (
    <MagicDocxRender
      file={file}
      height="800px"
      width="100%"
      showToolbar={true}
      initialScale={1.0}
      minScale={0.5}
      maxScale={3.0}
      scaleStep={0.1}
      enableKeyboard={true}
      enableTouchGestures={true}
      autoScale={true}
      darkMode={false}
      onReady={() => console.log("Document ready")}
      onError={(error) => console.error("Error:", error)}
      onLoadingChange={(loading) => console.log("Loading:", loading)}
      onScaleChange={(scale) => setScale(scale)}
      onRotationChange={(rotation) => setRotation(rotation)}
      renderOptions={{
        breakPages: true,
        renderHeaders: true,
        renderFootnotes: true,
        renderEndnotes: true,
      }}
    />
  )
}
```

## Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `file` | `File` | ✅ | - | The .docx file to preview |
| `height` | `string` | ✅ | - | Height of the preview container |
| `width` | `string` | ❌ | `"100%"` | Width of the preview container |
| `showToolbar` | `boolean` | ❌ | `true` | Show interactive toolbar |
| `initialScale` | `number` | ❌ | `1.0` | Initial zoom scale |
| `minScale` | `number` | ❌ | `0.5` | Minimum zoom scale |
| `maxScale` | `number` | ❌ | `3.0` | Maximum zoom scale |
| `scaleStep` | `number` | ❌ | `0.1` | Zoom step increment |
| `enableKeyboard` | `boolean` | ❌ | `true` | Enable keyboard shortcuts |
| `enableTouchGestures` | `boolean` | ❌ | `true` | Enable touch gestures |
| `autoScale` | `boolean` | ❌ | `true` | Auto-scale to fit container |
| `className` | `string` | ❌ | - | Custom CSS class name |
| `style` | `CSSProperties` | ❌ | - | Custom inline styles |
| `darkMode` | `boolean` | ❌ | `false` | Enable dark mode styling |
| `onReady` | `() => void` | ❌ | - | Callback when document is ready |
| `onError` | `(error: Error) => void` | ❌ | - | Callback when error occurs |
| `onLoadingChange` | `(loading: boolean) => void` | ❌ | - | Callback when loading state changes |
| `onScaleChange` | `(scale: number) => void` | ❌ | - | Callback when zoom scale changes |
| `onRotationChange` | `(rotation: number) => void` | ❌ | - | Callback when rotation changes |
| `renderOptions` | `DocxRenderOptions` | ❌ | - | Custom render options |

## Interactive Features

### Toolbar Controls

The toolbar provides comprehensive document control:

- **Section Navigation**: Previous/Next section buttons and section input
- **Zoom Controls**: Zoom in/out buttons and zoom percentage input
- **Rotation**: 90-degree left/right rotation buttons
- **Actions**: Reload, download, and fullscreen toggle

### Keyboard Shortcuts

| Shortcut | Function |
|----------|----------|
| `←` / `→` | Previous/Next section |
| `↑` / `↓` | Previous/Next section |
| `+` / `=` | Zoom in |
| `-` | Zoom out |
| `Ctrl+0` | Reset zoom |
| `F11` | Toggle fullscreen |
| `Escape` | Exit fullscreen |

### Touch Gestures

- **Pinch to Zoom**: Use two fingers to zoom in/out
- **Touch Navigation**: Touch-friendly toolbar interactions
- **Responsive Design**: Adapts to different screen sizes

### Auto-Scaling

The component automatically scales documents to fit the container:

- **Smart Calculation**: Considers container size and toolbar height
- **Boundary Respect**: Stays within min/max scale limits
- **One-time Application**: Only applies on initial load

## Render Options

```tsx
<MagicDocxRender
  file={file}
  height="600px"
  renderOptions={{
    breakPages: true,        // Enable page breaks
    ignoreWidth: false,      // Respect width constraints
    ignoreHeight: false,     // Respect height constraints
    ignoreFonts: false,      // Render fonts
    renderHeaders: true,     // Show headers
    renderFootnotes: true,   // Show footnotes
    renderEndnotes: true,    // Show endnotes
    useBase64URL: false,     // Use base64 for images
    experimental: false,     // Enable experimental features
    debug: false             // Enable debug mode
  }}
/>
```

## Error Handling

The component provides comprehensive error handling:

```tsx
<MagicDocxRender
  file={file}
  height="600px"
  onError={(error) => {
    // Handle different error types
    if (error.message.includes("Invalid file type")) {
      console.error("Please select a .docx file")
    } else if (error.message.includes("File too large")) {
      console.error("File size must be less than 50MB")
    } else {
      console.error("Failed to render document:", error.message)
    }
  }}
/>
```

## Styling

The component supports custom styling and dark mode:

```tsx
<MagicDocxRender
  file={file}
  height="600px"
  className="custom-docx-viewer"
  style={{ border: "1px solid #ccc", borderRadius: "8px" }}
  darkMode={true}
/>
```

## Responsive Design

The component automatically adapts to different screen sizes:

- **Desktop**: Full toolbar with all controls
- **Tablet**: Condensed toolbar with essential controls
- **Mobile**: Compact toolbar with dropdown menu

## Performance Tips

1. **File Size**: Keep files under 10MB for optimal performance
2. **Render Options**: Disable unnecessary features like headers/footers if not needed
3. **Auto-scaling**: Use auto-scaling for consistent viewing experience
4. **Memory Management**: Component properly cleans up resources on unmount

## Browser Support

The component works in all modern browsers that support:
- FileReader API
- ES6 Promises
- CSS Transform
- Fullscreen API
- Touch Events (for mobile)

## Examples

### With Custom Toolbar

```tsx
function CustomToolbarExample() {
  const [file, setFile] = useState<File | null>(null)

  return (
    <MagicDocxRender
      file={file}
      height="600px"
      showToolbar={true}
      initialScale={1.2}
      minScale={0.3}
      maxScale={5.0}
      scaleStep={0.2}
      onScaleChange={(scale) => console.log("Scale changed:", scale)}
      onRotationChange={(rotation) => console.log("Rotation:", rotation)}
    />
  )
}
```

### Mobile-Optimized

```tsx
function MobileDocxViewer() {
  const [file, setFile] = useState<File | null>(null)

  return (
    <MagicDocxRender
      file={file}
      height="100vh"
      width="100%"
      showToolbar={true}
      enableTouchGestures={true}
      autoScale={true}
      initialScale={0.8}
      className="mobile-docx-viewer"
    />
  )
}
```

### Dark Mode

```tsx
function DarkModeViewer() {
  const [darkMode, setDarkMode] = useState(false)

  return (
    <div>
      <button onClick={() => setDarkMode(!darkMode)}>
        Toggle Dark Mode
      </button>
      
      <MagicDocxRender
        file={file}
        height="600px"
        darkMode={darkMode}
        showToolbar={true}
      />
    </div>
  )
}
```

## File Structure

```
MagicDocxRender/
├── index.tsx                     # Main component
├── types.ts                      # TypeScript definitions
├── styles.ts                     # Styled components
├── hooks/                        # Custom hooks
│   ├── useMagicDocxRender.ts    # Main logic hook
│   ├── useKeyboardControls.ts   # Keyboard shortcuts
│   ├── useTouchGestures.ts      # Touch gestures
│   └── useContainerSize.ts      # Responsive sizing
├── components/                   # Sub-components
│   ├── Toolbar/                 # Main toolbar
│   ├── NavigationControls/      # Section navigation
│   ├── ZoomControls/           # Zoom controls
│   └── ActionDropdown/         # Mobile dropdown
├── examples/                    # Usage examples
│   └── BasicUsage.tsx
└── README.md                   # This file
```

## Contributing

1. Follow the project's coding standards
2. Add tests for new features
3. Update documentation as needed
4. Ensure TypeScript types are complete
5. Test on multiple devices and browsers

## License

This component is part of the Magic Web project and follows the same license terms. 