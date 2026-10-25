import type { Canvas } from "../../core/Canvas"
import type { LayerElement } from "../../document/types"
import type { Rect } from "../ids"
import {
	GeometryRTreeIndex,
	type GeometrySpatialIndexEntry,
	type GeometrySpatialIndexUpdate,
} from "./GeometryRTreeIndex"

interface GeometrySpatialQueryOptions {
	elementIds?: Iterable<string>
}

function cloneRect(rect: Rect | null): Rect | null {
	if (!rect) return null
	return { ...rect }
}

function mergeRects(rects: Rect[]): Rect | null {
	if (rects.length === 0) {
		return null
	}

	let minX = Infinity
	let minY = Infinity
	let maxX = -Infinity
	let maxY = -Infinity

	for (const rect of rects) {
		minX = Math.min(minX, rect.x)
		minY = Math.min(minY, rect.y)
		maxX = Math.max(maxX, rect.x + rect.width)
		maxY = Math.max(maxY, rect.y + rect.height)
	}

	return {
		x: minX,
		y: minY,
		width: maxX - minX,
		height: maxY - minY,
	}
}

export function expandRect(rect: Rect, padding: number): Rect {
	return {
		x: rect.x - padding,
		y: rect.y - padding,
		width: rect.width + padding * 2,
		height: rect.height + padding * 2,
	}
}

export function containsRect(outer: Rect, inner: Rect): boolean {
	return (
		inner.x >= outer.x &&
		inner.y >= outer.y &&
		inner.x + inner.width <= outer.x + outer.width &&
		inner.y + inner.height <= outer.y + outer.height
	)
}

export function intersectsRect(a: Rect, b: Rect): boolean {
	return (
		a.x <= b.x + b.width &&
		a.x + a.width >= b.x &&
		a.y <= b.y + b.height &&
		a.y + a.height >= b.y
	)
}

const DIRECT_SCAN_CANDIDATE_LIMIT = 32

/**
 * 统一管理元素几何边界缓存。
 *
 * 空间索引实现封装在这一层，上层调用方只依赖稳定的缓存、查询和失效接口。
 */
export class GeometryCacheManager {
	private canvas: Canvas
	private elementBoundsCache: Map<string, Rect | null> = new Map()
	private allElementsBoundsCache: Rect | null | undefined
	private spatialIndex = new GeometryRTreeIndex()
	private spatialIndexDirty = true
	// Coalesce repeated element changes and apply only the latest bounds before the next index query.
	private pendingSpatialUpdates = new Set<string>()
	private revision = 0

	constructor(options: { canvas: Canvas }) {
		this.canvas = options.canvas
	}

	public getElementBounds(elementId: string): Rect | null {
		if (this.elementBoundsCache.has(elementId)) {
			return cloneRect(this.elementBoundsCache.get(elementId) ?? null)
		}

		const element = this.canvas.elementManager.getElementInstance(elementId)
		const bounds = element?.getBoundingRect() ?? null
		this.elementBoundsCache.set(elementId, bounds ? { ...bounds } : null)
		return cloneRect(bounds)
	}

	public getElementsBounds(elementIds: string[]): Rect | null {
		if (elementIds.length === 0) {
			return null
		}

		const rects: Rect[] = []
		for (const elementId of elementIds) {
			const rect = this.getElementBounds(elementId)
			if (rect) {
				rects.push(rect)
			}
		}

		return mergeRects(rects)
	}

	public getAllElementsBounds(): Rect | null {
		if (this.allElementsBoundsCache !== undefined) {
			return cloneRect(this.allElementsBoundsCache)
		}

		const visibleIds = this.canvas.elementManager
			.getAllElementIds()
			.filter((id) => this.canvas.elementManager.isElementVisibleInDataTree(id))
		const rect = this.getElementsBounds(visibleIds)
		this.allElementsBoundsCache = rect ? { ...rect } : null
		return cloneRect(rect)
	}

	public filterElementsByExpandedRect<T extends Pick<LayerElement, "id">>(
		elements: T[],
		rect: Rect,
		padding: number,
	): T[] {
		if (elements.length === 0) {
			return elements
		}

		const queryRect = expandRect(rect, padding)
		return elements.filter((element) => {
			const bounds = this.getElementBounds(element.id)
			return !!bounds && intersectsRect(bounds, queryRect)
		})
	}

	public queryElementIdsByExpandedRect(
		rect: Rect,
		padding: number,
		options?: GeometrySpatialQueryOptions,
	): string[] {
		const queryRect = expandRect(rect, padding)
		const candidateElementIds = options?.elementIds
		const existingSetFilter = candidateElementIds instanceof Set ? candidateElementIds : null
		const allowedIds: ReadonlySet<string> | null = candidateElementIds
			? (existingSetFilter ?? new Set(candidateElementIds))
			: null

		// For a tiny explicit candidate list, direct bounds checks are cheaper than traversing the
		// complete index. The 32-item cutoff is the crossover observed in the 10k-element benchmark.
		if (allowedIds && allowedIds.size <= DIRECT_SCAN_CANDIDATE_LIMIT) {
			return this.queryElementIdsByRect(allowedIds, queryRect)
		}

		this.ensureSpatialIndex()
		return this.spatialIndex.queryElementIds(queryRect, allowedIds ?? undefined)
	}

	public containsRect(outer: Rect, inner: Rect): boolean {
		return containsRect(outer, inner)
	}

	/**
	 * Monotonic geometry revision used by shared viewport snapshots. A revision changes only when
	 * cached bounds may be stale, so multiple consumers can reuse one spatial result safely.
	 */
	public getRevision(): number {
		return this.revision
	}

	public invalidateElement(elementId: string): void {
		this.elementBoundsCache.delete(elementId)
		this.allElementsBoundsCache = undefined
		if (!this.spatialIndexDirty) this.pendingSpatialUpdates.add(elementId)
		this.revision += 1
	}

	public invalidateElements(elementIds: ReadonlySet<string> | readonly string[]): void {
		const invalidatedIds = elementIds instanceof Set ? elementIds : new Set(elementIds)
		if (invalidatedIds.size === 0) return

		this.allElementsBoundsCache = undefined
		for (const elementId of invalidatedIds) {
			this.elementBoundsCache.delete(elementId)
			if (!this.spatialIndexDirty) this.pendingSpatialUpdates.add(elementId)
		}
		this.revision += 1
	}

	public invalidateAll(): void {
		this.elementBoundsCache.clear()
		this.allElementsBoundsCache = undefined
		this.spatialIndex.clear()
		this.spatialIndexDirty = true
		this.pendingSpatialUpdates.clear()
		this.revision += 1
	}

	public destroy(): void {
		this.invalidateAll()
	}

	private ensureSpatialIndex(): void {
		if (this.spatialIndexDirty) {
			this.spatialIndex.rebuild(this.getSpatialIndexEntries())
			this.spatialIndexDirty = false
			this.pendingSpatialUpdates.clear()
			return
		}

		if (this.pendingSpatialUpdates.size === 0) return

		const updates: GeometrySpatialIndexUpdate[] = []
		this.pendingSpatialUpdates.forEach((elementId) => {
			const bounds = this.canvas.elementManager.isElementVisibleInDataTree(elementId)
				? this.getElementBounds(elementId)
				: null
			updates.push({ elementId, bounds })
		})
		this.spatialIndex.replaceMany(updates)
		this.pendingSpatialUpdates.clear()
	}

	private *getSpatialIndexEntries(): IterableIterator<GeometrySpatialIndexEntry> {
		const elementIds = this.canvas.elementManager.getAllElementIds()
		for (const elementId of elementIds) {
			if (!this.canvas.elementManager.isElementVisibleInDataTree(elementId)) continue
			const bounds = this.getElementBounds(elementId)
			if (bounds) yield { elementId, bounds }
		}
	}

	private queryElementIdsByRect(elementIds: Iterable<string>, queryRect: Rect): string[] {
		const result: string[] = []
		for (const elementId of elementIds) {
			if (!this.canvas.elementManager.isElementVisibleInDataTree(elementId)) continue
			const bounds = this.getElementBounds(elementId)
			if (bounds && intersectsRect(bounds, queryRect)) {
				result.push(elementId)
			}
		}
		return result
	}
}
