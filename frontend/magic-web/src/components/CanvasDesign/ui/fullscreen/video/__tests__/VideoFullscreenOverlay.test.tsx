import { StrictMode } from "react"
import { act, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ElementTypeEnum, type VideoElement } from "../../../../runtime/document/types"
import VideoFullscreenOverlay from "../index"

const mocks = vi.hoisted(() => {
	class MockVideoElement {}

	return {
		MockVideoElement,
		canvas: null as Record<string, unknown> | null,
		element: null as VideoElement | null,
	}
})

vi.mock("../../../../app/hooks/canvas", () => ({
	useCanvasElement: () => mocks.element,
}))

vi.mock("../../../../app/providers/CanvasProvider", () => ({
	useCanvas: () => ({ canvas: mocks.canvas }),
}))

vi.mock("../../../../runtime/elements/video/VideoElement", () => ({
	VideoElement: mocks.MockVideoElement,
}))

vi.mock("../VideoFullscreenPlayerOverlay", () => ({
	default: ({
		videoElement,
		hasError,
		playbackEnabled,
		src,
	}: {
		videoElement?: HTMLVideoElement | null
		hasError?: boolean
		playbackEnabled?: boolean
		src?: string
	}) => (
		<div
			data-testid="fullscreen-player"
			data-has-video={String(Boolean(videoElement))}
			data-has-error={String(Boolean(hasError))}
			data-playback-enabled={String(playbackEnabled)}
			data-src={src}
		/>
	),
}))

function deferred<T>() {
	let resolve!: (value: T) => void
	const promise = new Promise<T>((promiseResolve) => {
		resolve = promiseResolve
	})
	return { promise, resolve }
}

describe("VideoFullscreenOverlay", () => {
	beforeEach(() => {
		mocks.element = {
			id: "video-1",
			type: ElementTypeEnum.Video,
			x: 0,
			y: 0,
			width: 320,
			height: 180,
			contents: [{ contentId: "video-content-1", src: "./videos/a.mp4" }],
			activeContentId: "video-content-1",
			mainContentId: "video-content-1",
		}
	})

	it("does not let a stale StrictMode acquire release the replayed acquire", async () => {
		const firstAcquire = deferred<HTMLVideoElement | null>()
		const secondAcquire = deferred<HTMLVideoElement | null>()
		const fullscreenVideo = document.createElement("video")
		const acquireFullscreenPlayback = vi
			.fn()
			.mockReturnValueOnce(firstAcquire.promise)
			.mockReturnValueOnce(secondAcquire.promise)
		const releaseFullscreenPlayback = vi.fn()
		const elementInstance = Object.assign(new mocks.MockVideoElement(), {
			handoffPlaybackToFullscreen: vi.fn(() => null),
			handoffPlaybackFromFullscreen: vi.fn(() => null),
			acquireFullscreenPlayback,
			releaseFullscreenPlayback,
		})

		mocks.canvas = {
			elementManager: {
				getElementInstance: vi.fn(() => elementInstance),
			},
			videoResourceManager: {
				getCachedMetadata: vi.fn(() => null),
			},
		}

		render(
			<StrictMode>
				<VideoFullscreenOverlay elementId="video-1" onClose={vi.fn()} />
			</StrictMode>,
		)

		await waitFor(() => {
			expect(acquireFullscreenPlayback).toHaveBeenCalledTimes(2)
		})
		expect(releaseFullscreenPlayback).toHaveBeenCalledTimes(1)

		await act(async () => {
			firstAcquire.resolve(null)
			await firstAcquire.promise
		})

		expect(releaseFullscreenPlayback).toHaveBeenCalledTimes(1)

		await act(async () => {
			secondAcquire.resolve(fullscreenVideo)
			await secondAcquire.promise
		})

		await waitFor(() => {
			expect(screen.getByTestId("fullscreen-player")).toHaveAttribute(
				"data-has-video",
				"true",
			)
			expect(screen.getByTestId("fullscreen-player")).toHaveAttribute(
				"data-has-error",
				"false",
			)
		})
		expect(releaseFullscreenPlayback).toHaveBeenCalledTimes(1)
	})

	it("keeps a static source without acquiring playback when the capability is absent", async () => {
		const acquireFullscreenPlayback = vi.fn()
		const elementInstance = Object.assign(new mocks.MockVideoElement(), {
			handoffPlaybackToFullscreen: vi.fn(() => null),
			acquireFullscreenPlayback,
			releaseFullscreenPlayback: vi.fn(),
		})
		mocks.canvas = {
			elementManager: {
				getElementInstance: vi.fn(() => elementInstance),
			},
			permissionManager: { can: vi.fn(() => false) },
			videoResourceManager: {
				getCachedMetadata: vi.fn(() => null),
			},
		}

		render(<VideoFullscreenOverlay elementId="video-1" onClose={vi.fn()} />)

		await waitFor(() => {
			expect(screen.getByTestId("fullscreen-player")).toHaveAttribute(
				"data-playback-enabled",
				"false",
			)
		})
		expect(screen.getByTestId("fullscreen-player")).toHaveAttribute(
			"data-src",
			"./videos/a.mp4",
		)
		expect(acquireFullscreenPlayback).not.toHaveBeenCalled()
	})
})
