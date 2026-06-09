import type { FileItem } from "@/pages/superMagic/components/Detail/components/FilesViewer/types"
import { SuperMagicApi } from "@/apis"
import { SuperMagicApiErrorCode } from "@/pages/superMagic/constants/apiErrorCodes"
import { findImagesDirItem, findParentDirectoryId } from "./fileFinder"
import { UploadSubDir } from "@/components/CanvasDesign/types.magic"

interface CalculateUploadDirectoryParams {
	currentFile?: {
		id: string
		name: string
	}
	/** 已扁平化的附件列表 */
	flatAttachments?: FileItem[]
}

interface GetOrCreateImagesDirFileIdParams extends CalculateUploadDirectoryParams {
	projectId: string
	updateAttachments: () => void
}

export interface GetOrCreateImagesDirFileIdResult {
	imagesDirFileId: string
	suffixDir: string
}

/**
 * 获取或创建 images 目录，返回其 file_id
 * 用于文件上传改造：batch-save 时通过 parent_id 构建文件树，需传入目标目录的 file_id
 */
export async function getOrCreateImagesDirFileId(
	params: GetOrCreateImagesDirFileIdParams,
): Promise<GetOrCreateImagesDirFileIdResult | null> {
	const { currentFile, flatAttachments, projectId, updateAttachments } = params
	const suffixDir = calculateUploadDirectory({ currentFile, flatAttachments })

	if (!suffixDir || !projectId) {
		return null
	}

	// 查找已存在的 images 目录
	let imagesDirItem = findImagesDirItem(suffixDir, flatAttachments)

	if (imagesDirItem?.file_id) {
		return { imagesDirFileId: imagesDirItem.file_id, suffixDir }
	}

	// images 目录不存在，需创建
	// 查找父目录
	const parentDirId = findParentDirectoryId(suffixDir, currentFile, flatAttachments)

	if (parentDirId === undefined) {
		return null
	}

	try {
		const createResponse = await SuperMagicApi.createFile({
			project_id: projectId,
			parent_id: parentDirId,
			file_name: "images",
			is_directory: true,
			ignore_duplicate: true,
		})

		// 使用 API 返回的 file_id
		const fileId = (createResponse as { file_id?: string })?.file_id
		if (fileId) {
			updateAttachments()
			return { imagesDirFileId: fileId, suffixDir }
		}
	} catch (error: unknown) {
		const errorObj = error as { code?: number; message?: string }
		if (errorObj.code === SuperMagicApiErrorCode.DuplicateFile) {
			// 文件已存在，触发更新后重新查找
			updateAttachments()
			imagesDirItem = findImagesDirItem(suffixDir, flatAttachments)
			if (imagesDirItem?.file_id) {
				return { imagesDirFileId: imagesDirItem.file_id, suffixDir }
			}
		}
	}

	return null
}

/**
 * 计算上传目录的「基路径」（不含子目录如 images / videos / audios）
 * 基于当前设计文件的路径，用于与 uploadSubDir 组合得到完整上传路径
 */
export function getUploadDirectoryBase(params: CalculateUploadDirectoryParams): string {
	const { currentFile, flatAttachments } = params

	if (!currentFile?.id || !flatAttachments || flatAttachments.length === 0) {
		return ""
	}

	const designProjectFile = flatAttachments.find((item) => item.file_id === currentFile.id)

	if (!designProjectFile?.relative_file_path) {
		return ""
	}

	const filePath = designProjectFile.relative_file_path
	let suffixDir = ""

	if (designProjectFile.is_directory) {
		suffixDir = filePath
	} else {
		const fileName = designProjectFile.file_name || currentFile.name
		if (filePath.endsWith(fileName)) {
			suffixDir = filePath.slice(0, -fileName.length)
		} else {
			const lastSlashIndex = filePath.lastIndexOf("/")
			if (lastSlashIndex >= 0) {
				suffixDir = filePath.slice(0, lastSlashIndex + 1)
			}
		}
	}

	suffixDir = suffixDir.replace(/^\/+|\/+$/g, "")
	return suffixDir
}

/**
 * 计算图片上传的目标目录路径
 * 基于当前设计文件的路径，计算指定子目录（默认 images）的路径
 */
export function calculateUploadDirectory(
	params: CalculateUploadDirectoryParams,
	subDir: string = UploadSubDir.Images,
): string {
	const base = getUploadDirectoryBase(params)
	return base ? `${base}/${subDir}` : subDir
}
