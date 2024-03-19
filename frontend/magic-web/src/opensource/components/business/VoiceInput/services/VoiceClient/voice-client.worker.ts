/**
 * Voice Client Web Worker
 * Runs VoiceClient in a separate thread to maintain WebSocket connection
 * even when the main tab becomes inactive
 */

import { VoiceClientWorker } from "./VoiceClientWorker"
import type { WorkerMessage, MainThreadMessage } from "./worker-types"
import type { VoiceConfig } from "./types"

// Worker-specific message handling
class VoiceClientWorkerHandler {
	private client: VoiceClientWorker | null = null

	constructor() {
		// Listen for messages from main thread
		self.addEventListener("message", this.handleMainThreadMessage.bind(this))

		// Send ready signal
		this.postMessage({ type: "ready" })
	}

	private postMessage(message: MainThreadMessage): void {
		self.postMessage(message)
	}

	private handleMainThreadMessage(event: MessageEvent<WorkerMessage>): void {
		const message = event.data

		try {
			switch (message.type) {
				case "connect":
					this.handleConnect(
						message.id,
						message.payload.config,
						message.payload.recordingId,
					)
					break
				case "disconnect":
					this.handleDisconnect(message.id)
					break
				case "updateConfig":
					this.handleUpdateConfig(message.id, message.payload.config)
					break
				case "sendEndSignal":
					this.handleSendEndSignal(message.id)
					break
				// Queue management cases
				case "queueAudio":
					this.handleQueueAudio(message.id, message.payload.audioData)
					break
				case "batchQueueAudio":
					this.handleBatchQueueAudio(message.id, message.payload.audioDataList)
					break
				case "startSending":
					this.handleStartSending(message.id)
					break
				case "stopSending":
					this.handleStopSending(message.id)
					break
				case "getQueueStatus":
					this.handleGetQueueStatus(message.id)
					break
				case "dispose":
					this.handleDispose(message.id)
					break
				case "exportPacketLogs":
					this.handleExportPacketLogs(message.payload.connectionId)
					break
				case "setPacketLoggingEnabled":
					this.handleSetPacketLoggingEnabled(message.id, message.payload.enabled)
					break
				default:
					console.warn("[Worker] Unknown message type:", (message as WorkerMessage).type)
			}
		} catch (error) {
			this.sendErrorResponse(message.id, (error as Error).message)
		}
	}

	private async handleExportPacketLogs(connectionId: string): Promise<void> {
		try {
			if (this.client) {
				const blob = await this.client.exportPacketLogs("json", {
					connectionId,
				})
				this.postMessage({
					type: "exportPacketLogs",
					payload: { blob: blob as Blob },
				})
			}
			this.sendSuccessResponse(connectionId)
		} catch (error) {
			this.sendErrorResponse(connectionId, (error as Error).message)
		}
	}

	private handleSetPacketLoggingEnabled(id: string, enabled: boolean): void {
		try {
			if (this.client) {
				this.client.setPacketLoggingEnabled(enabled)
				console.log(`[Worker] Packet logging ${enabled ? "enabled" : "disabled"}`)
			} else {
				console.warn("[Worker] No client available for setting packet logging")
			}
			this.sendSuccessResponse(id)
		} catch (error) {
			this.sendErrorResponse(id, (error as Error).message)
		}
	}

	private async handleConnect(
		id: string,
		config: VoiceConfig,
		recordingId?: string,
	): Promise<void> {
		try {
			// Create new client if doesn't exist
			if (!this.client) {
				this.client = new VoiceClientWorker(config)
				this.setupClientEvents()
			} else {
				// Update config if client exists
				this.client.updateConfig(config)
			}

			await this.client.connect(recordingId)
			this.sendSuccessResponse(id)
		} catch (error) {
			this.sendErrorResponse(id, (error as Error).message)
		}
	}

	private handleDisconnect(id: string): void {
		try {
			if (this.client) {
				this.client.disconnect()
			}
			this.sendSuccessResponse(id)
		} catch (error) {
			this.sendErrorResponse(id, (error as Error).message)
		}
	}

	private handleUpdateConfig(id: string, config: Partial<VoiceConfig>): void {
		try {
			if (this.client) {
				this.client.updateConfig(config)
			}
			this.sendSuccessResponse(id)
		} catch (error) {
			this.sendErrorResponse(id, (error as Error).message)
		}
	}

	private handleSendEndSignal(id: string): void {
		try {
			if (this.client) {
				this.client.sendEndSignal()
			}
			this.sendSuccessResponse(id)
		} catch (error) {
			this.sendErrorResponse(id, (error as Error).message)
		}
	}

	// Queue management handlers
	private handleQueueAudio(id: string, audioData: ArrayBuffer): void {
		try {
			if (this.client) {
				this.client.queueAudio(audioData)
			}
			this.sendSuccessResponse(id)
		} catch (error) {
			this.sendErrorResponse(id, (error as Error).message)
		}
	}

	private handleBatchQueueAudio(id: string, audioDataList: ArrayBuffer[]): void {
		try {
			if (this.client) {
				this.client.batchQueueAudio(audioDataList)
			}
			this.sendSuccessResponse(id)
		} catch (error) {
			this.sendErrorResponse(id, (error as Error).message)
		}
	}

	private handleStartSending(id: string): void {
		try {
			if (this.client) {
				this.client.startSending()
			}
			this.sendSuccessResponse(id)
		} catch (error) {
			this.sendErrorResponse(id, (error as Error).message)
		}
	}

	private handleStopSending(id: string): void {
		try {
			if (this.client) {
				this.client.stopSending()
			}
			this.sendSuccessResponse(id)
		} catch (error) {
			this.sendErrorResponse(id, (error as Error).message)
		}
	}

	private handleGetQueueStatus(id: string): void {
		try {
			if (this.client) {
				const status = this.client.getQueueStatus()
				this.postMessage({
					type: "queueStatus",
					payload: status,
				})
			}
			this.sendSuccessResponse(id)
		} catch (error) {
			this.sendErrorResponse(id, (error as Error).message)
		}
	}

	private handleDispose(id: string): void {
		try {
			if (this.client) {
				this.client.dispose()
				this.client = null
			}
			this.sendSuccessResponse(id)
		} catch (error) {
			this.sendErrorResponse(id, (error as Error).message)
		}
	}

	private setupClientEvents(): void {
		if (!this.client) return

		// Forward all client events to main thread
		this.client.on("log", (message, type) => {
			this.postMessage({
				type: "event",
				eventType: "log",
				payload: { message, type },
			})
		})

		this.client.on("error", (message, code) => {
			this.postMessage({
				type: "event",
				eventType: "error",
				payload: { message, code },
			})
		})

		this.client.on("status", (message, state) => {
			this.postMessage({
				type: "event",
				eventType: "status",
				payload: { message, state },
			})
		})

		this.client.on("open", () => {
			this.postMessage({
				type: "event",
				eventType: "open",
				payload: {},
			})
		})

		this.client.on("close", (code, reason) => {
			this.postMessage({
				type: "event",
				eventType: "close",
				payload: { code, reason },
			})
		})

		this.client.on("result", (result) => {
			this.postMessage({
				type: "result",
				payload: result,
			})
		})

		this.client.on("retry", (attempt, maxAttempts) => {
			this.postMessage({
				type: "event",
				eventType: "retry",
				payload: { attempt, maxAttempts },
			})
		})

		this.client.on("resetRequired", () => {
			this.postMessage({
				type: "event",
				eventType: "resetRequired",
				payload: {},
			})
		})

		this.client.on("stateChange", (state, isConnected) => {
			this.postMessage({
				type: "stateChange",
				payload: { state, isConnected },
			})
		})

		this.client.on("statsUpdate", (stats) => {
			this.postMessage({
				type: "statsUpdate",
				payload: stats,
			})
		})
	}

	private sendSuccessResponse(id: string): void {
		this.postMessage({
			type: "response",
			id,
			success: true,
		})
	}

	private sendErrorResponse(id: string, error: string): void {
		this.postMessage({
			type: "response",
			id,
			success: false,
			error,
		})
	}
}

// Initialize the worker handler
new VoiceClientWorkerHandler()

// Export for TypeScript purposes
export {}
