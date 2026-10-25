// @vitest-environment jsdom
import { IDBFactory, IDBKeyRange } from "fake-indexeddb"
import { afterEach, describe, expect, it, vi } from "vitest"
import { measureValueBytes, StorageTop10Collector } from "../sizeMeasurementCore"
import { measureStorageSizes } from "../sizeMeasurement"
import { measureStorageSizesInContext, StorageSizeScanner } from "../sizeMeasurementScanner"

afterEach(() => {
	vi.useRealTimers()
	vi.restoreAllMocks()
	vi.unstubAllGlobals()
})

/** Create one fake IndexedDB database with deterministic stores and values. */
async function createDatabase(name: string, stores: Record<string, unknown[]>): Promise<void> {
	await new Promise<void>((resolve, reject) => {
		const request = indexedDB.open(name, 1)
		request.onupgradeneeded = () => {
			for (const storeName of Object.keys(stores)) request.result.createObjectStore(storeName)
		}
		request.onerror = () => reject(request.error)
		request.onsuccess = () => {
			const database = request.result
			const transaction = database.transaction(Object.keys(stores), "readwrite")
			for (const [storeName, values] of Object.entries(stores)) {
				values.forEach((value, index) =>
					transaction.objectStore(storeName).put(value, index),
				)
			}
			transaction.onerror = () => reject(transaction.error)
			transaction.oncomplete = () => {
				database.close()
				resolve()
			}
		}
	})
}

/** Install a CacheStorage-like implementation whose Response bodies are real byte arrays. */
function stubCaches(buckets: Record<string, number[]>): void {
	vi.stubGlobal("caches", {
		keys: async () => Object.keys(buckets),
		open: async (name: string) => ({
			keys: async () =>
				(buckets[name] ?? []).map(
					(_, index) => new Request(`https://example.test/${name}/${index}`),
				),
			match: async (request: Request) => {
				const index = Number(new URL(request.url).pathname.split("/").at(-1))
				const size = buckets[name]?.[index]
				return size === undefined ? undefined : new Response(new Uint8Array(size))
			},
		}),
	})
}

describe("measureValueBytes", () => {
	it("uses JSON UTF-8 framing for ordinary structured values", () => {
		const value = { label: "你好", escaped: 'a"\\\n' }
		expect(measureValueBytes(value)).toBe(
			new TextEncoder().encode(JSON.stringify(value)).byteLength,
		)
	})

	it("measures Blob, ArrayBuffer and typed arrays without reading Blob bodies", () => {
		expect(measureValueBytes(new Blob([new Uint8Array(7)]))).toBe(7)
		expect(measureValueBytes(new ArrayBuffer(5))).toBe(5)
		expect(measureValueBytes(new Uint16Array(3))).toBe(6)
	})

	it("returns undefined for cycles and unsupported executable values", () => {
		const cyclic: Record<string, unknown> = {}
		cyclic.self = cyclic
		expect(measureValueBytes(cyclic)).toBeUndefined()
		expect(measureValueBytes(() => undefined)).toBeUndefined()
	})
})

describe("StorageTop10Collector", () => {
	it("keeps ten largest entries with deterministic tie ordering", () => {
		const collector = new StorageTop10Collector()
		for (let index = 0; index < 12; index += 1) {
			collector.add({
				storageType: index % 2 ? "indexedDB" : "cacheStorage",
				container: `container-${String(index).padStart(2, "0")}`,
				sizeBytes: index < 2 ? 100 : index,
			})
		}
		const result = collector.values()
		expect(result).toHaveLength(10)
		expect(result.slice(0, 2)).toEqual([
			{ storageType: "cacheStorage", container: "container-00", sizeBytes: 100 },
			{ storageType: "indexedDB", container: "container-01", sizeBytes: 100 },
		])
		expect(result.at(-1)?.sizeBytes).toBe(4)
	})
})

describe("measureStorageSizesInContext", () => {
	it("sums multiple IDB stores and Cache buckets and merges their Top10", async () => {
		vi.stubGlobal("indexedDB", new IDBFactory())
		vi.stubGlobal("IDBKeyRange", IDBKeyRange)
		await createDatabase("db-alpha", {
			// fake-indexeddb cannot structured-clone jsdom Blob; the Blob byte path is covered above.
			"store-a": ["123456789", new Uint8Array(7)],
			"store-b": [{ bytes: new ArrayBuffer(5), label: "x" }],
		})
		await createDatabase("db-beta", {
			"store-c": ["data"],
		})
		stubCaches({ "cache-a": [11, 3], "cache-b": [13] })
		const yieldControl = vi.fn(async () => undefined)
		const result = await measureStorageSizesInContext({
			budgetMs: 10_000,
			batchEntries: 1,
			batchDurationMs: Number.POSITIVE_INFINITY,
			yieldControl,
		})
		expect(result.indexedDBContentBytes).toBe(11 + 7 + 27 + 6)
		expect(result.cacheStorageContentBytes).toBe(27)
		expect(result.top10.slice(0, 3).map((item) => item.sizeBytes)).toEqual([27, 13, 11])
		expect(result.top10).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					storageType: "indexedDB",
					container: "db-alpha/store-a",
				}),
				expect.objectContaining({ storageType: "cacheStorage", container: "cache-b" }),
			]),
		)
		expect(JSON.stringify(result.top10)).not.toContain("example.test")
		expect(yieldControl).toHaveBeenCalled()
	})

	it("excludes the known stream-record database from byte and Top10 measurements", async () => {
		vi.stubGlobal("indexedDB", new IDBFactory())
		vi.stubGlobal("IDBKeyRange", IDBKeyRange)
		await createDatabase("MAGIC:stream-record-db", { topic: ["ignored-stream-data"] })
		await createDatabase("db-alpha", { records: ["kept-data"] })
		stubCaches({})

		const result = await measureStorageSizesInContext({ budgetMs: 10_000 })

		expect(result.indexedDBContentBytes).toBe(measureValueBytes("kept-data"))
		expect(result.top10).toEqual([
			expect.objectContaining({ storageType: "indexedDB", container: "db-alpha/records" }),
		])
		expect(JSON.stringify(result.top10)).not.toContain("stream-record-db")
	})

	it("fails the whole enrichment when its budget expires", async () => {
		vi.stubGlobal("indexedDB", new IDBFactory())
		vi.stubGlobal("IDBKeyRange", IDBKeyRange)
		stubCaches({})
		let now = 0
		await expect(
			measureStorageSizesInContext({ budgetMs: 1, now: () => (now += 2) }),
		).rejects.toMatchObject({ reason: "timeout" })
	})

	it("invalidates the complete measurement when one IDB value cannot be measured", async () => {
		vi.stubGlobal("indexedDB", new IDBFactory())
		vi.stubGlobal("IDBKeyRange", IDBKeyRange)
		const cyclic: Record<string, unknown> = {}
		cyclic.self = cyclic
		await createDatabase("db-cyclic", { records: [cyclic] })
		stubCaches({})
		await expect(measureStorageSizesInContext({ budgetMs: 10_000 })).rejects.toMatchObject({
			reason: "read_failed",
		})
	})

	it("invalidates the complete measurement when one Cache response is missing", async () => {
		vi.stubGlobal("indexedDB", new IDBFactory())
		vi.stubGlobal("IDBKeyRange", IDBKeyRange)
		vi.stubGlobal("caches", {
			keys: async () => ["cache-missing"],
			open: async () => ({
				keys: async () => [new Request("https://example.test/missing")],
				match: async () => undefined,
			}),
		})
		await expect(measureStorageSizesInContext({ budgetMs: 10_000 })).rejects.toMatchObject({
			reason: "read_failed",
		})
	})

	it("assigns 7 MiB to opaque responses and streams readable bodies", async () => {
		vi.stubGlobal("indexedDB", new IDBFactory())
		vi.stubGlobal("IDBKeyRange", IDBKeyRange)
		const opaqueArrayBuffer = vi.fn()
		const streamedBody = new ReadableStream<Uint8Array>({
			start(controller) {
				controller.enqueue(new Uint8Array([1, 2]))
				controller.enqueue(new Uint8Array([3, 4, 5]))
				controller.close()
			},
		})
		vi.stubGlobal("caches", {
			keys: async () => ["cache-opaque", "cache-stream"],
			open: async (name: string) => ({
				keys: async () => [new Request(`https://example.test/${name}/item`)],
				match: async () =>
					name === "cache-opaque"
						? ({
								type: "opaque",
								body: null,
								arrayBuffer: opaqueArrayBuffer,
							} as unknown as Response)
						: ({ type: "basic", body: streamedBody } as unknown as Response),
			}),
		})
		const yieldControl = vi.fn(async () => undefined)
		const result = await measureStorageSizesInContext({
			budgetMs: 10_000,
			batchDurationMs: 0,
			yieldControl,
		})
		expect(result.cacheStorageContentBytes).toBe(7 * 1024 ** 2 + 5)
		expect(result.top10[0]).toMatchObject({
			storageType: "cacheStorage",
			sizeBytes: 7 * 1024 ** 2,
		})
		expect(opaqueArrayBuffer).not.toHaveBeenCalled()
		expect(yieldControl).toHaveBeenCalled()
	})

	it("resumes from an in-memory checkpoint after a slice budget expires", async () => {
		vi.stubGlobal("indexedDB", new IDBFactory())
		vi.stubGlobal("IDBKeyRange", IDBKeyRange)
		await createDatabase("db-sliced", {
			records: ["first", "second", "third"],
		})
		stubCaches({})
		let now = 0
		const scanner = new StorageSizeScanner({
			batchEntries: 1,
			batchDurationMs: Number.POSITIVE_INFINITY,
			now: () => now,
			yieldControl: async () => {
				now += 6
			},
		})
		const firstSlice = await scanner.runSlice(10)
		expect(firstSlice.status).toBe("slice")
		const finalSlice = await scanner.runSlice(10_000)
		expect(finalSlice.status).toBe("complete")
		if (finalSlice.status === "complete") {
			expect(finalSlice.coverage.indexedDBRecordsRead).toBe(3)
			expect(finalSlice.measurement.indexedDBContentBytes).toBe(22)
		}
	})
})

describe("measureStorageSizes worker adapter", () => {
	it("accepts a valid complete message and terminates the worker", async () => {
		const terminate = vi.fn()
		const worker = {
			onmessage: null as ((event: MessageEvent<unknown>) => void) | null,
			onerror: null as ((event: ErrorEvent) => void) | null,
			postMessage: vi.fn(function () {
				queueMicrotask(() =>
					worker.onmessage?.({
						data: {
							type: "complete",
							measurement: {
								indexedDBContentBytes: 10,
								cacheStorageContentBytes: 20,
								top10: [],
								indexedDBSizeDurationMs: 1,
								cacheStorageSizeDurationMs: 2,
								sizeMeasurementDurationMs: 3,
							},
							coverage: {
								indexedDBRecordsRead: 1,
								indexedDBStoresRead: 1,
								cacheStorageEntriesRead: 1,
								cacheStorageOpaqueEntries: 0,
							},
							sliceCount: 1,
							elapsedMs: 3,
						},
					} as MessageEvent),
				)
			}),
			terminate,
		}
		await expect(
			measureStorageSizes(new AbortController().signal, { createWorker: () => worker }),
		).resolves.toMatchObject({
			status: "complete",
			measurement: { indexedDBContentBytes: 10, cacheStorageContentBytes: 20 },
		})
		expect(terminate).toHaveBeenCalledTimes(1)
	})

	it("terminates and resolves undefined when aborted", async () => {
		const controller = new AbortController()
		const terminate = vi.fn()
		const worker = {
			onmessage: null,
			onerror: null,
			postMessage: vi.fn(),
			terminate,
		}
		const result = measureStorageSizes(controller.signal, { createWorker: () => worker })
		controller.abort()
		await expect(result).resolves.toMatchObject({ status: "incomplete", reason: "aborted" })
		expect(terminate).toHaveBeenCalledTimes(1)
	})

	it("rejects malformed worker output without waiting for the safety timeout", async () => {
		const terminate = vi.fn()
		const worker = {
			onmessage: null as ((event: MessageEvent<unknown>) => void) | null,
			onerror: null as ((event: ErrorEvent) => void) | null,
			postMessage: vi.fn(function () {
				queueMicrotask(() =>
					worker.onmessage?.({
						data: {
							type: "complete",
							measurement: {
								indexedDBContentBytes: 10,
								cacheStorageContentBytes: 20,
								top10: [null],
								indexedDBSizeDurationMs: 1,
								cacheStorageSizeDurationMs: 2,
								sizeMeasurementDurationMs: 3,
							},
							coverage: {
								indexedDBRecordsRead: 1,
								indexedDBStoresRead: 1,
								cacheStorageEntriesRead: 1,
								cacheStorageOpaqueEntries: 0,
							},
							sliceCount: 1,
							elapsedMs: 3,
						},
					} as MessageEvent),
				)
			}),
			terminate,
		}
		await expect(
			measureStorageSizes(new AbortController().signal, { createWorker: () => worker }),
		).resolves.toMatchObject({ status: "incomplete", reason: "worker_error" })
		expect(terminate).toHaveBeenCalledTimes(1)
	})

	it("preserves structured failure reason, stage and coverage for log analysis", async () => {
		const terminate = vi.fn()
		const worker = {
			onmessage: null as ((event: MessageEvent<unknown>) => void) | null,
			onerror: null as ((event: ErrorEvent) => void) | null,
			postMessage: vi.fn(function () {
				queueMicrotask(() =>
					worker.onmessage?.({
						data: {
							type: "incomplete",
							reason: "timeout",
							stage: "cacheStorage",
							coverage: {
								indexedDBRecordsRead: 100,
								indexedDBStoresRead: 2,
								cacheStorageEntriesRead: 8,
								cacheStorageOpaqueEntries: 1,
							},
							sliceCount: 3,
							elapsedMs: 15_000,
						},
					} as MessageEvent),
				)
			}),
			terminate,
		}
		await expect(
			measureStorageSizes(new AbortController().signal, { createWorker: () => worker }),
		).resolves.toEqual({
			status: "incomplete",
			reason: "timeout",
			stage: "cacheStorage",
			coverage: {
				indexedDBRecordsRead: 100,
				indexedDBStoresRead: 2,
				cacheStorageEntriesRead: 8,
				cacheStorageOpaqueEntries: 1,
			},
			sliceCount: 3,
			elapsedMs: 15_000,
		})
		expect(terminate).toHaveBeenCalledTimes(1)
	})

	it("terminates an unresponsive worker after the safety timeout", async () => {
		vi.useFakeTimers()
		const terminate = vi.fn()
		const worker = {
			onmessage: null,
			onerror: null,
			postMessage: vi.fn(),
			terminate,
		}
		const result = measureStorageSizes(new AbortController().signal, {
			sliceBudgetMs: 10,
			overallBudgetMs: 10,
			createWorker: () => worker,
		})
		await vi.advanceTimersByTimeAsync(260)
		await expect(result).resolves.toMatchObject({ status: "incomplete", reason: "timeout" })
		expect(terminate).toHaveBeenCalledTimes(1)
	})
})
