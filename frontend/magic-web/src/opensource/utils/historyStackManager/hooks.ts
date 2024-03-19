import { useEffect, useRef } from "react"
import { useMemoizedFn } from "ahooks"
import historyStackManager from "./manager"
import type { UseBackHandlerReturn } from "./types"

/**
 * Global back handler hook for mobile back button management
 * Provides safe and reliable history stack manipulation across the entire application
 *
 * @param isActive - Whether the back handler is active
 * @param onBack - Callback function when back button is pressed
 * @param componentName - Unique identifier for the component (for debugging and cleanup)
 * @returns Object with cleanup function and utility methods
 */
function useBackHandler(
	isActive: boolean,
	onBack: () => void,
	componentName: string = "unknown",
): UseBackHandlerReturn {
	const entryIdRef = useRef<string>()
	const isActiveRef = useRef(false)

	const handleBack = useMemoizedFn(() => {
		// Execute the callback
		onBack()
	})

	useEffect(() => {
		// Update active state ref
		isActiveRef.current = isActive

		if (!isActive) {
			// Clean up when becoming inactive
			if (entryIdRef.current) {
				historyStackManager.removeVirtualEntry(entryIdRef.current)
				entryIdRef.current = undefined
			}
			return
		}

		// Add virtual entry when becoming active
		if (!entryIdRef.current) {
			try {
				entryIdRef.current = historyStackManager.addVirtualEntry(componentName, handleBack)
			} catch (error) {
				console.error(
					`[useBackHandler] Failed to add virtual entry for ${componentName}:`,
					error,
				)
			}
		}

		// Cleanup function
		return () => {
			if (entryIdRef.current) {
				historyStackManager.removeVirtualEntry(entryIdRef.current)
				entryIdRef.current = undefined
			}
		}
	}, [isActive, handleBack, componentName])

	// Manual cleanup function
	const cleanup = useMemoizedFn(() => {
		if (entryIdRef.current) {
			historyStackManager.removeVirtualEntry(entryIdRef.current)
			entryIdRef.current = undefined
		}
	})

	// Get current stats for debugging
	const getStats = useMemoizedFn(() => {
		return historyStackManager.getStats()
	})

	// Get active stack for debugging
	const getActiveStack = useMemoizedFn(() => {
		return historyStackManager.getActiveStack()
	})

	return {
		cleanup,
		getStats,
		getActiveStack,
		isActive: isActiveRef.current,
		entryId: entryIdRef.current,
	}
}

export default useBackHandler
