import type {
	PlatformMultipartUploadOption,
	PlatformRequest,
	PlatformSimpleUploadOption,
} from "../../types"
import type { OSS } from "../../types/OSS"
import { MultipartUpload } from "./MultipartUpload"
import { defaultUpload } from "./defaultUpload"
import { STSUpload } from "./STSUpload"

const upload: PlatformRequest<
	OSS.AuthParams | OSS.STSAuthParams,
	PlatformSimpleUploadOption | PlatformMultipartUploadOption
> = (file, key, params, option) => {
	// 通过后端传入的凭证信息，判断使用 post / multipartUpload 上传方式
	if (Object.prototype.hasOwnProperty.call(params, "sts_token")) {
		return MultipartUpload(file, key, <OSS.STSAuthParams>params, option)
	}
	return defaultUpload(file, key, <OSS.AuthParams>params, option)
}

export default { upload, defaultUpload, MultipartUpload, STSUpload }
