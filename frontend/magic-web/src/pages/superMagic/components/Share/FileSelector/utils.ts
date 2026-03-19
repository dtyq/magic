/**
 * 工具函数：文件选择器相关的工具函数
 */

/**
 * 递归查找文件树中的文件
 */
export function findFileInTree(
	files: Record<string, unknown>[],
	targetId: string,
): Record<string, unknown> | null {
	for (const file of files) {
		const fileId = (file.file_id as string) || (file.id as string)
		if (fileId === targetId) {
			return file
		}
		// Recursively search in children
		if (file.children && Array.isArray(file.children) && file.children.length > 0) {
			const found = findFileInTree(file.children, targetId)
			if (found) return found
		}
	}
	return null
}

/**
 * 判断文件是否可以设置为默认打开
 * @param item 文件项
 * @returns 是否可以设置为默认打开
 */
export function canSetAsDefault(item: Record<string, any>): boolean {
	// 普通文件夹不支持
	if (item.is_directory && !item?.metadata?.type) {
		return false
	}
	// 携带 metadata 的文件夹和普通文件都支持
	return true
}

/**
 * 获取文件ID
 */
function getFileId(file: Record<string, unknown>): string | null {
	return (file.file_id as string) || (file.id as string) || null
}

/**
 * 查找文件夹中第一个可以设置为默认打开的文件
 * 对于普通文件夹：优先匹配第一级的 index.html（只找第一层），否则递归查找第一个文件
 * 对于携带metadata的文件夹：返回文件夹本身
 * @param folder 文件夹项
 * @returns 第一个可设置为默认打开的文件ID，如果没有找到则返回 null
 */
export function findFirstDefaultOpenFileInFolder(folder: Record<string, unknown>): string | null {
	// 如果文件夹本身携带metadata，优先返回文件夹ID
	if (folder.is_directory && folder.metadata) {
		return getFileId(folder)
	}

	// 对于普通文件夹，先检查第一级是否有 index.html
	if (folder.children && Array.isArray(folder.children) && folder.children.length > 0) {
		// 第一遍：优先查找第一级的 index.html（只找第一层）
		for (const child of folder.children) {
			// 只查找第一级的文件，跳过文件夹
			if (child.is_directory) {
				continue
			}
			// 检查是否是 index.html
			const fileName = (child.name as string) || (child.file_name as string) || ""
			if (fileName === "index.html") {
				return getFileId(child)
			}
		}

		// 第二遍：如果没有找到第一级的 index.html，递归查找第一个文件
		for (const child of folder.children) {
			// 如果是普通文件夹，递归查找
			if (child.is_directory && !child.metadata) {
				const found = findFirstDefaultOpenFileInFolder(child)
				if (found) return found
				continue
			}
			// 如果是携带metadata的文件夹，返回其ID
			if (child.is_directory && child.metadata) {
				return getFileId(child)
			}
			// 如果是文件，返回其ID
			if (!child.is_directory) {
				return getFileId(child)
			}
		}
	}

	return null
}

/**
 * 扁平化附件树结构
 */
export function flattenAttachments(items: any[]): any[] {
	const result: any[] = []
	for (const item of items) {
		result.push(item)
		if (item.children && Array.isArray(item.children)) {
			result.push(...flattenAttachments(item.children))
		}
	}
	return result
}

/**
 * 从选中的文件列表中计算默认打开文件ID
 * @param fileIds 选中的文件ID列表
 * @param attachments 附件树结构
 * @returns 应该设置的默认打开文件ID，如果没有找到则返回 null
 */
export function calculateDefaultOpenFileId(fileIds: string[], attachments: any[]): string | null {
	if (fileIds.length === 0) return null

	const allFiles = flattenAttachments(attachments)

	// Find first file that can be set as default
	for (const fileId of fileIds) {
		const file = allFiles.find((f) => {
			const fId = f.file_id || f.id
			return fId === fileId
		})
		if (!file || file.is_hidden) continue

		// 如果是普通文件夹，跳过
		if (file.is_directory && !file?.metadata?.type) {
			// 如果是文件夹，查找其第一个可设置为默认打开的子级文件
			const found = findFirstDefaultOpenFileInFolder(file)
			if (found) return found
			continue
		}

		// 携带metadata的文件夹或普通文件都可以
		return fileId
	}

	return null
}

/**
 * 判断文件是否为选中文件夹的子级
 * @param fileId 文件ID
 * @param selectedFileIds 选中的文件ID列表
 * @param attachments 附件树结构
 * @returns 是否为选中文件夹的子级
 */
export function isFileDescendantOfSelectedFolders(
	fileId: string,
	selectedFileIds: string[],
	attachments: any[],
): boolean {
	const allFiles = flattenAttachments(attachments)
	const targetFile = allFiles.find((f) => {
		const fId = f.file_id || f.id
		return fId === fileId
	})
	if (!targetFile) return false

	// Check if any parent folder is selected
	const checkParent = (file: any, selectedIds: string[]): boolean => {
		if (!file.parent_id) return false
		const parentId = file.parent_id
		if (selectedIds.includes(parentId)) return true

		const parent = allFiles.find((f) => {
			const fId = f.file_id || f.id
			return fId === parentId
		})
		if (!parent) return false

		return checkParent(parent, selectedIds)
	}

	return checkParent(targetFile, selectedFileIds)
}

/**
 * 检查选中的文件列表中是否至少有一个文件或携带metadata的文件夹
 * @param fileIds 选中的文件ID列表
 * @param attachments 附件树结构
 * @returns 是否至少有一个有效文件（文件或携带metadata的文件夹）
 */
export function hasValidFileForShare(fileIds: string[], attachments: any[]): boolean {
	if (fileIds.length === 0) return false

	const allFiles = flattenAttachments(attachments)

	// 检查是否有至少一个文件或携带metadata的文件夹
	for (const fileId of fileIds) {
		const file = allFiles.find((f) => {
			const fId = f.file_id || f.id
			return fId === fileId
		})
		if (!file) continue

		// 如果是普通文件夹，检查其子级是否有有效文件
		if (file.is_directory && !file?.metadata?.type) {
			const found = findFirstDefaultOpenFileInFolder(file)
			console.log("found", found)
			if (found) return true
			continue
		}

		// 携带metadata的文件夹或普通文件都算有效
		return true
	}

	return false
}

/**
 * 获取节点的所有子级ID（递归）
 * @param node 节点对象
 * @returns 所有子级ID数组
 */
export function getAllDescendantIds(node: Record<string, unknown>): string[] {
	const ids: string[] = []
	if (!node.children || !Array.isArray(node.children)) {
		return ids
	}

	for (const child of node.children) {
		const childId = getFileId(child)
		if (childId) {
			ids.push(childId)
		}
		// 递归获取子级的子级
		if (child.children && Array.isArray(child.children) && child.children.length > 0) {
			ids.push(...getAllDescendantIds(child))
		}
	}

	return ids
}

/**
 * 获取节点的所有子级文件/文件夹对象（递归）
 * @param node 节点对象
 * @returns 所有子级对象数组
 */
export function getAllDescendantFiles(node: Record<string, unknown>): Record<string, unknown>[] {
	const files: Record<string, unknown>[] = []
	if (!node.children || !Array.isArray(node.children)) {
		return files
	}

	for (const child of node.children) {
		files.push(child)
		// 递归获取子级的子级
		if (child.children && Array.isArray(child.children) && child.children.length > 0) {
			files.push(...getAllDescendantFiles(child))
		}
	}

	return files
}

/**
 * 查找节点的父级ID
 * @param nodeId 节点ID
 * @param attachments 附件树结构
 * @returns 父级ID，如果没有父级则返回 null
 */
export function getParentId(nodeId: string, attachments: any[]): string | null {
	const allFiles = flattenAttachments(attachments)
	const targetFile = allFiles.find((f) => {
		const fId = f.file_id || f.id
		return fId === nodeId
	})
	if (!targetFile) return null
	return targetFile.parent_id || null
}

/**
 * 获取所有兄弟节点ID（不包括自己）
 * @param nodeId 节点ID
 * @param attachments 附件树结构
 * @returns 兄弟节点ID数组
 */
export function getSiblingIds(nodeId: string, attachments: any[]): string[] {
	const parentId = getParentId(nodeId, attachments)
	if (!parentId) {
		// 如果没有父级，说明在根级别，查找根级别的所有其他节点
		return attachments
			.filter((item) => {
				const itemId = getFileId(item)
				return itemId !== nodeId
			})
			.map((item) => getFileId(item))
			.filter(Boolean) as string[]
	}

	// 找到父级节点
	const parentNode = findFileInTree(attachments, parentId)
	if (!parentNode || !parentNode.children || !Array.isArray(parentNode.children)) {
		return []
	}

	// 返回除了自己之外的所有兄弟节点ID
	return (parentNode.children as Record<string, unknown>[])
		.filter((child) => {
			const childId = getFileId(child)
			return childId !== nodeId
		})
		.map((child) => getFileId(child))
		.filter(Boolean) as string[]
}

/**
 * 判断节点是否被选中（直接选中或因父级选中而间接选中）
 * @param nodeId 节点ID
 * @param selectedIds 选中的ID列表
 * @param attachments 附件树结构
 * @returns 是否被选中
 */
export function isNodeSelected(nodeId: string, selectedIds: string[], attachments: any[]): boolean {
	// 直接选中
	if (selectedIds.includes(nodeId)) {
		return true
	}

	// 检查是否有父级被选中
	let currentId: string | null = nodeId
	while (currentId) {
		const parentId = getParentId(currentId, attachments)
		if (!parentId) break
		if (selectedIds.includes(parentId)) {
			return true
		}
		currentId = parentId
	}

	return false
}

/**
 * 计算节点的选中状态
 * @param nodeId 节点ID
 * @param selectedIds 选中的ID列表
 * @param attachments 附件树结构
 * @returns 'checked' | 'unchecked' | 'indeterminate'
 */
export function getNodeCheckState(
	nodeId: string,
	selectedIds: string[],
	attachments: any[],
): "checked" | "unchecked" | "indeterminate" {
	const node = findFileInTree(attachments, nodeId)
	if (!node) return "unchecked"

	// 如果节点不是文件夹（是文件），判断是否被选中
	if (!node.is_directory) {
		// 检查是否直接选中或因父级选中而间接选中
		return isNodeSelected(nodeId, selectedIds, attachments) ? "checked" : "unchecked"
	}

	// 节点是文件夹，需要检查子级的选中状态
	if (!node.children || !Array.isArray(node.children) || node.children.length === 0) {
		// 空文件夹，只检查自己是否被选中
		return selectedIds.includes(nodeId) ? "checked" : "unchecked"
	}

	// 获取所有子级ID
	const descendantIds = getAllDescendantIds(node)
	if (descendantIds.length === 0) {
		// 没有子级，只检查自己
		return selectedIds.includes(nodeId) ? "checked" : "unchecked"
	}

	// 检查有多少子级被选中
	const selectedDescendants = descendantIds.filter((id) =>
		isNodeSelected(id, selectedIds, attachments),
	)

	if (selectedDescendants.length === 0) {
		// 没有任何子级被选中
		return "unchecked"
	} else if (selectedDescendants.length === descendantIds.length) {
		// 所有子级都被选中
		return "checked"
	} else {
		// 部分子级被选中
		return "indeterminate"
	}
}

/**
 * 递归计算实际文件数量（从 selectedFiles 中统计所有实际文件并去重）
 *
 * 注意：
 * 1. 如果同时选中了父文件夹和其子文件，需要去重避免重复计数
 * 2. 只统计实际文件，不统计文件夹
 * 3. 使用 Set 确保文件 ID 不会重复
 *
 * @param selectedFiles 选中的文件/文件夹列表
 * @returns 实际文件数量（不包括文件夹，已去重）
 */
export function calculateActualFileCount(selectedFiles: any[]): number {
	const processedIds = new Set<string>()

	function collectFileIds(file: any) {
		if (!file) return

		const fileId = file.file_id || file.id
		// 跳过无效 ID 和已处理的文件（去重关键逻辑）
		if (!fileId || processedIds.has(fileId)) return

		if (!file.is_directory) {
			// 如果是文件，添加到集合（Set 自动去重）
			processedIds.add(fileId)
			return
		}

		// 如果是文件夹，递归处理子文件
		if (file.children && Array.isArray(file.children)) {
			file.children.forEach(collectFileIds)
		}
	}

	// 遍历所有选中项，递归收集文件 ID
	selectedFiles.forEach(collectFileIds)

	// 返回去重后的文件数量
	return processedIds.size
}
