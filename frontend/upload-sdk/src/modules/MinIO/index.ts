import type {
	PlatformMultipartUploadOption,
	PlatformRequest,
	PlatformSimpleUploadOption,
} from "../../types"
import type { MinIO } from "../../types/MinIO"
import { MultipartUpload } from "./MultipartUpload"
import { STSUpload } from "./STSUpload"
import { defaultUpload, signedUpload } from "./defaultUpload"

/**
 * S3 upload main entry point
 * Automatically selects the appropriate upload method based on authentication parameters
 */
const upload: PlatformRequest<
	MinIO.AuthParams | MinIO.STSAuthParams,
	PlatformSimpleUploadOption | PlatformMultipartUploadOption
> = (file, key, params, option) => {
	// Check if using STS credentials (AccessKey/SecretKey)
	if (Object.prototype.hasOwnProperty.call(params, "access_key_id")) {
		// Use multipart upload for STS credentials
		return MultipartUpload(file, key, <MinIO.STSAuthParams>params, option)
	}

	// Use pre-signed URL upload
	return defaultUpload(file, key, <MinIO.AuthParams>params, option)
}

export default { upload, defaultUpload, signedUpload, MultipartUpload, STSUpload }

