/**
 * AudioWorklet Processor for real-time audio recording
 * 实时音频录制的 AudioWorklet 处理器
 *
 * This processor runs in the audio rendering thread (separate from main thread)
 * providing better performance and reliability than ScriptProcessorNode
 * 此处理器在音频渲染线程中运行（独立于主线程），
 * 提供比 ScriptProcessorNode 更好的性能和可靠性
 */

// AudioWorklet global types
// AudioWorklet 全局类型
declare class AudioWorkletProcessor {
	readonly port: MessagePort
	process(
		inputs: Float32Array[][],
		outputs: Float32Array[][],
		parameters: Record<string, Float32Array>,
	): boolean
}

declare function registerProcessor(name: string, processorCtor: typeof AudioWorkletProcessor): void

/**
 * Message types for communication between main thread and worklet
 * 主线程和 worklet 之间通信的消息类型
 */
interface WorkletMessage {
	type: "audioData" | "state" | "error" | "metrics"
	data?:
		| ArrayBuffer
		| {
				processedSamples: number
				messagesCount: number
				errorsCount: number
				droppedFrames: number
				currentTime: number
		  }
	length?: number
	state?: "recording" | "paused"
	error?: string
}

/**
 * State command from main thread
 * 来自主线程的状态命令
 */
interface StateCommand {
	type: "state"
	state: "recording" | "paused"
}

/**
 * RecorderWorkletProcessor - Audio processor for recording
 * RecorderWorkletProcessor - 用于录音的音频处理器
 */
class RecorderWorkletProcessor extends AudioWorkletProcessor {
	private isRecording = false
	private isPaused = false
	private processedSamples = 0
	private lastMetricsTime = 0
	private metricsInterval = 5000 // Send metrics every 5 seconds
	private messagesCount = 0
	private errorsCount = 0
	private droppedFrames = 0

	constructor() {
		super()
		this.lastMetricsTime = currentTime

		// Listen for state changes from main thread
		// 监听来自主线程的状态变化
		this.port.onmessage = (event: MessageEvent<StateCommand>) => {
			if (event.data.type === "state") {
				const state = event.data.state
				this.isRecording = state === "recording"
				this.isPaused = state === "paused"

				// Send acknowledgment
				this.port.postMessage({
					type: "state",
					state,
				})
			}
		}
	}

	/**
	 * Process audio data
	 * 处理音频数据
	 *
	 * @param inputs - Input audio data (Float32Array)
	 * @param _outputs - Output audio data (not used in recording)
	 * @param _parameters - Audio parameters (not used)
	 * @returns true to keep processor alive
	 */
	process(
		inputs: Float32Array[][],
		_outputs: Float32Array[][],
		_parameters: Record<string, Float32Array>,
	): boolean {
		// Send periodic metrics
		// 定期发送性能指标
		if (currentTime - this.lastMetricsTime >= this.metricsInterval / 1000) {
			this.sendMetrics()
			this.lastMetricsTime = currentTime
		}

		// Only process if recording and not paused
		// 仅在录制且未暂停时处理
		if (!this.isRecording || this.isPaused) {
			return true
		}

		const input = inputs[0]
		if (!input || input.length === 0) {
			this.droppedFrames++
			return true
		}

		// Get the first channel (mono)
		// 获取第一个声道（单声道）
		const channelData = input[0]
		if (!channelData || channelData.length === 0) {
			this.droppedFrames++
			return true
		}

		try {
			// Convert Float32Array to Int16Array
			// 将 Float32Array 转换为 Int16Array
			const buffer = new Int16Array(channelData.length)

			for (let i = 0; i < channelData.length; i++) {
				// Clamp value to [-1, 1] range
				const s = Math.max(-1, Math.min(1, channelData[i]))
				// Convert to 16-bit PCM
				buffer[i] = s < 0 ? s * 0x8000 : s * 0x7fff
			}

			this.processedSamples += buffer.length
			this.messagesCount++

			// Send audio data to main thread using transferable
			// 使用可转移对象将音频数据发送到主线程
			const message: WorkletMessage = {
				type: "audioData",
				data: buffer.buffer,
				length: buffer.length,
			}

			// Use transferable to avoid copying large buffers
			// 使用可转移对象避免复制大缓冲区
			this.port.postMessage(message, [buffer.buffer])
		} catch (error) {
			this.errorsCount++

			// Send error to main thread
			// 向主线程发送错误
			const errorMessage: WorkletMessage = {
				type: "error",
				error: error instanceof Error ? error.message : String(error),
			}
			this.port.postMessage(errorMessage)
		}

		return true // Keep processor alive
	}

	/**
	 * Send performance metrics to main thread
	 * 向主线程发送性能指标
	 */
	private sendMetrics(): void {
		const metrics = {
			type: "metrics",
			data: {
				processedSamples: this.processedSamples,
				messagesCount: this.messagesCount,
				errorsCount: this.errorsCount,
				droppedFrames: this.droppedFrames,
				currentTime: currentTime,
			},
		}

		this.port.postMessage(metrics)

		// Reset counters
		this.messagesCount = 0
		this.errorsCount = 0
		this.droppedFrames = 0
	}
}

// Register the processor
// 注册处理器
registerProcessor("recorder-worklet-processor", RecorderWorkletProcessor)
