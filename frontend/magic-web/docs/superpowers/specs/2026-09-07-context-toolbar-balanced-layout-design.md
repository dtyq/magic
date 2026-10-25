# Context Toolbar Balanced Layout Design

## Goal
Redesign the HTML editor floating context toolbar (`ElementContextPanel` + `StylePanel` context variant) layout model to eliminate right-side empty space and layout thrashing, using an atomic tool-group partitioning approach instead of relying on CSS flex-wrap with hardcoded `max-width`.

## Problem Statement
When a text element is selected in the HTML editor, the context toolbar displays many editing tools (actions, font size, font size adjuster, line height, formatting tools, text align, color picker, background image, more styles).
1. The previous layout applied `max-width: 680px` and `flex-wrap: wrap`. In CSS, `fit-content` calculates width based on the unwrapped `max-content` length. When `max-content > 680px`, the container is clamped to `680px`, even if the wrapped rows only need ~380px each. This leaves massive empty white space on the right of both rows.
2. Attempting to measure DOM children dynamically and write back computed `width` into the floating container creates layout oscillations, coupling `ElementContextPanel` to inner toolbar DOM structures.

## Architecture & Principles
Follow SOLID, KISS, and DRY principles:
1. **Single Responsibility**:
   - `ElementContextPanel`: Pure floating placement manager. Computes `left`, `top`, `placement`, viewport clamping, and entrance/exit animations. It does NOT measure toolbar children or manipulate toolbar row structures.
   - `ContextToolbarLayout`: Manages the grouping and partitioning of context tools into one or two rows based on atomic tool groups.
2. **Atomic Tool Groups**:
   Tools are grouped into indivisible functional units:
   - `actions`: element operations (duplicate, delete, up, down)
   - `typographySizes`: font size + adjuster + line height
   - `formatting`: bold, italic, underline, strikethrough
   - `alignment`: text align / flex alignment
   - `appearance`: color picker + background image
   - `more`: more styles popover trigger
3. **Partitioning Model (Path B1)**:
   - Each tool group has an intrinsic estimated width (e.g. actions ~120px, sizes ~200px, format ~112px, align ~96px, appearance ~64px, more ~72px).
   - If the total width of active groups is within `MAX_ROW_WIDTH` (680px) and canvas width, render as a single `flex-row`.
   - If total width exceeds `MAX_ROW_WIDTH`, partition the active groups into two rows at group boundaries minimizing `max(Row1.width, Row2.width)`.
   - In standard text selection, Row 1 contains `actions` + `typographySizes` (~320px) and Row 2 contains `formatting` + `alignment` + `appearance` + `more` (~344px).
   - The container renders as `flex flex-col w-fit items-start gap-1`. CSS naturally shrink-wraps both rows to `max(Row1, Row2)`, leaving 0 empty space without any JS DOM measurement.

## Testing Strategy
- Unit test `partitionContextToolGroups` with various capabilities (text element with all typography tools, non-text element with only actions, container with flex alignment).
- Verify single-row rendering when tool count is low, and balanced two-row rendering when total width exceeds row limit.
- Verify `ElementContextPanel` renders without setting manual inline width.
