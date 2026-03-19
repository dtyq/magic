import historyStackManager from "./manager"
import type { HistoryStackStats } from "./types"

/**
 * Global utility functions for history stack management
 * Provides convenient access to HistoryStackManager functionality
 */

/**
 * Add a virtual history entry for back button handling
 * @param component - Component identifier
 * @param onBack - Callback when back button is pressed
 * @returns Entry ID for manual cleanup if needed
 */
export function addBackHandler(component: string, onBack: () => void): string {
	return historyStackManager.addVirtualEntry(component, onBack)
}

/**
 * Remove a specific virtual history entry
 * @param entryId - Entry ID returned from addBackHandler
 * @returns Success status
 */
export function removeBackHandler(entryId: string): boolean {
	return historyStackManager.removeVirtualEntry(entryId)
}

/**
 * Clean up all virtual entries from a specific component
 * @param component - Component identifier
 */
export function cleanupComponentBackHandlers(component: string): void {
	historyStackManager.cleanupComponentEntries(component)
}

/**
 * Get statistics about current virtual entries
 * @returns Object with total entries and breakdown by component
 */
export function getHistoryStackStats(): HistoryStackStats {
	return historyStackManager.getStats()
}

/**
 * Get the current active entry stack (for debugging)
 * @returns Array of active entry IDs
 */
export function getActiveHistoryStack(): string[] {
	return historyStackManager.getActiveStack()
}

/**
 * Check if there are any active entries
 * @returns True if there are active entries
 */
export function hasActiveHistoryEntries(): boolean {
	return historyStackManager.hasActiveEntries()
}

/**
 * Clean up stale entries (older than 5 minutes)
 * Useful for manual cleanup in case of memory leaks
 */
export function cleanupStaleHistoryEntries(): void {
	historyStackManager.cleanupStaleEntries()
}

/**
 * Debug helper to log current history stack state
 */
export function debugHistoryStack(): void {
	const stats = getHistoryStackStats()
	const activeStack = getActiveHistoryStack()

	console.group("[HistoryStack Debug]")
	console.log("Total entries:", stats.totalEntries)
	console.log("Entries by component:", stats.entriesByComponent)
	console.log("Active stack:", activeStack)
	console.log("Has active entries:", hasActiveHistoryEntries())
	console.groupEnd()
}

// Export the manager instance for advanced usage
export { historyStackManager as manager }
