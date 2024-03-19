import type { RcFile } from "antd/es/upload"
import type { UploadCallBack, UploadConfig } from "@dtyq/upload-sdk"

// 添加这个类型别名，明确引用 CustomCredentials
export type CustomCredentials = any // UploadConfig["customCredentials"]

/** 上传模块 */
export namespace Upload {
	/** 上传方法类型 */
	export type UploadMethod = UploadConfig["method"]
	export interface UseUploadFilesParams<F> {
		/** 文件存储类型 */
		storageType?: "private" | "public"
		/** 是否使用STS */
		sts?: boolean
		/** 上传请求URL */
		url?: string
		/** 上传请求体 */
		body?: Record<string, any>
		/** 上传凭证 */
		customCredentials?: CustomCredentials
		/** 上传前回调 */
		onBeforeUpload?: () => void
		/** 上传进度回调 */
		onProgress?: (file: F, progress: number) => void
		/** 上传成功回调 */
		onSuccess?: (file: F, response: UploadResponse) => void
		/** 上传失败回调 */
		onFail?: (file: F, error?: Error) => void
		/** 上传初始化回调 */
		onInit?: (file: F, tools: Pick<UploadCallBack, "cancel" | "pause" | "resume">) => void
		/** 重命名文件 */
		rewriteFileName?: boolean
	}
	export interface UploadedResponse {
		/** 文件名称 */
		fileName: string
		/** 上传的文件 */
		file: RcFile
		/** 文件路径 */
		path: string
		/** 文件id */
		uid: string
	}

	export interface UploadResponse {
		key: string
		name: string
		size: number
	}

	export interface FileDataPrevious {
		id: string
		name: string
		file_id: string
		file: null
		size: number
		status: "done"
		progress: 100
		result: UploadResponse
		error?: Error
		cancel?: () => void
	}

	export interface FileDataNormal {
		id: string
		name: string
		file: File | null
		size: number
		status: "init" | "uploading" | "done" | "error"
		progress: number
		result?: UploadResponse
		error?: Error
		cancel?: () => void
	}

	export type FileData = FileDataNormal | FileDataPrevious

	export interface UploadResult {
		fullfilled: PromiseFulfilledResult<UploadResponse>[]
		rejected: {
			reason: {
				uploadFile: FileData
				message?: string
				code?: string
			}
			status: "rejected"
		}[]
	}

	export interface ReportFileUploadsResponse {
		file_id: string
		user_id: string
		magic_message_id: string
		organization_code: string
		file_extension: string
		file_key: string
		file_name: string
		file_size: number
		created_at: string
		updated_at: string
	}

	export interface DownloadResponse {
		download_name: string
		url: string
		path: string
		expires: number
	}
}
