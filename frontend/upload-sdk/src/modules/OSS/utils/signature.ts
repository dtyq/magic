import Base64 from "crypto-js/enc-base64"
import hmacSHA1 from "crypto-js/hmac-sha1"
import type { MethodType } from "../../../types"
import type { OSS } from "../../../types/OSS"
import { isObject } from "../../../utils/checkDataFormat"

/**
 * @param {String} accessKeySecret
 * @param {String} canonicalString
 */
export function computeSignature(accessKeySecret: string, canonicalString: string) {
	return Base64.stringify(hmacSHA1(canonicalString, accessKeySecret))
}

function lowercaseKeyHeader(headers: Record<string, string>) {
	const lowercaseHeader: Record<string, string> = {}
	if (isObject(headers)) {
		Object.keys(headers).forEach((key) => {
			lowercaseHeader[key.toLowerCase()] = headers[key]
		})
	}
	return lowercaseHeader
}

/**
 *
 * @param {String} resourcePath
 * @param {Object} parameters
 * @return
 */
export function buildCanonicalResourceResource(resourcePath: string, parameters: any) {
	let canonicalResourceResource = `${resourcePath}`
	let separatorString = "?"

	if (typeof parameters === "string" && parameters.trim() !== "") {
		canonicalResourceResource += separatorString + parameters
	} else if (Array.isArray(parameters)) {
		parameters.sort()
		canonicalResourceResource += separatorString + parameters.join("&")
	} else if (parameters) {
		const compareFunc = (entry1: string, entry2: string) => {
			if (entry1[0] > entry2[0]) {
				return 1
			}
			if (entry1[0] < entry2[0]) {
				return -1
			}
			return 0
		}
		const processFunc = (key: string) => {
			canonicalResourceResource += separatorString + key
			if (parameters[key] || parameters[key] === 0) {
				canonicalResourceResource += `=${parameters[key]}`
			}
			separatorString = "&"
		}
		Object.keys(parameters).sort(compareFunc).forEach(processFunc)
	}

	return canonicalResourceResource
}

/**
 * @param {Method} method
 * @param {String} resourcePath
 * @param {Object} request
 * @param {String} expires
 */
export function buildCanonicalString(
	method: MethodType,
	resourcePath: string,
	request: Record<string, any>,
	expires: string,
) {
	const req = request || {}
	const headers = lowercaseKeyHeader(req.headers)
	const OSS_PREFIX = "x-oss-"
	const ossHeaders: string[] = []
	const headersToSign: Record<string, string> = {}

	let signContent = [
		method.toUpperCase(),
		headers["content-md5"] || "",
		headers["content-type"],
		expires || headers["x-oss-date"],
	]

	Object.keys(headers).forEach((key) => {
		const lowerKey = key.toLowerCase()
		if (lowerKey.indexOf(OSS_PREFIX) === 0) {
			headersToSign[lowerKey] = String(headers[key]).trim()
		}
	})

	Object.keys(headersToSign)
		.sort()
		.forEach((key) => {
			ossHeaders.push(`${key}:${headersToSign[key]}`)
		})

	signContent = signContent.concat(ossHeaders)

	signContent.push(buildCanonicalResourceResource(resourcePath, req.parameters))

	return signContent.join("\n")
}

/**
 * @description: authorization 加密方法
 * @param {MethodType} method 请求类型
 * @param {string} resource 文件路径
 * @param {string | Object} subRes 携带请求信息
 * @param {OSS.Headers} headers 请求头
 * @param {OSS.Option} option 配置字段
 */
export function authorization(
	method: MethodType,
	resource: string,
	subRes: string | object,
	headers: OSS.Headers,
	option: OSS.Option,
) {
	const stringToSign = buildCanonicalString(
		<MethodType>method.toUpperCase(),
		resource,
		{
			headers,
			parameters: subRes,
		},
		"",
	)
	const { accessKeyId, accessKeySecret } = option
	return `OSS ${accessKeyId}:${computeSignature(accessKeySecret, stringToSign)}`
}
