import { logger as Logger } from "@/opensource/utils/log"
import { draftService } from "./index"

const logger = Logger.createLogger("DraftServiceLifecycle", {
	enableConfig: {
		console: false,
		warn: true,
		error: true,
		trace: true,
	},
})

/**
 * Draft Service Lifecycle Manager
 * Handles proper initialization and cleanup of draft services
 */
class DraftServiceLifecycle {
	private isInitialized = false
	private cleanupHandlers: (() => void)[] = []

	/**
	 * Initialize draft service lifecycle management
	 */
	init(): void {
		if (this.isInitialized) {
			logger.warn("DraftServiceLifecycle already initialized")
			return
		}

		this.isInitialized = true
		logger.log("Initializing DraftServiceLifecycle")

		// Register cleanup handlers for various browser events
		this.registerCleanupHandlers()
	}

	/**
	 * Register cleanup handlers for various browser events
	 */
	private registerCleanupHandlers(): void {
		// Check if we're in a browser environment
		if (typeof window === "undefined" || typeof document === "undefined") {
			logger.warn("Window or document not available, skipping event listener registration")
			return
		}

		// Handle page unload
		const beforeUnloadHandler = () => {
			logger.log("Page unloading, cleaning up draft services")
			this.cleanup()
		}

		// Handle visibility change (tab switching, browser minimizing)
		const visibilityChangeHandler = async (): Promise<void> => {
			if (document?.hidden) {
				const isCleanupDue = await draftService.isCleanupDue()
				// Page is hidden, potentially run cleanup
				if (isCleanupDue) {
					logger.log("Page hidden and cleanup is due, running cleanup")
					try {
						const cleanupResult = draftService.runCleanup()
						// Only call .catch if cleanupResult is a Promise
						if (cleanupResult && typeof cleanupResult.catch === "function") {
							await cleanupResult.catch((error) => {
								logger.error("Failed to run cleanup on visibility change", error)
							})
						}
					} catch (error) {
						logger.error("Failed to run cleanup on visibility change", error)
					}
				}
			}
		}

		// Handle focus events
		const focusHandler = async (): Promise<void> => {
			// Page gained focus, check if cleanup is due
			const isCleanupDue = await draftService.isCleanupDue()
			if (isCleanupDue) {
				logger.log("Page focused and cleanup is due, running cleanup")
				try {
					const cleanupResult = draftService.runCleanup()
					// Only call .catch if cleanupResult is a Promise
					if (cleanupResult && typeof cleanupResult.catch === "function") {
						await cleanupResult.catch((error) => {
							logger.error("Failed to run cleanup on focus", error)
						})
					}
				} catch (error) {
					logger.error("Failed to run cleanup on focus", error)
				}
			}
		}

		// Add event listeners with error handling
		try {
			window.addEventListener("beforeunload", beforeUnloadHandler)
		} catch (error) {
			logger.error("Failed to add beforeunload event listener", error)
		}

		try {
			document.addEventListener("visibilitychange", visibilityChangeHandler)
		} catch (error) {
			logger.error("Failed to add visibilitychange event listener", error)
		}

		try {
			window.addEventListener("focus", focusHandler)
		} catch (error) {
			logger.error("Failed to add focus event listener", error)
		}

		// Store cleanup functions with error handling
		this.cleanupHandlers.push(
			() => {
				try {
					window?.removeEventListener("beforeunload", beforeUnloadHandler)
				} catch (error) {
					logger.error("Failed to remove beforeunload event listener", error)
				}
			},
			() => {
				try {
					document?.removeEventListener("visibilitychange", visibilityChangeHandler)
				} catch (error) {
					logger.error("Failed to remove visibilitychange event listener", error)
				}
			},
			() => {
				try {
					window?.removeEventListener("focus", focusHandler)
				} catch (error) {
					logger.error("Failed to remove focus event listener", error)
				}
			},
		)

		logger.log("Registered cleanup handlers for draft services")
	}

	/**
	 * Manual cleanup of draft services
	 */
	cleanup(): void {
		logger.log("Running manual cleanup of draft services")

		try {
			// Stop the cleanup scheduler and close the draft service
			draftService.close()
		} catch (error) {
			logger.error("Error during draft service cleanup", error)
		}
	}

	/**
	 * Destroy lifecycle manager and remove all event listeners
	 */
	destroy(): void {
		logger.log("Destroying DraftServiceLifecycle")

		// Remove all event listeners
		this.cleanupHandlers.forEach((handler) => handler())
		this.cleanupHandlers = []

		// Cleanup draft services
		this.cleanup()

		this.isInitialized = false
	}

	/**
	 * Get initialization status
	 */
	getStatus(): { isInitialized: boolean; cleanupHandlersCount: number } {
		return {
			isInitialized: this.isInitialized,
			cleanupHandlersCount: this.cleanupHandlers.length,
		}
	}
}

// Export class for testing
export { DraftServiceLifecycle }

// Export singleton instance
export const draftServiceLifecycle = new DraftServiceLifecycle()

// Auto-initialize if in browser environment
if (typeof window !== "undefined") {
	// Initialize after a short delay to ensure DOM is ready
	setTimeout(() => {
		draftServiceLifecycle.init()
	}, 100)
}
