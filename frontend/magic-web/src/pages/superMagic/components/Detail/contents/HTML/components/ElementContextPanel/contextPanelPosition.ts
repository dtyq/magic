import type { ElementRect } from "../SelectionOverlay/types"
import { CONTEXT_TOOLBAR_TOP_CONTROL_CLEARANCE } from "../SelectionOverlay/utils/rotateHandleLayout"

export { CONTEXT_TOOLBAR_TOP_CONTROL_CLEARANCE }

export type ContextPanelPlacement = "right" | "left" | "bottom" | "top"

interface PanelPosition {
	left: number
	top: number
	width: number
	maxHeight: number
	placement: ContextPanelPlacement
}

export interface ContextToolbarPosition {
	left: number
	top: number
	width: number
	placement: "bottom" | "top"
}

interface PanelCandidate extends PanelPosition {
	/** Whether the candidate has enough room for a useful panel. */
	usable: boolean
	/** The visible area of the panel inside the canvas. */
	area: number
	/** The area that would cover the selected element. */
	overlapArea: number
	/** The order used for the requested right → left → bottom → top preference. */
	priority: number
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max)
}

/** Clip the canvas bounds to the visible browser viewport. */
export function getContextViewport(
	boundary?: { left: number; top: number; right?: number; width: number; height: number } | null,
): { left: number; top: number; width: number; height: number } {
	if (typeof window === "undefined") return { left: 0, top: 0, width: 0, height: 0 }
	if (!boundary || boundary.width <= 0 || boundary.height <= 0) {
		return { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight }
	}
	const left = Math.max(0, boundary.left)
	const top = Math.max(0, boundary.top)
	const right = Math.min(window.innerWidth, boundary.right ?? boundary.left + boundary.width)
	const bottom = Math.min(window.innerHeight, boundary.top + boundary.height)
	return {
		left,
		top,
		width: Math.max(0, right - left),
		height: Math.max(0, bottom - top),
	}
}

/** Ignore the first unmeasured frame so a 0-width box is not treated as 680. */
export function getMeasuredToolbarSize(
	panelRect: { width: number; height: number } | null | undefined,
	maxWidth: number,
	minHeight: number,
): { width: number; height: number } | null {
	const width = panelRect?.width ?? 0
	const height = panelRect?.height ?? 0
	if (width <= 0) return null
	return {
		width: Math.min(width, maxWidth),
		height: Math.max(minHeight, height),
	}
}

function getOverlapArea(
	first: { left: number; top: number; width: number; height: number },
	second: { left: number; top: number; width: number; height: number },
): number {
	const overlapWidth = Math.max(
		0,
		Math.min(first.left + first.width, second.left + second.width) -
			Math.max(first.left, second.left),
	)
	const overlapHeight = Math.max(
		0,
		Math.min(first.top + first.height, second.top + second.height) -
			Math.max(first.top, second.top),
	)
	return overlapWidth * overlapHeight
}

export function getContextPanelPosition(
	anchor: ElementRect,
	panel: { width: number; height: number },
	viewport: { left?: number; top?: number; width: number; height: number },
	gap = 8,
): PanelPosition {
	const viewportLeft = viewport.left ?? 0
	const viewportTop = viewport.top ?? 0
	const viewportRight = viewportLeft + viewport.width
	const viewportBottom = viewportTop + viewport.height
	const inset = 8
	const availableViewportWidth = Math.max(0, viewport.width - inset * 2)
	const availableViewportHeight = Math.max(0, viewport.height - inset * 2)
	const desiredWidth = Math.min(panel.width, availableViewportWidth)
	const desiredHeight = Math.min(panel.height, availableViewportHeight)
	const minUsableHeight = Math.min(120, desiredHeight)
	const minRenderableHeight = Math.min(48, desiredHeight)
	const maxPanelWidth = Math.max(1, availableViewportWidth)
	const maxPanelHeight = Math.max(1, availableViewportHeight)
	const viewportBounds = {
		left: viewportLeft + inset,
		top: viewportTop + inset,
		right: viewportRight - inset,
		bottom: viewportBottom - inset,
	}
	const spaces = {
		right: Math.max(0, viewportBounds.right - anchor.left - anchor.width - gap),
		left: Math.max(0, anchor.left - viewportBounds.left - gap),
		bottom: Math.max(0, viewportBottom - anchor.top - anchor.height - gap),
		top: Math.max(0, anchor.top - viewportTop - gap),
	}
	const rightWidth = Math.max(1, Math.min(desiredWidth, spaces.right))
	const leftWidth = Math.max(1, Math.min(desiredWidth, spaces.left))

	// Keep the measured height for side placements. createCandidate clamps the
	// top coordinate into the viewport, allowing the panel to move upward or
	// downward instead of being shortened just because it is near an edge.
	const createCandidate = (
		placement: ContextPanelPlacement,
		width: number,
		height: number,
		left: number,
		top: number,
		priority: number,
		usable: boolean,
	): PanelCandidate => {
		const boundedWidth = Math.max(1, Math.min(width, maxPanelWidth))
		const boundedHeight = Math.max(1, Math.min(height, maxPanelHeight))
		const boundedLeft = clamp(left, viewportBounds.left, viewportBounds.right - boundedWidth)
		const boundedTop = clamp(top, viewportBounds.top, viewportBounds.bottom - boundedHeight)
		const panel = {
			left: boundedLeft,
			top: boundedTop,
			width: boundedWidth,
			height: boundedHeight,
		}

		return {
			placement,
			left: boundedLeft,
			top: boundedTop,
			width: boundedWidth,
			maxHeight: boundedHeight,
			usable,
			area: boundedWidth * boundedHeight,
			overlapArea: getOverlapArea(panel, anchor),
			priority,
		}
	}

	const candidates: PanelCandidate[] = [
		createCandidate(
			"right",
			rightWidth,
			desiredHeight,
			anchor.left + anchor.width + gap,
			anchor.top,
			0,
			spaces.right >= desiredWidth && desiredHeight >= minRenderableHeight,
		),
		createCandidate(
			"left",
			leftWidth,
			desiredHeight,
			anchor.left - leftWidth - gap,
			anchor.top,
			1,
			spaces.left >= desiredWidth && desiredHeight >= minRenderableHeight,
		),
		createCandidate(
			"bottom",
			Math.min(desiredWidth, maxPanelWidth),
			Math.max(1, Math.min(desiredHeight, spaces.bottom)),
			anchor.left,
			anchor.top + anchor.height + gap,
			2,
			desiredWidth > 0 && spaces.bottom >= minUsableHeight,
		),
		createCandidate(
			"top",
			Math.min(desiredWidth, maxPanelWidth),
			Math.max(1, Math.min(desiredHeight, spaces.top)),
			anchor.left,
			anchor.top - Math.max(1, Math.min(desiredHeight, spaces.top)) - gap,
			3,
			desiredWidth > 0 && spaces.top >= minUsableHeight,
		),
	]

	// Keep the right → left preference whenever a side can fit the full panel
	// width and has enough room for a useful scrollable panel. Otherwise choose
	// the vertical side with more room so the panel keeps its width.
	const noOverlapCandidates = candidates.filter((item) => item.overlapArea === 0)
	const verticalCandidates = noOverlapCandidates.filter(
		(item) =>
			(item.placement === "bottom" || item.placement === "top") &&
			item.maxHeight >= minRenderableHeight,
	)
	const usableCandidate = noOverlapCandidates
		.filter((item) => item.usable)
		.sort((left, right) => left.priority - right.priority)[0]
	const preferredVerticalCandidate = verticalCandidates.sort(
		(left, right) =>
			right.maxHeight - left.maxHeight ||
			(left.placement === "bottom" ? -1 : 1) - (right.placement === "bottom" ? -1 : 1) ||
			left.priority - right.priority,
	)[0]
	const candidate =
		usableCandidate ||
		// When a side cannot fit the full panel width, keep the width intact and
		// prefer a vertical placement with a scrollable height instead.
		preferredVerticalCandidate ||
		noOverlapCandidates.sort(
			(left, right) => right.area - left.area || left.priority - right.priority,
		)[0] ||
		candidates.sort(
			(left, right) =>
				left.overlapArea - right.overlapArea ||
				right.area - left.area ||
				left.priority - right.priority,
		)[0]

	return {
		left: candidate.left,
		top: candidate.top,
		width: candidate.width,
		maxHeight: candidate.maxHeight,
		placement: candidate.placement,
	}
}

/**
 * Position the compact element toolbar above the selection whenever possible.
 * Use the bottom side only when the toolbar cannot fit above. The toolbar
 * remains horizontally centered. If the canvas is narrower than the minimum
 * width, keep that width and clamp to the window instead of crushing controls.
 */
export function getContextToolbarPosition(
	anchor: ElementRect,
	toolbar: { width: number; height: number },
	viewport: { left?: number; top?: number; width: number; height: number },
	gap = 8,
	options?: { minWidth?: number; windowSize?: { width: number; height: number } },
): ContextToolbarPosition {
	const viewportLeft = viewport.left ?? 0
	const viewportTop = viewport.top ?? 0
	const inset = 8
	const viewportRight = viewportLeft + viewport.width
	const viewportBottom = viewportTop + viewport.height
	const bounds = {
		left: viewportLeft + inset,
		top: viewportTop + inset,
		right: viewportRight - inset,
		bottom: viewportBottom - inset,
	}
	const canvasInnerWidth = Math.max(0, bounds.right - bounds.left)
	const windowWidth =
		options?.windowSize?.width ??
		(typeof window !== "undefined" ? window.innerWidth : viewport.width)
	const windowInnerWidth = Math.max(1, windowWidth - inset * 2)
	const minWidth = options?.minWidth ?? 1
	const width = Math.max(minWidth, Math.min(Math.max(1, toolbar.width), windowInnerWidth))
	const height = Math.max(1, Math.min(toolbar.height, bounds.bottom - bounds.top))
	const overflowX = width > canvasInnerWidth
	const horizontal = overflowX
		? { left: inset, right: windowWidth - inset }
		: { left: bounds.left, right: bounds.right }
	const centeredLeft = anchor.left + anchor.width / 2 - width / 2
	const clampedLeft = clamp(
		centeredLeft,
		horizontal.left,
		Math.max(horizontal.left, horizontal.right - width),
	)
	const bottomTop = anchor.top + anchor.height + gap
	const topTop = anchor.top - height - gap - CONTEXT_TOOLBAR_TOP_CONTROL_CLEARANCE
	const fitsAbove = topTop >= bounds.top
	const fitsBelow = bottomTop + height <= bounds.bottom
	const visibleAbove = Math.max(
		0,
		anchor.top - bounds.top - gap - CONTEXT_TOOLBAR_TOP_CONTROL_CLEARANCE,
	)
	const visibleBelow = Math.max(0, bounds.bottom - anchor.top - anchor.height - gap)
	const placement = fitsAbove
		? "top"
		: fitsBelow
			? "bottom"
			: visibleAbove >= visibleBelow
				? "top"
				: "bottom"
	const top =
		placement === "top"
			? clamp(topTop, bounds.top, bounds.bottom - height)
			: clamp(bottomTop, bounds.top, bounds.bottom - height)

	return {
		left: clampedLeft,
		top,
		width,
		placement,
	}
}
