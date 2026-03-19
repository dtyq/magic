# Zoom Optimization for Selection Overlay

## Overview
Optimized the zoom functionality to provide a better user experience when scaling HTML content, with intelligent centering and improved selection box tracking.

## Key Features

### 1. Zoom Centering
When zooming, the zoom center point is intelligently determined:
- **With Selected Element**: Zooms centered on the selected element
- **Without Selected Element**: Zooms centered on the current viewport center

This provides a more intuitive zoom experience as the content stays focused on what the user is looking at.

### 2. Selection Box Visibility Management
Selection boxes are hidden during viewport transformations to avoid visual lag:
- **During Scaling**: Selection boxes are immediately hidden (display: none)
- **During Scrolling**: Selection boxes are immediately hidden (display: none)
- **After Operations Stop**: Selection boxes are shown and positions updated (150ms delay)
- **Instant Toggle**: No transition effects for cleaner visual experience

### 3. Performance Optimizations
- **Minimal Debouncing**: Scale calculations use 0ms debounce during manual zoom for instant response
- **Transform Transitions**: Added 50ms ease-out transition on iframe transform for smoother scaling
- **Event-Driven Updates**: Selection box updates triggered only after operations complete

## Implementation Details

### Modified Files

#### 1. `hooks/useZoomControls.ts`
- Added `selectedElementRect` prop to track selected element position
- Implemented intelligent zoom centering logic
- Calculates scroll position to maintain zoom center point
- Adjusts scroll after scale change using requestAnimationFrame

#### 2. `hooks/useScaleSync.ts` (New)
- Dedicated hook for managing selection box visibility during scaling
- Returns `isScaling` state to control selection box visibility
- Uses 150ms delay to detect when scaling has stopped
- Forces state update after scaling completes

#### 3. `hooks/useScrollSync.ts` (Modified)
- Enhanced to manage selection box visibility during scrolling
- Returns `isScrolling` state to control selection box visibility
- Uses 150ms delay to detect when scrolling has stopped
- Forces state update after scrolling completes

#### 4. `components/SelectionOverlay/SelectionOverlay.tsx`
- Added `onSelectedElementChange` callback prop
- Integrated `useScaleSync` and enhanced `useScrollSync` hooks
- Combines `isScaling` and `isScrolling` states to determine visibility
- Instant show/hide using `display: none` (no transitions)

#### 5. `IsolatedHTMLRenderer.tsx`
- Added `selectedElementRect` state tracking
- Passes selected element rect to zoom controls
- Connects selection overlay to zoom controls via callback

#### 6. `hooks/useIframeScaling.ts`
- Optimized debounce timing for manual zoom (0ms vs 16ms)
- Improved responsiveness during user-initiated scaling

## User Experience Improvements

### Before
- Selection boxes lagged behind during zoom and scroll
- Zoom centered on top-left corner
- Visual glitches and stuttering when rapidly changing scale or scrolling

### After
- Selection boxes instantly hidden during zoom and scroll (no lag visible)
- Zoom intelligently centered on selected element or viewport center
- Selection boxes reappear with correct positions after operations stop
- Clean visual experience with no glitches or stuttering
- Instant toggle (no transition effects) for cleaner perception

## Technical Benefits
- Separates scaling visual feedback from position calculations
- Reduces computational overhead during rapid scale changes
- Maintains accurate final position after scaling completes
- Provides better perceived performance

## Future Enhancements
- Consider adding keyboard shortcuts for zoom (Ctrl/Cmd + Mouse Wheel)
- Add zoom level indicators
- Support pinch-to-zoom on touch devices
- Add animation curves for different zoom speeds
