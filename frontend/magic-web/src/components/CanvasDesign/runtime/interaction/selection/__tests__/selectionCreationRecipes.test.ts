import { describe, expect, it } from "vitest"
import { getSelectionCreateRecipes } from "../selectionCreationRecipes"
import type { SelectionContentSnapshot } from "../selectionContentCollector"

function snapshot(
	videoSequence: string[],
	audioSequence: string[] = [],
	imageSequence: string[] = [],
	imageCount = imageSequence.length,
): SelectionContentSnapshot {
	return {
		rootElementIds: ["root-1", "root-2"],
		items: [],
		imageSequence,
		videoSequence,
		mainVideoSequence: videoSequence,
		audioSequence,
		counts: {
			image: imageCount,
			video: videoSequence.length,
			audio: audioSequence.length,
			text: 0,
		},
		boundingRect: { x: 0, y: 0, width: 200, height: 100 },
		selectionRevision: "root-1\u0000root-2",
		allRootsCanConnect: true,
	}
}

describe("selection creation recipes", () => {
	it("offers merge videos only when at least two videos are available", () => {
		expect(getSelectionCreateRecipes(snapshot(["video-1"]))).toEqual([])
		expect(getSelectionCreateRecipes(snapshot(["video-1", "video-2"]))).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: "video-edit",
					label: "videoEditNode.mergeVideos",
					supportedSides: ["right"],
				}),
			]),
		)
	})

	it("does not expose the right-only recipe on the left side", () => {
		const current = snapshot(["video-1", "video-2"])
		expect(getSelectionCreateRecipes(current, "left")).toEqual([])
		expect(getSelectionCreateRecipes(current, "right")).toHaveLength(1)
	})

	it("offers storyboard on the right whenever the selection contains a usable image", () => {
		const current = snapshot([], [], ["image-1"])

		expect(getSelectionCreateRecipes(current, "left")).toEqual([])
		expect(getSelectionCreateRecipes(current, "right")).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: "storyboard",
					label: "storyboard.menuName",
					fallbackLabel: "制作分镜",
					icon: "workflow",
					supportedSides: ["right"],
				}),
			]),
		)
		expect(
			getSelectionCreateRecipes(
				snapshot(["video-1"], ["audio-1"], ["image-1", "image-2"]),
				"right",
			).map((recipe) => recipe.id),
		).toContain("storyboard")
		expect(getSelectionCreateRecipes(snapshot([], [], [], 1), "right")).toEqual([])
	})
})
