import { Upload, type UploadConfig, type UploadCallBack } from "@dtyq/upload-sdk"
import { SuperMagicApi } from "@/apis"
import { RequestMethod as OpenSourceRequestMethod } from "@/apis/constant"
import { userStore } from "@/models/user"
import { env } from "@/utils/env"
import { genRequestUrl } from "@/utils/http"
import { logger as Logger } from "@/infrastructure/logger"
import { groupBy } from "lodash-es"
import { normalizeUploadProgress } from "../utils/uploadProgress"

export interface UploadResponse {
	key: string
	name: string
	size: number
}

export interface UploadResult {
	fullfilled: PromiseFulfilledResult<UploadResponse>[]
	rejected: PromiseRejectedResult[]
}

export type UploadAttemptId = symbol

export interface UploadServiceOptions<F> {
	storageType?: "private" | "public"
	sts?: boolean
	url?: string
	body?: Record<string, unknown>
	onBeforeUpload?: () => void
	onProgress?: (file: F, progress: number, attemptId: UploadAttemptId) => void
	onSuccess?: (file: F, response: UploadResponse, attemptId: UploadAttemptId) => void
	onFail?: (file: F, error: unknown, attemptId: UploadAttemptId) => void
	onInit?: (
		file: F,
		tools: Pick<UploadCallBack, "cancel" | "pause" | "resume">,
		attemptId: UploadAttemptId,
	) => void
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
		url ?? env("MAGIC_SERVICE_BASE_URL") + genRequestUrl("/api/v1/file/temporary-credential")

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

		let snowflakeIds: string[] = []
		try {
			const response = await SuperMagicApi.getSnowflakeIds({
				count: fileList.length,
			})
			snowflakeIds = response.ids ?? []
		} catch (error) {
			onUploadStateChange?.(false)
			logger.error({
				eventKey: "upload_snowflake_ids_failed",
				errorKind: "unknown",
				error,
				message: "failed to get snowflake ids",
			})
			fileList.forEach((fileData) => {
				if (fileData.status === "done" && fileData.result) return
				const attemptId: UploadAttemptId = Symbol(fileData.name)
				onInit?.(fileData, {}, attemptId)
				onFail?.(fileData, error, attemptId)
			})
			return {
				fullfilled: [],
				rejected: fileList
					.filter((fileData) => !(fileData.status === "done" && fileData.result))
					.map((fileData) => ({
						status: "rejected" as const,
						reason: {
							uploadFile: fileData,
							message: error instanceof Error ? error.message : String(error),
						},
					})),
			}
		}

		const promises = fileList.map(
			(fileData, fileIndex) =>
				new Promise<UploadResponse>((resolve, reject) => {
					const attemptId: UploadAttemptId = Symbol(fileData.name)
					const originalFileName = fileData.name
					const uploadFileName = snowflakeIds[fileIndex]
					if (fileData.status === "done" && fileData.result) {
						resolve(fileData.result)
						return
					}

					if (!uploadFileName) {
						const error = new Error("upload missing snowflake id")
						onInit?.(fileData, {}, attemptId)
						onFail?.(fileData, error, attemptId)
						reject({
							message: error.message,
							uploadFile: fileData,
						})
						return
					}

					const { organizationCode, authorization } = userStore.user
					if (!fileData.file) {
						logger.error({
							eventKey: "upload_missing_file_body_failed",
							errorKind: "invalid_state",
							message: "upload missing file body",
							context: { fileIndex, fileName: originalFileName },
						})
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
							fileName: uploadFileName,
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
						logger.warn("upload cancelled", { fileName: originalFileName })
						reject(new Error("Upload cancelled"))
					}

					onInit?.(fileData, { cancel: wrappedCancel, pause, resume }, attemptId)

					success?.((res) => {
						if (!res) {
							reject(new Error("upload failed"))
							return
						}
						const response = {
							key: res.data.path,
							name: originalFileName,
							size: fileData.file?.size ?? 0,
						}
						onSuccess?.(fileData, response, attemptId)
						resolve(response)
					})

					fail?.((err) => {
						logger.error({
							eventKey: "upload_failed",
							errorKind: "unknown",
							error: err,
							message: "upload failed",
							context: { fileSize: fileData.file?.size, fileName: originalFileName },
						})
						onFail?.(fileData, err, attemptId)
						reject({
							...err,
							uploadFile: fileData,
						})
					})

					progress?.((percent) => {
						const normalizedProgress = normalizeUploadProgress(percent)
						if (normalizedProgress !== undefined) {
							onProgress?.(fileData, normalizedProgress, attemptId)
						}
					})
				}),
		)

		return Promise.allSettled(promises).then((data) => {
			const { fulfilled = [], rejected = [] } = groupBy(data, (item) => item.status)
			const fullfilledData = fulfilled as PromiseFulfilledResult<UploadResponse>[]
			const rejectedData = rejected as PromiseRejectedResult[]

			onUploadStateChange?.(false)

			if (rejectedData.length > 0) {
				logger.error({
					eventKey: "batch_upload_finished_rejections_failed",
					errorKind: "unknown",
					error: rejectedData[0]?.reason,
					message: "batch upload finished with rejections",
					// 文件名和 rejection 明细可能含业务数据，仅保留失败数量。
					context: {
						count: rejectedData.length,
						files: rejectedData
							.map((r) => {
								const reason = (r as PromiseRejectedResult).reason as
									{ uploadFile?: { name?: string } } | undefined
								return reason?.uploadFile?.name
							})
							.filter(Boolean),
					},
				})
			}

			return { fullfilled: fullfilledData, rejected: rejectedData }
		})
	}
}
