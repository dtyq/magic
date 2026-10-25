import { getMagicProjectType, type MagicProjectPreviewKind } from "@/constants/magicProjectTypes"
import { getFileType } from "@/pages/superMagic/utils/handleFIle"
import {
	DetailType,
	type SelfMediaInitialNavigation,
	type AICardInitialNavigation,
} from "../../../types"
import type { FileItem } from "../types"
import { isMagicProjectConfigFile } from "@/pages/superMagic/components/MessageList/components/MessageAttachment/utils"
import { normalizeAttachmentPath } from "../hooks/previewPolicy"
import { isAudioFolderRootRenderEnabled } from "../../../utils/file"
import { shouldPreserveLegacyToolContentDetail } from "./legacyToolDetailCompatibility"

/** 易被误标为文本、进而拉取/序列化大资源导致卡顿的 detail 类型 */
const TEXT_LIKE_DETAIL_TYPES: string[] = [DetailType.Text, DetailType.Md, DetailType.Code]

interface CorrectDetailTypeOptions {
	attachmentList?: readonly AttachmentNode[]
	isAttachmentListReady?: boolean
}

interface AttachmentNode {
	file_id?: string | number
	file_name?: string
	file_extension?: string
	relative_file_path?: string
	display_config?: Record<string, unknown>
}

interface HistoricalToolDetail {
	type?: string
	data?: Record<string, unknown>
	[key: string]: unknown
}

function normalizeFileId(fileId: unknown): string {
	if (typeof fileId === "string" && fileId.trim()) return fileId.trim()
	if (typeof fileId === "number" && Number.isFinite(fileId)) return String(fileId)
	return ""
}

// 文件型 ToolDetail 至少包含 file_name；file_id 不能单独证明它属于项目附件树。
function resolveDetailFileName(data: Record<string, unknown>): string {
	return typeof data.file_name === "string" ? data.file_name.trim() : ""
}

function isNonWorkspaceFile(data: Record<string, unknown>): boolean {
	const storageType = data.storage_type
	return typeof storageType === "string" && storageType !== "workspace"
}

function resolveHistoricalFileDetail(
	detail: HistoricalToolDetail,
	options?: CorrectDetailTypeOptions,
): HistoricalToolDetail {
	// 首屏附件列表可能暂时为空，只有加载完成后才能把缺失判定为删除。
	if (!detail?.data || options?.isAttachmentListReady !== true) return detail
	// Browser 类型使用临时截图生命周期；传 output_path 的工作区截图会以 Image 类型返回。
	if (detail.type === DetailType.Browser) return detail
	// 工具消息正文和临时截图不属于项目附件树。
	if (isNonWorkspaceFile(detail.data)) return detail
	// 仅保留旧版工具内容详情；这是历史协议兼容，不参与正常文件判断。
	if (shouldPreserveLegacyToolContentDetail(detail)) return detail

	const fileName = resolveDetailFileName(detail.data)
	if (!fileName) return detail

	const attachments = options.attachmentList || []
	const fileId = normalizeFileId(detail.data.file_id)
	const workspacePath = normalizeAttachmentPath(detail.data.relative_file_path)
	if (!fileId && !workspacePath) return detail

	const attachmentById = fileId
		? attachments.find((item) => normalizeFileId(item.file_id) === fileId)
		: undefined
	const attachment =
		attachmentById ||
		(workspacePath
			? attachments.find(
					(item) =>
						Boolean(normalizeFileId(item.file_id)) &&
						normalizeAttachmentPath(item.relative_file_path) === workspacePath,
				)
			: undefined)

	if (!attachment) {
		return {
			...detail,
			type: DetailType.Deleted,
			data: {
				...detail.data,
				file_id: fileId,
				file_name: fileName,
				file_extension:
					detail.data.file_extension || inferFileExtensionFromDetailData(detail.data),
				content: null,
			},
		}
	}

	return {
		...detail,
		data: {
			...detail.data,
			file_id: normalizeFileId(attachment.file_id),
			file_extension:
				detail.data.file_extension ||
				attachment.file_extension ||
				inferFileExtensionFromDetailData(detail.data),
		},
	}
}

function inferFileExtensionFromDetailData(data: any): string {
	if (!data) return ""
	if (data.file_extension) return String(data.file_extension).toLowerCase().replace(/^\./, "")
	const name = String(data.file_name || "")
	const dot = name.lastIndexOf(".")
	if (dot === -1 || dot === name.length - 1) return ""
	return name.slice(dot + 1).toLowerCase()
}

function hasDisplayConfig(displayConfig: unknown): displayConfig is Record<string, unknown> {
	return (
		!!displayConfig &&
		typeof displayConfig === "object" &&
		Object.keys(displayConfig).length > 0
	)
}

function findAttachmentDisplayConfigByFileId(
	items: AttachmentNode[] | undefined,
	fileId: string,
): Record<string, unknown> | null {
	if (!items?.length || !fileId) return null

	for (const item of items) {
		if (item?.file_id === fileId && hasDisplayConfig(item?.display_config))
			return item.display_config
	}

	return null
}

function resolveDetailMetadata(detail: any, options?: CorrectDetailTypeOptions): any {
	const fileId = detail?.data?.file_id
	if (!fileId || hasDisplayConfig(detail?.data?.display_config)) return detail

	const displayConfig = findAttachmentDisplayConfigByFileId(
		options?.attachmentList as AttachmentNode[] | undefined,
		fileId,
	)

	if (!displayConfig) return detail

	return {
		...detail,
		data: {
			...detail.data,
			display_config: displayConfig,
		},
	}
}

/**
 * 内容类型渲染配置
 * 用于定义哪些 display_config.type 应该使用独立的内容渲染组件，不依赖文件内容
 */
export interface ContentTypeRenderConfig {
	/** display_config.type 的值 */
	displayConfigType: string

	/** 对应的 DetailType */
	detailType: DetailType

	/** 数据转换器，将文件项转换为渲染组件需要的数据格式 */
	dataTransformer?: (item: FileItem) => Record<string, unknown>

	/** 优先级，数字越大优先级越高 */
	priority?: number
}

/**
 * Design 类型的数据转换器
 * 将文件项转换为 Design 组件需要的数据格式
 */
function designDataTransformer(item: FileItem) {
	const fileName = item.display_filename || item.file_name || item.filename
	return {
		file_name: fileName,
		name: fileName,
		is_directory: item.is_directory,
		children: item.children,
		display_config: item.display_config,
	}
}

/** PPT 项目目录转换器，通过 DetailType.Html 复用 PPTRootRender。 */
function slideDataTransformer(item: FileItem) {
	const fileName = item.display_filename || item.file_name || item.filename
	return {
		file_name: fileName,
		name: fileName,
		is_directory: item.is_directory,
		children: item.children,
		// Callers merge transformed data over the full attachment node. Omitting missing
		// path fields prevents an incomplete adapter from erasing valid PPT metadata.
		...(item.relative_file_path !== undefined
			? { relative_file_path: item.relative_file_path }
			: {}),
		...(item.parent_id !== undefined ? { parent_id: item.parent_id } : {}),
		display_config: item.display_config,
	}
}

/** Audio bundle transformer keeps the folder or legacy HTML entry metadata for AudioRootRender. */
function audioDataTransformer(item: FileItem) {
	const fileName = item.display_filename || item.file_name || item.filename
	return {
		file_name: fileName,
		name: fileName,
		is_directory: item.is_directory,
		children: item.children,
		...(item.relative_file_path !== undefined
			? { relative_file_path: item.relative_file_path }
			: {}),
		...(item.parent_id !== undefined ? { parent_id: item.parent_id } : {}),
		display_config: item.display_config,
	}
}

function slidesTemplateDataTransformer(item: FileItem) {
	return {
		file_name: item.display_filename || item.file_name || item.filename,
		name: item.display_filename || item.file_name || item.filename,
		is_directory: true,
		children: item.children,
		relative_file_path: item.relative_file_path,
		parent_id: item.parent_id,
		display_config: item.display_config,
	}
}

/**
 * Self-media folder transformer. Platforms are now expressed as keys
 * under the top-level `self-media` map (e.g. `rednote`, `instagram`),
 * so no single platform is surfaced here — the RootRender owns the
 * switcher. We still forward the raw metadata for downstream use.
 */
function selfMediaDataTransformer(item: FileItem) {
	const fileName = item.display_filename || item.file_name || item.filename
	const extra = item as FileItem & { initialNavigation?: SelfMediaInitialNavigation }
	return {
		file_name: fileName,
		name: fileName,
		is_directory: item.is_directory,
		children: item.children,
		display_config: item.display_config,
		...(extra.initialNavigation ? { initialNavigation: extra.initialNavigation } : {}),
	}
}

/**
 * AI Card folder transformer.
 */
function aiCardDataTransformer(item: FileItem) {
	const fileName = item.display_filename || item.file_name || item.filename
	const extra = item as FileItem & { initialNavigation?: AICardInitialNavigation }
	return {
		file_name: fileName,
		name: fileName,
		is_directory: item.is_directory,
		children: item.children,
		display_config: item.display_config,
		...(extra.initialNavigation ? { initialNavigation: extra.initialNavigation } : {}),
	}
}

/**
 * 内容类型渲染配置列表
 * 这些内容类型不依赖文件内容，有自己的 detail render content
 */
const contentTypeRenderConfigs = {
	audio: {
		displayConfigType: "audio",
		detailType: DetailType.Html,
		dataTransformer: audioDataTransformer,
		priority: 10,
	},
	slide: {
		displayConfigType: "slide",
		detailType: DetailType.Html,
		dataTransformer: slideDataTransformer,
		priority: 10,
	},
	"slide-template": {
		displayConfigType: "slide-template",
		detailType: DetailType.SlidesTemplate,
		dataTransformer: slidesTemplateDataTransformer,
		priority: 20,
	},
	design: {
		displayConfigType: "design",
		detailType: DetailType.Design,
		dataTransformer: designDataTransformer,
		priority: 10,
	},
	"self-media": {
		displayConfigType: "self-media",
		detailType: DetailType.SelfMedia,
		dataTransformer: selfMediaDataTransformer,
		priority: 10,
	},
	"ai-card": {
		displayConfigType: "ai-card",
		detailType: DetailType.AICard,
		dataTransformer: aiCardDataTransformer,
		priority: 10,
	},
} satisfies Record<MagicProjectPreviewKind, ContentTypeRenderConfig>

/**
 * 检测文件/文件夹是否应该使用内容类型渲染
 * 这种渲染不依赖文件内容，有自己的 detail render content
 */
export function detectContentTypeRender(item: FileItem): ContentTypeRenderConfig | null {
	if (item.display_config?.type === "audio" && !isAudioFolderRootRenderEnabled()) {
		return null
	}
	if (!item.display_config?.type) {
		return null
	}

	// magic.project.js 应始终以代码模式打开，不参与内容类型渲染
	const fileName = item.file_name || item.display_filename || item.filename
	if (isMagicProjectConfigFile(fileName)) {
		return null
	}

	const previewKind = getMagicProjectType(item.display_config.type)?.previewKind
	return previewKind ? contentTypeRenderConfigs[previewKind] : null
}

/**
 * 修正 detail 对象的类型
 * 如果 display_config.type 是 design 但 type 是 notSupport，需要修正
 * @param _detail - 待修正的 detail 对象
 * @returns 修正后的 detail 对象
 */
export function correctDetailType(_detail: any, options?: CorrectDetailTypeOptions): any {
	if (!_detail) return _detail

	// magic.project.js 保持为代码模式
	const detail = resolveDetailMetadata(resolveHistoricalFileDetail(_detail, options), options)
	const fileName = detail?.data?.file_name || detail?.data?.display_filename
	if (isMagicProjectConfigFile(fileName)) {
		return detail
	}

	const displayConfigType = detail?.data?.display_config?.type

	// 如果 display_config.type 是 design，但 type 是 notSupport，需要修正
	if (displayConfigType === "design" && detail?.type === DetailType.NotSupport) {
		// 构造一个 FileItem 格式的对象来使用 detectContentTypeRender
		const fileItem = {
			file_id: detail?.data?.file_id,
			file_name: detail?.data?.file_name,
			file_extension: detail?.data?.file_extension || "",
			display_filename: detail?.data?.file_name,
			display_config: detail?.data?.display_config,
			is_directory: false,
		}

		const contentTypeConfig = detectContentTypeRender(fileItem as any)
		if (contentTypeConfig) {
			return {
				...detail,
				type: contentTypeConfig.detailType,
			}
		}
	}

	// 后端偶发把音视频/Office 等标成 text/md/code，走文本渲染会拉取或序列化二进制导致卡死；按 file_id + 扩展名纠正
	if (detail?.data?.file_id && detail?.type && TEXT_LIKE_DETAIL_TYPES.includes(detail.type)) {
		const ext = inferFileExtensionFromDetailData(detail.data)
		const inferred = getFileType(ext)
		if (inferred && inferred !== "notSupport" && inferred !== detail.type) {
			return {
				...detail,
				type: inferred,
				data: {
					...detail.data,
					file_extension: detail.data?.file_extension || ext,
				},
			}
		}
	}

	return detail
}
