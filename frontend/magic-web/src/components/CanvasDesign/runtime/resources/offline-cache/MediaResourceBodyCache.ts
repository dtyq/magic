import { SharedAbortableRequest } from "./SharedAbortableRequest"

export interface MediaResourceBody {
	blob: Blob
	ossSrc: string
	cacheKey: string
	byteSize: number
	/** 资源 URL/metadata 代际；用于阻止旧 body 在版本变化后继续进入 decode。 */
	resourceGeneration?: number
}

export interface MediaResourceBodyCacheEntry {
	sourceUrl: string | null
	resourceVersion: string | null
	sourceUpdatedAt: string | null
	contentLength: number | null
	bodyPromise: SharedAbortableRequest<MediaResourceBody | null> | null
	bodyPromiseCacheKey: string | null
	bodyPromiseSharedCacheKey?: string | null
	bodyPromiseLeaseRelease?: (() => void) | undefined
	bodyBlob: Blob | null
	bodyOssSrc: string | null
	bodyCacheKey: string | null
	bodyByteSize: number
	bodyLastAccessAt: number
	bodyResourceGeneration?: number | null
	/** Set only when this entry is attached to the optional cross-Canvas body registry. */
	bodySharedCacheKey?: string | null
}

export interface MediaResourceBodyCacheState {
	bodyBlob: Blob | null
	bodyOssSrc: string | null
	bodyCacheKey: string | null
	bodyByteSize: number
	bodyLastAccessAt: number
	bodyResourceGeneration?: number | null
	bodySharedCacheKey?: string | null
}

export interface MediaResourceBodyCacheSnapshot {
	bodyCacheCount: number
	bodyCacheBytes: number
	bodyFetchInFlightCount: number
}

export interface MediaResourceBodyCacheOptions {
	ttlMs: number
	maxBytes: number
	now?: () => number
	/** Opt in to sharing completed Blob bodies between Canvas instances. */
	shared?: boolean
	/** Optional permission/project scope used only for the cross-Canvas registry key. */
	sharedScope?: string | (() => string | undefined)
}

interface SharedBodyRecord {
	body: MediaResourceBody
	lastAccessAt: number
	owners: Set<object>
	/** Multiple metadata generations may temporarily alias the same Blob record. */
	keys: Set<string>
}

interface SharedBodyInFlightOwner {
	entry: MediaResourceBodyCacheEntry
	release: () => void
	onSettled: () => void
}

interface SharedBodyInFlightRecord {
	request: SharedAbortableRequest<MediaResourceBody | null>
	owners: Map<object, SharedBodyInFlightOwner>
}

const sharedBodyRecords = new Map<string, SharedBodyRecord>()
const sharedBodyBudgetPolicies = new Map<object, number>()
const sharedBodyInFlightRecords = new Map<string, SharedBodyInFlightRecord>()

function getSharedBodyBudgetMaxBytes(): number {
	if (sharedBodyBudgetPolicies.size === 0) return Number.POSITIVE_INFINITY
	return Math.min(...sharedBodyBudgetPolicies.values())
}

function resetEntryBodyFields(entry: MediaResourceBodyCacheEntry): void {
	entry.bodyBlob = null
	entry.bodyOssSrc = null
	entry.bodyCacheKey = null
	entry.bodyByteSize = 0
	entry.bodyLastAccessAt = 0
	entry.bodyResourceGeneration = null
	entry.bodySharedCacheKey = null
}

function removeSharedBodyRecord(cacheKey: string, record: SharedBodyRecord): void {
	if (sharedBodyRecords.get(cacheKey) !== record) return
	record.keys.forEach((key) => {
		if (sharedBodyRecords.get(key) === record) sharedBodyRecords.delete(key)
	})
	record.keys.clear()
	for (const owner of Array.from(record.owners)) {
		record.owners.delete(owner)
		resetEntryBodyFields(owner as MediaResourceBodyCacheEntry)
	}
}

export class MediaResourceBodyCache<TEntry extends MediaResourceBodyCacheEntry> {
	private readonly inFlightRequests = new Set<SharedAbortableRequest<MediaResourceBody | null>>()
	private readonly now: () => number
	private readonly shared: boolean
	private readonly sharedScope?: string | (() => string | undefined)
	private readonly ownedInFlightEntries = new Set<TEntry>()

	constructor(private readonly options: MediaResourceBodyCacheOptions) {
		this.now = options.now ?? Date.now
		this.shared = options.shared === true
		this.sharedScope = options.sharedScope
		if (this.shared) {
			sharedBodyBudgetPolicies.set(this, options.maxBytes)
		}
	}

	private getSharedRegistryKey(cacheKey: string): string {
		if (!this.shared) return cacheKey
		const scope = typeof this.sharedScope === "function" ? this.sharedScope() : this.sharedScope
		return scope?.trim() ? `${scope.trim()}\0${cacheKey}` : cacheKey
	}

	private detachSharedBody(entry: TEntry): void {
		if (!this.shared) return
		const key = entry.bodySharedCacheKey
		if (!key) return
		const record = sharedBodyRecords.get(key)
		record?.owners.delete(entry)
		if (record && record.owners.size === 0) {
			record.keys.forEach((recordKey) => {
				if (sharedBodyRecords.get(recordKey) === record) {
					sharedBodyRecords.delete(recordKey)
				}
			})
			record.keys.clear()
		}
		entry.bodySharedCacheKey = null
	}

	private releaseInFlightLease(entry: TEntry): void {
		entry.bodyPromiseLeaseRelease?.()
		entry.bodyPromiseLeaseRelease = undefined
		entry.bodyPromiseSharedCacheKey = null
		this.ownedInFlightEntries.delete(entry)
	}

	private attachSharedInFlightLease(
		entry: TEntry,
		cacheKey: string,
		request: SharedAbortableRequest<MediaResourceBody | null>,
		sharedCacheKey: string,
	): void {
		this.releaseInFlightLease(entry)
		const record = sharedBodyInFlightRecords.get(sharedCacheKey)
		if (!record || record.request !== request) return
		let released = false
		const release = () => {
			if (released) return
			released = true
			record.owners.delete(entry)
			this.ownedInFlightEntries.delete(entry)
			if (record.owners.size === 0 && !request.isSettled) request.abort()
		}
		const owner: SharedBodyInFlightOwner = {
			entry,
			release,
			onSettled: () => {
				record.owners.delete(entry)
				this.ownedInFlightEntries.delete(entry)
				if (entry.bodyPromise === request) {
					entry.bodyPromise = null
					entry.bodyPromiseCacheKey = null
					entry.bodyPromiseSharedCacheKey = null
					entry.bodyPromiseLeaseRelease = undefined
				}
			},
		}
		record.owners.set(entry, owner)
		entry.bodyPromise = request
		entry.bodyPromiseCacheKey = cacheKey
		entry.bodyPromiseSharedCacheKey = sharedCacheKey
		entry.bodyPromiseLeaseRelease = release
		this.ownedInFlightEntries.add(entry)
	}

	private clearSharedInFlightRecord(
		sharedCacheKey: string,
		request: SharedAbortableRequest<MediaResourceBody | null>,
	): void {
		const record = sharedBodyInFlightRecords.get(sharedCacheKey)
		if (!record || record.request !== request) return
		sharedBodyInFlightRecords.delete(sharedCacheKey)
		record.owners.forEach((owner) => owner.onSettled())
		record.owners.clear()
	}

	private attachSharedBody(
		entry: TEntry,
		record: SharedBodyRecord,
		cacheKey: string,
		sharedCacheKey = cacheKey,
	): void {
		this.detachSharedBody(entry)
		record.keys.add(sharedCacheKey)
		record.owners.add(entry)
		record.lastAccessAt = this.now()
		entry.bodySharedCacheKey = sharedCacheKey
		entry.bodyBlob = record.body.blob
		entry.bodyOssSrc = record.body.ossSrc
		entry.bodyCacheKey = cacheKey
		entry.bodyByteSize = record.body.byteSize
		entry.bodyLastAccessAt = record.lastAccessAt
		entry.bodyResourceGeneration = record.body.resourceGeneration ?? null
	}

	public getCacheKey(path: string, ossSrc: string, entry: TEntry): string {
		const version =
			entry.resourceVersion ??
			entry.sourceUpdatedAt ??
			(entry.contentLength ? String(entry.contentLength) : null) ??
			entry.sourceUrl ??
			ossSrc
		return `${path}::${version}`
	}

	public getCachedOssSrc(entry: TEntry): string | null {
		return entry.bodyBlob && entry.bodyOssSrc ? entry.bodyOssSrc : null
	}

	public hasBody(entry: TEntry): boolean {
		return !!entry.bodyBlob
	}

	public getReusableBody(
		entry: TEntry,
		ossSrc: string,
		cacheKey: string,
	): MediaResourceBody | null {
		const sharedRegistryKey = this.getSharedRegistryKey(cacheKey)
		if (this.shared && entry.bodySharedCacheKey) {
			const attachedRecord = sharedBodyRecords.get(entry.bodySharedCacheKey)
			if (
				entry.bodySharedCacheKey !== sharedRegistryKey ||
				!attachedRecord ||
				attachedRecord.body.blob !== entry.bodyBlob
			) {
				this.clearBody(entry)
			}
		}
		if ((!entry.bodyBlob || entry.bodyCacheKey !== cacheKey) && this.shared) {
			const sharedRecord = sharedBodyRecords.get(sharedRegistryKey)
			if (sharedRecord) {
				if (this.now() - sharedRecord.lastAccessAt > this.options.ttlMs) {
					removeSharedBodyRecord(sharedRegistryKey, sharedRecord)
					return null
				}
				this.attachSharedBody(entry, sharedRecord, cacheKey, sharedRegistryKey)
			}
		}
		if (!entry.bodyBlob || entry.bodyCacheKey !== cacheKey) return null

		if (this.now() - entry.bodyLastAccessAt > this.options.ttlMs) {
			if (this.shared && entry.bodySharedCacheKey) {
				const sharedRecord = sharedBodyRecords.get(entry.bodySharedCacheKey)
				if (sharedRecord) {
					removeSharedBodyRecord(entry.bodySharedCacheKey, sharedRecord)
				} else {
					this.clearBody(entry)
				}
			} else {
				this.clearBody(entry)
			}
			return null
		}

		const accessedAt = this.now()
		entry.bodyLastAccessAt = accessedAt
		if (this.shared && entry.bodySharedCacheKey) {
			const sharedRecord = sharedBodyRecords.get(entry.bodySharedCacheKey)
			if (sharedRecord) sharedRecord.lastAccessAt = accessedAt
		}
		return {
			blob: entry.bodyBlob,
			ossSrc: entry.bodyOssSrc ?? ossSrc,
			cacheKey,
			byteSize: entry.bodyByteSize,
			...(typeof entry.bodyResourceGeneration === "number"
				? { resourceGeneration: entry.bodyResourceGeneration }
				: {}),
		}
	}

	public getInFlight(
		entry: TEntry,
		cacheKey: string,
	): SharedAbortableRequest<MediaResourceBody | null> | null {
		if (entry.bodyPromiseCacheKey === cacheKey && entry.bodyPromise) {
			if (entry.bodyPromise.isAborted) return null
			return entry.bodyPromise
		}
		if (!this.shared) return null
		const sharedCacheKey = this.getSharedRegistryKey(cacheKey)
		const sharedRecord = sharedBodyInFlightRecords.get(sharedCacheKey)
		if (!sharedRecord || sharedRecord.request.isAborted) return null
		this.attachSharedInFlightLease(entry, cacheKey, sharedRecord.request, sharedCacheKey)
		return sharedRecord.request
	}

	public setInFlight(
		entry: TEntry,
		cacheKey: string,
		request: SharedAbortableRequest<MediaResourceBody | null>,
	): void {
		if (this.shared) {
			const sharedCacheKey = this.getSharedRegistryKey(cacheKey)
			const existing = sharedBodyInFlightRecords.get(sharedCacheKey)
			if (existing) {
				if (existing.request === request) {
					this.attachSharedInFlightLease(entry, cacheKey, request, sharedCacheKey)
					return
				}
				if (existing.request.isAborted || existing.request.isSettled) {
					this.clearSharedInFlightRecord(sharedCacheKey, existing.request)
				} else {
					request.abort()
					return
				}
			}
			sharedBodyInFlightRecords.set(sharedCacheKey, {
				request,
				owners: new Map(),
			})
			this.attachSharedInFlightLease(entry, cacheKey, request, sharedCacheKey)
			void request.promise.then(
				() => this.clearSharedInFlightRecord(sharedCacheKey, request),
				() => this.clearSharedInFlightRecord(sharedCacheKey, request),
			)
			return
		}
		entry.bodyPromise = request
		entry.bodyPromiseCacheKey = cacheKey
		this.inFlightRequests.add(request)
	}

	public clearInFlightIfCurrent(
		entry: TEntry,
		request: SharedAbortableRequest<MediaResourceBody | null>,
	): void {
		this.inFlightRequests.delete(request)
		if (entry.bodyPromise !== request) return
		if (this.shared) this.releaseInFlightLease(entry)
		entry.bodyPromise = null
		entry.bodyPromiseCacheKey = null
		entry.bodyPromiseSharedCacheKey = null
	}

	public storeBody(entry: TEntry, body: MediaResourceBody): void {
		const maxBytes = this.shared ? getSharedBodyBudgetMaxBytes() : this.options.maxBytes
		if (body.byteSize > maxBytes) {
			if (this.shared) {
				const sharedRegistryKey = this.getSharedRegistryKey(body.cacheKey)
				const existing = sharedBodyRecords.get(sharedRegistryKey)
				if (existing) removeSharedBodyRecord(sharedRegistryKey, existing)
			}
			this.clearBody(entry)
			return
		}

		if (this.shared) {
			const sharedRegistryKey = this.getSharedRegistryKey(body.cacheKey)
			const existing = sharedBodyRecords.get(sharedRegistryKey)
			if (existing && this.now() - existing.lastAccessAt <= this.options.ttlMs) {
				this.attachSharedBody(entry, existing, body.cacheKey, sharedRegistryKey)
				return
			}
			if (existing) removeSharedBodyRecord(sharedRegistryKey, existing)
			const record: SharedBodyRecord = {
				body,
				lastAccessAt: this.now(),
				owners: new Set(),
				keys: new Set([sharedRegistryKey]),
			}
			sharedBodyRecords.set(sharedRegistryKey, record)
			this.attachSharedBody(entry, record, body.cacheKey, sharedRegistryKey)
			return
		}
		this.detachSharedBody(entry)
		entry.bodyBlob = body.blob
		entry.bodyOssSrc = body.ossSrc
		entry.bodyCacheKey = body.cacheKey
		entry.bodyByteSize = body.byteSize
		entry.bodyLastAccessAt = this.now()
		entry.bodyResourceGeneration = body.resourceGeneration ?? null
	}

	/**
	 * Re-key an already cached body after metadata hydration discovers a stable
	 * resource version. The same Blob remains shared; older owners may continue
	 * using the previous alias until their metadata catches up.
	 */
	public rekeyBodyCacheKey(entry: TEntry, previousCacheKey: string, nextCacheKey: string): void {
		if (
			!previousCacheKey ||
			!nextCacheKey ||
			previousCacheKey === nextCacheKey ||
			entry.bodyCacheKey !== previousCacheKey
		) {
			return
		}

		if (!this.shared) {
			entry.bodyCacheKey = nextCacheKey
			if (entry.bodyPromiseCacheKey === previousCacheKey) {
				entry.bodyPromiseCacheKey = nextCacheKey
			}
			return
		}

		if (!entry.bodyBlob) return
		const previousSharedKey =
			entry.bodySharedCacheKey ?? this.getSharedRegistryKey(previousCacheKey)
		const previousRecord = sharedBodyRecords.get(previousSharedKey)
		if (!previousRecord || previousRecord.body.blob !== entry.bodyBlob) {
			entry.bodyCacheKey = nextCacheKey
			entry.bodySharedCacheKey = null
			return
		}

		const nextSharedKey = this.getSharedRegistryKey(nextCacheKey)
		const nextRecord = sharedBodyRecords.get(nextSharedKey)
		if (nextRecord && nextRecord !== previousRecord) {
			if (nextRecord.body.blob === entry.bodyBlob) {
				this.attachSharedBody(entry, nextRecord, nextCacheKey, nextSharedKey)
			} else {
				this.clearBody(entry)
			}
			return
		}

		const hasOtherOwners = Array.from(previousRecord.owners).some((owner) => owner !== entry)
		previousRecord.keys.add(nextSharedKey)
		sharedBodyRecords.set(nextSharedKey, previousRecord)
		entry.bodySharedCacheKey = nextSharedKey
		entry.bodyCacheKey = nextCacheKey
		entry.bodyLastAccessAt = this.now()
		if (entry.bodyPromiseCacheKey === previousCacheKey) {
			entry.bodyPromiseCacheKey = nextCacheKey
		}

		if (!hasOtherOwners && previousSharedKey !== nextSharedKey) {
			previousRecord.keys.delete(previousSharedKey)
			if (sharedBodyRecords.get(previousSharedKey) === previousRecord) {
				sharedBodyRecords.delete(previousSharedKey)
			}
		}
	}

	public clearBody(entry: TEntry): void {
		this.detachSharedBody(entry)
		entry.bodyBlob = null
		entry.bodyOssSrc = null
		entry.bodyCacheKey = null
		entry.bodyByteSize = 0
		entry.bodyLastAccessAt = 0
		entry.bodyResourceGeneration = null
		entry.bodySharedCacheKey = null
	}

	public clearBodyPromise(entry: TEntry): void {
		if (this.shared) {
			this.releaseInFlightLease(entry)
			entry.bodyPromise = null
			entry.bodyPromiseCacheKey = null
			entry.bodyPromiseSharedCacheKey = null
			return
		}
		entry.bodyPromise?.abort()
		if (entry.bodyPromise) this.inFlightRequests.delete(entry.bodyPromise)
		entry.bodyPromise = null
		entry.bodyPromiseCacheKey = null
	}

	public clearEntry(entry: TEntry): void {
		this.clearBody(entry)
		this.clearBodyPromise(entry)
	}

	public evictBudget(entries: Iterable<TEntry>, exemptEntry?: TEntry): void {
		if (this.shared) {
			this.evictSharedBudget(entries, exemptEntry)
			return
		}
		const cachedEntries: TEntry[] = []
		let totalBytes = 0
		for (const entry of entries) {
			if (!entry.bodyBlob) continue
			totalBytes += entry.bodyByteSize
			if (entry !== exemptEntry) cachedEntries.push(entry)
		}
		if (totalBytes <= this.options.maxBytes) return

		cachedEntries.sort((a, b) => a.bodyLastAccessAt - b.bodyLastAccessAt)
		for (const entry of cachedEntries) {
			if (totalBytes <= this.options.maxBytes) break
			totalBytes -= entry.bodyByteSize
			this.clearBody(entry)
		}
	}

	public getSnapshot(entries: Iterable<TEntry>): MediaResourceBodyCacheSnapshot {
		let bodyCacheCount = 0
		let bodyCacheBytes = 0
		let bodyFetchInFlightCount = 0
		const countedSharedBodies = new Set<SharedBodyRecord | Blob | string>()
		for (const entry of entries) {
			if (entry.bodyBlob) {
				const sharedRecord = entry.bodySharedCacheKey
					? sharedBodyRecords.get(entry.bodySharedCacheKey)
					: undefined
				const countKey = sharedRecord ?? entry.bodySharedCacheKey ?? entry.bodyBlob
				if (!countedSharedBodies.has(countKey)) {
					bodyCacheCount += 1
					bodyCacheBytes += entry.bodyByteSize
				}
				countedSharedBodies.add(countKey)
			}
			if (entry.bodyPromise) bodyFetchInFlightCount += 1
		}
		return { bodyCacheCount, bodyCacheBytes, bodyFetchInFlightCount }
	}

	public captureState(entry: TEntry): MediaResourceBodyCacheState {
		return {
			bodyBlob: entry.bodyBlob,
			bodyOssSrc: entry.bodyOssSrc,
			bodyCacheKey: entry.bodyCacheKey,
			bodyByteSize: entry.bodyByteSize,
			bodyLastAccessAt: entry.bodyLastAccessAt,
			bodyResourceGeneration: entry.bodyResourceGeneration ?? null,
			bodySharedCacheKey: entry.bodySharedCacheKey ?? null,
		}
	}

	public restoreState(entry: TEntry, state: MediaResourceBodyCacheState): void {
		this.detachSharedBody(entry)
		if (this.shared && state.bodyBlob && state.bodyCacheKey) {
			const sharedRegistryKey =
				state.bodySharedCacheKey ?? this.getSharedRegistryKey(state.bodyCacheKey)
			const existing = sharedBodyRecords.get(sharedRegistryKey)
			if (existing && this.now() - existing.lastAccessAt > this.options.ttlMs) {
				removeSharedBodyRecord(sharedRegistryKey, existing)
			}
			const activeExisting = sharedBodyRecords.get(sharedRegistryKey)
			const record = activeExisting ?? {
				body: {
					blob: state.bodyBlob,
					ossSrc: state.bodyOssSrc ?? "",
					cacheKey: state.bodyCacheKey,
					byteSize: state.bodyByteSize,
					...(typeof state.bodyResourceGeneration === "number"
						? { resourceGeneration: state.bodyResourceGeneration }
						: {}),
				},
				lastAccessAt: state.bodyLastAccessAt,
				owners: new Set(),
				keys: new Set([sharedRegistryKey]),
			}
			if (!activeExisting) sharedBodyRecords.set(sharedRegistryKey, record)
			this.attachSharedBody(entry, record, state.bodyCacheKey, sharedRegistryKey)
			return
		}
		entry.bodyBlob = state.bodyBlob
		entry.bodyOssSrc = state.bodyOssSrc
		entry.bodyCacheKey = state.bodyCacheKey
		entry.bodyByteSize = state.bodyByteSize
		entry.bodyLastAccessAt = state.bodyLastAccessAt
		entry.bodyResourceGeneration = state.bodyResourceGeneration ?? null
		entry.bodySharedCacheKey = null
	}

	public abortAll(): void {
		if (this.shared) {
			Array.from(this.ownedInFlightEntries).forEach((entry) => this.clearBodyPromise(entry))
			this.inFlightRequests.clear()
			return
		}
		this.inFlightRequests.forEach((request) => request.abort())
		this.inFlightRequests.clear()
	}

	/** Release this cache's shared-policy registration after its Canvas is destroyed. */
	public dispose(): void {
		this.abortAll()
		if (this.shared) sharedBodyBudgetPolicies.delete(this)
	}

	private evictSharedBudget(_entries: Iterable<TEntry>, exemptEntry?: TEntry): void {
		const records = Array.from(new Set(sharedBodyRecords.values()))
		let totalBytes = records.reduce((sum, record) => sum + record.body.byteSize, 0)
		const maxBytes = getSharedBodyBudgetMaxBytes()
		if (totalBytes <= maxBytes) return

		const ordered = records.sort((left, right) => left.lastAccessAt - right.lastAccessAt)
		for (const record of ordered) {
			if (totalBytes <= maxBytes) break
			if (exemptEntry && record.owners.has(exemptEntry)) continue
			const cacheKey = record.keys.values().next().value as string | undefined
			if (!cacheKey) continue
			removeSharedBodyRecord(cacheKey, record)
			totalBytes = Math.max(0, totalBytes - record.body.byteSize)
		}
	}
}

/** Test/lifecycle escape hatch for the opt-in cross-Canvas registry. */
export function clearSharedMediaBodyCache(): void {
	for (const [cacheKey, record] of Array.from(sharedBodyRecords.entries())) {
		removeSharedBodyRecord(cacheKey, record)
	}
	for (const record of Array.from(sharedBodyInFlightRecords.values())) {
		record.owners.forEach((owner) => owner.release())
		record.request.abort()
	}
	sharedBodyInFlightRecords.clear()
	sharedBodyBudgetPolicies.clear()
}
