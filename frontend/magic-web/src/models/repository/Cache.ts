import { platformKey } from "@/utils/storage"
import { reportCaughtStorageFailure } from "@/app/services/storage/storageFailure"

/** Resolve the current localStorage object at call time so tests can stub it. */
function webStorage(): globalThis.Storage {
	return window.localStorage
}

/** Build the repository Web Storage facade used by User/Account cache fallbacks. */
function generateStorage() {
	return {
		/** Read JSON cache; blocked storage is reported and returns {}. */
		get(key: string) {
			try {
				return JSON.parse(webStorage().getItem(platformKey(key)) || "{}")
			} catch (error) {
				try {
					return webStorage().getItem(platformKey(key))
				} catch (readError) {
					reportCaughtStorageFailure({
						eventKey: "repository_cache_get_failed",
						error: readError,
						message: "Failed to read repository localStorage cache",
						key,
					})
					return {}
				}
			}
		},
		/** Persist JSON cache; quota/stringify failures are reported and never retried as raw values. */
		set(key: string, value: unknown) {
			try {
				webStorage().setItem(platformKey(key), JSON.stringify(value))
			} catch (error) {
				// Do not retry with the raw value: quota errors would throw again, and
				// non-JSON values would persist "[object Object]" into authorization cache.
				reportCaughtStorageFailure({
					eventKey: "repository_cache_set_failed",
					error,
					message: "Failed to write repository localStorage cache",
					key,
				})
			}
		},
		/** Delete one cache key without throwing to repository callers. */
		remove(key: string) {
			try {
				return webStorage().removeItem(platformKey(key))
			} catch (error) {
				reportCaughtStorageFailure({
					eventKey: "repository_cache_remove_failed",
					error,
					message: "Failed to remove repository localStorage cache",
					key,
				})
			}
		},
		/** Clear the entire Web Storage origin used by this adapter. */
		allClear() {
			try {
				return webStorage().clear()
			} catch (error) {
				reportCaughtStorageFailure({
					eventKey: "repository_cache_clear_failed",
					error,
					message: "Failed to clear repository localStorage cache",
				})
			}
		},
		/** Return the nth raw storage key, matching the native Storage.key contract. */
		key(index: number) {
			return webStorage().key(index)
		},
		getAll<T>(prefixKey: string): Array<T> {
			const list: Array<T> = []
			const storage = webStorage()
			for (let i = 0; i < storage.length; i++) {
				const key = storage.key(i)
				if (key?.startsWith(platformKey(prefixKey))) {
					list.push(Storage.get(platformKey(prefixKey)))
				}
			}
			return list
		},
		clearById(prefixKey: string) {
			const storage = webStorage()
			for (let i = 0; i < storage.length; i++) {
				const key = storage.key(i)
				if (key?.startsWith(platformKey(prefixKey))) {
					Storage.remove(platformKey(prefixKey))
				}
			}
		},
		get length() {
			return webStorage().length
		},
	}
}

export const Storage = generateStorage()
