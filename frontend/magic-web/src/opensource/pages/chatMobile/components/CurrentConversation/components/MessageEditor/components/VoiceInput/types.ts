import type { CSSProperties, ReactNode } from "react"

export interface VoiceInputMobileProps {
	/** 语音识别结果回调 - 新增actualMimeType参数 */
	onVoiceResult?: (audioData?: Blob, duration?: number, actualMimeType?: string) => void
	/** 文本转换结果回调 */
	onTextResult?: (text: string) => void
	/** 取消录音回调 */
	onCancel?: () => void
	/** 错误回调 */
	onError?: (error: Error) => void
	/** 状态变化回调 */
	onStatusChange?: (status: VoiceInputStatus) => void
	/** 是否禁用 */
	disabled?: boolean
	/** 按钮文本 */
	buttonText?: string
	/** 自定义样式 */
	style?: CSSProperties
	/** 自定义类名 */
	className?: string
	/** 自定义按钮内容 */
	children?: ReactNode
}

export type VoiceInputStatus = "idle" | "connecting" | "recording" | "processing" | "error"

export type GestureType = "none" | "cancel" | "send-text" | "send-voice"

export interface GestureState {
	type: GestureType
	progress: number // 0-1, 手势进度
	isActive: boolean
}

export interface RecordingState {
	isRecording: boolean
	duration: number // 录音时长（秒）
	audioLevel: number // 音频音量等级 0-100
	transcription: string // 实时转写文本
	gesture: GestureState
	isEditingText?: boolean // 是否处于文本编辑模式
	audioBlob?: Blob // 录音音频数据（用于编辑模式下发送原语音）
}

export interface TouchPosition {
	x: number
	y: number
	startX: number
	startY: number
	deltaX: number
	deltaY: number
}

export interface AudioWaveformData {
	levels: number[] // 音频波形数据，每个值0-100
	currentTime: number
	maxTime: number
}

export interface VoiceInputConfig {
	/** 最小录音时长（毫秒） */
	minRecordDuration?: number
	/** 最大录音时长（毫秒） */
	maxRecordDuration?: number
	/** 手势阈值（像素） */
	gestureThreshold?: number
	/** 是否启用实时转写 */
	enableRealTimeTranscription?: boolean
	/** 音频采样率 */
	sampleRate?: number
	/** 音频通道数 */
	channelCount?: number
	/** 音频位深 */
	bitsPerSample?: number
}
