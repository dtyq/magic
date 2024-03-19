import type { ErrorType } from "../types/error"
import { BaseException } from "./BaseException"

export const enum UploadExceptionCode {
	UPLOAD_UNKNOWN_ERROR = "UPLOAD_UNKNOWN_ERROR",
	UPLOAD_CANCEL = "UPLOAD_CANCEL",
	UPLOAD_PAUSE = "UPLOAD_PAUSE",
	UPLOAD_CREDENTIALS_IS_EXPIRED = "UPLOAD_CREDENTIALS_IS_EXPIRED",
	UPLOAD_MULTIPART_ERROR = "UPLOAD_MULTIPART_ERROR",
}

/** upload API 异常分类 */
export const UploadExceptionMapping: Record<
	string,
	(...args: any[]) => ErrorType.BaseExceptionWithStatus
> = {
	UPLOAD_UNKNOWN_ERROR: () => ({
		status: 1000,
		message: "An unknown error occurred on the upload",
	}),
	UPLOAD_CANCEL: () => ({
		status: 1001,
		message: "{status: 1001, message: isCancel}",
	}),
	UPLOAD_PAUSE: () => ({
		status: 1002,
		message: "{status: 1002, message: isPause}",
	}),
	UPLOAD_CREDENTIALS_IS_EXPIRED: () => ({
		status: 1003,
		message: "{status: 1003, message: credentials is expired}",
	}),
	UPLOAD_MULTIPART_ERROR: (message: string, partNum: number) => ({
		status: 1004,
		message: `{status: 1004, message: Failed to upload some parts with error: ${message} part_num: ${partNum}`,
	}),
}

/**
 * upload API 异常
 * Exceptions Handler.
 */
export class UploadException extends BaseException {
	public readonly status: number

	public readonly name = "UploadException"

	constructor(errType: keyof typeof UploadExceptionMapping, ...args: any[]) {
		const e = UploadExceptionMapping[errType] || UploadExceptionMapping.UPLOAD_UNKNOWN_ERROR
		const { status, message } = e.apply(null, [...args])
		super(message)
		this.status = status
	}
}
