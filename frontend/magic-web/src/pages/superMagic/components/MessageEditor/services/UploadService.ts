import { Upload, type UploadConfig, type UploadCallBack } from "@dtyq/upload-sdk"
import { RequestMethod as OpenSourceRequestMethod } from "@/apis/constant"
import { userStore } from "@/models/user"
import { env, isCommercial } from "@/utils/env"
import { genRequestUrl } from "@/utils/http"
import { logger as Logger } from "@/utils/log"
import { groupBy } from "lodash-es"

export interface UploadResponse {
	key: string
	name: string
	size: number
}

export interface UploadResult {
	fullfilled: PromiseFulfilledResult<UploadResponse>[]
	rejected: PromiseRejectedResult[]
}

export interface UploadServiceOptions<F> {
	storageType?: "private" | "public"
	sts?: boolean
	url?: string
	body?: Record<string, unknown>
	onBeforeUpload?: () => void
	onProgress?: (file: F, progress: number) => void
	onSuccess?: (file: F, response: UploadResponse) => void
	onFail?: (file: F, error?: unknown) => void
	onInit?: (file: F, tools: Pick<UploadCallBack, "cancel" | "pause" | "resume">) => void
	rewriteFileName?: boolean
	onUploadStateChange?: (isUploading: boolean) => void
}

export interface UploadServiceParams<F> extends UploadServiceOptions<F> {
	fileList: F[]
	customCredentials?: UploadConfig["customCredentials"]
	customOption?: Partial<Pick<UploadConfig, "method">>
}

interface UploadFileLike {
	name: string
	file: File | null
	status?: "init" | "uploading" | "done" | "error"
	result?: UploadResponse
}

const logger = Logger.createLogger("MessageEditorUploadService")

function resolveUploadUrl(url: string | undefined, organizationCode: string | undefined) {
	const baseUrl =
		url ??
		env("MAGIC_SERVICE_BASE_URL") +
		genRequestUrl(
			isCommercial()
				? "/api/v1/file/temporary-credential"
				: "/api/v1/file/temporary-credential",
		)

	if (!organizationCode) return baseUrl
	const separator = baseUrl.includes("?") ? "&" : "?"
	return `${baseUrl}${separator}organization_code=${organizationCode}`
}

export class UploadService<F extends UploadFileLike> {
	private uploader = new Upload()

	async upload(params: UploadServiceParams<F>): Promise<UploadResult> {
		const {
			fileList,
			customCredentials,
			customOption,
			storageType = "private",
			sts = true,
			url,
			body,
			rewriteFileName = true,
			onBeforeUpload,
			onProgress,
			onSuccess,
			onFail,
			onInit,
			onUploadStateChange,
		} = params

		if (fileList.length === 0) {
			return { fullfilled: [], rejected: [] }
		}

		onBeforeUpload?.()
		onUploadStateChange?.(true)

		const promises = fileList.map(
			(fileData) =>
				new Promise<UploadResponse>((resolve, reject) => {
					const fileName = fileData.name
					if (fileData.status === "done" && fileData.result) {
						resolve(fileData.result)
						return
					}

					const { organizationCode, authorization } = userStore.user
					if (!fileData.file) {
						logger.error("upload missing file body", { fileName })
						reject(new Error("file is required"))
						return
					}

					const uploadUrl = resolveUploadUrl(url, organizationCode)
					const file = new File([fileData.file], "file", {
						type: fileData.file.type,
						lastModified: fileData.file.lastModified,
					})

					const { success, progress, fail, cancel, pause, resume } = this.uploader.upload(
						{
							url: uploadUrl,
							file,
							fileName,
							method: OpenSourceRequestMethod.POST,
							headers: {
								"Content-Type": "application/json",
								authorization: authorization ?? "",
								"Organization-Code": organizationCode ?? "",
							},
							option: {
								rewriteFileName,
							},
							customCredentials,
							...customOption,
							body: JSON.stringify(
								body ?? {
									storage: storageType,
									sts,
									content_type: fileData.file.type,
								},
							),
						},
					)

					const wrappedCancel = () => {
						cancel?.()
						logger.warn("upload cancelled", { fileName })
						reject(new Error("Upload cancelled"))
					}

					onInit?.(fileData, { cancel: wrappedCancel, pause, resume })

					success?.((res) => {
						if (!res) {
							reject(new Error("upload failed"))
							return
						}
						const response = {
							key: res.data.path,
							name: fileName,
							size: fileData.file?.size ?? 0,
						}
						onSuccess?.(fileData, response)
						resolve(response)
					})

					fail?.((err) => {
						logger.error("upload failed", {
							fileName,
							fileSize: fileData.file?.size,
							message: err?.message,
						})
						onFail?.(fileData, err)
						reject({
							...err,
							uploadFile: fileData,
						})
					})

					progress?.((percent) => {
						if (percent) onProgress?.(fileData, percent)
					})
				}),
		)

		return Promise.allSettled(promises).then((data) => {
			const { fulfilled = [], rejected = [] } = groupBy(data, (item) => item.status)
			const fullfilledData = fulfilled as PromiseFulfilledResult<UploadResponse>[]
			const rejectedData = rejected as PromiseRejectedResult[]

			onUploadStateChange?.(false)

			if (rejectedData.length > 0) {
				logger.error("batch upload finished with rejections", {
					count: rejectedData.length,
					files: rejectedData
						.map((r) => {
							const reason = (r as PromiseRejectedResult).reason as
								| { uploadFile?: { name?: string } }
								| undefined
							return reason?.uploadFile?.name
						})
						.filter(Boolean),
				})
			}

			return { fullfilled: fullfilledData, rejected: rejectedData }
		})
	}
}
