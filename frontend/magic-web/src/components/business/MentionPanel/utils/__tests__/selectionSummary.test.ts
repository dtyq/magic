import { describe, expect, it, vi } from "vitest"
import { MentionItemType, type MentionItem } from "../../types"
import { canAcceptPendingItem, getMentionPanelSelectionSummaryCounts } from "../selectionSummary"

describe("getMentionPanelSelectionSummaryCounts", () => {
	const image = {
		id: "image-1",
		name: "Image 1",
		type: MentionItemType.PROJECT_FILE,
	} as const
	const video = {
		id: "video-1",
		name: "Video 1",
		type: MentionItemType.PROJECT_FILE,
	} as const

	it("merges pending types into committed counts", () => {
		const counts = getMentionPanelSelectionSummaryCounts(
			{
				currentCounts: { image: 1, video: 0, audio: 0 },
				limits: { image: 15, video: 1 },
				getItemAssetType: (item) => (item.id === image.id ? "image" : "video"),
			},
			[{ item: image }, { item: video }],
		)

		expect(counts).toEqual({ image: 2, video: 1, audio: 0 })
	})

	it("does not count a duplicate committed resource or unknown type", () => {
		const isItemAlreadySelected = vi.fn((item: MentionItem) => item.id === image.id)
		const counts = getMentionPanelSelectionSummaryCounts(
			{
				currentCounts: { image: 1, video: 0, audio: 0 },
				limits: { image: 15 },
				getItemAssetType: (item) => (item.id === image.id ? "image" : undefined),
				isItemAlreadySelected,
			},
			[{ item: image }, { item: video }],
		)

		expect(counts).toEqual({ image: 1, video: 0, audio: 0 })
		expect(isItemAlreadySelected).toHaveBeenCalledTimes(2)
	})

	it("returns undefined when no summary is configured", () => {
		expect(getMentionPanelSelectionSummaryCounts(undefined, [])).toBeUndefined()
	})
})

describe("canAcceptPendingItem", () => {
	const image = {
		id: "image-1",
		name: "Image 1",
		type: MentionItemType.PROJECT_FILE,
	} as const
	const video = {
		id: "video-2",
		name: "Video 2",
		type: MentionItemType.PROJECT_FILE,
	} as const

	const summary = (overrides: Partial<Parameters<typeof canAcceptPendingItem>[1]> = {}) => ({
		currentCounts: { image: 0, video: 0, audio: 0 },
		limits: { image: 2, video: 2, audio: 1 },
		totalLimit: 3,
		getItemAssetType: (item: MentionItem) => (item.id === image.id ? "image" : "video"),
		...overrides,
	})

	it("allows when no summary is configured", () => {
		expect(canAcceptPendingItem(image, undefined, [])).toBe(true)
	})

	it("allows an already committed resource (no new slot)", () => {
		const s = summary({ isItemAlreadySelected: (item) => item.id === image.id })
		expect(canAcceptPendingItem(image, s, [])).toBe(true)
	})

	it("allows an item whose asset type is unknown", () => {
		const s = summary({ getItemAssetType: () => undefined })
		expect(canAcceptPendingItem(image, s, [])).toBe(true)
	})

	it("blocks a per-type limit overflow", () => {
		const s = summary()
		// committed 0, pending 2 images -> third image exceeds image limit 2
		const pending = [{ item: image }, { item: image }]
		expect(canAcceptPendingItem(image, s, pending)).toBe(false)
	})

	it("blocks a total limit overflow even when per-type is still open", () => {
		const s = summary({ limits: { image: 10, video: 10, audio: 10 }, totalLimit: 2 })
		const pending = [{ item: image }, { item: video }]
		expect(canAcceptPendingItem(video, s, pending)).toBe(false)
	})

	it("allows when within both per-type and total limits", () => {
		const s = summary()
		const pending = [{ item: image }]
		expect(canAcceptPendingItem(video, s, pending)).toBe(true)
	})
})
