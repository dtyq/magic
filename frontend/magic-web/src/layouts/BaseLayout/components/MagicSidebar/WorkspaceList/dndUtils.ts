import type { SidebarDropPosition } from "./types"

export const INSERT_LINE_COLOR = "#b9dcff"
export const EDGE_SCROLL_ZONE = 56
export const MAX_EDGE_SCROLL_SPEED = 14
/** Keeps a small top edge for before when dragging downward. */
export const DOWNWARD_DROP_BEFORE_ZONE_PX = 3

/** Returns the insertion side for a row and pointer Y coordinate. */
export function getDropPosition(
	target: HTMLElement,
	clientY: number,
	lowerBiasPx = 0,
): SidebarDropPosition {
	const rect = target.getBoundingClientRect()
	const midpoint = rect.top + rect.height / 2
	return clientY < midpoint - lowerBiasPx ? "before" : "after"
}

/** Resolves project insertion direction with a small downward-drag top zone. */
export function getProjectDropPosition(
	target: HTMLElement,
	clientY: number,
	sourceIndex?: number,
	targetIndex?: number,
) {
	if (sourceIndex !== undefined && targetIndex !== undefined && sourceIndex < targetIndex) {
		const rect = target.getBoundingClientRect()
		return clientY < rect.top + DOWNWARD_DROP_BEFORE_ZONE_PX ? "before" : "after"
	}
	return getDropPosition(target, clientY)
}

/** Returns one shared Y coordinate for both sides of the same item gap. */
export function getIndicatorLineY(
	target: HTMLElement,
	position: SidebarDropPosition,
	container?: HTMLElement | null,
) {
	const targetRect = target.getBoundingClientRect()
	const dropType = target.dataset.sidebarDropType || target.dataset.collapsedSidebarDndDropType
	const targetSelector = dropType
		? `[data-sidebar-drop-type="${dropType}"], [data-collapsed-sidebar-dnd-drop-type="${dropType}"]`
		: ""
	const targets =
		container && targetSelector
			? Array.from(container.querySelectorAll<HTMLElement>(targetSelector))
			: []
	const targetIndex = targets.indexOf(target)
	const sibling =
		targetIndex !== -1
			? targets[position === "before" ? targetIndex - 1 : targetIndex + 1]
			: position === "before"
				? target.previousElementSibling
				: target.nextElementSibling
	if (!(sibling instanceof HTMLElement)) {
		return position === "before" ? targetRect.top : targetRect.bottom
	}

	const siblingDropType =
		sibling.dataset.sidebarDropType || sibling.dataset.collapsedSidebarDndDropType
	if (!dropType || siblingDropType !== dropType) {
		return position === "before" ? targetRect.top : targetRect.bottom
	}

	// 保留的离屏交互行可能成为 DOM 邻居；只有真实相邻的虚拟行才能共用间隙坐标。
	const rowIndex = target.closest<HTMLElement>("[data-index]")?.dataset.index
	const siblingIndex = sibling.closest<HTMLElement>("[data-index]")?.dataset.index
	if (
		rowIndex !== undefined &&
		siblingIndex !== undefined &&
		Math.abs(Number(rowIndex) - Number(siblingIndex)) !== 1
	)
		return position === "before" ? targetRect.top : targetRect.bottom

	const siblingRect = sibling.getBoundingClientRect()
	return position === "before"
		? (siblingRect.bottom + targetRect.top) / 2
		: (targetRect.bottom + siblingRect.top) / 2
}

/** Returns the nearest project row when the pointer is in list padding or a row gap. */
export function getNearestProjectTarget(
	projectList: HTMLElement,
	clientY: number,
	excludedProjectId: string | undefined,
	rowSelector: string,
	projectIdKey: string,
) {
	const viewport = (
		projectList.closest<HTMLElement>("[data-project-scroll-container]") ??
		projectList.querySelector<HTMLElement>("[data-project-scroll-container]") ??
		projectList.closest<HTMLElement>("[data-workspaces-scroll-container]")
	)?.getBoundingClientRect()
	if (viewport && (clientY < viewport.top || clientY > viewport.bottom)) return null
	const projectTargets = Array.from(
		projectList.querySelectorAll<HTMLElement>(rowSelector),
	).filter((target) => target.dataset[projectIdKey] !== excludedProjectId)

	let nearestTarget: HTMLElement | null = null
	let nearestDistance = Number.POSITIVE_INFINITY
	for (const target of projectTargets) {
		const rect = target.getBoundingClientRect()
		if (viewport && (rect.bottom <= viewport.top || rect.top >= viewport.bottom)) continue
		if (clientY >= rect.top && clientY <= rect.bottom) return target
		const distance = Math.abs(clientY - (rect.top + rect.height / 2))
		if (distance < nearestDistance) {
			nearestDistance = distance
			nearestTarget = target
		}
	}
	return nearestTarget
}

/** Returns the nearest workspace row when the pointer is in a row gap. */
export function getNearestWorkspaceTarget(
	workspaceList: HTMLElement | null,
	clientY: number,
	excludedWorkspaceId: string | undefined,
	rowSelector: string,
	workspaceIdKey: string,
) {
	if (!workspaceList) return null
	const listRect = workspaceList.getBoundingClientRect()
	if (clientY < listRect.top || clientY > listRect.bottom) return null

	const workspaceTargets = Array.from(
		workspaceList.querySelectorAll<HTMLElement>(rowSelector),
	).filter((target) => target.dataset[workspaceIdKey] !== excludedWorkspaceId)

	let nearestTarget: HTMLElement | null = null
	let nearestDistance = Number.POSITIVE_INFINITY
	for (const target of workspaceTargets) {
		const rect = target.getBoundingClientRect()
		if (clientY >= rect.top && clientY <= rect.bottom) return target
		const distance = Math.abs(clientY - (rect.top + rect.height / 2))
		if (distance < nearestDistance) {
			nearestDistance = distance
			nearestTarget = target
		}
	}
	return nearestTarget
}

/** Moves one item while preserving the requested insertion side. */
export function insertAtPosition<T>(
	items: T[],
	sourceIndex: number,
	targetIndex: number,
	position: SidebarDropPosition,
) {
	const next = [...items]
	const [item] = next.splice(sourceIndex, 1)
	if (!item) return items
	const adjustedTarget = sourceIndex < targetIndex ? targetIndex - 1 : targetIndex
	const insertIndex = position === "after" ? adjustedTarget + 1 : adjustedTarget
	next.splice(Math.max(0, Math.min(insertIndex, next.length)), 0, item)
	return next
}

/** Resolves the item that should precede a dragged item after insertion. */
export function getPredecessorId<T extends { id: string }>(
	items: T[],
	sourceId: string,
	targetId: string | undefined,
	position: SidebarDropPosition,
) {
	const remaining = items.filter((item) => item.id !== sourceId)
	if (!targetId) return remaining.at(-1)?.id ?? null
	const targetIndex = remaining.findIndex((item) => item.id === targetId)
	if (targetIndex === -1) return remaining.at(-1)?.id ?? null
	return position === "after"
		? remaining[targetIndex]?.id || null
		: remaining[targetIndex - 1]?.id || null
}

/** Resolves the item that should follow a dragged item after insertion. */
export function getSuccessorId<T extends { id: string }>(
	items: T[],
	sourceId: string,
	targetId: string | undefined,
	position: SidebarDropPosition,
) {
	const remaining = items.filter((item) => item.id !== sourceId)
	if (!targetId) return remaining[0]?.id ?? null
	const targetIndex = remaining.findIndex((item) => item.id === targetId)
	if (targetIndex === -1) return remaining[0]?.id ?? null
	return position === "before"
		? remaining[targetIndex]?.id || null
		: remaining[targetIndex + 1]?.id || null
}

/** Detects a pin-group boundary crossing that requires user confirmation. */
export function getProjectPinBoundaryAction(
	items: Array<{ id: string; is_pinned?: boolean }>,
	sourceId: string,
	targetId: string | undefined,
	position: SidebarDropPosition,
) {
	const source = items.find((item) => item.id === sourceId)
	if (!source) return null
	const remaining = items.filter((item) => item.id !== sourceId)
	const targetIndex = targetId ? remaining.findIndex((item) => item.id === targetId) : -1
	const insertIndex =
		targetIndex === -1 ? remaining.length : position === "after" ? targetIndex + 1 : targetIndex
	const pinnedCount = remaining.filter((item) => Boolean(item.is_pinned)).length
	if (!source.is_pinned && insertIndex < pinnedCount) return "pin" as const
	// The boundary index is still the last position of the pinned group.
	if (source.is_pinned && insertIndex > pinnedCount) return "unpin" as const
	return null
}

/** Returns true when an unpinned project is inserted exactly at the pin-group boundary. */
export function isProjectPinGroupBoundaryInsertion(
	items: Array<{ id: string; is_pinned?: boolean }>,
	sourceId: string,
	targetId: string | undefined,
	position: SidebarDropPosition,
) {
	const source = items.find((item) => item.id === sourceId)
	if (!source || source.is_pinned) return false

	const remaining = items.filter((item) => item.id !== sourceId)
	const targetIndex = targetId ? remaining.findIndex((item) => item.id === targetId) : -1
	const pinnedCount = remaining.filter((item) => Boolean(item.is_pinned)).length
	if (targetIndex === -1) return remaining.length === pinnedCount

	const insertIndex = position === "after" ? targetIndex + 1 : targetIndex
	return insertIndex === pinnedCount
}

/** Returns true when the requested insertion leaves the source unchanged. */
export function isNoOpInsertion(
	sourceIndex: number,
	targetIndex: number,
	position: SidebarDropPosition,
	itemCount: number,
) {
	const adjustedTarget = sourceIndex < targetIndex ? targetIndex - 1 : targetIndex
	const insertIndex = position === "after" ? adjustedTarget + 1 : adjustedTarget
	return Math.max(0, Math.min(insertIndex, itemCount - 1)) === sourceIndex
}

/** Returns a signed scroll speed from the pointer's distance to a container edge. */
export function getEdgeScrollSpeed(container: HTMLElement, clientY: number) {
	const rect = container.getBoundingClientRect()
	if (clientY < rect.top || clientY > rect.bottom) return 0

	const topDistance = clientY - rect.top
	if (topDistance < EDGE_SCROLL_ZONE) {
		return -Math.max(2, MAX_EDGE_SCROLL_SPEED * (1 - topDistance / EDGE_SCROLL_ZONE))
	}

	const bottomDistance = rect.bottom - clientY
	if (bottomDistance < EDGE_SCROLL_ZONE) {
		return Math.max(2, MAX_EDGE_SCROLL_SPEED * (1 - bottomDistance / EDGE_SCROLL_ZONE))
	}

	return 0
}

/** Creates a native drag preview with the dragged item's type icon. */
export function createSidebarDragImage(
	label: string,
	type: "workspace" | "project" | "project-list",
) {
	if (typeof document === "undefined") return null

	const image = document.createElement("div")
	const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg")
	const iconSize = 16
	icon.setAttribute("width", String(iconSize))
	icon.setAttribute("height", String(iconSize))
	icon.setAttribute("viewBox", "0 0 24 24")
	icon.setAttribute("fill", "none")
	icon.setAttribute("stroke", "currentColor")
	icon.setAttribute("stroke-width", "1.8")
	icon.setAttribute("stroke-linecap", "round")
	icon.setAttribute("stroke-linejoin", "round")
	const iconPaths =
		type === "workspace"
			? [
					"M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z",
					"m3.3 7 8.7 5 8.7-5",
					"M12 22V12",
				]
			: [
					"M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z",
				]
	for (const pathData of iconPaths) {
		const path = document.createElementNS("http://www.w3.org/2000/svg", "path")
		path.setAttribute("d", pathData)
		icon.appendChild(path)
	}
	if (type !== "workspace") {
		const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle")
		dot.setAttribute("cx", "12")
		dot.setAttribute("cy", "13")
		dot.setAttribute("r", "1")
		icon.appendChild(dot)
	}
	const text = document.createElement("span")
	text.textContent = label
	image.append(icon, text)
	// A fixed offscreen preview is captured by native HTML drag-and-drop.
	image.className =
		"pointer-events-none fixed -left-[1000px] -top-[1000px] z-[9999] flex h-7 max-w-[260px] select-none items-center gap-2 overflow-hidden text-ellipsis whitespace-nowrap rounded-lg bg-white px-2.5 py-0 text-xs font-medium leading-[1.2] text-[#1c1d23] shadow-[0_0_1px_rgba(0,0,0,0.3),0_4px_14px_rgba(0,0,0,0.1)] [font-family:-apple-system,BlinkMacSystemFont,sans-serif]"
	document.body.appendChild(image)
	return image
}

/** Creates the shared SVG insertion indicator and appends it to the document. */
export function createSidebarDropIndicator() {
	const indicator = document.createElementNS("http://www.w3.org/2000/svg", "svg")
	indicator.setAttribute("aria-hidden", "true")
	indicator.setAttribute(
		"class",
		"pointer-events-none fixed z-[10000] hidden h-2 overflow-visible text-[#b9dcff]",
	)

	const line = document.createElementNS("http://www.w3.org/2000/svg", "line")
	line.setAttribute("x1", "4")
	line.setAttribute("y1", "4")
	line.setAttribute("y2", "4")
	line.setAttribute("stroke", "currentColor")
	line.setAttribute("stroke-width", "2")
	const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle")
	circle.setAttribute("cx", "4")
	circle.setAttribute("cy", "4")
	circle.setAttribute("r", "4")
	circle.setAttribute("fill", "currentColor")
	indicator.append(line, circle)
	document.body.appendChild(indicator)
	return indicator
}
