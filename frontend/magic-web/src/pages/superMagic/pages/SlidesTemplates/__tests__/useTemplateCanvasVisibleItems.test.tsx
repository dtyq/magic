import { renderHook } from "@testing-library/react"
import { createRef } from "react"
import { describe, expect, it, vi } from "vitest"
import { buildTemplateCanvasItems, type TemplateCanvasPoint } from "../canvasLayout"
import type { SlidesTemplateCanvasTile } from "../canvasInteraction"
import {
	getRebasedSlidesTemplateCanvasOffset,
	getSlidesTemplateCanvasLoopMetrics,
} from "../canvasLoop"
import { useTemplateCanvasVisibleItems } from "../useTemplateCanvasVisibleItems"

function createTile(index: number, isFavorite = false): SlidesTemplateCanvasTile {
	return {
		id: `template-${index}`,
		kind: "cover",
		template: {
			label: `Template ${index}`,
			value: `template-${index}`,
			is_favorite: isFavorite,
		},
	}
}

describe("useTemplateCanvasVisibleItems", () => {
	it("clears stale visible items when the next layout is empty", () => {
		const canvasItems = buildTemplateCanvasItems([createTile(1)])
		const initialLoopMetrics = getSlidesTemplateCanvasLoopMetrics(canvasItems)
		const emptyCanvasItems: typeof canvasItems = []
		const emptyLoopMetrics = getSlidesTemplateCanvasLoopMetrics(emptyCanvasItems)
		const viewport = document.createElement("div")
		vi.spyOn(viewport, "getBoundingClientRect").mockReturnValue({
			bottom: 600,
			height: 600,
			left: 0,
			right: 800,
			top: 0,
			width: 800,
			x: 0,
			y: 0,
			toJSON: () => ({}),
		})
		const viewportRef = createRef<HTMLDivElement>()
		viewportRef.current = viewport
		const offsetRef = { current: { x: 0, y: 0 } }
		const scaleRef = { current: 0.6 }
		const onOffsetRebase = vi.fn()

		const { result, rerender } = renderHook(
			({
				items,
				loopMetrics,
			}: {
				items: typeof canvasItems
				loopMetrics: typeof initialLoopMetrics
			}) =>
				useTemplateCanvasVisibleItems({
					canvasItems: items,
					loopMetrics,
					onOffsetRebase,
					offsetRef,
					resetKey: "all:",
					scaleRef,
					viewportRef,
				}),
			{ initialProps: { items: canvasItems, loopMetrics: initialLoopMetrics } },
		)

		expect(result.current.visibleCanvasItems.length).toBeGreaterThan(0)

		rerender({ items: emptyCanvasItems, loopMetrics: emptyLoopMetrics })

		expect(result.current.visibleCanvasItems).toHaveLength(0)
	})

	it("rebases the live offset before rendering a changed loop period", () => {
		const previousItems = buildTemplateCanvasItems([createTile(1)])
		const nextItems = buildTemplateCanvasItems(
			Array.from({ length: 12 }, (_, index) => createTile(index + 1)),
		)
		const previousLoopMetrics = getSlidesTemplateCanvasLoopMetrics(previousItems)
		const nextLoopMetrics = getSlidesTemplateCanvasLoopMetrics(nextItems)
		const scaleRef = { current: 0.72 }
		const offsetRef = {
			current: {
				x: -previousLoopMetrics.width * 6 * scaleRef.current,
				y: previousLoopMetrics.height * 3 * scaleRef.current,
			},
		}
		const initialOffset = { ...offsetRef.current }
		const viewport = document.createElement("div")
		vi.spyOn(viewport, "getBoundingClientRect").mockReturnValue({
			bottom: 600,
			height: 600,
			left: 0,
			right: 800,
			top: 0,
			width: 800,
			x: 0,
			y: 0,
			toJSON: () => ({}),
		})
		const viewportRef = createRef<HTMLDivElement>()
		viewportRef.current = viewport
		const onOffsetRebase = vi.fn()
		const expectedOffset = getRebasedSlidesTemplateCanvasOffset({
			nextLoopMetrics,
			offset: initialOffset,
			previousLoopMetrics,
			scale: scaleRef.current,
		})

		const { rerender } = renderHook(
			({
				canvasItems,
				loopMetrics,
			}: {
				canvasItems: typeof previousItems
				loopMetrics: typeof previousLoopMetrics
			}) =>
				useTemplateCanvasVisibleItems({
					canvasItems,
					loopMetrics,
					onOffsetRebase,
					offsetRef,
					resetKey: "all:",
					scaleRef,
					viewportRef,
				}),
			{
				initialProps: {
					canvasItems: previousItems,
					loopMetrics: previousLoopMetrics,
				},
			},
		)

		rerender({ canvasItems: nextItems, loopMetrics: nextLoopMetrics })

		expect(offsetRef.current).toEqual<TemplateCanvasPoint>(expectedOffset)
		expect(onOffsetRebase).toHaveBeenCalledTimes(1)
	})

	it("does not keep stale preserved cards after a favorite update", () => {
		const initialItems = buildTemplateCanvasItems(
			Array.from({ length: 12 }, (_, index) => createTile(index + 1)),
		)
		const appendedItems = buildTemplateCanvasItems(
			Array.from({ length: 24 }, (_, index) => createTile(index + 1)),
		)
		const favoriteUpdatedItems = buildTemplateCanvasItems(
			Array.from({ length: 24 }, (_, index) => createTile(index + 1, index === 0)),
		)
		const initialLoopMetrics = getSlidesTemplateCanvasLoopMetrics(initialItems)
		const appendedLoopMetrics = getSlidesTemplateCanvasLoopMetrics(appendedItems)
		const updatedLoopMetrics = getSlidesTemplateCanvasLoopMetrics(favoriteUpdatedItems)
		const viewport = document.createElement("div")
		vi.spyOn(viewport, "getBoundingClientRect").mockReturnValue({
			bottom: 600,
			height: 600,
			left: 0,
			right: 800,
			top: 0,
			width: 800,
			x: 0,
			y: 0,
			toJSON: () => ({}),
		})
		const viewportRef = createRef<HTMLDivElement>()
		viewportRef.current = viewport
		const offsetRef = { current: { x: 0, y: 0 } }
		const scaleRef = { current: 0.6 }
		const onOffsetRebase = vi.fn()

		const { result, rerender } = renderHook(
			({
				items,
				loopMetrics,
			}: {
				items: typeof initialItems
				loopMetrics: typeof initialLoopMetrics
			}) =>
				useTemplateCanvasVisibleItems({
					canvasItems: items,
					loopMetrics,
					onOffsetRebase,
					offsetRef,
					resetKey: "all:",
					scaleRef,
					viewportRef,
				}),
			{ initialProps: { items: initialItems, loopMetrics: initialLoopMetrics } },
		)

		rerender({ items: appendedItems, loopMetrics: appendedLoopMetrics })
		rerender({ items: favoriteUpdatedItems, loopMetrics: updatedLoopMetrics })

		expect(
			result.current.visibleCanvasItems.some(
				({ item }) => item.template.is_favorite === true,
			),
		).toBe(true)
	})
})
