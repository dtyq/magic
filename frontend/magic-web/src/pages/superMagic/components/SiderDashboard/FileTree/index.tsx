import React, { memo, forwardRef, useCallback } from "react"
import { cx } from "antd-style"
import type { TreeNode, FileTreeProps, FileTreeRef } from "./types"
import { useStyles } from "./styles"
import TreeNodeItem from "./TreeNodeItem"
import { useFileTree } from "./useFileTree"

/**
 * FileTree - 通用文件树组件
 *
 * 支持复选框、展开收起、搜索过滤、自定义渲染等功能
 *
 * @param props - 组件属性
 * @param ref - 组件引用
 * @returns JSX.Element
 */
function FileTree<T extends TreeNode = TreeNode>(
	{
		data,
		className,
		style,
		checkable = false,
		checkedKeys,
		onCheck,
		expandedKeys,
		defaultExpandedKeys,
		onExpand,
		itemRender,
		iconRender,
		searchValue,
		filterTreeNode,
		emptyText = "暂无数据",
	}: FileTreeProps<T>,
	ref: React.Ref<FileTreeRef>,
) {
	const { styles } = useStyles()

	// 使用 FileTree Hook
	const {
		filteredData,
		nodeRefs,
		isNodeChecked,
		isNodeIndeterminate,
		isNodeExpanded,
		handleExpand,
		handleCheck,
		getAllNodes,
	} = useFileTree({
		data,
		checkable,
		checkedKeys,
		onCheck,
		expandedKeys,
		defaultExpandedKeys,
		onExpand,
		searchValue,
		filterTreeNode,
	})

	// 暴露 Ref 方法
	React.useImperativeHandle(ref, () => ({
		expandAll: () => {
			const allNodes = getAllNodes(data)
			allNodes.forEach((node) => {
				if (node.children && node.children.length > 0) {
					handleExpand(node.id, true)
				}
			})
		},
		collapseAll: () => {
			const allNodes = getAllNodes(data)
			allNodes.forEach((node) => {
				if (node.children && node.children.length > 0) {
					handleExpand(node.id, false)
				}
			})
		},
		expandNode: (key: string) => {
			handleExpand(key, true)
		},
		collapseNode: (key: string) => {
			handleExpand(key, false)
		},

		checkNode: (key: string, checked: boolean) => {
			handleCheck(key, checked)
		},
		getCheckedNodes: () => {
			return getAllNodes(data).filter((node) => isNodeChecked(node.id))
		},

		getExpandedNodes: () => {
			return getAllNodes(data).filter((node) => isNodeExpanded(node.id))
		},
	}))

	// 渲染树节点
	const renderTreeNodes = useCallback(
		(nodes: T[], level = 0): React.ReactNode[] => {
			return nodes.map((node) => (
				<TreeNodeItem<T>
					key={node.id}
					ref={(el) => {
						if (el) {
							nodeRefs.current[node.id] = el
						}
					}}
					node={node}
					level={level}
					checked={isNodeChecked(node.id)}
					indeterminate={isNodeIndeterminate(node)}
					expanded={isNodeExpanded(node.id)}
					checkable={checkable}
					onExpand={handleExpand}
					onCheck={handleCheck}
					itemRender={itemRender}
					iconRender={iconRender}
				>
					{node.children && node.children.length > 0
						? renderTreeNodes(node.children as T[], level + 1)
						: null}
				</TreeNodeItem>
			))
		},
		[
			nodeRefs,
			isNodeChecked,
			isNodeIndeterminate,
			isNodeExpanded,
			handleExpand,
			handleCheck,
			checkable,
			itemRender,
			iconRender,
		],
	)

	// 空状态处理
	if (!data || data.length === 0) {
		return (
			<div className={cx(styles.fileTree, className)} style={style}>
				<div className={styles.emptyState}>{emptyText}</div>
			</div>
		)
	}

	// 无搜索结果
	if (filteredData.length === 0 && searchValue) {
		return (
			<div className={cx(styles.fileTree, className)} style={style}>
				<div className={styles.emptyState}>无匹配结果</div>
			</div>
		)
	}

	return (
		<div className={cx(styles.fileTree, className)} style={style}>
			<div className={styles.treeContainer}>
				<div className={styles.treeContent}>{renderTreeNodes(filteredData)}</div>
			</div>
		</div>
	)
}

const FileTreeMemo = memo(forwardRef(FileTree)) as <T extends TreeNode = TreeNode>(
	props: FileTreeProps<T> & { ref?: React.Ref<FileTreeRef> },
) => React.ReactElement

// 设置 displayName
;(FileTreeMemo as any).displayName = "FileTree"

export default FileTreeMemo
export type { TreeNode, FileTreeProps, FileTreeRef, ItemRenderProps } from "./types"
