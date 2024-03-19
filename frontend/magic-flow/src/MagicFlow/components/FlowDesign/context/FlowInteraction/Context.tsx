import { NodeSchema } from "@/MagicFlow/register/node"
import { MagicFlow } from "@/MagicFlow/types/flow"
import React from "react"
import { Edge, Node } from "reactflow"

// 将FlowInteractionCtx拆分为状态和动作两部分
export type FlowInteractionStateType = {
	isDragging: boolean
	showParamsComp: boolean
	showSelectionTools: boolean
	currentZoom: number
	selectionNodes: MagicFlow.Node[]
	selectionEdges: Edge[]
}

export type FlowInteractionActionsType = {
	resetLastLayoutData: () => void
	onAddItem: (
		event: any,
		nodeData: NodeSchema,
		extraConfig?: Record<string, any>,
	) => Promise<void>
	layout: () => MagicFlow.Node[]
	setShowSelectionTools: React.Dispatch<React.SetStateAction<boolean>>
	onNodesDelete: (_nodes: Node[]) => void
	reactFlowWrapper?: React.RefObject<HTMLDivElement>
}

export type FlowInteractionCtx = React.PropsWithChildren<
	FlowInteractionStateType & FlowInteractionActionsType
>

// 状态Context
export const FlowInteractionStateContext = React.createContext<FlowInteractionStateType>({
	isDragging: false,
	showParamsComp: true,
	showSelectionTools: false,
	currentZoom: 1,
	selectionNodes: [],
	selectionEdges: [],
})

// 动作Context
export const FlowInteractionActionsContext = React.createContext<FlowInteractionActionsType>({
	resetLastLayoutData: () => {},
	onAddItem: (() => Promise.resolve()) as any,
	layout: () => [],
	setShowSelectionTools: () => {},
	onNodesDelete: () => {},
	reactFlowWrapper: undefined,
})

// 保持原有Context向后兼容
export const FlowInteractionContext = React.createContext({
	// 是否处于拖拽状态
	isDragging: false,

	// 重置布局
	resetLastLayoutData: () => {},

	// 新增节点
	onAddItem: (() => {}) as any,

	// 布局优化
	layout: () => [],

	// 是否显示组件的参数配置
	showParamsComp: true,

	/** 是否显示多选的选框的toolbar */
	showSelectionTools: false,
	setShowSelectionTools: () => {},

	onNodesDelete: () => {},

	currentZoom: 1,

	selectionNodes: [],
	selectionEdges: [],
} as FlowInteractionCtx)
