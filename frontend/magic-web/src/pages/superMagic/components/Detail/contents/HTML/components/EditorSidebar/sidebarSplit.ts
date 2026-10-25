export const STRUCTURE_MIN_HEIGHT = 160
export const STYLES_MIN_HEIGHT = 240
/** Floor for More Styles tabs plus panel padding. */
export const STYLES_MIN_WIDTH = 320
export const SIDEBAR_MIN_WIDTH = STYLES_MIN_WIDTH
export const SIDEBAR_MAX_WIDTH = 520
export const SIDEBAR_DEFAULT_WIDTH = 400
export const DEFAULT_STRUCTURE_RATIO = 0.5
/** Matches the splitter hairline in the rail. */
export const SPLITTER_HEIGHT = 1

export interface SidebarSectionLayout {
	structureHeight: number
	stylesHeight: number
	showSplitter: boolean
}

/**
 * Split the rail between two sections.
 * Prefer a 1:1 share of the available height, then clamp to each minimum.
 */
export function getSidebarSectionLayout(
	availableHeight: number,
	structureRatio: number,
	structureExpanded: boolean,
	stylesExpanded: boolean,
): SidebarSectionLayout {
	const available = Math.max(0, availableHeight)
	if (!structureExpanded && !stylesExpanded) {
		return { structureHeight: 0, stylesHeight: 0, showSplitter: false }
	}
	if (!structureExpanded) {
		return { structureHeight: 0, stylesHeight: available, showSplitter: false }
	}
	if (!stylesExpanded) {
		return { structureHeight: available, stylesHeight: 0, showSplitter: false }
	}

	const minTotal = STRUCTURE_MIN_HEIGHT + STYLES_MIN_HEIGHT
	if (available < minTotal) {
		const scale = available === 0 ? 0 : available / minTotal
		return {
			structureHeight: STRUCTURE_MIN_HEIGHT * scale,
			stylesHeight: STYLES_MIN_HEIGHT * scale,
			showSplitter: true,
		}
	}

	const ratio = clamp(structureRatio, 0, 1)
	let structureHeight = available * ratio
	let stylesHeight = available - structureHeight

	if (structureHeight < STRUCTURE_MIN_HEIGHT) {
		structureHeight = STRUCTURE_MIN_HEIGHT
		stylesHeight = available - structureHeight
	}
	if (stylesHeight < STYLES_MIN_HEIGHT) {
		stylesHeight = STYLES_MIN_HEIGHT
		structureHeight = available - stylesHeight
	}

	return { structureHeight, stylesHeight, showSplitter: true }
}

export function getStructureRatioFromPointer(
	pointerY: number,
	railTop: number,
	availableHeight: number,
): number {
	if (availableHeight <= 0) return DEFAULT_STRUCTURE_RATIO
	return clamp((pointerY - railTop) / availableHeight, 0, 1)
}

function clamp(value: number, min: number, max: number) {
	return Math.min(Math.max(value, min), max)
}
