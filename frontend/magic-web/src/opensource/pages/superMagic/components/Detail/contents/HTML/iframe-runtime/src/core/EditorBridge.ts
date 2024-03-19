/**
 * Editor Bridge
 * Handles communication between iframe and parent window
 */

import {
	MESSAGE_PROTOCOL_VERSION,
	MessageCategory,
	type RequestMessage,
	type ResponseMessage,
	type EventMessage,
	type CommandMessage,
} from "./types"

type RequestHandler = (payload: unknown) => unknown | Promise<unknown>
type CommandHandler = (payload: unknown) => unknown | Promise<unknown>

export class EditorBridge {
	private isDestroyed = false
	private commandHandlers = new Map<string, CommandHandler>()
	private requestHandlers = new Map<string, RequestHandler>()
	private messageListener: ((event: MessageEvent) => void) | null = null

	constructor() {
		this.setupMessageListener()
	}

	private setupMessageListener() {
		// Store the listener reference so it can be removed later
		this.messageListener = (event: MessageEvent) => {
			// Ignore if already destroyed
			if (this.isDestroyed) return

			// Only handle messages from parent window
			if (event.source !== window.parent) return

			const message = event.data
			// Only handle standard protocol messages
			if (!message || message.version !== MESSAGE_PROTOCOL_VERSION) return

			// Handle request messages (including commands)
			if (
				message.category === MessageCategory.REQUEST &&
				message.type === "EXECUTE_COMMAND"
			) {
				// REQUEST message payload contains actual COMMAND message
				const commandMessage = message.payload as CommandMessage
				if (commandMessage && commandMessage.category === MessageCategory.COMMAND) {
					// Pass the outer REQUEST's requestId to handleCommand
					this.handleCommand(commandMessage, message.requestId)
				}
			}
			// Handle other request messages
			else if (message.category === MessageCategory.REQUEST) {
				this.handleRequest(message as RequestMessage)
			}
			// Handle direct command messages (backward compatibility)
			else if (message.category === MessageCategory.COMMAND) {
				this.handleCommand(message as CommandMessage)
			}
		}

		window.addEventListener("message", this.messageListener)
	}

	private async handleRequest(request: RequestMessage) {
		const handler = this.requestHandlers.get(request.type)
		const response: ResponseMessage = {
			version: MESSAGE_PROTOCOL_VERSION,
			category: MessageCategory.RESPONSE,
			type: request.type,
			requestId: request.requestId,
			timestamp: Date.now(),
			source: "iframe",
			success: false,
		}

		try {
			if (!handler) {
				throw new Error(`Unknown request type: ${request.type}`)
			}
			// Support both sync and async handlers
			const result = await handler(request.payload)
			response.success = true
			response.payload = result
		} catch (error) {
			response.success = false
			response.error = {
				code: "REQUEST_FAILED",
				message: (error as Error).message || String(error),
			}
		}

		this.sendResponse(response)
	}

	private async handleCommand(command: CommandMessage, outerRequestId?: string) {
		const handler = this.commandHandlers.get(command.commandType)
		const response: ResponseMessage = {
			version: MESSAGE_PROTOCOL_VERSION,
			category: MessageCategory.RESPONSE,
			type: "EXECUTE_COMMAND",
			// Use outer REQUEST's requestId if provided (for wrapped commands),
			// otherwise use command's own requestId (for direct commands)
			requestId: outerRequestId || command.requestId || "",
			timestamp: Date.now(),
			source: "iframe",
			success: false,
		}

		try {
			if (!handler) {
				throw new Error(`Unknown command type: ${command.commandType}`)
			}
			const result = await handler(command.payload)

			response.success = true
			response.payload = result
		} catch (error) {
			console.error("[EditorBridge] Command failed:", {
				commandType: command.commandType,
				error,
			})
			response.success = false
			response.error = {
				code: "COMMAND_FAILED",
				message: (error as Error).message || String(error),
				details: {
					commandType: command.commandType,
					stack: (error as Error).stack,
				},
			}
		}

		this.sendResponse(response)
	}

	private sendResponse(response: ResponseMessage) {
		if (this.isDestroyed) return

		try {
			window.parent.postMessage(response, "*")
		} catch (error) {
			console.error("[EditorBridge] Failed to send response:", error)
		}
	}

	sendEvent(type: string, payload?: unknown) {
		if (this.isDestroyed) {
			console.warn("[EditorBridge] Cannot send event, bridge is destroyed")
			return
		}

		try {
			const event: EventMessage = {
				version: MESSAGE_PROTOCOL_VERSION,
				category: MessageCategory.EVENT,
				type,
				payload,
				timestamp: Date.now(),
				source: "iframe",
			}
			window.parent.postMessage(event, "*")
		} catch (error) {
			console.error("[EditorBridge] Failed to send event:", {
				type,
				error,
			})
		}
	}

	onCommand(commandType: string, handler: CommandHandler) {
		this.commandHandlers.set(commandType, handler)
	}

	onRequest(requestType: string, handler: RequestHandler) {
		this.requestHandlers.set(requestType, handler)
	}

	destroy() {
		this.isDestroyed = true
		this.commandHandlers.clear()
		this.requestHandlers.clear()

		// Remove the message event listener to prevent memory leaks and duplicate handling
		if (this.messageListener) {
			window.removeEventListener("message", this.messageListener)
			this.messageListener = null
		}
	}

	isActive(): boolean {
		return !this.isDestroyed
	}
}
