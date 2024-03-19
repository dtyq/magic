# Multi-Instance HTML Editor Improvements

## Background

When multiple HTML editor instances (`IsolatedHTMLRenderer`) exist simultaneously (e.g., in PPT slides or split view), proper isolation and cleanup are critical to prevent:

- Memory leaks from lingering message listeners
- State conflicts between instances
- Message routing errors
- Performance degradation

## Architecture Overview

Each `IsolatedHTMLRenderer` creates its own isolated editing environment:

```
IsolatedHTMLRenderer (Instance 1)
└── StylePanelStoreProvider
    ├── StylePanelStore (Instance 1)
    ├── MessageBridge (Instance 1) → iframe 1
    └── useHTMLEditorV2 hook

IsolatedHTMLRenderer (Instance 2)
└── StylePanelStoreProvider
    ├── StylePanelStore (Instance 2)
    ├── MessageBridge (Instance 2) → iframe 2
    └── useHTMLEditorV2 hook
```

## Key Design Principles

### 1. Instance-Specific Stores ✅

Each `StylePanelStoreProvider` creates a unique `StylePanelStore` instance using `useMemo(() => new StylePanelStore(), [])`. This ensures:

- Selection state is isolated per instance
- Undo/redo history doesn't conflict
- Style changes apply to the correct editor

### 2. Message Source Validation ✅

`MessageBridge` validates message origin before processing:

```typescript
if (!this.iframe || event.source !== this.iframe.contentWindow) {
  return
}
```

This prevents cross-instance message pollution.

### 3. Proper Cleanup on Unmount ⚡ **NEW**

**Previous Issue:** The first `useEffect` cleanup was disabled, relying only on the second `useEffect` to clean up when `isEditMode` changed. This could cause:
- Memory leaks if component unmounts while still in edit mode
- Lingering message listeners in multi-instance scenarios

**Solution:** Restore cleanup in the first `useEffect`:

```typescript
return () => {
  // Cleanup: ensure MessageBridge is destroyed when component unmounts
  // or when edit mode/sandbox type changes
  if (bridge.isActive()) {
    console.log("[useHTMLEditorV2] Cleaning up MessageBridge (unmount or deps change)")
    bridge.destroy()
    // Clear the ref to prevent the second useEffect from trying to use it
    if (messageBridgeRef.current === bridge) {
      messageBridgeRef.current = null
    }
  }
}
```

### 4. Graceful Degradation ⚡ **NEW**

When exiting edit mode, check if MessageBridge is still active before sending exit requests:

```typescript
if (messageBridgeRef.current && messageBridgeRef.current.isActive()) {
  // Send exit requests
  await messageBridgeRef.current?.request(EditorMessageType.EXIT_EDIT_MODE)
  await messageBridgeRef.current?.request(EditorMessageType.EXIT_SELECTION_MODE)
} else {
  // If MessageBridge is already destroyed, just reset store
  stylePanelStore.reset()
}
```

### 5. Early Destruction Checks ⚡ **NEW**

`MessageBridge.handleMessage` now checks `isDestroyed` early:

```typescript
private handleMessage = (event: MessageEvent) => {
  // Early return if bridge is destroyed
  if (this.isDestroyed) {
    return
  }
  // ... rest of the handler
}
```

This prevents processing messages after cleanup, avoiding potential errors.

## Performance Considerations

### Global Message Listeners

Each `MessageBridge` instance adds a global `window.addEventListener("message", ...)`. With N instances:
- N listeners will be triggered for every postMessage
- Each listener validates the message source and ignores non-matching messages
- This is functionally correct but has O(N) overhead per message

**Mitigation:**
- Listeners are properly cleaned up on unmount/destroy
- Message validation is fast (simple reference comparison)
- Typical use cases have 2-5 instances max (acceptable overhead)

**Future Optimization (if needed):**
Could implement a singleton MessageRouter that dispatches to specific bridges based on source window.

## Testing Multi-Instance Scenarios

### Test Case 1: Simultaneous Editing
1. Open two HTML editors in edit mode
2. Select elements in both editors
3. Verify selections don't interfere
4. Verify undo/redo are independent

### Test Case 2: Rapid Mount/Unmount
1. Open editor instance A in edit mode
2. Mount editor instance B
3. Unmount editor instance A
4. Verify no errors in console
5. Verify instance B still works

### Test Case 3: Memory Leak Check
1. Open/close 10 editor instances in sequence
2. Check browser memory usage doesn't grow unbounded
3. Verify message listeners are cleaned up (use browser dev tools)

## Debug Logging

Enhanced logging helps track multi-instance behavior:

```typescript
// MessageBridge cleanup
console.log("[MessageBridge] Destroying bridge, cleaning up resources", {
  pendingRequests: this.pendingRequests.size,
  eventHandlers: this.eventHandlers.size,
})

// useHTMLEditorV2 cleanup
console.log("[useHTMLEditorV2] Cleaning up MessageBridge (unmount or deps change)")
```

Look for these logs to verify proper cleanup in multi-instance scenarios.

## Migration Notes

These changes are **backward compatible**. Existing code continues to work without modification. The improvements are:

- More robust cleanup (prevents memory leaks)
- Better error handling (graceful degradation)
- Enhanced debugging (clearer logs)

No API changes or breaking changes.

## Related Files

- `useHTMLEditorV2.ts` - Hook managing editor lifecycle
- `MessageBridge.ts` - Cross-iframe communication
- `StylePanelContext.tsx` - Instance-specific store provider
- `IsolatedHTMLRenderer.tsx` - Main editor component
