# MagicPdfRender

A PDF preview component based on `react-pdf` that supports file and URL rendering with complete interactive features.

## Features

- ✅ Support for local files (File objects) and network URLs
- ✅ Complete toolbar: pagination, zoom, rotation, download, fullscreen, etc.
- ✅ Keyboard shortcut support
- ✅ Responsive design
- ✅ Error handling and loading states
- ✅ TypeScript support
- ✅ Custom styling (based on antd-style)
- ✅ Internationalization support (Chinese/English)

## Basic Usage

```tsx
import MagicPdfRender from './components/base/MagicPdfRender'

function App() {
  const [file, setFile] = useState<File | string | null>(null)
  
  return (
    <MagicPdfRender
      file={file}
      height={600}
      showToolbar
      enableKeyboard
      onLoadSuccess={(pdf) => console.log('Load success', pdf)}
      onLoadError={(error) => console.error('Load failed', error)}
    />
  )
}
```

## API

### Props

| Parameter | Description | Type | Default |
| --- | --- | --- | --- |
| file | PDF file source, can be File object or URL string | `File \| string \| null` | - |
| showToolbar | Whether to show toolbar | `boolean` | `true` |
| initialScale | Initial zoom scale | `number` | `1.0` |
| minScale | Minimum zoom scale | `number` | `0.5` |
| maxScale | Maximum zoom scale | `number` | `3.0` |
| scaleStep | Zoom step size | `number` | `0.1` |
| height | Container height | `string \| number` | `600` |
| width | Container width | `string \| number` | `'100%'` |
| enableKeyboard | Whether to enable keyboard shortcuts | `boolean` | `true` |
| onLoadError | Load error callback | `(error: Error) => void` | - |
| onLoadSuccess | Load success callback | `(pdf: any) => void` | - |

## Keyboard Shortcuts

| Shortcut | Function |
| --- | --- |
| `←` / `→` | Previous page / Next page |
| `+` / `-` | Zoom in / Zoom out |
| `Ctrl+0` | Reset zoom |
| `F11` | Toggle fullscreen |

## Toolbar Features

- **Page Navigation**: Previous page, next page, page number input
- **Zoom Controls**: Zoom in, zoom out, zoom scale input
- **Rotation**: Clockwise and counterclockwise 90-degree rotation
- **Document Actions**: Reload, download PDF
- **Display Controls**: Fullscreen preview

## File Support

### Local Files
```tsx
const handleFileUpload = (file: File) => {
  setFile(file)
}

// Use with Upload component
<Upload beforeUpload={handleFileUpload}>
  <Button>Upload PDF</Button>
</Upload>
```

### Network URLs
```tsx
const pdfUrl = 'https://example.com/document.pdf'
setFile(pdfUrl)
```

## Custom Styling

The component uses `antd-style` for style management, allowing customization through CSS-in-JS:

```tsx
const useCustomStyles = createStyles(({ token }) => ({
  customContainer: {
    border: `2px solid ${token.colorPrimary}`,
    borderRadius: '12px',
  }
}))
```

## Dependencies

- React 18+
- antd 5+
- react-pdf 9+
- antd-style 3+

## Important Notes

1. **PDF.js Worker**: The component automatically configures PDF.js worker, no additional setup required
2. **CORS Issues**: When loading cross-origin PDFs, the server needs proper CORS headers
3. **File Size**: Large files may affect loading performance, consider optimization
4. **Browser Compatibility**: Depends on modern browser PDF rendering capabilities

## Error Handling

The component provides comprehensive error handling:

```tsx
<MagicPdfRender
  file={file}
  onLoadError={(error) => {
    console.error('PDF load failed:', error)
    // Display user-friendly error message
    message.error('PDF load failed, please check file format or network connection')
  }}
/>
```

## Internationalization

The component supports both Chinese and English languages, using `react-i18next` for internationalization management.

### Configuration

Ensure the `component` namespace is included in your project's internationalization configuration:

```typescript
// src/assets/locales/create.ts
ns: ["translation", "common", "interface", "message", "flow", "magicFlow", "component"]
```

### Language Files

- Chinese: `src/assets/locales/zh_CN/component.json`
- English: `src/assets/locales/en_US/component.json`

### Language Switching

```tsx
import { useTranslation } from "react-i18next"

function App() {
  const { i18n } = useTranslation()
  
  const switchLanguage = (lang: string) => {
    i18n.changeLanguage(lang)
  }
  
  return (
    <div>
      <Button onClick={() => switchLanguage("zh_CN")}>中文</Button>
      <Button onClick={() => switchLanguage("en_US")}>English</Button>
      <MagicPdfRender file={file} />
    </div>
  )
}
```

### Supported Text

All user interface text in the component supports internationalization, including:

- Toolbar button tooltips
- Page navigation information
- Error and status messages
- Dropdown menu options
- Placeholder text

## Architecture

The component has been refactored following SOLID principles and best practices, splitting the original 697-line monolithic component into multiple focused, reusable modules:

### Structure

```
MagicPdfRender/
├── index.tsx                    # Main component (164 lines)
├── types.ts                     # Type definitions
├── styles.ts                    # Style definitions
├── hooks/                       # Custom Hooks
│   ├── usePdfState.ts          # PDF state management
│   ├── usePdfActions.ts        # PDF action logic
│   ├── useKeyboardControls.ts  # Keyboard event handling
│   ├── useContainerSize.ts     # Container size monitoring
│   └── useScrollListener.ts    # Scroll listening
└── components/                  # Sub-components
    ├── Toolbar/                # Toolbar component
    ├── PageNavigation/         # Page navigation component
    ├── ZoomControls/          # Zoom control component
    ├── ActionDropdown/        # Action dropdown component
    └── PdfViewer/            # PDF viewer component
```

### Benefits

- **Maintainability**: Reduced from 697 to 164 lines in main component
- **Reusability**: Custom hooks and components can be reused independently
- **Testability**: Each module can be tested in isolation
- **Performance**: Optimized rendering and memory usage
- **Development**: Parallel development and easier debugging

## Migration Guide

The refactored component is **fully backward compatible**. Existing usage patterns require no changes:

```tsx
// Usage remains identical before and after refactoring
<MagicPdfRender 
  file={pdfFile}
  showToolbar={true}
  height="600px"
  onLoadSuccess={handleSuccess}
  onLoadError={handleError}
/>
```

All original props, event callbacks, and functionality remain unchanged, with only internal implementation becoming more modular and maintainable. 