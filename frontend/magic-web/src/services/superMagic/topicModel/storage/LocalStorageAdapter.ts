import { IStorageAdapter } from "./IStorageAdapter"
import { reportCaughtStorageFailure } from "@/app/services/storage/storageFailure"

/**
 * LocalStorage adapter for Web platform.
 * Wraps the synchronous localStorage API into an async interface and never rethrows.
 */
export class LocalStorageAdapter implements IStorageAdapter {
	/** Read one key; missing or blocked storage returns null. */
	async getItem(key: string): Promise<string | null> {
		try {
			return window.localStorage.getItem(key)
		} catch (error) {
			reportCaughtStorageFailure({
				eventKey: "get_item_local_storage_failed",
				error,
				message: "Failed to get item from localStorage",
				key,
			})
			return null
		}
	}

	/** Write one key; quota and private-mode failures stay inside the adapter. */
	async setItem(key: string, value: string): Promise<void> {
		try {
			window.localStorage.setItem(key, value)
		} catch (error) {
			reportCaughtStorageFailure({
				eventKey: "set_item_local_storage_failed",
				error,
				message: "Failed to set item in localStorage",
				key,
			})
		}
	}

	/** Delete one key without surfacing storage exceptions to callers. */
	async removeItem(key: string): Promise<void> {
		try {
			window.localStorage.removeItem(key)
		} catch (error) {
			reportCaughtStorageFailure({
				eventKey: "remove_item_local_storage_failed",
				error,
				message: "Failed to remove item from localStorage",
				key,
			})
		}
	}

	/** Clear all keys without surfacing storage exceptions to callers. */
	async clear(): Promise<void> {
		try {
			window.localStorage.clear()
		} catch (error) {
			reportCaughtStorageFailure({
				eventKey: "clear_local_storage_failed",
				error,
				message: "Failed to clear localStorage",
			})
		}
	}
}
