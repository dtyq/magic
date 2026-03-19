export interface VoiceConfig {
	wsUrl: string
	resourceId: string
	apiAppId: string
	authToken?: string
	organizationCode?: string
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
	retry?: {
		maxAttempts: number
		delay: number
		backoffMultiplier: number
		maxGlobalReconnects?: number
		reconnectCooldown?: number
		minReconnectInterval?: number
		connectionStableDelay?: number
	}
	user?: {
		uid: string
		app_version: string
		platform: string
	}
}

export type VoiceResultUtterance = {
	text: string
	start_time?: number
	end_time?: number
	definite?: boolean // 是否确定
	words?: {
		text: string
		start_time?: number
		end_time?: number
	}
}

export interface VoiceResult {
	text: string
	confidence?: number
	isPartial?: boolean
	utterances?: VoiceResultUtterance[]
}

export interface VoiceClientEvents {
	log: (message: string, type: "info" | "success" | "error" | "warning") => void
	error: (message: string, code?: string | number) => void
	status: (
		message: string,
		state: "connecting" | "connected" | "recording" | "error" | "reconnecting" | "stop",
	) => void
	open: () => void
	close: (code?: number, reason?: string) => void
	result: (result: VoiceResult) => void
	retry: (attempt: number, maxAttempts: number) => void
	resetRequired: () => void
}
export type ConnectionState = "disconnected" | "connecting" | "connected" | "reconnecting" | "error"
export interface RetryConfig {
	maxAttempts: number
	delay: number
	backoffMultiplier: number
}
export interface AudioStats {
	totalBytes: number
	totalDuration: number
	packetCount: number
}
