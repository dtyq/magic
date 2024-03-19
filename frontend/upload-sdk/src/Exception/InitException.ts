import { BaseException } from "./BaseException"

export const enum InitExceptionCode {
	INIT_UNKNOWN_ERROR = "INIT_UNKNOWN_ERROR",
	MISSING_PARAMS_FOR_UPLOAD = "MISSING_PARAMS_FOR_UPLOAD",
	UPLOAD_API_OPTION_PARTSIZE_MUST_INT = "UPLOAD_API_OPTION_PARTSIZE_MUST_INT",
	UPLOAD_API_OPTION_PARTSIZE_IS_SMALL = "UPLOAD_API_OPTION_PARTSIZE_IS_SMALL",
	UPLOAD_IS_NO_SUPPORT_THIS_PLATFORM = "UPLOAD_IS_NO_SUPPORT_THIS_PLATFORM",
	UPLOAD_FILE_TO_BIG = "UPLOAD_FILE_TO_BIG",
	UPLOAD_IS_NO_SUPPORT_THIS_FILE_FORMAT = "UPLOAD_IS_NO_SUPPORT_THIS_FILE_FORMAT",
	REUPLOAD_IS_FAILED = "REUPLOAD_IS_FAILED",
	UPLOAD_HEAD_NO_EXPOSE_ETAG = "UPLOAD_HEAD_NO_EXPOSE_ETAG",
	UPLOAD_REQUEST_CREDENTIALS_ERROR = "UPLOAD_REQUEST_CREDENTIALS_ERROR",
	MISSING_CREDENTIALS_PARAMS_FOR_UPLOAD = "MISSING_CREDENTIALS_PARAMS_FOR_UPLOAD",
	UPLOAD_FILENAME_EXIST_SPECIAL_CHAR = "UPLOAD_FILENAME_EXIST_SPECIAL_CHAR",
}

/** 初始化 API 异常分类 */
const InitExceptionMapping: Record<string, (...args: any[]) => string> = {
	INIT_UNKNOWN_ERROR: () => `An unknown error occurred in the initialization api`,
	MISSING_PARAMS_FOR_UPLOAD: (...args: string[]) =>
		`${args.join(", ")} must be provided for upload`,
	UPLOAD_API_OPTION_PARTSIZE_MUST_INT: () => "partSize must be int number",
	UPLOAD_API_OPTION_PARTSIZE_IS_SMALL: (minPartSize: number) =>
		`partSize must not be smaller than ${minPartSize}`,
	UPLOAD_IS_NO_SUPPORT_THIS_PLATFORM: (platform: string) => `${platform} is not supported`,
	UPLOAD_FILE_TO_BIG: (fileName: string) =>
		`${fileName} failed to upload. The file size cannot exceed 5 GB`,
	UPLOAD_IS_NO_SUPPORT_THIS_FILE_FORMAT: () => "Must provide Blob/File for upload.",
	REUPLOAD_IS_FAILED: () =>
		"Please re-check the request upload credentials configuration. The credentials information has expired",
	UPLOAD_HEAD_NO_EXPOSE_ETAG: () =>
		"Please set the etag of expose-headers in OSS \n https://help.aliyun.com/document_detail/64041.html",
	UPLOAD_REQUEST_CREDENTIALS_ERROR: (message: string) =>
		`An error occurred requesting file service temporary credentials, message： ${message}`,
	MISSING_CREDENTIALS_PARAMS_FOR_UPLOAD: (platform: string, ...args: string[]) =>
		`${platform.toUpperCase()} - The credential field must have the following fields, ${args.join(
			", ",
		)}`,
	UPLOAD_FILENAME_EXIST_SPECIAL_CHAR: (fileName: string) =>
		`The filename cannot contain special characters, fileName: ${fileName}`,
}

/**
 * 初始化过程中 API 异常
 * Exceptions Handler.
 */
export class InitException extends BaseException {
	public override readonly name = "InitException"

	constructor(errType: keyof typeof InitExceptionMapping, ...args: any[]) {
		const e = InitExceptionMapping[errType] || InitExceptionMapping.INIT_UNKNOWN_ERROR
		const message = e?.apply(null, [...args]) || ""
		super(message)
	}
}
