import type { Progress, TaskId, PlatformType } from "."
import type { DataWrapperWithHeaders, Method, Result } from "./request"

/**
 * 阿里云对象存储\
 */
export namespace OSS {
	export interface Option {
		/** access secret you create */
		accessKeyId: string
		/** access secret you create */
		accessKeySecret: string
		/** used by temporary authorization */
		stsToken?: string | undefined
		/** the default bucket you want to access If you don't have any bucket, please use putBucket() create one first. */
		bucket?: string | undefined
		/** oss region domain. It takes priority over region. */
		endpoint?: string | undefined
		/** the bucket data region location, please see Data Regions, default is oss-cn-hangzhou. */
		region?: string | undefined
		/** access OSS with aliyun internal network or not, default is false. If your servers are running on aliyun too, you can set true to save lot of money. */
		internal?: boolean | undefined
		/** instruct OSS client to use HTTPS (secure: true) or HTTP (secure: false) protocol. */
		secure?: boolean | undefined
		/** instance level timeout for all operations, default is 60s */
		timeout?: string | number | undefined
		/** use custom domain name */
		cname?: boolean | undefined
		/** use time (ms) of refresh STSToken interval it should be less than sts info expire interval, default is 300000ms(5min) when sts info expires. */
		refreshSTSTokenInterval?: number
		/** used by auto set stsToken、accessKeyId、accessKeySecret when sts info expires. return value must be object contains stsToken、accessKeyId、accessKeySecret */
		refreshSTSToken?: () => Promise<{
			accessKeyId: string
			accessKeySecret: string
			stsToken: string
		}>
	}

	export interface Headers {
		[propName: string]: any

		"x-oss-date": string
		"x-oss-user-agent"?: string
	}

	/** 后端返回-阿里云凭证字段 */
	export interface AuthParams {
		policy: string
		accessid: string
		signature: string
		host: string
		dir: string
		callback: string
	}

	/** 后端返回-阿里云凭证字段, 开启STS */
	export interface STSAuthParams {
		region: string
		bucket: string
		dir: string
		access_key_secret: string
		access_key_id: string
		sts_token: string
		callback: string
	}

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

	export interface InitMultipartUploadOption {
		headers?: Record<string, string>
		mime?: string | null
	}

	export interface MultipartUploadParams {
		bucket: string
		region: string
		object: string
		accessKeyId: string
		accessKeySecret: string
		stsToken: string
		callback: string
		taskId?: TaskId
		xmlResponse?: boolean
	}

	/** 复杂上传 -- 接口 */
	export interface MultipartUploadOption {
		/** the number of parts to be uploaded in parallel */
		parallel?: number
		/** the suggested size for each part */
		partSize?: number
		/** the checkpoint to resume upload, if this is provided, it will continue the upload from where interrupted, otherwise a new multipart upload will be created. */
		checkpoint?: Checkpoint
		mime?: string | null
		headers?: Record<string, string>
	}

	export interface CompleteMultipartUploadOptions {
		partSize: number
		callback?: string
		headers?: Record<string, string> | undefined
		progress?: Progress
	}

	export interface ResumeMultipartOption extends MultipartUploadOption {
		progress?: Progress
	}

	export interface CreateRequestParams extends MultipartUploadParams {
		method: Method
		subRes: string | Record<string, any>
		xmlResponse?: boolean | undefined
		query?: Record<string, string>
		content?: File | Blob | string | ArrayBuffer | Buffer
	}

	export interface UploadPartError extends Error {
		name: string
		message: string
		stack: string
		partNum: number
	}

	export interface PartInfo {
		content: string | ArrayBuffer | File | Blob | Buffer
		size: number
	}

	interface OriginResponseData {
		platform: PlatformType.OSS
		file_code: string
		path: string
		url: string
		expires: number
	}

	export type PostResponse = Result<OriginResponseData>

	export type PutResponse = Result<OriginResponseData>

	/** 复杂上传 -- 初始化请求返回结果 */
	export type InitMultipartUploadResponse = DataWrapperWithHeaders<{
		InitiateMultipartUploadResult: {
			Bucket: string
			Key: string
			UploadId: string
		}
	}>

	export type UploadPartResponse = DataWrapperWithHeaders<null>

	export type CompleteMultipartUploadResponse = Result<OriginResponseData>
}
