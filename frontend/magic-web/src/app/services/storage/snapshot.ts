import { KNOWN_EXCLUDED_INDEXED_DB_NAME } from "./storageExclusions"

export interface CacheBucketCount {
	name: string
	count: number
}

export interface IndexedDBStoreCount {
	storeName: string
	count: number
}

export interface IndexedDBDatabaseCount {
	dbName: string
	stores: IndexedDBStoreCount[]
}

/** Raw origin usage snapshot. Product code decides whether and how to report it. */
export interface StorageQuotaSnapshot {
	usage: number
	quota: number
	ratio: number
	localStorageBytes: number
	sessionStorageBytes: number
	caches: CacheBucketCount[]
	indexedDB: IndexedDBDatabaseCount[]
	cacheCountDurationMs: number
	indexedDBCountDurationMs: number
}

/**
 * Estimate Web Storage size as UTF-16 bytes without enumerating names in the return value.
 * Browsers store DOMString as UTF-16, so (key + value) * 2 is the cheap local estimate.
 */
export function measureWebStorageBytes(
	storage: Storage | undefined,
	noteFault?: () => void,
): number {
	if (!storage) return 0
	try {
		let bytes = 0
		for (let index = 0; index < storage.length; index += 1) {
			const key = storage.key(index)
			if (key == null) continue
			const value = storage.getItem(key) ?? ""
			bytes += (key.length + value.length) * 2
		}
		return bytes
	} catch {
		noteFault?.()
		return 0
	}
}

/** Count Cache Storage entries per bucket via cache.keys().length, never reading response bodies. */
export async function countAllCaches(noteFault?: () => void): Promise<CacheBucketCount[]> {
	try {
		if (typeof caches === "undefined") {
			noteFault?.()
			return []
		}
		const names = await caches.keys()
		const buckets: CacheBucketCount[] = []
		for (const name of names) {
			try {
				const cache = await caches.open(name)
				const keys = await cache.keys()
				buckets.push({ name, count: keys.length })
			} catch {
				noteFault?.()
			}
		}
		return buckets
	} catch {
		noteFault?.()
		return []
	}
}

/** Resolve an IDBRequest-like object without throwing into the snapshot path. */
function awaitIdbRequest<T>(
	request: IDBRequest<T> | { result: T; onsuccess: unknown; onerror: unknown },
): Promise<T | undefined> {
	return new Promise((resolve) => {
		const idbRequest = request as IDBRequest<T>
		idbRequest.onsuccess = () => resolve(idbRequest.result)
		idbRequest.onerror = () => resolve(undefined)
	})
}

/** Placeholder used as a silent noteFault default. */
function noop(): void {
	return undefined
}

/** Open an existing database for counting; abort if the open would create or upgrade it. */
function openExistingDatabase(
	name: string,
	noteFault?: () => void,
): Promise<IDBDatabase | undefined> {
	return new Promise((resolve) => {
		let settled = false
		const finish = (database?: IDBDatabase) => {
			if (settled) return
			settled = true
			resolve(database)
		}
		try {
			const request = indexedDB.open(name)
			request.onblocked = () => {
				noteFault?.()
				finish(undefined)
			}
			request.onerror = () => {
				noteFault?.()
				finish(undefined)
			}
			request.onupgradeneeded = () => {
				// Counting must never create a database that disappeared between databases() and open().
				noteFault?.()
				try {
					request.transaction?.abort()
				} catch {
					/* Abort is best-effort; the settled flag still drops this database. */
				}
				finish(undefined)
			}
			request.onsuccess = () => {
				if (settled) {
					try {
						request.result.close()
					} catch {
						/* Ignore close failures after a skipped upgrade. */
					}
					return
				}
				finish(request.result)
			}
		} catch {
			noteFault?.()
			finish(undefined)
		}
	})
}

/** Read one object store's native count() without scanning values. Failure is not zero. */
async function countObjectStore(
	database: IDBDatabase,
	storeName: string,
	noteFault?: () => void,
): Promise<number | undefined> {
	try {
		const transaction = database.transaction(storeName, "readonly")
		const counted = await awaitIdbRequest(transaction.objectStore(storeName).count())
		const count = Number(counted)
		// Failed requests resolve as undefined; do not coerce that into a fake 0 count.
		if (counted === undefined || !Number.isFinite(count)) {
			noteFault?.()
			return undefined
		}
		return count
	} catch {
		noteFault?.()
		return undefined
	}
}

/**
 * Enumerate IndexedDB databases and native store counts.
 * databases() is required; without it we cannot discover names without creating new databases.
 */
export async function countIndexedDBRecords(
	noteFault?: () => void,
): Promise<IndexedDBDatabaseCount[]> {
	if (typeof indexedDB === "undefined" || typeof indexedDB.databases !== "function") {
		noteFault?.()
		return []
	}
	let infos: IDBDatabaseInfo[] = []
	try {
		infos = await indexedDB.databases()
	} catch {
		noteFault?.()
		return []
	}
	const databases: IndexedDBDatabaseCount[] = []
	for (const info of infos) {
		const dbName = info.name
		if (!dbName) continue
		// Keep the known stream-record database out of diagnostics so other stores can be ranked.
		if (dbName === KNOWN_EXCLUDED_INDEXED_DB_NAME) continue
		const database = await openExistingDatabase(dbName, noteFault)
		if (!database) continue
		try {
			const stores: IndexedDBStoreCount[] = []
			for (const storeName of Array.from(database.objectStoreNames)) {
				const count = await countObjectStore(database, storeName, noteFault)
				if (count === undefined) continue
				stores.push({ storeName, count })
			}
			if (stores.length) databases.push({ dbName, stores })
		} catch {
			noteFault?.()
		} finally {
			try {
				database.close()
			} catch {
				/* Close is best-effort so a later database can still be counted. */
			}
		}
	}
	return databases
}

/** Read a Storage object; missing or blocked access is a capability fault, not a thrown error. */
function readWebStorage(getter: () => Storage, noteFault: () => void): Storage | undefined {
	try {
		return getter()
	} catch {
		noteFault()
		return undefined
	}
}

/** Collect one origin snapshot. estimate() is the only hard dependency; other sources degrade. */
export async function collectStorageSnapshot(
	noteFault: () => void = noop,
): Promise<StorageQuotaSnapshot | undefined> {
	const estimate = navigator.storage?.estimate
	if (typeof estimate !== "function") {
		noteFault()
		return undefined
	}
	let usage = 0
	let quota = 0
	try {
		const result = await estimate.call(navigator.storage)
		usage = Number(result.usage) || 0
		quota = Number(result.quota) || 0
	} catch {
		noteFault()
		return undefined
	}
	const localStorageBytes = measureWebStorageBytes(
		readWebStorage(() => localStorage, noteFault),
		noteFault,
	)
	const sessionStorageBytes = measureWebStorageBytes(
		readWebStorage(() => sessionStorage, noteFault),
		noteFault,
	)
	const cacheStartedAt = performance.now()
	const cacheBuckets = await countAllCaches(noteFault)
	const cacheCountDurationMs = Math.round(performance.now() - cacheStartedAt)
	const indexedDBStartedAt = performance.now()
	const indexedDBCounts = await countIndexedDBRecords(noteFault)
	const indexedDBCountDurationMs = Math.round(performance.now() - indexedDBStartedAt)
	return {
		usage,
		quota,
		ratio: quota > 0 ? usage / quota : 0,
		localStorageBytes,
		sessionStorageBytes,
		caches: cacheBuckets,
		indexedDB: indexedDBCounts,
		cacheCountDurationMs,
		indexedDBCountDurationMs,
	}
}
