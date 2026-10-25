import { describe, expect, it, vi } from "vitest"
import { ImageElement } from "../../image/ImageElement"
import { VideoElement } from "../../video/VideoElement"
import {
	ElementTypeEnum,
	type ImageElement as ImageElementData,
	type VideoElement as VideoElementData,
} from "../../../document/types"

function createPreviewEventEmitter() {
	let listener:
		| ((event: { data: { elementId?: string; contentId?: string } }) => void)
		| undefined
	const on = vi.fn((_event: string, nextListener: typeof listener) => {
		listener = nextListener
		return vi.fn()
	})
	return {
		on,
		emit(data: { elementId?: string; contentId?: string }) {
			listener?.({ data })
		},
	}
}

function createPreviewCanvas(previewContentId: string) {
	return {
		getElementForContentView: vi.fn((element: ImageElementData | VideoElementData) => ({
			...element,
			activeContentId: previewContentId,
		})),
		getEffectiveContentId: vi.fn(() => previewContentId),
		markerManager: { handleImageContentChanged: vi.fn() },
		generationRuntimeManager: { hasActiveGeneration: vi.fn(() => false) },
	} as never
}

describe("media element updates with session Content previews", () => {
	it("keeps the image view on the preview Content when the document active Content changes", () => {
		const data: ImageElementData = {
			id: "image-1",
			type: ElementTypeEnum.Image,
			activeContentId: "image-content-1",
			mainContentId: "image-content-1",
			contents: [
				{ contentId: "image-content-1", src: "/images/one.png" },
				{ contentId: "image-content-2", src: "/images/two.png" },
				{ contentId: "image-content-3", src: "/images/three.png" },
			],
		}
		const nextData = { ...data, activeContentId: "image-content-3" }
		const element = Object.create(ImageElement.prototype) as ImageElement
		Object.assign(element, { data, canvas: createPreviewCanvas("image-content-2") })

		const rerender = element.update(nextData)

		expect(rerender).toBe(false)
		expect(element.getData().activeContentId).toBe("image-content-3")
		expect(element.getActiveContentData().contentId).toBe("image-content-2")
		expect(element.getActiveContentData().src).toBe("/images/two.png")
		expect(element.canvas.markerManager.handleImageContentChanged).toHaveBeenCalledWith(
			"image-1",
			"image-content-1",
			"image-content-3",
		)
	})

	it("keeps the video view on the preview Content when the document active Content changes", () => {
		const data: VideoElementData = {
			id: "video-1",
			type: ElementTypeEnum.Video,
			activeContentId: "video-content-1",
			mainContentId: "video-content-1",
			contents: [
				{ contentId: "video-content-1", src: "/videos/one.mp4" },
				{ contentId: "video-content-2", src: "/videos/two.mp4" },
				{ contentId: "video-content-3", src: "/videos/three.mp4" },
			],
		}
		const nextData = { ...data, activeContentId: "video-content-3" }
		const element = Object.create(VideoElement.prototype) as VideoElement
		Object.assign(element, { data, canvas: createPreviewCanvas("video-content-2") })

		const rerender = element.update(nextData)

		expect(rerender).toBe(false)
		expect(element.getData().activeContentId).toBe("video-content-3")
		expect(
			(
				element as unknown as { getVideoContent: () => { contentId: string; src?: string } }
			).getVideoContent(),
		).toMatchObject({ contentId: "video-content-2", src: "/videos/two.mp4" })
	})

	it("clears image runtime resource state when the effective preview Content changes", () => {
		let effectiveContentId = "image-content-1"
		const eventEmitter = createPreviewEventEmitter()
		const data: ImageElementData = {
			id: "image-1",
			type: ElementTypeEnum.Image,
			activeContentId: "image-content-1",
			mainContentId: "image-content-1",
			contents: [
				{ contentId: "image-content-1", src: "/images/one.png" },
				{ contentId: "image-content-2", src: "/images/two.png" },
			],
		}
		const canvas = {
			getEffectiveContentId: vi.fn(() => effectiveContentId),
			getElementForContentView: vi.fn((element: ImageElementData) =>
				effectiveContentId ? { ...element, activeContentId: effectiveContentId } : element,
			),
			eventEmitter,
			visibilityManager: { unregisterImageElement: vi.fn() },
			transformManager: {},
		}
		const rerenderWhenTransformIdle = vi.fn()
		const element = Object.create(ImageElement.prototype) as ImageElement
		Object.assign(element, {
			data,
			canvas,
			loadedImage: {},
			loadedImageVariant: "preview",
			storedOssSrc: "https://oss.example/one.png",
			storedImageInfo: { filename: "one.png" },
			isResourceLoading: true,
			imageLoadFailureReason: "not-found",
			lastAppliedLoadFailureSignature: "old",
			isErrorState: true,
			resourceSubscriptionCleanups: [],
			rerenderWhenTransformIdle,
		})
		;(
			element as unknown as { setupContentPreviewListener: () => void }
		).setupContentPreviewListener()

		effectiveContentId = "image-content-2"
		eventEmitter.emit({ elementId: "image-1", contentId: "image-content-2" })

		expect((element as unknown as { loadedImage?: unknown }).loadedImage).toBeUndefined()
		expect(
			(element as unknown as { imageLoadFailureReason?: unknown }).imageLoadFailureReason,
		).toBeNull()
		expect(element.getActiveContentData().contentId).toBe("image-content-2")
		expect(element.getDisplayState()).toMatchObject({ status: "loading", surface: "loading" })
		expect(element.exportData().activeContentId).toBe("image-content-1")
		expect(rerenderWhenTransformIdle).not.toHaveBeenCalled()

		effectiveContentId = "image-content-1"
		eventEmitter.emit({ elementId: "image-1", contentId: undefined })
		expect(element.getActiveContentData().contentId).toBe("image-content-1")
		expect(element.exportData().activeContentId).toBe("image-content-1")
		expect(rerenderWhenTransformIdle).toHaveBeenCalledTimes(1)
	})

	it("clears video runtime resource state when the effective preview Content changes", () => {
		let effectiveContentId = "video-content-1"
		const eventEmitter = createPreviewEventEmitter()
		const data: VideoElementData = {
			id: "video-1",
			type: ElementTypeEnum.Video,
			activeContentId: "video-content-1",
			mainContentId: "video-content-1",
			contents: [
				{ contentId: "video-content-1", src: "/videos/one.mp4" },
				{ contentId: "video-content-2", src: "/videos/two.mp4" },
			],
		}
		const resetPreview = vi.fn()
		const canvas = {
			getEffectiveContentId: vi.fn(() => effectiveContentId),
			getElementForContentView: vi.fn((element: VideoElementData) =>
				effectiveContentId ? { ...element, activeContentId: effectiveContentId } : element,
			),
			eventEmitter,
			visibilityManager: { updateVideoElement: vi.fn() },
		}
		const element = Object.create(VideoElement.prototype) as VideoElement
		Object.assign(element, {
			data,
			canvas,
			renderer: { hasPreview: vi.fn(() => true), resetPreview },
			isLoadingState: true,
			isResourceErrorState: true,
			isGenerationErrorState: true,
			previewLoadToken: 4,
			inlinePlaybackRequestToken: 6,
		})
		;(
			element as unknown as { setupContentPreviewListener: () => void }
		).setupContentPreviewListener()

		effectiveContentId = "video-content-2"
		eventEmitter.emit({ elementId: "video-1", contentId: "video-content-2" })

		expect(resetPreview).toHaveBeenCalledTimes(1)
		expect((element as unknown as { isResourceErrorState: boolean }).isResourceErrorState).toBe(
			false,
		)
		expect(
			(element as unknown as { isGenerationErrorState: boolean }).isGenerationErrorState,
		).toBe(false)
		expect((element as unknown as { previewLoadToken: number }).previewLoadToken).toBe(5)
		expect(
			(
				element as unknown as { getVideoContent: () => { contentId: string } }
			).getVideoContent(),
		).toMatchObject({ contentId: "video-content-2" })
		expect(element.exportData().activeContentId).toBe("video-content-1")
	})
})
