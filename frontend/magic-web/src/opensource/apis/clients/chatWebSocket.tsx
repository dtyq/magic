/* eslint-disable @typescript-eslint/no-this-alias */
import { EngineIoPacketType } from "@/const/socketio"
import type { EventType } from "@/types/chat"
import type { CommonResponse, WebsocketOpenResponse } from "@/types/request"
import type { SendResponse, WebSocketMessage } from "@/types/websocket"
import { WebSocketReadyState } from "@/types/websocket"
import { env } from "@/utils/env"
import { decodeSocketIoMessage } from "@/utils/socketio"
import { isString, isUndefined } from "lodash-es"
import Logger from "@/utils/log/Logger"
import EventBus from "@/utils/eventBus"
import { interfaceStore } from "@/opensource/stores/interface"
import { UrlUtils } from "../utils"
import { userService } from "@/services"

const logger = new Logger("chat websocket")

export type ChatWebSocketEventMap = {
	businessMessage: [{ type: EventType; payload: unknown }]
	message: [MessageEvent<any>]
	open: [Event]
	close: [CloseEvent]
	error: [Event]
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
	private url: string = env("MAGIC_SOCKET_BASE_URL") || ""

	// 当前重连尝试次数计数器
	private reconnectAttempts = 0

	// 最大重连尝试次数，超过此次数将停止重连
	private maxReconnectAttempts = 10

	// 重连间隔时间（毫秒），每次重连之间的等待时间
	private reconnectInterval = 3000

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

	/**
	 * 初始化WebSocket连接
	 * @param url WebSocket服务端地址
	 */
	constructor(url?: string) {
		super()
		if (url) this.url = url
	}

	/**
	 * 建立WebSocket连接
	 * 初始化事件监听和心跳检测
	 * 连接失败时触发重连机制
	 */
	public connect(reconnect: boolean = false) {
		const that = this

		return new Promise<WebSocket | null>((resolve) => {
			interfaceStore.setIsConnecting(true)
			interfaceStore.setShowReloadButton(false)

			try {
				if (that.isConnected) {
					resolve(that.socket)
					return
				}

				const socketIoUrl = UrlUtils.transformToSocketIoUrl(that.url)
				that.socket = new WebSocket(socketIoUrl)
				that.initEventHandlers(reconnect)
				that.startHeartbeat()

				const callback = () => {
					that.socket?.removeEventListener("open", callback)
					resolve(that.socket)
				}
				that.socket?.addEventListener("open", callback)
			} catch (error) {
				resolve(that.reconnect())
				// reject(error)
			}
		}).then((res) => {
			interfaceStore.setIsConnecting(false)
			return res
		})
	}

	openCallback(event: Event) {
		this.emit("open", event)

		// 重置重连计数
		this.reconnectAttempts = 0
		// 如果有重连定时器，清除
		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer)
			this.reconnectTimer = null
		}
		logger.log("连接成功", event)

		// 触发连接恢复事件，以便处理离线期间的消息队列
		if (this.reconnectAttempts > 0) {
			// 如果是重连成功，则触发连接恢复事件
			window.dispatchEvent(new CustomEvent("websocket:reconnected"))
		}
	}

	closeCallback(event: CloseEvent) {
		logger.log("连接关闭", event)
		this.reconnect()
		this.emit("close", event)
	}

	errorCallback(error: Event) {
		logger.error("连接错误", error)
		this.emit("error", error)
	}

	messageCallback(event: MessageEvent<any>) {
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
	 * 初始化WebSocket事件处理器
	 * 包括连接成功、断开、错误和消息接收的处理逻辑
	 */
	private initEventHandlers(reconnect: boolean) {
		if (!this.socket) return

		this.openCallback = (event: Event) => this.openCallback({ ...event, reconnect } as Event)

		this.socket.addEventListener("open", (event: Event) => {
			this.emit("open", { ...event, reconnect })

			// 重置重连计数
			this.reconnectAttempts = 0
			// 如果有重连定时器，清除
			if (this.reconnectTimer) {
				clearTimeout(this.reconnectTimer)
				this.reconnectTimer = null
			}
			logger.log("连接成功", event)
		})
		// 连接关闭回调：更新状态并尝试重连
		this.socket.addEventListener("close", (event: CloseEvent) => {
			logger.log("连接关闭", event)
			this.reconnect()
			this.emit("close", event)
		})
		// 错误处理回调：记录错误并更新状态
		this.socket.addEventListener("error", (error: Event) => {
			logger.error("连接错误", error)
			this.emit("error", error)
		})
		// 消息接收处理：解析消息并分发到对应处理器
		this.socket.addEventListener("message", (event: MessageEvent<any>) => {
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
		})
	}

	// private removeEventHandlers() {
	// 	this.socket?.removeEventListener("open", this.openCallback)
	// 	this.socket?.removeEventListener("close", this.closeCallback)
	// 	this.socket?.removeEventListener("error", this.errorCallback)
	// 	this.socket?.removeEventListener("message", this.messageCallback)
	// }

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
				logger.log("心跳超时", timeout)
				// this.socket?.close()
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
	 * 执行自动重连策略
	 * 当连接异常断开时，按照配置的间隔和次数进行重连
	 * 重连次数达到上限后将停止尝试
	 */
	private reconnect() {
		return new Promise<WebSocket | null>((resolve, reject) => {
			userService.clearLastLogin()

			if (this.reconnectAttempts >= this.maxReconnectAttempts) {
				logger.log("达到最大重连次数")
				interfaceStore.setShowReloadButton(true)
				interfaceStore.setIsConnecting(false)
				reject(new Error("达到最大重连次数"))
				return
			}

			// 清理已有定时器避免重复
			if (this.reconnectTimer) {
				clearTimeout(this.reconnectTimer)
			}

			const that = this

			// 设置新的重连定时器
			this.reconnectTimer = setTimeout(() => {
				logger.log(`尝试重连 (${that.reconnectAttempts + 1}/${that.maxReconnectAttempts})`)
				that.reconnectAttempts += 1
				resolve(that.connect(true)) // 执行实际连接操作
			}, this.reconnectInterval)
		})
	}

	/**
	 * 发送消息方法
	 * @param message 需要发送的消息对象（会自动序列化为JSON）
	 */
	public send(message: any) {
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

		return new Promise<SendResponse<D>>((resolve, reject) => {
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
								resolve({
									id: ackIdResponse,
									data: data.data,
								})
							} else {
								reject(data)
								logger.error("ws response error:", data)
							}
							socket?.removeEventListener("message", handler)
						}
					}
				}
			}

			socket?.addEventListener("message", handler)

			that.send(message)
		})
	}

	/**
	 * 主动关闭连接
	 * 清理所有定时器资源并终止WebSocket连接
	 * 用于页面卸载或用户主动断开场景
	 */
	public close() {
		this.stopHeartbeat()
		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer)
			this.reconnectTimer = null
		}
		this.socket?.close() // 安全关闭连接
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
		if (!this.isConnected) {
			await Promise.race([
				this.connect(),
				new Promise((reject) => setTimeout(() => reject("websocket 连接超时"), 3000)),
			])
		}

		return new Promise<SendResponse<D>>((resolve, reject) => {
			const socket = this.getWebSocket()
			let timeoutId: NodeJS.Timeout | null = null

			async function handler(e: Event) {
				const event = e as MessageEvent
				const engineIoPacketType = event.data.slice(0, 1)
				if (engineIoPacketType === EngineIoPacketType.MESSAGE) {
					const { id: ackIdResponse, data: reponse } = await decodeSocketIoMessage(
						event.data.slice(1),
					)

					// 只处理对应的响应消息
					if (!ackId || (ackId && ackIdResponse === ackId)) {
						try {
							if (
								Array.isArray(reponse) &&
								(reponse[0] as CommonResponse<D>).code === 1000
							) {
								socket?.removeEventListener("message", handler)
								if (timeoutId) {
									clearTimeout(timeoutId)
								}
								resolve({
									id: ackIdResponse,
									data: reponse[0].data,
								})
							}
						} catch (error) {
							socket?.removeEventListener("message", handler)
							if (timeoutId) {
								clearTimeout(timeoutId)
							}
							reject(error)
						}
					}
				}
			}

			socket?.addEventListener("message", handler)

			this.send(message)

			// 设置超时计时器
			timeoutId = setTimeout(() => {
				socket?.removeEventListener("message", handler)
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
