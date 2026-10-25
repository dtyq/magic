import type { Canvas } from "../../../../runtime/core/Canvas"
import { CanvasElementClipboard } from "../../../../runtime/resources/clipboard/CanvasElementClipboard"
import type { CanvasElementClipboardFileMetadata } from "../../../../runtime/resources/clipboard/CanvasElementClipboard"
import { pickPluginFiles } from "../assets/fileAssets"
import type {
	PluginCanvasClipboardFileMetadata,
	PluginCanvasClipboardPayload,
	PluginCanvasClipboardReadResult,
	PluginFileAsset,
} from "./types"

/**
 * 插件 iframe 无法直接读取画布 V2 bundle 剪贴板（`web application/x-canvas-design-clipboard-bundle`），
 * 由 Host 页面代为调用与画布相同的 Clipboard API，并将可序列化的 metadata 回传给插件。
 * payload 含 source/version/operation/files，不含 elements 与 Blob 本体。
 */

/** 将画布剪贴板文件 metadata 转为可 postMessage 的 plain object。 */
function serializeClipboardFileMetadata(
	file: CanvasElementClipboardFileMetadata,
): PluginCanvasClipboardFileMetadata | null {
	if (file.role === "generation-resource") return null
	return {
		id: file.id,
		elementId: file.elementId,
		filename: file.filename,
		mimeType: file.mimeType,
		fileSize: file.fileSize,
		role: file.role,
		sourceRef: file.sourceRef
			? {
					src: file.sourceRef.src,
					ossUrl: file.sourceRef.ossUrl,
					expiresAt: file.sourceRef.expiresAt,
				}
			: undefined,
	}
}

/** 优先使用宿主注入的 clipboard.read，否则降级到 navigator.clipboard.read。 */
function getCanvasClipboardReadOptions(canvas: Canvas) {
	const clipboard = canvas.magicConfigManager.config?.methods?.clipboard
	if (!clipboard?.read) {
		return undefined
	}
	return {
		read: clipboard.read.bind(clipboard),
		readText: clipboard.readText?.bind(clipboard),
	}
}

/**
 * Host 侧读取系统剪贴板中的画布复制内容。
 *
 * - `copy-elements`：只返回 payload（含 sourceRef.src），供插件 resolve 复用，不上传。
 * - `copy-as-png`：bundle 内带导出 Blob，在 Host 侧 upload 后返回 uploadedAssets。
 */
export async function readPluginCanvasClipboard(
	canvas: Canvas,
): Promise<PluginCanvasClipboardReadResult> {
	const clipboardResult = await CanvasElementClipboard.read(getCanvasClipboardReadOptions(canvas))
	if (!clipboardResult) {
		return { payload: null, uploadedAssets: [] }
	}

	const payload: PluginCanvasClipboardPayload = {
		source: clipboardResult.payload.source,
		version: clipboardResult.payload.version,
		operation: clipboardResult.payload.operation,
		files: clipboardResult.payload.files
			.map(serializeClipboardFileMetadata)
			.filter((file): file is PluginCanvasClipboardFileMetadata => Boolean(file)),
	}

	let uploadedAssets: PluginFileAsset[] = []
	if (clipboardResult.payload.operation === "copy-as-png" && clipboardResult.files.length > 0) {
		uploadedAssets = (
			await pickPluginFiles(
				canvas,
				clipboardResult.files.map((item) => item.file),
				{
					type: "image",
					maxCount: clipboardResult.files.length,
				},
			)
		).map((asset, index) => ({
			...asset,
			// copy-as-png 上传后会得到新的文件 asset，保留原画布元素 id 供后续生成结果靠近来源图。
			sourceElementId: clipboardResult.payload.files[index]?.elementId,
		}))
	}

	return { payload, uploadedAssets }
}
