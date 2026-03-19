import IconDocFile from "@/enhance/tabler/icons-react/icons/IconDocFile"
import IconImageFile from "@/enhance/tabler/icons-react/icons/IconImageFile"
import IconOtherFile from "@/enhance/tabler/icons-react/icons/IconOtherFile"
import { getFileNameExtension } from "@/utils/file"
import type { AttachmentItem } from "../../../TopicFilesButton/hooks/types"

/**
 * Get item name from attachment item
 */
export function getItemName(item: AttachmentItem): string {
	return item?.file_name || item?.name || ""
}

/**
 * Get item id from attachment item
 */
export function getItemId(item: AttachmentItem): string {
	return item?.file_id || item?.id || ""
}

/**
 * Get directories from path
 */
export function getDirectoriesFromPath(
	attachments: AttachmentItem[],
	path: AttachmentItem[],
): AttachmentItem[] {
	if (!attachments || !Array.isArray(attachments)) {
		return []
	}

	// If path is empty, return root level directories
	if (!path || path.length === 0) {
		console.log("attachments", attachments)
		return attachments.filter((item) => !item.is_hidden)
	}

	// Get the last directory in path
	const currentDir = path[path.length - 1]
	const currentDirId = getItemId(currentDir)

	console.log("currentDirId", currentDirId, attachments)

	// Find subdirectories
	return currentDir.children?.filter((item) => !item.is_hidden) || []
}

/**
 * Search in attachments
 */
export function searchInAttachments(
	attachments: AttachmentItem[],
	searchTerm: string,
	fileTypes: string[] = [],
): AttachmentItem[] {
	if (!attachments || !Array.isArray(attachments) || !searchTerm.trim()) {
		return []
	}

	const term = searchTerm.toLowerCase().trim()

	return attachments.filter((item) => {
		// Must be a directory and not hidden
		if (!item.is_directory || item.is_hidden) {
			return false
		}

		// Check if name matches search term
		const itemName = getItemName(item).toLowerCase()
		const nameMatches = itemName.includes(term)

		// If file types are specified, check file extension
		const typeMatches =
			fileTypes.length === 0 ||
			(item.file_extension && fileTypes.includes(item.file_extension))

		return nameMatches && typeMatches
	})
}

/**
 * Sort files with directories first, then by name
 */
export function sortFiles(files: AttachmentItem[]): AttachmentItem[] {
	return [...files].sort((a, b) => {
		// Directories first
		if (a.is_directory && !b.is_directory) return -1
		if (!a.is_directory && b.is_directory) return 1

		// Then sort by name
		const nameA = getItemName(a).toLowerCase()
		const nameB = getItemName(b).toLowerCase()
		return nameA.localeCompare(nameB)
	})
}

/**
 * Filter only directories from files
 */
export function filterDirectories(files: AttachmentItem[]): AttachmentItem[] {
	return files.filter((item) => !item.is_hidden)
}

/**
 * Generate breadcrumb items from path
 */
export function generateBreadcrumbItems(
	path: AttachmentItem[],
	rootName: string,
): Array<{
	name: string
	id: string
	operation?: string
	children?: Array<{
		name: string
		id: string
		operation?: string
	}>
}> {
	const items = [
		{
			name: rootName,
			id: "0",
			operation: "all",
		},
		...path.map((item) => ({
			name: getItemName(item),
			id: getItemId(item),
			operation: "all",
		})),
	]

	return items
}

/**
 * Check if directory name is duplicate in current directories
 */
export function isDuplicateDirectoryName(name: string, directories: AttachmentItem[]): boolean {
	const normalizedName = name.trim()
	return directories.some((dir) => dir.is_directory && getItemName(dir).trim() === normalizedName)
}

/**
 * Find the complete path from root to target item in the attachment tree
 */
export function findPathToItem(
	attachments: AttachmentItem[],
	targetItemId: string,
	currentPath: AttachmentItem[] = [],
): AttachmentItem[] | null {
	if (!attachments || !Array.isArray(attachments) || !targetItemId) {
		return null
	}

	for (const item of attachments) {
		const itemId = getItemId(item)

		// Check if this is the target item
		if (itemId === targetItemId) {
			return [...currentPath, item]
		}

		// If this is a directory with children, search recursively
		if (item.is_directory && item.children && Array.isArray(item.children)) {
			const foundPath = findPathToItem(item.children, targetItemId, [...currentPath, item])
			if (foundPath) {
				return foundPath
			}
		}
	}

	return null
}

// File type to icon mapping
export const getFileIcon = (filename: string) => {
	const extension = getFileNameExtension(filename).toLowerCase()

	// Image files
	if (["png", "jpg", "jpeg", "gif", "svg", "webp"].includes(extension)) {
		return IconImageFile
	}

	// Document files
	if (["md", "txt", "doc", "docx", "pdf"].includes(extension)) {
		return IconDocFile
	}

	// Default for other files
	return IconOtherFile
}

// Check if file is an image for thumbnail display
export function isImageFile(filename: string): boolean {
	const extension = getFileNameExtension(filename).toLowerCase()
	return ["png", "jpg", "jpeg", "gif", "svg", "webp"].includes(extension)
}

// Create file preview URL for images
export function createFilePreviewUrl(file: File): string | null {
	if (isImageFile(file.name) && file.type.startsWith("image/")) {
		return URL.createObjectURL(file)
	}
	return null
}

// ============= 面包屑宽度计算相关工具函数 =============

// 宽度计算相关常量
export const BREADCRUMB_SEPARATOR_WIDTH = 26 // IconChevronRight: 18px + margin 0 4px = 26px
export const BREADCRUMB_ELLIPSIS_WIDTH = 24 // 省略号按钮固定宽度
export const BREADCRUMB_LOCK_ICON_WIDTH = 16 // 锁图标宽度 (12px + margin 4px)
export const BREADCRUMB_MIN_ITEM_WIDTH = 60 // 单个项的最小宽度
export const BREADCRUMB_PADDING_BUFFER = 40 // 额外的安全缓冲（增加以适应实际渲染）
export const BREADCRUMB_MAX_TEXT_WIDTH = 400 // name 样式最大宽度

// 创建用于测量文本宽度的 Canvas 上下文（复用以提高性能）
let canvasContext: CanvasRenderingContext2D | null = null

function getCanvasContext(): CanvasRenderingContext2D | null {
	if (!canvasContext) {
		const canvas = document.createElement("canvas")
		canvasContext = canvas.getContext("2d")
		if (canvasContext) {
			// 设置与实际渲染相同的字体样式
			canvasContext.font =
				'14px Inter, "PingFang SC", -apple-system, "system-ui", "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif'
		}
	}
	return canvasContext
}

/**
 * 使用 Canvas API 精确测量文本的实际渲染宽度
 */
export function measureTextWidth(text: string): number {
	if (!text) return 0

	try {
		const ctx = getCanvasContext()
		if (!ctx) {
			// 降级方案：粗略估算
			return Math.min(text.length * 8, BREADCRUMB_MAX_TEXT_WIDTH)
		}

		const metrics = ctx.measureText(text)
		return Math.min(Math.ceil(metrics.width), BREADCRUMB_MAX_TEXT_WIDTH)
	} catch (error) {
		// 发生错误时使用降级方案
		console.warn("Failed to measure text width:", error)
		return Math.min(text.length * 8, BREADCRUMB_MAX_TEXT_WIDTH)
	}
}

/**
 * 根据实际文本宽度计算面包屑项的宽度
 */
export function estimateBreadcrumbItemWidth(item: { name: string; operation?: string }): number {
	// 使用 Canvas API 精确测量文本宽度
	const textWidth = measureTextWidth(item.name)
	const lockWidth = item.operation ? 0 : BREADCRUMB_LOCK_ICON_WIDTH

	// 总宽度 = 文本宽度 + 锁图标宽度（如果有）
	// 确保不小于最小宽度
	return Math.max(textWidth + lockWidth, BREADCRUMB_MIN_ITEM_WIDTH)
}
