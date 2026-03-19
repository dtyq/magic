import { isEmpty } from "lodash-es"
import type { AttachmentItem } from "../../TopicFilesButton/hooks"
import { CollaboratorPermissionEnum } from "@/pages/superMagic/types/collaboration"

/**
 * 工具函数：获取项目的显示名称
 */
export function getItemName(item: AttachmentItem): string {
	return item.name || item.file_name || item.filename || item.display_filename || ""
}

/**
 * 工具函数：获取项目的ID
 */
export function getItemId(item: AttachmentItem): string {
	return item.file_id || ""
}

/**
 * 工具函数：根据路径从 attachments 中获取目录和文件内容
 */
export function getDirectoriesFromPath(
	attachments: AttachmentItem[],
	path: AttachmentItem[],
): AttachmentItem[] {
	let currentLevel = attachments

	// 如果路径为空，返回根级所有内容（目录和文件）
	if (isEmpty(path)) {
		return currentLevel
	}

	// 根据路径导航到对应目录
	for (const pathItem of path) {
		const found = currentLevel.find(
			(item) =>
				(getItemId(item) && getItemId(item) === getItemId(pathItem)) ||
				(getItemName(item) === getItemName(pathItem) && item.is_directory),
		)

		if (found && found.children) {
			currentLevel = found.children
		} else {
			return []
		}
	}

	// 返回当前级别的所有内容（目录和文件）
	return currentLevel
}

/**
 * 工具函数：在 attachments 中搜索文件和目录
 * @param attachments 附件列表
 * @param searchTerm 搜索关键词
 * @param fileTypes 可选的文件类型过滤（仅对文件生效，目录不受影响）
 */
export function searchInAttachments(
	attachments: AttachmentItem[],
	searchTerm: string,
	fileTypes: string[] = [],
): AttachmentItem[] {
	const results: AttachmentItem[] = []

	const searchRecursive = (items: AttachmentItem[]) => {
		for (const item of items) {
			const name = getItemName(item)
			const matchesName = name.toLowerCase().includes(searchTerm.toLowerCase())

			// 检查文件类型过滤
			let matchesType = true
			if (fileTypes.length > 0 && !item.is_directory) {
				const extension = item.file_extension || ""
				matchesType = fileTypes.includes(extension)
			}

			if (matchesName && matchesType) {
				results.push(item)
			}

			// 递归搜索子目录
			if (item.children) {
				searchRecursive(item.children)
			}
		}
	}

	searchRecursive(attachments)
	return results
}

/**
 * 工具函数：判断是否有编辑权限（拥有者、管理员、编辑者）
 */
export function hasEditPermission(userRole?: string): boolean {
	if (!userRole) {
		// 如果没有 user_role，可能是自己的项目，默认允许
		return true
	}
	return (
		userRole === CollaboratorPermissionEnum.OWNER ||
		userRole === CollaboratorPermissionEnum.MANAGE ||
		userRole === CollaboratorPermissionEnum.EDITABLE
	)
}

/**
 * 递归收集所有子文件夹ID
 */
export function collectAllSubFolderIds(items: AttachmentItem[], folderIds: string[]): void {
	items.forEach((item) => {
		if (item.is_directory && item.file_id) {
			folderIds.push(item.file_id)
			if (item.children) {
				collectAllSubFolderIds(item.children, folderIds)
			}
		}
	})
}

/**
 * 收集选中项目中的文件夹ID（包括嵌套的文件夹）
 * @param items 附件列表
 * @param selectedItems 选中的项目ID列表
 * @returns 文件夹ID列表（包括选中文件夹及其所有子文件夹）
 */
export function collectSelectedFolderIds(
	items: AttachmentItem[],
	selectedItems: string[],
): string[] {
	const folderIds: string[] = []

	const collectRecursive = (items: AttachmentItem[]) => {
		items.forEach((item) => {
			const itemId = getItemId(item)
			if (selectedItems.includes(itemId) && item.is_directory && item.file_id) {
				folderIds.push(item.file_id)
				// 也收集该文件夹下的所有子文件夹
				if (item.children) {
					collectAllSubFolderIds(item.children, folderIds)
				}
			} else if (item.children) {
				collectRecursive(item.children)
			}
		})
	}

	collectRecursive(items)
	return folderIds
}

/**
 * 递归查找指定 ID 的 AttachmentItem
 */
function findItemById(id: string, attachments: AttachmentItem[]): AttachmentItem | null {
	for (const item of attachments) {
		if (getItemId(item) === id) return item
		if (item.children) {
			const found = findItemById(id, item.children)
			if (found) return found
		}
	}
	return null
}

/**
 * 根据文件ID获取其父目录路径
 * @param fileId 文件ID
 * @param attachments 附件列表
 * @returns 父目录路径数组（AttachmentItem[]），如果文件在根目录则返回空数组
 */
export function getParentPathFromFileId(
	fileId: string,
	attachments: AttachmentItem[],
): AttachmentItem[] {
	const item = findItemById(fileId, attachments)
	if (!item) return []

	// 如果文件有 relative_file_path，使用它来构建路径
	if (item.relative_file_path) {
		const pathParts = item.relative_file_path.split("/").filter(Boolean)
		if (pathParts.length === 0) return []

		// 移除最后一个部分（文件/文件夹名本身）
		const parentPathParts = pathParts.slice(0, -1)
		if (parentPathParts.length === 0) return []

		// 根据路径部分逐级查找对应的 AttachmentItem
		const result: AttachmentItem[] = []
		let currentLevel = attachments

		for (const partName of parentPathParts) {
			const found = currentLevel.find(
				(item) =>
					item.is_directory &&
					(getItemName(item) === partName ||
						item.file_name === partName ||
						item.filename === partName ||
						item.display_filename === partName),
			)

			if (found) {
				result.push(found)
				currentLevel = found.children || []
			} else {
				// 如果找不到对应的路径，返回已找到的部分
				break
			}
		}

		return result
	}

	// 如果没有 relative_file_path，尝试通过 parent_id 查找
	if (item.parent_id) {
		const parentItem = findItemById(item.parent_id, attachments)
		if (parentItem && parentItem.is_directory) {
			// 递归查找父目录的路径
			const parentPath = getParentPathFromFileId(item.parent_id, attachments)
			return [...parentPath, parentItem]
		}
	}

	return []
}
