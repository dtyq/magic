import { userStore } from "@/models/user"
import { RequestMethod as OpenSourceRequestMethod } from "@/apis/constant"
import { env, isCommercial } from "@/utils/env"
import { genRequestUrl } from "@/utils/http"
import { Upload, UploadConfig } from "@dtyq/upload-sdk"
import { useMemoizedFn } from "ahooks"
import { groupBy } from "lodash-es"
import { useRef, useState } from "react"
import type { ReportFileUploadsResponse } from "@/apis/modules/file"
import { FileApi } from "@/apis"
import type { UploadResponse, UseUploadFilesParams, UploadResult, DownloadResponse } from "./types"
import { logger as Logger } from "@/utils/log"
import { useTranslation } from "react-i18next"
import magicToast from "@/components/base/MagicToaster/utils"

// Todo（2025-04-16）:
// CommercialRequestUrl 与 OpenSourceRequestUrl 待合并
// CommercialRequestMethod 与 OpenSourceRequestMethod 待合并
// 后续针对请求的 api 不应该再依赖 isCommercial 的判断

export interface FileUploadDataPrevious {
	name: string
	file_id: string
	status: "done"
	progress: 100
	result: UploadResponse
	file: null
}

export interface FileUploadDataNormal {
	name: string
	file: File | null
	status: "init" | "uploading" | "done" | "error"
	result?: UploadResponse
}

export type FileUploadData = FileUploadDataPrevious | FileUploadDataNormal

/**
 * 上传文件(不包含文件上报,只包含将文件上传到OSS)
 * @param param0
 * @returns
 */
export const useUpload = <F extends FileUploadData>({
	onBeforeUpload,
	onProgress,
	onSuccess,
	onFail,
	onInit,
	storageType = "private",
	sts = true,
	body,
	url,
	rewriteFileName = true,
}: UseUploadFilesParams<F> = {}) => {
	const { t } = useTranslation("message")
	const uploader = useRef(new Upload())
	const logger = Logger.createLogger("UseUploadFiles")

	const [uploading, setUploading] = useState(false)

	const upload = useMemoizedFn<
		(
			fileList: F[],
			customCredentials?: UploadConfig["customCredentials"],
			customOption?: Partial<Pick<UploadConfig, "method">>,
		) => Promise<UploadResult>
	>(async (fileList, customCredentials, customOption) => {
		if (fileList.length === 0) {
			return { fullfilled: [], rejected: [] }
		}

		onBeforeUpload?.()
		setUploading(true)

		const promises: Promise<UploadResponse>[] = []

		for (let i = 0; i < fileList.length; i += 1) {
			const fileData = fileList[i]

			promises.push(
				new Promise<UploadResponse>((resolve, reject) => {
					const fileName = fileData.name

					if (fileData.status === "done" && fileData.result) {
						resolve(fileData.result)
						return
					}

					const { organizationCode } = userStore.user

					if (!fileData.file) {
						logger.error("upload missing file body", { fileName: fileData.name })
						reject(new Error("file is required"))
						return
					}

					/**
					 * ⚠️ important：
					 * upload-sdk 中会根据 url 缓存鉴权凭证信息
					 * 所以需要对 url 进行组织编码隔离（目前通过添加`?organization_code=xxx`参数进行隔离）
					 * 保证切换组织后，能正确获取鉴权信息
					 */
					const uploadUrl = `${url ??
						env("MAGIC_SERVICE_BASE_URL") +
						genRequestUrl(
							isCommercial()
								? "/api/v1/file/temporary-credential"
								: "/api/v1/file/temporary-credential",
						)
						}?organization_code=${organizationCode}`

					const file = new File([fileData.file], "file", {
						type: fileData.file.type,
						lastModified: fileData.file.lastModified,
					})

					const { success, progress, fail, cancel, pause, resume } =
						uploader.current.upload({
							url: uploadUrl,
							file,
							fileName,
							method: OpenSourceRequestMethod.POST,
							headers: {
								"Content-Type": "application/json",
								authorization: userStore.user.authorization ?? "",
								"Organization-Code": organizationCode ?? "",
							},
							option: {
								rewriteFileName,
								// reUploadedCount: shouldReFetchCredentials,
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
						})

					// Wrap cancel function to ensure Promise is rejected when cancelled
					const wrappedCancel = () => {
						cancel?.()
						logger.warn("upload cancelled", { fileName })
						reject(new Error("Upload cancelled"))
					}

					onInit?.(fileData, { cancel: wrappedCancel, pause, resume })

					success?.((res) => {
						if (res) {
							onSuccess?.(fileData, {
								key: res.data.path,
								name: fileName,
								size: fileData.file?.size ?? 0,
							})
							resolve({
								key: res.data.path,
								name: fileName,
								size: fileData.file?.size ?? 0,
							})
						} else reject(new Error("upload failed"))
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
		}

		return Promise.allSettled(promises).then((data) => {
			const {
				fulfilled = [] as PromiseFulfilledResult<UploadResponse>[],
				rejected = [] as PromiseRejectedResult[],
			} = groupBy(data, (d) => d.status)

			const fullfilledData = fulfilled as PromiseFulfilledResult<UploadResponse>[]
			const rejectedData = rejected as PromiseRejectedResult[]

			setUploading(false)

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
	})

	const validateFileType = useMemoizedFn((file, maxSize = 2) => {
		// console.log(file, "filefilefilexxxx00000")
		// 检查文件类型
		const validTypes = [
			"image/png",
			"image/gif",
			"image/jpeg",
			"image/svg+xml",
			"image/jpg",
			"image/webp",
		]
		if (!validTypes.includes(file.type)) {
			magicToast.error(t("file.onlySupportUploadImage"))
			return false
		}

		if (file.size / 1024 / 1024 > maxSize) {
			magicToast.error(t("file.maxSize", { maxSize: maxSize }))
			return false
		}
		return true
	})

	/**
	 * 获取文件的下载 URL
	 * @param reportRes 文件报告数据
	 * @returns 包含成功和失败结果的对象
	 */
	const getFileUrls = async (reportRes: ReportFileUploadsResponse[]) => {
		return Promise.allSettled(reportRes.map(async (r) => FileApi.getFileUrl(r.file_key))).then(
			(data) => {
				const {
					fulfilled = [] as PromiseFulfilledResult<DownloadResponse>[],
					rejected = [] as PromiseRejectedResult[],
				} = groupBy(data, (d) => d.status)

				const fullfilledData = fulfilled as PromiseFulfilledResult<DownloadResponse>[]
				const rejectedData = rejected as PromiseRejectedResult[]

				if (rejectedData.length > 0) {
					logger.warn("get file urls finished with rejections", {
						count: rejectedData.length,
					})
				}

				return { fullfilled: fullfilledData, rejected: rejectedData }
			},
		)
	}

	// 图片上传并获取文件url
	const uploadAndGetFileUrl = useMemoizedFn(
		async (
			filesList,
			validator?: (file: File) => boolean | Promise<boolean>,
			customOption?: Partial<Pick<UploadConfig, "method">>,
		) => {
			try {
				const validatorFn = validator ?? validateFileType
				const isValid = await validatorFn(filesList[0].file)
				if (isValid) {
					const { fullfilled, rejected } = await upload(
						filesList,
						undefined,
						customOption,
					)
					if (rejected && rejected.length > 0) {
						logger.warn("uploadAndGetFileUrl: some uploads rejected", {
							count: rejected.length,
						})
					}
					if (fullfilled.length === filesList.length) {
						const reportRes = await FileApi.reportFileUploads(
							fullfilled.map((d) => ({
								file_extension: d.value.name.split(".").pop() ?? "",
								file_key: d.value.key,
								file_size: d.value.size,
								file_name: d.value.name,
							})),
						)
						return getFileUrls(reportRes)
					}
				}
				return { fullfilled: [] }
			} catch (error) {
				logger.error("uploadAndGetFileUrl failed", error)
				return { fullfilled: [] }
			}
		},
	)

	return {
		upload,
		uploading,
		uploadAndGetFileUrl,
		reportFiles: FileApi.reportFileUploads,
	}
}
