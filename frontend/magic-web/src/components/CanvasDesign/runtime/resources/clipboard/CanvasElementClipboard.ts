import type { CanvasConnection, CanvasFileElement, LayerElement } from "../../document/types"
import { ElementTypeEnum } from "../../document/types"
import {
	CanvasDesignClipboard,
	type CanvasDesignClipboardNativeExposure,
	type CanvasDesignClipboardOptions,
} from "./CanvasDesignClipboard"
import { getFileExtensionFromMimeType, validateAndFilterCanvasFiles } from "../../shared/ids"
import { isValidElementData } from "../../document/validateElement"
import { isCanvasClipboardPayloadWithinLimits } from "./clipboardLimits"

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
 * `elementId` 和顺序进行匹配。媒体项会额外写入自身原生 `image/*` / `video/*` / `audio/*` MIME，
 * 用于外部应用互操作。
 */
export const CANVAS_ELEMENT_FILE_BLOB_MIME_TYPE = "web application/x-canvas-design-file"

export const CANVAS_ELEMENT_CLIPBOARD_SOURCE = "canvas-design"
export const CANVAS_ELEMENT_CLIPBOARD_VERSION = 1
const DEFAULT_CLIPBOARD_FILENAME_FILE_FLAG = "__canvasDesignDefaultClipboardFilename"

export type CanvasElementClipboardOperation = "copy-elements" | "copy-as-png"
export type CanvasElementClipboardPasteSource = "keyboard" | "menu"
export type CanvasElementClipboardBrowserOptions = CanvasDesignClipboardOptions
export type CanvasElementClipboardNativeExposure = CanvasDesignClipboardNativeExposure

export interface CanvasElementClipboardFileMetadata {
	/** 单次剪贴板 payload 内的文件索引 ID，不要求跨复制稳定 */
	id: string
	/** 对应的原始元素 ID；画布导出文件没有源元素时使用导出 ID */
	elementId: string
	/** 源项目 ID；用于区分同项目跨画布与跨项目资源 */
	sourceProjectId?: string
	/** 源项目文件 ID；用于 Host 侧服务端复制 */
	sourceFileId?: string
	/** 项目绝对路径；MessageEditor 可直接作为项目文件引用 */
	projectPath?: string
	/** 写入剪贴板时保留的文件名，用于上传和元素命名 */
	filename: string
	/** 原始 Blob 的 MIME，用于从私有 Blob 还原 File */
	mimeType: string
	/** 文件大小；未下载 Blob 时允许为 0，作为 unknown 处理 */
	fileSize: number
	/** 文件来源角色：元素媒体文件用于恢复元素，画布导出文件用于按普通文件粘贴，生成资源用于跨画布重建请求依赖 */
	role: "element-media" | "canvas-export" | "generation-resource"
	/** 生成请求中的原始资源路径；仅 generation-resource 使用 */
	resourcePath?: string
	/** 源画布 resolver 计算出的资源 identity；目标画布不得重新解释源路径。 */
	resourceIdentity?: string
	/** 本次复制元素数据中实际出现过的同资源路径写法。 */
	resourceAliases?: string[]
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
	/** 来源项目 ID；缺失时目标侧必须保守降级 */
	sourceProjectId?: string
	elements: LayerElement[]
	files: CanvasElementClipboardFileMetadata[]
	/** 复制内容内部的持久化连接；旧 payload 缺少该字段时按空数组处理。 */
	connections?: CanvasConnection[]
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
			connections: CanvasConnection[]
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

function normalizeClipboardMimeType(value: string): string {
	return value.trim().toLowerCase()
}

function isCanvasFileElement(element: LayerElement): element is CanvasFileElement {
	return (
		element.type === ElementTypeEnum.Image ||
		element.type === ElementTypeEnum.Video ||
		element.type === ElementTypeEnum.Audio
	)
}

function isClipboardBlobBackedMetadata(metadata: CanvasElementClipboardFileMetadata): boolean {
	return metadata.role === "element-media" || metadata.role === "canvas-export"
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
	const basename = mediaType.startsWith("video/")
		? "video"
		: mediaType.startsWith("audio/")
			? "audio"
			: "image"
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
	if (
		!isCanvasClipboardPayloadWithinLimits({
			elements: data.elements,
			files: data.files,
			connections: data.connections,
		})
	) {
		return null
	}
	if (data.sourceProjectId !== undefined && typeof data.sourceProjectId !== "string") {
		return null
	}

	const elements = data.elements.filter(isValidElementData)
	const operation = isCanvasElementClipboardOperation(data.operation)
		? data.operation
		: "copy-elements"
	const files = data.files
		.map(normalizeFileMetadata)
		.filter((file): file is CanvasElementClipboardFileMetadata => Boolean(file))
	const connections = operation === "copy-elements" ? normalizeConnections(data.connections) : []

	if (elements.length === 0 && !files.some((file) => file.role === "canvas-export")) {
		return null
	}

	return {
		source: CANVAS_ELEMENT_CLIPBOARD_SOURCE,
		version: CANVAS_ELEMENT_CLIPBOARD_VERSION,
		operation,
		sourceCanvasId: getPayloadSourceCanvasId(data),
		sourceProjectId:
			typeof data.sourceProjectId === "string" ? data.sourceProjectId : undefined,
		elements,
		files,
		connections: connections.length > 0 ? connections : undefined,
	}
}

function normalizeConnections(value: unknown): CanvasConnection[] {
	if (!Array.isArray(value)) return []

	const seenIds = new Set<string>()
	const seenPairs = new Set<string>()
	const connections: CanvasConnection[] = []

	for (const item of value) {
		if (!isRecord(item)) continue
		if (
			typeof item.id !== "string" ||
			typeof item.sourceElementId !== "string" ||
			typeof item.targetElementId !== "string"
		) {
			continue
		}
		if (
			item.id.length === 0 ||
			item.sourceElementId.length === 0 ||
			item.targetElementId.length === 0 ||
			item.sourceElementId === item.targetElementId ||
			seenIds.has(item.id)
		) {
			continue
		}

		const pair = `${item.sourceElementId}\u0000${item.targetElementId}`
		const reversePair = `${item.targetElementId}\u0000${item.sourceElementId}`
		if (seenPairs.has(pair) || seenPairs.has(reversePair)) continue

		seenIds.add(item.id)
		seenPairs.add(pair)
		connections.push({
			id: item.id,
			sourceElementId: item.sourceElementId,
			targetElementId: item.targetElementId,
		})
	}

	return connections
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
	if (!Number.isFinite(file.fileSize) || file.fileSize < 0) {
		return null
	}

	const role = file.role ?? file.fileRole
	if (role !== "element-media" && role !== "canvas-export" && role !== "generation-resource") {
		return null
	}

	return {
		id: file.id,
		elementId: file.elementId,
		sourceProjectId:
			typeof file.sourceProjectId === "string" ? file.sourceProjectId : undefined,
		sourceFileId: typeof file.sourceFileId === "string" ? file.sourceFileId : undefined,
		projectPath: typeof file.projectPath === "string" ? file.projectPath : undefined,
		filename: file.filename,
		mimeType: file.mimeType,
		fileSize: file.fileSize,
		role,
		resourcePath: typeof file.resourcePath === "string" ? file.resourcePath : undefined,
		resourceIdentity:
			typeof file.resourceIdentity === "string" ? file.resourceIdentity : undefined,
		resourceAliases: Array.isArray(file.resourceAliases)
			? Array.from(
					new Set(
						file.resourceAliases
							.filter((alias): alias is string => typeof alias === "string")
							.map((alias) => alias.trim())
							.filter(Boolean),
					),
				).slice(0, 128)
			: undefined,
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
		projectId?: string
		files: CanvasElementClipboardFileMetadata[]
		operation: CanvasElementClipboardOperation
		connections?: CanvasConnection[]
	}): CanvasElementClipboardPayload {
		const connections =
			options.operation === "copy-elements" && options.connections?.length
				? options.connections
				: undefined
		const payload: CanvasElementClipboardPayload = {
			source: CANVAS_ELEMENT_CLIPBOARD_SOURCE,
			version: CANVAS_ELEMENT_CLIPBOARD_VERSION,
			operation: options.operation,
			sourceCanvasId: options.canvasId,
			sourceProjectId: options.projectId,
			elements: options.elements,
			files: options.files,
			connections,
		}

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
		resourceIdentity?: string
		sourceProjectId?: string
		sourceFileId?: string
		projectPath?: string
		resourceAliases?: string[]
		sourceRef?: CanvasElementClipboardFileMetadata["sourceRef"]
	}): CanvasElementClipboardFileMetadata {
		return {
			id: options.fileId,
			elementId: options.element.id,
			sourceProjectId: options.sourceProjectId,
			sourceFileId: options.sourceFileId,
			projectPath: options.projectPath,
			filename: sanitizeFilename(options.filename, options.mimeType),
			mimeType: options.mimeType,
			fileSize: options.fileSize,
			role: "element-media",
			resourceIdentity: options.resourceIdentity,
			resourceAliases: options.resourceAliases,
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
		resourceIdentity?: string
		sourceProjectId?: string
		sourceFileId?: string
		projectPath?: string
		resourceAliases?: string[]
		sourceRef?: CanvasElementClipboardFileMetadata["sourceRef"]
	}): CanvasElementClipboardFileMetadata {
		return {
			id: options.fileId,
			elementId: options.fileId,
			sourceProjectId: options.sourceProjectId,
			sourceFileId: options.sourceFileId,
			projectPath: options.projectPath,
			filename: sanitizeFilename(options.filename, options.mimeType),
			mimeType: options.mimeType,
			fileSize: options.fileSize,
			role: "canvas-export",
			resourceIdentity: options.resourceIdentity,
			resourceAliases: options.resourceAliases,
			sourceRef: options.sourceRef,
		}
	}

	/**
	 * 创建生成请求依赖资源索引元数据。
	 *
	 * 这类资源不对应可见元素，只用于跨画布粘贴时把隐藏依赖迁移到目标画布并重写请求路径。
	 */
	public static createGenerationResourceMetadata(options: {
		fileId: string
		resourcePath: string
		resourceIdentity: string
		resourceAliases: string[]
		sourceProjectId?: string
		sourceFileId?: string
		projectPath?: string
		filename: string
		mimeType: string
		fileSize: number
		sourceRef?: CanvasElementClipboardFileMetadata["sourceRef"]
	}): CanvasElementClipboardFileMetadata {
		return {
			id: options.fileId,
			elementId: options.fileId,
			sourceProjectId: options.sourceProjectId,
			sourceFileId: options.sourceFileId,
			projectPath: options.projectPath,
			filename: sanitizeFilename(options.filename, options.mimeType),
			mimeType: options.mimeType,
			fileSize: options.fileSize,
			role: "generation-resource",
			resourcePath: options.resourcePath,
			resourceIdentity: options.resourceIdentity,
			resourceAliases: options.resourceAliases,
			sourceRef: options.sourceRef,
		}
	}

	/**
	 * 将 CanvasDesign 元素 payload 和媒体 Blob 组装成浏览器 ClipboardItem[]。
	 *
	 * 写入形态：
	 * 1. 第一个 ClipboardItem：私有元素 payload。
	 * 2. 后续 ClipboardItem：每个媒体 Blob 一个私有文件项。
	 * 3. 媒体 Blob 额外暴露自身原生 `image/*` / `video/*` / `audio/*`，让用户可在外部应用按普通媒体粘贴。
	 */
	public static createClipboardItems(options: {
		payload: CanvasElementClipboardPayload
		files: CanvasElementClipboardWriteFile[]
	}): ClipboardItem[] {
		const payloadText = JSON.stringify(options.payload)
		const payloadItem = new ClipboardItem({
			[CANVAS_ELEMENT_CLIPBOARD_MIME_TYPE]: new Blob([payloadText], {
				type: CANVAS_ELEMENT_CLIPBOARD_MIME_TYPE,
			}),
		})

		const fileItems = options.files.map((file) => {
			const clipboardFile = buildFileFromBlob(file.blob, file.metadata)
			const itemData: Record<string, Blob> = {
				[CANVAS_ELEMENT_FILE_BLOB_MIME_TYPE]: clipboardFile,
			}
			if (
				clipboardFile.type.startsWith("image/") ||
				clipboardFile.type.startsWith("video/") ||
				clipboardFile.type.startsWith("audio/")
			) {
				itemData[clipboardFile.type] = clipboardFile
			}
			return new ClipboardItem({
				...itemData,
			})
		})

		const clipboardItems = [payloadItem, ...fileItems]

		return clipboardItems
	}

	public static async write(options: {
		payload: CanvasElementClipboardPayload
		files: CanvasElementClipboardWriteFile[]
		native?: CanvasElementClipboardNativeExposure
		clipboard?: CanvasElementClipboardBrowserOptions
	}): Promise<void> {
		await CanvasDesignClipboard.writeBundle({
			payload: options.payload,
			files: options.files,
			native: options.native,
			clipboard: options.clipboard,
		})
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
		const items = await CanvasDesignClipboard.read(options)
		const bundleResult = await CanvasDesignClipboard.readBundleFromItems(items)
		if (bundleResult) {
			return bundleResult
		}

		if (!items) {
			return null
		}

		const result = await this.readFromClipboardItems(items)
		return result
	}

	/**
	 * 粘贴解析统一入口。
	 *
	 * 优先级：
	 * 1. CanvasDesign 私有 payload + 私有媒体 Blob。
	 * 2. Ctrl/Cmd+V 路径如果已读到 payload 但 Clipboard API 未返回 Blob，
	 *    用同步 paste event 的 clipboardData.files/items 补齐。
	 * 3. 非 CanvasDesign 内容，按外部图片 / 视频 / 音频文件处理。
	 *
	 * 菜单粘贴没有 ClipboardEvent，因此不会进入第 2 步，只能依赖 Clipboard API read()。
	 */
	public static async parseClipboardContent(
		clipboardEvent?: ClipboardEvent,
		options?: CanvasElementClipboardParseOptions,
	): Promise<CanvasElementClipboardParseResult> {
		try {
			const eventFilesSnapshot = CanvasDesignClipboard.readEventFilesSnapshot(clipboardEvent)

			const clipboardItems = await CanvasDesignClipboard.read(options)
			const bundleResult = await CanvasDesignClipboard.readBundleFromItems(clipboardItems)
			if (bundleResult) {
				const canvasElementResult = this.parseCanvasElementClipboardReadResult(bundleResult)
				if (canvasElementResult) {
					return canvasElementResult
				}
			}

			const canvasElementResult = await this.parseCanvasElementClipboardItems(clipboardItems)
			if (canvasElementResult) {
				if (canvasElementResult.type === "files") {
					return canvasElementResult
				}

				if (eventFilesSnapshot.length > 0 && canvasElementResult.files.length === 0) {
					canvasElementResult.files = this.createFilesFromEventFiles(
						eventFilesSnapshot,
						canvasElementResult.fileMetadata,
					)
				}
				return canvasElementResult
			}

			if (eventFilesSnapshot.length > 0) {
				return { type: "files", files: eventFilesSnapshot }
			}

			const apiResult = await this.parseFilesFromClipboardItems(clipboardItems)
			if (apiResult) {
				return apiResult
			}

			const filenameOnlyText = await CanvasDesignClipboard.readFilenameOnlyText(options)
			if (filenameOnlyText) {
				return { type: "invalid", reason: "clipboard-filename-text-only" }
			}

			return { type: "empty" }
		} catch (error) {
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
			return null
		}
		const files = clipboard.files
			.map(({ metadata, file }) => {
				const normalizedMetadata = normalizeFileMetadata(metadata)
				return normalizedMetadata ? { metadata: normalizedMetadata, file } : null
			})
			.filter((file): file is CanvasElementClipboardFile => Boolean(file))

		if (payload.elements.length > 0) {
			return {
				type: "canvas-elements",
				elements: payload.elements,
				connections: payload.connections ?? [],
				canvasId: payload.sourceCanvasId,
				files,
				fileMetadata: payload.files,
			}
		}

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
		const blobBackedMetadata = metadataList.filter(isClipboardBlobBackedMetadata)
		const canvasFiles = files.slice(0, blobBackedMetadata.length).map((file, index) => {
			const metadata = blobBackedMetadata[index]
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
		return canvasFiles
	}

	/**
	 * 读取非 CanvasDesign 的普通媒体 ClipboardItem。
	 *
	 * 仅作为外部图片 / 视频 / 音频粘贴 fallback，不解析任何 CanvasDesign 元数据。
	 */
	public static async readExternalFileItem(item: ClipboardItem): Promise<File | null> {
		const mediaType = item.types.find((type) => {
			const normalized = normalizeClipboardMimeType(type)
			return (
				normalized.startsWith("image/") ||
				normalized.startsWith("video/") ||
				normalized.startsWith("audio/")
			)
		})
		if (!mediaType) {
			return null
		}

		try {
			const blob = await item.getType(mediaType)
			const normalizedMediaType = normalizeClipboardMimeType(mediaType)
			const file = markDefaultClipboardFilenameFile(
				new File([blob], getExternalClipboardFallbackFilename(normalizedMediaType), {
					type: normalizedMediaType,
				}),
			)
			const validFiles = validateAndFilterCanvasFiles([file])
			return validFiles[0] ?? null
		} catch (error) {
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
			return null
		}

		const clipboard = await this.readFromClipboardItems(items)
		if (!clipboard) {
			return null
		}

		return this.parseCanvasElementClipboardReadResult(clipboard)
	}

	/**
	 * 从 Clipboard API 读取普通外部媒体文件。
	 *
	 * 该路径只处理 `image/*` / `video/*` / `audio/*`，不会解析任何旧 CanvasDesign 文本或 HTML 格式。
	 */
	private static async parseFilesFromClipboardItems(
		items: ClipboardItem[] | null,
	): Promise<Extract<CanvasElementClipboardParseResult, { type: "files" | "invalid" }> | null> {
		if (!items) {
			return null
		}

		try {
			const files: File[] = []

			for (const item of items) {
				const file = await this.readExternalFileItem(item)
				if (file) {
					files.push(file)
				}
			}

			const validFiles = validateAndFilterCanvasFiles(files)
			if (validFiles.length > 0) {
				return { type: "files", files: validFiles }
			}

			if (items.some((item) => item.types.length === 0)) {
				return { type: "invalid", reason: "clipboard-api-unreadable-items" }
			}

			return null
		} catch (error) {
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
			return null
		}

		const files = await this.readFiles(items, payload.files)
		return { payload, files }
	}

	/**
	 * 查找并解析主 payload ClipboardItem。
	 */
	public static async readPayload(
		items: ClipboardItem[],
	): Promise<CanvasElementClipboardPayload | null> {
		for (const item of items) {
			const payloadType = item.types.find(
				(type) => normalizeClipboardMimeType(type) === CANVAS_ELEMENT_CLIPBOARD_MIME_TYPE,
			)
			if (!payloadType) {
				continue
			}

			try {
				const blob = await item.getType(payloadType)
				const text = await blob.text()
				const payload = normalizePayload(JSON.parse(text))
				if (payload) {
					return payload
				}
			} catch (error) {
				// Ignore malformed CanvasDesign metadata and keep scanning other items.
			}
		}

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
		const blobBackedMetadata = metadataList.filter(isClipboardBlobBackedMetadata)
		if (blobBackedMetadata.length === 0) {
			return []
		}

		const files: CanvasElementClipboardFile[] = []
		const fileItems = items.filter((item) =>
			item.types.some((type) => {
				const normalized = normalizeClipboardMimeType(type)
				return (
					normalized === CANVAS_ELEMENT_FILE_BLOB_MIME_TYPE ||
					normalized.startsWith("image/") ||
					normalized.startsWith("video/") ||
					normalized.startsWith("audio/")
				)
			}),
		)

		for (let i = 0; i < blobBackedMetadata.length; i++) {
			const metadata = blobBackedMetadata[i]
			const item = fileItems[i]
			if (!item) {
				continue
			}

			const file = await this.readFileFromItem(item, metadata)
			if (file) {
				files.push({ metadata, file })
			}
		}

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
		const preferredType = item.types.find(
			(type) =>
				normalizeClipboardMimeType(type) === normalizeClipboardMimeType(metadata.mimeType),
		)
		const mediaType =
			preferredType ??
			item.types.find(
				(type) => normalizeClipboardMimeType(type) === CANVAS_ELEMENT_FILE_BLOB_MIME_TYPE,
			) ??
			item.types.find((type) => {
				const normalized = normalizeClipboardMimeType(type)
				return (
					normalized.startsWith("image/") ||
					normalized.startsWith("video/") ||
					normalized.startsWith("audio/")
				)
			})
		if (!mediaType) {
			return null
		}

		try {
			const blob = await item.getType(mediaType)
			const file =
				normalizeClipboardMimeType(mediaType) === CANVAS_ELEMENT_FILE_BLOB_MIME_TYPE
					? new File([blob], sanitizeFilename(metadata.filename, metadata.mimeType), {
							type: metadata.mimeType,
						})
					: buildFileFromBlob(blob, metadata)
			const validFiles = validateAndFilterCanvasFiles([file])
			return validFiles[0] ?? null
		} catch (error) {
			return null
		}
	}
}
