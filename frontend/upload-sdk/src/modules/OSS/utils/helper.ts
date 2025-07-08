import mime from "mime"
import urlUtil from "url"
import { InitException, InitExceptionCode } from "../../../Exception/InitException"
import { UploadException, UploadExceptionCode } from "../../../Exception/UploadException"
import type { MethodType } from "../../../types"
import type { OSS } from "../../../types/OSS"
import type { ErrorType } from "../../../types/error"
import { isIP } from "../../../utils/checkDataFormat"
import { parseExtname } from "../../../utils/regExpUtil"
import { request } from "../../../utils/request"
import { authorization } from "./signature"

function escape(name: string) {
	return window.encodeURIComponent(name).replace(/%2F/g, "/")
}

export function getReqUrl(params: OSS.CreateRequestParams) {
	const ep: any = {
		host: "aliyuncs.com",
	}

	if (params.bucket && !isIP(ep.hostname)) {
		ep.host = `${params.bucket}.${params.region}.${ep.host}`
	}

	let resourcePath = "/"

	if (params.object) {
		// Preserve '/' in result url
		resourcePath += escape(params.object).replace(/\+/g, "%2B")
	}
	ep.pathname = resourcePath

	const query = {}
	if (params.query) {
		Object.assign(query, params.query)
	}

	if (params.subRes) {
		let subResAsQuery: Record<string, any> = {}
		if (typeof params.subRes === "string") {
			subResAsQuery[params.subRes] = ""
		} else if (Array.isArray(params.subRes)) {
			params.subRes.forEach((k: any) => {
				subResAsQuery[k] = ""
			})
		} else {
			subResAsQuery = params.subRes
		}
		Object.assign(query, subResAsQuery)
	}

	ep.query = query

	return urlUtil.format(ep)
}

export function createRequest(params: OSS.CreateRequestParams, option: OSS.MultipartUploadOption) {
	const date = new Date()

	const headers: OSS.Headers = {
		...option.headers,
		"x-oss-date": date.toUTCString(),
	}

	if (typeof window !== "undefined") {
		headers["x-oss-user-agent"] = window.navigator.userAgent
	}

	if (params.stsToken) {
		headers["x-oss-security-token"] = params.stsToken
	}

	if (params.callback) {
		headers["x-oss-callback"] = params.callback
	}

	const { hasOwnProperty } = Object.prototype
	if (!hasOwnProperty.call(headers, "Content-Type")) {
		if (option.mime && option.mime.indexOf("/") > 0) {
			headers["Content-Type"] = option.mime
		} else {
			const contentType = mime.getType(option.mime || parseExtname(params.object || ""))
			if (contentType) {
				headers["Content-Type"] = contentType
			}
		}
	}

	const authResource = `/${params.bucket}/${params.object}`

	headers.authorization = authorization(
		params.method,
		authResource,
		params.subRes,
		headers,
		params,
	)
	const url = getReqUrl(params)
	return {
		url,
		method: params.method,
		data: params.content,
		headers,
		taskId: params.taskId,
		fail: (status: number, reject: (error: ErrorType.UploadError) => void) => {
			if (status === 403) {
				reject(new UploadException(UploadExceptionCode.UPLOAD_CREDENTIALS_IS_EXPIRED))
			}
		},
	}
}

export async function uploadPart(
	name: string,
	uploadId: string,
	partNo: number,
	data: OSS.PartInfo,
	params: OSS.MultipartUploadParams,
	options: OSS.MultipartUploadOption,
) {
	const opt: OSS.MultipartUploadOption = { ...options }

	const configParams: OSS.CreateRequestParams = {
		method: <MethodType>"PUT",
		content: data.content,
		subRes: {
			partNumber: partNo,
			uploadId,
		},
		...params,
	}

	const result = await request<OSS.UploadPartResponse>(createRequest(configParams, opt))

	if (!result.headers.etag) {
		throw new InitException(InitExceptionCode.UPLOAD_HEAD_NO_EXPOSE_ETAG)
	}

	return {
		name,
		etag: result.headers.etag,
		res: result,
	}
}

export function omit(originalObject: {} | undefined, keysToOmit: string[]): {} {
	if (originalObject) return {}
	const cloneObject: Record<string, string> = { ...originalObject }

	if (Array.isArray(keysToOmit) && keysToOmit.length > 0) {
		keysToOmit.forEach((path) => {
			delete cloneObject[path]
		})
	}
	return cloneObject
}
