import React, { memo } from "react"
import ReactFlow, { SelectionMode, useViewport } from "reactflow"
import { ConnectionLine } from "@/MagicFlow/edges/ConnectionLine"
import { Interactions } from "../../components/InteractionSelect"
import { HelperLines, useHelperLines } from "@/MagicFlow/components/HelperLines"

// 阈值：节点靠近多少时显示对齐线
const SNAP_THRESHOLD = 5

interface ReactFlowComponentProps {
	nodeTypes: any
	edgeTypes: any
	nodes: any[]
	edges: any[]
	onNodesChange: any
	onEdgesChange: any
	onConnect: any
	onNodeClick: any
	onEdgeClick: any
	onNodeDragStart: any
	onNodeDrag: any
	onNodeDragStop: any
	onDrop: any
	onDragOver: any
	onClick: any
	onNodesDelete: any
	onEdgesDelete: any
	onPaneClick: any
	onMove: any
	onSelectionChange: any
	onSelectionEnd: any
	interaction: string
	flowInstance: any
	onlyRenderVisibleElements: boolean
	/** 是否启用辅助线功能 */
	helperLinesEnabled?: boolean
	children: React.ReactNode
}

const ReactFlowComponent = memo(
	({
		nodeTypes,
		edgeTypes,
		nodes,
		edges,
		onNodesChange,
		onEdgesChange,
		onConnect,
		onNodeClick,
		onEdgeClick,
		onNodeDragStart,
		onNodeDrag,
		onNodeDragStop,
		onDrop,
		onDragOver,
		onClick,
		onNodesDelete,
		onEdgesDelete,
		onPaneClick,
		onMove,
		onSelectionChange,
		onSelectionEnd,
		interaction,
		flowInstance,
		helperLinesEnabled = false,
		children,
	}: ReactFlowComponentProps) => {
		// 获取viewport信息（缩放、平移等）
		const { x, y, zoom } = useViewport()

		// 使用辅助线hook
		const {
			horizontalLines,
			verticalLines,
			handleNodeDragStart,
			handleNodeDrag,
			handleNodeDragStop,
			hasHelperLines,
		} = useHelperLines({
			nodes,
			onNodeDragStart,
			onNodeDrag,
			onNodeDragStop,
			onNodesChange, // 添加onNodesChange参数
			enabled: helperLinesEnabled, // 添加enabled参数
			options: {
				// 配置参数
				threshold: 5, // 对齐阈值
				color: "#315cec", // 辅助线颜色
				lineWidth: 1, // 辅助线宽度
				zIndex: 9999, // 辅助线z-index
				enableSnap: true, // 启用节点吸附
			},
		})

		return (
			<>
				<ReactFlow
					//@ts-ignore
					nodeTypes={nodeTypes}
					edgeTypes={edgeTypes}
					//@ts-ignore
					nodes={nodes}
					edges={edges}
					onNodesChange={onNodesChange}
					onEdgesChange={onEdgesChange}
					onConnect={onConnect}
					onNodeClick={onNodeClick}
					onEdgeClick={onEdgeClick}
					onNodeDragStart={handleNodeDragStart}
					onNodeDrag={handleNodeDrag}
					onNodeDragStop={handleNodeDragStop}
					onDrop={onDrop}
					onDragOver={onDragOver}
					onClick={onClick}
					onNodesDelete={onNodesDelete}
					onEdgesDelete={onEdgesDelete}
					minZoom={0.01}
					maxZoom={8}
					connectionLineComponent={ConnectionLine}
					panOnScroll={interaction === Interactions.TouchPad}
					zoomOnScroll={interaction === Interactions.Mouse}
					panOnDrag={interaction === Interactions.Mouse}
					selectionOnDrag
					ref={flowInstance}
					onPaneClick={onPaneClick}
					zoomOnDoubleClick={false}
					// @ts-ignore
					onMove={onMove}
					selectionKeyCode={null}
					onSelectionChange={onSelectionChange}
					onSelectionEnd={onSelectionEnd}
					// 选中部分就算选中
					selectionMode={SelectionMode.Partial}
				>
					{children}
					{/* 渲染辅助线 */}
					{hasHelperLines && (
						<HelperLines
							horizontalLines={horizontalLines}
							verticalLines={verticalLines}
							transform={{ x, y, zoom }}
						/>
					)}
				</ReactFlow>
			</>
		)
	},
)

export default ReactFlowComponent
