import { MagicFlow } from "@/MagicFlow/types/flow"
import React from "react"

// 状态部分
export type NodesStateCtx = {
    // 节点数据
    nodes: MagicFlow.Node[]
}

export const NodesStateContext = React.createContext<NodesStateCtx>({
    nodes: [],
})

// 动作部分
export type NodesActionCtx = {
    setNodes: React.Dispatch<React.SetStateAction<MagicFlow.Node[]>>
    onNodesChange: (changes: any) => void
}

export const NodesActionContext = React.createContext<NodesActionCtx>({
    setNodes: () => {},
    onNodesChange: () => {},
})

// 为了向后兼容而保留的完整Context
export type NodesCtx = React.PropsWithChildren<NodesStateCtx & NodesActionCtx>

export const NodesContext = React.createContext<NodesCtx>({
    // 节点数据
    nodes: [] as MagicFlow.Node[],
    setNodes: () => {},
    onNodesChange: () => {},
}) 