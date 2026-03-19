import type { AttachmentItem } from "../hooks/types"

/**
 * 递归收集文件夹下的所有文件ID
 * @param folder 文件夹
 * @returns 文件夹及其所有子文件的ID数组
 */
export function collectFolderFiles(folder: AttachmentItem): string[] {
	const fileIds: string[] = []

	// 添加文件夹自己的ID
	if (folder.file_id) {
		fileIds.push(folder.file_id)
	}

	// 递归收集所有子文件
	const collectChildren = (items: AttachmentItem[]) => {
		items.forEach((item) => {
			if (item.file_id) {
				fileIds.push(item.file_id)
			}
			if (item.is_directory && item.children) {
				collectChildren(item.children)
			}
		})
	}

	if (folder.children) {
		collectChildren(folder.children)
	}

	return fileIds
}

/**
 * 查找文件的父文件夹
 * @param allFiles 所有文件列表
 * @param fileId 文件ID
 * @returns 父文件夹或null
 */
export function findParentFolder(
	allFiles: AttachmentItem[],
	fileId: string,
): AttachmentItem | null {
	const findParent = (items: AttachmentItem[], targetId: string): AttachmentItem | null => {
		for (const item of items) {
			if (item.is_directory && item.children) {
				// 检查当前文件夹的直接子项
				const hasChild = item.children.some((child) => child.file_id === targetId)
				if (hasChild) {
					return item
				}
				// 递归查找子文件夹
				const found = findParent(item.children, targetId)
				if (found) {
					return found
				}
			}
		}
		return null
	}

	return findParent(allFiles, fileId)
}

/**
 * 检查文件是否是特殊文件夹的入口文件
 * 条件：文件名为 index.html 且 metadata.type 不为空，且不是目录
 * @param file 文件项
 * @returns 是否是入口文件
 */
export function isAppEntryFile(file: AttachmentItem): boolean {
	// 必须不是目录
	if (file.is_directory) {
		return false
	}

	// 必须是 index.html
	const isIndexHtml = file.name === "index.html" || file.file_name === "index.html"
	if (!isIndexHtml) {
		return false
	}

	// 必须有 metadata.type 且不为空
	if (!file.metadata || typeof file.metadata !== "object") {
		return false
	}

	if (!("type" in file.metadata) || !file.metadata.type) {
		return false
	}

	return true
}
