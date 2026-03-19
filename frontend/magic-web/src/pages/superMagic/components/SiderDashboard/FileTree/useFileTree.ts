import { useState, useCallback, useMemo, useRef } from "react"
import type { TreeNode, FileTreeProps, TreeState } from "./types"

/**
 * useFileTree - FileTree 组件的主要逻辑 Hook
 *
 * @param props - FileTree 组件属性
 * @returns 组件状态和处理函数
 */
export function useFileTree<T extends TreeNode = TreeNode>(props: FileTreeProps<T>) {
	const {
		data,
		checkable = false,
		checkedKeys: controlledCheckedKeys,
		onCheck,
		expandedKeys: controlledExpandedKeys,
		defaultExpandedKeys = [],
		onExpand,
		searchValue,
		filterTreeNode,
	} = props

	// 内部状态
	const [internalState, setInternalState] = useState<TreeState>(() => ({
		expandedKeys: new Set(controlledExpandedKeys || defaultExpandedKeys),
		checkedKeys: new Set(controlledCheckedKeys || []),
	}))

	// 节点引用 - 简化为空对象，因为不再需要重命名功能
	const nodeRefs = useRef<Record<string, any>>({})

	// 当前状态（优先使用受控值）
	const currentState = useMemo(
		() => ({
			expandedKeys: controlledExpandedKeys
				? new Set(controlledExpandedKeys)
				: internalState.expandedKeys,
			checkedKeys: controlledCheckedKeys
				? new Set(controlledCheckedKeys)
				: internalState.checkedKeys,
		}),
		[controlledExpandedKeys, controlledCheckedKeys, internalState],
	)

	// 递归获取所有节点
	const getAllNodes = useCallback((nodes: T[]): T[] => {
		const result: T[] = []

		const traverse = (nodeList: T[]) => {
			nodeList.forEach((node) => {
				result.push(node)
				if (node.children) {
					traverse(node.children as T[])
				}
			})
		}

		traverse(nodes)
		return result
	}, [])

	// 获取所有可见节点（经过搜索过滤）
	const filteredData = useMemo(() => {
		if (!searchValue?.trim() || !filterTreeNode) return data

		const filterNodes = (nodes: T[]): T[] => {
			return nodes.reduce<T[]>((acc, node) => {
				const matchesSearch = filterTreeNode(node, searchValue)
				const filteredChildren = node.children
					? filterNodes(node.children as T[])
					: undefined

				if (matchesSearch || (filteredChildren && filteredChildren.length > 0)) {
					acc.push({
						...node,
						children: filteredChildren,
					} as T)
				}

				return acc
			}, [])
		}

		return filterNodes(data)
	}, [data, searchValue, filterTreeNode])

	// 获取所有可见节点
	const allVisibleNodes = useMemo(() => getAllNodes(filteredData), [filteredData, getAllNodes])

	// 获取节点的所有子节点 ID
	const getChildrenIds = useCallback((node: T): string[] => {
		if (!node.children) return []

		const childIds: string[] = []
		const traverse = (children: TreeNode[]) => {
			children.forEach((child) => {
				childIds.push(child.id)
				if (child.children) {
					traverse(child.children)
				}
			})
		}

		traverse(node.children)
		return childIds
	}, [])

	// 获取节点的父节点 ID
	const getParentId = useCallback(
		(targetId: string, nodes: T[] = data): string | null => {
			for (const node of nodes) {
				if (node.children) {
					// 检查是否是直接子节点
					if (node.children.some((child) => child.id === targetId)) {
						return node.id
					}
					// 递归查找
					const parentId = getParentId(targetId, node.children as T[])
					if (parentId) return parentId
				}
			}
			return null
		},
		[data],
	)

	// 检查节点是否被选中
	const isNodeChecked = useCallback(
		(nodeId: string) => {
			return currentState.checkedKeys.has(nodeId)
		},
		[currentState.checkedKeys],
	)

	// 检查节点的所有子节点是否都被选中
	const areAllChildrenChecked = useCallback(
		(node: T) => {
			if (!node.children) return false

			const childIds = getChildrenIds(node)
			return (
				childIds.length > 0 &&
				childIds.every((childId) => currentState.checkedKeys.has(childId))
			)
		},
		[currentState.checkedKeys, getChildrenIds],
	)

	// 检查节点是否处于半选状态
	const isNodeIndeterminate = useCallback(
		(node: T) => {
			if (!node.children) return false

			const childIds = getChildrenIds(node)
			const checkedChildIds = childIds.filter((childId) =>
				currentState.checkedKeys.has(childId),
			)

			return checkedChildIds.length > 0 && checkedChildIds.length < childIds.length
		},
		[currentState.checkedKeys, getChildrenIds],
	)

	// 更新内部状态
	const updateInternalState = useCallback((updater: (prev: TreeState) => TreeState) => {
		setInternalState(updater)
	}, [])

	// 展开/收起节点
	const handleExpand = useCallback(
		(nodeId: string, expanded: boolean) => {
			const newExpandedKeys = new Set(currentState.expandedKeys)

			if (expanded) {
				newExpandedKeys.add(nodeId)
			} else {
				newExpandedKeys.delete(nodeId)
			}

			// 更新内部状态
			if (!controlledExpandedKeys) {
				updateInternalState((prev) => ({
					...prev,
					expandedKeys: newExpandedKeys,
				}))
			}

			// 触发回调
			if (onExpand) {
				const expandedNodes = allVisibleNodes.filter((node) => newExpandedKeys.has(node.id))
				onExpand(Array.from(newExpandedKeys), expandedNodes)
			}
		},
		[
			currentState.expandedKeys,
			controlledExpandedKeys,
			updateInternalState,
			onExpand,
			allVisibleNodes,
		],
	)

	// 递归更新父节点选中状态的辅助函数
	const updateParentCheckStatus = useCallback(
		(nodeId: string, newCheckedKeys: Set<string>) => {
			const parentId = getParentId(nodeId)
			if (!parentId) return

			const parentNode = allVisibleNodes.find((n) => n.id === parentId)
			if (!parentNode || !parentNode.children) return

			const parentChildIds = getChildrenIds(parentNode)
			const allChildrenChecked = parentChildIds.every((childId) =>
				newCheckedKeys.has(childId),
			)

			if (allChildrenChecked) {
				// 如果所有子节点都被选中，选中父节点
				newCheckedKeys.add(parentId)
				// 递归检查更上层的父节点
				updateParentCheckStatus(parentId, newCheckedKeys)
			} else {
				// 如果不是所有子节点都被选中，取消选中父节点
				if (newCheckedKeys.has(parentId)) {
					newCheckedKeys.delete(parentId)
					// 递归取消选中更上层的父节点
					updateParentCheckStatus(parentId, newCheckedKeys)
				}
			}
		},
		[getParentId, allVisibleNodes, getChildrenIds],
	)

	// 勾选/取消勾选节点
	const handleCheck = useCallback(
		(nodeId: string, checked: boolean) => {
			if (!checkable) return

			const node = allVisibleNodes.find((n) => n.id === nodeId)
			if (!node) return

			const newCheckedKeys = new Set(currentState.checkedKeys)

			if (checked) {
				// 选中当前节点
				newCheckedKeys.add(nodeId)

				// 如果有子节点，选中所有子节点
				const childIds = getChildrenIds(node)
				childIds.forEach((childId) => newCheckedKeys.add(childId))

				// 递归检查并更新父节点状态
				updateParentCheckStatus(nodeId, newCheckedKeys)
			} else {
				// 取消选中当前节点
				newCheckedKeys.delete(nodeId)

				// 如果有子节点，取消选中所有子节点
				const childIds = getChildrenIds(node)
				childIds.forEach((childId) => newCheckedKeys.delete(childId))

				// 递归检查并更新父节点状态
				updateParentCheckStatus(nodeId, newCheckedKeys)
			}

			// 更新内部状态
			if (!controlledCheckedKeys) {
				updateInternalState((prev) => ({
					...prev,
					checkedKeys: newCheckedKeys,
				}))
			}

			// 触发回调
			if (onCheck) {
				const checkedNodes = allVisibleNodes.filter((node) => newCheckedKeys.has(node.id))
				onCheck(Array.from(newCheckedKeys), checkedNodes)
			}
		},
		[
			checkable,
			currentState.checkedKeys,
			controlledCheckedKeys,
			updateInternalState,
			onCheck,
			allVisibleNodes,
			getChildrenIds,
			updateParentCheckStatus,
		],
	)

	return {
		// 状态
		state: currentState,
		filteredData,
		allVisibleNodes,
		nodeRefs,

		// 检查函数
		isNodeChecked,
		areAllChildrenChecked,
		isNodeIndeterminate,
		isNodeExpanded: (nodeId: string) => currentState.expandedKeys.has(nodeId),

		// 处理函数
		handleExpand,
		handleCheck,

		// 工具函数
		getAllNodes,
		getChildrenIds,
		getParentId,
	}
}
