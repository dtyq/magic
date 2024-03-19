import { GlobalFlowStoreProps } from "."

export const getInitialStates = ({
	defaultDisplayMaterialTypes,
    nodeVersionSchema
}:GlobalFlowStoreProps) => {
	return {
		displayMaterialTypes: defaultDisplayMaterialTypes || [],
        nodeVersionSchema
	}
}