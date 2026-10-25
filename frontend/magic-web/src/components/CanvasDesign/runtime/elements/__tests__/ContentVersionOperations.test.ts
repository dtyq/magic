import { describe, expect, it, vi } from "vitest"
import { GenerationStatus } from "../../../public/magic-types"
import { ElementTypeEnum, type AudioElement as AudioElementData } from "../../document/types"
import { AudioElement } from "../audio/AudioElement"
import { ImageElement } from "../image/ImageElement"
import { VideoElement } from "../video/VideoElement"

function createAudioData(): AudioElementData {
	return {
		id: "audio-1",
		type: ElementTypeEnum.Audio,
		x: 0,
		y: 0,
		width: 100,
		height: 40,
		activeContentId: "audio-2",
		mainContentId: "audio-2",
		contents: [
			{ contentId: "audio-1", src: "one.mp3" },
			{ contentId: "audio-2", src: "two.mp3" },
		],
	}
}

describe("media Content version operations", () => {
	it("audio delegates switch, main, and deletion patches through ElementManager", () => {
		const update = vi.fn()
		const context = {
			data: createAudioData(),
			canvas: {
				elementManager: { update },
				permissionManager: { can: vi.fn(() => true) },
			},
		} as unknown as AudioElement

		expect(AudioElement.prototype.switchActiveContent.call(context, "audio-1")).toBe(true)
		expect(update).toHaveBeenLastCalledWith(
			"audio-1",
			{ activeContentId: "audio-1" },
			{ silent: false },
		)

		expect(AudioElement.prototype.setMainContent.call(context, "audio-1")).toBe(true)
		expect(update).toHaveBeenLastCalledWith(
			"audio-1",
			{ mainContentId: "audio-1" },
			{ silent: false },
		)

		expect(AudioElement.prototype.deleteActiveContent.call(context)).toBe(true)
		expect(update).toHaveBeenLastCalledWith(
			"audio-1",
			{
				contents: [{ contentId: "audio-1", src: "one.mp3" }],
				activeContentId: "audio-1",
				mainContentId: "audio-1",
			},
			{ silent: false },
		)
	})

	it("video deletes its active processing Content", () => {
		const update = vi.fn()
		const context = {
			data: {
				id: "video-1",
				type: ElementTypeEnum.Video,
				x: 0,
				y: 0,
				width: 100,
				height: 100,
				activeContentId: "processing",
				mainContentId: "completed",
				contents: [
					{
						contentId: "completed",
						src: "one.mp4",
						status: GenerationStatus.Completed,
					},
					{ contentId: "processing", status: GenerationStatus.Processing },
				],
			},
			canvas: {
				elementManager: { update },
				permissionManager: { can: vi.fn(() => true) },
			},
			isGenerating: false,
		} as unknown as VideoElement

		expect(VideoElement.prototype.deleteActiveContent.call(context)).toBe(true)
		expect(update).toHaveBeenCalledWith(
			"video-1",
			{
				contents: [
					{ contentId: "completed", src: "one.mp4", status: GenerationStatus.Completed },
				],
				activeContentId: "completed",
				mainContentId: "completed",
			},
			{ silent: false },
		)
	})

	it("image deletes a completed version while another version is generating", () => {
		const update = vi.fn()
		const context = {
			data: {
				id: "image-1",
				type: ElementTypeEnum.Image,
				x: 0,
				y: 0,
				width: 100,
				height: 100,
				activeContentId: "completed",
				mainContentId: "completed",
				contents: [
					{
						contentId: "completed",
						src: "one.png",
						status: GenerationStatus.Completed,
					},
					{ contentId: "processing", status: GenerationStatus.Processing },
				],
			},
			canvas: {
				elementManager: { update },
				permissionManager: { can: vi.fn(() => true) },
				markerManager: { removeMarkersByImageContent: vi.fn() },
				generationRuntimeManager: { clearTarget: vi.fn() },
			},
			pollingManager: { syncWithElementData: vi.fn() },
		} as unknown as ImageElement

		expect(ImageElement.prototype.deleteActiveContent.call(context)).toBe(true)
		expect(update).toHaveBeenCalledWith(
			"image-1",
			{
				contents: [{ contentId: "processing", status: GenerationStatus.Processing }],
				activeContentId: "processing",
				mainContentId: "processing",
			},
			{ silent: false },
		)
	})

	it.each([
		["image", ImageElement.prototype],
		["video", VideoElement.prototype],
		["audio", AudioElement.prototype],
	] as const)(
		"rejects document version mutations for readonly %s elements",
		(_name, prototype) => {
			const update = vi.fn()
			const permissionManager = { can: vi.fn(() => false) }
			const context = {
				data: createAudioData(),
				canvas: { elementManager: { update }, permissionManager },
			} as unknown as AudioElement

			expect(prototype.switchActiveContent.call(context, "audio-1")).toBe(false)
			expect(prototype.setMainContent.call(context, "audio-1")).toBe(false)
			expect(prototype.deleteActiveContent.call(context)).toBe(false)
			expect(update).not.toHaveBeenCalled()
			expect(permissionManager.can).toHaveBeenCalledWith("document.write")
		},
	)
})
