import type { ErrorType } from "./error"
import type { Progress, TaskId } from "./index"

export type Method =
	| "get"
	| "GET"
	| "post"
	| "POST"
	| "delete"
	| "DELETE"
	| "head"
	| "HEAD"
	| "options"
	| "OPTIONS"
	| "put"
	| "PUT"
	| "patch"
	| "PATCH"

export interface RequestConfig {
	method: Method
	url: string
	query?: Record<string, string>
	headers?: Record<string, string>
	data?: string | object
	xmlResponse?: boolean
	success?: (res: Object) => void
	fail?: (status: number, reject: (error: ErrorType.UploadError) => void) => void
}

export interface UploadRequestConfig extends RequestConfig {
	taskId?: TaskId
	onProgress?: Progress
	withoutWrapper?: boolean
}

export interface Result<T> {
	code?: number
	data: T
	message?: string
	headers: Record<string, string>
}

export interface RequestTask {
	taskId: TaskId
	makeCancel: () => void
	makePause: () => void
}

export interface DataWrapperWithHeaders<T> {
	data: T
	headers: Record<string, string>
}
