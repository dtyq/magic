import type { Rect } from "./ids"

/** 连接交互的统一来源；selection 只携带真实选择根节点。 */
export type ConnectionOrigin =
	| {
			kind: "element"
			elementId: string
			side: "left" | "right"
	  }
	| {
			kind: "selection"
			elementIds: string[]
			side: "left" | "right"
			boundingRect: Rect
			selectionRevision: string
	  }

export function cloneConnectionOrigin(origin: ConnectionOrigin): ConnectionOrigin {
	if (origin.kind === "element") return { ...origin }
	return {
		...origin,
		elementIds: [...origin.elementIds],
		boundingRect: { ...origin.boundingRect },
	}
}

export function areConnectionOriginsEqual(a: ConnectionOrigin, b: ConnectionOrigin): boolean {
	if (a.kind !== b.kind || a.side !== b.side) return false
	if (a.kind === "element" && b.kind === "element") return a.elementId === b.elementId
	if (a.kind !== "selection" || b.kind !== "selection") return false
	return (
		a.selectionRevision === b.selectionRevision &&
		a.elementIds.length === b.elementIds.length &&
		a.elementIds.every((elementId, index) => elementId === b.elementIds[index]) &&
		a.boundingRect.x === b.boundingRect.x &&
		a.boundingRect.y === b.boundingRect.y &&
		a.boundingRect.width === b.boundingRect.width &&
		a.boundingRect.height === b.boundingRect.height
	)
}
