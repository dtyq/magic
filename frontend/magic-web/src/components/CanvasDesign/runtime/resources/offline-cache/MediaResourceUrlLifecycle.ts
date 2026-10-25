import type { Canvas } from "../../core/Canvas"
import type {
	AttachmentSourceEnum,
	CanvasFileResourceMeta,
	FileUrlRequestPriority,
	GetFileInfoResponse,
} from "../../../public/magic-types"
import type {
	CachedMediaResource,
	MediaResourceOfflineCacheMediaType,
} from "./MediaResourceOfflineCacheManager"
import { OSS_URL_EXPIRY_SAFETY_WINDOW_MS, parseExpiresAt, isOssExpired } from "./ossExpiryUtils"
import {
	getCanvasHostResourceReferenceIdentity,
	isAssetResourcePath,
	isAssetResourceScheme,
	parseAssetResourcePath,
} from "../../shared/path/canvasResourcePath"
import { CanvasAssetResourceError } from "../asset/CanvasAssetResourceManager"
import {
	getFailureReasonFromGetFileInfoError,
	type ResourceLoadFailureReason,
} from "../media-common/resourceLoadFailure"

const SUPERSEDED_RESOURCE_REQUEST = Symbol("superseded-resource-request")
type ExchangeResult = string | null | typeof SUPERSEDED_RESOURCE_REQUEST

export interface MediaResourceUrlEntry {
	/** 可交给宿主 resolver/API 的资源引用路径，不能是 identity。 */
	referencePath: string
	/** 仅用于 Map、Set、缓存与去重的稳定资源身份。 */
	resourceIdentity: string
	ossSrc: string | null
	ossSrcFromCachedFallback: boolean
	sourceUrl: string | null
	expiresAt: number | null
	source?: AttachmentSourceEnum
	fileName?: string
	resourceVersion: string | null
	sourceUpdatedAt: string | null
	contentLength: number | null
	exchangePromise: Promise<ExchangeResult> | null
	exchangeToken?: symbol
	backgroundRefreshPromise: Promise<void> | null
	/** 最近一次后台 metadata 校验调度时间；用于避免缓存命中热路径反复强制换链 */
	lastBackgroundRefreshAt?: number
	/** Legacy asset URLs have no expiry metadata; bound load-error refreshes. */
	assetFailureRefreshUsed?: boolean
	lastFailureReason: ResourceLoadFailureReason | null
}

export interface ResolvedMediaResourceOssInfo {
	ossSrc: string
	expiresAt: number | null
}

export interface MediaResourceUrlLifecycleOptions<TEntry extends MediaResourceUrlEntry> {
	canvas: Canvas
	mediaType: MediaResourceOfflineCacheMediaType
	useImageProcess: boolean
	isDestroyed: () => boolean
	onStaleRequestDrop?: () => void
	setFailureReason: (entry: TEntry, reason: ResourceLoadFailureReason | null) => void
	onResourceDeleted: (resourceIdentity: string, entry: TEntry) => void
	refreshResource: (path: string) => Promise<boolean>
	onResourceMetadataHydrated?: (resourceIdentity: string, entry: TEntry) => void
	onResourceVersionChanged?: (
		resourceIdentity: string,
		entry: TEntry,
		previousVersion: string,
		nextVersion: string,
	) => void
	incrementDiagnostic: (
		counter:
			| "cachedResourceHitCount"
			| "cachedResourceMissCount"
			| "getFileInfoCount"
			| "getFileInfoForceRefreshCount"
			| "backgroundRefreshQueuedCount"
			| "backgroundRefreshDedupedCount"
			| "backgroundRefreshSkippedCount"
			| "metadataProbeCount"
			| "metadataUnchangedCount"
			| "metadataChangedCount"
			| "metadataUnknownCount"
			| "metadataDeletedCount",
	) => void
}

const BACKGROUND_METADATA_REFRESH_COOLDOWN_MS = 60 * 1000

function isOssExpiringWithinSafetyWindow(expiresAt: number | null): boolean {
	return expiresAt !== null && expiresAt - Date.now() <= OSS_URL_EXPIRY_SAFETY_WINDOW_MS
}

export class MediaResourceUrlLifecycle<TEntry extends MediaResourceUrlEntry> {
	constructor(private readonly options: MediaResourceUrlLifecycleOptions<TEntry>) {}

	public getResourceIdentity(path: string): string {
		return getCanvasHostResourceReferenceIdentity(this.options.canvas, path)
	}

	public clearCachedFallbackOssSrc(entry: TEntry): void {
		if (!entry.ossSrcFromCachedFallback) return
		entry.ossSrc = null
		entry.expiresAt = null
		entry.ossSrcFromCachedFallback = false
	}

	public clearExpiredOssSrc(entry: TEntry): boolean {
		if (entry.ossSrc && isOssExpired(entry.expiresAt)) {
			entry.ossSrc = null
			entry.ossSrcFromCachedFallback = false
			entry.sourceUrl = null
			entry.expiresAt = null
			return true
		}
		return false
	}

	public applyVirtualResourceBypass(entry: TEntry): void {
		if (isAssetResourcePath(entry.referencePath)) return
		const offlineCache = this.options.canvas.mediaResourceOfflineCacheManager
		if (
			!entry.ossSrc ||
			!offlineCache.shouldBypassVirtualResource() ||
			!offlineCache.isVirtualResourceUrl(entry.ossSrc)
		) {
			return
		}

		entry.ossSrc = entry.sourceUrl && !isOssExpired(entry.expiresAt) ? entry.sourceUrl : null
		if (!entry.ossSrc) {
			entry.ossSrcFromCachedFallback = false
		}
	}

	public applyFileInfoMetadata(entry: TEntry, fileInfo: GetFileInfoResponse): void {
		const previousResourceVersion = entry.resourceVersion
		entry.sourceUrl = fileInfo.src
		entry.expiresAt = parseExpiresAt(fileInfo.expires_at)
		entry.source = fileInfo.source
		entry.fileName = fileInfo.fileName
		entry.resourceVersion = fileInfo.resource_version ?? null
		entry.sourceUpdatedAt = fileInfo.updated_at ?? null
		entry.contentLength = fileInfo.content_length ?? null
		if (
			previousResourceVersion &&
			entry.resourceVersion &&
			previousResourceVersion !== entry.resourceVersion
		) {
			entry.lastBackgroundRefreshAt = undefined
		}
	}

	public applyResourceMeta(entry: TEntry, meta: CanvasFileResourceMeta): void {
		const previousResourceVersion = entry.resourceVersion
		entry.source = meta.source
		entry.fileName = meta.fileName
		entry.resourceVersion = meta.resourceVersion ?? null
		entry.sourceUpdatedAt = meta.updatedAt ?? null
		entry.contentLength = meta.contentLength ?? null
		if (
			previousResourceVersion &&
			entry.resourceVersion &&
			previousResourceVersion !== entry.resourceVersion
		) {
			entry.lastBackgroundRefreshAt = undefined
		}
	}

	public isSameResourceVersion(
		currentVersion: string | null | undefined,
		latestVersion: string | null | undefined,
	): boolean {
		return !!currentVersion && !!latestVersion && currentVersion === latestVersion
	}

	public async ensureFreshOssInfo(
		path: string,
		entry: TEntry,
		options?: {
			forceRefresh?: boolean
			bypassVirtualResource?: boolean
			allowCachedFallback?: boolean
			priority?: FileUrlRequestPriority
		},
	): Promise<ResolvedMediaResourceOssInfo | null> {
		if (this.isDestroyed()) return null
		// Keep this decision before clearing an expired URL: clearing the entry also
		// clears expiresAt, but an asset that crossed the expiry/safety window must
		// still request fresh detail metadata from the asset service.
		const assetNeedsRefresh =
			isAssetResourcePath(path) &&
			(options?.forceRefresh || isOssExpiringWithinSafetyWindow(entry.expiresAt))

		if (options?.forceRefresh) {
			entry.ossSrc = null
			entry.ossSrcFromCachedFallback = false
			entry.expiresAt = null
		} else {
			this.clearExpiredOssSrc(entry)
			this.applyVirtualResourceBypass(entry)
			if (isAssetResourcePath(path) && isOssExpiringWithinSafetyWindow(entry.expiresAt)) {
				entry.ossSrc = null
				entry.ossSrcFromCachedFallback = false
			}
		}
		if (!options?.allowCachedFallback) {
			this.clearCachedFallbackOssSrc(entry)
		}
		if (entry.ossSrc && !isOssExpired(entry.expiresAt)) {
			return {
				ossSrc: entry.ossSrc,
				expiresAt: entry.expiresAt,
			}
		}

		const exchangeResult = await this.exchangeOssSrcInternal(
			path,
			entry,
			assetNeedsRefresh ? { ...options, forceRefresh: true } : options,
		)
		if (this.isDestroyed()) return null
		if (exchangeResult === SUPERSEDED_RESOURCE_REQUEST) {
			this.options.setFailureReason(entry, null)
			if (entry.ossSrc && !isOssExpired(entry.expiresAt)) {
				return {
					ossSrc: entry.ossSrc,
					expiresAt: entry.expiresAt,
				}
			}
			return null
		}
		const ossSrc = exchangeResult
		if (!ossSrc) {
			this.options.setFailureReason(entry, entry.lastFailureReason ?? "not-found")
			if (
				!options?.allowCachedFallback ||
				options?.forceRefresh ||
				isAssetResourcePath(path) ||
				entry.lastFailureReason === "not-found" ||
				this.options.canvas.mediaResourceOfflineCacheManager.shouldBypassVirtualResource()
			) {
				return null
			}
			const cached = await this.getCachedResource(path, entry)
			if (!cached?.url) return null
			this.options.setFailureReason(entry, null)
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

	public async exchangeOssSrc(
		path: string,
		entry: TEntry,
		options?: {
			forceRefresh?: boolean
			bypassVirtualResource?: boolean
			priority?: FileUrlRequestPriority
		},
	): Promise<string | null> {
		const result = await this.exchangeOssSrcInternal(path, entry, options)
		return result === SUPERSEDED_RESOURCE_REQUEST ? null : result
	}

	private async exchangeOssSrcInternal(
		path: string,
		entry: TEntry,
		options?: {
			forceRefresh?: boolean
			bypassVirtualResource?: boolean
			priority?: FileUrlRequestPriority
		},
	): Promise<ExchangeResult> {
		if (this.isDestroyed()) return null
		const assetId = parseAssetResourcePath(path)
		if (assetId !== undefined) {
			return this.exchangeAssetOssSrcInternal(assetId, entry, options)
		}
		if (isAssetResourceScheme(path)) {
			this.options.setFailureReason(entry, "load-error")
			return null
		}
		const getFileInfo = this.options.canvas.magicConfigManager.config?.methods?.getFileInfo
		if (!getFileInfo) {
			this.options.setFailureReason(entry, "load-error")
			return null
		}

		if (entry.exchangePromise && !options?.forceRefresh) {
			if (options?.priority) {
				void getFileInfo(path, {
					useImageProcess: this.options.useImageProcess,
					priority: options.priority,
				}).catch(() => undefined)
			}
			return entry.exchangePromise
		}

		const exchangeToken = Symbol(`media-url-exchange:${path}`)
		entry.exchangeToken = exchangeToken
		const isCurrentExchange = () => entry.exchangeToken === exchangeToken
		const promise = (async () => {
			try {
				this.options.incrementDiagnostic("getFileInfoCount")
				if (options?.forceRefresh) {
					this.options.incrementDiagnostic("getFileInfoForceRefreshCount")
				}
				const fileInfo = await getFileInfo(path, {
					useImageProcess: this.options.useImageProcess,
					forceRefresh: options?.forceRefresh,
					priority: options?.priority,
				})
				if (this.isDestroyed()) return null
				// 一旦请求已被更高代换链或 primeCache 淘汰，后续任何返回形态都只代表旧请求：
				// 不能继续解析 URL，也不能把空结果补成 not-found 覆盖当前资源状态。
				if (!isCurrentExchange()) return SUPERSEDED_RESOURCE_REQUEST
				if (fileInfo?.src) {
					this.options.setFailureReason(entry, null)
					const previousResourceVersion = entry.resourceVersion
					this.applyFileInfoMetadata(entry, fileInfo)
					if (!previousResourceVersion) {
						this.options.onResourceMetadataHydrated?.(entry.resourceIdentity, entry)
					} else if (
						entry.resourceVersion &&
						entry.resourceVersion !== previousResourceVersion
					) {
						this.options.onResourceVersionChanged?.(
							entry.resourceIdentity,
							entry,
							previousResourceVersion,
							entry.resourceVersion,
						)
					}
					const resourceUrl =
						await this.options.canvas.mediaResourceOfflineCacheManager.resolveResourceUrl(
							{
								path,
								url: fileInfo.src,
								mediaType: this.options.mediaType,
								expiresAt: parseExpiresAt(fileInfo.expires_at),
								resourceVersion: fileInfo.resource_version,
								sourceUpdatedAt: fileInfo.updated_at,
								contentLength: fileInfo.content_length,
							},
							{
								bypassVirtualResource: options?.bypassVirtualResource,
								preferVirtualResource: !options?.bypassVirtualResource,
							},
						)
					if (this.isDestroyed()) return null
					if (!isCurrentExchange()) return SUPERSEDED_RESOURCE_REQUEST
					entry.ossSrc = resourceUrl
					entry.ossSrcFromCachedFallback = false
					return resourceUrl
				}
				this.options.setFailureReason(entry, "load-error")
				return null
			} catch (error) {
				const reason = getFailureReasonFromGetFileInfoError(error)
				if (!isCurrentExchange()) return SUPERSEDED_RESOURCE_REQUEST
				this.options.setFailureReason(entry, reason)
				if (reason === "not-found") {
					this.options.canvas.mediaResourceOfflineCacheManager.removeCachedResource({
						path,
						mediaType: this.options.mediaType,
					})
				}
				return null
			}
		})()

		entry.exchangePromise = promise

		try {
			return await promise
		} finally {
			if (isCurrentExchange()) {
				entry.exchangePromise = null
				entry.exchangeToken = undefined
			}
		}
	}

	private async exchangeAssetOssSrcInternal(
		assetId: string,
		entry: TEntry,
		options?: {
			forceRefresh?: boolean
			priority?: FileUrlRequestPriority
		},
	): Promise<ExchangeResult> {
		if (entry.exchangePromise && !options?.forceRefresh) return entry.exchangePromise

		const exchangeToken = Symbol(`asset-resource-exchange:${assetId}`)
		entry.exchangeToken = exchangeToken
		const isCurrentExchange = () => entry.exchangeToken === exchangeToken
		const promise = (async () => {
			try {
				const info = await this.options.canvas.assetResourceManager.getResource(assetId, {
					forceRefresh: options?.forceRefresh,
					priority: options?.priority,
				})
				if (this.isDestroyed()) return null
				if (!isCurrentExchange()) return SUPERSEDED_RESOURCE_REQUEST
				if (!info.fileUrl) {
					this.options.setFailureReason(entry, "not-found")
					return null
				}
				if (info.mediaType !== this.options.mediaType) {
					this.options.setFailureReason(entry, "load-error")
					return null
				}

				const previousSourceUrl = entry.sourceUrl
				entry.sourceUrl = info.fileUrl
				entry.ossSrc = info.fileUrl
				entry.ossSrcFromCachedFallback = false
				entry.expiresAt = parseExpiresAt(info.expiresAt)
				// Legacy responses have no expiry metadata, so the bounded load-error
				// retry is scoped to the URL just handed to the media element. Newer
				// responses use the expiry safety-window path above; either way, a
				// single URL cannot trigger an unbounded refresh loop.
				if (entry.expiresAt !== null || previousSourceUrl !== info.fileUrl) {
					entry.assetFailureRefreshUsed = false
				}
				entry.source = undefined
				entry.fileName = info.fileName
				entry.resourceVersion = null
				entry.sourceUpdatedAt = null
				entry.contentLength = null
				this.options.setFailureReason(entry, null)
				if (!previousSourceUrl) {
					this.options.onResourceMetadataHydrated?.(entry.resourceIdentity, entry)
				}
				return info.fileUrl
			} catch (error) {
				if (!isCurrentExchange()) return SUPERSEDED_RESOURCE_REQUEST
				this.options.setFailureReason(
					entry,
					error instanceof CanvasAssetResourceError ? error.reason : "load-error",
				)
				return null
			}
		})()

		entry.exchangePromise = promise
		try {
			return await promise
		} finally {
			if (isCurrentExchange()) {
				entry.exchangePromise = null
				entry.exchangeToken = undefined
			}
		}
	}

	public triggerBackgroundMetadataRefresh(
		path: string,
		resourceIdentity: string,
		entry: TEntry,
	): void {
		if (this.isDestroyed()) return
		if (isAssetResourcePath(path)) return
		if (entry.backgroundRefreshPromise) {
			this.options.incrementDiagnostic("backgroundRefreshDedupedCount")
			return
		}
		const now = Date.now()
		if (
			entry.lastBackgroundRefreshAt !== undefined &&
			now - entry.lastBackgroundRefreshAt < BACKGROUND_METADATA_REFRESH_COOLDOWN_MS
		) {
			this.options.incrementDiagnostic("backgroundRefreshSkippedCount")
			return
		}
		entry.lastBackgroundRefreshAt = now

		this.options.incrementDiagnostic("backgroundRefreshQueuedCount")
		entry.backgroundRefreshPromise = this.refreshResourceMetadata(path, resourceIdentity, entry)
			.then(() => undefined)
			.catch(() => undefined)
			.finally(() => {
				entry.backgroundRefreshPromise = null
			})
	}

	public async refreshResourceMetadata(
		path: string,
		resourceIdentity: string,
		entry: TEntry,
	): Promise<void> {
		if (this.isDestroyed()) return
		// Asset URLs have no workspace resource version or offline metadata contract.
		// They are refreshed only after a media load failure through forceRefresh.
		if (isAssetResourcePath(path)) return
		// 前台换链已在进行时不启动低优先级 metadata 探测，避免后台请求成为更新的一代。
		if (entry.exchangePromise) {
			this.options.incrementDiagnostic("backgroundRefreshDedupedCount")
			return
		}
		const methods = this.options.canvas.magicConfigManager.config?.methods
		const getFileInfo = methods?.getFileInfo
		if (!getFileInfo) {
			// A host without metadata support must not consume the full cooldown.
			entry.lastBackgroundRefreshAt = undefined
			return
		}
		const refreshToken = Symbol(`media-metadata-refresh:${path}`)
		entry.exchangeToken = refreshToken
		const isCurrentRefresh = () => entry.exchangeToken === refreshToken
		let refreshSucceeded = false

		try {
			const getFileResourceMeta = methods?.getFileResourceMeta
			if (getFileResourceMeta) {
				this.options.incrementDiagnostic("metadataProbeCount")
				const currentVersion = entry.resourceVersion
				const meta = await getFileResourceMeta(path, {
					useImageProcess: this.options.useImageProcess,
				})
				if (this.isDestroyed() || !isCurrentRefresh()) return

				if (meta.status === "deleted") {
					this.options.incrementDiagnostic("metadataDeletedCount")
					this.options.setFailureReason(entry, "not-found")
					this.options.onResourceDeleted(resourceIdentity, entry)
					refreshSucceeded = true
					return
				}

				if (
					meta.status === "exists" &&
					(!currentVersion ||
						this.isSameResourceVersion(currentVersion, meta.resourceVersion))
				) {
					this.options.incrementDiagnostic("metadataUnchangedCount")
					this.options.setFailureReason(entry, null)
					this.applyResourceMeta(entry, meta)
					if (!currentVersion) {
						this.options.onResourceMetadataHydrated?.(resourceIdentity, entry)
					}
					refreshSucceeded = true
					return
				}

				this.options.incrementDiagnostic(
					meta.status === "exists" ? "metadataChangedCount" : "metadataUnknownCount",
				)
				await this.options.refreshResource(path)
				refreshSucceeded = true
				return
			}

			this.options.incrementDiagnostic("getFileInfoForceRefreshCount")
			const fileInfo = await getFileInfo(path, {
				useImageProcess: this.options.useImageProcess,
				forceRefresh: true,
				priority: "background",
			})
			if (this.isDestroyed() || !isCurrentRefresh()) return
			if (!fileInfo?.src) {
				this.options.setFailureReason(entry, "load-error")
				return
			}

			this.options.setFailureReason(entry, null)
			if (
				!fileInfo.resource_version ||
				!entry.resourceVersion ||
				this.isSameResourceVersion(entry.resourceVersion, fileInfo.resource_version)
			) {
				const hadResourceVersion = !!entry.resourceVersion
				this.applyFileInfoMetadata(entry, fileInfo)
				if (!hadResourceVersion) {
					this.options.onResourceMetadataHydrated?.(resourceIdentity, entry)
				}

				await this.options.canvas.mediaResourceOfflineCacheManager.resolveResourceUrl(
					{
						path,
						url: fileInfo.src,
						mediaType: this.options.mediaType,
						expiresAt: entry.expiresAt,
						resourceVersion: fileInfo.resource_version,
						sourceUpdatedAt: fileInfo.updated_at,
						contentLength: fileInfo.content_length,
					},
					{
						registerOfflineResource: true,
					},
				)
				refreshSucceeded = true
				return
			}
			await this.options.refreshResource(path)
			refreshSucceeded = true
		} catch (error) {
			if (!isCurrentRefresh()) return
			const reason = getFailureReasonFromGetFileInfoError(error)
			this.options.setFailureReason(entry, reason)
			if (reason !== "not-found") return

			this.options.onResourceDeleted(resourceIdentity, entry)
		} finally {
			if (isCurrentRefresh()) {
				if (!refreshSucceeded) entry.lastBackgroundRefreshAt = undefined
				entry.exchangeToken = undefined
			}
		}
	}

	public async getCachedResource(
		path: string,
		entry: TEntry,
	): Promise<CachedMediaResource | null> {
		if (this.isDestroyed()) return null
		if (isAssetResourcePath(path)) return null
		try {
			const offlineCache = this.options.canvas.mediaResourceOfflineCacheManager
			if (offlineCache.shouldBypassVirtualResource()) {
				this.options.incrementDiagnostic("cachedResourceMissCount")
				return null
			}
			const cached = await offlineCache.getCachedResource(path, this.options.mediaType)
			if (this.isDestroyed()) return null
			if (!cached?.url) {
				this.options.incrementDiagnostic("cachedResourceMissCount")
				return null
			}

			this.options.incrementDiagnostic("cachedResourceHitCount")
			this.applyCachedResource(path, entry, cached)
			return cached
		} catch {
			this.options.setFailureReason(entry, "load-error")
			return null
		}
	}

	public applyCachedResource(_path: string, entry: TEntry, cached: CachedMediaResource): void {
		const previousResourceVersion = entry.resourceVersion
		entry.ossSrc = cached.url
		entry.ossSrcFromCachedFallback = true
		entry.sourceUrl = cached.sourceUrl ?? entry.sourceUrl
		entry.expiresAt = cached.expiresAt ?? entry.expiresAt
		entry.resourceVersion = cached.resourceVersion ?? entry.resourceVersion
		entry.sourceUpdatedAt = cached.sourceUpdatedAt ?? entry.sourceUpdatedAt
		entry.contentLength = cached.contentLength ?? entry.contentLength
		if (
			previousResourceVersion &&
			entry.resourceVersion &&
			previousResourceVersion !== entry.resourceVersion
		) {
			this.options.onResourceVersionChanged?.(
				entry.resourceIdentity,
				entry,
				previousResourceVersion,
				entry.resourceVersion,
			)
		}
	}

	public async resolveVirtualResourceFallbackOssSrc(
		path: string,
		ossSrc: string,
		entry: TEntry,
		retryCount: number,
	): Promise<string | null> {
		if (this.isDestroyed()) return null
		if (isAssetResourcePath(path)) {
			// Asset file_url values are signed and are not persisted in the offline
			// cache. A failed media request gets one fresh detail lookup. This also
			// covers audio playback, whose caller always starts at retryCount 0.
			if (retryCount > 0 || entry.assetFailureRefreshUsed) {
				return null
			}
			if (!entry.sourceUrl && !entry.ossSrc) return null
			entry.assetFailureRefreshUsed = true
			entry.ossSrc = null
			entry.ossSrcFromCachedFallback = false
			entry.expiresAt = null
			return this.exchangeOssSrc(path, entry, {
				forceRefresh: true,
				priority: "critical",
			})
		}
		const offlineCache = this.options.canvas.mediaResourceOfflineCacheManager
		if (retryCount > 0 || !offlineCache.isVirtualResourceUrl(ossSrc)) {
			return null
		}

		offlineCache.recordVirtualResourceLoadFailure(ossSrc)
		if (entry.sourceUrl && !isOssExpired(entry.expiresAt)) {
			entry.ossSrc = entry.sourceUrl
			return entry.sourceUrl
		}

		entry.ossSrc = null
		entry.ossSrcFromCachedFallback = false
		entry.expiresAt = null
		return this.exchangeOssSrc(path, entry, {
			forceRefresh: true,
			bypassVirtualResource: true,
			priority: "critical",
		})
	}

	public primeCache(
		path: string,
		entry: TEntry,
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
		if (isAssetResourcePath(path)) return
		// 上传/生成结果是当前资源的新一代；任何尚未完成的旧 exchange 只能返回自身结果，
		// 不能在 finally/resolve 时覆盖刚写入的 URL 与 metadata。
		const previousResourceVersion = entry.resourceVersion
		entry.exchangeToken = undefined
		entry.exchangePromise = null
		this.applyFileInfoMetadata(entry, {
			...fileInfo,
			fileName: fileInfo.fileName ?? "",
		})
		entry.ossSrc = fileInfo.src
		entry.ossSrcFromCachedFallback = false
		if (
			previousResourceVersion &&
			entry.resourceVersion &&
			previousResourceVersion !== entry.resourceVersion
		) {
			this.options.onResourceVersionChanged?.(
				entry.resourceIdentity,
				entry,
				previousResourceVersion,
				entry.resourceVersion,
			)
		}
	}

	private isDestroyed(): boolean {
		if (!this.options.isDestroyed()) return false
		this.options.onStaleRequestDrop?.()
		return true
	}
}
