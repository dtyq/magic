/**
 * Configuration utilities for voice client
 * Handles validation and normalization of voice config
 */

import { VoiceConfig } from "../types"

/**
 * Validate and normalize voice configuration
 */
export function validateAndNormalizeConfig(config: VoiceConfig): VoiceConfig {
	if (!config.wsUrl || !config.resourceId || !config.apiAppId) {
		throw new Error("必需的配置参数缺失: wsUrl, resourceId, apiAppId")
	}

	if (!config.audio || !config.audio.sampleRate || !config.audio.channelCount) {
		throw new Error("音频配置无效")
	}

	if (config.audio.sampleRate < 8000 || config.audio.sampleRate > 48000) {
		throw new Error("采样率必须在8000-48000之间")
	}

	return config
}

/**
 * Create initial request payload for ASR service
 */
export function createInitialRequestPayload(config: VoiceConfig) {
	return {
		user: config.user,
		audio: {
			format: "pcm",
			sample_rate: config.audio.sampleRate,
			bits: config.audio.bitsPerSample,
			channel: config.audio.channelCount,
			codec: "raw",
		},
		request: {
			model_name: "bigmodel",
			enable_punc: true,
			model_version: "400",
			enable_ddc: config.request?.enableDdc ?? false, // 语义顺滑，默认关闭以提升性能
			result_type: config.request?.resultType, // single: 单句识别, full: 完整识别结果
			end_window_size: config.request?.endWindowSize, // 静音判停时间
			force_to_speech_time: config.request?.forceToSpeechTime, // 强制语音时间
			enable_nonstream: config.request?.enableNonstream,
			enable_accelerate_text: config.request?.enableAccelerateText,
			accelerate_score: config.request?.accelerateScore,
			vad_segment_duration: config.request?.vadSegmentDuration,
			corpus: {
				context: JSON.stringify({
					hotwords: [{ word: "超级麦吉" }, { word: "麦吉" }, { word: "Super Magic" }],
				}),
			},
		},
	}
}
