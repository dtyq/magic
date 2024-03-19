declare module "esdk-obs-browserjs" {
	interface ObsClientOptions {
		access_key_id: string
		secret_access_key: string
		security_token: string
		server: string
	}

	interface SignedUrlOptions {
		Method: string
		Bucket: string
		Key: string
		SpecialParam?: string
		QueryParams?: Record<string, string>
		Expires?: number
	}

	interface SignedUrlResult {
		SignedUrl: string
		ActualSignedRequestHeaders: Record<string, string>
	}

	interface CompleteMultipartUploadOptions {
		Bucket: string
		Key: string
		UploadId: string
		Parts: Array<{
			PartNumber: number
			ETag: string
		}>
	}

	class ObsClient {
		constructor(options: ObsClientOptions)
		createSignedUrlSync(options: SignedUrlOptions): SignedUrlResult
		completeMultipartUpload(
			options: CompleteMultipartUploadOptions,
			callback: (err: unknown, result: OBS.CompleteMultipartUploadResponse) => void,
		): void
		putObject(
			options: OBS.PutObjectOptions,
			callback: (err: unknown, result: OBS.PutResponseData) => void,
		): void
	}

	export default ObsClient
}
