import type { PlatformMultipartUploadOption, PlatformSimpleUploadOption, PlatformType } from "./index"
import type { DataWrapperWithHeaders, Result } from "./request"

/**
 * AWS S3 / MinIO Object Storage
 */
export namespace S3 {
	/** Simple upload using pre-signed URL */
	export interface AuthParams {
		/** Pre-signed URL for upload */
		url: string
		/** HTTP method (PUT or POST) */
		method?: "PUT" | "POST"
		/** Additional headers */
		headers?: Record<string, string>
		/** Object key path */
		key?: string
		/** Callback URL for server-side callback */
		callback?: string
	}

	/** Upload using AccessKey/SecretKey with Signature V4 */
	export interface STSAuthParams {
		/** S3 bucket name */
		bucket: string
		/** AWS region or MinIO region */
		region: string
		/** Object key prefix/directory */
		dir: string
		/** Access Key ID */
		accessKeyId: string
		/** Secret Access Key */
		secretAccessKey: string
		/** Session token for temporary credentials (optional) */
		sessionToken?: string
		/** S3 endpoint URL (for MinIO or custom S3-compatible services) */
		endpoint: string
		/** Callback URL for server-side callback */
		callback?: string
		/** Whether to use path-style URL (bucket in path) instead of virtual-hosted-style */
		pathStyle?: boolean
	}

	export type Headers = Record<string, string>

	export interface DonePart {
		number: number
		etag: string
	}

	export interface Checkpoint {
		/** The file object selected by the user, if the browser is restarted, it needs the user to manually trigger the settings */
		file: any
		/** object key */
		name: string
		fileSize: number
		partSize: number
		uploadId: string
		doneParts: DonePart[]
	}

	export interface InitMultipartUploadOption extends PlatformMultipartUploadOption {
		headers?: Headers
		mime?: string | null
	}

	export interface MultipartUploadOption extends PlatformMultipartUploadOption {
		headers?: Record<string, string>
	}

	export interface CompleteMultipartUploadOptions extends MultipartUploadOption {
		partSize: number
	}

	export interface PartInfo {
		content: Buffer | Blob | ArrayBuffer
		size: number
	}

	export interface InitMultipartUploadResponse {
		InitiateMultipartUploadResult: {
			Bucket: string
			Key: string
			UploadId: string
		}
	}

	export interface CompleteMultipartUploadResponse {
		CompleteMultipartUploadResult: {
			Location: string
			Bucket: string
			Key: string
			ETag: string
		}
	}

	interface OriginResponseData {
		platform: PlatformType.S3
		file_code?: string
		path: string
		url?: string
		expires?: number
	}

	export type PostResponse = Result<OriginResponseData>

	export type PutResponse = DataWrapperWithHeaders<null>

	export type InitMultipartUploadResponseType = DataWrapperWithHeaders<InitMultipartUploadResponse>

	export type UploadPartResponse = DataWrapperWithHeaders<null>

	export type CompleteMultipartUploadResponseType = Result<OriginResponseData>
}

