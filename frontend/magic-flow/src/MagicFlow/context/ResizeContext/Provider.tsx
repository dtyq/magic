import React, { useMemo } from "react"
import { ResizeContext, ResizeCtx } from "./Context"

export const ResizeProvider = ({ windowSize, children }: ResizeCtx) => {
	const value = useMemo(() => {
		return {
			windowSize,
		}
	}, [windowSize])

	return <ResizeContext.Provider value={value}>{children}</ResizeContext.Provider>
}
