/**
 * 文件选择工具函数
 * 用于处理文件树的选择、查找和状态计算
 */

/**
 * 获取文件ID
 */
function getFileId(file: Record<string, unknown>): string | null {
	return (file.file_id as string) || (file.id as string) || null
}

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
