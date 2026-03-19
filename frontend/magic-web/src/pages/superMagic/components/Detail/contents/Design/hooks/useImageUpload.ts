import { useCallback, useRef, useEffect, useState } from "react"
import { UploadSource } from "@/pages/superMagic/components/MessageEditor/hooks/useFileUpload"
import { multiFolderUploadStore } from "@/stores/folderUpload"
import { useTranslation } from "react-i18next"
import type {
	GetFileInfoResponse,
	UploadImageResponse,
	UploadFile,
	UploadPrivateFile,
	UploadPrivateFileResponse,
} from "@/components/CanvasDesign/types.magic"
import magicToast from "@/components/base/MagicToaster/utils"
import type { Topic } from "@/pages/superMagic/pages/Workspace/types"
import type { FileItem } from "@/pages/superMagic/components/Detail/components/FilesViewer/types"
import { calculateUploadDirectory } from "../utils/calculateUploadDirectory"
import { prepareFilesForUpload } from "../utils/fileNaming"
import {
	createUploadCallbacks,
	callFailedCallbacksForUnprocessedFiles,
	GetFileInfoResponseWithFileId,
} from "../utils/uploadCallbacks"
import magicClient from "@/apis/clients/magic"

import { genRequestUrl } from "@/utils/http"
import { Upload } from "@dtyq/upload-sdk"

/**
 * 检查是否是用户取消操作
 */
function isCancelledError(error: Error | unknown): boolean {
	const errorMessage = error instanceof Error ? error.message : String(error)
	return errorMessage.includes("Task cancelled") || errorMessage.includes("Upload cancelled")
}

interface UseImageUploadOptions {
	projectId?: string
	selectedTopic?: Topic | null
	currentFile?: {
		id: string
		name: string
	}
	/** 已扁平化的附件列表 */
	flatAttachments?: FileItem[]
	getFileInfoById: (
		fileId: string,
		fileName?: string,
		fileSize?: number,
	) => Promise<GetFileInfoResponseWithFileId>
	/** 文件列表更新*/
	updateAttachments: () => void
}

interface UseImageUploadReturn {
	uploadImages: (
		uploadFiles: UploadFile[],
		duplicateCheckList?: string[],
	) => Promise<UploadImageResponse[]>
	uploadPrivateFiles: (uploadFiles: UploadPrivateFile[]) => Promise<UploadPrivateFileResponse[]>
	uploadProgress: number
	isUploading: boolean
}

/**
 * 图片上传功能 Hook
 * 职责：封装图片的上传逻辑
 * - 计算上传目录路径
 * - 使用 multiFolderUploadStore 执行上传
 * - 处理上传进度和结果
 * - 检查重复图片
 */
export function useImageUpload(options: UseImageUploadOptions): UseImageUploadReturn {
	const {
		projectId,
		selectedTopic,
		currentFile,
		flatAttachments,
		getFileInfoById,
		updateAttachments,
	} = options

	// 上传进度状态
	const [uploadProgress, setUploadProgress] = useState(0)
	const [isUploading, setIsUploading] = useState(false)

	const { t } = useTranslation("super")

	// 正在进行的 getFileInfo 请求（用于请求去重）
	const pendingGetFileInfoRef = useRef<Map<string, Promise<GetFileInfoResponse>>>(new Map())

	// 组件卸载时清理引用
	useEffect(() => {
		const pendingGetFileInfoRequests = pendingGetFileInfoRef.current
		return () => {
			pendingGetFileInfoRequests.clear()
		}
	}, [])

	/**
	 * 上传图片（支持批量）
	 */
	const uploadImages = useCallback(
		async (
			uploadFiles: Parameters<UseImageUploadReturn["uploadImages"]>[0],
			duplicateCheckList?: string[],
		): Promise<UploadImageResponse[]> => {
			if (!uploadFiles || uploadFiles.length === 0) {
				return []
			}

			if (!projectId) {
				const errorMsg = t("design.errors.projectIdNotExists")
				magicToast.error(errorMsg)
				throw new Error(errorMsg)
			}

			// 计算上传目录
			const suffixDir = calculateUploadDirectory({
				currentFile,
				flatAttachments,
			})

			// 准备要上传的文件列表，处理重命名逻辑
			const { filesToUpload, fileNameToUploadFileMap } = prepareFilesForUpload({
				uploadFiles,
				suffixDir,
				attachments: flatAttachments,
				duplicateCheckList,
			})

			// 跟踪已调用回调的文件名（避免重复调用）
			const processedFileNames = new Set<string>()

			// 创建批量上传 Promise
			const batchUploadPromise = new Promise<UploadImageResponse[]>((resolve, reject) => {
				const errorHandler = (error: Error, errorMessage: string) => {
					const isCancelled = isCancelledError(error)

					// 如果是取消操作，只重置状态，不显示错误提示，不调用失败回调
					if (isCancelled) {
						setIsUploading(false)
						setUploadProgress(0)
						const cancelledErrorMessage = t("design.errors.uploadCancelled")
						const cancelledError = new Error(cancelledErrorMessage)
						reject(cancelledError)
						return
					}

					// 为所有未处理的文件调用失败回调
					// 确保错误消息是多语言的
					const translatedError = new Error(errorMessage)
					callFailedCallbacksForUnprocessedFiles(
						fileNameToUploadFileMap,
						processedFileNames,
						translatedError,
					)

					setIsUploading(false)
					setUploadProgress(0)
					magicToast.error(errorMessage)
					reject(translatedError)
				}

				try {
					// 开始上传，显示进度条
					setIsUploading(true)
					setUploadProgress(0)

					// 创建上传回调函数
					const callbacks = createUploadCallbacks({
						suffixDir,
						fileNameToUploadFileMap,
						filesToUpload,
						processedFileNames,
						pendingGetFileInfoRef,
						getFileInfoById,
						setIsUploading,
						setUploadProgress,
						t,
						onComplete: (responses) => {
							resolve(responses)
						},
						onError: (error) => {
							reject(error)
						},
						onCompleteAlways: () => {
							updateAttachments()
						},
					})

					// 使用 multiFolderUploadStore 创建批量上传任务
					multiFolderUploadStore
						.createUploadTask(filesToUpload, suffixDir, {
							projectId: projectId,
							workspaceId: selectedTopic?.workspace_id,
							projectName: selectedTopic?.topic_name || t("common.untitledProject"),
							topicId: selectedTopic?.id,
							taskId: "",
							storageType: "workspace",
							source: UploadSource.Home,
							onProgress: callbacks.onProgress,
							onBatchSaveComplete: callbacks.onBatchSaveComplete,
							onComplete: callbacks.onComplete,
							onError: callbacks.onError,
						})
						.catch((error) => {
							errorHandler(error, t("design.errors.createUploadTaskFailed"))
						})
				} catch (error) {
					errorHandler(error as Error, t("design.errors.uploadFailed"))
				}
			})

			return batchUploadPromise
		},
		[
			projectId,
			currentFile,
			flatAttachments,
			t,
			setIsUploading,
			setUploadProgress,
			getFileInfoById,
			selectedTopic?.workspace_id,
			selectedTopic?.topic_name,
			selectedTopic?.id,
			updateAttachments,
		],
	)

	const uploadPrivateFiles = useCallback(
		async (uploadFiles: UploadPrivateFile[]): Promise<UploadPrivateFileResponse[]> => {
			if (!uploadFiles || uploadFiles.length === 0) {
				return []
			}

			try {
				// 获取临时凭证
				const url = genRequestUrl("/api/v1/file/temporary-credential")
				const response = await magicClient.post(url, {
					storage: "private",
				})

				const customCredentials = response

				// 创建 Upload 实例
				const uploader = new Upload()

				// 并行上传所有文件
				const uploadPromises = uploadFiles.map((uploadFile) => {
					return new Promise<UploadPrivateFileResponse>((resolve, reject) => {
						// 使用 Upload SDK 上传
						const { success, fail } = uploader.upload({
							file: uploadFile.file,
							fileName: uploadFile.file.name,
							customCredentials: {
								...customCredentials,
								temporary_credential: {
									...customCredentials.temporary_credential,
									dir: `${customCredentials.temporary_credential.dir}${uploadFile.relativePath}`,
								},
							},
							body: JSON.stringify({
								storage: "private",
								sts: true,
								content_type: uploadFile.file.type || "application/octet-stream",
							}),
						})

						// 上传成功
						success?.((res) => {
							if (res?.data?.path) {
								const result: UploadPrivateFileResponse = {
									path: res.data.path,
								}

								// 调用成功回调
								uploadFile.onUploadComplete(result)
								resolve(result)
							} else {
								const error = new Error("Upload failed: no path returned")
								uploadFile.onUploadFailed(error)
								reject(error)
							}
						})

						// 上传失败
						fail?.((error) => {
							const uploadError =
								error instanceof Error
									? error
									: new Error(String(error || "Upload failed"))
							uploadFile.onUploadFailed(uploadError)
							reject(uploadError)
						})
					})
				})

				// 等待所有文件上传完成
				const results = await Promise.allSettled(uploadPromises)

				// 处理结果
				const successResults: UploadPrivateFileResponse[] = []
				const errors: Error[] = []

				results.forEach((result) => {
					if (result.status === "fulfilled") {
						successResults.push(result.value)
					} else {
						errors.push(
							result.reason instanceof Error
								? result.reason
								: new Error(String(result.reason || "Upload failed")),
						)
					}
				})

				// 如果所有文件都上传失败，抛出错误
				if (successResults.length === 0 && errors.length > 0) {
					throw errors[0]
				}

				return successResults
			} catch (error) {
				// 为所有未处理的文件调用失败回调
				const uploadError = error instanceof Error ? error : new Error("Upload failed")
				uploadFiles.forEach((file) => {
					file.onUploadFailed(uploadError)
				})

				throw uploadError
			}
		},
		[],
	)

	return {
		uploadImages,
		uploadPrivateFiles,
		uploadProgress,
		isUploading,
	}
}
