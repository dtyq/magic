import React, { useMemo } from "react"
import { FlowPopupContext, FlowPopupCtx } from "./Context"

export const FlowPopupProvider = ({
	source,
	target,
	edgeId,
	sourceHandle,
	nodeId,
	children,
}: FlowPopupCtx) => {
	const value = useMemo(() => {
		return {
			source,
			target,
			edgeId,
			sourceHandle,
			nodeId,
		}
	}, [source, target, edgeId, sourceHandle, nodeId])

	return <FlowPopupContext.Provider value={value}>{children}</FlowPopupContext.Provider>
}
