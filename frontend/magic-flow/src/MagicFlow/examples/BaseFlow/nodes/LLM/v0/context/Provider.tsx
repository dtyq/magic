import React, { useMemo } from "react"
import type { ToolOptionsCtx } from "./Context"
import { ToolOptionsContext } from "./Context"

export const ToolOptionsProvider = ({ tools, children }: ToolOptionsCtx) => {
	const value = useMemo(() => {
		return {
			tools,
		}
	}, [tools])

	return <ToolOptionsContext.Provider value={value}>{children}</ToolOptionsContext.Provider>
}

export default null
