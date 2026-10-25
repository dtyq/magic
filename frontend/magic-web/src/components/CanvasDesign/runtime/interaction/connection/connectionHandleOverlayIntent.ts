export type ConnectionHandleDisplaySource =
	"menu" | "hover" | "pointer-bridge" | "touch-selection" | "selection"

export type ConnectionHandleOverlayIntent =
	| {
			visible: true
			elementId: string
			source: ConnectionHandleDisplaySource
	  }
	| {
			visible: true
			kind: "selection"
			elementIds: string[]
			boundingRect: { x: number; y: number; width: number; height: number }
			selectionRevision: string
			source: "selection"
	  }
	| {
			visible: false
			reason: string
	  }

export interface ConnectionHandleOverlayIntentContext {
	blockReason: string | null
	hasMultipleSelection: boolean
	menuPinnedElementId: string | null
	hoveredElementId: string | null
	bridgeCandidateElementId: string | null
	pointerInsideKeepAliveRegion: boolean
	touchSelectedElementId: string | null
	selectionTarget?: {
		elementIds: string[]
		boundingRect: { x: number; y: number; width: number; height: number } | null
		selectionRevision: string
	}
	canShowSelectionHandles?: boolean
}

export function resolveConnectionHandleOverlayIntent(
	context: ConnectionHandleOverlayIntentContext,
): ConnectionHandleOverlayIntent {
	if (context.blockReason) {
		return { visible: false, reason: context.blockReason }
	}

	if (context.hasMultipleSelection) {
		if (context.canShowSelectionHandles && context.selectionTarget?.boundingRect) {
			return {
				visible: true,
				kind: "selection",
				elementIds: context.selectionTarget.elementIds,
				boundingRect: context.selectionTarget.boundingRect,
				selectionRevision: context.selectionTarget.selectionRevision,
				source: "selection",
			}
		}
		return { visible: false, reason: "multiple-selection" }
	}

	if (context.menuPinnedElementId) {
		return {
			visible: true,
			elementId: context.menuPinnedElementId,
			source: "menu",
		}
	}

	if (context.hoveredElementId) {
		return {
			visible: true,
			elementId: context.hoveredElementId,
			source: "hover",
		}
	}

	if (context.bridgeCandidateElementId && context.pointerInsideKeepAliveRegion) {
		return {
			visible: true,
			elementId: context.bridgeCandidateElementId,
			source: "pointer-bridge",
		}
	}

	if (context.touchSelectedElementId) {
		return {
			visible: true,
			elementId: context.touchSelectedElementId,
			source: "touch-selection",
		}
	}

	return { visible: false, reason: "no-target" }
}
