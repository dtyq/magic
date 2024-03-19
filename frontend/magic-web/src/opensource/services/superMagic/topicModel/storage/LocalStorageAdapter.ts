import { IStorageAdapter } from "./IStorageAdapter"
import { logger as Logger } from "@/opensource/utils/log"

const logger = Logger.createLogger("LocalStorageAdapter")

/**
 * LocalStorage adapter for Web platform
 * Wraps synchronous localStorage API into async interface
 */
export class LocalStorageAdapter implements IStorageAdapter {
	/**
	 * Get item from localStorage
	 */
	async getItem(key: string): Promise<string | null> {
		try {
			return window.localStorage.getItem(key)
		} catch (error) {
			logger.error("Failed to get item from localStorage", { key, error })
			return null
		}
	}

	/**
	 * Set item in localStorage
	 */
	async setItem(key: string, value: string): Promise<void> {
		try {
			window.localStorage.setItem(key, value)
		} catch (error) {
			logger.error("Failed to set item in localStorage", { key, error })
			throw error
		}
	}

	/**
	 * Remove item from localStorage
	 */
	async removeItem(key: string): Promise<void> {
		try {
			window.localStorage.removeItem(key)
		} catch (error) {
			logger.error("Failed to remove item from localStorage", { key, error })
			throw error
		}
	}

	/**
	 * Clear all items from localStorage
	 */
	async clear(): Promise<void> {
		try {
			window.localStorage.clear()
		} catch (error) {
			logger.error("Failed to clear localStorage", error)
			throw error
		}
	}
}
