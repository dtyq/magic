export const UNKNOWN_TEXT_PREVIEW_MAX_BYTES = 2 * 1024 * 1024

export type FileContentKind = "text" | "binary" | "unknown"
export type UnknownFilePreviewResult =
	| { status: "text"; content: string }
	| { status: "binary" | "too-large" | "unsupported-encoding" }

/** 只取单个文件的原始身份，不把附件树或正文带入图标缓存。 */
export interface FileContentMetadata {
	file_id?: string
	project_id?: string
	space_type?: string
	file_name?: string
	file_extension?: string
	file_size?: number
	is_directory?: boolean
	type?: string
	display_config?: { type?: string }
	resource_version?: string | null
	version?: string | null
	/** 上下文件导航选定的历史版本，与资源版本标识分开。 */
	file_version?: number
	updated_at?: string
}

export function getFileContentKey(scope: string, file: FileContentMetadata): string {
	return JSON.stringify([
		scope,
		file.space_type || "project",
		String(file.project_id ?? ""),
		String(file.file_id ?? ""),
		String(file.resource_version || file.version || ""),
		file.file_version ?? "",
		file.updated_at || "",
	])
}

/** 扩展名和 MIME 都不证明内容可读；只对完整、有界的字节内容下结论。 */
export async function classifyFileContent(blob: Blob): Promise<UnknownFilePreviewResult> {
	if (blob.size > UNKNOWN_TEXT_PREVIEW_MAX_BYTES) return { status: "too-large" }
	if (blob.size === 0) return { status: "text", content: "" }

	const bytes = new Uint8Array(await blob.arrayBuffer())
	const { fileTypeFromBuffer } = await import("file-type")
	try {
		if (await fileTypeFromBuffer(bytes)) return { status: "binary" }
	} catch {
		// 短文件或不完整签名可能使格式解析失败；仍须经过严格文本检测，不能据此判为二进制。
	}

	const encoding =
		bytes[0] === 0xff && bytes[1] === 0xfe
			? "utf-16le"
			: bytes[0] === 0xfe && bytes[1] === 0xff
				? "utf-16be"
				: "utf-8"
	let content: string
	try {
		content = new TextDecoder(encoding, { fatal: true }).decode(bytes)
	} catch {
		return { status: "unsupported-encoding" }
	}

	// UTF-16 先按 BOM 解码，避免把普通文字的零字节误判为二进制。
	// 保留 tab、换行、换页和 ESC；其余 C0 控制字符及 DEL 不进入文本预览。
	for (const character of content) {
		const code = character.charCodeAt(0)
		if (
			code <= 0x08 ||
			code === 0x0b ||
			(code >= 0x0e && code <= 0x1a) ||
			(code >= 0x1c && code <= 0x1f) ||
			code === 0x7f
		) {
			return { status: "binary" }
		}
	}
	return { status: "text", content }
}
