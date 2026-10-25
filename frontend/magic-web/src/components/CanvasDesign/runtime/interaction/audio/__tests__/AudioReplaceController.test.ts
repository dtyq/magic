import { describe, expect, it, vi } from "vitest"
import type { Canvas } from "../../../core/Canvas"
import { ElementTypeEnum } from "../../../document/types"
import { AudioReplaceController } from "../AudioReplaceController"

function createCanvas() {
	const openLocalFilePicker = vi.fn()
	const replaceWithProjectFile = vi.fn(async () => true)
	const canvas = {
		can: vi.fn(() => true),
		permissionManager: { can: vi.fn(() => true) },
		elementManager: {
			getElementData: vi.fn(() => ({
				id: "audio-1",
				type: ElementTypeEnum.Audio,
				activeContentId: "audio-content-2",
				mainContentId: "audio-content-1",
				contents: [
					{ contentId: "audio-content-1", src: "/audios/old.mp3" },
					{ contentId: "audio-content-2", src: "/audios/current.mp3" },
				],
			})),
		},
		mediaReplaceController: { openLocalFilePicker, replaceWithProjectFile },
	} as unknown as Canvas
	return { canvas, openLocalFilePicker, replaceWithProjectFile }
}

describe("AudioReplaceController", () => {
	it("delegates the legacy local entry to the unified media controller", () => {
		const { canvas, openLocalFilePicker } = createCanvas()
		const controller = new AudioReplaceController({ canvas })

		controller.openLocalFilePicker("audio-1")

		expect(openLocalFilePicker).toHaveBeenCalledWith({
			elementId: "audio-1",
			mediaType: ElementTypeEnum.Audio,
			contentId: "audio-content-2",
		})
	})

	it("delegates project replacement without creating a second state lifecycle", async () => {
		const { canvas, replaceWithProjectFile } = createCanvas()
		const controller = new AudioReplaceController({ canvas })

		await expect(
			controller.replaceWithProjectFile("audio-1", "/audios/project.mp3"),
		).resolves.toBe(true)

		expect(replaceWithProjectFile).toHaveBeenCalledWith({
			elementId: "audio-1",
			mediaType: ElementTypeEnum.Audio,
			contentId: "audio-content-2",
			path: "/audios/project.mp3",
		})
	})

	it("stops forwarding after destroy", async () => {
		const { canvas, openLocalFilePicker, replaceWithProjectFile } = createCanvas()
		const controller = new AudioReplaceController({ canvas })
		controller.destroy()

		controller.openLocalFilePicker("audio-1")
		await expect(
			controller.replaceWithProjectFile("audio-1", "/audios/project.mp3"),
		).resolves.toBe(false)

		expect(openLocalFilePicker).not.toHaveBeenCalled()
		expect(replaceWithProjectFile).not.toHaveBeenCalled()
	})
})
