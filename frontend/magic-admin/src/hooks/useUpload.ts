import { Upload as Uploader } from "@dtyq/upload-sdk"
import { useMemo, useState } from "react"
import type { CustomCredentials, Upload } from "@/types/upload"
import { RequestUrl } from "@/apis/constant"
import { useAdmin } from "@/provider/AdminProvider"
import { useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"
import { groupBy } from "lodash-es"
import { message } from "antd"
import { useApis } from "@/apis"

export interface GetDetailsByFileKeysParams {
	keys: string[]
	platform?: string
	downloadUrl?: string
	type?: "default" | "public"
}

export interface FileUploadDataPrevious {
	name: string
	file_id: string
	status: "done"
	progress: 100
	result: Upload.UploadResponse
	file: null
}

export interface FileUploadDataNormal {
	name: string
	file: File | null
	status: "init" | "uploading" | "done" | "error"
	result?: Upload.UploadResponse
}

export type FileUploadData = FileUploadDataPrevious | FileUploadDataNormal

const uploader = new Uploader()
export const useUpload = <F extends FileUploadData>({
	onProgress,
	// onBeforeUpload,
	// onSuccess,
	// onFail,
	onInit,
	storageType = "private",
	sts = true,
	body,
	url,
	rewriteFileName = true,
}: Upload.UseUploadFilesParams<F>) => {
	const { t } = useTranslation("admin/common")
	const { env, user, organization, apiClients } = useAdmin()
	const { magicClient } = apiClients
	const { organizationCode } = organization
	const { token } = user
	const { FileApi } = useApis()

	const [uploading, setUploading] = useState(false)

	const headers = useMemo(
		() => ({
			Authorization: token || "",
			"organization-code": organizationCode || "",
			"Content-Type": "application/json",
		}),
		[organizationCode, token],
	)

	// const upload2 = (file: RcFile) => {
	// 	return new Promise<Upload.UploadedResponse>((resolve, reject) => {
	// 		const fileName = file.name
	// 		const { uid } = file
	// 		const uploadUrl = `${url ?? base_url + RequestUrl.getUploadCredentials}?organization_code=${organizationCode}`

	// 		setUploading(true)
	// 		const uploadCallback = uploader.upload({
	// 			url: uploadUrl,
	// 			method: "POST",
	// 			headers,
	// 			file,
	// 			fileName,
	// 			option: {
	// 				rewriteFileName: true,
	// 			},
	// 			body: JSON.stringify({
	// 				storage: "private",
	// 			}),
	// 		})
	// 		uploadCallback.success?.((response) => {
	// 			const { path, platform } = response?.data || {}
	// 			if (!path || !platform || response?.code !== BusinessResponseCode.Success) {
	// 				reject(new Error(t("file.uploadFail")))
	// 				return
	// 			}
	// 			setUploading(false)
	// 			resolve({
	// 				file,
	// 				fileName,
	// 				path,
	// 				uid,
	// 			})
	// 		})
	// 		uploadCallback.fail?.((error) => {
	// 			console.log(error)
	// 			reject(new Error(error?.message || t("file.uploadFail")))
	// 		})
	// 	})
	// }

	const upload = useMemoizedFn<
		(
			fileList: F[],
			customCredentials?: CustomCredentials,
			customOption?: { method?: Upload.UploadMethod },
		) => Promise<Upload.UploadResult>
	>(async (fileList, customCredentials, customOption) => {
		if (fileList.length === 0) {
			return { fullfilled: [], rejected: [] }
		}

		setUploading(true)

		const promises: Promise<Upload.UploadResponse>[] = []

		for (let i = 0; i < fileList.length; i += 1) {
			const fileData = fileList[i]

			promises.push(
				new Promise<Upload.UploadResponse>((resolve, reject) => {
					const fileName = fileData.name

					if (fileData.status === "done" && fileData.result) {
						resolve(fileData.result)
						return
					}

					if (!fileData.file) {
						console.error("upload missing file body", { fileName: fileData.name })
						reject(new Error("file is required"))
						return
					}

					/**
					 * ⚠️ important：
					 * upload-sdk 中会根据 url 缓存鉴权凭证信息
					 * 所以需要对 url 进行组织编码隔离（目前通过添加`?organization_code=xxx`参数进行隔离）
					 * 保证切换组织后，能正确获取鉴权信息
					 */
					const uploadUrl = `${
						url ?? env.MAGIC_BASE_URL + RequestUrl.getUploadCredentials
					}?organization_code=${organizationCode}`

					const file = new File([fileData.file], "file", {
						type: fileData.file.type,
						lastModified: fileData.file.lastModified,
					})

					const { success, progress, fail, cancel, pause, resume } = uploader.upload({
						url: uploadUrl,
						file,
						fileName,
						method: "POST",
						headers,
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
						console.warn("upload cancelled", { fileName })
						reject(new Error("Upload cancelled"))
					}

					onInit?.(fileData, { cancel: wrappedCancel, pause, resume })

					success?.((res) => {
						if (res) {
							resolve({
								key: res.data.path,
								name: fileName,
								size: fileData.file?.size ?? 0,
							})
						} else reject(new Error("upload failed"))
					})

					fail?.((err) => {
						reject(new Error(err?.message || "upload failed"))
					})

					progress?.((percent) => {
						if (percent) onProgress?.(fileData, percent)
					})
				}),
			)
		}

		return Promise.allSettled(promises).then((data) => {
			const {
				fulfilled = [] as PromiseFulfilledResult<Upload.UploadResponse>[],
				rejected = [] as PromiseRejectedResult[],
			} = groupBy(data, (d) => d.status)

			const fullfilledData = fulfilled as PromiseFulfilledResult<Upload.UploadResponse>[]
			const rejectedData = rejected as PromiseRejectedResult[]

			setUploading(false)

			if (rejectedData.length > 0) {
				console.error("batch upload finished with rejections", {
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
			message.error(t("file.onlySupportUploadImage"))
			return false
		}

		if (file.size / 1024 / 1024 > maxSize) {
			message.error(t("file.maxSize", { maxSize }))
			return false
		}
		return true
	})

	// 天书下载文件链接
	const downloadUrlV4 = ""

	const getDetailsByFileKeys = async ({
		keys,
		platform = "aliyun",
		downloadUrl = downloadUrlV4,
		type = "public",
	}: GetDetailsByFileKeysParams) => {
		const res = await Uploader.download({
			url: downloadUrl,
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"request-id": Date.now().toString(),
				authorization: token || "",
				"organization-code": organizationCode,
			},
			body: JSON.stringify({
				platform,
				type,
				file_paths: keys,
			}),
		}).catch(() => {})
		if (!res || res.code !== 1000) {
			console.warn("get file urls failed")
			return []
		}
		if (!Array.isArray(res.data)) return []
		return res.data
	}

	/**
	 * 获取文件的下载 URL
	 * @param reportRes 文件报告数据
	 * @returns 包含成功和失败结果的对象
	 */
	const getFileUrls = async (reportRes: PromiseFulfilledResult<Upload.UploadResponse>[]) => {
		return Promise.allSettled(reportRes.map(async (r) => FileApi.getFileUrl(r.value.key))).then(
			(data) => {
				const {
					fulfilled = [] as PromiseFulfilledResult<Upload.DownloadResponse>[],
					rejected = [] as PromiseRejectedResult[],
				} = groupBy(data, (d) => d.status)

				const fullfilledData =
					fulfilled as PromiseFulfilledResult<Upload.DownloadResponse>[]
				const rejectedData = rejected as PromiseRejectedResult[]

				if (rejectedData.length > 0) {
					console.warn("get file urls finished with rejections", {
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
			customOption?: { method?: Upload.UploadMethod },
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
						console.warn("uploadAndGetFileUrl: some uploads rejected", {
							count: rejected.length,
						})
					}
					if (fullfilled.length === filesList.length) {
						if (magicClient) {
							return await getFileUrls(fullfilled)
						}
						// 天书环境
						const reportRes = await getDetailsByFileKeys({
							keys: fullfilled.map((d) => d.value.key),
						})

						return {
							fullfilled: reportRes.map((d: any) => ({
								stauts: "fulfilled",
								value: {
									...d,
									path: d.file_path,
									url: d.url || "",
								},
							})),
						}
					}
				}
				return { fullfilled: [] }
			} catch (error) {
				console.error("uploadAndGetFileUrl failed", error)
				return { fullfilled: [] }
			}
		},
	)

	return { upload, uploading, uploadAndGetFileUrl }
}
