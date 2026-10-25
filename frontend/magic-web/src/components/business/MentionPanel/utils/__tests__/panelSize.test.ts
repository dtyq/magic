import { describe, expect, it } from "vitest"
import { getSelectedItemsStripHeight, resolveMentionPanelHeight } from "../panelSize"

describe("resolveMentionPanelHeight", () => {
	it("keeps the base height when the selected status rows are hidden", () => {
		expect(
			resolveMentionPanelHeight({
				baseHeight: 280,
				isGalleryMode: false,
				showSelectionSummary: false,
				showSelectedItems: false,
			}),
		).toBe(280)
	})

	it("adds only the visible rows in list mode", () => {
		expect(
			resolveMentionPanelHeight({
				baseHeight: 280,
				isGalleryMode: false,
				showSelectionSummary: true,
				showSelectedItems: false,
			}),
		).toBe(300)
		expect(
			resolveMentionPanelHeight({
				baseHeight: 280,
				isGalleryMode: false,
				showSelectionSummary: true,
				showSelectedItems: true,
			}),
		).toBe(348)
	})

	it("uses the larger gallery strip size without changing the content baseline", () => {
		expect(getSelectedItemsStripHeight(true)).toBe(72)
		expect(
			resolveMentionPanelHeight({
				baseHeight: 468,
				isGalleryMode: true,
				showSelectionSummary: true,
				showSelectedItems: true,
			}),
		).toBe(560)
	})
})
