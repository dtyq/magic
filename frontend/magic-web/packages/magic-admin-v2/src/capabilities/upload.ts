import { Upload } from "@dtyq/upload-sdk"
import { BaseRequestUrl } from "@magic-admin-v2/api/constants/base"
import type { HttpClient } from "@magic-admin-v2/api/types"
import type {
	Capabilities,
	UploadFileOptions,
} from "@magic-admin-v2/capabilities/types"

const maxImageSize = 2 * 1024 * 1024
const supportedImageTypes = new Set([
	"image/png",
	"image/gif",
	"image/jpeg",
	"image/svg+xml",
	"image/jpg",
	"image/webp",
])

type UploadHttpClient = Pick<HttpClient, "post">
type UploadSdk = Pick<Upload, "upload">

type FileDownloadResponse = {
	path: string
	url: string
}

type UploadCredentialResponse = {
	platform: string
	temporary_credential: Record<string, unknown>
}

export type PublicImageUploadContext = {
	authorization: string
	language: string
	organizationCode: string
	uploadUrl: string
}

export type CreateUploadCapabilitiesOptions = {
	client: UploadHttpClient
	getPublicImageUploadContext: () => PublicImageUploadContext
	uploadSdk?: UploadSdk
}

/**
 * 创建 Admin V2 的统一上传能力。
 *
 * 上传算法、临时凭证参数和公共文件地址解析都由 Admin V2 维护；宿主和 standalone
 * 只需要注入各自的 HTTP Client，以及当前认证、组织和语言上下文。
 */
export function createUploadCapabilities({
	client,
	getPublicImageUploadContext,
	uploadSdk = new Upload(),
}: CreateUploadCapabilitiesOptions): Capabilities {
	const uploadPublicImage: Capabilities["uploadPublicImage"] = async (file, options) => {
		throwIfAborted(options?.signal)
		validateImageFile(file)
		const context = getPublicImageUploadContext()
		const path = await uploadImageRaw({
			...context,
			file,
			signal: options?.signal,
			uploadSdk,
		})
		return resolvePublicFile(client, path, options?.signal)
	}

	const uploadFile: Capabilities["uploadFile"] = async (
		file,
		options: UploadFileOptions,
	) => {
		throwIfAborted(options.signal)
		const credential = await client.post<UploadCredentialResponse>(
			BaseRequestUrl.temporaryCredential,
			{
				content_type: file.type || "application/octet-stream",
				storage: options.storage,
				sts: options.storage === "private",
			},
			{ signal: options.signal },
		)
		const path = await uploadFileWithCredential({
			credential,
			directory: options.directory,
			file,
			signal: options.signal,
			uploadSdk,
		})

		return options.storage === "public"
			? resolvePublicFile(client, path, options.signal)
			: { path }
	}

	return { uploadFile, uploadPublicImage }
}

function validateImageFile(file: File) {
	if (!supportedImageTypes.has(file.type)) throw new Error("UNSUPPORTED_IMAGE_TYPE")
	if (file.size > maxImageSize) throw new Error("IMAGE_TOO_LARGE")
}

function throwIfAborted(signal?: AbortSignal) {
	if (signal?.aborted) throw new DOMException("Aborted", "AbortError")
}

async function resolvePublicFile(
	client: UploadHttpClient,
	path: string,
	signal?: AbortSignal,
) {
	const fileUrl = await client.post<FileDownloadResponse>(
		BaseRequestUrl.fileDownload,
		{ file_key: path },
		{ signal },
	)
	return {
		path: fileUrl.path || path,
		url: fileUrl.url,
	}
}

function uploadImageRaw({
	authorization,
	file,
	language,
	organizationCode,
	signal,
	uploadSdk,
	uploadUrl,
}: PublicImageUploadContext & {
	file: File
	signal?: AbortSignal
	uploadSdk: UploadSdk
}) {
	if (signal?.aborted) return Promise.reject(new DOMException("Aborted", "AbortError"))

	return runUploadTask({
		signal,
		start: () =>
			uploadSdk.upload({
				url: uploadUrl,
				file: createUploadFile(file),
				fileName: file.name,
				method: "POST",
				headers: {
					authorization,
					"organization-code": organizationCode,
					language,
					"Content-Type": "application/json",
				},
				option: { rewriteFileName: true },
				body: JSON.stringify({
					storage: "public",
					sts: true,
					content_type: file.type,
				}),
			}),
	})
}

function uploadFileWithCredential({
	credential,
	directory,
	file,
	signal,
	uploadSdk,
}: {
	credential: UploadCredentialResponse
	directory?: string
	file: File
	signal?: AbortSignal
	uploadSdk: UploadSdk
}) {
	if (signal?.aborted) return Promise.reject(new DOMException("Aborted", "AbortError"))
	if (!credential.platform) throw new Error("UPLOAD_CREDENTIAL_PLATFORM_MISSING")

	const temporaryCredential = { ...credential.temporary_credential }
	const baseDirectory = String(temporaryCredential.dir ?? "")
	if (!baseDirectory) throw new Error("UPLOAD_CREDENTIAL_DIRECTORY_MISSING")
	temporaryCredential.dir = appendUploadDirectory(baseDirectory, directory)

	return runUploadTask({
		signal,
		start: () =>
			uploadSdk.upload({
				file: createUploadFile(file),
				fileName: file.name,
				option: { rewriteFileName: true },
				customCredentials: {
					platform: credential.platform as never,
					temporary_credential: temporaryCredential as never,
				},
			}),
	})
}

function createUploadFile(file: File) {
	return new File([file], "file", {
		type: file.type,
		lastModified: file.lastModified,
	})
}

function runUploadTask({
	signal,
	start,
}: {
	signal?: AbortSignal
	start: () => ReturnType<UploadSdk["upload"]>
}) {
	return new Promise<string>((resolve, reject) => {
		const task = start()
		const cleanup = () => signal?.removeEventListener("abort", handleAbort)
		const handleAbort = () => {
			task.cancel?.()
			cleanup()
			reject(new DOMException("Aborted", "AbortError"))
		}

		signal?.addEventListener("abort", handleAbort, { once: true })
		task.success?.((response) => {
			cleanup()
			const path = response?.data?.path
			if (path) resolve(path)
			else reject(new Error("UPLOAD_PATH_MISSING"))
		})
		task.fail?.((error) => {
			cleanup()
			reject(new Error(error?.message || "UPLOAD_FAILED"))
		})
	})
}

export function appendUploadDirectory(baseDirectory: string, directory?: string) {
	if (!directory) return baseDirectory
	return `${baseDirectory.endsWith("/") ? baseDirectory : `${baseDirectory}/`}${directory.replace(/^\//, "")}`
}
