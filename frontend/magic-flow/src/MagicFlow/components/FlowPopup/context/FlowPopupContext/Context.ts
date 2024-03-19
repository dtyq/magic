import React from "react"

export type FlowPopupCtx = React.PropsWithChildren<{
	source?: null | string
	target?: null | string
	edgeId?: null | string
	sourceHandle?: null | string
	nodeId?: string
}>

export const FlowPopupContext = React.createContext({
	source: null,
	target: null,
	edgeId: null,
	sourceHandle: null
} as FlowPopupCtx)
