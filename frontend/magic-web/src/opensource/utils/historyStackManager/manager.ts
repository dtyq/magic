/**
 * Global History Stack Manager
 * Provides safe and reliable history stack manipulation for mobile back button handling
 * Used across the entire application for consistent back button behavior
 */

import type { VirtualEntry, HistoryStackStats, HistoryStackManagerInterface } from "./types"

class HistoryStackManager implements HistoryStackManagerInterface {
	private static instance: HistoryStackManager
	private virtualEntries: Map<string, VirtualEntry> = new Map()
	private activeEntryStack: string[] = [] // Stack of active entry IDs (LIFO)
	private isListening = false
	private readonly VIRTUAL_ENTRY_KEY = "magic_virtual_entry"

	private constructor() {
		this.setupGlobalListener()
	}

	static getInstance(): HistoryStackManager {
		if (!HistoryStackManager.instance) {
			HistoryStackManager.instance = new HistoryStackManager()
		}
		return HistoryStackManager.instance
	}

	/**
	 * Add a virtual history entry with automatic cleanup
	 */
	addVirtualEntry(component: string, onBack: () => void): string {
		const entryId = `${this.VIRTUAL_ENTRY_KEY}_${component}_${Date.now()}_${Math.random()
			.toString(36)
			.substr(2, 9)}`

		// Check for existing entries from the same component and clean them up
		this.cleanupComponentEntries(component)

		const virtualState = {
			[this.VIRTUAL_ENTRY_KEY]: true,
			entryId,
			component,
			timestamp: Date.now(),
		}

		try {
			window.history.pushState(virtualState, "")

			const entry: VirtualEntry = {
				id: entryId,
				timestamp: Date.now(),
				component,
				cleanup: onBack,
			}

			this.virtualEntries.set(entryId, entry)
			this.activeEntryStack.push(entryId)

			console.debug(`[HistoryStackManager] Added virtual entry for ${component}:`, entryId)
			return entryId
		} catch (error) {
			console.warn("[HistoryStackManager] Failed to add virtual entry:", error)
			throw error
		}
	}

	/**
	 * Remove a specific virtual entry
	 */
	removeVirtualEntry(entryId: string): boolean {
		const entry = this.virtualEntries.get(entryId)
		if (!entry) return false

		try {
			// Check if current state matches our entry
			const currentState = window.history.state
			if (currentState && currentState.entryId === entryId) {
				// Safely navigate back to remove the virtual entry
				window.history.back()
			}

			this.virtualEntries.delete(entryId)
			// Remove from active stack
			const stackIndex = this.activeEntryStack.indexOf(entryId)
			if (stackIndex > -1) {
				this.activeEntryStack.splice(stackIndex, 1)
			}
			console.debug(`[HistoryStackManager] Removed virtual entry:`, entryId)
			return true
		} catch (error) {
			console.warn("[HistoryStackManager] Failed to remove virtual entry:", error)
			return false
		}
	}

	/**
	 * Clean up all virtual entries from a specific component
	 */
	cleanupComponentEntries(component: string): void {
		const entriesToRemove = Array.from(this.virtualEntries.values()).filter(
			(entry) => entry.component === component,
		)

		entriesToRemove.forEach((entry) => {
			// Remove from virtual entries
			this.virtualEntries.delete(entry.id)
			// Remove from active stack
			const stackIndex = this.activeEntryStack.indexOf(entry.id)
			if (stackIndex > -1) {
				this.activeEntryStack.splice(stackIndex, 1)
			}
			console.debug(`[HistoryStackManager] Cleaned up entry for ${component}:`, entry.id)
		})
	}

	/**
	 * Get statistics about current virtual entries
	 */
	getStats(): HistoryStackStats {
		const entriesByComponent: Record<string, number> = {}

		this.virtualEntries.forEach((entry) => {
			entriesByComponent[entry.component] = (entriesByComponent[entry.component] || 0) + 1
		})

		return {
			totalEntries: this.virtualEntries.size,
			entriesByComponent,
		}
	}

	/**
	 * Clean up stale entries (older than 5 minutes)
	 */
	cleanupStaleEntries(): void {
		const fiveMinutesAgo = Date.now() - 5 * 60 * 1000
		const staleEntries = Array.from(this.virtualEntries.values()).filter(
			(entry) => entry.timestamp < fiveMinutesAgo,
		)

		staleEntries.forEach((entry) => {
			console.warn(`[HistoryStackManager] Cleaning up stale entry:`, entry.id)
			this.removeVirtualEntry(entry.id)
		})
	}

	/**
	 * Get the current active entry stack (for debugging)
	 */
	getActiveStack(): string[] {
		return [...this.activeEntryStack]
	}

	/**
	 * Check if there are any active entries
	 */
	hasActiveEntries(): boolean {
		return this.activeEntryStack.length > 0
	}

	private setupGlobalListener(): void {
		if (this.isListening) return

		const handlePopState = (event: PopStateEvent) => {
			// Check if we have any active entries to handle
			if (this.activeEntryStack.length === 0) return

			// Get the most recent active entry (LIFO)
			const entryId = this.activeEntryStack[this.activeEntryStack.length - 1]
			const entry = this.virtualEntries.get(entryId)

			if (entry && entry.cleanup) {
				// Execute cleanup callback
				entry.cleanup()

				// Remove the entry from our tracking
				this.virtualEntries.delete(entryId)
				this.activeEntryStack.pop()

				console.debug(`[HistoryStackManager] Handled popstate for:`, entryId)
			}
		}

		window.addEventListener("popstate", handlePopState)
		this.isListening = true

		// Periodic cleanup of stale entries
		setInterval(() => {
			this.cleanupStaleEntries()
		}, 60000) // Every minute

		console.debug("[HistoryStackManager] Global listener initialized")
	}
}

// Export singleton instance
export const historyStackManager = HistoryStackManager.getInstance()
export default historyStackManager
