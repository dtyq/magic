import { AssetsApi } from "@/apis"
import { normalizeAssetItem, type AssetItem } from "@/apis/modules/assets"
import { getSharedMediaResourceScope } from "@/pages/superMagic/services/sharedMediaResourceScope"
import { OSS_URL_EXPIRY_SAFETY_WINDOW_MS, parseExpiresAt } from "../offline-cache/ossExpiryUtils"

const ASSET_BATCH_GET_SIZE = 200

export interface AssetDetailRequestOptions {
	/** Bypass the completed detail cache and obtain a new file URL. */
	forceRefresh?: boolean
}

interface AssetDetailEntry {
	asset: AssetItem
	fallbackRefreshUsed: boolean
}

export interface AssetDetailStoreChange {
	scope: string
	assetId?: string
	kind: "upsert" | "invalidate" | "clear"
}

/**
 * Shared, page-session asset detail cache.
 *
 * The picker, Canvas resource manager and import flow all consume the same
 * signed URL-producing detail endpoint.  Keeping the cache here prevents a
 * list result followed by an import from immediately issuing another detail
 * request, while still allowing callers to force a new URL after a load error.
 */
export class AssetDetailStore {
	private readonly entries = new Map<string, AssetDetailEntry>()
	private readonly pending = new Map<string, Promise<AssetItem | undefined>>()
	private readonly pendingForced = new Map<string, boolean>()
	private readonly requestTokens = new Map<string, symbol>()
	private readonly fallbackRefreshUsedIds = new Set<string>()
	private readonly listeners = new Set<(change: AssetDetailStoreChange) => void>()
	private activeScope = getSharedMediaResourceScope()

	public subscribe(listener: (change: AssetDetailStoreChange) => void): () => void {
		this.listeners.add(listener)
		return () => this.listeners.delete(listener)
	}

	public getCached(
		assetId: string,
		scope = getSharedMediaResourceScope(),
	): AssetItem | undefined {
		this.ensureScope(scope)
		const id = normalizeAssetId(assetId)
		if (!id) return undefined
		return this.entries.get(id)?.asset
	}

	public get(
		assetId: string,
		options?: AssetDetailRequestOptions,
		scope = getSharedMediaResourceScope(),
	): Promise<AssetItem> {
		return this.getInternal(assetId, options, scope, isReusableAssetDetail)
	}

	/**
	 * Read an asset detail that is safe to use as an existing-asset compliance
	 * source. Library list rows may contain a usable preview URL while omitting
	 * file_key, so the ordinary resource cache predicate is intentionally not
	 * sufficient for this mutation path.
	 */
	public async getWithFileKey(
		assetId: string,
		options?: AssetDetailRequestOptions,
		scope = getSharedMediaResourceScope(),
	): Promise<AssetItem> {
		const asset = await this.getInternal(
			assetId,
			options,
			scope,
			isReusableAssetDetailWithFileKey,
		)
		if (asset.file_key?.trim()) return asset

		// A Canvas preload may have an in-flight batch response that intentionally
		// omits file_key. Do one single-detail retry rather than treating that
		// shared preview response as sufficient for the compliance mutation.
		const refreshed = await this.getInternal(
			assetId,
			{ ...options, forceRefresh: true },
			scope,
			isReusableAssetDetailWithFileKey,
		)
		if (!refreshed.file_key?.trim()) {
			throw new Error(`Asset file key is unavailable: ${assetId.trim()}`)
		}
		return refreshed
	}

	private getInternal(
		assetId: string,
		options: AssetDetailRequestOptions | undefined,
		scope: string,
		isReusable: (asset: AssetItem) => boolean,
	): Promise<AssetItem> {
		this.ensureScope(scope)
		const id = normalizeAssetId(assetId)
		if (!id) return Promise.reject(new Error("Asset id is required"))

		const pending = this.pending.get(id)
		if (pending && (!options?.forceRefresh || this.pendingForced.get(id) === true)) {
			return pending.then((asset) => {
				if (!asset) throw new Error(`Asset is unavailable: ${id}`)
				return asset
			})
		}

		const cached = this.entries.get(id)?.asset
		if (!options?.forceRefresh && cached && isReusable(cached)) {
			return Promise.resolve(cached)
		}

		const requestToken = Symbol(`asset-detail:${id}`)
		const request = AssetsApi.getAsset(id).then((asset) => {
			const normalized = normalizeAssetItem({
				...asset,
				asset_id: normalizeAssetId(asset.asset_id),
			})
			// A forced refresh may supersede an older request. Only the newest
			// response may update the shared cache, while each caller still gets
			// the response it explicitly requested.
			if (this.requestTokens.get(id) === requestToken) this.writeEntry(normalized)
			return normalized
		})
		this.pending.set(id, request)
		this.pendingForced.set(id, options?.forceRefresh === true)
		this.requestTokens.set(id, requestToken)
		return request.finally(() => {
			if (this.pending.get(id) === request) {
				this.pending.delete(id)
				this.pendingForced.delete(id)
				this.requestTokens.delete(id)
			}
		})
	}

	/** Fetch many details once, sharing overlapping requests by asset ID. */
	public async batchGet(
		assetIds: string[],
		options?: AssetDetailRequestOptions,
		scope = getSharedMediaResourceScope(),
	): Promise<AssetItem[]> {
		this.ensureScope(scope)
		const ids = Array.from(new Set(assetIds.map(normalizeAssetId).filter(Boolean)))
		if (ids.length === 0) return []

		const result = new Map<string, AssetItem>()
		const requestPromises: Array<Promise<AssetItem | undefined>> = []
		const missingIds: string[] = []
		for (const id of ids) {
			const cached = this.entries.get(id)?.asset
			const pending = this.pending.get(id)
			if (!options?.forceRefresh && cached && isReusableAssetDetail(cached)) {
				result.set(id, cached)
				continue
			}
			if (pending && (!options?.forceRefresh || this.pendingForced.get(id) === true)) {
				requestPromises.push(pending)
				continue
			}
			missingIds.push(id)
		}

		// The batch endpoint accepts numeric snowflake IDs only.  Keep the shared
		// detail API useful for legacy/fixture IDs by falling back to single-item
		// detail requests instead of sending an invalid batch payload.
		const batchIds = missingIds.filter(isBatchCompatibleAssetId)
		const singleIds = missingIds.filter((id) => !isBatchCompatibleAssetId(id))
		for (const id of singleIds) {
			requestPromises.push(this.get(id, options, scope).catch(() => undefined))
		}

		for (let index = 0; index < batchIds.length; index += ASSET_BATCH_GET_SIZE) {
			const chunk = batchIds.slice(index, index + ASSET_BATCH_GET_SIZE)
			const requestToken = Symbol("asset-detail-batch")
			const request = AssetsApi.batchGetAssets({ asset_ids: chunk }).then((assets) => {
				const normalizedAssets = assets.map((asset) =>
					normalizeAssetItem({ ...asset, asset_id: normalizeAssetId(asset.asset_id) }),
				)
				const returnedIds = new Set(normalizedAssets.map((asset) => asset.asset_id))
				for (const asset of normalizedAssets) {
					if (this.requestTokens.get(asset.asset_id) === requestToken) {
						this.writeEntry(asset)
					}
				}
				for (const id of chunk) {
					if (!returnedIds.has(id) && this.requestTokens.get(id) === requestToken) {
						this.entries.delete(id)
					}
				}
				return chunk.map((id) => normalizedAssets.find((asset) => asset.asset_id === id))
			})
			for (const id of chunk) {
				const idPromise = request.then((assets) =>
					assets.find((asset) => asset?.asset_id === id),
				)
				this.pending.set(id, idPromise)
				this.pendingForced.set(id, options?.forceRefresh === true)
				this.requestTokens.set(id, requestToken)
				requestPromises.push(idPromise)
				const clearPending = () => {
					if (this.pending.get(id) === idPromise) {
						this.pending.delete(id)
						this.pendingForced.delete(id)
						this.requestTokens.delete(id)
					}
				}
				idPromise.then(clearPending, clearPending)
			}
		}

		const resolved = await Promise.all(requestPromises)
		resolved.forEach((asset) => {
			if (asset) result.set(asset.asset_id, asset)
		})
		return ids.flatMap((id) => {
			const asset = result.get(id) ?? this.entries.get(id)?.asset
			return asset ? [asset] : []
		})
	}

	/** Seed shared Canvas/detail consumers with a mutation response. */
	public upsert(asset: AssetItem, scope = getSharedMediaResourceScope()): AssetItem {
		this.ensureScope(scope)
		const normalized = this.writeEntry(asset)
		if (normalized.asset_id.trim()) {
			this.emit({ scope, assetId: normalized.asset_id, kind: "upsert" })
		}
		return normalized
	}

	private writeEntry(asset: AssetItem): AssetItem {
		const assetId = normalizeAssetId(asset.asset_id)
		if (!assetId) return asset
		// A mutation/list response is newer than any detail request that was
		// already in flight for the same ID.  Drop that request from the shared
		// cache so its late response cannot overwrite the just-written fields or
		// be reused by the next Canvas/media consumer.
		this.supersedePending(assetId)
		const previous = this.entries.get(assetId)?.asset
		const normalizedInput = { ...asset, asset_id: assetId }
		// Mutation endpoints may return a compact row. Preserve fields already
		// resolved by a detail request when a property is omitted, while allowing
		// explicit null/empty updates to replace the previous value.
		const definedInput = Object.fromEntries(
			Object.entries(normalizedInput).filter(([, value]) => value !== undefined),
		) as Partial<AssetItem> & { asset_id: string }
		const normalized = normalizeAssetItem({
			...(previous ?? {}),
			...definedInput,
			owner: normalizedInput.owner ?? previous?.owner,
			tags: normalizedInput.tags ?? previous?.tags ?? [],
		} as AssetItem)
		const previousEntry = this.entries.get(normalized.asset_id)
		const hasExpiry = hasAssetDetailExpiry(normalized)
		const urlChanged = previousEntry?.asset.file_url !== normalized.file_url
		if (hasExpiry || urlChanged) this.fallbackRefreshUsedIds.delete(normalized.asset_id)
		this.entries.set(normalized.asset_id, {
			asset: normalized,
			fallbackRefreshUsed:
				hasExpiry || urlChanged
					? false
					: (previousEntry?.fallbackRefreshUsed ??
						this.fallbackRefreshUsedIds.has(normalized.asset_id)),
		})
		return normalized
	}

	/**
	 * Seed details received from a library list without racing a newer detail
	 * request that is already in flight for the same asset.
	 */
	public seedFromList(asset: AssetItem, scope = getSharedMediaResourceScope()): AssetItem {
		this.ensureScope(scope)
		const id = normalizeAssetId(asset.asset_id)
		if (id && this.pending.has(id)) return this.entries.get(id)?.asset ?? asset
		const previous = id ? this.entries.get(id)?.asset : undefined
		const normalized = this.writeEntry(asset)
		if (previous && hasAssetDetailChanged(previous, normalized)) {
			// A list refresh can observe an edit made outside this tab. Notify Canvas
			// consumers even though this was not a local mutation API call.
			this.emit({ scope, assetId: normalized.asset_id, kind: "upsert" })
		}
		return normalized
	}

	/**
	 * Request a replacement URL at most once for the currently cached URL when
	 * the backend does not expose `expires_at`.  Future responses that include
	 * the field are handled by the normal safety-window check above.
	 */
	public refreshAfterLoadFailure(
		assetId: string,
		scope = getSharedMediaResourceScope(),
	): Promise<AssetItem> {
		this.ensureScope(scope)
		const id = normalizeAssetId(assetId)
		if (!id) return Promise.reject(new Error("Asset id is required"))
		const entry = this.entries.get(id)
		if (entry?.fallbackRefreshUsed || this.fallbackRefreshUsedIds.has(id)) {
			return this.get(id, undefined, scope)
		}
		this.fallbackRefreshUsedIds.add(id)
		if (entry) {
			entry.fallbackRefreshUsed = true
		}
		return this.get(id, { forceRefresh: true }, scope).then((asset) => {
			const refreshed = this.entries.get(id)
			if (refreshed && hasAssetDetailExpiry(refreshed.asset)) {
				refreshed.fallbackRefreshUsed = false
				this.fallbackRefreshUsedIds.delete(id)
			} else if (refreshed) {
				refreshed.fallbackRefreshUsed = true
			}
			return asset
		})
	}

	public invalidate(assetId?: string, scope = getSharedMediaResourceScope()): void {
		this.ensureScope(scope)
		if (assetId === undefined) {
			this.entries.clear()
			this.pending.clear()
			this.pendingForced.clear()
			this.requestTokens.clear()
			this.fallbackRefreshUsedIds.clear()
			this.emit({ scope, kind: "invalidate" })
			return
		}
		const id = normalizeAssetId(assetId)
		if (!id) return
		this.entries.delete(id)
		this.supersedePending(id)
		this.fallbackRefreshUsedIds.delete(id)
		this.emit({ scope, assetId: id, kind: "invalidate" })
	}

	public clearAll(): void {
		const scope = this.activeScope
		this.entries.clear()
		this.pending.clear()
		this.pendingForced.clear()
		this.requestTokens.clear()
		this.fallbackRefreshUsedIds.clear()
		this.emit({ scope, kind: "clear" })
	}

	private ensureScope(scope: string): void {
		if (scope === this.activeScope) return
		this.activeScope = scope
		this.clearAll()
	}

	private supersedePending(assetId: string): void {
		this.pending.delete(assetId)
		this.pendingForced.delete(assetId)
		this.requestTokens.delete(assetId)
	}

	private emit(change: AssetDetailStoreChange): void {
		this.listeners.forEach((listener) => listener(change))
	}
}

function normalizeAssetId(assetId: string): string {
	return assetId.trim()
}

function isBatchCompatibleAssetId(assetId: string): boolean {
	return /^\d{1,64}$/.test(assetId)
}

function isAssetDetailExpiring(asset: AssetItem): boolean {
	if (!asset.file_url || !asset.expires_at) return false
	const expiresAt = parseExpiresAt(asset.expires_at)
	return expiresAt !== null && expiresAt - Date.now() <= OSS_URL_EXPIRY_SAFETY_WINDOW_MS
}

function hasAssetDetailExpiry(asset: AssetItem): boolean {
	return Boolean(asset.file_url && parseExpiresAt(asset.expires_at ?? undefined) !== null)
}

function hasAssetDetailChanged(previous: AssetItem, next: AssetItem): boolean {
	if (
		previous.name !== next.name ||
		previous.description !== next.description ||
		previous.file_url !== next.file_url ||
		previous.expires_at !== next.expires_at ||
		previous.thumbnail_url !== next.thumbnail_url ||
		previous.file_key !== next.file_key ||
		previous.project_id !== next.project_id ||
		previous.project_file_path !== next.project_file_path ||
		previous.asset_media_type !== next.asset_media_type ||
		previous.compliance_status !== next.compliance_status ||
		previous.compliance_failed_reason !== next.compliance_failed_reason ||
		previous.owner_uid !== next.owner_uid ||
		previous.source !== next.source
	)
		return true

	if (previous.owner?.id !== next.owner?.id || previous.owner?.name !== next.owner?.name)
		return true
	const previousTags = previous.tags ?? []
	const nextTags = next.tags ?? []
	if (previousTags.length !== nextTags.length) return true
	return previousTags.some(
		(tag, index) => tag.id !== nextTags[index]?.id || tag.name !== nextTags[index]?.name,
	)
}

function isReusableAssetDetail(asset: AssetItem): boolean {
	// List responses can omit the media type or signed URL on legacy/permission
	// paths.  Keep that metadata in memory for the UI, but require a complete
	// resource before short-circuiting the next detail request.
	return Boolean(asset.file_url && asset.asset_media_type) && !isAssetDetailExpiring(asset)
}

function isReusableAssetDetailWithFileKey(asset: AssetItem): boolean {
	// Compliance submits the opaque key itself; a preview URL or media type is
	// not required for this path and may be intentionally omitted by list APIs.
	return Boolean(asset.file_key?.trim())
}

export const assetDetailStore = new AssetDetailStore()
