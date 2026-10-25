import {
	createImageSourceFromBlob,
	closeImageSource,
	getImageSourceDimensions,
	type ImageSource,
} from "./imageSourceUtils"
import type { Canvas } from "../../core/Canvas"
import { ImageElement } from "../../elements/image/ImageElement"
import { ElementTypeEnum } from "../../document/types"
import type { ImageElement as ImageElementData } from "../../document/types"
import { getImageContents } from "../../document/elementContent"
import type {
	ImageResourceDecodeVariant,
	ImageResourceWorkerRequest,
	ImageResourceWorkerResponse,
} from "./imageResource.worker"
import type { AttachmentSourceEnum, GetFileInfoResponse } from "../../../public/magic-types"
import {
	getFailureReasonFromStatusCode,
	type ResourceLoadFailureReason,
} from "../media-common/resourceLoadFailure"
import {
	acquireImageResourceWorkerClient,
	type ImageResourceWorkerClientLease,
} from "./ImageResourceWorkerClient"
import {
	MEDIA_DISPLAY_RESOURCE_VARIANTS,
	getImageResourceMaxEdge,
	type MediaDisplayResourceVariant,
} from "../visibility/CanvasMediaViewingPolicy"
import { parseImageDimensionsFromBlobHeader } from "./imageHeaderDimensions"
import type { ImageExifOrientation } from "./imageOrientation"
import {
	buildImageResourceSnapshot,
	createImageResourceDiagnostics,
	type ImageResourceSnapshot,
	type ImageResourceCurrentSnapshot,
} from "../diagnostics/CanvasResourceDiagnostics"
import {
	MediaResourceUrlLifecycle,
	type MediaResourceUrlEntry,
} from "../offline-cache/MediaResourceUrlLifecycle"
import {
	DEFAULT_MEDIA_DECODE_CONCURRENT_PIXEL_BUDGET,
	MediaDecodePixelBudgetGate,
	estimateScaledPixelCost,
	getFallbackDecodePixelCost,
	getMediaDecodePriorityRank,
	type MediaDecodePriority,
} from "../offline-cache/MediaDecodePixelBudget"
import {
	MediaResourceBodyCache,
	type MediaResourceBody,
	type MediaResourceBodyCacheEntry,
} from "../offline-cache/MediaResourceBodyCache"
import { SharedAbortableRequest } from "../offline-cache/SharedAbortableRequest"
import { ImageDisplayVariantPersistentCache } from "./ImageDisplayVariantPersistentCache"
import { resolveCanvasImageDecodedCacheBudgets } from "./CanvasImageCachePolicy"
import type { DecodedImageRetentionHint } from "../visibility/CanvasVisibilityManager"
import {
	buildSharedMediaStorageScope,
	getCanvasResourceAvailability,
	type CanvasResourceReferenceResolverChangeOptions,
} from "../../shared/path/canvasResourcePath"

export type { ImageSource }
export type ImageResourceVariant = ImageResourceDecodeVariant
type ImageDisplayResourceVariant = Extract<ImageResourceVariant, MediaDisplayResourceVariant>

function createImageAbortError(): Error {
	const error = new Error("Image resource request aborted")
	error.name = "AbortError"
	return error
}

/**
 * 图片信息接口
 */
export interface ImageInfo {
	naturalWidth: number
	naturalHeight: number
	orientation?: ImageExifOrientation
	encodedWidth?: number
	encodedHeight?: number
	fileSize: number
	mimeType: string
	filename: string
}

/**
 * 已加载的图片资源（getResource 的返回类型）
 */
export interface LoadedResource {
	/** OSS 地址，用于 fetch、复制等 */
	ossSrc: string
	/** 加载好的图片对象 */
	image: ImageSource
	/** 图片元信息 */
	imageInfo: ImageInfo
	/** 解码变体：preview 用于画布显示，full 用于导出/编辑等高质量场景 */
	variant: ImageResourceVariant
	/** 当前 image 对象的实际像素宽度 */
	sourceWidth: number
	/** 当前 image 对象的实际像素高度 */
	sourceHeight: number
	/** 当前 image 是否等同原图像素尺寸 */
	isFullSize: boolean
}

export interface LoadedLowImageUrl {
	/** low 档位对应的可展示 URL；调用方释放后会被 revoke */
	url: string
	/** 图片元信息，用于图层预览裁剪计算 */
	imageInfo: ImageInfo
	/** 释放 object URL */
	release: () => void
}

export interface ImageResourceLoadOptions {
	refreshCached?: boolean
	variant?: ImageResourceVariant
	priority?: ImageResourceLoadPriority
	bypassQueue?: boolean
	/** 由视口调度创建；取消后不应继续占用 fetch 队列。 */
	signal?: AbortSignal
	/** 可见性调度发起的显示目标元素；仅用于 full 加载完成后定向唤醒该元素 */
	displayTargetElementId?: string
	displayTargetReason?: string
}

type ImageResourceInternalLoadOptions = ImageResourceLoadOptions & {
	/** 仅由画布显示加载使用；getResource/export 不应为 bootstrap 读取本地 low。 */
	restorePersistentLow?: boolean
}

export interface ImageFullAdmissionSnapshot {
	fullDecodedBytes: number
	fullLoadingCount: number
	fullBudgetBytes: number
}

export interface ResolvedImageOssInfo {
	ossSrc: string
	expiresAt: number | null
}

/**
 * 图片资源接口
 */
interface ImageResource {
	/** 当前 decoded image 对应的 URL */
	ossSrc: string
	/** 加载好的图片对象（优先 ImageBitmap，降级 HTMLImageElement） */
	image: ImageSource
	/** 图片信息 */
	imageInfo: ImageInfo
	/** 解码变体 */
	variant: ImageResourceVariant
	/** 当前 image 对象的实际像素宽度 */
	sourceWidth: number
	/** 当前 image 对象的实际像素高度 */
	sourceHeight: number
	/** 当前 image 是否等同原图像素尺寸 */
	isFullSize: boolean
	/** ImageBitmap/HTMLImageElement 是否已经关闭，避免延迟释放路径重复 close */
	closed?: boolean
	/** worker / persistent cache 已产出的显示档位 Blob，用于低成本生成 object URL */
	displayBlob?: Blob
}

interface ImageDisplayResourceSlot {
	resource: ImageResource | null
	loadingPromise: SharedAbortableRequest<LoadedResource | null> | null
	version: string | null
	lastAccessAt: number
}

type ImageDisplayResourceSlots = Record<ImageDisplayResourceVariant, ImageDisplayResourceSlot>

/**
 * 资源条目接口（统一管理 src(path) 相关的所有状态）
 */
export interface ImageResourceEntry extends MediaResourceUrlEntry, MediaResourceBodyCacheEntry {
	/** 外部权威状态代际；上传结果或删除确认会推进，用于淘汰旧 refresh/load。 */
	resourceStateGeneration: number
	/** 上传结果尚未被附件快照确认；确认前旧快照中的 deleted 不能覆盖新上传结果。 */
	awaitingResolverAvailability: boolean
	/** 换取到的 ossSrc（可能为 null，表示换取失败或还未换取） */
	ossSrc: string | null
	/** 当前 ossSrc 是否来自 CacheStorage/virtual URL 兜底 */
	ossSrcFromCachedFallback: boolean
	/** getFileInfo 返回的真实源地址；当 SW 虚拟 URL 失效时用于主线程兜底 */
	sourceUrl: string | null
	/** ossSrc 过期时间戳（毫秒），null 表示永不过期 */
	expiresAt: number | null
	/** 换链 getFileInfo 返回的附件来源（与 GetFileInfoResponse.source 一致） */
	source?: AttachmentSourceEnum
	/** 换链 getFileInfo 返回的文件名（与 GetFileInfoResponse.fileName 一致） */
	fileName?: string
	/** 当前已解码 body 对应的宿主资源版本 */
	resourceVersion: string | null
	/** 当前资源版本对应的宿主更新时间 */
	sourceUpdatedAt: string | null
	/** 当前资源版本对应的压缩资源长度或附件大小 */
	contentLength: number | null
	/** 正在换取 ossSrc 的 Promise（避免重复请求） */
	exchangePromise: Promise<string | null> | null
	/** 正在加载 full 图片的共享请求（避免重复请求） */
	fullLoadingPromise: SharedAbortableRequest<LoadedResource | null> | null
	/** 同一路径的资源刷新串行执行，避免旧一代 decode 晚完成后覆盖新资源。 */
	refreshPromise: Promise<boolean> | null
	/** 正在获取压缩 body 的共享请求（跨 preview/full 复用，避免重复下载） */
	bodyPromise: SharedAbortableRequest<MediaResourceBody | null> | null
	/** 当前 bodyPromise 对应的资源 key */
	bodyPromiseCacheKey: string | null
	/** 正在后台刷新的 Promise（避免重复刷新） */
	backgroundRefreshPromise: Promise<void> | null
	/** 正在从 IndexedDB 恢复 low bootstrap 的共享请求 */
	persistentLowLoadingPromise: SharedAbortableRequest<LoadedResource | null> | null
	/** 画布显示资源槽，按查看等级承载 low / preview */
	displaySlots: ImageDisplayResourceSlots
	/** 已加载的 full 资源（只在导出/编辑等场景按需加载） */
	fullResource: ImageResource | null
	/** full decoded bitmap 最近访问时间，用于 decoded LRU */
	fullLastAccessAt: number
	/** low display object URL 活跃租约数；图层列表等 UI 持有期间不淘汰 low decoded */
	lowDisplayLeaseCount: number
	/** 最近一次 decoded bitmap budget 检查时间；预留给后续防抖/诊断 */
	lastDecodedBudgetEnforcedAt: number
	/** 已缓存的压缩 body；用于 preview/full 二次解码复用，不等同 decoded bitmap */
	bodyBlob: Blob | null
	/** 已缓存 body 对应的 OSS 地址 */
	bodyOssSrc: string | null
	/** 已缓存 body 对应的资源 key */
	bodyCacheKey: string | null
	/** 已缓存 body 字节数 */
	bodyByteSize: number
	/** body 最近访问时间，用于轻量 TTL/LRU */
	bodyLastAccessAt: number
	/** body 对应的资源代际；同 URL 换版本时也必须阻止旧 body/decode 提交。 */
	bodyResourceGeneration: number | null
	/** 最近一次加载失败原因 */
	lastFailureReason: ResourceLoadFailureReason | null
	/** force refresh 失败后仍可展示旧 surface，但这些档位不能再作为加载结果返回。 */
	staleDecodedVariants: Set<ImageResourceVariant>
}

const DEFAULT_IMAGE_RESOURCE_VARIANT: ImageResourceVariant = "preview"
const COMPRESSED_BODY_CACHE_TTL_MS = 2 * 60 * 1000
const COMPRESSED_BODY_CACHE_MAX_BYTES = 256 * 1024 * 1024
const PREVIEW_LOAD_PIPELINE_CONCURRENCY = 8
const DECODED_BITMAP_EVICTION_GRACE_MS = 5000
export type ImageResourceLoadPriority = MediaDecodePriority

type DecodedBitmapCandidateVariant = ImageDisplayResourceVariant | "full"
type DecodedBitmapRetentionLevel = "visible" | "near"

interface DecodedBitmapBudgetCandidate {
	resourceIdentity: string
	entry: ImageResourceEntry
	variant: DecodedBitmapCandidateVariant
	resource: ImageResource
	bytes: number
	lastAccessAt: number
}

interface DecodedBitmapBudgetOptions {
	reason: string
	exemptResource?: ImageResource
	lowBudgetBytes?: number
	previewBudgetBytes?: number
	softBudgetBytes?: number
	hardBudgetBytes?: number
	fullBudgetBytes?: number
}

interface DecodedBitmapRetentionIndex {
	visiblePinnedKeys: Set<string>
	nearProtectedKeys: Set<string>
}

interface PreviewLoadQueueItem {
	key: string
	path: string
	resourceIdentity: string
	entry: ImageResourceEntry
	shouldRefreshCached: boolean
	variant: ImageResourceVariant
	priority: ImageResourceLoadPriority
	options?: ImageResourceLoadOptions
	queuedAt: number
	sequence: number
	resolve: (resource: LoadedResource | null) => void
	reject: (error: unknown) => void
	abortListener?: () => void
}

export interface ImageResourceLoadedEvent {
	data: { path: string; resource: LoadedResource }
}

export interface ImageResourceDisplayLoadedEvent {
	data: {
		elementId: string
		path: string
		resource: LoadedResource
		reason: string
	}
}

export interface ImageResourceLoadFailedEvent {
	data: {
		path: string
		reason?: ResourceLoadFailureReason
		preservePreview?: boolean
	}
}

export interface ImageResourceRecoveryStartedEvent {
	data: {
		path: string
		ossSrc: string
	}
}

export interface ImageResourceWillCloseEvent {
	data: {
		path?: string
		variant: ImageResourceVariant
		image: ImageSource
		reason: string
	}
}

export type ImageResourceLoadFailedHandler = (event: ImageResourceLoadFailedEvent) => void
export type ImageResourceRecoveryStartedHandler = (event: ImageResourceRecoveryStartedEvent) => void
export type ImageResourceWillCloseHandler = (event: ImageResourceWillCloseEvent) => void

/**
 * 图片资源管理器
 * 负责管理图片资源的完整生命周期：src(path) -> ossSrc -> ImageSource (ImageBitmap | HTMLImageElement)
 * 提供跨元素的资源共享和自动释放功能，优先 ImageBitmap 以降低内存占用
 * 每个 Canvas 实例拥有独立的 ImageResourceManager 实例（一对一关系）
 */
export class ImageResourceManager {
	private static instanceIdSeed = 0

	private canvas: Canvas
	private readonly managerInstanceId = ++ImageResourceManager.instanceIdSeed
	private destroyed = false
	private diagnostics = createImageResourceDiagnostics()

	private urlLifecycle!: MediaResourceUrlLifecycle<ImageResourceEntry>
	private bodyCache!: MediaResourceBodyCache<ImageResourceEntry>
	private displayVariantPersistentCache = new ImageDisplayVariantPersistentCache()
	private persistentLowReadyKeys = new Set<string>()
	private persistentLowWritePromises = new Map<string, Promise<void>>()
	private persistentLowGenerationByPath = new Map<string, number>()
	private persistentLowWriteTimestamp = 0
	private persistentLowWriteSequence = 0
	private imageResourceLoadFailedHandlersByIdentity = new Map<
		string,
		Set<ImageResourceLoadFailedHandler>
	>()
	private imageResourceRecoveryStartedHandlersByIdentity = new Map<
		string,
		Set<ImageResourceRecoveryStartedHandler>
	>()
	private imageResourceWillCloseHandlersByIdentity = new Map<
		string,
		Set<ImageResourceWillCloseHandler>
	>()
	private decodedResourceRefCounts = new Map<ImageResource, number>()
	// Keep only the latest identity per path/variant so re-decode diagnostics stay bounded.
	private lastSuccessfulDecodeIdentityByPathVariant = new Map<string, string>()
	private lowDecodedResourceRefCounts = new Map<ImageResource, number>()
	private previewDecodedResourceRefCounts = new Map<ImageResource, number>()
	private fullDecodedResourceRefCounts = new Map<ImageResource, number>()
	private decodedBytesTotal = 0
	private lowDecodedBytes = 0
	private previewDecodedBytes = 0
	private fullDecodedBytes = 0
	private decodedByteTrackingReady = true
	private readonly decodedCacheBudgets = resolveCanvasImageDecodedCacheBudgets()
	private readonly decodePixelBudgetGate = new MediaDecodePixelBudgetGate()

	private getResourceIdentity(path: string): string {
		return this.urlLifecycle.getResourceIdentity(path)
	}

	public onImageResourceLoadFailed(
		path: string,
		handler: ImageResourceLoadFailedHandler,
	): () => void {
		return this.addResourceIdentityHandler(
			this.imageResourceLoadFailedHandlersByIdentity,
			path,
			handler,
		)
	}

	public onImageResourceRecoveryStarted(
		path: string,
		handler: ImageResourceRecoveryStartedHandler,
	): () => void {
		return this.addResourceIdentityHandler(
			this.imageResourceRecoveryStartedHandlersByIdentity,
			path,
			handler,
		)
	}

	public onImageResourceWillClose(
		path: string,
		handler: ImageResourceWillCloseHandler,
	): () => void {
		return this.addResourceIdentityHandler(
			this.imageResourceWillCloseHandlersByIdentity,
			path,
			handler,
		)
	}

	private addResourceIdentityHandler<THandler>(
		handlersByIdentity: Map<string, Set<THandler>>,
		path: string,
		handler: THandler,
	): () => void {
		const key = this.getResourceIdentity(path)
		let handlers = handlersByIdentity.get(key)
		if (!handlers) {
			handlers = new Set()
			handlersByIdentity.set(key, handlers)
		}
		handlers.add(handler)
		return () => {
			const currentHandlers = handlersByIdentity.get(key)
			if (!currentHandlers) return
			currentHandlers.delete(handler)
			if (currentHandlers.size === 0) {
				handlersByIdentity.delete(key)
			}
		}
	}

	private notifyResourceIdentityHandlers<TEvent>(
		handlersByIdentity: Map<string, Set<(event: TEvent) => void>>,
		resourceIdentity: string,
		event: TEvent,
	): void {
		const handlers = handlersByIdentity.get(resourceIdentity)
		if (!handlers || handlers.size === 0) return
		Array.from(handlers).forEach((handler) => handler(event))
	}

	private notifyAllResourceIdentityHandlers<TEvent>(
		handlersByIdentity: Map<string, Set<(event: TEvent) => void>>,
		event: TEvent,
	): void {
		handlersByIdentity.forEach((handlers) => {
			Array.from(handlers).forEach((handler) => handler(event))
		})
	}

	private emitImageResourceLoaded(data: ImageResourceLoadedEvent["data"]): void {
		const event = {
			type: "resource:image:loaded" as const,
			data,
		}
		this.canvas.eventEmitter.emit(event)
	}

	private emitImageResourceDisplayLoaded(data: ImageResourceDisplayLoadedEvent["data"]): void {
		const event = {
			type: "resource:image:display-loaded" as const,
			data,
		}
		this.canvas.eventEmitter.emit(event)
	}

	private emitImageResourceLoadFailed(
		data: ImageResourceLoadFailedEvent["data"],
		resourceIdentity: string,
	): void {
		const event = {
			type: "resource:image:load-failed" as const,
			data,
		}
		this.canvas.eventEmitter.emit(event)
		this.notifyResourceIdentityHandlers(
			this.imageResourceLoadFailedHandlersByIdentity,
			resourceIdentity,
			{
				data,
			},
		)
	}

	private emitImageResourceRecoveryStarted(
		data: ImageResourceRecoveryStartedEvent["data"],
		resourceIdentity: string,
	): void {
		this.notifyResourceIdentityHandlers(
			this.imageResourceRecoveryStartedHandlersByIdentity,
			resourceIdentity,
			{ data },
		)
	}

	private emitImageResourceWillClose(
		data: ImageResourceWillCloseEvent["data"],
		resourceIdentity?: string,
	): void {
		const event = {
			type: "resource:image:will-close" as const,
			data,
		}
		this.canvas.eventEmitter.emit(event)
		if (resourceIdentity) {
			this.notifyResourceIdentityHandlers(
				this.imageResourceWillCloseHandlersByIdentity,
				resourceIdentity,
				{
					data,
				},
			)
			return
		}
		this.notifyAllResourceIdentityHandlers(this.imageResourceWillCloseHandlersByIdentity, {
			data,
		})
	}

	private isAbortError(error: unknown): boolean {
		if (error instanceof Error && error.name === "AbortError") return true
		return (
			typeof error === "object" &&
			error !== null &&
			"name" in error &&
			(error as { name?: unknown }).name === "AbortError"
		)
	}

	private setFailureReason(
		entry: ImageResourceEntry,
		reason: ResourceLoadFailureReason | null,
	): void {
		entry.lastFailureReason = reason
	}

	private markStaleRequestDrop(): void {
		this.diagnostics.increment("staleRequestDropCount")
	}

	private shouldDropAbortedLoad(options?: ImageResourceLoadOptions): boolean {
		if (!options?.signal?.aborted) return false
		this.markStaleRequestDrop()
		return true
	}

	private advanceResourceStateGeneration(entry: ImageResourceEntry): number {
		entry.resourceStateGeneration += 1
		return entry.resourceStateGeneration
	}

	private isResourceStateGenerationCurrent(
		entry: ImageResourceEntry,
		generation: number,
	): boolean {
		return entry.resourceStateGeneration === generation
	}

	private abortEntryLoadingRequests(entry: ImageResourceEntry): void {
		entry.persistentLowLoadingPromise?.abort()
		entry.persistentLowLoadingPromise = null
		for (const variant of MEDIA_DISPLAY_RESOURCE_VARIANTS) {
			this.getDisplayLoadingPromise(entry, variant)?.abort()
			this.setDisplayLoadingPromise(entry, variant, null)
		}
		entry.fullLoadingPromise?.abort()
		entry.fullLoadingPromise = null
		this.clearEntryBodyPromise(entry)
	}

	private isPrimedResourceAwaitingResolverSnapshot(entry: ImageResourceEntry): boolean {
		return entry.awaitingResolverAvailability && Boolean(entry.ossSrc)
	}

	private clearCachedFallbackOssSrc(entry: ImageResourceEntry): void {
		this.urlLifecycle.clearCachedFallbackOssSrc(entry)
	}

	// src(path) -> ResourceEntry 的统一映射缓存
	private entries: Map<string, ImageResourceEntry> = new Map()

	private workerClient: ImageResourceWorkerClientLease | null = null

	private requestIdCounter = 0

	private workerWarmupPromise: Promise<void> | null = null

	private previewLoadQueue: PreviewLoadQueueItem[] = []

	private previewLoadQueueByKey = new Map<string, PreviewLoadQueueItem>()

	private activePreviewLoadPipelineCount = 0

	private previewLoadQueueSequence = 0

	// 防抖定时器
	private cleanupTimer: ReturnType<typeof setTimeout> | null = null

	// 防抖延迟时间（毫秒）
	private readonly CLEANUP_DEBOUNCE_DELAY = 100

	// 事件监听器回调（保存引用以便销毁时移除）
	private readonly handleElementDeleted = () => {
		this.scheduleCleanup("element:deleted")
	}

	private readonly handleBatchDeleted = () => {
		void this.checkAndCleanupResources("element:batchdeleted")
	}

	private readonly handleCanvasClear = () => {
		void this.checkAndCleanupResources("canvas:clear")
	}

	private readonly handleReferenceImagesChanged = () => {
		this.scheduleCleanup("referenceImages:changed")
	}

	constructor(options: { canvas: Canvas }) {
		this.canvas = options.canvas
		this.bodyCache = new MediaResourceBodyCache<ImageResourceEntry>({
			ttlMs: COMPRESSED_BODY_CACHE_TTL_MS,
			maxBytes: COMPRESSED_BODY_CACHE_MAX_BYTES,
			shared: true,
			sharedScope: () => this.getPersistentDisplayScope(),
		})
		this.urlLifecycle = new MediaResourceUrlLifecycle<ImageResourceEntry>({
			canvas: this.canvas,
			mediaType: "image",
			useImageProcess: true,
			isDestroyed: () => this.destroyed,
			setFailureReason: (entry, reason) => this.setFailureReason(entry, reason),
			onResourceDeleted: (resourceIdentity, entry) =>
				this.handleImageResourceDeleted(resourceIdentity, entry),
			refreshResource: (path) => this.refreshResource(path),
			onResourceMetadataHydrated: (resourceIdentity, entry) =>
				this.migrateBodyCacheKeyAfterMetadataHydration(resourceIdentity, entry),
			onResourceVersionChanged: (resourceIdentity, entry, previousVersion) =>
				this.handleResourceVersionChanged(resourceIdentity, entry, previousVersion),
			incrementDiagnostic: (counter) => this.diagnostics.increment(counter),
		})
		this.workerClient = acquireImageResourceWorkerClient({
			ownerId: `canvas:${this.canvas.id}:image-resource-manager:${this.managerInstanceId}`,
			canvasId: this.canvas.id,
			managerInstanceId: this.managerInstanceId,
		})
		// 监听单个元素删除事件，使用防抖避免频繁检查
		this.canvas.eventEmitter.on("element:deleted", this.handleElementDeleted)
		// 监听批量删除完成事件，立即检查（批量删除时不需要防抖）
		this.canvas.eventEmitter.on("element:batchdeleted", this.handleBatchDeleted)
		// 监听画布清空，回收所有不再被元素引用的资源
		this.canvas.eventEmitter.on("canvas:clear", this.handleCanvasClear)
		// 监听参考图增删（编辑器 delete @ 提及等），触发资源回收
		this.canvas.eventEmitter.on("referenceImages:changed", this.handleReferenceImagesChanged)
		void this.warmupWorker()
	}

	private createWorkerRequestId(prefix: string): string {
		return `${prefix}-${this.managerInstanceId}-${++this.requestIdCounter}-${Date.now()}`
	}

	/**
	 * 向 Worker 发送请求
	 */
	private sendToWorker(
		request: ImageResourceWorkerRequest,
		options?: {
			signal?: AbortSignal
			priority?: ImageResourceLoadPriority
			pixelCost?: number
		},
	): Promise<ImageResourceWorkerResponse> {
		if (this.destroyed || !this.workerClient) {
			return Promise.reject(new Error("ImageResourceManager destroyed"))
		}
		return this.workerClient.send(request, options)
	}

	private warmupWorker(): Promise<void> {
		if (this.destroyed) return Promise.resolve()
		if (this.workerWarmupPromise) return this.workerWarmupPromise

		const requestId = this.createWorkerRequestId("img-warmup")

		const promise = this.sendToWorker(
			{
				type: "warmup",
				requestId,
				variant: DEFAULT_IMAGE_RESOURCE_VARIANT,
			},
			{ priority: "background" },
		)
			.then(() => undefined)
			.catch(() => undefined)
			.finally(() => {
				if (this.workerWarmupPromise === promise) {
					this.workerWarmupPromise = null
				}
			})

		this.workerWarmupPromise = promise
		return promise
	}

	/**
	 * 从 entry 构建 LoadedResource
	 */
	private buildLoadedResource(
		entry: ImageResourceEntry,
		variant: ImageResourceVariant = DEFAULT_IMAGE_RESOURCE_VARIANT,
	): LoadedResource | null {
		if (entry.staleDecodedVariants.has(variant)) return null
		const resource = this.getResourceForVariant(entry, variant)
		if (!resource?.ossSrc || resource.closed) return null
		this.touchDecodedResource(entry, resource)
		this.setFailureReason(entry, null)
		return {
			ossSrc: resource.ossSrc,
			image: resource.image,
			imageInfo: resource.imageInfo,
			variant: resource.variant,
			sourceWidth: resource.sourceWidth,
			sourceHeight: resource.sourceHeight,
			isFullSize: resource.isFullSize,
		}
	}

	private getResourceForVariant(
		entry: ImageResourceEntry,
		variant: ImageResourceVariant,
	): ImageResource | null {
		if (variant === "full") {
			const previewResource = this.getDisplayResource(entry, "preview")
			return entry.fullResource ?? (previewResource?.isFullSize ? previewResource : null)
		}
		if (variant === "low") {
			return this.getDisplayResource(entry, "low")
		}

		// preview 必须命中自己的显示槽：full 会被预览目标拒绝，不能据此跳过 preview 解码。
		return this.getDisplayResource(entry, "preview")
	}

	private getLoadingPromiseForVariant(
		entry: ImageResourceEntry,
		variant: ImageResourceVariant,
	): SharedAbortableRequest<LoadedResource | null> | null {
		if (variant === "full") return entry.fullLoadingPromise
		return this.getDisplayLoadingPromise(entry, variant)
	}

	private setLoadingPromiseForVariant(
		entry: ImageResourceEntry,
		variant: ImageResourceVariant,
		request: SharedAbortableRequest<LoadedResource | null> | null,
	): void {
		if (variant === "full") {
			entry.fullLoadingPromise = request
		} else {
			this.setDisplayLoadingPromise(entry, variant, request)
		}
	}

	private getPreviewQueueKey(resourceIdentity: string, variant: ImageResourceVariant): string {
		return `${resourceIdentity}::${variant}`
	}

	private getPriorityRank(priority: ImageResourceLoadPriority): number {
		return getMediaDecodePriorityRank(priority)
	}

	private normalizeLoadPriority(
		priority: ImageResourceLoadPriority | undefined,
		variant: ImageResourceVariant,
	): ImageResourceLoadPriority {
		if (priority) return priority
		return variant === "full" ? "critical" : "background"
	}

	private sortPreviewLoadQueue(): void {
		this.previewLoadQueue.sort((a, b) => {
			const priorityDiff = this.getPriorityRank(a.priority) - this.getPriorityRank(b.priority)
			if (priorityDiff !== 0) return priorityDiff
			return a.sequence - b.sequence
		})
	}

	private upgradeQueuedPreviewLoad(
		resourceIdentity: string,
		variant: ImageResourceVariant,
		priority: ImageResourceLoadPriority,
	): void {
		const key = this.getPreviewQueueKey(resourceIdentity, variant)
		const item = this.previewLoadQueueByKey.get(key)
		if (!item) return
		if (this.getPriorityRank(priority) >= this.getPriorityRank(item.priority)) return

		item.priority = priority
	}

	private runPreviewLoadPipelineQueued(
		path: string,
		resourceIdentity: string,
		entry: ImageResourceEntry,
		shouldRefreshCached: boolean,
		variant: ImageResourceVariant,
		priority: ImageResourceLoadPriority,
		options?: ImageResourceLoadOptions,
	): Promise<LoadedResource | null> {
		if (this.destroyed) {
			return Promise.resolve(null)
		}

		const key = this.getPreviewQueueKey(resourceIdentity, variant)
		return new Promise<LoadedResource | null>((resolve, reject) => {
			const item: PreviewLoadQueueItem = {
				key,
				path,
				resourceIdentity,
				entry,
				shouldRefreshCached,
				variant,
				priority,
				options,
				queuedAt: this.getNow(),
				sequence: ++this.previewLoadQueueSequence,
				resolve,
				reject,
			}
			if (options?.signal) {
				item.abortListener = () => {
					const queueIndex = this.previewLoadQueue.indexOf(item)
					if (queueIndex < 0) return
					this.previewLoadQueue.splice(queueIndex, 1)
					if (this.previewLoadQueueByKey.get(key) === item) {
						this.previewLoadQueueByKey.delete(key)
					}
					reject(createImageAbortError())
					this.pumpPreviewLoadQueue()
				}
				if (options.signal.aborted) {
					reject(createImageAbortError())
					return
				}
				options.signal.addEventListener("abort", item.abortListener, { once: true })
			}
			this.previewLoadQueue.push(item)
			this.previewLoadQueueByKey.set(key, item)
			this.pumpPreviewLoadQueue()
		})
	}

	private pumpPreviewLoadQueue(): void {
		if (this.destroyed) return
		this.sortPreviewLoadQueue()
		while (
			this.activePreviewLoadPipelineCount < PREVIEW_LOAD_PIPELINE_CONCURRENCY &&
			this.previewLoadQueue.length > 0
		) {
			const item = this.previewLoadQueue.shift()
			if (!item) return
			if (item.abortListener) {
				item.options?.signal?.removeEventListener("abort", item.abortListener)
				item.abortListener = undefined
			}
			this.previewLoadQueueByKey.delete(item.key)
			this.activePreviewLoadPipelineCount += 1

			void this.loadImageResourcePipeline(
				item.path,
				item.resourceIdentity,
				item.entry,
				item.shouldRefreshCached,
				item.variant,
				item.priority,
				item.options,
			)
				.then((resource) => {
					item.resolve(resource)
				})
				.catch((error) => {
					item.reject(error)
				})
				.finally(() => {
					this.activePreviewLoadPipelineCount = Math.max(
						0,
						this.activePreviewLoadPipelineCount - 1,
					)
					this.pumpPreviewLoadQueue()
				})
		}
	}

	private getDecodedBytes(resource: ImageResource | null): number {
		if (!resource) return 0
		return Math.max(1, resource.sourceWidth) * Math.max(1, resource.sourceHeight) * 4
	}

	private ensureDecodedByteTrackingState(): void {
		if (!(this.decodedResourceRefCounts instanceof Map)) {
			this.decodedResourceRefCounts = new Map()
		}
		if (!(this.lowDecodedResourceRefCounts instanceof Map)) {
			this.lowDecodedResourceRefCounts = new Map()
		}
		if (!(this.previewDecodedResourceRefCounts instanceof Map)) {
			this.previewDecodedResourceRefCounts = new Map()
		}
		if (!(this.fullDecodedResourceRefCounts instanceof Map)) {
			this.fullDecodedResourceRefCounts = new Map()
		}
		if (typeof this.decodedBytesTotal !== "number") {
			this.decodedBytesTotal = 0
		}
		if (typeof this.lowDecodedBytes !== "number") {
			this.lowDecodedBytes = 0
		}
		if (typeof this.previewDecodedBytes !== "number") {
			this.previewDecodedBytes = 0
		}
		if (typeof this.fullDecodedBytes !== "number") {
			this.fullDecodedBytes = 0
		}
		if (this.decodedByteTrackingReady !== true) {
			this.rebuildDecodedByteTrackingFromEntries()
		}
	}

	private incrementDecodedResourceRef(
		counts: Map<ImageResource, number>,
		resource: ImageResource,
	): boolean {
		const previousCount = counts.get(resource) ?? 0
		counts.set(resource, previousCount + 1)
		return previousCount === 0
	}

	private decrementDecodedResourceRef(
		counts: Map<ImageResource, number>,
		resource: ImageResource,
	): boolean {
		const previousCount = counts.get(resource) ?? 0
		if (previousCount <= 1) {
			counts.delete(resource)
			return previousCount === 1
		}
		counts.set(resource, previousCount - 1)
		return false
	}

	private retainDecodedResource(
		resource: ImageResource | null,
		options?: { variant?: ImageResourceVariant },
	): void {
		if (!resource) return
		this.ensureDecodedByteTrackingState()
		const bytes = this.getDecodedBytes(resource)
		if (this.incrementDecodedResourceRef(this.decodedResourceRefCounts, resource)) {
			this.decodedBytesTotal += bytes
		}
		if (options?.variant === "low") {
			if (this.incrementDecodedResourceRef(this.lowDecodedResourceRefCounts, resource)) {
				this.lowDecodedBytes += bytes
			}
		}
		if (options?.variant === "preview") {
			if (this.incrementDecodedResourceRef(this.previewDecodedResourceRefCounts, resource)) {
				this.previewDecodedBytes += bytes
			}
		}
		if (options?.variant === "full") {
			if (this.incrementDecodedResourceRef(this.fullDecodedResourceRefCounts, resource)) {
				this.fullDecodedBytes += bytes
			}
		}
	}

	private releaseDecodedResource(
		resource: ImageResource | null,
		options?: { variant?: ImageResourceVariant },
	): void {
		if (!resource) return
		this.ensureDecodedByteTrackingState()
		const bytes = this.getDecodedBytes(resource)
		if (this.decrementDecodedResourceRef(this.decodedResourceRefCounts, resource)) {
			this.decodedBytesTotal = Math.max(0, this.decodedBytesTotal - bytes)
		}
		if (options?.variant === "low") {
			if (this.decrementDecodedResourceRef(this.lowDecodedResourceRefCounts, resource)) {
				this.lowDecodedBytes = Math.max(0, this.lowDecodedBytes - bytes)
			}
		}
		if (options?.variant === "preview") {
			if (this.decrementDecodedResourceRef(this.previewDecodedResourceRefCounts, resource)) {
				this.previewDecodedBytes = Math.max(0, this.previewDecodedBytes - bytes)
			}
		}
		if (options?.variant === "full") {
			if (this.decrementDecodedResourceRef(this.fullDecodedResourceRefCounts, resource)) {
				this.fullDecodedBytes = Math.max(0, this.fullDecodedBytes - bytes)
			}
		}
	}

	private rebuildDecodedByteTrackingFromEntries(): void {
		this.decodedResourceRefCounts = new Map()
		this.lowDecodedResourceRefCounts = new Map()
		this.previewDecodedResourceRefCounts = new Map()
		this.fullDecodedResourceRefCounts = new Map()
		this.decodedBytesTotal = 0
		this.lowDecodedBytes = 0
		this.previewDecodedBytes = 0
		this.fullDecodedBytes = 0

		this.entries?.forEach((entry) => {
			for (const variant of MEDIA_DISPLAY_RESOURCE_VARIANTS) {
				const resource = this.getDisplayResource(entry, variant)
				if (!resource) continue
				if (this.incrementDecodedResourceRef(this.decodedResourceRefCounts, resource)) {
					this.decodedBytesTotal += this.getDecodedBytes(resource)
				}
				if (variant === "low") {
					if (
						this.incrementDecodedResourceRef(this.lowDecodedResourceRefCounts, resource)
					) {
						this.lowDecodedBytes += this.getDecodedBytes(resource)
					}
				}
				if (variant === "preview") {
					if (
						this.incrementDecodedResourceRef(
							this.previewDecodedResourceRefCounts,
							resource,
						)
					) {
						this.previewDecodedBytes += this.getDecodedBytes(resource)
					}
				}
			}
			if (!entry.fullResource) return
			if (
				this.incrementDecodedResourceRef(this.decodedResourceRefCounts, entry.fullResource)
			) {
				this.decodedBytesTotal += this.getDecodedBytes(entry.fullResource)
			}
			if (
				this.incrementDecodedResourceRef(
					this.fullDecodedResourceRefCounts,
					entry.fullResource,
				)
			) {
				this.fullDecodedBytes += this.getDecodedBytes(entry.fullResource)
			}
		})
		this.decodedByteTrackingReady = true
	}

	private clearDecodedByteTracking(): void {
		if (this.decodedResourceRefCounts instanceof Map) {
			this.decodedResourceRefCounts.clear()
		} else {
			this.decodedResourceRefCounts = new Map()
		}
		if (this.lowDecodedResourceRefCounts instanceof Map) {
			this.lowDecodedResourceRefCounts.clear()
		} else {
			this.lowDecodedResourceRefCounts = new Map()
		}
		if (this.previewDecodedResourceRefCounts instanceof Map) {
			this.previewDecodedResourceRefCounts.clear()
		} else {
			this.previewDecodedResourceRefCounts = new Map()
		}
		if (this.fullDecodedResourceRefCounts instanceof Map) {
			this.fullDecodedResourceRefCounts.clear()
		} else {
			this.fullDecodedResourceRefCounts = new Map()
		}
		this.decodedBytesTotal = 0
		this.lowDecodedBytes = 0
		this.previewDecodedBytes = 0
		this.fullDecodedBytes = 0
		this.decodedByteTrackingReady = true
	}

	private getDecodedBitmapRetentionKey(
		path: string,
		variant: DecodedBitmapCandidateVariant,
	): string {
		return `${path}::${variant}`
	}

	private createEmptyDecodedBitmapRetentionIndex(): DecodedBitmapRetentionIndex {
		return {
			visiblePinnedKeys: new Set(),
			nearProtectedKeys: new Set(),
		}
	}

	private addDecodedBitmapRetentionHintVariant(
		retentionIndex: DecodedBitmapRetentionIndex,
		hint: DecodedImageRetentionHint,
		variant: ImageResourceVariant | undefined,
	): void {
		if (!variant) return
		const normalizedPath = this.getResourceIdentity(hint.path)
		const key = this.getDecodedBitmapRetentionKey(normalizedPath, variant)
		if (hint.visibilityState === "visible") {
			retentionIndex.visiblePinnedKeys.add(key)
			retentionIndex.nearProtectedKeys.delete(key)
			return
		}
		if (!retentionIndex.visiblePinnedKeys.has(key)) {
			retentionIndex.nearProtectedKeys.add(key)
		}
	}

	private getDecodedBitmapRetentionIndex(): DecodedBitmapRetentionIndex {
		const retentionIndex = this.createEmptyDecodedBitmapRetentionIndex()
		const visibilityManager = this.canvas.visibilityManager as
			| {
					getDecodedImageRetentionSnapshot?: () => DecodedImageRetentionHint[]
			  }
			| undefined
		const hints = visibilityManager?.getDecodedImageRetentionSnapshot?.() ?? []
		hints.forEach((hint) => {
			this.addDecodedBitmapRetentionHintVariant(retentionIndex, hint, hint.displayedVariant)
			this.addDecodedBitmapRetentionHintVariant(retentionIndex, hint, hint.requestedVariant)
		})
		return retentionIndex
	}

	private getDecodedBitmapRetentionLevelForPathVariant(
		path: string,
		variant: DecodedBitmapCandidateVariant,
		retentionIndex: DecodedBitmapRetentionIndex,
	): DecodedBitmapRetentionLevel | null {
		const key = this.getDecodedBitmapRetentionKey(path, variant)
		if (retentionIndex.visiblePinnedKeys.has(key)) return "visible"
		if (retentionIndex.nearProtectedKeys.has(key)) return "near"
		return null
	}

	private getDecodedBitmapRetentionLevel(
		candidate: DecodedBitmapBudgetCandidate,
		retentionIndex: DecodedBitmapRetentionIndex,
	): DecodedBitmapRetentionLevel | null {
		return this.getDecodedBitmapRetentionLevelForPathVariant(
			candidate.resourceIdentity,
			candidate.variant,
			retentionIndex,
		)
	}

	private collectDecodedBitmapBudgetCandidates(): {
		totalBytes: number
		lowBytes: number
		previewBytes: number
		fullBytes: number
		candidates: DecodedBitmapBudgetCandidate[]
	} {
		let totalBytes = 0
		let lowBytes = 0
		let previewBytes = 0
		let fullBytes = 0
		const countedResources = new Set<ImageResource>()
		const countedLowResources = new Set<ImageResource>()
		const countedPreviewResources = new Set<ImageResource>()
		const countedFullResources = new Set<ImageResource>()
		const candidates: DecodedBitmapBudgetCandidate[] = []
		const addDecodedBytes = (resource: ImageResource): number => {
			const bytes = this.getDecodedBytes(resource)
			if (!countedResources.has(resource)) {
				countedResources.add(resource)
				totalBytes += bytes
			}
			return bytes
		}

		this.entries.forEach((entry, resourceIdentity) => {
			for (const variant of MEDIA_DISPLAY_RESOURCE_VARIANTS) {
				const slot = this.getDisplayResourceSlot(entry, variant)
				if (!slot.resource) continue
				const bytes = addDecodedBytes(slot.resource)
				if (variant === "low" && !countedLowResources.has(slot.resource)) {
					countedLowResources.add(slot.resource)
					lowBytes += bytes
				}
				if (variant === "preview" && !countedPreviewResources.has(slot.resource)) {
					countedPreviewResources.add(slot.resource)
					previewBytes += bytes
				}
				candidates.push({
					resourceIdentity,
					entry,
					variant,
					resource: slot.resource,
					bytes,
					lastAccessAt: slot.lastAccessAt,
				})
			}

			if (!entry.fullResource) return
			const bytes = addDecodedBytes(entry.fullResource)
			if (!countedFullResources.has(entry.fullResource)) {
				countedFullResources.add(entry.fullResource)
				fullBytes += bytes
			}
			candidates.push({
				resourceIdentity,
				entry,
				variant: "full",
				resource: entry.fullResource,
				bytes,
				lastAccessAt: entry.fullLastAccessAt,
			})
		})

		return { totalBytes, lowBytes, previewBytes, fullBytes, candidates }
	}

	private getDecodedBitmapCandidatePriority(variant: DecodedBitmapCandidateVariant): number {
		switch (variant) {
			case "full":
				return 0
			case "preview":
				return 1
			case "low":
				return 2
		}
	}

	private sortDecodedBitmapCandidates(
		candidates: DecodedBitmapBudgetCandidate[],
	): DecodedBitmapBudgetCandidate[] {
		return [...candidates].sort((a, b) => {
			const priorityDiff =
				this.getDecodedBitmapCandidatePriority(a.variant) -
				this.getDecodedBitmapCandidatePriority(b.variant)
			if (priorityDiff !== 0) return priorityDiff
			const accessDiff = a.lastAccessAt - b.lastAccessAt
			if (accessDiff !== 0) return accessDiff
			return b.bytes - a.bytes
		})
	}

	private isResourceReferencedByAnyEntry(resource: ImageResource): boolean {
		let referenced = false
		this.entries.forEach((entry) => {
			if (referenced) return
			referenced = this.isResourceStillReferenced(entry, resource)
		})
		return referenced
	}

	private detachDecodedBitmapCandidate(candidate: DecodedBitmapBudgetCandidate): boolean {
		if (candidate.variant === "full") {
			if (candidate.entry.fullResource !== candidate.resource) return false
			this.setFullResource(candidate.entry, null)
			return true
		}

		const slot = this.getDisplayResourceSlot(candidate.entry, candidate.variant)
		if (slot.resource !== candidate.resource) return false
		this.setDisplayResource(candidate.entry, candidate.variant, null, { closePrevious: false })
		return true
	}

	private recordDecodedBitmapEviction(candidate: DecodedBitmapBudgetCandidate): void {
		this.diagnostics.increment("decodedEvictedCount")
		this.diagnostics.increment("decodedEvictedBytes", candidate.bytes)
		switch (candidate.variant) {
			case "full":
				this.diagnostics.increment("decodedEvictedFull")
				break
			case "preview":
				this.diagnostics.increment("decodedEvictedPreview")
				break
			case "low":
				this.diagnostics.increment("decodedEvictedLow")
				break
		}
	}

	private invalidateImageLoadRequestForDecodedEviction(
		candidate: DecodedBitmapBudgetCandidate,
	): void {
		const visibilityManager = this.canvas.visibilityManager as
			| {
					invalidateImageLoadRequest?: (
						path: string,
						variant?: ImageResourceVariant,
						reason?: string,
						options?: { scheduleRefresh?: boolean },
					) => void
			  }
			| undefined

		visibilityManager?.invalidateImageLoadRequest?.(
			candidate.entry.referencePath,
			candidate.variant,
			"decoded-budget",
			{
				scheduleRefresh: candidate.variant !== "full",
			},
		)
	}

	private evictDecodedBitmapCandidate(
		candidate: DecodedBitmapBudgetCandidate,
		closedResources: Set<ImageResource>,
		reason: string,
	): { detachedBytes: number; freedBytes: number } {
		const detached = this.detachDecodedBitmapCandidate(candidate)
		if (!detached) return { detachedBytes: 0, freedBytes: 0 }
		this.invalidateImageLoadRequestForDecodedEviction(candidate)
		if (this.isResourceReferencedByAnyEntry(candidate.resource)) {
			return { detachedBytes: candidate.bytes, freedBytes: 0 }
		}
		if (closedResources.has(candidate.resource)) {
			return { detachedBytes: candidate.bytes, freedBytes: 0 }
		}

		closedResources.add(candidate.resource)
		this.closeResourceAfterConsumersSwap(candidate.resource, {
			entry: candidate.entry,
			reason: `decoded-budget:${reason}`,
		})
		this.recordDecodedBitmapEviction(candidate)
		return { detachedBytes: candidate.bytes, freedBytes: candidate.bytes }
	}

	private enforceDecodedBitmapBudget(options: DecodedBitmapBudgetOptions): void {
		if (this.destroyed) return
		const lowBudgetBytes = Math.max(
			0,
			options.lowBudgetBytes ?? this.decodedCacheBudgets.lowBytes,
		)
		const previewBudgetBytes = Math.max(
			0,
			options.previewBudgetBytes ?? this.decodedCacheBudgets.previewBytes,
		)
		const hardBudgetBytes = Math.max(
			0,
			options.hardBudgetBytes ?? this.decodedCacheBudgets.totalHardBytes,
		)
		const softBudgetBytes = Math.max(
			0,
			Math.min(
				options.softBudgetBytes ?? this.decodedCacheBudgets.totalSoftBytes,
				hardBudgetBytes,
			),
		)
		const fullBudgetBytes = Math.max(
			0,
			options.fullBudgetBytes ?? this.decodedCacheBudgets.fullBytes,
		)
		this.ensureDecodedByteTrackingState()
		if (
			this.decodedBytesTotal <= softBudgetBytes &&
			this.lowDecodedBytes <= lowBudgetBytes &&
			this.previewDecodedBytes <= previewBudgetBytes &&
			this.fullDecodedBytes <= fullBudgetBytes
		) {
			return
		}
		const budgetState = this.collectDecodedBitmapBudgetCandidates()
		const { candidates } = budgetState
		let { totalBytes, lowBytes, previewBytes, fullBytes } = budgetState
		if (
			totalBytes <= softBudgetBytes &&
			lowBytes <= lowBudgetBytes &&
			previewBytes <= previewBudgetBytes &&
			fullBytes <= fullBudgetBytes
		) {
			return
		}
		const retentionIndex = this.getDecodedBitmapRetentionIndex()

		const now = this.getNow()
		this.entries.forEach((entry) => {
			entry.lastDecodedBudgetEnforcedAt = now
		})

		const closedResources = new Set<ImageResource>()
		const isExemptCandidate = (candidate: DecodedBitmapBudgetCandidate) =>
			!!options.exemptResource && candidate.resource === options.exemptResource
		const getRetentionLevel = (candidate: DecodedBitmapBudgetCandidate) =>
			this.getDecodedBitmapRetentionLevel(candidate, retentionIndex)
		const isVisiblePinnedCandidate = (candidate: DecodedBitmapBudgetCandidate) =>
			getRetentionLevel(candidate) === "visible"
		const isNearProtectedCandidate = (candidate: DecodedBitmapBudgetCandidate) =>
			getRetentionLevel(candidate) === "near"
		const isLowLeaseProtectedCandidate = (candidate: DecodedBitmapBudgetCandidate) =>
			candidate.variant === "low" && candidate.entry.lowDisplayLeaseCount > 0
		const isRecentFullProtectedCandidate = (candidate: DecodedBitmapBudgetCandidate) =>
			candidate.variant === "full" &&
			now - candidate.lastAccessAt < DECODED_BITMAP_EVICTION_GRACE_MS
		const isRecentDisplayProtectedCandidate = (candidate: DecodedBitmapBudgetCandidate) =>
			candidate.variant !== "full" &&
			now - candidate.lastAccessAt < DECODED_BITMAP_EVICTION_GRACE_MS
		const canEvictDuringFullOrSoftBudget = (candidate: DecodedBitmapBudgetCandidate) =>
			!isExemptCandidate(candidate) &&
			!isVisiblePinnedCandidate(candidate) &&
			!isNearProtectedCandidate(candidate) &&
			!isRecentFullProtectedCandidate(candidate) &&
			!isRecentDisplayProtectedCandidate(candidate) &&
			!isLowLeaseProtectedCandidate(candidate)
		const canEvictDuringHardBudget = (candidate: DecodedBitmapBudgetCandidate) =>
			!isExemptCandidate(candidate) &&
			!isVisiblePinnedCandidate(candidate) &&
			!isNearProtectedCandidate(candidate) &&
			!isLowLeaseProtectedCandidate(candidate)
		const canEvictNearDuringHardBudget = (candidate: DecodedBitmapBudgetCandidate) =>
			!isExemptCandidate(candidate) &&
			!isVisiblePinnedCandidate(candidate) &&
			isNearProtectedCandidate(candidate) &&
			!isLowLeaseProtectedCandidate(candidate)
		const evictCandidate = (candidate: DecodedBitmapBudgetCandidate) => {
			const result = this.evictDecodedBitmapCandidate(
				candidate,
				closedResources,
				options.reason,
			)
			if (result.detachedBytes > 0 && candidate.variant === "full") {
				fullBytes = Math.max(0, fullBytes - result.detachedBytes)
			}
			if (result.detachedBytes > 0 && candidate.variant === "low") {
				lowBytes = Math.max(0, lowBytes - result.detachedBytes)
			}
			if (result.detachedBytes > 0 && candidate.variant === "preview") {
				previewBytes = Math.max(0, previewBytes - result.detachedBytes)
			}
			if (result.freedBytes > 0) {
				totalBytes = Math.max(0, totalBytes - result.freedBytes)
			}
		}

		for (const candidate of this.sortDecodedBitmapCandidates(
			candidates.filter(
				(candidate) =>
					candidate.variant === "low" && canEvictDuringFullOrSoftBudget(candidate),
			),
		)) {
			if (lowBytes <= lowBudgetBytes && totalBytes <= softBudgetBytes) break
			evictCandidate(candidate)
		}

		for (const candidate of this.sortDecodedBitmapCandidates(
			candidates.filter(
				(candidate) =>
					candidate.variant === "preview" && canEvictDuringFullOrSoftBudget(candidate),
			),
		)) {
			if (previewBytes <= previewBudgetBytes && totalBytes <= softBudgetBytes) break
			evictCandidate(candidate)
		}

		for (const candidate of this.sortDecodedBitmapCandidates(
			candidates.filter(
				(candidate) =>
					candidate.variant === "full" && canEvictDuringFullOrSoftBudget(candidate),
			),
		)) {
			if (fullBytes <= fullBudgetBytes) break
			evictCandidate(candidate)
		}

		if (totalBytes <= softBudgetBytes) return
		for (const candidate of this.sortDecodedBitmapCandidates(
			candidates.filter((candidate) => canEvictDuringFullOrSoftBudget(candidate)),
		)) {
			if (totalBytes <= softBudgetBytes) break
			evictCandidate(candidate)
		}

		if (totalBytes <= hardBudgetBytes) return
		for (const candidate of this.sortDecodedBitmapCandidates(
			candidates.filter((candidate) => canEvictDuringHardBudget(candidate)),
		)) {
			if (totalBytes <= hardBudgetBytes) break
			evictCandidate(candidate)
		}
		if (totalBytes <= hardBudgetBytes) return
		for (const candidate of this.sortDecodedBitmapCandidates(
			candidates.filter((candidate) => canEvictNearDuringHardBudget(candidate)),
		)) {
			if (totalBytes <= hardBudgetBytes) break
			evictCandidate(candidate)
		}
	}

	private isFullSizeResource(
		imageInfo: ImageInfo,
		sourceWidth: number,
		sourceHeight: number,
	): boolean {
		return (
			Math.abs(sourceWidth - imageInfo.naturalWidth) <= 1 &&
			Math.abs(sourceHeight - imageInfo.naturalHeight) <= 1
		)
	}

	private closeResource(
		resource: ImageResource | null,
		options?: { entry?: ImageResourceEntry; reason?: string },
	): void {
		if (!resource) return
		if (resource.closed) return
		resource.closed = true
		this.emitImageResourceWillClose(
			{
				path: options?.entry?.referencePath,
				variant: resource.variant,
				image: resource.image,
				reason: options?.reason ?? "resource-close",
			},
			options?.entry?.resourceIdentity,
		)
		closeImageSource(resource.image)
	}

	private closeResourceAfterConsumersSwap(
		resource: ImageResource | null,
		options?: { entry?: ImageResourceEntry; reason?: string },
	): void {
		if (!resource) return

		const schedule =
			typeof requestAnimationFrame === "function"
				? requestAnimationFrame
				: (callback: FrameRequestCallback) =>
						globalThis.setTimeout(() => callback(Date.now()), 0) as unknown as number
		schedule(() => {
			schedule(() => {
				this.closeResource(resource, options)
			})
		})
	}

	private closeUniqueResources(
		resources: Array<ImageResource | null>,
		options?: { entry?: ImageResourceEntry; reason?: string },
	): void {
		const closed = new Set<ImageResource>()
		resources.forEach((resource) => {
			if (!resource || closed.has(resource)) return
			closed.add(resource)
			this.closeResource(resource, options)
		})
	}

	private createDisplayResourceSlot(
		options?: Partial<ImageDisplayResourceSlot>,
	): ImageDisplayResourceSlot {
		return {
			resource: null,
			loadingPromise: null,
			version: null,
			lastAccessAt: 0,
			...options,
		}
	}

	private createDisplayResourceSlots(): ImageDisplayResourceSlots {
		return {
			low: this.createDisplayResourceSlot(),
			preview: this.createDisplayResourceSlot(),
		}
	}

	private getDisplayResourceSlot(
		entry: ImageResourceEntry,
		variant: ImageDisplayResourceVariant,
	): ImageDisplayResourceSlot {
		return entry.displaySlots[variant]
	}

	private getDisplayResource(
		entry: ImageResourceEntry,
		variant: ImageDisplayResourceVariant,
	): ImageResource | null {
		return this.getDisplayResourceSlot(entry, variant).resource
	}

	private touchDecodedResource(entry: ImageResourceEntry, resource: ImageResource): void {
		const now = this.getNow()
		for (const variant of MEDIA_DISPLAY_RESOURCE_VARIANTS) {
			const slot = this.getDisplayResourceSlot(entry, variant)
			if (slot.resource === resource) {
				slot.lastAccessAt = now
			}
		}
		if (entry.fullResource === resource) {
			entry.fullLastAccessAt = now
		}
	}

	private setDisplayResource(
		entry: ImageResourceEntry,
		variant: ImageDisplayResourceVariant,
		resource: ImageResource | null,
		options?: {
			version?: string | null
			touch?: boolean
			closePrevious?: boolean
			lastAccessAt?: number
		},
	): ImageResource | null {
		const slot = this.getDisplayResourceSlot(entry, variant)
		const previousResource = slot.resource
		if (previousResource !== resource) {
			this.releaseDecodedResource(previousResource, { variant })
			this.retainDecodedResource(resource, { variant })
		}
		slot.resource = resource
		slot.version = options?.version ?? null
		slot.lastAccessAt = resource
			? (options?.lastAccessAt ?? (options?.touch !== false ? this.getNow() : 0))
			: 0
		const shouldClosePrevious =
			options?.closePrevious !== false &&
			!!previousResource &&
			previousResource !== resource &&
			!this.isResourceStillReferenced(entry, previousResource)
		if (shouldClosePrevious) {
			this.closeResource(previousResource, { entry, reason: "display-slot-replaced" })
		}
		return previousResource && previousResource !== resource ? previousResource : null
	}

	private setFullResource(
		entry: ImageResourceEntry,
		resource: ImageResource | null,
		options?: { touch?: boolean; lastAccessAt?: number },
	): ImageResource | null {
		const previousResource = entry.fullResource
		if (previousResource !== resource) {
			this.releaseDecodedResource(previousResource, { variant: "full" })
			this.retainDecodedResource(resource, { variant: "full" })
		}
		entry.fullResource = resource
		entry.fullLastAccessAt = resource
			? (options?.lastAccessAt ?? (options?.touch !== false ? this.getNow() : 0))
			: 0
		return previousResource && previousResource !== resource ? previousResource : null
	}

	private getDisplayLoadingPromise(
		entry: ImageResourceEntry,
		variant: ImageDisplayResourceVariant,
	): SharedAbortableRequest<LoadedResource | null> | null {
		return this.getDisplayResourceSlot(entry, variant).loadingPromise
	}

	private setDisplayLoadingPromise(
		entry: ImageResourceEntry,
		variant: ImageDisplayResourceVariant,
		request: SharedAbortableRequest<LoadedResource | null> | null,
	): void {
		this.getDisplayResourceSlot(entry, variant).loadingPromise = request
	}

	private clearDisplayResources(entry: ImageResourceEntry): void {
		for (const variant of MEDIA_DISPLAY_RESOURCE_VARIANTS) {
			this.setDisplayResource(entry, variant, null, { closePrevious: false })
		}
	}

	private cloneDisplayResourceSlots(entry: ImageResourceEntry): ImageDisplayResourceSlots {
		const slots = entry.displaySlots
		return {
			low: this.createDisplayResourceSlot({ ...slots.low }),
			preview: this.createDisplayResourceSlot({ ...slots.preview }),
		}
	}

	private restoreDisplayResourceSlots(
		entry: ImageResourceEntry,
		slots: ImageDisplayResourceSlots,
	): void {
		for (const variant of MEDIA_DISPLAY_RESOURCE_VARIANTS) {
			const slot = slots[variant]
			this.setDisplayResource(entry, variant, slot.resource, {
				version: slot.version,
				lastAccessAt: slot.lastAccessAt,
				closePrevious: false,
			})
			this.setDisplayLoadingPromise(entry, variant, slot.loadingPromise)
		}
	}

	private isResourceStillReferenced(entry: ImageResourceEntry, resource: ImageResource): boolean {
		const slots = entry.displaySlots
		return (
			slots.low.resource === resource ||
			slots.preview.resource === resource ||
			entry.fullResource === resource
		)
	}

	private findResourceByLoadedResource(
		entry: ImageResourceEntry,
		loadedResource: Pick<LoadedResource, "image" | "variant">,
	): ImageResource | null {
		const resources = [
			this.getDisplayResource(entry, "low"),
			this.getDisplayResource(entry, "preview"),
			entry.fullResource,
		]
		return (
			resources.find(
				(resource): resource is ImageResource =>
					!!resource &&
					resource.image === loadedResource.image &&
					resource.variant === loadedResource.variant,
			) ?? null
		)
	}

	private getNow(): number {
		return Date.now()
	}

	private getPersistentDisplayScope(): string {
		return buildSharedMediaStorageScope(
			this.canvas.magicConfigManager.config?.methods?.getVirtualResourceScope?.(),
			this.canvas.id,
		)
	}

	private getPersistentImageProcessRendition(): string {
		const signature =
			this.canvas.magicConfigManager.config?.methods?.getImageProcessCacheSignature?.() ??
			"default"
		return `image-process:${signature}:exif-orientation-v1`
	}

	private getPersistentLowIdentity(path: string, resourceVersion: string): string {
		return JSON.stringify([
			this.getPersistentDisplayScope(),
			path,
			this.getPersistentImageProcessRendition(),
			"low",
			resourceVersion,
		])
	}

	private getPersistentLowWriteKey(
		path: string,
		resourceVersion: string,
		generation: number,
	): string {
		return JSON.stringify([this.getPersistentLowIdentity(path, resourceVersion), generation])
	}

	private getPersistentLowGeneration(path: string): number {
		return this.persistentLowGenerationByPath.get(path) ?? 0
	}

	private advancePersistentLowGeneration(path: string): number {
		const generation = this.getPersistentLowGeneration(path) + 1
		this.persistentLowGenerationByPath.set(path, generation)
		return generation
	}

	private createPersistentLowWriteOrder(): string {
		const timestamp = Math.max(this.getNow(), this.persistentLowWriteTimestamp)
		this.persistentLowWriteTimestamp = timestamp
		return [
			String(timestamp).padStart(16, "0"),
			String(this.managerInstanceId).padStart(8, "0"),
			String(++this.persistentLowWriteSequence).padStart(8, "0"),
		].join(":")
	}

	private async loadPersistentDisplayResource(
		path: string,
		resourceIdentity: string,
		entry: ImageResourceEntry,
		shouldRefreshCached: boolean,
		priority: ImageResourceLoadPriority,
		signal?: AbortSignal,
	): Promise<LoadedResource | null> {
		if (this.destroyed) return null
		if (this.getDisplayResource(entry, "low") && !entry.staleDecodedVariants.has("low")) {
			return this.buildLoadedResource(entry, "low")
		}

		const existingRequest = entry.persistentLowLoadingPromise
		if (existingRequest && !existingRequest.isAborted) {
			return existingRequest.consume(signal)
		}

		const generation = this.getPersistentLowGeneration(resourceIdentity)
		const scope = this.getPersistentDisplayScope()
		const rendition = this.getPersistentImageProcessRendition()
		const request = new SharedAbortableRequest<LoadedResource | null>(
			async (sharedSignal) => {
				let cacheOutcomeRecorded = false
				const recordCacheMiss = () => {
					if (cacheOutcomeRecorded) return
					cacheOutcomeRecorded = true
					this.diagnostics.increment("persistentLowMissCount")
				}
				const recordCacheHit = () => {
					if (cacheOutcomeRecorded) return
					cacheOutcomeRecorded = true
					this.diagnostics.increment("persistentLowHitCount")
				}
				const record = await this.displayVariantPersistentCache.getLatest({
					scope,
					path: resourceIdentity,
					variant: "low",
					rendition,
					resourceVersion: entry.resourceVersion,
				})
				if (
					this.destroyed ||
					sharedSignal.aborted ||
					this.getPersistentLowGeneration(resourceIdentity) !== generation ||
					this.getPersistentDisplayScope() !== scope ||
					this.getPersistentImageProcessRendition() !== rendition ||
					!record
				) {
					recordCacheMiss()
					return null
				}
				if (entry.resourceVersion && entry.resourceVersion !== record.resourceVersion) {
					recordCacheMiss()
					return null
				}

				// low 只是首屏占位：最高到 visible，避免缓存命中反过来阻塞真正的 preview/full。
				const restorePriority: ImageResourceLoadPriority =
					priority === "critical" ? "visible" : priority
				const image = await this.canvas.resourceScheduler.run(
					"image:persistent-low-restore",
					(schedulerSignal) => {
						if (schedulerSignal.aborted || sharedSignal.aborted) {
							return Promise.resolve(null)
						}
						return createImageSourceFromBlob(record.blob)
					},
					{
						source: "image-resource:persistent-low-restore",
						canvasId: this.canvas.id,
						managerInstanceId: this.managerInstanceId,
						path: resourceIdentity,
						variant: "low",
						priority: restorePriority,
						signal: sharedSignal,
					},
				)
				if (
					this.destroyed ||
					sharedSignal.aborted ||
					this.getPersistentLowGeneration(resourceIdentity) !== generation ||
					this.getPersistentDisplayScope() !== scope ||
					this.getPersistentImageProcessRendition() !== rendition ||
					this.entries.get(resourceIdentity) !== entry ||
					(entry.resourceVersion && entry.resourceVersion !== record.resourceVersion)
				) {
					if (image) closeImageSource(image)
					recordCacheMiss()
					return null
				}
				if (!image) {
					recordCacheMiss()
					return null
				}

				entry.resourceVersion = record.resourceVersion
				entry.sourceUpdatedAt = record.sourceUpdatedAt
				entry.contentLength = record.contentLength

				const { width: sourceWidth, height: sourceHeight } = getImageSourceDimensions(image)
				const resource: ImageResource = {
					ossSrc: `persistent-cache:${path}`,
					image,
					imageInfo: record.imageInfo,
					variant: "low",
					sourceWidth,
					sourceHeight,
					isFullSize: false,
					closed: false,
					displayBlob: record.blob,
				}
				const previousResourceToClose = this.setDisplayResource(entry, "low", resource, {
					version: record.resourceVersion,
					closePrevious: true,
				})
				entry.staleDecodedVariants.delete("low")
				if (
					previousResourceToClose &&
					previousResourceToClose !== resource &&
					!this.isResourceStillReferenced(entry, previousResourceToClose)
				) {
					this.closeResource(previousResourceToClose, {
						entry,
						reason: "persistent-display-cache-replaced",
					})
				}

				const loadedResource = this.buildLoadedResource(entry, "low")
				if (!loadedResource) return null
				this.persistentLowReadyKeys.add(
					this.getPersistentLowIdentity(resourceIdentity, record.resourceVersion),
				)
				recordCacheHit()
				this.enforceDecodedBitmapBudget({
					reason: "persistent-display-cache-load",
					exemptResource: resource,
				})
				this.emitImageResourceLoaded({
					path,
					resource: loadedResource,
				})
				if (shouldRefreshCached) {
					this.triggerBackgroundMetadataRefresh(path, resourceIdentity, entry)
				}
				return loadedResource
			},
			{ abortValue: null },
		)
		entry.persistentLowLoadingPromise = request
		const clearLoadingRequest = () => {
			if (entry.persistentLowLoadingPromise === request) {
				entry.persistentLowLoadingPromise = null
			}
		}
		void request.promise.then(clearLoadingRequest, clearLoadingRequest)
		return request.consume(signal)
	}

	private persistDisplayResourceFromWorkerResult(
		path: string,
		entry: ImageResourceEntry,
		variant: ImageResourceVariant,
		result: ImageResourceWorkerResponse,
		imageInfo: ImageInfo,
	): void {
		if (variant !== "low") return
		const persistentDisplay = result.persistentDisplay
		if (!persistentDisplay || !entry.resourceVersion) return
		const resourceVersion = entry.resourceVersion
		const generation = this.getPersistentLowGeneration(path)
		const writeOrder = this.createPersistentLowWriteOrder()
		this.enqueuePersistentLowWrite(path, resourceVersion, generation, () =>
			this.writePersistentLowDisplayBlob(
				path,
				entry,
				persistentDisplay,
				imageInfo,
				resourceVersion,
				generation,
				writeOrder,
			),
		)
	}

	private enqueuePersistentLowWrite(
		path: string,
		resourceVersion: string,
		generation: number,
		write: () => Promise<void>,
	): void {
		const identity = this.getPersistentLowIdentity(path, resourceVersion)
		const writeKey = this.getPersistentLowWriteKey(path, resourceVersion, generation)
		if (
			this.persistentLowReadyKeys.has(identity) ||
			this.persistentLowWritePromises.has(writeKey)
		) {
			return
		}
		const writePromise = write()
			.catch(() => undefined)
			.finally(() => {
				this.persistentLowWritePromises.delete(writeKey)
			})
		this.persistentLowWritePromises.set(writeKey, writePromise)
	}

	private async writePersistentLowDisplayBlob(
		path: string,
		entry: ImageResourceEntry,
		persistentDisplay: NonNullable<ImageResourceWorkerResponse["persistentDisplay"]>,
		imageInfo: ImageInfo,
		resourceVersion: string,
		generation: number,
		writeOrder: string,
	): Promise<void> {
		if (
			this.destroyed ||
			this.entries.get(path) !== entry ||
			entry.resourceVersion !== resourceVersion ||
			this.getPersistentLowGeneration(path) !== generation
		) {
			return
		}
		const scope = this.getPersistentDisplayScope()
		const rendition = this.getPersistentImageProcessRendition()
		const accepted = await this.displayVariantPersistentCache.put({
			scope,
			path,
			variant: "low",
			rendition,
			blob: persistentDisplay.blob,
			imageInfo,
			resourceVersion,
			sourceUpdatedAt: entry.sourceUpdatedAt,
			contentLength: entry.contentLength,
			maxEdge: this.getMaxEdgeForVariant("low"),
			writeOrder,
		})
		if (!accepted) return
		if (
			this.destroyed ||
			this.entries.get(path) !== entry ||
			entry.resourceVersion !== resourceVersion ||
			this.getPersistentLowGeneration(path) !== generation ||
			this.getPersistentDisplayScope() !== scope ||
			this.getPersistentImageProcessRendition() !== rendition
		) {
			await this.displayVariantPersistentCache.removeWriteOrder(
				scope,
				path,
				rendition,
				resourceVersion,
				writeOrder,
			)
			return
		}
		this.persistentLowReadyKeys.add(this.getPersistentLowIdentity(path, resourceVersion))
	}

	private getPersistentLowDecodedSource(entry: ImageResourceEntry): ImageResource | null {
		const previewResource = this.getDisplayResource(entry, "preview")
		if (
			previewResource &&
			!previewResource.closed &&
			!entry.staleDecodedVariants.has("preview")
		) {
			return previewResource
		}
		const fullResource = entry.fullResource
		if (fullResource && !fullResource.closed && !entry.staleDecodedVariants.has("full")) {
			return fullResource
		}
		return null
	}

	private async createPersistentLowCandidate(
		resource: ImageResource,
		signal: AbortSignal,
	): Promise<ImageBitmap | null> {
		if (signal.aborted || resource.closed || typeof createImageBitmap !== "function") {
			return null
		}
		const { width, height } = getImageSourceDimensions(resource.image)
		const maxEdge = this.getMaxEdgeForVariant("low") ?? 0
		const largestEdge = Math.max(width, height)
		const resize =
			maxEdge > 0 && largestEdge > maxEdge
				? {
						resizeWidth: Math.max(1, Math.round((width * maxEdge) / largestEdge)),
						resizeHeight: Math.max(1, Math.round((height * maxEdge) / largestEdge)),
					}
				: undefined

		try {
			const candidate = resize
				? await createImageBitmap(resource.image, {
						...resize,
						resizeQuality: "high",
					})
				: await createImageBitmap(resource.image)
			if (signal.aborted || resource.closed) {
				candidate.close()
				return null
			}
			return candidate
		} catch {
			return null
		}
	}

	private async encodePersistentLowFromDecodedSource(
		entry: ImageResourceEntry,
		ossSrc: string,
		signal: AbortSignal,
	): Promise<ImageResourceWorkerResponse | null> {
		const resource = this.getPersistentLowDecodedSource(entry)
		if (!resource) return null
		const candidate = await this.createPersistentLowCandidate(resource, signal)
		if (!candidate) return null

		const requestId = this.createWorkerRequestId("img-persist-low-encode")
		try {
			return await this.sendToWorker(
				{
					type: "encode-persistent-low",
					ossSrc: resource.ossSrc || ossSrc,
					requestId,
					variant: "low",
					maxEdge: this.getMaxEdgeForVariant("low"),
					imageSource: candidate,
					imageInfo: resource.imageInfo,
				},
				{ signal, priority: "background" },
			)
		} catch {
			candidate.close()
			return null
		}
	}

	private schedulePersistentLowFromBody(
		path: string,
		entry: ImageResourceEntry,
		body: MediaResourceBody,
	): void {
		const resourceVersion = entry.resourceVersion
		if (!resourceVersion) return
		// 后台队列只保留重取 body 所需的 identity，不能捕获完整原图 Blob。
		// 若执行时 body 已被预算淘汰，则优先使用仍存活的 decoded source，否则跳过本轮持久化。
		const bodyCacheKey = body.cacheKey
		const bodyOssSrc = body.ossSrc
		const generation = this.getPersistentLowGeneration(path)
		const writeOrder = this.createPersistentLowWriteOrder()
		this.enqueuePersistentLowWrite(path, resourceVersion, generation, async () => {
			const result = await this.canvas.resourceScheduler.run(
				"image:persistent-low-write",
				async (signal) => {
					const decodedSourceResult = await this.encodePersistentLowFromDecodedSource(
						entry,
						bodyOssSrc,
						signal,
					)
					if (decodedSourceResult?.persistentDisplay) return decodedSourceResult
					if (
						signal.aborted ||
						this.destroyed ||
						this.entries.get(path) !== entry ||
						entry.resourceVersion !== resourceVersion ||
						this.getPersistentLowGeneration(path) !== generation
					) {
						return decodedSourceResult
					}
					const currentBody = this.getReusableBody(entry, bodyOssSrc, bodyCacheKey)
					if (
						!currentBody ||
						(typeof currentBody.resourceGeneration === "number" &&
							currentBody.resourceGeneration !== generation)
					) {
						return decodedSourceResult
					}
					const requestId = this.createWorkerRequestId("img-persist-low")
					return this.sendToWorker(
						{
							type: "decode",
							ossSrc: currentBody.ossSrc,
							blob: currentBody.blob,
							requestId,
							variant: "low",
							maxEdge: this.getMaxEdgeForVariant("low"),
						},
						{ signal, priority: "background" },
					)
				},
				{
					source: "image-resource:persistent-low-write",
					canvasId: this.canvas.id,
					managerInstanceId: this.managerInstanceId,
					path,
					variant: "low",
					cacheKey: bodyCacheKey,
					url: bodyOssSrc,
					priority: "background",
				},
			)
			if (
				this.destroyed ||
				this.entries.get(path) !== entry ||
				entry.resourceVersion !== resourceVersion ||
				this.getPersistentLowGeneration(path) !== generation
			) {
				if (result?.imageSource) closeImageSource(result.imageSource)
				return
			}
			if (result?.imageSource) closeImageSource(result.imageSource)
			if (!result?.persistentDisplay || !result.imageInfo) return
			await this.writePersistentLowDisplayBlob(
				path,
				entry,
				result.persistentDisplay,
				result.imageInfo,
				resourceVersion,
				generation,
				writeOrder,
			)
		})
	}

	private ensurePersistentLowFromBody(
		path: string,
		entry: ImageResourceEntry,
		body: MediaResourceBody,
	): void {
		const resourceVersion = entry.resourceVersion
		if (!resourceVersion) return
		const identity = this.getPersistentLowIdentity(path, resourceVersion)
		const lowResource = this.getDisplayResource(entry, "low")
		if (
			this.persistentLowReadyKeys.has(identity) ||
			(!!lowResource?.displayBlob && !entry.staleDecodedVariants.has("low"))
		) {
			return
		}

		const bootstrapRequest = entry.persistentLowLoadingPromise
		if (bootstrapRequest && !bootstrapRequest.isAborted) {
			void bootstrapRequest.promise.then(
				(restored) => {
					if (!restored) this.schedulePersistentLowFromBody(path, entry, body)
				},
				() => this.schedulePersistentLowFromBody(path, entry, body),
			)
			return
		}

		this.schedulePersistentLowFromBody(path, entry, body)
	}

	private getBodyCacheKey(path: string, ossSrc: string, entry: ImageResourceEntry): string {
		return this.bodyCache.getCacheKey(path, ossSrc, entry)
	}

	private clearEntryBody(entry: ImageResourceEntry): void {
		this.bodyCache.clearBody(entry)
	}

	private clearEntryBodyPromise(entry: ImageResourceEntry): void {
		this.bodyCache.clearBodyPromise(entry)
	}

	private getReusableBody(
		entry: ImageResourceEntry,
		ossSrc: string,
		cacheKey: string,
	): MediaResourceBody | null {
		return this.bodyCache.getReusableBody(entry, ossSrc, cacheKey)
	}

	private migrateBodyCacheKeyAfterMetadataHydration(
		resourceIdentity: string,
		entry: ImageResourceEntry,
	): void {
		if (!entry.bodyBlob || !entry.bodyCacheKey) return
		const previousCacheKey = entry.bodyCacheKey
		if (!previousCacheKey.startsWith(`${resourceIdentity}::`)) return

		const ossSrc = entry.bodyOssSrc ?? entry.ossSrc ?? entry.sourceUrl ?? ""
		const hydratedCacheKey = this.getBodyCacheKey(resourceIdentity, ossSrc, entry)
		this.bodyCache.rekeyBodyCacheKey(entry, previousCacheKey, hydratedCacheKey)
		entry.bodyCacheKey = hydratedCacheKey
		if (entry.bodyPromiseCacheKey === previousCacheKey) {
			entry.bodyPromiseCacheKey = hydratedCacheKey
		}
	}

	private handleResourceVersionChanged(
		resourceIdentity: string,
		entry: ImageResourceEntry,
		previousVersion: string,
	): void {
		this.markDecodedVariantsStale(entry)
		this.clearEntryBody(entry)
		this.invalidatePersistentLowGeneration(resourceIdentity, entry, previousVersion, {
			removePersistentRecord: false,
		})
	}

	private invalidatePersistentLowGeneration(
		path: string,
		entry: ImageResourceEntry,
		resourceVersion?: string | null,
		options?: { removePersistentRecord?: boolean },
	): void {
		const invalidatedThroughWriteOrder = this.createPersistentLowWriteOrder()
		this.advancePersistentLowGeneration(path)
		entry.persistentLowLoadingPromise?.abort()
		const removePersistentRecord = options?.removePersistentRecord !== false
		if (!resourceVersion) {
			if (removePersistentRecord) {
				void this.displayVariantPersistentCache.removeByPath(
					this.getPersistentDisplayScope(),
					path,
					invalidatedThroughWriteOrder,
				)
			}
			return
		}

		this.persistentLowReadyKeys.delete(this.getPersistentLowIdentity(path, resourceVersion))
		if (removePersistentRecord) {
			void this.displayVariantPersistentCache.removeVersion(
				this.getPersistentDisplayScope(),
				path,
				this.getPersistentImageProcessRendition(),
				resourceVersion,
				invalidatedThroughWriteOrder,
			)
		}
	}

	private evictBodyCacheBudget(exemptEntry?: ImageResourceEntry): void {
		this.bodyCache.evictBudget(this.entries.values(), exemptEntry)
	}

	private closeEntryResources(entry: ImageResourceEntry, options?: { reason?: string }): void {
		const lowResource = this.getDisplayResource(entry, "low")
		const previewResource = this.getDisplayResource(entry, "preview")
		const fullResource = entry.fullResource
		this.closeUniqueResources([lowResource, previewResource, fullResource], {
			entry,
			...options,
		})
		this.clearDisplayResources(entry)
		this.setFullResource(entry, null)
		this.clearEntryBody(entry)
		this.clearEntryBodyPromise(entry)
		entry.staleDecodedVariants.clear()
	}

	private getVariantsToRefresh(entry: ImageResourceEntry): ImageResourceVariant[] {
		const variantsToRefresh: ImageResourceVariant[] = MEDIA_DISPLAY_RESOURCE_VARIANTS.filter(
			(variant) => this.getDisplayResource(entry, variant),
		)
		if (entry.fullResource) {
			variantsToRefresh.push("full")
		}
		if (variantsToRefresh.length === 0) {
			variantsToRefresh.push(DEFAULT_IMAGE_RESOURCE_VARIANT)
		}
		return variantsToRefresh
	}

	private markDecodedVariantsStale(
		entry: ImageResourceEntry,
		requestedVariant?: ImageResourceVariant,
	): void {
		for (const variant of MEDIA_DISPLAY_RESOURCE_VARIANTS) {
			if (this.getDisplayResource(entry, variant)) {
				entry.staleDecodedVariants.add(variant)
			}
		}
		if (entry.fullResource) entry.staleDecodedVariants.add("full")
		if (requestedVariant) entry.staleDecodedVariants.add(requestedVariant)
	}

	/**
	 * 加载图片（内部方法）
	 * @param path 路径（path）
	 * @returns Promise<LoadedResource | null>
	 */
	private async loadImageInternal(
		path: string,
		options?: ImageResourceInternalLoadOptions,
	): Promise<LoadedResource | null> {
		if (this.destroyed) {
			this.markStaleRequestDrop()
			return null
		}
		if (this.shouldDropAbortedLoad(options)) return null
		if (this.canvas.canvasFileUploadManager.shouldDeferRemoteResourceLoad(path)) {
			return null
		}
		const resourceIdentity = this.getResourceIdentity(path)
		const entry = this.getOrCreateEntry(resourceIdentity, path)
		const resourceStateGeneration = entry.resourceStateGeneration
		const shouldRefreshCached = options?.refreshCached !== false
		const variant = options?.variant ?? DEFAULT_IMAGE_RESOURCE_VARIANT
		const priority = this.normalizeLoadPriority(options?.priority, variant)
		const availability = getCanvasResourceAvailability(
			path,
			this.canvas.magicConfigManager.config?.methods?.resolveResourceReference,
		)

		// Attachment existence is authoritative over decoded and persistent caches. Otherwise a
		// deleted historical reference can be revived from IndexedDB without ever querying the host.
		if (availability === "deleted" && !this.isPrimedResourceAwaitingResolverSnapshot(entry)) {
			this.handleImageResourceDeleted(resourceIdentity, entry)
			return null
		}

		// 检查 ossSrc 是否过期，过期则清除
		if (this.clearExpiredOssSrc(entry)) {
			entry.bodyOssSrc = null
			this.markDecodedVariantsStale(entry, variant)
		}
		this.applyVirtualResourceBypass(entry)

		// 检查缓存
		const cachedMemoryResource = this.getResourceForVariant(entry, variant)
		if (cachedMemoryResource && !entry.staleDecodedVariants.has(variant)) {
			this.diagnostics.increment("memoryHitCount")
			this.setFailureReason(entry, null)
			return this.buildLoadedResource(entry, variant)
		}

		const shouldRestorePersistentLow =
			variant === "low" || options?.restorePersistentLow === true
		if (shouldRestorePersistentLow) {
			const persistentLowPromise = this.loadPersistentDisplayResource(
				path,
				resourceIdentity,
				entry,
				shouldRefreshCached && variant === "low",
				priority,
				options?.signal,
			)
			if (variant === "low") {
				const persistentDisplayResource = await persistentLowPromise
				if (this.shouldDropAbortedLoad(options)) return null
				if (!this.isResourceStateGenerationCurrent(entry, resourceStateGeneration)) {
					this.markStaleRequestDrop()
					return null
				}
				if (persistentDisplayResource) return persistentDisplayResource
			} else {
				// low 是 bootstrap surface，不应阻塞 preview/full 的网络与 body 加载。
				void persistentLowPromise.catch(() => null)
			}
		}

		// 检查是否正在加载中，避免重复请求
		const loadingRequest = this.getLoadingPromiseForVariant(entry, variant)
		if (loadingRequest && !loadingRequest.isAborted) {
			this.diagnostics.increment("loadingDedupedCount")
			this.upgradeQueuedPreviewLoad(resourceIdentity, variant, priority)
			const result = await loadingRequest.consume(options?.signal)
			if (this.destroyed) return null
			const wasAborted = this.shouldDropAbortedLoad(options)
			if (!this.isResourceStateGenerationCurrent(entry, resourceStateGeneration)) {
				this.markStaleRequestDrop()
				return null
			}
			if (!result && this.emitNotFoundLoadFailedIfNeeded(entry)) {
				return null
			}
			if (wasAborted) return null
			if (!result) {
				if (variant === "preview") {
					this.emitPreviewLoadFailed(entry)
				} else {
					this.emitVariantLoadFailed(
						entry,
						variant,
						entry.lastFailureReason ?? "load-error",
					)
				}
			}
			return result
		}

		const request = new SharedAbortableRequest<LoadedResource | null>(
			(signal) => {
				const pipelineOptions = { ...options, signal }
				return variant !== "full" && !options?.bypassQueue
					? this.runPreviewLoadPipelineQueued(
							path,
							resourceIdentity,
							entry,
							shouldRefreshCached,
							variant,
							priority,
							pipelineOptions,
						)
					: this.loadImageResourcePipeline(
							path,
							resourceIdentity,
							entry,
							shouldRefreshCached,
							variant,
							priority,
							pipelineOptions,
						)
			},
			{ abortValue: null },
		)
		this.setLoadingPromiseForVariant(entry, variant, request)
		void request.promise.then(
			() => {
				if (this.getLoadingPromiseForVariant(entry, variant) === request) {
					this.setLoadingPromiseForVariant(entry, variant, null)
				}
			},
			() => {
				if (this.getLoadingPromiseForVariant(entry, variant) === request) {
					this.setLoadingPromiseForVariant(entry, variant, null)
				}
			},
		)

		const result = await request.consume(options?.signal)
		if (this.destroyed) return null
		const wasAborted = this.shouldDropAbortedLoad(options)
		if (!this.isResourceStateGenerationCurrent(entry, resourceStateGeneration)) {
			this.markStaleRequestDrop()
			return null
		}
		if (!result && this.emitNotFoundLoadFailedIfNeeded(entry)) {
			return null
		}
		if (wasAborted) return null
		if (!result) {
			if (variant === "preview") {
				this.emitPreviewLoadFailed(entry)
			} else {
				this.emitVariantLoadFailed(entry, variant, entry.lastFailureReason ?? "load-error")
			}
		}
		return result
	}

	private emitPreviewLoadFailed(entry: ImageResourceEntry): void {
		const reason = entry.lastFailureReason ?? "load-error"
		const hasUsableLow =
			!!this.getDisplayResource(entry, "low") && !entry.staleDecodedVariants.has("low")
		this.emitImageResourceLoadFailed(
			{
				path: entry.referencePath,
				reason,
				preservePreview: reason !== "not-found" && hasUsableLow,
			},
			entry.resourceIdentity,
		)
	}

	private emitNotFoundLoadFailedIfNeeded(entry: ImageResourceEntry): boolean {
		if (entry.lastFailureReason !== "not-found") return false
		this.emitImageResourceLoadFailed(
			{
				path: entry.referencePath,
				reason: "not-found",
			},
			entry.resourceIdentity,
		)
		return true
	}

	private emitVariantLoadFailed(
		entry: ImageResourceEntry,
		variant: ImageResourceVariant,
		reason: ResourceLoadFailureReason,
	): void {
		this.canvas.eventEmitter.emit({
			type: "resource:image:variant-load-failed",
			data: {
				path: entry.referencePath,
				variant,
				reason,
			},
		})
	}

	private async loadImageResourcePipeline(
		path: string,
		resourceIdentity: string,
		entry: ImageResourceEntry,
		shouldRefreshCached: boolean,
		variant: ImageResourceVariant,
		priority?: ImageResourceLoadPriority,
		options?: ImageResourceLoadOptions,
	): Promise<LoadedResource | null> {
		if (this.shouldDropAbortedLoad(options)) return null
		if (variant === "low") {
			return this.loadLowResourcePipeline(path, resourceIdentity, entry, priority, options)
		}

		const cachedResource = await this.loadCachedImageResource(
			path,
			resourceIdentity,
			entry,
			variant,
		)
		if (this.destroyed) return null
		if (this.shouldDropAbortedLoad(options)) return null
		if (cachedResource) {
			if (shouldRefreshCached) {
				this.triggerBackgroundMetadataRefresh(path, resourceIdentity, entry)
			}
			return cachedResource
		}
		this.clearCachedFallbackOssSrc(entry)

		const getFileInfo = this.canvas.magicConfigManager.config?.methods?.getFileInfo
		if (!getFileInfo) {
			this.setFailureReason(entry, "load-error")
			return null
		}

		// 换取 ossSrc
		let ossSrc: string | null = entry.ossSrc
		if (!ossSrc) {
			ossSrc = await this.exchangeOssSrc(path, entry, { priority })
			if (this.destroyed) return null
			if (this.shouldDropAbortedLoad(options)) return null
			if (!ossSrc) {
				return null
			}
		}

		return this.loadImageResource(
			resourceIdentity,
			ossSrc,
			entry,
			variant,
			priority,
			0,
			options,
		)
	}

	private async loadLowResourcePipeline(
		path: string,
		resourceIdentity: string,
		entry: ImageResourceEntry,
		priority?: ImageResourceLoadPriority,
		options?: ImageResourceLoadOptions,
	): Promise<LoadedResource | null> {
		if (this.shouldDropAbortedLoad(options)) return null
		const cachedBodyOssSrc = this.bodyCache.getCachedOssSrc(entry)
		if (cachedBodyOssSrc) {
			return this.loadImageResource(
				resourceIdentity,
				cachedBodyOssSrc,
				entry,
				"low",
				priority,
				0,
				options,
			)
		}

		let ossSrc = entry.ossSrc
		if (!ossSrc) {
			ossSrc = await this.exchangeOssSrc(path, entry, { priority })
			if (this.destroyed) return null
			if (this.shouldDropAbortedLoad(options)) return null
		}
		if (!ossSrc) {
			return null
		}

		return this.loadImageResource(resourceIdentity, ossSrc, entry, "low", priority, 0, options)
	}

	/**
	 * 触发资源加载（不等待；low/preview 通过 resource:image:loaded 通知，full 通过 displayTargetElementId 定向通知）
	 * @param path 路径（path）
	 */
	public loadResource(path: string, options?: ImageResourceLoadOptions): void {
		const requestedVariant = options?.variant ?? DEFAULT_IMAGE_RESOURCE_VARIANT
		this.loadImageInternal(path, {
			...options,
			// Full loads are requested for high-quality display/export targets. They should not
			// start an unrelated IndexedDB low-cache lookup; preview/low display loads still use
			// low as the fast bootstrap surface when available.
			restorePersistentLow: requestedVariant !== "full",
		})
			.then((resource) => {
				if (!resource) return
				this.emitDisplayLoadedIfNeeded(path, resource, options)
			})
			.catch(() => {
				// 静默吞掉错误，调用方通过事件或 getResource 感知失败
			})
	}

	private emitDisplayLoadedIfNeeded(
		path: string,
		resource: LoadedResource,
		options?: ImageResourceLoadOptions,
	): void {
		if (resource.variant !== "full") return
		if (!options?.displayTargetElementId) return

		this.emitImageResourceDisplayLoaded({
			elementId: options.displayTargetElementId,
			path,
			resource,
			reason: options.displayTargetReason ?? "display-target",
		})
	}

	/**
	 * 获取资源（如未加载则触发加载并等待）
	 * @param path 路径（path）
	 * @returns Promise<LoadedResource | null>
	 */
	public async getResource(
		path: string,
		options?: ImageResourceLoadOptions,
	): Promise<LoadedResource | null> {
		return this.loadImageInternal(path, options)
	}

	/**
	 * 获取 low 档位的可展示 URL；用于图层、消息等低清展示场景。
	 * @param path 路径（path）
	 */
	public async getLowImageUrl(path: string): Promise<LoadedLowImageUrl | null> {
		const resourceIdentity = this.getResourceIdentity(path)
		const resource = await this.loadImageInternal(path, {
			refreshCached: false,
			variant: "low",
		})
		if (!resource) return null

		const entry = this.entries.get(resourceIdentity)
		const backingResource = entry ? this.findResourceByLoadedResource(entry, resource) : null
		if (entry && backingResource?.displayBlob) {
			const url = URL.createObjectURL(backingResource.displayBlob)
			entry.lowDisplayLeaseCount += 1
			let released = false
			return {
				url,
				imageInfo: resource.imageInfo,
				release: () => {
					if (released) return
					released = true
					URL.revokeObjectURL(url)
					entry.lowDisplayLeaseCount = Math.max(0, entry.lowDisplayLeaseCount - 1)
				},
			}
		}

		return null
	}

	/**
	 * Drop a superseded low decoded surface after the presentation scheduler has applied a
	 * higher-quality surface. The compressed low representation remains recoverable from the
	 * persistent cache, while low URL leases keep callers that still need the bitmap protected.
	 */
	public releaseSupersededLowIfUnused(path: string): void {
		if (this.destroyed) return
		const resourceIdentity = this.getResourceIdentity(path)
		const entry = this.entries.get(resourceIdentity)
		const lowResource = entry ? this.getDisplayResource(entry, "low") : null
		if (!entry || !lowResource || entry.lowDisplayLeaseCount > 0) return

		this.setDisplayResource(entry, "low", null, { closePrevious: false })
		if (!this.isResourceStillReferenced(entry, lowResource)) {
			this.closeResourceAfterConsumersSwap(lowResource, {
				entry,
				reason: "superseded-by-higher-quality-display",
			})
		}
	}

	/**
	 * 读取指定 path 对应的资源条目（无缓存则 undefined）
	 */
	public getEntry(path: string): Readonly<ImageResourceEntry> | undefined {
		const canonical = this.getResourceIdentity(path)
		return this.entries.get(canonical)
	}

	public peekResource(
		path: string,
		options?: { variant?: ImageResourceVariant },
	): LoadedResource | null {
		const canonical = this.getResourceIdentity(path)
		const entry = this.entries.get(canonical)
		if (!entry) return null
		return this.buildLoadedResource(entry, options?.variant ?? DEFAULT_IMAGE_RESOURCE_VARIANT)
	}

	public getFailureReason(path: string): ResourceLoadFailureReason | null {
		const canonical = this.urlLifecycle.getResourceIdentity(path)
		return this.entries.get(canonical)?.lastFailureReason ?? null
	}

	public markResourceLoadFailed(path: string, reason: ResourceLoadFailureReason): void {
		if (this.destroyed) return
		const resourceIdentity = this.getResourceIdentity(path)
		const entry = this.getOrCreateEntry(resourceIdentity, path)
		this.setFailureReason(entry, reason)
		this.emitImageResourceLoadFailed(
			{
				path: entry.referencePath,
				reason,
			},
			resourceIdentity,
		)
	}

	public getFullAdmissionSnapshot(): ImageFullAdmissionSnapshot {
		this.ensureDecodedByteTrackingState()
		let fullLoadingCount = 0
		this.entries.forEach((entry) => {
			if (entry.fullLoadingPromise) fullLoadingCount += 1
		})
		return {
			fullDecodedBytes: this.fullDecodedBytes,
			fullLoadingCount,
			fullBudgetBytes: this.decodedCacheBudgets.fullBytes,
		}
	}

	/** Visibility settles after movement or far-drain; only then should decoded LRU shrink. */
	public enforceDecodedCacheBudget(reason = "manual"): void {
		this.enforceDecodedBitmapBudget({ reason })
	}

	public getSnapshot(): ImageResourceSnapshot {
		let lowLoaded = 0
		let lowDecodedBytes = 0
		let previewLoaded = 0
		let previewDecodedBytes = 0
		let fullLoaded = 0
		let fullDecodedBytes = 0
		let decodedBytesTotal = 0
		let decodedLowLeaseCount = 0
		let loadingCount = 0
		let exchangingCount = 0
		let fullLoadingCount = 0
		const retentionIndex = this.getDecodedBitmapRetentionIndex()
		const countedDecodedResources = new Set<ImageResource>()
		const pinnedDecodedResources = new Set<ImageResource>()
		const visiblePinnedResources = new Set<ImageResource>()
		const nearProtectedResources = new Set<ImageResource>()
		const addDecodedTotal = (resource: ImageResource | null) => {
			if (!resource || countedDecodedResources.has(resource)) return
			countedDecodedResources.add(resource)
			decodedBytesTotal += this.getDecodedBytes(resource)
		}
		const trackRetention = (
			path: string,
			variant: DecodedBitmapCandidateVariant,
			resource: ImageResource | null,
		) => {
			if (!resource) return
			const retentionLevel = this.getDecodedBitmapRetentionLevelForPathVariant(
				path,
				variant,
				retentionIndex,
			)
			if (!retentionLevel) return
			pinnedDecodedResources.add(resource)
			if (retentionLevel === "visible") {
				visiblePinnedResources.add(resource)
				nearProtectedResources.delete(resource)
				return
			}
			if (!visiblePinnedResources.has(resource)) {
				nearProtectedResources.add(resource)
			}
		}

		this.entries.forEach((entry, path) => {
			decodedLowLeaseCount += entry.lowDisplayLeaseCount
			for (const variant of MEDIA_DISPLAY_RESOURCE_VARIANTS) {
				const resource = this.getDisplayResource(entry, variant)
				if (!resource) continue
				const decodedBytes = this.getDecodedBytes(resource)
				addDecodedTotal(resource)
				trackRetention(path, variant, resource)
				switch (variant) {
					case "low":
						lowLoaded += 1
						lowDecodedBytes += decodedBytes
						break
					case "preview":
						previewLoaded += 1
						previewDecodedBytes += decodedBytes
						break
				}
			}
			if (entry.fullResource) {
				fullLoaded += 1
				fullDecodedBytes += this.getDecodedBytes(entry.fullResource)
				addDecodedTotal(entry.fullResource)
				trackRetention(path, "full", entry.fullResource)
			}
			if (entry.exchangePromise) exchangingCount += 1
			for (const variant of MEDIA_DISPLAY_RESOURCE_VARIANTS) {
				if (this.getDisplayLoadingPromise(entry, variant)) loadingCount += 1
			}
			if (entry.fullLoadingPromise) fullLoadingCount += 1
		})
		const bodyCacheSnapshot = this.bodyCache.getSnapshot(this.entries.values())
		const workerSnapshot = this.workerClient?.getSnapshot()
		let decodedPinnedBytes = 0
		pinnedDecodedResources.forEach((resource) => {
			decodedPinnedBytes += this.getDecodedBytes(resource)
		})

		const current: ImageResourceCurrentSnapshot = {
			managerInstanceId: this.managerInstanceId,
			destroyed: this.destroyed,
			entries: this.entries.size,
			lowLoaded,
			lowDecodedBytes,
			previewLoaded,
			previewDecodedBytes,
			fullLoaded,
			fullDecodedBytes,
			decodedBytesTotal,
			lowDecodedBudgetBytes: this.decodedCacheBudgets.lowBytes,
			previewDecodedBudgetBytes: this.decodedCacheBudgets.previewBytes,
			fullDecodedBudgetBytes: this.decodedCacheBudgets.fullBytes,
			decodedBudgetSoftBytes: this.decodedCacheBudgets.totalSoftBytes,
			decodedBudgetHardBytes: this.decodedCacheBudgets.totalHardBytes,
			decodedLowLeaseCount,
			decodedPinnedBytes,
			decodedPinnedCount: pinnedDecodedResources.size,
			decodedVisiblePinnedCount: visiblePinnedResources.size,
			decodedNearProtectedCount: nearProtectedResources.size,
			...bodyCacheSnapshot,
			activePreviewLoadPipelineCount: this.activePreviewLoadPipelineCount,
			queuedPreviewLoadCount: this.previewLoadQueue.length,
			workerActiveRequestCount: workerSnapshot?.activeRequestCount ?? 0,
			workerActivePixelCost: workerSnapshot?.activePixelCost ?? 0,
			workerQueuedRequestCount: workerSnapshot?.queuedRequestCount ?? 0,
			activeDecodePixelCost: this.decodePixelBudgetGate.activePixelCost,
			queuedDecodePermitCount: this.decodePixelBudgetGate.queuedCount,
			loadingCount,
			exchangingCount,
			fullLoadingCount,
		}
		return buildImageResourceSnapshot(current, this.diagnostics.snapshot())
	}

	public async ensureFreshOssInfo(
		path: string,
		options?: {
			forceRefresh?: boolean
			allowCachedFallback?: boolean
			priority?: ImageResourceLoadPriority
		},
	): Promise<ResolvedImageOssInfo | null> {
		if (this.destroyed) {
			return null
		}
		if (this.canvas.canvasFileUploadManager.shouldDeferRemoteResourceLoad(path)) {
			return null
		}
		const resourceIdentity = this.getResourceIdentity(path)
		const entry = this.getOrCreateEntry(resourceIdentity, path)
		return this.urlLifecycle.ensureFreshOssInfo(path, entry, options)
	}

	public async ensureFreshOssSrc(
		path: string,
		options?: {
			forceRefresh?: boolean
			allowCachedFallback?: boolean
			priority?: ImageResourceLoadPriority
		},
	): Promise<string | null> {
		return (await this.ensureFreshOssInfo(path, options))?.ossSrc ?? null
	}

	public async refreshResource(path: string): Promise<boolean> {
		if (this.destroyed) {
			this.markStaleRequestDrop()
			return false
		}
		this.diagnostics.increment("refreshResourceCount")
		const resourceIdentity = this.getResourceIdentity(path)
		if (!resourceIdentity) return false

		const entry = this.getOrCreateEntry(resourceIdentity, path)
		const previousRefresh = entry.refreshPromise
		const resourceStateGeneration = entry.resourceStateGeneration
		const refreshPromise = (async () => {
			if (previousRefresh) {
				await previousRefresh.catch(() => false)
			}
			if (this.destroyed) return false
			return this.refreshImageResourceFromNetwork(
				path,
				resourceIdentity,
				entry,
				resourceStateGeneration,
			)
		})()
		entry.refreshPromise = refreshPromise

		try {
			return await refreshPromise
		} finally {
			if (entry.refreshPromise === refreshPromise) {
				entry.refreshPromise = null
			}
		}
	}

	private async refreshImageResourceFromNetwork(
		path: string,
		resourceIdentity: string,
		entry: ImageResourceEntry,
		resourceStateGeneration = entry.resourceStateGeneration,
	): Promise<boolean> {
		if (this.destroyed) return false
		if (!this.isResourceStateGenerationCurrent(entry, resourceStateGeneration)) return false
		for (const variant of MEDIA_DISPLAY_RESOURCE_VARIANTS) {
			await this.getDisplayLoadingPromise(entry, variant)?.promise.catch(() => null)
		}
		if (entry.fullLoadingPromise) {
			await entry.fullLoadingPromise.promise.catch(() => null)
		}
		if (!this.isResourceStateGenerationCurrent(entry, resourceStateGeneration)) return false
		const previousDisplaySlots = this.cloneDisplayResourceSlots(entry)
		const previousLowResource = previousDisplaySlots.low.resource
		const previousResource = previousDisplaySlots.preview.resource
		const previousFullResource = entry.fullResource
		const hasPreviousDecodedResource = Boolean(
			previousLowResource || previousResource || previousFullResource,
		)
		const previousFullLastAccessAt = entry.fullLastAccessAt
		const previousBodyState = this.bodyCache.captureState(entry)
		const previousSource = entry.source
		const previousFileName = entry.fileName
		const previousResourceVersion = entry.resourceVersion
		const previousSourceUpdatedAt = entry.sourceUpdatedAt
		const previousContentLength = entry.contentLength
		const variantsToRefresh = this.getVariantsToRefresh(entry)
		const previousLowWasFresh = !!previousLowResource && !entry.staleDecodedVariants.has("low")
		const restorePreviousDecodedState = () => {
			const currentLowResource = this.getDisplayResource(entry, "low")
			const currentPreviewResource = this.getDisplayResource(entry, "preview")
			const currentFullResource = entry.fullResource
			this.restoreDisplayResourceSlots(entry, previousDisplaySlots)
			this.setFullResource(entry, previousFullResource, {
				lastAccessAt: previousFullLastAccessAt,
			})
			this.closeUniqueResources(
				[currentLowResource, currentPreviewResource, currentFullResource].filter(
					(resource) =>
						resource !== previousLowResource &&
						resource !== previousResource &&
						resource !== previousFullResource,
				),
				{ entry, reason: "refresh-rollback" },
			)
			this.bodyCache.restoreState(entry, previousBodyState)
			// 保留压缩 body 作为可能的解码复用，但禁止在新 URL 生成前返回旧签名。
			entry.bodyOssSrc = null
		}
		const restorePreviousResourceState = () => {
			entry.ossSrc = null
			entry.expiresAt = null
			entry.ossSrcFromCachedFallback = false
			entry.sourceUrl = null
			entry.source = previousSource
			entry.fileName = previousFileName
			entry.resourceVersion = previousResourceVersion
			entry.sourceUpdatedAt = previousSourceUpdatedAt
			entry.contentLength = previousContentLength
			restorePreviousDecodedState()
		}
		const clearDeletedResourceMetadata = () => {
			entry.sourceUrl = null
			entry.source = undefined
			entry.fileName = undefined
			entry.resourceVersion = null
			entry.sourceUpdatedAt = null
			entry.contentLength = null
		}

		this.canvas.mediaResourceOfflineCacheManager.removeCachedResource({
			path,
			mediaType: "image",
		})
		const ossSrc = await this.exchangeOssSrc(path, entry, {
			forceRefresh: true,
			priority: "critical",
		})
		if (this.destroyed) return false
		if (!this.isResourceStateGenerationCurrent(entry, resourceStateGeneration)) {
			this.markStaleRequestDrop()
			return false
		}
		if (!ossSrc) {
			const reason = entry.lastFailureReason ?? "not-found"
			// 附件已删除（同路径无文件）：禁止恢复旧位图，否则画布仍显示已删文件内容
			if (reason === "not-found") {
				void this.displayVariantPersistentCache.removeByPath(
					this.getPersistentDisplayScope(),
					resourceIdentity,
				)
				this.closeResource(previousLowResource, {
					entry,
					reason: "refresh-deleted",
				})
				this.closeResource(previousResource, {
					entry,
					reason: "refresh-deleted",
				})
				if (
					previousFullResource !== previousResource &&
					previousFullResource !== previousLowResource
				) {
					this.closeResource(previousFullResource, {
						entry,
						reason: "refresh-deleted",
					})
				}
				this.clearDisplayResources(entry)
				this.setFullResource(entry, null)
				clearDeletedResourceMetadata()
				this.clearEntryBody(entry)
				this.clearEntryBodyPromise(entry)
				entry.staleDecodedVariants.clear()
			} else {
				restorePreviousResourceState()
				variantsToRefresh.forEach((variant) => entry.staleDecodedVariants.add(variant))
			}
			this.emitImageResourceLoadFailed(
				{
					path: entry.referencePath,
					reason,
					preservePreview: reason !== "not-found" && hasPreviousDecodedResource,
				},
				resourceIdentity,
			)
			return false
		}
		const resourceVersionChanged =
			!!previousResourceVersion &&
			!!entry.resourceVersion &&
			previousResourceVersion !== entry.resourceVersion
		// URL/metadata refresh does not invalidate an already valid low when the content version
		// is unchanged. Actual content changes advance the generation through
		// handleResourceVersionChanged(), while deleted resources are cleared above.
		const variantsToReload =
			previousLowWasFresh && !resourceVersionChanged
				? variantsToRefresh.filter((variant) => variant !== "low")
				: variantsToRefresh
		if (variantsToReload.length === 0) {
			if (entry.ossSrc !== ossSrc) {
				restorePreviousResourceState()
				return false
			}
			return true
		}
		let loaded = false
		let loadedResourceOssSrc: string | null = null
		for (const variant of variantsToReload) {
			const result = await this.loadImageResource(resourceIdentity, ossSrc, entry, variant)
			if (this.destroyed) return false
			if (!this.isResourceStateGenerationCurrent(entry, resourceStateGeneration)) {
				this.markStaleRequestDrop()
				return false
			}
			if (result) {
				loaded = true
				loadedResourceOssSrc = result.ossSrc
			}
		}
		const currentGenerationMatches = loadedResourceOssSrc
			? entry.ossSrc === loadedResourceOssSrc
			: entry.ossSrc === ossSrc
		if (!currentGenerationMatches) {
			restorePreviousDecodedState()
			variantsToReload.forEach((variant) => entry.staleDecodedVariants.add(variant))
			return false
		}
		if (loaded) {
			const lowWasReloaded = variantsToReload.includes("low")
			if (lowWasReloaded) {
				if (this.getDisplayResource(entry, "low") === previousLowResource) {
					this.setDisplayResource(entry, "low", null, { closePrevious: false })
				}
				this.closeResource(previousLowResource, {
					entry,
					reason: "refresh-replaced",
				})
			}
			if (this.getDisplayResource(entry, "preview") === previousResource) {
				this.setDisplayResource(entry, "preview", null, { closePrevious: false })
			}
			if (entry.fullResource === previousFullResource) {
				this.setFullResource(entry, null)
			}
			this.closeResource(previousResource, {
				entry,
				reason: "refresh-replaced",
			})
			if (
				previousFullResource !== previousResource &&
				previousFullResource !== previousLowResource
			) {
				this.closeResource(previousFullResource, {
					entry,
					reason: "refresh-replaced",
				})
			}
			return true
		}

		restorePreviousResourceState()
		variantsToReload.forEach((variant) => entry.staleDecodedVariants.add(variant))
		this.emitImageResourceLoadFailed(
			{
				path: entry.referencePath,
				reason: entry.lastFailureReason ?? "load-error",
				preservePreview: hasPreviousDecodedResource,
			},
			resourceIdentity,
		)
		return false
	}

	private triggerBackgroundMetadataRefresh(
		path: string,
		resourceIdentity: string,
		entry: ImageResourceEntry,
	): void {
		this.urlLifecycle.triggerBackgroundMetadataRefresh(path, resourceIdentity, entry)
	}

	private handleImageResourceDeleted(resourceIdentity: string, entry: ImageResourceEntry): void {
		this.advanceResourceStateGeneration(entry)
		entry.awaitingResolverAvailability = false
		this.abortEntryLoadingRequests(entry)
		this.setFailureReason(entry, "not-found")
		this.invalidatePersistentLowGeneration(resourceIdentity, entry, entry.resourceVersion)
		this.canvas.mediaResourceOfflineCacheManager.removeCachedResource({
			path: entry.referencePath,
			mediaType: "image",
		})
		void this.displayVariantPersistentCache.removeByPath(
			this.getPersistentDisplayScope(),
			resourceIdentity,
		)
		this.closeEntryResources(entry, {
			reason: "resource-deleted",
		})
		entry.ossSrc = null
		entry.ossSrcFromCachedFallback = false
		entry.sourceUrl = null
		entry.expiresAt = null
		entry.resourceVersion = null
		entry.sourceUpdatedAt = null
		entry.contentLength = null
		this.emitImageResourceLoadFailed(
			{
				path: entry.referencePath,
				reason: "not-found",
			},
			resourceIdentity,
		)
	}

	/** Reconcile decoded/persistent resources when the host publishes a new attachment snapshot. */
	public handleResourceReferenceResolverChanged(
		options?: CanvasResourceReferenceResolverChangeOptions,
	): void {
		if (this.destroyed) return
		const resolveResourceReference =
			this.canvas.magicConfigManager.config?.methods?.resolveResourceReference
		if (!resolveResourceReference) return
		this.entries.forEach((entry, resourceIdentity) => {
			if (
				options?.changedResourceIdentities &&
				!options.changedResourceIdentities.has(resourceIdentity)
			) {
				return
			}
			const availability = getCanvasResourceAvailability(
				entry.referencePath,
				resolveResourceReference,
			)
			if (availability === "available") {
				entry.awaitingResolverAvailability = false
				return
			}
			if (
				availability === "deleted" &&
				!this.isPrimedResourceAwaitingResolverSnapshot(entry)
			) {
				this.handleImageResourceDeleted(resourceIdentity, entry)
			}
		})
	}

	private async loadCachedImageResource(
		path: string,
		resourceIdentity: string,
		entry: ImageResourceEntry,
		variant: ImageResourceVariant,
	): Promise<LoadedResource | null> {
		if (this.destroyed) return null
		const previousResourceVersion = entry.resourceVersion
		const cached = await this.urlLifecycle.getCachedResource(path, entry)
		if (!cached?.url) return null
		const resourceVersionChanged =
			!!previousResourceVersion &&
			!!entry.resourceVersion &&
			previousResourceVersion !== entry.resourceVersion
		const existingResource = this.getResourceForVariant(entry, variant)
		if (existingResource && !resourceVersionChanged) {
			existingResource.ossSrc = cached.url
			entry.staleDecodedVariants.delete(variant)
			return this.buildLoadedResource(entry, variant)
		}

		const result = await this.loadImageResource(resourceIdentity, cached.url, entry, variant)
		if (
			!result &&
			this.canvas.mediaResourceOfflineCacheManager.isVirtualResourceUrl(entry.ossSrc)
		) {
			entry.ossSrc = null
			entry.ossSrcFromCachedFallback = false
		}
		return result
	}

	/**
	 * 清除过期的 ossSrc（保留 resource，仅清除 URL 以便重新换取）
	 */
	private clearExpiredOssSrc(entry: ImageResourceEntry): boolean {
		return this.urlLifecycle.clearExpiredOssSrc(entry)
	}

	private applyVirtualResourceBypass(entry: ImageResourceEntry): void {
		this.urlLifecycle.applyVirtualResourceBypass(entry)
	}

	/**
	 * 换取 ossSrc（内部方法）
	 * @param path 路径（path）
	 * @param entry 资源条目
	 * @returns Promise<string | null> ossSrc 或 null
	 */
	private async exchangeOssSrc(
		path: string,
		entry: ImageResourceEntry,
		options?: {
			forceRefresh?: boolean
			bypassVirtualResource?: boolean
			priority?: ImageResourceLoadPriority
		},
	): Promise<string | null> {
		return this.urlLifecycle.exchangeOssSrc(path, entry, options)
	}

	private getMaxEdgeForVariant(variant: ImageResourceVariant): number | undefined {
		return getImageResourceMaxEdge(variant)
	}

	private getDecodePriorityForVariant(
		variant: ImageResourceVariant,
		priority?: ImageResourceLoadPriority,
	): ImageResourceLoadPriority {
		if (priority) return priority
		return variant === "full" ? "critical" : variant === "preview" ? "visible" : "background"
	}

	private getBodyFetchPriorityForVariant(
		variant: ImageResourceVariant,
		priority?: ImageResourceLoadPriority,
	): ImageResourceLoadPriority {
		if (priority) return priority
		return variant === "full" ? "critical" : variant === "preview" ? "visible" : "near"
	}

	private estimateTargetDecodePixels(
		width: number,
		height: number,
		variant: ImageResourceVariant,
	): number {
		return estimateScaledPixelCost(width, height, this.getMaxEdgeForVariant(variant))
	}

	private getFallbackDecodePixelCost(variant: ImageResourceVariant): number {
		return getFallbackDecodePixelCost(
			this.getMaxEdgeForVariant(variant),
			DEFAULT_MEDIA_DECODE_CONCURRENT_PIXEL_BUDGET,
		)
	}

	private async estimateImageDecodePixelCost(
		body: MediaResourceBody,
		variant: ImageResourceVariant,
	): Promise<number> {
		try {
			const dimensions = await parseImageDimensionsFromBlobHeader(body.blob)
			if (!dimensions) return this.getFallbackDecodePixelCost(variant)
			return this.estimateTargetDecodePixels(dimensions.width, dimensions.height, variant)
		} catch {
			return this.getFallbackDecodePixelCost(variant)
		}
	}

	private async loadImageBody(
		path: string,
		ossSrc: string,
		entry: ImageResourceEntry,
		variant: ImageResourceVariant,
		priority?: ImageResourceLoadPriority,
		retryCount = 0,
		options?: ImageResourceLoadOptions,
	): Promise<MediaResourceBody | null> {
		if (this.destroyed) {
			return null
		}
		if (this.shouldDropAbortedLoad(options)) return null
		const cacheKey = this.getBodyCacheKey(path, ossSrc, entry)
		const resourceGeneration = this.getPersistentLowGeneration(path)
		if (
			entry.bodyBlob &&
			entry.bodyCacheKey === cacheKey &&
			entry.bodyOssSrc &&
			entry.bodyOssSrc !== ossSrc
		) {
			entry.bodyOssSrc = null
		}
		const cachedBody = this.getReusableBody(entry, ossSrc, cacheKey)
		if (cachedBody) {
			if (
				typeof cachedBody.resourceGeneration === "number" &&
				cachedBody.resourceGeneration !== resourceGeneration
			) {
				this.clearEntryBody(entry)
			} else {
				this.diagnostics.increment("bodyCacheHitCount")
				return cachedBody
			}
		}

		const inFlightBody = this.bodyCache.getInFlight(entry, cacheKey)
		if (inFlightBody) {
			this.diagnostics.increment("bodyFetchDedupedCount")
			return inFlightBody.consume(options?.signal)
		}

		const bodyFetchPriority = this.getBodyFetchPriorityForVariant(variant, priority)
		const request = new SharedAbortableRequest<MediaResourceBody | null>(
			(sharedSignal) =>
				this.canvas.resourceScheduler.run(
					"image:body-fetch",
					async (schedulerSignal): Promise<MediaResourceBody | null> => {
						let currentOssSrc = ossSrc
						let attempt = retryCount
						// 换签名但文件版本未变时，缓存键不变。重试留在同一共享请求内，
						// 避免递归命中自身 Promise，也不额外占用调度槽或破坏请求去重。
						while (!this.destroyed && !sharedSignal.aborted) {
							const fetchGeneration = this.getPersistentLowGeneration(path)
							this.diagnostics.increment("bodyFetchAttemptCount")
							try {
								const response = await fetch(currentOssSrc, {
									cache: "default",
									signal: schedulerSignal,
								})
								if (this.destroyed) {
									return null
								}
								if (sharedSignal.aborted) {
									return null
								}
								if (!response.ok) {
									const needsReExchange =
										response.status === 401 || response.status === 403
									if (needsReExchange) {
										this.setFailureReason(entry, "load-error")
										entry.ossSrc = null
										entry.ossSrcFromCachedFallback = false
										entry.sourceUrl = null
										entry.expiresAt = null
										this.clearEntryBody(entry)
										const nextOssSrc = await this.resolveImageLoadRetryOssSrc(
											currentOssSrc,
											entry,
											attempt,
											priority,
										)
										if (this.destroyed || sharedSignal.aborted) return null
										if (nextOssSrc) {
											currentOssSrc = nextOssSrc
											attempt += 1
											continue
										}
									} else {
										this.setFailureReason(
											entry,
											getFailureReasonFromStatusCode(response.status),
										)
									}
									this.diagnostics.increment("bodyFetchFailedCount")
									return null
								}

								const blob = await response.blob()
								if (this.destroyed) {
									return null
								}
								if (sharedSignal.aborted) {
									return null
								}
								if (entry.ossSrc !== currentOssSrc) return null
								if (this.getPersistentLowGeneration(path) !== fetchGeneration) {
									return null
								}
								const body: MediaResourceBody = {
									blob,
									ossSrc: currentOssSrc,
									cacheKey: this.getBodyCacheKey(path, currentOssSrc, entry),
									byteSize: blob.size,
									resourceGeneration: fetchGeneration,
								}
								this.bodyCache.storeBody(entry, body)
								this.setFailureReason(entry, null)
								this.canvas.mediaResourceOfflineCacheManager.recordVirtualResourceLoadSuccess(
									currentOssSrc,
								)
								this.evictBodyCacheBudget(entry)
								this.diagnostics.increment("bodyFetchSuccessCount")
								return body
							} catch (error) {
								if (this.isAbortError(error)) {
									return null
								}
								const nextOssSrc = await this.resolveImageLoadRetryOssSrc(
									currentOssSrc,
									entry,
									attempt,
									priority,
								)
								if (this.destroyed || sharedSignal.aborted) return null
								if (nextOssSrc) {
									currentOssSrc = nextOssSrc
									attempt += 1
									continue
								}
								this.setFailureReason(entry, "load-error")
								this.diagnostics.increment("bodyFetchFailedCount")
								return null
							}
						}
						return null
					},
					{
						source: "image-resource:body-fetch",
						canvasId: this.canvas.id,
						managerInstanceId: this.managerInstanceId,
						path,
						variant,
						cacheKey,
						url: ossSrc,
						priority: bodyFetchPriority,
						signal: sharedSignal,
					},
				),
			{ abortValue: null },
		)

		this.bodyCache.setInFlight(entry, cacheKey, request)
		void request.promise.then(
			() => this.bodyCache.clearInFlightIfCurrent(entry, request),
			() => this.bodyCache.clearInFlightIfCurrent(entry, request),
		)

		try {
			return await request.consume(options?.signal)
		} catch (error) {
			if (this.isAbortError(error)) return null
			throw error
		}
	}

	/**
	 * 加载图片资源：压缩 body 在主线程 entry 级去重/缓存，worker 只负责按 variant 解码。
	 * - 优先：Worker 返回 ImageBitmap，通过 transferable 实现零拷贝传输
	 * - 降级：Worker 返回 Blob，主线程使用 createImageSourceFromBlob 创建 ImageSource
	 */
	private async loadImageResource(
		resourceIdentity: string,
		ossSrc: string,
		entry: ImageResourceEntry,
		variant: ImageResourceVariant,
		priority?: ImageResourceLoadPriority,
		retryCount = 0,
		options?: ImageResourceLoadOptions,
	): Promise<LoadedResource | null> {
		const body = await this.loadImageBody(
			resourceIdentity,
			ossSrc,
			entry,
			variant,
			priority,
			retryCount,
			options,
		)
		if (!body) return null
		if (this.destroyed) {
			return null
		}
		if (this.shouldDropAbortedLoad(options)) return null
		if (
			typeof body.resourceGeneration === "number" &&
			this.getPersistentLowGeneration(resourceIdentity) !== body.resourceGeneration
		) {
			return null
		}

		const decodePixelCost = await this.estimateImageDecodePixelCost(body, variant)
		if (this.shouldDropAbortedLoad(options)) return null
		const decodePriority = this.getDecodePriorityForVariant(variant, priority)
		const releaseDecodePermit = await this.decodePixelBudgetGate.acquire(
			decodePixelCost,
			decodePriority,
			options?.signal,
		)
		if (this.destroyed) {
			releaseDecodePermit()
			return null
		}
		if (this.shouldDropAbortedLoad(options)) {
			releaseDecodePermit()
			return null
		}
		const requestId = this.createWorkerRequestId("img")
		const decodeIdentity = `${resourceIdentity}\u0000${
			body.resourceGeneration ?? body.cacheKey
		}\u0000${variant}`
		const decodePathVariantKey = `${resourceIdentity}\u0000${variant}`
		try {
			this.diagnostics.increment("decodeAttemptCount")
			if (
				this.lastSuccessfulDecodeIdentityByPathVariant.get(decodePathVariantKey) ===
				decodeIdentity
			) {
				this.diagnostics.increment("decodeRepeatAttemptCount")
			}
			const result = await this.canvas.resourceScheduler.run(
				"image:decode",
				(signal) => {
					if (signal.aborted || this.shouldDropAbortedLoad(options)) {
						return Promise.resolve(null)
					}
					return this.sendToWorker(
						{
							ossSrc: body.ossSrc,
							blob: body.blob,
							requestId,
							variant,
							maxEdge: this.getMaxEdgeForVariant(variant),
						},
						{ signal, priority: decodePriority, pixelCost: decodePixelCost },
					)
				},
				{
					source: "image-resource:decode",
					canvasId: this.canvas.id,
					managerInstanceId: this.managerInstanceId,
					path: resourceIdentity,
					variant,
					cacheKey: body.cacheKey,
					url: body.ossSrc,
					priority: decodePriority,
					signal: options?.signal,
				},
			)
			if (this.destroyed) {
				if (result?.imageSource) closeImageSource(result.imageSource)
				return null
			}
			if (this.shouldDropAbortedLoad(options)) {
				if (result?.imageSource) closeImageSource(result.imageSource)
				return null
			}

			if (!result?.imageInfo) {
				this.setFailureReason(entry, getFailureReasonFromStatusCode(result?.statusCode))
				this.diagnostics.increment("decodeFailedCount")
				return null
			}

			let image: ImageSource | null = null

			if (result.imageSource) {
				// 优先：直接使用从 Worker 传递过来的 ImageBitmap（已通过 transferable 零拷贝传输）
				image = result.imageSource
			} else if (result.blob) {
				// 降级：Worker 不支持 ImageBitmap，返回了 Blob
				if (this.destroyed) {
					return null
				}
				image = await createImageSourceFromBlob(result.blob)
				if (!image) {
					this.setFailureReason(entry, "load-error")
					this.diagnostics.increment("decodeFailedCount")
					return null
				}
				if (this.shouldDropAbortedLoad(options)) {
					closeImageSource(image)
					return null
				}
			} else {
				this.setFailureReason(entry, getFailureReasonFromStatusCode(result?.statusCode))
				this.diagnostics.increment("decodeFailedCount")
				return null
			}

			if (this.destroyed) {
				if (image) closeImageSource(image)
				return null
			}
			if (this.shouldDropAbortedLoad(options)) {
				if (image) closeImageSource(image)
				return null
			}
			if (entry.ossSrc !== body.ossSrc) {
				if (image) closeImageSource(image)
				return null
			}
			if (
				typeof body.resourceGeneration === "number" &&
				this.getPersistentLowGeneration(resourceIdentity) !== body.resourceGeneration
			) {
				if (image) closeImageSource(image)
				return null
			}

			const { width: sourceWidth, height: sourceHeight } = getImageSourceDimensions(image)
			const resourceVariant = result.variant ?? variant
			const resource: ImageResource = {
				ossSrc: body.ossSrc,
				image,
				imageInfo: result.imageInfo,
				variant: resourceVariant,
				sourceWidth,
				sourceHeight,
				isFullSize: this.isFullSizeResource(result.imageInfo, sourceWidth, sourceHeight),
				closed: false,
				displayBlob: result.persistentDisplay?.blob,
			}
			let previousResourceToClose: ImageResource | null = null
			if (variant === "full") {
				const previousFullResource = entry.fullResource
				this.setFullResource(entry, resource)
				previousResourceToClose =
					previousFullResource &&
					previousFullResource !== resource &&
					!this.isResourceStillReferenced(entry, previousFullResource)
						? previousFullResource
						: null
			} else if (variant === "low") {
				previousResourceToClose = this.setDisplayResource(entry, "low", resource, {
					closePrevious: false,
				})
			} else {
				previousResourceToClose = this.setDisplayResource(entry, "preview", resource, {
					closePrevious: false,
				})
			}
			this.setFailureReason(entry, null)
			entry.staleDecodedVariants.delete(variant)

			const loadedResource: LoadedResource = {
				ossSrc: body.ossSrc,
				image,
				imageInfo: result.imageInfo,
				variant: resource.variant,
				sourceWidth,
				sourceHeight,
				isFullSize: resource.isFullSize,
			}
			this.persistDisplayResourceFromWorkerResult(
				resourceIdentity,
				entry,
				resource.variant,
				result,
				result.imageInfo,
			)
			if (resource.variant !== "low") {
				this.ensurePersistentLowFromBody(resourceIdentity, entry, body)
			}

			if (variant !== "full") {
				this.emitImageResourceLoaded({
					path: entry.referencePath,
					resource: loadedResource,
				})
			}
			if (
				previousResourceToClose &&
				previousResourceToClose !== resource &&
				!this.isResourceStillReferenced(entry, previousResourceToClose)
			) {
				this.closeResourceAfterConsumersSwap(previousResourceToClose, {
					entry,
					reason: "resource-replaced",
				})
			}
			this.enforceDecodedBitmapBudget({
				reason: "decode-success",
				exemptResource: resource,
			})

			this.diagnostics.increment("decodeSuccessCount")
			this.lastSuccessfulDecodeIdentityByPathVariant.set(decodePathVariantKey, decodeIdentity)
			return loadedResource
		} catch (error) {
			if (this.destroyed) {
				return null
			}
			this.setFailureReason(entry, "load-error")
			this.diagnostics.increment("decodeFailedCount")
			return null
		} finally {
			releaseDecodePermit()
		}
	}

	private async resolveImageLoadRetryOssSrc(
		ossSrc: string,
		entry: ImageResourceEntry,
		retryCount: number,
		priority?: ImageResourceLoadPriority,
	): Promise<string | null> {
		if (this.destroyed || retryCount > 0) return null
		// 内部 workspace identity 只用于缓存；宿主换链必须收到原始文件引用。
		if (this.canvas.mediaResourceOfflineCacheManager.isVirtualResourceUrl(ossSrc)) {
			return this.urlLifecycle.resolveVirtualResourceFallbackOssSrc(
				entry.referencePath,
				ossSrc,
				entry,
				retryCount,
			)
		}
		// 过期签名也可能因跨域策略表现为 fetch 异常；只换链一次，跳过失效 URL 缓存。
		return this.exchangeOssSrc(entry.referencePath, entry, { forceRefresh: true, priority })
	}

	private createEntry(referencePath: string, resourceIdentity: string): ImageResourceEntry {
		return {
			resourceStateGeneration: 0,
			awaitingResolverAvailability: false,
			referencePath,
			resourceIdentity,
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
			displaySlots: this.createDisplayResourceSlots(),
			fullResource: null,
			fullLastAccessAt: 0,
			lowDisplayLeaseCount: 0,
			lastDecodedBudgetEnforcedAt: 0,
			bodyBlob: null,
			bodyOssSrc: null,
			bodyCacheKey: null,
			bodyByteSize: 0,
			bodyLastAccessAt: 0,
			bodyResourceGeneration: null,
			lastFailureReason: null,
			staleDecodedVariants: new Set(),
		}
	}

	private getOrCreateEntry(resourceIdentity: string, referencePath: string): ImageResourceEntry {
		let entry = this.entries.get(resourceIdentity)
		if (!entry) {
			entry = this.createEntry(referencePath, resourceIdentity)
			this.entries.set(resourceIdentity, entry)
		}
		return entry
	}

	/**
	 * 预填充缓存（用于上传等已有 ossSrc 的场景，避免重复换取）
	 * @param path 路径（path）
	 * @param fileInfo 文件信息
	 */
	public primeCache(
		path: string,
		fileInfo: Pick<
			GetFileInfoResponse,
			| "src"
			| "expires_at"
			| "fileName"
			| "source"
			| "resource_version"
			| "updated_at"
			| "content_length"
		>,
	): void {
		const resourceIdentity = this.getResourceIdentity(path)
		const entry = this.getOrCreateEntry(resourceIdentity, path)
		this.advanceResourceStateGeneration(entry)
		const availability = getCanvasResourceAvailability(
			path,
			this.canvas.magicConfigManager.config?.methods?.resolveResourceReference,
		)
		entry.awaitingResolverAvailability = availability !== "available"
		this.abortEntryLoadingRequests(entry)
		this.urlLifecycle.primeCache(path, entry, fileInfo)
		this.setFailureReason(entry, null)
		this.emitImageResourceRecoveryStarted(
			{
				path: entry.referencePath,
				ossSrc: fileInfo.src,
			},
			resourceIdentity,
		)
	}

	/**
	 * 调度资源清理（防抖版本）
	 * 在短时间内多次调用时，只执行最后一次
	 */
	private scheduleCleanup(reason = "manual"): void {
		// 清除之前的定时器
		if (this.cleanupTimer) {
			clearTimeout(this.cleanupTimer)
		}

		// 设置新的定时器
		this.cleanupTimer = setTimeout(() => {
			void this.checkAndCleanupResources(reason)
			this.cleanupTimer = null
		}, this.CLEANUP_DEBOUNCE_DELAY)
	}

	/**
	 * 检查并清理未使用的资源
	 * 遍历所有元素，收集所有使用的图片路径，然后检查资源是否仍在使用
	 */
	private async checkAndCleanupResources(reason = "manual"): Promise<void> {
		// 清除防抖定时器（如果存在）
		if (this.cleanupTimer) {
			clearTimeout(this.cleanupTimer)
			this.cleanupTimer = null
		}
		// 获取所有存在的元素
		const elementsDict = this.canvas.elementManager.getElementsDict()

		// 收集所有正在使用的图片路径（包括主图片和参考图）
		const usedPaths = new Set<string>()

		for (const elementData of Object.values(elementsDict)) {
			if (elementData.type === ElementTypeEnum.Image) {
				const imageElement = elementData as ImageElementData

				// 全部 Contents 都属于文档存活引用；可见性调度仍只注册 active Content。
				getImageContents(imageElement).forEach((content) => {
					if (content.src) usedPaths.add(this.getResourceIdentity(content.src))
				})

				// 添加参考图路径
				const elementInstance = this.canvas.elementManager.getElementInstance(
					elementData.id,
				)
				if (elementInstance && elementInstance instanceof ImageElement) {
					const referenceImageInfos = elementInstance.getReferenceImageInfos()
					for (const info of referenceImageInfos) {
						usedPaths.add(this.getResourceIdentity(info.path))
					}
				}
			}
		}

		// 遍历所有资源条目，检查是否仍在使用
		this.entries.forEach((entry, resourceIdentity) => {
			if (usedPaths.has(resourceIdentity)) return
			entry.persistentLowLoadingPromise?.abort()

			if (
				this.getDisplayResource(entry, "low") ||
				this.getDisplayResource(entry, "preview") ||
				entry.fullResource ||
				this.bodyCache.hasBody(entry)
			) {
				this.closeEntryResources(entry, {
					reason: `cleanup:${reason}`,
				})
				this.canvas.eventEmitter.emit({
					type: "resource:released",
					data: { path: entry.referencePath },
				})
			}

			entry.ossSrc = null
			entry.ossSrcFromCachedFallback = false
			entry.expiresAt = null
			this.canvas.mediaResourceOfflineCacheManager.removeCachedResource({
				path: entry.referencePath,
				mediaType: "image",
			})
			if (
				!entry.exchangePromise &&
				!entry.persistentLowLoadingPromise &&
				!this.getDisplayLoadingPromise(entry, "preview") &&
				!this.getDisplayLoadingPromise(entry, "low") &&
				!entry.fullLoadingPromise
			) {
				this.entries.delete(resourceIdentity)
			}
		})
	}

	/**
	 * 销毁管理器
	 */
	public destroy(): void {
		if (this.destroyed) return
		this.destroyed = true
		const pendingError = new Error("ImageResourceManager destroyed")
		this.previewLoadQueue.forEach((item) => {
			if (item.abortListener) {
				item.options?.signal?.removeEventListener("abort", item.abortListener)
			}
			item.resolve(null)
		})
		this.previewLoadQueue = []
		this.previewLoadQueueByKey.clear()
		this.entries.forEach((entry) => {
			entry.persistentLowLoadingPromise?.abort()
			this.getDisplayLoadingPromise(entry, "low")?.abort()
			this.getDisplayLoadingPromise(entry, "preview")?.abort()
			entry.fullLoadingPromise?.abort()
		})
		if (this.cleanupTimer) {
			clearTimeout(this.cleanupTimer)
			this.cleanupTimer = null
		}
		this.bodyCache.dispose()
		this.workerWarmupPromise = null
		this.displayVariantPersistentCache.destroy()
		this.persistentLowWritePromises.clear()
		this.persistentLowReadyKeys.clear()
		this.persistentLowGenerationByPath.clear()
		this.workerClient?.release(pendingError)
		this.decodePixelBudgetGate.destroy()
		this.workerClient = null
		// 释放所有 ImageBitmap 资源
		this.entries.forEach((entry) => {
			this.closeEntryResources(entry, {
				reason: "manager-destroy",
			})
		})
		this.entries.clear()
		this.clearDecodedByteTracking()
		this.lastSuccessfulDecodeIdentityByPathVariant.clear()
		this.imageResourceLoadFailedHandlersByIdentity.clear()
		this.imageResourceRecoveryStartedHandlersByIdentity.clear()
		this.imageResourceWillCloseHandlersByIdentity.clear()
		this.canvas.eventEmitter.off("element:deleted", this.handleElementDeleted)
		this.canvas.eventEmitter.off("element:batchdeleted", this.handleBatchDeleted)
		this.canvas.eventEmitter.off("canvas:clear", this.handleCanvasClear)
		this.canvas.eventEmitter.off("referenceImages:changed", this.handleReferenceImagesChanged)
	}
}
