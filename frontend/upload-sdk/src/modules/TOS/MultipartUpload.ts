import mime from "mime"
import { InitException, InitExceptionCode } from "../../Exception/InitException"
import { UploadException, UploadExceptionCode } from "../../Exception/UploadException"
import type { PlatformMultipartUploadOption, PlatformRequest } from "../../types"
import { PlatformType } from "../../types"
import type { ErrorType } from "../../types/error"
import type { DataWrapperWithHeaders } from "../../types/request"
import type { TOS } from "../../types/TOS"
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
import { VOLCENGINE_MIN_PART_SIZE, getAuthHeaders, removeProtocol } from "./utils"
import { SignersV4 } from "./utils/signatureV4"
import { getSortedQueryString } from "./utils/utils"
import { STSUpload } from "./STSUpload"
import { SignatureV4Credentials } from "./utils/signatureV4Credentials"

/**
 * @description: 复杂上传初始化， 用于获取向TOS服务获取 uploadId
 * @param {string} name 文件名
 * @param {TOS.STSAuthParams} params 上传凭证等字段
 * @param {TOS.InitMultipartUploadOption} option  配置字段
 */
async function initMultipartUpload(
	name: string,
	{ bucket, host, expires }: TOS.STSAuthParams,
	{ signers, headers: OptionHeaders, ...otherOptions }: TOS.InitMultipartUploadOption,
) {
	const headers = { ...OptionHeaders }

	const reqHeaders = getAuthHeaders(
		{
			bucket,
			method: "POST",
			headers,
			path: `/${encodeURIComponent(name)}`,
			query: getSortedQueryString({ uploads: "" }),
			host: removeProtocol(host),
		},
		signers,
		expires,
	)

	const { data } = await request<DataWrapperWithHeaders<TOS.InitMultipartUploadResponse>>({
		url: `${host}/${encodeURIComponent(name)}`,
		query: { uploads: "" },
		headers: { ...headers, ...reqHeaders },
		method: "POST",
		withoutWrapper: true,
		...otherOptions,
	})

	return {
		res: data,
		bucket: data.Bucket,
		name: data.Key,
		uploadId: data.UploadId,
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
 * @param {TOS.MultipartUploadParams} options 上传凭证等信息
 * @param {TOS.CompleteMultipartUploadOptions} options 配置字段
 */
async function completeMultipartUpload(
	name: string,
	uploadId: string,
	parts: Array<{ number: number; etag: string }>,
	{ bucket, host, expires }: TOS.STSAuthParams,
	{ signers, progress, partSize, ...otherOptions }: TOS.CompleteMultipartUploadOptions,
) {
	const completeParts = parts
		.concat()
		.sort((a, b) => a.number - b.number)
		.filter((item, index, arr) => !index || item.number !== arr[index - 1].number)

	const headers = {}

	const reqHeaders = getAuthHeaders(
		{
			bucket,
			method: "POST",
			headers,
			path: `/${encodeURIComponent(name)}`,
			query: getSortedQueryString({ uploadId }),
			host: removeProtocol(host),
		},
		signers,
		expires,
	)

	const result = await request<TOS.CompleteMultipartUploadResponse>({
		url: `${host}/${encodeURIComponent(name)}`,
		method: "POST",
		query: {
			uploadId,
		},
		headers: { ...headers, ...reqHeaders },
		data: JSON.stringify({
			Parts: completeParts.map((item) => ({
				eTag: item.etag,
				partNumber: item.number,
			})),
		}),
		...otherOptions,
	})

	if (progress && partSize) {
		progress(100, parts.length * partSize, parts.length * partSize, null)
	}
	return normalizeSuccessResponse(result.Key, PlatformType.TOS, result.headers)
}

/**
 * @description: 用于上传某一部分片段
 * @param {String} name 文件名
 * @param {String} uploadId 本次上传的Id
 * @param {number} partNo 第几个片段
 * @param {TOS.PartInfo} data 分片数据
 * @param params
 * @param {TOS.MultipartUploadOption} options 配置字段
 * @returns 返回异步结果
 */
async function uploadPart(
	name: string,
	uploadId: string,
	partNo: number,
	data: TOS.PartInfo,
	{ bucket, host, expires }: TOS.STSAuthParams,
	{ signers, ...otherOptions }: TOS.MultipartUploadOption,
) {
	const headers = {}

	const reqHeaders = getAuthHeaders(
		{
			bucket,
			method: "PUT",
			headers,
			path: `/${encodeURIComponent(name)}`,
			query: getSortedQueryString({ partNumber: partNo, uploadId }),
			host: removeProtocol(host),
		},
		signers,
		expires,
	)

	const result = await request<TOS.UploadPartResponse>({
		url: `${host}/${encodeURIComponent(name)}`,
		query: { partNumber: `${partNo}`, uploadId },
		method: "PUT",
		data: data.content,
		headers: { ...headers, ...reqHeaders },
		taskId: `${partNo}`,
		...otherOptions,
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
 * @description: 用于分片上传，或恢复断点续传
 * @param {Object} checkpoint the 文件上传检查点信息
 * @param {TOS.MultipartUploadParams} params 上传凭证信息
 * @param {TOS.ResumeMultipartOption} options 配置字段
 */
async function resumeMultipart(
	checkpoint: TOS.Checkpoint,
	params: TOS.STSAuthParams,
	options: TOS.MultipartUploadOption,
) {
	const { file, fileSize, partSize, uploadId, doneParts, name } = checkpoint
	const internalDoneParts = doneParts.length > 0 ? [...doneParts] : []
	const partOffs = divideParts(fileSize, partSize)
	const numParts = partOffs.length
	let multipartFinish = false
	const opt = { ...options, partSize }
	const uploadPartJob = (partNo: number): Promise<void | TOS.DonePart> =>
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
	// upload in parallel
	const jobErr: ErrorType.UploadPartException[] = await parallelSend(
		todo,
		parallel,
		(value) =>
			new Promise((resolve, reject) => {
				uploadPartJob(value)
					.then((result: TOS.DonePart | void) => {
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
 * @description: 复杂上传接口， 例如分片上传，断点续传
 * @param {File | Blob} file 文件上传
 * @param {String} key 文件名
 * @param {TOS.STSAuthParams} params 上传凭证信息
 * @param {TOS.MultipartUploadOption} option 配置字段
 */
export const MultipartUpload: PlatformRequest<
	TOS.STSAuthParams,
	PlatformMultipartUploadOption
> = async (
	file: File | Blob,
	key: string,
	params: TOS.STSAuthParams,
	option: PlatformMultipartUploadOption,
) => {
	const options = { ...option }
	const {
		region,
		bucket,
		dir,
		credentials: { AccessKeyId, SecretAccessKey, SessionToken },
	} = params

	if (!region || !bucket || !dir || !SecretAccessKey || !AccessKeyId || !SessionToken) {
		throw new InitException(
			InitExceptionCode.MISSING_CREDENTIALS_PARAMS_FOR_UPLOAD,
			"volcEngine",
			"region",
			"bucket",
			"dir",
			"AccessKeyId",
			"SecretAccessKey",
			"SessionToken",
		)
	}

	const name = `${dir}${key}`

	// 签名工具
	const signV4 = new SignatureV4Credentials(SessionToken, SecretAccessKey, AccessKeyId)
	const signers = new SignersV4(
		{
			algorithm: "TOS4-HMAC-SHA256",
			region,
			serviceName: "tos",
			bucket,
			securityToken: SessionToken,
		},
		signV4,
	)

	const resumeMultipartOptions = {
		...options,
		signers,
	}

	// 生成文件类型
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

		return resumeMultipart(options.checkpoint, params, resumeMultipartOptions)
	}

	options.headers = options.headers || {}

	const fileSize = file.size
	if (fileSize < VOLCENGINE_MIN_PART_SIZE) {
		return STSUpload(file, key, params, { ...options })
	}
	if (options.partSize && !(parseInt(String(options.partSize), 10) === options.partSize)) {
		throw new InitException(InitExceptionCode.UPLOAD_API_OPTION_PARTSIZE_MUST_INT)
	}

	if (options.partSize && options.partSize < VOLCENGINE_MIN_PART_SIZE) {
		throw new InitException(
			InitExceptionCode.UPLOAD_API_OPTION_PARTSIZE_IS_SMALL,
			VOLCENGINE_MIN_PART_SIZE,
		)
	}

	// 初始化分片上传
	const { uploadId } = await initMultipartUpload(name, params, {
		headers: { ...options.headers },
		mime: options.mime,
		signers,
	})

	// 获取分片大小
	const partSize = getPartSize(fileSize, <number>options.partSize, VOLCENGINE_MIN_PART_SIZE)

	const checkpoint: TOS.Checkpoint = initCheckpoint(file, name, fileSize, partSize, uploadId)

	if (options && options.progress) {
		options.progress(0, 0, fileSize, checkpoint)
	}

	return resumeMultipart(checkpoint, params, resumeMultipartOptions)
}
