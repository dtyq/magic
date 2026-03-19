import { logger as Logger } from "@/utils/log"
import { DraftServiceInterface } from "../../types"

const logger = Logger.createLogger("DraftCleanupScheduler")

/**
 * Configuration options for draft cleanup scheduler
 */
export interface DraftCleanupConfig {
	/** Cleanup interval in milliseconds (default: 24 hours) */
	cleanupInterval?: number
	/** Number of days to keep drafts (default: 7 days) */
	retentionDays?: number
	/** Whether to run cleanup immediately on start (default: false) */
	runImmediately?: boolean
	/** Enable/disable the scheduler (default: true) */
	enabled?: boolean
}

/**
 * Draft Cleanup Scheduler
 * Manages periodic cleanup of expired draft data
 */
export class DraftCleanupScheduler {
	private config: Required<DraftCleanupConfig>
	private storage: DraftServiceInterface
	private timerId: NodeJS.Timeout | null = null
	private isRunning = false
	private lastCleanupTime = 0

	// Default configuration
	private static readonly DEFAULT_CONFIG: Required<DraftCleanupConfig> = {
		cleanupInterval: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
		retentionDays: 7, // 7 days
		runImmediately: false,
		enabled: true,
	}

	constructor(storage: DraftServiceInterface, config: DraftCleanupConfig = {}) {
		this.storage = storage
		this.config = { ...DraftCleanupScheduler.DEFAULT_CONFIG, ...config }

		logger.log("DraftCleanupScheduler initialized", {
			cleanupInterval: this.config.cleanupInterval,
			retentionDays: this.config.retentionDays,
			enabled: this.config.enabled,
		})
	}

	/**
	 * Start the cleanup scheduler
	 */
	start(): void {
		if (!this.config.enabled) {
			logger.log("DraftCleanupScheduler is disabled, not starting")
			return
		}

		if (this.isRunning) {
			logger.warn("DraftCleanupScheduler is already running")
			return
		}

		this.isRunning = true
		logger.log("Starting DraftCleanupScheduler")

		// Run immediately if configured to do so
		if (this.config.runImmediately) {
			this.runCleanup()
		}

		// Schedule recurring cleanup
		this.scheduleNextCleanup()
	}

	/**
	 * Stop the cleanup scheduler
	 */
	stop(): void {
		if (!this.isRunning) {
			logger.log("DraftCleanupScheduler is not running")
			return
		}

		logger.log("Stopping DraftCleanupScheduler")
		this.isRunning = false

		if (this.timerId) {
			clearTimeout(this.timerId)
			this.timerId = null
		}
	}

	/**
	 * Manually trigger cleanup (can be called even when scheduler is stopped)
	 */
	async runCleanup(): Promise<void> {
		const startTime = Date.now()
		logger.log("Starting draft cleanup process")

		try {
			// Check if storage supports cleanup
			if (this.storage.cleanupExpiredVersions) {
				await this.storage.cleanupExpiredVersions(this.config.retentionDays)
			} else {
				logger.warn("Storage backend does not support cleanupExpiredVersions")
			}

			this.lastCleanupTime = Date.now()

			const duration = this.lastCleanupTime - startTime
			logger.log("Draft cleanup completed successfully", {
				duration: `${duration}ms`,
				timestamp: new Date(this.lastCleanupTime).toISOString(),
			})
		} catch (error) {
			logger.error("Failed to cleanup expired drafts", error)
			throw error
		}
	}

	/**
	 * Update configuration and restart if running
	 */
	updateConfig(newConfig: Partial<DraftCleanupConfig>): void {
		const wasRunning = this.isRunning

		if (wasRunning) {
			this.stop()
		}

		this.config = { ...this.config, ...newConfig }
		logger.log("Updated DraftCleanupScheduler configuration", this.config)

		if (wasRunning) {
			this.start()
		}
	}

	/**
	 * Get current configuration
	 */
	getConfig(): Required<DraftCleanupConfig> {
		return { ...this.config }
	}

	/**
	 * Get scheduler status
	 */
	getStatus(): {
		isRunning: boolean
		lastCleanupTime: number
		nextCleanupTime: number | null
		config: Required<DraftCleanupConfig>
	} {
		const nextCleanupTime =
			this.isRunning && this.lastCleanupTime > 0
				? this.lastCleanupTime + this.config.cleanupInterval
				: null

		return {
			isRunning: this.isRunning,
			lastCleanupTime: this.lastCleanupTime,
			nextCleanupTime,
			config: this.getConfig(),
		}
	}

	/**
	 * Check if cleanup is due (useful for manual triggering)
	 */
	isCleanupDue(): boolean {
		if (this.lastCleanupTime === 0) {
			return true // Never run before
		}

		const timeSinceLastCleanup = Date.now() - this.lastCleanupTime
		return timeSinceLastCleanup >= this.config.cleanupInterval
	}

	/**
	 * Schedule the next cleanup
	 */
	private scheduleNextCleanup(): void {
		if (!this.isRunning) {
			return
		}

		// Calculate delay until next cleanup
		let delay = this.config.cleanupInterval

		// If we've run cleanup before, adjust delay based on elapsed time
		if (this.lastCleanupTime > 0) {
			const timeSinceLastCleanup = Date.now() - this.lastCleanupTime
			delay = Math.max(0, this.config.cleanupInterval - timeSinceLastCleanup)
		}

		logger.log(`Scheduling next cleanup in ${Math.round(delay / 1000)}s`)

		this.timerId = setTimeout(async () => {
			if (!this.isRunning) {
				return
			}

			try {
				await this.runCleanup()
			} catch (error) {
				logger.error("Scheduled cleanup failed", error)
			}

			// Schedule next cleanup
			this.scheduleNextCleanup()
		}, delay)
	}

	/**
	 * Clean up resources when scheduler is destroyed
	 */
	destroy(): void {
		this.stop()
		logger.log("DraftCleanupScheduler destroyed")
	}
}
