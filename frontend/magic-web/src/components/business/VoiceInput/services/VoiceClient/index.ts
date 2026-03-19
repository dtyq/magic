/**
 * VoiceClient.ts
 *
 * 封装与火山引擎ASR服务的WebSocket通信和协议，负责：
 * - 建立和管理WebSocket连接
 * - 实现火山引擎的二进制协议（头部创建、消息打包）
 * - 发送控制和音频数据
 * - 通过事件向外暴露连接状态和收到的数据
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
import {
	generateUUID,
	delay,
	calculateExponentialBackoff,
	hasEnoughTimePassed,
} from "./utils/common-utils"
import { VoiceConfig, ConnectionState, VoiceClientEvents, RetryConfig, AudioStats } from "./types"

export class VoiceClient {
	private config: VoiceConfig
	private ws: WebSocket | null = null
	private connectionState: ConnectionState = "disconnected"
	private sequenceNumber = 1
	private events: Partial<VoiceClientEvents> = {}
	private retryConfig: RetryConfig
	private reconnectTimer: NodeJS.Timeout | null = null
	private heartbeatTimer: NodeJS.Timeout | null = null
	private audioStats: AudioStats = { totalBytes: 0, totalDuration: 0, packetCount: 0 }
	private disposed = false
	private isReconnecting = false
	private globalReconnectCount = 0
	private lastReconnectTime = 0
	private maxGlobalReconnects = 10
	private reconnectCooldown = 5000
	private minReconnectInterval = 1000
	private connectionStableTimer: NodeJS.Timeout | null = null
	private connectionStableDelay = 10000
	refreshToken: () => Promise<VoiceConfig>

	connectionId: string = ""

	constructor(config: VoiceConfig, refreshToken: () => Promise<VoiceConfig>) {
		this.config = validateAndNormalizeConfig(config)
		this.refreshToken = refreshToken
		this.retryConfig = this.config.retry || {
			maxAttempts: 3,
			delay: 1000,
			backoffMultiplier: 2,
		}
		// 初始化重连配置
		this.maxGlobalReconnects = this.config.retry?.maxGlobalReconnects ?? 10
		this.reconnectCooldown = this.config.retry?.reconnectCooldown ?? 5000
		this.minReconnectInterval = this.config.retry?.minReconnectInterval ?? 1000
		this.connectionStableDelay = this.config.retry?.connectionStableDelay ?? 10000
	}

	on<K extends keyof VoiceClientEvents>(event: K, callback: VoiceClientEvents[K]) {
		this.events[event] = callback
	}

	private emit<K extends keyof VoiceClientEvents>(
		event: K,
		...args: Parameters<NonNullable<VoiceClientEvents[K]>>
	) {
		const callback = this.events[event]
		if (callback) {
			;(
				callback as unknown as (
					...args: Parameters<NonNullable<VoiceClientEvents[K]>>
				) => void
			)(...args)
		}
	}

	updateConfig(newConfig: Partial<VoiceConfig>) {
		this.config = validateAndNormalizeConfig({ ...this.config, ...newConfig })
		if (newConfig.retry) {
			this.retryConfig = newConfig.retry
			// 更新重连配置
			this.maxGlobalReconnects =
				newConfig.retry.maxGlobalReconnects ?? this.maxGlobalReconnects
			this.reconnectCooldown = newConfig.retry.reconnectCooldown ?? this.reconnectCooldown
			this.minReconnectInterval =
				newConfig.retry.minReconnectInterval ?? this.minReconnectInterval
			this.connectionStableDelay =
				newConfig.retry.connectionStableDelay ?? this.connectionStableDelay
		}
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

	get reconnectInfo(): {
		count: number
		maxAttempts: number
		lastReconnectTime: number
		isInCooldown: boolean
	} {
		const now = Date.now()
		return {
			count: this.globalReconnectCount,
			maxAttempts: this.maxGlobalReconnects,
			lastReconnectTime: this.lastReconnectTime,
			isInCooldown: now - this.lastReconnectTime < this.reconnectCooldown,
		}
	}

	dispose(): void {
		if (this.disposed) return
		this.disposed = true

		this.clearTimers()
		this.isReconnecting = false
		this.globalReconnectCount = 0
		this.lastReconnectTime = 0
		this.disconnect()
		this.events = {}
	}

	private clearTimers(): void {
		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer)
			this.reconnectTimer = null
		}
		if (this.heartbeatTimer) {
			clearTimeout(this.heartbeatTimer)
			this.heartbeatTimer = null
		}
		if (this.connectionStableTimer) {
			clearTimeout(this.connectionStableTimer)
			this.connectionStableTimer = null
		}
	}

	async connect(): Promise<void> {
		if (this.disposed) {
			throw new Error("VoiceClient已被销毁")
		}

		if (this.connectionState === "connected" || this.connectionState === "connecting") {
			return
		}

		// 用户主动连接时重置重连计数器
		this.globalReconnectCount = 0
		this.lastReconnectTime = 0

		return this.connectWithRetry()
	}

	private async connectWithRetry(): Promise<void> {
		if (this.isReconnecting) {
			this.emit("log", "重连已在进行中，跳过重复重连", "info")
			return
		}

		this.isReconnecting = true
		try {
			for (let attempt = 0; attempt < this.retryConfig.maxAttempts; attempt++) {
				if (this.disposed) return

				try {
					if (attempt > 0) {
						this.connectionState = "reconnecting"
						this.emit("retry", attempt, this.retryConfig.maxAttempts)
						this.emit(
							"status",
							`正在重试连接 (${attempt}/${this.retryConfig.maxAttempts})...`,
							"reconnecting",
						)
						const delayMs =
							this.retryConfig.delay *
							Math.pow(this.retryConfig.backoffMultiplier, attempt - 1)
						this.emit("log", `等待 ${delayMs}ms 后重试...`, "info")
						await delay(delayMs)

						// 重连时刷新Token
						const config = await this.refreshToken()
						this.config = validateAndNormalizeConfig(config)
					}

					await this.attemptConnection()
					this.emit(
						"log",
						`连接成功 (尝试 ${attempt + 1}/${this.retryConfig.maxAttempts})`,
						"success",
					)
					return
				} catch (error) {
					const errorMsg = (error as Error).message
					this.emit("log", `连接尝试 ${attempt + 1} 失败: ${errorMsg}`, "warning")

					if (attempt === this.retryConfig.maxAttempts - 1) {
						this.connectionState = "error"
						this.emit(
							"error",
							`连接失败，已达到最大重试次数 (${this.retryConfig.maxAttempts}): ${errorMsg}`,
							"MAX_RETRY_EXCEEDED",
						)
						this.emit("status", "连接失败", "error")
						throw error
					}
				}
			}
		} finally {
			this.isReconnecting = false
		}
	}

	private async attemptConnection(): Promise<void> {
		return new Promise((resolve, reject) => {
			try {
				this.connectionState = "connecting"
				this.emit("status", "正在连接语音识别服务...", "connecting")

				// 确保之前的 WebSocket 实例被清理
				if (this.ws) {
					this.ws.onopen = null
					this.ws.onclose = null
					this.ws.onmessage = null
					this.ws.onerror = null
					this.ws.close()
					this.ws = null
				}

				// Generate connection ID for this session
				const connectId = generateUUID()
				this.connectionId = connectId
				this.emit("log", `Connection ID: ${connectId}`, "info")

				// 构建带有认证参数的WebSocket URL
				const wsUrl = buildWsUrl(
					this.config.wsUrl,
					this.config.resourceId,
					this.config.apiAppId,
					this.config.authToken || "",
					connectId,
				)
				this.emit("log", `连接URL: ${wsUrl}`, "info")

				this.ws = new WebSocket(wsUrl)
				this.ws.binaryType = "arraybuffer"

				const connectionTimeout = setTimeout(() => {
					if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
						this.ws.close()
						reject(new Error("连接超时"))
					}
				}, PROTOCOL_CONSTANTS.CONNECTION_TIMEOUT)

				this.ws.onopen = () => {
					clearTimeout(connectionTimeout)
					this.connectionState = "connected"
					this.sequenceNumber = 1
					this.resetAudioStats()
					this.emit("open")
					this.emit("log", "WebSocket连接已建立", "success")
					this.emit("status", "连接已建立", "connected")

					// 如果是重连，启动稳定性检查；如果是首次连接，直接重置计数器
					if (this.globalReconnectCount > 0) {
						this.startConnectionStabilityCheck()
					} else {
						// 首次连接成功，确保计数器为0
						this.globalReconnectCount = 0
					}

					this.sendInitialRequest()
						.then(() => resolve())
						.catch(reject)
				}

				this.ws.onerror = (event) => {
					clearTimeout(connectionTimeout)
					const error = new Error(`WebSocket连接错误: ${event.type}`)
					this.emit("error", error.message, "CONNECTION_ERROR")
					reject(error)
				}

				this.ws.onclose = (event) => {
					clearTimeout(connectionTimeout)
					this.handleConnectionClose(event)
					if (this.connectionState === "connecting") {
						reject(new Error(`连接关闭: ${event.reason || event.code}`))
					}
				}

				this.ws.onmessage = (event) => this.handleMessage(event.data)
			} catch (error) {
				reject(error)
			}
		})
	}

	private resetAudioStats(): void {
		this.audioStats = { totalBytes: 0, totalDuration: 0, packetCount: 0 }
	}

	private handleConnectionClose(event: CloseEvent): void {
		this.clearTimers()
		const wasConnected = this.connectionState === "connected"

		// 清理旧的 WebSocket 实例
		if (this.ws) {
			this.ws.onopen = null
			this.ws.onclose = null
			this.ws.onmessage = null
			this.ws.onerror = null
			this.ws = null
		}

		console.log("event", event)

		this.connectionState = "disconnected"

		this.emit("close", event.code, event.reason)
		this.emit(
			"log",
			`WebSocket连接已关闭 (代码: ${event.code}, 原因: ${event.reason || "未知"})`,
			"warning",
		)

		// 如果是异常断开（非主动断开），且之前处于连接状态，且不在重连中，则尝试重连
		if (wasConnected && event.code !== 1000 && !this.disposed && !this.isReconnecting) {
			// 检查是否应该重连
			if (this.shouldAttemptReconnect()) {
				this.emit("log", "检测到连接异常断开，开始重连...", "info")
				this.emit("status", "连接断开，正在重连...", "reconnecting")

				// 计算重连延迟时间
				const reconnectDelay = this.calculateReconnectDelay()
				this.emit("log", `等待 ${reconnectDelay}ms 后开始重连...`, "info")

				// 使用计算出的延迟时间后开始重连
				this.reconnectTimer = setTimeout(() => {
					this.attemptGlobalReconnect().catch((error: Error) => {
						this.emit("error", `重连失败: ${error.message}`, "RECONNECT_FAILED")
						this.emit("status", "重连失败", "error")
					})
				}, reconnectDelay)
			} else {
				this.emit("log", "已达到最大重连次数或处于冷却期，停止重连", "warning")
				this.emit("status", "重连已停止", "error")
				this.emit("resetRequired")
			}
		} else {
			// 正常断开或其他情况
			if (this.isReconnecting) {
				this.emit("log", "连接关闭，但重连正在进行中", "info")
			} else {
				this.emit("status", "连接已断开", "stop")
			}
		}
	}

	disconnect(): void {
		this.clearTimers()
		if (this.ws) {
			// 清理事件处理器，防止在 close 后触发额外的事件
			this.ws.onopen = null
			this.ws.onclose = null
			this.ws.onmessage = null
			this.ws.onerror = null
			this.ws.close(1000, "Client disconnect")
			this.ws = null
		}
		this.connectionState = "disconnected"
		this.emit("status", "已断开连接", "error")
	}

	sendEndSignal(): void {
		if (!this.isConnected) {
			this.emit("log", "连接未建立，无法发送结束信号", "warning")
			return
		}
		this.sendAudioAsync(new ArrayBuffer(0), true)
	}

	sendAudio(audioData: ArrayBuffer): void {
		if (!this.isConnected) {
			this.emit("log", "连接未建立，无法发送音频数据", "warning")
			return
		}
		this.sendAudioAsync(audioData, false)
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

			// 更新统计信息
			this.updateAudioStats(audioData, isLast)

			// 日志记录
			this.logAudioData(audioData, isLast, sequence)

			this.sequenceNumber++
		} catch (error) {
			this.emit("error", `发送音频数据失败: ${(error as Error).message}`, "SEND_AUDIO_ERROR")
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
				`发送了 ${audioData.byteLength} 字节音频数据 (${samples}样本, ${durationMs.toFixed(
					1,
				)}ms) (Seq: ${sequence})`,
				"info",
			)
		} else {
			this.emit(
				"log",
				isLast
					? `发送了结束信号 (Seq: ${sequence})`
					: `发送了 ${audioData.byteLength} 字节的音频数据 (Seq: ${sequence})`,
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
				throw new Error("WebSocket连接未就绪")
			}

			this.ws.send(messageBody)
			this.emit("log", `初始化请求已发送 (Seq: ${this.sequenceNumber})`, "success")
			this.sequenceNumber++
		} catch (error) {
			this.emit(
				"error",
				`发送初始化请求失败: ${(error as Error).message}`,
				"INIT_REQUEST_ERROR",
			)
			throw error // 让调用者处理错误，而不是直接断开连接
		}
	}

	private async handleMessage(data: unknown): Promise<void> {
		try {
			const normalized = await normalizeMessageData(data)

			// Handle different message types
			if (normalized.messageType === "text" && normalized.originalData) {
				this.handleTextMessage(normalized.originalData)
				return
			} else if (normalized.messageType === "unknown") {
				this.emit("log", `收到未知类型的消息: ${typeof data}`, "warning")
				return
			}

			const buffer = normalized.buffer
			if (!buffer) return

			if (buffer.byteLength < PROTOCOL_CONSTANTS.MIN_MESSAGE_SIZE) {
				this.emit("log", "收到无效的短消息", "warning")
				return
			}

			const { messageType, sequence } = parseMessageHeader(buffer)

			this.emit(
				"log",
				`收到消息类型: 0x${messageType.toString(16).padStart(2, "0")}, 序列号: ${sequence}`,
				"info",
			)

			const isLastPackage = sequence < 0
			if (isLastPackage && messageType === PROTOCOL_CONSTANTS.FULL_SERVER_RESPONSE) {
				this.handleServerResponse(buffer)
				this.emit("log", "收到最后一包响应，识别完成", "success")
				return
			}

			this.routeMessage(messageType, buffer, sequence)
		} catch (e) {
			this.emit("error", `处理消息失败: ${(e as Error).message}`, "MESSAGE_HANDLE_ERROR")
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
				this.emit("log", `未知的消息类型: 0x${messageType.toString(16)}`, "warning")
		}
	}

	private handleTextMessage(text: string): void {
		this.emit("log", `收到文本消息: ${text}`, "info")

		const parsed = parseTextMessage(text)

		// Emit logs from the parser
		parsed.logs.forEach((log) => {
			this.emit("log", log.message, log.level === "error" ? "error" : "info")
		})

		if (parsed.isError && parsed.errorMessage) {
			this.emit("error", parsed.errorMessage, parsed.errorCode)

			// 处理会话结束/超时错误
			if (parsed.shouldReconnect && !this.disposed && !this.isReconnecting) {
				this.emit("log", "检测到会话结束/超时错误，准备进行自动重连...", "warning")
				this.disconnect()
				this.emit("status", "连接断开，正在重连...", "reconnecting")
				this.attemptGlobalReconnect().catch((e: Error) => {
					this.emit("error", `自动重连失败: ${e.message}`, "RECONNECT_FAILED")
					this.emit("status", "重连失败", "error")
				})
			}
		} else if (parsed.result) {
			this.emit("result", parsed.result)
		}
	}

	private async handleServerResponse(data: ArrayBuffer): Promise<void> {
		try {
			const payload = extractPayload(data)
			const textData = new TextDecoder().decode(payload)
			this.emit("log", `收到识别结果: ${textData}`, "info")

			const parsed = parseServerResponse(textData)

			// Emit logs from the parser
			parsed.logs.forEach((log) => {
				this.emit("log", log.message, log.level)
			})

			if (parsed.result) {
				this.emit("result", parsed.result)
			} else if (parsed.error) {
				this.emit("error", parsed.error, "RESPONSE_PARSE_ERROR")
			} else {
				this.emit("log", `解析结果为空`, "warning")
			}
		} catch (e) {
			this.emit(
				"error",
				`解析响应失败: ${e ? (e as Error).message || e.toString() : "未知错误"}`,
				"RESPONSE_PARSE_ERROR",
			)
		}
	}

	private handleServerAck(data: ArrayBuffer, sequence: number): void {
		try {
			const payload = extractPayload(data)
			const textData = new TextDecoder().decode(payload)
			this.emit("log", `收到服务器ACK (Seq: ${sequence}): ${textData}`, "info")
		} catch (e) {
			this.emit("log", `解析ACK失败: ${(e as Error).message}`, "warning")
		}
	}

	private handleErrorResponse(data: ArrayBuffer, sequence: number): void {
		try {
			const payload = extractPayload(data)
			const errorMsg = new TextDecoder().decode(payload)
			this.emit("error", `服务器错误 (代码: ${sequence}): ${errorMsg}`, sequence)
		} catch (e) {
			this.emit("error", `解析错误响应失败: ${(e as Error).message}`, "ERROR_PARSE_ERROR")
		}
	}

	/**
	 * 检查是否应该尝试重连
	 */
	private shouldAttemptReconnect(): boolean {
		const now = Date.now()

		// 检查是否超过最大重连次数
		if (this.globalReconnectCount >= this.maxGlobalReconnects) {
			this.emit("log", `已达到最大重连次数 ${this.maxGlobalReconnects}`, "warning")
			return false
		}

		// 检查是否在冷却期内（但只有在已经重连过的情况下才检查）
		if (
			this.globalReconnectCount > 0 &&
			now - this.lastReconnectTime < this.reconnectCooldown
		) {
			this.emit(
				"log",
				`处于重连冷却期，距离上次重连 ${now - this.lastReconnectTime}ms`,
				"info",
			)
			return false
		}

		return true
	}

	/**
	 * 计算重连延迟时间
	 */
	private calculateReconnectDelay(): number {
		const now = Date.now()
		const timeSinceLastReconnect = now - this.lastReconnectTime

		// 如果距离上次重连时间太短，增加延迟
		if (!hasEnoughTimePassed(this.lastReconnectTime, this.minReconnectInterval, now)) {
			return this.minReconnectInterval - timeSinceLastReconnect
		}

		// 基于重连次数计算指数退避延迟
		return calculateExponentialBackoff(this.globalReconnectCount, 1000, 2, 30000)
	}

	/**
	 * 执行全局重连逻辑
	 */
	private async attemptGlobalReconnect(): Promise<void> {
		if (this.disposed) {
			return
		}

		this.globalReconnectCount++
		this.lastReconnectTime = Date.now()

		this.emit("log", `开始第 ${this.globalReconnectCount} 次重连...`, "info")

		try {
			await this.connectWithRetry()
			this.emit("log", "重连成功", "success")
		} catch (error) {
			this.emit("log", `第 ${this.globalReconnectCount} 次重连失败`, "error")

			// 如果还没达到最大重连次数，不要抛出错误，让外层处理
			if (this.globalReconnectCount < this.maxGlobalReconnects) {
				this.emit(
					"log",
					`将在下次断开时继续重连 (${this.globalReconnectCount}/${this.maxGlobalReconnects})`,
					"info",
				)
			} else {
				this.emit("log", "已达到最大重连次数，停止重连", "warning")
				this.emit("resetRequired")
				throw error
			}
		}
	}

	/**
	 * 启动连接稳定性检查
	 */
	private startConnectionStabilityCheck(): void {
		// 清除之前的定时器
		if (this.connectionStableTimer) {
			clearTimeout(this.connectionStableTimer)
		}

		// 启动新的定时器
		this.connectionStableTimer = setTimeout(() => {
			// 如果连接仍然稳定，重置重连计数器
			if (this.connectionState === "connected") {
				this.globalReconnectCount = 0
				this.emit("log", "连接稳定，重置重连计数器", "success")
			}
			this.connectionStableTimer = null
		}, this.connectionStableDelay)

		this.emit("log", `将在 ${this.connectionStableDelay}ms 后检查连接稳定性`, "info")
	}
}
