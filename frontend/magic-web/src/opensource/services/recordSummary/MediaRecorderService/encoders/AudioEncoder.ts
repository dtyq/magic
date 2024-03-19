/**
 * Audio encoder interface for encoding PCM data to various formats
 * 音频编码器接口，用于将 PCM 数据编码为各种格式
 */

import type { AudioChunkData, EncodedAudioChunk } from "../types/RecorderTypes"

/**
 * Audio encoder interface
 * 音频编码器接口
 */
export interface AudioEncoder {
	/**
	 * Encode audio chunk data to specific format
	 * 将音频分片数据编码为特定格式
	 */
	encode(chunkData: AudioChunkData): EncodedAudioChunk

	/**
	 * Get MIME type of encoded audio
	 * 获取编码后音频的 MIME 类型
	 */
	getMimeType(): string
}
