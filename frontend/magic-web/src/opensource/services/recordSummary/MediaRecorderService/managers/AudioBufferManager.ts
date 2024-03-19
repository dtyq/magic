/**
 * Audio buffer manager for managing audio data accumulation and chunking
 * 音频缓冲区管理器，用于管理音频数据累积和分片
 */

import type {
	AudioBufferData,
	AudioChunkData,
	SampleDataChunk,
	RecorderCoreConfig,
} from "../types/RecorderTypes"
import { BufferOperationError } from "../types/RecorderErrors"
import type { LoggerInterface } from "../types/RecorderDependencies"

/**
 * Events fired by AudioBufferManager
 * AudioBufferManager 触发的事件
 */
export interface AudioBufferManagerEvents {
	onChunkReady?: (chunkData: AudioChunkData) => void
	onProgress?: (duration: number, totalSamples: number) => void
	onChunkTimeout?: (expectedTime: number, actualTime: number, chunkIndex: number) => void
}

/**
 * AudioBufferManager manages audio data buffering and chunk generation
 * AudioBufferManager 管理音频数据缓冲和分片生成
 */
export class AudioBufferManager {
	private audioBuffer: Int16Array[] = []
	private bufferDuration = 0
	private sampleDataChunk: SampleDataChunk | null = null
	// Pre-allocated buffer for better performance
	private preallocatedBuffer: Int16Array | null = null
	private bufferOffset = 0
	private readonly initialCapacity: number
	// Chunk timeout monitoring
	private lastChunkTime: number = Date.now()
	private chunkTimeoutCheckInterval: NodeJS.Timeout | null = null
	private currentChunkIndex: number = 0
	// AudioContext-based time tracking for reliable background operation
	private audioContext: AudioContext | null = null
	private lastCheckTime: number = 0 // AudioContext.currentTime of last chunk
	private recordingStartTime: number = 0 // AudioContext.currentTime when recording started
	private lastKnownSampleRate: number = 48000 // Default sample rate

	constructor(
		private readonly config: RecorderCoreConfig,
		private readonly events: AudioBufferManagerEvents,
		private readonly logger: LoggerInterface,
		audioContext?: AudioContext,
	) {
		// Pre-calculate initial capacity based on chunk duration and typical sample rate
		// Assume max 48kHz sample rate for safe pre-allocation
		const maxSampleRate = 48000
		this.initialCapacity = Math.ceil(maxSampleRate * this.config.chunkDuration * 1.2) // 20% buffer

		// Store AudioContext reference for reliable time tracking
		this.audioContext = audioContext || null

		// Start chunk timeout monitoring
		this.startChunkTimeoutMonitoring()
	}

	/**
	 * Add audio data to buffer
	 * 添加音频数据到缓冲区
	 */
	addData(buffer: Int16Array, sampleRate: number): void {
		try {
			// Record sample rate for silence generation
			this.lastKnownSampleRate = sampleRate

			// Check time using AudioContext.currentTime for reliable background operation
			// This check happens on every audio callback, ensuring high frequency even in background
			if (this.audioContext) {
				const currentTime = this.audioContext.currentTime
				const elapsedTime = currentTime - this.lastCheckTime

				if (elapsedTime >= this.config.chunkDuration) {
					this.logger.log("Audio-callback-driven chunk generation", {
						elapsedTime,
						currentTime,
						lastCheckTime: this.lastCheckTime,
						chunkDuration: this.config.chunkDuration,
					})

					// Force flush buffer with silence filling if needed
					this.flushBuffer(sampleRate, true)
					this.lastCheckTime = currentTime
					return // Skip data processing for this callback
				}
			}

			// Initialize pre-allocated buffer on first use
			if (!this.preallocatedBuffer) {
				this.preallocatedBuffer = new Int16Array(this.initialCapacity)
				this.bufferOffset = 0
			}

			// Check if we need to expand capacity
			if (this.bufferOffset + buffer.length > this.preallocatedBuffer.length) {
				// Capacity exceeded, fall back to array method for this chunk
				this.logger.warn("Pre-allocated buffer capacity exceeded, using fallback", {
					currentOffset: this.bufferOffset,
					newDataLength: buffer.length,
					capacity: this.preallocatedBuffer.length,
				})

				// Flush current pre-allocated buffer to array
				if (this.bufferOffset > 0) {
					this.audioBuffer.push(
						new Int16Array(this.preallocatedBuffer.buffer, 0, this.bufferOffset),
					)
				}

				// Add new data to array
				this.audioBuffer.push(new Int16Array(buffer))

				// Reset pre-allocated buffer
				this.preallocatedBuffer = new Int16Array(this.initialCapacity)
				this.bufferOffset = 0
			} else {
				// Copy data to pre-allocated buffer
				this.preallocatedBuffer.set(buffer, this.bufferOffset)
				this.bufferOffset += buffer.length
			}

			// Calculate duration based on total accumulated samples
			const arrayTotalSamples = this.audioBuffer.reduce((sum, buf) => sum + buf.length, 0)
			const totalSampleCount = arrayTotalSamples + this.bufferOffset
			this.bufferDuration = totalSampleCount / sampleRate

			// Notify about processing progress
			this.events.onProgress?.(this.bufferDuration, totalSampleCount)

			// Check if we have enough data for a chunk (based on audio data)
			// This is a fallback in case AudioContext time check doesn't trigger
			if (this.bufferDuration >= this.config.chunkDuration) {
				this.flushBuffer(sampleRate, false)
			}
		} catch (error) {
			this.logger.error("Failed to add data to buffer:", error)
			throw new BufferOperationError("Failed to add audio data to buffer", error as Error)
		}
	}

	/**
	 * Process audio data using Recorder.SampleData for continuous processing
	 * 使用 Recorder.SampleData 处理音频数据以支持连续处理
	 */
	processSampleData(
		buffers: Int16Array[],
		bufferSampleRate: number,
		targetSampleRate: number,
		sampleDataFn: (
			buffers: Int16Array[],
			bufferSampleRate: number,
			targetSampleRate: number,
			prevChunk: SampleDataChunk | null,
		) => SampleDataChunk,
	): Int16Array | null {
		try {
			if (buffers.length === 0) {
				return null
			}

			// Use SampleData for continuous data processing and sample rate conversion
			const chunk = sampleDataFn(
				buffers,
				bufferSampleRate,
				targetSampleRate,
				this.sampleDataChunk,
			)

			// Save chunk for next processing (required for continuous extraction)
			this.sampleDataChunk = chunk

			// Extract the new PCM data (Int16Array, 16-bit LE)
			const newPcm = chunk.data

			if (newPcm.length === 0) {
				return null
			}

			return newPcm
		} catch (error) {
			this.logger.error("Failed to process sample data:", error)
			throw new BufferOperationError("Failed to process sample data", error as Error)
		}
	}

	/**
	 * Flush buffer and generate chunk data
	 * 清空缓冲区并生成分片数据
	 * @param sampleRate - Sample rate for the chunk
	 * @param fillSilence - Whether to fill silence if buffer is insufficient
	 */
	private flushBuffer(sampleRate: number, fillSilence: boolean = false): void {
		// Update chunk time tracking
		const now = Date.now()
		this.lastChunkTime = now
		this.currentChunkIndex++

		// Update AudioContext-based time tracking
		if (this.audioContext) {
			this.lastCheckTime = this.audioContext.currentTime
		}

		const arrayTotalSamples = this.audioBuffer.reduce((sum, buf) => sum + buf.length, 0)
		const totalSampleCount = arrayTotalSamples + this.bufferOffset

		// Calculate expected samples for exact chunk duration
		const expectedSamplesForChunk = Math.floor(sampleRate * this.config.chunkDuration)

		// If no data and no silence filling, skip
		if (totalSampleCount === 0 && !fillSilence) {
			return
		}

		try {
			let mergedBuffer: Int16Array

			// If we need to fill silence to meet chunk duration
			if (fillSilence && totalSampleCount < expectedSamplesForChunk) {
				const silenceSamples = expectedSamplesForChunk - totalSampleCount
				this.logger.log("Filling silence to meet chunk duration", {
					existingSamples: totalSampleCount,
					silenceSamples,
					totalSamples: expectedSamplesForChunk,
				})

				// Create buffer with exact chunk duration
				mergedBuffer = new Int16Array(expectedSamplesForChunk)
				let offset = 0

				// Copy existing audio data
				for (const buffer of this.audioBuffer) {
					mergedBuffer.set(buffer, offset)
					offset += buffer.length
				}

				if (this.bufferOffset > 0 && this.preallocatedBuffer) {
					mergedBuffer.set(
						new Int16Array(this.preallocatedBuffer.buffer, 0, this.bufferOffset),
						offset,
					)
					offset += this.bufferOffset
				}

				// Remaining space is already filled with zeros (silence)
			} else {
				// Normal flush without silence filling
				if (totalSampleCount === 0) {
					return
				}

				// Optimize merging based on buffer state
				if (this.audioBuffer.length === 0 && this.bufferOffset > 0) {
					// Only pre-allocated buffer has data - use it directly
					if (!this.preallocatedBuffer) {
						throw new BufferOperationError("Pre-allocated buffer is null", new Error())
					}
					mergedBuffer = new Int16Array(
						this.preallocatedBuffer.buffer,
						0,
						this.bufferOffset,
					)
				} else if (this.audioBuffer.length === 1 && this.bufferOffset === 0) {
					// Only one buffer in array - use it directly
					mergedBuffer = this.audioBuffer[0]
				} else {
					// Multiple buffers - need to merge
					mergedBuffer = new Int16Array(totalSampleCount)
					let offset = 0

					// Copy array buffers
					for (const buffer of this.audioBuffer) {
						mergedBuffer.set(buffer, offset)
						offset += buffer.length
					}

					// Copy pre-allocated buffer
					if (this.bufferOffset > 0) {
						if (!this.preallocatedBuffer) {
							throw new BufferOperationError(
								"Pre-allocated buffer is null",
								new Error(),
							)
						}
						mergedBuffer.set(
							new Int16Array(this.preallocatedBuffer.buffer, 0, this.bufferOffset),
							offset,
						)
					}
				}
			}

			// Calculate actual duration based on merged buffer
			const actualDuration = mergedBuffer.length / sampleRate

			// Create chunk data
			const chunkData: AudioChunkData = {
				pcmData: mergedBuffer,
				sampleRate,
				bitRate: this.config.bitRate,
				duration: actualDuration,
			}

			this.logger.log("Buffer flushed", {
				samples: mergedBuffer.length,
				duration: actualDuration,
				sampleRate,
				arrayBuffers: this.audioBuffer.length,
				preallocatedOffset: this.bufferOffset,
				silenceFilled: fillSilence && totalSampleCount < expectedSamplesForChunk,
			})

			// Notify about chunk ready
			this.events.onChunkReady?.(chunkData)

			// Clear buffer for next chunk
			this.audioBuffer = []
			this.bufferDuration = 0
			this.bufferOffset = 0
			// Reset pre-allocated buffer for reuse
			if (this.preallocatedBuffer) {
				this.preallocatedBuffer = new Int16Array(this.initialCapacity)
			}

			// Note: Don't reset sampleDataChunk here as it's needed for continuous processing
		} catch (error) {
			this.logger.error("Failed to flush buffer:", error)
			throw new BufferOperationError("Failed to flush audio buffer", error as Error)
		}
	}

	/**
	 * Force flush current buffer regardless of duration
	 * 强制清空当前缓冲区，无论时长如何
	 */
	forceFlush(sampleRate: number): void {
		if (this.audioBuffer.length > 0 || this.bufferOffset > 0) {
			this.flushBuffer(sampleRate, false)
		}
	}

	/**
	 * Get current buffer state
	 * 获取当前缓冲区状态
	 */
	getBufferState(): AudioBufferData {
		const totalSamples = this.audioBuffer.reduce((sum, buf) => sum + buf.length, 0)
		return {
			buffers: [...this.audioBuffer],
			duration: this.bufferDuration,
			totalSamples,
		}
	}

	/**
	 * Clear all buffer data
	 * 清空所有缓冲区数据
	 */
	clear(): void {
		this.stopChunkTimeoutMonitoring()
		this.audioBuffer = []
		this.bufferDuration = 0
		this.bufferOffset = 0
		this.preallocatedBuffer = null
		this.sampleDataChunk = null
		this.logger.log("Buffer cleared")
	}

	/**
	 * Get current buffer duration
	 * 获取当前缓冲区时长
	 */
	getDuration(): number {
		return this.bufferDuration
	}

	/**
	 * Check if buffer has data
	 * 检查缓冲区是否有数据
	 */
	hasData(): boolean {
		return this.audioBuffer.length > 0 || this.bufferOffset > 0
	}

	/**
	 * Start monitoring chunk generation timeout
	 * 启动分片生成超时监控
	 */
	private startChunkTimeoutMonitoring(): void {
		const checkInterval = this.config.chunkDuration * 1000 // Check every chunk duration
		const timeoutThreshold = this.config.chunkDuration * 2 // Alert if 2x chunk duration passed

		this.chunkTimeoutCheckInterval = setInterval(() => {
			const now = Date.now()
			const elapsedTime = (now - this.lastChunkTime) / 1000 // seconds

			if (elapsedTime > timeoutThreshold) {
				this.logger.error("Chunk generation timeout detected", {
					expectedInterval: this.config.chunkDuration,
					actualElapsed: elapsedTime,
					lastChunkIndex: this.currentChunkIndex,
					bufferDuration: this.bufferDuration,
				})

				// 上报监控：分片生成超时（可能原因：音频流中断、音频数据为空、系统资源不足）
				// Report: Chunk generation timeout (audio stream interrupted, no audio data, or system resource shortage)
				this.logger.report({
					namespace: "recordingChunkTimeout",
					data: {
						description: "录音分片生成超时",
						expectedChunkInterval: this.config.chunkDuration,
						actualElapsedTime: elapsedTime,
						lastChunkIndex: this.currentChunkIndex,
						bufferDuration: this.bufferDuration,
						possibleCauses: "音频流已中断、没有音频数据输入、系统资源不足",
						timestamp: now,
					},
				})

				// Notify via event
				this.events.onChunkTimeout?.(
					this.config.chunkDuration,
					elapsedTime,
					this.currentChunkIndex,
				)
			}
		}, checkInterval)
	}

	/**
	 * Stop chunk timeout monitoring
	 * 停止分片超时监控
	 */
	private stopChunkTimeoutMonitoring(): void {
		if (this.chunkTimeoutCheckInterval) {
			clearInterval(this.chunkTimeoutCheckInterval)
			this.chunkTimeoutCheckInterval = null
		}
	}

	/**
	 * Set AudioContext for time tracking
	 * 设置用于时间追踪的 AudioContext
	 */
	setAudioContext(audioContext: AudioContext): void {
		this.audioContext = audioContext
		this.logger.log("AudioContext set for time tracking")
	}

	/**
	 * Check time and flush buffer if needed (called by Web Worker for silence periods)
	 * 检查时间并在需要时清空缓冲区（由 Web Worker 在静音时段调用）
	 */
	checkTimeAndFlush(): void {
		if (!this.audioContext) {
			return
		}

		const currentTime = this.audioContext.currentTime
		const elapsedTime = currentTime - this.lastCheckTime

		if (elapsedTime >= this.config.chunkDuration) {
			this.logger.log("Worker-driven chunk generation (silence period)", {
				elapsedTime,
				currentTime,
				lastCheckTime: this.lastCheckTime,
				chunkDuration: this.config.chunkDuration,
			})

			// Generate pure silence chunk
			this.flushBuffer(this.lastKnownSampleRate, true)
			this.lastCheckTime = currentTime
		}
	}

	/**
	 * Reset recording time tracking (call when recording starts)
	 * 重置录制时间跟踪（录制开始时调用）
	 */
	resetTimeTracking(): void {
		if (this.audioContext) {
			const now = this.audioContext.currentTime
			this.recordingStartTime = now
			this.lastCheckTime = now
			this.logger.log("Recording time tracking reset using AudioContext.currentTime", {
				currentTime: now,
			})
		} else {
			this.logger.warn("AudioContext not available for time tracking")
		}

		this.lastChunkTime = Date.now()
		this.currentChunkIndex = 0
	}

	/**
	 * Get total recording duration based on AudioContext time
	 * 获取基于 AudioContext 时间的总录制时长
	 */
	getTotalRecordingDuration(): number {
		if (this.audioContext) {
			return this.audioContext.currentTime - this.recordingStartTime
		}
		return 0
	}
}
