import React, { useMemo } from "react"
import { PanelContext, PanelCtx } from "./Context"

export const PanelProvider = ({ agentType, setAgentType, children }: PanelCtx) => {
	const value = useMemo(() => {
		return {
			agentType,
			setAgentType,
		}
	}, [agentType, setAgentType])

	return <PanelContext.Provider value={value}>{children}</PanelContext.Provider>
}
