import mime from "mime"
import { InitException, InitExceptionCode } from "../../Exception/InitException"
import { UploadException, UploadExceptionCode } from "../../Exception/UploadException"
import type { PlatformRequest, PlatformSimpleUploadOption } from "../../types"
import { PlatformType } from "../../types"
import type { TOS } from "../../types/TOS"
import { parseExtname } from "../../utils/regExpUtil"
import { request } from "../../utils/request"
import { normalizeSuccessResponse } from "../../utils/response"
import type { OBS } from "../../types/OBS"

/**
 * @description: 简单上传 post请求
 * @param {File | Blob} file 文件
 * @param {String} key 文件名
 * @param {TOS.AuthParams} params 上传凭证信息
 * @param {PlatformSimpleUploadOption} option 配置字段
 */
const defaultUpload: PlatformRequest<OBS.AuthParams, PlatformSimpleUploadOption> = (
	file,
	key,
	params,
	option,
) => {
	const { AccessKeyId, policy, signature, host, dir, "content-type": contentType } = params

	if (!policy || !AccessKeyId || !signature || !host || !dir) {
		throw new InitException(
			InitExceptionCode.MISSING_CREDENTIALS_PARAMS_FOR_UPLOAD,
			"volcEngine",
			"policy",
			"AccessKeyId",
			"signature",
			"host",
			"dir",
		)
	}

	// 华为云 PostObject 上传限制 5GB
	if (file?.size > 5 * 1024 * 1024 * 1024) {
		throw new InitException(InitExceptionCode.UPLOAD_FILE_TO_BIG, key)
	}

	const combinedKey = `${dir}${key}`

	// 包装 FormData 对象
	const formData = new FormData()
	formData.append("key", combinedKey)

	// 如果后端返回了contentType验证字段，如：'image/' 表示以"image/"开头
	if (contentType && contentType !== "") {
		// 获取文件mime
		const fileMimeType = mime.getType(parseExtname(key))
		formData.append("Content-Type", fileMimeType || contentType)
	}

	formData.append("policy", policy)
	formData.append("AccessKeyId", AccessKeyId)
	formData.append("signature", signature)
	formData.append("file", file)

	// 发送请求
	return request<TOS.PostResponse>({
		method: "post",
		url: host,
		data: formData,
		headers: option?.headers ? option?.headers : {},
		taskId: option.taskId,
		onProgress: option?.progress ? option.progress : () => {},
		withoutWrapper: true,
		fail: (status, reject) => {
			if (status === 403) {
				reject(new UploadException(UploadExceptionCode.UPLOAD_CREDENTIALS_IS_EXPIRED))
			}
		},
	}).then((res) => {
		return normalizeSuccessResponse(combinedKey, PlatformType.OBS, res.headers)
	})
}

export default defaultUpload
