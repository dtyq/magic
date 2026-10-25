export interface LegacyObjectStore {
	name: string
	keyPath?: string
	autoIncrement: boolean
	data: Record<PropertyKey, unknown>
	getAll(): unknown[]
	get(key: PropertyKey): unknown
	put(value: unknown, key?: PropertyKey): unknown
	delete(key: PropertyKey): void
	clear(): void
}

interface LegacyDatabaseState {
	name: string
	version: number
	objectStores: Record<string, LegacyObjectStore>
}

export interface LegacyDatabase {
	name: string
	version: number
	objectStoreNames: {
		contains(name: string): boolean
		item(index: number): string | null
		readonly length: number
	}
	createObjectStore(
		name: string,
		options?: { keyPath?: string; autoIncrement?: boolean },
	): LegacyObjectStore
	transaction(
		storeNames?: string | string[],
		mode?: string,
	): {
		objectStore(name: string): LegacyObjectStore | undefined
	}
}

export interface LegacyOpenRequest extends EventTarget {
	result: LegacyDatabase | null
}

export interface LegacyIndexedDBFactory {
	open(name: string, version?: number): LegacyOpenRequest
	deleteDatabase(name: string): EventTarget
}

interface MemoryIndexedDB {
	databases: Record<string, LegacyDatabaseState>
	currentDb: LegacyDatabaseState | null
}

type IndexedDBWindow = Window & { memoryIndexedDB?: MemoryIndexedDB }

/** A minimal synchronous-store fallback, intentionally not a native IDBFactory. */
export default function install(_options: Record<string, never>): void {
	void _options
	const indexedDBWindow = window as IndexedDBWindow
	if (indexedDBWindow.memoryIndexedDB === undefined) {
		indexedDBWindow.memoryIndexedDB = { databases: {}, currentDb: null }
	}
	const memoryIndexedDB = indexedDBWindow.memoryIndexedDB
	function currentDatabase(): LegacyDatabaseState {
		if (!memoryIndexedDB.currentDb) throw new Error("No legacy database is open")
		return memoryIndexedDB.currentDb
	}

	try {
		const factory: LegacyIndexedDBFactory = {
			open(name, version) {
				// Retain the real EventTarget constructor and dispatch on the next timer turn.
				const request: LegacyOpenRequest = Object.assign(new EventTarget(), {
					result: null,
				})
				setTimeout(() => {
					if (!memoryIndexedDB.databases[name]) {
						memoryIndexedDB.databases[name] = {
							name,
							version: version || 1,
							objectStores: {},
						}
					}
					memoryIndexedDB.currentDb = memoryIndexedDB.databases[name]
					request.result = {
						name: currentDatabase().name,
						version: currentDatabase().version,
						// The legacy mock routes store operations through the last opened database.
						// Preserve that shared state during extraction; it is not full IndexedDB.
						objectStoreNames: {
							contains: (storeName) => storeName in currentDatabase().objectStores,
							item: (index) =>
								Object.keys(currentDatabase().objectStores)[index] || null,
							get length() {
								return Object.keys(currentDatabase().objectStores).length
							},
						},
						createObjectStore(storeName, options) {
							const store: LegacyObjectStore = {
								name: storeName,
								keyPath: options?.keyPath,
								autoIncrement: options?.autoIncrement || false,
								data: {},
								getAll() {
									return Object.values(this.data)
								},
								get(key) {
									return this.data[key] || null
								},
								put(value, key) {
									const useKey = this.keyPath
										? (value as Record<string, unknown>)[this.keyPath]
										: key
									// JavaScript property coercion (including undefined) matches the old mock.
									this.data[useKey as PropertyKey] = value
									return useKey
								},
								delete(key) {
									delete this.data[key]
								},
								clear() {
									this.data = {}
								},
							}
							currentDatabase().objectStores[storeName] = store
							return store
						},
						transaction() {
							return {
								objectStore: (storeName) =>
									currentDatabase().objectStores[storeName],
							}
						},
					}
					request.dispatchEvent(new Event("success"))
				}, 0)
				return request
			},
			deleteDatabase(name) {
				const request = new EventTarget()
				setTimeout(() => {
					delete memoryIndexedDB.databases[name]
					request.dispatchEvent(new Event("success"))
				}, 0)
				return request
			},
		}
		Object.defineProperty(window, "indexedDB", {
			value: factory,
			writable: false,
			configurable: true,
		})
	} catch (error) {
		console.warn("IndexedDB mock skipped:", error instanceof Error ? error.message : undefined)
	}
}
