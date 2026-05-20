import type { CanvasFileElement, LayerElement } from "../types"
import { ElementTypeEnum } from "../types"
import {
	CanvasDesignClipboard,
	type CanvasDesignClipboardNativeExposure,
	type CanvasDesignClipboardOptions,
} from "./CanvasDesignClipboard"
import { logCanvasElementClipboard } from "./CanvasElementClipboardLogger"
import { getFileExtensionFromMimeType, validateAndFilterCanvasFiles } from "./utils"
import { isValidElementData } from "./validateElement"

/**
 * CanvasDesign 元素剪贴板主元数据 MIME。
 *
 * 使用 Web Custom Format（`web ...`）而不是 `text/plain` / `text/html` / 普通
 * `application/json`，目的是让系统其它应用粘贴时不会直接暴露元素 JSON。
 */
export const CANVAS_ELEMENT_CLIPBOARD_MIME_TYPE = "web application/x-canvas-design-elements+json"

/**
 * CanvasDesign 内部媒体 Blob MIME。
 *
 * 每个图片 / 视频元素对应一个该 MIME 的 ClipboardItem，用 payload.files 中的
 * `elementId` 和顺序进行匹配。媒体项会额外写入自身原生 `image/*` / `video/*` MIME，
 * 用于外部应用互操作。
 */
export const CANVAS_ELEMENT_FILE_BLOB_MIME_TYPE = "web application/x-canvas-design-file"

const CANVAS_ELEMENT_CLIPBOARD_SOURCE = "canvas-design"
const CANVAS_ELEMENT_CLIPBOARD_VERSION = 1
const DEFAULT_CLIPBOARD_FILENAME_FILE_FLAG = "__canvasDesignDefaultClipboardFilename"

export type CanvasElementClipboardOperation = "copy-elements" | "copy-as-png"
export type CanvasElementClipboardPasteSource = "keyboard" | "menu"
export type CanvasElementClipboardBrowserOptions = CanvasDesignClipboardOptions
export type CanvasElementClipboardNativeExposure = CanvasDesignClipboardNativeExposure

function getClipboardItemTypes(items: ClipboardItem[]): string[][] {
	return items.map((item) => Array.from(item.types))
}

export interface CanvasElementClipboardFileMetadata {
	/** 单次剪贴板 payload 内的文件索引 ID，不要求跨复制稳定 */
	id: string
	/** 对应的原始元素 ID；画布导出文件没有源元素时使用导出 ID */
	elementId: string
	/** 写入剪贴板时保留的文件名，用于上传和元素命名 */
	filename: string
	/** 原始 Blob 的 MIME，用于从私有 Blob 还原 File */
	mimeType: string
	/** 文件大小；未下载 Blob 时允许为 0，作为 unknown 处理 */
	fileSize: number
	/** 文件来源角色：元素媒体文件用于恢复元素，画布导出文件用于按普通文件粘贴 */
	role: "element-media" | "canvas-export"
	/** 原资源引用。Blob 不可用或后续做大文件降级时，可按该引用重新下载再上传。 */
	sourceRef?: {
		src?: string
		ossUrl?: string
		expiresAt?: string
	}
}

/**
 * CanvasDesign 元素复制的唯一 payload。
 *
 * - `elements` 保存本次复制的完整元素数据，包含非媒体元素。
 * - `files` 只保存媒体元素对应的 Blob 索引，不保存 Blob 本身。
 * - Blob 本体在后续 ClipboardItem 中通过 `CANVAS_ELEMENT_FILE_BLOB_MIME_TYPE` 写入。
 */
export interface CanvasElementClipboardPayload {
	source: typeof CANVAS_ELEMENT_CLIPBOARD_SOURCE
	version: typeof CANVAS_ELEMENT_CLIPBOARD_VERSION
	/** 产生该 payload 的复制操作 */
	operation: CanvasElementClipboardOperation
	/** 来源画布 ID；新版富剪贴板允许跨画布上传 Blob 后重建元素 */
	sourceCanvasId?: string
	elements: LayerElement[]
	files: CanvasElementClipboardFileMetadata[]
}

export interface CanvasElementClipboardFile {
	metadata: CanvasElementClipboardFileMetadata
	file: File
}

export interface CanvasElementClipboardReadResult {
	payload: CanvasElementClipboardPayload
	files: CanvasElementClipboardFile[]
}

export interface CanvasElementClipboardWriteFile {
	metadata: CanvasElementClipboardFileMetadata
	blob: Blob
}

export type CanvasElementClipboardParseResult =
	| {
			type: "canvas-elements"
			elements: CanvasElementClipboardPayload["elements"]
			canvasId?: string
			files: CanvasElementClipboardFile[]
			fileMetadata: CanvasElementClipboardPayload["files"]
	  }
	| { type: "files"; files: File[] }
	| { type: "empty" }
	| { type: "invalid"; reason: string }

export interface CanvasElementClipboardParseOptions {
	/** Host-provided rich clipboard reader; falls back to navigator.clipboard.read. */
	read?: () => Promise<ClipboardItem[]>
	/** Host-provided text clipboard reader; falls back to navigator.clipboard.readText. */
	readText?: () => Promise<string>
	/** Paste entry point, used to distinguish Ctrl/Cmd+V from menu paste. */
	pasteSource?: CanvasElementClipboardPasteSource
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null
}

function isCanvasFileElement(element: LayerElement): element is CanvasFileElement {
	return element.type === ElementTypeEnum.Image || element.type === ElementTypeEnum.Video
}

function sanitizeFilename(filename: string, mimeType: string): string {
	const trimmed = filename.trim().replace(/[\\/:*?"<>|]+/g, "-")
	const fallback = `canvas-file.${getFileExtensionFromMimeType(mimeType)}`
	return trimmed || fallback
}

function buildFileFromBlob(blob: Blob, metadata: CanvasElementClipboardFileMetadata): File {
	const filename = sanitizeFilename(metadata.filename, metadata.mimeType || blob.type)
	const type = blob.type || metadata.mimeType
	return new File([blob], filename, { type })
}

function getExternalClipboardFallbackFilename(mediaType: string): string {
	const basename = mediaType.startsWith("video/") ? "video" : "image"
	return `${basename}.${getFileExtensionFromMimeType(mediaType)}`
}

function markDefaultClipboardFilenameFile(file: File): File {
	Object.defineProperty(file, DEFAULT_CLIPBOARD_FILENAME_FILE_FLAG, {
		value: true,
		enumerable: false,
		configurable: false,
	})
	return file
}

export function isDefaultClipboardFilenameFile(file: File): boolean {
	return (
		file.name.trim() === "" ||
		(file as File & Record<typeof DEFAULT_CLIPBOARD_FILENAME_FILE_FLAG, unknown>)[
			DEFAULT_CLIPBOARD_FILENAME_FILE_FLAG
		] === true
	)
}

function normalizePayload(data: unknown): CanvasElementClipboardPayload | null {
	if (!isRecord(data)) {
		return null
	}

	if (
		data.source !== CANVAS_ELEMENT_CLIPBOARD_SOURCE ||
		data.version !== CANVAS_ELEMENT_CLIPBOARD_VERSION ||
		!Array.isArray(data.elements) ||
		!Array.isArray(data.files)
	) {
		return null
	}

	const elements = data.elements.filter(isValidElementData)
	const operation = isCanvasElementClipboardOperation(data.operation)
		? data.operation
		: "copy-elements"
	const files = data.files
		.map(normalizeFileMetadata)
		.filter((file): file is CanvasElementClipboardFileMetadata => Boolean(file))

	if (elements.length === 0 && !files.some((file) => file.role === "canvas-export")) {
		return null
	}

	return {
		source: CANVAS_ELEMENT_CLIPBOARD_SOURCE,
		version: CANVAS_ELEMENT_CLIPBOARD_VERSION,
		operation,
		sourceCanvasId: getPayloadSourceCanvasId(data),
		elements,
		files,
	}
}

function getPayloadSourceCanvasId(payload: unknown): string | undefined {
	if (!isRecord(payload)) {
		return undefined
	}

	if (typeof payload.sourceCanvasId === "string") {
		return payload.sourceCanvasId
	}

	return typeof payload.id === "string" ? payload.id : undefined
}

function normalizeSourceRef(
	sourceRef: unknown,
): CanvasElementClipboardFileMetadata["sourceRef"] | undefined {
	if (!isRecord(sourceRef)) {
		return undefined
	}

	return {
		src: typeof sourceRef.src === "string" ? sourceRef.src : undefined,
		ossUrl: typeof sourceRef.ossUrl === "string" ? sourceRef.ossUrl : undefined,
		expiresAt: typeof sourceRef.expiresAt === "string" ? sourceRef.expiresAt : undefined,
	}
}

function normalizeFileMetadata(file: unknown): CanvasElementClipboardFileMetadata | null {
	if (!isRecord(file)) {
		return null
	}

	if (
		typeof file.id !== "string" ||
		typeof file.elementId !== "string" ||
		typeof file.filename !== "string" ||
		typeof file.mimeType !== "string" ||
		typeof file.fileSize !== "number"
	) {
		return null
	}

	const role = file.role ?? file.fileRole
	if (role !== "element-media" && role !== "canvas-export") {
		return null
	}

	return {
		id: file.id,
		elementId: file.elementId,
		filename: file.filename,
		mimeType: file.mimeType,
		fileSize: file.fileSize,
		role,
		sourceRef: normalizeSourceRef(file.sourceRef),
	}
}

function isCanvasElementClipboardOperation(
	value: unknown,
): value is CanvasElementClipboardOperation {
	return value === "copy-elements" || value === "copy-as-png"
}

/**
 * Single entry point for the CanvasDesign element clipboard protocol.
 *
 * MIME constants, payload schema, metadata rules, ClipboardItem construction,
 * and external file fallback parsing stay here so business code does not need
 * to know protocol details.
 */
export class CanvasElementClipboard {
	public static readonly metadataMimeType = CANVAS_ELEMENT_CLIPBOARD_MIME_TYPE

	public static isCanvasFileElement(element: LayerElement): element is CanvasFileElement {
		return isCanvasFileElement(element)
	}

	public static supportsNativeMimeType(mimeType: string): boolean {
		return CanvasDesignClipboard.supports(mimeType)
	}

	/**
	 * 创建元素主 payload。这里只组装元数据，不读取或写入剪贴板。
	 */
	public static createPayload(options: {
		elements: LayerElement[]
		canvasId?: string
		files: CanvasElementClipboardFileMetadata[]
		operation: CanvasElementClipboardOperation
	}): CanvasElementClipboardPayload {
		const payload: CanvasElementClipboardPayload = {
			source: CANVAS_ELEMENT_CLIPBOARD_SOURCE,
			version: CANVAS_ELEMENT_CLIPBOARD_VERSION,
			operation: options.operation,
			sourceCanvasId: options.canvasId,
			elements: options.elements,
			files: options.files,
		}

		logCanvasElementClipboard("create-payload", {
			canvasId: options.canvasId,
			operation: options.operation,
			elementCount: options.elements.length,
			fileCount: options.files.length,
			elementTypes: options.elements.map((element) => element.type),
			fileElementIds: options.files.map((file) => file.elementId),
			fileMimeTypes: options.files.map((file) => file.mimeType),
			payload,
		})

		return payload
	}

	/**
	 * 创建媒体文件索引元数据。
	 *
	 * `fileId` 只需要在当前 payload 内唯一；真正匹配元素靠 `elementId`。
	 */
	public static createFileMetadata(options: {
		element: CanvasFileElement
		fileId: string
		filename: string
		mimeType: string
		fileSize: number
		sourceRef?: CanvasElementClipboardFileMetadata["sourceRef"]
	}): CanvasElementClipboardFileMetadata {
		logCanvasElementClipboard("create-file-metadata", {
			fileId: options.fileId,
			elementId: options.element.id,
			elementType: options.element.type,
			filename: options.filename,
			mimeType: options.mimeType,
			fileSize: options.fileSize,
			elementJson: options.element,
			operation: "copy-elements",
			sourceRef: options.sourceRef,
		})

		return {
			id: options.fileId,
			elementId: options.element.id,
			filename: sanitizeFilename(options.filename, options.mimeType),
			mimeType: options.mimeType,
			fileSize: options.fileSize,
			role: "element-media",
			sourceRef: options.sourceRef,
		}
	}

	/**
	 * 创建画布导出文件索引元数据。
	 *
	 * 复制为 PNG 也是 CanvasDesign 产物，统一写入私有 payload；但它不是某个元素的
	 * 原始媒体 Blob，粘贴时应按普通图片文件创建新元素，而不是恢复源元素。
	 */
	public static createCanvasExportFileMetadata(options: {
		fileId: string
		filename: string
		mimeType: string
		fileSize: number
		sourceElements: LayerElement[]
		sourceRef?: CanvasElementClipboardFileMetadata["sourceRef"]
	}): CanvasElementClipboardFileMetadata {
		logCanvasElementClipboard("create-canvas-export-file-metadata", {
			fileId: options.fileId,
			filename: options.filename,
			mimeType: options.mimeType,
			fileSize: options.fileSize,
			operation: "copy-as-png",
			sourceElementsJson: options.sourceElements,
			sourceRef: options.sourceRef,
		})

		return {
			id: options.fileId,
			elementId: options.fileId,
			filename: sanitizeFilename(options.filename, options.mimeType),
			mimeType: options.mimeType,
			fileSize: options.fileSize,
			role: "canvas-export",
			sourceRef: options.sourceRef,
		}
	}

	/**
	 * 将 CanvasDesign 元素 payload 和媒体 Blob 组装成浏览器 ClipboardItem[]。
	 *
	 * 写入形态：
	 * 1. 第一个 ClipboardItem：私有元素 payload。
	 * 2. 后续 ClipboardItem：每个媒体 Blob 一个私有文件项。
	 * 3. 媒体 Blob 额外暴露自身原生 `image/*` / `video/*`，让用户可在外部应用按普通媒体粘贴。
	 */
	public static createClipboardItems(options: {
		payload: CanvasElementClipboardPayload
		files: CanvasElementClipboardWriteFile[]
	}): ClipboardItem[] {
		logCanvasElementClipboard("create-clipboard-items:start", {
			canvasId: options.payload.sourceCanvasId,
			elementCount: options.payload.elements.length,
			fileCount: options.files.length,
			fileMimeTypes: options.files.map((file) => file.metadata.mimeType),
			payload: options.payload,
			files: options.files.map((file) => ({
				metadata: file.metadata,
				blobContent: file.blob,
			})),
		})

		const payloadText = JSON.stringify(options.payload)
		const payloadItem = new ClipboardItem({
			[CANVAS_ELEMENT_CLIPBOARD_MIME_TYPE]: new Blob([payloadText], {
				type: CANVAS_ELEMENT_CLIPBOARD_MIME_TYPE,
			}),
		})

		const fileItems = options.files.map((file) => {
			const clipboardFile = buildFileFromBlob(file.blob, file.metadata)
			logCanvasElementClipboard("create-clipboard-items:file", {
				metadata: file.metadata,
				sourceBlobContent: file.blob,
				clipboardFileContent: clipboardFile,
			})
			const itemData: Record<string, Blob> = {
				[CANVAS_ELEMENT_FILE_BLOB_MIME_TYPE]: clipboardFile,
			}
			if (
				clipboardFile.type.startsWith("image/") ||
				clipboardFile.type.startsWith("video/")
			) {
				itemData[clipboardFile.type] = clipboardFile
			}
			return new ClipboardItem({
				...itemData,
			})
		})

		const clipboardItems = [payloadItem, ...fileItems]
		logCanvasElementClipboard("create-clipboard-items:done", {
			itemCount: clipboardItems.length,
			itemTypes: getClipboardItemTypes(clipboardItems),
		})

		return clipboardItems
	}

	public static async write(options: {
		payload: CanvasElementClipboardPayload
		files: CanvasElementClipboardWriteFile[]
		native?: CanvasElementClipboardNativeExposure
		clipboard?: CanvasElementClipboardBrowserOptions
	}): Promise<void> {
		logCanvasElementClipboard("protocol-write:start", {
			operation: options.payload.operation,
			canvasId: options.payload.sourceCanvasId,
			elementCount: options.payload.elements.length,
			fileCount: options.files.length,
			fileMimeTypes: options.files.map(({ metadata }) => metadata.mimeType),
			hasNativeExposure: Boolean(options.native),
			nativeMimeType: options.native?.mimeType,
			payload: options.payload,
			files: options.files.map((file) => ({
				metadata: file.metadata,
				blobContent: file.blob,
			})),
		})

		try {
			await CanvasDesignClipboard.writeBundle({
				payload: options.payload,
				files: options.files,
				native: options.native,
				clipboard: options.clipboard,
			})
			logCanvasElementClipboard("protocol-write:success", {
				operation: options.payload.operation,
				elementCount: options.payload.elements.length,
				fileCount: options.files.length,
				fileMimeTypes: options.files.map(({ metadata }) => metadata.mimeType),
			})
		} catch (error) {
			logCanvasElementClipboard("protocol-write:error", {
				operation: options.payload.operation,
				message: error instanceof Error ? error.message : String(error),
				error,
				payload: options.payload,
				files: options.files.map((file) => ({
					metadata: file.metadata,
					blobContent: file.blob,
				})),
			})
			throw error
		}
	}

	/**
	 * 读取 CanvasDesign 私有元素协议。
	 *
	 * 只识别 `CANVAS_ELEMENT_CLIPBOARD_MIME_TYPE`，不会读取旧文本 JSON、
	 * HTML 注释 metadata 或 legacy 自定义 MIME。
	 */
	public static async read(options?: {
		read?: () => Promise<ClipboardItem[]>
	}): Promise<CanvasElementClipboardReadResult | null> {
		const bundleResult = await CanvasDesignClipboard.readBundle(options)
		if (bundleResult) {
			logCanvasElementClipboard("read:bundle-result", {
				hasPayload: true,
				elementCount: bundleResult.payload.elements.length,
				fileMetadataCount: bundleResult.payload.files.length,
				fileCount: bundleResult.files.length,
			})
			return bundleResult
		}

		const items = await CanvasDesignClipboard.read(options, "read")
		if (!items) {
			return null
		}

		const result = await this.readFromClipboardItems(items)
		logCanvasElementClipboard("read:result", {
			hasPayload: Boolean(result),
			elementCount: result?.payload.elements.length ?? 0,
			fileMetadataCount: result?.payload.files.length ?? 0,
			fileCount: result?.files.length ?? 0,
		})
		return result
	}

	/**
	 * 粘贴解析统一入口。
	 *
	 * 优先级：
	 * 1. CanvasDesign 私有 payload + 私有媒体 Blob。
	 * 2. Ctrl/Cmd+V 路径如果已读到 payload 但 Clipboard API 未返回 Blob，
	 *    用同步 paste event 的 clipboardData.files/items 补齐。
	 * 3. 非 CanvasDesign 内容，按外部图片 / 视频文件处理。
	 *
	 * 菜单粘贴没有 ClipboardEvent，因此不会进入第 2 步，只能依赖 Clipboard API read()。
	 */
	public static async parseClipboardContent(
		clipboardEvent?: ClipboardEvent,
		options?: CanvasElementClipboardParseOptions,
	): Promise<CanvasElementClipboardParseResult> {
		try {
			logCanvasElementClipboard("parse:start", {
				hasClipboardEvent: Boolean(clipboardEvent),
				hasInjectedRead: Boolean(options?.read),
				pasteSource: options?.pasteSource,
			})

			const eventFilesSnapshot = CanvasDesignClipboard.readEventFilesSnapshot(
				clipboardEvent,
				"parse-event",
			)

			const bundleResult = await CanvasDesignClipboard.readBundle(options)
			if (bundleResult) {
				const canvasElementResult = this.parseCanvasElementClipboardReadResult(bundleResult)
				if (canvasElementResult) {
					logCanvasElementClipboard("parse:bundle-result", {
						pasteSource: options?.pasteSource,
						type: canvasElementResult.type,
						elementCount:
							canvasElementResult.type === "canvas-elements"
								? canvasElementResult.elements.length
								: 0,
						fileCount:
							canvasElementResult.type === "canvas-elements"
								? canvasElementResult.files.length
								: canvasElementResult.files.length,
					})
					return canvasElementResult
				}
			}

			const clipboardItems = await CanvasDesignClipboard.read(options, "parse-read")
			const canvasElementResult = await this.parseCanvasElementClipboardItems(clipboardItems)
			if (canvasElementResult) {
				if (canvasElementResult.type === "files") {
					logCanvasElementClipboard("parse:canvas-export-files", {
						pasteSource: options?.pasteSource,
						fileCount: canvasElementResult.files.length,
						fileMimeTypes: canvasElementResult.files.map((file) => file.type),
						files: canvasElementResult.files.map((file) => ({ fileContent: file })),
					})
					return canvasElementResult
				}

				if (eventFilesSnapshot.length > 0 && canvasElementResult.files.length === 0) {
					logCanvasElementClipboard("parse:hydrate-files-from-event", {
						pasteSource: options?.pasteSource,
						eventFileCount: eventFilesSnapshot.length,
						fileMetadataCount: canvasElementResult.fileMetadata.length,
						eventFiles: eventFilesSnapshot.map((file) => ({ fileContent: file })),
						fileMetadata: canvasElementResult.fileMetadata,
					})
					canvasElementResult.files = this.createFilesFromEventFiles(
						eventFilesSnapshot,
						canvasElementResult.fileMetadata,
					)
				}
				logCanvasElementClipboard("parse:canvas-elements", {
					pasteSource: options?.pasteSource,
					elementCount: canvasElementResult.elements.length,
					fileMetadataCount: canvasElementResult.fileMetadata.length,
					fileCount: canvasElementResult.files.length,
					elementsJson: canvasElementResult.elements,
					fileMetadata: canvasElementResult.fileMetadata,
					files: canvasElementResult.files.map(({ metadata, file }) => ({
						metadata,
						fileContent: file,
					})),
				})
				return canvasElementResult
			}

			if (eventFilesSnapshot.length > 0) {
				logCanvasElementClipboard("parse:event-files", {
					pasteSource: options?.pasteSource,
					fileCount: eventFilesSnapshot.length,
					fileMimeTypes: eventFilesSnapshot.map((file) => file.type),
					files: eventFilesSnapshot.map((file) => ({ fileContent: file })),
				})
				return { type: "files", files: eventFilesSnapshot }
			}

			const apiResult = await this.parseFilesFromClipboardItems(clipboardItems)
			if (apiResult) {
				logCanvasElementClipboard("parse:api-result", {
					pasteSource: options?.pasteSource,
					type: apiResult.type,
					fileCount: apiResult.type === "files" ? apiResult.files.length : 0,
					reason: apiResult.type === "invalid" ? apiResult.reason : undefined,
				})
				return apiResult
			}

			const filenameOnlyText = await CanvasDesignClipboard.readFilenameOnlyText(
				options,
				"parse-text",
			)
			if (filenameOnlyText) {
				return { type: "invalid", reason: "clipboard-filename-text-only" }
			}

			logCanvasElementClipboard("parse:empty", { pasteSource: options?.pasteSource })
			return { type: "empty" }
		} catch (error) {
			logCanvasElementClipboard("parse:error", {
				pasteSource: options?.pasteSource,
				message: error instanceof Error ? error.message : String(error),
			})
			return { type: "invalid", reason: error instanceof Error ? error.message : "未知错误" }
		}
	}

	private static parseCanvasElementClipboardReadResult(
		clipboard: CanvasElementClipboardReadResult,
	):
		| Extract<CanvasElementClipboardParseResult, { type: "canvas-elements" }>
		| Extract<CanvasElementClipboardParseResult, { type: "files" }>
		| null {
		const payload = normalizePayload(clipboard.payload)
		if (!payload) {
			logCanvasElementClipboard("parse-canvas-element:invalid-payload", {
				payload: clipboard.payload,
			})
			return null
		}
		const files = clipboard.files
			.map(({ metadata, file }) => {
				const normalizedMetadata = normalizeFileMetadata(metadata)
				return normalizedMetadata ? { metadata: normalizedMetadata, file } : null
			})
			.filter((file): file is CanvasElementClipboardFile => Boolean(file))

		logCanvasElementClipboard("parse-canvas-element:hit", {
			elementCount: payload.elements.length,
			fileMetadataCount: payload.files.length,
			fileCount: files.length,
			payload,
			files: files.map(({ metadata, file }) => ({
				metadata,
				fileContent: file,
			})),
		})

		if (payload.elements.length > 0) {
			return {
				type: "canvas-elements",
				elements: payload.elements,
				canvasId: payload.sourceCanvasId,
				files,
				fileMetadata: payload.files,
			}
		}

		logCanvasElementClipboard("parse-canvas-element:files-only", {
			fileCount: files.length,
			fileMimeTypes: files.map(({ file }) => file.type),
			operation: payload.operation,
			files: files.map(({ metadata, file }) => ({
				metadata,
				fileContent: file,
			})),
		})
		return files.length > 0
			? {
					type: "files",
					files: files.map(({ file }) => file),
				}
			: null
	}

	/**
	 * 将 paste event 中的 File[] 按 payload.files 顺序包回 CanvasDesign 文件结构。
	 *
	 * 这是对部分浏览器 / 系统场景的补齐：文件字节只在同步 ClipboardEvent 中可读，
	 * 但 CanvasDesign 元数据仍通过 Clipboard API 读取。
	 */
	public static createFilesFromEventFiles(
		files: File[],
		metadataList: CanvasElementClipboardFileMetadata[],
	): CanvasElementClipboardFile[] {
		const canvasFiles = files.slice(0, metadataList.length).map((file, index) => {
			const metadata = metadataList[index]
			const normalizedFile = new File([file], metadata.filename, {
				type: file.type || metadata.mimeType,
			})
			return {
				metadata,
				file:
					file.name.trim() === ""
						? markDefaultClipboardFilenameFile(normalizedFile)
						: normalizedFile,
			}
		})
		logCanvasElementClipboard("create-files-from-event", {
			inputFileCount: files.length,
			metadataCount: metadataList.length,
			outputFileCount: canvasFiles.length,
			fileMimeTypes: canvasFiles.map(({ file }) => file.type),
			inputFiles: files.map((file) => ({ fileContent: file })),
			outputFiles: canvasFiles.map(({ metadata, file }) => ({
				metadata,
				fileContent: file,
			})),
		})
		return canvasFiles
	}

	/**
	 * 读取非 CanvasDesign 的普通媒体 ClipboardItem。
	 *
	 * 仅作为外部图片 / 视频粘贴 fallback，不解析任何 CanvasDesign 元数据。
	 */
	public static async readExternalFileItem(item: ClipboardItem): Promise<File | null> {
		const mediaType = item.types.find(
			(type) => type.startsWith("image/") || type.startsWith("video/"),
		)
		if (!mediaType) {
			return null
		}

		try {
			const blob = await item.getType(mediaType)
			const file = markDefaultClipboardFilenameFile(
				new File([blob], getExternalClipboardFallbackFilename(mediaType), {
					type: mediaType,
				}),
			)
			const validFiles = validateAndFilterCanvasFiles([file])
			logCanvasElementClipboard("read-external-file-item", {
				mediaType,
				isValid: validFiles.length > 0,
				size: file.size,
				blobContent: blob,
				fileContent: file,
			})
			return validFiles[0] ?? null
		} catch (error) {
			logCanvasElementClipboard("read-external-file-item:error", {
				mediaType,
				message: error instanceof Error ? error.message : String(error),
			})
			return null
		}
	}

	/**
	 * 将私有协议读取结果转换为 paste 业务层可消费的解析结果。
	 */
	private static async parseCanvasElementClipboardItems(
		items: ClipboardItem[] | null,
	): Promise<
		| Extract<CanvasElementClipboardParseResult, { type: "canvas-elements" }>
		| Extract<CanvasElementClipboardParseResult, { type: "files" }>
		| null
	> {
		if (!items) {
			logCanvasElementClipboard("parse-canvas-element:skip-no-items")
			return null
		}

		const clipboard = await this.readFromClipboardItems(items)
		if (!clipboard) {
			logCanvasElementClipboard("parse-canvas-element:miss")
			return null
		}

		return this.parseCanvasElementClipboardReadResult(clipboard)
	}

	/**
	 * 从 Clipboard API 读取普通外部媒体文件。
	 *
	 * 该路径只处理 `image/*` / `video/*`，不会解析任何旧 CanvasDesign 文本或 HTML 格式。
	 */
	private static async parseFilesFromClipboardItems(
		items: ClipboardItem[] | null,
	): Promise<Extract<CanvasElementClipboardParseResult, { type: "files" | "invalid" }> | null> {
		if (!items) {
			logCanvasElementClipboard("parse-api:skip-no-items")
			return null
		}

		try {
			logCanvasElementClipboard("parse-api:items", {
				itemCount: items.length,
				itemTypes: getClipboardItemTypes(items),
			})
			const files: File[] = []

			for (const item of items) {
				const file = await this.readExternalFileItem(item)
				if (file) {
					files.push(file)
				}
			}

			const validFiles = validateAndFilterCanvasFiles(files)
			if (validFiles.length > 0) {
				logCanvasElementClipboard("parse-api:files", {
					fileCount: validFiles.length,
					fileMimeTypes: validFiles.map((file) => file.type),
					files: validFiles.map((file) => ({ fileContent: file })),
				})
				return { type: "files", files: validFiles }
			}

			if (items.some((item) => item.types.length === 0)) {
				logCanvasElementClipboard("parse-api:unreadable-items")
				return { type: "invalid", reason: "clipboard-api-unreadable-items" }
			}

			logCanvasElementClipboard("parse-api:empty")
			return null
		} catch (error) {
			logCanvasElementClipboard("parse-api:error", {
				message: error instanceof Error ? error.message : String(error),
			})
			return null
		}
	}

	/**
	 * 从 ClipboardItem[] 中读取 CanvasDesign 私有 payload 和媒体文件。
	 */
	public static async readFromClipboardItems(
		items: ClipboardItem[],
	): Promise<CanvasElementClipboardReadResult | null> {
		const payload = await this.readPayload(items)
		if (!payload) {
			logCanvasElementClipboard("read-items:no-payload", {
				itemCount: items.length,
				itemTypes: getClipboardItemTypes(items),
			})
			return null
		}

		const files = await this.readFiles(items, payload.files)
		logCanvasElementClipboard("read-items:done", {
			elementCount: payload.elements.length,
			fileMetadataCount: payload.files.length,
			fileCount: files.length,
			payload,
			files: files.map(({ metadata, file }) => ({
				metadata,
				fileContent: file,
			})),
		})
		return { payload, files }
	}

	/**
	 * 查找并解析主 payload ClipboardItem。
	 */
	public static async readPayload(
		items: ClipboardItem[],
	): Promise<CanvasElementClipboardPayload | null> {
		for (const item of items) {
			if (!item.types.includes(CANVAS_ELEMENT_CLIPBOARD_MIME_TYPE)) {
				continue
			}

			try {
				const blob = await item.getType(CANVAS_ELEMENT_CLIPBOARD_MIME_TYPE)
				const text = await blob.text()
				const payload = normalizePayload(JSON.parse(text))
				if (payload) {
					logCanvasElementClipboard("read-payload:hit", {
						elementCount: payload.elements.length,
						fileMetadataCount: payload.files.length,
						canvasId: payload.sourceCanvasId,
						rawJson: text,
						payload,
					})
					return payload
				}
				logCanvasElementClipboard("read-payload:invalid-shape")
			} catch (error) {
				logCanvasElementClipboard("read-payload:error", {
					message: error instanceof Error ? error.message : String(error),
				})
				// Ignore malformed CanvasDesign metadata and keep scanning other items.
			}
		}

		logCanvasElementClipboard("read-payload:miss")
		return null
	}

	/**
	 * 按 payload.files 顺序读取后续媒体 ClipboardItem。
	 *
	 * 当前协议通过写入顺序匹配文件；每个文件条目内仍保留 elementId，
	 * 业务层最终用 elementId 把文件绑定回对应元素。
	 */
	private static async readFiles(
		items: ClipboardItem[],
		metadataList: CanvasElementClipboardFileMetadata[],
	): Promise<CanvasElementClipboardFile[]> {
		if (metadataList.length === 0) {
			return []
		}

		const files: CanvasElementClipboardFile[] = []
		const fileItems = items.filter((item) =>
			item.types.some(
				(type) =>
					type === CANVAS_ELEMENT_FILE_BLOB_MIME_TYPE ||
					type.startsWith("image/") ||
					type.startsWith("video/"),
			),
		)
		logCanvasElementClipboard("read-files:start", {
			metadataCount: metadataList.length,
			fileItemCount: fileItems.length,
			fileItemTypes: getClipboardItemTypes(fileItems),
		})

		for (let i = 0; i < metadataList.length; i++) {
			const metadata = metadataList[i]
			const item = fileItems[i]
			if (!item) {
				continue
			}

			const file = await this.readFileFromItem(item, metadata)
			if (file) {
				files.push({ metadata, file })
			}
		}

		logCanvasElementClipboard("read-files:done", {
			fileCount: files.length,
			fileMimeTypes: files.map(({ file }) => file.type),
			fileElementIds: files.map(({ metadata }) => metadata.elementId),
			files: files.map(({ metadata, file }) => ({
				metadata,
				fileContent: file,
			})),
		})
		return files
	}

	/**
	 * 从单个媒体 ClipboardItem 还原 File。
	 *
	 * 优先读取原生 MIME，其次读取私有文件 MIME；读取私有 MIME 时使用 metadata.mimeType
	 * 重新构造 File，避免浏览器把私有 Blob 的 type 当成业务文件类型。
	 */
	private static async readFileFromItem(
		item: ClipboardItem,
		metadata: CanvasElementClipboardFileMetadata,
	): Promise<File | null> {
		const preferredType = item.types.find((type) => type === metadata.mimeType)
		const mediaType =
			preferredType ??
			item.types.find((type) => type === CANVAS_ELEMENT_FILE_BLOB_MIME_TYPE) ??
			item.types.find((type) => type.startsWith("image/") || type.startsWith("video/"))
		if (!mediaType) {
			return null
		}

		try {
			const blob = await item.getType(mediaType)
			const file =
				mediaType === CANVAS_ELEMENT_FILE_BLOB_MIME_TYPE
					? new File([blob], sanitizeFilename(metadata.filename, metadata.mimeType), {
							type: metadata.mimeType,
						})
					: buildFileFromBlob(blob, metadata)
			const validFiles = validateAndFilterCanvasFiles([file])
			logCanvasElementClipboard("read-file-item", {
				elementId: metadata.elementId,
				requestedMimeType: metadata.mimeType,
				selectedMimeType: mediaType,
				isPrivateBlob: mediaType === CANVAS_ELEMENT_FILE_BLOB_MIME_TYPE,
				isValid: validFiles.length > 0,
				size: file.size,
				metadata,
				blobContent: blob,
				fileContent: file,
			})
			return validFiles[0] ?? null
		} catch (error) {
			logCanvasElementClipboard("read-file-item:error", {
				elementId: metadata.elementId,
				requestedMimeType: metadata.mimeType,
				message: error instanceof Error ? error.message : String(error),
			})
			return null
		}
	}
}
