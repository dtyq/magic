import type { ErrorType } from "../types/error"
import { BaseException } from "./BaseException"

export const enum HttpExceptionCode {
	HTTP_UNKNOWN_ERROR = "HTTP_UNKNOWN_ERROR",
	REQUEST_FAILED_WITH_STATUS_CODE = "REQUEST_FAILED_WITH_STATUS_CODE",
	REQUEST_IS_CANCEL = "REQUEST_IS_CANCEL",
	REQUEST_IS_PAUSE = "REQUEST_IS_PAUSE",
	REQUEST_NO_XHR_OBJ_AVAILABLE = "REQUEST_NO_XHR_OBJ_AVAILABLE",
}

/** HTTP 异常分类 */
export const HttpExceptionMapping: Record<
	string,
	(...args: any[]) => ErrorType.BaseExceptionWithStatus
> = {
	REQUEST_UNKNOWN_ERROR: () => ({
		status: 0,
		message: "An unknown error occurred on the request",
	}),
	REQUEST_NO_XHR_OBJ_AVAILABLE: () => ({
		status: 0,
		message: "No XHR object available",
	}),
	REQUEST_FAILED_WITH_STATUS_CODE: (status: number) => ({
		status,
		message: `{status: ${status}, message: Request failed}`,
	}),
	REQUEST_IS_CANCEL: () => ({
		status: 5001,
		message: "The request was canceled",
	}),
	REQUEST_IS_PAUSE: () => ({
		status: 5002,
		message: "The request was paused",
	}),
}

/**
 * HTTP 通用请求异常
 * Exceptions Handler.
 */
export class HttpException extends BaseException {
	public readonly status: number

	public readonly name = "HttpException"

	constructor(errType: keyof typeof HttpExceptionMapping, ...args: any[]) {
		const e = HttpExceptionMapping[errType] || HttpExceptionMapping.REQUEST_UNKNOWN_ERROR
		const { status, message } = e.apply(null, [...args])
		super(message)
		this.status = status
	}
}
