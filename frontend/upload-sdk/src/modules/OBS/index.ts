import type {
	PlatformMultipartUploadOption,
	PlatformRequest,
	PlatformSimpleUploadOption,
} from "../../types"
import type { OBS } from "../../types/OBS"
import { MultipartUpload } from "./MultipartUpload"
import { STSUpload } from "./STSUpload"
import defaultUpload from "./defaultUpload"

const upload: PlatformRequest<
	OBS.AuthParams | OBS.STSAuthParams,
	PlatformSimpleUploadOption | PlatformMultipartUploadOption
> = (file, key, params, option) => {
	if (Object.prototype.hasOwnProperty.call(params, "credentials")) {
		return MultipartUpload(file, key, <OBS.STSAuthParams>params, option)
	}
	return defaultUpload(file, key, <OBS.AuthParams>params, option)
}

export default { upload, defaultUpload, MultipartUpload, STSUpload }
