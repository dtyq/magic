import { renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
	canvas: {
		audioResourceManager: {
			getResource: vi.fn(),
		},
		canvasFileUploadManager: {
			getRemoteResourceLoadDeferralKey: vi.fn(),
			shouldDeferRemoteResourceLoad: vi.fn(() => false),
		},
		magicConfigManager: {
			config: {
				methods: {
					getFileInfo: vi.fn(),
				},
			},
		},
	},
}))

vi.mock("../../../../app/providers/CanvasProvider", () => ({
	useCanvas: () => ({ canvas: mocks.canvas }),
}))

vi.mock("../../../../app/hooks/canvas", () => ({
	useCanvasEvent: vi.fn(),
}))

import { useResolvedFilePreviewSrc } from "../useResolvedMediaPreviewSrc"

describe("useResolvedFilePreviewSrc", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mocks.canvas.canvasFileUploadManager.shouldDeferRemoteResourceLoad.mockReturnValue(false)
	})

	it("resolves asset audio through AudioResourceManager", async () => {
		mocks.canvas.audioResourceManager.getResource.mockResolvedValue({
			ossSrc: "https://assets.test/audio-id.mp3",
		})

		const { result } = renderHook(() => useResolvedFilePreviewSrc("asset://audio-id"))

		await waitFor(() => {
			expect(result.current).toEqual({
				src: "https://assets.test/audio-id.mp3",
				isLoading: false,
				hasError: false,
			})
		})
		expect(mocks.canvas.audioResourceManager.getResource).toHaveBeenCalledWith(
			"asset://audio-id",
			{ priority: "critical" },
		)
		expect(mocks.canvas.magicConfigManager.config.methods.getFileInfo).not.toHaveBeenCalled()
	})

	it("reports an error when the audio resource is unavailable", async () => {
		mocks.canvas.audioResourceManager.getResource.mockResolvedValue(null)

		const { result } = renderHook(() => useResolvedFilePreviewSrc("asset://missing-audio"))

		await waitFor(() => {
			expect(result.current).toEqual({
				src: undefined,
				isLoading: false,
				hasError: true,
			})
		})
	})
})
