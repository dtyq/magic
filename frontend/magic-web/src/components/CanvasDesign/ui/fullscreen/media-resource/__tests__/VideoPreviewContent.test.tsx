import { render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import VideoPreviewContent from "../VideoPreviewContent"

const mocks = vi.hoisted(() => ({
	canvas: null as Record<string, unknown> | null,
}))

vi.mock("../../../../app/providers/CanvasProvider", () => ({
	useCanvas: () => ({ canvas: mocks.canvas }),
}))

vi.mock("../../../../app/providers/I18nProvider", () => ({
	useCanvasDesignI18n: () => ({
		t: (_key: string, fallback: string) => fallback,
	}),
}))

vi.mock("../../video/VideoFullscreenPlayerOverlay", () => ({
	default: ({
		videoElement,
		playbackEnabled,
	}: {
		videoElement?: HTMLVideoElement | null
		playbackEnabled?: boolean
	}) => (
		<div
			data-testid="resource-video-player"
			data-has-video={String(Boolean(videoElement))}
			data-playback-enabled={String(playbackEnabled)}
		/>
	),
}))

describe("VideoPreviewContent playback capability", () => {
	beforeEach(() => {
		mocks.canvas = null
	})

	it("loads a static video session without autoplay when playback is unavailable", async () => {
		const video = document.createElement("video")
		vi.spyOn(video, "pause").mockImplementation(() => undefined)
		const acquire = vi.fn().mockResolvedValue({ video })
		mocks.canvas = {
			videoPlaybackManager: {
				acquire,
				getVideoElement: vi.fn(() => video),
				release: vi.fn(),
				subscribeConsumerState: vi.fn((_consumerId, listener) => {
					listener({ isRefreshing: false })
					return () => undefined
				}),
			},
			videoResourceManager: {
				getCachedMetadata: vi.fn(() => null),
			},
		}

		render(
			<VideoPreviewContent
				resource={{ kind: "video", path: "./videos/demo.mp4", fileName: "demo.mp4" }}
				playbackEnabled={false}
				onClose={vi.fn()}
			/>,
		)

		await waitFor(() => {
			expect(acquire).toHaveBeenCalledWith(
				"./videos/demo.mp4",
				expect.stringMatching(/^video:resource-preview:/),
				{ autoPlay: false },
			)
			expect(screen.getByTestId("resource-video-player")).toHaveAttribute(
				"data-has-video",
				"true",
			)
		})
		expect(screen.getByTestId("resource-video-player")).toHaveAttribute(
			"data-playback-enabled",
			"false",
		)
	})

	it("rebinds the preview without autoplay after playback permission is revoked", async () => {
		const video = document.createElement("video")
		const pause = vi.spyOn(video, "pause").mockImplementation(() => undefined)
		const acquire = vi.fn().mockResolvedValue({ video })
		const release = vi.fn()
		mocks.canvas = {
			videoPlaybackManager: {
				acquire,
				getVideoElement: vi.fn(() => video),
				release,
				subscribeConsumerState: vi.fn(() => () => undefined),
			},
			videoResourceManager: {
				getCachedMetadata: vi.fn(() => null),
			},
		}

		const { rerender } = render(
			<VideoPreviewContent
				resource={{ kind: "video", path: "./videos/demo.mp4", fileName: "demo.mp4" }}
				playbackEnabled
				onClose={vi.fn()}
			/>,
		)

		await waitFor(() => expect(acquire).toHaveBeenCalledTimes(1))
		rerender(
			<VideoPreviewContent
				resource={{ kind: "video", path: "./videos/demo.mp4", fileName: "demo.mp4" }}
				playbackEnabled={false}
				onClose={vi.fn()}
			/>,
		)

		await waitFor(() => {
			expect(acquire).toHaveBeenCalledTimes(2)
			expect(acquire.mock.calls[1]?.[2]).toEqual({ autoPlay: false })
		})
		expect(pause).toHaveBeenCalled()
		expect(release).toHaveBeenCalled()
	})
})
