import mime from "mime"
import { InitException, InitExceptionCode } from "../../Exception/InitException"
import { UploadException, UploadExceptionCode } from "../../Exception/UploadException"
import type { MethodType, PlatformMultipartUploadOption, PlatformRequest } from "../../types"
import type { OSS } from "../../types/OSS"
import type { ErrorType } from "../../types/error"
import { createRequest, omit, uploadPart } from "./utils/helper"
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
import { STSUpload } from "./STSUpload"

/**
 * @description: 复杂上传初始化， 用于获取向OSS服务获取 uploadId
 * @param {string} name 文件名
 * @param {OSS.MultipartUploadParams} params 上传凭证等字段
 * @param {OSS.InitMultipartUploadOption} option  配置字段
 */
async function initMultipartUpload(
	name: string,
	params: OSS.MultipartUploadParams,
	option: OSS.InitMultipartUploadOption,
) {
	const result = await request<OSS.InitMultipartUploadResponse>({
		...createRequest(
			{
				...params,
				method: "POST",
				subRes: "uploads",
				object: name,
			},
			option,
		),
		xmlResponse: true,
	})

	const { data } = result
	return {
		res: result,
		bucket: data.InitiateMultipartUploadResult.Bucket,
		name: data.InitiateMultipartUploadResult.Key,
		uploadId: data.InitiateMultipartUploadResult.UploadId,
	}
}

/**
 * @description: 分片上传完毕后，需要调用此方法，完成分片上传
 * @param {String} name 文件路径名称
 * @param {String} uploadId 上传Id
 * @param {Array} parts 分片信息
 *        {Integer} 分片 No 号
 *        {String} 分片 etag
 * @param params
 * @param {OSS.MultipartUploadParams} options 上传凭证等信息
 * @param {OSS.CompleteMultipartUploadOptions} options 配置字段
 */
async function completeMultipartUpload(
	// @ts-ignore
	name: string,
	uploadId: string,
	parts: Array<{ number: number; etag: string }>,
	params: OSS.MultipartUploadParams,
	options: OSS.CompleteMultipartUploadOptions,
) {
	const completeParts = parts
		.concat()
		.sort((a, b) => a.number - b.number)
		.filter((item, index, arr) => !index || item.number !== arr[index - 1].number)
	let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<CompleteMultipartUpload>\n'
	for (let i = 0; i < completeParts.length; i += 1) {
		const p = completeParts[i]
		xml += "<Part>\n"
		xml += `<PartNumber>${p.number}</PartNumber>\n`
		xml += `<ETag>${p.etag}</ETag>\n`
		xml += "</Part>\n"
	}
	xml += "</CompleteMultipartUpload>"
	const opt = { ...options, mime: "xml" }
	opt.headers = omit(opt.headers, ["x-oss-server-side-encryption", "x-oss-storage-class"])
	const configParams = {
		...params,
		method: <MethodType>"POST",
		subRes: { uploadId },
		content: xml,
	}
	// if (!(options.headers && options.headers["x-oss-callback"])) {
	// 	// eslint-disable-next-line no-param-reassign
	// 	params.xmlResponse = true
	// }
	const {
		data: { path, platform },
		headers,
	} = await request<OSS.CompleteMultipartUploadResponse>({
		...createRequest(configParams, opt),
	})
	if (options.progress) {
		const { partSize } = opt
		options.progress(100, parts.length * partSize, parts.length * partSize, null)
	}
	return normalizeSuccessResponse(path, platform, headers)
}

/**
 * @description: 用于分片上传，或恢复断点续传
 * @param {Object} checkpoint the 文件上传检查点信息
 * @param {OSS.MultipartUploadParams} params 上传凭证信息
 * @param {OSS.MultipartUploadOption} options 配置字段
 */
async function resumeMultipart(
	checkpoint: OSS.Checkpoint,
	params: OSS.MultipartUploadParams,
	options: OSS.ResumeMultipartOption,
) {
	const { file, fileSize, partSize, uploadId, doneParts, name } = checkpoint
	const internalDoneParts = doneParts.length > 0 ? [...doneParts] : []
	const partOffs = divideParts(fileSize, partSize)
	const numParts = partOffs.length
	let multipartFinish = false
	const opt = { ...options, partSize }
	const uploadPartJob = (partNo: number): Promise<void | OSS.DonePart> =>
		// eslint-disable-next-line no-async-promise-executor
		new Promise(async (resolve, reject) => {
			try {
				const pi = partOffs[partNo - 1]
				const content = await createBuffer(file, pi.start, pi.end)
				const data: OSS.PartInfo = {
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

					if (options.progress) {
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
	// upload in parallel
	const jobErr: ErrorType.UploadPartException[] = await parallelSend(
		todo,
		parallel,
		(value) =>
			new Promise((resolve, reject) => {
				uploadPartJob(value)
					.then((result: OSS.DonePart | void) => {
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
		// 5001 取消上传，5002 暂停上传
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
 * @description: 分片上传/断点续传
 * @param {File | Blob} file 文件上传
 * @param {String} key 文件名
 * @param {OSS.MultipartUploadParams} params 上传凭证信息
 * @param {OSS.MultipartUploadOption} option 配置字段
 */
export const MultipartUpload: PlatformRequest<
	OSS.STSAuthParams,
	PlatformMultipartUploadOption
> = async (file, key, params, option) => {
	const options = { ...option }
	// eslint-disable-next-line @typescript-eslint/naming-convention
	const { region, bucket, dir, access_key_secret, access_key_id, sts_token, callback } = params

	if (
		!region ||
		!bucket ||
		!dir ||
		!access_key_secret ||
		!access_key_id ||
		!sts_token ||
		!callback
	) {
		throw new InitException(
			InitExceptionCode.MISSING_CREDENTIALS_PARAMS_FOR_UPLOAD,
			"aliyun",
			"region",
			"bucket",
			"dir",
			"access_key_id",
			"access_key_secret",
			"sts_token",
			"callback",
		)
	}
	const name = `${dir}${key}`
	// 配置信息等参数
	const configParams: OSS.MultipartUploadParams = {
		bucket,
		region,
		object: name,
		accessKeyId: access_key_id,
		accessKeySecret: access_key_secret,
		stsToken: sts_token,
		callback,
		taskId: option.taskId,
	}
	if (!options.mime) {
		if (isFile(file)) {
			options.mime = file.type
		} else if (isBlob(file)) {
			options.mime = file.type
		} else {
			options.mime = mime.getType(parseExtname(name))
		}
	}

	if (options.checkpoint && options.checkpoint.uploadId) {
		if (file && isFile(file)) options.checkpoint.file = file
		if (file) options.checkpoint.file = file

		return resumeMultipart(options.checkpoint, configParams, options)
	}

	// 最小分片大小
	const minPartSize = 100 * 1024

	options.headers = options.headers || {}

	const fileSize = file.size
	if (fileSize < minPartSize) {
		return STSUpload(file, key, params, { ...options })
	}
	if (options.partSize && !(parseInt(String(options.partSize), 10) === options.partSize)) {
		throw new InitException(InitExceptionCode.UPLOAD_API_OPTION_PARTSIZE_MUST_INT)
	}

	if (options.partSize && options.partSize < minPartSize) {
		throw new InitException(InitExceptionCode.UPLOAD_API_OPTION_PARTSIZE_IS_SMALL, minPartSize)
	}

	const initResult = await initMultipartUpload(name, configParams, {
		mime: options.mime,
		headers: options.headers,
	})

	const { uploadId } = initResult
	const partSize = getPartSize(fileSize, <number>options.partSize)

	const checkpoint: OSS.Checkpoint = initCheckpoint(file, name, fileSize, partSize, uploadId)

	if (options && options.progress) {
		options.progress(0, 0, fileSize, checkpoint)
	}

	return resumeMultipart(checkpoint, configParams, {
		...options,
	})
}
