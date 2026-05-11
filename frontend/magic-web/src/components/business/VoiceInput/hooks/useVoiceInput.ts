import { useCallback, useEffect, useRef, useState } from "react"
import type { VoiceInputConfig, VoiceInputStatus, VoiceResult } from "../types"
import { useMicrophonePermission } from "@/hooks/useMicrophonePermission"
import { getVoiceToTextServiceInstance } from "../services/VoiceToTextServiceSingleton"
import type { AudioChunkParams, VoiceResultParams } from "@/services/voiceToText"

let voiceInputSubscriberSequence = 0

function createVoiceInputSubscriberId(): string {
	voiceInputSubscriberSequence += 1
	return `voice-input-subscriber-${voiceInputSubscriberSequence}`
}

export interface UseVoiceInputOptions {
	config?: Partial<VoiceInputConfig>
	onResult?: (text: string, response: VoiceResult) => void
	onError?: (error: Error) => void
	onStatusChange?: (status: VoiceInputStatus) => void
	disableBuiltinPermissionHandling?: boolean

	// Audio chunk callback (optional)
	onAudioChunk?: (params: AudioChunkParams) => void

	// Retry configuration
	retry?: {
		maxRetries?: number
		retryDelay?: number
		exponentialBackoff?: boolean
	}

	// Persistence configuration
	persistence?: {
		enabled?: boolean
		sessionTTL?: number
		maxSessions?: number
	}
}

export const useVoiceInput = (options: UseVoiceInputOptions = {}) => {
	const {
		config: userConfig,
		onResult,
		onError,
		onStatusChange,
		onAudioChunk,
		retry,
		persistence,
	} = options

	const [status, setStatus] = useState<VoiceInputStatus>("idle")
	const [isConnected, setIsConnected] = useState(false)
	const [isRecording, setIsRecording] = useState(false)

	const serviceRef = useRef(getVoiceToTextServiceInstance())
	const isInitializedRef = useRef(false)
	const subscriberIdRef = useRef(createVoiceInputSubscriberId())

	// ✅ 使用 ref 存储最新的状态值，避免闭包问题
	const statusRef = useRef(status)
	const isRecordingRef = useRef(isRecording)
	const isConnectedRef = useRef(isConnected)
	const onResultRef = useRef(onResult)
	const onErrorRef = useRef(onError)
	const onStatusChangeRef = useRef(onStatusChange)
	const onAudioChunkRef = useRef(onAudioChunk)

	// 同步 ref
	useEffect(() => {
		statusRef.current = status
		isRecordingRef.current = isRecording
		isConnectedRef.current = isConnected
	}, [status, isRecording, isConnected])

	useEffect(() => {
		onResultRef.current = onResult
		onErrorRef.current = onError
		onStatusChangeRef.current = onStatusChange
		onAudioChunkRef.current = onAudioChunk
	}, [onResult, onError, onStatusChange, onAudioChunk])

	const updateStatus = useCallback((newStatus: VoiceInputStatus) => {
		statusRef.current = newStatus
		setStatus(newStatus)
		onStatusChangeRef.current?.(newStatus)
	}, [])

	const syncStateFromService = useCallback(() => {
		const service = serviceRef.current
		const nextStatus = service.getStatus()
		const nextIsConnected = service.getIsConnected()
		const nextIsRecording = service.getIsRecording()

		statusRef.current = nextStatus
		isConnectedRef.current = nextIsConnected
		isRecordingRef.current = nextIsRecording
		setStatus(nextStatus)
		setIsConnected(nextIsConnected)
		setIsRecording(nextIsRecording)
	}, [])

	const markAsActiveOwner = useCallback(() => {
		serviceRef.current.setActiveSubscriber(subscriberIdRef.current)
	}, [])

	const handleError = useCallback(
		(error: Error) => {
			updateStatus("error")
			onErrorRef.current?.(error)
		},
		[updateStatus],
	)

	// Integrate permission management
	const resetToIdleState = useCallback(() => {
		setIsRecording(false)
		setIsConnected(false)
		updateStatus("idle")
	}, [updateStatus])

	const { handlePermissionError } = useMicrophonePermission({
		onStateReset: resetToIdleState,
	})

	// Initialize service with options
	useEffect(() => {
		if (isInitializedRef.current) return

		serviceRef.current.initialize({
			config: userConfig,
			retry,
			persistence,
		})

		isInitializedRef.current = true
	}, [userConfig, retry, persistence])

	useEffect(() => {
		const service = serviceRef.current
		const subscriberId = subscriberIdRef.current

		service.registerSubscriber(subscriberId, {
			onResult: (params: VoiceResultParams) => {
				onResultRef.current?.(params.result.text, params.result)
			},
			onAudioChunk: (params: AudioChunkParams) => {
				onAudioChunkRef.current?.(params)
			},
			onError: handleError,
			onStatusChange: (newStatus: VoiceInputStatus) => {
				updateStatus(newStatus)
				syncStateFromService()
			},
			onConnect: () => {
				setIsConnected(true)
			},
		})

		syncStateFromService()

		return () => {
			service.unregisterSubscriber(subscriberId)
			if (service.getSubscriberCount() === 0 && service.getStatus() === "idle") {
				service.disconnect()
			}
		}
	}, [handleError, updateStatus, syncStateFromService])

	const connect = useCallback(async () => {
		// ✅ 使用 ref 读取最新值
		if (isConnectedRef.current) return

		try {
			markAsActiveOwner()
			await serviceRef.current.connect()
			setIsConnected(true)
		} catch (error) {
			handleError(error as Error)
			throw error
		}
	}, [handleError, markAsActiveOwner])

	const disconnect = useCallback(() => {
		markAsActiveOwner()
		serviceRef.current.disconnect()
		setIsConnected(false)
		setIsRecording(false)
		updateStatus("idle")
	}, [updateStatus, markAsActiveOwner])

	const startRecording = useCallback(async () => {
		// ✅ 使用 ref 读取最新值
		if (isRecordingRef.current) return

		try {
			markAsActiveOwner()
			await serviceRef.current.startRecording()
			setIsRecording(true)
		} catch (error) {
			try {
				handlePermissionError(error as Error)
			} catch (nonPermissionError) {
				setIsRecording(false)
				handleError(error as Error)
			}
		}
	}, [handleError, handlePermissionError, markAsActiveOwner])

	// ✅ 使用 useCallback 而不是 useMemoizedFn，正确声明依赖
	const stopRecording = useCallback(async () => {
		// ✅ 使用 ref 读取最新值
		if (!isRecordingRef.current) return

		markAsActiveOwner()
		await serviceRef.current.stopRecording()
		setIsRecording(false)
	}, [markAsActiveOwner])

	// ✅ 使用 useCallback 而不是 useMemoizedFn
	const toggleRecording = useCallback(async () => {
		// ✅ 使用 ref 读取最新值
		const currentIsRecording = isRecordingRef.current
		const currentIsConnected = isConnectedRef.current
		markAsActiveOwner()

		if (currentIsRecording) {
			await stopRecording()
		} else {
			try {
				if (!currentIsConnected) {
					await connect()
				}
				await startRecording()
			} catch (error) {
				handleError(error as Error)
			}
		}
	}, [connect, startRecording, stopRecording, handleError, markAsActiveOwner])

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
