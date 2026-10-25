import { describe, expect, it, vi } from "vitest"
import type { Canvas } from "../../../core/Canvas"
import { AudioResourceManager } from "../AudioResourceManager"

function createManager(getFileInfo: ReturnType<typeof vi.fn>) {
	const mediaResourceOfflineCacheManager = {
		getCachedResource: vi.fn().mockResolvedValue(null),
		isVirtualResourceUrl: vi.fn().mockReturnValue(false),
		removeCachedResource: vi.fn(),
		resolveResourceUrl: vi.fn(async (params: { url: string }) => params.url),
		shouldBypassVirtualResource: vi.fn().mockReturnValue(false),
	}
	const eventEmitter = { emit: vi.fn() }
	const audioPlaybackManager = { releaseByPath: vi.fn() }
	const visibilityManager = { invalidateAudioLoadRequest: vi.fn() }
	const manager = new AudioResourceManager({
		canvas: {
			magicConfigManager: { config: { methods: { getFileInfo } } },
			canvasFileUploadManager: { shouldDeferRemoteResourceLoad: vi.fn(() => false) },
			mediaResourceOfflineCacheManager,
			eventEmitter,
			audioPlaybackManager,
			visibilityManager,
		} as unknown as Canvas,
	})
	return {
		audioPlaybackManager,
		eventEmitter,
		manager,
		mediaResourceOfflineCacheManager,
		visibilityManager,
	}
}

describe("AudioResourceManager", () => {
	it("caches resolved URLs and refreshes them on demand without image processing", async () => {
		const getFileInfo = vi
			.fn()
			.mockResolvedValueOnce({
				src: "https://example.test/voice-v1.mp3",
				fileName: "voice.mp3",
				expires_at: "2030-01-01 00:00:00",
			})
			.mockResolvedValueOnce({
				src: "https://example.test/voice-v2.mp3",
				fileName: "voice.mp3",
				expires_at: "2030-01-02 00:00:00",
			})
		const { manager, mediaResourceOfflineCacheManager } = createManager(getFileInfo)

		expect(await manager.getResource("./audios/voice.mp3")).toMatchObject({
			ossSrc: "https://example.test/voice-v1.mp3",
			fileName: "voice.mp3",
		})
		expect(await manager.getResource("./audios/voice.mp3")).toMatchObject({
			ossSrc: "https://example.test/voice-v1.mp3",
		})
		expect(getFileInfo).toHaveBeenCalledTimes(1)

		expect(
			await manager.getResource("./audios/voice.mp3", { forceRefresh: true }),
		).toMatchObject({ ossSrc: "https://example.test/voice-v2.mp3" })
		expect(getFileInfo).toHaveBeenLastCalledWith("./audios/voice.mp3", {
			useImageProcess: false,
			forceRefresh: true,
			priority: "critical",
		})
		expect(mediaResourceOfflineCacheManager.removeCachedResource).toHaveBeenCalledWith({
			path: "./audios/voice.mp3",
			mediaType: "audio",
		})
	})

	it("records file deletion as runtime failure state", async () => {
		const error = Object.assign(new Error("File not found for path"), {
			code: "canvas-design/get-file-info-not-found",
		})
		const { audioPlaybackManager, eventEmitter, manager, mediaResourceOfflineCacheManager } =
			createManager(vi.fn().mockRejectedValue(error))

		expect(await manager.getResource("./audios/missing.mp3")).toBeNull()
		expect(manager.getFailureReason("./audios/missing.mp3")).toBe("not-found")
		expect(mediaResourceOfflineCacheManager.removeCachedResource).toHaveBeenCalledWith({
			path: "./audios/missing.mp3",
			mediaType: "audio",
		})
		expect(eventEmitter.emit).toHaveBeenCalledWith({
			type: "resource:audio:load-failed",
			data: { path: "./audios/missing.mp3", reason: "not-found" },
		})
		expect(audioPlaybackManager.releaseByPath).toHaveBeenCalledWith("./audios/missing.mp3")
	})

	it("uses cached audio while offline and keeps the virtual URL", async () => {
		const { manager, mediaResourceOfflineCacheManager } = createManager(
			vi.fn().mockRejectedValue(new Error("offline")),
		)
		mediaResourceOfflineCacheManager.getCachedResource.mockResolvedValue({
			url: "https://canvas.test/sw/canvas-design-media/project/audio/design-resource/audios/a.mp3",
			path: "audios/a.mp3",
			mediaType: "audio",
		})
		mediaResourceOfflineCacheManager.isVirtualResourceUrl.mockReturnValue(true)

		expect(await manager.getResource("./audios/a.mp3")).toMatchObject({
			ossSrc: "https://canvas.test/sw/canvas-design-media/project/audio/design-resource/audios/a.mp3",
		})
	})

	it("invalidates the old body and playback session when resource_version changes", async () => {
		const getFileInfo = vi
			.fn()
			.mockResolvedValueOnce({
				src: "https://example.test/voice-v1.mp3",
				fileName: "voice.mp3",
				resource_version: "v1",
			})
			.mockResolvedValueOnce({
				src: "https://example.test/voice-v2.mp3",
				fileName: "voice.mp3",
				resource_version: "v2",
			})
		const {
			audioPlaybackManager,
			manager,
			mediaResourceOfflineCacheManager,
			visibilityManager,
		} = createManager(getFileInfo)

		await manager.getResource("./audios/voice.mp3")
		mediaResourceOfflineCacheManager.removeCachedResource.mockClear()
		await manager.getResource("./audios/voice.mp3", { forceRefresh: true })

		expect(mediaResourceOfflineCacheManager.removeCachedResource).toHaveBeenCalledWith({
			path: "./audios/voice.mp3",
			mediaType: "audio",
		})
		expect(audioPlaybackManager.releaseByPath).toHaveBeenCalledWith("./audios/voice.mp3", {
			preserveMetadata: true,
		})
		expect(visibilityManager.invalidateAudioLoadRequest).toHaveBeenCalledWith(
			"./audios/voice.mp3",
			"resource-version-changed",
		)
	})

	it("keeps the current audio resource when an older refresh is superseded", async () => {
		let resolveFirst!: (value: Record<string, unknown>) => void
		let resolveSecond!: (value: Record<string, unknown>) => void
		const first = new Promise<Record<string, unknown>>((resolve) => {
			resolveFirst = resolve
		})
		const second = new Promise<Record<string, unknown>>((resolve) => {
			resolveSecond = resolve
		})
		const getFileInfo = vi.fn().mockReturnValueOnce(first).mockReturnValueOnce(second)
		const { audioPlaybackManager, eventEmitter, manager } = createManager(getFileInfo)

		const oldRequest = manager.getResource("./audios/voice.mp3", { forceRefresh: true })
		const currentRequest = manager.getResource("./audios/voice.mp3", { forceRefresh: true })

		resolveSecond({
			src: "https://example.test/voice-v2.mp3",
			fileName: "voice.mp3",
			resource_version: "v2",
		})
		await expect(currentRequest).resolves.toMatchObject({
			ossSrc: "https://example.test/voice-v2.mp3",
			resourceVersion: "v2",
		})

		resolveFirst({
			src: "https://example.test/voice-v1.mp3",
			fileName: "voice.mp3",
			resource_version: "v1",
		})
		await expect(oldRequest).resolves.toMatchObject({
			ossSrc: "https://example.test/voice-v2.mp3",
			resourceVersion: "v2",
		})

		expect(manager.getFailureReason("./audios/voice.mp3")).toBeNull()
		expect(eventEmitter.emit).not.toHaveBeenCalled()
		expect(audioPlaybackManager.releaseByPath).not.toHaveBeenCalled()
	})

	it("promotes an uploaded direct URL to a virtual audio URL without fetching the body", async () => {
		const { manager, mediaResourceOfflineCacheManager } = createManager(vi.fn())
		mediaResourceOfflineCacheManager.resolveResourceUrl.mockResolvedValue(
			"https://canvas.test/sw/canvas-design-media/project/audio/design-resource/audios/a.mp3",
		)

		manager.primeCache("./audios/a.mp3", {
			src: "https://example.test/uploaded.mp3",
			fileName: "a.mp3",
		} as never)

		await vi.waitFor(() => {
			expect(mediaResourceOfflineCacheManager.resolveResourceUrl).toHaveBeenCalledWith(
				expect.objectContaining({
					path: "./audios/a.mp3",
					url: "https://example.test/uploaded.mp3",
					mediaType: "audio",
				}),
				{ preferVirtualResource: true },
			)
		})
		expect(await manager.getResource("./audios/a.mp3")).toMatchObject({
			ossSrc: "https://canvas.test/sw/canvas-design-media/project/audio/design-resource/audios/a.mp3",
		})
	})
})
