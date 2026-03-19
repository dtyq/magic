import { useCallback, useEffect, useRef, useState } from "react"
import { useVoiceInput } from "@/components/business/VoiceInput/hooks/useVoiceInput"
import { useMicrophonePermission } from "@/hooks/useMicrophonePermission"
import { MicrophonePermissionService } from "@/services/MicrophonePermissionService"
import {
	ensureMediaRecorderSupport,
	getBestSupportedMimeType,
} from "@/services/recordSummary/utils/mediaRecorderPolyfill"
import type {
	VoiceInputStatus,
	RecordingState,
	AudioWaveformData,
	VoiceInputConfig,
} from "../types"

interface UseVoiceRecordingOptions {
	config?: VoiceInputConfig
	onVoiceResult?: (audioData?: Blob, duration?: number, actualMimeType?: string) => void
	onTextResult?: (text: string) => void
	onError?: (error: Error) => void
	onStatusChange?: (status: VoiceInputStatus) => void
}

export const useVoiceRecording = ({
	config,
	onVoiceResult,
	onTextResult,
	onError,
	onStatusChange,
}: UseVoiceRecordingOptions = {}) => {
	// 获取设备特定的音频配置
	const getDeviceAudioConfig = useCallback(() => {
		const userAgent = navigator.userAgent.toLowerCase()
		const isAndroid = userAgent.includes("android")
		const isIOS = userAgent.includes("iphone") || userAgent.includes("ipad")

		// 为不同设备返回优化的配置
		if (isAndroid) {
			return {
				preferredMimeTypes: [
					"audio/mp4;codecs=aac", // 安卓首选
					"audio/3gpp", // 安卓通用
					"audio/mp4",
					"audio/webm;codecs=opus",
					"audio/webm",
				],
				sampleRate: 16000, // 安卓设备通常支持16kHz
				channelCount: 1,
			}
		} else if (isIOS) {
			return {
				preferredMimeTypes: [
					"audio/mp4;codecs=aac", // iOS首选
					"audio/mp4",
					"audio/webm;codecs=opus",
					"audio/webm",
				],
				sampleRate: 44100, // iOS设备通常支持更高采样率
				channelCount: 1,
			}
		} else {
			// 桌面浏览器
			return {
				preferredMimeTypes: [
					"audio/webm;codecs=opus", // 桌面首选
					"audio/webm",
					"audio/mp4;codecs=aac",
					"audio/mp4",
					"audio/ogg;codecs=opus",
					"audio/wav",
				],
				sampleRate: config?.sampleRate || 16000,
				channelCount: config?.channelCount || 1,
			}
		}
	}, [config?.sampleRate, config?.channelCount])

	const [recordingState, setRecordingState] = useState<RecordingState>({
		isRecording: false,
		duration: 0,
		audioLevel: 0,
		transcription: "",
		gesture: { type: "none", progress: 0, isActive: false },
		isEditingText: false,
		audioBlob: undefined,
	})

	const [waveformData, setWaveformData] = useState<AudioWaveformData>({
		levels: [],
		currentTime: 0,
		maxTime: 0,
	})

	const audioLevelTimerRef = useRef<NodeJS.Timeout>()
	const audioChunksRef = useRef<Blob[]>([])
	const mediaRecorderRef = useRef<MediaRecorder>()
	const mediaStreamRef = useRef<MediaStream | null>(null)
	const audioContextRef = useRef<AudioContext | null>(null)
	const analyserRef = useRef<AnalyserNode | null>(null)
	const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
	// 使用 ref 存储最新状态，避免闭包问题
	const recordingStateRef = useRef(recordingState)
	// 记录录音开始时间
	const recordingStartTimeRef = useRef<number>(0)
	// 存储实际使用的MIME类型，确保在创建Blob时使用正确的格式
	const actualMimeTypeRef = useRef<string>("audio/webm;codecs=opus")

	// 同步状态到 ref
	recordingStateRef.current = recordingState

	// 清理所有音频资源的函数
	const cleanupAudioResources = useCallback(() => {
		console.log("Cleaning up audio resources - clearing timers and AudioContext")

		// 停止并清理定时器
		if (audioLevelTimerRef.current) {
			clearInterval(audioLevelTimerRef.current)
			audioLevelTimerRef.current = undefined
		}

		// 清理 AudioContext 相关资源
		if (sourceRef.current) {
			try {
				sourceRef.current.disconnect()
			} catch (error) {
				console.warn("Error disconnecting audio source:", error)
			}
			sourceRef.current = null
		}

		if (analyserRef.current) {
			analyserRef.current = null
		}

		if (audioContextRef.current) {
			try {
				if (audioContextRef.current.state !== "closed") {
					audioContextRef.current.close()
				}
			} catch (error) {
				console.warn("Error closing AudioContext:", error)
			}
			audioContextRef.current = null
		}
	}, [])

	// 提取公共的重置逻辑
	const resetToInitialState = useCallback(
		(reason?: string) => {
			if (reason) {
				console.log(`Resetting recording state: ${reason}`)
			}

			// 清理所有资源
			cleanupAudioResources()

			// 重置开始时间
			recordingStartTimeRef.current = 0

			// 重置MIME类型
			actualMimeTypeRef.current = "audio/webm;codecs=opus"

			// 直接传入状态对象，避免依赖常量
			setRecordingState({
				isRecording: false,
				duration: 0,
				audioLevel: 0,
				transcription: "",
				gesture: { type: "none", progress: 0, isActive: false },
				isEditingText: false,
				audioBlob: undefined,
			})
			setWaveformData({
				levels: [],
				currentTime: 0,
				maxTime: 0,
			})
			onStatusChange?.("idle")
		},
		[onStatusChange, cleanupAudioResources],
	)

	// 权限处理 - 用于 chatMobile 特有的权限错误处理
	const resetRecordingState = useCallback(() => {
		resetToInitialState("Permission denied")
	}, [resetToInitialState])

	const { handlePermissionError } = useMicrophonePermission({
		onStateReset: resetRecordingState,
	})

	// 使用内置权限管理的 VoiceInput hook 进行语音识别
	const {
		status,
		isRecording: isVoiceRecording,
		startRecording: startVoiceRecording,
		stopRecording: stopVoiceRecording,
		connect,
		disconnect,
	} = useVoiceInput({
		onResult: (text) => {
			setRecordingState((prev) => ({
				...prev,
				transcription: text,
			}))
		},
		onError: (error) => {
			// 语音识别的错误传递给外部，录音状态在外层处理
			onError?.(error)
		},
		onStatusChange,
	})

	// 音量检测
	const startAudioLevelDetection = useCallback(
		(stream: MediaStream) => {
			try {
				// 先清理之前的AudioContext资源
				cleanupAudioResources()

				const audioContext = new AudioContext()
				const analyser = audioContext.createAnalyser()
				const source = audioContext.createMediaStreamSource(stream)

				// 存储到refs中以便后续清理
				audioContextRef.current = audioContext
				analyserRef.current = analyser
				sourceRef.current = source

				source.connect(analyser)

				// 提高音频分析的分辨率
				analyser.fftSize = 2048 // 增加FFT大小，提高频率分辨率
				analyser.smoothingTimeConstant = 0.3 // 降低平滑常数，让波形更敏感
				analyser.minDecibels = -90 // 设置更低的最小分贝值
				analyser.maxDecibels = -10 // 设置更高的最大分贝值

				const bufferLength = analyser.frequencyBinCount
				const dataArray = new Uint8Array(bufferLength)

				const updateAudioLevel = () => {
					// 检查analyser是否还存在
					if (!analyserRef.current) {
						return
					}

					analyserRef.current.getByteFrequencyData(dataArray)

					// 改进音频级别计算，使用RMS（均方根）而不是简单平均值
					let sumSquares = 0
					for (let i = 0; i < bufferLength; i++) {
						const normalized = dataArray[i] / 255
						sumSquares += normalized * normalized
					}
					const rms = Math.sqrt(sumSquares / bufferLength)

					// 应用对数缩放，让低音量更敏感，高音量不会过度饱和
					const level = Math.min(Math.round(Math.pow(rms, 0.5) * 100), 100)

					setRecordingState((prev) => ({
						...prev,
						audioLevel: level,
					}))

					// 更新波形数据，保留更多数据点以提高视觉分辨率
					// 使用ref获取最新的duration值
					const currentDuration = recordingStateRef.current.duration
					setWaveformData((prev) => ({
						...prev,
						levels: [...prev.levels.slice(-127), level], // 保留最近128个数据点，提高分辨率
						currentTime: currentDuration,
					}))
				}

				audioLevelTimerRef.current = setInterval(updateAudioLevel, 100)
			} catch (error) {
				console.error("Failed to start audio level detection:", error)
				// 清理资源
				cleanupAudioResources()
			}
		},
		[cleanupAudioResources],
	)

	// 停止麦克风流
	const stopMediaStream = useCallback(() => {
		if (mediaStreamRef.current) {
			console.log("Stopping MediaStream tracks")
			mediaStreamRef.current.getTracks().forEach((track) => {
				track.stop()
				console.log(`Stopped ${track.kind} track:`, track.label)
			})
			mediaStreamRef.current = null
		}
	}, [])

	// 开始录音
	const startRecording = useCallback(async () => {
		try {
			console.log("startRecording called")

			// Ensure MediaRecorder support is available before starting
			await ensureMediaRecorderSupport()

			// 获取设备特定的音频配置
			const deviceConfig = getDeviceAudioConfig()

			// 使用统一的权限管理服务请求麦克风访问
			const { stream } = await MicrophonePermissionService.requestMicrophoneAccess({
				sampleRate: deviceConfig.sampleRate,
				channelCount: deviceConfig.channelCount,
				echoCancellation: true,
				noiseSuppression: true,
				autoGainControl: true,
			})

			// 保存 MediaStream 引用以便后续关闭
			mediaStreamRef.current = stream

			// 显示UI和开始录音
			recordingStartTimeRef.current = performance.now()
			setRecordingState((prev) => ({
				...prev,
				isRecording: true,
				duration: 0,
				transcription: "",
			}))

			// 使用设备特定的MIME类型列表进行检测，使用优化的检测方法
			const mimeType = getBestSupportedMimeType(deviceConfig.preferredMimeTypes)

			console.log("Selected MIME type for device:", mimeType || "browser default")

			// 输出调试信息，帮助识别设备兼容性问题
			if (process.env.NODE_ENV === "development") {
				console.log("Audio recording debug info:", {
					userAgent: navigator.userAgent,
					selectedMimeType: mimeType || "browser default",
					deviceConfig: deviceConfig,
					supportedTypes: deviceConfig.preferredMimeTypes.map((type) => ({
						type,
						supported: MediaRecorder.isTypeSupported(type),
					})),
				})
			}

			// 保存实际使用的MIME类型
			actualMimeTypeRef.current = mimeType || "audio/wav" // 默认使用wav作为后备

			// 创建 MediaRecorder 用于录制音频文件
			const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)

			mediaRecorderRef.current = mediaRecorder
			audioChunksRef.current = []

			mediaRecorder.ondataavailable = (event) => {
				if (event.data.size > 0) {
					audioChunksRef.current.push(event.data)
				}
			}

			mediaRecorder.start(100) // 每100ms收集一次数据

			// 启动音量检测
			startAudioLevelDetection(stream)

			// 异步建立语音识别连接，不阻塞UI
			if (!isVoiceRecording) {
				connect()
					.then(() => startVoiceRecording())
					.catch((error) => {
						console.warn("语音识别连接失败，将仅录制音频:", error)
						// 连接失败时不影响录音，但会失去实时转录功能
						// 可以通过onStatusChange通知上层组件语音识别不可用
						// 但不影响录音功能的正常使用
					})
			}
		} catch (error) {
			// 立即停止所有录音相关活动
			console.log("Recording failed, cleaning up resources")

			// 停止计时器
			if (audioLevelTimerRef.current) {
				clearInterval(audioLevelTimerRef.current)
				audioLevelTimerRef.current = undefined
			}

			// 停止媒体流
			stopMediaStream()

			// 停止 MediaRecorder
			if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
				mediaRecorderRef.current.stop()
			}

			// 停止语音识别
			if (isVoiceRecording) {
				stopVoiceRecording()
			}

			// 重置波形数据
			setWaveformData({
				levels: [],
				currentTime: 0,
				maxTime: 0,
			})

			// 处理权限错误，显示权限引导弹窗
			try {
				handlePermissionError(error as Error)
			} catch (nonPermissionError) {
				// 非权限错误，使用公共重置逻辑
				resetToInitialState("Recording failed with non-permission error")
				onError?.(nonPermissionError as Error)
			}
		}
	}, [
		config?.sampleRate,
		config?.channelCount,
		isVoiceRecording,
		startAudioLevelDetection,
		connect,
		startVoiceRecording,
		onError,
		resetToInitialState,
		handlePermissionError,
		stopMediaStream,
		stopVoiceRecording,
		getDeviceAudioConfig,
	])

	// 停止录音
	const stopRecording = useCallback(async (): Promise<{
		audioBlob: Blob
		duration: number
	}> => {
		try {
			// 停止计时器
			if (audioLevelTimerRef.current) {
				clearInterval(audioLevelTimerRef.current)
				audioLevelTimerRef.current = undefined
			}

			// 计算实际录音时长 - 使用多种方式
			const endTime = performance.now()
			const performanceDuration =
				recordingStartTimeRef.current > 0
					? (endTime - recordingStartTimeRef.current) / 1000
					: 0
			const chunkDuration = audioChunksRef.current.length * 0.1 // 每100ms一个chunk
			const stateDuration = recordingStateRef.current.duration

			// 选择最可靠的时长：优先使用performance时间，然后是chunk时间，最后是状态时间
			let currentDuration = performanceDuration
			if (currentDuration <= 0 && chunkDuration > 0) {
				currentDuration = chunkDuration
			}
			if (currentDuration <= 0 && stateDuration > 0) {
				currentDuration = stateDuration
			}
			// 最小时长0.1秒
			if (currentDuration < 0.1) {
				currentDuration = 0.1
			}

			// 停止语音识别
			if (isVoiceRecording) {
				stopVoiceRecording()
			}

			// 停止 MediaRecorder
			if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
				return new Promise<{ audioBlob: Blob; duration: number }>((resolve) => {
					const mediaRecorder = mediaRecorderRef.current
					if (mediaRecorder) {
						mediaRecorder.onstop = () => {
							// 停止麦克风流
							stopMediaStream()

							const audioBlob = new Blob(audioChunksRef.current, {
								type: actualMimeTypeRef.current,
							})
							resolve({ audioBlob, duration: currentDuration })
						}
						mediaRecorder.stop()
					} else {
						// 确保在没有MediaRecorder时也停止麦克风流
						stopMediaStream()
						resolve({
							audioBlob: new Blob([], { type: actualMimeTypeRef.current }),
							duration: currentDuration,
						})
					}
				})
			}

			// 如果MediaRecorder不在录音状态，直接停止麦克风流
			stopMediaStream()

			// 更新录音状态
			setRecordingState((prev) => ({
				...prev,
				isRecording: false,
				audioLevel: 0,
			}))

			// 即使没有音频数据，也返回时长信息
			return {
				audioBlob: new Blob([], { type: actualMimeTypeRef.current }),
				duration: currentDuration,
			}
		} catch (error) {
			// 确保出错时也停止麦克风流
			stopMediaStream()
			onError?.(error as Error)
			// 即使出错，也尝试返回时长信息
			const endTime = performance.now()
			const performanceDuration =
				recordingStartTimeRef.current > 0
					? (endTime - recordingStartTimeRef.current) / 1000
					: 0
			const chunkDuration = audioChunksRef.current.length * 0.1
			const stateDuration = recordingStateRef.current.duration

			let currentDuration = performanceDuration
			if (currentDuration <= 0 && chunkDuration > 0) {
				currentDuration = chunkDuration
			}
			if (currentDuration <= 0 && stateDuration > 0) {
				currentDuration = stateDuration
			}
			if (currentDuration < 0.1) {
				currentDuration = 0.1
			}

			return {
				audioBlob: new Blob([], { type: actualMimeTypeRef.current }),
				duration: currentDuration,
			}
		}
	}, [isVoiceRecording, stopVoiceRecording, stopMediaStream, onError])

	// 取消录音
	const cancelRecording = useCallback(() => {
		// 停止语音识别
		if (isVoiceRecording) {
			stopVoiceRecording()
		}

		// 停止 MediaRecorder
		if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
			mediaRecorderRef.current.stop()
		}

		// 停止麦克风流
		stopMediaStream()

		// 使用公共重置逻辑
		resetToInitialState("Recording cancelled")
	}, [isVoiceRecording, stopVoiceRecording, stopMediaStream, resetToInitialState])

	// 完全重置所有状态 - 用于组件关闭时的彻底清空
	const resetAllStates = useCallback(() => {
		// 停止语音识别
		if (isVoiceRecording) {
			stopVoiceRecording()
		}

		// 断开连接
		disconnect()

		// 停止 MediaRecorder 并清理资源
		if (mediaRecorderRef.current) {
			if (mediaRecorderRef.current.state === "recording") {
				mediaRecorderRef.current.stop()
			}
			mediaRecorderRef.current = undefined
		}

		// 停止麦克风流
		stopMediaStream()

		// 清空音频数据
		audioChunksRef.current = []

		// 使用公共重置逻辑
		resetToInitialState("Component unmounting")
	}, [isVoiceRecording, stopVoiceRecording, disconnect, stopMediaStream, resetToInitialState])

	// 更新手势状态
	const updateGestureState = useCallback((gesture: RecordingState["gesture"]) => {
		setRecordingState((prev) => ({
			...prev,
			gesture,
		}))
	}, [])

	// 进入文本编辑模式
	const enterEditMode = useCallback(() => {
		setRecordingState((prev) => ({
			...prev,
			isRecording: false,
			isEditingText: true,
		}))
	}, [])

	// 退出文本编辑模式
	const exitEditMode = useCallback(() => {
		setRecordingState((prev) => ({
			...prev,
			isEditingText: false,
		}))
	}, [])

	// 停止录音并准备进入编辑模式
	const stopRecordingForEdit = useCallback(async () => {
		// 在停止录音之前先保存当前状态，避免状态被重置
		const currentState = recordingStateRef.current
		const currentDuration = currentState.duration
		const currentTranscription = currentState.transcription

		const { audioBlob, duration } = await stopRecording()

		// 更新状态：停止录音，保存音频数据
		const finalDuration = duration || currentDuration
		setRecordingState((prev) => ({
			...prev,
			isRecording: false,
			audioBlob: audioBlob,
			duration: finalDuration,
		}))

		return { audioBlob, duration: finalDuration, transcription: currentTranscription }
	}, [stopRecording])

	// 处理录音结果
	const handleRecordingResult = useCallback(
		async (type: "voice" | "text") => {
			const currentState = recordingStateRef.current
			let currentDuration = currentState.duration
			const currentTranscription = currentState.transcription

			// 如果已经有保存的音频数据（编辑模式），直接使用
			let audioBlob = currentState.audioBlob
			if (!audioBlob) {
				// 如果没有保存的音频数据，停止录音获取
				const result = await stopRecording()
				audioBlob = result.audioBlob
				currentDuration = result.duration
			} else {
				// 编辑模式下，确保使用保存的时长
				// 由于状态更新的异步性，直接从状态中获取duration
				currentDuration = currentState.duration
			}

			// 确保状态立即更新为不录音
			setRecordingState((prev) => ({
				...prev,
				isRecording: false,
			}))

			if (type === "voice" && audioBlob) {
				onVoiceResult?.(audioBlob, currentDuration, actualMimeTypeRef.current)
			} else if (type === "text" && currentTranscription) {
				onTextResult?.(currentTranscription)
			}
		},
		[stopRecording, onVoiceResult, onTextResult],
	)

	// 清理资源
	useEffect(() => {
		return () => {
			// 确保组件卸载时停止所有资源
			cleanupAudioResources()
			stopMediaStream()
			disconnect()
		}
	}, [cleanupAudioResources, disconnect, stopMediaStream])

	return {
		recordingState,
		waveformData,
		status,
		startRecording,
		stopRecording,
		stopRecordingForEdit,
		cancelRecording,
		updateGestureState,
		handleRecordingResult,
		enterEditMode,
		exitEditMode,
		resetAllStates,
	}
}
