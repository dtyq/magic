/**
 * 错误类型命名空间
 * */
export namespace ErrorType {
	export interface BaseException {
		/** 错误信息 */
		message: string
	}

	export interface BaseExceptionWithStatus extends BaseException {
		/** 错误码 */
		status: number
	}

	export interface UploadError extends Error {
		status?: number
	}

	export interface UploadPartException extends BaseExceptionWithStatus {
		name: string
		stack: string
		partNum: number
	}
}
