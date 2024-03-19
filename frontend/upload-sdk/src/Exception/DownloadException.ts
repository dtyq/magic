import type { ErrorType } from "../types/error"
import { BaseException } from "./BaseException"

export const enum DownloadExceptionCode {
	DOWNLOAD_UNKNOWN_ERROR = "DOWNLOAD_UNKNOWN_ERROR",
	CODE_IS_NOT_1000 = "CODE_IS_NOT_1000",
	DOWNLOAD_REQUEST_ERROR = "DOWNLOAD_REQUEST_ERROR",
}

/** download API 异常分类 */
export const DownloadExceptionMapping: Record<
	string,
	(...args: any[]) => ErrorType.BaseExceptionWithStatus
> = {
	DOWNLOAD_UNKNOWN_ERROR: () => ({
		status: 3000,
		message: "An unknown error occurred on the download",
	}),
	CODE_IS_NOT_1000: (message: string) => ({
		status: 3001,
		message: `The content code returned is not 1000, message: ${message}`,
	}),
	DOWNLOAD_REQUEST_ERROR: (status: number) => ({
		status: 3002,
		message: `Download request error, status: ${status}`,
	}),
}

/**
 * download API 异常
 * Exceptions Handler.
 */
export class DownloadException extends BaseException {
	public readonly status: number

	public readonly name = "DownloadException"

	constructor(errType: keyof typeof DownloadExceptionMapping, ...args: any[]) {
		const e =
			DownloadExceptionMapping[errType] || DownloadExceptionMapping.DOWNLOAD_UNKNOWN_ERROR
		const { status, message } = e.apply(null, [...args])
		super(message)
		this.status = status
	}
}
