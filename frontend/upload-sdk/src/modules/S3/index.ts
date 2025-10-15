import type {
	PlatformMultipartUploadOption,
	PlatformRequest,
	PlatformSimpleUploadOption,
} from "../../types"
import type { S3 } from "../../types/S3"
import { MultipartUpload } from "./MultipartUpload"
import { STSUpload } from "./STSUpload"
import { defaultUpload, signedUpload } from "./defaultUpload"

/**
 * S3 upload main entry point
 * Automatically selects the appropriate upload method based on authentication parameters
 */
const upload: PlatformRequest<
	S3.AuthParams | S3.STSAuthParams,
	PlatformSimpleUploadOption | PlatformMultipartUploadOption
> = (file, key, params, option) => {
	// Check if using STS credentials (AccessKey/SecretKey)
	if (Object.prototype.hasOwnProperty.call(params, "accessKeyId")) {
		// Use multipart upload for STS credentials
		return MultipartUpload(file, key, <S3.STSAuthParams>params, option)
	}

	// Use pre-signed URL upload
	return defaultUpload(file, key, <S3.AuthParams>params, option)
}

export default { upload, defaultUpload, signedUpload, MultipartUpload, STSUpload }

