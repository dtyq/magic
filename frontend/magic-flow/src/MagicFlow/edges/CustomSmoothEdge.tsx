import React, { memo, useCallback, useMemo } from "react"
import { SmoothStepEdge, getSmoothStepPath } from "reactflow"
import { useUpdateEffect } from "ahooks"
import { IconPlus } from "@douyinfe/semi-icons"
import { Popover } from "antd"
import clsx from "clsx"
import { prefix } from "../constants"
import styles from "./index.module.less"
import useEdgeSelected from "../hooks/useEdgeSelected"
import { CustomEdgeProps } from "./CustomEdge"
import FlowPopup from "../components/FlowPopup"

function CustomSmoothEdgeComponent({
	sourceX,
	sourceY,
	targetX,
	targetY,
	sourcePosition,
	targetPosition,
	id,
	source,
	target,
	style,
	data,
	markerEnd,
	sourceHandleId,
}: CustomEdgeProps) {
	// 使用钩子获取边的选中状态
	const { isSelected } = useEdgeSelected(id)
	const [popupOpen, setPopupOpen] = React.useState(false)
	const [isHovered, setIsHovered] = React.useState(false)

	// 获取边的样式和路径
	const allowAddOnLine = data?.allowAddOnLine

	// 使用getSmoothStepPath获取边的路径
	const edgePath = useMemo(() => {
		const [path] = getSmoothStepPath({
			sourceX,
			sourceY,
			sourcePosition,
			targetX,
			targetY,
			targetPosition,
		})
		return path
	}, [sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition])

	// 添加图标的位置
	const iconPosition = useMemo(
		() => ({
			x: (sourceX + targetX) / 2 - 12,
			y: (sourceY + targetY) / 2 - 12,
		}),
		[sourceX, targetX, sourceY, targetY],
	)

	// 当边从选中状态变为非选中状态时，关闭弹窗
	useUpdateEffect(() => {
		if (!isSelected) {
			setPopupOpen(false)
		}
	}, [isSelected])

	// 优化事件处理函数
	const handleMouseEnter = useCallback(() => {
		setIsHovered(true)
	}, [])

	const handleMouseLeave = useCallback(() => {
		setIsHovered(false)
	}, [])

	const togglePopup = useCallback(() => {
		setPopupOpen((prev) => !prev)
	}, [])

	return (
		<>
			{/* 使用原生SmoothStepEdge作为基础边 */}
			<SmoothStepEdge
				id={id}
				source={source}
				target={target}
				sourceX={sourceX}
				sourceY={sourceY}
				targetX={targetX}
				targetY={targetY}
				sourcePosition={sourcePosition}
				targetPosition={targetPosition}
				style={style}
				markerEnd={markerEnd}
			/>

			{/* 添加一个透明的交互层，用于更好的悬停体验 */}
			<path
				id={`${id}-selector`}
				d={edgePath}
				className="react-flow__edge-path-selector"
				style={{ stroke: "transparent", strokeWidth: 48 }}
				onMouseEnter={handleMouseEnter}
				onMouseLeave={handleMouseLeave}
			/>

			{/* 添加节点的图标 */}
			{allowAddOnLine && (
				<foreignObject
					x={iconPosition.x}
					y={iconPosition.y}
					width={24}
					height={24}
					onMouseEnter={handleMouseEnter}
					className={clsx(styles.addIconWrapper)}
					onMouseLeave={handleMouseLeave}
					style={{ display: isHovered ? "block" : "none" }}
				>
					<Popover
						content={
							<FlowPopup
								source={source}
								target={target}
								edgeId={id}
								// @ts-ignore
								sourceHandle={sourceHandleId}
							/>
						}
						placement="right"
						showArrow={false}
						overlayClassName={clsx(styles.popup, `${prefix}popup`)}
						open={popupOpen}
					>
						<IconPlus
							className={clsx(styles.addIcon, `${prefix}add-icon`)}
							style={{
								background: style?.stroke,
							}}
							onClick={togglePopup}
						/>
					</Popover>
				</foreignObject>
			)}
		</>
	)
}

// 自定义比较函数，控制何时需要重新渲染边组件
const propsAreEqual = (prevProps: CustomEdgeProps, nextProps: CustomEdgeProps) => {
	// 如果边的ID变化，需要重新渲染
	if (prevProps.id !== nextProps.id) return false

	// 如果位置信息变化，需要重新渲染
	if (
		prevProps.sourceX !== nextProps.sourceX ||
		prevProps.sourceY !== nextProps.sourceY ||
		prevProps.targetX !== nextProps.targetX ||
		prevProps.targetY !== nextProps.targetY ||
		prevProps.sourcePosition !== nextProps.sourcePosition ||
		prevProps.targetPosition !== nextProps.targetPosition
	)
		return false

	// 如果连接的节点或handle发生变化，需要重新渲染
	if (
		prevProps.source !== nextProps.source ||
		prevProps.target !== nextProps.target ||
		prevProps.sourceHandleId !== nextProps.sourceHandleId
	)
		return false

	// 如果样式或markerEnd改变，需要重新渲染
	if (
		prevProps.markerEnd !== nextProps.markerEnd ||
		JSON.stringify(prevProps.style) !== JSON.stringify(nextProps.style)
	)
		return false

	// 检查data中的allowAddOnLine属性
	if (prevProps.data?.allowAddOnLine !== nextProps.data?.allowAddOnLine) return false

	// 如果以上条件都没有触发，则认为不需要重新渲染
	return true
}

// 使用memo包装组件以减少不必要的重新渲染
const CustomSmoothEdge = memo(CustomSmoothEdgeComponent, propsAreEqual)

export default CustomSmoothEdge
