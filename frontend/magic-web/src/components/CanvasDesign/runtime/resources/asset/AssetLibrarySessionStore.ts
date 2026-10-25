import {
	AssetsApi,
	type AssetComplianceStatus,
	type AssetItem,
	type AssetMediaType,
	type AssetOwnerItem,
	type AssetScope,
} from "@/apis"
import { getSharedMediaResourceScope } from "@/pages/superMagic/services/sharedMediaResourceScope"
import { assetDetailStore } from "./AssetDetailStore"

export type AssetLibraryScope = Extract<AssetScope, "ALL" | "PERSONAL" | "TEAM">

export interface AssetLibraryQuery {
	mediaTypes: readonly AssetMediaType[]
	scope: AssetLibraryScope
	keyword: string
	ownerUid: string
	requiresCompliance: boolean
	page?: number
	pageSize?: number
}

export interface AssetLibraryQuerySnapshot {
	assets: AssetItem[]
	loading: boolean
	refreshing: boolean
	error: unknown | null
	updatedAt: number | null
	/** The previous list remains visible while an external mutation is revalidated. */
	stale: boolean
	/** Monotonic value used by active hooks to observe invalidation without dropping data. */
	revision: number
}

interface NormalizedAssetLibraryQuery extends AssetLibraryQuery {
	mediaTypes: AssetMediaType[]
	page: number
	pageSize: number
}

interface AssetQueryCacheEntry {
	scope: string
	query: NormalizedAssetLibraryQuery
	snapshot: AssetLibraryQuerySnapshot
	pending: Promise<AssetItem[]> | null
	requestGeneration: number
}

interface OwnersCacheEntry {
	scope: string
	data: AssetOwnerItem[] | null
	pending: Promise<AssetOwnerItem[]> | null
}

interface AssetAgreementCache {
	signed: boolean | null
	pending: Promise<boolean> | null
}

export interface AssetMediaDimensions {
	width: number
	height: number
}

function isPositiveDimension(value: number): boolean {
	return Number.isFinite(value) && value > 0
}

const DEFAULT_MEDIA_TYPES: AssetMediaType[] = ["IMAGE"]
const DEFAULT_PAGE = 1
const DEFAULT_PAGE_SIZE = 200
const EXTERNAL_REFRESH_COOLDOWN_MS = 30_000
const IMAGE_AND_VIDEO_MEDIA_TYPES: readonly AssetMediaType[] = ["IMAGE", "VIDEO"]

const EMPTY_QUERY_SNAPSHOT: AssetLibraryQuerySnapshot = {
	assets: [],
	loading: false,
	refreshing: false,
	error: null,
	updatedAt: null,
	stale: false,
	revision: 0,
}

export function normalizeAssetLibraryQuery(query: AssetLibraryQuery): NormalizedAssetLibraryQuery {
	const mediaTypes = Array.from(new Set(query.mediaTypes))
	return {
		mediaTypes: mediaTypes.length > 0 ? mediaTypes : [...DEFAULT_MEDIA_TYPES],
		scope: query.scope,
		keyword: query.keyword.trim(),
		ownerUid: query.ownerUid.trim(),
		requiresCompliance: query.requiresCompliance,
		page: query.page ?? DEFAULT_PAGE,
		pageSize: query.pageSize ?? DEFAULT_PAGE_SIZE,
	}
}

function getQueryKey(query: NormalizedAssetLibraryQuery, scope: string): string {
	return JSON.stringify([
		scope,
		query.scope,
		[...query.mediaTypes].sort(),
		query.keyword,
		query.ownerUid,
		query.requiresCompliance,
		query.page,
		query.pageSize,
	])
}

/**
 * Page-session cache for the asset picker.
 *
 * Signed file URLs are intentionally kept only in this in-memory cache. The
 * Canvas import path still refreshes the selected asset before downloading it.
 */
export class AssetLibrarySessionStore {
	private readonly assetQueryCache = new Map<string, AssetQueryCacheEntry>()
	private readonly ownersCache = new Map<string, OwnersCacheEntry>()
	private readonly listeners = new Set<() => void>()
	private readonly pendingMutationBroadcasts = new Set<string>()
	private readonly mutationSource =
		typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
			? crypto.randomUUID()
			: Math.random().toString(36).slice(2)
	private readonly mutationChannel: BroadcastChannel | null = this.createMutationChannel()
	private agreementCache: AssetAgreementCache = { signed: null, pending: null }
	private readonly mediaDimensions = new Map<string, AssetMediaDimensions>()
	private activeScope = getSharedMediaResourceScope()
	private lastExternalRefreshAt = 0

	constructor() {
		if (typeof window === "undefined") return
		window.addEventListener("focus", this.handleExternalRefresh)
		document.addEventListener("visibilitychange", this.handleExternalRefresh)
		if (this.mutationChannel) {
			this.mutationChannel.addEventListener("message", this.handleMutationMessage)
		}
	}

	public getQueryKey(query: AssetLibraryQuery, scope = getSharedMediaResourceScope()): string {
		return getQueryKey(normalizeAssetLibraryQuery(query), scope)
	}

	public getSnapshotByKey(
		queryKey: string,
		scope = getSharedMediaResourceScope(),
	): AssetLibraryQuerySnapshot {
		this.ensureScope(scope)
		return this.assetQueryCache.get(queryKey)?.snapshot ?? EMPTY_QUERY_SNAPSHOT
	}

	public getCachedAssets(
		query: AssetLibraryQuery,
		scope = getSharedMediaResourceScope(),
	): AssetItem[] | undefined {
		this.ensureScope(scope)
		const queryKey = this.getQueryKey(query, scope)
		const entry = this.assetQueryCache.get(queryKey)
		return entry?.snapshot.updatedAt === null ? undefined : entry?.snapshot.assets
	}

	public queryAssets(
		query: AssetLibraryQuery,
		scope = getSharedMediaResourceScope(),
	): Promise<AssetItem[]> {
		return this.loadAssets(query, scope, false)
	}

	public refreshAssets(
		query: AssetLibraryQuery,
		scope = getSharedMediaResourceScope(),
	): Promise<AssetItem[]> {
		return this.loadAssets(query, scope, true)
	}

	public getOwners(scope = getSharedMediaResourceScope()): Promise<AssetOwnerItem[]> {
		return this.loadOwners(scope, false)
	}

	public getCachedOwners(scope = getSharedMediaResourceScope()): AssetOwnerItem[] | undefined {
		this.ensureScope(scope)
		return this.ownersCache.get(scope)?.data ?? undefined
	}

	public refreshOwners(scope = getSharedMediaResourceScope()): Promise<AssetOwnerItem[]> {
		return this.loadOwners(scope, true)
	}

	/** 当前会话里已经确认的承诺书签署状态；未知时返回 undefined。 */
	public getCachedAssetAgreementSigned(
		scope = getSharedMediaResourceScope(),
	): boolean | undefined {
		this.ensureScope(scope)
		return this.agreementCache.signed ?? undefined
	}

	/**
	 * 查询承诺书是否已签署。同一会话内合并进行中的请求，已知结果直接复用。
	 * 请求失败不写入缓存，下次调用会重新查询。
	 */
	public getAssetAgreementSigned(scope = getSharedMediaResourceScope()): Promise<boolean> {
		this.ensureScope(scope)
		if (this.agreementCache.pending) return this.agreementCache.pending
		if (this.agreementCache.signed !== null) return Promise.resolve(this.agreementCache.signed)

		const request = AssetsApi.getAssetAgreementStatus?.()
		if (!request) return Promise.reject(new Error("Asset agreement status is unavailable"))

		const pending = request.then(
			(status) => {
				if (this.agreementCache.pending !== pending) return status.signed
				this.agreementCache.signed = status.signed
				this.agreementCache.pending = null
				this.notify()
				return status.signed
			},
			(error) => {
				if (this.agreementCache.pending === pending) this.agreementCache.pending = null
				throw error
			},
		)
		this.agreementCache.pending = pending
		return pending
	}

	/** 记住素材预览或导入时量到的原始宽高，供稍后创建画布元素复用。 */
	public rememberAssetMediaDimensions(
		assetId: string,
		dimensions: AssetMediaDimensions,
		scope = getSharedMediaResourceScope(),
	): void {
		this.ensureScope(scope)
		const normalizedAssetId = assetId.trim()
		if (!normalizedAssetId) return
		if (!isPositiveDimension(dimensions.width) || !isPositiveDimension(dimensions.height))
			return
		this.mediaDimensions.set(normalizedAssetId, {
			width: dimensions.width,
			height: dimensions.height,
		})
	}

	public getRememberedAssetMediaDimensions(
		assetId: string,
		scope = getSharedMediaResourceScope(),
	): AssetMediaDimensions | undefined {
		this.ensureScope(scope)
		return this.mediaDimensions.get(assetId.trim())
	}

	/** 用户在当前会话完成签署后，后续认证入口不再重复查询。 */
	public markAssetAgreementSigned(scope = getSharedMediaResourceScope()): void {
		this.ensureScope(scope)
		this.agreementCache = { signed: true, pending: null }
		this.notify()
	}

	/**
	 * Mark list snapshots stale without throwing away the last usable result.
	 *
	 * A mutation can finish while the picker is open.  Deleting the cache in that
	 * situation leaves the hook's query dependencies unchanged, so no follow-up
	 * request is issued and the modal can remain empty forever.  Keeping the
	 * snapshot and bumping a revision lets active subscribers refresh naturally;
	 * callers that are not mounted will refresh on their next query.
	 */
	public invalidateCurrentScope(scope = getSharedMediaResourceScope()): void {
		this.ensureScope(scope)
		this.markScopeStale(scope)
		this.scheduleMutationBroadcast(scope)
	}

	/** Invalidate one asset's detail and all visible list queries after an edit. */
	public invalidateAsset(assetId: string, scope = getSharedMediaResourceScope()): void {
		this.ensureScope(scope)
		const normalizedAssetId = assetId.trim()
		if (!normalizedAssetId) {
			this.markScopeStale(scope)
			this.scheduleMutationBroadcast(scope)
			return
		}
		assetDetailStore.invalidate(normalizedAssetId, scope)
		this.markScopeStale(scope)
		this.scheduleMutationBroadcast(scope)
	}

	/** Apply a mutation response to visible snapshots before revalidation settles. */
	public upsertAsset(asset: AssetItem, scope = getSharedMediaResourceScope()): void {
		this.ensureScope(scope)
		const normalizedAsset = assetDetailStore.upsert(asset, scope)
		for (const entry of this.assetQueryCache.values()) {
			if (entry.scope !== scope) continue
			const currentIndex = entry.snapshot.assets.findIndex(
				(item) => item.asset_id === normalizedAsset.asset_id,
			)
			const matches = this.matchesQuery(normalizedAsset, entry.query)
			if (matches && currentIndex === -1) {
				entry.snapshot = {
					...entry.snapshot,
					assets: [normalizedAsset, ...entry.snapshot.assets],
				}
			} else if (matches && currentIndex !== -1) {
				const assets = [...entry.snapshot.assets]
				assets[currentIndex] = normalizedAsset
				entry.snapshot = {
					...entry.snapshot,
					assets,
				}
			} else if (!matches && currentIndex !== -1) {
				entry.snapshot = {
					...entry.snapshot,
					assets: entry.snapshot.assets.filter(
						(item) => item.asset_id !== normalizedAsset.asset_id,
					),
				}
			}
		}
		this.markScopeStale(scope)
		this.scheduleMutationBroadcast(scope)
	}

	/** Remove an asset from visible snapshots while the server refresh completes. */
	public removeAsset(assetId: string, scope = getSharedMediaResourceScope()): void {
		this.ensureScope(scope)
		const normalizedAssetId = assetId.trim()
		if (!normalizedAssetId) return
		assetDetailStore.invalidate(normalizedAssetId, scope)
		for (const entry of this.assetQueryCache.values()) {
			if (entry.scope !== scope) continue
			const assets = entry.snapshot.assets.filter(
				(asset) => asset.asset_id !== normalizedAssetId,
			)
			if (assets.length === entry.snapshot.assets.length) continue
			entry.snapshot = {
				...entry.snapshot,
				assets,
			}
		}
		this.markScopeStale(scope)
		this.scheduleMutationBroadcast(scope)
	}

	/**
	 * Apply a completed compliance result without reloading unrelated list queries.
	 * PASS-filtered queries still revalidate because a newly passed asset may need
	 * to enter a snapshot that did not previously contain it.
	 */
	public applyAssetComplianceState(
		assetId: string,
		status: AssetComplianceStatus,
		failedReason: string | null,
		scope = getSharedMediaResourceScope(),
	): void {
		this.ensureScope(scope)
		const normalizedAssetId = assetId.trim()
		if (!normalizedAssetId) return

		const cachedAsset = assetDetailStore.getCached(normalizedAssetId, scope)
		if (cachedAsset) {
			assetDetailStore.upsert(
				{
					...cachedAsset,
					compliance_status: status,
					compliance_failed_reason: failedReason,
				},
				scope,
			)
		}

		const filteredEntries: AssetQueryCacheEntry[] = []
		let changed = false
		for (const entry of this.assetQueryCache.values()) {
			if (entry.scope !== scope) continue
			if (entry.query.requiresCompliance) {
				filteredEntries.push(entry)
				continue
			}
			const index = entry.snapshot.assets.findIndex(
				(asset) => asset.asset_id === normalizedAssetId,
			)
			if (index === -1) continue
			const assets = [...entry.snapshot.assets]
			assets[index] = {
				...assets[index],
				compliance_status: status,
				compliance_failed_reason: failedReason,
			}
			entry.snapshot = { ...entry.snapshot, assets }
			changed = true
		}

		let filteredChanged = false
		for (const entry of filteredEntries) {
			entry.snapshot = {
				...entry.snapshot,
				stale: true,
				revision: entry.snapshot.revision + 1,
			}
			filteredChanged = true
		}
		if (changed || filteredChanged) this.notify()
		this.scheduleMutationBroadcast(scope)
	}

	private markScopeStale(scope: string): void {
		this.ensureScope(scope)
		let changed = false
		for (const entry of this.assetQueryCache.values()) {
			if (entry.scope !== scope) continue
			entry.snapshot = {
				...entry.snapshot,
				stale: true,
				revision: entry.snapshot.revision + 1,
			}
			changed = true
		}
		if (changed) this.notify()
	}

	private matchesQuery(asset: AssetItem, query: NormalizedAssetLibraryQuery): boolean {
		if (!query.mediaTypes.includes(asset.asset_media_type as AssetMediaType)) return false
		if (query.scope !== "ALL" && asset.source !== query.scope) return false
		if (query.ownerUid && asset.owner_uid !== query.ownerUid) return false
		if (query.requiresCompliance && asset.compliance_status !== "PASS") return false
		if (!query.keyword) return true
		const keyword = query.keyword.toLocaleLowerCase()
		return [asset.name, asset.description, ...(asset.tags ?? []).map((tag) => tag.name)].some(
			(value) => typeof value === "string" && value.toLocaleLowerCase().includes(keyword),
		)
	}

	/** Clear all in-memory data, used on logout and organization/account changes. */
	public clearAll(): void {
		this.assetQueryCache.clear()
		this.ownersCache.clear()
		this.agreementCache = { signed: null, pending: null }
		this.mediaDimensions.clear()
		assetDetailStore.clearAll()
		this.notify()
	}

	public subscribe = (listener: () => void): (() => void) => {
		this.listeners.add(listener)
		return () => this.listeners.delete(listener)
	}

	private loadAssets(
		query: AssetLibraryQuery,
		scope: string,
		forceRefresh: boolean,
	): Promise<AssetItem[]> {
		this.ensureScope(scope)
		const normalizedQuery = normalizeAssetLibraryQuery(query)
		const queryKey = getQueryKey(normalizedQuery, scope)
		const existing = this.assetQueryCache.get(queryKey)

		if (existing?.pending) return existing.pending
		if (
			!forceRefresh &&
			existing?.snapshot.updatedAt !== null &&
			existing &&
			!existing.snapshot.stale
		) {
			return Promise.resolve(existing.snapshot.assets)
		}

		const entry: AssetQueryCacheEntry = existing ?? {
			scope,
			query: normalizedQuery,
			snapshot: EMPTY_QUERY_SNAPSHOT,
			pending: null,
			requestGeneration: 0,
		}
		const requestGeneration = entry.requestGeneration + 1
		entry.requestGeneration = requestGeneration
		const requestRevision = entry.snapshot.revision
		entry.snapshot = {
			assets: entry.snapshot.assets,
			loading: entry.snapshot.updatedAt === null,
			refreshing: entry.snapshot.updatedAt !== null,
			error: null,
			updatedAt: entry.snapshot.updatedAt,
			stale: entry.snapshot.stale,
			revision: entry.snapshot.revision,
		}
		this.assetQueryCache.set(queryKey, entry)
		this.notify()

		const pending = this.fetchAssets(normalizedQuery)
		entry.pending = pending
		pending.then(
			(assets) => {
				if (!this.isCurrentAssetRequest(queryKey, entry, requestGeneration)) return
				// If a mutation landed while the request was in flight, this response
				// may already be stale.  Keep it visible, but let the active hook issue
				// one more coalesced refresh after the request settles.
				const invalidatedDuringRequest = entry.snapshot.revision > requestRevision
				if (!invalidatedDuringRequest) {
					assets.forEach((asset) => assetDetailStore.seedFromList(asset, entry.scope))
				}
				entry.snapshot = {
					assets,
					loading: false,
					refreshing: false,
					error: null,
					updatedAt: Date.now(),
					stale: invalidatedDuringRequest,
					revision: invalidatedDuringRequest
						? entry.snapshot.revision + 1
						: entry.snapshot.revision,
				}
				entry.pending = null
				this.notify()
			},
			(error) => {
				if (!this.isCurrentAssetRequest(queryKey, entry, requestGeneration)) return
				entry.snapshot = {
					assets: entry.snapshot.assets,
					loading: false,
					refreshing: false,
					error: error,
					updatedAt: entry.snapshot.updatedAt,
					// A failed automatic refresh should not spin forever.  The old list
					// remains usable and the error gives the user an explicit retry path.
					stale: false,
					revision: entry.snapshot.revision,
				}
				entry.pending = null
				this.notify()
			},
		)
		return pending
	}

	private async fetchAssets(query: NormalizedAssetLibraryQuery): Promise<AssetItem[]> {
		const baseParams = {
			scope: query.scope,
			asset_kind: "ASSET" as const,
			compliance_status: query.requiresCompliance ? ("PASS" as const) : undefined,
			keyword: query.keyword || undefined,
			owner_uids: query.ownerUid ? [query.ownerUid] : undefined,
			page: query.page,
			page_size: query.pageSize,
		}
		const isAllImageAndVideoQuery =
			query.mediaTypes.length === IMAGE_AND_VIDEO_MEDIA_TYPES.length &&
			IMAGE_AND_VIDEO_MEDIA_TYPES.every((mediaType) => query.mediaTypes.includes(mediaType))
		const responses = isAllImageAndVideoQuery
			? [await AssetsApi.queryAssets(baseParams)]
			: await Promise.all(
					query.mediaTypes.map((mediaType) =>
						AssetsApi.queryAssets({
							...baseParams,
							asset_media_type: mediaType,
						}),
					),
				)
		const seenAssetIds = new Set<string>()
		const assets = responses.flatMap((response) =>
			response.list.filter((asset) => {
				if (!query.mediaTypes.includes(asset.asset_media_type as AssetMediaType))
					return false
				if (seenAssetIds.has(asset.asset_id)) return false
				seenAssetIds.add(asset.asset_id)
				return true
			}),
		)
		return assets
	}

	private loadOwners(scope: string, forceRefresh: boolean): Promise<AssetOwnerItem[]> {
		this.ensureScope(scope)
		const existing = this.ownersCache.get(scope)
		if (existing?.pending) return existing.pending
		if (!forceRefresh && existing?.data) return Promise.resolve(existing.data)

		const entry: OwnersCacheEntry = existing ?? {
			scope,
			data: null,
			pending: null,
		}
		const pending = AssetsApi.getAssetOwners()
		entry.pending = pending
		this.ownersCache.set(scope, entry)
		pending.then(
			(data) => {
				if (this.ownersCache.get(scope) !== entry) return
				entry.data = data
				entry.pending = null
				this.notify()
			},
			() => {
				if (this.ownersCache.get(scope) !== entry) return
				entry.pending = null
				this.notify()
			},
		)
		return pending
	}

	private isCurrentAssetRequest(
		queryKey: string,
		entry: AssetQueryCacheEntry,
		requestGeneration: number,
	): boolean {
		return (
			this.assetQueryCache.get(queryKey) === entry &&
			entry.requestGeneration === requestGeneration &&
			entry.scope === this.activeScope
		)
	}

	private ensureScope(scope: string): void {
		if (scope === this.activeScope) return
		this.activeScope = scope
		this.assetQueryCache.clear()
		this.ownersCache.clear()
		this.agreementCache = { signed: null, pending: null }
		this.mediaDimensions.clear()
		assetDetailStore.clearAll()
	}

	private createMutationChannel(): BroadcastChannel | null {
		if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return null
		try {
			return new BroadcastChannel("magic-asset-library-mutations")
		} catch {
			return null
		}
	}

	private readonly handleMutationMessage = (event: MessageEvent<unknown>): void => {
		if (!event.data || typeof event.data !== "object") return
		const message = event.data as { source?: string; scope?: string }
		if (
			!message.scope ||
			message.source === this.mutationSource ||
			message.scope !== getSharedMediaResourceScope()
		)
			return
		assetDetailStore.invalidate(undefined, message.scope)
		this.markScopeStale(message.scope)
	}

	private readonly handleExternalRefresh = (): void => {
		if (typeof document !== "undefined" && document.visibilityState === "hidden") return
		const now = Date.now()
		if (now - this.lastExternalRefreshAt < EXTERNAL_REFRESH_COOLDOWN_MS) return
		this.lastExternalRefreshAt = now
		this.markScopeStale(getSharedMediaResourceScope())
	}

	private scheduleMutationBroadcast(scope: string): void {
		if (!this.mutationChannel || this.pendingMutationBroadcasts.has(scope)) return
		this.pendingMutationBroadcasts.add(scope)
		queueMicrotask(() => {
			this.pendingMutationBroadcasts.delete(scope)
			this.mutationChannel?.postMessage({ source: this.mutationSource, scope })
		})
	}

	private notify(): void {
		this.listeners.forEach((listener) => listener())
	}
}

export const assetLibrarySessionStore = new AssetLibrarySessionStore()
