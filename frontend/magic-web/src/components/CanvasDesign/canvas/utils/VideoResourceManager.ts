import type { Canvas } from "../Canvas"
import type { AttachmentSourceEnum } from "../../types.magic"
import { ElementTypeEnum } from "../types"
import { parseExpiresAt, isOssExpired } from "./ossExpiryUtils"
import { resolveCanonicalResourcePath, normalizePathLocal } from "./pathUtils"
import {
	getFailureReasonFromGetFileInfoError,
	type ResourceLoadFailureReason,
} from "./resourceLoadFailure"

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

interface VideoResource {
	poster: VideoPosterSource
	metadata: LoadedVideoMetadata
}

interface ResourceEntry {
	ossSrc: string | null
	sourceUrl: string | null
	expiresAt: number | null
	source?: AttachmentSourceEnum
	fileName?: string
	exchangePromise: Promise<string | null> | null
	loadingPromise: Promise<LoadedVideoResource | null> | null
	resource: VideoResource | null
	backgroundRefreshPromise: Promise<void> | null
	lastFailureReason: ResourceLoadFailureReason | null
}

interface VideoPreviewMediaDiag {
	code: number | null
	message: string | null
}

/**
 * 按项目 path 缓存视频：换链、解码首帧海报、合并重复加载请求
 */
export class VideoResourceManager {
	private canvas: Canvas
	private entries: Map<string, ResourceEntry> = new Map()
	private pathAliasToCanonical = new Map<string, string>()
	private cleanupTimer: ReturnType<typeof setTimeout> | null = null
	private readonly CLEANUP_DEBOUNCE_DELAY = 100
	private readonly MAX_PREVIEW_EDGE = 768
	private readonly PREVIEW_LOAD_CONCURRENCY = 3
	private activePreviewLoadCount = 0
	private previewLoadQueue: Array<{
		run: () => void
		reject: (error: Error) => void
	}> = []

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

	private getResolveAbsolutePath(): ((path: string) => string) | undefined {
		return this.canvas.magicConfigManager.config?.methods?.resolveAbsolutePath
	}

	private rememberPathAlias(rawPath: string, canonical: string): void {
		const weak = normalizePathLocal(rawPath)
		this.pathAliasToCanonical.set(weak, canonical)
		this.pathAliasToCanonical.set(canonical, canonical)
	}

	private canonicalResourcePath(path: string): string {
		const canonical = resolveCanonicalResourcePath(path, this.getResolveAbsolutePath())
		this.rememberPathAlias(path, canonical)
		return canonical
	}

	constructor(options: { canvas: Canvas }) {
		this.canvas = options.canvas
		this.canvas.eventEmitter.on("element:deleted", this.handleElementDeleted)
		this.canvas.eventEmitter.on("element:batchdeleted", this.handleBatchDeleted)
		this.canvas.eventEmitter.on("canvas:clear", this.handleCanvasClear)
	}

	/** 触发后台加载（不等待完成），用于预热 */
	public loadResource(path: string): void {
		this.loadVideoInternal(path).catch((error) => {
			void error
		})
	}

	/** 等待加载完成，返回可播放 URL 与海报（通用入口） */
	public async getResource(path: string): Promise<LoadedVideoResource | null> {
		return this.loadVideoInternal(path)
	}

	/** 与 getResource 相同实现，语义上用于画布预览场景 */
	public async getPreviewResource(path: string): Promise<LoadedVideoResource | null> {
		return this.loadVideoInternal(path)
	}

	public async ensureFreshOssInfo(
		path: string,
		options?: { forceRefresh?: boolean; bypassVirtualResource?: boolean },
	): Promise<ResolvedVideoOssInfo | null> {
		const normalizedPath = this.canonicalResourcePath(path)
		const entry = this.getOrCreateEntry(normalizedPath)
		if (options?.forceRefresh) {
			entry.ossSrc = null
			entry.expiresAt = null
		} else {
			this.clearExpiredOssSrc(entry)
			this.applyVirtualResourceBypass(entry)
		}
		if (entry.ossSrc) {
			return {
				ossSrc: entry.ossSrc,
				expiresAt: entry.expiresAt,
			}
		}

		const ossSrc = await this.exchangeOssSrc(path, entry)
		if (!ossSrc) {
			if (this.canvas.mediaResourceOfflineCacheManager.shouldBypassVirtualResource()) {
				return null
			}
			const cached = await this.canvas.mediaResourceOfflineCacheManager.getCachedResource(
				path,
				"video",
			)
			if (!cached?.url) {
				return null
			}
			entry.ossSrc = cached.url
			entry.expiresAt = cached.expiresAt ?? null
			return {
				ossSrc: cached.url,
				expiresAt: entry.expiresAt,
			}
		}

		return {
			ossSrc,
			expiresAt: entry.expiresAt,
		}
	}

	/** 若缓存过期则重新换链，返回当前可用的 ossSrc */
	public async ensureFreshOssSrc(path: string): Promise<string | null> {
		return (await this.ensureFreshOssInfo(path))?.ossSrc ?? null
	}

	public getFailureReason(path: string): ResourceLoadFailureReason | null {
		const weak = normalizePathLocal(path)
		const canonical = this.pathAliasToCanonical.get(weak) ?? weak
		return (
			this.entries.get(canonical)?.lastFailureReason ??
			this.entries.get(weak)?.lastFailureReason ??
			null
		)
	}

	public async refreshResource(path: string): Promise<boolean> {
		const normalizedPath = this.canonicalResourcePath(path)
		if (!normalizedPath) return false

		const entry = this.getOrCreateEntry(normalizedPath)
		if (entry.loadingPromise) {
			await entry.loadingPromise.catch(() => null)
		}
		return this.refreshVideoResourceFromNetwork(path, normalizedPath, entry, {
			forceRefresh: true,
		})
	}

	/** 用上传/生成结果直接写入缓存，跳过首次网络解码路径 */
	public primeCache(path: string, fileInfo: { src: string; expires_at?: string }): void {
		const normalizedPath = this.canonicalResourcePath(path)
		const entry = this.getOrCreateEntry(normalizedPath)
		entry.ossSrc = fileInfo.src
		entry.sourceUrl = fileInfo.src
		entry.expiresAt = parseExpiresAt(fileInfo.expires_at)
	}

	/** 读取当前缓存中的视频元信息；不触发换链与解码，供快速布局使用 */
	public getCachedMetadata(path: string): LoadedVideoMetadata | null {
		const weak = normalizePathLocal(path)
		const canonical = this.pathAliasToCanonical.get(weak) ?? weak
		const entry = this.entries.get(canonical) ?? this.entries.get(weak)
		return entry?.resource?.metadata ?? null
	}

	/** 释放缓存与事件监听 */
	public destroy(): void {
		if (this.cleanupTimer) {
			clearTimeout(this.cleanupTimer)
			this.cleanupTimer = null
		}

		const pendingError = new Error("VideoResourceManager destroyed")
		this.previewLoadQueue.forEach(({ reject }) => reject(pendingError))
		this.previewLoadQueue = []
		this.entries.forEach((entry) => {
			this.releaseResource(entry.resource)
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
		this.setFailureReason(entry, null)

		return {
			ossSrc: entry.ossSrc,
			poster: entry.resource.poster,
			metadata: entry.resource.metadata,
		}
	}

	private getOrCreateEntry(normalizedPath: string): ResourceEntry {
		let entry = this.entries.get(normalizedPath)
		if (!entry) {
			entry = {
				ossSrc: null,
				sourceUrl: null,
				expiresAt: null,
				exchangePromise: null,
				loadingPromise: null,
				backgroundRefreshPromise: null,
				resource: null,
				lastFailureReason: null,
			}
			this.entries.set(normalizedPath, entry)
		}
		return entry
	}

	private async loadVideoInternal(path: string): Promise<LoadedVideoResource | null> {
		const getFileInfo = this.canvas.magicConfigManager.config?.methods?.getFileInfo
		const normalizedPath = this.canonicalResourcePath(path)
		if (!getFileInfo) {
			this.setFailureReason(this.getOrCreateEntry(normalizedPath), "load-error")
			return null
		}

		const entry = this.getOrCreateEntry(normalizedPath)
		this.clearExpiredOssSrc(entry)
		this.applyVirtualResourceBypass(entry)
		const cachedResource = await this.loadCachedVideoResource(path, normalizedPath, entry)
		if (cachedResource) {
			this.triggerBackgroundRefresh(path, normalizedPath, entry)
			return cachedResource
		}

		const ossSrc = await this.ensureFreshOssSrc(path)
		if (!ossSrc) {
			return null
		}

		if (entry.resource) {
			this.setFailureReason(entry, null)
			return this.buildLoadedResource(entry)
		}

		if (entry.loadingPromise) {
			return entry.loadingPromise
		}

		const promise = this.enqueuePreviewLoad(() =>
			this.loadVideoResource(path, normalizedPath, ossSrc, entry),
		)
		entry.loadingPromise = promise

		try {
			return await promise
		} finally {
			entry.loadingPromise = null
		}
	}

	private clearExpiredOssSrc(entry: ResourceEntry): void {
		if (entry.ossSrc && isOssExpired(entry.expiresAt)) {
			entry.ossSrc = null
			entry.sourceUrl = null
			entry.expiresAt = null
		}
	}

	private applyVirtualResourceBypass(entry: ResourceEntry): void {
		if (
			!entry.ossSrc ||
			!this.canvas.mediaResourceOfflineCacheManager.shouldBypassVirtualResource() ||
			!this.canvas.mediaResourceOfflineCacheManager.isVirtualResourceUrl(entry.ossSrc)
		) {
			return
		}

		entry.ossSrc = entry.sourceUrl && !isOssExpired(entry.expiresAt) ? entry.sourceUrl : null
	}

	private triggerBackgroundRefresh(
		path: string,
		normalizedPath: string,
		entry: ResourceEntry,
	): void {
		if (entry.backgroundRefreshPromise) return

		entry.backgroundRefreshPromise = this.refreshVideoResourceFromNetwork(
			path,
			normalizedPath,
			entry,
		)
			.then(() => undefined)
			.catch(() => undefined)
			.finally(() => {
				entry.backgroundRefreshPromise = null
			})
	}

	private async exchangeOssSrc(
		path: string,
		entry: ResourceEntry,
		options?: { forceRefresh?: boolean; bypassVirtualResource?: boolean },
	): Promise<string | null> {
		const getFileInfo = this.canvas.magicConfigManager.config?.methods?.getFileInfo
		if (!getFileInfo) {
			this.setFailureReason(entry, "load-error")
			return null
		}

		if (entry.exchangePromise && !options?.forceRefresh) {
			return entry.exchangePromise
		}

		const promise = (async () => {
			try {
				const fileInfo = await getFileInfo(path, {
					useImageProcess: false,
					forceRefresh: options?.forceRefresh,
				})
				if (fileInfo?.src) {
					this.setFailureReason(entry, null)
					entry.expiresAt = parseExpiresAt(fileInfo.expires_at)
					entry.sourceUrl = fileInfo.src
					entry.source = fileInfo.source
					entry.fileName = fileInfo.fileName
					const resourceUrl =
						await this.canvas.mediaResourceOfflineCacheManager.resolveResourceUrl(
							{
								path,
								url: fileInfo.src,
								mediaType: "video",
								expiresAt: entry.expiresAt,
							},
							{
								bypassVirtualResource: options?.bypassVirtualResource,
							},
						)
					entry.ossSrc = resourceUrl
					return resourceUrl
				}
				this.setFailureReason(entry, "load-error")
				return null
			} catch (error) {
				const reason = getFailureReasonFromGetFileInfoError(error)
				this.setFailureReason(entry, reason)
				if (reason === "not-found") {
					const cachePath = this.canonicalResourcePath(path)
					this.canvas.mediaResourceOfflineCacheManager.removeCachedResource({
						path: cachePath,
						mediaType: "video",
					})
				}
				return null
			}
		})()

		entry.exchangePromise = promise

		try {
			return await promise
		} finally {
			entry.exchangePromise = null
		}
	}

	private async loadCachedVideoResource(
		path: string,
		normalizedPath: string,
		entry: ResourceEntry,
	): Promise<LoadedVideoResource | null> {
		try {
			if (this.canvas.mediaResourceOfflineCacheManager.shouldBypassVirtualResource()) {
				return null
			}
			const cached = await this.canvas.mediaResourceOfflineCacheManager.getCachedResource(
				path,
				"video",
			)
			if (!cached?.url) return null

			entry.ossSrc = cached.url
			entry.sourceUrl = cached.sourceUrl ?? null
			entry.expiresAt = cached.expiresAt ?? null
			if (entry.resource) {
				return this.buildLoadedResource(entry)
			}
			if (entry.loadingPromise) {
				return entry.loadingPromise
			}

			const promise = this.enqueuePreviewLoad(() =>
				this.loadVideoResource(path, normalizedPath, cached.url, entry),
			)
			entry.loadingPromise = promise
			try {
				return await promise
			} finally {
				entry.loadingPromise = null
			}
		} catch {
			this.setFailureReason(entry, "load-error")
			return null
		}
	}

	private async refreshVideoResourceFromNetwork(
		path: string,
		normalizedPath: string,
		entry: ResourceEntry,
		options?: { forceRefresh?: boolean },
	): Promise<boolean> {
		const previousOssSrc = entry.ossSrc
		entry.ossSrc = null
		entry.expiresAt = null

		if (options?.forceRefresh) {
			this.canvas.mediaResourceOfflineCacheManager.removeCachedResource({
				path: normalizedPath,
				mediaType: "video",
			})
		}

		const ossSrc = await this.exchangeOssSrc(path, entry, options)
		if (!ossSrc) {
			const isNotFound = entry.lastFailureReason === "not-found"
			// 附件已删除：丢弃旧 URL 与解码缓存，避免画布仍显示已删视频
			if (isNotFound) {
				const hadSurface = !!entry.resource || !!previousOssSrc || !!options?.forceRefresh
				if (entry.resource) {
					this.releaseResource(entry.resource)
					entry.resource = null
				}
				entry.ossSrc = null
				entry.expiresAt = null
				// 首次加载失败由 loadPreviewFromPath 处理；此处通知已有预览的实例切换错误态
				if (hadSurface) {
					this.canvas.eventEmitter.emit({
						type: "resource:video:load-failed",
						data: { path: normalizedPath, reason: "not-found" },
					})
				}
			} else {
				entry.ossSrc = previousOssSrc
			}
			return false
		}

		const refreshed = await this.canvas.mediaResourceOfflineCacheManager.refreshCachedResource(
			path,
			"video",
		)
		if (!options?.forceRefresh && !refreshed && ossSrc === previousOssSrc && entry.resource) {
			return false
		}

		const previousResource = entry.resource
		entry.resource = null
		const loaded = await this.loadVideoResource(path, normalizedPath, ossSrc, entry)
		if (loaded) {
			this.releaseResource(previousResource)
			this.canvas.eventEmitter.emit({
				type: "resource:video:refreshed",
				data: { path: normalizedPath, resource: loaded },
			})
			return true
		}
		entry.resource = previousResource
		return false
	}

	private async loadVideoResource(
		path: string,
		normalizedPath: string,
		ossSrc: string,
		entry: ResourceEntry,
		retryCount = 0,
	): Promise<LoadedVideoResource | null> {
		const mediaDiag: VideoPreviewMediaDiag = { code: null, message: null }
		const loaded = await this.extractPreviewResource(ossSrc, mediaDiag)
		if (!loaded && retryCount === 0) {
			const freshOssSrc =
				(await this.resolveVirtualResourceFallbackOssSrc(
					path,
					ossSrc,
					entry,
					retryCount,
				)) ?? (await this.exchangeOssSrc(path, entry))
			if (freshOssSrc) {
				return this.loadVideoResource(
					path,
					normalizedPath,
					freshOssSrc,
					entry,
					retryCount + 1,
				)
			}
		}

		if (!loaded) {
			this.setFailureReason(entry, entry.lastFailureReason ?? "load-error")
			return null
		}

		entry.resource = {
			poster: loaded.poster,
			metadata: loaded.metadata,
		}
		this.setFailureReason(entry, null)
		this.canvas.mediaResourceOfflineCacheManager.recordVirtualResourceLoadSuccess(ossSrc)

		this.entries.set(normalizedPath, entry)
		return this.buildLoadedResource(entry)
	}

	public async resolveVirtualPlaybackFallbackOssInfo(
		path: string,
		ossSrc: string,
	): Promise<ResolvedVideoOssInfo | null> {
		if (!this.canvas.mediaResourceOfflineCacheManager.isVirtualResourceUrl(ossSrc)) {
			return null
		}

		const normalizedPath = this.canonicalResourcePath(path)
		const entry = this.getOrCreateEntry(normalizedPath)
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
		if (
			retryCount > 0 ||
			!this.canvas.mediaResourceOfflineCacheManager.isVirtualResourceUrl(ossSrc)
		) {
			return null
		}

		this.canvas.mediaResourceOfflineCacheManager.recordVirtualResourceLoadFailure(ossSrc)
		if (entry.sourceUrl && !isOssExpired(entry.expiresAt)) {
			entry.ossSrc = entry.sourceUrl
			return entry.sourceUrl
		}

		entry.ossSrc = null
		entry.expiresAt = null
		return this.exchangeOssSrc(path, entry, {
			forceRefresh: true,
			bypassVirtualResource: true,
		})
	}

	private enqueuePreviewLoad<T>(task: () => Promise<T>): Promise<T> {
		return new Promise((resolve, reject) => {
			const run = () => {
				this.activePreviewLoadCount += 1
				void task()
					.then(resolve, reject)
					.finally(() => {
						this.activePreviewLoadCount = Math.max(0, this.activePreviewLoadCount - 1)
						const nextTask = this.previewLoadQueue.shift()
						if (nextTask) {
							nextTask.run()
						}
					})
			}

			if (this.activePreviewLoadCount < this.PREVIEW_LOAD_CONCURRENCY) {
				run()
				return
			}

			this.previewLoadQueue.push({
				run,
				reject: (error) => reject(error),
			})
		})
	}

	private extractPreviewResource(
		ossSrc: string,
		mediaDiag?: VideoPreviewMediaDiag,
	): Promise<LoadedVideoResource | null> {
		return new Promise((resolve) => {
			const video = document.createElement("video")
			video.crossOrigin = "anonymous"
			video.preload = "auto"
			video.playsInline = true
			video.muted = true
			video.src = ossSrc

			let settled = false
			let metadata: LoadedVideoMetadata | null = null

			const cleanup = () => {
				video.removeEventListener("loadedmetadata", handleLoadedMetadata)
				video.removeEventListener("loadeddata", handleLoadedData)
				video.removeEventListener("error", handleError)
				video.removeEventListener("seeked", handleSeeked)
			}

			const dispose = () => {
				video.pause()
				video.removeAttribute("src")
				video.load()
			}

			const finish = (resource: LoadedVideoResource | null) => {
				if (settled) {
					return
				}
				settled = true
				cleanup()
				dispose()
				resolve(resource)
			}

			const buildResource = (): boolean => {
				const loadedMetadata = metadata ?? this.extractLoadedMetadata(video)
				const poster = this.createPosterFromVideoFrame(video, loadedMetadata, mediaDiag)
				if (!poster) {
					return false
				}

				finish({
					ossSrc,
					poster,
					metadata: loadedMetadata,
				})
				return true
			}

			const seekToPreviewFrame = () => {
				try {
					const targetTime = 0.001
					if (Math.abs(video.currentTime - targetTime) < 1e-9) {
						if (!buildResource()) {
							finish(null)
						}
						return
					}

					video.addEventListener("seeked", handleSeeked, { once: true })
					video.currentTime = targetTime
				} catch {
					if (!buildResource()) {
						finish(null)
					}
				}
			}

			const handleSeeked = () => {
				if (!buildResource()) {
					finish(null)
				}
			}

			const handleLoadedMetadata = () => {
				metadata = this.extractLoadedMetadata(video)
			}

			const handleLoadedData = () => {
				// 优先直接提取当前帧，失败时再回退到旧的 seek 方案。
				requestAnimationFrame(() => {
					if (settled) {
						return
					}
					if (!buildResource()) {
						seekToPreviewFrame()
					}
				})
			}

			const handleError = () => {
				if (mediaDiag && video.error) {
					mediaDiag.code = video.error.code
					mediaDiag.message = video.error.message || null
				}
				finish(null)
			}

			video.addEventListener("loadedmetadata", handleLoadedMetadata, { once: true })
			video.addEventListener("loadeddata", handleLoadedData, { once: true })
			video.addEventListener("error", handleError, { once: true })
			video.load()

			if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
				handleLoadedData()
			}
		})
	}

	private extractLoadedMetadata(video: HTMLVideoElement): LoadedVideoMetadata {
		return {
			duration: Number.isFinite(video.duration) ? video.duration : 0,
			videoWidth: Math.max(1, video.videoWidth || 1),
			videoHeight: Math.max(1, video.videoHeight || 1),
		}
	}

	private createPosterFromVideoFrame(
		video: HTMLVideoElement,
		metadata: LoadedVideoMetadata,
		mediaDiag?: VideoPreviewMediaDiag,
	): VideoPosterSource | null {
		const { width, height } = this.getPosterCanvasSize(
			metadata.videoWidth,
			metadata.videoHeight,
		)
		const poster = document.createElement("canvas")
		poster.width = width
		poster.height = height
		const ctx = poster.getContext("2d")
		if (!ctx) {
			return null
		}

		try {
			ctx.drawImage(video, 0, 0, width, height)
			return poster
		} catch (drawErr) {
			if (mediaDiag) {
				mediaDiag.code = null
				mediaDiag.message = drawErr instanceof Error ? drawErr.message : String(drawErr)
			}
			return null
		}
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
			if (elementData.type !== ElementTypeEnum.Video || !elementData.src) {
				continue
			}
			usedPaths.add(this.canonicalResourcePath(elementData.src))
		}

		this.entries.forEach((entry, path) => {
			if (usedPaths.has(path)) return

			if (entry.resource) {
				this.releaseResource(entry.resource)
				entry.resource = null
				this.canvas.eventEmitter.emit({
					type: "resource:released",
					data: { path },
				})
			}
			entry.ossSrc = null
			entry.expiresAt = null
			this.canvas.mediaResourceOfflineCacheManager.removeCachedResource({
				path,
				mediaType: "video",
			})
			if (!entry.exchangePromise && !entry.loadingPromise) {
				this.entries.delete(path)
			}
		})
	}

	private getPosterCanvasSize(
		videoWidth: number,
		videoHeight: number,
	): { width: number; height: number } {
		const longestEdge = Math.max(videoWidth, videoHeight)
		if (longestEdge <= this.MAX_PREVIEW_EDGE) {
			return { width: videoWidth, height: videoHeight }
		}

		const scale = this.MAX_PREVIEW_EDGE / longestEdge
		return {
			width: Math.max(1, Math.round(videoWidth * scale)),
			height: Math.max(1, Math.round(videoHeight * scale)),
		}
	}

	private releaseResource(resource: VideoResource | null): void {
		if (!resource) {
			return
		}

		resource.poster.width = 0
		resource.poster.height = 0
	}
}
