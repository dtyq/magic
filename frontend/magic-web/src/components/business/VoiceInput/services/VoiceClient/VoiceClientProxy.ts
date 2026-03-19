/**
 * VoiceClientProxy - Main thread proxy for Web Worker VoiceClient
 * Provides the same API as the original VoiceClient but runs in a Web Worker
 */

import type { VoiceConfig, ConnectionState, VoiceClientEvents, AudioStats } from "./types"
import type { WorkerMessage, MainThreadMessage, PendingRequest } from "./worker-types"
import Worker from "./voice-client.worker?worker"
import { logger as Logger } from "@/utils/log"

const logger = Logger.createLogger("VoiceClientProxy", { enableConfig: { console: false } })

export class VoiceClientProxy {
	private worker: Worker | null = null
	private events: Partial<VoiceClientEvents> = {}
	private pendingRequests = new Map<string, PendingRequest>()
	private disposed = false
	private requestIdCounter = 0
	private workerReady = false

	// State tracking
	private _currentState: ConnectionState = "disconnected"
	private _isConnected = false
	private _stats: AudioStats = { totalBytes: 0, totalDuration: 0, packetCount: 0 }
	private _connectionId = ""

	constructor(private refreshToken: () => Promise<VoiceConfig>) {
		logger.log("[Proxy] Initializing VoiceClientProxy")
		this.initializeWorker()
		this.exposeDebugMethods()
	}

	/**
	 * Expose debug methods to window object for development and debugging
	 */
	private exposeDebugMethods(): void {
		// Export packet logs functionality
		const exportPacketLogs = (connectionId: string): void => {
			if (!this.worker || !this.workerReady) {
				console.error("[VoiceClientProxy] Worker not available for exporting packet logs")
				return
			}

			const message: WorkerMessage = {
				type: "exportPacketLogs",
				id: this.generateRequestId(),
				payload: { connectionId },
			}

			this.worker.postMessage(message)
			logger.log(`[Proxy] Export packet logs requested for connection: ${connectionId}`)
		}

		// Toggle packet logging to IndexedDB functionality
		const setPacketLoggingEnabled = (enabled: boolean): void => {
			if (!this.worker || !this.workerReady) {
				console.error("[VoiceClientProxy] Worker not available for setting packet logging")
				return
			}

			const message: WorkerMessage = {
				type: "setPacketLoggingEnabled",
				id: this.generateRequestId(),
				payload: { enabled },
			}

			this.worker.postMessage(message)
			logger.log(`[Proxy] Packet logging ${enabled ? "enabled" : "disabled"}`)
			console.log(
				`[VoiceClientProxy] Packet logging to IndexedDB has been ${enabled ? "enabled" : "disabled"
				}`,
			)
		}

		// Add to window object with proper typing
		if (typeof window !== "undefined") {
			// Extend window interface for better type checking
			; (window as any).voiceClientDebug = {
				exportPacketLogs,
				setPacketLoggingEnabled,
			}

				// Backward compatibility - keep direct methods on window
				; (window as any).exportPacketLogs = exportPacketLogs
				; (window as any).setPacketLoggingEnabled = setPacketLoggingEnabled
		}
	}

	private async initializeWorker(): Promise<void> {
		try {
			logger.log("[Proxy] Creating Voice Worker")
			// Create worker from the worker file
			this.worker = new Worker()

			this.worker.onmessage = this.handleWorkerMessage.bind(this)
			this.worker.onerror = this.handleWorkerError.bind(this)
			this.worker.onmessageerror = this.handleWorkerMessageError.bind(this)

			logger.log("[Proxy] Waiting for worker to be ready")
			// Wait for worker to be ready
			await this.waitForWorkerReady()
			logger.log("[Proxy] Worker initialization completed successfully")
		} catch (error) {
			logger.error(`[Proxy] Failed to initialize Voice Worker: ${(error as Error).message}`)
			throw new Error(`Failed to initialize Voice Worker: ${(error as Error).message}`)
		}
	}

	private waitForWorkerReady(): Promise<void> {
		return new Promise((resolve, reject) => {
			const timeout = setTimeout(() => {
				logger.error("[Proxy] Worker initialization timeout after 5 seconds")
				reject(new Error("Worker initialization timeout"))
			}, 5000)

			const checkReady = (event: MessageEvent<MainThreadMessage>) => {
				if (event.data.type === "ready") {
					logger.log("[Proxy] Worker is ready")
					clearTimeout(timeout)
					this.workerReady = true
					if (this.worker) {
						this.worker.removeEventListener("message", checkReady)
					}
					resolve()
				}
			}

			if (this.worker) {
				this.worker.addEventListener("message", checkReady)
			} else {
				logger.error("[Proxy] Worker not initialized when waiting for ready state")
				reject(new Error("Worker not initialized"))
			}
		})
	}

	private handleWorkerMessage(event: MessageEvent<MainThreadMessage>): void {
		const message = event.data
		switch (message.type) {
			case "ready":
				logger.log("[Proxy] Received ready message from worker")
				this.workerReady = true
				break
			case "response":
				logger.log(
					`[Proxy] Received response for request ${message.id}, success: ${message.success}`,
				)
				this.handleResponse(message.id, message.success, message.error)
				break
			case "event":
				logger.log(`[Proxy] Received event: ${message.eventType}`)
				this.handleEvent(message.eventType, message.payload)
				break
			case "result":
				logger.log("[Proxy] Received result from worker")
				this.emit("result", message.payload)
				break
			case "stateChange":
				const previousState = this._currentState
				const previousConnected = this._isConnected
				this._currentState = message.payload.state
				this._isConnected = message.payload.isConnected
				logger.log(
					`[Proxy] State changed: ${previousState} -> ${this._currentState}, connected: ${previousConnected} -> ${this._isConnected}`,
				)
				break
			case "statsUpdate":
				this._stats = message.payload
				logger.log(
					`[Proxy] Stats updated - bytes: ${this._stats.totalBytes}, duration: ${this._stats.totalDuration}, packets: ${this._stats.packetCount}`,
				)
				break
			case "exportPacketLogs":
				const blob = message.payload.blob
				logger.log("[Proxy] Received exportPacketLogs message from worker", blob)
				if (blob && blob.size > 0) {
					const url = URL.createObjectURL(blob)
					const link = document.createElement("a")
					const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
					link.href = url
					link.download = `packet-logs-${timestamp}.zip`
					link.click()
					URL.revokeObjectURL(url)
					console.log("[VoiceClientProxy] Packet logs exported successfully")
				} else {
					console.warn("[VoiceClientProxy] No packet logs available to export")
				}
				break
			default:
				logger.warn("[Proxy] Unknown message from worker:", message)
		}
	}

	private handleWorkerError(error: ErrorEvent): void {
		logger.error("[Proxy] Worker error:", error)
		this.emit("error", `Worker error: ${error.message}`, "WORKER_ERROR")
	}

	private handleWorkerMessageError(error: MessageEvent): void {
		logger.error("[Proxy] Worker message error:", error)
		this.emit("error", "Worker message error", "WORKER_MESSAGE_ERROR")
	}

	private handleResponse(id: string, success: boolean, error?: string): void {
		const pending = this.pendingRequests.get(id)
		if (pending) {
			this.pendingRequests.delete(id)
			if (success) {
				pending.resolve()
			} else {
				pending.reject(new Error(error || "Unknown error"))
			}
		}
	}

	private handleEvent(eventType: string, payload: unknown): void {
		const typedPayload = payload as Record<string, unknown>
		switch (eventType) {
			case "log":
				this.emit(
					"log",
					typedPayload.message as string,
					typedPayload.type as "info" | "success" | "error" | "warning",
				)
				break
			case "error":
				this.emit(
					"error",
					typedPayload.message as string,
					typedPayload.code as string | number | undefined,
				)
				break
			case "status":
				this.emit(
					"status",
					typedPayload.message as string,
					typedPayload.state as
					| "connecting"
					| "connected"
					| "recording"
					| "error"
					| "reconnecting"
					| "stop",
				)
				break
			case "open":
				this.emit("open")
				break
			case "close":
				this.emit(
					"close",
					typedPayload.code as number | undefined,
					typedPayload.reason as string | undefined,
				)
				break
			case "retry":
				this.emit(
					"retry",
					typedPayload.attempt as number,
					typedPayload.maxAttempts as number,
				)
				break
			case "resetRequired":
				this.emit("resetRequired")
				break
		}
	}

	private generateRequestId(): string {
		return `req_${++this.requestIdCounter}`
	}

	private sendMessage(message: WorkerMessage): Promise<void> {
		logger.log("sendMessage", message)
		return new Promise<void>((resolve, reject) => {
			if (!this.worker || !this.workerReady) {
				reject(new Error("Worker not ready"))
				return
			}

			if (this.disposed) {
				reject(new Error("VoiceClient has been disposed"))
				return
			}

			this.pendingRequests.set(message.id, { resolve, reject })

			// Set timeout for the request
			setTimeout(() => {
				if (this.pendingRequests.has(message.id)) {
					this.pendingRequests.delete(message.id)
					reject(new Error("Request timeout"))
				}
			}, 10000)

			this.worker.postMessage(message)
		})
	}

	// Public API - matches original VoiceClient
	on<K extends keyof VoiceClientEvents>(event: K, callback: VoiceClientEvents[K]): void {
		this.events[event] = callback
	}

	private emit<K extends keyof VoiceClientEvents>(
		event: K,
		...args: Parameters<NonNullable<VoiceClientEvents[K]>>
	): void {
		const callback = this.events[event]
		if (callback) {
			; (
				callback as unknown as (
					...args: Parameters<NonNullable<VoiceClientEvents[K]>>
				) => void
			)(...args)
		}
	}

	async connect(recordingId?: string): Promise<void> {
		if (this.disposed) {
			logger.error("[Proxy] Cannot connect: VoiceClient has been disposed")
			throw new Error("VoiceClient has been disposed")
		}

		logger.log("[Proxy] Starting connection process")

		try {
			// Refresh token before connecting
			logger.log("[Proxy] Refreshing token for connection")
			const config = await this.refreshToken()
			logger.log("[Proxy] Token refreshed successfully, sending connect message to worker")

			const message: WorkerMessage = {
				type: "connect",
				id: this.generateRequestId(),
				payload: { config, recordingId },
			}

			await this.sendMessage(message)
			logger.log("[Proxy] Connect message sent successfully")
		} catch (error) {
			logger.error(`[Proxy] Connection failed: ${(error as Error).message}`)
			throw error
		}
	}

	async disconnect(): Promise<void> {
		logger.log("[Proxy] Starting disconnect process")

		const message: WorkerMessage = {
			type: "disconnect",
			id: this.generateRequestId(),
		}

		try {
			await this.sendMessage(message)
			logger.log("[Proxy] Disconnect message sent successfully")
		} catch (error) {
			logger.error(`[Proxy] Disconnect failed: ${(error as Error).message}`)
			throw error
		}
	}

	async updateConfig(newConfig: Partial<VoiceConfig>): Promise<void> {
		const message: WorkerMessage = {
			type: "updateConfig",
			id: this.generateRequestId(),
			payload: { config: newConfig },
		}

		return this.sendMessage(message)
	}

	async sendEndSignal(): Promise<void> {
		const message: WorkerMessage = {
			type: "sendEndSignal",
			id: this.generateRequestId(),
		}

		return this.sendMessage(message)
	}

	// Queue management methods
	async queueAudio(audioData: ArrayBuffer): Promise<void> {
		logger.log(`[Proxy] Queueing audio data (${audioData.byteLength} bytes)`)

		const message: WorkerMessage = {
			type: "queueAudio",
			id: this.generateRequestId(),
			payload: { audioData },
		}

		// Use Transferable Objects to avoid copying large audio data
		if (this.worker) {
			return new Promise<void>((resolve, reject) => {
				this.pendingRequests.set(message.id, { resolve, reject })

				// Set timeout
				setTimeout(() => {
					if (this.pendingRequests.has(message.id)) {
						this.pendingRequests.delete(message.id)
						logger.warn(`[Proxy] Audio queue request ${message.id} timed out`)
						reject(new Error("Request timeout"))
					}
				}, 5000)

				if (this.worker) {
					this.worker.postMessage(message, [audioData])
					logger.log(`[Proxy] Audio data sent to worker with request ID ${message.id}`)
				}
			})
		} else {
			logger.error("[Proxy] Cannot queue audio: Worker not available")
			throw new Error("Worker not available")
		}
	}

	async batchQueueAudio(audioDataList: ArrayBuffer[]): Promise<void> {
		if (!audioDataList || audioDataList.length === 0) {
			logger.error("[Proxy] Cannot batch queue: No audio data provided")
			throw new Error("No audio data provided for batch queueing")
		}

		const totalBytes = audioDataList.reduce((sum, buffer) => sum + buffer.byteLength, 0)
		logger.log(
			`[Proxy] Batch queueing ${audioDataList.length} audio chunks (total: ${totalBytes} bytes)`,
		)

		const message: WorkerMessage = {
			type: "batchQueueAudio",
			id: this.generateRequestId(),
			payload: { audioDataList },
		}

		// Use Transferable Objects to avoid copying large audio data
		if (this.worker) {
			return new Promise<void>((resolve, reject) => {
				this.pendingRequests.set(message.id, { resolve, reject })

				// Set timeout
				setTimeout(() => {
					if (this.pendingRequests.has(message.id)) {
						this.pendingRequests.delete(message.id)
						logger.warn(`[Proxy] Batch audio queue request ${message.id} timed out`)
						reject(new Error("Request timeout"))
					}
				}, 5000)

				if (this.worker) {
					// Transfer all ArrayBuffers
					this.worker.postMessage(message, audioDataList)
					logger.log(
						`[Proxy] Batch audio data sent to worker with request ID ${message.id}`,
					)
				}
			})
		} else {
			logger.error("[Proxy] Cannot batch queue audio: Worker not available")
			throw new Error("Worker not available")
		}
	}

	async startSending(): Promise<void> {
		logger.log("[Proxy] Starting audio sending")

		const message: WorkerMessage = {
			type: "startSending",
			id: this.generateRequestId(),
		}

		try {
			await this.sendMessage(message)
			logger.log("[Proxy] Audio sending started successfully")
		} catch (error) {
			logger.error(`[Proxy] Failed to start sending: ${(error as Error).message}`)
			throw error
		}
	}

	async stopSending(): Promise<void> {
		logger.log("[Proxy] Stopping audio sending")

		const message: WorkerMessage = {
			type: "stopSending",
			id: this.generateRequestId(),
		}

		try {
			await this.sendMessage(message)
			logger.log("[Proxy] Audio sending stopped successfully")
		} catch (error) {
			logger.error(`[Proxy] Failed to stop sending: ${(error as Error).message}`)
			throw error
		}
	}

	get isConnected(): boolean {
		return this._isConnected
	}

	get currentState(): ConnectionState {
		return this._currentState
	}

	get stats(): AudioStats {
		return { ...this._stats }
	}

	get connectionId(): string {
		return this._connectionId
	}

	get reconnectInfo(): {
		count: number
		maxAttempts: number
		lastReconnectTime: number
		isInCooldown: boolean
	} {
		// Note: This is simplified for the proxy version
		// The actual reconnect logic is handled in the worker
		return {
			count: 0,
			maxAttempts: 3,
			lastReconnectTime: 0,
			isInCooldown: false,
		}
	}

	dispose(): void {
		if (this.disposed) {
			logger.warn("[Proxy] VoiceClient already disposed")
			return
		}

		logger.log("[Proxy] Starting disposal process")
		this.disposed = true

		// Clean up pending requests
		const pendingCount = this.pendingRequests.size
		if (pendingCount > 0) {
			logger.log(`[Proxy] Cleaning up ${pendingCount} pending requests`)
			this.pendingRequests.forEach((pending) => {
				pending.reject(new Error("VoiceClient disposed"))
			})
			this.pendingRequests.clear()
		}

		// Send dispose message to worker
		if (this.worker && this.workerReady) {
			try {
				logger.log("[Proxy] Sending dispose message to worker")
				const message: WorkerMessage = {
					type: "dispose",
					id: this.generateRequestId(),
				}
				this.worker.postMessage(message)
			} catch (error) {
				logger.warn(
					`[Proxy] Failed to send dispose message to worker: ${(error as Error).message}`,
				)
			}
		}

		// Terminate worker
		if (this.worker) {
			logger.log("[Proxy] Terminating worker")
			this.worker.terminate()
			this.worker = null
		}

		// Clear events
		this.events = {}
		this.workerReady = false

		logger.log("[Proxy] VoiceClient disposal completed")
	}
}
