


import { createWithEqualityFn } from "zustand/traditional"
import { getInitialStates } from "./initialStates"
import { BaseNodeType, NodeVersionWidget } from "../register/node"
import { GlobalFlowStore } from "./types"


export type GlobalFlowStoreProps = {
	// 默认显示可以在画布添加的节点物料类型列表
	defaultDisplayMaterialTypes: BaseNodeType[],
    // 节点版本schema
    nodeVersionSchema: Record<string, NodeVersionWidget>
}

const createStore = ({
	defaultDisplayMaterialTypes,
    nodeVersionSchema
}: GlobalFlowStoreProps) => createWithEqualityFn<GlobalFlowStore>((set, get) => ({
	...getInitialStates({defaultDisplayMaterialTypes, nodeVersionSchema}),
	
	updateDisplayMaterialType: (nodeTypes: BaseNodeType[]) => {
		set(state => ({ ...state, displayMaterialTypes: [...nodeTypes] }))
	},

    updateNodeVersionSchema: (nodeVersionSchema: Record<string, NodeVersionWidget>) => {
		set((state) => ({ ...state, nodeVersionSchema }))
    }
}), Object.is)


export { createStore }

export const flowStore = createStore({
    defaultDisplayMaterialTypes: [],
    nodeVersionSchema: {}
})
