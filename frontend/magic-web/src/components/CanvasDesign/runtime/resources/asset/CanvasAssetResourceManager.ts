import type { Canvas } from "../../core/Canvas"
import type { CanvasDocument } from "../../document/types"
import type {
	CanvasAssetResourceInfo,
	CanvasAssetMediaType,
	CanvasAssetComplianceStatus,
	FileUrlRequestPriority,
} from "../../../public/magic-types"
import type { ResourceLoadFailureReason } from "../media-common/resourceLoadFailure"
import { collectCanvasAssetIds } from "./assetMediaBinding"
import { isOssExpiring } from "../offline-cache/ossExpiryUtils"
import { assetDetailStore, type AssetDetailStoreChange } from "./AssetDetailStore"
import { reconcileDeletedAssetOnCanvas } from "./canvasAssetDocumentReconcile"

const ASSET_BATCH_GET_SIZE = 200

type AssetRequestOptions = {
	forceRefresh?: boolean
	priority?: FileUrlRequestPriority
}

interface AssetCacheEntry {
	info: CanvasAssetResourceInfo | null
	requestPromise: Promise<CanvasAssetResourceInfo> | null
	requestToken?: symbol
	requestIsForced: boolean
}

function getErrorProperty(error: unknown, key: string): unknown {
	if (!error || typeof error !== "object") return undefined
	return (error as Record<string, unknown>)[key]
}

function getNestedErrorCode(error: unknown): unknown {
	const directCode = getErrorProperty(error, "code")
	if (directCode !== undefined) return directCode
	const errorCode = getErrorProperty(error, "error_code")
	if (errorCode !== undefined) return errorCode
	const response = getErrorProperty(error, "response")
	if (response && typeof response === "object") {
		const responseCode = getErrorProperty(response, "code")
		if (responseCode !== undefined) return responseCode
		const responseErrorCode = getErrorProperty(response, "error_code")
		if (responseErrorCode !== undefined) return responseErrorCode
		const responseData = getErrorProperty(response, "data")
		if (responseData && typeof responseData === "object") {
			return (
				getErrorProperty(responseData, "code") ??
				getErrorProperty(responseData, "error_code")
			)
		}
	}
	return undefined
}

function getAssetResourceFailureReason(error: unknown): ResourceLoadFailureReason {
	const code = getNestedErrorCode(error)
	if (
		code === 48000 ||
		code === "48000" ||
		code === 404 ||
		code === "404" ||
		code === 403 ||
		code === "403"
	) {
		return "not-found"
	}

	const message = error instanceof Error ? error.message.toLowerCase() : ""
	if (message.includes("not found") || message.includes("不存在") || message.includes("无权限")) {
		return "not-found"
	}
	return "load-error"
}

function normalizeMediaType(value: unknown): CanvasAssetMediaType | null {
	return value === "image" || value === "video" || value === "audio" ? value : null
}

function normalizeComplianceStatus(value: unknown): CanvasAssetComplianceStatus | null | undefined {
	if (value === undefined) return undefined
	if (value === "UNVERIFIED") return "UNVERIFIED"
	if (value === "PROCESSING") return "PROCESSING"
	if (value === "PASS" || value === "PASSED") return "PASS"
	if (value === "FAILED") return "FAILED"
	return null
}

function normalizeAssetResourceInfo(
	assetId: string,
	value: CanvasAssetResourceInfo,
): CanvasAssetResourceInfo {
	if (!value || typeof value !== "object" || value.assetId !== assetId) {
		throw new CanvasAssetResourceError(
			`Asset detail response does not match asset id: ${assetId}`,
			"load-error",
		)
	}

	const fileUrl = typeof value.fileUrl === "string" ? value.fileUrl.trim() : ""
	return {
		assetId,
		mediaType: normalizeMediaType(value.mediaType),
		fileUrl: fileUrl || null,
		...(typeof value.expiresAt === "string" && value.expiresAt
			? { expiresAt: value.expiresAt }
			: {}),
		...(typeof value.fileName === "string" && value.fileName
			? { fileName: value.fileName }
			: {}),
		...(value.complianceStatus !== undefined
			? { complianceStatus: normalizeComplianceStatus(value.complianceStatus) }
			: {}),
		...(value.complianceFailedReason !== undefined
			? { complianceFailedReason: value.complianceFailedReason ?? null }
			: {}),
	}
}

/** 资产详情获取失败时携带稳定的 Canvas 资源失败原因。 */
export class CanvasAssetResourceError extends Error {
	readonly reason: ResourceLoadFailureReason

	constructor(message: string, reason: ResourceLoadFailureReason) {
		super(message)
		this.name = "CanvasAssetResourceError"
		this.reason = reason
	}
}

/**
 * Canvas 级资产详情管理器。
 *
 * assetId 是素材服务中的稳定逻辑 ID；asset:// 仅是旧 Canvas 数据的兼容引用。
 * 接口返回的 file_url 可能随权限或签名变化，因此这里仅做当前 Canvas 会话内的
 * 并发去重和短生命周期复用，绝不写入持久化缓存。
 */
export class CanvasAssetResourceManager {
	private readonly entries = new Map<string, AssetCacheEntry>()
	private readonly pendingBatchResources = new Map<
		string,
		Promise<CanvasAssetResourceInfo | undefined>
	>()
	private readonly pendingBatchForced = new Map<string, boolean>()
	private readonly pendingBatchTokens = new Map<string, symbol>()
	private destroyed = false

	private readonly unsubscribeDetailStore: () => void

	constructor(private readonly canvas: Canvas) {
		// A second picker or browser tab can mutate an asset without touching this
		// Canvas instance.  Subscribe to the shared detail store so its local
		// resource entry cannot keep serving the previous signed URL or status.
		this.unsubscribeDetailStore = assetDetailStore.subscribe(this.handleDetailStoreChange)
	}

	/**
	 * 在文档进入 Canvas 前预取所有可由后端批量查询的素材详情。
	 * 预取失败不阻塞文档加载，真正使用资源时仍会走单素材回退链路。
	 */
	public async preloadDocumentAssets(document: CanvasDocument): Promise<void> {
		if (this.destroyed) return
		const assetIds = collectCanvasAssetIds(document)
		if (assetIds.length === 0) return

		try {
			const hasBatchResolver = Boolean(this.getBatchResourceResolver())
			// Canvas reopen is also the point where a remote asset deletion must be
			// observed. Force the authoritative detail query here; normal media reads
			// still reuse the session cache after the document has been reconciled.
			const resources = await this.refreshResources(assetIds, { forceRefresh: true })
			// A successful batch response can omit an ID when the asset was deleted or
			// is no longer available to the current account. Only reconcile numeric IDs
			// covered by that batch path; a failed single-resource/network request must
			// not be mistaken for deletion and silently detach a valid Content.
			const missingBatchIds = assetIds.filter(
				(assetId) =>
					hasBatchResolver &&
					isBatchCompatibleAssetId(assetId) &&
					!resources.has(assetId) &&
					!assetDetailStore.getCached(assetId),
			)
			for (const assetId of missingBatchIds) {
				reconcileDeletedAssetOnCanvas(this.canvas, assetId)
			}
		} catch {
			// 预取属于优化和详情刷新，不应让旧 asset:// 画布无法打开。
		}
	}

	/** 批量刷新当前 Canvas 需要的素材详情，并返回本次实际获取到的资源。 */
	public async refreshResources(
		assetIds: string[],
		options?: Pick<AssetRequestOptions, "forceRefresh">,
	): Promise<Map<string, CanvasAssetResourceInfo>> {
		if (this.destroyed) return new Map()
		const normalizedIds = Array.from(
			new Set(assetIds.map((assetId) => assetId.trim()).filter(Boolean)),
		)
		if (normalizedIds.length === 0) return new Map()

		const batchIds = normalizedIds.filter(isBatchCompatibleAssetId)
		const fallbackIds = normalizedIds.filter((assetId) => !isBatchCompatibleAssetId(assetId))
		const result = new Map<string, CanvasAssetResourceInfo>()

		if (batchIds.length > 0 && this.getBatchResourceResolver()) {
			const batchPromises = this.ensurePendingBatchResources(batchIds, options)
			const batchResults = await Promise.all(
				batchIds.map((assetId) => batchPromises.get(assetId)),
			)
			batchResults.forEach((info, index) => {
				if (info) result.set(batchIds[index], info)
			})
		} else {
			fallbackIds.push(...batchIds)
		}

		if (fallbackIds.length > 0) {
			const fallbackResults = await Promise.all(
				fallbackIds.map(async (assetId) => {
					try {
						return await this.loadSingleResource(assetId, options)
					} catch {
						return undefined
					}
				}),
			)
			fallbackResults.forEach((info, index) => {
				if (info) result.set(fallbackIds[index], info)
			})
		}

		result.forEach((info) => this.storeResourceInfo(info))
		return result
	}

	public async getResource(
		assetId: string,
		options?: AssetRequestOptions,
	): Promise<CanvasAssetResourceInfo> {
		if (this.destroyed) {
			throw new CanvasAssetResourceError("Asset resource manager destroyed", "load-error")
		}
		const normalizedAssetId = assetId.trim()
		if (!normalizedAssetId) {
			throw new CanvasAssetResourceError("Asset id is required", "load-error")
		}

		const existing = this.entries.get(normalizedAssetId)
		if (existing?.requestPromise && (!options?.forceRefresh || existing.requestIsForced)) {
			return existing.requestPromise
		}
		if (
			!options?.forceRefresh &&
			existing?.info &&
			isReusableAssetResourceInfo(existing.info)
		) {
			return existing.info
		}

		const requestToken = Symbol(`asset-resource:${normalizedAssetId}`)
		const entry: AssetCacheEntry = existing ?? {
			info: null,
			requestPromise: null,
			requestIsForced: false,
		}
		entry.requestToken = requestToken
		entry.requestIsForced = options?.forceRefresh === true

		const requestPromise = (async () => {
			try {
				const info = await this.loadResource(normalizedAssetId, options)
				if (!this.destroyed && entry.requestToken === requestToken) {
					entry.info = info
				}
				return info
			} catch (error) {
				if (error instanceof CanvasAssetResourceError) throw error
				throw new CanvasAssetResourceError(
					error instanceof Error ? error.message : "Failed to load asset resource",
					getAssetResourceFailureReason(error),
				)
			}
		})()

		entry.requestPromise = requestPromise
		this.entries.set(normalizedAssetId, entry)

		try {
			return await requestPromise
		} finally {
			if (entry.requestToken === requestToken) {
				entry.requestPromise = null
				entry.requestIsForced = false
				entry.requestToken = undefined
			}
		}
	}

	public getCachedResource(assetId: string): CanvasAssetResourceInfo | undefined {
		const info = this.entries.get(assetId.trim())?.info
		return info ?? undefined
	}

	public invalidate(assetId: string): void {
		const normalizedAssetId = assetId.trim()
		if (!normalizedAssetId) return
		const entry = this.entries.get(normalizedAssetId)
		if (entry) {
			entry.info = null
			// A mutation can invalidate a resource while its old detail request is
			// still pending.  Advance the token and detach that promise so the late
			// response cannot repopulate the Canvas cache or be reused by the next
			// render.
			entry.requestToken = Symbol(`asset-resource-invalidated:${normalizedAssetId}`)
			entry.requestPromise = null
			entry.requestIsForced = false
		}
		this.pendingBatchResources.delete(normalizedAssetId)
		this.pendingBatchForced.delete(normalizedAssetId)
		this.pendingBatchTokens.delete(normalizedAssetId)
	}

	public destroy(): void {
		this.destroyed = true
		this.unsubscribeDetailStore()
		this.entries.clear()
		this.pendingBatchResources.clear()
		this.pendingBatchForced.clear()
		this.pendingBatchTokens.clear()
	}

	private getBatchResourceResolver() {
		return this.canvas.magicConfigManager.config?.methods?.getAssetResourceInfos
	}

	private getSingleResourceResolver() {
		return this.canvas.magicConfigManager.config?.methods?.getAssetResourceInfo
	}

	private async loadResource(
		assetId: string,
		options?: AssetRequestOptions,
	): Promise<CanvasAssetResourceInfo> {
		const batchResolver = this.getBatchResourceResolver()
		if (batchResolver && isBatchCompatibleAssetId(assetId)) {
			const pending = this.ensurePendingBatchResource(assetId, options)
			try {
				const info = await pending
				if (!info) {
					throw new CanvasAssetResourceError(
						`Asset is unavailable: ${assetId}`,
						"not-found",
					)
				}
				return info
			} catch (error) {
				// A failed batch request may be a transient backend/network issue. For a
				// single resource request, retain the existing resolver as a narrow fallback.
				if (error instanceof CanvasAssetResourceError && error.reason === "not-found") {
					throw error
				}
				if (!this.getSingleResourceResolver()) throw error
			}
		}

		return this.loadSingleResource(assetId, options)
	}

	private async loadSingleResource(
		assetId: string,
		options?: AssetRequestOptions,
	): Promise<CanvasAssetResourceInfo> {
		const getAssetResourceInfo = this.getSingleResourceResolver()
		if (!getAssetResourceInfo) {
			throw new CanvasAssetResourceError(
				"Asset resource resolver is not configured",
				"load-error",
			)
		}

		try {
			return normalizeAssetResourceInfo(assetId, await getAssetResourceInfo(assetId, options))
		} catch (error) {
			if (error instanceof CanvasAssetResourceError) throw error
			throw new CanvasAssetResourceError(
				error instanceof Error ? error.message : "Failed to load asset resource",
				getAssetResourceFailureReason(error),
			)
		}
	}

	private ensurePendingBatchResource(
		assetId: string,
		options?: Pick<AssetRequestOptions, "forceRefresh">,
	): Promise<CanvasAssetResourceInfo | undefined> {
		return this.ensurePendingBatchResources([assetId], options).get(assetId) as Promise<
			CanvasAssetResourceInfo | undefined
		>
	}

	private ensurePendingBatchResources(
		assetIds: string[],
		options?: Pick<AssetRequestOptions, "forceRefresh">,
	): Map<string, Promise<CanvasAssetResourceInfo | undefined>> {
		const batchResolver = this.getBatchResourceResolver()
		if (!batchResolver) {
			throw new Error("Asset batch resource resolver is not configured")
		}

		const pendingIds = Array.from(new Set(assetIds)).filter((assetId) => {
			if (!this.pendingBatchResources.has(assetId)) return true
			return options?.forceRefresh === true && !this.pendingBatchForced.get(assetId)
		})
		if (pendingIds.length > 0) {
			const batchToken = Symbol("asset-resource-batch")
			const batchPromise = (async () => {
				const resources = new Map<string, CanvasAssetResourceInfo>()
				for (let index = 0; index < pendingIds.length; index += ASSET_BATCH_GET_SIZE) {
					const chunk = pendingIds.slice(index, index + ASSET_BATCH_GET_SIZE)
					const values = options?.forceRefresh
						? await batchResolver(chunk, options)
						: await batchResolver(chunk)
					const returnedIds = new Set<string>()
					values.forEach((value) => {
						if (!pendingIds.includes(value.assetId)) return
						// A forced refresh may supersede an older non-forced batch.  Do not
						// let that older response overwrite the newer URL in the cache.
						if (this.pendingBatchTokens.get(value.assetId) !== batchToken) return
						const normalized = normalizeAssetResourceInfo(value.assetId, value)
						returnedIds.add(normalized.assetId)
						resources.set(normalized.assetId, normalized)
						this.storeResourceInfo(normalized)
					})
					for (const assetId of chunk) {
						if (
							returnedIds.has(assetId) ||
							this.pendingBatchTokens.get(assetId) !== batchToken
						)
							continue
						const entry = this.entries.get(assetId)
						if (entry) entry.info = null
					}
				}
				return resources
			})()

			pendingIds.forEach((assetId) => {
				const resultPromise = batchPromise.then((resources) => resources.get(assetId))
				this.pendingBatchResources.set(assetId, resultPromise)
				this.pendingBatchForced.set(assetId, options?.forceRefresh === true)
				this.pendingBatchTokens.set(assetId, batchToken)
				resultPromise.then(
					() => this.clearPendingBatchResource(assetId, resultPromise),
					() => this.clearPendingBatchResource(assetId, resultPromise),
				)
			})
		}

		return new Map(
			assetIds.map((assetId) => [
				assetId,
				this.pendingBatchResources.get(assetId) as Promise<
					CanvasAssetResourceInfo | undefined
				>,
			]),
		)
	}

	private clearPendingBatchResource(
		assetId: string,
		request: Promise<CanvasAssetResourceInfo | undefined>,
	): void {
		if (this.pendingBatchResources.get(assetId) === request) {
			this.pendingBatchResources.delete(assetId)
			this.pendingBatchForced.delete(assetId)
			this.pendingBatchTokens.delete(assetId)
		}
	}

	private storeResourceInfo(info: CanvasAssetResourceInfo): void {
		if (this.destroyed) return
		const entry = this.entries.get(info.assetId) ?? {
			info: null,
			requestPromise: null,
			requestIsForced: false,
		}
		entry.info = info
		this.entries.set(info.assetId, entry)
	}

	private readonly handleDetailStoreChange = (change: AssetDetailStoreChange): void => {
		if (!change.assetId) {
			// A full clear can be emitted while auth/org scope is transitioning; do
			// not compare against the new scope or an old signed URL could survive
			// logout in an existing Canvas instance.
			this.clearLocalCache()
			this.canvas.refreshNameLabelIcons?.()
			this.canvas.refreshMediaComplianceFailedTags?.()
			return
		}
		// AssetDetailStore keeps only the active account scope.  Do not compare the
		// event with a separately-read global scope here: during logout/org changes
		// that value can move first, and retaining an old signed URL would be unsafe.
		const hadCachedResource = this.entries.has(change.assetId)
		this.invalidate(change.assetId)
		if (!hadCachedResource || this.destroyed) {
			this.canvas.refreshNameLabelIcons?.()
			return
		}
		// An upsert already seeded the authoritative detail cache, so a normal read
		// immediately rehydrates the Canvas entry.  An invalidation has no payload
		// and must force the detail endpoint.  Both paths notify already-rendered
		// decorators instead of waiting for a later media access to observe the edit.
		void this.getResource(change.assetId, { forceRefresh: change.kind === "invalidate" })
			.then(() => {
				this.canvas.refreshNameLabelIcons?.()
				this.canvas.refreshMediaComplianceFailedTags?.()
			})
			.catch(() => undefined)
	}

	private clearLocalCache(): void {
		this.entries.clear()
		this.pendingBatchResources.clear()
		this.pendingBatchForced.clear()
		this.pendingBatchTokens.clear()
	}
}

function isBatchCompatibleAssetId(assetId: string): boolean {
	return /^\d{1,64}$/.test(assetId)
}

function isReusableAssetResourceInfo(info: CanvasAssetResourceInfo): boolean {
	return Boolean(info.fileUrl && info.mediaType) && !isOssExpiring(info.expiresAt)
}
