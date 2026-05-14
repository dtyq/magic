import { useCallback } from "react"
import { SuperMagicApiErrorCode } from "@/pages/superMagic/constants/apiErrorCodes"
import type { FileItem } from "@/pages/superMagic/components/Detail/components/FilesViewer/types"
import type { DesignAttachmentIndex } from "../utils/designAttachmentIndex"
import {
	DRAG_TYPE,
	type TabDragData,
	type AttachmentDragData,
	type MultipleFilesDragData,
} from "@/pages/superMagic/components/MessageEditor/utils/drag"
import { SuperMagicApi } from "@/apis"
import { calculateUploadDirectory } from "../utils/calculateUploadDirectory"
import { normalizePath, findFileBySrc } from "../utils/utils"
import type { GetOrCreateImagesDirFn } from "./useGetOrCreateImagesDir"
import {
	normalizeDesignAttachmentPathForCanvas,
	resolveDesignDslPathCandidatesToWorkspaceRelative,
} from "../utils/designDslPathUtils"
import {
	SUPPORTED_AUDIO_EXTENSIONS,
	SUPPORTED_VIDEO_EXTENSIONS,
	validateCanvasFilePath,
} from "@/components/CanvasDesign/canvas/utils/utils"
import { UploadSubDir, type UploadSubDirType } from "@/components/CanvasDesign/types.magic"

interface UseDesignFileCopyOptions {
	projectId?: string
	currentFile?: {
		id: string
		name: string
	}
	/** 已扁平化的附件列表 */
	flatAttachments?: FileItem[]
	attachmentIndex?: DesignAttachmentIndex | null
	/** 画布目录路径段，解析相对路径与附件路径对齐（`images/...` 或 `./images/...`） */
	designProjectBasePath?: string
	/** 文件列表更新 */
	updateAttachments: () => void
	/** 获取或创建 images 目录的函数（从顶层传入） */
	getOrCreateImagesDir?: GetOrCreateImagesDirFn
}

interface UseDesignFileCopyReturn {
	/**
	 * 复制文件到设计资源子目录（images / videos / audios）
	 */
	copyFileToDesignAssetDirectory: (
		filePath: string,
		assetDirPath: string,
		assetDirItem: FileItem,
	) => Promise<string>
	/**
	 * 从 DataTransfer 获取文件路径信息
	 * 支持从 Tab、文件列表等拖拽的数据中提取文件路径
	 * 若文件不在对应子目录下，会自动复制到 images（图片）、videos（视频）或 audios（音频）
	 */
	getDataTransferFileInfo: (dataTransfer: DataTransfer) => Promise<string[]>
}

function isDesignAssetVideoPath(filePath: string): boolean {
	const lower = filePath.toLowerCase()
	return SUPPORTED_VIDEO_EXTENSIONS.some((ext) => lower.endsWith(ext))
}

function isDesignAssetAudioPath(filePath: string): boolean {
	const lower = filePath.toLowerCase()
	return SUPPORTED_AUDIO_EXTENSIONS.some((ext) => lower.endsWith(ext))
}

/**
 * 设计文件复制 Hook
 * 职责：将画布可用资源复制到设计项目的 images / videos / audios 子目录
 * - 提供 getDataTransferFileInfo 用于拖拽落画布前的路径解析与复制
 */
export function useDesignFileCopy(options: UseDesignFileCopyOptions): UseDesignFileCopyReturn {
	const {
		projectId,
		currentFile,
		flatAttachments,
		attachmentIndex,
		designProjectBasePath,
		updateAttachments,
	} = options

	const copyFileToDesignAssetDirectory = useCallback(
		async (filePath: string, assetDirPath: string, assetDirItem: FileItem): Promise<string> => {
			const fileItem = findFileBySrc(
				filePath,
				flatAttachments || [],
				designProjectBasePath,
				attachmentIndex,
			)

			if (!fileItem?.file_id) {
				return filePath
			}

			if (!projectId) {
				return filePath
			}

			const fileName = fileItem.file_name || filePath.split("/").pop() || ""
			const expectedPathInDir = `${assetDirPath}/${fileName}`
			const normalizedExpectedPath = normalizePath(expectedPathInDir)
			const existingFileInDir = flatAttachments?.find(
				(item) =>
					!item.is_directory &&
					normalizePath(item.relative_file_path || "") === normalizedExpectedPath,
			)

			if (existingFileInDir) {
				return normalizeDesignAttachmentPathForCanvas(
					existingFileInDir.relative_file_path || expectedPathInDir,
					designProjectBasePath,
				)
			}

			try {
				const copyResult = await SuperMagicApi.copyFiles({
					file_ids: [fileItem.file_id],
					project_id: projectId,
					target_parent_id: assetDirItem.file_id,
					pre_file_id: "",
				})

				const newPath = normalizeDesignAttachmentPathForCanvas(
					`${assetDirPath}/${fileName}`,
					designProjectBasePath,
				)

				if (copyResult.status === "success") {
					updateAttachments()
					return newPath
				}
				if (copyResult.status === "processing" && copyResult.batch_key) {
					updateAttachments()
					return newPath
				}
				return filePath
			} catch {
				return filePath
			}
		},
		[projectId, flatAttachments, attachmentIndex, designProjectBasePath, updateAttachments],
	)

	const getDataTransferFileInfo = useCallback(
		async (dataTransfer: DataTransfer): Promise<string[]> => {
			const filePaths: string[] = []

			// 尝试从 text/plain 中获取自定义拖拽数据
			const customData = dataTransfer.getData("text/plain")
			if (customData) {
				try {
					const parsedData = JSON.parse(customData) as
						| TabDragData
						| AttachmentDragData
						| MultipleFilesDragData

					switch (parsedData.type) {
						case DRAG_TYPE.Tab: {
							// Tab 拖拽：从 fileData 中获取路径
							const tabData = parsedData.data
							const filePath =
								tabData.fileData?.relative_file_path || tabData.filePath
							if (filePath && !tabData.fileData?.is_directory) {
								filePaths.push(filePath)
							}
							break
						}
						case DRAG_TYPE.ProjectFile: {
							// 单个文件拖拽：直接获取路径
							const attachmentData = parsedData.data
							if (attachmentData.relative_file_path && !attachmentData.is_directory) {
								filePaths.push(attachmentData.relative_file_path)
							}
							break
						}
						case DRAG_TYPE.ProjectDirectory: {
							// 目录拖拽：跳过（不返回目录路径）
							break
						}
						case DRAG_TYPE.MultipleFiles: {
							// 多文件拖拽：遍历数组提取文件路径
							const files = parsedData.data
							for (const file of files) {
								if (file.relative_file_path && !file.is_directory) {
									filePaths.push(file.relative_file_path)
								}
							}
							break
						}
						default:
							break
					}
				} catch (error) {
					// JSON 解析失败，忽略自定义数据
					console.warn("[getDataTransferFileInfo] 解析拖拽数据失败:", error)
				}
			}

			// 过滤掉空值和重复值
			const uniquePaths = Array.from(new Set(filePaths.filter(Boolean)))

			// 如果没有路径，直接返回
			if (uniquePaths.length === 0) {
				return []
			}

			// 验证文件类型，过滤掉不支持的文件
			const validatedPaths: string[] = []
			const invalidPaths: Array<{ path: string; reason: string }> = []

			for (const filePath of uniquePaths) {
				const validation = validateCanvasFilePath(filePath)
				if (validation.valid) {
					validatedPaths.push(filePath)
				} else {
					invalidPaths.push({
						path: filePath,
						reason: validation.reason || "未知错误",
					})
				}
			}

			if (validatedPaths.length === 0 || !projectId || !currentFile || !flatAttachments) {
				return validatedPaths
			}

			const ensureDesignAssetDirectory = async (
				subDir: UploadSubDirType,
			): Promise<{
				assetDirPath: string
				normalizedAssetDirPath: string
				assetDirItem: FileItem
			} | null> => {
				const assetDirPath = calculateUploadDirectory(
					{ currentFile, flatAttachments },
					subDir,
				)
				if (!assetDirPath) {
					return null
				}

				const normalizedAssetDirPath = normalizePath(assetDirPath)
				let assetDirItem = flatAttachments.find(
					(item: FileItem) =>
						item.is_directory &&
						normalizePath(item.relative_file_path || "") === normalizedAssetDirPath,
				)

				if (!assetDirItem?.file_id) {
					const parentDirPath = assetDirPath.includes("/")
						? assetDirPath.substring(0, assetDirPath.lastIndexOf("/"))
						: ""
					const normalizedParentDirPath = normalizePath(parentDirPath)
					const parentDirItem = flatAttachments.find(
						(item: FileItem) =>
							item.is_directory &&
							normalizePath(item.relative_file_path || "") ===
								normalizedParentDirPath,
					)
					const parentDirId = parentDirItem?.file_id || currentFile?.id

					if (!parentDirId) {
						return null
					}

					try {
						const createResponse = await SuperMagicApi.createFile({
							project_id: projectId,
							parent_id: parentDirId,
							file_name: subDir,
							is_directory: true,
						})

						if (createResponse?.file_id) {
							assetDirItem = {
								file_id: createResponse.file_id,
								file_name: subDir,
								relative_file_path: assetDirPath,
								is_directory: true,
							} as FileItem
							updateAttachments()
						} else {
							return null
						}
					} catch (error: unknown) {
						const errorObj = error as { code?: number; message?: string }
						if (errorObj.code === SuperMagicApiErrorCode.DuplicateFile) {
							updateAttachments()
							assetDirItem = flatAttachments.find(
								(item: FileItem) =>
									item.is_directory &&
									normalizePath(item.relative_file_path || "") ===
										normalizedAssetDirPath,
							)
							if (!assetDirItem?.file_id) {
								return null
							}
						} else {
							return null
						}
					}
				}

				return { assetDirPath, normalizedAssetDirPath, assetDirItem }
			}

			const dirContextBySubDir = new Map<
				UploadSubDirType,
				{ assetDirPath: string; normalizedAssetDirPath: string; assetDirItem: FileItem }
			>()

			const getOrEnsureAssetDir = async (subDir: UploadSubDirType) => {
				const ctx = dirContextBySubDir.get(subDir)
				if (ctx) {
					return ctx
				}
				const ensured = await ensureDesignAssetDirectory(subDir)
				if (!ensured) {
					return null
				}
				dirContextBySubDir.set(subDir, ensured)
				return ensured
			}

			const processedPaths: string[] = []

			for (const filePath of validatedPaths) {
				const uploadSubDir = isDesignAssetVideoPath(filePath)
					? UploadSubDir.Videos
					: isDesignAssetAudioPath(filePath)
						? UploadSubDir.Audios
						: UploadSubDir.Images
				const dirCtx = await getOrEnsureAssetDir(uploadSubDir)
				if (!dirCtx) {
					processedPaths.push(filePath)
					continue
				}

				const { assetDirPath, normalizedAssetDirPath, assetDirItem } = dirCtx
				const normalizedFilePathCandidates =
					resolveDesignDslPathCandidatesToWorkspaceRelative(
						filePath,
						designProjectBasePath,
					).map((candidate) => normalizePath(candidate))
				const matchedFile = flatAttachments.find(
					(item) =>
						!item.is_directory &&
						normalizedFilePathCandidates.includes(
							normalizePath(item.relative_file_path || ""),
						),
				)
				const matchedFilePath = normalizePath(matchedFile?.relative_file_path || "")
				const isInAssetDir = matchedFilePath.startsWith(normalizedAssetDirPath + "/")

				const fileName = filePath.split("/").pop() || ""
				const expectedPathInAssetDir = `${assetDirPath}/${fileName}`
				const normalizedExpectedPath = normalizePath(expectedPathInAssetDir)
				const existingFileInAssetDir = flatAttachments.find(
					(item: FileItem) =>
						!item.is_directory &&
						normalizePath(item.relative_file_path || "") === normalizedExpectedPath,
				)

				if (isInAssetDir || existingFileInAssetDir) {
					processedPaths.push(
						normalizeDesignAttachmentPathForCanvas(
							existingFileInAssetDir?.relative_file_path || filePath,
							designProjectBasePath,
						),
					)
				} else {
					const newPath = await copyFileToDesignAssetDirectory(
						filePath,
						assetDirPath,
						assetDirItem,
					)
					processedPaths.push(newPath)
				}
			}
			return processedPaths
		},
		[
			projectId,
			currentFile,
			flatAttachments,
			designProjectBasePath,
			updateAttachments,
			copyFileToDesignAssetDirectory,
		],
	)

	return {
		copyFileToDesignAssetDirectory,
		getDataTransferFileInfo,
	}
}
