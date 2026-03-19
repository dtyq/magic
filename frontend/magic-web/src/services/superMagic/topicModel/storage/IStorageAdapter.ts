/**
 * Storage adapter interface for cross-platform compatibility
 * Supports both Web (LocalStorage) and React Native (AsyncStorage)
 */
export interface IStorageAdapter {
	/**
	 * Get item from storage
	 * @param key - Storage key
	 * @returns Promise resolving to stored value or null if not found
	 */
	getItem(key: string): Promise<string | null>

	/**
	 * Set item in storage
	 * @param key - Storage key
	 * @param value - Value to store (must be string)
	 * @returns Promise resolving when operation completes
	 */
	setItem(key: string, value: string): Promise<void>

	/**
	 * Remove item from storage
	 * @param key - Storage key
	 * @returns Promise resolving when operation completes
	 */
	removeItem(key: string): Promise<void>

	/**
	 * Clear all items from storage
	 * @returns Promise resolving when operation completes
	 */
	clear(): Promise<void>
}
