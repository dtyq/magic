import { InitException, InitExceptionCode } from "../../Exception/InitException"
import type { MethodType, PlatformMultipartUploadOption, PlatformRequest } from "../../types"
import { PlatformType } from "../../types"
import type { OSS } from "../../types/OSS"
import { createRequest } from "./utils/helper"
import { request } from "../../utils/request"
import { normalizeSuccessResponse } from "../../utils/response"

/**
 * @description: STS 上传
 * @param {File | Blob} file 文件
 * @param {String} key 文件名
 * @param {OSS.STSAuthParams} params 上传凭证信息
 * @param {PlatformMultipartUploadOption} option 配置字段
 */
export const STSUpload: PlatformRequest<OSS.STSAuthParams, PlatformMultipartUploadOption> = async (
	file,
	key,
	params,
	option,
) => {
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
			"alien",
			"region",
			"bucket",
			"dir",
			"access_key_secret",
			"access_key_id",
			"sts_token",
			"callback",
		)
	}

	// 阿里云 PostObject 上传限制 5GB
	if (file?.size > 5 * 1024 * 1024 * 1024) {
		throw new InitException(InitExceptionCode.UPLOAD_FILE_TO_BIG, key)
	}

	const configParams = {
		...params,
		method: <MethodType>"PUT",
		content: file,
		object: `${dir}${key}`,
		accessKeyId: access_key_id,
		accessKeySecret: access_key_secret,
		stsToken: sts_token,
		subRes: "",
	}

	// 发送请求
	return request<OSS.PutResponse>({
		...createRequest(configParams, option),
		taskId: option.taskId,
		onProgress: option?.progress ? option.progress : () => {},
	}).then(({ headers, data: { path } }) => {
		return normalizeSuccessResponse(path, PlatformType.OSS, headers)
	})
}
