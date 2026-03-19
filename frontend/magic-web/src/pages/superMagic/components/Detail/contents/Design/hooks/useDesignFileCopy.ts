import { useCallback } from "react"
import type { FileItem } from "@/pages/superMagic/components/Detail/components/FilesViewer/types"
import {
	DRAG_TYPE,
	type TabDragData,
	type AttachmentDragData,
	type MultipleFilesDragData,
} from "@/pages/superMagic/components/MessageEditor/utils/drag"
import { SuperMagicApi } from "@/apis"
import { calculateUploadDirectory } from "../utils/calculateUploadDirectory"
import { normalizePath, findFileBySrc } from "../utils/utils"
import { validateImageFilePath } from "@/components/CanvasDesign/canvas/utils/utils"

interface UseDesignFileCopyOptions {
	projectId?: string
	currentFile?: {
		id: string
		name: string
	}
	/** 已扁平化的附件列表 */
	flatAttachments?: FileItem[]
	/** 文件列表更新 */
	updateAttachments: () => void
}

interface UseDesignFileCopyReturn {
	/**
	 * 复制文件到 images 目录
	 * @param filePath 文件路径
	 * @param imagesDirPath images 目录路径
	 * @param imagesDirItem images 目录项
	 * @returns 复制后的新路径，如果复制失败则返回原路径
	 */
	copyFileToImagesDirectory: (
		filePath: string,
		imagesDirPath: string,
		imagesDirItem: FileItem,
	) => Promise<string>
	/**
	 * 从 DataTransfer 获取文件路径信息
	 * 支持从 Tab、文件列表等拖拽的数据中提取文件路径
	 * 如果文件不在设计项目的 images 目录下，会自动复制到 images 目录
	 */
	getDataTransferFileInfo: (dataTransfer: DataTransfer) => Promise<string[]>
}

/**
 * 设计文件复制 Hook
 * 职责：处理文件复制到 images 目录的逻辑
 * - 提供 copyFileToImagesDirectory 函数用于复制文件到 images 目录
 * - 提供 getDataTransferFileInfo 函数用于从拖拽数据中提取文件路径并自动复制
 */
export function useDesignFileCopy(options: UseDesignFileCopyOptions): UseDesignFileCopyReturn {
	const { projectId, currentFile, flatAttachments, updateAttachments } = options

	/**
	 * 复制文件到 images 目录
	 * @param filePath 文件路径
	 * @param imagesDirPath images 目录路径
	 * @param imagesDirItem images 目录项
	 * @returns 复制后的新路径，如果复制失败则返回原路径
	 */
	const copyFileToImagesDirectory = useCallback(
		async (
			filePath: string,
			imagesDirPath: string,
			imagesDirItem: FileItem,
		): Promise<string> => {
			// 从 flatAttachments 中查找文件
			const fileItem = findFileBySrc(filePath, flatAttachments || [])

			if (!fileItem?.file_id) {
				return filePath
			}

			if (!projectId) {
				return filePath
			}

			// 检查目标目录是否已存在同名文件
			const fileName = fileItem.file_name || filePath.split("/").pop() || ""
			const expectedPathInImages = `/${imagesDirPath}/${fileName}`
			const normalizedExpectedPath = normalizePath(expectedPathInImages)
			const existingFileInImages = flatAttachments?.find(
				(item) =>
					!item.is_directory &&
					normalizePath(item.relative_file_path || "") === normalizedExpectedPath,
			)

			// 如果文件已存在，直接返回已存在的文件路径
			if (existingFileInImages) {
				return existingFileInImages.relative_file_path || expectedPathInImages
			}

			try {
				// 复制文件到 images 目录
				const copyResult = await SuperMagicApi.copyFiles({
					file_ids: [fileItem.file_id],
					project_id: projectId,
					target_parent_id: imagesDirItem.file_id,
					pre_file_id: "",
				})

				// 构造新路径
				const newPath = `/${imagesDirPath}/${fileName}`

				// 处理复制结果
				if (copyResult.status === "success") {
					// 复制成功
					updateAttachments()
					return newPath
				} else if (copyResult.status === "processing" && copyResult.batch_key) {
					// 复制任务正在处理中
					updateAttachments()
					return newPath
				} else {
					// 复制失败，返回原路径
					return filePath
				}
			} catch (error) {
				// 复制过程中出错，返回原路径
				return filePath
			}
		},
		[projectId, flatAttachments, updateAttachments],
	)

	/**
	 * 从 DataTransfer 获取文件路径信息
	 * 支持从 Tab、文件列表等拖拽的数据中提取文件路径
	 * 如果文件不在设计项目的 images 目录下，会自动复制到 images 目录
	 */
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
				const validation = validateImageFilePath(filePath)
				if (validation.valid) {
					validatedPaths.push(filePath)
				} else {
					invalidPaths.push({
						path: filePath,
						reason: validation.reason || "未知错误",
					})
				}
			}

			// 如果没有有效文件或缺少必要参数，直接返回
			if (validatedPaths.length === 0 || !projectId || !currentFile || !flatAttachments) {
				return validatedPaths
			}

			// 计算 images 目录路径
			const imagesDirPath = calculateUploadDirectory({
				currentFile,
				flatAttachments,
			})

			if (!imagesDirPath) {
				return validatedPaths
			}

			// 标准化 images 目录路径用于比较
			const normalizedImagesDirPath = normalizePath(imagesDirPath)

			// 查找 images 目录的 ID
			let imagesDirItem = flatAttachments.find(
				(item) =>
					item.is_directory &&
					normalizePath(item.relative_file_path || "") === normalizedImagesDirPath,
			)

			// 如果 images 目录不存在，尝试创建它
			if (!imagesDirItem?.file_id) {
				// 计算父目录路径（去掉最后的 /images）
				const parentDirPath = imagesDirPath.includes("/")
					? imagesDirPath.substring(0, imagesDirPath.lastIndexOf("/"))
					: ""
				const normalizedParentDirPath = normalizePath(parentDirPath)

				// 查找父目录
				const parentDirItem = flatAttachments.find(
					(item) =>
						item.is_directory &&
						normalizePath(item.relative_file_path || "") === normalizedParentDirPath,
				)

				// 如果找不到父目录，尝试使用 currentFile 作为父目录
				const parentDirId = parentDirItem?.file_id || currentFile?.id

				if (!parentDirId) {
					return validatedPaths
				}

				try {
					// 创建 images 目录
					const createResponse = await SuperMagicApi.createFile({
						project_id: projectId,
						parent_id: parentDirId,
						file_name: "images",
						is_directory: true,
					})

					// 使用 API 返回的结果构造 imagesDirItem
					if (createResponse?.file_id) {
						imagesDirItem = {
							file_id: createResponse.file_id,
							file_name: "images",
							relative_file_path: `/${imagesDirPath}`,
							is_directory: true,
						} as FileItem

						// 触发文件列表更新（异步，不影响当前操作）
						updateAttachments()
					} else {
						return validatedPaths
					}
				} catch (error: unknown) {
					// 如果是"文件已存在"错误（code: 51168），说明目录已经存在，触发更新后重新查找
					const errorObj = error as { code?: number; message?: string }
					if (errorObj.code === 51168) {
						// 触发文件列表更新，确保获取最新的文件列表
						updateAttachments()

						// 重新查找 images 目录
						imagesDirItem = flatAttachments.find(
							(item) =>
								item.is_directory &&
								normalizePath(item.relative_file_path || "") ===
								normalizedImagesDirPath,
						)

						if (!imagesDirItem?.file_id) {
							return validatedPaths
						}
					} else {
						return validatedPaths
					}
				}
			}

			// 处理每个文件路径，检查是否需要复制
			const processedPaths: string[] = []

			for (const filePath of validatedPaths) {
				const normalizedFilePath = normalizePath(filePath)

				// 检查文件是否已经在 images 目录下
				const isInImagesDir = normalizedFilePath.startsWith(normalizedImagesDirPath + "/")

				// 检查文件是否真的存在于 images 目录中（通过 flatAttachments）
				const fileName = filePath.split("/").pop() || ""
				const expectedPathInImages = `/${imagesDirPath}/${fileName}`
				const normalizedExpectedPath = normalizePath(expectedPathInImages)
				const existingFileInImages = flatAttachments.find(
					(item) =>
						!item.is_directory &&
						normalizePath(item.relative_file_path || "") === normalizedExpectedPath,
				)
				const fileExistsInImages = !!existingFileInImages

				if (isInImagesDir || fileExistsInImages) {
					// 文件已在 images 目录下，使用 images 目录中的路径（如果找到）或原路径
					const finalPath = existingFileInImages?.relative_file_path || filePath
					processedPaths.push(finalPath)
				} else {
					// 文件不在 images 目录下，需要复制
					const newPath = await copyFileToImagesDirectory(
						filePath,
						imagesDirPath,
						imagesDirItem,
					)
					processedPaths.push(newPath)
				}
			}
			return processedPaths
		},
		[projectId, currentFile, flatAttachments, copyFileToImagesDirectory],
	)

	return {
		copyFileToImagesDirectory,
		getDataTransferFileInfo,
	}
}
