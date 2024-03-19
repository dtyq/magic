import React, { useContext } from "react"
import {
	FlowContext,
	FlowDataContext,
	FlowEdgesContext,
	FlowEdgesStateContext,
	FlowEdgesActionsContext,
	FlowNodesActionsContext,
	FlowNodesContext,
	FlowNodesStateContext,
	FlowUIContext,
	NodeConfigActionsContext,
	NodeConfigContext,
	FlowNodesStateType,
	FlowNodesActionsType,
	FlowEdgesStateType,
	FlowEdgesActionsType
} from "./Context"

// 原有hook保持不变，为了向后兼容
export const useFlow = () => useContext(FlowContext)

// 新增专用hook，让组件可以只订阅它们需要的数据
export const useFlowData = () => useContext(FlowDataContext)

// 获取所有Flow Edges相关的状态和动作
export const useFlowEdges = () => useContext(FlowEdgesContext)

// 获取Flow Edges状态
export const useFlowEdgesState = (): FlowEdgesStateType => {
	return useContext(FlowEdgesStateContext)
}

// 获取Flow Edges动作
export const useFlowEdgesActions = (): FlowEdgesActionsType => {
	return useContext(FlowEdgesActionsContext)
}

// 仅获取edges数据
export const useEdges = () => {
	return useContext(FlowEdgesStateContext).edges
}

// 仅获取selectedEdgeId
export const useSelectedEdgeId = () => {
	const { selectedEdgeId } = useContext(FlowEdgesStateContext)
	const { setSelectedEdgeId } = useContext(FlowEdgesActionsContext)
	return { selectedEdgeId, setSelectedEdgeId }
}

// 仅获取onEdgesChange方法
export const useOnEdgesChange = () => {
	return useContext(FlowEdgesActionsContext).onEdgesChange
}

// 仅获取onConnect方法
export const useOnConnect = () => {
	return useContext(FlowEdgesActionsContext).onConnect
}

// 获取所有Flow Nodes相关的状态和动作
export const useFlowNodes = () => {
	return useContext(FlowNodesContext)
}

export const useFlowUI = () => useContext(FlowUIContext)

// 获取节点配置
export const useNodeConfig = () => {
	const { nodeConfig } = useContext(NodeConfigContext)
	return { nodeConfig }
}

// 获取节点配置操作方法
export const useNodeConfigActions = () => useContext(NodeConfigActionsContext)

// 获取单个节点配置，优化渲染性能
export const useSingleNodeConfig = (nodeId: string) => {
	const { nodeConfig } = useContext(NodeConfigContext)
	return nodeConfig[nodeId]
}

// 创建特定数据选择器，可以进一步减少不必要的渲染
export function createFlowSelector<T>(selector: (context: any) => T) {
	return function useFlowSelector() {
		const context = useContext(FlowContext)
		return React.useMemo(() => selector(context), [context])
	}
}

// 创建节点配置选择器，只有当特定节点配置改变时才会重新渲染
export function createNodeConfigSelector(nodeId: string) {
	return () => {
		const { nodeConfig } = useNodeConfig()
		return nodeConfig[nodeId]
	}
}

// 仅获取选中节点ID
export const useSelectedNodeId = () => {
	return useContext(FlowNodesStateContext).selectedNodeId
}

// 仅获取triggerNode
export const useTriggerNode = () => {
	return useContext(FlowNodesStateContext).triggerNode
}

// 仅获取添加节点的方法
export const useAddNode = () => {
	return useContext(FlowNodesActionsContext).addNode
}

// 仅获取删除节点的方法  
export const useDeleteNodes = () => {
	return useContext(FlowNodesActionsContext).deleteNodes
}

export const useNodeOperations = () => {
	const { addNode, deleteNodes, updateNodesPosition } = useFlowNodes()
	return { addNode, deleteNodes, updateNodesPosition }
}

export const useMaterialPanel = () => {
	const { showMaterialPanel, setShowMaterialPanel } = useFlowUI()
	return { showMaterialPanel, setShowMaterialPanel }
}
