import { describe, expect, it, vi } from "vitest"
import { ImageElement } from "../../image/ImageElement"
import { VideoElement } from "../../video/VideoElement"
import { ElementTypeEnum } from "../../../document/types"

function replacementState(
	contentId: string,
	source: "local-upload" | "project-file" = "local-upload",
) {
	return {
		operationId: "image-1:1",
		elementId: "image-1",
		mediaType: ElementTypeEnum.Image,
		contentId,
		source,
		phase: "uploading" as const,
	}
}

describe("media replacement placeholders", () => {
	it("forces the image upload placeholder only for the active Content", () => {
		const element = Object.create(ImageElement.prototype) as any
		const placeholder = { type: "upload-placeholder" }
		const state = replacementState("content-1")
		element.data = {
			id: "image-1",
			type: ElementTypeEnum.Image,
			activeContentId: "content-1",
			mainContentId: "content-1",
			contents: [
				{ contentId: "content-1", src: "images/old.png" },
				{ contentId: "content-2", src: "images/other.png" },
			],
		}
		element.canvas = {
			mediaReplaceController: { getReplacementState: vi.fn(() => state) },
		}
		element.renderGeneratingPlaceholder = vi.fn(() => placeholder)

		expect(element.render()).toBe(placeholder)
		expect(element.renderGeneratingPlaceholder).toHaveBeenCalledTimes(1)

		element.data.activeContentId = "content-2"
		element.renderGeneratingPlaceholder.mockClear()
		element.renderLoadingPlaceholder = vi.fn(() => ({ type: "loading" }))
		expect(element.isReplacementUploadingActiveContent()).toBe(false)
		expect(element.renderGeneratingPlaceholder).not.toHaveBeenCalled()

		state.source = "project-file"
		element.data.activeContentId = "content-1"
		expect(element.isReplacementUploadingActiveContent()).toBe(false)
	})

	it("forces the video upload placeholder only for local upload", () => {
		const element = Object.create(VideoElement.prototype) as any
		element.data = {
			id: "image-1",
			type: ElementTypeEnum.Video,
			activeContentId: "content-1",
			mainContentId: "content-1",
			contents: [{ contentId: "content-1", src: "videos/old.mp4" }],
		}
		element.canvas = {
			mediaReplaceController: {
				getReplacementState: vi.fn(() => ({
					...replacementState("content-1"),
					mediaType: ElementTypeEnum.Video,
				})),
			},
		}
		element.getText = vi.fn((_key: string, fallback: string) => fallback)

		const state = element.resolveRenderState()
		expect(state).toEqual({
			stage: "uploading",
			placeholderMode: "loading",
			text: "正在上传中...",
		})

		element.canvas.mediaReplaceController.getReplacementState = vi.fn(() => ({
			...replacementState("content-1", "project-file"),
			mediaType: ElementTypeEnum.Video,
		}))
		element.renderer = { hasPreview: vi.fn(() => true) }
		expect(element.resolveRenderState()).toEqual({ stage: "ready" })
	})
})
