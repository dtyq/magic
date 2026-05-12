import type { FileItem } from "@/pages/superMagic/components/Detail/components/FilesViewer/types"
import { normalizePath } from "./utils"

/**
 * 根据路径查找文件（非目录）
 * @param path 文件路径
 * @param flatAttachments 已扁平化的附件列表
 * @returns 找到的文件项，如果未找到则返回 null
 */
export function findFileByPath(path: string, flatAttachments?: FileItem[]): FileItem | null {
	if (!path || !flatAttachments || flatAttachments.length === 0) {
		return null
	}

	const normalizedPath = normalizePath(path)
	return (
		flatAttachments.find(
			(item) =>
				!item.is_directory &&
				normalizePath(item.relative_file_path || "") === normalizedPath,
		) || null
	)
}

/**
 * 根据路径查找目录
 * @param path 目录路径
 * @param flatAttachments 已扁平化的附件列表
 * @returns 找到的目录项，如果未找到则返回 null
 */
export function findDirectoryByPath(path: string, flatAttachments?: FileItem[]): FileItem | null {
	if (!path || !flatAttachments || flatAttachments.length === 0) {
		return null
	}

	const normalizedPath = normalizePath(path)
	return (
		flatAttachments.find(
			(item) =>
				item.is_directory &&
				normalizePath(item.relative_file_path || "") === normalizedPath,
		) || null
	)
}

/**
 * 查找 images 目录项
 * @param imagesDirPath images 目录路径（如 "新建画布/images"）
 * @param flatAttachments 已扁平化的附件列表
 * @returns 找到的 images 目录项，如果未找到则返回 null
 */
export function findImagesDirItem(
	imagesDirPath: string,
	flatAttachments?: FileItem[],
): FileItem | null {
	return findDirectoryByPath(imagesDirPath, flatAttachments)
}

/**
 * 查找父目录
 * @param suffixDir 子目录路径（如 "新建画布/images"）
 * @param currentFile 当前文件信息
 * @param flatAttachments 已扁平化的附件列表
 * @returns 父目录的 file_id，如果未找到则返回 undefined
 */
export function findParentDirectoryId(
	suffixDir: string,
	currentFile?: { id: string; name: string },
	flatAttachments?: FileItem[],
): string | undefined {
	if (!suffixDir || !flatAttachments || flatAttachments.length === 0) {
		return undefined
	}

	// 计算父目录路径（去掉最后的 /images）
	const parentDirPath = suffixDir.includes("/")
		? suffixDir.substring(0, suffixDir.lastIndexOf("/"))
		: ""
	const normalizedParentDirPath = normalizePath(parentDirPath)

	// 方法1: 通过路径查找父目录
	if (parentDirPath) {
		const parentDirItem = findDirectoryByPath(normalizedParentDirPath, flatAttachments)
		if (parentDirItem?.file_id) {
			return parentDirItem.file_id
		}
	}

	// 方法2: 如果当前文件是目录，可直接作为父目录
	if (currentFile?.id && flatAttachments.length > 0) {
		const designProjectFile = flatAttachments.find((item) => item.file_id === currentFile.id)
		if (designProjectFile?.is_directory) {
			return designProjectFile.file_id
		}
	}

	// 方法3: 当前文件为普通文件时，使用其 parent_id 作为 images 的父目录
	if (currentFile?.id && flatAttachments.length > 0) {
		const designProjectFile = flatAttachments.find((item) => item.file_id === currentFile.id)
		const parentId = (designProjectFile as FileItem & { parent_id?: string })?.parent_id
		if (parentId) {
			return parentId
		}
	}

	// 方法4: 根目录场景（suffixDir="images"）：parentDirPath 为空，允许 parent_id 为空
	if (parentDirPath === "") {
		return ""
	}

	return undefined
}

/**
 * 比较两个路径是否相同（规范化后比较）
 * @param path1 路径1
 * @param path2 路径2
 * @returns 如果路径相同返回 true，否则返回 false
 */
export function comparePaths(path1: string, path2: string): boolean {
	if (!path1 || !path2) return false
	return normalizePath(path1) === normalizePath(path2)
}

/**
 * 判断文件路径是否在指定目录下
 * @param filePath 文件路径
 * @param dirPath 目录路径
 * @returns 如果文件在目录下返回 true，否则返回 false
 */
export function isPathInDirectory(filePath: string, dirPath: string): boolean {
	if (!filePath || !dirPath) return false
	const normalizedFilePath = normalizePath(filePath)
	const normalizedDirPath = normalizePath(dirPath)
	return normalizedFilePath.startsWith(normalizedDirPath + "/")
}
