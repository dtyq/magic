import { logger as Logger } from "@/opensource/utils/log"

const logger = Logger.createLogger("VoiceTimeoutChecker")

interface VoiceTimeoutCheckerConfig {
	timeoutMs?: number
	onTimeout?: () => void
}

/**
 * Voice Timeout Checker Service
 * 语音超时检测服务
 *
 * Monitors voice recognition results and triggers timeout callback
 * when no results are received within the specified timeout period.
 */
class VoiceTimeoutChecker {
	private lastVoiceResultTime: number | null = null
	private timeoutCheckTimer: NodeJS.Timeout | null = null
	private readonly timeoutMs: number
	private readonly onTimeout?: () => void
	private isRunning = false

	constructor(config: VoiceTimeoutCheckerConfig = {}) {
		this.timeoutMs = config.timeoutMs ?? 60 * 1000 // Default: 1 minute
		this.onTimeout = config.onTimeout
	}

	/**
	 * Start or reset timeout check
	 * 启动或重置超时检测
	 */
	start() {
		// Clear existing timer
		this.stop()

		// Update last result time
		this.lastVoiceResultTime = Date.now()
		this.isRunning = true

		// Set new timeout check timer
		this.timeoutCheckTimer = setTimeout(() => {
			this.checkTimeout()
		}, this.timeoutMs)

		logger.log(`Voice timeout checker started with ${this.timeoutMs}ms timeout`)
	}

	/**
	 * Update last voice result time and reset timer
	 * 更新最后接收语音结果的时间并重置定时器
	 */
	recordVoiceResult() {
		this.lastVoiceResultTime = Date.now()

		// Reset timer if already running
		if (this.isRunning) {
			this.start()
		}
	}

	/**
	 * Stop timeout check
	 * 停止超时检测
	 */
	stop() {
		if (this.timeoutCheckTimer) {
			clearTimeout(this.timeoutCheckTimer)
			this.timeoutCheckTimer = null
		}
		this.lastVoiceResultTime = null
		this.isRunning = false

		logger.log("Voice timeout checker stopped")
	}

	/**
	 * Check if timeout has occurred
	 * 检查是否超时
	 */
	private checkTimeout() {
		const now = Date.now()
		const timeSinceLastResult = this.lastVoiceResultTime
			? now - this.lastVoiceResultTime
			: Infinity

		if (timeSinceLastResult >= this.timeoutMs) {
			logger.warn(
				`Voice recognition service timeout: no results received for ${
					this.timeoutMs / 1000
				} seconds`,
			)

			// Trigger timeout callback
			if (this.onTimeout) {
				this.onTimeout()
			}
		}

		// Mark as not running after check
		this.isRunning = false
	}

	/**
	 * Get current status
	 * 获取当前状态
	 */
	getStatus() {
		return {
			isRunning: this.isRunning,
			lastVoiceResultTime: this.lastVoiceResultTime,
			timeoutMs: this.timeoutMs,
		}
	}

	/**
	 * Check if currently running
	 * 检查是否正在运行
	 */
	get running() {
		return this.isRunning
	}

	/**
	 * Dispose resources
	 * 清理资源
	 */
	dispose() {
		this.stop()
		logger.log("Voice timeout checker disposed")
	}
}

export default VoiceTimeoutChecker
