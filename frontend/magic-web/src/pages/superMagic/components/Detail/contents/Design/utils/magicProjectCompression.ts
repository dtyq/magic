import pako from "pako"

/**
 * Magic Project canvas 压缩协议（与后端 magic_project_compression.py 对齐）。
 *
 * 协议格式：MAGICPROJECTDESIGNDATA://[base64(gzip(json(canvas_obj)))]
 *
 * 被编码的是 canvas 子对象（含 elements 等），不是整份信封。
 * 信封字段 version / type / name 保持明文。
 */

/** canvas 压缩协议前缀 */
export const MAGIC_PROJECT_DESIGN_DATA_PREFIX = "MAGICPROJECTDESIGNDATA://"

/**
 * magic.project.js 格式版本（信封 version 字段，与后端一致，作为格式契约）：
 * - v1（1.0.0）：canvas 明文对象、重字段内联
 * - v2（2.0.0）：canvas 为压缩串、重字段拆到 element-details sidecar
 * - v3（3.0.0）：canvas 为压缩串、统一 Content 结构、Content 级 sidecar
 *
 * 物理解压仍由 canvas 字段类型驱动（读取层自描述、稳健）；
 * version 用于决定保存时写哪种格式，以及 sidecar 读写是否启用。
 */
export const MAGIC_PROJECT_VERSION_V1 = "1.0.0"
export const MAGIC_PROJECT_VERSION_V2 = "2.0.0"
export const MAGIC_PROJECT_VERSION_V3 = "3.0.0"

/** 项目是否使用压缩 canvas。 */
export function isCompressedProjectVersion(version: string | undefined): boolean {
	return version === MAGIC_PROJECT_VERSION_V2 || version === MAGIC_PROJECT_VERSION_V3
}

export function isContentProjectVersion(version: string | undefined): boolean {
	return version === MAGIC_PROJECT_VERSION_V3
}

function uint8ToBase64(bytes: Uint8Array): string {
	let binary = ""
	const chunkSize = 0x8000
	for (let i = 0; i < bytes.length; i += chunkSize) {
		const chunk = bytes.subarray(i, i + chunkSize)
		binary += String.fromCharCode.apply(null, chunk as unknown as number[])
	}
	return btoa(binary)
}

function base64ToUint8(base64: string): Uint8Array {
	const binary = atob(base64)
	const bytes = new Uint8Array(binary.length)
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i)
	}
	return bytes
}

/**
 * 判断一个 canvas 值是否为 MAGICPROJECTDESIGNDATA:// 压缩字符串。
 */
export function isCompressedCanvas(value: unknown): value is string {
	return typeof value === "string" && value.startsWith(MAGIC_PROJECT_DESIGN_DATA_PREFIX)
}

/**
 * 将 canvas 对象压缩为协议字符串。
 */
export function compressCanvasData(canvas: unknown): string {
	const jsonStr = JSON.stringify(canvas)
	const compressed = pako.gzip(jsonStr)
	const encoded = uint8ToBase64(compressed)
	return `${MAGIC_PROJECT_DESIGN_DATA_PREFIX}${encoded}`
}

/**
 * 将协议字符串解压为 canvas 对象。
 * @throws 字符串不是合法压缩协议或解压失败时抛出
 */
export function decompressCanvasData(encoded: string): unknown {
	if (!isCompressedCanvas(encoded)) {
		throw new Error(
			`Not a compressed canvas string, expected prefix ${MAGIC_PROJECT_DESIGN_DATA_PREFIX}`,
		)
	}

	const payload = encoded.slice(MAGIC_PROJECT_DESIGN_DATA_PREFIX.length)
	const bytes = base64ToUint8(payload)
	const jsonStr = pako.ungzip(bytes, { to: "string" })
	return JSON.parse(jsonStr)
}
