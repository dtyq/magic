import { logger as Logger } from "@/utils/log"
import i18n from "i18next"
import magicToast from "@/components/base/MagicToaster/utils"

const logger = Logger.createLogger("SilenceDetector")

export interface SilenceDetectorConfig {
	/**
	 * 静音阈值 (0-1)，默认 0.03
	 * 音频级别低于此值视为静音
	 */
	threshold?: number
	/**
	 * 有声阈值 (0-1)，默认 0.05
	 * 音频级别高于此值视为有声（用于滞后区间，避免频繁切换）
	 */
	soundThreshold?: number
	/**
	 * 检测间隔（毫秒），默认 300
	 */
	checkInterval?: number
	/**
	 * 状态确认次数，默认 3
	 * 需要连续检测到相同状态这么多次才切换，用于防抖
	 */
	confirmCount?: number
	/**
	 * 静音提示的 message key
	 */
	messageKey?: string
	/**
	 * 检查是否正在录音的函数
	 */
	isRecording?: () => boolean
}

/**
 * Silence Detector Service
 * 静音检测服务
 *
 * Monitors audio level in real-time and detects silence state
 * 实时监控音频级别并检测静音状态
 */
class SilenceDetector {
	private audioContext: AudioContext | null = null
	private analyser: AnalyserNode | null = null
	private source: MediaStreamAudioSourceNode | null = null
	private checkTimer: NodeJS.Timeout | null = null
	private isRunning = false
	private currentIsSilent = false
	private readonly silenceThreshold: number
	private readonly soundThreshold: number
	private readonly checkInterval: number
	private readonly confirmCount: number
	private readonly messageKey: string
	private readonly isRecording?: () => boolean
	private dataArray: Uint8Array | null = null
	// 防抖计数器：记录连续检测到相同状态的次数
	private confirmCounter = 0
	private pendingIsSilent: boolean | null = null

	constructor(config: SilenceDetectorConfig = {}) {
		this.silenceThreshold = config.threshold ?? 0.03
		this.soundThreshold = config.soundThreshold ?? 0.05
		this.checkInterval = config.checkInterval ?? 300
		this.confirmCount = config.confirmCount ?? 3
		this.messageKey = config.messageKey ?? "recording-silence-detected"
		this.isRecording = config.isRecording
	}

	/**
	 * Start real-time silence detection
	 * 开始实时静音检测
	 */
	start(stream: MediaStream): void {
		if (this.isRunning) {
			logger.warn("Silence detector is already running")
			return
		}

		try {
			// Create AudioContext
			const AudioContextClass =
				window.AudioContext ||
				(window as typeof window & { webkitAudioContext: typeof AudioContext })
					.webkitAudioContext
			this.audioContext = new AudioContextClass()

			// Create analyser node
			this.analyser = this.audioContext.createAnalyser()
			this.analyser.fftSize = 2048
			this.analyser.smoothingTimeConstant = 0.3
			this.analyser.minDecibels = -90
			this.analyser.maxDecibels = -10

			// Create microphone input
			this.source = this.audioContext.createMediaStreamSource(stream)
			this.source.connect(this.analyser)

			// Create data array for frequency data
			const bufferLength = this.analyser.frequencyBinCount
			this.dataArray = new Uint8Array(new ArrayBuffer(bufferLength))

			// Start checking audio level
			this.isRunning = true
			this.currentIsSilent = false
			this.confirmCounter = 0
			this.pendingIsSilent = null
			this.checkAudioLevel()

			logger.log("Silence detector started")
		} catch (error) {
			logger.error("Failed to start silence detector:", error)
			this.cleanup()
			throw error
		}
	}

	/**
	 * Stop silence detection
	 * 停止静音检测
	 */
	stop(): void {
		if (!this.isRunning) {
			// Even if not running, clear message if exists
			magicToast.destroy(this.messageKey)
			return
		}

		this.isRunning = false

		if (this.checkTimer) {
			clearTimeout(this.checkTimer)
			this.checkTimer = null
		}

		// Clear silence message when stopping
		magicToast.destroy(this.messageKey)

		this.cleanup()

		logger.log("Silence detector stopped")
	}

	/**
	 * Check audio level periodically
	 * 定期检测音频级别
	 */
	private checkAudioLevel(): void {
		if (!this.isRunning || !this.analyser || !this.dataArray) {
			return
		}

		try {
			// Get frequency data
			// @ts-expect-error - getByteFrequencyData accepts Uint8Array with ArrayBufferLike
			this.analyser.getByteFrequencyData(this.dataArray)

			// Calculate RMS (Root Mean Square) value
			let sumSquares = 0
			for (let i = 0; i < this.dataArray.length; i++) {
				const normalized = this.dataArray[i] / 255
				sumSquares += normalized * normalized
			}
			const rms = Math.sqrt(sumSquares / this.dataArray.length)

			// Apply logarithmic scaling for better sensitivity
			const level = Math.pow(rms, 0.5)

			// Determine if silent using hysteresis (滞后区间)
			// 如果当前是静音状态，需要超过 soundThreshold 才认为有声
			// 如果当前是有声状态，需要低于 silenceThreshold 才认为静音
			let isSilent: boolean
			if (this.currentIsSilent) {
				// 当前是静音，需要超过有声阈值才切换
				isSilent = level < this.soundThreshold
			} else {
				// 当前是有声，需要低于静音阈值才切换
				isSilent = level < this.silenceThreshold
			}

			// 防抖机制：需要连续检测到相同状态 confirmCount 次才切换
			if (isSilent === this.pendingIsSilent) {
				// 状态一致，增加计数器
				this.confirmCounter++
			} else {
				// 状态不一致，重置计数器
				this.pendingIsSilent = isSilent
				this.confirmCounter = 1
			}

			// 如果连续检测到相同状态达到确认次数，且与当前状态不同，则切换
			if (
				this.confirmCounter >= this.confirmCount &&
				this.pendingIsSilent !== null &&
				this.pendingIsSilent !== this.currentIsSilent
			) {
				this.currentIsSilent = this.pendingIsSilent
				this.handleSilenceChange(this.currentIsSilent)
				this.confirmCounter = 0
				this.pendingIsSilent = null
				logger.log(
					`Silence state changed: ${this.currentIsSilent ? "silent" : "has sound"}`,
				)
			}

			// Schedule next check
			if (this.isRunning) {
				this.checkTimer = setTimeout(() => {
					this.checkAudioLevel()
				}, this.checkInterval)
			}
		} catch (error) {
			logger.error("Error checking audio level:", error)
			// Continue checking even if there's an error
			if (this.isRunning) {
				this.checkTimer = setTimeout(() => {
					this.checkAudioLevel()
				}, this.checkInterval)
			}
		}
	}

	/**
	 * Handle silence state change
	 * 处理静音状态变化
	 */
	private handleSilenceChange(isSilent: boolean): void {
		// Check if recording is active
		if (this.isRecording && !this.isRecording()) {
			return
		}

		if (isSilent) {
			// Show silence message (persistent)
			magicToast.info({
				content: i18n.t("super:recordingSummary.silenceDetected"),
				duration: 0, // Persistent
				key: this.messageKey,
			})
			logger.log("Silence detected, showing message")
		} else {
			// Close silence message
			magicToast.destroy(this.messageKey)
			logger.log("Sound detected, closing silence message")
		}
	}

	/**
	 * Clear silence message manually
	 * 手动清除静音提示
	 */
	clearMessage(): void {
		magicToast.destroy(this.messageKey)
	}

	/**
	 * Get current silence state
	 * 获取当前是否静音
	 */
	isSilent(): boolean {
		return this.currentIsSilent
	}

	/**
	 * Cleanup resources
	 * 清理资源
	 */
	private cleanup(): void {
		if (this.checkTimer) {
			clearTimeout(this.checkTimer)
			this.checkTimer = null
		}

		if (this.source) {
			try {
				this.source.disconnect()
			} catch (error) {
				logger.warn("Error disconnecting source:", error)
			}
			this.source = null
		}

		if (this.audioContext && this.audioContext.state !== "closed") {
			this.audioContext
				.close()
				.then(() => {
					logger.log("AudioContext closed")
				})
				.catch((error) => {
					logger.warn("Error closing AudioContext:", error)
				})
		}
		this.audioContext = null
		this.analyser = null
		this.dataArray = null
		this.currentIsSilent = false
		this.confirmCounter = 0
		this.pendingIsSilent = null
	}

	/**
	 * Dispose resources
	 * 释放资源
	 */
	dispose(): void {
		this.stop()
		logger.log("Silence detector disposed")
	}
}

export default SilenceDetector
