/**
 * Transform Data Worker 类型定义
 */

// Worker 消息类型枚举
export enum TransformWorkerMessageType {
	TRANSFORM_REQUEST = "TRANSFORM_REQUEST",
	TRANSFORM_RESPONSE = "TRANSFORM_RESPONSE",
	TRANSFORM_ERROR = "TRANSFORM_ERROR",
	TRANSFORM_PROGRESS = "TRANSFORM_PROGRESS",
}

// 支持的文件类型
export type FileType = "doc" | "sheet" | "slide"

// Transform 请求消息
export interface TransformRequestMessage {
	type: TransformWorkerMessageType.TRANSFORM_REQUEST
	payload: {
		id: string // 唯一请求ID
		data: any // 原始数据：字符串内容或File对象
		fileType: FileType // 文件类型
		fileName: string // 文件名
	}
}

// Transform 响应消息
export interface TransformResponseMessage {
	type: TransformWorkerMessageType.TRANSFORM_RESPONSE
	payload: {
		id: string // 对应的请求ID
		result: any // 转换后的数据
	}
}

// Transform 错误消息
export interface TransformErrorMessage {
	type: TransformWorkerMessageType.TRANSFORM_ERROR
	payload: {
		id: string // 对应的请求ID
		error: {
			message: string
			stack?: string
		}
	}
}

// Transform 进度消息（可选，用于大文件处理进度通知）
export interface TransformProgressMessage {
	type: TransformWorkerMessageType.TRANSFORM_PROGRESS
	payload: {
		id: string // 对应的请求ID
		progress: number // 进度百分比 0-100
		stage: string // 当前处理阶段描述
	}
}

// Worker 消息联合类型
export type WorkerMessage =
	| TransformRequestMessage
	| TransformResponseMessage
	| TransformErrorMessage
	| TransformProgressMessage

// Worker 响应类型（主线程接收的消息）
export type WorkerResponse =
	| TransformResponseMessage
	| TransformErrorMessage
	| TransformProgressMessage

// Transform 结果 Promise 包装
export interface TransformResult {
	id: string
	promise: Promise<any>
	resolve: (value: any) => void
	reject: (error: Error) => void
}

// Worker 选项
export interface TransformWorkerOptions {
	timeout?: number // 超时时间（毫秒），默认 30 秒
	maxConcurrentTasks?: number // 最大并发任务数，默认 3
}
