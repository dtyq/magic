import { renderHook, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ElementTypeEnum } from "../../../../../runtime/document/types"
import useShowMediaOriginalSizeButton from "../useShowMediaOriginalSizeButton"

function createOptions(overrides: Record<string, unknown> = {}) {
	return {
		canvas: {
			imageResourceManager: {
				getResource: vi.fn(async () => ({
					imageInfo: { naturalWidth: 1600, naturalHeight: 900 },
				})),
			},
			videoResourceManager: {
				getPreviewResource: vi.fn(async () => ({
					metadata: { videoWidth: 1600, videoHeight: 900 },
				})),
			},
		},
		isSingleElement: true,
		elementType: ElementTypeEnum.Image,
		elementId: "image-1",
		mediaSrc: "./images/image.png",
		elementWidth: 100,
		elementHeight: 100,
		...overrides,
	} as never
}

describe("useShowMediaOriginalSizeButton", () => {
	it("uses image natural dimensions", async () => {
		const options = createOptions()
		const { result } = renderHook(() => useShowMediaOriginalSizeButton(options))

		await waitFor(() => expect(result.current).toBe(true))
		expect(options.canvas.imageResourceManager.getResource).toHaveBeenCalledWith(
			"./images/image.png",
			{ variant: "preview" },
		)
	})

	it("uses video metadata and hides when the ratio already matches", async () => {
		const options = createOptions({
			elementType: ElementTypeEnum.Video,
			mediaSrc: "./videos/video.mp4",
			elementWidth: 1600,
			elementHeight: 900,
		})
		const { result } = renderHook(() => useShowMediaOriginalSizeButton(options))

		await waitFor(() =>
			expect(options.canvas.videoResourceManager.getPreviewResource).toHaveBeenCalled(),
		)
		expect(result.current).toBe(false)
		expect(options.canvas.videoResourceManager.getPreviewResource).toHaveBeenCalledWith(
			"./videos/video.mp4",
		)
	})

	it("hides when the media resource cannot provide dimensions", async () => {
		const options = createOptions({
			canvas: {
				imageResourceManager: { getResource: vi.fn(async () => null) },
				videoResourceManager: { getPreviewResource: vi.fn(async () => null) },
			},
		})
		const { result } = renderHook(() => useShowMediaOriginalSizeButton(options))

		await waitFor(() => expect(result.current).toBe(false))
	})
})
