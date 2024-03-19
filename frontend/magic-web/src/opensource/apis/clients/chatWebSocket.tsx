/* eslint-disable @typescript-eslint/no-this-alias */
import { EngineIoPacketType } from "@/opensource/constants/socketio"
import type { EventType } from "@/opensource/types/chat"
import type { CommonResponse, WebsocketOpenResponse } from "@/opensource/types/request"
import type { SendResponse, WebSocketMessage } from "@/opensource/types/websocket"
import { WebSocketReadyState } from "@/opensource/types/websocket"
import { env } from "@/opensource/utils/env"
import { decodeSocketIoMessage } from "@/opensource/utils/socketio"
import { isString, isUndefined } from "lodash-es"
import { logger as Logger } from "@/opensource/utils/log"
import EventBus from "@/opensource/utils/eventBus"
import { interfaceStore } from "@/opensource/stores/interface"
import { UrlUtils } from "../utils"
import { VisibilityListener } from "./chatWebSocket/VisibilityListener"
import { NetworkListener } from "./chatWebSocket/NetworkListener"
import { AppActiveListener } from "./chatWebSocket/AppActiveListener"

const logger = Logger.createLogger("chatWebSocket")

export type ChatWebSocketEventMap = {
	businessMessage: [{ type: EventType; payload: unknown }]
	message: [MessageEvent<any>]
	open: [Event]
	close: [CloseEvent]
	error: [Event]
	reconnecting: []
	login: [
		{
			type: EventType.Login
			payload: { authorization: string; magicOrganizationCode: string }
		},
	]
}

/**
 * 聊天 Websocket 连接类
 * 负责管理WebSocket连接、心跳检测和自动重连
 */
export class ChatWebSocket extends EventBus {
	// WebSocket 实例，用于维护与服务器的连接
	private socket: WebSocket | null = null

	// WebSocket服务端连接地址
	private url: string = env("MAGIC_SOCKET_BASE_URL")

	// 当前重连尝试次数计数器
	private reconnectAttempts = 0

	// 最大重连尝试次数，设置为 Infinity 表示无限制
	private maxReconnectAttempts = Infinity

	// 基础重连间隔时间（毫秒），用于指数退避计算
	private baseReconnectInterval = 3000

	// 最大重连间隔时间（毫秒），指数退避的上限
	private maxReconnectInterval = 30000

	// 是否有待处理的重连（页面不可见或网络断开时暂存）
	private pendingReconnect = false

	// 页面可见性监听器
	private visibilityListener: VisibilityListener

	// 网络状态监听器
	private networkListener: NetworkListener

	// App 活跃状态监听器
	private appActiveListener: AppActiveListener

	// 心跳检测间隔时间（毫秒），定期发送ping维持连接
	private heartbeatInterval = 10000

	// 心跳超时时间（毫秒），超过此时间将关闭连接
	private heartbeatTimeout = 2000

	// 最后一次心跳时间
	private lastHeartbeatTime = 0

	// 心跳检测定时器引用，用于清理资源
	private heartbeatTimer: NodeJS.Timeout | null = null

	// 重连定时器引用，用于清理资源
	private reconnectTimer: NodeJS.Timeout | null = null

	// 正在进行的连接 Promise，用于实现连接幂等性
	private connectingPromise: Promise<WebSocket | null> | null = null

	// 是否曾经成功连接过
	private hasConnectedBefore = false

	// 递增 ACK 计数器，保证未传入 ackId 时能够生成唯一 ID
	private ackCounter = Date.now()

	/**
	 * 初始化WebSocket连接
	 * @param url WebSocket服务端地址
	 */
	constructor(url?: string) {
		super()
		if (url) this.url = url

		// 初始化监听器实例
		this.visibilityListener = new VisibilityListener()
		this.networkListener = new NetworkListener()
		this.appActiveListener = new AppActiveListener()

		// 设置页面可见性变化回调
		this.visibilityListener.onVisibleChange((visible) => {
			if (!visible) {
				// 页面变为不可见，暂停重连
				logger.log("页面不可见，暂停重连")
				if (this.reconnectTimer) {
					clearTimeout(this.reconnectTimer)
					this.reconnectTimer = null
					this.pendingReconnect = true
				}
			} else {
				// 页面重新可见，检查是否需要恢复重连
				logger.log("页面重新可见，检查是否需要恢复重连")

				// 如果已经在连接中或已经连接成功，不需要重连
				if (this.connectingPromise || this.isConnected) {
					logger.log("已有连接或正在连接，跳过页面可见触发的重连")
					return
				}

				if (
					this.pendingReconnect &&
					!this.isConnected &&
					this.networkListener.getIsOnline()
				) {
					this.pendingReconnect = false
					logger.log("页面重新可见，触发重连")
					this.reconnect({ immediate: true })
				}
			}
		})

		// 设置网络状态变化回调
		this.networkListener.onOnlineChange((online) => {
			if (online) {
				// 网络恢复，主动尝试重连
				logger.log("网络恢复，检查是否需要重连")

				// 如果已经在连接中或已经连接成功，不需要重连
				if (this.connectingPromise || this.isConnected) {
					logger.log("已有连接或正在连接，跳过网络恢复触发的重连")
					return
				}

				if (this.pendingReconnect || this.reconnectAttempts > 0) {
					this.pendingReconnect = false
					// 重置重连计数，给网络恢复后的连接一次机会
					this.reconnectAttempts = 0
					logger.log("网络恢复，触发重连")
					this.reconnect({ immediate: true })
				} else if (!this.isConnected) {
					// 即使没有待处理的重连，网络恢复时也尝试连接
					logger.log("网络恢复，尝试建立 WebSocket 连接")
					this.connect()
				}
			} else {
				// 网络断开，暂停重连尝试
				logger.log("网络断开，暂停重连尝试")
				if (this.reconnectTimer) {
					clearTimeout(this.reconnectTimer)
					this.reconnectTimer = null
					this.pendingReconnect = true
				}
			}
		})

		// 设置 App 活跃状态变化回调
		this.appActiveListener.onActiveChange((active) => {
			if (!active) {
				// App 变为不活跃，暂停重连
				logger.log("App 变为不活跃，暂停重连")
				if (this.reconnectTimer) {
					clearTimeout(this.reconnectTimer)
					this.reconnectTimer = null
					this.pendingReconnect = true
				}
			} else {
				// App 重新活跃，检查是否需要恢复重连
				logger.log("App 重新活跃，检查是否需要恢复重连")

				// 如果已经在连接中或已经连接成功，不需要重连
				if (this.connectingPromise || this.isConnected) {
					logger.log("已有连接或正在连接，跳过 App 活跃触发的重连")
					return
				}

				if (
					this.pendingReconnect &&
					!this.isConnected &&
					this.networkListener.getIsOnline() &&
					this.visibilityListener.getIsVisible()
				) {
					this.pendingReconnect = false
					logger.log("App 重新活跃，触发重连")
					this.reconnect({ immediate: true })
				}
			}
		})
	}

	/**
	 * 建立WebSocket连接
	 * 初始化事件监听和心跳检测
	 * 连接失败时触发重连机制
	 */
	public connect(options?: { showLoading?: boolean }) {
		const { showLoading = true } = options ?? {}
		// 懒加载初始化页面可见性、网络状态和 App 活跃状态监听器（只在第一次 connect 时初始化）
		this.visibilityListener.init()
		this.networkListener.init()
		this.appActiveListener.init()

		// 如果有正在进行的连接，直接返回
		if (this.connectingPromise) {
			logger.log("检测到正在进行的连接，返回现有 Promise")
			return this.connectingPromise
		}

		const that = this
		logger.log(`开始建立连接，目标地址: ${that.url}`)

		// 创建新的连接 Promise 并缓存
		this.connectingPromise = new Promise<WebSocket | null>((resolve) => {
			if (showLoading) interfaceStore.setIsConnecting(true)
			interfaceStore.setShowReloadButton(false)

			let connectTimer: NodeJS.Timeout | null = null

			try {
				if (that.isConnected) {
					logger.log("连接跳过：连接已存在且正常")
					resolve(that.socket)
					return
				}

				// Clean up existing socket before creating a new one
				if (that.socket) {
					logger.log("清理历史 WebSocket 实例")
					that.stopHeartbeat()

					// 如果旧连接还在活跃状态，先触发 close 事件
					if (
						that.socket.readyState !== WebSocketReadyState.CLOSED &&
						that.socket.readyState !== WebSocketReadyState.CLOSING
					) {
						const closeEvent = new CloseEvent("close", {
							code: 1000,
							reason: "建立新连接前清理旧连接",
							wasClean: true,
						})
						that.emit("close", closeEvent)
						that.socket.close()
					}

					that.removeEventHandlers()
					that.socket = null
				}

				const socketIoUrl = UrlUtils.transformToSocketIoUrl(that.url)
				that.socket = new WebSocket(socketIoUrl)
				that.initEventHandlers()

				const cleanup = () => {
					if (connectTimer) {
						clearTimeout(connectTimer)
						connectTimer = null
					}
					that.socket?.removeEventListener("open", onOpen)
					that.socket?.removeEventListener("error", onError)
					that.socket?.removeEventListener("close", onClose)
				}

				const onOpen = () => {
					cleanup()
					resolve(that.socket)
				}

				const onError = (e: Event) => {
					cleanup()
					logger.error("连接失败 (error)", e)
					if (
						that.socket &&
						that.socket.readyState !== WebSocketReadyState.CLOSED &&
						that.socket.readyState !== WebSocketReadyState.CLOSING
					) {
						that.socket.close()
					}
					resolve(null)
				}

				const onClose = (e: CloseEvent) => {
					cleanup()
					logger.warn("连接关闭 (close)", e)
					resolve(null)
				}

				that.socket?.addEventListener("open", onOpen)
				that.socket?.addEventListener("error", onError)
				that.socket?.addEventListener("close", onClose)

				// 设置连接超时，防止 socket 挂起
				connectTimer = setTimeout(() => {
					logger.error("连接超时")
					cleanup()
					if (that.socket && that.socket.readyState === WebSocketReadyState.CONNECTING) {
						that.socket.close()
					}
					resolve(null)
				}, 10000)
			} catch (error) {
				logger.error("连接异常:", error)
				resolve(null)
			}
		})
			.then((res) => {
				if (showLoading) interfaceStore.setIsConnecting(false)
				if (res) {
					logger.log(`连接完成，连接状态: ${res.readyState}`)
				} else {
					logger.warn("连接完成，但未获得有效连接")
				}
				return res
			})
			.finally(() => {
				// 连接完成后清除缓存，允许后续重新连接
				this.connectingPromise = null
			})

		return this.connectingPromise
	}

	/**
	 * 处理连接成功事件
	 */
	private handleOpen = (event: Event) => {
		const wasReconnecting = this.reconnectAttempts > 0
		const isReconnect = this.hasConnectedBefore
		this.hasConnectedBefore = true

		this.emit("open", { ...event, reconnect: isReconnect })

		this.reconnectAttempts = 0

		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer)
			this.reconnectTimer = null
			logger.log("清理重连定时器")
		}

		logger.log(`WebSocket连接成功${wasReconnecting ? "(重连恢复)" : "(首次连接)"}`, {
			readyState: this.socket?.readyState,
			url: this.socket?.url,
		})

		if (wasReconnecting) {
			logger.log("触发连接恢复事件，处理离线期间的消息队列")
			window.dispatchEvent(new CustomEvent("websocket:reconnected"))
		}
	}

	/**
	 * 处理连接关闭事件
	 */
	private handleClose = (event: CloseEvent) => {
		logger.log("WebSocket连接关闭", {
			code: event.code,
			reason: event.reason || "无具体原因",
			wasClean: event.wasClean,
			reconnectAttempts: this.reconnectAttempts,
		})
		this.emit("close", event)
		this.reconnect()
	}

	/**
	 * 处理连接错误事件
	 */
	private handleError = (error: Event) => {
		logger.error("WebSocket连接错误", {
			error,
			readyState: this.socket?.readyState,
			url: this.socket?.url,
			reconnectAttempts: this.reconnectAttempts,
		})
		this.emit("error", error)
	}

	/**
	 * 处理消息接收事件
	 */
	private handleMessage = (event: MessageEvent<any>) => {
		this.emit("message", event)
		try {
			const engineIoPacketType = event.data.slice(0, 1)
			switch (engineIoPacketType) {
				case EngineIoPacketType.OPEN:
					this.handleOpenPacket(event)
					break
				case EngineIoPacketType.PONG:
					this.handlePongPacket()
					break
				case EngineIoPacketType.MESSAGE:
					this.receiveMessagePacket(event)
					break
				default:
					break
			}
		} catch (error) {
			logger.error("onmessage error:", error)
		}
	}

	/**
	 * 移除WebSocket事件监听器
	 */
	private removeEventHandlers() {
		if (!this.socket) return

		this.socket.removeEventListener("open", this.handleOpen)
		this.socket.removeEventListener("close", this.handleClose)
		this.socket.removeEventListener("error", this.handleError)
		this.socket.removeEventListener("message", this.handleMessage)
	}

	/**
	 * 初始化WebSocket事件处理器
	 * 包括连接成功、断开、错误和消息接收的处理逻辑
	 */
	private initEventHandlers() {
		if (!this.socket) return

		// 清理可能存在的旧监听器（防止重复注册）
		this.removeEventHandlers()

		// 注册新的事件监听器
		this.socket.addEventListener("open", this.handleOpen)
		this.socket.addEventListener("close", this.handleClose)
		this.socket.addEventListener("error", this.handleError)
		this.socket.addEventListener("message", this.handleMessage)
	}

	/**
	 * 处理消息
	 * @param event 消息事件
	 */
	private receiveMessagePacket(event: MessageEvent<any>) {
		decodeSocketIoMessage(event.data.slice(1)).then((packet) => {
			const { data: packetData } = packet
			if (Array.isArray(packetData) && packetData.length === 2) {
				const [type, payload] = packetData as [EventType, string]
				const parsedPayload = isString(payload) ? JSON.parse(payload) : payload
				this.emit("businessMessage", { type, payload: parsedPayload })
			}
		})
	}

	/**
	 * 处理心跳响应消息
	 */
	private handlePongPacket() {
		if (this.lastHeartbeatTime) {
			const timeout = Date.now() - this.lastHeartbeatTime
			if (this.heartbeatTimeout && timeout > this.heartbeatTimeout) {
				logger.log("心跳超时，关闭连接", { timeout, threshold: this.heartbeatTimeout })
				this.socket?.close()
			}
			this.lastHeartbeatTime = 0
		}
	}

	/**
	 * 处理连接成功包
	 * @param event 消息事件
	 */
	private handleOpenPacket(event: MessageEvent<any>) {
		const data = JSON.parse(event.data.slice(1)) as WebsocketOpenResponse
		this.heartbeatInterval = data.pingInterval
		this.heartbeatTimeout = data.pingTimeout
		this.startHeartbeat()
	}

	/**
	 * 发送心跳包
	 */
	private sendHeartbeatPacket() {
		if (this.socket?.readyState === WebSocketReadyState.OPEN) {
			this.socket.send(EngineIoPacketType.PING) // 发送心跳包
			this.lastHeartbeatTime = Date.now()
		}
	}

	/**
	 * 启动心跳检测机制
	 * 定期发送ping消息维持连接活性
	 * 间隔时间由heartbeatInterval配置项控制
	 */
	private startHeartbeat() {
		if (this.heartbeatTimer) {
			clearInterval(this.heartbeatTimer)
			this.heartbeatTimer = null
		}

		this.sendHeartbeatPacket()
		this.heartbeatTimer = setInterval(() => {
			this.sendHeartbeatPacket()
		}, this.heartbeatInterval)
	}

	/**
	 * 停止心跳检测
	 * 清理心跳定时器资源，防止内存泄漏
	 */
	private stopHeartbeat() {
		if (this.heartbeatTimer) {
			clearInterval(this.heartbeatTimer)
			this.heartbeatTimer = null // 释放定时器引用
		}
	}

	/**
	 * 计算指数退避重连间隔时间
	 * @param attempt 当前重连尝试次数
	 * @returns 重连间隔时间（毫秒）
	 */
	private calculateReconnectDelay(attempt: number): number {
		// 指数退避：baseInterval * 2^attempt，但不超过最大间隔
		const delay = Math.min(
			this.baseReconnectInterval * Math.pow(2, attempt),
			this.maxReconnectInterval,
		)
		return delay
	}

	/**
	 * 执行自动重连策略
	 * 当连接异常断开时，按照指数退避策略进行重连
	 * 页面不可见或网络断开时会暂停重连，重新可见或网络恢复时恢复
	 */
	private reconnect(options?: { immediate?: boolean }) {
		const { immediate = false } = options ?? {}
		return new Promise<WebSocket | null>((resolve) => {
			// 如果已经在连接中，直接返回连接 Promise
			if (this.connectingPromise) {
				logger.log("已有连接正在进行，跳过重连")
				resolve(
					this.connectingPromise.then((socket) => {
						if (socket) return socket
						logger.log("当前连接尝试失败，继续执行重连逻辑")
						return this.reconnect()
					}),
				)
				return
			}

			// 如果已经连接成功，不需要重连
			if (this.isConnected) {
				logger.log("连接已存在，跳过重连")
				resolve(this.socket)
				return
			}

			// 如果已经有重连定时器在运行，避免重复设置
			if (this.reconnectTimer) {
				logger.log("已有重连定时器在运行，跳过本次重连请求")
				resolve(null)
				return
			}

			// 触发重连开始事件，让外部业务层处理
			this.emit("reconnecting", undefined)

			// 检查网络状态，如果离线则暂存重连请求
			if (!this.networkListener.getIsOnline()) {
				logger.log("网络离线，暂存重连请求")
				this.pendingReconnect = true
				resolve(null)
				return
			}

			// 检查页面可见性，如果不可见则暂存重连请求
			if (!this.visibilityListener.getIsVisible()) {
				logger.log("页面不可见，暂存重连请求")
				this.pendingReconnect = true
				// 页面不可见时不执行重连，返回 null
				resolve(null)
				return
			}

			// 检查 App 活跃状态，如果不活跃则暂存重连请求
			if (!this.appActiveListener.getIsActive()) {
				logger.log("App 不活跃，暂存重连请求")
				this.pendingReconnect = true
				resolve(null)
				return
			}

			const that = this
			const attemptReconnect = (reconnectDelay: number) => {
				if (!that.networkListener.getIsOnline()) {
					logger.log("网络离线，暂存重连请求")
					that.pendingReconnect = true
					resolve(null)
					return
				}

				if (!that.visibilityListener.getIsVisible()) {
					logger.log("页面不可见，暂存重连请求")
					that.pendingReconnect = true
					resolve(null)
					return
				}

				if (!that.appActiveListener.getIsActive()) {
					logger.log("App 不活跃，页面不可见，暂存重连请求")
					that.pendingReconnect = true
					resolve(null)
					return
				}

				const attemptNumber = that.reconnectAttempts + 1
				const delayLabel = reconnectDelay > 0 ? `${reconnectDelay}ms` : "0ms"
				const maxAttemptsLabel =
					that.maxReconnectAttempts === Infinity ? "" : `/${that.maxReconnectAttempts}`
				logger.log(`尝试重连 (${attemptNumber}${maxAttemptsLabel})，延迟: ${delayLabel}`)
				that.reconnectAttempts += 1
				resolve(that.connect())
			}

			if (immediate) {
				attemptReconnect(0)
				return
			}

			const delay = this.calculateReconnectDelay(this.reconnectAttempts)

			// 设置新的重连定时器
			this.reconnectTimer = setTimeout(() => {
				// 定时器触发，立即清除定时器引用
				that.reconnectTimer = null
				attemptReconnect(delay)
			}, delay)
		})
	}

	/**
	 * 发送消息方法
	 * @param message 需要发送的消息对象（会自动序列化为JSON）
	 */
	public send(message: WebSocketMessage | string) {
		if (this.isConnected) {
			this.socket!.send(message)
		} else {
			throw new Error("WebSocket未连接")
		}
	}

	/**
	 * 发送消息并等待响应
	 * @param message 消息内容
	 * @param ackId 响应ID
	 * @returns 响应数据
	 */
	public async sendAsync<D>(message: WebSocketMessage, ackId?: number) {
		const that = this
		let { socket } = that

		if (!socket) {
			socket = await that.connect()
		}

		if (!socket) {
			throw new Error("WebSocket 连接失败")
		}

		return new Promise<SendResponse<D>>((resolve, reject) => {
			let timeoutId: NodeJS.Timeout | null = null
			let isHandlerRemoved = false

			// 统一的清理函数，防止内存泄漏
			const cleanup = () => {
				if (isHandlerRemoved) return
				isHandlerRemoved = true

				socket?.removeEventListener("message", handler)
				if (timeoutId) {
					clearTimeout(timeoutId)
					timeoutId = null
				}
			}

			async function handler(e: Event) {
				const event = e as MessageEvent
				const engineIoPacketType = event.data.slice(0, 1)
				if (engineIoPacketType === EngineIoPacketType.MESSAGE) {
					const { id: ackIdResponse, data: reponse } = await decodeSocketIoMessage(
						event.data.slice(1),
					)

					if (Array.isArray(reponse)) {
						if (
							reponse.length === 1 &&
							(!isUndefined(ackId) ? ackId === ackIdResponse : true)
						) {
							// 主动发送后的响应
							const data = reponse[0] as CommonResponse<D>
							if (data.code === 1000) {
								cleanup()
								resolve({
									id: ackIdResponse,
									data: data.data,
								})
							} else {
								cleanup()
								logger.error("ws response error:", data)
								reject(data)
							}
						}
					}
				}
			}

			socket?.addEventListener("message", handler)

			that.send(message)

			// 设置超时计时器（30秒），防止永久挂起
			timeoutId = setTimeout(() => {
				cleanup()
				reject(new Error("发送超时，请求未得到响应"))
			}, 30000)
		})
	}

	private getNextAckId() {
		this.ackCounter += 1
		return this.ackCounter
	}

	private normalizeAckPayload(message: WebSocketMessage, ackId?: number) {
		if (!isString(message)) {
			return { ackId, payload: message }
		}

		const bracketIndex = message.indexOf("[")
		if (bracketIndex === -1) {
			return { ackId, payload: message }
		}

		const commaIndex = message.lastIndexOf(",", bracketIndex)
		const ackStartIndex = commaIndex === -1 ? 2 : commaIndex + 1
		const targetAckId = ackId ?? this.getNextAckId()
		const payload = `${message.slice(0, ackStartIndex)}${targetAckId}${message.slice(
			bracketIndex,
		)}`

		return { ackId: targetAckId, payload }
	}

	/**
	 * 主动关闭连接
	 * 清理所有定时器资源并终止WebSocket连接
	 * 用于页面卸载或用户主动断开场景
	 */
	public close() {
		// 1. 停止心跳
		this.stopHeartbeat()

		// 2. 清理重连定时器
		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer)
			this.reconnectTimer = null
		}

		// 3. 清理状态标识
		this.pendingReconnect = false
		this.connectingPromise = null
		// 注意：不重置 hasConnectedBefore，保持历史连接状态用于判断重连
		// this.hasConnectedBefore = false

		// 4. 销毁监听器
		this.visibilityListener.destroy()
		this.networkListener.destroy()
		this.appActiveListener.destroy()

		// 5. 手动触发 close 事件（在移除监听器之前）
		if (this.socket) {
			// 创建一个 CloseEvent 对象来保持与自动关闭时的一致性
			const closeEvent = new CloseEvent("close", {
				code: 1000,
				reason: "主动关闭连接",
				wasClean: true,
			})
			this.emit("close", closeEvent)
		}

		// 6. 移除事件处理器
		this.removeEventHandlers()

		// 7. 关闭 WebSocket 连接
		this.socket?.close()
		this.socket = null
	}

	/**
	 * 获取WebSocket连接状态
	 * 如果WebSocket实例不存在，则返回false
	 * 如果WebSocket实例存在，则返回WebSocket实例的readyState
	 * 如果结果为 true，TypeScript 会认为 this.socket 是 WebSocket 类型
	 * @returns 连接状态
	 */
	public get isConnected(): boolean {
		return !!this.socket && this.socket.readyState === WebSocketReadyState.OPEN
	}

	public getWebSocket() {
		return this.socket
	}

	async apiSend<D>(message: WebSocketMessage, ackId?: number) {
		const { ackId: normalizedAckId, payload } = this.normalizeAckPayload(message, ackId)

		if (!this.isConnected) {
			await Promise.race([
				this.connect(),
				new Promise((_, reject) => setTimeout(() => reject("websocket 连接超时"), 3000)),
			])
		}

		return new Promise<SendResponse<D>>((resolve, reject) => {
			const socket = this.getWebSocket()
			let timeoutId: NodeJS.Timeout | null = null
			let isHandlerRemoved = false

			// 统一的清理函数，防止内存泄漏
			const cleanup = () => {
				if (isHandlerRemoved) return
				isHandlerRemoved = true

				socket?.removeEventListener("message", handler)
				if (timeoutId) {
					clearTimeout(timeoutId)
					timeoutId = null
				}
			}

			async function handler(e: Event) {
				const event = e as MessageEvent
				const engineIoPacketType = event.data.slice(0, 1)
				if (engineIoPacketType === EngineIoPacketType.MESSAGE) {
					const { id: ackIdResponse, data: response } = await decodeSocketIoMessage(
						event.data.slice(1),
					)

					// 只处理对应的响应消息
					if (normalizedAckId === undefined || ackIdResponse === normalizedAckId) {
						try {
							if (Array.isArray(response)) {
								if ((response[0] as CommonResponse<D>).code === 1000) {
									cleanup()
									resolve({
										id: ackIdResponse,
										data: response[0].data,
									})
								} else {
									cleanup()
									logger.error("业务层错误", response)
									reject(response[0].data)
								}
							}
						} catch (error) {
							cleanup()
							reject(error)
						}
					}
				}
			}

			socket?.addEventListener("message", handler)

			this.send(payload)

			// 设置超时计时器
			timeoutId = setTimeout(() => {
				cleanup()
				reject(new Error("发送超时，请求未得到响应"))
			}, 3000)
		})
	}
}

const chatWebSocket = new ChatWebSocket()

chatWebSocket.on("open", () => {
	interfaceStore.setReadyState(WebSocketReadyState.OPEN)
})

chatWebSocket.on("close", () => {
	interfaceStore.setReadyState(WebSocketReadyState.CLOSED)
})

chatWebSocket.on("error", () => {
	interfaceStore.setReadyState(WebSocketReadyState.CLOSED)
})

export default chatWebSocket
