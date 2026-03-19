import {
	BaseMessage,
	RequestMessage,
	ResponseMessage,
	EventMessage,
	CommandMessage,
	MessageCategory,
	MESSAGE_PROTOCOL_VERSION,
	CommandMetadata,
} from "../types/messages"
import { EditorError, EditorErrorCode } from "../types/errors"

/**
 * 待处理的请求
 */
interface PendingRequest {
	resolve: (value: any) => void
	reject: (error: Error) => void
	timeoutId: number
}

/**
 * 事件处理器
 */
type EventHandler = (message: EventMessage) => void

/**
 * 主进程侧的消息桥接类
 * 负责与 iframe 进行双向通信
 */
export class MessageBridge {
	private iframe: HTMLIFrameElement | null = null
	private pendingRequests = new Map<string, PendingRequest>()
	private eventHandlers = new Map<string, EventHandler[]>()
	private defaultTimeout = 5000 // 默认超时 5 秒
	private isDestroyed = false

	constructor(iframe: HTMLIFrameElement | null) {
		this.iframe = iframe
		this.setupMessageListener()
	}

	/**
	 * 设置消息监听器
	 */
	private setupMessageListener() {
		window.addEventListener("message", this.handleMessage)
	}

	/**
	 * 处理接收到的消息
	 */
	private handleMessage = (event: MessageEvent) => {
		// Early return if bridge is destroyed (prevents processing messages after cleanup)
		if (this.isDestroyed) {
			return
		}

		// 安全检查：验证消息来源
		if (!this.iframe || event.source !== this.iframe.contentWindow) {
			return
		}

		const message = event.data as BaseMessage

		// 协议版本检查：只处理新协议消息（有 version 字段的）
		// 旧协议消息（没有 version）会被忽略，不产生警告
		if (!message.version) {
			// 旧协议消息，忽略（由其他处理器处理）
			return
		}

		if (message.version !== MESSAGE_PROTOCOL_VERSION) {
			console.warn("[MessageBridge] Protocol version mismatch:", {
				expected: MESSAGE_PROTOCOL_VERSION,
				received: message.version,
				message,
			})
			return
		}

		// 根据消息类别分发处理
		switch (message.category) {
			case MessageCategory.RESPONSE:
				this.handleResponse(message as ResponseMessage)
				break
			case MessageCategory.EVENT:
				this.handleEvent(message as EventMessage)
				break
			default:
				console.warn("[MessageBridge] Unknown message category:", message.category)
		}
	}

	/**
	 * 处理响应消息
	 */
	private handleResponse(response: ResponseMessage) {
		const pending = this.pendingRequests.get(response.requestId!)
		if (!pending) {
			console.warn("[MessageBridge] No pending request found for:", response.requestId)
			return
		}

		// 清除超时定时器
		clearTimeout(pending.timeoutId)
		this.pendingRequests.delete(response.requestId!)

		if (response.success) {
			pending.resolve(response.payload)
		} else {
			const error = new EditorError(
				(response.error?.code as EditorErrorCode) || EditorErrorCode.UNKNOWN_ERROR,
				response.error?.message || "Unknown error",
				response.error?.details,
			)
			pending.reject(error)
		}
	}

	/**
	 * 处理事件消息
	 */
	private handleEvent(message: EventMessage) {
		const handlers = this.eventHandlers.get(message.type)
		if (!handlers || handlers.length === 0) {
			return
		}

		// 调用所有注册的处理器
		handlers.forEach((handler) => {
			try {
				handler(message)
			} catch (error) {
				console.error("[MessageBridge] Event handler error:", {
					eventType: message.type,
					error,
				})
			}
		})
	}

	/**
	 * 发送请求并等待响应
	 */
	public async request<T = any>(type: string, payload?: any, timeout?: number): Promise<T> {
		if (this.isDestroyed) {
			throw new EditorError(EditorErrorCode.IFRAME_NOT_READY, "MessageBridge已销毁")
		}

		if (!this.iframe?.contentWindow) {
			throw new EditorError(EditorErrorCode.IFRAME_NOT_READY, "iframe未准备就绪")
		}

		const requestId = this.generateRequestId()
		const message: RequestMessage = {
			version: MESSAGE_PROTOCOL_VERSION,
			category: MessageCategory.REQUEST,
			type,
			requestId,
			payload,
			timestamp: Date.now(),
			source: "parent",
			timeout: timeout || this.defaultTimeout,
		}

		return new Promise((resolve, reject) => {
			const timeoutDuration = timeout || this.defaultTimeout
			const timeoutId = window.setTimeout(() => {
				this.pendingRequests.delete(requestId)
				reject(
					new EditorError(
						EditorErrorCode.TIMEOUT,
						`请求超时: ${type} (${timeoutDuration}ms)`,
					),
				)
			}, timeoutDuration)

			this.pendingRequests.set(requestId, { resolve, reject, timeoutId })

			try {
				this.iframe!.contentWindow!.postMessage(message, "*")
			} catch (error) {
				clearTimeout(timeoutId)
				this.pendingRequests.delete(requestId)
				reject(
					new EditorError(
						EditorErrorCode.UNKNOWN_ERROR,
						`发送消息失败: ${error instanceof Error ? error.message : String(error)}`,
					),
				)
			}
		})
	}

	/**
	 * 发送命令（支持撤销/重做）
	 */
	public async sendCommand<T = any>(
		commandType: string,
		payload: any,
		metadata?: CommandMetadata,
	): Promise<T> {
		const commandId = this.generateCommandId()
		const message: CommandMessage = {
			version: MESSAGE_PROTOCOL_VERSION,
			category: MessageCategory.COMMAND,
			type: "EXECUTE_COMMAND",
			requestId: this.generateRequestId(),
			commandId,
			commandType,
			payload,
			metadata,
			timestamp: Date.now(),
			source: "parent",
		}

		return this.request("EXECUTE_COMMAND", message)
	}

	/**
	 * 注册事件监听器
	 */
	public on(eventType: string, handler: EventHandler): void {
		if (!this.eventHandlers.has(eventType)) {
			this.eventHandlers.set(eventType, [])
		}
		this.eventHandlers.get(eventType)!.push(handler)
	}

	/**
	 * 取消事件监听器（如果提供handler则只移除该handler，否则移除所有）
	 */
	public off(eventType: string, handler?: EventHandler): void {
		if (!handler) {
			this.eventHandlers.delete(eventType)
			return
		}

		const handlers = this.eventHandlers.get(eventType)
		if (handlers) {
			const index = handlers.indexOf(handler)
			if (index !== -1) {
				handlers.splice(index, 1)
			}
			if (handlers.length === 0) {
				this.eventHandlers.delete(eventType)
			}
		}
	}

	/**
	 * 清理资源
	 */
	public destroy(): void {
		if (this.isDestroyed) {
			console.debug("[MessageBridge] Already destroyed, skipping cleanup")
			return
		}

		console.log("[MessageBridge] Destroying bridge, cleaning up resources", {
			pendingRequests: this.pendingRequests.size,
			eventHandlers: this.eventHandlers.size,
		})

		window.removeEventListener("message", this.handleMessage)

		// 清理所有待处理的请求（静默清理，不拒绝）
		this.pendingRequests.forEach(({ timeoutId }) => {
			clearTimeout(timeoutId)
		})
		this.pendingRequests.clear()

		// 清理事件处理器
		this.eventHandlers.clear()

		this.iframe = null
		this.isDestroyed = true
	}

	/**
	 * 生成请求ID
	 */
	private generateRequestId(): string {
		return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
	}

	/**
	 * 生成命令ID
	 */
	private generateCommandId(): string {
		return `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
	}

	/**
	 * 获取待处理请求数量（用于调试）
	 */
	public getPendingRequestCount(): number {
		return this.pendingRequests.size
	}

	/**
	 * 检查是否已销毁
	 */
	public isActive(): boolean {
		return !this.isDestroyed && !!this.iframe?.contentWindow
	}
}
