import { useMemo } from "react"
import { convertToTreeData, type TreeNodeData } from "../utils/treeDataConverter"
import type { AttachmentItem } from "./types"

interface UseTreeDataOptions {
	mergedFiles: AttachmentItem[]
	renamingItemId?: string | null
}

/**
 * useTreeData - 管理树形数据的转换和相关计算
 */
export function useTreeData(options: UseTreeDataOptions) {
	const { mergedFiles, renamingItemId } = options

	// 转换为 Tree 数据
	const treeData = useMemo(() => {
		return convertToTreeData(mergedFiles, 0, renamingItemId)
	}, [mergedFiles, renamingItemId])

	// 递归获取所有文件ID（包括子文件）
	const getAllFileIds = useMemo(() => {
		return (treeNodes: TreeNodeData[]): string[] => {
			const fileIds: string[] = []

			function traverse(nodes: TreeNodeData[]) {
				for (const node of nodes) {
					// 添加当前节点的ID
					fileIds.push(node.key)

					// 如果有子节点，递归遍历
					if (node.children && node.children.length > 0) {
						traverse(node.children)
					}
				}
			}

			traverse(treeNodes)
			return fileIds
		}
	}, [])

	// 递归计算总文件数量
	const getTotalCount = useMemo(() => {
		return (treeNodes: TreeNodeData[]): number => {
			let count = 0

			function traverse(nodes: TreeNodeData[]) {
				for (const node of nodes) {
					count++

					// 如果有子节点，递归遍历
					if (node.children && node.children.length > 0) {
						traverse(node.children)
					}
				}
			}

			traverse(treeNodes)
			return count
		}
	}, [])

	return {
		// 数据
		treeData,

		// 工具函数
		getAllFileIds,
		getTotalCount,
	}
}
