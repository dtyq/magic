/**
 * PCM format audio encoder (raw PCM data)
 * PCM 格式音频编码器（原始 PCM 数据）
 */

import type { AudioEncoder } from "./AudioEncoder"
import type { AudioChunkData, EncodedAudioChunk } from "../types/RecorderTypes"
import { AudioEncodingError } from "../types/RecorderErrors"

/**
 * PCMEncoder outputs raw PCM data without additional formatting
 * PCMEncoder 输出原始 PCM 数据，不添加额外格式
 */
export class PCMEncoder implements AudioEncoder {
	/** Raw PCM encoding does not require asynchronous initialization. */
	initialize(): Promise<void> {
		return Promise.resolve()
	}

	/** Return the MIME type used for raw PCM compatibility paths. */
	getMimeType(): string {
		return "audio/pcm"
	}

	/** Copy one PCM chunk into an independent ArrayBuffer. */
	encode(chunkData: AudioChunkData): EncodedAudioChunk {
		try {
			const { pcmData } = chunkData

			// Return raw PCM data as ArrayBuffer
			const buffer = pcmData.buffer.slice(
				pcmData.byteOffset,
				pcmData.byteOffset + pcmData.byteLength,
			) as ArrayBuffer

			return {
				data: buffer,
				mimeType: this.getMimeType(),
				size: buffer.byteLength,
			}
		} catch (error) {
			throw new AudioEncodingError("Failed to encode audio to PCM format", error as Error)
		}
	}

	/** PCM encoding has no deferred work. */
	flush(): Promise<void> {
		return Promise.resolve()
	}

	/** PCM encoding owns no external resources. */
	close(): Promise<void> {
		return Promise.resolve()
	}

	/** Identify the persisted format for compatibility callers. */
	getFormat(): "pcm" {
		return "pcm"
	}
}
