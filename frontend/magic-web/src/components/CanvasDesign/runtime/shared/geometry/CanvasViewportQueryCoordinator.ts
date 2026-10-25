import type { Canvas } from "../../core/Canvas"
import { ElementTypeEnum } from "../../document/types"
import type { Rect } from "../ids"
import { getViewportCanvasRect } from "../placement/elementUtils"
import { containsRect, expandRect, intersectsRect } from "./GeometryCacheManager"

const CANVAS_VIEWPORT_NEAR_PADDING_RATIO = 2
const CANVAS_VIEWPORT_LAYOUT_PADDING_RATIO = 0.5
const CANVAS_VIEWPORT_COVERAGE_PADDING_RATIO = 2.5

export interface CanvasViewportSpatialSnapshot {
	generation: number
	geometryRevision: number
	viewportScale: number
	viewportRect: Rect
	nearRect: Rect
	layoutRect: Rect
	visibleElementIds: ReadonlySet<string>
	nearElementIds: ReadonlySet<string>
	layoutElementIds: ReadonlySet<string>
	labelElementIds: readonly string[]
}

interface CoverageElement {
	elementId: string
	bounds: Rect
}

interface ViewportCoverageCache {
	geometryRevision: number
	coverageRect: Rect
	elements: CoverageElement[]
}

function areRectsEqual(left: Rect, right: Rect): boolean {
	return (
		left.x === right.x &&
		left.y === right.y &&
		left.width === right.width &&
		left.height === right.height
	)
}

function getIntersectionRect(left: Rect, right: Rect): Rect | null {
	const minX = Math.max(left.x, right.x)
	const minY = Math.max(left.y, right.y)
	const maxX = Math.min(left.x + left.width, right.x + right.width)
	const maxY = Math.min(left.y + left.height, right.y + right.height)
	if (maxX <= minX || maxY <= minY) return null
	return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

/**
 * Owns the spatial result for one Canvas viewport generation.
 *
 * A buffered coverage is queried once. Pan/zoom frames whose exact near rect remains inside that
 * coverage only reclassify cached candidates, allowing visibility, consumers and labels to share
 * one result without changing visible/near semantics.
 */
export class CanvasViewportQueryCoordinator {
	private readonly canvas: Canvas
	private coverageCache: ViewportCoverageCache | null = null
	private currentSnapshot: CanvasViewportSpatialSnapshot | null = null
	private clippingFrameIdsByParentId = new Map<string, readonly string[] | null>()
	private clippingFrameBoundsById = new Map<string, Rect | null>()
	private clippingHierarchyRevision: number | null = null
	private generation = 0
	private destroyed = false

	constructor(options: { canvas: Canvas }) {
		this.canvas = options.canvas
	}

	public getSnapshot(): CanvasViewportSpatialSnapshot {
		const viewportRect = getViewportCanvasRect(this.canvas)
		const viewportScale = this.canvas.stage.scaleX() || 1
		const geometryRevision = this.canvas.geometryCacheManager.getRevision()
		const current = this.currentSnapshot
		if (
			current &&
			current.geometryRevision === geometryRevision &&
			current.viewportScale === viewportScale &&
			areRectsEqual(current.viewportRect, viewportRect)
		) {
			return current
		}

		const longEdge = Math.max(viewportRect.width, viewportRect.height)
		const nearRect = expandRect(viewportRect, longEdge * CANVAS_VIEWPORT_NEAR_PADDING_RATIO)
		const layoutRect = expandRect(viewportRect, longEdge * CANVAS_VIEWPORT_LAYOUT_PADDING_RATIO)
		let coverage = this.coverageCache
		if (
			!coverage ||
			coverage.geometryRevision !== geometryRevision ||
			!containsRect(coverage.coverageRect, nearRect)
		) {
			coverage = this.rebuildCoverage(viewportRect, geometryRevision)
		}

		const visibleElementIds = new Set<string>()
		const nearElementIds = new Set<string>()
		const layoutElementIds = new Set<string>()
		const labelElementIds: string[] = []
		for (const element of coverage.elements) {
			const visible = intersectsRect(element.bounds, viewportRect)
			if (visible) visibleElementIds.add(element.elementId)
			else if (intersectsRect(element.bounds, nearRect)) {
				nearElementIds.add(element.elementId)
			}
			// Labels and scale-dependent element layouts use the same narrow buffer, so classify
			// both with one bounds check instead of repeating work for every coverage candidate.
			if (intersectsRect(element.bounds, layoutRect)) {
				layoutElementIds.add(element.elementId)
				labelElementIds.push(element.elementId)
			}
		}

		this.generation += 1
		const snapshot: CanvasViewportSpatialSnapshot = {
			generation: this.generation,
			geometryRevision,
			viewportScale,
			viewportRect,
			nearRect,
			layoutRect,
			visibleElementIds,
			nearElementIds,
			layoutElementIds,
			labelElementIds,
		}
		this.currentSnapshot = snapshot
		return snapshot
	}

	public destroy(): void {
		this.destroyed = true
		this.coverageCache = null
		this.currentSnapshot = null
		this.clippingFrameIdsByParentId.clear()
		this.clippingFrameBoundsById.clear()
		this.clippingHierarchyRevision = null
	}

	private rebuildCoverage(viewportRect: Rect, geometryRevision: number): ViewportCoverageCache {
		if (this.destroyed) {
			return { geometryRevision, coverageRect: { ...viewportRect }, elements: [] }
		}

		const coveragePadding =
			Math.max(viewportRect.width, viewportRect.height) *
			CANVAS_VIEWPORT_COVERAGE_PADDING_RATIO
		const coverageRect = expandRect(viewportRect, coveragePadding)
		if (this.clippingHierarchyRevision !== geometryRevision) {
			this.clippingFrameIdsByParentId.clear()
			this.clippingFrameBoundsById.clear()
			this.clippingHierarchyRevision = geometryRevision
		}
		const elementIds = this.canvas.geometryCacheManager.queryElementIdsByExpandedRect(
			viewportRect,
			coveragePadding,
		)
		const elements: CoverageElement[] = []
		for (const elementId of elementIds) {
			const bounds = this.getViewportClippedBounds(elementId)
			if (bounds) elements.push({ elementId, bounds })
		}

		const coverage = { geometryRevision, coverageRect, elements }
		this.coverageCache = coverage
		return coverage
	}

	/**
	 * Spatial entries use scene bounds, which can extend beyond an ancestor Frame's clip. Keep the
	 * shared viewport result on effective visible bounds so every downstream consumer avoids those
	 * false-positive candidates without repeating the same ancestor walk.
	 */
	private getViewportClippedBounds(elementId: string): Rect | null {
		let bounds = this.canvas.geometryCacheManager.getElementBounds(elementId)
		if (!bounds) return null

		const parentId = this.canvas.elementManager.findParentIdForElement(elementId)
		if (!parentId) return bounds

		const clippingFrameIds = this.getClippingFrameIds(parentId)
		if (!clippingFrameIds) return null
		for (const frameId of clippingFrameIds) {
			const frameBounds = this.getClippingFrameBounds(frameId)
			if (!frameBounds) return null
			bounds = getIntersectionRect(bounds, frameBounds)
			if (!bounds) return null
		}
		return bounds
	}

	private getClippingFrameBounds(frameId: string): Rect | null {
		if (this.clippingFrameBoundsById.has(frameId)) {
			return this.clippingFrameBoundsById.get(frameId) ?? null
		}

		const bounds = this.canvas.geometryCacheManager.getElementBounds(frameId)
		this.clippingFrameBoundsById.set(frameId, bounds)
		return bounds
	}

	private getClippingFrameIds(
		parentId: string,
		resolvingParentIds: Set<string> = new Set(),
	): readonly string[] | null {
		if (this.clippingFrameIdsByParentId.has(parentId)) {
			return this.clippingFrameIdsByParentId.get(parentId) ?? null
		}
		if (resolvingParentIds.has(parentId)) return null
		resolvingParentIds.add(parentId)

		const parent = this.canvas.elementManager.getElementData(parentId)
		if (!parent) {
			this.clippingFrameIdsByParentId.set(parentId, null)
			return null
		}

		const ancestorParentId = this.canvas.elementManager.findParentIdForElement(parentId)
		const ancestorFrameIds = ancestorParentId
			? this.getClippingFrameIds(ancestorParentId, resolvingParentIds)
			: []
		if (!ancestorFrameIds) {
			this.clippingFrameIdsByParentId.set(parentId, null)
			return null
		}

		const frameIds =
			parent.type === ElementTypeEnum.Frame
				? [parentId, ...ancestorFrameIds]
				: ancestorFrameIds
		this.clippingFrameIdsByParentId.set(parentId, frameIds)
		return frameIds
	}
}
