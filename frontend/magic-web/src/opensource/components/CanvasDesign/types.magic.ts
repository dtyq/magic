import type { Marker, ViewportState, ImageElement, MarkerTypeEnum } from "./canvas/types"

/**
 * 模型状态枚举
 */
export type ImageModelStatus = "normal" | "disabled" | "deleted"

/**
 * 模型状态枚举值
 */
export const ImageModelStatus = {
	/** 正常 */
	Normal: "normal",
	/** 禁用 */
	Disabled: "disabled",
	/** 删除 */
	Deleted: "deleted",
} as const

/**
 * 生图模型项
 * CanvasDesign 内部定义的类型，用于完全隔离外部依赖
 */
export interface ImageModelItem {
	/** 模型ID */
	id: string
	/** 分组ID */
	group_id: string
	/** 模型标识 */
	model_id: string
	/** 模型名称 */
	model_name: string
	/** 服务商模型ID */
	provider_model_id: string
	/** 模型描述 */
	model_description: string
	/** 模型图标 */
	model_icon: string
	/** 模型状态 */
	model_status: ImageModelStatus
	/** 排序 */
	sort: number
	/** 图片尺寸配置 */
	image_size_config?: {
		/** 最大参考图数量 */
		max_reference_images?: number
		/** 尺寸列表 */
		sizes: {
			label: string // "1:1"
			value: string // "1024x1024"
			scale?: string // "2K"、"4K"
		}[]
	}
	/** 标签 */
	tags?: unknown[]
}

/**
 * 发起图片生成请求参数
 */
export interface GenerateImageRequest {
	/** 项目 id */
	project_id?: string
	/** 图片 id */
	image_id?: string
	/** 模型 id */
	model_id?: string
	/** 提示词 */
	prompt?: string
	/** 大小，格式为: 宽度x高度，如: 1024x1024 */
	size?: string
	/** 分辨率（对应 scale 值） */
	resolution?: string
	/** 文件目录，一定是本项目存在的目录 */
	file_dir?: string
	/** 参考图，一定要是本项目存在的文件 */
	reference_images?: string[]
}

/**
 * 发起图片生成响应数据
 */
export interface GenerateImageResponse {
	/** 项目 id */
	project_id: string
	/** 图片 id */
	image_id: string
	/** 模型 id */
	model_id: string
	/** 提示词 */
	prompt: string
	/** 大小 */
	size: string
	/** 文件目录 */
	file_dir: string
	/** 文件名 */
	file_name: string
	/** 参考图 */
	reference_images: string[]
	/** 状态 */
	status: string
	/** 错误信息 */
	error_message: string | null
	/** 创建时间 */
	created_at: string
	/** 更新时间 */
	updated_at: string
	/** 文件 URL */
	file_url: string | null
	/** ID */
	id: string
}

/**
 * 发起高清图片生成请求参数
 */
export interface GenerateHightImageRequest {
	/** 项目 id */
	project_id?: string
	/** 图片 */
	image_id?: string
	/** 文件目录 */
	file_dir?: string
	/** 文件路径 */
	file_path?: string
	/** 大小，格式为: 宽度x高度，如: 1024x1024 */
	size?: string
}

/**
 * 发起高清图片生成响应数据
 */
export interface GenerateHightImageResponse extends GenerateImageResponse {}

/**
 * 获取高清图片生成配置响应数据
 */
export interface GetConvertHightConfigResponse {
	/** 是否支持转高清，如果没有配置则不支持转高清 */
	supported: boolean
	/** 支持的尺寸配置列表 */
	image_size_config?: {
		sizes: {
			/** 尺寸比例标签，如 "1:1", "16:9" */
			label: string
			/** 尺寸值，格式为 "宽度x高度"，如 "1024x1024" */
			value: string
			/** 分辨率等级，如 "1K", "2K", "4K" */
			scale: string
		}[]
	}
}

/**
 * 查询图片生成结果请求参数
 */
export interface GetImageGenerationResultParams {
	/** 项目 id */
	project_id?: string
	/** 图片 id */
	image_id?: string
}

/**
 * 查询图片生成结果响应数据
 */
export interface ImageGenerationResultResponse {
	/** 项目 id */
	project_id: string
	/** 图片 id */
	image_id: string
	/** 模型 id */
	model_id: string
	/** 提示词 */
	prompt: string
	/** 大小 */
	size: string
	/** 文件目录 */
	file_dir: string
	/** 文件名 */
	file_name: string
	/** 参考图 */
	reference_images: string[]
	/** 状态：pending 待处理，processing 处理中，completed 已完成，failed 失败 */
	status: "pending" | "processing" | "completed" | "failed"
	/** 错误信息 */
	error_message: string | null
	/** 创建时间 */
	created_at: string
	/** 更新时间 */
	updated_at: string
	/** 文件 URL */
	file_url: string
	/** ID */
	id: string
}

/**
 * 上传文件信息
 */
export interface GetFileInfoResponse {
	/** oss src */
	src: string
	/** 文件名称 */
	fileName: string
	/** 过期时间 格式为: 2026-03-03 11:14:03，可选（无则视为永不过期） */
	expires_at?: string
}

/**
 * 上传文件项
 */
export interface UploadFile {
	/** 文件对象 */
	file: File
	/**
	 * 是否覆盖同名文件，默认为 false
	 * 如果为 true，则上传的文件会覆盖同名文件
	 * 如果为 false，则上传的文件会自动重命名
	 */
	overwrite?: boolean
	/** 单个文件上传完成回调 */
	onUploadComplete: (result: UploadImageResponse) => void
	/** 单个文件上传失败回调 */
	onUploadFailed: (error: Error) => void
}

/**
 * 上传私有文件请求参数
 */
export interface UploadPrivateFile extends UploadFile {
	/** 相对路径 */
	relativePath: string
	/** 单个文件上传完成回调 */
	onUploadComplete: (result: UploadPrivateFileResponse) => void
}

/**
 * 上传图片响应
 */
export interface UploadImageResponse extends GetFileInfoResponse {
	/** 文件路径（用于 reference_images） */
	path: string
}

/**
 * 上传私有文件响应数据
 */
export interface UploadPrivateFileResponse {
	/** 文件路径 */
	path: string
}

/**
 * 识别图片标记请求参数基础
 */
export interface IdentifyImageMarkRequestBase {
	/** 项目 id */
	project_id?: string
	/** 文件路径 */
	file_path?: string
	/** 标记序号 */
	number?: number
}

/**
 * 识别图片标记请求参数
 */
export interface IdentifyImageMarkPointRequest extends IdentifyImageMarkRequestBase {
	/** 类型 */
	type?: typeof MarkerTypeEnum.Mark
	/**
	 * 标记(x,y)
	 * x,y 为标记坐标, 所有值必须是浮点数
	 * 例如: [0.5, 0.5]
	 * 表示标记坐标为 (50%, 50%)
	 */
	mark?: [number, number]
}

/**
 * 识别图片区域请求参数
 */
export interface IdentifyImageMarkAreaRequest extends IdentifyImageMarkRequestBase {
	/** 类型 */
	type?: typeof MarkerTypeEnum.Area
	/**
	 * 区域(x,y,w,h)
	 * x,y 为区域左上角坐标, 所有值必须是浮点数
	 * w,h 为区域宽高, 像素值
	 * 例如: [0.5, 0.5, 100, 100]
	 * 表示区域左上角坐标为 (50%, 50%), 宽高为 (100px, 100px)
	 */
	area?: [number, number, number, number]
}

/**
 * 识别图片标记请求参数类型
 */
export type IdentifyImageMarkRequest = IdentifyImageMarkPointRequest | IdentifyImageMarkAreaRequest

/**
 * 识别图片标记响应
 */
export interface IdentifyImageMarkResponseBase {
	/** 文件路径 */
	file_path: string
	/** 项目 id */
	project_id: string
	/** 提示信息 */
	suggestion: string
	/** 提示信息列表 */
	suggestions: {
		label: string
		kind: "object" | "part" | "custom" // 对象 或 区域
		bbox?: {
			x: number
			y: number
			width: number
			height: number
		}
	}[]
}

/**
 * 识别图片标记响应
 */
export interface IdentifyImageMarkPointResponse extends IdentifyImageMarkResponseBase {
	/** 类型 */
	type: typeof MarkerTypeEnum.Mark
	/** 标记 */
	mark: [number, number]
}

/**
 * 识别图片区域响应
 */
export interface IdentifyImageMarkAreaResponse extends IdentifyImageMarkResponseBase {
	/** 类型 */
	type: typeof MarkerTypeEnum.Area
	/** 区域 */
	area: [number, number, number, number]
}

/**
 * 识别图片标记响应类型
 */
export type IdentifyImageMarkResponse =
	| IdentifyImageMarkPointResponse
	| IdentifyImageMarkAreaResponse

/**
 * Storage 数据结构
 */
export interface CanvasDesignStorageData {
	viewport?: ViewportState
	expandedElementIds?: string[]
	layersCollapsed?: boolean
	layersWidth?: number
	markers?: Marker[]
	/** 图片元素临时配置（未发送前的配置） */
	tempImageConfigs?: Record<string, Partial<GenerateImageRequest>>
}

export interface CanvasDesignRootStorageData {
	/** 默认生图配置 */
	defaultGenerateImageConfig?: Partial<
		Pick<GenerateImageRequest, "model_id" | "size" | "resolution">
	>
}

/**
 * CanvasDesign 剪贴板读写接口
 * 通过 methods 注入，实现与项目剪贴板工具（如 clipboard-helpers）的解耦
 * 未注入时 CanvasDesign 内部降级使用 navigator.clipboard
 */
export interface CanvasDesignClipboard {
	/** 写入纯文本 */
	writeText: (text: string) => Promise<void>
	/** 写入 ClipboardItem 列表（支持富格式、图片等） */
	write: (items: ClipboardItem[]) => Promise<void>
	/** 读取纯文本（可选，未提供时使用 navigator.clipboard.readText） */
	readText?: () => Promise<string>
	/** 读取 ClipboardItem 列表（可选，未提供时使用 navigator.clipboard.read） */
	read?: () => Promise<ClipboardItem[]>
}

/**
 * CanvasDesign 方法集合
 * 用于代理数据请求和存储操作，所有方法都是异步的
 * 注意：此接口完全独立，不依赖外部类型
 */
export interface CanvasDesignMethods {
	/**
	 * 获取生图模型列表
	 * @param mode 模式标识，如果不传则使用当前模式
	 * @returns Promise<生图模型列表>
	 */
	getImageModelList: () => Promise<ImageModelItem[]>
	/**
	 * 发起图片生成
	 * @param params 图片生成请求参数
	 * @returns Promise<图片生成响应数据>
	 */
	generateImage: (params: GenerateImageRequest) => Promise<GenerateImageResponse>

	/**
	 * 发起高清图片生成
	 * @param params 高清图片生成请求参数
	 * @returns Promise<高清图片生成响应数据>
	 */
	generateHightImage: (params: GenerateHightImageRequest) => Promise<GenerateHightImageResponse>
	/**
	 * 获取高清图片生成配置
	 * @returns Promise<高清图片生成配置响应数据>
	 */
	getConvertHightConfig: () => Promise<GetConvertHightConfigResponse>
	/**
	 * 查询图片生成结果
	 * @param params 查询参数
	 * @returns Promise<图片生成结果响应数据>
	 */
	getImageGenerationResult: (
		params: GetImageGenerationResultParams,
	) => Promise<ImageGenerationResultResponse>
	/**
	 * 上传图片
	 * @param uploadFiles 图片文件数组
	 * @param duplicateCheckList 用于检查重复的图片列表
	 * @returns Promise<上传图片响应数组，包含文件信息、图标和文件路径>
	 */
	uploadImages: (
		uploadFiles: UploadFile[],
		duplicateCheckList?: string[],
	) => Promise<UploadImageResponse[]>
	/**
	 * 获取上传图片信息
	 * @param path 图片文件路径
	 * @returns Promise<文件信息，包含图标和文件名称>
	 */
	getFileInfo: (path: string) => Promise<GetFileInfoResponse>
	/**
	 * 添加图片至对话
	 * @param data 图片元素数据数组
	 * @param isNewConversation 是否为新话题，true 为新话题，false 为当前对话
	 * @returns Promise<void>
	 */
	addToConversation: (data: ImageElement[], isNewConversation: boolean) => Promise<void>
	/**
	 * 下载图片
	 * @param data 图片元素数据数组
	 * @param noWatermark 是否无水印，true 为无水印，false 为有水印
	 * @returns Promise<void>
	 */
	downloadImage: (data: ImageElement[], noWatermark: boolean) => Promise<void>
	/**
	 * 获取存储数据
	 * @returns 存储数据
	 */
	getStorage: () => CanvasDesignStorageData | null
	/**
	 * 保存存储数据
	 * @param data 存储数据
	 */
	saveStorage: (data: CanvasDesignStorageData) => void
	/**
	 * 获取默认生图配置
	 * @returns 默认生图配置
	 */
	getRootStorage: () => CanvasDesignRootStorageData | null
	/**
	 * 保存根存储数据
	 * @param data 根存储数据
	 */
	saveRootStorage: (data: CanvasDesignRootStorageData) => void
	/**
	 * 从 DataTransfer 获取文件路径信息
	 * @param dataTransfer DataTransfer 对象
	 * @returns 文件路径数组（Promise）
	 */
	getDataTransferFileInfo: (dataTransfer: DataTransfer) => Promise<string[]>
	/**
	 * 识别图片标记
	 * @param data 识别图片标记请求参数
	 * @returns Promise<识别图片标记响应数据>
	 */
	identifyImageMark(data: IdentifyImageMarkRequest): Promise<IdentifyImageMarkResponse>
	/**
	 * 上传私有文件
	 * @param uploadFiles 上传文件请求参数
	 * @returns Promise<上传私有文件响应数据>
	 */
	uploadPrivateFiles: (uploadFiles: UploadPrivateFile[]) => Promise<UploadPrivateFileResponse[]>
	/**
	 * 剪贴板读写方法（可选）
	 * 注入后 CanvasDesign 使用注入实现，否则降级到 navigator.clipboard
	 */
	clipboard?: CanvasDesignClipboard
}

/**
 * Magic 权限配置
 */
export interface MagicPermissions {
	/** 标记管理器是否禁用 */
	disabledMarker: boolean
	/** 下载菜单展示模式：开源版单项直下，商业版展示子菜单 */
	downloadMenuMode?: "single" | "submenu"
}

/** getDefaultItems 可选的 i18n 参数，与 MentionPanel I18nTexts 兼容 */
export type MentionDataServicePortI18n = Record<string, string | Record<string, string>>

/**
 * Magic 配置
 */
export interface MagicConfig {
	methods?: CanvasDesignMethods
	permissions?: MagicPermissions
}
