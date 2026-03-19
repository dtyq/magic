import type { AttachmentItem } from "../hooks/types"
import type { DataNode } from "antd/es/tree"

export interface TreeNodeData extends DataNode {
	key: string
	title: React.ReactNode
	children?: TreeNodeData[]
	isLeaf?: boolean
	item: AttachmentItem
	isVirtual?: boolean
	level: number
	disabled?: boolean // 添加disabled属性来控制拖拽
}

export function convertToTreeData(
	attachments: AttachmentItem[],
	level = 0,
	renamingItemId?: string | null,
): TreeNodeData[] {
	return attachments
		.filter((item) => !item?.is_hidden)
		.map((item) => {
			const key = item.file_id || item.relative_file_path || `item-${Math.random()}`

			const treeNode: TreeNodeData = {
				key,
				title: null, // 将在组件中通过 titleRender 自定义渲染
				item,
				isVirtual: (item as any)?.isVirtual,
				level,
				// 如果当前项目正在重命名，则禁用拖拽
				disabled: renamingItemId === key || (item as any)?.isVirtual,
			}

			// 如果是文件夹且有子项，递归转换
			if (item?.is_directory && item.children && item.children.length > 0) {
				treeNode.children = convertToTreeData(item.children, level + 1, renamingItemId)
				treeNode.isLeaf = false
			} else {
				treeNode.isLeaf = true
			}

			return treeNode
		})
}

export function findTreeNodeByKey(treeData: TreeNodeData[], key: string): TreeNodeData | null {
	for (const node of treeData) {
		if (node.key === key) {
			return node
		}
		if (node.children) {
			const found = findTreeNodeByKey(node.children, key)
			if (found) return found
		}
	}
	return null
}

export function getNodePath(treeData: TreeNodeData[], key: string): string[] {
	const path: string[] = []

	function search(nodes: TreeNodeData[], targetKey: string): boolean {
		for (const node of nodes) {
			path.push(node.key)
			if (node.key === targetKey) {
				return true
			}
			if (node.children) {
				if (search(node.children, targetKey)) {
					return true
				}
			}
			path.pop()
		}
		return false
	}

	search(treeData, key)
	return path
}

export function isDescendant(
	treeData: TreeNodeData[],
	ancestorKey: string,
	descendantKey: string,
): boolean {
	const descendantPath = getNodePath(treeData, descendantKey)
	return descendantPath.includes(ancestorKey)
}

export function isAncestor(
	treeData: TreeNodeData[],
	descendantKey: string,
	ancestorKey: string,
): boolean {
	return isDescendant(treeData, ancestorKey, descendantKey)
}
