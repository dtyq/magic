import { useState, useCallback, useMemo } from "react"
import classNames from "classnames"
import styles from "./index.module.css"
import TreeNodeItem from "./TreeNodeItem"
import type { TreeProps, TreeNode, TreeData } from "./types"

export type { TreeNode, TreeProps, TreeData, RenderNodeContext } from "./types"

export default function Tree<T extends TreeData = TreeData>(props: TreeProps<T>) {
	const {
		data,
		selectedIds,
		hoveredIds,
		onSelect,
		expandedIds: externalExpandedIds,
		onToggle: externalOnToggle,
		className,
		treeNodeContentClassName,
		renderNode,
		onContextMenu,
		onDoubleClick,
		onMouseEnter,
		onMouseLeave,
	} = props

	// 内部状态作为后备
	const [internalExpandedIds, setInternalExpandedIds] = useState<Set<string>>(new Set())

	// 使用外部状态或内部状态
	const expandedIds = externalExpandedIds ?? internalExpandedIds

	// 创建节点映射表，用于快速查找
	const nodeMap = useMemo(() => {
		const map = new Map<string, TreeNode<T>>()
		const traverse = (nodes: TreeNode<T>[]) => {
			nodes.forEach((node) => {
				map.set(node.id, node)
				if (node.children) {
					traverse(node.children)
				}
			})
		}
		traverse(data)
		return map
	}, [data])

	const handleToggle = useCallback(
		(id: string) => {
			if (externalOnToggle) {
				// 使用外部的 toggle 处理函数
				externalOnToggle(id)
			} else {
				// 使用内部状态
				setInternalExpandedIds((prev) => {
					const next = new Set(prev)
					if (next.has(id)) {
						next.delete(id)
					} else {
						next.add(id)
					}
					return next
				})
			}
		},
		[externalOnToggle],
	)

	const handleSelect = useCallback(
		(node: TreeNode<T>, isMultiSelect: boolean) => {
			if (!onSelect) return

			const currentSelectedIds = selectedIds || []

			if (isMultiSelect) {
				// Cmd/Ctrl 多选：可以切换选中状态
				const newSelectedIds = currentSelectedIds.includes(node.id)
					? currentSelectedIds.filter((id) => id !== node.id)
					: [...currentSelectedIds, node.id]

				const selectedNodes = newSelectedIds
					.map((id) => nodeMap.get(id))
					.filter(Boolean) as TreeNode<T>[]
				onSelect(selectedNodes, newSelectedIds)
			} else {
				// 单选：只选中，不取消选中
				const selectedNodes = [node]
				onSelect(selectedNodes, [node.id])
			}
		},
		[selectedIds, onSelect, nodeMap],
	)

	return (
		<div className={classNames(styles.tree, className)}>
			{data.map((node) => (
				<TreeNodeItem
					key={node.id}
					node={node}
					level={0}
					selectedIds={selectedIds}
					hoveredIds={hoveredIds}
					expandedIds={expandedIds}
					treeNodeContentClassName={treeNodeContentClassName}
					onToggle={handleToggle}
					onSelect={handleSelect}
					renderNode={renderNode}
					onContextMenu={onContextMenu}
					onDoubleClick={onDoubleClick}
					onMouseEnter={onMouseEnter}
					onMouseLeave={onMouseLeave}
				/>
			))}
		</div>
	)
}
