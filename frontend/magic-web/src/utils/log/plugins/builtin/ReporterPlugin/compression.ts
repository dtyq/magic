import { isNil } from "lodash-es"
import { compressWithGzip } from "./compress/compressWithGzip"
import { compressWithLZString } from "./compress/compressWithLZString"

/**
 * 日志压缩工具
 * 提供多种压缩算法来减少日志上报的带宽占用
 */

/**
 * 压缩算法类型
 */
export const enum CompressionType {
	/** 不压缩 */
	NONE = "none",
	/** Gzip 压缩 */
	GZIP = "gzip",
	/** 简单字符串压缩（LZ-string） */
	LZ_STRING = "lz-string",
}

/**
 * 压缩配置
 */
export interface CompressionConfig {
	/** 压缩算法 */
	type: CompressionType
	/** 压缩阈值（字节），小于此值不压缩 */
	threshold?: number
	/** 压缩级别 (1-9，仅对 gzip 有效) */
	level?: number
}

/**
 * 压缩结果
 */
interface CompressionResult {
	/** 压缩后的数据 */
	data: string | Uint8Array
	/** 压缩算法 */
	type: CompressionType
	/** 原始大小 */
	originalSize: number
	/** 压缩后大小 */
	compressedSize: number
	/** 压缩比 */
	ratio: number
	/** 是否已压缩 */
	compressed: boolean
}

/**
 * 检查浏览器是否支持压缩流 API
 */
function supportsCompressionStreams(): boolean {
	try {
		return (
			typeof CompressionStream !== "undefined" &&
			typeof DecompressionStream !== "undefined" &&
			typeof ReadableStream !== "undefined"
		)
	} catch {
		return false
	}
}

/**
 * 压缩日志数据
 */
export async function compressLogData(
	data: any,
	config: CompressionConfig = { type: CompressionType.GZIP, threshold: 1024 },
): Promise<CompressionResult> {
	const jsonString = JSON.stringify(data)
	const originalSize = new TextEncoder().encode(jsonString).length
	const threshold = isNil(config.threshold) ? 1024 : config.threshold

	// 如果数据小于阈值，不进行压缩
	if (originalSize < threshold || config.type === CompressionType.NONE) {
		return {
			data: jsonString,
			type: CompressionType.NONE,
			originalSize,
			compressedSize: originalSize,
			ratio: 1,
			compressed: false,
		}
	}

	try {
		let compressedData: string | Uint8Array
		let compressedSize: number

		switch (config.type) {
			case CompressionType.GZIP:
				if (supportsCompressionStreams()) {
					compressedData = await compressWithGzip(jsonString)
					compressedSize = compressedData.length
				} else {
					// 降级到不压缩
					console.warn("Gzip compression not supported, falling back to no compression")
					compressedData = jsonString
					compressedSize = originalSize
					config.type = CompressionType.NONE
				}
				break

			case CompressionType.LZ_STRING:
				compressedData = compressWithLZString(jsonString)
				compressedSize = new TextEncoder().encode(compressedData).length
				break

			default:
				compressedData = jsonString
				compressedSize = originalSize
				config.type = CompressionType.NONE
				break
		}

		const ratio = originalSize > 0 ? compressedSize / originalSize : 1

		return {
			data: compressedData,
			type: config.type,
			originalSize,
			compressedSize,
			ratio,
			compressed: config.type !== CompressionType.NONE,
		}
	} catch (error) {
		console.error("Compression failed, falling back to uncompressed data:", error)
		return {
			data: jsonString,
			type: CompressionType.NONE,
			originalSize,
			compressedSize: originalSize,
			ratio: 1,
			compressed: false,
		}
	}
}
