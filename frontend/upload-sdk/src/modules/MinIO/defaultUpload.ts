import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3"
import mime from "mime"
import { InitException, InitExceptionCode } from "../../Exception/InitException"
import { UploadException, UploadExceptionCode } from "../../Exception/UploadException"
import type { PlatformRequest, PlatformSimpleUploadOption } from "../../types"
import { PlatformType } from "../../types"
import type { MinIO } from "../../types/MinIO"
import { parseExtname } from "../../utils/regExpUtil"
import { request } from "../../utils/request"
import { normalizeSuccessResponse } from "../../utils/response"

/**
 * Create S3Client instance with provided credentials
 */
function createS3Client(params: MinIO.STSAuthParams): S3Client {
	const { endpoint, region, credentials } = params
	const { access_key_id, secret_access_key, session_token } = credentials

	return new S3Client({
		region,
		endpoint,
		credentials: {
			accessKeyId: access_key_id,
			secretAccessKey: secret_access_key,
			sessionToken: session_token,
		},
		// Force path-style for MinIO compatibility
		forcePathStyle: true,
	})
}

/**
 * @description: Simple upload using pre-signed URL
 * @param {File | Blob} file File to upload
 * @param {String} key Object key
 * @param {MinIO.AuthParams} params Pre-signed URL parameters
 * @param {PlatformSimpleUploadOption} option Upload options
 */
export const defaultUpload: PlatformRequest<MinIO.AuthParams, PlatformSimpleUploadOption> = async (
	file,
	key,
	params,
	option,
) => {
	const { url, fields = {}, dir } = params

	const combinedKey = `${dir}${key}`

	const formData = new FormData()

	formData.append('key', combinedKey)

	// Add form fields in the correct order (policy-based fields first)
	Object.entries(fields).forEach(([fieldKey, fieldValue]) => {
		formData.append(fieldKey, String(fieldValue))
	})

	// File must be added last in POST form upload
	formData.append("file", file)

	// Send POST request
	return request<MinIO.PostResponse>({
		method: "POST",
		url: url,
		data: formData,
		taskId: option.taskId,
		onProgress: option?.progress ? option.progress : () => {},
		withoutWrapper: true,
		fail: (status, reject) => {
			if (status === 403) {
				reject(new UploadException(UploadExceptionCode.UPLOAD_CREDENTIALS_IS_EXPIRED))
			}
		},
	}).then((res) => {
		return normalizeSuccessResponse(combinedKey, PlatformType.Minio, res.headers)
	})
}

/**
 * @description: Simple upload using AccessKey/SecretKey with AWS SDK
 * @param {File | Blob} file File to upload
 * @param {String} key Object key
 * @param {MinIO.STSAuthParams} params Credentials parameters
 * @param {PlatformSimpleUploadOption} option Upload options
 */
export const signedUpload: PlatformRequest<MinIO.STSAuthParams, PlatformSimpleUploadOption> = async (
	file,
	key,
	params,
	option,
) => {
	const {
		bucket,
		region,
		dir,
		credentials,
		endpoint,
	} = params

	if (!bucket || !region || !dir || !endpoint || !credentials || 
	    !credentials.access_key_id || !credentials.secret_access_key) {
		throw new InitException(
			InitExceptionCode.MISSING_CREDENTIALS_PARAMS_FOR_UPLOAD,
			"s3",
			"bucket",
			"region",
			"dir",
			"endpoint",
			"credentials.access_key_id",
			"credentials.secret_access_key",
		)
	}

	// S3 PUT Object upload limit is 5GB
	if (file?.size > 5 * 1024 * 1024 * 1024) {
		throw new InitException(InitExceptionCode.UPLOAD_FILE_TO_BIG, key)
	}

	const objectKey = `${dir}${key}`

	// Determine content type
	let contentType: string | null = null
	const fileMimeType = mime.getType(parseExtname(key))
	if (fileMimeType) {
		contentType = fileMimeType
	}

	// Create S3 client
	const s3Client = createS3Client(params)

	try {
		// Convert File/Blob to ArrayBuffer for AWS SDK
		const fileBuffer = await file.arrayBuffer()

		// Create PutObject command
		const command = new PutObjectCommand({
			Bucket: bucket,
			Key: objectKey,
			Body: new Uint8Array(fileBuffer),
			ContentType: contentType || undefined,
		})

		// Execute upload with progress tracking
		// Note: AWS SDK doesn't natively support progress for PutObject in browser
		// We'll simulate it by reporting 0% -> 100% on completion
		if (option?.progress) {
			option.progress(0, 0, file.size, null)
		}

		const response = await s3Client.send(command)

		if (option?.progress) {
			option.progress(100, file.size, file.size, null)
		}

		// Return normalized response
		return normalizeSuccessResponse(objectKey, PlatformType.Minio, {
			etag: response.ETag || "",
		})
	} catch (error: any) {
		// Handle AWS SDK errors
		if (error.name === "InvalidAccessKeyId" || error.name === "SignatureDoesNotMatch" || error.$metadata?.httpStatusCode === 403) {
			const errorDetails = [
				"MinIO/S3 upload authentication failed.",
				"Possible causes:",
				"1. Access Key ID or Secret Access Key is incorrect",
				"2. Region or endpoint configuration mismatch",
				"3. System time difference exceeds 15 minutes",
				"4. Credentials do not have permission to upload to this bucket/path",
				"5. Session token has expired (for temporary credentials)",
			].join(" ")
			
			throw new UploadException(
				UploadExceptionCode.UPLOAD_CREDENTIALS_IS_EXPIRED,
				errorDetails,
			)
		}
		
		// Re-throw other errors
		throw error
	}
}

