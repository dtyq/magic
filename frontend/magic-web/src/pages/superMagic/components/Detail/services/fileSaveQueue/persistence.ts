import { isQuotaExceeded, reportCaughtStorageFailure } from "@/app/services/storage/storageFailure"
import type { FileSavePersistence, StoredFileSaveRecord } from "./types"

const DB_NAME = "magic-file-save-queue"
const DB_VERSION = 1
const STORE_NAME = "pending-saves"
const STORAGE_EVENT_KEY = "file-save-queue"

function waitForTransaction(transaction: IDBTransaction): Promise<void> {
	return new Promise((resolve, reject) => {
		transaction.oncomplete = () => resolve()
		transaction.onerror = () =>
			reject(transaction.error ?? new Error("IndexedDB transaction failed"))
		transaction.onabort = () =>
			reject(transaction.error ?? new Error("IndexedDB transaction aborted"))
	})
}

function openDatabase(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		if (typeof indexedDB === "undefined") {
			reject(new Error("IndexedDB is not available"))
			return
		}
		const request = indexedDB.open(DB_NAME, DB_VERSION)
		request.onupgradeneeded = () => {
			const db = request.result
			if (!db.objectStoreNames.contains(STORE_NAME)) {
				db.createObjectStore(STORE_NAME, { keyPath: "fileId" })
			}
		}
		request.onsuccess = () => resolve(request.result)
		request.onerror = () =>
			reject(request.error ?? new Error("Failed to open file save IndexedDB"))
	})
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
	return new Promise((resolve, reject) => {
		request.onsuccess = () => resolve(request.result)
		request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"))
	})
}

/** IndexedDB mirror of unsynced file saves so a crash can recover the latest draft. */
export class IndexedDbFileSavePersistence implements FileSavePersistence {
	private dbPromise: Promise<IDBDatabase> | null = null

	private open(): Promise<IDBDatabase> {
		if (!this.dbPromise) {
			this.dbPromise = openDatabase().catch((error) => {
				this.dbPromise = null
				throw error
			})
		}
		return this.dbPromise
	}

	async put(record: StoredFileSaveRecord): Promise<void> {
		try {
			await this.writeRecord(record)
		} catch (error) {
			if (!isQuotaExceeded(error)) throw error
			reportCaughtStorageFailure({
				eventKey: STORAGE_EVENT_KEY,
				error,
				message: "File save IndexedDB quota exceeded",
				key: STORE_NAME,
			})
			const records = await this.getAll()
			const oldest = [...records].sort((left, right) => left.updatedAt - right.updatedAt)[0]
			if (oldest && oldest.fileId !== record.fileId) {
				await this.remove(oldest.fileId)
			}
			await this.writeRecord(record)
		}
	}

	private async writeRecord(record: StoredFileSaveRecord): Promise<void> {
		const db = await this.open()
		const transaction = db.transaction(STORE_NAME, "readwrite")
		transaction.objectStore(STORE_NAME).put(record)
		await waitForTransaction(transaction)
	}

	async get(fileId: string): Promise<StoredFileSaveRecord | undefined> {
		const db = await this.open()
		const record = await requestToPromise(
			db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(fileId),
		)
		return record as StoredFileSaveRecord | undefined
	}

	async getAll(): Promise<StoredFileSaveRecord[]> {
		const db = await this.open()
		const records = await requestToPromise(
			db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).getAll(),
		)
		return (records ?? []) as StoredFileSaveRecord[]
	}

	async remove(fileId: string): Promise<void> {
		const db = await this.open()
		const transaction = db.transaction(STORE_NAME, "readwrite")
		transaction.objectStore(STORE_NAME).delete(fileId)
		await waitForTransaction(transaction)
	}
}

export function createMemoryFileSavePersistence(
	initial: StoredFileSaveRecord[] = [],
): FileSavePersistence {
	const records = new Map(initial.map((record) => [record.fileId, record]))
	return {
		async put(record) {
			records.set(record.fileId, { ...record })
		},
		async get(fileId) {
			const record = records.get(fileId)
			return record ? { ...record } : undefined
		},
		async getAll() {
			return [...records.values()].map((record) => ({ ...record }))
		},
		async remove(fileId) {
			records.delete(fileId)
		},
	}
}
