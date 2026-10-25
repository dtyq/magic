import { describe, expect, it, vi } from "vitest"
import type { Canvas } from "../../../core/Canvas"
import { ElementTypeEnum, type VideoElement } from "../../../document/types"
import { VideoEditElement } from "../VideoEditElement"

describe("VideoEditElement", () => {
	it("creates the backend-composition DSL without output configuration", () => {
		const data = VideoEditElement.createElementData({
			id: "video-edit-1",
			x: 10,
			y: 20,
			videoSequence: ["video-1"],
			audioSequence: ["audio-1"],
		})

		expect(data.type).toBe(ElementTypeEnum.VideoEdit)
		expect(data.contents[0]).toEqual({
			contentId: "video-edit-1-content-1",
			videoSequence: ["video-1"],
			audioSequence: ["audio-1"],
		})
		expect(data.contents[0]).not.toHaveProperty("output")
	})

	it("loads previews only while visible and aborts them when leaving the viewport", () => {
		const visibilityListeners: Array<(state: "visible" | "near" | "far") => void> = []
		const unregister = vi.fn()
		const getPreviewResource = vi.fn(() => new Promise<never>(() => undefined))
		const source: VideoElement = {
			id: "video-1",
			type: ElementTypeEnum.Video,
			x: 0,
			y: 0,
			width: 320,
			height: 180,
			contents: [{ contentId: "video-1-content", src: "./videos/source.mp4" }],
			activeContentId: "video-1-content",
			mainContentId: "video-1-content",
		}
		const canvas = {
			visibilityManager: {
				registerConsumerVisibility: vi.fn((_elementId: string, listener) => {
					visibilityListeners.push(listener)
					listener("visible")
					return unregister
				}),
			},
			elementManager: {
				getElementData: vi.fn(() => source),
			},
			videoResourceManager: {
				getPreviewResource,
			},
			videoEditPlaybackManager: {
				bindAudio: vi.fn(),
				subscribe: vi.fn(() => vi.fn()),
				release: vi.fn(),
			},
		} as unknown as Canvas
		const element = new VideoEditElement(
			VideoEditElement.createElementData({
				id: "video-edit-preview",
				x: 0,
				y: 0,
				videoSequence: ["video-1"],
			}),
			canvas,
		)
		const collectInputs = () => ({ videoSequence: ["video-1"], audioElementId: undefined })
		;(element as unknown as { collectInputs: typeof collectInputs }).collectInputs =
			collectInputs

		element.onMounted()
		expect(getPreviewResource).toHaveBeenCalledTimes(1)

		const controllers = (
			element as unknown as { previewControllers: Map<string, AbortController> }
		).previewControllers
		const firstController = controllers.get("video-1")
		visibilityListeners[0]?.("near")
		expect(firstController?.signal.aborted).toBe(true)
		expect(controllers.size).toBe(0)

		visibilityListeners[0]?.("visible")
		expect(getPreviewResource).toHaveBeenCalledTimes(2)
		const secondController = controllers.get("video-1")
		element.destroy()
		expect(secondController?.signal.aborted).toBe(true)
		expect(unregister).toHaveBeenCalledTimes(1)
	})
})
