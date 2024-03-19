# StylePanel Context

## Problem

Previously, `StylePanelStore` was implemented as a global singleton, which caused issues when multiple `IsolatedHTMLRenderer` instances existed simultaneously (e.g., in PPT slide view):

- All StylePanel components shared the same store
- Element selection in one iframe would affect all StylePanels
- Style changes could be applied to the wrong iframe

## Solution

Implemented a Context-based architecture:

1. **StylePanelStoreProvider**: Creates an instance-specific store for each `IsolatedHTMLRenderer`
2. **useStylePanelStore**: Hook to access the instance-specific store
3. Each renderer instance now has its own isolated store

## Architecture

```
IsolatedHTMLRenderer (Instance 1)
└── StylePanelStoreProvider
    ├── StylePanel
    │   └── useStylePanelStore() → Store Instance 1
    └── useHTMLEditorV2
        └── useStylePanelStore() → Store Instance 1

IsolatedHTMLRenderer (Instance 2)
└── StylePanelStoreProvider
    ├── StylePanel
    │   └── useStylePanelStore() → Store Instance 2
    └── useHTMLEditorV2
        └── useStylePanelStore() → Store Instance 2
```

## Migration

Components that previously imported `stylePanelStore` directly should now use `useStylePanelStore()`:

```typescript
// Before
import { stylePanelStore } from "../stores/StylePanelStore"
stylePanelStore.selectElement(...)

// After
import { useStylePanelStore } from "../contexts/StylePanelContext"
const stylePanelStore = useStylePanelStore()
stylePanelStore.selectElement(...)
```

## Benefits

- ✅ Each IsolatedHTMLRenderer instance has isolated state
- ✅ StylePanel only responds to its corresponding iframe
- ✅ No cross-instance interference
- ✅ Proper cleanup when instances unmount
