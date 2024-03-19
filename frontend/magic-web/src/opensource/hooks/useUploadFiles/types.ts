import { FileData } from "@/opensource/pages/chatNew/components/MessageEditor/components/InputFiles/types"
import type { UploadCallBack, UploadConfig } from "@dtyq/upload-sdk"

export interface UploadResponse {
	key: string
	name: string
	size: number
}
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
	customCredentials?: UploadConfig["customCredentials"]
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

export interface DownloadResponse {
	download_name: string
	url: string
	path: string
	expires: number
}
