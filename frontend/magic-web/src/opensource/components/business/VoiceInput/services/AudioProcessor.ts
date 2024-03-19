/**
 * AudioProcessor.ts
 *
 * 封装 Web Audio API 的复杂性，负责：
 * - 获取麦克风权限
 * - 创建和管理 AudioContext
 * - 使用 AudioWorklet 进行高效的音频处理（下采样、格式转换）
 * - 通过回调向外暴露处理好的音频数据
 */

import { MicrophonePermissionService } from "@/opensource/services/MicrophonePermissionService"
import { logger as Logger } from "@/opensource/utils/log"

export interface AudioConfig {
	sampleRate: number
	channelCount: number
	bitsPerSample: number
	bufferDuration?: number // 音频缓冲区持续时间(ms)，默认200ms
	echoCancellation?: boolean
	noiseSuppression?: boolean
	autoGainControl?: boolean
}

export interface AudioProcessorEvents {
	data: (data: ArrayBuffer) => void
	error: (error: Error) => void
	started: () => void
	stopped: () => void
}

type EventListener<T extends keyof AudioProcessorEvents> = AudioProcessorEvents[T]

interface AudioStats {
	packetsProcessed: number
	totalDuration: number
	averageLatency: number
}

const logger = Logger.createLogger("AudioProcessor", {
	enableConfig: { console: false, warn: false },
})

type AudioProcessorState = "idle" | "starting" | "recording" | "stopping" | "error"

export const DEFAULT_BUFFER_DURATION = 200 // 200ms, optimized for performance

export class AudioProcessor {
	private config: AudioConfig
	private audioStream: MediaStream | null = null
	private audioContext: AudioContext | null = null
	private sourceNode: MediaStreamAudioSourceNode | null = null
	private workletNode: AudioWorkletNode | null = null
	private state: AudioProcessorState = "idle"
	private eventListeners: Map<
		keyof AudioProcessorEvents,
		Set<EventListener<keyof AudioProcessorEvents>>
	> = new Map()
	private stats: AudioStats = { packetsProcessed: 0, totalDuration: 0, averageLatency: 0 }
	private processorUrl: string | null = null
	private disposed = false
	private processingTimes: number[] = []
	private lastProcessTime = 0
	private performanceIssueCount = 0
	private lastBufferAdjustment = 0
	private externalStreamProvided = false

	constructor(config: AudioConfig) {
		this.config = this.validateAndNormalizeConfig(config)
	}

	/**
	 * Add an event listener
	 */
	on<K extends keyof AudioProcessorEvents>(
		event: K,
		callback: AudioProcessorEvents[K],
	): () => void {
		if (this.disposed) {
			logger.warn("⚠️ [AudioProcessor] Attempt to add event listener to disposed instance")
			return () => {
				// No-op unsubscribe function for disposed instance
			}
		}

		if (!this.eventListeners.has(event)) {
			this.eventListeners.set(event, new Set())
		}

		const listeners = this.eventListeners.get(event)
		if (!listeners) {
			throw new Error(`Event listeners not initialized for event: ${String(event)}`)
		}
		listeners.add(callback as EventListener<K>)

		// Return unsubscribe function
		return () => {
			this.off(event, callback)
		}
	}

	/**
	 * Remove a specific event listener
	 */
	off<K extends keyof AudioProcessorEvents>(event: K, callback: AudioProcessorEvents[K]): void {
		const listeners = this.eventListeners.get(event)
		if (listeners) {
			listeners.delete(callback as EventListener<K>)
			// If no listeners left for this event, remove the entry
			if (listeners.size === 0) {
				this.eventListeners.delete(event)
			}
		}
	}

	/**
	 * Add a one-time event listener that will be automatically removed after being called once
	 */
	once<K extends keyof AudioProcessorEvents>(
		event: K,
		callback: AudioProcessorEvents[K],
	): () => void {
		const onceWrapper = ((...args: unknown[]) => {
			this.off(event, onceWrapper as AudioProcessorEvents[K])
			;(callback as (...args: unknown[]) => void)(...args)
		}) as AudioProcessorEvents[K]

		return this.on(event, onceWrapper)
	}

	/**
	 * Remove all listeners for a specific event, or all listeners if no event specified
	 */
	removeAllListeners<K extends keyof AudioProcessorEvents>(event?: K): void {
		if (event) {
			this.eventListeners.delete(event)
		} else {
			this.eventListeners.clear()
		}
	}

	/**
	 * Get the number of listeners for a specific event
	 */
	getListenerCount<K extends keyof AudioProcessorEvents>(event: K): number {
		const listeners = this.eventListeners.get(event)
		return listeners ? listeners.size : 0
	}

	/**
	 * Get all registered events
	 */
	getRegisteredEvents(): Array<keyof AudioProcessorEvents> {
		return Array.from(this.eventListeners.keys())
	}

	private emit<K extends keyof AudioProcessorEvents>(
		event: K,
		...args: Parameters<NonNullable<AudioProcessorEvents[K]>>
	): void {
		const listeners = this.eventListeners.get(event)
		if (listeners && listeners.size > 0) {
			// Create a copy of listeners to avoid issues if listeners are modified during emission
			const listenersCopy = Array.from(listeners)
			for (const callback of listenersCopy) {
				try {
					;(
						callback as unknown as (
							...args: Parameters<NonNullable<AudioProcessorEvents[K]>>
						) => void
					)(...args)
				} catch (error) {
					logger.error(
						`❌ [AudioProcessor] Error in event listener for '${String(event)}':`,
						error,
					)
				}
			}
		}
	}

	private validateAndNormalizeConfig(config: AudioConfig): AudioConfig {
		if (!config.sampleRate || config.sampleRate < 8000 || config.sampleRate > 48000) {
			throw new Error("采样率必须在8000-48000之间")
		}

		if (!config.channelCount || config.channelCount < 1 || config.channelCount > 2) {
			throw new Error("声道数必须为1或2")
		}

		if (!config.bitsPerSample || ![16, 24, 32].includes(config.bitsPerSample)) {
			throw new Error("位深度必须为16、24或32")
		}

		return {
			...config,
			bufferDuration: config.bufferDuration || DEFAULT_BUFFER_DURATION,
			echoCancellation: config.echoCancellation ?? true,
			noiseSuppression: config.noiseSuppression ?? true,
			autoGainControl: config.autoGainControl ?? true,
		}
	}

	get isRecording(): boolean {
		return this.state === "recording"
	}

	get currentState(): AudioProcessorState {
		return this.state
	}

	get audioStats(): AudioStats {
		return { ...this.stats }
	}

	async start(externalStream?: MediaStream): Promise<void> {
		if (this.disposed) {
			throw new Error("AudioProcessor已被销毁")
		}

		if (this.state !== "idle") {
			return
		}

		this.state = "starting"
		logger.log("🎙️ [AudioProcessor] Starting audio processing...")

		try {
			if (externalStream) {
				this.assignExternalStream(externalStream)
			} else {
				await this.initializeAudioStream()
			}
			await this.setupAudioProcessing()

			this.state = "recording"
			logger.log("🎙️ [AudioProcessor] Audio processing started successfully")
			this.lastProcessTime = performance.now()
			this.emit("started")
		} catch (error) {
			this.state = "error"
			// 对于权限错误，直接传递原始错误以保持错误类型
			if ((error as Error).name === "NotAllowedError") {
				this.emit("error", error as Error)
				throw error
			}
			// 其他错误包装为音频处理错误
			const audioError = new Error(`音频处理初始化失败: ${(error as Error).message}`)
			this.emit("error", audioError)
			throw audioError
		}
	}

	private async initializeAudioStream(): Promise<void> {
		// 使用统一的权限管理服务获取麦克风访问
		const { stream } = await MicrophonePermissionService.requestMicrophoneAccess({
			sampleRate: this.config.sampleRate,
			channelCount: this.config.channelCount,
			echoCancellation: this.config.echoCancellation,
			noiseSuppression: this.config.noiseSuppression,
			autoGainControl: this.config.autoGainControl,
		})
		this.externalStreamProvided = false
		this.audioStream = stream

		// 验证获取到的音频流
		const audioTracks = this.audioStream.getAudioTracks()
		if (audioTracks.length === 0) {
			throw new Error("未能获取到音频轨道")
		}
	}

	private assignExternalStream(stream: MediaStream): void {
		const audioTracks = stream.getAudioTracks()
		if (audioTracks.length === 0) {
			throw new Error("提供的音频流不包含音轨")
		}
		this.externalStreamProvided = true
		this.audioStream = stream
	}

	private async setupAudioProcessing(): Promise<void> {
		if (!this.audioStream) {
			throw new Error("音频流未初始化")
		}

		// 创建AudioContext
		const AudioContextClass =
			window.AudioContext ||
			(window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
		if (!AudioContextClass) {
			throw new Error("浏览器不支持Web Audio API")
		}

		this.audioContext = new AudioContextClass({
			sampleRate: this.audioStream.getAudioTracks()[0].getSettings().sampleRate,
		})

		console.log("this.audioContext", this.audioContext)

		// 等待AudioContext启动
		if (this.audioContext.state === "suspended") {
			await this.audioContext.resume()
		}

		// 创建和注册AudioWorklet
		await this.createAndRegisterWorklet()

		// 设置音频节点连接
		this.sourceNode = this.audioContext.createMediaStreamSource(this.audioStream)
		this.workletNode = new AudioWorkletNode(this.audioContext, "recorder-processor", {
			processorOptions: {
				targetSampleRate: this.config.sampleRate,
				bufferDuration: this.config.bufferDuration,
				bitsPerSample: this.config.bitsPerSample,
			},
		})

		this.workletNode.port.onmessage = (event) => {
			this.handleAudioData(event.data)
		}

		this.workletNode.port.onmessageerror = (error) => {
			this.emit("error", new Error(`AudioWorklet消息错误: ${error}`))
		}

		// 连接音频节点
		this.sourceNode.connect(this.workletNode)
		// 不连接到destination以避免回音
	}

	private async createAndRegisterWorklet(): Promise<void> {
		if (!this.audioContext) {
			throw new Error("AudioContext未初始化")
		}

		const processorCode = this.generateWorkletCode()
		const processorBlob = new Blob([processorCode], { type: "application/javascript" })
		this.processorUrl = URL.createObjectURL(processorBlob)

		await this.audioContext.audioWorklet.addModule(this.processorUrl)
	}

	private generateWorkletCode(): string {
		return `
			class RecorderProcessor extends AudioWorkletProcessor {
				constructor(options) {
					super();
					this.targetSampleRate = options.processorOptions.targetSampleRate;
					this.bufferDuration = options.processorOptions.bufferDuration || 200;
					this.bitsPerSample = options.processorOptions.bitsPerSample || 16;
					this.sourceSampleRate = sampleRate;
					this.resampleRatio = this.sourceSampleRate / this.targetSampleRate;
					
					// Calculate target buffer size - use larger buffers for better performance
					this.targetBufferSize = Math.floor(this.targetSampleRate * this.bufferDuration / 1000);
					this.buffer = new Float32Array(this.targetBufferSize);
					this.bufferPos = 0;
					
					// Simplified overlap handling - reduce overlap size for performance
					this.overlapSize = Math.min(32, Math.floor(this.targetBufferSize * 0.02)); // Reduce to 2%
					this.previousBuffer = this.overlapSize > 0 ? new Float32Array(this.overlapSize) : null;
					this.hasPreviewBuffer = false;
					
					// Pre-calculate conversion multipliers for performance
					this.int16Scale = 0x7FFF;
					this.int16NegScale = 0x8000;
					this.int24Scale = 0x7FFFFF;
					this.int24NegScale = 0x800000;
					
					// Performance monitoring
					this.packetsProcessed = 0;
					this.lastProcessTime = currentTime;
					
					// Optimize resampling - pre-calculate step size
					this.resampleStep = this.resampleRatio > 1 ? this.resampleRatio : null;
				}
				
				// Optimized conversion functions with reduced branching
				float32ToInt16(buffer) {
					const length = buffer.length;
					const result = new Int16Array(length);
					const int16Scale = this.int16Scale;
					const int16NegScale = this.int16NegScale;
					
					for (let i = 0; i < length; i++) {
						// Clamp values more efficiently
						const sample = buffer[i];
						const clamped = sample > 1 ? 1 : sample < -1 ? -1 : sample;
						result[i] = clamped >= 0 ? clamped * int16Scale : clamped * int16NegScale;
					}
					return result.buffer;
				}
				
				float32ToInt24(buffer) {
					const length = buffer.length;
					const result = new Int32Array(length);
					const int24Scale = this.int24Scale;
					const int24NegScale = this.int24NegScale;
					
					for (let i = 0; i < length; i++) {
						const sample = buffer[i];
						const clamped = sample > 1 ? 1 : sample < -1 ? -1 : sample;
						result[i] = clamped >= 0 ? clamped * int24Scale : clamped * int24NegScale;
					}
					return result.buffer;
				}
				
				float32ToFloat32(buffer) {
					// Direct buffer copy for Float32 - most efficient
					return buffer.buffer.slice();
				}
				
				convertSample(buffer) {
					// Use the most common case (16-bit) as default
					if (this.bitsPerSample === 32) return this.float32ToFloat32(buffer);
					if (this.bitsPerSample === 24) return this.float32ToInt24(buffer);
					return this.float32ToInt16(buffer); // Default and most common
				}
				
				process(inputs) {
					const input = inputs[0];
					if (!input || !input[0]) return true;
					
					const inputData = input[0];
					const inputLength = inputData.length;
					
					// Optimize resampling with fewer branches
					if (this.resampleStep) {
						// Downsampling - optimized loop
						const step = this.resampleStep;
						for (let sourcePos = 0; sourcePos < inputLength && this.bufferPos < this.targetBufferSize; sourcePos += step) {
							this.buffer[this.bufferPos++] = inputData[Math.floor(sourcePos)];
						}
					} else if (this.resampleRatio === 1) {
						// No resampling - direct copy (most efficient)
						const samplesToCopy = Math.min(inputLength, this.targetBufferSize - this.bufferPos);
						this.buffer.set(inputData.subarray(0, samplesToCopy), this.bufferPos);
						this.bufferPos += samplesToCopy;
					} else {
						// Upsampling - simplified linear interpolation
						const ratio = this.resampleRatio;
						for (let targetPos = 0; this.bufferPos < this.targetBufferSize; targetPos++) {
							const sourcePos = targetPos * ratio;
							const index = Math.floor(sourcePos);
							
							if (index >= inputLength - 1) break;
							
							// Linear interpolation
							const frac = sourcePos - index;
							this.buffer[this.bufferPos++] = inputData[index] * (1 - frac) + inputData[index + 1] * frac;
						}
					}
					
					// Process buffer when full
					if (this.bufferPos >= this.targetBufferSize) {
						// Simplified smoothing - only if overlap is significant
						if (this.hasPreviewBuffer && this.previousBuffer && this.overlapSize > 8) {
							// Optimized crossfade - fewer iterations
							const overlapSize = this.overlapSize;
							const invOverlapSize = 1.0 / overlapSize;
							for (let i = 0; i < overlapSize; i++) {
								const fadeIn = i * invOverlapSize;
								this.buffer[i] = this.buffer[i] * fadeIn + this.previousBuffer[i] * (1 - fadeIn);
							}
						}
						
						// Save overlap data for next iteration
						if (this.previousBuffer) {
							const startIndex = this.targetBufferSize - this.overlapSize;
							this.previousBuffer.set(this.buffer.subarray(startIndex, this.targetBufferSize));
							this.hasPreviewBuffer = true;
						}
						
						// Convert and send data
						const convertedData = this.convertSample(this.buffer);
						this.port.postMessage({
							type: 'audioData',
							data: convertedData,
							stats: {
								packetsProcessed: ++this.packetsProcessed,
								latency: currentTime - this.lastProcessTime,
								bufferSize: this.targetBufferSize,
								sampleRate: this.targetSampleRate
							}
						});
						
						this.bufferPos = 0;
						this.lastProcessTime = currentTime;
					}
					
					return true;
				}
			}
			registerProcessor('recorder-processor', RecorderProcessor);
		`
	}

	private handleAudioData(message: {
		type: string
		data: ArrayBuffer
		stats: {
			packetsProcessed: number
			latency: number
			bufferSize: number
			sampleRate: number
		}
	}): void {
		// 防止在清理过程中或已销毁状态下处理音频数据
		if (this.disposed || this.state === "stopping" || this.state === "idle") {
			return
		}

		if (message.type === "audioData") {
			// 更新统计信息
			this.stats.packetsProcessed = message.stats.packetsProcessed
			this.stats.averageLatency = message.stats.latency
			this.stats.totalDuration += (message.stats.bufferSize / message.stats.sampleRate) * 1000

			// 性能监控
			const currentTime = performance.now()
			const processingTime = currentTime - this.lastProcessTime
			this.processingTimes.push(processingTime)

			// 保持最近100个处理时间记录
			if (this.processingTimes.length > 100) {
				this.processingTimes.shift()
			}

			// Adjust performance thresholds for optimized buffer configuration
			// With 200ms buffers, processing should complete within 50ms for good performance
			const performanceThreshold = Math.max(30, (this.config.bufferDuration || 200) * 0.25)
			const criticalThreshold = Math.max(80, (this.config.bufferDuration || 200) * 0.5)

			if (processingTime > performanceThreshold) {
				this.performanceIssueCount++

				// Only log if it's significantly over threshold to reduce noise
				if (processingTime > performanceThreshold * 1.5) {
					logger.log(
						`🐌 [AudioProcessor] Processing delay: ${processingTime.toFixed(
							2,
						)}ms (threshold: ${performanceThreshold.toFixed(2)}ms), data size: ${
							message.data.byteLength
						} bytes`,
					)
				}

				// Critical performance issue detection
				if (processingTime > criticalThreshold) {
					logger.log(
						`⚠️ [AudioProcessor] Critical performance issue - processing delay: ${processingTime.toFixed(
							2,
						)}ms (critical threshold: ${criticalThreshold.toFixed(2)}ms)`,
					)

					// Adaptive buffer adjustment for critical issues
					this.handleCriticalPerformanceIssue(currentTime, processingTime)
				}

				// Check if buffer adjustment is needed
				this.checkBufferAdjustment(currentTime)
			} else {
				// Reset performance issue counter when performing well
				this.performanceIssueCount = Math.max(0, this.performanceIssueCount - 1)
			}

			// 检查数据大小异常
			if (message.data.byteLength > 32 * 1024) {
				// 超过32KB
				logger.log(`📦 [AudioProcessor] 音频数据块异常大: ${message.data.byteLength} bytes`)
			}

			this.lastProcessTime = currentTime
			this.emit("data", message.data)

			// 每50个包输出一次统计
			if (this.stats.packetsProcessed % 50 === 0) {
				const avgProcessTime =
					this.processingTimes.reduce((a, b) => a + b, 0) / this.processingTimes.length
				logger.log(
					`📊 [AudioProcessor] 统计 - 已处理: ${
						this.stats.packetsProcessed
					}个包, 平均处理时间: ${avgProcessTime.toFixed(
						2,
					)}ms, 当前延迟: ${this.stats.averageLatency.toFixed(2)}ms`,
				)
			}
		}
	}

	private handleCriticalPerformanceIssue(currentTime: number, processingTime: number): void {
		// Immediate action for critical performance issues
		if (processingTime > 200) {
			// Extremely high latency - consider emergency fallback
			logger.log(
				`🚨 [AudioProcessor] Extreme performance degradation: ${processingTime.toFixed(
					2,
				)}ms - consider system optimization`,
			)

			// Emit performance warning to allow upper layers to take action
			this.emit(
				"error",
				new Error(
					`Critical performance issue: processing delay ${processingTime.toFixed(
						2,
					)}ms exceeds acceptable limits`,
				),
			)
		}
	}

	private checkBufferAdjustment(currentTime: number): void {
		// Avoid frequent adjustments - wait at least 3 seconds for optimized system
		if (currentTime - this.lastBufferAdjustment < 3000) return

		// Adjust threshold based on buffer size - larger buffers can tolerate more issues
		const adjustmentThreshold = Math.max(
			3,
			Math.floor((this.config.bufferDuration || 200) / 50),
		)

		if (this.performanceIssueCount >= adjustmentThreshold) {
			const currentDuration = this.config.bufferDuration || DEFAULT_BUFFER_DURATION

			if (currentDuration < 400) {
				// Suggest increasing buffer size to reduce processing frequency
				const suggestedDuration = Math.min(currentDuration * 1.3, 400)
				logger.log(
					`🔧 [AudioProcessor] Performance optimization suggestion: increase buffer from ${currentDuration}ms to ${suggestedDuration.toFixed(
						0,
					)}ms to reduce processing frequency`,
				)
			} else {
				// Buffer is already large - might be system-level issues
				logger.log(
					`⚠️ [AudioProcessor] Persistent performance issues with ${currentDuration}ms buffer - consider system resource optimization`,
				)

				// log system-level performance metrics
				const avgProcessTime =
					this.processingTimes.reduce((a, b) => a + b, 0) / this.processingTimes.length
				const maxProcessTime = Math.max(...this.processingTimes)
				logger.log(
					`📊 [AudioProcessor] System performance analysis - avg: ${avgProcessTime.toFixed(
						2,
					)}ms, max: ${maxProcessTime.toFixed(2)}ms, buffer: ${currentDuration}ms`,
				)
			}

			// Reset counter with exponential backoff
			this.performanceIssueCount = Math.max(
				0,
				this.performanceIssueCount - adjustmentThreshold,
			)
			this.lastBufferAdjustment = currentTime
		}
	}

	async stop(): Promise<void> {
		if (this.state === "idle" || this.state === "stopping") {
			return
		}

		this.state = "stopping"
		logger.log("🛑 [AudioProcessor] Stopping audio processing...")

		// 输出最终统计
		if (this.processingTimes.length > 0) {
			const avgProcessTime =
				this.processingTimes.reduce((a, b) => a + b, 0) / this.processingTimes.length
			const maxProcessTime = Math.max(...this.processingTimes)
			logger.log(`📊 [AudioProcessor] 最终统计:`, {
				总包数: this.stats.packetsProcessed,
				总时长: `${this.stats.totalDuration.toFixed(2)}ms`,
				平均处理时间: `${avgProcessTime.toFixed(2)}ms`,
				最大处理时间: `${maxProcessTime.toFixed(2)}ms`,
				平均延迟: `${this.stats.averageLatency.toFixed(2)}ms`,
			})
		}

		try {
			await this.cleanupResources()
		} catch (error) {
			logger.error("资源清理过程中出现错误:", error)
		}

		this.state = "idle"
		this.emit("stopped")
	}

	private async cleanupResources(): Promise<void> {
		// 先断开所有音频节点连接，避免后续操作时产生音频处理
		if (this.sourceNode && this.workletNode) {
			try {
				this.sourceNode.disconnect(this.workletNode)
			} catch (error) {
				logger.error("断开sourceNode连接时出错:", error)
			}
		}

		// 清理 AudioWorkletNode（必须在 AudioContext 关闭前完成）
		if (this.workletNode) {
			try {
				// 1. 先断开所有连接
				this.workletNode.disconnect()
				// 2. 清理端口事件监听器
				this.workletNode.port.onmessage = null
				this.workletNode.port.onmessageerror = null
				// 3. 关闭端口
				this.workletNode.port.close()
			} catch (error) {
				logger.error("清理AudioWorkletNode时出错:", error)
			}
			this.workletNode = null
		}

		// 清理音频源节点
		if (this.sourceNode) {
			try {
				this.sourceNode.disconnect()
			} catch (error) {
				logger.error("清理sourceNode时出错:", error)
			}
			this.sourceNode = null
		}

		// 停止音频流（在AudioContext关闭前）
		if (this.audioStream) {
			try {
				this.audioStream.getTracks().forEach((track) => {
					if (track.readyState === "live") {
						track.stop()
					}
				})
			} catch (error) {
				logger.error("停止音频轨道时出错:", error)
			}
			this.audioStream = null
		}

		// 关闭AudioContext（异步操作，需要等待完成）
		if (this.audioContext && this.audioContext.state !== "closed") {
			try {
				// 使用Promise.race添加5秒超时保护，防止AudioContext关闭操作无限等待
				await Promise.race([
					this.audioContext.close(),
					new Promise<void>((_, reject) =>
						setTimeout(() => reject(new Error("AudioContext关闭超时")), 5000),
					),
				])
				logger.log("AudioContext已成功关闭")
			} catch (error) {
				logger.error("关闭AudioContext时出错:", error)
				// 即使关闭失败也要清理引用
			}
			this.audioContext = null
		}

		// 清理Blob URL
		if (this.processorUrl) {
			try {
				URL.revokeObjectURL(this.processorUrl)
			} catch (error) {
				logger.error("释放Blob URL时出错:", error)
			}
			this.processorUrl = null
		}
	}

	async dispose(): Promise<void> {
		if (this.disposed) return
		this.disposed = true
		logger.log("🗑️ [AudioProcessor] Disposing audio processor...")

		// Log current state for debugging
		const totalListeners = Array.from(this.eventListeners.values()).reduce(
			(sum, set) => sum + set.size,
			0,
		)
		if (totalListeners > 0) {
			logger.log(
				`🔍 [AudioProcessor] Dispose - cleaning up ${totalListeners} event listeners`,
			)
		}

		try {
			// Stop recording and cleanup resources (awaiting for complete cleanup)
			await this.stop()
		} catch (error) {
			logger.error("dispose过程中停止音频处理失败:", error)
		}

		// Clear all event listeners after audio processing has stopped
		if (this.eventListeners.size > 0) {
			logger.log(
				`🧹 [AudioProcessor] Clearing ${
					this.eventListeners.size
				} event type(s) with total ${Array.from(this.eventListeners.values()).reduce(
					(sum, set) => sum + set.size,
					0,
				)} listeners`,
			)
			this.removeAllListeners()
		}

		// Reset all state
		this.stats = { packetsProcessed: 0, totalDuration: 0, averageLatency: 0 }
		this.processingTimes = []
		this.lastProcessTime = 0

		logger.log("✅ [AudioProcessor] Successfully disposed")
	}
}
