import type { TabItem, FileItem } from "../types"
import type { AttachmentItem } from "../../../../TopicFilesButton/hooks/types"
import { getParentIdFromPath } from "../../../../TopicFilesButton/utils/getParentIdFromPath"

/**
 * 递归查找指定路径的目录项
 * @param items - 附件树数组
 * @param targetPath - 目标路径
 * @returns 找到的目录项或 undefined
 */
function findDirectoryByPath(
	items: (FileItem | AttachmentItem)[] | undefined,
	targetPath: string,
): FileItem | AttachmentItem | undefined {
	if (!items || !Array.isArray(items) || !targetPath) {
		return undefined
	}

	for (const item of items) {
		const itemPath = item.relative_file_path || ""
		if (item.is_directory && itemPath === targetPath) {
			return item
		}
		if (item.is_directory && Array.isArray(item.children)) {
			const found = findDirectoryByPath(item.children, targetPath)
			if (found) return found
		}
	}
	return undefined
}

/**
 * 获取文件的 tab title
 * 对于 index.html 文件：优先从文件 metadata.name 获取，其次从父目录 metadata.name 获取，最后使用目录名称
 * 对于其他文件：优先从 metadata.name 获取，否则使用文件名
 * @param file - 文件项
 * @param attachments - 附件树数组（用于查找父目录）
 * @param metadata - 可选的元数据（优先使用）
 * @returns tab title
 */
export function getFileTabTitle(
	file: FileItem | AttachmentItem,
	attachments?: FileItem[] | AttachmentItem[],
	metadata?: Record<string, unknown>,
): string {
	const fileName = file.display_filename || file.file_name || file.filename || "未命名文件"
	const fileMetadata = metadata || file.metadata

	// 检查是否为 index.html
	if (fileName.toLowerCase() === "index.html" && file.relative_file_path) {
		// 优先从 index.html 文件的 metadata.name 获取
		if (fileMetadata && typeof fileMetadata.name === "string" && fileMetadata.name.trim()) {
			return fileMetadata.name.trim()
		}

		// 其次从父目录的 metadata.name 获取
		const parentPath = file.relative_file_path.split("/").slice(0, -1).join("/")
		const parentDirectory = parentPath
			? findDirectoryByPath(attachments as FileItem[] | undefined, parentPath)
			: undefined
		const parentMetadata = parentDirectory?.metadata
		if (
			parentMetadata &&
			typeof parentMetadata.name === "string" &&
			parentMetadata.name.trim()
		) {
			return parentMetadata.name.trim()
		}

		// 如果文件或目录有 metadata（但没有 name），使用目录名称作为 tab title
		const hasFileMetadata = !!fileMetadata
		const hasParentMetadata = !!parentMetadata
		if (hasFileMetadata || hasParentMetadata) {
			const pathParts = file.relative_file_path.split("/")
			if (pathParts.length > 1) {
				// 使用父目录名称
				const directoryName = pathParts[pathParts.length - 2]
				return directoryName || fileName
			}
		}
	}

	// 对于非 index.html 文件，优先从 metadata.name 获取
	if (fileMetadata && typeof fileMetadata.name === "string" && fileMetadata.name.trim()) {
		return fileMetadata.name.trim()
	}

	return fileName
}

/**
 * Convert file item to tab item
 * @param file - File item to convert (FileItem or AttachmentItem)
 * @param attachments - Array of attachments for parent ID calculation
 * @param options - Additional options for tab creation
 * @returns TabItem or null if file is invalid
 */
export function convertFileToTabItem(
	file: FileItem | AttachmentItem,
	attachments?: FileItem[] | AttachmentItem[],
	options?: {
		metadata?: Record<string, unknown>
		create_at?: number
		active_at?: number
		active?: boolean
		closeable?: boolean
	},
): TabItem | null {
	if (!file || !file.file_id) {
		return null
	}

	const fileMetadata = options?.metadata || file.metadata
	const tabTitle = getFileTabTitle(file, attachments, fileMetadata)

	const parentPath = file.relative_file_path?.split("/").slice(0, -1).join("/") || ""

	const now = Date.now()

	const tabItem: TabItem = {
		id: file.file_id,
		title: tabTitle,
		fileData: {
			...file,
			file_id: file.file_id,
			parent_id: getParentIdFromPath(attachments as AttachmentItem[] | undefined, parentPath),
			metadata: fileMetadata,
		} as FileItem,
		active: options?.active ?? true,
		closeable: options?.closeable ?? true,
		filePath: file.relative_file_path,
		metadata: fileMetadata,
		// Note: create_at and active_at will be set by reducer if used through dispatchTabs
		// For direct setCurrentTabs calls, these values are preserved
		create_at: options?.create_at ?? now,
		active_at: options?.active_at ?? now,
	}

	return tabItem
}

/**
 * Calculate calvedRelativePath for duplicate names
 * @param filePath - The file path to process
 * @param existingPaths - Array of existing file paths to check against
 * @returns The calculated relative path or undefined if no duplicates
 */
export function calculateCalvedRelativePath(
	filePath: string | undefined,
	existingPaths: string[],
): string | undefined {
	if (!filePath) return undefined

	// Extract filename from path
	const pathParts = filePath.split("/")
	const filename = pathParts[pathParts.length - 1]

	// Find all existing tabs with the same filename
	const duplicateFilenames = existingPaths.filter((path) => {
		if (!path) return false
		const existingFilename = path.split("/").pop()
		return existingFilename === filename
	})

	// If no duplicates found, no need for calvedRelativePath
	if (duplicateFilenames.length === 0) {
		return undefined
	}

	// Calculate minimum required parent directories to make paths unique
	let requiredDepth = 1
	const maxDepth = pathParts.length - 1 // Exclude filename

	while (requiredDepth <= maxDepth) {
		const currentPath = pathParts.slice(-requiredDepth - 1, -1).join("/")

		// Check if this path is unique among duplicates
		const conflictingPaths = duplicateFilenames.filter((path) => {
			const existingParts = path.split("/")
			const existingPath = existingParts.slice(-requiredDepth - 1, -1).join("/")
			return existingPath === currentPath
		})

		if (conflictingPaths.length === 0) {
			return currentPath ? `../${currentPath}` : "./"
		}

		requiredDepth++
	}

	// If still not unique, return the full directory path with prefix
	const fullPath = pathParts.slice(0, -1).join("/")
	return fullPath ? `../${fullPath}` : "./"
}

/**
 * Handle adding new tab to state
 * @param state - Current tabs state
 * @param newTab - New tab being added
 * @returns Updated state with new tab added and filePath set
 */
export function handleDuplicateTabNames(state: TabItem[], newTab: TabItem): TabItem[] {
	// 简化逻辑：相对路径现在在渲染层动态计算，这里只需要添加tab并设置filePath
	const newTabFilePath = newTab.fileData.relative_file_path || newTab.filePath

	return [
		...state.map((tab) => ({
			...tab,
			active: false,
			filePath: tab.fileData.relative_file_path || tab.filePath,
		})),
		{
			...newTab,
			filePath: newTabFilePath,
		},
	]
}
