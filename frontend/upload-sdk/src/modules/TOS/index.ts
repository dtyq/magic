import type {
	PlatformMultipartUploadOption,
	PlatformRequest,
	PlatformSimpleUploadOption,
} from "../../types"
import type { TOS } from "../../types/TOS"
import { MultipartUpload } from "./MultipartUpload"
import { STSUpload } from "./STSUpload"
import defaultUpload from "./defaultUpload"

const upload: PlatformRequest<
	TOS.AuthParams | TOS.STSAuthParams,
	PlatformSimpleUploadOption | PlatformMultipartUploadOption
> = (file, key, params, option) => {
	if (Object.prototype.hasOwnProperty.call(params, "credentials")) {
		return MultipartUpload(file, key, <TOS.STSAuthParams>params, option)
	}

	return defaultUpload(file, key, <TOS.AuthParams>params, option)
}

export default { upload, defaultUpload, MultipartUpload, STSUpload }
