// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest"
import { isQuotaExceeded } from "../quota"
import { countAllCaches, countIndexedDBRecords, measureWebStorageBytes } from "../snapshot"

afterEach(() => {
	vi.restoreAllMocks()
	vi.unstubAllGlobals()
})

/** Build a Storage-like object from in-memory entries without touching real Web Storage. */
function createFakeStorage(entries: Record<string, string>): Storage {
	const keys = Object.keys(entries)
	return {
		get length() {
			return keys.length
		},
		key(index: number) {
			return keys[index] ?? null
		},
		getItem(key: string) {
			return Object.prototype.hasOwnProperty.call(entries, key) ? entries[key] : null
		},
		setItem() {
			return undefined
		},
		removeItem() {
			return undefined
		},
		clear() {
			return undefined
		},
	}
}

/** Fire an IDBRequest-style success/error/blocked/upgrade callback on a microtask. */
function fireIdbRequest<T>(
	result: T,
	mode: "success" | "error" | "blocked" | "upgrade" = "success",
) {
	const request: {
		result: T
		onsuccess: ((event: { target: unknown }) => void) | null
		onerror: (() => void) | null
		onblocked: (() => void) | null
		onupgradeneeded: (() => void) | null
		transaction?: { abort: () => void }
	} = {
		result,
		onsuccess: null,
		onerror: null,
		onblocked: null,
		onupgradeneeded: null,
		transaction: { abort: vi.fn() },
	}
	queueMicrotask(() => {
		if (mode === "blocked") request.onblocked?.()
		else if (mode === "error") request.onerror?.()
		else if (mode === "upgrade") {
			// Real IDB may still fire onsuccess after abort; exercise that close path.
			request.onupgradeneeded?.()
			request.onsuccess?.({ target: request })
		} else request.onsuccess?.({ target: request })
	})
	return request
}

/** Install a fake indexedDB that enumerates named databases and store counts. */
function stubIndexedDB(
	databases: Array<{ name: string; stores: Record<string, number> }>,
	options: {
		missingDatabasesApi?: boolean
		openMode?: "success" | "error" | "blocked" | "upgrade"
		countMode?: "success" | "error"
	} = {},
) {
	const abort = vi.fn()
	const close = vi.fn()
	const indexedDB = {
		databases: options.missingDatabasesApi
			? undefined
			: async () => databases.map((database) => ({ name: database.name, version: 1 })),
		open: (name: string) => {
			const database = databases.find((item) => item.name === name)
			const storeNames = Object.keys(database?.stores ?? {})
			const db = {
				objectStoreNames: storeNames,
				close,
				transaction: (storeName: string) => ({
					objectStore: () => ({
						count: () =>
							fireIdbRequest(
								database?.stores[storeName] ?? 0,
								options.countMode ?? "success",
							),
					}),
				}),
			}
			const request = fireIdbRequest(db, options.openMode)
			request.transaction = { abort }
			return request
		},
	}
	vi.stubGlobal("indexedDB", indexedDB)
	return { abort, close }
}

/** Install a fake Cache Storage whose keys() length matches the provided bucket sizes. */
function stubCaches(buckets: Record<string, number>) {
	vi.stubGlobal("caches", {
		keys: async () => Object.keys(buckets),
		open: async (name: string) => ({
			keys: async () =>
				Array.from(
					{ length: buckets[name] ?? 0 },
					() => new Request("https://example.test/item"),
				),
		}),
	})
}

describe("isQuotaExceeded", () => {
	it("recognizes QuotaExceededError by DOMException name", () => {
		expect(isQuotaExceeded(new DOMException("quota exceeded", "QuotaExceededError"))).toBe(true)
	})

	it("recognizes the legacy DOMException code 22", () => {
		expect(isQuotaExceeded({ name: "Error", code: 22 })).toBe(true)
	})

	it("recognizes Firefox NS_ERROR_DOM_QUOTA_REACHED", () => {
		expect(isQuotaExceeded({ name: "NS_ERROR_DOM_QUOTA_REACHED", code: 1014 })).toBe(true)
	})

	it("rejects unrelated errors and empty values", () => {
		expect(isQuotaExceeded(new TypeError("boom"))).toBe(false)
		expect(isQuotaExceeded(null)).toBe(false)
		expect(isQuotaExceeded("QuotaExceededError")).toBe(false)
	})
})

describe("measureWebStorageBytes", () => {
	it("sums UTF-16 bytes of keys and values", () => {
		const storage = createFakeStorage({ ab: "cd", e: "fgh" })
		// ("ab"+"cd")*2 + ("e"+"fgh")*2 = 8 + 8 = 16
		expect(measureWebStorageBytes(storage)).toBe(16)
	})

	it("returns 0 when storage access throws", () => {
		const storage = createFakeStorage({ ab: "cd" })
		vi.spyOn(storage, "key").mockImplementation(() => {
			throw new Error("storage denied")
		})
		expect(measureWebStorageBytes(storage)).toBe(0)
	})
})

describe("countAllCaches", () => {
	it("aggregates entry counts across cache buckets", async () => {
		stubCaches({ "bucket-alpha": 2, "bucket-beta": 3 })
		await expect(countAllCaches()).resolves.toEqual([
			{ name: "bucket-alpha", count: 2 },
			{ name: "bucket-beta", count: 3 },
		])
	})

	it("returns an empty array when Cache Storage enumeration fails", async () => {
		vi.stubGlobal("caches", {
			keys: async () => {
				throw new Error("caches denied")
			},
			open: async () => ({ keys: async () => [] }),
		})
		await expect(countAllCaches()).resolves.toEqual([])
	})
})

describe("countIndexedDBRecords", () => {
	it("aggregates native count() results per database and store", async () => {
		stubIndexedDB([
			{ name: "db-alpha", stores: { "store-records": 4, "store-meta": 1 } },
			{ name: "db-beta", stores: { "store-items": 7 } },
		])
		await expect(countIndexedDBRecords()).resolves.toEqual([
			{
				dbName: "db-alpha",
				stores: [
					{ storeName: "store-records", count: 4 },
					{ storeName: "store-meta", count: 1 },
				],
			},
			{ dbName: "db-beta", stores: [{ storeName: "store-items", count: 7 }] },
		])
	})

	it("excludes the known stream-record database from diagnostic counts", async () => {
		stubIndexedDB([
			{ name: "MAGIC:stream-record-db", stores: { topic: 10_000 } },
			{ name: "db-alpha", stores: { records: 4 } },
		])
		await expect(countIndexedDBRecords()).resolves.toEqual([
			{ dbName: "db-alpha", stores: [{ storeName: "records", count: 4 }] },
		])
	})

	it("skips a database when open fails or is blocked", async () => {
		stubIndexedDB([{ name: "db-blocked", stores: { "store-records": 3 } }], {
			openMode: "blocked",
		})
		await expect(countIndexedDBRecords()).resolves.toEqual([])
	})

	it("returns an empty array when databases() is unavailable", async () => {
		stubIndexedDB([{ name: "db-alpha", stores: { "store-records": 1 } }], {
			missingDatabasesApi: true,
		})
		await expect(countIndexedDBRecords()).resolves.toEqual([])
	})

	it("aborts an upgrade open and closes the result if onsuccess still fires", async () => {
		const { abort, close } = stubIndexedDB(
			[{ name: "db-ghost", stores: { "store-records": 3 } }],
			{ openMode: "upgrade" },
		)
		await expect(countIndexedDBRecords()).resolves.toEqual([])
		expect(abort).toHaveBeenCalledTimes(1)
		expect(close).toHaveBeenCalledTimes(1)
	})

	it("skips a store when count() fails instead of reporting 0", async () => {
		const noteFault = vi.fn()
		stubIndexedDB([{ name: "db-alpha", stores: { "store-records": 4 } }], {
			countMode: "error",
		})
		await expect(countIndexedDBRecords(noteFault)).resolves.toEqual([])
		expect(noteFault).toHaveBeenCalled()
	})
})
