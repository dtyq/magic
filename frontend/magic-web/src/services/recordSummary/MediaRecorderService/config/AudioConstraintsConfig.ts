/**
 * Audio constraints configuration
 * 音频约束配置
 */

/**
 * Microphone audio constraints configuration
 * 麦克风音频约束配置
 */
export interface MicrophoneConstraintsConfig {
	echoCancellation: boolean
	noiseSuppression: boolean
	autoGainControl: boolean
	// Optional advanced settings
	sampleRate?: number
	channelCount?: number
	latency?: number
	volume?: number
}

/**
 * System audio constraints configuration
 * 系统音频约束配置
 */
export interface SystemAudioConstraintsConfig {
	echoCancellation: boolean
	noiseSuppression: boolean
	autoGainControl: boolean
	suppressLocalAudioPlayback: boolean
}

/**
 * Audio constraints presets
 * 音频约束预设
 */
export const AUDIO_CONSTRAINTS_PRESETS = {
	/**
	 * Default microphone constraints for general recording
	 * 通用录音的默认麦克风约束
	 */
	microphone: {
		default: {
			echoCancellation: true,
			noiseSuppression: true,
			autoGainControl: true,
			channelCount: 1,
		},
		/**
		 * High quality mode - minimal processing for music/podcast recording
		 * 高质量模式 - 最小处理，适用于音乐/播客录制
		 */
		highQuality: {
			echoCancellation: false,
			noiseSuppression: false,
			autoGainControl: false,
			channelCount: 1,
			// Chrome specific constraints
			["googEchoCancellation" as string]: false,
			["googAutoGainControl" as string]: false,
			["googNoiseSuppression" as string]: false,
			["googHighpassFilter" as string]: false,
		},
		/**
		 * Voice optimized - maximum noise reduction for voice recognition
		 * 语音优化 - 最大噪音抑制，适用于语音识别
		 */
		voiceOptimized: {
			echoCancellation: true,
			noiseSuppression: true,
			autoGainControl: true,
		},
	} as const,

	/**
	 * Default system audio constraints
	 * 默认系统音频约束
	 */
	systemAudio: {
		default: {
			echoCancellation: false,
			noiseSuppression: false,
			autoGainControl: false,
			suppressLocalAudioPlayback: false,
			channelCount: 1,
			// Chrome specific constraints
			["googEchoCancellation" as string]: false,
			["googAutoGainControl" as string]: false,
			["googNoiseSuppression" as string]: false,
			["googHighpassFilter" as string]: false,
		},
	} as const,
} as const

/**
 * Get microphone constraints based on preset or custom config
 * 根据预设或自定义配置获取麦克风约束
 */
export function getMicrophoneConstraints(
	preset: keyof typeof AUDIO_CONSTRAINTS_PRESETS.microphone = "default",
	customConfig?: Partial<MicrophoneConstraintsConfig>,
): MediaTrackConstraints {
	const baseConfig = AUDIO_CONSTRAINTS_PRESETS.microphone[preset]
	return {
		...baseConfig,
		...customConfig,
	}
}

/**
 * Get system audio constraints based on preset or custom config
 * 根据预设或自定义配置获取系统音频约束
 */
export function getSystemAudioConstraints(
	customConfig?: Partial<SystemAudioConstraintsConfig>,
): MediaTrackConstraints {
	const baseConfig = AUDIO_CONSTRAINTS_PRESETS.systemAudio.default
	return {
		...baseConfig,
		...customConfig,
	}
}
