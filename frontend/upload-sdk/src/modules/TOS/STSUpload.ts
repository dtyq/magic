import mime from "mime"
import { InitException, InitExceptionCode } from "../../Exception/InitException"
import { UploadException, UploadExceptionCode } from "../../Exception/UploadException"
import type {
	NormalSuccessResponse,
	PlatformMultipartUploadOption,
	PlatformSimpleUploadOption,
} from "../../types"
import { PlatformType } from "../../types"
import type { TOS } from "../../types/TOS"
import { request } from "../../utils/request"
import { normalizeSuccessResponse } from "../../utils/response"
import { getAuthHeaders, removeProtocol } from "./utils"
import { SignersV4 } from "./utils/signatureV4"
import { SignatureV4Credentials } from "./utils/signatureV4Credentials"

export function STSUpload(
	file: File | Blob,
	key: string,
	params: TOS.STSAuthParams,
	option: PlatformSimpleUploadOption | PlatformMultipartUploadOption,
): Promise<NormalSuccessResponse> {
	const {
		bucket,
		credentials: { AccessKeyId, SecretAccessKey, SessionToken },
		endpoint,
		host,
		// callback,
		dir,
		expires,
		region,
	} = params

	if (
		!bucket ||
		!AccessKeyId ||
		!SecretAccessKey ||
		!SessionToken ||
		!dir ||
		!endpoint ||
		!region ||
		!expires
	) {
		throw new InitException(
			InitExceptionCode.MISSING_CREDENTIALS_PARAMS_FOR_UPLOAD,
			"volcEngine",
			"bucket",
			"AccessKeyId",
			"SecretAccessKey",
			"SessionToken",
			"dir",
			"endpoint",
			"region",
			"expires",
		)
	}

	// 火山云 PostObject 上传限制 5GB
	if (file?.size > 5 * 1024 * 1024 * 1024) {
		throw new InitException(InitExceptionCode.UPLOAD_FILE_TO_BIG, key)
	}

	const combinedKey = `${dir}${key}`

	const headers: Record<string, any> = {
		...option.headers,
		// "x-tos-callback": callback
	}

	const mimeType = mime.getType(key)
	if (mimeType) {
		headers["Content-type"] = mimeType
	}

	// 签名工具
	const signV4 = new SignatureV4Credentials(SessionToken, SecretAccessKey, AccessKeyId)
	const signers = new SignersV4(
		{
			algorithm: "TOS4-HMAC-SHA256",
			region,
			serviceName: "tos",
			bucket,
			securityToken: SessionToken,
		},
		signV4,
	)

	const authHeaders = getAuthHeaders(
		{
			bucket,
			method: "PUT",
			headers,
			path: `/${encodeURIComponent(combinedKey)}`,
			host: removeProtocol(host),
		},
		signers,
		expires,
	)

	// 发送请求
	return request<TOS.PutResponse>({
		method: "PUT",
		url: `${host}/${encodeURIComponent(combinedKey)}`,
		data: file,
		headers: { ...authHeaders, ...headers },
		taskId: option.taskId,
		onProgress: option?.progress ? option.progress : () => {},
		fail: (status, reject) => {
			if (status === 403) {
				reject(new UploadException(UploadExceptionCode.UPLOAD_CREDENTIALS_IS_EXPIRED))
			}
		},
	}).then((res) => {
		return normalizeSuccessResponse(combinedKey, PlatformType.TOS, res.headers)
	})
}
