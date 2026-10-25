import { beforeEach, describe, expect, it, vi } from "vitest"
import { IDBFactory } from "fake-indexeddb"
import {
	ImageDisplayVariantPersistentCache,
	type PersistentImageDisplayCacheRecord,
} from "../image/ImageDisplayVariantPersistentCache"

function createRecord(
	lookupKey: string,
	overrides: Partial<PersistentImageDisplayCacheRecord> = {},
): PersistentImageDisplayCacheRecord {
	return {
		key: `record:${lookupKey}`,
		lookupKey,
		scope: "scope-a",
		path: "images/a.png",
		variant: "low",
		rendition: "image-process",
		blob: new Blob(["low"], { type: "image/webp" }),
		mimeType: "image/webp",
		width: 384,
		height: 216,
		byteSize: 3,
		imageInfo: {
			naturalWidth: 1920,
			naturalHeight: 1080,
			fileSize: 3,
			mimeType: "image/png",
			filename: "a.png",
		},
		resourceVersion: "version-a",
		sourceUpdatedAt: null,
		contentLength: 3,
		sourceUrl: null,
		maxEdge: 384,
		codecVersion: 3,
		writeOrder: "0000000000000001:test:00000001",
		createdAt: 1,
		lastAccessAt: 1,
		...overrides,
	}
}

class FakeBodyCache {
	private readonly entries = new Map<string, Response>()

	public async put(key: string, response: Response): Promise<void> {
		this.entries.set(key, response.clone())
	}

	public async match(key: string): Promise<Response | undefined> {
		return this.entries.get(key)?.clone()
	}

	public async delete(key: string): Promise<boolean> {
		return this.entries.delete(key)
	}
}

class FakeBodyCacheStorage {
	private readonly cache = new FakeBodyCache()

	public async open(): Promise<FakeBodyCache> {
		return this.cache
	}
}

describe("ImageDisplayVariantPersistentCache", () => {
	beforeEach(() => {
		vi.unstubAllGlobals()
		vi.stubGlobal("indexedDB", new IDBFactory())
		vi.stubGlobal("caches", new FakeBodyCacheStorage())
	})

	it("stores new low bodies in CacheStorage while IndexedDB keeps metadata", async () => {
		vi.stubGlobal("caches", new FakeBodyCacheStorage())
		const cache = new ImageDisplayVariantPersistentCache({
			maxIdleAgeMs: Number.POSITIVE_INFINITY,
		})
		const imageInfo = createRecord("unused").imageInfo
		await expect(
			cache.put({
				scope: "scope-a",
				path: "images/cache-storage.png",
				variant: "low",
				rendition: "image-process",
				blob: new Blob(["cache-storage"], { type: "image/webp" }),
				imageInfo,
				resourceVersion: "version-a",
				sourceUpdatedAt: null,
				contentLength: 13,
				maxEdge: 384,
				writeOrder: "0000000000000001:test:00000001",
			}),
		).resolves.toBe(true)

		const internals = cache as unknown as {
			getDb: () => Promise<IDBDatabase | null>
		}
		const db = await internals.getDb()
		if (!db) throw new Error("Expected IndexedDB")
		const records = await new Promise<PersistentImageDisplayCacheRecord[]>((resolve) => {
			const request = db
				.transaction("resources", "readonly")
				.objectStore("resources")
				.getAll()
			request.onsuccess = () => resolve(request.result as PersistentImageDisplayCacheRecord[])
		})
		expect(records).toHaveLength(1)
		expect(records[0]?.blob).toBeUndefined()
		expect(records[0]?.bodyCacheKey).toBeTruthy()
		expect(records[0]?.bodyState).toBe("ready")
		expect(records[0]).not.toHaveProperty("mimeType")
		expect(records[0]).not.toHaveProperty("width")
		expect(records[0]).not.toHaveProperty("height")
		expect(records[0]).not.toHaveProperty("sourceUrl")
		expect(records[0]).not.toHaveProperty("maxEdge")
		expect(records[0]).not.toHaveProperty("codecVersion")

		const restored = await cache.getLatest({
			scope: "scope-a",
			path: "images/cache-storage.png",
			variant: "low",
			rendition: "image-process",
		})
		expect(restored?.blob).toBeInstanceOf(Blob)
		expect(restored?.blob.size).toBe(13)
		expect(restored?.blob.type).toBe("image/webp")
		cache.destroy()
	})

	it("keeps the previous ready body readable while a replacement is pending", async () => {
		const bodyCacheStorage = new FakeBodyCacheStorage()
		vi.stubGlobal("caches", bodyCacheStorage)
		const cache = new ImageDisplayVariantPersistentCache({
			maxIdleAgeMs: Number.POSITIVE_INFINITY,
		})
		const baseOptions = {
			scope: "scope-a",
			path: "images/replacement.png",
			variant: "low" as const,
			rendition: "image-process",
			imageInfo: createRecord("unused").imageInfo,
			contentLength: 3,
			maxEdge: 384,
		}
		await cache.put({
			...baseOptions,
			blob: new Blob(["old"], { type: "image/webp" }),
			resourceVersion: "version-1",
			sourceUpdatedAt: "2026-07-21T09:00:00.000Z",
			writeOrder: "0000000000000001:test:00000001",
		})
		const bodyCache = await bodyCacheStorage.open()
		const originalPut = bodyCache.put.bind(bodyCache)
		let releaseBodyPut!: () => void
		const bodyPutGate = new Promise<void>((resolve) => {
			releaseBodyPut = resolve
		})
		const bodyPutSpy = vi
			.spyOn(bodyCache, "put")
			.mockImplementationOnce(async (key, response) => {
				await bodyPutGate
				return originalPut(key, response)
			})
		const replacement = cache.put({
			...baseOptions,
			blob: new Blob(["new"], { type: "image/webp" }),
			resourceVersion: "version-2",
			sourceUpdatedAt: "2026-07-21T10:00:00.000Z",
			writeOrder: "0000000000000002:test:00000002",
		})
		await vi.waitFor(() => expect(bodyPutSpy).toHaveBeenCalledTimes(1))

		const previous = await cache.getLatest({
			scope: "scope-a",
			path: "images/replacement.png",
			variant: "low",
			rendition: "image-process",
		})
		expect(previous?.resourceVersion).toBe("version-1")
		expect(previous?.blob).toBeInstanceOf(Blob)

		releaseBodyPut()
		await expect(replacement).resolves.toBe(true)
		await expect(
			cache.getLatest({
				scope: "scope-a",
				path: "images/replacement.png",
				variant: "low",
				rendition: "image-process",
			}),
		).resolves.toEqual(expect.objectContaining({ resourceVersion: "version-2" }))
		cache.destroy()
	})

	it("removes metadata after confirming a CacheStorage body is missing", async () => {
		vi.stubGlobal("caches", new FakeBodyCacheStorage())
		const cache = new ImageDisplayVariantPersistentCache({
			maxIdleAgeMs: Number.POSITIVE_INFINITY,
		})
		const internals = cache as unknown as {
			getDb: () => Promise<IDBDatabase | null>
		}
		const db = await internals.getDb()
		if (!db) throw new Error("Expected IndexedDB")
		const lookupKey = JSON.stringify(["scope-a", "image-process", "images/missing.png", "low"])
		const record = createRecord(lookupKey, {
			key: "record:missing-body",
			path: "images/missing.png",
			bodyCacheKey: "https://canvas-design-image.invalid/body/missing-body",
			blob: undefined,
		})
		await new Promise<void>((resolve, reject) => {
			const tx = db.transaction("resources", "readwrite")
			tx.objectStore("resources").put(record)
			tx.oncomplete = () => resolve()
			tx.onerror = () => reject(tx.error)
			tx.onabort = () => reject(tx.error)
		})

		await expect(
			cache.getLatest({
				scope: "scope-a",
				path: "images/missing.png",
				variant: "low",
				rendition: "image-process",
			}),
		).resolves.toBeNull()

		await new Promise((resolve) => setTimeout(resolve, 0))
		const remaining = await new Promise<PersistentImageDisplayCacheRecord[]>((resolve) => {
			const request = db
				.transaction("resources", "readonly")
				.objectStore("resources")
				.getAll()
			request.onsuccess = () => resolve(request.result as PersistentImageDisplayCacheRecord[])
		})
		expect(remaining).toEqual([])
		cache.destroy()
	})

	it("keeps metadata when CacheStorage is unavailable", async () => {
		vi.stubGlobal("caches", undefined)
		const cache = new ImageDisplayVariantPersistentCache({
			maxIdleAgeMs: Number.POSITIVE_INFINITY,
		})
		const internals = cache as unknown as {
			getDb: () => Promise<IDBDatabase | null>
		}
		const db = await internals.getDb()
		if (!db) throw new Error("Expected IndexedDB")
		const lookupKey = JSON.stringify([
			"scope-a",
			"image-process",
			"images/unavailable.png",
			"low",
		])
		const record = createRecord(lookupKey, {
			key: "record:unavailable-body",
			path: "images/unavailable.png",
			bodyCacheKey: "https://canvas-design-image.invalid/body/unavailable-body",
			blob: undefined,
		})
		await new Promise<void>((resolve, reject) => {
			const tx = db.transaction("resources", "readwrite")
			tx.objectStore("resources").put(record)
			tx.oncomplete = () => resolve()
			tx.onerror = () => reject(tx.error)
			tx.onabort = () => reject(tx.error)
		})

		await expect(
			cache.getLatest({
				scope: "scope-a",
				path: "images/unavailable.png",
				variant: "low",
				rendition: "image-process",
			}),
		).resolves.toBeNull()

		const remaining = await new Promise<PersistentImageDisplayCacheRecord[]>((resolve) => {
			const request = db
				.transaction("resources", "readonly")
				.objectStore("resources")
				.getAll()
			request.onsuccess = () => resolve(request.result as PersistentImageDisplayCacheRecord[])
		})
		expect(remaining).toEqual([expect.objectContaining({ key: record.key })])
		cache.destroy()
	})

	it("does not create metadata or an IndexedDB Blob when CacheStorage is unavailable", async () => {
		vi.stubGlobal("caches", undefined)
		const cache = new ImageDisplayVariantPersistentCache({
			maxIdleAgeMs: Number.POSITIVE_INFINITY,
		})
		const internals = cache as unknown as {
			getDb: () => Promise<IDBDatabase | null>
		}
		await expect(
			cache.put({
				scope: "scope-a",
				path: "images/no-cache-storage.png",
				variant: "low",
				rendition: "image-process",
				blob: new Blob(["low"], { type: "image/webp" }),
				imageInfo: createRecord("unused").imageInfo,
				resourceVersion: "version-a",
				sourceUpdatedAt: null,
				contentLength: 3,
				maxEdge: 384,
				writeOrder: "0000000000000001:test:00000001",
			}),
		).resolves.toBe(false)
		const db = await internals.getDb()
		if (!db) throw new Error("Expected IndexedDB")
		const records = await new Promise<PersistentImageDisplayCacheRecord[]>((resolve) => {
			const request = db
				.transaction("resources", "readonly")
				.objectStore("resources")
				.getAll()
			request.onsuccess = () => resolve(request.result as PersistentImageDisplayCacheRecord[])
		})
		expect(records).toEqual([])
		cache.destroy()
	})

	it("coalesces same-tick low reads without immediate access writes", async () => {
		const cache = new ImageDisplayVariantPersistentCache({ now: () => 10 })
		const internals = cache as unknown as {
			getDb: ReturnType<typeof vi.fn>
			readRecordsByLookupKeys: ReturnType<typeof vi.fn>
			touchRecords: ReturnType<typeof vi.fn>
		}
		internals.getDb = vi.fn(async () => ({}) as IDBDatabase)
		internals.readRecordsByLookupKeys = vi.fn(async (_db, lookupKeys: string[]) => {
			return new Map(lookupKeys.map((lookupKey) => [lookupKey, [createRecord(lookupKey)]]))
		})
		internals.touchRecords = vi.fn(async () => undefined)

		const results = await Promise.all(
			Array.from({ length: 100 }, (_, index) =>
				cache.getLatest({
					scope: "scope-a",
					path: `images/${index}.png`,
					variant: "low",
					rendition: "image-process",
				}),
			),
		)

		expect(results).toHaveLength(100)
		expect(internals.readRecordsByLookupKeys).toHaveBeenCalledTimes(1)
		expect(internals.readRecordsByLookupKeys.mock.calls[0]?.[1]).toHaveLength(100)
		expect(internals.touchRecords).not.toHaveBeenCalled()
	})

	it("returns low restore without waiting for access writeback", async () => {
		const cache = new ImageDisplayVariantPersistentCache({ now: () => 20 })
		const internals = cache as unknown as {
			getDb: ReturnType<typeof vi.fn>
			readRecordsByLookupKeys: ReturnType<typeof vi.fn>
			touchRecords: ReturnType<typeof vi.fn>
		}
		internals.getDb = vi.fn(async () => ({}) as IDBDatabase)
		internals.readRecordsByLookupKeys = vi.fn(async (_db, lookupKeys: string[]) => {
			const lookupKey = lookupKeys[0] ?? ""
			return new Map([[lookupKey, [createRecord(lookupKey)]]])
		})
		internals.touchRecords = vi.fn(async () => undefined)

		const record = await cache.getLatest({
			scope: "scope-a",
			path: "images/a.png",
			variant: "low",
			rendition: "image-process",
		})

		expect(record?.lastAccessAt).toBe(20)
		expect(internals.touchRecords).not.toHaveBeenCalled()
	})

	it("treats idle low blobs as expired and removes them during the next prune", async () => {
		let now = 0
		const cache = new ImageDisplayVariantPersistentCache({
			now: () => now,
			maxIdleAgeMs: 50,
		})
		await cache.put({
			scope: "scope-a",
			path: "images/idle.png",
			variant: "low",
			rendition: "image-process",
			blob: new Blob(["low"], { type: "image/webp" }),
			imageInfo: createRecord("unused").imageInfo,
			resourceVersion: "version-a",
			sourceUpdatedAt: null,
			contentLength: 3,
			maxEdge: 384,
			writeOrder: "0000000000000001:test:00000001",
		})

		now = 100
		await expect(
			cache.getLatest({
				scope: "scope-a",
				path: "images/idle.png",
				variant: "low",
				rendition: "image-process",
			}),
		).resolves.toBeNull()

		const internals = cache as unknown as {
			getDb: () => Promise<IDBDatabase | null>
			prune: (db: IDBDatabase) => Promise<void>
		}
		const db = await internals.getDb()
		if (!db) throw new Error("Expected IndexedDB")
		await internals.prune(db)
		await expect(
			cache.getLatest({
				scope: "scope-a",
				path: "images/idle.png",
				variant: "low",
				rendition: "image-process",
			}),
		).resolves.toBeNull()
		cache.destroy()
	})

	it("ignores pending rows and removes them after the one-hour write window", async () => {
		let now = 0
		const bodyCacheStorage = new FakeBodyCacheStorage()
		vi.stubGlobal("caches", bodyCacheStorage)
		const cache = new ImageDisplayVariantPersistentCache({
			now: () => now,
			maxIdleAgeMs: Number.POSITIVE_INFINITY,
		})
		const internals = cache as unknown as {
			getDb: () => Promise<IDBDatabase | null>
			prune: (db: IDBDatabase) => Promise<void>
		}
		const db = await internals.getDb()
		if (!db) throw new Error("Expected IndexedDB")
		const lookupKey = JSON.stringify(["scope-a", "image-process", "images/pending.png", "low"])
		const record = createRecord(lookupKey, {
			key: "record:pending",
			path: "images/pending.png",
			blob: undefined,
			bodyCacheKey: "https://canvas-design-image.invalid/body/pending",
			bodyState: "pending",
			pendingAt: 0,
		})
		await new Promise<void>((resolve, reject) => {
			const tx = db.transaction("resources", "readwrite")
			tx.objectStore("resources").put(record)
			tx.oncomplete = () => resolve()
			tx.onerror = () => reject(tx.error)
		})

		await expect(
			cache.getLatest({
				scope: "scope-a",
				path: "images/pending.png",
				variant: "low",
				rendition: "image-process",
			}),
		).resolves.toBeNull()
		now = 60 * 60 * 1000 + 1
		await internals.prune(db)
		const remaining = await new Promise<PersistentImageDisplayCacheRecord[]>((resolve) => {
			const request = db
				.transaction("resources", "readonly")
				.objectStore("resources")
				.getAll()
			request.onsuccess = () => resolve(request.result as PersistentImageDisplayCacheRecord[])
		})
		expect(remaining).toEqual([])
		cache.destroy()
	})

	it("evicts the least-recently-used low row when the entry cap is exceeded", async () => {
		let now = 0
		const cache = new ImageDisplayVariantPersistentCache({
			now: () => ++now,
			maxEntries: 2,
			maxBytes: Number.POSITIVE_INFINITY,
			maxIdleAgeMs: Number.POSITIVE_INFINITY,
		})
		const imageInfo = createRecord("unused").imageInfo
		for (const [index, path] of [
			"images/old.png",
			"images/middle.png",
			"images/new.png",
		].entries()) {
			await cache.put({
				scope: "scope-a",
				path,
				variant: "low",
				rendition: "image-process",
				blob: new Blob([path], { type: "image/webp" }),
				imageInfo,
				resourceVersion: `version-${index}`,
				sourceUpdatedAt: null,
				contentLength: path.length,
				maxEdge: 384,
				writeOrder: `000000000000000${index}:test:0000000${index}`,
			})
		}
		const internals = cache as unknown as {
			getDb: () => Promise<IDBDatabase | null>
			prune: (db: IDBDatabase) => Promise<void>
		}
		const db = await internals.getDb()
		if (!db) throw new Error("Expected IndexedDB")
		await internals.prune(db)

		await expect(
			cache.getLatest({
				scope: "scope-a",
				path: "images/old.png",
				variant: "low",
				rendition: "image-process",
			}),
		).resolves.toBeNull()
		await expect(
			cache.getLatest({
				scope: "scope-a",
				path: "images/new.png",
				variant: "low",
				rendition: "image-process",
			}),
		).resolves.toEqual(expect.objectContaining({ resourceVersion: "version-2" }))
		cache.destroy()
	})

	it("writes access time only after the 24-hour interval", async () => {
		vi.useFakeTimers()
		try {
			const cache = new ImageDisplayVariantPersistentCache({
				now: () => 24 * 60 * 60 * 1000 + 20,
			})
			const internals = cache as unknown as {
				getDb: ReturnType<typeof vi.fn>
				readRecordsByLookupKeys: ReturnType<typeof vi.fn>
				touchRecords: ReturnType<typeof vi.fn>
				flushPendingTouches: () => Promise<void>
			}
			internals.getDb = vi.fn(async () => ({}) as IDBDatabase)
			internals.readRecordsByLookupKeys = vi.fn(async (_db, lookupKeys: string[]) => {
				const lookupKey = lookupKeys[0] ?? ""
				return new Map([[lookupKey, [createRecord(lookupKey, { lastAccessAt: 1 })]]])
			})
			internals.touchRecords = vi.fn(async () => undefined)

			await cache.getLatest({
				scope: "scope-a",
				path: "images/a.png",
				variant: "low",
				rendition: "image-process",
			})
			expect(internals.touchRecords).not.toHaveBeenCalled()
			await vi.advanceTimersByTimeAsync(1000)
			await internals.flushPendingTouches()
			expect(internals.touchRecords).toHaveBeenCalledTimes(1)
		} finally {
			vi.useRealTimers()
		}
	})

	it("removes the access index during v4 upgrade without deleting blobs", async () => {
		const lookupKey = JSON.stringify(["scope-a", "image-process", "images/a.png", "low"])
		const oldDbRequest = indexedDB.open("canvas-design-image-display-variant-cache-v1", 3)
		const oldDb = await new Promise<IDBDatabase>((resolve, reject) => {
			oldDbRequest.onupgradeneeded = () => {
				const store = oldDbRequest.result.createObjectStore("resources", { keyPath: "key" })
				store.createIndex("lookupKey", "lookupKey", { unique: false })
				store.createIndex("lastAccessAt", "lastAccessAt", { unique: false })
			}
			oldDbRequest.onsuccess = () => resolve(oldDbRequest.result)
			oldDbRequest.onerror = () => reject(oldDbRequest.error)
		})
		const transaction = oldDb.transaction("resources", "readwrite")
		const store = transaction.objectStore("resources")
		await new Promise<void>((resolve, reject) => {
			const request = store.put(createRecord(lookupKey))
			request.onsuccess = () => undefined
			request.onerror = () => reject(request.error)
			transaction.oncomplete = () => resolve()
			transaction.onerror = () => reject(transaction.error)
		})
		oldDb.close()
		const verifyDb = await new Promise<IDBDatabase>((resolve, reject) => {
			const request = indexedDB.open("canvas-design-image-display-variant-cache-v1", 3)
			request.onsuccess = () => resolve(request.result)
			request.onerror = () => reject(request.error)
		})
		const raw = await new Promise<unknown>((resolve, reject) => {
			const request = verifyDb
				.transaction("resources", "readonly")
				.objectStore("resources")
				.get(`record:${lookupKey}`)
			request.onsuccess = () => resolve(request.result)
			request.onerror = () => reject(request.error)
		})
		expect(raw).toBeTruthy()
		verifyDb.close()

		const cache = new ImageDisplayVariantPersistentCache({
			maxIdleAgeMs: Number.POSITIVE_INFINITY,
		})
		const record = await cache.getLatest({
			scope: "scope-a",
			path: "images/a.png",
			variant: "low",
			rendition: "image-process",
		})
		expect(record?.byteSize).toBe(3)
		const upgraded = await new Promise<IDBDatabase>((resolve, reject) => {
			const request = indexedDB.open("canvas-design-image-display-variant-cache-v1")
			request.onsuccess = () => resolve(request.result)
			request.onerror = () => reject(request.error)
		})
		const upgradedStore = upgraded.transaction("resources", "readonly").objectStore("resources")
		expect([...upgradedStore.indexNames]).toEqual(["lookupKey"])
		upgraded.close()
	})

	it("coalesces low cache pruning after a write burst", async () => {
		vi.useFakeTimers()
		try {
			const cache = new ImageDisplayVariantPersistentCache()
			const internals = cache as unknown as {
				getDb: ReturnType<typeof vi.fn>
				putPendingRecord: ReturnType<typeof vi.fn>
				putLatestRecord: ReturnType<typeof vi.fn>
				prune: ReturnType<typeof vi.fn>
			}
			internals.getDb = vi.fn(async () => ({}) as IDBDatabase)
			internals.putPendingRecord = vi.fn(async () => true)
			internals.putLatestRecord = vi.fn(async () => true)
			internals.prune = vi.fn(async () => undefined)
			const options = {
				scope: "scope-a",
				path: "images/a.png",
				variant: "low" as const,
				rendition: "image-process",
				blob: new Blob(["low"], { type: "image/webp" }),
				imageInfo: createRecord("unused").imageInfo,
				resourceVersion: "version-a",
				sourceUpdatedAt: null,
				contentLength: 3,
				maxEdge: 384,
			}

			await Promise.all([
				cache.put({ ...options, writeOrder: "0000000000000001:test:00000001" }),
				cache.put({ ...options, writeOrder: "0000000000000002:test:00000002" }),
			])

			expect(internals.prune).not.toHaveBeenCalled()
			await vi.advanceTimersByTimeAsync(1000)
			expect(internals.prune).toHaveBeenCalledTimes(1)
		} finally {
			vi.useRealTimers()
		}
	})

	it("returns whether the low write was accepted", async () => {
		const cache = new ImageDisplayVariantPersistentCache({
			maxIdleAgeMs: Number.POSITIVE_INFINITY,
		})
		const internals = cache as unknown as {
			getDb: ReturnType<typeof vi.fn>
			putPendingRecord: ReturnType<typeof vi.fn>
			putLatestRecord: ReturnType<typeof vi.fn>
			removePendingRecord: ReturnType<typeof vi.fn>
		}
		internals.getDb = vi.fn(async () => ({}) as IDBDatabase)
		internals.putPendingRecord = vi.fn(async () => true)
		internals.putLatestRecord = vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false)
		internals.removePendingRecord = vi.fn(async () => undefined)
		const options = {
			scope: "scope-a",
			path: "images/a.png",
			variant: "low" as const,
			rendition: "image-process",
			blob: new Blob(["low"], { type: "image/webp" }),
			imageInfo: createRecord("unused").imageInfo,
			resourceVersion: "version-a",
			sourceUpdatedAt: null,
			contentLength: 3,
			maxEdge: 384,
		}

		await expect(
			cache.put({ ...options, writeOrder: "0000000000000001:test:00000001" }),
		).resolves.toBe(true)
		await expect(
			cache.put({ ...options, writeOrder: "0000000000000000:test:00000000" }),
		).resolves.toBe(false)
	})

	it("keeps identical paths isolated by persistent resource scope", async () => {
		const cache = new ImageDisplayVariantPersistentCache({
			maxIdleAgeMs: Number.POSITIVE_INFINITY,
		})
		const internals = cache as unknown as {
			getDb: ReturnType<typeof vi.fn>
			readRecordsByLookupKeys: ReturnType<typeof vi.fn>
			touchRecords: ReturnType<typeof vi.fn>
		}
		internals.getDb = vi.fn(async () => ({}) as IDBDatabase)
		internals.readRecordsByLookupKeys = vi.fn(async (_db, lookupKeys: string[]) => {
			return new Map(
				lookupKeys.map((lookupKey, index) => [
					lookupKey,
					[
						createRecord(lookupKey, {
							scope: index === 0 ? "scope-a" : "scope-b",
							resourceVersion: index === 0 ? "version-a" : "version-b",
						}),
					],
				]),
			)
		})
		internals.touchRecords = vi.fn(async () => undefined)

		const [recordA, recordB] = await Promise.all([
			cache.getLatest({
				scope: "scope-a",
				path: "images/shared.png",
				variant: "low",
				rendition: "image-process",
			}),
			cache.getLatest({
				scope: "scope-b",
				path: "images/shared.png",
				variant: "low",
				rendition: "image-process",
			}),
		])

		expect(recordA?.resourceVersion).toBe("version-a")
		expect(recordB?.resourceVersion).toBe("version-b")
	})

	it("returns only the requested version while preserving an older stale fallback", async () => {
		const cache = new ImageDisplayVariantPersistentCache()
		const baseOptions = {
			scope: "scope-a",
			path: "images/versioned.png",
			variant: "low" as const,
			rendition: "image-process",
			imageInfo: createRecord("unused").imageInfo,
			sourceUpdatedAt: null,
			contentLength: 3,
			maxEdge: 384,
		}

		await cache.put({
			...baseOptions,
			blob: new Blob(["v1"], { type: "image/webp" }),
			resourceVersion: "version-1",
			writeOrder: "0000000000000001:test:00000001",
		})

		await expect(
			cache.getLatest({
				scope: "scope-a",
				path: "images/versioned.png",
				variant: "low",
				rendition: "image-process",
				resourceVersion: "version-2",
			}),
		).resolves.toBeNull()
		await expect(
			cache.getLatest({
				scope: "scope-a",
				path: "images/versioned.png",
				variant: "low",
				rendition: "image-process",
			}),
		).resolves.toEqual(expect.objectContaining({ resourceVersion: "version-1" }))

		await cache.put({
			...baseOptions,
			blob: new Blob(["v2"], { type: "image/webp" }),
			resourceVersion: "version-2",
			writeOrder: "0000000000000002:test:00000002",
		})

		await expect(
			cache.getLatest({
				scope: "scope-a",
				path: "images/versioned.png",
				variant: "low",
				rendition: "image-process",
				resourceVersion: "version-2",
			}),
		).resolves.toEqual(expect.objectContaining({ resourceVersion: "version-2" }))
		await expect(
			cache.getLatest({
				scope: "scope-a",
				path: "images/versioned.png",
				variant: "low",
				rendition: "image-process",
				resourceVersion: "version-1",
			}),
		).resolves.toBeNull()
	})

	it("does not recreate a removed version when a delayed access touch runs", async () => {
		const cache = new ImageDisplayVariantPersistentCache()
		await cache.put({
			scope: "scope-a",
			path: "images/a.png",
			variant: "low",
			rendition: "image-process",
			blob: new Blob(["low"], { type: "image/webp" }),
			imageInfo: createRecord("unused").imageInfo,
			resourceVersion: "version-a",
			sourceUpdatedAt: null,
			contentLength: 3,
			maxEdge: 384,
			writeOrder: "0000000000000001:test:00000001",
		})
		const internals = cache as unknown as {
			getDb: () => Promise<IDBDatabase | null>
			touchRecords: (
				db: IDBDatabase,
				touches: Array<{ key: string; lastAccessAt: number }>,
			) => Promise<void>
		}
		const db = await internals.getDb()
		if (!db) throw new Error("Expected IndexedDB")
		const key = [
			"canvas-display-image",
			"v4",
			encodeURIComponent("scope-a"),
			encodeURIComponent("image-process"),
			encodeURIComponent("images/a.png"),
			"low",
			encodeURIComponent("version-a"),
			384,
			encodeURIComponent("0000000000000001:test:00000001"),
			"codec3",
		].join(":")

		await cache.removeVersion("scope-a", "images/a.png", "image-process", "version-a")
		await internals.touchRecords(db, [{ key, lastAccessAt: 100 }])

		await expect(
			cache.getLatest({
				scope: "scope-a",
				path: "images/a.png",
				variant: "low",
				rendition: "image-process",
			}),
		).resolves.toBeNull()
	})

	it("keeps a newer write when an older generation finishes late", async () => {
		const cache = new ImageDisplayVariantPersistentCache()
		const baseOptions = {
			scope: "scope-a",
			path: "images/race.png",
			variant: "low" as const,
			rendition: "image-process",
			imageInfo: createRecord("unused").imageInfo,
			resourceVersion: "version-a",
			sourceUpdatedAt: null,
			contentLength: 3,
			maxEdge: 384,
		}

		await cache.put({
			...baseOptions,
			blob: new Blob(["new"], { type: "image/webp" }),
			writeOrder: "0000000000000002:test:00000002",
		})
		await cache.put({
			...baseOptions,
			blob: new Blob(["old"], { type: "image/webp" }),
			writeOrder: "0000000000000001:test:00000001",
		})

		const latest = await cache.getLatest({
			scope: "scope-a",
			path: "images/race.png",
			variant: "low",
			rendition: "image-process",
		})

		expect(latest?.writeOrder).toBe("0000000000000002:test:00000002")

		await cache.removeWriteOrder(
			"scope-a",
			"images/race.png",
			"image-process",
			"version-a",
			"0000000000000002:test:00000002",
		)
		await expect(
			cache.getLatest({
				scope: "scope-a",
				path: "images/race.png",
				variant: "low",
				rendition: "image-process",
			}),
		).resolves.toBeNull()
	})

	it("does not let an older source timestamp overwrite a newer resource version", async () => {
		const cache = new ImageDisplayVariantPersistentCache()
		const baseOptions = {
			scope: "scope-a",
			path: "images/replaced.png",
			variant: "low" as const,
			rendition: "image-process",
			imageInfo: createRecord("unused").imageInfo,
			contentLength: 3,
			maxEdge: 384,
		}

		await cache.put({
			...baseOptions,
			blob: new Blob(["new"], { type: "image/webp" }),
			resourceVersion: "version-2",
			sourceUpdatedAt: "2026-07-21T10:00:00.000Z",
			writeOrder: "0000000000000001:test:00000001",
		})
		await expect(
			cache.put({
				...baseOptions,
				blob: new Blob(["old"], { type: "image/webp" }),
				resourceVersion: "version-1",
				sourceUpdatedAt: "2026-07-21T09:00:00.000Z",
				writeOrder: "0000000000000002:test:00000002",
			}),
		).resolves.toBe(false)

		await expect(
			cache.getLatest({
				scope: "scope-a",
				path: "images/replaced.png",
				variant: "low",
				rendition: "image-process",
			}),
		).resolves.toEqual(expect.objectContaining({ resourceVersion: "version-2" }))
	})

	it("accepts a newer source timestamp even when its write order is lower", async () => {
		const cache = new ImageDisplayVariantPersistentCache()
		const baseOptions = {
			scope: "scope-a",
			path: "images/delayed-new-version.png",
			variant: "low" as const,
			rendition: "image-process",
			imageInfo: createRecord("unused").imageInfo,
			contentLength: 3,
			maxEdge: 384,
		}

		await cache.put({
			...baseOptions,
			blob: new Blob(["old"], { type: "image/webp" }),
			resourceVersion: "version-1",
			sourceUpdatedAt: "2026-07-21T09:00:00.000Z",
			writeOrder: "0000000000000002:test:00000002",
		})
		await expect(
			cache.put({
				...baseOptions,
				blob: new Blob(["new"], { type: "image/webp" }),
				resourceVersion: "version-2",
				sourceUpdatedAt: "2026-07-21T10:00:00.000Z",
				writeOrder: "0000000000000001:test:00000001",
			}),
		).resolves.toBe(true)

		await expect(
			cache.getLatest({
				scope: "scope-a",
				path: "images/delayed-new-version.png",
				variant: "low",
				rendition: "image-process",
			}),
		).resolves.toEqual(expect.objectContaining({ resourceVersion: "version-2" }))
	})

	it("does not delete a same-version write created after invalidation", async () => {
		const cache = new ImageDisplayVariantPersistentCache()
		const baseOptions = {
			scope: "scope-a",
			path: "images/race.png",
			variant: "low" as const,
			rendition: "image-process",
			imageInfo: createRecord("unused").imageInfo,
			resourceVersion: "version-a",
			sourceUpdatedAt: null,
			contentLength: 3,
			maxEdge: 384,
		}

		await cache.put({
			...baseOptions,
			blob: new Blob(["old"], { type: "image/webp" }),
			writeOrder: "0000000000000001:test:00000001",
		})
		await cache.put({
			...baseOptions,
			blob: new Blob(["new"], { type: "image/webp" }),
			writeOrder: "0000000000000003:test:00000003",
		})
		await cache.removeVersion(
			"scope-a",
			"images/race.png",
			"image-process",
			"version-a",
			"0000000000000002:test:00000002",
		)

		const latest = await cache.getLatest({
			scope: "scope-a",
			path: "images/race.png",
			variant: "low",
			rendition: "image-process",
		})

		expect(latest?.writeOrder).toBe("0000000000000003:test:00000003")
	})
})
