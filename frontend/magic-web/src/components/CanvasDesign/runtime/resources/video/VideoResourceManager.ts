import type { Canvas } from "../../core/Canvas"
import type { AttachmentSourceEnum, GetFileInfoResponse } from "../../../public/magic-types"
import { ElementTypeEnum } from "../../document/types"
import type { ResourceLoadFailureReason } from "../media-common/resourceLoadFailure"
import {
	buildVideoResourceSnapshot,
	createVideoResourceDiagnostics,
	type VideoResourceCurrentSnapshot,
	type VideoResourceFailureInfo,
	type VideoResourceSnapshot,
} from "../diagnostics/CanvasResourceDiagnostics"
import {
	MediaResourceUrlLifecycle,
	type MediaResourceUrlEntry,
} from "../offline-cache/MediaResourceUrlLifecycle"
import { VideoPreviewLoader, type VideoPreviewMediaDiag } from "./VideoPreviewLoader"
import type { CanvasResourceTaskPriority } from "../scheduler/CanvasResourceScheduler"
import { SharedAbortableRequest } from "../offline-cache/SharedAbortableRequest"

/** 视频解码后的元信息（时长与原始像素尺寸） */
export interface LoadedVideoMetadata {
	/** 时长（秒） */
	duration: number
	/** 视频轨像素宽度 */
	videoWidth: number
	/** 视频轨像素高度 */
	videoHeight: number
}

/** 海报位图来源：由 VideoResourceManager 绘制到 canvas，供 Konva.Image 使用 */
export type VideoPosterSource = HTMLCanvasElement

/**
 * 已交给资源管理器释放的 poster 不得再次进入 Konva.Image。
 * poster 是可变的 HTMLCanvasElement，单看 width/height 不能区分“刚创建的 1×1
 * poster”和“已经被释放后降级成 1×1 的 poster”，因此额外保留对象身份标记。
 */
const releasedVideoPosters = new WeakSet<object>()

export function isUsableVideoPosterSource(value: unknown): value is VideoPosterSource {
	if (typeof value !== "object" || value === null || releasedVideoPosters.has(value)) {
		return false
	}

	try {
		const poster = value as VideoPosterSource
		return (
			Number.isFinite(poster.width) &&
			Number.isFinite(poster.height) &&
			poster.width > 0 &&
			poster.height > 0
		)
	} catch {
		return false
	}
}

/** 已解析的可播放地址 + 首帧海报 + 元数据 */
export interface LoadedVideoResource {
	/** 带签名的可播放 URL（可能过期，需结合 ensureFreshOssSrc） */
	ossSrc: string
	poster: VideoPosterSource
	metadata: LoadedVideoMetadata
}

export interface ResolvedVideoOssInfo {
	ossSrc: string
	expiresAt: number | null
}

export interface VideoResourceLoadOptions {
	priority?: CanvasResourceTaskPriority
	signal?: AbortSignal
}

type VideoResourcePipelineLoadOptions = VideoResourceLoadOptions & {
	/** refresh 失败时保留已有 poster，不把元素切到错误态。 */
	preservePreviewOnFailure?: boolean
}

interface VideoResource {
	poster: VideoPosterSource
	metadata: LoadedVideoMetadata
}

interface ResourceEntry extends MediaResourceUrlEntry {
	ossSrc: string | null
	ossSrcFromCachedFallback: boolean
	sourceUrl: string | null
	expiresAt: number | null
	source?: AttachmentSourceEnum
	fileName?: string
	resourceVersion: string | null
	sourceUpdatedAt: string | null
	contentLength: number | null
	exchangePromise: Promise<string | null> | null
	loadingPromise: SharedAbortableRequest<LoadedVideoResource | null> | null
	refreshPromise: Promise<boolean> | null
	resource: VideoResource | null
	backgroundRefreshPromise: Promise<void> | null
	lastFailureReason: ResourceLoadFailureReason | null
	/** refresh 失败后保留旧 poster 展示，但必须成功重新解码后才能作为加载命中。 */
	resourceNeedsReload: boolean
	resourceLastAccessAt: number
}

const MAX_FAILED_RESOURCE_DEBUG_ITEMS = 20
const VIDEO_PREVIEW_LOAD_TIMEOUT_MS = 15_000
const VIDEO_POSTER_CACHE_MAX_BYTES = 96 * 1024 * 1024

/**
 * 按项目 path 缓存视频：换链、解码首帧海报、合并重复加载请求
 */
export class VideoResourceManager {
	private static instanceIdSeed = 0

	private canvas: Canvas
	private readonly managerInstanceId = ++VideoResourceManager.instanceIdSeed
	private destroyed = false
	private diagnostics = createVideoResourceDiagnostics()
	private entries: Map<string, ResourceEntry> = new Map()
	private urlLifecycle!: MediaResourceUrlLifecycle<ResourceEntry>
	private previewLoader!: VideoPreviewLoader
	private cleanupTimer: ReturnType<typeof setTimeout> | null = null
	private readonly CLEANUP_DEBOUNCE_DELAY = 100

	private readonly handleElementDeleted = () => {
		this.scheduleCleanup()
	}

	private readonly handleBatchDeleted = () => {
		void this.checkAndCleanupResources()
	}

	private readonly handleCanvasClear = () => {
		void this.checkAndCleanupResources()
	}

	private setFailureReason(entry: ResourceEntry, reason: ResourceLoadFailureReason | null): void {
		entry.lastFailureReason = reason
	}

	private markStaleRequestDrop(): void {
		this.diagnostics.increment("staleRequestDropCount")
	}

	private getResourceIdentity(path: string): string {
		return this.urlLifecycle.getResourceIdentity(path)
	}

	constructor(options: { canvas: Canvas }) {
		this.canvas = options.canvas
		this.urlLifecycle = new MediaResourceUrlLifecycle<ResourceEntry>({
			canvas: this.canvas,
			mediaType: "video",
			useImageProcess: false,
			isDestroyed: () => this.destroyed,
			onStaleRequestDrop: () => this.markStaleRequestDrop(),
			setFailureReason: (entry, reason) => this.setFailureReason(entry, reason),
			onResourceDeleted: (_resourceIdentity, entry) => this.handleVideoResourceDeleted(entry),
			refreshResource: (path) => this.refreshResource(path),
			onResourceVersionChanged: (_resourceIdentity, entry) => {
				entry.resourceNeedsReload = true
			},
			incrementDiagnostic: (counter) => this.diagnostics.increment(counter),
		})
		this.previewLoader = new VideoPreviewLoader({
			timeoutMs: VIDEO_PREVIEW_LOAD_TIMEOUT_MS,
			isDestroyed: () => this.destroyed,
			onStaleRequestDrop: () => this.markStaleRequestDrop(),
			onAbort: () => this.diagnostics.increment("previewLoadAbortCount"),
			onTimeout: () => this.diagnostics.increment("previewLoadTimeoutCount"),
		})
		this.canvas.eventEmitter.on("element:deleted", this.handleElementDeleted)
		this.canvas.eventEmitter.on("element:batchdeleted", this.handleBatchDeleted)
		this.canvas.eventEmitter.on("canvas:clear", this.handleCanvasClear)
	}

	/** 触发后台加载（不等待完成），用于预热 */
	public loadResource(path: string, options?: VideoResourceLoadOptions): void {
		if (this.destroyed) {
			this.markStaleRequestDrop()
			return
		}
		this.loadVideoInternal(path, options).catch((error) => {
			void error
		})
	}

	/** 等待加载完成，返回可播放 URL 与海报（通用入口） */
	public async getResource(
		path: string,
		options?: VideoResourceLoadOptions,
	): Promise<LoadedVideoResource | null> {
		if (this.destroyed) {
			this.markStaleRequestDrop()
			return null
		}
		return this.loadVideoInternal(path, options)
	}

	/** 与 getResource 相同实现，语义上用于画布预览场景 */
	public async getPreviewResource(
		path: string,
		options?: VideoResourceLoadOptions,
	): Promise<LoadedVideoResource | null> {
		if (this.destroyed) {
			this.markStaleRequestDrop()
			return null
		}
		return this.loadVideoInternal(path, options)
	}

	public async ensureFreshOssInfo(
		path: string,
		options?: {
			forceRefresh?: boolean
			bypassVirtualResource?: boolean
			allowCachedFallback?: boolean
			priority?: CanvasResourceTaskPriority
			signal?: AbortSignal
		},
	): Promise<ResolvedVideoOssInfo | null> {
		if (this.destroyed) {
			this.markStaleRequestDrop()
			return null
		}
		if (this.canvas.canvasFileUploadManager.shouldDeferRemoteResourceLoad(path)) {
			return null
		}
		if (this.shouldDropAbortedLoad(options)) return null
		const resourceIdentity = this.getResourceIdentity(path)
		const entry = this.getOrCreateEntry(resourceIdentity, path)
		const result = await this.urlLifecycle.ensureFreshOssInfo(path, entry, options)
		return this.shouldDropAbortedLoad(options) ? null : result
	}

	/** 若缓存过期则重新换链，返回当前可用的 ossSrc */
	public async ensureFreshOssSrc(
		path: string,
		options?: {
			forceRefresh?: boolean
			bypassVirtualResource?: boolean
			allowCachedFallback?: boolean
			priority?: CanvasResourceTaskPriority
			signal?: AbortSignal
		},
	): Promise<string | null> {
		return (await this.ensureFreshOssInfo(path, options))?.ossSrc ?? null
	}

	public getFailureReason(path: string): ResourceLoadFailureReason | null {
		const canonical = this.urlLifecycle.getResourceIdentity(path)
		return this.entries.get(canonical)?.lastFailureReason ?? null
	}

	public getSnapshot(): VideoResourceSnapshot {
		let loaded = 0
		let loading = 0
		let exchanging = 0
		let failed = 0
		let posterCanvasBytes = 0
		const failureReasonCounts: Record<ResourceLoadFailureReason, number> = {
			"not-found": 0,
			"load-error": 0,
		}
		const failedResources: VideoResourceFailureInfo[] = []

		this.entries.forEach((entry) => {
			if (entry.resource) {
				loaded += 1
				posterCanvasBytes +=
					Math.max(0, entry.resource.poster.width) *
					Math.max(0, entry.resource.poster.height) *
					4
			}
			if (entry.loadingPromise) loading += 1
			if (entry.exchangePromise) exchanging += 1
			if (entry.lastFailureReason) {
				failed += 1
				failureReasonCounts[entry.lastFailureReason] += 1
				if (failedResources.length < MAX_FAILED_RESOURCE_DEBUG_ITEMS) {
					failedResources.push({
						path: entry.referencePath,
						reason: entry.lastFailureReason,
						source: entry.source,
						fileName: entry.fileName,
						resourceVersion: entry.resourceVersion,
						sourceUpdatedAt: entry.sourceUpdatedAt,
						contentLength: entry.contentLength,
						hasOssSrc: !!entry.ossSrc,
						hasSourceUrl: !!entry.sourceUrl,
					})
				}
			}
		})

		const current: VideoResourceCurrentSnapshot = {
			managerInstanceId: this.managerInstanceId,
			destroyed: this.destroyed,
			entries: this.entries.size,
			loaded,
			loading,
			exchanging,
			failed,
			failureReasonCounts,
			failedResources,
			failedResourcesTruncated: failed > failedResources.length,
			posterCanvasBytes,
			activePreviewLoadCount:
				this.canvas.resourceScheduler.getSnapshot().activeByKind["video:preview"],
			queuedPreviewLoadCount:
				this.canvas.resourceScheduler.getSnapshot().queuedByKind["video:preview"],
		}
		return buildVideoResourceSnapshot(current, this.diagnostics.snapshot())
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
		const refreshPromise = (async () => {
			if (previousRefresh) {
				await previousRefresh.catch(() => false)
			}
			if (this.destroyed) return false
			if (entry.loadingPromise) {
				await entry.loadingPromise.promise.catch(() => null)
			}
			if (this.destroyed) return false
			return this.refreshVideoResourceFromNetwork(path, resourceIdentity, entry, {
				forceRefresh: true,
				priority: "critical",
			})
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

	/** 用上传/生成结果直接写入缓存，跳过首次网络解码路径 */
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
		this.urlLifecycle.primeCache(path, entry, fileInfo)
	}

	/** 读取当前缓存中的视频元信息；不触发换链与解码，供快速布局使用 */
	public getCachedMetadata(path: string): LoadedVideoMetadata | null {
		const canonical = this.urlLifecycle.getResourceIdentity(path)
		const entry = this.entries.get(canonical)
		return entry?.resource?.metadata ?? null
	}

	public needsResourceReload(path: string): boolean {
		const canonical = this.urlLifecycle.getResourceIdentity(path)
		return this.entries.get(canonical)?.resourceNeedsReload === true
	}

	/** 仅淘汰已离开 visible/near 集合的 poster；再次进入视口时由 visibility manager 重新加载。 */
	public enforcePosterBudget(retainedPaths: ReadonlySet<string>): void {
		if (this.destroyed) return
		const retainedCanonicalPaths = new Set(
			Array.from(retainedPaths, (path) => this.getResourceIdentity(path)),
		)
		let totalBytes = 0
		const candidates: Array<{ path: string; entry: ResourceEntry; bytes: number }> = []
		this.entries.forEach((entry, path) => {
			if (!entry.resource) return
			const bytes = this.getPosterBytes(entry.resource.poster)
			totalBytes += bytes
			if (!retainedCanonicalPaths.has(path)) candidates.push({ path, entry, bytes })
		})
		if (totalBytes <= VIDEO_POSTER_CACHE_MAX_BYTES) return

		candidates.sort(
			(left, right) => left.entry.resourceLastAccessAt - right.entry.resourceLastAccessAt,
		)
		for (const candidate of candidates) {
			if (totalBytes <= VIDEO_POSTER_CACHE_MAX_BYTES) break
			if (!candidate.entry.resource) continue
			this.releaseResource(candidate.entry.resource, {
				path: candidate.entry.referencePath,
				reason: "viewport-far",
			})
			candidate.entry.resource = null
			candidate.entry.resourceNeedsReload = true
			totalBytes = Math.max(0, totalBytes - candidate.bytes)
			this.canvas.eventEmitter.emit({
				type: "resource:released",
				data: { path: candidate.entry.referencePath },
			})
		}
	}

	/** 释放缓存与事件监听 */
	public destroy(): void {
		if (this.destroyed) return
		this.destroyed = true
		if (this.cleanupTimer) {
			clearTimeout(this.cleanupTimer)
			this.cleanupTimer = null
		}

		const pendingError = new Error("VideoResourceManager destroyed")
		this.previewLoader.destroy(pendingError)
		this.entries.forEach((entry) => {
			entry.loadingPromise?.abort()
			this.releaseResource(entry.resource, {
				path: entry.referencePath,
				reason: "manager-destroy",
			})
		})
		this.entries.clear()
		this.canvas.eventEmitter.off("element:deleted", this.handleElementDeleted)
		this.canvas.eventEmitter.off("element:batchdeleted", this.handleBatchDeleted)
		this.canvas.eventEmitter.off("canvas:clear", this.handleCanvasClear)
	}

	private buildLoadedResource(entry: ResourceEntry): LoadedVideoResource | null {
		if (!entry.ossSrc || !entry.resource) {
			return null
		}
		if (!isUsableVideoPosterSource(entry.resource.poster)) {
			this.releaseResource(entry.resource, {
				path: entry.referencePath,
				reason: "invalid-entry-poster",
			})
			entry.resource = null
			entry.resourceNeedsReload = true
			return null
		}
		this.setFailureReason(entry, null)
		entry.resourceLastAccessAt = Date.now()

		return {
			ossSrc: entry.ossSrc,
			poster: entry.resource.poster,
			metadata: entry.resource.metadata,
		}
	}

	private getOrCreateEntry(resourceIdentity: string, referencePath: string): ResourceEntry {
		let entry = this.entries.get(resourceIdentity)
		if (!entry) {
			entry = {
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
				loadingPromise: null,
				refreshPromise: null,
				backgroundRefreshPromise: null,
				resource: null,
				lastFailureReason: null,
				resourceNeedsReload: false,
				resourceLastAccessAt: 0,
			}
			this.entries.set(resourceIdentity, entry)
		}
		return entry
	}

	private shouldDropAbortedLoad(options?: VideoResourceLoadOptions): boolean {
		if (!options?.signal?.aborted) return false
		this.markStaleRequestDrop()
		return true
	}

	private async loadVideoInternal(
		path: string,
		options?: VideoResourceLoadOptions,
	): Promise<LoadedVideoResource | null> {
		if (this.destroyed) {
			this.markStaleRequestDrop()
			return null
		}
		if (this.canvas.canvasFileUploadManager.shouldDeferRemoteResourceLoad(path)) {
			return null
		}
		if (this.shouldDropAbortedLoad(options)) return null
		const resourceIdentity = this.getResourceIdentity(path)
		const entry = this.getOrCreateEntry(resourceIdentity, path)
		if (this.clearExpiredOssSrc(entry)) {
			entry.resourceNeedsReload = true
		}
		this.applyVirtualResourceBypass(entry)

		if (entry.resource && !entry.resourceNeedsReload) {
			this.diagnostics.increment("memoryHitCount")
			this.setFailureReason(entry, null)
			return this.buildLoadedResource(entry)
		}

		if (entry.loadingPromise && !entry.loadingPromise.isAborted) {
			this.diagnostics.increment("loadingDedupedCount")
			return entry.loadingPromise.consume(options?.signal)
		}

		const request = new SharedAbortableRequest<LoadedVideoResource | null>(
			(signal) =>
				this.loadVideoResourcePipeline(path, resourceIdentity, entry, {
					...options,
					signal,
				}),
			{ abortValue: null },
		)
		entry.loadingPromise = request
		void request.promise.then(
			() => {
				if (entry.loadingPromise === request) {
					entry.loadingPromise = null
				}
			},
			() => {
				if (entry.loadingPromise === request) {
					entry.loadingPromise = null
				}
			},
		)

		return request.consume(options?.signal)
	}

	private async loadVideoResourcePipeline(
		path: string,
		resourceIdentity: string,
		entry: ResourceEntry,
		options?: VideoResourceLoadOptions,
	): Promise<LoadedVideoResource | null> {
		if (this.destroyed) {
			this.markStaleRequestDrop()
			return null
		}
		const cachedResource = await this.loadCachedVideoResource(
			path,
			resourceIdentity,
			entry,
			options,
		)
		if (this.destroyed) {
			this.markStaleRequestDrop()
			return null
		}
		if (cachedResource) {
			this.triggerBackgroundMetadataRefresh(path, resourceIdentity, entry)
			return cachedResource
		}
		if (this.shouldDropAbortedLoad(options)) return null
		this.clearCachedFallbackOssSrc(entry)

		const getFileInfo = this.canvas.magicConfigManager.config?.methods?.getFileInfo
		if (!getFileInfo) {
			this.setFailureReason(entry, "load-error")
			return null
		}

		const ossSrc = await this.ensureFreshOssSrc(path, {
			priority: options?.priority,
			...(options?.signal ? { signal: options.signal } : {}),
		})
		if (this.destroyed) {
			this.markStaleRequestDrop()
			return null
		}
		if (!ossSrc) {
			return null
		}
		if (this.shouldDropAbortedLoad(options)) return null

		return this.loadVideoResource(path, resourceIdentity, ossSrc, entry, 0, options)
	}

	private clearExpiredOssSrc(entry: ResourceEntry): boolean {
		return this.urlLifecycle.clearExpiredOssSrc(entry)
	}

	private clearCachedFallbackOssSrc(entry: ResourceEntry): void {
		this.urlLifecycle.clearCachedFallbackOssSrc(entry)
	}

	private applyVirtualResourceBypass(entry: ResourceEntry): void {
		this.urlLifecycle.applyVirtualResourceBypass(entry)
	}

	private triggerBackgroundMetadataRefresh(
		path: string,
		resourceIdentity: string,
		entry: ResourceEntry,
	): void {
		this.urlLifecycle.triggerBackgroundMetadataRefresh(path, resourceIdentity, entry)
	}

	private handleVideoResourceDeleted(entry: ResourceEntry): void {
		this.canvas.mediaResourceOfflineCacheManager.removeCachedResource({
			path: entry.referencePath,
			mediaType: "video",
		})
		if (entry.resource) {
			this.releaseResource(entry.resource, {
				path: entry.referencePath,
				reason: "resource-deleted",
			})
			entry.resource = null
		}
		entry.ossSrc = null
		entry.ossSrcFromCachedFallback = false
		entry.sourceUrl = null
		entry.expiresAt = null
		entry.resourceVersion = null
		entry.sourceUpdatedAt = null
		entry.contentLength = null
		this.canvas.eventEmitter.emit({
			type: "resource:video:load-failed",
			data: { path: entry.referencePath, reason: "not-found" },
		})
	}

	private async exchangeOssSrc(
		path: string,
		entry: ResourceEntry,
		options?: {
			forceRefresh?: boolean
			bypassVirtualResource?: boolean
			priority?: CanvasResourceTaskPriority
		},
	): Promise<string | null> {
		return this.urlLifecycle.exchangeOssSrc(path, entry, options)
	}

	private async loadCachedVideoResource(
		path: string,
		resourceIdentity: string,
		entry: ResourceEntry,
		options?: VideoResourceLoadOptions,
	): Promise<LoadedVideoResource | null> {
		if (this.destroyed) {
			this.markStaleRequestDrop()
			return null
		}
		const previousResourceVersion = entry.resourceVersion
		const cached = await this.urlLifecycle.getCachedResource(path, entry)
		if (!cached?.url) return null
		const resourceVersionChanged =
			!!previousResourceVersion &&
			!!entry.resourceVersion &&
			previousResourceVersion !== entry.resourceVersion
		if (entry.resource && !resourceVersionChanged) {
			entry.resourceNeedsReload = false
			return this.buildLoadedResource(entry)
		}

		const result = await this.loadVideoResource(
			path,
			resourceIdentity,
			cached.url,
			entry,
			0,
			options,
		)
		if (this.destroyed) {
			this.markStaleRequestDrop()
			return null
		}
		if (
			!result &&
			this.canvas.mediaResourceOfflineCacheManager.isVirtualResourceUrl(entry.ossSrc)
		) {
			entry.ossSrc = null
			entry.ossSrcFromCachedFallback = false
		}
		return result
	}

	private async refreshVideoResourceFromNetwork(
		path: string,
		resourceIdentity: string,
		entry: ResourceEntry,
		options?: { forceRefresh?: boolean; priority?: CanvasResourceTaskPriority },
	): Promise<boolean> {
		if (this.destroyed) {
			this.markStaleRequestDrop()
			return false
		}
		const previousSource = entry.source
		const previousFileName = entry.fileName
		const previousResourceVersion = entry.resourceVersion
		const previousSourceUpdatedAt = entry.sourceUpdatedAt
		const previousContentLength = entry.contentLength
		const previousResource = entry.resource
		const restorePreviousResourceMetadata = () => {
			entry.ossSrc = null
			entry.expiresAt = null
			entry.ossSrcFromCachedFallback = false
			entry.sourceUrl = null
			entry.source = previousSource
			entry.fileName = previousFileName
			entry.resourceVersion = previousResourceVersion
			entry.sourceUpdatedAt = previousSourceUpdatedAt
			entry.contentLength = previousContentLength
		}
		const clearDeletedResourceMetadata = () => {
			entry.sourceUrl = null
			entry.source = undefined
			entry.fileName = undefined
			entry.resourceVersion = null
			entry.sourceUpdatedAt = null
			entry.contentLength = null
		}
		entry.ossSrc = null
		entry.ossSrcFromCachedFallback = false
		entry.expiresAt = null

		if (options?.forceRefresh) {
			this.canvas.mediaResourceOfflineCacheManager.removeCachedResource({
				path,
				mediaType: "video",
			})
		}

		const ossSrc = await this.exchangeOssSrc(path, entry, options)
		if (this.destroyed) {
			this.markStaleRequestDrop()
			return false
		}
		if (!ossSrc) {
			const isNotFound = entry.lastFailureReason === "not-found"
			// 附件已删除：丢弃旧 URL 与解码缓存，避免画布仍显示已删视频
			if (isNotFound) {
				const hadSurface = !!entry.resource || !!options?.forceRefresh
				if (entry.resource) {
					this.releaseResource(entry.resource, {
						path: entry.referencePath,
						reason: "resource-not-found",
					})
					entry.resource = null
				}
				entry.resourceNeedsReload = false
				entry.ossSrc = null
				entry.ossSrcFromCachedFallback = false
				entry.expiresAt = null
				clearDeletedResourceMetadata()
				// 首次加载失败由 loadPreviewFromPath 处理；此处通知已有预览的实例切换错误态
				if (hadSurface) {
					this.canvas.eventEmitter.emit({
						type: "resource:video:load-failed",
						data: { path: entry.referencePath, reason: "not-found" },
					})
				}
			} else {
				restorePreviousResourceMetadata()
				entry.resourceNeedsReload = true
				this.canvas.eventEmitter.emit({
					type: "resource:video:load-failed",
					data: {
						path: entry.referencePath,
						reason: entry.lastFailureReason ?? "load-error",
						preservePreview: Boolean(previousResource),
					},
				})
			}
			return false
		}

		entry.resource = null
		const loaded = await this.loadVideoResource(path, resourceIdentity, ossSrc, entry, 0, {
			...options,
			preservePreviewOnFailure: Boolean(previousResource),
		})
		if (this.destroyed) {
			this.markStaleRequestDrop()
			return false
		}
		if (loaded) {
			this.releaseResource(previousResource, {
				path: entry.referencePath,
				reason: "resource-refreshed",
			})
			this.canvas.eventEmitter.emit({
				type: "resource:video:refreshed",
				data: { path: entry.referencePath, resource: loaded },
			})
			return true
		}
		entry.resource = previousResource
		if (entry.ossSrc && entry.ossSrc !== ossSrc) {
			entry.resourceNeedsReload = true
			return false
		}
		restorePreviousResourceMetadata()
		entry.resourceNeedsReload = true
		return false
	}

	private async loadVideoResource(
		path: string,
		resourceIdentity: string,
		ossSrc: string,
		entry: ResourceEntry,
		retryCount = 0,
		options?: VideoResourcePipelineLoadOptions,
	): Promise<LoadedVideoResource | null> {
		if (this.destroyed) {
			this.markStaleRequestDrop()
			return null
		}
		this.diagnostics.increment("previewLoadAttemptCount")
		if (retryCount > 0) this.diagnostics.increment("previewLoadRetryCount")
		const mediaDiag: VideoPreviewMediaDiag = { code: null, message: null }
		let loaded: LoadedVideoResource | null
		try {
			loaded = await this.canvas.resourceScheduler.run(
				"video:preview",
				(signal) => this.previewLoader.extractPreviewResource(ossSrc, mediaDiag, signal),
				{
					source: "video-resource:preview",
					canvasId: this.canvas.id,
					managerInstanceId: this.managerInstanceId,
					path: resourceIdentity,
					url: ossSrc,
					priority: retryCount > 0 ? "critical" : (options?.priority ?? "visible"),
					signal: options?.signal,
				},
			)
		} catch (error) {
			if (isAbortError(error)) {
				this.markStaleRequestDrop()
				return null
			}
			throw error
		}
		if (this.destroyed) {
			this.markStaleRequestDrop()
			return null
		}
		if (this.shouldDropAbortedLoad(options)) return null
		if (loaded && entry.ossSrc !== ossSrc) {
			this.releaseResource(
				{ poster: loaded.poster, metadata: loaded.metadata },
				{
					path: entry.referencePath,
					reason: "stale-load",
				},
			)
			return null
		}
		if (!loaded && retryCount === 0) {
			const freshOssSrc =
				(await this.resolveVirtualResourceFallbackOssSrc(
					path,
					ossSrc,
					entry,
					retryCount,
				)) ?? (await this.exchangeOssSrc(path, entry, { priority: options?.priority }))
			if (freshOssSrc) {
				return this.loadVideoResource(
					path,
					resourceIdentity,
					freshOssSrc,
					entry,
					retryCount + 1,
					options,
				)
			}
		}

		if (!loaded) {
			this.diagnostics.increment("previewLoadFailedCount")
			this.setFailureReason(entry, entry.lastFailureReason ?? "load-error")
			this.canvas.eventEmitter.emit({
				type: "resource:video:load-failed",
				data: {
					path: entry.referencePath,
					reason: entry.lastFailureReason ?? "load-error",
					preservePreview: options?.preservePreviewOnFailure,
				},
			})
			return null
		}

		this.diagnostics.increment("previewLoadSuccessCount")
		const previousResource = entry.resource
		entry.resource = {
			poster: loaded.poster,
			metadata: loaded.metadata,
		}
		entry.resourceLastAccessAt = Date.now()
		if (previousResource && previousResource !== entry.resource) {
			this.releaseResource(previousResource, {
				path: entry.referencePath,
				reason: "resource-replaced",
			})
		}
		entry.resourceNeedsReload = false
		this.setFailureReason(entry, null)
		this.canvas.mediaResourceOfflineCacheManager.recordVirtualResourceLoadSuccess(ossSrc)

		this.entries.set(resourceIdentity, entry)
		return this.buildLoadedResource(entry)
	}

	public async resolveVirtualPlaybackFallbackOssInfo(
		path: string,
		ossSrc: string,
	): Promise<ResolvedVideoOssInfo | null> {
		if (this.destroyed) {
			this.markStaleRequestDrop()
			return null
		}
		if (!this.canvas.mediaResourceOfflineCacheManager.isVirtualResourceUrl(ossSrc)) {
			return null
		}

		const resourceIdentity = this.getResourceIdentity(path)
		const entry = this.getOrCreateEntry(resourceIdentity, path)
		const fallbackOssSrc = await this.resolveVirtualResourceFallbackOssSrc(
			path,
			ossSrc,
			entry,
			0,
		)
		if (!fallbackOssSrc) return null
		return {
			ossSrc: fallbackOssSrc,
			expiresAt: entry.expiresAt,
		}
	}

	private async resolveVirtualResourceFallbackOssSrc(
		path: string,
		ossSrc: string,
		entry: ResourceEntry,
		retryCount: number,
	): Promise<string | null> {
		return this.urlLifecycle.resolveVirtualResourceFallbackOssSrc(
			path,
			ossSrc,
			entry,
			retryCount,
		)
	}

	private scheduleCleanup(): void {
		if (this.cleanupTimer) {
			clearTimeout(this.cleanupTimer)
		}

		this.cleanupTimer = setTimeout(() => {
			void this.checkAndCleanupResources()
			this.cleanupTimer = null
		}, this.CLEANUP_DEBOUNCE_DELAY)
	}

	private async checkAndCleanupResources(): Promise<void> {
		if (this.cleanupTimer) {
			clearTimeout(this.cleanupTimer)
			this.cleanupTimer = null
		}

		const usedPaths = new Set<string>()
		const elementsDict = this.canvas.elementManager.getElementsDict()
		for (const elementData of Object.values(elementsDict)) {
			if (elementData.type !== ElementTypeEnum.Video) continue
			const effectiveContent = this.canvas.getEffectiveContent(elementData.id) as
				{ src?: string } | undefined
			if (!effectiveContent?.src) continue
			usedPaths.add(this.getResourceIdentity(effectiveContent.src))
		}

		this.entries.forEach((entry, resourceIdentity) => {
			if (usedPaths.has(resourceIdentity)) return

			if (entry.resource) {
				this.releaseResource(entry.resource, {
					path: entry.referencePath,
					reason: "unused-resource",
				})
				entry.resource = null
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
				mediaType: "video",
			})
			if (!entry.exchangePromise && !entry.loadingPromise) {
				this.entries.delete(resourceIdentity)
			}
		})
	}

	private releaseResource(
		resource: VideoResource | null,
		context?: { path?: string; reason?: string },
	): void {
		if (!resource) {
			return
		}

		if (releasedVideoPosters.has(resource.poster)) return

		// Notify consumers while the source still has its original dimensions. The
		// scene-graph fallback below covers both VideoElement and VideoEditElement,
		// including stale Konva nodes left behind by a deferred rerender.
		releasedVideoPosters.add(resource.poster)
		this.canvas.eventEmitter?.emit({
			type: "resource:video:will-release",
			data: {
				path: context?.path,
				poster: resource.poster,
				reason: context?.reason ?? "unknown",
			},
		})
		this.detachPosterFromSceneGraph(resource.poster)

		// Keep a drawable fallback surface. A stale Konva node must never receive a
		// 0×0 canvas, even if it survives until the next render pass.
		resource.poster.width = 1
		resource.poster.height = 1
	}

	private detachPosterFromSceneGraph(poster: VideoPosterSource): void {
		const roots: unknown[] = [this.canvas.stage]
		try {
			const layers = this.canvas.getAllLayers?.()
			if (layers) roots.unshift(...Array.from(layers.values()))
		} catch {
			// Canvas teardown can race resource cleanup; the stage root is still best effort.
		}
		const visited = new Set<object>()

		const visit = (value: unknown): void => {
			if (!value || typeof value !== "object" || visited.has(value)) return
			visited.add(value)

			const node = value as {
				getClassName?: () => string
				image?: (next?: CanvasImageSource) => CanvasImageSource | undefined
				getChildren?: () => unknown
			}
			if (node.getClassName?.() === "Image" && typeof node.image === "function") {
				try {
					if (node.image() === poster) node.image(undefined)
				} catch {
					// Destroyed Konva nodes can reject reads while Canvas is unmounting.
				}
			}

			try {
				const children = node.getChildren?.()
				if (Array.isArray(children)) children.forEach(visit)
			} catch {
				// Continue with other layer roots if one stale node is unavailable.
			}
		}

		roots.forEach(visit)
	}

	private getPosterBytes(poster: VideoPosterSource): number {
		return Math.max(0, poster.width) * Math.max(0, poster.height) * 4
	}
}

function isAbortError(error: unknown): boolean {
	return error instanceof Error
		? error.name === "AbortError"
		: typeof error === "object" &&
				error !== null &&
				"name" in error &&
				(error as { name?: unknown }).name === "AbortError"
}
