import { describe, expect, it, vi } from "vitest"
import type { Canvas } from "../../core/Canvas"
import { CanvasResourceScheduler } from "../scheduler/CanvasResourceScheduler"
import { VideoPlaybackManager } from "../video/VideoPlaybackManager"

function createCanvas(resourceScheduler: CanvasResourceScheduler) {
	return {
		id: "canvas-1",
		magicConfigManager: { config: { methods: {} } },
		resourceScheduler,
		videoResourceManager: {
			ensureFreshOssInfo: vi.fn().mockResolvedValue({
				ossSrc: "https://example.test/video.mp4",
				expiresAt: null,
			}),
			resolveVirtualPlaybackFallbackOssInfo: vi.fn().mockResolvedValue(null),
		},
		mediaResourceOfflineCacheManager: {
			rememberResolvedResource: vi.fn(),
		},
	} as unknown as Canvas
}

describe("VideoPlaybackManager pending acquire lifecycle", () => {
	it("rejects autoplay acquisition when playback capability is unavailable", async () => {
		const scheduler = new CanvasResourceScheduler()
		const canvas = createCanvas(scheduler)
		canvas.permissionManager = {
			can: vi.fn(() => false),
		} as Canvas["permissionManager"]
		const manager = new VideoPlaybackManager({ canvas })

		try {
			await expect(
				manager.acquire("./videos/a.mp4", "video:inline:denied", { autoPlay: true }),
			).resolves.toBeNull()
			expect(canvas.videoResourceManager.ensureFreshOssInfo).not.toHaveBeenCalled()
		} finally {
			manager.destroy()
			scheduler.destroy()
		}
	})

	it("creates a tracked playback session after the video becomes ready", async () => {
		const scheduler = new CanvasResourceScheduler()
		const canvas = createCanvas(scheduler)
		const manager = new VideoPlaybackManager({ canvas })
		const video = document.createElement("video")
		vi.spyOn(video, "load").mockImplementation(() => undefined)
		const pause = vi.spyOn(video, "pause").mockImplementation(() => undefined)
		const createElement = vi.spyOn(document, "createElement").mockReturnValue(video)

		try {
			const acquirePromise = manager.acquire("./videos/a.mp4", "video:inline:ready")
			await vi.waitFor(() => expect(createElement).toHaveBeenCalledWith("video"))
			video.dispatchEvent(new Event("loadeddata"))

			const session = await acquirePromise
			expect(session?.video).toBe(video)
			expect(manager.getSession("video:inline:ready")).toBe(session)

			manager.destroy()
			expect(pause).toHaveBeenCalled()
			expect(manager.getSession("video:inline:ready")).toBeUndefined()
		} finally {
			createElement.mockRestore()
			scheduler.destroy()
		}
	})

	it("aborts a pending acquire in the Canvas destroy order", async () => {
		const scheduler = new CanvasResourceScheduler()
		const canvas = createCanvas(scheduler)
		const manager = new VideoPlaybackManager({ canvas })
		const video = document.createElement("video")
		const load = vi.spyOn(video, "load").mockImplementation(() => undefined)
		const pause = vi.spyOn(video, "pause").mockImplementation(() => undefined)
		const createElement = vi.spyOn(document, "createElement").mockReturnValue(video)

		try {
			const acquirePromise = manager.acquire("./videos/a.mp4", "video:inline:1")
			await vi.waitFor(() => expect(createElement).toHaveBeenCalledWith("video"))
			expect(scheduler.getSnapshot()).toEqual(
				expect.objectContaining({
					activeTotal: 1,
					activeByKind: expect.objectContaining({ "video:playback-acquire": 1 }),
				}),
			)

			// Canvas.destroy() tears down the shared scheduler before the playback manager.
			scheduler.destroy()
			manager.destroy()

			await expect(acquirePromise).resolves.toBeNull()
			expect(pause).toHaveBeenCalled()
			expect(load).toHaveBeenCalled()
			expect(manager.getSession("video:inline:1")).toBeUndefined()
			expect(scheduler.getSnapshot()).toEqual(
				expect.objectContaining({
					activeTotal: 0,
					activeByKind: expect.objectContaining({ "video:playback-acquire": 0 }),
				}),
			)
		} finally {
			createElement.mockRestore()
			scheduler.destroy()
		}
	})

	it("cancels a pending acquire when its consumer is released", async () => {
		const scheduler = new CanvasResourceScheduler()
		const canvas = createCanvas(scheduler)
		const manager = new VideoPlaybackManager({ canvas })
		const video = document.createElement("video")
		vi.spyOn(video, "load").mockImplementation(() => undefined)
		vi.spyOn(video, "pause").mockImplementation(() => undefined)
		const createElement = vi.spyOn(document, "createElement").mockReturnValue(video)

		try {
			const acquirePromise = manager.acquire("./videos/a.mp4", "video:inline:2")
			await vi.waitFor(() => expect(createElement).toHaveBeenCalledWith("video"))

			manager.release("video:inline:2")

			await expect(acquirePromise).resolves.toBeNull()
			expect(manager.getSession("video:inline:2")).toBeUndefined()
			expect(scheduler.getSnapshot()).toEqual(expect.objectContaining({ activeTotal: 0 }))
		} finally {
			createElement.mockRestore()
			scheduler.destroy()
		}
	})
})
