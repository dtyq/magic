import type { IWorkbookData, IDocumentData } from "@univerjs/core"

// =====类型映射=====
export const SupportedFileTypeMap = {
	sheet: "sheet",
	doc: "doc",
	slide: "slide",
} as const

export type SupportedFileType = (typeof SupportedFileTypeMap)[keyof typeof SupportedFileTypeMap]

export const SupportedFileOutputModeMap = {
	buffer: "buffer",
	json: "json",
} as const

export type exportImportMode =
	(typeof SupportedFileOutputModeMap)[keyof typeof SupportedFileOutputModeMap]

export const componentModeMap = {
	readonly: "readonly",
	edit: "edit",
} as const

export type ComponentMode = (typeof componentModeMap)[keyof typeof componentModeMap]
// =====finish====

export type ExportConfigType = {
	mode: exportImportMode
	data?: any
	fileName?: string
	isDownload?: boolean
}
/** 尺寸类型 */
export type SizeValue = number | string

/** Univer 数据类型 - 支持 Sheet、Doc、Slide */
export type UniverData = Partial<IWorkbookData> | Partial<IDocumentData> | any

/** Univer 组件属性接口 */
export interface UniverComponentNewProps {
	/** 文件类型 - 默认为 sheet */
	type?: SupportedFileType
	/** 要显示的数据 - 支持 File 或 JSON 对象 */
	data: File | UniverData
	/** 组件宽度 */
	width?: SizeValue
	/** 组件高度 */
	height?: SizeValue
	/** 组件模式 */
	mode?: ComponentMode
	/** 数据变化回调 */
	onDataChange?: (data: UniverData) => void
	/** 是否全量更新（从 JSON 编辑器更新时使用）- 仅对 sheet 类型有效 */
	fullUpdate?: boolean
	/** 加载失败时的 fallback 组件 */
	loadingFallback?: React.ReactNode
}

/** Worker 消息类型枚举 */
export enum TransformWorkerMessageType {
	TRANSFORM_REQUEST = "TRANSFORM_REQUEST", // 转换请求
	TRANSFORM_RESPONSE = "TRANSFORM_RESPONSE", // 转换响应
	TRANSFORM_ERROR = "TRANSFORM_ERROR", // 转换错误
}

/** Worker 请求载荷接口 */
export interface WorkerRequestPayload {
	/** 任务 ID */
	id: string
	/** 文件类型 */
	type?: SupportedFileType
	/** 要处理的数据 - 支持 File 或 JSON 对象 */
	data: File | UniverData
	/** 文件名称 */
	fileName?: string
	/** 是否为只读模式 */
	isReadonly?: boolean
}

/** Worker 请求消息接口 */
export interface WorkerMessage {
	type: TransformWorkerMessageType
	payload: WorkerRequestPayload
}

/** Worker 错误信息接口 */
export interface WorkerError {
	/** 错误消息 */
	message: string
	/** 错误堆栈 */
	stack?: string
}

/** Worker 响应载荷接口 */
export interface WorkerResponsePayload {
	/** 任务 ID */
	id: string
	/** 处理结果 */
	result?: UniverData
	/** 错误信息 */
	error?: WorkerError
}

/** Worker 响应消息接口 */
export interface WorkerResponse {
	type: TransformWorkerMessageType
	payload: WorkerResponsePayload
}

/** Worker 任务接口 - 用于跟踪单个转换任务的状态 */
export interface TransformTask {
	id: string
	resolve: (value: UniverData) => void
	reject: (error: Error) => void
}
