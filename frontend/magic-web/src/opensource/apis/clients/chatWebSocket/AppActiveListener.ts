import { isMagicApp } from "@/opensource/utils/devices"
import { logger as Logger } from "@/opensource/utils/log"
import { getNativePort } from "@/opensource/platform/native"

const logger = Logger.createLogger("app active listener")

/**
 * App active state listener
 * Monitors app active state changes and provides state query interface
 */
export class AppActiveListener {
	private isActive = true
	private initialized = false
	private destroyCallback: ((ignoreState?: boolean) => void) | null = null
	private onActiveChangeCallback: ((active: boolean) => void) | null = null

	/**
	 * Initialize app active state listener
	 */
	init() {
		if (this.initialized) return

		// Check if running in app environment
		if (!isMagicApp) {
			logger.log("Not in app environment, skip initialization")
			return
		}

		this.isActive = true
		this.initialized = true

		try {
			this.destroyCallback = getNativePort().appLifecycle.observeAppActiveState((params) => {
				const wasActive = this.isActive
				// Extract active state from params - assuming params has an 'active' or 'isActive' property
				const active =
					typeof params === "boolean" ? params : ((params as any)?.active ?? true)
				this.isActive = active

				if (wasActive !== this.isActive && this.onActiveChangeCallback) {
					this.onActiveChangeCallback(this.isActive)
				}
			}) as unknown as (ignoreState?: boolean) => void

			logger.log("App active state listener initialized")
		} catch (error) {
			logger.error("Failed to initialize app active state listener", error)
			this.initialized = false
		}
	}

	/**
	 * Set active state change callback
	 * @param callback Callback function to invoke when active state changes
	 */
	onActiveChange(callback: (active: boolean) => void) {
		this.onActiveChangeCallback = callback
	}

	/**
	 * Get current app active state
	 * @returns Whether app is active
	 */
	getIsActive(): boolean {
		return this.isActive
	}

	/**
	 * Clean up app active state listener
	 */
	destroy() {
		if (this.destroyCallback) {
			this.destroyCallback(true)
			this.destroyCallback = null
		}
		this.initialized = false
	}
}
