import { useState, useCallback, useMemo, useRef, useLayoutEffect } from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { cn } from "../../../../runtime/shared/lib/utils"
import styles from "./index.module.css"
import TreeNodeItem from "./TreeNodeItem"
import type { TreeProps, TreeNode, TreeData } from "./types"

export type { TreeNode, TreeProps, TreeData, RenderNodeContext, TreeSelectionMode } from "./types"

const DEFAULT_VIRTUAL_THRESHOLD = 80
const DEFAULT_VIRTUAL_ROW_HEIGHT = 34
const DEFAULT_VIRTUAL_OVERSCAN = 8

interface VisibleTreeRow<T extends TreeData = TreeData> {
	node: TreeNode<T>
	level: number
}

function flattenVisibleTreeRows<T extends TreeData>(
	nodes: TreeNode<T>[],
	expandedIds: Set<string>,
	level = 0,
	rows: VisibleTreeRow<T>[] = [],
) {
	nodes.forEach((node) => {
		rows.push({ node, level })
		if (node.children?.length && expandedIds.has(node.id)) {
			flattenVisibleTreeRows(node.children, expandedIds, level + 1, rows)
		}
	})
	return rows
}

export default function Tree<T extends TreeData = TreeData>(props: TreeProps<T>) {
	const {
		data,
		selectedIds,
		hoveredIds,
		selectionMode = "replace",
		onSelect,
		expandedIds: externalExpandedIds,
		onToggle: externalOnToggle,
		className,
		treeNodeContentClassName,
		virtualize = false,
		virtualThreshold = DEFAULT_VIRTUAL_THRESHOLD,
		virtualRowHeight = DEFAULT_VIRTUAL_ROW_HEIGHT,
		virtualOverscan = DEFAULT_VIRTUAL_OVERSCAN,
		initialScrollTop,
		onScrollTopChange,
		renderLeading,
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
	const scrollRef = useRef<HTMLDivElement>(null)

	const visibleRows = useMemo(
		() => flattenVisibleTreeRows(data, expandedIds),
		[data, expandedIds],
	)
	const shouldVirtualize = virtualize && visibleRows.length > virtualThreshold
	const rowVirtualizer = useVirtualizer({
		count: visibleRows.length,
		getScrollElement: () => scrollRef.current,
		estimateSize: () => virtualRowHeight,
		overscan: virtualOverscan,
		initialOffset: initialScrollTop ?? 0,
		getItemKey: (index) => visibleRows[index]?.node.id ?? index,
		measureElement: (element) => element.getBoundingClientRect().height,
	})
	const hasRestoredScrollTopRef = useRef(false)

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

			if (isMultiSelect || selectionMode === "toggle") {
				// Cmd/Ctrl 多选，或显式 toggle 模式：切换成员而不重置整组选区
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
		[selectedIds, onSelect, nodeMap, selectionMode],
	)

	const handleScroll = useCallback(
		(event: React.UIEvent<HTMLDivElement>) => {
			onScrollTopChange?.(event.currentTarget.scrollTop)
		},
		[onScrollTopChange],
	)

	useLayoutEffect(() => {
		if (hasRestoredScrollTopRef.current || initialScrollTop === undefined) {
			return
		}

		hasRestoredScrollTopRef.current = true
		const frameId = requestAnimationFrame(() => {
			if (shouldVirtualize) {
				rowVirtualizer.scrollToOffset(initialScrollTop)
			} else if (scrollRef.current) {
				scrollRef.current.scrollTop = initialScrollTop
			}
		})

		return () => cancelAnimationFrame(frameId)
	}, [initialScrollTop, rowVirtualizer, shouldVirtualize])

	const renderTreeNodeItem = (node: TreeNode<T>, level: number, renderChildren = true) => (
		<TreeNodeItem
			key={node.id}
			node={node}
			level={level}
			selectedIds={selectedIds}
			hoveredIds={hoveredIds}
			expandedIds={expandedIds}
			treeNodeContentClassName={treeNodeContentClassName}
			renderChildren={renderChildren}
			onToggle={handleToggle}
			onSelect={handleSelect}
			renderLeading={renderLeading}
			renderNode={renderNode}
			onContextMenu={onContextMenu}
			onDoubleClick={onDoubleClick}
			onMouseEnter={onMouseEnter}
			onMouseLeave={onMouseLeave}
		/>
	)

	return (
		<div ref={scrollRef} className={cn(styles.tree, className)} onScroll={handleScroll}>
			{shouldVirtualize ? (
				<div
					style={{
						height: `${rowVirtualizer.getTotalSize()}px`,
						position: "relative",
						width: "100%",
					}}
				>
					{rowVirtualizer.getVirtualItems().map((virtualItem) => {
						const row = visibleRows[virtualItem.index]
						if (!row) return null

						return (
							<div
								key={virtualItem.key}
								data-index={virtualItem.index}
								ref={rowVirtualizer.measureElement}
								style={{
									position: "absolute",
									top: 0,
									left: 0,
									width: "100%",
									transform: `translateY(${virtualItem.start}px)`,
								}}
							>
								{renderTreeNodeItem(row.node, row.level, false)}
							</div>
						)
					})}
				</div>
			) : (
				data.map((node) => renderTreeNodeItem(node, 0))
			)}
		</div>
	)
}
