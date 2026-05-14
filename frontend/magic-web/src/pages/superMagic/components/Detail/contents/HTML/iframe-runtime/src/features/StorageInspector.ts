/**
 * StorageInspector
 *
 * Reads current state of cookie, localStorage, sessionStorage,
 * and IndexedDB from within the iframe and reports snapshots
 * to the parent window via postMessage.
 *
 * Works with both mocked and native storage APIs.
 */

export interface StorageData {
	cookies: Record<string, string>
	localStorage: Record<string, string>
	sessionStorage: Record<string, string>
	indexedDB: IndexedDBInfo[]
}

export interface IndexedDBInfo {
	name: string
	version: number
	objectStores: string[]
}

export class StorageInspector {
	/** Collect a snapshot of all storage APIs */
	snapshot(): StorageData {
		return {
			cookies: this.readCookies(),
			localStorage: this.readStorage(window.localStorage),
			sessionStorage: this.readStorage(window.sessionStorage),
			indexedDB: [], // populated async, see snapshotAsync
		}
	}

	/** Collect a full snapshot including async IndexedDB enumeration */
	async snapshotAsync(): Promise<StorageData> {
		const sync = this.snapshot()
		sync.indexedDB = await this.readIndexedDB()
		return sync
	}

	// ─── Cookie ──────────────────────────────────────────────────────────

	private readCookies(): Record<string, string> {
		const result: Record<string, string> = {}
		try {
			const raw = document.cookie
			if (!raw) return result
			for (const pair of raw.split(";")) {
				const eqIdx = pair.indexOf("=")
				if (eqIdx === -1) continue
				const name = pair.slice(0, eqIdx).trim()
				const value = pair.slice(eqIdx + 1).trim()
				if (name) {
					try {
						result[name] = decodeURIComponent(value)
					} catch {
						result[name] = value
					}
				}
			}
		} catch {
			// cookie access may throw in some environments
		}
		return result
	}

	// ─── localStorage / sessionStorage ───────────────────────────────────

	private readStorage(storage: Storage): Record<string, string> {
		const result: Record<string, string> = {}
		try {
			for (let i = 0; i < storage.length; i++) {
				const key = storage.key(i)
				if (key !== null) {
					result[key] = storage.getItem(key) ?? ""
				}
			}
		} catch {
			// storage access may throw (e.g. SecurityError)
		}
		return result
	}

	// ─── IndexedDB ──────────────────────────────────────────────────────

	private async readIndexedDB(): Promise<IndexedDBInfo[]> {
		try {
			// indexedDB.databases() is supported in most modern browsers
			if (typeof indexedDB !== "undefined" && typeof indexedDB.databases === "function") {
				const dbs = await indexedDB.databases()
				return dbs.map((db) => ({
					name: db.name ?? "(unnamed)",
					version: db.version ?? 0,
					objectStores: [],
				}))
			}
		} catch {
			// indexedDB may be mocked or unavailable
		}
		return []
	}
}
