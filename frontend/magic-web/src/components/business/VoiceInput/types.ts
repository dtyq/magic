import type { CSSProperties, ReactNode } from "react"
import { VoiceResultUtterance } from "./services/VoiceClient/types"
import { MessageEditorSize } from "@/pages/superMagic/components/MessageEditor/types"

export interface VoiceInputRef {
	/** 停止录音 */
	stopRecording: () => void
	/** 当前是否正在录音 */
	readonly isRecording: boolean
	/** 当前状态 */
	readonly status: VoiceInputStatus
}

export interface VoiceInputProps {
	/** 语音识别结果回调 */
	onResult: (text: string, response: VoiceResult) => void
	/** 错误回调 */
	onError?: (error: Error) => void
	/** 状态变化回调 */
	onStatusChange?: (status: VoiceInputStatus) => void
	/** 录音状态变化回调 */
	onRecordingChange?: (isRecording: boolean) => void
	/** 是否禁用 */
	disabled?: boolean
	/** 占位符文本 */
	placeholder?: string
	/** 自定义样式 */
	style?: CSSProperties
	/** 自定义类名 */
	className?: string
	/** 自定义录音按钮内容 */
	children?: ReactNode
	/** 语音配置 */
	config?: Partial<VoiceInputConfig>
	/** 图标大小 */
	iconSize?: number
	/** 大小 */
	size?: MessageEditorSize
	/** 是否启用快捷键 (⌘+Shift+E / Ctrl+Shift+E) */
	enableHotkey?: boolean
}

/**
 * Voice input status enum
 */
export enum VoiceInputStatusEnum {
	Idle = "idle",
	Connecting = "connecting",
	Recording = "recording",
	Processing = "processing",
	Error = "error",
}

export type VoiceInputStatus = "idle" | "connecting" | "recording" | "processing" | "error"

export interface VoiceInputConfig {
	/** WebSocket URL */
	wsUrl: string
	/** 资源ID */
	resourceId: string
	/** 应用ID */
	apiAppId: string
	/** 认证Token */
	authToken?: string
	/** 组织代码 */
	organizationCode?: string
	/** 音频配置 */
	audio: {
		sampleRate: number
		channelCount: number
		bitsPerSample: number
	}
	request?: {
		resultType?: "single" | "full"
		endWindowSize?: number // 单位ms，静音时长超过该值会判停输出definite
		forceToSpeechTime?: number // 单位ms，音频时长超过该值后才会判停，建议1000-2000
		enableAccelerateText?: boolean // true: 启用首字加速, false: 禁用首字加速
		accelerateScore?: number // 值越大，首字出字越快，范围[0-20]
		enableNonstream?: boolean // 开启二遍识别，提升准确率但增加延迟
		enableDdc?: boolean // 启用语义顺滑，提升可读性但增加处理时间
		vadSegmentDuration?: number // 单位ms，默认为3000。当静音时间超过该值时，会将文本分为两个句子。
	}
	user?: {
		uid: string
		app_version: string
		platform: string
	}
}

export interface VoiceTokenResponse {
	code: number
	message: string
	data: {
		token: string
		app_id: string
		duration: number
		expires_at: number
		user?: {
			user_id: string
			organization_code: string
		}
	}
}

export interface VoiceResult {
	text: string
	utterances?: VoiceResultUtterance[]
}
