import type { ImageInfo } from "./ImageResourceManager"
import type { MediaDisplayResourceVariant } from "../visibility/CanvasMediaViewingPolicy"
import { CANVAS_MEDIA_MAX_IDLE_AGE_MS } from "@/workers/service-worker/canvasMediaShared"

export type PersistentImageDisplayVariant = Extract<MediaDisplayResourceVariant, "low">

export type PersistentImageDisplayRendition = string

export interface PersistentImageDisplayCacheRecord {
	key: string
	lookupKey: string
	scope: string
	path: string
	variant: PersistentImageDisplayVariant
	rendition: PersistentImageDisplayRendition
	/** 旧版本直接存入 IndexedDB 的 body；新记录绝不写入该字段。 */
	blob?: Blob
	bodyCacheKey?: string
	/** 缺失表示旧记录，按 ready 兼容。 */
	bodyState?: "pending" | "ready"
	pendingAt?: number
	byteSize: number
	imageInfo: ImageInfo
	resourceVersion: string
	sourceUpdatedAt: string | null
	contentLength: number | null
	writeOrder: string
	createdAt: number
	lastAccessAt: number
	/** 仅用于兼容旧记录；新写入不再持久化。 */
	mimeType?: string
	width?: number
	height?: number
	sourceUrl?: string | null
	maxEdge?: number | null
	codecVersion?: number
}

export type HydratedPersistentImageDisplayCacheRecord = PersistentImageDisplayCacheRecord & {
	blob: Blob
}

export interface PersistentImageDisplayCachePutOptions {
	scope: string
	path: string
	variant: PersistentImageDisplayVariant
	rendition: PersistentImageDisplayRendition
	blob: Blob
	imageInfo: ImageInfo
	resourceVersion: string | null
	sourceUpdatedAt: string | null
	contentLength: number | null
	maxEdge?: number
	writeOrder: string
}

export interface PersistentImageDisplayCacheGetOptions {
	scope: string
	path: string
	variant: PersistentImageDisplayVariant
	rendition: PersistentImageDisplayRendition
	/** 已知时只返回该资源版本；未知时允许返回最新可用版本作为 stale 占位。 */
	resourceVersion?: string | null
}

const DB_NAME = "canvas-design-image-display-variant-cache-v1"
const DB_VERSION = 4
const STORE_NAME = "resources"
const BODY_CACHE_NAME = "canvas-design-image-display-variant-bodies-v1"
const BODY_CACHE_URL_PREFIX = "https://canvas-design-image.invalid/body/"
const LOOKUP_INDEX = "lookupKey"
const LAST_ACCESS_INDEX = "lastAccessAt"
const DEFAULT_MAX_BYTES = 200 * 1024 * 1024
const DEFAULT_MAX_ENTRIES = 4096
const CODEC_VERSION = 3
const PRUNE_IDLE_DELAY_MS = 1000
const TOUCH_WRITEBACK_INTERVAL_MS = 24 * 60 * 60 * 1000
const PENDING_WRITE_MAX_AGE_MS = 60 * 60 * 1000

interface PendingGetRequest {
	resolve: (record: HydratedPersistentImageDisplayCacheRecord | null) => void
	resourceVersion?: string | null
}

interface PersistentImageDisplayCacheTouch {
	key: string
	lastAccessAt: number
}

function isIndexedDbSupported(): boolean {
	return typeof indexedDB !== "undefined"
}

function normalizeKeyPart(value: string): string {
	return encodeURIComponent(value)
}

function getBodyCacheKey(recordKey: string): string {
	return `${BODY_CACHE_URL_PREFIX}${encodeURIComponent(recordKey)}`
}

function getCacheStorage(): CacheStorage | null {
	if (typeof caches === "undefined" || typeof Response === "undefined") return null
	return caches
}

async function putBodyInCache(bodyCacheKey: string, blob: Blob): Promise<boolean> {
	const cacheStorage = getCacheStorage()
	if (!cacheStorage) return false
	try {
		const cache = await cacheStorage.open(BODY_CACHE_NAME)
		await cache.put(
			bodyCacheKey,
			new Response(blob, {
				headers: {
					"Content-Type": blob.type || "image/webp",
					"Content-Length": String(blob.size),
				},
			}),
		)
		return true
	} catch {
		return false
	}
}

interface BodyCacheReadResult {
	/** Whether CacheStorage was available and the lookup completed. */
	available: boolean
	blob: Blob | null
}

async function readBodyFromCache(bodyCacheKey: string): Promise<BodyCacheReadResult> {
	const cacheStorage = getCacheStorage()
	if (!cacheStorage) return { available: false, blob: null }
	try {
		const cache = await cacheStorage.open(BODY_CACHE_NAME)
		const response = await cache.match(bodyCacheKey)
		return { available: true, blob: response ? await response.blob() : null }
	} catch {
		return { available: false, blob: null }
	}
}

async function deleteBodyFromCache(bodyCacheKey: string | undefined): Promise<void> {
	if (!bodyCacheKey) return
	const cacheStorage = getCacheStorage()
	if (!cacheStorage) return
	try {
		const cache = await cacheStorage.open(BODY_CACHE_NAME)
		await cache.delete(bodyCacheKey)
	} catch {
		// Body eviction is best effort; metadata remains authoritative.
	}
}

function createLookupKey(options: PersistentImageDisplayCacheGetOptions): string {
	return JSON.stringify([options.scope, options.rendition, options.path, options.variant])
}

function hasComparableVersion(
	record: Pick<PersistentImageDisplayCacheRecord, "resourceVersion">,
): boolean {
	return record.resourceVersion.trim().length > 0
}

function getRecordWriteOrder(record: PersistentImageDisplayCacheRecord): string {
	return record.writeOrder || String(record.createdAt).padStart(16, "0")
}

function compareSourceFreshness(
	left: Pick<PersistentImageDisplayCacheRecord, "sourceUpdatedAt">,
	right: Pick<PersistentImageDisplayCacheRecord, "sourceUpdatedAt">,
): number {
	if (!left.sourceUpdatedAt || !right.sourceUpdatedAt) return 0
	const leftTime = Date.parse(left.sourceUpdatedAt)
	const rightTime = Date.parse(right.sourceUpdatedAt)
	if (!Number.isFinite(leftTime) || !Number.isFinite(rightTime) || leftTime === rightTime) {
		return 0
	}
	return leftTime > rightTime ? 1 : -1
}

export class ImageDisplayVariantPersistentCache {
	private dbPromise: Promise<IDBDatabase | null> | null = null
	private pendingGets = new Map<string, PendingGetRequest[]>()
	private getFlushScheduled = false
	private pruneTimerId: ReturnType<typeof setTimeout> | null = null
	private touchTimerId: ReturnType<typeof setTimeout> | null = null
	private pendingTouches = new Map<string, PersistentImageDisplayCacheTouch>()
	private lastTouchWriteAt = new Map<string, number>()
	private activePutLookupCounts = new Map<string, number>()
	private readonly maxBytes: number
	private readonly maxEntries: number
	private readonly maxIdleAgeMs: number
	private readonly now: () => number

	constructor(options?: {
		maxBytes?: number
		maxEntries?: number
		maxIdleAgeMs?: number
		now?: () => number
	}) {
		this.maxBytes = options?.maxBytes ?? DEFAULT_MAX_BYTES
		this.maxEntries = options?.maxEntries ?? DEFAULT_MAX_ENTRIES
		this.maxIdleAgeMs = options?.maxIdleAgeMs ?? CANVAS_MEDIA_MAX_IDLE_AGE_MS
		this.now = options?.now ?? Date.now
	}

	public destroy(): void {
		if (this.pruneTimerId !== null) {
			clearTimeout(this.pruneTimerId)
			this.pruneTimerId = null
		}
		if (this.touchTimerId !== null) {
			clearTimeout(this.touchTimerId)
			this.touchTimerId = null
		}
		this.pendingTouches.clear()
		this.pendingGets.forEach((requests) => requests.forEach(({ resolve }) => resolve(null)))
		this.pendingGets.clear()
	}

	public async getLatest(
		options: PersistentImageDisplayCacheGetOptions,
	): Promise<HydratedPersistentImageDisplayCacheRecord | null> {
		const lookupKey = createLookupKey(options)
		return new Promise((resolve) => {
			const requests = this.pendingGets.get(lookupKey) ?? []
			requests.push({ resolve, resourceVersion: options.resourceVersion })
			this.pendingGets.set(lookupKey, requests)
			this.scheduleGetFlush()
		})
	}

	public async put(options: PersistentImageDisplayCachePutOptions): Promise<boolean> {
		if (!options.resourceVersion) return false
		// 新 body 只允许进入 CacheStorage；不可用时不要用 IndexedDB Blob 兜底。
		if (!getCacheStorage()) return false
		const db = await this.getDb()
		if (!db) return false

		const lookupKey = createLookupKey(options)
		const createdAt = this.now()
		const readyKey = [
			"canvas-display-image",
			`v${DB_VERSION}`,
			normalizeKeyPart(options.scope),
			normalizeKeyPart(options.rendition),
			normalizeKeyPart(options.path),
			options.variant,
			normalizeKeyPart(options.resourceVersion),
			options.maxEdge ?? "original",
			normalizeKeyPart(options.writeOrder),
			`codec${CODEC_VERSION}`,
		].join(":")
		const key = `${readyKey}:pending:${createdAt}:${Math.random().toString(36).slice(2)}`
		const bodyCacheKey = getBodyCacheKey(key)
		const record: PersistentImageDisplayCacheRecord = {
			key,
			lookupKey,
			scope: options.scope,
			path: options.path,
			variant: options.variant,
			rendition: options.rendition,
			bodyCacheKey,
			bodyState: "pending",
			pendingAt: createdAt,
			byteSize: options.blob.size,
			imageInfo: options.imageInfo,
			resourceVersion: options.resourceVersion,
			sourceUpdatedAt: options.sourceUpdatedAt,
			contentLength: options.contentLength,
			writeOrder: options.writeOrder,
			createdAt,
			lastAccessAt: createdAt,
		}

		this.incrementActivePut(lookupKey)
		try {
			const pendingAccepted = await this.putPendingRecord(db, record)
			if (!pendingAccepted) return false
			this.schedulePrune()

			const bodyStoredInCache = await putBodyInCache(bodyCacheKey, options.blob)
			if (!bodyStoredInCache) {
				await this.removePendingRecord(db, record)
				return false
			}

			const readyRecord: PersistentImageDisplayCacheRecord = {
				...record,
				key: readyKey,
				bodyState: "ready",
			}
			delete readyRecord.pendingAt
			const accepted = await this.putLatestRecord(db, readyRecord)
			if (!accepted) {
				await this.removePendingRecord(db, record)
				await deleteBodyFromCache(bodyCacheKey)
			}
			if (accepted) this.schedulePrune()
			return accepted
		} finally {
			this.decrementActivePut(lookupKey)
		}
	}

	private incrementActivePut(lookupKey: string): void {
		this.activePutLookupCounts.set(
			lookupKey,
			(this.activePutLookupCounts.get(lookupKey) ?? 0) + 1,
		)
	}

	private decrementActivePut(lookupKey: string): void {
		const nextCount = (this.activePutLookupCounts.get(lookupKey) ?? 1) - 1
		if (nextCount <= 0) this.activePutLookupCounts.delete(lookupKey)
		else this.activePutLookupCounts.set(lookupKey, nextCount)
	}

	public async removeByPath(scope: string, path: string, maxWriteOrder?: string): Promise<void> {
		const db = await this.getDb()
		if (!db) return
		const tx = db.transaction(STORE_NAME, "readwrite")
		const store = tx.objectStore(STORE_NAME)
		const records = await this.readAllRecords(store)
		const removedBodyKeys: string[] = []
		records.forEach((record) => {
			if (
				record.scope === scope &&
				record.path === path &&
				(!maxWriteOrder || getRecordWriteOrder(record) <= maxWriteOrder)
			) {
				if (record.bodyCacheKey) removedBodyKeys.push(record.bodyCacheKey)
				store.delete(record.key)
			}
		})
		await this.awaitTransaction(tx)
		await Promise.all(removedBodyKeys.map((bodyCacheKey) => deleteBodyFromCache(bodyCacheKey)))
	}

	public async removeVersion(
		scope: string,
		path: string,
		rendition: PersistentImageDisplayRendition,
		resourceVersion: string,
		maxWriteOrder?: string,
	): Promise<void> {
		const db = await this.getDb()
		if (!db) return
		const tx = db.transaction(STORE_NAME, "readwrite")
		const store = tx.objectStore(STORE_NAME)
		const records = await this.readAllRecords(store)
		const removedBodyKeys: string[] = []
		records.forEach((record) => {
			if (
				record.scope === scope &&
				record.path === path &&
				record.rendition === rendition &&
				record.resourceVersion === resourceVersion &&
				(!maxWriteOrder || getRecordWriteOrder(record) <= maxWriteOrder)
			) {
				if (record.bodyCacheKey) removedBodyKeys.push(record.bodyCacheKey)
				store.delete(record.key)
			}
		})
		await this.awaitTransaction(tx)
		await Promise.all(removedBodyKeys.map((bodyCacheKey) => deleteBodyFromCache(bodyCacheKey)))
	}

	public async removeWriteOrder(
		scope: string,
		path: string,
		rendition: PersistentImageDisplayRendition,
		resourceVersion: string,
		writeOrder: string,
	): Promise<void> {
		const db = await this.getDb()
		if (!db) return
		const tx = db.transaction(STORE_NAME, "readwrite")
		const store = tx.objectStore(STORE_NAME)
		const records = await this.readAllRecords(store)
		const removedBodyKeys: string[] = []
		records.forEach((record) => {
			if (
				record.scope === scope &&
				record.path === path &&
				record.rendition === rendition &&
				record.resourceVersion === resourceVersion &&
				record.writeOrder === writeOrder
			) {
				if (record.bodyCacheKey) removedBodyKeys.push(record.bodyCacheKey)
				store.delete(record.key)
			}
		})
		await this.awaitTransaction(tx)
		await Promise.all(removedBodyKeys.map((bodyCacheKey) => deleteBodyFromCache(bodyCacheKey)))
	}

	private scheduleGetFlush(): void {
		if (this.getFlushScheduled) return
		this.getFlushScheduled = true
		queueMicrotask(() => {
			this.getFlushScheduled = false
			void this.flushPendingGets()
		})
	}

	private async flushPendingGets(): Promise<void> {
		const pendingGets = this.pendingGets
		this.pendingGets = new Map()
		if (pendingGets.size === 0) return

		const db = await this.getDb()
		if (!db) {
			pendingGets.forEach((requests) => requests.forEach(({ resolve }) => resolve(null)))
			return
		}

		const lookupKeys = Array.from(pendingGets.keys())
		const recordsByLookupKey = await this.readRecordsByLookupKeys(db, lookupKeys)
		const now = this.now()
		let hasExpiredRecord = false
		const resolutionTasks: Promise<void>[] = []
		pendingGets.forEach((requests, lookupKey) => {
			const records = (recordsByLookupKey.get(lookupKey) ?? [])
				.filter(hasComparableVersion)
				.filter((record) => record.bodyState !== "pending")
				.filter((record) => {
					const expired = this.isRecordExpired(record, now)
					if (expired) hasExpiredRecord = true
					return !expired
				})
			requests.forEach(({ resolve, resourceVersion }) => {
				const record =
					records
						.filter(
							(candidate) =>
								!resourceVersion || candidate.resourceVersion === resourceVersion,
						)
						.sort((a, b) =>
							getRecordWriteOrder(b).localeCompare(getRecordWriteOrder(a)),
						)[0] ?? null
				resolutionTasks.push(
					(async () => {
						if (!record) {
							resolve(null)
							return
						}
						const hydratedRecord = await this.hydrateRecord(record)
						if (!hydratedRecord) {
							resolve(null)
							return
						}
						const lastAccessAt = this.now()
						this.queueTouch(hydratedRecord, lastAccessAt)
						resolve({ ...hydratedRecord, lastAccessAt })
					})(),
				)
			})
		})
		await Promise.all(resolutionTasks)
		if (hasExpiredRecord) this.schedulePrune()
	}

	private async hydrateRecord(
		record: PersistentImageDisplayCacheRecord,
	): Promise<HydratedPersistentImageDisplayCacheRecord | null> {
		if (record.blob) {
			return record as HydratedPersistentImageDisplayCacheRecord
		}
		if (!record.bodyCacheKey) return null
		const bodyResult = await readBodyFromCache(record.bodyCacheKey)
		if (bodyResult.blob) return { ...record, blob: bodyResult.blob }
		if (bodyResult.available) {
			void this.removeMissingBodyRecord(record).catch(() => undefined)
		}
		return null
	}

	private async removeMissingBodyRecord(
		record: PersistentImageDisplayCacheRecord,
	): Promise<void> {
		const db = await this.getDb()
		if (!db) return
		const tx = db.transaction(STORE_NAME, "readwrite")
		const store = tx.objectStore(STORE_NAME)
		const request = store.get(record.key)
		request.onsuccess = () => {
			const current = request.result as PersistentImageDisplayCacheRecord | undefined
			if (
				!current ||
				current.bodyCacheKey !== record.bodyCacheKey ||
				current.createdAt !== record.createdAt ||
				getRecordWriteOrder(current) !== getRecordWriteOrder(record)
			) {
				return
			}
			store.delete(record.key)
		}
		await this.awaitTransaction(tx)
	}

	private isRecordExpired(
		record: Pick<PersistentImageDisplayCacheRecord, "lastAccessAt" | "createdAt">,
		now = this.now(),
	): boolean {
		if (!Number.isFinite(this.maxIdleAgeMs) || this.maxIdleAgeMs < 0) return false
		const lastAccessAt = record.lastAccessAt || record.createdAt || 0
		return now - lastAccessAt > this.maxIdleAgeMs
	}

	private queueTouch(record: PersistentImageDisplayCacheRecord, lastAccessAt: number): void {
		const lastWrittenAt = this.lastTouchWriteAt.get(record.key) ?? record.lastAccessAt
		if (lastAccessAt - lastWrittenAt < TOUCH_WRITEBACK_INTERVAL_MS) return
		this.pendingTouches.set(record.key, { key: record.key, lastAccessAt })
		this.scheduleTouchFlush()
	}

	private scheduleTouchFlush(): void {
		if (this.touchTimerId !== null) return
		this.touchTimerId = setTimeout(() => {
			this.touchTimerId = null
			void this.flushPendingTouches()
		}, PRUNE_IDLE_DELAY_MS)
	}

	private async flushPendingTouches(): Promise<void> {
		const touches = Array.from(this.pendingTouches.values())
		this.pendingTouches.clear()
		if (touches.length === 0) return
		const db = await this.getDb()
		if (!db) return
		await this.touchRecords(db, touches)
		touches.forEach(({ key, lastAccessAt }) => this.lastTouchWriteAt.set(key, lastAccessAt))
	}

	private async getDb(): Promise<IDBDatabase | null> {
		if (!isIndexedDbSupported()) return null
		if (this.dbPromise) return this.dbPromise

		this.dbPromise = new Promise((resolve) => {
			const request = indexedDB.open(DB_NAME, DB_VERSION)
			request.onupgradeneeded = (event) => {
				const db = request.result
				const store = db.objectStoreNames.contains(STORE_NAME)
					? request.transaction?.objectStore(STORE_NAME)
					: db.createObjectStore(STORE_NAME, { keyPath: "key" })
				if (!store) return
				if (!store.indexNames.contains(LOOKUP_INDEX)) {
					store.createIndex(LOOKUP_INDEX, LOOKUP_INDEX, { unique: false })
				}
				if (
					(event as IDBVersionChangeEvent).oldVersion < DB_VERSION &&
					store.indexNames.contains(LAST_ACCESS_INDEX)
				) {
					store.deleteIndex(LAST_ACCESS_INDEX)
				}
			}
			request.onsuccess = () => resolve(request.result)
			request.onerror = () => resolve(null)
			request.onblocked = () => resolve(null)
		})
		return this.dbPromise
	}

	private readRecordsByLookupKeys(
		db: IDBDatabase,
		lookupKeys: string[],
	): Promise<Map<string, PersistentImageDisplayCacheRecord[]>> {
		const tx = db.transaction(STORE_NAME, "readonly")
		const index = tx.objectStore(STORE_NAME).index(LOOKUP_INDEX)
		const reads = lookupKeys.map(
			(lookupKey) =>
				new Promise<[string, PersistentImageDisplayCacheRecord[]]>((resolve) => {
					const request = index.getAll(lookupKey)
					request.onsuccess = () =>
						resolve([
							lookupKey,
							(request.result ?? []) as PersistentImageDisplayCacheRecord[],
						])
					request.onerror = () => resolve([lookupKey, []])
				}),
		)
		return Promise.all(reads).then((entries) => new Map(entries))
	}

	/**
	 * Persist a non-readable reservation before CacheStorage is touched. Keeping
	 * older ready rows until commit avoids turning a failed replacement into a miss.
	 */
	private putPendingRecord(
		db: IDBDatabase,
		current: PersistentImageDisplayCacheRecord,
	): Promise<boolean> {
		return new Promise((resolve) => {
			const tx = db.transaction(STORE_NAME, "readwrite")
			const store = tx.objectStore(STORE_NAME)
			const request = store.index(LOOKUP_INDEX).getAll(current.lookupKey)
			let accepted = false
			request.onsuccess = () => {
				const records = (request.result ?? []) as PersistentImageDisplayCacheRecord[]
				const currentWriteOrder = getRecordWriteOrder(current)
				const isStale = records.some(
					(record) =>
						record.key !== current.key &&
						(compareSourceFreshness(record, current) > 0 ||
							(compareSourceFreshness(record, current) === 0 &&
								getRecordWriteOrder(record) > currentWriteOrder)),
				)
				if (isStale) return
				accepted = true
				store.put(current)
			}
			tx.oncomplete = () => resolve(accepted)
			tx.onerror = () => resolve(false)
			tx.onabort = () => resolve(false)
		})
	}

	private async removePendingRecord(
		db: IDBDatabase,
		record: PersistentImageDisplayCacheRecord,
	): Promise<void> {
		const tx = db.transaction(STORE_NAME, "readwrite")
		const store = tx.objectStore(STORE_NAME)
		const request = store.get(record.key)
		request.onsuccess = () => {
			const current = request.result as PersistentImageDisplayCacheRecord | undefined
			if (current?.bodyState === "pending" && current.pendingAt === record.pendingAt) {
				store.delete(record.key)
			}
		}
		await this.awaitTransaction(tx)
	}

	private putLatestRecord(
		db: IDBDatabase,
		current: PersistentImageDisplayCacheRecord,
	): Promise<boolean> {
		return new Promise((resolve) => {
			const tx = db.transaction(STORE_NAME, "readwrite")
			const store = tx.objectStore(STORE_NAME)
			const request = store.index(LOOKUP_INDEX).getAll(current.lookupKey)
			let accepted = false
			const removedBodyKeys: string[] = []
			request.onsuccess = () => {
				const records = (request.result ?? []) as PersistentImageDisplayCacheRecord[]
				const currentWriteOrder = getRecordWriteOrder(current)
				if (
					records.some((record) => compareSourceFreshness(record, current) > 0) ||
					records.some(
						(record) =>
							compareSourceFreshness(record, current) === 0 &&
							getRecordWriteOrder(record) > currentWriteOrder,
					)
				) {
					return
				}

				accepted = true
				// Same ready key with a new bodyCacheKey replaces metadata in place;
				// collect the orphaned body so prune can still reclaim CacheStorage.
				const existingSameKey = records.find((record) => record.key === current.key)
				if (
					existingSameKey?.bodyCacheKey &&
					existingSameKey.bodyCacheKey !== current.bodyCacheKey
				) {
					removedBodyKeys.push(existingSameKey.bodyCacheKey)
				}
				store.put(current)
				const currentIsNewerThanAllExisting = records
					.filter(
						(record) =>
							record.key !== current.key &&
							record.bodyCacheKey !== current.bodyCacheKey,
					)
					.every((record) => compareSourceFreshness(current, record) > 0)
				records.forEach((record) => {
					if (
						record.key !== current.key &&
						(currentIsNewerThanAllExisting ||
							getRecordWriteOrder(record) <= currentWriteOrder)
					) {
						if (record.bodyCacheKey && record.bodyCacheKey !== current.bodyCacheKey) {
							removedBodyKeys.push(record.bodyCacheKey)
						}
						store.delete(record.key)
					}
				})
			}
			tx.oncomplete = () => {
				void Promise.all(
					removedBodyKeys.map((bodyCacheKey) => deleteBodyFromCache(bodyCacheKey)),
				)
					.then(() => resolve(accepted))
					.catch(() => resolve(accepted))
			}
			tx.onerror = () => resolve(false)
			tx.onabort = () => resolve(false)
		})
	}

	private schedulePrune(): void {
		if (this.pruneTimerId !== null) return
		this.pruneTimerId = setTimeout(() => {
			this.pruneTimerId = null
			void this.getDb()
				.then((db) => (db ? this.prune(db) : undefined))
				.catch(() => undefined)
		}, PRUNE_IDLE_DELAY_MS)
	}

	private touchRecords(
		db: IDBDatabase,
		touches: PersistentImageDisplayCacheTouch[],
	): Promise<void> {
		return new Promise((resolve) => {
			const tx = db.transaction(STORE_NAME, "readwrite")
			const store = tx.objectStore(STORE_NAME)
			touches.forEach((accessUpdate) => {
				const request = store.get(accessUpdate.key)
				request.onsuccess = () => {
					const current = request.result as PersistentImageDisplayCacheRecord | undefined
					if (!current) return
					store.put({ ...current, lastAccessAt: accessUpdate.lastAccessAt })
				}
			})
			tx.oncomplete = () => resolve()
			tx.onerror = () => resolve()
			tx.onabort = () => resolve()
		})
	}

	private async prune(db: IDBDatabase): Promise<void> {
		const tx = db.transaction(STORE_NAME, "readwrite")
		const store = tx.objectStore(STORE_NAME)
		const records = await this.readAllRecords(store)
		const now = this.now()
		const expiredRecords = records.filter(
			(record) =>
				!this.activePutLookupCounts.has(record.lookupKey) &&
				(this.isRecordExpired(record, now) ||
					(record.bodyState === "pending" &&
						typeof record.pendingAt === "number" &&
						now - record.pendingAt > PENDING_WRITE_MAX_AGE_MS)),
		)
		const removedBodyKeys = expiredRecords
			.map((record) => record.bodyCacheKey)
			.filter((bodyCacheKey): bodyCacheKey is string => !!bodyCacheKey)
		expiredRecords.forEach((record) => store.delete(record.key))
		const activeRecords = records
			.filter((record) => !this.isRecordExpired(record, now))
			.filter((record) => !expiredRecords.includes(record))
		let totalBytes = activeRecords.reduce((sum, record) => sum + record.byteSize, 0)
		let totalEntries = activeRecords.length
		if (totalBytes <= this.maxBytes && totalEntries <= this.maxEntries) {
			await this.awaitTransaction(tx)
			await Promise.all(
				removedBodyKeys.map((bodyCacheKey) => deleteBodyFromCache(bodyCacheKey)),
			)
			return
		}

		activeRecords.sort((a, b) => a.lastAccessAt - b.lastAccessAt)
		for (const record of activeRecords.filter(
			(record) => !this.activePutLookupCounts.has(record.lookupKey),
		)) {
			if (totalBytes <= this.maxBytes && totalEntries <= this.maxEntries) break
			store.delete(record.key)
			if (record.bodyCacheKey) removedBodyKeys.push(record.bodyCacheKey)
			totalBytes -= record.byteSize
			totalEntries -= 1
		}
		await this.awaitTransaction(tx)
		await Promise.all(removedBodyKeys.map((bodyCacheKey) => deleteBodyFromCache(bodyCacheKey)))
	}

	private readAllRecords(store: IDBObjectStore): Promise<PersistentImageDisplayCacheRecord[]> {
		return new Promise((resolve) => {
			const request = store.getAll()
			request.onsuccess = () =>
				resolve((request.result ?? []) as PersistentImageDisplayCacheRecord[])
			request.onerror = () => resolve([])
		})
	}

	private awaitTransaction(tx: IDBTransaction): Promise<void> {
		return new Promise((resolve) => {
			tx.oncomplete = () => resolve()
			tx.onerror = () => resolve()
			tx.onabort = () => resolve()
		})
	}
}
