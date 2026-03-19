import { useCallback, useEffect, useRef, useState } from "react"
import type { VoiceInputConfig, VoiceInputStatus, VoiceResult } from "../types"
import { useMicrophonePermission } from "@/hooks/useMicrophonePermission"
import { getVoiceToTextServiceInstance } from "../services/VoiceToTextServiceSingleton"
import type { AudioChunkParams, VoiceResultParams } from "@/services/voiceToText"

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

	// ✅ 使用 ref 存储最新的状态值，避免闭包问题
	const isRecordingRef = useRef(isRecording)
	const isConnectedRef = useRef(isConnected)

	// 同步 ref
	useEffect(() => {
		isRecordingRef.current = isRecording
		isConnectedRef.current = isConnected
	}, [isRecording, isConnected])

	const updateStatus = useCallback(
		(newStatus: VoiceInputStatus) => {
			setStatus(newStatus)
			onStatusChange?.(newStatus)
		},
		[onStatusChange],
	)

	const handleError = useCallback(
		(error: Error) => {
			updateStatus("error")
			onError?.(error)
		},
		[onError, updateStatus],
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

		const service = serviceRef.current

		service.initialize({
			config: userConfig,
			onResult: (params: VoiceResultParams) => {
				onResult?.(params.result.text, params.result)
			},
			onAudioChunk,
			onError: handleError,
			onStatusChange: (newStatus: any) => {
				updateStatus(newStatus)
				const serviceIsConnected = service.getIsConnected()
				const serviceIsRecording = service.getIsRecording()

				setIsConnected(serviceIsConnected)
				setIsRecording(serviceIsRecording)
			},
			onConnect: () => {
				setIsConnected(true)
			},
			retry,
			persistence,
		})

		isInitializedRef.current = true
	}, [userConfig, onResult, onAudioChunk, handleError, updateStatus, retry, persistence])

	const connect = useCallback(async () => {
		// ✅ 使用 ref 读取最新值
		if (isConnectedRef.current) return

		try {
			await serviceRef.current.connect()
			setIsConnected(true)
		} catch (error) {
			handleError(error as Error)
			throw error
		}
	}, [handleError])

	const disconnect = useCallback(() => {
		serviceRef.current.disconnect()
		setIsConnected(false)
		setIsRecording(false)
		updateStatus("idle")
	}, [updateStatus])

	const startRecording = useCallback(async () => {
		// ✅ 使用 ref 读取最新值
		if (isRecordingRef.current) return

		try {
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
	}, [handleError, handlePermissionError])

	// ✅ 使用 useCallback 而不是 useMemoizedFn，正确声明依赖
	const stopRecording = useCallback(async () => {
		// ✅ 使用 ref 读取最新值
		if (!isRecordingRef.current) return

		await serviceRef.current.stopRecording()
		setIsRecording(false)
	}, [])

	// ✅ 使用 useCallback 而不是 useMemoizedFn
	const toggleRecording = useCallback(async () => {
		// ✅ 使用 ref 读取最新值
		const currentIsRecording = isRecordingRef.current
		const currentIsConnected = isConnectedRef.current

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
	}, [connect, startRecording, stopRecording, handleError])

	// Cleanup on unmount
	useEffect(() => {
		const service = serviceRef.current
		return () => {
			service.disconnect()
		}
	}, [])

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
