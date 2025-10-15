import type { OSS } from "./OSS"
import type { ErrorType } from "./error"
import type { Kodo } from "./Kodo"
import type { Local } from "./Local"
import type { Method } from "./request"
import type { TOS } from "./TOS"
import type { OBS } from "./OBS"
import type { S3 } from "./S3"

/** 请求类型 */
export type MethodType = Method

/**
 * @description 统一成功响应
 * @param code 1000 为请求成功
 * @param message 请求状态信息
 * @param data 返回数据载荷
 */
export interface NormalSuccessResponse {
	code: number
	message: string
	headers: Record<string, string>
	data: {
		platform: PlatformType
		path: string
	}
}

/**
 * @param url 请求url
 * @param method 请求方法
 * @param headers 请求头
 * @param body 请求体
 */
export interface Request {
	url: string
	method: Method
	headers?: Record<string, string>
	body?: any
}

/**
 * @description: 图片处理配置
 * @param type // 图片处理类型,例如：resize、watermark
 * @param params  图片处理参, 具体传参参考： https://help.aliyun.com/document_detail/144582.html
 */
export interface TransformImageConfig {
	type:
		| "resize"
		| "watermark"
		| "crop"
		| "quality"
		| "format"
		| "auto-orient"
		| "circle"
		| "indexcrop"
		| "rounded-corners"
		| "blur"
		| "rotate"
		| "interlace"
		| "bright"
		| "sharpen"
		| "contrast"
	params: Record<string, any>
}

/**
 * @description: 下载配置
 * @param url 请求url
 * @param method 请求方法
 * @param headers 请求头
 * @param body 请求体
 */
export interface DownloadConfig extends Request {
	option?: {
		image?: TransformImageConfig[]
	}
}

type UploadConfigOption = UploadCommonOption &
	PlatformSimpleUploadOption &
	PlatformMultipartUploadOption

/**
 * @description: 公共上传配置
 * @param rewriteFileName 是否重命名文件
 */
export interface UploadCommonOption {
	rewriteFileName?: boolean
}

/**
 * @description: 自定义上传凭证配置
 * @param platform 平台类型
 * @param credentials 凭证信息
 * @param expire 过期时间戳（可选）
 */
export interface CustomCredentials {
	platform: PlatformType
	temporary_credential: PlatformParams
	expire?: number
}

/**
 * @description: 上传配置，需开发者配置请求上传凭证配置，由SDK内部帮助处理上传请求
 * @param url  请求上传凭证-url（自定义凭证时可选）
 * @param method 请求上传凭证-请求方法（自定义凭证时可选）
 * @param headers 请求上传凭证-请求头（自定义凭证时可选）
 * @param body 请求上传凭证-请求体（自定义凭证时可选）
 * @param {File | Blob} file 需要上传的文件
 * @param fileName 文件名
 * @param option 上传可选配置
 * @param customCredentials 自定义上传凭证（可选，提供此参数时会跳过凭证请求）
 */
export interface UploadConfig {
	url?: string
	method?: Method
	headers?: Record<string, string>
	body?: any
	file: File | Blob
	fileName: string
	option?: UploadConfigOption
	customCredentials?: CustomCredentials
}

/** 上传回调 */
export interface UploadCallBack extends TaskCallBack {}

export type DonePart = { number: number; etag: string }

export interface Checkpoint {
	/** The file object selected by the user, if the browser is restarted, it needs the user to manually trigger the settings */
	file: any
	/** object key */
	name: string
	fileSize: number
	partSize: number
	uploadId: string
	doneParts: DonePart[]
}

/** percent：百分比进度 loaded：已上传字节数 total：总字节数  checkpoint：上传断点信息 */
export type Progress = (
	percent: number,
	loaded: number,
	total: number,
	checkpoint: Checkpoint | null,
) => void

/** PlatformType 云存储服务商枚举类型 */
export enum PlatformType {
	OSS = "aliyun",
	Kodo = "qiniu",
	TOS = "tos",
	OBS = "obs",
	Local = "local",
	S3 = "s3",
}

/** 聚合平台参数 */
export type PlatformParams =
	| OSS.AuthParams
	| OSS.STSAuthParams
	| Kodo.AuthParams
	| Local.AuthParams
	| TOS.AuthParams
	| TOS.STSAuthParams
	| OBS.AuthParams
	| OBS.STSAuthParams
	| S3.AuthParams
	| S3.STSAuthParams

/** 请求临时凭证，返回数据模板 */
export interface UploadSource<T extends PlatformParams> {
	platform: PlatformType
	temporary_credential: T
	expire: number
}

/** Global 全局变量 */
export type GlobalCache<T extends PlatformParams> = Record<string, UploadSource<T>>

/** 对象存储平台基础 Option */
interface PlatformOption {
	headers?: Record<string, string>
	taskId?: TaskId
	progress?: Progress
	reUploadedCount?: number
}

/** 复杂上传 Option 可选字段 */
export interface PlatformMultipartUploadOption extends PlatformOption {
	parallel?: number
	partSize?: number
	checkpoint?: OSS.Checkpoint
	mime?: string | null
}

/** 简单上传 Option 可选字段 */
export interface PlatformSimpleUploadOption extends PlatformOption {}

/** 不同对象存储平台上传文件实现接口 */
export type PlatformRequest<P, O> = (
	file: File | Blob,
	key: string,
	params: P,
	option: O,
) => Promise<NormalSuccessResponse>

/** 对象存储平台模块 */
export interface PlatformModule {
	upload: PlatformRequest<
		PlatformParams,
		PlatformSimpleUploadOption | PlatformMultipartUploadOption
	>
}

/** 上传文件开始会生成一个 TaskId */
export type TaskId = string

/** 上传进度回调参数 */
export interface ProgressCallbackProps {
	percent?: number
	loaded?: number
	total?: number
	checkpoint?: OSS.Checkpoint | null
}

/** 成功钩子毁掉 */
export type SuccessCallback = (response?: NormalSuccessResponse) => void

/** 失败钩子毁掉 */
export type FailCallback = (err?: ErrorType.UploadError) => void

/** 进度钩子毁掉 */
export type ProgressCallback = (
	percent?: ProgressCallbackProps["percent"],
	loaded?: ProgressCallbackProps["loaded"],
	total?: ProgressCallbackProps["total"],
	checkpoint?: ProgressCallbackProps["checkpoint"],
) => void

/** 上传任务回调 */
export interface TaskCallBack {
	// 上传成功
	success?: (callback: SuccessCallback) => void
	// 上传出错
	fail?: (callback: FailCallback) => void
	// 进度
	progress?: (callback: ProgressCallback) => void
	// 取消
	cancel?: () => void
	// 暂停
	pause?: () => void
	// 恢复
	resume?: () => void
}

/** 任务对象 */
export interface Task {
	// 上传成功
	success?: SuccessCallback
	// 上传出错
	fail?: FailCallback
	// 进度
	progress?: ProgressCallback
	// 取消
	cancel?: () => void
	// 暂停
	pause?: () => void
	// 恢复
	resume?: () => void
	/** 暂停行为中的文件进度信息 */
	pauseInfo?: {
		isPause: boolean
		checkpoint: OSS.Checkpoint
	}
}
