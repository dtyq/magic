/**
 * WAV format audio encoder
 * WAV 格式音频编码器
 */

import type { AudioEncoder } from "./AudioEncoder"
import type { AudioChunkData, EncodedAudioChunk } from "../types/RecorderTypes"
import { AudioEncodingError } from "../types/RecorderErrors"

/**
 * WAVEncoder encodes PCM data to WAV format with proper header
 * WAVEncoder 将 PCM 数据编码为带有正确头部的 WAV 格式
 */
export class WAVEncoder implements AudioEncoder {
	getMimeType(): string {
		return "audio/wav"
	}

	encode(chunkData: AudioChunkData): EncodedAudioChunk {
		try {
			const { pcmData, sampleRate, bitRate } = chunkData

			const numChannels = 1 // Mono
			const bytesPerSample = bitRate / 8
			const blockAlign = numChannels * bytesPerSample
			const byteRate = sampleRate * blockAlign
			const dataSize = pcmData.length * bytesPerSample
			const bufferSize = 44 + dataSize

			const buffer = new ArrayBuffer(bufferSize)
			const view = new DataView(buffer)

			// WAV file header (44 bytes total)

			// RIFF chunk descriptor (12 bytes)
			this.writeString(view, 0, "RIFF") // ChunkID
			view.setUint32(4, bufferSize - 8, true) // ChunkSize
			this.writeString(view, 8, "WAVE") // Format

			// fmt sub-chunk (24 bytes)
			this.writeString(view, 12, "fmt ") // Subchunk1ID
			view.setUint32(16, 16, true) // Subchunk1Size (16 for PCM)
			view.setUint16(20, 1, true) // AudioFormat (1 for PCM)
			view.setUint16(22, numChannels, true) // NumChannels
			view.setUint32(24, sampleRate, true) // SampleRate
			view.setUint32(28, byteRate, true) // ByteRate
			view.setUint16(32, blockAlign, true) // BlockAlign
			view.setUint16(34, bitRate, true) // BitsPerSample

			// data sub-chunk (8 bytes header + data)
			this.writeString(view, 36, "data") // Subchunk2ID
			view.setUint32(40, dataSize, true) // Subchunk2Size

			// Write PCM data (starting at byte 44)
			const pcmView = new Int16Array(buffer, 44)
			pcmView.set(pcmData)

			return {
				data: buffer,
				mimeType: this.getMimeType(),
				size: bufferSize,
			}
		} catch (error) {
			throw new AudioEncodingError("Failed to encode audio to WAV format", error as Error)
		}
	}

	/**
	 * Write string to DataView
	 * 将字符串写入 DataView
	 */
	private writeString(view: DataView, offset: number, string: string): void {
		for (let i = 0; i < string.length; i++) {
			view.setUint8(offset + i, string.charCodeAt(i))
		}
	}
}
