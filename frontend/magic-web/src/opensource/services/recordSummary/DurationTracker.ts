import { createRecordingLogger } from "./utils/RecordingLogger"

const logger = createRecordingLogger("DurationTracker")

/**
 * Reliable duration tracking using multiple time sources
 * Primary: AudioContext.currentTime (audio thread clock, most reliable)
 * Backup: performance.now() (system independent monotonic clock)
 *
 * 使用多个时间源的可靠时长追踪
 * 主要：AudioContext.currentTime（音频线程时钟，最可靠）
 * 备用：performance.now()（独立于系统的单调时钟）
 */
export class DurationTracker {
	// Primary time source: AudioContext.currentTime (most reliable)
	private audioContextStartTime: number = 0
	private audioContext: AudioContext | null = null

	// Backup time source: performance.now() (system independent)
	private performanceStartTime: number = 0

	// Accumulated duration from previous sessions (for pause/resume)
	private accumulatedDuration: number = 0

	// Status
	private isTracking: boolean = false

	// Last formatted duration to prevent redundant updates
	private lastDuration: string = ""

	/**
	 * Initialize and start tracking
	 * 初始化并开始追踪
	 *
	 * @param audioContext AudioContext instance for audio-based timing
	 * @param previousDuration Previously accumulated duration in milliseconds
	 */
	start(audioContext: AudioContext | null, previousDuration: number = 0): void {
		this.audioContext = audioContext
		this.accumulatedDuration = previousDuration

		if (audioContext) {
			this.audioContextStartTime = audioContext.currentTime
			logger.log("Duration tracking started with AudioContext", {
				startTime: this.audioContextStartTime.toFixed(3),
				previousDuration,
			})
		} else {
			logger.warn("Duration tracking started WITHOUT AudioContext (fallback mode)")
		}

		// Always start performance timer as backup
		this.performanceStartTime = performance.now()
		this.isTracking = true

		logger.log("Duration tracking started", {
			hasAudioContext: !!audioContext,
			previousDuration,
			formattedPrevious: this.formatMilliseconds(previousDuration),
		})
	}

	/**
	 * Pause tracking and save current duration
	 * 暂停追踪并保存当前时长
	 *
	 * @returns Current total duration in milliseconds
	 */
	pause(): number {
		if (!this.isTracking) {
			logger.warn("Cannot pause: tracking not started")
			return this.accumulatedDuration
		}

		const currentDuration = this.getCurrentDuration()
		this.accumulatedDuration = currentDuration
		this.isTracking = false

		logger.log("Duration tracking paused", {
			totalDuration: currentDuration,
			formatted: this.formatMilliseconds(currentDuration),
		})

		return this.accumulatedDuration
	}

	/**
	 * Resume tracking from accumulated duration
	 * 从累积时长恢复追踪
	 *
	 * @param audioContext New AudioContext instance (may differ from previous)
	 */
	resume(audioContext: AudioContext | null): void {
		this.start(audioContext, this.accumulatedDuration)
		logger.log("Duration tracking resumed", {
			accumulatedDuration: this.accumulatedDuration,
			formatted: this.formatMilliseconds(this.accumulatedDuration),
		})
	}

	/**
	 * Stop tracking and return final duration
	 * 停止追踪并返回最终时长
	 *
	 * @returns Final total duration in milliseconds
	 */
	stop(): number {
		const finalDuration = this.pause()
		this.reset()
		logger.log("Duration tracking stopped", {
			finalDuration,
			formatted: this.formatMilliseconds(finalDuration),
		})
		return finalDuration
	}

	/**
	 * Update AudioContext reference without resetting accumulated duration
	 * Used when audio source is switched during recording
	 * 更新 AudioContext 引用而不重置累积时长
	 * 用于录制期间切换音频源
	 *
	 * @param audioContext New AudioContext instance
	 */
	updateAudioContext(audioContext: AudioContext | null): void {
		if (!this.isTracking) {
			logger.warn("Cannot update AudioContext: tracking not started")
			return
		}

		// Get current duration before switching to preserve accurate time
		const currentDuration = this.getCurrentDuration()

		// Update AudioContext reference
		const oldContext = this.audioContext
		this.audioContext = audioContext

		if (audioContext) {
			// Reset start time with new AudioContext
			this.audioContextStartTime = audioContext.currentTime
			// Update accumulated duration to current time
			this.accumulatedDuration = currentDuration
			// Reset performance timer as well
			this.performanceStartTime = performance.now()

			logger.log("AudioContext updated during tracking", {
				oldContextExists: !!oldContext,
				newContextTime: audioContext.currentTime.toFixed(3),
				preservedDuration: currentDuration,
				formattedDuration: this.formatMilliseconds(currentDuration),
			})
		} else {
			logger.warn("AudioContext set to null, falling back to performance.now()")
		}
	}

	/**
	 * Reset all tracking state
	 * 重置所有追踪状态
	 */
	reset(): void {
		this.audioContextStartTime = 0
		this.performanceStartTime = 0
		this.accumulatedDuration = 0
		this.audioContext = null
		this.isTracking = false
		this.lastDuration = ""

		logger.log("Duration tracking reset")
	}

	/**
	 * Get current recording duration in milliseconds
	 * Uses AudioContext.currentTime as primary source with performance.now() validation
	 * 获取当前录制时长（毫秒）
	 * 使用 AudioContext.currentTime 作为主要时间源，performance.now() 进行验证
	 *
	 * @returns Current total duration in milliseconds
	 */
	getCurrentDuration(): number {
		if (!this.isTracking) {
			return this.accumulatedDuration
		}

		// Priority 1: Use AudioContext time (most reliable for audio recording)
		if (this.audioContext) {
			const audioElapsed = (this.audioContext.currentTime - this.audioContextStartTime) * 1000
			const totalDuration = this.accumulatedDuration + audioElapsed

			// Validate with performance.now() (should be similar)
			const perfElapsed = performance.now() - this.performanceStartTime
			const perfTotal = this.accumulatedDuration + perfElapsed
			const diff = Math.abs(totalDuration - perfTotal)

			// If difference > 2 seconds, log warning (potential issue)
			if (diff > 2000) {
				logger.warn("Time source mismatch detected", {
					audioContextDuration: totalDuration,
					performanceDuration: perfTotal,
					difference: diff,
					audioElapsed,
					perfElapsed,
				})
			}

			return totalDuration
		}

		// Fallback: Use performance.now() (when AudioContext not available)
		const perfElapsed = performance.now() - this.performanceStartTime
		const totalDuration = this.accumulatedDuration + perfElapsed

		// Log fallback usage every 10 seconds to avoid spam
		if (Math.floor(perfElapsed / 10000) > Math.floor((perfElapsed - 1000) / 10000)) {
			logger.log("Using performance.now() fallback", {
				elapsed: perfElapsed,
				total: totalDuration,
			})
		}

		return totalDuration
	}

	/**
	 * Get current duration as formatted string (HH:MM:SS)
	 * 获取格式化的当前时长（HH:MM:SS）
	 *
	 * @returns Formatted duration string
	 */
	getFormattedDuration(): string {
		const duration = this.getCurrentDuration()
		return this.formatMilliseconds(duration)
	}

	/**
	 * Check if duration has changed since last check
	 * Used to prevent redundant UI updates
	 * 检查时长是否已变化
	 * 用于防止冗余的 UI 更新
	 *
	 * @returns true if duration changed, false otherwise
	 */
	hasChanged(): boolean {
		const current = this.getFormattedDuration()
		const changed = current !== this.lastDuration
		if (changed) {
			this.lastDuration = current
		}
		return changed
	}

	/**
	 * Format milliseconds to HH:MM:SS string
	 * 将毫秒格式化为 HH:MM:SS 字符串
	 *
	 * @param ms Duration in milliseconds
	 * @returns Formatted string
	 */
	private formatMilliseconds(ms: number): string {
		const totalSeconds = Math.floor(ms / 1000)
		const hours = Math.floor(totalSeconds / 3600)
		const minutes = Math.floor((totalSeconds % 3600) / 60)
		const seconds = totalSeconds % 60

		return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(
			seconds,
		).padStart(2, "0")}`
	}

	/**
	 * Get time source status for debugging
	 * 获取时间源状态用于调试
	 *
	 * @returns Status object with timing information
	 */
	getStatus(): {
		isTracking: boolean
		hasAudioContext: boolean
		audioContextTime: number
		performanceTime: number
		accumulatedDuration: number
		totalDuration: number
		formattedDuration: string
	} {
		return {
			isTracking: this.isTracking,
			hasAudioContext: !!this.audioContext,
			audioContextTime: this.audioContext
				? (this.audioContext.currentTime - this.audioContextStartTime) * 1000
				: 0,
			performanceTime: this.isTracking ? performance.now() - this.performanceStartTime : 0,
			accumulatedDuration: this.accumulatedDuration,
			totalDuration: this.getCurrentDuration(),
			formattedDuration: this.getFormattedDuration(),
		}
	}
}
