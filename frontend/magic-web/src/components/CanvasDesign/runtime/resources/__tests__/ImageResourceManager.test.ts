import { describe, expect, it, vi } from "vitest"
import { ImageResourceManager, type ImageResourceVariant } from "../image/ImageResourceManager"
import { createImageResourceDiagnostics } from "../diagnostics/CanvasResourceDiagnostics"
import { MediaResourceBodyCache } from "../offline-cache/MediaResourceBodyCache"
import type { DecodedImageRetentionHint } from "../visibility/CanvasVisibilityManager"
import { createTestResourceReferenceResolver } from "../../../public/__tests__/testResourceReferenceResolver"
import type { ResolveCanvasResourceReference } from "../../../public/resource-reference"
import { getCanvasResourceReferenceIdentity } from "../../shared/path/canvasResourcePath"

interface TestImageResource {
	ossSrc: string
	image: ImageBitmap
	imageInfo: {
		naturalWidth: number
		naturalHeight: number
		fileSize: number
		mimeType: string
		filename: string
	}
	variant: ImageResourceVariant
	sourceWidth: number
	sourceHeight: number
	isFullSize: boolean
	closed?: boolean
	displayBlob?: Blob
}

function deferred<T>() {
	let resolve!: (value: T) => void
	return {
		promise: new Promise<T>((promiseResolve) => {
			resolve = promiseResolve
		}),
		resolve,
	}
}

function createImageResource(
	variant: ImageResourceVariant,
	options?: { width?: number; height?: number; close?: () => void; displayBlob?: Blob },
): TestImageResource {
	const width = options?.width ?? 10
	const height = options?.height ?? 10
	return {
		ossSrc: `https://example.test/${variant}.png`,
		image: {
			width,
			height,
			close: options?.close ?? vi.fn(),
		} as unknown as ImageBitmap,
		imageInfo: {
			naturalWidth: width,
			naturalHeight: height,
			fileSize: width * height,
			mimeType: "image/png",
			filename: `${variant}.png`,
		},
		variant,
		sourceWidth: width,
		sourceHeight: height,
		isFullSize: true,
		closed: false,
		displayBlob: options?.displayBlob,
	}
}

function createEntry(overrides: Record<string, unknown> = {}) {
	return {
		resourceStateGeneration: 0,
		awaitingResolverAvailability: false,
		referencePath: "./images/test.png",
		resourceIdentity: "unresolved:./images/test.png",
		ossSrc: null,
		ossSrcFromCachedFallback: false,
		sourceUrl: null,
		expiresAt: null,
		resourceVersion: null,
		sourceUpdatedAt: null,
		contentLength: null,
		exchangePromise: null,
		fullLoadingPromise: null,
		refreshPromise: null,
		bodyPromise: null,
		bodyPromiseCacheKey: null,
		backgroundRefreshPromise: null,
		persistentLowLoadingPromise: null,
		displaySlots: {
			low: { resource: null, loadingPromise: null, version: null, lastAccessAt: 1 },
			preview: { resource: null, loadingPromise: null, version: null, lastAccessAt: 1 },
		},
		fullResource: null,
		fullLastAccessAt: 0,
		lowDisplayLeaseCount: 0,
		lastDecodedBudgetEnforcedAt: 0,
		bodyBlob: null,
		bodyOssSrc: null,
		bodyCacheKey: null,
		bodyByteSize: 0,
		bodyLastAccessAt: 0,
		lastFailureReason: null,
		staleDecodedVariants: new Set<ImageResourceVariant>(),
		...overrides,
	}
}

function createManager() {
	const eventEmitter = { emit: vi.fn() }
	const canvasFileUploadManager = { shouldDeferRemoteResourceLoad: vi.fn(() => false) }
	const mediaResourceOfflineCacheManager = { removeCachedResource: vi.fn() }
	const visibilityManager = {
		getDecodedImageRetentionSnapshot: vi.fn<() => DecodedImageRetentionHint[]>(() => []),
		invalidateImageLoadRequest: vi.fn(),
	}
	const resourceScheduler = {
		run: vi.fn(
			async (
				_kind: string,
				task: (signal: AbortSignal) => Promise<unknown>,
			): Promise<unknown> => task(new AbortController().signal),
		),
	}
	const manager = Object.create(ImageResourceManager.prototype) as {
		canvas: {
			id: string
			eventEmitter: typeof eventEmitter
			canvasFileUploadManager: typeof canvasFileUploadManager
			visibilityManager: typeof visibilityManager
			magicConfigManager: {
				config?: {
					methods?: {
						getImageProcessCacheSignature?: () => string
						resolveResourceReference?: ResolveCanvasResourceReference
					}
				}
			}
			mediaResourceOfflineCacheManager: typeof mediaResourceOfflineCacheManager
			resourceScheduler: typeof resourceScheduler
		}
		managerInstanceId: number
		destroyed: boolean
		entries: Map<string, ReturnType<typeof createEntry>>
		previewLoadQueue: unknown[]
		activePreviewLoadPipelineCount: number
		lastSuccessfulDecodeIdentityByPathVariant: Map<string, string>
		bodyCache: MediaResourceBodyCache<ReturnType<typeof createEntry>>
		displayVariantPersistentCache: {
			getLatest: ReturnType<typeof vi.fn>
			put: ReturnType<typeof vi.fn>
			destroy: ReturnType<typeof vi.fn>
			removeByPath: ReturnType<typeof vi.fn>
			removeVersion: ReturnType<typeof vi.fn>
			removeWriteOrder: ReturnType<typeof vi.fn>
		}
		persistentLowReadyKeys: Set<string>
		persistentLowWritePromises: Map<string, Promise<void>>
		persistentLowGenerationByPath: Map<string, number>
		persistentLowWriteTimestamp: number
		persistentLowWriteSequence: number
		diagnostics: ReturnType<typeof createImageResourceDiagnostics>
		imageResourceLoadFailedHandlersByIdentity: Map<string, Set<unknown>>
		imageResourceRecoveryStartedHandlersByIdentity: Map<string, Set<unknown>>
		imageResourceWillCloseHandlersByIdentity: Map<string, Set<unknown>>
		urlLifecycle: {
			getResourceIdentity: (path: string) => string
			clearExpiredOssSrc: (entry: ReturnType<typeof createEntry>) => boolean
			applyVirtualResourceBypass: () => void
			primeCache: (
				path: string,
				entry: ReturnType<typeof createEntry>,
				fileInfo: {
					src: string
					resource_version?: string
					updated_at?: string
					content_length?: number
				},
			) => void
		}
		loadResource: (path: string, options?: Record<string, unknown>) => void
		getSnapshot: () => ReturnType<ImageResourceManager["getSnapshot"]>
		getLowImageUrl: (path: string) => Promise<{
			url: string
			imageInfo: TestImageResource["imageInfo"]
			release: () => void
		} | null>
		refreshResource: (path: string) => Promise<boolean>
	}
	manager.canvas = {
		id: "test-canvas",
		eventEmitter,
		canvasFileUploadManager,
		visibilityManager,
		magicConfigManager: { config: undefined },
		mediaResourceOfflineCacheManager,
		resourceScheduler,
	}
	manager.managerInstanceId = 1
	manager.destroyed = false
	manager.entries = new Map()
	manager.previewLoadQueue = []
	manager.activePreviewLoadPipelineCount = 0
	manager.lastSuccessfulDecodeIdentityByPathVariant = new Map()
	manager.bodyCache = new MediaResourceBodyCache({ ttlMs: 120_000, maxBytes: 256 * 1024 * 1024 })
	manager.displayVariantPersistentCache = {
		getLatest: vi.fn(async () => null),
		put: vi.fn(async () => true),
		destroy: vi.fn(),
		removeByPath: vi.fn(async () => undefined),
		removeVersion: vi.fn(async () => undefined),
		removeWriteOrder: vi.fn(async () => undefined),
	}
	manager.persistentLowReadyKeys = new Set()
	manager.persistentLowWritePromises = new Map()
	manager.persistentLowGenerationByPath = new Map()
	manager.persistentLowWriteTimestamp = 0
	manager.persistentLowWriteSequence = 0
	manager.diagnostics = createImageResourceDiagnostics()
	manager.imageResourceLoadFailedHandlersByIdentity = new Map()
	manager.imageResourceRecoveryStartedHandlersByIdentity = new Map()
	manager.imageResourceWillCloseHandlersByIdentity = new Map()
	manager.urlLifecycle = {
		getResourceIdentity: (path: string) => path,
		clearExpiredOssSrc: vi.fn(() => false),
		applyVirtualResourceBypass: vi.fn(),
		primeCache: vi.fn((_path, entry, fileInfo) => {
			entry.exchangePromise = null
			entry.ossSrc = fileInfo.src
			entry.sourceUrl = fileInfo.src
			entry.resourceVersion = fileInfo.resource_version ?? null
			entry.sourceUpdatedAt = fileInfo.updated_at ?? null
			entry.contentLength = fileInfo.content_length ?? null
		}),
	}
	return { manager, eventEmitter, visibilityManager, mediaResourceOfflineCacheManager }
}

type EnforceDecodedBitmapBudget = (options: {
	reason: string
	exemptResource?: TestImageResource
	softBudgetBytes?: number
	hardBudgetBytes?: number
	fullBudgetBytes?: number
}) => void

function enforceDecodedBitmapBudget(
	manager: ReturnType<typeof createManager>["manager"],
	options: Parameters<EnforceDecodedBitmapBudget>[0],
) {
	;(
		manager as unknown as { enforceDecodedBitmapBudget: EnforceDecodedBitmapBudget }
	).enforceDecodedBitmapBudget(options)
}

function setDisplayResource(
	manager: ReturnType<typeof createManager>["manager"],
	entry: ReturnType<typeof createEntry>,
	variant: "low" | "preview",
	resource: TestImageResource | null,
) {
	;(
		manager as unknown as {
			setDisplayResource: (
				entry: ReturnType<typeof createEntry>,
				variant: "low" | "preview",
				resource: TestImageResource | null,
				options: { closePrevious: boolean },
			) => void
		}
	).setDisplayResource(entry, variant, resource, { closePrevious: false })
}

function installImmediateAnimationFrame() {
	const originalRequestAnimationFrame = globalThis.requestAnimationFrame
	vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
		callback(Date.now())
		return 1
	})
	return () => {
		if (originalRequestAnimationFrame) {
			vi.stubGlobal("requestAnimationFrame", originalRequestAnimationFrame)
			return
		}
		Reflect.deleteProperty(globalThis, "requestAnimationFrame")
	}
}

describe("ImageResourceManager image resources", () => {
	it("drops signal-aborted viewport loads before starting resource work", async () => {
		const { manager, eventEmitter } = createManager()
		const controller = new AbortController()
		controller.abort()
		const loadImageInternal = (
			manager as unknown as {
				loadImageInternal: (
					path: string,
					options: { variant: ImageResourceVariant; signal: AbortSignal },
				) => Promise<unknown>
			}
		).loadImageInternal

		const result = await loadImageInternal.call(manager, "./images/cancelled.png", {
			variant: "preview",
			signal: controller.signal,
		})

		expect(result).toBeNull()
		expect(manager.getSnapshot().staleRequestDropCount).toBe(1)
		expect(eventEmitter.emit).not.toHaveBeenCalled()
	})

	it("emits not-found failures even when a low load is aborted", async () => {
		const { manager, eventEmitter } = createManager()
		const controller = new AbortController()
		;(
			manager as unknown as {
				loadPersistentDisplayResource: ReturnType<typeof vi.fn>
			}
		).loadPersistentDisplayResource = vi.fn(async () => null)
		;(
			manager as unknown as { loadLowResourcePipeline: ReturnType<typeof vi.fn> }
		).loadLowResourcePipeline = vi.fn(
			async (
				_path: string,
				_normalizedSrc: string,
				entry: ReturnType<typeof createEntry>,
			) => {
				;(entry as { lastFailureReason: "not-found" | null }).lastFailureReason =
					"not-found"
				controller.abort()
				return null
			},
		)

		const result = await (
			manager as unknown as {
				loadImageInternal: (
					path: string,
					options: {
						variant: ImageResourceVariant
						bypassQueue: boolean
						signal: AbortSignal
					},
				) => Promise<unknown>
			}
		).loadImageInternal.call(manager, "./images/missing.png", {
			variant: "low",
			bypassQueue: true,
			signal: controller.signal,
		})

		expect(result).toBeNull()
		expect(eventEmitter.emit).toHaveBeenCalledWith({
			type: "resource:image:load-failed",
			data: {
				path: "./images/missing.png",
				reason: "not-found",
			},
		})
	})

	it("drops aborted loads after body fetch before decode", async () => {
		const { manager } = createManager()
		const controller = new AbortController()
		const loadImageResource = (
			manager as unknown as {
				loadImageResource: (
					path: string,
					ossSrc: string,
					entry: ReturnType<typeof createEntry>,
					variant: ImageResourceVariant,
					priority: "visible",
					retryCount: number,
					options: { signal: AbortSignal },
				) => Promise<unknown>
				loadImageBody: ReturnType<typeof vi.fn>
				estimateImageDecodePixelCost: ReturnType<typeof vi.fn>
			}
		).loadImageResource
		const entry = createEntry()
		manager.entries.set("images/body-stale.png", entry)
		;(manager as unknown as { loadImageBody: ReturnType<typeof vi.fn> }).loadImageBody = vi.fn(
			async () => {
				controller.abort()
				return {
					blob: new Blob(["body"]),
					ossSrc: "https://example.test/body-stale.png",
					cacheKey: "body-stale",
					byteSize: 4,
				}
			},
		)
		;(
			manager as unknown as { estimateImageDecodePixelCost: ReturnType<typeof vi.fn> }
		).estimateImageDecodePixelCost = vi.fn()
		const result = await loadImageResource.call(
			manager,
			"images/body-stale.png",
			"https://example.test/body-stale.png",
			entry,
			"preview",
			"visible",
			0,
			{ signal: controller.signal },
		)

		expect(result).toBeNull()
		expect(
			(manager as unknown as { estimateImageDecodePixelCost: ReturnType<typeof vi.fn> })
				.estimateImageDecodePixelCost,
		).not.toHaveBeenCalled()
		expect(manager.getSnapshot().staleRequestDropCount).toBe(1)
	})

	it("passes decode priority, pixel cost and signal to the worker client", async () => {
		const { manager } = createManager()
		const controller = new AbortController()
		const sendToWorker = vi.fn(async () => null)
		const entry = createEntry()
		const loadImageResource = (
			manager as unknown as {
				loadImageResource: (
					path: string,
					ossSrc: string,
					entry: ReturnType<typeof createEntry>,
					variant: ImageResourceVariant,
					priority: "visible",
					retryCount: number,
					options: { signal: AbortSignal },
				) => Promise<unknown>
			}
		).loadImageResource
		;(manager as unknown as { loadImageBody: ReturnType<typeof vi.fn> }).loadImageBody = vi.fn(
			async () => ({
				blob: new Blob(["body"]),
				ossSrc: "https://example.test/decode-signal.png",
				cacheKey: "decode-signal",
				byteSize: 4,
			}),
		)
		;(
			manager as unknown as { estimateImageDecodePixelCost: ReturnType<typeof vi.fn> }
		).estimateImageDecodePixelCost = vi.fn(async () => 1)
		;(manager as unknown as { sendToWorker: typeof sendToWorker }).sendToWorker = sendToWorker
		;(manager.canvas.resourceScheduler.run as ReturnType<typeof vi.fn>).mockImplementation(
			async (_kind: string, task: (signal: AbortSignal) => Promise<unknown>) =>
				task(controller.signal),
		)
		manager.lastSuccessfulDecodeIdentityByPathVariant.set(
			"images/decode-signal.png\u0000preview",
			"images/decode-signal.png\u0000decode-signal\u0000preview",
		)

		const result = await loadImageResource.call(
			manager,
			"images/decode-signal.png",
			"https://example.test/decode-signal.png",
			entry,
			"preview",
			"visible",
			0,
			{ signal: controller.signal },
		)

		expect(result).toBeNull()
		expect(sendToWorker).toHaveBeenCalledWith(expect.objectContaining({ variant: "preview" }), {
			signal: controller.signal,
			priority: "visible",
			pixelCost: 1,
		})
		expect(manager.getSnapshot().decodeRepeatAttemptCount).toBe(1)
	})

	it("closes decoded image results when the load is aborted before commit", async () => {
		const { manager } = createManager()
		const controller = new AbortController()
		const close = vi.fn()
		;(
			manager.canvas as unknown as {
				resourceScheduler: {
					run: ReturnType<typeof vi.fn>
				}
			}
		).resourceScheduler = {
			run: vi.fn(async (_kind: string, task: (signal: AbortSignal) => Promise<unknown>) => {
				const result = await task(new AbortController().signal)
				controller.abort()
				return result
			}),
		}
		const entry = createEntry()
		manager.entries.set("images/decode-stale.png", entry)
		;(manager as unknown as { loadImageBody: ReturnType<typeof vi.fn> }).loadImageBody = vi.fn(
			async () => ({
				blob: new Blob(["body"]),
				ossSrc: "https://example.test/decode-stale.png",
				cacheKey: "decode-stale",
				byteSize: 4,
			}),
		)
		;(
			manager as unknown as { estimateImageDecodePixelCost: ReturnType<typeof vi.fn> }
		).estimateImageDecodePixelCost = vi.fn(async () => 1)
		;(manager as unknown as { sendToWorker: ReturnType<typeof vi.fn> }).sendToWorker = vi.fn(
			async () => ({
				imageSource: { width: 10, height: 10, close } as unknown as ImageBitmap,
				imageInfo: {
					naturalWidth: 10,
					naturalHeight: 10,
					fileSize: 100,
					mimeType: "image/png",
					filename: "decode-stale.png",
				},
				variant: "preview",
			}),
		)

		const result = await (
			manager as unknown as {
				loadImageResource: (
					path: string,
					ossSrc: string,
					entry: ReturnType<typeof createEntry>,
					variant: ImageResourceVariant,
					priority: "visible",
					retryCount: number,
					options: { signal: AbortSignal },
				) => Promise<unknown>
			}
		).loadImageResource.call(
			manager,
			"images/decode-stale.png",
			"https://example.test/decode-stale.png",
			entry,
			"preview",
			"visible",
			0,
			{ signal: controller.signal },
		)

		expect(result).toBeNull()
		expect(close).toHaveBeenCalledTimes(1)
		expect(entry.displaySlots.preview.resource).toBeNull()
		expect(manager.getSnapshot().staleRequestDropCount).toBe(1)
	})

	it("closes a decoded image when its resource generation changes before commit", async () => {
		const { manager } = createManager()
		const path = "images/decode-generation.png"
		const close = vi.fn()
		;(
			manager.canvas as unknown as {
				resourceScheduler: { run: ReturnType<typeof vi.fn> }
			}
		).resourceScheduler = {
			run: vi.fn(async (_kind: string, task: (signal: AbortSignal) => Promise<unknown>) => {
				const result = await task(new AbortController().signal)
				manager.persistentLowGenerationByPath.set(path, 1)
				return result
			}),
		}
		const entry = createEntry({ ossSrc: "/virtual/images/decode-generation.png" })
		manager.entries.set(path, entry)
		;(manager as unknown as { loadImageBody: ReturnType<typeof vi.fn> }).loadImageBody = vi.fn(
			async () => ({
				blob: new Blob(["body"]),
				ossSrc: "/virtual/images/decode-generation.png",
				cacheKey: "decode-generation",
				byteSize: 4,
				resourceGeneration: 0,
			}),
		)
		;(
			manager as unknown as { estimateImageDecodePixelCost: ReturnType<typeof vi.fn> }
		).estimateImageDecodePixelCost = vi.fn(async () => 1)
		;(manager as unknown as { sendToWorker: ReturnType<typeof vi.fn> }).sendToWorker = vi.fn(
			async () => ({
				imageSource: { width: 10, height: 10, close } as unknown as ImageBitmap,
				imageInfo: {
					naturalWidth: 10,
					naturalHeight: 10,
					fileSize: 100,
					mimeType: "image/png",
					filename: "decode-generation.png",
				},
				variant: "preview",
			}),
		)

		const result = await (
			manager as unknown as {
				loadImageResource: (
					path: string,
					ossSrc: string,
					targetEntry: typeof entry,
					variant: "preview",
					priority: "visible",
				) => Promise<unknown>
			}
		).loadImageResource(
			path,
			"/virtual/images/decode-generation.png",
			entry,
			"preview",
			"visible",
		)

		expect(result).toBeNull()
		expect(close).toHaveBeenCalledOnce()
		expect(entry.displaySlots.preview.resource).toBeNull()
	})

	it("keeps loads without an abort signal active", async () => {
		const { manager } = createManager()
		const previewResource = createImageResource("preview")
		const entry = createEntry({
			ossSrc: previewResource.ossSrc,
			displaySlots: {
				low: { resource: null, loadingPromise: null, version: null, lastAccessAt: 1 },
				preview: {
					resource: previewResource,
					loadingPromise: null,
					version: null,
					lastAccessAt: 1,
				},
			},
		})
		manager.entries.set("images/non-viewport.png", entry)
		const result = await (
			manager as unknown as {
				loadImageInternal: (
					path: string,
					options: { variant: ImageResourceVariant },
				) => Promise<unknown>
			}
		).loadImageInternal.call(manager, "images/non-viewport.png", { variant: "preview" })

		expect(result).toEqual(
			expect.objectContaining({
				image: previewResource.image,
				variant: "preview",
			}),
		)
		expect(manager.getSnapshot().staleRequestDropCount).toBe(0)
	})

	it("restores persistent low without blocking the requested preview target", async () => {
		const { manager } = createManager()
		const lowBootstrap = deferred<TestImageResource | null>()
		const previewResource = createImageResource("preview")
		const managerInternals = manager as unknown as {
			loadPersistentDisplayResource: ReturnType<typeof vi.fn>
			loadImageResourcePipeline: ReturnType<typeof vi.fn>
			loadImageInternal: (
				path: string,
				options: {
					variant: ImageResourceVariant
					bypassQueue: boolean
					restorePersistentLow: boolean
				},
			) => Promise<TestImageResource | null>
		}
		managerInternals.loadPersistentDisplayResource = vi.fn(() => lowBootstrap.promise)
		managerInternals.loadImageResourcePipeline = vi.fn(async () => previewResource)

		const result = await managerInternals.loadImageInternal("images/bootstrap.png", {
			variant: "preview",
			bypassQueue: true,
			restorePersistentLow: true,
		})

		expect(result).toBe(previewResource)
		expect(managerInternals.loadPersistentDisplayResource).toHaveBeenCalledTimes(1)
		expect(managerInternals.loadImageResourcePipeline).toHaveBeenCalledTimes(1)
		lowBootstrap.resolve(createImageResource("low"))
		await lowBootstrap.promise
	})

	it("rejects decoded and persistent caches after the attachment snapshot confirms deletion", async () => {
		const { manager, eventEmitter, mediaResourceOfflineCacheManager } = createManager()
		const path = "./images/deleted.png"
		manager.canvas.magicConfigManager.config = {
			methods: {
				resolveResourceReference: createTestResourceReferenceResolver({
					attachmentsReady: true,
				}),
			},
		}
		const loadPersistentDisplayResource = vi.fn(async () => createImageResource("low"))
		const managerInternals = manager as unknown as {
			loadPersistentDisplayResource: typeof loadPersistentDisplayResource
			loadImageInternal: (
				path: string,
				options: { variant: ImageResourceVariant },
			) => Promise<TestImageResource | null>
		}
		managerInternals.loadPersistentDisplayResource = loadPersistentDisplayResource

		const result = await managerInternals.loadImageInternal(path, { variant: "low" })

		expect(result).toBeNull()
		expect(loadPersistentDisplayResource).not.toHaveBeenCalled()
		expect(mediaResourceOfflineCacheManager.removeCachedResource).toHaveBeenCalledWith({
			path,
			mediaType: "image",
		})
		expect(eventEmitter.emit).toHaveBeenCalledWith({
			type: "resource:image:load-failed",
			data: { path, reason: "not-found" },
		})
	})

	it("keeps a primed upload authoritative until the resolver acknowledges it as available", async () => {
		const { manager, eventEmitter } = createManager()
		const path = "./images/reuploaded.png"
		manager.canvas.magicConfigManager.config = {
			methods: {
				resolveResourceReference: createTestResourceReferenceResolver({
					attachmentsReady: true,
				}),
			},
		}
		const previewResource = createImageResource("preview")
		const managerInternals = manager as unknown as {
			primeCache: (
				path: string,
				fileInfo: { src: string; fileName: string; resource_version: string },
			) => void
			loadImageResourcePipeline: ReturnType<typeof vi.fn>
			loadImageInternal: (
				path: string,
				options: { variant: ImageResourceVariant; bypassQueue: boolean },
			) => Promise<TestImageResource | null>
			handleResourceReferenceResolverChanged: () => void
		}
		managerInternals.loadImageResourcePipeline = vi.fn(async () => previewResource)

		managerInternals.primeCache(path, {
			src: "https://oss.example/reuploaded.png",
			fileName: "reuploaded.png",
			resource_version: "v2",
		})
		const loaded = await managerInternals.loadImageInternal(path, {
			variant: "preview",
			bypassQueue: true,
		})

		expect(loaded).toBe(previewResource)
		expect(eventEmitter.emit).not.toHaveBeenCalledWith(
			expect.objectContaining({ type: "resource:image:load-failed" }),
		)

		managerInternals.handleResourceReferenceResolverChanged()

		const entry = manager.entries.get(path)
		expect(entry?.ossSrc).toBe("https://oss.example/reuploaded.png")
		expect(entry?.resourceVersion).toBe("v2")
		expect(eventEmitter.emit).not.toHaveBeenCalledWith(
			expect.objectContaining({ type: "resource:image:load-failed" }),
		)

		manager.canvas.magicConfigManager.config = {
			methods: {
				resolveResourceReference: createTestResourceReferenceResolver({
					attachmentsReady: true,
					attachmentPathsByFileId: { "file-1": path },
				}),
			},
		}
		managerInternals.handleResourceReferenceResolverChanged()
		expect(entry?.awaitingResolverAvailability).toBe(false)

		manager.canvas.magicConfigManager.config = {
			methods: {
				resolveResourceReference: createTestResourceReferenceResolver({
					attachmentsReady: true,
				}),
			},
		}
		managerInternals.handleResourceReferenceResolverChanged()

		expect(entry?.ossSrc).toBeNull()
		expect(entry?.resourceVersion).toBeNull()
		expect(eventEmitter.emit).toHaveBeenCalledWith({
			type: "resource:image:load-failed",
			data: { path, reason: "not-found" },
		})
	})

	it("notifies every same-identity subscriber when an uploaded resource is primed", () => {
		const { manager } = createManager()
		const path = "./images/reuploaded.png"
		const firstHandler = vi.fn()
		const secondHandler = vi.fn()
		const otherPathHandler = vi.fn()
		const managerInternals = manager as unknown as {
			onImageResourceRecoveryStarted: (
				path: string,
				handler: (event: { data: { path: string; ossSrc: string } }) => void,
			) => () => void
			primeCache: (
				path: string,
				fileInfo: { src: string; fileName: string; resource_version: string },
			) => void
		}
		const cleanups = [
			managerInternals.onImageResourceRecoveryStarted(path, firstHandler),
			managerInternals.onImageResourceRecoveryStarted(path, secondHandler),
			managerInternals.onImageResourceRecoveryStarted("./images/other.png", otherPathHandler),
		]

		managerInternals.primeCache(path, {
			src: "https://oss.example/reuploaded.png",
			fileName: "reuploaded.png",
			resource_version: "v2",
		})

		const expectedEvent = {
			data: {
				path,
				ossSrc: "https://oss.example/reuploaded.png",
			},
		}
		expect(firstHandler).toHaveBeenCalledOnce()
		expect(firstHandler).toHaveBeenCalledWith(expectedEvent)
		expect(secondHandler).toHaveBeenCalledOnce()
		expect(secondHandler).toHaveBeenCalledWith(expectedEvent)
		expect(otherPathHandler).not.toHaveBeenCalled()

		cleanups.forEach((cleanup) => cleanup())
	})

	it("does not broadcast a failure when a primed upload supersedes an in-flight refresh", async () => {
		const { manager, eventEmitter } = createManager()
		const path = "./images/reuploaded.png"
		const entry = createEntry({ referencePath: path, resourceIdentity: path })
		manager.entries.set(path, entry)
		const exchangeResult = deferred<string | null>()
		const exchangeOssSrc = vi.fn(() => exchangeResult.promise)
		const managerInternals = manager as unknown as {
			exchangeOssSrc: typeof exchangeOssSrc
			primeCache: (
				path: string,
				fileInfo: { src: string; fileName: string; resource_version: string },
			) => void
		}
		managerInternals.exchangeOssSrc = exchangeOssSrc

		const refresh = manager.refreshResource(path)
		await vi.waitFor(() => expect(exchangeOssSrc).toHaveBeenCalledTimes(1))
		managerInternals.primeCache(path, {
			src: "https://oss.example/reuploaded.png",
			fileName: "reuploaded.png",
			resource_version: "v2",
		})
		exchangeResult.resolve(null)

		await expect(refresh).resolves.toBe(false)
		expect(entry.ossSrc).toBe("https://oss.example/reuploaded.png")
		expect(entry.resourceVersion).toBe("v2")
		expect(eventEmitter.emit).not.toHaveBeenCalledWith(
			expect.objectContaining({ type: "resource:image:load-failed" }),
		)
	})

	it("does not fence a primed upload that the current resolver already sees as available", () => {
		const { manager, eventEmitter } = createManager()
		const path = "./images/reuploaded.png"
		manager.canvas.magicConfigManager.config = {
			methods: {
				resolveResourceReference: createTestResourceReferenceResolver({
					attachmentsReady: true,
					attachmentPathsByFileId: { "file-1": path },
				}),
			},
		}
		const managerInternals = manager as unknown as {
			primeCache: (
				path: string,
				fileInfo: { src: string; fileName: string; resource_version: string },
			) => void
			handleResourceReferenceResolverChanged: () => void
		}

		managerInternals.primeCache(path, {
			src: "https://oss.example/reuploaded.png",
			fileName: "reuploaded.png",
			resource_version: "v2",
		})
		const entry = manager.entries.get(path)
		expect(entry?.awaitingResolverAvailability).toBe(false)

		manager.canvas.magicConfigManager.config = {
			methods: {
				resolveResourceReference: createTestResourceReferenceResolver({
					attachmentsReady: true,
				}),
			},
		}
		managerInternals.handleResourceReferenceResolverChanged()

		expect(entry?.ossSrc).toBeNull()
		expect(eventEmitter.emit).toHaveBeenCalledWith({
			type: "resource:image:load-failed",
			data: { path, reason: "not-found" },
		})
	})

	it("does not broadcast load-error when a primed upload supersedes an in-flight preview", async () => {
		const { manager, eventEmitter } = createManager()
		const path = "./images/reuploaded.png"
		const previewResult = deferred<TestImageResource | null>()
		const loadImageResourcePipeline = vi.fn(() => previewResult.promise)
		const managerInternals = manager as unknown as {
			loadImageResourcePipeline: typeof loadImageResourcePipeline
			loadImageInternal: (
				path: string,
				options: { variant: ImageResourceVariant; bypassQueue: boolean },
			) => Promise<TestImageResource | null>
			primeCache: (
				path: string,
				fileInfo: { src: string; fileName: string; resource_version: string },
			) => void
		}
		managerInternals.loadImageResourcePipeline = loadImageResourcePipeline

		const load = managerInternals.loadImageInternal(path, {
			variant: "preview",
			bypassQueue: true,
		})
		await vi.waitFor(() => expect(loadImageResourcePipeline).toHaveBeenCalledTimes(1))
		managerInternals.primeCache(path, {
			src: "https://oss.example/reuploaded.png",
			fileName: "reuploaded.png",
			resource_version: "v2",
		})
		previewResult.resolve(null)

		await expect(load).resolves.toBeNull()
		expect(eventEmitter.emit).not.toHaveBeenCalledWith(
			expect.objectContaining({ type: "resource:image:load-failed" }),
		)
	})

	it("allows persistent cache bootstrap while attachments are still pending", async () => {
		const { manager } = createManager()
		manager.canvas.magicConfigManager.config = {
			methods: {
				resolveResourceReference: createTestResourceReferenceResolver({
					attachmentsReady: false,
				}),
			},
		}
		const lowResource = createImageResource("low")
		const loadPersistentDisplayResource = vi.fn(async () => lowResource)
		const managerInternals = manager as unknown as {
			loadPersistentDisplayResource: typeof loadPersistentDisplayResource
			loadImageInternal: (
				path: string,
				options: { variant: ImageResourceVariant },
			) => Promise<TestImageResource | null>
		}
		managerInternals.loadPersistentDisplayResource = loadPersistentDisplayResource

		const result = await managerInternals.loadImageInternal("./images/pending.png", {
			variant: "low",
		})

		expect(result).toBe(lowResource)
		expect(loadPersistentDisplayResource).toHaveBeenCalledTimes(1)
	})

	it("enables persistent low bootstrap only for fire-and-forget display loads", async () => {
		const { manager } = createManager()
		const previewResource = createImageResource("preview")
		const loadImageInternal = vi.fn(async () => previewResource)
		;(manager as unknown as { loadImageInternal: typeof loadImageInternal }).loadImageInternal =
			loadImageInternal

		manager.loadResource("images/display.png", { variant: "preview" })
		await Promise.resolve()
		await manager.getResource("images/export.png", { variant: "preview" })
		manager.loadResource("images/full-display.png", { variant: "full" })
		await Promise.resolve()

		expect(loadImageInternal).toHaveBeenNthCalledWith(1, "images/display.png", {
			variant: "preview",
			restorePersistentLow: true,
		})
		expect(loadImageInternal).toHaveBeenNthCalledWith(2, "images/export.png", {
			variant: "preview",
		})
		expect(loadImageInternal).toHaveBeenNthCalledWith(3, "images/full-display.png", {
			variant: "full",
			restorePersistentLow: false,
		})
	})

	it("emits targeted display-loaded only for display-driven full loads", async () => {
		const { manager, eventEmitter } = createManager()
		const fullResource = createImageResource("full")
		const loadImageInternal = vi.fn(async () => fullResource)
		;(manager as unknown as { loadImageInternal: typeof loadImageInternal }).loadImageInternal =
			loadImageInternal

		manager.loadResource("./images/full.png", {
			variant: "full",
			displayTargetElementId: "image-1",
			displayTargetReason: "viewport:scale",
		})

		await vi.waitFor(() => {
			expect(eventEmitter.emit).toHaveBeenCalledWith({
				type: "resource:image:display-loaded",
				data: {
					elementId: "image-1",
					path: "./images/full.png",
					resource: fullResource,
					reason: "viewport:scale",
				},
			})
		})
		expect(eventEmitter.emit).not.toHaveBeenCalledWith(
			expect.objectContaining({ type: "resource:image:loaded" }),
		)
	})

	it("does not emit display-loaded for non-display full loads", async () => {
		const { manager, eventEmitter } = createManager()
		const fullResource = createImageResource("full")
		const loadImageInternal = vi.fn(async () => fullResource)
		;(manager as unknown as { loadImageInternal: typeof loadImageInternal }).loadImageInternal =
			loadImageInternal

		manager.loadResource("./images/full.png", { variant: "full" })

		await vi.waitFor(() => {
			expect(loadImageInternal).toHaveBeenCalled()
		})
		expect(eventEmitter.emit).not.toHaveBeenCalled()
	})

	it("keeps failure events as reference paths while handlers are indexed by identity", () => {
		const { manager, eventEmitter } = createManager()
		const resolveResourceReference = createTestResourceReferenceResolver()
		manager.urlLifecycle.getResourceIdentity = (path) =>
			getCanvasResourceReferenceIdentity(path, resolveResourceReference)
		const handler = vi.fn()
		manager.onImageResourceLoadFailed("/画布A/images/a.png", handler)

		manager.markResourceLoadFailed("./images/a.png", "load-error")

		expect(handler).toHaveBeenCalledWith({
			data: { path: "./images/a.png", reason: "load-error" },
		})
		expect(eventEmitter.emit).toHaveBeenCalledWith({
			type: "resource:image:load-failed",
			data: { path: "./images/a.png", reason: "load-error" },
		})
	})

	it("notifies aliased image consumers before closing an identity-keyed bitmap", () => {
		const restoreAnimationFrame = installImmediateAnimationFrame()
		try {
			const { manager, eventEmitter } = createManager()
			const resolveResourceReference = createTestResourceReferenceResolver()
			manager.urlLifecycle.getResourceIdentity = (path) =>
				getCanvasResourceReferenceIdentity(path, resolveResourceReference)
			const referencePath = "./images/a.png"
			const resourceIdentity = getCanvasResourceReferenceIdentity(
				referencePath,
				resolveResourceReference,
			)
			const closeOrder: string[] = []
			const fullResource = createImageResource("full", {
				width: 10,
				height: 10,
				close: () => closeOrder.push("close"),
			})
			const entry = createEntry({
				referencePath,
				resourceIdentity,
				fullResource,
				fullLastAccessAt: 1,
			})
			manager.entries.set(resourceIdentity, entry)
			manager.onImageResourceWillClose("/画布A/images/a.png", () => {
				closeOrder.push("notify")
			})

			enforceDecodedBitmapBudget(manager, {
				reason: "identity-path-regression",
				softBudgetBytes: 0,
				hardBudgetBytes: 0,
				fullBudgetBytes: 0,
			})

			expect(closeOrder).toEqual(["notify", "close"])
			expect(eventEmitter.emit).toHaveBeenCalledWith({
				type: "resource:image:will-close",
				data: expect.objectContaining({
					path: referencePath,
					variant: "full",
				}),
			})
		} finally {
			restoreAnimationFrame()
		}
	})

	it("migrates cached body keys after missing metadata is hydrated", () => {
		const { manager } = createManager()
		const entry = createEntry({
			bodyBlob: new Blob([new Uint8Array(10)]),
			bodyOssSrc: "/virtual/image.png",
			bodyCacheKey: "images/a.png::123",
			bodyByteSize: 10,
			bodyLastAccessAt: Date.now(),
			resourceVersion: "v1",
			sourceUpdatedAt: "2030-01-01T00:00:00Z",
			contentLength: 123,
		})
		const migrateBodyCacheKeyAfterMetadataHydration = (
			manager as unknown as {
				migrateBodyCacheKeyAfterMetadataHydration: (
					normalizedSrc: string,
					targetEntry: typeof entry,
				) => void
			}
		).migrateBodyCacheKeyAfterMetadataHydration.bind(manager)

		migrateBodyCacheKeyAfterMetadataHydration("images/a.png", entry)

		expect(entry.bodyCacheKey).toBe("images/a.png::v1")
		expect(
			manager.bodyCache.getReusableBody(entry, "/virtual/image.png", "images/a.png::v1"),
		).toEqual(
			expect.objectContaining({
				blob: entry.bodyBlob,
				cacheKey: "images/a.png::v1",
				byteSize: 10,
			}),
		)
	})

	it("migrates cached body keys when hydrated content length differs from the fallback key", () => {
		const { manager } = createManager()
		const entry = createEntry({
			bodyBlob: new Blob([new Uint8Array(10)]),
			bodyOssSrc: "/virtual/image.png",
			bodyCacheKey: "images/a.png::121964",
			bodyByteSize: 10,
			bodyLastAccessAt: Date.now(),
			resourceVersion: "file-version:1551516",
			sourceUpdatedAt: "2030-01-01T00:00:00Z",
			contentLength: 1551516,
		})
		const migrateBodyCacheKeyAfterMetadataHydration = (
			manager as unknown as {
				migrateBodyCacheKeyAfterMetadataHydration: (
					normalizedSrc: string,
					targetEntry: typeof entry,
				) => void
			}
		).migrateBodyCacheKeyAfterMetadataHydration.bind(manager)

		migrateBodyCacheKeyAfterMetadataHydration("images/a.png", entry)

		expect(entry.bodyCacheKey).toBe("images/a.png::file-version:1551516")
		expect(
			manager.bodyCache.getReusableBody(
				entry,
				"/virtual/image.png",
				"images/a.png::file-version:1551516",
			),
		).toEqual(
			expect.objectContaining({
				blob: entry.bodyBlob,
				cacheKey: "images/a.png::file-version:1551516",
				byteSize: 10,
			}),
		)
	})

	it("does not abort the active body request when resource metadata advances", () => {
		const { manager } = createManager()
		const abort = vi.fn()
		const entry = createEntry({
			resourceVersion: "v2",
			bodyBlob: new Blob(["old"]),
			bodyPromise: { abort } as never,
		})

		;(
			manager as unknown as {
				handleResourceVersionChanged: (
					path: string,
					entry: typeof entry,
					previousVersion: string,
				) => void
			}
		).handleResourceVersionChanged("images/a.png", entry, "v1")

		expect(abort).not.toHaveBeenCalled()
		expect(entry.bodyPromise).not.toBeNull()
		expect(entry.bodyBlob).toBeNull()
	})

	it("does not reuse an existing decoded image when cached metadata advances the version", async () => {
		const { manager } = createManager()
		const existingResource = createImageResource("preview")
		const entry = createEntry({
			ossSrc: "/virtual/images/a.png",
			resourceVersion: "v1",
			displaySlots: {
				low: { resource: null, loadingPromise: null, version: null, lastAccessAt: 1 },
				preview: {
					resource: existingResource,
					loadingPromise: null,
					version: "v1",
					lastAccessAt: 1,
				},
			},
		})
		const loadImageResource = vi.fn().mockResolvedValue({ marker: "decoded-v2" })
		;(manager as unknown as { loadImageResource: typeof loadImageResource }).loadImageResource =
			loadImageResource
		;(
			manager as unknown as {
				urlLifecycle: {
					getCachedResource: (
						path: string,
						targetEntry: typeof entry,
					) => Promise<{ url: string }>
				}
			}
		).urlLifecycle.getCachedResource = vi.fn(async (_path, targetEntry) => {
			targetEntry.resourceVersion = "v2"
			targetEntry.ossSrc = "/virtual/images/a.png"
			targetEntry.staleDecodedVariants.add("preview")
			return { url: "/virtual/images/a.png" }
		})

		const result = await (
			manager as unknown as {
				loadCachedImageResource: (
					path: string,
					normalizedPath: string,
					targetEntry: typeof entry,
					variant: "preview",
				) => Promise<unknown>
			}
		).loadCachedImageResource("./images/a.png", "images/a.png", entry, "preview")

		expect(result).toEqual({ marker: "decoded-v2" })
		expect(loadImageResource).toHaveBeenCalledWith(
			"images/a.png",
			"/virtual/images/a.png",
			entry,
			"preview",
		)
		expect(entry.staleDecodedVariants.has("preview")).toBe(true)
		expect(existingResource.ossSrc).toBe("https://example.test/preview.png")
	})

	it("drops an in-flight body when the resource generation advances under the same URL", async () => {
		const { manager } = createManager()
		const path = "images/a.png"
		const response = deferred<Response>()
		const entry = createEntry({
			ossSrc: "/virtual/images/a.png",
			resourceVersion: "v1",
		})
		manager.entries.set(path, entry)
		;(
			manager.canvas as unknown as { mediaResourceOfflineCacheManager: unknown }
		).mediaResourceOfflineCacheManager = {
			recordVirtualResourceLoadSuccess: vi.fn(),
		}
		const fetchSpy = vi.spyOn(globalThis, "fetch").mockReturnValue(response.promise)

		try {
			const bodyRequest = (
				manager as unknown as {
					loadImageBody: (
						path: string,
						ossSrc: string,
						targetEntry: typeof entry,
						variant: "preview",
						priority: "visible",
					) => Promise<unknown>
				}
			).loadImageBody(path, "/virtual/images/a.png", entry, "preview", "visible")
			await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalledOnce())
			manager.persistentLowGenerationByPath.set(path, 1)
			response.resolve({
				ok: true,
				status: 200,
				blob: async () => new Blob(["old-body"]),
			} as Response)

			await expect(bodyRequest).resolves.toBeNull()
			expect(entry.bodyBlob).toBeNull()
		} finally {
			fetchSpy.mockRestore()
		}
	})

	it("retries the current body request after a 401 exchange advances the version", async () => {
		const { manager } = createManager()
		const entry = createEntry({
			ossSrc: "https://example.test/old.png",
			resourceVersion: "v1",
		})
		manager.entries.set("images/a.png", entry)
		;(
			manager.canvas as unknown as { mediaResourceOfflineCacheManager: unknown }
		).mediaResourceOfflineCacheManager = {
			recordVirtualResourceLoadSuccess: vi.fn(),
		}
		;(
			manager as unknown as {
				resolveVirtualResourceFallbackOssSrc: ReturnType<typeof vi.fn>
			}
		).resolveVirtualResourceFallbackOssSrc = vi.fn(async () => null)
		;(
			manager as unknown as {
				exchangeOssSrc: ReturnType<typeof vi.fn>
			}
		).exchangeOssSrc = vi.fn(async () => {
			entry.resourceVersion = "v2"
			entry.ossSrc = "https://example.test/new.png"
			;(
				manager as unknown as {
					handleResourceVersionChanged: (
						path: string,
						entry: typeof entry,
						previousVersion: string,
					) => void
				}
			).handleResourceVersionChanged("images/a.png", entry, "v1")
			return entry.ossSrc
		})
		const fetchSpy = vi
			.spyOn(globalThis, "fetch")
			.mockResolvedValueOnce({ ok: false, status: 401 } as Response)
			.mockResolvedValueOnce({
				ok: true,
				status: 200,
				blob: async () => new Blob(["new-body"]),
			} as Response)

		try {
			const body = await (
				manager as unknown as {
					loadImageBody: (
						path: string,
						ossSrc: string,
						entry: typeof entry,
						variant: ImageResourceVariant,
						priority: "visible",
					) => Promise<{ ossSrc: string } | null>
				}
			).loadImageBody(
				"images/a.png",
				"https://example.test/old.png",
				entry,
				"preview",
				"visible",
			)

			expect(body?.ossSrc).toBe("https://example.test/new.png")
			expect(fetchSpy).toHaveBeenCalledTimes(2)
		} finally {
			fetchSpy.mockRestore()
		}
	})

	it("does not regenerate low while a persistent bootstrap hit is still resolving", async () => {
		const { manager } = createManager()
		const entry = createEntry({
			resourceVersion: "v1",
			persistentLowLoadingPromise: {
				isAborted: false,
				promise: Promise.resolve(createImageResource("low")),
			} as never,
		})
		const schedulePersistentLowFromBody = vi.fn()
		;(
			manager as unknown as {
				schedulePersistentLowFromBody: typeof schedulePersistentLowFromBody
			}
		).schedulePersistentLowFromBody = schedulePersistentLowFromBody
		;(
			manager as unknown as {
				ensurePersistentLowFromBody: (
					path: string,
					entry: typeof entry,
					body: {
						blob: Blob
						ossSrc: string
						cacheKey: string
						byteSize: number
					},
				) => void
			}
		).ensurePersistentLowFromBody("images/a.png", entry, {
			blob: new Blob(["body"]),
			ossSrc: "https://example.test/a.png",
			cacheKey: "a:v1",
			byteSize: 4,
		})
		await Promise.resolve()

		expect(schedulePersistentLowFromBody).not.toHaveBeenCalled()
	})

	it("does not regenerate low when the current resource version is already persistent-ready", () => {
		const { manager } = createManager()
		const entry = createEntry({ resourceVersion: "v1" })
		const getIdentity = (
			manager as unknown as {
				getPersistentLowIdentity: (path: string, resourceVersion: string) => string
			}
		).getPersistentLowIdentity.bind(manager)
		manager.persistentLowReadyKeys.add(getIdentity("images/a.png", "v1"))
		const schedulePersistentLowFromBody = vi.fn()
		;(
			manager as unknown as {
				schedulePersistentLowFromBody: typeof schedulePersistentLowFromBody
			}
		).schedulePersistentLowFromBody = schedulePersistentLowFromBody
		;(
			manager as unknown as {
				ensurePersistentLowFromBody: (
					path: string,
					entry: typeof entry,
					body: {
						blob: Blob
						ossSrc: string
						cacheKey: string
						byteSize: number
					},
				) => void
			}
		).ensurePersistentLowFromBody("images/a.png", entry, {
			blob: new Blob(["body"]),
			ossSrc: "https://example.test/a.png",
			cacheKey: "a:v1",
			byteSize: 4,
		})

		expect(schedulePersistentLowFromBody).not.toHaveBeenCalled()
	})

	it("builds persistent low from the current decoded preview before falling back to body decode", async () => {
		const { manager } = createManager()
		const path = "images/decoded-source.png"
		const previewResource = createImageResource("preview", { width: 1200, height: 600 })
		const entry = createEntry({
			ossSrc: "https://example.test/decoded-source.png",
			resourceVersion: "v1",
			displaySlots: {
				low: { resource: null, loadingPromise: null, version: null, lastAccessAt: 1 },
				preview: {
					resource: previewResource,
					loadingPromise: null,
					version: null,
					lastAccessAt: 1,
				},
			},
		})
		manager.entries.set(path, entry)
		const candidateClose = vi.fn()
		const createBitmap = vi.fn(async () => ({
			width: 384,
			height: 192,
			close: candidateClose,
		}))
		vi.stubGlobal("createImageBitmap", createBitmap)
		const displayBlob = new Blob(["low"], { type: "image/webp" })
		const sendToWorker = vi.fn(
			async (request: { type?: string; imageSource?: ImageBitmap }) => {
				expect(request.type).toBe("encode-persistent-low")
				request.imageSource?.close()
				return {
					imageInfo: previewResource.imageInfo,
					persistentDisplay: {
						blob: displayBlob,
						mimeType: "image/webp",
						width: 384,
						height: 192,
					},
					variant: "low" as const,
				}
			},
		)
		;(manager as unknown as { sendToWorker: typeof sendToWorker }).sendToWorker = sendToWorker
		;(
			manager as unknown as {
				schedulePersistentLowFromBody: (
					path: string,
					entry: typeof entry,
					body: { blob: Blob; ossSrc: string; cacheKey: string; byteSize: number },
				) => void
			}
		).schedulePersistentLowFromBody(path, entry, {
			blob: new Blob(["body"]),
			ossSrc: "https://example.test/decoded-source.png",
			cacheKey: "decoded-source:v1",
			byteSize: 4,
		})

		await vi.waitFor(() => {
			expect(manager.displayVariantPersistentCache.put).toHaveBeenCalled()
		})
		expect(createBitmap).toHaveBeenCalledWith(previewResource.image, {
			resizeWidth: 384,
			resizeHeight: 192,
			resizeQuality: "high",
		})
		expect(sendToWorker).toHaveBeenCalledTimes(1)
		expect(sendToWorker.mock.calls[0]?.[0]).toEqual(
			expect.objectContaining({
				type: "encode-persistent-low",
				variant: "low",
				imageInfo: previewResource.imageInfo,
			}),
		)
		expect(candidateClose).toHaveBeenCalledTimes(1)
		vi.unstubAllGlobals()
	})

	it("falls back to body low decode when the decoded preview cannot produce a candidate", async () => {
		const { manager } = createManager()
		const path = "images/decoded-fallback.png"
		const previewResource = createImageResource("preview", { width: 1200, height: 600 })
		const fallbackClose = vi.fn()
		const entry = createEntry({
			ossSrc: "https://example.test/decoded-fallback.png",
			resourceVersion: "v1",
			displaySlots: {
				low: { resource: null, loadingPromise: null, version: null, lastAccessAt: 1 },
				preview: {
					resource: previewResource,
					loadingPromise: null,
					version: null,
					lastAccessAt: 1,
				},
			},
		})
		manager.entries.set(path, entry)
		const body = {
			blob: new Blob(["body"]),
			ossSrc: "https://example.test/decoded-fallback.png",
			cacheKey: "decoded-fallback:v1",
			byteSize: 4,
			resourceGeneration: 0,
		}
		manager.bodyCache.storeBody(entry, body)
		vi.stubGlobal(
			"createImageBitmap",
			vi.fn(async () => Promise.reject(new Error("closed"))),
		)
		const displayBlob = new Blob(["low"], { type: "image/webp" })
		const sendToWorker = vi.fn(async (request: { type?: string }) => {
			expect(request.type).toBe("decode")
			return {
				imageSource: {
					width: 384,
					height: 192,
					close: fallbackClose,
				} as unknown as ImageBitmap,
				imageInfo: previewResource.imageInfo,
				persistentDisplay: {
					blob: displayBlob,
					mimeType: "image/webp",
					width: 384,
					height: 192,
				},
				variant: "low" as const,
			}
		})
		;(manager as unknown as { sendToWorker: typeof sendToWorker }).sendToWorker = sendToWorker
		;(
			manager as unknown as {
				schedulePersistentLowFromBody: (
					path: string,
					entry: typeof entry,
					body: { blob: Blob; ossSrc: string; cacheKey: string; byteSize: number },
				) => void
			}
		).schedulePersistentLowFromBody(path, entry, body)

		await vi.waitFor(() => {
			expect(manager.displayVariantPersistentCache.put).toHaveBeenCalled()
		})
		expect(sendToWorker).toHaveBeenCalledTimes(1)
		expect(sendToWorker.mock.calls[0]?.[0]).toEqual(
			expect.objectContaining({ type: "decode", blob: expect.any(Blob), variant: "low" }),
		)
		expect(fallbackClose).toHaveBeenCalledTimes(1)
		vi.unstubAllGlobals()
	})

	it("does not retain or decode an evicted body while a persistent low task is queued", async () => {
		const { manager } = createManager()
		const path = "images/queued-low.png"
		const entry = createEntry({
			ossSrc: "https://example.test/queued-low.png",
			resourceVersion: "v1",
		})
		manager.entries.set(path, entry)
		const body = {
			blob: new Blob(["large-body"]),
			ossSrc: "https://example.test/queued-low.png",
			cacheKey: "queued-low:v1",
			byteSize: 10,
			resourceGeneration: 0,
		}
		manager.bodyCache.storeBody(entry, body)
		const startTask = deferred<void>()
		const sendToWorker = vi.fn()
		;(manager as unknown as { sendToWorker: typeof sendToWorker }).sendToWorker = sendToWorker
		manager.canvas.resourceScheduler.run = vi.fn(
			async (_kind: string, task: (signal: AbortSignal) => Promise<unknown>) => {
				await startTask.promise
				return task(new AbortController().signal)
			},
		)
		;(
			manager as unknown as {
				schedulePersistentLowFromBody: (
					path: string,
					entry: typeof entry,
					body: typeof body,
				) => void
			}
		).schedulePersistentLowFromBody(path, entry, body)
		manager.bodyCache.clearBody(entry)
		startTask.resolve()

		await vi.waitFor(() => expect(manager.persistentLowWritePromises.size).toBe(0))
		expect(sendToWorker).not.toHaveBeenCalled()
		expect(manager.displayVariantPersistentCache.put).not.toHaveBeenCalled()
	})

	it("uses the full decoded resource when no preview source is available", () => {
		const { manager } = createManager()
		const fullResource = createImageResource("full", { width: 1600, height: 900 })
		const entry = createEntry({ fullResource })
		const getPersistentLowDecodedSource = (
			manager as unknown as {
				getPersistentLowDecodedSource: (entry: typeof entry) => TestImageResource | null
			}
		).getPersistentLowDecodedSource.bind(manager)

		expect(getPersistentLowDecodedSource(entry)).toBe(fullResource)
	})

	it("dedupes pending persistent low writes for the same version and generation", async () => {
		const { manager } = createManager()
		const firstWrite = deferred<void>()
		const writeV1 = vi.fn(() => firstWrite.promise)
		const duplicateWrite = vi.fn(async () => undefined)
		const enqueuePersistentLowWrite = (
			manager as unknown as {
				enqueuePersistentLowWrite: (
					path: string,
					resourceVersion: string,
					generation: number,
					write: () => Promise<void>,
				) => void
			}
		).enqueuePersistentLowWrite.bind(manager)

		enqueuePersistentLowWrite("images/a.png", "v1", 0, writeV1)
		enqueuePersistentLowWrite("images/a.png", "v1", 0, duplicateWrite)

		expect(writeV1).toHaveBeenCalledTimes(1)
		expect(duplicateWrite).not.toHaveBeenCalled()
		expect(manager.persistentLowWritePromises.size).toBe(1)
		firstWrite.resolve()
		await firstWrite.promise
		await Promise.resolve()
		expect(manager.persistentLowWritePromises.size).toBe(0)
	})

	it("separates persistent low identities by image-process signature", () => {
		const { manager } = createManager()
		let signature = "watermark_preview"
		manager.canvas.magicConfigManager.config = {
			methods: { getImageProcessCacheSignature: () => signature },
		}
		const getIdentity = (
			manager as unknown as {
				getPersistentLowIdentity: (path: string, resourceVersion: string) => string
			}
		).getPersistentLowIdentity.bind(manager)

		const watermarked = getIdentity("images/a.png", "v1")
		signature = "download"
		const noWatermark = getIdentity("images/a.png", "v1")

		expect(watermarked).not.toBe(noWatermark)
	})

	it("returns a releasable URL for the low display variant", async () => {
		const { manager } = createManager()
		const displayBlob = new Blob(["low"], { type: "image/webp" })
		const lowResource = createImageResource("low", { displayBlob })
		const entry = createEntry({
			ossSrc: lowResource.ossSrc,
			displaySlots: {
				low: {
					resource: lowResource,
					loadingPromise: null,
					version: null,
					lastAccessAt: 1,
				},
				preview: { resource: null, loadingPromise: null, version: null, lastAccessAt: 1 },
			},
		})
		manager.entries.set("image/path.png", entry)

		const createObjectURL = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:low")
		const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined)

		try {
			const loaded = await manager.getLowImageUrl("image/path.png")

			expect(loaded).toEqual({
				url: "blob:low",
				imageInfo: lowResource.imageInfo,
				release: expect.any(Function),
			})
			expect(createObjectURL).toHaveBeenCalledWith(displayBlob)
			expect(entry.lowDisplayLeaseCount).toBe(1)

			loaded?.release()
			loaded?.release()
			expect(entry.lowDisplayLeaseCount).toBe(0)
			expect(revokeObjectURL).toHaveBeenCalledTimes(1)
			expect(revokeObjectURL).toHaveBeenCalledWith("blob:low")
		} finally {
			createObjectURL.mockRestore()
			revokeObjectURL.mockRestore()
		}
	})

	it("releases superseded low decoded resources without breaking low URL leases", () => {
		const restoreAnimationFrame = installImmediateAnimationFrame()
		try {
			const { manager } = createManager()
			const close = vi.fn()
			const lowResource = createImageResource("low", { close })
			const previewResource = createImageResource("preview")
			const entry = createEntry({
				displaySlots: {
					low: {
						resource: lowResource,
						loadingPromise: null,
						version: null,
						lastAccessAt: 1,
					},
					preview: {
						resource: previewResource,
						loadingPromise: null,
						version: null,
						lastAccessAt: 1,
					},
				},
			})
			manager.entries.set("./images/test.png", entry)

			manager.releaseSupersededLowIfUnused("./images/test.png")

			expect(entry.displaySlots.low.resource).toBeNull()
			expect(close).toHaveBeenCalledTimes(1)

			entry.displaySlots.low.resource = lowResource
			entry.lowDisplayLeaseCount = 1
			manager.releaseSupersededLowIfUnused("./images/test.png")
			expect(entry.displaySlots.low.resource).toBe(lowResource)
		} finally {
			restoreAnimationFrame()
		}
	})

	it("skips decoded budget candidate scans while tracked bytes are below budget", () => {
		const { manager } = createManager()
		const entry = createEntry()
		const previewResource = createImageResource("preview", {
			width: 10,
			height: 10,
		})
		manager.entries.set("tracked-preview.png", entry)
		setDisplayResource(manager, entry, "preview", previewResource)
		const collectCandidates = vi.spyOn(
			manager as unknown as {
				collectDecodedBitmapBudgetCandidates: () => unknown
			},
			"collectDecodedBitmapBudgetCandidates",
		)

		enforceDecodedBitmapBudget(manager, {
			reason: "below-budget",
			softBudgetBytes: 1000,
			hardBudgetBytes: 1000,
			fullBudgetBytes: Number.MAX_SAFE_INTEGER,
		})

		expect(collectCandidates).not.toHaveBeenCalled()
	})

	it("evicts full decoded resources before old preview resources under budget pressure", () => {
		const restoreAnimationFrame = installImmediateAnimationFrame()
		try {
			const { manager, eventEmitter } = createManager()
			const fullClose = vi.fn()
			const oldPreviewClose = vi.fn()
			const newPreviewClose = vi.fn()
			const fullResource = createImageResource("full", {
				width: 10,
				height: 10,
				close: fullClose,
			})
			const oldPreviewResource = createImageResource("preview", {
				width: 10,
				height: 10,
				close: oldPreviewClose,
			})
			const newPreviewResource = createImageResource("preview", {
				width: 10,
				height: 10,
				close: newPreviewClose,
			})
			const fullEntry = createEntry({
				referencePath: "full.png",
				resourceIdentity: "full.png",
				fullResource,
				fullLastAccessAt: 30,
			})
			const oldPreviewEntry = createEntry({
				referencePath: "old-preview.png",
				resourceIdentity: "old-preview.png",
				displaySlots: {
					low: { resource: null, loadingPromise: null, version: null, lastAccessAt: 0 },
					preview: {
						resource: oldPreviewResource,
						loadingPromise: null,
						version: null,
						lastAccessAt: 10,
					},
				},
			})
			const newPreviewEntry = createEntry({
				referencePath: "new-preview.png",
				resourceIdentity: "new-preview.png",
				displaySlots: {
					low: { resource: null, loadingPromise: null, version: null, lastAccessAt: 0 },
					preview: {
						resource: newPreviewResource,
						loadingPromise: null,
						version: null,
						lastAccessAt: 20,
					},
				},
			})
			manager.entries.set("full.png", fullEntry)
			manager.entries.set("old-preview.png", oldPreviewEntry)
			manager.entries.set("new-preview.png", newPreviewEntry)

			enforceDecodedBitmapBudget(manager, {
				reason: "unit-test",
				softBudgetBytes: 400,
				hardBudgetBytes: 400,
				fullBudgetBytes: Number.MAX_SAFE_INTEGER,
			})

			expect(fullEntry.fullResource).toBeNull()
			expect(oldPreviewEntry.displaySlots.preview.resource).toBeNull()
			expect(newPreviewEntry.displaySlots.preview.resource).toBe(newPreviewResource)
			expect(fullClose).toHaveBeenCalledTimes(1)
			expect(oldPreviewClose).toHaveBeenCalledTimes(1)
			expect(newPreviewClose).not.toHaveBeenCalled()
			expect(eventEmitter.emit).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "resource:image:will-close",
					data: expect.objectContaining({
						path: "full.png",
						variant: "full",
						reason: "decoded-budget:unit-test",
					}),
				}),
			)

			const snapshot = manager.getSnapshot()
			expect(snapshot.decodedBytesTotal).toBe(400)
			expect(snapshot.decodedEvictedCount).toBe(2)
			expect(snapshot.decodedEvictedFull).toBe(1)
			expect(snapshot.decodedEvictedPreview).toBe(1)
		} finally {
			restoreAnimationFrame()
		}
	})

	it("invalidates visibility image load request state after decoded eviction", () => {
		const restoreAnimationFrame = installImmediateAnimationFrame()
		try {
			const { manager, visibilityManager } = createManager()
			const previewResource = createImageResource("preview", {
				width: 10,
				height: 10,
			})
			const entry = createEntry({
				referencePath: "image/path.png",
				resourceIdentity: "image/path.png",
				ossSrc: previewResource.ossSrc,
				displaySlots: {
					low: { resource: null, loadingPromise: null, version: null, lastAccessAt: 0 },
					preview: {
						resource: previewResource,
						loadingPromise: null,
						version: null,
						lastAccessAt: 1,
					},
				},
			})
			manager.entries.set("image/path.png", entry)

			enforceDecodedBitmapBudget(manager, {
				reason: "request-invalidation",
				softBudgetBytes: 0,
				hardBudgetBytes: 0,
				fullBudgetBytes: Number.MAX_SAFE_INTEGER,
			})

			expect(entry.displaySlots.preview.resource).toBeNull()
			expect(visibilityManager.invalidateImageLoadRequest).toHaveBeenCalledWith(
				"image/path.png",
				"preview",
				"decoded-budget",
				{ scheduleRefresh: true },
			)
		} finally {
			restoreAnimationFrame()
		}
	})

	it("clears full decoded eviction dedupe state without scheduling an immediate reload", () => {
		const restoreAnimationFrame = installImmediateAnimationFrame()
		try {
			const { manager, visibilityManager } = createManager()
			const fullResource = createImageResource("full", {
				width: 10,
				height: 10,
			})
			const entry = createEntry({
				referencePath: "image/full.png",
				resourceIdentity: "image/full.png",
				fullResource,
				fullLastAccessAt: 1,
			})
			manager.entries.set("image/full.png", entry)

			enforceDecodedBitmapBudget(manager, {
				reason: "full-request-invalidation",
				softBudgetBytes: 1000,
				hardBudgetBytes: 1000,
				fullBudgetBytes: 0,
			})

			expect(entry.fullResource).toBeNull()
			expect(visibilityManager.invalidateImageLoadRequest).toHaveBeenCalledWith(
				"image/full.png",
				"full",
				"decoded-budget",
				{ scheduleRefresh: false },
			)
		} finally {
			restoreAnimationFrame()
		}
	})

	it("protects recently used full resources from soft full-budget eviction", () => {
		const { manager, visibilityManager } = createManager()
		const fullResource = createImageResource("full", {
			width: 10,
			height: 10,
		})
		const entry = createEntry({
			referencePath: "image/recent-full.png",
			resourceIdentity: "image/recent-full.png",
			fullResource,
			fullLastAccessAt: Date.now(),
		})
		manager.entries.set("image/recent-full.png", entry)

		enforceDecodedBitmapBudget(manager, {
			reason: "recent-full",
			softBudgetBytes: 1000,
			hardBudgetBytes: 1000,
			fullBudgetBytes: 0,
		})

		expect(entry.fullResource).toBe(fullResource)
		expect(visibilityManager.invalidateImageLoadRequest).not.toHaveBeenCalled()
	})

	it("protects active low display leases and allows low eviction after release", async () => {
		const restoreAnimationFrame = installImmediateAnimationFrame()
		const createObjectURL = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:leased-low")
		const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined)
		try {
			const { manager } = createManager()
			const lowClose = vi.fn()
			const displayBlob = new Blob(["low"], { type: "image/webp" })
			const lowResource = createImageResource("low", {
				width: 10,
				height: 10,
				close: lowClose,
				displayBlob,
			})
			const entry = createEntry({
				ossSrc: lowResource.ossSrc,
				displaySlots: {
					low: {
						resource: lowResource,
						loadingPromise: null,
						version: null,
						lastAccessAt: 1,
					},
					preview: {
						resource: null,
						loadingPromise: null,
						version: null,
						lastAccessAt: 0,
					},
				},
			})
			manager.entries.set("image/path.png", entry)

			const loaded = await manager.getLowImageUrl("image/path.png")

			expect(loaded?.url).toBe("blob:leased-low")
			expect(entry.lowDisplayLeaseCount).toBe(1)

			enforceDecodedBitmapBudget(manager, {
				reason: "active-low-lease",
				softBudgetBytes: 0,
				hardBudgetBytes: 0,
				fullBudgetBytes: Number.MAX_SAFE_INTEGER,
			})

			expect(entry.displaySlots.low.resource).toBe(lowResource)
			expect(lowClose).not.toHaveBeenCalled()

			loaded?.release()
			loaded?.release()
			expect(entry.lowDisplayLeaseCount).toBe(0)
			expect(revokeObjectURL).toHaveBeenCalledTimes(1)

			enforceDecodedBitmapBudget(manager, {
				reason: "released-low-lease",
				softBudgetBytes: 0,
				hardBudgetBytes: 0,
				fullBudgetBytes: Number.MAX_SAFE_INTEGER,
			})

			expect(entry.displaySlots.low.resource).toBeNull()
			expect(lowClose).toHaveBeenCalledTimes(1)
			expect(manager.getSnapshot().decodedEvictedLow).toBe(1)
		} finally {
			createObjectURL.mockRestore()
			revokeObjectURL.mockRestore()
			restoreAnimationFrame()
		}
	})

	it("does not evict the exempt resource during the same budget pass", () => {
		const restoreAnimationFrame = installImmediateAnimationFrame()
		try {
			const { manager } = createManager()
			const exemptClose = vi.fn()
			const oldClose = vi.fn()
			const exemptResource = createImageResource("preview", {
				width: 10,
				height: 10,
				close: exemptClose,
			})
			const oldResource = createImageResource("preview", {
				width: 10,
				height: 10,
				close: oldClose,
			})
			const exemptEntry = createEntry({
				displaySlots: {
					low: { resource: null, loadingPromise: null, version: null, lastAccessAt: 0 },
					preview: {
						resource: exemptResource,
						loadingPromise: null,
						version: null,
						lastAccessAt: 20,
					},
				},
			})
			const oldEntry = createEntry({
				displaySlots: {
					low: { resource: null, loadingPromise: null, version: null, lastAccessAt: 0 },
					preview: {
						resource: oldResource,
						loadingPromise: null,
						version: null,
						lastAccessAt: 10,
					},
				},
			})
			manager.entries.set("exempt.png", exemptEntry)
			manager.entries.set("old.png", oldEntry)

			enforceDecodedBitmapBudget(manager, {
				reason: "exempt",
				exemptResource,
				softBudgetBytes: 0,
				hardBudgetBytes: 0,
				fullBudgetBytes: Number.MAX_SAFE_INTEGER,
			})

			expect(exemptEntry.displaySlots.preview.resource).toBe(exemptResource)
			expect(oldEntry.displaySlots.preview.resource).toBeNull()
			expect(exemptClose).not.toHaveBeenCalled()
			expect(oldClose).toHaveBeenCalledTimes(1)
		} finally {
			restoreAnimationFrame()
		}
	})

	it("keeps visible displayed full decoded resources even when full budget is exceeded", () => {
		const restoreAnimationFrame = installImmediateAnimationFrame()
		try {
			const { manager, visibilityManager } = createManager()
			const fullClose = vi.fn()
			const fullResource = createImageResource("full", {
				width: 20,
				height: 20,
				close: fullClose,
			})
			const entry = createEntry({
				fullResource,
				fullLastAccessAt: 1,
			})
			manager.entries.set("image/path.png", entry)
			visibilityManager.getDecodedImageRetentionSnapshot.mockReturnValue([
				{
					elementId: "image-1",
					path: "image/path.png",
					visibilityState: "visible",
					displayedVariant: "full",
					requestedVariant: "full",
					screenLongEdge: 2400,
					lastSeenAt: 1,
				},
			])

			enforceDecodedBitmapBudget(manager, {
				reason: "visible-full",
				softBudgetBytes: 0,
				hardBudgetBytes: 0,
				fullBudgetBytes: 0,
			})

			expect(entry.fullResource).toBe(fullResource)
			expect(fullClose).not.toHaveBeenCalled()
			const snapshot = manager.getSnapshot()
			expect(snapshot.decodedPinnedBytes).toBe(1600)
			expect(snapshot.decodedPinnedCount).toBe(1)
			expect(snapshot.decodedVisiblePinnedCount).toBe(1)
			expect(snapshot.decodedEvictedFull).toBe(0)
		} finally {
			restoreAnimationFrame()
		}
	})

	it("keeps visible requested full resources before they are applied to the element", () => {
		const restoreAnimationFrame = installImmediateAnimationFrame()
		try {
			const { manager, visibilityManager } = createManager()
			const fullClose = vi.fn()
			const previewClose = vi.fn()
			const fullResource = createImageResource("full", {
				width: 10,
				height: 10,
				close: fullClose,
			})
			const previewResource = createImageResource("preview", {
				width: 10,
				height: 10,
				close: previewClose,
			})
			const entry = createEntry({
				displaySlots: {
					low: { resource: null, loadingPromise: null, version: null, lastAccessAt: 0 },
					preview: {
						resource: previewResource,
						loadingPromise: null,
						version: null,
						lastAccessAt: 1,
					},
				},
				fullResource,
				fullLastAccessAt: 1,
			})
			manager.entries.set("image/path.png", entry)
			visibilityManager.getDecodedImageRetentionSnapshot.mockReturnValue([
				{
					elementId: "image-1",
					path: "image/path.png",
					visibilityState: "visible",
					displayedVariant: "preview",
					requestedVariant: "full",
					screenLongEdge: 1800,
					lastSeenAt: 1,
				},
			])

			enforceDecodedBitmapBudget(manager, {
				reason: "visible-requested-full",
				softBudgetBytes: 0,
				hardBudgetBytes: 0,
				fullBudgetBytes: 0,
			})

			expect(entry.fullResource).toBe(fullResource)
			expect(entry.displaySlots.preview.resource).toBe(previewResource)
			expect(fullClose).not.toHaveBeenCalled()
			expect(previewClose).not.toHaveBeenCalled()
			expect(manager.getSnapshot().decodedVisiblePinnedCount).toBe(2)
		} finally {
			restoreAnimationFrame()
		}
	})

	it("keeps near protected resources during soft pressure and evicts them last under hard pressure", () => {
		const restoreAnimationFrame = installImmediateAnimationFrame()
		try {
			const { manager, visibilityManager } = createManager()
			const nearClose = vi.fn()
			const unprotectedClose = vi.fn()
			const nearPreviewResource = createImageResource("preview", {
				width: 10,
				height: 10,
				close: nearClose,
			})
			const unprotectedPreviewResource = createImageResource("preview", {
				width: 10,
				height: 10,
				close: unprotectedClose,
			})
			const nearEntry = createEntry({
				displaySlots: {
					low: { resource: null, loadingPromise: null, version: null, lastAccessAt: 0 },
					preview: {
						resource: nearPreviewResource,
						loadingPromise: null,
						version: null,
						lastAccessAt: 1,
					},
				},
			})
			const unprotectedEntry = createEntry({
				displaySlots: {
					low: { resource: null, loadingPromise: null, version: null, lastAccessAt: 0 },
					preview: {
						resource: unprotectedPreviewResource,
						loadingPromise: null,
						version: null,
						lastAccessAt: 1,
					},
				},
			})
			manager.entries.set("near.png", nearEntry)
			manager.entries.set("unprotected.png", unprotectedEntry)
			visibilityManager.getDecodedImageRetentionSnapshot.mockReturnValue([
				{
					elementId: "near-image",
					path: "near.png",
					visibilityState: "near",
					displayedVariant: "preview",
					requestedVariant: "preview",
					screenLongEdge: 500,
					lastSeenAt: 1,
				},
			])

			enforceDecodedBitmapBudget(manager, {
				reason: "near-soft",
				softBudgetBytes: 400,
				hardBudgetBytes: 800,
				fullBudgetBytes: Number.MAX_SAFE_INTEGER,
			})

			expect(nearEntry.displaySlots.preview.resource).toBe(nearPreviewResource)
			expect(unprotectedEntry.displaySlots.preview.resource).toBeNull()
			expect(nearClose).not.toHaveBeenCalled()
			expect(unprotectedClose).toHaveBeenCalledTimes(1)
			expect(manager.getSnapshot().decodedNearProtectedCount).toBe(1)

			enforceDecodedBitmapBudget(manager, {
				reason: "near-hard",
				softBudgetBytes: 0,
				hardBudgetBytes: 0,
				fullBudgetBytes: Number.MAX_SAFE_INTEGER,
			})

			expect(nearEntry.displaySlots.preview.resource).toBeNull()
			expect(nearClose).toHaveBeenCalledTimes(1)
			expect(manager.getSnapshot().decodedEvictedPreview).toBe(2)
		} finally {
			restoreAnimationFrame()
		}
	})

	it("refreshes the full variant when full was already loaded", () => {
		const { manager } = createManager()
		const entry = createEntry({
			displaySlots: {
				low: {
					resource: createImageResource("low"),
					loadingPromise: null,
					version: null,
					lastAccessAt: 1,
				},
				preview: {
					resource: createImageResource("preview"),
					loadingPromise: null,
					version: null,
					lastAccessAt: 1,
				},
			},
			fullResource: createImageResource("full"),
		})
		const getVariantsToRefresh = (
			manager as unknown as {
				getVariantsToRefresh: (targetEntry: typeof entry) => ImageResourceVariant[]
			}
		).getVariantsToRefresh.bind(manager)

		expect(getVariantsToRefresh(entry)).toEqual(["low", "preview", "full"])
	})

	it("serializes refreshes for the same image entry", async () => {
		const { manager } = createManager()
		const firstRefresh = deferred<boolean>()
		const secondRefresh = deferred<boolean>()
		const entry = createEntry()
		manager.entries.set("images/refresh.png", entry)
		const refreshImageResourceFromNetwork = vi
			.fn()
			.mockReturnValueOnce(firstRefresh.promise)
			.mockReturnValueOnce(secondRefresh.promise)
		;(
			manager as unknown as {
				refreshImageResourceFromNetwork: typeof refreshImageResourceFromNetwork
			}
		).refreshImageResourceFromNetwork = refreshImageResourceFromNetwork

		const firstRequest = manager.refreshResource("images/refresh.png")
		const secondRequest = manager.refreshResource("images/refresh.png")

		expect(refreshImageResourceFromNetwork).toHaveBeenCalledTimes(1)
		firstRefresh.resolve(true)
		await expect(firstRequest).resolves.toBe(true)
		await vi.waitFor(() => expect(refreshImageResourceFromNetwork).toHaveBeenCalledTimes(2))
		secondRefresh.resolve(true)
		await expect(secondRequest).resolves.toBe(true)
	})

	it("keeps the previous decoded surface when a refresh URL exchange fails", async () => {
		const { manager, eventEmitter } = createManager()
		const previousResource = createImageResource("preview")
		const entry = createEntry({
			referencePath: "./images/a.png",
			resourceIdentity: "images/a.png",
			displaySlots: {
				low: { resource: null, loadingPromise: null, version: null, lastAccessAt: 1 },
				preview: {
					resource: previousResource,
					loadingPromise: null,
					version: null,
					lastAccessAt: 1,
				},
			},
			lastFailureReason: "load-error",
		})
		;(
			manager.canvas as unknown as { mediaResourceOfflineCacheManager: unknown }
		).mediaResourceOfflineCacheManager = { removeCachedResource: vi.fn() }
		;(
			manager as unknown as {
				exchangeOssSrc: () => Promise<null>
			}
		).exchangeOssSrc = vi.fn().mockResolvedValue(null)

		const refreshed = await (
			manager as unknown as {
				refreshImageResourceFromNetwork: (
					path: string,
					normalizedPath: string,
					targetEntry: typeof entry,
				) => Promise<boolean>
			}
		).refreshImageResourceFromNetwork("./images/a.png", "images/a.png", entry)

		expect(refreshed).toBe(false)
		expect(entry.displaySlots.preview.resource).toBe(previousResource)
		expect(eventEmitter.emit).toHaveBeenCalledWith({
			type: "resource:image:load-failed",
			data: {
				path: "./images/a.png",
				reason: "load-error",
				preservePreview: true,
			},
		})
	})

	it("supersedes an old persistent low generation without waiting for background writes", () => {
		const { manager } = createManager()
		const identity = JSON.stringify([
			"design/test-canvas",
			"images/race.png",
			"image-process:default:exif-orientation-v1",
			"low",
			"v1",
		])
		const removeVersion = vi.fn(async () => undefined)
		manager.persistentLowReadyKeys.add(identity)
		manager.displayVariantPersistentCache.removeVersion = removeVersion
		const entry = createEntry({ resourceVersion: "v1" })

		;(
			manager as unknown as {
				invalidatePersistentLowGeneration: (
					path: string,
					entry: typeof entry,
					resourceVersion: string,
				) => void
			}
		).invalidatePersistentLowGeneration("images/race.png", entry, "v1")

		expect(removeVersion).toHaveBeenCalledWith(
			"design/test-canvas",
			"images/race.png",
			"image-process:default:exif-orientation-v1",
			"v1",
			expect.any(String),
		)
		expect(manager.persistentLowReadyKeys.has(identity)).toBe(false)
		expect(manager.persistentLowGenerationByPath.get("images/race.png")).toBe(1)
	})

	it("removes an old-version write that finishes after the resource generation changes", async () => {
		const { manager } = createManager()
		const path = "images/late-write.png"
		const entry = createEntry({
			referencePath: path,
			resourceIdentity: path,
			ossSrc: "https://example.test/v1.png",
			resourceVersion: "v1",
		})
		manager.entries.set(path, entry)
		const pendingPut = deferred<boolean>()
		manager.displayVariantPersistentCache.put = vi.fn(() => pendingPut.promise)
		const writeOrder = "0000000000000001:test:00000001"
		const writePromise = (
			manager as unknown as {
				writePersistentLowDisplayBlob: (
					path: string,
					entry: typeof entry,
					persistentDisplay: {
						blob: Blob
						mimeType: string
						width: number
						height: number
					},
					imageInfo: TestImageResource["imageInfo"],
					resourceVersion: string,
					generation: number,
					writeOrder: string,
				) => Promise<void>
			}
		).writePersistentLowDisplayBlob(
			path,
			entry,
			{
				blob: new Blob(["v1-low"], { type: "image/webp" }),
				mimeType: "image/webp",
				width: 384,
				height: 216,
			},
			createImageResource("low").imageInfo,
			"v1",
			0,
			writeOrder,
		)
		await Promise.resolve()
		entry.resourceVersion = "v2"
		manager.persistentLowGenerationByPath.set(path, 1)
		pendingPut.resolve(true)
		await writePromise

		expect(manager.displayVariantPersistentCache.removeWriteOrder).toHaveBeenCalledWith(
			"design/test-canvas",
			path,
			"image-process:default:exif-orientation-v1",
			"v1",
			writeOrder,
		)
		expect(
			manager.persistentLowReadyKeys.has(
				JSON.stringify([
					"design/test-canvas",
					path,
					"image-process:default:exif-orientation-v1",
					"low",
					"v1",
				]),
			),
		).toBe(false)
	})

	it("does not mark persistent low ready when IndexedDB rejects the write", async () => {
		const { manager } = createManager()
		const path = "images/rejected-write.png"
		const entry = createEntry({
			referencePath: path,
			resourceIdentity: path,
			ossSrc: "https://example.test/rejected-write.png",
			resourceVersion: "v1",
		})
		manager.entries.set(path, entry)
		manager.displayVariantPersistentCache.put = vi.fn(async () => false)

		await (
			manager as unknown as {
				writePersistentLowDisplayBlob: (
					path: string,
					entry: typeof entry,
					persistentDisplay: {
						blob: Blob
						mimeType: string
						width: number
						height: number
					},
					imageInfo: TestImageResource["imageInfo"],
					resourceVersion: string,
					generation: number,
					writeOrder: string,
				) => Promise<void>
			}
		).writePersistentLowDisplayBlob(
			path,
			entry,
			{
				blob: new Blob(["low"], { type: "image/webp" }),
				mimeType: "image/webp",
				width: 384,
				height: 216,
			},
			createImageResource("low").imageInfo,
			"v1",
			0,
			"0000000000000001:test:00000001",
		)

		expect(manager.persistentLowReadyKeys.size).toBe(0)
		expect(manager.displayVariantPersistentCache.removeWriteOrder).not.toHaveBeenCalled()
	})

	it("removes all persistent low records when the resource is confirmed deleted", () => {
		const { manager } = createManager()
		const path = "images/deleted.png"
		const close = vi.fn()
		const lowResource = createImageResource("low", { close })
		const entry = createEntry({
			referencePath: path,
			resourceIdentity: path,
			ossSrc: "https://example.test/deleted.png",
			resourceVersion: "v1",
			displaySlots: {
				low: {
					resource: lowResource,
					loadingPromise: null,
					version: "v1",
					lastAccessAt: 1,
				},
				preview: { resource: null, loadingPromise: null, version: null, lastAccessAt: 1 },
			},
		})
		manager.entries.set(path, entry)
		const removeCachedResource = vi.fn()
		;(
			manager.canvas as unknown as { mediaResourceOfflineCacheManager: unknown }
		).mediaResourceOfflineCacheManager = { removeCachedResource }
		;(
			manager as unknown as {
				handleImageResourceDeleted: (path: string, entry: typeof entry) => void
			}
		).handleImageResourceDeleted(path, entry)

		expect(removeCachedResource).toHaveBeenCalledWith({ path, mediaType: "image" })
		expect(manager.displayVariantPersistentCache.removeByPath).toHaveBeenCalledWith(
			"design/test-canvas",
			path,
		)
		expect(close).toHaveBeenCalledTimes(1)
		expect(entry.resourceVersion).toBeNull()
		expect(manager.persistentLowGenerationByPath.get(path)).toBe(1)
	})

	it("does not invalidate persistent low before force exchange confirms a version change", async () => {
		const { manager } = createManager()
		const abortBootstrap = vi.fn()
		const entry = createEntry({
			resourceVersion: "v1",
			lastFailureReason: "load-error",
			persistentLowLoadingPromise: {
				abort: abortBootstrap,
				promise: new Promise(() => undefined),
			} as never,
		})
		manager.entries.set("images/race.png", entry)
		manager.persistentLowWritePromises.set(
			JSON.stringify([
				"design/test-canvas",
				"images/race.png",
				"image-process:default:exif-orientation-v1",
				"low",
				"v1",
			]),
			new Promise<void>(() => undefined),
		)
		;(
			manager.canvas as unknown as { mediaResourceOfflineCacheManager: unknown }
		).mediaResourceOfflineCacheManager = { removeCachedResource: vi.fn() }
		const exchangeOssSrc = vi.fn(async () => null)
		;(manager as unknown as { exchangeOssSrc: typeof exchangeOssSrc }).exchangeOssSrc =
			exchangeOssSrc

		const refreshed = await (
			manager as unknown as {
				refreshImageResourceFromNetwork: (
					path: string,
					normalizedPath: string,
					entry: typeof entry,
				) => Promise<boolean>
			}
		).refreshImageResourceFromNetwork("./images/race.png", "images/race.png", entry)

		expect(refreshed).toBe(false)
		expect(exchangeOssSrc).toHaveBeenCalledWith("./images/race.png", entry, {
			forceRefresh: true,
			priority: "critical",
		})
		expect(abortBootstrap).not.toHaveBeenCalled()
		expect(manager.displayVariantPersistentCache.removeVersion).not.toHaveBeenCalled()
		expect(manager.persistentLowGenerationByPath.get("images/race.png")).toBeUndefined()
	})

	it("keeps a valid low when force refresh confirms the same resource version", async () => {
		const { manager } = createManager()
		const lowResource = createImageResource("low", {
			displayBlob: new Blob(["low"], { type: "image/webp" }),
		})
		const entry = createEntry({
			ossSrc: "https://example.test/old-signed.png",
			resourceVersion: "v1",
			displaySlots: {
				low: {
					resource: lowResource,
					loadingPromise: null,
					version: "v1",
					lastAccessAt: 1,
				},
				preview: { resource: null, loadingPromise: null, version: null, lastAccessAt: 1 },
			},
		})
		manager.entries.set("images/a.png", entry)
		;(
			manager.canvas as unknown as { mediaResourceOfflineCacheManager: unknown }
		).mediaResourceOfflineCacheManager = { removeCachedResource: vi.fn() }
		const exchangeOssSrc = vi.fn(async () => {
			entry.ossSrc = "https://example.test/new-signed.png"
			return entry.ossSrc
		})
		const loadImageResource = vi.fn()
		;(manager as unknown as { exchangeOssSrc: typeof exchangeOssSrc }).exchangeOssSrc =
			exchangeOssSrc
		;(manager as unknown as { loadImageResource: typeof loadImageResource }).loadImageResource =
			loadImageResource

		const refreshed = await (
			manager as unknown as {
				refreshImageResourceFromNetwork: (
					path: string,
					normalizedPath: string,
					targetEntry: typeof entry,
				) => Promise<boolean>
			}
		).refreshImageResourceFromNetwork("./images/a.png", "images/a.png", entry)

		expect(refreshed).toBe(true)
		expect(loadImageResource).not.toHaveBeenCalled()
		expect(entry.displaySlots.low.resource).toBe(lowResource)
		expect(lowResource.image.close).not.toHaveBeenCalled()
		expect(manager.displayVariantPersistentCache.removeVersion).not.toHaveBeenCalled()
		expect(manager.persistentLowGenerationByPath.get("images/a.png")).toBeUndefined()
	})

	it("keeps the valid low while force refresh reloads preview for the same version", async () => {
		const { manager } = createManager()
		const lowResource = createImageResource("low", {
			displayBlob: new Blob(["low"], { type: "image/webp" }),
		})
		const previousPreview = createImageResource("preview")
		const refreshedPreview = {
			...createImageResource("preview"),
			ossSrc: "https://example.test/new-signed.png",
		}
		const entry = createEntry({
			referencePath: "./images/a.png",
			resourceIdentity: "images/a.png",
			ossSrc: "https://example.test/old-signed.png",
			resourceVersion: "v1",
			displaySlots: {
				low: {
					resource: lowResource,
					loadingPromise: null,
					version: "v1",
					lastAccessAt: 1,
				},
				preview: {
					resource: previousPreview,
					loadingPromise: null,
					version: null,
					lastAccessAt: 1,
				},
			},
		})
		manager.entries.set("images/a.png", entry)
		;(
			manager.canvas as unknown as { mediaResourceOfflineCacheManager: unknown }
		).mediaResourceOfflineCacheManager = { removeCachedResource: vi.fn() }
		const exchangeOssSrc = vi.fn(async () => {
			entry.ossSrc = "https://example.test/new-signed.png"
			return entry.ossSrc
		})
		const loadImageResource = vi.fn(async (_path, _ossSrc, _entry, variant) => {
			expect(variant).toBe("preview")
			entry.displaySlots.preview.resource = refreshedPreview
			return refreshedPreview
		})
		;(manager as unknown as { exchangeOssSrc: typeof exchangeOssSrc }).exchangeOssSrc =
			exchangeOssSrc
		;(manager as unknown as { loadImageResource: typeof loadImageResource }).loadImageResource =
			loadImageResource

		const refreshed = await (
			manager as unknown as {
				refreshImageResourceFromNetwork: (
					path: string,
					normalizedPath: string,
					targetEntry: typeof entry,
				) => Promise<boolean>
			}
		).refreshImageResourceFromNetwork("./images/a.png", "images/a.png", entry)

		expect(refreshed).toBe(true)
		expect(loadImageResource).toHaveBeenCalledTimes(1)
		expect(entry.displaySlots.low.resource).toBe(lowResource)
		expect(lowResource.image.close).not.toHaveBeenCalled()
		expect(previousPreview.image.close).toHaveBeenCalledTimes(1)
	})

	it("reloads low when force refresh discovers a newer resource version", async () => {
		const { manager } = createManager()
		const lowResource = createImageResource("low", {
			displayBlob: new Blob(["low-v1"], { type: "image/webp" }),
		})
		const entry = createEntry({
			referencePath: "./images/a.png",
			resourceIdentity: "images/a.png",
			ossSrc: "https://example.test/v1.png",
			resourceVersion: "v1",
			displaySlots: {
				low: {
					resource: lowResource,
					loadingPromise: null,
					version: "v1",
					lastAccessAt: 1,
				},
				preview: { resource: null, loadingPromise: null, version: null, lastAccessAt: 1 },
			},
		})
		manager.entries.set("images/a.png", entry)
		;(
			manager.canvas as unknown as { mediaResourceOfflineCacheManager: unknown }
		).mediaResourceOfflineCacheManager = { removeCachedResource: vi.fn() }
		const exchangeOssSrc = vi.fn(async () => {
			entry.resourceVersion = "v2"
			entry.ossSrc = "https://example.test/v2.png"
			;(
				manager as unknown as {
					handleResourceVersionChanged: (
						path: string,
						entry: typeof entry,
						previousVersion: string,
					) => void
				}
			).handleResourceVersionChanged("images/a.png", entry, "v1")
			return entry.ossSrc
		})
		const refreshedLow = {
			...createImageResource("low", {
				displayBlob: new Blob(["low-v2"], { type: "image/webp" }),
			}),
			ossSrc: "https://example.test/v2.png",
		}
		const loadImageResource = vi.fn(async () => refreshedLow)
		;(manager as unknown as { exchangeOssSrc: typeof exchangeOssSrc }).exchangeOssSrc =
			exchangeOssSrc
		;(manager as unknown as { loadImageResource: typeof loadImageResource }).loadImageResource =
			loadImageResource

		const refreshed = await (
			manager as unknown as {
				refreshImageResourceFromNetwork: (
					path: string,
					normalizedPath: string,
					targetEntry: typeof entry,
				) => Promise<boolean>
			}
		).refreshImageResourceFromNetwork("./images/a.png", "images/a.png", entry)

		expect(refreshed).toBe(true)
		expect(loadImageResource).toHaveBeenCalledWith(
			"images/a.png",
			"https://example.test/v2.png",
			entry,
			"low",
		)
		expect(manager.displayVariantPersistentCache.removeVersion).not.toHaveBeenCalled()
		expect(manager.persistentLowGenerationByPath.get("images/a.png")).toBe(1)
	})

	it("does not expose a decoded image's old URL after entry URL invalidation", () => {
		const { manager } = createManager()
		const entry = createEntry({
			displaySlots: {
				low: { resource: null, loadingPromise: null, version: null, lastAccessAt: 1 },
				preview: {
					resource: createImageResource("preview"),
					loadingPromise: null,
					version: null,
					lastAccessAt: 1,
				},
			},
			ossSrc: null,
			staleDecodedVariants: new Set<ImageResourceVariant>(["preview"]),
		})
		const buildLoadedResource = (
			manager as unknown as {
				buildLoadedResource: (target: typeof entry, variant: "preview") => unknown
			}
		).buildLoadedResource.bind(manager)

		expect(buildLoadedResource(entry, "preview")).toBeNull()
		entry.staleDecodedVariants.delete("preview")
		const refreshedResource = entry.displaySlots.preview.resource as TestImageResource | null
		expect(refreshedResource).not.toBeNull()
		if (!refreshedResource) throw new Error("Expected preview resource")
		refreshedResource.ossSrc = "https://example.test/refreshed.png"
		expect(buildLoadedResource(entry, "preview")).toMatchObject({
			ossSrc: "https://example.test/refreshed.png",
		})
	})

	it("does not expose a decoded image after it has been closed", () => {
		const { manager } = createManager()
		const resource = createImageResource("preview")
		const entry = createEntry({
			displaySlots: {
				low: { resource: null, loadingPromise: null, version: null, lastAccessAt: 1 },
				preview: {
					resource,
					loadingPromise: null,
					version: null,
					lastAccessAt: 1,
				},
			},
		})
		const buildLoadedResource = (
			manager as unknown as {
				buildLoadedResource: (target: typeof entry, variant: "preview") => unknown
			}
		).buildLoadedResource.bind(manager)

		expect(buildLoadedResource(entry, "preview")).not.toBeNull()
		resource.closed = true
		expect(buildLoadedResource(entry, "preview")).toBeNull()
	})

	it("re-enters the image pipeline after a signed URL expires", async () => {
		const { manager } = createManager()
		const entry = createEntry({
			ossSrc: "https://example.test/expired.png",
			expiresAt: Date.now() - 1,
			displaySlots: {
				low: { resource: null, loadingPromise: null, version: null, lastAccessAt: 1 },
				preview: {
					resource: createImageResource("preview"),
					loadingPromise: null,
					version: null,
					lastAccessAt: 1,
				},
			},
		})
		manager.entries.set("images/expired.png", entry)
		manager.urlLifecycle.clearExpiredOssSrc = vi.fn((target: typeof entry) => {
			target.ossSrc = null
			target.expiresAt = null
			return true
		})
		const managerInternals = manager as unknown as {
			loadPersistentDisplayResource: ReturnType<typeof vi.fn>
			loadImageResourcePipeline: ReturnType<typeof vi.fn>
		}
		managerInternals.loadPersistentDisplayResource = vi.fn().mockResolvedValue(null)
		managerInternals.loadImageResourcePipeline = vi.fn().mockResolvedValue({
			ossSrc: "https://example.test/refreshed.png",
			image: createImageResource("preview").image,
			imageInfo: createImageResource("preview").imageInfo,
			variant: "preview",
			sourceWidth: 10,
			sourceHeight: 10,
			isFullSize: true,
		})

		const result = await (
			manager as unknown as {
				loadImageInternal: (
					path: string,
					options: { bypassQueue: boolean },
				) => Promise<unknown>
			}
		).loadImageInternal("images/expired.png", { bypassQueue: true })

		expect(result).toBeTruthy()
		expect(managerInternals.loadImageResourcePipeline).toHaveBeenCalled()
		expect(entry.staleDecodedVariants.has("preview")).toBe(true)
	})

	it("falls back to preview refresh when no variant is loaded yet", () => {
		const { manager } = createManager()
		const entry = createEntry()
		const getVariantsToRefresh = (
			manager as unknown as {
				getVariantsToRefresh: (targetEntry: typeof entry) => ImageResourceVariant[]
			}
		).getVariantsToRefresh.bind(manager)

		expect(getVariantsToRefresh(entry)).toEqual(["preview"])
	})

	it("persists low display resources for reload-time bootstrap", () => {
		const { manager } = createManager()
		const put = vi.fn()
		const lowResource = createImageResource("low")
		const displayBlob = new Blob(["preview-display"], { type: "image/webp" })
		const entry = createEntry({
			resourceVersion: "generated:generated.png",
			sourceUpdatedAt: "2026-07-13T08:00:00Z",
			contentLength: 2048,
			sourceUrl: "https://example.test/generated.png",
			ossSrc: "https://example.test/generated.png",
		})
		manager.entries.set("images/generated.png", entry)
		const managerInternals = manager as unknown as {
			displayVariantPersistentCache: { put: typeof put }
			persistDisplayResourceFromWorkerResult: (
				path: string,
				targetEntry: typeof entry,
				variant: ImageResourceVariant,
				result: {
					persistentDisplay?: {
						blob: Blob
						width: number
						height: number
					}
				},
				imageInfo: TestImageResource["imageInfo"],
			) => void
		}
		managerInternals.displayVariantPersistentCache = { put }

		managerInternals.persistDisplayResourceFromWorkerResult(
			"images/generated.png",
			entry,
			"low",
			{
				persistentDisplay: {
					blob: displayBlob,
					width: 512,
					height: 384,
				},
			},
			lowResource.imageInfo,
		)

		expect(put).toHaveBeenCalledWith({
			scope: "design/test-canvas",
			path: "images/generated.png",
			variant: "low",
			rendition: "image-process:default:exif-orientation-v1",
			blob: displayBlob,
			width: 512,
			height: 384,
			imageInfo: lowResource.imageInfo,
			resourceVersion: "generated:generated.png",
			sourceUpdatedAt: "2026-07-13T08:00:00Z",
			contentLength: 2048,
			sourceUrl: "https://example.test/generated.png",
			maxEdge: 384,
			writeOrder: expect.any(String),
		})
	})
})

describe("ImageResourceManager load priority defaults", () => {
	type GetPriorityForVariant = (
		variant: ImageResourceVariant,
		priority?: "critical" | "visible" | "near" | "background",
	) => "critical" | "visible" | "near" | "background"

	it("preserves explicit priority for body fetch and decode scheduling", () => {
		const manager = Object.create(ImageResourceManager.prototype) as {
			getBodyFetchPriorityForVariant: GetPriorityForVariant
			getDecodePriorityForVariant: GetPriorityForVariant
		}

		expect(manager.getBodyFetchPriorityForVariant("low", "critical")).toBe("critical")
		expect(manager.getBodyFetchPriorityForVariant("preview", "critical")).toBe("critical")
		expect(manager.getDecodePriorityForVariant("low", "critical")).toBe("critical")
		expect(manager.getDecodePriorityForVariant("preview", "critical")).toBe("critical")
	})

	it("keeps existing variant-based priority defaults when no priority is supplied", () => {
		const manager = Object.create(ImageResourceManager.prototype) as {
			getBodyFetchPriorityForVariant: GetPriorityForVariant
			getDecodePriorityForVariant: GetPriorityForVariant
		}

		expect(manager.getBodyFetchPriorityForVariant("full")).toBe("critical")
		expect(manager.getBodyFetchPriorityForVariant("preview")).toBe("visible")
		expect(manager.getBodyFetchPriorityForVariant("low")).toBe("near")
		expect(manager.getDecodePriorityForVariant("full")).toBe("critical")
		expect(manager.getDecodePriorityForVariant("preview")).toBe("visible")
		expect(manager.getDecodePriorityForVariant("low")).toBe("background")
	})
})
