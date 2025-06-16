// import { EventEmitter } from "events"
import EventFactory from "../eventFactory"
import { v4 as uuidv4 } from "uuid"

/**
 * BroadcastChannel消息类型
 */
export interface BroadcastMessage<T = any> {
	/**
	 * 消息类型
	 */
	type: string
	/**
	 * 消息负载
	 */
	payload: T
	/**
	 * 消息ID，用于标识消息
	 */
	id?: string
	/**
	 * 消息发送时间
	 */
	timestamp?: number
	/**
	 * 消息来源
	 */
	source?: string
}

/**
 * 事件监听器类型
 */
type EventListener<T = any> = (data: T) => void

/**
 * BroadcastChannel 事件类型
 */
export type BroadcastEventMap = {
	message: BroadcastMessage
	error: any
	close: void
}

/**
 * BroadcastChannel 类用于实现多个 tab 间的通信
 * 基于浏览器原生的 BroadcastChannel API
 */
export class MagicBroadcastChannel {
	private channel: BroadcastChannel | null = null
	private channelName: string
	private connected: boolean = false
	private tabId: string
	private eventListeners: Record<string, Array<EventListener>> = {}

	/**
	 * 创建一个广播频道实例
	 * @param channelName 频道名称，相同名称的频道可以互相通信
	 */
	constructor(channelName: string) {
		this.channelName = channelName
		this.tabId = uuidv4()
		this.init()
	}

	/**
	 * 初始化广播频道
	 */
	private init() {
		try {
			this.channel = new BroadcastChannel(this.channelName)
			console.log("channel", this.channel)
			this.connected = true

			// 监听消息事件
			this.channel.onmessage = (event) => {
				console.log("onmessage", event)
				this.handleMessage(event)
			}

			// 监听错误事件
			this.channel.onmessageerror = (event) => {
				this.dispatchEvent("error", event)
			}

			// 发送连接事件，通知其他标签页
			this.send({
				type: "system:connected",
				payload: {
					tabId: this.tabId,
					timestamp: Date.now(),
				},
			})
		} catch (error: unknown) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			console.error(`[BroadcastChannel] 初始化频道失败: ${errorMessage}`)
		}
	}

	/**
	 * 处理接收到的消息
	 * @param event 消息事件
	 */
	private handleMessage(event: MessageEvent) {
		const message = event.data as BroadcastMessage

		// 如果是自己发送的消息，忽略
		if (message.source === this.tabId) {
			return
		}

		// 如果消息指定了type，触发对应type的事件
		if (message.type) {
			EventFactory.dispatch(message.type, message.payload)
		}
	}

	/**
	 * 发送消息到广播频道
	 * @param message 要发送的消息
	 */
	send(message: BroadcastMessage) {
		if (!this.connected || !this.channel) {
			console.error("[BroadcastChannel] 频道未连接或未初始化")
			return
		}

		// 添加源标识和时间戳
		const enrichedMessage: BroadcastMessage = {
			...message,
			source: this.tabId,
			timestamp: message.timestamp || Date.now(),
			id: message.id || uuidv4(),
		}

		this.channel.postMessage(enrichedMessage)
	}

	/**
	 * 发送特定类型的消息
	 * @param type 消息类型
	 * @param payload 消息负载
	 */
	sendMessage<T>(type: string, payload: T) {
		this.send({
			type,
			payload,
		})
	}

	/**
	 * 内部事件分发方法
	 * @param type 事件类型
	 * @param data 事件数据
	 */
	private dispatchEvent(type: string, data?: any): boolean {
		if (!this.eventListeners[type]) {
			return false
		}

		this.eventListeners[type].forEach((listener) => listener(data))
		return true
	}

	/**
	 * 监听特定类型的消息
	 * @param type 消息类型
	 * @param listener 监听回调
	 */
	on(type: string, listener: EventListener): this {
		if (!this.eventListeners[type]) {
			this.eventListeners[type] = []
		}
		this.eventListeners[type].push(listener)
		return this
	}

	/**
	 * 监听一次特定类型的消息
	 * @param type 消息类型
	 * @param listener 监听回调
	 */
	once(type: string, listener: EventListener): this {
		const onceWrapper: EventListener = (data) => {
			listener(data)
			this.off(type, onceWrapper)
		}
		return this.on(type, onceWrapper)
	}

	/**
	 * 移除特定事件监听器
	 * @param type 事件类型
	 * @param listener 监听器函数
	 */
	off(type: string, listener: EventListener): this {
		if (this.eventListeners[type]) {
			this.eventListeners[type] = this.eventListeners[type].filter((l) => l !== listener)
		}
		return this
	}

	/**
	 * 关闭广播频道
	 */
	close() {
		if (this.connected && this.channel) {
			// 发送断开连接通知
			this.send({
				type: "system:disconnected",
				payload: {
					tabId: this.tabId,
					timestamp: Date.now(),
				},
			})

			this.channel.close()
			this.connected = false
			this.dispatchEvent("close")
		}
	}

	/**
	 * 获取当前标签页ID
	 */
	getTabId(): string {
		return this.tabId
	}

	/**
	 * 获取连接状态
	 */
	isConnected(): boolean {
		return this.connected
	}
}
