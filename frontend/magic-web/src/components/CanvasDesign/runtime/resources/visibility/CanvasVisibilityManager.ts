import type { Canvas } from "../../core/Canvas"
import { ElementTypeEnum, type LayerElement } from "../../document/types"
import { getActiveImageContent } from "../../document/elementContent"
import type { Rect } from "../../shared/ids"
import type { ImageResourceLoadPriority, ImageResourceVariant } from "../image/ImageResourceManager"
import {
	type ImagePresentationPhase,
	type ImagePresentationTarget,
} from "../image/CanvasImagePresentationScheduler"
import {
	decideImageDisplayViewingLevel,
	type MediaDisplayResourceVariant,
} from "./CanvasMediaViewingPolicy"
import {
	areCanvasHostResourceReferencesSame,
	getCanvasHostResourceReferenceIdentity,
	type CanvasResourceReferenceResolverChangeOptions,
} from "../../shared/path/canvasResourcePath"
import type { ResourceLoadFailureReason } from "../media-common/resourceLoadFailure"
import type { CanvasViewportSpatialSnapshot } from "../../shared/geometry/CanvasViewportQueryCoordinator"
import { getViewportCanvasRect } from "../../shared/placement/elementUtils"
import {
	CanvasRenderVisibilityController,
	type CanvasRenderVisibilityStrategy,
} from "./CanvasRenderVisibilityController"

type VisibilityState = "visible" | "near" | "far"
export type CanvasConsumerVisibility = VisibilityState
export type DecodedImageRetentionVisibilityState = Extract<VisibilityState, "visible" | "near">

export interface DecodedImageRetentionHint {
	elementId: string
	path: string
	visibilityState: DecodedImageRetentionVisibilityState
	requestedVariant?: ImageResourceVariant
	displayedVariant?: ImageResourceVariant
	screenLongEdge: number
	lastSeenAt: number
}

interface RegisteredImageElement {
	elementId: string
	path: string
}

interface RegisteredVideoElement {
	elementId: string
	path: string
}

interface RegisteredAudioElement {
	elementId: string
	path: string
}

interface LoadCandidateBase {
	elementId: string
	path: string
	priority: ImageResourceLoadPriority
	visibilityState: VisibilityState
	screenArea: number
	screenLongEdge: number
	distanceToViewportCenter: number
}

interface ImageLoadCandidate extends LoadCandidateBase {
	variant: ImageResourceVariant
	frameAdjustedBounds?: Rect
	frameVisibleBounds?: Rect
}

type VideoLoadTier = "url" | "poster"

interface VideoLoadCandidate extends LoadCandidateBase {
	tier: VideoLoadTier
	frameAdjustedBounds?: Rect
	frameVisibleBounds?: Rect
}

type AudioLoadTier = "url" | "preload"

interface AudioLoadCandidate extends LoadCandidateBase {
	tier: AudioLoadTier
	frameAdjustedBounds?: Rect
	frameVisibleBounds?: Rect
}

export interface CanvasVisibilitySnapshot {
	registeredImageCount: number
	registeredVideoCount: number
	registeredAudioCount: number
	registerDedupedCount: number
	videoRegisterDedupedCount: number
	audioRegisterDedupedCount: number
	lowFallbackPreviewCount: number
	visibleImageCount: number
	nearImageCount: number
	farImageCount: number
	visibleVideoCount: number
	nearVideoCount: number
	farVideoCount: number
	visibleAudioCount: number
	nearAudioCount: number
	farAudioCount: number
	lastQueryDurationMs: number
	lastRequestedVisibleCount: number
	lastRequestedNearCount: number
	lastRequestedVisibleVideoCount: number
	lastRequestedNearVideoCount: number
	lastRequestedVisibleAudioCount: number
	lastRequestedNearAudioCount: number
	lowDetailVisibleVideoCount: number
	pendingLowDetailVisibleVideoLoadCandidateCount: number
	pendingImageLoadCandidateCount: number
	pendingVideoLoadCandidateCount: number
	pendingAudioLoadCandidateCount: number
	drainScheduledCount: number
	drainRunCount: number
	lastViewportScale: number
	lastViewportWidth: number
	lastViewportHeight: number
	skippedViewportQueryCount: number
	queryCount: number
}

const MIN_VISIBLE_SCREEN_LONG_EDGE_FOR_LOAD = 64
const MIN_NEAR_SCREEN_LONG_EDGE_FOR_LOAD = 96
const LOW_DETAIL_VISIBLE_FALLBACK_LIMIT = 48
const MAX_VISIBLE_LOAD_REQUESTS_PER_QUERY = 96
const MAX_NEAR_LOAD_REQUESTS_PER_QUERY = 24
const MAX_FULL_LOAD_REQUESTS_PER_REFRESH = 4
const MAX_FULL_LOADING_REQUESTS = 4
const BACKGROUND_IMAGE_LOAD_REQUESTS_PER_REFRESH = 12
const MIN_VISIBLE_VIDEO_SCREEN_LONG_EDGE_FOR_LOAD = 96
const MIN_NEAR_VIDEO_SCREEN_LONG_EDGE_FOR_LOAD = 160
const LOW_DETAIL_VISIBLE_VIDEO_FALLBACK_LIMIT = 4
const MAX_VISIBLE_VIDEO_LOAD_REQUESTS_PER_QUERY = 12
const MAX_NEAR_VIDEO_LOAD_REQUESTS_PER_QUERY = 6
const MIN_VISIBLE_AUDIO_SCREEN_LONG_EDGE_FOR_LOAD = MIN_VISIBLE_VIDEO_SCREEN_LONG_EDGE_FOR_LOAD
const MIN_NEAR_AUDIO_SCREEN_LONG_EDGE_FOR_LOAD = MIN_NEAR_VIDEO_SCREEN_LONG_EDGE_FOR_LOAD
const MAX_VISIBLE_AUDIO_LOAD_REQUESTS_PER_QUERY = MAX_VISIBLE_VIDEO_LOAD_REQUESTS_PER_QUERY
const MAX_NEAR_AUDIO_LOAD_REQUESTS_PER_QUERY = MAX_NEAR_VIDEO_LOAD_REQUESTS_PER_QUERY
const VISIBILITY_DRAIN_DELAY_MS = 80
const IMAGE_ONLY_DRAIN_DELAY_MS = 160
const INITIAL_VISIBLE_CRITICAL_WINDOW_MS = 5000
const MAX_INITIAL_VISIBLE_CONTAINER_MEDIA_REQUESTS = 48
const VIEWPORT_MOVEMENT_SCALE_REFRESH_RATIO = 1.15
const IMAGE_VARIANT_SWITCH_COOLDOWN_MS = 450
const DECODED_IMAGE_RETENTION_GRACE_MS = 5000
const FAR_VISIBILITY_DRAIN_GRACE_MS = 3000
const CONTENT_LAYER_HIT_GRAPH_RESTORE_DELAY_MS = 160
const VIEWPORT_IDLE_MEDIA_DELAY_MS = 160
const BOOTSTRAP_NEAR_HYDRATION_DELAY_MS = 400
const VIEWPORT_IDLE_MEDIA_REFRESH_REASON = "viewport:idle-media"
const BOOTSTRAP_NEAR_HYDRATION_REASON = "bootstrap:near-hydrate"
const IMAGE_LOW_FALLBACK_REFRESH_REASON = "image:low-fallback"
const FAR_VISIBILITY_DRAIN_REFRESH_REASON = "visibility:far-drain"
// Current default: Konva-only far culling. Far elements stop participating in drawing / hit
// testing after the 3s drain, while image resources stay cached for fast return.
const FAR_KONVA_RENDER_VISIBILITY_STRATEGY: CanvasRenderVisibilityStrategy = "hidden"

interface RequestedImageLoadState {
	priority: ImageResourceLoadPriority
	variant: ImageResourceVariant
	requestedAt: number
}

interface RequestedVideoLoadState {
	priority: ImageResourceLoadPriority
	tier: VideoLoadTier
	requestedAt: number
}

interface RequestedAudioLoadState {
	priority: ImageResourceLoadPriority
	tier: AudioLoadTier
	requestedAt: number
}

type ViewportResourceMediaType = "image" | "video" | "audio"

interface ContainerRootCache {
	rootContainerIds: string[]
}

interface ViewportElementQueryResult {
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

type ViewportMediaVisibilityState = "visible" | "near"

interface CachedViewportMediaCandidate<TCandidate extends LoadCandidateBase> {
	visibilityState: ViewportMediaVisibilityState
	candidate: TCandidate | null
}

interface ViewportMediaCandidateLists {
	visibleCandidates: ImageLoadCandidate[]
	lowDetailVisibleCandidates: ImageLoadCandidate[]
	nearCandidates: ImageLoadCandidate[]
	visibleVideoCandidates: VideoLoadCandidate[]
	lowDetailVisibleVideoCandidates: VideoLoadCandidate[]
	nearVideoCandidates: VideoLoadCandidate[]
	visibleAudioCandidates: AudioLoadCandidate[]
	nearAudioCandidates: AudioLoadCandidate[]
}

interface CachedViewportMediaCandidates extends ViewportMediaCandidateLists {
	geometryRevision: number
	scaleBand: number
	baselineViewportScale: number
	viewportScale: number
	viewportCenter: { x: number; y: number }
	imagePresentationPhase: ImagePresentationPhase
	imageCandidatesByElementId: ReadonlyMap<
		string,
		CachedViewportMediaCandidate<ImageLoadCandidate>
	>
	videoCandidatesByElementId: ReadonlyMap<
		string,
		CachedViewportMediaCandidate<VideoLoadCandidate>
	>
	audioCandidatesByElementId: ReadonlyMap<
		string,
		CachedViewportMediaCandidate<AudioLoadCandidate>
	>
}

function now(): number {
	return typeof performance === "undefined" ? Date.now() : performance.now()
}

function getScaleBand(scale: number): number {
	if (scale < 0.05) return 0
	if (scale < 0.15) return 1
	if (scale < 0.5) return 2
	if (scale < 1) return 3
	return 4
}

function getRectCenter(rect: Rect): { x: number; y: number } {
	return {
		x: rect.x + rect.width / 2,
		y: rect.y + rect.height / 2,
	}
}

function getDistance(a: { x: number; y: number }, b: { x: number; y: number }): number {
	const dx = a.x - b.x
	const dy = a.y - b.y
	return Math.sqrt(dx * dx + dy * dy)
}

function getArea(rect: Rect): number {
	return Math.max(0, rect.width) * Math.max(0, rect.height)
}

function getImageVariantRank(variant: ImageResourceVariant): number {
	switch (variant) {
		case "full":
			return 2
		case "preview":
			return 1
		case "low":
		default:
			return 0
	}
}

function maxImageResourceVariant(
	variant: ImageResourceVariant,
	minVariant?: MediaDisplayResourceVariant,
): ImageResourceVariant {
	if (!minVariant) return variant
	return getImageVariantRank(minVariant) > getImageVariantRank(variant) ? minVariant : variant
}

function toMediaDisplayResourceVariant(variant: ImageResourceVariant): MediaDisplayResourceVariant {
	return variant === "low" ? "low" : "preview"
}

function getIntersectionRect(a: Rect, b: Rect): Rect | null {
	const x1 = Math.max(a.x, b.x)
	const y1 = Math.max(a.y, b.y)
	const x2 = Math.min(a.x + a.width, b.x + b.width)
	const y2 = Math.min(a.y + a.height, b.y + b.height)
	const width = x2 - x1
	const height = y2 - y1
	if (width <= 0 || height <= 0) return null
	return { x: x1, y: y1, width, height }
}

function sortCandidates(a: LoadCandidateBase, b: LoadCandidateBase): number {
	const priorityDiff = getPriorityRank(a.priority) - getPriorityRank(b.priority)
	if (priorityDiff !== 0) return priorityDiff
	const longEdgeDiff = b.screenLongEdge - a.screenLongEdge
	if (longEdgeDiff !== 0) return longEdgeDiff
	const areaDiff = b.screenArea - a.screenArea
	if (areaDiff !== 0) return areaDiff
	return a.distanceToViewportCenter - b.distanceToViewportCenter
}

function sortFullAdmissionCandidates(a: LoadCandidateBase, b: LoadCandidateBase): number {
	const priorityDiff = getPriorityRank(a.priority) - getPriorityRank(b.priority)
	if (priorityDiff !== 0) return priorityDiff
	const centerDiff = a.distanceToViewportCenter - b.distanceToViewportCenter
	if (centerDiff !== 0) return centerDiff
	const longEdgeDiff = b.screenLongEdge - a.screenLongEdge
	if (longEdgeDiff !== 0) return longEdgeDiff
	return b.screenArea - a.screenArea
}

function removeCandidatesByIds<T extends LoadCandidateBase>(
	candidates: T[],
	elementIds: Set<string>,
): void {
	for (let index = candidates.length - 1; index >= 0; index -= 1) {
		if (elementIds.has(candidates[index].elementId)) {
			candidates.splice(index, 1)
		}
	}
}

function hasSameCandidateMembership<TCandidate extends LoadCandidateBase>(
	candidatesByElementId: ReadonlyMap<string, CachedViewportMediaCandidate<TCandidate>>,
	visibleElementIds: ReadonlySet<string>,
	nearElementIds: ReadonlySet<string>,
): boolean {
	let expectedCandidateCount = visibleElementIds.size
	nearElementIds.forEach((elementId) => {
		if (!visibleElementIds.has(elementId)) expectedCandidateCount += 1
	})
	if (candidatesByElementId.size !== expectedCandidateCount) return false
	for (const elementId of visibleElementIds) {
		if (candidatesByElementId.get(elementId)?.visibilityState !== "visible") return false
	}
	for (const elementId of nearElementIds) {
		if (visibleElementIds.has(elementId)) continue
		if (candidatesByElementId.get(elementId)?.visibilityState !== "near") return false
	}
	return true
}

function rescaleCandidate<TCandidate extends LoadCandidateBase>(
	candidate: TCandidate,
	scaleRatio: number,
): TCandidate {
	if (scaleRatio === 1) return candidate
	candidate.screenArea *= scaleRatio * scaleRatio
	candidate.screenLongEdge *= scaleRatio
	return candidate
}

function getBackgroundImageLoadRequestBudget(reason: string): number | null {
	return reason === "visibility:drain" ||
		reason === FAR_VISIBILITY_DRAIN_REFRESH_REASON ||
		reason === "visibility:variant-switch-cooldown"
		? BACKGROUND_IMAGE_LOAD_REQUESTS_PER_REFRESH
		: null
}

function getPriorityRank(priority: ImageResourceLoadPriority): number {
	switch (priority) {
		case "critical":
			return 0
		case "visible":
			return 1
		case "near":
			return 2
		case "background":
			return 3
		default:
			return 4
	}
}

function getVideoLoadTierRank(tier: VideoLoadTier): number {
	return tier === "poster" ? 0 : 1
}

function getAudioLoadTierRank(tier: AudioLoadTier): number {
	return tier === "preload" ? 0 : 1
}

function hasChildren(
	element: LayerElement,
): element is LayerElement & { children: LayerElement[] } {
	return "children" in element && Array.isArray((element as { children?: unknown }).children)
}

function isContainerElement(element: LayerElement): boolean {
	return element.type === ElementTypeEnum.Frame || element.type === ElementTypeEnum.Group
}

function isClippingContainer(element: LayerElement): boolean {
	return element.type === ElementTypeEnum.Frame
}

function isViewportMovementReason(reason: string): boolean {
	return reason === "viewport:pan" || reason === "viewport:scale"
}

function isViewportResourceBoundReason(reason: string): boolean {
	return reason.startsWith("viewport:")
}

export class CanvasVisibilityManager {
	private readonly canvas: Canvas
	private readonly consumerVisibilityListeners = new Map<
		string,
		Set<(state: CanvasConsumerVisibility) => void>
	>()
	private readonly lastConsumerVisibilityState = new Map<string, CanvasConsumerVisibility>()
	private readonly registeredImages = new Map<string, RegisteredImageElement>()
	private readonly registeredVideos = new Map<string, RegisteredVideoElement>()
	private readonly registeredAudios = new Map<string, RegisteredAudioElement>()
	private readonly lastVisibilityState = new Map<string, VisibilityState>()
	private readonly lastVideoVisibilityState = new Map<string, VisibilityState>()
	private readonly lastAudioVisibilityState = new Map<string, VisibilityState>()
	private readonly activeImageIds = new Set<string>()
	private readonly activeVideoIds = new Set<string>()
	private readonly activeAudioIds = new Set<string>()
	private readonly activeConsumerIds = new Set<string>()
	private readonly viewportPreloadedAudioIds = new Set<string>()
	private readonly lastRequestedLoadState = new Map<string, RequestedImageLoadState>()
	private readonly lowFallbackPreviewPathByElementId = new Map<string, string>()
	private readonly lastRequestedVideoLoadState = new Map<string, RequestedVideoLoadState>()
	private readonly lastRequestedAudioLoadState = new Map<string, RequestedAudioLoadState>()
	private readonly lastContainerDisplayVariant = new Map<string, MediaDisplayResourceVariant>()
	private readonly imageRetentionHints = new Map<string, DecodedImageRetentionHint>()
	private rafId: number | null = null
	private drainTimerId: ReturnType<typeof setTimeout> | null = null
	private farVisibilityDrainTimerId: ReturnType<typeof setTimeout> | null = null
	private contentLayerHitGraphRestoreTimerId: ReturnType<typeof setTimeout> | null = null
	private variantSwitchCooldownTimerId: ReturnType<typeof setTimeout> | null = null
	private viewportIdleMediaTimerId: ReturnType<typeof setTimeout> | null = null
	private bootstrapNearHydrationTimerId: ReturnType<typeof setTimeout> | null = null
	private bootstrapNearHydrationAt = 0
	private scheduledRequiresFullRefresh = false
	private scheduledReason = "unknown"
	private lastQueryCoverRect: Rect | null = null
	private lastQueryLayoutRect: Rect | null = null
	private lastScaleBand: number | null = null
	private lastQueryViewportScale: number | null = null
	private lastQueryGeometryRevision: number | null = null
	/** Direct media candidates can be reused during motion while spatial membership is stable. */
	private viewportMediaCandidateCache: CachedViewportMediaCandidates | null = null
	private containerRootCache: ContainerRootCache | null = null
	private destroyed = false
	private lastViewportMovementAt = now()
	private imagePresentationPhase: ImagePresentationPhase = "idle"
	/**
	 * 以媒体 path 为粒度共享取消信号。不能按每次 pan 全量 abort：同一资源在连续拖动中
	 * 往往仍位于 visible / near 区，应该复用其在飞请求。
	 */
	private viewportResourceAbortControllers = new Map<string, AbortController>()
	/** Only accepted viewport requests are tracked, so cancellation can clear dedupe state locally. */
	private viewportResourceRequestElementIds = new Map<string, Set<string>>()
	private contentLayerHitGraphSuppressed = false
	private contentLayerPreviousListening: boolean | null = null
	private readonly renderVisibilityController: CanvasRenderVisibilityController
	private initialVisibleCriticalUntil = now() + INITIAL_VISIBLE_CRITICAL_WINDOW_MS
	private statsSnapshot: CanvasVisibilitySnapshot = {
		registeredImageCount: 0,
		registeredVideoCount: 0,
		registeredAudioCount: 0,
		registerDedupedCount: 0,
		videoRegisterDedupedCount: 0,
		audioRegisterDedupedCount: 0,
		lowFallbackPreviewCount: 0,
		visibleImageCount: 0,
		nearImageCount: 0,
		farImageCount: 0,
		visibleVideoCount: 0,
		nearVideoCount: 0,
		farVideoCount: 0,
		visibleAudioCount: 0,
		nearAudioCount: 0,
		farAudioCount: 0,
		lastQueryDurationMs: 0,
		lastRequestedVisibleCount: 0,
		lastRequestedNearCount: 0,
		lastRequestedVisibleVideoCount: 0,
		lastRequestedNearVideoCount: 0,
		lastRequestedVisibleAudioCount: 0,
		lastRequestedNearAudioCount: 0,
		lowDetailVisibleVideoCount: 0,
		pendingLowDetailVisibleVideoLoadCandidateCount: 0,
		pendingImageLoadCandidateCount: 0,
		pendingVideoLoadCandidateCount: 0,
		pendingAudioLoadCandidateCount: 0,
		drainScheduledCount: 0,
		drainRunCount: 0,
		lastViewportScale: 1,
		lastViewportWidth: 0,
		lastViewportHeight: 0,
		skippedViewportQueryCount: 0,
		queryCount: 0,
	}

	private readonly handleViewportPan = (): void => {
		const currentTime = now()
		this.lastViewportMovementAt = currentTime
		this.markViewportMoving(currentTime)
		this.suppressContentLayerHitGraphDuringViewportMovement()
		this.scheduleRefresh("viewport:pan", false)
	}

	private readonly handleViewportScale = (): void => {
		const currentTime = now()
		this.lastViewportMovementAt = currentTime
		this.markViewportMoving(currentTime)
		this.suppressContentLayerHitGraphDuringViewportMovement()
		this.scheduleRefresh("viewport:scale", false)
	}

	private readonly handleViewportChanged = (event: {
		data: { phase: "start" | "move" | "end" }
	}): void => {
		if (event.data.phase !== "end") return
		this.markViewportIdle()
	}

	private readonly handleElementChange = (): void => {
		this.invalidateContainerRootCache()
		this.invalidateViewportMediaCandidateCache()
		this.scheduleRefresh("element:change", true)
	}

	private readonly handleDocumentLoaded = (): void => {
		this.invalidateContainerRootCache()
		this.invalidateViewportMediaCandidateCache()
		this.initialVisibleCriticalUntil = now() + INITIAL_VISIBLE_CRITICAL_WINDOW_MS
		this.scheduleBootstrapNearHydration()
		this.scheduleRefresh("document:loaded", true)
	}

	private readonly handleContentPreviewChanged = (event: {
		data: { elementId?: string; contentId?: string }
	}): void => {
		const elementIds = event.data.elementId
			? [event.data.elementId]
			: [
					...this.registeredImages.keys(),
					...this.registeredVideos.keys(),
					...this.registeredAudios.keys(),
				]
		for (const elementId of new Set(elementIds)) {
			const element = this.canvas.elementManager.getElementData(elementId)
			if (!element) continue
			const path = (
				this.canvas.getEffectiveContent?.(elementId) as { src?: string } | undefined
			)?.src
			if (element.type === ElementTypeEnum.Image) this.updateImageElement(elementId, path)
			if (element.type === ElementTypeEnum.Video) this.updateVideoElement(elementId, path)
			if (element.type === ElementTypeEnum.Audio) this.updateAudioElement(elementId, path)
		}
		this.invalidateViewportMediaCandidateCache()
		this.scheduleRefresh("content:previewChanged", true)
	}

	public registerConsumerVisibility(
		elementId: string,
		listener: (state: CanvasConsumerVisibility) => void,
	): () => void {
		if (this.destroyed) return () => undefined

		const listeners = this.consumerVisibilityListeners.get(elementId) ?? new Set()
		listeners.add(listener)
		this.consumerVisibilityListeners.set(elementId, listeners)

		const state = this.resolveConsumerVisibilityState(elementId)
		this.lastConsumerVisibilityState.set(elementId, state)
		if (state === "far") this.activeConsumerIds.delete(elementId)
		else this.activeConsumerIds.add(elementId)
		listener(state)
		this.scheduleRefresh("consumer:register", true)

		return () => {
			const currentListeners = this.consumerVisibilityListeners.get(elementId)
			if (!currentListeners) return
			currentListeners.delete(listener)
			if (currentListeners.size === 0) {
				this.consumerVisibilityListeners.delete(elementId)
				this.lastConsumerVisibilityState.delete(elementId)
				this.activeConsumerIds.delete(elementId)
			}
		}
	}

	private readonly handleImageResourceLoaded = (event: {
		data: { path: string; resource: { variant: ImageResourceVariant } }
	}): void => {
		let fallbackPathChanged = false
		if (event.data.resource.variant === "low") {
			this.lowFallbackPreviewPathByElementId.forEach((path, elementId) => {
				if (this.isSameResourcePath(path, event.data.path)) {
					this.lowFallbackPreviewPathByElementId.delete(elementId)
					fallbackPathChanged = true
				}
			})
		}
		if (fallbackPathChanged) this.invalidateViewportMediaCandidateCache()
	}

	private readonly handleVideoResourceLoadFailed = (event: { data: { path: string } }): void => {
		let affected = false
		this.registeredVideos.forEach((registered, elementId) => {
			if (!this.isSameResourcePath(registered.path, event.data.path)) return
			affected = this.lastRequestedVideoLoadState.delete(elementId) || affected
		})
		if (affected) this.invalidateViewportMediaCandidateCache()
	}

	private readonly handleVideoPosterWillRelease = (event: { data: { path?: string } }): void => {
		let affected = false
		this.registeredVideos.forEach((registered, elementId) => {
			if (event.data.path && !this.isSameResourcePath(registered.path, event.data.path)) {
				return
			}
			affected = this.lastRequestedVideoLoadState.delete(elementId) || affected
		})

		// Resource release invalidates the tier/priority dedupe state. Without this,
		// a visible video can keep its old "poster requested" state and never ask for
		// a replacement after its Canvas source has been released.
		if (affected && !this.destroyed) {
			this.invalidateViewportMediaCandidateCache()
			this.scheduleRefresh("video:poster-released", true)
		}
	}

	private readonly handleAudioResourceLoadFailed = (event: {
		data: { path: string; reason?: ResourceLoadFailureReason }
	}): void => {
		if (event.data.reason === "not-found") return
		let affected = false
		this.registeredAudios.forEach((registered, elementId) => {
			if (!this.isSameResourcePath(registered.path, event.data.path)) return
			affected = this.lastRequestedAudioLoadState.delete(elementId) || affected
		})
		if (affected) this.invalidateViewportMediaCandidateCache()
	}

	private readonly handleImageResourceLoadFailed = (event: {
		data: {
			path: string
			reason?: ResourceLoadFailureReason
			preservePreview?: boolean
		}
	}): void => {
		if (this.destroyed || event.data.reason === "not-found") {
			return
		}

		// A transient preview/refresh failure must not permanently poison the visibility
		// request dedupe state. Do not schedule an immediate retry here: the next normal
		// visibility refresh (viewport/element/idle) should retry without creating a loop.
		this.invalidateImageLoadRequest(event.data.path, undefined, "load-failed", {
			scheduleRefresh: false,
		})
	}

	private readonly handleImageVariantLoadFailed = (event: {
		data: {
			path: string
			variant: ImageResourceVariant
			reason?: ResourceLoadFailureReason
		}
	}): void => {
		if (this.destroyed) {
			return
		}

		if (event.data.variant !== "low") {
			// preview/full failures are not fallback transitions, so invalidate the exact
			// failed tier and let the next visibility pass retry it.
			this.invalidateImageLoadRequest(
				event.data.path,
				event.data.variant,
				"variant-load-failed",
				{ scheduleRefresh: false },
			)
			return
		}

		let fallbackTargetChanged = false
		this.registeredImages.forEach((registered, elementId) => {
			if (!this.isSameResourcePath(registered.path, event.data.path)) return
			const visibilityState = this.lastVisibilityState.get(elementId)
			if (visibilityState !== "visible") return
			if (!this.canvas.elementManager.isElementVisibleInDataTree(elementId)) return
			if (this.lowFallbackPreviewPathByElementId.get(elementId) === registered.path) {
				return
			}
			this.lowFallbackPreviewPathByElementId.set(elementId, registered.path)
			this.statsSnapshot.lowFallbackPreviewCount += 1
			fallbackTargetChanged = true
		})
		if (fallbackTargetChanged && this.imagePresentationPhase === "idle") {
			this.invalidateViewportMediaCandidateCache()
			this.scheduleRefresh(IMAGE_LOW_FALLBACK_REFRESH_REASON, true)
		} else if (fallbackTargetChanged) {
			this.invalidateViewportMediaCandidateCache()
		}
	}

	constructor(options: { canvas: Canvas }) {
		this.canvas = options.canvas
		this.renderVisibilityController = new CanvasRenderVisibilityController({
			canvas: this.canvas,
			strategy: FAR_KONVA_RENDER_VISIBILITY_STRATEGY,
		})
		this.canvas.eventEmitter.on("viewport:pan", this.handleViewportPan)
		this.canvas.eventEmitter.on("viewport:scale", this.handleViewportScale)
		this.canvas.eventEmitter.on("viewport:changed", this.handleViewportChanged)
		this.canvas.eventEmitter.on("element:change", this.handleElementChange)
		this.canvas.eventEmitter.on("document:loaded", this.handleDocumentLoaded)
		this.canvas.eventEmitter.on("content:previewChanged", this.handleContentPreviewChanged)
		this.canvas.eventEmitter.on("resource:image:loaded", this.handleImageResourceLoaded)
		this.canvas.eventEmitter.on(
			"resource:video:load-failed",
			this.handleVideoResourceLoadFailed,
		)
		this.canvas.eventEmitter.on(
			"resource:video:will-release",
			this.handleVideoPosterWillRelease,
		)
		this.canvas.eventEmitter.on(
			"resource:audio:load-failed",
			this.handleAudioResourceLoadFailed,
		)
		this.canvas.eventEmitter.on(
			"resource:image:load-failed",
			this.handleImageResourceLoadFailed,
		)
		this.canvas.eventEmitter.on(
			"resource:image:variant-load-failed",
			this.handleImageVariantLoadFailed,
		)
	}

	public registerImageElement(elementId: string, path: string): void {
		if (this.destroyed) return
		const current = this.registeredImages.get(elementId)
		if (current && this.isSameResourcePath(current.path, path)) {
			this.statsSnapshot.registerDedupedCount += 1
			return
		}
		this.registeredImages.set(elementId, { elementId, path })
		this.invalidateViewportMediaCandidateCache()
		if (current) {
			this.cancelViewportResourceSignalIfUnused(
				"image",
				current.path,
				elementId,
				this.registeredImages,
			)
			this.canvas.imagePresentationScheduler.removeTarget(elementId)
		}
		this.lastVisibilityState.delete(elementId)
		this.lastRequestedLoadState.delete(elementId)
		this.lowFallbackPreviewPathByElementId.delete(elementId)
		this.imageRetentionHints.delete(elementId)
		this.scheduleRefresh("image:register", true)
	}

	public unregisterImageElement(elementId: string): void {
		const registered = this.registeredImages.get(elementId)
		if (!registered) return
		this.registeredImages.delete(elementId)
		this.invalidateViewportMediaCandidateCache()
		this.cancelViewportResourceSignalIfUnused(
			"image",
			registered.path,
			elementId,
			this.registeredImages,
		)
		this.lastVisibilityState.delete(elementId)
		this.activeImageIds.delete(elementId)
		this.lastRequestedLoadState.delete(elementId)
		this.lowFallbackPreviewPathByElementId.delete(elementId)
		this.imageRetentionHints.delete(elementId)
		this.canvas.imagePresentationScheduler.removeTarget(elementId)
		this.scheduleRefresh("image:unregister", true)
	}

	public updateImageElement(elementId: string, path: string | null | undefined): void {
		if (!path) {
			this.unregisterImageElement(elementId)
			return
		}

		const current = this.registeredImages.get(elementId)
		if (current?.path === path) return
		this.registerImageElement(elementId, path)
	}

	public registerVideoElement(elementId: string, path: string): void {
		if (this.destroyed) return
		const current = this.registeredVideos.get(elementId)
		if (current && this.isSameResourcePath(current.path, path)) {
			this.statsSnapshot.videoRegisterDedupedCount += 1
			return
		}
		this.registeredVideos.set(elementId, { elementId, path })
		this.invalidateViewportMediaCandidateCache()
		if (current) {
			this.cancelViewportResourceSignalIfUnused(
				"video",
				current.path,
				elementId,
				this.registeredVideos,
			)
		}
		this.lastVideoVisibilityState.delete(elementId)
		this.lastRequestedVideoLoadState.delete(elementId)
		this.scheduleRefresh("video:register", true)
	}

	public unregisterVideoElement(elementId: string): void {
		const registered = this.registeredVideos.get(elementId)
		if (!registered) return
		this.registeredVideos.delete(elementId)
		this.invalidateViewportMediaCandidateCache()
		this.cancelViewportResourceSignalIfUnused(
			"video",
			registered.path,
			elementId,
			this.registeredVideos,
		)
		this.lastVideoVisibilityState.delete(elementId)
		this.activeVideoIds.delete(elementId)
		this.lastRequestedVideoLoadState.delete(elementId)
		this.scheduleRefresh("video:unregister", true)
	}

	public updateVideoElement(elementId: string, path: string | null | undefined): void {
		if (!path) {
			this.unregisterVideoElement(elementId)
			return
		}

		const current = this.registeredVideos.get(elementId)
		if (current?.path === path) return
		this.registerVideoElement(elementId, path)
	}

	public registerAudioElement(elementId: string, path: string): void {
		if (this.destroyed) return
		const current = this.registeredAudios.get(elementId)
		if (current?.path === path) {
			this.statsSnapshot.audioRegisterDedupedCount += 1
			return
		}
		this.registeredAudios.set(elementId, { elementId, path })
		this.invalidateViewportMediaCandidateCache()
		if (current) {
			// 等价资源引用也可能从相对路径切换成项目绝对路径。必须更新保存的引用并
			// 释放旧会话，否则后续刷新会继续使用旧 path 和已完成的请求去重状态。
			this.cancelViewportResourceSignalIfUnused(
				"audio",
				current.path,
				elementId,
				this.registeredAudios,
			)
			this.canvas.audioPlaybackManager.release(elementId)
		}
		this.lastAudioVisibilityState.delete(elementId)
		this.lastRequestedAudioLoadState.delete(elementId)
		this.scheduleRefresh("audio:register", true)
	}

	public unregisterAudioElement(elementId: string): void {
		const registered = this.registeredAudios.get(elementId)
		if (!registered) return
		this.registeredAudios.delete(elementId)
		this.invalidateViewportMediaCandidateCache()
		this.cancelViewportResourceSignalIfUnused(
			"audio",
			registered.path,
			elementId,
			this.registeredAudios,
		)
		this.lastAudioVisibilityState.delete(elementId)
		this.activeAudioIds.delete(elementId)
		this.viewportPreloadedAudioIds.delete(elementId)
		this.lastRequestedAudioLoadState.delete(elementId)
		this.canvas.audioPlaybackManager.release(elementId)
		this.scheduleRefresh("audio:unregister", true)
	}

	public updateAudioElement(elementId: string, path: string | null | undefined): void {
		if (!path) {
			this.unregisterAudioElement(elementId)
			return
		}

		const current = this.registeredAudios.get(elementId)
		if (current?.path === path) return
		this.registerAudioElement(elementId, path)
	}

	public invalidateAudioLoadRequest(
		path: string,
		reason = "resource-invalidated",
		options?: { scheduleRefresh?: boolean },
	): void {
		if (this.destroyed || !path) return

		let matched = false
		this.registeredAudios.forEach((registered, elementId) => {
			if (!this.isSameResourcePath(registered.path, path)) return
			matched = true
			this.lastRequestedAudioLoadState.delete(elementId)
		})

		if (matched && options?.scheduleRefresh !== false) {
			this.invalidateViewportMediaCandidateCache()
			this.scheduleRefresh(`audio:load-request-invalidated:${reason}`, true)
		} else if (matched) {
			this.invalidateViewportMediaCandidateCache()
		}
	}

	public requestImmediateImageLoad(
		elementId: string,
		options?: { reason?: string; priority?: ImageResourceLoadPriority },
	): void {
		const registered = this.registeredImages.get(elementId)
		if (!registered) {
			return
		}
		const priority = options?.priority ?? "critical"
		this.requestImageLoad(
			{
				elementId,
				path: registered.path,
				priority,
				variant: "preview",
				visibilityState: "visible",
				screenArea: 0,
				screenLongEdge: 0,
				distanceToViewportCenter: 0,
			},
			options?.reason ?? "immediate",
			true,
		)
	}

	public requestImmediateAudioLoad(
		elementId: string,
		options?: { reason?: string; priority?: ImageResourceLoadPriority },
	): void {
		const registered = this.registeredAudios.get(elementId)
		if (!registered) return

		const priority = options?.priority ?? "critical"
		this.requestAudioLoad(
			{
				elementId,
				path: registered.path,
				priority,
				tier: "preload",
				visibilityState: "visible",
				screenArea: 0,
				screenLongEdge: 0,
				distanceToViewportCenter: 0,
			},
			options?.reason ?? "immediate",
			true,
		)
	}

	public requestImmediateMediaLoadForElements(
		elementIds: string[],
		options?: {
			reason?: string
			priority?: ImageResourceLoadPriority
			includeDirectImages?: boolean
			maxImageCount?: number
		},
	): void {
		if (this.destroyed || elementIds.length === 0) return

		const reason = options?.reason ?? "immediate-elements"
		const priority = options?.priority ?? "critical"
		const includeDirectImages = options?.includeDirectImages ?? true
		const maxImageCount = options?.maxImageCount ?? 48
		const imageIds: string[] = []
		const visited = new Set<string>()
		const queued = new Set<string>()

		const visit = (elementId: string, isRoot: boolean): void => {
			if (imageIds.length >= maxImageCount) {
				return
			}
			if (visited.has(elementId)) {
				return
			}
			visited.add(elementId)

			if (!this.canvas.elementManager.isElementVisibleInDataTree(elementId)) {
				return
			}

			const element = this.canvas.elementManager.getElementData(elementId)
			if (!element) {
				return
			}

			if (element.type === ElementTypeEnum.Image) {
				if (!isRoot || includeDirectImages) {
					this.queueImmediateImageElement(element, imageIds, queued, maxImageCount)
				}
				return
			}

			if (
				(element.type === ElementTypeEnum.Frame ||
					element.type === ElementTypeEnum.Group) &&
				Array.isArray(element.children)
			) {
				element.children.forEach((child) => visit(child.id, false))
			}
		}

		elementIds.forEach((elementId) => visit(elementId, true))
		imageIds.forEach((imageId) => {
			this.requestImmediateImageLoad(imageId, { reason, priority })
		})
	}

	public invalidateImageLoadRequest(
		path: string,
		variant?: ImageResourceVariant,
		reason = "resource-invalidated",
		options?: { scheduleRefresh?: boolean },
	): void {
		if (this.destroyed) return

		let matched = false
		this.registeredImages.forEach((registered, elementId) => {
			if (!this.isSameResourcePath(registered.path, path)) return

			const previousState = this.lastRequestedLoadState.get(elementId)
			if (variant) {
				if (!previousState || previousState.variant !== variant) return
			}

			matched = true
			if (previousState) {
				this.lastRequestedLoadState.delete(elementId)
			}
		})

		if (matched && options?.scheduleRefresh !== false) {
			this.invalidateViewportMediaCandidateCache()
			this.scheduleRefresh(`image:load-request-invalidated:${reason}`, true)
		} else if (matched) {
			this.invalidateViewportMediaCandidateCache()
		}
	}

	public getSnapshot(): CanvasVisibilitySnapshot {
		return { ...this.statsSnapshot }
	}

	public handleResourceReferenceResolverChanged(
		options?: CanvasResourceReferenceResolverChangeOptions,
	): void {
		if (this.destroyed) return
		const changedResourceIdentities = options?.changedResourceIdentities
		if (changedResourceIdentities) {
			const affectedElementIds = new Set<string>()
			const affectedResourceKeys = new Set<string>()
			const collectAffected = <
				T extends RegisteredImageElement | RegisteredVideoElement | RegisteredAudioElement,
			>(
				registered: Map<string, T>,
				mediaType: "image" | "video" | "audio",
			): void => {
				registered.forEach((resource, elementId) => {
					const identity = getCanvasHostResourceReferenceIdentity(
						this.canvas,
						resource.path,
					)
					if (!changedResourceIdentities.has(identity)) return
					affectedElementIds.add(elementId)
					affectedResourceKeys.add(`${mediaType}\0${identity}`)
				})
			}

			collectAffected(this.registeredImages, "image")
			collectAffected(this.registeredVideos, "video")
			collectAffected(this.registeredAudios, "audio")

			const controllers = this.getViewportResourceAbortControllers()
			controllers.forEach((controller, key) => {
				const separatorIndex = key.indexOf("\0")
				const identity = separatorIndex >= 0 ? key.slice(separatorIndex + 1) : ""
				if (!changedResourceIdentities.has(identity)) return
				controller.abort()
				controllers.delete(key)
				affectedResourceKeys.add(key)
			})

			affectedElementIds.forEach((elementId) => {
				this.lastVisibilityState.delete(elementId)
				this.lastVideoVisibilityState.delete(elementId)
				this.lastAudioVisibilityState.delete(elementId)
				this.lastRequestedLoadState.delete(elementId)
				this.lastRequestedVideoLoadState.delete(elementId)
				this.lastRequestedAudioLoadState.delete(elementId)
				this.imageRetentionHints.delete(elementId)
				const fallbackPath = this.lowFallbackPreviewPathByElementId.get(elementId)
				if (
					fallbackPath &&
					changedResourceIdentities.has(
						getCanvasHostResourceReferenceIdentity(this.canvas, fallbackPath),
					)
				) {
					this.lowFallbackPreviewPathByElementId.delete(elementId)
				}
			})

			this.clearViewportResourceLoadRequestStates(affectedResourceKeys)
			if (affectedResourceKeys.size > 0) {
				this.invalidateViewportMediaCandidateCache()
				this.scheduleRefresh("resource-reference-resolver-changed", true)
			}
			return
		}

		const controllers = this.getViewportResourceAbortControllers()
		controllers.forEach((controller) => controller.abort())
		controllers.clear()
		this.getViewportResourceRequestElementIds().clear()
		this.lastVisibilityState.clear()
		this.lastVideoVisibilityState.clear()
		this.lastAudioVisibilityState.clear()
		this.lastRequestedLoadState.clear()
		this.lastRequestedVideoLoadState.clear()
		this.lastRequestedAudioLoadState.clear()
		this.lowFallbackPreviewPathByElementId.clear()
		this.imageRetentionHints.clear()
		this.invalidateViewportMediaCandidateCache()
		this.scheduleRefresh("resource-reference-resolver-changed", true)
	}

	public destroy(): void {
		this.destroyed = true
		if (this.rafId !== null && typeof cancelAnimationFrame !== "undefined") {
			cancelAnimationFrame(this.rafId)
		}
		if (this.drainTimerId !== null) {
			clearTimeout(this.drainTimerId)
		}
		if (this.farVisibilityDrainTimerId !== null) {
			clearTimeout(this.farVisibilityDrainTimerId)
		}
		if (this.contentLayerHitGraphRestoreTimerId !== null) {
			clearTimeout(this.contentLayerHitGraphRestoreTimerId)
		}
		if (this.variantSwitchCooldownTimerId !== null) {
			clearTimeout(this.variantSwitchCooldownTimerId)
		}
		if (this.viewportIdleMediaTimerId !== null) {
			clearTimeout(this.viewportIdleMediaTimerId)
		}
		if (this.bootstrapNearHydrationTimerId !== null) {
			clearTimeout(this.bootstrapNearHydrationTimerId)
		}
		this.rafId = null
		this.drainTimerId = null
		this.farVisibilityDrainTimerId = null
		this.contentLayerHitGraphRestoreTimerId = null
		this.variantSwitchCooldownTimerId = null
		this.viewportIdleMediaTimerId = null
		this.bootstrapNearHydrationTimerId = null
		this.bootstrapNearHydrationAt = 0
		this.restoreContentLayerHitGraph()
		this.registeredImages.clear()
		this.registeredVideos.clear()
		this.registeredAudios.clear()
		this.consumerVisibilityListeners.clear()
		this.lastConsumerVisibilityState.clear()
		this.lastVisibilityState.clear()
		this.lastVideoVisibilityState.clear()
		this.lastAudioVisibilityState.clear()
		this.activeImageIds.clear()
		this.activeVideoIds.clear()
		this.activeAudioIds.clear()
		this.activeConsumerIds.clear()
		this.viewportPreloadedAudioIds.clear()
		this.lastRequestedLoadState.clear()
		this.lowFallbackPreviewPathByElementId.clear()
		this.lastRequestedVideoLoadState.clear()
		this.lastRequestedAudioLoadState.clear()
		this.lastContainerDisplayVariant.clear()
		this.imageRetentionHints.clear()
		this.invalidateViewportMediaCandidateCache()
		const controllers = this.getViewportResourceAbortControllers()
		controllers.forEach((controller) => controller.abort())
		controllers.clear()
		this.getViewportResourceRequestElementIds().clear()
		this.renderVisibilityController.restoreAll()
		this.canvas.eventEmitter.off("viewport:pan", this.handleViewportPan)
		this.canvas.eventEmitter.off("viewport:scale", this.handleViewportScale)
		this.canvas.eventEmitter.off("viewport:changed", this.handleViewportChanged)
		this.canvas.eventEmitter.off("element:change", this.handleElementChange)
		this.canvas.eventEmitter.off("document:loaded", this.handleDocumentLoaded)
		this.canvas.eventEmitter.off("content:previewChanged", this.handleContentPreviewChanged)
		this.canvas.eventEmitter.off("resource:image:loaded", this.handleImageResourceLoaded)
		this.canvas.eventEmitter.off(
			"resource:video:load-failed",
			this.handleVideoResourceLoadFailed,
		)
		this.canvas.eventEmitter.off(
			"resource:video:will-release",
			this.handleVideoPosterWillRelease,
		)
		this.canvas.eventEmitter.off(
			"resource:audio:load-failed",
			this.handleAudioResourceLoadFailed,
		)
		this.canvas.eventEmitter.off(
			"resource:image:load-failed",
			this.handleImageResourceLoadFailed,
		)
		this.canvas.eventEmitter.off(
			"resource:image:variant-load-failed",
			this.handleImageVariantLoadFailed,
		)
	}

	private isSameResourcePath(left: string, right: string): boolean {
		return areCanvasHostResourceReferencesSame(this.canvas, left, right)
	}

	private getViewportResourceSignal(
		mediaType: ViewportResourceMediaType,
		path: string,
		elementId: string,
	): AbortSignal {
		const key = this.getViewportResourceAbortKey(mediaType, path)
		const controllers = this.getViewportResourceAbortControllers()
		let controller = controllers.get(key)
		if (!controller || controller.signal.aborted) {
			controller = new AbortController()
			controllers.set(key, controller)
		}
		const resourceElementIds = this.getViewportResourceRequestElementIds()
		let elementIds = resourceElementIds.get(key)
		if (!elementIds) {
			elementIds = new Set<string>()
			resourceElementIds.set(key, elementIds)
		}
		elementIds.add(elementId)
		return controller.signal
	}

	private getViewportResourceAbortKey(
		mediaType: ViewportResourceMediaType,
		path: string,
	): string {
		return `${mediaType}\0${getCanvasHostResourceReferenceIdentity(this.canvas, path)}`
	}

	private cancelFarViewportResourceSignals(
		activeKeys: Set<string>,
		options?: { preserveAudio?: boolean },
	): void {
		const controllers = this.getViewportResourceAbortControllers()
		const cancelledKeys = new Set<string>()
		controllers.forEach((controller, key) => {
			if (activeKeys.has(key)) return
			if (options?.preserveAudio && key.startsWith("audio\0")) return
			controller.abort()
			controllers.delete(key)
			cancelledKeys.add(key)
		})
		this.clearViewportResourceLoadRequestStates(cancelledKeys)
	}

	private clearViewportResourceLoadRequestStates(resourceKeys: ReadonlySet<string>): void {
		if (resourceKeys.size === 0) return
		const resourceElementIds = this.getViewportResourceRequestElementIds()
		resourceKeys.forEach((resourceKey) => {
			const elementIds = resourceElementIds.get(resourceKey)
			if (!elementIds) return

			if (resourceKey.startsWith("image\0")) {
				elementIds.forEach((elementId) => this.lastRequestedLoadState.delete(elementId))
			} else if (resourceKey.startsWith("video\0")) {
				elementIds.forEach((elementId) =>
					this.lastRequestedVideoLoadState.delete(elementId),
				)
			} else if (resourceKey.startsWith("audio\0")) {
				elementIds.forEach((elementId) =>
					this.lastRequestedAudioLoadState.delete(elementId),
				)
			}
			resourceElementIds.delete(resourceKey)
		})
	}

	private cancelViewportResourceSignalIfUnused(
		mediaType: ViewportResourceMediaType,
		path: string,
		elementId: string,
		registered: Map<
			string,
			RegisteredImageElement | RegisteredVideoElement | RegisteredAudioElement
		>,
	): void {
		const key = this.getViewportResourceAbortKey(mediaType, path)
		const resourceElementIds = this.getViewportResourceRequestElementIds()
		const elementIds = resourceElementIds.get(key)
		elementIds?.delete(elementId)
		if (elementIds?.size === 0) resourceElementIds.delete(key)

		const controllers = this.getViewportResourceAbortControllers()
		const controller = controllers.get(key)
		if (!controller) return
		for (const resource of registered.values()) {
			if (this.getViewportResourceAbortKey(mediaType, resource.path) === key) return
		}
		controller.abort()
		controllers.delete(key)
		resourceElementIds.delete(key)
	}

	private getViewportResourceAbortControllers(): Map<string, AbortController> {
		if (!(this.viewportResourceAbortControllers instanceof Map)) {
			this.viewportResourceAbortControllers = new Map()
		}
		return this.viewportResourceAbortControllers
	}

	private getViewportResourceRequestElementIds(): Map<string, Set<string>> {
		if (!(this.viewportResourceRequestElementIds instanceof Map)) {
			this.viewportResourceRequestElementIds = new Map()
		}
		return this.viewportResourceRequestElementIds
	}

	private queueImmediateImageElement(
		element: LayerElement,
		imageIds: string[],
		queued: Set<string>,
		maxImageCount: number,
	): void {
		if (imageIds.length >= maxImageCount) return
		const effectiveContent = this.canvas.getEffectiveContent?.(element.id) as
			{ src?: string } | undefined
		if (
			element.type !== ElementTypeEnum.Image ||
			!(effectiveContent?.src ?? getActiveImageContent(element).src)
		) {
			return
		}
		if (!this.registeredImages.has(element.id)) {
			return
		}
		if (queued.has(element.id)) {
			return
		}

		queued.add(element.id)
		imageIds.push(element.id)
	}

	private scheduleRefresh(reason: string, requiresFullRefresh: boolean): void {
		if (this.destroyed) return
		if (reason === "visibility:drain" || reason === FAR_VISIBILITY_DRAIN_REFRESH_REASON) {
			this.statsSnapshot.drainRunCount += 1
		}
		if (requiresFullRefresh || !this.scheduledRequiresFullRefresh) {
			this.scheduledReason = reason
		}
		this.scheduledRequiresFullRefresh = this.scheduledRequiresFullRefresh || requiresFullRefresh
		if (this.rafId !== null) return

		const schedule =
			typeof requestAnimationFrame === "function"
				? requestAnimationFrame
				: (callback: FrameRequestCallback) => window.setTimeout(callback, 16)

		this.rafId = schedule(() => {
			this.rafId = null
			const shouldRunFullRefresh = this.scheduledRequiresFullRefresh
			const scheduledReason = this.scheduledReason
			this.scheduledRequiresFullRefresh = false
			this.refreshVisibility(scheduledReason, shouldRunFullRefresh)
		})
	}

	private scheduleVariantSwitchCooldownRefresh(delayMs: number): void {
		if (this.destroyed || this.variantSwitchCooldownTimerId !== null) return

		this.variantSwitchCooldownTimerId = setTimeout(
			() => {
				this.variantSwitchCooldownTimerId = null
				this.scheduleRefresh("visibility:variant-switch-cooldown", true)
			},
			Math.max(0, delayMs),
		)
	}

	private scheduleBootstrapNearHydration(): void {
		this.bootstrapNearHydrationAt = now() + BOOTSTRAP_NEAR_HYDRATION_DELAY_MS
		if (this.bootstrapNearHydrationTimerId !== null) {
			clearTimeout(this.bootstrapNearHydrationTimerId)
		}
		this.bootstrapNearHydrationTimerId = setTimeout(() => {
			this.bootstrapNearHydrationTimerId = null
			this.bootstrapNearHydrationAt = 0
			if (this.destroyed) return
			this.scheduleRefresh(BOOTSTRAP_NEAR_HYDRATION_REASON, true)
		}, BOOTSTRAP_NEAR_HYDRATION_DELAY_MS)
	}

	private markViewportMoving(currentTime = now()): void {
		this.imagePresentationPhase = "moving"
		this.lastViewportMovementAt = currentTime
		// A far-drain timer belongs to the previous settled viewport. Cancel it immediately so a
		// delayed callback cannot enqueue a full-document visibility refresh during active motion.
		this.cancelFarVisibilityDrain()
		if (this.viewportIdleMediaTimerId !== null) {
			clearTimeout(this.viewportIdleMediaTimerId)
		}
		this.viewportIdleMediaTimerId = setTimeout(() => {
			this.viewportIdleMediaTimerId = null
			if (this.destroyed) return
			this.markViewportIdle()
		}, VIEWPORT_IDLE_MEDIA_DELAY_MS)
	}

	private cancelFarVisibilityDrain(): void {
		if (this.farVisibilityDrainTimerId === null) return
		clearTimeout(this.farVisibilityDrainTimerId)
		this.farVisibilityDrainTimerId = null
	}

	private markViewportIdle(): void {
		if (this.viewportIdleMediaTimerId !== null) {
			clearTimeout(this.viewportIdleMediaTimerId)
			this.viewportIdleMediaTimerId = null
		}
		if (this.imagePresentationPhase === "idle") return
		this.imagePresentationPhase = "idle"
		this.scheduleRefresh(VIEWPORT_IDLE_MEDIA_REFRESH_REASON, true)
	}

	private resolveImageCandidateForPresentationPhase(
		candidate: ImageLoadCandidate,
	): ImageLoadCandidate {
		if (this.imagePresentationPhase === "idle") {
			// Some formats cannot produce the low derivative. Keep the fallback declarative so
			// moving still stays low-only and idle can promote the same active target to preview.
			const fallbackPath = this.lowFallbackPreviewPathByElementId.get(candidate.elementId)
			if (
				candidate.variant === "low" &&
				fallbackPath &&
				this.isSameResourcePath(fallbackPath, candidate.path)
			) {
				return { ...candidate, variant: "preview" }
			}
			return candidate
		}
		return {
			...candidate,
			variant: this.getDisplayedImageVariant(candidate.elementId) ?? "low",
		}
	}

	private shouldReuseCoveredViewportState(options: {
		reason: string
		requiresFullRefresh: boolean
		viewportRect: Rect
		viewportScale: number
		scaleBand: number
		geometryRevision: number
	}): boolean {
		const {
			reason,
			requiresFullRefresh,
			viewportRect,
			viewportScale,
			scaleBand,
			geometryRevision,
		} = options
		if (requiresFullRefresh || !isViewportMovementReason(reason)) return false
		if (!this.lastQueryCoverRect || this.lastScaleBand !== scaleBand) return false
		if (this.lastQueryGeometryRevision !== geometryRevision) return false
		if (!this.canvas.geometryCacheManager.containsRect(this.lastQueryCoverRect, viewportRect)) {
			return false
		}
		if (
			!this.lastQueryLayoutRect ||
			!this.canvas.geometryCacheManager.containsRect(this.lastQueryLayoutRect, viewportRect)
		) {
			return false
		}
		// Reuse the previous classifications only while the viewport remains inside both windows.
		// Crossing the narrower layout window refreshes eligibility before an inactive element can
		// become visible, while the near window preserves the existing resource/culling contract.
		if (!this.lastQueryViewportScale || this.lastQueryViewportScale <= 0) return false

		const scaleRatio = viewportScale / this.lastQueryViewportScale
		return (
			scaleRatio >= 1 / VIEWPORT_MOVEMENT_SCALE_REFRESH_RATIO &&
			scaleRatio <= VIEWPORT_MOVEMENT_SCALE_REFRESH_RATIO
		)
	}

	private getCompatibleViewportMediaCandidates(options: {
		geometryRevision: number
		scaleBand: number
		viewportScale: number
	}): CachedViewportMediaCandidates | null {
		const cached = this.viewportMediaCandidateCache
		if (!cached) return null
		if (
			cached.geometryRevision !== options.geometryRevision ||
			cached.scaleBand !== options.scaleBand ||
			cached.imagePresentationPhase !== this.imagePresentationPhase
		) {
			return null
		}

		const scaleRatio = options.viewportScale / cached.baselineViewportScale
		if (
			!Number.isFinite(scaleRatio) ||
			scaleRatio < 1 / VIEWPORT_MOVEMENT_SCALE_REFRESH_RATIO ||
			scaleRatio > VIEWPORT_MOVEMENT_SCALE_REFRESH_RATIO
		) {
			return null
		}

		return cached
	}

	private hasSameViewportMediaMembership(
		cached: CachedViewportMediaCandidates,
		options: {
			visibleImageIds: ReadonlySet<string>
			nearImageIds: ReadonlySet<string>
			visibleVideoIds: ReadonlySet<string>
			nearVideoIds: ReadonlySet<string>
			visibleAudioIds: ReadonlySet<string>
			nearAudioIds: ReadonlySet<string>
		},
	): boolean {
		return (
			hasSameCandidateMembership(
				cached.imageCandidatesByElementId,
				options.visibleImageIds,
				options.nearImageIds,
			) &&
			hasSameCandidateMembership(
				cached.videoCandidatesByElementId,
				options.visibleVideoIds,
				options.nearVideoIds,
			) &&
			hasSameCandidateMembership(
				cached.audioCandidatesByElementId,
				options.visibleAudioIds,
				options.nearAudioIds,
			)
		)
	}

	private updateViewportMediaCandidateEntries<TCandidate extends LoadCandidateBase>(options: {
		cachedCandidatesByElementId?: ReadonlyMap<string, CachedViewportMediaCandidate<TCandidate>>
		visibleElementIds: ReadonlySet<string>
		nearElementIds: ReadonlySet<string>
		scaleRatio: number
		viewportCenter: { x: number; y: number }
		getElementBounds?: (elementId: string) => Rect | null
		createCandidate: (
			elementId: string,
			visibilityState: ViewportMediaVisibilityState,
		) => TCandidate | null
	}): Map<string, CachedViewportMediaCandidate<TCandidate>> {
		const nextCandidatesByElementId = new Map<
			string,
			CachedViewportMediaCandidate<TCandidate>
		>()
		const appendCandidates = (
			elementIds: ReadonlySet<string>,
			visibilityState: ViewportMediaVisibilityState,
		): void => {
			elementIds.forEach((elementId) => {
				// Visible wins if a defensive caller ever supplies overlapping spatial sets.
				if (visibilityState === "near" && options.visibleElementIds.has(elementId)) return
				const cachedCandidate = options.cachedCandidatesByElementId?.get(elementId)
				let candidate: TCandidate | null
				if (cachedCandidate?.visibilityState === visibilityState) {
					candidate = cachedCandidate.candidate
					if (candidate) {
						const bounds = options.getElementBounds?.(elementId)
						if (bounds) {
							candidate.distanceToViewportCenter = getDistance(
								getRectCenter(bounds),
								options.viewportCenter,
							)
						}
						rescaleCandidate(candidate, options.scaleRatio)
					}
				} else {
					candidate = options.createCandidate(elementId, visibilityState)
				}
				nextCandidatesByElementId.set(elementId, { candidate, visibilityState })
			})
		}

		appendCandidates(options.visibleElementIds, "visible")
		appendCandidates(options.nearElementIds, "near")
		return nextCandidatesByElementId
	}

	private classifyViewportMediaCandidates(options: {
		imageCandidatesByElementId: ReadonlyMap<
			string,
			CachedViewportMediaCandidate<ImageLoadCandidate>
		>
		videoCandidatesByElementId: ReadonlyMap<
			string,
			CachedViewportMediaCandidate<VideoLoadCandidate>
		>
		audioCandidatesByElementId: ReadonlyMap<
			string,
			CachedViewportMediaCandidate<AudioLoadCandidate>
		>
	}): ViewportMediaCandidateLists {
		const visibleCandidates: ImageLoadCandidate[] = []
		const lowDetailVisibleCandidates: ImageLoadCandidate[] = []
		const nearCandidates: ImageLoadCandidate[] = []
		const visibleVideoCandidates: VideoLoadCandidate[] = []
		const lowDetailVisibleVideoCandidates: VideoLoadCandidate[] = []
		const nearVideoCandidates: VideoLoadCandidate[] = []
		const visibleAudioCandidates: AudioLoadCandidate[] = []
		const nearAudioCandidates: AudioLoadCandidate[] = []

		options.imageCandidatesByElementId.forEach(({ candidate, visibilityState }) => {
			if (!candidate) return
			if (visibilityState === "visible") {
				if (candidate.screenLongEdge >= MIN_VISIBLE_SCREEN_LONG_EDGE_FOR_LOAD) {
					visibleCandidates.push(candidate)
				} else {
					lowDetailVisibleCandidates.push(candidate)
				}
			} else if (candidate.screenLongEdge >= MIN_NEAR_SCREEN_LONG_EDGE_FOR_LOAD) {
				nearCandidates.push(candidate)
			}
		})

		options.videoCandidatesByElementId.forEach(({ candidate, visibilityState }) => {
			if (!candidate) return
			if (visibilityState === "visible") {
				if (candidate.screenLongEdge >= MIN_VISIBLE_VIDEO_SCREEN_LONG_EDGE_FOR_LOAD) {
					visibleVideoCandidates.push(candidate)
				} else {
					lowDetailVisibleVideoCandidates.push(candidate)
				}
			} else if (candidate.screenLongEdge >= MIN_NEAR_VIDEO_SCREEN_LONG_EDGE_FOR_LOAD) {
				nearVideoCandidates.push(candidate)
			}
		})

		options.audioCandidatesByElementId.forEach(({ candidate, visibilityState }) => {
			if (!candidate) return
			if (
				visibilityState === "visible" &&
				candidate.screenLongEdge >= MIN_VISIBLE_AUDIO_SCREEN_LONG_EDGE_FOR_LOAD
			) {
				visibleAudioCandidates.push(candidate)
			} else if (
				visibilityState === "near" &&
				candidate.screenLongEdge >= MIN_NEAR_AUDIO_SCREEN_LONG_EDGE_FOR_LOAD
			) {
				nearAudioCandidates.push(candidate)
			}
		})

		return {
			visibleCandidates,
			lowDetailVisibleCandidates,
			nearCandidates,
			visibleVideoCandidates,
			lowDetailVisibleVideoCandidates,
			nearVideoCandidates,
			visibleAudioCandidates,
			nearAudioCandidates,
		}
	}

	private createViewportMediaCandidateCache(options: {
		compatibleCache: CachedViewportMediaCandidates | null
		geometryRevision: number
		scaleBand: number
		viewportScale: number
		viewportCenter: { x: number; y: number }
		viewportRect: Rect
		promoteInitialVisibleLoads: boolean
		visibleImageIds: ReadonlySet<string>
		nearImageIds: ReadonlySet<string>
		visibleVideoIds: ReadonlySet<string>
		nearVideoIds: ReadonlySet<string>
		visibleAudioIds: ReadonlySet<string>
		nearAudioIds: ReadonlySet<string>
	}): CachedViewportMediaCandidates {
		const { compatibleCache } = options
		const sameMembership = compatibleCache
			? this.hasSameViewportMediaMembership(compatibleCache, options)
			: false
		if (
			compatibleCache &&
			compatibleCache.viewportScale === options.viewportScale &&
			compatibleCache.viewportCenter.x === options.viewportCenter.x &&
			compatibleCache.viewportCenter.y === options.viewportCenter.y &&
			sameMembership
		) {
			return compatibleCache
		}

		const scaleRatio = compatibleCache
			? options.viewportScale / compatibleCache.viewportScale
			: 1
		// Geometry revision and phase compatibility guarantee that unchanged entries can retain their
		// expensive bounds, clipping, and resource decisions. Only membership/state deltas are rebuilt.
		const imageCandidatesByElementId = this.updateViewportMediaCandidateEntries({
			cachedCandidatesByElementId: compatibleCache?.imageCandidatesByElementId,
			visibleElementIds: options.visibleImageIds,
			nearElementIds: options.nearImageIds,
			scaleRatio,
			viewportCenter: options.viewportCenter,
			getElementBounds: (elementId) =>
				this.canvas.geometryCacheManager.getElementBounds(elementId),
			createCandidate: (elementId, visibilityState) => {
				const candidate = this.createCandidate(
					elementId,
					visibilityState,
					options.viewportScale,
					options.viewportCenter,
					visibilityState === "visible" && options.promoteInitialVisibleLoads
						? "critical"
						: undefined,
					options.viewportRect,
					true,
				)
				return candidate ? this.resolveImageCandidateForPresentationPhase(candidate) : null
			},
		})
		const videoCandidatesByElementId = this.updateViewportMediaCandidateEntries({
			cachedCandidatesByElementId: compatibleCache?.videoCandidatesByElementId,
			visibleElementIds: options.visibleVideoIds,
			nearElementIds: options.nearVideoIds,
			scaleRatio,
			viewportCenter: options.viewportCenter,
			getElementBounds: (elementId) =>
				this.canvas.geometryCacheManager.getElementBounds(elementId),
			createCandidate: (elementId, visibilityState) =>
				this.createVideoCandidate(
					elementId,
					visibilityState,
					options.viewportScale,
					options.viewportCenter,
					visibilityState === "visible" ? "poster" : "url",
					true,
				),
		})
		const audioCandidatesByElementId = this.updateViewportMediaCandidateEntries({
			cachedCandidatesByElementId: compatibleCache?.audioCandidatesByElementId,
			visibleElementIds: options.visibleAudioIds,
			nearElementIds: options.nearAudioIds,
			scaleRatio,
			viewportCenter: options.viewportCenter,
			getElementBounds: (elementId) =>
				this.canvas.geometryCacheManager.getElementBounds(elementId),
			createCandidate: (elementId, visibilityState) =>
				this.createAudioCandidate(
					elementId,
					visibilityState,
					options.viewportScale,
					options.viewportCenter,
					visibilityState === "visible" ? "preload" : "url",
					true,
				),
		})
		const candidateLists = this.classifyViewportMediaCandidates({
			imageCandidatesByElementId,
			videoCandidatesByElementId,
			audioCandidatesByElementId,
		})

		const cache: CachedViewportMediaCandidates = {
			geometryRevision: options.geometryRevision,
			scaleBand: options.scaleBand,
			baselineViewportScale: compatibleCache?.baselineViewportScale ?? options.viewportScale,
			viewportScale: options.viewportScale,
			viewportCenter: options.viewportCenter,
			imagePresentationPhase: this.imagePresentationPhase,
			imageCandidatesByElementId,
			videoCandidatesByElementId,
			audioCandidatesByElementId,
			...candidateLists,
		}
		this.viewportMediaCandidateCache = cache
		return cache
	}

	private invalidateViewportMediaCandidateCache(): void {
		this.viewportMediaCandidateCache = null
	}

	private invalidateContainerRootCache(): void {
		this.containerRootCache = null
	}

	private getContainerRootCache(): ContainerRootCache {
		if (this.containerRootCache) return this.containerRootCache

		this.containerRootCache = {
			rootContainerIds: this.canvas.elementManager
				.getAllElements()
				.filter(isContainerElement)
				.map((element) => element.id),
		}
		return this.containerRootCache
	}

	private getPreviousImageDisplayVariant(elementId: string): ImageResourceVariant | undefined {
		const previousVariant = this.lastRequestedLoadState.get(elementId)?.variant
		return previousVariant === "low" ||
			previousVariant === "preview" ||
			previousVariant === "full"
			? previousVariant
			: undefined
	}

	private getDisplayedImageVariant(elementId: string): ImageResourceVariant | undefined {
		const elementInstance = this.canvas.elementManager.getElementInstance(elementId)
		const getDisplayResourceVariant = (
			elementInstance as
				| {
						getDisplayResourceVariant?: () => ImageResourceVariant | undefined
				  }
				| undefined
		)?.getDisplayResourceVariant
		if (typeof getDisplayResourceVariant !== "function") return undefined
		return getDisplayResourceVariant.call(elementInstance)
	}

	private replaceImagePresentationTargets(candidates: ImageLoadCandidate[]): void {
		const targets: ImagePresentationTarget[] = candidates.map((candidate) => ({
			elementId: candidate.elementId,
			path: candidate.path,
			variant: candidate.variant,
			priority: candidate.priority,
			distanceToViewportCenter: candidate.distanceToViewportCenter,
		}))
		this.canvas.imagePresentationScheduler.replaceTargets(targets, this.imagePresentationPhase)
	}

	private updateImageRetentionHints(candidates: ImageLoadCandidate[], lastSeenAt: number): void {
		candidates.forEach((candidate) => {
			if (candidate.visibilityState !== "visible" && candidate.visibilityState !== "near") {
				return
			}
			const registered = this.registeredImages.get(candidate.elementId)
			if (!registered) return
			this.imageRetentionHints.set(candidate.elementId, {
				elementId: candidate.elementId,
				path: registered.path,
				visibilityState: candidate.visibilityState,
				requestedVariant: candidate.variant,
				displayedVariant: this.getDisplayedImageVariant(candidate.elementId),
				screenLongEdge: candidate.screenLongEdge,
				lastSeenAt,
			})
		})
	}

	private pruneExpiredImageRetentionHints(currentTime = now()): void {
		this.imageRetentionHints.forEach((hint, elementId) => {
			if (currentTime - hint.lastSeenAt > DECODED_IMAGE_RETENTION_GRACE_MS) {
				this.imageRetentionHints.delete(elementId)
			}
		})
	}

	public getDecodedImageRetentionSnapshot(): DecodedImageRetentionHint[] {
		this.pruneExpiredImageRetentionHints()
		return Array.from(this.imageRetentionHints.values(), (hint) => ({ ...hint }))
	}

	private queryViewportElementIds(
		viewportSnapshot: CanvasViewportSpatialSnapshot,
		includeRenderVisibility: boolean,
		includeAllRenderElements = false,
	): ViewportElementQueryResult {
		const renderElementIds = includeAllRenderElements
			? this.canvas.elementManager.getAllElementIds()
			: []
		const interactionElementIds = this.getInteractionElementIds()
		const viewportScaleLayoutElementIds = this.getViewportScaleLayoutElementIds(
			viewportSnapshot,
			interactionElementIds,
		)
		const renderActiveElementIds = includeRenderVisibility
			? this.getRenderActiveElementIds(viewportSnapshot, interactionElementIds)
			: new Set<string>()
		const visibleConsumerIds = new Set<string>()
		const nearConsumerIds = new Set<string>()
		const visibleImageIds = new Set<string>()
		const nearImageIds = new Set<string>()
		const visibleVideoIds = new Set<string>()
		const nearVideoIds = new Set<string>()
		const visibleAudioIds = new Set<string>()
		const nearAudioIds = new Set<string>()

		viewportSnapshot.visibleElementIds.forEach((elementId) => {
			if (this.consumerVisibilityListeners.has(elementId)) visibleConsumerIds.add(elementId)
			if (this.registeredImages.has(elementId)) visibleImageIds.add(elementId)
			if (this.registeredVideos.has(elementId)) visibleVideoIds.add(elementId)
			if (this.registeredAudios.has(elementId)) visibleAudioIds.add(elementId)
		})
		viewportSnapshot.nearElementIds.forEach((elementId) => {
			if (this.consumerVisibilityListeners.has(elementId)) {
				nearConsumerIds.add(elementId)
			}
			if (this.registeredImages.has(elementId)) {
				nearImageIds.add(elementId)
			}
			if (this.registeredVideos.has(elementId)) {
				nearVideoIds.add(elementId)
			}
			if (this.registeredAudios.has(elementId)) {
				nearAudioIds.add(elementId)
			}
		})

		return {
			renderElementIds,
			renderActiveElementIds,
			viewportScaleLayoutElementIds,
			visibleConsumerIds,
			nearConsumerIds,
			visibleImageIds,
			nearImageIds,
			visibleVideoIds,
			nearVideoIds,
			visibleAudioIds,
			nearAudioIds,
		}
	}

	private getViewportScaleLayoutElementIds(
		viewportSnapshot: CanvasViewportSpatialSnapshot,
		interactionElementIds: ReadonlySet<string> = this.getInteractionElementIds(),
	): Set<string> {
		// Scale callbacks change an element's screen-space controls/content. They are registered on
		// that owning element, so the visible set plus active interactions is enough; the wider layout
		// window remains reserved for keeping the render tree mounted.
		return new Set<string>([...viewportSnapshot.visibleElementIds, ...interactionElementIds])
	}

	private getInteractionElementIds(): Set<string> {
		const interactionElementIds = new Set<string>()
		this.canvas.selectionManager?.getSelectedIds?.().forEach((elementId) => {
			interactionElementIds.add(elementId)
		})
		const activeInteractionElementIds = [
			this.canvas.hoverManager?.getHoveredElementId?.(),
			this.canvas.cropManager?.getCroppingElementId?.(),
			this.canvas.extendManager?.getExtendingElementId?.(),
			this.canvas.eraserManager?.getErasingElementId?.(),
			this.canvas.textEditingManager?.getEditingElementId?.(),
			this.canvas.elementRenameManager?.getRenamingElementId?.(),
		]
		activeInteractionElementIds.forEach((elementId) => {
			if (elementId) interactionElementIds.add(elementId)
		})
		return interactionElementIds
	}

	private getRenderActiveElementIds(
		viewportSnapshot: CanvasViewportSpatialSnapshot,
		interactionElementIds: ReadonlySet<string> = this.getInteractionElementIds(),
	): Set<string> {
		// Near is a resource warm-up window and must not expand the Konva scene. The narrower
		// layout window is sufficient to keep upcoming content mounted while avoiding draw work
		// for media that is only being prefetched.
		const activeElementIds = new Set<string>([
			...viewportSnapshot.visibleElementIds,
			...viewportSnapshot.layoutElementIds,
		])

		// Selection and edit sessions can intentionally keep an element active outside the current
		// viewport. Their parent chain must stay admitted as well, otherwise hiding a nested child
		// would break its transformer, crop, extend, eraser, or text-editing surface.
		interactionElementIds.forEach((elementId) => {
			activeElementIds.add(elementId)
		})

		// CanvasDocumentIndex already owns the parent map. Track expanded IDs only for this closure so
		// shared ancestors are resolved once and malformed cyclic data cannot loop indefinitely.
		const expandedElementIds = new Set<string>()
		for (const elementId of activeElementIds) {
			let currentId: string | undefined = elementId
			while (currentId && !expandedElementIds.has(currentId)) {
				expandedElementIds.add(currentId)
				const parentId = this.canvas.elementManager.findParentIdForElement(currentId)
				if (!parentId) break
				activeElementIds.add(parentId)
				currentId = parentId
			}
		}

		return activeElementIds
	}

	private getRenderVisibilitySyncPlan(
		farDrainReady: boolean,
		topologyRevision: number,
	): {
		shouldSync: boolean
		fullReconcile: boolean
		allowCullFar: boolean
	} {
		if (!this.renderVisibilityController) {
			return { shouldSync: false, fullReconcile: false, allowCullFar: false }
		}
		const hasBootstrapped = this.renderVisibilityController.hasBootstrappedRenderWorkset()
		const topologyChanged =
			hasBootstrapped &&
			this.renderVisibilityController.getLastTopologyRevision() !== topologyRevision
		const bootstrap = !hasBootstrapped && farDrainReady

		return {
			shouldSync: hasBootstrapped || bootstrap || topologyChanged,
			fullReconcile: bootstrap || topologyChanged,
			// A topology change after bootstrap must hide a newly added far node immediately. Normal
			// motion still waits for the existing delayed drain before removing admitted nodes.
			allowCullFar: farDrainReady || topologyChanged,
		}
	}

	private refreshVisibility(reason: string, requiresFullRefresh: boolean): void {
		if (
			this.destroyed ||
			(this.registeredImages.size === 0 &&
				this.registeredVideos.size === 0 &&
				this.registeredAudios.size === 0 &&
				this.consumerVisibilityListeners.size === 0 &&
				this.canvas.runtimeScheduler.getViewportScaleLayoutElementCount() === 0)
		) {
			return
		}
		const startedAt = now()
		if (
			reason === FAR_VISIBILITY_DRAIN_REFRESH_REASON &&
			startedAt - this.lastViewportMovementAt < FAR_VISIBILITY_DRAIN_GRACE_MS
		) {
			// A far-drain callback may already be queued when a new pan/zoom event arrives. Defer it
			// until the new viewport has actually been idle for the full grace period.
			this.scheduleFarVisibilityDrain()
			return
		}
		const farDrainReady =
			(reason === "visibility:drain" || reason === FAR_VISIBILITY_DRAIN_REFRESH_REASON) &&
			startedAt - this.lastViewportMovementAt >= FAR_VISIBILITY_DRAIN_GRACE_MS
		const topologyRevision = this.canvas.elementManager?.getDocumentTopologyRevision?.() ?? 0
		const renderVisibilitySyncPlan = this.getRenderVisibilitySyncPlan(
			farDrainReady,
			topologyRevision,
		)

		const currentViewportRect = getViewportCanvasRect(this.canvas)
		const currentViewportScale = this.canvas.stage.scaleX() || 1
		const currentScaleBand = getScaleBand(currentViewportScale)
		const currentGeometryRevision = this.canvas.geometryCacheManager.getRevision()
		if (
			this.shouldReuseCoveredViewportState({
				reason,
				requiresFullRefresh: requiresFullRefresh || renderVisibilitySyncPlan.fullReconcile,
				viewportRect: currentViewportRect,
				viewportScale: currentViewportScale,
				scaleBand: currentScaleBand,
				geometryRevision: currentGeometryRevision,
			})
		) {
			// A Canvas without registered scale layouts has no eligibility set to refresh. Keep those
			// covered media-only frames out of the coordinator snapshot path; when scale layouts exist,
			// reclassify the cached coverage because exact visible membership can change inside the layout
			// window even though the spatial coverage itself remains valid.
			if (this.canvas.runtimeScheduler.getViewportScaleLayoutElementCount() > 0) {
				const viewportSnapshot = this.canvas.viewportQueryCoordinator.getSnapshot()
				this.canvas.runtimeScheduler.replaceViewportScaleLayoutEligibility(
					this.getViewportScaleLayoutElementIds(viewportSnapshot),
				)
			}
			this.scheduleFarVisibilityDrain()
			this.statsSnapshot.skippedViewportQueryCount += 1
			return
		}

		const viewportSnapshot = this.canvas.viewportQueryCoordinator.getSnapshot()
		const { viewportRect, viewportScale } = viewportSnapshot
		const scaleBand = getScaleBand(viewportScale)

		this.lastQueryCoverRect = viewportSnapshot.nearRect
		this.lastQueryLayoutRect = viewportSnapshot.layoutRect
		this.lastScaleBand = scaleBand
		this.lastQueryViewportScale = viewportScale
		this.lastQueryGeometryRevision = viewportSnapshot.geometryRevision
		const {
			renderElementIds,
			renderActiveElementIds,
			viewportScaleLayoutElementIds,
			visibleConsumerIds,
			nearConsumerIds,
			visibleImageIds: visibleIds,
			nearImageIds: nearIds,
			visibleVideoIds,
			nearVideoIds,
			visibleAudioIds,
			nearAudioIds,
		} = this.queryViewportElementIds(
			viewportSnapshot,
			renderVisibilitySyncPlan.shouldSync,
			renderVisibilitySyncPlan.fullReconcile,
		)
		this.canvas.runtimeScheduler.replaceViewportScaleLayoutEligibility(
			viewportScaleLayoutElementIds,
		)
		this.applyConsumerVisibilityStates(visibleConsumerIds, nearConsumerIds)

		const viewportCenter = getRectCenter(viewportRect)
		const promoteInitialVisibleLoads = this.shouldPromoteInitialVisibleLoads(reason)
		const canReuseMediaCache =
			isViewportMovementReason(reason) ||
			reason === "visibility:drain" ||
			reason === FAR_VISIBILITY_DRAIN_REFRESH_REASON
		const compatibleMediaCandidates = canReuseMediaCache
			? this.getCompatibleViewportMediaCandidates({
					geometryRevision: viewportSnapshot.geometryRevision,
					scaleBand,
					viewportScale,
				})
			: null
		const directMediaCandidates = this.createViewportMediaCandidateCache({
			compatibleCache: compatibleMediaCandidates,
			geometryRevision: viewportSnapshot.geometryRevision,
			scaleBand,
			viewportScale,
			viewportCenter,
			viewportRect,
			promoteInitialVisibleLoads,
			visibleImageIds: visibleIds,
			nearImageIds: nearIds,
			visibleVideoIds,
			nearVideoIds,
			visibleAudioIds,
			nearAudioIds,
		})
		// Container promotion removes direct candidates from these working arrays. Keep the cache's
		// direct lists untouched so the next motion refresh can incrementally reuse them.
		const visibleCandidates = directMediaCandidates.visibleCandidates.slice()
		const lowDetailVisibleCandidates = directMediaCandidates.lowDetailVisibleCandidates.slice()
		const nearCandidates = directMediaCandidates.nearCandidates.slice()
		const visibleVideoCandidates = directMediaCandidates.visibleVideoCandidates.slice()
		const lowDetailVisibleVideoCandidates =
			directMediaCandidates.lowDetailVisibleVideoCandidates.slice()
		const nearVideoCandidates = directMediaCandidates.nearVideoCandidates.slice()
		const visibleAudioCandidates = directMediaCandidates.visibleAudioCandidates.slice()
		const nearAudioCandidates = directMediaCandidates.nearAudioCandidates.slice()
		const frameAdjustedVideoIds = new Set<string>()
		const frameAdjustedAudioIds = new Set<string>()

		if (this.shouldScanVisibleContainerMedia(reason)) {
			const visibleContainerMediaCandidates = this.collectVisibleContainerMediaCandidates({
				reason,
				viewportRect,
				viewportScale,
				viewportCenter,
			})
			if (visibleContainerMediaCandidates.imageCandidates.length > 0) {
				const imageCandidates = visibleContainerMediaCandidates.imageCandidates.map(
					(candidate) => this.resolveImageCandidateForPresentationPhase(candidate),
				)
				const frameAdjustedImageIds = new Set(
					imageCandidates.map((candidate) => candidate.elementId),
				)
				removeCandidatesByIds(visibleCandidates, frameAdjustedImageIds)
				removeCandidatesByIds(lowDetailVisibleCandidates, frameAdjustedImageIds)
				removeCandidatesByIds(nearCandidates, frameAdjustedImageIds)
				visibleCandidates.push(...imageCandidates)
			}
			if (visibleContainerMediaCandidates.videoCandidates.length > 0) {
				visibleContainerMediaCandidates.videoCandidates.forEach((candidate) =>
					frameAdjustedVideoIds.add(candidate.elementId),
				)
				removeCandidatesByIds(visibleVideoCandidates, frameAdjustedVideoIds)
				removeCandidatesByIds(lowDetailVisibleVideoCandidates, frameAdjustedVideoIds)
				removeCandidatesByIds(nearVideoCandidates, frameAdjustedVideoIds)
				visibleVideoCandidates.push(...visibleContainerMediaCandidates.videoCandidates)
			}
			if (visibleContainerMediaCandidates.audioCandidates.length > 0) {
				visibleContainerMediaCandidates.audioCandidates.forEach((candidate) =>
					frameAdjustedAudioIds.add(candidate.elementId),
				)
				frameAdjustedAudioIds.forEach((elementId) => {
					visibleAudioIds.add(elementId)
					nearAudioIds.delete(elementId)
				})
				removeCandidatesByIds(visibleAudioCandidates, frameAdjustedAudioIds)
				removeCandidatesByIds(nearAudioCandidates, frameAdjustedAudioIds)
				visibleAudioCandidates.push(...visibleContainerMediaCandidates.audioCandidates)
			}
		}

		const presentationCandidates =
			this.imagePresentationPhase === "moving"
				? [...visibleCandidates, ...lowDetailVisibleCandidates]
				: [...visibleCandidates, ...lowDetailVisibleCandidates, ...nearCandidates]
		this.replaceImagePresentationTargets(presentationCandidates)
		this.updateImageRetentionHints(presentationCandidates, startedAt)
		const pendingVisibleCandidates = visibleCandidates.filter((candidate) =>
			this.shouldRequestImageCandidate(candidate, { reason }),
		)
		const pendingLowDetailVisibleCandidates = lowDetailVisibleCandidates.filter((candidate) =>
			this.shouldRequestImageCandidate(candidate, { reason }),
		)
		const pendingNearCandidates = nearCandidates.filter((candidate) =>
			this.shouldRequestImageCandidate(candidate, { reason }),
		)
		const pendingVisibleVideoCandidates = visibleVideoCandidates.filter((candidate) =>
			this.shouldRequestVideoCandidate(candidate),
		)
		const pendingLowDetailVisibleVideoCandidates = lowDetailVisibleVideoCandidates.filter(
			(candidate) => this.shouldRequestVideoCandidate(candidate),
		)
		const pendingNearVideoCandidates = nearVideoCandidates.filter((candidate) =>
			this.shouldRequestVideoCandidate(candidate),
		)
		const pendingVisibleAudioCandidates = visibleAudioCandidates.filter((candidate) =>
			this.shouldRequestAudioCandidate(candidate),
		)
		const pendingNearAudioCandidates = nearAudioCandidates.filter((candidate) =>
			this.shouldRequestAudioCandidate(candidate),
		)
		const shouldDeferNearLoads =
			this.imagePresentationPhase === "moving" ||
			isViewportMovementReason(reason) ||
			this.shouldDeferBootstrapNearLoads()

		const selectedImageLoads = this.selectImageCandidatesToLoad({
			pendingLowDetailVisibleCandidates,
			pendingNearCandidates,
			pendingVisibleCandidates,
			reason,
			shouldDeferNearLoads,
		})
		const admittedImageLoads = this.admitOrDowngradeFullCandidates([
			...selectedImageLoads.visibleToLoad,
			...selectedImageLoads.nearToLoad,
		])
		const visibleToLoad = admittedImageLoads.slice(0, selectedImageLoads.visibleToLoad.length)
		const nearToLoad = admittedImageLoads.slice(selectedImageLoads.visibleToLoad.length)
		const visibleVideosToLoad =
			pendingVisibleVideoCandidates.length > 0
				? pendingVisibleVideoCandidates
						.sort(sortCandidates)
						.slice(0, MAX_VISIBLE_VIDEO_LOAD_REQUESTS_PER_QUERY)
				: pendingLowDetailVisibleVideoCandidates
						.sort(sortCandidates)
						.slice(0, LOW_DETAIL_VISIBLE_VIDEO_FALLBACK_LIMIT)
		const nearVideosToLoad = shouldDeferNearLoads
			? []
			: pendingNearVideoCandidates
					.sort(sortCandidates)
					.slice(0, MAX_NEAR_VIDEO_LOAD_REQUESTS_PER_QUERY)
		const visibleAudiosToLoad = pendingVisibleAudioCandidates
			.sort(sortCandidates)
			.slice(0, MAX_VISIBLE_AUDIO_LOAD_REQUESTS_PER_QUERY)
		const nearAudiosToLoad = shouldDeferNearLoads
			? []
			: pendingNearAudioCandidates
					.sort(sortCandidates)
					.slice(0, MAX_NEAR_AUDIO_LOAD_REQUESTS_PER_QUERY)

		visibleToLoad.forEach((candidate) => this.requestImageLoad(candidate, reason))
		nearToLoad.forEach((candidate) => this.requestImageLoad(candidate, reason))
		visibleVideosToLoad.forEach((candidate) => this.requestVideoLoad(candidate, reason))
		nearVideosToLoad.forEach((candidate) => this.requestVideoLoad(candidate, reason))
		visibleAudiosToLoad.forEach((candidate) => this.requestAudioLoad(candidate, reason))
		nearAudiosToLoad.forEach((candidate) => this.requestAudioLoad(candidate, reason))

		const pendingImageLoadCandidateCount =
			pendingVisibleCandidates.length +
			pendingLowDetailVisibleCandidates.length +
			pendingNearCandidates.length
		const pendingVideoLoadCandidateCount =
			pendingVisibleVideoCandidates.length +
			pendingLowDetailVisibleVideoCandidates.length +
			pendingNearVideoCandidates.length
		const pendingAudioLoadCandidateCount =
			pendingVisibleAudioCandidates.length + pendingNearAudioCandidates.length
		const requestedImageLoadCount = visibleToLoad.length + nearToLoad.length
		const requestedVideoLoadCount = visibleVideosToLoad.length + nearVideosToLoad.length
		const requestedAudioLoadCount = visibleAudiosToLoad.length + nearAudiosToLoad.length
		this.scheduleDrainIfNeeded({
			pendingImageLoadCandidateCount,
			pendingVideoLoadCandidateCount,
			pendingAudioLoadCandidateCount,
			requestedImageLoadCount,
			requestedVideoLoadCount,
			requestedAudioLoadCount,
		})

		if (isViewportMovementReason(reason)) {
			this.scheduleFarVisibilityDrain()
		}
		if (renderVisibilitySyncPlan.shouldSync) {
			this.renderVisibilityController.sync({
				activeElementIds: renderActiveElementIds,
				allElementIds: renderElementIds,
				allowCullFar: renderVisibilitySyncPlan.allowCullFar,
				mode: renderVisibilitySyncPlan.fullReconcile ? "bootstrap" : "incremental",
				topologyRevision,
			})
		}
		const farCount = this.replaceMediaVisibilityStates(
			visibleIds,
			nearIds,
			this.activeImageIds,
			this.lastVisibilityState,
			this.registeredImages.size,
		)
		const farVideoCount = this.replaceMediaVisibilityStates(
			visibleVideoIds,
			nearVideoIds,
			this.activeVideoIds,
			this.lastVideoVisibilityState,
			this.registeredVideos.size,
		)
		const farAudioCount = this.updateAudioVisibilityStates(
			visibleAudioIds,
			nearAudioIds,
			farDrainReady,
		)
		const activeViewportResourceKeys = new Set<string>()
		const retainRegisteredResources = (
			registered: Map<
				string,
				RegisteredImageElement | RegisteredVideoElement | RegisteredAudioElement
			>,
			elementIds: Set<string>,
			mediaType: "image" | "video" | "audio",
		) => {
			elementIds.forEach((elementId) => {
				const resource = registered.get(elementId)
				if (!resource) return
				activeViewportResourceKeys.add(
					this.getViewportResourceAbortKey(mediaType, resource.path),
				)
			})
		}
		retainRegisteredResources(this.registeredImages, this.activeImageIds, "image")
		retainRegisteredResources(this.registeredVideos, this.activeVideoIds, "video")
		// 音频视口任务沿用三秒 far drain：移动期间先保留 path 级信号，
		// drain 确认仍为 far 后再取消排队/进行中的 metadata 预加载。保留现有 audio
		// controller 即可，不需要为了构造 active key 再遍历全部注册音频。
		retainRegisteredResources(this.registeredAudios, this.activeAudioIds, "audio")
		this.cancelFarViewportResourceSignals(activeViewportResourceKeys, {
			preserveAudio: !farDrainReady,
		})
		if (farDrainReady) {
			const retainedVideoPaths = new Set<string>()
			this.activeVideoIds.forEach((elementId) => {
				const registered = this.registeredVideos.get(elementId)
				if (registered) retainedVideoPaths.add(registered.path)
			})
			this.canvas.videoResourceManager?.enforcePosterBudget?.(retainedVideoPaths)
		}

		const durationMs = now() - startedAt
		const previousSnapshot = this.statsSnapshot
		this.statsSnapshot = {
			registeredImageCount: this.registeredImages.size,
			registeredVideoCount: this.registeredVideos.size,
			registeredAudioCount: this.registeredAudios.size,
			registerDedupedCount: previousSnapshot.registerDedupedCount,
			videoRegisterDedupedCount: previousSnapshot.videoRegisterDedupedCount,
			audioRegisterDedupedCount: previousSnapshot.audioRegisterDedupedCount,
			lowFallbackPreviewCount: previousSnapshot.lowFallbackPreviewCount,
			visibleImageCount: visibleIds.size,
			nearImageCount: nearIds.size,
			farImageCount: farCount,
			visibleVideoCount: visibleVideoIds.size,
			nearVideoCount: nearVideoIds.size,
			farVideoCount,
			visibleAudioCount: visibleAudioIds.size,
			nearAudioCount: nearAudioIds.size,
			farAudioCount,
			lastQueryDurationMs: durationMs,
			lastRequestedVisibleCount: visibleToLoad.length,
			lastRequestedNearCount: nearToLoad.length,
			lastRequestedVisibleVideoCount: visibleVideosToLoad.length,
			lastRequestedNearVideoCount: nearVideosToLoad.length,
			lastRequestedVisibleAudioCount: visibleAudiosToLoad.length,
			lastRequestedNearAudioCount: nearAudiosToLoad.length,
			lowDetailVisibleVideoCount: lowDetailVisibleVideoCandidates.length,
			pendingLowDetailVisibleVideoLoadCandidateCount:
				pendingLowDetailVisibleVideoCandidates.length,
			pendingImageLoadCandidateCount,
			pendingVideoLoadCandidateCount,
			pendingAudioLoadCandidateCount,
			drainScheduledCount: previousSnapshot.drainScheduledCount,
			drainRunCount: previousSnapshot.drainRunCount,
			lastViewportScale: viewportScale,
			lastViewportWidth: viewportRect.width,
			lastViewportHeight: viewportRect.height,
			skippedViewportQueryCount: previousSnapshot.skippedViewportQueryCount,
			queryCount: previousSnapshot.queryCount + 1,
		}

		if (
			reason === VIEWPORT_IDLE_MEDIA_REFRESH_REASON ||
			reason === FAR_VISIBILITY_DRAIN_REFRESH_REASON
		) {
			this.canvas.imageResourceManager?.enforceDecodedCacheBudget(`visibility:${reason}`)
		}
	}

	private resolveConsumerVisibilityState(elementId: string): CanvasConsumerVisibility {
		if (!this.canvas.elementManager.isElementVisibleInDataTree(elementId)) return "far"
		const snapshot = this.canvas.viewportQueryCoordinator.getSnapshot()
		if (snapshot.visibleElementIds.has(elementId)) return "visible"
		return snapshot.nearElementIds.has(elementId) ? "near" : "far"
	}

	private applyConsumerVisibilityStates(
		visibleIds: ReadonlySet<string>,
		nearIds: ReadonlySet<string>,
	): void {
		const applyState = (elementId: string, state: CanvasConsumerVisibility): void => {
			const listeners = this.consumerVisibilityListeners.get(elementId)
			if (!listeners) return
			if (this.lastConsumerVisibilityState.get(elementId) === state) return
			this.lastConsumerVisibilityState.set(elementId, state)
			listeners.forEach((listener) => listener(state))
		}

		this.activeConsumerIds.forEach((elementId) => {
			if (!visibleIds.has(elementId) && !nearIds.has(elementId)) {
				applyState(elementId, "far")
			}
		})
		visibleIds.forEach((elementId) => applyState(elementId, "visible"))
		nearIds.forEach((elementId) => applyState(elementId, "near"))

		this.activeConsumerIds.clear()
		visibleIds.forEach((elementId) => this.activeConsumerIds.add(elementId))
		nearIds.forEach((elementId) => this.activeConsumerIds.add(elementId))
	}

	private shouldRequestImageCandidate(
		candidate: ImageLoadCandidate,
		options?: { reason?: string },
	): boolean {
		const previousState = this.lastRequestedLoadState.get(candidate.elementId)
		if (!previousState) return true
		if (
			this.imagePresentationPhase === "moving" &&
			candidate.variant === "low" &&
			!this.getDisplayedImageVariant(candidate.elementId) &&
			previousState.variant !== "low"
		) {
			return true
		}
		const priorityImproved =
			getPriorityRank(previousState.priority) > getPriorityRank(candidate.priority)
		const elapsedSinceLastRequest = now() - previousState.requestedAt
		if (
			previousState.variant !== candidate.variant &&
			elapsedSinceLastRequest < IMAGE_VARIANT_SWITCH_COOLDOWN_MS
		) {
			if (
				(options?.reason === VIEWPORT_IDLE_MEDIA_REFRESH_REASON ||
					options?.reason === IMAGE_LOW_FALLBACK_REFRESH_REASON) &&
				getImageVariantRank(candidate.variant) > getImageVariantRank(previousState.variant)
			) {
				return true
			}
			if (!(priorityImproved && candidate.priority === "critical")) {
				this.scheduleVariantSwitchCooldownRefresh(
					IMAGE_VARIANT_SWITCH_COOLDOWN_MS - elapsedSinceLastRequest,
				)
			}
			return priorityImproved && candidate.priority === "critical"
		}
		return previousState.variant !== candidate.variant || priorityImproved
	}

	private shouldRequestVideoCandidate(candidate: VideoLoadCandidate): boolean {
		const previousState = this.lastRequestedVideoLoadState.get(candidate.elementId)
		if (!previousState) return true
		const tierImproved =
			getVideoLoadTierRank(previousState.tier) > getVideoLoadTierRank(candidate.tier)
		if (tierImproved) return true
		if (previousState.tier !== candidate.tier) return false
		return getPriorityRank(previousState.priority) > getPriorityRank(candidate.priority)
	}

	private shouldRequestAudioCandidate(candidate: AudioLoadCandidate): boolean {
		const previousState = this.lastRequestedAudioLoadState.get(candidate.elementId)
		if (!previousState) return true
		const tierImproved =
			getAudioLoadTierRank(previousState.tier) > getAudioLoadTierRank(candidate.tier)
		if (tierImproved) return true
		if (previousState.tier !== candidate.tier) return false
		return getPriorityRank(previousState.priority) > getPriorityRank(candidate.priority)
	}

	/**
	 * Update only elements that are active now or were active in the previous viewport coverage.
	 * Registered far elements never enter this loop, keeping viewport work proportional to the
	 * spatial result instead of the document size.
	 */
	private replaceMediaVisibilityStates(
		visibleIds: ReadonlySet<string>,
		nearIds: ReadonlySet<string>,
		previousActiveIds: Set<string>,
		states: Map<string, VisibilityState>,
		registeredCount: number,
	): number {
		previousActiveIds.forEach((elementId) => {
			if (!visibleIds.has(elementId) && !nearIds.has(elementId)) {
				states.set(elementId, "far")
			}
		})
		visibleIds.forEach((elementId) => {
			if (states.get(elementId) !== "visible") states.set(elementId, "visible")
		})
		nearIds.forEach((elementId) => {
			if (states.get(elementId) !== "near") states.set(elementId, "near")
		})

		previousActiveIds.clear()
		visibleIds.forEach((elementId) => previousActiveIds.add(elementId))
		nearIds.forEach((elementId) => previousActiveIds.add(elementId))
		return Math.max(0, registeredCount - previousActiveIds.size)
	}

	private updateAudioVisibilityStates(
		visibleAudioIds: ReadonlySet<string>,
		nearAudioIds: ReadonlySet<string>,
		farDrainReady: boolean,
	): number {
		const farAudioCount = this.replaceMediaVisibilityStates(
			visibleAudioIds,
			nearAudioIds,
			this.activeAudioIds,
			this.lastAudioVisibilityState,
			this.registeredAudios.size,
		)
		if (farDrainReady) {
			this.viewportPreloadedAudioIds.forEach((elementId) => {
				if (this.activeAudioIds.has(elementId)) return
				this.canvas.audioPlaybackManager.releaseViewportPreload(elementId)
				this.viewportPreloadedAudioIds.delete(elementId)
			})
		}
		if (farAudioCount > 0 && !farDrainReady) {
			// 元素自身被拖出视口也只会触发 element:change，而不是 viewport:pan。
			// 此处确保这类 far 音频同样进入三秒 drain，避免视口会话永久滞留。
			this.scheduleFarVisibilityDrain()
		}
		return farAudioCount
	}

	private selectImageCandidatesToLoad(options: {
		pendingVisibleCandidates: ImageLoadCandidate[]
		pendingLowDetailVisibleCandidates: ImageLoadCandidate[]
		pendingNearCandidates: ImageLoadCandidate[]
		reason: string
		shouldDeferNearLoads: boolean
	}): {
		visibleToLoad: ImageLoadCandidate[]
		nearToLoad: ImageLoadCandidate[]
		imageLoadRequestBudget: number | null
	} {
		const {
			pendingLowDetailVisibleCandidates,
			pendingNearCandidates,
			pendingVisibleCandidates,
			reason,
			shouldDeferNearLoads,
		} = options
		const imageLoadRequestBudget = getBackgroundImageLoadRequestBudget(reason)
		const visibleRequestLimit = imageLoadRequestBudget ?? MAX_VISIBLE_LOAD_REQUESTS_PER_QUERY
		const visibleToLoad =
			pendingVisibleCandidates.length > 0
				? pendingVisibleCandidates
						.sort(sortCandidates)
						.slice(
							0,
							Math.min(MAX_VISIBLE_LOAD_REQUESTS_PER_QUERY, visibleRequestLimit),
						)
				: pendingLowDetailVisibleCandidates
						.sort(sortCandidates)
						.slice(0, Math.min(LOW_DETAIL_VISIBLE_FALLBACK_LIMIT, visibleRequestLimit))
		const remainingImageRequestBudget =
			imageLoadRequestBudget === null
				? MAX_NEAR_LOAD_REQUESTS_PER_QUERY
				: Math.max(0, imageLoadRequestBudget - visibleToLoad.length)
		const nearToLoad =
			shouldDeferNearLoads || remainingImageRequestBudget <= 0
				? []
				: pendingNearCandidates
						.sort(sortCandidates)
						.slice(
							0,
							Math.min(MAX_NEAR_LOAD_REQUESTS_PER_QUERY, remainingImageRequestBudget),
						)

		return { imageLoadRequestBudget, nearToLoad, visibleToLoad }
	}

	private admitOrDowngradeFullCandidates(candidates: ImageLoadCandidate[]): ImageLoadCandidate[] {
		if (!candidates.some((candidate) => candidate.variant === "full")) return candidates

		const imageResourceManager = this.canvas.imageResourceManager as
			| {
					getFullAdmissionSnapshot?: () => {
						fullDecodedBytes: number
						fullLoadingCount: number
						fullBudgetBytes: number
					}
			  }
			| undefined
		const snapshot = imageResourceManager?.getFullAdmissionSnapshot?.()
		const fullLoadingCount = snapshot?.fullLoadingCount ?? 0
		const fullBudgetReached = snapshot
			? snapshot.fullDecodedBytes >= snapshot.fullBudgetBytes
			: false
		const refreshLimit = fullBudgetReached ? 1 : MAX_FULL_LOAD_REQUESTS_PER_REFRESH
		let remainingFullAdmissions = Math.max(
			0,
			Math.min(refreshLimit, MAX_FULL_LOADING_REQUESTS - fullLoadingCount),
		)
		const admittedFullCandidates = new Set(
			candidates
				.map((candidate, index) => ({ candidate, index }))
				.filter(({ candidate }) => candidate.variant === "full")
				.sort((left, right) => {
					const diff = sortFullAdmissionCandidates(left.candidate, right.candidate)
					return diff !== 0 ? diff : left.index - right.index
				})
				.slice(0, remainingFullAdmissions)
				.map(({ candidate }) => candidate),
		)
		remainingFullAdmissions = admittedFullCandidates.size

		return candidates.map((candidate) => {
			if (candidate.variant !== "full") return candidate
			if (admittedFullCandidates.has(candidate) && remainingFullAdmissions > 0) {
				remainingFullAdmissions -= 1
				return candidate
			}
			return {
				...candidate,
				variant: "preview",
			}
		})
	}

	private scheduleDrainIfNeeded(options: {
		pendingImageLoadCandidateCount: number
		pendingVideoLoadCandidateCount: number
		pendingAudioLoadCandidateCount: number
		requestedImageLoadCount: number
		requestedVideoLoadCount: number
		requestedAudioLoadCount: number
	}): void {
		if (this.destroyed || this.drainTimerId !== null) return
		const hasMoreImages =
			options.pendingImageLoadCandidateCount > options.requestedImageLoadCount
		const hasMoreVideos =
			options.pendingVideoLoadCandidateCount > options.requestedVideoLoadCount
		const hasMoreAudios =
			options.pendingAudioLoadCandidateCount > options.requestedAudioLoadCount
		if (!hasMoreImages && !hasMoreVideos && !hasMoreAudios) return
		if (
			this.shouldDeferBootstrapNearLoads() &&
			hasMoreImages &&
			!hasMoreVideos &&
			!hasMoreAudios
		) {
			return
		}

		this.statsSnapshot.drainScheduledCount += 1
		const delayMs =
			hasMoreImages && !hasMoreVideos && !hasMoreAudios
				? IMAGE_ONLY_DRAIN_DELAY_MS
				: VISIBILITY_DRAIN_DELAY_MS
		this.drainTimerId = setTimeout(() => {
			this.drainTimerId = null
			this.scheduleRefresh("visibility:drain", true)
		}, delayMs)
	}

	private scheduleFarVisibilityDrain(): void {
		if (this.destroyed) return
		this.cancelFarVisibilityDrain()
		const movementAtSchedule = this.lastViewportMovementAt
		this.farVisibilityDrainTimerId = setTimeout(() => {
			this.farVisibilityDrainTimerId = null
			if (this.destroyed || movementAtSchedule !== this.lastViewportMovementAt) return
			this.scheduleRefresh(FAR_VISIBILITY_DRAIN_REFRESH_REASON, true)
		}, FAR_VISIBILITY_DRAIN_GRACE_MS)
	}

	private suppressContentLayerHitGraphDuringViewportMovement(): void {
		if (this.destroyed) return
		const layer = this.canvas.contentLayer
		if (!this.contentLayerHitGraphSuppressed) {
			this.contentLayerHitGraphSuppressed = true
			this.contentLayerPreviousListening = layer.listening()
			if (this.contentLayerPreviousListening) {
				// Konva keeps a hit graph for event detection. During continuous pan/scale we
				// do not need content-node picking, so disabling it avoids hit-canvas work.
				layer.listening(false)
			}
		}

		if (this.contentLayerHitGraphRestoreTimerId !== null) {
			clearTimeout(this.contentLayerHitGraphRestoreTimerId)
		}
		this.contentLayerHitGraphRestoreTimerId = setTimeout(() => {
			this.contentLayerHitGraphRestoreTimerId = null
			this.restoreContentLayerHitGraph()
		}, CONTENT_LAYER_HIT_GRAPH_RESTORE_DELAY_MS)
	}

	private restoreContentLayerHitGraph(): void {
		if (!this.contentLayerHitGraphSuppressed) return
		const shouldRestoreListening = this.contentLayerPreviousListening === true
		this.contentLayerHitGraphSuppressed = false
		this.contentLayerPreviousListening = null
		if (!shouldRestoreListening) return

		this.canvas.contentLayer.listening(true)
		this.canvas.contentLayer.batchDraw()
	}

	private shouldPromoteInitialVisibleLoads(reason: string): boolean {
		if (now() > this.initialVisibleCriticalUntil) return false
		return (
			reason === "document:loaded" ||
			reason === "image:register" ||
			reason === "audio:register" ||
			reason === "viewport:pan" ||
			reason === "viewport:scale" ||
			reason === "visibility:drain" ||
			reason === FAR_VISIBILITY_DRAIN_REFRESH_REASON
		)
	}

	private shouldDeferBootstrapNearLoads(): boolean {
		return this.bootstrapNearHydrationAt > 0 && now() < this.bootstrapNearHydrationAt
	}

	private shouldScanVisibleContainerMedia(reason: string): boolean {
		return (
			reason === "document:loaded" ||
			reason === "image:register" ||
			reason === "audio:register" ||
			reason === "viewport:pan" ||
			reason === "viewport:scale" ||
			reason === "visibility:drain" ||
			reason === FAR_VISIBILITY_DRAIN_REFRESH_REASON
		)
	}

	private createCandidate(
		elementId: string,
		visibilityState: "visible" | "near",
		viewportScale: number,
		viewportCenter: { x: number; y: number },
		priorityOverride?: ImageResourceLoadPriority,
		viewportRect?: Rect,
		dataTreeVisibilityConfirmed = false,
	): ImageLoadCandidate | null {
		const registered = this.registeredImages.get(elementId)
		if (!registered) return null
		// Visible/near IDs from the shared viewport snapshot have already passed the data-tree
		// visibility filter. Keep the fallback check for any future callers that do not provide that
		// snapshot guarantee.
		if (
			!dataTreeVisibilityConfirmed &&
			!this.canvas.elementManager.isElementVisibleInDataTree(elementId)
		)
			return null

		const bounds = this.canvas.geometryCacheManager.getElementBounds(elementId)
		if (!bounds) return null
		const screenWidth = Math.max(0, bounds.width * viewportScale)
		const screenHeight = Math.max(0, bounds.height * viewportScale)
		const screenLongEdge = Math.max(screenWidth, screenHeight)
		const screenArea = screenWidth * screenHeight
		const priority: ImageResourceLoadPriority =
			priorityOverride ?? (visibilityState === "visible" ? "visible" : "near")
		const frameDisplayVariant =
			visibilityState === "visible" && viewportRect
				? this.getVisibleClippingContainerDisplayVariant({
						elementId,
						viewportRect,
						viewportScale,
					})
				: undefined
		const viewingDecision = decideImageDisplayViewingLevel({
			visibilityState,
			screenArea,
			screenLongEdge,
			previousVariant: this.getPreviousImageDisplayVariant(elementId),
		})
		const variant = maxImageResourceVariant(viewingDecision.variant, frameDisplayVariant)

		return {
			elementId,
			path: registered.path,
			priority,
			variant,
			visibilityState,
			screenArea,
			screenLongEdge,
			distanceToViewportCenter: getDistance(getRectCenter(bounds), viewportCenter),
		}
	}

	private getVisibleClippingContainerDisplayVariant(options: {
		elementId: string
		viewportRect: Rect
		viewportScale: number
	}): MediaDisplayResourceVariant | undefined {
		let parentId = this.canvas.elementManager.findParentIdForElement(options.elementId)

		while (parentId) {
			const parentElement = this.canvas.elementManager.getElementData(parentId)
			if (!parentElement) return undefined

			if (isClippingContainer(parentElement)) {
				const parentBounds = this.canvas.geometryCacheManager.getElementBounds(parentId)
				if (!parentBounds) return undefined
				return this.resolveFrameDisplayVariant({
					containerId: parentId,
					clipBounds: parentBounds,
					viewportRect: options.viewportRect,
					viewportScale: options.viewportScale,
				})
			}

			parentId = this.canvas.elementManager.findParentIdForElement(parentId)
		}

		return undefined
	}

	private resolveFrameDisplayVariant(options: {
		containerId: string
		clipBounds: Rect
		viewportRect: Rect
		viewportScale: number
	}): MediaDisplayResourceVariant | undefined {
		return this.decideContainerDisplayVariant({
			containerId: options.containerId,
			containerVisibleBounds: getIntersectionRect(options.clipBounds, options.viewportRect),
			viewportScale: options.viewportScale,
		})
	}

	private collectVisibleContainerMediaCandidates(options: {
		reason: string
		viewportRect: Rect
		viewportScale: number
		viewportCenter: { x: number; y: number }
	}): {
		imageCandidates: ImageLoadCandidate[]
		videoCandidates: VideoLoadCandidate[]
		audioCandidates: AudioLoadCandidate[]
	} {
		const { rootContainerIds } = this.getContainerRootCache()
		if (rootContainerIds.length === 0) {
			return { imageCandidates: [], videoCandidates: [], audioCandidates: [] }
		}

		const visibleContainerIds = this.canvas.geometryCacheManager.queryElementIdsByExpandedRect(
			options.viewportRect,
			0,
			{ elementIds: rootContainerIds },
		)
		if (visibleContainerIds.length === 0) {
			return { imageCandidates: [], videoCandidates: [], audioCandidates: [] }
		}

		const imageCandidates: ImageLoadCandidate[] = []
		const videoCandidates: VideoLoadCandidate[] = []
		const audioCandidates: AudioLoadCandidate[] = []
		const queuedMediaIds = new Set<string>()

		const visit = (
			element: LayerElement,
			parentTransform: {
				bounds: Rect
				scaleX: number
				scaleY: number
				clipBounds: Rect
				frameDisplayVariant?: MediaDisplayResourceVariant
			},
			parentDataTreeVisible: boolean,
		): void => {
			if (
				imageCandidates.length + videoCandidates.length + audioCandidates.length >=
				MAX_INITIAL_VISIBLE_CONTAINER_MEDIA_REQUESTS
			) {
				return
			}
			// The root container check below already validates its complete ancestor chain. For
			// descendants, only the node's own flag can change the inherited result; walking the
			// same parent chain for every media child turns nested-frame traversal into quadratic work.
			if (!parentDataTreeVisible || element.visible === false) {
				return
			}

			if (element.type === ElementTypeEnum.Image) {
				if (queuedMediaIds.has(element.id)) {
					return
				}
				const registered = this.registeredImages.get(element.id)
				const effectiveContent = this.canvas.getEffectiveContent?.(element.id) as
					{ src?: string } | undefined
				const path =
					registered?.path ?? effectiveContent?.src ?? getActiveImageContent(element).src
				if (!path) {
					return
				}

				const elementBounds = this.getElementDataBoundsInCanvas(element, parentTransform)
				if (!elementBounds) {
					return
				}
				const clippedBounds = getIntersectionRect(elementBounds, parentTransform.clipBounds)
				if (!clippedBounds) {
					return
				}
				const visibleBounds = getIntersectionRect(clippedBounds, options.viewportRect)
				if (!visibleBounds) {
					return
				}
				const screenArea = getArea(visibleBounds) * options.viewportScale ** 2
				const screenLongEdge =
					Math.max(visibleBounds.width, visibleBounds.height) * options.viewportScale
				if (screenArea <= 0) {
					return
				}
				const viewingDecision = decideImageDisplayViewingLevel({
					visibilityState: "visible",
					screenArea,
					screenLongEdge,
					previousVariant: this.getPreviousImageDisplayVariant(element.id),
				})
				const variant = maxImageResourceVariant(
					viewingDecision.variant,
					parentTransform.frameDisplayVariant,
				)
				queuedMediaIds.add(element.id)
				imageCandidates.push({
					elementId: element.id,
					path,
					priority: "critical",
					variant,
					visibilityState: "visible",
					screenArea,
					screenLongEdge,
					distanceToViewportCenter: getDistance(
						getRectCenter(visibleBounds),
						options.viewportCenter,
					),
					frameAdjustedBounds: elementBounds,
					frameVisibleBounds: visibleBounds,
				})
				return
			}

			if (element.type === ElementTypeEnum.Video) {
				if (queuedMediaIds.has(element.id)) {
					return
				}
				const registered = this.registeredVideos.get(element.id)
				const path =
					(this.canvas.getEffectiveContent?.(element.id) as { src?: string } | undefined)
						?.src ?? registered?.path
				if (!path) {
					return
				}

				const elementBounds = this.getElementDataBoundsInCanvas(element, parentTransform)
				if (!elementBounds) {
					return
				}
				const clippedBounds = getIntersectionRect(elementBounds, parentTransform.clipBounds)
				if (!clippedBounds) {
					return
				}
				const visibleBounds = getIntersectionRect(clippedBounds, options.viewportRect)
				if (!visibleBounds) {
					return
				}
				const screenArea = getArea(visibleBounds) * options.viewportScale ** 2
				const screenLongEdge =
					Math.max(visibleBounds.width, visibleBounds.height) * options.viewportScale
				if (screenArea <= 0) {
					return
				}

				queuedMediaIds.add(element.id)
				videoCandidates.push({
					elementId: element.id,
					path,
					priority: "critical",
					tier: "poster",
					visibilityState: "visible",
					screenArea,
					screenLongEdge,
					distanceToViewportCenter: getDistance(
						getRectCenter(visibleBounds),
						options.viewportCenter,
					),
					frameAdjustedBounds: elementBounds,
					frameVisibleBounds: visibleBounds,
				})
				return
			}

			if (element.type === ElementTypeEnum.Audio) {
				if (queuedMediaIds.has(element.id)) return
				const registered = this.registeredAudios.get(element.id)
				const path =
					(this.canvas.getEffectiveContent?.(element.id) as { src?: string } | undefined)
						?.src ?? registered?.path
				if (!path) return

				const elementBounds = this.getElementDataBoundsInCanvas(element, parentTransform)
				if (!elementBounds) return
				const clippedBounds = getIntersectionRect(elementBounds, parentTransform.clipBounds)
				if (!clippedBounds) return
				const visibleBounds = getIntersectionRect(clippedBounds, options.viewportRect)
				if (!visibleBounds) return
				const screenArea = getArea(visibleBounds) * options.viewportScale ** 2
				const screenLongEdge =
					Math.max(visibleBounds.width, visibleBounds.height) * options.viewportScale
				if (screenArea <= 0) return

				queuedMediaIds.add(element.id)
				audioCandidates.push({
					elementId: element.id,
					path,
					priority: "critical",
					tier: "preload",
					visibilityState: "visible",
					screenArea,
					screenLongEdge,
					distanceToViewportCenter: getDistance(
						getRectCenter(visibleBounds),
						options.viewportCenter,
					),
					frameAdjustedBounds: elementBounds,
					frameVisibleBounds: visibleBounds,
				})
				return
			}

			if (hasChildren(element)) {
				const elementBounds = this.getElementDataBoundsInCanvas(element, parentTransform)
				if (!elementBounds) {
					return
				}
				const clipBounds = isClippingContainer(element)
					? (getIntersectionRect(parentTransform.clipBounds, elementBounds) ?? {
							x: 0,
							y: 0,
							width: 0,
							height: 0,
						})
					: parentTransform.clipBounds
				const frameDisplayVariant = isClippingContainer(element)
					? this.resolveFrameDisplayVariant({
							containerId: element.id,
							clipBounds,
							viewportRect: options.viewportRect,
							viewportScale: options.viewportScale,
						})
					: parentTransform.frameDisplayVariant
				const scaleX = parentTransform.scaleX * (element.scaleX ?? 1)
				const scaleY = parentTransform.scaleY * (element.scaleY ?? 1)
				element.children.forEach((child) =>
					visit(
						child,
						{
							bounds: elementBounds,
							scaleX,
							scaleY,
							clipBounds,
							frameDisplayVariant,
						},
						true,
					),
				)
			}
		}

		visibleContainerIds.forEach((containerId) => {
			const container = this.canvas.elementManager.getElementData(containerId)
			if (!container || !hasChildren(container)) {
				return
			}
			if (!this.canvas.elementManager.isElementVisibleInDataTree(container.id)) {
				return
			}
			const containerBounds = this.canvas.geometryCacheManager.getElementBounds(containerId)
			if (!containerBounds) {
				return
			}
			const width = container.width ?? containerBounds.width
			const height = container.height ?? containerBounds.height
			const scaleX = width > 0 ? containerBounds.width / width : 1
			const scaleY = height > 0 ? containerBounds.height / height : 1
			const clipBounds = isClippingContainer(container)
				? containerBounds
				: (getIntersectionRect(containerBounds, options.viewportRect) ?? containerBounds)
			const frameDisplayVariant = isClippingContainer(container)
				? this.resolveFrameDisplayVariant({
						containerId: container.id,
						clipBounds,
						viewportRect: options.viewportRect,
						viewportScale: options.viewportScale,
					})
				: undefined
			container.children.forEach((child) =>
				visit(
					child,
					{
						bounds: containerBounds,
						scaleX,
						scaleY,
						clipBounds,
						frameDisplayVariant,
					},
					true,
				),
			)
		})

		return { imageCandidates, videoCandidates, audioCandidates }
	}

	private decideContainerDisplayVariant(options: {
		containerId: string
		containerVisibleBounds: Rect | null
		viewportScale: number
	}): MediaDisplayResourceVariant | undefined {
		const { containerId, containerVisibleBounds, viewportScale } = options
		if (!containerVisibleBounds) return undefined
		const screenArea = getArea(containerVisibleBounds) * viewportScale ** 2
		if (screenArea <= 0) return undefined
		const screenLongEdge =
			Math.max(containerVisibleBounds.width, containerVisibleBounds.height) * viewportScale
		const decision = decideImageDisplayViewingLevel({
			visibilityState: "visible",
			screenArea,
			screenLongEdge,
			previousVariant: this.lastContainerDisplayVariant.get(containerId),
		})
		const displayVariant = toMediaDisplayResourceVariant(decision.variant)
		this.lastContainerDisplayVariant.set(containerId, displayVariant)
		return displayVariant
	}

	private getElementDataBoundsInCanvas(
		element: LayerElement,
		parentTransform: {
			bounds: Rect
			scaleX: number
			scaleY: number
			clipBounds: Rect
		},
	): Rect | null {
		const width = element.width ?? 0
		const height = element.height ?? 0
		if (width <= 0 || height <= 0) return null
		const scaleX = parentTransform.scaleX * (element.scaleX ?? 1)
		const scaleY = parentTransform.scaleY * (element.scaleY ?? 1)
		return {
			x: parentTransform.bounds.x + (element.x ?? 0) * parentTransform.scaleX,
			y: parentTransform.bounds.y + (element.y ?? 0) * parentTransform.scaleY,
			width: width * scaleX,
			height: height * scaleY,
		}
	}

	private createVideoCandidate(
		elementId: string,
		visibilityState: "visible" | "near",
		viewportScale: number,
		viewportCenter: { x: number; y: number },
		tier: VideoLoadTier,
		dataTreeVisibilityConfirmed = false,
	): VideoLoadCandidate | null {
		const registered = this.registeredVideos.get(elementId)
		if (!registered) return null
		if (
			!dataTreeVisibilityConfirmed &&
			!this.canvas.elementManager.isElementVisibleInDataTree(elementId)
		)
			return null

		const bounds = this.canvas.geometryCacheManager.getElementBounds(elementId)
		if (!bounds) return null
		const screenWidth = Math.max(0, bounds.width * viewportScale)
		const screenHeight = Math.max(0, bounds.height * viewportScale)
		const screenLongEdge = Math.max(screenWidth, screenHeight)
		const screenArea = screenWidth * screenHeight
		const priority: ImageResourceLoadPriority =
			visibilityState === "visible" ? "visible" : "near"

		return {
			elementId,
			path: registered.path,
			priority,
			tier,
			visibilityState,
			screenArea,
			screenLongEdge,
			distanceToViewportCenter: getDistance(getRectCenter(bounds), viewportCenter),
		}
	}

	private createAudioCandidate(
		elementId: string,
		visibilityState: "visible" | "near",
		viewportScale: number,
		viewportCenter: { x: number; y: number },
		tier: AudioLoadTier,
		dataTreeVisibilityConfirmed = false,
	): AudioLoadCandidate | null {
		const registered = this.registeredAudios.get(elementId)
		if (!registered) return null
		if (
			!dataTreeVisibilityConfirmed &&
			!this.canvas.elementManager.isElementVisibleInDataTree(elementId)
		)
			return null

		const bounds = this.canvas.geometryCacheManager.getElementBounds(elementId)
		if (!bounds) return null
		const screenWidth = Math.max(0, bounds.width * viewportScale)
		const screenHeight = Math.max(0, bounds.height * viewportScale)
		const screenLongEdge = Math.max(screenWidth, screenHeight)
		const screenArea = screenWidth * screenHeight
		const priority: ImageResourceLoadPriority =
			visibilityState === "visible" ? "visible" : "near"

		return {
			elementId,
			path: registered.path,
			priority,
			tier,
			visibilityState,
			screenArea,
			screenLongEdge,
			distanceToViewportCenter: getDistance(getRectCenter(bounds), viewportCenter),
		}
	}

	private requestImageLoad(candidate: ImageLoadCandidate, reason: string, force = false): void {
		const previousState = this.lastRequestedLoadState.get(candidate.elementId)
		if (
			!force &&
			previousState &&
			previousState.variant === candidate.variant &&
			getPriorityRank(previousState.priority) <= getPriorityRank(candidate.priority)
		) {
			return
		}
		const signal = isViewportResourceBoundReason(reason)
			? this.getViewportResourceSignal("image", candidate.path, candidate.elementId)
			: undefined

		this.lastRequestedLoadState.set(candidate.elementId, {
			priority: candidate.priority,
			variant: candidate.variant,
			requestedAt: now(),
		})
		const loadOptions = {
			variant: candidate.variant,
			priority: candidate.priority,
			displayTargetElementId: candidate.elementId,
			displayTargetReason: reason,
			...(signal
				? {
						signal,
					}
				: {}),
		}
		void this.canvas.imageResourceManager.loadResource(candidate.path, loadOptions)
	}

	private requestVideoLoad(candidate: VideoLoadCandidate, reason: string, force = false): void {
		const previousState = this.lastRequestedVideoLoadState.get(candidate.elementId)
		if (
			!force &&
			previousState &&
			previousState.tier === candidate.tier &&
			getPriorityRank(previousState.priority) <= getPriorityRank(candidate.priority)
		) {
			return
		}

		if (candidate.tier === "url") {
			const signal = isViewportResourceBoundReason(reason)
				? this.getViewportResourceSignal("video", candidate.path, candidate.elementId)
				: undefined
			this.lastRequestedVideoLoadState.set(candidate.elementId, {
				priority: candidate.priority,
				tier: candidate.tier,
				requestedAt: now(),
			})
			void this.canvas.videoResourceManager.ensureFreshOssInfo(candidate.path, {
				allowCachedFallback: true,
				priority: candidate.priority,
				...(signal ? { signal } : {}),
			})
			return
		}

		const element = this.canvas.elementManager.getElementInstance(candidate.elementId) as
			| {
					requestPreviewLoad?: (options?: {
						force?: boolean
						priority?: ImageResourceLoadPriority
						signal?: AbortSignal
					}) => void
			  }
			| undefined
		if (!element?.requestPreviewLoad) return
		const signal = isViewportResourceBoundReason(reason)
			? this.getViewportResourceSignal("video", candidate.path, candidate.elementId)
			: undefined

		this.lastRequestedVideoLoadState.set(candidate.elementId, {
			priority: candidate.priority,
			tier: candidate.tier,
			requestedAt: now(),
		})
		element.requestPreviewLoad({
			force,
			...(signal
				? {
						priority: candidate.priority,
						signal,
					}
				: {}),
		})
	}

	private requestAudioLoad(candidate: AudioLoadCandidate, _reason: string, force = false): void {
		// 本方法只由 Visibility Manager 调用；document load、register、idle drain 等
		// 同样属于视口预加载，必须共享可在 far drain 时取消的 path 级信号。
		const previousState = this.lastRequestedAudioLoadState.get(candidate.elementId)
		if (
			!force &&
			previousState &&
			previousState.tier === candidate.tier &&
			getPriorityRank(previousState.priority) <= getPriorityRank(candidate.priority)
		) {
			return
		}
		const signal = this.getViewportResourceSignal("audio", candidate.path, candidate.elementId)

		this.lastRequestedAudioLoadState.set(candidate.elementId, {
			priority: candidate.priority,
			tier: candidate.tier,
			requestedAt: now(),
		})
		if (candidate.tier === "url") {
			void this.canvas.audioResourceManager.getResource(candidate.path, {
				allowCachedFallback: true,
				priority: candidate.priority,
				signal,
			})
			return
		}

		this.viewportPreloadedAudioIds.add(candidate.elementId)
		void this.canvas.audioPlaybackManager
			.prepare(candidate.elementId, candidate.path, {
				source: "viewport",
				priority: candidate.priority,
				signal,
			})
			.then((prepared) => {
				if (!prepared || signal.aborted) return
				void this.canvas.audioWaveformManager?.prepare(candidate.path, {
					priority: candidate.priority,
					signal,
				})
			})
	}
}
