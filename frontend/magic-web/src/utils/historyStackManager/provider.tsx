import React, { createContext, useContext, useEffect } from "react"
import historyStackManager from "./manager"
import type { HistoryStackContextValue, HistoryStackProviderProps } from "./types"

const HistoryStackContext = createContext<HistoryStackContextValue | null>(null)

/**
 * HistoryStackProvider - Global provider for history stack management
 * Ensures the HistoryStackManager is properly initialized and provides context access
 */
export function HistoryStackProvider({
	children,
	enableDebugLogging = false,
}: HistoryStackProviderProps) {
	useEffect(() => {
		// Initialize the manager (it's a singleton, so this just ensures it's created)
		const manager = historyStackManager

		if (enableDebugLogging) {
			console.log("[HistoryStackProvider] Initialized with manager:", manager)
		}

		// Cleanup function for development hot reload
		return () => {
			if (process.env.NODE_ENV === "development") {
				// In development, we might want to clean up on hot reload
				const stats = manager.getStats()
				if (stats.totalEntries > 0) {
					console.warn("[HistoryStackProvider] Cleaning up entries on unmount:", stats)
					Object.keys(stats.entriesByComponent).forEach((component) => {
						manager.cleanupComponentEntries(component)
					})
				}
			}
		}
	}, [enableDebugLogging])

	const contextValue: HistoryStackContextValue = {
		manager: historyStackManager,
		getStats: () => historyStackManager.getStats(),
		getActiveStack: () => historyStackManager.getActiveStack(),
		hasActiveEntries: () => historyStackManager.hasActiveEntries(),
	}

	return (
		<HistoryStackContext.Provider value={contextValue}>{children}</HistoryStackContext.Provider>
	)
}

/**
 * Hook to access the HistoryStackManager context
 */
export function useHistoryStackContext(): HistoryStackContextValue {
	const context = useContext(HistoryStackContext)
	if (!context) {
		throw new Error("useHistoryStackContext must be used within a HistoryStackProvider")
	}
	return context
}

/**
 * Hook to get history stack statistics
 */
export function useHistoryStackStats() {
	const { getStats } = useHistoryStackContext()
	return getStats()
}

/**
 * Hook to check if there are active entries
 */
export function useHasActiveEntries() {
	const { hasActiveEntries } = useHistoryStackContext()
	return hasActiveEntries()
}

export default HistoryStackProvider
