export interface LegacyStorageOptions {
	markerId?: string
}

type StoragePair = { localStorage: Storage; sessionStorage: Storage }
type StorageFactory = (markerId?: string) => StoragePair
type StorageWindow = Window & { __MAGIC_LEGACY_STORAGE_FACTORY__?: StorageFactory }

/** Namespace the native stores for standalone HTML, preserving the legacy key format. */
export default function install({ markerId }: LegacyStorageOptions): void {
	try {
		const storageWindow = window as StorageWindow
		if (!storageWindow.__MAGIC_LEGACY_STORAGE_FACTORY__) {
			// A new document can reuse this Window. Keep native references in the closure,
			// not on a public property, so reinstalling never wraps the previous facade.
			storageWindow.__MAGIC_LEGACY_STORAGE_FACTORY__ = createStorageFactory(
				window.localStorage,
				window.sessionStorage,
			)
		}
		const { localStorage, sessionStorage } =
			storageWindow.__MAGIC_LEGACY_STORAGE_FACTORY__(markerId)
		Object.defineProperty(window, "sessionStorage", {
			value: sessionStorage,
			writable: false,
			configurable: true,
		})
		Object.defineProperty(window, "localStorage", {
			value: localStorage,
			writable: false,
			configurable: true,
		})
	} catch (error) {
		console.warn("Storage mock skipped:", error instanceof Error ? error.message : undefined)
	}
}

function createStorageFactory(
	originalLocalStorage: Storage,
	originalSessionStorage: Storage,
): StorageFactory {
	return (markerId) => {
		const storageKey = `MAGIC:iframe:storage:${markerId || "default"}`
		const globalStorageKey = "MAGIC:iframe:storage:global"

		const createStorageProxy = (storage: Storage): Storage => {
			const read = (): Record<string, string> =>
				JSON.parse(storage.getItem(storageKey) || "{}")
			const save = (data: Record<string, string>): void => {
				storage.setItem(storageKey, JSON.stringify(data))
			}
			return {
				getItem(key) {
					if (key === storageKey) return null
					if (key === globalStorageKey) return storage.getItem(key)
					// Preserve the historical empty-string fallback, not native Storage semantics.
					return read()[key] || null
				},
				setItem(key, value) {
					if (key === storageKey) {
						console.warn("忽略对存储键本身的设置操作:", key)
						return
					}
					if (key === globalStorageKey) {
						storage.setItem(key, value)
						return
					}
					const data = read()
					data[key] = String(value)
					save(data)
				},
				removeItem(key) {
					if (key === storageKey) {
						console.warn("忽略对存储键本身的删除操作:", key)
						return
					}
					if (key === globalStorageKey) {
						storage.removeItem(key)
						return
					}
					const data = read()
					delete data[key]
					save(data)
				},
				clear() {
					save({})
				},
				key(index) {
					return Object.keys(read())[index] || null
				},
				get length() {
					return Object.keys(read()).length
				},
			}
		}

		return {
			localStorage: createStorageProxy(originalLocalStorage),
			sessionStorage: createStorageProxy(originalSessionStorage),
		}
	}
}
