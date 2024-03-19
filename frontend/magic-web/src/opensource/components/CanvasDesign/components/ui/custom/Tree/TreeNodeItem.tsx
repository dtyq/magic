import { useCallback, useRef, useEffect } from "react"
import classNames from "classnames"
import { ChevronRight as ChevronRightIcon } from "../../icons/index"
import type { TreeNodeItemProps, TreeData } from "./types"
import IconButton from "../IconButton"
import { isMultiSelectEvent } from "../../../../canvas/interaction/shortcuts/modifierUtils"

import styles from "./index.module.css"

export default function TreeNodeItem<T extends TreeData = TreeData>(props: TreeNodeItemProps<T>) {
	const {
		node,
		level,
		selectedIds,
		hoveredIds,
		expandedIds,
		treeNodeContentClassName,
		onToggle,
		onSelect,
		renderNode,
		onContextMenu,
		onDoubleClick,
		onMouseEnter,
		onMouseLeave,
	} = props
	const hasChildren = node.children && node.children.length > 0
	const isExpanded = expandedIds.has(node.id)
	const isSelected = selectedIds?.includes(node.id) ?? false
	const isHovered = hoveredIds?.includes(node.id) ?? false

	const handleToggle = useCallback(
		(e: React.MouseEvent) => {
			e.stopPropagation()
			if (hasChildren) {
				onToggle(node.id)
			}
		},
		[hasChildren, node.id, onToggle],
	)

	const handleSelect = useCallback(
		(e: React.MouseEvent) => {
			e.stopPropagation()
			// 如果点击的是展开/收起箭头，不触发选中
			const target = e.target as HTMLElement
			if (target.closest(`.${styles.treeNodeToggle}`)) {
				return
			}
			const isMultiSelect = isMultiSelectEvent(e)
			onSelect?.(node, isMultiSelect)
		},
		[node, onSelect],
	)

	const handleContextMenu = useCallback(
		(e: React.MouseEvent) => {
			// 如果当前节点未被选中，先选中它
			if (!isSelected) {
				onSelect?.(node, false)
			}
			if (onContextMenu) {
				onContextMenu(e, node)
			}
		},
		[node, onContextMenu, isSelected, onSelect],
	)

	const handleDoubleClick = useCallback(
		(e: React.MouseEvent) => {
			e.stopPropagation()
			// 如果双击的是展开/收起箭头，不触发双击事件
			const target = e.target as HTMLElement
			if (target.closest(`.${styles.treeNodeToggle}`)) {
				return
			}
			if (onDoubleClick) {
				onDoubleClick(e, node)
			}
		},
		[node, onDoubleClick],
	)

	const handleMouseEnter = useCallback(
		(e: React.MouseEvent) => {
			if (onMouseEnter) {
				onMouseEnter(e, node)
			}
		},
		[node, onMouseEnter],
	)

	const handleMouseLeave = useCallback(
		(e: React.MouseEvent) => {
			if (onMouseLeave) {
				onMouseLeave(e, node)
			}
		},
		[node, onMouseLeave],
	)

	// 用于引用 tree-node-content 元素
	const treeNodeContentRef = useRef<HTMLDivElement>(null)

	// 监听带有 no-active 类的元素的 mouseDown 和 mouseUp 事件
	useEffect(() => {
		const treeNodeContent = treeNodeContentRef.current
		if (!treeNodeContent) return

		const handleNoActiveMouseDown = (e: MouseEvent) => {
			const target = e.target as HTMLElement
			// 检查点击的元素或其父元素是否有 no-active 类
			if (target.closest(`.${styles.noActive}`)) {
				treeNodeContent.classList.add(styles.disableActive)
			}
		}

		const handleNoActiveMouseUp = (e: MouseEvent) => {
			const target = e.target as HTMLElement
			// 检查点击的元素或其父元素是否有 no-active 类
			if (target.closest(`.${styles.noActive}`)) {
				treeNodeContent.classList.remove(styles.disableActive)
			}
		}

		// 添加事件监听器
		treeNodeContent.addEventListener("mousedown", handleNoActiveMouseDown)
		document.addEventListener("mouseup", handleNoActiveMouseUp)

		return () => {
			treeNodeContent.removeEventListener("mousedown", handleNoActiveMouseDown)
			document.removeEventListener("mouseup", handleNoActiveMouseUp)
		}
	}, [])

	return (
		<div className={styles.treeNodeItem}>
			<div
				ref={treeNodeContentRef}
				className={classNames(
					styles.treeNodeContent,
					isSelected && styles.treeNodeContentSelected,
					isHovered && !isSelected && styles.treeNodeContentHovered,
					treeNodeContentClassName,
				)}
				style={{ paddingLeft: `${level * 16 + 8}px` }}
				onClick={handleSelect}
				onContextMenu={handleContextMenu}
				onDoubleClick={handleDoubleClick}
				onMouseEnter={handleMouseEnter}
				onMouseLeave={handleMouseLeave}
			>
				{hasChildren && (
					<IconButton className={styles.treeNodeToggle} onClick={handleToggle}>
						<ChevronRightIcon
							size={16}
							className={classNames(
								styles.treeNodeToggleIcon,
								isExpanded && styles.treeNodeToggleExpanded,
							)}
						/>
					</IconButton>
				)}
				{!hasChildren && <span className={styles.treeNodeTogglePlaceholder} />}
				<span className={styles.treeNodeLabel}>
					{renderNode
						? renderNode(node, {
								noHoverClassName: styles.noHover,
								noActiveClassName: styles.noActive,
								showOnHoverClassName: styles.showOnHover,
								isExpanded,
								isSelected,
							})
						: node.label}
				</span>
			</div>
			{hasChildren && node.children && (
				<div
					className={classNames(
						styles.treeNodeChildren,
						isExpanded && styles.treeNodeChildrenExpanded,
					)}
				>
					<div className={styles.treeNodeChildrenInner}>
						{node.children.map((child) => (
							<TreeNodeItem
								key={child.id}
								node={child}
								level={level + 1}
								selectedIds={selectedIds}
								hoveredIds={hoveredIds}
								expandedIds={expandedIds}
								treeNodeContentClassName={treeNodeContentClassName}
								onToggle={onToggle}
								onSelect={onSelect}
								renderNode={renderNode}
								onContextMenu={onContextMenu}
								onDoubleClick={onDoubleClick}
								onMouseEnter={onMouseEnter}
								onMouseLeave={onMouseLeave}
							/>
						))}
					</div>
				</div>
			)}
		</div>
	)
}
