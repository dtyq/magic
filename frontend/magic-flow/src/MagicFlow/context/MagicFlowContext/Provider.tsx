/**
 * 业务组件传入相关的自定义props
 */
import { flowStore } from "@/MagicFlow/store"
import { getRegisterNodeTypes } from "@/MagicFlow/utils"
import { useNodeMap } from "@/common/context/NodeMap/useResize"
import React, { useEffect } from "react"
import { MagicFlowContext } from "./Context"

export const MagicFlowProvider = ({ children }: React.PropsWithChildren<{}>) => {
	const { updateDisplayMaterialType, updateNodeVersionSchema } = flowStore.getState()

	const { nodeMap } = useNodeMap()

	useEffect(() => {
		const defaultDisplayMaterialTypes = getRegisterNodeTypes()
		updateDisplayMaterialType(defaultDisplayMaterialTypes)
	}, [])

	useEffect(() => {
		updateNodeVersionSchema(nodeMap)
	}, [nodeMap])

	return <MagicFlowContext.Provider value={flowStore}>{children}</MagicFlowContext.Provider>
}
