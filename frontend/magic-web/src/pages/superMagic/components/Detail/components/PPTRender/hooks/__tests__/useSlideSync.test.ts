import { renderHook } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { useSlideSync } from "../useSlideSync"

describe("useSlideSync", () => {
	it("restores the cached active index only after initial slide hydration", () => {
		const restoreCachedActiveIndex = vi.fn().mockResolvedValue(undefined)
		const testStore = {
			slides: [{ path: "slides/one.html" }],
			activeIndex: 0,
			isInitializing: false,
			restoreCachedActiveIndex,
			setActiveIndex: vi.fn(),
		}

		const { rerender } = renderHook(
			({
				slideCount,
				deckKey,
				isInitializing,
			}: {
				slideCount: number
				deckKey?: string
				isInitializing?: boolean
			}) => {
				testStore.slides = Array.from({ length: slideCount }, (_, index) => ({
					path: `slides/${index}.html`,
				}))
				testStore.isInitializing = isInitializing ?? false
				useSlideSync({
					store: testStore as never,
					slidePaths: testStore.slides.map((slide) => slide.path),
					deckKey,
				})
			},
			{ initialProps: { slideCount: 1, deckKey: "deck-a", isInitializing: false } },
		)

		expect(restoreCachedActiveIndex).toHaveBeenCalledTimes(1)
		const restoreOptions = restoreCachedActiveIndex.mock.calls[0]?.[0]
		expect(restoreOptions.shouldApply()).toBe(true)

		testStore.activeIndex = 1
		expect(restoreOptions.shouldApply()).toBe(false)
		testStore.activeIndex = 0
		const firstDeckRestoreOptions = restoreOptions

		rerender({ slideCount: 2, deckKey: "deck-a", isInitializing: false })

		expect(restoreCachedActiveIndex).toHaveBeenCalledTimes(1)

		rerender({ slideCount: 0, deckKey: "deck-a", isInitializing: false })
		rerender({ slideCount: 1, deckKey: "deck-a", isInitializing: false })

		expect(restoreCachedActiveIndex).toHaveBeenCalledTimes(2)

		rerender({ slideCount: 1, deckKey: "deck-b", isInitializing: false })

		expect(restoreCachedActiveIndex).toHaveBeenCalledTimes(3)
		expect(firstDeckRestoreOptions.shouldApply()).toBe(false)
	})
})
