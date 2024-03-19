import { logger as Logger } from "@/opensource/utils/log"

const logger = Logger.createLogger("WakeLockManager", {
	enableConfig: { console: false },
})

/**
 * WakeLock Manager for preventing device sleep during recording
 *
 * This manager handles:
 * - Requesting screen wake lock when recording starts
 * - Releasing wake lock when recording stops
 * - Handling wake lock release events (user switches tab, system forces release)
 * - Providing fallback mechanisms for unsupported browsers
 */
export class WakeLockManager {
	private wakeLock: WakeLockSentinel | null = null
	private isSupported: boolean = false
	private isActive: boolean = false
	private onWakeLockRelease?: () => void

	constructor(onWakeLockRelease?: () => void) {
		this.onWakeLockRelease = onWakeLockRelease
		this.checkSupport()
	}

	/**
	 * Check if Wake Lock API is supported
	 */
	private checkSupport(): void {
		this.isSupported = "wakeLock" in navigator && "request" in navigator.wakeLock

		if (!this.isSupported) {
			logger.warn("Wake Lock API is not supported in this browser")
		} else {
			logger.log("Wake Lock API is supported")
		}
	}

	/**
	 * Request screen wake lock
	 * @returns Promise<boolean> - true if successfully acquired, false otherwise
	 */
	async requestWakeLock(): Promise<boolean> {
		if (!this.isSupported) {
			logger.warn("Cannot request wake lock: API not supported")
			return false
		}

		if (this.isActive && this.wakeLock) {
			logger.log("Wake lock is already active")
			return true
		}

		try {
			// Request screen wake lock
			this.wakeLock = await navigator.wakeLock.request("screen")
			this.isActive = true

			// Listen for wake lock release
			this.wakeLock.addEventListener("release", this.handleWakeLockRelease)

			logger.log("Screen wake lock acquired successfully", {
				type: this.wakeLock.type,
				released: this.wakeLock.released,
			})

			return true
		} catch (error) {
			logger.error("Failed to acquire wake lock", error)

			// Common error reasons:
			// - Document is not active (tab not focused)
			// - Document is not visible (tab in background)
			// - User has disabled wake lock permissions
			this.handleWakeLockError(error as Error)
			return false
		}
	}

	/**
	 * Release the current wake lock
	 */
	async releaseWakeLock(): Promise<void> {
		if (!this.wakeLock || !this.isActive) {
			logger.log("No active wake lock to release")
			return
		}

		try {
			await this.wakeLock.release()
			logger.log("Wake lock released successfully")
		} catch (error) {
			logger.error("Failed to release wake lock", error)
		} finally {
			this.cleanup()
		}
	}

	/**
	 * Handle wake lock release event
	 */
	private handleWakeLockRelease = () => {
		logger.log("Wake lock was released", {
			type: this.wakeLock?.type,
			reason: "System or user triggered release",
		})

		this.cleanup()

		// Notify callback if provided
		if (this.onWakeLockRelease) {
			this.onWakeLockRelease()
		}
	}

	/**
	 * Handle wake lock errors
	 */
	private handleWakeLockError(error: Error): void {
		const errorMessage = error.message.toLowerCase()

		if (errorMessage.includes("document is not active")) {
			logger.warn("Cannot acquire wake lock: document is not active (tab not focused)")
		} else if (errorMessage.includes("document is not visible")) {
			logger.warn("Cannot acquire wake lock: document is not visible (tab in background)")
		} else if (errorMessage.includes("not allowed")) {
			logger.warn("Cannot acquire wake lock: permission denied or disabled")
		} else {
			logger.error("Unknown wake lock error", error)
		}
	}

	/**
	 * Clean up internal state
	 */
	private cleanup(): void {
		if (this.wakeLock) {
			this.wakeLock.removeEventListener("release", this.handleWakeLockRelease)
		}
		this.wakeLock = null
		this.isActive = false
	}

	/**
	 * Get current wake lock status
	 */
	getStatus() {
		return {
			isSupported: this.isSupported,
			isActive: this.isActive,
			wakeLock: this.wakeLock
				? {
						type: this.wakeLock.type,
						released: this.wakeLock.released,
					}
				: null,
		}
	}

	/**
	 * Check if wake lock is currently active
	 */
	isWakeLockActive(): boolean {
		return Boolean(this.isActive && this.wakeLock && !this.wakeLock.released)
	}

	/**
	 * Attempt to re-acquire wake lock if it was released
	 * This can be called when user refocuses the tab
	 */
	async reacquireIfNeeded(): Promise<boolean> {
		if (this.isSupported && !this.isActive) {
			logger.log("Attempting to re-acquire wake lock")
			return await this.requestWakeLock()
		}
		return this.isActive
	}

	/**
	 * Add visibility change listener to handle tab focus changes
	 */
	addVisibilityChangeListener(): void {
		if (typeof document !== "undefined") {
			document.addEventListener("visibilitychange", this.handleVisibilityChange)
			logger.log("Visibility change listener added")
		}
	}

	/**
	 * Remove visibility change listener
	 */
	removeVisibilityChangeListener(): void {
		if (typeof document !== "undefined") {
			document.removeEventListener("visibilitychange", this.handleVisibilityChange)
			logger.log("Visibility change listener removed")
		}
	}

	/**
	 * Handle document visibility changes
	 */
	private handleVisibilityChange = async () => {
		if (document.visibilityState === "visible") {
			// Tab became visible, try to re-acquire wake lock if recording
			if (!this.isActive) {
				logger.log("Tab became visible, attempting to re-acquire wake lock")
				await this.reacquireIfNeeded()
			}
		} else {
			// Tab became hidden, wake lock will likely be released automatically
			logger.log("Tab became hidden, wake lock may be released")
		}
	}

	/**
	 * Clean up all resources
	 */
	dispose(): void {
		this.releaseWakeLock()
		this.removeVisibilityChangeListener()
		this.onWakeLockRelease = undefined
		logger.log("WakeLockManager disposed")
	}
}
