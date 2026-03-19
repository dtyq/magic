/**
 * Web Worker VoiceClient communication types
 * Defines message protocols between main thread and worker
 */

import type { VoiceConfig, VoiceResult, ConnectionState, AudioStats } from "./types"

// Message types from main thread to worker
export interface WorkerMessages {
	connect: {
		type: "connect"
		id: string
		payload: {
			config: VoiceConfig
			recordingId?: string
		}
	}
	disconnect: {
		type: "disconnect"
		id: string
	}
	updateConfig: {
		type: "updateConfig"
		id: string
		payload: {
			config: Partial<VoiceConfig>
		}
	}
	sendEndSignal: {
		type: "sendEndSignal"
		id: string
	}
	dispose: {
		type: "dispose"
		id: string
	}
	// Queue management messages
	queueAudio: {
		type: "queueAudio"
		id: string
		payload: {
			audioData: ArrayBuffer
		}
	}
	batchQueueAudio: {
		type: "batchQueueAudio"
		id: string
		payload: {
			audioDataList: ArrayBuffer[]
		}
	}
	startSending: {
		type: "startSending"
		id: string
	}
	stopSending: {
		type: "stopSending"
		id: string
	}
	getQueueStatus: {
		type: "getQueueStatus"
		id: string
	}
	exportPacketLogs: {
		type: "exportPacketLogs"
		id: string
		payload: {
			connectionId: string
		}
	}
	setPacketLoggingEnabled: {
		type: "setPacketLoggingEnabled"
		id: string
		payload: {
			enabled: boolean
		}
	}
}

// Message types from worker to main thread
export interface MainThreadMessages {
	ready: {
		type: "ready"
	}
	response: {
		type: "response"
		id: string
		success: boolean
		error?: string
	}
	event: {
		type: "event"
		eventType: "log" | "error" | "status" | "open" | "close" | "retry" | "resetRequired"
		payload: EventPayloads[keyof EventPayloads]
	}
	result: {
		type: "result"
		payload: VoiceResult
	}
	stateChange: {
		type: "stateChange"
		payload: {
			state: ConnectionState
			isConnected: boolean
		}
	}
	statsUpdate: {
		type: "statsUpdate"
		payload: AudioStats
	}
	reconnectInfo: {
		type: "reconnectInfo"
		payload: {
			count: number
			maxAttempts: number
			lastReconnectTime: number
			isInCooldown: boolean
		}
	}
	// Queue management responses
	queueStatus: {
		type: "queueStatus"
		payload: {
			queueLength: number
			isSending: boolean
			totalBytesPending: number
		}
	}
	exportPacketLogs: {
		type: "exportPacketLogs"
		payload: {
			blob: Blob
		}
	}
}

// Union types for easier usage
export type WorkerMessage = WorkerMessages[keyof WorkerMessages]
export type MainThreadMessage = MainThreadMessages[keyof MainThreadMessages]

// Helper type for event payloads
export interface EventPayloads {
	log: { message: string; type: "info" | "success" | "error" | "warning" }
	error: { message: string; code?: string | number }
	status: {
		message: string
		state: "connecting" | "connected" | "recording" | "error" | "reconnecting" | "stop"
	}
	open: object
	close: { code?: number; reason?: string }
	retry: { attempt: number; maxAttempts: number }
	resetRequired: object
}

// Promise resolver type for async operations
export interface PendingRequest {
	resolve: (value?: void) => void
	reject: (error: Error) => void
}
