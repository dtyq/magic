import { getFileType } from "@/pages/superMagic/utils/handleFIle"
import { DetailType, type SelfMediaInitialNavigation } from "../../../types"
import type { FileItem } from "../types"
import { isMagicProjectConfigFile } from "@/pages/superMagic/components/MessageList/components/MessageAttachment/utils"

/** 易被误标为文本、进而拉取/序列化大资源导致卡顿的 detail 类型 */
const TEXT_LIKE_DETAIL_TYPES: string[] = [DetailType.Text, DetailType.Md, DetailType.Code]

interface CorrectDetailTypeOptions {
	attachmentList?: unknown[]
}

interface AttachmentNode {
	file_id?: string
	display_config?: Record<string, unknown>
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
 * 内容类型渲染配置列表
 * 这些内容类型不依赖文件内容，有自己的 detail render content
 */
const contentTypeRenderConfigs: ContentTypeRenderConfig[] = [
	{
		displayConfigType: "design",
		detailType: DetailType.Design,
		dataTransformer: designDataTransformer,
		priority: 10,
	},
	{
		displayConfigType: "self-media",
		detailType: DetailType.SelfMedia,
		dataTransformer: selfMediaDataTransformer,
		priority: 10,
	},
	// 未来可以扩展其他内容类型，例如：
	// {
	//   metadataType: "canvas",
	//   detailType: DetailType.Canvas,
	//   dataTransformer: canvasDataTransformer,
	//   priority: 10,
	// },
]

/**
 * 检测文件/文件夹是否应该使用内容类型渲染
 * 这种渲染不依赖文件内容，有自己的 detail render content
 */
export function detectContentTypeRender(item: FileItem): ContentTypeRenderConfig | null {
	if (!item.display_config?.type) {
		return null
	}

	// magic.project.js 应始终以代码模式打开，不参与内容类型渲染
	const fileName = item.file_name || item.display_filename || item.filename
	if (isMagicProjectConfigFile(fileName)) {
		return null
	}

	const displayConfigType = item.display_config.type

	// 查找匹配的配置，按优先级排序
	const matchedConfigs = contentTypeRenderConfigs
		.filter((config) => config.displayConfigType === displayConfigType)
		.sort((a, b) => (b.priority || 0) - (a.priority || 0))

	return matchedConfigs[0] || null
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
	const detail = resolveDetailMetadata(_detail, options)
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
