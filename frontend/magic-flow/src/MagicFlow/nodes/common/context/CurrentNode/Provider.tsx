import React, { useMemo } from "react"
import { CurrentNodeContext, CurrentNodeCtx } from "./Context"

export const CurrentNodeProvider = ({ currentNode, children }: CurrentNodeCtx) => {
	const value = useMemo(() => {
		return {
			currentNode,
		}
	}, [currentNode])

	return <CurrentNodeContext.Provider value={value}>{children}</CurrentNodeContext.Provider>
}
