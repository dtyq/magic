import type { PlatformMultipartUploadOption, PlatformSimpleUploadOption, PlatformType } from "./index"
import type { DataWrapperWithHeaders, Result } from "./request"

/**
 * AWS S3 / MinIO Object Storage
 */
export namespace MinIO {
	/** Simple upload using pre-signed URL */
	export interface AuthParams {
        url: string
        host: string
        method: string
        fields: Record<string, string>
        dir: string
        expires: number
    }

	/** Credentials for MinIO/S3 authentication */
	export interface Credentials {
        access_key_id: string
        secret_access_key: string
        session_token: string
        expiration: string
    }

	/** Upload using AccessKey/SecretKey with Signature V4 */
	export interface STSAuthParams {
        region: string
        endpoint: string
        bucket: string
        credentials: Credentials
        expires: number
        dir: string
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
		platform: PlatformType.Minio
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

