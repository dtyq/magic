import type { FileItem } from "@/opensource/pages/superMagic/components/Detail/components/FilesViewer/types"

interface CalculateUploadDirectoryParams {
	currentFile?: {
		id: string
		name: string
	}
	/** 已扁平化的附件列表 */
	flatAttachments?: FileItem[]
}

/**
 * 计算图片上传的目标目录路径
 * 基于当前设计文件的路径，计算 images 子目录的路径
 */
export function calculateUploadDirectory(params: CalculateUploadDirectoryParams): string {
	const { currentFile, flatAttachments } = params

	if (!currentFile?.id || !flatAttachments || flatAttachments.length === 0) {
		return ""
	}

	// 查找 design 项目文件/文件夹
	const designProjectFile = flatAttachments.find((item) => item.file_id === currentFile.id)

	if (!designProjectFile?.relative_file_path) {
		return ""
	}

	const filePath = designProjectFile.relative_file_path
	let suffixDir = ""

	// 如果是文件夹，直接使用路径
	if (designProjectFile.is_directory) {
		suffixDir = filePath
	} else {
		// 如果是文件，计算目录路径：去掉文件名，保留目录部分
		const fileName = designProjectFile.file_name || currentFile.name

		// 如果文件路径以文件名结尾，则去掉文件名
		if (filePath.endsWith(fileName)) {
			suffixDir = filePath.slice(0, -fileName.length)
		} else {
			// 否则使用文件路径的目录部分
			const lastSlashIndex = filePath.lastIndexOf("/")
			if (lastSlashIndex >= 0) {
				suffixDir = filePath.slice(0, lastSlashIndex + 1)
			}
		}
	}

	// 清理路径：移除前导和尾随斜杠，确保路径格式统一
	suffixDir = suffixDir.replace(/^\/+|\/+$/g, "")

	// 添加 images 子目录
	suffixDir = suffixDir ? `${suffixDir}/images` : "images"

	return suffixDir
}
