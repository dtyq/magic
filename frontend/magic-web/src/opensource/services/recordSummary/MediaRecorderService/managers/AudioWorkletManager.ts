/**
 * AudioWorklet manager for loading and managing AudioWorklet processors
 * AudioWorklet 管理器，用于加载和管理 AudioWorklet 处理器
 */

import type { LoggerInterface } from "../types/RecorderDependencies"
import { RecorderError } from "../types/RecorderErrors"

/**
 * AudioWorklet metrics data
 * AudioWorklet 性能指标数据
 */
export interface WorkletMetrics {
	processedSamples: number
	messagesCount: number
	errorsCount: number
	droppedFrames: number
	currentTime: number
}

/**
 * Message types from AudioWorklet processor
 * 来自 AudioWorklet 处理器的消息类型
 */
export interface WorkletMessage {
	type: "audioData" | "state" | "error" | "metrics"
	data?: ArrayBuffer | WorkletMetrics
	length?: number
	state?: "recording" | "paused"
	error?: string
}

/**
 * Metrics callback type
 * 性能指标回调类型
 */
export type MetricsCallback = (metrics: WorkletMetrics) => void

/**
 * Audio data callback type
 * 音频数据回调类型
 */
export type AudioDataCallback = (buffer: Int16Array) => void

/**
 * Error callback type
 * 错误回调类型
 */
export type ErrorCallback = (error: Error) => void

/**
 * AudioWorkletManager manages AudioWorklet lifecycle and communication
 * AudioWorkletManager 管理 AudioWorklet 生命周期和通信
 */
export class AudioWorkletManager {
	private workletNode: AudioWorkletNode | null = null
	private isWorkletLoaded = false
	private readonly workletName = "recorder-worklet-processor"

	constructor(
		private readonly logger: LoggerInterface,
		private readonly workletPath?: string,
	) {}

	/**
	 * Load AudioWorklet module
	 * 加载 AudioWorklet 模块
	 */
	async loadWorklet(audioContext: AudioContext): Promise<void> {
		if (this.isWorkletLoaded) {
			this.logger.log("AudioWorklet already loaded")
			return
		}

		try {
			// Determine worklet path
			// 确定 worklet 路径
			const path = this.getWorkletPath()

			this.logger.log("Loading AudioWorklet from:", path)

			// Load worklet module
			// 加载 worklet 模块
			await audioContext.audioWorklet.addModule(path)

			this.isWorkletLoaded = true
			this.logger.log("AudioWorklet loaded successfully")
		} catch (error) {
			this.logger.error("Failed to load AudioWorklet:", error)
			throw new RecorderError(
				"Failed to load AudioWorklet module",
				"WORKLET_LOAD_FAILED",
				error as Error,
			)
		}
	}

	/**
	 * Create AudioWorkletNode
	 * 创建 AudioWorkletNode
	 */
	createWorkletNode(audioContext: AudioContext): AudioWorkletNode {
		if (!this.isWorkletLoaded) {
			throw new RecorderError(
				"AudioWorklet module not loaded. Call loadWorklet() first.",
				"WORKLET_NOT_LOADED",
			)
		}

		try {
			this.logger.log("Creating AudioWorkletNode")

			// Create worklet node
			// 创建 worklet 节点
			this.workletNode = new AudioWorkletNode(audioContext, this.workletName, {
				numberOfInputs: 1,
				numberOfOutputs: 1,
				channelCount: 1, // Mono
			})

			this.logger.log("AudioWorkletNode created successfully")

			return this.workletNode
		} catch (error) {
			this.logger.error("Failed to create AudioWorkletNode:", error)
			throw new RecorderError(
				"Failed to create AudioWorkletNode",
				"WORKLET_NODE_CREATE_FAILED",
				error as Error,
			)
		}
	}

	/**
	 * Set up message handler for worklet communication
	 * 设置 worklet 通信的消息处理器
	 */
	setupMessageHandler(
		node: AudioWorkletNode,
		onAudioData: AudioDataCallback,
		onError?: ErrorCallback,
		onMetrics?: MetricsCallback,
	): void {
		node.port.onmessage = (event: MessageEvent<WorkletMessage>) => {
			const message = event.data

			switch (message.type) {
				case "audioData":
					if (message.data && message.length && message.data instanceof ArrayBuffer) {
						try {
							// Convert ArrayBuffer back to Int16Array
							// 将 ArrayBuffer 转换回 Int16Array
							const buffer = new Int16Array(message.data, 0, message.length)
							onAudioData(buffer)
						} catch (error) {
							this.logger.error("Failed to process audio data:", error)
							onError?.(
								new RecorderError(
									"Failed to process audio data from worklet",
									"WORKLET_DATA_PROCESS_FAILED",
									error as Error,
								),
							)
						}
					}
					break

				case "error":
					this.logger.error("Error from AudioWorklet:", message.error)
					onError?.(
						new RecorderError(
							`AudioWorklet error: ${message.error}`,
							"WORKLET_RUNTIME_ERROR",
						),
					)
					break

				case "state":
					this.logger.log("AudioWorklet state changed:", message.state)
					break

				case "metrics":
					if (
						message.data &&
						typeof message.data === "object" &&
						"processedSamples" in message.data
					) {
						onMetrics?.(message.data as WorkletMetrics)
					}
					break

				default:
					this.logger.warn("Unknown message type from worklet:", message)
			}
		}

		// Handle message channel errors
		// 处理消息通道错误
		node.port.onmessageerror = (event) => {
			this.logger.error("Message error from AudioWorklet:", event)
			onError?.(new RecorderError("AudioWorklet message error", "WORKLET_MESSAGE_ERROR"))
		}

		this.logger.log("AudioWorklet message handler set up")
	}

	/**
	 * Send state command to worklet
	 * 向 worklet 发送状态命令
	 */
	setState(state: "recording" | "paused"): void {
		if (!this.workletNode) {
			this.logger.warn("Cannot set state: worklet node not created")
			return
		}

		try {
			this.workletNode.port.postMessage({
				type: "state",
				state,
			})
			this.logger.log("State sent to worklet:", state)
		} catch (error) {
			this.logger.error("Failed to send state to worklet:", error)
		}
	}

	/**
	 * Clean up resources
	 * 清理资源
	 */
	async cleanup(): Promise<void> {
		try {
			if (this.workletNode) {
				// Disconnect worklet node
				// 断开 worklet 节点连接
				this.workletNode.disconnect()
				this.workletNode.port.close()
				this.workletNode = null
				this.logger.log("AudioWorkletNode disconnected")
			}

			// Note: We don't reset isWorkletLoaded because the module
			// remains loaded in the AudioContext for reuse
			// 注意：我们不重置 isWorkletLoaded，因为模块
			// 仍然加载在 AudioContext 中以供重用
		} catch (error) {
			this.logger.error("Error during AudioWorklet cleanup:", error)
		}
	}

	/**
	 * Get worklet path
	 * 获取 worklet 路径
	 */
	private getWorkletPath(): string {
		// Use custom path if provided
		// 如果提供了自定义路径则使用
		if (this.workletPath) {
			return this.workletPath
		}

		// In development, Vite serves the TypeScript file directly
		// 在开发环境中，Vite 直接提供 TypeScript 文件
		if (import.meta.env.DEV) {
			return "/src/opensource/services/recordSummary/MediaRecorderService/worklets/recorder-worklet-processor.ts"
		}

		// In production, use the compiled JavaScript file
		// 在生产环境中，使用编译后的 JavaScript 文件
		return "/worklets/recorder-worklet-processor.js"
	}

	/**
	 * Check if worklet is loaded
	 * 检查 worklet 是否已加载
	 */
	isLoaded(): boolean {
		return this.isWorkletLoaded
	}

	/**
	 * Get worklet node
	 * 获取 worklet 节点
	 */
	getWorkletNode(): AudioWorkletNode | null {
		return this.workletNode
	}
}
