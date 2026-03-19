# PPTRender Component

## Overview

PPTRender is a component for rendering and managing PowerPoint-like slide presentations. It uses MobX for state management and supports both PPT mode (with thumbnails) and Outline mode (with titles only).

## Store Structure

The PPT Store now uses complete `SlideItem` objects instead of just URLs:

```typescript
interface SlideItem {
  id: string
  url?: string
  index: number
  path: string        // Path from magic.project.js slides array
  title?: string      // Optional title for outline mode
}
```

## Usage

### Basic Usage (Backward Compatible)

The component still accepts string arrays for backward compatibility:

```typescript
<PPTRender
  slides={['slide1.html', 'slide2.html', 'slide3.html']}
  fileUrlMapping={fileUrlMapping}
  activeIndex={activeIndex}
  setActiveIndex={setActiveIndex}
  onSaveReady={handleSaveReady}
  // ... other props
/>
```

### Using with magic.project.js Data

To leverage the full `SlideItem` structure with paths from `magic.project.js`:

```typescript
import { buildSlideItems } from './utils'

// Get slides array from magic.project.js
const magicProjectSlides = ['slides/slide1.html', 'slides/slide2.html']

// Build SlideItem array
const slideItems = buildSlideItems({
  slidesPaths: magicProjectSlides,
  fileUrlMapping: fileUrlMapping,
  slideTitles: ['Introduction', 'Main Content'], // Optional
})

// Initialize store with SlideItem[]
store.initializeSlides(slideItems)
```

### Extracting Slide Titles

You can automatically extract titles from slide HTML content:

```typescript
import { extractSlideTitles } from './utils'

// After slides are loaded
const titles = extractSlideTitles(store.slideContents)
store.updateSlideTitles(titles)
```

## Store API

### Data Access

```typescript
// Get slide arrays
store.slides          // SlideItem[]
store.slideUrls       // string[] (derived)
store.slidePaths      // string[] (derived)
store.slideTitles     // string[] (derived)

// Get current slide
store.currentSlide         // SlideItem | undefined
store.currentSlideUrl      // string
store.currentSlidePath     // string
store.currentSlideTitle    // string
store.currentSlideContent  // string
```

### Initialization

```typescript
// Initialize with string[] (backward compatible)
store.initializeSlides(['slide1.html', 'slide2.html'])

// Initialize with SlideItem[]
store.initializeSlides([
  { id: 'slide-0', path: 'slides/slide1.html', url: 'https://...', index: 0 },
  { id: 'slide-1', path: 'slides/slide2.html', url: 'https://...', index: 1 },
])
```

### Updating Slides

```typescript
// Update entire slides array
store.setSlides(newSlideItems)

// Update single slide item
store.updateSlideItem(0, { title: 'New Title', url: 'https://...' })

// Update slide title
store.updateSlideTitle(0, 'New Title')

// Batch update titles
store.updateSlideTitles(['Title 1', 'Title 2', 'Title 3'])
```

## View Mode

The sidebar displays slide thumbnails with slide numbers. When hovering over a slide, a tooltip shows the slide title extracted from the HTML content.

## Helper Utilities

### buildSlideItems

Builds `SlideItem[]` from paths and URL mapping:

```typescript
import { buildSlideItems } from './utils'

const slideItems = buildSlideItems({
  slidesPaths: ['slides/slide1.html', 'slides/slide2.html'],
  fileUrlMapping: fileUrlMapping,
  slideTitles: ['Intro', 'Content'], // Optional
})
```

### extractSlideTitle

Extracts title from HTML content (looks for `<title>` or `<h1>` tags):

```typescript
import { extractSlideTitle } from './utils'

const title = extractSlideTitle(htmlContent, 'Slide 1')
```

### extractSlideTitles

Batch extracts titles from all slide contents:

```typescript
import { extractSlideTitles } from './utils'

const titles = extractSlideTitles(store.slideContents)
store.updateSlideTitles(titles)
```

## Migration Guide

### From URLs to SlideItems

If you're currently using just URLs:

```typescript
// Before
const slideUrls = ['https://...', 'https://...']
store.initializeSlides(slideUrls)

// After (still works - backward compatible)
store.initializeSlides(slideUrls)

// Or use full SlideItem structure
const slideItems = buildSlideItems({
  slidesPaths: originalSlidesPaths, // from magic.project.js
  fileUrlMapping: fileUrlMapping,
})
store.initializeSlides(slideItems)
```

### Accessing Data

```typescript
// Before
const url = store.slideUrls[index]

// After (still works)
const url = store.slideUrls[index]

// Or access full item
const slide = store.slides[index]
const url = slide.url
const path = slide.path
const title = slide.title
```

## Best Practices

1. **Use buildSlideItems**: When working with `magic.project.js` data, use `buildSlideItems` to create proper `SlideItem[]` arrays.

2. **Extract Titles After Loading**: After slides are loaded and rendered, extract titles from HTML content to show in tooltips:

```typescript
useEffect(() => {
  if (store.isAllSlidesLoaded) {
    const titles = extractSlideTitles(store.slideContents)
    store.updateSlideTitles(titles)
  }
}, [store.isAllSlidesLoaded])
```

3. **Maintain Path Consistency**: Always keep the `path` field in sync with the original `magic.project.js` slides array for proper editing operations.

4. **Type Safety**: Use TypeScript types exported from `PPTSidebar/types.ts` for type safety.
