import { afterEach, describe, expect, it, vi } from "vitest"
import {
	clearSharedMediaBodyCache,
	MediaResourceBodyCache,
	type MediaResourceBody,
	type MediaResourceBodyCacheEntry,
} from "../offline-cache/MediaResourceBodyCache"
import { SharedAbortableRequest } from "../offline-cache/SharedAbortableRequest"

function createEntry(
	overrides: Partial<MediaResourceBodyCacheEntry> = {},
): MediaResourceBodyCacheEntry {
	return {
		sourceUrl: null,
		resourceVersion: null,
		sourceUpdatedAt: null,
		contentLength: null,
		bodyPromise: null,
		bodyPromiseCacheKey: null,
		bodyBlob: null,
		bodyOssSrc: null,
		bodyCacheKey: null,
		bodyByteSize: 0,
		bodyLastAccessAt: 0,
		...overrides,
	}
}

function createBlob(size: number): Blob {
	return new Blob([new Uint8Array(size)])
}

describe("MediaResourceBodyCache", () => {
	afterEach(() => {
		clearSharedMediaBodyCache()
	})

	it("shares completed bodies across opted-in Canvas caches without cross-owner eviction", () => {
		clearSharedMediaBodyCache()
		const firstCache = new MediaResourceBodyCache({
			ttlMs: 1000,
			maxBytes: 1000,
			shared: true,
		})
		const secondCache = new MediaResourceBodyCache({
			ttlMs: 1000,
			maxBytes: 1000,
			shared: true,
		})
		const firstEntry = createEntry()
		const secondEntry = createEntry()
		const body = {
			blob: createBlob(10),
			ossSrc: "https://oss.test/a.png",
			cacheKey: "shared::v1",
			byteSize: 10,
		}

		firstCache.storeBody(firstEntry, body)
		const reused = secondCache.getReusableBody(secondEntry, body.ossSrc, body.cacheKey)

		expect(reused?.blob).toBe(body.blob)
		expect(secondEntry.bodyBlob).toBe(body.blob)
		firstCache.clearBody(firstEntry)
		expect(secondCache.getReusableBody(secondEntry, body.ossSrc, body.cacheKey)?.blob).toBe(
			body.blob,
		)
		secondCache.clearBody(secondEntry)
		expect(secondCache.getReusableBody(secondEntry, body.ossSrc, body.cacheKey)).toBeNull()
		clearSharedMediaBodyCache()
	})

	it("builds cache keys from stable resource metadata before URL", () => {
		const cache = new MediaResourceBodyCache({ ttlMs: 1000, maxBytes: 1000 })
		const entry = createEntry({
			resourceVersion: "v1",
			sourceUpdatedAt: "updated",
			contentLength: 12,
			sourceUrl: "https://source.test/a.png",
		})

		expect(cache.getCacheKey("./a.png", "https://oss.test/a.png", entry)).toBe("./a.png::v1")

		entry.resourceVersion = null
		expect(cache.getCacheKey("./a.png", "https://oss.test/a.png", entry)).toBe(
			"./a.png::updated",
		)

		entry.sourceUpdatedAt = null
		expect(cache.getCacheKey("./a.png", "https://oss.test/a.png", entry)).toBe("./a.png::12")
	})

	it("counts one shared body once in snapshots even when two Canvas entries reference it", () => {
		const firstCache = new MediaResourceBodyCache({
			ttlMs: 1000,
			maxBytes: 1000,
			shared: true,
		})
		const secondCache = new MediaResourceBodyCache({
			ttlMs: 1000,
			maxBytes: 1000,
			shared: true,
		})
		const firstEntry = createEntry()
		const secondEntry = createEntry()
		const body = {
			blob: createBlob(10),
			ossSrc: "https://oss.test/shared.png",
			cacheKey: "shared::v1",
			byteSize: 10,
		}

		firstCache.storeBody(firstEntry, body)
		secondCache.getReusableBody(secondEntry, body.ossSrc, body.cacheKey)

		expect(firstCache.getSnapshot([firstEntry, secondEntry])).toEqual({
			bodyCacheCount: 1,
			bodyCacheBytes: 10,
			bodyFetchInFlightCount: 0,
		})
	})

	it("rekeys hydrated metadata without duplicating or invalidating a shared body", () => {
		const firstCache = new MediaResourceBodyCache({
			ttlMs: 1000,
			maxBytes: 1000,
			shared: true,
			sharedScope: "scope:rekey",
		})
		const secondCache = new MediaResourceBodyCache({
			ttlMs: 1000,
			maxBytes: 1000,
			shared: true,
			sharedScope: "scope:rekey",
		})
		const firstEntry = createEntry()
		const secondEntry = createEntry()
		const body = {
			blob: createBlob(10),
			ossSrc: "https://oss.test/rekey.png",
			cacheKey: "images/rekey.png::fallback",
			byteSize: 10,
		}

		firstCache.storeBody(firstEntry, body)
		secondCache.getReusableBody(secondEntry, body.ossSrc, body.cacheKey)
		firstCache.rekeyBodyCacheKey(firstEntry, body.cacheKey, "images/rekey.png::resource-v1")

		expect(firstEntry.bodyCacheKey).toBe("images/rekey.png::resource-v1")
		expect(
			firstCache.getReusableBody(firstEntry, body.ossSrc, "images/rekey.png::resource-v1")
				?.blob,
		).toBe(body.blob)
		expect(secondCache.getReusableBody(secondEntry, body.ossSrc, body.cacheKey)?.blob).toBe(
			body.blob,
		)
		expect(firstCache.getSnapshot([firstEntry, secondEntry])).toEqual({
			bodyCacheCount: 1,
			bodyCacheBytes: 10,
			bodyFetchInFlightCount: 0,
		})
	})

	it("does not reuse an identical body key across permission or project scopes", () => {
		const firstCache = new MediaResourceBodyCache({
			ttlMs: 1000,
			maxBytes: 1000,
			shared: true,
			sharedScope: "org:a|user:one/project:one",
		})
		const secondCache = new MediaResourceBodyCache({
			ttlMs: 1000,
			maxBytes: 1000,
			shared: true,
			sharedScope: "org:b|user:two/project:two",
		})
		const firstEntry = createEntry()
		const secondEntry = createEntry()
		const body = {
			blob: createBlob(10),
			ossSrc: "https://oss.test/same-path.png",
			cacheKey: "workspace:/images/same-path.png::v1",
			byteSize: 10,
		}

		firstCache.storeBody(firstEntry, body)

		expect(secondCache.getReusableBody(secondEntry, body.ossSrc, body.cacheKey)).toBeNull()
		expect(secondEntry.bodyBlob).toBeNull()
	})

	it("enforces the shared body budget across Canvas cache instances", () => {
		let now = 0
		const firstCache = new MediaResourceBodyCache({
			ttlMs: 1000,
			maxBytes: 15,
			now: () => now,
			shared: true,
		})
		const secondCache = new MediaResourceBodyCache({
			ttlMs: 1000,
			maxBytes: 15,
			now: () => now,
			shared: true,
		})
		const olderEntry = createEntry()
		const newerEntry = createEntry()
		now = 1
		firstCache.storeBody(olderEntry, {
			blob: createBlob(10),
			ossSrc: "older",
			cacheKey: "older::v1",
			byteSize: 10,
		})
		now = 2
		secondCache.storeBody(newerEntry, {
			blob: createBlob(10),
			ossSrc: "newer",
			cacheKey: "newer::v1",
			byteSize: 10,
		})

		secondCache.evictBudget([newerEntry], newerEntry)

		expect(olderEntry.bodyBlob).toBeNull()
		expect(newerEntry.bodyBlob).not.toBeNull()
		expect(secondCache.getSnapshot([newerEntry])).toEqual({
			bodyCacheCount: 1,
			bodyCacheBytes: 10,
			bodyFetchInFlightCount: 0,
		})
	})

	it("does not retain a body larger than the effective shared budget", () => {
		const cache = new MediaResourceBodyCache({
			ttlMs: 1000,
			maxBytes: 10,
			shared: true,
		})
		const entry = createEntry()

		cache.storeBody(entry, {
			blob: createBlob(11),
			ossSrc: "oversized",
			cacheKey: "oversized::v1",
			byteSize: 11,
		})

		expect(entry.bodyBlob).toBeNull()
		expect(cache.hasBody(entry)).toBe(false)
	})

	it("clears every Canvas owner when a shared body expires", () => {
		let now = 0
		const firstCache = new MediaResourceBodyCache({
			ttlMs: 10,
			maxBytes: 1000,
			now: () => now,
			shared: true,
		})
		const secondCache = new MediaResourceBodyCache({
			ttlMs: 10,
			maxBytes: 1000,
			now: () => now,
			shared: true,
		})
		const firstEntry = createEntry()
		const secondEntry = createEntry()
		const body = {
			blob: createBlob(10),
			ossSrc: "shared",
			cacheKey: "shared::v1",
			byteSize: 10,
		}
		firstCache.storeBody(firstEntry, body)
		secondCache.getReusableBody(secondEntry, body.ossSrc, body.cacheKey)

		now = 11
		expect(secondCache.getReusableBody(secondEntry, body.ossSrc, body.cacheKey)).toBeNull()
		expect(firstEntry.bodyBlob).toBeNull()
		expect(secondEntry.bodyBlob).toBeNull()
	})

	it("returns cached body before ttl and clears expired body", () => {
		let now = 100
		const cache = new MediaResourceBodyCache({ ttlMs: 50, maxBytes: 1000, now: () => now })
		const entry = createEntry()
		const body = {
			blob: createBlob(10),
			ossSrc: "https://oss.test/a.png",
			cacheKey: "a::v1",
			byteSize: 10,
		}

		cache.storeBody(entry, body)
		expect(cache.getReusableBody(entry, "fallback", "a::v1")).toEqual(body)

		now = 200
		expect(cache.getReusableBody(entry, "fallback", "a::v1")).toBeNull()
		expect(cache.hasBody(entry)).toBe(false)
	})

	it("evicts least-recent bodies over budget while preserving the exempt entry", () => {
		const cache = new MediaResourceBodyCache({ ttlMs: 1000, maxBytes: 15 })
		const older = createEntry()
		const newer = createEntry()
		const exempt = createEntry()
		cache.storeBody(older, {
			blob: createBlob(10),
			ossSrc: "older",
			cacheKey: "older",
			byteSize: 10,
		})
		cache.storeBody(newer, {
			blob: createBlob(10),
			ossSrc: "newer",
			cacheKey: "newer",
			byteSize: 10,
		})
		cache.storeBody(exempt, {
			blob: createBlob(10),
			ossSrc: "exempt",
			cacheKey: "exempt",
			byteSize: 10,
		})
		older.bodyLastAccessAt = 1
		newer.bodyLastAccessAt = 2
		exempt.bodyLastAccessAt = 0

		cache.evictBudget([older, newer, exempt], exempt)

		expect(cache.hasBody(older)).toBe(false)
		expect(cache.hasBody(newer)).toBe(false)
		expect(cache.hasBody(exempt)).toBe(true)
		expect(cache.getSnapshot([older, newer, exempt])).toEqual({
			bodyCacheCount: 1,
			bodyCacheBytes: 10,
			bodyFetchInFlightCount: 0,
		})
	})

	it("removes superseded requests from global in-flight tracking", async () => {
		const cache = new MediaResourceBodyCache({ ttlMs: 1000, maxBytes: 1000 })
		const entry = createEntry()
		const previousRequest = new SharedAbortableRequest<MediaResourceBody | null>(
			() => Promise.resolve(null),
			{ abortValue: null },
		)
		const currentRequest = new SharedAbortableRequest<MediaResourceBody | null>(
			(signal) =>
				new Promise((resolve) => {
					if (signal.aborted) {
						resolve(null)
						return
					}
					signal.addEventListener("abort", () => resolve(null), { once: true })
				}),
			{ abortValue: null },
		)
		const previousAbort = vi.spyOn(previousRequest, "abort")
		const currentAbort = vi.spyOn(currentRequest, "abort")

		cache.setInFlight(entry, "old", previousRequest)
		await previousRequest.promise
		cache.setInFlight(entry, "new", currentRequest)
		cache.clearInFlightIfCurrent(entry, previousRequest)
		cache.abortAll()
		await currentRequest.promise

		expect(previousAbort).not.toHaveBeenCalled()
		expect(currentAbort).toHaveBeenCalledOnce()
	})

	it("aborts an active shared request when clearing an entry", async () => {
		const cache = new MediaResourceBodyCache({ ttlMs: 1000, maxBytes: 1000 })
		const entry = createEntry()
		const request = new SharedAbortableRequest<MediaResourceBody | null>(
			(signal) =>
				new Promise((resolve) => {
					if (signal.aborted) {
						resolve(null)
						return
					}
					signal.addEventListener("abort", () => resolve(null), { once: true })
				}),
			{ abortValue: null },
		)
		cache.setInFlight(entry, "active", request)
		const consumer = request.consume()

		cache.clearEntry(entry)

		await expect(consumer).resolves.toBeNull()
		expect(request.isAborted).toBe(true)
		expect(entry.bodyPromise).toBeNull()
	})

	it("replaces an aborted shared request before the old promise settles", () => {
		const firstCache = new MediaResourceBodyCache({
			ttlMs: 1000,
			maxBytes: 1000,
			shared: true,
		})
		const secondCache = new MediaResourceBodyCache({
			ttlMs: 1000,
			maxBytes: 1000,
			shared: true,
		})
		const firstEntry = createEntry()
		const secondEntry = createEntry()
		const staleRequest = new SharedAbortableRequest<MediaResourceBody | null>(
			() => new Promise(() => undefined),
			{ abortValue: null },
		)
		const replacementRequest = new SharedAbortableRequest<MediaResourceBody | null>(
			() => new Promise(() => undefined),
			{ abortValue: null },
		)

		firstCache.setInFlight(firstEntry, "shared::v1", staleRequest)
		staleRequest.abort()
		secondCache.setInFlight(secondEntry, "shared::v1", replacementRequest)

		expect(staleRequest.isAborted).toBe(true)
		expect(replacementRequest.isAborted).toBe(false)
		expect(secondCache.getInFlight(createEntry(), "shared::v1")).toBe(replacementRequest)
	})

	it("releases one Canvas lease without aborting another Canvas consumer", async () => {
		const firstCache = new MediaResourceBodyCache({
			ttlMs: 1000,
			maxBytes: 1000,
			shared: true,
		})
		const secondCache = new MediaResourceBodyCache({
			ttlMs: 1000,
			maxBytes: 1000,
			shared: true,
		})
		const firstEntry = createEntry()
		const secondEntry = createEntry()
		let resolveRequest: ((body: MediaResourceBody) => void) | undefined
		const request = new SharedAbortableRequest<MediaResourceBody | null>(
			() =>
				new Promise((resolve) => {
					resolveRequest = resolve
				}),
			{ abortValue: null },
		)
		firstCache.setInFlight(firstEntry, "shared::v1", request)
		const firstConsumer = request.consume()
		const sharedRequest = secondCache.getInFlight(secondEntry, "shared::v1")
		if (!sharedRequest) throw new Error("Expected shared in-flight request")
		const secondConsumer = sharedRequest.consume()
		await Promise.resolve()

		firstCache.clearEntry(firstEntry)
		expect(request.isAborted).toBe(false)
		expect(firstEntry.bodyPromise).toBeNull()
		expect(secondEntry.bodyPromise).toBe(request)

		const body = {
			blob: createBlob(10),
			ossSrc: "https://oss.test/shared.png",
			cacheKey: "shared::v1",
			byteSize: 10,
		}
		resolveRequest?.(body)
		await expect(firstConsumer).resolves.toEqual(body)
		await expect(secondConsumer).resolves.toEqual(body)
		expect(secondEntry.bodyPromise).toBeNull()
	})

	it("aborts a shared request after the final Canvas owner releases it", () => {
		const cache = new MediaResourceBodyCache({
			ttlMs: 1000,
			maxBytes: 1000,
			shared: true,
		})
		const entry = createEntry()
		const request = new SharedAbortableRequest<MediaResourceBody | null>(
			() => new Promise(() => undefined),
			{ abortValue: null },
		)

		cache.setInFlight(entry, "shared::v1", request)
		cache.clearEntry(entry)

		expect(request.isAborted).toBe(true)
		expect(entry.bodyPromise).toBeNull()
	})
})
