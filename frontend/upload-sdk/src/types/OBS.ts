import type { DonePart, PlatformMultipartUploadOption } from "./index"
import type { DataWrapperWithHeaders } from "./request"

export const enum OBSUploadFileEventType {
	initiateMultipartUploadSucceed = "initiateMultipartUploadSucceed",
}

export namespace OBS {
	export interface UploadFileEventResponse {
		[OBSUploadFileEventType.initiateMultipartUploadSucceed]: InitMultipartUploadResponse
	}

	export interface AuthParams {
		AccessKeyId: string
		host: string
		policy: string
		signature: string
		dir: string
		"content-type": string
	}

	export interface STSAuthParams {
		host: string
		region: string
		endpoint: string
		credentials: {
			access: string
			secret: string
			security_token: string
			expires_at: string
		}
		bucket: string
		dir: string
		expires: number
		callback: string
	}

	export interface PartInfo {
		content: Buffer
		size: number
	}

	export interface InitMultipartUploadOption extends PlatformMultipartUploadOption {
		mime?: string | null
	}

	export interface CommonResponse<I> {
		CommonMsg: {
			Status: number
			Code: string
			Message: string
			HostId: string
			RequestId: string
			InterfaceResult: null
			Id2: string
		}
		InterfaceResult: I
	}

	export interface InitMultipartUploadResponse {
		InitiateMultipartUploadResult: {
			Bucket: string
			Key: string
			UploadId: string
		}
	}

	export interface InitMultipartUploadResult {
		res: unknown
		bucket: string
		name: string
		uploadId: string
	}

	export type UploadPartResponse = DataWrapperWithHeaders<null>

	export interface UploadPartResult {
		name: string
		etag: string
		res: UploadPartResponse
	}

	export type CompleteMultipartUploadResponse = CommonResponse<{
		ContentLength: string
		Date: string
		RequestId: string
		Id2: string
		Location: string
		Bucket: string
		Key: string
		ETag: string
	}>

	export type UploadPart = DonePart

	export type PutResponseData = CommonResponse<{
		ContentLength: "0"
		RequestId: "0000018C63BA1641B01B419F482B8B1E"
		ETag: '"e00ca89591de6668570981e97c9663ea"'
	}>
}
