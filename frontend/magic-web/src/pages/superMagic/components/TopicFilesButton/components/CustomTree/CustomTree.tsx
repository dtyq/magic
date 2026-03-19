import React, { memo } from "react"
import { cx } from "antd-style"
import type { TreeNodeData } from "../../utils/treeDataConverter"
import { useStyles } from "./style"

interface TreeNodeProps {
	node: TreeNodeData
	expandedKeys: React.Key[]
	selectedKeys: React.Key[]
	onExpand: (key: string, node: TreeNodeData) => void
	onSelect: (key: string, node: TreeNodeData) => void
	titleRender?: (node: TreeNodeData) => React.ReactNode
	showIcon?: boolean
	blockNode?: boolean
	className?: string
	dragTargetNodeClass?: string
	isDragTargetNode?: (node: TreeNodeData) => boolean
	// 拖拽事件处理器
	onDragEnter?: (e: React.DragEvent, node: TreeNodeData) => void
	onDragLeave?: (e: React.DragEvent, node: TreeNodeData) => void
	onDragOver?: (e: React.DragEvent, node: TreeNodeData) => void
	onDrop?: (e: React.DragEvent, node: TreeNodeData) => void
}

function TreeNode({
	node,
	expandedKeys,
	selectedKeys,
	onExpand,
	onSelect,
	titleRender,
	blockNode = false,
	className,
	dragTargetNodeClass,
	isDragTargetNode,
	onDragEnter,
	onDragLeave,
	onDragOver,
	onDrop,
}: TreeNodeProps) {
	const hasChildren = node.children && node.children.length > 0
	const expanded = expandedKeys.includes(node.key)
	const selected = selectedKeys.includes(node.key)
	const { styles } = useStyles()

	const handleSelect = () => {
		console.log("fileClick", node.key)
		onSelect(node.key, node)
	}

	// 判断是否为拖拽目标节点
	const isDragTarget = isDragTargetNode ? isDragTargetNode(node) : false

	// 判断是否为文件夹节点
	const isFolder = node.item?.is_directory
	// 判断是否为根目录的文件（level === 0 且不是文件夹）
	const isRootFile = node.level === 0 && !isFolder
	// 文件夹或根目录的文件都可以接收拖拽（拖拽到根目录文件等同于拖拽到根目录）
	const canReceiveDrag = isFolder || isRootFile

	// 拖拽事件处理器 - 文件夹或根目录的文件都有效
	const handleDragEnter = (e: React.DragEvent) => {
		if (canReceiveDrag && onDragEnter) {
			onDragEnter(e, node)
		}
	}

	const handleDragLeave = (e: React.DragEvent) => {
		if (canReceiveDrag && onDragLeave) {
			onDragLeave(e, node)
		}
	}

	const handleDragOver = (e: React.DragEvent) => {
		if (canReceiveDrag && onDragOver) {
			onDragOver(e, node)
		}
	}

	const handleDrop = (e: React.DragEvent) => {
		if (canReceiveDrag && onDrop) {
			onDrop(e, node)
		}
	}

	return (
		<div
			className={cx(styles.customTreeNode, {
				...(isDragTarget && dragTargetNodeClass ? { [dragTargetNodeClass]: true } : {}),
			})}
			// 文件夹或根目录的文件都添加拖拽事件处理器
			{...(canReceiveDrag && {
				onDragEnter: handleDragEnter,
				onDragLeave: handleDragLeave,
				onDragOver: handleDragOver,
				onDrop: handleDrop,
			})}
		>
			{/* 当前节点 */}
			<div
				className={cx("magic-tree-treenode", {
					"magic-tree-treenode-selected": selected,
				})}
				onClick={handleSelect}
			>
				<div className="magic-tree-node-content-wrapper">
					{titleRender ? titleRender(node) : node.title}
				</div>
			</div>

			{/* 子节点 */}
			{hasChildren && expanded && (
				<div className="magic-tree-child-tree">
					{node.children?.map((child) => (
						<TreeNode
							key={child.key}
							node={child}
							expandedKeys={expandedKeys}
							selectedKeys={selectedKeys}
							onExpand={onExpand}
							onSelect={onSelect}
							titleRender={titleRender}
							blockNode={blockNode}
							className={className}
							dragTargetNodeClass={dragTargetNodeClass}
							isDragTargetNode={isDragTargetNode}
							onDragEnter={onDragEnter}
							onDragLeave={onDragLeave}
							onDragOver={onDragOver}
							onDrop={onDrop}
						/>
					))}
				</div>
			)}
		</div>
	)
}

interface CustomTreeProps {
	treeData: TreeNodeData[]
	expandedKeys?: React.Key[]
	selectedKeys?: React.Key[]
	onExpand?: (expandedKeys: React.Key[], info: { expanded: boolean; node: TreeNodeData }) => void
	onSelect?: (selectedKeys: React.Key[], info: { selected: boolean; node: TreeNodeData }) => void
	titleRender?: (node: TreeNodeData) => React.ReactNode
	showIcon?: boolean
	blockNode?: boolean
	className?: string
	switcherIcon?: () => React.ReactNode
	dragTargetNodeClass?: string
	isDragTargetNode?: (node: TreeNodeData) => boolean
	// 拖拽事件处理器
	onDragEnter?: (e: React.DragEvent, node: TreeNodeData) => void
	onDragLeave?: (e: React.DragEvent, node: TreeNodeData) => void
	onDragOver?: (e: React.DragEvent, node: TreeNodeData) => void
	onDrop?: (e: React.DragEvent, node: TreeNodeData) => void
}

function CustomTree({
	treeData,
	expandedKeys = [],
	selectedKeys = [],
	onExpand,
	onSelect,
	titleRender,
	showIcon = true,
	blockNode = false,
	className,
	switcherIcon,
	dragTargetNodeClass,
	isDragTargetNode,
	onDragEnter,
	onDragLeave,
	onDragOver,
	onDrop,
}: CustomTreeProps) {
	const handleExpand = (key: string, node: TreeNodeData) => {
		if (!onExpand) return

		const expanded = expandedKeys.includes(key)
		let newExpandedKeys: React.Key[]

		if (expanded) {
			newExpandedKeys = expandedKeys.filter((k) => k !== key)
		} else {
			newExpandedKeys = [...expandedKeys, key]
		}

		onExpand(newExpandedKeys, { expanded: !expanded, node })
	}

	const handleSelect = (key: string, node: TreeNodeData) => {
		if (!onSelect) return

		const isSelected = selectedKeys.includes(key)
		let newSelectedKeys: React.Key[]

		if (isSelected) {
			newSelectedKeys = selectedKeys.filter((k) => k !== key)
		} else {
			newSelectedKeys = [key] // 单选模式
		}

		onSelect(newSelectedKeys, { selected: !isSelected, node })
	}

	return (
		<div className={cx("magic-tree", className)}>
			{treeData.map((node) => (
				<TreeNode
					key={node.key}
					node={node}
					expandedKeys={expandedKeys}
					selectedKeys={selectedKeys}
					onExpand={handleExpand}
					onSelect={handleSelect}
					titleRender={titleRender}
					showIcon={showIcon}
					blockNode={blockNode}
					className={className}
					dragTargetNodeClass={dragTargetNodeClass}
					isDragTargetNode={isDragTargetNode}
					onDragEnter={onDragEnter}
					onDragLeave={onDragLeave}
					onDragOver={onDragOver}
					onDrop={onDrop}
				/>
			))}
		</div>
	)
}

export default memo(CustomTree)
