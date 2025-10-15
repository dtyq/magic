import mime from "mime"
import { InitException, InitExceptionCode } from "../../Exception/InitException"
import { UploadException, UploadExceptionCode } from "../../Exception/UploadException"
import type { PlatformMultipartUploadOption, PlatformRequest } from "../../types"
import { PlatformType } from "../../types"
import type { ErrorType } from "../../types/error"
import type { S3 } from "../../types/S3"
import { isBlob, isFile } from "../../utils/checkDataFormat"
import {
	createBuffer,
	divideParts,
	getPartSize,
	initCheckpoint,
	parallelSend,
} from "../../utils/multipart"
import { parseExtname } from "../../utils/regExpUtil"
import { request } from "../../utils/request"
import { normalizeSuccessResponse } from "../../utils/response"
import { buildCompleteMultipartXml, buildS3Url, parseXmlResponse } from "./utils/helper"
import { signRequest } from "./utils/signature"
import { STSUpload } from "./STSUpload"

// AWS S3 minimum part size is 5MB
const S3_MIN_PART_SIZE = 5 * 1024 * 1024

/**
 * @description: Initialize multipart upload to get uploadId from S3
 * @param {string} name Object key
 * @param {S3.STSAuthParams} params Credentials parameters
 * @param {S3.InitMultipartUploadOption} option Upload options
 */
async function initMultipartUpload(
	name: string,
	params: S3.STSAuthParams,
	option: S3.InitMultipartUploadOption,
) {
	const {
		bucket,
		region,
		endpoint,
		accessKeyId,
		secretAccessKey,
		sessionToken,
		pathStyle = true,
	} = params

	const url = buildS3Url(bucket, name, endpoint, pathStyle)
	const query = { uploads: "" }

	const baseHeaders: Record<string, string> = {}
	if (option.mime) {
		baseHeaders["Content-Type"] = option.mime
	}

	// Sign request
	const signedHeaders = await signRequest({
		method: "POST",
		url,
		headers: baseHeaders,
		query,
		accessKeyId,
		secretAccessKey,
		sessionToken,
		region,
		service: "s3",
	})

	const result = await request<S3.InitMultipartUploadResponseType>({
		url,
		query,
		headers: signedHeaders,
		method: "POST",
		withoutWrapper: true,
		xmlResponse: true,
		...option,
	})

	const parsedData =
		typeof result.data === "string" ? parseXmlResponse(result.data) : result.data

	return {
		res: result,
		bucket: parsedData.Bucket,
		name: parsedData.Key,
		uploadId: parsedData.UploadId,
	}
}

/**
 * @description: Complete multipart upload after all parts are uploaded
 * @param {String} name Object key
 * @param {String} uploadId Upload ID
 * @param {Array} parts Part information array
 * @param {S3.STSAuthParams} params Credentials parameters
 * @param {S3.CompleteMultipartUploadOptions} options Upload options
 */
async function completeMultipartUpload(
	name: string,
	uploadId: string,
	parts: Array<{ number: number; etag: string }>,
	params: S3.STSAuthParams,
	options: S3.CompleteMultipartUploadOptions,
) {
	const {
		bucket,
		region,
		endpoint,
		accessKeyId,
		secretAccessKey,
		sessionToken,
		pathStyle = true,
	} = params

	const url = buildS3Url(bucket, name, endpoint, pathStyle)
	const query = { uploadId }

	// Build complete multipart upload XML payload
	const xmlPayload = buildCompleteMultipartXml(parts)

	const baseHeaders: Record<string, string> = {
		"Content-Type": "application/xml",
	}

	// Sign request
	const signedHeaders = await signRequest({
		method: "POST",
		url,
		headers: baseHeaders,
		query,
		body: xmlPayload,
		accessKeyId,
		secretAccessKey,
		sessionToken,
		region,
		service: "s3",
	})

	const result = await request<S3.CompleteMultipartUploadResponseType>({
		url,
		method: "POST",
		query,
		headers: signedHeaders,
		data: xmlPayload,
		...options,
	})

	if (options.progress && options.partSize) {
		options.progress(100, parts.length * options.partSize, parts.length * options.partSize, null)
	}

	return normalizeSuccessResponse(name, PlatformType.S3, result.headers)
}

/**
 * @description: Upload a single part
 * @param {String} name Object key
 * @param {String} uploadId Upload ID
 * @param {number} partNo Part number
 * @param {S3.PartInfo} data Part data
 * @param {S3.STSAuthParams} params Credentials parameters
 * @param {S3.MultipartUploadOption} options Upload options
 */
async function uploadPart(
	name: string,
	uploadId: string,
	partNo: number,
	data: S3.PartInfo,
	params: S3.STSAuthParams,
	options: S3.MultipartUploadOption,
) {
	const {
		bucket,
		region,
		endpoint,
		accessKeyId,
		secretAccessKey,
		sessionToken,
		pathStyle = true,
	} = params

	const url = buildS3Url(bucket, name, endpoint, pathStyle)
	const query = { partNumber: partNo, uploadId }

	// Sign request
	const signedHeaders = await signRequest({
		method: "PUT",
		url,
		headers: {},
		query,
		body: data.content,
		accessKeyId,
		secretAccessKey,
		sessionToken,
		region,
		service: "s3",
	})

	const result = await request<S3.UploadPartResponse>({
		url,
		query,
		method: "PUT",
		data: data.content,
		headers: signedHeaders,
		taskId: `${partNo}`,
		withoutWrapper: true,
		...options,
	})

	if (!result.headers.etag) {
		throw new InitException(InitExceptionCode.UPLOAD_HEAD_NO_EXPOSE_ETAG)
	}

	return {
		name,
		etag: result.headers.etag,
		res: result,
	}
}

/**
 * @description: Resume multipart upload or perform multipart upload
 * @param {Object} checkpoint Upload checkpoint information
 * @param {S3.STSAuthParams} params Credentials parameters
 * @param {S3.MultipartUploadOption} options Upload options
 */
async function resumeMultipart(
	checkpoint: S3.Checkpoint,
	params: S3.STSAuthParams,
	options: S3.MultipartUploadOption,
) {
	const { file, fileSize, partSize, uploadId, doneParts, name } = checkpoint
	const internalDoneParts = doneParts.length > 0 ? [...doneParts] : []
	const partOffs = divideParts(fileSize, partSize)
	const numParts = partOffs.length
	let multipartFinish = false
	const opt = { ...options, partSize }

	const uploadPartJob = (partNo: number): Promise<void | S3.DonePart> =>
		// eslint-disable-next-line no-async-promise-executor
		new Promise(async (resolve, reject) => {
			try {
				const pi = partOffs[partNo - 1]
				const content = await createBuffer(file, pi.start, pi.end)
				const data = {
					content,
					size: pi.end - pi.start,
				}

				const result = await uploadPart(name, uploadId, partNo, data, params, {
					...opt,
				})

				if (!multipartFinish) {
					checkpoint.doneParts.push({
						number: partNo,
						etag: result.etag,
					})

					if (typeof options.progress === "function") {
						options.progress(
							(doneParts.length / (numParts + 1)) * 100,
							doneParts.length * partSize,
							fileSize,
							checkpoint,
						)
					}

					resolve({
						number: partNo,
						etag: result.etag,
					})
				} else {
					resolve()
				}
			} catch (err: any) {
				const tempErr = new Error() as unknown as ErrorType.UploadPartException
				tempErr.name = err.name
				tempErr.message = err.message
				tempErr.stack = err.stack
				tempErr.partNum = partNo
				tempErr.status = err.status

				reject(tempErr)
			}
		})

	const all = Array.from(new Array(numParts), (_, i) => i + 1)
	const done = internalDoneParts.map((p) => p.number)
	const todo = all.filter((p) => done.indexOf(p) < 0)
	const defaultParallel = 5
	const parallel = opt.parallel || defaultParallel

	// Upload in parallel
	const jobErr: ErrorType.UploadPartException[] = await parallelSend(
		todo,
		parallel,
		(value) =>
			new Promise((resolve, reject) => {
				uploadPartJob(value)
					.then((result: S3.DonePart | void) => {
						if (result) {
							internalDoneParts.push(result)
						}
						resolve()
					})
					.catch((err) => {
						reject(err)
					})
			}),
	)

	multipartFinish = true

	if (jobErr && jobErr.length > 0) {
		const error = jobErr[0]
		// 5001 cancel upload, 5002 pause upload
		if (error.status === 5001 || error.status === 5002) {
			throw error as Error
		}
		throw new UploadException(
			UploadExceptionCode.UPLOAD_MULTIPART_ERROR,
			error.message.replace("[Uploader] ", ""),
			error.partNum,
		)
	}

	return completeMultipartUpload(name, uploadId, internalDoneParts, params, opt)
}

/**
 * @description: Multipart upload interface, supports resumable upload
 * @param {File | Blob} file File to upload
 * @param {String} key Object key
 * @param {S3.STSAuthParams} params Credentials parameters
 * @param {S3.MultipartUploadOption} option Upload options
 */
export const MultipartUpload: PlatformRequest<
	S3.STSAuthParams,
	PlatformMultipartUploadOption
> = async (
	file: File | Blob,
	key: string,
	params: S3.STSAuthParams,
	option: PlatformMultipartUploadOption,
) => {
	const options = { ...option }
	const { region, bucket, dir, accessKeyId, secretAccessKey, endpoint } = params

	if (!region || !bucket || !dir || !accessKeyId || !secretAccessKey || !endpoint) {
		throw new InitException(
			InitExceptionCode.MISSING_CREDENTIALS_PARAMS_FOR_UPLOAD,
			"s3",
			"region",
			"bucket",
			"dir",
			"accessKeyId",
			"secretAccessKey",
			"endpoint",
		)
	}

	const name = `${dir}${key}`

	// Determine MIME type
	if (!options.mime) {
		if (isFile(file)) {
			options.mime = file.type
		} else if (isBlob(file)) {
			options.mime = file.type
		} else {
			options.mime = mime.getType(parseExtname(name))
		}
	}

	// Resume from checkpoint if available
	if (options.checkpoint && options.checkpoint.uploadId) {
		if (file && isFile(file)) options.checkpoint.file = file
		if (file) options.checkpoint.file = file

		return resumeMultipart(options.checkpoint, params, options)
	}

	options.headers = options.headers || {}

	const fileSize = file.size

	// Use simple upload for files smaller than minimum part size
	if (fileSize < S3_MIN_PART_SIZE) {
		return STSUpload(file, key, params, { ...options })
	}

	// Validate part size
	if (options.partSize && !(parseInt(String(options.partSize), 10) === options.partSize)) {
		throw new InitException(InitExceptionCode.UPLOAD_API_OPTION_PARTSIZE_MUST_INT)
	}

	if (options.partSize && options.partSize < S3_MIN_PART_SIZE) {
		throw new InitException(
			InitExceptionCode.UPLOAD_API_OPTION_PARTSIZE_IS_SMALL,
			S3_MIN_PART_SIZE,
		)
	}

	// Initialize multipart upload
	const { uploadId } = await initMultipartUpload(name, params, {
		headers: { ...options.headers },
		mime: options.mime,
	})

	// Calculate part size
	const partSize = getPartSize(fileSize, <number>options.partSize, S3_MIN_PART_SIZE)

	const checkpoint: S3.Checkpoint = initCheckpoint(file, name, fileSize, partSize, uploadId)

	if (options && options.progress) {
		options.progress(0, 0, fileSize, checkpoint)
	}

	return resumeMultipart(checkpoint, params, options)
}

