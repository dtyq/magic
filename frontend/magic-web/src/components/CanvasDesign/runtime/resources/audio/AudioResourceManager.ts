import type { Canvas } from "../../core/Canvas"
import type { AttachmentSourceEnum, UploadFileResponse } from "../../../public/magic-types"
import {
	MediaResourceUrlLifecycle,
	type MediaResourceUrlEntry,
} from "../offline-cache/MediaResourceUrlLifecycle"
import type { ResourceLoadFailureReason } from "../media-common/resourceLoadFailure"
import type { CanvasResourceTaskPriority } from "../scheduler/CanvasResourceScheduler"
import type { CanvasResourceReferenceResolverChangeOptions } from "../../shared/path/canvasResourcePath"

export interface LoadedAudioResource {
	path: string
	ossSrc: string
	fileName?: string
	expiresAt: number | null
	resourceIdentity: string
	resourceVersion: string | null
	sourceUpdatedAt: string | null
}

export interface AudioResourceLoadOptions {
	forceRefresh?: boolean
	allowCachedFallback?: boolean
	priority?: CanvasResourceTaskPriority
	signal?: AbortSignal
}

interface AudioResourceEntry extends MediaResourceUrlEntry {
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
	backgroundRefreshPromise: Promise<void> | null
	lastFailureReason: ResourceLoadFailureReason | null
}

/**
 * 音频 URL 与离线 body 生命周期。
 *
 * 近视口只经过这里换取并登记虚拟 URL；可见音频由 AudioPlaybackManager 请求该 URL，
 * 首次虚拟请求会交给 Service Worker 完整缓存 body。
 */
export class AudioResourceManager {
	private readonly canvas: Canvas
	private readonly entries = new Map<string, AudioResourceEntry>()
	private readonly urlLifecycle: MediaResourceUrlLifecycle<AudioResourceEntry>
	private destroyed = false

	constructor(options: { canvas: Canvas }) {
		this.canvas = options.canvas
		this.urlLifecycle = new MediaResourceUrlLifecycle<AudioResourceEntry>({
			canvas: this.canvas,
			mediaType: "audio",
			useImageProcess: false,
			isDestroyed: () => this.destroyed,
			setFailureReason: (entry, reason) => {
				entry.lastFailureReason = reason
			},
			onResourceDeleted: (resourceIdentity, entry) => {
				this.handleResourceDeleted(resourceIdentity, entry)
			},
			refreshResource: (path) => this.refresh(path),
			onResourceVersionChanged: (_resourceIdentity, entry) => {
				this.invalidateCachedBody(entry.referencePath)
				this.canvas.audioPlaybackManager?.releaseByPath(entry.referencePath, {
					preserveMetadata: true,
				})
				this.canvas.audioWaveformManager?.invalidatePath(entry.referencePath)
				this.canvas.visibilityManager?.invalidateAudioLoadRequest(
					entry.referencePath,
					"resource-version-changed",
				)
			},
			incrementDiagnostic: () => undefined,
		})
	}

	public async getResource(
		path: string,
		options?: AudioResourceLoadOptions,
	): Promise<LoadedAudioResource | null> {
		if (this.destroyed || !path || options?.signal?.aborted) return null
		if (this.canvas.canvasFileUploadManager?.shouldDeferRemoteResourceLoad(path)) return null

		const resourceIdentity = this.urlLifecycle.getResourceIdentity(path)
		const entry = this.getOrCreateEntry(resourceIdentity, path)
		entry.referencePath = path

		if (options?.forceRefresh) {
			this.invalidateCachedBody(path)
			this.canvas.audioWaveformManager?.invalidatePath(path)
		}

		if (!options?.forceRefresh) {
			const cached = await this.urlLifecycle.getCachedResource(path, entry)
			if (options?.signal?.aborted || this.destroyed) return null
			if (cached?.url) {
				this.urlLifecycle.triggerBackgroundMetadataRefresh(path, resourceIdentity, entry)
				return this.toLoadedResource(entry)
			}
		}

		const result = await this.urlLifecycle.ensureFreshOssInfo(path, entry, {
			forceRefresh: options?.forceRefresh,
			allowCachedFallback: options?.allowCachedFallback ?? true,
			priority: options?.priority ?? "critical",
		})
		if (options?.signal?.aborted || this.destroyed) return null
		if (!result) {
			// 生命周期可能因更新上传结果或更高代请求而主动淘汰当前请求；这不是资源删除，
			// 不应广播失败或清理同一路径的其他音频播放会话。
			if (!entry.lastFailureReason) return null
			if (entry.lastFailureReason === "not-found") {
				// 前台 getFileInfo 也可能直接确认删除；与后台 metadata deleted 走同一清理路径，
				// 避免旧虚拟键和已存在的播放会话继续引用已删除 body。
				this.handleResourceDeleted(resourceIdentity, entry)
			} else {
				this.emitLoadFailed(entry)
			}
			return null
		}

		await this.promoteDirectUrlToVirtual(path, entry)
		if (options?.signal?.aborted || this.destroyed) return null
		return this.toLoadedResource(entry)
	}

	public async refresh(path: string): Promise<boolean> {
		if (this.destroyed || !path) return false
		return Boolean(
			await this.getResource(path, {
				forceRefresh: true,
				allowCachedFallback: false,
				priority: "critical",
			}),
		)
	}

	public async resolveVirtualPlaybackFallback(
		path: string,
		ossSrc: string,
	): Promise<LoadedAudioResource | null> {
		if (this.destroyed || !path) return null
		const resourceIdentity = this.urlLifecycle.getResourceIdentity(path)
		const entry = this.getOrCreateEntry(resourceIdentity, path)
		const fallbackOssSrc = await this.urlLifecycle.resolveVirtualResourceFallbackOssSrc(
			path,
			ossSrc,
			entry,
			0,
		)
		if (!fallbackOssSrc || this.destroyed) return null
		return this.toLoadedResource(entry)
	}

	public primeCache(path: string, uploadResult: UploadFileResponse): void {
		if (this.destroyed || !path || !uploadResult.src) return
		const resourceIdentity = this.urlLifecycle.getResourceIdentity(path)
		const entry = this.getOrCreateEntry(resourceIdentity, path)
		this.urlLifecycle.primeCache(path, entry, uploadResult)

		// 上传结果先保证立即可用，再异步登记虚拟 URL；SW 尚未接管时保留上传直链。
		void this.promoteDirectUrlToVirtual(path, entry)
	}

	public getFailureReason(path: string): ResourceLoadFailureReason | null {
		const identity = this.urlLifecycle.getResourceIdentity(path)
		return this.entries.get(identity)?.lastFailureReason ?? null
	}

	public getResourceIdentity(path: string): string {
		return this.urlLifecycle.getResourceIdentity(path)
	}

	public invalidateForReplacement(path: string): void {
		if (this.destroyed || !path) return
		const resourceIdentity = this.urlLifecycle.getResourceIdentity(path)
		const entry = this.entries.get(resourceIdentity)
		if (entry) {
			entry.exchangeToken = undefined
			entry.exchangePromise = null
			entry.backgroundRefreshPromise = null
		}
		this.invalidateCachedBody(path)
		this.entries.delete(resourceIdentity)
		this.canvas.audioPlaybackManager?.releaseByPath(path, { preserveMetadata: true })
		this.canvas.audioWaveformManager?.invalidatePath(path)
		this.canvas.visibilityManager?.invalidateAudioLoadRequest(path, "audio-replaced", {
			scheduleRefresh: false,
		})
	}

	public handleResourceReferenceResolverChanged(
		options?: CanvasResourceReferenceResolverChangeOptions,
	): void {
		if (this.destroyed) return
		if (options?.changedResourceIdentities) {
			Array.from(this.entries.entries()).forEach(([resourceIdentity, entry]) => {
				if (!options.changedResourceIdentities?.has(resourceIdentity)) return
				entry.exchangeToken = undefined
				entry.exchangePromise = null
				entry.backgroundRefreshPromise = null
				this.entries.delete(resourceIdentity)
			})
			return
		}
		this.entries.forEach((entry) => {
			entry.exchangeToken = undefined
			entry.exchangePromise = null
			entry.backgroundRefreshPromise = null
		})
		this.entries.clear()
	}

	public destroy(): void {
		this.destroyed = true
		this.entries.forEach((entry) => {
			entry.exchangeToken = undefined
			entry.exchangePromise = null
			entry.backgroundRefreshPromise = null
		})
		this.entries.clear()
	}

	private getOrCreateEntry(resourceIdentity: string, referencePath: string): AudioResourceEntry {
		const existing = this.entries.get(resourceIdentity)
		if (existing) return existing

		const entry: AudioResourceEntry = {
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
			backgroundRefreshPromise: null,
			lastFailureReason: null,
		}
		this.entries.set(resourceIdentity, entry)
		return entry
	}

	private async promoteDirectUrlToVirtual(
		path: string,
		entry: AudioResourceEntry,
	): Promise<void> {
		if (!entry.ossSrc || this.destroyed) return
		const offlineCache = this.canvas.mediaResourceOfflineCacheManager
		if (offlineCache.isVirtualResourceUrl(entry.ossSrc)) return

		const sourceUrl = entry.sourceUrl ?? entry.ossSrc
		const resourceUrl = await offlineCache.resolveResourceUrl(
			{
				path,
				url: sourceUrl,
				mediaType: "audio",
				expiresAt: entry.expiresAt,
				resourceVersion: entry.resourceVersion,
				sourceUpdatedAt: entry.sourceUpdatedAt,
				contentLength: entry.contentLength,
			},
			{ preferVirtualResource: true },
		)
		if (this.destroyed || entry.sourceUrl !== sourceUrl) return
		entry.ossSrc = resourceUrl
		entry.ossSrcFromCachedFallback = false
	}

	private handleResourceDeleted(resourceIdentity: string, entry: AudioResourceEntry): void {
		this.invalidateCachedBody(entry.referencePath)
		entry.exchangeToken = undefined
		entry.exchangePromise = null
		entry.backgroundRefreshPromise = null
		entry.ossSrc = null
		entry.ossSrcFromCachedFallback = false
		entry.sourceUrl = null
		entry.expiresAt = null
		entry.resourceVersion = null
		entry.sourceUpdatedAt = null
		entry.contentLength = null
		entry.lastFailureReason = "not-found"
		this.canvas.audioPlaybackManager?.releaseByPath(entry.referencePath)
		this.canvas.audioWaveformManager?.invalidatePath(entry.referencePath)
		this.entries.set(resourceIdentity, entry)
		this.emitLoadFailed(entry)
	}

	private invalidateCachedBody(path: string): void {
		this.canvas.mediaResourceOfflineCacheManager.removeCachedResource({
			path,
			mediaType: "audio",
		})
	}

	private emitLoadFailed(entry: AudioResourceEntry): void {
		this.canvas.eventEmitter.emit({
			type: "resource:audio:load-failed",
			data: {
				path: entry.referencePath,
				reason: entry.lastFailureReason ?? "load-error",
			},
		})
	}

	private toLoadedResource(entry: AudioResourceEntry): LoadedAudioResource | null {
		if (!entry.ossSrc) return null
		return {
			path: entry.referencePath,
			ossSrc: entry.ossSrc,
			fileName: entry.fileName,
			expiresAt: entry.expiresAt,
			resourceIdentity: entry.resourceIdentity,
			resourceVersion: entry.resourceVersion,
			sourceUpdatedAt: entry.sourceUpdatedAt,
		}
	}
}
