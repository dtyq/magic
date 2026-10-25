import type { Canvas } from "../../core/Canvas"
import type { LayerElement } from "../../document/types"
import type { ElementManager } from "../../elements/core/ElementManager"
import type { Rect } from "../ids"
import {
	collectObstacleRects,
	findNextImageVideoPlaceholderPositionNearViewport,
	findGeneratedMediaGridPositions,
} from "./findNonOverlappingPlacement"
import {
	getCanvasCenter,
	getResolvedMediaPlacementConfig,
	getViewportCanvasRect,
} from "./elementUtils"
import { resolveGridPlacements } from "./placementMath"
import {
	collectConnectedElementSiblingRects,
	collectConnectionCreateObstacleRects,
	resolveConnectedElementCreateCenterPoint,
	resolveConnectedElementCreateTopLeftPoint,
	resolveConnectionCreateContextWithOriginRect,
	resolveConnectionCreateGapForElement,
	type ConnectionCreatePlacementContext,
} from "./connectionCreatePlacement"

export type PlacementStrategy =
	| "direct"
	| "nearest-free"
	| "connected"
	| "derived-right"
	| "grid"
	| "row-flow"
	| "frame-children"

export interface PlacementSize {
	width: number
	height: number
}

export interface DerivedRightPlacementOptions {
	spacing?: number
}

/** 统一处理从既有元素右侧派生创建节点的位置。结果始终是绝对画布坐标。 */
export function resolveDerivedRightPlacement(
	originalElement: LayerElement,
	originalElementInstance: { getBoundingRect: () => Rect | null },
	elementManager: Pick<ElementManager, "findParentIdForElement">,
	options: DerivedRightPlacementOptions = {},
): { x: number; y: number } | null {
	const spacing = options.spacing ?? 0
	const parentId = elementManager.findParentIdForElement(originalElement.id)
	if (parentId) {
		const bounds = originalElementInstance.getBoundingRect()
		if (!bounds) return null
		return { x: bounds.x + bounds.width + spacing, y: bounds.y }
	}

	return {
		x: (originalElement.x ?? 0) + (originalElement.width ?? 1024) + spacing,
		y: originalElement.y ?? 0,
	}
}

/** 统一处理 viewport 附近的媒体节点自动落位。结果是左上角坐标。 */
export function resolveNearestFreeMediaPlacement(
	canvas: Canvas,
	size: PlacementSize,
	options: { includeLocked?: boolean; includeHidden?: boolean } = {},
): { x: number; y: number } {
	const config = getResolvedMediaPlacementConfig(canvas)
	const obstacles = collectObstacleRects(canvas.elementManager.getAllElements(), (element) => {
		if (!options.includeHidden && !canvas.permissionManager.isVisible(element)) return false
		if (!options.includeLocked && canvas.permissionManager.isLocked(element)) return false
		return true
	})
	return findNextImageVideoPlaceholderPositionNearViewport(obstacles, {
		elementWidth: size.width,
		elementHeight: size.height,
		viewportRect: getViewportCanvasRect(canvas),
		anchor: getCanvasCenter(canvas),
		spacing: config.spacing,
		maxPerRow: config.maxPerRow,
		maxSearchRings: config.maxSearchRings,
	})
}

/** 统一处理连线创建的单节点位置。 */
export function resolveConnectedPlacement(
	canvas: Canvas | undefined,
	context: ConnectionCreatePlacementContext,
	size: PlacementSize,
	options: {
		output?: "center" | "top-left"
		originElementId?: string
		originRect?: Rect | null
		gap?: number
		obstacleRects?: Rect[]
		siblingRects?: Rect[]
	} = {},
): { x: number; y: number } {
	const placementContext = resolveConnectionCreateContextWithOriginRect(
		context,
		options.originRect,
	)
	const originSide = placementContext.originSide
	const gap =
		options.gap ??
		resolveConnectionCreateGapForElement(
			options.originElementId && canvas
				? canvas.elementManager.getElementData(options.originElementId)
				: undefined,
			originSide,
		)
	const placementOptions = {
		obstacleRects:
			options.obstacleRects ?? (canvas ? collectConnectionCreateObstacleRects(canvas) : []),
		siblingRects:
			options.siblingRects ??
			(options.originElementId && originSide && canvas
				? collectConnectedElementSiblingRects(canvas, {
						originElementId: options.originElementId,
						originSide,
					})
				: []),
	}
	return options.output === "top-left"
		? resolveConnectedElementCreateTopLeftPoint(placementContext, size, gap, placementOptions)
		: resolveConnectedElementCreateCenterPoint(placementContext, size, gap, placementOptions)
}

/** 统一入口；复杂批量布局仍通过 strategy 保留业务差异。 */
export function resolvePlacement(options: {
	strategy: PlacementStrategy
	canvas?: Canvas
	size: PlacementSize
	anchor?: { x: number; y: number }
	context?: ConnectionCreatePlacementContext
	originElementId?: string
	originElement?: LayerElement
	originElementInstance?: { getBoundingRect: () => Rect | null }
	elementManager?: Pick<ElementManager, "findParentIdForElement">
	spacing?: number
	dimensions?: PlacementSize[]
	gridOptions?: { maxPerRow?: number }
}): { x: number; y: number } | Array<{ x: number; y: number }> | null {
	switch (options.strategy) {
		case "derived-right":
			if (!options.originElement || !options.originElementInstance || !options.elementManager)
				return null
			return resolveDerivedRightPlacement(
				options.originElement,
				options.originElementInstance,
				options.elementManager,
				{ spacing: options.spacing },
			)
		case "nearest-free":
			if (!options.canvas) return null
			return resolveNearestFreeMediaPlacement(options.canvas, options.size)
		case "connected":
			if (!options.canvas || !options.context) return null
			return resolveConnectedPlacement(options.canvas, options.context, options.size, {
				output: "top-left",
				originElementId: options.originElementId,
			})
		case "grid":
			return resolveGridPlacements(
				options.dimensions ?? [options.size],
				options.anchor ?? { x: 0, y: 0 },
				{
					spacing: options.spacing,
					maxPerRow: options.gridOptions?.maxPerRow,
				},
			)
		case "direct":
		default:
			return options.anchor ?? { x: 0, y: 0 }
	}
}

export { collectConnectedElementSiblingRects, collectConnectionCreateObstacleRects }
export { findGeneratedMediaGridPositions }
export { resolveGridPlacements, resolveHorizontalPlacements } from "./placementMath"
