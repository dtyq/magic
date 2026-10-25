# Context Toolbar Balanced Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign context toolbar layout into an atomic tool-group partitioning model so it renders naturally in compact single- or double-row format with zero excess whitespace and no layout oscillation.

**Architecture:** Split tools into semantic groups with intrinsic weight models. Run synchronous partition in `StylePanel (variant="context")` to output 1 or 2 `flex w-fit` rows inside a column container. Strip out manual width measurements and inline width overrides in `ElementContextPanel`.

**Tech Stack:** React 19, TypeScript, Vitest, Tailwind CSS.

## Global Constraints
- React 19 hooks and composition principles.
- Frontend comments in English, under 72 chars.
- Code adhering to DRY, KISS, SOLID, YAGNI.
- Files under 500 lines or decomposed into focused submodules.

---

### Task 1: Create Tool Group Partitioning Utility and Unit Tests
- [ ] Create `contextToolbarPartition.ts` defining atomic tool group types, weights, and `partitionContextToolGroups` algorithm.
- [ ] Create `contextToolbarPartition.test.ts` testing 1-row cases (few tools, container, image) and balanced 2-row cases (full typography text).
- [ ] Run Vitest to verify all partition unit tests pass.

### Task 2: Refactor Context Tool Layout in StylePanel
- [ ] In `StylePanel.tsx`, build active tool groups for `variant === "context"`.
- [ ] Render grouped rows inside a `flex flex-col w-fit items-start gap-1` layout when multi-row, or single `flex w-fit items-center gap-1` row when single-row.
- [ ] Preserve `ContextToolbarMotion` animation items within the rows.
- [ ] Update `StylePanel.test.tsx` to assert on multi-row context structure.

### Task 3: Simplify ElementContextPanel and contextPanelPosition
- [ ] Remove obsolete DOM child measuring (`getFittedContextToolbarWidth`, `getBalancedWrapWidth`, `getTightWrappedWidth`) from `contextPanelPosition.ts` and `contextPanelPosition.test.ts`.
- [ ] Simplify `ElementContextPanel.tsx` to measure the panel's bounding box and compute position, removing inline `width` overrides and DOM scraping.
- [ ] Run `ElementContextPanel.test.tsx` to verify clean layout and position calculation.

### Task 4: Full Verification and Regression Testing
- [ ] Run all targeted Vitest test suites.
- [ ] Verify no linter warnings or TypeScript type errors.
