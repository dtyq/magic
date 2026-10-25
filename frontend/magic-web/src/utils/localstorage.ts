import { reportCaughtStorageFailure } from "@/app/services/storage/storageFailure"

/** Small Web Storage helper for optional product flags; writes must never throw into callers. */
export default {
	/** Read one key; parse failures and blocked storage never throw to callers. */
	get(key: string, toObject: boolean = false) {
		try {
			const value = localStorage.getItem(key)

			if (toObject) {
				try {
					return JSON.parse(value ?? "{}")
				} catch (error) {
					reportCaughtStorageFailure({
						eventKey: "legacy_localstorage_parse_failed",
						error,
						message: "Failed to parse localStorage value",
						key,
					})
					return {}
				}
			}

			return value
		} catch (error) {
			reportCaughtStorageFailure({
				eventKey: "legacy_localstorage_get_failed",
				error,
				message: "Failed to read localStorage",
				key,
			})
			return toObject ? {} : null
		}
	},

	/** Write one key; quota and private-mode failures are reported then swallowed. */
	set(key: string, value: unknown) {
		try {
			localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value))
		} catch (error) {
			reportCaughtStorageFailure({
				eventKey: "legacy_localstorage_set_failed",
				error,
				message: "Failed to write localStorage",
				key,
			})
		}
	},

	/** Delete one key without surfacing storage exceptions. */
	remove(key: string) {
		try {
			localStorage.removeItem(key)
		} catch (error) {
			reportCaughtStorageFailure({
				eventKey: "legacy_localstorage_remove_failed",
				error,
				message: "Failed to remove localStorage key",
				key,
			})
		}
	},
}
