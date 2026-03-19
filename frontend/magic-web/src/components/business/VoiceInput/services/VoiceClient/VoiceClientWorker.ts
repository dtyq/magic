/**
 * Simplified VoiceClient for Web Worker environment
 * Core functionality for WebSocket communication with volcano ASR service
 */

import {
	PROTOCOL_CONSTANTS,
	createProtocolHeader,
	packageMessage,
	parseMessageHeader,
	extractPayload,
	buildWsUrl,
} from "./utils/protocol-utils"
import { validateAndNormalizeConfig, createInitialRequestPayload } from "./utils/config-utils"
import {
	normalizeMessageData,
	parseServerResponse,
	parseTextMessage,
	calculateAudioStats,
} from "./utils/message-utils"
import { generateUUID, calculateExponentialBackoff } from "./utils/common-utils"
import {
	PacketLogger,
	type PacketLogEntry,
	type PacketLogFilter,
	type PacketLogStats,
	type PacketLoggerConfig,
} from "./utils/packet-logger"
import type { VoiceConfig, ConnectionState, AudioStats } from "./types"

export interface WorkerVoiceClientEvents {
	log: (message: string, type: "info" | "success" | "error" | "warning") => void
	error: (message: string, code?: string | number) => void
	status: (
		message: string,
		state: "connecting" | "connected" | "recording" | "error" | "reconnecting" | "stop",
	) => void
	open: () => void
	close: (code?: number, reason?: string) => void
	result: (result: import("./types").VoiceResult) => void
	retry: (attempt: number, maxAttempts: number) => void
	resetRequired: () => void
	stateChange: (state: ConnectionState, isConnected: boolean) => void
	statsUpdate: (stats: AudioStats) => void
	packetLogged: (entry: PacketLogEntry) => void
}

export class VoiceClientWorker {
	private config: VoiceConfig
	private ws: WebSocket | null = null
	private connectionState: ConnectionState = "disconnected"
	private sequenceNumber = 1
	private audioStats: AudioStats = { totalBytes: 0, totalDuration: 0, packetCount: 0 }
	private disposed = false
	private events: Partial<WorkerVoiceClientEvents> = {}
	private packetLogger: PacketLogger | null = null

	// Simplified retry logic
	private reconnectAttempts = 0
	private maxReconnectAttempts = 3
	private reconnectDelay = 1000
	private reconnectTimer: NodeJS.Timeout | null = null

	// Queue management properties
	private sendQueue: ArrayBuffer[] = []
	private sendTimer: NodeJS.Timeout | null = null
	private isSending = false
	private readonly baseSendIntervalMs = 160 // Base sending interval (200 recommended)
	private readonly minSendIntervalMs = 100 // Minimum interval when queue is heavy

	connectionId = ""

	constructor(config: VoiceConfig) {
		this.config = validateAndNormalizeConfig(config)
		this.maxReconnectAttempts = this.config.retry?.maxAttempts ?? 3
		this.reconnectDelay = this.config.retry?.delay ?? 1000

		// Log initialization details
		this.emit("log", "[Worker] VoiceClientWorker initialized", "info")
		this.emit("log", `[Worker] Max reconnect attempts: ${this.maxReconnectAttempts}`, "info")
		this.emit("log", `[Worker] Reconnect delay: ${this.reconnectDelay}ms`, "info")
		this.emit(
			"log",
			`[Worker] Audio config - Sample rate: ${this.config.audio.sampleRate}Hz, Bits: ${this.config.audio.bitsPerSample}`,
			"info",
		)

		// PacketLogger is disabled by default
		// Use setPacketLoggingEnabled(true) or enablePacketLogging() to enable it
		this.emit("log", "[Worker] PacketLogger is disabled by default", "info")
		// this.enablePacketLogging()
	}

	on<K extends keyof WorkerVoiceClientEvents>(event: K, callback: WorkerVoiceClientEvents[K]) {
		this.events[event] = callback
	}

	private emit<K extends keyof WorkerVoiceClientEvents>(
		event: K,
		...args: Parameters<NonNullable<WorkerVoiceClientEvents[K]>>
	) {
		const callback = this.events[event]
		if (callback) {
			;(
				callback as unknown as (
					...args: Parameters<NonNullable<WorkerVoiceClientEvents[K]>>
				) => void
			)(...args)
		}
	}

	private emitStateChange(): void {
		this.emit("stateChange", this.connectionState, this.isConnected)
	}

	enablePacketLogging(config?: PacketLoggerConfig): void {
		if (this.packetLogger) {
			this.packetLogger.dispose()
		}

		// Initialize with optimized settings if no config provided
		const defaultConfig: PacketLoggerConfig = {
			maxEntries: 500, // Smaller memory footprint in worker
			enableIndexedDB: typeof indexedDB !== "undefined", // Enable if available
			enableAutoCleanup: true,
			cleanupInterval: 10 * 60 * 1000, // 10 minutes
			maxAge: 30 * 60 * 1000, // 30 minutes
			batchSize: 5, // Smaller batch size for worker
			enableDetailedLogging: false, // Reduce logging in production
			// Timeout settings for worker environment
			indexedDBTimeout: 8 * 1000, // 8 seconds (shorter for worker)
			maxRetryAttempts: 2, // Fewer retries in worker
			retryDelay: 500, // Faster retry in worker
		}

		this.packetLogger = new PacketLogger(config || defaultConfig)
		this.emit("log", "[Worker] PacketLogger enabled", "info")
	}

	disablePacketLogging(): void {
		if (this.packetLogger) {
			this.packetLogger.dispose()
			this.packetLogger = null
			this.emit("log", "[Worker] PacketLogger disabled", "info")
		}
	}

	/**
	 * Set packet logging enabled/disabled state
	 * This is a unified method to toggle packet logging
	 */
	setPacketLoggingEnabled(enabled: boolean, config?: PacketLoggerConfig): void {
		if (enabled) {
			this.enablePacketLogging(config)
		} else {
			this.disablePacketLogging()
		}
		this.emit("log", `[Worker] Packet logging ${enabled ? "enabled" : "disabled"}`, "info")
	}

	getPacketLogs(filter?: PacketLogFilter): PacketLogEntry[] {
		if (!this.packetLogger) {
			this.emit("log", "[Worker] PacketLogger not initialized", "warning")
			return []
		}
		return this.packetLogger.getLogs(filter)
	}

	getPacketLogStats(): PacketLogStats | null {
		if (!this.packetLogger) {
			this.emit("log", "[Worker] PacketLogger not initialized", "warning")
			return null
		}
		return this.packetLogger.getStats()
	}

	async exportPacketLogs(
		format: "json" | "csv" = "json",
		filter?: PacketLogFilter,
		options: {
			includeAudioFragments?: boolean
			sampleRate?: number
			bitsPerSample?: number
			includeAnalysis?: boolean
		} = {},
	): Promise<Blob | null> {
		console.log("exportPacketLogs", format, filter, options)
		if (!this.packetLogger) {
			this.emit("log", "[Worker] PacketLogger not initialized", "warning")
			return null
		}

		// Use comprehensive export by default
		if (options.includeAudioFragments !== false) {
			return this.packetLogger.exportLogsWithAudioFragments(format, filter, options)
		} else {
			// Basic export without audio fragments
			return this.packetLogger.exportLogs(format, filter)
		}
	}

	clearPacketLogs(): void {
		if (this.packetLogger) {
			this.packetLogger.clearLogs()
			this.emit("log", "[Worker] Packet logs cleared", "info")
		}
	}

	startPacketLoggingSession(connectionId: string): void {
		if (this.packetLogger) {
			this.packetLogger.startSession(connectionId)
			this.emit("log", `[Worker] Started packet logging session: ${connectionId}`, "info")
		}
	}

	endPacketLoggingSession(
		connectionId: string,
		status: "completed" | "error" = "completed",
	): void {
		if (this.packetLogger) {
			this.packetLogger.endSession(connectionId, status)
			this.emit(
				"log",
				`[Worker] Ended packet logging session: ${connectionId} (${status})`,
				"info",
			)
		}
	}

	getPacketLoggingSessions(): any[] {
		if (!this.packetLogger) {
			this.emit("log", "[Worker] PacketLogger not initialized", "warning")
			return []
		}
		return this.packetLogger.getSessions()
	}

	getPacketLogsByConnectionId(connectionId: string): PacketLogEntry[] {
		if (!this.packetLogger) {
			this.emit("log", "[Worker] PacketLogger not initialized", "warning")
			return []
		}
		return this.packetLogger.getLogsByConnectionId(connectionId)
	}

	async exportPacketLogsByConnectionId(
		connectionId: string,
		format: "json" | "csv" = "json",
		options: {
			includeAudioFragments?: boolean
			sampleRate?: number
			bitsPerSample?: number
			includeAnalysis?: boolean
		} = {},
	): Promise<Blob | null> {
		if (!this.packetLogger) {
			this.emit("log", "[Worker] PacketLogger not initialized", "warning")
			return null
		}
		return this.packetLogger.exportLogsByConnectionId(connectionId, format, options)
	}

	getSessionStats(connectionId: string): any {
		if (!this.packetLogger) {
			this.emit("log", "[Worker] PacketLogger not initialized", "warning")
			return null
		}
		return this.packetLogger.getSessionStats(connectionId)
	}

	async exportAudioFragments(filter?: PacketLogFilter): Promise<any> {
		if (!this.packetLogger) {
			this.emit("log", "[Worker] PacketLogger not initialized", "warning")
			return null
		}
		return this.packetLogger.exportAudioFragments(filter)
	}

	async exportAudioFragmentsAsZip(
		filter?: PacketLogFilter,
		options: {
			sampleRate?: number
			bitsPerSample?: number
			includeMetadata?: boolean
		} = {},
	): Promise<Blob | null> {
		if (!this.packetLogger) {
			this.emit("log", "[Worker] PacketLogger not initialized", "warning")
			return null
		}
		return this.packetLogger.exportAudioFragmentsAsZip(filter, options)
	}

	async downloadAudioFragments(
		filename?: string,
		filter?: PacketLogFilter,
		options: {
			sampleRate?: number
			bitsPerSample?: number
			includeMetadata?: boolean
		} = {},
	): Promise<void> {
		if (!this.packetLogger) {
			this.emit("log", "[Worker] PacketLogger not initialized", "warning")
			return
		}
		return this.packetLogger.downloadAudioFragments(filename, filter, options)
	}

	private logPacket(entry: Omit<PacketLogEntry, "id" | "timestamp">): void {
		if (this.packetLogger) {
			this.packetLogger.logPacket(entry)
			// Emit event for external listeners
			const fullEntry: PacketLogEntry = {
				...entry,
				id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
				timestamp: Date.now(),
			}
			this.emit("packetLogged", fullEntry)
		}
	}

	private getMessageTypeName(messageType: number): string {
		switch (messageType) {
			case PROTOCOL_CONSTANTS.FULL_SERVER_RESPONSE:
				return "FULL_SERVER_RESPONSE"
			case PROTOCOL_CONSTANTS.SERVER_ACK:
				return "SERVER_ACK"
			case PROTOCOL_CONSTANTS.SERVER_ERROR_RESPONSE:
				return "SERVER_ERROR_RESPONSE"
			case PROTOCOL_CONSTANTS.FULL_CLIENT_REQUEST:
				return "FULL_CLIENT_REQUEST"
			case PROTOCOL_CONSTANTS.AUDIO_ONLY_REQUEST:
				return "AUDIO_ONLY_REQUEST"
			default:
				return `UNKNOWN_0x${messageType.toString(16).toUpperCase()}`
		}
	}

	updateConfig(newConfig: Partial<VoiceConfig>): void {
		this.emit("log", "[Worker] Updating configuration", "info")

		const oldConfig = { ...this.config }
		this.config = validateAndNormalizeConfig({ ...this.config, ...newConfig })

		if (newConfig.retry) {
			const oldMaxAttempts = this.maxReconnectAttempts
			const oldDelay = this.reconnectDelay
			this.maxReconnectAttempts = newConfig.retry.maxAttempts ?? this.maxReconnectAttempts
			this.reconnectDelay = newConfig.retry.delay ?? this.reconnectDelay

			if (oldMaxAttempts !== this.maxReconnectAttempts) {
				this.emit(
					"log",
					`[Worker] Max reconnect attempts updated: ${oldMaxAttempts} -> ${this.maxReconnectAttempts}`,
					"info",
				)
			}
			if (oldDelay !== this.reconnectDelay) {
				this.emit(
					"log",
					`[Worker] Reconnect delay updated: ${oldDelay}ms -> ${this.reconnectDelay}ms`,
					"info",
				)
			}
		}

		// Log audio config changes
		if (newConfig.audio) {
			if (oldConfig.audio.sampleRate !== this.config.audio.sampleRate) {
				this.emit(
					"log",
					`[Worker] Sample rate updated: ${oldConfig.audio.sampleRate}Hz -> ${this.config.audio.sampleRate}Hz`,
					"info",
				)
			}
			if (oldConfig.audio.bitsPerSample !== this.config.audio.bitsPerSample) {
				this.emit(
					"log",
					`[Worker] Bits per sample updated: ${oldConfig.audio.bitsPerSample} -> ${this.config.audio.bitsPerSample}`,
					"info",
				)
			}
		}

		this.emit("log", "[Worker] Configuration update completed", "success")
	}

	get isConnected(): boolean {
		return this.connectionState === "connected"
	}

	get currentState(): ConnectionState {
		return this.connectionState
	}

	get stats(): AudioStats {
		return { ...this.audioStats }
	}

	async connect(recordingId?: string): Promise<void> {
		if (this.disposed) {
			this.emit("log", "[Worker] Cannot connect: VoiceClient has been disposed", "error")
			throw new Error("VoiceClient has been disposed")
		}

		if (this.connectionState === "connected" || this.connectionState === "connecting") {
			this.emit(
				"log",
				`[Worker] Connection already in progress or established (state: ${this.connectionState})`,
				"info",
			)
			return
		}

		this.emit("log", "[Worker] Starting connection process", "info")
		this.reconnectAttempts = 0

		try {
			await this.attemptConnection(recordingId)
			this.emit("log", "[Worker] Connection established successfully", "success")
		} catch (error) {
			this.emit("log", `[Worker] Connection failed: ${(error as Error).message}`, "error")
			throw error
		}
	}

	private async attemptConnection(recordingId?: string): Promise<void> {
		return new Promise((resolve, reject) => {
			try {
				this.emit("log", "[Worker] Attempting connection...", "info")
				this.connectionState = "connecting"
				this.emitStateChange()
				this.emit("status", "Connecting to voice service...", "connecting")

				// Clean up previous WebSocket
				this.emit("log", "[Worker] Cleaning up previous WebSocket connection", "info")
				this.cleanupWebSocket()

				// Generate connection ID
				const connectId = recordingId || generateUUID()
				this.connectionId = connectId
				this.emit("log", `[Worker] Generated connection ID: ${connectId}`, "info")

				// Start packet logging session
				this.startPacketLoggingSession(connectId)

				// Build WebSocket URL with auth params
				const wsUrl = buildWsUrl(
					this.config.wsUrl,
					this.config.resourceId,
					this.config.apiAppId,
					this.config.authToken || "",
					connectId,
				)

				this.emit("log", `[Worker] Connecting to WebSocket URL: ${wsUrl}`, "info")
				this.ws = new WebSocket(wsUrl)
				this.ws.binaryType = "arraybuffer"
				this.emit("log", "[Worker] WebSocket instance created", "info")

				const connectionTimeout = setTimeout(() => {
					if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
						this.emit(
							"log",
							`[Worker] Connection timeout after ${PROTOCOL_CONSTANTS.CONNECTION_TIMEOUT}ms`,
							"error",
						)
						this.ws.close()
						reject(new Error("Connection timeout"))
					}
				}, PROTOCOL_CONSTANTS.CONNECTION_TIMEOUT)

				this.ws.onopen = () => {
					clearTimeout(connectionTimeout)
					this.connectionState = "connected"
					this.emitStateChange()
					this.sequenceNumber = 1
					this.resetAudioStats()
					this.emit("open")
					this.emit("log", "WebSocket connection established", "success")
					this.emit("status", "Connected", "connected")

					// 如果队列中有数据，则开始发送
					if (this.sendQueue.length > 0) {
						this.startSending()
					}

					this.sendInitialRequest()
						.then(() => resolve())
						.catch(reject)
				}

				this.ws.onerror = (event) => {
					clearTimeout(connectionTimeout)
					const error = new Error(`WebSocket connection error: ${event.type}`)
					this.emit("error", error.message, "CONNECTION_ERROR")
					reject(error)
				}

				this.ws.onclose = (event) => {
					clearTimeout(connectionTimeout)
					this.handleConnectionClose(event)
					if (this.connectionState === "connecting") {
						reject(new Error(`Connection closed: ${event.reason || event.code}`))
					}
				}

				this.ws.onmessage = (event) => this.handleMessage(event.data)
			} catch (error) {
				reject(error)
			}
		})
	}

	private cleanupWebSocket(): void {
		if (this.ws) {
			this.ws.onopen = null
			this.ws.onclose = null
			this.ws.onmessage = null
			this.ws.onerror = null
			this.ws.close()
			this.ws = null
		}
	}

	private resetAudioStats(): void {
		this.audioStats = { totalBytes: 0, totalDuration: 0, packetCount: 0 }
		this.emit("statsUpdate", this.stats)
	}

	private handleConnectionClose(event: CloseEvent): void {
		this.cleanupWebSocket()
		this.connectionState = "disconnected"
		this.emitStateChange()

		// End packet logging session
		if (this.connectionId) {
			const status = event.code === 1000 ? "completed" : "error"
			this.endPacketLoggingSession(this.connectionId, status)
		}

		this.emit("close", event.code, event.reason)
		this.emit(
			"log",
			`WebSocket connection closed (code: ${event.code}, reason: ${
				event.reason || "unknown"
			})`,
			"warning",
		)

		// Auto-reconnect logic for unexpected disconnections
		if (
			event.code !== 1000 &&
			!this.disposed &&
			this.reconnectAttempts < this.maxReconnectAttempts
		) {
			this.scheduleReconnect()
		} else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
			this.emit("error", "Max reconnect attempts exceeded", "MAX_RETRY_EXCEEDED")
			this.emit("resetRequired")
		}
	}

	private scheduleReconnect(): void {
		this.reconnectAttempts++
		const delay = calculateExponentialBackoff(this.reconnectAttempts - 1, this.reconnectDelay)

		this.emit("retry", this.reconnectAttempts, this.maxReconnectAttempts)
		this.emit(
			"log",
			`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`,
			"info",
		)

		this.connectionState = "reconnecting"
		this.emitStateChange()
		this.emit("status", "Reconnecting...", "reconnecting")

		this.reconnectTimer = setTimeout(async () => {
			try {
				await this.attemptConnection()
				this.emit(
					"log",
					`Reconnected successfully (attempt ${this.reconnectAttempts})`,
					"success",
				)
			} catch (error) {
				this.emit(
					"log",
					`Reconnection attempt ${this.reconnectAttempts} failed: ${
						(error as Error).message
					}`,
					"warning",
				)
			}
		}, delay)
	}

	disconnect(): void {
		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer)
			this.reconnectTimer = null
		}

		// Clean up queue management
		this.stopSending()

		// End packet logging session
		if (this.connectionId) {
			this.endPacketLoggingSession(this.connectionId, "completed")
		}

		this.cleanupWebSocket()
		this.connectionState = "disconnected"
		this.emitStateChange()
		this.emit("status", "Disconnected", "stop")
	}

	sendEndSignal(): void {
		if (!this.isConnected) {
			this.emit("log", "Connection not established, cannot send end signal", "warning")
			return
		}
		this.sendAudioAsync(new ArrayBuffer(0), true)
	}

	// Queue management methods
	queueAudio(audioData: ArrayBuffer): void {
		if (this.disposed) {
			this.emit(
				"log",
				"[Worker] VoiceClient has been disposed, cannot queue audio data",
				"warning",
			)
			return
		}

		// Add to queue
		const previousQueueLength = this.sendQueue.length
		this.sendQueue.push(audioData)

		if (!this.isSending) {
			this.emit("log", "[Worker] Starting audio sending due to new audio data", "info")
			this.startSending()
		}

		this.emit(
			"log",
			`[Worker] Queued audio data: ${audioData.byteLength} bytes (Queue: ${previousQueueLength} -> ${this.sendQueue.length})`,
			"info",
		)

		// Log queue status when it gets large
		if (this.sendQueue.length > 10) {
			const totalBytes = this.sendQueue.reduce((sum, buffer) => sum + buffer.byteLength, 0)
			this.emit(
				"log",
				`[Worker] Large queue detected: ${this.sendQueue.length} items, ${totalBytes} bytes total`,
				"warning",
			)
		}
	}

	batchQueueAudio(audioDataList: ArrayBuffer[]): void {
		if (this.disposed) {
			this.emit(
				"log",
				"VoiceClient has been disposed, cannot batch queue audio data",
				"warning",
			)
			return
		}

		if (!audioDataList || audioDataList.length === 0) {
			this.emit("log", "No audio data provided for batch queueing", "warning")
			return
		}

		// Add all audio data to queue
		this.sendQueue = [...audioDataList, ...this.sendQueue]

		if (!this.isSending) {
			this.startSending()
		}

		const totalBytes = audioDataList.reduce((total, data) => total + data.byteLength, 0)
		this.emit(
			"log",
			`Batch queued ${audioDataList.length} audio chunks: ${totalBytes} bytes total (Queue length: ${this.sendQueue.length})`,
			"info",
		)
	}

	startSending(): void {
		if (this.disposed) {
			this.emit(
				"log",
				"[Worker] VoiceClient has been disposed, cannot start sending",
				"warning",
			)
			return
		}

		if (this.isSending) {
			this.emit("log", "[Worker] Already sending, ignoring start request", "info")
			return
		}

		this.emit(
			"log",
			`[Worker] Starting audio sending (Queue length: ${this.sendQueue.length})`,
			"info",
		)

		this.isSending = true
		this.emit("log", "[Worker] Entered queue sending mode", "success")

		// Start the send loop
		this.maybeStartSendLoop()
	}

	stopSending(): void {
		this.emit(
			"log",
			`[Worker] Stopping audio sending (Queue length: ${this.sendQueue.length})`,
			"info",
		)
		this.isSending = false

		if (this.sendTimer) {
			this.emit("log", "[Worker] Clearing send timer", "info")
			clearTimeout(this.sendTimer)
			this.sendTimer = null
		}

		// Process remaining items in queue immediately, then send end signal
		this.processFinalQueue()

		this.emit("log", "[Worker] Stopped queue sending mode and sent end signal", "success")
	}

	getQueueStatus(): { queueLength: number; isSending: boolean; totalBytesPending: number } {
		const totalBytesPending = this.sendQueue.reduce(
			(total, buffer) => total + buffer.byteLength,
			0,
		)
		return {
			queueLength: this.sendQueue.length,
			isSending: this.isSending,
			totalBytesPending,
		}
	}

	private async sendAudioAsync(audioData: ArrayBuffer, isLast: boolean): Promise<void> {
		try {
			const messageFlags = isLast
				? PROTOCOL_CONSTANTS.NEG_WITH_SEQUENCE
				: PROTOCOL_CONSTANTS.POS_SEQUENCE
			const header = createProtocolHeader(
				PROTOCOL_CONSTANTS.AUDIO_ONLY_REQUEST,
				messageFlags,
				PROTOCOL_CONSTANTS.JSON,
				PROTOCOL_CONSTANTS.NO_COMPRESSION,
			)

			const sequence = isLast ? -this.sequenceNumber : this.sequenceNumber
			const messageBody = packageMessage(header, sequence, audioData)

			this.ws?.send(messageBody)

			// Log packet for debugging
			this.logPacket({
				type: "sent",
				direction: "outbound",
				messageType: "AUDIO_DATA",
				size: messageBody.byteLength,
				sequence: sequence,
				data: messageBody,
				metadata: {
					connectionId: this.connectionId,
					protocolType: "audio",
					isLastPacket: isLast,
					audioStats:
						audioData.byteLength > 0
							? calculateAudioStats(
									audioData,
									this.config.audio.sampleRate,
									this.config.audio.bitsPerSample,
								)
							: undefined,
				},
			})

			// Update stats
			this.updateAudioStats(audioData, isLast)

			// Log
			this.logAudioData(audioData, isLast, sequence)

			this.sequenceNumber++
		} catch (error) {
			this.emit(
				"error",
				`Failed to send audio data: ${(error as Error).message}`,
				"SEND_AUDIO_ERROR",
			)
		}
	}

	private updateAudioStats(audioData: ArrayBuffer, isLast: boolean): void {
		if (!isLast && audioData.byteLength > 0) {
			this.audioStats.totalBytes += audioData.byteLength
			this.audioStats.packetCount++
			const { durationMs } = calculateAudioStats(
				audioData,
				this.config.audio.sampleRate,
				this.config.audio.bitsPerSample,
			)
			this.audioStats.totalDuration += durationMs
			this.emit("statsUpdate", this.stats)
		}
	}

	private logAudioData(audioData: ArrayBuffer, isLast: boolean, sequence: number): void {
		if (!isLast && audioData.byteLength > 0) {
			const { samples, durationMs } = calculateAudioStats(
				audioData,
				this.config.audio.sampleRate,
				this.config.audio.bitsPerSample,
			)
			this.emit(
				"log",
				`Sent ${
					audioData.byteLength
				} bytes audio data (${samples} samples, ${durationMs.toFixed(
					1,
				)}ms) (Seq: ${sequence})`,
				"info",
			)
		} else {
			this.emit(
				"log",
				isLast
					? `Sent end signal (Seq: ${sequence})`
					: `Sent ${audioData.byteLength} bytes audio data (Seq: ${sequence})`,
				isLast ? "success" : "info",
			)
		}
	}

	private async sendInitialRequest(): Promise<void> {
		try {
			const payload = createInitialRequestPayload(this.config)
			const payloadJson = JSON.stringify(payload)
			const payloadBytes = new TextEncoder().encode(payloadJson)

			const header = createProtocolHeader(
				PROTOCOL_CONSTANTS.FULL_CLIENT_REQUEST,
				PROTOCOL_CONSTANTS.POS_SEQUENCE,
				PROTOCOL_CONSTANTS.JSON,
				PROTOCOL_CONSTANTS.NO_COMPRESSION,
			)
			const messageBody = packageMessage(
				header,
				this.sequenceNumber,
				payloadBytes.buffer as ArrayBuffer,
			)

			if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
				throw new Error("WebSocket connection not ready")
			}

			this.ws.send(messageBody)

			// Log initial request packet
			this.logPacket({
				type: "sent",
				direction: "outbound",
				messageType: "INITIAL_REQUEST",
				size: messageBody.byteLength,
				sequence: this.sequenceNumber,
				data: messageBody,
				metadata: {
					connectionId: this.connectionId,
					protocolType: "control",
					isLastPacket: false,
				},
			})

			this.emit("log", `Initial request sent (Seq: ${this.sequenceNumber})`, "success")
			this.sequenceNumber++
		} catch (error) {
			this.emit(
				"error",
				`Failed to send initial request: ${(error as Error).message}`,
				"INIT_REQUEST_ERROR",
			)
			throw error
		}
	}

	private async handleMessage(data: unknown): Promise<void> {
		try {
			const normalized = await normalizeMessageData(data)

			if (normalized.messageType === "text" && normalized.originalData) {
				// Log text message
				const textData = normalized.originalData
				this.logPacket({
					type: "received",
					direction: "inbound",
					messageType: "TEXT_MESSAGE",
					size: textData.length,
					data: new TextEncoder().encode(textData).buffer,
					metadata: {
						connectionId: this.connectionId,
						protocolType: "text",
					},
				})
				this.handleTextMessage(textData)
				return
			} else if (normalized.messageType === "unknown") {
				this.emit("log", `Received unknown message type: ${typeof data}`, "warning")
				return
			}

			const buffer = normalized.buffer
			if (!buffer) return

			if (buffer.byteLength < PROTOCOL_CONSTANTS.MIN_MESSAGE_SIZE) {
				this.emit("log", "Received invalid short message", "warning")
				return
			}

			const { messageType, sequence } = parseMessageHeader(buffer)

			// Log binary message
			this.logPacket({
				type: "received",
				direction: "inbound",
				messageType: this.getMessageTypeName(messageType),
				size: buffer.byteLength,
				sequence: Math.abs(sequence),
				data: buffer,
				metadata: {
					connectionId: this.connectionId,
					protocolType: "control",
					isLastPacket: sequence < 0,
				},
			})

			this.emit(
				"log",
				`Received message type: 0x${messageType
					.toString(16)
					.padStart(2, "0")}, sequence: ${sequence}`,
				"info",
			)

			const isLastPackage = sequence < 0
			if (isLastPackage && messageType === PROTOCOL_CONSTANTS.FULL_SERVER_RESPONSE) {
				this.handleServerResponse(buffer)
				this.emit("log", "Received final response, recognition complete", "success")
				return
			}

			this.routeMessage(messageType, buffer, sequence)
		} catch (e) {
			this.emit(
				"error",
				`Failed to handle message: ${(e as Error).message}`,
				"MESSAGE_HANDLE_ERROR",
			)
		}
	}

	private routeMessage(messageType: number, buffer: ArrayBuffer, sequence: number): void {
		switch (messageType) {
			case PROTOCOL_CONSTANTS.FULL_SERVER_RESPONSE:
				this.handleServerResponse(buffer)
				break
			case PROTOCOL_CONSTANTS.SERVER_ACK:
				this.handleServerAck(buffer, sequence)
				break
			case PROTOCOL_CONSTANTS.SERVER_ERROR_RESPONSE:
				this.handleErrorResponse(buffer, sequence)
				break
			default:
				this.emit("log", `Unknown message type: 0x${messageType.toString(16)}`, "warning")
		}
	}

	private handleTextMessage(text: string): void {
		this.emit("log", `Received text message: ${text}`, "info")

		const parsed = parseTextMessage(text)

		// Emit logs from parser
		parsed.logs.forEach((log) => {
			this.emit("log", log.message, log.level === "error" ? "error" : "info")
		})

		if (parsed.isError && parsed.errorMessage) {
			this.emit("error", parsed.errorMessage, parsed.errorCode)

			// Handle session timeout/end errors
			if (parsed.shouldReconnect && !this.disposed) {
				this.emit(
					"log",
					"Session timeout/end detected, attempting reconnection...",
					"warning",
				)
				this.disconnect()
				this.scheduleReconnect()
			}
		} else if (parsed.result) {
			this.emit("result", parsed.result)
		}
	}

	private async handleServerResponse(data: ArrayBuffer): Promise<void> {
		try {
			const payload = extractPayload(data)
			const textData = new TextDecoder().decode(payload)
			this.emit("log", `Received recognition result: ${textData}`, "info")

			const parsed = parseServerResponse(textData)

			// Emit logs from parser
			parsed.logs.forEach((log) => {
				this.emit("log", log.message, log.level)
			})

			if (parsed.result) {
				this.emit("result", parsed.result)
			} else if (parsed.error) {
				this.emit("error", parsed.error, "RESPONSE_PARSE_ERROR")
			} else {
				this.emit("log", "Parse result is empty", "warning")
			}
		} catch (e) {
			this.emit(
				"error",
				`Failed to parse response: ${
					e ? (e as Error).message || e.toString() : "unknown error"
				}`,
				"RESPONSE_PARSE_ERROR",
			)
		}
	}

	private handleServerAck(data: ArrayBuffer, sequence: number): void {
		try {
			const payload = extractPayload(data)
			const textData = new TextDecoder().decode(payload)
			this.emit("log", `Received server ACK (Seq: ${sequence}): ${textData}`, "info")
		} catch (e) {
			this.emit("log", `Failed to parse ACK: ${(e as Error).message}`, "warning")
		}
	}

	private handleErrorResponse(data: ArrayBuffer, sequence: number): void {
		try {
			const payload = extractPayload(data)
			const errorMsg = new TextDecoder().decode(payload)
			this.emit("error", `Server error (code: ${sequence}): ${errorMsg}`, sequence)
		} catch (e) {
			this.emit(
				"error",
				`Failed to parse error response: ${(e as Error).message}`,
				"ERROR_PARSE_ERROR",
			)
		}
	}

	// Private queue management methods
	private maybeStartSendLoop(): void {
		if (!this.isSending || this.sendTimer || this.sendQueue.length === 0) {
			if (this.isSending) {
				this.isSending = false
			}
			return
		}

		const intervalMs = this.calculateSendInterval()
		this.sendTimer = setTimeout(() => {
			this.processSendQueueTick()
		}, intervalMs)
	}

	private calculateSendInterval(): number {
		// Dynamic interval based on queue size - larger queue means faster sending (shorter interval)
		const queueLength = this.sendQueue.length
		let interval: number
		let speedLevel: string

		if (queueLength <= 2) {
			interval = this.baseSendIntervalMs // 200ms - normal speed when queue is small
			speedLevel = "normal"
		} else if (queueLength <= 5) {
			interval = this.baseSendIntervalMs - 30 // 170ms - slightly faster
			speedLevel = "slightly faster"
		} else if (queueLength <= 10) {
			interval = this.baseSendIntervalMs - 60 // 140ms - faster
			speedLevel = "faster"
		} else {
			interval = this.minSendIntervalMs // 100ms - fastest when queue is heavy
			speedLevel = "fastest"
		}

		this.emit(
			"log",
			`[Worker] Send interval: ${interval}ms (${speedLevel}, queue: ${queueLength})`,
			"info",
		)
		return interval
	}

	private processSendQueueTick(): void {
		this.sendTimer = null

		if (!this.isSending || this.disposed) {
			this.emit(
				"log",
				`[Worker] Send tick cancelled: isSending=${this.isSending}, disposed=${this.disposed}`,
				"info",
			)
			return
		}

		if (!this.isConnected) {
			this.emit(
				"log",
				"[Worker] Connection lost during queue processing, stopping send loop",
				"warning",
			)
			this.isSending = false
			return
		}

		// Send multiple items per tick for better performance
		const queueLengthBefore = this.sendQueue.length
		const audioData = this.sendQueue.shift()
		if (audioData) {
			this.sendAudioAsync(audioData, false)
			this.emit(
				"log",
				`[Worker] Processed queue item (${queueLengthBefore} -> ${this.sendQueue.length})`,
				"info",
			)
		}

		// Continue the loop if still sending and have more data
		if (this.isSending && this.sendQueue.length > 0) {
			this.maybeStartSendLoop()
		} else if (this.isSending && this.sendQueue.length === 0) {
			this.emit("log", "[Worker] Queue empty, stopping send loop", "info")
			this.isSending = false
		}
	}

	private processFinalQueue(): void {
		const remainingItems = this.sendQueue.length
		this.emit(
			"log",
			`[Worker] Processing final queue with ${remainingItems} remaining items`,
			"info",
		)

		// 不发送剩余的音频数据
		// while (this.sendQueue.length > 0) {
		// 	const audioData = this.sendQueue.shift()
		// 	if (audioData && this.isConnected) {
		// 		this.sendAudioAsync(audioData, false)
		// 	}
		// }

		// Send end signal
		if (this.isConnected) {
			this.emit("log", "[Worker] Sending end signal to server", "info")
			this.sendAudioAsync(new ArrayBuffer(0), true)
		} else {
			this.emit("log", "[Worker] Cannot send end signal: not connected", "warning")
		}

		// Reset state
		this.sendQueue = []
		this.isSending = false
		this.emit("log", `[Worker] Final queue processed, cleared ${remainingItems} items`, "info")
	}

	dispose(): void {
		if (this.disposed) {
			this.emit("log", "[Worker] VoiceClientWorker already disposed", "warning")
			return
		}

		this.emit("log", "[Worker] Starting VoiceClientWorker disposal", "info")
		this.disposed = true

		if (this.reconnectTimer) {
			this.emit("log", "[Worker] Clearing reconnect timer", "info")
			clearTimeout(this.reconnectTimer)
			this.reconnectTimer = null
		}

		// Clean up queue
		const queueSize = this.sendQueue.length
		if (this.sendTimer) {
			this.emit("log", "[Worker] Clearing send timer", "info")
			clearTimeout(this.sendTimer)
			this.sendTimer = null
		}
		this.sendQueue = []
		this.isSending = false

		if (queueSize > 0) {
			this.emit("log", `[Worker] Cleared ${queueSize} items from send queue`, "info")
		}

		this.emit("log", "[Worker] Disconnecting and cleaning up resources", "info")
		this.disconnect()

		// Dispose packet logger
		if (this.packetLogger) {
			this.emit("log", "[Worker] Disposing PacketLogger", "info")
			this.packetLogger.dispose()
			this.packetLogger = null
		}

		this.events = {}

		this.emit("log", "[Worker] VoiceClientWorker disposal completed", "info")
	}
}
