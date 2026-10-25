import { describe, expect, it, vi } from "vitest"
import type { Canvas } from "../../../core/Canvas"
import { VideoElement } from "../../../elements/video/VideoElement"
import { MediaPlaybackCoordinator } from "../MediaPlaybackCoordinator"

describe("MediaPlaybackCoordinator", () => {
	it("coordinates other media before fullscreen video playback starts", async () => {
		const preparePlayback = vi.fn()
		const fullscreenVideo = document.createElement("video")
		const handoff = vi.fn(() => ({ video: fullscreenVideo }))
		const acquire = vi.fn().mockResolvedValue({ video: fullscreenVideo })
		const element = Object.create(VideoElement.prototype) as unknown as {
			canvas: {
				permissionManager: { can: ReturnType<typeof vi.fn> }
				mediaPlaybackCoordinator: { preparePlayback: typeof preparePlayback }
				videoPlaybackManager: {
					handoff: typeof handoff
					acquire: typeof acquire
				}
			}
			data: {
				id: string
				contents: Array<{ contentId: string; src?: string }>
				activeContentId: string
				mainContentId: string
			}
			syncPlaybackAttachment: ReturnType<typeof vi.fn>
			handoffPlaybackToFullscreen: () => HTMLVideoElement | null
			acquireFullscreenPlayback: () => Promise<HTMLVideoElement | null>
		}
		element.data = {
			id: "video-1",
			contents: [{ contentId: "video-1-content", src: "./videos/a.mp4" }],
			activeContentId: "video-1-content",
			mainContentId: "video-1-content",
		}
		element.canvas = {
			permissionManager: { can: vi.fn(() => true) },
			mediaPlaybackCoordinator: { preparePlayback },
			videoPlaybackManager: { handoff, acquire },
		}
		element.syncPlaybackAttachment = vi.fn()

		expect(element.handoffPlaybackToFullscreen()).toBe(fullscreenVideo)
		expect(preparePlayback).toHaveBeenNthCalledWith(1, "video-1")
		expect(handoff).toHaveBeenCalledWith("video:inline:video-1", "video:fullscreen:video-1")

		expect(await element.acquireFullscreenPlayback()).toBe(fullscreenVideo)
		expect(preparePlayback).toHaveBeenNthCalledWith(2, "video-1")
		expect(acquire).toHaveBeenCalledWith("./videos/a.mp4", "video:fullscreen:video-1", {
			autoPlay: true,
		})
	})

	it("pauses other audio and video sessions before playback", () => {
		const pauseAllAudio = vi.fn()
		const pauseAllVideo = vi.fn()
		const getAllElementIds = vi.fn(() => ["video-1", "video-2"])
		const canvas = {
			eventEmitter: { on: vi.fn(() => vi.fn()) },
			audioPlaybackManager: {
				pauseAll: pauseAllAudio,
				releaseAll: vi.fn(),
			},
			videoPlaybackManager: { pauseAll: pauseAllVideo },
			elementManager: {
				getAllElementIds,
			},
		} as unknown as Canvas
		const coordinator = new MediaPlaybackCoordinator({ canvas })

		coordinator.preparePlayback("video-1")

		expect(pauseAllAudio).toHaveBeenCalledWith("video-1")
		expect(pauseAllVideo).toHaveBeenCalledWith("video-1")
		expect(getAllElementIds).not.toHaveBeenCalled()
	})

	it("pauses and releases media when the selection is cleared", () => {
		let handleDeselect!: () => void
		const unsubscribe = vi.fn()
		const pauseAllAudio = vi.fn()
		const pauseAllVideo = vi.fn()
		const releaseAllAudio = vi.fn()
		const canvas = {
			eventEmitter: {
				on: vi.fn((_eventName: string, handler: () => void) => {
					handleDeselect = handler
					return unsubscribe
				}),
			},
			audioPlaybackManager: {
				pauseAll: pauseAllAudio,
				releaseAll: releaseAllAudio,
			},
			videoPlaybackManager: { pauseAll: pauseAllVideo },
		} as unknown as Canvas
		const coordinator = new MediaPlaybackCoordinator({ canvas })

		handleDeselect()

		expect(pauseAllAudio).toHaveBeenCalledWith(undefined)
		expect(pauseAllVideo).toHaveBeenCalledWith(undefined)
		expect(releaseAllAudio).toHaveBeenCalledWith(undefined, { preserveMetadata: true })
		coordinator.destroy()
		expect(unsubscribe).toHaveBeenCalledTimes(1)
	})
})
