export type TreeData = Record<string, unknown>

export interface TreeNode<T extends TreeData = TreeData> {
	id: string
	label: string
	children?: TreeNode<T>[]
	data?: T
}

export interface RenderNodeContext {
	/** 添加此类名到元素上，可以防止该元素的 hover 冒泡到 TreeNodeItem */
	noHoverClassName: string
	/** 添加此类名到元素上，可以防止该元素的 active 冒泡到 TreeNodeItem */
	noActiveClassName: string
	/** 添加此类名到元素上，该元素会在 hover 时显示 */
	showOnHoverClassName: string
	/** 节点是否展开 */
	isExpanded: boolean
	/** 节点是否被选中 */
	isSelected: boolean
}

export interface TreeProps<T extends TreeData = TreeData> {
	data: TreeNode<T>[]
	selectedIds?: string[]
	hoveredIds?: string[]
	onSelect?: (nodes: TreeNode<T>[], selectedIds: string[]) => void
	expandedIds?: Set<string>
	onToggle?: (id: string) => void
	className?: string
	treeNodeContentClassName?: string
	renderNode?: (node: TreeNode<T>, context: RenderNodeContext) => React.ReactNode
	onContextMenu?: (event: React.MouseEvent, node: TreeNode<T>) => void
	onDoubleClick?: (event: React.MouseEvent, node: TreeNode<T>) => void
	onMouseEnter?: (event: React.MouseEvent, node: TreeNode<T>) => void
	onMouseLeave?: (event: React.MouseEvent, node: TreeNode<T>) => void
}

export interface TreeNodeItemProps<T extends TreeData = TreeData> {
	node: TreeNode<T>
	level: number
	selectedIds?: string[]
	hoveredIds?: string[]
	expandedIds: Set<string>
	treeNodeContentClassName?: string
	onToggle: (id: string) => void
	onSelect?: (node: TreeNode<T>, isMultiSelect: boolean) => void
	renderNode?: (node: TreeNode<T>, context: RenderNodeContext) => React.ReactNode
	onContextMenu?: (event: React.MouseEvent, node: TreeNode<T>) => void
	onDoubleClick?: (event: React.MouseEvent, node: TreeNode<T>) => void
	onMouseEnter?: (event: React.MouseEvent, node: TreeNode<T>) => void
	onMouseLeave?: (event: React.MouseEvent, node: TreeNode<T>) => void
}
