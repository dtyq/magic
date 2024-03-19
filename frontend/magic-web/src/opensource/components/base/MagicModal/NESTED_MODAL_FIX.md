# Nested Modal Event Propagation Fix

## Problem

The original implementation of `MagicModal` had critical event propagation issues when modals were nested:

### Issues Identified

1. **Event Bubbling Not Stopped**
    - Clicking the overlay of an inner modal would trigger the close callback of outer modals
    - Pressing ESC key would close all nested modals at once
    - Only called `e.preventDefault()` without `e.stopPropagation()`

2. **Cascade Closing Effect**
    - In nested scenarios: Modal A → Modal B → Modal C
    - Closing Modal C would inadvertently close Modal B and A as well
    - Poor user experience and unexpected behavior

3. **No Event Isolation**
    - `onPointerDownOutside` and `onEscapeKeyDown` handlers didn't stop event propagation
    - Events bubbled up through the DOM tree affecting parent modals

## Solution

### Code Changes

**File: `src/opensource/components/base/MagicModal/MagicModalDesktop.tsx`**

Added `e.stopPropagation()` to both event handlers:

```typescript
onPointerDownOutside={(e) => {
	// Always stop propagation to prevent nested modal issues
	e.stopPropagation()
	if (!maskClosable) {
		e.preventDefault()
	}
}}
onEscapeKeyDown={(e) => {
	// Always stop propagation to prevent closing multiple modals
	e.stopPropagation()
	if (!maskClosable) {
		e.preventDefault()
	}
}}
```

### Why This Works

1. **Event Isolation**: `e.stopPropagation()` prevents events from bubbling to parent elements
2. **Maintains maskClosable Logic**: The `maskClosable` check still works as expected
3. **Proper Nesting Support**: Each modal now handles its own events independently

## Testing

### Test Coverage

Created comprehensive test suite in `__tests__/nested-modal.test.tsx`:

- ✅ Render nested modals with proper structure and z-index
- ✅ Prevent ESC key from closing multiple modals
- ✅ Respect `maskClosable=false` and still prevent propagation
- ✅ Allow independent z-index management
- ✅ Handle triple nested modals correctly

All tests pass with 100% success rate.

## Usage Example

### Basic Nested Modal

```typescript
function NestedModalExample() {
  const [outerOpen, setOuterOpen] = useState(true)
  const [innerOpen, setInnerOpen] = useState(true)

  return (
    <MagicModal
      open={outerOpen}
      title="Outer Modal"
      onCancel={() => setOuterOpen(false)}
      zIndex={1000}
    >
      <div>Outer Content</div>

      <MagicModal
        open={innerOpen}
        title="Inner Modal"
        onCancel={() => setInnerOpen(false)}
        zIndex={1100}  // Higher z-index
      >
        <div>Inner Content</div>
      </MagicModal>
    </MagicModal>
  )
}
```

### Triple Nesting

```typescript
<MagicModal zIndex={1000}>
  Level 1
  <MagicModal zIndex={1100}>
    Level 2
    <MagicModal zIndex={1200}>
      Level 3 - Clicking overlay or pressing ESC only closes this modal
    </MagicModal>
  </MagicModal>
</MagicModal>
```

## Best Practices

### 1. Z-Index Management

Always increment z-index for nested modals:

```typescript
// Recommended z-index increments
Outer modal:  zIndex={1000}
Middle modal: zIndex={1100}
Inner modal:  zIndex={1200}
```

### 2. State Management

Keep modal state independent:

```typescript
// ✅ Good - Independent state
const [modalA, setModalA] = useState(false)
const [modalB, setModalB] = useState(false)

// ❌ Bad - Coupled state
const closeAll = () => {
	setModalA(false)
	setModalB(false)
}
```

### 3. Avoid Deep Nesting

While the fix supports any nesting depth, UX best practices suggest:

- Maximum 2-3 levels of nesting
- Consider alternatives like modal flow or stepper for complex workflows

## Limitations

### Mobile Version

The mobile version (`MagicModalMobile.tsx`) uses `MagicPopup` (based on Vaul Drawer).

- Nesting on mobile is **NOT recommended** due to UX constraints
- Mobile screens typically don't have enough space for nested modals
- Consider using sequential modals or bottom sheets instead

### Known Warnings

You may see these warnings in development (safe to ignore):

- `Warning: Missing 'Description' or 'aria-describedby={undefined}' for {DialogContent}`
    - Accessibility warning from Radix UI
    - Can be resolved by adding `DialogDescription` component

## Browser Compatibility

The fix uses standard DOM event methods:

- `e.stopPropagation()` - Supported in all modern browsers
- `e.preventDefault()` - Standard DOM API

Compatible with:

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Performance

No performance impact from this fix:

- `stopPropagation()` is a native DOM method
- No additional re-renders introduced
- Event handling remains synchronous

## Migration Guide

### If You Have Existing Nested Modals

No code changes required! The fix is backward compatible:

1. Existing nested modals will automatically benefit from the fix
2. Z-index management remains the same
3. All props and APIs unchanged

### If You Had Workarounds

You can now remove any workarounds for nested modal issues:

```typescript
// ❌ Old workaround - no longer needed
const handleInnerClose = (e) => {
  e.stopPropagation()  // Can remove this
  closeInnerModal()
}

// ✅ Now just use directly
<MagicModal onCancel={closeInnerModal} />
```

## Related Issues

- Fixed: Event propagation in nested modals
- Fixed: ESC key closing all modals
- Fixed: Overlay click affecting parent modals
- Maintained: All existing functionality and props

## References

- Radix UI Dialog: https://www.radix-ui.com/docs/primitives/components/dialog
- MDN Event.stopPropagation(): https://developer.mozilla.org/en-US/docs/Web/API/Event/stopPropagation
- React Event System: https://react.dev/learn/responding-to-events

## Contributors

- Fixed by: AI Assistant
- Date: January 5, 2026
- Review: Pending
