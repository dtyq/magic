import { describe, expect, it, vi } from "vitest"
import { VideoElement } from "../../elements/video/VideoElement"
import { isUsableVideoPosterSource, VideoResourceManager } from "../video/VideoResourceManager"

function deferred<T>() {
	let resolve!: (value: T) => void
	return {
		promise: new Promise<T>((promiseResolve) => {
			resolve = promiseResolve
		}),
		resolve,
	}
}

describe("VideoResourceManager", () => {
	it("forwards the viewport priority when resolving the preview URL", async () => {
		const ensureFreshOssSrc = vi.fn().mockResolvedValue("https://oss.test/video.mp4")
		const loadVideoResource = vi.fn().mockResolvedValue({ marker: "loaded" })
		const manager = Object.create(VideoResourceManager.prototype) as Record<string, unknown>
		manager.destroyed = false
		manager.canvas = {
			magicConfigManager: { config: { methods: { getFileInfo: vi.fn() } } },
		}
		manager.loadCachedVideoResource = vi.fn().mockResolvedValue(null)
		manager.shouldDropAbortedLoad = vi.fn(() => false)
		manager.clearCachedFallbackOssSrc = vi.fn()
		manager.ensureFreshOssSrc = ensureFreshOssSrc
		manager.loadVideoResource = loadVideoResource

		const result = await (
			manager as unknown as {
				loadVideoResourcePipeline: (
					path: string,
					normalizedPath: string,
					entry: Record<string, unknown>,
					options: { priority: "near" },
				) => Promise<unknown>
			}
		).loadVideoResourcePipeline("./videos/a.mp4", "videos/a.mp4", {}, { priority: "near" })

		expect(ensureFreshOssSrc).toHaveBeenCalledWith("./videos/a.mp4", {
			priority: "near",
		})
		expect(result).toEqual({ marker: "loaded" })
	})

	it("drops video loads when their signal is already aborted", async () => {
		const manager = Object.create(VideoResourceManager.prototype) as Record<string, unknown>
		const controller = new AbortController()
		const increment = vi.fn()
		controller.abort()
		manager.destroyed = false
		manager.canvas = {
			canvasFileUploadManager: { shouldDeferRemoteResourceLoad: vi.fn(() => false) },
		}
		manager.diagnostics = { increment }

		const result = await (
			manager as unknown as {
				loadVideoInternal: (
					path: string,
					options: { signal: AbortSignal },
				) => Promise<unknown>
			}
		).loadVideoInternal("./videos/aborted.mp4", { signal: controller.signal })

		expect(result).toBeNull()
		expect(increment).toHaveBeenCalledWith("staleRequestDropCount")
	})

	it("does not reuse an existing poster when cached metadata advances the version", async () => {
		const manager = Object.create(VideoResourceManager.prototype) as Record<string, unknown>
		const previousResource = {
			poster: document.createElement("canvas"),
			metadata: { duration: 1, videoWidth: 100, videoHeight: 100 },
		}
		const entry = {
			referencePath: "./videos/a.mp4",
			resourceIdentity: "videos/a.mp4",
			ossSrc: "/virtual/videos/a.mp4",
			resourceVersion: "v1",
			resource: previousResource,
			resourceNeedsReload: false,
		}
		manager.destroyed = false
		manager.markStaleRequestDrop = vi.fn()
		manager.urlLifecycle = {
			getCachedResource: vi.fn(async () => {
				entry.resourceVersion = "v2"
				entry.ossSrc = "/virtual/videos/a.mp4"
				entry.resourceNeedsReload = true
				return { url: "/virtual/videos/a.mp4" }
			}),
		}
		manager.loadVideoResource = vi.fn().mockResolvedValue({ marker: "decoded-v2" })

		const result = await (
			manager as unknown as {
				loadCachedVideoResource: (
					path: string,
					normalizedPath: string,
					targetEntry: typeof entry,
				) => Promise<unknown>
			}
		).loadCachedVideoResource("./videos/a.mp4", "videos/a.mp4", entry)

		expect(result).toEqual({ marker: "decoded-v2" })
		expect(manager.loadVideoResource).toHaveBeenCalledWith(
			"./videos/a.mp4",
			"videos/a.mp4",
			"/virtual/videos/a.mp4",
			entry,
			0,
			undefined,
		)
		expect(entry.resourceNeedsReload).toBe(true)
	})

	it("does not restore an old signed URL after a failed force refresh", async () => {
		const manager = Object.create(VideoResourceManager.prototype) as Record<string, unknown>
		const eventEmitter = { emit: vi.fn() }
		manager.destroyed = false
		manager.canvas = {
			mediaResourceOfflineCacheManager: { removeCachedResource: vi.fn() },
			eventEmitter,
		}
		manager.exchangeOssSrc = vi.fn().mockResolvedValue(null)
		manager.markStaleRequestDrop = vi.fn()
		const previousResource = {
			poster: document.createElement("canvas"),
			metadata: { duration: 1, videoWidth: 100, videoHeight: 100 },
		}
		const entry = {
			referencePath: "./videos/a.mp4",
			resourceIdentity: "videos/a.mp4",
			ossSrc: "https://oss.test/expired.mp4",
			ossSrcFromCachedFallback: false,
			sourceUrl: "https://oss.test/expired.mp4",
			expiresAt: Date.now() - 1,
			source: undefined,
			fileName: "video.mp4",
			resourceVersion: "v1",
			sourceUpdatedAt: null,
			contentLength: 1024,
			exchangePromise: null,
			loadingPromise: null,
			refreshPromise: null,
			resource: previousResource,
			backgroundRefreshPromise: null,
			lastFailureReason: "load-error",
			resourceNeedsReload: false,
		}

		const refreshed = await (
			manager as unknown as {
				refreshVideoResourceFromNetwork: (
					path: string,
					normalizedPath: string,
					targetEntry: typeof entry,
					options: { forceRefresh: true },
				) => Promise<boolean>
			}
		).refreshVideoResourceFromNetwork("./videos/a.mp4", "videos/a.mp4", entry, {
			forceRefresh: true,
		})

		expect(refreshed).toBe(false)
		expect(entry.resource).toBe(previousResource)
		expect(entry.ossSrc).toBeNull()
		expect(entry.sourceUrl).toBeNull()
		expect(entry.resourceNeedsReload).toBe(true)
		expect(eventEmitter.emit).toHaveBeenCalledWith({
			type: "resource:video:load-failed",
			data: {
				path: "./videos/a.mp4",
				reason: "load-error",
				preservePreview: true,
			},
		})
		;(manager.canvas as { canvasFileUploadManager: unknown }).canvasFileUploadManager = {
			shouldDeferRemoteResourceLoad: vi.fn(() => false),
		}
		manager.getResourceIdentity = vi.fn((path: string) => path)
		manager.getOrCreateEntry = vi.fn(() => entry)
		manager.clearExpiredOssSrc = vi.fn()
		manager.applyVirtualResourceBypass = vi.fn()
		manager.shouldDropAbortedLoad = vi.fn(() => false)
		manager.diagnostics = { increment: vi.fn() }
		manager.loadVideoResourcePipeline = vi.fn().mockResolvedValue({
			ossSrc: "https://oss.test/refreshed.mp4",
			poster: document.createElement("canvas"),
			metadata: previousResource.metadata,
		})

		await expect(
			(
				manager as unknown as {
					loadVideoInternal: (path: string) => Promise<unknown>
				}
			).loadVideoInternal("./videos/a.mp4"),
		).resolves.toMatchObject({ ossSrc: "https://oss.test/refreshed.mp4" })
		expect(manager.loadVideoResourcePipeline).toHaveBeenCalledOnce()
	})

	it("serializes refreshes for the same resource entry", async () => {
		const firstRefresh = deferred<boolean>()
		const secondRefresh = deferred<boolean>()
		const refreshVideoResourceFromNetwork = vi
			.fn()
			.mockReturnValueOnce(firstRefresh.promise)
			.mockReturnValueOnce(secondRefresh.promise)
		const entry = {
			loadingPromise: null,
			refreshPromise: null as Promise<boolean> | null,
		}
		const manager = Object.create(VideoResourceManager.prototype) as Record<string, unknown>
		manager.destroyed = false
		manager.diagnostics = { increment: vi.fn() }
		manager.getResourceIdentity = vi.fn(() => "videos/a.mp4")
		manager.getOrCreateEntry = vi.fn(() => entry)
		manager.refreshVideoResourceFromNetwork = refreshVideoResourceFromNetwork

		const refreshResource = (
			manager as unknown as { refreshResource: (path: string) => Promise<boolean> }
		).refreshResource.bind(manager)
		const firstRequest = refreshResource("./videos/a.mp4")
		const secondRequest = refreshResource("./videos/a.mp4")

		expect(refreshVideoResourceFromNetwork).toHaveBeenCalledTimes(1)
		firstRefresh.resolve(true)
		await expect(firstRequest).resolves.toBe(true)
		await vi.waitFor(() => expect(refreshVideoResourceFromNetwork).toHaveBeenCalledTimes(2))
		secondRefresh.resolve(true)
		await expect(secondRequest).resolves.toBe(true)
	})

	it("drops a decoded poster when a newer URL generation wins", async () => {
		const stalePoster = document.createElement("canvas")
		stalePoster.width = 100
		stalePoster.height = 100
		const manager = Object.create(VideoResourceManager.prototype) as Record<string, unknown>
		manager.destroyed = false
		manager.managerInstanceId = 1
		manager.diagnostics = { increment: vi.fn() }
		manager.markStaleRequestDrop = vi.fn()
		manager.shouldDropAbortedLoad = vi.fn(() => false)
		manager.canvas = {
			id: "canvas",
			resourceScheduler: {
				run: vi.fn().mockResolvedValue({
					ossSrc: "https://oss.test/old.mp4",
					poster: stalePoster,
					metadata: { duration: 1, videoWidth: 100, videoHeight: 100 },
				}),
			},
			mediaResourceOfflineCacheManager: {
				recordVirtualResourceLoadSuccess: vi.fn(),
			},
			eventEmitter: { emit: vi.fn() },
		}
		const entry = {
			ossSrc: "https://oss.test/new.mp4",
			resource: null,
			resourceNeedsReload: true,
			lastFailureReason: null,
		}

		const result = await (
			manager as unknown as {
				loadVideoResource: (
					path: string,
					normalizedPath: string,
					ossSrc: string,
					targetEntry: typeof entry,
				) => Promise<unknown>
			}
		).loadVideoResource("./videos/a.mp4", "videos/a.mp4", "https://oss.test/old.mp4", entry)

		expect(result).toBeNull()
		expect(entry.resource).toBeNull()
		expect(stalePoster.width).toBe(1)
		expect(stalePoster.height).toBe(1)
		expect(isUsableVideoPosterSource(stalePoster)).toBe(false)
	})

	it("detaches scene-graph consumers before releasing a poster", () => {
		const poster = document.createElement("canvas")
		poster.width = 48
		poster.height = 24
		let currentImage: unknown = poster
		const image = vi.fn(function (nextImage?: unknown) {
			if (arguments.length > 0) currentImage = nextImage
			return currentImage
		})
		const matchingNode = {
			getClassName: () => "Image",
			getChildren: () => [],
			image,
		}
		const eventEmitter = {
			emit: vi.fn((event: { type: string }) => {
				if (event.type === "resource:video:will-release") {
					expect(currentImage).toBe(poster)
				}
			}),
		}
		const manager = Object.create(VideoResourceManager.prototype) as Record<string, unknown>
		manager.canvas = {
			eventEmitter,
			getAllLayers: () => new Map([["content", { getChildren: () => [matchingNode] }]]),
		} as never

		;(
			manager as unknown as {
				releaseResource: (
					resource: { poster: HTMLCanvasElement; metadata: unknown },
					context: { path: string; reason: string },
				) => void
			}
		).releaseResource(
			{ poster, metadata: {} },
			{ path: "videos/a.mp4", reason: "viewport-far" },
		)

		expect(currentImage).toBeUndefined()
		expect(poster.width).toBe(1)
		expect(poster.height).toBe(1)
		expect(isUsableVideoPosterSource(poster)).toBe(false)
	})

	it("marks preview decode failures as preservable during refresh", async () => {
		const manager = Object.create(VideoResourceManager.prototype) as Record<string, unknown>
		const eventEmitter = { emit: vi.fn() }
		manager.destroyed = false
		manager.managerInstanceId = 1
		manager.diagnostics = { increment: vi.fn() }
		manager.markStaleRequestDrop = vi.fn()
		manager.shouldDropAbortedLoad = vi.fn(() => false)
		manager.setFailureReason = vi.fn((entry, reason) => {
			;(entry as { lastFailureReason: unknown }).lastFailureReason = reason
		})
		manager.resolveVirtualResourceFallbackOssSrc = vi.fn().mockResolvedValue(null)
		manager.exchangeOssSrc = vi.fn().mockResolvedValue(null)
		manager.canvas = {
			id: "canvas",
			resourceScheduler: { run: vi.fn().mockResolvedValue(null) },
			mediaResourceOfflineCacheManager: {
				recordVirtualResourceLoadSuccess: vi.fn(),
			},
			eventEmitter,
		}
		const entry = {
			referencePath: "./videos/a.mp4",
			resourceIdentity: "videos/a.mp4",
			ossSrc: "https://oss.test/refreshed.mp4",
			resource: null,
			resourceNeedsReload: true,
			lastFailureReason: null,
		}

		await expect(
			(
				manager as unknown as {
					loadVideoResource: (
						path: string,
						normalizedPath: string,
						ossSrc: string,
						targetEntry: typeof entry,
						retryCount: number,
						options: { preservePreviewOnFailure: true },
					) => Promise<unknown>
				}
			).loadVideoResource(
				"./videos/a.mp4",
				"videos/a.mp4",
				"https://oss.test/refreshed.mp4",
				entry,
				0,
				{ preservePreviewOnFailure: true },
			),
		).resolves.toBeNull()
		expect(eventEmitter.emit).toHaveBeenCalledWith({
			type: "resource:video:load-failed",
			data: {
				path: "./videos/a.mp4",
				reason: "load-error",
				preservePreview: true,
			},
		})
	})

	it("allows an element with a retained poster to re-enter the manager when reload is required", () => {
		const loadPreviewFromPath = vi.fn()
		const needsResourceReload = vi.fn(() => true)
		const element = Object.create(VideoElement.prototype) as Record<string, unknown>
		Object.defineProperty(element, "isDestroyed", { value: false })
		element.data = {
			contents: [{ contentId: "video-content", src: "./videos/a.mp4" }],
			activeContentId: "video-content",
			mainContentId: "video-content",
		}
		element.renderer = { hasPreview: vi.fn(() => true) }
		element.canvas = { videoResourceManager: { needsResourceReload } }
		element.loadPreviewFromPath = loadPreviewFromPath
		;(
			element as unknown as { requestPreviewLoad: (options?: { force?: boolean }) => void }
		).requestPreviewLoad()

		expect(needsResourceReload).toHaveBeenCalledWith("./videos/a.mp4")
		expect(loadPreviewFromPath).toHaveBeenCalledWith("./videos/a.mp4", undefined)
	})

	it("evicts least-recently-used far posters when the poster budget is exceeded", () => {
		const manager = Object.create(VideoResourceManager.prototype) as Record<string, unknown>
		const eventEmitter = { emit: vi.fn() }
		const entries = new Map<string, Record<string, unknown>>()
		for (let index = 0; index < 50; index += 1) {
			const poster = document.createElement("canvas")
			poster.width = 768
			poster.height = 768
			entries.set(`videos/${index}.mp4`, {
				referencePath: `videos/${index}.mp4`,
				resourceIdentity: `videos/${index}.mp4`,
				resource: {
					poster,
					metadata: { duration: 1, videoWidth: 768, videoHeight: 768 },
				},
				resourceNeedsReload: false,
				resourceLastAccessAt: index,
			})
		}
		manager.destroyed = false
		manager.entries = entries
		manager.canvas = { eventEmitter }
		manager.getResourceIdentity = vi.fn((path: string) => path)
		;(
			manager as unknown as {
				enforcePosterBudget: (retainedPaths: ReadonlySet<string>) => void
			}
		).enforcePosterBudget(new Set(["videos/0.mp4"]))

		expect(entries.get("videos/0.mp4")?.resource).toBeTruthy()
		expect(entries.get("videos/1.mp4")?.resource).toBeNull()
		expect(entries.get("videos/1.mp4")?.resourceNeedsReload).toBe(true)
		expect(entries.get("videos/49.mp4")?.resource).toBeTruthy()
		expect(eventEmitter.emit).toHaveBeenCalledWith({
			type: "resource:released",
			data: { path: "videos/1.mp4" },
		})
	})
})
