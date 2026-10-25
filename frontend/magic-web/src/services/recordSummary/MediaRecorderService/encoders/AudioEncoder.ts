/**
 * Audio encoder interface for encoding PCM data to various formats
 * 音频编码器接口，用于将 PCM 数据编码为各种格式
 */

import type {
	AudioChunkData,
	EncodedAudioChunk,
	RecordingEncodingFormat,
} from "../types/RecorderTypes"

/**
 * Audio encoder interface
 * 音频编码器接口
 */
export interface AudioEncoder {
	/** Prepare runtime resources and fail before microphone capture when unsupported. */
	initialize(): Promise<void>

	/**
	 * Encode audio chunk data to specific format
	 * 将音频分片数据编码为特定格式
	 */
	encode(chunkData: AudioChunkData): EncodedAudioChunk | Promise<EncodedAudioChunk>

	/** Wait for any encoder-owned work that has not completed yet. */
	flush(): Promise<void>

	/** Release encoder resources without changing the selected session format. */
	close(): Promise<void>

	/**
	 * Get MIME type of encoded audio
	 * 获取编码后音频的 MIME 类型
	 */
	getMimeType(): string

	/** Return the concrete format persisted with every completed chunk. */
	getFormat(): RecordingEncodingFormat
}
