import { useCallback, useRef, useEffect, useState, useMemo } from "react"
import { UploadSource } from "@/pages/superMagic/components/MessageEditor/hooks/useFileUpload"
import { multiFolderUploadStore } from "@/stores/folderUpload"
import { useTranslation } from "react-i18next"
import { SuperMagicApi } from "@/apis"
import { SuperMagicApiErrorCode } from "@/pages/superMagic/constants/apiErrorCodes"
import {
	type GetFileInfoResponse,
	type UploadFileResponse,
	type UploadFile,
	type UploadPrivateFile,
	type UploadPrivateFileResponse,
	type UploadSubDirType,
} from "@/components/CanvasDesign/types.magic"
import magicToast from "@/components/base/MagicToaster/utils"
import type { Topic } from "@/pages/superMagic/pages/Workspace/types"
import type { FileItem } from "@/pages/superMagic/components/Detail/components/FilesViewer/types"
import type { GetOrCreateImagesDirFn } from "./useGetOrCreateImagesDir"
import { getUploadDirectoryBase } from "../utils/calculateUploadDirectory"
import { prepareFilesForUpload } from "../utils/fileNaming"
import {
	createUploadCallbacks,
	callFailedCallbacksForUnprocessedFiles,
	GetFileInfoResponseWithFileId,
} from "../utils/uploadCallbacks"
import { resolveDesignProjectBasePathFromAttachments, normalizePath } from "../utils/utils"
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

interface UseFileUploadOptions {
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
	/** 获取/创建 images 目录（由顶层传入，用于复用 promise 缓存） */
	getOrCreateImagesDir?: GetOrCreateImagesDirFn
}

interface UseFileUploadReturn {
	uploadFiles: (
		uploadFiles: UploadFile[],
		duplicateCheckList?: string[],
	) => Promise<UploadFileResponse[]>
	uploadPrivateFiles: (uploadFiles: UploadPrivateFile[]) => Promise<UploadPrivateFileResponse[]>
	uploadProgress: number
	isUploading: boolean
}

/**
 * 文件上传功能 Hook（支持图片、视频、音频等，按 uploadSubDir 区分上传目录与提示文案）
 * 职责：封装设计页面的文件上传逻辑
 * - 计算上传目录路径
 * - 使用 multiFolderUploadStore 执行上传
 * - 处理上传进度和结果，提示按 uploadSubDir 区分（图片/视频/音频）
 * - 检查重复文件
 */
export function useFileUpload(options: UseFileUploadOptions): UseFileUploadReturn {
	const {
		projectId,
		selectedTopic,
		currentFile,
		flatAttachments,
		getFileInfoById,
		updateAttachments,
		getOrCreateImagesDir: getOrCreateImagesDirProp,
	} = options

	// 上传进度状态
	const [uploadProgress, setUploadProgress] = useState(0)
	const [isUploading, setIsUploading] = useState(false)

	const { t } = useTranslation("super")
	const designProjectBasePath = useMemo(
		() =>
			resolveDesignProjectBasePathFromAttachments({
				currentFile,
				flatAttachments,
			}),
		[currentFile, flatAttachments],
	)

	// 正在进行的 getFileInfo 请求（用于请求去重）
	const pendingGetFileInfoRef = useRef<Map<string, Promise<GetFileInfoResponse>>>(new Map())

	const getOrCreateImagesDir = getOrCreateImagesDirProp

	// 组件卸载时清理引用
	useEffect(() => {
		const pendingGetFileInfoRequests = pendingGetFileInfoRef.current
		return () => {
			pendingGetFileInfoRequests.clear()
		}
	}, [])

	/**
	 * 按 uploadSubDir 分组（保持首次出现顺序），得到 { suffixDir, uploadFiles }[]
	 */
	const groupByUploadSubDir = useCallback(
		(
			files: Parameters<UseFileUploadReturn["uploadFiles"]>[0],
		): { suffixDir: string; uploadSubDir: string; uploadFiles: UploadFile[] }[] => {
			const basePath = getUploadDirectoryBase({
				currentFile,
				flatAttachments,
			})
			const order: string[] = []
			const map = new Map<string, UploadFile[]>()
			const subDirMap = new Map<string, string>()
			for (const uf of files) {
				const subDir = uf.uploadSubDir
				const suffixDir = basePath ? `${basePath}/${subDir}` : subDir
				if (!map.has(suffixDir)) {
					order.push(suffixDir)
					map.set(suffixDir, [])
					subDirMap.set(suffixDir, subDir)
				}
				const list = map.get(suffixDir)
				if (list) list.push(uf)
			}
			return order.map((suffixDir) => ({
				suffixDir,
				uploadSubDir: subDirMap.get(suffixDir) ?? "images",
				uploadFiles: map.get(suffixDir) ?? [],
			}))
		},
		[currentFile, flatAttachments],
	)

	const ensureUploadDirectory = useCallback(
		async (group: {
			suffixDir: string
			uploadSubDir: string
		}): Promise<{ parentId: string; suffixDir: string } | null> => {
			const { uploadSubDir, suffixDir } = group

			if (uploadSubDir === "images" && getOrCreateImagesDir) {
				const imagesDirInfo = await getOrCreateImagesDir()
				if (imagesDirInfo?.imagesDirFileId) {
					return {
						parentId: imagesDirInfo.imagesDirFileId,
						suffixDir: imagesDirInfo.suffixDir,
					}
				}
			}

			if (!projectId || !currentFile?.id || !flatAttachments?.length) {
				return null
			}

			const normalizedSuffixDir = normalizePath(suffixDir)
			let assetDirItem = flatAttachments.find(
				(item) =>
					item.is_directory &&
					normalizePath(item.relative_file_path || "") === normalizedSuffixDir,
			)
			if (assetDirItem?.file_id) {
				return { parentId: assetDirItem.file_id, suffixDir }
			}

			const basePath = getUploadDirectoryBase({ currentFile, flatAttachments })
			const normalizedBasePath = normalizePath(basePath)
			const parentDirItem = normalizedBasePath
				? flatAttachments.find(
						(item) =>
							item.is_directory &&
							normalizePath(item.relative_file_path || "") === normalizedBasePath,
					)
				: undefined
			const parentId = parentDirItem?.file_id || currentFile.id
			if (!parentId) return null

			try {
				const createResponse = await SuperMagicApi.createFile({
					project_id: projectId,
					parent_id: parentId,
					file_name: uploadSubDir,
					is_directory: true,
					ignore_duplicate: true,
				})
				const fileId = (createResponse as { file_id?: string })?.file_id
				if (fileId) {
					updateAttachments()
					return { parentId: fileId, suffixDir }
				}
			} catch (error: unknown) {
				const errorObj = error as { code?: number }
				if (errorObj.code === SuperMagicApiErrorCode.DuplicateFile) {
					updateAttachments()
					assetDirItem = flatAttachments.find(
						(item) =>
							item.is_directory &&
							normalizePath(item.relative_file_path || "") === normalizedSuffixDir,
					)
					if (assetDirItem?.file_id) {
						return { parentId: assetDirItem.file_id, suffixDir }
					}
				}
			}

			return null
		},
		[projectId, currentFile, flatAttachments, getOrCreateImagesDir, updateAttachments],
	)

	/**
	 * 上传文件（支持批量；每个文件必传 uploadSubDir：UploadSubDir.Images | UploadSubDir.Videos | UploadSubDir.Audios）
	 */
	const uploadFiles = useCallback(
		async (
			uploadFiles: Parameters<UseFileUploadReturn["uploadFiles"]>[0],
			duplicateCheckList?: string[],
		): Promise<UploadFileResponse[]> => {
			if (!uploadFiles || uploadFiles.length === 0) {
				return []
			}

			if (!projectId) {
				const errorMsg = t("design.errors.projectIdNotExists")
				magicToast.error(errorMsg)
				throw new Error(errorMsg)
			}
			const groups = groupByUploadSubDir(uploadFiles)
			const allResponses: UploadFileResponse[] = []

			setIsUploading(true)
			setUploadProgress(0)

			const runGroup = async (group: {
				suffixDir: string
				uploadSubDir: string
				uploadFiles: UploadFile[]
			}): Promise<UploadFileResponse[]> => {
				const directoryInfo = await ensureUploadDirectory(group)
				if (!directoryInfo) {
					const errorMsg = t("design.errors.imagesDirNotFound") || "无法获取上传目标目录"
					magicToast.error(errorMsg)
					throw new Error(errorMsg)
				}

				return new Promise((resolve, reject) => {
					const { uploadSubDir, uploadFiles: groupFiles } = group
					const { parentId, suffixDir } = directoryInfo
					const { filesToUpload, fileNameToUploadFileMap } = prepareFilesForUpload({
						uploadFiles: groupFiles,
						suffixDir,
						attachments: flatAttachments,
						duplicateCheckList,
					})
					const processedFileNames = new Set<string>()

					const errorHandler = (error: Error, errorMessage: string) => {
						if (isCancelledError(error)) {
							setIsUploading(false)
							setUploadProgress(0)
							reject(new Error(t("design.errors.uploadCancelled")))
							return
						}
						callFailedCallbacksForUnprocessedFiles(
							fileNameToUploadFileMap,
							processedFileNames,
							new Error(errorMessage),
						)
						setIsUploading(false)
						setUploadProgress(0)
						magicToast.error(errorMessage)
						reject(new Error(errorMessage))
					}

					const callbacks = createUploadCallbacks({
						suffixDir,
						uploadSubDir: uploadSubDir as UploadSubDirType,
						designProjectBasePath,
						fileNameToUploadFileMap,
						filesToUpload,
						processedFileNames,
						pendingGetFileInfoRef,
						getFileInfoById,
						setIsUploading,
						setUploadProgress,
						t,
						onComplete: resolve,
						onError: reject,
						onCompleteAlways: updateAttachments,
					})
					multiFolderUploadStore
						.createUploadTask(filesToUpload, parentId, {
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
							errorHandler(error as Error, t("design.errors.createUploadTaskFailed"))
						})
				})
			}

			try {
				for (const group of groups) {
					const responses = await runGroup(group)
					allResponses.push(...responses)
				}
				return allResponses
			} catch (error) {
				setIsUploading(false)
				setUploadProgress(0)
				throw error
			} finally {
				setIsUploading(false)
				setUploadProgress(0)
			}
		},
		[
			projectId,
			flatAttachments,
			t,
			groupByUploadSubDir,
			ensureUploadDirectory,
			setIsUploading,
			setUploadProgress,
			getFileInfoById,
			selectedTopic?.workspace_id,
			selectedTopic?.topic_name,
			selectedTopic?.id,
			updateAttachments,
			designProjectBasePath,
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
									// private 上传落到独立网络存储，返回值不是工作区路径，不能套用 `./images` 规则。
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
		uploadFiles,
		uploadPrivateFiles,
		uploadProgress,
		isUploading,
	}
}
