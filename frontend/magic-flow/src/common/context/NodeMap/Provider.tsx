import React, { useMemo } from "react"
import { NodeMapContext, NodeMapCtx } from "./Context"

export const NodeMapProvider = ({ children, nodeMap }: NodeMapCtx) => {
	const value = useMemo(() => {
		return {
			nodeMap,
		}
	}, [nodeMap])

	return <NodeMapContext.Provider value={value}>{children}</NodeMapContext.Provider>
}
