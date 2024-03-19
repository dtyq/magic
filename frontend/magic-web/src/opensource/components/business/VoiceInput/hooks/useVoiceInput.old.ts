import { useCallback, useRef, useState } from "react"
import { AudioProcessor, DEFAULT_BUFFER_DURATION } from "../services/AudioProcessor"
import { VoiceClient } from "../services/VoiceClient"
import type { VoiceInputConfig, VoiceInputStatus, VoiceResult } from "../types"
import { ChatApi } from "@/opensource/apis"
import { useMicrophonePermission } from "@/opensource/hooks/useMicrophonePermission"
import { useMemoizedFn } from "ahooks"
import { logger as Logger } from "@/opensource/utils/log"
import { userStore } from "@/opensource/models/user"
import { env } from "@/opensource/utils/env"

const DEFAULT_CONFIG: VoiceInputConfig = {
	wsUrl: "wss://openspeech.bytedance.com/api/v3/sauc/bigmodel_async",
	resourceId: "volc.bigasr.sauc.duration",
	authToken: "",
	organizationCode: "",
	apiAppId: "",
	audio: {
		sampleRate: 16000,
		channelCount: 1,
		bitsPerSample: 16,
	},
	request: {
		resultType: "full",
	},
	user: {
		uid: userStore.user.userInfo?.user_id || "",
		app_version: env("MAGIC_APP_VERSION"),
		platform: window.navigator.userAgent,
	},
}

export interface UseVoiceInputOptions {
	config?: Partial<VoiceInputConfig>
	onResult?: (text: string, response: VoiceResult) => void
	onError?: (error: Error) => void
	onStatusChange?: (status: VoiceInputStatus) => void
	disableBuiltinPermissionHandling?: boolean
}

const logger = Logger.createLogger("VoiceInput")

/**
 * @deprecated Use useVoiceInputNew instead.
 * @param options - The options for the useVoiceInput hook.
 * @returns The status, isConnected, isRecording, connect, disconnect, startRecording, stopRecording, and toggleRecording functions.
 */
export const useVoiceInput = (options: UseVoiceInputOptions = {}) => {
	const { config: userConfig, onResult, onError, onStatusChange } = options

	const [status, setStatus] = useState<VoiceInputStatus>("idle")
	const [isConnected, setIsConnected] = useState(false)
	const [isRecording, setIsRecording] = useState(false)

	const audioProcessorRef = useRef<AudioProcessor>()
	const voiceClientRef = useRef<VoiceClient | null>(null)
	const configRef = useRef<VoiceInputConfig>()
	const isConnectedRef = useRef<boolean>(false)
	const isRecordingRef = useRef<boolean>(false)
	const audioBufferRef = useRef<ArrayBuffer[]>([])
	const isInitializingRef = useRef<boolean>(false)
	const wasRecordingBeforeDisconnectRef = useRef<boolean>(false)
	const expireTimeRef = useRef<number>(0)
	const isRecoveringRef = useRef<boolean>(false)
	const isSendingBufferedDataRef = useRef<boolean>(false)
	const unsubscribeAudioProcessorRef = useRef<(() => void) | null>(null)

	// 同步状态到ref
	isRecordingRef.current = isRecording

	const updateStatus = useCallback(
		(newStatus: VoiceInputStatus) => {
			const previousStatus = status
			logger.log(`[VoiceInput] Status change: ${previousStatus} -> ${newStatus}`)
			setStatus(newStatus)
			onStatusChange?.(newStatus)
		},
		[onStatusChange, status],
	)

	const handleError = useCallback(
		(error: Error) => {
			logger.error("VoiceInput error", error)
			updateStatus("error")
			onError?.(error)
		},
		[onError, updateStatus],
	)

	// 集成权限管理
	const resetToIdleState = useCallback(() => {
		logger.log("[VoiceInput] Resetting to idle state")

		// 停止录音
		setIsRecording(false)
		audioProcessorRef.current?.stop()

		// 清理状态
		setIsConnected(false)
		isConnectedRef.current = false
		isInitializingRef.current = false
		wasRecordingBeforeDisconnectRef.current = false

		// 清空音频缓冲
		audioBufferRef.current = []

		// 清除发送状态
		isSendingBufferedDataRef.current = false

		// 断开连接
		voiceClientRef.current?.disconnect()

		// 更新状态为空闲
		updateStatus("idle")
	}, [updateStatus])

	const { handlePermissionError } = useMicrophonePermission({
		onStateReset: resetToIdleState,
	})

	// 逐个发送缓冲的音频数据
	const sendBufferedAudioInBatches = useCallback(async (client: VoiceClient) => {
		if (isSendingBufferedDataRef.current) {
			logger.log(`[VoiceInput] 缓冲数据正在发送中，跳过本次发送请求`)
			return
		}

		const bufferedAudio = [...audioBufferRef.current] // 复制数组避免并发修改
		audioBufferRef.current = [] // 立即清空缓冲区
		isSendingBufferedDataRef.current = true // 设置发送状态

		const PACKET_INTERVAL = DEFAULT_BUFFER_DURATION // 每个包的发送间隔(ms)

		logger.log(
			`[VoiceInput] 准备逐个发送音频数据，总计 ${bufferedAudio.length} 块，每包间隔 ${PACKET_INTERVAL}ms`,
		)

		for (let i = 0; i < bufferedAudio.length; i++) {
			// 检查连接状态
			if (!isConnectedRef.current) {
				logger.log(
					`[VoiceInput] 连接已断开，停止发送剩余音频数据 (剩余 ${
						bufferedAudio.length - i
					} 块)`,
				)
				// 将剩余数据重新放回缓冲区（保持时间顺序：先放未发送的原有数据，再放新产生的数据）
				audioBufferRef.current = [...bufferedAudio.slice(i), ...audioBufferRef.current]
				// 清除发送状态
				isSendingBufferedDataRef.current = false
				break
			}

			try {
				// 发送当前音频数据包
				client.sendAudio(bufferedAudio[i])

				logger.log(`[VoiceInput] 已发送第 ${i + 1}/${bufferedAudio.length} 个音频数据包`)

				// 最后一个包不需要等待
				if (i < bufferedAudio.length - 1) {
					await new Promise((resolve) => setTimeout(resolve, PACKET_INTERVAL))
				}
			} catch (error) {
				logger.error(`[VoiceInput] 发送第 ${i + 1} 个音频数据包失败:`, error)
				// 发送失败时，将剩余数据重新放回缓冲区（保持时间顺序：先放未发送的原有数据，再放新产生的数据）
				audioBufferRef.current = [...bufferedAudio.slice(i), ...audioBufferRef.current]
				// 清除发送状态
				isSendingBufferedDataRef.current = false
				break
			}
		}

		// 发送完成，清除发送状态
		isSendingBufferedDataRef.current = false
		logger.log(`[VoiceInput] 缓冲音频数据发送完成`)
	}, [])

	// 绑定VoiceClient事件监听器
	function bindVoiceClientEvents(client: VoiceClient) {
		logger.log("[VoiceInput] Binding VoiceClient events")

		client.on("log", (message, type) => {
			logger.log(`[VoiceClient ${type}]:`, message)
		})

		client.on("error", async (message, code) => {
			logger.error(
				`[VoiceInput] VoiceClient error: ${message} (code=${code}), connectionId=${client.connectionId}`,
			)
			const msg = String(message || "")
			const codeNumber = code != null ? Number(code) : ""
			if (!isRecoveringRef.current) {
				try {
					isRecoveringRef.current = true
					logger.log(
						`[VoiceInput] Detected session timeout (code=${codeNumber}). Restarting session...`,
					)

					logger.report(
						`⏱️ [VoiceInput] 会话超时，尝试重连。缓冲区大小: ${audioBufferRef.current.length}`,
					)

					// Preserve recording state and keep capturing audio
					const wasRecording = isRecordingRef.current
					if (wasRecording) wasRecordingBeforeDisconnectRef.current = true

					// Drop connection immediately to avoid sending to ended session
					voiceClientRef.current?.dispose()
					voiceClientRef.current = null
					setIsConnected(false)
					isConnectedRef.current = false
					updateStatus("connecting")

					// Recreate client with refreshed token and reconnect
					await initializeClients({ refresh: true })
					await connect()

					logger.log(`✅ [VoiceInput] 重连成功，恢复录音状态: ${wasRecording}`)

					// If we were recording, status will restore to recording on 'connected'
					return
				} catch (e) {
					// Fall back to error handling
					logger.error(`❌ [VoiceInput] 重连失败:`, e)
					handleError(e as Error)
				} finally {
					isRecoveringRef.current = false
				}
			}

			// Non-recoverable or unknown errors
			handleError(new Error(msg))
		})

		client.on("status", (message, state) => {
			logger.log(`[VoiceClient status]: ${message} (${state})`)

			switch (state) {
				case "connecting":
					setIsConnected(false)
					updateStatus("connecting")
					break
				case "connected":
					setIsConnected(true)
					isConnectedRef.current = true
					// 如果之前在录音，重连后恢复录音状态
					if (wasRecordingBeforeDisconnectRef.current) {
						updateStatus("recording")
						logger.log("[VoiceInput] Restored recording status after reconnection")
					} else {
						updateStatus("idle")
					}
					break
				case "reconnecting":
					setIsConnected(false)
					updateStatus("connecting") // 重连时显示connecting状态
					break
				case "error":
					setIsConnected(false)
					updateStatus("error")
					break
				case "stop":
					setIsConnected(false)
					updateStatus("idle")
					break
				default:
					break
			}
		})

		client.on("open", () => {
			logger.log("[VoiceInput] VoiceClient opened")
			setIsConnected(true)
			isConnectedRef.current = true

			// 分批发送缓冲的音频数据
			if (audioBufferRef.current.length > 0) {
				logger.log(
					`[VoiceInput] 开始分批发送缓冲的音频数据，共 ${audioBufferRef.current.length} 块`,
				)
				sendBufferedAudioInBatches(client)
			}
		})

		client.on("close", (code) => {
			const currentlyRecording = isRecordingRef.current
			logger.log(
				`[VoiceInput] VoiceClient closed: code=${code}, wasRecording=${currentlyRecording}`,
			)
			setIsConnected(false)
			isConnectedRef.current = false

			// 记录断开前的录音状态
			if (currentlyRecording) {
				wasRecordingBeforeDisconnectRef.current = true
			}

			// 如果是异常断开且不是主动断开，会触发重连
			// 重连逻辑在VoiceClient中处理，这里只需要等待
		})

		client.on("result", (result) => {
			logger.log(`[VoiceInput] Received result: ${result.text}`)
			onResult?.(result.text, result)
		})

		client.on("resetRequired", () => {
			logger.log("[VoiceInput] Reset required due to connection failure")
			resetToIdleState()
		})
	}
	// end bindVoiceClientEvents

	const refreshToken = useCallback(async () => {
		const data = await ChatApi.getVoiceInputToken({ refresh: true })
		if (data?.token) {
			const config = { ...DEFAULT_CONFIG, ...userConfig }
			configRef.current = config
			config.authToken = data.token
			config.apiAppId = data.app_id
			config.organizationCode = data.user?.organization_code
			expireTimeRef.current = data.expires_at * 1000
			return configRef.current
		}
		return { ...DEFAULT_CONFIG, ...userConfig }
	}, [userConfig])

	const initializeClients = useMemoizedFn(async (options: { refresh?: boolean } = {}) => {
		const config = { ...DEFAULT_CONFIG, ...userConfig }
		configRef.current = config

		// 获取JWT token
		try {
			const data = await ChatApi.getVoiceInputToken({ ...options })
			if (data?.token) {
				config.authToken = data.token
				config.apiAppId = data.app_id
				config.organizationCode = data.user?.organization_code
				expireTimeRef.current = data.expires_at * 1000
			} else {
				throw new Error("获取语音Token失败")
			}
		} catch (error) {
			throw new Error(`获取语音Token失败: ${(error as Error).message}`)
		}

		// 初始化音频处理器
		if (!audioProcessorRef.current) {
			audioProcessorRef.current = new AudioProcessor(config.audio)

			// 设置音频数据回调
			unsubscribeAudioProcessorRef.current = audioProcessorRef.current.on(
				"data",
				(audioData) => {
					logger.log(
						`[VoiceInput] 收到音频数据，当前缓存数量: ${audioBufferRef.current.length}`,
					)
					if (isConnectedRef.current && !isSendingBufferedDataRef.current) {
						// 连接已建立且没有在发送缓冲数据，直接发送
						voiceClientRef.current?.sendAudio(audioData)
					} else {
						// 连接未建立或正在发送缓冲数据，缓存数据
						audioBufferRef.current.push(audioData)
						const reason = !isConnectedRef.current ? "连接未建立" : "正在发送缓冲数据"
						logger.log(
							`[VoiceInput] 缓存音频数据 (${reason})，当前缓存数量: ${audioBufferRef.current.length}`,
						)

						// 缓冲区过大时的保护措施
						if (audioBufferRef.current.length > 100) {
							logger.report(
								`🚨 [VoiceInput] 音频缓冲区过大，丢弃最旧的数据包。当前缓存: ${audioBufferRef.current.length}`,
							)
							// 保留最新的50个数据包，丢弃更旧的
							audioBufferRef.current = audioBufferRef.current.slice(-50)
						}
					}
				},
			)
		}

		// 初始化语音客户端
		if (!voiceClientRef.current) {
			voiceClientRef.current = new VoiceClient(config, refreshToken)
			bindVoiceClientEvents(voiceClientRef.current)
		} else {
			// 重新绑定事件（重连时需要重新绑定）
			bindVoiceClientEvents(voiceClientRef.current)
		}
	})

	const connect = useCallback(async () => {
		if (isConnected || isInitializingRef.current) return

		try {
			isInitializingRef.current = true

			const isExpired = expireTimeRef.current - Date.now() < 1000 * 60 * 5

			if (!voiceClientRef.current || isExpired) {
				await initializeClients({ refresh: isExpired })
			}

			await voiceClientRef.current?.connect()
		} catch (error) {
			handleError(error as Error)
			throw error
		} finally {
			isInitializingRef.current = false
		}
	}, [isConnected, initializeClients, handleError])

	const disconnect = useCallback(() => {
		voiceClientRef.current?.disconnect()
		audioProcessorRef.current?.stop()

		// 清理音频处理器事件监听器
		if (unsubscribeAudioProcessorRef.current) {
			unsubscribeAudioProcessorRef.current()
			unsubscribeAudioProcessorRef.current = null
		}

		setIsConnected(false)
		isConnectedRef.current = false
		isInitializingRef.current = false
		setIsRecording(false)
		wasRecordingBeforeDisconnectRef.current = false
		audioBufferRef.current = [] // 清空缓冲
		isSendingBufferedDataRef.current = false // 清除发送状态
		updateStatus("idle")
	}, [updateStatus])

	const startRecording = useCallback(async () => {
		if (isRecording) return

		try {
			logger.log("[VoiceInput] Starting recording")
			updateStatus("recording")
			await audioProcessorRef.current?.start()
			setIsRecording(true)
			wasRecordingBeforeDisconnectRef.current = false // 清空之前的状态
		} catch (error) {
			// 权限错误处理集成在这里
			try {
				handlePermissionError(error as Error)
			} catch (nonPermissionError) {
				// 非权限错误，常规处理
				setIsRecording(false)
				handleError(error as Error)
			}
		}
	}, [isRecording, handleError, updateStatus, handlePermissionError])

	const stopRecording = useCallback(async () => {
		if (!isRecording) return

		logger.log("[VoiceInput] Stopping recording")
		updateStatus("processing")
		audioProcessorRef.current?.stop()

		// 发送缓冲的音频数据
		if (voiceClientRef.current && audioBufferRef.current.length > 0) {
			await sendBufferedAudioInBatches(voiceClientRef.current)
		}

		voiceClientRef.current?.sendEndSignal()
		setIsRecording(false)
		wasRecordingBeforeDisconnectRef.current = false

		// 处理完成后回到空闲状态
		setTimeout(() => {
			if (isConnected) {
				updateStatus("idle")
			}
		}, 1000)
	}, [isRecording, updateStatus, sendBufferedAudioInBatches, isConnected])

	const toggleRecording = useCallback(async () => {
		if (isRecording) {
			stopRecording()
		} else {
			try {
				if (!isConnected) {
					await connect()
					logger.log("[VoiceInput] Connected, waiting for ready state")

					// 等待连接状态更新后再开始录音
					const waitForConnection = () => {
						return new Promise<void>((resolve, reject) => {
							const startTime = Date.now()
							const checkConnection = () => {
								if (isConnectedRef.current) {
									resolve()
								} else if (Date.now() - startTime > 10000) {
									reject(new Error("等待连接超时"))
								} else {
									setTimeout(checkConnection, 100)
								}
							}
							checkConnection()
						})
					}
					await waitForConnection()
					logger.log("[VoiceInput] Connection ready, starting recording")
				}
				await startRecording()
			} catch (error) {
				handleError(error as Error)
			}
		}
	}, [isRecording, isConnected, connect, startRecording, stopRecording, handleError])

	return {
		status,
		isConnected,
		isRecording,
		connect,
		disconnect,
		startRecording,
		stopRecording,
		toggleRecording,
	}
}
