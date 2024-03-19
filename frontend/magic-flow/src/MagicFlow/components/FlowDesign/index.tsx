import React, { useState, useMemo, memo } from "react"
import styles from "./index.module.less"

import { useExternalConfig } from "@/MagicFlow/context/ExternalContext/useExternal"
import { useFlowEdges, useFlowUI } from "../../context/FlowContext/useFlow"
import { edgeModels } from "../../edges"
import nodeModels from "../../nodes/index"
import FlowBackground from "./components/FlowBackground"
import useSelections from "./components/SelectionTools/useSelections"
import { FlowInteractionProvider } from "./context/FlowInteraction/Provider"
import useFlowControls from "./hooks/useFlowControls"
import useFlowEvents from "./hooks/useFlowEvents"
import useNodeClick from "./hooks/useNodeClick"
import useTargetToErrorNode from "./hooks/useTargetToErrorNode"
import { useNodes } from "@/MagicFlow/context/NodesContext/useNodes"
import useFlowCommand from "./hooks/useFlowCommands"
// 导入新的叶子组件
import FlowControls from "./components/sections/FlowControls"
import FlowSelectionPanel from "./components/sections/FlowSelectionPanel"
import FlowMiniMap from "./components/sections/FlowMiniMap"
import ReactFlowComponent from "./components/sections/ReactFlowComponent"

// 为了避免子组件变化导致ReactFlowComponent重新渲染，创建一个稳定的子组件
const StableFlowChildren = memo(
	({ showMinMap, controlItemGroups }: { showMinMap: boolean; controlItemGroups: any }) => {
		return (
			<>
				<FlowControls controlItemGroups={controlItemGroups} />
				<FlowBackground />
				<FlowMiniMap showMinMap={showMinMap} />
			</>
		)
	},
)

// 使用memo将FlowDesign组件包装起来，避免不必要的渲染
const FlowDesign = memo(function FlowDesign() {
	// 使用更细粒度的hook替代全量useFlow，减少不必要的重渲染
	const { onEdgesChange, onConnect, edges } = useFlowEdges()
	const { flowInstance } = useFlowUI()
	const { nodes, onNodesChange } = useNodes()

	// 分辨率小于15% | 全量渲染时，关闭params渲染
	const [showParamsComp, setShowParamsComp] = useState(true)

	const { onNodeClick, onPanelClick } = useNodeClick()

	const {
		showSelectionTools,
		setShowSelectionTools,
		selectionNodes,
		selectionEdges,
		onSelectionChange,
		onSelectionEnd,
		onCopy,
	} = useSelections({
		flowInstance,
	})

	const {
		controlItemGroups,
		resetLastLayoutData,
		resetCanLayout,
		layout,
		showMinMap,
		currentZoom,
		onMove,
		interaction,
		onInteractionChange,
		onFitView,
		onZoomIn,
		onZoomOut,
		onEdgeTypeChange,
		onLock,
		helperLinesEnabled,
	} = useFlowControls({
		setShowParamsComp,
		flowInstance,
	})

	const {
		onNodeDragStop,
		onDrop,
		onDragOver,
		reactFlowWrapper,
		onReactFlowClick,
		onNodeDragStart,
		onNodeDrag,
		isDragging,
		onNodesDelete,
		onEdgeClick,
		onEdgesDelete,
		onAddItem,
		onlyRenderVisibleElements,
	} = useFlowEvents({
		resetLastLayoutData,
		resetCanLayout,
		currentZoom,
		setShowParamsComp,
	})

	/** 外部传的参数优先级最高 */
	const { onlyRenderVisibleElements: externalOnlyRenderVisibleElements } = useExternalConfig()

	/** 运行错误时，定位到错误节点 */
	useTargetToErrorNode()

	useFlowCommand({
		layout,
		onInteractionChange,
		onFitView,
		onZoomIn,
		onZoomOut,
		onEdgeTypeChange,
		onLock,
		// @ts-ignore
		onNodesDelete,
		onEdgesDelete,
		onAddItem,
	})

	// 使用useMemo优化复杂的计算或对象创建
	const visibleElements = useMemo(
		() => externalOnlyRenderVisibleElements || onlyRenderVisibleElements,
		[externalOnlyRenderVisibleElements, onlyRenderVisibleElements],
	)

	// 使用useMemo包装FlowInteractionProvider的props
	const interactionProviderProps = useMemo(
		() => ({
			isDragging,
			resetLastLayoutData,
			onAddItem,
			layout,
			showParamsComp,
			showSelectionTools,
			setShowSelectionTools,
			onNodesDelete,
			currentZoom,
			reactFlowWrapper,
			selectionNodes,
			selectionEdges,
		}),
		[
			isDragging,
			resetLastLayoutData,
			onAddItem,
			layout,
			showParamsComp,
			showSelectionTools,
			setShowSelectionTools,
			onNodesDelete,
			currentZoom,
			reactFlowWrapper,
			selectionNodes,
			selectionEdges,
		],
	)

	// 使用useMemo包装ReactFlowComponent的props
	const reactFlowProps = useMemo(
		() => ({
			nodeTypes: nodeModels,
			edgeTypes: edgeModels,
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
			onClick: onReactFlowClick,
			onNodesDelete,
			onEdgesDelete,
			onPaneClick: onPanelClick,
			onMove,
			onSelectionChange,
			onSelectionEnd,
			interaction,
			flowInstance,
			onlyRenderVisibleElements: visibleElements,
			helperLinesEnabled,
		}),
		[
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
			onReactFlowClick,
			onNodesDelete,
			onEdgesDelete,
			onPanelClick,
			onMove,
			onSelectionChange,
			onSelectionEnd,
			interaction,
			flowInstance,
			visibleElements,
			helperLinesEnabled,
		],
	)

	// 使用useMemo包装FlowSelectionPanel的props
	const selectionPanelProps = useMemo(
		() => ({
			showSelectionTools,
			setShowSelectionTools,
			selectionNodes,
			selectionEdges,
			onCopy,
		}),
		[showSelectionTools, setShowSelectionTools, selectionNodes, selectionEdges, onCopy],
	)

	// 稳定ReactFlowComponent的children引用
	const stableChildren = useMemo(
		() => <StableFlowChildren showMinMap={showMinMap} controlItemGroups={controlItemGroups} />,
		[showMinMap, controlItemGroups],
	)

	return (
		<div className={styles.flowDesign} ref={reactFlowWrapper}>
			<FlowInteractionProvider {...interactionProviderProps}>
				{/* 将FlowSelectionPanel移出ReactFlowComponent，成为兄弟组件 */}
				<FlowSelectionPanel {...selectionPanelProps} />
				<ReactFlowComponent {...reactFlowProps}>{stableChildren}</ReactFlowComponent>
			</FlowInteractionProvider>
		</div>
	)
})

export default FlowDesign
