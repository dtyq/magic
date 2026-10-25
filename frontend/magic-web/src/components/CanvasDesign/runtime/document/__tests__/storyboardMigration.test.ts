import { describe, expect, it } from "vitest"
import { normalizeStoryboardDocument } from "../storyboardMigration"
import { ElementTypeEnum, type CanvasDocument } from "../types"

describe("normalizeStoryboardDocument", () => {
	it("strips duration while preserving the storyboard output image id", () => {
		const legacyDocument = {
			elements: [
				{
					id: "storyboard-1",
					type: ElementTypeEnum.Storyboard,
					activeContentId: "storyboard-content",
					mainContentId: "storyboard-content",
					contents: [
						{
							contentId: "storyboard-content",
							shots: [
								{
									id: "shot-1",
									description: "镜头一",
									durationSeconds: 3,
									outputImageElementId: "image-1",
								},
							],
						},
					],
				},
				{
					id: "image-1",
					type: ElementTypeEnum.Image,
					activeContentId: "image-content",
					mainContentId: "image-content",
					contents: [{ contentId: "image-content" }],
				},
			],
			connections: [
				{
					id: "storyboard-output",
					sourceElementId: "storyboard-1",
					targetElementId: "image-1",
				},
			],
		} as unknown as CanvasDocument

		const normalized = normalizeStoryboardDocument(legacyDocument)
		const storyboard = normalized.elements?.[0]
		if (storyboard?.type !== ElementTypeEnum.Storyboard) {
			throw new Error("Expected storyboard element")
		}

		expect(storyboard.contents[0]?.shots).toEqual([
			{ id: "shot-1", description: "镜头一", outputImageElementId: "image-1" },
		])
		expect(normalized.connections).toEqual(legacyDocument.connections)
	})

	it("keeps connections unchanged when normalizing storyboard content", () => {
		const document = {
			elements: [
				{
					id: "storyboard-1",
					type: ElementTypeEnum.Storyboard,
					activeContentId: "storyboard-content",
					mainContentId: "storyboard-content",
					contents: [
						{
							contentId: "storyboard-content",
							shots: [{ id: "shot-1", description: "镜头一" }],
						},
					],
				},
			],
			connections: [
				{
					id: "manual",
					sourceElementId: "storyboard-1",
					targetElementId: "image-1",
				},
			],
		} as unknown as CanvasDocument

		expect(normalizeStoryboardDocument(document).connections).toEqual(document.connections)
	})
})
