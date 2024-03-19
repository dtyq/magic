import type { BroadcastMessage } from "../broadcastChannel"

/**
 * 事件数据接口
 */
export interface EventData<T = any> {
	/**
	 * 事件类型
	 */
	type: string
	/**
	 * 事件数据
	 */
	data: T
	/**
	 * 元数据
	 */
	meta?: Record<string, any>
}

/**
 * 事件处理器类型
 */
export type EventHandler<T = any> = (data: T, meta?: Record<string, any>) => void

/**
 * 事件监听器类型
 */
export interface EventListener<T = any> {
	/**
	 * 事件处理器
	 */
	handler: EventHandler<T>
	/**
	 * 是否只触发一次
	 */
	once?: boolean
}

/**
 * 事件工厂类
 * 用于标准化事件创建和处理
 */
export class EventFactory {
	/**
	 * 事件处理器集合
	 */
	private eventHandlers: Map<string, EventListener[]> = new Map()

	/**
	 * 创建事件工厂实例
	 */
	constructor() {
		// 无须事件类型前缀相关参数
	}

	/**
	 * 判断事件处理器是否已注册
	 * @param type 事件类型
	 * @returns 是否已注册事件处理器
	 */
	public hasEventHandler(type: string): boolean {
		return this.eventHandlers.has(type) && this.eventHandlers.get(type)!.length > 0
	}

	/**
	 * 创建事件对象
	 * @param type 事件类型
	 * @param data 事件数据
	 * @param meta 事件元数据
	 * @returns 事件对象
	 */
	public createEvent<T>(type: string, data: T, meta?: Record<string, any>): EventData<T> {
		return {
			type,
			data,
			meta,
		}
	}

	/**
	 * 转换为广播消息
	 * @param event 事件对象
	 * @returns 广播消息
	 */
	public toBroadcastMessage<T>(event: EventData<T>): BroadcastMessage<T> {
		return {
			type: event.type,
			payload: event.data,
		}
	}

	/**
	 * 创建并转换为广播消息
	 * @param type 事件类型
	 * @param data 事件数据
	 * @param meta 事件元数据
	 * @returns 广播消息
	 */
	public createBroadcastMessage<T>(
		type: string,
		data: T,
		meta?: Record<string, any>,
	): BroadcastMessage<T> {
		const event = this.createEvent(type, data, meta)
		return this.toBroadcastMessage(event)
	}

	/**
	 * 处理接收到的广播消息
	 * @param message 广播消息
	 * @returns 处理后的事件对象，如果不属于该工厂则返回null
	 */
	public handleBroadcastMessage<T>(message: BroadcastMessage<T>): EventData<T> {
		return {
			type: message.type,
			data: message.payload,
			meta: {
				timestamp: message.timestamp,
				source: message.source,
				id: message.id,
			},
		}
	}

	/**
	 * 判断消息是否属于指定子类型
	 * @param message 广播消息
	 * @param type 子类型
	 * @returns 是否属于指定子类型
	 */
	public isEventType(message: BroadcastMessage, type: string): boolean {
		return message.type === type
	}

	/**
	 * 注册事件处理器
	 * @param type 事件类型
	 * @param handler 事件处理器
	 * @param options 选项
	 */
	public on<T>(type: string, handler: EventHandler<T>, options: { once?: boolean } = {}): void {
		if (!this.eventHandlers.has(type)) {
			this.eventHandlers.set(type, [])
		}

		this.eventHandlers.get(type)!.push({
			handler: handler as EventHandler<any>,
			once: options.once,
		})
	}

	/**
	 * 注册一次性事件处理器
	 * @param type 事件类型
	 * @param handler 事件处理器
	 */
	public once<T>(type: string, handler: EventHandler<T>): void {
		this.on(type, handler, { once: true })
	}

	/**
	 * 移除事件处理器
	 * @param type 事件类型
	 * @param handler 事件处理器
	 */
	public off<T>(type: string, handler?: EventHandler<T>): void {
		if (!this.eventHandlers.has(type)) {
			return
		}

		if (!handler) {
			this.eventHandlers.delete(type)
			return
		}

		const handlers = this.eventHandlers.get(type)!
		const index = handlers.findIndex((h) => h.handler === handler)
		if (index !== -1) {
			handlers.splice(index, 1)
		}

		if (handlers.length === 0) {
			this.eventHandlers.delete(type)
		}
	}

	/**
	 * 清除所有事件处理器
	 */
	public clearAllHandlers(): void {
		this.eventHandlers.clear()
	}

	/**
	 * 分发事件
	 * @param type 事件类型
	 * @param data 事件数据
	 * @param meta 事件元数据
	 * @returns 是否成功分发事件
	 */
	public dispatch<T>(type: string, data: T, meta?: Record<string, any>): boolean {
		if (!this.eventHandlers.has(type)) {
			return false
		}

		const handlers = [...this.eventHandlers.get(type)!]
		let hasDispatched = false

		for (const listener of handlers) {
			try {
				listener.handler(data, meta)
				hasDispatched = true

				if (listener.once) {
					this.off(type, listener.handler)
				}
			} catch (error) {
				console.error(`[EventFactory] Error dispatching event ${type}:`, error)
			}
		}

		return hasDispatched
	}

	/**
	 * 处理广播消息并分发给事件处理器
	 * @param message 广播消息
	 * @returns 是否成功处理广播消息
	 */
	public processMessage<T>(message: BroadcastMessage<T>): boolean {
		const event = this.handleBroadcastMessage(message)
		return this.dispatch(event.type, event.data, event.meta)
	}

	/**
	 * 获取已注册的事件类型
	 * @returns 已注册的事件类型数组
	 */
	public getRegisteredEventTypes(): string[] {
		return Array.from(this.eventHandlers.keys())
	}
}
