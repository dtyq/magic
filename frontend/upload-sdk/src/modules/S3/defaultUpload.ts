import mime from "mime"
import { InitException, InitExceptionCode } from "../../Exception/InitException"
import { UploadException, UploadExceptionCode } from "../../Exception/UploadException"
import type { PlatformRequest, PlatformSimpleUploadOption } from "../../types"
import { PlatformType } from "../../types"
import type { S3 } from "../../types/S3"
import { parseExtname } from "../../utils/regExpUtil"
import { request } from "../../utils/request"
import { normalizeSuccessResponse } from "../../utils/response"
import { buildS3Url } from "./utils/helper"
import { signRequest } from "./utils/signature"

/**
 * @description: Simple upload using pre-signed URL
 * @param {File | Blob} file File to upload
 * @param {String} key Object key
 * @param {S3.AuthParams} params Pre-signed URL parameters
 * @param {PlatformSimpleUploadOption} option Upload options
 */
export const defaultUpload: PlatformRequest<S3.AuthParams, PlatformSimpleUploadOption> = async (
	file,
	key,
	params,
	option,
) => {
	const { url, method = "PUT", headers = {}, callback } = params

	if (!url) {
		throw new InitException(InitExceptionCode.MISSING_CREDENTIALS_PARAMS_FOR_UPLOAD, "s3", "url")
	}

	// S3 PUT Object upload limit is 5GB
	if (file?.size > 5 * 1024 * 1024 * 1024) {
		throw new InitException(InitExceptionCode.UPLOAD_FILE_TO_BIG, key)
	}

	// Determine content type
	let contentType = headers["Content-Type"] || headers["content-type"]
	if (!contentType) {
		const fileMimeType = mime.getType(parseExtname(key))
		if (fileMimeType) {
			contentType = fileMimeType
		}
	}

	const requestHeaders: Record<string, string> = {
		...headers,
	}

	if (contentType) {
		requestHeaders["Content-Type"] = contentType
	}

	// Send request
	return request<S3.PutResponse>({
		method: method,
		url: url,
		data: file,
		headers: requestHeaders,
		taskId: option.taskId,
		onProgress: option?.progress ? option.progress : () => {},
		withoutWrapper: true,
		fail: (status, reject) => {
			if (status === 403) {
				reject(new UploadException(UploadExceptionCode.UPLOAD_CREDENTIALS_IS_EXPIRED))
			}
		},
	}).then((res) => {
		// Extract key from URL if not provided
		const objectKey = params.key || key
		return normalizeSuccessResponse(objectKey, PlatformType.S3, res.headers)
	})
}

/**
 * @description: Simple upload using AccessKey/SecretKey with Signature V4
 * @param {File | Blob} file File to upload
 * @param {String} key Object key
 * @param {S3.STSAuthParams} params Credentials parameters
 * @param {PlatformSimpleUploadOption} option Upload options
 */
export const signedUpload: PlatformRequest<S3.STSAuthParams, PlatformSimpleUploadOption> = async (
	file,
	key,
	params,
	option,
) => {
	const {
		bucket,
		region,
		dir,
		accessKeyId,
		secretAccessKey,
		sessionToken,
		endpoint,
		pathStyle = true,
	} = params

	if (!bucket || !region || !dir || !accessKeyId || !secretAccessKey || !endpoint) {
		throw new InitException(
			InitExceptionCode.MISSING_CREDENTIALS_PARAMS_FOR_UPLOAD,
			"s3",
			"bucket",
			"region",
			"dir",
			"accessKeyId",
			"secretAccessKey",
			"endpoint",
		)
	}

	// S3 PUT Object upload limit is 5GB
	if (file?.size > 5 * 1024 * 1024 * 1024) {
		throw new InitException(InitExceptionCode.UPLOAD_FILE_TO_BIG, key)
	}

	const objectKey = `${dir}${key}`

	// Build S3 URL
	const url = buildS3Url(bucket, objectKey, endpoint, pathStyle)

	// Determine content type
	let contentType: string | null = null
	const fileMimeType = mime.getType(parseExtname(key))
	if (fileMimeType) {
		contentType = fileMimeType
	}

	const baseHeaders: Record<string, string> = {}
	if (contentType) {
		baseHeaders["Content-Type"] = contentType
	}

	// Sign request
	const signedHeaders = await signRequest({
		method: "PUT",
		url,
		headers: baseHeaders,
		body: file,
		accessKeyId,
		secretAccessKey,
		sessionToken,
		region,
		service: "s3",
	})

	// Send request
	return request<S3.PutResponse>({
		method: "PUT",
		url: url,
		data: file,
		headers: signedHeaders,
		taskId: option.taskId,
		onProgress: option?.progress ? option.progress : () => {},
		withoutWrapper: true,
		fail: (status, reject) => {
			if (status === 403) {
				reject(new UploadException(UploadExceptionCode.UPLOAD_CREDENTIALS_IS_EXPIRED))
			}
		},
	}).then((res) => {
		return normalizeSuccessResponse(objectKey, PlatformType.S3, res.headers)
	})
}

