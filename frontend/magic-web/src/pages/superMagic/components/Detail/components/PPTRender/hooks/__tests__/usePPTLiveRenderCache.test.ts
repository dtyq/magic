import { describe, expect, it } from "vitest"
import {
	getLiveRenderSlideKey,
	getLiveRenderSlideRevision,
	getLiveRenderSlideSourceRevision,
	reconcileResidentSlideKeys,
} from "../usePPTLiveRenderCache"

describe("reconcileResidentSlideKeys", () => {
	it("does not invalidate the live iframe when only inert notes change", () => {
		const baseSlide = {
			id: "slide-1",
			index: 0,
			path: "slide-1.html",
			content: "<main>Slide</main>",
			rawContent: "<main>Slide</main><template data-magic-slide-notes>Old</template>",
			loadingState: "loaded" as const,
			lastLoadedAt: 100,
		}
		const notedSlide = {
			...baseSlide,
			rawContent:
				"<main>Slide</main><template data-magic-slide-notes>A much longer note</template>",
		}

		expect(getLiveRenderSlideRevision(notedSlide)).toBe(getLiveRenderSlideRevision(baseSlide))
		expect(getLiveRenderSlideSourceRevision(notedSlide)).toBe(
			getLiveRenderSlideSourceRevision(baseSlide),
		)
	})

	it("changes the source revision when the notes baseline is updated", () => {
		const baseSlide = {
			id: "slide-1",
			index: 0,
			path: "slide-1.html",
			content: "<main>Slide</main>",
			rawContent: "<main>Slide</main>",
			loadingState: "loaded" as const,
			lastLoadedAt: 100,
			rawRevision: 0,
		}
		const notedSlide = { ...baseSlide, rawRevision: 1 }

		expect(getLiveRenderSlideRevision(notedSlide)).toBe(getLiveRenderSlideRevision(baseSlide))
		expect(getLiveRenderSlideSourceRevision(notedSlide)).not.toBe(
			getLiveRenderSlideSourceRevision(baseSlide),
		)
	})

	it("uses the slide path as part of the renderer identity across deck replacement", () => {
		const firstDeckKey = getLiveRenderSlideKey({
			id: "slide-0",
			index: 0,
			path: "deck-a/slide-1.html",
		})
		const secondDeckKey = getLiveRenderSlideKey({
			id: "slide-0",
			index: 0,
			path: "deck-b/slide-1.html",
		})

		expect(firstDeckKey).not.toBe(secondDeckKey)
	})

	it("keeps the current page, neighbors and recent slides within a fixed cache", () => {
		const result = reconcileResidentSlideKeys({
			previousKeys: ["slide-3", "slide-4", "slide-5", "slide-1", "slide-2"],
			availableKeys: new Set([
				"slide-1",
				"slide-2",
				"slide-3",
				"slide-4",
				"slide-5",
				"slide-6",
			]),
			activeKey: "slide-4",
			presentedKey: "slide-4",
			neighborKeys: ["slide-5", "slide-3"],
			pinnedKeys: [],
			recentKeys: ["slide-4", "slide-1", "slide-2"],
			capacity: 5,
		})

		// Retained iframe nodes keep their previous DOM order even though priority changed.
		expect(result).toEqual(["slide-3", "slide-4", "slide-5", "slide-1", "slide-2"])
	})

	it("temporarily keeps the old page during a cold double-buffer transition", () => {
		const result = reconcileResidentSlideKeys({
			previousKeys: ["slide-1", "slide-2", "slide-3"],
			availableKeys: new Set([
				"slide-1",
				"slide-2",
				"slide-3",
				"slide-99",
				"slide-100",
				"slide-101",
			]),
			activeKey: "slide-100",
			presentedKey: "slide-2",
			neighborKeys: ["slide-101", "slide-99"],
			pinnedKeys: [],
			recentKeys: ["slide-100", "slide-2"],
			capacity: 3,
		})

		// Capacity + 1 is allowed only while the previous real iframe remains on screen.
		expect(result).toEqual(["slide-2", "slide-100", "slide-101", "slide-99"])
	})

	it("evicts the old page after the prepared target becomes presented", () => {
		const result = reconcileResidentSlideKeys({
			previousKeys: ["slide-2", "slide-100", "slide-101", "slide-99"],
			availableKeys: new Set(["slide-2", "slide-99", "slide-100", "slide-101"]),
			activeKey: "slide-100",
			presentedKey: "slide-100",
			neighborKeys: ["slide-101", "slide-99"],
			pinnedKeys: [],
			recentKeys: ["slide-100", "slide-2"],
			capacity: 3,
		})

		expect(result).toEqual(["slide-100", "slide-101", "slide-99"])
	})

	it("pins editing slides even when they exceed the normal LRU budget", () => {
		const result = reconcileResidentSlideKeys({
			previousKeys: ["slide-1", "slide-2", "slide-3"],
			availableKeys: new Set(["slide-1", "slide-2", "slide-3", "slide-4"]),
			activeKey: "slide-3",
			presentedKey: "slide-3",
			neighborKeys: ["slide-4", "slide-2"],
			pinnedKeys: ["slide-1"],
			recentKeys: ["slide-3"],
			capacity: 3,
		})

		expect(result).toEqual(["slide-1", "slide-3", "slide-4"])
	})
})
