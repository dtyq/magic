import type { PlatformRequest, PlatformSimpleUploadOption } from "../../types"
import type { MinIO } from "../../types/MinIO"
import { signedUpload } from "./defaultUpload"

/**
 * @description: STS upload for small files using PUT Object
 * This is essentially a wrapper around signedUpload for consistency with other platforms
 * @param {File | Blob} file File to upload
 * @param {String} key Object key
 * @param {MinIO.STSAuthParams} params Credentials parameters
 * @param {PlatformSimpleUploadOption} option Upload options
 */
export const STSUpload: PlatformRequest<MinIO.STSAuthParams, PlatformSimpleUploadOption> = async (
	file,
	key,
	params,
	option,
) => {
	return signedUpload(file, key, params, option)
}

