import type { Canvas } from "../Canvas"
import type { LayerElement } from "../types"
import type { Rect } from "./utils"

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

function expandRect(rect: Rect, padding: number): Rect {
	return {
		x: rect.x - padding,
		y: rect.y - padding,
		width: rect.width + padding * 2,
		height: rect.height + padding * 2,
	}
}

function intersectsRect(a: Rect, b: Rect): boolean {
	return (
		a.x <= b.x + b.width &&
		a.x + a.width >= b.x &&
		a.y <= b.y + b.height &&
		a.y + a.height >= b.y
	)
}

/**
 * 统一管理元素几何边界缓存。
 *
 * 这一层先提供稳定的缓存/失效接口，后续如果要接空间索引，
 * 可以在不改上层调用方的前提下替换 nearby 查询实现。
 */
export class GeometryCacheManager {
	private canvas: Canvas
	private elementBoundsCache: Map<string, Rect | null> = new Map()
	private allElementsBoundsCache: Rect | null | undefined

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

	public invalidateElement(elementId: string): void {
		this.elementBoundsCache.delete(elementId)
		this.allElementsBoundsCache = undefined
	}

	public invalidateElements(elementIds: Iterable<string>): void {
		let hasInvalidated = false
		for (const elementId of elementIds) {
			this.elementBoundsCache.delete(elementId)
			hasInvalidated = true
		}
		if (hasInvalidated) {
			this.allElementsBoundsCache = undefined
		}
	}

	public invalidateAll(): void {
		this.elementBoundsCache.clear()
		this.allElementsBoundsCache = undefined
	}

	public destroy(): void {
		this.invalidateAll()
	}
}
