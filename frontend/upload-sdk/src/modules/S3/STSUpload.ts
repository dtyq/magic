import type { PlatformRequest, PlatformSimpleUploadOption } from "../../types"
import type { S3 } from "../../types/S3"
import { signedUpload } from "./defaultUpload"

/**
 * @description: STS upload for small files using PUT Object
 * This is essentially a wrapper around signedUpload for consistency with other platforms
 * @param {File | Blob} file File to upload
 * @param {String} key Object key
 * @param {S3.STSAuthParams} params Credentials parameters
 * @param {PlatformSimpleUploadOption} option Upload options
 */
export const STSUpload: PlatformRequest<S3.STSAuthParams, PlatformSimpleUploadOption> = async (
	file,
	key,
	params,
	option,
) => {
	return signedUpload(file, key, params, option)
}

