import RBush, { type BBox } from "rbush"
import type { Rect } from "../ids"

// The 10k-element benchmark uses a moderate fan-out to keep both tree depth and update cost low.
const DEFAULT_MAX_ENTRIES = 16

export interface GeometrySpatialIndexEntry {
	elementId: string
	bounds: Rect
}

export interface GeometrySpatialIndexUpdate {
	elementId: string
	bounds: Rect | null
}

interface IndexedGeometry extends BBox {
	elementId: string
}

function toBoundingBox(rect: Rect): BBox | null {
	const endX = rect.x + rect.width
	const endY = rect.y + rect.height
	if (
		!Number.isFinite(rect.x) ||
		!Number.isFinite(rect.y) ||
		!Number.isFinite(endX) ||
		!Number.isFinite(endY)
	) {
		return null
	}

	return {
		minX: Math.min(rect.x, endX),
		minY: Math.min(rect.y, endY),
		maxX: Math.max(rect.x, endX),
		maxY: Math.max(rect.y, endY),
	}
}

function createIndexedGeometry(elementId: string, bounds: Rect): IndexedGeometry | null {
	const box = toBoundingBox(bounds)
	return box ? { elementId, ...box } : null
}

/**
 * Keeps RBush-specific records and identity-based removal outside GeometryCacheManager.
 * A single item is retained per element so an update never leaves stale geometry in the tree.
 */
export class GeometryRTreeIndex {
	private readonly tree = new RBush<IndexedGeometry>(DEFAULT_MAX_ENTRIES)
	private readonly itemsByElementId = new Map<string, IndexedGeometry>()

	public rebuild(entries: Iterable<GeometrySpatialIndexEntry>): void {
		this.clear()
		const items: IndexedGeometry[] = []
		for (const entry of entries) {
			const item = createIndexedGeometry(entry.elementId, entry.bounds)
			if (!item) continue
			// ElementManager owns unique IDs, so one retained item is enough for each entry.
			items.push(item)
			this.itemsByElementId.set(entry.elementId, item)
		}

		if (items.length > 0) this.tree.load(items)
	}

	/** Updates a deduplicated batch. GeometryCacheManager supplies unique element IDs here. */
	public replaceMany(updates: readonly GeometrySpatialIndexUpdate[]): void {
		const nextItems: IndexedGeometry[] = []
		for (const update of updates) {
			const item = update.bounds
				? createIndexedGeometry(update.elementId, update.bounds)
				: null
			const previousItem = this.itemsByElementId.get(update.elementId)
			if (
				item &&
				previousItem &&
				item.minX === previousItem.minX &&
				item.minY === previousItem.minY &&
				item.maxX === previousItem.maxX &&
				item.maxY === previousItem.maxY
			) {
				continue
			}

			this.remove(update.elementId)
			if (item) nextItems.push(item)
		}

		if (nextItems.length > 0) this.tree.load(nextItems)
		for (const item of nextItems) {
			this.itemsByElementId.set(item.elementId, item)
		}
	}

	public remove(elementId: string): void {
		const item = this.itemsByElementId.get(elementId)
		if (!item) return

		// RBush removes by object identity, so retain the inserted item instead of reconstructing it.
		this.tree.remove(item)
		this.itemsByElementId.delete(elementId)
	}

	public queryElementIds(rect: Rect, allowedIds?: ReadonlySet<string>): string[] {
		const box = toBoundingBox(rect)
		if (!box) return []

		const items = this.tree.search(box)
		const elementIds: string[] = []
		for (const item of items) {
			if (!allowedIds || allowedIds.has(item.elementId)) {
				elementIds.push(item.elementId)
			}
		}
		return elementIds
	}

	public clear(): void {
		this.tree.clear()
		this.itemsByElementId.clear()
	}
}
