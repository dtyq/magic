import type { SignersV4 } from "../modules/TOS/utils/signatureV4"
import type { PlatformMultipartUploadOption, PlatformSimpleUploadOption } from "./index"
import type { DataWrapperWithHeaders } from "./request"

export namespace TOS {
	export interface VolcEnginePlatformSimpleUploadOption extends PlatformSimpleUploadOption {
		tosCallbackParams: {
			tenant_id: string
			organization_code: string
		}
	}

	export interface VolcEnginePlatformMultipartUploadOption
		extends PlatformMultipartUploadOption {}

	export interface CallbackResponse {
		platform: "tos"
		file_code: string
		path: string
		url: string
		expires: number
	}

	export interface AuthParams {
		host: string
		"x-tos-algorithm": "TOS4-HMAC-SHA256"
		"x-tos-date": string
		"x-tos-credential": string
		"x-tos-signature": string
		policy: string
		expires: number
		content_type: string
		dir: string
		"x-tos-callback": string
	}

	// interface Headers extends Record<string, string> {
	// 	"x-tos-date": string
	// 	"x-tos-content-sha256": "UNSIGNED-PAYLOAD"
	// 	"x-tos-security-token": string
	// 	authorization: string
	// }

	export type Headers = Record<string, string>

	export interface STSAuthParams {
		bucket: string
		callback: string
		credentials: {
			AccessKeyId: string
			CurrentTime: string
			ExpiredTime: string
			SecretAccessKey: string
			SessionToken: string
		}
		dir: string
		endpoint: string
		host: string
		expires: number
		region: string
	}

	export interface CreateRequestParams extends STSAuthParams {}

	export interface InitMultipartUploadOption extends MultipartUploadOption {
		headers: Headers
		mime?: string | null
	}

	export type DonePart = { number: number; etag: string }

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

	export interface PartInfo {
		content: Buffer
		size: Number
	}

	export interface MultipartUploadOption extends PlatformMultipartUploadOption {
		signers: SignersV4
	}

	export interface CompleteMultipartUploadOptions extends MultipartUploadOption {}

	export interface InitMultipartUploadResponse {
		Bucket: string
		Key: string
		UploadId: string
	}

	export interface CompleteMultipartUploadResponse {
		Location: string
		Bucket: string
		Key: string
		ETag: string
		headers: Record<string, string>
	}

	export type UploadPartResponse = DataWrapperWithHeaders<null>

	export type PostResponse = DataWrapperWithHeaders<null>

	export type PutResponse = DataWrapperWithHeaders<null>
}
