export type ElementEditPopoverPlacement = "right" | "left" | "bottom" | "top"

interface RectLike {
	left: number
	top: number
	width: number
	height: number
}

export interface ElementEditPopoverPosition {
	left: number
	top: number
	width: number
	height: number
	placement: ElementEditPopoverPlacement
}

interface Candidate extends ElementEditPopoverPosition {
	overlapArea: number
	priority: number
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max)
}

function getOverlapArea(first: RectLike, second: RectLike): number {
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

/**
 * Keep the instruction popover inside its stable canvas and away from the target.
 * The target may be inside a scaled overlay, so this function only works with
 * coordinates that already belong to the popover's containing element.
 */
export function getElementEditPopoverPosition(
	box: RectLike,
	container: { width: number; height: number },
	popover: { width: number; height: number },
	gap = 8,
	inset = 4,
): ElementEditPopoverPosition {
	// A portal host can report zero dimensions for one render while it is being
	// attached. Keep the measured popover size instead of collapsing it to 1px.
	const hasContainerWidth = container.width > 0
	const hasContainerHeight = container.height > 0
	const maxWidth = hasContainerWidth
		? Math.max(1, container.width - inset * 2)
		: Math.max(1, popover.width)
	const maxHeight = hasContainerHeight
		? Math.max(1, container.height - inset * 2)
		: Math.max(1, popover.height)
	const width = Math.min(Math.max(1, popover.width), maxWidth)
	const naturalHeight = Math.max(1, popover.height)
	const height = Math.min(naturalHeight, maxHeight)
	const bounds = {
		left: hasContainerWidth ? inset : 0,
		top: hasContainerHeight ? inset : 0,
		right: hasContainerWidth ? Math.max(inset, container.width - inset) : width,
		bottom: hasContainerHeight ? Math.max(inset, container.height - inset) : height,
	}
	const target = box

	const createCandidate = (
		placement: ElementEditPopoverPlacement,
		left: number,
		top: number,
		priority: number,
	): Candidate => {
		const boundedLeft = clamp(left, bounds.left, Math.max(bounds.left, bounds.right - width))
		const boundedTop = clamp(top, bounds.top, Math.max(bounds.top, bounds.bottom - height))
		const rect = { left: boundedLeft, top: boundedTop, width, height }
		return {
			...rect,
			placement,
			overlapArea: getOverlapArea(rect, target),
			priority,
		}
	}

	const candidates = [
		createCandidate("right", box.left + box.width + gap, box.top, 0),
		createCandidate("left", box.left - width - gap, box.top, 1),
		createCandidate("bottom", box.left, box.top + box.height + gap, 2),
		createCandidate("top", box.left, box.top - height - gap, 3),
	]
	const topCandidate = candidates[3]
	const spaceAbove = box.top - bounds.top - gap
	const spaceBelow = bounds.bottom - (box.top + box.height) - gap
	const shouldPreferTop =
		naturalHeight <= maxHeight && spaceBelow < naturalHeight && spaceAbove >= naturalHeight

	const fitsBounds = (candidate: Candidate) =>
		candidate.left >= bounds.left &&
		candidate.top >= bounds.top &&
		candidate.left + candidate.width <= bounds.right &&
		candidate.top + candidate.height <= bounds.bottom
	const orderedCandidates = shouldPreferTop
		? [topCandidate, ...candidates.filter((candidate) => candidate !== topCandidate)]
		: candidates
	const targetFreeCandidates = orderedCandidates.filter(
		(candidate) => fitsBounds(candidate) && candidate.overlapArea === 0,
	)
	const candidate =
		targetFreeCandidates[0] ??
		orderedCandidates
			.slice()
			.sort(
				(left, right) =>
					left.overlapArea - right.overlapArea || left.priority - right.priority,
			)[0]

	return candidate
}
