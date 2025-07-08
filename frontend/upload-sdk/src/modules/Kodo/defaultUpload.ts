import { InitException, InitExceptionCode } from "../../Exception/InitException"
import { UploadException, UploadExceptionCode } from "../../Exception/UploadException"
import type { PlatformRequest, PlatformSimpleUploadOption } from "../../types"
import type { Kodo } from "../../types/Kodo"
import { request } from "../../utils/request"

/**
 * @description: 简单上传 post请求
 * @param {File | Blob} file 文件
 * @param {String} key 文件名
 * @param {Kodo.AuthParams} params 上传凭证信息
 * @param {PlatformSimpleUploadOption} option 配置字段
 */
export const defaultUpload: PlatformRequest<Kodo.AuthParams, PlatformSimpleUploadOption> = (
	file,
	key,
	params,
	option,
) => {
	const { token, dir } = params

	if (!token || !dir) {
		throw new InitException(
			InitExceptionCode.MISSING_CREDENTIALS_PARAMS_FOR_UPLOAD,
			"qiniu",
			"token",
			"dir",
		)
	}

	// 包装 FormData 对象
	const formData = new FormData()
	formData.append("key", `${dir}${key}`)
	formData.append("token", token)
	formData.append("file", file)

	// 发送请求
	return request({
		method: "post",
		url: "https://upload.qiniup.com",
		data: formData,
		headers: option?.headers ? option?.headers : {},
		taskId: option.taskId,
		onProgress: option?.progress ? option.progress : () => {},
		fail: (status, reject) => {
			if (status === 401) {
				reject(new UploadException(UploadExceptionCode.UPLOAD_CREDENTIALS_IS_EXPIRED))
			}
		},
	})
}
