import type { ReactNode, CSSProperties } from "react"

// 基础树节点接口
export interface TreeNode {
	id: string
	name: string
	type?: string
	children?: TreeNode[]
	[key: string]: any // 允许扩展其他属性
}

// 组件基础属性
export interface BaseComponentProps {
	className?: string
	style?: CSSProperties
	children?: ReactNode
}

// FileTree 组件属性
export interface FileTreeProps<T extends TreeNode = TreeNode> extends BaseComponentProps {
	// 数据源
	data: T[]

	// 复选框相关
	checkable?: boolean
	checkedKeys?: string[]
	onCheck?: (checkedKeys: string[], checkedNodes: T[]) => void

	// 展开收起相关
	expandedKeys?: string[]
	defaultExpandedKeys?: string[]
	onExpand?: (expandedKeys: string[], expandedNodes: T[]) => void

	// 自定义渲染
	itemRender?: (node: T, props: ItemRenderProps<T>) => ReactNode
	iconRender?: (node: T, expanded: boolean) => ReactNode

	// 搜索过滤
	searchValue?: string
	filterTreeNode?: (node: T, searchValue: string) => boolean

	// 空状态
	emptyText?: ReactNode
}

// ItemRender 属性
export interface ItemRenderProps<T extends TreeNode = TreeNode> {
	node: T
	level: number
	expanded: boolean
	checked: boolean
	indeterminate: boolean
	isLeaf: boolean
	onExpand: () => void
	onCheck: (checked: boolean) => void
}

// 内部状态接口
export interface TreeState {
	expandedKeys: Set<string>
	checkedKeys: Set<string>
}

// Ref 暴露的方法接口
export interface FileTreeRef {
	expandAll: () => void
	collapseAll: () => void
	expandNode: (key: string) => void
	collapseNode: (key: string) => void
	checkNode: (key: string, checked: boolean) => void
	getCheckedNodes: () => TreeNode[]
	getExpandedNodes: () => TreeNode[]
}
