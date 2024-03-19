/**
 * Message processing utilities for voice client
 * Handles message parsing and response processing
 */

import { VoiceResult } from "../types"

/**
 * Normalize message data from WebSocket to ArrayBuffer
 */
export async function normalizeMessageData(data: unknown): Promise<{
	buffer: ArrayBuffer | null
	messageType: "binary" | "text" | "unknown"
	originalData?: string
}> {
	if (data instanceof Blob) {
		const buffer = await data.arrayBuffer()
		return { buffer, messageType: "binary" }
	} else if (data instanceof ArrayBuffer) {
		return { buffer: data, messageType: "binary" }
	} else if (typeof data === "string") {
		return { buffer: null, messageType: "text", originalData: data }
	} else {
		return { buffer: null, messageType: "unknown" }
	}
}

/**
 * Parse server response text to voice result
 */
export function parseServerResponse(textData: string): {
	result: VoiceResult | null
	error?: string
	logs: Array<{ message: string; level: "success" | "info" | "warning" }>
} {
	const logs: Array<{ message: string; level: "success" | "info" | "warning" }> = []

	try {
		const result = JSON.parse(textData)

		// 处理火山引擎的响应格式
		if (result.result && Object.prototype.hasOwnProperty.call(result.result, "text")) {
			const text = result.result.text || ""
			logs.push({
				message: `提取到识别文本: "${text}"`,
				level: text ? "success" : "info",
			})
			return {
				result: {
					text,
					confidence: result.result.confidence,
					isPartial: result.result.is_partial,
					utterances: result.result.utterances,
				},
				logs,
			}
		} else if (
			result.payload &&
			result.payload.result &&
			Object.prototype.hasOwnProperty.call(result.payload.result, "text")
		) {
			const text = result.payload.result.text || ""
			return { result: { text }, logs }
		} else if (Object.prototype.hasOwnProperty.call(result, "text")) {
			const text = result.text || ""
			return { result: { text }, logs }
		} else if (result.result && result.result.words) {
			const text = result.result.words
				.map((w: { word?: string; text?: string }) => w.word || w.text)
				.join("")
			return { result: { text }, logs }
		} else {
			logs.push({
				message: `无法解析的响应格式: ${textData}`,
				level: "warning",
			})
			return { result: null, logs }
		}
	} catch (jsonError) {
		return { result: { text: textData }, logs }
	}
}

/**
 * Parse text message for errors or results
 */
export function parseTextMessage(text: string): {
	isError: boolean
	errorCode?: string | number
	errorMessage?: string
	shouldReconnect?: boolean
	result?: any
	logs: Array<{ message: string; level: "error" | "info" }>
} {
	const logs: Array<{ message: string; level: "error" | "info" }> = []

	try {
		const result = JSON.parse(text)

		if (result.header && result.header.status !== 20000000) {
			// 记录详细的错误信息用于调试
			const errorCode = result.header.status
			const errorMessage = result.header.status_message || "未知错误"

			logs.push({
				message: `服务器返回错误: 代码=${errorCode}, 消息=${errorMessage}, 完整响应=${text}`,
				level: "error",
			})

			return {
				isError: true,
				errorCode,
				errorMessage: `${errorMessage} (代码: ${errorCode})`,
				shouldReconnect: true,
				logs,
			}
		} else if (result.error) {
			return {
				isError: true,
				errorMessage: result.error,
				logs,
			}
		} else {
			return {
				isError: false,
				result,
				logs,
			}
		}
	} catch (e) {
		logs.push({
			message: `无法解析JSON文本消息: ${(e as Error).message}`,
			level: "info",
		})
		return {
			isError: false,
			logs,
		}
	}
}

/**
 * Calculate audio stats from audio data
 */
export function calculateAudioStats(
	audioData: ArrayBuffer,
	sampleRate: number,
	bitsPerSample: number,
): {
	samples: number
	durationMs: number
} {
	const samples = audioData.byteLength / (bitsPerSample / 8)
	const durationMs = (samples / sampleRate) * 1000
	return { samples, durationMs }
}
