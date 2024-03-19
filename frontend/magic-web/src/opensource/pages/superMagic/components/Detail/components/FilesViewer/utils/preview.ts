import { DetailType } from "../../../types"
import type { FileItem } from "../types"

/**
 * 内容类型渲染配置
 * 用于定义哪些 metadata.type 应该使用独立的内容渲染组件，不依赖文件内容
 */
export interface ContentTypeRenderConfig {
	/** metadata.type 的值 */
	metadataType: string

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
		metadata: item.metadata,
	}
}

/**
 * 内容类型渲染配置列表
 * 这些内容类型不依赖文件内容，有自己的 detail render content
 */
const contentTypeRenderConfigs: ContentTypeRenderConfig[] = [
	{
		metadataType: "design",
		detailType: DetailType.Design,
		dataTransformer: designDataTransformer,
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
	if (!item.metadata?.type) {
		return null
	}

	const metadataType = item.metadata.type

	// 查找匹配的配置，按优先级排序
	const matchedConfigs = contentTypeRenderConfigs
		.filter((config) => config.metadataType === metadataType)
		.sort((a, b) => (b.priority || 0) - (a.priority || 0))

	return matchedConfigs[0] || null
}

/**
 * 修正 detail 对象的类型
 * 如果 metadata.type 是 design 但 type 是 notSupport，需要修正
 * @param detail - 待修正的 detail 对象
 * @returns 修正后的 detail 对象
 */
export function correctDetailType(detail: any): any {
	if (!detail) return detail

	const metadataType = detail?.data?.metadata?.type

	// 如果 metadata.type 是 design，但 type 是 notSupport，需要修正
	if (metadataType === "design" && detail?.type === DetailType.NotSupport) {
		// 构造一个 FileItem 格式的对象来使用 detectContentTypeRender
		const fileItem = {
			file_id: detail?.data?.file_id,
			file_name: detail?.data?.file_name,
			file_extension: detail?.data?.file_extension || "",
			display_filename: detail?.data?.file_name,
			metadata: detail?.data?.metadata,
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

	return detail
}
