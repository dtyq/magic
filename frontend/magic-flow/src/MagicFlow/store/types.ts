import { BaseNodeType, NodeVersionWidget } from "../register/node"

export type GlobalFlowStore = {
	// 可被添加的物料类型列表
	displayMaterialTypes: BaseNodeType[]
	updateDisplayMaterialType: (nodeTypes: BaseNodeType[]) => void
    // 节点版本schema
    nodeVersionSchema: Record<string, NodeVersionWidget>
    updateNodeVersionSchema: (nodeVersionSchema: Record<string, NodeVersionWidget>) => void
}