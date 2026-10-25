const FILE_LIST_AREA_SELECTOR = '[data-testid="topic-files-list-area"]'

export type LocatedFileReveal = "visible" | "outside" | "missing"

interface ViewportRect {
	top: number
	bottom: number
	height: number
}

/**
 * A located row is visible when it overlaps the file-list viewport.
 * The required overlap is the smaller of the two heights so a short list still counts.
 */
export function isFileRowInViewport(row: ViewportRect, container: ViewportRect): boolean {
	const overlap = Math.min(row.bottom, container.bottom) - Math.max(row.top, container.top)
	if (overlap <= 0) return false
	const visibleTarget = Math.min(row.height, container.height)
	return overlap + 1 >= visibleTarget
}

/**
 * Center a file row inside the project file list only.
 * Scrolling the row itself would also move the page and the side panel.
 */
export function scrollFileRowIntoContainer(container: HTMLElement, row: HTMLElement): boolean {
	const rowRect = row.getBoundingClientRect()
	const containerRect = container.getBoundingClientRect()
	if (rowRect.height <= 0 || containerRect.height <= 0) return false

	const delta = rowRect.top + rowRect.height / 2 - (containerRect.top + containerRect.height / 2)
	const maxScroll = container.scrollHeight - container.clientHeight
	if (Math.abs(delta) >= 1 && maxScroll > 0) {
		container.scrollTop = Math.min(maxScroll, Math.max(0, container.scrollTop + delta))
	}

	return isFileRowInViewport(row.getBoundingClientRect(), container.getBoundingClientRect())
}

/**
 * Escape a file id for a CSS attribute selector.
 * CSS.escape is available in the Chrome 100 baseline; the replace path covers non-browser tests.
 */
function escapeFileIdAttribute(fileId: string): string {
	if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
		return CSS.escape(fileId)
	}
	return fileId.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
}

/**
 * Bring an uploaded file into the project file-list viewport.
 * Look the row up inside the file-list container: the same file id is also mounted on the
 * detail header, and selecting that element would read as a finished locate while the file
 * tree never moved. A missing container means the list itself is not rendered yet.
 * "missing" means no row inside the list yet, which happens while the virtualizer has not reached it.
 * "outside" means the row is mounted but still not visible, so locate must not report success.
 */
export function revealLocatedFileRow(fileId: string): LocatedFileReveal {
	const container = document.querySelector(FILE_LIST_AREA_SELECTOR)
	if (!(container instanceof HTMLElement)) return "missing"
	const row = container.querySelector(`[data-file-id="${escapeFileIdAttribute(fileId)}"]`)
	if (!(row instanceof HTMLElement)) return "missing"
	return scrollFileRowIntoContainer(container, row) ? "visible" : "outside"
}
