import { request } from "../../utils/request"
import { PlatformRequest, PlatformSimpleUploadOption, PlatformType } from "../../types"
import { Local } from "../../types/Local"
import { UploadException, UploadExceptionCode } from "../../Exception/UploadException"
import { normalizeSuccessResponse } from "../../utils/response"

const upload: PlatformRequest<Local.AuthParams, PlatformSimpleUploadOption> = async (
	file,
	key,
	params,
	options,
) => {
	const combinedKey = `${params.dir}${key}`

	const formData = new FormData()
	formData.append("key", combinedKey)
	formData.append("file", file)
	formData.append("credential", params.credential)

	return request({
		method: "post",
		url: params.host,
		data: formData,
		taskId: options.taskId,
		fail: (status, reject) => {
			if (status === 403) {
				reject(new UploadException(UploadExceptionCode.UPLOAD_CREDENTIALS_IS_EXPIRED))
			}
		},
	}).then(() => {
		return normalizeSuccessResponse(combinedKey, PlatformType.Local, {})
	})
}

export default { upload }
