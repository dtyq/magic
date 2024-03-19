import React, { useMemo } from "react"
import {
	FlowInteractionContext,
	FlowInteractionCtx,
	FlowInteractionStateContext,
	FlowInteractionActionsContext,
	FlowInteractionStateType,
	FlowInteractionActionsType,
} from "./Context"

export const FlowInteractionProvider = ({
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
	children,
}: FlowInteractionCtx) => {
	// 将状态和动作分开缓存，减少不必要的重新渲染
	const stateValue = useMemo<FlowInteractionStateType>(() => {
		return {
			isDragging,
			showParamsComp,
			showSelectionTools,
			currentZoom,
			selectionNodes,
			selectionEdges,
		}
	}, [
		isDragging,
		showParamsComp,
		showSelectionTools,
		currentZoom,
		selectionNodes,
		selectionEdges,
	])

	// actions很少变化，单独缓存
	const actionsValue = useMemo<FlowInteractionActionsType>(() => {
		return {
			resetLastLayoutData,
			onAddItem,
			layout,
			setShowSelectionTools,
			onNodesDelete,
			reactFlowWrapper,
		}
	}, [
		resetLastLayoutData,
		onAddItem,
		layout,
		setShowSelectionTools,
		onNodesDelete,
		reactFlowWrapper,
	])

	// 为了向后兼容，仍然提供完整的Context
	const value = useMemo(() => {
		return {
			...stateValue,
			...actionsValue,
		}
	}, [stateValue, actionsValue])

	return (
		<FlowInteractionActionsContext.Provider value={actionsValue}>
			<FlowInteractionStateContext.Provider value={stateValue}>
				<FlowInteractionContext.Provider value={value}>
					{children}
				</FlowInteractionContext.Provider>
			</FlowInteractionStateContext.Provider>
		</FlowInteractionActionsContext.Provider>
	)
}
