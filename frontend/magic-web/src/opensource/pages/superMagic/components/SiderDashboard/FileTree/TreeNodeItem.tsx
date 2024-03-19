import {
	memo,
	forwardRef,
	useImperativeHandle,
	useState,
	useRef,
	useMemo,
	useCallback,
} from "react"
import { Checkbox } from "antd"
import { IconChevronRight, IconFolder, IconFile } from "@tabler/icons-react"
import type { CheckboxChangeEvent } from "antd"
import type { TreeNode, ItemRenderProps } from "./types"
import { useStyles, getIndentStyle } from "./styles"

interface TreeNodeItemProps<T extends TreeNode = TreeNode> {
	node: T
	level: number
	checkable: boolean
	checked: boolean
	indeterminate: boolean
	expanded: boolean
	indent?: number
	onExpand: (nodeId: string, expanded: boolean) => void
	onCheck: (nodeId: string, checked: boolean) => void
	itemRender?: (node: T, props: ItemRenderProps<T>) => React.ReactNode
	iconRender?: (node: T, expanded: boolean) => React.ReactNode
	children?: React.ReactNode
}

function TreeNodeItem<T extends TreeNode = TreeNode>(
	{
		node,
		level,
		checkable,
		checked,
		indeterminate,
		expanded,
		indent = 20,
		onExpand,
		onCheck,
		itemRender,
		iconRender,
		children,
	}: TreeNodeItemProps<T>,
	ref: React.Ref<any>,
) {
	const { cx, styles } = useStyles()

	// 状态
	const [childrenHeight, setChildrenHeight] = useState<string>(expanded ? "auto" : "0px")

	// 引用
	const childrenRef = useRef<HTMLDivElement>(null)
	const contentRef = useRef<HTMLDivElement>(null)

	// 计算样式
	const indentStyle = useMemo(() => getIndentStyle(level, indent), [level, indent])
	const hasChildren = Boolean(node.children && node.children.length > 0)
	const isLeaf = !hasChildren

	// 展开/收起处理
	const handleExpandToggle = useCallback(() => {
		if (!hasChildren) return

		const contentElement = contentRef.current
		if (!contentElement) return

		if (expanded) {
			// 收起：从当前高度到 0
			const currentHeight = contentElement.scrollHeight
			setChildrenHeight(`${currentHeight}px`)

			requestAnimationFrame(() => {
				setChildrenHeight("0px")
			})
		} else {
			// 展开：从 0 到实际高度
			setChildrenHeight("0px")

			requestAnimationFrame(() => {
				const targetHeight = contentElement.scrollHeight
				setChildrenHeight(`${targetHeight}px`)
			})
		}

		onExpand(node.id, !expanded)
	}, [hasChildren, expanded, onExpand, node.id])

	// 复选框变化处理
	const handleCheckboxChange = useCallback(
		(e: CheckboxChangeEvent) => {
			onCheck(node.id, e.target.checked)
		},
		[onCheck, node.id],
	)

	// 动画结束处理
	const handleTransitionEnd = useCallback(() => {
		if (expanded) {
			setChildrenHeight("auto")
		}
	}, [expanded])

	// 暴露给父组件的方法（简化为空对象）
	useImperativeHandle(ref, () => ({}), [])

	// 默认图标渲染
	const renderDefaultIcon = useCallback(
		(node: T, expanded: boolean) => {
			if (iconRender) {
				return iconRender(node, expanded)
			}

			if (hasChildren) {
				return <IconFolder size={16} className={styles.nodeIcon} />
			}

			return <IconFile size={16} className={styles.nodeIcon} />
		},
		[iconRender, hasChildren, styles.nodeIcon],
	)

	// ItemRender 属性
	const itemRenderProps: ItemRenderProps<T> = useMemo(
		() => ({
			node,
			level,
			expanded,
			checked,
			indeterminate,
			isLeaf,
			onExpand: () => handleExpandToggle(),
			onCheck: (checked: boolean) => onCheck(node.id, checked),
		}),
		[node, level, expanded, checked, indeterminate, isLeaf, handleExpandToggle, onCheck],
	)

	// 自定义渲染
	if (itemRender) {
		return (
			<div>
				{itemRender(node, itemRenderProps)}
				{/* 子节点容器 */}
				{hasChildren && (
					<div
						ref={childrenRef}
						className={styles.childrenContainer}
						style={{
							height: childrenHeight,
							overflow: "hidden",
							transition: "height 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
						}}
						onTransitionEnd={handleTransitionEnd}
					>
						<div ref={contentRef} className={styles.childrenContent}>
							{children}
						</div>
					</div>
				)}
			</div>
		)
	}

	// 默认渲染
	return (
		<div>
			<div
				className={styles.treeNode}
				style={{
					paddingLeft: indentStyle.paddingLeft,
				}}
			>
				{/* 展开/收起图标 */}
				<div
					className={cx(
						styles.expandIcon,
						expanded && "expanded",
						!hasChildren && "disabled",
					)}
					onClick={(e) => {
						e.stopPropagation()
						handleExpandToggle()
					}}
				>
					<IconChevronRight
						size={14}
						style={{
							opacity: hasChildren ? 1 : 0.3,
							transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
							transition: "transform 0.2s ease",
						}}
					/>
				</div>

				{/* 复选框 */}
				{checkable && (
					<Checkbox
						checked={checked}
						indeterminate={indeterminate}
						onChange={handleCheckboxChange}
						onClick={(e) => e.stopPropagation()}
					/>
				)}

				{/* 节点图标 */}
				{renderDefaultIcon(node, expanded)}

				{/* 节点内容 */}
				<div className={styles.nodeContent}>
					<div className={styles.nodeName} title={node.name}>
						{node.name}
					</div>
				</div>
			</div>

			{/* 子节点容器 */}
			{hasChildren && (
				<div
					ref={childrenRef}
					className={styles.childrenContainer}
					style={{
						height: childrenHeight,
						overflow: "hidden",
						transition: "height 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
					}}
					onTransitionEnd={handleTransitionEnd}
				>
					<div ref={contentRef} className={styles.childrenContent}>
						{children}
					</div>
				</div>
			)}
		</div>
	)
}

const TreeNodeItemMemo = memo(forwardRef(TreeNodeItem)) as <T extends TreeNode = TreeNode>(
	props: TreeNodeItemProps<T> & { ref?: React.Ref<any> },
) => React.ReactElement

export default TreeNodeItemMemo
