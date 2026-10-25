import { describe, expect, it, vi } from "vitest"
import { ElementTypeEnum } from "../../../document/types"
import { getMediaLabelLayout } from "../mediaLabelLayout"

describe("media label spatial layout cache", () => {
	it("reuses spatial candidates within a scale band and invalidates on geometry revision", () => {
		let scale = 1
		let geometryRevision = 1
		const queryElementIdsByExpandedRect = vi.fn(() => [] as string[])
		const bounds = { x: 0, y: 100, width: 200, height: 120 }
		const element = {
			getBoundingRect: () => bounds,
			getData: () => ({ id: "image-1", type: ElementTypeEnum.Image }),
			getNode: () => ({ isVisible: () => true, getAbsoluteOpacity: () => 1 }),
		}
		const canvas = {
			elementManager: {
				findParentIdForElement: () => undefined,
				getElementInstance: (elementId: string) =>
					elementId === "image-1" ? element : undefined,
			},
			geometryCacheManager: {
				getElementBounds: () => bounds,
				getRevision: () => geometryRevision,
				queryElementIdsByExpandedRect,
			},
			stage: { scaleX: () => scale },
		} as never
		const options = {
			fontSize: 12,
			gap: 4,
			name: { width: 80, height: 12 },
			offsetTop: 5,
			operationScreenWidth: 0,
			size: { width: 60, height: 12 },
		}

		const first = getMediaLabelLayout(canvas, "image-1", options)
		scale = 1.05
		const sameBand = getMediaLabelLayout(canvas, "image-1", options)
		scale = 1.2
		const nextBand = getMediaLabelLayout(canvas, "image-1", options)

		expect(first?.inverseScale).toBe(1)
		expect(sameBand?.inverseScale).toBeCloseTo(1 / 1.05)
		expect(nextBand?.inverseScale).toBeCloseTo(1 / 1.2)
		expect(queryElementIdsByExpandedRect).toHaveBeenCalledTimes(2)

		geometryRevision = 2
		getMediaLabelLayout(canvas, "image-1", options)
		expect(queryElementIdsByExpandedRect).toHaveBeenCalledTimes(3)
	})

	it("keeps the same screen label size for different media heights", () => {
		let geometryRevision = 1
		const queryElementIdsByExpandedRect = vi.fn(() => [] as string[])
		const smallBounds = { x: 0, y: 100, width: 120, height: 40 }
		const largeBounds = { x: 200, y: 100, width: 120, height: 600 }
		const elements = new Map([
			[
				"small-image",
				{
					getBoundingRect: () => smallBounds,
					getData: () => ({ id: "small-image", type: ElementTypeEnum.Image }),
					getNode: () => ({ isVisible: () => true, getAbsoluteOpacity: () => 1 }),
				},
			],
			[
				"large-image",
				{
					getBoundingRect: () => largeBounds,
					getData: () => ({ id: "large-image", type: ElementTypeEnum.Image }),
					getNode: () => ({ isVisible: () => true, getAbsoluteOpacity: () => 1 }),
				},
			],
		])
		const canvas = {
			elementManager: {
				findParentIdForElement: () => undefined,
				getElementInstance: (elementId: string) => elements.get(elementId),
			},
			geometryCacheManager: {
				getElementBounds: (elementId: string) => elements.get(elementId)?.getBoundingRect(),
				getRevision: () => geometryRevision,
				queryElementIdsByExpandedRect,
			},
			stage: { scaleX: () => 1 },
		} as never
		const options = {
			fontSize: 12,
			gap: 4,
			name: { width: 80, height: 12 },
			offsetTop: 5,
			operationScreenWidth: 0,
			size: { width: 60, height: 12 },
		}

		const smallLayout = getMediaLabelLayout(canvas, "small-image", options)
		geometryRevision += 1
		const largeLayout = getMediaLabelLayout(canvas, "large-image", options)

		expect(smallLayout?.inverseScale).toBe(1)
		expect(largeLayout?.inverseScale).toBe(1)
	})

	it("hides the row instead of shrinking it when another media element blocks the label space", () => {
		const targetBounds = { x: 0, y: 100, width: 120, height: 80 }
		const blockingBounds = { x: 0, y: 80, width: 120, height: 19 }
		const target = {
			getBoundingRect: () => targetBounds,
			getData: () => ({ id: "image-1", type: ElementTypeEnum.Image }),
			getNode: () => ({ isVisible: () => true, getAbsoluteOpacity: () => 1 }),
		}
		const blocker = {
			getBoundingRect: () => blockingBounds,
			getData: () => ({ id: "image-2", type: ElementTypeEnum.Image }),
			getNode: () => ({ isVisible: () => true, getAbsoluteOpacity: () => 1 }),
		}
		const canvas = {
			elementManager: {
				findParentIdForElement: () => undefined,
				getElementInstance: (elementId: string) =>
					elementId === "image-1"
						? target
						: elementId === "image-2"
							? blocker
							: undefined,
			},
			geometryCacheManager: {
				getElementBounds: (elementId: string) =>
					elementId === "image-1" ? targetBounds : blockingBounds,
				getRevision: () => 1,
				queryElementIdsByExpandedRect: () => ["image-1", "image-2"],
			},
			stage: { scaleX: () => 1 },
		} as never

		const layout = getMediaLabelLayout(canvas, "image-1", {
			fontSize: 12,
			gap: 4,
			name: { width: 80, height: 12 },
			offsetTop: 5,
			operationScreenWidth: 0,
			size: { width: 40, height: 12 },
		})

		expect(layout?.hasSpace).toBe(false)
		expect(layout?.inverseScale).toBe(1)
	})

	it("uses live bounds for a moving element even when the geometry cache is stale", () => {
		const cachedBounds = { x: 0, y: 100, width: 120, height: 80 }
		const liveBounds = { x: 240, y: 320, width: 160, height: 96 }
		const queryElementIdsByExpandedRect = vi.fn(() => [] as string[])
		const element = {
			getBoundingRect: () => liveBounds,
			getData: () => ({ id: "image-1", type: ElementTypeEnum.Image }),
			getNode: () => ({ isVisible: () => true, getAbsoluteOpacity: () => 1 }),
		}
		const canvas = {
			elementManager: {
				findParentIdForElement: () => undefined,
				getElementInstance: (elementId: string) =>
					elementId === "image-1" ? element : undefined,
			},
			geometryCacheManager: {
				getElementBounds: () => cachedBounds,
				getRevision: () => 1,
				queryElementIdsByExpandedRect,
			},
			stage: { scaleX: () => 1 },
		} as never

		getMediaLabelLayout(canvas, "image-1", {
			fontSize: 12,
			gap: 4,
			name: { width: 200, height: 12 },
			offsetTop: 5,
			operationScreenWidth: 0,
			size: { width: 60, height: 12 },
			boundsOverride: liveBounds,
		})

		expect(queryElementIdsByExpandedRect).toHaveBeenCalledWith(
			expect.objectContaining({
				x: liveBounds.x,
				y: expect.any(Number),
				width: liveBounds.width,
			}),
			0,
		)
	})

	it("uses live candidate bounds during a transform-time row calculation", () => {
		const targetCachedBounds = { x: 0, y: 100, width: 120, height: 80 }
		const targetLiveBounds = { x: 0, y: 100, width: 120, height: 80 }
		const candidateCachedBounds = { x: 0, y: 80, width: 120, height: 20 }
		const candidateLiveBounds = { x: 300, y: 80, width: 120, height: 20 }
		const target = {
			getBoundingRect: () => targetLiveBounds,
			getData: () => ({ id: "image-1", type: ElementTypeEnum.Image }),
			getNode: () => ({ isVisible: () => true, getAbsoluteOpacity: () => 1 }),
		}
		const candidate = {
			getBoundingRect: () => candidateLiveBounds,
			getData: () => ({ id: "image-2", type: ElementTypeEnum.Image }),
			getNode: () => ({ isVisible: () => true, getAbsoluteOpacity: () => 1 }),
		}
		const canvas = {
			elementManager: {
				findParentIdForElement: () => undefined,
				getElementInstance: (elementId: string) =>
					elementId === "image-1"
						? target
						: elementId === "image-2"
							? candidate
							: undefined,
			},
			geometryCacheManager: {
				getElementBounds: (elementId: string) =>
					elementId === "image-1" ? targetCachedBounds : candidateCachedBounds,
				getRevision: () => 1,
				queryElementIdsByExpandedRect: () => ["image-1", "image-2"],
			},
			stage: { scaleX: () => 1 },
		} as never

		const layout = getMediaLabelLayout(canvas, "image-1", {
			fontSize: 12,
			gap: 4,
			name: { width: 80, height: 12 },
			offsetTop: 5,
			operationScreenWidth: 0,
			size: { width: 40, height: 12 },
			boundsOverride: targetLiveBounds,
		})

		expect(layout?.hasSpace).toBe(true)
	})

	it("drops the complete size label before truncating the name or its optional icon", () => {
		const bounds = { x: 0, y: 100, width: 100, height: 80 }
		const element = {
			getBoundingRect: () => bounds,
			getData: () => ({ id: "image-1", type: ElementTypeEnum.Image }),
			getNode: () => ({ isVisible: () => true, getAbsoluteOpacity: () => 1 }),
		}
		const canvas = {
			elementManager: {
				findParentIdForElement: () => undefined,
				getElementInstance: (elementId: string) =>
					elementId === "image-1" ? element : undefined,
			},
			geometryCacheManager: {
				getElementBounds: () => bounds,
				getRevision: () => 1,
				queryElementIdsByExpandedRect: () => [],
			},
			stage: { scaleX: () => 1 },
		} as never
		const baseOptions = {
			fontSize: 12,
			gap: 4,
			name: { width: 240, height: 12 },
			offsetTop: 5,
			operationScreenWidth: 0,
			size: { width: 40, height: 12 },
		}

		const withIcon = getMediaLabelLayout(canvas, "image-1", {
			...baseOptions,
			nameLeadingWidth: 14,
			nameLeadingHeight: 12,
		})
		const withoutIcon = getMediaLabelLayout(canvas, "image-1", {
			...baseOptions,
			nameLeadingWidth: 0,
			nameLeadingHeight: 0,
		})

		expect(withIcon?.showSize).toBe(false)
		expect(withIcon?.nameWidth).toBe(100)
		expect(withoutIcon?.showSize).toBe(false)
		expect(withoutIcon?.nameWidth).toBe(100)

		const tooNarrow = getMediaLabelLayout(canvas, "image-1", {
			...baseOptions,
			nameLeadingWidth: 14,
			nameLeadingHeight: 12,
			boundsOverride: { ...bounds, width: 10 },
		})
		expect(tooNarrow?.showSize).toBe(false)
		expect(tooNarrow?.nameWidth).toBe(10)
	})

	it("keeps the rename operation when the media row is narrower than the hit area", () => {
		const bounds = { x: 0, y: 100, width: 10, height: 80 }
		const element = {
			getBoundingRect: () => bounds,
			getData: () => ({ id: "image-1", type: ElementTypeEnum.Image }),
			getNode: () => ({ isVisible: () => true, getAbsoluteOpacity: () => 1 }),
		}
		const canvas = {
			elementManager: {
				findParentIdForElement: () => undefined,
				getElementInstance: (elementId: string) =>
					elementId === "image-1" ? element : undefined,
			},
			geometryCacheManager: {
				getElementBounds: () => bounds,
				getRevision: () => 1,
				queryElementIdsByExpandedRect: () => [],
			},
			stage: { scaleX: () => 1 },
		} as never

		const layout = getMediaLabelLayout(canvas, "image-1", {
			fontSize: 12,
			gap: 4,
			name: { width: 80, height: 12 },
			offsetTop: 5,
			operationScreenWidth: 24,
			size: { width: 40, height: 12 },
		})

		expect(layout?.showOperation).toBe(true)
		expect(layout?.showSize).toBe(false)
		expect(layout?.nameWidth).toBeGreaterThanOrEqual(12)
	})
})
