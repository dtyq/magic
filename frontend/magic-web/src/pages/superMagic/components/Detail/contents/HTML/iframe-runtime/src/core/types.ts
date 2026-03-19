/**
 * Core type definitions for iframe runtime
 */

export const MESSAGE_PROTOCOL_VERSION = "1.0.0"

export enum MessageCategory {
	REQUEST = "request",
	RESPONSE = "response",
	EVENT = "event",
	COMMAND = "command",
}

export interface BaseMessage {
	version: string
	category: MessageCategory
	type: string
	timestamp: number
	source: string
}

export interface RequestMessage extends BaseMessage {
	category: MessageCategory.REQUEST
	requestId: string
	payload?: unknown
}

export interface ResponseMessage extends BaseMessage {
	category: MessageCategory.RESPONSE
	requestId: string
	success: boolean
	payload?: unknown
	error?: {
		code: string
		message: string
		details?: unknown
	}
}

export interface EventMessage extends BaseMessage {
	category: MessageCategory.EVENT
	payload?: unknown
}

export interface CommandMessage extends BaseMessage {
	category: MessageCategory.COMMAND
	commandType: string
	requestId?: string
	payload?: unknown
	metadata?: {
		canUndo?: boolean
		description?: string
	}
}

export interface CommandRecord {
	commandType: string
	payload: unknown
	previousState?: unknown
	timestamp: number
	metadata?: {
		canUndo?: boolean
		description?: string
	}
}

export interface HistoryState {
	canUndo: boolean
	canRedo: boolean
	currentIndex: number
	totalCommands: number
	undoStack: Array<{
		description: string
		timestamp: number
	}>
	redoStack: Array<{
		description: string
		timestamp: number
	}>
}

/**
 * Event type constants
 */
export enum EventType {
	EDITOR_READY = "EDITOR_READY",
	CONTENT_CHANGED = "CONTENT_CHANGED",
	HISTORY_STATE_CHANGED = "HISTORY_STATE_CHANGED",
	EDIT_MODE_CHANGED = "EDIT_MODE_CHANGED",
	SELECTION_MODE_CHANGED = "SELECTION_MODE_CHANGED",
	IFRAME_ZOOM_REQUEST = "IFRAME_ZOOM_REQUEST",
}

/**
 * Iframe zoom request payload
 */
export interface IframeZoomRequestPayload {
	delta: number
	timestamp: number
}
