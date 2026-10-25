import { describe, expect, it, vi } from "vitest"
import type { Canvas } from "../../../core/Canvas"
import { ElementTypeEnum } from "../../../document/types"
import { ImageReplaceController } from "../ImageReplaceController"

function createCanvas() {
	const openLocalFilePicker = vi.fn()
	const replaceWithProjectFile = vi.fn(async () => true)
	const canvas = {
		can: vi.fn(() => true),
		permissionManager: { can: vi.fn(() => true) },
		elementManager: {
			getElementData: vi.fn(() => ({
				id: "image-1",
				type: ElementTypeEnum.Image,
				activeContentId: "image-content-2",
				mainContentId: "image-content-1",
				contents: [
					{ contentId: "image-content-1", src: "/images/old.png", status: "completed" },
					{
						contentId: "image-content-2",
						src: "/images/current.png",
						status: "completed",
					},
				],
			})),
		},
		mediaReplaceController: { openLocalFilePicker, replaceWithProjectFile },
	} as unknown as Canvas
	return { canvas, openLocalFilePicker, replaceWithProjectFile }
}

describe("ImageReplaceController", () => {
	it("delegates the legacy local entry to the unified media controller", () => {
		const { canvas, openLocalFilePicker } = createCanvas()
		const controller = new ImageReplaceController({ canvas })

		controller.openLocalFilePicker("image-1", null)

		expect(openLocalFilePicker).toHaveBeenCalledWith({
			elementId: "image-1",
			mediaType: ElementTypeEnum.Image,
			contentId: "image-content-2",
		})
	})

	it("preserves an explicitly captured Content for project replacement", async () => {
		const { canvas, replaceWithProjectFile } = createCanvas()
		const controller = new ImageReplaceController({ canvas })

		await expect(
			controller.replaceWithProjectFile("image-1", "/images/project.png", "image-content-1"),
		).resolves.toBe(true)

		expect(replaceWithProjectFile).toHaveBeenCalledWith({
			elementId: "image-1",
			mediaType: ElementTypeEnum.Image,
			contentId: "image-content-1",
			path: "/images/project.png",
		})
	})
})
