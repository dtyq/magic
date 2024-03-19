import type { AttachmentItem } from "../hooks/types"

/**
 * 获取目标上传路径
 *
 * @param targetItem 目标文件或文件夹
 * @param attachments 所有附件列表（用于查找父文件夹）
 * @returns 上传路径字符串
 */
export function getTargetUploadPath(
	targetItem: AttachmentItem | null,
	attachments: AttachmentItem[],
): string {
	// 拖到根目录（null）
	if (!targetItem) {
		return "/"
	}

	// 拖到文件夹
	if (targetItem.is_directory) {
		// 返回文件夹的相对路径，如果没有则返回根目录
		return targetItem.relative_file_path || "/"
	}

	// 拖到文件：查找其父文件夹的路径
	const parentId = targetItem.parent_id

	// 如果没有 parent_id，说明在根目录
	if (!parentId) {
		return "/"
	}

	// 查找父文件夹
	const parentFolder = attachments.find((item) => item.file_id === parentId && item.is_directory)

	// 如果找到父文件夹，返回其路径；否则返回根目录
	return parentFolder?.relative_file_path || "/"
}

/**
 * 将路径转换为目录名称数组（用于上传）
 * 例如："/folder1/folder2/" -> ["folder1", "folder2"]
 *
 * @param path 文件路径
 * @returns 目录名称数组
 */
export function pathToDirectoryNames(path: string): string[] {
	if (!path || path === "/") {
		return []
	}

	// 移除开头和结尾的斜杠，然后分割
	const cleanPath = path.replace(/^\/+|\/+$/g, "")
	if (!cleanPath) {
		return []
	}

	return cleanPath.split("/").filter(Boolean)
}

/**
 * 检查路径是否为根目录
 *
 * @param path 文件路径
 * @returns 是否为根目录
 */
export function isRootPath(path: string): boolean {
	return !path || path === "/" || path.trim() === ""
}
