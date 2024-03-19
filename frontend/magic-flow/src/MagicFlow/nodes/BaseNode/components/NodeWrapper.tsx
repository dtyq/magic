import clsx from "clsx"
import React, { memo } from "react"
import { prefix } from "@/MagicFlow/constants"
import styles from "../index.module.less"
import DebuggerComp from "../../common/components/DebuggerComp"
import NodeTestingHeader from "../../common/NodeTestingHeader"
import _ from "lodash"

interface NodeWrapperProps {
	id: string
	isSelected: boolean
	onNodeWrapperClick: (e: React.MouseEvent) => void
	defaultStyle: React.CSSProperties
	commonStyle: React.CSSProperties | undefined
	nodeStyleMap: any
	type: string
	onDragLeave: (e: React.DragEvent) => void
	onDragOver: (e: React.DragEvent) => void
	onDrop: (e: React.DragEvent) => void
	children: React.ReactNode
}

// 内部实现组件
const NodeWrapperImpl = ({
	id,
	isSelected,
	onNodeWrapperClick,
	defaultStyle,
	commonStyle,
	nodeStyleMap,
	type,
	onDragLeave,
	onDragOver,
	onDrop,
	children,
}: NodeWrapperProps) => {
	return (
		<div
			className={clsx(styles.baseNodeWrapper, `${prefix}base-node-wrapper`, {
				[styles.isSelected]: isSelected,
				selected: isSelected,
			})}
			onClick={onNodeWrapperClick}
			style={{
				...defaultStyle,
				...(commonStyle || {}),
				...(nodeStyleMap?.[type] || {}),
			}}
			onDragLeave={onDragLeave}
			onDragOver={onDragOver}
			onDrop={onDrop}
		>
			<DebuggerComp id={id} />
			<NodeTestingHeader />
			{children}
		</div>
	)
}

// 自定义比较函数，忽略children的变化
const arePropsEqual = (prevProps: NodeWrapperProps, nextProps: NodeWrapperProps) => {
	// 提取children之外的props
	const { ...prevRest } = prevProps
	const { ...nextRest } = nextProps

	// 检查基本属性的变化，优先比较常见变化项提高性能
	if (
		prevRest.id !== nextRest.id ||
		prevRest.isSelected !== nextRest.isSelected ||
		prevRest.type !== nextRest.type
	) {
		return false
	}

	// 检查事件处理函数 - 理论上这些应该被useCallback包装，所以可以直接比较引用
	// 但这里为了安全起见，我们将它们排除在比较之外
	const {
		onNodeWrapperClick: prevClick,
		onDragLeave: prevLeave,
		onDragOver: prevOver,
		onDrop: prevDrop,
		...prevRestWithoutHandlers
	} = prevRest

	const {
		onNodeWrapperClick: nextClick,
		onDragLeave: nextLeave,
		onDragOver: nextOver,
		onDrop: nextDrop,
		...nextRestWithoutHandlers
	} = nextRest

	// 深度比较剩余属性
	return _.isEqual(prevRestWithoutHandlers, nextRestWithoutHandlers)
}

// 使用memo包装组件，使用自定义比较函数
const NodeWrapper = memo(NodeWrapperImpl, arePropsEqual)

export default NodeWrapper
