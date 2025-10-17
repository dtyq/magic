import {
	CompleteMultipartUploadCommand,
	CreateMultipartUploadCommand,
	S3Client,
	UploadPartCommand,
} from "@aws-sdk/client-s3"
import mime from "mime"
import { InitException, InitExceptionCode } from "../../Exception/InitException"
import { UploadException, UploadExceptionCode } from "../../Exception/UploadException"
import type { PlatformMultipartUploadOption, PlatformRequest } from "../../types"
import { PlatformType } from "../../types"
import type { ErrorType } from "../../types/error"
import type { MinIO } from "../../types/MinIO"
import { isBlob, isFile } from "../../utils/checkDataFormat"
import {
	createBuffer,
	divideParts,
	getPartSize,
	initCheckpoint,
	parallelSend,
} from "../../utils/multipart"
import { parseExtname } from "../../utils/regExpUtil"
import { createAbortSignal, getTaskAbortState } from "../../utils/request"
import { normalizeSuccessResponse } from "../../utils/response"
import { STSUpload } from "./STSUpload"

// AWS S3 minimum part size is 5MB
const S3_MIN_PART_SIZE = 5 * 1024 * 1024

/**
 * Create an abort error with correct status code based on task abort state
 * @param {string} taskId Task ID
 * @param {string} message Error message
 * @returns Error with status property
 */
function createAbortError(taskId: string | undefined, message: string): Error {
	const abortError = new Error(message) as any
	if (taskId) {
		const abortState = getTaskAbortState(taskId)
		// 5001 = cancel, 5002 = pause
		abortError.status = abortState === "pause" ? 5002 : 5001
	} else {
		abortError.status = 5001 // Default to cancel
	}
	return abortError
}

/**
 * Create S3Client instance with provided credentials
 */
function createS3Client(params: MinIO.STSAuthParams): S3Client {
	const { endpoint, region, access_key_id, secret_access_key, session_token } = params

	return new S3Client({
		region,
		endpoint,
		credentials: {
			accessKeyId: access_key_id,
			secretAccessKey: secret_access_key,
			sessionToken: session_token,
		},
		// Force path-style for MinIO compatibility
		forcePathStyle: true,
	})
}

/**
 * @description: Initialize multipart upload to get uploadId from S3
 * @param {string} name Object key
 * @param {MinIO.STSAuthParams} params Credentials parameters
 * @param {MinIO.InitMultipartUploadOption} option Upload options
 * @param {AbortSignal} abortSignal Optional abort signal for cancellation
 * @param {string} taskId Optional task ID for error handling
 */
async function initMultipartUpload(
	name: string,
	params: MinIO.STSAuthParams,
	option: MinIO.InitMultipartUploadOption,
	abortSignal?: AbortSignal,
	taskId?: string,
) {
	const { bucket } = params

	// Create S3 client
	const s3Client = createS3Client(params)

	// Create command
	const command = new CreateMultipartUploadCommand({
		Bucket: bucket,
		Key: name,
		ContentType: option.mime || undefined,
	})

	try {
		const response = await s3Client.send(command, abortSignal ? { abortSignal } : {})

		return {
			bucket: response.Bucket || bucket,
			name: response.Key || name,
			uploadId: response.UploadId || "",
		}
	} catch (error: any) {
		// Handle abort errors
		if (error.name === "AbortError" || error.name === "CanceledError") {
			throw createAbortError(taskId, "Upload initialization aborted")
		}
		
		if (error.name === "InvalidAccessKeyId" || error.name === "SignatureDoesNotMatch" || error.$metadata?.httpStatusCode === 403) {
			throw new UploadException(
				UploadExceptionCode.UPLOAD_CREDENTIALS_IS_EXPIRED,
				"Failed to initialize multipart upload: Invalid credentials",
			)
		}
		throw error
	}
}

/**
 * @description: Complete multipart upload after all parts are uploaded
 * @param {String} name Object key
 * @param {String} uploadId Upload ID
 * @param {Array} parts Part information array
 * @param {MinIO.STSAuthParams} params Credentials parameters
 * @param {MinIO.CompleteMultipartUploadOptions} options Upload options
 * @param {number} fileSize Total file size
 * @param {AbortSignal} abortSignal Optional abort signal for cancellation
 * @param {string} taskId Optional task ID for error handling
 */
async function completeMultipartUpload(
	name: string,
	uploadId: string,
	parts: Array<{ number: number; etag: string }>,
	params: MinIO.STSAuthParams,
	options: MinIO.CompleteMultipartUploadOptions,
	fileSize: number,
	abortSignal?: AbortSignal,
	taskId?: string,
) {
	const { bucket } = params

	// Create S3 client
	const s3Client = createS3Client(params)

	// Sort parts by part number and remove duplicates
	const sortedParts = parts
		.concat()
		.sort((a, b) => a.number - b.number)
		.filter((item, index, arr) => {
			const prevItem = arr[index - 1]
			return !index || (prevItem && item.number !== prevItem.number)
		})

	// Create command
	const command = new CompleteMultipartUploadCommand({
		Bucket: bucket,
		Key: name,
		UploadId: uploadId,
		MultipartUpload: {
			Parts: sortedParts.map((part) => ({
				PartNumber: part.number,
				ETag: part.etag,
			})),
		},
	})

	try {
		const response = await s3Client.send(command, abortSignal ? { abortSignal } : {})

		// Report 100% completion with actual file size
		if (options.progress) {
			options.progress(100, fileSize, fileSize, null)
		}

		return normalizeSuccessResponse(name, PlatformType.Minio, {
			etag: response.ETag || "",
			location: response.Location || "",
		})
	} catch (error: any) {
		// Handle abort errors
		if (error.name === "AbortError" || error.name === "CanceledError") {
			throw createAbortError(taskId, "Upload completion aborted")
		}
		
		if (error.name === "InvalidAccessKeyId" || error.name === "SignatureDoesNotMatch" || error.$metadata?.httpStatusCode === 403) {
			throw new UploadException(
				UploadExceptionCode.UPLOAD_CREDENTIALS_IS_EXPIRED,
				"Failed to complete multipart upload: Invalid credentials",
			)
		}
		throw error
	}
}

/**
 * @description: Upload a single part
 * @param {String} name Object key
 * @param {String} uploadId Upload ID
 * @param {number} partNo Part number
 * @param {MinIO.PartInfo} data Part data
 * @param {MinIO.STSAuthParams} params Credentials parameters
 * @param {MinIO.MultipartUploadOption} options Upload options
 * @param {AbortSignal} abortSignal Optional abort signal for cancellation
 * @param {string} taskId Optional task ID for error handling
 */
async function uploadPart(
	name: string,
	uploadId: string,
	partNo: number,
	data: MinIO.PartInfo,
	params: MinIO.STSAuthParams,
	options: MinIO.MultipartUploadOption,
	abortSignal?: AbortSignal,
	taskId?: string,
) {
	const { bucket } = params

	// Create S3 client
	const s3Client = createS3Client(params)

	// Convert data.content to Uint8Array if needed
	let bodyData: Uint8Array
	if (data.content instanceof ArrayBuffer) {
		bodyData = new Uint8Array(data.content)
	} else if (data.content instanceof Blob) {
		const arrayBuffer = await data.content.arrayBuffer()
		bodyData = new Uint8Array(arrayBuffer)
	} else {
		bodyData = data.content as Uint8Array
	}

	// Create command
	const command = new UploadPartCommand({
		Bucket: bucket,
		Key: name,
		UploadId: uploadId,
		PartNumber: partNo,
		Body: bodyData,
	})

	try {
		// Send command with optional abort signal
		const response = await s3Client.send(command, abortSignal ? { abortSignal } : {})

		if (!response.ETag) {
			throw new InitException(InitExceptionCode.UPLOAD_HEAD_NO_EXPOSE_ETAG)
		}

		return {
			name,
			etag: response.ETag,
			res: response,
		}
	} catch (error: any) {
		// Handle abort errors
		if (error.name === "AbortError" || error.name === "CanceledError") {
			throw createAbortError(taskId, "Upload part aborted")
		}
		
		if (error.name === "InvalidAccessKeyId" || error.name === "SignatureDoesNotMatch" || error.$metadata?.httpStatusCode === 403) {
			const errorDetails = [
				"MinIO/S3 multipart upload authentication failed.",
				"Possible causes:",
				"1. Access Key ID or Secret Access Key is incorrect",
				"2. Region or endpoint configuration mismatch",
				"3. System time difference exceeds 15 minutes",
				"4. Credentials do not have permission to upload to this bucket/path",
				"5. Session token has expired (for temporary credentials)",
			].join(" ")
			
			throw new UploadException(
				UploadExceptionCode.UPLOAD_CREDENTIALS_IS_EXPIRED,
				errorDetails,
			)
		}
		throw error
	}
}

/**
 * @description: Resume multipart upload or perform multipart upload
 * @param {Object} checkpoint Upload checkpoint information
 * @param {MinIO.STSAuthParams} params Credentials parameters
 * @param {MinIO.MultipartUploadOption} options Upload options
 */
async function resumeMultipart(
	checkpoint: MinIO.Checkpoint,
	params: MinIO.STSAuthParams,
	options: MinIO.MultipartUploadOption,
) {
	const taskId = options.taskId
	const { file, fileSize, partSize, uploadId, doneParts, name } = checkpoint
	const internalDoneParts = doneParts.length > 0 ? [...doneParts] : []
	const partOffs = divideParts(fileSize, partSize)
	const numParts = partOffs.length
	let multipartFinish = false
	const opt = { ...options, partSize }

	const uploadPartJob = (partNo: number): Promise<void | MinIO.DonePart> =>
		// eslint-disable-next-line no-async-promise-executor
		new Promise(async (resolve, reject) => {
			try {
				const pi = partOffs[partNo - 1]
				if (!pi) {
					reject(new Error(`Part ${partNo} not found`))
					return
				}
				const content = await createBuffer(file, pi.start, pi.end)
				const data = {
					content,
					size: pi.end - pi.start,
				}

				// Create abort signal for this upload part if taskId exists
				const abortSignal = taskId ? createAbortSignal(taskId) : undefined

				const result = await uploadPart(name, uploadId, partNo, data, params, {
					...opt,
				}, abortSignal, taskId)

				if (!multipartFinish) {
					checkpoint.doneParts.push({
						number: partNo,
						etag: result.etag,
					})

					if (typeof options.progress === "function") {
						const completedParts = checkpoint.doneParts.length
						const progressPercent = (completedParts / numParts) * 100
						// Calculate actual uploaded size considering last part may be smaller
						const uploadedSize = Math.min(completedParts * partSize, fileSize)
						options.progress(
							progressPercent,
							uploadedSize,
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
					.then((result: MinIO.DonePart | void) => {
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
		if (!error) {
			throw new UploadException(UploadExceptionCode.UPLOAD_MULTIPART_ERROR, "Unknown upload error")
		}
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

	// Create abort signal for completion if taskId exists
	const completeAbortSignal = taskId ? createAbortSignal(taskId) : undefined
	return completeMultipartUpload(name, uploadId, internalDoneParts, params, opt, fileSize, completeAbortSignal, taskId)
}

/**
 * @description: Multipart upload interface, supports resumable upload
 * @param {File | Blob} file File to upload
 * @param {String} key Object key
 * @param {MinIO.STSAuthParams} params Credentials parameters
 * @param {MinIO.MultipartUploadOption} option Upload options
 */
export const MultipartUpload: PlatformRequest<
	MinIO.STSAuthParams,
	PlatformMultipartUploadOption
> = async (
	file: File | Blob,
	key: string,
	params: MinIO.STSAuthParams,
	option: PlatformMultipartUploadOption,
) => {
	const options = { ...option }
	const { region, bucket, dir, access_key_id, secret_access_key, endpoint } = params

	if (!region || !bucket || !dir || !access_key_id || !secret_access_key || !endpoint) {
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
		// Update file reference in checkpoint
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
	const taskId = options.taskId
	const initAbortSignal = taskId ? createAbortSignal(taskId) : undefined
	const { uploadId } = await initMultipartUpload(name, params, {
		headers: { ...options.headers },
		mime: options.mime,
	}, initAbortSignal, taskId)

	// Calculate part size
	const partSize = getPartSize(fileSize, <number>options.partSize, S3_MIN_PART_SIZE)

	const checkpoint: MinIO.Checkpoint = initCheckpoint(file, name, fileSize, partSize, uploadId)

	if (options && options.progress) {
		options.progress(0, 0, fileSize, checkpoint)
	}

	return resumeMultipart(checkpoint, params, options)
}

