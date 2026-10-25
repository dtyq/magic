import { describe, expect, it, vi } from "vitest"
import { CanvasVisibilityManager } from "../visibility/CanvasVisibilityManager"
import type { ImageResourceLoadPriority, ImageResourceVariant } from "../image/ImageResourceManager"
import {
	ElementTypeEnum,
	type BaseElementProps,
	type FrameElement,
	type LayerElement,
} from "../../document/types"
import { createTestResourceReferenceResolver } from "../../../public/__tests__/testResourceReferenceResolver"

interface VideoCandidate {
	elementId: string
	path: string
	priority: ImageResourceLoadPriority
	tier: "url" | "poster"
	visibilityState: "visible" | "near" | "far"
	screenArea: number
	screenLongEdge: number
	distanceToViewportCenter: number
}

interface AudioCandidate {
	elementId: string
	path: string
	priority: ImageResourceLoadPriority
	tier: "url" | "preload"
	visibilityState: "visible" | "near" | "far"
	screenArea: number
	screenLongEdge: number
	distanceToViewportCenter: number
}

interface ImageCandidate {
	elementId: string
	path: string
	priority: ImageResourceLoadPriority
	variant: ImageResourceVariant
	visibilityState: "visible" | "near" | "far"
	screenArea: number
	screenLongEdge: number
	distanceToViewportCenter: number
}

function createCandidate(priority: ImageResourceLoadPriority): VideoCandidate {
	return {
		elementId: "video-1",
		path: "./videos/a.mp4",
		priority,
		tier: priority === "near" ? "url" : "poster",
		visibilityState: priority === "near" ? "near" : "visible",
		screenArea: 1000,
		screenLongEdge: 100,
		distanceToViewportCenter: 0,
	}
}

function createAudioCandidate(priority: "visible" | "near"): AudioCandidate {
	return {
		elementId: "audio-1",
		path: "./audios/a.mp3",
		priority,
		tier: priority === "near" ? "url" : "preload",
		visibilityState: priority === "near" ? "near" : "visible",
		screenArea: 1000,
		screenLongEdge: 100,
		distanceToViewportCenter: 0,
	}
}

function createImageCandidate(
	elementId: string,
	priority: ImageResourceLoadPriority = "visible",
): ImageCandidate {
	return {
		elementId,
		path: `./images/${elementId}.png`,
		priority,
		variant: priority === "near" ? "low" : "preview",
		visibilityState: priority === "near" ? "near" : "visible",
		screenArea: 1000,
		screenLongEdge: 100,
		distanceToViewportCenter: Number(elementId.replace(/\D/g, "")) || 0,
	}
}

function createViewportSnapshot(
	visibleElementIds: string[] = [],
	nearElementIds: string[] = [],
	layoutElementIds: string[] = [...new Set([...visibleElementIds, ...nearElementIds])],
) {
	return {
		generation: 1,
		geometryRevision: 0,
		labelElementIds: [],
		nearElementIds: new Set(nearElementIds),
		nearRect: { x: -200, y: -200, width: 500, height: 500 },
		layoutElementIds: new Set(layoutElementIds),
		layoutRect: { x: -50, y: -50, width: 200, height: 200 },
		viewportRect: { x: 0, y: 0, width: 100, height: 100 },
		viewportScale: 1,
		visibleElementIds: new Set(visibleElementIds),
	}
}

type SelectImageCandidatesToLoad = (options: {
	pendingVisibleCandidates: ImageCandidate[]
	pendingLowDetailVisibleCandidates: ImageCandidate[]
	pendingNearCandidates: ImageCandidate[]
	reason: string
	shouldDeferNearLoads: boolean
}) => {
	visibleToLoad: ImageCandidate[]
	nearToLoad: ImageCandidate[]
	imageLoadRequestBudget: number | null
}

function createManager(requestPreviewLoad = vi.fn()) {
	const ensureFreshOssInfo = vi.fn()
	const manager = Object.create(CanvasVisibilityManager.prototype) as CanvasVisibilityManager & {
		canvas: {
			elementManager: {
				getElementInstance: () => { requestPreviewLoad: typeof requestPreviewLoad }
			}
			videoResourceManager: {
				ensureFreshOssInfo: typeof ensureFreshOssInfo
			}
		}
		lastRequestedVideoLoadState: Map<
			string,
			{
				priority: ImageResourceLoadPriority
				tier: "url" | "poster"
				requestedAt: number
			}
		>
		registeredImages: Map<string, { elementId: string; path: string }>
		registeredVideos: Map<string, { elementId: string; path: string }>
		registeredAudios: Map<string, { elementId: string; path: string }>
		lastVideoVisibilityState: Map<string, string>
		scheduleRefresh: ReturnType<typeof vi.fn>
	}
	manager.canvas = {
		elementManager: {
			getElementInstance: () => ({ requestPreviewLoad }),
		},
		videoResourceManager: {
			ensureFreshOssInfo,
		},
	}
	manager.lastRequestedVideoLoadState = new Map()
	manager.registeredImages = new Map()
	manager.registeredVideos = new Map()
	manager.registeredAudios = new Map()
	;(manager as unknown as { activeVideoIds: Set<string> }).activeVideoIds = new Set()
	manager.lastVideoVisibilityState = new Map()
	manager.scheduleRefresh = vi.fn()
	return { ensureFreshOssInfo, manager, requestPreviewLoad }
}

function createConstructedManager(requestPreviewLoad = vi.fn()) {
	const ensureFreshOssInfo = vi.fn()
	const getAudioResource = vi.fn()
	const prepareAudio = vi.fn(async () => true)
	const prepareWaveform = vi.fn(async () => true)
	const releaseAudio = vi.fn()
	const releaseViewportPreload = vi.fn()
	const imagePresentationScheduler = {
		replaceTargets: vi.fn(),
		removeTarget: vi.fn(),
		getSnapshot: vi.fn(() => ({
			targetCount: 0,
			pendingCount: 0,
			targetReplaceCount: 0,
			enqueuedCount: 0,
			pendingReplaceCount: 0,
			staleDropCount: 0,
			movingUpgradeDeferredCount: 0,
			appliedLowCount: 0,
			appliedPreviewCount: 0,
			appliedFullCount: 0,
			movingAppliedLowCount: 0,
			movingAppliedPreviewCount: 0,
			movingAppliedFullCount: 0,
			idleAppliedLowCount: 0,
			idleAppliedPreviewCount: 0,
			idleAppliedFullCount: 0,
			flushCount: 0,
			peakPendingCount: 0,
			drawRequestCount: 0,
		})),
	}
	const handlers = new Map<string, Array<(event: unknown) => void>>()
	let contentLayerListening = true
	const contentLayer = {
		listening: vi.fn((value?: boolean) => {
			if (typeof value === "boolean") {
				contentLayerListening = value
				return contentLayer
			}
			return contentLayerListening
		}),
		batchDraw: vi.fn(),
		getListeningValue: () => contentLayerListening,
	}
	const canvas = {
		eventEmitter: {
			on: vi.fn((type: string, handler: (event: unknown) => void) => {
				handlers.set(type, [...(handlers.get(type) ?? []), handler])
			}),
			off: vi.fn(),
		},
		contentLayer,
		elementManager: {
			getElementInstance: () => ({ requestPreviewLoad }),
			isElementVisibleInDataTree: () => true,
		},
		viewportQueryCoordinator: {
			getSnapshot: vi.fn(() => createViewportSnapshot()),
		},
		videoResourceManager: {
			ensureFreshOssInfo,
		},
		audioResourceManager: {
			getResource: getAudioResource,
		},
		audioPlaybackManager: {
			prepare: prepareAudio,
			release: releaseAudio,
			releaseViewportPreload,
		},
		audioWaveformManager: {
			prepare: prepareWaveform,
		},
		imageResourceManager: {
			getSnapshot: vi.fn(() => ({
				decodeAttemptCount: 0,
				decodeRepeatAttemptCount: 0,
				decodeSuccessCount: 0,
				decodeFailedCount: 0,
				decodedEvictedCount: 0,
				decodedEvictedBytes: 0,
				decodedEvictedLow: 0,
				decodedEvictedPreview: 0,
				decodedEvictedFull: 0,
				decodedBytesTotal: 0,
				lowLoaded: 0,
				previewLoaded: 0,
				fullLoaded: 0,
				activePreviewLoadPipelineCount: 0,
				queuedPreviewLoadCount: 0,
				workerActiveRequestCount: 0,
				workerActivePixelCost: 0,
				workerQueuedRequestCount: 0,
				activeDecodePixelCost: 0,
				queuedDecodePermitCount: 0,
			})),
		},
		imagePresentationScheduler,
		runtimeScheduler: {
			getViewportScaleLayoutElementCount: vi.fn(() => 0),
			replaceViewportScaleLayoutEligibility: vi.fn(),
			requestLayerDraw: vi.fn(),
			getSnapshot: vi.fn(() => ({
				drawRequestCount: 0,
				flushCount: 0,
				drawnCount: 0,
				coalescedDrawRequestCount: 0,
				drawReasonCounts: {},
			})),
		},
		magicConfigManager: {
			config: {
				methods: {},
			},
		},
	}
	const manager = new CanvasVisibilityManager({
		canvas: canvas as unknown as ConstructorParameters<
			typeof CanvasVisibilityManager
		>[0]["canvas"],
	}) as CanvasVisibilityManager & {
		lastRequestedVideoLoadState: Map<
			string,
			{
				priority: ImageResourceLoadPriority
				tier: "url" | "poster"
				requestedAt: number
			}
		>
		registeredVideos: Map<string, { elementId: string; path: string }>
	}
	return {
		contentLayer,
		ensureFreshOssInfo,
		getAudioResource,
		handlers,
		imagePresentationScheduler,
		manager,
		prepareAudio,
		prepareWaveform,
		releaseAudio,
		releaseViewportPreload,
		requestPreviewLoad,
	}
}

type RequestVideoLoad = (candidate: VideoCandidate, reason: string, force?: boolean) => void
type RequestAudioLoad = (candidate: AudioCandidate, reason: string, force?: boolean) => void
type ShouldRequestImageCandidate = (candidate: ImageCandidate) => boolean
type UpdateImageRetentionHints = (candidates: ImageCandidate[], lastSeenAt: number) => void

interface ConsumerVisibilityTestCanvas {
	elementManager: {
		isElementVisibleInDataTree: () => boolean
	}
	viewportQueryCoordinator: {
		getSnapshot: () => ReturnType<typeof createViewportSnapshot>
	}
}

describe("CanvasVisibilityManager video load requests", () => {
	it("registers media without maintaining a duplicate candidate id set", () => {
		const { manager: constructedManager } = createConstructedManager()
		const manager = constructedManager as unknown as CanvasVisibilityManager
		const internals = constructedManager as unknown as {
			registeredImages: Map<string, unknown>
			registeredVideos: Map<string, unknown>
			registeredAudios: Map<string, unknown>
			scheduleRefresh: ReturnType<typeof vi.fn>
		}
		internals.scheduleRefresh = vi.fn()

		manager.registerImageElement("image-1", "./images/a.png")
		manager.registerVideoElement("video-1", "./videos/a.mp4")
		manager.registerAudioElement("audio-1", "./audios/a.mp3")
		expect(internals.registeredImages.has("image-1")).toBe(true)
		expect(internals.registeredVideos.has("video-1")).toBe(true)
		expect(internals.registeredAudios.has("audio-1")).toBe(true)
		expect("registeredMediaElementIds" in internals).toBe(false)

		manager.unregisterImageElement("image-1")
		manager.unregisterVideoElement("video-1")
		manager.unregisterAudioElement("audio-1")
		expect(internals.registeredImages.size).toBe(0)
		expect(internals.registeredVideos.size).toBe(0)
		expect(internals.registeredAudios.size).toBe(0)
	})

	it("notifies consumer visibility changes independently of registered media", () => {
		const { manager } = createConstructedManager()
		let relation: "visible" | "near" | "far" = "visible"
		const canvas = (manager as unknown as { canvas: ConsumerVisibilityTestCanvas }).canvas
		canvas.elementManager.isElementVisibleInDataTree = () => true
		canvas.viewportQueryCoordinator = {
			getSnapshot: () =>
				createViewportSnapshot(
					relation === "visible" ? ["consumer"] : [],
					relation === "near" ? ["consumer"] : [],
				),
		}

		const states: string[] = []
		const registerConsumerVisibility = (manager as unknown as CanvasVisibilityManager)
			.registerConsumerVisibility
		const unsubscribe = registerConsumerVisibility.call(manager, "consumer", (state) => {
			states.push(state)
		})
		expect(
			(manager as unknown as { activeConsumerIds: Set<string> }).activeConsumerIds,
		).toEqual(new Set(["consumer"]))

		relation = "near"
		const applyConsumerVisibilityStates = (
			manager as unknown as {
				applyConsumerVisibilityStates: (
					visibleIds: ReadonlySet<string>,
					nearIds: ReadonlySet<string>,
				) => void
			}
		).applyConsumerVisibilityStates
		applyConsumerVisibilityStates.call(manager, new Set(), new Set(["consumer"]))
		relation = "far"
		applyConsumerVisibilityStates.call(manager, new Set(), new Set())
		applyConsumerVisibilityStates.call(manager, new Set(), new Set())

		expect(states).toEqual(["visible", "near", "far"])
		unsubscribe()
	})

	it("updates visibility state only for current and previous active media", () => {
		const manager = Object.create(CanvasVisibilityManager.prototype) as unknown as {
			replaceMediaVisibilityStates: (
				visibleIds: ReadonlySet<string>,
				nearIds: ReadonlySet<string>,
				previousActiveIds: Set<string>,
				states: Map<string, "visible" | "near" | "far">,
				registeredCount: number,
			) => number
		}
		const previousActiveIds = new Set(["stays-visible", "leaves-near"])
		const states = new Map<string, "visible" | "near" | "far">([
			["stays-visible", "visible"],
			["leaves-near", "near"],
			["already-far", "far"],
		])
		const setState = vi.spyOn(states, "set")

		const farCount = manager.replaceMediaVisibilityStates(
			new Set(["stays-visible", "enters-visible"]),
			new Set(["enters-near"]),
			previousActiveIds,
			states,
			10_000,
		)

		expect(farCount).toBe(9997)
		expect(previousActiveIds).toEqual(
			new Set(["stays-visible", "enters-visible", "enters-near"]),
		)
		expect(setState.mock.calls).toEqual([
			["leaves-near", "far"],
			["enters-visible", "visible"],
			["enters-near", "near"],
		])
	})

	it("binds viewport video requests to the shared path signal", () => {
		const { ensureFreshOssInfo, manager } = createManager()
		const requestVideoLoad = (manager as unknown as { requestVideoLoad: RequestVideoLoad })
			.requestVideoLoad

		requestVideoLoad.call(manager, createCandidate("near"), "viewport:pan")
		requestVideoLoad.call(manager, createCandidate("near"), "viewport:scale")

		expect(ensureFreshOssInfo).toHaveBeenCalledTimes(1)
		expect(ensureFreshOssInfo).toHaveBeenCalledWith(
			"./videos/a.mp4",
			expect.objectContaining({
				allowCachedFallback: true,
				signal: expect.any(AbortSignal),
			}),
		)
	})

	it("dedupes repeated near video url prewarm candidates", () => {
		const { ensureFreshOssInfo, manager, requestPreviewLoad } = createManager()
		const requestVideoLoad = (manager as unknown as { requestVideoLoad: RequestVideoLoad })
			.requestVideoLoad

		requestVideoLoad.call(manager, createCandidate("near"), "test")
		requestVideoLoad.call(manager, createCandidate("near"), "test")

		expect(ensureFreshOssInfo).toHaveBeenCalledTimes(1)
		expect(ensureFreshOssInfo).toHaveBeenCalledWith("./videos/a.mp4", {
			allowCachedFallback: true,
			priority: "near",
		})
		expect(requestPreviewLoad).not.toHaveBeenCalled()
	})

	it("allows video candidates to upgrade from url prewarm to poster preview", () => {
		const { ensureFreshOssInfo, manager, requestPreviewLoad } = createManager()
		const requestVideoLoad = (manager as unknown as { requestVideoLoad: RequestVideoLoad })
			.requestVideoLoad

		requestVideoLoad.call(manager, createCandidate("near"), "test")
		requestVideoLoad.call(manager, createCandidate("visible"), "test")

		expect(ensureFreshOssInfo).toHaveBeenCalledTimes(1)
		expect(requestPreviewLoad).toHaveBeenCalledTimes(1)
		expect(requestPreviewLoad).toHaveBeenCalledWith({ force: false })
	})

	it("clears requested video load state when a video element is unregistered", () => {
		const { ensureFreshOssInfo, manager, requestPreviewLoad } = createManager()
		const requestVideoLoad = (manager as unknown as { requestVideoLoad: RequestVideoLoad })
			.requestVideoLoad

		manager.registeredVideos.set("video-1", {
			elementId: "video-1",
			path: "./videos/a.mp4",
		})
		manager.lastRequestedVideoLoadState.set("video-1", {
			priority: "visible",
			tier: "poster",
			requestedAt: 1,
		})

		manager.unregisterVideoElement("video-1")
		requestVideoLoad.call(manager, createCandidate("near"), "test")

		expect(ensureFreshOssInfo).toHaveBeenCalledTimes(1)
		expect(requestPreviewLoad).not.toHaveBeenCalled()
		expect(manager.lastRequestedVideoLoadState.get("video-1")).toEqual(
			expect.objectContaining({
				priority: "near",
				tier: "url",
			}),
		)
	})

	it("clears requested video load state when video preview load fails", () => {
		const { handlers, manager } = createConstructedManager()

		manager.registeredVideos.set("video-1", {
			elementId: "video-1",
			path: "./videos/a.mp4",
		})
		manager.lastRequestedVideoLoadState.set("video-1", {
			priority: "visible",
			tier: "poster",
			requestedAt: 1,
		})

		handlers.get("resource:video:load-failed")?.[0]?.({
			data: { path: "./videos/a.mp4" },
		})

		expect(manager.lastRequestedVideoLoadState.has("video-1")).toBe(false)
	})

	it("clears requested video state when its poster is released", () => {
		const { handlers, manager } = createConstructedManager()
		const scheduleRefresh = vi.fn()
		;(manager as unknown as { scheduleRefresh: typeof scheduleRefresh }).scheduleRefresh =
			scheduleRefresh

		manager.registeredVideos.set("video-1", {
			elementId: "video-1",
			path: "./videos/a.mp4",
		})
		manager.lastRequestedVideoLoadState.set("video-1", {
			priority: "visible",
			tier: "poster",
			requestedAt: 1,
		})

		handlers.get("resource:video:will-release")?.[0]?.({
			data: { path: "./videos/a.mp4" },
		})

		expect(manager.lastRequestedVideoLoadState.has("video-1")).toBe(false)
		expect(scheduleRefresh).toHaveBeenCalledWith("video:poster-released", true)
	})
})

describe("CanvasVisibilityManager audio viewport requests", () => {
	it("updates equivalent audio references and allows refreshed resources to load again", () => {
		const { manager, releaseAudio } = createConstructedManager()
		const internals = manager as unknown as {
			canvas: {
				magicConfigManager: {
					config: {
						methods: {
							resolveResourceReference?: ReturnType<
								typeof createTestResourceReferenceResolver
							>
						}
					}
				}
			}
			registeredAudios: Map<string, { elementId: string; path: string }>
			lastAudioVisibilityState: Map<string, string>
			lastRequestedAudioLoadState: Map<
				string,
				{
					priority: ImageResourceLoadPriority
					tier: "url" | "preload"
					requestedAt: number
				}
			>
			scheduleRefresh: ReturnType<typeof vi.fn>
			cancelViewportResourceSignalIfUnused: ReturnType<typeof vi.fn>
		}
		internals.canvas.magicConfigManager.config.methods.resolveResourceReference =
			createTestResourceReferenceResolver({ currentCanvasWorkspacePath: "/画布A" })
		internals.scheduleRefresh = vi.fn()
		internals.cancelViewportResourceSignalIfUnused = vi.fn()
		internals.registeredAudios.set("audio-1", {
			elementId: "audio-1",
			path: "./audios/a.mp3",
		})
		internals.lastAudioVisibilityState.set("audio-1", "visible")
		internals.lastRequestedAudioLoadState.set("audio-1", {
			priority: "visible",
			tier: "preload",
			requestedAt: 1,
		})

		manager.updateAudioElement("audio-1", "/画布A/audios/a.mp3")

		expect(internals.registeredAudios.get("audio-1")?.path).toBe("/画布A/audios/a.mp3")
		expect(releaseAudio).toHaveBeenCalledWith("audio-1")
		expect(internals.lastAudioVisibilityState.has("audio-1")).toBe(false)
		expect(internals.lastRequestedAudioLoadState.has("audio-1")).toBe(false)

		internals.lastRequestedAudioLoadState.set("audio-1", {
			priority: "visible",
			tier: "preload",
			requestedAt: 2,
		})
		internals.scheduleRefresh.mockClear()

		manager.invalidateAudioLoadRequest("./audios/a.mp3", "host-refresh")

		expect(internals.lastRequestedAudioLoadState.has("audio-1")).toBe(false)
		expect(internals.scheduleRefresh).toHaveBeenCalledWith(
			"audio:load-request-invalidated:host-refresh",
			true,
		)
	})

	it("resolves near audio URLs without creating an HTMLAudioElement session", () => {
		const { getAudioResource, manager, prepareAudio } = createConstructedManager()
		const requestAudioLoad = (manager as unknown as { requestAudioLoad: RequestAudioLoad })
			.requestAudioLoad

		requestAudioLoad.call(manager, createAudioCandidate("near"), "viewport:idle-media")

		expect(getAudioResource).toHaveBeenCalledWith(
			"./audios/a.mp3",
			expect.objectContaining({
				allowCachedFallback: true,
				priority: "near",
				signal: expect.any(AbortSignal),
			}),
		)
		expect(prepareAudio).not.toHaveBeenCalled()
	})

	it("preloads visible audio and then schedules waveform decoding", async () => {
		const { getAudioResource, manager, prepareAudio, prepareWaveform } =
			createConstructedManager()
		const requestAudioLoad = (manager as unknown as { requestAudioLoad: RequestAudioLoad })
			.requestAudioLoad

		requestAudioLoad.call(manager, createAudioCandidate("visible"), "document:loaded")

		expect(prepareAudio).toHaveBeenCalledWith(
			"audio-1",
			"./audios/a.mp3",
			expect.objectContaining({
				source: "viewport",
				priority: "visible",
				signal: expect.any(AbortSignal),
			}),
		)
		expect(getAudioResource).not.toHaveBeenCalled()
		await Promise.resolve()
		expect(prepareWaveform).toHaveBeenCalledWith(
			"./audios/a.mp3",
			expect.objectContaining({
				priority: "visible",
				signal: expect.any(AbortSignal),
			}),
		)
	})

	it("retries a registered audio element through the critical metadata and waveform chain", async () => {
		const { manager, prepareAudio, prepareWaveform } = createConstructedManager()
		const internals = manager as unknown as {
			registeredAudios: Map<string, { elementId: string; path: string }>
		}
		internals.registeredAudios.set("audio-1", {
			elementId: "audio-1",
			path: "./audios/a.mp3",
		})

		manager.requestImmediateAudioLoad("audio-1", {
			reason: "audio-placeholder-retry",
			priority: "critical",
		})

		expect(prepareAudio).toHaveBeenCalledWith(
			"audio-1",
			"./audios/a.mp3",
			expect.objectContaining({
				source: "viewport",
				priority: "critical",
				signal: expect.any(AbortSignal),
			}),
		)
		await Promise.resolve()
		expect(prepareWaveform).toHaveBeenCalledWith(
			"./audios/a.mp3",
			expect.objectContaining({ priority: "critical" }),
		)
	})

	it("upgrades a near URL request to visible preload and dedupes repeats", () => {
		const { getAudioResource, manager, prepareAudio } = createConstructedManager()
		const requestAudioLoad = (manager as unknown as { requestAudioLoad: RequestAudioLoad })
			.requestAudioLoad

		requestAudioLoad.call(manager, createAudioCandidate("near"), "audio:register")
		requestAudioLoad.call(manager, createAudioCandidate("near"), "viewport:idle-media")
		requestAudioLoad.call(manager, createAudioCandidate("visible"), "viewport:idle-media")

		expect(getAudioResource).toHaveBeenCalledTimes(1)
		expect(prepareAudio).toHaveBeenCalledTimes(1)
	})

	it("clears transient failure dedupe but keeps not-found terminal", () => {
		const { handlers, manager } = createConstructedManager()
		const state = manager as unknown as {
			lastRequestedAudioLoadState: Map<string, unknown>
			registeredAudios: Map<string, { elementId: string; path: string }>
		}
		state.registeredAudios.set("audio-1", {
			elementId: "audio-1",
			path: "./audios/a.mp3",
		})
		state.lastRequestedAudioLoadState.set("audio-1", {})

		handlers.get("resource:audio:load-failed")?.[0]?.({
			data: { path: "./audios/a.mp3", reason: "load-error" },
		})
		expect(state.lastRequestedAudioLoadState.has("audio-1")).toBe(false)

		state.lastRequestedAudioLoadState.set("audio-1", {})
		handlers.get("resource:audio:load-failed")?.[0]?.({
			data: { path: "./audios/a.mp3", reason: "not-found" },
		})
		expect(state.lastRequestedAudioLoadState.has("audio-1")).toBe(true)
	})

	it("releases only far viewport sessions after the far drain is ready", () => {
		const { manager, releaseViewportPreload } = createConstructedManager()
		const audioState = manager as unknown as {
			registeredAudios: Map<string, { elementId: string; path: string }>
			lastAudioVisibilityState: Map<string, string>
			viewportPreloadedAudioIds: Set<string>
			scheduleFarVisibilityDrain: ReturnType<typeof vi.fn>
			updateAudioVisibilityStates: (
				visibleAudioIds: ReadonlySet<string>,
				nearAudioIds: ReadonlySet<string>,
				farDrainReady: boolean,
			) => number
		}
		audioState.scheduleFarVisibilityDrain = vi.fn()
		audioState.registeredAudios.set("audio-visible", {
			elementId: "audio-visible",
			path: "./audios/visible.mp3",
		})
		audioState.registeredAudios.set("audio-far", {
			elementId: "audio-far",
			path: "./audios/far.mp3",
		})
		audioState.viewportPreloadedAudioIds.add("audio-far")

		expect(
			audioState.updateAudioVisibilityStates(new Set(["audio-visible"]), new Set(), false),
		).toBe(1)
		expect(releaseViewportPreload).not.toHaveBeenCalled()
		expect(audioState.scheduleFarVisibilityDrain).toHaveBeenCalledTimes(1)

		audioState.updateAudioVisibilityStates(new Set(["audio-visible"]), new Set(), true)
		expect(releaseViewportPreload).toHaveBeenCalledWith("audio-far")
	})
})

describe("CanvasVisibilityManager image load requests", () => {
	it("clears image request dedupe state after transient load failures", () => {
		const { handlers, manager: constructedManager } = createConstructedManager()
		const manager = constructedManager as CanvasVisibilityManager & {
			registeredImages: Map<string, { elementId: string; path: string }>
			lastRequestedLoadState: Map<
				string,
				{
					priority: ImageResourceLoadPriority
					variant: ImageResourceVariant
					requestedAt: number
				}
			>
			scheduleRefresh: ReturnType<typeof vi.fn>
		}

		manager.registeredImages.set("image-preview", {
			elementId: "image-preview",
			path: "./images/a.png",
		})
		manager.registeredImages.set("image-full", {
			elementId: "image-full",
			path: "./images/a.png",
		})
		manager.registeredImages.set("image-other", {
			elementId: "image-other",
			path: "./images/b.png",
		})
		manager.lastRequestedLoadState.set("image-preview", {
			priority: "visible",
			variant: "preview",
			requestedAt: 1,
		})
		manager.lastRequestedLoadState.set("image-full", {
			priority: "critical",
			variant: "full",
			requestedAt: 1,
		})
		manager.lastRequestedLoadState.set("image-other", {
			priority: "visible",
			variant: "preview",
			requestedAt: 1,
		})
		manager.scheduleRefresh = vi.fn()

		handlers.get("resource:image:load-failed")?.[0]?.({
			data: { path: "./images/a.png", reason: "load-error" },
		})

		expect(manager.lastRequestedLoadState.has("image-preview")).toBe(false)
		expect(manager.lastRequestedLoadState.has("image-full")).toBe(false)
		expect(manager.lastRequestedLoadState.has("image-other")).toBe(true)
		expect(manager.scheduleRefresh).not.toHaveBeenCalled()
	})

	it("keeps not-found image requests terminal instead of creating a retry loop", () => {
		const { handlers, manager: constructedManager } = createConstructedManager()
		const manager = constructedManager as CanvasVisibilityManager & {
			registeredImages: Map<string, { elementId: string; path: string }>
			lastRequestedLoadState: Map<
				string,
				{
					priority: ImageResourceLoadPriority
					variant: ImageResourceVariant
					requestedAt: number
				}
			>
		}

		manager.registeredImages.set("image-1", {
			elementId: "image-1",
			path: "./images/missing.png",
		})
		manager.lastRequestedLoadState.set("image-1", {
			priority: "visible",
			variant: "preview",
			requestedAt: 1,
		})

		handlers.get("resource:image:load-failed")?.[0]?.({
			data: { path: "./images/missing.png", reason: "not-found" },
		})

		expect(manager.lastRequestedLoadState.has("image-1")).toBe(true)
	})

	it("clears only the failed non-low image variant request state", () => {
		const { handlers, manager: constructedManager } = createConstructedManager()
		const manager = constructedManager as CanvasVisibilityManager & {
			registeredImages: Map<string, { elementId: string; path: string }>
			lastRequestedLoadState: Map<
				string,
				{
					priority: ImageResourceLoadPriority
					variant: ImageResourceVariant
					requestedAt: number
				}
			>
		}

		manager.registeredImages.set("image-preview", {
			elementId: "image-preview",
			path: "./images/a.png",
		})
		manager.registeredImages.set("image-full", {
			elementId: "image-full",
			path: "./images/a.png",
		})
		manager.lastRequestedLoadState.set("image-preview", {
			priority: "visible",
			variant: "preview",
			requestedAt: 1,
		})
		manager.lastRequestedLoadState.set("image-full", {
			priority: "critical",
			variant: "full",
			requestedAt: 1,
		})

		handlers.get("resource:image:variant-load-failed")?.[0]?.({
			data: { path: "./images/a.png", variant: "full", reason: "load-error" },
		})

		expect(manager.lastRequestedLoadState.has("image-preview")).toBe(true)
		expect(manager.lastRequestedLoadState.has("image-full")).toBe(false)
	})

	it("does not reissue an unchanged viewport image request across pan and scale", () => {
		const loadResource = vi.fn()
		const manager = Object.create(
			CanvasVisibilityManager.prototype,
		) as CanvasVisibilityManager & {
			canvas: {
				imageResourceManager: {
					loadResource: typeof loadResource
				}
			}
			lastRequestedLoadState: Map<
				string,
				{
					priority: ImageResourceLoadPriority
					variant: ImageResourceVariant
					requestedAt: number
				}
			>
		}
		manager.canvas = {
			imageResourceManager: { loadResource },
		}
		manager.lastRequestedLoadState = new Map()

		const candidate = {
			...createImageCandidate("image-1", "visible"),
			path: "./images/a.png",
		}
		const requestImageLoad = (
			manager as unknown as {
				requestImageLoad: (candidate: ImageCandidate, reason: string) => void
			}
		).requestImageLoad
		requestImageLoad.call(manager, candidate, "viewport:pan")
		requestImageLoad.call(manager, candidate, "viewport:scale")

		expect(loadResource).toHaveBeenCalledTimes(1)
		expect(loadResource).toHaveBeenCalledWith(
			"./images/a.png",
			expect.objectContaining({
				signal: expect.any(AbortSignal),
			}),
		)
	})

	it("keeps the displayed image tier while moving and uses low for blank images", () => {
		let displayedVariant: ImageResourceVariant | undefined = "preview"
		const manager = Object.create(
			CanvasVisibilityManager.prototype,
		) as CanvasVisibilityManager & {
			canvas: {
				elementManager: {
					getElementInstance: () => {
						getDisplayResourceVariant: () => ImageResourceVariant | undefined
					}
				}
				magicConfigManager: { config: { methods: Record<string, never> } }
			}
			imagePresentationPhase: "moving" | "idle"
			lowFallbackPreviewPathByElementId: Map<string, string>
		}
		manager.canvas = {
			elementManager: {
				getElementInstance: () => ({
					getDisplayResourceVariant: () => displayedVariant,
				}),
			},
			magicConfigManager: { config: { methods: {} } },
		}
		manager.imagePresentationPhase = "moving"
		manager.lowFallbackPreviewPathByElementId = new Map()
		const resolveImageCandidateForPresentationPhase = (
			manager as unknown as {
				resolveImageCandidateForPresentationPhase: (
					candidate: ImageCandidate,
				) => ImageCandidate
			}
		).resolveImageCandidateForPresentationPhase
		const candidate = {
			...createImageCandidate("image-1", "visible"),
			variant: "full" as ImageResourceVariant,
			screenLongEdge: 2000,
		}

		expect(resolveImageCandidateForPresentationPhase.call(manager, candidate)).toEqual(
			expect.objectContaining({
				variant: "preview",
				screenLongEdge: 2000,
			}),
		)

		displayedVariant = undefined
		expect(resolveImageCandidateForPresentationPhase.call(manager, candidate)).toEqual(
			expect.objectContaining({ variant: "low" }),
		)

		manager.imagePresentationPhase = "idle"
		expect(resolveImageCandidateForPresentationPhase.call(manager, candidate)).toEqual(
			expect.objectContaining({
				variant: "full",
			}),
		)

		manager.lowFallbackPreviewPathByElementId.set("image-1", candidate.path)
		expect(
			resolveImageCandidateForPresentationPhase.call(manager, {
				...candidate,
				variant: "low",
			}),
		).toEqual(expect.objectContaining({ variant: "preview" }))
	})

	it("lets blank moving images request low without waiting for tier cooldown", () => {
		const manager = Object.create(
			CanvasVisibilityManager.prototype,
		) as CanvasVisibilityManager & {
			canvas: {
				elementManager: {
					getElementInstance: () => {
						getDisplayResourceVariant: () => undefined
					}
				}
			}
			imagePresentationPhase: "moving"
			lastRequestedLoadState: Map<string, unknown>
			scheduleRefresh: ReturnType<typeof vi.fn>
		}
		manager.canvas = {
			elementManager: {
				getElementInstance: () => ({ getDisplayResourceVariant: () => undefined }),
			},
		}
		manager.imagePresentationPhase = "moving"
		manager.lastRequestedLoadState = new Map([
			[
				"image-1",
				{ priority: "visible", variant: "preview", requestedAt: performance.now() },
			],
		])
		manager.scheduleRefresh = vi.fn()

		expect(
			manager.shouldRequestImageCandidate({
				...createImageCandidate("image-1"),
				variant: "low",
			}),
		).toBe(true)
		expect(manager.scheduleRefresh).not.toHaveBeenCalled()
	})

	it("limits admitted full candidates per refresh", () => {
		const manager = Object.create(
			CanvasVisibilityManager.prototype,
		) as CanvasVisibilityManager & {
			canvas: {
				imageResourceManager: {
					getFullAdmissionSnapshot: () => {
						fullDecodedBytes: number
						fullLoadingCount: number
						fullBudgetBytes: number
					}
				}
			}
			admitOrDowngradeFullCandidates: (candidates: ImageCandidate[]) => ImageCandidate[]
		}
		manager.canvas = {
			imageResourceManager: {
				getFullAdmissionSnapshot: () => ({
					fullDecodedBytes: 0,
					fullLoadingCount: 0,
					fullBudgetBytes: 10_000,
				}),
			},
		}
		const candidates = ["image-1", "image-2", "image-3", "image-4", "image-5"].map((id) => ({
			...createImageCandidate(id, "visible"),
			variant: "full" as ImageResourceVariant,
		}))

		const admitted = manager.admitOrDowngradeFullCandidates(candidates)

		expect(admitted.map((candidate) => candidate.variant)).toEqual([
			"full",
			"full",
			"full",
			"full",
			"preview",
		])
	})

	it("admits viewport-centered full candidates before larger distant full candidates", () => {
		const manager = Object.create(
			CanvasVisibilityManager.prototype,
		) as CanvasVisibilityManager & {
			canvas: {
				imageResourceManager: {
					getFullAdmissionSnapshot: () => {
						fullDecodedBytes: number
						fullLoadingCount: number
						fullBudgetBytes: number
					}
				}
			}
			admitOrDowngradeFullCandidates: (candidates: ImageCandidate[]) => ImageCandidate[]
		}
		manager.canvas = {
			imageResourceManager: {
				getFullAdmissionSnapshot: () => ({
					fullDecodedBytes: 0,
					fullLoadingCount: 0,
					fullBudgetBytes: 10_000,
				}),
			},
		}
		const farLarge = {
			...createImageCandidate("image-1", "visible"),
			variant: "full" as ImageResourceVariant,
			screenArea: 100_000,
			screenLongEdge: 1000,
			distanceToViewportCenter: 500,
		}
		const centeredSmall = {
			...createImageCandidate("image-2", "visible"),
			variant: "full" as ImageResourceVariant,
			screenArea: 100,
			screenLongEdge: 100,
			distanceToViewportCenter: 0,
		}
		const nearMedium = {
			...createImageCandidate("image-3", "visible"),
			variant: "full" as ImageResourceVariant,
			screenArea: 10_000,
			screenLongEdge: 500,
			distanceToViewportCenter: 20,
		}
		const nearLarge = {
			...createImageCandidate("image-4", "visible"),
			variant: "full" as ImageResourceVariant,
			screenArea: 20_000,
			screenLongEdge: 700,
			distanceToViewportCenter: 30,
		}
		const nearSmall = {
			...createImageCandidate("image-5", "visible"),
			variant: "full" as ImageResourceVariant,
			screenArea: 200,
			screenLongEdge: 120,
			distanceToViewportCenter: 40,
		}

		const admitted = manager.admitOrDowngradeFullCandidates([
			farLarge,
			centeredSmall,
			nearMedium,
			nearLarge,
			nearSmall,
		])

		expect(admitted.map((candidate) => candidate.variant)).toEqual([
			"preview",
			"full",
			"full",
			"full",
			"full",
		])
	})

	it("allows one top full candidate when the full budget is reached", () => {
		const manager = Object.create(
			CanvasVisibilityManager.prototype,
		) as CanvasVisibilityManager & {
			canvas: {
				imageResourceManager: {
					getFullAdmissionSnapshot: () => {
						fullDecodedBytes: number
						fullLoadingCount: number
						fullBudgetBytes: number
					}
				}
			}
			admitOrDowngradeFullCandidates: (candidates: ImageCandidate[]) => ImageCandidate[]
		}
		manager.canvas = {
			imageResourceManager: {
				getFullAdmissionSnapshot: () => ({
					fullDecodedBytes: 10_000,
					fullLoadingCount: 0,
					fullBudgetBytes: 10_000,
				}),
			},
		}
		const candidates = ["image-1", "image-2"].map((id) => ({
			...createImageCandidate(id, "visible"),
			variant: "full" as ImageResourceVariant,
		}))

		const admitted = manager.admitOrDowngradeFullCandidates(candidates)

		expect(admitted.map((candidate) => candidate.variant)).toEqual(["full", "preview"])
	})

	it("downgrades full candidates when full loads are already saturated", () => {
		const manager = Object.create(
			CanvasVisibilityManager.prototype,
		) as CanvasVisibilityManager & {
			canvas: {
				imageResourceManager: {
					getFullAdmissionSnapshot: () => {
						fullDecodedBytes: number
						fullLoadingCount: number
						fullBudgetBytes: number
					}
				}
			}
			admitOrDowngradeFullCandidates: (candidates: ImageCandidate[]) => ImageCandidate[]
		}
		manager.canvas = {
			imageResourceManager: {
				getFullAdmissionSnapshot: () => ({
					fullDecodedBytes: 0,
					fullLoadingCount: 4,
					fullBudgetBytes: 10_000,
				}),
			},
		}
		const candidates = ["image-1", "image-2"].map((id) => ({
			...createImageCandidate(id, "visible"),
			variant: "full" as ImageResourceVariant,
		}))

		const admitted = manager.admitOrDowngradeFullCandidates(candidates)

		expect(admitted.map((candidate) => candidate.variant)).toEqual(["preview", "preview"])
	})

	it("allows idle media refreshes to bypass the rapid variant switch cooldown", () => {
		const manager = Object.create(
			CanvasVisibilityManager.prototype,
		) as CanvasVisibilityManager & {
			lastRequestedLoadState: Map<
				string,
				{
					priority: ImageResourceLoadPriority
					variant: ImageResourceVariant
					requestedAt: number
				}
			>
			shouldRequestImageCandidate: (
				candidate: ImageCandidate,
				options?: { reason?: string },
			) => boolean
			scheduleRefresh: ReturnType<typeof vi.fn>
		}
		manager.lastRequestedLoadState = new Map([
			[
				"image-1",
				{
					priority: "visible",
					variant: "preview",
					requestedAt: performance.now(),
				},
			],
		])
		manager.scheduleRefresh = vi.fn()

		expect(
			manager.shouldRequestImageCandidate(
				{
					...createImageCandidate("image-1", "visible"),
					variant: "full",
					screenLongEdge: 2000,
				},
				{ reason: "viewport:idle-media" },
			),
		).toBe(true)
		expect(manager.scheduleRefresh).not.toHaveBeenCalled()
	})

	it("passes directed completion metadata to full image resource loads", () => {
		const loadResource = vi.fn()
		const manager = Object.create(CanvasVisibilityManager.prototype) as {
			canvas: {
				imageResourceManager: {
					loadResource: typeof loadResource
				}
			}
			lastRequestedLoadState: Map<
				string,
				{
					priority: ImageResourceLoadPriority
					variant: ImageResourceVariant
					requestedAt: number
				}
			>
			requestImageLoad: (candidate: ImageCandidate, reason: string, force?: boolean) => void
		}
		manager.canvas = {
			imageResourceManager: { loadResource },
		}
		manager.lastRequestedLoadState = new Map()
		const requestImageLoad = manager.requestImageLoad.bind(manager)

		requestImageLoad(
			{
				elementId: "image-1",
				path: "./images/a.png",
				priority: "visible",
				variant: "full",
				visibilityState: "visible",
				screenArea: 40000,
				screenLongEdge: 200,
				distanceToViewportCenter: 0,
			},
			"viewport:scale",
		)

		expect(loadResource).toHaveBeenCalledWith(
			"./images/a.png",
			expect.objectContaining({
				variant: "full",
				priority: "visible",
				displayTargetElementId: "image-1",
				displayTargetReason: "viewport:scale",
				signal: expect.any(AbortSignal),
			}),
		)
	})

	it("does not attach viewport cancellation to non-viewport image requests", () => {
		const loadResource = vi.fn()
		const manager = Object.create(CanvasVisibilityManager.prototype) as {
			canvas: {
				imageResourceManager: {
					loadResource: typeof loadResource
				}
			}
			lastRequestedLoadState: Map<
				string,
				{
					priority: ImageResourceLoadPriority
					variant: ImageResourceVariant
					requestedAt: number
				}
			>
			requestImageLoad: (candidate: ImageCandidate, reason: string, force?: boolean) => void
		}
		manager.canvas = {
			imageResourceManager: { loadResource },
		}
		manager.lastRequestedLoadState = new Map()

		manager.requestImageLoad(
			{
				...createImageCandidate("image-1", "critical"),
				path: "./images/a.png",
			},
			"selection:container",
		)

		expect(loadResource).toHaveBeenCalledWith("./images/a.png", {
			variant: "preview",
			priority: "critical",
			displayTargetElementId: "image-1",
			displayTargetReason: "selection:container",
		})
	})

	it("invalidates image load request dedupe state by path and variant", () => {
		const manager = Object.create(CanvasVisibilityManager.prototype) as {
			canvas: {
				magicConfigManager: {
					config: {
						methods: Record<string, never>
					}
				}
				imagePresentationScheduler: {
					removeTarget: ReturnType<typeof vi.fn>
				}
			}
			destroyed: boolean
			registeredImages: Map<string, { elementId: string; path: string }>
			lastRequestedLoadState: Map<
				string,
				{
					priority: ImageResourceLoadPriority
					variant: ImageResourceVariant
					requestedAt: number
				}
			>
			scheduleRefresh: ReturnType<typeof vi.fn>
			invalidateImageLoadRequest: CanvasVisibilityManager["invalidateImageLoadRequest"]
		}
		manager.canvas = {
			magicConfigManager: {
				config: {
					methods: {},
				},
			},
			imagePresentationScheduler: {
				removeTarget: vi.fn(),
			},
		}
		manager.destroyed = false
		manager.registeredImages = new Map([
			["image-1", { elementId: "image-1", path: "./images/a.png" }],
			["image-2", { elementId: "image-2", path: "./images/a.png" }],
			["image-3", { elementId: "image-3", path: "./images/b.png" }],
		])
		manager.lastRequestedLoadState = new Map([
			["image-1", { priority: "visible", variant: "preview", requestedAt: 1 }],
			["image-2", { priority: "visible", variant: "full", requestedAt: 1 }],
			["image-3", { priority: "visible", variant: "preview", requestedAt: 1 }],
		])
		manager.scheduleRefresh = vi.fn()

		manager.invalidateImageLoadRequest("./images/a.png", "preview", "decoded-budget")

		expect(manager.lastRequestedLoadState.has("image-1")).toBe(false)
		expect(manager.lastRequestedLoadState.has("image-2")).toBe(true)
		expect(manager.lastRequestedLoadState.has("image-3")).toBe(true)
		expect(manager.scheduleRefresh).toHaveBeenCalledWith(
			"image:load-request-invalidated:decoded-budget",
			true,
		)

		manager.scheduleRefresh.mockClear()
		manager.invalidateImageLoadRequest("./images/a.png", "low", "decoded-budget")
		expect(manager.lastRequestedLoadState.has("image-2")).toBe(true)
		expect(manager.scheduleRefresh).not.toHaveBeenCalled()

		manager.invalidateImageLoadRequest("./images/a.png", undefined, "decoded-budget")
		expect(manager.lastRequestedLoadState.has("image-2")).toBe(false)
		expect(manager.lastRequestedLoadState.has("image-3")).toBe(true)
		expect(manager.scheduleRefresh).toHaveBeenCalledWith(
			"image:load-request-invalidated:decoded-budget",
			true,
		)

		manager.scheduleRefresh.mockClear()
		manager.invalidateImageLoadRequest("./images/a.png", undefined, "decoded-budget")
		expect(manager.scheduleRefresh).toHaveBeenCalledWith(
			"image:load-request-invalidated:decoded-budget",
			true,
		)
	})

	it("caps background image load requests and keeps visible candidates first", () => {
		const manager = Object.create(CanvasVisibilityManager.prototype) as CanvasVisibilityManager
		const selectImageCandidatesToLoad = (
			manager as unknown as { selectImageCandidatesToLoad: SelectImageCandidatesToLoad }
		).selectImageCandidatesToLoad
		const visibleCandidates = Array.from({ length: 5 }, (_, index) =>
			createImageCandidate(`visible-${index}`, "visible"),
		)
		const nearCandidates = Array.from({ length: 20 }, (_, index) =>
			createImageCandidate(`near-${index}`, "near"),
		)

		const result = selectImageCandidatesToLoad.call(manager, {
			pendingLowDetailVisibleCandidates: [],
			pendingNearCandidates: nearCandidates,
			pendingVisibleCandidates: visibleCandidates,
			reason: "visibility:drain",
			shouldDeferNearLoads: false,
		})

		expect(result.imageLoadRequestBudget).toBe(12)
		expect(result.visibleToLoad).toHaveLength(5)
		expect(result.nearToLoad).toHaveLength(7)
	})

	it("does not apply the background image load budget to normal refreshes", () => {
		const manager = Object.create(CanvasVisibilityManager.prototype) as CanvasVisibilityManager
		const selectImageCandidatesToLoad = (
			manager as unknown as { selectImageCandidatesToLoad: SelectImageCandidatesToLoad }
		).selectImageCandidatesToLoad
		const visibleCandidates = Array.from({ length: 20 }, (_, index) =>
			createImageCandidate(`visible-${index}`, "visible"),
		)
		const nearCandidates = Array.from({ length: 20 }, (_, index) =>
			createImageCandidate(`near-${index}`, "near"),
		)

		const result = selectImageCandidatesToLoad.call(manager, {
			pendingLowDetailVisibleCandidates: [],
			pendingNearCandidates: nearCandidates,
			pendingVisibleCandidates: visibleCandidates,
			reason: "document:restored",
			shouldDeferNearLoads: false,
		})

		expect(result.imageLoadRequestBudget).toBeNull()
		expect(result.visibleToLoad).toHaveLength(20)
		expect(result.nearToLoad).toHaveLength(20)
	})
})

describe("CanvasVisibilityManager image variant switch cooldown", () => {
	it("schedules a forced refresh when a fast cross-tier request is suppressed", () => {
		vi.useFakeTimers()
		try {
			const manager = Object.create(
				CanvasVisibilityManager.prototype,
			) as CanvasVisibilityManager & {
				destroyed: boolean
				lastRequestedLoadState: Map<
					string,
					{
						priority: ImageResourceLoadPriority
						variant: ImageResourceVariant
						requestedAt: number
					}
				>
				variantSwitchCooldownTimerId: ReturnType<typeof setTimeout> | null
				scheduleRefresh: ReturnType<typeof vi.fn>
				shouldRequestImageCandidate: ShouldRequestImageCandidate
			}
			manager.destroyed = false
			manager.variantSwitchCooldownTimerId = null
			manager.scheduleRefresh = vi.fn()
			manager.lastRequestedLoadState = new Map([
				[
					"image-1",
					{
						priority: "visible",
						variant: "low",
						requestedAt: performance.now(),
					},
				],
			])

			const shouldRequest = manager.shouldRequestImageCandidate({
				elementId: "image-1",
				path: "./images/a.png",
				priority: "visible",
				variant: "preview",
				visibilityState: "visible",
				screenArea: 1000,
				screenLongEdge: 500,
				distanceToViewportCenter: 0,
			})

			expect(shouldRequest).toBe(false)
			vi.advanceTimersByTime(449)
			expect(manager.scheduleRefresh).not.toHaveBeenCalled()
			vi.advanceTimersByTime(1)
			expect(manager.scheduleRefresh).toHaveBeenCalledWith(
				"visibility:variant-switch-cooldown",
				true,
			)
			expect(manager.variantSwitchCooldownTimerId).toBeNull()
		} finally {
			vi.useRealTimers()
		}
	})
})

describe("CanvasVisibilityManager decoded image retention hints", () => {
	function createRetentionManager(displayedVariant?: ImageResourceVariant) {
		const manager = Object.create(
			CanvasVisibilityManager.prototype,
		) as CanvasVisibilityManager & {
			canvas: {
				elementManager: {
					getElementInstance: () => {
						getDisplayResourceVariant?: () => ImageResourceVariant | undefined
					}
				}
				magicConfigManager: {
					config: {
						methods: Record<string, never>
					}
				}
				imagePresentationScheduler: {
					removeTarget: ReturnType<typeof vi.fn>
				}
			}
			destroyed: boolean
			registeredImages: Map<string, { elementId: string; path: string }>
			registeredVideos: Map<string, { elementId: string; path: string }>
			registeredAudios: Map<string, { elementId: string; path: string }>
			consumerVisibilityListeners: Map<string, Set<(state: string) => void>>
			lastVisibilityState: Map<string, string>
			lastRequestedLoadState: Map<string, unknown>
			lowFallbackPreviewPathByElementId: Map<string, string>
			imageRetentionHints: Map<string, unknown>
			scheduleRefresh: ReturnType<typeof vi.fn>
		}
		manager.canvas = {
			elementManager: {
				getElementInstance: () => ({
					getDisplayResourceVariant: () => displayedVariant,
				}),
			},
			magicConfigManager: {
				config: {
					methods: {},
				},
			},
			imagePresentationScheduler: {
				removeTarget: vi.fn(),
			},
		}
		manager.destroyed = false
		manager.registeredImages = new Map([
			["image-1", { elementId: "image-1", path: "./images/a.png" }],
		])
		manager.registeredVideos = new Map()
		manager.registeredAudios = new Map()
		;(manager as unknown as { activeImageIds: Set<string> }).activeImageIds = new Set([
			"image-1",
		])
		manager.lastVisibilityState = new Map()
		manager.lastRequestedLoadState = new Map()
		manager.lowFallbackPreviewPathByElementId = new Map()
		manager.imageRetentionHints = new Map()
		manager.scheduleRefresh = vi.fn()
		return manager
	}

	it("returns visible image retention hints with requested and displayed variants", () => {
		const manager = createRetentionManager("full")
		const updateImageRetentionHints = (
			manager as unknown as { updateImageRetentionHints: UpdateImageRetentionHints }
		).updateImageRetentionHints

		updateImageRetentionHints.call(
			manager,
			[
				{
					elementId: "image-1",
					path: "./images/a.png",
					priority: "visible",
					variant: "full",
					visibilityState: "visible",
					screenArea: 1_000_000,
					screenLongEdge: 2000,
					distanceToViewportCenter: 0,
				},
			],
			performance.now(),
		)

		expect(manager.getDecodedImageRetentionSnapshot()).toEqual([
			expect.objectContaining({
				elementId: "image-1",
				path: "./images/a.png",
				visibilityState: "visible",
				requestedVariant: "full",
				displayedVariant: "full",
				screenLongEdge: 2000,
			}),
		])
	})

	it("clears image retention hints on unregister and path update", () => {
		const manager = createRetentionManager("preview")
		const updateImageRetentionHints = (
			manager as unknown as { updateImageRetentionHints: UpdateImageRetentionHints }
		).updateImageRetentionHints

		updateImageRetentionHints.call(
			manager,
			[
				{
					elementId: "image-1",
					path: "./images/a.png",
					priority: "visible",
					variant: "preview",
					visibilityState: "visible",
					screenArea: 1000,
					screenLongEdge: 500,
					distanceToViewportCenter: 0,
				},
			],
			performance.now(),
		)
		manager.updateImageElement("image-1", "./images/b.png")

		expect(manager.getDecodedImageRetentionSnapshot()).toEqual([])
		expect(manager.registeredImages.get("image-1")?.path).toBe("./images/b.png")

		updateImageRetentionHints.call(
			manager,
			[
				{
					elementId: "image-1",
					path: "./images/b.png",
					priority: "visible",
					variant: "preview",
					visibilityState: "visible",
					screenArea: 1000,
					screenLongEdge: 500,
					distanceToViewportCenter: 0,
				},
			],
			performance.now(),
		)
		manager.unregisterImageElement("image-1")

		expect(manager.getDecodedImageRetentionSnapshot()).toEqual([])
		expect(manager.registeredImages.has("image-1")).toBe(false)
	})

	it("keeps retention hints during the grace window and prunes them after expiry", () => {
		vi.useFakeTimers()
		try {
			const manager = createRetentionManager("preview")
			const updateImageRetentionHints = (
				manager as unknown as { updateImageRetentionHints: UpdateImageRetentionHints }
			).updateImageRetentionHints

			updateImageRetentionHints.call(
				manager,
				[
					{
						elementId: "image-1",
						path: "./images/a.png",
						priority: "near",
						variant: "preview",
						visibilityState: "near",
						screenArea: 1000,
						screenLongEdge: 500,
						distanceToViewportCenter: 0,
					},
				],
				performance.now(),
			)

			vi.advanceTimersByTime(4999)
			expect(manager.getDecodedImageRetentionSnapshot()).toHaveLength(1)

			vi.advanceTimersByTime(2)
			expect(manager.getDecodedImageRetentionSnapshot()).toEqual([])
		} finally {
			vi.useRealTimers()
		}
	})
})

describe("CanvasVisibilityManager content layer hit graph suppression", () => {
	it("uses an explicit viewport end event to enter idle immediately", () => {
		vi.useFakeTimers()
		try {
			const { handlers, manager } = createConstructedManager()
			const scheduleRefresh = vi.fn()
			;(manager as unknown as { scheduleRefresh: typeof scheduleRefresh }).scheduleRefresh =
				scheduleRefresh

			handlers.get("viewport:pan")?.[0]?.({})
			handlers.get("viewport:changed")?.[0]?.({ data: { phase: "end" } })

			expect(scheduleRefresh).toHaveBeenCalledWith("viewport:idle-media", true)
			vi.advanceTimersByTime(160)
			expect(scheduleRefresh.mock.calls).toEqual([
				["viewport:pan", false],
				["viewport:idle-media", true],
			])
			manager.destroy()
		} finally {
			vi.useRealTimers()
		}
	})

	it("schedules an idle media refresh after viewport movement settles", () => {
		vi.useFakeTimers()
		try {
			const { handlers, manager } = createConstructedManager()
			const scheduleRefresh = vi.fn()
			;(manager as unknown as { scheduleRefresh: typeof scheduleRefresh }).scheduleRefresh =
				scheduleRefresh

			handlers.get("viewport:pan")?.[0]?.({})

			expect(scheduleRefresh).toHaveBeenCalledWith("viewport:pan", false)
			vi.advanceTimersByTime(159)
			expect(scheduleRefresh).not.toHaveBeenCalledWith("viewport:idle-media", true)
			vi.advanceTimersByTime(1)
			expect(scheduleRefresh).toHaveBeenCalledWith("viewport:idle-media", true)
			manager.destroy()
		} finally {
			vi.useRealTimers()
		}
	})

	it("disables content layer listening during viewport movement and restores it after idle", () => {
		vi.useFakeTimers()
		try {
			const { contentLayer, handlers, manager } = createConstructedManager()

			handlers.get("viewport:pan")?.[0]?.({})

			expect(contentLayer.getListeningValue()).toBe(false)
			vi.advanceTimersByTime(159)
			expect(contentLayer.getListeningValue()).toBe(false)
			vi.advanceTimersByTime(1)

			expect(contentLayer.getListeningValue()).toBe(true)
			expect(contentLayer.batchDraw).toHaveBeenCalledTimes(1)
			manager.destroy()
		} finally {
			vi.useRealTimers()
		}
	})

	it("keeps content layer listening disabled while viewport movement continues", () => {
		vi.useFakeTimers()
		try {
			const { contentLayer, handlers, manager } = createConstructedManager()

			handlers.get("viewport:pan")?.[0]?.({})
			vi.advanceTimersByTime(100)
			handlers.get("viewport:scale")?.[0]?.({})
			vi.advanceTimersByTime(159)
			expect(contentLayer.getListeningValue()).toBe(false)
			vi.advanceTimersByTime(1)

			expect(contentLayer.getListeningValue()).toBe(true)
			manager.destroy()
		} finally {
			vi.useRealTimers()
		}
	})
})

describe("CanvasVisibilityManager far visibility drain scheduling", () => {
	it("cancels a pending far drain when viewport movement resumes", () => {
		vi.useFakeTimers()
		try {
			const { manager } = createConstructedManager()
			const state = manager as unknown as {
				markViewportMoving: (currentTime?: number) => void
				scheduleFarVisibilityDrain: () => void
				scheduleRefresh: ReturnType<typeof vi.fn>
			}
			const scheduleRefresh = vi.fn()
			state.scheduleRefresh = scheduleRefresh

			state.markViewportMoving(0)
			state.scheduleFarVisibilityDrain()
			vi.advanceTimersByTime(2999)

			state.markViewportMoving(1)
			vi.advanceTimersByTime(3000)
			expect(scheduleRefresh).not.toHaveBeenCalledWith("visibility:far-drain", true)

			state.scheduleFarVisibilityDrain()
			vi.advanceTimersByTime(2999)
			expect(scheduleRefresh).not.toHaveBeenCalledWith("visibility:far-drain", true)
			vi.advanceTimersByTime(1)
			expect(scheduleRefresh).toHaveBeenCalledWith("visibility:far-drain", true)
			manager.destroy()
		} finally {
			vi.useRealTimers()
		}
	})

	it("defers a far-drain refresh that races with new viewport movement", () => {
		vi.useFakeTimers()
		try {
			const { manager } = createConstructedManager()
			const state = manager as unknown as {
				lastViewportMovementAt: number
				registeredImages: Map<string, { elementId: string; path: string }>
				refreshVisibility: (reason: string, requiresFullRefresh: boolean) => void
				scheduleFarVisibilityDrain: () => void
				canvas: {
					viewportQueryCoordinator: { getSnapshot: ReturnType<typeof vi.fn> }
				}
			}
			state.registeredImages.set("image-1", {
				elementId: "image-1",
				path: "./images/a.png",
			})
			state.lastViewportMovementAt = performance.now()
			const scheduleFarVisibilityDrain = vi
				.spyOn(state, "scheduleFarVisibilityDrain")
				.mockImplementation(() => undefined)

			state.refreshVisibility("visibility:far-drain", true)

			expect(scheduleFarVisibilityDrain).toHaveBeenCalledTimes(1)
			expect(state.canvas.viewportQueryCoordinator.getSnapshot).not.toHaveBeenCalled()
			manager.destroy()
		} finally {
			vi.useRealTimers()
		}
	})
})

describe("CanvasVisibilityManager covered viewport motion reuse", () => {
	type ViewportRect = { x: number; y: number; width: number; height: number }

	it("reuses state only while viewport, scale, and geometry stay inside the settled contract", () => {
		const manager = Object.create(CanvasVisibilityManager.prototype) as unknown as {
			canvas: {
				geometryCacheManager: {
					containsRect: (outer: ViewportRect, inner: ViewportRect) => boolean
				}
			}
			lastQueryCoverRect: ViewportRect
			lastQueryLayoutRect: ViewportRect
			lastScaleBand: number
			lastQueryViewportScale: number
			lastQueryGeometryRevision: number
			shouldReuseCoveredViewportState: (options: {
				reason: string
				requiresFullRefresh: boolean
				viewportRect: ViewportRect
				viewportScale: number
				scaleBand: number
				geometryRevision: number
			}) => boolean
		}
		manager.canvas = {
			geometryCacheManager: {
				containsRect: (outer, inner) =>
					inner.x >= outer.x &&
					inner.y >= outer.y &&
					inner.x + inner.width <= outer.x + outer.width &&
					inner.y + inner.height <= outer.y + outer.height,
			},
		}
		manager.lastQueryCoverRect = { x: 0, y: 0, width: 1000, height: 800 }
		manager.lastQueryLayoutRect = { x: 50, y: 50, width: 800, height: 600 }
		manager.lastScaleBand = 3
		manager.lastQueryViewportScale = 1
		manager.lastQueryGeometryRevision = 7
		const shouldReuse = manager.shouldReuseCoveredViewportState.bind(manager)

		expect(
			shouldReuse({
				reason: "viewport:pan",
				requiresFullRefresh: false,
				viewportRect: { x: 100, y: 100, width: 600, height: 400 },
				viewportScale: 1,
				scaleBand: 3,
				geometryRevision: 7,
			}),
		).toBe(true)
		expect(
			shouldReuse({
				reason: "viewport:scale",
				requiresFullRefresh: false,
				viewportRect: { x: 80, y: 80, width: 700, height: 500 },
				viewportScale: 1.05,
				scaleBand: 3,
				geometryRevision: 7,
			}),
		).toBe(true)
		expect(
			shouldReuse({
				reason: "viewport:pan",
				requiresFullRefresh: false,
				viewportRect: { x: 200, y: 100, width: 700, height: 400 },
				viewportScale: 1,
				scaleBand: 3,
				geometryRevision: 7,
			}),
		).toBe(false)
		expect(
			shouldReuse({
				reason: "viewport:pan",
				requiresFullRefresh: false,
				viewportRect: { x: 500, y: 300, width: 600, height: 600 },
				viewportScale: 1,
				scaleBand: 3,
				geometryRevision: 7,
			}),
		).toBe(false)
		expect(
			shouldReuse({
				reason: "viewport:pan",
				requiresFullRefresh: false,
				viewportRect: { x: 100, y: 100, width: 600, height: 400 },
				viewportScale: 1,
				scaleBand: 3,
				geometryRevision: 8,
			}),
		).toBe(false)
		expect(
			shouldReuse({
				reason: "viewport:scale",
				requiresFullRefresh: false,
				viewportRect: { x: 100, y: 100, width: 600, height: 400 },
				viewportScale: 1.16,
				scaleBand: 3,
				geometryRevision: 7,
			}),
		).toBe(false)
		expect(
			shouldReuse({
				reason: "viewport:pan",
				requiresFullRefresh: true,
				viewportRect: { x: 100, y: 100, width: 600, height: 400 },
				viewportScale: 1,
				scaleBand: 3,
				geometryRevision: 7,
			}),
		).toBe(false)
		expect(
			shouldReuse({
				reason: "element:change",
				requiresFullRefresh: false,
				viewportRect: { x: 100, y: 100, width: 600, height: 400 },
				viewportScale: 1,
				scaleBand: 3,
				geometryRevision: 7,
			}),
		).toBe(false)
	})

	it("uses incremental render reconciliation after bootstrap and full reconciliation for topology changes", () => {
		const controller = {
			hasBootstrappedRenderWorkset: vi.fn(() => false),
			getLastTopologyRevision: vi.fn(() => null as number | null),
		}
		const manager = Object.create(CanvasVisibilityManager.prototype) as unknown as {
			renderVisibilityController: typeof controller
			getRenderVisibilitySyncPlan: (
				farDrainReady: boolean,
				topologyRevision: number,
			) => {
				shouldSync: boolean
				fullReconcile: boolean
				allowCullFar: boolean
			}
		}
		manager.renderVisibilityController = controller
		const getPlan = manager.getRenderVisibilitySyncPlan.bind(manager)

		expect(getPlan(false, 1)).toEqual({
			shouldSync: false,
			fullReconcile: false,
			allowCullFar: false,
		})
		expect(getPlan(true, 1)).toEqual({
			shouldSync: true,
			fullReconcile: true,
			allowCullFar: true,
		})

		controller.hasBootstrappedRenderWorkset.mockReturnValue(true)
		controller.getLastTopologyRevision.mockReturnValue(1)
		expect(getPlan(false, 1)).toEqual({
			shouldSync: true,
			fullReconcile: false,
			allowCullFar: false,
		})
		expect(getPlan(true, 1)).toEqual({
			shouldSync: true,
			fullReconcile: false,
			allowCullFar: true,
		})
		expect(getPlan(false, 2)).toEqual({
			shouldSync: true,
			fullReconcile: true,
			allowCullFar: true,
		})
	})

	it("skips covered pan and scale eligibility work without registered layouts", () => {
		const viewportSnapshot = createViewportSnapshot(["image-1"])
		const getSnapshot = vi.fn(() => viewportSnapshot)
		const replaceViewportScaleLayoutEligibility = vi.fn()
		const scheduleFarVisibilityDrain = vi.fn()
		let viewportScaleLayoutElementCount = 0
		const manager = Object.create(CanvasVisibilityManager.prototype) as unknown as {
			canvas: Record<string, unknown>
			destroyed: boolean
			registeredImages: Map<string, { elementId: string; path: string }>
			registeredVideos: Map<string, { elementId: string; path: string }>
			registeredAudios: Map<string, { elementId: string; path: string }>
			consumerVisibilityListeners: Map<string, Set<(state: string) => void>>
			lastQueryCoverRect: ViewportRect
			lastQueryLayoutRect: ViewportRect
			lastScaleBand: number
			lastQueryViewportScale: number
			lastQueryGeometryRevision: number
			statsSnapshot: { skippedViewportQueryCount: number }
			scheduleFarVisibilityDrain: typeof scheduleFarVisibilityDrain
			refreshVisibility: (reason: string, requiresFullRefresh: boolean) => void
		}
		manager.canvas = {
			geometryCacheManager: {
				containsRect: (outer: ViewportRect, inner: ViewportRect) =>
					inner.x >= outer.x &&
					inner.y >= outer.y &&
					inner.x + inner.width <= outer.x + outer.width &&
					inner.y + inner.height <= outer.y + outer.height,
				getRevision: () => 7,
			},
			runtimeScheduler: {
				getViewportScaleLayoutElementCount: () => viewportScaleLayoutElementCount,
				replaceViewportScaleLayoutEligibility,
			},
			stage: {
				getAbsoluteTransform: () => ({
					copy: () => ({
						invert: () => ({ point: (point: { x: number; y: number }) => point }),
					}),
				}),
				height: () => 100,
				scaleX: () => 1,
				width: () => 100,
			},
			viewportController: {
				getResolvedDefaultViewportPadding: () => ({ bottom: 0, left: 0, right: 0, top: 0 }),
			},
			viewportQueryCoordinator: { getSnapshot },
		}
		manager.destroyed = false
		manager.registeredImages = new Map([
			["image-1", { elementId: "image-1", path: "./images/a.png" }],
		])
		manager.registeredVideos = new Map<string, { elementId: string; path: string }>()
		manager.registeredAudios = new Map<string, { elementId: string; path: string }>()
		manager.consumerVisibilityListeners = new Map<string, Set<(state: string) => void>>()
		manager.lastQueryCoverRect = { x: -200, y: -200, width: 500, height: 500 }
		manager.lastQueryLayoutRect = { x: -50, y: -50, width: 200, height: 200 }
		manager.lastScaleBand = 4
		manager.lastQueryViewportScale = 1
		manager.lastQueryGeometryRevision = 7
		manager.statsSnapshot = { skippedViewportQueryCount: 0 }
		manager.scheduleFarVisibilityDrain = scheduleFarVisibilityDrain

		manager.refreshVisibility("viewport:pan", false)

		expect(getSnapshot).not.toHaveBeenCalled()
		expect(replaceViewportScaleLayoutEligibility).not.toHaveBeenCalled()
		expect(scheduleFarVisibilityDrain).toHaveBeenCalledTimes(1)
		expect(manager.statsSnapshot.skippedViewportQueryCount).toBe(1)

		manager.refreshVisibility("viewport:scale", false)

		expect(getSnapshot).not.toHaveBeenCalled()
		expect(replaceViewportScaleLayoutEligibility).not.toHaveBeenCalled()
		expect(scheduleFarVisibilityDrain).toHaveBeenCalledTimes(2)
		expect(manager.statsSnapshot.skippedViewportQueryCount).toBe(2)

		viewportScaleLayoutElementCount = 1
		getSnapshot.mockReturnValue(createViewportSnapshot(["image-2"]))
		manager.refreshVisibility("viewport:pan", false)

		expect(getSnapshot).toHaveBeenCalledTimes(1)
		expect(replaceViewportScaleLayoutEligibility).toHaveBeenCalledWith(new Set(["image-2"]))
	})

	it("keeps a coalesced non-viewport reason as a full refresh", () => {
		const rafCallbacks: FrameRequestCallback[] = []
		const requestAnimationFrameSpy = vi
			.spyOn(globalThis, "requestAnimationFrame")
			.mockImplementation((callback: FrameRequestCallback) => {
				rafCallbacks.push(callback)
				return rafCallbacks.length
			})
		try {
			const refreshVisibility = vi.fn()
			const manager = Object.create(CanvasVisibilityManager.prototype) as unknown as {
				destroyed: boolean
				rafId: number | null
				scheduledReason: string
				scheduledRequiresFullRefresh: boolean
				statsSnapshot: { drainRunCount: number }
				refreshVisibility: typeof refreshVisibility
				scheduleRefresh: (reason: string, requiresFullRefresh: boolean) => void
			}
			manager.destroyed = false
			manager.rafId = null
			manager.scheduledReason = "unknown"
			manager.scheduledRequiresFullRefresh = false
			manager.statsSnapshot = { drainRunCount: 0 }
			manager.refreshVisibility = refreshVisibility

			manager.scheduleRefresh("element:change", true)
			manager.scheduleRefresh("viewport:pan", false)
			rafCallbacks.splice(0).forEach((callback) => callback(performance.now()))

			expect(requestAnimationFrameSpy).toHaveBeenCalledTimes(1)
			expect(refreshVisibility).toHaveBeenCalledWith("element:change", true)
		} finally {
			requestAnimationFrameSpy.mockRestore()
		}
	})

	it("partitions one shared viewport snapshot without enumerating the document on restores", () => {
		const allElementIds = [
			"root-visible",
			"root-near",
			"consumer-visible",
			"consumer-near",
			"image-visible",
			"image-near",
			"video-visible",
			"video-near",
			"audio-visible",
			"audio-near",
		]
		const getAllElementIds = vi.fn(() => allElementIds)
		const manager = Object.create(CanvasVisibilityManager.prototype) as unknown as {
			canvas: {
				elementManager: {
					findParentIdForElement: (elementId: string) => string | undefined
					getAllElementIds: () => string[]
				}
			}
			registeredImages: Map<string, { elementId: string; path: string }>
			registeredVideos: Map<string, { elementId: string; path: string }>
			registeredAudios: Map<string, { elementId: string; path: string }>
			consumerVisibilityListeners: Map<string, Set<(state: string) => void>>
			queryViewportElementIds: (
				viewportSnapshot: ReturnType<typeof createViewportSnapshot>,
				includeRenderVisibility: boolean,
				includeAllRenderElements?: boolean,
			) => {
				renderElementIds: string[]
				renderActiveElementIds: Set<string>
				viewportScaleLayoutElementIds: Set<string>
				visibleConsumerIds: Set<string>
				nearConsumerIds: Set<string>
				visibleImageIds: Set<string>
				nearImageIds: Set<string>
				visibleVideoIds: Set<string>
				nearVideoIds: Set<string>
				visibleAudioIds: Set<string>
				nearAudioIds: Set<string>
			}
		}
		manager.canvas = {
			elementManager: {
				findParentIdForElement: () => undefined,
				getAllElementIds,
			},
		}
		manager.registeredImages = new Map([
			["image-visible", { elementId: "image-visible", path: "visible.png" }],
			["image-near", { elementId: "image-near", path: "near.png" }],
		])
		manager.registeredVideos = new Map([
			["video-visible", { elementId: "video-visible", path: "visible.mp4" }],
			["video-near", { elementId: "video-near", path: "near.mp4" }],
		])
		manager.registeredAudios = new Map([
			["audio-visible", { elementId: "audio-visible", path: "visible.mp3" }],
			["audio-near", { elementId: "audio-near", path: "near.mp3" }],
		])
		manager.consumerVisibilityListeners = new Map([
			["consumer-visible", new Set()],
			["consumer-near", new Set()],
		])
		const queryViewportElementIds = manager.queryViewportElementIds.bind(manager)
		const viewportSnapshot = createViewportSnapshot(
			["root-visible", "consumer-visible", "image-visible", "video-visible", "audio-visible"],
			["root-near", "consumer-near", "image-near", "video-near", "audio-near"],
			[
				"root-visible",
				"consumer-visible",
				"image-visible",
				"video-visible",
				"audio-visible",
				"root-near",
			],
		)

		const mediaOnlyResult = queryViewportElementIds(viewportSnapshot, false)
		expect(getAllElementIds).not.toHaveBeenCalled()
		expect(mediaOnlyResult.renderElementIds).toEqual([])
		expect(mediaOnlyResult.renderActiveElementIds.size).toBe(0)
		expect(mediaOnlyResult.viewportScaleLayoutElementIds).toEqual(
			new Set([
				"root-visible",
				"consumer-visible",
				"image-visible",
				"video-visible",
				"audio-visible",
			]),
		)

		const restoreResult = queryViewportElementIds(viewportSnapshot, true)
		expect(getAllElementIds).not.toHaveBeenCalled()
		expect(restoreResult.renderElementIds).toEqual([])
		expect(restoreResult.renderActiveElementIds).toEqual(
			new Set([
				"root-visible",
				"consumer-visible",
				"image-visible",
				"video-visible",
				"audio-visible",
				"root-near",
			]),
		)

		const result = queryViewportElementIds(viewportSnapshot, true, true)

		expect(getAllElementIds).toHaveBeenCalledTimes(1)
		expect(result.renderElementIds).toEqual(allElementIds)
		expect(result.renderActiveElementIds).toEqual(
			new Set([
				"root-visible",
				"consumer-visible",
				"image-visible",
				"video-visible",
				"audio-visible",
				"root-near",
			]),
		)
		expect(result.viewportScaleLayoutElementIds).toEqual(
			new Set([
				"root-visible",
				"consumer-visible",
				"image-visible",
				"video-visible",
				"audio-visible",
			]),
		)
		expect(result.visibleConsumerIds).toEqual(new Set(["consumer-visible"]))
		expect(result.nearConsumerIds).toEqual(new Set(["consumer-near"]))
		expect(result.visibleImageIds).toEqual(new Set(["image-visible"]))
		expect(result.nearImageIds).toEqual(new Set(["image-near"]))
		expect(result.visibleVideoIds).toEqual(new Set(["video-visible"]))
		expect(result.nearVideoIds).toEqual(new Set(["video-near"]))
		expect(result.visibleAudioIds).toEqual(new Set(["audio-visible"]))
		expect(result.nearAudioIds).toEqual(new Set(["audio-near"]))
	})

	it("keeps nested ancestors and active interaction elements admitted for rendering", () => {
		const parentById = new Map<string, string>([
			["image-visible", "group-1"],
			["selected-far", "group-1"],
			["group-1", "frame-1"],
			["video-near", "frame-1"],
			["hovered-far", "frame-1"],
		])
		const findParentIdForElement = vi.fn((elementId: string) => parentById.get(elementId))
		const manager = Object.create(CanvasVisibilityManager.prototype) as unknown as {
			canvas: {
				elementManager: {
					findParentIdForElement: typeof findParentIdForElement
					getAllElementIds: () => string[]
				}
				selectionManager: { getSelectedIds: () => string[] }
				hoverManager: { getHoveredElementId: () => string | null }
			}
			registeredImages: Map<string, unknown>
			registeredVideos: Map<string, unknown>
			registeredAudios: Map<string, unknown>
			consumerVisibilityListeners: Map<string, unknown>
			queryViewportElementIds: (
				viewportSnapshot: ReturnType<typeof createViewportSnapshot>,
				includeRenderVisibility: boolean,
				includeAllRenderElements?: boolean,
			) => {
				renderElementIds: string[]
				renderActiveElementIds: Set<string>
				viewportScaleLayoutElementIds: Set<string>
			}
		}
		manager.canvas = {
			elementManager: {
				findParentIdForElement,
				getAllElementIds: () => [
					"frame-1",
					"group-1",
					"image-visible",
					"video-near",
					"selected-far",
					"hovered-far",
				],
			},
			selectionManager: { getSelectedIds: () => ["selected-far"] },
			hoverManager: { getHoveredElementId: () => "hovered-far" },
		}
		manager.registeredImages = new Map()
		manager.registeredVideos = new Map()
		manager.registeredAudios = new Map()
		manager.consumerVisibilityListeners = new Map()

		const result = manager.queryViewportElementIds(
			createViewportSnapshot(
				["image-visible"],
				["video-near", "near-only"],
				["image-visible", "video-near"],
			),
			true,
			true,
		)

		expect(result.renderActiveElementIds).toEqual(
			new Set([
				"image-visible",
				"video-near",
				"selected-far",
				"hovered-far",
				"group-1",
				"frame-1",
			]),
		)
		expect(result.viewportScaleLayoutElementIds).toEqual(
			new Set(["image-visible", "selected-far", "hovered-far"]),
		)
		expect(findParentIdForElement).toHaveBeenCalledTimes(6)
	})
})

describe("CanvasVisibilityManager media candidate reuse", () => {
	function createCachedCandidates() {
		const image1 = createImageCandidate("image-1", "visible")
		const image2 = createImageCandidate("image-2", "near")
		const video1 = createCandidate("visible")
		video1.elementId = "video-1"
		const video2 = createCandidate("near")
		video2.elementId = "video-2"
		const audio1 = createAudioCandidate("visible")
		audio1.elementId = "audio-1"
		const audio2 = createAudioCandidate("near")
		audio2.elementId = "audio-2"
		return {
			geometryRevision: 7,
			scaleBand: 3,
			baselineViewportScale: 1,
			viewportScale: 1,
			viewportCenter: { x: 0, y: 0 },
			imagePresentationPhase: "moving" as const,
			imageCandidatesByElementId: new Map([
				["image-1", { visibilityState: "visible" as const, candidate: image1 }],
				["image-2", { visibilityState: "near" as const, candidate: image2 }],
			]),
			videoCandidatesByElementId: new Map([
				["video-1", { visibilityState: "visible" as const, candidate: video1 }],
				["video-2", { visibilityState: "near" as const, candidate: video2 }],
			]),
			audioCandidatesByElementId: new Map([
				["audio-1", { visibilityState: "visible" as const, candidate: audio1 }],
				["audio-2", { visibilityState: "near" as const, candidate: audio2 }],
			]),
			visibleCandidates: [image1],
			lowDetailVisibleCandidates: [],
			nearCandidates: [image2],
			visibleVideoCandidates: [],
			lowDetailVisibleVideoCandidates: [],
			nearVideoCandidates: [],
			visibleAudioCandidates: [],
			nearAudioCandidates: [],
		}
	}

	it("reuses candidates only while media membership and motion quality stay stable", () => {
		const manager = Object.create(CanvasVisibilityManager.prototype) as unknown as {
			imagePresentationPhase: "moving" | "idle"
			viewportMediaCandidateCache: ReturnType<typeof createCachedCandidates>
			getCompatibleViewportMediaCandidates: (options: {
				geometryRevision: number
				scaleBand: number
				viewportScale: number
			}) => unknown
		}
		const cached = createCachedCandidates()
		manager.imagePresentationPhase = "moving"
		manager.viewportMediaCandidateCache = cached
		const getCompatible = manager.getCompatibleViewportMediaCandidates.bind(manager)
		const options = {
			geometryRevision: 7,
			scaleBand: 3,
			viewportScale: 1.1,
		}

		expect(getCompatible(options)).toBe(cached)
		// Membership changes are compatible with the cache; only the changed entries are rebuilt.
		expect(getCompatible({ ...options, viewportScale: 1.14 })).toBe(cached)
		// The scale guard is measured from the last complete candidate build, not each incremental step.
		expect(getCompatible({ ...options, viewportScale: 1.16 })).toBeNull()

		manager.imagePresentationPhase = "idle"
		expect(getCompatible(options)).toBeNull()
	})

	it("rebuilds only membership and visibility-state deltas", () => {
		const manager = Object.create(CanvasVisibilityManager.prototype) as unknown as {
			updateViewportMediaCandidateEntries: (options: {
				cachedCandidatesByElementId: ReadonlyMap<
					string,
					{ visibilityState: "visible" | "near"; candidate: ImageCandidate | null }
				>
				visibleElementIds: ReadonlySet<string>
				nearElementIds: ReadonlySet<string>
				scaleRatio: number
				createCandidate: (
					elementId: string,
					visibilityState: "visible" | "near",
				) => ImageCandidate
			}) => Map<
				string,
				{ visibilityState: "visible" | "near"; candidate: ImageCandidate | null }
			>
		}
		const persistentVisible = createImageCandidate("image-persistent", "visible")
		const stateChanged = createImageCandidate("image-state-change", "visible")
		const createCandidate = vi.fn((elementId: string, visibilityState: "visible" | "near") => ({
			...createImageCandidate(elementId, visibilityState === "near" ? "near" : "visible"),
			visibilityState,
		}))
		const updateCandidates = manager.updateViewportMediaCandidateEntries.bind(manager)

		const next = updateCandidates({
			cachedCandidatesByElementId: new Map([
				[
					persistentVisible.elementId,
					{ visibilityState: "visible" as const, candidate: persistentVisible },
				],
				[
					stateChanged.elementId,
					{ visibilityState: "visible" as const, candidate: stateChanged },
				],
			]),
			visibleElementIds: new Set([persistentVisible.elementId, "image-new"]),
			nearElementIds: new Set([stateChanged.elementId]),
			scaleRatio: 1.1,
			createCandidate,
		})

		expect(createCandidate).toHaveBeenCalledTimes(2)
		expect(createCandidate).toHaveBeenNthCalledWith(1, "image-new", "visible")
		expect(createCandidate).toHaveBeenNthCalledWith(2, stateChanged.elementId, "near")
		expect(next.get(persistentVisible.elementId)?.candidate).toBe(persistentVisible)
		expect(persistentVisible.screenLongEdge).toBeCloseTo(110)
	})
})

describe("CanvasVisibilityManager immediate media loading", () => {
	function mediaElement(
		id: string,
		type:
			| typeof ElementTypeEnum.Image
			| typeof ElementTypeEnum.Video
			| typeof ElementTypeEnum.Audio,
		src: string,
	): LayerElement {
		const contentId = `${id}-content`
		return {
			id,
			type,
			contents: [{ contentId, src }],
			activeContentId: contentId,
			mainContentId: contentId,
		} as LayerElement
	}

	function containerElement(
		id: string,
		type: typeof ElementTypeEnum.Frame | typeof ElementTypeEnum.Group,
		children: LayerElement[],
	): LayerElement {
		const contentId = `${id}-content`
		return {
			id,
			type,
			contents: [{ contentId }],
			activeContentId: contentId,
			mainContentId: contentId,
			children,
		} as LayerElement
	}

	function createImmediateMediaManager(elements: Record<string, LayerElement>) {
		const requestImmediateImageLoad = vi.fn()
		const manager = Object.create(
			CanvasVisibilityManager.prototype,
		) as CanvasVisibilityManager & {
			canvas: {
				elementManager: {
					getElementData: (elementId: string) => LayerElement | undefined
					isElementVisibleInDataTree: (elementId: string) => boolean
				}
			}
			registeredImages: Map<string, { elementId: string; path: string }>
			requestImmediateImageLoad: typeof requestImmediateImageLoad
		}
		manager.canvas = {
			elementManager: {
				getElementData: (elementId: string) => elements[elementId],
				isElementVisibleInDataTree: (elementId: string) =>
					elements[elementId]?.visible !== false,
			},
		}
		manager.registeredImages = new Map([
			["image-1", { elementId: "image-1", path: "./images/a.png" }],
			["image-2", { elementId: "image-2", path: "./images/b.png" }],
			["direct-image", { elementId: "direct-image", path: "./images/direct.png" }],
		])
		manager.requestImmediateImageLoad = requestImmediateImageLoad
		return { manager, requestImmediateImageLoad }
	}

	it("expands frame children and requests critical image loads", () => {
		const { manager, requestImmediateImageLoad } = createImmediateMediaManager({
			"frame-1": containerElement("frame-1", ElementTypeEnum.Frame, [
				mediaElement("image-1", ElementTypeEnum.Image, "./images/a.png"),
				containerElement("group-1", ElementTypeEnum.Group, [
					mediaElement("image-2", ElementTypeEnum.Image, "./images/b.png"),
				]),
			]),
			"image-1": mediaElement("image-1", ElementTypeEnum.Image, "./images/a.png"),
			"image-2": mediaElement("image-2", ElementTypeEnum.Image, "./images/b.png"),
			"group-1": containerElement("group-1", ElementTypeEnum.Group, [
				mediaElement("image-2", ElementTypeEnum.Image, "./images/b.png"),
			]),
		})

		manager.requestImmediateMediaLoadForElements(["frame-1"], { reason: "test-focus" })

		expect(requestImmediateImageLoad).toHaveBeenCalledWith("image-1", {
			reason: "test-focus",
			priority: "critical",
		})
		expect(requestImmediateImageLoad).toHaveBeenCalledWith("image-2", {
			reason: "test-focus",
			priority: "critical",
		})
		expect(requestImmediateImageLoad).toHaveBeenCalledTimes(2)
	})

	it("can skip direct root images while still loading container descendants", () => {
		const { manager, requestImmediateImageLoad } = createImmediateMediaManager({
			"direct-image": mediaElement(
				"direct-image",
				ElementTypeEnum.Image,
				"./images/direct.png",
			),
			"frame-1": containerElement("frame-1", ElementTypeEnum.Frame, [
				mediaElement("image-1", ElementTypeEnum.Image, "./images/a.png"),
			]),
			"image-1": mediaElement("image-1", ElementTypeEnum.Image, "./images/a.png"),
		})

		manager.requestImmediateMediaLoadForElements(["direct-image", "frame-1"], {
			reason: "selection",
			includeDirectImages: false,
		})

		expect(requestImmediateImageLoad).toHaveBeenCalledTimes(1)
		expect(requestImmediateImageLoad).toHaveBeenCalledWith("image-1", {
			reason: "selection",
			priority: "critical",
		})
	})

	it("keeps a shared media request alive until far eviction", () => {
		const manager = Object.create(CanvasVisibilityManager.prototype) as {
			canvas: { magicConfigManager?: { config?: { methods?: unknown } } }
			destroyed: boolean
			getViewportResourceSignal: (
				mediaType: "image" | "video" | "audio",
				path: string,
				elementId: string,
			) => AbortSignal
			getViewportResourceAbortKey: (
				mediaType: "image" | "video" | "audio",
				path: string,
			) => string
			cancelFarViewportResourceSignals: (activeKeys: Set<string>) => void
			registeredImages: Map<string, { elementId: string; path: string }>
			registeredVideos: Map<string, { elementId: string; path: string }>
			registeredAudios: Map<string, { elementId: string; path: string }>
			lastRequestedLoadState: Map<string, unknown>
			lastRequestedVideoLoadState: Map<string, unknown>
			lastRequestedAudioLoadState: Map<string, unknown>
		}
		manager.canvas = {}
		manager.destroyed = false
		manager.registeredImages = new Map([
			["image-1", { elementId: "image-1", path: "./images/a.png" }],
			["image-2", { elementId: "image-2", path: "./images/a.png" }],
			["image-3", { elementId: "image-3", path: "./images/b.png" }],
		])
		manager.registeredVideos = new Map([
			["video-1", { elementId: "video-1", path: "./videos/a.mp4" }],
		])
		manager.registeredAudios = new Map()
		manager.lastRequestedLoadState = new Map([
			["image-1", {}],
			["image-2", {}],
			["image-3", {}],
		])
		manager.lastRequestedVideoLoadState = new Map([["video-1", {}]])
		manager.lastRequestedAudioLoadState = new Map()

		const initialSignal = manager.getViewportResourceSignal(
			"image",
			"./images/a.png",
			"image-1",
		)
		const nextSignal = manager.getViewportResourceSignal("image", "./images/a.png", "image-2")
		manager.getViewportResourceSignal("image", "./images/b.png", "image-3")
		manager.getViewportResourceSignal("video", "./videos/a.mp4", "video-1")
		const resourceKey = manager.getViewportResourceAbortKey("image", "./images/a.png")
		const retainedImageKey = manager.getViewportResourceAbortKey("image", "./images/b.png")
		const retainedVideoKey = manager.getViewportResourceAbortKey("video", "./videos/a.mp4")
		const getResourceKeySpy = vi.spyOn(manager, "getViewportResourceAbortKey")
		getResourceKeySpy.mockClear()

		expect(nextSignal).toBe(initialSignal)
		expect(initialSignal.aborted).toBe(false)
		manager.cancelFarViewportResourceSignals(
			new Set([resourceKey, retainedImageKey, retainedVideoKey]),
		)
		expect(initialSignal.aborted).toBe(false)
		manager.cancelFarViewportResourceSignals(new Set([retainedImageKey, retainedVideoKey]))
		expect(initialSignal.aborted).toBe(true)
		expect(manager.lastRequestedLoadState.has("image-1")).toBe(false)
		expect(manager.lastRequestedLoadState.has("image-2")).toBe(false)
		expect(manager.lastRequestedLoadState.has("image-3")).toBe(true)
		expect(manager.lastRequestedVideoLoadState.has("video-1")).toBe(true)
		expect(getResourceKeySpy).not.toHaveBeenCalled()
	})
})

describe("CanvasVisibilityManager image load priorities", () => {
	type ElementGeometryPatch = Partial<Omit<BaseElementProps, "id" | "type">>

	function createImageCandidateManager(options?: {
		audio?: ElementGeometryPatch
		frame?: ElementGeometryPatch
		image?: ElementGeometryPatch
		registered?: boolean
		registeredAudio?: boolean
		registeredVideo?: boolean
		video?: ElementGeometryPatch
	}) {
		const manager = Object.create(
			CanvasVisibilityManager.prototype,
		) as CanvasVisibilityManager & {
			canvas: {
				elementManager: {
					getAllElements: () => LayerElement[]
					getElementData: (elementId: string) => LayerElement | undefined
					findParentIdForElement: (elementId: string) => string | undefined
					isElementVisibleInDataTree: (elementId: string) => boolean
				}
				geometryCacheManager: {
					getElementBounds: (
						elementId: string,
					) => { x: number; y: number; width: number; height: number } | null
					queryElementIdsByExpandedRect: (
						rect: { x: number; y: number; width: number; height: number },
						padding: number,
						options?: { elementIds?: Iterable<string> },
					) => string[]
				}
			}
			registeredImages: Map<string, { elementId: string; path: string }>
			registeredVideos: Map<string, { elementId: string; path: string }>
			registeredAudios: Map<string, { elementId: string; path: string }>
			lastRequestedLoadState: Map<
				string,
				{
					priority: ImageResourceLoadPriority
					variant: ImageResourceVariant
					requestedAt: number
				}
			>
			lastContainerDisplayVariant: Map<string, ImageResourceVariant>
		}
		const imageContentId = "image-1-content"
		const imageElement = {
			id: "image-1",
			type: ElementTypeEnum.Image,
			x: 0,
			y: 0,
			width: 200,
			height: 160,
			...options?.image,
			contents: [{ contentId: imageContentId, src: "./images/a.png" }],
			activeContentId: imageContentId,
			mainContentId: imageContentId,
		} as LayerElement
		const videoContentId = "video-1-content"
		const videoElement = {
			id: "video-1",
			type: ElementTypeEnum.Video,
			x: 20,
			y: 20,
			width: 300,
			height: 180,
			...options?.video,
			contents: [{ contentId: videoContentId, src: "./videos/a.mp4" }],
			activeContentId: videoContentId,
			mainContentId: videoContentId,
		} as LayerElement
		const audioContentId = "audio-1-content"
		const audioElement = {
			id: "audio-1",
			type: ElementTypeEnum.Audio,
			x: 40,
			y: 40,
			width: 240,
			height: 120,
			...options?.audio,
			contents: [{ contentId: audioContentId, src: "./audios/a.mp3" }],
			activeContentId: audioContentId,
			mainContentId: audioContentId,
		} as LayerElement
		const frameChildren: LayerElement[] = [
			imageElement,
			...(options?.video ? [videoElement] : []),
			...(options?.audio ? [audioElement] : []),
		]
		const frameElement: FrameElement = {
			id: "frame-1",
			type: ElementTypeEnum.Frame,
			x: 0,
			y: 0,
			width: 400,
			height: 300,
			children: frameChildren,
			...options?.frame,
			contents: [{ contentId: "frame-1-content" }],
			activeContentId: "frame-1-content",
			mainContentId: "frame-1-content",
		}
		const elements: Record<string, LayerElement> = {
			"frame-1": frameElement,
			"image-1": imageElement,
			"video-1": videoElement,
			"audio-1": audioElement,
		}
		manager.canvas = {
			elementManager: {
				getAllElements: () => [elements["frame-1"]],
				getElementData: (elementId: string) => elements[elementId],
				findParentIdForElement: (elementId: string) =>
					elementId === "image-1" || elementId === "video-1" || elementId === "audio-1"
						? "frame-1"
						: undefined,
				isElementVisibleInDataTree: () => true,
			},
			geometryCacheManager: {
				getElementBounds: (elementId: string) =>
					elementId === "frame-1"
						? { x: 0, y: 0, width: 400, height: 300 }
						: elementId === "video-1"
							? { x: 20, y: 20, width: 300, height: 180 }
							: elementId === "audio-1"
								? { x: 40, y: 40, width: 240, height: 120 }
								: { x: 0, y: 0, width: 200, height: 160 },
				queryElementIdsByExpandedRect: (_rect, _padding, options) =>
					Array.from(options?.elementIds ?? []).filter(
						(elementId) => elementId === "frame-1",
					),
			},
		}
		manager.registeredImages =
			options?.registered === false
				? new Map()
				: new Map([["image-1", { elementId: "image-1", path: "./images/a.png" }]])
		manager.registeredVideos =
			options?.registeredVideo === false
				? new Map()
				: new Map([["video-1", { elementId: "video-1", path: "./videos/a.mp4" }]])
		manager.registeredAudios =
			options?.audio && options.registeredAudio !== false
				? new Map([["audio-1", { elementId: "audio-1", path: "./audios/a.mp3" }]])
				: new Map()
		manager.lastRequestedLoadState = new Map()
		manager.lastContainerDisplayVariant = new Map()
		return manager
	}

	function getCollectVisibleContainerImageCandidates(manager: CanvasVisibilityManager) {
		const collectVisibleContainerMediaCandidates = (
			manager as unknown as {
				collectVisibleContainerMediaCandidates: (options: {
					reason: string
					viewportRect: { x: number; y: number; width: number; height: number }
					viewportScale: number
					viewportCenter: { x: number; y: number }
				}) => {
					imageCandidates: ImageCandidate[]
					videoCandidates: VideoCandidate[]
					audioCandidates: AudioCandidate[]
				}
			}
		).collectVisibleContainerMediaCandidates

		return (options: {
			reason: string
			viewportRect: { x: number; y: number; width: number; height: number }
			viewportScale: number
			viewportCenter: { x: number; y: number }
		}) => collectVisibleContainerMediaCandidates.call(manager, options).imageCandidates
	}

	function getCollectVisibleContainerMediaCandidates(manager: CanvasVisibilityManager) {
		return (
			manager as unknown as {
				collectVisibleContainerMediaCandidates: (options: {
					reason: string
					viewportRect: { x: number; y: number; width: number; height: number }
					viewportScale: number
					viewportCenter: { x: number; y: number }
				}) => {
					imageCandidates: ImageCandidate[]
					videoCandidates: VideoCandidate[]
					audioCandidates: AudioCandidate[]
				}
			}
		).collectVisibleContainerMediaCandidates
	}

	it("allows restored viewport visible images to be promoted to critical", () => {
		const manager = createImageCandidateManager()
		const createPrivateCandidate = (
			manager as unknown as {
				createCandidate: (
					elementId: string,
					visibilityState: "visible" | "near",
					viewportScale: number,
					viewportCenter: { x: number; y: number },
					priorityOverride?: ImageResourceLoadPriority,
					viewportRect?: { x: number; y: number; width: number; height: number },
				) => ImageCandidate | null
			}
		).createCandidate

		const candidate = createPrivateCandidate.call(
			manager,
			"image-1",
			"visible",
			1,
			{ x: 0, y: 0 },
			"critical",
		)
		const nearCandidate = createPrivateCandidate.call(manager, "image-1", "near", 1, {
			x: 0,
			y: 0,
		})

		expect(candidate?.priority).toBe("critical")
		expect(nearCandidate?.priority).toBe("near")
	})

	it("uses the visible frame display variant as a lower bound for ordinary child image candidates", () => {
		const manager = createImageCandidateManager({
			image: {
				x: 395,
				y: 295,
				width: 100,
				height: 100,
			},
		})
		const createPrivateCandidate = (
			manager as unknown as {
				createCandidate: (
					elementId: string,
					visibilityState: "visible" | "near",
					viewportScale: number,
					viewportCenter: { x: number; y: number },
					priorityOverride?: ImageResourceLoadPriority,
					viewportRect?: { x: number; y: number; width: number; height: number },
				) => ImageCandidate | null
			}
		).createCandidate

		const candidate = createPrivateCandidate.call(
			manager,
			"image-1",
			"visible",
			1,
			{ x: 250, y: 250 },
			undefined,
			{ x: 0, y: 0, width: 500, height: 500 },
		)

		expect(candidate).toEqual(
			expect.objectContaining({
				elementId: "image-1",
				variant: "preview",
				screenLongEdge: 200,
			}),
		)
	})

	it("does not let the visible frame display variant suppress full ordinary child image candidates", () => {
		const manager = createImageCandidateManager()
		const createPrivateCandidate = (
			manager as unknown as {
				createCandidate: (
					elementId: string,
					visibilityState: "visible" | "near",
					viewportScale: number,
					viewportCenter: { x: number; y: number },
					priorityOverride?: ImageResourceLoadPriority,
					viewportRect?: { x: number; y: number; width: number; height: number },
				) => ImageCandidate | null
			}
		).createCandidate

		const candidate = createPrivateCandidate.call(
			manager,
			"image-1",
			"visible",
			8,
			{ x: 250, y: 250 },
			undefined,
			{ x: 0, y: 0, width: 500, height: 500 },
		)

		expect(candidate).toEqual(
			expect.objectContaining({
				elementId: "image-1",
				variant: "full",
				screenLongEdge: 1600,
			}),
		)
	})

	it("promotes image descendants when their visible frame is in the restored viewport", () => {
		const manager = createImageCandidateManager()
		const collectVisibleContainerImageCandidates =
			getCollectVisibleContainerImageCandidates(manager)

		const candidates = collectVisibleContainerImageCandidates.call(manager, {
			reason: "viewport:pan",
			viewportRect: { x: 0, y: 0, width: 500, height: 500 },
			viewportScale: 1,
			viewportCenter: { x: 250, y: 250 },
		})

		expect(candidates).toEqual([
			expect.objectContaining({
				elementId: "image-1",
				path: "./images/a.png",
				priority: "critical",
				visibilityState: "visible",
			}),
		])
	})

	it("propagates container visibility without walking each media child ancestor chain", () => {
		const manager = createImageCandidateManager({
			image: { visible: false },
			video: {},
		})
		const isElementVisibleInDataTree = vi.fn(() => true)
		manager.canvas.elementManager.isElementVisibleInDataTree = isElementVisibleInDataTree
		const collectVisibleContainerMediaCandidates =
			getCollectVisibleContainerMediaCandidates(manager)

		const candidates = collectVisibleContainerMediaCandidates.call(manager, {
			reason: "viewport:pan",
			viewportRect: { x: 0, y: 0, width: 500, height: 500 },
			viewportScale: 1,
			viewportCenter: { x: 250, y: 250 },
		})

		expect(candidates.imageCandidates).toEqual([])
		expect(candidates.videoCandidates).toEqual([
			expect.objectContaining({ elementId: "video-1", visibilityState: "visible" }),
		])
		expect(isElementVisibleInDataTree).toHaveBeenCalledTimes(1)
		expect(isElementVisibleInDataTree).toHaveBeenCalledWith("frame-1")
	})

	it("does not promote media below a hidden nested Frame or Group", () => {
		const imageContentId = "nested-image-content"
		const image = {
			id: "nested-image",
			type: ElementTypeEnum.Image,
			x: 0,
			y: 0,
			width: 120,
			height: 80,
			contents: [{ contentId: imageContentId, src: "./images/nested.png" }],
			activeContentId: imageContentId,
			mainContentId: imageContentId,
		} as LayerElement
		const group = {
			id: "nested-group",
			type: ElementTypeEnum.Group,
			x: 10,
			y: 10,
			width: 200,
			height: 160,
			visible: false,
			children: [image],
			contents: [{ contentId: "nested-group-content" }],
			activeContentId: "nested-group-content",
			mainContentId: "nested-group-content",
		} as LayerElement
		const frame = {
			id: "nested-frame",
			type: ElementTypeEnum.Frame,
			x: 0,
			y: 0,
			width: 400,
			height: 300,
			children: [group],
			contents: [{ contentId: "nested-frame-content" }],
			activeContentId: "nested-frame-content",
			mainContentId: "nested-frame-content",
		} as FrameElement
		const elements: Record<string, LayerElement> = {
			[frame.id]: frame,
			[group.id]: group,
			[image.id]: image,
		}
		const isElementVisibleInDataTree = vi.fn((elementId: string) => elementId === frame.id)
		const manager = Object.create(
			CanvasVisibilityManager.prototype,
		) as CanvasVisibilityManager & {
			canvas: {
				elementManager: {
					getAllElements: () => LayerElement[]
					getElementData: (elementId: string) => LayerElement | undefined
					isElementVisibleInDataTree: typeof isElementVisibleInDataTree
				}
				geometryCacheManager: {
					getElementBounds: (elementId: string) => {
						x: number
						y: number
						width: number
						height: number
					} | null
					queryElementIdsByExpandedRect: (
						rect: { x: number; y: number; width: number; height: number },
						padding: number,
						options?: { elementIds?: Iterable<string> },
					) => string[]
				}
			}
			registeredImages: Map<string, { elementId: string; path: string }>
			registeredVideos: Map<string, { elementId: string; path: string }>
			registeredAudios: Map<string, { elementId: string; path: string }>
			lastContainerDisplayVariant: Map<string, ImageResourceVariant>
		}
		manager.canvas = {
			elementManager: {
				getAllElements: () => [frame],
				getElementData: (elementId: string) => elements[elementId],
				isElementVisibleInDataTree,
			},
			geometryCacheManager: {
				getElementBounds: (elementId: string) =>
					elementId === frame.id
						? { x: 0, y: 0, width: 400, height: 300 }
						: elementId === group.id
							? { x: 10, y: 10, width: 200, height: 160 }
							: { x: 10, y: 10, width: 120, height: 80 },
				queryElementIdsByExpandedRect: (_rect, _padding, options) =>
					Array.from(options?.elementIds ?? []).filter(
						(elementId) => elementId === frame.id,
					),
			},
		}
		manager.registeredImages = new Map([
			[image.id, { elementId: image.id, path: "./images/nested.png" }],
		])
		manager.registeredVideos = new Map()
		manager.registeredAudios = new Map()
		manager.lastContainerDisplayVariant = new Map()

		const candidates = getCollectVisibleContainerMediaCandidates(manager).call(manager, {
			reason: "viewport:pan",
			viewportRect: { x: 0, y: 0, width: 500, height: 500 },
			viewportScale: 1,
			viewportCenter: { x: 250, y: 250 },
		})

		expect(candidates.imageCandidates).toEqual([])
		expect(isElementVisibleInDataTree).toHaveBeenCalledTimes(1)
		expect(isElementVisibleInDataTree).toHaveBeenCalledWith(frame.id)
	})

	it("still promotes frame descendants that were only found as near images", () => {
		const manager = createImageCandidateManager()
		const collectVisibleContainerImageCandidates =
			getCollectVisibleContainerImageCandidates(manager)

		const candidates = collectVisibleContainerImageCandidates.call(manager, {
			reason: "viewport:pan",
			viewportRect: { x: 0, y: 0, width: 500, height: 500 },
			viewportScale: 1,
			viewportCenter: { x: 250, y: 250 },
		})

		expect(candidates[0]?.elementId).toBe("image-1")
		expect(candidates[0]?.priority).toBe("critical")
	})

	it("keeps frame-adjusted candidates even when ordinary visibility also finds the image", () => {
		const manager = createImageCandidateManager()
		const collectVisibleContainerImageCandidates =
			getCollectVisibleContainerImageCandidates(manager)

		const candidates = collectVisibleContainerImageCandidates.call(manager, {
			reason: "viewport:pan",
			viewportRect: { x: 0, y: 0, width: 500, height: 500 },
			viewportScale: 1,
			viewportCenter: { x: 250, y: 250 },
		})

		expect(candidates).toEqual([
			expect.objectContaining({
				elementId: "image-1",
				priority: "critical",
			}),
		])
	})

	it("prefetches visible frame descendants before their image element registers", () => {
		const manager = createImageCandidateManager({ registered: false })
		const collectVisibleContainerImageCandidates =
			getCollectVisibleContainerImageCandidates(manager)

		const candidates = collectVisibleContainerImageCandidates.call(manager, {
			reason: "viewport:pan",
			viewportRect: { x: 0, y: 0, width: 500, height: 500 },
			viewportScale: 1,
			viewportCenter: { x: 250, y: 250 },
		})

		expect(candidates).toEqual([
			expect.objectContaining({
				elementId: "image-1",
				path: "./images/a.png",
				priority: "critical",
				visibilityState: "visible",
			}),
		])
	})

	it("uses the visible frame display variant as a lower bound for descendants", () => {
		const manager = createImageCandidateManager({
			image: {
				x: 395,
				y: 295,
				width: 100,
				height: 100,
			},
		})
		const collectVisibleContainerImageCandidates =
			getCollectVisibleContainerImageCandidates(manager)

		const candidates = collectVisibleContainerImageCandidates.call(manager, {
			reason: "viewport:pan",
			viewportRect: { x: 0, y: 0, width: 500, height: 500 },
			viewportScale: 1,
			viewportCenter: { x: 250, y: 250 },
		})

		expect(candidates).toEqual([
			expect.objectContaining({
				elementId: "image-1",
				variant: "preview",
				screenArea: 25,
				screenLongEdge: 5,
				frameVisibleBounds: { x: 395, y: 295, width: 5, height: 5 },
			}),
		])
	})

	it("does not let the visible frame display variant suppress full descendant image candidates", () => {
		const manager = createImageCandidateManager()
		const collectVisibleContainerImageCandidates =
			getCollectVisibleContainerImageCandidates(manager)

		const candidates = collectVisibleContainerImageCandidates.call(manager, {
			reason: "viewport:pan",
			viewportRect: { x: 0, y: 0, width: 500, height: 500 },
			viewportScale: 8,
			viewportCenter: { x: 250, y: 250 },
		})

		expect(candidates).toEqual([
			expect.objectContaining({
				elementId: "image-1",
				variant: "full",
				screenLongEdge: 1600,
				frameVisibleBounds: { x: 0, y: 0, width: 200, height: 160 },
			}),
		])
	})

	it("promotes visible frame video descendants to poster candidates", () => {
		const manager = createImageCandidateManager({
			video: {},
		})
		const collectVisibleContainerMediaCandidates =
			getCollectVisibleContainerMediaCandidates(manager)

		const candidates = collectVisibleContainerMediaCandidates.call(manager, {
			reason: "viewport:pan",
			viewportRect: { x: 0, y: 0, width: 500, height: 500 },
			viewportScale: 1,
			viewportCenter: { x: 250, y: 250 },
		})

		expect(candidates.videoCandidates).toEqual([
			expect.objectContaining({
				elementId: "video-1",
				path: "./videos/a.mp4",
				priority: "critical",
				tier: "poster",
				visibilityState: "visible",
			}),
		])
	})

	it("promotes visible frame audio descendants to critical preload candidates", () => {
		const manager = createImageCandidateManager({ audio: {} })
		const collectVisibleContainerMediaCandidates =
			getCollectVisibleContainerMediaCandidates(manager)

		const candidates = collectVisibleContainerMediaCandidates.call(manager, {
			reason: "viewport:pan",
			viewportRect: { x: 0, y: 0, width: 500, height: 500 },
			viewportScale: 1,
			viewportCenter: { x: 250, y: 250 },
		})

		expect(candidates.audioCandidates).toEqual([
			expect.objectContaining({
				elementId: "audio-1",
				path: "./audios/a.mp3",
				priority: "critical",
				tier: "preload",
				visibilityState: "visible",
			}),
		])
	})

	it("cools down rapid non-critical image variant switches", () => {
		const manager = createImageCandidateManager()
		const shouldRequestImageCandidate = (
			manager as unknown as {
				shouldRequestImageCandidate: (candidate: ImageCandidate) => boolean
			}
		).shouldRequestImageCandidate
		const requestedAt = typeof performance === "undefined" ? Date.now() : performance.now()

		manager.lastRequestedLoadState.set("image-1", {
			priority: "visible",
			variant: "low",
			requestedAt,
		})

		expect(
			shouldRequestImageCandidate.call(manager, {
				elementId: "image-1",
				path: "./images/a.png",
				priority: "visible",
				variant: "preview",
				visibilityState: "visible",
				screenArea: 800 * 800,
				screenLongEdge: 800,
				distanceToViewportCenter: 0,
			}),
		).toBe(false)
		expect(
			shouldRequestImageCandidate.call(manager, {
				elementId: "image-1",
				path: "./images/a.png",
				priority: "critical",
				variant: "preview",
				visibilityState: "visible",
				screenArea: 800 * 800,
				screenLongEdge: 800,
				distanceToViewportCenter: 0,
			}),
		).toBe(true)
	})
})
